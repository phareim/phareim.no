/**
 * The small painting kit the garment generators share: a canvas that
 * remembers which pixels are fabric (patterns only touch fabric, never
 * collars, buttons or soles), letter art for the small pieces, the
 * patterns, and the heart and star emblems.
 *
 * Colours per garment come from its main colour and color2 only, with one
 * shade and one tint each, so a garment has few colours: the drawing
 * board can start from it and the save stays small.
 */
import type { Hex, PatternId, Texture } from '../types'
import { RAINBOW } from '../catalog'
import { mix, shade, tint } from './color'

/**
 * Letter art colours: a main, b its shade, c its tint, k its deep shade,
 * d color2, e its shade, f its tint. '.' is transparent.
 */
export interface Pal { a: Hex; b: Hex; c: Hex; k: Hex; d: Hex; e: Hex; f: Hex }

export function palFor(main: Hex, color2: Hex): Pal {
  return { a: main, b: shade(main), c: tint(main), k: shade(main, 0.42), d: color2, e: shade(color2), f: tint(color2) }
}

export class Paint {
  readonly px: Array<Hex | null>
  /** Fabric pixels: the ones a pattern may recolour. */
  readonly fab: boolean[]
  constructor(readonly w: number, readonly h: number) {
    this.px = new Array<Hex | null>(w * h).fill(null)
    this.fab = new Array<boolean>(w * h).fill(false)
  }

  has(x: number, y: number): boolean { return x >= 0 && x < this.w && y >= 0 && y < this.h }
  get(x: number, y: number): Hex | null { return this.has(x, y) ? this.px[y * this.w + x]! : null }
  isFab(x: number, y: number): boolean { return this.has(x, y) && this.fab[y * this.w + x]! }

  /** A fabric pixel (patterns may recolour it). */
  cloth(x: number, y: number, c: Hex): void {
    if (!this.has(x, y)) return
    this.px[y * this.w + x] = c
    this.fab[y * this.w + x] = true
  }

  /** A detail pixel (collar, button, sole): patterns leave it alone. null clears. */
  detail(x: number, y: number, c: Hex | null): void {
    if (!this.has(x, y)) return
    this.px[y * this.w + x] = c
    this.fab[y * this.w + x] = false
  }

  /** Darken whatever is painted here (keeps it fabric or detail). */
  darken(x: number, y: number, f = 0.22): void {
    const c = this.get(x, y)
    if (c) this.px[y * this.w + x] = shade(c, f)
  }

  /**
   * Stamp letter art at (x0, y0): letters from `pal`, '.' skipped.
   * Letters in `fabric` become fabric, the rest details.
   */
  art(rows: readonly string[], x0: number, y0: number, pal: Pal, fabric = 'a'): void {
    rows.forEach((row, dy) => {
      for (let dx = 0; dx < row.length; dx++) {
        const ch = row[dx]!
        if (ch === '.' || ch === ' ') continue
        const c = (pal as unknown as Record<string, Hex>)[ch]
        if (!c) continue
        if (fabric.includes(ch)) this.cloth(x0 + dx, y0 + dy, c)
        else this.detail(x0 + dx, y0 + dy, c)
      }
    })
  }

  texture(): Texture {
    return { w: this.w, h: this.h, px: this.px.slice() }
  }
}

/** Mirror letter art left-to-right (for the other wing). */
export const mirrorRows = (rows: readonly string[]): string[] => rows.map(r => [...r].reverse().join(''))

// ---------------------------------------------------------------- emblems

/** A heart, 6 × 5, centred on an even-width torso. */
export const HEART = ['XX..XX', 'XXXXXX', 'XXXXXX', '.XXXX.', '..XX..']
/** A star, 6 × 6. */
export const STAR = ['..XX..', '..XX..', 'XXXXXX', '.XXXX.', '.XXXX.', 'XX..XX']

/** Stamp an emblem in `c` onto the fabric at (x0, y0); only where fabric is. */
export function emblem(p: Paint, shape: readonly string[], x0: number, y0: number, c: Hex): void {
  shape.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      if (row[dx] === 'X' && p.isFab(x0 + dx, y0 + dy)) p.cloth(x0 + dx, y0 + dy, c)
    }
  })
}

/** A small plus-shaped star (3 × 3) centred at (x, y), on fabric only. */
export function twinkle(p: Paint, x: number, y: number, c: Hex): void {
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (p.isFab(x + dx, y + dy)) p.cloth(x + dx, y + dy, c)
  }
}

/** A stable pseudo-random 0..1 per cell, so sparkles sit still. */
export function cellNoise(x: number, y: number): number {
  let n = (Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263)) >>> 0
  n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

// ---------------------------------------------------------------- patterns

export interface PatternOpts {
  /** Top-left cell of a centred emblem (heart, star). Without it: small twinkles instead of a star, no heart. */
  emblemAt?: [number, number]
  /** Rows the rainbow spans (inclusive); default the whole canvas. */
  bands?: [number, number]
  /** Rows a stripe falls on: y % every === offset. Default every 3rd row from row 2. */
  stripe?: { every: number; offset: number }
  /** Twinkle centres for the star pattern when there is no emblem (or besides it). */
  twinkles?: Array<[number, number]>
}

/** Recolour the fabric in a pattern. Details (collars, soles) stay. */
export function applyPattern(p: Paint, pattern: PatternId, main: Hex, color2: Hex, o: PatternOpts = {}): void {
  const [b0, b1] = o.bands ?? [0, p.h - 1]
  const stripe = o.stripe ?? { every: 3, offset: 2 }
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (!p.isFab(x, y)) continue
      switch (pattern) {
        case 'stripes':
          if (y % stripe.every === stripe.offset) p.cloth(x, y, color2)
          break
        case 'dots':
          if (y % 3 === 1 && (x + (Math.floor(y / 3) % 2) * 2) % 4 === 1) p.cloth(x, y, color2)
          break
        case 'rainbow': {
          const t = Math.max(0, Math.min(0.999, (y - b0) / (b1 - b0 + 1)))
          p.cloth(x, y, RAINBOW[Math.floor(t * RAINBOW.length)]!)
          break
        }
        case 'check': {
          // Gingham: one-pixel lines every third row and column, crossings in color2.
          const r = y % 3 === 0
          const c = x % 3 === 0
          if (r && c) p.cloth(x, y, color2)
          else if (r || c) p.cloth(x, y, mix(main, color2, 0.5))
          break
        }
        case 'sparkle': {
          const n = cellNoise(x, y)
          if (n < 0.13) p.cloth(x, y, color2)
          else if (n > 0.9) p.cloth(x, y, tint(main, 0.45))
          break
        }
        default:
          break
      }
    }
  }
  if (pattern === 'heart' && o.emblemAt) emblem(p, HEART, o.emblemAt[0], o.emblemAt[1], color2)
  if (pattern === 'star') {
    if (o.emblemAt) emblem(p, STAR, o.emblemAt[0], o.emblemAt[1], color2)
    for (const [x, y] of o.twinkles ?? []) twinkle(p, x, y, color2)
  }
}
