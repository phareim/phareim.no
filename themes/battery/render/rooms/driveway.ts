/**
 * The Driveway: the coast road in the storm, the sea far below on the
 * left, Villa Voltvik crooked on its cliff behind the iron gate, and
 * Brunhilde (brick-red 1987 Volvo 240 estate, roof box).
 *
 * `paintVilla`/`villaLive`/`villaGlow`/`villaLights` and `paintCar`/
 * `carGlow`/`carLights` are shared with the title screen.
 */
import type { GameState } from '../../types'
import type { G, LightFn, RoomPainter, View } from '../api'
import { bayer } from '../../../base/pixel/sprites'
import { hash2, noise1 } from '../../../base/pixel/scenery'
import { bolt, hash } from '../fx'
import { F } from '../../content/flags'
import { carState, carX, CAR, GATE } from '../../content/rooms/driveway'

const K = '#0b0616'

function r(g: G, c: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(Math.round(x), Math.round(y), w, h)
}

/** A rectangle whose rows slide sideways with height: the house leans. */
function srect(g: G, c: string, x: number, y: number, w: number, h: number, yb: number, k: number) {
  g.fillStyle = c
  for (let yy = y; yy < y + h; yy++) g.fillRect(Math.round(x + (yb - yy) * k), yy, w, 1)
}

// ---------------------------------------------------------------------------
// Villa Voltvik (x0 = left edge, yb = the ground it stands on; ~200 × 66)
// ---------------------------------------------------------------------------

const MAIN_K = 0.05
const TURRET_K = -0.1
const TOWER_K = 0.1

const VC = {
  wall: '#5b3f8c', wallHi: '#7a5aae', wallLo: '#3d2a66', board: '#4d3580',
  trim: '#e070b0', trimLo: '#8c2e72', gold: '#ffd23f',
  roof: '#1f5a6a', roofHi: '#2f8490', roofLo: '#143c4a', roofDot: '#0f2c38',
  plinth: '#342a58', plinthLo: '#261e44',
  pane: '#ffd23f', paneLo: '#ff9a3d', paneDark: '#2a2250',
  brick: '#8a3a4a', brickHi: '#b04a5a',
  glass: '#1f7a6e', glassHi: '#3fd8b0', frame: '#cfc6ff',
}

interface Win { x: number; y: number; w: number; h: number; k: number; yb: number; kind: 'warm' | 'violet' | 'cellar' | 'round'; flicker?: number }

function villaWindows(x0: number, yb: number): Win[] {
  const W: Win[] = []
  const main = (x: number, y: number, w: number, h: number, kind: Win['kind'] = 'warm', flicker?: number) =>
    W.push({ x: x0 + x, y: yb - y, w, h, k: MAIN_K, yb, kind, flicker })
  // Ground floor: kitchen (left), the fanlight over the door, parlour (right).
  main(32, 27, 7, 11)
  main(48, 27, 7, 11, 'warm', 3)
  main(84, 30, 8, 3)
  main(110, 27, 7, 11)
  main(128, 27, 7, 11, 'warm', 7)
  // Attic dormers: the storeroom (candle) and the study (violet lamp).
  main(47, 42, 6, 6, 'warm', 11)
  main(107, 42, 6, 6, 'violet')
  // Cellar windows at the foot.
  main(40, 6, 5, 3, 'cellar')
  main(118, 6, 5, 3, 'cellar')
  // Turret slits and the tower's oculus.
  W.push({ x: x0 + 11, y: yb - 34, w: 3, h: 7, k: TURRET_K, yb, kind: 'warm' })
  W.push({ x: x0 + 11, y: yb - 20, w: 3, h: 7, k: TURRET_K, yb, kind: 'warm', flicker: 5 })
  W.push({ x: x0 + 156, y: yb - 42, w: 5, h: 5, k: TOWER_K, yb, kind: 'round' })
  W.push({ x: x0 + 156, y: yb - 27, w: 5, h: 10, k: TOWER_K, yb, kind: 'warm' })
  return W
}

function drawWin(g: G, w: Win, lit: boolean, t: number, furnace: boolean) {
  const sh = (yy: number) => Math.round(w.x + (w.yb - yy) * w.k)
  // Frame
  g.fillStyle = K
  for (let yy = w.y - 1; yy <= w.y + w.h; yy++) g.fillRect(sh(yy) - 1, yy, w.w + 2, 1)
  let top = VC.pane
  let low = VC.paneLo
  if (w.kind === 'violet') { top = '#e8b0ff'; low = '#b06aff' }
  if (w.kind === 'cellar') { top = furnace ? '#ffb13f' : '#3a2e62'; low = furnace ? '#ff5a2a' : '#2a2250' }
  if (w.kind === 'round') { top = '#bfefff'; low = '#6ad0ff' }
  if (!lit) { top = VC.paneDark; low = '#1c1438' }
  if (lit && w.flicker !== undefined) {
    const f = hash2(Math.floor(t * 9), w.flicker, 3)
    if (f < 0.12) { top = '#8a5a30'; low = '#6a3a20' } else if (f < 0.3) { top = '#ffe680'; low = '#ffb050' }
  }
  for (let yy = w.y; yy < w.y + w.h; yy++) {
    g.fillStyle = yy < w.y + Math.ceil(w.h / 2) ? top : low
    g.fillRect(sh(yy), yy, w.w, 1)
  }
  // Mullions
  if (w.h >= 6 && w.w >= 5) {
    g.fillStyle = K
    const my = w.y + Math.floor(w.h / 2)
    g.fillRect(sh(my), my, w.w, 1)
    for (let yy = w.y; yy < w.y + w.h; yy++) g.fillRect(sh(yy) + Math.floor(w.w / 2), yy, 1, 1)
  }
  if (w.kind === 'round') { r(g, K, sh(w.y), w.y); r(g, K, sh(w.y) + w.w - 1, w.y); r(g, K, sh(w.y + w.h - 1), w.y + w.h - 1); r(g, K, sh(w.y + w.h - 1) + w.w - 1, w.y + w.h - 1) }
}

/** The house itself, static. */
export function paintVilla(g: G, x0: number, yb: number) {
  // Right tower (behind the main block's right edge)
  const tw = (y: number) => Math.round((yb - y) * TOWER_K)
  for (let y = yb - 50; y < yb; y++) {
    const x = x0 + 148 + tw(y)
    r(g, K, x - 1, y, 24)
    r(g, VC.wallHi, x, y, 3)
    r(g, VC.wall, x + 3, y, 14)
    r(g, VC.wallLo, x + 17, y, 5)
    if ((yb - y) % 4 === 0) r(g, VC.board, x + 1, y, 20)
  }
  // Tower roof: a crooked pyramid, then the rooster vane.
  for (let i = 0; i <= 11; i++) {
    const y = yb - 61 + i
    const half = Math.round(i * 1.2) + 1
    const cx = x0 + 159 + tw(y) + Math.round((11 - i) * 0.35)
    r(g, K, cx - half - 1, y, half * 2 + 3)
    r(g, VC.roofHi, cx - half, y, Math.max(1, half))
    r(g, VC.roof, cx, y, half + 1)
    if (i > 2 && i % 3 === 0) r(g, VC.roofDot, cx - half + (i % 2), y, half * 2 + 1)
  }
  r(g, VC.trim, x0 + 146 + tw(yb - 50), yb - 50, 26)
  // Vane pole and rooster
  const vx = x0 + 163 + tw(yb - 64)
  r(g, K, vx, yb - 66, 1, 6)
  r(g, K, vx - 3, yb - 66, 6, 1)
  r(g, VC.gold, vx - 2, yb - 68, 4, 2)
  r(g, VC.gold, vx + 1, yb - 69, 1, 1)
  r(g, '#ff3b5c', vx + 2, yb - 70, 1, 1)
  r(g, VC.gold, vx - 3, yb - 70, 1, 2)

  // Plinth (the cellar's stone foot)
  for (let y = yb - 7; y < yb; y++) {
    const x = x0 + 20 + Math.round((yb - y) * MAIN_K)
    r(g, K, x - 1, y, 138)
    r(g, VC.plinth, x, y, 136)
    g.fillStyle = VC.plinthLo
    for (let bx = ((yb - y) % 3) * 3; bx < 136; bx += 9) g.fillRect(x + bx, y, 1, 1)
  }
  r(g, '#4a3e78', x0 + 20, yb - 7, 136)

  // Main block: clapboard walls, rose corner boards.
  for (let y = yb - 31; y < yb - 7; y++) {
    const x = x0 + 22 + Math.round((yb - y) * MAIN_K)
    r(g, K, x - 1, y, 132)
    r(g, VC.wall, x, y, 130)
    if ((yb - y) % 3 === 0) r(g, VC.board, x, y, 130)
    r(g, VC.wallHi, x, y, 2)
    r(g, VC.trim, x + 2, y, 2)
    r(g, VC.trim, x + 126, y, 2)
    r(g, VC.wallLo, x + 128, y, 2)
  }
  // The front door: arched, with a porch roof and steps.
  srect(g, K, x0 + 82, yb - 24, 12, 17, yb, MAIN_K)
  srect(g, '#8c2e72', x0 + 83, yb - 23, 10, 16, yb, MAIN_K)
  srect(g, '#b8468f', x0 + 83, yb - 23, 2, 16, yb, MAIN_K)
  srect(g, K, x0 + 87, yb - 20, 1, 13, yb, MAIN_K)
  r(g, VC.gold, x0 + 91 + Math.round(15 * MAIN_K), yb - 15, 1, 1)
  // Porch pediment
  for (let i = 0; i < 6; i++) {
    const y = yb - 32 + i
    const x = x0 + 88 - i * 2 + Math.round((yb - y) * MAIN_K)
    r(g, K, x - 1, y, i * 4 + 3)
    r(g, i === 5 ? VC.trimLo : VC.trim, x, y, i * 4 + 1)
  }
  // Steps
  r(g, '#6a5a8a', x0 + 80, yb - 2, 16, 1)
  r(g, '#4a3e78', x0 + 78, yb - 1, 20, 1)
  // Porch lamp
  r(g, K, x0 + 77, yb - 22, 3, 4)
  r(g, VC.gold, x0 + 78, yb - 21, 1, 2)

  // Mansard roof, scalloped slates, rose eave.
  for (let i = 0; i <= 14; i++) {
    const y = yb - 45 + i
    const sh = Math.round((yb - y) * MAIN_K)
    const xl = x0 + 30 - i + sh
    const xr = x0 + 144 + i + sh
    r(g, K, xl - 1, y, xr - xl + 2)
    r(g, i === 0 ? VC.roofHi : VC.roof, xl, y, xr - xl)
    if (i > 0 && i < 14) {
      g.fillStyle = i % 3 === 0 ? VC.roofLo : VC.roofDot
      const step = i % 3 === 0 ? 1 : 4
      for (let x = xl + ((i >> 1) % 2) * 2; x < xr; x += step) g.fillRect(x, y, 1, 1)
      r(g, VC.roofHi, xl, y, 1)
    }
    if (i === 14) { r(g, VC.trim, xl, y, xr - xl); r(g, VC.trimLo, xl, y + 1, xr - xl) }
  }
  // Chimney
  srect(g, K, x0 + 65, yb - 55, 10, 11, yb, MAIN_K)
  srect(g, VC.brick, x0 + 66, yb - 54, 8, 10, yb, MAIN_K)
  srect(g, VC.brickHi, x0 + 66, yb - 54, 2, 10, yb, MAIN_K)
  srect(g, '#3a1a2a', x0 + 64, yb - 56, 12, 2, yb, MAIN_K)
  // Dormers
  for (const dx of [44, 104]) {
    srect(g, K, x0 + dx - 1, yb - 45, 14, 12, yb, MAIN_K)
    srect(g, VC.wall, x0 + dx, yb - 44, 12, 11, yb, MAIN_K)
    srect(g, VC.wallHi, x0 + dx, yb - 44, 1, 11, yb, MAIN_K)
    for (let i = 0; i < 7; i++) {
      const y = yb - 51 + i
      const x = x0 + dx + 6 - i + Math.round((yb - y) * MAIN_K)
      r(g, K, x - 1, y, i * 2 + 3)
      r(g, i === 6 ? VC.trim : VC.roof, x, y, i * 2 + 1)
    }
  }

  // Left turret: a round tower leaning left, cone roof, pennant.
  const tu = (y: number) => Math.round((yb - y) * TURRET_K)
  for (let y = yb - 42; y < yb; y++) {
    const x = x0 + 2 + tu(y)
    r(g, K, x - 1, y, 24)
    r(g, VC.wallHi, x, y, 4)
    r(g, VC.wall, x + 4, y, 12)
    r(g, VC.wallLo, x + 16, y, 6)
    if ((yb - y) % 4 === 0) { r(g, VC.board, x + 2, y, 18) }
  }
  r(g, VC.trim, x0 + 1 + tu(yb - 42), yb - 42, 24)
  for (let i = 0; i <= 22; i++) {
    const y = yb - 64 + i
    const half = Math.round(i * 0.62) + 1
    const cx = x0 + 13 + tu(y) + Math.round((22 - i) * -0.25)
    r(g, K, cx - half - 1, y, half * 2 + 3)
    for (let x = -half; x <= half; x++) {
      const u = (x + half) / (half * 2 + 1)
      r(g, u < 0.25 ? VC.roofHi : u > 0.72 ? VC.roofLo : VC.roof, cx + x, y)
    }
    if (i % 4 === 3) r(g, VC.roofDot, cx - half, y, half * 2 + 1)
  }
  const tip = x0 + 13 + tu(yb - 64) + Math.round(22 * -0.25)
  r(g, K, tip, yb - 70, 1, 6)
  r(g, '#ff5c7a', tip + 1, yb - 70, 4, 1)
  r(g, '#ff5c7a', tip + 1, yb - 69, 2, 1)

  // Conservatory: a glass lean-to on the right, Gustav inside.
  const cx0 = x0 + 172
  for (let y = yb - 20; y < yb; y++) {
    r(g, K, cx0 - 1, y, 30)
    r(g, VC.glass, cx0, y, 28)
    g.fillStyle = VC.frame
    for (let x = 0; x < 28; x += 6) g.fillRect(cx0 + x, y, 1, 1)
  }
  for (let i = 0; i < 7; i++) {
    const y = yb - 27 + i
    const w = Math.round(28 * Math.sqrt(1 - ((6 - i) / 7) ** 2))
    r(g, K, cx0 - 1, y, w + 2)
    r(g, i === 0 ? VC.frame : VC.glass, cx0, y, w)
  }
  r(g, VC.frame, cx0, yb - 20, 28)
  r(g, VC.frame, cx0, yb - 11, 28)
  // Gustav: a big jaw on a stalk, leaves, a pot
  r(g, '#7a3a2a', cx0 + 11, yb - 6, 11, 5)
  r(g, '#9a4a3a', cx0 + 11, yb - 6, 11, 1)
  r(g, '#1f5a2a', cx0 + 15, yb - 11, 2, 5)
  r(g, '#2a7a3a', cx0 + 8, yb - 9, 7, 2)
  r(g, '#2a7a3a', cx0 + 17, yb - 10, 7, 2)
  r(g, '#3a9a3a', cx0 + 11, yb - 19, 11, 4)
  r(g, '#1f5a2a', cx0 + 11, yb - 15, 11, 4)
  r(g, '#ff5c7a', cx0 + 12, yb - 16, 9, 2)
  g.fillStyle = '#fff4ff'
  for (let i = 0; i < 4; i++) { g.fillRect(cx0 + 12 + i * 3, yb - 16, 1, 1); g.fillRect(cx0 + 13 + i * 3, yb - 15, 1, 1) }
  r(g, '#ffd23f', cx0 + 18, yb - 18, 1, 1)
  // The lightning cable down the wall, into the conservatory.
  for (let y = yb - 45; y < yb - 20; y++) r(g, '#1c1030', x0 + 145 + Math.round((yb - y) * MAIN_K), y)
}

/** The rod (lying flat, or raised) and the chimney smoke: state and time. */
export function villaLive(g: G, x0: number, yb: number, t: number, rodUp: boolean) {
  const rx = x0 + 133 + Math.round(46 * MAIN_K)
  if (rodUp) {
    r(g, K, rx - 1, yb - 64, 3, 19)
    r(g, '#d8d8f0', rx, yb - 63, 1, 18)
    r(g, VC.gold, rx - 1, yb - 66, 3, 3)
  } else {
    r(g, K, rx - 10, yb - 48, 20, 3)
    r(g, '#9a9ab8', rx - 9, yb - 47, 18, 1)
    r(g, VC.gold, rx + 9, yb - 48, 2, 2)
  }
  // Smoke from the parlour's chimney (Hedvig's fire), leaning in the wind.
  for (let i = 0; i < 6; i++) {
    const age = (t * 0.7 + i / 6) % 1
    const x = x0 + 70 + Math.round((56 * MAIN_K)) - age * 26
    const y = yb - 57 - age * 14
    const s = 1 + Math.floor(age * 3)
    g.globalAlpha = 0.55 * (1 - age)
    r(g, '#8f86b8', x, y, s, s)
    g.globalAlpha = 1
  }
}

/** Lit windows at full brightness (after the light map). */
export function villaGlow(g: G, x0: number, yb: number, t: number, furnace: boolean, flash: number) {
  for (const w of villaWindows(x0, yb)) drawWin(g, w, true, t, furnace)
  // The gold porch lamp and the rooster catch the lightning.
  r(g, VC.gold, x0 + 78, yb - 21, 1, 2)
  if (flash > 0.4) {
    g.globalAlpha = Math.min(1, flash)
    const vx = x0 + 163 + Math.round(64 * TOWER_K)
    r(g, '#ffffff', vx - 2, yb - 68, 4, 2)
    g.globalAlpha = 1
  }
}

export function villaLights(L: LightFn, x0: number, yb: number, furnace: boolean) {
  L(x0 + 40, yb - 22, 16, '#ffb050', 0.55)
  L(x0 + 120, yb - 22, 16, '#ffb050', 0.55)
  L(x0 + 50, yb - 40, 10, '#ffb050', 0.4)
  L(x0 + 110, yb - 40, 10, '#c080ff', 0.45)
  L(x0 + 79, yb - 20, 12, '#ffd080', 0.7)
  L(x0 + 186, yb - 12, 16, '#3fd8b0', 0.35)
  if (furnace) L(x0 + 80, yb - 4, 22, '#ff7a30', 0.5)
}

// ---------------------------------------------------------------------------
// Brunhilde (cx = her middle, gy = the road under her wheels; ~92 × 42)
// ---------------------------------------------------------------------------

const CC = {
  body: '#b0402c', hi: '#d8644c', lo: '#7a2a20', dark: '#4a1a14',
  glass: '#26345a', glint: '#6a7ab0', chrome: '#c8c8dc', chromeLo: '#6a6a88',
  tyre: '#0b0616', rim: '#8f86b8', box: '#2e2844', boxHi: '#4a4270',
}

export type CarState = 'lit' | 'dead' | 'open' | 'running'

export function paintCar(g: G, cx: number, gy: number, state: CarState, t: number) {
  const x0 = Math.round(cx) - 46
  const y = (dy: number) => gy - dy
  const bonnetUp = state === 'open'
  const shake = state === 'running' ? (Math.floor(t * 20) % 2) : 0
  const yo = -shake
  const R = (c: string, x: number, dy: number, w = 1, h = 1) => r(g, c, x0 + x, y(dy) + yo, w, h)
  // Shadow on the wet road
  g.globalAlpha = 0.45
  r(g, K, x0 + 4, gy - 1, 86, 2)
  g.globalAlpha = 1
  // Roof box
  R(K, 11, 42, 34, 7)
  R(CC.box, 12, 41, 32, 5)
  R(CC.boxHi, 13, 41, 30, 1)
  R(K, 10, 36, 36, 1)
  // Greenhouse (estate: a square back, a raked windscreen)
  for (let dy = 35; dy >= 21; dy--) {
    const front = 58 + Math.round((35 - dy) * 0.55)
    R(K, 1, dy, front)
    R(CC.body, 2, dy, front - 2)
  }
  R(CC.hi, 2, 35, 56, 1)
  R(CC.chrome, 3, 36, 52, 1)
  // Side windows, pillars between
  const windows: [number, number][] = [[4, 20], [26, 45], [48, 56]]
  for (const [a, b] of windows) {
    for (let dy = 33; dy >= 23; dy--) {
      const bb = b === 56 ? 55 + Math.round((33 - dy) * 0.55) : b
      R(CC.glass, a, dy, bb - a)
    }
    R(CC.glint, a + 2, 31, 3, 1)
    R(CC.glint, a + 3, 30, 2, 1)
  }
  // Windscreen edge
  for (let dy = 33; dy >= 22; dy--) R(K, 58 + Math.round((33 - dy) * 0.55) + 1, dy)
  // Body: shoulder, doors, rubbing strip, sills
  for (let dy = 21; dy >= 6; dy--) {
    const rear = 0
    const front = 92
    R(K, rear, dy, front - rear)
    const c = dy >= 19 ? CC.hi : dy <= 8 ? CC.lo : CC.body
    R(c, rear + 1, dy, front - rear - 2)
  }
  if (!bonnetUp) R(CC.hi, 64, 21, 26, 1)
  R('#1c1030', 1, 11, 90, 2)
  R(CC.dark, 24, 20, 1, 13)
  R(CC.dark, 46, 20, 1, 13)
  R(CC.chrome, 20, 17, 3, 1)
  R(CC.chrome, 42, 17, 3, 1)
  // Tail light and front lamp
  R('#c02030', 1, 20, 2, 7)
  R('#ff8a3d', 1, 13, 2, 2)
  const litLamp = state === 'lit' || state === 'running'
  R(litLamp ? '#fff4c0' : '#8a8aa0', 88, 18, 3, 4)
  R('#ff8a3d', 89, 13, 2, 2)
  R(CC.chrome, 90, 16, 2, 1)
  // Bumpers
  R(K, -2, 9, 6, 3)
  R(CC.chromeLo, -1, 8, 4, 1)
  R(K, 88, 9, 6, 3)
  R(CC.chromeLo, 89, 8, 4, 1)
  // Wheel arches and wheels
  for (const wx of [18, 72]) {
    for (let dy = 14; dy >= 6; dy--) {
      const hw = Math.round(Math.sqrt(Math.max(0, 64 - (dy - 6) ** 2)))
      R('#1c1030', wx - hw, dy, hw * 2 + 1)
    }
    for (let dy = -6; dy <= 6; dy++) {
      const hw = Math.round(Math.sqrt(36 - dy * dy + 2))
      R(CC.tyre, wx - hw, 6 + dy, hw * 2 + 1)
    }
    const spin = state === 'running' || state === 'lit' ? Math.floor(t * 12) % 2 : 0
    R(CC.rim, wx - 2, 8, 5, 5)
    R(CC.chrome, wx - 1 + spin, 9, 2, 2)
    R(K, wx, 10, 1, 1)
  }
  // Number plate
  R('#e8e4d0', 83, 12, 1, 3)
  // The bonnet: up, with the cracked battery showing, or shut.
  if (bonnetUp) {
    R('#1c1030', 62, 21, 28, 3)
    R(K, 70, 25, 10, 5)
    R('#3a3452', 71, 24, 8, 3)
    R('#ff3b5c', 71, 25, 2, 1)
    R('#8f86b8', 77, 25, 2, 1)
    R('#fff4ff', 73, 23, 1, 1)
    R('#fff4ff', 74, 22, 1, 1)
    R('#fff4ff', 75, 23, 1, 1)
    R('#fff4ff', 76, 22, 1, 1)
    // The raised lid, hinged at the windscreen
    for (let i = 0; i < 24; i++) {
      const bx = 62 + Math.round(i * 0.5)
      const dy = 22 + i
      R(K, bx - 1, dy, 5)
      R(CC.body, bx, dy, 2)
      R(CC.lo, bx + 2, dy, 1)
    }
  }
}

export function carGlow(g: G, cx: number, gy: number, state: CarState, t: number) {
  const x0 = Math.round(cx) - 46
  const lit = state === 'lit' || state === 'running'
  if (lit) {
    r(g, '#fff4c0', x0 + 88, gy - 18, 3, 4)
    // The beam: a pale cone in steps, brightest at the lamp
    g.fillStyle = '#fff4c0'
    for (let d = 0; d < 60; d++) {
      const half = 1 + Math.floor(d * 0.3)
      const cy = gy - 16 + Math.floor(d * 0.14)
      g.globalAlpha = 0.34 * Math.pow(1 - d / 60, 1.3)
      g.fillRect(x0 + 92 + d, cy - half, 1, half * 2 + 2)
      g.globalAlpha = 0.3 * (1 - d / 60)
      g.fillRect(x0 + 92 + d, cy - Math.floor(half / 3), 1, Math.floor(half / 3) * 2 + 2)
    }
    g.globalAlpha = 1
  }
  if (state === 'dead' || state === 'open') {
    if (Math.floor(t * 1.6) % 2 === 0) {
      r(g, '#ffb13f', x0 + 1, gy - 13, 2, 2)
      r(g, '#ffb13f', x0 + 89, gy - 13, 2, 2)
    }
  } else {
    r(g, '#ff3040', x0 + 1, gy - 20, 2, 3)
  }
  if (state === 'running') {
    for (let i = 0; i < 5; i++) {
      const age = (t * 1.3 + i / 5) % 1
      const s = 1 + Math.floor(age * 3)
      g.globalAlpha = 0.5 * (1 - age)
      r(g, '#cfc6ff', x0 - 3 - age * 22, gy - 6 - age * 8, s, s)
      g.globalAlpha = 1
    }
  }
}

export function carLights(L: LightFn, cx: number, gy: number, state: CarState, t: number) {
  const x0 = Math.round(cx) - 46
  if (state === 'lit' || state === 'running') {
    L(x0 + 120, gy - 10, 42, '#fff0c0', 0.75)
    L(x0 + 92, gy - 16, 12, '#fff4c0', 0.9)
  }
  if ((state === 'dead' || state === 'open') && Math.floor(t * 1.6) % 2 === 0) {
    L(x0 + 2, gy - 12, 14, '#ff9a30', 0.8)
    L(x0 + 90, gy - 12, 14, '#ff9a30', 0.8)
  }
}

// ---------------------------------------------------------------------------
// The storm sky, the sea, the cliff (shared with the title)
// ---------------------------------------------------------------------------

/** Night storm sky from 0 to `h`: dark top, bruised violet at the horizon, heavy clouds. */
export function paintStormSky(g: G, x: number, w: number, h: number, salt = 1) {
  const stops = ['#07061a', '#0d0b26', '#141236', '#1c1846', '#262058', '#2e2766']
  for (let y = 0; y < h; y++) {
    const t = (y / Math.max(1, h - 1)) * (stops.length - 1)
    const i = Math.min(stops.length - 2, Math.floor(t))
    const f = t - i
    for (let px = 0; px < w; px++) {
      g.fillStyle = bayer(x + px, y) < f ? stops[i + 1]! : stops[i]!
      g.fillRect(x + px, y, 1, 1)
    }
  }
  // Cloud banks: lumpy bottoms, faint rims.
  const banks = [
    { top: 0, base: Math.round(h * 0.28), c: '#0a0820', rim: '#1e1a44', cell: 22 },
    { top: Math.round(h * 0.12), base: Math.round(h * 0.5), c: '#110e2c', rim: '#2a2458', cell: 16 },
    { top: Math.round(h * 0.4), base: Math.round(h * 0.7), c: '#1a1640', rim: '#3a3272', cell: 12 },
  ]
  banks.forEach((b, bi) => {
    for (let px = 0; px < w; px++) {
      const n = noise1(x + px, b.cell, salt * 7 + bi) * 0.7 + noise1(x + px, b.cell / 3, salt * 13 + bi) * 0.3
      const bottom = Math.round(b.top + (b.base - b.top) * n)
      if (bottom <= b.top) continue
      r(g, b.c, x + px, b.top, 1, bottom - b.top)
      r(g, b.rim, x + px, bottom, 1, 1)
      if (hash2(x + px, bi, salt) < 0.4) r(g, b.rim, x + px, bottom - 1, 1, 1)
    }
  })
}

/** The sea between `top` (horizon) and `bottom`, x0..x0+w. */
export function paintSea(g: G, x0: number, w: number, top: number, bottom: number) {
  for (let y = top; y < bottom; y++) {
    const u = (y - top) / Math.max(1, bottom - top)
    const c = u < 0.08 ? '#2a3a78' : u < 0.4 ? '#16265a' : '#101c44'
    r(g, c, x0, y, w, 1)
    g.fillStyle = '#1e3068'
    for (let x = 0; x < w; x++) if (hash2(x0 + x, y, 9) < 0.08 + u * 0.05) g.fillRect(x0 + x, y, 2, 1)
  }
}

/** Whitecaps that come and go. */
export function seaLive(g: G, x0: number, w: number, top: number, bottom: number, t: number) {
  for (let i = 0; i < Math.floor(w / 5); i++) {
    const x = x0 + Math.floor(hash(i * 31 + 7) * w)
    const y = top + 2 + Math.floor(hash(i * 17 + 3) * (bottom - top - 3))
    const ph = (t * 0.5 + hash(i * 5 + 1)) % 1
    if (ph < 0.35) {
      const len = 1 + Math.floor(ph * 8) + Math.floor((y - top) / 10)
      r(g, ph < 0.15 ? '#9fc0ff' : '#5a78c0', x, y, len, 1)
    }
  }
}

// ---------------------------------------------------------------------------
// The room
// ---------------------------------------------------------------------------

const VX = 236
const VY = 66
const HORIZON = 60

function paintCliff(g: G, w: number) {
  // Rock from the slope at x ~150 up to the flat top under the house.
  for (let x = 140; x < w; x++) {
    const topY = x < 228 ? Math.round(100 - (x - 140) * (34 / 88)) : VY - 1 + Math.round(noise1(x, 9, 4) * 2)
    for (let y = topY; y < 104; y++) {
      // Slanting strata with cracks, lit from the upper left.
      const band = Math.floor((y + x * 0.35 + noise1(x, 11, 7) * 6) / 5)
      const edge = (y + x * 0.35 + noise1(x, 11, 7) * 6) % 5
      const lit = hash2(band, Math.floor(x / 23), 2)
      let c = lit < 0.35 ? '#2d2350' : lit > 0.8 ? '#1a1432' : '#231a3e'
      if (edge < 1) c = '#150f28'
      else if (edge < 2 && lit < 0.6) c = '#3a2e62'
      if (y === topY) c = '#1f5a50'
      else if (y === topY + 1) c = '#173c3c'
      r(g, c, x, y)
    }
    if (hash2(x, 0, 5) < 0.3) r(g, '#2a8579', x, topY - 1)
  }
  // The path: steps from the gate up to the door.
  for (let i = 0; i < 9; i++) {
    const y = 99 - i * 4
    const x = 300 + Math.round(i * 2.6)
    r(g, K, x - 1, y - 1, 16, 4)
    r(g, '#6a5a8a', x, y - 1, 14, 1)
    r(g, '#4a3e78', x, y, 14, 2)
  }
}

function paintWall(g: G, w: number) {
  for (let y = 90; y < 104; y++) {
    for (let x = 150; x < w; x++) {
      const row = Math.floor((y - 90) / 4)
      const brick = ((x + row * 5) % 11 === 0) || (y - 90) % 4 === 3
      r(g, y < 92 ? '#5a5288' : brick ? '#241c40' : hash2(Math.floor((x + row * 5) / 11), row, 1) < 0.5 ? '#3a3060' : '#342a58', x, y)
    }
  }
  r(g, K, 150, 89, w - 150, 1)
  // Gate pillars with lamp globes
  for (const px of [268, 332]) {
    for (let y = 60; y < 104; y++) {
      r(g, K, px - 1, y, 12)
      r(g, y < 63 ? '#6f62a4' : '#4a3e78', px, y, 10)
      r(g, '#5f5294', px, y, 2)
      r(g, '#2f2654', px + 8, y, 2)
      if ((y - 60) % 6 === 5) r(g, '#2f2654', px, y, 10)
    }
    r(g, K, px - 2, 58, 14, 3)
    r(g, '#6f62a4', px - 1, 58, 12, 2)
    r(g, K, px + 2, 50, 6, 8)
    r(g, '#ffd23f', px + 3, 51, 4, 6)
    r(g, K, px + 3, 49, 4, 1)
  }
}

function paintGuardRail(g: G) {
  for (let x = 0; x < 152; x++) {
    r(g, '#a8a0c8', x, 96)
    r(g, '#6a6290', x, 97)
    if (x % 16 === 4) { r(g, K, x - 1, 95, 4, 10); r(g, '#8a82b0', x, 96, 2, 8) }
  }
  // The signpost: VOLTVIK, with a crooked arrow.
  r(g, K, 55, 80, 3, 24)
  r(g, '#6a4432', 56, 80, 1, 24)
  for (let y = 0; y < 10; y++) {
    const sh = Math.round(y * -0.2)
    r(g, K, 36 + sh, 78 + y, 44)
    r(g, y === 0 ? '#8a5a40' : '#6a4432', 37 + sh, 78 + y, 40)
    if (y > 2 && y < 8) r(g, '#6a4432', 77 + sh, 78 + y, 3 - Math.abs(y - 5))
  }
  // V O L T V I K in 3×5 letters
  const glyph: Record<string, string[]> = {
    V: ['1.1', '1.1', '1.1', '1.1', '.1.'], O: ['.1.', '1.1', '1.1', '1.1', '.1.'], L: ['1..', '1..', '1..', '1..', '111'],
    T: ['111', '.1.', '.1.', '.1.', '.1.'], I: ['1', '1', '1', '1', '1'], K: ['1.1', '11.', '1..', '11.', '1.1'],
  }
  let gx = 40
  for (const ch of 'VOLTVIK') {
    const rows = glyph[ch]!
    rows.forEach((row, yy) => [...row].forEach((p, xx) => { if (p === '1') r(g, '#ffd23f', gx + xx - 1, 80 + yy + 1) }))
    gx += rows[0]!.length + 1
  }
}

function paintRoad(g: G, w: number) {
  for (let y = 104; y < 144; y++) {
    for (let x = 0; x < w; x++) {
      const n = hash2(x, y, 8)
      r(g, n < 0.08 ? '#2c2542' : n > 0.96 ? '#1a1528' : '#221c34', x, y)
    }
  }
  r(g, '#3a3452', 0, 104, w, 1)
  r(g, '#2c2644', 0, 105, w, 1)
  // Faded centre dashes
  for (let x = 6; x < w; x += 24) r(g, '#4a4468', x, 128, 10, 1)
  // Puddles
  for (const [px, py, pw] of PUDDLES) {
    for (let dy = -2; dy <= 2; dy++) {
      const hw = Math.round(pw / 2 * Math.sqrt(1 - (dy * dy) / 6.5))
      r(g, '#2e3a66', px - hw, py + dy, hw * 2, 1)
    }
    r(g, '#4a5a90', px - Math.round(pw / 3), py - 1, Math.round(pw / 5), 1)
  }
  // Grass at the verge
  for (let x = 0; x < w; x += 3) if (hash2(x, 1, 6) < 0.5) r(g, '#1f4a44', x, 143 - Math.floor(hash2(x, 2, 6) * 3), 1, 3)
}

const PUDDLES: [number, number, number][] = [[96, 124, 34], [338, 136, 44], [430, 118, 26], [210, 139, 22]]

function paintLighthouse(g: G) {
  r(g, '#141a3a', 14, HORIZON - 3, 30, 3)
  r(g, K, 26, HORIZON - 16, 6, 13)
  r(g, '#cfc6ff', 27, HORIZON - 15, 4, 12)
  r(g, '#ff3b5c', 27, HORIZON - 10, 4, 3)
  r(g, K, 26, HORIZON - 19, 6, 3)
}

export const painter: RoomPainter = {
  paint(g, w, h) {
    paintStormSky(g, 0, w, HORIZON + 2, 3)
    paintSea(g, 0, 240, HORIZON, 98)
    paintLighthouse(g)
    // Rocks at the cliff's foot, foam round them
    for (let x = 100; x < 170; x++) {
      const top = 88 + Math.round(noise1(x, 6, 2) * 8)
      r(g, '#150f28', x, top, 1, 98 - top)
      if (hash2(x, 3, 3) < 0.4) r(g, '#2d2350', x, top, 1, 1)
    }
    paintCliff(g, w)
    paintVilla(g, VX, VY)
    paintWall(g, w)
    paintGuardRail(g)
    paintRoad(g, w)
    void h
  },

  ambient: () => '#6a66a0',

  back(g, s, v) {
    seaLive(g, 0, 150, HORIZON, 96, v.t)
    villaLive(g, VX, VY, v.t, !!s.flags[F.rodUp])
    // The gate: shut, or both leaves swung in.
    paintGate(g, !!s.flags[GATE])
    // Ripples in the puddles
    for (const [px, py, pw] of PUDDLES) {
      const ph = (v.t * 1.4 + px * 0.13) % 1
      const rw = Math.round(2 + ph * pw * 0.35)
      g.globalAlpha = 1 - ph
      r(g, '#6a7ab0', px - rw, py, 1, 1)
      r(g, '#6a7ab0', px + rw, py, 1, 1)
      g.globalAlpha = 1
    }
    paintCar(g, carX(s), CAR.y, carState(s), v.t)
  },

  lights(L, s, v) {
    villaLights(L, VX, VY, !!s.flags[F.furnaceLit])
    L(273, 54, 30, '#ffcf80', 0.9)
    L(337, 54, 30, '#ffcf80', 0.9)
    // The lighthouse sweeps
    const sweep = Math.sin(v.t * 1.3)
    if (sweep > 0.6) L(29, HORIZON - 17, 26, '#fff4c0', (sweep - 0.6) * 2)
    carLights(L, carX(s), CAR.y, carState(s), v.t)
  },

  glow(g, s, v) {
    villaGlow(g, VX, VY, v.t, !!s.flags[F.furnaceLit], v.flash)
    r(g, '#ffd23f', 271, 51, 4, 6)
    r(g, '#ffd23f', 335, 51, 4, 6)
    r(g, '#fff4c0', 272, 52, 1, 2)
    r(g, '#fff4c0', 336, 52, 1, 2)
    const sweep = Math.sin(v.t * 1.3)
    r(g, sweep > 0.6 ? '#fff4c0' : '#8a7a50', 27, HORIZON - 18, 4, 2)
    if (sweep > 0.3) {
      const dir = Math.cos(v.t * 1.3) > 0 ? 1 : -1
      g.fillStyle = '#fff4c0'
      for (let d = 3; d < 36; d++) if (bayer(29 + d * dir, HORIZON - 17) < (1 - d / 36) * (sweep - 0.3)) g.fillRect(29 + d * dir, HORIZON - 17 + (d % 3 === 0 ? 0 : 0), 1, 1)
    }
    carGlow(g, carX(s), CAR.y, carState(s), v.t)
    if (v.flash > 0.5) {
      const seed = Math.floor(v.t * 0.37)
      bolt(g, 40 + Math.floor(hash(seed) * 400), 0, HORIZON - 4 - Math.floor(hash(seed + 3) * 20), seed)
    }
  },
}

function paintGate(g: G, open: boolean) {
  if (open) {
    for (const [x0, dir] of [[279, 1], [331, -1]] as const) {
      for (let i = 0; i < 8; i++) {
        const x = x0 + i * dir
        const top = 64 - Math.round(i * 0.8)
        r(g, K, x, top, 1, 104 - top)
        if (i % 2 === 1) r(g, '#4a4070', x, top + 1, 1, 104 - top - 2)
      }
      r(g, K, Math.min(x0, x0 + 7 * dir), 72, 8, 1)
      r(g, K, Math.min(x0, x0 + 7 * dir), 98, 8, 1)
    }
    return
  }
  // Two leaves meeting in an arch; bars, rails, a gold V and a bolt.
  for (let x = 279; x < 332; x++) {
    const u = (x - 305.5) / 26
    const top = Math.round(66 - (1 - u * u) * 10)
    if ((x - 279) % 4 === 0 || x === 305 || x === 306) {
      r(g, K, x, top, 1, 104 - top)
      r(g, '#4a4070', x, top + 2, 1, 1)
    }
    r(g, K, x, top, 1, 1)
    r(g, K, x, 74, 1, 1)
    r(g, K, x, 98, 1, 1)
  }
  // Curls
  for (const cx of [287, 324]) {
    r(g, K, cx - 2, 78, 5, 1); r(g, K, cx - 2, 78, 1, 4); r(g, K, cx - 2, 81, 3, 1); r(g, K, cx + 2, 76, 1, 3)
  }
  // The monogram
  const V = ['1...1', '1...1', '.1.1.', '.1.1.', '..1..']
  V.forEach((row, yy) => [...row].forEach((p, xx) => { if (p === '1') r(g, '#ffd23f', 303 + xx, 62 + yy) }))
  r(g, '#ffd23f', 305, 69, 2, 1); r(g, '#ffd23f', 304, 70, 2, 1); r(g, '#ffd23f', 305, 71, 2, 1); r(g, '#ffd23f', 304, 72, 2, 1)
}

export type { GameState, View }
