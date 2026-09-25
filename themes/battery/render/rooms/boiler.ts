/**
 * The boiler room: red-brown brick, a concrete floor gritty with coal dust,
 * copper pipes that run up into the house and loop for no reason. The fat
 * iron furnace has a face (two damper eyes, the door for a mouth): cold and
 * dead until Dag lights it, then it glows, flickers, shimmers, and the
 * pipes steam and the gauge climbs. Mr Bones' stool, the calendar stopped
 * at September 1987, and the iron lab door with its lightning keyhole.
 */
import { drawText } from '../../../base/pixel/sprites'
import type { GameState } from '../../types'
import { F } from '../../content/flags'
import type { G, RoomPainter, View } from '../api'
import { INK, R, P, box, dith, ellipse, line, slabs, cobweb, drip, hash, mix, bayer, hidden } from './cellar-kit'

const FLOOR_Y = 104
const FX = 88 // the furnace's middle
const FY = 76
const DOOR = { cx: 88, cy: 84, r: 11 }

const IRON = { b: '#3e3850', hi: '#6a6488', lo: '#26203a', rim: '#2a2440' }
const COPPER = { b: '#b8703a', hi: '#f0a868', lo: '#6a3a1a' }

const lit = (s: GameState) => !!s.flags[F.furnaceLit]

/** Firelight flicker, 0–1. */
function flick(t: number): number {
  return 0.5 + 0.25 * Math.sin(t * 9.1) + 0.15 * Math.sin(t * 23.7 + 1) + 0.1 * Math.sin(t * 3.3)
}

// ---------------------------------------------------------------------------
// Static background
// ---------------------------------------------------------------------------

function walls(g: G, w: number) {
  // Brick, laid in courses.
  R(g, 0, 8, w, FLOOR_Y - 8, '#3a1818')
  for (let y = 9, row = 0; y < FLOOR_Y; y += 6, row++) {
    const off = row % 2 ? 7 : 0
    for (let x = -off; x < w; x += 14) {
      const c = ['#8a3a2e', '#7a3228', '#94402f', '#823629'][Math.floor(hash(row * 131 + x * 7) * 4)]!
      R(g, x + 1, y, 12, 5, c)
      R(g, x + 1, y, 12, 1, mix(c, '#d08070', 0.35))
      R(g, x + 1, y + 4, 12, 1, mix(c, '#3a1818', 0.4))
      if (hash(x * 3 + row) < 0.15) R(g, x + 3 + Math.floor(hash(x + row) * 6), y + 2, 2, 1, mix(c, '#3a1818', 0.5))
    }
  }
  // Soot and damp towards the ceiling and round the furnace.
  for (let y = 8; y < 44; y++) for (let x = 0; x < w; x++) {
    const k = (44 - y) / 36
    if (bayer(x, y) < k * 0.6) P(g, x, y, '#2a1218')
  }
  for (let y = 16; y < FLOOR_Y; y++) for (let x = 30; x < 148; x++) {
    const d = Math.hypot((x - FX) / 62, (y - 44) / 52)
    if (d < 1 && bayer(x, y) < (1 - d) * 0.7) P(g, x, y, '#2a1218')
  }
  // Crooked courses.
  for (let x = 0; x < w; x++) {
    const off = Math.round(Math.sin(x * 0.04 + 2) * 2 + Math.sin(x * 0.011) * 1.5)
    if (off) g.drawImage(g.canvas, x, 8, 1, FLOOR_Y - 8, x, 8 + off, 1, FLOOR_Y - 8)
  }
  R(g, 0, FLOOR_Y - 2, w, 2, '#1e0e12')
}

function ceiling(g: G, w: number) {
  R(g, 0, 0, w, 9, '#1c1020')
  for (let x = 0; x < w; x += 44) {
    R(g, x, 0, 12, 8, '#4a2a1a')
    R(g, x, 0, 1, 8, '#6a4028')
  }
  R(g, 0, 8, w, 1, INK)
}

/** A copper pipe from (x0, y0) to (x1, y1), axis-aligned, `th` thick. */
function pipe(g: G, x0: number, y0: number, x1: number, y1: number, th = 5) {
  if (y0 === y1) {
    const xa = Math.min(x0, x1)
    const xb = Math.max(x0, x1)
    R(g, xa, y0 - 1, xb - xa, th + 2, INK)
    R(g, xa, y0, xb - xa, th, COPPER.b)
    R(g, xa, y0, xb - xa, 1, COPPER.hi)
    R(g, xa, y0 + th - 1, xb - xa, 1, COPPER.lo)
  } else {
    const ya = Math.min(y0, y1)
    const yb = Math.max(y0, y1)
    R(g, x0 - 1, ya, th + 2, yb - ya, INK)
    R(g, x0, ya, th, yb - ya, COPPER.b)
    R(g, x0, ya, 1, yb - ya, COPPER.hi)
    R(g, x0 + th - 1, ya, 1, yb - ya, COPPER.lo)
  }
}

function flange(g: G, x: number, y: number, vertical: boolean) {
  if (vertical) { box(g, x - 1, y, 7, 3, IRON.b, IRON.hi, IRON.lo) } else { box(g, x, y - 1, 3, 7, IRON.b, IRON.hi, IRON.lo) }
}

/** A loop of pipe for no reason at all. */
function curl(g: G, cx: number, cy: number, r: number) {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180
    const x = Math.round(cx + Math.cos(rad) * r)
    const y = Math.round(cy + Math.sin(rad) * r)
    R(g, x - 3, y - 3, 7, 7, INK)
  }
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180
    const x = Math.round(cx + Math.cos(rad) * r)
    const y = Math.round(cy + Math.sin(rad) * r)
    R(g, x - 2, y - 2, 5, 5, COPPER.b)
  }
  for (let a = 180; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180
    P(g, Math.round(cx + Math.cos(rad) * (r + 1)), Math.round(cy + Math.sin(rad) * (r + 1)) - 1, COPPER.hi)
  }
  for (let a = 20; a < 160; a += 2) {
    const rad = (a * Math.PI) / 180
    P(g, Math.round(cx + Math.cos(rad) * (r + 1)), Math.round(cy + Math.sin(rad) * (r + 1)) + 1, COPPER.lo)
  }
}

function pipes(g: G, w: number) {
  // The flue from the furnace, up to the ceiling run.
  pipe(g, FX - 4, 12, FX - 4, 46, 9)
  flange(g, FX - 5, 30, true)
  // Along the ceiling, and up through it into the house (three risers).
  pipe(g, 20, 12, 330, 12, 6)
  for (const x of [150, 262, 316]) { pipe(g, x, 0, x, 12, 5); flange(g, x - 1, 3, true) }
  for (const x of [120, 200, 290]) flange(g, x, 12, false)
  // A second, thinner run that wanders.
  pipe(g, 110, 20, 196, 20, 4)
  pipe(g, 196, 20, 196, 38, 4)
  // The branch down to the gauge, via a pointless loop.
  pipe(g, 212, 17, 212, 42, 4)
  pipe(g, 212, 22, 232, 22, 4)
  pipe(g, 256, 12, 256, 22, 4)
  curl(g, 244, 26, 10)
  // A drip tray under a leaky joint.
  flange(g, 196, 30, true)
  // Pipe down the wall to the floor on the right of the lab door.
  pipe(g, 386, 12, 386, FLOOR_Y, 5)
  pipe(g, 330, 12, 386, 12, 6)
  flange(g, 385, 60, true)
  void w
}

function furnaceBody(g: G) {
  // Feet: four stubby iron claws.
  for (const x of [56, 72, 104, 118]) {
    R(g, x - 3, 104, 8, 7, INK)
    R(g, x - 2, 104, 6, 5, IRON.b)
    R(g, x - 3, 109, 3, 2, IRON.lo); R(g, x + 2, 109, 3, 2, IRON.lo)
    P(g, x - 2, 104, IRON.hi)
  }
  // The potbelly.
  const rx = 38
  const ry = 32
  ellipse(g, FX, FY, rx + 1, ry + 1, INK)
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))))
    for (let x = -half; x <= half; x++) {
      const nx = x / rx
      const ny = y / ry
      const light = -nx * 0.55 - ny * 0.6
      let c = IRON.b
      if (light > 0.62) c = '#8a84a8'
      else if (light > 0.3) c = IRON.hi
      else if (light < -0.45) c = IRON.lo
      if (Math.abs(light - 0.3) < 0.03 || Math.abs(light + 0.45) < 0.03) c = bayer(x, y) < 0.5 ? c : IRON.b
      P(g, FX + x, FY + y, c)
    }
  }
  // Bands, with rivets.
  for (const by of [-18, 20]) {
    const half = Math.round(rx * Math.sqrt(1 - (by * by) / (ry * ry)))
    R(g, FX - half, FY + by - 1, half * 2 + 1, 4, INK)
    R(g, FX - half + 1, FY + by, half * 2 - 1, 2, IRON.rim)
    for (let x = -half + 4; x < half - 2; x += 6) P(g, FX + x, FY + by, '#8a84a8')
  }
  // Collar and dome.
  box(g, FX - 14, 42, 28, 5, IRON.b, IRON.hi, IRON.lo)
  // The eyes: two round damper vents.
  for (const ex of [FX - 13, FX + 13]) {
    ellipse(g, ex, 62, 6, 5, INK)
    ellipse(g, ex, 62, 5, 4, '#5a5478')
    ellipse(g, ex, 62, 3, 2, '#14101e')
    R(g, ex - 3, 62, 7, 1, '#5a5478')
    P(g, ex - 3, 59, '#8a84a8')
  }
  // Heavy brows over the eyes (it looks grumpy).
  line(g, FX - 20, 55, FX - 8, 57, INK, 2)
  line(g, FX + 8, 57, FX + 20, 55, INK, 2)
  // The door's frame.
  ellipse(g, DOOR.cx, DOOR.cy, DOOR.r + 3, DOOR.r + 3, INK)
  ellipse(g, DOOR.cx, DOOR.cy, DOOR.r + 2, DOOR.r + 2, IRON.rim)
  // The ash drawer.
  box(g, FX - 10, 99, 20, 5, IRON.lo, IRON.b, INK)
  R(g, FX - 2, 101, 4, 1, '#8a84a8')
  // The maker's plate.
  box(g, FX + 18, 88, 12, 7, '#c4861c', '#ffd23f', '#8a5a10')
  drawText(g, 'N7', FX + 19, 88, '#5a3a08')
}

function coal(g: G) {
  const cx = 160
  for (let i = 0; i < 70; i++) {
    const u = hash(i * 7 + 3)
    const v = hash(i * 13 + 5)
    const x = cx + Math.round((u - 0.5) * 48 * (1 - v * 0.6))
    const y = 110 - Math.round(v * 22)
    const s = 3 + Math.floor(hash(i) * 3)
    R(g, x - 1, y - 1, s + 2, s + 1, INK)
    R(g, x, y, s, s - 1, '#241e30')
    P(g, x, y, '#6a6a9a')
    if (s > 3) P(g, x + 1, y, '#4a4870')
  }
  // Damp: a dark spread on the floor under it.
  dith(g, cx - 28, 110, 56, 3, '#3a3448', '#26203a', 0.5)
  // The shovel, stuck in, handle up.
  line(g, 177, 74, 173, 96, INK, 3)
  line(g, 177, 74, 173, 96, '#a0643a', 1)
  box(g, 174, 70, 6, 3, '#8a5430', '#c07a44', '#5a3018')
  box(g, 169, 94, 9, 8, '#5a5478', '#8a84a8', '#3a3450')
}

function calendar(g: G) {
  const x = 232
  const y = 34
  // Nail and string.
  P(g, x + 12, y - 4, '#c8c0d8')
  line(g, x + 12, y - 3, x + 4, y, '#c8a060')
  line(g, x + 12, y - 3, x + 20, y, '#c8a060')
  // Hanging a little skewed.
  for (let j = 0; j < 30; j++) {
    const sx = x + Math.round(j * 0.08)
    R(g, sx - 1, y + j, 26, 1, INK)
    R(g, sx, y + j, 24, 1, j < 9 ? '#c8203a' : '#f0e8d8')
  }
  drawText(g, '1987', x + 1, y + 1, '#fff1b0')
  // The days, crossed off.
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
    const dx = x + 2 + c * 4 + Math.round((y + 12 + r * 4 - y) * 0.08)
    const dy = y + 12 + r * 4
    P(g, dx, dy, '#8a7a90')
    if (r * 6 + c < 21) { P(g, dx - 1, dy - 1, '#c8203a'); P(g, dx + 1, dy + 1, '#c8203a') }
  }
  // The twenty-fifth, circled.
  const cx = x + 2 + 3 * 4 + 2
  const cy = y + 12 + 3 * 4 + 1
  for (let a = 0; a < 360; a += 30) P(g, cx + Math.round(Math.cos(a * Math.PI / 180) * 4), cy + Math.round(Math.sin(a * Math.PI / 180) * 3), '#c8203a')
}

function sampler(g: G) {
  // An embroidered sampler in a crooked frame: HOME SWEET HOME, and a little skull.
  const x = 192
  const y = 64
  for (let j = 0; j < 30; j++) {
    const sx = x - Math.round(j * 0.07)
    R(g, sx - 1, y + j, 38, 1, INK)
    R(g, sx, y + j, 36, 1, j < 2 || j > 27 ? '#8a5430' : '#f0e4c8')
    P(g, sx, y + j, '#8a5430'); P(g, sx + 1, y + j, '#c07a44'); P(g, sx + 34, y + j, '#5a3018'); P(g, sx + 35, y + j, '#8a5430')
  }
  drawText(g, 'HOME', x + 6, y + 3, '#c8203a')
  drawText(g, 'SWEET', x + 3, y + 11, '#3a7c78')
  drawText(g, 'HOME', x + 6, y + 19, '#c8203a')
  // The skull, in cross-stitch.
  R(g, x + 30, y + 21, 3, 2, '#5a5270'); P(g, x + 30, y + 23, '#5a5270'); P(g, x + 32, y + 23, '#5a5270')
  // Stitched border dots.
  for (let i = 3; i < 33; i += 3) { P(g, x + i, y + 2, '#c8203a'); P(g, x + i - 1, y + 27, '#3a7c78') }
}

function stool(g: G) {
  const x = 290
  // Legs, splayed.
  line(g, x - 6, 104, x - 9, 120, INK, 2)
  line(g, x + 5, 104, x + 8, 120, INK, 2)
  line(g, x - 1, 104, x - 1, 118, INK, 2)
  line(g, x - 6, 104, x - 8, 119, '#8a5430')
  line(g, x + 5, 104, x + 7, 119, '#8a5430')
  R(g, x - 7, 112, 14, 1, '#5a3018')
  // Seat.
  ellipse(g, x, 103, 9, 2, INK)
  ellipse(g, x, 103, 8, 1, '#a0643a')
  R(g, x - 5, 102, 7, 1, '#c88048')
}

function sideTable(g: G) {
  // A tiny table with a teacup (Bones pours tea he can't drink; it's the principle).
  const x = 310
  R(g, x - 1, 92, 12, 3, INK)
  R(g, x, 92, 10, 1, '#c88048')
  R(g, x, 93, 10, 1, '#8a5430')
  line(g, x + 2, 95, x + 1, 112, INK, 2)
  line(g, x + 8, 95, x + 9, 112, INK, 2)
  // Saucer and cup.
  R(g, x + 1, 90, 8, 2, INK)
  R(g, x + 2, 90, 6, 1, '#e8e4f0')
  R(g, x + 3, 86, 5, 4, INK)
  R(g, x + 4, 86, 3, 3, '#e8e4f0')
  P(g, x + 4, 86, '#8a5430')
  P(g, x + 8, 87, INK); P(g, x + 8, 88, INK)
  // A candle stub.
  R(g, x + 9, 85, 4, 7, INK)
  R(g, x + 10, 86, 2, 6, '#f0e8d0')
  P(g, x + 10, 86, '#ffffff')
}

function labDoorFrame(g: G) {
  // A brick arch round the lab door.
  const x0 = 326
  const x1 = 380
  for (let y = 20; y < FLOOR_Y; y++) {
    R(g, x0, y, x1 - x0, 1, INK)
  }
  // Arch bricks.
  for (let a = 0; a <= 180; a += 15) {
    const rad = (a * Math.PI) / 180
    const bx = Math.round(353 - Math.cos(rad) * 26)
    const by = Math.round(40 - Math.sin(rad) * 20)
    box(g, bx - 3, by - 2, 6, 5, '#9a4a36', '#c07058', '#6a2a20')
  }
  for (let y = 40; y < FLOOR_Y; y += 6) {
    box(g, x0 + 1, y, 5, 5, '#9a4a36', '#c07058', '#6a2a20')
    box(g, x1 - 6, y, 5, 5, '#9a4a36', '#c07058', '#6a2a20')
  }
  // Threshold step.
  box(g, x0 - 2, FLOOR_Y - 3, x1 - x0 + 4, 4, '#5a5470', '#8a84a8', '#3a3450')
}

function labDoorShut(g: G) {
  // The iron door: riveted plates, big hinges, a lightning keyhole, a sign.
  const x = 333
  const y = 26
  const w = 40
  const h = FLOOR_Y - 3 - y
  R(g, x, y + 8, w, h - 8, INK)
  // An arched top.
  for (let j = 0; j < 12; j++) {
    const half = Math.round(Math.sqrt(Math.max(0, 1 - ((12 - j) / 12) ** 2)) * (w / 2))
    R(g, x + w / 2 - half, y + j, half * 2, 1, INK)
    R(g, x + w / 2 - half + 1, y + j, half * 2 - 2, 1, j < 2 ? '#7a7494' : '#4a445e')
  }
  R(g, x + 1, y + 12, w - 2, h - 13, '#4a445e')
  R(g, x + 1, y + 12, 1, h - 13, '#7a7494')
  R(g, x + w - 2, y + 12, 1, h - 13, '#2a2640')
  // Plates and rivets.
  for (const py of [y + 26, y + 50]) {
    R(g, x + 1, py, w - 2, 1, '#2a2640')
    R(g, x + 1, py + 1, w - 2, 1, '#6a6488')
  }
  for (let ry = y + 14; ry < y + h - 2; ry += 6) { P(g, x + 3, ry, '#9a94b8'); P(g, x + w - 4, ry, '#9a94b8') }
  // Hinges.
  for (const hy of [y + 18, y + h - 16]) { R(g, x - 2, hy, 12, 4, INK); R(g, x - 1, hy + 1, 10, 2, '#2a2640') }
  // The warning sign: a yellow triangle with a bolt.
  const sx = x + 20
  const sy = y + 30
  for (let j = 0; j < 12; j++) {
    R(g, sx - Math.ceil(j * 0.6) - 1, sy + j, Math.ceil(j * 0.6) * 2 + 3, 1, INK)
    R(g, sx - Math.ceil(j * 0.6), sy + j, Math.ceil(j * 0.6) * 2 + 1, 1, '#ffd23f')
  }
  line(g, sx + 1, sy + 3, sx - 1, sy + 7, INK)
  line(g, sx - 1, sy + 7, sx + 1, sy + 7, INK)
  line(g, sx + 1, sy + 7, sx - 1, sy + 10, INK)
  drawText(g, 'LAB', x + 11, y + 14, '#9a94b8')
  // The lightning keyhole, in a brass plate.
  box(g, x + 28, y + 48, 7, 12, '#c4861c', '#ffd23f', '#8a5a10')
  P(g, x + 32, y + 50, INK); P(g, x + 31, y + 51, INK); P(g, x + 30, y + 52, INK)
  P(g, x + 31, y + 53, INK); P(g, x + 32, y + 53, INK); P(g, x + 31, y + 54, INK); P(g, x + 30, y + 55, INK)
  // Handle ring.
  ellipse(g, x + 31, y + 66, 3, 3, INK)
  ellipse(g, x + 31, y + 66, 2, 2, '#8a84a8')
  ellipse(g, x + 31, y + 66, 1, 1, '#4a445e')
}

function mousehole(g: G) {
  const x = 386
  const y = FLOOR_Y - 10
  ellipse(g, x + 5, y + 9, 5, 8, INK)
  R(g, x, y + 9, 11, 3, INK)
  ellipse(g, x + 5, y + 9, 4, 7, '#07040d')
  R(g, x + 1, y + 10, 9, 1, '#c8203a') // the doormat
  P(g, x + 11, y + 4, '#ffd23f') // the tiny doorbell
}

// ---------------------------------------------------------------------------
// Animated parts
// ---------------------------------------------------------------------------

function fire(g: G, cx: number, cy: number, r: number, t: number) {
  // The furnace's belly, full of fire.
  ellipse(g, cx, cy, r, r, '#3a0a08')
  for (let y = -r; y <= r; y++) {
    const half = Math.round(r * Math.sqrt(Math.max(0, 1 - (y * y) / (r * r))))
    for (let x = -half; x <= half; x++) {
      const up = (r - y) / (2 * r) // 0 at the bottom, 1 at the top
      const n = Math.sin(x * 0.9 + t * 11) * 0.5 + Math.sin(x * 0.37 - t * 7 + y * 0.4) * 0.5
      const h = up + n * 0.18
      const c = h < 0.3 ? '#fff4b0' : h < 0.48 ? '#ffd23f' : h < 0.66 ? '#ff8a3d' : h < 0.8 ? '#e0402a' : '#5a1210'
      P(g, cx + x, cy + y, c)
    }
  }
  // Coal glowing in the grate.
  for (let x = -r + 2; x < r - 1; x += 3) R(g, cx + x, cy + r - 3, 2, 2, (Math.floor(t * 3 + x) % 3) ? '#ff5a2a' : '#ffd23f')
}

function coldMouth(g: G, cx: number, cy: number, r: number, s: GameState) {
  ellipse(g, cx, cy, r, r, '#120c18')
  // Grey coal and ash, and one very old sock (or the manual, torn up).
  for (let x = -r + 2; x < r - 1; x += 3) { R(g, cx + x, cy + r - 5, 3, 3, '#2e2a3a'); P(g, cx + x, cy + r - 5, '#5a5670') }
  R(g, cx - r + 2, cy + r - 2, r * 2 - 3, 1, '#6a6680')
  if (s.flags[F.furnaceKindling]) {
    // Pages of Kjell's manual under the coal.
    for (const [x, y] of [[-6, 3], [-1, 5], [4, 2], [1, 0]] as const) {
      R(g, cx + x - 1, cy + y - 1, 6, 5, INK)
      R(g, cx + x, cy + y, 4, 3, '#f0ecf8')
      R(g, cx + x + 1, cy + y + 1, 2, 1, '#8a84a8')
    }
    return
  }
  R(g, cx + 2, cy + 3, 5, 3, '#c8203a')
  R(g, cx + 2, cy + 3, 5, 1, '#e8e0e8')
  R(g, cx + 5, cy + 5, 3, 2, '#c8203a')
}

function furnaceDoor(g: G, s: GameState, t: number) {
  const { cx, cy, r } = DOOR
  const open = !!s.flags['boiler.door']
  if (open) {
    if (lit(s)) fire(g, cx, cy, r, t)
    else coldMouth(g, cx, cy, r, s)
    // The door, swung open to the left on its hinge: a narrow ellipse.
    ellipse(g, cx - r - 5, cy, 4, r + 1, INK)
    ellipse(g, cx - r - 5, cy, 3, r, '#4a445e')
    R(g, cx - r - 6, cy - r + 2, 1, r * 2 - 4, '#7a7494')
    return
  }
  // Shut: a round iron door, the grille a row of teeth.
  ellipse(g, cx, cy, r, r, '#4a445e')
  ellipse(g, cx - 2, cy - 3, r - 4, r - 5, '#5e5878')
  for (let i = -3; i <= 3; i++) {
    const x = cx + i * 3
    R(g, x - 1, cy + 1, 2, 6, lit(s) ? (flick(t + i) > 0.55 ? '#ffd23f' : '#ff7a2a') : '#120c18')
  }
  // Handle.
  R(g, cx + r - 5, cy - 2, 4, 3, INK)
  R(g, cx + r - 4, cy - 1, 3, 1, '#9a94b8')
}

function gauge(g: G, s: GameState, t: number) {
  const cx = 214
  const cy = 50
  ellipse(g, cx, cy, 8, 8, INK)
  ellipse(g, cx, cy, 7, 7, '#c4861c')
  ellipse(g, cx, cy, 6, 6, '#f0ecd8')
  // Red zone, top right.
  for (let a = -40; a <= 10; a += 8) {
    const rad = (a * Math.PI) / 180
    P(g, cx + Math.round(Math.cos(rad) * 5), cy + Math.round(Math.sin(rad) * 5), '#c8203a')
  }
  // Green "COSY" zone.
  for (let a = -110; a <= -60; a += 8) {
    const rad = (a * Math.PI) / 180
    P(g, cx + Math.round(Math.cos(rad) * 5), cy + Math.round(Math.sin(rad) * 5), '#3fd8b0')
  }
  const target = lit(s) ? -85 + Math.sin(t * 5) * 6 + Math.sin(t * 13) * 3 : 150 + Math.sin(t * 0.7) * 1.5
  const rad = (target * Math.PI) / 180
  line(g, cx, cy, cx + Math.round(Math.cos(rad) * 5), cy + Math.round(Math.sin(rad) * 5), INK)
  P(g, cx, cy, '#c8203a')
  P(g, cx - 3, cy - 4, '#ffffff')
}

function labDoorOpen(g: G, t: number) {
  const x = 333
  const y = 26
  const w = 40
  // The doorway: the lab's green dark.
  for (let j = 0; j < FLOOR_Y - 3 - y; j++) {
    const half = j < 12 ? Math.round(Math.sqrt(Math.max(0, 1 - ((12 - j) / 12) ** 2)) * (w / 2)) : w / 2
    R(g, x + w / 2 - half, y + j, half * 2, 1, j > 50 ? '#0e2a26' : '#0a1a1c')
  }
  // Checker floor glimpsed beyond, and a bubbling green gleam.
  for (let yy = FLOOR_Y - 14; yy < FLOOR_Y - 3; yy++) for (let xx = x + 2; xx < x + w - 2; xx++) {
    if (((Math.floor((xx - x) / 4) + Math.floor((yy - FLOOR_Y) / 3)) & 1) === 0) P(g, xx, yy, '#2a4a46')
  }
  const b = (t * 0.8) % 1
  P(g, x + 14, y + 50 - Math.round(b * 20), '#6affb0')
  // The door leaf, swung in against the right side.
  R(g, x + w - 7, y + 8, 7, FLOOR_Y - 3 - y - 8, INK)
  R(g, x + w - 6, y + 9, 5, FLOOR_Y - 5 - y - 8, '#4a445e')
  R(g, x + w - 6, y + 9, 1, FLOOR_Y - 5 - y - 8, '#7a7494')
}

function steam(g: G, x: number, y: number, t: number, ph: number) {
  for (let i = 0; i < 3; i++) {
    const u = ((t * 0.6 + ph + i / 3) % 1)
    const px = x + Math.round(Math.sin(u * 6 + ph) * 2 + u * 3)
    const py = y - Math.round(u * 16)
    const r = 1 + Math.floor(u * 3)
    const c = u < 0.5 ? '#d8d4e8' : '#8a86a0'
    if (u > 0.85) continue
    R(g, px - r + 1, py - r + 1, r, r, c)
    if (r > 1) P(g, px, py - r, '#f0ecff')
  }
}

// ---------------------------------------------------------------------------
// The painter
// ---------------------------------------------------------------------------

export const painter: RoomPainter = {
  paint(g, w) {
    walls(g, w)
    slabs(g, 0, w, FLOOR_Y, 144 - FLOOR_Y, w / 2, -150, ['#4a4458', '#443e52', '#504a60', '#46405a'], '#1e1a28', '#5e5872', 9, 36)
    // Coal dust and a drain.
    for (let i = 0; i < 180; i++) {
      const x = Math.floor(hash(i * 3 + 1) * w)
      const y = FLOOR_Y + 2 + Math.floor(hash(i * 5 + 2) * 38)
      if (Math.abs(x - 160) < 70 || hash(i) < 0.3) P(g, x, y, '#26202e')
    }
    box(g, 236, 128, 14, 4, '#26202e')
    for (let x = 238; x < 250; x += 2) R(g, x, 128, 1, 4, '#5e5872')
    ceiling(g, w)
    // The pantry doorway on the left.
    for (let y = 22; y < FLOOR_Y + 1; y++) {
      const l = Math.round((FLOOR_Y - y) * 0.06)
      R(g, 0, y, 20 + l, 1, INK)
      R(g, 0, y, 18 + l, 1, y < 28 ? '#1a2a38' : '#16202e')
    }
    for (let y = 22; y < FLOOR_Y; y += 5) box(g, 19 + Math.round((FLOOR_Y - y) * 0.06), y, 3, 4, '#8a3a2e', '#b0584a', '#5a2018')
    pipes(g, w)
    calendar(g)
    sampler(g)
    furnaceBody(g)
    coal(g)
    stool(g)
    sideTable(g)
    labDoorFrame(g)
    mousehole(g)
    // A caged wall lamp between Bones and the lab door.
    box(g, 316, 34, 7, 3, '#5a5470', '#8a84a8', INK)
    R(g, 317, 37, 1, 7, INK); R(g, 321, 37, 1, 7, INK); R(g, 319, 37, 1, 8, INK)
    R(g, 317, 44, 5, 1, INK)
    cobweb(g, 0, 9, 14, 1, '#7a6a8a')
    cobweb(g, 400 - 1, 9, 10, -1, '#7a6a8a')
  },

  ambient: s => lit(s) ? '#5a4260' : '#3c3a64',

  back(g, s, v) {
    const t = v.t
    furnaceDoor(g, s, t)
    gauge(g, s, t)
    if (s.flags[F.labOpen]) labDoorOpen(g, t)
    else labDoorShut(g)
    // The candle's flame on Bones' table.
    const cf = Math.floor(v.t * 8) % 3
    R(g, 320, 82 - (cf === 1 ? 1 : 0), 1, 3, '#ffd23f')
    P(g, 320, 84, '#ff8a3d')
    // The lamp bulb inside its cage.
    R(g, 318, 38, 3, 5, '#fff0c0')
    R(g, 317, 37, 1, 7, INK); R(g, 321, 37, 1, 7, INK); R(g, 319, 37, 1, 8, INK)
    // A leaky joint drips (cold) or steams (lit).
    if (lit(s)) {
      steam(g, 199, 30, t, 0.1)
      steam(g, 152, 3, t, 0.5)
      steam(g, 388, 58, t, 0.8)
      steam(g, FX - 3, 28, t, 0.3)
      // The pipes knock: a flange jumps now and then.
      const k = Math.floor(t * 1.7) % 5 === 0 && (t * 1.7) % 1 < 0.2
      if (k) { box(g, 199, 11, 3, 7, '#6a6488', '#9a94b8', IRON.lo) }
    } else {
      drip(g, 198, 34, FLOOR_Y + 6, t, 2.2, 0, '#8a9ad8', '#b0c0f0')
      // Frost on the pipes.
      for (const [x, y] of [[40, 12], [120, 19], [216, 30], [260, 12], [300, 11], [388, 30]] as const) { P(g, x, y, '#dfe6ff'); P(g, x + 2, y + 1, '#b0c0f0') }
    }
  },

  front(g, s, v) {
    if (!lit(s)) return
    // Heat shimmer above the furnace: nudge rows of what's already drawn.
    const m = g.getTransform()
    const ox = Math.round(m.e)
    const oy = Math.round(m.f)
    for (let y = 12; y < 44; y++) {
      const dx = Math.round(Math.sin(v.t * 7 + y * 0.6) * 0.8)
      if (!dx) continue
      g.drawImage(g.canvas, FX - 26 + ox, y + oy, 52, 1, FX - 26 + dx, y, 52, 1)
    }
  },

  lights(L, s, v) {
    const t = v.t
    // The caged lamp.
    L(319, 42, 80, '#ffd8a0', 0.8 + 0.03 * Math.sin(t * 17))
    // Bones' candle.
    L(318, 86, 56, '#ffc070', 0.75 + 0.1 * Math.sin(t * 11))
    // Cold blue from the pantry doorway.
    L(6, 70, 30, '#6a86c8', 0.35)
    if (s.flags[F.labOpen]) L(353, 70, 40, '#5affa0', 0.55 + 0.1 * Math.sin(t * 2.3))
    if (!lit(s)) return
    const f = flick(t)
    L(FX, 84, 150, '#ff7a2a', 0.75 + f * 0.25)
    L(FX, 62, 26, '#ffb050', 0.6 + f * 0.3)
    if (s.flags['boiler.door']) L(FX, 90, 70, '#ffc060', 0.7 + f * 0.3)
    L(FX, 30, 50, '#ff5a2a', 0.3)
  },

  glow(g, s, v) {
    const cf = Math.floor(v.t * 8) % 3
    if (!hidden(s, 'boiler', 318, 80, 4, 6, 92)) P(g, 320, 82 - (cf === 1 ? 1 : 0), '#fff4b0')
    if (!lit(s)) return
    const t = v.t
    const f = flick(t)
    // The eyes glow, the belly's underside is red-hot (unless someone stands in front).
    const hideEyes = hidden(s, 'boiler', FX - 20, 56, 40, 12, 110)
    const hideMouth = hidden(s, 'boiler', DOOR.cx - DOOR.r, DOOR.cy - DOOR.r, DOOR.r * 2, DOOR.r * 2, 110)
    const hideBelly = hidden(s, 'boiler', FX - 32, 98, 64, 12, 110)
    if (!hideEyes) for (const ex of [FX - 13, FX + 13]) {
      ellipse(g, ex, 62, 3, 2, f > 0.5 ? '#ffd23f' : '#ff8a3d')
      P(g, ex - 1, 61, '#fff4b0')
    }
    if (hideMouth) { /* the light pool still shows it */ } else if (s.flags['boiler.door']) {
      fire(g, DOOR.cx, DOOR.cy, DOOR.r, t)
    } else {
      for (let i = -3; i <= 3; i++) R(g, DOOR.cx + i * 3 - 1, DOOR.cy + 1, 2, 6, flick(t + i) > 0.55 ? '#ffd23f' : '#ff7a2a')
    }
    if (!hideBelly) for (let x = -30; x <= 30; x++) {
      const y = Math.round(FY + 32 * Math.sqrt(Math.max(0, 1 - (x * x) / (38 * 38))))
      if (((x + Math.floor(t * 4)) & 3) !== 0) P(g, FX + x, y - 1, mix('#e0402a', '#ff8a3d', f))
    }
    // Sparks up the flue now and then.
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.9 + i * 0.37) % 1
      if (u > 0.6) continue
      P(g, FX - 1 + Math.round(Math.sin(u * 9 + i) * 3), 44 - Math.round(u * 30), u < 0.3 ? '#ffd23f' : '#ff8a3d')
    }
  },
}

export type { View }
