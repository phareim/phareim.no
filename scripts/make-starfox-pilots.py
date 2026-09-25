#!/usr/bin/env python3
"""Star Fox squadron portraits: Hall of Fame pilot paintings from the fixer.ink
library (tag `phareim-avatar`), cropped to the face, shrunk to 40×40 and snapped
to Star Fox's QUANT_PALETTE with a 4×4 Bayer dither.

Sources are read from the nightly R2 mirror on Sleeper
(~/backups/r2-mirror/aiwdm/images/). Output: public/starfox/pilots/<id>.png.

    python3 scripts/make-starfox-pilots.py
"""
import os
import re
from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIRROR = os.path.expanduser('~/backups/r2-mirror/aiwdm/images/')
OUT = os.path.join(ROOT, 'public/starfox/pilots')
N = 40

# id: (fixer.ink file, face crop as fractions x0, y0, x1, y1, dither spread)
PILOTS = {
    # wingmen
    'heron': ('70dfc236c8404101bb803f2677a11133.png', (0.30, 0.00, 0.80, 0.75), 18),   # MAGENTA HERON
    'bison': ('2024f3551b0e4081b52f5d47fbd6c74f.png', (0.35, 0.11, 0.71, 0.65), 14),   # ATOMIC BISON
    'dingo': ('fa896c0700e547b78a353117215165c7.png', (0.28, 0.02, 0.72, 0.68), 14),   # MIXTAPE DINGO
    # the hangar
    'wombat': ('9fd37b228a534671a8692da17bf9e131.png', (0.20, 0.14, 0.62, 0.77), 14),  # GLITCH WOMBAT
    # the defector
    'cobra': ('a879d90a3b764d49a385da71175d0ce4.png', (0.31, 0.32, 0.66, 0.85), 14),   # MEGA COBRA
    # reserves, when the player shares a wingman's animal
    'walrus': ('72e45dc8c7f545a7836162801a69dbb8.png', (0.28, 0.00, 0.82, 0.80), 14),  # BYTE WALRUS
    'zebra': ('7b91f9b15a5e4f07b05f4c41ffdb09cb.png', (0.28, 0.02, 0.72, 0.70), 14),   # NOVA ZEBRA
}

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def palette():
    src = open(os.path.join(ROOT, 'themes/starfox/pixel.ts')).read()
    block = re.search(r'QUANT_PALETTE = \[(.*?)\]', src, re.S).group(1)
    return [tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) for h in re.findall(r'#([0-9a-fA-F]{6})', block)]


def snap(im, pal, spread):
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            t = (BAYER[y % 4][x % 4] / 16 - 0.5) * spread
            px[x, y] = min(pal, key=lambda p: (p[0] - r - t) ** 2 * 0.3 + (p[1] - g - t) ** 2 * 0.59 + (p[2] - b - t) ** 2 * 0.11)
    return im


def main():
    pal = palette()
    os.makedirs(OUT, exist_ok=True)
    for pid, (file, (x0, y0, x1, y1), spread) in PILOTS.items():
        im = Image.open(MIRROR + file).convert('RGB')
        w, h = im.size
        c = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h)))
        # The paintings are dark; lift them so the face survives the snap.
        c = ImageEnhance.Brightness(c).enhance(1.4)
        c = ImageEnhance.Contrast(c).enhance(1.28)
        c = ImageEnhance.Color(c).enhance(1.22)
        small = c.resize((N * 4, N * 4), Image.LANCZOS).resize((N, N), Image.BOX).convert('RGB')
        snap(small, pal, spread).save(os.path.join(OUT, f'{pid}.png'), optimize=True)
        print('wrote', pid)


if __name__ == '__main__':
    main()
