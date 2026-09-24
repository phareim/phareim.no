/**
 * Tetris in Neon Shrine's pixel look (2026-09-24). The well is a stone
 * shaft in the shrine — brick courses, a stone rim with a pink neon strip,
 * lit from above by two torches through the stage's light map — and the
 * pieces are carved, bevelled tiles, one palette family each. Behind the
 * cabinet, the town at dusk (`createTetrisScene`). All sizes in logical
 * pixels; the tile size `T` follows the screen (see Game.vue).
 */
import { makeCanvas, type PixelStage } from '../base/pixel/stage'
import { mix } from '../base/pixel/sprites'
import { DUSK, drawStars, hash2, paintGrass, paintHouse, paintLamp, paintRidge, paintSky, paintSun, paintTreeLine, rect } from '../base/pixel/scenery'
import type { PieceType } from './engine'

type G = CanvasRenderingContext2D

const INK = '#0b0616'

/** One palette family per tetromino (Neon Shrine's PAL). */
export const PIECE_BODY: Record<PieceType, string> = {
  I: '#2ff3ff', // cyan
  O: '#ffd23f', // gold
  T: '#9a4ff0', // violet
  S: '#b6ff4a', // lime
  Z: '#ff2fa0', // pink
  J: '#2f5fd0', // blue
  L: '#ff8a3d', // orange
}

export interface PieceTones { body: string; hi: string; lo: string; edge: string; spark: string }

const tonesCache = new Map<PieceType, PieceTones>()
export function tones(type: PieceType): PieceTones {
  let t = tonesCache.get(type)
  if (!t) {
    const body = PIECE_BODY[type]
    t = { body, hi: mix(body, '#ffffff', 0.5), lo: mix(body, INK, 0.38), edge: mix(body, INK, 0.75), spark: mix(body, '#ffffff', 0.7) }
    tonesCache.set(type, t)
  }
  return t
}

/** CSS for a NEXT/HOLD preview cell: the same carved tile with hard insets. */
export function previewCss(type: PieceType): Record<string, string> {
  const t = tones(type)
  return { background: t.body, boxShadow: `inset 2px 2px 0 ${t.hi}, inset -2px -2px 0 ${t.lo}, 0 0 0 1px ${INK}` }
}

const tileCache = new Map<string, HTMLCanvasElement>()

/**
 * A carved block T×T: light top/left bevel, a shadow bevel, a dark grout
 * edge on the right and bottom (so a stack reads as masonry), a bright
 * corner pixel and a small chiselled notch.
 */
export function tile(type: PieceType, T: number): HTMLCanvasElement {
  const key = type + T
  let c = tileCache.get(key)
  if (c) return c
  const t = tones(type)
  c = makeCanvas(T, T)
  const g = c.getContext('2d')!
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    let col = t.body
    if (x === T - 1 || y === T - 1) col = t.edge
    else if (x === 0 || y === 0) col = t.hi
    else if (x === T - 2 || y === T - 2) col = t.lo
    rect(g, col, x, y)
  }
  rect(g, '#fff4ff', 1, 1)
  if (T >= 7) {
    // Chiselled notch: a short dark stroke with a lit lip under it.
    const n = Math.max(2, Math.floor(T / 3))
    rect(g, t.lo, T - 2 - n, 2, n, 1)
    rect(g, t.hi, T - 2 - n, 3, n, 1)
  }
  tileCache.set(key, c)
  return c
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

/**
 * The well's static layer: stone rim with a pink neon strip on its inner
 * edge, and a brick back wall whose grout falls on the cell lines.
 */
export function paintWell(cols: number, rows: number, T: number): HTMLCanvasElement {
  const F = FRAME
  const w = cols * T + F * 2
  const h = rows * T + F * 2
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  // Rim: dark outline, violet stone with block joints, pink neon on the inside edge.
  rect(g, INK, 0, 0, w, h)
  rect(g, DUSK.stone, 1, 1, w - 2, h - 2)
  rect(g, DUSK.stoneL, 1, 1, w - 2, 1)
  rect(g, DUSK.stoneL, 1, 1, 1, h - 2)
  rect(g, DUSK.stoneD, 1, h - 2, w - 2, 1)
  rect(g, DUSK.stoneD, w - 2, 1, 1, h - 2)
  for (let y = 6; y < h - 2; y += 8) { rect(g, DUSK.stoneD, 1, y, F - 2, 1); rect(g, DUSK.stoneD, w - F + 1, y, F - 2, 1) }
  for (let x = 6; x < w - 2; x += 10) { rect(g, DUSK.stoneD, x, 1, 1, F - 2); rect(g, DUSK.stoneD, x, h - F + 1, 1, F - 2) }
  rect(g, DUSK.neon, F - 1, F - 1, cols * T + 2, 1)
  rect(g, DUSK.neon, F - 1, F - 1, 1, rows * T + 2)
  rect(g, DUSK.neon, F + cols * T, F - 1, 1, rows * T + 2)
  rect(g, '#b01874', F - 1, F + rows * T, cols * T + 2, 1)
  // Back wall: bricks two cells wide, a course per row, offset every other
  // row, grout on the cell lines; the odd crack, a little moss low down.
  rect(g, '#1b1536', F, F, cols * T, rows * T)
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? T : 0
    const y = F + r * T
    rect(g, '#120d26', F, y + T - 1, cols * T, 1)
    rect(g, '#221b42', F, y, cols * T, 1)
    for (let x = -off; x < cols * T; x += T * 2) {
      const jx = x + T * 2 - 1
      if (jx >= 0 && jx < cols * T) rect(g, '#120d26', F + jx, y, 1, T - 1)
    }
    for (let i = 0; i < 2; i++) {
      if (hash2(r, i, 41) > 0.72) {
        const cx = F + Math.floor(hash2(r, i, 42) * (cols * T - 3))
        rect(g, '#0f0a20', cx, y + 2, 2, 1)
        rect(g, '#0f0a20', cx + 1, y + 3, 1, 1)
      }
    }
    if (r > rows - 4 && hash2(r, 9, 43) > 0.4) {
      const mx = F + Math.floor(hash2(r, 8, 43) * (cols * T - 4))
      rect(g, '#1f7a6e', mx, y + T - 2, 3, 1)
      rect(g, '#3fd8b0', mx + 1, y + T - 3, 1, 1)
    }
  }
  return c
}

// ---------------------------------------------------------------- sparks

export interface Spark { x: number; y: number; vx: number; vy: number; life: number; color: string }

/** Sparks flying out of a cleared row (logical px, px/s). */
export function rowSparks(out: Spark[], y: number, x0: number, width: number, colors: string[]) {
  for (let i = 0; i < width; i += 2) {
    const color = colors[Math.floor(Math.random() * colors.length)] ?? '#ffffff'
    out.push({ x: x0 + i, y: y + Math.random() * 3, vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 50, life: 0.5 + Math.random() * 0.4, color })
  }
  if (out.length > 240) out.splice(0, out.length - 240)
}

export function stepSparks(sparks: Spark[], dt: number) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i]!
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.vy += 140 * dt
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
  draw(stage: PixelStage, time: number, view: number, beat: number, flare: number): void
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
    sunLayer = makeCanvas(w, h)
    const sg = sunLayer.getContext('2d')!
    paintSun(sg, sun.x, sun.y, sun.r, DUSK.sky5)
    sg.globalCompositeOperation = 'destination-out'
    sg.drawImage(front, -PAD, 0)
    sg.globalCompositeOperation = 'source-over'
    sky = makeCanvas(w, h)
    paintSky(sky.getContext('2d')!, w, horizon + 6)
  }

  function draw(stage: PixelStage, time: number, view: number, beat: number, flare: number) {
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
    if (beat > 0.05) {
      g.globalAlpha = Math.min(1, beat) * 0.7
      rect(g, '#ff8ae0', 0, horizon + 5, W, 1)
      g.globalAlpha = 1
      stage.emit(0, horizon + 5, W, 1)
    }
  }

  return { layout, draw }
}
