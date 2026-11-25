# sheet_things.py <name> <W>x<H> <thing,thing,...>: Part 23's things sheets: the things' guides (things.py) on flat green
# at 10 sheet px to a scene px, one row, bottoms aligned, evenly spaced -> <work>/things/sheets/<name>/guide.png, cells.json
# (Realm kits use ../sheet.py with a plan instead.)
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from kitlib import work
R = work('things')
name, size, things = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
W, H = map(int, size.split('x')); P = 10
ims = [Image.open(f'{R}/guides/{t}.png') for t in things]
ws = [i.width * P for i in ims]; hs = [i.height * P for i in ims]
gap = (W - sum(ws)) / (len(ims) + 1); assert gap > 30, gap
base = (H + max(hs)) // 2
sh = Image.new('RGB', (W, H), (0, 255, 0)); cells = {}; x = gap
for t, i, w, h in zip(things, ims, ws, hs):
    x0, y0 = int(round(x)), base - h
    sh.paste(i.resize((w, h), Image.NEAREST), (x0, y0), i.resize((w, h), Image.NEAREST)); cells[t] = [x0, y0, x0 + w, y0 + h]; x += w + gap
os.makedirs(f'{R}/sheets/{name}/raw', exist_ok=True)
sh.save(f'{R}/sheets/{name}/guide.png'); json.dump({'pitch': P, 'size': [W, H], 'cells': cells}, open(f'{R}/sheets/{name}/cells.json', 'w'), indent=1)
json.dump(['guide.png', 'classic.png', 'style.png'], open(f'{R}/sheets/{name}/refs.json', 'w'))
print(name, cells, 'gap', round(gap))
