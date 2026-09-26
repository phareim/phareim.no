/**
 * The Roof (460 wide, outdoors: the renderer rains on it). A violet storm
 * sky with rolling clouds and bolts, the sea and the town's lights across
 * the bay (a lighthouse sweeps), wet slates up to a sagging ridge with the
 * rooster vane, the crooked chimney and its three crooked pots, the lit
 * dormer we climbed out of, a lead walkway behind an iron railing, the
 * lightning rod (flat in its rusted socket, or standing with St Elmo's fire
 * at the tip), its copper cable over the edge, and far below at the gate,
 * Brunhilde blinking her hazard lights.
 *
 * State it reads: F.socketOiled (the socket glistens), F.rodUp, F.seanceDone.
 */
import { bayer } from '../../../base/pixel/sprites'
import { F } from '../../content/flags'
import { ROOF } from '../../content/rooms/roof'
import type { GameState } from '../../types'
import type { G, RoomPainter } from '../api'
import { bolt, hash } from '../fx'
import { INK, box, cachedSprite, dither, dot, line, oval, ovalO, poly, polyO, rect, type P2 } from './storeroom'

const W = ROOF.w
const HORIZON = 64
const WALK_Y = 104
const EDGE_X = 404
const SOCKET = ROOF.socket
const WOOD_L = '#b06a38'
const CAR = { x: 428, y: 112 }
const LIGHTHOUSE = { x: 112, y: 57 }
const LUMPS: readonly (readonly [number, number, number, number])[] = [
  [30, 18, 34, 10], [90, 10, 40, 12], [160, 20, 30, 9], [220, 8, 46, 12], [300, 16, 38, 11], [370, 6, 44, 12], [440, 18, 32, 10],
  [60, 34, 30, 6], [140, 40, 36, 6], [250, 36, 40, 7], [350, 42, 30, 6], [420, 38, 30, 6],
]
const CHAIR = { x: 236, y: 104 }

/** One storm cloud: a belly and two bumps on top, in three tones (edge, body, lit belly). */
function cloud(g: G, cx: number, cy: number, rx: number, ry: number, edge: string, body: string, belly: string) {
  const parts: [number, number, number, number][] = [
    [cx, cy + 1, rx, Math.max(2, ry - 3)],
    [cx - rx * 0.35, cy - ry * 0.25, rx * 0.45, ry * 0.7],
    [cx + rx * 0.2, cy - ry * 0.45, rx * 0.4, ry * 0.75],
  ]
  for (const [x, y, a, b] of parts) oval(g, Math.round(x), Math.round(y) + 1, Math.round(a) + 1, Math.round(b) + 1, edge)
  for (const [x, y, a, b] of parts) oval(g, Math.round(x), Math.round(y), Math.round(a), Math.round(b), body)
  oval(g, cx + 2, cy + Math.round(ry * 0.35), Math.round(rx * 0.7), Math.max(1, Math.round(ry * 0.3)), belly)
}

/** True where the sky shows (not the chimney, the vane, the dormer's gable or the roof). */
function isSky(x: number, y: number): boolean {
  if (y >= ridgeY(x) - 3) return false
  if (x >= 144 && x <= 192 && y >= 20) return false
  if (x >= 146 && x <= 190 && y >= 1) return false
  if (x >= 238 && x <= 268 && y >= 18 && y <= 38) return false
  if (x >= 241 && x <= 266 && y >= 36 && y <= 48) return false
  if (x >= 251 && x <= 255) return false
  if (y >= 49 && Math.abs(x - 54) < (y - 49) * 1.4 + 3) return false
  return true
}

/** Clip to the open sky, roughly: minus the chimney and the vane. */
function skyClip(g: G) {
  g.beginPath()
  g.rect(0, 0, W, HORIZON)
  g.rect(144, 0, 50, HORIZON)
  g.rect(238, 18, 30, 50)
  g.clip('evenodd')
}

/** The clouds as a strike lights them, cut to the open sky (drawn in glow). */
function litClouds(): HTMLCanvasElement {
  return cachedSprite('rf-litclouds', W, HORIZON, g => {
    for (const [cx, cy, rx, ry] of LUMPS) cloud(g, cx, cy, rx - 2, ry - 1, '#5a4898', '#8a78d0', '#d8ccff')
    const img = g.getImageData(0, 0, W, HORIZON)
    for (let y = 0; y < HORIZON; y++) for (let x = 0; x < W; x++) if (!isSky(x, y)) img.data[(y * W + x) * 4 + 3] = 0
    g.putImageData(img, 0, 0)
  })
}

/** The ridge line (it sags in the middle). */
function ridgeY(x: number): number {
  return 70 + Math.round(Math.sin((x / EDGE_X) * Math.PI) * 3)
}

function paintSky(g: G) {
  for (let y = 0; y < 100; y++) for (let x = 0; x < W; x++) {
    const t = y / HORIZON
    let c = '#120a26'
    if (bayer(x, y) < t * 0.9) c = '#1e1240'
    if (bayer(x + 1, y + 2) < (t - 0.55) * 1.6) c = '#2c1c52'
    dot(g, x, y, c)
  }
  // A heavy cloud bank along the top.
  for (let x = 0; x < W; x++) {
    const h = 6 + Math.round(Math.sin(x * 0.04) * 3 + Math.sin(x * 0.11) * 2)
    rect(g, x, 0, 1, h, '#0c0620')
    dot(g, x, h, '#1a1036')
  }
  // Rolling storm clouds: lumpy, layered, their bellies catching the town's glow.
  for (const [cx, cy, rx, ry] of LUMPS) {
    cloud(g, cx, cy, rx, ry, '#1a1036', '#2a1a50', '#3a2a64')
  }
  // Rain curtains hanging from the clouds over the sea.
  for (const [cx, w] of [[70, 26], [300, 34], [420, 20]] as const) {
    for (let y = 44; y < HORIZON; y++) for (let x = cx - w; x < cx + w; x++) {
      const k = 1 - Math.abs(x - cx) / w
      if ((x + Math.floor(y * 0.3)) % 3 === 0 && bayer(x, y) < k * 0.5 * (1 - (y - 44) / 30)) dot(g, x, y, '#3a3068')
    }
  }
  // The far shore's hills.
  for (let x = 40; x < 240; x++) {
    const h = Math.round(3 + Math.sin(x * 0.05) * 2 + Math.sin(x * 0.13) * 1)
    rect(g, x, HORIZON - h, 1, h, '#0a0820')
  }
  // Lighthouse.
  rect(g, LIGHTHOUSE.x - 1, LIGHTHOUSE.y, 3, 7, '#d8d0ec')
  dot(g, LIGHTHOUSE.x - 1, LIGHTHOUSE.y + 3, '#c04a6a'); dot(g, LIGHTHOUSE.x + 1, LIGHTHOUSE.y + 3, '#c04a6a')
}

function paintSlates(g: G) {
  // Rows of slates from the ridge down to the walkway, staggered, wet.
  for (let x = 0; x < EDGE_X; x++) {
    const top = ridgeY(x)
    const span = WALK_Y - top
    let acc = 0
    let row = 0
    let rowH = 4
    for (let y = top; y < WALK_Y; y++) {
      let inRow = y - top - acc
      if (inRow >= rowH) { acc += rowH; row++; rowH = 4 + Math.floor((acc / span) * 3); inRow = 0 }
      const d = (y - top) / span
      const sw = 8 + Math.floor(d * 4)
      const off = (row % 2) * Math.floor(sw / 2) + row * 3
      const u = (x + off) % sw
      const id = Math.floor((x + off) / sw) * 31 + row
      let c = hash(id) < 0.5 ? '#34345a' : '#2c2c50'
      if (hash(id * 3 + 1) < 0.06) c = '#44305a'
      if (inRow === 0) c = '#141430'
      else if (inRow === 1) c = '#5a5a8a'
      else if (u === 0) c = '#141430'
      else if (inRow === rowH - 1) c = '#20203e'
      // Wet streaks.
      if (c !== '#141430' && hash(x * 7 + Math.floor(y / 4)) < 0.02) c = '#7a7ab0'
      dot(g, x, y, c)
    }
  }
  // A few loose, crooked slates.
  for (const [x, y] of [[120, 86], [226, 80], [300, 92], [96, 96]] as const) {
    polyO(g, [[x, y], [x + 9, y - 2], [x + 10, y + 3], [x + 1, y + 5]], '#3a3a64')
    line(g, x + 1, y, x + 8, y - 1, '#6a6aa0')
  }
  // Ridge tiles.
  for (let x = -2; x < EDGE_X; x += 6) {
    const y = ridgeY(x) - 2
    oval(g, x + 3, y, 3, 2, INK)
    oval(g, x + 3, y, 2, 1, '#8a3a2a')
    dot(g, x + 2, y - 1, '#c86a3a')
  }
  // The roof's end: a gutter and the house's corner, dropping away.
  rect(g, EDGE_X - 2, ridgeY(EDGE_X) - 4, 4, WALK_Y - ridgeY(EDGE_X) + 4, INK)
  rect(g, EDGE_X - 1, ridgeY(EDGE_X) - 3, 2, WALK_Y - ridgeY(EDGE_X) + 2, '#5a5a8a')
}

function paintBelow(g: G) {
  // Beyond the edge, far below: the cliff top, the drive, the gate and Brunhilde.
  const x0 = EDGE_X + 2
  for (let y = 96; y < 144; y++) for (let x = x0; x < W; x++) {
    const ground = 100 + Math.round((x - x0) * 0.08 + Math.sin(x * 0.2) * 1)
    if (y < ground) continue
    let c = '#141a1e'
    if (bayer(x, y) < 0.25) c = '#1c2a24'
    if (hash(x * 3 + y * 11) < 0.05) c = '#243a2c'
    dot(g, x, y, c)
  }
  // The drive: a pale gravel ribbon with puddles.
  for (let y = 110; y < 144; y++) {
    const cx = 440 + (y - 110) * 0.5
    const hw = 3 + (y - 110) * 0.35
    for (let x = Math.round(cx - hw); x < cx + hw; x++) dot(g, x, y, bayer(x, y) < 0.4 ? '#3a3448' : '#2e2a3c')
  }
  oval(g, 444, 126, 3, 1, '#4a5a98')
  // The gate: two stone posts and a curly iron gate standing open.
  for (const x of [418, 452]) { rect(g, x, 100, 4, 12, INK); rect(g, x + 1, 101, 2, 10, '#5a5870'); rect(g, x, 99, 4, 2, '#8a8098') }
  for (let i = 0; i < 6; i++) line(g, 422 + i * 1.3, 102 + i * 0.4, 422 + i * 1.3, 111, '#2a2640')
  // Trees bending in the wind.
  for (const [x, h] of [[410, 12], [456, 16]] as const) {
    rect(g, x, 104 - 4, 1, 6, '#1a1210')
    oval(g, x, 104 - h / 2 - 2, 4, h / 2, '#0e1a14')
  }
  // Brunhilde: a boxy little Volvo 240 estate, bonnet up (in a rust-coloured red).
  const { x, y } = CAR
  rect(g, x - 1, y - 1, 22, 9, INK)
  rect(g, x, y + 2, 20, 4, '#b0542a')
  rect(g, x + 3, y, 15, 3, '#b0542a')
  rect(g, x + 4, y, 6, 2, '#6a80c0'); rect(g, x + 11, y, 6, 2, '#6a80c0')
  rect(g, x, y + 2, 20, 1, '#e07a4e')
  // Bonnet up at the front (left).
  line(g, x, y + 1, x - 3, y - 3, INK); line(g, x + 1, y + 1, x - 2, y - 3, '#b0542a')
  // Wheels.
  rect(g, x + 2, y + 6, 4, 2, INK); rect(g, x + 14, y + 6, 4, 2, INK)
}

function paintChimney(g: G) {
  // Crooked brick stack, leaning left, widening at the base.
  const pts: P2[] = [[150, 24], [184, 22], [192, WALK_Y + 2], [146, WALK_Y + 2]]
  polyO(g, pts, '#a0402a')
  for (let y = 24; y < WALK_Y + 2; y++) {
    const k = (y - 24) / (WALK_Y + 2 - 24)
    const xl = 150 - k * 4
    const xr = 184 + k * 8
    const row = Math.floor((y - 24) / 4)
    for (let x = Math.ceil(xl); x < xr; x++) {
      const inRow = (y - 24) % 4
      const u = (x - xl + (row % 2) * 4) % 8
      let c = hash(Math.floor((x - xl + (row % 2) * 4) / 8) * 17 + row) < 0.5 ? '#a0402a' : '#8a3422'
      if (inRow === 0 || u < 1) c = '#5a2418'
      else if (inRow === 1 && x < xl + 3) c = '#c05a3a'
      if (x > xr - 6 && bayer(x, y) < 0.5) c = '#5a2418'
      dot(g, x, y, c)
    }
  }
  // Soot streaks and a flashing (lead) collar at the base.
  dither(g, 152, 24, 30, 10, '#2a1418', 0.35)
  rect(g, 144, WALK_Y - 2, 50, 3, '#5a5a8a'); rect(g, 144, WALK_Y - 2, 50, 1, '#8a8ab0')
  // The cap.
  box(g, 147, 20, 40, 4, '#c05a3a', '#e07a4e', '#6a2a1a')
  // Three crooked pots.
  const pots: [number, number, number][] = [[155, 10, -1], [167, 4, 1], [179, 12, 2]]
  for (const [x, top, lean] of pots) {
    const p: P2[] = [[x - 4, 20], [x + 4, 20], [x + 3 + lean, top], [x - 3 + lean, top]]
    polyO(g, p, '#c86a3a')
    line(g, x - 3, 19, x - 2 + lean, top + 1, '#e89058')
    line(g, x + 3, 19, x + 2 + lean, top + 1, '#8a3a1a')
    rect(g, x - 4 + lean, top - 1, 9, 2, '#e07a4e'); rect(g, x - 4 + lean, top - 2, 9, 1, INK)
    rect(g, x - 2 + lean, top - 1, 5, 1, INK)
  }
}

function paintVanePole(g: G) {
  const x = 253
  const base = ridgeY(x) - 3
  rect(g, x - 1, 30, 3, base - 30, INK)
  rect(g, x, 30, 1, base - 30, '#8a8098')
  // N / E / S / W arms.
  rect(g, x - 10, 40, 21, 1, INK); rect(g, x - 10, 39, 1, 3, INK); rect(g, x + 10, 39, 1, 3, INK)
  dot(g, x - 12, 40, '#d8a040'); dot(g, x + 12, 40, '#d8a040')
  oval(g, x, 46, 3, 1, '#d8a040')
}

function rooster(dir: 1 | -1): HTMLCanvasElement {
  return cachedSprite('rf-rooster-' + dir, 26, 18, g => {
    const X = (x: number) => (dir === 1 ? x : 25 - x)
    const fill = (pts: [number, number][], c: string) => poly(g, pts.map(([x, y]) => [X(x), y] as P2), c)
    // Outline pass, then copper.
    const body: [number, number][] = [[5, 8], [10, 5], [14, 6], [18, 3], [21, 4], [20, 8], [17, 12], [10, 14], [5, 12]]
    const tail: [number, number][] = [[6, 9], [1, 2], [3, 1], [6, 5], [4, 0], [7, 1], [9, 6]]
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      fill(body.map(([x, y]) => [x + dx, y + dy]), INK)
      fill(tail.map(([x, y]) => [x + dx, y + dy]), INK)
    }
    fill(tail, '#8a4a20')
    fill(body, '#c8703a')
    fill([[10, 6], [14, 7], [17, 5], [18, 6], [15, 9], [10, 9]], '#e89058')
    // Comb, beak, eye, legs.
    fill([[18, 3], [19, 0], [20, 2], [21, 0], [22, 3]], '#e0607a')
    fill([[21, 5], [24, 6], [21, 7]], '#ffd23f')
    dot(g, X(19), 5, INK)
    rect(g, X(12), 14, 1, 3, INK); rect(g, X(15), 14, 1, 3, INK)
    rect(g, X(11), 16, 6, 1, INK)
  })
}

function paintDormer(g: G) {
  // The study's dormer, seen from outside: a little gable with slates.
  const x0 = 28
  const x1 = 80
  polyO(g, [[x0 - 4, 70], [54, 50], [x1 + 4, 70], [x1 + 1, 72], [54, 54], [x0 - 1, 72]], '#2c2c50')
  for (let i = 0; i < 6; i++) {
    line(g, x0 - 2 + i * 4, 70 - i * 3, 54, 52 + i, '#3a3a64')
    line(g, x1 + 2 - i * 4, 70 - i * 3, 54, 52 + i, '#20203e')
  }
  line(g, x0 - 4, 70, 54, 50, '#6a6aa0')
  // Cheeks and face.
  poly(g, [[x0, 71], [x1, 71], [x1, WALK_Y - 2], [x0, WALK_Y - 2]], INK)
  poly(g, [[x0 + 1, 72], [x1 - 1, 72], [x1 - 1, WALK_Y - 2], [x0 + 1, WALK_Y - 2]], '#3a3a64')
  dither(g, x0 + 1, 72, x1 - x0 - 2, 6, '#20203e', 0.5)
  // The window frame (its panes are lit: glow()).
  box(g, 38, 76, 32, 24, '#1c1030')
  rect(g, 36, 74, 36, 2, '#e8e4f4'); rect(g, 36, 100, 36, 3, '#e8e4f4'); rect(g, 36, 74, 2, 28, '#e8e4f4'); rect(g, 70, 74, 2, 28, '#e8e4f4')
  // Sashes swung open inward: thin edges.
  rect(g, 38, 76, 3, 24, '#c8c0e0'); rect(g, 67, 76, 3, 24, '#c8c0e0')
}

function paintWalkway(g: G) {
  // Lead walkway, seams, a gutter lip at the back edge.
  for (let y = WALK_Y; y < 144; y++) for (let x = 0; x < EDGE_X + 2; x++) {
    let c = '#4a4870'
    if (bayer(x, y) < 0.3) c = '#524f7a'
    if ((x + Math.floor((y - WALK_Y) * 0.7)) % 38 === 0) c = '#2a2848'
    if (y === WALK_Y) c = '#7a78a8'
    if (y === WALK_Y + 1) c = '#2a2848'
    if (y > WALK_Y + 1 && y < WALK_Y + 4 && bayer(x, y) < 0.6) c = '#2e2c4c'
    dot(g, x, y, c)
  }
  // Puddles.
  for (const [cx, cy, rx] of [[120, 120, 14], [236, 126, 10], [300, 114, 8]] as const) {
    oval(g, cx, cy, rx, 2, '#2e3460')
    oval(g, cx - 2, cy, rx - 4, 1, '#3e4a80')
  }
  // The walkway's end over the drop: a post.
  rect(g, EDGE_X, WALK_Y - 2, 3, 40, INK); rect(g, EDGE_X + 1, WALK_Y - 1, 1, 38, '#5a5a8a')
}

function paintChair(g: G) {
  // The Professor's deckchair, side on, facing the sea: a striped sling on a
  // leaning wooden frame. Soaked.
  const { x, y } = CHAIR
  const legs = (c: string, d: number) => {
    line(g, x + 2 + d, y + 10, x + 6 + d, y - 10, c)
    line(g, x + 24 + d, y + 10, x + 12 + d, y - 1, c)
    line(g, x + 5 + d, y + 1, x + 22 + d, y + 1, c)
  }
  legs(INK, -1); legs(INK, 1)
  legs(WOOD_L, 0)
  // The sling: from the top of the back down to the front, sagging.
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const sx = Math.round(x + 6 + t * 16)
    const sy = Math.round(y - 10 + t * 11 + Math.sin(t * Math.PI) * 4)
    rect(g, sx - 1, sy - 1, 3, 5, INK)
  }
  for (let i = 0; i <= 16; i++) {
    const t = i / 16
    const sx = Math.round(x + 6 + t * 16)
    const sy = Math.round(y - 10 + t * 11 + Math.sin(t * Math.PI) * 4)
    rect(g, sx, sy, 1, 3, Math.floor(i / 2) % 2 ? '#e8e4f4' : '#e0607a')
  }
  // A thermos next to it, and a teacup full of rain.
  box(g, x + 28, y + 2, 4, 8, '#3fa89a', '#6fd8c0', '#1f6a60'); rect(g, x + 28, y + 1, 4, 1, '#d8d0ec')
  rect(g, x + 34, y + 7, 5, 3, INK); rect(g, x + 35, y + 7, 3, 2, '#fff4ff'); rect(g, x + 35, y + 7, 3, 1, '#6a80c0'); dot(g, x + 39, y + 8, '#fff4ff')
}

function paintCable(g: G) {
  // From the socket along the back of the walkway to the edge, and over.
  const c = '#b06a38'
  line(g, SOCKET.x + 5, SOCKET.y + 3, 380, WALK_Y + 3, INK)
  line(g, SOCKET.x + 5, SOCKET.y + 2, 380, WALK_Y + 2, c)
  line(g, 380, WALK_Y + 3, EDGE_X + 1, WALK_Y + 12, INK)
  line(g, 380, WALK_Y + 2, EDGE_X + 1, WALK_Y + 11, c)
  line(g, EDGE_X + 2, WALK_Y + 12, EDGE_X + 4, 144, INK)
  line(g, EDGE_X + 3, WALK_Y + 12, EDGE_X + 5, 144, c)
  for (const [x, y] of [[360, WALK_Y + 2], [392, WALK_Y + 7]] as const) { rect(g, x - 1, y - 1, 3, 3, INK); dot(g, x, y, '#8a8098') }
}

function paintSocket(g: G, s: GameState, t: number) {
  const { x, y } = SOCKET
  box(g, x - 6, y - 2, 12, 8, '#8a3a1a', '#b0542a', '#5a2410')
  // Rust flakes.
  for (const [dx, dy] of [[-4, 0], [2, 1], [-1, 3], [4, 4], [-5, 4]] as const) dot(g, x + dx, y + dy, '#d8702a')
  // Pivot bolt.
  ovalO(g, x, y + 1, 2, 2, '#6a3a20'); dot(g, x - 1, y, '#d8a060')
  if (s.flags[F.socketOiled]) {
    // Glistening oil, a drip.
    dot(g, x - 3, y - 1, '#e8f0a0'); dot(g, x + 2, y - 1, '#e8f0a0'); dot(g, x, y + 1, '#ffffc0')
    const k = (t * 0.6) % 1
    dot(g, x + 3, y + 6 + Math.floor(k * 4), '#c8c040')
  }
}

function paintRod(g: G, s: GameState) {
  const { x, y } = SOCKET
  if (s.flags[F.rodUp]) {
    const top = ROOF.rodTip.y
    rect(g, x - 2, top, 4, y - top, INK)
    rect(g, x - 1, top + 1, 2, y - top - 1, '#d8804a')
    rect(g, x - 1, top + 1, 1, y - top - 1, '#ffb070')
    // Glass insulator ball and the arrow tip.
    ovalO(g, x, top + 20, 3, 3, '#6ad8ff'); dot(g, x - 1, top + 19, '#ffffff')
    poly(g, [[x - 4, top + 5], [x, top - 4], [x + 4, top + 5]], INK)
    poly(g, [[x - 3, top + 4], [x, top - 2], [x + 3, top + 4]], '#ffd23f')
  } else {
    // Lying flat up the slope, from the socket to the tip.
    const tx = 292
    const ty = 86
    line(g, x, y - 1, tx, ty - 1, INK); line(g, x, y + 1, tx, ty + 1, INK); line(g, x + 1, y, tx + 1, ty, INK)
    line(g, x, y, tx, ty, '#d8804a')
    line(g, x - 1, y - 1, tx - 1, ty - 1, '#ffb070')
    ovalO(g, 308, 92, 3, 3, '#6ad8ff'); dot(g, 307, 91, '#ffffff')
    poly(g, [[tx + 2, ty - 5], [tx - 7, ty - 3], [tx + 2, ty + 4]], INK)
    poly(g, [[tx + 1, ty - 3], [tx - 5, ty - 2], [tx + 1, ty + 2]], '#ffd23f')
  }
}

export const painter: RoomPainter = {
  paint(g, w, h) {
    rect(g, 0, 0, w, h, '#120a26')
    paintSky(g)
    paintBelow(g)
    paintSlates(g)
    paintVanePole(g)
    paintChimney(g)
    paintDormer(g)
    paintWalkway(g)
    paintChair(g)
    paintCable(g)
  },

  ambient: () => '#6a64a0',

  back(g, s, v) {
    // The rooster swings round in the gusts.
    const dir: 1 | -1 = Math.sin(v.t * 0.35) + Math.sin(v.t * 1.7) * 0.3 > 0 ? 1 : -1
    g.drawImage(rooster(dir), 253 - 13, 20)
    // Heat shimmer / a wisp of smoke from the middle pot.
    for (let i = 0; i < 6; i++) {
      const k = ((v.t * 0.5 + i / 6) % 1)
      const x = 167 + 1 + Math.sin(v.t * 2 + i) * 2 - k * 10
      const y = 2 - k * 10
      if (y > -2) dot(g, x, y + 2, '#8a80a8')
    }
    paintSocket(g, s, v.t)
    paintRod(g, s)
    // Rain splashes in the puddles and on the lead.
    for (let i = 0; i < 14; i++) {
      const k = (v.t * 2.5 + hash(i * 13)) % 1
      const px = 10 + hash(i * 7 + Math.floor(v.t * 2.5 + hash(i * 13))) * (EDGE_X - 20)
      const py = WALK_Y + 4 + hash(i * 5 + Math.floor(v.t * 2.5 + hash(i * 13))) * 28
      if (k < 0.3) { dot(g, px - 1, py, '#a8b8f0'); dot(g, px + 1, py, '#a8b8f0') } else if (k < 0.5) dot(g, px, py - 1, '#a8b8f0')
    }
  },

  front(g) {
    // The iron railing along the front edge (nobody falls off).
    const y = 135
    rect(g, 0, y - 1, EDGE_X + 3, 4, INK)
    rect(g, 0, y, EDGE_X + 3, 2, '#3a3858')
    rect(g, 0, y, EDGE_X + 3, 1, '#7a78a8')
    for (let x = 4; x < EDGE_X + 3; x += 9) {
      rect(g, x - 1, y + 2, 3, 144 - y - 2, INK)
      rect(g, x, y + 2, 1, 144 - y - 2, '#3a3858')
      // Fleur-de-lis finials.
      dot(g, x, y - 2, INK); dot(g, x - 1, y - 1, INK); dot(g, x + 1, y - 1, INK)
    }
  },

  lights(L, s, v) {
    L(54, 88, 46, '#ffc890', 0.8)
    L(54, 112, 40, '#ffb070', 0.35)
    if (Math.floor(v.t * 1.6) % 2 === 0) L(CAR.x + 10, CAR.y + 3, 18, '#ff8a3d', 0.9)
    L(LIGHTHOUSE.x, LIGHTHOUSE.y, 14, '#fff1b0', 0.5)
    L(170, 10, 30, '#ff9a60', 0.15)
    if (s.flags[F.rodUp]) L(SOCKET.x, ROOF.rodTip.y, 16 + v.flash * 30, '#8ad8ff', 0.4 + v.flash)
    if (v.flash > 0.1) L(230, 30, 260, '#c8c0ff', v.flash * 0.9)
  },

  // Everything that glows up here is behind the walkway.
  glowBehind(g, s, v) {
    // The lit dormer window: the study's lamp, warm, and a bat silhouette on a rafter.
    for (let y = 76; y < 100; y++) for (let x = 41; x < 67; x++) {
      const k = (y - 76) / 24
      dot(g, x, y, bayer(x, y) < 0.5 + k * 0.3 ? '#ffc070' : '#ffe0a0')
    }
    rect(g, 41, 76, 26, 3, '#b07040')
    if (s.flags[F.batFed]) { rect(g, 58, 79, 3, 5, '#3a1c20'); dot(g, 57, 83, '#3a1c20'); dot(g, 61, 83, '#3a1c20') }
    // Town lights across the bay, twinkling.
    for (let i = 0; i < 16; i++) {
      const x = 50 + Math.floor(hash(i * 5 + 3) * 180)
      if (Math.abs(x - LIGHTHOUSE.x) < 4) continue
      const on = hash(i * 7 + Math.floor(v.t * 0.7 + i)) < 0.85
      if (on) dot(g, x, HORIZON - 1 - Math.floor(hash(i) * 3), i % 3 ? '#ffd890' : '#ff9ad0')
    }
    // The lighthouse lamp and its sweeping beam.
    dot(g, LIGHTHOUSE.x, LIGHTHOUSE.y - 1, '#ffffff')
    const sweep = Math.sin(v.t * 0.9)
    if (Math.abs(sweep) > 0.2) {
      const dir = sweep > 0 ? 1 : -1
      const len = Math.round(Math.abs(sweep) * 46)
      for (let i = 2; i < len; i++) {
        const spread = Math.floor(i / 10)
        for (let j = -spread; j <= spread; j++) if (bayer(LIGHTHOUSE.x + dir * i, LIGHTHOUSE.y - 1 + j) < 0.5 - i / len * 0.45) dot(g, LIGHTHOUSE.x + dir * i, LIGHTHOUSE.y - 1 + j, '#fff1b0')
      }
    }
    // Brunhilde's hazard lights.
    if (Math.floor(v.t * 1.6) % 2 === 0) {
      dot(g, CAR.x, CAR.y + 3, '#ffb060'); dot(g, CAR.x + 19, CAR.y + 3, '#ffb060')
      dot(g, CAR.x - 1, CAR.y + 3, '#ff8a3d'); dot(g, CAR.x + 20, CAR.y + 3, '#ff8a3d')
    }
    // A failed midnight with the rod still flat: the strike finds the rooster instead.
    if (s.flags['midnight.fail'] === 'rod' && v.flash > 0.3) {
      bolt(g, 253, 0, 22, Math.floor(v.t * 4), '#ffffff')
      for (let i = 0; i < 6; i++) dot(g, 253 + Math.cos(i) * (4 + i), 22 + Math.sin(i * 2) * 3, i % 2 ? '#ffd23f' : '#ffffff')
    }
    // St Elmo's fire on the raised rod.
    if (s.flags[F.rodUp]) {
      const top = ROOF.rodTip.y
      const n = 3 + Math.round(v.flash * 8)
      for (let i = 0; i < n; i++) {
        const a = hash(i * 17 + Math.floor(v.t * 12))
        const r = 2 + hash(i * 3 + Math.floor(v.t * 12)) * (3 + v.flash * 6)
        dot(g, SOCKET.x + Math.cos(a * 6.28) * r, top - 2 + Math.sin(a * 6.28) * r, i % 2 ? '#8ad8ff' : '#ffffff')
      }
    }
    // Lightning: one or two bolts out over the sea.
    if (v.flash > 0.45) {
      const seed = Math.floor(v.t * 3)
      const x0 = 60 + (seed * 97) % 320
      g.save()
      skyClip(g)
      bolt(g, x0, 0, HORIZON, seed, '#f4f0ff')
      bolt(g, x0 + 1, 0, HORIZON * 0.6, seed, '#c8c0ff')
      if (seed % 2) bolt(g, (x0 + 150) % W, 0, HORIZON * 0.7, seed + 3, '#e8e4ff')
      g.restore()
      // The whole storm lights up from inside.
      g.globalAlpha = v.flash > 0.75 ? 1 : 0.55
      g.drawImage(litClouds(), 0, 0)
      g.globalAlpha = 1
      // The raised rod stands in front of the sky: draw it again over the clouds.
      if (s.flags[F.rodUp]) paintRod(g, s)
      // Draw the bolts again over their own glow.
      g.save()
      skyClip(g)
      bolt(g, x0, 0, HORIZON, seed, '#ffffff')
      g.restore()
    }
  },
}
