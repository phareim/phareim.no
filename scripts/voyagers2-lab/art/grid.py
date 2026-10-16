#!/usr/bin/env python3
"""A bitmap enlarged for measuring: a faint line every 10 px, a stronger one every 50, the
coordinates along the edges, and boxes drawn over it if given (for rooms.json).

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/grid.py IN.png OUT.png [--scale 4]
        [--boxes rooms.json:room-kitchen]

The boxes are drawn in yellow with their names; nothing is written back.
"""
import argparse
import json
import os

from PIL import Image, ImageDraw, ImageFont


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--scale", type=int, default=4)
    ap.add_argument("--boxes")
    a = ap.parse_args()
    k = a.scale
    im = Image.open(a.src).convert("RGBA")
    m = 28
    big = Image.new("RGBA", (im.width * k + m, im.height * k + m), (20, 20, 28, 255))
    big.paste(im.resize((im.width * k, im.height * k), Image.NEAREST), (m, m))
    d = ImageDraw.Draw(big)
    font = ImageFont.load_default()
    for x in range(0, im.width + 1, 10):
        strong = x % 50 == 0
        d.line([(m + x * k, m), (m + x * k, m + im.height * k)], fill=(255, 255, 255, 110 if strong else 40))
        if x % 20 == 0:
            d.text((m + x * k + 2, 2), str(x), fill=(220, 220, 220, 255), font=font)
    for y in range(0, im.height + 1, 10):
        strong = y % 50 == 0
        d.line([(m, m + y * k), (m + im.width * k, m + y * k)], fill=(255, 255, 255, 110 if strong else 40))
        if y % 20 == 0:
            d.text((2, m + y * k + 2), str(y), fill=(220, 220, 220, 255), font=font)
    if a.boxes:
        path, key = a.boxes.split(":")
        with open(path) as f:
            boxes = json.load(f)[key]
        for name, (x, y, w, h) in boxes.items():
            d.rectangle([m + x * k, m + y * k, m + (x + w) * k - 1, m + (y + h) * k - 1], outline=(255, 230, 0, 255), width=2)
            d.text((m + x * k + 3, m + y * k + 3), name, fill=(255, 230, 0, 255), font=font)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    big.convert("RGB").save(a.out)
    print(f"grid: {a.out} {big.width}x{big.height}")


if __name__ == "__main__":
    main()
