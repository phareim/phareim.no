/**
 * Weather and small effects shared by the rooms: rain for the outdoor rooms,
 * rain streaks for a window, a lightning bolt.
 */
import type { Floor } from '../types'
import type { G, View } from './api'

function hash(n: number): number {
  n = (n ^ 61) ^ (n >>> 16)
  n = n + (n << 3)
  n = n ^ (n >>> 4)
  n = Math.imul(n, 0x27d4eb2d)
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296
}

/** Rain over an outdoor room (drawn in front of the actors). */
export function drawRain(g: G, floor: Floor, v: View) {
  if (floor !== 'outside' && v.room !== 'roof') return
  rainIn(g, v.camX - 10, 0, v.w + 20, 144, v.t, 90, v.flash)
}

/**
 * Rain streaks inside a rectangle (a window pane, or the whole sky):
 * `n` drops falling fast and slanting left.
 */
export function rainIn(g: G, x: number, y: number, w: number, h: number, t: number, n = 12, flash = 0) {
  g.fillStyle = flash > 0.2 ? '#e8ecff' : '#8fa6d8'
  for (let i = 0; i < n; i++) {
    const sx = hash(i * 7 + 1)
    const speed = 150 + hash(i * 13 + 5) * 90
    const len = 3 + Math.floor(hash(i * 3 + 2) * 4)
    const fy = ((hash(i * 11 + 3) * h + t * speed) % (h + len)) - len
    const fx = x + ((sx * w - (fy * 0.25)) % w + w) % w
    for (let k = 0; k < len; k++) {
      const py = Math.round(y + fy + k)
      const px = Math.round(fx - k * 0.25)
      if (py >= y && py < y + h && px >= x && px < x + w) g.fillRect(px, py, 1, 1)
    }
  }
}

/** A jagged lightning bolt from (x, y0) down to y1, seeded so it holds still for a flash. */
export function bolt(g: G, x: number, y0: number, y1: number, seed: number, color = '#ffffff') {
  g.fillStyle = color
  let cx = x
  for (let y = y0; y < y1; y++) {
    if (hash(seed * 131 + y) < 0.3) cx += hash(seed * 17 + y) < 0.5 ? -1 : 1
    g.fillRect(Math.round(cx), y, 1, 1)
    if (hash(seed * 7 + y * 3) < 0.04) {
      let bx = cx
      for (let k = 0; k < 8; k++) { bx += hash(seed + y + k) < 0.5 ? -1 : 1; g.fillRect(Math.round(bx), y + k, 1, 1) }
    }
  }
}

export { hash }
