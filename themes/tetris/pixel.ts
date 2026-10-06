/** Russian Block Game: a crystal garden in Neon Shrine's pixels (2026-10-07).
 * Connected cells grow one silhouette; luminous veins meet at cell boundaries.
 * Rendering stays on the logical pixel grid and never changes collision rules.
 */
import { makeCanvas, type PixelStage } from '../base/pixel/stage'
import { mix } from '../base/pixel/sprites'
import { DUSK, drawStars, hash2, paintGrass, paintHouse, paintLamp, paintRidge, paintSky, paintSun, paintTreeLine, rect } from '../base/pixel/scenery'
import type { PieceType } from './engine'

type G = CanvasRenderingContext2D

const INK = '#0b0616'

/** Seven mineral tints within the site's cyan / rose / gold light families. */
export const PIECE_BODY: Record<PieceType, string> = {
  I: '#3ff0ff', O: '#ffd23f', T: '#dd70c8', S: '#56c9b1',
  Z: '#ff4f9a', J: '#75b8de', L: '#e6af73',
}
export interface PieceTones { body: string; hi: string; lo: string; edge: string; spark: string }
const tonesCache = new Map<PieceType, PieceTones>()
export function tones(type: PieceType): PieceTones {
  let t = tonesCache.get(type)
  if (!t) {
    const body = PIECE_BODY[type]
    t = { body, hi: mix(body, '#fff4ff', .5), lo: mix(body, INK, .48), edge: mix(body, INK, .78), spark: mix(body, '#fff4ff', .7) }
    tonesCache.set(type, t)
  }
  return t
}

/** A mineral's heart and branches, used by the HTML previews too. */
export function previewCss(type: PieceType, links = 0): Record<string, string> {
  const t = tones(type)
  const cut = (neighbors: number) => links & neighbors ? '0px' : '3px'
  return {
    backgroundColor: t.lo,
    backgroundImage: `linear-gradient(${t.hi}, ${t.hi}), linear-gradient(${t.body}, ${t.body}), linear-gradient(90deg, transparent 40%, ${t.body} 40%, ${t.body} 60%, transparent 60%)`,
    backgroundSize: '3px 3px, 100% 2px, 100% 100%',
    backgroundPosition: 'center, center, center', backgroundRepeat: 'no-repeat',
    clipPath: `polygon(${cut(9)} 0, calc(100% - ${cut(3)}) 0, 100% ${cut(3)}, 100% calc(100% - ${cut(6)}), calc(100% - ${cut(6)}) 100%, ${cut(12)} 100%, 0 calc(100% - ${cut(12)}), 0 ${cut(9)})`,
    boxShadow: `inset 1px 1px 0 ${t.body}, inset -1px -1px 0 ${t.edge}`,
  }
}

const tileCache = new Map<string, HTMLCanvasElement>()
/** N/E/S/W bits join cells into a growing mineral, with a readable square footprint. */
export function tile(type: PieceType, T: number, links = 0): HTMLCanvasElement {
  const key = `${type}:${T}:${links}`
  const cached = tileCache.get(key)
  if (cached) return cached
  const c = makeCanvas(T, T), g = c.getContext('2d')!, t = tones(type)
  const mid = Math.floor(T / 2), end = T - 1
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    // Cut gem corners only on the outside of a cluster.
    if ((x === 0 && y === 0 && !(links & 9)) || (x === end && y === 0 && !(links & 3)) ||
        (x === 0 && y === end && !(links & 12)) || (x === end && y === end && !(links & 6))) continue
    let col = t.lo
    if (y === 0 && !(links & 1) || x === 0 && !(links & 8)) col = t.body
    if (y === end && !(links & 4) || x === end && !(links & 2)) col = t.edge
    rect(g, col, x, y)
  }
  // Veins form an actual network across neighboring cells.
  rect(g, t.body, mid, links & 1 ? 0 : mid - 1, 1, links & 1 ? mid + 1 : 2)
  rect(g, t.body, mid, mid, 1, links & 4 ? T - mid : 2)
  rect(g, t.body, links & 8 ? 0 : mid - 1, mid, links & 8 ? mid + 1 : 2, 1)
  rect(g, t.body, mid, mid, links & 2 ? T - mid : 2, 1)
  rect(g, t.hi, mid - 1, mid - 1, 2, 2)
  if (T >= 7) {
    rect(g, t.body, 1, 1, 2, 1)
    rect(g, t.edge, end - 2, end - 2, 2, 1)
  }
  tileCache.set(key, c)
  return c
}

/** A four-petal flower opens inside the cell, then releases luminous seeds. */
export function bloom(g: G, x: number, y: number, T: number, color: string, open: number) {
  const m = Math.floor(T / 2), reach = Math.max(1, Math.round(open * (m - 1)))
  rect(g, color, x + m - reach, y + m, reach * 2 + 1, 1)
  rect(g, color, x + m, y + m - reach, 1, reach * 2 + 1)
  if (reach > 1) {
    rect(g, color, x + m - 1, y + m - reach, 3, 1)
    rect(g, color, x + m - 1, y + m + reach, 3, 1)
    rect(g, color, x + m - reach, y + m - 1, 1, 3)
    rect(g, color, x + m + reach, y + m - 1, 1, 3)
  }
  rect(g, '#fff4dd', x + m, y + m)
}

const ghostCache = new Map<string, HTMLCanvasElement>()
/** The ghost: a dotted outline of the tile in the piece's light tone. */
export function ghostTile(type: PieceType, T: number): HTMLCanvasElement {
  const key = type + T
  let c = ghostCache.get(key)
  if (c) return c
  const t = tones(type)
  c = makeCanvas(T, T)
  const g = c.getContext('2d')!
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const edge = x === 0 || y === 0 || x === T - 2 || y === T - 2
    if (x < T - 1 && y < T - 1 && edge && (x + y) % 2 === 0) rect(g, t.hi, x, y)
  }
  ghostCache.set(key, c)
  return c
}

/** Stone round the well, in logical pixels. */
export const FRAME = 3

/** An overgrown shrine trellis: quiet cell markers, roots and mineral seams. */
export function paintWell(cols: number, rows: number, T: number): HTMLCanvasElement {
  const F = FRAME, w = cols * T + F * 2, h = rows * T + F * 2
  const c = makeCanvas(w, h), g = c.getContext('2d')!
  rect(g, INK, 0, 0, w, h)
  rect(g, DUSK.stone, 1, 1, w - 2, h - 2)
  rect(g, '#56c9b1', F - 1, F - 1, cols * T + 2, 1)
  rect(g, '#356b75', F - 1, F, 1, rows * T)
  rect(g, '#356b75', w - F, F, 1, rows * T)
  rect(g, '#14202e', F, F, cols * T, rows * T)
  for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
    const x = F + col * T, y = F + r * T
    rect(g, '#24313f', x, y)
    if (hash2(col, r, 15) > .68) rect(g, '#192b36', x + 2, y + 2, Math.max(1, T - 3), 1)
  }
  for (const side of [F, w - F - 2]) {
    for (let y = F + 4; y < h - F; y++) {
      const x = side + Math.round(Math.sin(y * .12))
      rect(g, '#284953', x, y)
      if (y % 9 === 0) {
        rect(g, '#388c82', x - 1, y, 3, 1)
        rect(g, '#56c9b1', x, y - 1)
      }
    }
  }
  rect(g, '#356b75', F, h - F, cols * T, 1)
  return c
}

// ---------------------------------------------------------------- sparks

export interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

/** Light seeds rising from a harvested row (logical px, px/s). */
export function rowSparks(out: Spark[], y: number, x0: number, width: number, colors: string[]) {
  for (let i = 0; i < width; i += 2) {
    const color = colors[Math.floor(Math.random() * colors.length)] ?? '#ffffff'
    out.push({ x: x0 + i, y: y + Math.random() * 3, vx: (Math.random() - 0.5) * 60, vy: -15 - Math.random() * 25, life: 0.8 + Math.random() * 0.5, color })
  }
  if (out.length > 240) out.splice(0, out.length - 240)
}

export function stepSparks(sparks: Spark[], dt: number) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]!
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.vx *= Math.exp(-2 * dt)
    s.vy -= 8 * dt
    s.life -= dt
    if (s.life <= 0) sparks.splice(i, 1)
  }
}

export function drawSparks(g: G, sparks: Spark[]) {
  for (const s of sparks) {
    g.globalAlpha = Math.min(1, s.life * 2)
    g.fillStyle = s.color
    g.fillRect(Math.round(s.x), Math.round(s.y), 1, 1)
  }
  g.globalAlpha = 1
}

// ---------------------------------------------------------------- backdrop

export interface TetrisScene {
  layout(w: number, h: number): void
  /** Draw the town; `view` (-1..1) nudges the near layers, `beat` flashes the horizon. */
  draw(stage: PixelStage, time: number, view: number, beat: number, flare: number, garden: number): void
}

/** The town at dusk behind the cabinet: sky, stars, sun, ridges, houses, lamps, grass. */
export function createTetrisScene(): TetrisScene {
  let W = 0
  let H = 0
  let sky: HTMLCanvasElement | null = null
  let sunLayer: HTMLCanvasElement | null = null
  let front: HTMLCanvasElement | null = null
  let horizon = 0
  let starTop = 0
  let sun = { x: 0, y: 0, r: 0 }
  const PAD = 6
  let lights: { x: number; y: number; r: number; color: string; a: number }[] = []

  function layout(w: number, h: number) {
    W = w; H = h
    const ground = Math.round(h * (w < h ? 0.86 : 0.8))
    const town = Math.max(16, Math.min(34, Math.round(h * 0.14)))
    horizon = ground - town
    const farH = Math.max(10, Math.round(h * 0.09))
    starTop = horizon - farH - 2
    const sunR = Math.max(10, Math.min(30, Math.round(Math.min(w, h) * 0.12)))
    sun = { x: Math.round(w * (w < h ? 0.5 : 0.8)), y: horizon - Math.round(sunR * 0.3), r: sunR }
    lights = []
    // Near layers are painted a little wider so the view nudge never shows an edge.
    front = makeCanvas(w + PAD * 2, h)
    const g = front.getContext('2d')!
    const fw = w + PAD * 2
    paintRidge(g, fw, horizon + 2, farH, ground, DUSK.ridgeFar, DUSK.ridgeFarRim, 4, 0.7)
    paintRidge(g, fw, horizon + 5, Math.round(farH * 0.55), ground, DUSK.ridge, DUSK.ridgeRim, 12, 0.3)
    paintTreeLine(g, 0, fw, ground, Math.max(5, Math.round(town * 0.32)), 8)
    let x = Math.round(hash2(w, h, 2) * 16) - 4
    let i = 0
    while (x < fw) {
      const hw = 16 + Math.floor(hash2(i, 1, 13) * 16)
      const hh = Math.round(town * (0.55 + hash2(i, 2, 13) * 0.35))
      if (hash2(i, 3, 13) > 0.3) {
        for (const win of paintHouse(g, x, ground, hw, hh, i + 20)) lights.push({ x: win.x - PAD, y: win.y, r: 7, color: '#ffd23f', a: 0.55 })
      }
      x += hw + 6 + Math.floor(hash2(i, 4, 13) * 24)
      if (hash2(i, 5, 13) > 0.4 && x - 4 < fw) {
        const col = ['#ff4fb8', '#3ff0ff', '#ffd23f'][i % 3]!
        const l = paintLamp(g, x - 4, ground, Math.round(town * 0.5), col)
        lights.push({ x: l.x - PAD, y: l.y, r: 16, color: col, a: 0.8 })
      }
      i++
    }
    paintGrass(g, 0, fw, ground, h, 6)
    // Cobbled plaza under the cabinet.
    const plaza = Math.round(ground + (h - ground) * 0.45)
    for (let y = plaza; y < h; y += 3) {
      for (let px = (y / 3) % 2 ? 0 : 3; px < fw; px += 6) {
        rect(g, DUSK.path, px, y, 5, 2)
        rect(g, DUSK.pathL, px, y, 5, 1)
      }
      rect(g, DUSK.pathD, 0, y + 2, fw, 1)
    }
    // The cabinet stands in a shrine garden at the edge of town.
    // Foreground tendrils frame the view; the playable grid stays unobscured.
    for (const side of [0, fw - 1]) {
      const sign = side === 0 ? 1 : -1
      for (let y = Math.round(h * .12); y < ground; y++) {
        const x = side + sign * (4 + Math.round(Math.sin(y * .045) * 3))
        rect(g, '#16383d', x, y, 2, 1)
        if (y % 13 === 0) {
          rect(g, '#285c60', x + sign * 2, y - 1, 4, 2)
          rect(g, '#3e958a', x + sign * 3, y - 2, 2, 1)
        }
      }
    }
    for (let i = 0; i < Math.floor(fw / 18); i++) {
      const x = Math.floor(hash2(i, 7, 98) * fw), y = ground + 2 + Math.floor(hash2(i, 9, 98) * Math.max(3, h - ground - 7))
      rect(g, '#285c60', x, y - 4, 1, 5)
      bloom(g, x - 3, y - 9, 7, i % 3 ? '#dd70c8' : '#56c9b1', 1)
      lights.push({ x, y: y - 6, r: 9, color: i % 3 ? '#dd70c8' : '#56c9b1', a: .35 })
    }
    sunLayer = makeCanvas(w, h)
    const sg = sunLayer.getContext('2d')!
    paintSun(sg, sun.x, sun.y, sun.r, DUSK.sky5)
    sg.globalCompositeOperation = 'destination-out'
    sg.drawImage(front, -PAD, 0)
    sg.globalCompositeOperation = 'source-over'
    sky = makeCanvas(w, h)
    paintSky(sky.getContext('2d')!, w, horizon + 6)
  }

  function draw(stage: PixelStage, time: number, view: number, beat: number, flare: number, garden: number) {
    const g = stage.g
    if (!sky || !front || !sunLayer) return
    g.drawImage(sky, 0, 0)
    drawStars(g, W, starTop, time, 1, 17)
    // The stars and sky glow; the sun too (behind the ridges).
    stage.emit(0, 0, W, Math.max(0, starTop))
    g.drawImage(sunLayer, 0, 0)
    stage.emitImage(sunLayer)
    const ox = -PAD + Math.round(-view * 3)
    g.drawImage(front, ox, 0)
    stage.light(sun.x, sun.y, sun.r * 3.2, '#ff8a3d', 0.55 + flare * 0.4)
    for (const L of lights) stage.light(L.x + ox + PAD, L.y, L.r, L.color, L.a)
    // Each harvested row plants a crystal flower back in the town garden.
    // Keep growth at the outer edges, clear of the cabinet on portrait phones.
    const plants = Math.min(40, garden)
    for (let i = 0; i < plants; i++) {
      const side = i % 2, spread = Math.floor(i / 2)
      const x = Math.round(side ? W - 5 - spread * 2 : 5 + spread * 2)
      const base = H - 3 - Math.floor(hash2(i, 1, 124) * H * .1)
      const height = 7 + Math.floor(hash2(i, 2, 124) * H * .15)
      const color = i % 3 === 0 ? '#ffd23f' : i % 3 === 1 ? '#dd70c8' : '#56c9b1'
      for (let y = base; y > base - height; y--) {
        const bend = Math.round(Math.sin((base - y) * .14 + i) * 2)
        rect(g, '#285c60', x + bend, y)
        if ((base - y) % 8 === 3) rect(g, '#388c82', x + bend - 1, y, 3, 1)
      }
      const head = x + Math.round(Math.sin(height * .14 + i) * 2)
      bloom(g, head - 4, base - height - 4, 9, color, 1)
      stage.light(head, base - height, 10, color, .3)
    }
    if (beat > 0.05) {
      g.globalAlpha = Math.min(1, beat) * 0.7
      rect(g, '#ff8ae0', 0, horizon + 5, W, 1)
      g.globalAlpha = 1
      stage.emit(0, horizon + 5, W, 1)
    }
  }

  return { layout, draw }
}
