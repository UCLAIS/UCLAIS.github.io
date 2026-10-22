"""Generate small static image variants; keep original photographs unchanged.

Run manually with Python and Pillow. Generated images are committed, so builds
and visitors need neither an image service nor Python.
"""
from pathlib import Path
import re

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
STATIC = ROOT / 'static'
COMMITTEE = STATIC / 'img/committee'


def webp(source, destination, max_size, *, lossless=False):
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        has_alpha = 'A' in original.getbands() or 'transparency' in original.info
        image = ImageOps.exif_transpose(original).convert('RGBA' if has_alpha else 'RGB')
        image.thumbnail(max_size, Image.Resampling.LANCZOS)
        image.save(destination, 'WEBP', quality=82, method=6, lossless=lossless)


def main():
    names = set(re.findall(r"image: '([^']+)'", (ROOT / 'src/data/committee.js').read_text()))
    author_paths = re.findall(r'image_url:\s*(/img/committee/\S+)', (ROOT / 'blog/authors.yml').read_text())
    for path in author_paths:
        stem = Path(path).stem
        originals = [p for p in COMMITTEE.iterdir() if p.is_file() and p.stem == stem]
        if len(originals) != 1:
            raise ValueError(f'Expected one original author image for {stem}: {originals}')
        names.add(originals[0].name)

    before = after = 0
    for name in sorted(names):
        source = COMMITTEE / name
        destination = COMMITTEE / 'thumbnails' / f'{source.stem}.webp'
        webp(source, destination, (216, 270))
        before += source.stat().st_size
        after += destination.stat().st_size
    print(f'{len(names)} portraits: {before:,} -> {after:,} bytes ({100 * (1 - after / before):.1f}% smaller)')

    for source in sorted((STATIC / 'img/blog').iterdir()):
        if source.suffix.lower() in {'.jpg', '.jpeg', '.png'}:
            webp(source, source.parent / 'optimised' / f'{source.stem}.webp', (960, 960), lossless=source.suffix.lower() == '.png')

    source = STATIC / 'img/jc/journal-1-image.jpeg'
    webp(source, source.with_suffix('.webp'), (960, 960))
    source = STATIC / 'img/design/society-mark.webp'
    webp(source, source.with_name('society-mark-256.webp'), (256, 256), lossless=True)


if __name__ == '__main__':
    main()
