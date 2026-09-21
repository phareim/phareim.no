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
// Blacklight palette — "the dark one, done right".
//
// The room is a LIT diorama on the #0b0616 page: ground sits clearly above
// the letterbox in value (#1d1736..#221b40), solid masses drop to near-black
// interiors (#0f0b1e) so they read as volume, and every mass carries a crisp
// 1-logical-px rim on its top/left outer edges only. Rims are muted
// teal (canopy) and lavender (stone/cliff), kept well below the saturated
// hero/danger/treasure accents. No #35f2c8, no #7b3fe4 anywhere.
// ---------------------------------------------------------------------------

const GROUND = '#1d1736'
const GROUND_ALT = '#221b40'
const MOTIF_TICK = '#2e2650'
const PEBBLE = '#3a3058'
const FLOWER_A = '#8a7fb8'
const FLOWER_B = '#8a5f7a'
const SHADOW = '#120d24'
const MASS_DARK = '#0f0b1e'
const MASS_SPECK = '#262046'
const PATH = '#2c2547'
const PATH_DARK = '#211a3a'
const PATH_PEB = '#4a3f75'
const RIM_TEAL = '#3f8f9a'
const RIM_LAV = '#8e83c8'
const CLIFF_TOP = '#3a3358'
const CLIFF_FACE = '#171226'
const BRICK_TOP = '#3a3f5e'
const BRICK_FACE = '#23263d'
const BRICK_DARK = '#14172a'
const TRUNK = '#4a3220'
const TRUNK_DARK = '#2a1c12'
const CLAY = '#6e3f2a'
const CLAY_DARK = '#472818'
const WATER = '#0d1b33'
const BANK = '#2b2347'
const WATER_HI = '#5a7a9a'
const SHIM_A = '#2c3d5c'
const SHIM_B = '#3d5478'
const GRASS = '#5f7191'
const GRASS_TIP = '#8a93b8'
const GOLD = '#ffd23f'
const GOLD_DEEP = '#6e5410'

function isWall(t: TileChar): boolean {
  return t === '#' || t === 'L' || t === 'B' || t === 'S'
}

/** Walkable ground the player can stand on (path, floor, tall grass). */
function isOpen(t: TileChar): boolean {
  return t === '.' || t === ',' || t === '~'
}

function isTree(t: TileChar): boolean {
  return t === 'T'
}

/** 1-logical-px horizontal rule with the file's overdraw habit. */
function hline(g: Ctx, u: number, px: number, py: number, w: number): void {
  g.fillRect(px, py, w + 0.5, Math.max(1, 1 * u) + 0.5)
}

/** 1-logical-px vertical rule. */
function vline(g: Ctx, u: number, px: number, py: number, h: number): void {
  g.fillRect(px, py, Math.max(1, 1 * u) + 0.5, h + 0.5)
}

function paintGround(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  g.fillStyle = GROUND
  g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
  // Calm 2-tone texture: 2x2-tile patches, never a per-tile checker.
  if (hash2(Math.floor(x / 2), Math.floor(y / 2)) > 0.62) {
    g.fillStyle = GROUND_ALT
    g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
  }
  // ONE sparse motif per tile at most; most tiles stay plain.
  const u = env.u
  const m = hash2(x * 13 + 7, y * 13 + 3)
  if (m < 0.16) {
    // Grass ticks: two short blades.
    const bx = 3 + Math.floor(hash2(x * 3 + 1, y * 5 + 2) * 9)
    const by = 4 + Math.floor(hash2(x * 5 + 4, y * 3 + 1) * 8)
    g.fillStyle = MOTIF_TICK
    g.fillRect(px + bx * u, py + by * u, u + 0.5, 3 * u + 0.5)
    g.fillRect(px + (bx + 2) * u, py + (by + 1) * u, u + 0.5, 2 * u + 0.5)
  } else if (m < 0.24) {
    // Single pebble.
    const bx = 3 + Math.floor(hash2(x * 7 + 2, y * 7 + 5) * 10)
    const by = 3 + Math.floor(hash2(x * 7 + 6, y * 7 + 1) * 10)
    g.fillStyle = PEBBLE
    g.fillRect(px + bx * u, py + by * u, 2 * u + 0.5, u + 0.5)
  } else if (m < 0.28) {
    // Tiny night flower: one pale pixel + one dim leaf pixel.
    const bx = 3 + Math.floor(hash2(x * 11 + 3, y * 11 + 8) * 10)
    const by = 3 + Math.floor(hash2(x * 11 + 9, y * 11 + 2) * 10)
    g.fillStyle = FLOWER_A
    g.fillRect(px + bx * u, py + by * u, u + 0.5, u + 0.5)
    g.fillStyle = MOTIF_TICK
    g.fillRect(px + (bx + 1) * u, py + (by + 1) * u, u + 0.5, u + 0.5)
  } else if (m < 0.31) {
    // Dusty-rose dot, rarest.
    const bx = 3 + Math.floor(hash2(x * 17 + 5, y * 17 + 5) * 10)
    const by = 3 + Math.floor(hash2(x * 17 + 1, y * 17 + 9) * 10)
    g.fillStyle = FLOWER_B
    g.fillRect(px + bx * u, py + by * u, u + 0.5, u + 0.5)
  }
}

/** Worn slab trail: lighter + cooler than the ground, dotted soft edge. */
function paintPath(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  paintGround(g, env, px, py, x, y)
  const u = env.u
  // Slab footprint bleeds into trail-neighbors so the trail runs
  // continuous; only the outer sides get the dotted edge.
  const pN = env.at(x, y - 1) === ','
  const pS = env.at(x, y + 1) === ','
  const pW = env.at(x - 1, y) === ','
  const pE = env.at(x + 1, y) === ','
  const sx0 = pW ? 0 : 1
  const sx1 = pE ? 16 : 15
  const sy0 = pN ? 0 : 1
  const sy1 = pS ? 16 : 15
  g.fillStyle = PATH
  g.fillRect(px + sx0 * u, py + sy0 * u, (sx1 - sx0) * u + 0.5, (sy1 - sy0) * u + 0.5)
  // Ruts: one dark dash along the trail's run direction.
  const horiz = env.at(x - 1, y) === ',' || env.at(x + 1, y) === ','
  g.fillStyle = PATH_DARK
  if (horiz) {
    const ry = 6 + Math.floor(hash2(x * 3 + 9, y * 3 + 4) * 4)
    g.fillRect(px + 2 * u, py + ry * u, 12 * u + 0.5, u + 0.5)
  } else {
    const rx = 6 + Math.floor(hash2(x * 3 + 4, y * 3 + 9) * 4)
    g.fillRect(px + rx * u, py + 2 * u, u + 0.5, 12 * u + 0.5)
  }
  // Pebbles on the slabs.
  if (hash2(x * 7 + 1, y * 7 + 1) > 0.55) {
    g.fillStyle = PATH_PEB
    const qx = 3 + Math.floor(hash2(x * 5 + 2, y * 5 + 7) * 9)
    const qy = 3 + Math.floor(hash2(x * 5 + 8, y * 5 + 3) * 9)
    g.fillRect(px + qx * u, py + qy * u, 2 * u + 0.5, u + 0.5)
  }
  // Dotted edge where the trail meets non-trail: dark dashes with gaps,
  // round the outer corners by leaving ground showing.
  const n = env.at(x, y - 1)
  const s = env.at(x, y + 1)
  const l = env.at(x - 1, y)
  const r = env.at(x + 1, y)
  g.fillStyle = PATH_DARK
  const dash = (dx: number, dy: number, len: number, vert: boolean): void => {
    if (vert) g.fillRect(px + dx * u, py + dy * u, u + 0.5, len * u + 0.5)
    else g.fillRect(px + dx * u, py + dy * u, len * u + 0.5, u + 0.5)
  }
  if (n !== ',') {
    const off = hash2(x * 3, y * 3) > 0.5 ? 2 : 5
    dash(2, 0, 3, false)
    dash(2 + off + 3, 0, 3, false)
  }
  if (s !== ',') {
    const off = hash2(x * 3 + 1, y * 3) > 0.5 ? 2 : 5
    dash(2, 15, 3, false)
    dash(2 + off + 3, 15, 3, false)
  }
  if (l !== ',') {
    const off = hash2(x * 3, y * 3 + 1) > 0.5 ? 2 : 5
    dash(0, 2, 3, true)
    dash(0, 2 + off + 3, 3, true)
  }
  if (r !== ',') {
    const off = hash2(x * 3 + 2, y * 3) > 0.5 ? 2 : 5
    dash(15, 2, 3, true)
    dash(15, 2 + off + 3, 3, true)
  }
}

export function paintTile(g: Ctx, env: TerrainEnv, x: number, y: number, px: number, py: number): void {
  const t = env.at(x, y)
  const u = env.u
  const v = hash2(x, y)
  switch (t) {
    case ',':
      paintPath(g, env, px, py, x, y)
      break
    case '#': {
      if (env.area === 'overworld') {
        // Basalt cliff band: near-black face, lit cap only where the mass
        // meets open ground. Buried runs stay dark.
        const openN = isOpen(env.at(x, y - 1))
        const openS = isOpen(env.at(x, y + 1))
        const openW = isOpen(env.at(x - 1, y))
        const openE = isOpen(env.at(x + 1, y))
        const exposed = openN || openS || openW || openE
        g.fillStyle = CLIFF_FACE
        g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
        // Sparse 1px speckles so the face reads as volume.
        g.fillStyle = MASS_SPECK
        if (hash2(x * 5 + 1, y * 5 + 1) > 0.6) {
          g.fillRect(px + 4 * u, py + 9 * u, u + 0.5, u + 0.5)
        }
        if (hash2(x * 5 + 3, y * 5 + 7) > 0.6) {
          g.fillRect(px + 11 * u, py + 11 * u, u + 0.5, u + 0.5)
        }
        // Bottom shade band: the face falls away.
        g.fillStyle = MASS_DARK
        g.fillRect(px, py + env.tile - 3 * u, env.tile + 0.5, 3 * u + 0.5)
        if (exposed) {
          // Lit cap: pale band + 1px lavender rim on the top edge.
          g.fillStyle = CLIFF_TOP
          g.fillRect(px, py, env.tile + 0.5, 4 * u + 0.5)
          g.fillStyle = RIM_LAV
          hline(g, u, px, py, env.tile)
          // Left outer rim where the mass opens to the left.
          if (openW) {
            g.fillStyle = RIM_LAV
            vline(g, u, px, py, env.tile)
          }
          // Right shade where the mass opens to the right.
          if (openE) {
            g.fillStyle = MASS_DARK
            g.fillRect(px + env.tile - 2 * u, py, 2 * u + 0.5, env.tile + 0.5)
          }
        }
        break
      }
      // Dungeon brick: merged runs, cap highlight only where sky is above.
      const above = env.at(x, y - 1)
      const openAbove = !isWall(above)
      g.fillStyle = BRICK_FACE
      g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
      g.fillStyle = BRICK_DARK
      g.fillRect(px, py + env.tile * 0.55, env.tile + 0.5, env.tile * 0.45 + 0.5)
      if (openAbove) {
        g.fillStyle = BRICK_TOP
        g.fillRect(px, py, env.tile + 0.5, env.tile * 0.38 + 0.5)
        g.fillStyle = RIM_LAV
        hline(g, u, px, py, env.tile)
        g.fillStyle = BRICK_DARK
        const jx = px + ((x * 5 + 3) % 8) * u
        g.fillRect(jx, py + 2 * u, u, 4 * u)
      } else {
        g.fillStyle = MASS_SPECK
        hline(g, u, px, py, env.tile)
      }
      const l = env.at(x - 1, y)
      const r = env.at(x + 1, y)
      if (!isWall(l) && !isTree(l)) {
        g.fillStyle = RIM_LAV
        vline(g, u, px, py, env.tile)
      }
      if (!isWall(r) && !isTree(r)) {
        g.fillStyle = BRICK_DARK
        g.fillRect(px + env.tile - 2 * u, py, 2 * u + 0.5, env.tile + 0.5)
      }
      break
    }
    case 'T': {
      paintGround(g, env, px, py, x, y)
      // Merged canopy MASS: the tile bleeds into tree-neighbors, so adjacent
      // 'T' tiles read as one crown. Only outer sides get edges.
      const tN = isTree(env.at(x, y - 1))
      const tS = isTree(env.at(x, y + 1))
      const tW = isTree(env.at(x - 1, y))
      const tE = isTree(env.at(x + 1, y))
      const lone = !tN && !tS && !tW && !tE
      // Crown footprint: full-bleed into tree neighbors, inset 2px outside.
      const x0 = tW ? 0 : 2
      const x1 = tE ? 16 : 14
      const y0 = tN ? 0 : 2
      const y1 = tS ? 16 : 13
      // Near-black interior.
      g.fillStyle = MASS_DARK
      g.fillRect(px + x0 * u, py + y0 * u, (x1 - x0) * u + 0.5, (y1 - y0) * u + 0.5)
      // Crown light band only on the outer top edge — interior tiles that
      // bleed into a neighbor crown stay dark so the mass reads as one.
      if (!tN) {
        g.fillStyle = CLIFF_TOP
        g.fillRect(px + x0 * u, py + y0 * u, (x1 - x0) * u + 0.5, 3 * u + 0.5)
      }
      // Sparse 1px speckles for volume.
      g.fillStyle = MASS_SPECK
      if (hash2(x * 5 + 2, y * 5 + 4) > 0.55) {
        g.fillRect(px + (x0 + 3) * u, py + (y0 + 5) * u, u + 0.5, u + 0.5)
      }
      if (hash2(x * 5 + 8, y * 5 + 2) > 0.55) {
        g.fillRect(px + (x1 - 4) * u, py + (y0 + 7) * u, u + 0.5, u + 0.5)
      }
      // Rim light: top outer edge + left outer edge, teal, 1px.
      if (!tN) {
        g.fillStyle = RIM_TEAL
        g.fillRect(px + x0 * u, py + y0 * u, (x1 - x0) * u + 0.5, Math.max(1, u) + 0.5)
      }
      if (!tW) {
        g.fillStyle = RIM_TEAL
        g.fillRect(px + x0 * u, py + y0 * u, Math.max(1, u) + 0.5, (y1 - y0) * u + 0.5)
      }
      // Bottom shade on the outer bottom edge.
      if (!tS) {
        g.fillStyle = MASS_DARK
        g.fillRect(px + x0 * u, py + (y1 - 2) * u, (x1 - x0) * u + 0.5, 2 * u + 0.5)
      }
      if (!tE) {
        g.fillStyle = MASS_DARK
        g.fillRect(px + (x1 - 1) * u, py + y0 * u, u + 0.5, (y1 - y0) * u + 0.5)
      }
      // Round only the outer corners: paint ground back over 2x2 corners.
      g.fillStyle = GROUND
      if (!tN && !tW) g.fillRect(px + x0 * u, py + y0 * u, 2 * u + 0.5, 2 * u + 0.5)
      if (!tN && !tE) g.fillRect(px + (x1 - 2) * u, py + y0 * u, 2 * u + 0.5, 2 * u + 0.5)
      if (!tS && !tW) g.fillRect(px + x0 * u, py + (y1 - 2) * u, 2 * u + 0.5, 2 * u + 0.5)
      if (!tS && !tE) g.fillRect(px + (x1 - 2) * u, py + (y1 - 2) * u, 2 * u + 0.5, 2 * u + 0.5)
      // Re-lay the teal rim over the corner cuts on top/left.
      if (!tN) {
        g.fillStyle = RIM_TEAL
        g.fillRect(px + (x0 + 2) * u, py + y0 * u, (x1 - x0 - 4) * u + 0.5, Math.max(1, u) + 0.5)
      }
      if (!tW) {
        g.fillStyle = RIM_TEAL
        g.fillRect(px + x0 * u, py + (y0 + 2) * u, Math.max(1, u) + 0.5, (y1 - y0 - 4) * u + 0.5)
      }
      if (lone) {
        // Small round tree: pale crown fleck at the top-left of the crown.
        g.fillStyle = RIM_TEAL
        g.fillRect(px + 5 * u, py + 3 * u, 3 * u + 0.5, u + 0.5)
      }
      void v
      // Trunk + ground shadow only where the tile below is not a tree.
      if (!tS) {
        g.fillStyle = SHADOW
        g.fillRect(px + 3 * u, py + 13 * u, 10 * u + 0.5, 2 * u + 0.5)
        g.fillStyle = TRUNK
        g.fillRect(px + 7 * u, py + 10 * u, 2 * u + 0.5, 4 * u + 0.5)
        g.fillStyle = TRUNK_DARK
        g.fillRect(px + 8 * u, py + 10 * u, u + 0.5, 4 * u + 0.5)
      }
      break
    }
    case 'G': {
      paintGround(g, env, px, py, x, y)
      g.fillStyle = SHADOW
      g.fillRect(px + 3 * u, py + 12 * u, 10 * u + 0.5, 2 * u + 0.5)
      // Slab with rounded-ish top.
      g.fillStyle = BRICK_TOP
      g.fillRect(px + 5 * u, py + 3 * u, 6 * u + 0.5, 9 * u + 0.5)
      g.fillStyle = BRICK_FACE
      g.fillRect(px + 5 * u, py + 9 * u, 6 * u + 0.5, 3 * u + 0.5)
      g.fillStyle = RIM_LAV
      g.fillRect(px + 5 * u, py + 3 * u, 6 * u + 0.5, u + 0.5)
      // Carved line.
      g.fillStyle = BRICK_DARK
      g.fillRect(px + 7 * u, py + 6 * u, 2 * u + 0.5, 3 * u + 0.5)
      // Base.
      g.fillStyle = BRICK_DARK
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
      // Banks only where water meets non-water; open water stays dark.
      const shore = (q: TileChar): boolean => q !== 'W'
      g.fillStyle = BANK
      if (shore(n)) g.fillRect(px, py, env.tile + 0.5, 3 * u + 0.5)
      if (shore(s)) g.fillRect(px, py + env.tile - 3 * u, env.tile + 0.5, 3 * u + 0.5)
      if (shore(l)) g.fillRect(px, py, 3 * u + 0.5, env.tile + 0.5)
      if (shore(r)) g.fillRect(px + env.tile - 3 * u, py, 3 * u + 0.5, env.tile + 0.5)
      // Dim blue highlight line on the shore sides.
      g.fillStyle = WATER_HI
      if (shore(n)) hline(g, u, px, py + 3 * u, env.tile)
      if (shore(l)) vline(g, u, px + 3 * u, py, env.tile)
      // Two stepped shimmer frames from env.t.
      const f = Math.floor(env.t * 0.8 + v * 2) % 2
      g.fillStyle = f === 0 ? SHIM_A : SHIM_B
      g.fillRect(px + (4 + f * 5) * u, py + 8 * u, 3 * u + 0.5, u + 0.5)
      g.fillStyle = f === 0 ? SHIM_B : SHIM_A
      g.fillRect(px + (9 - f * 4) * u, py + 11 * u, 2 * u + 0.5, u + 0.5)
      break
    }
    case '~': {
      paintGround(g, env, px, py, x, y)
      // Tall grass: dim steel blades in two clusters, tipped pale.
      g.fillStyle = GRASS
      const tufts: Array<[number, number]> = [
        [3, 9], [9, 4], [11, 10], [6, 12],
      ]
      for (const [tx, ty] of tufts) {
        if (hash2(x * 7 + tx, y * 7 + ty) < 0.35) continue
        g.fillRect(px + tx * u, py + ty * u, u + 0.5, 3 * u + 0.5)
        g.fillRect(px + (tx + 2) * u, py + (ty + 1) * u, u + 0.5, 2 * u + 0.5)
        g.fillStyle = GRASS_TIP
        g.fillRect(px + (tx + 1) * u, py + (ty - 1) * u, u + 0.5, u + 0.5)
        g.fillStyle = GRASS
      }
      break
    }
    case 'o': {
      paintGround(g, env, px, py, x, y)
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
      paintPath(g, env, px, py, x, y)
      // Stone threshold plate.
      g.fillStyle = BRICK_DARK
      g.fillRect(px + u, py + 5 * u, 14 * u + 0.5, 6 * u + 0.5)
      g.fillStyle = BRICK_TOP
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
        g.fillStyle = MASS_DARK
        g.fillRect(px + 3 * u, py + 2 * u, 10 * u + 0.5, 12 * u + 0.5)
        g.fillStyle = BRICK_TOP
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
      paintPath(g, env, px, py, x, y)
      g.fillStyle = BRICK_DARK
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
      paintGround(g, env, px, py, x, y)
      break
  }
}

/**
 * Blacklight ambient pass (room-local px, origin at the room's top-left).
 * Runs once per tile-cache rebuild. The ONLY place soft light is allowed:
 * gold pools at every lamp, one faint cool wash over the centre, and a dark
 * vignette pinning the corners — the room looks lit by its lamps.
 */
export function paintAmbient(g: Ctx, env: TerrainEnv, lights: TerrainLight[]): void {
  const W = env.width * env.tile
  const H = env.height * env.tile
  const cx = W / 2
  const cy = H / 2
  g.save()
  try {
    // Faint cool wash across the room centre (moonlight through canopy).
    const washR = Math.max(W, H) * 0.62
    const wash = g.createRadialGradient(cx, cy, 0, cx, cy, washR)
    wash.addColorStop(0, 'rgba(130,145,205,0.075)')
    wash.addColorStop(1, 'rgba(130,145,205,0)')
    g.fillStyle = wash
    g.fillRect(0, 0, W + 0.5, H + 0.5)
    // Gold lamp pools, radius ~2.5 tiles, additive.
    g.globalCompositeOperation = 'lighter'
    for (const l of lights) {
      const lx = l.x * env.tile
      const ly = l.y * env.tile
      const r = env.tile * 2.5
      const pool = g.createRadialGradient(lx, ly, 0, lx, ly, r)
      if (l.color === 'gold') {
        pool.addColorStop(0, 'rgba(255,210,63,0.16)')
        pool.addColorStop(1, 'rgba(255,210,63,0)')
      } else if (l.color === 'cyan') {
        pool.addColorStop(0, 'rgba(80,200,210,0.12)')
        pool.addColorStop(1, 'rgba(80,200,210,0)')
      } else {
        pool.addColorStop(0, 'rgba(255,120,170,0.12)')
        pool.addColorStop(1, 'rgba(255,120,170,0)')
      }
      g.fillStyle = pool
      g.fillRect(lx - r, ly - r, r * 2 + 0.5, r * 2 + 0.5)
    }
    g.globalCompositeOperation = 'source-over'
    // Dark vignette at the corners.
    const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.34, cx, cy, Math.max(W, H) * 0.72)
    vg.addColorStop(0, 'rgba(5,3,12,0)')
    vg.addColorStop(1, 'rgba(5,3,12,0.55)')
    g.fillStyle = vg
    g.fillRect(0, 0, W + 0.5, H + 0.5)
  } finally {
    g.restore()
  }
}
