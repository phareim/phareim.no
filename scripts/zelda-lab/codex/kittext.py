# kittext.py <kit> <id> <mats> <ramp> [--grow n] [--halo 0|1] [--within mats]: a drawn sign whose words Codex got wrong
# (a camp board, a waymark, a BORDER arm), its words laid again from the guide: the panel round the guide's letters
# (the box round each cluster of the guide's <mats> px, grown by --grow, default 1) is cleared to the drawing's own
# panel colour there (its darkest common colour), and the guide's letter px become neon in <ramp> (kitbuild.py's RAMPS:
# pink, cyan, neon, violet, rose, red, lamp) by the guide's own shading, glowing; --halo 1 lights the px beside them
# at 60 %. --within <mats>: clear only inside the box round those mats instead (the sign plate). Reads and rewrites
# <work>/build/<id>.json and .png (run kitbuild.py first); `drawn` records the edit.
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import RAMPS, guide, record, work

kit, tid, mats, rampname = sys.argv[1:5]
opt = dict(zip(sys.argv[5::2], sys.argv[6::2]))
R = json.load(open(work(kit, 'build', f'{tid}.json')))
T = guide(kit, tid)
H, W = R['h'], R['w']
pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in R['pal'].items()}
rgb = np.zeros((H, W, 3), int); A = np.zeros((H, W), bool); lit = np.zeros((H, W), bool)
for y, row in enumerate(R['rows']):
    for x, ch in enumerate(row):
        if ch == '.': continue
        rgb[y, x] = pal[ch]; A[y, x] = True; lit[y, x] = ch in R['glow']
letters = np.isin(T['matname'], mats.split(',')) & T['hit']
g = int(opt.get('--grow', 1))
clear = np.zeros((H, W), bool)
lab, n = ndimage.label(ndimage.binary_dilation(np.isin(T['matname'], opt.get('--within', mats).split(',')) & T['hit'], iterations=2))
for sl in ndimage.find_objects(lab):
    clear[max(0, sl[0].start - g + 2):sl[0].stop + g - 2, max(0, sl[1].start - g + 2):sl[1].stop + g - 2] = True
clear &= A & T['hit']
# The panel's colour: the commonest of the darker half of the drawn px in the cleared box.
px = rgb[clear]
dark = px[px.sum(-1) <= np.median(px.sum(-1))]
vals, counts = np.unique(dark, axis=0, return_counts=True)
bg = vals[np.argmax(counts)]
rgb[clear] = bg; lit[clear] = False
# The letters, shaded by the guide's own colour lightness.
lum = T['rgb'][..., :3].sum(-1) / 3 if 'rgb' in T else np.asarray(Image.open(work(kit, 'guides', f'{tid}.png')).convert('RGB')).sum(-1) / 3
L = lum[letters]; lo, hi = np.percentile(L, 5), np.percentile(L, 95) + 1e-6
k = np.clip((np.clip((lum - lo) / (hi - lo), 0, 1) * 2.999).astype(int) + 2, 0, 4)   # the ramp's three brightest
ramp = np.array(RAMPS[rampname])
rgb[letters] = ramp[k[letters]]; A |= letters; lit |= letters
if opt.get('--halo') == '1':
    h = ndimage.binary_dilation(letters, structure=ndimage.generate_binary_structure(2, 1)) & clear & ~letters
    rgb[h] = (rgb[h] * 0.4 + ramp[1] * 0.6).astype(int); lit |= h
_, (iy, ix) = ndimage.distance_transform_edt(~T['hit'], return_indices=True)
nrm = T['normal'][iy, ix]
deep = np.frombuffer(__import__('base64').b64decode(R['deep']), np.uint8).reshape(H, W).copy()
q = (T['deep'][iy, ix].astype(float) - 128) / 4 + (np.arange(H)[:, None] - iy)
deep = np.where(A & (deep == 0), np.clip(np.round(q * 4) + 128, 1, 255), deep).astype(np.uint8)
# keep the drawing's normals where it had px: rebuild from the record's own normal map
npal = R['npal']; old = np.zeros((H, W, 3), np.uint8)
for y, row in enumerate(R['nrows']):
    for x, ch in enumerate(row):
        if ch != '.': old[y, x] = [int(npal[ord(ch) - 48][i:i + 2], 16) for i in (1, 3, 5)]
had = np.array([[c != '.' for c in row] for row in R['nrows']])
nrm = np.where(had[..., None], old, nrm)
out = record(rgb, A, lit, nrm, deep, T, R['drawn'] + f'; its words laid again from the guide\'s letters ({mats}) in {rampname} neon (kittext.py)', 0)
json.dump(out, open(work(kit, 'build', f'{tid}.json'), 'w'))
Image.fromarray(np.dstack([rgb, A * 255]).astype(np.uint8), 'RGBA').save(work(kit, 'build', f'{tid}.png'))
print(tid, 'letters', int(letters.sum()), 'cleared', int(clear.sum()), 'panel', '#%02x%02x%02x' % tuple(bg), 'colours', len(out['pal']), 'glowing', len(out['glow']))
