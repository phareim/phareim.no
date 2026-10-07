/**
 * The isometric view's geometry. Pure: no canvas, no DOM.
 *
 * World points are in tiles (x east, y south). `projection(k)` gives the two
 * screen vectors of one tile step, for a turn of k: 0 is the classic view
 * (16 px east, 16 px south) and 1 the isometric one (a 2:1 diamond, 32 × 16:
 * east runs down-right, south down-left). In between the ground turns 45°
 * and tips back, so one view becomes the other without a cut. Height is
 * never scaled: a thing h px tall is h px tall on screen at every k, which
 * is what the classic art already assumes.
 */
import { TILE } from '../../types'

export interface Vec2 { x: number; y: number }
export interface Proj { ex: Vec2; ey: Vec2; k: number }

const T = TILE

export function projection(k: number): Proj {
  if (k <= 0) return { ex: { x: T, y: 0 }, ey: { x: 0, y: T }, k: 0 }
  if (k >= 1) return { ex: { x: T, y: T / 2 }, ey: { x: -T, y: T / 2 }, k: 1 }
  const th = (Math.PI / 4) * k
  const sc = (1 + (Math.SQRT2 - 1) * k) * T
  const sq = 1 - 0.5 * k
  const c = Math.cos(th)
  const s = Math.sin(th)
  return { ex: { x: c * sc, y: s * sc * sq }, ey: { x: -s * sc, y: c * sc * sq }, k }
}

/** A world point on the ground, in projected px (no camera). */
export function project(p: Proj, x: number, y: number): Vec2 {
  return { x: x * p.ex.x + y * p.ey.x, y: x * p.ex.y + y * p.ey.y }
}

/** The ground point under a projected px. */
export function unproject(p: Proj, sx: number, sy: number): Vec2 {
  const det = p.ex.x * p.ey.y - p.ey.x * p.ex.y
  return { x: (sx * p.ey.y - sy * p.ey.x) / det, y: (sy * p.ex.x - sx * p.ex.y) / det }
}

export interface Rect { x: number; y: number; w: number; h: number }

/**
 * The tiles a view can show: the ground under a screen rectangle of vw × vh
 * px centred on projected point c, reaching `rise` px further down (tall
 * things standing below the edge still show), padded and cut to the map.
 */
export function groundRect(p: Proj, c: Vec2, vw: number, vh: number, rise: number, pad: number, mapW: number, mapH: number): Rect {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [dx, dy] of [[-vw / 2, -vh / 2], [vw / 2, -vh / 2], [-vw / 2, vh / 2 + rise], [vw / 2, vh / 2 + rise]] as const) {
    const w = unproject(p, c.x + dx, c.y + dy)
    x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x)
    y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y)
  }
  const X0 = Math.max(0, Math.floor(x0) - pad)
  const Y0 = Math.max(0, Math.floor(y0) - pad)
  const X1 = Math.min(mapW, Math.ceil(x1) + pad)
  const Y1 = Math.min(mapH, Math.ceil(y1) + pad)
  return { x: X0, y: Y0, w: Math.max(1, X1 - X0), h: Math.max(1, Y1 - Y0) }
}

/** The projected bounding box of a ground rectangle (tiles), with `rise` px of room above for what stands on it. */
export function projectedBox(p: Proj, z: Rect, rise: number): { x0: number; y0: number; x1: number; y1: number } {
  const pts = [project(p, z.x, z.y), project(p, z.x + z.w, z.y), project(p, z.x, z.y + z.h), project(p, z.x + z.w, z.y + z.h)]
  return {
    x0: Math.min(...pts.map(q => q.x)),
    y0: Math.min(...pts.map(q => q.y)) - rise,
    x1: Math.max(...pts.map(q => q.x)),
    y1: Math.max(...pts.map(q => q.y)),
  }
}

/**
 * Where the view's centre goes (projected px): on the focus, but kept inside
 * the zone's projected box where the box is larger than the view, and on the
 * box's middle where it is smaller.
 */
export function centreIn(p: Proj, focus: Vec2, zone: Rect, vw: number, vh: number, rise: number): Vec2 {
  const b = projectedBox(p, zone, rise)
  const f = project(p, focus.x, focus.y)
  const fit = (v: number, lo: number, hi: number, size: number) => hi - lo <= size ? (lo + hi) / 2 : Math.max(lo + size / 2, Math.min(hi - size / 2, v))
  return { x: fit(f.x, b.x0, b.x1, vw), y: fit(f.y, b.y0, b.y1, vh) }
}

/**
 * Turn a move so that "up" on the stick is up on a screen turned by `angle`
 * (radians; a quarter of π for the isometric view). A plain rotation: the
 * eight keyboard directions land on the eight world directions, so up+right
 * walks straight north along the diamond's edge.
 */
export function turnMove(m: Vec2, angle: number): Vec2 {
  if (!angle || (!m.x && !m.y)) return m
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return { x: m.x * c + m.y * s, y: m.y * c - m.x * s }
}

/** Smooth start and stop for the turn between views. */
export function ease(k: number): number {
  const t = Math.max(0, Math.min(1, k))
  return t * t * (3 - 2 * t)
}
