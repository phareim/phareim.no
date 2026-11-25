# Part 23: the things, built as rotoscope guides (solids.py) and laid out on Codex sheets at 10 sheet px to a scene px.
# things.py <outdir>  ->  <outdir>/guides/<thing>.npz + .png (scene px), <outdir>/sheets/<sheet>/guide.png + cells.json
import json, math, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from solids import Box, Cyl, Ell, Prism, Seg, Torus, render, shade

OUT = sys.argv[1]
ONLY = set(sys.argv[2].split(',')) if len(sys.argv) > 2 else None
MAT = {  # guide colours (the classic's own where it has them) and whether it glows by itself
    'body': ('#d8d2ec', 0), 'roof': ('#e8e4f8', 0), 'pink': ('#ff2fa0', 0), 'cyan': ('#2ff3ff', 0), 'glass': ('#3a6a9a', 0),
    'shine': ('#8fd0ff', 0), 'door': ('#4a3a5a', 0), 'tire': ('#1c1430', 0), 'hub': ('#9a94b8', 0), 'bumper': ('#5a5285', 0),
    'lamp': ('#fff1b0', 1), 'red': ('#ff3b5c', 1), 'navy': ('#1a2a6a', 0),
    'tentA': ('#2a4ac8', 0), 'tentB': ('#7a3ad8', 0), 'tentC': ('#3a2a9a', 0), 'arch': ('#ffd23f', 0), 'dark': ('#120a20', 0),
    'wood': ('#6e3d4e', 0), 'bark': ('#4a2a1c', 0), 'log': ('#8a5a3a', 0), 'leaf': ('#3fae4a', 0), 'clothP': ('#e0308a', 0),
    'clothB': ('#2a5ad0', 0), 'warm': ('#ffb13f', 1), 'stone': ('#6f6a8a', 0), 'ember': ('#ff5a1f', 1),
    'fire': ('#ff8a3d', 1), 'fireY': ('#ffd23f', 1), 'fireW': ('#fff1b0', 1), 'blue': ('#2f8aff', 1), 'blueL': ('#8ff0ff', 1), 'blueW': ('#e8ffff', 1),
    'sand': ('#c8a878', 0), 'steel': ('#3a3456', 0), 'steelL': ('#8f86b8', 0), 'liquid': ('#3fd8b0', 1), 'lime': ('#b6ff4a', 1),
    'frameP': ('#ff2fa0', 0), 'seat': ('#2a1a30', 0), 'bamboo': ('#c09048', 0), 'bind': ('#5b2a1c', 0),
    'spk': ('#8e5566', 0), 'grille': ('#a8876a', 0), 'plank': ('#b8a08a', 0), 'cloth': ('#8a2a3a', 0), 'stripe': ('#ff8a3d', 0),
    'deck': ('#140a22', 0), 'shelfback': ('#1c1030', 0), 'book': ('#2ff3ff', 0), 'sofa': ('#5a2a8a', 0), 'sofaL': ('#7a3aaa', 0),
    'pillow': ('#2ff3ff', 0), 'deskT': ('#b8b0c8', 0), 'screen': ('#2ff3ff', 1), 'pot': ('#e04a7a', 0), 'potL': ('#ffb13f', 0),
    'cactus': ('#2fa88c', 0), 'glassT': ('#2a6ad0', 0), 'glassE': ('#6ff6ff', 0), 'sheet': ('#e8e4f8', 0), 'blanket': ('#c42a5a', 0),
    'cup': ('#ffd23f', 0), 'candle': ('#fff1b0', 1), 'vinyl': ('#0b0616', 0), 'wire': ('#271c46', 0),
    'bulbY': ('#ffd23f', 1), 'bulbO': ('#ff8a3d', 1), 'bulbP': ('#ff8ae0', 1), 'bulbG': ('#b6ff4a', 1),
}

def van():
    def side(p, n):
        x, y, z = p
        if n[2] > 0.5: return 'roof'
        if n[0] > 0.5:  # the back doors, to the east? no: the nose faces east (the classic's right)
            return 'glass' if z > 25 else 'bumper' if z < 11 else 'body'
        if n[1] > 0.5:
            if 24 <= z <= 32 and -36 <= x <= 24 and not (-12 <= x <= -8): return 'glass'
            if 9 <= z <= 31 and 8 <= x <= 18: return 'door'
            if 19 <= z <= 21.5: return 'pink'
            if 21.5 < z <= 23: return 'cyan'
            if z < 10: return 'bumper'
            return 'body'
        return 'body'
    def nose(p, n):
        x, y, z = p
        if n[0] > 0.5: return 'lamp' if 14 < z < 18 and abs(y) > 10 else 'bumper' if z < 11 else 'body'
        if n[2] > 0.5: return 'body'
        if n[1] > 0.5: return 'pink' if 19 <= z <= 21.5 else 'cyan' if 21.5 < z <= 23 else 'bumper' if z < 10 else 'body'
        return 'body'
    def screen(p, n): return 'shine' if n[0] > 0 and p[1] > 8 else 'glass'
    P = [Box(-40, -17, 6, 26, 17, 38, side), Box(26, -16, 6, 40, 16, 23, nose),
         Prism(-38, 24, 0, 14, 38, 2.5, 'roof')]
    # the windscreen leaning from the roof to the bonnet
    for i in range(8):
        P.append(Box(26, -15, 23 + i * 1.8, 38 - i * 1.6, 15, 24.8 + i * 1.8, screen))
    for x in (-24, 24):
        P.append(Cyl('y', x, 8, 8, -18, 18, 'tire')); P.append(Cyl('y', x, 8, 4, 17.9, 18.6, 'hub'))
    return P, 46, (L := 0)

def tent():
    def skin(p, n):
        x, y, z = p
        if n[1] > 0.35 and abs(x) < 8 and z < 20: return 'dark' if abs(x) < 6.2 and z < 18.5 else 'arch'
        a = math.atan2(y, x); k = int((a + math.pi) / (math.pi / 5)) % 3
        return ['tentA', 'tentB', 'tentC'][k] if z > 2 else 'tentC'
    return [Ell(0, 0, 0, 25, 21, 30, skin, zmin=0)], 34, 0

def fort():
    def cloth(p, n):
        x, y, z = p
        if n[1] > 0.3 and abs(x) < 7 and z < 20: return 'dark' if abs(x) < 5.5 else 'warm'
        return 'clothP' if int((x + 30) / 7) % 2 == 0 else 'clothB'
    P = [Prism(-22, 22, 0, 18, 0, 34, cloth)]
    for x in (-24, 24):
        P += [Cyl('z', x, 0, 2, 0, 40, 'bark'), Seg((x, 0, 36), (x + (-5 if x < 0 else 5), 0, 44), 1.6, 'bark'), Ell(x + (-5 if x < 0 else 5), 0, 45, 3, 3, 2.5, 'leaf')]
    P.append(Seg((-25, 0, 35), (25, 0, 35), 1.5, 'bark'))
    for i, x in enumerate(range(-20, 21, 8)): P.append(Ell(x, 1, 34.5 - 2 * math.sin((x + 20) / 40 * math.pi), 1.4, 1.4, 1.6, ['bulbY', 'bulbP', 'bulbG'][i % 3]))
    return P, 48, 0

def fire(frame, kind):
    P = []
    for i in range(9):
        a = i / 9 * 2 * math.pi + 0.2
        P.append(Ell(11 * math.cos(a), 9 * math.sin(a), 2.2, 4.2, 3.6, 3.2, 'stone', zmin=0))
    P += [Seg((-9, -3, 3), (8, 4, 6), 2.4, 'log'), Seg((-7, 6, 3), (7, -6, 6), 2.4, 'log'), Seg((0, -8, 3), (1, 8, 5), 2.2, 'log')]
    P.append(Ell(0, 0, 4, 6, 6, 2.5, 'ember'))
    hot = ('fire', 'fireY', 'fireW') if kind == 'campfire' else ('blue', 'blueL', 'blueW')
    sway = [(0, 0, 22), (1.6, -1, 25), (-1.6, 1, 21)][frame]
    P.append(Cyl('z', sway[0] * 0.3, sway[1] * 0.3, 7.5, 5, 5 + sway[2], hot[0], rr=0.5))
    P.append(Cyl('z', sway[0], sway[1], 4.5, 6, 3 + sway[2] * 0.8, hot[1], rr=0.4))
    P.append(Cyl('z', sway[0] * 0.5, sway[1] * 0.5, 2.5, 6, 7 + sway[2] * 0.4, hot[2], rr=0.4))
    for j, (dx, dz) in enumerate([(4, 27), (-5, 30), (2, 33)]):
        if (j + frame) % 3 != 2: P.append(Ell(dx + sway[0], 0, dz - frame * 2, 0.8, 0.8, 0.8, hot[1]))
    return P, 36, 0

def bike():
    P = [Torus((-9, 0, 7), 'y', 6, 1.2, 'tire'), Torus((9, 0, 7), 'y', 6, 1.2, 'tire')]
    for a, b in [((-9, 0, 7), (-1, 0, 7)), ((-1, 0, 7), (5, 0, 15)), ((-9, 0, 7), (-3, 0, 15)), ((-3, 0, 15), (5, 0, 15)),
                 ((-1, 0, 7), (-3, 0, 16)), ((9, 0, 7), (6, 0, 17)), ((6, 0, 17), (5, 0, 19))]:
        P.append(Seg(a, b, 1.1, 'frameP'))
    P += [Box(-5, -2, 16, -1, 2, 17.5, 'seat'), Seg((5, -5, 19.5), (5, 5, 19.5), 0.9, 'steelL')]
    return P, 24, 0

def mast(on):
    P = [Box(-15, -15, 0, 15, 15, 3, 'steel')]
    top = 100
    C = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for cx, cy in C: P.append(Seg((cx * 12, cy * 12, 3), (cx * 3, cy * 3, top), 1.3, 'steelL'))
    for k in range(8):
        z0, z1 = 3 + k * 12, 3 + (k + 1) * 12
        r0, r1 = 12 - 9 * (z0 - 3) / (top - 3), 12 - 9 * (z1 - 3) / (top - 3)
        for i in range(4):
            a, b = C[i], C[(i + 1) % 4]
            P.append(Seg((a[0] * r0, a[1] * r0, z0), (b[0] * r1, b[1] * r1, z1), 0.8, 'red' if k % 3 == 1 and i in (1, 2) else 'steelL'))
            P.append(Seg((a[0] * r1, a[1] * r1, z1), (b[0] * r1, b[1] * r1, z1), 0.7, 'steelL'))
    P.append(Ell(7, 7, 62, 2, 6, 6, 'hub'))
    P.append(Cyl('z', 0, 0, 1, top, top + 6, 'steelL'))
    P.append(Ell(0, 0, top + 8, 2.6, 2.6, 2.6, 'red' if on else 'bumper'))
    return P, 112, 0

def tank(frame):
    def glass(p, n):
        x, y, z = p
        # the creature inside, a curl, and a few bubbles that rise with the frame
        if n[2] < 0.5:
            if abs(x - y * 0.3) < 4 and 18 < z < 34 and (z < 24 or abs(x - y * 0.3) < 2.4): return 'leaf'
            for bz in (12, 26, 38):
                if abs((z - bz - frame * 5) % 36) < 1.6 and abs(x - 5) < 1.6: return 'blueW'
        return 'liquid'
    def base(p, n): return 'red' if n[1] > 0.6 and 2 < p[2] < 5 and abs(p[0]) < 2 else 'lime' if n[1] > 0.6 and 2 < p[2] < 5 and abs(p[0] - 5) < 1.5 else 'steel'
    return [Cyl('z', 0, 0, 12, 0, 7, base), Cyl('z', 0, 0, 10, 7, 48, glass), Cyl('z', 0, 0, 12, 48, 54, 'steel'), Cyl('z', 0, 0, 6, 54, 57, 'steelL')], 60, 0

def tiki():
    return [Cyl('z', 0, 0, 2.2, 0, 28, 'bamboo'), Cyl('z', 0, 0, 2.6, 8, 10, 'bind'), Cyl('z', 0, 0, 2.6, 18, 20, 'bind'),
            Cyl('z', 0, 0, 4.5, 26, 32, 'wood', rr=5.2)], 34, 0

def speaker():
    def face(p, n):
        x, y, z = p
        if n[1] > 0.5 and abs(x) < 9 and 5 < z < 38: return 'grille'
        return 'spk'
    return [Box(-12, -10, 0, 12, 10, 44, face)], 46, 0

def table(art):
    def body(p, n):
        x, y, z = p
        if n[2] > 0.5: return 'plank'
        if n[1] > 0.5: return 'stripe' if 22 <= z <= 24 or 3 <= z <= 5 else 'cloth'
        return 'cloth'
    P = [Box(-22, -10, 0, 22, 10, 28, body)]
    if art == 'mixer':
        P += [Box(-19, -6, 28, -7, 5, 31, 'deck'), Box(7, -6, 28, 19, 5, 31, 'deck'), Box(-5, -5, 28, 5, 5, 32, 'deck')]
        for i in range(4): P.append(Box(-4 + i * 2.2, 4.4, 30, -3 + i * 2.2, 5.2, 31.5 + (i % 2), ['bulbY', 'bulbP'][i % 2]))
    else:
        for cx in (-11, 11):
            P += [Box(cx - 9, -7, 28, cx + 9, 7, 30, 'wood'), Cyl('z', cx - 2, 0, 6, 30, 31, 'vinyl'), Cyl('z', cx - 2, 0, 1.5, 31, 31.5, 'bulbO'),
                  Seg((cx + 7, -5, 31), (cx + 3, 2, 31.5), 0.6, 'hub')]
    return P, 34, 0

def lights():
    P = []
    for x in (-37, 37): P.append(Cyl('z', x, 0, 1.4, 44, 64, 'bamboo'))
    pts = [(x, 0, 62 - 6 * math.sin((x + 37) / 74 * math.pi)) for x in np.linspace(-37, 37, 19)]
    for a, b in zip(pts, pts[1:]): P.append(Seg(a, b, 0.6, 'wire'))
    cols = ['bulbY', 'bulbO', 'bulbP', 'bulbG']
    for i, x in enumerate(np.linspace(-31, 31, 9)):
        z = 62 - 6 * math.sin((x + 37) / 74 * math.pi) - 2
        P.append(Ell(x, 0.5, z, 1.5, 1.5, 2, cols[i % 4]))
    return P, 66, 0

def shelf(n):
    L = 16 * n - 1
    def face(p, nn):
        x, y, z = p
        if nn[1] > 0.5 and abs(x) < L - 2 and 3 < z < 48 and not any(abs(z - h) < 1.2 for h in (17, 32)): return 'book' if (int((x + 40) / 3) + int(z / 15)) % 4 else 'shelfback'
        return 'wood'
    return [Box(-L, -6, 0, L, 6, 52, face)], 56, 0

def sofa3():
    def seat(p, n): return 'sofaL' if n[2] > 0.5 else 'sofa'
    P = [Box(-46, -12, 0, 46, 12, 12, seat), Box(-46, -12, 12, 46, -4, 28, seat), Box(-48, -12, 0, -40, 12, 20, 'sofa'), Box(40, -12, 0, 48, 12, 20, 'sofa')]
    for x in (-26, 0, 26): P.append(Box(x - 12, -4, 12, x + 12, 10, 16, 'sofaL'))
    P.append(Box(-38, -4, 16, -28, 2, 24, 'pillow'))
    return P, 32, 0

def desk2():
    def top(p, n): return 'deskT' if n[2] > 0.5 or p[2] > 21 else 'deskT'
    P = [Box(-30, -10, 0, 30, 10, 24, top), Box(-22, -6, 24, -6, 0, 26, 'steel'), Box(-20, -5, 26, -8, -3, 40, 'steel'), Box(-20, -3.5, 28, -8, -2.5, 38, 'screen'),
         Box(-4, 0, 24, 8, 6, 25, 'steelL'), Cyl('z', 18, -3, 1, 24, 36, 'steelL'), Ell(20, -1, 37, 3, 3, 2, 'screen'), Box(10, 2, 24, 14, 6, 28, 'pink')]
    return P, 44, 0

def plant():
    P = [Cyl('z', 0, 0, 7, 0, 12, 'pot', rr=8.5), Cyl('z', 0, 0, 6.5, 12, 13, 'bark')]
    for dx, dy, h in [(0, 0, 44), (-3, 1, 36), (3, -1, 38), (1, 3, 30), (-2, -3, 32)]:
        P.append(Cyl('z', dx, dy, 2.2, 12, h, 'cactus', rr=1.0))
    return P, 46, 0

def glass2():
    def top(p, n): return 'glassE' if n[2] > 0.5 and (abs(p[0]) > 26 or abs(p[1]) > 8) else 'glassT'
    return [Box(-29, -11, 10, 29, 11, 13, top)] + [Cyl('z', x, y, 1.2, 0, 10, 'steelL') for x in (-26, 26) for y in (-8, 8)], 16, 0

def bed():
    def b(p, n):
        x, y, z = p
        return 'sheet' if y < -14 else 'blanket'
    return [Box(-28, -28, 0, 28, 28, 10, 'wood'), Box(-27, -27, 10, 27, 27, 16, b), Box(-28, -30, 0, 28, -26, 30, 'wood'),
            Ell(-12, -20, 18, 9, 5, 3, 'sheet'), Ell(12, -20, 18, 9, 5, 3, 'sheet')], 34, 0

def table2():
    P = [Box(-26, -26, 20, 26, 26, 24, 'wood')] + [Box(x - 2, y - 2, 0, x + 2, y + 2, 20, 'bark') for x in (-22, 22) for y in (-22, 22)]
    P += [Cyl('z', -8, -6, 3, 24, 30, 'cup'), Cyl('z', 6, 8, 2, 24, 32, 'candle'), Box(4, -14, 24, 16, -6, 26, 'sheet')]
    return P, 34, 0

def console():
    def body(p, n):
        x, y, z = p
        if n[2] > 0.5 and z > 25: return 'glass'
        if n[1] > 0.5 and z > 14 and abs(x) < 10: return 'deck'
        return 'steel'
    P = [Box(-13, -9, 0, 13, 9, 26, body)]
    for i in range(6): P.append(Box(-8 + (i % 3) * 5, 8.6, 20 - (i // 3) * 4, -6 + (i % 3) * 5, 9.4, 22 - (i // 3) * 4, ['lime', 'cyan', 'pink'][i % 3]))
    return P, 30, 0

def bench2():
    def top(p, n): return 'steelL' if n[2] > 0.5 else 'steel'
    return [Box(-31, -9, 0, 31, 9, 20, top), Box(-20, -4, 20, -8, 4, 26, 'glass'), Box(8, -3, 20, 12, 1, 28, 'liquid'), Box(16, -2, 20, 19, 1, 25, 'lime')], 30, 0

def terminal():
    return [Box(-3, -3, 0, 3, 3, 3, 'steel'), Cyl('z', 0, 0, 1.6, 3, 16, 'steel'), Box(-9, -2, 14, 9, 2, 30, 'steel'), Box(-7, 1.9, 16, 7, 2.4, 28, 'screen')], 34, 0

def machine():
    def body(p, n):
        x, y, z = p
        if n[1] > 0.5 and 12 < z < 26 and abs(x) < 8: return 'screen'
        return 'tentC' if n[2] > 0.5 else 'steel'
    return [Box(-12, -8, 0, 12, 8, 30, body), Box(-10, 7.9, 4, -4, 8.4, 8, 'lime'), Box(4, 7.9, 4, 10, 8.4, 8, 'pink')], 32, 0

def fountain(frame):
    def bowl(p, n): return 'stone'
    P = [Cyl('z', 0, 0, 20, 0, 6, 'stone', rr=18), Cyl('z', 0, 0, 16.5, 5.5, 6.2, 'blue'), Cyl('z', 0, 0, 4, 6, 18, 'stone', rr=3),
         Cyl('z', 0, 0, 10, 18, 22, 'stone', rr=11), Cyl('z', 0, 0, 8.5, 21.6, 22.3, 'blue'), Cyl('z', 0, 0, 2, 22, 30, 'stone', rr=1.5)]
    h = 44 if frame == 0 else 40
    P.append(Cyl('z', 0, 0, 1.6, 30, h, 'blueL', rr=0.8))
    for k in range(6):
        a = k / 6 * 2 * math.pi + frame * 0.5
        P.append(Seg((0, 0, h - 2), (7 * math.cos(a), 7 * math.sin(a), 26), 0.7, 'blueW'))
        P.append(Seg((9 * math.cos(a + 0.3), 9 * math.sin(a + 0.3), 20), (15 * math.cos(a + 0.3), 15 * math.sin(a + 0.3), 7), 0.6, 'blueL'))
    return P, 48, 0

def torch(lean):
    P, _, _ = tiki()
    dx = (lean - 1) * 1.6
    P += [Cyl('z', dx * 0.3, 0, 3.6, 31, 40, 'fire', rr=0.6), Cyl('z', dx * 0.6, 0, 2.2, 32, 38, 'fireY', rr=0.4), Ell(dx, 0, 41, 0.8, 0.8, 1.2, 'fireW')]
    return P, 44, 0

THINGS = {
    **{f'torch_{i}': (lambda i=i: torch(i)) for i in range(3)},
    'console': console, 'bench_2': bench2, 'terminal': terminal, 'machine': machine,
    'fountain_0': lambda: fountain(0), 'fountain_1': lambda: fountain(1),
    'shelf_2': lambda: shelf(2), 'shelf_1': lambda: shelf(1), 'sofa_3': sofa3, 'desk_2': desk2, 'plant': plant, 'glass_2': glass2,
    'bed': bed, 'table': table2,
    'van': van, 'tent': tent, 'fort': fort, 'bike': bike, 'tiki': tiki, 'speaker': speaker, 'lights': lights,
    'mast': lambda: mast(False), 'mast_on': lambda: mast(True),
    'tank_0': lambda: tank(0), 'tank_1': lambda: tank(1),
    'table_mixer': lambda: table('mixer'), 'table_records': lambda: table('records'),
    **{f'campfire_{i}': (lambda i=i: fire(i, 'campfire')) for i in range(3)},
    **{f'bonfire_{i}': (lambda i=i: fire(i, 'bonfire')) for i in range(3)},
}

def build(name):
    P, zmax, _ = THINGS[name]()
    W, H, ax, ay = 220, 220, 110, 160
    mats, nrm, q, hit = render(P, W, H, ax, ay, zmax + 2)
    ys, xs = np.nonzero(hit); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    pic = shade(mats, nrm, hit, MAT)[y0:y1, x0:x1]
    glow = np.zeros(hit.shape)
    for y, x in zip(ys, xs): glow[y, x] = MAT[mats[y, x]][1]
    os.makedirs(f'{OUT}/guides', exist_ok=True)
    Image.fromarray(pic, 'RGBA').save(f'{OUT}/guides/{name}.png')
    np.savez(f'{OUT}/guides/{name}.npz', hit=hit[y0:y1, x0:x1], nrm=nrm[y0:y1, x0:x1], q=q[y0:y1, x0:x1], glow=glow[y0:y1, x0:x1],
             ax=ax - x0, ay=ay - y0, mats=np.array([[m or '' for m in r] for r in mats[y0:y1, x0:x1]]))
    print(name, x1 - x0, 'x', y1 - y0, 'anchor', ax - x0, ay - y0)

if __name__ == '__main__':
    for n in THINGS:
        if ONLY is None or n in ONLY: build(n)
