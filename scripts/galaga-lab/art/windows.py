#!/usr/bin/env python3
"""The console's windows: found, squared, measured.

A console panel is ordered full-bleed with flat magenta rectangles where the game draws live
things. After `snap --key magenta` those are clear holes. This file

- finds the holes of a snapped panel (`holes`): connected clear regions, largest first;
- builds the canvas of a panel's second pass (`second`): the first picture, which the model
  enlarged to fill its frame, scaled back with nearest neighbour so that its windows are
  about the size asked, with every window painted over as an exact rectangle in a bezel;
- finishes a panel (`build`, called by finish.py): cuts the game's bitmap out of the snapped
  second pass, makes every window an exact rectangle of the size asked (centred on the hole
  that came back; a hole pixel outside it takes the colour beside it), and writes the boxes
  to windows.json and a table for the README.

    ~/.cache/nova-art-venv/bin/python scripts/galaga-lab/art/windows.py second   # the canvases
    ~/.cache/nova-art-venv/bin/python scripts/galaga-lab/art/windows.py build    # as finish.py does
"""
import json
import os
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
T = os.path.join(ROOT, "tmp", "galaga-art")
S = os.path.join(T, "snap")
OUT = os.path.join(ROOT, "public", "galaga")
sys.dont_write_bytecode = True  # no __pycache__ beside the scripts
sys.path.insert(0, HERE)
import layouts  # noqa: E402

BEZEL = (58, 42, 36)
KEY = (255, 0, 255)

# The second pass of each panel: how much the first picture is scaled (it came back with the
# panel enlarged to fill the frame), where its top left corner lands in the game's bitmap,
# and where each window is painted: None = centred where the first picture's window landed.
SECOND = {
    "console-left": {"first": "console-left-a", "across": 256, "scale": 0.78, "at": (0, 0), "fill": (138, 90, 48),
                     "order": ["portrait", "name", "channel", "caption"], "place": {}},
    "console-right": {"first": "console-right-a", "across": 256, "scale": 0.9, "at": (-15, 0), "fill": (106, 112, 128),
                      "order": ["score", "valves", "weapon", "lamps", "chart"], "place": {}},
    "console-band": {"first": "console-band-a", "across": 340, "scale": 0.706, "at": (0, -12), "fill": (106, 112, 128),
                     "order": ["portrait", "caption", "score", "valves", "weapon", "duet"],
                     "place": dict(layouts.WINDOWS["console-band"])},
}


def keyed(path):
    """A panel snapped with `--key none`, its flat magenta made clear here. (snap takes the
    colour of a picture's border for the key when that is anywhere near the key asked for; a
    full-bleed panel's border is wood, and it cut the wood.)"""
    a = np.array(Image.open(path).convert("RGBA"))
    r, g, b = (a[..., i].astype(int) for i in range(3))
    a[(r > 185) & (b > 185) & (g < 120) & (abs(r - b) < 70)] = 0
    return a


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
                    for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n
                            stack.append((ny, nx))
    return lab, n


def holes(rgba, min_area=40):
    """Clear regions as (x, y, w, h, area, mask), in reading order by rows."""
    clear = rgba[..., 3] < 128
    lab, n = label(clear)
    out = []
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() < min_area:
            continue
        ys, xs = np.where(m)
        out.append((int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1), int(m.sum()), m))
    return out


def by_name(found, name, spec_or_order):
    """Give each hole the name of the window of the layout nearest to it (in order of size,
    so a small stray hole cannot take a window's name)."""
    spec = layouts.WINDOWS[name]
    named, free = {}, list(found)
    return named, free, spec


def match(found, targets):
    """targets: name -> (cx, cy) expected centres. Greedy by distance."""
    named = {}
    pairs = sorted(((abs(f[0] + f[2] / 2 - c[0]) + abs(f[1] + f[3] / 2 - c[1]), n, i)
                    for i, f in enumerate(found) for n, c in targets.items()))
    used = set()
    for _, n, i in pairs:
        if n in named or i in used:
            continue
        named[n] = found[i]
        used.add(i)
    return named


def second(names=None):
    """Canvases for the second pass: tmp/galaga-art/ref/<panel>-2.png and the windows as
    painted, tmp/galaga-art/<panel>-2.json (in the game bitmap's pixels)."""
    for name in (names or SECOND):
        cfg = SECOND[name]
        fmt = layouts.F169S if name == "console-band" else layouts.F916
        cw, ch, pw = fmt
        ox, oy, bw, bh = layouts.CROP[name]
        first = Image.fromarray(keyed(os.path.join(S, cfg["first"] + ".png")), "RGBA")
        k = cfg["scale"]
        sw, sh = round(first.width * k), round(first.height * k)
        small = first.resize((sw, sh), Image.NEAREST)
        canvas = Image.new("RGB", (cw, ch), cfg["fill"])
        px, py = ox + cfg["at"][0], oy + cfg["at"][1]
        a = small.getchannel("A").point(lambda v: 255 if v >= 128 else 0)
        if name == "console-band":
            # The band asked for is squatter than the picture that came back, and its frames
            # cannot all be kept where they are: so only the picture's plain wood and plain
            # steel are used, as strips repeated behind the windows, with its chrome trim
            # between them and its knob at the right. The frames are drawn again.
            f = first.convert("RGB")
            wood, steel = f.crop((0, 3, f.width, 21)), f.crop((14, 150, f.width - 14, 176))
            trim, knob = f.crop((0, 95, f.width, 101)), f.crop((290, 110, 326, 146))
            split = oy + 52
            for y in range(0, split, wood.height):
                canvas.paste(wood, (0, y))
            for y in range(split, ch, steel.height):
                for x in range(0, cw, steel.width):
                    canvas.paste(steel, (x, y))
            canvas.paste(trim, (0, split - 3))
            canvas.paste(knob.resize((22, 22), Image.NEAREST), (ox + 213, oy + 62))
        else:
            canvas.paste(small.convert("RGB"), (px, py), a)
        # where the first picture's windows landed, in the game bitmap's pixels
        found = holes(np.array(small))
        found = [(x + cfg["at"][0], y + cfg["at"][1], w, h, ar, None) for x, y, w, h, ar, _ in found]
        spec = layouts.WINDOWS[name]
        # match by reading order of the largest holes
        big = sorted(found, key=lambda f: -f[4])[:len(spec)]
        if name == "console-band":
            centres = {n: (x + w / 2, y + h / 2) for n, (x, y, w, h) in spec.items()}
        else:
            # same order top to bottom as the layout; the weapon dial sits left of the VU face
            ordered = sorted(big, key=lambda f: (f[1] + f[3] / 2))
            centres = {n: (f[0] + f[2] / 2, f[1] + f[3] / 2) for n, f in zip(cfg["order"], ordered)}
        painted = {}
        d = canvas.load()
        for n in cfg["order"]:
            w, h = spec[n][2], spec[n][3]
            if cfg["place"].get(n):
                x, y = cfg["place"][n][0], cfg["place"][n][1]
            else:
                cx, cy = centres[n]
                x, y = round(cx - w / 2), round(cy - h / 2)
            x, y = max(4, min(bw - w - 4, x)), max(4, y)
            painted[n] = (x, y, w, h)
            for yy in range(oy + y - 3, oy + y + h + 3):
                for xx in range(ox + x - 3, ox + x + w + 3):
                    if 0 <= xx < cw and 0 <= yy < ch:
                        inside = ox + x <= xx < ox + x + w and oy + y <= yy < oy + y + h
                        d[xx, yy] = KEY if inside else BEZEL
        ph = round(pw * ch / cw)
        out = os.path.join(T, "ref", name + "-2.png")
        canvas.resize((pw, ph), Image.NEAREST).save(out)
        with open(os.path.join(T, name + "-2.json"), "w") as f:
            json.dump(painted, f, indent=1)
        print(f"second: {os.path.relpath(out, ROOT)}  first picture {first.width}x{first.height} -> {sw}x{sh} at {cfg['at']}")
        for n, r in painted.items():
            print(f"        {n:9} painted at {r}")


# What came back, looked at: the band's windows sit 8 rows higher than they were painted, so
# its bitmap is cut 8 rows higher. Under the left panel (from row 360) and the right one
# (from row 414) the canvas was flat fill: plain wood and plain steel from the band's picture
# are laid there, (snapped picture, box x, y, w, h).
CUT = {"console-band": (50, 40, 240, 96)}
BASE = {"console-left": (360, ("console-band-b", (24, 3, 100, 36))),
        "console-right": (414, ("console-band-b", (60, 150, 200, 24)))}


def square(a, name, log, shift=(0, 0)):
    """Make every window of a cut panel an exact rectangle of the size asked."""
    spec = layouts.WINDOWS[name]
    with open(os.path.join(T, name + "-2.json")) as f:
        painted = json.load(f)
    found = holes(a)
    named = match(found, {n: (r[0] + r[2] / 2 - shift[0], r[1] + r[3] / 2 - shift[1]) for n, r in painted.items()})
    boxes = {}
    clear = a[..., 3] < 128
    for n in spec:
        if n not in named:
            log.append(f"WRONG {name}: window {n} did not come back")
            continue
        x, y, w, h, area, m = named[n]
        tw, th = spec[n][2], spec[n][3]
        nx, ny = round(x + w / 2 - tw / 2), round(y + h / 2 - th / 2)
        nx, ny = max(0, min(a.shape[1] - tw, nx)), max(0, min(a.shape[0] - th, ny))
        boxes[n] = {"x": nx, "y": ny, "w": tw, "h": th, "came_back": [x, y, w, h], "clean": bool(area == w * h)}
        # hole pixels outside the box take the colour beside them
        out = m.copy()
        out[ny:ny + th, nx:nx + tw] = False
        todo = list(zip(*np.where(out)))
        for _ in range(12):
            if not todo:
                break
            rest = []
            for yy, xx in todo:
                done = False
                for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                    py, px = yy + dy, xx + dx
                    if 0 <= py < a.shape[0] and 0 <= px < a.shape[1] and a[py, px, 3] >= 128 and not (ny <= py < ny + th and nx <= px < nx + tw):
                        a[yy, xx] = a[py, px]
                        done = True
                        break
                if not done:
                    rest.append((yy, xx))
            todo = rest
        a[ny:ny + th, nx:nx + tw] = 0
        # the key bleeds into the frame's inner edge: a pixel with a magenta cast within
        # three of the window takes the colour of the first clean pixel further out
        H, W = a.shape[:2]

        def cast(py, px):
            r, g, b = (int(v) for v in a[py, px, :3])
            return a[py, px, 3] >= 128 and min(r, b) - g > 28 and r > 55 and b > 55

        for yy in range(max(0, ny - 7), min(H, ny + th + 7)):
            for xx in range(max(0, nx - 7), min(W, nx + tw + 7)):
                if ny <= yy < ny + th and nx <= xx < nx + tw:
                    continue
                if not cast(yy, xx):
                    continue
                dx = -1 if xx < nx else (1 if xx >= nx + tw else 0)
                dy = -1 if yy < ny else (1 if yy >= ny + th else 0)
                for step in range(1, 9):
                    py, px = yy + dy * step, xx + dx * step
                    if 0 <= py < H and 0 <= px < W and a[py, px, 3] >= 128 and not cast(py, px):
                        a[yy, xx] = a[py, px]
                        break
    # any other clear pixel is a leak: fill it from its neighbours
    keep = np.zeros(a.shape[:2], bool)
    for b in boxes.values():
        keep[b["y"]:b["y"] + b["h"], b["x"]:b["x"] + b["w"]] = True
    leak = (a[..., 3] < 128) & ~keep
    for _ in range(40):
        ys, xs = np.where(leak)
        if not len(ys):
            break
        for yy, xx in zip(ys, xs):
            for dy, dx in ((0, -1), (0, 1), (-1, 0), (1, 0)):
                py, px = yy + dy, xx + dx
                if 0 <= py < a.shape[0] and 0 <= px < a.shape[1] and a[py, px, 3] >= 128:
                    a[yy, xx] = a[py, px]
                    break
        leak = (a[..., 3] < 128) & ~keep
    return boxes


def vu_face(a, around):
    """The VU meter's cream face on the right panel: the box of light cream pixels round the
    place it was laid."""
    x, y, w, h = around
    r, g, b = (a[..., i].astype(int) for i in range(3))
    cream = (r > 185) & (g > 165) & (b > 110) & (b < 215) & (r - b > 20) & (a[..., 3] >= 128)
    lab, n = label(cream)
    best = None
    for i in range(1, n + 1):
        m = lab == i
        ys, xs = np.where(m)
        cx, cy = xs.mean(), ys.mean()
        if abs(cx - (x + w / 2)) < 40 and abs(cy - (y + h / 2)) < 40 and (best is None or m.sum() > best[0]):
            best = (int(m.sum()), int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1))
    return best


def build(log):
    from reduce import save_indexed
    result = {}
    for name in SECOND:
        src = os.path.join(S, name + "-b.png")
        if not os.path.exists(src):
            log.append(f"MISSING {name}  ({os.path.relpath(src, ROOT)})")
            continue
        ox, oy, bw, bh = CUT.get(name) or layouts.CROP[name]
        full = keyed(src)
        a = np.zeros((bh, bw, 4), np.uint8)
        part = full[oy:oy + bh, ox:ox + bw]
        a[:part.shape[0], :part.shape[1]] = part
        if part.shape[0] < bh:      # the canvas ended a few rows early: carry the last row down
            a[part.shape[0]:] = part[-1]
        if name in BASE:            # under the panel the canvas was one flat colour: lay plain panel there
            from_row, (tile, box) = BASE[name]
            t = np.array(Image.open(os.path.join(S, tile + ".png")).convert("RGBA"))[box[1]:box[1] + box[3], box[0]:box[0] + box[2]]
            if t.shape[1] < bw:     # a strip half as wide, laid beside its mirror image
                t = np.concatenate([t, t[:, ::-1]], axis=1)
            for y in range(from_row, bh):
                a[y] = t[(y - from_row) % t.shape[0], :bw]
        boxes = square(a, name, log, shift=(ox - layouts.CROP[name][0], oy - layouts.CROP[name][1]))
        os.makedirs(OUT, exist_ok=True)
        out = os.path.join(OUT, name + ".png")
        rgb = Image.fromarray(a[..., :3], "RGB").quantize(colors=63, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
        q = np.dstack([np.array(rgb), a[..., 3]])
        save_indexed(Image.fromarray(q, "RGBA"), out)
        result[name] = {"size": [bw, bh], "windows": {n: [b["x"], b["y"], b["w"], b["h"]] for n, b in boxes.items()}}
        if name == "console-right":
            v = vu_face(a, layouts.VU)
            if v:
                result[name]["vu_face"] = list(v[1:])
        log.append(f"{name:28} {bw:4} x {bh:<4} {os.path.getsize(out):6} bytes")
        for n, b in boxes.items():
            log.append(f"    window {n:9} {b['w']:3} x {b['h']:<3} at {b['x']:3},{b['y']:<3}  (came back {b['came_back'][2]} x {b['came_back'][3]} at {b['came_back'][0]},{b['came_back'][1]}{'' if b['clean'] else ', not a clean rectangle'})")
        if "vu_face" in result[name]:
            log.append(f"    VU face    {result[name]['vu_face'][2]:3} x {result[name]['vu_face'][3]:<3} at {result[name]['vu_face'][0]:3},{result[name]['vu_face'][1]:<3}  (painted, not a window)")
    with open(os.path.join(HERE, "windows.json"), "w") as f:
        json.dump(result, f, indent=1)


if __name__ == "__main__":
    if sys.argv[1:2] == ["second"]:
        second(sys.argv[2:])
    else:
        log = []
        build(log)
        print("\n".join(log))
