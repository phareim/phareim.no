# build.py <id> <sheet> <cutdir> [--from <frame>] [--edit <kind>]: one drawn thing for the game, as JSON (build/<id>.json).
# The drawing's colours as they are (the key's fringe off; near-identical colours merged, never capped); each px's
# normal and depth from the guide (guides/<frame>.npz) at the same place, by the sheet's grid (cut.json: where the
# drawing's grid starts and its pitch), the nearest guide px where the drawing reaches past the guide; glow by colour.
import base64, colorsys, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

tid, sheet, cutdir = sys.argv[1], sys.argv[2], sys.argv[3]
opt = dict(zip(sys.argv[4::2], sys.argv[5::2]))
frame = opt.get('--from', tid)
edit = opt.get('--edit')
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from kitlib import REPO, work
R = work('things')   # Part 23's work dir: tmp/codex-kits/things (guides/, sheets/, build/, classic/, archive/)
cells = json.load(open(f'{R}/sheets/{sheet}/cells.json')); meta = json.load(open(f'{cutdir}/cut.json'))
pitch = meta['pitch']; fm = meta['frames'][frame]
art = np.asarray(Image.open(f'{cutdir}/{frame}.png').convert('RGBA')).astype(int)
# (--guide: the guide whose normal and depth the drawing takes, when not the frame's own: a composite frame stands on the first's)
G = np.load(f"{R}/guides/{opt.get('--guide', frame)}.npz", allow_pickle=True)

# --- the key's fringe: a greenish px on the silhouette's edge goes (twice), as does a px left alone
a = art[..., 3] > 0
for _ in range(2):
    r, g, b = art[..., 0], art[..., 1], art[..., 2]
    greenish = (g > r + 50) & (g > b + 50) & (g > 140)
    edge = a & ~ndimage.binary_erosion(a, structure=np.ones((3, 3)), border_value=0)
    kill = greenish & edge
    a &= ~kill; art[..., 3] = a * 255
lone = a & (ndimage.convolve(a.astype(int), np.ones((3, 3)), mode='constant') <= 2) & (art[..., 1] > art[..., 0] + 30) & (art[..., 1] > art[..., 2] + 30)
a &= ~lone; art[..., 3] = a * 255
ys, xs = np.nonzero(a); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
art = art[y0:y1, x0:x1]; a = a[y0:y1, x0:x1]; H, W = a.shape
gx, gy = fm['gx'] + x0 * pitch / 10, fm['gy'] + y0 * pitch / 10   # where art px (0, 0)'s corner lies in guide px
s = pitch / 10                                                     # guide px to an art px

# (an edit that moves px, before they get their depth)
edit = opt.get('--edit')
if edit and edit.startswith('jet'):  # a fountain's jet k px lower: what rises over the stone moves down, its top rows go
    k = int(edit[3:])
    rgb = art[..., :3]
    hsv = np.array([colorsys.rgb_to_hsv(*(c / 255)) for c in rgb.reshape(-1, 3)]).reshape(H, W, 3)
    water = a & (((hsv[..., 0] > 0.5) & (hsv[..., 0] < 0.62) & (hsv[..., 1] > 0.25)) | ((hsv[..., 2] > 0.9) & (hsv[..., 1] < 0.2)))
    stone = a & ~water
    top = int(np.nonzero(stone.any(1))[0].min())
    src_rgb, src_a = rgb.copy(), a.copy()
    for y in range(top - 1, -1, -1):
        for x in range(W):
            if y - k >= 0: rgb[y, x], a[y, x] = src_rgb[y - k, x], src_a[y - k, x]
            else: a[y, x] = False
    art[..., 3] = a * 255
# --- normal and depth from the guide
hit = G['hit']; nrm = G['nrm']; q = G['q']; gmats = G['mats']
_, (iy, ix) = ndimage.distance_transform_edt(~hit, return_indices=True)
v = np.clip(((np.arange(H) + 0.5) * s + gy).astype(int), 0, hit.shape[0] - 1)
u = np.clip(((np.arange(W) + 0.5) * s + gx).astype(int), 0, hit.shape[1] - 1)
V, U = np.meshgrid(v, u, indexing='ij'); NY, NX = iy[V, U], ix[V, U]
N = nrm[NY, NX]; Q = q[NY, NX] / s; M = gmats[NY, NX]
ax = (float(G['ax']) - gx) / s; ay = (float(G['ay']) - gy) / s
AX, AY = int(round(ax)), int(round(ay))
# a point's q is its row from the anchor plus how high it stands: keep the guide's height, measured from this anchor
QQ = Q - ((V + 0.5 - float(G['ay'])) / s) + (np.arange(H)[:, None] + 0.5 - AY)
deep = np.where(a, np.clip(np.round(QQ * 4) + 128, 1, 255), 0).astype(np.uint8)
S2 = np.sqrt(0.5)
enc = np.stack([((N[..., 0] - N[..., 1]) * S2 * 0.5 + 0.5) * 255, (N[..., 2] * 0.5 + 0.5) * 255, ((N[..., 0] + N[..., 1]) * S2 * 0.5 + 0.5) * 255], -1)

# --- glow: by colour (the flames, bulbs, lamps), or where the guide's material glows and the drawing is bright there
RULES = {
    'console': lambda h, s_, v_, m, r: 1.0 if v_ > 0.75 and s_ > 0.45 else 0.6 if 0.45 < h < 0.58 and v_ > 0.5 and s_ > 0.3 else 0.0,
    'machine': lambda h, s_, v_, m, r: 0.85 if v_ > 0.6 and s_ > 0.4 else 0.0,
    'terminal': lambda h, s_, v_, m, r: 0.8 if 0.45 < h < 0.58 and v_ > 0.45 and s_ > 0.3 else 0.0,
    'fountain': lambda h, s_, v_, m, r: 0.35 if (0.5 < h < 0.62 and s_ > 0.25 and v_ > 0.75) or (v_ > 0.9 and s_ < 0.2) else 0.0,
    'desk': lambda h, s_, v_, m, r: 0.8 if 0.44 < h < 0.56 and v_ > 0.6 and s_ > 0.35 else 0.0,
    'lights': lambda h, s_, v_, m, r: 1.0 if v_ > 0.93 and s_ > 0.3 or (v_ > 0.92 and s_ < 0.15) else 0.0,
    'tank': lambda h, s_, v_, m, r: 1.0 if s_ > 0.6 and v_ > 0.8 and (h < 0.05 or h > 0.95 or 0.18 < h < 0.3) and r > 0.8 else 0.35 if 0.36 < h < 0.55 and v_ > 0.55 and s_ > 0.25 else 0.25 if v_ > 0.85 and s_ < 0.25 and 0.15 < r < 0.85 else 0.0,
    'mast': lambda h, s_, v_, m, r: 1.0 if r < 0.12 and v_ > 0.9 and (h < 0.05 or h > 0.9 or s_ < 0.3) and edit == 'lamp-on' else 0.0,
    'campfire': lambda h, s_, v_, m, r: (v_ > 0.72 and s_ > 0.35 and (h < 0.17 or h > 0.97)) or (v_ > 0.93 and s_ < 0.35 and m in ('fire', 'fireY', 'fireW', 'ember')),
    'bonfire': lambda h, s_, v_, m, r: (v_ > 0.72 and 0.45 < h < 0.7 and s_ > 0.25) or (v_ > 0.93 and s_ < 0.2 and m in ('blue', 'blueL', 'blueW', 'ember')),
}
GLOWMAT = {'lamp': 0.8, 'red': 1, 'bulbY': 1, 'bulbO': 1, 'bulbP': 1, 'bulbG': 1, 'liquid': 0.35, 'lime': 1, 'warm': 0.8, 'ember': 1,
           'fire': 1, 'fireY': 1, 'fireW': 1, 'blue': 1, 'blueL': 1, 'blueW': 1, 'blueW2': 1}
RULES['torch'] = RULES['campfire']
rule = RULES.get(tid.split('_')[0])
def glowOf(c, m, row=0.5):
    h, s_, v_ = colorsys.rgb_to_hsv(*(np.array(c) / 255))
    if rule: return float(rule(h, s_, v_, m, row))
    g = GLOWMAT.get(m, 0)
    return g if g and v_ > 0.5 else 0.0

# --- edits that make another frame of one drawing (pixel edits, no px of their own)
rgb = art[..., :3].copy()
if edit == 'lamp-on':   # the mast's warning lamp lit: its dark red px turned to the lamp's red and white
    lampy = a & (np.arange(H)[:, None] < H * 0.12) & (rgb[..., 0] > rgb[..., 1] + 40)
    lum = rgb[lampy].sum(1); top = lum >= np.percentile(lum, 70) if lum.size else lum
    rgb[lampy] = np.where(top[:, None], [255, 190, 200], [255, 59, 92])
if edit and edit.startswith('bubbles'):   # the tank's bubbles a few px higher
    k = int(edit[7:] or 4)
    inl = a & (M == 'liquid')
    light = inl & (rgb.min(-1) > 175)
    liq = np.median(rgb[inl & ~light], axis=0).astype(int) if (inl & ~light).any() else np.array([63, 216, 176])
    src = rgb.copy()
    rgb[light] = liq
    ys_, xs_ = np.nonzero(light)
    for y, x in zip(ys_, xs_):
        if y - k >= 0 and inl[y - k, x]: rgb[y - k, x] = src[y, x]
if edit and edit.startswith('twinkle'):  # some of the fairy lights' bulbs dim: (bulb + frame) % 4 == 0
    f = int(edit[7:])
    hsv = np.array([colorsys.rgb_to_hsv(*(c / 255)) for c in rgb.reshape(-1, 3)]).reshape(H, W, 3)
    bulb = a & (hsv[..., 2] > 0.8) & (hsv[..., 1] > 0.3) | (a & (rgb.min(-1) > 225))
    bulb &= ndimage.binary_dilation(a & (hsv[..., 2] > 0.8) & (hsv[..., 1] > 0.3), iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(bulb, iterations=1))
    order = sorted(range(1, n + 1), key=lambda i: np.nonzero(lab == i)[1].mean())
    for j, i in enumerate(order):
        if (j + f) % 4 == 0:
            m = (lab == i) & bulb
            rgb[m] = (rgb[m] * 0.38).astype(int) + [20, 8, 18]
            M = M.copy(); M[m] = 'dim'

if edit and edit.startswith('blink'):  # a console's small lights: every other one dimmed, by frame
    f = int(edit[5:])
    hsv = np.array([colorsys.rgb_to_hsv(*(c / 255)) for c in rgb.reshape(-1, 3)]).reshape(H, W, 3)
    lit = a & (hsv[..., 2] > 0.75) & (hsv[..., 1] > 0.45)
    lab, n = ndimage.label(lit)
    comps = [i for i in range(1, n + 1) if (lab == i).sum() <= 12]
    comps.sort(key=lambda i: (int(np.nonzero(lab == i)[0].mean() // 2), np.nonzero(lab == i)[1].mean()))
    for j, i in enumerate(comps):
        if (j + f) % 2 == 0:
            m = lab == i; rgb[m] = (rgb[m] * 0.35).astype(int) + [10, 12, 24]
if edit and edit.startswith('hue'):  # a screen's colour: its pink turned to another hue (the classic cycles cyan, pink, lime)
    to = float(edit[3:])
    hsv = np.array([colorsys.rgb_to_hsv(*(c / 255)) for c in rgb.reshape(-1, 3)]).reshape(H, W, 3)
    pink = a & ((hsv[..., 0] > 0.82) | (hsv[..., 0] < 0.02)) & (hsv[..., 1] > 0.35) & (hsv[..., 2] > 0.45)
    big, n = ndimage.label(pink); sizes = ndimage.sum(pink, big, range(1, n + 1))
    screen = big == (1 + int(np.argmax(sizes))) if n else pink
    ys_, xs_ = np.nonzero(screen)
    for y, x in zip(ys_, xs_):
        h_, s_, v_ = hsv[y, x]; rgb[y, x] = np.round(np.array(colorsys.hsv_to_rgb(to, s_, v_)) * 255).astype(int)
# --- palette: the drawing's colours; a colour within TOL of a commoner one is that one (the image's noise), never capped
TOL = float(opt.get('--tol', 15))
px = rgb[a].astype(float); cnt = {}
for c in map(tuple, (px // 3).astype(int)): cnt[c] = cnt.get(c, 0) + 1
cent = []
for c, n in sorted(cnt.items(), key=lambda kv: -kv[1]):
    c = np.array(c) * 3 + 1
    if not cent or np.min(np.linalg.norm(np.array(cent) - c, axis=1)) > TOL: cent.append(c)
cent = np.array(cent, float)
for _ in range(3):   # a few rounds of k-means from there, so each colour is its pixels' median
    lab = np.argmin(((px[:, None, :] - cent[None]) ** 2).sum(-1), axis=1)
    cent = np.array([np.median(px[lab == i], axis=0) if (lab == i).any() else cent[i] for i in range(len(cent))])
lab = np.argmin(((px[:, None, :] - cent[None]) ** 2).sum(-1), axis=1)
LET = [chr(c) for c in range(35, 127) if chr(c) not in '.\\"\''] + [chr(c) for c in range(161, 600) if c != 173]
used = sorted(set(lab.tolist()), key=lambda i: -(lab == i).sum())
assert len(used) <= len(LET), (len(used), 'colours')
ch_of = {i: LET[n] for n, i in enumerate(used)}
pal = {ch_of[i]: '#%02x%02x%02x' % tuple(np.round(cent[i]).astype(int)) for i in used}
rows = [['.'] * W for _ in range(H)]; glow = {}; per = {}
for (y, x), i in zip(zip(*np.nonzero(a)), lab):
    rows[y][x] = ch_of[i]; per.setdefault(i, []).append((y, x))
for i, pxs in per.items():
    gs = [glowOf(rgb[y, x], M[y, x], y / H) for y, x in pxs]
    gv = float(np.round(np.median(gs), 2))
    if gv > 0: glow[ch_of[i]] = gv
# --- normals: a palette of them (quantised to 1/16), at most 78 (k-means beyond)
E = enc[a].astype(float)
Qn = np.round(E / 16) * 16
uniq, inv = np.unique(Qn, axis=0, return_inverse=True)
if len(uniq) > 78:
    from scipy.cluster.vq import kmeans2
    cent, inv = kmeans2(E, 78, minit='++', seed=1); uniq = cent
uniq = np.clip(np.round(uniq), 0, 255).astype(int)
nrows = [['0'] * W for _ in range(H)]
for (y, x), i in zip(zip(*np.nonzero(a)), np.ravel(inv)): nrows[y][x] = chr(48 + int(i))
out = {'w': W, 'h': H, 'ax': AX, 'ay': AY, 'pal': pal, 'glow': glow, 'rows': [''.join(r) for r in rows],
       'npal': ['%02x%02x%02x' % tuple(n) for n in uniq], 'nrows': [''.join(r) for r in nrows],
       'deep': base64.b64encode(deep.tobytes()).decode(), 'sheet': sheet, 'frame': frame, 'pitch': round(pitch, 3), 'edit': edit}
os.makedirs(f'{R}/build', exist_ok=True)
json.dump(out, open(f'{R}/build/{tid}.json', 'w'))
Image.fromarray(np.dstack([rgb, a * 255]).astype(np.uint8), 'RGBA').save(f'{R}/build/{tid}.png')
print(tid, W, 'x', H, 'anchor', AX, AY, 'colours', len(pal), 'glowing', len(glow), 'normals', len(uniq), 'pitch', round(pitch, 2))
