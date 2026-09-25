/**
 * The Hangar in Neon Shrine's pixel look (2026-09-25): a shrine-stone
 * launch bay on the coast at dusk. We stand inside the bay; its mouth is a
 * stone frame (two pillars with braziers and cyan neon, a lintel with
 * hanging lamps and a pink strip) opening onto the sea, the ridges and the
 * striped sun. The deck runs out to the edge in flagstones, and a launch
 * rail of rose path between two neon rails carries running lights that
 * chase out towards the sky. Drawn on the shared pixel stage
 * (themes/base/pixel/stage.ts); all sizes in logical pixels.
 */
import { makeCanvas, type PixelStage } from '../base/pixel/stage'
import { DUSK, drawStars, hash2, paintRidge, paintSky, paintSun, rect } from '../base/pixel/scenery'

type G = CanvasRenderingContext2D

const INK = '#0b0616'

export interface HangarScene {
  layout(w: number, h: number): void
  draw(stage: PixelStage, time: number): void
}

export function createHangarScene(): HangarScene {
  let W = 0
  let H = 0
  let back: HTMLCanvasElement | null = null
  let sunLayer: HTMLCanvasElement | null = null
  let front: HTMLCanvasElement | null = null
  let horizon = 0
  let deckTop = 0
  let lintel = 0
  let pillar = 0
  let cx = 0
  let railHalf = 0
  let sun = { x: 0, y: 0, r: 0 }
  let lamps: { x: number; y: number }[] = []
  let braziers: { x: number; y: number }[] = []
  let neon: { x: number; y: number; w: number; h: number; color: string }[] = []

  /** Perspective: screen row → depth scale (1 at the bottom edge, → 0 at the horizon). */
  const scaleAt = (y: number) => (y - horizon) / (H - horizon)

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w
    horizon = Math.round(h * (portrait ? 0.5 : 0.56))
    deckTop = horizon + Math.max(3, Math.round(h * 0.035))
    lintel = Math.max(8, Math.round(h * (portrait ? 0.07 : 0.1)))
    pillar = Math.max(9, Math.round(w * (portrait ? 0.07 : 0.085)))
    cx = Math.round(w / 2)
    railHalf = Math.round(w * (portrait ? 0.2 : 0.13))
    const sunR = Math.max(10, Math.min(28, Math.round(Math.min(w, h) * 0.13)))
    sun = { x: Math.round(w * (portrait ? 0.62 : 0.7)), y: horizon - Math.round(sunR * 0.35), r: sunR }

    // --- back: sky, ridges, sea, deck ---
    back = makeCanvas(w, h)
    const g = back.getContext('2d')!
    paintSky(g, w, horizon + 1)
    const farH = Math.max(8, Math.round(h * 0.08))
    sunLayer = makeCanvas(w, h)
    paintSun(sunLayer.getContext('2d')!, sun.x, sun.y, sun.r)
    paintSea(g, w)
    paintDeck(g, w, h)

    // --- front: ridges (over the sun), the bay's stone frame ---
    front = makeCanvas(w, h)
    const f = front.getContext('2d')!
    paintRidge(f, w, horizon, farH, horizon + 1, DUSK.ridgeFar, DUSK.ridgeFarRim, 9, 0.7)
    paintRidge(f, w, horizon + 1, Math.round(farH * 0.45), horizon + 1, DUSK.ridge, DUSK.ridgeRim, 21, 0.3)
    neon = []
    lamps = []
    braziers = []
    paintFrame(f, w, h)
  }

  function paintSea(g: G, w: number) {
    // A strip of sea between the ridges and the deck edge, with the sun's
    // reflection broken into short gold dashes.
    for (let y = horizon + 1; y < deckTop; y++) {
      rect(g, (y - horizon) % 2 ? DUSK.water : DUSK.waterD, 0, y, w, 1)
      for (let x = 0; x < w; x += 3) if (hash2(x, y, 41) > 0.93) rect(g, DUSK.foam, x, y, 2, 1)
    }
  }

  function paintDeck(g: G, w: number, h: number) {
    // Flagstones in perspective: rows of stones whose joints converge on
    // the centre of the horizon. Each stone gets its own shade.
    rect(g, DUSK.stoneTop, 0, deckTop, w, 1)
    rect(g, DUSK.neonC, 0, deckTop, w, 1)
    for (let y = deckTop + 1; y < h; y++) {
      const s = scaleAt(y)
      const z = 1 / Math.max(0.02, s)
      const row = Math.floor(z * 3.2)
      const rowNext = Math.floor((1 / Math.max(0.02, scaleAt(y + 1))) * 3.2)
      const joint = row !== rowNext
      for (let x = 0; x < w; x++) {
        const wx = (x - cx) / Math.max(0.02, s) // world x at this row
        const stoneW = 22 // rows offset by half a stone
        const col = Math.floor((wx + (row % 2) * stoneW * 0.5) / stoneW)
        const colNext = Math.floor((wx + 1 / Math.max(0.02, s) + (row % 2) * stoneW * 0.5) / stoneW)
        let c: string
        if (joint || col !== colNext) c = DUSK.stoneTop
        else {
          const n = hash2(col, row, 17)
          c = n > 0.82 ? DUSK.stoneL : n < 0.22 ? DUSK.stoneD : DUSK.stone
          // A few chips and moss pixels up close.
          if (s > 0.45 && hash2(x, y, 5) > 0.992) c = DUSK.canopyL
        }
        // The launch rail: rose path between the rails.
        const ax = Math.abs(wx)
        if (ax < railHalf) {
          c = joint ? DUSK.pathD : hash2(Math.floor(wx / 4), row, 9) > 0.85 ? DUSK.pathL : DUSK.path
        } else if (ax < railHalf + 2.5) {
          c = INK
        } else if (ax < railHalf + 5) {
          c = DUSK.stoneL
        }
        rect(g, c, x, y)
      }
    }
  }

  function paintFrame(g: G, w: number, h: number) {
    // Lintel across the top.
    stoneBlock(g, 0, 0, w, lintel, 31)
    rect(g, INK, 0, lintel, w, 1)
    neon.push({ x: pillar, y: lintel - 2, w: w - pillar * 2, h: 1, color: DUSK.neon })
    rect(g, DUSK.neon, pillar, lintel - 2, w - pillar * 2, 1)
    // Two pillars.
    for (const side of [0, 1]) {
      const x = side ? w - pillar : 0
      stoneBlock(g, x, 0, pillar, h, 37 + side)
      rect(g, INK, side ? x - 1 : x + pillar, lintel, 1, h - lintel)
      // Cyan neon down the inner face.
      const nx = side ? x + 1 : x + pillar - 2
      rect(g, DUSK.neonC, nx, lintel + 2, 1, h - lintel - 2)
      neon.push({ x: nx, y: lintel + 2, w: 1, h: h - lintel - 2, color: DUSK.neonC })
      // A brazier on a ledge at two-thirds height.
      const by = Math.round(horizon + (h - horizon) * 0.25)
      const bx = side ? x + 2 : x + pillar - 7
      rect(g, INK, bx - 1, by, 7, 4)
      rect(g, DUSK.stoneD, bx, by + 1, 5, 2)
      rect(g, '#5b2a1c', bx + 1, by - 1, 3, 1)
      braziers.push({ x: bx + 2.5, y: by - 3 })
    }
    // Lamps hanging from the lintel.
    const n = W > 200 ? 4 : 3
    for (let i = 0; i < n; i++) {
      const lx = Math.round(pillar + (W - pillar * 2) * ((i + 0.5) / n))
      const len = 3 + (i % 2) * 3
      rect(g, INK, lx, lintel, 1, len)
      rect(g, INK, lx - 2, lintel + len, 5, 3)
      rect(g, DUSK.window, lx - 1, lintel + len + 1, 3, 2)
      rect(g, '#fff1b0', lx, lintel + len + 1, 1, 1)
      lamps.push({ x: lx + 0.5, y: lintel + len + 2 })
    }
  }

  /** Shrine stone: violet blocks in courses, lit top-left, dark joints. */
  function stoneBlock(g: G, x0: number, y0: number, w: number, h: number, salt: number) {
    rect(g, DUSK.stone, x0, y0, w, h)
    const bh = 6
    for (let y = y0; y < y0 + h; y += bh) {
      const course = Math.floor((y - y0) / bh)
      const off = (course % 2) * 5
      for (let x = x0 - off; x < x0 + w; x += 10) {
        const n = hash2(Math.floor((x - x0) / 10), course, salt)
        const c = n > 0.8 ? DUSK.stoneL : n < 0.25 ? DUSK.stoneD : DUSK.stone
        const bx = Math.max(x0, x)
        const bw = Math.min(x0 + w, x + 10) - bx
        if (bw <= 0) continue
        rect(g, c, bx, y, bw, Math.min(bh, y0 + h - y))
        rect(g, DUSK.stoneL, bx, y, bw, 1)
        rect(g, DUSK.stoneTop, bx, y + bh - 1, bw, 1)
        if (x >= x0) rect(g, DUSK.stoneTop, x, y, 1, bh)
      }
    }
  }

  function draw(stage: PixelStage, time: number) {
    const g = stage.g
    if (!back || !front || !sunLayer) return
    g.drawImage(back, 0, 0)
    drawStars(g, W, horizon - Math.round(H * 0.12), time, 0.9, 23)
    g.drawImage(sunLayer, 0, 0)
    stage.emitImage(sunLayer)
    g.drawImage(front, 0, 0)
    stage.light(sun.x, sun.y, sun.r * 2.2, '#ff8a3d', 0.28)

    // Running lights: pairs of dots chasing out along both rails.
    const N = 7
    for (let i = 0; i < N; i++) {
      const phase = (i / N + time * 0.22) % 1
      // Evenly spaced in depth, so they bunch towards the horizon.
      const z = 1 + phase * 9
      const s = 1 / z
      const y = Math.round(horizon + s * (H - horizon))
      if (y <= deckTop + 1) continue
      const r = Math.max(1, Math.round(2 * s))
      const lead = i === Math.floor(((time * 0.22) % 1) * N) // brightest one
      const col = lead ? DUSK.window : '#2ff3ff'
      for (const side of [-1, 1]) {
        const x = Math.round(cx + side * (railHalf + 1.5) * s)
        rect(g, col, x - (r >> 1), y - (r >> 1), r, r)
        stage.emit(x - (r >> 1), y - (r >> 1), r, r)
        stage.light(x, y, 3 + 10 * s, col, 0.55 + 0.3 * s)
      }
    }

    // Lamps, braziers (flickering), neon strips.
    for (const l of lamps) stage.light(l.x, l.y + 4, 26, '#ffd23f', 0.5)
    braziers.forEach((b, i) => {
      const f = 0.5 + 0.5 * Math.sin(time * 9 + i * 2.1) * Math.sin(time * 5.3 + i)
      const fy = Math.round(b.y - f)
      rect(g, '#ff8a3d', Math.round(b.x) - 1, fy + 1, 3, 2)
      rect(g, '#ffd23f', Math.round(b.x), fy, 1, 2)
      if (f > 0.6) rect(g, '#fff1b0', Math.round(b.x), fy - 1, 1, 1)
      stage.emit(Math.round(b.x) - 1, fy - 1, 3, 4)
      stage.light(b.x, b.y, 22 + f * 4, '#ff8a3d', 0.6 + f * 0.15)
    })
    for (const n of neon) {
      stage.emit(n.x, n.y, n.w, n.h)
      if (n.h > n.w) for (let y = n.y + 8; y < n.y + n.h; y += 22) stage.light(n.x, y, 12, n.color, 0.3)
      else for (let x = n.x + 10; x < n.x + n.w; x += 30) stage.light(x, n.y, 12, n.color, 0.3)
    }
  }

  return { layout, draw }
}

/** Colour the ship viewer's quantized 3D is lit with, and its lights. */
export const VIEWER_AMBIENT = '#c9bde6'
