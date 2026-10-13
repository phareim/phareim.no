/**
 * The pixel kit of the drive: what the renderer needs to put flat colour on
 * whole pixels.
 *
 * - `pfill` / `pline` / `prect` / `pdisc`: shapes rasterised by hand, one
 *   fillRect per span, so edges land on whole logical pixels with no
 *   antialiasing (a canvas fill would smear half-covered pixels into new
 *   colours, and nothing in this look is blended).
 * - `box`: the talk box of Nova's Solo Rescue, for the readouts and the talk.
 * - `stipple`: an ordered pattern for what a 16-bit board could not fade.
 */
import { CREAM, INK, NAVY } from './color'

type G = CanvasRenderingContext2D

// ------------------------------------------------------------ rasterising

const xs: number[] = []

/**
 * Fill a simple polygon (flat x,y list, logical px) with whole-pixel spans,
 * even-odd rule, sampled at pixel centres. Rows outside [top, bottom) are
 * skipped, so a wall that reaches far off screen costs nothing.
 */
export function pfill(g: G, pts: number[], color: string | CanvasPattern, top = 0, bottom = g.canvas.height) {
  const n = pts.length / 2
  if (n < 3) return
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 1; i < pts.length; i += 2) {
    const y = pts[i]!
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const y0 = Math.max(top, Math.ceil(minY - 0.5))
  const y1 = Math.min(bottom - 1, Math.floor(maxY - 0.5))
  if (y1 < y0) return
  g.fillStyle = color
  const W = g.canvas.width
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5
    xs.length = 0
    for (let i = 0; i < n; i++) {
      const ax = pts[i * 2]!
      const ay = pts[i * 2 + 1]!
      const j = (i + 1) % n
      const bx = pts[j * 2]!
      const by = pts[j * 2 + 1]!
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay))
    }
    if (xs.length < 2) continue
    xs.sort((a, b) => a - b)
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.max(0, Math.round(xs[k]!))
      const b = Math.min(W, Math.round(xs[k + 1]!))
      if (b > a) g.fillRect(a, y, b - a, 1)
    }
  }
}

/** A one-pixel line (Bresenham), clipped to the canvas. */
export function pline(g: G, x0: number, y0: number, x1: number, y1: number, color: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
  const W = g.canvas.width
  const H = g.canvas.height
  if ((x0 < 0 && x1 < 0) || (y0 < 0 && y1 < 0) || (x0 >= W && x1 >= W) || (y0 >= H && y1 >= H)) return
  g.fillStyle = color
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (let guard = 0; guard < 4000; guard++) {
    g.fillRect(x0, y0, 1, 1)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

/** A rectangle snapped to whole pixels, at least one pixel each way. */
export function prect(g: G, x: number, y: number, w: number, h: number, color: string) {
  const a = Math.round(x)
  const b = Math.round(y)
  g.fillStyle = color
  g.fillRect(a, b, Math.max(1, Math.round(x + w) - a), Math.max(1, Math.round(y + h) - b))
}

/** A filled disc. */
export function pdisc(g: G, cx: number, cy: number, r: number, color: string) {
  g.fillStyle = color
  const rr = Math.max(0.5, r)
  const n = Math.ceil(rr)
  for (let y = -n; y <= n; y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, rr * rr - y * y + rr * 0.8)))
    if (rr * rr - y * y + rr * 0.8 < 0) continue
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1)
  }
}

const rockTiles = new Map<string, HTMLCanvasElement>()

/**
 * A cut of granite as a tile, for the face round a tunnel's mouth: slate in
 * two courses, a lit ledge on top of each, cracks, a little moss. `key` names
 * the hour and `shade` gives its colours, so the rock darkens with the night.
 */
export function rockTile(key: string, shade: (c: string) => string): HTMLCanvasElement {
  let c = rockTiles.get(key)
  if (c) return c
  c = document.createElement('canvas')
  c.width = 24
  c.height = 16
  const g = c.getContext('2d')!
  const px = (color: string, x: number, y: number, w = 1, h = 1) => {
    g.fillStyle = shade(color)
    g.fillRect(x, y, w, h)
  }
  for (let course = 0; course < 2; course++) {
    const y0 = course * 8
    const off = course ? 9 : 0
    px('#50526a', 0, y0, 24, 8)
    px('#666a86', 0, y0, 24, 1)
    px('#3c3e54', 0, y0 + 7, 24, 1)
    // A facet in a lighter tone, a joint, a crack running down from the ledge.
    px('#5a5e78', (off + 3) % 24, y0 + 2, 7, 3)
    px('#3c3e54', (off + 13) % 24, y0 + 1, 1, 6)
    px('#44465c', (off + 18) % 24, y0 + 3, 4, 2)
    px('#3c3e54', (off + 20) % 24, y0 + 1, 1, 3)
  }
  px('#5c7a54', 6, 0, 3, 1)
  px('#5c7a54', 17, 8, 2, 1)
  rockTiles.set(key, c)
  return c
}

// ------------------------------------------------------------ UI

/**
 * The talk box: a flat night-blue panel, a dark line round it and a cream
 * line inside that, as in Nova's Solo Rescue. Nothing shows through it.
 */
export function box(g: G, x: number, y: number, w: number, h: number, edge = CREAM, fill = NAVY) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
  g.fillStyle = INK
  g.fillRect(x - 1, y - 1, w + 2, h + 2)
  g.fillStyle = fill
  g.fillRect(x, y, w, h)
  g.fillStyle = edge
  g.fillRect(x + 1, y + 1, w - 2, 1)
  g.fillRect(x + 1, y + h - 2, w - 2, 1)
  g.fillRect(x + 1, y + 1, 1, h - 2)
  g.fillRect(x + w - 2, y + 1, 1, h - 2)
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const stipples: (HTMLCanvasElement | null)[] = []

/** A 4 x 4 tile with `level` of its sixteen pixels set (0..16), in the ordered pattern: a fade in steps. */
export function stipple(level: number): HTMLCanvasElement {
  const l = Math.max(0, Math.min(16, Math.round(level)))
  let c = stipples[l]
  if (!c) {
    c = document.createElement('canvas')
    c.width = 4
    c.height = 4
    const g = c.getContext('2d')!
    g.fillStyle = '#000000'
    for (let i = 0; i < 16; i++) if (BAYER4[i]! < l) g.fillRect(i & 3, i >> 2, 1, 1)
    stipples[l] = c
  }
  return c
}
