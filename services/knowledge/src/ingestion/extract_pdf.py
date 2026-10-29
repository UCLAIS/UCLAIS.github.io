"""Passive PDF text extraction in a bounded, short-lived subprocess.

No PDF JavaScript, document actions, image codecs, links or embedded files run.
The parent also imposes a 45-second wall timeout and a 12-MiB stdout limit.
"""
import json
import logging
import os
import resource
import sys
import threading
import warnings

from pypdf import PdfReader, filters
from pypdf.errors import LimitReachedError
from pypdf.generic import ArrayObject, IndirectObject

MIB = 1024 * 1024
MAX_INPUT = 64 * MIB
MAX_STREAM = 8 * MIB
MAX_DECODED_TOTAL = 64 * MIB
MAX_TEXT = 8 * MIB
_ORIGINAL_DECODE = filters.decode_stream_data
logging.getLogger("pypdf").setLevel(logging.CRITICAL)
warnings.filterwarnings("ignore", module=r"pypdf(?:\..*)?")


class PDFGuardError(ValueError):
    pass


def restrict_process():
    """Set OS limits before reading attacker-controlled PDF structures."""
    resource.setrlimit(resource.RLIMIT_CPU, (20, 25))
    # macOS does not reliably implement DATA/AS ceilings. Linux enforces these
    # hard caps; both platforms also have the independent resident-memory guard.
    if sys.platform.startswith("linux"):
        resource.setrlimit(resource.RLIMIT_DATA, (256 * MIB, 256 * MIB))
        resource.setrlimit(resource.RLIMIT_AS, (512 * MIB, 512 * MIB))

    def watch_memory():
        while True:
            maximum = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            bytes_used = maximum if sys.platform == "darwin" else maximum * 1024
            if bytes_used > 256 * MIB:
                os.write(2, b"PDF extraction refused: resident-memory limit exceeded\n")
                os._exit(3)
            threading.Event().wait(0.02)

    threading.Thread(target=watch_memory, daemon=True).start()


def configure_decompression(stream_limit=MAX_STREAM, total_limit=MAX_DECODED_TOTAL):
    """Cap expansion inside codecs, before page.extract_text allocates output."""
    for name in (
        "ZLIB_MAX_OUTPUT_LENGTH", "LZW_MAX_OUTPUT_LENGTH",
        "RUN_LENGTH_MAX_OUTPUT_LENGTH", "JBIG2_MAX_OUTPUT_LENGTH",
        "MAX_ARRAY_BASED_STREAM_OUTPUT_LENGTH",
    ):
        if not hasattr(filters, name):
            raise PDFGuardError("Unsupported PDF parser version")
        setattr(filters, name, stream_limit)
    filters.MAX_DECLARED_STREAM_LENGTH = MAX_INPUT
    filters.ZLIB_MAX_RECOVERY_INPUT_LENGTH = 64 * 1024
    allowed = {
        "/FlateDecode", "/Fl", "/LZWDecode", "/LZW",
        "/ASCIIHexDecode", "/AHx", "/ASCII85Decode", "/A85",
        "/RunLengthDecode", "/RL",
    }
    total = 0

    def bounded_decode(stream):
        nonlocal total
        chain = stream.get("/Filter", ())
        if isinstance(chain, IndirectObject):
            chain = chain.get_object()
        chain = list(chain) if isinstance(chain, (ArrayObject, list, tuple)) else [chain]
        if len(chain) > 4:
            raise LimitReachedError("PDF filter chain exceeds decompression limit")
        if any(str(value) not in allowed for value in chain):
            raise LimitReachedError("PDF text stream uses a prohibited image or crypt filter")
        parameters = stream.get("/DecodeParms", ())
        if isinstance(parameters, IndirectObject):
            parameters = parameters.get_object()
        parameters = list(parameters) if isinstance(parameters, (ArrayObject, list, tuple)) else [parameters]
        if len(parameters) > 4:
            raise LimitReachedError("PDF filter chain exceeds decompression limit")
        for parameter in parameters:
            if isinstance(parameter, IndirectObject):
                parameter = parameter.get_object()
            if hasattr(parameter, "get"):
                columns = int(parameter.get("/Columns", 1))
                colors = int(parameter.get("/Colors", 1))
                bits = int(parameter.get("/BitsPerComponent", 8))
                # PNG/TIFF predictors allocate a previous row separately. Do not
                # permit a tiny stream to request a huge predictor row buffer.
                if min(columns, colors, bits) < 1 or (columns * colors * bits + 7) // 8 > MIB:
                    raise LimitReachedError("PDF predictor row exceeds decompression limit")
        if len(stream._data) > stream_limit:
            raise LimitReachedError("PDF encoded text stream exceeds decompression limit")
        decoded = _ORIGINAL_DECODE(stream)
        if len(decoded) > stream_limit:
            raise LimitReachedError("PDF decoded stream exceeds decompression limit")
        total += len(decoded)
        if total > total_limit:
            raise LimitReachedError("PDF aggregate decompression limit exceeded")
        return decoded

    filters.decode_stream_data = bounded_decode


def extract(filename):
    if os.path.getsize(filename) > MAX_INPUT:
        raise PDFGuardError("PDF exceeds input byte limit")
    configure_decompression()
    reader = PdfReader(filename, strict=False)
    if reader.is_encrypted:
        raise PDFGuardError("Encrypted PDFs require an authorised export")
    if len(reader.pages) > 500:
        raise PDFGuardError("PDF exceeds page limit")
    pages = []
    total = 0
    for number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        total += len(text.encode("utf-8"))
        if total > MAX_TEXT:
            raise PDFGuardError("PDF text exceeds byte limit")
        pages.append({"page": number, "text": text})
    return pages


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise PDFGuardError("Expected one PDF path")
        restrict_process()
        json.dump(extract(sys.argv[1]), sys.stdout, ensure_ascii=False)
    except Exception as error:
        # Third-party parser errors can quote attacker-controlled object bytes.
        # Only our guard messages and fixed codec-limit labels reach stderr.
        if isinstance(error, PDFGuardError):
            detail = str(error)
        elif isinstance(error, LimitReachedError):
            known = {
                "PDF filter chain exceeds decompression limit",
                "PDF text stream uses a prohibited image or crypt filter",
                "PDF encoded text stream exceeds decompression limit",
                "PDF decoded stream exceeds decompression limit",
                "PDF aggregate decompression limit exceeded",
                "PDF predictor row exceeds decompression limit",
            }
            detail = str(error) if str(error) in known else "PDF decompression limit exceeded"
        elif isinstance(error, MemoryError):
            detail = "PDF memory limit exceeded"
        else:
            detail = "Malformed or unsupported PDF"
        print(f"PDF extraction refused: {detail}", file=sys.stderr)
        sys.exit(2)
