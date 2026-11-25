/**
 * Dig & build in the isometric view (`engine/digGround.ts`): what stands up on a dig map. A tile above the
 * ground's level is a column of that many levels with its picture on top (a 'top' shape standing on its own
 * tile); a ramp is a slope from its foot to its top; what stands on a raised tile (a chest, a lamp, a person)
 * stands that high. `view.ts` asks these and draws with its own quads.
 */
import type { GameState, MapState, TileChar, World } from '../../types'
import { TILE } from '../../types'
import { digPlan, digRise, digZ, isRamp, RAMPS } from '../../engine/index'
import { cursorColor } from '../dig'
import type { Material } from './materials'
import type { Shape } from './shape'

const T = TILE
const columns: Shape[] = []

/** A column `n` levels high on its own tile, with sides. */
function column(n: number): Shape {
  return (columns[n] ??= Object.freeze({ k: 'top', h: n * T, f: 0, d: 0, sides: true }) as Shape)
}

/** The shape tile (tx, ty) of a dig map takes instead of `sh`: a column where it stands up and is ground. */
export function digShape(m: MapState, tx: number, ty: number, sh: Shape): Shape {
  if (!m.dig) return sh
  const n = digRise(m, tx, ty)
  if (n <= 0) return sh
  return sh.k === 'flat' ? column(n) : sh
}

/** A tile that stands up but is drawn as something else (a chest or a lamp on it, a ramp): its column is drawn apart. */
export function digPlinth(m: MapState, tx: number, ty: number, sh: Shape): number {
  if (!m.dig) return 0
  const n = digRise(m, tx, ty)
  return n > 0 && (sh.k === 'card' || isRamp(m.tiles[ty * m.w + tx]!)) ? n : 0
}

/** How high (tiles) a card or a built thing standing on tile (tx, ty) stands. */
export function digLift(m: MapState, tx: number, ty: number): number {
  return m.dig ? Math.max(0, digRise(m, tx, ty)) : 0
}

/** How high (tiles) someone with their feet at (x, y) stands; 0 off a dig map. */
export function digFoot(m: MapState, x: number, y: number): number {
  return m.dig ? digZ(m, x, y) : 0
}

/** A plain raised neighbour whose picture can cap a plinth (a chest's column is turf, not chest). */
export function digCapOf(m: MapState, tx: number, ty: number): [number, number] {
  const n = digRise(m, tx, ty)
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const x = tx + dx
    const y = ty + dy
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue
    const t = m.tiles[y * m.w + x]!
    if (digRise(m, x, y) === n && (t === 'в' || t === 'а' || t === 'б' || t === 'д')) return [x, y]
  }
  return [tx, ty]
}

/** The way a ramp on tile (tx, ty) rises; undefined off the map (the land drawn beyond its edge) or on no ramp. */
function rampAt(m: MapState, tx: number, ty: number): readonly [number, number] | undefined {
  if (!m.dig || tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return undefined
  return RAMPS[m.tiles[ty * m.w + tx]!]
}

export type Corner = [number, number, number]
/** A ramp's slope: its four corners (top-left, top-right, bottom-right, bottom-left of its picture), z above the ground. */
export function rampSlope(m: MapState, tx: number, ty: number): Corner[] | null {
  const d = rampAt(m, tx, ty)
  if (!d || !m.dig) return null
  const hi = m.dig.h[ty * m.w + tx]! - m.dig.g
  const lo = hi - 1
  const z = (x: number, y: number) => {
    const f = d[1] < 0 ? ty + 1 - y : d[1] > 0 ? y - ty : d[0] > 0 ? x - tx : tx + 1 - x
    return lo + f
  }
  const c = (x: number, y: number): Corner => [x, y, z(x, y)]
  return [c(tx, ty), c(tx + 1, ty), c(tx + 1, ty + 1), c(tx, ty + 1)]
}

/**
 * The sides a ramp shows above its foot, as quads (top-left, top-right, bottom-right, bottom-left): the faces
 * toward the viewer, south and east. A side along the slope is a triangle (two corners meet); the tall end a
 * rectangle. Each comes with whether it faces east.
 */
export function rampSides(m: MapState, tx: number, ty: number): Array<{ q: Corner[]; east: boolean }> {
  const d = rampAt(m, tx, ty)
  if (!d || !m.dig) return []
  const lo = m.dig.h[ty * m.w + tx]! - m.dig.g - 1
  const hi = lo + 1
  const x1 = tx + 1
  const y1 = ty + 1
  const out: Array<{ q: Corner[]; east: boolean }> = []
  if (d[1] !== 0) {
    // Runs north or south: the east side is a triangle, tall at the high end.
    const n = d[1] < 0 ? hi : lo
    const s = d[1] < 0 ? lo : hi
    out.push({ q: [[x1, ty, n], [x1, y1, s], [x1, y1, lo], [x1, ty, lo]], east: true })
    if (d[1] > 0) out.push({ q: [[tx, y1, hi], [x1, y1, hi], [x1, y1, lo], [tx, y1, lo]], east: false })
  } else {
    // Runs east or west: the south side is a triangle.
    const w = d[0] < 0 ? hi : lo
    const e = d[0] < 0 ? lo : hi
    out.push({ q: [[tx, y1, w], [x1, y1, e], [x1, y1, lo], [tx, y1, lo]], east: false })
    if (d[0] > 0) out.push({ q: [[x1, ty, hi], [x1, y1, hi], [x1, y1, lo], [x1, ty, lo]], east: true })
  }
  return out
}

/** This view's own material for a dig tile, top or side (null: the painted picture). */
export function digMaterial(t: TileChar, top: boolean, wild: boolean): Material | null {
  switch (t) {
    case 'в': return top ? (wild ? 'moss' : 'grass') : 'rockface'
    case 'а': case 'е': return top ? null : 'rockface'
    case 'д': return top ? null : 'rockface'
    case 'б': return 'boards'
    default: return null
  }
}

/** The hero's height as drawn: it follows the ground, and drops off a ledge in a short fall instead of a cut. */
export function heroFootEase(prev: number | null, s: GameState, dt: number): number {
  const want = digFoot(s.map, s.hero.x, s.hero.y)
  if (prev === null || want >= prev || dt <= 0) return want
  return Math.max(want, prev - dt * 9)
}

/**
 * The tile a tool would work, outlined on its top (a column's, a ramp's middle, the ground under a thing),
 * over the lit scene. `at` puts a world point (tiles, z up) on the effects layer.
 */
export function digCursor(g: CanvasRenderingContext2D, world: World, s: GameState, at: (x: number, y: number, z: number) => { x: number; y: number }, time: number) {
  if (s.mode !== 'play') return
  const p = digPlan(world, s)
  if (!p) return
  const m = s.map
  const z = Math.max(0, digRise(m, p.tx, p.ty)) + (isRamp(m.tiles[p.ty * m.w + p.tx]!) ? 0.5 : 0)
  const q = [at(p.tx, p.ty, z), at(p.tx + 1, p.ty, z), at(p.tx + 1, p.ty + 1, z), at(p.tx, p.ty + 1, z)]
  g.save()
  g.globalAlpha = (p.ok ? 0.8 : 0.5) + 0.2 * Math.sin(time * 6)
  g.strokeStyle = cursorColor(p)
  g.lineWidth = 1
  g.beginPath()
  q.forEach((c, i) => (i ? g.lineTo(c.x, c.y) : g.moveTo(c.x, c.y)))
  g.closePath()
  g.stroke()
  g.restore()
}
