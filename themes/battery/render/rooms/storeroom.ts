/**
 * Attic Storeroom (460 wide). Steep leaning roof beams, a sloped plank
 * ceiling, the round window with the storm in it (a dusty light shaft when
 * lightning strikes), the dumbwaiter hatch and its bell, Torvald's portrait,
 * the old trunk of letters, the floor hatch Espen was yanked through (and the
 * chandelier cord that did it), the rocking horse (rocks on its own at every
 * strike), the costume trunk, Margit the mannequin, the radio on its crate,
 * and the heavy trunk on castors in front of the study door.
 *
 * Also the attic's drawing kit (rect, poly, disc, box, dither, planks,
 * cached sprites), used by study.ts and roof.ts.
 *
 * State it reads: storeroom.hatchOpen (the floor hatch hangs open: the
 * intro can set it while the chandelier cord hauls Espen up), storeroom.lettersOpen, storeroom.costumesOpen,
 * storeroom.trunkT, storeroom.rockT, F.lettersTaken, F.trunkMoved,
 * F.earsFlop (the ear wire is the radio's antenna), F.radioHeard.
 */
import { bayer } from '../../../base/pixel/sprites'
import { makeCanvas } from '../../../base/pixel/stage'
import { F } from '../../content/flags'
import { STOREROOM } from '../../content/rooms/storeroom'
import type { GameState } from '../../types'
import type { G, RoomPainter, View } from '../api'
import { bolt, hash, rainIn } from '../fx'

// ---------------------------------------------------------------------------
// The attic kit
// ---------------------------------------------------------------------------

export const INK = '#0b0616'
export type P2 = readonly [number, number]

export function rect(g: G, x: number, y: number, w: number, h: number, c: string) {
  if (w <= 0 || h <= 0) return
  g.fillStyle = c
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

export function dot(g: G, x: number, y: number, c: string) {
  g.fillStyle = c
  g.fillRect(Math.round(x), Math.round(y), 1, 1)
}

/** A 1-px line (Bresenham). */
export function line(g: G, x0: number, y0: number, x1: number, y1: number, c: string) {
  g.fillStyle = c
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (let i = 0; i < 4000; i++) {
    g.fillRect(x0, y0, 1, 1)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

/** A filled polygon, scanline by scanline, on whole pixels. */
export function poly(g: G, pts: readonly P2[], c: string) {
  g.fillStyle = c
  let y0 = Infinity
  let y1 = -Infinity
  for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]) }
  const xs: number[] = []
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    const yc = y + 0.5
    xs.length = 0
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]!
      const b = pts[(i + 1) % pts.length]!
      if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]))
    }
    xs.sort((p, q) => p - q)
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const xa = Math.round(xs[i]!)
      const xb = Math.round(xs[i + 1]!)
      if (xb > xa) g.fillRect(xa, y, xb - xa, 1)
    }
  }
}

/** A polygon with an ink outline (drawn as the shape nudged four ways first). */
export function polyO(g: G, pts: readonly P2[], c: string, ink = INK) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) poly(g, pts.map(p => [p[0] + dx, p[1] + dy] as P2), ink)
  poly(g, pts, c)
}

/** A filled ellipse on whole pixels. */
export function oval(g: G, cx: number, cy: number, rx: number, ry: number, c: string) {
  g.fillStyle = c
  for (let y = -ry; y <= ry; y++) {
    const k = 1 - (y * y) / ((ry + 0.5) * (ry + 0.5))
    if (k < 0) continue
    const hw = Math.round(Math.sqrt(k) * (rx + 0.5) - 0.5)
    g.fillRect(Math.round(cx - hw), Math.round(cy + y), hw * 2 + 1, 1)
  }
}

export function disc(g: G, cx: number, cy: number, r: number, c: string) { oval(g, cx, cy, r, r, c) }

/** An outlined oval: ink one pixel bigger all round. */
export function ovalO(g: G, cx: number, cy: number, rx: number, ry: number, c: string, ink = INK) {
  oval(g, cx, cy, rx + 1, ry + 1, ink)
  oval(g, cx, cy, rx, ry, c)
}

/** A box with an ink outline, a highlight row on top and a shadow row at the bottom. */
export function box(g: G, x: number, y: number, w: number, h: number, fill: string, hi?: string, lo?: string, ink = INK) {
  rect(g, x - 1, y - 1, w + 2, h + 2, ink)
  rect(g, x, y, w, h, fill)
  if (hi) rect(g, x, y, w, 1, hi)
  if (lo) rect(g, x, y + h - 1, w, 1, lo)
}

/** Ordered dither: pixels of `c` where the Bayer threshold is under `density`. */
export function dither(g: G, x: number, y: number, w: number, h: number, c: string, density: number) {
  g.fillStyle = c
  for (let yy = Math.round(y); yy < y + h; yy++) for (let xx = Math.round(x); xx < x + w; xx++) {
    if (bayer(xx, yy) < density) g.fillRect(xx, yy, 1, 1)
  }
}

/** A dithered vertical ramp from `c0` at the top to `c1` at the bottom. */
export function ramp(g: G, x: number, y: number, w: number, h: number, c0: string, c1: string) {
  for (let yy = 0; yy < h; yy++) {
    const t = h <= 1 ? 1 : yy / (h - 1)
    for (let xx = 0; xx < w; xx++) {
      g.fillStyle = bayer(x + xx, y + yy) < t ? c1 : c0
      g.fillRect(x + xx, y + yy, 1, 1)
    }
  }
}

const spriteCache = new Map<string, HTMLCanvasElement>()

/** A drawing cached in its own canvas (for state-dependent props drawn every frame). */
export function cachedSprite(key: string, w: number, h: number, draw: (g: G) => void): HTMLCanvasElement {
  let c = spriteCache.get(key)
  if (!c) {
    c = makeCanvas(w, h)
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    draw(g)
    spriteCache.set(key, c)
  }
  return c
}

/** Draw a cached sprite with each column nudged by `dy(col)` (a cheap rock or sway). */
export function shear(g: G, c: HTMLCanvasElement, x: number, y: number, dy: (col: number) => number) {
  for (let i = 0; i < c.width; i++) g.drawImage(c, i, 0, 1, c.height, Math.round(x) + i, Math.round(y + dy(i)), 1, c.height)
}

/** Wood materials, deep → highlight. */
export const WOOD = { k: '#2a1410', d: '#5e3220', m: '#8a4a2a', l: '#b06a38', h: '#d8904c' }
export const PLUM = { k: '#140c24', d: '#241a40', m: '#34285a', l: '#4a3a78', h: '#6a5898' }

/** A chunky beam from (x0, y0) to (x1, y1), `t` px thick, with a lit top edge and ink edges. */
export function beam(g: G, x0: number, y0: number, x1: number, y1: number, t: number, mat = WOOD) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  // Normal pointing up the screen is the lit side.
  const s = ny > 0 ? -1 : 1
  const off = (k: number): P2[] => [[x0 + nx * k * s, y0 + ny * k * s], [x1 + nx * k * s, y1 + ny * k * s]]
  const q = (a: number, b: number): P2[] => { const A = off(a), B = off(b); return [A[0]!, A[1]!, B[1]!, B[0]!] }
  poly(g, q(-t / 2 - 1, t / 2 + 1), INK)
  poly(g, q(-t / 2, t / 2), mat.m)
  poly(g, q(t / 2 - 1.2, t / 2), mat.l)
  poly(g, q(-t / 2, -t / 2 + 1.2), mat.d)
  // Grain: a few darker dashes along it.
  const n = Math.floor(len / 9)
  for (let i = 1; i < n; i++) {
    const u = i / n + (hash(i * 31 + Math.round(x0)) - 0.5) * 0.05
    const k = (hash(i * 7 + Math.round(y0)) - 0.5) * (t - 2)
    const px = x0 + dx * u + nx * k
    const py = y0 + dy * u + ny * k
    line(g, px, py, px + dx / len * 3, py + dy / len * 3, mat.d)
  }
}

/** Cobweb in a corner: `dir` 1 hangs right from (x, y), -1 hangs left. */
export function cobweb(g: G, x: number, y: number, r: number, dir: 1 | -1, c = '#c8c0e0') {
  for (let i = 0; i <= 4; i++) {
    const a = (i / 4) * Math.PI / 2
    line(g, x, y, x + Math.cos(a) * r * dir, y + Math.sin(a) * r, c)
  }
  for (let k = 1; k <= 3; k++) {
    const rr = (r * k) / 3.5
    let px = x + rr * dir
    let py = y
    for (let i = 1; i <= 4; i++) {
      const a = (i / 4) * Math.PI / 2
      const sag = 1 + (k === 3 ? 0.9 : 0.5)
      const nx = x + Math.cos(a) * rr * dir
      const ny = y + Math.sin(a) * rr
      line(g, px, py, (px + nx) / 2 - dir * sag * 0.3, (py + ny) / 2 + sag * 0.5, c)
      line(g, (px + nx) / 2 - dir * sag * 0.3, (py + ny) / 2 + sag * 0.5, nx, ny, c)
      px = nx; py = ny
    }
  }
}

/** Storm sky inside a shape test (window panes): dark clouds with a dithered glow low down. */
export function stormPane(g: G, x: number, y: number, w: number, h: number, inside: (px: number, py: number) => boolean) {
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    if (!inside(x + xx, y + yy)) continue
    const t = yy / h
    const cloud = hash((x + xx) * 3 + Math.floor((y + yy) / 3) * 97) < 0.15
    let c = t < 0.55 ? '#1a1838' : '#221e4a'
    if (bayer(x + xx, y + yy) < (t - 0.4) * 0.8) c = '#2c2a5c'
    if (cloud && t < 0.6) c = '#262250'
    g.fillStyle = c
    g.fillRect(x + xx, y + yy, 1, 1)
  }
}

export function flagAt(s: GameState, k: string): boolean { return !!s.flags[k] }
export function numAt(s: GameState, k: string): number | null {
  const v = s.flags[k]
  return typeof v === 'number' ? v : null
}

// ---------------------------------------------------------------------------
// The storeroom
// ---------------------------------------------------------------------------

const W = STOREROOM.w
const FLOOR_Y = 100
/** The sloped ceiling: y of the roof's underside at x (0 = the flat middle). */
function ceilY(x: number): number {
  if (x < 160) return 40 - x * 0.25
  if (x > 330) return (x - 330) * 0.24
  return 0
}

const WALL = { gap: '#2e1c3c', a: '#6c4a78', b: '#634270', hi: '#86609a', knot: '#4a3058', shade: '#553a66' }
const FLOORC = { gap: '#2a140e', a: '#8a5232', b: '#7a4628', hi: '#a86a40', dark: '#4a2818' }

const ROUND = { cx: 129, cy: 37, r: 15 }
const HORSE = { x: 174, y: 70 }
const RADIO = { x: 304, y: 64 }

function paintWall(g: G) {
  for (let y = 0; y < FLOOR_Y; y++) {
    const lean = (FLOOR_Y - y) * 0.07
    for (let x = 0; x < W; x++) {
      if (y < ceilY(x)) continue
      const u = x - lean
      const idx = Math.floor(u / 13)
      const fr = u - idx * 13
      let c = hash(idx * 17 + 3) < 0.5 ? WALL.a : WALL.b
      if (fr < 1) c = WALL.gap
      else if (fr < 2) c = WALL.hi
      else if (hash(idx * 131 + Math.floor(y / 2) * 7) < 0.035) c = WALL.knot
      // The top of the wall sits in shadow.
      if (c !== WALL.gap && bayer(x, y) < 0.7 - y / 45) c = c === WALL.hi ? WALL.a : WALL.shade
      g.fillStyle = c
      g.fillRect(x, y, 1, 1)
    }
  }
  // Baseboard.
  for (let x = 0; x < W; x++) {
    rect(g, x, FLOOR_Y - 4, 1, 3, WOOD.m)
    dot(g, x, FLOOR_Y - 4, WOOD.l)
    dot(g, x, FLOOR_Y - 1, INK)
  }
}

function paintCeiling(g: G) {
  for (let x = 0; x < W; x++) {
    const cy = ceilY(x)
    for (let y = 0; y < cy; y++) {
      const d = cy - y
      const idx = Math.floor(d / 5)
      let c = idx % 2 ? PLUM.d : PLUM.m
      if (d % 5 < 1) c = PLUM.k
      if (bayer(x, y) < 0.25) c = PLUM.k
      dot(g, x, y, c)
    }
  }
  // The eave purlins, following the slopes.
  beam(g, -4, 42, 162, -2, 6)
  beam(g, 328, -2, 464, 32, 6)
  beam(g, -4, 20, 80, -2, 4)
  beam(g, 400, -2, 464, 14, 4)
}

function paintFloor(g: G) {
  const vx = 230
  const vy = -70
  const pw = 10
  for (let y = FLOOR_Y; y < 144; y++) {
    const s = (y - vy) / (FLOOR_Y - vy)
    for (let x = 0; x < W; x++) {
      const u = vx + (x - vx) / s
      const idx = Math.floor(u / pw)
      const fr = (u - idx * pw) * s
      // Plank ends: one joint per plank at a hashed depth.
      const joint = FLOOR_Y + 4 + Math.floor(hash(idx * 7 + 11) * 38)
      let c = hash(idx * 13 + 5) < 0.5 ? FLOORC.a : FLOORC.b
      if (fr < 1) c = FLOORC.gap
      else if (y === joint) c = FLOORC.gap
      else if (y === joint + 1 || fr < 2) c = FLOORC.hi
      else if (hash(idx * 3 + y * 5) < 0.04) c = FLOORC.dark
      // Darker towards the back wall.
      if (y < FLOOR_Y + 8 && bayer(x, y) < (FLOOR_Y + 8 - y) / 10) c = FLOORC.dark
      dot(g, x, y, c)
    }
  }
}

function paintBeams(g: G) {
  // Posts, leaning like they've had a long night, with braces.
  beam(g, 170, 8, 164, FLOOR_Y - 2, 7)
  beam(g, 164, 60, 124, 10, 4)
  beam(g, 168, 52, 206, 10, 4)
  beam(g, 382, 6, 388, FLOOR_Y - 2, 7)
  beam(g, 384, 48, 350, 8, 4)
  // The collar beam across the whole room, a little tilted.
  beam(g, -6, 12, W + 6, 6, 8)
  // Pegs where the braces meet.
  for (const [x, y] of [[167, 9], [385, 7], [166, 56], [385, 46]] as const) { dot(g, x, y, WOOD.h); dot(g, x + 1, y + 1, WOOD.k) }
}

function paintDumbwaiter(g: G) {
  const x = 14
  const y = 56
  // Frame with rose trim, a little crooked.
  polyO(g, [[x, y + 1], [x + 36, y - 1], [x + 36, y + 38], [x, y + 38]], '#c04a6a')
  rect(g, x + 1, y + 1, 34, 1, '#e8708a')
  rect(g, x + 3, y + 4, 30, 32, INK)
  // Two little doors.
  for (const dx of [0, 15]) {
    rect(g, x + 4 + dx, y + 5, 14, 30, WOOD.m)
    rect(g, x + 4 + dx, y + 5, 14, 1, WOOD.l)
    rect(g, x + 6 + dx, y + 8, 10, 10, WOOD.d)
    rect(g, x + 6 + dx, y + 21, 10, 11, WOOD.d)
    rect(g, x + 7 + dx, y + 9, 8, 1, WOOD.l)
    rect(g, x + 7 + dx, y + 22, 8, 1, WOOD.l)
  }
  rect(g, x + 16, y + 17, 2, 4, '#ffd23f')
  rect(g, x + 19, y + 17, 2, 4, '#ffd23f')
  // A little brass arrow plate on the frame: UP / DOWN.
  rect(g, x + 15, y + 1, 7, 3, '#d8a040'); dot(g, x + 18, y + 1, INK); rect(g, x + 17, y + 2, 3, 1, INK)
  // The bell on its bracket.
  rect(g, x + 13, y - 3, 1, 3, '#8a8098')
  rect(g, x + 13, y - 4, 7, 1, '#8a8098')
  ovalO(g, x + 19, y - 7, 3, 3, '#e8b040')
  rect(g, x + 16, y - 5, 7, 1, '#ffd23f')
  rect(g, x + 15, y - 5, 9, 1, '#c4861c')
  dot(g, x + 18, y - 9, '#fff1b0')
  dot(g, x + 19, y - 3, INK)
}

function paintPortrait(g: G) {
  // Torvald, askew, and his magnificent beard (Sigurd, if you've read the letters).
  const pts: P2[] = [[56, 38], [92, 34], [95, 72], [59, 76]]
  polyO(g, pts, '#d8a040')
  poly(g, [[59, 41], [89, 37], [92, 69], [62, 73]], '#3a5a6a')
  poly(g, [[60, 60], [91, 56], [92, 69], [62, 73]], '#2a4450')
  // Head and hat.
  ovalO(g, 75, 49, 6, 7, '#f0c8a8')
  rect(g, 69, 40, 13, 3, INK); rect(g, 71, 37, 9, 4, INK)
  dot(g, 73, 48, INK); dot(g, 77, 48, INK)
  rect(g, 72, 46, 3, 1, '#6a3a20'); rect(g, 76, 46, 3, 1, '#6a3a20')
  // Sigurd.
  poly(g, [[68, 51], [83, 51], [85, 60], [80, 71], [75, 73], [70, 71], [66, 60]], '#b0542a')
  poly(g, [[70, 53], [81, 53], [82, 60], [78, 69], [75, 70], [72, 69], [69, 60]], '#d87a3c')
  line(g, 72, 56, 74, 66, '#ffa860'); line(g, 78, 56, 76, 66, '#ffa860')
  rect(g, 73, 52, 5, 1, '#8a3418')
  dot(g, 75, 53, '#e0607a')
  // Nameplate.
  rect(g, 70, 70, 11, 3, '#ffd23f')
}

function paintHatboxes(g: G) {
  box(g, 104, 96, 18, 8, '#3fa89a', '#6fd8c0', '#1f6a60')
  rect(g, 104, 99, 18, 1, '#e0607a')
  box(g, 106, 86, 14, 9, '#c04a6a', '#e8708a', '#7a2040')
  rect(g, 106, 89, 14, 1, '#ffd23f')
  box(g, 108, 79, 10, 6, '#ffd23f', '#fff1b0', '#c4861c')
}

function paintRoundWindowFrame(g: G) {
  const { cx, cy, r } = ROUND
  disc(g, cx, cy, r + 5, INK)
  disc(g, cx, cy, r + 4, WOOD.m)
  // Lit top rim, dark bottom rim.
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2
    const x = cx + Math.cos(t) * (r + 3)
    const y = cy + Math.sin(t) * (r + 3)
    dot(g, x, y, Math.sin(t) < -0.2 ? WOOD.h : Math.sin(t) > 0.4 ? WOOD.d : WOOD.l)
  }
  disc(g, cx, cy, r + 1, INK)
  stormPane(g, cx - r, cy - r, r * 2 + 1, r * 2 + 1, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r)
  // Sill.
  box(g, cx - 12, cy + r + 4, 24, 3, WOOD.l, WOOD.h, WOOD.d)
}

function paintHatch(g: G) {
  // The trapdoor Espen was yanked through, in the floor's perspective.
  const pts: P2[] = [[137, 121], [165, 121], [168, 136], [134, 136]]
  poly(g, pts.map(p => [p[0], p[1] - 1] as P2), INK)
  poly(g, [[135, 122], [167, 122], [170, 137], [132, 137]], INK)
  poly(g, [[137, 122], [165, 122], [167, 135], [135, 135]], '#6a3a22')
  for (const u of [0.25, 0.5, 0.75]) line(g, 137 + 28 * u, 122, 135 + 32 * u, 135, '#4a2414')
  line(g, 137, 122, 165, 122, '#9a5a30')
  // Hinges and a ring.
  rect(g, 138, 125, 5, 2, '#5a5870'); rect(g, 159, 125, 5, 2, '#5a5870')
  oval(g, 151, 131, 3, 2, '#8a8098'); oval(g, 151, 131, 2, 1, '#6a3a22'); dot(g, 151, 129, '#c8c0e0')
}

function paintMannequin(g: G) {
  const cx = 288
  // Tripod stand.
  rect(g, cx - 1, 90, 3, 18, INK); rect(g, cx, 90, 1, 18, '#8a6a40')
  line(g, cx, 107, cx - 9, 111, INK); line(g, cx, 107, cx + 9, 111, INK); line(g, cx, 107, cx + 2, 112, INK)
  line(g, cx, 106, cx - 9, 110, '#8a6a40'); line(g, cx, 106, cx + 9, 110, '#8a6a40')
  // Dress form in the Professor's old lab coat.
  const body: P2[] = [[cx - 9, 50], [cx + 9, 50], [cx + 11, 58], [cx + 8, 70], [cx + 11, 88], [cx - 11, 88], [cx - 8, 70], [cx - 11, 58]]
  polyO(g, body, '#e8e4f4')
  poly(g, [[cx + 3, 50], [cx + 9, 50], [cx + 11, 58], [cx + 8, 70], [cx + 11, 88], [cx + 4, 88]], '#c0b8dc')
  // Lapels, buttons, a pocket with pencils.
  line(g, cx - 3, 51, cx, 64, '#8a80b0'); line(g, cx + 3, 51, cx, 64, '#8a80b0')
  poly(g, [[cx - 2, 51], [cx + 2, 51], [cx, 58]], '#7a3a8a')
  for (const y of [67, 74, 81]) dot(g, cx, y, '#5a5285')
  rect(g, cx - 8, 58, 5, 4, '#c0b8dc'); dot(g, cx - 7, 57, '#e0607a'); dot(g, cx - 5, 56, '#ffd23f')
  // A white cat hair. Espen noticed.
  line(g, cx + 5, 76, cx + 7, 78, '#ffffff')
  // Neck knob, head knob, and a feathered hat.
  rect(g, cx - 1, 46, 3, 4, INK); rect(g, cx, 46, 1, 4, '#b07040')
  ovalO(g, cx, 42, 4, 4, '#c88050')
  dot(g, cx - 1, 40, '#e8a878')
  rect(g, cx - 8, 38, 17, 2, INK); rect(g, cx - 7, 38, 15, 1, '#7a3a8a')
  poly(g, [[cx - 4, 38], [cx + 4, 38], [cx + 3, 33], [cx - 3, 33]], '#9a4ff0')
  rect(g, cx - 4, 36, 9, 1, '#ff8ae0')
  // The feather.
  for (let i = 0; i < 10; i++) {
    const fx = cx + 4 + i
    const fy = 34 - i * 1.3 + (i > 6 ? (i - 6) * 1.2 : 0)
    dot(g, fx, fy, '#ff8ae0'); dot(g, fx, fy + 1, '#ff2fa0')
  }
}

function paintRadioCrate(g: G) {
  const x = RADIO.x + 2
  box(g, x, 90, 36, 20, WOOD.l, WOOD.h, WOOD.d)
  for (const yy of [95, 101, 106]) rect(g, x, yy, 36, 1, WOOD.d)
  rect(g, x + 2, 90, 1, 20, WOOD.d); rect(g, x + 33, 90, 1, 20, WOOD.d)
  // A stencilled arrow: THIS WAY UP (it isn't).
  rect(g, x + 16, 97, 5, 1, INK); rect(g, x + 18, 96, 1, 3, INK); dot(g, x + 18, 102, INK)
}

function paintRadio(g: G) {
  const x = RADIO.x
  const y = RADIO.y
  // A cathedral radio: an arched walnut case.
  const w = 40
  oval(g, x + w / 2, y + 10, w / 2 + 1, 11, INK)
  rect(g, x - 1, y + 10, w + 2, 17, INK)
  oval(g, x + w / 2, y + 10, w / 2, 10, WOOD.m)
  rect(g, x, y + 10, w, 16, WOOD.m)
  oval(g, x + w / 2, y + 10, w / 2 - 1, 9, WOOD.l)
  oval(g, x + w / 2, y + 11, w / 2 - 3, 8, WOOD.m)
  rect(g, x + 2, y + 11, w - 4, 13, WOOD.m)
  // The speaker cloth with wooden bars.
  oval(g, x + w / 2, y + 11, 11, 7, '#d8a040')
  rect(g, x + w / 2 - 11, y + 11, 23, 6, '#d8a040')
  for (let i = -8; i <= 8; i += 4) rect(g, x + w / 2 + i, y + 5, 2, 12, WOOD.d)
  dot(g, x + w / 2 - 6, y + 7, '#ffe070')
  // Dial and knobs.
  box(g, x + 13, y + 19, 14, 4, '#3a2418')
  rect(g, x + 4, y + 20, 5, 4, INK); rect(g, x + 5, y + 20, 3, 3, '#e8d8b0')
  rect(g, x + 31, y + 20, 5, 4, INK); rect(g, x + 32, y + 20, 3, 3, '#e8d8b0')
  // The empty antenna socket.
  rect(g, x + w - 7, y + 1, 3, 2, INK)
}

function paintFrames(g: G) {
  // Old picture frames leaning on the wall (the trunk will roll in front of them).
  polyO(g, [[352, 66], [372, 64], [376, 98], [354, 99]], '#ffd23f')
  poly(g, [[355, 69], [370, 67], [373, 95], [357, 96]], '#2a5a5a')
  oval(g, 364, 82, 4, 6, '#3fa89a')
  polyO(g, [[362, 74], [390, 76], [388, 99], [360, 98]], '#c04a6a')
  poly(g, [[365, 77], [387, 79], [385, 96], [363, 95]], '#5a2a4a')
  line(g, 366, 90, 372, 84, '#ffd23f'); line(g, 372, 84, 378, 88, '#ffd23f'); line(g, 378, 88, 384, 82, '#ffd23f')
}

function paintDoor(g: G) {
  // The study door, leaning like everything else.
  const f: P2[] = [[400, 32], [444, 36], [446, FLOOR_Y], [398, FLOOR_Y]]
  polyO(g, f, '#c04a6a')
  poly(g, [[401, 33], [443, 37], [443, 38], [401, 34]], '#e8708a')
  const d: P2[] = [[404, 38], [440, 41], [441, FLOOR_Y - 1], [403, FLOOR_Y - 1]]
  poly(g, d, INK)
  poly(g, [[405, 39], [439, 42], [440, FLOOR_Y - 1], [404, FLOOR_Y - 1]], '#2a8a86')
  poly(g, [[409, 46], [420, 47], [420, 66], [409, 66]], '#1f6a66')
  poly(g, [[424, 47], [435, 48], [435, 66], [424, 66]], '#1f6a66')
  poly(g, [[409, 72], [420, 72], [420, 94], [409, 94]], '#1f6a66')
  poly(g, [[424, 72], [435, 72], [435, 94], [424, 94]], '#1f6a66')
  line(g, 409, 46, 420, 47, '#6fd8c0'); line(g, 424, 47, 435, 48, '#6fd8c0')
  line(g, 409, 72, 420, 72, '#6fd8c0'); line(g, 424, 72, 435, 72, '#6fd8c0')
  // Brass plate (STUDY) and knob.
  box(g, 414, 52, 16, 5, '#d8a040', '#ffe070', '#8a5a18')
  rect(g, 416, 54, 12, 1, '#5a3a10')
  ovalO(g, 408, 70, 2, 2, '#ffd23f')
  dot(g, 407, 69, '#fff1b0')
}

function paintClutter(g: G) {
  cobweb(g, 1, 42, 10, 1)
  cobweb(g, W - 2, 30, 10, -1)
  cobweb(g, 171, 14, 7, 1)
  // A birdcage hanging from the collar beam (door open; nobody home).
  line(g, 206, 13, 206, 20, '#8a8098')
  const bx = 206
  oval(g, bx, 27, 7, 6, INK)
  rect(g, bx - 8, 27, 17, 12, INK)
  for (let i = -6; i <= 6; i += 2) line(g, bx + i, 26 + Math.abs(i) * 0.4 - 2, bx + i, 38, '#e8b040')
  oval(g, bx, 24, 6, 3, '#e8b040'); oval(g, bx, 24, 5, 2, INK)
  rect(g, bx - 8, 38, 17, 2, '#c4861c')
  rect(g, bx - 3, 31, 6, 1, '#e8b040')
  // Its little door, swung open.
  line(g, bx + 8, 30, bx + 12, 33, '#e8b040'); line(g, bx + 8, 36, bx + 12, 38, '#e8b040'); line(g, bx + 12, 33, bx + 12, 38, '#e8b040')
  // Hanging oil lamp hook.
  rect(g, 244, 12, 1, 5, '#8a8098')
  // The pulley and the chandelier cord that yanked Espen up.
  ovalO(g, 150, 17, 3, 3, '#8a8098')
  dot(g, 150, 17, INK)
}

function paintCostumeTrunkBase(g: G) {
  // Body only; the lid is drawn by back() (open or shut).
  box(g, 226, 94, 46, 18, '#b0602a', '#d8804a', '#6a3418')
  for (const x of [232, 264]) rect(g, x, 94, 3, 18, '#5a5870')
  rect(g, 245, 99, 8, 5, INK); rect(g, 246, 100, 6, 3, '#d8a040')
  // Stencil stripes.
  rect(g, 238, 106, 22, 1, '#ffd23f')
  rect(g, 238, 108, 22, 1, '#ffd23f')
}

function paintLetterTrunkBase(g: G) {
  box(g, 54, 98, 46, 14, '#8a2a4a', '#b0406a', '#5a1a30')
  for (const x of [54, 96]) { rect(g, x, 98, 4, 4, '#d8a040'); rect(g, x, 108, 4, 4, '#d8a040') }
  rect(g, 66, 98, 3, 14, '#5a1a30'); rect(g, 85, 98, 3, 14, '#5a1a30')
  rect(g, 75, 99, 4, 5, '#ffd23f'); dot(g, 76, 101, INK)
}

// Cached state props -------------------------------------------------------

function letterLid(open: boolean): HTMLCanvasElement {
  return cachedSprite('sr-letterlid-' + open, 52, 20, g => {
    if (!open) {
      // A domed lid with brass corners, H.V. in brass tacks.
      oval(g, 26, 12, 24, 8, INK)
      rect(g, 1, 12, 50, 7, INK)
      oval(g, 26, 12, 23, 7, '#8a2a4a')
      rect(g, 2, 12, 48, 6, '#8a2a4a')
      oval(g, 26, 11, 21, 5, '#b0406a')
      oval(g, 26, 12, 21, 5, '#8a2a4a')
      rect(g, 2, 17, 48, 1, '#5a1a30')
      rect(g, 14, 6, 3, 12, '#5a1a30'); rect(g, 33, 6, 3, 12, '#5a1a30')
      for (const [x, y] of [[21, 10], [21, 12], [21, 14], [23, 12], [25, 10], [25, 12], [25, 14], [28, 10], [28, 12], [29, 14], [30, 12], [31, 10]] as const) dot(g, x, y, '#ffd23f')
      rect(g, 2, 13, 4, 5, '#d8a040'); rect(g, 46, 13, 4, 5, '#d8a040')
    } else {
      // Thrown back: the pink-lined underside.
      oval(g, 26, 9, 24, 8, INK)
      rect(g, 1, 9, 50, 10, INK)
      oval(g, 26, 9, 23, 7, '#5a1a30')
      rect(g, 2, 9, 48, 9, '#5a1a30')
      oval(g, 26, 10, 20, 5, '#e0708a')
      rect(g, 6, 10, 40, 7, '#e0708a')
      dither(g, 6, 10, 40, 7, '#c05070', 0.4)
    }
  })
}

function letterInside(taken: boolean): HTMLCanvasElement {
  return cachedSprite('sr-letterin-' + taken, 44, 8, g => {
    rect(g, 0, 0, 44, 8, '#2a0c1a')
    // Socks.
    oval(g, 34, 5, 4, 2, '#6a6a9a'); oval(g, 8, 5, 3, 2, '#9a6a3a')
    if (!taken) {
      box(g, 12, 1, 18, 6, '#f4ecd8', '#ffffff', '#c8b898')
      box(g, 14, -1, 15, 5, '#fff8e8', '#ffffff', '#d8c8a8')
      rect(g, 13, 3, 17, 1, '#ff5c9a')
      rect(g, 20, 0, 1, 7, '#ff5c9a')
      dot(g, 19, 2, '#ff5c9a'); dot(g, 21, 2, '#ff5c9a'); dot(g, 18, 1, '#ff5c9a'); dot(g, 22, 1, '#ff5c9a')
    }
  })
}

function costumeLid(open: boolean): HTMLCanvasElement {
  return cachedSprite('sr-costlid-' + open, 60, 34, g => {
    if (!open) {
      // Shut, with a feather boa escaping.
      box(g, 6, 24, 46, 6, '#c8703a', '#e89058', '#8a4420')
      for (const x of [12, 44]) rect(g, x, 24, 3, 6, '#5a5870')
      for (let i = 0; i < 16; i++) {
        const x = 40 + i * 0.9
        const y = 28 + Math.sin(i * 0.9) * 1.5 + i * 0.35
        dot(g, x, y, '#ff8ae0'); dot(g, x + 1, y - 1, '#ff2fa0'); dot(g, x, y + 1, '#ff2fa0')
      }
    } else {
      // Lid up behind, and the costumes piled out.
      box(g, 6, 6, 46, 18, '#8a4420', '#c8703a', '#5a2a10')
      rect(g, 10, 10, 38, 11, '#5a2a10')
      // Gorilla arm over the front.
      poly(g, [[8, 26], [15, 25], [16, 33], [10, 34]], INK)
      poly(g, [[9, 26], [14, 26], [15, 32], [11, 33]], '#3a2c3a')
      dot(g, 11, 28, '#5a4a5a'); dot(g, 13, 31, '#5a4a5a')
      // Viking helmet with horns.
      oval(g, 24, 24, 6, 5, INK); oval(g, 24, 24, 5, 4, '#9a9ab8'); rect(g, 18, 25, 13, 2, '#d8a040')
      line(g, 18, 22, 14, 15, INK); line(g, 19, 22, 15, 16, '#fff4e0'); line(g, 17, 23, 14, 17, '#fff4e0')
      line(g, 30, 22, 34, 15, INK); line(g, 29, 22, 33, 16, '#fff4e0'); line(g, 31, 23, 34, 17, '#fff4e0')
      // Pirate hat.
      poly(g, [[34, 26], [52, 26], [49, 20], [43, 22], [37, 20]], INK)
      poly(g, [[35, 25], [51, 25], [48, 21], [43, 23], [38, 21]], '#2a2040')
      dot(g, 43, 23, '#fff4ff'); dot(g, 42, 24, '#fff4ff'); dot(g, 44, 24, '#fff4ff')
      // The boa, everywhere.
      for (let i = 0; i < 26; i++) {
        const x = 6 + i * 1.9
        const y = 28 + Math.sin(i * 0.7) * 2
        dot(g, x, y, '#ff8ae0'); dot(g, x + 1, y - 1, '#ff2fa0'); dot(g, x, y + 1, '#ff2fa0')
      }
      // A spare rabbit ear, poking out.
      poly(g, [[26, 17], [29, 5], [31, 17]], INK); poly(g, [[27, 16], [29, 7], [30, 16]], '#fff4ff'); line(g, 29, 9, 29, 15, '#ff8ae0')
    }
  })
}

function horseSprite(): HTMLCanvasElement {
  return cachedSprite('sr-horse', 46, 42, g => {
    // Rockers.
    for (let x = 1; x < 45; x++) {
      const y = 36 + Math.round(((x - 23) / 22) ** 2 * -4) + 3
      rect(g, x, y - 1, 1, 4, INK)
    }
    for (let x = 2; x < 44; x++) {
      const y = 36 + Math.round(((x - 23) / 22) ** 2 * -4) + 3
      dot(g, x, y, '#c04a6a'); dot(g, x, y + 1, '#8a2a4a')
    }
    // Legs.
    for (const [x0, x1] of [[12, 8], [17, 15], [30, 31], [35, 38]] as const) {
      line(g, x0, 22, x1, 37, INK); line(g, x0 + 1, 22, x1 + 1, 37, INK); line(g, x0 + 2, 22, x1 + 2, 36, INK)
      line(g, x0 + 1, 22, x1 + 1, 35, '#f0e8ff')
    }
    // Body.
    oval(g, 25, 19, 15, 7, INK)
    oval(g, 25, 19, 14, 6, '#f0e8ff')
    oval(g, 25, 21, 13, 4, '#d8d0ec')
    for (const [x, y] of [[18, 17], [30, 21], [34, 17], [22, 22], [27, 18]] as const) { dot(g, x, y, '#a8a0c8'); dot(g, x + 1, y, '#a8a0c8') }
    // Neck and head (facing left).
    poly(g, [[8, 16], [14, 3], [20, 6], [19, 18]], INK)
    poly(g, [[9, 16], [14, 4], [19, 7], [18, 17]], '#f0e8ff')
    oval(g, 7, 8, 7, 4, INK)
    oval(g, 7, 8, 6, 3, '#f0e8ff')
    oval(g, 3, 9, 3, 2, '#e8b0c0')
    dot(g, 2, 9, INK)
    dot(g, 9, 6, INK); dot(g, 10, 6, '#ffffff')
    dot(g, 9, 5, INK)
    // A wild eye.
    rect(g, 8, 5, 3, 3, INK); dot(g, 9, 6, '#ffffff')
    // Ears.
    poly(g, [[12, 2], [13, -2], [15, 3]], INK); dot(g, 13, 1, '#f0e8ff')
    // Mane.
    for (let i = 0; i < 9; i++) { dot(g, 15 + i * 0.6, 3 + i * 1.5, '#e0607a'); dot(g, 16 + i * 0.6, 3 + i * 1.5, '#b01874') }
    // Saddle.
    poly(g, [[20, 12], [32, 12], [31, 18], [21, 18]], INK)
    poly(g, [[21, 13], [31, 13], [30, 17], [22, 17]], '#d03050')
    rect(g, 21, 13, 10, 1, '#ff5c7a')
    rect(g, 25, 17, 2, 6, '#ffd23f')
    // Tail.
    for (let i = 0; i < 8; i++) { dot(g, 39 + i * 0.5, 15 + i * 1.3, '#6a3a20'); dot(g, 40 + i * 0.5, 15 + i * 1.3, '#9a5a30') }
  })
}

function heavyTrunkSprite(): HTMLCanvasElement {
  const w = STOREROOM.trunkW
  return cachedSprite('sr-heavytrunk', w + 2, 34, g => {
    box(g, 1, 1, w, 28, '#2a5a78', '#4a8aa8', '#1a3a50')
    // Wooden slats and iron bands.
    for (const x of [8, 26, 44]) { rect(g, x, 1, 3, 28, WOOD.m); rect(g, x, 1, 1, 28, WOOD.l) }
    rect(g, 1, 7, w, 2, '#5a5870'); rect(g, 1, 7, w, 1, '#8a8098')
    rect(g, 1, 22, w, 2, '#5a5870'); rect(g, 1, 22, w, 1, '#8a8098')
    // Travel stickers.
    box(g, 13, 11, 9, 7, '#ffd23f', '#fff1b0', '#c4861c'); rect(g, 15, 14, 5, 1, '#c04a6a')
    box(g, 31, 12, 10, 6, '#e0607a', '#ff8aa8', '#9a2a4a'); rect(g, 33, 14, 6, 1, '#fff4ff')
    oval(g, 49, 15, 3, 3, '#3fd8b0'); dot(g, 49, 15, INK)
    // A padlock.
    rect(g, 24, 12, 6, 6, INK); rect(g, 25, 13, 4, 4, '#d8a040'); rect(g, 25, 10, 4, 1, INK); dot(g, 24, 11, INK); dot(g, 29, 11, INK)
    dot(g, 27, 15, INK)
    // Castors.
    for (const x of [5, 27, 48]) { rect(g, x - 1, 29, 3, 1, INK); oval(g, x, 31, 2, 2, INK); dot(g, x, 31, '#8a8098') }
  })
}

function antennaWire(g: G, t: number) {
  // Espen's coat-hanger ear wire, bent into an antenna, with a little loop.
  const x = RADIO.x + 34
  const y = RADIO.y + 2
  const sway = Math.round(Math.sin(t * 1.3))
  line(g, x, y, x - 2, y - 14, '#c8c0e0')
  line(g, x - 2, y - 14, x + 3 + sway, y - 22, '#c8c0e0')
  line(g, x + 3 + sway, y - 22, x + 7 + sway, y - 20, '#c8c0e0')
  line(g, x + 7 + sway, y - 20, x + 4 + sway, y - 17, '#c8c0e0')
  dot(g, x - 1, y - 8, '#fff4ff')
  // A tuft of rabbit fur still caught on it.
  dot(g, x + 7 + sway, y - 21, '#fff4ff'); dot(g, x + 8 + sway, y - 21, '#fff4ff')
}

function trunkX(s: GameState): number {
  if (!s.flags[F.trunkMoved]) return STOREROOM.trunkX0
  const t0 = numAt(s, 'storeroom.trunkT')
  const k = t0 === null ? 1 : Math.max(0, Math.min(1, (s.time - t0) / 1.1))
  const e = 1 - (1 - k) * (1 - k)
  return Math.round(STOREROOM.trunkX0 + (STOREROOM.trunkX1 - STOREROOM.trunkX0) * e)
}

/** How far the rocking horse leans, in px at its nose: pushed, or spooked by thunder. */
function horseRock(s: GameState, v: View): number {
  const t0 = numAt(s, 'storeroom.rockT')
  let a = 0
  if (t0 !== null) {
    const dt = s.time - t0
    if (dt >= 0 && dt < 4) a = Math.sin(dt * 5) * 3 * (1 - dt / 4)
  }
  if (v.flash > 0.05) a += Math.sin(v.t * 9) * 2 * Math.min(1, v.flash * 1.5)
  return a
}

function lampFlicker(t: number): number {
  return 0.85 + Math.sin(t * 7.1) * 0.05 + Math.sin(t * 17.3) * 0.04 + (hash(Math.floor(t * 12)) - 0.5) * 0.06
}

export const painter: RoomPainter = {
  paint(g, w, h) {
    rect(g, 0, 0, w, h, '#120a20')
    paintWall(g)
    paintCeiling(g)
    paintFloor(g)
    paintBeams(g)
    paintRoundWindowFrame(g)
    paintDumbwaiter(g)
    paintPortrait(g)
    paintHatboxes(g)
    paintFrames(g)
    paintDoor(g)
    paintMannequin(g)
    paintRadioCrate(g)
    paintRadio(g)
    paintCostumeTrunkBase(g)
    paintLetterTrunkBase(g)
    paintClutter(g)
    paintHatch(g)
    // Shadows on the floor under the furniture.
    for (const [x, ww] of [[52, 50], [224, 50], [304, 40], [174, 44], [276, 26]] as const) dither(g, x, 112, ww, 2, INK, 0.5)
  },

  ambient: () => '#7a6ea4',

  back(g, s, v) {
    // The storm through the round window.
    const { cx, cy, r } = ROUND
    rainIn(g, cx - r + 1, cy - r + 1, r * 2 - 1, r * 2 - 1, v.t, 12, v.flash)
    // Mullions over the pane.
    rect(g, cx - r, cy, r * 2 + 1, 2, INK); rect(g, cx, cy - r, 2, r * 2 + 1, INK)
    rect(g, cx - r + 1, cy, r * 2 - 1, 1, WOOD.l); rect(g, cx, cy - r + 1, 1, r * 2 - 1, WOOD.l)

    // The chandelier cord, frayed, swaying from the pulley.
    const sw = Math.sin(v.t * 0.9) * 1.5
    line(g, 147, 18, 147 + sw, 64, '#c8a060')
    line(g, 148, 18, 148 + sw, 64, '#8a6a30')
    dot(g, 146 + sw, 65, '#c8a060'); dot(g, 148 + sw, 66, '#c8a060'); dot(g, 150 + sw, 65, '#c8a060')

    // The floor hatch, when the intro has it hanging open.
    if (s.flags['storeroom.hatchOpen']) {
      poly(g, [[137, 122], [165, 122], [167, 135], [135, 135]], '#07040d')
      dither(g, 137, 131, 30, 4, '#3a2418', 0.3)
      poly(g, [[137, 122], [165, 122], [165, 108], [137, 108]], INK)
      poly(g, [[138, 121], [164, 121], [164, 110], [138, 110]], '#6a3a22')
      line(g, 138, 110, 164, 110, '#9a5a30')
      for (const u of [0.25, 0.5, 0.75]) line(g, 138 + 26 * u, 111, 138 + 26 * u, 120, '#4a2414')
    }

    // Old trunk of letters: lid and contents.
    const open = flagAt(s, 'storeroom.lettersOpen')
    if (open) {
      g.drawImage(letterInside(flagAt(s, F.lettersTaken)), 55, 91)
      g.drawImage(letterLid(true), 51, 74)
    } else g.drawImage(letterLid(false), 51, 82)

    // Rocking horse.
    const rock = horseRock(s, v)
    shear(g, horseSprite(), HORSE.x, HORSE.y, i => Math.round(((23 - i) / 23) * rock))

    // Costume trunk lid.
    const copen = flagAt(s, 'storeroom.costumesOpen')
    g.drawImage(costumeLid(copen), 220, copen ? 72 : 66)

    // The radio's antenna (Espen's ear wire).
    if (s.flags[F.earsFlop]) antennaWire(g, v.t)

    // The heavy trunk, rolled or not.
    g.drawImage(heavyTrunkSprite(), trunkX(s) - 1, STOREROOM.trunkY - 1)
  },

  front(g, _s, v) {
    // A spider on a thread, bobbing over the room.
    const y = 22 + Math.round(Math.sin(v.t * 0.7) * 6)
    line(g, 118, 16, 118, y, '#8a80a8')
    dot(g, 117, y + 1, INK); dot(g, 118, y + 1, INK); dot(g, 119, y + 1, INK); dot(g, 118, y + 2, INK)
    dot(g, 116, y, INK); dot(g, 120, y, INK); dot(g, 116, y + 3, INK); dot(g, 120, y + 3, INK)
  },

  lights(L, s, v) {
    const f = lampFlicker(v.t)
    L(244, 30, 120, '#ffc890', 0.95 * f)
    L(244, 30, 34, '#ffe0b0', 0.8 * f)
    L(160, 125, 70, '#ffb070', 0.25 * f)
    L(ROUND.cx, ROUND.cy, 40, '#8fa6ff', 0.45 + v.flash * 0.9)
    if (v.flash > 0.1) L(ROUND.cx + 30, 118, 70, '#c8d0ff', v.flash * 0.9)
    L(RADIO.x + 20, RADIO.y + 21, 20, '#ffb050', s.flags[F.radioHeard] ? 0.7 : 0.25)
    L(30, 70, 50, '#ff9a70', 0.15)
  },

  glow(g, s, v) {
    // The oil lamp's flame.
    const f = lampFlicker(v.t)
    rect(g, 241, 17, 7, 2, INK)
    rect(g, 240, 19, 9, 1, '#c4861c')
    oval(g, 244, 24, 4, 5, '#3a2418')
    oval(g, 244, 24, 3, 4, '#ffe0a0')
    dot(g, 244, 22 - (f > 0.9 ? 1 : 0), '#ffffff'); rect(g, 243, 23, 3, 3, '#ffd23f')
    rect(g, 241, 29, 7, 2, '#c4861c')
    // The radio's dial.
    const heard = !!s.flags[F.radioHeard]
    rect(g, RADIO.x + 14, RADIO.y + 20, 12, 2, heard ? '#ffc040' : '#b07020')
    dot(g, RADIO.x + 17 + Math.round(Math.sin(v.t * 0.6) * (heard ? 4 : 0)), RADIO.y + 20, '#ff3b5c')
    // Lightning in the round window, and a shaft of storm light with dust in it.
    if (v.flash > 0.12) {
      const { cx, cy, r } = ROUND
      const seed = Math.floor(v.t * 3)
      if (v.flash > 0.45) {
        g.save()
        g.beginPath(); g.rect(cx - r + 1, cy - r + 1, r * 2 - 1, r * 2 - 1); g.clip()
        bolt(g, cx - 6 + (seed % 9), cy - r, cy + r, seed, '#f4f0ff')
        g.restore()
      }
      // The shaft: a tapering beam down to the floor, where the window's
      // cross lands as a bright patch.
      const a = Math.min(1, v.flash)
      const fy = 121
      for (let y = cy + r; y < fy; y++) {
        const k = (y - cy - r) / (fy - cy - r)
        const x0 = cx - 11 + k * 36
        const x1 = cx + 11 + k * 62
        const d = a * 0.16 * (1 - k * 0.5)
        for (let x = Math.round(x0); x < x1; x++) {
          const edge = Math.min(x - x0, x1 - x) < 3 ? 0.5 : 1
          if (bayer(x, y) < d * edge) dot(g, x, y, '#c8d0ff')
        }
      }
      const px = cx + 50
      for (let y = fy - 5; y <= fy + 5; y++) for (let x = px - 26; x <= px + 26; x++) {
        const q = ((x - px) / 26) ** 2 + ((y - fy) / 5.5) ** 2
        if (q > 1 || Math.abs(x - px) < 1.5 || Math.abs(y - fy) < 0.8) continue
        if (bayer(x, y) < a * 0.45 * (1 - q * 0.5)) dot(g, x, y, '#e0e4ff')
      }
      // Dust, lit up in the shaft.
      for (let i = 0; i < 16; i++) {
        const k = hash(i * 7 + 3)
        const y = cy + r + k * (fy - cy - r)
        const x = cx - 8 + k * 36 + hash(i * 11 + 1) * (22 + k * 26) + Math.sin(v.t + i) * 2
        dot(g, x, y + Math.sin(v.t * 0.8 + i * 2) * 2, '#ffffff')
      }
    }
    // Dust motes in the lamp light, drifting.
    for (let i = 0; i < 14; i++) {
      const px = 200 + hash(i * 5 + 1) * 90 + Math.sin(v.t * 0.4 + i) * 6
      const py = 30 + ((hash(i * 9 + 2) * 70 + v.t * (2 + hash(i) * 3)) % 70)
      if (hash(i * 3 + Math.floor(v.t * 2)) < 0.8) dot(g, px, py, '#ffe8c0')
    }
  },
}
