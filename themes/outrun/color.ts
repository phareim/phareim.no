/** The Neon Dreams inks and the small colour helpers the OutRun canvas code shares. */
export const CYAN = '#2ff3ff'
export const PINK = '#ff2fa0'
export const GOLD = '#ffd23f'
export const INK = '#f2e9ff'
export const INK_MUTED = '#b9a8d9'

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

export function mix(a: string, b: string, t: number): string {
  if (t <= 0) return a
  if (t >= 1) return b
  const x = rgb(a)
  const y = rgb(b)
  const r = Math.round(x[0] + (y[0] - x[0]) * t)
  const g = Math.round(x[1] + (y[1] - x[1]) * t)
  const bl = Math.round(x[2] + (y[2] - x[2]) * t)
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`
}

export function rgba(hex: string, a: number): string {
  const c = rgb(hex)
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`
}
