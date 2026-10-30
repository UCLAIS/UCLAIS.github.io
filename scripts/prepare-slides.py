#!/usr/bin/env python3
"""Prepare approved slide PDFs for the static website. Runs locally, never in a Worker.

PPTX inputs must first be exported to PDF locally. No notes, macros or notebook
code are executed. Text extraction uses the existing bounded PDF subprocess.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile

from PIL import Image
from pypdf import PdfReader, PdfWriter

ROOT = Path(__file__).resolve().parents[1]


def repository_file(value, prefix):
    candidate = Path(value)
    filename = candidate if candidate.is_absolute() else ROOT / candidate
    relative = filename.relative_to(ROOT).as_posix()
    if not relative.startswith(prefix) or not re.fullmatch(r"[A-Za-z0-9_./-]+", relative) or any(part in (".", "..") for part in relative.split("/")):
        raise ValueError("Use a repository path with a simple filename in the documented folder.")
    current = ROOT
    for part in relative.split("/"):
        current /= part
        if current.is_symlink():
            raise ValueError("Symlinked material is refused.")
    if not filename.is_file() or filename.stat().st_size > 25 * 1024 * 1024:
        raise ValueError("Material is missing or exceeds 25 MiB.")
    return filename, relative


def prepare(args):
    source, relative = repository_file(args.source, "knowledge/")
    if relative.split("/")[1] not in ("tutorials", "nexus") or source.suffix not in (".md", ".mdx", ".pdf", ".ipynb"):
        raise ValueError("Choose a canonical tutorial or Nexus knowledge file.")
    pdf = Path(args.pdf).resolve(strict=True)
    if pdf.suffix.lower() != ".pdf" or pdf.stat().st_size > 25 * 1024 * 1024:
        raise ValueError("Use an approved PDF up to 25 MiB.")
    extractor = ROOT / "services/knowledge/src/ingestion/extract_pdf.py"
    result = subprocess.run([sys.executable, str(extractor), str(pdf)], capture_output=True, timeout=45, check=True)
    if len(result.stdout) > 12 * 1024 * 1024:
        raise ValueError("Slide text exceeds its limit.")
    texts = json.loads(result.stdout)
    if not 1 <= len(texts) <= 300:
        raise ValueError("Use a deck with 1–300 slides.")
    folder = ROOT / "static/materials" / Path(relative.removeprefix("knowledge/")).with_suffix("")
    current = ROOT
    for part in folder.relative_to(ROOT).parts:
        current /= part
        if current.is_symlink():
            raise ValueError("Symlinked output directories are refused.")
    folder.mkdir(parents=True, exist_ok=True)
    files = []
    for item in args.file:
        label, separator, filename = item.partition("=")
        if not separator or not label.strip() or len(label) > 200:
            raise ValueError("Use --file 'Label=static/materials/path/to/file'.")
        _, attachment = repository_file(filename, "static/materials/")
        files.append({"label": label, "url": "/" + attachment.removeprefix("static/")})
    if len(files) > 20:
        raise ValueError("At most 20 additional files are supported.")
    # A fresh document root drops document-level actions, attachments and metadata.
    # Interactive annotations are refused; ordinary HTTPS link annotations remain.
    reader = PdfReader(pdf)
    writer = PdfWriter()
    for page in reader.pages:
        for annotation in page.get("/Annots", []):
            value = annotation.get_object()
            action = value.get("/A", {})
            if value.get("/Subtype") != "/Link" or value.get("/AA") or (action and (action.get("/S") != "/URI" or not str(action.get("/URI", "")).startswith("https://"))):
                raise ValueError("Export a non-interactive PDF without forms or active annotations.")
        page.pop("/AA", None)
        page.pop("/Metadata", None)
        writer.add_page(page)
    writer.metadata = None
    target = pdf if pdf.is_relative_to(ROOT / "static/materials") else folder / "slides.pdf"
    cleaned = folder / ".slides.tmp.pdf"
    with cleaned.open("wb") as output:
        writer.write(output)
    cleaned.replace(target)
    prefix = "/" + folder.relative_to(ROOT / "static").as_posix()
    slides = []
    with tempfile.TemporaryDirectory(prefix="uclai-slides-") as temporary:
        subprocess.run(["pdftoppm", "-png", "-scale-to", "1600", str(target), str(Path(temporary) / "page")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120, check=True)
        pages = sorted(Path(temporary).glob("page-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
        if len(pages) != len(texts):
            raise ValueError("Rendered slide count does not match the PDF.")
        for number, image_path in enumerate(pages, 1):
            image = Image.open(image_path).convert("RGB")
            name = f"slide-{number:03d}.webp"
            image.save(folder / name, "WEBP", quality=92, method=6)
            slides.append({"src": f"{prefix}/{name}", "width": image.width, "height": image.height, "text": texts[number - 1]["text"]})
    manifest = {"schemaVersion": 1, "pdf": "/" + target.relative_to(ROOT / "static").as_posix(), "slides": slides, "files": files}
    (folder / "presentation.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Prepared {len(slides)} slides and {len(files)} additional files: {folder.relative_to(ROOT)}/presentation.json")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, help="Canonical knowledge file, e.g. knowledge/tutorials/lesson.md")
    parser.add_argument("--pdf", required=True, help="Approved PDF or local PDF export of the PowerPoint")
    parser.add_argument("--file", action="append", default=[], help="Additional download: Label=static/materials/path")
    try:
        prepare(parser.parse_args())
    except Exception:
        print("Slide preparation failed. Check the local PDF export, file paths, size limits and installed PDF/Pillow/Poppler tools. No source contents were logged.", file=sys.stderr)
        sys.exit(1)
