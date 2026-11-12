/**
 * The hero of the 16-bit view as a small model, drawn again every frame: a
 * handful of ellipsoids and capsules (head, hair, torso, arms, legs, shoes,
 * what the look puts on them) posed by a few numbers and rendered here, in
 * plain typed arrays, into a sprite cell at the view's pixel density. So the
 * figure can face any way, walk in a fluid cycle and swing a real blade that
 * sweeps the ground plane and goes behind the body where it should.
 *
 * It is drawn the way a pixel artist would draw it, not the way a renderer
 * would: every pixel is one flat colour of its part (an outline, a shade, the
 * colour, a light), picked in hard steps; a one-px outline in the part's
 * darkest shade goes round the silhouette, and a dark line lies where one
 * part stands in front of another; lone pixels are merged into their
 * neighbours; the eyes and the mouth are placed, not sampled; and every
 * frame of the body snaps to whole pixels, so nothing shimmers. The engine
 * lights the sprite from the normal picture in its own steps, so the colour
 * picture carries only a shaded underside and a lit streak.
 *
 * The camera is the scene's: it stands south-east of the figure, looking
 * north-west and 30° down. The model is measured in px across (a sphere of
 * radius 8 is a disc 16 px wide), so a tile of ground is 32·√2 units, which
 * lands as the scene's (32, 16) and (−32, 16), and a height of 1 is cos 30°
 * px up the screen. The blade is laid by that projection exactly: its tip is
 * `reach` tiles from the body's middle, 14 px above the ground.
 *
 * `renderFigure(pose, look, out)` is pure and keeps no state between frames
 * but its scratch buffers and the look's colours.
 * `scripts/zelda-lab/figure-sheet.mjs` draws contact sheets of it.
 */
import { lookPalette, type HeroLook } from '../heroLook'
import { mix } from '../heroColors'

/** The sprite cell, in hi-res px. (ax, ay) is the point on the ground under the middle of the body. */
export const FIG = { w: 160, h: 96, ax: 80, ay: 66 } as const

export type FigureAct = 'idle' | 'walk' | 'swing' | 'spin' | 'lift' | 'carry' | 'push' | 'hurt' | 'get' | 'use' | 'fall' | 'dead'

export interface FigureBlade {
  /** World angle the blade points along now (radians; 0 = east, π/2 = south). */
  a: number
  /** Where the tip is, tiles from the body's middle (1.2 the sword, 1.4 the Arc Blade, 1.55 a spin). */
  reach: number
  /** Angles the blade pointed along just before, newest first (may be empty): the trail sweeps from trail[last] to a. */
  trail: number[]
  kind: 'sword' | 'arc'
  /** 0..1: held charged (the blade glows, a spark at the tip when `flash`). */
  charge: number
  flash: boolean
}

export interface FigurePose {
  /** World angle the body faces (radians; 0 = east, π/2 = south, world y grows south). Any value. */
  yaw: number
  act: FigureAct
  /** idle: seconds (a slow breath); walk: stride phase 0..1, looping, two steps per cycle; carry: stride phase (see `moving`);
   *  push: stride phase too (the feet shuffle; 0 stands braced);
   *  swing: 0..1 through the swing; spin: 0..1 through the spin (the body turns a full circle, yaw is where it started);
   *  lift/get/use/hurt/fall/dead: 0..1 through the act (dead: 0..0.5 is a spin and collapse, after that lying still). */
  t: number
  /** carry: walking (true) or standing. */
  moving?: boolean
  /** Drawn in the hand for idle, walk, swing and spin; the other acts have their hands full and leave it out. */
  blade?: FigureBlade
}

export interface FigureSprite {
  w: number; h: number; ax: number; ay: number
  /** RGBA, straight alpha. Alpha below 255 is allowed for the trail only (the engine turns it into an ordered dither). */
  albedo: Uint8ClampedArray
  /** rgb = the surface normal as (right, up, toward the viewer) * 0.5 + 0.5; a = how much the pixel glows by itself, 0..255 (blade edge, trail, charged spark). */
  normal: Uint8ClampedArray
  /** The box that holds every non-transparent pixel this frame, so the caller can upload only that: x0, y0, x1, y1 (exclusive). */
  box: [number, number, number, number]
}

// ---------------------------------------------------------------------------
// The camera and the bench
// ---------------------------------------------------------------------------

const W: number = FIG.w
const H: number = FIG.h
const AX: number = FIG.ax
const AY: number = FIG.ay
const N = W * H
const S2 = Math.SQRT1_2
/** cos and sin of the camera's 30° tilt. */
const CE = Math.cos(Math.PI / 6)
const SE = 0.5
/** Model units in a tile of ground. */
const GROUND = 32 * Math.SQRT2
/** The hand that holds the blade is 14 px above the ground. */
const HAND_Z = 14 / CE
/** One px up the screen, as a height. */
const PX = 1 / CE
const TAU = Math.PI * 2
const FAR = -1e9

/** What every pixel is before it has a colour: depth toward the viewer, material, part, tone, normal. */
const zb = new Float32Array(N).fill(FAR)
const mt = new Uint8Array(N)
const gp = new Uint8Array(N)
const tn = new Uint8Array(N)
/** 1: the tone was placed by hand and stays. */
const fx = new Uint8Array(N)
const nx = new Float32Array(N)
const ny = new Float32Array(N)
const nz = new Float32Array(N)
/** The outline pixels of a frame, found first and laid after. */
const olAt = new Int32Array(N)
const olFrom = new Int32Array(N)

/** The box the bench was drawn in last (x0, y0, x1, y1; exclusive). */
let bx0 = W
let by0 = H
let bx1 = 0
let by1 = 0

// Materials. Each has four tones: 0 outline, 1 shade, 2 the colour, 3 light.
const SKIN = 1
const HAIR = 2
const BAND = 3
const TOP = 4
const STRIPE = 5
const BELT = 6
const BOTTOM = 7
const SHOES = 8
const STEEL = 9
const EDGE = 10
const EDGE_HOT = 11
const GUARD = 12
const GRIP = 13
const EYE = 14
const MOUTH = 15
const SPARK = 16
const MATS = 17

// Parts: a dark line is drawn where one part stands well in front of another.
const G_LEG_L = 1
const G_LEG_R = 2
const G_TORSO = 3
const G_ARM_L = 4
const G_ARM_R = 5
const G_HEAD = 6
const G_TAIL = 7
const G_BLADE = 8

const pal = new Uint8Array(MATS * 4 * 3)
const glow = new Uint8Array(MATS * 4)
/** Below this much light a pixel takes the shade, above that much the light (2: never). */
const shadeAt = new Float32Array(MATS)
const lightAt = new Float32Array(MATS).fill(2)

/** The light the two baked steps are picked by: from above, a little from the west and toward the viewer, so the shade is mostly an underside. */
const LX = -0.3
const LY = 0.81
const LZ = 0.5

function tone(m: number, t: number, hex: string) {
  const v = parseInt(hex.slice(1, 7), 16)
  const i = (m * 4 + t) * 3
  pal[i] = (v >> 16) & 255
  pal[i + 1] = (v >> 8) & 255
  pal[i + 2] = v & 255
}

function tones(m: number, outline: string, shade: string, base: string, light: string) {
  tone(m, 0, outline)
  tone(m, 1, shade)
  tone(m, 2, base)
  tone(m, 3, light)
}

/** A colour's shade: a warm colour drifts to plum, a cool one to indigo, so yellow never turns to mud. */
function shadeOf(c: string): string {
  const v = parseInt(c.slice(1, 7), 16)
  return (v >> 16) > (v & 255) ? mix(c, '#7a1e5e', 0.38) : mix(c, '#2a2478', 0.4)
}

/** A part's steps from its colour: the shade, an outline deeper still, and a light that keeps the colour's tint. */
function ramp(m: number, c: string, shade = shadeOf(c), light = mix(c, '#ffffff', 0.32)) {
  tones(m, mix(shade, '#100720', 0.84), shade, c, light)
}

let palLook: HeroLook | null = null
let arcKey = false

const COLOUR_KEYS = ['skin', 'hairColor', 'headColor', 'top', 'stripe', 'belt', 'bottomColor', 'shoes', 'bottom'] as const

function sameColours(a: HeroLook, b: HeroLook): boolean {
  for (const k of COLOUR_KEYS) if (a[k] !== b[k]) return false
  return true
}

/** The look's colours as tones; built when the look changes. */
function usePalette(l: HeroLook, arc: boolean) {
  if (!palLook || !sameColours(palLook, l)) {
    palLook = { ...l }
    const p = lookPalette(l)
    ramp(SKIN, l.skin, p.S, mix(l.skin, '#ffffff', 0.3))
    tone(SKIN, 0, mix(p.S!, '#24092a', 0.8))
    ramp(HAIR, l.hairColor, mix(l.hairColor, '#120826', 0.4), p.H)
    tone(HAIR, 0, mix(l.hairColor, '#0a0514', 0.8))
    ramp(BAND, l.headColor)
    ramp(TOP, l.top, p.C)
    ramp(STRIPE, l.stripe)
    ramp(BELT, l.belt)
    ramp(BOTTOM, p.B!)
    ramp(SHOES, l.shoes)
    tones(GUARD, '#5a2a14', '#c8861c', '#ffd23f', '#fff3a8')
    tones(GRIP, '#2a1230', '#4a2440', '#7a4a52', '#a8706a')
    tones(EYE, '#1c1030', '#1c1030', '#1c1030', mix(p.S!, '#3a0e34', 0.25))
    tones(MOUTH, '#1c1030', '#7a1040', '#ff2fa0', '#ff8ac8')
    shadeAt[SKIN] = -0.2
    shadeAt[HAIR] = 0.05; lightAt[HAIR] = 0.84
    shadeAt[BAND] = 0.05
    shadeAt[TOP] = 0.16
    shadeAt[STRIPE] = -0.25
    shadeAt[BELT] = -1
    shadeAt[BOTTOM] = 0.2
    shadeAt[SHOES] = 0.12
    shadeAt[GUARD] = -1
    shadeAt[GRIP] = -1
  }
  if (arc !== arcKey || !pal[STEEL * 12 + 6]) {
    arcKey = arc
    if (arc) {
      tones(STEEL, '#8a3c10', '#ffe9a0', '#fffbe6', '#ffffff')
      tones(EDGE, '#8a3c10', '#e8961e', '#ffd23f', '#fff0a0')
      tones(EDGE_HOT, '#d07a14', '#ffd23f', '#fff0a0', '#ffffff')
      tones(SPARK, '#ffd23f', '#ffd23f', '#fff0a0', '#ffffff')
    } else {
      tones(STEEL, '#1c3ea8', '#a8f4ff', '#f0ffff', '#ffffff')
      tones(EDGE, '#1c3ea8', '#1fa4dc', '#3fe6ff', '#b4fbff')
      tones(EDGE_HOT, '#2a7ae0', '#3fe6ff', '#b4fbff', '#ffffff')
      tones(SPARK, '#3fe6ff', '#3fe6ff', '#b4fbff', '#ffffff')
    }
    for (let t = 0; t < 4; t++) {
      glow[STEEL * 4 + t] = t ? 255 : 0
      glow[EDGE * 4 + t] = t ? 200 : 0
      glow[EDGE_HOT * 4 + t] = t ? 255 : 110
      glow[SPARK * 4 + t] = 255
    }
  }
}

// ---------------------------------------------------------------------------
// Frames: where a part's own axes point on the screen
// ---------------------------------------------------------------------------

/** A frame is 12 numbers in camera space (right, up, toward the viewer): the forward, right and up axes, then the origin. */
type Frame = Float64Array
const fRoot: Frame = new Float64Array(12)
const fTorso: Frame = new Float64Array(12)
const fHead: Frame = new Float64Array(12)

/** The whole figure's size (a fall shrinks it). */
let SC = 1

/** A point handed back by `pt` and `ground`. */
let pu = 0
let pv = 0
let pd = 0

function axis(fr: Frame, i: number, x: number, y: number, z: number) {
  fr[i] = S2 * (x - y)
  fr[i + 1] = CE * z - SE * S2 * (x + y)
  fr[i + 2] = CE * S2 * (x + y) + SE * z
}

/**
 * A frame facing `yaw`, tipped forward by `pitch` and over to its right by
 * `roll`, standing at camera point (u, v, d). The origin lands on a whole
 * pixel, so what is built in the frame moves in whole pixels.
 */
function setFrame(fr: Frame, yaw: number, pitch: number, roll: number, u: number, v: number, d: number) {
  const c = Math.cos(yaw)
  const s = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  const cr = Math.cos(roll)
  const sr = Math.sin(roll)
  const ux = c * sp
  const uy = s * sp
  const uz = cp
  axis(fr, 0, c * cp, s * cp, -sp)
  axis(fr, 3, -s * cr - ux * sr, c * cr - uy * sr, -uz * sr)
  axis(fr, 6, ux * cr - s * sr, uy * cr + c * sr, uz * cr)
  fr[9] = Math.round(u)
  fr[10] = Math.round(v)
  fr[11] = d
}

/** The camera point of (forward, right, up) in a frame. */
function pt(fr: Frame, f: number, r: number, z: number) {
  pu = fr[9] + SC * (f * fr[0] + r * fr[3] + z * fr[6])
  pv = fr[10] + SC * (f * fr[1] + r * fr[4] + z * fr[7])
  pd = fr[11] + SC * (f * fr[2] + r * fr[5] + z * fr[8])
}

/** The camera point of a world point (model units from the ground under the body's middle). */
function ground(x: number, y: number, z: number) {
  pu = S2 * (x - y)
  pv = CE * z - SE * S2 * (x + y)
  pd = CE * S2 * (x + y) + SE * z
}

// ---------------------------------------------------------------------------
// The rasterisers: each walks its own box and keeps the nearest hit
// ---------------------------------------------------------------------------

function grow(x0: number, y0: number, x1: number, y1: number) {
  if (x0 < bx0) bx0 = x0
  if (y0 < by0) by0 = y0
  if (x1 > bx1) bx1 = x1
  if (y1 > by1) by1 = y1
}

const PLAIN = 0
/** The torso: trousers under the belt, the belt, the shirt and its stripe. */
const K_TORSO = 1
/** The hair: open over the face, the band round it. */
const K_HAIR = 2
/** A skirt: only what is above the hem. */
const K_DOME = 3

/** Whether the hair wears the band, and where a skirt's hem is: set by `build`. */
let bandOn = false
let hemZ = 0

/**
 * An ellipsoid in a frame: centre (f, r, z), radii along the frame's axes.
 * `snap` puts its middle on a pixel corner (small round things keep one shape).
 */
function ell(fr: Frame, f: number, r: number, z: number, rf: number, rr: number, rz: number, mat: number, grp: number, kind = PLAIN, snap = false) {
  pt(fr, f, r, z)
  let cu = pu
  let cv = pv
  const cd = pd
  if (snap) { cu = Math.round(cu); cv = Math.round(cv) }
  const a0 = fr[0], a1 = fr[1], a2 = fr[2]
  const b0 = fr[3], b1 = fr[4], b2 = fr[5]
  const c0 = fr[6], c1 = fr[7], c2 = fr[8]
  const Rf = rf * SC
  const Rr = rr * SC
  const Rz = rz * SC
  const hu = Math.sqrt(a0 * a0 * Rf * Rf + b0 * b0 * Rr * Rr + c0 * c0 * Rz * Rz)
  const hv = Math.sqrt(a1 * a1 * Rf * Rf + b1 * b1 * Rr * Rr + c1 * c1 * Rz * Rz)
  const x0 = Math.max(0, Math.floor(AX + cu - hu))
  const x1 = Math.min(W, Math.ceil(AX + cu + hu))
  const y0 = Math.max(0, Math.floor(AY - cv - hv))
  const y1 = Math.min(H, Math.ceil(AY - cv + hv))
  if (x0 >= x1 || y0 >= y1) return
  const kf = 1 / (Rf * Rf)
  const kr = 1 / (Rr * Rr)
  const kz = 1 / (Rz * Rz)
  const q11 = a0 * a0 * kf + b0 * b0 * kr + c0 * c0 * kz
  const q12 = a0 * a1 * kf + b0 * b1 * kr + c0 * c1 * kz
  const q13 = a0 * a2 * kf + b0 * b2 * kr + c0 * c2 * kz
  const q22 = a1 * a1 * kf + b1 * b1 * kr + c1 * c1 * kz
  const q23 = a1 * a2 * kf + b1 * b2 * kr + c1 * c2 * kz
  const q33 = a2 * a2 * kf + b2 * b2 * kr + c2 * c2 * kz
  const inv = 1 / SC
  let hit = false
  for (let y = y0; y < y1; y++) {
    const dv = AY - (y + 0.5) - cv
    for (let x = x0; x < x1; x++) {
      const du = x + 0.5 - AX - cu
      const b = q13 * du + q23 * dv
      const c = q11 * du * du + 2 * q12 * du * dv + q22 * dv * dv - 1
      const disc = b * b - q33 * c
      if (disc <= 0) continue
      const dd = (-b + Math.sqrt(disc)) / q33
      const i = y * W + x
      if (cd + dd <= zb[i]) continue
      let m = mat
      if (kind !== PLAIN) {
        const lf = (du * a0 + dv * a1 + dd * a2) * inv
        const lr = (du * b0 + dv * b1 + dd * b2) * inv
        const lz = (du * c0 + dv * c1 + dd * c2) * inv
        if (kind === K_TORSO) {
          if (lz < -4.4) m = BOTTOM
          else if (lz < -2) m = BELT
          else if (lf > 0 && lr > -1.5 && lr < 1.5) m = STRIPE
        } else if (kind === K_HAIR) {
          // The face looks out under the fringe; the hair comes down beside it.
          // The hair comes down beside the face to the jaw, then draws back to the nape.
          if (lz < 3 && lf > (0.53 - 0.4 * clamp((-4.5 - lz) / 2.5, 0, 1)) * Math.abs(lr)) continue
          if (bandOn && lz >= 3 && lz < 5) m = BAND
        } else if (lz < hemZ) continue
      }
      let n0 = q11 * du + q12 * dv + q13 * dd
      let n1 = q12 * du + q22 * dv + q23 * dd
      let n2 = q13 * du + q23 * dv + q33 * dd
      const nl = 1 / Math.sqrt(n0 * n0 + n1 * n1 + n2 * n2)
      n0 *= nl; n1 *= nl; n2 *= nl
      zb[i] = cd + dd
      mt[i] = m
      gp[i] = grp
      fx[i] = 0
      nx[i] = n0; ny[i] = n1; nz[i] = n2
      hit = true
    }
  }
  if (hit) grow(x0, y0, x1, y1)
}

/**
 * A capsule between two camera points. Up to `split` of the way from the
 * first it is `matA`, beyond that `matB` (a sleeve and a hand, shorts and a
 * shin). Its ends sit on pixel corners.
 */
function cap(au: number, av: number, ad: number, bu: number, bv: number, bd: number, rad: number, matA: number, matB: number, split: number, grp: number) {
  au = Math.round(au); av = Math.round(av)
  bu = Math.round(bu); bv = Math.round(bv)
  const R = rad * SC
  const x0 = Math.max(0, Math.floor(AX + Math.min(au, bu) - R))
  const x1 = Math.min(W, Math.ceil(AX + Math.max(au, bu) + R))
  const y0 = Math.max(0, Math.floor(AY - Math.max(av, bv) - R))
  const y1 = Math.min(H, Math.ceil(AY - Math.min(av, bv) + R))
  if (x0 >= x1 || y0 >= y1) return
  const ex = bu - au
  const ey = bv - av
  const ez = bd - ad
  const baba = ex * ex + ey * ey + ez * ez
  // The ray runs away from the viewer: (0, 0, −1) from depth 0.
  const bard = -ez
  const a = baba - bard * bard
  const rr = R * R
  let hit = false
  for (let y = y0; y < y1; y++) {
    const oy = AY - (y + 0.5) - av
    for (let x = x0; x < x1; x++) {
      const ox = x + 0.5 - AX - au
      const baoa = ex * ox + ey * oy - ez * ad
      const oaoa = ox * ox + oy * oy + ad * ad
      let t = 0
      let k = -1
      if (a > 1e-6) {
        const b = baba * ad - baoa * bard
        const c = baba * oaoa - baoa * baoa - rr * baba
        const h = b * b - a * c
        if (h < 0) continue
        t = (-b - Math.sqrt(h)) / a
        const yy = baoa + t * bard
        if (yy > 0 && yy < baba) k = yy / baba
        else {
          // A round end: the sphere at the nearer end point.
          const far = yy > 0
          const sx = far ? ox - ex : ox
          const sy = far ? oy - ey : oy
          const sz = far ? -bd : -ad
          const c2 = sx * sx + sy * sy + sz * sz - rr
          const h2 = sz * sz - c2
          if (h2 <= 0) continue
          t = sz - Math.sqrt(h2)
          k = far ? 1 : 0
        }
      } else {
        // Seen end on: whichever end sphere is nearer.
        const h1 = rr - ox * ox - oy * oy
        const qx = ox - ex
        const qy = oy - ey
        const h2 = rr - qx * qx - qy * qy
        const t1 = h1 > 0 ? -ad - Math.sqrt(h1) : 1e9
        const t2 = h2 > 0 ? -bd - Math.sqrt(h2) : 1e9
        if (t1 > 1e8 && t2 > 1e8) continue
        if (t1 < t2) { t = t1; k = 0 } else { t = t2; k = 1 }
      }
      const depth = -t
      const i = y * W + x
      if (depth <= zb[i]) continue
      let n0 = ox - k * ex
      let n1 = oy - k * ey
      let n2 = depth - ad - k * ez
      const nl = 1 / Math.sqrt(n0 * n0 + n1 * n1 + n2 * n2 || 1)
      n0 *= nl; n1 *= nl; n2 *= nl
      zb[i] = depth
      mt[i] = k > split ? matB : matA
      gp[i] = grp
      fx[i] = 0
      nx[i] = n0; ny[i] = n1; nz[i] = n2
      hit = true
    }
  }
  if (hit) grow(x0, y0, x1, y1)
}

/**
 * A flat bar on the screen between two camera points, `h0` px to each side
 * at the first and `h1` at the second: steel is a drawn line, not a sampled
 * solid, so it is the same width whichever way it points. Within `core` px
 * of the middle it is `matCore`. Its tones are placed.
 */
function bar(u0: number, v0: number, d0: number, u1: number, v1: number, d1: number, h0: number, h1: number, core: number, mat: number, matCore: number, t: number, tCore: number) {
  const hm = Math.max(h0, h1)
  const x0 = Math.max(0, Math.floor(AX + Math.min(u0, u1) - hm))
  const x1 = Math.min(W, Math.ceil(AX + Math.max(u0, u1) + hm))
  const y0 = Math.max(0, Math.floor(AY - Math.max(v0, v1) - hm))
  const y1 = Math.min(H, Math.ceil(AY - Math.min(v0, v1) + hm))
  if (x0 >= x1 || y0 >= y1) return
  const ex = u1 - u0
  const ey = v1 - v0
  const ll = ex * ex + ey * ey || 1
  let hit = false
  for (let y = y0; y < y1; y++) {
    const oy = AY - (y + 0.5) - v0
    for (let x = x0; x < x1; x++) {
      const ox = x + 0.5 - AX - u0
      let k = (ox * ex + oy * ey) / ll
      if (k < 0) k = 0
      else if (k > 1) k = 1
      const qx = ox - k * ex
      const qy = oy - k * ey
      const q = qx * qx + qy * qy
      const hw = h0 + (h1 - h0) * k
      if (q >= hw * hw) continue
      const depth = d0 + (d1 - d0) * k + 0.6
      const i = y * W + x
      if (depth <= zb[i]) continue
      const mid = q < core * core
      zb[i] = depth
      mt[i] = mid ? matCore : mat
      tn[i] = mid ? tCore : t
      gp[i] = G_BLADE
      fx[i] = 1
      nx[i] = 0; ny[i] = 0.6; nz[i] = 0.8
      hit = true
    }
  }
  if (hit) grow(x0, y0, x1, y1)
}

// ---------------------------------------------------------------------------
// The pose: a few numbers per act
// ---------------------------------------------------------------------------

const P = {
  /** Where the legs face, how far the torso is turned from them, and the head from the torso. */
  yaw: 0, twist: 0, turn: 0,
  /** The torso tipped forward and over to its right; the head tipped forward on it. */
  lean: 0, roll: 0, nod: 0,
  /** The body above the legs lifted (a breath, a bob, a crouch), in whole px. */
  rise: 0,
  /** The whole figure tipped over on its left side, lifted off the ground and moved along it. */
  lie: 0, ox: 0, oy: 0, oz: 0,
  /** Feet: forward of the hips, and off the ground. */
  lf: 0, lz: 0, rf: 0, rz: 0,
  /** Hands, in the torso's frame (forward, right, up from the hips). */
  lhf: 0, lhr: 0, lhz: 0, rhf: 0, rhr: 0, rhz: 0,
  /** What hangs from the head: 0 hangs, 1 streams out behind; and its bounce, −1..1. */
  fly: 0, bounce: 0,
  /** 0 open, 1 closed, 2 screwed up. */
  eyes: 0,
  /** 0 none, 1 open (hurt), 2 a small one (a find held up). */
  mouth: 0,
  /** The blade is in the right hand: the angle it points along and how far out the hand is. */
  blade: false, ba: 0, hr: 0,
}

const REST_F = 0.6
const REST_R = 8.5
const REST_Z = 1.2
const HIP = 9

function rest(yaw: number) {
  P.yaw = yaw; P.twist = 0; P.turn = 0
  P.lean = 0; P.roll = 0; P.nod = 0
  P.rise = 0; P.lie = 0; P.ox = 0; P.oy = 0; P.oz = 0
  P.lf = 0; P.lz = 0; P.rf = 0; P.rz = 0
  P.lhf = REST_F; P.lhr = -REST_R; P.lhz = REST_Z
  P.rhf = REST_F; P.rhr = REST_R; P.rhz = REST_Z
  P.fly = 0; P.bounce = 0; P.eyes = 0; P.mouth = 0
  P.blade = false; P.ba = 0; P.hr = 0
  SC = 1
}

const clamp = (v: number, a: number, b: number) => v < a ? a : v > b ? b : v
const ease = (t: number) => { const k = clamp(t, 0, 1); return k * k * (3 - 2 * k) }
/** An angle brought into −π..π. */
function wrap(a: number): number {
  a = (a + Math.PI) % TAU
  if (a < 0) a += TAU
  return a - Math.PI
}

/** The stride's sixteen frames: a phase that lands on the same pixels every time round. */
const STEPS = 16
function phase(t: number): number {
  const k = Math.round((t - Math.floor(t)) * STEPS) % STEPS
  return k / STEPS
}

/** Legs for a phase of the stride: each foot swings `amp` forward and back, and is lifted on its way forward. */
function stride(ph: number, amp: number, arms: number) {
  const s = Math.sin(ph * TAU)
  const c = Math.cos(ph * TAU)
  P.rf += amp * s
  P.lf -= amp * s
  P.rz += c > 0 ? c * 2 : 0
  P.lz += c < 0 ? -c * 2 : 0
  P.rhf -= arms * s
  P.lhf += arms * s
  P.rhz += arms * 0.25 * Math.abs(s)
  P.lhz += arms * 0.25 * Math.abs(s)
  // Down a px as each foot lands, twice a cycle.
  if (Math.abs(s) > 0.8) P.rise -= 1
  P.bounce = Math.sin(ph * 2 * TAU - 1.3)
}

function handsUp(f: number, r: number, z: number, k = 1) {
  P.lhf += (f - P.lhf) * k; P.lhr += (-r - P.lhr) * k; P.lhz += (z - P.lhz) * k
  P.rhf += (f - P.rhf) * k; P.rhr += (r - P.rhr) * k; P.rhz += (z - P.rhz) * k
}

/** The blade in the right hand, pointing along `a`: the torso turns after it and the other arm balances. */
function hold(a: number, stroke: number) {
  const rel = wrap(a - P.yaw)
  P.twist = clamp(0.55 * rel - 0.15, -0.8, 0.7)
  P.turn = -P.twist * 0.5
  const across = clamp((0.2 - (rel - P.twist)) / 1, 0, 1)
  P.blade = true
  P.ba = a
  P.hr = 12.5 - 3 * across
  P.lhf = -2.5 - 2 * stroke; P.lhr = -9.8; P.lhz = 3.5 + 2 * stroke
}

function solve(pose: FigurePose) {
  rest(pose.yaw)
  const t = pose.t
  const b = pose.blade
  switch (pose.act) {
    case 'idle': {
      if (Math.sin((t / 2.6) * TAU) > 0.3) P.rise = 1
      if (b) hold(b.a, 0)
      break
    }
    case 'walk': {
      stride(phase(t), 4.6, 3.4)
      P.lean = 0.07
      P.fly = 0.45
      if (b) { P.rhf = REST_F; P.rhz = REST_Z; hold(b.a, 0) }
      break
    }
    case 'swing': {
      const k = Math.sin(clamp(t, 0, 1) * Math.PI)
      P.lean = 0.06 + 0.16 * k
      P.rf = 3.2; P.lf = -2.6
      if (k > 0.5) P.rise = -1
      P.fly = 0.75
      P.bounce = 1 - 2 * clamp(t, 0, 1)
      if (b) hold(b.a, k)
      else { P.rhf = 9; P.rhr = 4; P.rhz = 6.5 }
      break
    }
    case 'spin': {
      P.yaw = b ? b.a - 0.4 : pose.yaw + clamp(t, 0, 1) * TAU
      P.lean = 0.1
      P.rf = 2.4; P.lf = -2.4
      P.rise = -1
      P.fly = 1
      if (b) { hold(b.a, 1); P.twist = 0; P.turn = 0; P.hr = 12.5 } else { P.rhf = 9; P.rhr = 5; P.rhz = 6.5 }
      P.lhf = -3; P.lhr = -10.8; P.lhz = 6
      break
    }
    case 'lift': {
      const e = ease(t)
      P.rise = -Math.round(3 * (1 - e))
      P.lean = 0.55 * (1 - e)
      handsUp(9 + 3 * Math.sin(e * Math.PI) - 8.5 * e, 4 + 7.6 * e, -3.5 + 23.5 * e)
      P.rf = 1.5 * (1 - e); P.lf = -1.5 * (1 - e)
      break
    }
    case 'carry': {
      handsUp(0.5, 11.6, 20)
      if (pose.moving) { stride(phase(t), 3.8, 0); P.fly = 0.4 }
      break
    }
    case 'push': {
      P.lean = 0.3
      handsUp(10.4, 3.8, 7)
      P.lf = -2.6; P.rf = 1
      stride(phase(t), 2.4, 0)
      P.fly = 0.2
      break
    }
    case 'use': {
      const e = t < 0.25 ? ease(t / 0.25) : 1 - 0.35 * ease((t - 0.25) / 0.75)
      P.lean = 0.14 * e
      P.twist = -0.3 * e
      P.turn = 0.15 * e
      P.rhf += (12.5 - P.rhf) * e; P.rhr += (3.6 - P.rhr) * e; P.rhz += (7.6 - P.rhz) * e
      P.lhf -= 2.6 * e; P.lhz += 2 * e
      P.rf = 2.4 * e; P.lf = -1.6 * e
      P.fly = 0.5 * e
      break
    }
    case 'get': {
      P.yaw = Math.PI / 4
      handsUp(0.8, 8.8, 27.5, ease(t / 0.15))
      if (t > 0.04 && t < 0.2) P.rise = 1
      P.mouth = 2
      break
    }
    case 'hurt': {
      const k = 1 - 0.4 * ease(t)
      P.lean = -0.34 * k
      P.nod = -0.12 * k
      P.roll = 0.08 * k
      handsUp(-1.5, 11.6, 9 + 2 * k)
      P.lf = 2.6 * k; P.lz = 1.6 * k; P.rf = -1.6 * k
      P.fly = 0.9
      P.eyes = 2
      P.mouth = 1
      break
    }
    case 'fall': {
      const k = clamp(t, 0, 1)
      P.yaw = pose.yaw + k * 2 * TAU
      SC = 1 - k
      handsUp(0.5, 10, 19)
      P.lf = 1.5; P.rf = -1.5
      P.fly = 1.3
      P.mouth = 1
      break
    }
    case 'dead': {
      // Round twice to face the viewer, then over on its side, the head to the right of the screen, where the classic figure lies.
      const k = clamp(t / 0.5, 0, 1)
      const turn = wrap(Math.PI / 4 - pose.yaw) + 2 * TAU
      const e = ease((k - 0.55) / 0.45)
      P.yaw = pose.yaw + turn * ease(k / 0.7)
      P.lie = e * Math.PI / 2
      P.ox = -Math.sin(P.yaw) * 15 * e
      P.oy = Math.cos(P.yaw) * 15 * e
      P.oz = 7.5 * e
      const up = 3 * (1 - e) * Math.sin(k * Math.PI)
      P.lhf = REST_F + 4 * e; P.lhr = -REST_R + 3.5 * e; P.lhz = REST_Z + up + 3 * e
      P.rhf = REST_F + 2 * e; P.rhr = REST_R + 1.5 * e; P.rhz = REST_Z + up + 1.5 * e
      P.lf = 1.5 * e; P.rf = -1 * e
      P.fly = 1 - e
      P.eyes = k < 0.55 ? 2 : 0
      P.mouth = k < 0.55 ? 1 : 0
      break
    }
  }
}

// ---------------------------------------------------------------------------
// The figure, part by part
// ---------------------------------------------------------------------------

/** Something that hangs from the head in two joints: from (f, r, z) out along (of, or), bending down by `a1` then `a2`. */
function streamer(fr: Frame, f: number, r: number, z: number, of: number, or: number, l1: number, l2: number, rad: number, a1: number, a2: number, mat: number, grp: number) {
  pt(fr, f, r, z)
  const u0 = pu, v0 = pv, d0 = pd
  const c1 = Math.cos(a1) * l1
  const f1 = f + of * c1
  const r1 = r + or * c1
  const z1 = z - Math.sin(a1) * l1
  pt(fr, f1, r1, z1)
  const u1 = pu, v1 = pv, d1 = pd
  cap(u0, v0, d0, u1, v1, d1, rad, mat, mat, 2, grp)
  const c2 = Math.cos(a2) * l2
  pt(fr, f1 + of * c2, r1 + or * c2, z1 - Math.sin(a2) * l2)
  cap(u1, v1, d1, pu, pv, pd, rad, mat, mat, 2, grp)
}

function leg(side: number, ff: number, fz: number, look: HeroLook, grp: number) {
  pt(fRoot, 0, side * 3.2, HIP - 0.5 + P.rise * PX)
  const hu = pu, hv = pv, hd = pd
  pt(fRoot, ff, side * 3.7, fz + 2.6)
  const bare = look.bottom === 'skirt' || look.bottom === 'dress'
  cap(hu, hv, hd, pu, pv, pd, 2.8, bare ? SKIN : BOTTOM, SKIN, look.bottom === 'shorts' ? 0.5 : 2, grp)
  ell(fRoot, ff + 0.9, side * 3.7, fz + 2, 3.4, 2.9, 2, SHOES, grp, PLAIN, true)
}

/** An arm from a shoulder (in the torso's frame) to a hand at a camera point: a sleeve and a fist. */
function arm(side: number, hu: number, hv: number, hd: number, grp: number) {
  pt(fTorso, 0.3, side * 6.7, 7.2)
  const su = pu, sv = pv, sd = pd
  cap(su, sv, sd, su + (hu - su) * 0.8, sv + (hv - sv) * 0.8, sd + (hd - sd) * 0.8, 2, TOP, TOP, 2, grp)
  const u = Math.round(hu)
  const v = Math.round(hv)
  cap(u, v, hd, u, v, hd, 2.3, SKIN, SKIN, 2, grp)
}

function build(look: HeroLook, b: FigureBlade | undefined) {
  // The legs stand in the root frame; the torso turns and leans on the hips; the head sits on the torso.
  ground(P.ox, P.oy, P.oz)
  setFrame(fRoot, P.yaw, 0, -P.lie, pu, pv, pd)
  pt(fRoot, 0, 0, HIP + P.rise * PX)
  setFrame(fTorso, P.yaw + P.twist, P.lean, P.roll - P.lie, pu, pv, pd)
  pt(fTorso, 0.4, 0, 16.6)
  setFrame(fHead, P.yaw + P.twist + P.turn, P.lean * 0.5 + P.nod, P.roll * 0.5 - P.lie, pu, pv, pd)

  leg(-1, P.lf, P.lz, look, G_LEG_L)
  leg(1, P.rf, P.rz, look, G_LEG_R)

  ell(fTorso, 0.2, 0, 4.4, 5.7, 6.9, 6.2, TOP, G_TORSO, K_TORSO)
  if (look.bottom === 'skirt') {
    hemZ = 0.9
    ell(fRoot, 0, 0, 5.4 + P.rise * PX, 7.1, 8.4, 5.4, BOTTOM, G_TORSO, K_DOME)
  } else if (look.bottom === 'dress') {
    hemZ = 0.5
    ell(fRoot, 0, 0, 4 + P.rise * PX, 7.4, 8.7, 6.8, TOP, G_TORSO, K_DOME)
  }

  pt(fTorso, P.lhf, P.lhr, P.lhz)
  arm(-1, pu, pv, pd, G_ARM_L)
  if (P.blade) ground(Math.cos(P.ba) * P.hr, Math.sin(P.ba) * P.hr, HAND_Z)
  else pt(fTorso, P.rhf, P.rhr, P.rhz)
  arm(1, pu, pv, pd, G_ARM_R)

  // The head: the face inside, the hair over it with a window for the face.
  ell(fHead, 0.8, 0, -1.1, 8.2, 8.9, 7, SKIN, G_HEAD)
  bandOn = look.head === 'band'
  ell(fHead, -1.4, 0, 0.7, 9.3, 9.9, 8.1, HAIR, G_HEAD, K_HAIR)

  const hang = 0.5 - 0.5 * P.fly + P.bounce * 0.2
  const lag = 1.35 - 1.1 * P.fly - P.bounce * 0.4
  const sway = P.bounce * P.fly
  if (look.hair === 'long') {
    ell(fHead, -4.6 - 0.6 * P.fly - 0.5 * sway, 0, -5.5 + 0.8 * P.fly, 5, 10.5, 9.5, HAIR, G_HEAD)
  } else if (look.hair === 'tail') {
    ell(fHead, -5, 0, 7.7, 2.4, 2.4, 2.2, HAIR, G_HEAD)
    streamer(fHead, -7.6, 0, 6.4, -1, 0, 5, 5.5, 2.3, hang + 0.5, lag + 0.2, HAIR, G_TAIL)
  } else if (look.hair === 'pigtails') {
    for (let s = -1; s <= 1; s += 2) {
      pt(fHead, -0.5, s * 9.7, -1)
      const u = pu, v = pv, d = pd
      pt(fHead, -1 - 3 * P.fly - sway, s * (11.3 + 1.2 * P.fly), -6 + 2.2 * P.fly + 0.6 * sway)
      cap(u, v, d, pu, pv, pd, 2.5, HAIR, HAIR, 2, G_TAIL)
    }
  }
  if (look.head === 'band' && look.hair === 'short') {
    // The knot behind the left ear and its two tails, so the band flies to one side from the front.
    streamer(fHead, -4.4, -8.7, 4, -0.45, -0.89, 3.4, 3.4, 1.15, hang, lag, BAND, G_TAIL)
    streamer(fHead, -5.6, -8, 3.6, -0.8, -0.6, 2.4, 2.8, 1.15, hang + 0.5, lag + 0.2, BAND, G_TAIL)
  } else if (look.head === 'bow') {
    // Two loops standing on the crown with the knot low between them, so the bow keeps its notch.
    ell(fHead, 0.4, -4.4, 9.3, 1.8, 3.2, 3.1, BAND, G_HEAD)
    ell(fHead, 0.4, 4.4, 9.3, 1.8, 3.2, 3.1, BAND, G_HEAD)
    ell(fHead, 0.8, 0, 8.3, 1.7, 1.6, 1.6, BAND, G_HEAD)
  }

  if (P.blade && b) sword(b)
}

/** The sword in the hand: grip and pommel, the guard across, the blade out to the tip. */
function sword(b: FigureBlade) {
  const ca = Math.cos(P.ba)
  const sa = Math.sin(P.ba)
  const reach = Math.max(0.6, b.reach) * GROUND
  ground(ca * P.hr, sa * P.hr, HAND_Z)
  const hu = Math.floor(pu) + 0.5
  const hv = Math.floor(pv) + 0.5
  const hd = pd
  ground(ca * reach, sa * reach, HAND_Z)
  const tu = Math.floor(pu) + 0.5
  const tv = Math.floor(pv) + 0.5
  const td = pd
  const len = Math.hypot(tu - hu, tv - hv) || 1
  const ex = (tu - hu) / len
  const ey = (tv - hv) / len
  const ez = (td - hd) / len
  const hot = b.charge >= 0.5
  const edge = hot ? EDGE_HOT : EDGE
  const core = 0.6 + 0.7 * clamp(b.charge, 0, 1)
  // Pommel and grip run through the fist.
  bar(hu - ex * 3, hv - ey * 3, hd - ez * 3, hu + ex * 2, hv + ey * 2, hd + ez * 2, 1.1, 1.1, 0, GRIP, GRIP, 2, 2)
  bar(hu - ex * 3.5, hv - ey * 3.5, hd - ez * 3.5, hu - ex * 3.5, hv - ey * 3.5, hd - ez * 3.5, 1.2, 1.2, 0, GUARD, GUARD, 2, 2)
  // The guard lies across the blade on the ground plane.
  const gr = P.hr + 4.2
  ground(ca * gr - sa * 3.6, sa * gr + ca * 3.6, HAND_Z)
  const g0u = pu, g0v = pv, g0d = pd
  ground(ca * gr + sa * 3.6, sa * gr - ca * 3.6, HAND_Z)
  bar(g0u, g0v, g0d + 0.3, pu, pv, pd + 0.3, 1.2, 1.2, 0, GUARD, GUARD, 2, 2)
  // The blade: three px of steel, drawn to a point over its last five.
  const from = 3.5
  const neck = Math.max(from, len - 5)
  bar(hu + ex * from, hv + ey * from, hd + ez * from, hu + ex * neck, hv + ey * neck, hd + ez * neck, 1.55, 1.55, core, edge, STEEL, hot ? 3 : 2, 2)
  bar(hu + ex * neck, hv + ey * neck, hd + ez * neck, tu, tv, td, 1.55, 0.55, core, edge, STEEL, hot ? 3 : 2, 2)
}

// ---------------------------------------------------------------------------
// From the bench to the sprite
// ---------------------------------------------------------------------------

/**
 * Whether part `a`, `dz` nearer than part `b` beside it, casts a dark line on
 * `b`: any part that stands clearly in front does, and the head on whatever
 * it hangs over.
 */
function over(a: number, b: number, dz: number): boolean {
  return a !== b && dz > (a === G_HEAD ? 0 : 1)
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

function put(o: FigureSprite, i: number, m: number, t: number) {
  const c = (m * 4 + t) * 3
  const j = i * 4
  o.albedo[j] = pal[c]
  o.albedo[j + 1] = pal[c + 1]
  o.albedo[j + 2] = pal[c + 2]
  o.albedo[j + 3] = 255
  o.normal[j] = nx[i] * 127.5 + 127.5
  o.normal[j + 1] = ny[i] * 127.5 + 127.5
  o.normal[j + 2] = nz[i] * 127.5 + 127.5
  o.normal[j + 3] = glow[m * 4 + t]
}

/** An eye or a mouth at a point of the head's frame, if that point of the face is in sight: w × h px, on skin only. */
function mark(f: number, r: number, z: number, w: number, h: number, m: number, t: number) {
  // How squarely this spot of the face looks at the viewer.
  const l = Math.hypot(f, r, z) || 1
  const facing = (f * fHead[2] + r * fHead[5] + z * fHead[8]) / l
  if (facing < 0.12) return
  pt(fHead, f, r, z)
  if (facing < 0.2) w = Math.min(w, 1)
  const y0 = Math.round(AY - pv - h / 2)
  // In profile the spot is on the face's very edge: it is drawn a px or two in, where an artist would put it.
  const inward = fHead[9] > pu ? 1 : -1
  for (let k = 0; k < 3; k++) {
    const x0 = Math.round(AX + pu - w / 2) + k * inward
    // A px of skin stays between the spot and the face's edge.
    const xe = inward > 0 ? x0 - 1 : x0 + w
    if (xe < 0 || xe >= W || y0 < 0 || y0 >= H || mt[y0 * W + xe] !== SKIN || gp[y0 * W + xe] !== G_HEAD) continue
    let done = false
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue
        const i = y * W + x
        if (mt[i] !== SKIN || gp[i] !== G_HEAD || Math.abs(zb[i] - pd) > 4) continue
        mt[i] = m
        tn[i] = t
        fx[i] = 1
        done = true
      }
    }
    if (done) return
  }
}

function face() {
  if (SC < 0.6) return
  const er = 3.3
  const ef = 8.4
  const ez = -0.5
  if (P.eyes === 0) {
    mark(ef, -er, ez, 2, 2, EYE, 2)
    mark(ef, er, ez, 2, 2, EYE, 2)
  } else if (P.eyes === 1) {
    mark(ef, -er, ez - 0.4, 2, 1, EYE, 2)
    mark(ef, er, ez - 0.4, 2, 1, EYE, 2)
  } else {
    mark(ef, -er, ez, 2, 1, EYE, 3)
    mark(ef, er, ez, 2, 1, EYE, 3)
  }
  if (P.mouth === 1) mark(8.6, 0, -3.9, 2, 2, MOUTH, 0)
  else if (P.mouth === 2) mark(8.6, 0, -4, 2, 1, MOUTH, 2)
}

/** The trail: a crescent in the blade's plane from the oldest angle to the blade, thinning and fading toward its tail. */
function trail(o: FigureSprite, b: FigureBlade) {
  let sweep = 0
  let last = b.a
  for (let k = 0; k < b.trail.length; k++) {
    sweep += wrap(last - b.trail[k])
    last = b.trail[k]
  }
  const dir = sweep < 0 ? -1 : 1
  const span = Math.min(Math.abs(sweep), TAU * 0.92)
  if (span < 0.06) return
  const ro = Math.max(0.6, b.reach) * GROUND
  const w0 = ro * 0.42
  // The box of the crescent: its outer arc, and its inner edge where it is widest.
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9
  const n = Math.ceil(span / 0.12) + 1
  for (let k = 0; k <= n; k++) {
    const q = k / n
    const a = b.a - dir * span * q
    for (let e = 0; e < 2; e++) {
      const r = e ? ro - w0 * (1 - q) : ro
      ground(Math.cos(a) * r, Math.sin(a) * r, HAND_Z)
      if (pu < u0) u0 = pu
      if (pu > u1) u1 = pu
      if (pv < v0) v0 = pv
      if (pv > v1) v1 = pv
    }
  }
  const x0 = Math.max(0, Math.floor(AX + u0))
  const x1 = Math.min(W, Math.ceil(AX + u1) + 1)
  const y0 = Math.max(0, Math.floor(AY - v1))
  const y1 = Math.min(H, Math.ceil(AY - v0) + 1)
  const arc = b.kind === 'arc'
  let hit = false
  for (let y = y0; y < y1; y++) {
    const v = AY - (y + 0.5)
    // Back from the screen to the blade's plane: x + y and x − y of the ground point.
    const sum = (CE * HAND_Z - v) / (SE * S2)
    const depth = CE * S2 * sum + SE * HAND_Z
    for (let x = x0; x < x1; x++) {
      const dif = (x + 0.5 - AX) / S2
      const gx = (sum + dif) / 2
      const gy = (sum - dif) / 2
      const rr = gx * gx + gy * gy
      if (rr > ro * ro || rr < (ro - w0) * (ro - w0)) continue
      let back = (b.a - Math.atan2(gy, gx)) * dir
      back -= Math.floor(back / TAU) * TAU
      if (back > span) continue
      const q = back / span
      const wd = w0 * (1 - q) ** 0.75
      const rad = Math.sqrt(rr)
      if (wd < 3.2 || rad < ro - wd) continue
      const i = y * W + x
      if (depth < zb[i]) continue
      // Where in the crescent: 1 on the outer rim, 0 on the inner edge.
      const rim = (rad - (ro - wd)) / wd
      const al = q < 0.2 ? 232 : q < 0.45 ? 176 : q < 0.7 ? 120 : 68
      const j = i * 4
      if (mt[i] || o.albedo[j + 3]) {
        // Over the body the trail is laid as a dither of whole pixels, so the body is not thinned by it.
        if (al / 255 * 16 <= BAYER[(y & 3) * 4 + (x & 3)] + 0.5) continue
      }
      const bright = rim > 0.72 && q < 0.4 ? 2 : rim > 0.3 || q < 0.12 ? 1 : 0
      const c = arc
        ? (bright === 2 ? 0xfff6c8 : bright === 1 ? 0xffd23f : 0xff9a2a)
        : (bright === 2 ? 0xd8ffff : bright === 1 ? 0x2ff3ff : 0x2a8cff)
      o.albedo[j] = c >> 16
      o.albedo[j + 1] = (c >> 8) & 255
      o.albedo[j + 2] = c & 255
      o.albedo[j + 3] = mt[i] || o.albedo[j + 3] === 255 ? 255 : al
      o.normal[j] = 127
      o.normal[j + 1] = 204
      o.normal[j + 2] = 230
      o.normal[j + 3] = Math.min(230, al)
      hit = true
    }
  }
  if (hit) grow(x0, y0, x1, y1)
}

/** A four-point spark at the blade's tip. */
function spark(o: FigureSprite, b: FigureBlade) {
  const reach = Math.max(0.6, b.reach) * GROUND
  ground(Math.cos(b.a) * reach, Math.sin(b.a) * reach, HAND_Z)
  const cx = Math.floor(AX + pu)
  const cy = Math.floor(AY - pv)
  for (let k = -4; k <= 4; k++) {
    for (let e = 0; e < 2; e++) {
      const x = e ? cx : cx + k
      const y = e ? cy + k : cy
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const i = y * W + x
      if (pd + 1 < zb[i]) continue
      nx[i] = 0; ny[i] = 0; nz[i] = 1
      put(o, i, SPARK, Math.abs(k) <= 1 ? 3 : Math.abs(k) <= 3 ? 2 : 1)
      grow(x, y, x + 1, y + 1)
    }
  }
}

function finish(o: FigureSprite, pose: FigurePose) {
  const b = P.blade ? pose.blade : undefined
  if (bx0 < bx1) {
    // Room for the outline.
    bx0 = Math.max(0, bx0 - 1); by0 = Math.max(0, by0 - 1)
    bx1 = Math.min(W, bx1 + 1); by1 = Math.min(H, by1 + 1)
    const x0 = bx0, y0 = by0, x1 = bx1, y1 = by1
    // A pixel that sticks out alone is filed off.
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * W + x
        if (!mt[i] || fx[i]) continue
        let n = 0
        if (x > 0 && mt[i - 1]) n++
        if (x < W - 1 && mt[i + 1]) n++
        if (y > 0 && mt[i - W]) n++
        if (y < H - 1 && mt[i + W]) n++
        if (n <= 1) { mt[i] = 0; zb[i] = FAR }
      }
    }
    // The baked steps, and the dark line where another part stands in front.
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * W + x
        const m = mt[i]
        if (!m) continue
        const z = zb[i]
        const g = gp[i]
        const edge = (x > 0 && mt[i - 1] && over(gp[i - 1], g, zb[i - 1] - z))
          || (x < W - 1 && mt[i + 1] && over(gp[i + 1], g, zb[i + 1] - z))
          || (y > 0 && mt[i - W] && over(gp[i - W], g, zb[i - W] - z))
          || (y < H - 1 && mt[i + W] && over(gp[i + W], g, zb[i + W] - z))
        if (edge) { tn[i] = 0; continue }
        if (fx[i]) continue
        const l = nx[i] * LX + ny[i] * LY + nz[i] * LZ
        // The hair's light is a crescent: a round light with a bite out of it.
        tn[i] = l < shadeAt[m] ? 1 : l > lightAt[m] && (m !== HAIR || nx[i] * -0.1 + ny[i] * 0.62 + nz[i] * 0.78 < 0.93) ? 3 : 2
      }
    }
    // A pixel unlike all its neighbours joins one of them.
    for (let y = y0 + 1; y < y1 - 1; y++) {
      for (let x = x0 + 1; x < x1 - 1; x++) {
        const i = y * W + x
        const m = mt[i]
        if (!m || fx[i]) continue
        const k = m * 4 + tn[i]
        const a = mt[i - 1] * 4 + tn[i - 1]
        const c = mt[i + 1] * 4 + tn[i + 1]
        const d = mt[i - W] * 4 + tn[i - W]
        const e = mt[i + W] * 4 + tn[i + W]
        if (a === k || c === k || d === k || e === k) continue
        // Its own material in another tone first; else whatever is beside it.
        let j = -1
        if (mt[i - 1] === m) j = i - 1
        else if (mt[i + 1] === m) j = i + 1
        else if (mt[i - W] === m) j = i - W
        else if (mt[i + W] === m) j = i + W
        else if (a >= 4 && (a === c || a === d || a === e)) j = i - 1
        else if (c >= 4 && (c === d || c === e)) j = i + 1
        else if (d >= 4 && d === e) j = i - W
        if (j < 0 || fx[j]) continue
        mt[i] = mt[j]
        tn[i] = tn[j]
      }
    }
    face()
    // The outline: every empty pixel beside the figure, in the darkest tone of the nearest part it touches.
    let no = 0
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = y * W + x
        if (mt[i]) { put(o, i, mt[i], tn[i]); continue }
        let j = -1
        let z = FAR
        if (x > 0 && mt[i - 1] && zb[i - 1] > z) { j = i - 1; z = zb[j] }
        if (x < W - 1 && mt[i + 1] && zb[i + 1] > z) { j = i + 1; z = zb[j] }
        if (y > 0 && mt[i - W] && zb[i - W] > z) { j = i - W; z = zb[j] }
        if (y < H - 1 && mt[i + W] && zb[i + W] > z) { j = i + W; z = zb[j] }
        if (j < 0) continue
        olAt[no] = i
        olFrom[no++] = j
      }
    }
    for (let k = 0; k < no; k++) {
      const i = olAt[k]
      const j = olFrom[k]
      nx[i] = nx[j]; ny[i] = ny[j]; nz[i] = nz[j]
      const m = mt[j]
      put(o, i, m === EYE || m === MOUTH ? SKIN : m, 0)
    }
    // The outline is as near as what it goes round, so a trail behind the figure stays behind its outline too.
    for (let k = 0; k < no; k++) zb[olAt[k]] = zb[olFrom[k]]
  }
  if (b) {
    if (b.trail.length) trail(o, b)
    if (b.flash && b.charge > 0) spark(o, b)
  }
  if (bx0 < bx1) { o.box[0] = bx0; o.box[1] = by0; o.box[2] = bx1; o.box[3] = by1 } else { o.box[0] = 0; o.box[1] = 0; o.box[2] = 0; o.box[3] = 0 }
}

/** Render one frame. Reuses `out`'s arrays when given (clear only what the last frame touched). No DOM, no canvas: plain typed arrays. Deterministic. */
export function renderFigure(pose: FigurePose, look: HeroLook, out?: FigureSprite): FigureSprite {
  const o: FigureSprite = out ?? { w: W, h: H, ax: AX, ay: AY, albedo: new Uint8ClampedArray(N * 4), normal: new Uint8ClampedArray(N * 4), box: [0, 0, 0, 0] }
  // The bench, where the last frame (of any sprite) stood on it.
  for (let y = by0; y < by1; y++) {
    const a = y * W + bx0
    const e = y * W + bx1
    zb.fill(FAR, a, e)
    mt.fill(0, a, e)
    fx.fill(0, a, e)
  }
  bx0 = W; by0 = H; bx1 = 0; by1 = 0
  // The sprite, where its own last frame stood.
  const [ox0, oy0, ox1, oy1] = o.box
  for (let y = oy0; y < oy1; y++) {
    o.albedo.fill(0, (y * W + ox0) * 4, (y * W + ox1) * 4)
    o.normal.fill(0, (y * W + ox0) * 4, (y * W + ox1) * 4)
  }
  usePalette(look, pose.blade?.kind === 'arc')
  solve(pose)
  if (SC > 0.04) build(look, pose.blade)
  finish(o, pose)
  return o
}
