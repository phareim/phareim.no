/**
 * Neon Shrine (theme id `zelda`) — terrain painter.
 *
 * Everything that decides how the static room looks lives here: the terrain
 * palette, the per-tile painter and an optional ambient light pass. The
 * renderer calls paintTile() for every tile into its tile cache, then
 * paintAmbient() once over the finished room. Sprites, HUD, effects and the
 * letterbox backdrop stay in renderer.ts.
 *
 * Pure drawing: reads the tile grid through TerrainEnv, never touches game
 * state. Imports ./types only. One logical pixel = env.u (tile / 16).
 */

import type { TileChar } from './types'

type Ctx = CanvasRenderingContext2D

export interface TerrainEnv {
  /** CSS px per tile. */
  tile: number
  /** CSS px per logical pixel (tile / 16). */
  u: number
  /** Presentation seconds (stepped water frames only). */
  t: number
  /** Authored area of the room: 'overworld' | 'dungeon' | ... */
  area: string
  width: number
  height: number
  /** Tile at x,y; anything outside the room reads as '#'. */
  at(x: number, y: number): TileChar
}

/** A static light source in tile units (portal lamps). */
export interface TerrainLight {
  x: number
  y: number
  color: 'gold' | 'cyan' | 'pink'
}

/** Deterministic 0..1 hash for scenery variants. */
export function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >> 13)) | 0
  h = Math.imul(h, 1274126177)
  h = (h ^ (h >> 16)) >>> 0
  return h / 4294967295
}

// ---------------------------------------------------------------------------
// Terrain palette
// ---------------------------------------------------------------------------

const FLOOR = '#141026'
const FLOOR_DARK = '#100826'
const DIRT = '#2c1e33'
const DIRT_DARK = '#241828'
const STONE_TOP = '#3d4266'
const STONE_FACE = '#20243a'
const STONE_DARK = '#14172a'
const CANOPY = '#2c2148'
const CANOPY_DARK = '#1d1533'
const CANOPY_LITE = '#4a3a75'
const TRUNK = '#4a3220'
const CLAY = '#6e3f2a'
const CLAY_DARK = '#472818'
const WATER = '#0a2036'
const FOAM = '#8e83b8'
const GOLD = '#ffd23f'
const GOLD_DEEP = '#6e5410'
const LAV_DIM = '#7a6a9a'

function isWall(t: TileChar): boolean {
  return t === '#' || t === 'L' || t === 'B' || t === 'S'
}

function paintFloorBase(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number, dirt: boolean): void {
  g.fillStyle = dirt ? DIRT : FLOOR
  g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
  // Sparse deterministic dither — shaded clusters, never outlines.
  const u = env.u
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      const h = hash2(x * 4 + i, y * 4 + j)
      if (h > 0.82) {
        g.fillStyle = dirt ? DIRT_DARK : FLOOR_DARK
        g.fillRect(px + i * env.tile / 4, py + j * env.tile / 4, env.tile / 4 + 0.5, env.tile / 4 + 0.5)
      } else if (!dirt && h < 0.04) {
        g.fillStyle = '#1a1430'
        g.fillRect(px + i * env.tile / 4, py + j * env.tile / 4, env.tile / 4 + 0.5, env.tile / 4 + 0.5)
      }
    }
  }
  void u
}

export function paintTile(g: Ctx, env: TerrainEnv, x: number, y: number, px: number, py: number): void {
  const t = env.at(x, y)
  const u = env.u
  const v = hash2(x, y)
  switch (t) {
    case ',':
      paintFloorBase(g, env, px, py, x, y, true)
      break
    case '#': {
      // Stone wall: light top where open sky is above, dark face below.
      const above = env.at(x, y - 1)
      const openAbove = !isWall(above)
      g.fillStyle = STONE_FACE
      g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
      // Vertical face shading: darker towards the bottom.
      g.fillStyle = STONE_DARK
      g.fillRect(px, py + env.tile * 0.55, env.tile + 0.5, env.tile * 0.45 + 0.5)
      if (openAbove) {
        // Wall top: light cap + 1px lavender highlight.
        g.fillStyle = STONE_TOP
        g.fillRect(px, py, env.tile + 0.5, env.tile * 0.38 + 0.5)
        g.fillStyle = '#8e93b8'
        g.fillRect(px, py, env.tile + 0.5, Math.max(1, 1 * u) + 0.5)
        // Mortar joints.
        g.fillStyle = STONE_DARK
        const jx = px + ((x * 5 + 3) % 8) * u
        g.fillRect(jx, py + 2 * u, u, 4 * u)
      } else {
        // Buried run: faint top edge so masses read.
        g.fillStyle = '#2e3350'
        g.fillRect(px, py, env.tile + 0.5, Math.max(1, 1 * u) + 0.5)
      }
      // Side joints where a walkable env.tile touches left/right.
      const l = env.at(x - 1, y)
      const r = env.at(x + 1, y)
      if (!isWall(l) && l !== 'T' && l !== 'G' && l !== 'W') {
        g.fillStyle = STONE_TOP
        g.fillRect(px, py, 2 * u + 0.5, env.tile + 0.5)
      }
      if (!isWall(r) && r !== 'T' && r !== 'G' && r !== 'W') {
        g.fillStyle = STONE_DARK
        g.fillRect(px + env.tile - 2 * u, py, 2 * u + 0.5, env.tile + 0.5)
      }
      break
    }
    case 'T': {
      paintFloorBase(g, env, px, py, x, y, false)
      // Shadow under the canopy.
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.fillRect(px + 2 * u, py + 12 * u, 12 * u + 0.5, 2 * u + 0.5)
      // Trunk, always visible below the canopy mass.
      g.fillStyle = TRUNK
      g.fillRect(px + 7 * u, py + 9 * u, 2 * u + 0.5, 5 * u + 0.5)
      g.fillStyle = '#2a1c12'
      g.fillRect(px + 8 * u, py + 9 * u, 1 * u + 0.5, 5 * u + 0.5)
      // Canopy mass: a wide shaded crown, variant by hash. Top-light is a
      // band along the crown's top edge; pits sit along the bottom edge so
      // no face-like features appear mid-crown.
      const lift = v > 0.5 ? 0 : 1
      g.fillStyle = CANOPY_DARK
      g.fillRect(px + 1 * u, py + (3 + lift) * u, 14 * u + 0.5, 6 * u + 0.5)
      g.fillStyle = CANOPY
      g.fillRect(px + 2 * u, py + (1 + lift) * u, 12 * u + 0.5, 6 * u + 0.5)
      g.fillStyle = CANOPY_LITE
      g.fillRect(px + 3 * u, py + (1 + lift) * u, 10 * u + 0.5, u + 0.5)
      g.fillStyle = CANOPY_DARK
      g.fillRect(px + 4 * u, py + (7 + lift) * u, 3 * u + 0.5, u + 0.5)
      g.fillRect(px + (9 + (x % 2)) * u, py + (8 + lift) * u, 2 * u + 0.5, u + 0.5)
      break
    }
    case 'G': {
      paintFloorBase(g, env, px, py, x, y, false)
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.fillRect(px + 3 * u, py + 12 * u, 10 * u + 0.5, 2 * u + 0.5)
      // Slab with rounded-ish top.
      g.fillStyle = STONE_TOP
      g.fillRect(px + 5 * u, py + 3 * u, 6 * u + 0.5, 9 * u + 0.5)
      g.fillStyle = STONE_FACE
      g.fillRect(px + 5 * u, py + 9 * u, 6 * u + 0.5, 3 * u + 0.5)
      g.fillStyle = '#8e93b8'
      g.fillRect(px + 5 * u, py + 3 * u, 6 * u + 0.5, u + 0.5)
      // Carved line.
      g.fillStyle = STONE_DARK
      g.fillRect(px + 7 * u, py + 6 * u, 2 * u + 0.5, 3 * u + 0.5)
      // Base.
      g.fillStyle = STONE_DARK
      g.fillRect(px + 4 * u, py + 12 * u, 8 * u + 0.5, 2 * u + 0.5)
      break
    }
    case 'W': {
      g.fillStyle = WATER
      g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
      const n = env.at(x, y - 1)
      const s = env.at(x, y + 1)
      const l = env.at(x - 1, y)
      const r = env.at(x + 1, y)
      // Banks where water meets walkable/solid shore.
      const shore = (q: TileChar): boolean => q !== 'W'
      g.fillStyle = '#3d3457'
      if (shore(n)) g.fillRect(px, py, env.tile + 0.5, 3 * u + 0.5)
      if (shore(s)) g.fillRect(px, py + env.tile - 3 * u, env.tile + 0.5, 3 * u + 0.5)
      if (shore(l)) g.fillRect(px, py, 3 * u + 0.5, env.tile + 0.5)
      if (shore(r)) g.fillRect(px + env.tile - 3 * u, py, 3 * u + 0.5, env.tile + 0.5)
      if (shore(n)) {
        g.fillStyle = FOAM
        g.fillRect(px, py + 3 * u, env.tile + 0.5, u + 0.5)
      }
      // Still deep speck, two stepped frames.
      const f = Math.floor(env.t * 0.8 + v * 2) % 2
      g.fillStyle = 'rgba(142,131,184,0.35)'
      g.fillRect(px + (4 + f * 5) * u, py + 8 * u, 3 * u + 0.5, u + 0.5)
      break
    }
    case '~': {
      paintFloorBase(g, env, px, py, x, y, false)
      // Grass tufts: muted mauve blades, clustered.
      g.fillStyle = '#6f5f95'
      const tufts: Array<[number, number]> = [
        [3, 9], [9, 4], [11, 10], [6, 12],
      ]
      for (const [tx, ty] of tufts) {
        if (hash2(x * 7 + tx, y * 7 + ty) < 0.35) continue
        g.fillRect(px + tx * u, py + ty * u, u + 0.5, 3 * u + 0.5)
        g.fillRect(px + (tx + 2) * u, py + (ty + 1) * u, u + 0.5, 2 * u + 0.5)
        g.fillStyle = LAV_DIM
        g.fillRect(px + (tx + 1) * u, py + (ty - 1) * u, u + 0.5, u + 0.5)
        g.fillStyle = '#6f5f95'
      }
      break
    }
    case 'o': {
      paintFloorBase(g, env, px, py, x, y, false)
      g.fillStyle = 'rgba(0,0,0,0.3)'
      g.fillRect(px + 3 * u, py + 12 * u, 10 * u + 0.5, 2 * u + 0.5)
      // Clay pot: belly, neck, rim highlight.
      g.fillStyle = CLAY_DARK
      g.fillRect(px + 3 * u, py + 5 * u, 10 * u + 0.5, 8 * u + 0.5)
      g.fillStyle = CLAY
      g.fillRect(px + 4 * u, py + 4 * u, 8 * u + 0.5, 8 * u + 0.5)
      g.fillStyle = '#8a5233'
      g.fillRect(px + 4 * u, py + 4 * u, 8 * u + 0.5, 2 * u + 0.5)
      g.fillRect(px + 4 * u, py + 4 * u, 2 * u + 0.5, 8 * u + 0.5)
      // Rim.
      g.fillStyle = CLAY_DARK
      g.fillRect(px + 5 * u, py + 2 * u, 6 * u + 0.5, 3 * u + 0.5)
      g.fillStyle = '#241408'
      g.fillRect(px + 6 * u, py + 3 * u, 4 * u + 0.5, u + 0.5)
      break
    }
    case 'L':
    case 'B': {
      paintFloorBase(g, env, px, py, x, y, true)
      // Stone threshold plate.
      g.fillStyle = STONE_DARK
      g.fillRect(px + u, py + 5 * u, 14 * u + 0.5, 6 * u + 0.5)
      g.fillStyle = STONE_TOP
      g.fillRect(px + u, py + 5 * u, 14 * u + 0.5, u + 0.5)
      if (t === 'L') {
        // Wooden door + gold lock (progression focal).
        g.fillStyle = TRUNK
        g.fillRect(px + 3 * u, py + 2 * u, 10 * u + 0.5, 12 * u + 0.5)
        g.fillStyle = '#2a1c12'
        g.fillRect(px + 7 * u, py + 2 * u, 2 * u + 0.5, 12 * u + 0.5)
        g.fillStyle = GOLD
        g.fillRect(px + 7 * u, py + 7 * u, 2 * u + 0.5, 3 * u + 0.5)
        g.fillStyle = GOLD_DEEP
        g.fillRect(px + 7 * u, py + 9 * u, 2 * u + 0.5, u + 0.5)
      } else {
        // Boss gate: dark bars + gold sigil.
        g.fillStyle = '#101322'
        g.fillRect(px + 3 * u, py + 2 * u, 10 * u + 0.5, 12 * u + 0.5)
        g.fillStyle = STONE_TOP
        for (let i = 0; i < 4; i++) {
          g.fillRect(px + (4 + i * 3) * u, py + 2 * u, u + 0.5, 12 * u + 0.5)
        }
        g.fillStyle = GOLD
        g.fillRect(px + 7 * u, py + 6 * u, 2 * u + 0.5, 4 * u + 0.5)
        g.fillRect(px + 6 * u, py + 7 * u, 4 * u + 0.5, 2 * u + 0.5)
      }
      break
    }
    case 'S': {
      paintFloorBase(g, env, px, py, x, y, true)
      g.fillStyle = STONE_DARK
      g.fillRect(px + u, py + 2 * u, 14 * u + 0.5, 12 * u + 0.5)
      // Shut portcullis: slate bars with desaturated pink studs.
      g.fillStyle = '#2e3350'
      for (let i = 0; i < 4; i++) {
        g.fillRect(px + (3 + i * 3) * u, py + 2 * u, 2 * u + 0.5, 12 * u + 0.5)
      }
      g.fillStyle = '#a02060'
      for (let i = 0; i < 4; i++) {
        g.fillRect(px + (3 + i * 3) * u, py + 7 * u, 2 * u + 0.5, 2 * u + 0.5)
      }
      break
    }
    case '.':
    default:
      paintFloorBase(g, env, px, py, x, y, false)
      break
  }
}

/**
 * Optional light pass over the finished static room (room-local px, origin
 * at the room's top-left). Runs once per tile-cache rebuild.
 */
export function paintAmbient(_g: Ctx, _env: TerrainEnv, _lights: TerrainLight[]): void {
  // Base look: no ambient pass.
}
