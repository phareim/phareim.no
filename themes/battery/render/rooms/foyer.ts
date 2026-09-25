/**
 * Foyer (440 wide): the chequered floor tilted like a ship's deck, the
 * grandfather clock stopped at 11:59, the Professor's portrait, the
 * staircase folded into the ceiling, the suit of armour, the coat rack with
 * the umbrella, the telephone table, the front door, the trapdoor tile and
 * the chandelier. Also the ground floor's drawing kit (rect, poly, oval,
 * dither, the chequered floor…), which the other ground-floor painters use.
 *
 * State it reads: F.stairsDown, F.frontDoorOpen, F.struck (the pendulum
 * swings and the hands say 12:00), F.furnaceLit (the radiator steams),
 * 'umbrella' in anyone's inventory, 'foyer.trapOpen' (the trapdoor hangs
 * open: the intro may set it while Dag falls).
 */
import { bayer } from '../../../base/pixel/sprites'
import { makeCanvas } from '../../../base/pixel/stage'
import { F } from '../../content/flags'
import type { GameState } from '../../types'
import type { G, LightFn, RoomPainter, View } from '../api'
import { bolt, hash, rainIn } from '../fx'

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------

export const INK = '#0b0616'
export type P2 = readonly [number, number]

export function rect(g: G, x: number, y: number, w: number, h: number, c: string) {
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
  for (let i = 0; i < 2000; i++) {
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

/** A polygon with a 1-px ink outline round it. */
export function polyK(g: G, pts: readonly P2[], c: string, ink = INK) {
  poly(g, pts, c)
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    line(g, a[0], a[1], b[0], b[1], ink)
  }
}

/** A filled ellipse. */
export function oval(g: G, cx: number, cy: number, rx: number, ry: number, c: string) {
  g.fillStyle = c
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const t = (y + 0.5 - cy) / ry
    if (Math.abs(t) > 1) continue
    const hw = rx * Math.sqrt(1 - t * t)
    const xa = Math.round(cx - hw)
    const xb = Math.round(cx + hw)
    if (xb > xa) g.fillRect(xa, y, xb - xa, 1)
  }
}

/** An ellipse with an ink rim. */
export function ovalK(g: G, cx: number, cy: number, rx: number, ry: number, c: string, ink = INK) {
  oval(g, cx, cy, rx + 1, ry + 1, ink)
  oval(g, cx, cy, rx, ry, c)
}

/** A box with an ink outline, a lit top row and a dark bottom row. */
export function box(g: G, x: number, y: number, w: number, h: number, c: string, hi?: string, lo?: string) {
  rect(g, x - 1, y - 1, w + 2, h + 2, INK)
  rect(g, x, y, w, h, c)
  if (hi) rect(g, x, y, w, 1, hi)
  if (lo) rect(g, x, y + h - 1, w, 1, lo)
}

/** Ordered dither: pixels of `c` wherever bayer < t (0–1). */
export function dither(g: G, x: number, y: number, w: number, h: number, c: string, t: number) {
  g.fillStyle = c
  x = Math.round(x); y = Math.round(y)
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (bayer(x + i, y + j) < t) g.fillRect(x + i, y + j, 1, 1)
}

/** A vertical dither ramp: t goes from t0 at the top to t1 at the bottom. */
export function ramp(g: G, x: number, y: number, w: number, h: number, c: string, t0: number, t1: number) {
  g.fillStyle = c
  x = Math.round(x); y = Math.round(y)
  for (let j = 0; j < h; j++) {
    const t = t0 + (t1 - t0) * (j / Math.max(1, h - 1))
    for (let i = 0; i < w; i++) if (bayer(x + i, y + j) < t) g.fillRect(x + i, y + j, 1, 1)
  }
}

/**
 * Draw something crooked: `draw` paints into a w×h canvas at (0, 0), which
 * is then put at (x, y) with each row shifted by `lean` × (1 − row/h) (the
 * top leans, the base stays) and each column dropped by `sag` × col/w.
 */
export function crooked(g: G, x: number, y: number, w: number, h: number, lean: number, sag: number, draw: (g: G) => void) {
  const c = makeCanvas(w, h)
  const cg = c.getContext('2d')!
  draw(cg)
  const pad = Math.ceil(Math.abs(sag)) + 1
  const c2 = makeCanvas(w + Math.ceil(Math.abs(lean)) * 2 + 2, h + pad * 2)
  const g2 = c2.getContext('2d')!
  const ox = Math.ceil(Math.abs(lean)) + 1
  for (let r = 0; r < h; r++) g2.drawImage(c, 0, r, w, 1, ox + Math.round(lean * (1 - r / h)), pad + r, w, 1)
  for (let col = 0; col < c2.width; col++) {
    g.drawImage(c2, col, 0, 1, c2.height, Math.round(x - ox + col), Math.round(y - pad + sag * (col - ox) / w), 1, c2.height)
  }
}

/**
 * A chequered floor in perspective, filling everything under `top(x)`
 * down to y = 144, with a deck tilt (rows slope by `tilt` px per px).
 */
export function checker(g: G, x0: number, x1: number, top: (x: number) => number, opt: {
  vpx: number; hy: number; tile: number; a: string; b: string; tilt?: number; grout?: string; aLo?: string; bLo?: string; far?: number
}) {
  const tilt = opt.tilt ?? 0
  for (let x = x0; x < x1; x++) {
    const ty = Math.max(0, Math.floor(top(x)))
    for (let y = ty; y < 144; y++) {
      const yy = y + 0.5 - (x - opt.vpx) * tilt
      const d = 800 / Math.max(1, yy - opt.hy)
      const X = (x + 0.5 - opt.vpx) * d / 100
      const u = X / opt.tile
      const v = d / opt.tile
      const iu = Math.floor(u)
      const iv = Math.floor(v)
      const odd = ((iu + iv) & 1) === 1
      const fu = u - iu
      const fv = v - iv
      let c = odd ? opt.a : opt.b
      // The far rows fall into shadow.
      const far = opt.far ?? 0
      if (far && y - ty < far && bayer(x, y) < 1 - (y - ty) / far) c = odd ? (opt.aLo ?? opt.a) : (opt.bLo ?? opt.b)
      else if (opt.grout && (fu < 0.045 * (d / 10) || fv < 0.05)) c = opt.grout
      g.fillStyle = c
      g.fillRect(x, y, 1, 1)
    }
  }
}

/** A glass pane with the storm in it: sky, a bolt when the flash is high, rain. */
export function stormPane(g: G, x: number, y: number, w: number, h: number, v: View, seed: number, sky = '#1a1f48', sky2 = '#2c2f6a') {
  const f = v.flash
  rect(g, x, y, w, h, f > 0.5 ? '#9ea8ff' : f > 0.2 ? '#4a4f9a' : sky)
  if (f <= 0.2) ramp(g, x, y + Math.floor(h / 2), w, Math.ceil(h / 2), sky2, 0, 0.7)
  if (f > 0.5) {
    g.save()
    g.beginPath()
    g.rect(x, y, w, h)
    g.clip()
    bolt(g, x + w * (0.3 + hash(seed + Math.floor(v.t)) * 0.4), y - 2, y + h, Math.floor(v.t * 3) + seed)
    g.restore()
  }
  rainIn(g, x, y, w, h, v.t + seed, Math.max(2, Math.round(w * h / 60)), f)
}

/** A candle flame (2×3 px) with a flicker; draw in glow(). */
export function flame(g: G, x: number, y: number, t: number, seed = 0) {
  const k = Math.floor(t * 9 + seed * 3.7) % 3
  rect(g, x, y - 2 - (k === 0 ? 1 : 0), 1, 1, '#fff1b0')
  rect(g, x, y - 1, 1, 1, '#ffd23f')
  rect(g, x + (k === 2 ? 1 : 0), y, 1, 1, '#ff8a3d')
}

/** A radiator against the wall; steam puffs above it when the furnace is lit. */
export function radiator(g: G, x: number, y: number, w: number, h: number) {
  rect(g, x - 1, y - 1, w + 2, h + 2, INK)
  for (let i = 0; i < w; i += 3) {
    rect(g, x + i, y, 2, h, '#a89a8a')
    rect(g, x + i, y, 1, h, '#d8ccb8')
    rect(g, x + i + 2, y + 1, 1, h - 2, '#4a3a4a')
  }
  rect(g, x, y + h - 2, w, 2, '#6a5a60')
  rect(g, x - 2, y + h - 4, 2, 2, '#c4861c')
}

export function steam(g: G, x: number, y: number, w: number, t: number, seed = 0) {
  for (let i = 0; i < 5; i++) {
    const p = (t * 0.5 + i / 5 + seed * 0.13) % 1
    const px = x + ((hash(i * 17 + seed) * w) | 0) + Math.round(Math.sin(t * 2 + i) * 2 * p)
    const py = y - p * 18
    const c = p < 0.4 ? '#f4f0ff' : '#cfc6ff'
    if (p > 0.85 && bayer(px | 0, py | 0) < 0.5) continue
    rect(g, px, py, p < 0.5 ? 2 : 3, p < 0.5 ? 1 : 2, c)
  }
}

/** Wallpaper: a base with a damask of small diamonds. */
export function wallpaper(g: G, x0: number, y0: number, x1: number, y1: number, base: string, fleck: string, fleck2: string) {
  rect(g, x0, y0, x1 - x0, y1 - y0, base)
  for (let y = y0 + 2; y < y1; y += 8) {
    for (let x = x0 + ((((y - y0) / 8) | 0) % 2) * 5; x < x1; x += 10) {
      dot(g, x, y, fleck)
      dot(g, x - 1, y + 1, fleck); dot(g, x + 1, y + 1, fleck)
      dot(g, x, y + 2, fleck)
      dot(g, x, y + 1, fleck2)
    }
  }
}

export function inv(s: GameState, item: string): boolean {
  return s.inv.kjell.includes(item as never) || s.inv.dag.includes(item as never) || s.inv.espen.includes(item as never)
}

// ---------------------------------------------------------------------------
// The foyer
// ---------------------------------------------------------------------------

const W = 440
/** The back edge of the floor: 98 at the left, 106 at the right (the deck tilt). */
export const foyerFloor = (x: number) => 98 + x * 8 / W

const WALL = '#5b2aa6'
const WALL_D = '#44207e'
const WALL_HI = '#7a44c8'
const PANEL = '#1f7a6e'
const PANEL_D = '#155a52'
const PANEL_HI = '#3fb89a'
const GOLD = '#ffd23f'
const GOLD_D = '#c4861c'
const WOOD = '#8a4a2a'
const WOOD_D = '#5b2a1c'
const WOOD_HI = '#c07040'

function paintWalls(g: G) {
  // Ceiling and cornice.
  rect(g, 0, 0, W, 12, '#2a1450')
  dither(g, 0, 0, W, 10, '#1c1030', 0.5)
  // Back wall, wallpaper above the wainscot.
  wallpaper(g, 20, 10, 420, 72, WALL, WALL_HI, '#e06ac0')
  ramp(g, 20, 10, 400, 14, '#2a1450', 0.6, 0)
  rect(g, 20, 10, 400, 2, GOLD_D)
  rect(g, 20, 12, 400, 1, INK)
  // Picture rail.
  rect(g, 20, 17, 400, 1, GOLD_D)
  // Wainscot: teal panels with a gold rail, sloping with the floor.
  for (let x = 20; x < 420; x++) {
    const fy = Math.round(foyerFloor(x))
    rect(g, x, 72, 1, fy - 72, PANEL)
    rect(g, x, fy - 3, 1, 3, PANEL_D)
  }
  rect(g, 20, 70, 400, 2, GOLD)
  rect(g, 20, 72, 400, 1, GOLD_D)
  rect(g, 20, 73, 400, 1, INK)
  for (let x = 26; x < 414; x += 24) {
    const fy = foyerFloor(x)
    polyK(g, [[x, 77], [x + 18, 77], [x + 18, fy - 6], [x, fy - 6]], PANEL, PANEL_D)
    rect(g, x + 1, 78, 17, 1, PANEL_HI)
  }
  // Crooked pilasters between the bays: they lean a little each way.
  for (const [x, lean] of [[86, 2], [190, -2], [248, 3], [344, -2]] as const) {
    poly(g, [[x + lean, 12], [x + lean + 5, 12], [x + 5, 72], [x, 72]], '#6d3cbc')
    line(g, x + lean, 12, x, 72, INK)
    line(g, x + lean + 5, 12, x + 5, 72, INK)
    line(g, x + lean + 1, 13, x + 1, 71, '#9a66e0')
  }
  // Left wall (to the kitchen) and right wall (to the parlour), in perspective.
  poly(g, [[0, 0], [20, 10], [20, 98.2], [0, 116]], WALL_D)
  poly(g, [[440, 0], [420, 10], [420, 105.6], [440, 120]], WALL_D)
  line(g, 20, 10, 20, 98, INK)
  line(g, 420, 10, 420, 105, INK)
  // Side doorways (open, warm light from beyond).
  poly(g, [[4, 36], [17, 42], [17, 99], [4, 110]], INK)
  poly(g, [[6, 40], [16, 45], [16, 99], [6, 108]], '#3a1a2a')
  poly(g, [[6, 70], [16, 72], [16, 99], [6, 108]], '#5a2a2a')
  poly(g, [[6, 96], [16, 94], [16, 99], [6, 108]], '#8a4a3a')
  line(g, 3, 35, 18, 42, GOLD_D); line(g, 3, 35, 3, 111, GOLD_D); line(g, 18, 42, 18, 99, GOLD_D)
  poly(g, [[436, 38], [423, 44], [423, 105], [436, 114]], INK)
  poly(g, [[434, 42], [424, 47], [424, 105], [434, 112]], '#3a1a2a')
  poly(g, [[434, 74], [424, 76], [424, 105], [434, 112]], '#5a2a2a')
  poly(g, [[434, 100], [424, 98], [424, 105], [434, 112]], '#8a4a3a')
  line(g, 437, 37, 422, 44, GOLD_D); line(g, 437, 37, 437, 115, GOLD_D); line(g, 422, 44, 422, 105, GOLD_D)
}

function paintFloor(g: G) {
  const top = (x: number) => x < 20 ? 98.2 + (20 - x) * 0.9 : x > 420 ? 105.6 + (x - 420) * 0.72 : foyerFloor(x)
  checker(g, 0, W, top, { vpx: 220, hy: 46, tile: 1.7, a: '#e8d8c0', b: '#2a2050', aLo: '#9a8a90', bLo: '#1a1230', tilt: 8 / W, far: 5, grout: '#6a5a78' })
  // The runner from the front door to the front edge.
  for (let y = 102; y < 144; y++) {
    const k = (y - 102) / 42
    const xa = Math.round(206 - k * 16)
    const xb = Math.round(236 + k * 16)
    rect(g, xa - 1, y, xb - xa + 2, 1, INK)
    rect(g, xa, y, xb - xa, 1, '#b01874')
    rect(g, xa + 2, y, 1, 1, GOLD)
    rect(g, xb - 3, y, 1, 1, GOLD)
    for (let x = xa + 4; x < xb - 4; x++) if (((x + y * 2) % 11 === 0) || ((x - y * 2 + 400) % 11 === 0)) dot(g, x, y, '#e0409a')
  }
  // The trapdoor tile (Dag went through it).
  paintTrap(g, false)
  // Soft shadow along the base of the back wall.
  for (let x = 20; x < 420; x++) dither(g, x, Math.round(foyerFloor(x)), 1, 3, INK, 0.45)
}

function paintTrap(g: G, open: boolean) {
  const pts: P2[] = [[171, 120], [190, 120], [192, 128], [169, 128]]
  if (open) {
    poly(g, pts, INK)
    poly(g, [[173, 121], [188, 121], [189, 126], [172, 126]], '#000000')
    // The flap hangs down into the dark.
    poly(g, [[169, 128], [192, 128], [191, 131], [170, 131]], '#5a4a3a')
    return
  }
  line(g, 171, 120, 190, 120, '#1a1020')
  line(g, 190, 120, 192, 128, '#1a1020')
  line(g, 192, 128, 169, 128, '#1a1020')
  line(g, 169, 128, 171, 120, '#1a1020')
  dot(g, 175, 127, GOLD_D); dot(g, 186, 127, GOLD_D)
}

function paintClock(g: G) {
  // Grandfather clock (x 90–118), leaning a touch to the right.
  crooked(g, 88, 14, 32, 87, 3, 0, c => {
    // Hood with a bonnet top.
    poly(c, [[3, 6], [16, 0], [29, 6], [29, 26], [3, 26]], INK)
    poly(c, [[4, 7], [16, 1], [28, 7], [28, 25], [4, 25]], WOOD)
    rect(c, 4, 7, 24, 1, WOOD_HI)
    rect(c, 15, 0, 2, 2, GOLD)
    // The dial.
    oval(c, 16, 16, 9, 8, INK)
    oval(c, 16, 16, 8, 7, '#f4ecd0')
    oval(c, 16, 16, 6, 5, '#fff8e8')
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2
      dot(c, 16 + Math.sin(a) * 7, 16 - Math.cos(a) * 6.2, INK)
    }
    // Waist.
    rect(c, 6, 26, 20, 48, INK)
    rect(c, 7, 26, 18, 47, WOOD)
    rect(c, 7, 26, 1, 47, WOOD_HI)
    rect(c, 24, 26, 1, 47, WOOD_D)
    // The glass door over the pendulum.
    rect(c, 10, 30, 12, 38, INK)
    rect(c, 11, 31, 10, 36, '#2a1f3a')
    rect(c, 11, 31, 1, 36, '#4a3a6a')
    // Base.
    rect(c, 3, 73, 26, 14, INK)
    rect(c, 4, 74, 24, 12, WOOD)
    rect(c, 4, 74, 24, 1, WOOD_HI)
    rect(c, 6, 77, 20, 7, WOOD_D)
    rect(c, 7, 78, 18, 5, WOOD)
    // Feet.
    rect(c, 3, 86, 4, 1, INK); rect(c, 25, 86, 4, 1, INK)
  })
}

/** The clock's hands and pendulum (state: stopped at 11:59 until the strike). */
function clockFace(g: G, s: GameState, v: View) {
  const cx = 104 + 2.3
  const cy = 30
  const struck = !!s.flags[F.struck]
  // Hour hand: just short of 12; minute hand: 11:59 (or 12:00 on the dot).
  line(g, cx, cy, cx - (struck ? 0 : 1), cy - 4, INK)
  line(g, cx, cy, cx - (struck ? 0 : 1), cy - 6, '#9e1638')
  dot(g, cx, cy, GOLD_D)
  // The winding keyhole.
  dot(g, cx + 3, cy + 2, INK)
  dot(g, cx + 3, cy + 3, INK)
  // Pendulum behind the glass (the glass sits at x 98–110, y 44–82, leaning).
  const swing = struck ? Math.sin(v.t * 3.2) * 3 : 0
  const px = 104.5 + 1.5 + swing
  line(g, 105.5, 46, px, 72, GOLD_D)
  oval(g, px, 74, 3, 3, INK)
  oval(g, px, 74, 2, 2, GOLD)
  dot(g, px - 1, 73, '#fff1b0')
}

function paintPortrait(g: G) {
  crooked(g, 126, 20, 40, 46, 0, 4, c => {
    // Gilt frame.
    rect(c, 0, 0, 40, 46, INK)
    rect(c, 1, 1, 38, 44, GOLD_D)
    rect(c, 2, 2, 36, 42, GOLD)
    for (let i = 3; i < 37; i += 3) { dot(c, i, 2, '#fff1b0'); dot(c, i + 1, 43, GOLD_D) }
    rect(c, 4, 4, 32, 38, INK)
    // Background: bottle green with a dither.
    rect(c, 5, 5, 30, 36, '#1f4a3a')
    ramp(c, 5, 5, 30, 36, '#0f2a20', 0.6, 0)
    // Lab coat and a bow tie.
    poly(c, [[8, 41], [11, 30], [20, 27], [29, 30], [32, 41]], '#e8e4f0')
    line(c, 20, 30, 20, 41, '#9a90b0')
    rect(c, 17, 29, 7, 3, '#ff3b5c'); rect(c, 20, 30, 1, 1, '#9e1638')
    // Wild white hair, one dark streak (behind the face).
    const puffs = [[12, 16, 4], [28, 16, 4], [20, 11, 6], [11, 22, 3], [29, 22, 3], [15, 10, 3], [25, 10, 3]] as const
    for (const [x, y, r] of puffs) oval(c, x, y, r + 1, r + 1, '#0a1a14')
    for (const [x, y, r] of puffs) oval(c, x, y, r, r, '#f4f0ff')
    for (const [x, y] of [[7, 13], [33, 13], [13, 6], [27, 6], [8, 24], [32, 24], [20, 4], [9, 18], [31, 18]] as const) dot(c, x, y, '#f4f0ff')
    oval(c, 20, 12, 5, 3, '#cfc6ff')
    line(c, 22, 5, 24, 12, '#1c1030'); line(c, 23, 5, 25, 12, '#1c1030'); line(c, 24, 6, 26, 11, '#3a2a4a')
    // Face.
    oval(c, 20, 21, 6, 7, '#8a4a3a')
    oval(c, 20, 21, 5, 6, '#f5b898')
    rect(c, 15, 22, 1, 3, '#c98576'); rect(c, 25, 22, 1, 3, '#c98576')
    rect(c, 16, 16, 8, 1, '#f4f0ff')
    // Eyes: the left one plain, the right one behind the monocle.
    rect(c, 16, 20, 2, 1, INK)
    rect(c, 16, 18, 2, 1, '#9a90b0')
    oval(c, 23, 20, 2.6, 2.6, GOLD)
    oval(c, 23, 20, 1.6, 1.6, '#cfe8ff')
    dot(c, 23, 20, INK)
    line(c, 25, 22, 28, 30, GOLD_D)
    dot(c, 20, 22, '#c98576')
    // A knowing smile.
    rect(c, 18, 25, 4, 1, '#9e1638')
    dot(c, 22, 24, '#9e1638')
    // Brass plate.
    rect(c, 15, 42, 10, 2, '#fff1b0')
  })
}

function paintArmour(g: G) {
  // Suit of armour (x 164–188), feet on the floor at y ≈ 101.
  const S = '#b8b0d8'
  const SD = '#6a6290'
  const SH = '#f0ecff'
  // Poleaxe behind.
  line(g, 187, 22, 187, 101, WOOD_D)
  line(g, 188, 22, 188, 101, WOOD)
  poly(g, [[188, 20], [195, 24], [195, 30], [188, 32]], SD)
  poly(g, [[189, 21], [194, 24], [194, 29], [189, 31]], S)
  poly(g, [[186, 16], [189, 16], [188, 22]], S)
  // Plinth.
  box(g, 164, 98, 24, 4, WOOD_D, WOOD)
  // Legs.
  box(g, 169, 76, 5, 21, S, SH, SD)
  box(g, 178, 76, 5, 21, S, SH, SD)
  rect(g, 169, 84, 5, 1, SD); rect(g, 178, 84, 5, 1, SD)
  box(g, 167, 95, 8, 3, SD, S)
  box(g, 177, 95, 8, 3, SD, S)
  // Skirt and breastplate (a proud pot belly).
  box(g, 167, 70, 18, 7, S, SH, SD)
  for (let x = 169; x < 185; x += 4) rect(g, x, 71, 1, 5, SD)
  ovalK(g, 176, 60, 10, 11, S)
  oval(g, 174, 56, 5, 6, SH)
  rect(g, 176, 50, 1, 20, SD)
  // Pauldrons and arms.
  ovalK(g, 165, 50, 4, 3, S); ovalK(g, 187, 50, 4, 3, S)
  box(g, 163, 53, 4, 15, S, SH, SD)
  box(g, 185, 53, 4, 12, S, SH, SD)
  ovalK(g, 186, 66, 3, 2, SD)
  // Helmet with a visor and a red plume.
  ovalK(g, 176, 40, 6, 7, S)
  oval(g, 174, 38, 3, 4, SH)
  rect(g, 171, 40, 11, 3, INK)
  for (let x = 172; x < 181; x += 2) dot(g, x, 41, SD)
  rect(g, 175, 32, 2, 1, INK)
  for (let i = 0; i < 9; i++) oval(g, 176 - i * 0.6, 31 - i * 1.1, 2 - i * 0.12, 1.5, i < 3 ? '#ff3b5c' : i < 6 ? '#e02a4a' : '#9e1638')
}

function paintCoatRack(g: G) {
  // Stand.
  rect(g, 38, 24, 3, 76, INK)
  rect(g, 39, 25, 1, 74, WOOD_HI)
  poly(g, [[32, 100], [47, 100], [44, 97], [35, 97]], INK)
  poly(g, [[33, 99], [46, 99], [43, 98], [36, 98]], WOOD)
  // Hooks.
  for (const [x, y] of [[33, 28], [45, 28], [35, 24], [43, 24]] as const) line(g, 39, y + 2, x, y, GOLD_D)
  ovalK(g, 39, 22, 2, 2, GOLD)
  // A long violet coat on the left hook.
  poly(g, [[31, 29], [36, 28], [38, 36], [36, 70], [27, 72], [29, 44]], INK)
  poly(g, [[31, 30], [35, 29], [37, 36], [35, 69], [28, 70], [30, 44]], '#3a2a6a')
  line(g, 31, 32, 29, 68, '#5a4a9a')
  // A bowler hat on the right.
  ovalK(g, 45, 25, 4, 3, '#2a2030')
  rect(g, 40, 27, 11, 1, INK)
  rect(g, 43, 23, 3, 1, '#4a4060')
}

function paintUmbrella(g: G) {
  // Leaning against the rack's foot: a furled black umbrella with a duck-head handle.
  poly(g, [[43, 97], [46, 97], [50, 66], [48, 66]], INK)
  poly(g, [[44, 96], [45, 96], [49, 68], [48, 68]], '#3a3050')
  line(g, 47, 72, 45, 90, '#5a5078')
  // The duck.
  ovalK(g, 50, 63, 2.5, 2, '#ffd23f')
  rect(g, 52, 63, 2, 1, '#ff8a3d')
  dot(g, 50, 62, INK)
}

function paintPhoneTable(g: G) {
  // Little round table with a lamp and a telephone.
  ovalK(g, 70, 80, 12, 3, WOOD)
  oval(g, 70, 79, 10, 1.5, WOOD_HI)
  rect(g, 62, 82, 2, 17, INK); rect(g, 63, 82, 1, 16, WOOD)
  rect(g, 76, 82, 2, 17, INK); rect(g, 77, 82, 1, 16, WOOD)
  rect(g, 69, 83, 2, 16, INK)
  rect(g, 60, 98, 5, 2, INK); rect(g, 75, 98, 5, 2, INK)
  // Lamp.
  rect(g, 77, 64, 1, 13, GOLD_D)
  ovalK(g, 77, 77, 3, 1, GOLD_D)
  polyK(g, [[72, 64], [82, 64], [80, 57], [74, 57]], '#ff8ae0')
  rect(g, 74, 58, 6, 1, '#fff1b0')
  // Rotary phone (red, fat).
  polyK(g, [[60, 78], [72, 78], [70, 72], [62, 72]], '#d0203c')
  oval(g, 66, 75, 3, 2, '#fff4ff')
  oval(g, 66, 75, 1, 1, '#d0203c')
  polyK(g, [[58, 71], [74, 71], [73, 69], [59, 69]], '#9e1638')
  rect(g, 59, 69, 2, 3, '#9e1638'); rect(g, 71, 69, 2, 3, '#9e1638')
  // Cord.
  for (let i = 0; i < 10; i++) dot(g, 72 + i, 79 + (i % 2), '#1c1030')
}

function paintFrontDoorFrame(g: G) {
  // Arched surround (x 194–246, top of arch at y 26).
  const cx = 220
  for (let y = 24; y < 104; y++) {
    const fy = foyerFloor(cx)
    if (y > fy) break
    let hw = 27
    if (y < 40) { const t = (40 - y) / 16; hw = 27 * Math.sqrt(Math.max(0, 1 - t * t)) }
    rect(g, cx - hw - 1, y, hw * 2 + 2, 1, INK)
    rect(g, cx - hw, y, hw * 2, 1, GOLD_D)
    if (hw > 1) rect(g, cx - hw, y, 1, 1, GOLD)
  }
  // Keystone.
  polyK(g, [[216, 22], [224, 22], [222, 30], [218, 30]], GOLD)
}

function frontDoor(g: G, s: GameState, v: View) {
  const open = !!s.flags[F.frontDoorOpen]
  const cx = 220
  const bottom = Math.round(foyerFloor(cx)) + 1
  // The opening: fanlight arch y 28–40, door leaves 40 → floor.
  const inside = (y: number) => { let hw = 23; if (y < 40) { const t = (40 - y) / 12; hw = 23 * Math.sqrt(Math.max(0, 1 - t * t)) } return hw }
  // Fanlight: the storm.
  g.save()
  g.beginPath()
  for (let y = 28; y < 40; y++) { const hw = inside(y); g.rect(Math.round(cx - hw), y, Math.round(hw * 2), 1) }
  g.clip()
  stormPane(g, cx - 23, 28, 46, 12, v, 3)
  g.restore()
  // Fanlight glazing bars.
  for (const a of [-0.9, -0.45, 0, 0.45, 0.9]) line(g, cx, 40, cx + Math.sin(a) * 22, 40 - Math.cos(a) * 11, GOLD_D)
  rect(g, cx - 23, 39, 46, 2, INK)
  if (open) {
    // The night outside: the drive, the gate, Brunhilde's hazards in the rain.
    stormPane(g, cx - 23, 41, 46, bottom - 41, v, 11, '#141838', '#20244a')
    rect(g, cx - 23, bottom - 16, 46, 16, '#1a2a2a')
    dither(g, cx - 23, bottom - 16, 46, 16, '#2a3a3a', 0.4)
    rect(g, cx - 6, bottom - 26, 12, 10, '#2a2f5a')
    if (Math.floor(v.t * 2) % 2 === 0) { dot(g, cx - 5, bottom - 20, '#ff8a3d'); dot(g, cx + 5, bottom - 20, '#ff8a3d') }
    // Leaves swung in against the frame.
    rect(g, cx - 26, 40, 5, bottom - 40, INK); rect(g, cx - 25, 41, 3, bottom - 42, '#b01840')
    rect(g, cx + 21, 40, 5, bottom - 40, INK); rect(g, cx + 22, 41, 3, bottom - 42, '#b01840')
    return
  }
  // Two red leaves with studs, a big brass knocker and a letterbox.
  for (const [x0, x1] of [[cx - 23, cx], [cx, cx + 23]] as const) {
    rect(g, x0, 41, x1 - x0, bottom - 41, INK)
    rect(g, x0 + 1, 41, x1 - x0 - 2, bottom - 42, '#c0203c')
    rect(g, x0 + 1, 41, 1, bottom - 42, '#ff5c7a')
    rect(g, x0 + 3, 45, x1 - x0 - 6, 22, '#9e1638')
    rect(g, x0 + 4, 46, x1 - x0 - 8, 20, '#c0203c')
    rect(g, x0 + 3, 72, x1 - x0 - 6, bottom - 78, '#9e1638')
    rect(g, x0 + 4, 73, x1 - x0 - 8, bottom - 80, '#c0203c')
    for (let y = 44; y < bottom - 2; y += 8) { dot(g, x0 + 2, y, GOLD); dot(g, x1 - 3, y, GOLD) }
  }
  ovalK(g, cx - 5, 58, 3, 3, GOLD)
  oval(g, cx - 5, 58, 1.5, 1.5, '#9e1638')
  rect(g, cx + 5, 68, 8, 2, INK); rect(g, cx + 6, 68, 6, 1, GOLD)
  // The door has a face if you squint: two knots and a scowl.
  dot(g, cx - 12, 52, '#6a0c28'); dot(g, cx + 12, 52, '#6a0c28')
}

function paintConservatoryDoor(g: G) {
  // A green iron glass door (x 350–386), slightly out of true.
  const bottom = Math.round(foyerFloor(368))
  polyK(g, [[349, 34], [387, 36], [387, bottom], [349, bottom]], '#1f5a3a')
  rect(g, 350, 35, 36, 2, '#3fb86a')
}

function conservatoryGlass(g: G, v: View) {
  const bottom = Math.round(foyerFloor(368))
  for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) {
    const x = 353 + col * 16
    const y = 40 + row * 20
    const h = row === 2 ? bottom - 4 - y : 17
    rect(g, x, y, 14, h, '#0f2a28')
    stormPane(g, x, y, 14, Math.min(h, 10), v, 20 + row * 2 + col, '#10283a', '#163a3a')
    // Leaves pressed against the glass.
    if (row > 0) {
      for (let i = 0; i < 4; i++) {
        const lx = x + 2 + ((hash(row * 7 + col * 3 + i) * 10) | 0)
        const ly = y + 4 + ((hash(row * 5 + col + i * 11) * (h - 6)) | 0)
        oval(g, lx, ly, 3, 1.5, i % 2 ? '#3f9a2a' : '#1f6a2a')
      }
    }
  }
  rect(g, 367, 38, 2, bottom - 38, '#1f5a3a')
  // A leaf that has escaped through the gap.
  poly(g, [[386, 60], [393, 57], [396, 61], [388, 63]], '#4f9a2a')
  line(g, 386, 61, 395, 59, '#b6ff4a')
  rect(g, 351, 70, 2, 3, GOLD)
}

function stairs(g: G, s: GameState, v: View) {
  const down = !!s.flags[F.stairsDown]
  const WOODS = ['#7a3a22', '#9a5030']
  if (!down) {
    // Folded into the ceiling like a sulky accordion (x 272–344).
    for (let i = 0; i < 8; i++) {
      const x = 272 + i * 9
      const y = 2 + (i % 2)
      polyK(g, [[x, y], [x + 9, y + 1], [x + 9, y + 9], [x, y + 8]], i % 2 ? WOODS[0]! : WOODS[1]!)
      rect(g, x + 1, y + 1, 7, 1, '#c07040')
      rect(g, x + 2, y + 4, 5, 3, '#b01874')
    }
    // The bottom step dangles on one hinge, out of reach, swinging a little.
    const sw = Math.round(Math.sin(v.t * 1.3) * 1.5)
    line(g, 340, 12, 342 + sw, 20, GOLD_D)
    line(g, 346, 12, 348 + sw, 20, GOLD_D)
    polyK(g, [[338 + sw, 20], [352 + sw, 20], [353 + sw, 24], [337 + sw, 24]], '#9a5030')
    rect(g, 339 + sw, 21, 13, 1, '#b01874')
    // A stub of banister.
    line(g, 276, 12, 344, 12, INK)
    for (let x = 278; x < 344; x += 6) rect(g, x, 11, 1, 3, GOLD_D)
    return
  }
  // Down: a flight from the floor (x 276) up to the ceiling (x 346).
  const n = 14
  for (let i = 0; i < n; i++) {
    const x = 278 + i * 5
    const y = Math.round(foyerFloor(278) - 4 - i * 6.6)
    box(g, x, y, 12, 4, '#9a5030', '#c07040')
    rect(g, x + 2, y + 1, 8, 2, '#b01874')
    rect(g, x, y + 4, 12, 3, '#5b2a1c')
  }
  // Stringer and handrail.
  line(g, 276, 104, 346, 8, INK)
  line(g, 278, 104, 348, 8, '#5b2a1c')
  line(g, 290, 82, 358, -8, GOLD_D)
  for (let i = 0; i < n; i += 2) {
    const x = 284 + i * 5
    const y = Math.round(foyerFloor(278) - 4 - i * 6.6)
    line(g, x, y, x, y - 18, GOLD_D)
  }
  ovalK(g, 290, 81, 2, 2, GOLD)
}

function chandelier(g: G, v: View) {
  const sw = Math.sin(v.t * 0.9) * 1.2
  const cx = 260 + sw
  line(g, 260, 10, cx, 20, '#4a3a2a')
  for (let y = 12; y < 20; y += 2) dot(g, 260 + sw * (y - 10) / 10, y, GOLD_D)
  // Body.
  ovalK(g, cx, 22, 3, 3, GOLD)
  ovalK(g, cx, 28, 14, 2, GOLD_D)
  oval(g, cx, 27.5, 12, 1, GOLD)
  ovalK(g, cx, 31, 3, 2, GOLD)
  // Crystals.
  for (let i = -12; i <= 12; i += 4) { dot(g, cx + i, 31, '#cfe8ff'); dot(g, cx + i, 32, '#8fa6d8') }
  // Candles.
  for (const dx of [-12, -6, 0, 6, 12]) rect(g, cx + dx, 23, 1, 4, '#fff4ff')
}

const painterFoyer: RoomPainter = {
  paint(g) {
    paintWalls(g)
    paintFloor(g)
    paintFrontDoorFrame(g)
    paintConservatoryDoor(g)
    paintClock(g)
    paintPortrait(g)
    paintCoatRack(g)
    paintPhoneTable(g)
    paintArmour(g)
    radiator(g, 394, 84, 20, 18)
    // Sconces either side of the front door.
    for (const x of [190, 250]) {
      rect(g, x - 1, 46, 3, 5, INK); rect(g, x, 46, 1, 4, GOLD)
      polyK(g, [[x - 3, 44], [x + 3, 44], [x + 2, 46], [x - 2, 46]], GOLD_D)
      rect(g, x, 40, 1, 4, '#fff4ff')
    }
  },
  ambient: () => '#9088b8',
  back(g, s, v) {
    frontDoor(g, s, v)
    conservatoryGlass(g, v)
    clockFace(g, s, v)
    stairs(g, s, v)
    if (!inv(s, 'umbrella')) paintUmbrella(g)
    if (s.flags['foyer.trapOpen']) paintTrap(g, true)
    if (s.flags[F.furnaceLit]) steam(g, 394, 82, 20, v.t, 1)
  },
  front(g, _s, v) {
    chandelier(g, v)
  },
  lights(L: LightFn, s, v) {
    const sw = Math.sin(v.t * 0.9) * 1.2
    const fl = 0.85 + Math.sin(v.t * 11) * 0.05 + Math.sin(v.t * 7.3) * 0.05
    L(260 + sw, 30, 110, '#ffcf8a', 0.75 * fl)
    L(77, 64, 34, '#ff9ad8', 0.6)
    L(190, 40, 26, '#ffc070', 0.6 * fl)
    L(250, 40, 26, '#ffc070', 0.6 * fl)
    L(220, 36, 24, '#8fa6ff', 0.25 + v.flash * 0.6)
    L(368, 60, 30, '#6affa0', 0.12 + v.flash * 0.5)
    L(12, 76, 26, '#ff8a3d', 0.35)
    L(428, 76, 26, '#ff8a3d', 0.35)
    if (s.flags[F.furnaceLit]) L(404, 92, 20, '#ff6a3d', 0.35)
    if (s.flags[F.frontDoorOpen]) L(220, 80, 40, '#8fa6ff', 0.3 + v.flash)
  },
  glow(g, s, v) {
    const sw = Math.sin(v.t * 0.9) * 1.2
    for (const [i, dx] of [-12, -6, 0, 6, 12].entries()) flame(g, 260 + sw + dx, 22, v.t, i)
    flame(g, 190, 39, v.t, 7)
    flame(g, 250, 39, v.t, 8)
    rect(g, 74, 63, 6, 1, '#fff1b0')
    if (v.flash > 0.5) {
      // The fanlight burns white for a moment.
      for (let y = 29; y < 40; y++) { const t = (40 - y) / 12; const hw = 22 * Math.sqrt(Math.max(0, 1 - t * t)); if (bayer(0, y) < 0.9) rect(g, 220 - hw, y, hw * 2, 1, 'rgba(220,228,255,0.35)') }
    }
    if (s.flags[F.struck] && Math.floor(v.t * 4) % 2 === 0) dot(g, 106, 30, '#ffd23f')
  },
}

export const painter: RoomPainter = painterFoyer
