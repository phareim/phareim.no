# sheet.py <kit> [sheet ...]: lay out the kit's sheets from its plan (plans/<kit>.py) and write each sheet's prompt.
# Per sheet: the pieces' guides (kit-guides.mjs) at the sheet's pitch (sheet px to an art px) on the flat key colour,
# one row, bottoms aligned, evenly spaced -> <work>/sheets/<sheet>/guide.png, cells.json, prompt.txt, and the
# references the prompt names copied beside them (style.png, the realm's concept).
# (Part 23's things sheets: things.py/sheet-things are the older form of this, for thingArt.ts.)
import json, os, shutil, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import KEYS, REPO, TOOLS, plan, work

kit = sys.argv[1]
P = plan(kit)
want = sys.argv[2:] or list(P.SHEETS)
for name in want:
    s = P.SHEETS[name]
    W, H = s['size']; pitch = s['pitch']; key = s.get('key', 'green')
    ims = []
    for gid in s['ids']:
        g = Image.open(work(kit, 'guides', f'{s.get("guide", {}).get(gid, gid)}.png')).convert('RGBA')
        ims.append((gid, g.resize((round(g.width * pitch), round(g.height * pitch)), Image.NEAREST)))
    gap = (W - sum(i.width for _, i in ims)) / (len(ims) + 1)
    assert gap > 24, (name, 'too wide', gap)
    base = (H + max(i.height for _, i in ims)) // 2
    assert base <= H - 16 and base - max(i.height for _, i in ims) >= 16, (name, 'too tall')
    sh = Image.new('RGB', (W, H), KEYS[key]); cells = {}; x = gap
    for gid, i in ims:
        x0, y0 = int(round(x)), base - i.height
        sh.paste(i, (x0, y0), i); cells[gid] = [x0, y0, x0 + i.width, y0 + i.height]; x += i.width + gap
    d = work(kit, 'sheets', name); os.makedirs(os.path.join(d, 'raw'), exist_ok=True)
    sh.save(os.path.join(d, 'guide.png'))
    json.dump({'pitch': pitch, 'size': [W, H], 'key': key, 'cells': cells}, open(os.path.join(d, 'cells.json'), 'w'), indent=1)
    refs = ['guide.png']
    for ref, src in s.get('refs', P.REFS).items():   # a sheet may name its own (the gates: each realm's concept)
        shutil.copy(os.path.join(REPO, src) if not os.path.isabs(src) else src, os.path.join(d, ref)); refs.append(ref)
    sizes = '; '.join(f"the {s.get('names', {}).get(k, k.replace('_', ' '))} is {round((v[2] - v[0]) / pitch)} art pixels wide "
                      f"({v[2] - v[0]} sheet pixels) and {round((v[3] - v[1]) / pitch)} tall ({v[3] - v[1]} sheet pixels)"
                      for k, v in cells.items())
    keyname = {'green': 'flat pure green #00FF00', 'magenta': 'flat pure magenta #FF00FF'}[key]
    text = P.HEAD.format(W=W, H=H, n=s['n'], what=s['what'], every=s['every'], pitch=pitch, sizes=sizes, key=keyname,
                         desc=s['desc'].strip())
    open(os.path.join(d, 'prompt.txt'), 'w').write(text)
    json.dump(refs, open(os.path.join(d, 'refs.json'), 'w'))
    print(name, W, 'x', H, 'pitch', pitch, 'key', key, {k: v for k, v in cells.items()}, 'gap', round(gap))
