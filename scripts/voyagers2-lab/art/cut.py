#!/usr/bin/env python3
"""Cut a packed sheet (snapped, clear background) into its sprites, by the slots it was laid in.

    cut.py SHEET.png -o DIR --names a,b,c --slots COLS,ROWS,PITCH_X,PITCH_Y,X0,Y0 [--by-col]

The slots are those of layouts.py's `dense` (in canvas cells of a 256-cell canvas; the sheet
may have come back a few pixels larger, so they are scaled to it). Every connected shape on
the sheet goes to the slot whose centre is nearest to its own, and a slot's sprite is all of
its shapes together (a bubble beside its wand). A shape further than 0.6 of a pitch from any
slot centre belongs to another part of the sheet and is left.

Names: the k-th slot in reading order is names[k % len(names)]; with --by-col, names[column].
Copies are numbered, DIR/<name>~<n>.png. Prints every sprite's size, and says so when a slot
is empty or its sprite is larger than the slot (two sprites that grew into each other).
"""
import argparse
import os
import sys

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True  # no __pycache__ beside the scripts
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reduce import save_indexed  # noqa: E402


def label(mask):
    h, w = mask.shape
    lab = np.zeros((h, w), np.int32)
    n = 0
    for y in range(h):
        for x in range(w):
            if mask[y, x] and not lab[y, x]:
                n += 1
                stack = [(y, x)]
                lab[y, x] = n
                while stack:
                    cy, cx = stack.pop()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            ny, nx = cy + dy, cx + dx
                            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                                lab[ny, nx] = n
                                stack.append((ny, nx))
    return lab, n


def runs(on, min_gap):
    """Stretches of a row or column profile that hold something, apart by min_gap or more."""
    out, start, gap = [], None, 0
    for i, v in enumerate(list(on) + [False] * min_gap):
        if v:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                out.append((start, i - gap + 1))
                start = None
    return out


def by_bands(a, rgba, solid, names):
    """The model sometimes sorts a packed sheet into its own columns (one thing to a column).
    Then the slots are gone but the sheet is still rows of things with clear bands between
    them: cut on the bands, name by column."""
    os.makedirs(a.out, exist_ok=True)
    seen, lines = {}, []
    for ri, (y0, y1) in enumerate(runs(solid.any(axis=1), a.row_gap)):
        if a.row is not None and ri not in a.row:
            continue
        cols = runs(solid[y0:y1].any(axis=0), a.col_gap)
        if len(cols) != len(names):
            print(f"cut: WARNING row {ri} holds {len(cols)} things, not {len(names)}: skipped")
            continue
        for ci, (x0, x1) in enumerate(cols):
            if names[ci] == "-":
                continue
            m = solid[y0:y1, x0:x1]
            ys, xs = np.where(m)
            piece = rgba[y0:y1, x0:x1][ys.min():ys.max() + 1, xs.min():xs.max() + 1].copy()
            i = seen.get(names[ci], 0)
            seen[names[ci]] = i + 1
            save_indexed(Image.fromarray(piece, "RGBA"), os.path.join(a.out, f"{names[ci]}~{i}.png"))
            lines.append(f"{names[ci]}~{i} {piece.shape[1]}x{piece.shape[0]}")
    print(f"cut: {len(lines)} sprites from {os.path.basename(a.src)}: " + ", ".join(lines))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--names", required=True)
    ap.add_argument("--slots", help="cols,rows,pitch_x,pitch_y,x0,y0 in canvas cells")
    ap.add_argument("--bands", action="store_true", help="cut on the clear bands between rows and things; names by column")
    ap.add_argument("--row", type=int, action="append", help="with --bands: only this row (0 is the top one); may repeat")
    ap.add_argument("--row-gap", type=int, default=3)
    ap.add_argument("--col-gap", type=int, default=2)
    ap.add_argument("--canvas", type=int, default=256)
    ap.add_argument("--by-col", action="store_true")
    a = ap.parse_args()
    names = a.names.split(",")
    if a.bands:
        rgba = np.array(Image.open(a.src).convert("RGBA"))
        return by_bands(a, rgba, rgba[..., 3] >= 128, names)
    cols, rows, px, py, x0, y0 = (int(v) for v in a.slots.split(","))
    rgba = np.array(Image.open(a.src).convert("RGBA"))
    solid = rgba[..., 3] >= 128
    H, W = solid.shape
    k = W / a.canvas   # the sheet's scale against the canvas (1.0 to 1.02)
    lab, n = label(solid)
    masks = {}
    for i in range(1, n + 1):
        m = lab == i
        ys, xs = np.where(m)
        cx, cy = xs.mean() / k, ys.mean() / k
        c = min(cols - 1, max(0, int(round((cx - x0 - px / 2) / px))))
        r = min(rows - 1, max(0, int(round((cy - y0 - py / 2) / py))))
        if abs(cx - (x0 + c * px + px / 2)) > px * 0.6 or abs(cy - (y0 + r * py + py / 2)) > py * 0.6:
            continue
        masks[(r, c)] = masks.get((r, c), np.zeros_like(solid)) | m
    os.makedirs(a.out, exist_ok=True)
    seen, lines, warn = {}, [], []
    for r in range(rows):
        for c in range(cols):
            name = names[(c if a.by_col else r * cols + c) % len(names)]
            if name == "-":
                continue
            m = masks.get((r, c))
            if m is None or m.sum() < 8:
                warn.append(f"slot {r},{c} ({name}) is empty")
                continue
            ys, xs = np.where(m)
            x_0, x_1, y_0, y_1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            if x_1 - x_0 > px * k or y_1 - y_0 > py * k:
                warn.append(f"slot {r},{c} ({name}) holds {x_1 - x_0}x{y_1 - y_0}: grown into its neighbour")
            piece = rgba[y_0:y_1, x_0:x_1].copy()
            piece[~m[y_0:y_1, x_0:x_1]] = 0
            i = seen.get(name, 0)
            seen[name] = i + 1
            save_indexed(Image.fromarray(piece, "RGBA"), os.path.join(a.out, f"{name}~{i}.png"))
            lines.append(f"{name}~{i} {x_1 - x_0}x{y_1 - y_0}")
    print(f"cut: {len(lines)} sprites from {os.path.basename(a.src)} ({W}x{H}): " + ", ".join(lines))
    for w in warn:
        print("cut: WARNING " + w)


if __name__ == "__main__":
    sys.exit(main())
