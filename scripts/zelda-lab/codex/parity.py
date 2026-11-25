# parity.py <png>...: edge parity across x and y (0.5 = edges anywhere: one pixel scale; near 1 = 2 x 2 blocks)
import sys, numpy as np
from PIL import Image
for f in sys.argv[1:]:
    a = np.asarray(Image.open(f).convert('RGBA')).astype(int); res = []
    for ax in (1, 0):
        d = np.abs(np.diff(a, axis=ax)).sum(-1) > 40
        idx = np.nonzero(d)[ax] if ax == 1 else np.nonzero(d)[0]
        p = (idx % 2).mean(); res.append(round(max(p, 1 - p), 2))
    print(f.split('/')[-1], a.shape[1], 'x', a.shape[0], 'parity x/y', res)
