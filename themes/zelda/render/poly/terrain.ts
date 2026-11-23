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
  /** Signed distance to the drawn shoreline, tiles: positive on dry land. `height` is below `waterLevel` exactly where this is negative. */
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
  void t
  throw new Error('poly/terrain.levelOf: not built')
}

/** The land of one map in one look. Built once per map and look; `height` and `shore` are then cheap. */
export function buildLand(src: LandSource, look: LandLook): Land {
  void src; void look
  throw new Error('poly/terrain.buildLand: not built')
}

/** A height `k` of the way through the turn (raw k; eased inside like the camera). 0 at k = 0, always. */
export function lift(land: Land, x: number, y: number, k: number): number {
  void land; void x; void y; void k
  throw new Error('poly/terrain.lift: not built')
}
