# kitturn.py <kit> <base> <bare> <frames> <parts> <step>: frames of a thing whose part turns (a mill's sails), made from
# ONE drawing: the drawn part, turned about its hub in its own plane, over a drawing of the thing without it.
#   <base>    the built drawing with the part (kitbuild.py: <work>/build/<base>.png, in <base>'s box), e.g. meadow_mill_0
#   <bare>    the built drawing without it, in the same box (a --part guide of kit-guides.mjs), e.g. meadow_mill_tower
#   <frames>  the frame ids, comma list (each keeps its own box), e.g. meadow_mill_0,meadow_mill_1,...
#   <parts>   in <base>'s guide, which solid calls are the part and which is the hub: <from>-<to>:<hub>, e.g. 7-286:287
#   <step>    the turn from one frame to the next, in degrees (the solids': a quarter of the sails' symmetry), e.g. 22.5
# The part lies in a plane facing the viewer's lower left (y = const in the scene): a px (sx, sy) there is the point
# x = sx + c, z = (x + c)/2 - sy, so the turn is done in (x, z) and drawn back, nearest px. The hub stays put on top.
# Every frame shares ONE normal and depth map (the frames' union): the part's plane wherever any frame has the part,
# the hub's own, the bare drawing's guide elsewhere. Writes <work>/build/<frame>.json and .png.
import json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import guide, record, work

kit, base, bare, frames, parts, step = sys.argv[1:7]
frames = frames.split(','); step = math.radians(float(step))
p0, p1, hubk = [int(v) for v in parts.replace(':', '-').split('-')]
load = lambda i: np.asarray(Image.open(work(kit, 'build', f'{i}.png')).convert('RGBA')).astype(int)
# The base drawing is kept aside as <base>.drawn.png the first time, since the first frame is written over <base>.
import shutil
if not os.path.exists(work(kit, 'build', f'{base}.drawn.png')): shutil.copy(work(kit, 'build', f'{base}.png'), work(kit, 'build', f'{base}.drawn.png'))
B, T = load(f'{base}.drawn'), load(bare)
G, Gt = guide(kit, base), guide(kit, bare)
H, W = G['h'], G['w']
Ab, At = B[..., 3] > 0, T[..., 3] > 0
sail_g = G['hit'] & (G['solid'] >= p0) & (G['solid'] <= p1)
hub_g = G['hit'] & (G['solid'] == hubk)
# The drawn part: near the guide's part (Codex draws it where it likes, within a few px), the drawing's px that the
# bare drawing has not (it is empty there, or another colour: the two drawings agree px for px elsewhere).
near = ndimage.binary_dilation(sail_g, iterations=int(os.environ.get('NEAR', 4)))
differs = np.abs(B[..., :3] - T[..., :3]).sum(-1) > int(os.environ.get('DIFF', 60))
sail = Ab & near & (differs | ~At) & ~hub_g
hub = Ab & ndimage.binary_dilation(hub_g, iterations=1) & ~(sail_g & ~hub_g)
hy, hx = [v.mean() + 0.5 for v in np.nonzero(hub_g)]
print('hub at', round(hx, 1), round(hy, 1), 'part px', int(sail.sum()), 'hub px', int(hub.sum()))

def turned(theta):
    """The part turned by theta about the hub, in base's box: rgb and alpha."""
    out = np.zeros((H, W, 3), int); a = np.zeros((H, W), bool)
    c, s = math.cos(theta), math.sin(theta)
    for y in range(H):
        for x in range(W):
            dX = x + 0.5 - hx; dZ = dX / 2 - (y + 0.5 - hy)       # target px in the plane
            sX = c * dX + s * dZ; sZ = -s * dX + c * dZ          # turned back
            sx = int(math.floor(hx + sX)); sy = int(math.floor(hy + sX / 2 - sZ))
            if 0 <= sx < W and 0 <= sy < H and sail[sy, sx]: out[y, x] = B[sy, sx, :3]; a[y, x] = True
    return out, a

pics = []
for k, f in enumerate(frames):
    rgb = T[..., :3].copy(); A = At.copy()
    srgb, sa = turned(k * step)
    rgb[sa] = srgb[sa]; A |= sa
    rgb[hub] = B[hub, :3]; A |= hub
    pics.append((f, rgb, A, sa))
# One normal and depth map for all frames.
U = np.zeros((H, W), bool)
for _, _, _, sa in pics: U |= sa
plane_n = np.median(G['normal'][sail_g], axis=0).astype(int)
ys, xs = np.nonzero(sail_g)
coef, *_ = np.linalg.lstsq(np.c_[xs, ys, np.ones(len(xs))], G['deep'][sail_g].astype(float), rcond=None)
YY, XX = np.mgrid[0:H, 0:W]
plane_d = np.clip(np.round(coef[0] * XX + coef[1] * YY + coef[2]), 1, 255)
# elsewhere: the bare guide's nearest px (its depth carried along the rows), the hub its own
gh = Gt['hit'] | hub_g
gn = np.where(hub_g[..., None], G['normal'], Gt['normal']); gd = np.where(hub_g, G['deep'], Gt['deep'])
_, (iy, ix) = ndimage.distance_transform_edt(~gh, return_indices=True)
nrm = gn[iy, ix].copy()
q = (gd[iy, ix].astype(float) - 128) / 4 + (YY - iy)
dep = np.clip(np.round(q * 4) + 128, 1, 255)
nrm[U & ~hub_g] = plane_n; dep = np.where(U & ~hub_g, plane_d, dep)
for f, rgb, A, _ in pics:
    g = guide(kit, f)
    dx = G['ax'] - g['ax']; dy = G['ay'] - g['ay']                 # frame px (x, y) is base px (x + dx, y + dy)
    sl = (slice(dy, dy + g['h']), slice(dx, dx + g['w']))
    assert dy >= 0 and dx >= 0 and dy + g['h'] <= H and dx + g['w'] <= W, (f, 'box outside the base box')
    fa = A[sl]
    deep = np.where(fa, dep[sl], 0).astype(np.uint8)
    out = record(rgb[sl], fa, np.zeros_like(fa), nrm[sl], deep, g,
                 f'codex image_gen, sheet of {base} and {bare}: the drawn part turned {round(math.degrees(frames.index(f) * step), 1)} degrees about its hub (kitturn.py); normals and depth shared by all frames')
    json.dump(out, open(work(kit, 'build', f'{f}.json'), 'w'))
    Image.fromarray(np.dstack([rgb[sl], fa * 255]).astype(np.uint8), 'RGBA').save(work(kit, 'build', f'{f}.png'))
    print(f, f"{g['w']}x{g['h']}", 'anchor', g['ax'], g['ay'], 'colours', len(out['pal']), 'cropped px', int(A.sum() - fa.sum()))
