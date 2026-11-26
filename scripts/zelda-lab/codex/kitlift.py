# kitlift.py <kit> <id> <ground-solids>: a piece that goes down into the ground (the root stair): every drawn px that lies
# below the ground plane gets the ground's depth at that px (+1), so the ground the engine draws does not hide it.
# The ground's depth is fitted (plane in row, col) to the guide's px drawn by the solid calls <ground-solids> (a-b: the
# rim round the hole, at z 0). Writes the build record back.
import base64, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kitlib import guide, work
kit, gid, rng = sys.argv[1:4]
a, b = map(int, rng.split('-'))
g = guide(kit, gid)
m = g['hit'] & (g['solid'] >= a) & (g['solid'] <= b) & (g['normal'][:, :, 1] > 200)
ys, xs = np.nonzero(m)
A = np.c_[ys, xs, np.ones_like(ys)].astype(float)
coef, *_ = np.linalg.lstsq(A, g['deep'][m].astype(float), rcond=None)
p = work(kit, 'build', f'{gid}.json'); r = json.load(open(p))
d = np.frombuffer(base64.b64decode(r['deep']), np.uint8).reshape(r['h'], r['w']).astype(int)
R, C = np.mgrid[0:r['h'], 0:r['w']]
fit = np.rint(coef[0] * R + coef[1] * C + coef[2]).astype(int) + 1
drawn = np.array([[ch in r['pal'] for ch in row] for row in r['rows']])
low = drawn & (d > 0) & (d < fit)
d[low] = np.clip(fit[low], 1, 255)
r['deep'] = base64.b64encode(d.astype(np.uint8).tobytes()).decode()
json.dump(r, open(p, 'w'))
print(gid, 'ground plane', np.round(coef, 3), 'lifted', int(low.sum()), 'px of', int((d > 0).sum()))
