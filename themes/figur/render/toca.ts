/**
 * Toca Boca: stubby and chunky. A big round head a little wider than
 * tall, a short wide body about one head tall, short thick limbs with
 * round hands and feet, big flat two-tone hair, tiny dot eyes set wide, a
 * small nose line, rosy cheeks. Flat colour, no shading, no dark outline:
 * only a same-hue darker edge. Skirts and dresses flare. A pastel room:
 * a striped wall, a window with a cloud, a plant, a wooden floor and a
 * round rug under the figure.
 */
import type { FigureBody, FigureStyle, Hex, PixelBuffer } from '../types'
import { mix, shade, tint } from '../core/color'
import { faceColors, Lru, skinOf, starColor } from './common'
import { chibiFrame, type Chibi, type ChibiSpec } from './chibi'
import { fillEllipse, fillRect, fillRoundRect, line, makeBuffer, set } from './pixels'
import type { HeadGeom } from './roundhair'

const SIZE = { w: 60, h: 84 }
const FLOOR = 78

// ---------------------------------------------------------------- face

const STAR5 = ['..X..', '.XXX.', 'XXXXX', '.XXX.', '.X.X.']

function face(b: PixelBuffer, body: FigureBody, g: HeadGeom, blink: boolean): void {
  const fc = faceColors(body)
  const cx = g.cx
  const ey = Math.round(g.cy + 2)
  const dot = mix(body.eyeColor, '#140c1c', 0.62)
  const eyes = [cx - 10, cx + 10] // boundaries: each eye covers the two pixels around it
  const arcUp = (e: number, c: Hex) => { set(b, e - 2, ey + 1, c); set(b, e - 1, ey, c); set(b, e, ey, c); set(b, e + 1, ey + 1, c) }
  const arcDown = (e: number, c: Hex) => { set(b, e - 2, ey, c); set(b, e - 1, ey + 1, c); set(b, e, ey + 1, c); set(b, e + 1, ey, c) }
  const round = (e: number) => fillEllipse(b, e, ey + 0.5, 1.1, 1.3, dot)
  eyes.forEach((e, i) => {
    if (blink) { arcDown(e, fc.ink); return }
    switch (body.eyes) {
      case 'round': round(e); break
      case 'happy': arcUp(e, fc.ink); break
      case 'sparkle':
        fillEllipse(b, e, ey + 0.5, 1.8, 2.3, dot)
        set(b, e - 1, ey + 1, mix(body.eyeColor, dot, 0.2)); set(b, e, ey + 1, mix(body.eyeColor, dot, 0.2))
        set(b, e - 1, ey - 1, fc.white); set(b, e, ey + 1, tint(body.eyeColor, 0.5))
        break
      case 'sleepy':
        for (let x = e - 2; x <= e + 1; x++) set(b, x, ey, fc.ink)
        set(b, e - 1, ey + 1, dot); set(b, e, ey + 1, dot)
        break
      case 'wink':
        if (i === 0) round(e); else arcUp(e, fc.ink)
        break
      case 'star':
        STAR5.forEach((r, dy) => { for (let dx = 0; dx < 5; dx++) if (r[dx] === 'X') set(b, e - 3 + dx, ey - 2 + dy, starColor(body.eyeColor)) })
        set(b, e - 1, ey, '#ffffff')
        break
    }
  })
  // A small nose.
  // A small nose line.
  const nose = shade(skinOf(body).s, 0.05)
  set(b, cx - 1, ey + 3, nose); set(b, cx, ey + 3, nose)
  if (body.cheeks) for (const s of [-1, 1]) fillEllipse(b, cx + s * 13, ey + 3.5, 3, 1.8, fc.cheek)
  if (body.freckles) for (const s of [-1, 1]) for (const [dx, dy] of [[6, 2], [8, 3], [6, 4], [10, 2]]) set(b, cx + s * dx! - (s < 0 ? 1 : 0), ey + dy!, fc.freckle)

  const my = ey + 6
  const m = fc.mouth
  switch (body.mouth) {
    case 'smile':
      set(b, cx - 3, my, m); set(b, cx + 2, my, m)
      for (let x = cx - 2; x <= cx + 1; x++) set(b, x, my + 1, m)
      break
    case 'grin':
      for (let x = cx - 3; x <= cx + 2; x++) set(b, x, my, m)
      for (let x = cx - 2; x <= cx + 1; x++) { set(b, x, my, fc.white); set(b, x, my + 1, fc.inside) }
      set(b, cx - 3, my, m); set(b, cx + 2, my, m); set(b, cx - 2, my + 1, m); set(b, cx + 1, my + 1, m)
      set(b, cx - 1, my + 2, m); set(b, cx, my + 2, m)
      break
    case 'open':
      fillEllipse(b, cx, my + 1, 1.6, 1.8, m)
      set(b, cx - 1, my + 1, fc.inside); set(b, cx, my + 1, fc.inside)
      break
    case 'tongue':
      set(b, cx - 3, my, m); set(b, cx + 2, my, m)
      for (let x = cx - 2; x <= cx + 1; x++) set(b, x, my + 1, m)
      set(b, cx - 1, my + 2, fc.tongue); set(b, cx, my + 2, fc.tongue); set(b, cx, my + 1, fc.tongue)
      break
    case 'small':
      set(b, cx - 1, my + 1, m); set(b, cx, my + 1, m)
      break
  }
}

// ---------------------------------------------------------------- spec

const spec: ChibiSpec = {
  size: SIZE,
  floor: FLOOR,
  head: { rx: 19.5, ry: 17, chin: 0.04 },
  neck: { w: 6, h: 1 },
  torso: [16, 18, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 18],
  topRows: 13,
  arm: { w: 5, len: 12, gap: 1, hand: 6, splay: 1 },
  leg: { w: 6, len: 10, gap: 2 },
  foot: { w: 8, h: 4, out: 1 },
  flare: 6,
  skirtLen: 10,
  wings: 2.6,
  wingsLift: 0.18,
  outline: 'silhouette',
  ink: c => shade(c, 0.22),
  light: null,
  gloss: false,
  face,
  glasses: g => ({ x: Math.round(g.cx - 15), y: Math.round(g.cy - 1), w: 30, h: 7 }),
}

// ---------------------------------------------------------------- room

const WALL = '#ffd9e2'
const rooms = new Lru<PixelBuffer>(6)

function room(w: number, h: number, ox: number, oy: number): PixelBuffer {
  const key = `${w}x${h}`
  const hit = rooms.get(key)
  if (hit) return hit
  const b = makeBuffer(w, h, WALL)
  const floorTop = oy + FLOOR - 12
  for (let x = 0; x < w; x++) if (((x - ox) % 8 + 8) % 8 < 3) for (let y = 0; y < floorTop; y++) set(b, x, y, '#ffcfdb')
  // Skirting board and a wooden floor.
  fillRect(b, 0, floorTop - 3, w, 2, '#ffffff')
  fillRect(b, 0, floorTop - 1, w, 1, '#f0c8d4')
  fillRect(b, 0, floorTop, w, h - floorTop, '#f5cfa2')
  for (const dy of [3, 7, 12, 18]) fillRect(b, 0, floorTop + dy, w, 1, '#ecbf8f')
  for (let y = floorTop; y < h; y++) for (let x = 0; x < w; x++) if ((x - ox + (y - floorTop) * 7) % 23 === 0) set(b, x, y, '#ecbf8f')
  // The window.
  const wx = ox + 3, wy = oy + 14
  fillRoundRect(b, wx, wy, 15, 20, 2, '#ffffff')
  fillRect(b, wx + 2, wy + 2, 11, 16, '#bfe8ff')
  fillRect(b, wx + 2, wy + 12, 11, 6, '#d6f1ff')
  fillEllipse(b, wx + 6, wy + 8, 3, 1.6, '#ffffff'); fillEllipse(b, wx + 8.5, wy + 7.2, 2.2, 1.6, '#ffffff')
  fillRect(b, wx + 7, wy + 2, 1, 16, '#ffffff'); fillRect(b, wx + 2, wy + 9, 11, 1, '#ffffff')
  fillRect(b, wx - 1, wy + 20, 17, 2, '#f7f0f4')
  // The plant.
  const px = ox + SIZE.w - 10, py = floorTop - 1
  fillRoundRect(b, px, py - 9, 8, 9, 2, '#f0906e')
  fillRect(b, px - 1, py - 10, 10, 2, '#f7a987')
  for (const [dx, dy, rx, ry] of [[4, -16, 2.2, 5.5], [0.5, -14, 2.2, 4.5], [7.5, -14, 2.2, 4.5], [2, -19, 1.8, 3.5], [6, -19, 1.8, 3.5]]) {
    fillEllipse(b, px + dx!, py + dy!, rx!, ry!, '#6cc48a')
  }
  line(b, px + 4, py - 21, px + 4, py - 11, '#4fa870')
  // A small heart picture.
  const hx = ox + SIZE.w - 12, hy = oy + 18
  fillRect(b, hx, hy, 9, 8, '#ffffff'); fillRect(b, hx + 1, hy + 1, 7, 6, '#fff3a8')
  for (const [x, y] of [[3, 2], [5, 2], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [3, 4], [4, 4], [5, 4], [4, 5]]) set(b, hx + x!, hy + y!, '#ff7eb6')
  // The rug under the figure.
  const cx = ox + SIZE.w / 2
  fillEllipse(b, cx, oy + FLOOR + 1, 25, 4.6, '#8fcff0')
  fillEllipse(b, cx, oy + FLOOR + 1, 21, 3.4, '#b5e2f7')
  fillEllipse(b, cx, oy + FLOOR + 1, 15, 2.2, '#8fcff0')
  return rooms.set(key, b)
}

function backdrop(b: PixelBuffer, o: { x: number; y: number }, t: number): void {
  const r = room(b.w, b.h, o.x, o.y)
  for (let i = 0; i < b.px.length; i++) b.px[i] = r.px[i]!
  // A glint that comes and goes on the window.
  if (Math.floor(t * 1.5) % 3 === 0) {
    const x = o.x + 14, y = o.y + 18
    set(b, x, y, '#ffffff'); set(b, x - 1, y, '#ffffff'); set(b, x + 1, y, '#ffffff'); set(b, x, y - 1, '#ffffff'); set(b, x, y + 1, '#ffffff')
  }
}

const cache = new Lru<Chibi>(16)
const look = { spec, cache, backdrop, sparkle: 'confetti' as const, sparkleColors: ['#ff7eb6', '#8fcff0', '#ffd93b', '#9be8b0', '#c7a5ff'] }

export const toca: FigureStyle = {
  id: 'toca',
  label: 'TOCA BOCA',
  short: 'TOCA',
  bg: WALL,
  size: SIZE,
  draw: f => chibiFrame(look, f),
}
