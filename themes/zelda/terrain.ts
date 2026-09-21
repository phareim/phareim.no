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
// Terrain palette — "violet dusk": violet ground, teal canopies, a dusty-rose
// trail and rock whose lit edges catch the setting sun (warm rims borrowed
// from the lab's sunset variant). Everything stays well under the saturation of the three
// reserved accents (cyan hero, pink danger, gold treasure).
// ---------------------------------------------------------------------------

const GROUND = '#2a2355'
const GROUND_ALT = '#262050'
const GROUND_SHADE = '#1b1740'
const TICK = '#4b4592'
const TICK_LITE = '#6a66b4'
const BLOOM = '#c9c2ee'
const PEBBLE = '#1f1a47'

const PATH = '#7a5478'
const PATH_LITE = '#8f6488'
const PATH_EDGE = '#54395e'
const PATH_PEBBLE = '#a87c98'

const LEAF = '#1d5560'
const LEAF_DARK = '#123843'
const LEAF_DEEP = '#0c2630'
const LEAF_LITE = '#2f7a80'
const LEAF_RIM = '#e09a78'
const BORDER_LEAF = '#143f4a'
const BORDER_LEAF_DARK = '#0d2a35'
const BORDER_LEAF_LITE = '#1f5a62'
const TRUNK = '#5a3d2e'
const TRUNK_DARK = '#38241c'

const ROCK_LIP = '#dba6b0'
const ROCK = '#6f6aa6'
const ROCK_MID = '#54508a'
const ROCK_DARK = '#38356a'
const ROCK_DEEP = '#24224c'

const BRICK_TOP = '#5d6190'
const BRICK_FACE = '#34375c'
const BRICK_DARK = '#1f2140'
const BRICK_LIP = '#9aa0cc'

const CLAY = '#9a5a3c'
const CLAY_LITE = '#c07a52'
const CLAY_DARK = '#5e3322'
const CLAY_DEEP = '#2e170e'

const WATER = '#21427e'
const WATER_DEEP = '#182f62'
const WATER_LITE = '#5f8fd6'
const FOAM = '#b9c4f0'

const WOOD = '#6b452f'
const WOOD_DARK = '#3b2418'
const GOLD = '#ffd23f'
const GOLD_DEEP = '#8a6a14'
const STUD = '#8f2a60'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fill a rect given in logical pixels relative to the tile's top-left. */
function r(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number, w: number, h: number, col: string): void {
  g.fillStyle = col
  g.fillRect(px + x * env.u, py + y * env.u, w * env.u + 0.5, h * env.u + 0.5)
}

/** Draw a 16-wide string pixel map; '.' is transparent. */
function blit(g: Ctx, env: TerrainEnv, px: number, py: number, map: string[], pal: Record<string, string>): void {
  for (let j = 0; j < map.length; j++) {
    const row = map[j]
    let i = 0
    while (i < row.length) {
      const ch = row[i]
      let n = 1
      while (i + n < row.length && row[i + n] === ch) n++
      const col = pal[ch]
      if (col) r(g, env, px, py, i, j, n, 1, col)
      i += n
    }
  }
}

function isBoundary(t: TileChar): boolean {
  return t === '#' || t === 'L' || t === 'B' || t === 'S'
}

function isPath(env: TerrainEnv, x: number, y: number): boolean {
  // A trail that reaches the room edge continues off-screen.
  if (x < 0 || y < 0 || x >= env.width || y >= env.height) return true
  const t = env.at(x, y)
  return t === ',' || t === 'L' || t === 'B' || t === 'S'
}

/** Solids tall enough to throw a shadow onto the ground south/east of them. */
function castsShadow(t: TileChar): boolean {
  return t === '#' || t === 'T' || t === 'L' || t === 'B' || t === 'S'
}

// ---------------------------------------------------------------------------
// Ground, trail, tall grass
// ---------------------------------------------------------------------------

function paintGround(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  // Calm base with broad two-tone patches (low-frequency hash), no static.
  const patch = hash2((x + 40) >> 1, (y + 40) >> 1) > 0.55
  r(g, env, px, py, 0, 0, 16, 16, patch ? GROUND_ALT : GROUND)
  // Sparse deliberate motifs; most tiles stay plain.
  const h = hash2(x * 3 + 1, y * 5 + 2)
  const ox = 2 + Math.floor(hash2(x, y + 9) * 9)
  const oy = 3 + Math.floor(hash2(x + 9, y) * 8)
  if (h < 0.14) {
    r(g, env, px, py, ox, oy + 1, 1, 2, TICK)
    r(g, env, px, py, ox + 2, oy, 1, 3, TICK)
    r(g, env, px, py, ox + 4, oy + 1, 1, 2, TICK)
    r(g, env, px, py, ox + 2, oy, 1, 1, TICK_LITE)
  } else if (h < 0.22) {
    r(g, env, px, py, ox, oy, 1, 2, TICK)
    r(g, env, px, py, ox + 2, oy + 1, 1, 1, TICK)
  } else if (h < 0.26) {
    r(g, env, px, py, ox + 1, oy, 1, 1, BLOOM)
    r(g, env, px, py, ox, oy + 1, 3, 1, TICK_LITE)
    r(g, env, px, py, ox + 1, oy + 1, 1, 1, BLOOM)
    r(g, env, px, py, ox + 1, oy + 2, 1, 2, TICK)
  } else if (h < 0.31) {
    r(g, env, px, py, ox, oy, 2, 1, PEBBLE)
    r(g, env, px, py, ox + 1, oy + 1, 2, 1, PEBBLE)
  }
}

/** Contact shadows from tall neighbours: what makes masses feel raised. */
function paintShadows(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  const n = env.at(x, y - 1)
  const w = env.at(x - 1, y)
  // Trees paint their own ground shadow below; they only shade eastwards.
  if (castsShadow(n) && n !== 'T') r(g, env, px, py, 0, 0, 16, 4, GROUND_SHADE)
  if (castsShadow(w) && w !== 'T') r(g, env, px, py, 0, 0, 2, 16, GROUND_SHADE)
  else if (castsShadow(env.at(x - 1, y - 1)) && env.at(x - 1, y - 1) !== 'T' && !castsShadow(n)) r(g, env, px, py, 0, 0, 2, 2, GROUND_SHADE)
}

function paintPath(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  paintGround(g, env, px, py, x, y)
  const n = isPath(env, x, y - 1)
  const s = isPath(env, x, y + 1)
  const w = isPath(env, x - 1, y)
  const e = isPath(env, x + 1, y)
  // Trail body, inset 2px on open sides, with a wobbling edge.
  const x0 = w ? 0 : 2
  const x1 = e ? 16 : 14
  const y0 = n ? 0 : 2
  const y1 = s ? 16 : 14
  r(g, env, px, py, x0, y0, x1 - x0, y1 - y0, PATH)
  for (let i = 0; i < 16; i += 2) {
    const k = hash2(x * 16 + i, y * 16 + 3)
    if (!n && i >= x0 && i < x1) r(g, env, px, py, i, k > 0.5 ? 1 : 2, 2, k > 0.5 ? 1 : 1, k > 0.5 ? PATH : PATH_EDGE)
    if (!s && i >= x0 && i < x1) r(g, env, px, py, i, k > 0.4 ? 14 : 13, 2, 1, k > 0.4 ? PATH : PATH_EDGE)
    const k2 = hash2(x * 16 + 5, y * 16 + i)
    if (!w && i >= y0 && i < y1) r(g, env, px, py, k2 > 0.5 ? 1 : 2, i, 1, 2, k2 > 0.5 ? PATH : PATH_EDGE)
    if (!e && i >= y0 && i < y1) r(g, env, px, py, k2 > 0.4 ? 14 : 13, i, 1, 2, k2 > 0.4 ? PATH : PATH_EDGE)
  }
  // Round the outer corners back to ground.
  const corner = (cx: number, cy: number): void => {
    r(g, env, px, py, cx === 0 ? x0 : x1 - 2, cy === 0 ? y0 : y1 - 1, 2, 1, GROUND)
    r(g, env, px, py, cx === 0 ? x0 : x1 - 1, cy === 0 ? y0 : y1 - 2, 1, 2, GROUND)
  }
  if (!n && !w) corner(0, 0)
  if (!n && !e) corner(1, 0)
  if (!s && !w) corner(0, 1)
  if (!s && !e) corner(1, 1)
  // Worn centre, ruts and pebbles.
  const h = hash2(x * 7 + 3, y * 11 + 1)
  r(g, env, px, py, 4 + Math.floor(h * 4), 6, 5, 1, PATH_LITE)
  r(g, env, px, py, 7 - Math.floor(h * 3), 10, 4, 1, PATH_LITE)
  if (h > 0.45) r(g, env, px, py, 3 + Math.floor(h * 9), 4, 1, 1, PATH_PEBBLE)
  if (h < 0.6) r(g, env, px, py, 11 - Math.floor(h * 6), 12, 2, 1, PATH_EDGE)
}

function paintTallGrass(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  paintGround(g, env, px, py, x, y)
  // A bushy, clearly cuttable clump: three tufts on a dark foot.
  const tufts: Array<[number, number]> = [[1, 7], [6, 3], [10, 8]]
  for (const [tx, ty] of tufts) {
    const j = hash2(x * 5 + tx, y * 5 + ty) > 0.5 ? 1 : 0
    r(g, env, px, py, tx, ty + 5 + j, 5, 2, LEAF_DARK)
    r(g, env, px, py, tx, ty + 2 + j, 1, 4, LEAF_LITE)
    r(g, env, px, py, tx + 2, ty + j, 1, 6, LEAF_LITE)
    r(g, env, px, py, tx + 4, ty + 2 + j, 1, 4, LEAF_LITE)
    r(g, env, px, py, tx + 1, ty + 3 + j, 1, 3, LEAF)
    r(g, env, px, py, tx + 3, ty + 2 + j, 1, 4, LEAF)
    r(g, env, px, py, tx + 2, ty + j, 1, 1, LEAF_RIM)
  }
}

// ---------------------------------------------------------------------------
// Canopy masses (trees merge with their neighbours) and the forest boundary
// ---------------------------------------------------------------------------

interface LeafPal { base: string; dark: string; deep: string; lite: string; rim: string }
const TREE_PAL: LeafPal = { base: LEAF, dark: LEAF_DARK, deep: LEAF_DEEP, lite: LEAF_LITE, rim: LEAF_RIM }
const BORDER_PAL: LeafPal = {
  base: BORDER_LEAF, dark: BORDER_LEAF_DARK, deep: LEAF_DEEP, lite: BORDER_LEAF_LITE, rim: BORDER_LEAF_LITE,
}

/** Leaf clumps: a lit crescent over a dark dimple, placed by hash. */
function paintClumps(
  g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number,
  x0: number, y0: number, x1: number, y1: number, pal: LeafPal,
): void {
  for (let k = 0; k < 3; k++) {
    const cx = x0 + 1 + Math.floor(hash2(x * 3 + k, y * 3 + 17) * Math.max(1, x1 - x0 - 6))
    const cy = y0 + 2 + Math.floor(hash2(x * 3 + 29, y * 3 + k) * Math.max(1, y1 - y0 - 6))
    r(g, env, px, py, cx, cy, 4, 1, pal.lite)
    r(g, env, px, py, cx + 1, cy - 1, 2, 1, pal.rim)
    r(g, env, px, py, cx - 1, cy + 1, 1, 1, pal.lite)
    r(g, env, px, py, cx, cy + 2, 3, 1, pal.dark)
  }
}

function paintTree(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  const n = env.at(x, y - 1) === 'T'
  const s = env.at(x, y + 1) === 'T'
  const w = env.at(x - 1, y) === 'T'
  const e = env.at(x + 1, y) === 'T'
  const x0 = w ? 0 : 1
  const x1 = e ? 16 : 15
  const y0 = n ? 0 : 1
  const y1 = s ? 16 : 12
  if (!s) {
    // Ground shadow and trunk under the open bottom edge.
    r(g, env, px, py, 2, 13, 12, 3, GROUND_SHADE)
    r(g, env, px, py, 6, 11, 4, 4, TRUNK)
    r(g, env, px, py, 8, 11, 2, 4, TRUNK_DARK)
  }
  r(g, env, px, py, x0, y0, x1 - x0, y1 - y0, TREE_PAL.base)
  if (!e) r(g, env, px, py, x1 - 2, y0, 2, y1 - y0, TREE_PAL.dark)
  if (!s) {
    r(g, env, px, py, x0, y1 - 3, x1 - x0, 3, TREE_PAL.dark)
    // Scalloped underside.
    for (let i = x0; i < x1; i += 4) r(g, env, px, py, i, y1 - 1, 2, 1, TREE_PAL.deep)
    for (let i = x0 + 2; i < x1 - 1; i += 4) r(g, env, px, py, i, y1, 2, 1, TREE_PAL.dark)
  }
  paintClumps(g, env, px, py, x, y, x0, y0, x1, y1 - (s ? 0 : 3), TREE_PAL)
  if (!n) {
    r(g, env, px, py, x0 + (w ? 0 : 2), y0, x1 - x0 - (w ? 0 : 2) - (e ? 0 : 2), 1, TREE_PAL.rim)
    r(g, env, px, py, x0 + (w ? 0 : 1), y0 + 1, x1 - x0 - (w ? 0 : 1) - (e ? 0 : 3), 1, TREE_PAL.lite)
  }
  if (!w) r(g, env, px, py, x0, y0 + (n ? 0 : 2), 1, y1 - y0 - (n ? 0 : 2) - (s ? 0 : 4), TREE_PAL.lite)
  // Round the outer corners back to ground.
  const cut = (cx: number, cy: number): void => {
    const gx = cx === 0 ? x0 : x1
    const gy = cy === 0 ? y0 : y1
    const sx = cx === 0 ? 1 : -1
    const sy = cy === 0 ? 1 : -1
    const col = cy === 1 ? GROUND_SHADE : GROUND
    r(g, env, px, py, sx > 0 ? gx : gx - 3, sy > 0 ? gy : gy - 1, 3, 1, col)
    r(g, env, px, py, sx > 0 ? gx : gx - 2, sy > 0 ? gy + 1 : gy - 2, 2, 1, col)
    r(g, env, px, py, sx > 0 ? gx : gx - 1, sy > 0 ? gy + 2 : gy - 3, 1, 1, col)
  }
  if (!n && !w) cut(0, 0)
  if (!n && !e) cut(1, 0)
  if (!s && !w) cut(0, 1)
  if (!s && !e) cut(1, 1)
}

/** Overworld boundary: a forested plateau with rock lips towards the glade. */
function paintBorder(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  const open = (tx: number, ty: number): boolean => !isBoundary(env.at(tx, ty))
  const oN = open(x, y - 1)
  const oS = open(x, y + 1)
  const oW = open(x - 1, y)
  const oE = open(x + 1, y)
  r(g, env, px, py, 0, 0, 16, 16, BORDER_PAL.base)
  // Broad shade patches so the mass is not flat.
  if (hash2(x + 3, y + 7) > 0.5) r(g, env, px, py, 0, 8, 16, 8, BORDER_PAL.dark)
  paintClumps(g, env, px, py, x, y, 0, 0, 16, oS ? 8 : 16, BORDER_PAL)
  if (oS) {
    // North wall of the glade: we see the rock face under the tree line.
    for (let i = 0; i < 16; i += 4) r(g, env, px, py, i + ((x + i) % 3 === 0 ? 1 : 0), 5, 3, 1, BORDER_PAL.dark)
    r(g, env, px, py, 0, 6, 16, 1, LEAF_DEEP)
    r(g, env, px, py, 0, 7, 16, 1, ROCK_LIP)
    r(g, env, px, py, 0, 8, 16, 2, ROCK)
    r(g, env, px, py, 0, 10, 16, 4, ROCK_MID)
    r(g, env, px, py, 0, 14, 16, 2, ROCK_DARK)
    for (let k = 0; k < 3; k++) {
      const sx = Math.floor(hash2(x * 5 + k, y + 31) * 15)
      const len = 3 + Math.floor(hash2(x + k, y * 5 + 13) * 4)
      r(g, env, px, py, sx, 9, 1, len, ROCK_DARK)
      r(g, env, px, py, (sx + 1) % 16, 9, 1, 2, ROCK_LIP)
    }
  }
  if (oN) {
    r(g, env, px, py, 0, 0, 16, 1, ROCK_LIP)
    r(g, env, px, py, 0, 1, 16, 2, ROCK)
    r(g, env, px, py, 0, 3, 16, 1, LEAF_DEEP)
    for (let i = 1; i < 16; i += 5) r(g, env, px, py, i + (x % 2), 1, 1, 2, ROCK_MID)
  }
  if (oE) {
    r(g, env, px, py, 12, 0, 1, 16, LEAF_DEEP)
    r(g, env, px, py, 13, 0, 2, 16, ROCK_MID)
    r(g, env, px, py, 15, 0, 1, 16, ROCK)
    for (let j = 2; j < 16; j += 6) r(g, env, px, py, 13, j + (y % 2), 2, 1, ROCK_DARK)
  }
  if (oW) {
    r(g, env, px, py, 0, 0, 1, 16, ROCK_LIP)
    r(g, env, px, py, 1, 0, 2, 16, ROCK)
    r(g, env, px, py, 3, 0, 1, 16, LEAF_DEEP)
    for (let j = 4; j < 16; j += 6) r(g, env, px, py, 1, j + (y % 2), 2, 1, ROCK_MID)
  }
  // Inner corners: a rock nub where only the diagonal is open.
  if (!oS && !oE && open(x + 1, y + 1)) r(g, env, px, py, 13, 13, 3, 3, ROCK_MID)
  if (!oS && !oW && open(x - 1, y + 1)) r(g, env, px, py, 0, 13, 3, 3, ROCK)
  if (!oN && !oE && open(x + 1, y - 1)) r(g, env, px, py, 13, 0, 3, 3, ROCK)
  if (!oN && !oW && open(x - 1, y - 1)) r(g, env, px, py, 0, 0, 3, 3, ROCK_LIP)
}

/** Dungeon (and any non-overworld area): brick with a lit cap. */
function paintBrick(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  const open = (tx: number, ty: number): boolean => !isBoundary(env.at(tx, ty))
  r(g, env, px, py, 0, 0, 16, 16, BRICK_FACE)
  r(g, env, px, py, 0, 9, 16, 7, BRICK_DARK)
  if (open(x, y - 1) || open(x, y + 1)) {
    r(g, env, px, py, 0, 0, 16, 6, BRICK_TOP)
    r(g, env, px, py, 0, 0, 16, 1, BRICK_LIP)
    r(g, env, px, py, (x * 5 + 3) % 12, 2, 1, 4, BRICK_DARK)
  }
  r(g, env, px, py, (x * 7 + 1) % 13, 9, 1, 3, BRICK_FACE)
  r(g, env, px, py, 0, 12, 16, 1, BRICK_FACE)
  if (open(x - 1, y)) r(g, env, px, py, 0, 0, 2, 16, BRICK_TOP)
  if (open(x + 1, y)) r(g, env, px, py, 14, 0, 2, 16, BRICK_DARK)
}

// ---------------------------------------------------------------------------
// Water, objects, doors
// ---------------------------------------------------------------------------

function paintWater(g: Ctx, env: TerrainEnv, px: number, py: number, x: number, y: number): void {
  const shore = (tx: number, ty: number): boolean => env.at(tx, ty) !== 'W'
  r(g, env, px, py, 0, 0, 16, 16, WATER)
  if (hash2(x + 11, y + 5) > 0.4) r(g, env, px, py, 2, 9, 12, 5, WATER_DEEP)
  // Two stepped shimmer frames.
  const f = Math.floor(env.t * 0.8 + hash2(x, y) * 2) % 2
  r(g, env, px, py, 3 + f * 4, 5, 4, 1, WATER_LITE)
  r(g, env, px, py, 9 - f * 3, 11, 3, 1, WATER_LITE)
  if (shore(x, y - 1)) {
    // North bank stands over the water: lip, face, then its shadow. A
    // boundary cliff already brings its own face.
    if (!isBoundary(env.at(x, y - 1))) {
      r(g, env, px, py, 0, 0, 16, 1, ROCK_LIP)
      r(g, env, px, py, 0, 1, 16, 2, ROCK_MID)
    }
    r(g, env, px, py, 0, isBoundary(env.at(x, y - 1)) ? 0 : 3, 16, 2, WATER_DEEP)
  }
  if (shore(x, y + 1)) {
    r(g, env, px, py, 0, 15, 16, 1, ROCK_MID)
    r(g, env, px, py, 1, 14, 14, 1, FOAM)
  }
  if (shore(x - 1, y)) {
    r(g, env, px, py, 0, 0, 1, 16, ROCK_MID)
    r(g, env, px, py, 1, 4, 1, 9, FOAM)
  }
  if (shore(x + 1, y)) {
    r(g, env, px, py, 15, 0, 1, 16, ROCK_DARK)
    r(g, env, px, py, 14, 4, 1, 9, FOAM)
  }
}

const POT_MAP = [
  '................',
  '................',
  '.....dddddd.....',
  '....dllllllD....',
  '....dDDDDDDD....',
  '.....dccccD.....',
  '....dlcccccD....',
  '...dllccccccD...',
  '...dlcccccccD...',
  '...dlcccccccD...',
  '...dccccccccD...',
  '...dccccccdDD...',
  '....dccccdDD....',
  '.....DDDDDD.....',
  '....ssssssss....',
  '.....ssssss.....',
]
const POT_PAL = { d: CLAY_DARK, D: CLAY_DEEP, c: CLAY, l: CLAY_LITE, s: GROUND_SHADE }

const GRAVE_MAP = [
  '................',
  '.....RRRRRR.....',
  '....RrrrrrrK....',
  '....RrrrrrrK....',
  '....RrrKKrrK....',
  '....RrKKKKrK....',
  '....RrrKKrrK....',
  '....RrrKKrrK....',
  '....RrrrrrrK....',
  '....RmmmmmmK....',
  '....RmmmmmmK....',
  '...KKKKKKKKKK...',
  '...RmmmmmmmmK...',
  '...kkkkkkkkkk...',
  '...ssssssssss...',
  '....ssssssss....',
]
const GRAVE_PAL = { R: ROCK_LIP, r: ROCK, m: ROCK_MID, K: ROCK_DARK, k: ROCK_DEEP, s: GROUND_SHADE }

function paintDoor(g: Ctx, env: TerrainEnv, px: number, py: number, t: TileChar): void {
  // Stone posts and threshold; the leaf depends on the door kind.
  r(g, env, px, py, 0, 0, 16, 16, PATH_EDGE)
  r(g, env, px, py, 0, 0, 3, 16, ROCK)
  r(g, env, px, py, 13, 0, 3, 16, ROCK_MID)
  r(g, env, px, py, 0, 0, 3, 1, ROCK_LIP)
  r(g, env, px, py, 13, 0, 3, 1, ROCK_LIP)
  r(g, env, px, py, 0, 0, 1, 16, ROCK_LIP)
  if (t === 'L') {
    r(g, env, px, py, 3, 1, 10, 14, WOOD)
    r(g, env, px, py, 3, 1, 10, 1, ROCK_DARK)
    r(g, env, px, py, 7, 2, 1, 13, WOOD_DARK)
    r(g, env, px, py, 3, 5, 10, 1, WOOD_DARK)
    r(g, env, px, py, 3, 11, 10, 1, WOOD_DARK)
    r(g, env, px, py, 6, 7, 4, 4, GOLD)
    r(g, env, px, py, 7, 8, 2, 2, GOLD_DEEP)
  } else if (t === 'B') {
    r(g, env, px, py, 3, 1, 10, 14, ROCK_DEEP)
    for (let i = 0; i < 4; i++) r(g, env, px, py, 4 + i * 3, 1, 1, 14, ROCK)
    r(g, env, px, py, 7, 5, 2, 6, GOLD)
    r(g, env, px, py, 5, 7, 6, 2, GOLD)
  } else {
    r(g, env, px, py, 3, 1, 10, 14, ROCK_DEEP)
    for (let i = 0; i < 4; i++) {
      r(g, env, px, py, 3 + i * 3, 1, 2, 14, ROCK_MID)
      r(g, env, px, py, 3 + i * 3, 7, 2, 2, STUD)
    }
  }
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export function paintTile(g: Ctx, env: TerrainEnv, x: number, y: number, px: number, py: number): void {
  const t = env.at(x, y)
  switch (t) {
    case ',':
      paintPath(g, env, px, py, x, y)
      paintShadows(g, env, px, py, x, y)
      break
    case '~':
      paintTallGrass(g, env, px, py, x, y)
      paintShadows(g, env, px, py, x, y)
      break
    case 'o':
      // A pot standing on the trail keeps the trail under it.
      paintGround(g, env, px, py, x, y)
      if (isPath(env, x - 1, y) && isPath(env, x + 1, y)) r(g, env, px, py, 0, 2, 16, 12, PATH)
      blit(g, env, px, py, POT_MAP, POT_PAL)
      break
    case 'G':
      paintGround(g, env, px, py, x, y)
      blit(g, env, px, py, GRAVE_MAP, GRAVE_PAL)
      break
    case 'T':
      paintGround(g, env, px, py, x, y)
      paintTree(g, env, px, py, x, y)
      break
    case 'W':
      paintWater(g, env, px, py, x, y)
      break
    case '#':
      if (env.area === 'overworld') paintBorder(g, env, px, py, x, y)
      else paintBrick(g, env, px, py, x, y)
      break
    case 'L':
    case 'B':
    case 'S':
      paintDoor(g, env, px, py, t)
      break
    case '.':
    default:
      paintGround(g, env, px, py, x, y)
      paintShadows(g, env, px, py, x, y)
      break
  }
}

/**
 * Light pass over the finished static room (room-local px, origin at the
 * room's top-left). Runs once per tile-cache rebuild: warm pools at the
 * lamps and a gentle vignette so the glade reads as lit from within.
 */
export function paintAmbient(g: Ctx, env: TerrainEnv, lights: TerrainLight[]): void {
  const w = env.width * env.tile
  const h = env.height * env.tile
  const tint = { gold: '255,210,63', cyan: '47,243,255', pink: '255,47,160' }
  for (const l of lights) {
    const cx = l.x * env.tile
    const cy = l.y * env.tile
    const rad = env.tile * 2.4
    const pool = g.createRadialGradient(cx, cy, 0, cx, cy, rad)
    pool.addColorStop(0, `rgba(${tint[l.color]},0.16)`)
    pool.addColorStop(1, `rgba(${tint[l.color]},0)`)
    g.fillStyle = pool
    g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2)
  }
  const vig = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75)
  vig.addColorStop(0, 'rgba(11,6,22,0)')
  vig.addColorStop(1, 'rgba(11,6,22,0.38)')
  g.fillStyle = vig
  g.fillRect(0, 0, w, h)
}
