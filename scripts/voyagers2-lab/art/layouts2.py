#!/usr/bin/env python3
"""The canvases of batch 2 (the rooms of the Deep Dish, the endings, the act cards, the sky
pieces of acts 2 and 3), built with layouts.py's helpers and written the same way, to
tmp/voyagers2-art/ref/<name>.png:

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/layouts2.py [name ...]

Rooms are laid on 4:3 at 240 x 180 cells (the picture comes back 1184 x 880, about 4.9 px a
cell) and ship whole. The endings are laid on 1:1 at 256 cells and cut to 240 x 200 (as
Space Voyagers I's ending was); the act cards on 16:9 at 256 x 144 cells, cut to 240 x 120.
Each order gets three images: the block canvas, a style image at the canvas's cell size, and a
cast strip of the people in it as their talk portraits draw them (and the Calzone, from the
title card, for the hangar).
"""
import os
import sys

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import layouts as base  # noqa: E402
from layouts import (lay, render, L, disc, ellipse, sv1, PARTS,  # noqa: E402
                     G, RED, DARK, GLASS, CHROME, BLONDE, BROWN, WHITE, GREY, YELLOW, ORANGE,
                     STEEL, CREAM, TAN, GOLD, WOOD, BRICK, NIGHT, DUSK, RUST, SLATE, SKY1, F11S)

V2 = os.path.join(base.ROOT, "public", "voyagers2")
F43 = (240, 180, 1184)     # 4:3, the rooms
F169 = (256, 144, 1360)    # 16:9, the act cards (cut to 240 x 120)

NAVY, PURPLE, DPURP, OLIVE = "#1c2a55", "#5a3a8a", "#3a2a6a", "#5a6a38"
TEAL, GINGER, SKIN, DSKIN = "#2a7a7a", "#c86a28", "#d8a070", "#6a4028"
BOARD, FLANNEL, COVER, JEANS = "#1e3a2c", "#a83030", "#4a5a78", "#2a3a5a"
TILE, PANEL, SHAG, SPACE = "#5a4038", "#5a3a28", "#7a4a28", "#0c1f52"
MUSTARD, CHOC = "#c89a30", "#4a2a18"


def v2(name):
    return os.path.join(V2, name + ".png")


def person(x, y, w, h, hair, face, body, hat=None):
    """A person as blocks: the head (hair over a face) at the top of the box, the body under."""
    hw = max(10, w * 5 // 10)
    hh = max(12, hw * 6 // 5)
    hx = x + (w - hw) // 2
    b = [(hx - 1, y, hw + 2, hh // 3, hair), (hx, y + hh // 3, hw, hh - hh // 3, face),
         (x, y + hh, w, h - hh, body)]
    if hat:
        b.insert(0, (hx - 2, y - 3, hw + 4, 5, hat))
    return b


# ---- A. the rooms, 240 x 180 ----------------------------------------------------------------
def kitchen():
    b = [(0, 0, 240, 180, TILE), (0, 0, 240, 6, DARK), (0, 150, 240, 30, "#3a2a28")]
    b += disc(30, 30, 16, STEEL) + disc(30, 30, 12, SPACE)               # the porthole, upper left
    b += [(52, 12, 78, 56, WOOD), (55, 15, 72, 50, BOARD)]                # the chalkboard, blank
    b += [(134, 10, 14, 2, STEEL)] + disc(140, 24, 6, DARK) + disc(141, 42, 5, "#8a4a28")   # pans
    b += [(182, 0, 30, 22, BRICK)] + ellipse(196, 42, 46, 22, BRICK) + [(150, 42, 90, 94, BRICK)]
    b += ellipse(197, 80, 25, 10, ORANGE) + [(172, 80, 50, 34, ORANGE), (182, 96, 30, 14, YELLOW)]  # the mouth, fire
    b += [(150, 116, 90, 14, "#4a2a20")]
    b += [(4, 58, 50, 38, WOOD), (10, 64, 10, 8, CREAM), (24, 64, 10, 8, CREAM),            # the radio set
          (8, 78, 40, 6, ORANGE), (0, 96, 66, 6, WOOD), (4, 102, 4, 48, WOOD)]
    b += person(34, 68, 30, 62, DPURP, SKIN, PURPLE) + [(36, 74, 4, 8, ORANGE),             # Mei
                                                       (36, 130, 24, 28, "#2a2a48"), (34, 158, 26, 4, CHROME)]
    b += person(90, 66, 46, 64, GREY, TAN, NAVY) + [(104, 96, 18, 34, WHITE),               # Nonna
                                                   (90, 92, 8, 3, GOLD), (128, 92, 8, 3, GOLD)]
    b += [(68, 128, 172, 6, CHROME), (68, 134, 172, 46, STEEL)]                              # the counter
    b += [(150, 120, 34, 8, CREAM), (154, 121, 26, 5, RED), (106, 122, 14, 8, WHITE), (190, 122, 6, 6, RED)]
    return b


def hangar():
    b = [(0, 0, 240, 180, SLATE), (0, 0, 240, 8, DARK)]
    b += [(20, 14, 158, 92, BRICK)] + ellipse(99, 16, 79, 14, BRICK)                        # the oven-door mouth
    b += [(28, 22, 142, 84, SPACE)] + ellipse(99, 24, 71, 10, SPACE)                         # space beyond it
    b += [(0, 104, 240, 76, "#5a6068"), (28, 104, 142, 3, YELLOW)]                           # the deck
    b += [(180, 56, 58, 48, CREAM), (184, 80, 26, 24, WOOD)]                                 # crates, pizza boxes
    b += ellipse(112, 110, 56, 20, WHITE) + ellipse(112, 120, 54, 10, RED)                   # the Calzone
    b += [(64, 112, 96, 8, WOOD)] + ellipse(56, 112, 12, 12, RED) + [(54, 102, 12, 10, YELLOW)]
    b += [(82, 88, 28, 12, GLASS)] + disc(136, 90, 10, GLASS) + [(156, 82, 14, 26, RED)]
    b += [(80, 130, 4, 12, DARK), (140, 130, 4, 12, DARK), (168, 122, 20, 4, DARK), (186, 98, 4, 28, DARK)]
    b += person(168, 46, 64, 134, DSKIN, DSKIN, COVER) + [(184, 52, 32, 5, GOLD),           # Tiny
                                                         (162, 112, 12, 30, YELLOW), (226, 112, 12, 30, YELLOW)]
    b += person(4, 66, 34, 72, GINGER, SKIN, OLIVE, hat=RED) + [(8, 138, 24, 42, JEANS)]    # Dougie
    b += [(26, 140, 58, 26, RED), (44, 132, 16, 10, GLASS), (26, 130, 8, 12, RED)]           # his scooter-fighter
    return b


def breakroom():
    b = [(0, 0, 240, 132, PANEL), (0, 132, 240, 48, SHAG)]
    b += [(86, 4, 72, 16, CREAM), (84, 22, 76, 46, WOOD), (87, 25, 70, 40, BOARD)]          # sign, board
    b += [(0, 26, 32, 116, DARK), (2, 28, 28, 10, ORANGE), (4, 42, 24, 20, GLASS), (0, 70, 32, 8, RED)]  # arcade
    b += [(72, 96, 96, 22, "#8a5a3a"), (72, 118, 96, 16, "#9a6a40"),                         # the couch
          (68, 104, 8, 36, "#7a4a30"), (164, 104, 8, 36, "#7a4a30")]
    b += [(174, 70, 38, 34, WOOD), (179, 75, 26, 22, "#141a24"), (176, 104, 34, 26, WOOD)]  # the television
    b += [(214, 18, 26, 118, RED), (218, 26, 14, 64, GLASS)]                                 # the vending machine
    b += person(24, 50, 46, 130, "#a85a38", SKIN, FLANNEL, hat=TEAL) + [(24, 84, 9, 60, BROWN), (61, 84, 9, 60, BROWN)]  # Marge
    b += person(80, 68, 32, 56, "#2a1a14", SKIN, OLIVE) + [(104, 70, 14, 12, GINGER), (84, 124, 24, 30, OLIVE)]  # Ridley
    b += person(118, 70, 36, 46, "#4a2a18", SKIN, BROWN, hat=RED) + [(150, 106, 22, 10, JEANS)]  # Duo
    return b


lay("room-kitchen", F43, kitchen(), back=TILE)
lay("room-hangar", F43, hangar(), back=SLATE)
lay("room-breakroom", F43, breakroom(), back=PANEL)
# The style: Space Voyagers I's ending card (people in a scene at this scale), its middle
# 180 rows, at the rooms' cell size.
lay("style-room", F43, [], back=SKY1, parts=[(sv1("card-ending"), (0, -10, 240, 200))])

# The casts: the people's talk portraits side by side, in the order the prompt names them.
lay("cast-kitchen", (128, 64, 1024), [], back=SKY1, parts=[
    (v2("portrait-nonna-calm"), (0, 0, 64, 64)), (sv1("portrait-mei-calm"), (64, 0, 64, 64))])
lay("cast-hangar", (256, 128, 1024), [], back=SKY1, parts=[
    (v2("portrait-tiny-calm"), (0, 0, 64, 64)), (v2("portrait-dougie-eager"), (0, 64, 64, 64)),
    (os.path.join(PARTS, "b2", "calzone.png"), (72, 0, 0, 0))])
lay("cast-breakroom", (192, 64, 1024), [], back=SKY1, parts=[
    (sv1("portrait-marge-calm"), (0, 0, 64, 64)), (sv1("portrait-ridley-calm"), (64, 0, 64, 64)),
    (sv1("portrait-duo-grin"), (128, 0, 64, 64))])


def calzone_crop():
    """The Calzone off the title card (Rex and Nova in it), scaled to 128 rows, for the hangar's
    cast strip: tmp/voyagers2-art/parts/b2/calzone.png."""
    from PIL import Image
    im = Image.open(v2("card-title")).convert("RGB")
    p = im.crop((0, 95, 228, 320))
    k = 128 / p.height
    p = p.resize((round(p.width * k), 128), Image.NEAREST)
    os.makedirs(os.path.join(PARTS, "b2"), exist_ok=True)
    p.save(os.path.join(PARTS, "b2", "calzone.png"))


calzone_crop()


# ---- B. the endings, 240 x 200 out of 256 x 256 (the box x 8..248, y 28..228) ----------------
def won():
    b = [(0, 0, 256, 256, TILE), (8, 22, 240, 62, "#2a3a7a")]                               # the big window
    b += ellipse(128, 120, 150, 40, "#2a5a8a") + [(8, 76, 240, 4, GOLD), (8, 72, 240, 4, ORANGE)]  # the Earth, dawn on its rim
    b += [(0, 84, 256, 12, DARK), (222, 60, 34, 120, BRICK)]                                 # the sill, the oven's edge
    b += person(16, 84, 30, 80, DPURP, SKIN, PURPLE) + [(14, 92, 4, 8, ORANGE)]            # Mei
    b += person(56, 80, 42, 84, "#a85a38", SKIN, FLANNEL, hat=TEAL)                         # Marge
    b += person(106, 92, 36, 72, GREY, TAN, NAVY) + [(116, 118, 16, 46, WHITE)]             # Nonna
    b += person(146, 66, 54, 98, DSKIN, DSKIN, COVER) + [(158, 70, 30, 5, GOLD)]           # Tiny
    b += person(202, 84, 32, 80, "#2a1a14", SKIN, OLIVE) + [(224, 84, 12, 12, GINGER)]     # Ridley
    b += person(26, 122, 36, 62, GINGER, SKIN, OLIVE, hat=RED)                              # Dougie
    b += person(72, 112, 42, 72, BLONDE, SKIN, RED) + [(70, 108, 46, 10, BLONDE), (80, 118, 26, 3, RED)]  # Nova
    b += person(124, 112, 44, 72, BROWN, TAN, WHITE) + [(132, 118, 28, 3, RED)]            # Rex
    b += person(182, 120, 40, 64, "#4a2a18", SKIN, BROWN, hat=RED)                          # Duo
    b += [(0, 184, 256, 10, CHROME), (0, 194, 256, 62, STEEL)]                               # the counter
    b += [(20, 176, 30, 9, CREAM), (24, 177, 22, 6, RED), (100, 178, 34, 8, CREAM), (104, 179, 26, 5, RED),
          (166, 176, 30, 9, CREAM), (170, 177, 22, 6, RED), (214, 179, 26, 8, CREAM)]
    return b


def lost():
    b = [(0, 0, 256, 256, MUSTARD), (0, 0, 256, 30, CHOC), (0, 30, 256, 6, CREAM)]           # tiles, ceiling, tube lamp
    b += [(20, 42, 216, 34, CHOC)] + [(30 + i * 54, 48, 40, 22, CREAM) for i in range(4)]    # menu boards: pictures only
    b += [(34 + i * 54, 52, 30, 14, RED) for i in range(4)]
    b += [(0, 170, 256, 86, ORANGE), (0, 170, 256, 8, CHOC), (0, 212, 256, 6, RED)]          # the plastic counter
    b += [(186, 138, 40, 32, CHROME), (190, 132, 32, 8, DARK)]                               # the cash register
    b += person(140, 96, 46, 74, BLONDE, SKIN, RED) + [(144, 86, 38, 14, WHITE), (144, 94, 38, 4, RED),
                                                      (136, 100, 54, 16, BLONDE)]           # Nova, paper hat
    b += [(30, 104, 82, 152, BROWN)] + disc(70, 90, 30, BROWN)                               # the bear suit, Rex in it
    b += [(56, 74, 28, 30, TAN), (54, 70, 32, 8, BROWN), (54, 78, 32, 4, RED)]               # Rex's own head
    b += disc(118, 160, 22, BROWN) + [(100, 134, 34, 12, "#181820"), (106, 156, 8, 8, "#8ab0d8"), (124, 156, 8, 8, "#8ab0d8")]  # the bear head under his arm
    return b


lay("card-ending-won", F11S, won(), back=TILE)
lay("card-ending-lost", F11S, lost(), back=MUSTARD)
# style: Space Voyagers I's ending card, at the 1:1 canvas's 4 px cells
lay("style-ending", F11S, [], back=SKY1, parts=[(sv1("card-ending"), (8, 28, 240, 200))])
lay("cast-won", (192, 192, 1024), [], back=SKY1, parts=[
    (p, ((i % 3) * 64, (i // 3) * 64, 64, 64)) for i, p in enumerate([
        v2("portrait-nonna-calm"), sv1("portrait-mei-calm"), v2("portrait-tiny-grin"),
        v2("portrait-dougie-eager"), sv1("portrait-marge-calm"), sv1("portrait-ridley-calm"),
        sv1("portrait-duo-grin"), sv1("portrait-rex-cheerful"), sv1("portrait-nova-smirk")])])
lay("cast-lost", (192, 64, 1024), [], back=SKY1, parts=[
    (sv1("portrait-rex-sheepish"), (0, 0, 64, 64)), (sv1("portrait-nova-eyeroll"), (64, 0, 64, 64)),
    (v2("portrait-mascot-bear"), (128, 0, 64, 64))])


# ---- C. the act cards, 240 x 120 out of 256 x 144 (the box x 8..248, y 12..132) --------------
def act1():
    b = [(0, 0, 256, 144, NIGHT)] + ellipse(128, 250, 230, 130, "#2a5a8a")                   # the Earth below
    b += [(40, 126, 50, 8, "#5a6a38"), (120, 132, 70, 8, "#7a5a38"), (200, 124, 30, 6, CREAM)]   # land, cloud
    b += [(0, 118, 256, 2, "#6a8ab8")]
    b += [(150, 28, 30, 8, STEEL), (162, 20, 6, 8, BRICK)]                                   # the Deep Dish, far
    for x, y, w, h in ((24, 34, 18, 10), (64, 72, 24, 9), (108, 50, 12, 7), (204, 70, 20, 12),
                       (226, 32, 12, 8), (40, 98, 14, 8), (180, 96, 16, 8), (132, 88, 8, 6)):
        b += [(x, y, w, h, GREY), (x + w // 3, y - 3, w // 3, 3, CHROME)]                    # satellites, junk
    return b


def act2():
    b = [(0, 0, 256, 144, NIGHT)] + ellipse(70, 30, 90, 16, RUST) + ellipse(190, 22, 70, 12, BROWN)  # nebula
    for i, (x, y, s) in enumerate(((22, 100, 10), (62, 82, 8), (94, 70, 6), (118, 62, 5), (136, 56, 4))):
        b += [(x, y, s, s * 2, STEEL), (x, y - 3, s, 3, ORANGE)]                             # mile-marker buoys
    b += [(150, 58, 96, 14, STEEL), (160, 38, 50, 20, CREAM), (160, 34, 50, 5, RED),        # the truck stop
          (214, 46, 20, 12, RED), (176, 72, 50, 8, DARK)]
    b += [(232, 4, 4, 54, DARK), (214, 2, 40, 26, ORANGE), (222, 8, 22, 14, CREAM)]         # its sign: a cup, an arrow
    b += [(16, 108, 26, 18, RED), (42, 110, 70, 14, GREY), (112, 112, 6, 10, DARK)]          # a big rig in the lane
    b += [(98, 84, 12, 8, TEAL), (110, 85, 30, 6, CREAM), (170, 76, 10, 6, YELLOW), (180, 77, 20, 4, GREY)]
    return b


def act3():
    b = [(0, 0, 256, 144, NIGHT)] + disc(170, 190, 110, GREY)                                # the grey moon
    b += ellipse(160, 82, 50, 30, STEEL) + [(110, 82, 100, 10, STEEL), (154, 48, 12, 6, CREAM)]  # the dome
    b += [(116, 86, 88, 4, GOLD)]                                                            # its lit windows
    b += [(222, 30, 6, 56, DARK), (200, 8, 50, 26, RED), (204, 12, 42, 18, CREAM)]           # the lit sign
    for x, y in ((70, 30), (96, 50), (120, 26), (190, 50), (60, 64), (230, 92), (100, 98), (140, 34)):
        b += [(x, y, 10, 6, "#6a5a4a"), (x + 1, y - 2, 3, 3, "#6a5a4a"), (x + 6, y - 2, 3, 3, "#6a5a4a"),
              (x + 3, y + 2, 4, 2, YELLOW)]                                                  # Franchise fighters
    b += [(26, 104, 22, 14, WHITE), (26, 112, 22, 6, RED), (30, 100, 8, 6, GLASS), (20, 116, 8, 6, ORANGE)]  # the Calzone
    return b


lay("card-act-1", F169, act1(), back=NIGHT)
lay("card-act-2", F169, act2(), back=NIGHT)
lay("card-act-3", F169, act3(), back=NIGHT)
# style: this game's title card at the act cards' cell size, and the Hut as batch 1 drew it
lay("style-act", (256, 144, 1360), [], back=SKY1, parts=[
    (v2("card-title"), (0, 0, 108, 144)), (v2("sky-hut"), (116, 4, 126, 136))])


# ---- D. sky pieces for acts 2 and 3, three on green ------------------------------------------
def sky_b2():
    b = [(64, 60, 128, 12, STEEL), (76, 34, 70, 26, CREAM), (76, 30, 70, 6, RED),           # the truck stop
         (150, 46, 20, 14, RED), (90, 72, 80, 6, DARK), (176, 14, 4, 46, DARK), (164, 12, 28, 20, ORANGE)]
    for x, y, w, h in ((56, 112, 14, 40), (98, 122, 10, 28), (132, 130, 8, 20), (160, 136, 6, 14)):
        b += [(x, y, w, h, STEEL), (x + 1, y - 4, w - 2, 4, ORANGE)]                         # mile markers, receding
    b += [(116, 190, 24, 44, STEEL), (110, 186, 8, 6, ORANGE), (138, 186, 8, 6, ORANGE),    # one large lane buoy
          (127, 178, 2, 10, DARK), (106, 224, 44, 10, DARK)]
    return b


lay("sky-b2", F11S, sky_b2(), back=G)


# ---- second passes ---------------------------------------------------------------------------
SNAP = os.path.join(base.T, "snap")


def from_snap(name, box=None):
    p = os.path.join(SNAP, name + ".png")
    if not os.path.exists(p):
        return None
    from PIL import Image
    im = Image.open(p).convert("RGBA")
    return im.crop(box) if box else im


def second_passes():
    """Canvases made from first pictures as they came back (tmp/voyagers2-art/snap), written to
    tmp/voyagers2-art/parts/b2/:
    - card-ending-lost-2: the lost ending whole, to be redrawn with the costume's head changed
      (it came back too close to a famous animatronic bear: no flight helmet, unlike this
      game's bear) and the costume closed over Rex's chest;
    - card-act-2-2: the second act card holds more than a 240 x 120 window (the sign at the top
      right, the rig at the bottom left): its content (x 0..252, y 2..136) squeezed into the
      window (8, 12, 240, 120) of the 256 x 144 canvas, the rest of the picture round it;
    - sky-b2-fix: the large buoy came back 63 x 92 for about 48 x 64: shrunk to 42 x 61, twice,
      on green."""
    from PIL import Image
    out = os.path.join(PARTS, "b2")
    os.makedirs(out, exist_ok=True)
    lost = from_snap("card-ending-lost-a")
    if lost:
        can = Image.new("RGBA", (259, 259), lost.getpixel((10, lost.height - 1)))
        can.paste(lost, (0, 0))
        can.save(os.path.join(out, "card-ending-lost-2.png"))
        lay("card-ending-lost-2", (259, 259, 1036), [], back=MUSTARD,
            parts=[(os.path.join(out, "card-ending-lost-2.png"), (0, 0, 0, 0))])
    act2 = from_snap("card-act-2-a")
    if act2:
        sx, sy = 240 / 252, 120 / 134
        w, h = round(act2.width * sx), round(act2.height * sy)
        sq = act2.resize((w, h), Image.NEAREST)
        can = Image.new("RGBA", (256, 144), act2.getpixel((60, 60)))
        can.paste(sq, (8, 12 - round(2 * sy)))
        can.save(os.path.join(out, "card-act-2-2.png"))
        lay("card-act-2-2", F169, [], back=NIGHT, parts=[(os.path.join(out, "card-act-2-2.png"), (0, 0, 0, 0))])
    buoy = from_snap("sky-b2-a", (0, 152, 256, 256))
    if buoy:
        import numpy as np
        a = np.array(buoy)
        ys, xs = np.nonzero(a[..., 3] >= 128)
        piece = buoy.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
        piece.save(os.path.join(out, "buoy-first.png"))
        lay("sky-b2-fix", F11S, [], back=G, parts=[(os.path.join(out, "buoy-first.png"), (60, 40, 42, 61)),
                                                   (os.path.join(out, "buoy-first.png"), (154, 140, 42, 61))])


second_passes()


if __name__ == "__main__":
    names = sys.argv[1:] or [n for n in L if n.startswith(("room-", "style-room", "cast-", "card-ending-", "style-ending",
                                                            "card-act-", "style-act", "sky-b2"))]
    for n in names:
        render(n)
