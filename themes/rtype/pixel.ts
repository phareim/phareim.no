/**
 * R-Type in Neon Shrine's pixel look (2026-09-24): a flight through the
 * shrine caves. Rock walls in the cliff palette with a lit floor rim, moss,
 * stalactites and glowing crystals; parallax ridges and a warm glow at the
 * far end of the cave behind; the ship in the Hangar colours; enemies in
 * orange (the game's danger hue) with outlines and lit cores. Everything
 * here is in logical pixels of the stage; `Shooter.vue` keeps its rules in
 * CSS px and converts.
 */
import { makeCanvas } from '../base/pixel/stage'
import { bayer, pixelize, shade } from '../base/pixel/sprites'

type G = CanvasRenderingContext2D
type C = HTMLCanvasElement

export const ROCK = { rock: '#5b4b8e', rockL: '#7a68b0', rockD: '#3a2c66', rockDD: '#271c4a', rim: '#9690c4', moss: '#3fd8b0', mossD: '#1f7a6e', drip: '#1c1440' }

export function hash1(n: number, salt = 0): number {
  let h = (n * 374761393 + salt * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Periodic smooth noise: repeats every `cells` cells of `cell` px. */
function pnoise(x: number, cell: number, cells: number, salt: number): number {
  const gx = Math.floor(x / cell)
  const f = x / cell - gx
  const s = f * f * (3 - 2 * f)
  const w = (n: number) => hash1(((n % cells) + cells) % cells, salt)
  const a = w(gx)
  return a + (w(gx + 1) - a) * s
}

function r(g: G, c: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

function disc(g: G, c: string, cx: number, cy: number, rad: number) {
  g.fillStyle = c
  for (let y = -rad; y <= rad; y++) {
    const half = Math.floor(Math.sqrt(rad * rad - y * y + rad * 0.8))
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1)
  }
}

// ---------------------------------------------------------------- rock

export const ROCK_TW = 64
export const ROCK_TH = 48

/** A tileable rock texture: packed boulders, lit from the top left. */
export function rockTexture(): C {
  const c = makeCanvas(ROCK_TW, ROCK_TH)
  const g = c.getContext('2d')!
  r(g, ROCK.rockDD, 0, 0, ROCK_TW, ROCK_TH)
  const stones: { x: number; y: number; r: number }[] = []
  for (let i = 0; i < 22; i++) stones.push({ x: Math.floor(hash1(i, 3) * ROCK_TW), y: Math.floor(hash1(i, 4) * ROCK_TH), r: 4 + Math.floor(hash1(i, 5) * 6) })
  // Wrapped so the tile repeats seamlessly.
  const each = (fn: (x: number, y: number, s: { r: number }) => void) => {
    for (const s of stones) for (const dx of [-ROCK_TW, 0, ROCK_TW]) for (const dy of [-ROCK_TH, 0, ROCK_TH]) fn(s.x + dx, s.y + dy, s)
  }
  each((x, y, s) => disc(g, ROCK.rockD, x, y, s.r))
  each((x, y, s) => disc(g, ROCK.rock, x - 1, y - 1, s.r - 2))
  each((x, y, s) => { r(g, ROCK.rockL, x - s.r + 2, y - s.r + 1, Math.max(1, s.r - 1), 1); r(g, ROCK.rockL, x - s.r + 1, y - s.r + 2, 1, Math.max(1, s.r - 2)) })
  // Cracks.
  for (let i = 0; i < 9; i++) {
    let x = Math.floor(hash1(i, 8) * ROCK_TW)
    let y = Math.floor(hash1(i, 9) * ROCK_TH)
    for (let j = 0; j < 5; j++) {
      r(g, ROCK.rockDD, ((x % ROCK_TW) + ROCK_TW) % ROCK_TW, ((y % ROCK_TH) + ROCK_TH) % ROCK_TH)
      x += hash1(i * 7 + j, 10) > 0.5 ? 1 : 0
      y += 1
    }
  }
  return c
}

// ---------------------------------------------------------------- backdrop

export const RIDGE_CELLS = 16
/** A tileable strip of ridge seen from inside the cave: width `w`, height `h`, the crest `fromTop` or from the bottom. */
export function ridgeStrip(w: number, h: number, body: string, rim: string, salt: number, fromTop: boolean): C {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  const cell = w / RIDGE_CELLS
  let prev = -1
  for (let x = 0; x < w; x++) {
    const n = pnoise(x, cell, RIDGE_CELLS, salt) * 0.7 + pnoise(x, cell / 4, RIDGE_CELLS * 4, salt + 5) * 0.3
    const d = Math.round(h * (0.25 + n * 0.75))
    if (fromTop) {
      r(g, body, x, 0, 1, d)
      r(g, rim, x, d - 1)
      if (prev >= 0 && Math.abs(d - prev) > 1) r(g, rim, x, Math.min(d, prev) - 1, 1, Math.abs(d - prev))
    } else {
      r(g, body, x, h - d, 1, d)
      r(g, rim, x, h - d)
      if (prev >= 0 && Math.abs(d - prev) > 1) r(g, rim, x, h - Math.max(d, prev), 1, Math.abs(d - prev))
    }
    prev = d
  }
  return c
}

/**
 * The far cave: dark at the walls, warm dusk light through the middle
 * (the cave mouth far ahead), painted in dithered bands, symmetric so it
 * reads the same turned for portrait flight.
 */
export function caveBack(w: number, h: number): C {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  const stops = ['#0b0616', '#140b26', '#1c1030', '#2a1a4c', '#43246e', '#6a2a7c', '#43246e', '#2a1a4c', '#1c1030', '#140b26', '#0b0616']
  const n = stops.length - 1
  for (let y = 0; y < h; y++) {
    const t = (y / Math.max(1, h - 1)) * n
    const i = Math.min(n - 1, Math.floor(t))
    const f = t - i
    const d = (f - 0.5) * 3 + 0.5
    r(g, stops[i]!, 0, y, w, 1)
    if (d > 1 / 17) {
      g.fillStyle = stops[i + 1]!
      if (d >= 16 / 17) g.fillRect(0, y, w, 1)
      else for (let x = 0; x < w; x++) if (bayer(x, y) < d) g.fillRect(x, y, 1, 1)
    }
  }
  return c
}

// ---------------------------------------------------------------- sprites

/** The Hangar ship side on, facing right. 'c' hull, 'C' hull shade, 'w' hull light, 'T' trim, 'e' cockpit. */
const DART = [
  '...XX..........',
  '...XXXX........',
  '..TXXXXXX......',
  '.XXXXXXXXXwe...',
  'XXXXXXXXXXXXXXX',
  '.XXXXXXXXXXX...',
  '..TXXXXXX......',
  '...XXXX........',
  '...XX..........',
]
const VANDAL = [
  '..XXX...........',
  '..XXXXX.........',
  '.TTXXXXXX.......',
  '..XXXXXXXXXwe...',
  'XXXXXXXXXXXXXXXX',
  '..XXXXXXXXXXXX..',
  '.TTXXXXXXTT.....',
  '..XXXXX..TT.....',
  '..XXX...........',
]
export const SHIP_ROWS = { dart: shade(DART, 'c', 'w', 'C'), vandal: shade(VANDAL, 'c', 'w', 'C') }

/** The Force pod: a trim-coloured orb with a white core. 'T' trim, 'U' trim shade. */
export const POD = shade([
  '..XXX..',
  '.XXXXX.',
  'XXXwXXX',
  'XXwwwXX',
  'XXXwXXX',
  '.XXXXX.',
  '..XXX..',
], 'T', 'w', 'U')

export const ENEMY_SHOT = [
  '.kkk.',
  'kooOk',
  'kowok',
  'kOOOk',
  '.kkk.',
]

/** Drone: an orange diamond with a lit core. */
export const DRONE = [
  shade([
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '.XXXwXXX.',
    'XXXwewXXX',
    '.XXXwXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
  ], 'o', 'y', 'r'),
  shade([
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '.XXXeXXX.',
    'XXXewXXXX',
    '.XXXeXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
  ], 'o', 'y', 'r'),
]

/** Gunship: a slow armoured hull facing left, barrel forward. */
export const GUNSHIP = shade([
  '....XXXXXXXXXXXX..',
  '...XXXXXXXXXXXXXX.',
  '..XXXeeXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXXXX',
  '..XXXXXXXXXXXXXXXX',
  '...XXXXXXXXXXXXXX.',
  '....XXXXXXXXXXXX..',
], 'o', 'y', 'R')

const FRAMES = 12
function frameSet(n: number, size: number, paint: (g: G, a: number) => void): string[][] {
  const out: string[][] = []
  for (let i = 0; i < n; i++) out.push(pixelize(g => paint(g, i / n), size, size, ['o', 'y', 'r', 'R', 'e', 'w', 'Y', 'P', 'p']))
  return out
}

function tri(g: G, s: number, a: number) {
  g.beginPath()
  for (let i = 0; i < 3; i++) {
    const t = a + (Math.PI * 2 / 3) * i
    if (i === 0) g.moveTo(Math.cos(t) * s, Math.sin(t) * s)
    else g.lineTo(Math.cos(t) * s, Math.sin(t) * s)
  }
  g.closePath()
}

let weaverFrames: string[][] | null = null
/** Weaver: two counter-turning triangles; `t` 0–1 over a third of a turn. */
export function weaverFrame(t: number): string[] {
  if (!weaverFrames) weaverFrames = frameSet(FRAMES, 11, (g, f) => {
    const a = f * (Math.PI * 2 / 3)
    g.lineWidth = 1.6
    g.strokeStyle = '#ff8a3d'
    tri(g, 4.8, a); g.stroke()
    g.strokeStyle = '#ffd23f'
    tri(g, 4.8, -a); g.stroke()
    g.fillStyle = '#fff1b0'
    g.fillRect(-0.5, -0.5, 1.5, 1.5)
  })
  return weaverFrames[((Math.floor(t * FRAMES) % FRAMES) + FRAMES) % FRAMES]!
}

let hexFrames: string[][] | null = null
/** Hex: a turning armoured hexagon with a white ring core; `t` 0–1 over a sixth of a turn. */
export function hexFrame(t: number): string[] {
  if (!hexFrames) hexFrames = frameSet(6, 15, (g, f) => {
    const a = Math.PI / 6 + f * (Math.PI / 3)
    const hexPath = (rad: number) => {
      g.beginPath()
      for (let i = 0; i < 6; i++) {
        const t2 = a + (Math.PI / 3) * i
        if (i === 0) g.moveTo(Math.cos(t2) * rad, Math.sin(t2) * rad)
        else g.lineTo(Math.cos(t2) * rad, Math.sin(t2) * rad)
      }
      g.closePath()
    }
    hexPath(6.4); g.fillStyle = '#9e1638'; g.fill()
    hexPath(5.2); g.fillStyle = '#ff8a3d'; g.fill()
    hexPath(3.6); g.fillStyle = '#9e1638'; g.fill()
    g.fillStyle = '#fff4ff'
    g.beginPath(); g.arc(0, 0, 1.6, 0, Math.PI * 2); g.fill()
  })
  return hexFrames[((Math.floor(t * 6) % 6) + 6) % 6]!
}

/** The pickup crate (gold, the letter goes on the HUD layer so it stays upright). */
export const CRATE = [
  'kkkkkkkkkkk',
  'kyyyyyyyyyk',
  'kyKKKKKKKYk',
  'kyKKKKKKKYk',
  'kyKKKKKKKYk',
  'kyKKKKKKKYk',
  'kyKKKKKKKYk',
  'kyKKKKKKKYk',
  'kyKKKKKKKYk',
  'kyYYYYYYYYk',
  'kkkkkkkkkkk',
]

/** A crystal growing from the rock, pointing `up` (floor) or down (ceiling). 'x' body, 'X' light. */
const CRYSTAL = [
  '..w..',
  '.wX..',
  '.XXx.',
  'XXXxx',
  'XXxxx',
  '.Xxx.',
]
export const CRYSTAL_UP = CRYSTAL
export const CRYSTAL_DOWN = [...CRYSTAL].reverse()

// ---------------------------------------------------------------- drawing helpers

/** A pixel ring (midpoint circle). */
export function ring(g: G, cx: number, cy: number, rad: number, color: string) {
  cx = Math.round(cx); cy = Math.round(cy); rad = Math.round(rad)
  if (rad <= 0) return
  g.fillStyle = color
  let x = rad
  let y = 0
  let err = 1 - rad
  while (x >= y) {
    g.fillRect(cx + x, cy + y, 1, 1); g.fillRect(cx - x, cy + y, 1, 1)
    g.fillRect(cx + x, cy - y, 1, 1); g.fillRect(cx - x, cy - y, 1, 1)
    g.fillRect(cx + y, cy + x, 1, 1); g.fillRect(cx - y, cy + x, 1, 1)
    g.fillRect(cx + y, cy - x, 1, 1); g.fillRect(cx - y, cy - x, 1, 1)
    y++
    if (err < 0) err += 2 * y + 1
    else { x--; err += 2 * (y - x) + 1 }
  }
}

/** A pixel line (Bresenham), `w` pixels square per step. */
export function line(g: G, x0: number, y0: number, x1: number, y1: number, color: string, w = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  const o = Math.floor(w / 2)
  g.fillStyle = color
  for (let n = 0; n < 400; n++) {
    g.fillRect(x0 - o, y0 - o, w, w)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}
