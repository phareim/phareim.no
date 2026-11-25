# Cut a Codex boss sheet into frames, part 22: green key; ONE pixel pitch for the whole sheet (searched, the drawing's
# own grid); per frame the best grid phase; the median colour of each block's middle; hard alpha. Colours are only
# merged where they are the same colour under the image's noise (within TOL), never capped.
# The key is the sheet's (cells.json `key`: green or magenta, kitlib.py). Writes <outdir>/<cell>.png and cut.json (the
# pitch, and per cell where its art-px grid starts, gx/gy, in guide px from the cell's corner).
# cut2.py <sheet.png> <cells.json> <outdir> [pitch]
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import keyed
src, cells, outdir = sys.argv[1], json.load(open(sys.argv[2])), sys.argv[3]
os.makedirs(outdir, exist_ok=True)
im = np.asarray(Image.open(src).convert('RGB')).astype(float)
H, W, _ = im.shape
sx, sy = W / cells['size'][0], H / cells['size'][1]
green = keyed(im, cells.get('key', 'green'))   # (named green for history: the key, whatever its colour)
def boxes():
    for name, (x0, y0, x1, y1) in cells['cells'].items():
        pad = cells.get('pad', 30)
        X0, Y0 = max(0, int((x0 - pad) * sx)), max(0, int((y0 - pad) * sy))
        X1, Y1 = min(W, int((x1 + pad) * sx)), min(H, int((y1 + pad) * sy))
        m = ~green[Y0:Y1, X0:X1]; ys, xs = np.nonzero(m)
        yield name, (X0 + xs.min(), Y0 + ys.min(), X0 + xs.max() + 1, Y0 + ys.max() + 1)
BOX = dict(boxes())
def sample(bb, pitch, ox, oy):
    # every block at once: a fixed 3 x 3 px window at each block's centre, so no pitch is favoured by its window's size
    bx0, by0, bx1, by1 = bb
    nx = int(np.ceil((bx1 - bx0) / pitch)) + 2; ny = int(np.ceil((by1 - by0) / pitch)) + 2
    cx = np.round(bx0 - pitch + ox + np.arange(nx) * pitch + pitch / 2 - 1.5).astype(int)
    cy = np.round(by0 - pitch + oy + np.arange(ny) * pitch + pitch / 2 - 1.5).astype(int)
    X = np.clip(cx[None, :, None, None] + np.arange(3)[None, None, None, :], 0, W - 1)
    Y = np.clip(cy[:, None, None, None] + np.arange(3)[None, None, :, None], 0, H - 1)
    X, Y = np.broadcast_arrays(X, Y)                      # (ny, nx, 3, 3)
    blk = im[Y, X].reshape(ny, nx, 9, 3); gm = green[Y, X].reshape(ny, nx, 9)
    keep = gm.mean(-1) <= 0.5
    masked = np.where(gm[..., None], np.nan, blk)
    med = np.nanmedian(np.where(keep[..., None, None], masked, 0.0), axis=2)
    dev = np.abs(masked - med[:, :, None, :])
    err = float(np.nansum(np.where(keep[..., None, None], dev, 0.0)))
    out = np.zeros((ny, nx, 4)); out[..., :3] = np.where(keep[..., None], med, 0); out[..., 3] = keep * 255
    return out, err
def best(bb, pitch, n=5):
    res = None
    for ox in np.linspace(0, pitch, n, endpoint=False):
        for oy in np.linspace(0, pitch, n, endpoint=False):
            o, e = sample(bb, pitch, ox, oy)
            if res is None or e < res[1]: res = (o, e, ox, oy)
    return res
big = max(BOX, key=lambda k: (BOX[k][2] - BOX[k][0]) * (BOX[k][3] - BOX[k][1]))
if len(sys.argv) > 4: pitch = float(sys.argv[4])
else:
    # the sheet's own grid: the pitch whose blocks are flattest on the biggest frame (error per covered px)
    tries = []
    nom = cells['pitch'] * sx
    for p in np.arange(nom * 0.8, nom * 1.25, 0.05):
        o, e, _, _ = best(BOX[big], p, 4)
        tries.append((e / max(1, (o[..., 3] > 0).sum() * 9), p))
    tries.sort(); pitch = tries[0][1]
    print('pitch tries', [(round(p, 2), round(e, 2)) for e, p in tries[:6]])
print('pitch', round(pitch, 3), 'nominal', round(cells['pitch'] * sx, 3))
meta = {'pitch': pitch, 'frames': {}}
for name, bb in BOX.items():
    o, e, ox, oy = best(bb, pitch, 6)
    ys, xs = np.nonzero(o[..., 3])
    # where the frame's art-px grid starts, in sheet px (to place it back on its cell)
    gx = bb[0] - pitch + ox + xs.min() * pitch; gy = bb[1] - pitch + oy + ys.min() * pitch
    o = o[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    Image.fromarray(o.astype('uint8'), 'RGBA').save(f'{outdir}/{name}.png')
    c = cells['cells'][name]
    meta['frames'][name] = {'w': o.shape[1], 'h': o.shape[0], 'gx': (gx / sx - c[0]) / cells['pitch'], 'gy': (gy / sy - c[1]) / cells['pitch'], 'err': e}
    print(name, o.shape[1], 'x', o.shape[0], 'at art', round(meta['frames'][name]['gx'], 1), round(meta['frames'][name]['gy'], 1))
json.dump(meta, open(f'{outdir}/cut.json', 'w'), indent=1)
