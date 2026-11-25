# Part 23: the things' rotoscope guides, built from simple solids and seen exactly as the isometric view sees the world
# (props.ts's Bench: a pixel's line of sight passes through (x0, y0, 0) and runs along (1, 1, 1) toward the viewer; a point
# (x east, y south, z up) lands at (x - y, (x + y) / 2 - z) from the anchor). Scene px, 32 to the tile.
# Per pixel: which solid, its material, the surface normal and how near it lies (props.ts depthCode's q).
import numpy as np

LIGHT = np.array([-0.36, 0.26, 0.9]); LIGHT /= np.linalg.norm(LIGHT)

class Prim:
    def __init__(self, mat): self.mat = mat
    def matAt(self, p, n):
        return self.mat(p, n) if callable(self.mat) else self.mat

class Box(Prim):
    def __init__(s, x0, y0, z0, x1, y1, z1, mat): super().__init__(mat); s.a = np.array([x0, y0, z0], float); s.b = np.array([x1, y1, z1], float)
    def inside(s, X, Y, Z): return (X >= s.a[0]) & (X <= s.b[0]) & (Y >= s.a[1]) & (Y <= s.b[1]) & (Z >= s.a[2]) & (Z <= s.b[2])
    def normal(s, p):
        d = [abs(p[0] - s.b[0]), abs(p[1] - s.b[1]), abs(p[2] - s.b[2]), abs(p[0] - s.a[0]), abs(p[1] - s.a[1])]
        i = int(np.argmin(d)); n = np.zeros(3); n[i % 3] = 1 if i < 3 else -1; return n

class Cyl(Prim):
    """A cylinder along an axis ('x', 'y' or 'z') through (c1, c2) in the other two axes, from a0 to a1, radius r (rr: radius at a1, a cone)."""
    def __init__(s, axis, c1, c2, r, a0, a1, mat, rr=None):
        super().__init__(mat); s.ax = 'xyz'.index(axis); s.c = (c1, c2); s.r = r; s.rr = r if rr is None else rr; s.a0, s.a1 = a0, a1
    def _split(s, P):
        o = [i for i in range(3) if i != s.ax]; return P[s.ax], P[o[0]] - s.c[0], P[o[1]] - s.c[1], o
    def inside(s, X, Y, Z):
        a, u, v, _ = s._split((X, Y, Z)); f = np.clip((a - s.a0) / (s.a1 - s.a0), 0, 1); r = s.r + (s.rr - s.r) * f
        return (a >= s.a0) & (a <= s.a1) & (u * u + v * v <= r * r)
    def normal(s, p):
        a, u, v, o = s._split(p); f = np.clip((a - s.a0) / (s.a1 - s.a0), 0, 1); r = s.r + (s.rr - s.r) * f
        n = np.zeros(3)
        if abs(a - s.a1) < 0.4: n[s.ax] = 1; return n
        if abs(a - s.a0) < 0.4: n[s.ax] = -1; return n
        h = np.hypot(u, v) or 1; n[o[0]] = u / h; n[o[1]] = v / h; n[s.ax] = (s.r - s.rr) / (s.a1 - s.a0)
        return n / np.linalg.norm(n)

class Ell(Prim):
    def __init__(s, cx, cy, cz, rx, ry, rz, mat, zmin=-1e9): super().__init__(mat); s.c = np.array([cx, cy, cz], float); s.r = np.array([rx, ry, rz], float); s.zmin = zmin
    def inside(s, X, Y, Z): return (((X - s.c[0]) / s.r[0]) ** 2 + ((Y - s.c[1]) / s.r[1]) ** 2 + ((Z - s.c[2]) / s.r[2]) ** 2 <= 1) & (Z >= s.zmin)
    def normal(s, p):
        if p[2] - s.zmin < 0.3: return np.array([0, 0, -1.0])
        n = (np.array(p) - s.c) / s.r ** 2; return n / np.linalg.norm(n)

class Prism(Prim):
    """A ridge along x (from x0 to x1) over y in [cy - w, cy + w], from z0 up to the ridge at z0 + h."""
    def __init__(s, x0, x1, cy, w, z0, h, mat): super().__init__(mat); s.x0, s.x1, s.cy, s.w, s.z0, s.h = x0, x1, cy, w, z0, h
    def inside(s, X, Y, Z): return (X >= s.x0) & (X <= s.x1) & (Z >= s.z0) & (np.abs(Y - s.cy) <= s.w * (1 - (Z - s.z0) / s.h))
    def normal(s, p):
        if abs(p[0] - s.x1) < 0.4: return np.array([1.0, 0, 0])
        if abs(p[0] - s.x0) < 0.4: return np.array([-1.0, 0, 0])
        sg = 1 if p[1] >= s.cy else -1; n = np.array([0, sg * s.h, s.w], float); return n / np.linalg.norm(n)

class Seg(Prim):
    """A tube between two points, radius r."""
    def __init__(s, p0, p1, r, mat): super().__init__(mat); s.p0 = np.array(p0, float); s.p1 = np.array(p1, float); s.r = r
    def _t(s, X, Y, Z):
        d = s.p1 - s.p0; L = d @ d
        t = np.clip(((X - s.p0[0]) * d[0] + (Y - s.p0[1]) * d[1] + (Z - s.p0[2]) * d[2]) / L, 0, 1)
        return t, d
    def inside(s, X, Y, Z):
        t, d = s._t(X, Y, Z)
        return (X - s.p0[0] - t * d[0]) ** 2 + (Y - s.p0[1] - t * d[1]) ** 2 + (Z - s.p0[2] - t * d[2]) ** 2 <= s.r * s.r
    def normal(s, p):
        t, d = s._t(*p); q = s.p0 + t * d; n = np.array(p) - q; return n / (np.linalg.norm(n) or 1)

class Torus(Prim):
    """A ring standing in the plane of `axis` normal ('x' or 'y': a wheel), centre c, big radius R, tube r."""
    def __init__(s, c, axis, R, r, mat): super().__init__(mat); s.c = np.array(c, float); s.ax = 'xyz'.index(axis); s.R, s.r = R, r
    def inside(s, X, Y, Z):
        P = [X - s.c[0], Y - s.c[1], Z - s.c[2]]; a = P[s.ax]; o = [P[i] for i in range(3) if i != s.ax]
        q = np.hypot(o[0], o[1]) - s.R; return q * q + a * a <= s.r * s.r
    def normal(s, p):
        P = np.array(p) - s.c; o = [i for i in range(3) if i != s.ax]; h = np.hypot(P[o[0]], P[o[1]]) or 1
        ring = np.zeros(3); ring[o[0]] = P[o[0]] / h * s.R; ring[o[1]] = P[o[1]] / h * s.R
        n = P - ring; return n / (np.linalg.norm(n) or 1)

def render(prims, W, H, ax, ay, zmax, step=0.2):
    """Cast every pixel's line of sight; the nearest solid wins. Returns mats (object array), normals, q (depth), hit mask."""
    py, px = np.mgrid[0:H, 0:W]
    sx = px + 0.5 - ax; sy = py + 0.5 - ay
    x0 = sx / 2 + sy; y0 = sy - sx / 2
    best = np.full((H, W), -1e9); who = np.full((H, W), -1)
    ts = np.arange(zmax + 1, -0.01, -step)
    for k, pr in enumerate(prims):
        hitT = np.full((H, W), -1e9)
        for t in ts:
            m = pr.inside(x0 + t, y0 + t, np.full_like(x0, t)) & (hitT < -1e8)
            hitT[m] = t
        better = hitT > best; best[better] = hitT[better]; who[better] = k
    mats = np.empty((H, W), object); nrm = np.zeros((H, W, 3)); q = np.zeros((H, W))
    for y in range(H):
        for x in range(W):
            k = who[y, x]
            if k < 0: continue
            t = best[y, x]; p = (x0[y, x] + t, y0[y, x] + t, t)
            n = prims[k].normal(p); nrm[y, x] = n; mats[y, x] = prims[k].matAt(p, n)
            q[y, x] = y + 0.5 - ay + t
    return mats, nrm, q, who >= 0

def shade(mats, nrm, hit, MAT):
    """The guide's picture: flat steps of each material's colour from the artist's light, a dark line round the lower right."""
    H, W = hit.shape; out = np.zeros((H, W, 4), np.uint8)
    for y in range(H):
        for x in range(W):
            if not hit[y, x]: continue
            c, glow = MAT[mats[y, x]]
            c = np.array([int(c[i:i + 2], 16) for i in (1, 3, 5)], float)
            if glow < 1:
                lam = nrm[y, x] @ LIGHT
                f = 1.18 if lam > 0.93 else 1.0 if lam > 0.62 else 0.78 if lam > 0.2 else 0.58
                c = np.clip(c * f, 0, 255)
                if (x + 1 >= W or not hit[y, x + 1]) or (y + 1 >= H or not hit[y + 1, x]): c = c * 0.35
            out[y, x, :3] = c; out[y, x, 3] = 255
    return out
