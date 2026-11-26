# kitbeam.py: the lighthouse's turning beam (fjord_lighthouse_0..3) drawn over the tower Codex already drew.
#   kitbeam.py guide   -> guides/fjord_lighthouse_beam_<k>.png: in frame k's box, the drawn lens tower
#                         (fjord_lighthouse_lens_<k> as baked in the fjord art pack, placed by the anchors) and, where the
#                         solids' beam is, its cone filled with one flat cream placeholder (sheet.py lays these out)
#   kitbeam.py build   -> build/fjord_lighthouse_<k>.json: the baked lens tower's own px (colours, glow, normals,
#                         depth), and around it only Codex's beam px (from kitbuild.py's placing of the sheet's drawing,
#                         build/fjord_lighthouse_<k>.png), inside the cone grown by 3 px; every beam px glows and takes
#                         the beam solids' normal and depth (nearest guide px), as kitbuild.py gives any drawn px.
# Every px that ships is Codex-drawn: the tower from the first round's lens sheet, the beam from this sheet.
import base64, json, os, subprocess, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import ISO, guide, record, work

KIT = 'fjord'
BEAM_MATS = ['core', 'glassCyan']
CREAM = (232, 216, 160)


def baked(group='fjord'):
    """The kit as the game has it: its pinned art pack read back as ThingArt records (art-pack.mjs unpack)."""
    repo = os.path.abspath(os.path.join(ISO, '..', '..', '..', '..'))  # (kitlib's REPO)
    out = subprocess.run(['node', os.path.join(repo, 'scripts', 'zelda-lab', 'art-pack.mjs'), 'unpack', group], check=True, capture_output=True, text=True)
    return json.loads(out.stdout)


def unrec(r):
    """A ThingArt record as arrays: rgb, alpha, glow (per px), normal codes (rgb bytes), depth."""
    H, W = r['h'], r['w']
    rgb = np.zeros((H, W, 3), int); A = np.zeros((H, W), bool); gl = np.zeros((H, W), bool); nrm = np.zeros((H, W, 3), np.uint8)
    for y in range(H):
        for x in range(W):
            c = r['rows'][y][x]
            if c == '.': continue
            h = r['pal'][c]; rgb[y, x] = [int(h[i:i + 2], 16) for i in (1, 3, 5)]; A[y, x] = True; gl[y, x] = c in r['glow']
            n = r['npal'][ord(r['nrows'][y][x]) - 48]; nrm[y, x] = [int(n[i:i + 2], 16) for i in (1, 3, 5)]
    deep = np.frombuffer(base64.b64decode(r['deep']), np.uint8).reshape(H, W)
    return rgb, A, gl, nrm, deep


def placed(k):
    """Frame k's target guide, and the baked lens tower moved into its box (the same ground point under both anchors)."""
    T = guide(KIT, f'fjord_lighthouse_{k}')
    lens = baked()[f'fjord_lighthouse_lens_{k}']
    assert 'drawn' in lens, 'the lens frame is not drawn yet'
    rgb, A, gl, nrm, deep = unrec(lens)
    ox, oy = T['ax'] - lens['ax'], T['ay'] - lens['ay']
    H, W = T['h'], T['w']
    out = [np.zeros((H, W, 3), int), np.zeros((H, W), bool), np.zeros((H, W), bool), np.zeros((H, W, 3), np.uint8), np.zeros((H, W), np.uint8)]
    for y, x in zip(*np.nonzero(A)):
        Y, X = y + oy, x + ox
        if 0 <= Y < H and 0 <= X < W:
            out[0][Y, X] = rgb[y, x]; out[1][Y, X] = True; out[2][Y, X] = gl[y, x]; out[3][Y, X] = nrm[y, x]; out[4][Y, X] = deep[y, x]
    return T, out


def cone(T, tower):
    """The solids' beam px outside the tower, as one clean straight cone (no dither)."""
    b = np.isin(T['matname'], BEAM_MATS) & T['hit'] & ~ndimage.binary_dilation(tower, iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(b, iterations=2))
    if n > 1:   # keep the beam (the biggest), not a lit pane on the lamp room's edge
        sizes = ndimage.sum(b, lab, range(1, n + 1)); b &= lab == 1 + int(np.argmax(sizes))
    # A clean straight cone: the beam px's main axis (t along, u across), the half-width a straight line in t
    # fitted to the outermost px of each stretch, every px of the box inside it.
    ys, xs = np.nonzero(b); P = np.stack([xs, ys], 1).astype(float); m0 = P.mean(0)
    v = np.linalg.svd(P - m0, full_matrices=False)[2][0]
    t = (P - m0) @ v; u = (P - m0) @ np.array([-v[1], v[0]])
    if abs(t.min()) > abs(t.max()): v = -v; t = -t; u = -u   # t grows away from the tower: the far end is +t
    bins = np.linspace(t.min(), t.max(), 9); tb, hb = [], []
    for lo, hi in zip(bins[:-1], bins[1:]):
        k = (t >= lo) & (t <= hi)
        if k.any(): tb.append((lo + hi) / 2); hb.append(np.abs(u[k]).max())
    slope, icpt = np.polyfit(tb, hb, 1)
    H_, W_ = b.shape; YY, XX = np.mgrid[0:H_, 0:W_]
    Q = np.stack([XX, YY], -1).astype(float) - m0
    tt = Q @ v; uu = Q @ np.array([-v[1], v[0]])
    c = (tt >= t.min()) & (tt <= t.max()) & (np.abs(uu) <= np.maximum(0.8, icpt + slope * tt) + 0.5)
    return c & ~tower


mode = sys.argv[1]
for k in range(4):
    T, (rgb, A, gl, nrm, deep) = placed(k)
    c = cone(T, A)
    if mode == 'guide':
        im = np.zeros((T['h'], T['w'], 4), np.uint8)
        im[A, :3] = rgb[A]; im[A, 3] = 255
        im[c, :3] = CREAM; im[c, 3] = 255
        Image.fromarray(im, 'RGBA').save(work(KIT, 'guides', f'fjord_lighthouse_beam_{k}.png'))
        print(k, T['w'], T['h'], 'tower px', int(A.sum()), 'cone px', int(c.sum()))
    else:
        d = np.asarray(Image.open(work(KIT, 'build', f'fjord_lighthouse_{k}.png')).convert('RGBA')).astype(int)
        lum = d[..., :3].sum(-1) / 3
        beam = (d[..., 3] > 0) & ~A & ndimage.binary_dilation(c, iterations=3) & (lum > 90)
        lab, n = ndimage.label(beam, structure=np.ones((3, 3)))   # specks off
        if n:
            sizes = ndimage.sum(beam, lab, range(1, n + 1)); beam &= np.isin(lab, [i + 1 for i, z in enumerate(sizes) if z >= 3])
        hit = T['hit']
        _, (NY, NX) = ndimage.distance_transform_edt(~hit, return_indices=True)
        q = (T['deep'][NY, NX].astype(float) - 128) / 4 + (np.arange(T['h'])[:, None] - NY)
        bdeep = np.clip(np.round(q * 4) + 128, 1, 255).astype(np.uint8)
        allA = A | beam
        out_rgb = np.where(A[..., None], rgb, d[..., :3])
        out_n = np.where(A[..., None], nrm, T['normal'][NY, NX])
        out_d = np.where(A, deep, np.where(beam, bdeep, 0)).astype(np.uint8)
        lit = (A & gl) | beam
        r = record(out_rgb, allA, lit, out_n, out_d, T, f'codex image_gen: the tower fjord_lighthouse_lens_{k} as baked, the beam from sheet beam{k} (kitbeam.py)', tol=6)
        json.dump(r, open(work(KIT, 'build', f'fjord_lighthouse_{k}.json'), 'w'))
        Image.fromarray(np.dstack([out_rgb, allA * 255]).astype(np.uint8), 'RGBA').save(work(KIT, 'build', f'fjord_lighthouse_{k}.png'))
        print(f'fjord_lighthouse_{k}', T['w'], T['h'], 'tower px', int(A.sum()), 'beam px', int(beam.sum()), 'of cone', int(c.sum()), 'colours', len(r['pal']), 'glowing', len(r['glow']))
