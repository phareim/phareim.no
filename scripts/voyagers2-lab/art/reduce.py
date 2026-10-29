#!/usr/bin/env python3
"""Halve a snapped sprite: one pixel out of every 2 x 2, chosen, not blended.

    reduce.py SRC.png -o OUT.png [--phase auto|0,0|1,0|0,1|1,1]

Why it exists: the edit model does not draw a thing smaller than about 28 of its own cells
(a pick-up laid at 14 came back at 28, a ship laid at 29 x 33 came back at 40 x 54 in cells
half the size). So the smallest sprites are ordered at twice their size, with every line two
cells wide, and every second pixel is dropped here: the same thing nova's wide view does to
its backdrops (~/github/nova/tools/art/README.md, "A picture of 768 x 432", last paragraph).

No colour is made: each pixel of the result is one of the four it stands for.
- clear when fewer than two of the four are solid;
- the colour most of them have;
- on a tie at the outline (some of the four clear): the darkest, so the outline stays whole;
- on a tie inside: the one that differs most from what is round it (a seam, a rivet, a glint
  survives; flat paint gives way).
The grid can start on any of four cells; `auto` takes the start whose blocks are most of one
colour, which is the one the drawing's two-cell lines sit on.
"""
import argparse
import sys

import numpy as np
from PIL import Image


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def halve(rgba, ox, oy):
    h, w, _ = rgba.shape
    pad = np.zeros((h + 4, w + 4, 4), np.uint8)
    pad[2 - oy:2 - oy + h, 2 - ox:2 - ox + w] = rgba
    H, W = (h + 4) // 2, (w + 4) // 2
    out = np.zeros((H, W, 4), np.uint8)
    score = 0
    for by in range(H):
        for bx in range(W):
            cells = pad[by * 2:by * 2 + 2, bx * 2:bx * 2 + 2].reshape(4, 4)
            solid = [tuple(int(v) for v in c[:3]) for c in cells if c[3] >= 128]
            if len(solid) < 2:
                continue
            counts = {}
            for c in solid:
                counts[c] = counts.get(c, 0) + 1
            top = max(counts.values())
            tied = [c for c, n in counts.items() if n == top]
            score += top
            if len(tied) == 1:
                pick = tied[0]
            elif len(solid) < 4:
                pick = min(tied, key=lum)
            else:
                y0, y1 = max(0, by * 2 - 1), min(h + 4, by * 2 + 3)
                x0, x1 = max(0, bx * 2 - 1), min(w + 4, bx * 2 + 3)
                near = pad[y0:y1, x0:x1].reshape(-1, 4)
                near = near[near[:, 3] >= 128][:, :3].astype(float)
                mean = near.mean(axis=0) if len(near) else np.zeros(3)
                pick = max(tied, key=lambda c: (sum((c[i] - mean[i]) ** 2 for i in range(3)), -lum(c)))
            out[by, bx] = (*pick, 255)
    return out, score


def trim(a):
    ys, xs = np.where(a[..., 3] > 0)
    if not len(ys):
        return a
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def reduce_image(im, phase="auto"):
    rgba = np.array(im.convert("RGBA"))
    if phase == "auto":
        best = None
        for oy in (0, 1):
            for ox in (0, 1):
                out, score = halve(rgba, ox, oy)
                if best is None or score > best[1]:
                    best = (out, score, (ox, oy))
        out, _, ph = best
    else:
        ox, oy = (int(v) for v in phase.split(","))
        out, _ = halve(rgba, ox, oy)
        ph = (ox, oy)
    return Image.fromarray(trim(out), "RGBA"), ph


def save_indexed(im, path):
    """Indexed PNG, entry 0 clear."""
    rgba = np.array(im.convert("RGBA"))
    solid = rgba[..., 3] >= 128
    cols = sorted({tuple(int(v) for v in c) for c in rgba[solid][:, :3]})
    index = {c: i + 1 for i, c in enumerate(cols)}
    data = np.zeros(rgba.shape[:2], np.uint8)
    for y, x in zip(*np.where(solid)):
        data[y, x] = index[tuple(int(v) for v in rgba[y, x, :3])]
    out = Image.fromarray(data, "P")
    flat = [255, 0, 255] + [v for c in cols for v in c]
    out.putpalette(flat + [0] * (768 - len(flat)))
    out.save(path, transparency=0, optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--phase", default="auto")
    a = ap.parse_args()
    im, ph = reduce_image(Image.open(a.src), a.phase)
    save_indexed(im, a.out)
    print(f"reduce: {a.out} {im.width}x{im.height} (grid start {ph[0]},{ph[1]})")


if __name__ == "__main__":
    sys.exit(main())
