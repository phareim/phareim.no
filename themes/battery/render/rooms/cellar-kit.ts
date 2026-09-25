/**
 * Small pixel helpers for the cellar's painters (pantry, boiler, lab):
 * whole-pixel rects, dithered ramps, filled ellipses, lines, crooked
 * stone walls and perspective floors. Everything is fillRect on whole
 * pixels; nothing anti-aliased.
 */
import { bayer, mix } from '../../../base/pixel/sprites'
import type { G } from '../api'
import type { GameState } from '../../types'

export const INK = '#0b0616'

export function hash(n: number): number {
  n = (n ^ 61) ^ (n >>> 16)
  n = n + (n << 3)
  n = n ^ (n >>> 4)
  n = Math.imul(n, 0x27d4eb2d)
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296
}

export function R(g: G, x: number, y: number, w: number, h: number, c: string) {
  if (w <= 0 || h <= 0) return
  g.fillStyle = c
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export function P(g: G, x: number, y: number, c: string) {
  g.fillStyle = c
  g.fillRect(Math.round(x), Math.round(y), 1, 1)
}

/** A box with an ink outline, a lit top row and a shaded bottom row. */
export function box(g: G, x: number, y: number, w: number, h: number, body: string, hi?: string, lo?: string) {
  R(g, x - 1, y - 1, w + 2, h + 2, INK)
  R(g, x, y, w, h, body)
  if (hi) R(g, x, y, w, 1, hi)
  if (lo) R(g, x, y + h - 1, w, 1, lo)
}

/** Two colours dithered: t = 0 all a, 1 all b. */
export function dith(g: G, x: number, y: number, w: number, h: number, a: string, b: string, t: number) {
  x = Math.round(x); y = Math.round(y)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    g.fillStyle = bayer(x + i, y + j) < t ? b : a
    g.fillRect(x + i, y + j, 1, 1)
  }
}

/** A vertical ramp through `stops`, dithered between neighbours. */
export function vramp(g: G, x: number, y: number, w: number, h: number, stops: readonly string[]) {
  x = Math.round(x); y = Math.round(y)
  const n = stops.length - 1
  for (let j = 0; j < h; j++) {
    const f = (j / Math.max(1, h - 1)) * n
    const k = Math.min(n - 1, Math.floor(f))
    const t = f - k
    for (let i = 0; i < w; i++) {
      g.fillStyle = bayer(x + i, y + j) < t ? stops[k + 1]! : stops[k]!
      g.fillRect(x + i, y + j, 1, 1)
    }
  }
}

/** A filled ellipse, row by row. */
export function ellipse(g: G, cx: number, cy: number, rx: number, ry: number, c: string) {
  g.fillStyle = c
  for (let y = -ry; y <= ry; y++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.0001))))
    g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1)
  }
}

/** An outlined, top-lit ellipse. */
export function blob(g: G, cx: number, cy: number, rx: number, ry: number, body: string, hi: string, lo: string) {
  ellipse(g, cx, cy, rx + 1, ry + 1, INK)
  ellipse(g, cx, cy, rx, ry, lo)
  ellipse(g, cx - 1, cy - 1, rx - 1, ry - 1, body)
  ellipse(g, cx - Math.round(rx / 3), cy - Math.round(ry / 2), Math.max(1, Math.round(rx / 3)), Math.max(1, Math.round(ry / 4)), hi)
}

export function line(g: G, x0: number, y0: number, x1: number, y1: number, c: string, w = 1) {
  g.fillStyle = c
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    g.fillRect(x0, y0, w, w)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

/**
 * A wall of rough stones between y0 and y1: rows of different heights,
 * stones of different widths, each top-lit with a dark joint.
 */
export function stones(g: G, x0: number, y0: number, w: number, y1: number, cols: readonly string[], joint: string, hi: string, seed = 1) {
  R(g, x0, y0, w, y1 - y0, joint)
  let y = y0
  let row = 0
  while (y < y1) {
    const h = 7 + Math.floor(hash(seed * 31 + row) * 4)
    let x = x0 - Math.floor(hash(seed + row * 7) * 12)
    let k = 0
    while (x < x0 + w) {
      const sw = 10 + Math.floor(hash(seed * 13 + row * 101 + k) * 12)
      const c = cols[Math.floor(hash(seed * 7 + row * 53 + k * 3) * cols.length)]!
      const sx = Math.max(x0, x + 1)
      const ex = Math.min(x0 + w, x + sw)
      const sy = y + 1
      const ey = Math.min(y1, y + h)
      if (ex > sx && ey > sy) {
        R(g, sx, sy, ex - sx, ey - sy, c)
        R(g, sx, sy, ex - sx, 1, hi)
        R(g, sx, ey - 1, ex - sx, 1, mix(c, joint, 0.45))
        // Rounded corners.
        P(g, sx, sy, joint); P(g, ex - 1, sy, joint)
        if (hash(row * 5 + k) < 0.35) P(g, sx + 3 + Math.floor(hash(k + row) * (ex - sx - 5)), sy + 2 + Math.floor(hash(k * 3 + row) * Math.max(1, ey - sy - 3)), mix(c, joint, 0.3))
      }
      x += sw
      k++
    }
    y += h
    row++
  }
}

/**
 * A floor from y0 to 144: rows of slabs growing taller towards the viewer,
 * joints converging on a vanishing point (vx, vy), staggered by row.
 */
export function slabs(g: G, x0: number, w: number, y0: number, h: number, vx: number, vy: number,
  cols: readonly string[], joint: string, hi: string, seed = 3, pitch = 34) {
  const y1 = y0 + h
  R(g, x0, y0, w, h, joint)
  const rows: number[] = [y0]
  let rh = 5
  while (rows[rows.length - 1]! < y1) { rows.push(rows[rows.length - 1]! + rh); rh = Math.round(rh * 1.3 + 1) }
  for (let r = 0; r < rows.length - 1; r++) {
    const ya = rows[r]!
    const yb = Math.min(y1, rows[r + 1]!)
    const off = (r % 2) * pitch / 2 + hash(seed + r) * 6
    for (let y = ya + 1; y < yb; y++) {
      const k = (y - vy) / (y1 - vy)
      const span = pitch * k
      const j0 = Math.floor((x0 - vx) / span) - 2
      const j1 = Math.ceil((x0 + w - vx) / span) + 2
      for (let j = j0; j <= j1; j++) {
        const xa = vx + (j * pitch + off) * k
        const xn = vx + ((j + 1) * pitch + off) * k
        const sx = Math.max(x0, Math.round(xa) + 1)
        const ex = Math.min(x0 + w, Math.round(xn))
        if (ex <= sx) continue
        const c = cols[Math.floor(hash(seed * 17 + r * 97 + (j + 500) * 13) * cols.length)]!
        R(g, sx, y, ex - sx, 1, y === ya + 1 ? hi : c)
      }
    }
  }
}

/** A hanging cobweb in a corner: `dir` 1 opens to the right, -1 to the left. */
export function cobweb(g: G, x: number, y: number, size: number, dir: 1 | -1, c: string, sway = 0) {
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2)
    line(g, x, y, x + dir * Math.cos(a) * size + (i === 2 ? sway : 0), y + Math.sin(a) * size, c)
  }
  for (let r = 4; r < size; r += 4) {
    let px = x + dir * r
    let py = y
    for (let i = 1; i <= 4; i++) {
      const a = (i / 4) * (Math.PI / 2)
      const sag = 1
      const nx = x + dir * Math.cos(a) * r
      const ny = y + Math.sin(a) * r
      line(g, px, py, (px + nx) / 2 - dir * sag, (py + ny) / 2 + sag, c)
      line(g, (px + nx) / 2 - dir * sag, (py + ny) / 2 + sag, nx, ny, c)
      px = nx; py = ny
    }
  }
}

/** A dripping drop along x from y0 to y1 at time t (period p seconds, phase ph). */
export function drip(g: G, x: number, y0: number, y1: number, t: number, p: number, ph: number, c: string, splash: string) {
  const u = ((t + ph) % p) / p
  const hang = 0.45
  if (u < hang) {
    // The drop swells at the lip.
    const s = u / hang
    P(g, x, y0, c)
    if (s > 0.5) P(g, x, y0 + 1, c)
    return
  }
  const f = (u - hang) / (1 - hang)
  const y = y0 + (y1 - y0) * Math.min(1, f * f * 1.6)
  if (y < y1) { R(g, x, y, 1, 2, c); return }
  // Splash.
  const k = Math.min(1, (f - 0.79) * 6)
  if (k < 1) {
    P(g, x - 1 - Math.round(k * 2), y1 - 1 - Math.round((1 - k) * 2), splash)
    P(g, x + 1 + Math.round(k * 2), y1 - 1 - Math.round((1 - k) * 2), splash)
  }
}

export { mix, bayer }

/**
 * glow() draws after the actors, at full brightness: skip a glowing part
 * when someone stands in front of it (feet below `baseY`, body over the rect).
 */
export function hidden(s: GameState, room: string, x: number, y: number, w: number, h: number, baseY: number): boolean {
  for (const a of Object.values(s.actors)) {
    if (a.room !== room || !a.visible || a.y <= baseY) continue
    if (a.x + 13 > x && a.x - 13 < x + w && a.y > y && a.y - 60 < y + h) return true
  }
  return false
}
