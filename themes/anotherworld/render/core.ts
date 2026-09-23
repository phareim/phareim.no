import type { PaletteName, World } from '../types'

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

// ---- primitives ----

export type Pt = [number, number]

export function poly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string): void {
  if (pts.length < 3) return
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fill()
}

export function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return
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
export function glow(ctx: CanvasRenderingContext2D, color: string, blur: number, draw: () => void, cheap = false): void {
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
