#!/usr/bin/env python3
"""The box of a flat region of a bitmap (a chalkboard, a television screen), for rooms.json:
the pixels joined to a seed pixel whose colour is within TOL (RGB, summed) of the seed's,
and the largest rectangle of them that holds the seed, found row by row.

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/measure.py IMG X,Y [X,Y ...] [--tol 60]

prints, for each seed, the bounding box of the region and the inner rectangle (x, y, w, h).
"""
import argparse
from collections import deque

import numpy as np
from PIL import Image


def region(a, sx, sy, tol):
    h, w = a.shape[:2]
    seed = a[sy, sx].astype(int)
    near = np.abs(a.astype(int) - seed).sum(axis=2) <= tol
    got = np.zeros((h, w), bool)
    q = deque([(sx, sy)])
    got[sy, sx] = True
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and near[ny, nx] and not got[ny, nx]:
                got[ny, nx] = True
                q.append((nx, ny))
    return got


def inner(got, sx, sy):
    """The largest rectangle inside the region that holds the seed: grown from the seed's row
    and column while every row and column of it stays in the region."""
    x0 = x1 = sx
    y0 = y1 = sy
    grew = True
    while grew:
        grew = False
        for d in ("l", "r", "u", "d"):
            if d == "l" and x0 > 0 and got[y0:y1 + 1, x0 - 1].all():
                x0 -= 1
                grew = True
            if d == "r" and x1 < got.shape[1] - 1 and got[y0:y1 + 1, x1 + 1].all():
                x1 += 1
                grew = True
            if d == "u" and y0 > 0 and got[y0 - 1, x0:x1 + 1].all():
                y0 -= 1
                grew = True
            if d == "d" and y1 < got.shape[0] - 1 and got[y1 + 1, x0:x1 + 1].all():
                y1 += 1
                grew = True
    return [x0, y0, x1 - x0 + 1, y1 - y0 + 1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("img")
    ap.add_argument("seeds", nargs="+")
    ap.add_argument("--tol", type=int, default=60)
    a = ap.parse_args()
    px = np.array(Image.open(a.img).convert("RGB"))
    for s in a.seeds:
        sx, sy = (int(v) for v in s.split(","))
        got = region(px, sx, sy, a.tol)
        ys, xs = np.nonzero(got)
        bbox = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
        print(f"{s}: colour #{'%02x%02x%02x' % tuple(px[sy, sx])}  region {int(got.sum())} px  "
              f"bbox {bbox}  inner {inner(got, sx, sy)}")


if __name__ == "__main__":
    main()
