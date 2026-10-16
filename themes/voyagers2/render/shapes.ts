/**
 * Space Voyagers II: a small builder for the low-poly models. Every face is
 * flat (its own normal), every part is convex and its faces are turned to
 * look away from the part's middle, so no winding needs thinking about.
 * A model is one non-indexed geometry with a material id a vertex
 * (`palette.ts` `M`), drawn by the four-tone shader in `toon.ts`.
 *
 * Models look down -z (the nose), +y up, +x right; units are metres.
 */
export type P3 = [number, number, number]

export interface Tf {
  /** Rotation in radians about x, then y, then z, around the part's own origin. */
  rot?: P3
  /** Where the part's origin goes. */
  at?: P3
}

function rotate(p: P3, r: P3 | undefined): P3 {
  if (!r) return p
  let [x, y, z] = p
  if (r[0]) { const c = Math.cos(r[0]), s = Math.sin(r[0]); const y2 = y * c - z * s; z = y * s + z * c; y = y2 }
  if (r[1]) { const c = Math.cos(r[1]), s = Math.sin(r[1]); const x2 = x * c + z * s; z = -x * s + z * c; x = x2 }
  if (r[2]) { const c = Math.cos(r[2]), s = Math.sin(r[2]); const x2 = x * c - y * s; y = x * s + y * c; x = x2 }
  return [x, y, z]
}

function apply(p: P3, tf?: Tf): P3 {
  const q = rotate(p, tf?.rot)
  if (tf?.at) return [q[0] + tf.at[0], q[1] + tf.at[1], q[2] + tf.at[2]]
  return q
}

export class Shape {
  pos: number[] = []
  nor: number[] = []
  mat: number[] = []
  private mid: P3 = [0, 0, 0]

  /** One triangle, turned to face away from the current part's middle. */
  tri(a: P3, b: P3, c: P3, m: number): void {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz)
    if (l < 1e-9) return
    nx /= l; ny /= l; nz /= l
    const cx = (a[0] + b[0] + c[0]) / 3 - this.mid[0]
    const cy = (a[1] + b[1] + c[1]) / 3 - this.mid[1]
    const cz = (a[2] + b[2] + c[2]) / 3 - this.mid[2]
    if (nx * cx + ny * cy + nz * cz < 0) {
      const t = b; b = c; c = t
      nx = -nx; ny = -ny; nz = -nz
    }
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
    this.nor.push(nx, ny, nz, nx, ny, nz, nx, ny, nz)
    this.mat.push(m, m, m)
  }

  quad(a: P3, b: P3, c: P3, d: P3, m: number): void {
    this.tri(a, b, c, m)
    this.tri(a, c, d, m)
  }

  private begin(points: P3[]): void {
    let x = 0, y = 0, z = 0
    for (const p of points) { x += p[0]; y += p[1]; z += p[2] }
    const n = points.length || 1
    this.mid = [x / n, y / n, z / n]
  }

  /**
   * Rings joined in order (each the same count of points), with the first and
   * last closed by a fan. A ring of one point is a tip.
   */
  loft(rings: P3[][], m: number | number[], tf?: Tf, caps = true): void {
    const rs = rings.map(r => r.map(p => apply(p, tf)))
    this.begin(rs.flat())
    const mat = (i: number): number => (Array.isArray(m) ? m[Math.min(i, m.length - 1)]! : m)
    for (let i = 0; i + 1 < rs.length; i++) {
      const a = rs[i]!, b = rs[i + 1]!
      if (a.length === 1) { for (let j = 0; j < b.length; j++) this.tri(a[0]!, b[j]!, b[(j + 1) % b.length]!, mat(i)); continue }
      if (b.length === 1) { for (let j = 0; j < a.length; j++) this.tri(a[j]!, a[(j + 1) % a.length]!, b[0]!, mat(i)); continue }
      for (let j = 0; j < a.length; j++) {
        const k = (j + 1) % a.length
        this.quad(a[j]!, a[k]!, b[k]!, b[j]!, mat(i))
      }
    }
    if (caps) {
      for (const r of [rs[0]!, rs[rs.length - 1]!]) {
        if (r.length < 3) continue
        const c: P3 = [0, 0, 0]
        for (const p of r) { c[0] += p[0] / r.length; c[1] += p[1] / r.length; c[2] += p[2] / r.length }
        const capMat = r === rs[0] ? mat(0) : mat(rs.length - 2)
        for (let j = 0; j < r.length; j++) this.tri(c, r[j]!, r[(j + 1) % r.length]!, capMat)
      }
    }
  }

  /** A box centred on the origin of `tf`. */
  box(sx: number, sy: number, sz: number, m: number, tf?: Tf): void {
    const x = sx / 2, y = sy / 2, z = sz / 2
    const ring = (zz: number): P3[] => [[-x, -y, zz], [x, -y, zz], [x, y, zz], [-x, y, zz]]
    this.loft([ring(-z), ring(z)], m, tf)
  }

  /**
   * A tapered box: the front face (−z) `fx` by `fy`, the back face `bx` by
   * `by`, `len` long, with the faces' centres lifted by `fdy` and `bdy`.
   */
  taper(fx: number, fy: number, bx: number, by: number, len: number, m: number | number[], tf?: Tf, fdy = 0, bdy = 0): void {
    const ring = (w: number, h: number, z: number, dy: number): P3[] => [[-w / 2, -h / 2 + dy, z], [w / 2, -h / 2 + dy, z], [w / 2, h / 2 + dy, z], [-w / 2, h / 2 + dy, z]]
    this.loft([ring(fx, fy, -len / 2, fdy), ring(bx, by, len / 2, bdy)], m, tf)
  }

  /** An n-sided ring in the xy plane at z (an ellipse rx by ry), turned by `phase`. */
  static ring(z: number, rx: number, ry: number, n: number, phase = 0, cx = 0, cy = 0): P3[] {
    const out: P3[] = []
    for (let i = 0; i < n; i++) {
      const a = phase + (i / n) * Math.PI * 2
      out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, z])
    }
    return out
  }

  /** A cylinder (or a cone, with r1 ≠ r0) along z, centred, `len` long. */
  cyl(r0: number, r1: number, len: number, n: number, m: number, tf?: Tf, phase = Math.PI / n): void {
    const a = r0 > 0 ? Shape.ring(-len / 2, r0, r0, n, phase) : [[0, 0, -len / 2] as P3]
    const b = r1 > 0 ? Shape.ring(len / 2, r1, r1, n, phase) : [[0, 0, len / 2] as P3]
    this.loft([a, b], m, tf)
  }

  /** A low dome or ball: `rings` bands from the equator to the pole, on the +y side when `half`. */
  ball(r: number, n: number, bands: number, m: number, tf?: Tf, half = false, sy = 1): void {
    const rings: P3[][] = []
    const from = half ? 0 : -bands
    for (let i = from; i <= bands; i++) {
      const a = (i / bands) * (Math.PI / 2)
      const rr = Math.cos(a) * r
      const y = Math.sin(a) * r * sy
      if (i === bands || i === -bands) { rings.push([[0, y, 0]]); continue }
      // Rings lie in xz here: build in xy, then turn the points.
      rings.push(Shape.ring(0, rr, rr, n, Math.PI / n).map(p => [p[0], y, p[1]] as P3))
    }
    this.loft(rings, m, tf, half)
  }

  /** A flat plate from a 2D outline (x, z), `thick` thick, in the xz plane. */
  plate(outline: [number, number][], thick: number, m: number, tf?: Tf): void {
    const top = outline.map(([x, z]) => [x, thick / 2, z] as P3)
    const bot = outline.map(([x, z]) => [x, -thick / 2, z] as P3)
    this.loft([bot, top], m, tf)
  }
}
