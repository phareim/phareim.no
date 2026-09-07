import type { Platform, RockfallHazard, TideHazard, World } from './types'
import { ARCHES, OVERHANG, TOWER, tideLevel } from './engine'

// Another Shore — flat-polygon night coast, drawn through a 16-entry palette.
//
// Indices 0–7 are the base hues, 8–15 the same hues one step toward the
// moon (the lit ramp). Everything that faces the moon — right sides of
// slabs, top bands, crests — uses base + 8. That is the whole lighting
// model. Four palettes share the vertex data: dusk, night, storm, dawn;
// the world's lit beacons pick one and the swap is a hard cut.
//
// World units, y down. Player x/y is feet centre (body 22x52), ground y420.
// The camera fixes the ground line at 84 % of the height (80 % portrait),
// the horizon 22 % above it. Coordinates are CSS pixels; the caller applies
// the DPR transform. All scenery is a pure function of integer hashes.

export type PaletteName = 'dusk' | 'night' | 'storm' | 'dawn'
export interface DrawOptions {
  reducedMotion?: boolean
  paused?: boolean
}

// Base indices.
const SKY = 0
const FAR = 1
const MID = 2
const NEAR = 3
const SEA = 4
const SLAB = 5
const SKIN = 6
const SHIRT = 7
const L = 8 // + base = lit

type Palette = readonly string[]

const NIGHT: Palette = [
  '#254b59', '#356372', '#203d49', '#091720', '#173540', '#101f2a', '#ead7b4', '#d88b73',
  '#a9b8ac', '#4b8194', '#2f5768', '#1a3340', '#7ea6a8', '#3f6472', '#e7bb80', '#f2b39a',
]
const DUSK: Palette = [
  '#4f4d5c', '#3b3a49', '#2b2b38', '#13131b', '#2e3342', '#1b1d27', '#d9c3a3', '#b47a6c',
  '#726f80', '#4c4b5b', '#3a3b4a', '#23232e', '#4d5466', '#3b3e4d', '#d7b07a', '#c48b7c',
]
const STORM: Palette = [
  '#17313b', '#23434f', '#152a33', '#050e14', '#0f232b', '#0a151c', '#c9b899', '#b8735f',
  '#7f8d84', '#35606f', '#204049', '#11242d', '#587c80', '#2c4a55', '#e7bb80', '#d4957f',
]
// Dawn: the sky takes the skin tone, so the figure's face becomes the sky's.
const DAWN: Palette = [
  '#c8b596', '#6f7f86', '#4a5a62', '#1a2228', '#7f9599', '#2c3a42', '#c8b596', '#d88b73',
  '#ecdcc0', '#8c9aa0', '#63747c', '#2e3a42', '#b5c3c2', '#566a73', '#f0c07f', '#f0ab90',
]
// One frame of lightning: every base index shows its lit colour.
const LIGHTNING: Palette = [
  STORM[9], STORM[9], STORM[10], STORM[11], STORM[12], STORM[13], STORM[14], STORM[15],
  NIGHT[8], NIGHT[9], NIGHT[10], NIGHT[11], NIGHT[12], NIGHT[13], NIGHT[14], NIGHT[15],
].map((c, i) => (i === 0 ? NIGHT[8] : c))

const PALETTES: Record<PaletteName, Palette> = { dusk: DUSK, night: NIGHT, storm: STORM, dawn: DAWN }

function darken(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * k)
  const g = Math.round(((n >> 8) & 255) * k)
  const b = Math.round((n & 255) * k)
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
}
// Paused: every index one step darker. Computed once.
const DIMMED: Record<PaletteName, Palette> = {
  dusk: DUSK.map((c) => darken(c, 0.62)),
  night: NIGHT.map((c) => darken(c, 0.62)),
  storm: STORM.map((c) => darken(c, 0.62)),
  dawn: DAWN.map((c) => darken(c, 0.62)),
}

const GROUND_Y = 420
const LIGHTNING_PERIOD = 6.5
const LIGHTNING_FRAME = 0.035

/** dusk → night → storm → dawn, one turn per beacon. */
export function paletteNameFor(world: World): PaletteName {
  let lit = 0
  for (const b of world.beacons) if (b.lit) lit++
  return lit >= 3 ? 'dawn' : lit === 2 ? 'storm' : lit === 1 ? 'night' : 'dusk'
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

// Deterministic 0..1 hash of an integer. Pure function of the index, so
// parallax scenery slides continuously and never pops or shimmers.
function hash(n: number): number {
  let x = (n | 0) * 2654435761
  x ^= x >>> 15
  x = (x * 2246822519) | 0
  x ^= x >>> 13
  return (x >>> 0) / 4294967296
}

type Pt = [number, number]

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], color: string): void {
  if (pts.length < 3) return
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(pts[0][0], pts[0][1])
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  ctx.closePath()
  ctx.fill()
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  if (w <= 0 || h <= 0) return
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

// A thick line segment as a flat quad (limbs).
function bar(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, w: number, color: string): void {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const nx = (-dy / len) * w * 0.5
  const ny = (dx / len) * w * 0.5
  poly(ctx, [[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]], color)
}

interface View {
  width: number
  height: number
  s: number
  camX: number
  camY: number
  camCenter: number
  groundY: number // screen y of the ground line
  horizonY: number // screen y of the sea horizon
  bandY: number // screen y where the black foreground band starts
  capY: number // monolith tops never rise above this screen y
  moon: { x: number; y: number; r: number }
  X: (wx: number) => number
  Y: (wy: number) => number
}

function makeView(world: World, width: number, height: number): View {
  const p = world.player
  const portrait = height > width
  const s = clamp(height / 560, 0.55, 1.6)
  const visW = width / s
  const vx = p.vx || 0
  // Off-centre toward the direction of travel; changes continuously.
  const anchor = 0.5 - clamp(vx / 250, -1, 1) * 0.16
  let camX = p.x - visW * anchor
  if (world.width > visW) camX = clamp(camX, -80, world.width - visW + 80)
  else camX = (world.width - visW) / 2

  const groundY = Math.round(height * (portrait ? 0.8 : 0.84))
  const camY = GROUND_Y - groundY / s
  const horizonY = Math.round(groundY - height * (portrait ? 0.2 : 0.22))
  const bandY = Math.round(groundY + height * (portrait ? 0.06 : 0.07))
  const capY = Math.round(height * (portrait ? 0.34 : 0.3))
  const moon = portrait
    ? { x: width - 24 - 32, y: 40 + 32, r: 32 }
    : { x: width * 0.74, y: height * 0.17, r: clamp(Math.min(width, height) * 0.11, 34, 100) }
  return {
    width, height, s, camX, camY,
    camCenter: camX + visW / 2,
    groundY, horizonY, bandY, capY, moon,
    X: (wx) => (wx - camX) * s,
    Y: (wy) => (wy - camY) * s,
  }
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  width: number,
  height: number,
  opts: DrawOptions = {},
): void {
  if (width <= 0 || height <= 0) return
  const name = paletteNameFor(world)
  let pal: Palette = opts.paused ? DIMMED[name] : PALETTES[name]
  const lightning =
    !opts.paused && !opts.reducedMotion && name === 'storm' && world.time % LIGHTNING_PERIOD < LIGHTNING_FRAME
  if (lightning) pal = LIGHTNING
  const v = makeView(world, width, height)

  ctx.save()
  ctx.lineJoin = 'miter'
  ctx.lineCap = 'butt'

  // Sky, stars (night only), moon.
  rect(ctx, 0, 0, width, height, pal[SKY])
  if (name === 'night' && !lightning) {
    ctx.fillStyle = pal[SKY + L]
    for (let i = 0; i < 16; i++) {
      const sx = hash(i * 2 + 1) * width
      const sy = hash(i * 2 + 2) * height * 0.34
      ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2)
    }
  }
  drawMoon(ctx, v, pal)

  // Far monoliths and the mid headland stand on the horizon; the sea,
  // drawn after them, hides their feet.
  drawMonoliths(ctx, v, pal)
  drawHeadland(ctx, v, pal)
  drawSea(ctx, v, pal, world.time)

  // World-anchored masses behind the figure: tower, overhang.
  drawTower(ctx, v, pal)
  drawOverhang(ctx, v, pal)

  // Water line in the gaps, then the slabs cover it.
  rect(ctx, 0, v.groundY + 12 * v.s, width, Math.max(1.5, 1.5 * v.s), pal[SEA + L])
  for (let i = 0; i < world.platforms.length; i++) drawSlab(ctx, v, pal, world.platforms[i], i)

  for (const hz of world.hazards) if (hz.kind === 'rockfall') drawRock(ctx, v, pal, hz)
  for (let i = 0; i < world.beacons.length; i++) {
    const b = world.beacons[i]
    drawLamp(ctx, v, pal, b.x, b.y, b.lit, i === world.beacons.length - 1)
  }

  drawFigure(ctx, v, pal, world)

  // Water in front of the figure: the tide.
  for (const hz of world.hazards) if (hz.kind === 'tide') drawTide(ctx, v, pal, hz, world)

  // True foreground: arches and the black band with its rocks and plants.
  drawArches(ctx, v, pal)
  drawForeground(ctx, v, pal)

  ctx.restore()
}

// ---- sky ----

function drawMoon(ctx: CanvasRenderingContext2D, v: View, pal: Palette): void {
  const { x, y, r } = v.moon
  const pts: Pt[] = []
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r])
  }
  poly(ctx, pts, pal[SKY + L])
}

// ---- far: monoliths (parallax 0.2) ----

function drawMonoliths(ctx: CanvasRenderingContext2D, v: View, pal: Palette): void {
  const k = 0.2
  const s = v.s
  const spacing = 240
  const half = v.width / (2 * s)
  const u0 = v.camCenter * k - half
  const u1 = v.camCenter * k + half
  const base = v.horizonY + 4
  for (let i = Math.floor(u0 / spacing) - 1; i <= Math.floor(u1 / spacing) + 1; i++) {
    const r1 = hash(i * 4 + 1)
    const r2 = hash(i * 4 + 2)
    const r3 = hash(i * 4 + 3)
    const r4 = hash(i * 4 + 4)
    if (r1 < 0.22) continue
    const cu = (i + 0.5 + (r2 - 0.5) * 0.5) * spacing
    const sx = v.width / 2 + (cu - v.camCenter * k) * s
    const w = (44 + r3 * 70) * s
    const h = Math.min((90 + r4 * 95) * s, base - v.capY)
    if (h < 12) continue
    const lean = (r2 - 0.5) * 26 * s
    const top = base - h
    const broken = r3 > 0.5
    const xl = sx - w / 2
    const xr = sx + w / 2
    const tl: Pt = [xl + lean, top + (broken ? 10 : 6) * s]
    const tr: Pt = [xr + lean - 3 * s, top + (broken ? h * 0.06 : 0)]
    const pts: Pt[] = [[xl, base], tl]
    if (broken) {
      pts.push([xl + lean + w * 0.3, top], [sx + lean + w * 0.05, top + h * 0.17])
    } else {
      pts.push([xl + lean + w * 0.25, top + 2 * s])
    }
    pts.push(tr, [xr, base])
    poly(ctx, pts, pal[FAR])
    // Lit face: the right side, toward the moon.
    const strip = Math.min(10 * s, w * 0.2)
    poly(ctx, [[tr[0] + 0.7, tr[1]], [tr[0] - strip, tr[1]], [xr - strip, base], [xr + 0.7, base]], pal[FAR + L])
    // A stump beside some of them.
    if (r4 > 0.55) {
      const sw = w * 0.5
      const sh = h * 0.28
      const ox = xr + 6 * s
      poly(ctx, [[ox, base], [ox + 3 * s, base - sh], [ox + sw - 5 * s, base - sh + 4 * s], [ox + sw, base]], pal[FAR])
      poly(ctx, [[ox + sw - 5 * s, base - sh + 4 * s], [ox + sw - 5 * s - 4 * s, base - sh + 4 * s], [ox + sw - 4 * s, base], [ox + sw, base]], pal[FAR + L])
    }
  }
}

// ---- mid: one continuous headland on the horizon (parallax 0.5) ----

function drawHeadland(ctx: CanvasRenderingContext2D, v: View, pal: Palette): void {
  const k = 0.5
  const s = v.s
  const seg = 100
  const half = v.width / (2 * s)
  const u0 = v.camCenter * k - half
  const u1 = v.camCenter * k + half
  const base = v.horizonY + 4
  const cap = Math.round(v.height * 0.38)
  const i0 = Math.floor(u0 / seg) - 1
  const i1 = Math.floor(u1 / seg) + 2
  const sxOf = (u: number) => v.width / 2 + (u - v.camCenter * k) * s
  // Per segment: nothing, a low shelf, or a stack. Heights in world units.
  const hOf = (i: number) => {
    const r = hash(i * 3 + 101)
    if (r < 0.38) return 0
    if (r < 0.72) return 10 + hash(i * 3 + 102) * 30
    return 55 + hash(i * 3 + 102) * 50
  }
  const pts: Pt[] = [[sxOf(i0 * seg), base]]
  let prev = 0
  for (let i = i0; i <= i1; i++) {
    const h = Math.min(hOf(i) * s, base - cap)
    const u = i * seg
    const r = hash(i * 3 + 103)
    const plateau = 22 + r * 40
    // A notch between two masses, then a steep rise to the plateau.
    if (prev > 0 && h > 0) pts.push([sxOf(u - 14), base - Math.min(prev, h) * 0.3])
    pts.push([sxOf(u), base - h])
    if (h > 0 && r > 0.5) pts.push([sxOf(u + plateau * 0.5), base - h - 6 * s])
    pts.push([sxOf(u + plateau), base - h])
    if (h > 0 && hash(i * 3 + 104) > 0.6) pts.push([sxOf(u + plateau + 8), base - h * 0.55])
    prev = h
  }
  pts.push([sxOf((i1 + 1) * seg), base])
  poly(ctx, pts, pal[MID])
  // Lit faces: every slope that descends to the right faces the moon.
  const t = 5 * s
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (b[1] > a[1] + 1 && b[0] > a[0]) {
      poly(ctx, [a, b, [b[0] - t, b[1]], [a[0] - t, a[1]]], pal[MID + L])
    }
  }
}

// ---- the sea: one field, a horizon, two bands under the moon ----

function drawSea(ctx: CanvasRenderingContext2D, v: View, pal: Palette, time: number): void {
  rect(ctx, 0, v.horizonY, v.width, v.height - v.horizonY, pal[SEA])
  const m = v.moon
  const h1 = Math.max(2, 2 * v.s * 0.6)
  const shift = (Math.floor(time) % 3) - 1
  rect(ctx, m.x - m.r * 0.8, v.horizonY + v.height * 0.03, m.r * 1.6, h1, pal[SEA + L])
  rect(ctx, m.x - m.r * 0.55 + shift, v.horizonY + v.height * 0.075, m.r * 1.1, h1, pal[SEA + L])
}

// ---- world-anchored masses ----

function drawTower(ctx: CanvasRenderingContext2D, v: View, pal: Palette): void {
  const { X, Y, s } = v
  const x0 = X(TOWER.x0)
  const x1 = X(TOWER.x1)
  if (x1 < 0 || x0 > v.width) return
  const bottom = v.height
  const top = -10
  const taper = 22 * s
  poly(ctx, [[x0, bottom], [x0 + taper, top], [x1 - taper * 0.6, top], [x1, bottom]], pal[MID])
  const strip = 14 * s
  poly(ctx, [[x1 - taper * 0.6 + 0.7, top], [x1 - taper * 0.6 - strip, top], [x1 - strip, bottom], [x1 + 0.7, bottom]], pal[MID + L])
  // A single dark doorway at the foot, behind the lamp platform.
  const dy = Y(276)
  rect(ctx, x0 + 60 * s, dy - 70 * s, 26 * s, 70 * s, pal[NEAR])
}

function drawOverhang(ctx: CanvasRenderingContext2D, v: View, pal: Palette): void {
  const { X, Y, s } = v
  const x0 = X(OVERHANG.x0)
  const x1 = X(OVERHANG.x1)
  if (x1 < 0 || x0 > v.width) return
  const yb = Y(OVERHANG.y)
  const xc = X(3700)
  poly(ctx, [
    [x0, -10], [x1, -10],
    [x1 - 10 * s, yb - 70 * s],
    [x1 - 40 * s, yb - 40 * s],
    [xc + 60 * s, yb - 24 * s],
    [xc + 52 * s, yb],
    [xc, yb],
    [xc - 30 * s, yb - 30 * s],
    [x0 + 30 * s, yb - 60 * s],
    [x0, yb - 110 * s],
  ], pal[NEAR])
  // The lit crack, above where the rock hangs.
  const cx = xc + 26 * s
  const cy = yb - 8 * s
  const t = Math.max(1.5, 2 * s)
  const zig: Pt[] = [[cx - 14 * s, cy - 40 * s], [cx - 4 * s, cy - 28 * s], [cx - 10 * s, cy - 16 * s], [cx + 2 * s, cy - 4 * s]]
  for (let i = 0; i < zig.length - 1; i++) bar(ctx, zig[i], zig[i + 1], t, pal[NEAR + L])
}

// ---- slabs ----

function drawSlab(ctx: CanvasRenderingContext2D, v: View, pal: Palette, pl: Platform, index: number): void {
  const { X, Y, s } = v
  if (pl.w <= 0 || pl.h <= 0) return
  const x0 = X(pl.x)
  const x1 = X(pl.x + pl.w)
  if (x1 < -20 || x0 > v.width + 20) return
  const yT = Y(pl.y)
  const ground = pl.h >= 100
  const yB = ground ? v.height + 10 : Y(pl.y + pl.h)
  const r = hash(index * 13 + 3)
  // Body: broken diagonal at the right end, an undercut at the left.
  const pts: Pt[] = [[x0, yT], [x1, yT]]
  if (ground) {
    pts.push([x1 + (4 + r * 6) * s, yT + 26 * s], [x1 - (6 + r * 6) * s, yT + 70 * s], [x1 - 6 * s, yB])
    pts.push([x0, yB], [x0 - 4 * s, yT + 44 * s], [x0 + 3 * s, yT + 18 * s])
  } else {
    pts.push([x1 + 3 * s, yT + pl.h * 0.5 * s], [x1 - 4 * s, yB], [x0 + 2 * s, yB], [x0 - 2 * s, yT + pl.h * 0.4 * s])
  }
  poly(ctx, pts, pal[SLAB])
  // Top band: the lit face, exactly on the collision line.
  rect(ctx, x0, yT, x1 - x0, Math.max(2, 3.5 * s), pal[SLAB + L])
  // The right end catches the moon too.
  if (ground) poly(ctx, [[x1, yT], [x1 + (4 + r * 6) * s, yT + 26 * s], [x1 + (4 + r * 6) * s - 5 * s, yT + 26 * s], [x1 - 4 * s, yT + 3 * s]], pal[SLAB + L])
  else poly(ctx, [[x1, yT], [x1 + 3 * s, yT + pl.h * 0.5 * s], [x1 - 1 * s, yT + pl.h * 0.5 * s], [x1 - 4 * s, yT + 3 * s]], pal[SLAB + L])
}

// ---- hazards ----

function drawRock(ctx: CanvasRenderingContext2D, v: View, pal: Palette, hz: RockfallHazard): void {
  const { X, Y, s } = v
  const x0 = X(hz.x)
  const x1 = X(hz.x + hz.w)
  if (x1 < 0 || x0 > v.width) return
  const yT = Y(hz.top)
  const yB = Y(hz.top + hz.h)
  if (hz.state === 'landed') {
    poly(ctx, [[x0, yB], [x0 + 8 * s, yT], [x1 - 9 * s, yT + 2 * s], [x1, yB]], pal[NEAR])
    poly(ctx, [[x1 - 9 * s, yT + 2 * s], [x1 - 15 * s, yT + 2 * s], [x1 - 6 * s, yB], [x1, yB]], pal[NEAR + L])
  } else {
    // Hanging or falling: a wedge, point down.
    poly(ctx, [[x0, yT], [x1, yT], [x1 - 14 * s, yB], [x0 + 10 * s, yB]], pal[NEAR])
    poly(ctx, [[x1, yT], [x1 - 7 * s, yT], [x1 - 19 * s, yB], [x1 - 14 * s, yB]], pal[NEAR + L])
  }
}

function drawTide(ctx: CanvasRenderingContext2D, v: View, pal: Palette, hz: TideHazard, world: World): void {
  const { X, Y, s } = v
  const x0 = X(hz.x - 6)
  const x1 = X(hz.x + hz.w + 6)
  if (x1 < 0 || x0 > v.width) return
  const dyingHere = world.dying?.cause === 'tide'
  const level = dyingHere ? 1 : tideLevel(hz, world.time)
  if (level <= 0) return
  const full = hz.h * (dyingHere ? 1.5 : 1)
  const slabTop = Y(hz.y + hz.h)
  const top = slabTop - full * level * s
  const crest = Math.max(2, 3 * s)
  const w = x1 - x0
  // The surge: a lit slab of water with an uneven top, and a pale crest.
  poly(ctx, [[x0, top + 3 * s], [x0 + w * 0.3, top], [x0 + w * 0.7, top + 1.5 * s], [x1, top + 2.5 * s], [x1, slabTop + 30 * s], [x0, slabTop + 30 * s]], pal[SEA + L])
  poly(ctx, [[x0, top + 3 * s], [x0 + w * 0.3, top], [x0 + w * 0.7, top + 1.5 * s], [x1, top + 2.5 * s], [x1, top + 2.5 * s + crest], [x0 + w * 0.7, top + 1.5 * s + crest], [x0 + w * 0.3, top + crest], [x0, top + 3 * s + crest]], pal[SKY + L])
}

// ---- lamps (the beacons) ----

function drawLamp(ctx: CanvasRenderingContext2D, v: View, pal: Palette, bx: number, by: number, lit: boolean, big: boolean): void {
  const { X, Y, s } = v
  const cx = X(bx)
  if (cx < -60 || cx > v.width + 60) return
  const H = big ? 46 : 64
  const head = big ? 15 : 9
  const top = by - H
  rect(ctx, X(bx - 1.5), Y(top), 3 * s, H * s, pal[NEAR])
  rect(ctx, X(bx - 8), Y(by - 3), 16 * s, 3 * s, pal[NEAR])
  rect(ctx, X(bx - 5), Y(top), 10 * s, 2 * s, pal[NEAR])
  const cy = Y(top - head * 0.6)
  const r = head * s
  poly(ctx, [[cx, cy - r * 0.7], [cx + r * 0.55, cy], [cx, cy + r * 0.7], [cx - r * 0.55, cy]], lit ? pal[SKIN + L] : pal[SKY + L])
  if (lit) {
    const c = r * 0.22
    rect(ctx, cx - c, cy - c, c * 2, c * 2, pal[SHIRT + L])
  }
}

// ---- the figure ----

type Leg = [number, number, number, number] // knee u,v foot u,v
type Arm = [number, number, number, number] // elbow u,v hand u,v
interface Pose {
  hip: number
  hipU?: number
  sho: number
  lean: number
  head: Pt
  legs: [Leg, Leg] // back, front
  arms: [Arm, Arm] // back, front
}

// Proportions of 52: head 7, torso 18, legs 27. u right, v up from the feet.
const IDLE: Pose = { hip: 27, sho: 45, lean: 0, head: [1, 48.5], legs: [[-3, 14, -3.5, 0.5], [3, 14, 3.5, 0.5]], arms: [[-4.5, 36, -4.5, 29.5], [4.5, 36, 5, 29.5]] }
const RUN_HALF: Pose[] = [
  // contact: front heel ahead, back toe leaving the ground
  { hip: 26, sho: 44, lean: 2, head: [3, 48.5], legs: [[-7, 13, -13, 5], [6, 15, 11, 0.5]], arms: [[6, 36, 10, 41], [-7, 36, -10, 30]] },
  // down: weight over the front leg
  { hip: 24, sho: 42, lean: 3, head: [4, 46.5], legs: [[-3, 16, -10, 9], [3, 12, 3, 0.5]], arms: [[3, 35, 7, 39], [-4, 35, -6, 31]] },
  // pass / up: the back knee comes through high
  { hip: 27, sho: 45, lean: 3, head: [4, 49.5], legs: [[5, 20, 3, 11], [-4, 14, -9, 3]], arms: [[-3, 36, -5, 31], [4, 36, 8, 41]] },
]
const RUN: Pose[] = [
  ...RUN_HALF,
  ...RUN_HALF.map((p): Pose => ({ ...p, legs: [p.legs[1], p.legs[0]], arms: [p.arms[1], p.arms[0]] })),
]
const JUMP: Pose = { hip: 27, sho: 45, lean: 4, head: [5, 49], legs: [[-7, 20, -13, 12], [9, 19, 15, 10]], arms: [[-8, 38, -12, 31], [8, 41, 14, 47]] }
const HOP: Pose = { hip: 27, sho: 45, lean: 1, head: [2, 49], legs: [[-2, 16, -3, 7], [3, 17, 3, 7]], arms: [[-6, 38, -9, 32], [6, 38, 9, 32]] }
const FALL: Pose = { hip: 27, sho: 45, lean: -1, head: [1, 49], legs: [[-4, 15, -6, 4], [5, 16, 6, 4]], arms: [[-6, 42, -9, 50], [6, 42, 9, 50]] }
const CROUCH: Pose = { hip: 18, hipU: 1, sho: 34, lean: 5, head: [7, 38], legs: [[-7, 9, -7, 0.5], [7, 10, 6, 0.5]], arms: [[-3, 26, 1, 20], [9, 28, 13, 22]] }

function poseFor(world: World): Pose | null {
  const p = world.player
  if (world.dying) {
    if (world.dying.cause === 'fall') return FALL
    if (world.dying.cause === 'tide') return world.dying.t < 0.12 ? IDLE : null
    return CROUCH
  }
  if (p.crouch > 0) return CROUCH
  if (!p.grounded) {
    if (p.hop) return p.vy < 0 ? HOP : FALL
    if (Math.abs(p.vx) > 100) return JUMP
    return p.vy < 0 ? HOP : FALL
  }
  if (Math.abs(p.vx) > 30) return RUN[Math.floor(world.time * 12) % 6]
  return IDLE
}

function drawFigure(ctx: CanvasRenderingContext2D, v: View, pal: Palette, world: World): void {
  const pose = poseFor(world)
  if (!pose) return
  const p = world.player
  const s = v.s
  const f = p.facing < 0 ? -1 : 1
  const U = (u: number): number => v.X(p.x + u * f)
  const V = (vv: number): number => v.Y(p.y - vv)
  const P = (u: number, vv: number): Pt => [U(u), V(vv)]

  // One breath every 3 s: the torso and head rise 1 unit, held.
  const breath = pose === IDLE && !world.dying && world.time % 3 > 0.9 && world.time % 3 < 1.9 ? 1 : 0
  const hipU = pose.hipU ?? 0
  const hip = pose.hip
  const sho = pose.sho + breath
  const lean = pose.lean
  const shoU = hipU + lean * 0.6

  const thigh = 4 * s
  const shin = 3 * s
  const upper = 3 * s
  const fore = 2.4 * s

  const leg = (l: Leg, color: string) => {
    const hipPt = P(hipU, hip)
    const knee = P(l[0], l[1])
    const foot = P(l[2], Math.max(0.5, l[3]))
    bar(ctx, hipPt, knee, thigh, color)
    bar(ctx, knee, foot, shin, color)
    rect(ctx, knee[0] - thigh / 2, knee[1] - thigh / 2, thigh, thigh, color)
    // Boot: a small wedge pointing forward.
    poly(ctx, [P(l[2] - 2, Math.max(0.5, l[3])), P(l[2] + 4, Math.max(0.5, l[3])), P(l[2] + 4, Math.max(0.5, l[3]) + 2.5), P(l[2] - 2, Math.max(0.5, l[3]) + 2.5)], pal[NEAR])
  }
  const arm = (a: Arm) => {
    const shoPt = P(shoU, sho - 1)
    const elbow = P(a[0], a[1] + breath)
    const hand = P(a[2], a[3] + breath)
    bar(ctx, shoPt, elbow, upper, pal[SHIRT])
    bar(ctx, elbow, hand, fore, pal[SKIN])
    const hr = 2 * s
    rect(ctx, hand[0] - hr / 2, hand[1] - hr / 2, hr, hr, pal[SKIN])
  }

  leg(pose.legs[0], pal[NEAR])
  arm(pose.arms[0])
  // Torso.
  poly(ctx, [P(hipU - 3, hip), P(hipU + 3, hip), P(shoU + 4.5, sho), P(shoU - 4, sho)], pal[SHIRT])
  // Neck and head.
  rect(ctx, U(shoU + (f < 0 ? 1 : -1)) - (f < 0 ? 2 * s : 0), V(sho + 1.5), 2 * s, 2 * s, pal[SKIN])
  const hx = pose.head[0]
  const hy = pose.head[1] + breath
  poly(ctx, [
    P(hx - 3, hy - 3.5), P(hx - 3, hy + 2), P(hx - 1, hy + 3.5), P(hx + 2, hy + 3.5),
    P(hx + 3.5, hy + 1), P(hx + 3, hy - 2), P(hx + 1, hy - 3.5),
  ], pal[SKIN])
  poly(ctx, [P(hx - 3.2, hy + 0.5), P(hx - 3, hy + 2.5), P(hx - 1, hy + 3.7), P(hx + 2.2, hy + 3.7), P(hx + 1, hy + 1.5), P(hx - 1.5, hy + 1)], pal[NEAR])
  arm(pose.arms[1])
  leg(pose.legs[1], pal[NEAR + L])
}

// ---- foreground ----

function drawArches(ctx: CanvasRenderingContext2D, v: View, pal: Palette): void {
  const { X, Y, s } = v
  for (const ax of ARCHES) {
    const x0 = X(ax - 90)
    const x1 = X(ax + 90)
    if (x1 < 0 || x0 > v.width) continue
    const legW = 30 * s
    const yb = Y(250)
    const bottom = v.height + 10
    // Left leg, right leg, lintel with a rough top.
    poly(ctx, [[x0, bottom], [x0 - 6 * s, yb + 40 * s], [x0 + 2 * s, yb], [x0 + legW, yb], [x0 + legW + 5 * s, yb + 60 * s], [x0 + legW + 2 * s, bottom]], pal[NEAR])
    poly(ctx, [[x1 - legW - 4 * s, bottom], [x1 - legW - 6 * s, yb + 50 * s], [x1 - legW, yb], [x1 - 2 * s, yb], [x1 + 4 * s, yb + 30 * s], [x1, bottom]], pal[NEAR])
    poly(ctx, [[x0 - 4 * s, yb], [x0 + 10 * s, Y(200)], [X(ax - 20), Y(212)], [X(ax + 30), Y(188)], [x1 + 2 * s, Y(206)], [x1 + 4 * s, yb], [X(ax + 40), Y(258)], [X(ax - 30), Y(254)]], pal[NEAR])
    // The right leg's right face catches the moon.
    poly(ctx, [[x1 - 2 * s, yb], [x1 + 4 * s, yb + 30 * s], [x1, bottom], [x1 - 5 * s, bottom], [x1 - 1 * s, yb + 30 * s], [x1 - 6 * s, yb + 2 * s]], pal[NEAR + L])
  }
}

function drawForeground(ctx: CanvasRenderingContext2D, v: View, pal: Palette): void {
  const k = 0.9
  const s = v.s
  const spacing = 260
  const half = v.width / (2 * s)
  const u0 = v.camCenter * k - half
  const u1 = v.camCenter * k + half
  const sxOf = (u: number) => v.width / 2 + (u - v.camCenter * k) * s
  const top = v.bandY
  const bottom = v.height + 10
  rect(ctx, 0, top, v.width, v.height - top, pal[NEAR])
  for (let i = Math.floor(u0 / spacing) - 1; i <= Math.floor(u1 / spacing) + 1; i++) {
    const r1 = hash(i * 5 + 301)
    const r2 = hash(i * 5 + 302)
    const r3 = hash(i * 5 + 303)
    const r4 = hash(i * 5 + 304)
    const cu = (i + r2) * spacing
    const cx = sxOf(cu)
    if (r1 < 0.6) {
      // A low hump.
      const w = (60 + r3 * 90) * s
      const h = (8 + r4 * 26) * s
      poly(ctx, [[cx - w / 2, bottom], [cx - w / 2 + 6 * s, top + 2 * s], [cx - w * 0.15, top - h], [cx + w * 0.2, top - h * 0.7], [cx + w / 2, top + 4 * s], [cx + w / 2, bottom]], pal[NEAR])
    }
    if (r3 > 0.45) {
      // Stiff plants: a cluster of blades.
      const n = 2 + Math.floor(r4 * 3)
      const bx = cx + (r1 - 0.5) * 80 * s
      for (let j = 0; j < n; j++) {
        const rj = hash(i * 17 + j * 3 + 401)
        const rk = hash(i * 17 + j * 3 + 402)
        const x = bx + (j - n / 2) * 7 * s
        const h = (24 + rj * 44) * s
        const w = (2.5 + rk * 2.5) * s
        const lean = (rk - 0.5) * 14 * s
        poly(ctx, [[x - w, top + 6 * s], [x + lean, top - h], [x + w, top + 6 * s]], pal[NEAR])
      }
    }
    if (r1 > 0.9) {
      // A tall frame rock, narrow, leaning.
      const w = (30 + r2 * 20) * s
      const h = v.groundY - v.height * (0.56 - r4 * 0.1)
      const lean = (r3 - 0.5) * 30 * s
      poly(ctx, [[cx - w / 2, bottom], [cx - w / 2 + lean, top - h + 12 * s], [cx + lean + w * 0.1, top - h], [cx + w / 2 + lean, top - h + 6 * s], [cx + w / 2, bottom]], pal[NEAR])
    }
  }
}
