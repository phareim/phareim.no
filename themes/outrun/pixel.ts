/**
 * OutRun's pixel kit (2026-09-24): the helpers the renderer needs to draw
 * the road in Neon Shrine's look (docs/games/pixel-look.md).
 *
 * - `pfill` / `pline`: polygons and lines rasterised by hand, one fillRect
 *   per span, so edges land on whole logical pixels with no antialiasing
 *   (a canvas fill would smear half-covered pixels into new colours).
 * - `box`: Neon Shrine's dialog box (dark panel, dark outline, coloured
 *   border) for the HUD and the SELECT MUSIC cards.
 * - `trafficSprite` / `playerSprite`: the vector cars in `cars.ts`,
 *   pixelized (snapped to the palette, outlined, top-lit) at a few width
 *   steps and cached, so the sprite-scaler never resamples smoothly.
 */
import { drawTraffic, drawPlayer as drawPlayerCar, type PlayerOpts } from './cars'

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

/** A filled disc (Neon Shrine's canopy shape). */
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

/**
 * Neon Shrine's dungeon wall as a tile: violet stone in courses of two
 * bricks, a lit top row, dark mortar, a few pixels of moss.
 */
let stoneTileC: HTMLCanvasElement | null = null
export function stoneTile(): HTMLCanvasElement {
  if (stoneTileC) return stoneTileC
  const c = document.createElement('canvas')
  c.width = 16
  c.height = 8
  const g = c.getContext('2d')!
  for (let course = 0; course < 2; course++) {
    const y0 = course * 4
    g.fillStyle = '#3a2f70'
    g.fillRect(0, y0, 16, 4)
    g.fillStyle = '#4a3d88'
    g.fillRect(0, y0, 16, 1)
    g.fillStyle = '#271f50'
    g.fillRect(0, y0 + 3, 16, 1)
    const off = course ? 4 : 0
    g.fillRect(off, y0, 1, 4)
    g.fillRect(off + 8, y0, 1, 4)
  }
  g.fillStyle = '#3fd8b0'
  g.fillRect(5, 2, 1, 1)
  g.fillRect(12, 6, 2, 1)
  g.fillStyle = '#1f7a6e'
  g.fillRect(6, 2, 1, 1)
  stoneTileC = c
  return c
}

// ------------------------------------------------------------ UI

/**
 * Neon Shrine's dialog box: a dark panel with a dark outline and a
 * one-pixel border in `color`, an inner shade line under the top edge.
 */
export function box(g: G, x: number, y: number, w: number, h: number, color: string, fill = 'rgba(11,6,22,0.86)') {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h)
  g.fillStyle = fill
  g.fillRect(x, y, w, h)
  g.fillStyle = '#0b0616'
  g.fillRect(x - 1, y - 1, w + 2, 1)
  g.fillRect(x - 1, y + h, w + 2, 1)
  g.fillRect(x - 1, y, 1, h)
  g.fillRect(x + w, y, 1, h)
  g.fillStyle = color
  g.fillRect(x, y, w, 1)
  g.fillRect(x, y + h - 1, w, 1)
  g.fillRect(x, y, 1, h)
  g.fillRect(x + w - 1, y, 1, h)
  g.fillStyle = 'rgba(255,255,255,0.08)'
  g.fillRect(x + 1, y + 1, w - 2, 1)
}

// ------------------------------------------------------------ car sprites

export interface CarSprite {
  c: HTMLCanvasElement
  /** The car's bottom centre inside the canvas. */
  ax: number
  ay: number
  /** Width the car was baked at (for scaled fallbacks). */
  w: number
}

/**
 * Palette keys a car may snap to, with the one-step-lighter key used on
 * top-lit pixels (Neon Shrine's `relight`). Near-black lifts to 'u' so dark
 * hulls read on the dark road.
 */
const SNAP: readonly [string, string, string][] = [
  // key, colour, lighter key
  ['u', '#2a1f4a', 'G'], ['w', '#fff4ff', 'w'], ['W', '#cfc6ff', 'w'], ['g', '#8f86b8', 'W'], ['G', '#5a5285', 'g'],
  ['c', '#2ff3ff', 'w'], ['C', '#1a9fc4', 'c'], ['b', '#2f5fd0', 'c'], ['B', '#1a2f78', 'b'], ['p', '#ff2fa0', 'm'],
  ['P', '#b01874', 'p'], ['m', '#ff8ae0', 'w'], ['v', '#9a4ff0', 'm'], ['V', '#54259e', 'v'], ['y', '#ffd23f', 'e'],
  ['Y', '#c4861c', 'y'], ['o', '#ff8a3d', 'y'], ['r', '#ff3b5c', 'm'], ['R', '#9e1638', 'r'], ['h', '#3a1a4a', 'H'],
  ['e', '#fff1b0', 'w'], ['t', '#3fd8b0', 'c'], ['T', '#1f7a6e', 't'], ['H', '#7a3a8a', 'm'], ['K', '#1c1030', 'u'],
  ['s', '#f5c3a8', 'w'], ['S', '#c98576', 's'],
]
const KEY_INDEX = new Map(SNAP.map((e, i) => [e[0], i]))
const RGB = SNAP.map(([, hex]) => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const
})
const LIGHTER_I = SNAP.map(([, , up]) => KEY_INDEX.get(up)!)
const LIFT_I = new Map([[KEY_INDEX.get('K')!, KEY_INDEX.get('u')!]])
const OUTLINE: readonly [number, number, number] = [11, 6, 22]
const snapMemo = new Map<number, number>()

function snap(r: number, g: number, b: number): number {
  const key = (r << 16) | (g << 8) | b
  let i = snapMemo.get(key)
  if (i !== undefined) return i
  let bd = Infinity
  i = 0
  for (let k = 0; k < RGB.length; k++) {
    const c = RGB[k]!
    const dr = r - c[0]
    const dg = g - c[1]
    const db = b - c[2]
    const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11
    if (d < bd) { bd = d; i = k }
  }
  // Very dark pixels (tyres, shadows) snap to the outline colour instead.
  if (r + g + b < 60) i = -2
  else i = LIFT_I.get(i) ?? i
  snapMemo.set(key, i)
  return i
}

let scratch: HTMLCanvasElement | null = null

/**
 * The fast path of `pixelize` + `relight` for cars (a bake is a few ms, not
 * tens): the vector painter draws into a scratch canvas, every pixel at
 * least half covered snaps to the palette (memoised per colour), pixels
 * with open space above step one shade lighter, and a dark outline goes
 * round the shape. Writes straight into ImageData.
 */
function bakeFast(paint: (g: G) => void, w: number, h: number): HTMLCanvasElement {
  w = Math.max(1, Math.round(w))
  h = Math.max(1, Math.round(h))
  if (!scratch || scratch.width < w || scratch.height < h) {
    scratch = document.createElement('canvas')
    scratch.width = Math.max(w, scratch?.width ?? 0)
    scratch.height = Math.max(h, scratch?.height ?? 0)
  }
  const sg = scratch.getContext('2d', { willReadFrequently: true })!
  sg.setTransform(1, 0, 0, 1, 0, 0)
  sg.clearRect(0, 0, w, h)
  sg.translate(w / 2, h / 2)
  paint(sg)
  sg.setTransform(1, 0, 0, 1, 0, 0)
  const d = sg.getImageData(0, 0, w, h).data
  // -1 empty, -2 outline-dark, else palette index.
  const idx = new Int16Array(w * h)
  for (let p = 0, q = 0; p < w * h; p++, q += 4) idx[p] = d[q + 3]! < 115 ? -1 : snap(d[q]!, d[q + 1]!, d[q + 2]!)
  const W2 = w + 2
  const H2 = h + 2
  const out = document.createElement('canvas')
  out.width = W2
  out.height = H2
  const og = out.getContext('2d')!
  const img = og.createImageData(W2, H2)
  const o = img.data
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : idx[y * w + x]!)
  for (let y = -1; y <= h; y++) {
    for (let x = -1; x <= w; x++) {
      const v = at(x, y)
      let rgb: readonly [number, number, number] | null = null
      if (v === -2) rgb = OUTLINE
      else if (v >= 0) {
        const up = at(x, y - 1)
        rgb = RGB[up < 0 ? LIGHTER_I[v]! : v]!
      } else if (at(x - 1, y) !== -1 || at(x + 1, y) !== -1 || at(x, y - 1) !== -1 || at(x, y + 1) !== -1) rgb = OUTLINE
      if (!rgb) continue
      const q = ((y + 1) * W2 + (x + 1)) * 4
      o[q] = rgb[0]; o[q + 1] = rgb[1]; o[q + 2] = rgb[2]; o[q + 3] = 255
    }
  }
  og.putImageData(img, 0, 0)
  return out
}

/** Width steps for the sprite-scaler: whole pixels when small, coarser as they grow. */
export function widthStep(w: number): number {
  if (w < 10) return Math.max(2, Math.round(w))
  if (w < 28) return Math.round(w / 2) * 2
  if (w < 64) return Math.round(w / 4) * 4
  return Math.round(w / 8) * 8
}

/**
 * Sprite families: each (car, paint, turn) keeps its bakes by width. A frame
 * bakes at most `BUDGET` new sprites; past that a car borrows the nearest
 * width already baked and is scaled to size with nearest-neighbour, the
 * way the arcade scaler did it, until its own bake comes round.
 */
const families = new Map<string, Map<number, CarSprite>>()
let bakes = 0
let cached = 0
const BUDGET = 3
const MAX_SPRITES = 600

/** Call once per frame before drawing cars. */
export function newFrame() {
  bakes = 0
}

function family(key: string) {
  let f = families.get(key)
  if (!f) families.set(key, (f = new Map()))
  return f
}

function getSprite(famKey: string, w: number, build: (w: number) => CarSprite, force = false): CarSprite {
  const f = family(famKey)
  const wq = widthStep(w)
  const hit = f.get(wq)
  if (hit) return hit
  if (bakes < BUDGET || force || f.size === 0) {
    bakes++
    if (cached > MAX_SPRITES) {
      families.clear()
      cached = 0
    }
    const s = build(wq)
    family(famKey).set(wq, s)
    cached++
    return s
  }
  let best: CarSprite | null = null
  for (const [bw, s] of f) if (!best || Math.abs(bw - wq) < Math.abs(best.w - wq)) best = s
  return best!
}

function makeSprite(paint: (g: G) => void, cw: number, ch: number, w: number): CarSprite {
  // pixel (cw/2, ch - 1) of the drawing is the car's bottom centre; +1 for the outline.
  return { c: bakeFast(paint, cw, ch), ax: Math.round(cw / 2) + 1, ay: ch, w }
}

export function trafficSprite(kind: string, paint: number, panel: number, w: number): CarSprite {
  const pq = Math.round(panel * 4) / 4
  return getSprite(`t|${kind}|${paint}|${pq}`, w, wq => {
    const cw = Math.ceil(wq * 1.75) + 2
    const ch = Math.ceil(wq * (kind === 'truck' ? 1.05 : 0.8)) + 2
    const by = ch / 2 - 1
    return makeSprite(g => drawTraffic(g, 0, by, wq, { kind, paint, panel: pq, glow: false }), cw, ch, wq)
  })
}

export interface PlayerLook {
  panel: number
  brake: boolean
  lean: number
  now: number
  speed: number
  reduced: boolean
  flame: number
}

export function playerSprite(o: PlayerLook, w: number): CarSprite {
  const pq = Math.round(o.panel * 4) / 4
  const lq = Math.round(o.lean * 2) / 2
  const blow = o.reduced ? 0.3 : o.speed > 0.5 ? 1 : 0.4
  // Hair in the wind: six frames a loop, at eight frames a second.
  const frame = o.reduced ? 0 : Math.floor(o.now * 8) % 6
  const flame = o.flame > 0.05 ? 1 : 0
  // The player's own bake never waits: it is the car on screen.
  return getSprite(`p|${pq}|${o.brake ? 1 : 0}|${lq}|${blow}|${frame}|${flame}`, w, wq => {
    const cw = Math.ceil(wq * 1.95) + 2
    const ch = Math.ceil(wq * 0.66) + 2
    const by = ch / 2 - 1
    // `now` picks the hair's frame; `speed` how far it streams. The light
    // map dims the car in tunnels, so the bake is always in full light.
    const opts: PlayerOpts = { panel: pq, brake: o.brake, roll: 0, lean: lq, now: frame * 0.075, speed: blow, reduced: o.reduced, flame, light: 1 }
    return makeSprite(g => drawPlayerCar(g, 0, by, wq, opts), cw, ch, wq)
  }, true)
}

/**
 * Blit a car sprite with its bottom centre at (x, y), scaled (nearest
 * neighbour) to width `w` when it was baked at another width; `rot` spins it
 * about its middle (a tumble).
 */
export function drawCar(g: G, s: CarSprite, x: number, y: number, w = s.w, rot = 0) {
  const k = w / s.w
  const dw = Math.max(1, Math.round(s.c.width * k))
  const dh = Math.max(1, Math.round(s.c.height * k))
  const ax = s.ax * k
  const ay = s.ay * k
  if (!rot) {
    g.drawImage(s.c, Math.round(x - ax), Math.round(y - ay), dw, dh)
    return
  }
  g.save()
  const cy = y - ay + dh / 2
  g.translate(Math.round(x), Math.round(cy))
  g.rotate(rot)
  g.drawImage(s.c, -ax, -dh / 2, dw, dh)
  g.restore()
}
