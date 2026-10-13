#!/usr/bin/env python3
"""Proof sheets for the eye: what is in public/galaga, enlarged in whole steps on the field's
night blue, with each file's name and size under it.

    ~/.cache/nova-art-venv/bin/python scripts/galaga-lab/art/proof.py [sheet ...]

writes scripts/galaga-lab/art/proof/<sheet>.png (kept in git: 64 colours, under about 300 KB).
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PUB = os.path.join(ROOT, "public", "galaga")
OUT = os.path.join(HERE, "proof")
BACK = (22, 28, 58)
INK = (170, 180, 210)

GANGS = ["glitterati", "hogs", "lovemachines", "chromons", "noise"]
ROLES = ["grunt", "flanker", "tank", "diver", "sniper", "splitter", "mite", "captor", "raider"]
PICKS = ["tube", "blaster", "disc", "boombox", "pizza", "bubble", "cb", "mirrorball",
         "tracking", "hairspray", "magnet", "quarter"]
PEOPLE = {"rex": ["cheerful", "eating", "worried", "sheepish"], "nova": ["calm", "smirk", "angry", "eyeroll"],
          "mei": ["calm", "excited"], "babs": ["purr", "wink", "alarm"], "marge": ["calm", "spooky"],
          "duckie": ["calm", "shout"], "barton": ["calm", "shout"], "ridley": ["calm", "grim"],
          "lena": ["calm", "stern"], "duo": ["grin", "sweat"], "knight": ["calm", "angry"],
          "humdinger": ["calm", "angry"], "durant": ["calm", "angry"], "cal": ["calm", "angry"],
          "fader": ["calm", "angry"]}

SHEETS = {
    "field": (4, [["ship-rex", "ship-rex-bank", "ship-nova", "ship-nova-bank", "valve-on", "valve-off"],
                  ["pick-" + p for p in PICKS]]),
    "gangs": (4, [[f"enemy-{g}-{r}" for r in ROLES] for g in GANGS]),
    "gangs-1x": (1, [[f"enemy-{g}-{r}" for r in ROLES] for g in GANGS] + [["ship-rex", "ship-nova"] + ["pick-" + p for p in PICKS]]),
    "bosses": (3, [["boss-knight", "boss-humdinger", "boss-durant"], ["boss-cal", "boss-fader"], ["boss-deafstar"]]),
    "friends": (3, [["rig-marge", "rig-duckie", "rig-barton", "stranded-babs", "stranded-ridley", "stranded-lena", "duo"]]),
    "portraits": (3, [[f"portrait-{p}-{m}" for p in ("rex", "nova", "mei") for m in PEOPLE[p]],
                      [f"portrait-{p}-{m}" for p in ("babs", "marge", "duckie", "barton") for m in PEOPLE[p]],
                      [f"portrait-{p}-{m}" for p in ("ridley", "lena", "duo") for m in PEOPLE[p]],
                      [f"portrait-{p}-{m}" for p in ("knight", "humdinger", "durant", "cal", "fader") for m in PEOPLE[p]]]),
    "console": (3, [["console-left", "console-right"], ["console-band"]]),
    "sky": (3, [[f"bg-{n}-{s}" for s in "ab"] for n in range(1, 6)]),
    "cards": (3, [["card-title", "card-ending"]]),
}


def sheet(name):
    scale, rows = SHEETS[name]
    font = ImageFont.load_default()
    pad, label = 10, 0 if scale == 1 else 24
    placed, y, width = [], pad, 0
    for row in rows:
        x, row_h = pad, 0
        for n in row:
            path = os.path.join(PUB, n + ".png")
            if not os.path.exists(path):
                continue
            im = Image.open(path).convert("RGBA")
            w, h = im.width * scale, im.height * scale
            cell_w = max(w, 0 if scale == 1 else 84)
            placed.append((im, n, x + (cell_w - w) // 2, y, w, h, x))
            x += cell_w + pad
            row_h = max(row_h, h)
        if row_h:
            for i, p in enumerate(placed):
                if p[3] == y and len(p) == 7:   # bottom-align the row
                    placed[i] = p[:3] + (y + row_h - p[5],) + p[4:] + (y + row_h,)
            width = max(width, x)
            y += row_h + label + pad
    if not placed:
        print(f"proof: {name}: nothing yet")
        return
    canvas = Image.new("RGBA", (width, y), BACK + (255,))
    d = ImageDraw.Draw(canvas)
    # a magenta-free checker would hide key leaks: the field's flat night blue shows them
    for p in placed:
        im, n, px, py, w, h, lx, base = p
        big = im.resize((w, h), Image.NEAREST)
        canvas.paste(big, (px, py), big)
        if label:
            short = n.replace("enemy-", "").replace("portrait-", "").replace("pick-", "")
            d.text((lx, base + 2), short, fill=INK, font=font)
            d.text((lx, base + 12), f"{im.width}x{im.height}", fill=INK, font=font)
    os.makedirs(OUT, exist_ok=True)
    out = os.path.join(OUT, name + ".png")
    rgb = canvas.convert("RGB")
    cols = rgb.getcolors(256)
    if cols is not None:      # 256 colours or fewer: the sheet shows exactly what ships
        import numpy as np
        a = np.array(rgb)
        key = (a[..., 0].astype(np.int32) << 16) | (a[..., 1].astype(np.int32) << 8) | a[..., 2]
        uniq, idx = np.unique(key, return_inverse=True)
        p = Image.fromarray(idx.reshape(key.shape).astype(np.uint8), "P")
        flat = [v for k in uniq for v in ((int(k) >> 16) & 255, (int(k) >> 8) & 255, int(k) & 255)]
        p.putpalette(flat + [0] * (768 - len(flat)))
        rgb = p
        note = f"exact colours ({len(uniq)})"
    else:
        rgb = rgb.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)
        note = "reduced to 256 colours"
    rgb.save(out, optimize=True)
    print(f"       {note}")
    print(f"proof: {os.path.relpath(out, ROOT)} {canvas.width}x{canvas.height} {os.path.getsize(out) // 1024} KB")


if __name__ == "__main__":
    for s in (sys.argv[1:] or list(SHEETS)):
        sheet(s)
