#!/usr/bin/env python3
"""The contact sheet for the eye: everything in public/voyagers2, enlarged 3x with nearest
neighbour on night blue, each file's name and size under it, in rows by kind. Adapted from
scripts/galaga-lab/art/proof.py.

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/proof.py [scale] [batch]

writes tmp/voyagers2-art/proof/batch1.png (git-ignored), or with batch 2, batch2.png: the
rooms, the endings, the act cards and the sky pieces of acts 2 and 3.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PUB = os.path.join(ROOT, "public", "voyagers2")
PROOF = os.path.join(ROOT, "tmp", "voyagers2-art", "proof")
BACK = (22, 28, 58)
INK = (170, 180, 210)

ROWS = [
    ["portrait-nonna-calm", "portrait-nonna-stern", "portrait-tiny-calm", "portrait-tiny-grin",
     "portrait-dougie-eager", "portrait-dougie-scared"],
    ["portrait-parmesan-calm", "portrait-parmesan-angry", "portrait-mascot-rat", "portrait-mascot-bear",
     "portrait-mascot-gorilla", "portrait-mascot-hound"],
    ["face-rat", "face-bear", "face-gorilla", "face-hound", "face-lion", "face-slice",
     "head-rat", "head-bear", "head-gorilla", "head-hound"],
    ["card-title", "sky-hut", "sky-planet"],
    ["sky-nebula", "sky-billboard", "sky-galaxy", "sky-moon"],
]
ROWS2 = [
    ["room-kitchen", "room-hangar"],
    ["room-breakroom", "card-ending-won"],
    ["card-ending-lost", "card-act-1"],
    ["card-act-2", "card-act-3"],
    ["sky-truckstop", "sky-markers", "sky-buoy"],
]


def main():
    k = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    batch = int(sys.argv[2]) if len(sys.argv) > 2 else 1
    rows = ROWS2 if batch == 2 else ROWS
    OUT = os.path.join(PROOF, f"batch{batch}.png")
    font = ImageFont.load_default()
    pad, label = 12, 26
    placed, y, width = [], pad, 0
    for row in rows:
        x, row_h, items = pad, 0, []
        for n in row:
            path = os.path.join(PUB, n + ".png")
            if not os.path.exists(path):
                print(f"proof: missing {n}")
                continue
            im = Image.open(path).convert("RGBA")
            w, h = im.width * k, im.height * k
            cell = max(w, 96)
            items.append((im, n, x + (cell - w) // 2, w, h, x))
            x += cell + pad
            row_h = max(row_h, h)
        for im, n, px, w, h, lx in items:          # bottom-aligned
            placed.append((im, n, px, y + row_h - h, w, h, lx, y + row_h))
        width = max(width, x)
        y += row_h + label + pad
    sheet = Image.new("RGBA", (width, y), BACK + (255,))
    d = ImageDraw.Draw(sheet)
    for im, n, px, py, w, h, lx, base in placed:
        big = im.resize((w, h), Image.NEAREST)
        sheet.paste(big, (px, py), big)
        d.text((lx, base + 2), n.replace("portrait-", ""), fill=INK, font=font)
        d.text((lx, base + 13), f"{im.width}x{im.height}", fill=INK, font=font)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    rgb = sheet.convert("RGB")
    a = np.array(rgb)
    key = (a[..., 0].astype(np.int32) << 16) | (a[..., 1].astype(np.int32) << 8) | a[..., 2]
    if len(np.unique(key)) <= 256:
        rgb = rgb.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)
    rgb.save(OUT, optimize=True)
    print(f"proof: {os.path.relpath(OUT, ROOT)} {sheet.width}x{sheet.height} {os.path.getsize(OUT) // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
