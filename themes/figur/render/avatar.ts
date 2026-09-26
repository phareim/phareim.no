/**
 * Avatar World: chibi with a big head and BIG shiny eyes (a coloured
 * iris, a dark pupil, two white highlights, lashes on top and a flick at
 * the corner), brows, a small smiling mouth, glossy hair with a light
 * streak and strands, a soft plum outline around every part and a gentle
 * top light, a slim slightly curvy body. Skirts and dresses flare; wings
 * spread wide. A dreamy lilac-to-pink sky with twinkling stars and
 * hearts, and a little cloud to stand on.
 */
import type { FigureBody, FigureStyle, Hex, PixelBuffer } from '../types'
import { mix, shade, tint } from '../core/color'
import { cellNoise } from '../core/pixelart'
import { faceColors, hairAt, Lru, skinOf, starColor } from './common'
import { chibiFrame, type Chibi, type ChibiSpec } from './chibi'
import { fillEllipse, makeBuffer, set, get } from './pixels'
import type { HeadGeom } from './roundhair'

const SIZE = { w: 60, h: 84 }
const FLOOR = 78

// ---------------------------------------------------------------- eyes

const STAR7 = ['...X...', '...X...', '.XXXXX.', 'XXXXXXX', '.XXXXX.', '.XX.XX.', 'X.....X']

/** One big eye in a 7 × 8 box at (x0, y0). `left`: the viewer's left eye (its flick points left). */
function eye(b: PixelBuffer, body: FigureBody, x0: number, y0: number, left: boolean, kind: string): void {
  const fc = faceColors(body)
  const ink = '#2d1838'
  const iris = body.eyeColor
  const cx = x0 + 3.5, cy = y0 + 4
  const outer = left ? x0 - 1 : x0 + 7
  const lashes = (y: number) => {
    // The top line of the eye, thick, with a flick at the outer corner.
    for (let x = x0; x < x0 + 7; x++) {
      let top = -1
      for (let yy = y0; yy < y0 + 8; yy++) if (get(b, x, yy) === fc.white || get(b, x, yy) === ink) { top = yy; break }
      if (top >= 0) set(b, x, Math.min(top, y), ink)
    }
    set(b, outer, y0 + 1, ink); set(b, left ? outer - 1 : outer + 1, y0, ink)
  }
  const arc = (down: boolean) => {
    // Closed eye: a curved lash line (down: resting ∪, up: smiling ∩).
    for (let i = 0; i < 7; i++) {
      const d = Math.abs(i - 3)
      const y = down ? y0 + 4 + (d < 2 ? 1 : d < 3 ? 0 : -1) : y0 + 4 - (d < 2 ? 1 : d < 3 ? 0 : -1)
      set(b, x0 + i, y, ink)
      if (d < 3) set(b, x0 + i, y + (down ? -1 : 1), mix(ink, fc.cheek, 0.5))
    }
    set(b, outer, down ? y0 + 3 : y0 + 5, ink)
  }
  if (kind === 'closed') { arc(true); return }
  if (kind === 'happy') { arc(false); return }

  fillEllipse(b, cx, cy, 3.5, 4, fc.white)
  if (kind === 'star') {
    const st = starColor(iris)
    STAR7.forEach((r, dy) => { for (let dx = 0; dx < 7; dx++) if (r[dx] === 'X') set(b, x0 + dx, y0 + 1 + dy, st) })
    set(b, x0 + 3, y0 + 4, '#ffffff'); set(b, x0 + 2, y0 + 3, tint(st, 0.6)); set(b, x0 + 3, y0 + 3, shade(st, 0.15))
    lashes(y0)
    return
  }
  fillEllipse(b, cx, cy + 0.2, 3.2, 3.9, shade(iris, 0.2))
  fillEllipse(b, cx, cy + 1, 2.7, 2.9, iris)
  fillEllipse(b, cx, cy + 2.2, 1.9, 1.4, tint(iris, 0.35))
  fillEllipse(b, cx, cy + 0.4, 1.4, 2, '#1e1028')
  // Highlights: a big one up left, a small one down right.
  set(b, x0 + 2, y0 + 2, '#ffffff'); set(b, x0 + 3, y0 + 2, '#ffffff'); set(b, x0 + 2, y0 + 3, '#ffffff'); set(b, x0 + 3, y0 + 3, '#ffffff')
  set(b, x0 + 5, y0 + 6, '#ffffff')
  if (kind === 'sparkle') {
    set(b, x0 + 1, y0 + 5, '#ffffff'); set(b, x0 + 4, y0 + 1, '#ffffff'); set(b, x0 + 5, y0 + 5, tint(iris, 0.8))
    set(b, x0 + 4, y0 + 5, '#fff6b0')
  }
  if (kind === 'sleepy') {
    // Heavy lids: the top half is skin, the lash line runs across the middle.
    for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 7; x++) if (get(b, x, y)) set(b, x, y, mix(skinOf(body).c, skinOf(body).s, 0.45))
    for (let x = x0; x < x0 + 7; x++) set(b, x, y0 + 4, ink)
    set(b, outer, y0 + 4, ink)
    return
  }
  lashes(y0)
}

function face(b: PixelBuffer, body: FigureBody, g: HeadGeom, blink: boolean): void {
  const fc = faceColors(body)
  const cx = g.cx
  const ey = Math.round(g.cy - 2)
  const lx = cx - 10, rx = cx + 3
  const kinds: [string, string] = blink ? ['closed', 'closed']
    : body.eyes === 'wink' ? ['round', 'happy'] : body.eyes === 'round' ? ['round', 'round'] : [body.eyes, body.eyes]
  eye(b, body, lx, ey, true, kinds[0])
  eye(b, body, rx, ey, false, kinds[1])
  // Brows in a deep hair colour.
  const brow = body.hair === 'none' ? shade(fc.freckle, 0.2) : shade(hairAt(body, 0.1), 0.35)
  for (const [x0, dir] of [[lx, 1], [rx, -1]] as const) {
    for (let i = 1; i < 6; i++) set(b, x0 + i, ey - 3 + (i === (dir > 0 ? 1 : 5) ? 1 : 0), brow)
  }
  // Nose, cheeks, freckles.
  set(b, cx - 1, ey + 9, shade(skinOf(body).s, 0.1))
  if (body.cheeks) for (const s of [-1, 1]) {
    fillEllipse(b, cx + s * 10, ey + 9, 2.6, 1.4, fc.cheek)
    set(b, cx + s * 10 - (s < 0 ? 1 : 0) + s, ey + 8, tint(fc.cheek, 0.5))
  }
  if (body.freckles) for (const s of [-1, 1]) for (const [dx, dy] of [[5, 9], [7, 10], [6, 11]]) set(b, cx + s * dx! - (s < 0 ? 1 : 0), ey + dy!, fc.freckle)

  const my = ey + 11
  const lip = mix(fc.mouth, '#e0507a', 0.35)
  switch (body.mouth) {
    case 'smile':
      set(b, cx - 3, my, lip); set(b, cx + 2, my, lip)
      for (let x = cx - 2; x <= cx + 1; x++) set(b, x, my + 1, lip)
      break
    case 'grin':
      for (let x = cx - 3; x <= cx + 2; x++) set(b, x, my, lip)
      for (let x = cx - 2; x <= cx + 1; x++) { set(b, x, my + 1, fc.white); set(b, x, my + 2, fc.inside) }
      set(b, cx - 3, my + 1, lip); set(b, cx + 2, my + 1, lip)
      set(b, cx - 2, my + 3, lip); set(b, cx - 1, my + 3, fc.tongue); set(b, cx, my + 3, fc.tongue); set(b, cx + 1, my + 3, lip)
      break
    case 'open':
      fillEllipse(b, cx, my + 1.5, 1.7, 2, lip)
      set(b, cx - 1, my + 1, fc.inside); set(b, cx, my + 1, fc.inside); set(b, cx - 1, my + 2, fc.tongue); set(b, cx, my + 2, fc.tongue)
      break
    case 'tongue':
      set(b, cx - 3, my, lip); set(b, cx + 2, my, lip)
      for (let x = cx - 2; x <= cx + 1; x++) set(b, x, my + 1, lip)
      set(b, cx, my + 2, fc.tongue); set(b, cx + 1, my + 2, fc.tongue); set(b, cx, my + 3, fc.tongue); set(b, cx + 1, my + 3, shade(fc.tongue, 0.15))
      break
    case 'small':
      set(b, cx - 1, my + 1, lip); set(b, cx, my + 1, lip)
      break
  }
}

// ---------------------------------------------------------------- spec

const spec: ChibiSpec = {
  size: SIZE,
  floor: FLOOR,
  head: { rx: 15.5, ry: 14, chin: 0.3 },
  neck: { w: 4, h: 3 },
  torso: [10, 12, 12, 12, 12, 10, 10, 10, 10, 10, 12, 12, 12, 12],
  topRows: 10,
  arm: { w: 3, len: 12, gap: 1, hand: 4, splay: 1 },
  leg: { w: 4, len: 15, gap: 2 },
  foot: { w: 5, h: 3, out: 1 },
  flare: 6,
  skirtLen: 12,
  wings: 2.7,
  cape: 1.8,
  outline: 'parts',
  ink: c => mix(shade(c, 0.5), '#4a2a5e', 0.45),
  light: { top: 1, topF: 0.22, bottom: 2, bottomF: 0.14, right: 1, rightF: 0.1 },
  gloss: true,
  face,
  glasses: g => ({ x: Math.round(g.cx - 12), y: Math.round(g.cy - 3), w: 24, h: 10 }),
}

// ---------------------------------------------------------------- sky

const SKY: Hex[] = ['#cdb6ff', '#d6b8fb', '#dfbaf6', '#e8bdf1', '#f0bfec', '#f7c2e7', '#ffc6e3']
const skies = new Lru<PixelBuffer>(6)
const HEART = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..']

function sky(w: number, h: number, ox: number, oy: number): PixelBuffer {
  const key = `${w}x${h}`
  const hit = skies.get(key)
  if (hit) return hit
  const b = makeBuffer(w, h)
  for (let y = 0; y < h; y++) {
    const v = (y / h) * (SKY.length - 1)
    const i = Math.floor(v), f = v - i
    for (let x = 0; x < w; x++) {
      // An ordered dither between two bands, so the gradient stays pixel-clean.
      const d = ((x & 1) * 2 + (y & 1) * 3) % 4 / 4 + 0.125
      set(b, x, y, SKY[Math.min(SKY.length - 1, f > d ? i + 1 : i)]!)
    }
  }
  // The little cloud to stand on.
  const cx = ox + SIZE.w / 2, fy = oy + FLOOR
  for (const [dx, dy, rx, ry] of [[0, 2, 22, 4.5], [-13, 0.5, 8, 4], [12, 0.5, 9, 4.2], [-2, 0, 10, 4]]) fillEllipse(b, cx + dx!, fy + dy!, rx!, ry!, '#fff4fc')
  fillEllipse(b, cx, fy + 4.5, 20, 2.5, '#f6d6f0')
  fillEllipse(b, cx, fy + 0.5, 11, 1.8, '#f3cde9')
  return skies.set(key, b)
}

function backdrop(b: PixelBuffer, o: { x: number; y: number }, t: number): void {
  const s = sky(b.w, b.h, o.x, o.y)
  for (let i = 0; i < b.px.length; i++) b.px[i] = s.px[i]!
  // Stars and hearts on a fixed grid, each twinkling in its own rhythm.
  for (let gy = 0; gy < Math.ceil(b.h / 12); gy++) for (let gx = 0; gx < Math.ceil(b.w / 12); gx++) {
    const n = cellNoise(gx + 3, gy + 11)
    const x = gx * 12 + Math.floor(cellNoise(gx, gy) * 10) + 1
    const y = gy * 12 + Math.floor(cellNoise(gy, gx + 5) * 10) + 1
    if (y > o.y + FLOOR - 4 && Math.abs(x - (o.x + SIZE.w / 2)) < 26) continue
    const phase = Math.sin(t * (1.5 + n * 2) + n * 20)
    if (n < 0.28) {
      const c = n < 0.14 ? '#ff9fd2' : '#ffffff'
      HEART.forEach((r, dy) => { for (let dx = 0; dx < 5; dx++) if (r[dx] === 'X') set(b, x + dx - 2, y + dy - 2, phase > -0.2 ? c : tint(c, 0.4)) })
    } else if (n < 0.75) {
      const on = phase > 0
      set(b, x, y, '#ffffff')
      const arm = on ? '#fff7c9' : '#f4e3ff'
      set(b, x - 1, y, arm); set(b, x + 1, y, arm); set(b, x, y - 1, arm); set(b, x, y + 1, arm)
      if (on && n > 0.55) { set(b, x - 2, y, '#fff2fb'); set(b, x + 2, y, '#fff2fb'); set(b, x, y - 2, '#fff2fb'); set(b, x, y + 2, '#fff2fb') }
    } else if (phase > 0.3) {
      set(b, x, y, '#ffffff')
    }
  }
}

const cache = new Lru<Chibi>(16)
const look = { spec, cache, backdrop, sparkle: 'heart' as const, sparkleColors: ['#ff6fb5', '#ffffff', '#ffd6f0', '#c79bff'] }

export const avatar: FigureStyle = {
  id: 'avatar',
  label: 'AVATAR WORLD',
  short: 'AVATAR',
  bg: '#e9c0f2',
  size: SIZE,
  draw: f => chibiFrame(look, f),
}
