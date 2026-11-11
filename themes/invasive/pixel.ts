/**
 * INVASIVE: the drawing. Neon Shrine's pixel stage; one cell of the engine's
 * grid is `CELL` logical pixels, and every cell of the sky is a four-pixel
 * invader with two frames, so the whole ceiling marches in place on the beat.
 *
 * Nothing here knows the rules: Game.vue reads the engine's state and asks
 * these painters for canvases.
 */
import { makeCanvas } from '../base/pixel/stage'
import { mix } from '../base/pixel/sprites'
import { DUSK, hash2, paintRidge, paintSky, rect } from '../base/pixel/scenery'

type G = CanvasRenderingContext2D
type Canvas = HTMLCanvasElement

/** Logical pixels per grid cell. */
export const CELL = 4

export const INK = '#0b0616'
export const CYAN = '#2ff3ff'
export const GOLD = '#ffd23f'
export const WHITE = '#fff4ff'

/** A species' colours: dark, body, bright, and the light it throws. */
export interface Look { dark: string; mid: string; hi: string; glow: string }

/** One look per species, in the engine's order (MOSS, VINE, CORAL, MYCEL, CROWN). */
export const LOOKS: readonly Look[] = [
  { dark: '#b01874', mid: '#ff2fa0', hi: '#ff8ae0', glow: '#ff2fa0' },
  { dark: '#54259e', mid: '#9a4ff0', hi: '#cfc6ff', glow: '#9a4ff0' },
  { dark: '#9e1638', mid: '#ff8a3d', hi: '#fff1b0', glow: '#ff8a3d' },
  { dark: '#1f7a6e', mid: '#3fd8b0', hi: '#b6ff4a', glow: '#3fd8b0' },
  { dark: '#c4861c', mid: '#ffd23f', hi: '#fff4ff', glow: '#ffd23f' },
]

export function lookFor(layer: number): Look {
  return LOOKS[(layer - 1) % LOOKS.length]!
}

// ---------------------------------------------------------------- cells

/** The two frames of a cell: X = body, o = eye. */
const FRAMES: readonly (readonly string[])[] = [
  ['X..X', 'XXXX', 'oXXo', 'X..X'],
  ['.XX.', 'XXXX', 'oXXo', '.XX.'],
]
/** A hardened stem: a solid block with a rim. */
const BARK: readonly string[] = ['XXXX', 'XooX', 'XooX', 'XXXX']

function glyph(rows: readonly string[], body: string, eye: string): Canvas {
  const c = makeCanvas(CELL, CELL)
  const g = c.getContext('2d')!
  for (let y = 0; y < CELL; y++) for (let x = 0; x < CELL; x++) {
    const ch = rows[y]![x]
    if (ch === '.') continue
    g.fillStyle = ch === 'o' ? eye : body
    g.fillRect(x, y, 1, 1)
  }
  return c
}

/** What a cell is drawn as. */
export const PART = { Flesh: 0, Stem: 1, Tip: 2, Bark: 3, Root: 4, Dying: 5 } as const
export type Part = typeof PART[keyof typeof PART]

const cellCache = new Map<string, Canvas>()

/**
 * A cell's sprite. `level` 0–2 is how lit it is (the pulse from the heart
 * passes through as a wave of level 2); `frame` 0/1 is the march.
 */
export function cellSprite(look: Look, part: Part, frame: number, level: number): Canvas {
  const key = `${look.mid}|${part}|${frame}|${level}`
  let c = cellCache.get(key)
  if (c) return c
  let body: string
  let eye = INK
  let rows = FRAMES[frame & 1]!
  switch (part) {
    case PART.Flesh:
      body = level === 0 ? mix(look.dark, INK, 0.5) : level === 1 ? look.dark : look.mid
      eye = level === 2 ? WHITE : mix(look.dark, INK, 0.85)
      break
    case PART.Stem:
      body = level === 0 ? look.dark : level === 1 ? look.mid : look.hi
      eye = level === 2 ? WHITE : INK
      break
    case PART.Tip:
      body = level === 2 ? WHITE : look.hi
      eye = INK
      break
    case PART.Bark:
      rows = BARK
      body = level === 2 ? look.hi : mix(look.mid, '#cfc6ff', 0.45)
      eye = mix(look.dark, INK, 0.4)
      break
    case PART.Root:
      body = level === 0 ? '#9e1638' : '#ff3b5c'
      eye = level === 2 ? WHITE : INK
      break
    default:
      body = level ? WHITE : '#8f86b8'
      eye = level ? '#8f86b8' : INK
  }
  c = glyph(rows, body, eye)
  cellCache.set(key, c)
  return c
}

/** A pod: a swelling one pixel larger than its cell all round. */
export function podSprite(look: Look, swell: boolean): Canvas {
  const key = `pod|${look.mid}|${swell}`
  let c = cellCache.get(key)
  if (c) return c
  const rows = swell
    ? ['.XXXX.', 'XhhXXX', 'XhXXXX', 'XXXXXd', 'XXXXdd', '.XXdd.']
    : ['......', '.XXXX.', '.XhXX.', '.XXXd.', '.XXdd.', '......']
  c = makeCanvas(6, 6)
  const g = c.getContext('2d')!
  for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    const ch = rows[y]![x]
    if (ch === '.') continue
    g.fillStyle = ch === 'h' ? WHITE : ch === 'd' ? '#c4861c' : GOLD
    g.fillRect(x, y, 1, 1)
  }
  cellCache.set(key, c)
  return c
}

/** The heart, three cells square: the one big invader the rest are made of. */
const HEART_ROWS: readonly string[] = [
  '..XX....XX..',
  '...X....X...',
  '..XXXXXXXX..',
  '.XXXXXXXXXX.',
  'XXXooXXooXXX',
  'XXXooXXooXXX',
  'XXXXXXXXXXXX',
  '.XXXXXXXXXX.',
  '..XX.XX.XX..',
  '.XX..XX..XX.',
  'XX...XX...XX',
  '............',
]
/** Cracks that open as it is hurt (1 and 2 = how far gone). */
const HEART_CRACKS: readonly string[] = [
  '............',
  '............',
  '......2.....',
  '.....12.....',
  '.....1...2..',
  '....11..2...',
  '...1...22...',
  '..1....2....',
  '............',
  '............',
  '............',
  '............',
]

/** `hurt` 0–2, `beat` true on the thump (it swells), `flash` true when the lance is on it. */
export function heartSprite(look: Look, hurt: number, beat: boolean, flash: boolean): Canvas {
  const key = `heart|${look.mid}|${hurt}|${beat}|${flash}`
  let c = cellCache.get(key)
  if (c) return c
  const n = 12
  const base = makeCanvas(n, n)
  const g = base.getContext('2d')!
  const body = flash ? WHITE : beat ? look.hi : look.mid
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const ch = HEART_ROWS[y]![x]
    if (ch === '.') { g.fillStyle = INK; g.fillRect(x, y, 1, 1); continue }
    const crack = Number(HEART_CRACKS[y]![x]) || 0
    let col = body
    if (ch === 'o') col = flash ? '#ff3b5c' : INK
    else if (crack && crack <= hurt) col = INK
    else if (y > 7 && !flash) col = look.dark
    g.fillStyle = col
    g.fillRect(x, y, 1, 1)
  }
  cellCache.set(key, base)
  return base
}

// ---------------------------------------------------------------- the cannon

const CANNON_ROWS: readonly string[] = [
  '.....w.....',
  '....ccc....',
  '....cCc....',
  '..ccccccc..',
  '.ccCCCCCcc.',
  'ccccccccccc',
  'kK.kK.kK.kK',
]
const CANNON_PAL: Record<string, string> = { w: WHITE, c: CYAN, C: '#1a9fc4', k: INK, K: '#5a5285' }

const cannonCache = new Map<string, Canvas>()
/** `mode`: the plain cannon, lit gold with the lance, or grey while snared. */
export function cannonSprite(mode: 'plain' | 'lance' | 'snared'): Canvas {
  let c = cannonCache.get(mode)
  if (c) return c
  const pal = mode === 'lance'
    ? { ...CANNON_PAL, c: GOLD, C: '#c4861c' }
    : mode === 'snared' ? { ...CANNON_PAL, c: '#8f86b8', C: '#5a5285', w: '#8f86b8' } : CANNON_PAL
  c = makeCanvas(11, 7)
  const g = c.getContext('2d')!
  for (let y = 0; y < 7; y++) for (let x = 0; x < 11; x++) {
    const ch = CANNON_ROWS[y]![x]!
    if (ch === '.') continue
    g.fillStyle = pal[ch]!
    g.fillRect(x, y, 1, 1)
  }
  cannonCache.set(mode, c)
  return c
}

// ---------------------------------------------------------------- the town

export const HOUSE_H = 12
/** Window x offsets in a house 20 pixels wide; they go out left to right. */
export const WINDOW_X: readonly number[] = [2, 6, 12, 16]
export const WINDOW_Y = 6

/**
 * A house, 20×12: a roof, a wall, four windows and a door. `lights` of the
 * four windows are lit; a house with none is a silhouette.
 */
export function paintHouse(g: G, x: number, roofY: number, lights: number, salt: number) {
  const dark = lights <= 0
  const wall = dark ? '#1c1436' : DUSK.wall
  const wallL = dark ? '#241a44' : DUSK.wallL
  const roof = dark ? '#2a1438' : DUSK.roof
  const roofL = dark ? '#3a1c4c' : DUSK.roofL
  // Roof: four rows, stepping in.
  for (let r = 0; r < 4; r++) {
    const inset = 3 - r
    rect(g, r === 0 ? roofL : roof, x + inset, roofY + r, 20 - inset * 2, 1)
  }
  if (!dark) rect(g, DUSK.roofHi, x + 3, roofY, 14, 1)
  rect(g, wall, x + 1, roofY + 4, 18, HOUSE_H - 4)
  rect(g, wallL, x + 1, roofY + 4, 18, 1)
  // A chimney on some.
  if (hash2(salt, 3, 71) > 0.4) rect(g, roof, x + 14, roofY - 2, 2, 3)
  rect(g, dark ? INK : DUSK.wallD, x + 9, roofY + 8, 2, 4) // door
  for (let i = 0; i < WINDOW_X.length; i++) {
    const lit = i >= WINDOW_X.length - lights
    const wx = x + WINDOW_X[i]!
    rect(g, lit ? DUSK.window : INK, wx, roofY + WINDOW_Y, 2, 3)
    if (lit) rect(g, '#fff1b0', wx, roofY + WINDOW_Y, 2, 1)
  }
}

/**
 * The still backdrop: a night sky with dusk low on the horizon, two ridges,
 * the street, and the earth under it (the strip a finger rests on).
 */
export function paintBackdrop(vw: number, vh: number, groundY: number): Canvas {
  const c = makeCanvas(vw, vh)
  const g = c.getContext('2d')!
  const horizon = groundY - 4
  paintSky(g, vw, horizon, true)
  // Fixed stars; the ceiling hides most of them until a layer falls.
  for (let i = 0; i < (vw * horizon) / 220; i++) {
    const x = Math.floor(hash2(i, 1, 41) * vw)
    const y = Math.floor(Math.pow(hash2(i, 2, 41), 1.4) * horizon * 0.8)
    rect(g, hash2(i, 3, 41) > 0.7 ? DUSK.starHi : '#6a5fa0', x, y)
  }
  paintRidge(g, vw, horizon - 6, 22, groundY, DUSK.ridgeFar, DUSK.ridgeFarRim, 4, 0.6)
  paintRidge(g, vw, horizon + 2, 12, groundY, DUSK.ridge, DUSK.ridgeRim, 9, 0.3)
  // The street and the earth below.
  rect(g, '#2a1f4a', 0, groundY, vw, 1)
  rect(g, '#1c1030', 0, groundY + 1, vw, 2)
  rect(g, INK, 0, groundY + 3, vw, Math.max(0, vh - groundY - 3))
  for (let y = groundY + 4; y < vh; y += 2) for (let x = 0; x < vw; x++) {
    const h = hash2(x, y, 19)
    if (h > 0.965) rect(g, '#2a1f4a', x, y, h > 0.985 ? 2 : 1, 1)
    else if (h < 0.008) rect(g, '#3a1a4a', x, y, 1, 2)
  }
  return c
}

/** A stone pillar at the edge of the field on a wide screen. */
export function paintPillar(g: G, x: number, top: number, bottom: number) {
  rect(g, DUSK.stoneD, x, top, 3, bottom - top)
  rect(g, DUSK.stone, x + 1, top, 1, bottom - top)
  for (let y = top + 5; y < bottom; y += 9) rect(g, DUSK.stoneTop, x, y, 3, 1)
}
