/**
 * The plants of the 16-bit view, painted at twice the classic density (a tile
 * is 32 px): trees with crowns that hang over their trunks, forest trees for
 * the dense woods, bushes, tall grass, ground tufts, glowing flowers, reeds
 * and palms. The engine stands them up as cards, lights them per pixel from
 * the normal picture and lets the wind move them.
 *
 * The blossoms, the berries and the nuts are placed pixel by pixel; the rest
 * is built the way a 16-bit forest was drawn. A height field first: a crown
 * is a handful of boughs, each a flat cloud of leaves, the lower ones in
 * front of the upper ones; a trunk is a cylinder that swells into its roots;
 * grass is bent blades. Then the light, big forms first: the whole crown is
 * one ball lit from the upper west with a belly in shade, every bough is
 * light on top and dark under, and a leaf clump (a round arc over a flatter
 * underside) is one flat shade with a lit crescent on its upper west
 * shoulder, lying on the clump above it like a scale, so the borders between
 * shades run along leaves, with a leaf tip jutting across here and there.
 * The colours are a ramp of seven whose shadows drift to indigo and whose
 * lights drift to mint; small specks are merged into their neighbours, a
 * dark line goes round the shaded side only, and a short run or two of dim
 * magenta lies inside the lower west edge where the low sun catches it (the
 * engine's own light does the rest). The colours are the classic view's
 * (`tiles.ts`: teal crowns, moonlit violet ones, plum trunks), with more
 * steps between them; grass is greener than the crowns, or the violet dusk
 * turns it grey. The same height field gives the normal picture: mostly the
 * boughs' roundness, so what the light models is what is painted.
 *
 * Of the four trees of a look, three share one ramp and differ in form; the
 * fourth is the look's other mood (on the coast the classic moonlit violet).
 *
 * `buildFlora(look)` is seeded, so a look always gives the same pictures, and
 * each look is built once. `scripts/zelda-lab/flora-sheet.mjs` draws them all
 * on contact sheets.
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
/** Dark to light. [0] is the outline (and the foot of a blade of grass). */
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
const TEAL = ramp('#0b1830', '#0f2a47', '#124158', '#1a5c66', '#278374', '#48b391', '#6fd8b4')
const MOON = ramp('#0d0f2e', '#15174a', '#1b2560', '#263676', '#35509a', '#4f70c0', '#7c9ae8')
const VIOLET = ramp('#120c30', '#1e1450', '#2c1f72', '#3f3096', '#594cba', '#8072dc', '#b0a4fa')
const LIME = ramp('#0f1a2e', '#123040', '#16504c', '#22745a', '#3f9c64', '#7cc86e', '#b4e484')
const SHRUB = ramp('#0b1f30', '#0f3540', '#145049', '#1f7468', '#359c84', '#5cc7a0', '#8ce4bc')
const BARK = ramp('#140a1e', '#24142c', '#3a2240', '#573058', '#7a4a6e', '#a86c84', '#d49a9c')
const HUSK = ramp('#1a0e1c', '#30192a', '#4f2a38', '#74414a', '#9c6058', '#c88a6c', '#ecba8c')
// Grass is green in its body, so the violet dusk does not turn it grey; only its last step, for a tip pixel, is the cyan of the lamps.
const GRASS = ramp('#0e2a44', '#124e4c', '#1c7860', '#2f9c74', '#5cd096', '#b0f6e0')
/** The beach's other mood: a crown the low sun has turned yellow-green. */
const SUNNY = ramp('#101c2c', '#14343c', '#1c5846', '#33804e', '#5fa858', '#9cd470', '#d0ec8c')
const DUNE = ramp('#14203a', '#1f4a52', '#3a7460', '#6a9c6c', '#a8c47c', '#e4e8a4')
const HEAD = ramp('#1c0d24', '#3a1c3a', '#6e3552', '#a8566e', '#e08a8a')

const PINK = { deep: rgb('#c93aa6'), main: rgb('#ff5fd0'), light: rgb('#ff9ae4'), core: rgb('#fff4ff') }
const CYAN = { deep: rgb('#2ab8d8'), main: rgb('#6ff6ff'), light: rgb('#b4fbff'), core: rgb('#f4ffff') }
type Neon = typeof PINK

interface Look {
  /** Crown colours, one ramp per variant of a tree: three alike, the fourth the look's other mood. */
  leaf: Ramp[]
  shrub: Ramp
  bark: Ramp
  grass: Ramp
  frond: Ramp
  /** A palm's trunk, and its nuts. */
  stem: Ramp
  husk: Ramp
  /** The lightest step a trunk's own body takes (its lights beyond that are single pixels), and a palm's trunk. */
  barkTop: number
  stemTop: number
  /** The low sun on a west edge, and its hottest pixel. */
  rim: Rgb
  hot: Rgb
  /** More and smaller clumps in a crown. */
  dense: number
  /** Light of its own among the leaves, for berries and on the small caps on the ground (the Wildwood), or none. */
  glow: Neon | null
}

const WILD = dusk(blend(TEAL, MOON, 0.6), 0.9)

const LOOKS: Record<FloraLook, Look> = {
  coast: {
    leaf: [TEAL, TEAL, TEAL, MOON],
    shrub: SHRUB, bark: BARK, grass: GRASS, frond: blend(TEAL, LIME, 0.5), stem: blend(BARK, HUSK, 0.25), husk: HUSK, barkTop: 4, stemTop: 4,
    rim: rgb('#a8407e'), hot: rgb('#ff8a5a'), dense: 1, glow: null,
  },
  wild: {
    leaf: [WILD, WILD, WILD, dusk(blend(MOON, VIOLET, 0.75), 0.92)],
    shrub: dusk(blend(SHRUB, MOON, 0.15), 0.94), bark: dusk(BARK, 0.86), grass: blend(GRASS, MOON.slice(0, 6), 0.15),
    frond: dusk(blend(TEAL, MOON, 0.15), 0.96), stem: dusk(BARK, 0.86), husk: dusk(HUSK, 0.85), barkTop: 4, stemTop: 4,
    rim: rgb('#8c44a8'), hot: rgb('#ff7ad0'), dense: 1.25, glow: { deep: rgb('#1f9c8c'), main: rgb('#3fd8b0'), light: rgb('#8ffce0'), core: rgb('#e0fff4') },
  },
  beach: {
    leaf: [blend(TEAL, LIME, 0.65), blend(TEAL, LIME, 0.65), blend(TEAL, LIME, 0.65), SUNNY],
    shrub: blend(SHRUB, LIME, 0.6), bark: blend(BARK, HUSK, 0.6), grass: blend(GRASS, DUNE, 0.7), frond: LIME, stem: HUSK, husk: HUSK, barkTop: 4, stemTop: 5,
    rim: rgb('#c8527c'), hot: rgb('#ffb05a'), dense: 0.95, glow: null,
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
  /** Which bough a leaf pixel belongs to: a fold is drawn where one bough hangs over another, not between a bough's own clumps. */
  group: Uint16Array
  /** Where no leaf may be painted: under a crown's flat underside. */
  hole: Uint8Array
  /** Lighter or darker than the form says, as a share of the ramp. */
  bias: Float32Array
  /** A ramp step given by the painter and still open to shade (a leaf, a limb); NaN: from the normal. */
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
    ramp: new Uint8Array(n), part: new Uint16Array(n), group: new Uint16Array(n), hole: new Uint8Array(n),
    bias: new Float32Array(n), tone: new Float32Array(n).fill(NaN), pin: new Uint8Array(n), ix: new Uint8Array(n),
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

/** One pixel of a part, if nothing nearer the viewer is there already. Says whether it was painted. */
function put(p: Plot, x: number, y: number, z: number, rampId: number, nx: number, ny: number, nz: number, part: number, pin = 0, bias = 0, tone = NaN): boolean {
  if (x < 0 || y < 0 || x >= p.w || y >= p.h) return false
  const i = y * p.w + x
  if (z < p.z[i]) return false
  const l = Math.hypot(nx, ny, nz) || 1
  p.z[i] = z
  p.nx[i] = nx / l
  p.ny[i] = ny / l
  p.nz[i] = nz / l
  p.ramp[i] = rampId
  p.part[i] = part
  p.group[i] = 0
  p.pin[i] = pin
  p.bias[i] = bias
  p.tone[i] = tone
  p.fix[i] = -1
  return true
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

/** The light the crowns are shaded by: the dusk sky, from the upper west. */
const SUN = [-0.503, 0.704, 0.503]
/** The same light as a trunk takes it: lower, so an upright cylinder has a lit west side. */
const LOW = [-0.756, 0.252, 0.605]

/** How a crown takes the light: the step at its middle, how much the crown and a bough each add, and how far the belly is lifted. */
interface Shade { mid: number; mass: number; bough: number; belly: number; /** How deep a leaf clump's underside is, against the arc over it: under 1 it is flatter. */ under: number; /** How far down the crown the belly starts (1 is its lowest row). */ bellyAt: number }

/** Where on the crown a leaf sits: the lightest step it may take there, and whether it is in the belly, the lower third that never comes out of the shade. */
function crownLight(mass: Lobe, x: number, y: number, top: number, sh: Shade): { most: number; belly: boolean } {
  const ex = (x - mass.cx) / mass.rx
  const ey = (y - mass.cy) / mass.ry
  const belly = ey > sh.bellyAt
  // The brightest step belongs to the crown's upper west.
  return { belly, most: belly ? 2 : -0.55 * ex - 0.83 * ey > 0.12 ? top : top - 1 }
}

/**
 * A leaf clump on a bough: a round arc on top and a flatter underside. The
 * whole clump is one shade, taken from the big forms at its middle: where it
 * sits on the crown (a ball lit from the upper west, its lower third a belly
 * in shade) and on its bough (light on top, dark under). So the borders
 * between shades run along leaves. Clumps lie like scales, the lower over
 * the upper, each showing its upper arc; with `cap` under the share the
 * light allows, a crescent along its upper west shoulder is one step lighter
 * (broad in the light, thin in the shade; in the belly one clump in three
 * has one, the light the ground throws back), and in the light a thin
 * crescent on its lower east is one darker. Its normal is mostly its bough's
 * on the crown's, with a little roundness of its own, so the lit form is the
 * painted one.
 */
function leafClump(p: Plot, cx: number, cy: number, r: number, rampId: number, lift: number, cap: number, bough: Lobe, mass: Lobe, group: number, sh: Shade): void {
  const id = ++p.parts
  const top = p.ramps[rampId].length - 1
  const rx = r * 1.15
  const up = r * 0.95
  const dn = up * sh.under
  const cb = lobeNormal(bough, cx, cy)
  const cm = lobeNormal(mass, cx, cy)
  const tm = cm[0] * SUN[0] + cm[1] * SUN[1] + cm[2] * SUN[2]
  const tb = cb[0] * SUN[0] + cb[1] * SUN[1] + cb[2] * SUN[2]
  const big = sh.mid + sh.mass * (tm - 0.5) + sh.bough * (tb - 0.35) + lift
  const { most, belly } = crownLight(mass, cx, cy, top, sh)
  // The belly is lifted off the outline: its boughs' tops reach its cap, only their undersides are the darkest leaf.
  const base = clamp(Math.floor(big + (belly ? sh.belly : 0)), 1, most)
  const share = belly ? 0.34 : big >= 3.6 ? 0.92 : big >= 2.6 ? 0.6 : 0.3
  const lit = cap < share ? Math.min(base + 1, belly ? 3 : most) : base
  const lip = big >= 2.6 && base > 1 ? base - 1 : base
  // How far the clump would have to slide down and east to uncover its lit crescent.
  const k = big >= 3.6 ? 0.5 : big >= 2.6 ? 0.42 : 0.36
  const sx = Math.max(1, r * k * 0.7)
  const sy = Math.max(1.2, r * k)
  const inside = (ox: number, oy: number) => {
    const ex = ox / rx
    const ey = oy / (oy < 0 ? up : dn)
    return ex * ex + ey * ey
  }
  const z0 = lobeDepth(bough, cx, cy) + (cy - bough.cy) * 0.45
  for (let y = Math.floor(cy - up); y <= Math.ceil(cy + dn); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    if (x < 0 || y < 0 || x >= p.w || y >= p.h || p.hole[y * p.w + x]) continue
    const ox = x + 0.5 - cx
    const oy = y + 0.5 - cy
    const d2 = inside(ox, oy)
    if (d2 > 1) continue
    const s = Math.sqrt(1 - d2)
    const dx = ox / rx
    const dy = oy / (oy < 0 ? up : dn)
    const b = lobeNormal(bough, x + 0.5, y + 0.5)
    const m = lobeNormal(mass, x + 0.5, y + 0.5)
    const step = inside(ox - sx, oy - sy) > 1 ? lit : inside(ox + 1.1, oy + 0.9) > 1 ? lip : base
    const i = y * p.w + x
    if (put(
      p, x, y, z0 + r * 0.3 * s, rampId,
      dx * 0.3 + b[0] * 0.56 + m[0] * 0.42, -dy * 0.3 + b[1] * 0.56 + m[1] * 0.42, Math.max(0.15, s) * 0.3 + b[2] * 0.56 + m[2] * 0.42,
      id, 0, 0, step + 0.5,
    )) p.group[i] = group
  }
}

/** A small round thing (a bud, the heart of a palm): half an ellipsoid bulging toward the viewer, shaded by the sky. */
function clump(p: Plot, cx: number, cy: number, rx: number, ry: number, z0: number, zr: number, rampId: number, bias = 0): void {
  const id = ++p.parts
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx
    const dy = (y + 0.5 - cy) / ry
    const d2 = dx * dx + dy * dy
    if (d2 > 1) continue
    const s = Math.sqrt(1 - d2)
    put(p, x, y, z0 + zr * s, rampId, dx, -dy, Math.max(0.12, s), id, 0, bias)
  }
}

/**
 * A limb: a round stick from one point to another, thicker at one end, lit
 * from the west in clean bands and never lighter than `cap`. With `bark` it
 * gets short grooves; with `ring` a dark ring every few px along it (a
 * palm's scars), counted from the arc length `ring`; above the row `shade`
 * it stands in the crown's shadow. `lift` is in ramp steps.
 */
function limb(
  p: Plot, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, z0: number, rampId: number,
  o: { bark?: boolean; ring?: number; lift?: number; cap?: number; shade?: number } = {},
): number {
  const id = ++p.parts
  const ax = x1 - x0
  const ay = y1 - y0
  const len2 = ax * ax + ay * ay || 1
  const len = Math.sqrt(len2)
  const rm = Math.max(r0, r1)
  const cap = (o.cap ?? p.ramps[rampId].length - 1) + 0.99
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
      const nx = d ? (dx / d) * u : 0
      const ny = d ? (-dy / d) * u : 0
      const nz = Math.max(0.15, s)
      const nl = Math.hypot(nx, ny, nz)
      let tone = 2.2 + 2 * ((nx * LOW[0] + ny * LOW[1] + nz * LOW[2]) / nl) + (o.lift ?? 0)
      if (o.bark && ((y + x * 5) % 9) < 4 && x % 2 === 0 && u < 0.8) tone -= 1
      if (o.ring !== undefined) {
        const f = (o.ring + t * len) / 4
        if (f - Math.floor(f) < 0.3) tone -= 1.2
      }
      tone = Math.min(tone, cap)
      if (o.shade !== undefined) {
        // The shadow's edge slants with the light: lower on the east side.
        const edge = o.shade + nx * 2
        if (y < edge) tone = Math.min(tone - 1.2, 2.99)
        else if (y < edge + 2) tone -= 0.7
      }
      put(p, x, y, z0 + r * s * 0.8, rampId, nx, ny, nz, id, 0, 0, tone)
    }
  }
  return id
}

/**
 * A blade of grass (or a long leaf): one run of pixels per row from the root
 * up to the tip, `bend` px out of line in the middle, `w0` px wide at the
 * root and one at the tip. Its west side takes the step `hi`, its east side
 * `lo`: the sky's light, painted on. With `root` its lowest share stands in
 * the dark of the tussock (the ramp's two darkest steps); `tip` is the step
 * of its last `tipRows` rows (0: no light on the tip; left out: one above
 * `hi` for the top fifth). With `full` it keeps its width most of the way
 * up and narrows only toward the tip.
 */
function blade(
  p: Plot, x0: number, y0: number, x1: number, y1: number, bend: number, w0: number, z0: number, rampId: number, lo: number, hi: number,
  o: { root?: number; tip?: number; tipRows?: number; full?: boolean } = {},
): number {
  const id = ++p.parts
  const rows = Math.max(1, Math.round(y0 - y1))
  const top = p.ramps[rampId].length - 1
  let last = NaN
  for (let k = 0; k <= rows; k++) {
    const t = k / rows
    const x = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * ((x0 + x1) / 2 + bend) + t * t * x1
    const y = Math.round(y0 - 0.5) - k
    const w = Math.max(1, Math.round(w0 * (1 - (o.full ? t * t : t) * 0.9)))
    let a = Math.round(x - w / 2)
    let b = a + w - 1
    // A blade that leans far in one row is joined to the row under it.
    if (!Number.isNaN(last)) { if (a > last + 1) a = last + 1; if (b < last - 1) b = last - 1 }
    const lean = clamp((x1 - x0) / rows, -1, 1)
    for (let q = a; q <= b; q++) {
      const west = b === a ? t > 0.55 : q - a < (b - a + 1) / 2
      let step = west ? hi : lo
      if (o.tip === undefined) { if (t > 0.82) step = hi + 1 } else if (o.tip > 0) {
        if (rows - k < (o.tipRows ?? 2)) step = o.tip
        else if (t > 0.66 && o.tip > hi + 1) step = hi + 1
      }
      if (o.root) { if (t < o.root * 0.55) step = 0; else if (t < o.root) step = Math.min(step, 1) } else if (t < 0.18) step = Math.max(1, step - 1)
      const side = b === a ? 0 : (q - a) / (b - a) * 2 - 1
      put(p, q, y, z0 + t * 0.2, rampId, side * 0.6 + lean * 0.5, 0.3 + t * 0.25, 0.8, id, clamp(step, 0, top) + 1)
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
    if (step >= 0 && step <= 9) put(p, x + i, y + j, z, rampId, rows[j].length > 1 ? (i / (rows[j].length - 1) - 0.5) * 0.8 : 0, 0.5, 0.8, id, step + 1)
  }
}

// ---------------------------------------------------------------------------
// From form to pixels
// ---------------------------------------------------------------------------

interface Ink {
  /** The dark line round the plant: on its own edge pixels, or none. */
  outline: 'in' | 'none'
  /** How many px a part's shade reaches down onto what is under it. */
  shadow: number
  /** Above 1 keeps the lights small (for the parts shaded from their normal). */
  gamma: number
  /** Steps taken off in the fold where a nearer bough covers this one from below (0: none). */
  crease?: number
  /** The ramps whose small specks are merged into their neighbours (leaves; not bark, whose grooves are thin on purpose). */
  merge?: number[]
}

/** The sky the small round parts are shaded from: overhead, a little west, a little toward the viewer. */
const SKY = [-0.3, 0.8, 0.52]

/** Give every pixel its ramp step: the painter's shade, the folds between boughs, specks merged, then the line. */
function ink(p: Plot, o: Ink): void {
  const { w, h } = p
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? NONE : p.z[y * w + x])
  if (o.outline === 'in') {
    // A silhouette has no hairs.
    for (let pass = 0; pass < 2; pass++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      const n = +(at(x - 1, y) > NONE) + +(at(x + 1, y) > NONE) + +(at(x, y - 1) > NONE) + +(at(x, y + 1) > NONE)
      if (p.z[i] > NONE && n <= 1 && !p.pin[i]) p.z[i] = NONE
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
    if (o.crease && p.group[i]) {
      // The fold over a nearer bough's top is where the least light gets in.
      for (let k = 1; k <= 3; k++) {
        if (y + k >= h) break
        const j = (y + k) * w + x
        if (p.z[j] === NONE) break
        if (p.group[j] && p.group[j] !== p.group[i] && p.z[j] > p.z[i] + 0.5) { s -= o.crease * [1, 0.66, 0.33][k - 1]; break }
      }
    }
    s += p.bias[i] * top
    p.ix[i] = clamp(Math.floor(s), 1, top)
  }
  // The pixels on the plant's own edge.
  const edge: number[] = []
  const onEdge = new Uint8Array(w * h)
  if (o.outline === 'in') {
    const open = (x: number, y: number) => at(x, y) === NONE
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (p.z[i] === NONE || p.pin[i]) continue
      if (!open(x - 1, y) && !open(x + 1, y) && !open(x, y - 1) && !open(x, y + 1)) continue
      edge.push(i)
      onEdge[i] = 1
    }
  }
  /**
   * A patch of one step smaller than `least` px is noise: it takes the step
   * it shares the longest border with. Pinned, hand-coloured and edge pixels
   * are left alone and count as no neighbour.
   */
  const merge = (ramps: number[], least: number) => {
    const free = (i: number) => p.z[i] > NONE && !p.pin[i] && p.fix[i] < 0 && !onEdge[i] && ramps.includes(p.ramp[i])
    for (let pass = 0; pass < 3; pass++) {
      const seen = new Uint8Array(w * h)
      let changed = false
      for (let i0 = 0; i0 < w * h; i0++) {
        if (seen[i0] || !free(i0)) continue
        const patch = [i0]
        seen[i0] = 1
        const border = new Map<number, number>()
        for (let q = 0; q < patch.length; q++) {
          const i = patch[q]
          const x = i % w
          for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
            if (j < 0 || j >= w * h || !free(j) || p.ramp[j] !== p.ramp[i0]) continue
            if (p.ix[j] === p.ix[i0]) { if (!seen[j]) { seen[j] = 1; patch.push(j) } } else border.set(p.ix[j], (border.get(p.ix[j]) ?? 0) + 1)
          }
        }
        if (patch.length >= least || !border.size) continue
        let best = -1
        let most = 0
        for (const [step, n] of border) if (n > most || (n === most && Math.abs(step - p.ix[i0]) < Math.abs(best - p.ix[i0]))) { best = step; most = n }
        for (const i of patch) p.ix[i] = best
        changed = true
      }
      if (!changed) break
    }
  }
  /** A pixel that hangs on its patch by one side only (a spur, the end of a hair) joins the step most of what is round it has. */
  const trim = (ramps: number[]) => {
    for (let pass = 0; pass < 3; pass++) {
      const next = p.ix.slice()
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x
        if (p.z[i] === NONE || p.pin[i] || p.fix[i] >= 0 || onEdge[i] || !ramps.includes(p.ramp[i])) continue
        let same = 0
        const other = new Map<number, number>()
        for (const j of [i - 1, i + 1, i - w, i + w]) {
          if (p.z[j] === NONE || p.ramp[j] !== p.ramp[i] || p.fix[j] >= 0 || onEdge[j]) continue
          if (p.ix[j] === p.ix[i]) same++
          else other.set(p.ix[j], (other.get(p.ix[j]) ?? 0) + 1)
        }
        if (same > 1) continue
        for (const [step, n] of other) if (n >= 2) next[i] = step
      }
      p.ix.set(next)
    }
  }
  if (o.merge) { merge(o.merge, 5); trim(o.merge); merge(o.merge, 5) }
  if (o.outline === 'in') {
    // The line is selective: dark under and east of the plant, a deeper shade of the leaf itself where the sky lights its edge.
    const line = new Map<number, number>()
    for (const i of edge) line.set(i, p.ny[i] > 0.3 && p.ix[i] >= 4 ? p.ix[i] - 2 : p.ny[i] > 0.1 && p.ix[i] >= 3 ? 1 : 0)
    // The line changes shade in runs, never for one pixel: a pixel that differs from the line on both sides of it takes its neighbours' shade.
    for (const i of edge) {
      const own = line.get(i)!
      const near: number[] = []
      for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) { const q = line.get(i + d); if (q !== undefined) near.push(q) }
      p.ix[i] = near.length && !near.includes(own) ? Math.min(...near) : own
    }
    // What the line cut off from its patch is noise again.
    if (o.merge) { merge(o.merge, 3); trim(o.merge); merge(o.merge, 3) }
  }
}

/**
 * The low sun on the west edge: one or two short runs of dim magenta one
 * pixel inside the outline, low on the west side, and one hot pixel in the
 * first of them. The engine lights the west edges itself, so this is only a
 * hint.
 */
function rimLight(p: Plot, L: Look, rampId: number, mass: Lobe, runs: number): void {
  const { w, h } = p
  const none = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || p.z[y * w + x] === NONE
  const cand = new Uint8Array(w * h)
  for (let y = 1; y < h - 2; y++) for (let x = 2; x < w - 1; x++) {
    const i = y * w + x
    if (p.z[i] === NONE || p.ramp[i] !== rampId || p.fix[i] >= 0) continue
    if (none(x - 1, y) || none(x + 1, y) || none(x, y - 1) || none(x, y + 1)) continue
    const ex = (x + 0.5 - mass.cx) / mass.rx
    const ey = (y + 0.5 - mass.cy) / mass.ry
    // Only the lowest two fifths of the west side: higher up, the engine's own light does this.
    if (ex > -0.15 || ey < 0.2) continue
    // The outline is the pixel west of it (and nothing but sky west of that), or the pixel under it.
    let sky = none(x - 2, y)
    for (let q = x - 3; sky && q >= 0; q--) if (!none(q, y)) sky = false
    if (sky || (none(x, y + 2) && ex < -0.3)) cand[i] = 1
  }
  // The candidates in runs along the contour, top to bottom.
  const list: number[][] = []
  for (let i0 = 0; i0 < w * h; i0++) {
    if (cand[i0] !== 1) continue
    const run = [i0]
    cand[i0] = 2
    for (let q = 0; q < run.length; q++) {
      const i = run[q]
      for (const d of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) { const j = i + d; if (cand[j] === 1) { cand[j] = 2; run.push(j) } }
    }
    if (run.length >= 4) list.push(run.sort((a, b) => a - b))
  }
  if (!list.length) return
  const n = Math.min(runs, list.length)
  for (let k = 0; k < n; k++) {
    const run = list[Math.round((k + 0.5) * list.length / n - 0.5)]
    // Five pixels of it at most, in one piece: from its middle outward along the contour.
    const got = [run[run.length >> 1]]
    for (let q = 0; q < got.length && got.length < 5; q++) {
      for (const d of [-1, 1, -w, w, -w - 1, -w + 1, w - 1, w + 1]) {
        const j = got[q] + d
        if (got.length < 5 && run.includes(j) && !got.includes(j)) got.push(j)
      }
    }
    if (got.length < 3) continue
    got.sort((a, b) => a - b)
    got.forEach((i, q) => { p.fix[i] = packed(k === 0 && q === 1 ? L.hot : L.rim) })
  }
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
  // The plant stands on one of its own pixels: the one on its foot row nearest the point asked for.
  const fy = clamp(ay - y0, 0, h - 1)
  let fx = clamp(ax - x0, 0, w - 1)
  for (let d = 0; d < w; d++) {
    if (fx - d >= 0 && rgba[(fy * w + fx - d) * 4 + 3]) { fx -= d; break }
    if (fx + d < w && rgba[(fy * w + fx + d) * 4 + 3]) { fx += d; break }
  }
  return { w, h, ax: fx, ay: fy, rgba, norm }
}

// ---------------------------------------------------------------------------
// Trees and bushes
// ---------------------------------------------------------------------------

/** A bough as it is placed by hand: where its middle is from the crown's middle, and its half width and half height. */
type BoughAt = readonly [number, number, number, number]

/** The crowns of the four lone trees: a round oak, a tall one of uneven boughs, a broad lopsided one, a small one with a heavy head. */
const TREES: ReadonlyArray<readonly BoughAt[]> = [
  [[-2, -13, 12, 8.5], [-11, -5, 10, 7.5], [10, -6, 10.5, 8], [1, 2, 13, 8], [-10, 8, 10, 7], [10, 9, 10, 7], [0, 14, 9, 5.5]],
  [[1, -18, 8.5, 6.5], [-6, -11, 10, 7], [6, -10, 8.5, 6], [3, -2, 12, 7.5], [-9, 2, 8, 6.5], [-3, 9, 12, 7], [8, 7, 8.5, 6.5], [2, 15, 9, 5.5]],
  [[-7, -9, 13.5, 8.5], [9, -8, 11, 7], [-15, 1, 9, 6.5], [1, 0, 12, 7.5], [15, 2, 9.5, 6.5], [-7, 9, 11, 6.5], [8, 10, 11, 6]],
  [[0, -10, 13, 9], [-10, -1, 10, 7.5], [10, -2, 10.5, 7.5], [0, 6, 13, 7.5], [-8, 12, 8.5, 5.5], [8, 12, 8.5, 5.5]],
]

/** The crowns of the four forest trees, broader than they are tall: a full dome, twin heads, a wide flat one, a high dome. */
const CANOPIES: ReadonlyArray<readonly BoughAt[]> = [
  [[-3, -19, 14, 9], [-17, -11, 12, 8.5], [14, -12, 13.5, 8.5], [0, -5, 15, 9], [-21, 1, 10.5, 7.5], [21, 0, 10.5, 7.5], [-9, 8, 14, 8.5], [10, 9, 14, 8], [-19, 15, 10, 6.5], [0, 18, 12, 6.5], [19, 16, 10.5, 6.5]],
  [[-12, -18, 12, 8], [10, -20, 13, 8.5], [-22, -8, 9.5, 7], [-2, -9, 13, 8], [21, -9, 10.5, 7.5], [-13, 1, 14, 8.5], [10, 1, 15, 9], [-22, 10, 9.5, 6.5], [-3, 11, 13, 7.5], [19, 11, 11, 7], [-10, 18, 11, 6], [9, 19, 11, 6]],
  [[-6, -15, 16, 9], [13, -14, 13, 8], [-23, -7, 10, 7], [26, -6, 8, 6], [-9, -3, 14, 8], [10, -2, 15, 8.5], [-25, 5, 8.5, 6], [24, 5, 9.5, 6.5], [-12, 9, 13, 7.5], [8, 10, 14, 7.5], [-2, 16, 12, 6]],
  [[0, -23, 11, 7.5], [-11, -15, 12, 8], [11, -14, 12.5, 8], [-19, -4, 10.5, 8], [0, -5, 14, 9], [19, -3, 10.5, 8], [-11, 6, 13.5, 8.5], [10, 7, 14, 8.5], [-19, 15, 9.5, 6.5], [0, 16, 12.5, 7], [18, 16, 10, 6.5]],
]

/** The three bushes: low domes of small boughs, the lower ones wide enough that the outline has no waist. */
const BUSHES: ReadonlyArray<readonly BoughAt[]> = [
  [[-1, -6.5, 9, 6], [-8, -1.5, 7.5, 6], [8, -1, 7.5, 6], [0, 1, 9, 6], [-7.5, 5, 7.5, 5.5], [7.5, 5.5, 7.5, 5], [0, 6.5, 8.5, 4.5]],
  [[-3, -6, 8.5, 6], [6, -4, 8, 5.5], [-8.5, 0, 6.5, 6], [1, 1, 9, 6], [9, 2, 5.5, 5.5], [-6, 5.5, 8.5, 5], [6, 6, 8, 4.5], [0.5, 6.5, 8, 4.5]],
  [[-5, -5.5, 8, 5.5], [5, -7, 8, 6], [-10, 1, 5.5, 5.5], [10, 0.5, 5.5, 5.5], [0, 0.5, 9, 6], [-6, 5.5, 8.5, 5], [6, 5.5, 8.5, 5], [-0.5, 6.5, 8, 4.5]],
]

/** A crown ready to paint: the ball its boughs make together, and the boughs, each a flat cloud of leaves. */
interface Crown { mass: Lobe; boughs: Lobe[] }

/**
 * The boughs of a hand-placed crown, each a little off its place (so the
 * three looks are not copies), with the crown's underside on the row
 * `bottom`. What is lower on the picture is nearer the viewer, as on a crown
 * seen from a little above, so a bough hangs over the one above it.
 */
function crownForm(spec: readonly BoughAt[], R: () => number, cx: number, bottom: number, sx = 1, sy = 1): Crown {
  const list = spec.map(([x, y, rx, ry]) => [x * sx + (R() - 0.5) * 1.6, y * sy + (R() - 0.5) * 1.2, rx * sx * (0.95 + R() * 0.1), ry * sy * (0.95 + R() * 0.1)])
  let x0 = 1e9
  let x1 = -1e9
  let y0 = 1e9
  let y1 = -1e9
  for (const [x, y, rx, ry] of list) { x0 = Math.min(x0, x - rx); x1 = Math.max(x1, x + rx); y0 = Math.min(y0, y - ry); y1 = Math.max(y1, y + ry) }
  const dy = bottom - y1
  const mass: Lobe = { cx: cx + (x0 + x1) / 2, cy: (y0 + y1) / 2 + dy, rx: (x1 - x0) / 2, ry: (y1 - y0) / 2, rz: (x1 - x0) / 3, z: 24 }
  const boughs = list.map(([x, y, rx, ry], k) => ({ cx: cx + x, cy: y + dy, rx, ry, rz: ry * 0.4, z: mass.z + (y + dy - mass.cy) * 0.9 + k * 0.01 }))
  return { mass, boughs }
}

/** Keep the leaves off everything under a crown's underside: a flat arc, a little higher at the sides. */
function underside(p: Plot, mass: Lobe, bottom: number, rise: number): void {
  for (let x = 0; x < p.w; x++) {
    const ex = (x + 0.5 - mass.cx) / mass.rx
    const floor = bottom - rise * ex * ex
    for (let y = Math.max(0, Math.ceil(floor - 0.5)); y < p.h; y++) p.hole[y * p.w + x] = 1
  }
}

/**
 * Paint a crown: leaf clumps along every bough's edge (its scalloped
 * outline) and across its face. The clumps on the edge stand a little
 * proud of it, so the silhouette is leaves on boughs and not a row of
 * discs. The face of the first `big` boughs is one big leaf with its lit
 * arc instead (a bush's lit top is two or three of those, not many facets).
 */
function crown(p: Plot, R: () => number, c: Crown, leaf: number, rampId: number, sh: Shade, big = 0): void {
  c.boughs.forEach((b, k) => {
    const one = (x: number, y: number, r: number) => leafClump(p, x, y, r, rampId, (R() - 0.5) * 0.3, R(), b, c.mass, k + 1, sh)
    const n = Math.max(6, Math.round((Math.PI * (b.rx + b.ry)) / (leaf * 1.7)))
    const a0 = R() * 6.283
    for (let q = 0; q < n; q++) {
      const a = a0 + ((q + (R() - 0.5) * 0.5) / n) * 6.283
      const r = leaf * (0.75 + R() * 0.55)
      const out = r * (0.35 + R() * 0.45)
      one(b.cx + Math.cos(a) * (b.rx - out), b.cy + Math.sin(a) * (b.ry - out), r)
    }
    if (k < big) { leafClump(p, b.cx, b.cy + b.ry * 0.12, b.rx * 0.74, rampId, 0.2, 0, { ...b, z: b.z + 1.5 }, c.mass, k + 1, sh); return }
    const m = Math.round(((b.rx * b.ry) / (leaf * leaf)) * 1.1)
    for (let q = 0; q < m; q++) {
      const d = Math.sqrt((q + 0.5) / m) * 0.7
      const a = a0 + q * 2.39996
      one(b.cx + Math.cos(a) * d * b.rx + (R() - 0.5) * 1.5, b.cy + Math.sin(a) * d * b.ry + (R() - 0.5) * 1.5, leaf * (0.9 + R() * 0.4))
    }
  })
}

/**
 * Close the chinks in a painted crown: above the row `above`, a pixel the
 * leaves left open (the sky, or a limb behind them) that has leaves on
 * three sides becomes part of the leaf beside it. A crown has no pinholes.
 */
function plug(p: Plot, rampId: number, above: number): void {
  const { w } = p
  for (let pass = 0; pass < 4; pass++) {
    let changed = false
    for (let y = 1; y < above; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      if (p.z[i] > NONE && p.ramp[i] === rampId) continue
      const near = [i - w, i - 1, i + 1, i + w].filter(j => p.z[j] > NONE && p.ramp[j] === rampId)
      if (near.length < 3) continue
      const j = near[0]
      put(p, x, y, p.z[j], rampId, p.nx[j], p.ny[j], p.nz[j], p.part[j], 0, 0, p.tone[j])
      p.group[i] = p.group[j]
      changed = true
    }
    if (!changed) break
  }
}

/** Leaves picked out of a flat shade, as the classic crowns have them: a small arc of the next lighter step with the next darker under it. */
const LEAVES: ReadonlyArray<readonly string[]> = [
  ['.hh..', 'hhhh.', '.dddd'],
  ['.hhh.', 'hhhhh', '.ddd.'],
  ['hh..', 'hhh.', '.ddd'],
]

/**
 * Break up the flat shades of a painted crown with leaves, on a loose grid
 * so they are spread and never touch: only where the whole leaf lies in one
 * shade, lighter ones only up to the step the place may have.
 */
function leafMarks(p: Plot, R: () => number, mass: Lobe, rampId: number, gap: number, sh: Shade): void {
  const { w, h } = p
  const top = p.ramps[rampId].length - 1
  let row = 0
  for (let gy = mass.cy - mass.ry; gy < mass.cy + mass.ry; gy += gap * 0.8, row++) {
    for (let gx = mass.cx - mass.rx + (row % 2) * gap * 0.5; gx < mass.cx + mass.rx; gx += gap) {
      const g = LEAVES[Math.floor(R() * LEAVES.length)]
      const x0 = Math.round(gx + (R() - 0.5) * gap * 0.5)
      const y0 = Math.round(gy + (R() - 0.5) * gap * 0.4)
      if (R() < 0.2) continue
      let step = -1
      let ok = true
      for (let j = 0; j < g.length && ok; j++) for (let i = -1; i <= g[j].length && ok; i++) {
        const x = x0 + i
        const y = y0 + j
        const q = y * w + x
        if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || p.z[q] === NONE || p.ramp[q] !== rampId || p.fix[q] >= 0 || p.pin[q]) { ok = false; break }
        if (p.z[q - 1] === NONE || p.z[q + 1] === NONE || p.z[q - w] === NONE || p.z[q + w] === NONE) { ok = false; break }
        if (step < 0) step = p.ix[q]
        else if (p.ix[q] !== step) ok = false
      }
      if (!ok || step < 1) continue
      const { most } = crownLight(mass, x0 + 2.5, y0 + 1, top, sh)
      for (let j = 0; j < g.length; j++) for (let i = 0; i < g[j].length; i++) {
        const q = (y0 + j) * w + x0 + i
        if (g[j][i] === 'h' && step < most) p.ix[q] = step + 1
        if (g[j][i] === 'd' && step > 1) p.ix[q] = step - 1
      }
    }
  }
}

/**
 * Leaf tips: where a darker shade lies over a lighter one along a level
 * border (the lit top of a clump under the shade of the one behind it), one
 * pixel of the dark juts down into the light here and there, so the border
 * is a row of leaves and not a drawn arc. Never through a lit arc, and never
 * two close together.
 */
function leafTips(p: Plot, R: () => number, rampId: number): void {
  const { w, h } = p
  const flat = (i: number) => p.z[i] > NONE && p.ramp[i] === rampId && p.fix[i] < 0 && !p.pin[i]
  const done: number[] = []
  for (let y = 2; y < h - 3; y++) for (let x = 3; x < w - 3; x++) {
    const i = y * w + x
    if (!flat(i) || !flat(i - w) || !flat(i + w) || !flat(i + 2 * w)) continue
    const lo = p.ix[i]
    const hi = p.ix[i - w]
    // A level stretch of the border, three wide, with the light two deep under it.
    if (hi >= lo || lo < 3 || p.ix[i + w] < lo) continue
    let level = true
    for (const d of [-1, 1]) if (!flat(i + d) || p.ix[i + d] !== lo || !flat(i + d - w) || p.ix[i + d - w] !== hi || !flat(i + d + w) || p.ix[i + d + w] < lo) level = false
    if (!level || R() > 0.3) continue
    if (done.some(j => Math.abs((j % w) - x) < 5 && Math.abs(((j / w) | 0) - y) < 4)) continue
    p.ix[i] = hi
    done.push(i)
  }
}

/** Round off the small bumps in the normals of everything painted so far, over `r` px, keeping the big form. */
function soften(p: Plot, r: number): void {
  const { w, h } = p
  const out = [new Float32Array(w * h), new Float32Array(w * h), new Float32Array(w * h)]
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x
    if (p.z[i] === NONE) continue
    let nx = 0
    let ny = 0
    let nz = 0
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
      const xx = x + ox
      const yy = y + oy
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || ox * ox + oy * oy > r * r + 1) continue
      const j = yy * w + xx
      if (p.z[j] === NONE) continue
      nx += p.nx[j]
      ny += p.ny[j]
      nz += p.nz[j]
    }
    const l = Math.hypot(nx, ny, nz) || 1
    out[0][i] = nx / l
    out[1][i] = ny / l
    out[2][i] = nz / l
  }
  for (let i = 0; i < w * h; i++) if (p.z[i] > NONE) { p.nx[i] = out[0][i]; p.ny[i] = out[1][i]; p.nz[i] = out[2][i] }
}

/**
 * A root: the side it leaves the trunk on (-1 west, 1 east, or a share of
 * the radius for one that goes down under the trunk), how many px its toe
 * stands out past the trunk's side (never more than three), how far it drops
 * under the foot row (px), and its toe's radius (px; from 1.5 it is a stub,
 * as thick at its end as where it leaves the trunk).
 */
type Root = readonly [number, number, number, number]

/** Four ways to grip the ground, none of them even: two of them have one side of the trunk go straight into the ground. */
const ROOTS: ReadonlyArray<readonly Root[]> = [
  [[-1, 3, 0.2, 1.4], [1, 2, 0.6, 2], [0.3, 0, 1.2, 1.6]],
  [[-1, 3, 0.5, 1.9], [-0.1, 0, 1.2, 1.6]],
  [[1, 3, 0, 1.4], [-1, 2, 0.8, 2.1], [0.4, 0, 1.3, 1.5]],
  [[1, 2.6, 0.5, 2], [-0.35, 0, 1.1, 1.7]],
]

/**
 * A trunk from the foot up into the crown, with a lean, a fork and roots.
 * Above the row `shade` it stands in the crown's shadow. Returns the tops of
 * the toes that point at the sun.
 */
function trunk(
  p: Plot, x: number, foot: number, top: number, r0: number, r1: number, lean: number, rampId: number, z: number,
  shade: number, cap: number, roots: readonly Root[], fork: number,
): Array<[number, number]> {
  const mid = (foot + top) / 2
  const xm = x + lean * 0.35
  const xt = x + lean
  const rm = (r0 + r1) / 2 - 0.2
  limb(p, x, foot - r0 * 0.7, r0, xm, mid, rm, z, rampId, { bark: true, cap, shade })
  limb(p, xm, mid, rm, xt, top, r1, z, rampId, { bark: true, cap, shade })
  // The fork: two boughs into the leaves.
  const f = r1 * fork
  const a: [number, number] = [xt - f * 0.95, top - f]
  const b: [number, number] = [xt + f * 1.05, top - f * 0.8]
  limb(p, xt, top + 2, r1 * 0.7, (xt + a[0]) / 2, (top + 2 + a[1]) / 2, 1.2, z - 0.6, rampId, { cap: 3, shade, lift: -0.2 })
  limb(p, (xt + a[0]) / 2, (top + 2 + a[1]) / 2, 1.2, a[0], a[1], 0.9, z - 0.6, rampId, { cap: 3, shade, lift: -0.2 })
  limb(p, xt, top + 3, r1 * 0.7, (xt + b[0]) / 2, (top + 3 + b[1]) / 2, 1.2, z - 0.4, rampId, { cap: 3, shade, lift: -0.5 })
  limb(p, (xt + b[0]) / 2, (top + 3 + b[1]) / 2, 1.2, b[0], b[1], 0.9, z - 0.4, rampId, { cap: 3, shade, lift: -0.5 })
  const toes: Array<[number, number]> = []
  for (const [side, out, drop, thick] of roots) {
    const flank = Math.abs(side) === 1
    // The toe's middle: its outer edge is `out` px past the trunk's side.
    const tx = flank ? x + side * (r0 + out - thick) : x + side * r0
    const ty = foot - thick + 0.6 + drop
    // A flank root leaves the trunk well up, so the foot swells into it; the toe itself is short.
    const from = flank ? foot - r0 * 1.7 : foot - r0 * 0.5
    limb(p, x + side * r0 * 0.42, from, flank ? Math.max(thick, r0 * 0.6) : thick, tx, ty, thick, z + 0.3 + drop * 0.5, rampId, { cap, lift: side > 0 ? -0.5 : 0 })
    if (side < 0 || drop > 0.9) toes.push([tx, ty - thick])
  }
  return toes
}

/** The one light a trunk has above its own shade: a pixel on top of every toe that points at the sun, just inside the line. */
function toeLights(p: Plot, toes: Array<[number, number]>, rampId: number, step: number): void {
  for (const [tx, ty] of toes) {
    const x = Math.round(tx - 0.5)
    for (let y = Math.max(0, Math.round(ty) - 3); y < p.h - 1; y++) {
      const i = y * p.w + x
      if (p.z[i] === NONE || p.ramp[i] !== rampId) continue
      if (p.z[i + p.w] > NONE && p.ramp[i + p.w] === rampId && p.ix[i + p.w] > 0) p.ix[i + p.w] = step
      break
    }
  }
}

const BERRY = ['lm', 'd.']
const GLOW = ['.m.', 'mcm', '.m.']

/**
 * Berries in bunches, as they grow: two or three bunches of two or three,
 * all in the bush's lower or east half, never on its edge. `sizes` is how
 * many berries each bunch has.
 */
function berries(p: Plot, R: () => number, mass: Lobe, sizes: readonly number[], c: Neon): void {
  const spots = [[0.5, 0.05], [-0.3, 0.42], [0.2, 0.5]]
  const hang = [[0, 0], [3, 1], [-1, 3]]
  sizes.forEach((n, b) => {
    const bx = Math.round(mass.cx + (spots[b][0] + (R() - 0.5) * 0.16) * mass.rx)
    const by = Math.round(mass.cy + (spots[b][1] + (R() - 0.5) * 0.12) * mass.ry)
    for (let k = 0; k < n; k++) {
      const x = bx + hang[k][0]
      const y = by + hang[k][1]
      let ok = true
      for (let oy = -1; oy <= 2 && ok; oy++) for (let ox = -1; ox <= 2 && ok; ox++) {
        const i = (y + oy) * p.w + x + ox
        if (x + ox < 1 || y + oy < 1 || x + ox >= p.w - 1 || y + oy >= p.h - 1 || p.z[i] === NONE || p.fix[i] >= 0) ok = false
      }
      if (!ok) continue
      stamp(p, x, y, BERRY, c)
      // A berry sits in the leaves: a step of shade under it.
      for (const [ox, oy] of [[1, 1], [0, 2]]) { const i = (y + oy) * p.w + x + ox; if (p.fix[i] < 0 && p.ix[i] > 1) p.ix[i]-- }
    }
  })
}

/**
 * Small lights among the leaves in two huddles, clear of the edge and of
 * each other: the Wildwood's glowing plus signs down in the crown's shade
 * (`dim`: never on a leaf lighter than that step), or blossoms up where the
 * crown is lit. `at` is where the huddles are on the crown, in shares of
 * its radii: how far out to each side, and how far down the west one and
 * the east one are.
 */
function huddles(p: Plot, R: () => number, mass: Lobe, n: number, c: Neon, rows: readonly string[], dim: number, at: readonly [number, number, number]): void {
  let left = n
  for (const side of [-1, 1]) {
    const hx = mass.cx + side * mass.rx * (at[0] + R() * 0.2)
    const hy = mass.cy + mass.ry * (at[side < 0 ? 1 : 2] + R() * 0.25)
    let here = side < 0 ? Math.ceil(n / 2) : left
    for (let tries = 0; tries < 24 && here > 0; tries++) {
      const x = Math.round(hx + (R() - 0.5) * 12)
      const y = Math.round(hy + (R() - 0.5) * 8)
      let ok = true
      for (let oy = -2; oy <= 2 && ok; oy++) for (let ox = -2; ox <= 2 && ok; ox++) {
        const i = (y + oy) * p.w + x + ox
        if (x + ox < 0 || y + oy < 0 || x + ox >= p.w || y + oy >= p.h || p.z[i] === NONE || p.ramp[i] !== 0 || p.fix[i] >= 0 || p.ix[i] > dim) ok = false
      }
      if (!ok) continue
      stamp(p, x - 1, y - 1, rows, c)
      here--
      left--
    }
  }
}

/** The big plants take the light the same way; a bush is all crown, so its belly is the ground's shade. */
const CROWN_SHADE: Shade = { mid: 3.2, mass: 2, bough: 1.95, belly: 0.55, under: 0.58, bellyAt: 0.42 }
const BUSH_SHADE: Shade = { mid: 3.8, mass: 2, bough: 1.5, belly: 0.4, under: 0.95, bellyAt: 0.66 }

function paintTree(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 64
  const H = 72
  const p = plot(W, H, [L.leaf[v], L.bark])
  const cx = 32
  const foot = H - 4
  const lean = [1.5, -2, 2.5, -1][v]
  // How much trunk shows under the crown: the broad tree stands on a long leg.
  const bare = [19, 17, 25, 22][v]
  const bottom = foot - bare
  const c = crownForm(TREES[v], R, cx + lean, bottom, 0.94)
  underside(p, c.mass, bottom, 2.5)
  const toes = trunk(p, cx, foot, bottom - 4, [4.3, 3.4, 5, 3.8][v], [3.1, 2.5, 3.5, 2.8][v], lean, 1, 15, bottom + bare * 0.4, L.barkTop, ROOTS[v], 2.7)
  crown(p, R, c, 3.3 / Math.sqrt(L.dense), 0, CROWN_SHADE)
  plug(p, 0, bottom - 3)
  ink(p, { outline: 'in', shadow: 3, gamma: 1.25, crease: 1.7, merge: [0] })
  toeLights(p, toes, 1, L.barkTop + 1)
  leafMarks(p, R, c.mass, 0, 8, CROWN_SHADE)
  leafTips(p, R, 0)
  rimLight(p, L, 0, c.mass, 2)
  if (v === 3 && !L.glow) huddles(p, R, c.mass, 6, PINK, CROSS, 6, [0.25, -0.45, 0.05])
  if (L.glow && v % 2 === 1) huddles(p, R, c.mass, 4, L.glow, GLOW, 3, [0.3, 0.25, 0.25])
  return cut(p, cx, foot)
}

function paintCanopy(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 76
  const H = 90
  const p = plot(W, H, [L.leaf[v], L.bark])
  const cx = 38
  const foot = H - 4
  const lean = [0, 1.5, -2, 1][v]
  // Forest trees stand shoulder to shoulder: broad heads on long trunks the row in front hides.
  const bare = [26, 23, 32, 25][v]
  const bottom = foot - bare
  // The twin-headed one is the broadest and the lowest, so a row of them has no two alike.
  const c = crownForm(CANOPIES[v], R, cx + lean, bottom, v === 1 ? 1 : 0.93, v === 1 ? 0.95 : 1)
  underside(p, c.mass, bottom, 3)
  // No two of them have the same girth, so a row of them is not a fence.
  const toes = trunk(p, cx, foot, bottom - 5, [5.4, 4.5, 6.4, 5][v], [4.2, 3.5, 4.9, 3.8][v], lean, 1, 17, bottom + bare * 0.4, L.barkTop, ROOTS[(v + 2) % 4], 3.4)
  crown(p, R, c, 3.7 / Math.sqrt(L.dense), 0, CROWN_SHADE)
  plug(p, 0, bottom - 4)
  ink(p, { outline: 'in', shadow: 3, gamma: 1.25, crease: 1.7, merge: [0] })
  toeLights(p, toes, 1, L.barkTop + 1)
  leafMarks(p, R, c.mass, 0, 8, CROWN_SHADE)
  leafTips(p, R, 0)
  rimLight(p, L, 0, c.mass, 2)
  if (L.glow && v % 2 === 0) huddles(p, R, c.mass, 5, L.glow, GLOW, 3, [0.3, 0.25, 0.25])
  return cut(p, cx, foot)
}

function paintBush(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 40
  const H = 36
  const p = plot(W, H, [L.shrub])
  const cx = 20
  const foot = H - 4
  // Round and friendly, wider than tall, flat where it sits; its leaves are smaller than a tree's.
  const c = crownForm(BUSHES[v], R, cx, foot + 1, 0.91, 1.2)
  underside(p, c.mass, foot + 1, 1.5)
  crown(p, R, c, 2.35 / Math.sqrt(L.dense), 0, BUSH_SHADE, v === 2 ? 3 : 2)
  // One mound: its leaves are painted, not modelled.
  soften(p, 2)
  ink(p, { outline: 'in', shadow: 0, gamma: 1.2, crease: 1.5, merge: [0] })
  leafMarks(p, R, c.mass, 0, 7, BUSH_SHADE)
  leafTips(p, R, 0)
  // Berries, as on the classic bush.
  berries(p, R, c.mass, [[2, 3], [3], [3, 2]][v], L.glow ?? PINK)
  return cut(p, cx, foot)
}

// ---------------------------------------------------------------------------
// Grass, tufts, flowers, reeds
// ---------------------------------------------------------------------------

/** The four tussocks of tall grass: how many blades stand in front, half the fan's width, how tall, which way the wind has bent them. */
const TALL = [
  { n: 9, span: 9, tall: 19, wind: 0.15 },
  { n: 8, span: 7.5, tall: 20, wind: -0.25 },
  { n: 11, span: 10.5, tall: 16, wind: 0.1 },
  { n: 9, span: 8.5, tall: 19, wind: 0.3 },
]

/**
 * Tall grass: a clump, thick in its lower half, on a root no wider than
 * half of it. Broad dark blades behind make the mass, the outer ones lying
 * low and out; green blades stand in front of them, lighter to the west;
 * and a few of those have caught the lamps on their last pixel.
 */
function paintTall(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 36
  const H = 28
  const p = plot(W, H, [L.grass])
  const cx = 18
  const foot = H - 2
  const S = TALL[v]
  // A blade is rooted near the middle and its tip leans away from it, never further out than it is tall.
  const fan = (f: number, len: number, w0: number, z: number, lo: number, hi: number, tip: number) => {
    const x0 = cx + f * S.span * 0.34
    const a = Math.abs(f)
    const out = clamp(f * S.span * 0.78 + S.wind * len * 0.3, -len * 0.85, len * 0.85)
    blade(p, x0, foot, x0 + out, foot - len, -out * (0.45 - 0.3 * a), w0, z, 0, lo, hi, { root: a < 0.5 ? 1.6 / len : 0, tip, tipRows: 1, full: true })
  }
  // The thick of it: broad blades in the darker green (dark enough to be a mass, light enough to stand off the ground at dusk), the outer ones low.
  const m = Math.round(S.span * 0.8)
  for (let k = 0; k <= m; k++) {
    const f = k / m * 2 - 1
    fan(f, S.tall * (0.76 - 0.3 * f * f) * (0.92 + R() * 0.16), 4, 9.5 + k * 0.01, k % 2 ? 1 : 2, 2, 0)
  }
  // The blades in front, in the body's green; every third is a step lighter and has caught a lamp on its tip.
  for (let k = 0; k < S.n; k++) {
    const f = (k + (R() - 0.5) * 0.4) / (S.n - 1) * 2 - 1
    const lit = k % 3 === v % 3
    const len = S.tall * (1 - 0.4 * f * f) * (lit ? 0.92 + R() * 0.08 : 0.66 + R() * 0.24)
    fan(f, len, 2, 10.5 + k * 0.01 + (lit ? 1 : 0), lit ? 4 : 2, lit ? 4 : 3, lit ? 5 : 0)
  }
  // The foot is round, not a sill: its two corners go.
  const row = Math.round(foot - 0.5)
  for (const dir of [1, -1]) for (let x = dir > 0 ? 0 : W - 1; x >= 0 && x < W; x += dir) if (p.z[row * W + x] > NONE) { p.z[row * W + x] = NONE; break }
  ink(p, { outline: 'none', shadow: 0, gamma: 1 })
  return cut(p, cx, foot)
}

/** The ground tufts made of blades: where each is rooted, how far its tip leans, how tall, the step of its last pixel (0: none), how wide, the step of its lit side (its other side is one darker). */
const TUFTS: ReadonlyArray<ReadonlyArray<readonly [number, number, number, number, number, number]>> = [
  [[-2, -2.5, 6, 0, 2, 4], [0, 0.5, 9, 5, 2, 3], [2, 3, 6, 0, 2, 3]],
  [[-1.5, -3.5, 8, 5, 2, 4], [1, 1.5, 7, 0, 2, 3], [0.5, 4, 4, 0, 2, 3]],
  [[-3, -4, 5, 0, 2, 4], [-1, -1, 7, 5, 2, 3], [1, 1.5, 6, 0, 2, 3], [3, 4, 4.5, 0, 2, 3]],
  // A fern: short broad leaves in a rosette.
  [[-1, -5.5, 5, 0, 3, 4], [0, -1, 7, 5, 3, 3], [1, 5, 5.5, 0, 3, 3]],
  // A spray of five thin blades.
  [[-2, -4.5, 4, 0, 1, 4], [-1, -2.5, 7, 5, 1, 4], [0, 0, 8, 0, 2, 3], [1, 2.5, 6, 0, 1, 3], [2, 4.5, 3.5, 0, 1, 3]],
]

/** A tuft is a few blades of the grass's body greens, the western one a step lighter, one of them with a lit pixel on its tip; only its root pixel is dark. A dark tuft is lost on the ground at dusk. */
function paintTuft(L: Look, v: number, _seed: number): Cut {
  const W = 22
  const H = 18
  const p = plot(W, H, [L.grass, L.bark])
  const cx = 11
  const foot = H - 2
  if (v < 5) {
    for (const [x0, dx, tall, tip, w0, hi] of TUFTS[v]) blade(p, cx + x0, foot, cx + x0 + dx, foot - tall, dx * 0.3, w0, 10, 0, hi - 1, hi, { root: 1.2 / tall, tip, tipRows: 1, full: true })
    ink(p, { outline: 'none', shadow: 0, gamma: 1 })
    return cut(p, cx, foot)
  }
  if (L.glow) {
    // The Wildwood's own: two small lit caps. It stands on the stem of the bigger one.
    limb(p, cx - 2, foot, 1, cx - 2, foot - 5, 0.9, 9, 1, { lift: 1 })
    limb(p, cx + 3, foot, 0.8, cx + 3, foot - 3, 0.7, 9, 1, { lift: 1 })
    stamp(p, cx - 5, foot - 8, ['.mll.', 'mllcl', 'dmmmm'], L.glow, 12)
    stamp(p, cx + 1, foot - 5, ['.ml.', 'dmlm'], L.glow, 12)
    ink(p, { outline: 'none', shadow: 0, gamma: 1 })
    return cut(p, cx - 2, foot)
  }
  // A seedling: two leaves and a pale bud.
  blade(p, cx, foot, cx, foot - 6, 0, 1, 9, 0, 2, 3, { root: 0.2, tip: 0 })
  blade(p, cx, foot - 2, cx - 4, foot - 5, -1, 2, 10, 0, 2, 3, { tip: 4, tipRows: 1 })
  blade(p, cx, foot - 2, cx + 4, foot - 6, 1, 2, 10, 0, 2, 2, { tip: 0 })
  draw(p, cx - 1, foot - 8, ['45', '34'], 0, 11)
  ink(p, { outline: 'none', shadow: 0, gamma: 1 })
  return cut(p, cx, foot)
}

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
  // Stems go dark toward the ground, and a leaf or two sits on it, so the blossoms stand somewhere.
  const stem = { root: 0.3, tip: 0 }
  const leaf = { root: 0.35, tip: 3, tipRows: 1 }
  if (v === 0) {
    // One daisy on a stem, a leaf either side.
    blade(p, cx, foot, cx + 0.5, foot - 6, 0, 1, 9, 0, 2, 3, stem)
    blade(p, cx, foot, cx - 3.5, foot - 3, -0.5, 2, 10, 0, 1, 2, leaf)
    blade(p, cx, foot, cx + 3.5, foot - 4, 0.5, 2, 10, 0, 1, 2, { root: 0.35, tip: 0 })
    stamp(p, cx - 2, foot - 11, DAISY, n)
  } else if (v === 1) {
    // Three small crosses at three heights.
    blade(p, cx - 3, foot, cx - 3.5, foot - 4, 0, 1, 9, 0, 2, 3, stem)
    blade(p, cx, foot, cx + 0.5, foot - 7, 0, 1, 9, 0, 2, 3, stem)
    blade(p, cx + 3, foot, cx + 4, foot - 3, 0, 1, 9, 0, 2, 3, stem)
    blade(p, cx - 1, foot, cx - 2, foot - 2.5, 0, 2, 10, 0, 1, 2, leaf)
    blade(p, cx + 1, foot, cx + 2, foot - 2, 0, 2, 10, 0, 1, 2, { root: 0.5, tip: 0 })
    stamp(p, cx - 5, foot - 7, CROSS, n)
    stamp(p, cx - 1, foot - 10, CROSS, n)
    stamp(p, cx + 3, foot - 6, CROSS, n)
  } else {
    // Two bells nodding apart.
    blade(p, cx - 1, foot, cx - 2.5, foot - 6, -0.5, 1, 9, 0, 2, 3, stem)
    blade(p, cx + 1, foot, cx + 3, foot - 4, 0.5, 1, 9, 0, 2, 3, stem)
    blade(p, cx, foot, cx, foot - 3.5, R() - 0.5, 2, 10, 0, 1, 2, leaf)
    stamp(p, cx - 4, foot - 10, BELL, n)
    stamp(p, cx + 1, foot - 8, BELL, n)
  }
  ink(p, { outline: 'none', shadow: 0, gamma: 1 })
  return cut(p, cx, foot)
}

/** The three reeds: every stalk's root (px from the middle), height and how far its top leans; then the long leaves the same way. */
const REEDS: ReadonlyArray<{ stalks: ReadonlyArray<readonly [number, number, number]>; leaves: ReadonlyArray<readonly [number, number, number]> }> = [
  { stalks: [[-1, 28, -1.5], [2, 21, 1.5]], leaves: [[-2, 13, -4], [1, 15, 4.5]] },
  { stalks: [[0, 27, 1.5]], leaves: [[-1, 16, -4.5], [1, 12, 4], [0, 19, -1.5]] },
  { stalks: [[-2, 24, -2.5], [2, 28, 1]], leaves: [[-1, 11, -4], [2, 16, 4.5]] },
]

function paintReed(L: Look, v: number, _seed: number): Cut {
  const W = 22
  const H = 34
  const p = plot(W, H, [L.grass, HEAD])
  const cx = 11
  const foot = H - 2
  const S = REEDS[v]
  // Long leaves behind, curving out from the foot.
  for (const [x0, tall, lean] of S.leaves) blade(p, cx + x0, foot, cx + x0 + lean, foot - tall, lean * 0.45, 2, 9, 0, 1, 2, { root: 0.3, tip: 3, tipRows: 2 })
  // Stalks in front: one line from the ground to the spike, and one head on it.
  for (const [x0, tall, lean] of S.stalks) {
    const id = ++p.parts
    const head = ++p.parts
    // The head is straight, whatever the stalk under it does.
    const from = tall - 7
    for (let k = 0; k < tall; k++) {
      const t = Math.min(k, from) / (tall - 1)
      const x = Math.round(cx + x0 + lean * t * t - 0.5)
      const y = Math.round(foot - 0.5) - k
      put(p, x, y, 11, 0, 0, 0.3, 0.9, id, (k < tall * 0.14 ? 0 : k < tall * 0.3 ? 1 : k >= tall - 2 ? 3 : 2) + 1)
      // The head: five rows of velvet two wide under the bare spike, lit from the west.
      const q = tall - 3 - k
      if (q < 0 || q > 4) continue
      const west = lean < 0 ? x - 1 : x
      put(p, west, y, 12.5, 1, -0.6, 0.15, 0.75, head, (q === 0 ? 4 : q === 4 ? 2 : 3) + 1)
      put(p, west + 1, y, 12.5, 1, 0.6, 0.1, 0.75, head, (q === 4 ? 1 : 2) + 1)
    }
  }
  // The foot stands in its own shade.
  const sill = ++p.parts
  for (let x = cx - 1; x <= cx + 1; x++) put(p, x, Math.round(foot - 0.5), 13, 0, 0, 0.3, 0.9, sill, 1)
  ink(p, { outline: 'none', shadow: 0, gamma: 1 })
  return cut(p, cx, foot)
}

// ---------------------------------------------------------------------------
// The palm
// ---------------------------------------------------------------------------

/**
 * A palm frond: a spine that leaves the crown at `ang` (radians, 0 east, up
 * positive) and sinks under its own weight, with leaflets out to both sides
 * that hang the more the more they point down. The leaflets go in uneven
 * bands, light and dark and shorter, so the frond is striped and its edge is
 * toothed. Its normal faces the viewer at the crown and turns out along the
 * spine toward the tip, so the light sees it arc.
 */
function frond(p: Plot, x0: number, y0: number, ang: number, len: number, droop: number, leaf: number, z0: number, rampId: number, tone: number, phase: number): void {
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
    const curl = 0.1 + 0.85 * t
    const face = 1 - 0.7 * t
    // Bands of three light, two dark, two light, two dark px along the spine.
    const q = (t * len + phase) % 9
    const dark = (q >= 3 && q < 5) || q >= 7
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
        put(p, Math.round(x + ux * s - 0.5), Math.round(y + uy * s - 0.5), z0 - s * 0.08 + t * 0.4, rampId, ux * 0.35 + tx * curl, 0.3 - uy * 0.3 - ty * curl, face, id, step + 1)
      }
    }
    put(p, Math.round(x - 0.5), Math.round(y - 0.5), z0 + 0.5 + t * 0.4, rampId, tx * curl, 0.5 - ty * curl, face, id, clamp(tone + (t < 0.7 ? 2 : 1), 1, top) + 1)
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

/** A coconut: two by two, with the light on its upper west pixel. */
const NUT = ['42', '21']

function paintPalm(L: Look, v: number, seed: number): Cut {
  const R = seeded(seed)
  const W = 70
  const H = 88
  const p = plot(W, H, [L.frond, L.stem, L.bark, L.husk])
  const dir = v === 0 ? 1 : -1
  const fx = dir > 0 ? 22 : 48
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
    limb(p, px, py, r0, x, y, r1, 14, 1, { ring: arc, cap: L.stemTop, shade: hy + 12, lift: 0.4 })
    arc += Math.hypot(x - px, y - py)
    px = x
    py = y
  }
  limb(p, fx - 1, foot - 3, 3.6, fx - 4.5, foot - 0.6, 1.6, 14.3, 1, { cap: L.stemTop, lift: 0.4 })
  limb(p, fx + 1, foot - 3, 3.6, fx + 4.5, foot - 1, 1.6, 14.2, 1, { cap: L.stemTop })
  limb(p, fx, foot - 3, 4.4, fx, foot - 1.5, 3.4, 14.5, 1, { cap: L.stemTop, lift: 0.4 })
  // Fronds, the far ones first: back and up, out to the sides, then the near ones falling toward the viewer.
  // The ones on the side the palm leans to are longer and hang lower; the others are short and stand up more.
  const F: Array<[number, number, number, number, number, number]> = [
    // angle (degrees), length, droop, leaflet length, depth, tone
    [100, 14, 0.18, 6, 10, 2], [58, 22, 0.44, 7, 11, 2], [140, 17, 0.3, 6.5, 11, 2],
    [20, 26, 0.7, 9, 16, 3], [164, 20, 0.46, 8, 16, 3],
    [-24, 22, 0.6, 9, 19, 4], [204, 17, 0.44, 8, 19, 4],
    [-68, 13, 0.5, 7, 21, 4], [250, 10, 0.4, 6.5, 21, 4],
  ]
  for (const [deg, len, droop, leaf, z, tone] of F) {
    const a = ((dir > 0 ? deg : 180 - deg) + (R() - 0.5) * 10) * Math.PI / 180
    frond(p, hx, hy, a, len * (0.9 + R() * 0.2), droop, leaf, z, 0, tone, Math.floor(R() * 9))
  }
  // The heart of the crown, and the nuts under it.
  clump(p, hx, hy, 3.4, 3, 22, 2, 0, 0.12)
  ink(p, { outline: 'in', shadow: 3, gamma: 1.3 })
  underline(p, 0)
  draw(p, Math.round(hx) - 3, Math.round(hy) + 3, NUT, 3, 60)
  draw(p, Math.round(hx), Math.round(hy) + 4, NUT, 3, 61)
  if (v === 0) draw(p, Math.round(hx) + 2, Math.round(hy) + 2, NUT, 3, 60)
  for (let i = 0; i < p.w * p.h; i++) if (p.pin[i] && p.ramp[i] === 3) p.ix[i] = p.pin[i] - 1
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
