/**
 * The inks of Nova & Rex' Drive to the Mountains and the small colour helpers
 * its canvas code shares. The inks are the ones on the board of Nova's Solo
 * Rescue: cream lettering on a night that is deep blue and never black, a warm
 * gold, a jacket red, one cold teal.
 */
export const CREAM = '#ffe9c4'
export const GOLD = '#ffe45c'
export const ORANGE = '#ff9a2c'
export const RED = '#e2343f'
export const TEAL = '#6cf0e8'
export const DIM = '#8a90b8'
/** The night behind the lettering, and the darkest line on the frame. */
export const NAVY = '#141a3c'
export const INK = '#0a0c1e'

const rgbCache = new Map<string, [number, number, number]>()
export function rgb(hex: string): [number, number, number] {
  let c = rgbCache.get(hex)
  if (!c) {
    const n = parseInt(hex.slice(1), 16)
    c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    rgbCache.set(hex, c)
  }
  return c
}

export function hex(r: number, g: number, b: number): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`
}

export function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a
  if (t >= 1) return b
  const x = rgb(a)
  const y = rgb(b)
  return hex(Math.round(x[0] + (y[0] - x[0]) * t), Math.round(x[1] + (y[1] - x[1]) * t), Math.round(x[2] + (y[2] - x[2]) * t))
}

/**
 * The hour's light on a colour, the way a 16-bit board changed a palette and
 * not a picture: a dark or plain colour is pulled towards the hour's tint, a
 * lit one (a window, a lamp, a tail lamp, a screen) is left as it is. `k` is
 * how far, 0..1.
 */
export interface Shade {
  tint: [number, number, number]
  k: number
  /** Shade the lit colours too (a cloud whose glow has gone out). */
  all?: boolean
}

export function shadeRgb(r: number, g: number, b: number, s: Shade): [number, number, number] {
  if (s.k <= 0) return [r, g, b]
  // Lit things: warm and bright, or the pale blue of a cathode screen.
  const warm = r > 200 && g > 110 && b < 160 && r - b > 80
  const hot = r > 215 && g < 110 && b < 110
  const screen = b > 200 && g > 150 && r > 110 && r < 200
  if (!s.all && (warm || hot || screen)) return [r, g, b]
  const t = s.tint
  return [Math.round(r + (t[0] - r) * s.k), Math.round(g + (t[1] - g) * s.k), Math.round(b + (t[2] - b) * s.k)]
}

const shadeCache = new Map<string, string>()
export function shadeHex(color: string, key: string, s: Shade): string {
  const id = key + color
  let out = shadeCache.get(id)
  if (!out) {
    const c = rgb(color)
    const o = shadeRgb(c[0], c[1], c[2], s)
    out = hex(o[0], o[1], o[2])
    shadeCache.set(id, out)
  }
  return out
}
