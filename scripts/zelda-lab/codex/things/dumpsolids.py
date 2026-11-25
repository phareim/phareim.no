# dumpsolids.py <out.json> <thing>...: each guide's solids as plain data (for blender/solids_glb.py)
import json, os, sys
import numpy as np
import tempfile
sys.argv = [sys.argv[0], tempfile.mkdtemp(prefix='codex-solids-')] + sys.argv[1:]
sys.path.insert(0, os.path.dirname(__file__))
import things
from solids import Box, Cyl, Ell, Prism, Seg, Torus
out, names = sys.argv[2], sys.argv[3:]
def col(p):
    m = p.mat
    if callable(m):
        try: m = m((0.0, 0.0, 5.0), np.array([0, 0, 1.0]))
        except Exception: m = 'stone'
    return things.MAT.get(m, ('#888888', 0))[0]
res = {}
for n in names:
    P, zmax, _ = things.THINGS[n]()
    L = []
    for p in P:
        d = {'type': type(p).__name__, 'color': col(p)}
        for k, v in p.__dict__.items():
            if k == 'mat': continue
            d[k] = v.tolist() if isinstance(v, np.ndarray) else v
        L.append(d)
    res[n] = L
json.dump(res, open(out, 'w'))
print(len(res), 'things')
