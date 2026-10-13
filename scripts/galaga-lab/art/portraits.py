#!/usr/bin/env python3
"""Cut the portrait sheets (snapped at 4 px a cell: 256 x 256, nine tiles of 85.33) into
64 x 64 portraits, tmp/galaga-art/parts/portraits/portrait-<who>-<mood>.png.

A tile is 85 px and a portrait 64: the window is moved in its tile, a row at a time, so that
the face sits in the middle 40 x 40 (narrow screens show only that). WINDOW below has the
offsets, found by looking at tmp/galaga-art/view/portraits-check.png, which this writes: every
tile's window at 3x with the middle 40 x 40 boxed.

    ~/.cache/nova-art-venv/bin/python scripts/galaga-lab/art/portraits.py
"""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
T = os.path.join(ROOT, "tmp", "galaga-art")
OUT = os.path.join(T, "parts", "portraits")

# sheet -> rows of (who, [mood or None for a spare tile] x 3, (dx, dy) of the window in the tile)
SHEETS = {
    "portraits-1a": [("babs", ["purr", "wink", "alarm"], (11, 8)),
                     ("lena", ["calm", "stern", None], (11, 8)),
                     ("ridley", ["calm", "grim", None], (11, 8))],
    "portraits-2a": [("marge", ["calm", "spooky", None], (11, 8)),
                     ("duckie", ["calm", "shout", None], (11, 8)),
                     ("barton", ["calm", "shout", None], (11, 8))],
    "portraits-3a": [("duo", ["grin", "sweat", None], (11, 8)),
                     ("knight", ["calm", "angry", None], (11, 8)),
                     ("humdinger", ["calm", "angry", None], (11, 8))],
    "portraits-4a": [("durant", ["calm", "angry", None], (11, 8)),
                     ("cal", ["calm", "angry", None], (11, 8)),
                     ("fader", ["calm", "angry", None], (11, 8))],
}
# Offsets that differ from (11, 8), after looking: (sheet, who) or (sheet, who, mood) -> (dx, dy)
WINDOW = {
    ("portraits-1a", "babs"): (17, 6), ("portraits-1a", "lena"): (19, 8), ("portraits-1a", "ridley"): (16, 8),
    ("portraits-2a", "marge"): (17, 8), ("portraits-2a", "duckie"): (16, 8), ("portraits-2a", "barton"): (18, 10),
    ("portraits-3a", "duo"): (18, 8), ("portraits-3a", "knight"): (20, 8), ("portraits-3a", "humdinger"): (20, 8),
    ("portraits-4a", "durant"): (18, 8), ("portraits-4a", "cal"): (13, 9), ("portraits-4a", "fader"): (11, 6),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    cells = []
    for sheet, rows in SHEETS.items():
        path = os.path.join(T, "snap", sheet + ".png")
        if not os.path.exists(path):
            print(f"portraits: {sheet} is missing")
            continue
        im = Image.open(path).convert("RGB")
        tw, th = im.width / 3, im.height / 3
        for r, (who, moods, off) in enumerate(rows):
            for c, mood in enumerate(moods):
                if mood is None:
                    continue
                dx, dy = WINDOW.get((sheet, who, mood)) or WINDOW.get((sheet, who)) or off
                x, y = round(c * tw) + dx, round(r * th) + dy
                x, y = max(0, min(im.width - 64, x)), max(0, min(im.height - 64, y))
                p = im.crop((x, y, x + 64, y + 64))
                q = p  # all colours kept: make.sh reduces each portrait once, to 32, with nova's palette
                name = f"portrait-{who}-{mood}"
                q.save(os.path.join(OUT, name + ".png"))
                cells.append((name, q.convert("RGB")))
    k, pad, per = 3, 8, 8
    rows_n = (len(cells) + per - 1) // per
    sheet = Image.new("RGB", (per * (64 * k + pad) + pad, rows_n * (64 * k + pad + 12) + pad), (20, 24, 40))
    d = ImageDraw.Draw(sheet)
    for i, (name, p) in enumerate(cells):
        x, y = pad + (i % per) * (64 * k + pad), pad + (i // per) * (64 * k + pad + 12)
        sheet.paste(p.resize((64 * k, 64 * k), Image.NEAREST), (x, y))
        d.rectangle((x + 12 * k, y + 12 * k, x + 52 * k - 1, y + 52 * k - 1), outline=(0, 255, 120))
        d.text((x, y + 64 * k), name.replace("portrait-", ""), fill=(200, 200, 220))
    os.makedirs(os.path.join(T, "view"), exist_ok=True)
    sheet.save(os.path.join(T, "view", "portraits-check.png"))
    print(f"portraits: {len(cells)} cut; check tmp/galaga-art/view/portraits-check.png")


if __name__ == "__main__":
    sys.exit(main())
