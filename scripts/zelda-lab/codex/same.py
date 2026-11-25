# same.py <dirA> <dirB> [suffixB]: per still, identical or how many px differ (>0, >24 levels)
import sys, os, glob, numpy as np
from PIL import Image
A, B = sys.argv[1], sys.argv[2]; suf = sys.argv[3] if len(sys.argv) > 3 else ''
for f in sorted(glob.glob(A + '/*.png')):
    n = os.path.basename(f); g = os.path.join(B, n.replace('.png', suf + '.png') if suf else n)
    if not os.path.exists(g): print(n, 'MISSING in B'); continue
    a = np.asarray(Image.open(f).convert('RGB')).astype(int); b = np.asarray(Image.open(g).convert('RGB')).astype(int)
    d = np.abs(a - b).max(-1); print(n, 'identical' if not d.any() else f'differs: {int((d > 0).sum())} px, {int((d > 24).sum())} px > 24')
