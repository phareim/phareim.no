# lineup.py: lineup.png: per thing the classic (its sprite at 2x, or the classic still's px halved to scene px), the guide
# built from solids, and the Codex drawing as shipped, all at 4x nearest on one dark ground, labelled.
import sys, json, os
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from kitlib import REPO, work
R = work('things')   # Part 23's work dir: tmp/codex-kits/things (guides/, sheets/, build/, classic/, archive/)
S = 4
still = lambda f, b: Image.open(f'{R}/{f}').convert('RGBA').crop(b).resize(((b[2] - b[0]) // 2, (b[3] - b[1]) // 2), Image.NEAREST)
spr = lambda n: (lambda i: i.resize((i.width * 2, i.height * 2), Image.NEAREST))(Image.open(f'{R}/classic/{n}.png').convert('RGBA'))
CL = {
    'van': lambda: spr('prop_van'), 'tent': lambda: spr('prop_tent'), 'fort': lambda: spr('prop_fort'), 'bike': lambda: spr('prop_bike'),
    'mast': lambda: spr('prop_mast'), 'mast_on': lambda: spr('prop_mast_on'), 'tank_0': lambda: spr('prop_tank_0'), 'tank_1': lambda: spr('prop_tank_1'),
    **{f'campfire_{i}': (lambda i=i: spr(f'prop_campfire_{i}')) for i in range(3)}, **{f'bonfire_{i}': (lambda i=i: spr(f'bonfire_{i}')) for i in range(3)},
    'torch_1': lambda: still('before/classic/r-beach-1280.png', (104, 340, 156, 436)),
    'speaker': lambda: still('before/classic/r-beach-1280.png', (285, 465, 345, 565)), 'table_mixer': lambda: still('before/classic/r-beach-1280.png', (330, 490, 440, 565)),
    'table_records': lambda: still('before/classic/r-beach-1280.png', (840, 490, 950, 565)), 'lights_0': lambda: still('before/classic/r-beach-1280.png', (290, 425, 480, 480)),
    'shelf_2': lambda: still('before/classic/r-home-1280.png', (220, 96, 356, 212)), 'shelf_1': lambda: still('before/classic/r-home-1280.png', (988, 96, 1060, 212)),
    'sofa_3': lambda: still('before/classic/r-home-1280.png', (536, 245, 744, 340)), 'desk_2': lambda: still('before/classic/r-home-1280.png', (220, 226, 356, 336)),
    'glass_2': lambda: still('before/classic/r-home-1280.png', (796, 262, 932, 342)), 'plant': lambda: still('before/classic/r-home-1280.png', (226, 420, 286, 534)),
    'bed': lambda: still('before/classic/hut-1280.png', (316, 172, 452, 308)), 'table': lambda: still('before/classic/hut-1280.png', (828, 300, 964, 436)),
    'machine_1': lambda: still('before/classic/hut-1280.png', (830, 170, 900, 250)), 'console_0': lambda: still('look/l-lobby-1280.png', (316, 200, 388, 276)),
    'bench_2': lambda: still('look/l-lobby-1280.png', (508, 206, 640, 278)), 'terminal': lambda: still('look/l-lobby-1280.png', (580, 144, 640, 206)),
    'fountain_0': lambda: still('before/classic/r-plaza-1280.png', (540, 560, 810, 800)),
}
GUIDE = {'mast_on': 'mast_on', 'tank_1': 'tank_1', 'lights_0': 'lights', 'console_0': 'console', 'machine_1': 'machine', 'torch_1': 'torch_1'}
cells = []
for tid, cl in CL.items():
    b = json.load(open(f'{R}/build/{tid}.json'))
    g = Image.open(f'{R}/guides/{GUIDE.get(tid, tid)}.png').convert('RGBA')
    f = Image.open(f'{R}/build/{tid}.png').convert('RGBA')
    ims = [cl(), g, f]
    w = sum(i.width for i in ims) * S + 40; h = max(i.height for i in ims) * S + 40
    c = Image.new('RGBA', (w, h), (24, 18, 40, 255)); x = 10
    for i in ims:
        big = i.resize((i.width * S, i.height * S), Image.NEAREST); c.paste(big, (x, h - 10 - big.height), big); x += big.width + 10
    d = ImageDraw.Draw(c); d.text((10, 6), f"{tid}: classic | guide (solids) | Codex {b['sheet']} ({b['frame']}{', edit ' + b['edit'] if b.get('edit') else ''}), pitch {b['pitch']}", fill=(255, 241, 176, 255))
    cells.append(c)
cols = 3; rows = [cells[i:i + cols] for i in range(0, len(cells), cols)]
W = max(sum(c.width for c in r) for r in rows) + 10 * (cols + 1); H = sum(max(c.height for c in r) for r in rows) + 10 * (len(rows) + 1)
out = Image.new('RGB', (W, H), (11, 6, 22)); y = 10
for r in rows:
    x = 10
    for c in r: out.paste(c, (x, y)); x += c.width + 10
    y += max(c.height for c in r) + 10
out.save(f'{R}/lineup.png'); print(out.size, len(cells))
