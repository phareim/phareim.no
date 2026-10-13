#!/usr/bin/env python3
"""The last step of make.sh: from snapped bitmaps to what ships in public/outrun/.

- pixels still close to the cut-out colour (magenta) on an edge become clear;
- a band along the bottom of a backdrop that is not picture is cropped;
- the number plate is lettered NOVA 89 in a 3 x 5 face (the model's own lettering does not
  survive 28 pixels of width);
- the talk portraits are copied from Nova's Solo Rescue (~/github/nova/public/art);
- a contact sheet of everything goes to tmp/outrun-art/sheet.png, for the eye.

Every bitmap is written as an indexed PNG with one clear colour.
"""
import os
import shutil
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
T = os.path.join(ROOT, "tmp", "outrun-art")
S = os.path.join(T, "snap")
P = os.path.join(T, "parts")
OUT = os.path.join(ROOT, "public", "outrun")
NOVA = os.path.expanduser("~/github/nova/public/art")

FONT = {
    "N": ["1001", "1101", "1011", "1001", "1001"], "O": ["111", "101", "101", "101", "111"],
    "V": ["101", "101", "101", "101", "010"], "A": ["111", "101", "111", "101", "101"],
    "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
    " ": ["0", "0", "0", "0", "0"],
}


def load(path):
    return Image.open(path).convert("RGBA")


def clean_key(im):
    """Magenta that survived the cut: clear it."""
    px = im.load()
    n = 0
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and r - g > 80 and b - g > 80 and abs(r - b) < 90:
                px[x, y] = (0, 0, 0, 0)
                n += 1
    return n


def trim(im):
    box = im.getbbox()
    return im.crop(box) if box else im


def save(im, name, colors=64):
    """Indexed, one clear entry; the fewest colours that hold the picture."""
    os.makedirs(OUT, exist_ok=True)
    alpha = im.getchannel("A")
    rgb = im.convert("RGB")
    rgbs = list(rgb.get_flattened_data())
    alphas = list(alpha.get_flattened_data())
    pal = sorted(set(p for p, a in zip(rgbs, alphas) if a))
    q = rgb.quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE) if len(pal) > colors else None
    out = Image.new("P", im.size, 0)
    if q is None:
        index = {c: i + 1 for i, c in enumerate(pal)}
        out.putdata([index[p] if a else 0 for p, a in zip(rgbs, alphas)])
        flat = [255, 0, 255] + [v for c in pal for v in c]
    else:
        out.putdata([p + 1 if a else 0 for p, a in zip(q.get_flattened_data(), alphas)])
        flat = [255, 0, 255] + q.getpalette()[: 3 * colors]
    out.putpalette(flat + [0] * (768 - len(flat)))
    path = os.path.join(OUT, name + ".png")
    out.save(path, transparency=0, optimize=True)
    return os.path.getsize(path)


def find_plate(im):
    """The plate is the one block of plate-yellow in the lowest third: the columns and rows
    there that hold several such pixels (the tail lamps higher up are left out)."""
    px = im.load()
    y_from = int(im.height * 0.7)

    def yellow(x, y):
        r, g, b, a = px[x, y]
        return a and r > 200 and 120 < g < 215 and b < 90
    cols = [x for x in range(im.width) if sum(yellow(x, y) for y in range(y_from, im.height)) >= 2]
    # the longest run of such columns (its own lettering leaves gaps of a column or two)
    best, run = [], []
    for x in cols:
        run = run + [x] if run and x - run[-1] <= 3 else [x]
        if len(run) > len(best):
            best = run
    x0, x1 = best[0], best[-1]
    rows = [y for y in range(y_from, im.height) if sum(yellow(x, y) for x in range(x0, x1 + 1)) >= 4]
    return x0, rows[0], x1 - x0 + 1, rows[-1] - rows[0] + 1


def plate(im, ink=(26, 30, 74), paper=(240, 176, 40), edge=(150, 96, 24)):
    """Letter the plate NOVA 89 over the model's own attempt."""
    x0, y0, w, h = find_plate(im)
    px = im.load()
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            rim = x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1)
            px[x, y] = (edge if rim else paper) + (255,)
    text = "NOVA 89"
    width = sum(len(FONT[c][0]) + 1 for c in text) - 1
    cx = x0 + (w - width) // 2
    cy = y0 + (h - 5) // 2
    for c in text:
        g = FONT[c]
        for j, row in enumerate(g):
            for i, bit in enumerate(row):
                if bit == "1":
                    px[cx + i, cy + j] = ink + (255,)
        cx += len(g[0]) + 1


# name -> (source, plate box or None)
CARS = {"car": None, "car-left": None, "car-right": None}
PARTS = {
    "traffic": ["cab", "truck", "bug", "wagon"],
    "nature": ["maple", "pine", "snowpine", "pole", "lamp", "bush", "rock", "snowrock", "deer"],
    "country": ["barn", "diner", "cabin", "lighthouse", "motel"],
    "city": ["billboard", "payphone", "gas", "decker", "mill", "screen"],
    "clouds": ["cloud-1", "cloud-2", "cloud-3", "cloud-4", "cloud-5", "cloud-6"],
}
BANDS = {"skyline": 150, "mountains": 100, "hills": 60}   # rows kept from the top
CARD = (11, 8, 384, 216)                                  # the frame cut from the card as it came back (406 x 227)


def main():
    made = []
    for name in CARS:
        im = load(os.path.join(S, name + ".png"))
        clean_key(im)
        plate(im)
        im = trim(im)
        made.append((name, im, save(im, name, 48)))
    for folder, names in PARTS.items():
        for n in names:
            src = os.path.join(P, folder, n + ".png")
            if not os.path.exists(src):
                print(f"finish: {folder}/{n} is missing")
                continue
            im = load(src)
            clean_key(im)
            im = trim(im)
            made.append((n, im, save(im, n, 12 if folder == "clouds" else 48)))
    for name, rows in BANDS.items():
        im = load(os.path.join(S, name + ".png"))
        clean_key(im)
        im = im.crop((0, 0, im.width, min(rows, im.height)))
        made.append((name, im, save(im, name, 48)))
    card = load(os.path.join(S, "card-goal.png"))
    card = card.crop((CARD[0], CARD[1], CARD[0] + CARD[2], CARD[1] + CARD[3]))
    made.append(("card-goal", card, save(card, "card-goal", 64)))
    for src, name in PORTRAITS:
        dst = os.path.join(OUT, name + ".png")
        shutil.copyfile(os.path.join(NOVA, src), dst)
        made.append((name, load(dst), os.path.getsize(dst)))

    total = sum(b for _, _, b in made)
    for name, im, b in made:
        print(f"{name:16} {im.width:4} x {im.height:<4} {b:6} bytes")
    print(f"{len(made)} bitmaps, {total} bytes")
    sheet(made)


PORTRAITS = [(f"nova/portrait-{m}.png", f"nova-{m}") for m in
             ("calm", "smirk", "angry", "surprised", "shout", "wince", "laugh", "eyeroll", "set")] + \
            [(f"stoodup/portrait-rex-{m}.png", f"rex-{m}") for m in ("cheerful", "eating", "sheepish", "worried")]


def sheet(made):
    """Everything on one dark sheet at 2x, in rows, with nothing resampled but by whole numbers."""
    k, pad, width = 2, 8, 1500
    x = y = pad
    row = 0
    spots = []
    for name, im, _ in made:
        w, h = im.width * k, im.height * k
        if x + w + pad > width:
            x, y, row = pad, y + row + pad, 0
        spots.append((im, x, y, w, h))
        x += w + pad
        row = max(row, h)
    canvas = Image.new("RGBA", (width, y + row + pad), (30, 36, 64, 255))
    for im, x, y, w, h in spots:
        big = im.resize((w, h), Image.NEAREST)
        canvas.paste(big, (x, y), big)
    canvas.convert("RGB").save(os.path.join(T, "sheet.png"))
    print("sheet: tmp/outrun-art/sheet.png", canvas.size)


if __name__ == "__main__":
    sys.exit(main())
