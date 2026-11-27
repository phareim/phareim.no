/**
 * The ground's heights (pure; `map.ts` asks it about collision, the views about where a thing stands). Only maps
 * with `MapDef.terrain` have heights (`MapState.terrain`): Lumenby's pit benches and hill terrace. Everywhere else
 * nothing here is called.
 *
 * Every tile has a height 0–4 (the ground's level `g`, default 1). A mover stands at the highest level its circle
 * touches; a tile higher than that blocks it (in a hole: higher than the ground), a lower one it steps down onto.
 * A ramp joins its height to the one below: it counts one lower until the mover's centre is past its middle on
 * the way up. Heights rows: a digit per tile, anything else is `g`.
 */
import type { GameState, MapDef, MapState, TerrainDef, TerrainState, TileChar } from '../types'

/** Ramp tiles and the way each rises. */
export const RAMPS: Partial<Record<TileChar, readonly [number, number]>> = { ж: [0, -1], з: [0, 1], и: [1, 0], й: [-1, 0] }
export const MAX_HEIGHT = 4

export const isRamp = (t: TileChar): boolean => RAMPS[t] !== undefined

export const groundOf = (d: TerrainDef): number => Math.max(1, Math.min(MAX_HEIGHT, d.ground ?? 1))

const baseCache = new WeakMap<MapDef, number[]>()

/** The authored heights of a map with terrain, row-major. */
export function baseHeights(def: MapDef): number[] {
  let out = baseCache.get(def)
  if (out) return out
  const g = groundOf(def.terrain!)
  const rows = def.terrain!.heights
  const h = def.rows.length
  const w = def.rows[0]!.length
  out = new Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows?.[y]?.[x]
    const n = ch !== undefined && ch >= '0' && ch <= '9' ? Math.min(MAX_HEIGHT, Number(ch)) : g
    out[y * w + x] = n
  }
  baseCache.set(def, out)
  return out
}

export function heightAt(m: MapState, tx: number, ty: number): number {
  if (!m.terrain || tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return m.terrain?.g ?? 0
  return m.terrain.h[ty * m.w + tx]!
}

/** How far up a ramp (0 at its foot, 1 at its top) the point (x, y) on it is. */
export function rampFrac(d: readonly [number, number], tx: number, ty: number, x: number, y: number): number {
  const f = d[1] < 0 ? ty + 1 - y : d[1] > 0 ? y - ty : d[0] > 0 ? x - tx : tx + 1 - x
  return Math.max(0, Math.min(1, f))
}

/** The level tile (tx, ty) holds up a mover whose centre is at (x, y). */
function standOn(m: MapState, tx: number, ty: number, x: number, y: number): number {
  const h = heightAt(m, tx, ty)
  const r = RAMPS[m.tiles[ty * m.w + tx]!]
  if (!r) return h
  if (Math.floor(x) !== tx || Math.floor(y) !== ty) return h - 1
  return rampFrac(r, tx, ty, x, y) >= 0.5 ? h : h - 1
}

function touches(x: number, y: number, r: number, tx: number, ty: number): boolean {
  const cx = Math.max(tx, Math.min(x, tx + 1))
  const cy = Math.max(ty, Math.min(y, ty + 1))
  return (x - cx) ** 2 + (y - cy) ** 2 < r * r - 1e-9
}

/** The level a circle at (x, y) stands at: the highest that holds it up. */
export function terrainLevel(m: MapState, x: number, y: number, r: number): number {
  let z = -1
  for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
    if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || !touches(x, y, r, tx, ty)) continue
    z = Math.max(z, standOn(m, tx, ty, x, y))
  }
  return z < 0 ? heightAt(m, Math.floor(x), Math.floor(y)) : z
}

/**
 * Does tile (tx, ty) rise above a mover standing at level z? (A ramp can be walked onto from one below its top.)
 * Below the ground (in a hole) a mover reaches one up, to the ground and no higher: a hole is no trap.
 */
export function terrainAbove(m: MapState, tx: number, ty: number, z: number): boolean {
  if (!m.terrain || tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return false
  const h = m.terrain.h[ty * m.w + tx]!
  const reach = z < m.terrain.g ? z + 1 : z
  return isRamp(m.tiles[ty * m.w + tx]!) ? h - 1 > reach : h > reach
}

/**
 * How high above the ground a thing standing at (x, y) is drawn, in tiles: up a ramp smoothly, on the highest
 * tile under its foot elsewhere, a little sunk in a hole. 0 off a map without terrain.
 */
export function terrainZ(m: MapState, x: number, y: number, r = 0.3): number {
  if (!m.terrain) return 0
  const tx = Math.floor(x)
  const ty = Math.floor(y)
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return 0
  const t = m.tiles[ty * m.w + tx]!
  const d = RAMPS[t]
  const z = d ? m.terrain.h[ty * m.w + tx]! - 1 + rampFrac(d, tx, ty, x, y) : terrainLevel(m, x, y, r)
  return Math.max(-0.3, z - m.terrain.g)
}

/** How high the top of tile (tx, ty) stands above the ground (a ramp: its foot), in levels; 0 off a map without terrain. */
export function terrainRise(m: MapState, tx: number, ty: number): number {
  if (!m.terrain || tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return 0
  const h = m.terrain.h[ty * m.w + tx]! - (isRamp(m.tiles[ty * m.w + tx]!) ? 1 : 0)
  return h - m.terrain.g
}

/** A map being loaded (`loadMap`): its heights, the hero at the ground's level until the first step. */
export function terrainLoad(def: MapDef): TerrainState {
  const g = groundOf(def.terrain!)
  return { h: baseHeights(def).slice(), g, z: g }
}

/** Is tile (tx, ty) above the reach of a hero at level `z` (a chest on a ledge)? A talks and opens only at its own level or below. */
export function outOfReach(s: GameState, tx: number, ty: number, z = s.map.terrain?.z ?? 0): boolean {
  const m = s.map
  if (!m.terrain || tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return false
  return m.terrain.h[ty * m.w + tx]! > z
}
