"""Seter Fell's layout (72x52). Writes rows to stdout as JSON; seterfell_ts.py turns them into the map file."""
import json, math, random

W, H = 72, 52
g = [['.'] * W for _ in range(H)]
rnd = random.Random(7)


def put(x, y, ch):
    if 0 <= x < W and 0 <= y < H:
        g[y][x] = ch


def rect(x0, y0, x1, y1, ch):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            put(x, y, ch)


def blob(cx, cy, rx, ry, ch, rough=0.18, keep=None):
    for y in range(int(cy - ry - 2), int(cy + ry + 3)):
        for x in range(int(cx - rx - 2), int(cx + rx + 3)):
            d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
            if d <= 1 + rnd.uniform(-rough, rough) and (keep is None or g[y][x] in keep if 0 <= y < H and 0 <= x < W else False):
                put(x, y, ch)


def scatter(x0, y0, x1, y1, ch, p, on='.'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            if 0 <= y < H and 0 <= x < W and g[y][x] in on and rnd.random() < p:
                g[y][x] = ch


def path(pts, ch=',', width=1, over=None, four=False):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(abs(x1 - x0), abs(y1 - y0))
        px, py = x0, y0
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            if four and x != px and y != py:
                put(x, py, ch)     # a diagonal step gets its corner, so water and roads stay joined side to side
            px, py = x, y
            for dx in range(width):
                for dy in range(width):
                    if over is None or g[y + dy][x + dx] in over:
                        put(x + dx, y + dy, ch)


def stamp(x, y, rows):
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch != ' ':
                put(x + i, y + j, ch)


# ---- the land: grass, birch woods, heath ---------------------------------------------------------------
scatter(2, 2, 69, 49, ';', 0.06)
scatter(2, 2, 69, 49, ':', 0.035)

# ---- rims -----------------------------------------------------------------------------------------------
rect(0, 0, W - 1, 1, '#')                       # the tops to the north
for x in range(W):                               # a ragged mountain band
    for y in range(2, 2 + rnd.choice([0, 1, 1, 2])):
        put(x, y, '#')
rect(0, 0, 1, H - 1, 'T')                        # birch wood west (the Wildwood's crowns below)
rect(W - 2, 0, W - 1, H - 1, 'T')                # the hills east
rect(0, H - 2, W - 1, H - 1, '#')                # the fell's edge over the town and the woods

# ---- CAIRN RIDGE: the tarn, the ridge path, cairns, the lookout ------------------------------------------
blob(9, 6, 4.5, 2.6, '~', 0.1)
for x, y in [(4, 5), (14, 6), (6, 9), (12, 9), (5, 7)]:
    put(x, y, ';')
# The tarn's stream: south past the mounds to the pasture pond.
stream = [(12, 8), (13, 10), (15, 13), (16, 15), (15, 17), (13, 20), (13, 23), (15, 26), (16, 29), (15, 32), (15, 34), (16, 37), (17, 40)]
path(stream, '~', four=True)
# Mountain shoulders on the ridge, and the cliff band over the Big Seter (a gap for the steps, the ledge).
for cx, cy, rx, ry in [(36, 4, 4, 1.6), (44, 3, 3, 1.3), (60, 4, 6, 2.2), (17, 3, 3, 1.2)]:
    blob(cx, cy, rx, ry, '#', 0.15)
rect(26, 12, 53, 13, '#')
rect(30, 12, 31, 13, ',')                        # the steps down to the seter
put(45, 12, '.'); put(45, 13, '.')               # a goat track down to the ledge
rect(43, 14, 47, 16, '#'); rect(44, 14, 46, 15, '.')   # the ledge: seen from the seter, reached from the ridge
scatter(18, 5, 52, 11, ':', 0.12)
scatter(18, 5, 52, 11, ';', 0.10)
# The ridge path: the north pass, the cairns, the lookout, the steps.
path([(23, 0), (23, 6), (28, 7), (36, 8), (44, 8), (49, 7)])
path([(30, 8), (30, 11)])
rect(22, 0, 24, 3, ',')
# The lookout's knoll east of the ridge path.
blob(51, 8, 2.5, 1.6, ':', 0.1)

# ---- THE MOUNDS (west of the stream) ---------------------------------------------------------------------
MOUND = [' ;;;;; ', ';;***;;', ';**G**;', ';;*,*;;', ' ;;,;; ']
stamp(4, 19, MOUND)          # the elder's mound (the pantry door at its stone)
stamp(5, 27, MOUND)
stamp(17, 24, MOUND)
scatter(2, 14, 13, 33, 'T', 0.10)
scatter(17, 15, 24, 23, 'T', 0.08)

# ---- THE BIG SETER: a meadow in a dry-stone ring ---------------------------------------------------------
rect(26, 16, 48, 16, 'F'); rect(26, 31, 48, 31, 'F'); rect(26, 16, 26, 31, 'F'); rect(48, 16, 48, 31, 'F')
rect(27, 17, 47, 30, '.')
scatter(27, 17, 47, 30, ':', 0.10)
rect(30, 16, 31, 16, ',')            # north gate (from the steps)
rect(36, 31, 38, 31, ',')            # south gate (the fell road)
rect(26, 17, 26, 18, ',')            # west gate (the mounds, Lumenby)
rect(48, 22, 48, 24, ',')            # east gate (the humps, the Sporelight)
for (x0, y0) in ((34, 18), (44, 18), (28, 25)):   # three huts (Sigrid's the first) ...
    rect(x0, y0, x0 + 2, y0 + 2, 'H')
rect(39, 18, 41, 20, 'H')                          # ... and the byre
path([(30, 16), (30, 22), (44, 22), (44, 23), (48, 23)])
path([(31, 16), (31, 22)])
path([(26, 17), (30, 17)])
path([(37, 22), (37, 31)])
put(38, 24, 'n'); put(39, 24, 'n')   # the milk bench
for (x, y) in [(33, 27), (43, 27), (45, 29)]:
    put(x, y, 'r')

# ---- TROLL HUMPS (east) ----------------------------------------------------------------------------------
HUMP = ['  .....  ', ' ..;T;.. ', '..;;;;;..', '.T;;;;;..', '..;;;;;..', ' ..;;;.. ', '  .....  ']
stamp(54, 8, HUMP)
stamp(58, 26, HUMP)
stamp(56, 37, HUMP)
stamp(63, 14, MOUND)
stamp(62, 41, MOUND)
scatter(50, 14, 69, 49, 'T', 0.07)
# The troll's nostril (bomb the boulder): an alcove with a chest, under the middle hump.
rect(60, 33, 64, 35, '#'); rect(61, 33, 63, 34, '.'); put(62, 35, 'R')
put(62, 36, '.')
# The cleft between the fell road and the south humps: crossed by the hook, or walked round by the seter.
for y in range(26, 50):
    put(51, y, 'O'); put(52, y, 'O')
put(49, 39, '|'); put(50, 39, '.'); put(53, 39, '.'); put(54, 39, '|')
# The east road: the seter's east gate to the Sporelight's pass, and a path down to the south humps.
path([(48, 23), (58, 23), (64, 22), (71, 23)])
rect(70, 22, 71, 24, ',')
path([(58, 23), (57, 30), (55, 36)])

# ---- LOWER PASTURE (south-west) --------------------------------------------------------------------------
# Hay fields in fences, the mill on its knoll, the hay barn, the pond, a hedge with something in it.
rect(3, 35, 12, 40, 'F'); rect(4, 36, 11, 39, ';'); put(12, 37, ',')   # the hay field
blob(22, 36, 3.2, 2, ':', 0.1)       # the mill's knoll
put(22, 35, '#')                     # the mill's foot
rect(25, 41, 27, 43, 'H')            # the hay barn
blob(20, 45, 3.6, 2.2, '~', 0.1)     # the pond the stream ends in
rect(2, 44, 9, 48, '*')   # a hedge grown shut round something
scatter(3, 33, 33, 48, 'T', 0.03)
rect(3, 45, 8, 47, '.')
path([(37, 34), (30, 37), (16, 37), (13, 37)])
path([(22, 37), (22, 39), (26, 40)])

# ---- THE FELL ROAD (south) -------------------------------------------------------------------------------
rect(44, 49, 46, 49, ',')
put(44, 50, 't'); put(46, 50, 't'); put(45, 50, ',')
path([(45, 49), (45, 44), (41, 41), (40, 36), (37, 34), (37, 31)])
path([(46, 49), (46, 44)])
scatter(34, 33, 50, 48, 'T', 0.16)
# keep the road's verges clear of trees
for y in range(33, 50):
    for x in range(34, 51):
        if g[y][x] == 'T' and any(g[y + dy][x + dx] == ',' for dx, dy in [(1, 0), (-1, 0), (0, 1), (0, -1)]):
            g[y][x] = ';'

# ---- the west road to Lumenby's pass ---------------------------------------------------------------------
rect(0, 16, 1, 18, ',')
path([(0, 17), (26, 17)])
put(15, 17, '=')                     # the bridge over the stream
put(16, 37, '=')                     # and on the pasture road

# ---- the north rim behind the pass stays shut except the pass itself -------------------------------------
for x in range(W):
    if x not in (22, 23, 24):
        put(x, 0, '#')

print(json.dumps([''.join(r) for r in g]))
