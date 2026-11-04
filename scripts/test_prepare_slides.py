"""Exercise the actual public PDF output, without executing PDF actions."""
import importlib.util
from pathlib import Path
import shutil
import tempfile
from types import SimpleNamespace
import unittest

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DecodedStreamObject, DictionaryObject, FloatObject, NameObject, TextStringObject

REPOSITORY = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("prepare_slides", REPOSITORY / "scripts/prepare-slides.py")
PREPARE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREPARE)


class SlideSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="uclai-slide-security-")
        self.root = Path(self.temporary.name)
        self.original_root = PREPARE.ROOT
        PREPARE.ROOT = self.root
        source = self.root / "knowledge/tutorials/fixture.md"
        source.parent.mkdir(parents=True)
        source.write_text("# Security fixture")
        extractor = self.root / "services/knowledge/src/ingestion/extract_pdf.py"
        extractor.parent.mkdir(parents=True)
        shutil.copyfile(REPOSITORY / "services/knowledge/src/ingestion/extract_pdf.py", extractor)

    def tearDown(self):
        PREPARE.ROOT = self.original_root
        self.temporary.cleanup()

    def fixture(self, next_action=None, navigation=False, extra_annotation=False):
        writer = PdfWriter()
        page = writer.add_blank_page(width=300, height=200)
        font = writer._add_object(DictionaryObject({NameObject("/Type"): NameObject("/Font"), NameObject("/Subtype"): NameObject("/Type1"), NameObject("/BaseFont"): NameObject("/Helvetica")}))
        page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})})
        stream = DecodedStreamObject()
        stream.set_data(b"BT /F1 12 Tf 20 100 Td (PUBLIC_SLIDE_TEXT) Tj ET")
        page[NameObject("/Contents")] = writer._add_object(stream)
        script = DictionaryObject({NameObject("/S"): NameObject("/JavaScript"), NameObject("/JS"): TextStringObject("void(0)")})
        action = DictionaryObject({NameObject("/S"): NameObject("/URI"), NameObject("/URI"): TextStringObject("https://uclai.co.uk/")})
        if next_action == "dictionary":
            action[NameObject("/Next")] = script
        elif next_action == "array":
            action[NameObject("/Next")] = ArrayObject([script])
        annotation = DictionaryObject({NameObject("/Subtype"): NameObject("/Link"), NameObject("/Rect"): ArrayObject([FloatObject(value) for value in (0, 0, 100, 100)]), NameObject("/A"): action})
        if extra_annotation:
            annotation[NameObject("/PA")] = script
        page[NameObject("/Annots")] = ArrayObject([writer._add_object(annotation)])
        if navigation:
            page[NameObject("/PresSteps")] = DictionaryObject({NameObject("/NA"): script})
            page[NameObject("/AA")] = DictionaryObject({NameObject("/O"): script})
        with (self.root / "input.pdf").open("wb") as output:
            writer.write(output)

    def prepare(self):
        PREPARE.prepare(SimpleNamespace(source="knowledge/tutorials/fixture.md", pdf=str(self.root / "input.pdf"), file=[], generated=True))
        return PdfReader(self.root / "static/materials/_generated/tutorials/fixture/slides.pdf")

    def test_chained_javascript_dictionary_and_array_are_refused(self):
        for kind in ("dictionary", "array"):
            with self.subTest(kind=kind):
                self.fixture(next_action=kind)
                with self.assertRaisesRegex(ValueError, "chained actions"):
                    self.prepare()
                self.assertFalse((self.root / "static/materials/_generated/tutorials/fixture/slides.pdf").exists())

    def test_page_actions_are_removed_and_ordinary_https_link_is_preserved(self):
        self.fixture(navigation=True, extra_annotation=True)
        output = self.prepare()
        page = output.pages[0]
        self.assertNotIn("/PresSteps", page)
        self.assertNotIn("/AA", page)
        self.assertIn("PUBLIC_SLIDE_TEXT", page.extract_text())
        annotation = page["/Annots"][0].get_object()
        self.assertNotIn("/PA", annotation)
        self.assertEqual(set(annotation["/A"]), {"/S", "/URI"})
        self.assertEqual(annotation["/A"]["/URI"], "https://uclai.co.uk/")
        self.assertNotIn("/OpenAction", output.trailer["/Root"])


if __name__ == "__main__":
    unittest.main()
