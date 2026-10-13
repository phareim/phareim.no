#!/usr/bin/env python3
"""The canvases shown to the edit model: where a subject stands on its canvas and how large
it and its parts are, in game pixels (one cell = one game pixel, drawn as a block of a few
screen pixels). The canvas, not the words, sets the size of what comes back
(~/github/nova/tools/art/README.md, "How to get a size").

    ~/.cache/nova-art-venv/bin/python scripts/galaga-lab/art/layouts.py [name ...]

writes tmp/galaga-art/ref/<name>.png. A layout is (format, blocks, back, parts): blocks are
(x, y, w, h, colour); parts are bitmaps laid over them, (path, (x, y, w, h)), stretched with
nearest neighbour, for a second pass that redraws a first picture at the size it should have,
and for the style images (finished bitmaps enlarged to the canvas's block size).
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
T = os.path.join(ROOT, "tmp", "galaga-art")
OUT = os.path.join(T, "ref")
SNAP = os.path.join(T, "snap")
PARTS = os.path.join(T, "parts")
NOVA = os.path.expanduser("~/github/nova/public/art")
PUB = os.path.join(ROOT, "public", "galaga")

M = "#ff00ff"
RED, DARK, GLASS, BLACK, CHROME = "#b83030", "#30303c", "#20283c", "#181820", "#a8a8b0"
BLONDE, BROWN, WHITE, GREY, GREEN = "#e8c050", "#7a5030", "#e8e0c8", "#8a8a92", "#2a6a50"
YELLOW, ORANGE, BLUE, STONE, SNOW = "#e0b020", "#e07020", "#3050a0", "#a8a090", "#d8e0f0"
TAN, GOLD, PINK, VIOLET, TEAL = "#c8a070", "#d8a830", "#e08878", "#5a3a8a", "#2a8a8a"
WOOD, BAKE, STEEL, CREAM = "#8a5a30", "#3a2a24", "#7a8088", "#d8c8a0"
SKY1, SKY2 = "#0c1f52", "#132a66"

# (cells wide, cells high, picture px wide): the picture comes back about that wide.
F11C = (128, 128, 1024)   # 1:1, 8 px cells: sheets of small sprites
F11M = (171, 171, 1026)   # 1:1, 6 px cells
F11S = (256, 256, 1024)   # 1:1, 4 px cells
F11 = (340, 340, 1020)    # 1:1, 3 px cells
F169 = (453, 256, 1359)   # 16:9, 3 px cells
F169S = (340, 192, 1360)  # 16:9, 4 px cells
F23 = (277, 416, 831)     # 2:3, 3 px cells
F23S = (208, 312, 832)    # 2:3, 4 px cells
F11P = (192, 192, 1024)   # nine 64 x 64 portraits, 5.33 px

L = {}
SHEETS = {}


def lay(name, fmt, blocks, back=M, parts=()):
    L[name] = (fmt, blocks, back, parts)


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


# ---- priority 1: the two ships, straight and banked to the left ---------------------------

def wagon(bank=False):
    def f(x, y):
        s = -1 if bank else 0
        lf, rf = (3, 7) if bank else (5, 5)
        return [
            (x + 5 + s, y + 4, 18, 24, WHITE),         # the stubby hull
            (x + 9 + s, y, 10, 6, RED),                # the nose cone
            (x + 3 + s, y + 9, 3, 15, WOOD), (x + 22 + s, y + 9, 3, 15, WOOD),   # wood-panel sides
            (x + 5 - lf + 2, y + 22, lf, 9, RED), (x + 21, y + 22, rf, 9, RED),  # fins
            (x + 9 + s, y + 12, 10, 11, TAN),          # the roof rack of pizza boxes
            (x + 10 + s, y + 6, 8, 4, GLASS),          # windscreen
        ]
    return f


def scooter(bank=False):
    def f(x, y):
        s = -1 if bank else 0
        lf, rf = (4, 9) if bank else (7, 7)
        return [
            (x + 10 + s, y, 8, 28, RED),               # the lean dart
            (x + 10 - lf, y + 19, lf, 11, RED), (x + 18, y + 19, rf, 11, RED),   # two fins
            (x + 12 + s, y + 1, 4, 3, YELLOW),         # headlamp
            (x + 11 + s, y + 10, 6, 6, GLASS),         # cockpit bubble
        ]
    return f


grid("ships", F11C, [
    [("ship-rex", 28, 31, WHITE, wagon()), ("ship-nova", 28, 31, RED, scooter())],
    [("ship-rex-bank", 28, 31, WHITE, wagon(True)), ("ship-nova-bank", 28, 31, RED, scooter(True))],
])

# ---- priority 1: twelve pick-ups and the two valves of the console's hull row --------------
PICKS = ["tube", "blaster", "disc", "boombox", "pizza", "bubble",
         "cb", "mirrorball", "tracking", "hairspray", "magnet", "quarter"]
PCOL = [ORANGE, RED, CHROME, DARK, YELLOW, BLUE, BAKE, CHROME, DARK, PINK, RED, CHROME]
grid("picks", F11C, [
    [("pick-" + n, 14, 14, c) for n, c in zip(PICKS[0:5], PCOL[0:5])],
    [("pick-" + n, 14, 14, c) for n, c in zip(PICKS[5:10], PCOL[5:10])],
    [("pick-magnet", 14, 14, RED), ("pick-quarter", 14, 14, CHROME),
     ("valve-on", 15, 20, ORANGE), ("valve-off", 15, 20, DARK)],
])

def regrid(name, fmt, rows, src, gap_x=None, top=None, gap_y=None, keep=True):
    """A sheet again for the second pass: each thing of a first sheet (cut into `src`/thing.png
    under tmp/galaga-art/parts) pasted into a box of the size it should have, in the same
    rows. rows are lists of (thing, box w, box h) or (thing, box w, box h, file). With `keep`
    a thing keeps its own proportions inside its box; without, it is stretched to the box."""
    W, H, _ = fmt
    parts, order = [], []
    total_h = sum(max(t[2] for t in r) for r in rows)
    gy = gap_y if gap_y is not None else (H - total_h) // (len(rows) + 1)
    y = top if top is not None else gy
    for r in rows:
        row_w = sum(t[1] for t in r)
        gx = gap_x if gap_x is not None else (W - row_w) // (len(r) + 1)
        x = (W - row_w - gx * (len(r) - 1)) // 2
        for t in r:
            thing, bw, bh = t[0], t[1], t[2]
            path = os.path.join(PARTS, src, (t[3] if len(t) > 3 else thing) + ".png")
            w, h = bw, bh
            if keep and os.path.exists(path):
                sw, sh = Image.open(path).size
                k = min(bw / sw, bh / sh)
                w, h = max(1, round(sw * k)), max(1, round(sh * k))
            parts.append((path, (x + (bw - w) // 2, y + (bh - h) // 2, w, h)))
            order.append((thing, x, y, bw, bh))
            x += bw + gx
        y += max(t[2] for t in r) + gy
    lay(name, fmt, [], parts=parts)
    SHEETS[name] = order


def banked(src, dst, left=0.6, right=0.95):
    """A top view rolled to its left, roughly, for a second pass to redraw: the left half
    squeezed and darkened, the right half nearly as it is."""
    s = Image.open(os.path.join(PARTS, src)).convert("RGBA")
    w, h = s.size
    a = s.crop((0, 0, w // 2, h)).resize((max(1, round(w / 2 * left)), h), Image.NEAREST)
    b = s.crop((w // 2, 0, w, h)).resize((max(1, round((w - w // 2) * right)), h), Image.NEAREST)
    r, g, bl, al = a.split()
    a = Image.merge("RGBA", (r.point(lambda v: v * 3 // 4), g.point(lambda v: v * 3 // 4), bl.point(lambda v: v * 5 // 6), al))
    out = Image.new("RGBA", (a.width + b.width, h), (0, 0, 0, 0))
    out.paste(a, (0, 0))
    out.paste(b, (a.width, 0))
    out.save(os.path.join(PARTS, dst))


# Second passes of the pilot: the first sheets came back two to three times too large
# (ships 34 x 50 at 8 px cells with detail at 4 px; pick-ups about 45 px at 4 px cells).
if os.path.exists(os.path.join(PARTS, "ships-a", "ship-rex.png")):
    banked("ships-a/ship-rex.png", "ships-a/ship-rex-rolled.png")
    banked("ships-a/ship-nova.png", "ships-a/ship-nova-rolled.png")
regrid("ships-2", F11C, [
    [("ship-rex", 28, 32), ("ship-nova", 18, 32)],
    [("ship-rex-bank", 22, 32, "ship-rex-rolled"), ("ship-nova-bank", 14, 32, "ship-nova-rolled")],
], "ships-a", gap_x=30, keep=False)
regrid("picks-2", F11C, [
    [("pick-" + n, 14, 14, n) for n in PICKS[0:5]],
    [("pick-" + n, 14, 14, n) for n in PICKS[5:10]],
    [("pick-magnet", 14, 14, "magnet"), ("pick-quarter", 14, 14, "quarter"),
     ("valve-on", 15, 21, "valve-on"), ("valve-off", 15, 21, "valve-on")],
], "picks-a")

# Third passes: the model draws in cells of about 4 px whatever the canvas's blocks are, so
# the 8 px canvas came back at twice the size (ships 64 x 81, pick-ups about 38). The canvas
# that sets a size is the 4 px one: 256 cells, each thing pasted a tenth under its size.
regrid("ships-3", F11S, [
    [("ship-rex", 29, 33), ("ship-nova", 20, 33), ("ship-rex-bank", 25, 33), ("ship-nova-bank", 18, 33)],
], "ships-b", gap_x=24, keep=False)
regrid("picks-3", F11S, [
    [("pick-" + n, 14, 14, n) for n in PICKS[0:5]],
    [("pick-" + n, 14, 14, n) for n in PICKS[5:10]],
    [("pick-magnet", 14, 14, "magnet"), ("pick-quarter", 14, 14, "quarter"),
     ("valve-on", 16, 22, "valve-on"), ("valve-off", 16, 22, "valve-off")],
], "picks-b", gap_x=18, gap_y=18, top=84)

# ---- priority 1: the five gangs, nine roles to a sheet ------------------------------------
ROLES = ["grunt", "flanker", "tank", "diver", "sniper", "splitter", "mite", "captor", "raider"]
GANGS = {"glitterati": (CHROME, GOLD), "hogs": (BROWN, ORANGE), "lovemachines": (ORANGE, TEAL),
         "chromons": (CHROME, RED), "noise": (DARK, VIOLET)}
# laid a little under the size wanted (24 x 24; tank and captor 32 x 32; mite 14 x 14)
RSIZE = {"grunt": 22, "flanker": 22, "tank": 29, "diver": 22, "sniper": 22, "splitter": 22,
         "mite": 13, "captor": 29, "raider": 22}
for g, (c1, c2) in GANGS.items():
    grid("gang-" + g, F11S, [
        [(r, RSIZE[r], RSIZE[r], c1 if i % 2 == 0 else c2) for i, r in enumerate(ROLES[k:k + 3])]
        for k in (0, 3, 6)], gap_x=44, gap_y=40)

def dense(name, fmt, things, pitch_x, pitch_y, src, keep=True, by_col=False, rows=None, top=None):
    """A packed sheet: the things of a set repeated in every row until the canvas is full, each
    pasted at the size it should have, with only a few cells of magenta between them. The
    model enlarges a small thing when there is room; here there is none. `things` are
    (thing, box w, box h, file). cut.py finds every copy again by its slot."""
    W, H, _ = fmt
    cols = W // pitch_x
    rows = rows or H // pitch_y
    mx = (W - cols * pitch_x) // 2
    my = top if top is not None else (H - rows * pitch_y) // 2
    parts, order = list(L[name][3]) if name in L else [], list(SHEETS.get(name, []))
    for k in range(cols * rows):
        # by_col: every column holds one thing, so the model has no reason to rearrange
        thing, bw, bh, f = things[(k % cols if by_col else k) % len(things)]
        cx = mx + (k % cols) * pitch_x + pitch_x // 2
        cy = my + (k // cols) * pitch_y + pitch_y // 2
        path = os.path.join(PARTS, src, f + ".png")
        w, h = bw, bh
        if os.path.exists(path):
            sw, sh = Image.open(path).size
            if keep:
                kk = min(bw / sw, bh / sh, 1.0) if keep == "natural" else min(bw / sw, bh / sh)
                w, h = max(1, round(sw * kk)), max(1, round(sh * kk))
        parts.append((path, (cx - w // 2, cy - h // 2, w, h)))
        order.append((f"{thing}~{k // len(things)}", cx - pitch_x // 2, cy - pitch_y // 2, pitch_x, pitch_y))
    lay(name, fmt, [], parts=parts)
    SHEETS[name] = order


# Packed sheets: the test of whether the model keeps a 16 px thing at 16 px when it has no
# room to enlarge it. Pick-ups from their halved third pass, the gang from its first sheet.
dense("picks-d", F11S, [("pick-" + n, 16, 16, n) for n in PICKS]
      + [("valve-on", 16, 22, "valve-on"), ("valve-off", 16, 22, "valve-off")], 24, 27, "../half/picks-c", keep="natural")
dense("gang-glitterati-d", F11S, [(r, RSIZE[r] + 2, RSIZE[r] + 2, r) for r in ROLES], 42, 42, "glitterati-a")

# The packed sheet holds: the Glitterati came back at their size (24, 32, 14) in clean 4 px
# cells. The pick-ups did too, but the model sorted the wrapped rows into columns and merged
# two things: so a column holds one thing. picks-e: twelve columns of pick-ups, nine rows,
# and two rows of valves under them, lit and unlit in turn.
GOOD = ["tube", "blaster", "disc", "boombox", "pizza", "hairspray", "magnet", "quarter"]
dense("picks-e", F11S, [("pick-" + n, 16, 16, ("../../parts/picks-d/" + n + "~0") if n in GOOD else n) for n in PICKS],
      21, 21, "../half/picks-c", keep="natural", by_col=True, rows=9, top=4)
dense("picks-e", F11S, [("valve-on", 16, 22, "valve-on~0"), ("valve-off", 16, 22, "valve-off~0")],
      21, 28, "picks-d", keep="natural", by_col=True, rows=2, top=197)
dense("ships-d", F11S, [("ship-rex", 31, 36, "ship-rex"), ("ship-nova", 20, 36, "ship-nova"),
                        ("ship-rex-bank", 27, 36, "ship-rex-bank"), ("ship-nova-bank", 18, 36, "ship-nova-bank"),
                        ("ship-rex", 31, 36, "ship-rex"), ("ship-nova", 20, 36, "ship-nova")],
      42, 42, "ships-b", keep=False, by_col=True)

# Four that did not read or were too large, again: the CB handset, the quarter, the VHS tape
# and the Glitterati's mite (18 x 19 for about 14), a column each, three times over.
_F = [("pick-cb", 16, 16, "picks-e/pick-cb~0"), ("pick-quarter", 16, 16, "picks-e/pick-quarter~0"),
      ("pick-tracking", 16, 16, "picks-e/pick-tracking~0"), ("mite", 12, 12, "glitterati-d/mite~0")]
dense("picks-f", F11S, _F * 3, 21, 21, "", by_col=True)

# The four other gangs, packed: each role of the first sheet at its size, four of each.
# (The Glitterati came back two pixels over what was pasted: these are laid that much under.)
DSIZE = {r: (30 if r in ("tank", "captor") else 12 if r == "mite" else 23) for r in ROLES}
for g in ("hogs", "lovemachines", "chromons", "noise"):
    dense("gang-" + g + "-d", F11S, [(r, DSIZE[r], DSIZE[r], r) for r in ROLES], 42, 42, g + "-a")

# ---- priority 1: the bosses, two to a picture (about 112 x 96; the Deaf Star 200 x 110) ----

def knight(x, y):
    return [(x + 30, y, 46, 34, CHROME),                    # the mirror ball over him
            (x + 45, y + 28, 16, 14, WHITE),                # helmet
            (x + 32, y + 42, 42, 34, WHITE),                # breastplate with lapels
            (x + 14, y + 6, 12, 42, WHITE),                 # the arm that points up
            (x + 76, y + 46, 14, 26, WHITE),                # the hand on the hip
            (x + 26, y + 76, 54, 14, WHITE)]                # flared hips


def fader(x, y):
    return [(x + 24, y, 56, 50, DARK),                      # the helmet
            (x + 49, y + 8, 6, 36, ORANGE),                 # the fader slot down its face
            (x, y + 46, 104, 44, DARK),                     # shoulders and cape
            (x + 36, y + 58, 32, 22, GREY)]                 # chest panel of meters


def humdinger(x, y):
    return [(x + 24, y, 56, 32, DARK),                      # the trailer, behind
            (x + 30, y + 30, 44, 56, BROWN),                # the cab
            (x + 38, y + 44, 28, 22, STEEL),                # V8 block
            (x + 34, y + 64, 36, 26, CHROME),               # the chrome mask on the nose
            (x + 14, y + 6, 10, 22, BLACK), (x + 80, y + 6, 10, 22, BLACK),
            (x + 18, y + 54, 12, 26, BLACK), (x + 74, y + 54, 12, 26, BLACK),
            (x + 24, y + 34, 6, 18, CHROME), (x + 74, y + 34, 6, 18, CHROME)]


def cal(x, y):
    b = [(x, y + 8, 104, 74, STEEL), (x + 34, y + 26, 36, 36, CHROME), (x + 40, y + 32, 24, 24, RED)]
    for i in range(4):
        b += [(x + 6 + i * 7, y + 14 + j * 16, 5, 11, ORANGE) for j in range(4)]
        b += [(x + 75 + i * 7, y + 14 + j * 16, 5, 11, ORANGE) for j in range(4)]
    return b


def durant(x, y):
    hs = [30, 40, 50, 56, 50, 40, 30]
    b = [(x + i * 15, y + 56 - h, 13, h, GOLD) for i, h in enumerate(hs)]
    return b + [(x + 14, y + 54, 76, 30, WOOD), (x + 20, y + 76, 64, 10, WHITE), (x + 46, y + 56, 12, 16, DARK)]


def deafstar(x, y):
    return [(x, y, 190, 28, GREY), (x + 8, y + 28, 174, 24, GREY), (x + 24, y + 52, 142, 22, GREY),
            (x + 46, y + 74, 98, 18, GREY), (x + 72, y + 92, 46, 12, GREY),
            (x + 40, y + 6, 76, 62, DARK), (x + 60, y + 20, 36, 30, BLACK),   # the woofer
            (x + 136, y + 24, 20, 20, RED)]                                   # the tweeter


lay("boss-a", F11S, knight(76, 22) + fader(76, 146))
lay("boss-b", F11S, humdinger(76, 22) + cal(76, 146))
lay("boss-c", F11S, deafstar(33, 14) + durant(76, 148))

# Second pass for the two bosses that came back much taller than 96: the Knight (72 x 141
# with his chain) and the organ (129 x 128), pasted at about four fifths.
lay("boss-fix", F11S, [], parts=[("parts/bosses/boss-knight.png", (36, 72, 56, 110)),
                                  ("parts/bosses/boss-durant.png", (118, 74, 108, 107))])

# ---- priority 2: the friends ---------------------------------------------------------------
# The stranded ships and the Pigeon: a sheet of blocks first (what each is), packed after.
grid("friends", F11S, [
    [("stranded-babs", 64, 77, PINK), ("stranded-ridley", 64, 77, YELLOW)],
    [("stranded-lena", 64, 77, WHITE), ("duo", 72, 72, GREY)],
], gap_x=40, gap_y=30)


def rig(colour, pod, pods=3):
    """A long-haul rig from above, nose up: 36 x 150. The cab is the top 38 rows and whole on
    its own; a coupling at rows 38 to 41; then the pods."""
    def f(x, y):
        b = [(x + 2, y, 32, 38, colour), (x + 6, y + 6, 24, 8, GLASS),
             (x, y + 16, 3, 16, CHROME), (x + 33, y + 16, 3, 16, CHROME),     # the stacks
             (x + 28, y + 1, 2, 12, BLACK)]                                    # the CB aerial
        h = (150 - 42 - (pods - 1) * 4) // pods
        yy = y + 42
        for i in range(pods):
            b.append((x + 16, yy - 4, 4, 4, DARK))                             # coupling
            b.append((x + 1, yy, 34, h, pod))
            yy += h + 4
        return b
    return f


grid("rigs", F11S, [[("rig-marge", 36, 150, TEAL, rig(TEAL, WOOD, 2)),
                     ("rig-duckie", 36, 150, YELLOW, rig(YELLOW, CHROME, 3)),
                     ("rig-barton", 36, 150, WHITE, rig(WHITE, CREAM, 2))]], gap_x=34)

def packed(name, fmt, rows, gap=8):
    """A packed sheet with a column for each thing: rows are (y, [(file under parts/, w, h,
    source box or None), ...]); each row is centred, `gap` cells between its things. Things
    are stretched to w x h (nearest neighbour): this is where a size is set."""
    W, H, _ = fmt
    parts = []
    for y, things in rows:
        total = sum(t[1] for t in things) + gap * (len(things) - 1)
        x = (W - total) // 2
        for f, w, h, box in things:
            path = os.path.join(PARTS, f + ".png")
            if box and os.path.exists(path):
                cut = os.path.join(PARTS, f + "-box%d-%d-%d-%d.png" % box)
                Image.open(path).convert("RGBA").crop((box[0], box[1], box[0] + box[2], box[1] + box[3])).save(cut)
                path = cut
            parts.append((path, (x, y, w, h)))
            x += w + gap
    lay(name, fmt, [], parts=parts)


# The friends at their size (about 40 x 48, the Pigeon 44 x 44), four rows, and with them the
# Road Hogs' sniper, which their own packed sheet lost.
_FR = [("friends-a/stranded-babs", 38, 46, None), ("friends-a/stranded-ridley", 38, 46, None),
       ("friends-a/stranded-lena", 38, 46, None), ("friends-a/duo", 42, 42, None),
       ("hogs-a/sniper", 11, 23, None), ("hogs-a/sniper", 11, 23, None), ("hogs-a/sniper", 11, 23, None)]
packed("friends-d", F11S, [(8 + i * 62, _FR) for i in range(4)], gap=9)

# The rigs at their size: they came back 37 x 205 with a cab of 51 rows; pasted 34 x 146 the
# cab is 37 rows. A row of cabs above and below (their top 51 rows) leaves no room to grow.
_RIGS = ["rigs-a/rig-marge", "rigs-a/rig-duckie", "rigs-a/rig-barton"] * 2
packed("rigs-d", F11S, [(8, [(f, 34, 37, (0, 0, 42, 52)) for f in _RIGS]),
                        (56, [(f, 34, 146, None) for f in _RIGS]),
                        (213, [(f, 34, 37, (0, 0, 42, 52)) for f in _RIGS])], gap=8)

# The Knight and the organ at their size: a second pass with room round them grew back to
# 141 and 131 tall, so they are packed too, three across and two rows.
_K, _D = ("bossfix/boss-knight", 56, 108, None), ("bossfix/boss-durant", 104, 104, None)
packed("boss-d", F11S, [(10, [_K, _D, _K]), (134, [_D, _K, ("bossfix/boss-knight", 56, 108, None)])], gap=10)

# ---- priority 3: the portraits --------------------------------------------------------------
# Nine squares of 64, and nova's own nine finished portraits in the same squares as the style.
lay("portraits", F11P, [(x * 64, y * 64, 64, 64, SKY2 if (x + y) % 2 else SKY1) for y in range(3) for x in range(3)], back=SKY1)
_FACES = ["stoodup/portrait-rex-cheerful", "stoodup/portrait-rex-worried", "stoodup/portrait-mei-calm",
          "nova/portrait-calm", "nova/portrait-angry", "stoodup/portrait-mei-excited",
          "stoodup/portrait-bigeight-calm", "stoodup/portrait-bigeight-shout", "stoodup/portrait-usher"]
lay("style-portraits", F11P, [], back=SKY1,
    parts=[(os.path.join(NOVA, f + ".png"), ((i % 3) * 64, (i // 3) * 64, 64, 64)) for i, f in enumerate(_FACES)])

# ---- priority 4: the console ------------------------------------------------------------------
# A panel fills its whole canvas (no magenta round it) and the game's bitmap is a box cut out
# of the middle, so the only magenta in the picture is the windows. Windows are given in the
# bitmap's own pixels: name -> (x, y, w, h). windows.py measures what came back against these.
F916 = (256, 453, 768)     # 9:16, 3 px cells
CROP = {"console-left": (28, 10, 200, 432), "console-right": (28, 10, 200, 432), "console-band": (50, 48, 240, 96)}
WINDOWS = {
    "console-left": {"portrait": (30, 26, 64, 64), "name": (30, 102, 120, 9), "channel": (30, 118, 80, 9),
                     "caption": (14, 160, 172, 30)},
    "console-right": {"score": (48, 22, 104, 13), "valves": (45, 52, 110, 26), "weapon": (20, 96, 48, 48),
                      "lamps": (50, 162, 100, 12), "chart": (25, 190, 150, 40)},
    "console-band": {"portrait": (6, 6, 40, 40), "caption": (54, 8, 178, 30), "score": (8, 60, 80, 9),
                     "valves": (98, 58, 60, 12), "weapon": (168, 58, 40, 9), "duet": (168, 74, 40, 6)},
}
VU = (104, 100, 72, 40)     # console-right: the meter's face, painted, not a window


def console(name, base, extra):
    cw, ch, _ = F916 if name != "console-band" else F169S
    ox, oy, w, h = CROP[name]
    b = [(0, 0, cw, ch, base)]
    b += [(ox + x, oy + y, bw, bh, c) for x, y, bw, bh, c in extra]
    for x, y, ww, wh in WINDOWS[name].values():
        b.append((ox + x - 3, oy + y - 3, ww + 6, wh + 6, BAKE))     # a bezel round each window
        b.append((ox + x, oy + y, ww, wh, M))
    lay(name, F916 if name != "console-band" else F169S, b, back=base)


console("console-left", WOOD, [
    (8, 12, 184, 132, "#6a4424"),                      # the television cabinet
    (104, 26, 72, 64, CREAM),                          # speaker grille beside the screen
    (158, 100, 14, 14, CHROME), (158, 120, 14, 14, CHROME),   # two knobs
    (8, 154, 184, 42, BAKE),                           # the caption's panel
    (14, 206, 172, 104, STEEL),                        # the tape deck
    (30, 220, 56, 56, DARK), (114, 220, 56, 56, DARK),  # two reels
    (60, 286, 80, 14, BAKE),                           # the deck's keys
    (20, 330, 60, 40, RED),                            # a pizza-shop sticker
    (120, 326, 60, 90, BAKE),                          # the handset on its hook, cord below
])
console("console-right", STEEL, [
    (8, 10, 184, 232, "#5a6068"),                      # the instrument panel
    (VU[0] - 4, VU[1] - 4, VU[2] + 8, VU[3] + 8, BAKE), (VU[0], VU[1], VU[2], VU[3], CREAM),   # VU meter
    (20, 254, 160, 56, WOOD),                          # a wood-grain strip of toggle switches
    (30, 266, 8, 20, CHROME), (56, 266, 8, 20, CHROME), (82, 266, 8, 20, CHROME), (108, 266, 8, 20, CHROME),
    (136, 262, 36, 36, CREAM),                         # a needle gauge
    (24, 330, 70, 44, RED),                            # the sticker
    (110, 326, 70, 90, BAKE),                          # vents
])
console("console-band", WOOD, [
    (0, 0, 240, 52, "#6a4424"), (0, 52, 240, 44, STEEL),
    (214, 58, 18, 18, CHROME),                         # a knob
])

# ---- priority 5: the sky, two pieces to a picture; the cards ---------------------------------
G = "#00ff00"     # the key of sectors 3 and 5, whose pieces are orange, coral and violet
NIGHT, DUSK, RUST = "#1c2a55", "#2a3a6a", "#4a3028"
lay("sky-1", F11S, [(88, 20, 80, 10, DUSK), (58, 30, 140, 12, DUSK), (38, 42, 180, 14, DUSK), (28, 56, 200, 28, NIGHT),   # the Earth's limb
                    (100, 140, 50, 30, NIGHT), (70, 150, 30, 10, DUSK), (150, 150, 34, 10, DUSK), (112, 172, 26, 40, NIGHT),
                    (80, 190, 30, 8, DUSK), (140, 196, 44, 8, DUSK), (118, 120, 8, 20, RUST)])                            # parked satellites
lay("sky-2", F11S, [(43, 84, 170, 30, NIGHT), (63, 44, 60, 40, DUSK), (130, 14, 70, 44, RUST), (136, 20, 58, 32, NIGHT),
                    (160, 58, 8, 26, RUST), (53, 60, 8, 24, DUSK),                                                         # the truck stop and its sign frame
                    (28, 196, 16, 22, RUST), (64, 188, 16, 22, RUST), (100, 180, 16, 22, RUST), (136, 172, 16, 22, RUST),
                    (172, 164, 16, 22, RUST), (208, 156, 16, 22, RUST)])                                                   # the line of buoys
lay("sky-3", F11S, [(68, 8, 120, 120, RUST), (86, 30, 30, 40, DUSK), (130, 60, 36, 44, DUSK),                             # the lava-lamp planet
                    (33, 160, 190, 20, DUSK), (33, 220, 190, 20, DUSK), (33, 160, 24, 80, DUSK), (199, 160, 24, 80, DUSK)], back=G)   # the ring
lay("sky-4", F11S, [(33, 34, 190, 50, NIGHT), (63, 14, 70, 24, DUSK), (150, 80, 60, 24, DUSK), (40, 50, 30, 20, RUST),    # the hulk
                    (28, 200, 200, 34, NIGHT), (36, 160, 36, 40, DUSK), (84, 150, 40, 50, DUSK), (136, 158, 36, 42, DUSK),
                    (184, 152, 38, 48, DUSK)])                                                                             # the field of dishes
lay("sky-5", F11S, [(73, 8, 110, 110, NIGHT), (98, 32, 60, 60, RUST), (118, 52, 20, 20, DUSK),                            # the loudspeaker moon
                    (28, 160, 200, 60, "#2a2050"), (60, 144, 100, 24, "#342860"), (110, 210, 100, 24, "#342860")], back=G)  # the storm

# Four sky pieces came back wider than 200 (the limb 242, the buoys 222, the hulk 237, the
# dishes 244): they are pasted 180 wide, three to a canvas so that there is little room.
packed("sky-fix-a", F11S, [(14, [("sky/bg-1-a", 180, 40, None)]), (76, [("sky/bg-2-b", 180, 80, None)]),
                           (178, [("sky/bg-1-a", 180, 40, None)])])
packed("sky-fix-b", F11S, [(10, [("sky/bg-4-a", 180, 69, None)]), (96, [("sky/bg-4-b", 180, 61, None)]),
                           (174, [("sky/bg-4-a", 180, 69, None)])])

# The cover, 240 x 320: a rough collage. The upper third stays plain sky for the title.
F34 = (240, 320, 864)
lay("card-title", F34, [(0, 0, 240, 320, NIGHT), (0, 250, 240, 70, DUSK), (20, 270, 200, 50, BLUE),   # sky, the Earth's limb
                        (14, 150, 100, 170, BLONDE), (30, 200, 80, 120, RED),                        # Nova, left, large
                        (130, 160, 96, 160, BROWN), (140, 210, 86, 110, WHITE)],                     # Rex, right
    back=NIGHT, parts=[("parts/ships-b/ship-nova.png", (60, 96, 34, 62)), ("parts/ships-b/ship-rex.png", (150, 104, 50, 63))])
# The ending, 240 x 200 cut from the middle of a square of 256.
lay("card-ending", F11S, [(0, 0, 256, 256, "#201840"), (0, 60, 256, 26, RUST), (200, 40, 6, 60, RED),   # the far end of the Dial, its needle
                          (0, 190, 256, 66, STEEL),                                                  # the Wagon's roof they sit on
                          (40, 96, 70, 110, BLONDE), (150, 100, 70, 106, BROWN), (100, 168, 56, 30, CREAM)],   # Nova, Rex, the open box
    back="#201840")
lay("style-faces", (256, 128, 1024), [], back=SKY1, parts=[
    (os.path.join(NOVA, "nova/portrait-calm.png"), (0, 0, 128, 128)),
    (os.path.join(NOVA, "stoodup/portrait-rex-cheerful.png"), (128, 0, 128, 128))])

# ---- style images: finished bitmaps at a canvas's block size -------------------------------
# Wood grain, bakelite and valves as nova draws them, at 3 px a pixel: the console's style.
lay("style-console", (256, 256, 768), [], back=SKY1, parts=[
    (os.path.join(NOVA, "midnight/tv-a.png"), (21, 6, 214, 138)),
    (os.path.join(NOVA, "midnight/tv-c.png"), (6, 148, 152, 107)),
    (os.path.join(NOVA, "radiorow/valve-rack.png"), (168, 154, 78, 97))])
# Nova's key art, head to waist, at 8 px a pixel: the hand and the block size for 8 px sheets.
lay("style-nova8", (115, 128, 920), [], back=SKY1,
    parts=[(os.path.join(NOVA, "nova/key-stance.png"), (0, 0, 115, 210))])
lay("style-nova4", (230, 256, 920), [], back=SKY1,
    parts=[(os.path.join(NOVA, "nova/key-stance.png"), (58, 23, 115, 210))])
# Nova's small things, at 8 px a pixel: bold icons of few pixels.
lay("style-things8", F11C, [], parts=[
    (os.path.join(NOVA, "things/cassette.png"), (6, 8, 0, 0)),
    (os.path.join(NOVA, "things/slice.png"), (48, 4, 0, 0)),
    (os.path.join(NOVA, "things/soda.png"), (96, 4, 0, 0)),
    (os.path.join(NOVA, "things/record.png"), (6, 48, 0, 0)),
    (os.path.join(NOVA, "things/pizza-box.png"), (46, 50, 0, 0)),
    (os.path.join(NOVA, "things/bottle.png"), (102, 44, 0, 0)),
    (os.path.join(NOVA, "things/hotdog.png"), (6, 96, 0, 0)),
    (os.path.join(NOVA, "things/pretzel.png"), (60, 92, 0, 0)),
])


def render(name):
    (cw, ch, pw), blocks, back, parts = L[name]
    im = Image.new("RGB", (cw, ch), back)
    for x, y, w, h, col in blocks:
        im.paste(Image.new("RGB", (w, h), col), (x, y))
    for path, (x, y, w, h) in parts:
        full = path if os.path.isabs(path) else os.path.join(T, path)
        p = Image.open(full).convert("RGBA")
        if w and h:
            p = p.resize((w, h), Image.NEAREST)
        # hard alpha only
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
