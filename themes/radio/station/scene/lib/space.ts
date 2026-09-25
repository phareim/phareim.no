// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Space painters for Voyager and Deep Space: dithered nebulae, a ringed
 * planet lit from one side with a Bayer terminator, tumbling asteroids and
 * a 3-D starfield flying toward the viewer.
 */
import { rect } from '../pixel/scenery.ts'
import { bayer8, fbm, type G } from './kit.ts'

/**
 * A nebula: fractal noise shaped by an elliptical falloff round (cx, cy),
 * quantized to `ramp` (dark → bright) with an ordered dither between steps.
 */
export function paintNebula(g: G, w: number, h: number, cx: number, cy: number, rx: number, ry: number, ramp: string[], salt: number, gain = 1) {
  const x0 = Math.max(0, Math.floor(cx - rx))
  const x1 = Math.min(w, Math.ceil(cx + rx))
  const y0 = Math.max(0, Math.floor(cy - ry))
  const y1 = Math.min(h, Math.ceil(cy + ry))
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const dx = (x - cx) / rx
      const dy = (y - cy) / ry
      const fall = 1 - Math.sqrt(dx * dx + dy * dy)
      if (fall <= 0) continue
      const n = fbm(x, y, 40, salt) * 1.25 - 0.35 + fbm(x + 99, y, 12, salt + 3) * 0.35
      const v = n * Math.pow(fall, 0.8) * 1.6 * gain
      if (v <= 0.05) continue
      const lv = v * ramp.length + bayer8(x, y) - 0.5
      const i = Math.min(ramp.length - 1, Math.floor(lv))
      if (i < 0) continue
      rect(g, ramp[i]!, x, y, 1, 1)
    }
  }
}

export interface PlanetStyle { bands: string[]; dark: string; rim: string; ring: string[] }

/**
 * A banded planet of radius r at (cx, cy), lit from (lx, ly) (unit-ish), with
 * an optional ring (tilt = ring's minor/major ratio). Painted in two passes
 * so the back half of the ring sits behind the globe.
 */
export function paintPlanet(g: G, cx: number, cy: number, r: number, style: PlanetStyle, lx: number, ly: number, ring = 0.32) {
  const ringA = r * 2.1
  const ringB = ringA * ring
  const drawRing = (front: boolean) => {
    if (!style.ring.length) return
    for (let k = 0; k < style.ring.length; k++) {
      const a = ringA * (0.72 + (k / style.ring.length) * 0.28)
      const b = a * ring
      const steps = Math.ceil(a * 7)
      for (let i = 0; i < steps; i++) {
        const t = (i / steps) * Math.PI * 2
        const sy = Math.sin(t)
        if (front !== sy > 0) continue
        const x = Math.round(cx + Math.cos(t) * a)
        const y = Math.round(cy + sy * b - Math.cos(t) * a * 0.12)
        // The globe's shadow falls across the far side of the ring.
        const shadow = !front && Math.cos(t) * lx < 0 && Math.abs(x - cx) < r
        rect(g, shadow ? style.dark : style.ring[k]!, x, y, 1, 1)
      }
    }
  }
  drawRing(false)
  const len = Math.hypot(lx, ly, 0.6)
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y))
    for (let x = -half; x <= half; x++) {
      const nz = Math.sqrt(Math.max(0, r * r - x * x - y * y)) / r
      const lit = ((x / r) * lx + (y / r) * ly + nz * 0.6) / len
      const band = style.bands[Math.floor(((y / r + 1) * 0.5 + Math.sin(y * 0.9) * 0.02) * style.bands.length * 0.999)]!
      const px = cx + x
      const py = cy + y
      const d = lit + (bayer8(px, py) - 0.5) * 0.35
      let col = d < 0.05 ? style.dark : band
      if (d > 0.05 && d < 0.2) col = (px + py) % 2 ? band : style.dark
      if (lit > 0.8 && x * x + y * y > r * r * 0.72) col = style.rim
      rect(g, col, px, py, 1, 1)
    }
  }
  drawRing(true)
  void ringB
}

/** An irregular rock as frames of a slow tumble (each frame a small canvas). */
export function rockFrames(r: number, salt: number, frames: number, makeCanvas: (w: number, h: number) => HTMLCanvasElement): HTMLCanvasElement[] {
  const out: HTMLCanvasElement[] = []
  const bumps = [0, 1, 2, 3, 4, 5, 6, 7].map(i => 0.72 + ((Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.3)
  const size = Math.ceil(r * 2 + 3)
  for (let f = 0; f < frames; f++) {
    const c = makeCanvas(size, size)
    const g = c.getContext('2d')!
    const rot = (f / frames) * Math.PI * 2
    const cxy = size / 2
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cxy
      const dy = y + 0.5 - cxy
      const a = Math.atan2(dy, dx) - rot
      const k = ((a / (Math.PI * 2)) * 8 + 16) % 8
      const i = Math.floor(k)
      const t = k - i
      const rr = r * (bumps[i]! * (1 - t) + bumps[(i + 1) % 8]! * t)
      const d = Math.hypot(dx, dy)
      if (d > rr) continue
      const lit = (dx - dy) / (rr * 1.4)
      const edge = d > rr - 1
      g.fillStyle = edge ? '#1c1030' : lit > 0.35 ? '#8f86b8' : lit > -0.1 ? '#5a5285' : '#3a2f5a'
      if (!edge && ((x * 7 + y * 13 + f) % 11 === 0)) g.fillStyle = '#2c2448'
      g.fillRect(x, y, 1, 1)
    }
    out.push(c)
  }
  return out
}

/** A starfield flying toward the viewer from a vanishing point. */
export interface Flyer { x: number; y: number; z: number }

export function makeFlyers(n: number, seed: () => number): Flyer[] {
  const out: Flyer[] = []
  for (let i = 0; i < n; i++) out.push({ x: (seed() - 0.5) * 2, y: (seed() - 0.5) * 2, z: 0.1 + seed() * 0.9 })
  return out
}

export function drawFlyers(g: G, fl: Flyer[], w: number, h: number, vx: number, vy: number, dt: number, speed: number, seed: () => number) {
  const f = Math.max(w, h) * 0.5
  for (const s of fl) {
    s.z -= dt * speed
    let sx = vx + (s.x / s.z) * f
    let sy = vy + (s.y / s.z) * f
    if (s.z <= 0.05 || sx < -2 || sx > w + 2 || sy < -2 || sy > h + 2) {
      s.x = (seed() - 0.5) * 2
      s.y = (seed() - 0.5) * 2
      s.z = 0.8 + seed() * 0.2
      sx = vx + (s.x / s.z) * f
      sy = vy + (s.y / s.z) * f
    }
    const near = 1 - s.z
    const col = near > 0.75 ? '#fff4ff' : near > 0.45 ? '#cfc6ff' : near > 0.2 ? '#8f86b8' : '#5a4f90'
    rect(g, col, Math.round(sx), Math.round(sy), 1, 1)
    if (near > 0.8) rect(g, '#8f86b8', Math.round(sx - (s.x > 0 ? 1 : -1)), Math.round(sy), 1, 1)
  }
}
