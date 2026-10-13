#!/usr/bin/env python3
"""The layout canvases shown to the edit model: where a subject stands on its canvas
and how large it and its parts are, in game pixels (one cell = one game pixel, drawn as a
block of a few screen pixels). The canvas, not the words, sets the size of what comes back
(~/github/nova/tools/art/README.md, "How to get a size").

    ~/.cache/nova-art-venv/bin/python scripts/outrun-lab/art/layouts.py [name ...]

writes tmp/outrun-art/ref/<name>.png. A layout is (format, blocks, back, parts): blocks are
(x, y, w, h, colour); parts are bitmaps laid over them, (path, (x, y, w, h)), stretched with
nearest neighbour, for a second pass that redraws a first picture at the size it should have.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(ROOT, "tmp", "outrun-art", "ref")
SNAP = os.path.join(ROOT, "tmp", "outrun-art", "snap")

M = "#ff00ff"
RED, DARK, GLASS, BLACK, CHROME = "#b83030", "#30303c", "#20283c", "#181820", "#a8a8b0"
BLONDE, BROWN, WHITE, GREY, GREEN = "#e8c050", "#7a5030", "#e8e0c8", "#8a8a92", "#2a6a50"
YELLOW, ORANGE, BLUE, STONE, SNOW = "#e0b020", "#e07020", "#3050a0", "#a8a090", "#d8e0f0"
SKY1, SKY2, SKY3 = "#0c1f52", "#132a66", "#1c3878"

# (cells wide, cells high, block px): the picture comes back about cells * block wide.
F11S = (256, 256, 4)     # 1:1, 4 px cells: sprites
F11 = (340, 340, 3)      # 1:1, 3 px cells: sheets of things
F169 = (453, 256, 3)     # 16:9, 3 px cells: backdrops
F169S = (340, 192, 4)    # 16:9, 4 px cells

L = {}


def lay(name, fmt, blocks, back=M, parts=()):
    L[name] = (fmt, blocks, back, parts)


# The player's car from behind: body 120 wide, the two of them above the seat backs.
CAR = [
    (68, 150, 120, 44, RED),            # the rear of the body
    (72, 190, 24, 14, BLACK), (160, 190, 24, 14, BLACK),   # tyres
    (74, 178, 108, 8, CHROME),          # bumper
    (84, 128, 88, 24, DARK),            # the open cockpit, seat backs
    (94, 112, 68, 16, GLASS),           # windscreen frame beyond them
    (84, 94, 40, 46, BLONDE),           # the driver, left: mane, shoulders
    (132, 96, 34, 44, BROWN),           # the passenger, right
]
lay("car", F11S, CAR)
# Second pass: the first picture came back 156 wide; laid at 128 to be redrawn at that size.
lay("car-size", F11S, [], parts=[("car-b.png", (64, 76, 128, 105))])

# Traffic from behind, four to a sheet, each about as wide as it is on the road beside the car.
lay("traffic", F11S, [
    (10, 60, 108, 62, YELLOW),          # checker cab
    (136, 16, 112, 106, GREY),          # removal truck
    (14, 170, 96, 60, GREEN),           # beetle-like small car
    (136, 164, 110, 66, BROWN),         # station wagon with a roof rack
])


# The car steering: the finished straight sprite as it is, to be redrawn swung a little to one side.
lay("car-turn", F11S, [], parts=[("car-size-a.png", (62, 73, 131, 110))])

# Backdrops: a band along the bottom of a 16:9 canvas, magenta sky above, to repeat sideways.
TOWERS = [(0, 196, 453, 60), (6, 150, 40, 106), (52, 120, 34, 136), (92, 164, 46, 92), (144, 96, 30, 160),
          (180, 140, 52, 116), (238, 110, 36, 146), (280, 158, 44, 98), (330, 84, 28, 172), (364, 132, 48, 124),
          (416, 160, 37, 96)]
lay("skyline", F169, [(x, y, w, h, GREY) for x, y, w, h in TOWERS] + [(190, 150, 30, 22, BLUE), (372, 142, 28, 20, BLUE)])
PEAKS = [(0, 196, 453, 60), (20, 160, 120, 96), (50, 128, 60, 128), (70, 104, 22, 152), (150, 170, 110, 86),
         (180, 140, 50, 116), (250, 150, 150, 106), (290, 112, 70, 144), (314, 84, 24, 172), (400, 172, 53, 84)]
lay("mountains", F169, [(x, y, w, h, STONE) for x, y, w, h in PEAKS]
    + [(70, 104, 22, 30, SNOW), (314, 84, 24, 34, SNOW), (190, 140, 30, 20, SNOW), (58, 128, 44, 16, SNOW), (296, 112, 58, 18, SNOW)])
HILLS = [(0, 214, 453, 42), (10, 196, 130, 60), (40, 184, 60, 72), (160, 200, 120, 56), (200, 188, 50, 68),
         (300, 192, 140, 64), (340, 178, 60, 78)]
lay("hills", F169, [(x, y, w, h, GREEN) for x, y, w, h in HILLS])
lay("clouds", F169, [(10, 40, 150, 22, WHITE), (200, 70, 220, 26, WHITE), (60, 120, 120, 16, WHITE),
                     (250, 150, 160, 18, WHITE), (20, 190, 200, 20, WHITE), (300, 210, 130, 16, WHITE)])


# Roadside things, a sheet at a time; a tree is about 140 tall, a house about 150.
lay("props-nature", F11, [
    (8, 18, 124, 140, ORANGE), (144, 8, 84, 150, GREEN), (240, 8, 84, 150, SNOW),
    (10, 176, 44, 156, BROWN), (66, 176, 60, 156, GREY),
    (140, 190, 84, 56, GREEN), (140, 262, 92, 70, STONE),
    (254, 180, 50, 72, YELLOW), (244, 262, 90, 70, WHITE)])
lay("props-country", F11, [
    (8, 16, 172, 136, RED), (190, 58, 144, 94, GREY),
    (8, 196, 148, 136, BROWN), (170, 170, 62, 162, WHITE), (246, 180, 84, 152, BLUE)])
lay("props-city", F11, [
    (8, 20, 180, 118, RED), (204, 50, 50, 88, DARK), (270, 20, 60, 118, YELLOW),
    (8, 154, 110, 178, BROWN), (128, 150, 116, 182, GREY), (256, 190, 78, 142, BLUE)])


def render(name):
    (cw, ch, px), blocks, back, parts = L[name]
    im = Image.new("RGB", (cw, ch), back)
    for x, y, w, h, col in blocks:
        im.paste(Image.new("RGB", (w, h), col), (x, y))
    for path, (x, y, w, h) in parts:
        p = Image.open(path if os.path.isabs(path) else os.path.join(SNAP, path)).convert("RGBA")
        p = p.resize((w, h), Image.NEAREST)
        im.paste(p, (x, y), p)
    im = im.resize((cw * px, ch * px), Image.NEAREST)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, name + ".png")
    im.save(out)
    print(f"layout: {os.path.relpath(out, ROOT)} {im.size[0]}x{im.size[1]} ({cw}x{ch} cells of {px} px)")


if __name__ == "__main__":
    for n in (sys.argv[1:] or list(L)):
        render(n)
