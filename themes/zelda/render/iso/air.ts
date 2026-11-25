/**
 * What drifts in a realm's air in the 16-bit view (`../looks.ts` `MOOD`):
 * snow falling, glowing spores rising, dust and petals on the wind. A few
 * dozen pixels a frame on the effects layer, in classic px over the view
 * (`vx`, `vy` its corner in the world), each one a pure function of the time,
 * so nothing is kept between frames. They slide a little slower than the
 * ground as the camera moves, so they read as air between the eye and it.
 */
import type { Mood } from '../looks'
import { TILE } from '../../types'
import { hash2, type Light } from '../tiles'

type G = CanvasRenderingContext2D

const wrap = (v: number, n: number) => ((v % n) + n) % n

/** Draws the look's air on `g`; spores that glow add their light to `lights` (world tiles). */
export function realmAir(g: G, mood: Mood, vx: number, vy: number, vw: number, vh: number, time: number, lights: Light[]): void {
  const n = mood.count
  if (!n || mood.particles === 'none') return
  const cols = mood.colors
  const t = time
  for (let i = 0; i < n; i++) {
    const a = hash2(i, 1, 71)
    const b = hash2(i, 2, 71)
    const c = cols[i % cols.length]!
    // Nearer ones (a third) are bigger, faster and slide more with the camera.
    const near = i % 3 === 0
    const par = near ? 0.85 : 0.6
    switch (mood.particles) {
      case 'snow': {
        const fall = (near ? 16 : 9) + b * 6
        const x = wrap(a * 900 - vx * par + Math.sin(t * 0.8 + i * 1.7) * 5 + t * 4, vw)
        const y = wrap(b * 700 - vy * par + t * fall, vh)
        g.globalAlpha = near ? 0.95 : 0.7
        g.fillStyle = c
        g.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, near ? 1 : 0.5, near ? 1 : 0.5)
        break
      }
      case 'spores': {
        const rise = 2.5 + b * 3
        const x = wrap(a * 900 - vx * par + Math.sin(t * 0.5 + i * 2.3) * 7, vw)
        const y = wrap(b * 700 - vy * par - t * rise, vh)
        const pulse = 0.55 + 0.45 * Math.sin(t * (1.3 + a) + i)
        g.globalAlpha = 0.25 * pulse
        g.fillStyle = c
        g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3)
        g.globalAlpha = 0.9 * pulse
        g.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, 1, 1)
        // Every sixth one lights the ground under it a little.
        if (i % 6 === 0) lights.push({ x: (x + vx) / TILE, y: (y + vy) / TILE, r: 1.6, color: c, a: 0.45 * pulse })
        break
      }
      case 'dust': {
        const drift = (near ? 14 : 8) + b * 8
        const x = wrap(a * 900 - vx * par + t * drift, vw)
        const y = wrap(b * 700 - vy * par + Math.sin(t * 0.6 + i * 1.3) * 6, vh)
        g.globalAlpha = (near ? 0.55 : 0.35) * (0.6 + 0.4 * Math.sin(t * 0.9 + i))
        g.fillStyle = c
        g.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, near ? 1 : 0.5, 0.5)
        break
      }
      case 'petals': {
        const x = wrap(a * 900 - vx * par + t * (6 + b * 6), vw)
        const y = wrap(b * 700 - vy * par + t * (4 + a * 3) + Math.sin(t * 1.4 + i) * 4, vh)
        const wob = Math.sin(t * 3 + i * 2.1)
        g.globalAlpha = 0.85
        g.fillStyle = c
        g.fillRect(Math.round(x * 2) / 2, Math.round(y * 2) / 2, wob > 0 ? 1 : 0.5, 0.5)
        break
      }
    }
  }
  g.globalAlpha = 1
}
