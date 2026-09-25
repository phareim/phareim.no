// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * What every painted place shares: the per-frame context the music feeds
 * (beat, intensity, mood, chord-root accent, fresh notes), the place
 * contract, a light map per place (so two places can be lit apart and then
 * dissolved), ordered-dither fills, and a tiny seeded random.
 *
 * All sizes are logical pixels (one pixel of the small buffer the stage
 * scales up). Nothing here allocates per frame beyond pooled light objects.
 */
import type { Layer } from '../../engine/types.ts'
import { makeCanvas, glowSprite, type Light } from '../pixel/stage.ts'

export type G = CanvasRenderingContext2D

/** A note that started since the last frame, on a layer the scenes care about. */
export interface NoteHit {
  layer: Layer
  midi: number
  /** Pitch as height, 0 low .. 1 high (MIDI 48..96). */
  h: number
}

export interface FrameCtx {
  /** Scene clock in seconds (monotonic, runs when the music is paused too). */
  t: number
  /** Seconds since the last frame, clamped to 0..0.1. */
  dt: number
  /** 1 on a kick, decaying over about a beat. */
  beat: number
  /** Smoothed 0..4. */
  intensity: number
  /** intensity / 4. */
  energy: number
  /** Smoothed mood darkness 0 (lydian) .. 1 (phrygian / harmonic minor). */
  dark: number
  /** The chord root as a neon colour (#rrggbb), glided. */
  accent: string
  /** Notes that began since the last frame (arp, bells, lead, counter only). */
  notes: NoteHit[]
  /** Current audible level per layer, 0..1. */
  levels: Record<Layer, number>
}

export interface Lights {
  light(x: number, y: number, r: number, color: string, a?: number): void
  /** A rectangle kept at full brightness through the light map. */
  emit(x: number, y: number, w: number, h: number): void
  /** Every opaque pixel of a static image kept at full brightness. */
  emitImage(img: HTMLCanvasElement, x?: number, y?: number): void
  /** The lights added so far this frame (to mirror them in water). */
  readonly list: readonly Light[]
}

export interface Place {
  /** Build the static layers for this logical size. Called on first use and on resize. */
  layout(w: number, h: number): void
  /** Paint one frame into `g` (w×h, already cleared or not: paint every pixel). */
  draw(g: G, c: FrameCtx, L: Lights): void
  /** Light-map base colour for this frame. */
  ambient(c: FrameCtx): string
  /** Bloom strength, default 1. */
  bloom?: number
  /** Rows 0..horizon count as sky for the dissolve's lead. */
  horizon(): number
}

// ---- light map per place ---------------------------------------------------

export interface Lighter extends Lights {
  reset(): void
  /** Multiply `g` (w×h) by ambient + the collected lights; emits stay at full brightness. */
  apply(g: G, w: number, h: number, ambient: string): void
}

export function createLighter(): Lighter {
  let c = makeCanvas(1, 1)
  let lg = c.getContext('2d')!
  const list: Light[] = []
  const pool: Light[] = []
  const emits: number[] = []
  const imgs: { img: HTMLCanvasElement; x: number; y: number }[] = []
  const masks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

  function maskOf(img: HTMLCanvasElement): HTMLCanvasElement {
    let m = masks.get(img)
    if (!m) {
      m = makeCanvas(img.width, img.height)
      const mg = m.getContext('2d')!
      mg.drawImage(img, 0, 0)
      mg.globalCompositeOperation = 'source-in'
      mg.fillStyle = '#ffffff'
      mg.fillRect(0, 0, m.width, m.height)
      masks.set(img, m)
    }
    return m
  }

  return {
    list,
    reset() { list.length = 0; emits.length = 0; imgs.length = 0 },
    light(x, y, r, color, a = 1) {
      if (a <= 0.004 || r < 1) return
      let L = pool[list.length]
      if (!L) { L = { x, y, r, color, a }; pool.push(L) } else { L.x = x; L.y = y; L.r = r; L.color = color; L.a = a }
      list.push(L)
    },
    emit(x, y, w, h) { emits.push(x, y, w, h) },
    emitImage(img, x = 0, y = 0) { imgs.push({ img, x, y }) },
    apply(g, w, h, ambient) {
      if (c.width !== w || c.height !== h) { c = makeCanvas(w, h); lg = c.getContext('2d')! }
      lg.globalCompositeOperation = 'source-over'
      lg.globalAlpha = 1
      lg.fillStyle = ambient
      lg.fillRect(0, 0, w, h)
      lg.globalCompositeOperation = 'lighter'
      for (const L of list) {
        if (L.x < -L.r || L.y < -L.r || L.x > w + L.r || L.y > h + L.r) continue
        lg.globalAlpha = Math.max(0, Math.min(1, L.a))
        lg.drawImage(glowSprite(L.color), L.x - L.r, L.y - L.r, L.r * 2, L.r * 2)
      }
      lg.globalAlpha = 1
      lg.globalCompositeOperation = 'source-over'
      lg.fillStyle = '#ffffff'
      for (let i = 0; i < emits.length; i += 4) lg.fillRect(emits[i]!, emits[i + 1]!, emits[i + 2]!, emits[i + 3]!)
      for (const e of imgs) lg.drawImage(maskOf(e.img), e.x, e.y)
      g.globalCompositeOperation = 'multiply'
      g.drawImage(c, 0, 0)
      g.globalCompositeOperation = 'source-over'
    },
  }
}

// ---- ordered dither ----------------------------------------------------------

const B8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
]

/** 8×8 Bayer threshold, 0..1. */
export function bayer8(x: number, y: number): number {
  return (B8[(y & 7) * 8 + (x & 7)]! + 0.5) / 64
}

const patCache = new Map<string, CanvasPattern>()
let patCtx: G | null = null

/**
 * A repeating 8×8 pattern with `level` (0..64) of its pixels in `color`,
 * the rest transparent. Anchored to the canvas origin, so moving fog keeps
 * a still dither grid, the way hardware dithering looks.
 */
export function ditherPattern(color: string, level: number): CanvasPattern | null {
  const L = Math.max(0, Math.min(64, Math.round(level)))
  if (L === 0) return null
  const key = color + '|' + L
  let p = patCache.get(key)
  if (p) return p
  const tile = makeCanvas(8, 8)
  const tg = tile.getContext('2d')!
  tg.fillStyle = color
  for (let i = 0; i < 64; i++) if (B8[i]! < L) tg.fillRect(i & 7, i >> 3, 1, 1)
  if (!patCtx) patCtx = makeCanvas(1, 1).getContext('2d')!
  p = patCtx.createPattern(tile, 'repeat')!
  patCache.set(key, p)
  return p
}

/** Fill a rectangle with `color` at `alpha` (0..1) as an ordered dither. */
export function ditherRect(g: G, color: string, alpha: number, x: number, y: number, w: number, h: number) {
  const p = ditherPattern(color, alpha * 64)
  if (!p) return
  g.fillStyle = p
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

// ---- small helpers -------------------------------------------------------------

/** Mulberry32: a seeded random in 0..1. */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Positive modulo (for wrapping drift). */
export function wrap(v: number, m: number): number {
  return ((v % m) + m) % m
}

/** A static layer the size of the place, painted once by `paint`. */
export function layer(w: number, h: number, paint: (g: G) => void): HTMLCanvasElement {
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  paint(g)
  return c
}

/** Sparkles: short-lived cross twinkles (notes in the sky, glints on water). */
export interface Spark { x: number; y: number; age: number; life: number; color: string; big: boolean }

export function spawnSpark(list: Spark[], x: number, y: number, color: string, big = false, life = 1.6, max = 40) {
  if (list.length >= max) list.shift()
  list.push({ x: Math.round(x), y: Math.round(y), age: 0, life, color, big })
}

/** Age and draw sparkles; each lights a little pool. Twinkle rises, holds, fades. */
export function drawSparks(g: G, list: Spark[], dt: number, L: Lights, glow = 0.35) {
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i]!
    s.age += dt
    if (s.age >= s.life) { list.splice(i, 1); continue }
    const k = s.age / s.life
    const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85
    g.fillStyle = s.color
    g.fillRect(s.x, s.y, 1, 1)
    if (a > 0.45) {
      g.fillRect(s.x - 1, s.y, 3, 1)
      g.fillRect(s.x, s.y - 1, 1, 3)
      if (s.big && a > 0.75) { g.fillRect(s.x - 2, s.y, 5, 1); g.fillRect(s.x, s.y - 2, 1, 5) }
    }
    L.emit(s.x - 1, s.y - 1, 3, 3)
    L.light(s.x + 0.5, s.y + 0.5, s.big ? 10 : 7, s.color, glow * a)
  }
}

/** Mirror this frame's lights above `from` about the water line (`to` = where row `from` lands). */
export function mirrorLights(L: Lights, from: number, to: number, squash: number, k: number, maxY: number) {
  const n = L.list.length
  for (let i = 0; i < n; i++) {
    const l = L.list[i]!
    if (l.y > from) continue
    const my = to + (from - l.y) / squash
    if (my < maxY + l.r) L.light(l.x, my, l.r * 0.75, l.color, l.a * k)
  }
}

/** Is this a melodic layer a scene should answer? */
export function melodic(l: Layer): boolean {
  return l === 'arp' || l === 'bells' || l === 'lead' || l === 'counter'
}

/** Smooth 2-D value noise in 0..1 with cell size `c` (layout-time painting). */
export function vnoise(x: number, y: number, c: number, salt = 0): number {
  const gx = Math.floor(x / c)
  const gy = Math.floor(y / c)
  const fx = x / c - gx
  const fy = y / c - gy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const h = (i: number, j: number) => {
    let v = (i * 374761393 + j * 668265263 + salt * 2246822519) | 0
    v = Math.imul(v ^ (v >>> 13), 1274126177)
    v ^= v >>> 16
    return (v >>> 0) / 4294967296
  }
  const a = h(gx, gy)
  const b = h(gx + 1, gy)
  const cc = h(gx, gy + 1)
  const d = h(gx + 1, gy + 1)
  return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy
}

/** Fractal value noise, 0..1. */
export function fbm(x: number, y: number, c: number, salt = 0, octaves = 4): number {
  let sum = 0
  let amp = 0.5
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += vnoise(x, y, c, salt + o * 17) * amp
    norm += amp
    amp *= 0.5
    c *= 0.5
  }
  return sum / norm
}
