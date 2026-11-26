# kitbuild.py <kit> <id> <sheet> [options]: one Codex-drawn piece of a realm kit, fitted to the piece's own box.
#   --from <cell>     the sheet's cell the drawing is (default <id>): a frame made from another frame's drawing
#   --cut <dir>       the cut (cut2.py) to read (default <work>/sheets/<sheet>/cut)
#   --scale 1|auto    1 (default): the drawing's px are the guide's px, placed where the sheet's grid puts them;
#                     auto: when the cut's pitch is off the sheet's, scale the placement about the anchor
#   --nudge dx,dy     move the drawing by whole px in the box after placing it
#   --edit <kind>     a frame made as a pixel edit of the drawing (no px of its own):
#                     lamp:<mats>   the px over the guide's <mats> (comma list, from the target guide) become lamplight
#                                   (gold to white by the drawn px's own lightness) and glow: night windows, lit lanterns;
#                                   with --within <mats>: instead the drawing's bluish px (glass: blue > red + --blue)
#                                   in the box round each cluster of the guide's <mats> px, grown by --grow px (a window's
#                                   rim), no darker than --minlum and no lighter than --maxlum (0-255); --glass warm takes warm px (drawn lit glass)
#                                   instead of bluish ones
#                     glow:<mats>   as lamp:, but the px keep the drawn colours and only glow (a rune's light);
#                                   --minsat <0-1> keeps only the strongly coloured px
#                     dark:<mats>   the same mask put out: the glass darkened, no glow (a lantern out)
#                     (--hot <mats> with lamp: the px over the guide's <mats> burn white-gold: a lens's lit side)
#                     drift:dx,dy   the px over the cell guide's smoke (material `rock` above the roof, --smoke-mat)
#                                   move by (dx, dy): a smoke frame
#                     breath:<row>  everything above <row> (art px from the top) sinks 1 px: a sleeper's breath
#   --geo <id>        normals and depth from that guide (the same box) instead of the target's own
#   --tol <n>         colours within n (of 255) of a commoner one are that one (the image's noise; default 15)
# Writes <work>/build/<id>.json (a ThingArt record: w, h, ax, ay, pal, glow, rows, nrows, npal, deep, and `drawn`, the
# provenance) and <id>.png, and prints the fit: how much of the guide's silhouette the drawing covers, how much of the
# drawing lies outside it, how many px the box crops away.
import base64, colorsys, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import RAMPS, guide, keyish, record, work

kit, tid, sheet = sys.argv[1:4]
opt = dict(zip(sys.argv[4::2], sys.argv[5::2]))
cell = opt.get('--from', tid)
cutdir = opt.get('--cut', work(kit, 'sheets', sheet, 'cut'))
edit = opt.get('--edit')
EDITS = edit.split('+') if edit else []
E = lambda p: next((e for e in EDITS if e.startswith(p)), None)   # several edits: --edit drift:1,-2+lamp:core
cells = json.load(open(work(kit, 'sheets', sheet, 'cells.json')))
meta = json.load(open(f'{cutdir}/cut.json'))
fm = meta['frames'][cell]
art = np.asarray(Image.open(f'{cutdir}/{cell}.png').convert('RGBA')).astype(int)
T = guide(kit, tid)                                   # the target: its box, normals, depth
if '--geo' in opt:   # normals and depth from another guide of the same box (a breath frame keeps the sleeper's own)
    Gx = guide(kit, opt['--geo'])
    assert [Gx[k] for k in ('w', 'h', 'ax', 'ay')] == [T[k] for k in ('w', 'h', 'ax', 'ay')], 'the --geo guide has another box'
    T = {**T, 'hit': Gx['hit'], 'normal': Gx['normal'], 'deep': Gx['deep']}
C = guide(kit, opt.get('--guide', cell)) if cell != tid else T   # the guide the drawing was drawn over

# --- the key's fringe: a key-ish px on the silhouette's edge goes (twice), and a px left alone
key = cells.get('key', 'green')
a = art[..., 3] > 0
for _ in range(2):
    edge = a & ~ndimage.binary_erosion(a, structure=np.ones((3, 3)), border_value=0)
    a &= ~(keyish(art[..., :3], key) & edge)
a &= ndimage.convolve(a.astype(int), np.ones((3, 3)), mode='constant') > 2
ys, xs = np.nonzero(a)
y0, x0 = ys.min(), xs.min()
art = art[y0:ys.max() + 1, x0:xs.max() + 1]; a = a[y0:ys.max() + 1, x0:xs.max() + 1]
sxr = meta.get('sx', 1)
s = meta['pitch'] / (cells['pitch'] * (Image.open(work(kit, 'sheets', sheet, 'raw', meta.get('src', 'out-1.png'))).width / cells['size'][0]
                                       if 'src' in meta else 1))
gx, gy = fm['gx'] + x0 * s, fm['gy'] + y0 * s     # art px (0, 0)'s corner, in the cell guide's px
# The cell guide's px -> the target's: the same ground point under both anchors.
dxT, dyT = T['ax'] - C['ax'], T['ay'] - C['ay']
if opt.get('--scale', '1') == 'auto' and abs(s - 1) > 0.03:
    ox = int(round(C['ax'] + (gx - C['ax']) / s)) + dxT; oy = int(round(C['ay'] + (gy - C['ay']) / s)) + dyT
else:
    ox = int(round(gx)) + dxT; oy = int(round(gy)) + dyT
if '--nudge' in opt:
    nx_, ny_ = map(int, opt['--nudge'].split(',')); ox += nx_; oy += ny_
W, H = T['w'], T['h']
rgb = np.zeros((H, W, 3), int); A = np.zeros((H, W), bool)
ah, aw = a.shape
lost = 0
for y in range(ah):
    for x in range(aw):
        if not a[y, x]: continue
        X, Y = x + ox, y + oy
        if 0 <= X < W and 0 <= Y < H: rgb[Y, X] = art[y, x, :3]; A[Y, X] = True
        else: lost += 1
hit = T['hit']
fit = {'scale': round(float(s), 3), 'offset': [ox, oy], 'cover': round(float((A & hit).sum() / hit.sum()), 3),
       'outside': round(float((A & ~hit).sum() / max(1, A.sum())), 3), 'cropped': lost,
       'drawn_wh': [int(aw), int(ah)], 'guide_wh': [int(np.ptp(np.nonzero(hit.any(0))[0]) + 1), int(np.ptp(np.nonzero(hit.any(1))[0]) + 1)]}

# --- frame edits that move px (before they get their normals and depth)
def cell_mat_at(mask_mats):
    """The target-box px whose nearest cell-guide px is one of `mask_mats` (the cell guide placed by the anchors)."""
    m = np.zeros((H, W), bool)
    ch, cw = C['hit'].shape
    src = np.isin(C['matname'], list(mask_mats)) & C['hit']
    _, (iy, ix) = ndimage.distance_transform_edt(~C['hit'], return_indices=True)
    for Y in range(H):
        for X in range(W):
            cy, cx = Y - dyT, X - dxT
            if 0 <= cy < ch and 0 <= cx < cw: m[Y, X] = src[iy[cy, cx], ix[cy, cx]]
    return m

lit = np.zeros((H, W), bool)
if E('drift:'):
    ddx, ddy = map(int, E('drift:')[6:].split(','))
    smoke = A & cell_mat_at(opt.get('--smoke-mat', 'rock').split(','))
    # only what lies above the chimney's top (the stone of the chimney is not smoke)
    srgb, sA = rgb.copy(), A.copy()
    A &= ~smoke
    for Y, X in zip(*np.nonzero(smoke)):
        if 0 <= Y + ddy < H and 0 <= X + ddx < W and not A[Y + ddy, X + ddx]:
            rgb[Y + ddy, X + ddx] = srgb[Y, X]; A[Y + ddy, X + ddx] = True
if E('breath:'):
    cut = int(E('breath:')[7:])
    srgb, sA = rgb.copy(), A.copy()
    for Y in range(cut, 0, -1):          # rows above the cut take the row above them: the back sinks a px
        rgb[Y], A[Y] = srgb[Y - 1], sA[Y - 1]
    rgb[0], A[0] = 0, False
if E('lamp:') or E('glow:') or E('dark:'):
    mats = (E('lamp:') or E('glow:') or E('dark:'))[5:].split(',')
    pane = A & np.isin(T['matname'], mats) & hit
    if '--within' in opt:
        # the drawing's own glass inside the box round the guide's <within> px (a window's rim): the bluish px there
        wm = np.isin(T['matname'], opt['--within'].split(',')) & hit
        if not wm.any() and C is not T:   # the target has none (a lamp put out): the drawing's own guide's, placed by the anchors
            wm = np.zeros((H, W), bool)
            cm = np.isin(C['matname'], opt['--within'].split(',')) & C['hit']
            for cy, cx in zip(*np.nonzero(cm)):
                if 0 <= cy + dyT < H and 0 <= cx + dxT < W: wm[cy + dyT, cx + dxT] = True
        g = int(opt.get('--grow', 1))
        box = np.zeros((H, W), bool)
        lab, n = ndimage.label(ndimage.binary_dilation(wm, iterations=2))   # each window or lantern its own box
        for sl in ndimage.find_objects(lab):
            box[max(0, sl[0].start - g):sl[0].stop + g, max(0, sl[1].start - g):sl[1].stop + g] = True
        glass = (rgb[..., 0] > rgb[..., 2] + 60) if opt.get('--glass') == 'warm' else (rgb[..., 2] > rgb[..., 0] + int(opt.get('--blue', 0)))
        pane = A & box & glass & (rgb.sum(-1) / 3 >= float(opt.get('--minlum', 0))) & (rgb.sum(-1) / 3 <= float(opt.get('--maxlum', 255)))
        if '--minsat' in opt:   # only the strongly coloured px (a rune's light, not the stone round it)
            mx, mn = rgb.max(-1), rgb.min(-1)
            pane &= (mx - mn) / np.maximum(mx, 1) >= float(opt['--minsat'])
    # The drawn panes: the px over the guide's panes, and their drawn neighbours as dark as the glass there.
    lum = rgb.sum(-1) / 3
    lit = pane
    if lit.any() and E('lamp:'):
        L = lum[lit]; lo, hi = np.percentile(L, 5), np.percentile(L, 95) + 1e-6
        t = np.clip((lum - lo) / (hi - lo), 0, 1)
        ramp = np.array([[196, 110, 32], [236, 160, 48], [255, 208, 80], [255, 236, 150], [255, 250, 222]])
        k = np.clip((t * 4.999).astype(int), 0, 4)
        rgb[lit] = ramp[k[lit]]
        if '--hot' in opt:   # the px over the guide's <hot> mats burn white-gold (a lens frame's lit side)
            hot = lit & ndimage.binary_dilation(np.isin(T['matname'], opt['--hot'].split(',')) & hit, iterations=1)
            rgb[hot] = [255, 252, 236]
    if lit.any() and E('dark:'):   # a lamp put out: its glass dark, nothing glows
        rgb[lit] = (rgb[lit] * 0.3).astype(int) + [22, 14, 34]
        lit = np.zeros_like(lit)

# --- --glows: more light, by the drawn px's own colour, each spec its own mask (unioned into `lit`):
#   "within=<mats/mats>,grow=n,glass=any|warm|cyan|pink|blue,minlum=n,maxlum=n,minsat=s,lamp=1,tint=pink|cyan;..."
#   within: the box round each cluster of the target guide's <mats> (the cell guide's, placed by the anchors, if the
#   target has none), grown by `grow` px; near=n instead: the guide's <mats> px themselves grown by n px; no `within`:
#   the whole box; box=x0/y0/x1/y1: that rectangle of the target's px. glass: which drawn colours are light (cyan: a
#   glowing gill or spot, pink: a rose one, rose: an unlit rose-grey tube, teal: an unlit cyan one,
#   ochre: an unlit paper lantern, violet: a vein, red: a red lamp, warm: lamplight, any: every px). lamp=1: the px become lamplight (the lamp
#   ramp); tint=pink|cyan|neon|violet|rose|red: the px take that light's ramp by their own lightness (a calm eye turned angry, a tube lit);
#   dark=1: the px put out instead (darkened, no glow). maxsat=s: only px no more saturated than s. minarea=n: lit clusters under n px (specks) stay unlit.
#   halo=1 (with tint/lamp): the px beside the lit ones take the ramp's second colour at 60 % and glow (a neon tube's halo).
# (RAMPS: kitlib.py)
for spec in filter(None, opt.get('--glows', '').split(';')):
    sp = dict(kv.split('=') for kv in spec.split(','))
    if 'within' in sp:
        ms = sp['within'].split('/')
        wm = np.isin(T['matname'], ms) & hit
        if not wm.any() and C is not T:
            wm = np.zeros((H, W), bool)
            for cy, cx in zip(*np.nonzero(np.isin(C['matname'], ms) & C['hit'])):
                if 0 <= cy + dyT < H and 0 <= cx + dxT < W: wm[cy + dyT, cx + dxT] = True
        if 'near' in sp:   # the guide's px themselves grown by `near` px (a winding vein: not its whole bounding box)
            box = ndimage.binary_dilation(wm, iterations=int(sp['near'])) if int(sp['near']) > 0 else wm
        else:
            g = int(sp.get('grow', 1)); box = np.zeros((H, W), bool)
            lab, n = ndimage.label(ndimage.binary_dilation(wm, iterations=2))
            for sl in ndimage.find_objects(lab):
                box[max(0, sl[0].start - g):sl[0].stop + g, max(0, sl[1].start - g):sl[1].stop + g] = True
    elif 'box' in sp:   # (round 3) an explicit box in the target's px, x0/y0/x1/y1: a lamp Codex added that no guide mat marks
        x0_, y0_, x1_, y1_ = map(int, sp['box'].split('/'))
        box = np.zeros((H, W), bool); box[y0_:y1_, x0_:x1_] = True
    else:
        box = np.ones((H, W), bool)
    r_, g_, b_ = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    glass = {'any': np.ones((H, W), bool), 'warm': r_ > b_ + 60, 'blue': b_ > r_ + 20,
             'cyan': (b_ > r_ + 70) & (b_ >= g_ - 12) & (g_ > r_ + 30),
             'pink': (r_ > g_ + 80) & (b_ > g_ + 30),
             'rose': (r_ > g_ + 25) & (b_ > g_ + 10) & (r_ >= b_ - 10),          # an unlit rose-grey neon tube
             'teal': (b_ > r_ + 25) & (g_ > r_ + 10),                           # an unlit cyan tube or globe
             'ochre': (r_ > b_ + 30) & (g_ > b_ + 15),                          # an unlit paper lantern
             'violet': (b_ > g_ + 15) & (r_ > g_),                              # a violet vein
             'red': (r_ > 2.2 * g_) & (r_ > 2.2 * b_) & (r_ > 170)}[sp.get('glass', 'any')]
    lum = rgb.sum(-1) / 3
    m = A & box & glass & (lum >= float(sp.get('minlum', 0))) & (lum <= float(sp.get('maxlum', 255)))
    mx, mn = rgb.max(-1), rgb.min(-1)
    if 'minsat' in sp: m &= (mx - mn) / np.maximum(mx, 1) >= float(sp['minsat'])
    if 'maxsat' in sp: m &= (mx - mn) / np.maximum(mx, 1) <= float(sp['maxsat'])
    if 'minarea' in sp:   # drop specks: a lit cluster smaller than minarea px (8-connected) is a stray edge px
        lab, n = ndimage.label(m, structure=np.ones((3, 3)))
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        m &= np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z >= int(sp['minarea'])])
    ramp = 'lamp' if sp.get('lamp') == '1' else sp.get('tint')
    if m.any() and ramp:
        L = lum[m]; lo, hi = np.percentile(L, 5), np.percentile(L, 95) + 1e-6
        k = np.clip((np.clip((lum - lo) / (hi - lo), 0, 1) * 4.999).astype(int), 0, 4)
        rgb[m] = np.array(RAMPS[ramp])[k[m]]
    if m.any() and sp.get('halo') == '1' and ramp:   # the tube's own glow on the px beside it (4-neighbours), half its light
        h = ndimage.binary_dilation(m, structure=ndimage.generate_binary_structure(2, 1)) & A & ~m
        rgb[h] = (rgb[h] * 0.4 + np.array(RAMPS[ramp][1]) * 0.6).astype(int)
        m = m | h
    if sp.get('dark') == '1':   # put out: darkened, no glow
        rgb[m] = (rgb[m] * 0.3).astype(int) + [22, 14, 34]
    else:
        lit = lit | m

# --- normal and depth: the guide's at the same px; where the drawing reaches past the guide, the nearest guide px's
# normal, and its depth carried along the row difference (a px a row lower lies a px nearer, at the same height)
_, (iy, ix) = ndimage.distance_transform_edt(~hit, return_indices=True)
NY, NX = iy, ix
nrm = T['normal'][NY, NX]
q = (T['deep'][NY, NX].astype(float) - 128) / 4 + (np.arange(H)[:, None] - NY)
deep = np.where(A, np.clip(np.round(q * 4) + 128, 1, 255), 0).astype(np.uint8)

out = record(rgb, A, lit, nrm, deep, T, f'codex image_gen, sheet {sheet} ({cell}, pitch {round(meta["pitch"], 2)})' + (f', a pixel edit: {edit}' if edit else ''), float(opt.get('--tol', 15)))
os.makedirs(work(kit, 'build'), exist_ok=True)
json.dump(out, open(work(kit, 'build', f'{tid}.json'), 'w'))
json.dump(fit, open(work(kit, 'build', f'{tid}.fit.json'), 'w'))
Image.fromarray(np.dstack([rgb, A * 255]).astype(np.uint8), 'RGBA').save(work(kit, 'build', f'{tid}.png'))
print(tid, f'{W}x{H}', 'anchor', T['ax'], T['ay'], 'colours', len(out['pal']), 'glowing', len(out['glow']), 'normals', len(out['npal']), 'fit', fit)
