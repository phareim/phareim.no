/**
 * SPACE PADDLE — THE ODYSSEY, on Neon Shrine's pixel stage (themes/base/pixel).
 * The look is 1980s synthwave in space: a striped sun over a violet sky, a
 * perspective grid floor that scrolls towards you, neon walls, bricks of
 * sunset-coloured crystal and chrome stone, a pulsing brick that is open or
 * shut, a ringed planet, coloured power-up capsules. Everything is drawn in
 * logical pixels; `Breakout.vue` keeps the rules in CSS pixels and converts.
 */
import { makeCanvas, type PixelStage } from '../base/pixel/stage'
import { drawText, mix, sprite } from '../base/pixel/sprites'
import { drawStars, ditherGradient, paintSun, rect } from '../base/pixel/scenery'

type G = CanvasRenderingContext2D

/** The Odyssey's colours. Row colours come from the rules (`ROW_COLORS`). */
export const SYN = {
  void: '#05030c',
  sky0: '#05030c', sky1: '#120628', sky2: '#2a0b4a', sky3: '#4a0f5e', sky4: '#7a1a6a',
  floor: '#1a0830', grid: '#ff2fa0', gridFar: '#7a2a9a',
  neon: '#ff2fa0', cyan: '#2ff3ff', gold: '#ffd23f', ink: '#0b0616',
  chrome: '#8a84b8', chromeD: '#3b3566', chromeL: '#d8d2ff',
}

// ---------------------------------------------------------------- bricks

const brickCache = new Map<string, HTMLCanvasElement>()

/**
 * A brick w×h logical pixels. 'crystal' is one hit: a coloured gem.
 * 'stone' is chrome, `dmg` hits taken so far add cracks. 'pulse' is cyan
 * and lit when `open`, dark with a cyan outline when shut.
 */
export function brickCanvas(w: number, h: number, kind: 'crystal' | 'stone' | 'pulse', color: string, dmg: number, open: boolean): HTMLCanvasElement {
  w = Math.max(4, w)
  h = Math.max(3, h)
  const key = `${w}x${h}:${kind}:${color}:${dmg}:${open ? 1 : 0}`
  let c = brickCache.get(key)
  if (c) return c
  c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  rect(g, SYN.ink, 0, 0, w, h)
  if (kind === 'crystal') {
    const hi = mix(color, '#ffffff', 0.5)
    const lo = mix(color, SYN.ink, 0.45)
    rect(g, color, 1, 1, w - 2, h - 2)
    rect(g, hi, 1, 1, w - 2, 1)
    rect(g, hi, 1, 1, 1, h - 2)
    rect(g, lo, 1, h - 2, w - 2, 1)
    rect(g, lo, w - 2, 1, 1, h - 2)
    // A facet: the right part of the gem is in shade.
    const cut = Math.round(w * 0.6)
    rect(g, lo, cut, 2, w - 3 - cut, h - 4)
    rect(g, '#fff4ff', 2, 2, 1, 1)
  } else if (kind === 'stone') {
    rect(g, SYN.chrome, 1, 1, w - 2, h - 2)
    rect(g, SYN.chromeL, 1, 1, w - 2, 1)
    rect(g, SYN.chromeD, 1, h - 2, w - 2, 1)
    rect(g, SYN.chromeD, w - 2, 1, 1, h - 2)
    // A neon strip across the middle, in the row's colour.
    const sy = Math.max(2, Math.floor(h / 2))
    rect(g, color, 2, sy, w - 4, 1)
    // Each hit taken leaves a crack.
    for (let i = 0; i < dmg; i++) {
      let x = Math.round(w * (0.3 + 0.25 * i))
      for (let y = 2; y < h - 2; y++) {
        rect(g, SYN.ink, x, y)
        if (y % 2 === 0) x += 1
      }
    }
  } else if (open) {
    rect(g, SYN.cyan, 1, 1, w - 2, h - 2)
    rect(g, '#dffdff', 1, 1, w - 2, 1)
    rect(g, '#1a9fc4', 1, h - 2, w - 2, 1)
  } else {
    // Shut: a dark body with a dotted cyan outline.
    rect(g, '#1a1030', 1, 1, w - 2, h - 2)
    for (let x = 1; x < w - 1; x += 2) {
      rect(g, SYN.cyan, x, 1)
      rect(g, SYN.cyan, x, h - 2)
    }
  }
  brickCache.set(key, c)
  if (brickCache.size > 300) brickCache.clear()
  return c
}

// ---------------------------------------------------------------- paddle, orb, capsule, bolt

const paddleCache = new Map<string, HTMLCanvasElement>()

/** The shield bar, w×h logical: outline, cyan body, lit top edge, a gold gem. */
export function paddleCanvas(w: number, h: number, flash: boolean): HTMLCanvasElement {
  w = Math.max(6, w)
  h = Math.max(3, h)
  const key = `${w}x${h}:${flash ? 1 : 0}`
  let c = paddleCache.get(key)
  if (c) return c
  c = makeCanvas(w, h + 1)
  const g = c.getContext('2d')!
  const body = flash ? '#c8fbff' : SYN.cyan
  rect(g, SYN.ink, 1, 0, w - 2, h)
  rect(g, SYN.ink, 0, 1, w, h - 2)
  rect(g, body, 1, 1, w - 2, h - 2)
  rect(g, '#1a9fc4', 1, h - 2, w - 2, 1)
  rect(g, '#fff4ff', 2, 1, w - 4, 1)
  rect(g, '#1a9fc4', 1, 2, 1, h - 4)
  rect(g, '#1a9fc4', w - 2, 2, 1, h - 4)
  const m = Math.floor(w / 2)
  rect(g, SYN.gold, m - 1, Math.max(1, Math.floor(h / 2) - 1), 3, Math.min(2, h - 2))
  rect(g, '#fff1b0', m - 1, Math.max(1, Math.floor(h / 2) - 1), 1, 1)
  rect(g, 'rgba(5,3,12,0.5)', 2, h, w - 4, 1)
  paddleCache.set(key, c)
  if (paddleCache.size > 200) paddleCache.clear()
  return c
}

/** The orb: a lit ball with a white core (5×5, 7×7 on big pixels' behalf). */
export const ORB = [
  '.ccc.',
  'cwwcc',
  'cwccc',
  'ccccC',
  '.cCC.',
]
export const ORB_BIG = [
  '..ccc..',
  '.cwwcc.',
  'cwwcccc',
  'cwccccc',
  'cccccCC',
  '.ccccC.',
  '..cCC..',
]
export function orbCanvas(big: boolean): HTMLCanvasElement {
  return sprite(big ? ORB_BIG : ORB, { c: '#9ff9ff', C: SYN.cyan, w: '#ffffff' })
}

const capsuleCache = new Map<string, HTMLCanvasElement>()
/** A power-up capsule in its colour, with its letter in the 5×7 font. */
export function capsuleCanvas(label: string, color: string): HTMLCanvasElement {
  const key = `${label}:${color}`
  let c = capsuleCache.get(key)
  if (c) return c
  c = makeCanvas(13, 11)
  const g = c.getContext('2d')!
  rect(g, SYN.ink, 1, 0, 11, 11)
  rect(g, SYN.ink, 0, 1, 13, 9)
  rect(g, color, 1, 1, 11, 9)
  rect(g, mix(color, '#ffffff', 0.6), 2, 1, 9, 1)
  rect(g, mix(color, SYN.ink, 0.4), 1, 9, 11, 1)
  rect(g, mix(color, SYN.ink, 0.4), 11, 2, 1, 7)
  drawText(g, label, 4, 2, SYN.ink)
  capsuleCache.set(key, c)
  return c
}

/** A pixel laser bolt, 1×4 with a bright tip. */
export function boltCanvas(): HTMLCanvasElement {
  const c = makeCanvas(1, 4)
  const g = c.getContext('2d')!
  rect(g, SYN.gold, 0, 0, 1, 3)
  rect(g, '#ffffff', 0, 0, 1, 1)
  return c
}

/** A pixel ring (midpoint circle). */
export function ring(g: G, cx: number, cy: number, r: number, color: string) {
  cx = Math.round(cx)
  cy = Math.round(cy)
  r = Math.round(r)
  if (r <= 0) return
  g.fillStyle = color
  let x = r
  let y = 0
  let err = 1 - r
  while (x >= y) {
    g.fillRect(cx + x, cy + y, 1, 1); g.fillRect(cx - x, cy + y, 1, 1)
    g.fillRect(cx + x, cy - y, 1, 1); g.fillRect(cx - x, cy - y, 1, 1)
    g.fillRect(cx + y, cy + x, 1, 1); g.fillRect(cx - y, cy + x, 1, 1)
    g.fillRect(cx + y, cy - x, 1, 1); g.fillRect(cx - y, cy - x, 1, 1)
    y++
    if (err < 0) err += 2 * y + 1
    else { x--; err += 2 * (y - x) + 1 }
  }
}

// ---------------------------------------------------------------- the planet

const planetCache = new Map<number, HTMLCanvasElement>()

/**
 * A ringed planet of radius r logical pixels, banded magenta and violet, with
 * a gold ring. The front of the ring crosses the disc; the back hides behind it.
 */
export function planetCanvas(r: number): HTMLCanvasElement {
  r = Math.max(4, Math.round(r))
  let c = planetCache.get(r)
  if (c) return c
  const S = Math.round(r * 5)
  c = makeCanvas(S, S)
  const g = c.getContext('2d')!
  const cx = S / 2
  const cy = S / 2
  const ringA = r * 2.1
  const ringB = r * 0.42
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - cx
      const dy = y + 0.5 - cy
      const inDisc = dx * dx + dy * dy <= r * r
      if (inDisc) {
        const band = Math.floor((dy + r) / Math.max(2, r * 0.22)) % 2 === 0
        const shade = dx < -r * 0.45 ? mix(band ? '#ff2fa0' : '#9a4ff0', '#ffffff', 0.25) : band ? '#ff2fa0' : '#9a4ff0'
        const dark = dx > r * 0.5 ? mix(shade, SYN.ink, 0.35) : shade
        g.fillStyle = dark
        g.fillRect(x, y, 1, 1)
        continue
      }
      // The ring: an ellipse, drawn only where it is outside the disc.
      const e = (dx * dx) / (ringA * ringA) + (dy * dy) / (ringB * ringB)
      if (e > 0.9 && e < 1.1) {
        g.fillStyle = dy > 0 ? SYN.gold : '#b8861c'
        g.fillRect(x, y, 1, 1)
      }
    }
  }
  planetCache.set(r, c)
  return c
}

// ---------------------------------------------------------------- the odyssey: sky, sun, grid

export interface Odyssey {
  /** Repaint the static parts for a logical size. The horizon is a logical row. */
  layout(w: number, h: number, horizon: number): void
  /** The sky, the sun, the grid and the neon walls, lit. `time` in seconds. */
  drawBack(g: G, stage: PixelStage, time: number, reduced: boolean): void
}

export function createOdyssey(): Odyssey {
  let back: HTMLCanvasElement | null = null
  let W = 0
  let H = 0
  let hz = 0

  function layout(w: number, h: number, horizon: number) {
    W = w
    H = h
    hz = Math.round(horizon)
    back = makeCanvas(w, h)
    const g = back.getContext('2d')!
    rect(g, SYN.void, 0, 0, w, h)
    ditherGradient(g, 0, 0, w, hz, [SYN.sky0, SYN.sky1, SYN.sky2, SYN.sky3, SYN.sky4])
    rect(g, SYN.floor, 0, hz, w, h - hz)
    // The sun sits on the horizon, half in the sky.
    paintSun(g, w / 2, hz, Math.min(w * 0.2, 64))
    // Perspective grid: receding lines from the vanishing point, drawn once.
    for (let i = -8; i <= 8; i++) {
      const bottomX = w / 2 + i * (w / 8)
      for (let y = hz; y < h; y++) {
        const t = (y - hz) / Math.max(1, h - hz)
        const x = Math.round(w / 2 + (bottomX - w / 2) * t)
        rect(g, SYN.gridFar, x, y)
      }
    }
    // Neon walls at both edges.
    rect(g, SYN.neon, 0, 0, 1, h)
    rect(g, SYN.neon, w - 1, 0, 1, h)
  }

  function drawBack(g: G, stage: PixelStage, time: number, reduced: boolean) {
    if (back) g.drawImage(back, 0, 0)
    drawStars(g, W, hz, time, 1, 11)
    // The sun and the horizon glow over the whole field.
    stage.light(W / 2, hz, W * 0.35, '#ff8a3d', 0.4)
    stage.light(W / 2, H, W * 0.6, SYN.neon, 0.3)
    // Horizontal grid lines scroll towards the viewer, closer together far away.
    const phase = reduced ? 0 : (time * 0.7) % 1
    for (let k = 0; k < 12; k++) {
      const f = (k + phase) / 12
      const y = Math.round(hz + (H - hz) * f * f)
      if (y <= hz || y >= H) continue
      rect(g, SYN.grid, 0, y, W, 1)
      stage.emit(0, y, W, 1)
    }
  }

  return { layout, drawBack }
}
