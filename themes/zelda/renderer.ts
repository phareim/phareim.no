/**
 * Neon Shrine (theme id `zelda`) — Canvas 2D pixel-art renderer.
 *
 * Handcrafted 16-bit look in the LTTP mould, painted in Neon Dreams.
 * One logical pixel = tile/16 device px. All art is original string pixel
 * maps (`SPRITES`) drawn with fillRect — always crisp, no smoothing, no
 * scaled image blits except the 1:1 tile-cache copy. See DESIGN.md.
 *
 * Read-only: reads GameState, never mutates it (only reads `state.shake`).
 * Owns its own bounded pools (<= 200 particles, <= 8 rings, objects reused).
 * Imports ./types and MACHINE_FONT from ../base/fonts.ts only.
 *
 * NOTE TO INTEGRATOR (Zelda.vue): createRenderer takes an extra `world`
 * argument — createRenderer(canvas, world) — so chests/pickups/room names
 * and portal exit posts resolve via internal lookups. `world` is optional
 * at runtime but always pass it.
 */

import type {
  ChestPlacement,
  Enemy,
  Facing,
  FrameUI,
  GameEvent,
  GameState,
  PickupPlacement,
  Portal,
  Renderer,
  TileChar,
  World,
} from './types'
import { MACHINE_FONT } from '../base/fonts'
import { SLIDE_TIME, SWING_TIME, SWORD_ARC, SWORD_REACH } from './types'

// ---------------------------------------------------------------------------
// Palette (Neon Dreams discipline: three saturated accents only)
// ---------------------------------------------------------------------------

const BG = '#0b0616'
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
const TRUNK_DARK = '#332216'
const CLAY = '#6e3f2a'
const CLAY_DARK = '#472818'
const WATER = '#0a2036'
const WATER_DARK = '#071627'
const FOAM = '#8e83b8'
const CYAN = '#2ff3ff'
const CYAN_DEEP = '#0d4b57'
const CYAN_SHADE = '#0f8a96'
const PINK = '#ff2fa0'
const PINK_DARK = '#8c1a55'
const PINK_DEEP = '#33102a'
const GOLD = '#ffd23f'
const GOLD_DEEP = '#6e5410'
const WHITE = '#ffffff'
const SKIN = '#e8c39a'
const INK = '#14101f'
const LAV = '#b9a8d9'
const LAV_DIM = '#7a6a9a'

const HUD_MIN = 34 // px strip above the room
const PORTRAIT_RESERVE = 0.34 // fraction of height kept below in portrait
const LANDSCAPE_RESERVE = 0.22 // fraction of width kept on EACH side
const MAX_PARTICLES = 200
const MAX_RINGS = 8
const DROP_LIFE = 8 // drops blink after t > 6 (last 2 s)

type Ctx = CanvasRenderingContext2D

// ---------------------------------------------------------------------------
// Pixel maps. '.' = transparent. Every map is rectangular (pinned by test).
// ---------------------------------------------------------------------------

type PixMap = string[]

const HERO_PAL: Record<string, string> = {
  H: CYAN_DEEP,
  h: '#083038',
  F: SKIN,
  E: INK,
  T: CYAN,
  t: CYAN_SHADE,
  B: '#1a1030',
  G: GOLD,
}

const FOE_PAL: Record<string, string> = {
  P: PINK,
  p: PINK_DARK,
  D: PINK_DEEP,
  W: WHITE,
  V: '#3a3f5e',
  v: STONE_DARK,
  E: INK,
  G: GOLD,
  g: GOLD_DEEP,
  e: '#5c1038',
}

/** Distinct silhouette key per enemy kind (test pins the set). */
export const ENEMY_SPRITES: Record<string, string[]> = {
  chaser: ['chaser'],
  wanderer: ['blob0', 'blob1'],
  turret: ['statue'],
  bat: ['bat0', 'bat1'],
  knight: ['knight'],
  slimeKnight: ['crown'],
}

export const SPRITES: Record<string, PixMap> = {
  heroDown0: [
    '....HHHH....',
    '..HHHHHHHH..',
    '..HHHHHHHH..',
    '..HHFFFFHH..',
    '..HFFFFFFH..',
    '..HFEFFEFH..',
    '...FFFFFF...',
    '..TTTTTTTT..',
    '.HFTTTTTTFH.',
    '.HFTTTTTTFH.',
    '..tTTTTTTt..',
    '...TTTTTT...',
    '...B....B...',
    '...B....B...',
    '..BB....BB..',
  ],
  heroDown1: [
    '....HHHH....',
    '..HHHHHHHH..',
    '..HHHHHHHH..',
    '..HHFFFFHH..',
    '..HFFFFFFH..',
    '..HFEFFEFH..',
    '...FFFFFF...',
    '..TTTTTTTT..',
    '.HFTTTTTTFH.',
    '.HFTTTTTTFH.',
    '..tTTTTTTt..',
    '...TTTTTT...',
    '...B....B...',
    '..B......B..',
    '.BB......BB.',
  ],
  heroUp0: [
    '....HHHH....',
    '..HHHHHHHH..',
    '..HHHHHHHH..',
    '..HHHHHHHH..',
    '..HHHHHHHH..',
    '..HhHHHHhH..',
    '...HHHHHH...',
    '..TTTTTTTT..',
    '..TTTTTTTT..',
    '..TTTTTTTT..',
    '..tTTTTTTt..',
    '...TTTTTT...',
    '...B....B...',
    '...B....B...',
    '..BB....BB..',
  ],
  heroUp1: [
    '....HHHH....',
    '..HHHHHHHH..',
    '..HHHHHHHH..',
    '..HHHHHHHH..',
    '..HHHHHHHH..',
    '..HhHHHHhH..',
    '...HHHHHH...',
    '..TTTTTTTT..',
    '..TTTTTTTT..',
    '..TTTTTTTT..',
    '..tTTTTTTt..',
    '...TTTTTT...',
    '...B....B...',
    '..B......B..',
    '.BB......BB.',
  ],
  heroSide0: [
    '....HHHH....',
    '..HHHHHHHH..',
    '..HHHHHHH...',
    '..HHHFFFF...',
    '..HHFFFFF...',
    '..HHFFFEF...',
    '...FFFFFF...',
    '..TTTTTTTT..',
    '..TTTTTTTFH.',
    '..TTTTTTTFH.',
    '..tTTTTTt...',
    '...TTTTTT...',
    '...B....B...',
    '...B....B...',
    '..BB....BB..',
  ],
  heroSide1: [
    '....HHHH....',
    '..HHHHHHHH..',
    '..HHHHHHH...',
    '..HHHFFFF...',
    '..HHFFFFF...',
    '..HHFFFEF...',
    '...FFFFFF...',
    '..TTTTTTTT..',
    '..TTTTTTTFH.',
    '..TTTTTTTFH.',
    '..tTTTTTt...',
    '...TTTTTT...',
    '...B....B...',
    '..B......B..',
    '.BB......BB.',
  ],
  chaser: [
    '.....PPPP.....',
    '....PPPPPP....',
    '.P..PPPPPP..P.',
    '.PPPPPPPPPPPP.',
    '..PPWPPPPWPP..',
    '..PPPPPPPPPP..',
    '...PDPPPPDP...',
    '...PPPPPPPP...',
    '....PpPPpP....',
  ],
  blob0: [
    '.....PP.....',
    '...PPPPPP...',
    '..PPPPPPPP..',
    '..PWPPPPWP..',
    '..PPPPPPPP..',
    '..pPPPPPPp..',
    '..pDDDDDDp..',
    '...pppppp...',
  ],
  blob1: [
    '............',
    '...PPPPPP...',
    '.PPPPPPPPPP.',
    '.PWPPPPPWP..',
    '.PPPPPPPPPP.',
    '..pPPPPPPp..',
    '..pppppppp..',
  ],
  statue: [
    '....VVVVVV....',
    '...VVVVVVVV...',
    '...VvvvvvvV...',
    '...VvVvvVvV...',
    '...VvvEEvvV...',
    '...VvvvvvvV...',
    '....VvvvvV....',
    '....VvVVvV....',
    '...VVVVVVVV...',
    '...VvVvvVvV...',
    '...VVVVVVVV...',
    '....vVVVVv....',
    '....vVVVVv....',
    '...vvVVVVvv...',
  ],
  bat0: [
    'PP...PPPP...PP',
    'PPP..PPPP..PPP',
    '.PPPPWPPWPPPP.',
    '..PPPPPPPPPP..',
    '....pPPPPp....',
  ],
  bat1: [
    '....PPPPPP....',
    '....WPPPPW....',
    '....PPPPPP....',
    '.P..pPPPPp..P.',
    '.PP..pppp..PP.',
  ],
  knight: [
    '......PP......',
    '.....PPPP.....',
    '....VVVVVV....',
    '....VVVVVV....',
    '....VEvvEV....',
    '....VVVVVV....',
    '.....VVVV.....',
    '...VVVVVVVV...',
    '...VVvVVvVV...',
    '...VVvVVvVV...',
    '....VVVVVV....',
    '....VvVVvV....',
    '....VV..VV....',
    '....VV..VV....',
    '...VVV..VVV...',
    '...VVV..VVV...',
  ],
  crown: [
    '.........PP.........',
    '....P....PP....P....',
    '....PP..PPPP..PP....',
    '....PPPGGGGGGPPP....',
    '.....PGGGGGGGGP.....',
    '.....GGGGGGGGGG.....',
    '....PGGGGGGGGGGP....',
    '....PGGWGGGGWGGP....',
    '.....GGGGGGGGGG.....',
    '.....GpGGGGGGpG.....',
    '.....GGGGGGGGGG.....',
    '......GGpGGpGG......',
    '......GGGGGGGG......',
    '.......GGGGGG.......',
    '.......ggGGgg.......',
  ],
  heart: [
    '.PP...PP.',
    'PPPP.PPPP',
    'PPPPPPPPP',
    '.PPPPPPP.',
    '..PPPPP..',
    '...PPP...',
    '....P....',
  ],
  heartEmpty: [
    '.pp...pp.',
    'pppp.pppp',
    'pp.....pp',
    '.p.....p.',
    '..p...p..',
    '...p.p...',
    '....p....',
  ],
}

interface Particle {
  alive: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

interface Ring {
  alive: boolean
  x: number
  y: number
  r0: number
  r1: number
  t: number
  dur: number
  color: string
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/** Deterministic 0..1 hash for scenery variants. */
function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = (h ^ (h >> 13)) | 0
  h = Math.imul(h, 1274126177)
  h = (h ^ (h >> 16)) >>> 0
  return h / 4294967295
}

function facingAngle(f: Facing): number {
  switch (f) {
    case 'up': return -Math.PI / 2
    case 'right': return 0
    case 'down': return Math.PI / 2
    case 'left': return Math.PI
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRenderer(canvas: HTMLCanvasElement, world?: World): Renderer {
  // The smoke-test stub returns a Proxy here; cast through unknown.
  const ctx = canvas.getContext('2d') as unknown as Ctx
  try {
    ;(ctx as unknown as { imageSmoothingEnabled: boolean }).imageSmoothingEnabled = false
  } catch { /* stub absorbs */ }

  // Lookups built from the authored world.
  const chestLookup = new Map<string, ChestPlacement>()
  const pickupLookup = new Map<string, PickupPlacement>()
  const roomName = new Map<string, string>()
  const roomPortals = new Map<string, Portal[]>()
  if (world) {
    for (const id of Object.keys(world.rooms)) {
      const room = world.rooms[id]
      if (!room) continue
      roomName.set(room.id, room.name)
      for (const c of room.chests) chestLookup.set(c.id, c)
      for (const p of room.pickups) pickupLookup.set(p.id, p)
      roomPortals.set(room.id, room.portals)
    }
  }

  let cssW = 0
  let cssH = 0
  let dprEff = 1
  let rect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  let tile = 16
  let lastRoomW = 15
  let lastRoomH = 11

  let tileCache: HTMLCanvasElement | null = null
  let tileHash = ''
  let slideFrom: HTMLCanvasElement | null = null

  // Presentation clock (particles, bob, water frame, walk cycle only).
  let presentT = 0
  let lastFx = 7.5
  let lastFy = 5.5
  let walkPhase = 0
  let flashT = 0

  const particles: Particle[] = []
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: CYAN })
  }
  const rings: Ring[] = []
  for (let i = 0; i < MAX_RINGS; i++) {
    rings.push({ alive: false, x: 0, y: 0, r0: 0, r1: 0, t: 0, dur: 1, color: GOLD })
  }
  // Deterministic starfield for the letterbox backdrop.
  const stars: Array<{ x: number; y: number; s: number; tw: number }> = []
  for (let i = 0; i < 90; i++) {
    stars.push({ x: hash2(i, 7), y: hash2(i, 13), s: i % 5 === 0 ? 2 : 1, tw: hash2(i, 29) * 6.28 })
  }

  function makeOffscreen(w: number, h: number): HTMLCanvasElement | null {
    try {
      if (typeof document === 'undefined') return null
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w))
      c.height = Math.max(1, Math.round(h))
      return c
    } catch {
      return null
    }
  }

  // -- layout ---------------------------------------------------------------

  function computeLayout(roomW: number, roomH: number): void {
    lastRoomW = roomW
    lastRoomH = roomH
    if (cssW <= 0 || cssH <= 0) {
      rect = { x: 0, y: 0, w: 0, h: 0 }
      tile = 1
      return
    }
    const hud = Math.max(HUD_MIN, Math.min(44, Math.floor(cssH * 0.06)))
    const portrait = cssH > cssW
    let ax: number
    let aw: number
    let ay: number
    let ah: number
    if (portrait) {
      const reserveBottom = Math.ceil(cssH * PORTRAIT_RESERVE)
      ax = 0
      aw = cssW
      ay = hud
      ah = cssH - hud - reserveBottom
    } else {
      const side = cssW * LANDSCAPE_RESERVE
      ax = side
      aw = cssW - side * 2
      ay = hud
      ah = cssH - hud
    }
    aw = Math.max(1, aw)
    ah = Math.max(1, ah)
    tile = Math.max(1, Math.floor(Math.min(aw / roomW, ah / roomH)))
    const rw = tile * roomW
    const rh = tile * roomH
    rect = {
      x: ax + (aw - rw) / 2,
      y: ay + (ah - rh) / 2,
      w: rw,
      h: rh,
    }
  }

  function resize(width: number, height: number, dpr: number): void {
    cssW = Math.max(0, width)
    cssH = Math.max(0, height)
    dprEff = clamp(dpr || 1, 1, 2)
    try {
      canvas.width = Math.max(1, Math.round(cssW * dprEff))
      canvas.height = Math.max(1, Math.round(cssH * dprEff))
    } catch {
      // stub canvas in tests
    }
    tileHash = ''
    computeLayout(lastRoomW, lastRoomH)
  }

  function roomRect(): Rect {
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
  }

  // -- pixel helpers ----------------------------------------------------------

  /** Unit: device-independent px per logical pixel (tile = 16 logical px). */
  function unit(): number {
    return tile / 16
  }

  function drawMap(g: Ctx, map: PixMap, dx: number, dy: number, u: number, pal: Record<string, string>, flip = false): void {
    const w = map[0]?.length ?? 0
    for (let j = 0; j < map.length; j++) {
      const row = map[j]
      for (let i = 0; i < row.length; i++) {
        const ch = row[i]
        if (ch === '.') continue
        const col = pal[ch]
        if (!col) continue
        const ii = flip ? w - 1 - i : i
        g.fillStyle = col
        g.fillRect(dx + ii * u, dy + j * u, u + 0.5, u + 0.5)
      }
    }
  }

  // -- tile hash ----------------------------------------------------------------

  function hashRoom(state: GameState): string {
    const r = state.room
    let dots = 0
    let pots = 0
    let grass = 0
    let ldoors = 0
    let bdoors = 0
    let sdoors = 0
    for (let y = 0; y < r.height; y++) {
      const row = r.tiles[y]
      if (!row) continue
      for (let x = 0; x < r.width; x++) {
        const t = row[x] as TileChar
        if (t === '.') dots++
        else if (t === 'o') pots++
        else if (t === '~') grass++
        else if (t === 'L') ldoors++
        else if (t === 'B') bdoors++
        else if (t === 'S') sdoors++
      }
    }
    return `${r.id}|${r.width}x${r.height}|ts=${tile}|.=${dots}|o=${pots}|~=${grass}|L=${ldoors}|B=${bdoors}|S=${sdoors}`
  }

  // -- tile painting (neighbor-aware, LTTP masses) -------------------------------

  function tileAt(state: GameState, x: number, y: number): TileChar {
    if (y < 0 || y >= state.room.height || x < 0 || x >= state.room.width) return '#'
    return (state.room.tiles[y]?.[x] as TileChar) ?? '#'
  }

  function isWall(t: TileChar): boolean {
    return t === '#' || t === 'L' || t === 'B' || t === 'S'
  }

  function paintFloorBase(g: Ctx, px: number, py: number, x: number, y: number, dirt: boolean): void {
    g.fillStyle = dirt ? DIRT : FLOOR
    g.fillRect(px, py, tile + 0.5, tile + 0.5)
    // Sparse deterministic dither — shaded clusters, never outlines.
    const u = unit()
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        const h = hash2(x * 4 + i, y * 4 + j)
        if (h > 0.82) {
          g.fillStyle = dirt ? DIRT_DARK : FLOOR_DARK
          g.fillRect(px + i * tile / 4, py + j * tile / 4, tile / 4 + 0.5, tile / 4 + 0.5)
        } else if (!dirt && h < 0.04) {
          g.fillStyle = '#1a1430'
          g.fillRect(px + i * tile / 4, py + j * tile / 4, tile / 4 + 0.5, tile / 4 + 0.5)
        }
      }
    }
    void u
  }

  function paintTile(g: Ctx, state: GameState, x: number, y: number, px: number, py: number): void {
    const t = tileAt(state, x, y)
    const u = unit()
    const v = hash2(x, y)
    switch (t) {
      case ',':
        paintFloorBase(g, px, py, x, y, true)
        break
      case '#': {
        // Stone wall: light top where open sky is above, dark face below.
        const above = tileAt(state, x, y - 1)
        const openAbove = !isWall(above)
        g.fillStyle = STONE_FACE
        g.fillRect(px, py, tile + 0.5, tile + 0.5)
        // Vertical face shading: darker towards the bottom.
        g.fillStyle = STONE_DARK
        g.fillRect(px, py + tile * 0.55, tile + 0.5, tile * 0.45 + 0.5)
        if (openAbove) {
          // Wall top: light cap + 1px lavender highlight.
          g.fillStyle = STONE_TOP
          g.fillRect(px, py, tile + 0.5, tile * 0.38 + 0.5)
          g.fillStyle = '#8e93b8'
          g.fillRect(px, py, tile + 0.5, Math.max(1, 1 * u) + 0.5)
          // Mortar joints.
          g.fillStyle = STONE_DARK
          const jx = px + ((x * 5 + 3) % 8) * u
          g.fillRect(jx, py + 2 * u, u, 4 * u)
        } else {
          // Buried run: faint top edge so masses read.
          g.fillStyle = '#2e3350'
          g.fillRect(px, py, tile + 0.5, Math.max(1, 1 * u) + 0.5)
        }
        // Side joints where a walkable tile touches left/right.
        const l = tileAt(state, x - 1, y)
        const r = tileAt(state, x + 1, y)
        if (!isWall(l) && l !== 'T' && l !== 'G' && l !== 'W') {
          g.fillStyle = STONE_TOP
          g.fillRect(px, py, 2 * u + 0.5, tile + 0.5)
        }
        if (!isWall(r) && r !== 'T' && r !== 'G' && r !== 'W') {
          g.fillStyle = STONE_DARK
          g.fillRect(px + tile - 2 * u, py, 2 * u + 0.5, tile + 0.5)
        }
        break
      }
      case 'T': {
        paintFloorBase(g, px, py, x, y, false)
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
        paintFloorBase(g, px, py, x, y, false)
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
        g.fillRect(px, py, tile + 0.5, tile + 0.5)
        const n = tileAt(state, x, y - 1)
        const s = tileAt(state, x, y + 1)
        const l = tileAt(state, x - 1, y)
        const r = tileAt(state, x + 1, y)
        // Banks where water meets walkable/solid shore.
        const shore = (q: TileChar): boolean => q !== 'W'
        g.fillStyle = '#3d3457'
        if (shore(n)) g.fillRect(px, py, tile + 0.5, 3 * u + 0.5)
        if (shore(s)) g.fillRect(px, py + tile - 3 * u, tile + 0.5, 3 * u + 0.5)
        if (shore(l)) g.fillRect(px, py, 3 * u + 0.5, tile + 0.5)
        if (shore(r)) g.fillRect(px + tile - 3 * u, py, 3 * u + 0.5, tile + 0.5)
        if (shore(n)) {
          g.fillStyle = FOAM
          g.fillRect(px, py + 3 * u, tile + 0.5, u + 0.5)
        }
        // Still deep speck, two stepped frames.
        const f = Math.floor(presentT * 0.8 + v * 2) % 2
        g.fillStyle = 'rgba(142,131,184,0.35)'
        g.fillRect(px + (4 + f * 5) * u, py + 8 * u, 3 * u + 0.5, u + 0.5)
        break
      }
      case '~': {
        paintFloorBase(g, px, py, x, y, false)
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
        paintFloorBase(g, px, py, x, y, false)
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
        paintFloorBase(g, px, py, x, y, true)
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
        paintFloorBase(g, px, py, x, y, true)
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
        paintFloorBase(g, px, py, x, y, false)
        break
    }
  }

  function paintStaticLayer(g: Ctx, state: GameState): void {
    for (let y = 0; y < state.room.height; y++) {
      for (let x = 0; x < state.room.width; x++) {
        paintTile(g, state, x, y, x * tile, y * tile)
      }
    }
  }

  function ensureTileCache(state: GameState): void {
    const hash = hashRoom(state)
    if (hash === tileHash && tileCache) return
    tileHash = hash
    const w = Math.max(1, Math.round(rect.w * dprEff))
    const h = Math.max(1, Math.round(rect.h * dprEff))
    const off = makeOffscreen(w, h)
    if (!off) {
      tileCache = null
      return
    }
    const g = off.getContext('2d') as unknown as Ctx | null
    if (!g) {
      tileCache = null
      return
    }
    try {
      ;(g as unknown as { imageSmoothingEnabled: boolean }).imageSmoothingEnabled = false
    } catch { /* ignore */ }
    g.setTransform(dprEff, 0, 0, dprEff, 0, 0)
    g.clearRect(0, 0, rect.w, rect.h)
    paintStaticLayer(g, state)
    tileCache = off
  }

  // -- particles / rings -------------------------------------------------------

  function spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string): void {
    for (const p of particles) {
      if (!p.alive) {
        p.alive = true
        p.x = x
        p.y = y
        p.vx = vx
        p.vy = vy
        p.life = life
        p.maxLife = life
        p.size = size
        p.color = color
        return
      }
    }
  }

  function burst(tx: number, ty: number, n: number, speed: number, color: string, size: number, life: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.4 + Math.random() * 0.8)
      spawn(tx, ty, Math.cos(a) * s, Math.sin(a) * s, life * (0.7 + Math.random() * 0.6), size, color)
    }
  }

  function addRing(tx: number, ty: number, r1: number, dur: number, color: string): void {
    for (const r of rings) {
      if (!r.alive) {
        r.alive = true
        r.x = tx
        r.y = ty
        r.r0 = 0.1
        r.r1 = r1
        r.t = 0
        r.dur = dur
        r.color = color
        return
      }
    }
  }

  function onEvents(events: GameEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'swing':
          break
        case 'swordHit':
          burst(e.x, e.y, 4, 2.5, WHITE, 2, 0.18)
          burst(e.x, e.y, 3, 2, CYAN, 2, 0.3)
          break
        case 'swordClank':
          burst(e.x, e.y, 3, 1.5, LAV, 2, 0.2)
          break
        case 'enemyDied':
          burst(e.x, e.y, 8, 3.5, PINK, 2.5, 0.4)
          burst(e.x, e.y, 3, 2, WHITE, 2, 0.2)
          break
        case 'potSmash':
          burst(e.x, e.y, 7, 3, CLAY, 2.5, 0.4)
          burst(e.x, e.y, 3, 2, GOLD, 2, 0.4)
          break
        case 'grassCut':
          burst(e.x, e.y, 5, 2, '#6f5f95', 2, 0.35)
          break
        case 'playerHit':
          flashT = 0.08
          break
        case 'chestOpened': {
          const c = chestLookup.get(e.id)
          const chx = c ? c.x + 0.5 : lastFx
          const chy = c ? c.y + 0.5 : lastFy
          burst(chx, chy, 8, 2.5, GOLD, 2.5, 0.5) // small gold burst, no ring spam
          addRing(chx, chy, 1.0, 0.4, GOLD)
          break
        }
        case 'pickup': {
          burst(lastFx, lastFy, 6, 2, GOLD, 2, 0.4)
          break
        }
        case 'respawn':
          break
        case 'bossDefeated':
          burst(lastFx, lastFy, 14, 4, PINK, 3, 0.6)
          burst(lastFx, lastFy, 8, 2.5, GOLD, 2.5, 0.6)
          addRing(lastFx, lastFy, 2.0, 0.6, PINK)
          break
        case 'won':
          addRing(lastFx, lastFy, 2.5, 0.9, GOLD)
          break
        case 'shoot':
          burst(e.x, e.y, 2, 1.5, PINK, 2, 0.2)
          break
        case 'doorUnlocked':
        case 'doorOpened':
          burst(e.x, e.y, 6, 2, GOLD, 2.5, 0.4)
          break
        case 'slideStart':
          if (tileCache) {
            const copy = makeOffscreen(tileCache.width, tileCache.height)
            if (copy) {
              const g = copy.getContext('2d') as unknown as Ctx | null
              if (g) {
                g.setTransform(1, 0, 0, 1, 0, 0)
                try {
                  g.drawImage(tileCache, 0, 0)
                } catch {
                  slideFrom = null
                  break
                }
                slideFrom = copy
              }
            }
          }
          break
        default:
          break
      }
    }
  }

  function updateFx(dt: number, reducedMotion: boolean): void {
    if (reducedMotion) {
      for (const p of particles) p.alive = false
      for (const r of rings) r.alive = false
      flashT = 0
      return
    }
    if (flashT > 0) flashT = Math.max(0, flashT - dt)
    for (const p of particles) {
      if (!p.alive) continue
      p.life -= dt
      if (p.life <= 0) {
        p.alive = false
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - 2.5 * dt
      p.vy *= 1 - 2.5 * dt
    }
    for (const r of rings) {
      if (!r.alive) continue
      r.t += dt
      if (r.t >= r.dur) r.alive = false
    }
  }

  // -- coordinate helpers -------------------------------------------------------

  function toPx(tx: number, ty: number, ox: number, oy: number): { x: number; y: number } {
    return { x: rect.x + ox + tx * tile, y: rect.y + oy + ty * tile }
  }

  // -- letterbox backdrop (subdued: stars, ridge, small striped sun) -------------

  function drawBackdrop(g: Ctx, reducedMotion: boolean): void {
    g.fillStyle = BG
    g.fillRect(0, 0, cssW, cssH)
    // Stars outside the room only.
    const t = reducedMotion ? 0 : presentT
    for (const s of stars) {
      const sx = s.x * cssW
      const sy = s.y * cssH
      if (sx > rect.x - 4 && sx < rect.x + rect.w + 4 && sy > rect.y - 4 && sy < rect.y + rect.h + 4) continue
      const a = reducedMotion ? 0.5 : 0.3 + 0.25 * Math.sin(t * 1.2 + s.tw)
      g.fillStyle = `rgba(207,233,255,${a.toFixed(2)})`
      g.fillRect(sx, sy, s.s, s.s)
    }
    // Small striped sun: a stepped disc in the left letterbox, subordinate.
    const sunR = clamp(Math.min(cssW, cssH) * 0.035, 10, 26)
    const sunX = Math.max(14, rect.x / 2)
    const sunY = rect.y + rect.h * 0.28
    if (rect.x > sunR * 2 + 20) {
      const stripes = ['#ffd23f', '#ff9a3d', '#ff2fa0', '#b02070'] as const
      for (let i = 0; i < 4; i++) {
        const sy = sunY - sunR + (i * 2 * sunR) / 4
        const hh = 2 * sunR / 4 - (i > 0 ? (i - 1) * 1.5 : 0)
        // Stepped circle: width from the disc equation, snapped to 2px.
        const half = Math.sqrt(Math.max(0, sunR * sunR - (sunY - (sy + hh / 2)) ** 2))
        const w2 = Math.max(2, Math.floor(half / 2) * 2)
        g.fillStyle = stripes[i]
        g.fillRect(sunX - w2, sy, w2 * 2, Math.max(1, hh))
      }
    }
    {
      // Ridge silhouette along the bottom edge.
      g.fillStyle = '#120826'
      const baseY = cssH - 8
      g.beginPath()
      g.moveTo(0, cssH)
      g.lineTo(0, baseY)
      for (let x = 0; x <= cssW; x += 24) {
        const h = 4 + hash2(Math.round(x / 24), 3) * 10
        g.lineTo(x + 12, baseY - h)
        g.lineTo(x + 24, baseY)
      }
      g.lineTo(cssW, cssH)
      g.closePath()
      g.fill()
    }
  }

  // -- dynamic drawing ----------------------------------------------------------

  function drawExitPosts(g: Ctx, state: GameState, ox: number, oy: number): void {
    const portals = roomPortals.get(state.room.id)
    if (!portals) return
    const u = unit()
    for (const p of portals) {
      // Two lamp posts at the trigger's room-edge corners.
      const corners: Array<[number, number]> = [
        [p.x, p.y],
        [p.x + p.w, p.y + p.h],
      ]
      for (const [cx, cy] of corners) {
        const s = toPx(cx, cy, ox, oy)
        g.fillStyle = TRUNK_DARK
        g.fillRect(s.x - u, s.y - 5 * u, 2 * u + 0.5, 5 * u + 0.5)
        g.fillStyle = GOLD
        g.fillRect(s.x - 1.5 * u, s.y - 7 * u, 3 * u + 0.5, 2 * u + 0.5)
      }
    }
  }

  function drawChests(g: Ctx, state: GameState, ox: number, oy: number): void {
    const u = unit()
    for (const id of state.room.chestsClosed) {
      const c = chestLookup.get(id)
      if (!c) continue
      const p = toPx(c.x, c.y, ox, oy)
      const bx = p.x + 2 * u
      const by = p.y + 5 * u
      // Shadow + wooden body with gold trim (treasure focal).
      g.fillStyle = 'rgba(0,0,0,0.35)'
      g.fillRect(bx, by + 7 * u, 12 * u + 0.5, 2 * u + 0.5)
      g.fillStyle = TRUNK
      g.fillRect(bx, by, 12 * u + 0.5, 7 * u + 0.5)
      g.fillStyle = '#2a1c12'
      g.fillRect(bx, by + 5 * u, 12 * u + 0.5, 2 * u + 0.5)
      g.fillStyle = GOLD
      g.fillRect(bx, by, 12 * u + 0.5, u + 0.5)
      g.fillRect(bx, by, u + 0.5, 7 * u + 0.5)
      g.fillRect(bx + 11 * u, by, u + 0.5, 7 * u + 0.5)
      g.fillStyle = GOLD_DEEP
      g.fillRect(bx + 5 * u, by + 2 * u, 2 * u + 0.5, 3 * u + 0.5)
    }
  }

  function drawPickups(g: Ctx, state: GameState, ox: number, oy: number, reducedMotion: boolean): void {
    const u = unit()
    const bob = reducedMotion ? 0 : (Math.floor(presentT * 2) % 2 === 0 ? 0 : -u)
    for (const id of state.room.pickupsLeft) {
      const p = pickupLookup.get(id)
      if (!p) continue
      const c = toPx(p.x, p.y, ox, oy)
      const cx = c.x + 7 * u
      const cy = c.y + 6 * u + bob
      // Sword on a stone marker: diagonal white blade, cyan edge, gold hilt.
      g.fillStyle = STONE_DARK
      g.fillRect(cx - 3 * u, cy + 3 * u, 7 * u + 0.5, 2 * u + 0.5)
      for (let i = 0; i < 7; i++) {
        g.fillStyle = WHITE
        g.fillRect(cx + 3 * u - i * u, cy - 4 * u + i * u, u + 0.5, u + 0.5)
        g.fillStyle = CYAN
        g.fillRect(cx + 3 * u - i * u, cy - 3 * u + i * u, u + 0.5, u + 0.5)
      }
      g.fillStyle = GOLD
      g.fillRect(cx - 5 * u, cy + 4 * u, 4 * u + 0.5, u + 0.5)
      g.fillRect(cx - 4 * u, cy + 4 * u, u + 0.5, 3 * u + 0.5)
    }
  }

  function drawDrops(g: Ctx, state: GameState, ox: number, oy: number, reducedMotion: boolean): void {
    const u = unit()
    for (const d of state.room.drops) {
      if (d.t > DROP_LIFE - 2 && !reducedMotion && Math.floor(presentT * 4) % 2 === 1) continue
      const c = toPx(d.x, d.y, ox, oy)
      if (d.kind === 'heart') {
        drawMap(g, SPRITES.heart, c.x + tile / 2 - 4.5 * u, c.y + tile / 2 - 3.5 * u, u, FOE_PAL)
      } else {
        // Small gold key: ring + shaft + teeth.
        const kx = c.x + tile / 2
        const ky = c.y + tile / 2
        g.fillStyle = GOLD
        g.fillRect(kx - 4 * u, ky - 4 * u, 4 * u + 0.5, 4 * u + 0.5)
        g.fillStyle = BG
        g.fillRect(kx - 3 * u, ky - 3 * u, 2 * u + 0.5, 2 * u + 0.5)
        g.fillStyle = GOLD
        g.fillRect(kx, ky - u, 5 * u + 0.5, 2 * u + 0.5)
        g.fillRect(kx + 3 * u, ky + u, u + 0.5, 2 * u + 0.5)
        g.fillRect(kx + 4.5 * u, ky + u, u + 0.5, 2 * u + 0.5)
      }
    }
  }

  function drawPlayer(g: Ctx, state: GameState, ox: number, oy: number, reducedMotion: boolean): void {
    const pl = state.player
    if (pl.invuln > 0 && !reducedMotion && Math.floor(presentT * 12) % 2 === 1) return
    const c = toPx(pl.x, pl.y, ox, oy)
    const u = unit()
    const moving = Math.abs(pl.vx) + Math.abs(pl.vy) > 0.15
    const frame = reducedMotion || !moving ? 0 : Math.floor(walkPhase * 4) % 2
    let key = 'heroDown0'
    if (pl.facing === 'up') key = frame === 0 ? 'heroUp0' : 'heroUp1'
    else if (pl.facing === 'down') key = frame === 0 ? 'heroDown0' : 'heroDown1'
    else key = frame === 0 ? 'heroSide0' : 'heroSide1'
    const flip = pl.facing === 'left'
    const map = SPRITES[key]
    const mw = (map[0]?.length ?? 12) * u
    const mh = map.length * u
    let scale = 1
    if (state.phase === 'dying' && state.dying) {
      scale = Math.max(0.2, 1 - state.dying.t * 0.9)
    }
    // Swing body language: anticipation leans back, attack lunges.
    let lx = 0
    let ly = 0
    let swingP = -1
    if (pl.swing) {
      swingP = clamp(pl.swing.t / SWING_TIME, 0, 1)
      const lunge = swingP < 0.25 ? -u : swingP < 0.7 ? 1.5 * u : 0.5 * u
      if (pl.swing.facing === 'left') lx = -lunge
      else if (pl.swing.facing === 'right') lx = lunge
      else if (pl.swing.facing === 'up') ly = -lunge
      else ly = lunge
    }
    const feetX = c.x + tile / 2 + lx
    const feetY = c.y + tile * 0.98 + ly
    g.save()
    g.translate(feetX, feetY)
    g.scale(scale, scale)
    g.translate(-feetX, -feetY)
    drawMap(g, map, feetX - mw / 2, feetY - mh, u, HERO_PAL, flip)
    g.restore()

    // Sword: stepped pixel arc + white blade at the leading edge.
    if (pl.swing && swingP >= 0) {
      const base = facingAngle(pl.swing.facing)
      const a0 = base - SWORD_ARC / 2
      const cx = feetX
      const cy = feetY - mh * 0.55
      const R = SWORD_REACH * tile
      const a1 = a0 + SWORD_ARC * swingP
      // Arc trail: coarse pixel steps in cyan (attack phase only).
      if (swingP >= 0.25) {
        const steps = 9
        for (let i = 0; i <= Math.floor(steps * swingP); i++) {
          const a = a0 + (SWORD_ARC * i) / steps
          const ax = cx + Math.cos(a) * R
          const ay = cy + Math.sin(a) * R
          g.fillStyle = 'rgba(47,243,255,0.5)'
          g.fillRect(ax - u, ay - u, 2 * u + 0.5, 2 * u + 0.5)
        }
      }
      // Blade at the leading edge: 5 white pixels + cyan spine.
      const bx = cx + Math.cos(a1) * R
      const by = cy + Math.sin(a1) * R
      const dxn = Math.cos(a1)
      const dyn = Math.sin(a1)
      for (let i = 0; i < 5; i++) {
        const q = 0.45 + i * 0.14
        g.fillStyle = WHITE
        g.fillRect(cx + dxn * R * q - u / 2, cy + dyn * R * q - u / 2, u + 0.5, u + 0.5)
      }
      g.fillStyle = CYAN
      g.fillRect(bx - u, by - u, 2 * u + 0.5, 2 * u + 0.5)
    }
  }

  function drawEnemy(g: Ctx, e: Enemy, ox: number, oy: number, reducedMotion: boolean): void {
    const c = toPx(e.x, e.y, ox, oy)
    const u = unit()
    const tell = e.brain.tell > 0
    const r = Math.max(3, e.r * tile)

    if (tell && (e.kind === 'chaser' || e.kind === 'knight')) {
      // Single corner-tick ring: four ticks, no pulsing aura.
      g.fillStyle = PINK
      const cx = c.x + tile / 2
      const cy = c.y + tile / 2
      const rr = r + 2 * u
      const L = 4 * u
      g.fillRect(cx - rr, cy - rr, L, u)
      g.fillRect(cx - rr, cy - rr, u, L)
      g.fillRect(cx + rr - L, cy - rr, L, u)
      g.fillRect(cx + rr - L, cy - rr, u, L)
      g.fillRect(cx - rr, cy + rr - u, L, u)
      g.fillRect(cx - rr, cy + rr - L, u, L)
      g.fillRect(cx + rr - L, cy + rr - u, L, u)
      g.fillRect(cx + rr - L, cy + rr - L, u, L)
    }
    if (e.kind === 'slimeKnight' && tell) {
      // Slam disc: flat pink at fixed alpha, stepped edge.
      const cx = c.x + tile / 2
      const cy = c.y + tile / 2
      g.fillStyle = 'rgba(255,47,160,0.30)'
      const R = tile * 1.5
      g.fillRect(cx - R, cy - R + 4 * u, R * 2, R * 2 - 8 * u)
      g.fillRect(cx - R + 4 * u, cy - R, R * 2 - 8 * u, R * 2)
      g.fillStyle = PINK
      g.fillRect(cx - R, cy - R, R * 2, u)
      g.fillRect(cx - R, cy + R, R * 2, u)
    }

    const cx = c.x + tile / 2
    const cy = c.y + tile / 2
    switch (e.kind) {
      case 'chaser': {
        const map = SPRITES.chaser
        drawMap(g, map, cx - 7 * u, cy - 4.5 * u, u, FOE_PAL)
        // Snout pixel leads the facing.
        g.fillStyle = '#ff7fc0'
        if (e.facing === 'left') g.fillRect(cx - 8 * u, cy - u, 2 * u, 2 * u)
        else if (e.facing === 'right') g.fillRect(cx + 6 * u, cy - u, 2 * u, 2 * u)
        else if (e.facing === 'up') g.fillRect(cx - u, cy - 6 * u, 2 * u, 2 * u)
        else g.fillRect(cx - u, cy + 4 * u, 2 * u, 2 * u)
        break
      }
      case 'wanderer': {
        const squash = !reducedMotion && Math.sin(presentT * 6) > 0.4
        const map = squash ? SPRITES.blob1 : SPRITES.blob0
        drawMap(g, map, cx - 6 * u, cy - 4 * u, u, FOE_PAL)
        break
      }
      case 'turret': {
        const map = SPRITES.statue
        drawMap(g, map, cx - 7 * u, cy - 7 * u, u, FOE_PAL)
        // Eye: dark slit, bright pink + white core on telegraph.
        const ex = cx - 2 * u
        const ey = cy - 3 * u
        if (tell) {
          g.fillStyle = PINK
          g.fillRect(ex, ey, 4 * u + 0.5, 2 * u + 0.5)
          g.fillStyle = WHITE
          g.fillRect(ex + u, ey, 2 * u + 0.5, 2 * u + 0.5)
        }
        // Barrel stub toward facing.
        const a = facingAngle(e.facing)
        g.fillStyle = '#3a3f5e'
        g.fillRect(cx + Math.cos(a) * 6 * u - u, cy + Math.sin(a) * 6 * u - u, 4 * u, 2 * u)
        break
      }
      case 'bat': {
        const flap = reducedMotion ? 0 : Math.floor(presentT * 8) % 2
        const map = flap === 0 ? SPRITES.bat0 : SPRITES.bat1
        drawMap(g, map, cx - 7 * u, cy - 2.5 * u, u, FOE_PAL)
        break
      }
      case 'knight': {
        const map = SPRITES.knight
        drawMap(g, map, cx - 7 * u, cy - 8 * u, u, FOE_PAL)
        // Gold shield plate on the facing side.
        g.fillStyle = GOLD
        if (e.facing === 'left') g.fillRect(cx - 10 * u, cy - 3 * u, 3 * u + 0.5, 7 * u + 0.5)
        else if (e.facing === 'right') g.fillRect(cx + 7 * u, cy - 3 * u, 3 * u + 0.5, 7 * u + 0.5)
        else if (e.facing === 'up') g.fillRect(cx - 3 * u, cy - 11 * u, 7 * u + 0.5, 3 * u + 0.5)
        else g.fillRect(cx - 3 * u, cy + 5 * u, 7 * u + 0.5, 3 * u + 0.5)
        g.fillStyle = WHITE
        if (e.facing === 'left') g.fillRect(cx - 10 * u, cy - 3 * u, u + 0.5, 2 * u + 0.5)
        else if (e.facing === 'right') g.fillRect(cx + 7 * u, cy - 3 * u, u + 0.5, 2 * u + 0.5)
        break
      }
      case 'slimeKnight': {
        const map = SPRITES.crown
        const bu = u * 1.5 // boss reads bigger; still whole logical pixels
        const bw = (map[0]?.length ?? 19) * bu
        const bh = map.length * bu
        drawMap(g, map, cx - bw / 2, cy - bh / 2, bu, FOE_PAL)
        break
      }
    }

    // Hit flash: single white silhouette while invulnerable.
    if (e.invuln > 0) {
      g.fillStyle = 'rgba(255,255,255,0.65)'
      g.fillRect(cx - r, cy - r, r * 2 + 0.5, r * 2 + 0.5)
    }
  }

  function drawProjectiles(g: Ctx, state: GameState, ox: number, oy: number): void {
    const u = unit()
    for (const pr of state.room.projectiles) {
      const c = toPx(pr.x, pr.y, ox, oy)
      const cx = c.x + tile / 2
      const cy = c.y + tile / 2
      // Pink 3px bolt + white core pixel.
      g.fillStyle = PINK
      g.fillRect(cx - 1.5 * u, cy - 1.5 * u, 3 * u + 0.5, 3 * u + 0.5)
      g.fillStyle = WHITE
      g.fillRect(cx - 0.5 * u, cy - 0.5 * u, u + 0.5, u + 0.5)
    }
  }

  function drawFx(g: Ctx, ox: number, oy: number): void {
    const u = unit()
    for (const p of particles) {
      if (!p.alive) continue
      const a = clamp(p.life / p.maxLife, 0, 1)
      g.globalAlpha = a
      g.fillStyle = p.color
      const s = Math.max(1.5, p.size * u * 0.6)
      g.fillRect(rect.x + ox + p.x * tile - s / 2, rect.y + oy + p.y * tile - s / 2, s, s)
    }
    g.globalAlpha = 1
    for (const r of rings) {
      if (!r.alive) continue
      const p = clamp(r.t / r.dur, 0, 1)
      const rad = (r.r0 + (r.r1 - r.r0) * p) * tile
      g.globalAlpha = 1 - p
      g.fillStyle = r.color
      const cx = rect.x + ox + r.x * tile
      const cy = rect.y + oy + r.y * tile
      const th = Math.max(1.5, unit())
      // Stepped ring: four edge bars.
      g.fillRect(cx - rad, cy - rad, rad * 2, th)
      g.fillRect(cx - rad, cy + rad - th, rad * 2, th)
      g.fillRect(cx - rad, cy - rad, th, rad * 2)
      g.fillRect(cx + rad - th, cy - rad, th, rad * 2)
    }
    g.globalAlpha = 1
  }

  // -- HUD / overlays -----------------------------------------------------------

  function drawHud(g: Ctx, state: GameState): void {
    const u = Math.max(1, Math.round(unit()))
    const hx = 10
    const hy = 8
    // Pixel hearts: filled pink to hp, empty glyph beyond.
    const maxShow = Math.min(5, state.player.maxHp)
    for (let i = 0; i < maxShow; i++) {
      const map = i < state.player.hp ? SPRITES.heart : SPRITES.heartEmpty
      drawMap(g, map, hx + i * 11 * u, hy, u, FOE_PAL)
    }
    // Key count: gold key glyph + machine count.
    let kx = hx + maxShow * 11 * u + 8
    g.fillStyle = GOLD
    g.fillRect(kx, hy + 2 * u, 3 * u, 3 * u)
    g.fillStyle = BG
    g.fillRect(kx + u, hy + 3 * u, u, u)
    g.fillStyle = GOLD
    g.fillRect(kx + 3 * u, hy + 3 * u, 4 * u, 2 * u)
    g.fillRect(kx + 5 * u, hy + 5 * u, u, 2 * u)
    g.fillStyle = GOLD
    g.font = `${12}px ${MACHINE_FONT}`
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(`x${state.player.smallKeys}`, kx + 9 * u, hy + 4 * u)
    kx += 9 * u + 24
    if (state.player.hasBossKey) {
      g.fillStyle = GOLD
      g.fillRect(kx, hy + u, 6 * u, 6 * u)
      g.fillStyle = BG
      g.fillRect(kx + 2 * u, hy + 3 * u, 2 * u, 2 * u)
      if (cssW > 420) {
        g.font = `10px ${MACHINE_FONT}`
        g.fillStyle = GOLD
        g.fillText('BOSS', kx + 8 * u, hy + 4 * u)
        kx += 8 * u + 34
      } else {
        kx += 8 * u
      }
    }
    // Room label on wide screens (top-right belongs to the radio widget).
    if (cssW >= 480) {
      const name = roomName.get(state.room.id) ?? state.room.id
      g.fillStyle = 'rgba(185,168,217,0.85)'
      g.font = `12px ${MACHINE_FONT}`
      g.textAlign = 'left'
      g.textBaseline = 'middle'
      g.fillText(name, kx + 8, hy + 4 * u)
    }
  }

  function drawBanner(g: Ctx, ui: FrameUI): void {
    if (!ui.banner || ui.banner.t <= 0) return
    const a = clamp(ui.banner.t, 0, 1)
    g.globalAlpha = a
    g.fillStyle = CYAN
    const size = clamp(Math.round(cssW * 0.055), 18, 28)
    g.font = `${size}px ${MACHINE_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(ui.banner.text, cssW / 2, rect.y + rect.h * 0.32)
    g.globalAlpha = 1
    g.textAlign = 'left'
  }

  function drawHint(g: Ctx, ui: FrameUI): void {
    if (!ui.hint) return
    const y = rect.y + rect.h + 20
    if (y > cssH - 6) return
    g.fillStyle = 'rgba(185,168,217,0.8)'
    g.font = `11px ${MACHINE_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(ui.hint, cssW / 2, y)
    g.textAlign = 'left'
  }

  function drawStick(g: Ctx, ui: FrameUI): void {
    if (!ui.stick) return
    const { originX, originY, dx, dy } = ui.stick
    g.fillStyle = 'rgba(47,243,255,0.25)'
    const R = 40
    g.fillRect(originX - R, originY - 1, R * 2, 2)
    g.fillRect(originX - 1, originY - R, 2, R * 2)
    const len = Math.hypot(dx, dy)
    const cl = len > 40 && len > 0 ? 40 / len : 1
    g.fillStyle = CYAN
    const nx = originX + dx * cl
    const ny = originY + dy * cl
    g.fillRect(nx - 7, ny - 7, 14, 14)
    g.fillStyle = BG
    g.fillRect(nx - 4, ny - 4, 8, 8)
  }

  // -- main draw ------------------------------------------------------------------

  function draw(state: GameState, ui: FrameUI, dt: number): void {
    const step = clamp(dt, 0, 0.1)
    presentT += step
    const speed = Math.abs(state.player.vx) + Math.abs(state.player.vy)
    if (!ui.reducedMotion && speed > 0.15) {
      walkPhase += step * (3 + speed * 1.6)
    }
    updateFx(step, ui.reducedMotion)

    computeLayout(state.room.width, state.room.height)
    lastFx = state.player.x
    lastFy = state.player.y

    gSaveReset()
    drawBackdrop(ctx, ui.reducedMotion)

    // Screen shake (±4 px decaying), skipped under reduced motion.
    let shx = 0
    let shy = 0
    if (!ui.reducedMotion && state.shake > 0) {
      const m = Math.min(1, state.shake) * 4
      shx = (Math.random() * 2 - 1) * m
      shy = (Math.random() * 2 - 1) * m
    }

    // Room frame: 2px stone border so the play area reads as the main visual.
    ctx.fillStyle = STONE_DARK
    ctx.fillRect(rect.x - 2, rect.y - 2, rect.w + 4, 2)
    ctx.fillRect(rect.x - 2, rect.y + rect.h, rect.w + 4, 2)
    ctx.fillRect(rect.x - 2, rect.y, 2, rect.h)
    ctx.fillRect(rect.x + rect.w, rect.y, 2, rect.h)

    const sliding = state.phase === 'slide' && state.slide && !ui.reducedMotion && slideFrom && tileCache
    if (sliding && state.slide) {
      drawSlide(state, ui, shx, shy)
    } else {
      ensureTileCache(state)
      ctx.save()
      ctx.beginPath()
      ctx.rect(rect.x, rect.y, rect.w + 0.5, rect.h + 0.5)
      ctx.clip()
      if (tileCache) {
        try {
          ctx.drawImage(tileCache, rect.x + shx, rect.y + shy, rect.w, rect.h)
        } catch {
          paintStaticLayerAt(ctx, state, rect.x + shx, rect.y + shy)
        }
      } else {
        paintStaticLayerAt(ctx, state, rect.x + shx, rect.y + shy)
      }
      drawRoomDynamics(state, ui, shx, shy)
      ctx.restore()
    }

    if (state.phase === 'dying') {
      ctx.fillStyle = 'rgba(11,6,22,0.3)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }
    if (ui.paused) {
      ctx.fillStyle = 'rgba(11,6,22,0.4)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }
    if (flashT > 0 && !ui.reducedMotion) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }

    drawHud(ctx, state)
    drawBanner(ctx, ui)
    drawHint(ctx, ui)
    drawStick(ctx, ui)
  }

  function gSaveReset(): void {
    try {
      ctx.setTransform(dprEff, 0, 0, dprEff, 0, 0)
    } catch {
      // stub absorbs
    }
  }

  function paintStaticLayerAt(g: Ctx, state: GameState, ox: number, oy: number): void {
    for (let y = 0; y < state.room.height; y++) {
      for (let x = 0; x < state.room.width; x++) {
        paintTile(g, state, x, y, ox + x * tile, oy + y * tile)
      }
    }
  }

  function drawRoomDynamics(state: GameState, ui: FrameUI, shx: number, shy: number): void {
    drawExitPosts(ctx, state, shx, shy)
    drawChests(ctx, state, shx, shy)
    drawPickups(ctx, state, shx, shy, ui.reducedMotion)
    drawDrops(ctx, state, shx, shy, ui.reducedMotion)
    for (const e of state.room.enemies) {
      drawEnemy(ctx, e, shx, shy, ui.reducedMotion)
    }
    drawProjectiles(ctx, state, shx, shy)
    drawPlayer(ctx, state, shx, shy, ui.reducedMotion)
    if (!ui.reducedMotion) drawFx(ctx, shx, shy)
  }

  function drawSlide(state: GameState, _ui: FrameUI, shx: number, shy: number): void {
    const slide = state.slide
    if (!slide || !slideFrom || !tileCache) return
    const p = clamp(slide.t / SLIDE_TIME, 0, 1)
    let fx = 0
    let fy = 0
    let tx = 0
    let ty = 0
    if (slide.dir === 'right') {
      fx = -p * rect.w
      tx = (1 - p) * rect.w
    } else if (slide.dir === 'left') {
      fx = p * rect.w
      tx = -(1 - p) * rect.w
    } else if (slide.dir === 'down') {
      fy = -p * rect.h
      ty = (1 - p) * rect.h
    } else {
      fy = p * rect.h
      ty = -(1 - p) * rect.h
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w + 0.5, rect.h + 0.5)
    ctx.clip()
    try {
      ctx.drawImage(slideFrom, rect.x + shx + fx, rect.y + shy + fy, rect.w, rect.h)
    } catch {
      // stub: ignore
    }
    try {
      ctx.drawImage(tileCache, rect.x + shx + tx, rect.y + shy + ty, rect.w, rect.h)
    } catch {
      paintStaticLayerAt(ctx, state, rect.x + shx + tx, rect.y + shy + ty)
    }
    drawExitPosts(ctx, state, shx + tx, shy + ty)
    drawChests(ctx, state, shx + tx, shy + ty)
    drawPickups(ctx, state, shx + tx, shy + ty, true)
    drawDrops(ctx, state, shx + tx, shy + ty, true)
    for (const e of state.room.enemies) {
      drawEnemy(ctx, e, shx + tx, shy + ty, true)
    }
    drawProjectiles(ctx, state, shx + tx, shy + ty)
    drawPlayer(ctx, state, shx + tx, shy + ty, true)
    ctx.restore()
  }

  return { resize, draw, onEvents, roomRect }
}
