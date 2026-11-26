/**
 * Terrain in the isometric view (`engine/terrain.ts`): what stands up on a map with heights. A tile above the
 * ground's level is a column of that many levels with its picture on top (a 'top' shape standing on its own
 * tile); a ramp is a slope from its foot to its top; what stands on a raised tile (a chest, a prop, a person)
 * stands that high. `view.ts` asks these and draws with its own quads.
 */
import type { GameState, MapState, TileChar } from '../../types'
import { TILE } from '../../types'
import { terrainRise, terrainZ, isRamp, RAMPS } from '../../engine/index'
import type { Material } from './materials'
import type { Shape } from './shape'

const T = TILE
const columns: Shape[] = []

/** A column `n` levels high on its own tile, with sides. */
function column(n: number): Shape {
  return (columns[n] ??= Object.freeze({ k: 'top', h: n * T, f: 0, d: 0, sides: true }) as Shape)
}

/** The shape tile (tx, ty) of a map with terrain takes instead of `sh`: a column where it stands up and is ground. */
export function terrainShape(m: MapState, tx: number, ty: number, sh: Shape): Shape {
  if (!m.terrain) return sh
  const n = terrainRise(m, tx, ty)
  if (n <= 0) return sh
  return sh.k === 'flat' ? column(n) : sh
}

/** A tile that stands up but is drawn as something else (a chest or a lamp on it, a ramp): its column is drawn apart. */
export function terrainPlinth(m: MapState, tx: number, ty: number, sh: Shape): number {
  if (!m.terrain) return 0
  const n = terrainRise(m, tx, ty)
  return n > 0 && (sh.k === 'card' || isRamp(m.tiles[ty * m.w + tx]!)) ? n : 0
}

/** How high (tiles) a card or a built thing standing on tile (tx, ty) stands. */
export function terrainLift(m: MapState, tx: number, ty: number): number {
  return m.terrain ? Math.max(0, terrainRise(m, tx, ty)) : 0
}

/** How high (tiles) someone with their feet at (x, y) stands; 0 off a map without terrain. */
export function terrainFoot(m: MapState, x: number, y: number): number {
  return m.terrain ? terrainZ(m, x, y) : 0
}

/** A plain raised neighbour whose picture can cap a plinth (a chest's column is turf, not chest). */
export function terrainCapOf(m: MapState, tx: number, ty: number): [number, number] {
  const n = terrainRise(m, tx, ty)
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
    const x = tx + dx
    const y = ty + dy
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) continue
    const t = m.tiles[y * m.w + x]!
    if (terrainRise(m, x, y) === n && (t === 'в' || t === 'а' || t === 'б' || t === 'д')) return [x, y]
  }
  return [tx, ty]
}

/** The way a ramp on tile (tx, ty) rises; undefined off the map (the land drawn beyond its edge) or on no ramp. */
function rampAt(m: MapState, tx: number, ty: number): readonly [number, number] | undefined {
  if (!m.terrain || tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return undefined
  return RAMPS[m.tiles[ty * m.w + tx]!]
}

export type Corner = [number, number, number]
/** A ramp's slope: its four corners (top-left, top-right, bottom-right, bottom-left of its picture), z above the ground. */
export function rampSlope(m: MapState, tx: number, ty: number): Corner[] | null {
  const d = rampAt(m, tx, ty)
  if (!d || !m.terrain) return null
  const hi = m.terrain.h[ty * m.w + tx]! - m.terrain.g
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
  if (!d || !m.terrain) return []
  const lo = m.terrain.h[ty * m.w + tx]! - m.terrain.g - 1
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

/** This view's own material for a terrain tile, top or side (null: the painted picture). */
export function terrainMaterial(t: TileChar, top: boolean, wild: boolean): Material | null {
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
  const want = terrainFoot(s.map, s.hero.x, s.hero.y)
  if (prev === null || want >= prev || dt <= 0) return want
  return Math.max(want, prev - dt * 9)
}
