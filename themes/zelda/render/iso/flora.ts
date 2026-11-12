/**
 * The plants of the 16-bit view, painted at twice the classic density (a tile
 * is 32 px): trees with crowns that hang over their trunks, forest trees for
 * the dense woods, bushes, tall grass, ground tufts, glowing flowers, reeds
 * and palms. The engine stands them up as cards, lights them per pixel from
 * the normal picture and lets the wind move them.
 *
 * Nothing here is drawn by hand pixel for pixel, but every plant is built the
 * way a 16-bit forest was: a height field first (round leaf clumps on a round
 * crown, a cylinder for the trunk, bent blades), then a ramp of six or seven
 * colours whose shadows drift to indigo and whose lights drift to mint, cut
 * into clean bands, with the lone pixels tidied away, a dark line on the
 * shaded side only, and a few warm pixels where the low sun catches the west
 * edge. The colours are the classic view's (`tiles.ts`: teal crowns, moonlit
 * violet ones, plum trunks), with more steps between them.
 *
 * `buildFlora(look)` is seeded, so a look always gives the same pictures, and
 * each look is built once.
 */
import { makeCanvas } from '../sheet'

export interface FloraSprite { x: number; y: number; w: number; h: number; /** the point that stands on the ground, px from the rect's top-left */ ax: number; ay: number }
export interface FloraAtlas { albedo: HTMLCanvasElement; normal: HTMLCanvasElement; sprites: Record<FloraKind, FloraSprite[]> }
export type FloraLook = 'coast' | 'wild' | 'beach'
export type FloraKind = 'tree' | 'canopy' | 'bush' | 'tall' | 'tuft' | 'flowerPink' | 'flowerCyan' | 'reed' | 'palm'

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

type Rgb = readonly [number, number, number]
/** Dark to light. [0] is the outline and is never a shade of the form. */
type Ramp = readonly Rgb[]

function rgb(s: string): Rgb {
  const v = parseInt(s.slice(1, 7), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
const ramp = (...c: string[]): Ramp => c.map(rgb)
/** Step by step from one ramp to another of the same length. */
function blend(a: Ramp, b: Ramp, t: number): Ramp {
  return a.map((c, i) => [0, 1, 2].map(k => Math.round(c[k] + (b[i][k] - c[k]) * t)) as unknown as Rgb)
}
/** A ramp turned down for the deep woods: darker, and its dark end more violet. */
function dusk(a: Ramp, k: number): Ramp {
  return a.map((c, i) => {
    const v = 1 - i / (a.length - 1)
    return [Math.round(c[0] * k + 10 * v), Math.round(c[1] * (k - 0.06 * v)), Math.round(c[2] * k + 8 * v)] as unknown as Rgb
  })
}

// The classic crowns are '#0f3445' '#1b5763' '#2a8579' '#5fd6b8'; the moonlit ones '#1a1f4c' '#27366e' '#3f58a4' '#86a2ff'.
const TEAL = ramp('#0b1830', '#0f2a47', '#124158', '#1a5c66', '#278374', '#48b391', '#86e6bb')
const MOON = ramp('#0d0f2e', '#15174a', '#1e2a68', '#2b4290', '#4266b8', '#6c90e0', '#a9c4ff')
const LIME = ramp('#0f1a2e', '#123040', '#16504c', '#22745a', '#3f9c64', '#7cc86e', '#c4ee8c')
const SHRUB = ramp('#0b1f30', '#0f3540', '#145049', '#1f7468', '#359c84', '#5cc7a0', '#9cecc4')
const BARK = ramp('#140a1e', '#24142c', '#3a2240', '#573058', '#7a4a6e', '#a86c84', '#d49a9c')
const HUSK = ramp('#1a0e1c', '#30192a', '#4f2a38', '#74414a', '#9c6058', '#c88a6c', '#ecba8c')
const GRASS = ramp('#102a48', '#15465a', '#1f6c80', '#35969e', '#5cc8be', '#a4f2dc')
const DUNE = ramp('#14203a', '#1f4a52', '#3a7460', '#6a9c6c', '#a8c47c', '#e4e8a4')
const HEAD = ramp('#1c0d24', '#3a1c3a', '#6e3552', '#a8566e', '#e08a8a')

const PINK = { deep: rgb('#c93aa6'), main: rgb('#ff5fd0'), light: rgb('#ff9ae4'), core: rgb('#fff4ff') }
const CYAN = { deep: rgb('#2ab8d8'), main: rgb('#6ff6ff'), light: rgb('#b4fbff'), core: rgb('#f4ffff') }
type Neon = typeof PINK

interface Look {
  /** Crown colours, one ramp per variant of a tree. */
  leaf: Ramp[]
  shrub: Ramp
  bark: Ramp
  grass: Ramp
  frond: Ramp
  husk: Ramp
  /** The low sun on a west edge, and its hottest pixel. */
  rim: Rgb
  hot: Rgb
  /** More and smaller clumps in a crown. */
  dense: number
  /** Light of its own on bark and under the leaves (the Wildwood), or none. */
  glow: Neon | null
}

const LOOKS: Record<FloraLook, Look> = {
  coast: {
    leaf: [TEAL, blend(TEAL, MOON, 0.14), blend(TEAL, SHRUB, 0.5), blend(TEAL, MOON, 0.3)],
    shrub: SHRUB, bark: BARK, grass: GRASS, frond: blend(TEAL, LIME, 0.5), husk: HUSK,
    rim: rgb('#d0509e'), hot: rgb('#ff8a5a'), dense: 1, glow: null,
  },
  wild: {
    leaf: [dusk(blend(TEAL, MOON, 0.55), 0.9), dusk(blend(TEAL, MOON, 0.72), 0.9), dusk(blend(TEAL, MOON, 0.4), 0.88), dusk(blend(TEAL, MOON, 0.9), 0.92)],
    shrub: dusk(blend(SHRUB, MOON, 0.35), 0.9), bark: dusk(BARK, 0.86), grass: dusk(blend(GRASS, MOON.slice(0, 6), 0.25), 0.92),
    frond: dusk(blend(TEAL, MOON, 0.3), 0.9), husk: dusk(HUSK, 0.85),
    rim: rgb('#b04fc8'), hot: rgb('#ff7ad0'), dense: 1.25, glow: { deep: rgb('#1f9c8c'), main: rgb('#3fd8b0'), light: rgb('#8ffce0'), core: rgb('#eafff8') },
  },
  beach: {
    leaf: [blend(TEAL, LIME, 0.6), blend(TEAL, LIME, 0.75), blend(TEAL, LIME, 0.5), blend(TEAL, LIME, 0.9)],
    shrub: blend(SHRUB, LIME, 0.6), bark: blend(BARK, HUSK, 0.6), grass: blend(GRASS, DUNE, 0.7), frond: LIME, husk: HUSK,
    rim: rgb('#ff6f9a'), hot: rgb('#ffb05a'), dense: 0.95, glow: null,
  },
}

// ---------------------------------------------------------------------------
// A plant on the bench: what every pixel is before it has a colour
// ---------------------------------------------------------------------------

const NONE = -1e6

interface Plot {
  w: number
  h: number
  /** Height toward the viewer, in px; NONE where there is no plant. */
  z: Float32Array
  nx: Float32Array
  ny: Float32Array
  nz: Float32Array
  /** Which of `ramps` paints the pixel. */
  ramp: Uint8Array
  /** Which clump, limb or blade the pixel belongs to. */
  part: Uint16Array
  /** Lighter or darker than the form says (bark grooves, a clump in the back). */
  bias: Float32Array
  /** A ramp step given by the painter and still open to shade (a leaf clump is one flat step with a lit cap); NaN: from the normal. */
  tone: Float32Array
  /** A ramp step chosen by the painter, plus one; 0 leaves it to the light. */
  pin: Uint8Array
  /** The ramp step every pixel ends on. */
  ix: Uint8Array
  /** A colour outside the ramps (a blossom, a rim pixel) as 0xrrggbb, or -1. */
  fix: Int32Array
  ramps: Ramp[]
  parts: number
}

function plot(w: number, h: number, ramps: Ramp[]): Plot {
  const n = w * h
  return {
    w, h, z: new Float32Array(n).fill(NONE), nx: new Float32Array(n), ny: new Float32Array(n), nz: new Float32Array(n).fill(1),
    ramp: new Uint8Array(n), part: new Uint16Array(n), bias: new Float32Array(n), tone: new Float32Array(n).fill(NaN), pin: new Uint8Array(n), ix: new Uint8Array(n),
    fix: new Int32Array(n).fill(-1), ramps, parts: 0,
  }
}

/** Seeded numbers in 0..1 (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)
const packed = (c: Rgb) => (c[0] << 16) | (c[1] << 8) | c[2]

/** One pixel of a part, if nothing nearer the viewer is there already. */
function put(p: Plot, x: number, y: number, z: number, rampId: number, nx: number, ny: number, nz: number, part: number, pin = 0, bias = 0, tone = NaN): void {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return
  const i = y * p.w + x
  if (z < p.z[i]) return
  const l = Math.hypot(nx, ny, nz) || 1
  p.z[i] = z
  p.nx[i] = nx / l
  p.ny[i] = ny / l
  p.nz[i] = nz / l
  p.ramp[i] = rampId
  p.part[i] = part
  p.pin[i] = pin
  p.bias[i] = bias
  p.tone[i] = tone
  p.fix[i] = -1
}

/** A round mass: a whole crown, or one bough of it. Where it is, how far it bulges (rz) and how near the viewer it sits (z). */
interface Lobe { cx: number; cy: number; rx: number; ry: number; rz: number; z: number }

/** The lobe's normal at a point, as on half a ball; past the edge it stays the edge's. */
function lobeNormal(l: Lobe, x: number, y: number): [number, number, number] {
  const ex = (x - l.cx) / l.rx
  const ey = (y - l.cy) / l.ry
  const d2 = ex * ex + ey * ey
  const e2 = Math.min(0.92, d2)
  const k = Math.sqrt(e2 / Math.max(1e-6, d2))
  return [ex * k, -ey * k, Math.sqrt(1 - e2)]
}

/** How near the viewer the lobe's skin is at a point. Seen from a little above, its lower half is the near one. */
function lobeDepth(l: Lobe, x: number, y: number): number {
  const ex = (x - l.cx) / l.rx
  const ey = (y - l.cy) / l.ry - 0.24
  return l.z + l.rz * Math.sqrt(Math.max(0, 1 - ex * ex - ey * ey))
}

/**
 * A leaf clump on a bough. The bough gives the shade (light on top, dark
 * under, in clean bands); the clump gives the leaf: a lit cap on its upper
 * west side (`capR` is how big, 0 for none), a darker lip under it, the way
 * a 16-bit crown is clustered. Its normal is its own roundness on the
 * bough's on the crown's.
 */
function leafClump(p: Plot, cx: number, cy: number, r: number, z0: number, rampId: number, lift: number, capR: number, gamma: number, bough: Lobe, mass: Lobe): void {
  const id = ++p.parts
  const top = p.ramps[rampId].length - 1
  const rx = r * 1.08
  const ry = r * 0.88
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx
    const dy = (y + 0.5 - cy) / ry
    const d2 = dx * dx + dy * dy
    if (d2 > 1) continue
    const s = Math.sqrt(1 - d2)
    // The cap is a small round light high on the clump's west shoulder; the lip is its underside.
    const cap = (dx + 0.28) * (dx + 0.28) + (dy + 0.52) * (dy + 0.52) < capR
    const lip = dx * 0.3 + dy * 0.95 > 0.72
    const b = lobeNormal(bough, x + 0.5, y + 0.5)
    const m = lobeNormal(mass, x + 0.5, y + 0.5)
    let nx = b[0] * 0.75 + m[0] * 0.5
    let ny = b[1] * 0.75 + m[1] * 0.5
    let nz = b[2] * 0.75 + m[2] * 0.5
    const l = Math.hypot(nx, ny, nz)
    nx /= l; ny /= l; nz /= l
    const t = 0.5 + 0.5 * (nx * SKY[0] + ny * SKY[1] + nz * SKY[2])
    const step = 1.35 + (top - 2.1) * Math.pow(clamp((t - 0.24) / 0.7, 0, 1), gamma) + lift
    put(
      p, x, y, z0 + r * 0.5 * s, rampId,
      dx * 0.5 + b[0] * 0.5 + m[0] * 0.38, -dy * 0.5 + b[1] * 0.5 + m[1] * 0.38, Math.max(0.15, s) * 0.5 + b[2] * 0.5 + m[2] * 0.38,
      id, 0, 0, step + (cap ? 1 : lip ? -1 : 0),
    )
  }
}

/**
 * A leaf clump: half an ellipsoid bulging toward the viewer. On a lobe its
 * normal leans with the lobe's, so the crown is round as a whole and every
 * clump is round on it.
 */
function clump(p: Plot, cx: number, cy: number, rx: number, ry: number, z0: number, zr: number, rampId: number, lobe: Lobe | null, bias = 0, join = 0): number {
  const id = join || ++p.parts
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx
    const dy = (y + 0.5 - cy) / ry
    const d2 = dx * dx + dy * dy
    if (d2 > 1) continue
    const s = Math.sqrt(1 - d2)
    let nx = dx
    let ny = -dy
    let nz = Math.max(0.12, s)
    if (lobe) {
      const ex = (x + 0.5 - lobe.cx) / lobe.rx
      const ey = (y + 0.5 - lobe.cy) / lobe.ry
      const e2 = Math.min(0.9, ex * ex + ey * ey)
      const k = Math.sqrt(e2 / Math.max(1e-6, ex * ex + ey * ey))
      nx = nx * 0.7 + ex * k * 0.5
      ny = ny * 0.7 - ey * k * 0.5
      nz = nz * 0.7 + Math.sqrt(1 - e2) * 0.5
    }
    put(p, x, y, z0 + zr * s, rampId, nx, ny, nz, id, 0, bias)
  }
  return id
}

/**
 * A limb: a round stick from one point to another, thicker at one end. With
 * `bark` it gets short grooves; with `ring` a dark ring every few px along it
 * (a palm's scars), counted from the arc length `ring`.
 */
function limb(
  p: Plot, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, z0: number, rampId: number,
  o: { bark?: boolean; ring?: number; bias?: number } = {},
): number {
  const id = ++p.parts
  const ax = x1 - x0
  const ay = y1 - y0
  const len2 = ax * ax + ay * ay || 1
  const len = Math.sqrt(len2)
  const rm = Math.max(r0, r1)
  for (let y = Math.floor(Math.min(y0, y1) - rm); y <= Math.ceil(Math.max(y0, y1) + rm); y++) {
    for (let x = Math.floor(Math.min(x0, x1) - rm); x <= Math.ceil(Math.max(x0, x1) + rm); x++) {
      const t = clamp(((x + 0.5 - x0) * ax + (y + 0.5 - y0) * ay) / len2, 0, 1)
      const dx = x + 0.5 - (x0 + ax * t)
      const dy = y + 0.5 - (y0 + ay * t)
      const d = Math.hypot(dx, dy)
      const r = r0 + (r1 - r0) * t
      if (d > r) continue
      const u = d / r
      const s = Math.sqrt(1 - u * u)
      let bias = o.bias ?? 0
      if (o.bark && ((y + x * 5) % 9) < 4 && x % 2 === 0 && u < 0.8) bias -= 0.17
      if (o.ring !== undefined) {
        const f = (o.ring + t * len) / 4
        if (f - Math.floor(f) < 0.3) bias -= 0.2
      }
      put(p, x, y, z0 + r * s * 0.8, rampId, d ? (dx / d) * u : 0, d ? (-dy / d) * u : 0, Math.max(0.15, s), id, 0, bias)
    }
  }
  return id
}

/**
 * A blade of grass (or a long leaf): one run of pixels per row from the root
 * up to the tip, `bend` px out of line in the middle, `w0` px wide at the
 * root and one at the tip. Its west side takes the step `hi`, its east side
 * `lo`, the tip one above `hi`: the sky's light, painted on.
 */
function blade(p: Plot, x0: number, y0: number, x1: number, y1: number, bend: number, w0: number, z0: number, rampId: number, lo: number, hi: number): number {
  const id = ++p.parts
  const rows = Math.max(1, Math.round(y0 - y1))
  const top = p.ramps[rampId].length - 1
  let last = NaN
  for (let k = 0; k <= rows; k++) {
    const t = k / rows
    const x = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * ((x0 + x1) / 2 + bend) + t * t * x1
    const y = Math.round(y0 - 0.5) - k
    const w = Math.max(1, Math.round(w0 * (1 - t * 0.9)))
    let a = Math.round(x - w / 2)
    let b = a + w - 1
    // A blade that leans far in one row is joined to the row under it.
    if (!Number.isNaN(last)) { if (a > last + 1) a = last + 1; if (b < last - 1) b = last - 1 }
    const lean = clamp((x1 - x0) / rows, -1, 1)
    for (let q = a; q <= b; q++) {
      const west = b === a ? t > 0.55 : q - a < (b - a + 1) / 2
      let step = west ? hi : lo
      if (t > 0.82) step = hi + 1
      if (t < 0.18) step = Math.max(1, step - 1)
      const side = b === a ? 0 : (q - a) / (b - a) * 2 - 1
      put(p, q, y, z0 + t * 0.2, rampId, side * 0.6 + lean * 0.5, 0.3 + t * 0.25, 0.8, id, clamp(step, 1, top) + 1)
    }
    last = a === b ? a : x1 > x0 ? b : a
  }
  return id
}

/** A hand-placed pixel in a colour of its own (a petal, a berry), facing the viewer and a little up. */
function spark(p: Plot, x: number, y: number, c: Rgb, z = 50): void {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return
  const i = y * p.w + x
  if (p.z[i] === NONE || z > p.z[i]) { put(p, x, y, Math.max(z, p.z[i]), p.ramp[i], 0, 0.45, 0.89, ++p.parts, 1) }
  p.fix[i] = packed(c)
}

/** Rows of letters as hand-placed pixels: a d(eep) m(ain) l(ight) c(ore) of a neon family, top-left at x, y. */
function stamp(p: Plot, x: number, y: number, rows: readonly string[], n: Neon, z = 50): void {
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i]
    const c = ch === 'd' ? n.deep : ch === 'm' ? n.main : ch === 'l' ? n.light : ch === 'c' ? n.core : null
    if (c) spark(p, x + i, y + j, c, z)
  }
}

/** Rows of digits as hand-placed pixels of one ramp (the digit is the step), top-left at x, y. */
function draw(p: Plot, x: number, y: number, rows: readonly string[], rampId: number, z = 12): void {
  const id = ++p.parts
  for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
    const step = rows[j].charCodeAt(i) - 48
    if (step >= 0 && step <= 9) put(p, x + i, y + j, z, rampId, (i / (rows[j].length - 1) - 0.5) * 0.8, 0.5, 0.8, id, step + 1)
  }
}

// ---------------------------------------------------------------------------
// From form to pixels
// ---------------------------------------------------------------------------

interface Ink {
  /** The dark line round the plant: on its own edge pixels, outside them, or none. */
  outline: 'in' | 'out' | 'none'
  /** How many px a clump's shade reaches down onto what is under it. */
  shadow: number
  /** Above 1 keeps the lights small. */
  gamma: number
  /** Steps taken off in the crease where a nearer clump covers this one from below (0: none). */
  crease?: number
  /** Steps taken off in the hollows between clumps and boughs, and given on their ridges (0: none). */
  hollow?: number
}

/** The sky the baked shading comes from: overhead, a little west, a little toward the viewer. */
const SKY = [-0.3, 0.8, 0.52]

/** Give every pixel its ramp step: light from the sky, shade under clumps, lone pixels tidied, then the line. */
function ink(p: Plot, o: Ink): void {
  const { w, h } = p
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? NONE : p.z[y * w + x])
  if (o.outline === 'in') {
    // A silhouette has no hairs and no pinholes.
    for (let pass = 0; pass < 2; pass++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      const n = +(at(x - 1, y) > NONE) + +(at(x + 1, y) > NONE) + +(at(x, y - 1) > NONE) + +(at(x, y + 1) > NONE)
      if (p.z[i] > NONE && n <= 1 && !p.pin[i]) p.z[i] = NONE
    }
  }
  // How far each pixel lies under (or stands over) the surface round it: the mean height of its neighbourhood.
  const dip = new Float32Array(w * h)
  if (o.hollow) {
    const HR = 3
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (p.z[i] === NONE) continue
      let sum = 0
      let n = 0
      for (let oy = -HR; oy <= HR; oy++) for (let ox = -HR; ox <= HR; ox++) {
        const q = at(x + ox, y + oy)
        if (q === NONE) continue
        sum += q
        n++
      }
      dip[i] = sum / n - p.z[i]
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (p.z[i] === NONE) continue
    const top = p.ramps[p.ramp[i]].length - 1
    if (p.pin[i]) { p.ix[i] = p.pin[i] - 1; continue }
    let s = p.tone[i]
    if (Number.isNaN(s)) {
      const t = 0.5 + 0.5 * (p.nx[i] * SKY[0] + p.ny[i] * SKY[1] + p.nz[i] * SKY[2])
      s = 1 + Math.pow(clamp((t - 0.2) / 0.8, 0, 1), o.gamma) * (top - 0.01)
    }
    for (let k = 1; k <= o.shadow; k++) {
      const q = at(x - Math.round(k * 0.4), y - k)
      if (q > p.z[i] + 0.8 * k + 0.6) { s -= 1.8 * (1 - (k - 1) / (o.shadow + 1)); break }
    }
    if (o.crease) {
      // The fold over a nearer clump's top is where the least light gets in.
      for (let k = 1; k <= 2; k++) {
        if (y + k >= h) break
        const j = (y + k) * w + x
        if (p.z[j] > p.z[i] + 0.7 && p.part[j] !== p.part[i]) { s -= o.crease / k; break }
      }
    }
    if (o.hollow) s -= clamp(dip[i] * 0.45, -0.5, 1) * o.hollow
    s += p.bias[i] * top
    p.ix[i] = clamp(Math.floor(s), 1, top)
  }
  // A pixel with no neighbour of its own step is noise: it joins its neighbours.
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (p.z[i] === NONE || p.pin[i]) continue
    let same = 0
    let sum = 0
    let n = 0
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (at(x + ox, y + oy) === NONE) continue
      const j = (y + oy) * w + x + ox
      if (p.ramp[j] !== p.ramp[i]) continue
      if (p.ix[j] === p.ix[i]) same++
      sum += p.ix[j]
      n++
    }
    if (!same && n) p.ix[i] = Math.round(sum / n)
  }
  if (o.outline === 'in') {
    const edge: number[] = []
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (p.z[i] === NONE || p.pin[i]) continue
      if (at(x - 1, y) > NONE && at(x + 1, y) > NONE && at(x, y - 1) > NONE && at(x, y + 1) > NONE) continue
      edge.push(i)
    }
    // The line is selective: dark under and east of the plant, a deeper shade of the leaf itself where the sky lights its edge.
    for (const i of edge) p.ix[i] = p.ny[i] > 0.3 && p.ix[i] >= 4 ? p.ix[i] - 2 : p.ny[i] > 0.1 && p.ix[i] >= 3 ? 1 : 0
  } else if (o.outline === 'out') {
    const add: Array<[number, number, number]> = []
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (p.z[y * w + x] > NONE) continue
      // Beside the plant only: a tip is light against the ground, and the foot stands on the ground, not on a line.
      const from = at(x - 1, y) > NONE ? y * w + x - 1 : at(x + 1, y) > NONE ? y * w + x + 1 : -1
      if (from < 0 || p.fix[from] >= 0) continue
      add.push([x, y, from])
    }
    for (const [x, y, from] of add) {
      const i = y * w + x
      p.z[i] = p.z[from] - 0.5
      p.nx[i] = p.nx[from]; p.ny[i] = p.ny[from]; p.nz[i] = p.nz[from]
      p.ramp[i] = p.ramp[from]
      p.part[i] = p.part[from]
      p.ix[i] = 0
    }
  }
}

/**
 * The low sun on the west edge: a few short runs of magenta down the plant's
 * left side, one hot pixel in each, only on the ramps named.
 */
function rimLight(p: Plot, L: Look, ramps: number[], gap: number): void {
  const { w, h } = p
  let run: number[] = []
  let count = 0
  const flush = () => {
    if (run.length >= 3 && count++ % gap === 0) {
      const n = Math.min(4, run.length - 1)
      const a = (run.length - n) >> 1
      for (let k = 0; k < n; k++) p.fix[run[a + k]] = packed(k === 1 && n > 2 ? L.hot : L.rim)
    }
    run = []
  }
  let lastX = -9
  for (let y = 0; y < h; y++) {
    let x = 0
    while (x < w && p.z[y * w + x] === NONE) x++
    const i = y * w + x
    if (x < w && ramps.includes(p.ramp[i]) && p.nx[i] < -0.3 && p.ny[i] > -0.45 && Math.abs(x - lastX) <= 1) run.push(i)
    else { flush(); if (x < w && ramps.includes(p.ramp[i]) && p.nx[i] < -0.3 && p.ny[i] > -0.45) run.push(i) }
    lastX = x
  }
  flush()
}

/** A finished plant, cut to what was painted. */
interface Cut { w: number; h: number; ax: number; ay: number; rgba: Uint8ClampedArray; norm: Uint8ClampedArray }

function cut(p: Plot, ax: number, ay: number): Cut {
  let x0 = p.w
  let y0 = p.h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (p.z[y * p.w + x] === NONE) continue
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 0 }
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const rgba = new Uint8ClampedArray(w * h * 4)
  const norm = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y + y0) * p.w + x + x0
    if (p.z[i] === NONE) continue
    const o = (y * w + x) * 4
    const f = p.fix[i]
    const c = p.ramps[p.ramp[i]][p.ix[i]]
    rgba[o] = f >= 0 ? (f >> 16) & 255 : c[0]
    rgba[o + 1] = f >= 0 ? (f >> 8) & 255 : c[1]
    rgba[o + 2] = f >= 0 ? f & 255 : c[2]
    rgba[o + 3] = 255
    norm[o] = Math.round((p.nx[i] * 0.5 + 0.5) * 255)
    norm[o + 1] = Math.round((p.ny[i] * 0.5 + 0.5) * 255)
    norm[o + 2] = Math.round((p.nz[i] * 0.5 + 0.5) * 255)
    norm[o + 3] = 255
  }
  return { w, h, ax: clamp(ax - x0, 0, w - 1), ay: clamp(ay - y0, 0, h - 1), rgba, norm }
}

// ---------------------------------------------------------------------------
// Trees and bushes
// ---------------------------------------------------------------------------

/**
 * A crown: boughs on a round mass, leaf clumps on every bough. The boughs
 * stand in a ring along the mass's edge (its scalloped outline) and a few in
 * the middle; each bough's clumps do the same on the bough. A clump takes
 * its step from where it sits: high on a bough that is high on the crown is
 * light, under a bough is dark. What is lower on the picture is nearer the
 * viewer, as on a crown seen from a little above.
 */
function crown(
  p: Plot, R: () => number, mass: Lobe, bough: number, leaf: number, rampId: number,
  o: { boughs?: Array<[number, number, number]>; fill?: number; gamma?: number } = {},
): void {
  const boughs: Lobe[] = []
  const addBough = (x: number, y: number, r: number) => boughs.push({ cx: x, cy: y, rx: r * 1.06, ry: r * 0.94, rz: r * 0.62, z: lobeDepth(mass, x, y) })
  if (o.boughs) for (const [x, y, r] of o.boughs) addBough(mass.cx + x, mass.cy + y, r)
  else {
    const ring = Math.max(4, Math.round((Math.PI * (mass.rx + mass.ry - 2 * bough)) / (bough * 1.36)))
    const a0 = R() * 6.283
    for (let k = 0; k < ring; k++) {
      const a = a0 + ((k + (R() - 0.5) * 0.35) / ring) * 6.283
      const r = bough * (0.88 + R() * 0.26)
      addBough(mass.cx + Math.cos(a) * (mass.rx - r), mass.cy + Math.sin(a) * (mass.ry - r), r)
    }
    const inner = Math.max(2, Math.round(((mass.rx - bough) * (mass.ry - bough)) / (bough * bough) * 1.1))
    for (let k = 0; k < inner; k++) {
      const q = 0.14 + 0.36 * Math.sqrt(k / inner)
      const a = a0 + 1 + k * 2.39996
      addBough(mass.cx + Math.cos(a) * q * mass.rx, mass.cy + Math.sin(a) * q * mass.ry - 1, bough * (1 + R() * 0.2))
    }
    // One bough low in front, so the trunk goes up into leaves and not through a gap.
    addBough(mass.cx + (R() - 0.5) * 3, mass.cy + mass.ry * 0.42, bough * 1.05)
  }
  for (const b of boughs) {
    const one = (x: number, y: number, r: number) => leafClump(p, x, y, r, lobeDepth(b, x, y), rampId, (R() - 0.5) * 0.3, R() < 0.22 ? 0 : 0.15 + R() * 0.14, o.gamma ?? 1.5, b, mass)
    const n = Math.max(5, Math.round((Math.PI * (b.rx + b.ry - 2 * leaf)) / (leaf * 1.25)))
    const b0 = R() * 6.283
    for (let k = 0; k < n; k++) {
      const a = b0 + ((k + (R() - 0.5) * 0.4) / n) * 6.283
      const r = leaf * (0.85 + R() * 0.3)
      one(b.cx + Math.cos(a) * (b.rx - r), b.cy + Math.sin(a) * (b.ry - r), r)
    }
    const m = Math.round(((b.rx * b.ry) / (leaf * leaf)) * (o.fill ?? 0.8))
    for (let k = 0; k < m; k++) {
      const q = Math.sqrt((k + 0.5) / m) * 0.62
      const a = b0 + k * 2.39996
      one(b.cx + Math.cos(a) * q * b.rx + (R() - 0.5) * 1.5, b.cy + Math.sin(a) * q * b.ry + (R() - 0.5) * 1.5, leaf * (0.85 + R() * 0.35))
    }
  }
}

/** A trunk from the foot up into the crown, with a lean, a fork and roots that grip the ground. */
function trunk(p: Plot, R: () => number, x: number, foot: number, top: number, r0: number, r1: number, lean: number, rampId: number, z: number): void {
  const mid = (foot + top) / 2
  const xm = x + lean * 0.3
  const xt = x + lean
  limb(p, x, foot - r0 * 0.7, r0, xm, mid, (r0 + r1) / 2 - 0.2, z, rampId, { bark: true })
  limb(p, xm, mid, (r0 + r1) / 2 - 0.2, xt, top, r1, z, rampId, { bark: true })
  // The fork: two boughs into the leaves.
  limb(p, xt, top + 2, r1 * 0.9, xt - r1 * 2.7, top - r1 * 2.6, r1 * 0.5, z - 0.6, rampId, { bias: -0.03 })
  limb(p, xt, top + 3, r1 * 0.9, xt + r1 * 2.9, top - r1 * 2, r1 * 0.5, z - 0.4, rampId, { bias: -0.08 })
  // Roots: one each way and a toe in front.
  const s = R() > 0.5 ? 1 : -1
  limb(p, x - r0 * 0.4, foot - r0 * 1.2, r0 * 0.7, x - r0 * 1.55, foot - 0.4, r0 * 0.34, z + 0.3, rampId, { bias: 0.02 })
  limb(p, x + r0 * 0.4, foot - r0 * 1.2, r0 * 0.7, x + r0 * 1.6, foot - 0.9, r0 * 0.34, z + 0.2, rampId, { bias: -0.1 })
  limb(p, x + s * r0 * 0.25, foot - r0, r0 * 0.7, x + s * r0 * 0.7, foot + 0.4, r0 * 0.42, z + 0.8, rampId)
}

/** Neon among the leaves: a few small blossoms (or, in the Wildwood, lights), never on the crown's edge. */
function blossoms(p: Plot, R: () => number, mass: Lobe, n: number, c: Neon): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 6.283 + R() * 1.2
    const q = 0.3 + R() * 0.38
    const x = Math.round(mass.cx + Math.cos(a) * q * mass.rx)
    const y = Math.round(mass.cy + Math.sin(a) * q * mass.ry)
    if (p.z[y * p.w + x] === NONE || p.z[(y + 2) * p.w + x + 1] === NONE) continue
    stamp(p, x, y, ['lm', 'md'], c)
    // Each sits in the leaves: a step of shade under it.
    for (const ox of [0, 1]) { const i = (y + 2) * p.w + x + ox; if (p.fix[i] < 0 && p.ix[i] > 1) p.ix[i]-- }
  }
}

function paintTree(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 56
  const H = 68
  const p = plot(W, H, [L.leaf[v], L.bark])
  const cx = 28
  const foot = H - 3
  const lean = [1.5, -2, 2.5, -1][v]
  const x = cx + lean
  // Four characters: round, tall, broad, and a small one with a heavy head.
  const mass: Lobe = [
    { cx: x, cy: 23, rx: 22, ry: 20, rz: 14, z: 22 },
    { cx: x, cy: 25, rx: 18.5, ry: 23, rz: 13, z: 22 },
    { cx: x, cy: 22, rx: 24, ry: 18.5, rz: 14, z: 22 },
    { cx: x, cy: 23, rx: 20.5, ry: 19.5, rz: 13, z: 22 },
  ][v]
  trunk(p, R, cx, foot, mass.cy + mass.ry - 3, 4.3, 3.1, lean, 1, 15)
  crown(p, R, mass, [8.6, 7.8, 8.4, 8.2][v] / Math.sqrt(L.dense), 3.9 / Math.sqrt(L.dense), 0)
  ink(p, { outline: 'in', shadow: 9, gamma: 1.25, crease: 1.2, hollow: 1.6 })
  rimLight(p, L, [0], 1)
  rimLight(p, L, [1], 2)
  if (v === 3 && !L.glow) blossoms(p, R, mass, 6, PINK)
  if (L.glow && v % 2 === 1) blossoms(p, R, mass, 3, L.glow)
  return cut(p, cx, foot)
}

function paintCanopy(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 68
  const H = 86
  const p = plot(W, H, [L.leaf[v], L.bark])
  const cx = 34
  const foot = H - 3
  const lean = [0, 1.5, -1.5, 1][v]
  const x = cx + lean
  // Forest trees stand shoulder to shoulder: broad heads on long trunks the row in front hides.
  const mass: Lobe = [
    { cx: x, cy: 31, rx: 30, ry: 27, rz: 18, z: 26 },
    { cx: x, cy: 33, rx: 29, ry: 29, rz: 18, z: 26 },
    { cx: x, cy: 30, rx: 31, ry: 26, rz: 18, z: 26 },
    { cx: x, cy: 32, rx: 28.5, ry: 28, rz: 18, z: 26 },
  ][v]
  trunk(p, R, cx, foot, mass.cy + mass.ry - 4, 5.6, 4.3, lean, 1, 17)
  crown(p, R, mass, [10.5, 10, 10.8, 9.6][v] / Math.sqrt(L.dense), 4.3 / Math.sqrt(L.dense), 0)
  ink(p, { outline: 'in', shadow: 11, gamma: 1.25, crease: 1.2, hollow: 1.6 })
  rimLight(p, L, [0], 1)
  rimLight(p, L, [1], 2)
  if (L.glow && v % 2 === 0) blossoms(p, R, mass, 4, L.glow)
  return cut(p, cx, foot)
}

function paintBush(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 36
  const H = 34
  const p = plot(W, H, [L.shrub])
  const cx = 18
  const foot = H - 3
  // Round and friendly, wider than tall, flat where it sits.
  const mass: Lobe = [
    { cx, cy: 17.5, rx: 15, ry: 14, rz: 10, z: 20 },
    { cx: cx + 0.5, cy: 17.5, rx: 14.5, ry: 14, rz: 10, z: 20 },
    { cx: cx - 0.5, cy: 17.5, rx: 15.5, ry: 14, rz: 10, z: 20 },
  ][v]
  const boughs: Array<Array<[number, number, number]>> = [
    [[0, -6, 7.4], [-7.5, -0.5, 7], [7.5, 0, 7], [0, 1, 7.4], [-4.5, 6.5, 7], [4.5, 7, 7]],
    [[-1.5, -6, 7], [-7, 0.5, 7.2], [7, -1.5, 7.4], [1, 1.5, 7.2], [-4, 7, 6.8], [5, 6.5, 7]],
    [[-4.5, -5, 6.8], [4.5, -5.5, 7], [-8.5, 1.5, 6.4], [8.5, 1, 6.6], [0, 0.5, 7.4], [-4.5, 7, 7], [4.5, 7, 7]],
  ]
  crown(p, R, mass, 0, 3.3 / Math.sqrt(L.dense), 0, { boughs: boughs[v], gamma: 1.3 })
  for (let y = foot + 1; y < H; y++) for (let x = 0; x < W; x++) p.z[y * W + x] = NONE
  ink(p, { outline: 'in', shadow: 3, gamma: 1.2, crease: 1.1, hollow: 1.4 })
  rimLight(p, L, [0], 1)
  // Berries, as on the classic bush.
  blossoms(p, R, { ...mass, cy: mass.cy + 2 }, 3 + (v === 1 ? 1 : 0), L.glow ?? PINK)
  return cut(p, cx, foot)
}

// ---------------------------------------------------------------------------
// Grass, tufts, flowers, reeds
// ---------------------------------------------------------------------------

/**
 * A tussock: blades rooted side by side along `span` px, leaning out a little
 * more the further from the middle, tallest in the middle. The far row is
 * drawn first and darker, the near row shorter and lighter, between the far
 * row's blades.
 */
function tussock(p: Plot, R: () => number, cx: number, foot: number, n: number, span: number, tall: number, w0: number, rampId: number, lean = 0.55): void {
  for (let pass = 0; pass < 2; pass++) {
    const m = pass ? n - 1 : n
    for (let k = 0; k < m; k++) {
      const f = m > 1 ? (k + (pass ? 0.5 : 0)) / (n - 1) * 2 - 1 : 0
      const len = tall * (1 - 0.38 * f * f) * (0.84 + R() * 0.18) * (pass ? 0.72 : 1)
      const x0 = cx + f * span + (R() - 0.5) * 0.8
      const x1 = x0 + f * span * lean + (R() - 0.5) * 2
      const bend = (f + (R() - 0.5) * 0.6) * 1.6
      blade(p, x0, foot, x1, foot - len, bend, w0, 10 + pass * 2 + k * 0.01, rampId, pass ? 3 : 1, pass ? 4 : 2)
    }
  }
}

function paintTall(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 30
  const H = 26
  const p = plot(W, H, [L.grass])
  const cx = 15
  const foot = H - 2
  tussock(p, R, cx, foot, [6, 7, 5, 6][v], [6.5, 7.5, 5.5, 7][v], [18, 16, 19.5, 17][v], 3, 0)
  ink(p, { outline: 'none', shadow: 0, gamma: 1 })
  return cut(p, cx, foot)
}

function paintTuft(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 20
  const H = 18
  const p = plot(W, H, [L.grass, L.shrub, L.bark])
  const cx = 10
  const foot = H - 2
  if (v < 3) tussock(p, R, cx, foot, [2, 3, 4][v], [1.5, 2.5, 4][v], [7, 8.5, 7][v], 2, 0, 0.9)
  else if (v === 3) {
    // A fern: short broad leaves in a rosette.
    tussock(p, R, cx, foot, 4, 3, 6.5, 3, 0, 1.1)
  } else if (v === 4) {
    // Clover: three leaves on one stem.
    draw(p, cx - 5, foot - 6, CLOVER, 1)
  } else if (L.glow) {
    // The Wildwood's own: two small lit caps.
    limb(p, cx - 2, foot, 1, cx - 2, foot - 5, 0.9, 9, 2, { bias: 0.2 })
    limb(p, cx + 3, foot, 0.8, cx + 3, foot - 3, 0.7, 9, 2, { bias: 0.2 })
    stamp(p, cx - 5, foot - 8, ['.mll.', 'mllcl', 'dmmmm'], L.glow, 12)
    stamp(p, cx + 1, foot - 5, ['.ml.', 'dmlm'], L.glow, 12)
  } else {
    // A seedling: two leaves and a pale bud.
    blade(p, cx, foot, cx, foot - 6, 0, 1, 9, 0, 2, 3)
    blade(p, cx, foot - 2, cx - 4, foot - 5, -1, 2, 10, 0, 2, 4)
    blade(p, cx, foot - 2, cx + 4, foot - 6, 1, 2, 10, 0, 2, 3)
    clump(p, cx, foot - 7.5, 1.8, 1.8, 11, 1, 0, null, 0.3)
  }
  ink(p, { outline: 'none', shadow: 0, gamma: 1 })
  return cut(p, cx, foot)
}

const CLOVER = [
  '....56.....',
  '...5665....',
  '.56.454.56.',
  '5665.3.5665',
  '4554.2.4554',
  '.43..2..34.',
  '.....1.....',
]

/** The three blossoms, as placed pixels: a daisy, a bell, and the classic view's small cross. */
const DAISY = ['.lll.', 'lmmmm', 'lmcmd', 'mmmmd', '.mdd.']
const BELL = ['l.ml', 'lmmd', 'lmmd', '.md.']
const CROSS = ['.l.', 'lcm', '.d.']

function paintFlower(L: Look, v: number, seed: number, n: Neon): Cut {
  const R = seeded(seed)
  const W = 18
  const H = 18
  const p = plot(W, H, [L.grass])
  const cx = 9
  const foot = H - 2
  if (v === 0) {
    // One daisy on a stem, a bud beside it.
    blade(p, cx, foot, cx + 0.5, foot - 6, 0, 1, 9, 0, 2, 3)
    blade(p, cx, foot, cx - 3.5, foot - 3, -0.5, 2, 10, 0, 2, 4)
    blade(p, cx, foot, cx + 3.5, foot - 4, 0.5, 2, 10, 0, 2, 3)
    stamp(p, cx - 2, foot - 11, DAISY, n)
  } else if (v === 1) {
    // Three small crosses at three heights.
    blade(p, cx - 3, foot, cx - 3.5, foot - 4, 0, 1, 9, 0, 2, 3)
    blade(p, cx, foot, cx + 0.5, foot - 7, 0, 1, 9, 0, 2, 3)
    blade(p, cx + 3, foot, cx + 4, foot - 3, 0, 1, 9, 0, 2, 3)
    blade(p, cx, foot, cx - 2, foot - 2.5, 0, 2, 10, 0, 2, 4)
    stamp(p, cx - 5, foot - 7, CROSS, n)
    stamp(p, cx - 1, foot - 10, CROSS, n)
    stamp(p, cx + 3, foot - 6, CROSS, n)
  } else {
    // Two bells nodding apart.
    blade(p, cx - 1, foot, cx - 2.5, foot - 6, -0.5, 1, 9, 0, 2, 3)
    blade(p, cx + 1, foot, cx + 3, foot - 4, 0.5, 1, 9, 0, 2, 3)
    blade(p, cx, foot, cx, foot - 3.5, R() - 0.5, 2, 10, 0, 2, 4)
    stamp(p, cx - 4, foot - 10, BELL, n)
    stamp(p, cx + 1, foot - 8, BELL, n)
  }
  ink(p, { outline: 'none', shadow: 0, gamma: 1 })
  return cut(p, cx, foot)
}

function paintReed(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 20
  const H = 34
  const p = plot(W, H, [L.grass, HEAD])
  const cx = 10
  const foot = H - 2
  const stalks = [[-2, 27], [2, 22], [0, 17]].slice(0, v === 2 ? 2 : 3)
  // Long leaves behind, stalks with their heads in front.
  blade(p, cx - 1, foot, cx - 5, foot - 15 - R() * 3, -1.5, 2, 9, 0, 1, 3)
  blade(p, cx + 1, foot, cx + 5, foot - 12 - R() * 4, 1.5, 2, 9, 0, 1, 3)
  if (v !== 1) blade(p, cx, foot, cx + 3, foot - 19, 2, 2, 9.5, 0, 2, 3)
  for (const [ox, tall] of stalks) {
    const x = cx + ox + (v === 1 ? 1 : 0)
    const tip = foot - tall + (v === 1 ? 2 : 0)
    blade(p, x, foot, x + ox * 0.4, tip, ox * 0.3, 1, 11, 0, 2, 3)
    const hx = Math.round(x + ox * 0.36 - 0.5)
    // The head: a short velvet cylinder under a bare spike, with the sun on its west side.
    for (let k = 0; k < 6; k++) {
      const y = Math.round(tip) + 3 + k
      put(p, hx - 1, y, 12, 1, -0.7, 0.1, 0.7, 900, k === 0 ? 4 : 5)
      put(p, hx, y, 12.5, 1, 0, 0.1, 1, 900, k === 0 || k === 5 ? 3 : 4)
      put(p, hx + 1, y, 12, 1, 0.7, 0.1, 0.7, 900, k === 0 || k === 5 ? 2 : 3)
    }
  }
  ink(p, { outline: 'none', shadow: 0, gamma: 1 })
  return cut(p, cx, foot)
}

// ---------------------------------------------------------------------------
// The palm
// ---------------------------------------------------------------------------

/**
 * A palm frond: a spine that leaves the crown at `ang` (radians, 0 east, up
 * positive) and sinks under its own weight, with leaflets out to both sides
 * that hang the more the more they point down. The leaflets go two by two, a
 * light pair and a dark shorter pair, so the frond is striped and its edge is
 * toothed.
 */
function frond(p: Plot, x0: number, y0: number, ang: number, len: number, droop: number, leaf: number, z0: number, rampId: number, tone: number): void {
  const id = ++p.parts
  const top = p.ramps[rampId].length - 1
  const dx = Math.cos(ang)
  const dy = -Math.sin(ang)
  const n = Math.ceil(len * 2)
  for (let k = 0; k <= n; k++) {
    const t = k / n
    const x = x0 + dx * len * t
    const y = y0 + dy * len * t + droop * len * t * t
    let tx = dx
    let ty = dy + 2 * droop * t
    const tl = Math.hypot(tx, ty) || 1
    tx /= tl
    ty /= tl
    const dark = (Math.floor(t * len / 2) & 1) === 1
    const lf = leaf * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.88 + 0.12)), 0.55) - (dark ? 2 : 0)
    for (const side of [1, -1]) {
      let ux = -ty * side * 0.8 + tx * 0.3
      let uy = tx * side * 0.8 + 0.6 + ty * 0.3
      const ul = Math.hypot(ux, uy) || 1
      ux /= ul
      uy /= ul
      const reach = lf * (0.4 + 0.6 * clamp(uy, 0, 1))
      const step = clamp(tone - (dark ? 1 : 0) + (uy < 0.25 ? 1 : 0), 1, top)
      for (let s = 0.5; s <= reach; s += 0.5) {
        put(p, Math.round(x + ux * s - 0.5), Math.round(y + uy * s - 0.5), z0 - s * 0.08 + t * 0.4, rampId, ux * 0.45 + tx * 0.15, 0.35 - uy * 0.3, 0.8, id, step + 1)
      }
    }
    put(p, Math.round(x - 0.5), Math.round(y - 0.5), z0 + 0.5 + t * 0.4, rampId, tx * 0.2, 0.6, 0.75, id, clamp(tone + (t < 0.7 ? 2 : 1), 1, top) + 1)
  }
}

/** The shade under painted leaves (a frond's teeth): the pixels of a ramp with nothing under them go dark, those with nothing east of them a step down. */
function underline(p: Plot, rampId: number): void {
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    const i = y * p.w + x
    if (p.z[i] === NONE || p.ramp[i] !== rampId || p.fix[i] >= 0) continue
    if (y + 1 >= p.h || p.z[i + p.w] === NONE) p.ix[i] = 1
    else if (x + 1 >= p.w || p.z[i + 1] === NONE) p.ix[i] = Math.max(1, p.ix[i] - 1)
  }
}

function paintPalm(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 66
  const H = 86
  const p = plot(W, H, [L.frond, L.husk, L.bark])
  const dir = v === 0 ? 1 : -1
  const fx = dir > 0 ? 22 : 44
  const foot = H - 3
  const reach = v === 0 ? 14 : 11
  const hx = fx + dir * reach
  const hy = v === 0 ? 27 : 30
  // The trunk: a lean that straightens toward the crown, ringed all the way, on a swollen foot.
  const segs = 10
  let px = fx
  let py = foot - 3
  let arc = 0
  for (let k = 1; k <= segs; k++) {
    const t = k / segs
    const x = fx + dir * reach * (1 - (1 - t) * (1 - t))
    const y = foot - 3 + (hy + 2 - (foot - 3)) * t
    const r0 = 4 - 1.5 * ((k - 1) / segs)
    const r1 = 4 - 1.5 * t
    limb(p, px, py, r0, x, y, r1, 14, 1, { ring: arc })
    arc += Math.hypot(x - px, y - py)
    px = x
    py = y
  }
  limb(p, fx - 1, foot - 3, 3.6, fx - 4.5, foot - 0.6, 1.6, 14.3, 1, { bias: 0.02 })
  limb(p, fx + 1, foot - 3, 3.6, fx + 4.5, foot - 1, 1.6, 14.2, 1, { bias: -0.08 })
  limb(p, fx, foot - 3, 4.4, fx, foot - 1.5, 3.4, 14.5, 1)
  // Fronds, the far ones first: back and up, out to the sides, then the near ones falling toward the viewer.
  const F: Array<[number, number, number, number, number, number]> = [
    // angle (degrees), length, droop, leaflet length, depth, tone
    [96, 15, 0.2, 6, 10, 2], [56, 21, 0.38, 7, 11, 2], [136, 21, 0.4, 7, 11, 2],
    [22, 25, 0.6, 9, 16, 3], [160, 25, 0.58, 9, 16, 3],
    [-20, 21, 0.5, 9, 19, 4], [202, 21, 0.52, 9, 19, 4],
    [-66, 12, 0.45, 7, 21, 4], [248, 12, 0.45, 7, 21, 4],
  ]
  for (const [deg, len, droop, leaf, z, tone] of F) {
    const a = ((dir > 0 ? deg : 180 - deg) + (R() - 0.5) * 8) * Math.PI / 180
    frond(p, hx, hy, a, len * (0.94 + R() * 0.1), droop, leaf, z, 0, tone)
  }
  // The heart of the crown and its nuts.
  clump(p, hx, hy, 3.4, 3, 22, 2, 0, null, 0.12)
  clump(p, hx - 2.5, hy + 4, 2.4, 2.4, 20.5, 1.5, 2, null, 0.05)
  clump(p, hx + 2.5, hy + 4.5, 2.4, 2.4, 20.6, 1.5, 2, null, -0.05)
  ink(p, { outline: 'in', shadow: 3, gamma: 1.3 })
  underline(p, 0)
  rimLight(p, L, [1], 1)
  return cut(p, fx, foot)
}

// ---------------------------------------------------------------------------
// The atlas
// ---------------------------------------------------------------------------

/** How many variants of each kind, in the order they are laid out (tallest first, so the rows waste little). */
const COUNT: Array<[FloraKind, number]> = [
  ['canopy', 4], ['tree', 4], ['palm', 2], ['bush', 3], ['reed', 3], ['tall', 4], ['tuft', 6], ['flowerPink', 3], ['flowerCyan', 3],
]
const ATLAS_W = 512

const cache = new Map<FloraLook, FloraAtlas>()

function paint(L: Look, kind: FloraKind, v: number, seed: number): Cut {
  switch (kind) {
    case 'tree': return paintTree(L, v, seed)
    case 'canopy': return paintCanopy(L, v, seed)
    case 'bush': return paintBush(L, v, seed)
    case 'tall': return paintTall(L, v, seed)
    case 'tuft': return paintTuft(L, v, seed)
    case 'flowerPink': return paintFlower(L, v, seed, PINK)
    case 'flowerCyan': return paintFlower(L, v, seed, CYAN)
    case 'reed': return paintReed(L, v, seed)
    case 'palm': return paintPalm(L, v, seed)
  }
}

/**
 * Every plant of a look on one picture, and the same layout as normals
 * (rgb = normal × 0.5 + 0.5; x right, y up, z toward the viewer). Alpha is 0
 * or 255, and every sprite has a clear pixel round it.
 */
export function buildFlora(look: FloraLook): FloraAtlas {
  const hit = cache.get(look)
  if (hit) return hit
  const L = LOOKS[look]
  const salt = look === 'coast' ? 11 : look === 'wild' ? 23 : 37
  const cuts: Array<{ kind: FloraKind; c: Cut; x: number; y: number }> = []
  let x = 1
  let y = 1
  let rowH = 0
  let k = 0
  for (const [kind, n] of COUNT) for (let v = 0; v < n; v++) {
    const c = paint(L, kind, v, salt * 1000 + ++k * 97)
    if (x + c.w + 1 > ATLAS_W) { x = 1; y += rowH + 2; rowH = 0 }
    cuts.push({ kind, c, x, y })
    x += c.w + 2
    rowH = Math.max(rowH, c.h)
  }
  let H = 128
  while (H < y + rowH + 1) H *= 2
  const albedo = makeCanvas(ATLAS_W, H)
  const normal = makeCanvas(ATLAS_W, H)
  const ag = albedo.getContext('2d')!
  const ng = normal.getContext('2d')!
  const sprites = { tree: [], canopy: [], bush: [], tall: [], tuft: [], flowerPink: [], flowerCyan: [], reed: [], palm: [] } as Record<FloraKind, FloraSprite[]>
  for (const { kind, c, x: sx, y: sy } of cuts) {
    const a = ag.createImageData(c.w, c.h)
    a.data.set(c.rgba)
    ag.putImageData(a, sx, sy)
    const n = ng.createImageData(c.w, c.h)
    n.data.set(c.norm)
    ng.putImageData(n, sx, sy)
    sprites[kind].push({ x: sx, y: sy, w: c.w, h: c.h, ax: c.ax, ay: c.ay })
  }
  const atlas: FloraAtlas = { albedo, normal, sprites }
  cache.set(look, atlas)
  return atlas
}
