// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Deep Space — the quiet one. Near-black, a faint dust lane, very sparse
 * stars drifting in two depths, a distant spiral galaxy, and one far star
 * that breathes slowly. Almost nothing moves; bells and leads wake a star
 * for a moment at their pitch, and the galaxy's core warms a little with
 * the kick when the music is at its top.
 */
import { rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { bayer8, drawSparks, fbm, layer, melodic, rng, spawnSpark, wrap, type FrameCtx, type G, type Lights, type Place, type Spark } from '../lib/kit.ts'
import { paintNebula } from '../lib/space.ts'

interface Dot { x: number; y: number; c: string; ph: number }

export function createDeepspace(): Place {
  let W = 0
  let H = 0
  let back: HTMLCanvasElement | null = null
  let galaxy = { x: 0, y: 0, r: 0 }
  let far: Dot[] = []
  let near: Dot[] = []
  let beacon = { x: 0, y: 0 }
  const sparks: Spark[] = []

  function paintGalaxy(g: G, cx: number, cy: number, R: number) {
    const ramp = ['#140b26', '#221540', '#35205e', '#54307e', '#8a6ab8', '#cfc6ff', '#fff4ff']
    const tilt = 0.42
    const rot = -0.5
    const cs = Math.cos(rot)
    const sn = Math.sin(rot)
    for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R * 1.2); x <= cx + R * 1.2; x++) {
      const dx = x - cx
      const dy = y - cy
      const u = dx * cs + dy * sn
      const v = (-dx * sn + dy * cs) / tilt
      const r = Math.hypot(u, v) / R
      if (r > 1) continue
      const th = Math.atan2(v, u)
      const arm = 0.5 + 0.5 * Math.cos(2 * (th - Math.log(r + 0.05) * 2.4))
      const core = Math.exp(-r * 7)
      const dust = fbm(x, y, 8, 5)
      const lv = (core * 1.5 + arm * Math.pow(1 - r, 1.3) * 0.7 * (0.5 + dust * 0.9)) * ramp.length + bayer8(x, y) - 0.5
      const i = Math.min(ramp.length - 1, Math.floor(lv))
      if (i < 1) continue
      rect(g, ramp[i]!, x, y, 1, 1)
    }
  }

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w * 1.1
    galaxy = { x: Math.round(w * (portrait ? 0.6 : 0.66)), y: Math.round(h * (portrait ? 0.34 : 0.38)), r: Math.round(Math.min(w, h) * 0.26) }
    beacon = { x: Math.round(w * 0.2), y: Math.round(h * 0.68) }
    back = layer(w, h, g => {
      rect(g, '#05030b', 0, 0, w, h)
      // A faint dust lane across the dark.
      paintNebula(g, w, h, w * 0.4, h * 0.6, w * 0.7, h * 0.28, ['#05030b', '#08050f', '#0c0719', '#110a24', '#170e2e'], 41, 0.9)
      paintGalaxy(g, galaxy.x, galaxy.y, galaxy.r)
    })
    const R = rng(17)
    const mk = (n: number, bright: number): Dot[] => {
      const out: Dot[] = []
      for (let i = 0; i < n; i++) {
        const b = R()
        out.push({ x: R() * w, y: R() * h, c: b < bright ? '#fff4ff' : b < bright * 3 ? '#cfc6ff' : '#5a4f90', ph: R() * 6.28 })
      }
      return out
    }
    far = mk(Math.round((w * h) / 520), 0.04)
    near = mk(Math.round((w * h) / 2400), 0.2)
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back) return
    g.drawImage(back, 0, 0)
    const drift = 0.4 + c.energy * 0.3
    for (const s of far) {
      const x = Math.round(wrap(s.x - c.t * drift, W))
      const tw = Math.sin(c.t * 0.5 + s.ph)
      rect(g, tw > -0.6 ? s.c : '#2a1f4a', x, Math.round(s.y), 1, 1)
    }
    for (const s of near) {
      const x = Math.round(wrap(s.x - c.t * drift * 2.5, W))
      rect(g, s.c, x, Math.round(s.y), 1, 1)
      if (s.c === '#fff4ff' && Math.sin(c.t * 0.3 + s.ph) > 0.7) {
        rect(g, '#5a4f90', x - 1, Math.round(s.y), 1, 1)
        rect(g, '#5a4f90', x + 1, Math.round(s.y), 1, 1)
      }
    }
    L.light(galaxy.x, galaxy.y, galaxy.r * 1.4, '#9a4ff0', 0.12 + 0.06 * c.beat)
    L.light(galaxy.x, galaxy.y, galaxy.r * 0.5, '#fff1b0', 0.14 + 0.08 * c.beat)
    // One far star breathing slowly.
    const b = 0.5 + 0.5 * Math.sin(c.t * 0.9)
    rect(g, '#cfc6ff', beacon.x, beacon.y, 1, 1)
    if (b > 0.5) {
      rect(g, '#8f86b8', beacon.x - 1, beacon.y, 3, 1)
      rect(g, '#8f86b8', beacon.x, beacon.y - 1, 1, 3)
    }
    L.light(beacon.x + 0.5, beacon.y + 0.5, 6 + b * 4, '#7ce4ff', 0.2 + b * 0.25)
    // A slow falling star every forty seconds or so.
    const ph = wrap(c.t, 41) / 41
    if (ph < 0.08) {
      const k = ph / 0.08
      const x = Math.round(W * (0.1 + k * 0.5))
      const y = Math.round(H * (0.12 + k * 0.18))
      rect(g, '#fff4ff', x, y, 1, 1)
      rect(g, '#8f86b8', x - 1, y, 1, 1)
      rect(g, '#5a4f90', x - 2, y - 1, 1, 1)
      rect(g, '#2a1f4a', x - 3, y - 1, 1, 1)
    }
    for (const n of c.notes) {
      if (!melodic(n.layer) || n.layer === 'arp') continue
      spawnSpark(sparks, 8 + Math.random() * (W - 16), 6 + (1 - n.h) * (H - 12), n.layer === 'bells' ? '#fff4ff' : mix(c.accent, '#ffffff', 0.5), n.layer === 'bells', 2.4)
    }
    drawSparks(g, sparks, c.dt, L, 0.3)
  }

  return {
    layout,
    draw,
    ambient: c => mix('#e4e0f4', '#c8c0e4', c.dark * 0.5),
    bloom: 0.8,
    horizon: () => Math.round(H * 0.5),
  }
}
