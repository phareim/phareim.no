# kitscale.py <kit> <sheet> <f>: a sheet drawn over a guide shrunk by <f> (a piece too big for one image at the game's
# px: the gold pyramid, 416 px wide, drawn on its half-size guide), made ready for kitbuild.py at the piece's own size.
# Writes the sheet <sheet>x<f> beside it: the cut (cut2.py's <sheet>/cut) with every art px <f> x <f> game px, its grid
# origin and the sheet's pitch in the full guide's px. Then: kitbuild.py <kit> <id> <sheet>x<f> (the full guide).
import json, os, shutil, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import work

kit, sheet, f = sys.argv[1], sys.argv[2], int(sys.argv[3])
src, dst = work(kit, 'sheets', sheet), work(kit, 'sheets', f'{sheet}x{f}')
os.makedirs(os.path.join(dst, 'cut'), exist_ok=True)
cells = json.load(open(os.path.join(src, 'cells.json')))
cells['pitch'] = cells['pitch'] / f
json.dump(cells, open(os.path.join(dst, 'cells.json'), 'w'), indent=1)
meta = json.load(open(os.path.join(src, 'cut', 'cut.json')))
assert 'src' not in meta, 'a cut of another raw image: not handled'
meta['pitch'] = meta['pitch'] / f
for name, fm in meta['frames'].items():
    im = Image.open(os.path.join(src, 'cut', f'{name}.png'))
    im.resize((im.width * f, im.height * f), Image.NEAREST).save(os.path.join(dst, 'cut', f'{name}.png'))
    fm.update(w=fm['w'] * f, h=fm['h'] * f, gx=fm['gx'] * f, gy=fm['gy'] * f)
meta['scaled'] = f
json.dump(meta, open(os.path.join(dst, 'cut', 'cut.json'), 'w'), indent=1)
if os.path.isdir(os.path.join(src, 'raw')): shutil.copytree(os.path.join(src, 'raw'), os.path.join(dst, 'raw'), dirs_exist_ok=True)
print(f'{sheet}x{f}:', {k: (v['w'], v['h']) for k, v in meta['frames'].items()}, 'pitch', round(meta['pitch'], 2))
