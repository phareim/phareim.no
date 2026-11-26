# kitlib.py: what the realm-kit tools share: where things are, the guides, the key colour.
import base64, importlib.util, json, os, sys
import numpy as np

TOOLS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(TOOLS, '..', '..', '..'))
ISO = os.path.join(REPO, 'themes', 'zelda', 'render', 'iso')


def work(kit, *parts):
    """The kit's work dir: tmp/codex-kits/<kit>/... in the repo (git-ignored); CODEX_WORK moves the root."""
    root = os.environ.get('CODEX_WORK', os.path.join(REPO, 'tmp', 'codex-kits'))
    return os.path.join(root, kit, *parts)


def plan(kit):
    """The kit's plan (plans/<kit>.py): its sheets, what each holds, at which pitch, and the prompt's words."""
    sys.path.insert(0, os.path.join(TOOLS, 'plans'))
    spec = importlib.util.spec_from_file_location(f'plan_{kit}', os.path.join(TOOLS, 'plans', f'{kit}.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    return mod


def guide(kit, gid):
    """A piece's guide (kit-guides.mjs): rgb, hit, normal (h, w, 3 bytes), glow, deep (the depth byte), mat names, solid."""
    g = json.load(open(work(kit, 'guides', f'{gid}.json')))
    w, h = g['w'], g['h']
    b = lambda k, dt=np.uint8: np.frombuffer(base64.b64decode(g[k]), dt)
    g['normal'] = b('normal').reshape(h, w, 3)
    g['glow'] = b('glow').reshape(h, w)
    g['deep'] = b('deep').reshape(h, w)
    m = b('mat').reshape(h, w)
    g['matname'] = np.array([g['mats'][i] if i != 255 else '' for i in m.ravel()], dtype=object).reshape(h, w)
    g['solid'] = b('solid', '<u2').reshape(h, w).astype(int)
    g['hit'] = g['deep'] > 0
    return g


# The key: the flat colour round the objects on a sheet. Green (#00FF00) by default; magenta (#FF00FF) for kits full
# of grass and moss, whose greens a green key would eat.
KEYS = {'green': (0, 255, 0), 'magenta': (255, 0, 255)}


def keyed(im, key):
    """Which px of an RGB float image are the key (the background), not the drawing."""
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    if key == 'green':
        return (g > r + 70) & (g > b + 70) & (r < 120)
    return (r > 170) & (b > 170) & (g < 95) & (np.abs(r - b) < 70)


def keyish(rgb, key):
    """A fringe px: a blend of the key into the drawing's edge (looser than `keyed`)."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if key == 'green':
        return (g > r + 50) & (g > b + 50) & (g > 140)
    return (r > 150) & (b > 150) & (g < r - 60) & (g < b - 60)


# The light ramps a lit px takes by its own lightness (kitbuild.py --glows lamp=1 / tint=..., kittext.py), dark to hot.
RAMPS = {'lamp': [[196, 110, 32], [236, 160, 48], [255, 208, 80], [255, 236, 150], [255, 250, 222]],
         'pink': [[110, 14, 70], [192, 30, 112], [255, 74, 168], [255, 150, 210], [255, 226, 244]],
         'cyan': [[10, 106, 138], [26, 170, 210], [47, 243, 255], [150, 250, 255], [224, 255, 255]],
         'violet': [[70, 30, 140], [120, 60, 210], [170, 110, 255], [210, 170, 255], [240, 225, 255]],
         'neon': [[120, 16, 120], [200, 36, 170], [255, 70, 200], [255, 150, 228], [255, 232, 250]],
         'rose': [[120, 40, 64], [190, 70, 100], [236, 120, 148], [255, 180, 200], [255, 232, 238]],   # round 3: the rose lantern
         'red': [[120, 16, 16], [190, 34, 30], [255, 58, 58], [255, 140, 120], [255, 222, 210]]}       # a red lamp


def record(rgb, A, lit, nrm, deep, box, drawn, tol=15.0):
    """A ThingArt record of a drawing in its box: the drawing's colours (a colour within `tol` of a commoner one is that
    one: the image's noise; never capped), glow only on the `lit` px (a lamp's light, never paint), every px's normal
    (`nrm`, the atlas's rgb encoding) and depth byte (`deep`) as given, and `drawn`, where it came from."""
    H, W = A.shape
    px = rgb[A].astype(float); cnt = {}
    for c in map(tuple, (px // 3).astype(int)): cnt[c] = cnt.get(c, 0) + 1
    cent = []
    for c, n in sorted(cnt.items(), key=lambda kv: -kv[1]):
        c = np.array(c) * 3 + 1
        if not cent or np.min(np.linalg.norm(np.array(cent) - c, axis=1)) > tol: cent.append(c)
    cent = np.array(cent, float)
    for _ in range(3):   # a few rounds of k-means from there, so each colour is its px's median
        lab = np.argmin(((px[:, None, :] - cent[None]) ** 2).sum(-1), axis=1)
        cent = np.array([np.median(px[lab == i], axis=0) if (lab == i).any() else cent[i] for i in range(len(cent))])
    lab = np.argmin(((px[:, None, :] - cent[None]) ** 2).sum(-1), axis=1)
    litpx = lit[A]
    # A lit px's colour is a colour of its own (a lamp and the paint never share a palette letter).
    key_of = [(int(l), bool(g)) for l, g in zip(lab, litpx)]
    count = {}
    for k in key_of: count[k] = count.get(k, 0) + 1
    uniq = sorted(count, key=lambda k: -count[k])
    LET = [chr(c) for c in range(33, 127) if chr(c) != '.'] + [chr(c) for c in range(256, 256 + 4000)]
    ch_of = {k: LET[i] for i, k in enumerate(uniq)}
    pal = {ch_of[k]: '#%02x%02x%02x' % tuple(np.round(cent[k[0]] if not k[1] else np.median(px[(lab == k[0]) & litpx], axis=0)).astype(int)) for k in uniq}
    glow = {ch_of[k]: 1.0 if np.mean(cent[k[0]]) > 200 else 0.8 for k in uniq if k[1]}
    rows = [['.'] * W for _ in range(H)]
    for (y, x), k in zip(zip(*np.nonzero(A)), key_of): rows[y][x] = ch_of[k]
    codes = ['#%02x%02x%02x' % tuple(n) for n in nrm[A]]
    npal = list(dict.fromkeys(codes)); nidx = {c: i for i, c in enumerate(npal)}
    nrows = [['.'] * W for _ in range(H)]
    for (y, x), c in zip(zip(*np.nonzero(A)), codes): nrows[y][x] = chr(48 + nidx[c])
    return {'w': W, 'h': H, 'ax': box['ax'], 'ay': box['ay'], 'pal': pal, 'glow': glow, 'rows': [''.join(r) for r in rows],
            'nrows': [''.join(r) for r in nrows], 'npal': npal, 'deep': base64.b64encode(np.asarray(deep, np.uint8).tobytes()).decode(),
            'drawn': drawn}
