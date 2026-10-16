#!/usr/bin/env python3
"""Cut the portrait sheets (snapped at 4 px a cell: 256 x 256, nine tiles of 85.33) into
64 x 64 portraits, tmp/voyagers2-art/parts/portraits/<tile>.png, every tile, spares too.

A tile is 85 px and a portrait 64: the window is moved in its tile, a row at a time, so that
the face sits in the middle 40 x 40 (narrow screens show only that). WINDOW has the offsets,
found by looking at tmp/voyagers2-art/view/portraits-check.png, which this writes: every
tile's window at 3x with the middle 40 x 40 boxed. SHIP says which tile becomes which
portrait in public/voyagers2 (finish.py reads it).

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/portraits.py
"""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
T = os.path.join(ROOT, "tmp", "voyagers2-art")
OUT = os.path.join(T, "parts", "portraits")

# sheet -> rows of (who, [tile name x 3])
SHEETS = {
    "portraits-1a": [("nonna", ["calm", "stern", "calm2"]),
                     ("tiny", ["calm", "grin", "calm2"]),
                     ("dougie", ["eager", "scared", "eager2"])],
    "portraits-2a": [("parmesan", ["calm", "angry", "calm2"]),
                     ("rat", ["sing", "calm", "angry"]),
                     ("bear", ["sing", "calm", "angry"])],
    # bear2: a second bear, honey-gold with a scarf, further from any famous mascot bear; its
    # bowler is cut off by the tile's top edge, so the first bear ships
    "portraits-3a": [("gorilla", ["sing", "calm", "angry"]),
                     ("hound", ["sing", "calm", "angry"]),
                     ("bear2", ["sing", "calm", "angry"])],
}
# The window's top left corner in its tile, (dx, dy); (11, 8) unless said here, after looking.
WINDOW = {
    ("portraits-1a", "nonna"): (17, 2), ("portraits-1a", "tiny"): (12, 2), ("portraits-1a", "dougie"): (16, 3),
    ("portraits-2a", "parmesan"): (19, 0), ("portraits-2a", "rat"): (20, 4), ("portraits-2a", "bear"): (19, 0),
    ("portraits-3a", "gorilla"): (16, 11), ("portraits-3a", "hound"): (20, 5), ("portraits-3a", "bear2"): (14, 0),
}
# portrait in public/voyagers2 -> the tile it is cut from
SHIP = {
    "portrait-nonna-calm": "nonna-calm", "portrait-nonna-stern": "nonna-stern",
    "portrait-tiny-calm": "tiny-calm", "portrait-tiny-grin": "tiny-grin",
    "portrait-dougie-eager": "dougie-eager", "portrait-dougie-scared": "dougie-scared",
    "portrait-parmesan-calm": "parmesan-calm", "portrait-parmesan-angry": "parmesan-angry",
    # one portrait a mascot: the singing one (they sing the jingle, badly: DESIGN.md "Who talks")
    "portrait-mascot-rat": "rat-sing", "portrait-mascot-bear": "bear-sing",
    "portrait-mascot-gorilla": "gorilla-sing", "portrait-mascot-hound": "hound-sing",
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
        for r, (who, moods) in enumerate(rows):
            for c, mood in enumerate(moods):
                name = f"{who}-{mood}"
                dx, dy = WINDOW.get((sheet, name)) or WINDOW.get((sheet, who)) or (11, 8)
                x, y = round(c * tw) + dx, round(r * th) + dy
                x, y = max(0, min(im.width - 64, x)), max(0, min(im.height - 64, y))
                p = im.crop((x, y, x + 64, y + 64))
                p.save(os.path.join(OUT, name + ".png"))
                cells.append((name, p))
    k, pad, per = 3, 8, 6
    rows_n = (len(cells) + per - 1) // per
    sheet = Image.new("RGB", (per * (64 * k + pad) + pad, rows_n * (64 * k + pad + 12) + pad), (20, 24, 40))
    d = ImageDraw.Draw(sheet)
    for i, (name, p) in enumerate(cells):
        x, y = pad + (i % per) * (64 * k + pad), pad + (i // per) * (64 * k + pad + 12)
        sheet.paste(p.resize((64 * k, 64 * k), Image.NEAREST), (x, y))
        d.rectangle((x + 12 * k, y + 12 * k, x + 52 * k - 1, y + 52 * k - 1), outline=(0, 255, 120))
        d.text((x, y + 64 * k), name, fill=(200, 200, 220))
    os.makedirs(os.path.join(T, "view"), exist_ok=True)
    sheet.save(os.path.join(T, "view", "portraits-check.png"))
    print(f"portraits: {len(cells)} cut; check tmp/voyagers2-art/view/portraits-check.png")


if __name__ == "__main__":
    sys.exit(main())
