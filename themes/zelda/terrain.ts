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
// Terrain palette — "teal dusk" variant (LTTP Light World at blue hour).
// Ground: desaturated teal-green mid-dark; path: warm muted plum-sand and
// the lightest large shape; canopy: deep blue-teal with lavender-mint rim;
// boundary: lavender-grey cliff ledge over striated violet-slate face;
// stone: violet-slate (hue split from the teal ground); water: deep indigo.
// All terrain stays muted so cyan/pink/gold sprites pop.
// ---------------------------------------------------------------------------

const FLOOR = '#26474c'
const FLOOR_DARK = '#1c363b'
const FLOOR_TICK = '#4d7a74'
const FLOOR_FLOWER = '#a8b8a0'
const FLOOR_PEBBLE = '#5a6e70'
const PATH = '#5a4658'
const PATH_DARK = '#463647'
const PATH_LITE = '#6e5870'
const PATH_PEBBLE = '#7a6478'
const CLIFF_TOP = '#9aa8b8'
const CLIFF_TOPLINE = '#cfd8e0'
const CLIFF_FACE = '#3a4358'
const CLIFF_DARK = '#232839'
const CLIFF_STRIPE = '#4a5468'
const STONE_TOP = '#5a6486'
const STONE_FACE = '#2e3348'
const STONE_DARK = '#1b1f30'
const STONE_LINE = '#8e93b8'
const CANOPY = '#1d4a50'
const CANOPY_DARK = '#0e2428'
const CANOPY_RIM = '#b8e0d0'
const CANOPY_MID = '#2f6a70'
const TRUNK = '#4a3428'
const TRUNK_DARK = '#2a1c14'
const SHADOW = '#14282c'
const CLAY = '#6e4a30'
const CLAY_DARK = '#472818'
const WATER = '#16294d'
const WATER_DARK = '#0e1c38'
const WATER_GLEAM = '#3e5a8a'
const BANK = '#6e5f52'
const FOAM = '#cfd8e8'
const GOLD = '#ffd23f'
const GOLD_DEEP = '#6e5410'
const LAV_DIM = '#7a6a9a'

function isWall(t: TileChar): boolean {
  return t === '#' || t === 'L' || t === 'B' || t === 'S'
}

function paintFloorBase(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number, dirt: boolean): void {
  const base = dirt ? PATH : FLOOR
  const dark = dirt ? PATH_DARK : FLOOR_DARK
  g.fillStyle = base
  g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
  const u = env.u
  // One calm checker dip per tile at most: a 4u shaded corner chosen by hash.
  const corner = Math.floor(hash2(x, y) * 4)
  g.fillStyle = dark
  const cx = (corner % 2) * 12 * u
  const cy = Math.floor(corner / 2) * 12 * u
  g.fillRect(px + cx, py + cy, 4 * u + 0.5, 4 * u + 0.5)
  if (!dirt) {
    // Sparse deliberate motifs: at most one per tile, many tiles plain.
    const m = hash2(x * 3 + 11, y * 5 + 7)
    const mx = Math.floor(hash2(x * 7 + 1, y * 3 + 2) * 11) * u
    const my = Math.floor(hash2(x * 5 + 3, y * 7 + 5) * 11) * u
    if (m < 0.22) {
      // Grass ticks: two lighter blades.
      g.fillStyle = FLOOR_TICK
      g.fillRect(px + mx, py + my, u + 0.5, 3 * u + 0.5)
      g.fillRect(px + mx + 2 * u, py + my + u, u + 0.5, 2 * u + 0.5)
    } else if (m < 0.30) {
      // Tiny pale flower: stem + 2px head.
      g.fillStyle = FLOOR_TICK
      g.fillRect(px + mx + u, py + my, u + 0.5, 3 * u + 0.5)
      g.fillStyle = FLOOR_FLOWER
      g.fillRect(px + mx, py + my, 3 * u + 0.5, 2 * u + 0.5)
    } else if (m < 0.42) {
      // Single pebble.
      g.fillStyle = FLOOR_PEBBLE
      g.fillRect(px + mx, py + my + u, 2 * u + 0.5, 2 * u + 0.5)
      g.fillStyle = FLOOR_DARK
      g.fillRect(px + mx, py + my + 2 * u, 2 * u + 0.5, u + 0.5)
    }
  } else {
    // Trail wear: two short broken ruts + one pebble, positions from hash.
    const r = Math.floor(hash2(x * 3 + 5, y * 7 + 1) * 3)
    const ry = Math.floor(hash2(x * 7 + 2, y * 3 + 8) * 6) * u
    g.fillStyle = PATH_DARK
    g.fillRect(px + (3 + r) * u, py + ry, u + 0.5, 8 * u + 0.5)
    g.fillRect(px + (11 - r) * u, py + ((ry + 5 * u) % (8 * u)), u + 0.5, 8 * u + 0.5)
    g.fillStyle = PATH_PEBBLE
    const qx = Math.floor(hash2(x * 11 + 2, y * 5 + 9) * 12) * u
    const qy = Math.floor(hash2(x * 5 + 8, y * 11 + 4) * 12) * u
    g.fillRect(px + qx, py + qy, 2 * u + 0.5, u + 0.5)
  }
  void u
}

export function paintTile(g: Ctx, env: TerrainEnv, x: number, y: number, px: number, py: number): void {
  const t = env.at(x, y)
  const u = env.u
  const v = hash2(x, y)
  switch (t) {
    case ',': {
      paintFloorBase(g, env, px, py, x, y, true)
      // Worn-trail edges: where the neighbor is not path, feather a soft
      // irregular border 1-3u into this tile with rounded outer corners.
      const n = env.at(x, y - 1) !== ','
      const s = env.at(x, y + 1) !== ','
      const l = env.at(x - 1, y) !== ','
      const r = env.at(x + 1, y) !== ','
      const wob = 1 + Math.floor(v * 2.99)
      g.fillStyle = FLOOR
      if (n) g.fillRect(px, py, env.tile + 0.5, wob * u + 0.5)
      if (s) g.fillRect(px, py + env.tile - wob * u, env.tile + 0.5, wob * u + 0.5)
      if (l) g.fillRect(px, py, wob * u + 0.5, env.tile + 0.5)
      if (r) g.fillRect(px + env.tile - wob * u, py, wob * u + 0.5, env.tile + 0.5)
      // Round the outer corners: punch ground colour into path corners
      // where both adjacent sides are non-path.
      g.fillStyle = FLOOR
      if (n && l) g.fillRect(px, py, 3 * u + 0.5, 3 * u + 0.5)
      if (n && r) g.fillRect(px + env.tile - 3 * u, py, 3 * u + 0.5, 3 * u + 0.5)
      if (s && l) g.fillRect(px, py + env.tile - 3 * u, 3 * u + 0.5, 3 * u + 0.5)
      if (s && r) g.fillRect(px + env.tile - 3 * u, py + env.tile - 3 * u, 3 * u + 0.5, 3 * u + 0.5)
      // Light top lip on the trail where ground continues below.
      if (s && !n) {
        g.fillStyle = PATH_LITE
        g.fillRect(px + 2 * u, py, 12 * u + 0.5, u + 0.5)
      }
      break
    }
    case '#': {
      if (env.area === 'overworld') {
        // CLIFF band: lit lavender-grey ledge on top, striated
        // violet-slate face below. A ledge highlight shows where
        // walkable ground touches below or beside; buried mass is dark.
        const below = env.at(x, y + 1)
        const left = env.at(x - 1, y)
        const right = env.at(x + 1, y)
        const open = (q: TileChar): boolean => !isWall(q) && q !== 'T' && q !== 'G' && q !== 'W'
        const exposed = open(below) || open(left) || open(right)
        g.fillStyle = exposed ? CLIFF_FACE : CLIFF_DARK
        g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
        // Rock striations: two horizontal bands, offset by hash.
        g.fillStyle = CLIFF_STRIPE
        const off = Math.floor(v * 4) * u
        g.fillRect(px, py + (6 * u + off), env.tile + 0.5, u + 0.5)
        g.fillRect(px + 3 * u, py + (11 * u + off) % (14 * u), 10 * u + 0.5, u + 0.5)
        // Dark base where the face meets the ground below.
        if (open(below)) {
          g.fillStyle = CLIFF_DARK
          g.fillRect(px, py + env.tile - 3 * u, env.tile + 0.5, 3 * u + 0.5)
        }
        // Lit ledge: full cap where ground is directly below, side lips
        // where ground touches left/right.
        if (open(below)) {
          g.fillStyle = CLIFF_TOP
          g.fillRect(px, py, env.tile + 0.5, 6 * u + 0.5)
          g.fillStyle = CLIFF_TOPLINE
          g.fillRect(px, py, env.tile + 0.5, u + 0.5)
          // Ledge joints.
          g.fillStyle = CLIFF_FACE
          const jx = px + ((x * 5 + 3) % 8) * u
          g.fillRect(jx, py + 2 * u, u, 4 * u)
        } else {
          // Side lips: dimmer ledge where ground touches left/right, no
          // near-white line (that read as neon at room scale).
          if (open(left)) {
            g.fillStyle = CLIFF_TOP
            g.fillRect(px, py, 2 * u + 0.5, env.tile + 0.5)
          }
          if (open(right)) {
            g.fillStyle = CLIFF_DARK
            g.fillRect(px + env.tile - 3 * u, py, 3 * u + 0.5, env.tile + 0.5)
          }
          // Buried run: faint top edge so masses read.
          const above = env.at(x, y - 1)
          if (isWall(above)) {
            g.fillStyle = CLIFF_STRIPE
            g.fillRect(px, py, env.tile + 0.5, u + 0.5)
          }
        }
        break
      }
      // Dungeon brick: light top where open sky is above, dark face below.
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
        g.fillStyle = STONE_LINE
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
      // Canopy MASS: merges with adjacent 'T' tiles. Only outer corners
      // are rounded; the top/left rim catches lavender-mint light; the
      // bottom edge carries near-black shade.
      const tN = env.at(x, y - 1) === 'T'
      const tS = env.at(x, y + 1) === 'T'
      const tW = env.at(x - 1, y) === 'T'
      const tE = env.at(x + 1, y) === 'T'
      // Ground shadow only where the tile below is not canopy.
      if (!tS) {
        g.fillStyle = SHADOW
        g.fillRect(px + 2 * u, py + 13 * u, 12 * u + 0.5, 2 * u + 0.5)
      }
      // Trunk + ground shadow only where the tile below is not 'T'.
      if (!tS) {
        g.fillStyle = TRUNK
        g.fillRect(px + 7 * u, py + 10 * u, 2 * u + 0.5, 4 * u + 0.5)
        g.fillStyle = TRUNK_DARK
        g.fillRect(px + 8 * u, py + 10 * u, u + 0.5, 4 * u + 0.5)
      }
      // Crown body: full-bleed on joined sides, inset 1u on outer sides.
      const ix0 = tW ? 0 : 1
      const ix1 = tE ? 16 : 15
      const iy0 = tN ? 0 : 2
      const iy1 = tS ? 16 : 13
      g.fillStyle = CANOPY_DARK
      g.fillRect(px + ix0 * u, py + iy0 * u, (ix1 - ix0) * u + 0.5, (iy1 - iy0) * u + 0.5)
      g.fillStyle = CANOPY
      g.fillRect(px + ix0 * u, py + iy0 * u, (ix1 - ix0) * u + 0.5, (iy1 - iy0 - 2) * u + 0.5)
      g.fillStyle = CANOPY_MID
      g.fillRect(px + (ix0 + 1) * u, py + (iy0 + 1) * u, (ix1 - ix0 - 2) * u + 0.5, 3 * u + 0.5)
      // Foliage texture: two mid-tone ticks in the crown, hash-placed.
      const f1x = ix0 + 2 + Math.floor(v * 5)
      const f1y = iy0 + 5 + Math.floor(hash2(x * 13 + 1, y * 7 + 3) * 3)
      g.fillRect(px + f1x * u, py + f1y * u, 3 * u + 0.5, 2 * u + 0.5)
      g.fillRect(px + (f1x + 5) * u, py + (f1y + 1) * u, 2 * u + 0.5, 2 * u + 0.5)
      // Lit rim along the outer top and left edges only.
      if (!tN) {
        g.fillStyle = CANOPY_RIM
        g.fillRect(px + (ix0 + 1) * u, py + iy0 * u, (ix1 - ix0 - 2) * u + 0.5, u + 0.5)
      }
      if (!tW) {
        g.fillStyle = CANOPY_RIM
        g.fillRect(px + ix0 * u, py + (iy0 + 1) * u, u + 0.5, (iy1 - iy0 - 3) * u + 0.5)
      }
      // Round only the outer corners.
      g.fillStyle = FLOOR
      if (!tN && !tW) g.fillRect(px + ix0 * u, py + iy0 * u, 2 * u + 0.5, 2 * u + 0.5)
      if (!tN && !tE) g.fillRect(px + (ix1 - 2) * u, py + iy0 * u, 2 * u + 0.5, 2 * u + 0.5)
      // Re-lit rim stubs after corner rounding (1u diagonal notch kept).
      if (!tN && !tW) {
        g.fillStyle = CANOPY_RIM
        g.fillRect(px + (ix0 + 2) * u, py + iy0 * u, 2 * u + 0.5, u + 0.5)
        g.fillRect(px + ix0 * u, py + (iy0 + 2) * u, u + 0.5, 2 * u + 0.5)
      }
      if (!tN && !tE) {
        g.fillStyle = CANOPY_RIM
        g.fillRect(px + (ix1 - 4) * u, py + iy0 * u, 2 * u + 0.5, u + 0.5)
      }
      // Shade pits along the bottom edge so mass reads from below.
      if (!tS) {
        g.fillStyle = CANOPY_DARK
        g.fillRect(px + (ix0 + 3) * u, py + (iy1 - 2) * u, 3 * u + 0.5, 2 * u + 0.5)
        g.fillRect(px + (ix1 - 6) * u, py + (iy1 - 1) * u, 2 * u + 0.5, u + 0.5)
      }
      // Lone tree: extra round crown + canopy texture ticks.
      if (!tN && !tS && !tW && !tE) {
        g.fillStyle = CANOPY_MID
        g.fillRect(px + 5 * u, py + 5 * u, 2 * u + 0.5, 2 * u + 0.5)
        g.fillRect(px + 9 * u, py + 6 * u, 2 * u + 0.5, 2 * u + 0.5)
      }
      break
    }
    case 'G': {
      paintFloorBase(g, env, px, py, x, y, false)
      g.fillStyle = SHADOW
      g.fillRect(px + 3 * u, py + 12 * u, 10 * u + 0.5, 2 * u + 0.5)
      // Slab with rounded-ish top.
      g.fillStyle = STONE_TOP
      g.fillRect(px + 5 * u, py + 3 * u, 6 * u + 0.5, 9 * u + 0.5)
      g.fillStyle = STONE_FACE
      g.fillRect(px + 5 * u, py + 9 * u, 6 * u + 0.5, 3 * u + 0.5)
      g.fillStyle = STONE_LINE
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
      // Deep indigo pool with dark depth corners.
      g.fillStyle = WATER
      g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
      g.fillStyle = WATER_DARK
      const dc = Math.floor(v * 4)
      g.fillRect(px + (dc * 3) * u, py + 11 * u, 4 * u + 0.5, 3 * u + 0.5)
      const n = env.at(x, y - 1)
      const s = env.at(x, y + 1)
      const l = env.at(x - 1, y)
      const r = env.at(x + 1, y)
      // Sandy banks where water meets non-water, foam line on top.
      const shore = (q: TileChar): boolean => q !== 'W'
      g.fillStyle = BANK
      if (shore(n)) g.fillRect(px, py, env.tile + 0.5, 3 * u + 0.5)
      if (shore(s)) g.fillRect(px, py + env.tile - 3 * u, env.tile + 0.5, 3 * u + 0.5)
      if (shore(l)) g.fillRect(px, py, 3 * u + 0.5, env.tile + 0.5)
      if (shore(r)) g.fillRect(px + env.tile - 3 * u, py, 3 * u + 0.5, env.tile + 0.5)
      if (shore(n) || shore(s) || shore(l) || shore(r)) {
        g.fillStyle = FOAM
        if (shore(n)) g.fillRect(px, py + 3 * u, env.tile + 0.5, u + 0.5)
        if (shore(s)) g.fillRect(px, py + env.tile - 4 * u, env.tile + 0.5, u + 0.5)
        if (shore(l)) g.fillRect(px + 3 * u, py, u + 0.5, env.tile + 0.5)
        if (shore(r)) g.fillRect(px + env.tile - 4 * u, py, u + 0.5, env.tile + 0.5)
      }
      // Two stepped shimmer frames from env.t.
      const f = Math.floor(env.t * 0.8 + v * 2) % 2
      g.fillStyle = WATER_GLEAM
      g.fillRect(px + (4 + f * 5) * u, py + (6 + f) * u, 3 * u + 0.5, u + 0.5)
      g.fillRect(px + (9 - f * 4) * u, py + 10 * u, 2 * u + 0.5, u + 0.5)
      break
    }
    case '~': {
      paintFloorBase(g, env, px, py, x, y, false)
      // Tall grass: teal-lit blades in loose clusters, never solid-looking.
      g.fillStyle = FLOOR_TICK
      const tufts: Array<[number, number]> = [
        [3, 9], [9, 4], [11, 10], [6, 12],
      ]
      for (const [tx, ty] of tufts) {
        if (hash2(x * 7 + tx, y * 7 + ty) < 0.35) continue
        g.fillRect(px + tx * u, py + ty * u, u + 0.5, 3 * u + 0.5)
        g.fillRect(px + (tx + 2) * u, py + (ty + 1) * u, u + 0.5, 2 * u + 0.5)
        g.fillStyle = CANOPY_RIM
        g.fillRect(px + (tx + 1) * u, py + (ty - 1) * u, u + 0.5, u + 0.5)
        g.fillStyle = FLOOR_TICK
      }
      break
    }
    case 'o': {
      paintFloorBase(g, env, px, py, x, y, false)
      g.fillStyle = SHADOW
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
        g.fillStyle = TRUNK_DARK
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
export function paintAmbient(g: Ctx, env: TerrainEnv, _lights: TerrainLight[]): void {
  // One very gentle vignette so the lit diorama sits on the dark page.
  const w = env.width * env.tile
  const h = env.height * env.tile
  const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72)
  grad.addColorStop(0, 'rgba(4,8,12,0)')
  grad.addColorStop(1, 'rgba(4,8,12,0.28)')
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)
}
