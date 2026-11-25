# composite.py <cutdir> <outdir> <kind> <base> <frame>...: each frame = the base frame's still px (stones, logs) with the
# frame's own flame px over them, placed on the base's grid; every px still one of the drawings'. cut.json follows.
import colorsys, json, os, shutil, sys
import numpy as np
from PIL import Image
cd, od, kind, base, frames = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5:]
os.makedirs(od, exist_ok=True)
meta = json.load(open(f'{cd}/cut.json')); p = meta['pitch'] / 10
def flame(c):
    h, s, v = colorsys.rgb_to_hsv(*(c[:3] / 255))
    if kind == 'campfire': return (v > 0.72 and s > 0.35 and (h < 0.17 or h > 0.97)) or (v > 0.93 and s < 0.35)
    return (v > 0.72 and 0.45 < h < 0.7 and s > 0.25) or (v > 0.93 and s < 0.2)
B = np.asarray(Image.open(f'{cd}/{base}.png').convert('RGBA')).astype(int); bm = meta['frames'][base]
shutil.copy(f'{cd}/{base}.png', f'{od}/{base}.png'); out = {'pitch': meta['pitch'], 'frames': {base: bm}}
bf = np.array([[B[y, x, 3] > 0 and flame(B[y, x]) for x in range(B.shape[1])] for y in range(B.shape[0])])
for f in frames:
    F = np.asarray(Image.open(f'{cd}/{f}.png').convert('RGBA')).astype(int); fm = meta['frames'][f]
    dx = int(round((fm['gx'] - bm['gx']) / p)); dy = int(round((fm['gy'] - bm['gy']) / p))
    # a canvas holding both
    x0, y0 = min(0, dx), min(0, dy); x1, y1 = max(B.shape[1], dx + F.shape[1]), max(B.shape[0], dy + F.shape[0])
    C = np.zeros((y1 - y0, x1 - x0, 4), int)
    # the frame's own drawing first, then the base's stones and logs over its own wherever the base has them and the
    # frame has no flame there (so nothing under a flame is lost, and what does not burn is the base's, px for px)
    ff = np.array([[F[y, x, 3] > 0 and flame(F[y, x]) for x in range(F.shape[1])] for y in range(F.shape[0])])
    C[dy - y0:dy - y0 + F.shape[0], dx - x0:dx - x0 + F.shape[1]][F[..., 3] > 0] = F[F[..., 3] > 0]
    fflame = np.zeros(C.shape[:2], bool); fflame[dy - y0:dy - y0 + F.shape[0], dx - x0:dx - x0 + F.shape[1]] = ff
    sb = np.zeros(C.shape[:2], bool); sb[-y0:-y0 + B.shape[0], -x0:-x0 + B.shape[1]] = (B[..., 3] > 0) & ~bf
    BB = np.zeros_like(C); BB[-y0:-y0 + B.shape[0], -x0:-x0 + B.shape[1]] = B
    take = sb & ~fflame
    C[take] = BB[take]
    Image.fromarray(C.astype('uint8'), 'RGBA').save(f'{od}/{f}.png')
    out['frames'][f] = {**bm, 'gx': bm['gx'] + x0 * p, 'gy': bm['gy'] + y0 * p, 'w': C.shape[1], 'h': C.shape[0]}
    print(f, 'flame from its own drawing, the rest from', base, 'offset', dx, dy)
json.dump(out, open(f'{od}/cut.json', 'w'), indent=1)
