# kitlineup.py <kit> <out.png> [id ...]: each piece as its guide (the solids) above as built (the drawing), 3x, on a
# dusk-violet ground, with the anchor marked: the before/after sheet of a kit.
import json, os, sys
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import work
kit, out = sys.argv[1], sys.argv[2]
ids = sys.argv[3:] or sorted(f[:-5] for f in os.listdir(work(kit, 'build')) if f.endswith('.json') and not f.endswith('.fit.json'))
S = 3; pad = 8
cols = []
for i in ids:
    g = Image.open(work(kit, 'guides', f'{i}.png')).convert('RGBA')
    bp = work(kit, 'build', f'{i}.png')
    b = Image.open(bp).convert('RGBA') if os.path.exists(bp) else Image.new('RGBA', g.size)
    t = json.load(open(work(kit, 'guides', f'{i}.json')))
    cols.append((i, g.resize((g.width * S, g.height * S), Image.NEAREST), b.resize((b.width * S, b.height * S), Image.NEAREST), t))
W = sum(c[1].width + pad for c in cols) + pad; Hh = max(c[1].height for c in cols)
im = Image.new('RGBA', (W, Hh * 2 + pad * 3 + 12), (42, 34, 62, 255)); d = ImageDraw.Draw(im); x = pad
for i, g, b, t in cols:
    for k, pic in enumerate((g, b)):
        y = pad + k * (Hh + pad) + Hh - pic.height
        im.alpha_composite(pic, (x, y))
        d.rectangle([x + t['ax'] * S - 1, y + t['ay'] * S - 1, x + t['ax'] * S + 1, y + t['ay'] * S + 1], outline=(255, 80, 80))
    d.text((x, Hh * 2 + pad * 2), i.replace(kit + '_', '').replace('seter_', '').replace('meadow_', '')[:18], fill=(230, 222, 249))
    x += g.width + pad
im.save(out); print(out, im.size)
