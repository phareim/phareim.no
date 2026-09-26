/**
 * Little pictures the previews module does not make: a floor or wallpaper
 * swatch (16×16 pixels of its pattern) and the pixel pictures for bits and
 * prizes in the mailbox. Data URLs, cached, client only.
 */
import type { SurfaceDef } from '../types'
import { RAINBOW } from '../catalog'

const cache = new Map<string, string>()

export function surfaceSwatch(def: SurfaceDef): string {
  const hit = cache.get(def.id)
  if (hit !== undefined) return hit
  if (typeof document === 'undefined') return ''
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 16
  const g = c.getContext('2d')!
  const main = def.colors.main
  const second = def.colors.second ?? main
  const accent = def.colors.accent ?? second
  g.fillStyle = main
  g.fillRect(0, 0, 16, 16)
  const dot = (x: number, y: number, col = second) => { g.fillStyle = col; g.fillRect(x, y, 1, 1) }
  switch (def.pattern) {
    case 'wood':
      g.fillStyle = second
      for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1)
      for (let y = 0; y < 16; y += 4) g.fillRect(((y / 4) * 5) % 16, y, 1, 3)
      break
    case 'tiles':
      g.fillStyle = second
      for (let i = 0; i < 16; i += 8) { g.fillRect(i, 0, 1, 16); g.fillRect(0, i, 16, 1) }
      break
    case 'checks':
      g.fillStyle = second
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if ((x + y) % 2) g.fillRect(x * 4, y * 4, 4, 4)
      break
    case 'grass':
      for (let i = 0; i < 26; i++) dot((i * 7) % 16, (i * 11) % 16)
      break
    case 'marble':
      g.fillStyle = second
      for (let x = 0; x < 16; x++) g.fillRect(x, Math.round(8 + 4 * Math.sin(x / 2.5)), 1, 1)
      for (let x = 0; x < 16; x++) g.fillRect(x, Math.round(2 + 2 * Math.cos(x / 3)), 1, 1)
      break
    case 'rainbow':
      RAINBOW.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, Math.floor(i * 16 / RAINBOW.length), 16, Math.ceil(16 / RAINBOW.length)) })
      break
    case 'stripes':
      g.fillStyle = second
      for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 2, 16)
      break
    case 'dots':
      for (let y = 1; y < 16; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 16; x += 4) { dot(x, y); dot(x + 1, y); dot(x, y + 1); dot(x + 1, y + 1) }
      break
    case 'hearts':
      for (const [x, y] of [[2, 2], [10, 9]] as const) {
        dot(x, y); dot(x + 2, y); dot(x - 1 + 1, y + 1); dot(x + 1, y + 1); dot(x + 2, y + 1); dot(x + 1, y + 2)
        dot(x - 1, y); dot(x + 3, y); dot(x - 1, y + 1); dot(x + 3, y + 1)
      }
      break
    case 'flowers':
      for (const [x, y] of [[3, 3], [11, 10]] as const) {
        dot(x, y - 1); dot(x - 1, y); dot(x + 1, y); dot(x, y + 1); dot(x, y, accent)
      }
      break
    case 'stars':
      for (const [x, y] of [[3, 3], [11, 6], [6, 12], [13, 13]] as const) {
        dot(x, y); dot(x - 1, y); dot(x + 1, y); dot(x, y - 1); dot(x, y + 1)
      }
      break
    case 'snow':
    case 'sparkle':
      for (let i = 0; i < 10; i++) dot((i * 5 + 2) % 16, (i * 7 + 3) % 16)
      break
    default:
      break
  }
  const url = c.toDataURL()
  cache.set(def.id, url)
  return url
}
