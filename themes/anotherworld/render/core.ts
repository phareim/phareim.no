import type { PaletteName, World } from '../types'
import { makeCanvas, type PixelStage } from '../../base/pixel/stage'
import { PAL, drawText, drawBigText, bigTextWidth, textWidth } from '../../base/pixel/sprites'
import { DUSK as NS } from '../../base/pixel/scenery'

// Palettes, primitives and the camera. Another World's discipline: flat
// polygons, no outlines, no gradients, sixteen colours per scene — indices
// 0–7 the base hues, 8–15 the same hues one step toward the light (the lit
// ramp). A face that turns toward the light is base + 8; that is the whole
// lighting model. On top of the matte world sit the Neon Dreams inks, and
// only the living glow: cyan for the pilot and the friend, pink for what
// kills, gold for what rewards. A glowing thing is drawn twice.

export const SKY = 0
export const FAR = 1
export const MID = 2
export const NEAR = 3
export const SEA = 4
export const SLAB = 5
export const SKIN = 6
export const SUIT = 7
export const L = 8

export const CYAN = '#2ff3ff'
export const PINK = '#ff2fa0'
export const GOLD = '#ffd23f'
export const ORANGE = '#ff6a3d'
export const STAR = '#cfe9ff'
export const INK = '#0b0616'

export type Palette = readonly string[]

export interface Scene {
  pal: Palette
  /** three flat sky bands, top to horizon */
  bands: readonly [string, string, string]
  /** the striped sun, if this sky has one: stripe colours top → bottom */
  sun: readonly string[] | null
  /** the sun's height: 1 = centred on the horizon; < 1 sinks it, > 1 raises it */
  sunLift: number
  stars: boolean
  moons: boolean
}

const DUSK: Palette = [
  '#2a1446', '#3b2358', '#241437', '#0b0616', '#1d1b4a', '#160d28', '#e2bfa6', '#1c1830',
  '#7a2f6e', '#5d3a80', '#3b2661', '#241a3e', '#46357f', '#4c3579', '#ffe0c6', '#2e2850',
]
const NIGHT: Palette = [
  '#0b0616', '#1b1438', '#120c28', '#05030d', '#0e0f33', '#0f0a22', '#d6b8a2', '#1a1630',
  '#170a30', '#33286a', '#261c52', '#1a1433', '#23377a', '#2f2a6e', '#f0d2bc', '#2b2750',
]
const HALL: Palette = [
  '#0b0616', '#1f1336', '#150d28', '#06040d', '#231640', '#120b22', '#d6b8a2', '#1a1630',
  '#170a30', '#2e1d4e', '#23173f', '#1b1331', '#3b2868', '#3e2b68', '#f0d2bc', '#2b2750',
]
const STORM: Palette = [
  '#100a1f', '#1d1532', '#150f26', '#050309', '#0d0c24', '#130d22', '#c9ac98', '#18142c',
  '#1e1236', '#2d2350', '#221a40', '#141026', '#1c2452', '#2a2250', '#e6c8b2', '#262248',
]
const DAWN: Palette = [
  '#3b1a4f', '#5a2c62', '#3a1f4c', '#120a1e', '#3a1f55', '#241438', '#f0cbb0', '#221c3a',
  '#ff6a3d', '#a4466e', '#6e3263', '#34203f', '#a8406f', '#8a3a6a', '#ffe6cf', '#3a3160',
]

const SUN_STRIPES = [GOLD, '#ffb52e', ORANGE, '#ff4a6e', PINK] as const

export const SCENES: Record<PaletteName, Scene> = {
  dusk: { pal: DUSK, bands: ['#1c0d33', DUSK[SKY], '#4a1d58'], sun: SUN_STRIPES, sunLift: 0.55, stars: false, moons: false },
  night: { pal: NIGHT, bands: ['#060310', NIGHT[SKY], NIGHT[SKY + L]], sun: null, sunLift: 0, stars: true, moons: true },
  hall: { pal: HALL, bands: ['#060310', HALL[SKY], HALL[SKY + L]], sun: null, sunLift: 0, stars: true, moons: true },
  storm: { pal: STORM, bands: ['#08050f', STORM[SKY], STORM[SKY + L]], sun: null, sunLift: 0, stars: false, moons: false },
  dawn: { pal: DAWN, bands: ['#2a1240', '#7a2a5e', '#d8456a'], sun: SUN_STRIPES, sunLift: 1.25, stars: false, moons: false },
}

/** Light-map ambient per scene: the dim the lamps, shots and eyes light up out of. */
export const AMBIENT: Record<PaletteName, string> = {
  dusk: '#e2d8f2',
  night: '#d2c8ee',
  hall: '#d6ccf0',
  storm: '#c8c0e8',
  dawn: '#f4ecf8',
}

/** Line step for cut text in CSS px: the pixel font needs 9 logical rows. */
export function textStep(fs: number): number {
  return Math.max(fs * 2, (PX?.k ?? 1) * 10)
}

function scale(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k))
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k))
  const b = Math.min(255, Math.round((n & 255) * k))
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}

const dimCache = new Map<Scene, Scene>()
/** Paused: every entry one step darker. */
export function dimScene(sc: Scene): Scene {
  let d = dimCache.get(sc)
  if (!d) {
    d = {
      ...sc,
      pal: sc.pal.map(c => scale(c, 0.55)),
      bands: sc.bands.map(c => scale(c, 0.55)) as unknown as Scene['bands'],
      sun: sc.sun ? sc.sun.map(c => scale(c, 0.55)) : null,
    }
    dimCache.set(sc, d)
  }
  return d
}

const flashCache = new Map<Scene, Scene>()
/** One frame of lightning: every base index shows its lit colour, the sky goes pale. */
export function flashScene(sc: Scene): Scene {
  let f = flashCache.get(sc)
  if (!f) {
    const lit = sc.pal.slice(8)
    const pal = [...lit.map(c => scale(c, 1.5)), ...lit.map(c => scale(c, 1.9))]
    pal[SKY] = '#6d6a9a'
    f = { ...sc, pal, bands: ['#8e8bc0', '#6d6a9a', '#5a5688'], stars: false }
    flashCache.set(sc, f)
  }
  return f
}

// ---- pixel mode (2026-09-24) ----
//
// The scenes are still described in CSS pixels, but while a frame is on the
// pixel stage (themes/base/pixel/stage.ts) every primitive lands on the
// stage's logical grid: polygons are filled scanline by scanline at pixel
// centres (no antialiasing, a sliver never vanishes), rectangles snap to
// whole pixels, and every colour snaps to Neon Shrine's palette. What
// glow() draws also goes into an emissive layer that later, ordinary fills
// erase where they cover it; after the light map the layer is laid back on
// at full brightness, and each glowing shape adds a light pool. So neon
// keeps its brightness, and z-order stays exact.

interface PixelMode {
  stage: PixelStage
  k: number
  vw: number
  vh: number
  g: CanvasRenderingContext2D
  e: CanvasRenderingContext2D
  emitting: number
  eDirty: boolean
  box: number[] | null
}

let PX: PixelMode | null = null
let emitCanvas: HTMLCanvasElement | null = null

/** Start drawing a frame onto the stage (after stage.begin()). */
export function beginPixelFrame(stage: PixelStage): void {
  const vw = stage.vw
  const vh = stage.vh
  if (!emitCanvas || emitCanvas.width !== vw || emitCanvas.height !== vh) emitCanvas = makeCanvas(vw, vh)
  const e = emitCanvas.getContext('2d')!
  e.setTransform(1, 0, 0, 1, 0, 0)
  e.clearRect(0, 0, vw, vh)
  stage.g.setTransform(1, 0, 0, 1, 0, 0)
  PX = { stage, k: stage.k, vw, vh, g: stage.g, e, emitting: 0, eDirty: false, box: null }
}

/** Stop the frame; returns the emissive layer to lay on after the light map. */
export function endPixelFrame(): HTMLCanvasElement | null {
  const had = PX?.eDirty ? emitCanvas : null
  PX = null
  return had
}

export function pixelMode(): { k: number; vw: number; vh: number; stage: PixelStage } | null {
  return PX
}

/** Mark the emissive layer as in use (for things drawn straight into it). */
export function emissiveLayer(): CanvasRenderingContext2D | null {
  if (!PX) return null
  PX.eDirty = true
  return PX.e
}

// Neon Shrine's colours: the sprite palette and the terrain/scenery palette.
const NS_COLORS: number[] = []
{
  const seen = new Set<string>()
  const add = (c: string) => { if (/^#[0-9a-f]{6}$/i.test(c) && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); NS_COLORS.push(parseInt(c.slice(1), 16)) } }
  for (const c of Object.values(PAL)) add(c)
  for (const c of Object.values(NS)) add(c)
  // A few more from the shrine's floors, walls and night water.
  for (const c of ['#05030d', '#120a24', '#1a0f30', '#201a40', '#2b2553', '#332c61', '#1a1535', '#3b2868', '#4b2c44', '#5a3752', '#12483f', '#0f3445', '#1a1f4c', '#27366e', '#8e5566', '#e2bfa6', '#ece4f4', '#c9d8ff', '#9fb2e8', '#f4f0ff', '#6d6a9a']) add(c)
}

function nearest(rgb: number, not = -1): number {
  const r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255
  let best = NS_COLORS[0]!
  let bd = Infinity
  for (const c of NS_COLORS) {
    if (c === not) continue
    const cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255
    const rm = (r + cr) / 2
    const dr = r - cr, dg = g - cg, db = b - cb
    const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db
    if (d < bd) { bd = d; best = c }
  }
  return best
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0')
const snapCache = new Map<string, string>()

/** A colour on Neon Shrine's palette (rgba() keeps its alpha). */
export function snapColor(color: string): string {
  let out = snapCache.get(color)
  if (out) return out
  if (color[0] === '#' && color.length === 7) {
    out = hex(nearest(parseInt(color.slice(1), 16)))
  } else {
    const m = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?/)
    if (m) {
      const n = nearest((+m[1]! << 16) | (+m[2]! << 8) | +m[3]!)
      out = m[4] !== undefined ? `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${m[4]})` : hex(n)
    } else {
      out = color
    }
  }
  snapCache.set(color, out)
  return out
}

/**
 * A scene palette on Neon Shrine's colours, keeping each lit entry apart
 * from its base (Another World's whole lighting model is base vs base + 8).
 */
function snapPalette(pal: readonly string[]): string[] {
  const out = pal.map(c => snapColor(c))
  for (let i = 0; i < 8; i++) {
    if (out[i] === out[i + 8]) out[i + 8] = hex(nearest(parseInt(pal[i + 8]!.slice(1), 16), parseInt(out[i]!.slice(1), 16)))
  }
  return out
}

// The scenes wear Neon Shrine's colours (2026-09-24): each palette snapped
// to it once, lit entries kept apart from their bases.
for (const sc of Object.values(SCENES)) (sc as { pal: Palette }).pal = snapPalette(sc.pal)

/** The colour a fill actually uses on the stage. */
function fillOf(color: string): string {
  return snapColor(color)
}

function span(m: PixelMode, x: number, y: number, w: number, h: number): void {
  if (x < 0) { w += x; x = 0 }
  if (y < 0) { h += y; y = 0 }
  if (x + w > m.vw) w = m.vw - x
  if (y + h > m.vh) h = m.vh - y
  if (w <= 0 || h <= 0) return
  m.g.fillRect(x, y, w, h)
  if (m.emitting > 0) m.e.fillRect(x, y, w, h)
  else if (m.eDirty) m.e.clearRect(x, y, w, h)
  const b = m.box
  if (b) {
    if (x < b[0]!) b[0] = x
    if (y < b[1]!) b[1] = y
    if (x + w > b[2]!) b[2] = x + w
    if (y + h > b[3]!) b[3] = y + h
  }
}

const XS: number[] = []
const YS: number[] = []
const HITS: number[] = []

function pixelPoly(m: PixelMode, pts: Pt[], color: string): void {
  const k = m.k
  const n = pts.length
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = 0; i < n; i++) {
    const x = pts[i]![0] / k
    const y = pts[i]![1] / k
    XS[i] = x
    YS[i] = y
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  if (maxX < 0 || maxY < 0 || minX > m.vw || minY > m.vh || !(maxX >= minX)) return
  const c = fillOf(color)
  m.g.fillStyle = c
  if (m.emitting > 0) m.e.fillStyle = c
  const y0 = Math.max(0, Math.ceil(minY - 0.5))
  const y1 = Math.min(m.vh - 1, Math.floor(maxY - 0.5))
  if (y0 > y1) {
    // Thinner than a row: one row through its middle.
    const y = Math.floor((minY + maxY) / 2)
    const xa = Math.round(minX)
    span(m, xa, y, Math.max(1, Math.round(maxX) - xa), 1)
    return
  }
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5
    HITS.length = 0
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const yi = YS[i]!
      const yj = YS[j]!
      if ((yi <= yc) !== (yj <= yc)) HITS.push(XS[i]! + ((yc - yi) * (XS[j]! - XS[i]!)) / (yj - yi))
    }
    if (HITS.length > 2) HITS.sort((a, b) => a - b)
    else if (HITS.length === 2 && HITS[0]! > HITS[1]!) { const t = HITS[0]!; HITS[0] = HITS[1]!; HITS[1] = t }
    for (let h = 0; h + 1 < HITS.length; h += 2) {
      let xa = Math.round(HITS[h]!)
      let xb = Math.round(HITS[h + 1]!)
      // A sliver narrower than a pixel keeps one pixel, so thin limbs and stalks never break up.
      if (xb <= xa) { xa = Math.floor((HITS[h]! + HITS[h + 1]!) / 2); xb = xa + 1 }
      span(m, xa, y, xb - xa, 1)
    }
  }
}

function pixelRect(m: PixelMode, x: number, y: number, w: number, h: number, color: string): void {
  const k = m.k
  const x0 = Math.round(x / k)
  const y0 = Math.round(y / k)
  let x1 = Math.round((x + w) / k)
  let y1 = Math.round((y + h) / k)
  if (x1 <= x0) x1 = x0 + 1
  if (y1 <= y0) y1 = y0 + 1
  const c = fillOf(color)
  m.g.fillStyle = c
  if (m.emitting > 0) m.e.fillStyle = c
  span(m, x0, y0, x1 - x0, y1 - y0)
}

/** Clip to rectangles (CSS px); on the stage the emissive layer is clipped too. */
export function clipRects(ctx: CanvasRenderingContext2D, rects: Array<[number, number, number, number]>, evenodd = false): void {
  const m = PX
  const targets = m ? [m.g, m.e] : [ctx]
  const k = m ? m.k : 1
  for (const t of targets) {
    t.save()
    t.beginPath()
    for (const [x, y, w, h] of rects) {
      if (m) {
        const x0 = Math.round(x / k)
        const y0 = Math.round(y / k)
        t.rect(x0, y0, Math.round((x + w) / k) - x0, Math.round((y + h) / k) - y0)
      } else {
        t.rect(x, y, w, h)
      }
    }
    if (evenodd) t.clip('evenodd')
    else t.clip()
  }
}

export function unclip(ctx: CanvasRenderingContext2D): void {
  if (PX) {
    PX.g.restore()
    PX.e.restore()
  } else {
    ctx.restore()
  }
}

/**
 * Text in Neon Shrine's 5×7 font on the stage's HUD layer. `size` is the
 * old CSS font size: it picks the block size (at least one logical pixel
 * per font pixel). `y` is the baseline, as with fillText.
 */
export function pixelText(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left'): void {
  const m = PX
  if (!m) return
  const h = m.stage.hud
  let n = Math.max(1, Math.round(size / m.k / 8))
  let w = n === 1 ? textWidth(s) : bigTextWidth(s, n)
  // A title never runs off a narrow screen: step the blocks down.
  while (n > 1 && w > m.vw * 0.92) { n--; w = n === 1 ? textWidth(s) : bigTextWidth(s, n) }
  let lx = Math.round(x / m.k)
  if (align === 'center') lx -= Math.round(w / 2)
  else if (align === 'right' || align === 'end') lx -= w
  const ly = Math.round(y / m.k) - 7 * n
  const c = snapColor(color)
  if (n === 1) drawText(h, s, lx, ly, c, '#0b0616')
  else drawBigText(h, s, lx, ly, n, c, '#0b0616')
}

// ---- primitives ----

export type Pt = [number, number]

export function poly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string): void {
  if (pts.length < 3) return
  if (PX) { pixelPoly(PX, pts, color); return }
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fill()
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return
  if (PX) { pixelRect(PX, x, y, w, h, color); return }
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** A thick segment as a flat quad (limbs, bars, ropes). */
export function bar(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w: number, color: string): void {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * w * 0.5
  const ny = (dx / len) * w * 0.5
  poly(ctx, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], color)
}

export function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, n = 20): void {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r])
  }
  poly(ctx, pts, color)
}

/**
 * The neon rule: a glowing shape is drawn twice — a soft wide pass, then
 * the hard core. `draw` is called with the colour to fill in.
 */
export function glow(ctx: CanvasRenderingContext2D, color: string, blur: number, draw: () => void, cheap = false, lightA = 0.75): void {
  const m = PX
  if (m) {
    // On the stage: into the emissive layer too, and a light pool round it.
    const box = [Infinity, Infinity, -Infinity, -Infinity]
    const outer = m.box
    m.box = box
    m.emitting++
    m.eDirty = true
    draw()
    m.emitting--
    m.box = outer
    if (outer && box[2]! > box[0]!) {
      outer[0] = Math.min(outer[0]!, box[0]!); outer[1] = Math.min(outer[1]!, box[1]!)
      outer[2] = Math.max(outer[2]!, box[2]!); outer[3] = Math.max(outer[3]!, box[3]!)
    }
    if (box[2]! > box[0]!) {
      const r = Math.max(box[2]! - box[0]!, box[3]! - box[1]!) / 2 + Math.max(3, (blur / m.k) * 1.3)
      if (lightA > 0) m.stage.light((box[0]! + box[2]!) / 2, (box[1]! + box[3]!) / 2, r, snapColor(color).slice(0, 7), lightA)
    }
    return
  }
  ctx.save()
  if (!cheap) {
    ctx.shadowColor = color
    ctx.shadowBlur = blur
  } else {
    ctx.globalAlpha = 0.35
  }
  draw()
  ctx.restore()
  draw()
}

// Deterministic 0..1 hash of an integer: parallax scenery never pops or shimmers.
export function hash(n: number): number {
  let x = (n | 0) * 2654435761
  x ^= x >>> 15
  x = (x * 2246822519) | 0
  x ^= x >>> 13
  return (x >>> 0) / 4294967296
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

// ---- camera ----

export interface View {
  width: number
  height: number
  s: number
  camX: number
  camY: number
  /** the world x at the middle of the screen */
  camCenter: number
  horizonY: number
  portrait: boolean
  cheap: boolean
  X: (wx: number) => number
  Y: (wy: number) => number
}

/** The camera remembers where it was so it can ease vertically; one per canvas. */
export interface Camera {
  world: World | null
  x: number
  y: number
}

export function createCamera(): Camera {
  return { world: null, x: 0, y: 0 }
}

/** Screen fraction the ground line sits at when the figure stands on it. */
function groundFrac(portrait: boolean): number {
  return portrait ? 0.8 : 0.84
}

export function viewScale(width: number, height: number): number {
  // Portrait phones see 620 world px across: the figure stays readable and
  // a guard in range is still on screen.
  return clamp(Math.min(height / 560, width / (height > width ? 620 : 700)), 0.45, 1.6)
}

export interface Focus {
  x: number
  y: number
  vx?: number
  /** a fixed shot: put focus.y at this fraction of the height, no easing */
  frac?: number
  /** put the sea horizon on this world y (a cliff edge the sun rises behind) */
  horizon?: number
}

export function makeView(cam: Camera, world: World, width: number, height: number, focus?: Focus): View {
  const portrait = height > width
  const s = viewScale(width, height)
  const visW = width / s
  const visH = height / s
  const p = focus ?? world.player
  const vx = focus ? focus.vx ?? 0 : world.player.vx

  // Horizontal: off-centre toward where the figure is going, or facing when
  // it stands, so a guard ahead is on screen before it can shoot.
  const lead = focus ? clamp(vx / 250, -1, 1) : Math.abs(vx) > 40 ? clamp(vx / 250, -1, 1) : world.player.facing * 0.8
  const anchor = 0.5 - lead * 0.16
  let tx = p.x - visW * anchor
  if (world.width > visW) tx = clamp(tx, -40, world.width - visW + 40)
  else tx = (world.width - visW) / 2

  // Vertical: the ground line at its fraction, unless the figure climbs or
  // dives; then the frame follows with a dead zone so a jump does not bob.
  const gf = groundFrac(portrait)
  const base = world.groundY - (gf * visH)
  let ty = cam.world === world ? cam.y : base
  const onGround = Math.abs(p.y - world.groundY) < 4 && !world.player.swimming
  if (onGround) {
    ty = base
  } else {
    const fy = (p.y - ty) / visH
    if (fy < 0.5) ty = p.y - 0.5 * visH
    if (fy > gf + 0.04) ty = p.y - (gf + 0.04) * visH
  }
  ty = Math.max(ty, world.camTop)
  if (focus?.frac !== undefined) ty = focus.y - focus.frac * visH

  if (cam.world !== world || focus?.frac !== undefined) {
    cam.world = world
    cam.x = tx
    cam.y = ty
  } else {
    // Turning round swings the frame over; it never snaps.
    cam.x += (tx - cam.x) * (focus ? 1 : 0.12)
    cam.y += (ty - cam.y) * 0.14
  }
  const camX = cam.x
  const camY = cam.y
  // The horizon: world-anchored with a small vertical parallax, and never
  // pushed off the frame, so a climb still has the sea under it.
  const horizonY = focus?.horizon !== undefined
    ? (focus.horizon - camY) * s
    : clamp(height * 0.62 + (base - camY) * s * 0.18, height * 0.34, height * 0.78)
  return {
    width, height, s, camX, camY, camCenter: camX + visW / 2, horizonY, portrait,
    cheap: width < 600,
    X: wx => (wx - camX) * s,
    Y: wy => (wy - camY) * s,
  }
}
