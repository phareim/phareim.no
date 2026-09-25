/**
 * The paper doll: a small pixel grid the hero rig paints into with round
 * shapes (ellipses, tapered capsules, boxes) and flat decals (eyes, stains,
 * zips). Each shape is a "part"; after painting, the doll
 *
 *   - lights every part from the top left (a three-quarter sphere normal per
 *     pixel, so heads, bellies and limbs read round, in four tones),
 *   - draws a dark line where a part with `line` sits on an earlier part
 *     (an arm in front of the body), and
 *   - outlines the whole silhouette in #0b0616.
 *
 * Coordinates are local: (0, 0) is where the feet touch the floor, x right,
 * y down (so the head is at negative y). Shapes take float coordinates and
 * test pixel centres, so nothing is anti-aliased.
 */
import { makeCanvas } from '../../../base/pixel/stage'

export const OUTLINE = '#0b0616'

/** A material: four tones, deep → highlight. A single colour is a flat decal. */
export type Mat = readonly [string, string, string, string] | string

export interface ShapeOpts {
  /** Line where this part overlaps earlier parts: 'k' (dark), 'd' (the part's deep tone) or none. */
  line?: 'k' | 'd' | false
  /** Shift every tone (−1: a limb on the far side). */
  dim?: number
  /** Only paint over pixels already filled (clipped to the body). */
  clip?: boolean
  /** Paint only where nothing is (behind everything drawn so far). */
  under?: boolean
  /** Flat: no shading (base tone). */
  flat?: boolean
  /** Continue the previous part (a limb's second segment: no line between). */
  join?: boolean
}

// Light from the upper left and a bit in front.
const LX = -0.42, LY = -0.72, LZ = 0.55
const LN = Math.hypot(LX, LY, LZ)
const Lx = LX / LN, Ly = LY / LN, Lz = LZ / LN

function toneOf(nx: number, ny: number, dim = 0): number {
  const r2 = nx * nx + ny * ny
  const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)))
  const i = nx * Lx + ny * Ly + nz * Lz
  const t = i > 0.8 ? 3 : i > 0.28 ? 2 : i > -0.12 ? 1 : 0
  return Math.max(0, Math.min(3, t + dim))
}

export class Doll {
  readonly w: number
  readonly h: number
  /** Grid position of the local origin (the feet). */
  readonly ox: number
  readonly oy: number
  private mats: Mat[] = []
  private matIx = new Map<Mat, number>()
  private m: Int16Array
  private part: Int16Array
  private tone: Int8Array
  private lineOf: ('k' | 'd' | false)[] = [false]
  private nPart = 0

  /** Pixels per unit: 2 paints everything twice as big (portraits), with 1-px outlines. */
  readonly s: number

  constructor(w: number, h: number, ox: number, oy: number, s = 1) {
    this.s = s
    this.w = w
    this.h = h
    this.ox = ox
    this.oy = oy
    this.m = new Int16Array(w * h).fill(-1)
    this.part = new Int16Array(w * h)
    this.tone = new Int8Array(w * h)
  }

  private mat(m: Mat): number {
    let i = this.matIx.get(m)
    if (i === undefined) { i = this.mats.length; this.mats.push(m); this.matIx.set(m, i) }
    return i
  }

  private newPart(o: ShapeOpts): number {
    if (o.join && this.nPart > 0) return this.nPart
    this.nPart++
    this.lineOf[this.nPart] = o.line ?? false
    return this.nPart
  }

  private setPx(gx: number, gy: number, mi: number, part: number, tone: number, o: ShapeOpts) {
    if (gx < 0 || gy < 0 || gx >= this.w || gy >= this.h) return
    const i = gy * this.w + gx
    const filled = this.m[i]! >= 0
    if (o.clip && !filled) return
    if (o.under && filled) return
    this.m[i] = mi
    this.part[i] = part
    this.tone[i] = tone
  }

  /** Is the local pixel (x, y) (its top-left corner) painted? */
  filled(x: number, y: number): boolean {
    const gx = Math.floor(x) + this.ox, gy = Math.floor(y) + this.oy
    return gx >= 0 && gy >= 0 && gx < this.w && gy < this.h && this.m[gy * this.w + gx]! >= 0
  }

  /** An ellipse centred on (cx, cy). */
  ell(cx: number, cy: number, rx: number, ry: number, m: Mat, o: ShapeOpts = {}) {
    const S = this.s
    cx *= S; cy *= S; rx *= S; ry *= S
    const mi = this.mat(m), part = o.clip ? 0 : this.newPart(o)
    const x0 = Math.floor(cx - rx - 1), x1 = Math.ceil(cx + rx + 1)
    const y0 = Math.floor(cy - ry - 1), y1 = Math.ceil(cy + ry + 1)
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry
      if (nx * nx + ny * ny > 1) continue
      this.setPx(x + this.ox, y + this.oy, mi, o.clip ? this.partAt(x, y) : part, o.flat ? 2 : toneOf(nx, ny, o.dim), o)
    }
  }

  private partAt(x: number, y: number): number {
    const gx = x + this.ox, gy = y + this.oy
    if (gx < 0 || gy < 0 || gx >= this.w || gy >= this.h) return 0
    return this.part[gy * this.w + gx]!
  }

  /**
   * A capsule from (x1, y1) to (x2, y2), radius r1 at the start tapering to
   * r2 at the end. Shaded across its axis.
   */
  cap(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number, m: Mat, o: ShapeOpts = {}) {
    const S = this.s
    x1 *= S; y1 *= S; x2 *= S; y2 *= S; r1 *= S; r2 *= S
    const mi = this.mat(m), part = o.clip ? 0 : this.newPart(o)
    const R = Math.max(r1, r2)
    const x0 = Math.floor(Math.min(x1, x2) - R - 1), xe = Math.ceil(Math.max(x1, x2) + R + 1)
    const y0 = Math.floor(Math.min(y1, y2) - R - 1), ye = Math.ceil(Math.max(y1, y2) + R + 1)
    const dx = x2 - x1, dy = y2 - y1
    const L2 = dx * dx + dy * dy || 1e-6
    for (let y = y0; y <= ye; y++) for (let x = x0; x <= xe; x++) {
      const px = x + 0.5, py = y + 0.5
      const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L2))
      const qx = x1 + dx * t, qy = y1 + dy * t
      const r = r1 + (r2 - r1) * t
      const ex = px - qx, ey = py - qy
      const d = Math.hypot(ex, ey)
      if (d > r) continue
      const nx = r > 0 ? ex / r : 0, ny = r > 0 ? ey / r : 0
      this.setPx(x + this.ox, y + this.oy, mi, o.clip ? this.partAt(x, y) : part, o.flat ? 2 : toneOf(nx, ny, o.dim), o)
    }
  }

  /**
   * A body shape between y0 and y1 whose half-width at each row is
   * `half(y)` (0 at y0 … 1 at y1 as the argument), centred on `cx(f)`.
   */
  blob(y0: number, y1: number, cx0: (f: number) => number, half0: (f: number) => number, m: Mat, o: ShapeOpts = {}) {
    const S = this.s
    y0 *= S; y1 *= S
    const cx = (f: number) => cx0(f) * S, half = (f: number) => half0(f) * S
    const mi = this.mat(m), part = o.clip ? 0 : this.newPart(o)
    const H = y1 - y0
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      const f = (y + 0.5 - y0) / H
      if (f < 0 || f > 1) continue
      const c = cx(f), hw = half(f)
      if (hw <= 0) continue
      const ny = f * 2 - 1
      for (let x = Math.floor(c - hw - 1); x <= Math.ceil(c + hw + 1); x++) {
        const nx = (x + 0.5 - c) / hw
        if (Math.abs(nx) > 1) continue
        // Shade as a cylinder that rounds off at the top and bottom.
        const ny2 = ny * Math.abs(ny) * 0.8
        this.setPx(x + this.ox, y + this.oy, mi, o.clip ? this.partAt(x, y) : part, o.flat ? 2 : toneOf(nx * 0.95, ny2, o.dim), o)
      }
    }
  }

  /** A filled box (whole pixels), shaded like a rounded slab unless flat. */
  box(x: number, y: number, w: number, h: number, m: Mat, o: ShapeOpts = {}) {
    const mi = this.mat(m), part = o.clip ? 0 : this.newPart(o)
    const S = this.s
    x = Math.round(x) * S; y = Math.round(y) * S; w *= S; h *= S
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const nx = w > 1 ? ((i + 0.5) / w) * 2 - 1 : 0, ny = h > 1 ? ((j + 0.5) / h) * 2 - 1 : 0
      const tone = o.flat ? 2 : toneOf(nx * 0.7, ny * 0.7, o.dim)
      this.setPx(x + i + this.ox, y + j + this.oy, mi, o.clip ? this.partAt(x + i, y + j) : part, tone, o)
    }
  }

  /** One flat pixel (a decal: keeps the part underneath, so no lines). */
  px(x: number, y: number, color: string, onlyOnBody = false) {
    const S = this.s
    x = Math.round(x) * S; y = Math.round(y) * S
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) this.px1(x + i, y + j, color, onlyOnBody)
  }

  /** One grid pixel (unscaled). */
  px1(x: number, y: number, color: string, onlyOnBody = false) {
    const mi = this.mat(color)
    const gx = x + this.ox, gy = y + this.oy
    if (gx < 0 || gy < 0 || gx >= this.w || gy >= this.h) return
    const i = gy * this.w + gx
    if (onlyOnBody && this.m[i]! < 0) return
    this.m[i] = mi
    this.tone[i] = 2
    // A decal on empty space becomes its own part so the outline still finds it.
    if (this.part[i] === 0 && !onlyOnBody) this.part[i] = this.newPart({})
  }

  /** A run of flat pixels. */
  rect(x: number, y: number, w: number, h: number, color: string, onlyOnBody = false) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color, onlyOnBody)
  }

  /** A one-pixel line of flat pixels (Bresenham). */
  line(x0: number, y0: number, x1: number, y1: number, color: string, onlyOnBody = false) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
    let err = dx + dy
    for (;;) {
      this.px(x0, y0, color, onlyOnBody)
      if (x0 === x1 && y0 === y1) break
      const e2 = 2 * err
      if (e2 >= dy) { err += dy; x0 += sx }
      if (e2 <= dx) { err += dx; y0 += sy }
    }
  }

  /** Clear a pixel (cut-outs: the gap between legs). */
  erase(x: number, y: number) {
    const gx = Math.round(x) + this.ox, gy = Math.round(y) + this.oy
    if (gx < 0 || gy < 0 || gx >= this.w || gy >= this.h) return
    this.m[gy * this.w + gx] = -1
  }

  /** Lines, outline, and the finished canvas. */
  render(outline = true): HTMLCanvasElement {
    const { w, h } = this
    const col = new Array<string | null>(w * h).fill(null)
    for (let i = 0; i < w * h; i++) {
      const mi = this.m[i]!
      if (mi < 0) continue
      const mat = this.mats[mi]!
      col[i] = typeof mat === 'string' ? mat : mat[this.tone[i]!]!
    }
    // Part lines: a pixel of an earlier part next to a later part that wants a line.
    const lined = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (this.m[i]! < 0) continue
      const p = this.part[i]!
      let lineKind: 'k' | 'd' | false = false
      let lineMat = -1
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (this.m[j]! < 0) continue
        const q = this.part[j]!
        if (q > p && this.lineOf[q]) { lineKind = this.lineOf[q]!; lineMat = this.m[j]! }
      }
      if (lineKind) {
        lined[i] = 1
        if (lineKind === 'k') col[i] = OUTLINE
        else {
          const mat = this.mats[lineMat]!
          col[i] = typeof mat === 'string' ? OUTLINE : mat[0]
        }
      }
    }
    const c = makeCanvas(w, h)
    const g = c.getContext('2d')!
    if (outline) {
      g.fillStyle = OUTLINE
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (this.m[i]! >= 0) continue
        const on = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && this.m[yy * w + xx]! >= 0
        if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) g.fillRect(x, y, 1, 1)
      }
    }
    for (let i = 0; i < w * h; i++) {
      const cc = col[i]
      if (!cc) continue
      g.fillStyle = cc
      g.fillRect(i % w, Math.floor(i / w), 1, 1)
    }
    void lined
    return c
  }
}

/** Mirror a canvas left–right (the left facing). */
export function mirror(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.translate(src.width, 0)
  g.scale(-1, 1)
  g.drawImage(src, 0, 0)
  return c
}

/** Turn a canvas by a quarter turns (exact on a pixel grid). */
export function turn(src: HTMLCanvasElement, quarters: number): HTMLCanvasElement {
  const q = ((quarters % 4) + 4) % 4
  if (q === 0) return src
  const W = q % 2 ? src.height : src.width
  const H = q % 2 ? src.width : src.height
  const c = makeCanvas(W, H)
  const g = c.getContext('2d')!
  g.translate(W / 2, H / 2)
  g.rotate((q * Math.PI) / 2)
  g.drawImage(src, -src.width / 2, -src.height / 2)
  return c
}

/** Stamp a little string map (faces, zips, stains). '.' is transparent. */
export function stamp(d: Doll, rows: readonly string[], x: number, y: number, pal: Record<string, string>, flipX = false, onBody = true) {
  const w = rows[0]!.length
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]!
    for (let i = 0; i < w; i++) {
      const ch = row[flipX ? w - 1 - i : i]!
      if (ch === '.' || ch === ' ') continue
      const c = pal[ch]
      if (c) d.px(x + i, y + j, c, onBody)
    }
  }
}

export const tone = (m: Mat, i: number) => (typeof m === 'string' ? m : m[i]!)
