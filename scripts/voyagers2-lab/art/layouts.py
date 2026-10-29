#!/usr/bin/env python3
"""The canvases shown to the edit model for Space Voyagers II: where a subject stands on its
canvas and how large it and its parts are, in game pixels (one cell = one game pixel, drawn
as a block of a few screen pixels). The canvas, not the words, sets the size of what comes
back (~/github/nova/tools/art/README.md, "How to get a size"). Copied in spirit from
scripts/galaga-lab/art/layouts.py; the style images are built from Space Voyagers I's shipped
bitmaps (public/galaga), since its raw generations are gone.

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/layouts.py [name ...]

writes tmp/voyagers2-art/ref/<name>.png. A layout is (format, blocks, back, parts): blocks are
(x, y, w, h, colour); parts are bitmaps laid over them, (path, (x, y, w, h)), stretched with
nearest neighbour (w or h 0: the bitmap's own size).
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
T = os.path.join(ROOT, "tmp", "voyagers2-art")
OUT = os.path.join(T, "ref")
PARTS = os.path.join(T, "parts")
SV1 = os.path.join(ROOT, "public", "galaga")

M, G = "#ff00ff", "#00ff00"
RED, DARK, GLASS, BLACK, CHROME = "#b83030", "#30303c", "#20283c", "#181820", "#a8a8b0"
BLONDE, BROWN, WHITE, GREY = "#e8c050", "#7a5030", "#e8e0c8", "#8a8a92"
YELLOW, ORANGE, STEEL, CREAM = "#e0b020", "#e07020", "#7a8088", "#d8c8a0"
TAN, GOLD, WOOD, BRICK = "#c8a070", "#d8a830", "#8a5a30", "#8a3a28"
SKY1, SKY2 = "#0c1f52", "#132a66"
NIGHT, DUSK, RUST, SLATE = "#1c2a55", "#2a3a6a", "#4a3028", "#3a4458"

# (cells wide, cells high, picture px wide): the picture comes back about that wide.
F11S = (256, 256, 1024)   # 1:1, 4 px cells
F11P = (192, 192, 1024)   # nine 64 x 64 portraits, 5.33 px
F34 = (240, 320, 864)     # 3:4, 3.6 px cells: the title card

L = {}
SHEETS = {}


def lay(name, fmt, blocks, back=M, parts=()):
    L[name] = (fmt, blocks, back, parts)


def sv1(name):
    return os.path.join(SV1, name + ".png")


def disc(cx, cy, r, colour, step=2):
    """A round blob as rows of blocks."""
    out = []
    for dy in range(-r, r, step):
        yy = dy + step / 2
        half = int((r * r - yy * yy) ** 0.5) if r * r > yy * yy else 0
        if half:
            out.append((cx - half, cy + dy, 2 * half, step, colour))
    return out


def ellipse(cx, cy, rx, ry, colour, step=2):
    out = []
    for dy in range(-ry, ry, step):
        yy = (dy + step / 2) / ry
        half = int(rx * max(0.0, 1 - yy * yy) ** 0.5)
        if half:
            out.append((cx - half, cy + dy, 2 * half, step, colour))
    return out


def grid(name, fmt, rows, gap_x=None, top=None, gap_y=None):
    """A sheet of things in rows, row tops aligned, each row centred: rows are lists of
    (thing, w, h, colour) or (thing, w, h, colour, shape) where shape(x, y) gives blocks."""
    W, H, _ = fmt
    blocks, order = [], []
    total_h = sum(max(t[2] for t in r) for r in rows)
    gy = gap_y if gap_y is not None else (H - total_h) // (len(rows) + 1)
    y = top if top is not None else gy
    for r in rows:
        row_w = sum(t[1] for t in r)
        gx = gap_x if gap_x is not None else (W - row_w) // (len(r) + 1)
        x = (W - row_w - gx * (len(r) - 1)) // 2
        for t in r:
            if len(t) > 4 and t[4]:
                blocks += t[4](x, y)
            else:
                blocks.append((x, y, t[1], t[2], t[3]))
            order.append((t[0], x, y, t[1], t[2]))
            x += t[1] + gx
        y += max(t[2] for t in r) + gy
    lay(name, fmt, blocks)
    SHEETS[name] = order


def dense(name, fmt, things, pitch_x, pitch_y, rows=None, top=None):
    """A packed sheet, a column for each thing: `things` are (thing, box w, box h, file under
    tmp/voyagers2-art/parts), each stretched to its box (nearest neighbour) and repeated down
    its column until the canvas is full, a few cells of magenta between them. With no room
    to grow, the model redraws each at the size it is pasted. cut.py finds them by their slots."""
    W, H, _ = fmt
    cols = len(things)
    rows = rows or H // pitch_y
    mx = (W - cols * pitch_x) // 2
    my = top if top is not None else (H - rows * pitch_y) // 2
    parts = []
    for r in range(rows):
        for c, (thing, bw, bh, f, *keep) in enumerate(things):
            path = os.path.join(PARTS, f + ".png")
            w, h = bw, bh
            if keep and keep[0] and os.path.exists(path):     # its own proportions inside the box
                sw, sh = Image.open(path).size
                k = min(bw / sw, bh / sh)
                w, h = max(1, round(sw * k)), max(1, round(sh * k))
            cx = mx + c * pitch_x + pitch_x // 2
            cy = my + r * pitch_y + pitch_y // 2
            parts.append((path, (cx - w // 2, cy - h // 2, w, h)))
    lay(name, fmt, [], parts=parts)
    print(f"layout: {name}: slots {cols},{rows},{pitch_x},{pitch_y},{mx},{my}")


# ---- A. talk portraits: a sheet of nine squares of 64, a person (or a mascot) to a row -------
lay("portraits", F11P, [(x * 64, y * 64, 64, 64, SKY2 if (x + y) % 2 else SKY1) for y in range(3) for x in range(3)], back=SKY1)
# The style: nine of Space Voyagers I's portraits in the same squares. For the mascot sheets,
# masked and mechanical faces among them, so the model sees non-human faces at that coarseness.
_PEOPLE = ["portrait-rex-cheerful", "portrait-nova-calm", "portrait-marge-calm",
           "portrait-duckie-calm", "portrait-barton-calm", "portrait-ridley-calm",
           "portrait-duo-grin", "portrait-babs-purr", "portrait-durant-calm"]
_MECH = ["portrait-humdinger-calm", "portrait-rex-cheerful", "portrait-knight-angry",
         "portrait-duckie-shout", "portrait-humdinger-angry", "portrait-nova-angry",
         "portrait-duo-grin", "portrait-knight-calm", "portrait-barton-shout"]
for _n, _faces in (("style-portraits", _PEOPLE), ("style-portraits-mech", _MECH)):
    lay(_n, F11P, [], back=SKY1,
        parts=[(sv1(f), ((i % 3) * 64, (i // 3) * 64, 64, 64)) for i, f in enumerate(_faces)])


# ---- B. the title card, 240 x 320: a rough block collage -------------------------------------
def calzone():
    """The Calzone in a three-quarter view, coming at the viewer: its nose low at the left,
    the tail up and to the right. Front: the white wagon with wood sides and Rex's canopy;
    behind, welded on, the red dart with the bubble turret on top, Nova in it."""
    b = []
    b += ellipse(150, 222, 62, 30, RED)                       # the red dart, behind, rising right
    b += [(196, 176, 34, 40, RED), (204, 160, 18, 24, RED)]   # its swept fins
    b += ellipse(92, 256, 78, 42, WHITE)                      # the fat white wagon, near
    b += [(30, 266, 124, 14, WOOD)]                           # wood-panel side
    b += ellipse(30, 262, 28, 26, RED)                        # the red nose cone, nearest
    b += [(14, 248, 24, 22, YELLOW), (18, 252, 8, 6, RED)]    # the Slop's slice on the nose
    b += [(104, 214, 70, 6, CHROME)]                          # the weld seam with rivets
    b += [(62, 210, 58, 36, GLASS)]                           # Rex's canopy, open frame
    b += [(76, 212, 26, 30, BROWN), (76, 216, 26, 5, RED), (78, 232, 22, 12, WHITE)]   # Rex
    b += disc(170, 176, 24, GLASS)                            # the bubble turret, raised behind
    b += [(158, 160, 26, 30, BLONDE), (160, 166, 22, 4, RED), (162, 186, 18, 8, RED)]  # Nova
    b += [(186, 186, 22, 4, CHROME), (186, 194, 22, 4, CHROME)]   # the turret's two barrels
    b += [(206, 228, 20, 12, DARK), (214, 214, 16, 10, DARK)]  # nozzles at the back
    return b


def deep_dish():
    """The carrier behind, upper right, cut off by the right edge: a huge round pan seen a
    little from above, the brick oven chimney rising from its middle, the oven door lit."""
    b = ellipse(196, 118, 96, 24, SLATE)                      # the pan's rim and body
    b += ellipse(196, 112, 86, 16, STEEL)                     # the deck inside the rim
    b += [(186, 84, 18, 30, BRICK), (182, 80, 26, 6, BRICK)]  # the chimney tower
    b += [(130, 124, 34, 14, ORANGE)]                         # the oven-door hangar, lit
    return b


def franchise_fighter(x, y, w):
    h = w * 2 // 3
    return [(x, y + h // 4, w, h // 2, "#6a5a4a"), (x + w // 4, y, w // 2, h, "#6a5a4a"),
            (x + 1, y, w // 4, w // 4, "#6a5a4a"), (x + w - w // 4 - 1, y, w // 4, w // 4, "#6a5a4a"),
            (x + w // 3, y + h // 3, w // 3, h // 4, YELLOW)]


lay("card-title", F34, [(0, 0, 240, 320, NIGHT)] + deep_dish()
    + franchise_fighter(30, 104, 30) + franchise_fighter(76, 132, 22) + calzone(), back=NIGHT)
lay("style-card", (240, 320, 864), [], back=NIGHT, parts=[(sv1("card-title"), (0, 0, 240, 320))])


def card_collage():
    """The second pass of the card: card-title-a came back right in what it shows but with the
    carrier and the fighters in the top quarter, where the logo goes. Its snap (cell 3.48,
    255 x 346) is taken apart and put together again on 240 x 320: rows 0 to 79 one flat sky;
    the carrier at 0.6 to the upper right under that, the fighters at 0.55 to the upper left,
    the ship and the heroes at 0.85 over them (sky round them left out). Written to
    tmp/voyagers2-art/parts/card-collage.png; the model redraws it at that size."""
    import numpy as np
    src = os.path.join(T, "snap", "card-c348.png")
    if not os.path.exists(src):
        return None
    im = Image.open(src).convert("RGB")
    sky = im.getpixel((2, 2))
    out = Image.new("RGB", (240, 320), sky)

    def put(box, k, at, mask_sky=True):
        x, y, w, h = box
        p = im.crop((x, y, x + w, y + h))
        p = p.resize((max(1, round(w * k)), max(1, round(h * k))), Image.NEAREST)
        a = np.array(p).astype(int)
        m = (np.abs(a - np.array(sky)).sum(axis=2) > 40) if mask_sky else np.ones(a.shape[:2], bool)
        out.paste(p, at, Image.fromarray((m * 255).astype("uint8"), "L"))

    put((125, 8, 130, 78), 0.6, (162, 84), mask_sky=False)    # the Deep Dish, whole
    put((2, 25, 78, 50), 0.55, (4, 86), mask_sky=False)       # the two Franchise fighters
    # the carrier's lower edge reaches into the ship's rows (70 to 86, right of Nova's hair):
    # painted out before the ship is taken
    im.paste(sky, (138, 70, 255, 77))
    im.paste(sky, (150, 77, 255, 92))
    put((0, 70, 255, 276), 0.85, (0, 85))     # the Calzone, Rex and Nova, sky left out
    os.makedirs(PARTS, exist_ok=True)
    path = os.path.join(PARTS, "card-collage.png")
    out.save(path)
    return path, "#%02x%02x%02x" % sky


_cc = card_collage()
if _cc:
    lay("card-title-2", F34, [], back=_cc[1], parts=[(_cc[0], (0, 0, 240, 320))])
lay("style-faces", (256, 128, 1024), [], back=SKY1, parts=[
    (sv1("portrait-nova-calm"), (0, 0, 128, 128)), (sv1("portrait-rex-cheerful"), (128, 0, 128, 128))])


# ---- C. sky pieces, two to a picture, on green ------------------------------------------------
# Laid about a tenth under the size wanted (Space Voyagers I's came back wider).
def planet():
    b = disc(128, 82, 64, RUST)
    for i, yy in enumerate(range(30, 136, 14)):
        b += [(64 + abs(82 - yy) // 2, yy, 128 - abs(82 - yy), 5, DUSK if i % 2 else SLATE)]
    b += [(50, 92, 156, 4, GREY), (60, 88, 136, 4, SLATE)]     # the ring of parked junk
    return b


def galaxy():
    b = ellipse(128, 222, 42, 18, DUSK) + ellipse(128, 222, 14, 8, CREAM)
    return b + [(86, 212, 20, 4, SLATE), (150, 230, 20, 4, SLATE)]


def hut():
    b = disc(122, 104, 60, GREY)                              # the grey moon
    b += ellipse(120, 52, 36, 22, STEEL)                      # the dome on its top
    b += [(84, 52, 72, 8, STEEL), (110, 26, 20, 6, CREAM)]    # its rim, a lantern on top
    b += [(176, 30, 6, 30, DARK), (160, 10, 40, 22, RED)]     # the sign on its pylon
    return b


def moon():
    return disc(128, 216, 28, GREY) + disc(118, 206, 6, SLATE) + disc(138, 226, 5, SLATE)


def nebula():
    b = []
    for cx, cy, rx, ry, c in ((60, 52, 46, 22, RUST), (120, 44, 52, 28, BROWN), (186, 54, 48, 24, RUST),
                              (96, 64, 30, 14, DUSK), (160, 36, 30, 12, DUSK), (26, 56, 16, 10, BROWN),
                              (226, 56, 16, 10, BROWN)):
        b += ellipse(cx, cy, rx, ry, c)
    return b


def billboard():
    return [(70, 152, 116, 50, CREAM), (66, 148, 124, 4, DARK), (66, 202, 124, 4, DARK),
            (76, 160, 104, 14, RED), (84, 182, 88, 8, DARK),
            (96, 206, 6, 16, DARK), (154, 206, 6, 16, DARK), (90, 220, 76, 6, STEEL)]


lay("sky-a", F11S, planet() + galaxy(), back=G)
lay("sky-b", F11S, hut() + moon(), back=G)
lay("sky-c", F11S, nebula() + billboard(), back=G)
# Second passes (the pieces as they were cut, before darkening, on green at 4 px a cell):
# - the planet, the galaxy and the nebula came back drawn in cells of 8 px (every pixel a
#   2 x 2 block at the canvas's 4 px: the gate's `doubled`): redrawn at twice the fineness,
#   same size (prompt block `finer-sky`). The nebula twice, so there is no room to grow;
# - the billboard came back 166 x 116 with a catwalk under it, for about 128 x 64, and a
#   stain over a letter: its board and lamps (rows 0 to 78) shrunk to 128 x 61, twice.
def crop_to(src, box, dst):
    p = os.path.join(PARTS, src + ".png")
    if os.path.exists(p):
        x, y, w, h = box
        Image.open(p).convert("RGBA").crop((x, y, x + w, y + h)).save(os.path.join(PARTS, dst + ".png"))


crop_to("sky-first/sky-billboard", (0, 0, 166, 79), "sky-first/billboard-board")
lay("sky-fix-a", F11S, [], back=G, parts=[(os.path.join(PARTS, "sky-first/sky-planet.png"), (41, 8, 0, 0)),
                                          (os.path.join(PARTS, "sky-first/sky-galaxy.png"), (78, 180, 0, 0))])
lay("sky-fix-b", F11S, [], back=G, parts=[(os.path.join(PARTS, "sky-first/sky-nebula.png"), (7, 30, 0, 0)),
                                          (os.path.join(PARTS, "sky-first/sky-nebula.png"), (7, 158, 0, 0))])
lay("sky-fix-c", F11S, [], back=G, parts=[(os.path.join(PARTS, "sky-first/billboard-board.png"), (64, 34, 128, 61)),
                                          (os.path.join(PARTS, "sky-first/billboard-board.png"), (64, 160, 128, 61))])
# The galaxy of sky-fix-a still failed `doubled` once darkened and reduced (broad flat patches
# from cells of 8 px in its core and arms): again, finer, alone, three copies so there is no
# room to grow. Its source is sky-fix-a's galaxy (parts/sky-second).
lay("sky-fix-d", F11S, [], back=G, parts=[(os.path.join(PARTS, "sky-second/sky-galaxy.png"), (78, y, 0, 0))
                                          for y in (20, 106, 192)])

# The style: Space Voyagers I's sky pieces (already darkened) at 4 px a pixel, on night blue.
lay("style-sky", F11S, [], back=NIGHT, parts=[
    (sv1("bg-3-a"), (4, 4, 0, 0)), (sv1("bg-1-b"), (94, 4, 0, 0)),
    (sv1("bg-5-a"), (4, 134, 0, 0)), (sv1("bg-2-a"), (110, 150, 140, 70))])


# ---- D. small sprites: a sheet of blocks first (what each thing is), packed after ----------
FACES = ["face-rat", "face-bear", "face-gorilla", "face-hound", "face-lion"]
HEADS = ["head-rat", "head-bear", "head-gorilla", "head-hound"]
FCOL = {"face-rat": GREY, "face-bear": BROWN, "face-gorilla": DARK, "face-hound": TAN, "face-lion": GOLD,
        "face-slice": YELLOW, "head-rat": GREY, "head-bear": BROWN, "head-gorilla": DARK, "head-hound": TAN}


def head(colour):
    def f(x, y):
        return [(x, y, 28, 26, colour), (x + 10, y + 26, 8, 14, CHROME)]
    return f


grid("sprites", F11S, [
    [(n, 28, 28, FCOL[n]) for n in FACES],
    [("face-slice", 28, 28, YELLOW)] + [(n, 28, 40, FCOL[n], head(FCOL[n])) for n in HEADS],
], gap_x=20, gap_y=40)
lay("style-things", F11S, [], parts=[
    (sv1(n), (x, y, 0, 0)) for n, x, y in (
        ("pick-pizza", 20, 20), ("pick-boombox", 60, 20), ("pick-tracking", 100, 20), ("pick-cb", 140, 20),
        ("enemy-chromons-grunt", 20, 70), ("enemy-hogs-tank", 70, 70), ("enemy-noise-grunt", 120, 70),
        ("enemy-glitterati-captor", 170, 70), ("ship-rex", 20, 130), ("ship-nova", 70, 130),
        ("enemy-lovemachines-tank", 120, 130), ("pick-tube", 180, 130))])

# The packed sheet: each thing of the first sheet at its size, a column each, ten columns.
# Faces in a box of 15 x 15 in their own proportions (they come back a pixel or two larger),
# heads stretched a little wider than their own (38 x 70) to 14 x 22.
dense("sprites-d", F11S, [(n, 15, 15, "sprites-a/" + n, True) for n in FACES + ["face-slice"]]
      + [(n, 14, 22, "sprites-a/" + n) for n in HEADS], 25, 30, rows=8, top=8)
# They came back a third larger than pasted (faces 17 to 21 for 15, heads 18 x 27 for
# 14 x 22). Again, smaller and packed tighter: the chosen copy of each, cleaned
# (parts/sprites-best), faces in a box of 12, heads 12 x 17, for about 16 and 16 x 22.
dense("sprites-e", F11S, [(n, 12, 12, "sprites-best/" + n, True) for n in FACES + ["face-slice"]]
      + [(n, 12, 17, "sprites-best/" + n, True) for n in HEADS], 21, 24, rows=10, top=8)


def render(name):
    (cw, ch, pw), blocks, back, parts = L[name]
    im = Image.new("RGB", (cw, ch), back)
    for x, y, w, h, col in blocks:
        im.paste(Image.new("RGB", (max(1, w), max(1, h)), col), (x, y))
    for path, (x, y, w, h) in parts:
        full = path if os.path.isabs(path) else os.path.join(T, path)
        if not os.path.exists(full):
            print(f"layout: {name}: MISSING {os.path.relpath(full, ROOT)}")
            continue
        p = Image.open(full).convert("RGBA")
        if w and h:
            p = p.resize((w, h), Image.NEAREST)
        a = p.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
        im.paste(p.convert("RGB"), (x, y), a)
    ph = round(pw * ch / cw)
    im = im.resize((pw, ph), Image.NEAREST)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, name + ".png")
    im.save(out)
    print(f"layout: {os.path.relpath(out, ROOT)} {pw}x{ph} ({cw}x{ch} cells of {pw / cw:.2f} px)")


if __name__ == "__main__":
    for n in (sys.argv[1:] or list(L)):
        render(n)
