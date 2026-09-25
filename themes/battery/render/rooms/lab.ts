/**
 * The laboratory: violet cut stone over green lab tiles, a chequered floor
 * in steep perspective. The Lightning Machine (brass dome, bubbling tube
 * banks, two Tesla coils with angry doughnuts, a porthole with the car
 * battery bolted inside), the cable from the roof through the ceiling, the
 * blackboard, the ARM knife switch, the bench with the "brain" and the
 * flasks, a clock stuck at 11:59.
 *
 * The transmogrifier booth stands in the foreground and is drawn whole in
 * front(): heroes can only walk behind it (the room blocks the floor in
 * front), so they show through its glass. Whoever is inside it (the cat,
 * later the Professor) is drawn again between the back glass and the front
 * glass.
 *
 * States: F.leverArmed (sparks, hum, lamp), F.catInBooth, lab.booth (door
 * open), F.junctionBridged (the cable crackles in a storm flash), F.struck
 * (everything charged and glowing), F.batteryOut (the porthole's empty),
 * lab.doodle (Dag's sandwich on the blackboard).
 */
import { drawText } from '../../../base/pixel/sprites'
import type { ActorState, GameState } from '../../types'
import { F } from '../../content/flags'
import { LAB } from '../../content/rooms/lab'
import type { G, RoomPainter, View } from '../api'
import { paint as paintCat } from '../npcs/cat'
import { drawHero } from '../actors'
import { bolt } from '../fx'
import { INK, R, P, box, dith, ellipse, line, stones, cobweb, hash, mix, bayer, hidden } from './cellar-kit'

const FLOOR_Y = 104
const LAMP_X = 123
const B = LAB.booth
const BRASS = { b: '#c4861c', hi: '#ffd23f', lo: '#8a5a10', dk: '#5a3a08' }

const armed = (s: GameState) => !!s.flags[F.leverArmed]
const struck = (s: GameState) => !!s.flags[F.struck]

// ---------------------------------------------------------------------------
// Static background
// ---------------------------------------------------------------------------

function walls(g: G, w: number) {
  stones(g, 0, 8, w, 72, ['#4a3a6e', '#44366a', '#503f78', '#48386c'], '#1c1430', '#6a5a98', 21)
  // Green lab tiles below, white grout, a few cracked.
  R(g, 0, 72, w, FLOOR_Y - 72, '#c8d8d0')
  for (let y = 73; y < FLOOR_Y; y += 7) {
    for (let x = 0; x < w; x += 8) {
      const c = hash(x * 3 + y * 7) < 0.1 ? '#357a68' : '#2a6a5a'
      R(g, x + 1, y, 7, 6, c)
      R(g, x + 1, y, 7, 1, '#4a9a84')
      if (hash(x + y * 13) < 0.05) line(g, x + 2, y + 1, x + 6, y + 5, '#1a4a3e')
    }
  }
  R(g, 0, 71, w, 2, '#2a2040')
  R(g, 0, 71, w, 1, '#6a5a98')
  for (let x = 0; x < w; x++) {
    const off = Math.round(Math.sin(x * 0.035 + 4) * 2 + Math.sin(x * 0.012 + 1) * 1.4)
    if (off) g.drawImage(g.canvas, x, 8, 1, FLOOR_Y - 8, x, 8 + off, 1, FLOOR_Y - 8)
  }
  R(g, 0, FLOOR_Y - 2, w, 2, '#141024')
}

/** Black and white chequers in steep perspective. */
function checker(g: G, w: number) {
  const y0 = FLOOR_Y
  const y1 = 144
  const vx = w / 2
  const vy = -60
  R(g, 0, y0, w, y1 - y0, '#1c1830')
  const rows: number[] = [y0]
  let rh = 4
  while (rows[rows.length - 1]! < y1) { rows.push(rows[rows.length - 1]! + rh); rh = Math.round(rh * 1.35 + 1) }
  const pitch = 26
  for (let r = 0; r < rows.length - 1; r++) {
    for (let y = rows[r]!; y < Math.min(y1, rows[r + 1]!); y++) {
      const k = (y - vy) / (y1 - vy)
      const span = pitch * k
      const j0 = Math.floor((0 - vx) / span) - 1
      const j1 = Math.ceil((w - vx) / span) + 1
      for (let j = j0; j <= j1; j++) {
        const xa = Math.round(vx + j * span)
        const xb = Math.round(vx + (j + 1) * span)
        const white = ((r + j) & 1) === 0
        let c = white ? '#d0c8e0' : '#2a2444'
        if (y === rows[r]) c = white ? '#ece6f8' : '#3a3458'
        R(g, Math.max(0, xa), y, Math.min(w, xb) - Math.max(0, xa), 1, c)
      }
    }
  }
  // Scuffs and a scorch mark in front of the machine.
  for (let y = 112; y < 124; y++) for (let x = 168; x < 232; x++) {
    const d = Math.hypot((x - 199) / 32, (y - 117) / 6)
    if (d < 1 && bayer(x, y) < (1 - d) * 0.8) P(g, x, y, '#1a1424')
  }
}

function ceiling(g: G, w: number) {
  R(g, 0, 0, w, 9, '#161026')
  for (let x = 10; x < w; x += 52) { R(g, x, 0, 14, 8, '#3a2a4a'); R(g, x, 0, 1, 8, '#5a4a6a') }
  R(g, 0, 8, w, 1, INK)
  // The hole where the cable comes through, with a porcelain insulator.
  R(g, LAB.cable.x - 6, 6, 13, 4, INK)
  R(g, LAB.cable.x - 5, 6, 11, 3, '#e8e4f0')
  R(g, LAB.cable.x - 5, 8, 11, 1, '#a8a0c0')
  R(g, LAB.cable.x - 4, 10, 9, 2, INK)
  R(g, LAB.cable.x - 3, 10, 7, 1, '#c8c0d8')
}

function doorway(g: G) {
  for (let y = 22; y < FLOOR_Y + 1; y++) {
    const l = Math.round((FLOOR_Y - y) * 0.05)
    R(g, 0, y, 24 + l, 1, INK)
    R(g, 0, y, 21 + l, 1, y < 30 ? '#2a1418' : '#22101a')
  }
  // The iron door, open against the wall.
  R(g, 22, 24, 6, FLOOR_Y - 26, INK)
  R(g, 23, 25, 4, FLOOR_Y - 28, '#4a445e')
  R(g, 23, 25, 1, FLOOR_Y - 28, '#7a7494')
}

function blackboard(g: G) {
  const x = 32
  const y = 14
  const w = 82
  const h = 54
  // Leaning a touch.
  for (let j = 0; j < h; j++) {
    const sx = x + Math.round(j * 0.05)
    R(g, sx - 1, y + j, w + 2, 1, INK)
    R(g, sx, y + j, w, 1, j < 3 || j > h - 4 ? '#8a5430' : '#1e3a30')
    R(g, sx, y + j, 3, 1, '#8a5430'); R(g, sx + w - 3, y + j, 3, 1, '#6a3a1a')
    if (j === 0) R(g, sx, y, w, 1, '#c07a44')
  }
  // Old chalk ghosts, rubbed out.
  dith(g, x + 6, y + 30, 30, 8, '#1e3a30', '#2e4e42', 0.3)
  const chalk = '#e0ecd8'
  const dim = '#9ab8a8'
  drawText(g, 'MIDNIGHT =', x + 5, y + 5, chalk)
  drawText(g, 'MAX VOLTS!', x + 5, y + 14, chalk)
  // Underlined three times.
  for (const u of [22, 24, 26]) line(g, x + 5, y + u, x + 64 - (u - 22) * 3, y + u + (u === 24 ? 1 : 0), dim)
  // The diagram: a lady with a monocle → arrow → a cat with a ring round one eye.
  const dy = y + 31
  // Lady: head, hair streak, monocle, dress.
  R(g, x + 10, dy, 5, 5, chalk); R(g, x + 11, dy + 1, 3, 3, '#1e3a30')
  P(g, x + 13, dy + 2, chalk)
  line(g, x + 9, dy - 1, x + 11, dy - 2, chalk); line(g, x + 13, dy - 2, x + 16, dy - 1, chalk)
  line(g, x + 12, dy + 5, x + 12, dy + 9, chalk)
  line(g, x + 12, dy + 9, x + 8, dy + 17, chalk); line(g, x + 12, dy + 9, x + 16, dy + 17, chalk)
  line(g, x + 8, dy + 17, x + 16, dy + 17, chalk)
  line(g, x + 12, dy + 7, x + 7, dy + 11, chalk); line(g, x + 12, dy + 7, x + 17, dy + 11, chalk)
  // Arrow.
  line(g, x + 22, dy + 9, x + 38, dy + 9, chalk)
  line(g, x + 35, dy + 6, x + 38, dy + 9, chalk); line(g, x + 35, dy + 12, x + 38, dy + 9, chalk)
  drawText(g, '?', x + 27, dy, dim)
  // Cat: ears, round head, ringed eye, body, tail.
  line(g, x + 45, dy + 4, x + 46, dy + 1, chalk); line(g, x + 46, dy + 1, x + 48, dy + 3, chalk)
  line(g, x + 50, dy + 3, x + 52, dy + 1, chalk); line(g, x + 52, dy + 1, x + 53, dy + 4, chalk)
  R(g, x + 45, dy + 4, 9, 1, chalk); R(g, x + 45, dy + 4, 1, 5, chalk); R(g, x + 53, dy + 4, 1, 5, chalk); R(g, x + 45, dy + 9, 9, 1, chalk)
  R(g, x + 50, dy + 5, 3, 3, chalk); P(g, x + 51, dy + 6, '#1e3a30'); P(g, x + 47, dy + 6, chalk)
  line(g, x + 46, dy + 10, x + 44, dy + 17, chalk); line(g, x + 52, dy + 10, x + 55, dy + 17, chalk)
  line(g, x + 44, dy + 17, x + 55, dy + 17, chalk)
  line(g, x + 55, dy + 15, x + 60, dy + 10, chalk); line(g, x + 60, dy + 10, x + 61, dy + 7, chalk)
  // Reverse polarity: + and − with a curly arrow.
  drawText(g, '+', x + 66, dy + 1, chalk)
  drawText(g, '-', x + 72, dy + 1, chalk)
  line(g, x + 66, dy + 11, x + 76, dy + 11, dim)
  line(g, x + 66, dy + 11, x + 68, dy + 9, dim); line(g, x + 76, dy + 11, x + 74, dy + 13, dim)
  // The chalk ledge, chalk and eraser.
  R(g, x - 2, y + h, w + 5, 3, INK)
  R(g, x - 1, y + h, w + 3, 2, '#a0643a')
  R(g, x + 12, y + h - 2, 5, 2, '#f0f0e8')
  box(g, x + 56, y + h - 3, 9, 3, '#6a5a8a', '#8a7aaa', '#4a3a6a')
}

function lamp(g: G) {
  // A green banker's-lamp shade hanging over the blackboard.
  line(g, LAMP_X, 9, LAMP_X, 18, '#2a2030')
  ellipse(g, LAMP_X, 23, 8, 4, INK)
  R(g, LAMP_X - 8, 19, 17, 5, INK)
  R(g, LAMP_X - 7, 19, 15, 4, '#2a8a5a')
  R(g, LAMP_X - 7, 19, 15, 1, '#5ad09a')
  R(g, LAMP_X - 6, 22, 13, 1, '#1a5a3a')
}

// --- the Lightning Machine -------------------------------------------------

function plinth(g: G) {
  // A wooden base with brass trim, dials and switches.
  box(g, 132, 92, 134, 18, '#5a3018', '#8a5430', '#3a1e10')
  R(g, 132, 92, 134, 2, BRASS.b)
  R(g, 132, 92, 134, 1, BRASS.hi)
  R(g, 132, 107, 134, 2, BRASS.lo)
  // Three dials.
  for (const [cx, a] of [[146, -2.2], [252, -0.9]] as const) {
    ellipse(g, cx, 100, 5, 5, INK)
    ellipse(g, cx, 100, 4, 4, BRASS.b)
    ellipse(g, cx, 100, 3, 3, '#f0ecd8')
    line(g, cx, 100, cx + Math.round(Math.cos(a) * 3), 100 + Math.round(Math.sin(a) * 3), INK)
  }
  // A row of toggle switches.
  for (let i = 0; i < 5; i++) {
    const x = 162 + i * 6
    R(g, x - 1, 97, 4, 6, INK)
    R(g, x, 98, 2, 4, '#3a3450')
    R(g, x, 96 - (i % 2), 2, 3, '#c8c0d8')
  }
  // The maker's plate.
  box(g, 206, 96, 38, 9, BRASS.b, BRASS.hi, BRASS.lo)
  drawText(g, 'MK III', 207, 97, BRASS.dk)
  // Feet.
  for (const x of [136, 258]) { R(g, x - 2, 109, 8, 3, INK); R(g, x - 1, 109, 6, 2, BRASS.lo) }
}

const TUBES_L = [138, 145, 152]
const TUBES_R = [242, 249, 256]

function tubeGlass(g: G, x: number) {
  // A glass tube with brass caps; the liquid is drawn in back().
  R(g, x - 1, 44, 7, 49, INK)
  R(g, x, 46, 5, 46, '#1a2a30')
  box(g, x - 1, 42, 7, 3, BRASS.b, BRASS.hi, BRASS.lo)
  box(g, x - 1, 89, 7, 3, BRASS.b, BRASS.hi, BRASS.lo)
}

function housing(g: G) {
  // The brass cylinder with a domed top.
  const x0 = 162
  const x1 = 236
  const cx = (x0 + x1) / 2
  for (let y = 26; y < 92; y++) {
    let half = (x1 - x0) / 2
    if (y < 40) half = Math.round(Math.sqrt(Math.max(0, 1 - ((40 - y) / 14) ** 2)) * half)
    if (half <= 0) continue
    R(g, cx - half - 1, y, half * 2 + 2, 1, INK)
    for (let x = -half; x < half; x++) {
      const k = x / half
      let c = BRASS.b
      if (k < -0.7) c = BRASS.hi
      else if (k < -0.45) c = bayer(x, y) < 0.5 ? BRASS.hi : BRASS.b
      else if (k > 0.72) c = BRASS.dk
      else if (k > 0.45) c = BRASS.lo
      if (y < 40 && (40 - y) > 10) c = mix(c, '#fff1b0', 0.2)
      P(g, cx + x, y, c)
    }
  }
  // Riveted bands.
  for (const by of [44, 62, 88]) {
    R(g, x0, by, x1 - x0, 1, BRASS.dk)
    for (let x = x0 + 3; x < x1 - 2; x += 5) P(g, x, by + 1, BRASS.hi)
  }
  // The porthole's rim; its inside is drawn in back().
  const { x: px, y: py } = LAB.battery
  ellipse(g, px, py, 16, 14, INK)
  ellipse(g, px, py, 15, 13, BRASS.lo)
  ellipse(g, px - 1, py - 1, 14, 12, BRASS.hi)
  ellipse(g, px, py, 12, 10, INK)
  for (let a = 0; a < 360; a += 45) {
    const r = (a * Math.PI) / 180
    P(g, px + Math.round(Math.cos(r) * 14), py + Math.round(Math.sin(r) * 12), BRASS.dk)
  }
  // A little warning plate above it.
  box(g, 186, 49, 26, 7, '#ffd23f', '#fff1b0', '#c4861c')
  for (let i = 0; i < 26; i += 4) line(g, 186 + i, 55, 189 + i, 49, INK)
}

function coilBase(g: G, x: number) {
  // Copper windings from the dome to the doughnut.
  R(g, x - 4, 14, 9, 22, INK)
  for (let y = 15; y < 36; y++) {
    R(g, x - 3, y, 7, 1, y % 2 ? '#b8703a' : '#e0a060')
    P(g, x + 3, y, '#6a3a1a')
  }
  box(g, x - 5, 34, 11, 3, BRASS.b, BRASS.hi, BRASS.lo)
  // The doughnut on top.
  ellipse(g, x, 11, 10, 4, INK)
  ellipse(g, x, 11, 9, 3, '#9a94b8')
  ellipse(g, x - 1, 10, 7, 1, '#e8e4f8')
  R(g, x - 3, 11, 7, 1, '#5a5470')
}

function cable(g: G) {
  // Down from the ceiling insulator to the dome, fat and banded.
  const x = LAB.cable.x
  R(g, x - 3, 11, 7, 17, INK)
  R(g, x - 2, 11, 5, 17, '#2a2436')
  R(g, x - 2, 11, 1, 17, '#5a5470')
  for (const y of [15, 21]) R(g, x - 3, y, 7, 2, BRASS.b)
  // Out of the plinth and along the floor to the booth.
  const pts: [number, number][] = [[266, 104], [272, 108], [278, 116], [284, 124]]
  for (let i = 0; i < pts.length - 1; i++) {
    line(g, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], INK, 4)
  }
  for (let i = 0; i < pts.length - 1; i++) {
    line(g, pts[i]![0] + 1, pts[i]![1] + 1, pts[i + 1]![0] + 1, pts[i + 1]![1] + 1, '#2a2436', 2)
  }
}

function leverPanel(g: G) {
  // A marble slab on the wall, crooked.
  const x = 344
  const y = 32
  for (let j = 0; j < 66; j++) {
    const sx = x + Math.round(j * 0.06)
    R(g, sx - 1, y + j, 34, 1, INK)
    R(g, sx, y + j, 32, 1, '#d8d0e4')
    if (hash(j * 7) < 0.3) P(g, sx + 4 + Math.floor(hash(j) * 24), y + j, '#a8a0c0')
  }
  line(g, x + 4, y + 10, x + 14, y + 30, '#a8a0c0')
  line(g, x + 14, y + 30, x + 12, y + 50, '#a8a0c0')
  drawText(g, 'ARM', x + 8, y + 3, '#c8203a')
  // The two clips at the bottom the blade drops into, and the pivot.
  for (const cx of [x + 13, x + 19]) { R(g, cx - 1, y + 50, 3, 10, INK); R(g, cx, y + 51, 1, 8, '#c4861c') }
  ellipse(g, x + 17, y + 34, 4, 4, INK)
  ellipse(g, x + 17, y + 34, 3, 3, '#5a5470')
  // The man with no eyebrows, next to "down".
  const fx = x + 27
  const fy = y + 56
  R(g, fx - 2, fy - 2, 5, 5, '#3a3450')
  R(g, fx - 1, fy - 1, 3, 3, '#d8d0e4')
  P(g, fx - 1, fy - 1, '#3a3450'); P(g, fx + 1, fy - 1, '#3a3450'); R(g, fx - 1, fy + 1, 3, 1, '#3a3450')
  line(g, fx - 3, fy - 4, fx - 2, fy - 3, '#ff8a3d'); line(g, fx + 3, fy - 4, fx + 2, fy - 3, '#ff8a3d')
  // Wires out of the top, up the wall to the ceiling.
  line(g, x + 16, y - 1, x + 16, 9, INK, 2)
  line(g, x + 22, y - 1, x + 22, 9, INK, 2)
}

function bench(g: G) {
  // The workbench.
  box(g, 384, 84, 54, 4, '#8a5430', '#c07a44', '#5a3018')
  for (const x of [387, 432]) { R(g, x - 1, 88, 4, 22, INK); R(g, x, 88, 2, 21, '#6a3a1a') }
  R(g, 386, 100, 50, 2, '#5a3018')
  // The brain jar (a cauliflower, in brine).
  const jx = 397
  R(g, jx - 9, 56, 19, 28, INK)
  R(g, jx - 8, 60, 17, 23, '#b0c878')
  dith(g, jx - 8, 60, 17, 23, '#b0c878', '#d0e098', 0.3)
  box(g, jx - 8, 55, 17, 4, BRASS.b, BRASS.hi, BRASS.lo)
  // The cauliflower: bumpy, cream, with green leaves at the bottom.
  ellipse(g, jx, 69, 8, 7, '#6a6040')
  for (const [dx, dy, r] of [[-3, 66, 4], [2, 65, 4], [0, 69, 5], [-4, 71, 3], [4, 71, 3], [-1, 63, 3]] as const) {
    ellipse(g, jx + dx, dy, r, r - 1, '#fff0d0')
    P(g, jx + dx - 1, dy - 1, '#fff8e0')
    P(g, jx + dx + 1, dy + 1, '#c8b890')
  }
  R(g, jx - 6, 76, 13, 3, '#4f9a2a')
  P(g, jx - 7, 75, '#4f9a2a'); P(g, jx + 7, 75, '#4f9a2a')
  R(g, jx - 7, 61, 1, 20, '#e0f0d0')
  // Label.
  box(g, jx - 5, 79, 11, 3, '#f0e8d0')
  R(g, jx - 4, 80, 8, 1, '#8a7a60')
  // Flasks: a round-bottomed one on a stand (pink), a conical one (green), a test tube rack.
  // Stand.
  R(g, 413, 70, 1, 14, INK)
  R(g, 409, 83, 9, 1, INK)
  ellipse(g, 415, 74, 5, 5, INK)
  R(g, 414, 64, 3, 6, INK)
  ellipse(g, 415, 74, 4, 4, '#3a2040')
  R(g, 415, 64, 1, 6, '#e8e4f0')
  // Conical.
  for (let j = 0; j < 14; j++) {
    const half = 1 + Math.floor(j * 0.45)
    R(g, 428 - half - 1, 70 + j, half * 2 + 3, 1, INK)
  }
  R(g, 427, 65, 3, 6, INK)
  R(g, 428, 65, 1, 5, '#e8e4f0')
  // A glass coil between them.
  for (let i = 0; i < 12; i++) P(g, 418 + i, 62 + Math.round(Math.sin(i * 1.3) * 2), '#c8e8f0')
  // A test tube rack.
  box(g, 400, 88, 18, 3, '#8a5430', '#c07a44', '#5a3018')
}

function clock(g: G) {
  // A lab clock above the ARM panel: 11:59, like everything else.
  const cx = 361
  const cy = 20
  ellipse(g, cx, cy, 8, 8, INK)
  ellipse(g, cx, cy, 7, 7, '#e8e4f0')
  for (let a = 0; a < 12; a++) {
    const r = (a * 30 * Math.PI) / 180
    P(g, cx + Math.round(Math.cos(r) * 6), cy + Math.round(Math.sin(r) * 6), '#5a5270')
  }
}

// ---------------------------------------------------------------------------
// Animated parts
// ---------------------------------------------------------------------------

function tubeLiquid(g: G, x: number, t: number, i: number, s: GameState) {
  const level = 52 + Math.round(Math.sin(t * 0.8 + i) * 1.5)
  const on = armed(s) || struck(s)
  const col = struck(s) ? '#7ad8ff' : on ? '#5affb0' : '#2ab878'
  R(g, x, level, 5, 91 - level, col)
  R(g, x, level, 5, 1, mix(col, '#ffffff', 0.5))
  R(g, x + 3, level + 1, 1, 90 - level, mix(col, '#0b0616', 0.35))
  // Bubbles rising.
  const speed = on ? 2.2 : 0.7
  for (let b = 0; b < 3; b++) {
    const u = (t * speed * 0.3 + b / 3 + i * 0.17) % 1
    const y = 90 - Math.round(u * (90 - level))
    P(g, x + 1 + ((b + i) % 3), y, '#e8fff4')
  }
}

function porthole(g: G, s: GameState, t: number) {
  const { x: px, y: py } = LAB.battery
  // Dark glass behind.
  ellipse(g, px, py, 11, 9, struck(s) ? '#1a2a48' : '#101820')
  if (s.flags[F.batteryOut]) {
    // An empty cradle: brass straps undone, two cables hanging loose.
    R(g, px - 10, py + 5, 21, 2, BRASS.lo)
    line(g, px - 6, py - 6, px - 8, py + 2, BRASS.b)
    line(g, px + 6, py - 6, px + 8, py + 2, BRASS.b)
    line(g, px - 4, py - 8, px - 3, py - 1, '#c8203a', 1)
    line(g, px + 4, py - 8, px + 5, py - 2, INK, 1)
    P(g, px - 3, py, '#e8e4f0'); P(g, px + 5, py - 1, '#e8e4f0')
    return
  }
  // The car battery: a black box, red and black terminals, a 12V label, brass straps.
  const bx = px - 10
  const by = py - 5
  R(g, bx - 1, by - 1, 21, 14, INK)
  R(g, bx, by, 19, 12, '#2a2436')
  R(g, bx, by, 19, 1, '#4a445e')
  R(g, bx, by + 11, 19, 1, '#16121e')
  R(g, bx + 2, by - 3, 3, 3, INK); R(g, bx + 3, by - 3, 1, 2, '#e0283e')
  R(g, bx + 14, by - 3, 3, 3, INK); R(g, bx + 15, by - 3, 1, 2, '#5a5470')
  drawText(g, '12V', bx + 1, by + 3, struck(s) ? '#b6ff4a' : '#c8c0d8')
  R(g, bx - 1, by + 2, 21, 1, BRASS.b)
  R(g, bx - 1, by + 9, 21, 1, BRASS.b)
  P(g, bx - 1, by + 2, BRASS.hi); P(g, bx + 19, by + 9, BRASS.hi)
  // Cables up to the terminals.
  line(g, bx + 3, by - 4, bx + 1, by - 8, '#e0283e')
  line(g, bx + 15, by - 4, bx + 17, by - 8, INK)
  // A glint on the glass.
  P(g, px - 7, py - 6, '#e8f0ff'); P(g, px - 6, py - 7, '#e8f0ff')
  if (struck(s)) {
    // Charged: a little meter on its side reads full.
    const k = 0.5 + 0.5 * Math.sin(t * 6)
    R(g, bx + 13, by + 3, 4, 5, mix('#4f9a2a', '#b6ff4a', k))
  }
}

function lever(g: G, s: GameState, t: number) {
  const x = 344
  const y = 32
  const pivotX = x + 17
  const pivotY = y + 34
  const on = armed(s)
  const tipX = pivotX - 1
  const tipY = on ? y + 58 : y + 16
  // The blade.
  line(g, pivotX, pivotY, tipX, tipY, INK, 3)
  line(g, pivotX, pivotY, tipX, tipY, '#c8c0d8', 1)
  // The handle: a red ball on a crossbar.
  R(g, tipX - 5, tipY - 1, 11, 3, INK)
  R(g, tipX - 4, tipY, 9, 1, '#8a84a8')
  ellipse(g, tipX, on ? tipY + 3 : tipY - 3, 3, 3, INK)
  ellipse(g, tipX, on ? tipY + 3 : tipY - 3, 2, 2, '#e0283e')
  P(g, tipX - 1, (on ? tipY + 3 : tipY - 3) - 1, '#ff8ab0')
  ellipse(g, pivotX, pivotY, 2, 2, '#9a94b8')
  // The lamp above: dark until armed.
  ellipse(g, x + 29, y + 5, 3, 3, INK)
  ellipse(g, x + 29, y + 5, 2, 2, on ? (Math.floor(t * 3) % 2 ? '#ff5a5a' : '#ff9a9a') : '#5a1a2a')
}

function clockHands(g: G, s: GameState) {
  const cx = 361
  const cy = 20
  const mid = struck(s)
  // Hour hand at 11 (or 12), minute hand at 59 (or 12).
  const ha = mid ? -Math.PI / 2 : -Math.PI / 2 - Math.PI / 6
  const ma = mid ? -Math.PI / 2 : -Math.PI / 2 - Math.PI / 30
  line(g, cx, cy, cx + Math.round(Math.cos(ha) * 3), cy + Math.round(Math.sin(ha) * 3), INK)
  line(g, cx, cy, cx + Math.round(Math.cos(ma) * 5), cy + Math.round(Math.sin(ma) * 5), '#c8203a')
  P(g, cx, cy, INK)
}

function sparks(g: G, t: number, big: boolean) {
  // Arcs between the two doughnuts and up the cable, re-seeded every few frames.
  const [[ax, ay], [bx, by]] = LAB.coils
  const seed = Math.floor(t * (big ? 20 : 12))
  const n = big ? 3 : 1
  for (let k = 0; k < n; k++) {
    if (!big && hash(seed * 3 + k) < 0.35) continue
    let x = ax + 8
    let y = ay + Math.round((hash(seed + k * 7) - 0.5) * 4)
    const tx = bx - 8
    g.fillStyle = k === 0 ? '#e8f4ff' : '#9ac8ff'
    while (x < tx) {
      g.fillRect(x, y, 1, 1)
      x++
      if (hash(seed * 31 + x * 7 + k) < 0.4) y += hash(seed + x + k * 3) < 0.5 ? -1 : 1
      y = Math.max(ay - 8, Math.min(ay + 8, y))
    }
  }
  // Little crackles on each doughnut.
  for (const [cx, cy] of LAB.coils) {
    for (let i = 0; i < (big ? 6 : 3); i++) {
      if (hash(seed * 11 + i + cx) < 0.5) continue
      const a = hash(seed * 5 + i * 3 + cx) * Math.PI * 2
      const r = 9 + hash(seed + i) * (big ? 8 : 4)
      line(g, cx + Math.round(Math.cos(a) * 7), cy + Math.round(Math.sin(a) * 3), cx + Math.round(Math.cos(a) * r), cy + Math.round(Math.sin(a) * r * 0.6), '#bfe0ff')
    }
  }
}

// --- the booth -------------------------------------------------------------

function inBooth(a: ActorState | undefined): boolean {
  return !!a && a.room === 'lab' && a.visible && a.x >= B.x && a.x <= B.x + B.w && a.y <= B.base + 4 && a.y >= B.y + 20
}

function boothBack(g: G, s: GameState, t: number) {
  const x0 = B.x
  const x1 = B.x + B.w
  // The platform's top.
  ellipse(g, B.cx, B.base, 32, 6, INK)
  ellipse(g, B.cx, B.base, 31, 5, '#3a3450')
  ellipse(g, B.cx, B.base - 1, 28, 4, '#5a5470')
  // Rings on the platform floor.
  for (let a = 0; a < 360; a += 12) {
    const r = (a * Math.PI) / 180
    P(g, B.cx + Math.round(Math.cos(r) * 18), B.base - 1 + Math.round(Math.sin(r) * 2), BRASS.b)
  }
  // The back of the glass: a faint teal tint (dithered), and two brass ribs.
  const lit = struck(s) ? 0.3 : s.flags[F.catInBooth] ? 0.1 : 0.07
  for (let y = B.y + 2; y < B.base - 3; y++) {
    for (let x = x0 + 2; x < x1 - 1; x++) if (bayer(x, y) < lit) P(g, x, y, '#6ad0d0')
  }
  for (const rx of [x0 + 12, x1 - 12]) R(g, rx, B.y + 4, 1, B.base - B.y - 8, BRASS.lo)
  // The seats: a cat-sized cushion on a post, and a big one.
  const c = LAB.boothCat
  R(g, c.x - 1, c.y + 1, 3, B.base - c.y - 3, INK)
  R(g, c.x, c.y + 1, 1, B.base - c.y - 3, BRASS.b)
  ellipse(g, c.x, c.y, 7, 2, INK)
  ellipse(g, c.x, c.y, 6, 1, '#c8203a')
  R(g, c.x - 4, c.y - 1, 6, 1, '#ff5a70')
  P(g, c.x - 6, c.y + 1, '#ffd23f'); P(g, c.x + 6, c.y + 1, '#ffd23f')
  const hx = 326
  R(g, hx - 1, 112, 4, B.base - 115, INK)
  R(g, hx, 112, 2, B.base - 115, BRASS.lo)
  ellipse(g, hx, 110, 9, 3, INK)
  ellipse(g, hx, 110, 8, 2, '#5a2a4a')
  R(g, hx - 6, 109, 10, 1, '#8a4a6a')
  // A little sign between them: a cat, an arrow, a person.
  void t
}

function boothFront(g: G, s: GameState, t: number) {
  const x0 = B.x
  const x1 = B.x + B.w
  const open = !!s.flags['lab.booth']
  // Side posts.
  R(g, x0 - 1, B.y, 4, B.base - B.y, INK)
  R(g, x0, B.y, 2, B.base - B.y, BRASS.b)
  P(g, x0, B.y, BRASS.hi)
  R(g, x1 - 3, B.y, 4, B.base - B.y, INK)
  R(g, x1 - 2, B.y, 2, B.base - B.y, BRASS.lo)
  // The cap: a brass dome with a small coil and ball on top.
  for (let y = B.y - 14; y < B.y + 2; y++) {
    const k = (B.y + 2 - y) / 16
    const half = Math.round((B.w / 2 + 2) * Math.sqrt(Math.max(0, 1 - k * k)))
    R(g, B.cx - half - 1, y, half * 2 + 2, 1, INK)
    R(g, B.cx - half, y, half * 2, 1, y < B.y - 8 ? BRASS.hi : y < B.y - 2 ? BRASS.b : BRASS.lo)
    if (half > 4) { P(g, B.cx - half, y, BRASS.hi); P(g, B.cx + half - 1, y, BRASS.dk) }
  }
  R(g, B.cx - 1, B.y - 24, 3, 11, INK)
  for (let y = B.y - 23; y < B.y - 14; y++) P(g, B.cx, y, y % 2 ? '#b8703a' : '#e0a060')
  ellipse(g, B.cx, B.y - 26, 3, 3, INK)
  ellipse(g, B.cx, B.y - 26, 2, 2, '#9a94b8')
  P(g, B.cx - 1, B.y - 27, '#e8e4f8')
  // The front of the platform, with its name plate.
  R(g, B.cx - 32, B.base, 65, 10, INK)
  R(g, B.cx - 31, B.base, 63, 9, '#3a3450')
  R(g, B.cx - 31, B.base, 63, 1, '#6a6488')
  box(g, B.cx - 26, B.base + 1, 52, 8, '#1a1428', BRASS.b, BRASS.b)
  drawText(g, 'TRANSMOG', B.cx - 24, B.base + 2, BRASS.hi)
  if (open) {
    // The door has swung out to the right: a narrow glass panel on its hinge.
    R(g, x1 - 1, B.y + 2, 12, 2, INK)
    for (let y = B.y + 3; y < B.base - 2; y++) {
      R(g, x1 + 8, y, 3, 1, INK)
      R(g, x1 + 9, y, 1, 1, BRASS.b)
      if (bayer(x1 + 2, y) < 0.3) P(g, x1 + 4, y, '#8ae0e0')
    }
    R(g, x1 - 1, B.base - 3, 12, 2, INK)
    R(g, x1, B.y + 3, 1, B.base - B.y - 6, '#b8f0f0')
  } else {
    // The closed door: a brass frame, glass highlights, a handle.
    R(g, x0 + 3, B.y + 2, B.w - 6, 2, BRASS.lo)
    R(g, x0 + 3, B.base - 4, B.w - 6, 2, BRASS.lo)
    // Streaks of reflection.
    for (let y = B.y + 6; y < B.base - 8; y++) {
      const k = y - B.y
      P(g, x0 + 7 + Math.round(k * 0.12), y, '#d8ffff')
      if (k > 10 && k < 40) P(g, x0 + 10 + Math.round(k * 0.12), y, '#8ae0e0')
      if (k > 50) P(g, x1 - 9, y, '#8ae0e0')
    }
    R(g, x1 - 7, B.y + 36, 2, 12, INK)
    R(g, x1 - 7, B.y + 37, 1, 10, BRASS.hi)
  }
  // A faint shimmer on the glass when charged.
  if (struck(s)) for (let y = B.y + 4; y < B.base - 4; y += 3) P(g, x0 + 4 + Math.floor(hash(y + Math.floor(t * 20)) * (B.w - 8)), y, '#ffffff')
}

// ---------------------------------------------------------------------------
// The painter
// ---------------------------------------------------------------------------

export const painter: RoomPainter = {
  paint(g, w) {
    walls(g, w)
    checker(g, w)
    ceiling(g, w)
    doorway(g)
    blackboard(g)
    lamp(g)
    plinth(g)
    for (const x of [...TUBES_L, ...TUBES_R]) tubeGlass(g, x)
    housing(g)
    for (const [x] of LAB.coils) coilBase(g, x)
    cable(g)
    leverPanel(g)
    bench(g)
    clock(g)
    cobweb(g, 0, 9, 16, 1, '#6a6a9a')
    cobweb(g, w - 1, 9, 14, -1, '#6a6a9a')
  },

  ambient: s => struck(s) ? '#8a86c8' : armed(s) ? '#48407a' : '#3a3464',

  back(g, s, v) {
    const t = v.t
    TUBES_L.forEach((x, i) => tubeLiquid(g, x, t, i, s))
    TUBES_R.forEach((x, i) => tubeLiquid(g, x, t, i + 3, s))
    porthole(g, s, t)
    lever(g, s, t)
    clockHands(g, s)
    // The lamp's bulb.
    R(g, LAMP_X - 3, 24, 7, 2, '#fff0c0')
    // Bubbling flasks.
    for (let b = 0; b < 3; b++) {
      const u = (t * 0.9 + b / 3) % 1
      P(g, 414 + (b % 2) * 2, 77 - Math.round(u * 7), '#ffb0d8')
      const u2 = (t * 1.3 + b / 3 + 0.2) % 1
      P(g, 427 + (b % 3) - 1, 82 - Math.round(u2 * 9), '#b0ffc8')
    }
    // Pink and green liquid.
    ellipse(g, 415, 75, 3, 2, '#ff5aa8')
    for (let j = 6; j < 14; j++) {
      const half = 1 + Math.floor(j * 0.45)
      R(g, 428 - half, 70 + j, half * 2 + 1, 1, j === 6 ? '#b0ffc8' : '#3aff9a')
    }
    // A bubble in the brain jar.
    const bu = (t * 0.25) % 1
    P(g, 392 + Math.round(Math.sin(t) * 2), 80 - Math.round(bu * 18), '#e8ffd8')
    // Dag's sandwich on the blackboard.
    if (s.flags['lab.doodle']) {
      const x = 98
      const y = 58
      line(g, x, y + 3, x + 9, y + 3, '#e0ecd8')
      line(g, x, y + 5, x + 9, y + 5, '#e0ecd8')
      line(g, x + 1, y + 2, x + 8, y + 2, '#ff8ab0')
      line(g, x, y + 4, x + 9, y + 4, '#b6ff4a')
      P(g, x + 4, y, '#e0ecd8'); P(g, x + 5, y - 1, '#e0ecd8')
    }
    // The cable from the roof: dead, or live and crackling when lightning hits.
    if (s.flags[F.junctionBridged] && v.flash > 0.4) {
      for (let i = 0; i < 4; i++) P(g, LAB.cable.x - 4 + Math.floor(hash(Math.floor(t * 30) + i) * 9), 10 + Math.floor(hash(i * 7 + Math.floor(t * 30)) * 18), '#e8f4ff')
    }
  },

  front(g, s, v) {
    const t = v.t
    boothBack(g, s, t)
    // Whoever is inside the booth, between its back and front glass.
    const cat = s.actors.cat
    if (inBooth(cat)) paintCat(g, cat!, v, s)
    const prof = s.actors.professor
    if (inBooth(prof)) drawHero(g, 'professor', prof!, v, false, s)
    boothFront(g, s, t)
  },

  lights(L, s, v) {
    const t = v.t
    const on = armed(s)
    L(LAMP_X, 30, 90, '#ffe0a0', 0.85)
    // The tube banks glow green.
    const tg = on ? 0.75 : 0.5
    L(147, 70, 46, '#3aff9a', tg + 0.05 * Math.sin(t * 3))
    L(251, 70, 46, '#3aff9a', tg + 0.05 * Math.sin(t * 3 + 1))
    // The flasks.
    L(420, 76, 28, '#ff7ac8', 0.45)
    // The booth, faintly.
    L(B.cx, 100, 44, '#6ad0d0', s.flags[F.catInBooth] ? 0.45 : 0.25)
    // The boiler room's glow through the door, if the furnace is lit.
    if (s.flags[F.furnaceLit]) L(8, 80, 40, '#ff8a3d', 0.5 + 0.1 * Math.sin(t * 7))
    if (on || struck(s)) {
      const f = 0.55 + 0.3 * hash(Math.floor(t * 14))
      for (const [cx, cy] of LAB.coils) L(cx, cy, struck(s) ? 90 : 46, '#a0c8ff', struck(s) ? 1 : f)
      L(LAB.lever.x + 9, 37, 16, '#ff5a5a', 0.6)
    }
    if (struck(s)) {
      L(LAB.battery.x, LAB.battery.y, 60, '#b6ff4a', 0.7)
      L(B.cx, 96, 80, '#e0f8ff', 0.8)
    }
    if (s.flags[F.junctionBridged] && v.flash > 0.3) L(LAB.cable.x, 14, 40, '#e8f4ff', v.flash)
  },

  glow(g, s, v) {
    const t = v.t
    if (!hidden(s, 'lab', 136, 44, 24, 48, 92)) TUBES_L.forEach((x, i) => tubeLiquid(g, x, t, i, s))
    if (!hidden(s, 'lab', 240, 44, 24, 48, 92)) TUBES_R.forEach((x, i) => tubeLiquid(g, x, t, i + 3, s))
    R(g, LAMP_X - 2, 24, 5, 1, '#fffbe8')
    if (armed(s) || struck(s)) {
      sparks(g, t, struck(s))
      const x = 344
      if (!hidden(s, 'lab', x + 26, 34, 6, 6, 98)) ellipse(g, x + 29, 37, 2, 2, Math.floor(t * 3) % 2 ? '#ff5a5a' : '#ffb0b0')
    }
    if (struck(s)) {
      // Lightning down the cable, now and then.
      if (hash(Math.floor(t * 4)) < 0.3) bolt(g, LAB.cable.x, 9, 30, Math.floor(t * 4), '#e8f4ff')
      // The booth brims with light.
      for (let y = B.y + 4; y < B.base - 4; y++) for (let x = B.x + 3; x < B.x + B.w - 3; x++) if (bayer(x, y) < 0.12) P(g, x, y, '#e0ffff')
    }
  },
}

export type { View }
