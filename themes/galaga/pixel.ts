/**
 * Galaga in Neon Shrine's pixel look (2026-09-24). Everything here is in
 * the stage's logical pixels; `Galaga.vue` keeps the rules in CSS px.
 *
 * Ships, enemies, the Cantor, the relay station and the drifting rocks are
 * the vector painters in `sprites.ts`, pixelized at the stage's pixel size
 * (`pixelize()`: snapped to Neon Shrine's palette, outlined, lit from the
 * top), so each keeps its silhouette at any screen size. Kinds that turn
 * along their path are pixelized at 16 headings. The deep field — sky,
 * nebulae, the ringed planet — is painted with ordered dithering.
 */
import { makeCanvas } from '../base/pixel/stage'
import { bayer, mix, pixelize, relight, silhouette, sprite } from '../base/pixel/sprites'
import { hash2 } from '../base/pixel/scenery'
import type { EnemyKind } from './balance'
import { ENEMY_SIZE, PAINTERS, TURNING_KINDS, paintBoss, paintShip, type ShipLook } from './sprites'

type G = CanvasRenderingContext2D
type C = HTMLCanvasElement

/** Dark hull fills lift to violet-grey so they read on space. */
const HULL_LIFT = { K: 'u' }
const DIRS = 16

export interface GalagaArt {
  readonly k: number
  enemy(kind: EnemyKind, size: number, frame: number, heading: number, flash: boolean): C
  ship(look: ShipLook, bank: number, small?: boolean): C
  boss(size: number, flash: boolean): C
  station(size: number): C
  capsule: C
}

/** All the pixel art for one pixel size (CSS px per logical px). */
export function createGalagaArt(k: number): GalagaArt {
  const cache = new Map<string, C>()
  const maps = new Map<string, string[]>()
  const get = (key: string, build: () => string[], flash: boolean): C => {
    let rows = maps.get(key)
    if (!rows) { rows = build(); maps.set(key, rows) }
    if (!flash) return sprite(rows)
    let c = cache.get(key)
    if (!c) { c = silhouette(rows, '#ffffff'); cache.set(key, c) }
    return c
  }

  function enemy(kind: EnemyKind, size: number, frame: number, heading: number, flash: boolean): C {
    const s = size / k
    const turning = TURNING_KINDS.has(kind)
    const dir = turning ? (((Math.round((heading - Math.PI / 2) / (Math.PI * 2 / DIRS)) % DIRS) + DIRS) % DIRS) : 0
    const key = `${kind}|${Math.round(size)}|${frame}|${dir}`
    return get(key, () => {
      const paint = PAINTERS[kind] ?? PAINTERS.scout
      if (!turning) return relight(pixelize(g => paint(g, s, frame), s * 1.1, s * 1.15), HULL_LIFT)
      const side = Math.max(s * 1.1, s * 1.15) * 1.1
      return relight(pixelize(g => { g.rotate(dir * Math.PI * 2 / DIRS); paint(g, s, frame) }, side, side), HULL_LIFT)
    }, flash)
  }

  function ship(look: ShipLook, bank: number, small = false): C {
    const f = small ? 0.55 : 1
    const key = `ship|${look.variant}|${look.colors.hull}|${look.colors.trim}|${look.colors.cockpit}|${bank}|${small}`
    return get(key, () => relight(pixelize(g => { g.scale(f / k, f / k); paintShip(look, bank)(g) }, (56 * f) / k, (38 * f) / k), HULL_LIFT), false)
  }

  function boss(size: number, flash: boolean): C {
    const s = Math.round(size / k)
    return get(`boss|${s}`, () => relight(pixelize(paintBoss(s, '#ff2fa0'), s * 1.16, s), HULL_LIFT), flash)
  }

  function station(size: number): C {
    const s = Math.round(size / k)
    return get(`station|${s}`, () => relight(pixelize(g => paintStation(g, s), s * 1.1, s * 1.1)), false)
  }

  const capsule = sprite(relight(pixelize(g => {
    const r = 12 / k
    g.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = Math.PI / 3 * i
      i ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    g.closePath()
    g.fillStyle = '#5b2a1c'
    g.fill()
    g.lineWidth = 1.2
    g.strokeStyle = '#ffd23f'
    g.stroke()
  }, 26 / k, 26 / k)))

  return { k, enemy, ship, boss, station, capsule }
}

/** Relay station Kestrel: a hull wedge, a mast with a dish, running lights. */
function paintStation(g: G, s: number) {
  g.fillStyle = '#2a1f4a'
  g.beginPath()
  g.moveTo(-s / 2, 0)
  g.lineTo(s / 2, -s * 0.18)
  g.lineTo(s * 0.3, s * 0.2)
  g.lineTo(-s * 0.3, s * 0.2)
  g.closePath()
  g.fill()
  g.strokeStyle = '#9a4ff0'
  g.lineWidth = 1
  g.stroke()
  g.fillStyle = '#54259e'
  g.fillRect(-s * 0.3, s * 0.05, s * 0.6, s * 0.06)
  g.strokeStyle = '#8f86b8'
  g.beginPath()
  g.moveTo(s * 0.1, -s * 0.1)
  g.lineTo(s * 0.1, -s * 0.42)
  g.stroke()
  g.beginPath()
  g.arc(s * 0.1, -s * 0.42, s * 0.09, Math.PI * 0.1, Math.PI * 0.9)
  g.stroke()
}

// ---------------------------------------------------------------- rocks

export interface RockShape {
  size: number
  rotation: number
  depth: number
  pix?: C
  pixK?: number
}

/**
 * A drifting rock: a lumpy disc lit from the upper left in dithered dark
 * violets, a few craters, a magenta rim on the lit edge (the terrain's rim
 * light). Painted once per shape and pixel size; deeper rocks are darker.
 */
export function rockSprite(shape: RockShape, k: number): C {
  if (shape.pix && shape.pixK === k) return shape.pix
  const R = Math.max(5, Math.round(shape.size / k / 3))
  const salt = Math.floor(shape.rotation * 1000)
  const P = pixels(R * 2 + 3, R * 2 + 3)
  const cx = R + 1
  const cy = R + 1
  const ramp = (shape.depth > 0.6 ? ['#0e0820', '#170d2c', '#221340', '#2f1a56', '#3d2470'] : ['#0b0616', '#120a24', '#1a0f32', '#241646', '#2f1d58']).map(word)
  const rimCol = word(shape.depth > 0.6 ? '#b01874' : '#6a2a7c')
  const craters: { x: number; y: number; r: number }[] = []
  for (let i = 0; i < 3 + Math.floor(hash2(salt, 1, 3) * 3); i++) {
    craters.push({ x: (hash2(salt, i, 4) - 0.5) * R * 1.1, y: (hash2(salt, i, 5) - 0.5) * R * 1.1, r: Math.max(1, R * (0.12 + hash2(salt, i, 6) * 0.14)) })
  }
  const radius = (a: number) => R * (0.8 + 0.2 * smooth(((a + Math.PI) / (Math.PI * 2)) * 12, 0, 2, salt))
  const inside = (x: number, y: number) => Math.hypot(x, y) <= radius(Math.atan2(y, x))
  for (let y = -R - 1; y <= R + 1; y++) for (let x = -R - 1; x <= R + 1; x++) {
    if (!inside(x, y)) continue
    const d = Math.hypot(x, y) / R
    const z = Math.sqrt(Math.max(0, 1 - d * d))
    let v = Math.max(0, -0.5 * (x / R) - 0.55 * (y / R) + 0.65 * z)
    for (const c of craters) {
      const dd = Math.hypot(x - c.x, y - c.y)
      if (dd < c.r) v = dd < c.r - 1 ? v * 0.45 : (x - c.x) + (y - c.y) > 0 ? v + 0.25 : v * 0.6
    }
    const f = Math.min(0.999, v) * (ramp.length - 1)
    const i = Math.floor(f)
    let col = f - i > bayer(x + R, y + R) ? ramp[Math.min(ramp.length - 1, i + 1)]! : ramp[i]!
    // Rim: lit-side edge pixels.
    if (!inside(x - 1, y - 1) && x + y < 0) col = rimCol
    P.u32[(y + cy) * P.w + (x + cx)] = col
  }
  shape.pix = P.done()
  shape.pixK = k
  return shape.pix
}

// ---------------------------------------------------------------- deep field

function hexOf(rgb: string): string {
  const [r, g, b] = rgb.split(',').map(v => Math.max(0, Math.min(255, parseInt(v, 10) || 0)))
  return '#' + ((1 << 24) | (r! << 16) | (g! << 8) | b!).toString(16).slice(1)
}

function smooth(x: number, y: number, c: number, salt: number): number {
  const gx = Math.floor(x / c)
  const gy = Math.floor(y / c)
  const fx = x / c - gx
  const fy = y / c - gy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hash2(gx, gy, salt)
  const b = hash2(gx + 1, gy, salt)
  const d = hash2(gx, gy + 1, salt)
  const e = hash2(gx + 1, gy + 1, salt)
  return a + (b - a) * sx + (d - a) * sy + (a - b - d + e) * sx * sy
}

/** A logical-size canvas with a 32-bit pixel buffer to paint into. */
function pixels(w: number, h: number) {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  const img = g.createImageData(c.width, c.height)
  const u32 = new Uint32Array(img.data.buffer)
  return { c, w: c.width, h: c.height, u32, done: () => { g.putImageData(img, 0, 0); return c } }
}

/** #rrggbb → an opaque pixel word (ImageData is RGBA in memory, little-endian). */
function word(hex: string): number {
  const v = parseInt(hex.slice(1, 7), 16)
  return (0xff000000 | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255)) >>> 0
}

/**
 * A nebula cloud `r` logical px in radius: three dithered tones of the
 * sector tint ("r,g,b") over the night sky, frayed by noise. Dim on purpose.
 */
export function paintNebula(tint: string, r: number, salt: number, strength = 1): C {
  r = Math.max(4, Math.round(r))
  const P = pixels(r * 2, r * 2)
  const col = hexOf(tint)
  const t1 = word(mix('#140b26', col, 0.22 * strength))
  const t2 = word(mix('#140b26', col, 0.4 * strength))
  const t3 = word(mix('#1c1030', col, 0.58 * strength))
  for (let y = 0; y < P.h; y++) for (let x = 0; x < P.w; x++) {
    const d = Math.hypot(x - r, y - r) / r
    if (d >= 1) continue
    const n = smooth(x, y, Math.max(4, r / 3), salt) * 0.65 + smooth(x, y, Math.max(2, r / 8), salt + 9) * 0.35
    const v = Math.pow(1 - d, 1.3) * (0.35 + n * 0.9)
    const th = bayer(x, y)
    const tone = v > 0.62 + th * 0.18 ? t3 : v > 0.38 + th * 0.2 ? t2 : v > 0.14 + th * 0.2 ? t1 : 0
    if (tone) P.u32[y * P.w + x] = tone
  }
  return P.done()
}

/**
 * The ringed planet: a dithered sphere lit from the upper left, banded like
 * the striped sun, a pink rim on the lit edge and a thin ring whose back
 * half hides behind the globe. Returned canvas is centred on the planet.
 */
export function paintPlanet(r: number, tilt: number): C {
  r = Math.max(6, Math.round(r))
  const P = pixels(Math.ceil(r * 3.2), Math.ceil(r * 2.4))
  const cx = P.w / 2
  const cy = P.h / 2
  const ramp = ['#0e0820', '#170d2c', '#221340', '#2f1a56', '#43246e'].map(word)
  const rimHi = word('#ff70bc')
  const rim = word('#b01874')
  const put = (x: number, y: number, w: number) => {
    x = Math.round(x); y = Math.round(y)
    if (x >= 0 && y >= 0 && x < P.w && y < P.h) P.u32[y * P.w + x] = w
  }
  const ringAt = (front: boolean) => {
    const col = word(front ? '#b01874' : '#54259e')
    const a = r * 1.5
    const b = r * 0.32
    const steps = Math.ceil(a * 8)
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2
      if ((Math.sin(t) > 0) !== front) continue
      const ex = Math.cos(t) * a
      const ey = Math.sin(t) * b
      put(cx + ex * Math.cos(tilt) - ey * Math.sin(tilt), cy + ex * Math.sin(tilt) + ey * Math.cos(tilt), col)
    }
  }
  ringAt(false)
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d2 = (x * x + y * y) / (r * r)
    if (d2 > 1) continue
    const z = Math.sqrt(1 - d2)
    const lx = x / r
    const ly = y / r
    const lambert = Math.max(0, -0.55 * lx - 0.6 * ly + 0.58 * z)
    const band = Math.floor((ly * r + Math.sin(lx * 3) * 1.5) / Math.max(2, r / 5)) % 2 === 0 ? 0.12 : 0
    const v = Math.min(0.999, lambert * 0.95 + band)
    const f = v * (ramp.length - 1)
    const i = Math.floor(f)
    let col = f - i > bayer(x + r, y + r) ? ramp[Math.min(ramp.length - 1, i + 1)]! : ramp[i]!
    // Rim light on the sun side.
    if (d2 > 0.82 && lx + ly < -0.5) col = d2 > 0.93 ? rimHi : rim
    put(cx + x, cy + y, col)
  }
  ringAt(true)
  return P.done()
}

/** The night behind everything: a dithered violet gradient, painted once per size. */
export function paintSpace(w: number, h: number): C {
  const P = pixels(w, h)
  const stops = ['#0b0616', '#0e0820', '#120a26', '#140b2a'].map(word)
  const n = stops.length - 1
  for (let y = 0; y < P.h; y++) {
    const t = (y / Math.max(1, P.h - 1)) * n
    const i = Math.min(n - 1, Math.floor(t))
    const f = Math.min(1, (t - i - 0.5) * 3 + 0.5)
    for (let x = 0; x < P.w; x++) P.u32[y * P.w + x] = f > 0 && bayer(x, y) < f ? stops[i + 1]! : stops[i]!
  }
  return P.done()
}

// ---------------------------------------------------------------- shapes

/** A pixel ring (midpoint circle). */
export function ring(g: G, cx: number, cy: number, r: number, color: string) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r)
  if (r <= 0) return
  g.fillStyle = color
  let x = r
  let y = 0
  let err = 1 - r
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

/** The upper half of an ellipse, one pixel thick (the nose shield). */
export function arcTop(g: G, cx: number, cy: number, a: number, b: number, color: string) {
  g.fillStyle = color
  cx = Math.round(cx); cy = Math.round(cy)
  let prev = -1
  for (let x = -a; x <= a; x++) {
    const y = Math.round(b * Math.sqrt(Math.max(0, 1 - (x * x) / (a * a))))
    const top = cy - y
    g.fillRect(cx + x, top, 1, prev < 0 ? 1 : Math.max(1, Math.abs(top - prev)))
    prev = top
  }
}

/** A filled pixel disc. */
export function dot(g: G, cx: number, cy: number, r: number, color: string) {
  g.fillStyle = color
  cx = Math.round(cx); cy = Math.round(cy)
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + r * 0.6))
    g.fillRect(cx - half, cy + y, half * 2 + 1, 1)
  }
}

export { ENEMY_SIZE }
