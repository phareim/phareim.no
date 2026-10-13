#!/usr/bin/env python3
"""The last step but one of make.sh: from cut and snapped bitmaps (tmp/galaga-art) to what
ships in public/galaga/.

- of the copies a packed sheet holds of a thing, one is taken (pick.json, written by
  choose.py from the gate's verdicts; copy 0 where it does not say);
- pixels still close to the cut-out colour (flat magenta) become clear; outline pixels with a
  magenta cast (the key bleeding into a dark edge) take the colour of the outline beside them;
- everything is trimmed and written as an indexed PNG with one clear colour;
- small things (ships, pick-ups, valves, enemies), portraits, console and cards go straight
  to public/galaga; figures (bosses, rigs, stranded ships) and sky pieces go to
  tmp/galaga-art/stage, from where make.sh reduces them once with nova's `palette` (32 colours
  a figure; one palette of 24 for the sky) and copies them over;
- Rex's, Nova's and Mei's portraits are copied unchanged from Nova's Solo Rescue;
- the console panels get their windows squared and measured (windows.py).

    ~/.cache/nova-art-venv/bin/python scripts/galaga-lab/art/finish.py [set ...]
"""
import json
import os
import shutil
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
T = os.path.join(ROOT, "tmp", "galaga-art")
S = os.path.join(T, "snap")
P = os.path.join(T, "parts")
STAGE = os.path.join(T, "stage")
OUT = os.path.join(ROOT, "public", "galaga")
NOVA = os.path.expanduser("~/github/nova/public/art")

sys.dont_write_bytecode = True  # no __pycache__ beside the scripts
sys.path.insert(0, HERE)
from reduce import save_indexed  # noqa: E402

GANGS = ["glitterati", "hogs", "lovemachines", "chromons", "noise"]
ROLES = ["grunt", "flanker", "tank", "diver", "sniper", "splitter", "mite", "captor", "raider"]
PICKS = ["tube", "blaster", "disc", "boombox", "pizza", "bubble", "cb", "mirrorball",
         "tracking", "hairspray", "magnet", "quarter"]
BOSSES = ["boss-knight", "boss-fader", "boss-humdinger", "boss-cal", "boss-deafstar", "boss-durant"]
FRIENDS = ["rig-marge", "rig-duckie", "rig-barton", "stranded-babs", "stranded-ridley", "stranded-lena", "duo"]
SKY = [f"bg-{n}-{s}" for n in range(1, 6) for s in "ab"]

# Where a gang's cut sprites are (tmp/galaga-art/parts/…): the folder of its packed sheet,
# and of the sheet a role was ordered again on.
GANG_DIR = {"glitterati": "glitterati-d", ("hogs", "sniper"): "hogs-fix", ("glitterati", "mite"): "picks-f"}
AGAIN = ("cb", "quarter", "tracking")     # pick-ups taken from the sheet they were ordered again on


def copies():
    """Every small sprite that has copies: name -> (folder, thing)."""
    c = {n: ("ships-d", n) for n in ("ship-rex", "ship-nova", "ship-rex-bank", "ship-nova-bank")}
    c.update({"pick-" + n: ("picks-f" if n in AGAIN else "picks-e", "pick-" + n) for n in PICKS})
    c.update({n: ("valves-e", n) for n in ("valve-on", "valve-off")})
    for g in GANGS:
        for r in ROLES:
            c[f"enemy-{g}-{r}"] = (GANG_DIR.get((g, r)) or GANG_DIR.get(g) or g + "-d2", r)
    return c


def picks_made():
    f = os.path.join(HERE, "pick.json")
    if os.path.exists(f):
        with open(f) as fh:
            return json.load(fh)
    return {}


def load(path):
    return np.array(Image.open(path).convert("RGBA"))


def clean_key(a):
    """Flat magenta that survived the cut: clear it. Only what is close to #ff00ff: violet,
    purple and coral are paint."""
    r, g, b, al = (a[..., i].astype(int) for i in range(4))
    hit = (al >= 128) & (r > 190) & (b > 190) & (g < 110) & (abs(r - b) < 60)
    a[hit] = 0
    return int(hit.sum())


def defringe(a, rounds=2):
    """An edge pixel with a magenta cast is the key showing through a dark outline: give it
    the darkest clean colour beside it."""
    n = 0
    for _ in range(rounds):
        solid = a[..., 3] >= 128
        h, w = solid.shape
        pad = np.pad(solid, 1)
        edge = solid & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
        r, g, b = (a[..., i].astype(int) for i in range(3))
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


def cut_out(src):
    """A cut sprite, cleaned and trimmed: (array, key pixels cleared, fringe pixels mended)."""
    a = load(src)
    k = clean_key(a)
    a, f = defringe(a)
    # a key-coloured pixel left inside the sprite (the model's own slip, not an edge): it
    # takes the colour of the darkest clean pixel beside it
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


def small(names, log):
    made, c = picks_made(), copies()
    for n in names:
        folder, thing = c[n]
        sprite(os.path.join(P, folder, f"{thing}~{made.get(n, 0)}.png"), n, log)


def ships(log):
    small(["ship-rex", "ship-nova", "ship-rex-bank", "ship-nova-bank"], log)


def picks(log):
    small(["pick-" + n for n in PICKS] + ["valve-on", "valve-off"], log)
    # the two valves are one valve lit and unlit: the game swaps one for the other, so both
    # go on one canvas of the same size, standing on its bottom edge, centred
    both = [load(os.path.join(OUT, n + ".png")) for n in ("valve-on", "valve-off")]
    w, h = max(a.shape[1] for a in both), max(a.shape[0] for a in both)
    for n, a in zip(("valve-on", "valve-off"), both):
        c = np.zeros((h, w, 4), np.uint8)
        x = (w - a.shape[1]) // 2
        c[h - a.shape[0]:, x:x + a.shape[1]] = a
        save_indexed(Image.fromarray(c, "RGBA"), os.path.join(OUT, n + ".png"))
    log.append(f"valve-on, valve-off             on one canvas of {w} x {h}")


def cab_rows(a):
    """Where a rig's cab ends: the first row from 30 down with six solid pixels or fewer
    (the coupling bar)."""
    per = (a[..., 3] >= 128).sum(axis=1)
    return next(i for i in range(30, 70) if per[i] <= 6)


def fit_cab(a, rows=40):
    """The game shows a rig's top 40 rows as the cab alone. A cab that came back a row or two
    longer loses the row that is most like the one under it (in a plain stretch of its roof),
    so that nothing drawn is lost."""
    cut = 0
    while cab_rows(a) > rows:
        end = cab_rows(a)
        diff = [(int((a[y] != a[y + 1]).any(axis=1).sum()), abs(y - end // 2), y) for y in range(6, end - 6)]
        y = min(diff)[2]
        a = np.delete(a, y, axis=0)
        cut += 1
    return a, cut


def gangs(log):
    small([f"enemy-{g}-{r}" for g in GANGS for r in ROLES], log)


def bosses(log):
    for n in BOSSES:
        sprite(os.path.join(P, "bosses", n + ".png"), n, log, STAGE)


def friends(log):
    for n in FRIENDS:
        sprite(os.path.join(P, "friends", n + ".png"), n, log, STAGE)
        if n.startswith("rig-") and os.path.exists(os.path.join(STAGE, n + ".png")):
            a, cut = fit_cab(load(os.path.join(STAGE, n + ".png")))
            save_indexed(Image.fromarray(a, "RGBA"), os.path.join(STAGE, n + ".png"))
            log.append(f"    {n}: cab is rows 0..{cab_rows(a) - 1} ({cut} row taken out), {a.shape[1]} x {a.shape[0]}")


PORTRAITS = [(f"stoodup/portrait-rex-{m}.png", f"portrait-rex-{m}") for m in ("cheerful", "eating", "worried", "sheepish")] + \
            [(f"nova/portrait-{m}.png", f"portrait-nova-{m}") for m in ("calm", "smirk", "angry", "eyeroll")] + \
            [(f"stoodup/portrait-mei-{m}.png", f"portrait-mei-{m}") for m in ("calm", "excited")]
NEW_PORTRAITS = ["babs-purr", "babs-wink", "babs-alarm", "marge-calm", "marge-spooky", "duckie-calm", "duckie-shout",
                 "barton-calm", "barton-shout", "ridley-calm", "ridley-grim", "lena-calm", "lena-stern", "duo-grin",
                 "duo-sweat"] + [f"{b}-{m}" for b in ("knight", "humdinger", "durant", "cal", "fader") for m in ("calm", "angry")]


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


def portraits(log):
    os.makedirs(OUT, exist_ok=True)
    for src, name in PORTRAITS:
        dst = os.path.join(OUT, name + ".png")
        shutil.copyfile(os.path.join(NOVA, src), dst)
        w, h = Image.open(dst).size
        log.append(f"{name:28} {w:4} x {h:<4} {os.path.getsize(dst):6} bytes  (copied)")
    os.makedirs(STAGE, exist_ok=True)
    for n in NEW_PORTRAITS:     # staged: make.sh reduces each to 32 colours and copies it over
        src = os.path.join(P, "portraits", f"portrait-{n}.png")
        if not os.path.exists(src):
            log.append(f"MISSING portrait-{n}  ({os.path.relpath(src, ROOT)})")
            continue
        im = Image.open(src).convert("RGB")
        if im.size != (64, 64):
            log.append(f"WRONG SIZE portrait-{n}: {im.size}")
        im.save(os.path.join(STAGE, f"portrait-{n}.png"))
        log.append(f"{'portrait-' + n:28}   64 x 64    (staged)")


def console(log):
    import windows
    windows.build(log)


def night(a, k=0.30, base=(14, 18, 38)):
    """A backdrop piece must be darker than anything in the field and low in contrast: every
    colour is pulled toward the field's night blue (a remap of the palette, colour for
    colour: white becomes 90, 94, 114; nothing becomes black)."""
    rgb = a[..., :3].astype(float) * k + np.array(base, float)
    a[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return a


def sky(log):
    os.makedirs(STAGE, exist_ok=True)
    for name in SKY:
        n = int(name[3])
        src = os.path.join(P, "sky", name + ".png")
        if not os.path.exists(src):
            log.append(f"MISSING {name}  ({os.path.relpath(src, ROOT)})")
            continue
        a = load(src)
        r, g, b = (a[..., i].astype(int) for i in range(3))
        if n in (3, 5):     # cut from green: clear what is left of it
            a[(g > 170) & (r < 130) & (b < 130)] = 0
        else:
            clean_key(a)
            a, _ = defringe(a)
        a = night(trim(a))
        out = os.path.join(STAGE, name + ".png")
        save_indexed(Image.fromarray(a, "RGBA"), out)
        log.append(f"{name:28} {a.shape[1]:4} x {a.shape[0]:<4} {os.path.getsize(out):6} bytes  (staged)")


# The cover came back with the two rockets in its upper third, where the game letters the
# title: the picture is moved 64 rows down under a field of its own top colour (nova's `stack
# --fill top:`), which leaves rows 0 to 75 plain sky, and ends at the heroes' waists.
TITLE_DOWN = 64
# The ending is the middle of a square of 256: columns 8 to 247, rows 4 to 203 (the cracked
# moon is whole; the feet are cut).
ENDING_BOX = (8, 4, 240, 200)


def cards(log):
    src = os.path.join(S, "card-title-a.png")
    if os.path.exists(src):
        im = Image.open(src).convert("RGB")
        # the model drew it in cells of 3.48 px, not the canvas's 3.67: 253 x 342, of which the
        # middle 240 columns are taken
        x0 = (im.width - 240) // 2
        top = im.crop((0, 0, im.width, 1)).getcolors(im.width)
        fill = max(top)[1]
        card = Image.new("RGB", (240, 320), fill)
        card.paste(im.crop((x0, 0, x0 + 240, 320 - TITLE_DOWN)), (0, TITLE_DOWN))
        card.save(os.path.join(S, "card-title-final.png"))
    src = os.path.join(S, "card-ending-a.png")
    if os.path.exists(src):
        x, y, w, h = ENDING_BOX
        Image.open(src).convert("RGB").crop((x, y, x + w, y + h)).save(os.path.join(S, "card-ending-final.png"))
    opaque(os.path.join(S, "card-title-final.png"), "card-title", log, (240, 320))
    opaque(os.path.join(S, "card-ending-final.png"), "card-ending", log, (240, 200))


SETS = {"ships": ships, "picks": picks, "gangs": gangs, "bosses": bosses, "friends": friends,
        "portraits": portraits, "console": console, "sky": sky, "cards": cards}


def main():
    log = []
    for s in (sys.argv[1:] or list(SETS)):
        SETS[s](log)
    print("\n".join(log))
    made = [l for l in log if not l.startswith(("MISSING", "WRONG", "    "))]
    print(f"{len(made)} bitmaps written, {sum(l.startswith(('MISSING', 'WRONG')) for l in log)} missing or wrong")


if __name__ == "__main__":
    sys.exit(main())
