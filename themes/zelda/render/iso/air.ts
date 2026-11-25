/**
 * What drifts in a realm's air in the 16-bit view (`../looks.ts` `MOOD`):
 * snow falling, glowing spores rising, dust and petals on the wind. A few
 * dozen pixels a frame on the effects layer, in classic px over the view
 * (`vx`, `vy` its corner in the world), each one a pure function of the time,
 * so nothing is kept between frames. They slide a little slower than the
 * ground as the camera moves, so they read as air between the eye and it.
 */
import type { Life, Mood } from '../looks'
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

/** What `realmLife` needs of the view: where a world point is on the effects layer, the tile at a place, the tiles in view. */
export interface LifeView {
  /** A world point (tiles; z up, in tiles) on the effects layer (classic px, whole hi-res px). */
  place(x: number, y: number, z: number): { x: number; y: number }
  tile(x: number, y: number): string
  /** The tiles in view, and the view's size in classic px. */
  x0: number; y0: number; x1: number; y1: number
  vw: number; vh: number
  /** One hi-res px in classic px (a dot's size). */
  px: number
}

const isWater = (t: string) => t === '~' || t === 'ω'
const isOpen = (t: string) => t !== '~' && t !== 'ω' && t !== '#' && t !== '%' && t !== '^' && t !== 'T' && t !== 'H' && t !== 'M'
const FLY = ['#ffb0e0', '#ffd23f', '#ffffff', '#9ff4ff']

/**
 * More life in a realm's air (`looks.ts` `Life`), each thing a pure function of the time and of where it is
 * in the world, so it stays put when the camera moves and nothing is kept between frames: lanterns rise off
 * the water and light it, quartz glints on the sand, butterflies wander over the lawns, a few birds cross high
 * up now and then, fish jump in open water. Under reduced motion the time is 0 and all of it stands still (the
 * glints, the birds and the jumps are then not there at all).
 */
export function realmLife(g: G, life: readonly Life[], v: LifeView, time: number, lights: Light[]): void {
  const t = time
  const u = v.px
  const dot = (x: number, y: number, z: number, c: string, a: number, w = 1, h = 1) => {
    const p = v.place(x, y, z)
    g.globalAlpha = a
    g.fillStyle = c
    g.fillRect(p.x, p.y, w * u, h * u)
  }
  /** Each cell of `n` tiles in view, with the cell's own hash. */
  const cells = (n: number, salt: number, each: (cx: number, cy: number, h: number) => void) => {
    for (let cy = Math.floor(v.y0 / n); cy <= Math.floor(v.y1 / n); cy++) {
      for (let cx = Math.floor(v.x0 / n); cx <= Math.floor(v.x1 / n); cx++) each(cx, cy, hash2(cx, cy, salt))
    }
  }
  for (const kind of life) {
    switch (kind) {
      case 'lanterns':
        // Paper lanterns let go on the water, rising slowly and drifting with the wind, warm against the snow.
        cells(5, 91, (cx, cy, h) => {
          if (h > 0.7) return
          const bx = cx * 5 + Math.floor(hash2(cx, cy, 92) * 5)
          const by = cy * 5 + Math.floor(hash2(cx, cy, 93) * 5)
          if (!isWater(v.tile(bx, by))) return
          const ph = (t / 30 + h * 7) % 1
          const x = bx + 0.5 + Math.sin(t * 0.4 + h * 20) * 0.35 + ph * 1.2
          const y = by + 0.5 - ph * 0.6
          const z = 0.3 + ph * 4
          const a = Math.min(1, ph * 8) * Math.min(1, (1 - ph) * 3)
          const p = v.place(x, y, z)
          // A paper lantern: its warm glow round it, the body, a hot heart, a dark rim on top.
          g.globalAlpha = 0.22 * a
          g.fillStyle = '#ffb13f'
          g.fillRect(p.x - 4 * u, p.y - 5 * u, 10 * u, 10 * u)
          g.globalAlpha = a
          g.fillRect(p.x - u, p.y - 2 * u, 4 * u, 5 * u)
          g.fillStyle = '#fff1b0'
          g.fillRect(p.x, p.y, 2 * u, 2 * u)
          g.fillStyle = '#8a3a2a'
          g.fillRect(p.x - u, p.y - 3 * u, 4 * u, u)
          lights.push({ x, y, z, r: 1.8, color: '#ffb13f', a: 0.7 * a })
        })
        break
      case 'glints':
        // Quartz in the sand catching the sun, one grain at a time.
        if (!t) break
        cells(2, 95, (cx, cy, h) => {
          if (h > 0.45) return
          const x = cx * 2 + hash2(cx, cy, 96) * 2
          const y = cy * 2 + hash2(cx, cy, 97) * 2
          const ph = (t * 0.35 + h * 13) % 1
          if (ph > 0.07 || !isOpen(v.tile(Math.floor(x), Math.floor(y)))) return
          const k = Math.sin((ph / 0.07) * Math.PI)
          const p = v.place(x, y, 0)
          g.globalAlpha = k
          g.fillStyle = '#ffffff'
          g.fillRect(p.x, p.y, u, u)
          if (k > 0.6) {
            g.globalAlpha = k * 0.7
            g.fillStyle = '#fff1b0'
            g.fillRect(p.x - u, p.y, u, u); g.fillRect(p.x + u, p.y, u, u)
            g.fillRect(p.x, p.y - u, u, u); g.fillRect(p.x, p.y + u, u, u)
          }
        })
        break
      case 'butterflies':
        // A few butterflies, each round a patch of the lawn of its own.
        cells(6, 99, (cx, cy, h) => {
          if (h > 0.4) return
          const hx = cx * 6 + 1 + hash2(cx, cy, 100) * 4
          const hy = cy * 6 + 1 + hash2(cx, cy, 101) * 4
          if (!isOpen(v.tile(Math.floor(hx), Math.floor(hy)))) return
          const x = hx + Math.sin(t * 0.7 + h * 9) * 1.3 + Math.sin(t * 1.9 + h * 3) * 0.3
          const y = hy + Math.cos(t * 0.5 + h * 5) * 1 + Math.cos(t * 1.7 + h) * 0.25
          const z = 0.45 + 0.18 * Math.sin(t * 2.6 + h * 4)
          const c = FLY[Math.floor(hash2(cx, cy, 102) * FLY.length)]!
          const p = v.place(x, y, z)
          g.globalAlpha = 0.95
          g.fillStyle = c
          // Wings open (two of them, either side of the body), or shut (up over it).
          if (Math.sin(t * 16 + h * 30) > 0) { g.fillRect(p.x - 3 * u, p.y - 2 * u, 3 * u, 3 * u); g.fillRect(p.x + u, p.y - 2 * u, 3 * u, 3 * u) }
          else g.fillRect(p.x - u, p.y - 4 * u, 3 * u, 3 * u)
          g.fillStyle = '#2a1f4a'
          g.fillRect(p.x, p.y - 2 * u, u, 3 * u)
        })
        break
      case 'birds': case 'gulls': {
        // Now and then a few birds cross the sky in a ragged V, high over everything.
        if (!t) break
        const col = kind === 'gulls' ? '#f4f0ff' : '#2a1f4a'
        for (let k = 0; k < 2; k++) {
          const cyc = (t + k * 11) / 22
          const ph = cyc % 1
          if (ph > 0.5) continue
          const n = Math.floor(cyc)
          const q = ph / 0.5
          const back = hash2(n, k, 103) > 0.5
          const x0 = back ? v.vw + 12 - q * (v.vw + 24) : -12 + q * (v.vw + 24)
          const y0 = v.vh * (0.1 + 0.25 * hash2(n, k, 104)) + Math.sin(q * 5 + k) * 3
          const flock = 2 + Math.floor(hash2(n, k, 105) * 3)
          g.globalAlpha = 0.9
          g.fillStyle = col
          for (let i = 0; i < flock; i++) {
            const x = Math.round(x0 + (back ? 1 : -1) * Math.ceil(i / 2) * 6)
            const y = Math.round(y0 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * 3 + Math.sin(t * 2 + i))
            const up = Math.floor(t * 5 + i * 1.7) % 2 === 0
            g.fillRect(x, y, 1, 1)
            g.fillRect(x - 1, up ? y - 1 : y, 1, 1)
            g.fillRect(x + 1, up ? y - 1 : y, 1, 1)
          }
        }
        break
      }
      case 'fish':
        // A fish jumps in open water: up in an arc, back in with a ring.
        if (!t) break
        cells(5, 107, (cx, cy, h) => {
          if (h > 0.5) return
          const bx = cx * 5 + Math.floor(hash2(cx, cy, 108) * 5)
          const by = cy * 5 + Math.floor(hash2(cx, cy, 109) * 5)
          if (!isWater(v.tile(bx, by)) || !isWater(v.tile(bx + 1, by)) || !isWater(v.tile(bx - 1, by)) || !isWater(v.tile(bx, by + 1))) return
          const ph = (t / 7 + h * 11) % 1
          const dir = h > 0.25 ? 1 : -1
          if (ph < 0.09) {
            const q = ph / 0.09
            const x = bx + 0.5 + (q - 0.5) * 0.7 * dir
            const p = v.place(x, by + 0.5, Math.sin(q * Math.PI) * 0.5)
            const nose = q < 0.5 ? -u : q > 0.6 ? u : 0
            g.globalAlpha = 1
            g.fillStyle = '#9fb8d8'
            g.fillRect(p.x - 3 * u * dir, p.y - nose, 3 * u, 2 * u)
            g.fillStyle = '#e8f4ff'
            g.fillRect(p.x, p.y, 3 * u, 2 * u)
            if (q < 0.2) dot(bx + 0.5 - 0.35 * dir, by + 0.5, 0, '#e4f4ff', 0.8, 2, 1)
          } else if (ph < 0.2) {
            // The ring where it went back in.
            const q = (ph - 0.09) / 0.11
            const p = v.place(bx + 0.5 + 0.35 * dir, by + 0.5, 0)
            const r = (2 + Math.round(q * 5)) * u
            g.globalAlpha = 0.7 * (1 - q)
            g.fillStyle = '#e4f4ff'
            g.fillRect(p.x - r, p.y, u, u); g.fillRect(p.x + r, p.y, u, u)
            g.fillRect(p.x - r / 2, p.y - r / 2, r, u); g.fillRect(p.x - r / 2, p.y + r / 2, r, u)
          }
        })
        break
    }
  }
  g.globalAlpha = 1
}
