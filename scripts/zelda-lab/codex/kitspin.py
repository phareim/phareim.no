# kitspin.py <kit> <from> <to> <deg|mirror>: (mirror: the drawing flipped left to right about the anchor instead, for a
# thing whose shading is symmetric but whose rays are not: the rays move, the light stays where it falls.)
# a frame of a thing that lies flat and turns about its upright axis (the Underglow's
# Sun Below: its rays turn half a ray between its two frames), made from ONE built drawing (kitbuild.py:
# <work>/build/<from>.json, .png). Each of the guide's solids (the dome's stacked rings: one solid call a ring) turns
# about its own middle in the ground plane: on the screen a ground circle is an ellipse twice as wide as tall, so a px
# (dx, dy) from the ring's middle is turned in (dx, 2 dy) and drawn back, nearest px, taking only px of the same ring.
# Glow, colours, normals and depth: the drawing's own glow travels with its px; normals and depth are <to>'s guide's.
# Writes <work>/build/<to>.json and .png.
import json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import guide, record, work

kit, src, dst, deg = sys.argv[1:5]
MIRROR = deg == 'mirror'
th = 0.0 if MIRROR else math.radians(float(deg))
R = json.load(open(work(kit, 'build', f'{src}.json')))
G, T = guide(kit, src), guide(kit, dst)
assert [G[k] for k in ('w', 'h', 'ax', 'ay')] == [T[k] for k in ('w', 'h', 'ax', 'ay')], 'the two frames have other boxes'
H, W = R['h'], R['w']
pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in R['pal'].items()}
rgb = np.zeros((H, W, 3), int); A = np.zeros((H, W), bool); lit = np.zeros((H, W), bool)
for y, row in enumerate(R['rows']):
    for x, ch in enumerate(row):
        if ch == '.': continue
        rgb[y, x] = pal[ch]; A[y, x] = True; lit[y, x] = ch in R['glow']
# Each px's ring: the solid of the nearest guide px.
_, (iy, ix) = ndimage.distance_transform_edt(~G['hit'], return_indices=True)
ring = G['solid'][iy, ix]
mid = {}
for r in np.unique(G['solid'][G['hit']]):
    ys, xs = np.nonzero(G['hit'] & (G['solid'] == r))
    mid[r] = ((xs.min() + xs.max() + 1) / 2, (ys.min() + ys.max() + 1) / 2)   # the ring's box middle (its silhouette is an ellipse)
out = rgb.copy(); oA = A.copy(); oL = lit.copy()
c, s = math.cos(th), math.sin(th)
if MIRROR:
    ax = R['ax']
    out[:] = 0; oA[:] = False; oL[:] = False
    for y in range(H):
        for x in range(W):
            sx = 2 * ax - 1 - x
            if 0 <= sx < W and A[y, sx]: out[y, x] = rgb[y, sx]; oA[y, x] = True; oL[y, x] = lit[y, sx]
for y in (range(0) if MIRROR else range(H)):
    for x in range(W):
        if not A[y, x]: continue
        r = ring[y, x]; mx, my = mid[r]
        u, v = x + 0.5 - mx, 2 * (y + 0.5 - my)
        su, sv = c * u + s * v, -s * u + c * v                     # turned back
        sx, sy = int(math.floor(mx + su)), int(math.floor(my + sv / 2))
        if 0 <= sx < W and 0 <= sy < H and A[sy, sx] and ring[sy, sx] == r:
            out[y, x] = rgb[sy, sx]; oL[y, x] = lit[sy, sx]
_, (ty, tx) = ndimage.distance_transform_edt(~T['hit'], return_indices=True)
nrm = T['normal'][ty, tx]
q = (T['deep'][ty, tx].astype(float) - 128) / 4 + (np.arange(H)[:, None] - ty)
deep = np.where(oA, np.clip(np.round(q * 4) + 128, 1, 255), 0).astype(np.uint8)
rec = record(out, oA, oL, nrm, deep, T, R['drawn'] + ('; flipped left to right about its anchor (kitspin.py)' if MIRROR else f'; turned {deg} degrees about its axis (kitspin.py)'))
json.dump(rec, open(work(kit, 'build', f'{dst}.json'), 'w'))
Image.fromarray(np.dstack([out, oA * 255]).astype(np.uint8), 'RGBA').save(work(kit, 'build', f'{dst}.png'))
print(dst, f'{W}x{H}', 'colours', len(rec['pal']), 'glowing', len(rec['glow']), 'changed px', int((np.abs(out - rgb).sum(-1) > 0).sum()))
