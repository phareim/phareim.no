/**
 * The land as the polygon view shows it: hills, banks and a shoreline that
 * wanders. Pure: reads tile chars only.
 *
 * The rules of the game stay on the flat grid (`engine/`, `world/`): a tile
 * is walkable or it is not, and water begins at a tile's edge. This module
 * only says how that grid is drawn once the world is polygons:
 *
 * - **Hills.** Open ground rises in knolls between the things that must
 *   stand level. Never below zero: roads, houses and walls lie in the low
 *   ground and the land swells between them.
 * - **Banks.** By water the ground dips under the water's surface, so the
 *   shore is where the land meets that plane, a line the grid never drew.
 * - **The shoreline** leaves the tile edge by at most `SHORE_MAX` tiles: a
 *   square pond's corners are round, a straight coast wanders. Whoever
 *   stands in the middle of a walkable tile stands dry, and the middle of
 *   every water tile is wet.
 *
 * What the player reads rules from is level (height exactly 0): every tile
 * `levelOf` gives 0, and one tile round houses, doors and whatever the
 * source says must be level (an exit's own tiles). Rooms and dungeons are
 * level everywhere and their water keeps its tile edges.
 *
 * Everything here is the picture at the end of the turn. The view scales it
 * by the turn's k (`lift`), so at k = 0 the land is the classic flat one and
 * the hand-off can lie on the classic picture. One height lifts everything
 * that is placed: the ground's own mesh, whoever walks, what stands, lights,
 * shots, sparks, shadows and the HUD's idea of where the hero is.
 */
import type { MapKind, TileChar } from '../../types'
import { ease } from '../iso/project'

/** The furthest the drawn shoreline lies from the tile edge the rules use, tiles. */
export const SHORE_MAX = 0.35
/** The steepest the open ground gets away from water, tiles up per tile along, at `hills` 1. */
export const SLOPE_MAX = 0.5

export interface LandSource {
  /** The map's size, tiles. */
  w: number
  h: number
  kind: MapKind
  /** The tile at any point, beyond the map's edge too (`render/beyond.ts` says what lies there). */
  at(x: number, y: number): TileChar
  /** Tiles that must stand level whatever they are (an exit's cabinet, a stall). */
  level?(x: number, y: number): boolean
  /** How far beyond the map the land goes on (0: it ends at the edge). */
  beyond: number
  /** The same map and seed give the same land, on every machine. */
  seed: number
}

export interface LandLook {
  /** The height of the tallest knoll on the map, tiles. 0: flat. */
  hills: number
  /** How far the shoreline leaves the tile edge, 0 (it is the tile edge, corners square) … 1 (`SHORE_MAX`). */
  shore: number
  /** How far the land beyond the map's edge rises toward the horizon, tiles. */
  far: number
}

export interface Land {
  /** Lattice points per tile: the ground's mesh has its corners on this lattice. */
  res: number
  /** The water's surface, tiles (below 0). */
  waterLevel: number
  /**
   * The ground's height at a point, tiles, at the end of the turn. It is the
   * drawn surface itself: on the lattice it is the lattice's value, and
   * inside a cell it follows the cell's two triangles (split along the
   * diagonal from the north-west corner to the south-east one).
   */
  height(x: number, y: number): number
  /**
   * Signed distance to the drawn shoreline, tiles: positive on dry land. `height` is below `waterLevel` exactly
   * where this is negative. (In a room the water keeps its tile edges and its floor is level to them, so there the
   * drawn water falls away inside the edge, and in the cell at a pool's corner the surface is a hair short of it.)
   */
  shore(x: number, y: number): number
}

/**
 * How freely a tile's ground may rise: 1 open ground (grass, flowers, tall
 * grass, bushes, trees, rocks, lamps, signs, graves), in between for what is
 * laid or carried (a path, sand, a fence, a pot, a chest), 0 for what must
 * stand level (walls and cliffs, houses, doors and stairs, bridges, water's
 * own tiles, pits, plates, spikes, blocks and crystal things, hook posts,
 * letter stones, levers, vines, cracked rock, counters, pillars, furniture,
 * barriers).
 */
export function levelOf(t: TileChar): number {
  switch (t) {
    case '.': case ':': case ';': case '*': case 'T': case 'r': case 't': case 'S': case 'G':
      return 1
    case '-': return 0.6
    case 'o': return 0.5
    case '$': return 0.4
    case 'F': return 0.4
    case ',': return 0.3
    default: return 0
  }
}

/** The water's surface, tiles under the level ground. */
const WATER_LEVEL = -0.18
/** How steeply a bank falls into the water, tiles down per tile out. */
const BANK = 1
/** Open water lies no deeper than this under its surface. */
const DEEP = 0.55
/** How far the signed distance to the water is looked for, tiles (it is this much at most). */
const REACH = 2

function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth value noise, 0..1, one cell to `size` tiles. */
function smooth(x: number, y: number, size: number, seed: number): number {
  const fx = x / size
  const fy = y / size
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const u = fx - x0
  const v = fy - y0
  const su = u * u * (3 - 2 * u)
  const sv = v * v * (3 - 2 * v)
  const a = hash(x0, y0, seed)
  const b = hash(x0 + 1, y0, seed)
  const c = hash(x0, y0 + 1, seed)
  const d = hash(x0 + 1, y0 + 1, seed)
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv
}

/** The land of one map in one look. Built once per map and look; `height` and `shore` are then cheap. */
export function buildLand(src: LandSource, look: LandLook): Land {
  const open = src.kind === 'overworld'
  const res = open ? 2 : 4
  const cell = 1 / res
  const B = open ? Math.max(0, src.beyond) : 0
  const x0 = -B
  const y0 = -B
  const nx = (src.w + 2 * B) * res + 1
  const ny = (src.h + 2 * B) * res + 1
  const n = nx * ny
  const hills = open ? Math.max(0, look.hills) : 0
  const shoreK = open ? Math.max(0, Math.min(1, look.shore)) : 0
  const far = open ? Math.max(0, look.far) : 0
  const seed = src.seed | 0

  // The tiles of the field, read once.
  const tw = src.w + 2 * B + 2 * REACH + 2
  const th = src.h + 2 * B + 2 * REACH + 2
  const tx0 = x0 - REACH - 1
  const ty0 = y0 - REACH - 1
  const tiles: TileChar[] = new Array(tw * th)
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) tiles[j * tw + i] = src.at(tx0 + i + 0.5, ty0 + j + 0.5)
  const tile = (x: number, y: number): TileChar => {
    const i = Math.max(0, Math.min(tw - 1, x - tx0))
    const j = Math.max(0, Math.min(th - 1, y - ty0))
    return tiles[j * tw + i]!
  }
  const wet = (x: number, y: number) => tile(x, y) === '~'

  /** Exact signed distance to the border between water tiles and the rest, positive on land, at most REACH. */
  function sd(x: number, y: number): number {
    const fx = Math.floor(x)
    const fy = Math.floor(y)
    const inWater = wet(fx, fy)
    let best = REACH
    for (let j = fy - REACH; j <= fy + REACH; j++) for (let i = fx - REACH; i <= fx + REACH; i++) {
      if (wet(i, j) === inWater) continue
      const dx = Math.max(i - x, 0, x - (i + 1))
      const dy = Math.max(j - y, 0, y - (j + 1))
      const d = Math.hypot(dx, dy)
      if (d < best) best = d
    }
    return inWater ? -best : best
  }
  /** Is there water near this tile (else the distance is REACH and nothing round it needs working out)? */
  const near = new Uint8Array(tw * th)
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
    if (tiles[j * tw + i] !== '~') continue
    for (let b = -REACH - 1; b <= REACH + 1; b++) for (let a = -REACH - 1; a <= REACH + 1; a++) {
      const ii = i + a
      const jj = j + b
      if (ii >= 0 && jj >= 0 && ii < tw && jj < th) near[jj * tw + ii] = 1
    }
  }
  const isNear = (x: number, y: number) => near[Math.max(0, Math.min(th - 1, Math.floor(y) - ty0)) * tw + Math.max(0, Math.min(tw - 1, Math.floor(x) - tx0))] === 1

  // --- the shore: the distance, its corners rounded, its line set wandering --------------------------------
  /** Rounding: the distance is averaged over a small disc, which leaves a straight edge where it is and cuts a corner. */
  const rho = 0.5 * shoreK
  const disc: Array<[number, number]> = [[0, 0]]
  for (let i = 0; i < 8; i++) disc.push([Math.cos(i * Math.PI / 4) * rho * 0.5, Math.sin(i * Math.PI / 4) * rho * 0.5])
  for (let i = 0; i < 12; i++) disc.push([Math.cos((i + 0.5) * Math.PI / 6) * rho, Math.sin((i + 0.5) * Math.PI / 6) * rho])
  const wander = 0.2 * shoreK
  const S = new Float32Array(n)
  /** How freely each point may rise (the least of the tiles that meet there), and whether it must stand level. */
  const allow = new Float32Array(n)
  const pinned = new Uint8Array(n)

  // Tiles that must be level, and one tile round houses, doors and whatever the source says must be level.
  const flatTile = (x: number, y: number): boolean => {
    const t = tile(x, y)
    return (t !== '~' && levelOf(t) === 0) || (!!src.level && x >= 0 && y >= 0 && x < src.w && y < src.h && src.level(x, y))
  }
  const ringTile = (x: number, y: number): boolean => {
    const t = tile(x, y)
    return t === 'H' || t === 'D' || t === 'M' || (!!src.level && x >= 0 && y >= 0 && x < src.w && y < src.h && src.level(x, y))
  }
  const ringMask = new Uint8Array(tw * th)
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
    if (!ringTile(tx0 + i, ty0 + j)) continue
    // (A tile and a half round, so that every cell a point within one tile of it lies in has all its corners down.)
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
      const ii = i + a
      const jj = j + b
      if (ii >= 0 && jj >= 0 && ii < tw && jj < th) ringMask[jj * tw + ii] = 1
    }
  }
  const inRing = (x: number, y: number): boolean => {
    // The ring reaches 1.5 tiles out from the tile's edges: the tiles of the mask within that.
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
      const i = Math.floor(x) + a - tx0
      const j = Math.floor(y) + b - ty0
      if (i < 0 || j < 0 || i >= tw || j >= th || !ringTile(tx0 + i, ty0 + j)) continue
      const tx = tx0 + i
      const ty = ty0 + j
      const dx = Math.max(tx - x, 0, x - (tx + 1))
      const dy = Math.max(ty - y, 0, y - (ty + 1))
      if (Math.max(dx, dy) <= 1.5 + 1e-9) return true
    }
    return false
  }

  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * cell
    const y = y0 + j * cell
    const p = j * nx + i
    // The tiles that meet at this point (one, two or four).
    const xs = Number.isInteger(x) ? [x - 1, x] : [Math.floor(x)]
    const ys = Number.isInteger(y) ? [y - 1, y] : [Math.floor(y)]
    let a = 1
    let flat = false
    let dry = false
    for (const ty of ys) for (const tx of xs) {
      const t = tile(tx, ty)
      if (t !== '~') { a = Math.min(a, levelOf(t)); dry = true }
      if (flatTile(tx, ty)) flat = true
    }
    if (!dry) a = 0
    const ringed = ringMask[Math.max(0, Math.min(th - 1, Math.floor(y) - ty0)) * tw + Math.max(0, Math.min(tw - 1, Math.floor(x) - tx0))] === 1 && inRing(x, y)
    if (flat || ringed) pinned[p] = 1
    allow[p] = a

    let s = REACH
    if (isNear(x, y)) {
      if (rho > 0) {
        let sum = 0
        for (const [dx, dy] of disc) sum += sd(x + dx, y + dy)
        s = sum / disc.length
      } else s = sd(x, y)
      // The line wanders: only near it, so the middle of a tile stays where the rules have it.
      const s0 = sd(x, y)
      const band = Math.max(0, 1 - Math.abs(s0) / 0.45)
      if (wander > 0 && band > 0) s += wander * band * ((smooth(x, y, 1.7, seed + 101) * 2 - 1) * 0.75 + (smooth(x, y, 0.8, seed + 103) * 2 - 1) * 0.35)
      // Whoever stands in the middle of a tile stands where the rules say.
      if (res % 2 === 0 && x - Math.floor(x) === 0.5 && y - Math.floor(y) === 0.5) s = wet(Math.floor(x), Math.floor(y)) ? Math.min(s, -0.1) : Math.max(s, 0.1)
    }
    // What must stand level beside the water keeps its level: the water's edge moves out from it instead.
    if (pinned[p] && open) s = Math.max(s, -WATER_LEVEL / BANK)
    // A point on the line itself is water's: a triangle in the corner of a pond with all three corners on its
    // edge is then under the surface, not on it.
    if (Math.abs(s) < 0.002) s = -0.002
    S[p] = s
  }

  // --- the hills ------------------------------------------------------------------------------------------
  const H = new Float32Array(n)
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const p = j * nx + i
    const x = x0 + i * cell
    const y = y0 + j * cell
    if (pinned[p]) { H[p] = 0; continue }
    let h = 0
    if (hills > 0) {
      const nn = smooth(x, y, 4.5, seed + 7) * 0.7 + smooth(x, y, 2.2, seed + 13) * 0.3
      const knoll = Math.max(0, Math.min(1, (nn - 0.3) / 0.55))
      h = hills * Math.pow(knoll, 1.4) * allow[p]!
    }
    // Beyond the map the land rises toward the horizon: behind the map most, at its sides less, never in front.
    if (far > 0) {
      const out = Math.max(-x, x - src.w, -y, y - src.h, 0)
      if (out > 0) {
        const north = -y > Math.max(-x, x - src.w, y - src.h) ? 1 : y > src.h ? 0 : 0.6
        h += far * north * Math.min(1, Math.max(0, (out - 0.5) / 7)) * (0.75 + 0.25 * smooth(x, y, 3, seed + 29))
      }
    }
    // By the water the bank is the height: the slope from it is counted from there.
    H[p] = S[p]! < 0.6 ? Math.min(h, Math.max(0, WATER_LEVEL + BANK * S[p]!)) : h
  }
  // No steeper than a walk: each point at most so much above its neighbours (twice over the field, both ways).
  const step = SLOPE_MAX * Math.max(1e-6, Math.min(1, hills || 1)) * 0.96 * cell
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const p = j * nx + i
      let h = H[p]!
      if (i > 0 && H[p - 1]! + step < h) h = H[p - 1]! + step
      if (j > 0 && H[p - nx]! + step < h) h = H[p - nx]! + step
      if (h < H[p]!) { H[p] = h; changed = true }
    }
    for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
      const p = j * nx + i
      let h = H[p]!
      if (i < nx - 1 && H[p + 1]! + step < h) h = H[p + 1]! + step
      if (j < ny - 1 && H[p + nx]! + step < h) h = H[p + nx]! + step
      if (h < H[p]!) { H[p] = h; changed = true }
    }
    if (!changed) break
  }

  // --- the drawn surface ----------------------------------------------------------------------------------
  const Z = new Float64Array(n)
  for (let p = 0; p < n; p++) {
    const s = S[p]!
    // A room's floor is level to the water's edge, and its water falls away at once.
    const h = open ? Math.min(H[p]!, WATER_LEVEL + BANK * s) : s > -0.01 ? 0 : WATER_LEVEL - DEEP
    Z[p] = Math.max(WATER_LEVEL - DEEP, h)
  }

  function lattice(arr: Float64Array | Float32Array, x: number, y: number): number {
    const fx = Math.max(0, Math.min(nx - 1, (x - x0) * res))
    const fy = Math.max(0, Math.min(ny - 1, (y - y0) * res))
    let i = Math.floor(fx)
    let j = Math.floor(fy)
    if (i >= nx - 1) i = nx - 2
    if (j >= ny - 1) j = ny - 2
    if (i < 0 || j < 0) return arr[0]!
    const u = fx - i
    const v = fy - j
    const p = j * nx + i
    const nw = arr[p]!
    const ne = arr[p + 1]!
    const sw = arr[p + nx]!
    const se = arr[p + nx + 1]!
    // Two triangles to a cell, split from the north-west corner to the south-east one.
    return u >= v ? nw + (ne - nw) * u + (se - ne) * v : nw + (se - sw) * u + (sw - nw) * v
  }

  const height = (x: number, y: number) => lattice(Z, x, y)
  return {
    res,
    waterLevel: WATER_LEVEL,
    height,
    shore(x, y) {
      // A room keeps its water on the tile edges: the line is the grid's. (Its water falls away from the edge
      // within a cell, so in the corner of a pool the drawn water is a hair short of the line.)
      if (!open) return sd(x, y)
      // The distance as the shore was laid out, unless the drawn surface says otherwise there (inside a cell
      // the two can disagree by a hair): the drawn surface decides which side a point is on.
      const h = height(x, y)
      const a = (h - WATER_LEVEL) / BANK
      const d = lattice(S, x, y)
      // (Dry ground under the level ground is the bank: it is never far from the water.)
      if (a >= 0) return d >= 0 ? (h < 0 ? Math.min(d, 0.6) : d) : a
      return d < 0 ? d : a
    },
  }
}

/** A height `k` of the way through the turn (raw k; eased inside like the camera). 0 at k = 0, always. */
export function lift(land: Land, x: number, y: number, k: number): number {
  if (k <= 0) return 0
  return land.height(x, y) * (k >= 1 ? 1 : ease(k))
}
