/**
 * Pixel sprites for the pixel stage: string maps in Neon Shrine's palette.
 *
 * A sprite is an array of equal-length strings, one char per pixel; '.' is
 * transparent and every other char is a key of the palette (Neon Shrine's
 * `PAL`, copied here so the games do not pull in the whole Zelda sheet).
 * Canvases are built once per rows array and cached.
 */
import { makeCanvas } from './stage'
import { glyphRows as glyphRowsLocal } from '../../zelda/render/font'

export { drawText, textWidth, wrapText, GLYPH_H, glyphRows } from '../../zelda/render/font'

export const PAL: Record<string, string> = {
  k: '#0b0616', // outline
  K: '#1c1030', // dark shade
  w: '#fff4ff',
  W: '#cfc6ff', // pale lavender
  g: '#8f86b8',
  G: '#5a5285',
  c: '#2ff3ff', // cyan
  C: '#1a9fc4',
  b: '#2f5fd0',
  B: '#1a2f78',
  p: '#ff2fa0', // pink
  P: '#b01874',
  m: '#ff8ae0',
  v: '#9a4ff0', // violet
  V: '#54259e',
  y: '#ffd23f', // gold
  Y: '#c4861c',
  o: '#ff8a3d',
  r: '#ff3b5c',
  R: '#9e1638',
  s: '#f5c3a8', // skin
  S: '#c98576',
  h: '#3a1a4a',
  H: '#7a3a8a',
  n: '#6a4432',
  N: '#3a2418',
  l: '#b6ff4a', // lime
  L: '#4f9a2a',
  t: '#3fd8b0', // teal
  T: '#1f7a6e',
  u: '#2a1f4a', // deep violet-grey
  e: '#fff1b0', // pale gold
  a: '#5b2a1c',
  i: '#b0543a',
  j: '#e07a4e',
}

type Rows = readonly string[]
const cache = new WeakMap<Rows, Map<string, HTMLCanvasElement>>()

function cached(rows: Rows, key: string, build: () => HTMLCanvasElement): HTMLCanvasElement {
  let m = cache.get(rows)
  if (!m) { m = new Map(); cache.set(rows, m) }
  let c = m.get(key)
  if (!c) { c = build(); m.set(key, c) }
  return c
}

/**
 * The sprite as a canvas. `pal` overrides palette keys (e.g. a Hangar hull
 * colour for 'c'); `flip` mirrors it horizontally.
 */
export function sprite(rows: Rows, pal?: Record<string, string>, flip = false): HTMLCanvasElement {
  const key = (pal ? JSON.stringify(pal) : '') + (flip ? '|f' : '')
  return cached(rows, key, () => {
    const h = rows.length
    const w = rows[0]!.length
    const c = makeCanvas(w, h)
    const g = c.getContext('2d')!
    for (let y = 0; y < h; y++) {
      const row = rows[y]!
      for (let x = 0; x < w; x++) {
        const ch = row[x]!
        if (ch === '.' || ch === ' ') continue
        const col = pal?.[ch] ?? PAL[ch]
        if (!col) continue
        g.fillStyle = col
        g.fillRect(flip ? w - 1 - x : x, y, 1, 1)
      }
    }
    return c
  })
}

/** Every opaque pixel in one colour (hit flashes, silhouettes, shadows). */
export function silhouette(rows: Rows, color: string): HTMLCanvasElement {
  return cached(rows, 'sil:' + color, () => {
    const h = rows.length
    const w = rows[0]!.length
    const c = makeCanvas(w, h)
    const g = c.getContext('2d')!
    g.fillStyle = color
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = rows[y]![x]
      if (ch !== '.' && ch !== ' ') g.fillRect(x, y, 1, 1)
    }
    return c
  })
}

/** Draw a sprite with its top-left at whole logical pixels. */
export function put(g: CanvasRenderingContext2D, c: HTMLCanvasElement, x: number, y: number) {
  g.drawImage(c, Math.round(x), Math.round(y))
}

/** Draw centred on (x, y). */
export function putC(g: CanvasRenderingContext2D, c: HTMLCanvasElement, x: number, y: number) {
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2))
}

/**
 * Wraps a one-colour 'X' map in Neon Shrine shading: an outline ('k') round
 * the shape, `hi` on pixels with open space above, `lo` on pixels with open
 * space below, `body` elsewhere. Returns rows for `sprite()`, two pixels
 * wider and taller than the input.
 */
export function shade(rows: Rows, body: string, hi: string, lo: string, outline = 'k'): string[] {
  const h = rows.length
  const w = rows[0]!.length
  const on = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && rows[y]![x] !== '.' && rows[y]![x] !== ' '
  const out: string[] = []
  for (let y = -1; y <= h; y++) {
    let line = ''
    for (let x = -1; x <= w; x++) {
      if (on(x, y)) {
        const ch = rows[y]![x]!
        if (ch !== 'X') line += ch
        else if (!on(x, y - 1)) line += hi
        else if (!on(x, y + 1)) line += lo
        else line += body
      } else if (on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1)) line += outline
      else line += '.'
    }
    out.push(line)
  }
  return out
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Ordered-dither threshold for a pixel, 0–1. */
export function bayer(x: number, y: number): number {
  return (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16
}

/** Text drawn with each font pixel as an n×n block (titles). */
export function drawBigText(g: CanvasRenderingContext2D, text: string, x: number, y: number, n: number, color: string, shadow?: string) {
  const t = text.toUpperCase()
  const pass = (ox: number, oy: number, fill: string) => {
    g.fillStyle = fill
    let cx = x + ox
    for (const ch of t) {
      const rows = glyphRowsLocal(ch)
      const w = rows[0]!.length
      for (let gy = 0; gy < rows.length; gy++) for (let gx = 0; gx < w; gx++) {
        if (rows[gy]![gx] === '#') g.fillRect(cx + gx * n, y + oy + gy * n, n, n)
      }
      cx += (w + 1) * n
    }
  }
  if (shadow) pass(n, n, shadow)
  pass(0, 0, color)
}

export function bigTextWidth(text: string, n: number): number {
  let w = 0
  for (const ch of text.toUpperCase()) w += (glyphRowsLocal(ch)[0]!.length + 1) * n
  return Math.max(0, w - n)
}

/** Mix two #rrggbb colours, t = 0 → a, 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1, 7), 16)
  const pb = parseInt(b.slice(1, 7), 16)
  const ch = (s: number) => {
    const x = (pa >> s) & 255
    const y = (pb >> s) & 255
    return Math.round(x + (y - x) * t)
  }
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)
}
