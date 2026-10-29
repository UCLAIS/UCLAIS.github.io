"""Real PDF checks: python -m unittest discover -s tests -p 'test_pdf_*.py'."""
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zlib

from pypdf import PdfWriter
from pypdf.errors import LimitReachedError
from pypdf.generic import ArrayObject, DictionaryObject, EncodedStreamObject, NameObject, NumberObject

HELPER = Path(__file__).resolve().parents[1] / "src/ingestion/extract_pdf.py"


def compressed_pdf(body, layers=1, predictor_columns=None):
    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    font = DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")})
    page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): writer._add_object(font)})})
    stream = EncodedStreamObject()
    for _ in range(layers):
        body = zlib.compress(body)
    stream._data = body
    stream[NameObject("/Filter")] = NameObject("/FlateDecode") if layers == 1 else ArrayObject([NameObject("/FlateDecode")] * layers)
    if predictor_columns:
        stream[NameObject("/DecodeParms")] = DictionaryObject({NameObject("/Predictor"): NumberObject(12), NameObject("/Columns"): NumberObject(predictor_columns)})
    page[NameObject("/Contents")] = writer._add_object(stream)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


def run_helper(data):
    with tempfile.TemporaryDirectory() as directory:
        filename = Path(directory) / "input.pdf"
        filename.write_bytes(data)
        return subprocess.run([sys.executable, str(HELPER), str(filename)], capture_output=True, timeout=10)


class PDFSecurityTests(unittest.TestCase):
    def test_small_compressed_real_pdf_still_extracts_text(self):
        result = run_helper(compressed_pdf(b"BT /F1 12 Tf 10 10 Td (Safe lesson) Tj ET"))
        self.assertEqual(result.returncode, 0, result.stderr.decode())
        self.assertIn("Safe lesson", json.loads(result.stdout)[0]["text"])

    def test_compressed_pdf_bomb_is_refused_before_text_extraction(self):
        # A ~9-KiB file expands beyond the 8-MiB codec cap.
        data = compressed_pdf(b" " * (9 * 1024 * 1024))
        self.assertLess(len(data), 20 * 1024)
        result = run_helper(data)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, b"")
        self.assertIn(b"decompression limit", result.stderr)

    def test_deep_filter_chain_is_refused_before_decoding(self):
        result = run_helper(compressed_pdf(b"BT /F1 12 Tf (Small text) Tj ET", layers=5))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"filter chain", result.stderr)

    def test_tiny_stream_cannot_allocate_a_gigabyte_predictor_row(self):
        result = run_helper(compressed_pdf(b"", predictor_columns=1024 * 1024 * 1024))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"predictor row", result.stderr)

    def test_aggregate_budget_applies_across_separate_streams(self):
        spec = importlib.util.spec_from_file_location("bounded_pdf", HELPER)
        helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(helper)
        original = helper.filters.decode_stream_data
        try:
            helper.configure_decompression(stream_limit=1024, total_limit=1500)
            stream = EncodedStreamObject()
            stream._data = zlib.compress(b" " * 1000)
            stream[NameObject("/Filter")] = NameObject("/FlateDecode")
            self.assertEqual(len(stream.get_data()), 1000)
            second = EncodedStreamObject()
            second._data = zlib.compress(b" " * 1000)
            second[NameObject("/Filter")] = NameObject("/FlateDecode")
            with self.assertRaisesRegex(LimitReachedError, "aggregate decompression"):
                second.get_data()
        finally:
            helper.filters.decode_stream_data = original
            helper.configure_decompression()

    def test_oversized_input_is_refused_before_pdf_parser(self):
        with tempfile.TemporaryDirectory() as directory:
            filename = Path(directory) / "oversized.pdf"
            with filename.open("wb") as output:
                output.truncate(64 * 1024 * 1024 + 1)
            result = subprocess.run([sys.executable, str(HELPER), str(filename)], capture_output=True, timeout=5)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(b"input byte limit", result.stderr)

    def test_malformed_pdf_does_not_leak_source_fragments_into_diagnostics(self):
        result = run_helper(b"%PDF-1.3\nATTACKER-CONTROLLED-SOURCE-FRAGMENT\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(b"ATTACKER-CONTROLLED", result.stderr)
        self.assertIn(b"Malformed or unsupported PDF", result.stderr)


if __name__ == "__main__":
    unittest.main()
