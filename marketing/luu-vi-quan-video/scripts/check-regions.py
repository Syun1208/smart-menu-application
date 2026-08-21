#!/usr/bin/env python3
"""Contact sheet of every region defined in scene/photos.js.

Run it after re-framing a shot to confirm the rectangle really contains the dish:

    node scripts/export-regions.mjs && python3 scripts/check-regions.py

Writes preview/regions.jpg - one labelled thumbnail per region.
"""

from __future__ import annotations

import json
import math
import pathlib

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / 'scene' / 'regions.json').read_text())

CELL = 320
PAD = 10
LABEL = 26


def main() -> None:
    regions = DATA['regions']
    cols = 6
    rows = math.ceil(len(regions) / cols)
    sheet = Image.new('RGB', (cols * (CELL + PAD) + PAD, rows * (CELL + LABEL + PAD) + PAD), (18, 12, 8))
    draw = ImageDraw.Draw(sheet)
    cache: dict[str, Image.Image] = {}

    for i, (name, r) in enumerate(regions.items()):
        src = r['src']
        if src not in cache:
            cache[src] = Image.open(ROOT / src.replace('../', '')).convert('RGB')
        im = cache[src]
        w, h = im.size
        x0, y0, x1, y1 = r['rect']
        crop = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
        crop.thumbnail((CELL, CELL))
        cx = PAD + (i % cols) * (CELL + PAD)
        cy = PAD + (i // cols) * (CELL + LABEL + PAD)
        sheet.paste(crop, (cx + (CELL - crop.width) // 2, cy + (CELL - crop.height) // 2))
        draw.text((cx + 4, cy + CELL + 4), name, fill=(255, 200, 140))

    out = ROOT / 'preview' / 'regions.jpg'
    out.parent.mkdir(exist_ok=True)
    sheet.save(out, quality=88)
    print(f'wrote {out} ({len(regions)} regions)')


if __name__ == '__main__':
    main()
