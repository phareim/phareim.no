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
// Sunset palette — the meadow at sundown, light from the top of the screen.
// Ground sits in warm mid-value violet-magenta so the room reads as a LIT
// diorama against the #0b0616 letterbox. Accent rims are muted orange-pink
// (#e0906a / #c46a7a) — never the reserved pure cyan/pink/gold, never
// #35f2c8 or #7b3fe4. All paintTile shadows are SOLID darker ground tones,
// never alpha.
// ---------------------------------------------------------------------------

const FLOOR = '#422959'
const FLOOR_DARK = '#3c264f'
const FLOOR_LITE = '#472c5e'
const SHADOW = '#2e1c44'
const MOTIF_TICK = '#8a5f74'
const MOTIF_PEBBLE = '#6a4a72'
const MOTIF_BLOOM = '#b0768a'
const MOTIF_BLOOM_DARK = '#7a4a62'
const PATH = '#7a4a6a'
const PATH_DARK = '#5e3653'
const PATH_LITE = '#8a5878'
const PATH_RUT = '#5a334e'
const HEDGE_MASS = '#241a3e'
const HEDGE_FACE = '#1a1230'
const HEDGE_EDGE = '#3a2c55'
const SUNLITE = '#e0906a'
const SUNLITE_DEEP = '#c46a7a'
const BRICK_TOP = '#5e3a5e'
const BRICK_FACE = '#2c1c34'
const BRICK_DARK = '#1c1226'
const CANOPY = '#312552'
const CANOPY_DARK = '#241b40'
const CANOPY_DEEP = '#150f28'
const TRUNK = '#3a2620'
const TRUNK_DARK = '#241812'
const STONE_TOP = '#6a5468'
const STONE_FACE = '#3a2c44'
const STONE_DARK = '#241a30'
const CLAY = '#7a4430'
const CLAY_DARK = '#4a2818'
const CLAY_LITE = '#c47a5a'
const WATER = '#23214f'
const WATER_DARK = '#191738'
const WATER_BAND = '#b0768a'
const WATER_BAND_DEEP = '#8a5570'
const BANK = '#8a5a6a'
const BANK_LITE = '#d0988a'
const GRASS_BLADE = '#b0765a'
const GRASS_TIP = '#d0987a'
const GOLD = '#ffd23f'
const GOLD_DEEP = '#6e5410'

function isWall(t: TileChar): boolean {
  return t === '#' || t === 'L' || t === 'B' || t === 'S'
}

function isCanopy(t: TileChar): boolean {
  return t === 'T'
}

/** True for tiles that read as open ground (walkable, no solid mass). */
function isOpen(t: TileChar): boolean {
  return t === '.' || t === ',' || t === '~'
}

function paintFloorBase(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number, dirt: boolean): void {
  const u = env.u
  g.fillStyle = dirt ? PATH : FLOOR
  g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
  if (!dirt) {
    // Calm base: a faint large half-tile shade on hash-chosen tiles only —
    // never a strict checker, so no quilt pattern forms across the room.
    if (hash2(x * 2 + 5, y * 2 + 1) > 0.5) {
      if (((x + y) & 1) === 0) {
        g.fillStyle = FLOOR_DARK
        g.fillRect(px, py, env.tile + 0.5, env.tile * 0.5 + 0.5)
      } else {
        g.fillStyle = FLOOR_LITE
        g.fillRect(px, py + env.tile * 0.5, env.tile + 0.5, env.tile * 0.5 + 0.5)
      }
    }
    // One sparse deliberate motif per tile at most, many tiles plain.
    const m = hash2(x * 3 + 11, y * 3 + 7)
    if (m > 0.72) {
      // Grass tick: three short blades leaning right (evening grass).
      const bx = px + Math.floor(hash2(x, y) * 10) * u
      const by = py + (6 + Math.floor(hash2(x + 40, y) * 6)) * u
      g.fillStyle = MOTIF_TICK
      g.fillRect(bx, by, u + 0.5, 3 * u + 0.5)
      g.fillRect(bx + 2 * u, by + u, u + 0.5, 2 * u + 0.5)
      g.fillStyle = MOTIF_BLOOM
      g.fillRect(bx + u, by - u, u + 0.5, u + 0.5)
    } else if (m > 0.55) {
      // Two pebbles.
      const qx = px + (3 + Math.floor(hash2(x + 9, y) * 8)) * u
      const qy = py + (4 + Math.floor(hash2(x, y + 5) * 8)) * u
      g.fillStyle = MOTIF_PEBBLE
      g.fillRect(qx, qy, 2 * u + 0.5, u + 0.5)
      g.fillRect(qx + 4 * u, qy + 3 * u, u + 0.5, u + 0.5)
    } else if (m > 0.44) {
      // Tiny dusk flower: muted rose cross, dark heart.
      const fx = px + (4 + Math.floor(hash2(x + 3, y + 13) * 7)) * u
      const fy = py + (4 + Math.floor(hash2(x + 21, y + 2) * 7)) * u
      g.fillStyle = MOTIF_BLOOM
      g.fillRect(fx, fy + u, 3 * u + 0.5, u + 0.5)
      g.fillRect(fx + u, fy, u + 0.5, 3 * u + 0.5)
      g.fillStyle = MOTIF_BLOOM_DARK
      g.fillRect(fx + u, fy + u, u + 0.5, u + 0.5)
    }
  }
  void u
}

export function paintTile(g: Ctx, env: TerrainEnv, x: number, y: number, px: number, py: number): void {
  const t = env.at(x, y)
  const u = env.u
  const v = hash2(x, y)
  switch (t) {
    case ',': {
      // Worn trail: dusty-rose bed, neighbor-aware soft irregular border
      // where the neighbor is not path, rounded outer corners, ruts +
      // pebbles, slightly lighter than the ground.
      paintFloorBase(g, env, px, py, x, y, true)
      const n = env.at(x, y - 1) === ','
      const s = env.at(x, y + 1) === ','
      const w = env.at(x - 1, y) === ','
      const e = env.at(x + 1, y) === ','
      // Sunlit centre wear: lighter band along the walking line.
      g.fillStyle = PATH_LITE
      if (w || e) g.fillRect(px, py + 6 * u, env.tile + 0.5, 4 * u + 0.5)
      else g.fillRect(px + 6 * u, py, 4 * u + 0.5, env.tile + 0.5)
      // Irregular soft border 1-3 logical px on sides facing non-path.
      const jn = 1 + Math.floor(hash2(x * 5 + 1, y) * 3)
      const js = 1 + Math.floor(hash2(x * 5 + 2, y) * 3)
      const jw = 1 + Math.floor(hash2(x, y * 5 + 1) * 3)
      const je = 1 + Math.floor(hash2(x, y * 5 + 2) * 3)
      g.fillStyle = PATH_DARK
      if (!n) g.fillRect(px, py, env.tile + 0.5, jn * u + 0.5)
      if (!s) g.fillRect(px, py + env.tile - js * u, env.tile + 0.5, js * u + 0.5)
      if (!w) g.fillRect(px, py, jw * u + 0.5, env.tile + 0.5)
      if (!e) g.fillRect(px + env.tile - je * u, py, je * u + 0.5, env.tile + 0.5)
      // Round the outer corners: ground shows through the corner blocks
      // where two path edges meet open ground.
      g.fillStyle = FLOOR
      if (!n && !w) g.fillRect(px, py, 2 * u + 0.5, 2 * u + 0.5)
      if (!n && !e) g.fillRect(px + env.tile - 2 * u, py, 2 * u + 0.5, 2 * u + 0.5)
      if (!s && !w) g.fillRect(px, py + env.tile - 2 * u, 2 * u + 0.5, 2 * u + 0.5)
      if (!s && !e) g.fillRect(px + env.tile - 2 * u, py + env.tile - 2 * u, 2 * u + 0.5, 2 * u + 0.5)
      // Wheel ruts along the walking line, broken by hash so they read as
      // wear rather than planks. One pebble.
      g.fillStyle = PATH_RUT
      const gap = hash2(x * 3 + 7, y * 3 + 2) > 0.35
      if (w || e) {
        if (gap) {
          g.fillRect(px, py + 4 * u, env.tile + 0.5, u + 0.5)
          g.fillRect(px, py + 11 * u, env.tile + 0.5, u + 0.5)
        } else {
          g.fillRect(px, py + 4 * u, 9 * u + 0.5, u + 0.5)
          g.fillRect(px + 7 * u, py + 11 * u, 9 * u + 0.5, u + 0.5)
        }
      } else {
        if (gap) {
          g.fillRect(px + 4 * u, py, u + 0.5, env.tile + 0.5)
          g.fillRect(px + 11 * u, py, u + 0.5, env.tile + 0.5)
        } else {
          g.fillRect(px + 4 * u, py, u + 0.5, 9 * u + 0.5)
          g.fillRect(px + 11 * u, py + 7 * u, u + 0.5, 9 * u + 0.5)
        }
      }
      if (v > 0.45) {
        g.fillStyle = MOTIF_PEBBLE
        g.fillRect(px + (4 + Math.floor(v * 8)) * u, py + (6 + Math.floor(v * 37) % 4) * u, u + 0.5, u + 0.5)
      }
      break
    }
    case '#': {
      // Overworld: sunlit hedge/cliff band. Dungeon and friends: warm brick.
      if (env.area === 'overworld') {
        const above = env.at(x, y - 1)
        const below = env.at(x, y + 1)
        const left = env.at(x - 1, y)
        const right = env.at(x + 1, y)
        const openAbove = !isWall(above) && above !== 'T'
        const openBelow = isOpen(below)
        const openLeft = isOpen(left)
        const openRight = isOpen(right)
        // Deep indigo mass.
        g.fillStyle = HEDGE_MASS
        g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
        // Out-of-bounds above the room is open sky: the sun comes from the
        // top of the screen, so the outer top frame gets the lit edge too.
        const skyAbove = y === 0 || openAbove
        if (skyAbove) {
          // Sun-lit top edge: hot rim where walkable ground is above.
          g.fillStyle = SUNLITE
          g.fillRect(px, py, env.tile + 0.5, 2 * u + 0.5)
          g.fillStyle = SUNLITE_DEEP
          g.fillRect(px, py + 2 * u, env.tile + 0.5, u + 0.5)
          // Leafy crown bumps along the lit edge.
          g.fillStyle = HEDGE_EDGE
          const bump = 3 + Math.floor(hash2(x * 3, y) * 3)
          for (let i = 0; i < 4; i++) {
            if (hash2(x * 9 + i, y * 4) > 0.4) {
              g.fillRect(px + (i * 4 + 1) * u, py + 3 * u, 2 * u + 0.5, bump * u + 0.5)
            }
          }
        } else {
          // Buried: faint top seam so masses still read.
          g.fillStyle = HEDGE_EDGE
          g.fillRect(px, py, env.tile + 0.5, u + 0.5)
        }
        // Face falls to deep indigo where ground lies below/beside — but the
        // sun catches the hedge edge facing the room: a hot 1px rim with a
        // deeper under-line on every inner side.
        g.fillStyle = HEDGE_FACE
        if (openBelow) g.fillRect(px, py + env.tile - 5 * u, env.tile + 0.5, 5 * u + 0.5)
        if (openLeft) g.fillRect(px, py, 2 * u + 0.5, env.tile + 0.5)
        if (openRight) g.fillRect(px + env.tile - 2 * u, py, 2 * u + 0.5, env.tile + 0.5)
        if (openBelow) {
          g.fillStyle = SUNLITE
          g.fillRect(px, py + env.tile - 5 * u, env.tile + 0.5, u + 0.5)
          g.fillStyle = SUNLITE_DEEP
          g.fillRect(px, py + env.tile - 4 * u, env.tile + 0.5, u + 0.5)
        }
        if (openLeft) {
          g.fillStyle = SUNLITE_DEEP
          g.fillRect(px + 2 * u, py, u + 0.5, env.tile + 0.5)
        }
        if (openRight) {
          g.fillStyle = SUNLITE_DEEP
          g.fillRect(px + env.tile - 3 * u, py, u + 0.5, env.tile + 0.5)
        }
        // Twilight berries: sparse muted rose dots inside the mass.
        if (hash2(x * 7 + 2, y * 7 + 5) > 0.78) {
          g.fillStyle = SUNLITE_DEEP
          g.fillRect(px + 7 * u, py + 8 * u, 2 * u + 0.5, 2 * u + 0.5)
        }
        break
      }
      // Dungeon brick: light top where open ground is above, dark face below.
      const above = env.at(x, y - 1)
      const openAbove = !isWall(above)
      g.fillStyle = BRICK_FACE
      g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
      g.fillStyle = BRICK_DARK
      g.fillRect(px, py + env.tile * 0.55, env.tile + 0.5, env.tile * 0.45 + 0.5)
      if (openAbove) {
        g.fillStyle = BRICK_TOP
        g.fillRect(px, py, env.tile + 0.5, env.tile * 0.38 + 0.5)
        g.fillStyle = SUNLITE
        g.fillRect(px, py, env.tile + 0.5, Math.max(1, 1 * u) + 0.5)
        g.fillStyle = BRICK_DARK
        const jx = px + ((x * 5 + 3) % 8) * u
        g.fillRect(jx, py + 2 * u, u, 4 * u)
      } else {
        g.fillStyle = HEDGE_EDGE
        g.fillRect(px, py, env.tile + 0.5, Math.max(1, 1 * u) + 0.5)
      }
      const l = env.at(x - 1, y)
      const r = env.at(x + 1, y)
      if (isOpen(l)) {
        g.fillStyle = BRICK_TOP
        g.fillRect(px, py, 2 * u + 0.5, env.tile + 0.5)
      }
      if (isOpen(r)) {
        g.fillStyle = BRICK_DARK
        g.fillRect(px + env.tile - 2 * u, py, 2 * u + 0.5, env.tile + 0.5)
      }
      break
    }
    case 'T': {
      // One canopy MASS: adjacent trees merge. Round only outer corners,
      // hot rim on the top/left, shade at the bottom, trunk + solid blocky
      // downward shadow only where the tile below is not a tree.
      paintFloorBase(g, env, px, py, x, y, false)
      const tN = isCanopy(env.at(x, y - 1))
      const tS = isCanopy(env.at(x, y + 1))
      const tW = isCanopy(env.at(x - 1, y))
      const tE = isCanopy(env.at(x + 1, y))
      const lone = !tN && !tS && !tW && !tE
      // Canopy body: full-bleed into tree neighbors, inset on open sides.
      const ix0 = tW ? 0 : 2
      const ix1 = tE ? 16 : 14
      const iy0 = tN ? 0 : 2
      const iy1 = 13
      g.fillStyle = CANOPY_DARK
      g.fillRect(px + ix0 * u, py + iy0 * u, (ix1 - ix0) * u + 0.5, (iy1 - iy0) * u + 0.5)
      g.fillStyle = CANOPY
      g.fillRect(px + ix0 * u, py + iy0 * u, (ix1 - ix0) * u + 0.5, (iy1 - iy0 - 3) * u + 0.5)
      // Round only the OUTER corners back to ground.
      if (!tN && !tW) {
        g.fillStyle = FLOOR
        g.fillRect(px + ix0 * u, py + iy0 * u, 2 * u + 0.5, 2 * u + 0.5)
        g.fillStyle = CANOPY
        g.fillRect(px + (ix0 + 2) * u, py + iy0 * u, u + 0.5, u + 0.5)
      }
      if (!tN && !tE) {
        g.fillStyle = FLOOR
        g.fillRect(px + (ix1 - 2) * u, py + iy0 * u, 2 * u + 0.5, 2 * u + 0.5)
        g.fillStyle = CANOPY
        g.fillRect(px + (ix1 - 3) * u, py + iy0 * u, u + 0.5, u + 0.5)
      }
      // Sunset rim: hot top edge (only where sky is above the mass) +
      // left edge catch-light.
      if (!tN) {
        g.fillStyle = SUNLITE
        g.fillRect(px + (ix0 + 1) * u, py + iy0 * u, (ix1 - ix0 - 2) * u + 0.5, u + 0.5)
        g.fillStyle = SUNLITE_DEEP
        g.fillRect(px + (ix0 + 2) * u, py + (iy0 + 1) * u, (ix1 - ix0 - 4) * u + 0.5, u + 0.5)
      }
      if (!tW) {
        g.fillStyle = SUNLITE_DEEP
        g.fillRect(px + ix0 * u, py + (iy0 + 2) * u, u + 0.5, (iy1 - iy0 - 5) * u + 0.5)
      }
      // Bottom shade band inside the canopy.
      g.fillStyle = CANOPY_DEEP
      g.fillRect(px + ix0 * u, py + (iy1 - 2) * u, (ix1 - ix0) * u + 0.5, 2 * u + 0.5)
      // Leaf pits: deterministic, kept to the lower half (no faces).
      g.fillStyle = CANOPY_DARK
      const pit = hash2(x * 11 + 3, y * 11 + 1)
      g.fillRect(px + (5 + Math.floor(pit * 5)) * u, py + 8 * u, 2 * u + 0.5, u + 0.5)
      if (pit > 0.5) g.fillRect(px + (3 + Math.floor(pit * 3)) * u, py + 10 * u, u + 0.5, u + 0.5)
      if (lone) {
        // Small round tree: pull the mass into an oval, ground at corners.
        g.fillStyle = FLOOR
        g.fillRect(px, py + 9 * u, 4 * u + 0.5, 4 * u + 0.5)
        g.fillRect(px + 12 * u, py + 9 * u, 4 * u + 0.5, 4 * u + 0.5)
        g.fillStyle = CANOPY
        g.fillRect(px + 3 * u, py + 9 * u, u + 0.5, 2 * u + 0.5)
        g.fillRect(px + 12 * u, py + 9 * u, u + 0.5, 2 * u + 0.5)
      }
      if (!tS) {
        // Trunk + long blocky downward shadow on solid ground colour.
        g.fillStyle = TRUNK
        g.fillRect(px + 7 * u, py + 10 * u, 2 * u + 0.5, 4 * u + 0.5)
        g.fillStyle = TRUNK_DARK
        g.fillRect(px + 8 * u, py + 10 * u, u + 0.5, 4 * u + 0.5)
        g.fillStyle = SHADOW
        g.fillRect(px + 3 * u, py + 13 * u, 10 * u + 0.5, 3 * u + 0.5)
      }
      break
    }
    case 'G': {
      // Dusk gravestone: sunlit cap, rose-grey slab, solid ground shadow.
      paintFloorBase(g, env, px, py, x, y, false)
      g.fillStyle = SHADOW
      g.fillRect(px + 3 * u, py + 13 * u, 10 * u + 0.5, 2 * u + 0.5)
      g.fillStyle = STONE_FACE
      g.fillRect(px + 5 * u, py + 4 * u, 6 * u + 0.5, 9 * u + 0.5)
      g.fillStyle = STONE_TOP
      g.fillRect(px + 5 * u, py + 3 * u, 6 * u + 0.5, 6 * u + 0.5)
      // Sun catches the cap.
      g.fillStyle = SUNLITE
      g.fillRect(px + 5 * u, py + 3 * u, 6 * u + 0.5, u + 0.5)
      // Carved line + base.
      g.fillStyle = STONE_DARK
      g.fillRect(px + 7 * u, py + 6 * u, 2 * u + 0.5, 3 * u + 0.5)
      g.fillRect(px + 4 * u, py + 12 * u, 8 * u + 0.5, 2 * u + 0.5)
      break
    }
    case 'W': {
      // Sunset mirror: indigo pool, two-three horizontal rose bands,
      // bank on shore sides, highlight line, 2 stepped shimmer frames.
      g.fillStyle = WATER
      g.fillRect(px, py, env.tile + 0.5, env.tile + 0.5)
      const n = env.at(x, y - 1)
      const s = env.at(x, y + 1)
      const l = env.at(x - 1, y)
      const r = env.at(x + 1, y)
      const shore = (q: TileChar): boolean => q !== 'W'
      // Deep lower half.
      g.fillStyle = WATER_DARK
      g.fillRect(px, py + 9 * u, env.tile + 0.5, 7 * u + 0.5)
      // Fixed rose bands: the sunset sits in the water.
      g.fillStyle = WATER_BAND_DEEP
      g.fillRect(px, py + 5 * u, env.tile + 0.5, 2 * u + 0.5)
      g.fillStyle = WATER_BAND
      g.fillRect(px + u, py + 6 * u, 14 * u + 0.5, u + 0.5)
      g.fillStyle = WATER_BAND_DEEP
      g.fillRect(px + 2 * u, py + 11 * u, 12 * u + 0.5, u + 0.5)
      // Two stepped shimmer frames from env.t.
      const f = Math.floor(env.t * 1.2 + v * 2) % 2
      g.fillStyle = BANK_LITE
      g.fillRect(px + (3 + f * 6) * u, py + (3 - f) * u, 3 * u + 0.5, u + 0.5)
      g.fillRect(px + (9 - f * 4) * u, py + 9 * u, 2 * u + 0.5, u + 0.5)
      // Banks where water meets shore + highlight line on the water side.
      g.fillStyle = BANK
      if (shore(n)) g.fillRect(px, py, env.tile + 0.5, 3 * u + 0.5)
      if (shore(s)) g.fillRect(px, py + env.tile - 3 * u, env.tile + 0.5, 3 * u + 0.5)
      if (shore(l)) g.fillRect(px, py, 3 * u + 0.5, env.tile + 0.5)
      if (shore(r)) g.fillRect(px + env.tile - 3 * u, py, 3 * u + 0.5, env.tile + 0.5)
      if (shore(n)) {
        g.fillStyle = BANK_LITE
        g.fillRect(px, py + 3 * u, env.tile + 0.5, u + 0.5)
      }
      if (shore(l)) {
        g.fillStyle = BANK_LITE
        g.fillRect(px + 3 * u, py, u + 0.5, env.tile + 0.5)
      }
      break
    }
    case '~': {
      // Tall dusk grass: warm blades with lit tips, clumped, floor between.
      paintFloorBase(g, env, px, py, x, y, false)
      g.fillStyle = GRASS_BLADE
      const tufts: Array<[number, number]> = [
        [3, 9], [9, 4], [11, 10], [6, 12],
      ]
      for (const [tx, ty] of tufts) {
        if (hash2(x * 7 + tx, y * 7 + ty) < 0.35) continue
        g.fillRect(px + tx * u, py + ty * u, u + 0.5, 3 * u + 0.5)
        g.fillRect(px + (tx + 2) * u, py + (ty + 1) * u, u + 0.5, 2 * u + 0.5)
        g.fillStyle = GRASS_TIP
        g.fillRect(px + (tx + 1) * u, py + (ty - 1) * u, u + 0.5, u + 0.5)
        g.fillStyle = GRASS_BLADE
      }
      break
    }
    case 'o': {
      // Clay pot at sundown: warm belly, lit shoulder, solid shadow.
      paintFloorBase(g, env, px, py, x, y, false)
      g.fillStyle = SHADOW
      g.fillRect(px + 3 * u, py + 13 * u, 10 * u + 0.5, 2 * u + 0.5)
      g.fillStyle = CLAY_DARK
      g.fillRect(px + 3 * u, py + 5 * u, 10 * u + 0.5, 8 * u + 0.5)
      g.fillStyle = CLAY
      g.fillRect(px + 4 * u, py + 4 * u, 8 * u + 0.5, 8 * u + 0.5)
      g.fillStyle = CLAY_LITE
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
        // Last light along the door's top edge.
        g.fillStyle = SUNLITE_DEEP
        g.fillRect(px + 3 * u, py + 2 * u, 10 * u + 0.5, u + 0.5)
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
      // Shut portcullis: dusk slate bars with muted rose studs.
      g.fillStyle = HEDGE_EDGE
      for (let i = 0; i < 4; i++) {
        g.fillRect(px + (3 + i * 3) * u, py + 2 * u, 2 * u + 0.5, 12 * u + 0.5)
      }
      g.fillStyle = SUNLITE_DEEP
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
 * at the room's top-left). Runs once per tile-cache rebuild. The one place
 * where soft light (radial gradients, low alpha) is allowed.
 *
 * Sunset: a warm wash from the top edge fading out by mid-room, a cool
 * dark vignette at the bottom, small warm pools at the lamp lights.
 */
export function paintAmbient(g: Ctx, env: TerrainEnv, lights: TerrainLight[]): void {
  const w = env.width * env.tile
  const h = env.height * env.tile
  // Warm wash from the top edge, gone by mid-room.
  const wash = g.createLinearGradient(0, 0, 0, h * 0.55)
  wash.addColorStop(0, 'rgba(224,144,106,0.16)')
  wash.addColorStop(1, 'rgba(224,144,106,0)')
  g.fillStyle = wash
  g.fillRect(0, 0, w, h * 0.55 + 0.5)
  // Cool dark vignette along the bottom.
  const cool = g.createLinearGradient(0, h * 0.6, 0, h)
  cool.addColorStop(0, 'rgba(10,6,24,0)')
  cool.addColorStop(1, 'rgba(10,6,24,0.34)')
  g.fillStyle = cool
  g.fillRect(0, h * 0.6, w, h * 0.4 + 0.5)
  // Warm pools at the portal lamps.
  for (const li of lights) {
    const cx = li.x * env.tile
    const cy = li.y * env.tile
    const r = env.tile * 1.6
    const pool = g.createRadialGradient(cx, cy, 0, cx, cy, r)
    if (li.color === 'gold') {
      pool.addColorStop(0, 'rgba(255,210,63,0.20)')
      pool.addColorStop(1, 'rgba(255,210,63,0)')
    } else if (li.color === 'cyan') {
      pool.addColorStop(0, 'rgba(47,243,255,0.16)')
      pool.addColorStop(1, 'rgba(47,243,255,0)')
    } else {
      pool.addColorStop(0, 'rgba(196,106,122,0.20)')
      pool.addColorStop(1, 'rgba(196,106,122,0)')
    }
    g.fillStyle = pool
    g.fillRect(cx - r, cy - r, r * 2 + 0.5, r * 2 + 0.5)
  }
}
