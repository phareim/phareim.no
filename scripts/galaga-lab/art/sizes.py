#!/usr/bin/env python3
"""Every bitmap in public/galaga with its size, colours and bytes, and a few facts the game
needs (a rig's cab rows). Prints a table; README.md's "Sizes" is this output.

    ~/.cache/nova-art-venv/bin/python scripts/galaga-lab/art/sizes.py
"""
import glob
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.abspath(os.path.join(HERE, "..", "..", "..", "public", "galaga"))

total = 0
files = sorted(glob.glob(os.path.join(PUB, "*.png")))
for f in files:
    im = Image.open(f)
    n = os.path.basename(f)[:-4]
    cols = len(im.getcolors(1 << 16) or [])
    clear = "clear" if "transparency" in im.info else "opaque"
    total += os.path.getsize(f)
    extra = ""
    if n.startswith("rig-"):
        solid = np.array(im.convert("RGBA"))[..., 3] > 0
        per = solid.sum(axis=1)
        gap = [i for i in range(30, 60) if per[i] <= 6]
        extra = f"  cab rows 0..{gap[0] - 1}, coupling rows {gap[0]}..{gap[-1]}" if gap else "  no coupling found"
    print(f"{n:28} {im.width:3} x {im.height:<3} {cols:3} colours {clear:6} {os.path.getsize(f):6} bytes{extra}")
print(f"{len(files)} files, {total} bytes")

# The console's windows, measured again from the files themselves: every clear region of a
# panel, its box, and whether it is a whole rectangle. Must agree with windows.json.
import json
import sys

sys.dont_write_bytecode = True  # no __pycache__ beside the scripts
sys.path.insert(0, HERE)
import windows  # noqa: E402

with open(os.path.join(HERE, "windows.json")) as fh:
    said = json.load(fh)
for name in ("console-left", "console-right", "console-band"):
    a = np.array(Image.open(os.path.join(PUB, name + ".png")).convert("RGBA"))
    found = sorted(windows.holes(a, min_area=1), key=lambda f: (f[1], f[0]))
    boxes = {tuple(v): k for k, v in said[name]["windows"].items()}
    print(name)
    for x, y, w, h, area, _ in found:
        who = boxes.pop((x, y, w, h), None)
        print(f"  clear {w:3} x {h:<3} at {x:3},{y:<3} {'whole rectangle' if area == w * h else 'NOT a rectangle'}  {who or 'NOT IN windows.json'}")
    for k in boxes.values():
        print(f"  windows.json has {k}, the file does not")
