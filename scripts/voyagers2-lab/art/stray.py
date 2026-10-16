#!/usr/bin/env python3
"""Count pixels that still look like the cut-out colour in what ships: solid pixels with
red and blue high and green low (magenta, hot pink), and for the pieces cut from green, with
green high and red and blue low. The gate lets 1 % of an edge pass; this wants none.

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/stray.py
"""
import glob
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.abspath(os.path.join(HERE, "..", "..", "..", "public", "voyagers2"))

bad = 0
for f in sorted(glob.glob(os.path.join(PUB, "*.png"))):
    a = np.array(Image.open(f).convert("RGBA")).astype(int)
    r, g, b, al = (a[..., i] for i in range(4))
    solid = al >= 128
    mag = solid & (r > 150) & (b > 150) & (g < 100)
    grn = solid & (g > 170) & (r < 110) & (b < 110)
    if not os.path.basename(f).startswith("sky-"):
        grn[:] = False      # only the sky pieces were cut from green; elsewhere green is paint
    soft = (al > 0) & (al < 255)
    if mag.sum() or grn.sum() or soft.sum():
        bad += 1
        ys, xs = np.where(mag | grn)
        where = ", ".join(f"{x},{y}" for x, y in list(zip(xs, ys))[:6])
        print(f"{os.path.basename(f):32} magenta {int(mag.sum())}  green {int(grn.sum())}  half-clear {int(soft.sum())}  at {where}")
print(f"stray: {bad} files with key-coloured or half-clear pixels")
