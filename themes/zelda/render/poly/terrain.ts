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
export const SHORE_MAX = 0.45
/** The steepest the open ground gets away from water, tiles up per tile along, at `hills` 1. */
export const SLOPE_MAX = 0.6

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
  /**
   * Lattice points per tile the drawn surface needs in tile (tx, ty): `res` near water, where the shore curves,
   * and half that where the land is one cell in two (there the fine lattice's values lie on the coarse
   * triangles, so a mesh may take the coarse cells without a crack).
   */
  step(tx: number, ty: number): number
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
    // (Paving, a lane, a road lies flat: hills are for the wild land.)
    case ',': return 0.05
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

/** A lattice's value at a point: two triangles to a cell, split from the north-west corner to the south-east one. */
function onLattice(arr: ArrayLike<number>, nx: number, ny: number, x0: number, y0: number, res: number, x: number, y: number): number {
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
  return u >= v ? nw + (ne - nw) * u + (se - ne) * v : nw + (se - sw) * u + (sw - nw) * v
}

/** The land of one map in one look. Built once per map and look; `height` and `shore` are then cheap. */
export function buildLand(src: LandSource, look: LandLook): Land {
  const work = landWork(src, look)
  for (;;) { const r = work.next(); if (r.done) return r.value }
}

/**
 * The same land, built a piece at a time: every `next()` does a slice of the work (a few lattice rows) and the
 * last one returns the land. A view that must not stall a frame (a map walked into) spreads it over several.
 */
export function* landWork(src: LandSource, look: LandLook): Generator<void, Land, void> {
  const open = src.kind === 'overworld'
  /** The fine lattice; outdoors the hills are worked out on one of half its points. */
  const res = 4
  const cres = open ? 2 : 4
  const B = open ? Math.max(0, src.beyond) : 0
  const x0 = -B
  const y0 = -B
  const hills = open ? Math.max(0, look.hills) : 0
  const shoreK = open ? Math.max(0, Math.min(1, look.shore)) : 0
  const far = open ? Math.max(0, look.far) : 0
  const seed = src.seed | 0

  // The tiles of the field, read once.
  const tw = src.w + 2 * B + 2 * REACH + 8
  const th = src.h + 2 * B + 2 * REACH + 8
  const tx0 = x0 - REACH - 4
  const ty0 = y0 - REACH - 4
  const tiles: TileChar[] = new Array(tw * th)
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) tiles[j * tw + i] = src.at(tx0 + i + 0.5, ty0 + j + 0.5)
  yield
  const ti = (x: number, y: number) => Math.max(0, Math.min(th - 1, y - ty0)) * tw + Math.max(0, Math.min(tw - 1, x - tx0))
  const tile = (x: number, y: number): TileChar => tiles[ti(x, y)]!
  const wet = (x: number, y: number) => tile(x, y) === '~'

  /** Tiles near a border between water and land (within three): the shore is worked out there, and the land is fine there. */
  const coast = new Uint8Array(tw * th)
  {
    const isW = new Uint8Array(tw * th)
    for (let k = 0; k < tiles.length; k++) isW[k] = tiles[k] === '~' ? 1 : 0
    for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
      if (!isW[j * tw + i]) continue
      let border = false
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const ii = i + a, jj = j + b
        if (ii >= 0 && jj >= 0 && ii < tw && jj < th && !isW[jj * tw + ii]) border = true
      }
      if (!border) continue
      for (let b = -3; b <= 3; b++) for (let a = -3; a <= 3; a++) {
        const ii = i + a, jj = j + b
        if (ii >= 0 && jj >= 0 && ii < tw && jj < th) coast[jj * tw + ii] = 1
      }
    }
  }
  const coastal = (x: number, y: number) => coast[ti(Math.floor(x), Math.floor(y))] === 1

  /** Exact signed distance to the border between water tiles and the rest, positive on land, at most REACH. */
  function sd(x: number, y: number): number {
    const fx = Math.floor(x)
    const fy = Math.floor(y)
    const inWater = wet(fx, fy)
    if (!coastal(x, y)) return inWater ? -REACH : REACH
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

  // Tiles that must be level, and a tile and a half round houses, doors and whatever the source says must be level.
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < src.w && y < src.h
  const flatTile = (x: number, y: number): boolean => {
    const t = tile(x, y)
    return (t !== '~' && levelOf(t) === 0) || (!!src.level && inMap(x, y) && src.level(x, y))
  }
  const ringTile = (x: number, y: number): boolean => {
    const t = tile(x, y)
    return t === 'H' || t === 'D' || t === 'M' || (!!src.level && inMap(x, y) && src.level(x, y))
  }
  const ring = new Uint8Array(tw * th)
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) if (ringTile(tx0 + i, ty0 + j)) ring[j * tw + i] = 1
  const inRing = (x: number, y: number): boolean => {
    for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) {
      const tx = Math.floor(x) + a
      const ty = Math.floor(y) + b
      if (!ring[ti(tx, ty)]) continue
      const dx = Math.max(tx - x, 0, x - (tx + 1))
      const dy = Math.max(ty - y, 0, y - (ty + 1))
      if (Math.max(dx, dy) <= 1.5 + 1e-9) return true
    }
    return false
  }
  /** Does the point touch a level tile (or lie in a ring), and how freely may it rise? */
  function meets(x: number, y: number): { pinned: boolean; allow: number } {
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
    return { pinned: flat || inRing(x, y), allow: dry ? a : 0 }
  }

  // --- the shore: the distance, its corners rounded, its line set bending ------------------------------------
  // On the fine lattice, which the coarse one is every other point of.
  const nx = (src.w + 2 * B) * res + 1
  const ny = (src.h + 2 * B) * res + 1
  const k = 1 / res
  const S0 = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) S0[j * nx + i] = sd(x0 + i * k, y0 + j * k)
    if (j % 6 === 5) yield
  }
  /** Rounding: the distance averaged over a small disc of lattice points, which leaves a straight edge where it is and cuts a corner. */
  const rad = Math.round(0.6 * shoreK * res)
  const disc: number[] = []
  for (let b2 = -rad; b2 <= rad; b2++) for (let a2 = -rad; a2 <= rad; a2++) if (a2 * a2 + b2 * b2 <= rad * rad + 0.5) disc.push(a2, b2)
  /** How far the line may be pushed by the bends, before the band near it takes its share. */
  const wander = 0.72 * shoreK
  const S = new Float32Array(nx * ny)
  const pinF = new Uint8Array(nx * ny)
  const allowF = new Float32Array(nx * ny)
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = j * nx + i
      const x = x0 + i * k
      const y = y0 + j * k
      const m = meets(x, y)
      pinF[p] = m.pinned ? 1 : 0
      allowF[p] = m.allow
      const s0 = S0[p]!
      let sv = s0
      if (coastal(x, y)) {
        if (rad > 0) {
          let sum = 0
          let n = 0
          for (let q = 0; q < disc.length; q += 2) {
            const ii = Math.max(0, Math.min(nx - 1, i + disc[q]!))
            const jj = Math.max(0, Math.min(ny - 1, j + disc[q + 1]!))
            sum += S0[jj * nx + ii]!
            n++
          }
          sv = sum / n
        }
        // The line bends, slowly, in two wavelengths (about three tiles and eight): only near it, so the middle
        // of a tile stays where the rules have it. (Where the rounding works, at a corner, the bends give way
        // to it: a pond's corner is a curve, not a lobe.)
        const band = Math.max(0, 1 - Math.abs(s0) / 1.0) * Math.max(0, 1 - Math.abs(sv - s0) / 0.1)
        if (wander > 0 && band > 0) {
          const nz = (smooth(x, y, 1.5, seed + 101) * 2 - 1) * 0.6 + (smooth(x, y, 4, seed + 103) * 2 - 1) * 0.55
          sv += wander * band * Math.max(-1, Math.min(1, nz * 1.5))
        }
        // Whoever stands in the middle of a tile stands where the rules say.
        if (x - Math.floor(x) === 0.5 && y - Math.floor(y) === 0.5) sv = wet(Math.floor(x), Math.floor(y)) ? Math.min(sv, -0.1) : Math.max(sv, 0.1)
      }
      // What must stand level beside the water keeps its level: the water's edge moves out from it instead.
      if (m.pinned && open) sv = Math.max(sv, -WATER_LEVEL / BANK)
      // A point on the line itself is water's: a triangle in the corner of a pond with all three corners on its
      // edge is then under the surface, not on it.
      if (Math.abs(sv) < 0.002) sv = -0.002
      S[p] = sv
    }
    if (j % 4 === 3) yield
  }

  // --- the hills, on the coarse lattice -------------------------------------------------------------------------
  const cnx = (src.w + 2 * B) * cres + 1
  const cny = (src.h + 2 * B) * cres + 1
  const cn = cnx * cny
  const Hc = new Float32Array(cn)
  const Sc = new Float32Array(cn)
  const ratio = res / cres
  const kc = 1 / cres
  for (let j = 0; j < cny; j++) {
    for (let i = 0; i < cnx; i++) {
      const p = j * cnx + i
      const f = j * ratio * nx + i * ratio
      const x = x0 + i * kc
      const y = y0 + j * kc
      const sv = S[f]!
      Sc[p] = sv
      if (pinF[f]) { Hc[p] = 0; continue }
      let h = 0
      if (hills > 0) {
        const nn = smooth(x, y, 4.5, seed + 7) * 0.7 + smooth(x, y, 2.2, seed + 13) * 0.3
        const knoll = Math.max(0, Math.min(1, (nn - 0.22) / 0.5))
        h = hills * Math.pow(knoll, 1.2) * allowF[f]!
      }
      // Beyond the map the land rises toward the horizon: behind the map most, at its sides less, never in front.
      if (far > 0) {
        const out = Math.max(-x, x - src.w, -y, y - src.h, 0)
        if (out > 0) {
          const north = -y > Math.max(-x, x - src.w, y - src.h) ? 1 : y > src.h ? 0 : 0.6
          // (Further out it climbs in ridges, so the land meets the sky as a line of hills.)
          const ridge = 0.65 + 0.35 * smooth(x, y, 3, seed + 29) + 0.35 * Math.max(0, smooth(x, y, 7, seed + 31) - 0.4)
          h += far * north * Math.min(1, Math.max(0, (out - 0.5) / 12)) * ridge
        }
      }
      // By the water the bank is the height: the slope from it is counted from there.
      Hc[p] = sv < 0.6 ? Math.min(h, Math.max(0, WATER_LEVEL + BANK * sv)) : h
    }
    if (j % 6 === 5) yield
  }
  // No steeper than a walk: each point at most so much above its neighbours (both raster ways, until it holds).
  const stepH = SLOPE_MAX * Math.max(1e-6, Math.min(1, hills || 1)) * 0.96 * kc
  for (let pass = 0; pass < 6; pass++) {
    let changed = false
    for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
      const p = j * cnx + i
      let h = Hc[p]!
      if (i > 0 && Hc[p - 1]! + stepH < h) h = Hc[p - 1]! + stepH
      if (j > 0 && Hc[p - cnx]! + stepH < h) h = Hc[p - cnx]! + stepH
      if (h < Hc[p]!) { Hc[p] = h; changed = true }
    }
    for (let j = cny - 1; j >= 0; j--) for (let i = cnx - 1; i >= 0; i--) {
      const p = j * cnx + i
      let h = Hc[p]!
      if (i < cnx - 1 && Hc[p + 1]! + stepH < h) h = Hc[p + 1]! + stepH
      if (j < cny - 1 && Hc[p + cnx]! + stepH < h) h = Hc[p + cnx]! + stepH
      if (h < Hc[p]!) { Hc[p] = h; changed = true }
    }
    yield
    if (!changed) break
  }
  const surface = (h: number, s: number): number =>
    Math.max(WATER_LEVEL - DEEP, open ? Math.min(h, WATER_LEVEL + BANK * s) : s > -0.01 ? 0 : WATER_LEVEL - DEEP)
  const Zc = new Float32Array(cn)
  for (let p = 0; p < cn; p++) Zc[p] = surface(Hc[p]!, Sc[p]!)

  // --- the drawn surface, on the fine lattice -------------------------------------------------------------------
  // Near the water every point is worked out again (the shore curves there); elsewhere the fine points lie on the
  // coarse triangles, so the coarse cells draw the same surface.
  const Z = new Float32Array(nx * ny)
  const fineTile = (tx: number, ty: number) => !open || coastal(tx, ty)
  const fineAt = (x: number, y: number): boolean => {
    // Every tile the point touches is fine: on the edge of the fine stretch the coarse surface is kept.
    const xs = Number.isInteger(x) ? [x - 1, x] : [Math.floor(x)]
    const ys = Number.isInteger(y) ? [y - 1, y] : [Math.floor(y)]
    for (const ty of ys) for (const tx of xs) if (!fineTile(tx, ty)) return false
    return true
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const p = j * nx + i
      const x = x0 + i * k
      const y = y0 + j * k
      if (open && !fineAt(x, y)) {
        S[p] = onLattice(Sc, cnx, cny, x0, y0, cres, x, y)
        Z[p] = onLattice(Zc, cnx, cny, x0, y0, cres, x, y)
        continue
      }
      const h = open ? (pinF[p] ? 0 : onLattice(Hc, cnx, cny, x0, y0, cres, x, y)) : 0
      Z[p] = surface(h, S[p]!)
    }
    if (j % 8 === 7) yield
  }

  const height = (x: number, y: number) => onLattice(Z, nx, ny, x0, y0, res, x, y)
  return {
    res,
    waterLevel: WATER_LEVEL,
    height,
    shore(x, y) {
      // A room keeps its water on the tile edges: the line is the grid's.
      if (!open) return sd(x, y)
      // The distance as the shore was laid out, unless the drawn surface says otherwise there (inside a cell
      // the two can disagree by a hair): the drawn surface decides which side a point is on.
      const h = height(x, y)
      const a = (h - WATER_LEVEL) / BANK
      const d = onLattice(S, nx, ny, x0, y0, res, x, y)
      // (Dry ground under the level ground is the bank: it is never far from the water.)
      if (a >= 0) return d >= 0 ? (h < 0 ? Math.min(d, 0.6) : d) : a
      return d < 0 ? d : a
    },
    step: (tx, ty) => (fineTile(tx, ty) ? res : cres),
  }
}

/** A height `k` of the way through the turn (raw k; eased inside like the camera). 0 at k = 0, always. */
export function lift(land: Land, x: number, y: number, k: number): number {
  if (k <= 0) return 0
  return land.height(x, y) * (k >= 1 ? 1 : ease(k))
}

/**
 * Where something placed stands: on the land (`lift`), but never under the water's surface (scaled through the
 * turn the same way): the hook reels the hero over water, shots and pots fly over it, drops land on it.
 */
export function stand(land: Land, x: number, y: number, k: number): number {
  if (k <= 0) return 0
  return Math.max(lift(land, x, y, k), land.waterLevel * (k >= 1 ? 1 : ease(k)))
}
