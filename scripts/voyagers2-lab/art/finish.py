#!/usr/bin/env python3
"""The last step but one of make.sh: from cut and snapped bitmaps (tmp/voyagers2-art) to what
ships in public/voyagers2/. Adapted from scripts/galaga-lab/art/finish.py.

- portraits: the tile portraits.py's SHIP names, staged (make.sh reduces each to 32 colours);
- card: the title card cut to 240 x 320 from its snapped picture, straight to public;
- sky: each piece's leftover key cleared, trimmed, darkened toward the night blue (`night`),
  staged (make.sh reduces them to one palette);
- sprites: of the copies the packed sheet holds of a thing, the one pick.json names (copy 0
  where it does not say), its leftover key cleared, magenta-cast outline pixels mended,
  trimmed, straight to public as an indexed PNG with one clear colour.

    ~/.cache/nova-art-venv/bin/python scripts/voyagers2-lab/art/finish.py [set ...]
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
T = os.path.join(ROOT, "tmp", "voyagers2-art")
S = os.path.join(T, "snap")
P = os.path.join(T, "parts")
STAGE = os.path.join(T, "stage")
OUT = os.path.join(ROOT, "public", "voyagers2")

sys.dont_write_bytecode = True  # no __pycache__ beside the scripts
sys.path.insert(0, HERE)
from reduce import save_indexed  # noqa: E402
import portraits as portrait_cut  # noqa: E402

SKY = ["sky-planet", "sky-galaxy", "sky-hut", "sky-moon", "sky-nebula", "sky-billboard"]
SPRITES = ["face-rat", "face-bear", "face-gorilla", "face-hound", "face-lion", "face-slice",
           "head-rat", "head-bear", "head-gorilla", "head-hound"]
# where a sprite's copies are (tmp/voyagers2-art/parts/<folder>/<thing>~<n>.png): the faces
# from the second packed sheet (laid smaller: 13 to 16 px, as asked), the heads from the first
# (18 to 20 x 26 to 27: at 16 x 22 the spring and the face turned to mush)
SPRITE_DIR = {n: "sprites-e" for n in ("face-rat", "face-bear", "face-gorilla", "face-hound", "face-lion", "face-slice")}
# the copies of the first packed sheet (sprites-d) chosen by eye: cleaned, they are the source
# of the second one's canvas (parts/sprites-best)
D_PICK = {"face-rat": 5, "face-bear": 1, "face-gorilla": 3, "face-hound": 3, "face-lion": 2, "face-slice": 0,
          "head-rat": 1, "head-bear": 1, "head-gorilla": 2, "head-hound": 3}


def picks_made():
    f = os.path.join(HERE, "pick.json")
    if os.path.exists(f):
        with open(f) as fh:
            return json.load(fh)
    return {}


def load(path):
    return np.array(Image.open(path).convert("RGBA"))


def clean_key(a, green=False):
    """Flat key colour that survived the cut: clear it. Only what is close to #ff00ff (or
    #00ff00): violet, purple, coral and moss are paint."""
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    if green:
        hit = (al >= 128) & (g > 170) & (r < 130) & (b < 130)
    else:
        hit = (al >= 128) & (r > 190) & (b > 190) & (g < 110) & (abs(r - b) < 60)
    a[hit] = 0
    return int(hit.sum())


def defringe(a, rounds=2, green=False):
    """An edge pixel with a key cast is the key showing through a dark outline: give it the
    darkest clean colour beside it."""
    n = 0
    for _ in range(rounds):
        solid = a[..., 3] >= 128
        h, w = solid.shape
        pad = np.pad(solid, 1)
        edge = solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        r, g, b = (a[..., i].astype(int) for i in range(3))
        if green:
            # nothing in the sky is green: any pixel clearly greener than both its red and its
            # blue is the key mixed into an outline, at the edge or one pixel in
            cast = solid & (g - np.maximum(r, b) > 18)
        else:
            cast = edge & (np.minimum(r, b) - g > 38) & (r > 80) & (b > 80)
        ys, xs = np.where(cast)
        if not len(ys):
            break
        new = a.copy()
        for y, x in zip(ys, xs):
            best = None
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if (dy or dx) and 0 <= ny < h and 0 <= nx < w and solid[ny, nx] and not cast[ny, nx]:
                        c = a[ny, nx, :3].astype(int)
                        lum = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
                        if best is None or lum < best[0]:
                            best = (lum, c)
            if best is None:
                new[y, x] = 0
            else:
                new[y, x, :3] = best[1]
            n += 1
        a = new
    return a, n


def trim(a):
    ys, xs = np.where(a[..., 3] >= 128)
    return a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def cut_out(src, green=False):
    """A cut sprite, cleaned and trimmed: (array, key pixels cleared, fringe pixels mended)."""
    a = load(src)
    k = clean_key(a, green)
    a, f = defringe(a, green=green)
    if not green:
        # a key-coloured pixel left inside the sprite (the model's slip, not an edge): it takes
        # the colour of the darkest clean pixel beside it
        r, g, b = (a[..., i].astype(int) for i in range(3))
        inside = (a[..., 3] >= 128) & (r > 150) & (b > 150) & (g < 100)
        for y, x in zip(*np.where(inside)):
            near = [a[yy, xx] for yy in range(max(0, y - 1), min(a.shape[0], y + 2))
                    for xx in range(max(0, x - 1), min(a.shape[1], x + 2))
                    if a[yy, xx, 3] >= 128 and not inside[yy, xx]]
            if near:
                a[y, x] = min(near, key=lambda c: int(c[0]) * 3 + int(c[1]) * 6 + int(c[2]))
                f += 1
    return trim(a), k, f


def sprite(src, name, log, out_dir=OUT):
    if not os.path.exists(src):
        log.append(f"MISSING {name}  ({os.path.relpath(src, ROOT)})")
        return
    a, k, f = cut_out(src)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, name + ".png")
    save_indexed(Image.fromarray(a, "RGBA"), out)
    log.append(f"{name:28} {a.shape[1]:4} x {a.shape[0]:<4} {os.path.getsize(out):6} bytes  key {k} fringe {f}"
               + ("  (staged)" if out_dir != OUT else ""))


def copies():
    """Every small sprite with copies: name -> (folder, thing)."""
    return {n: (SPRITE_DIR.get(n, "sprites-d"), n) for n in SPRITES}


def sprites(log):
    made, c = picks_made(), copies()
    for n in SPRITES:
        folder, thing = c[n]
        sprite(os.path.join(P, folder, f"{thing}~{made.get(n, 0)}.png"), n, log)
        sprite(os.path.join(P, "sprites-d", f"{n}~{D_PICK[n]}.png"), n, [], os.path.join(P, "sprites-best"))


def portraits(log):
    os.makedirs(STAGE, exist_ok=True)
    for name, tile in portrait_cut.SHIP.items():
        src = os.path.join(P, "portraits", tile + ".png")
        if not os.path.exists(src):
            log.append(f"MISSING {name}  ({os.path.relpath(src, ROOT)})")
            continue
        im = Image.open(src).convert("RGB")
        if im.size != (64, 64):
            log.append(f"WRONG SIZE {name}: {im.size}")
        im.save(os.path.join(STAGE, name + ".png"))
        log.append(f"{name:28}   64 x 64    (staged, from {tile})")


def opaque(src, name, log, size=None):
    if not os.path.exists(src):
        log.append(f"MISSING {name}  ({os.path.relpath(src, ROOT)})")
        return
    im = Image.open(src)
    if size and im.size != size:
        log.append(f"WRONG SIZE {name}: {im.size} not {size}")
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, name + ".png")
    if im.mode != "P":
        im = im.convert("RGB").quantize(colors=64, method=Image.MEDIANCUT, dither=Image.NONE)
    im.save(out, optimize=True)
    log.append(f"{name:28} {im.width:4} x {im.height:<4} {os.path.getsize(out):6} bytes")


# The title card: which snapped picture, the box taken from it (x, y, w, h), and how many rows
# it is moved down under a field of its own top colour (so the top quarter stays plain sky).
# card-title-b (243 x 329): the middle 240 columns, moved 10 rows down, so that rows 0 to 79
# are one flat sky (the carrier's chimney and Nova's hair reached row 70); the nose loses its
# lowest rows. PAINT: boxes (x, y, w, h, in the cropped picture before the move) painted
# over with the sky: a shard of the carrier's oven-door ramp left over from the collage,
# floating between the carrier and the tail fin.
CARD = ("card-title-b", None, 10)
PAINT = [(168, 114, 16, 11)]


def card(log):
    src_name, box, down = CARD
    src = os.path.join(S, src_name + ".png")
    if os.path.exists(src):
        im = Image.open(src).convert("RGB")
        if box is None:
            x0 = max(0, (im.width - 240) // 2)
            box = (x0, 0, 240, min(320, im.height))
        x, y, w, h = box
        part = im.crop((x, y, x + w, y + h))
        top = part.crop((0, 0, part.width, 1)).getcolors(part.width)
        fill = max(top)[1]
        for px, py, pw, ph in PAINT:
            part.paste(fill, (px, py, px + pw, py + ph))
        out = Image.new("RGB", (240, 320), fill)
        out.paste(part.crop((0, 0, 240, 320 - down)), (0, down))
        out.save(os.path.join(S, "card-title-final.png"))
    opaque(os.path.join(S, "card-title-final.png"), "card-title", log, (240, 320))


def night(a, k=0.30, base=(14, 18, 38)):
    """A backdrop piece must be darker than anything in the action and low in contrast: every
    colour is pulled toward the night blue (a remap, colour for colour: white becomes 90, 94,
    114; nothing becomes black). Same numbers as Space Voyagers I's sky."""
    rgb = a[..., :3].astype(float) * k + np.array(base, float)
    a[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return a


# How dark each piece is made: (k, base) for night(); None leaves it as drawn.
DARKEN = {}
GREEN_CUT = {"sky-planet", "sky-galaxy", "sky-hut", "sky-moon", "sky-nebula", "sky-billboard"}


def sky(log):
    os.makedirs(STAGE, exist_ok=True)
    for name in SKY:
        src = os.path.join(P, "sky", name + ".png")
        if not os.path.exists(src):
            log.append(f"MISSING {name}  ({os.path.relpath(src, ROOT)})")
            continue
        a, k, f = cut_out(src, green=name in GREEN_CUT)
        d = DARKEN.get(name, (0.34, (14, 18, 38)))
        if d:
            a = night(a, *d)
        out = os.path.join(STAGE, name + ".png")
        save_indexed(Image.fromarray(a, "RGBA"), out)
        log.append(f"{name:28} {a.shape[1]:4} x {a.shape[0]:<4} {os.path.getsize(out):6} bytes  key {k} fringe {f}  (staged)")


# ---- batch 2 ---------------------------------------------------------------------------------
# A picture that ships whole (a room, an ending, an act card) is a window of its snapped picture:
# (snapped picture, (x, y) of the window's upper left corner or None for the middle, boxes to
# paint flat). A box is (x, y, w, h) in the shipped picture; it takes the commonest colour
# inside it: the chalkboards and the television screen, so they are blank where code draws.
ROOMS = {
    "room-kitchen": ("room-kitchen-a", None, []),
    "room-hangar": ("room-hangar-a", None, []),
    "room-breakroom": ("room-breakroom-a", None, []),
}
ENDINGS = {
    # won: moved up from the middle (9, 27) so Tiny's goggles are whole; the counter's front
    # pizzas lose their lower rows
    "card-ending-won": ("card-ending-won-a", (9, 20), []),
    "card-ending-lost": ("card-ending-lost-b", None, []),
}
ACTS = {
    # act 1 (257 x 142): two rows from the top, so the Deep Dish's chimney is whole
    "card-act-1": ("card-act-1-a", (8, 2), []),
    # act 2 (258 x 142): the sign at the top right whole; the rig's wheels lose a few rows
    "card-act-2": ("card-act-2-b", (10, 4), []),
    # act 3 (251 x 138): the sign's top rows whole
    "card-act-3": ("card-act-3-a", (5, 5), []),
}


def whole(table, size, log):
    tw, th = size
    for name, (src_name, at, paint) in table.items():
        src = os.path.join(S, src_name + ".png")
        if not os.path.exists(src):
            log.append(f"MISSING {name}  ({os.path.relpath(src, ROOT)})")
            continue
        im = Image.open(src)
        if im.mode != "P":
            im = im.convert("RGB").quantize(colors=64, method=Image.MEDIANCUT, dither=Image.NONE)
        x, y = at if at else ((im.width - tw) // 2, (im.height - th) // 2)
        part = im.crop((x, y, x + tw, y + th))
        a = np.array(part)
        for px, py, pw, ph in paint:
            box = a[py:py + ph, px:px + pw]
            vals, counts = np.unique(box, return_counts=True)
            box[...] = vals[counts.argmax()]
        out = Image.fromarray(a, "P")
        out.putpalette(part.getpalette())
        dst = os.path.join(S, name + "-final.png")
        out.save(dst)
        opaque(dst, name, log, size)


def rooms(log):
    whole(ROOMS, (240, 180), log)


def endings(log):
    whole(ENDINGS, (240, 200), log)


def acts(log):
    whole(ACTS, (240, 120), log)


# The sky pieces of acts 2 and 3: three on one green picture (snap/sky-b2-a.png), each cut by
# the box it stands in (x, y, w, h in the snapped picture), so that the four mile markers,
# which stand apart, ship as one piece.
SKY2 = {
    "sky-truckstop": ("sky-b2-a", (0, 0, 256, 92)),
    "sky-markers": ("sky-b2-a", (0, 92, 256, 62)),
    "sky-buoy": ("sky-b2-fix", (0, 0, 140, 128)),
}


def sky2(log):
    os.makedirs(STAGE, exist_ok=True)
    for name, (src_name, (x, y, w, h)) in SKY2.items():
        src = os.path.join(S, src_name + ".png")
        if not os.path.exists(src):
            log.append(f"MISSING {name}  ({os.path.relpath(src, ROOT)})")
            continue
        a = load(src)[y:y + h, x:x + w].copy()
        k = clean_key(a, green=True)
        a, f = defringe(a, green=True)
        a = night(trim(a), 0.34, (14, 18, 38))
        out = os.path.join(STAGE, name + ".png")
        save_indexed(Image.fromarray(a, "RGBA"), out)
        log.append(f"{name:28} {a.shape[1]:4} x {a.shape[0]:<4} {os.path.getsize(out):6} bytes  key {k} fringe {f}  (staged)")


SETS = {"portraits": portraits, "card": card, "sky": sky, "sprites": sprites,
        "rooms": rooms, "endings": endings, "acts": acts, "sky2": sky2}


def main():
    log = []
    for s in (sys.argv[1:] or list(SETS)):
        SETS[s](log)
    print("\n".join(log))
    made = [l for l in log if not l.startswith(("MISSING", "WRONG", "    "))]
    print(f"{len(made)} bitmaps written, {sum(l.startswith(('MISSING', 'WRONG')) for l in log)} missing or wrong")


if __name__ == "__main__":
    sys.exit(main())
