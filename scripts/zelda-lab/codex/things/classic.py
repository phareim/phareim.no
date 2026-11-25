# classic.py <sprites.json> <outdir>: each classic sprite at 1x, and a contact sheet at 8x
import json, sys, os
from PIL import Image
d = json.load(open(sys.argv[1])); pal, spr = d['pal'], d['sprites']; out = sys.argv[2]
def paint(name):
    rows = spr[name]['rows']; h = len(rows); w = len(rows[0])
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            c = pal.get(ch)
            if c: im.putpixel((x, y), tuple(int(c[i:i+2], 16) for i in (1, 3, 5)) + (255,))
    return im
ims = {n: paint(n) for n in spr}
for n, i in ims.items(): i.save(f'{out}/{n}.png')
S = 8; W = sum(i.width * S + 16 for i in ims.values()) + 16; H = max(i.height for i in ims.values()) * S + 32
sh = Image.new('RGB', (W, H), (40, 30, 60)); x = 16
for i in ims.values():
    b = i.resize((i.width * S, i.height * S), Image.NEAREST); sh.paste(b, (x, H - 16 - b.height), b); x += b.width + 16
sh.save(f'{out}/_all.png')
