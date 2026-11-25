# align.py <base> <frame>...: place each frame of an animation on the first by the best match of what does not move
# (the px that do not glow, the lower part), so the stones or the stone basin stay put between frames; writes ax, ay.
import json, os, sys, numpy as np
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from kitlib import REPO, work
R = work('things')   # Part 23's work dir: tmp/codex-kits/things (guides/, sheets/, build/, classic/, archive/)
def load(t):
    j = json.load(open(f'{R}/build/{t}.json')); pal = {k: np.array([int(v[i:i + 2], 16) for i in (1, 3, 5)]) for k, v in j['pal'].items()}
    img = np.full((j['h'], j['w'], 3), -1000); still = np.zeros((j['h'], j['w']), bool)
    for y, r in enumerate(j['rows']):
        for x, ch in enumerate(r):
            if ch != '.': img[y, x] = pal[ch]; still[y, x] = ch not in j['glow']
    return j, img, still
bj, bi, bs = load(sys.argv[1])
for t in sys.argv[2:]:
    j, im, st = load(t); best = None
    for dy in range(-4, 5):
        for dx in range(-4, 5):
            # frame px (x, y) lands on base px (x + bx - fx, ...) where the anchors meet, shifted by (dx, dy)
            ox = bj['ax'] - j['ax'] + dx; oy = bj['ay'] - j['ay'] + dy
            sc = 0; n = 0
            for y in range(j['h']):
                by = y + oy
                if by < 0 or by >= bj['h'] or y < j['h'] * 0.45: continue
                for x in range(j['w']):
                    bx = x + ox
                    if bx < 0 or bx >= bj['w'] or not st[y, x] or not bs[by, bx]: continue
                    sc += np.abs(im[y, x] - bi[by, bx]).sum() < 30; n += 1
            if best is None or sc > best[0]: best = (sc, dx, dy, n)
    sc, dx, dy, n = best
    j['ax'] -= dx; j['ay'] -= dy
    json.dump(j, open(f'{R}/build/{t}.json', 'w'))
    print(t, 'moved', dx, dy, 'match', sc, 'of', n)
