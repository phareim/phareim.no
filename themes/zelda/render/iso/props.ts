/**
 * The standing things of the 16-bit view: lamp posts, graves, pots, rocks,
 * boulders, signposts, pillars, stools, counters, chests, the Shrine's
 * crystal blocks and fences. Pure: no canvas, no DOM.
 *
 * In the classic art these are sixteen px seen from the front, and turned
 * into the isometric view they stay cards of that art at twice the size.
 * Here each is built once as a few solids (boxes, posts, balls) standing on
 * the ground, and drawn the way the view sees the world: from the
 * south-east, looking down. A signboard runs away to the right, a
 * gravestone has a side, a lamp's lantern has a lid. Every pixel knows which
 * way it faces, so the lamps and the low sun light it like everything else,
 * and a lantern's panes glow by themselves.
 *
 * They are drawn as pixel art: every pixel is one flat step of its
 * material's ramp, picked in hard steps from an artist's light (the top
 * lightest, the south side a step down, the east side darkest, whatever the
 * hour: the engine's own light does the rest); a dark line goes round the
 * lower right of the silhouette only; what stands in front of something
 * lays a step of shade on it.
 *
 * The camera is the scene's. Lengths are in scene px (32 to the tile): a
 * point (x east, y south, z up) lands at (x − y, (x + y) / 2 − z) from the
 * sprite's anchor, the point of ground under its middle.
 *
 * `buildProps()` is seeded and built once (`stepProps()` a thing at a time).
 * `scripts/zelda-lab/props-sheet.mjs` draws them all.
 */

import { PUZZLE_BUILD, PUZZLE_PROP_KINDS, type PuzzlePropKind } from './puzzleProps'

/** A fence's part of one tile, by where the fence goes on: 1 west, 2 east, 4 north, 8 south, added up. */
export type FenceKind = `fence${number}`
export type PropKind = 'lampPink' | 'lampCyan' | 'grave' | 'pot' | 'rock' | 'boulder' | 'sign' | 'pillarStone' | 'pillarShrine' | 'stool'
  | 'counter' | 'counterN' | 'counterS' | 'counterNS' | 'counterY'
  | 'chest' | 'chestOpen' | 'bigChest' | 'bigChestOpen' | 'blockPink' | 'blockCyan'
  | FenceKind
  | PuzzlePropKind // the physical puzzles' things (`puzzleProps.ts`)
export const PROP_KINDS: readonly PropKind[] = [
  'lampPink', 'lampCyan', 'grave', 'pot', 'rock', 'boulder', 'sign', 'pillarStone', 'pillarShrine', 'stool',
  'counter', 'counterN', 'counterS', 'counterNS', 'counterY',
  'chest', 'chestOpen', 'bigChest', 'bigChestOpen', 'blockPink', 'blockCyan',
  ...Array.from({ length: 16 }, (_, i): FenceKind => `fence${i}`),
  ...PUZZLE_PROP_KINDS,
]

/** How high a counter's top lies, in scene px: what stands on a counter stands there. */
export const COUNTER_TOP = 17

/** A sprite's cell, in scene px. (ax, ay) is the point on the ground under the middle of the thing. */
export const PROP = { w: 80, h: 88, ax: 40, ay: 70 } as const

export interface PropSprite { x: number; y: number; w: number; h: number; ax: number; ay: number; /** The first row of the cell with anything drawn on it. */ top: number }
export interface PropAtlas {
  w: number
  h: number
  /**
   * RGB, and in the alpha where the pixel is in depth: 0 nothing; else 128 + 4 × how many px nearer the
   * viewer than the anchor the surface lies along the ground (`depthCode`), so the engine can give every
   * pixel its own depth and a long thing stands in the world as a solid, not as a card.
   */
  albedo: Uint8ClampedArray
  /** rgb = the surface normal as (right, up, toward the viewer) * 0.5 + 0.5; a = how much the pixel glows by itself. */
  normal: Uint8ClampedArray
  sprites: Record<PropKind, PropSprite>
}

/** The byte that says a surface lies `q` px nearer the viewer than its sprite's anchor (never 0: that is no pixel). */
export function depthCode(q: number): number {
  return Math.max(1, Math.min(255, Math.round(q * 4) + 128))
}

type Rgb = readonly [number, number, number]
const rgb = (s: string): Rgb => { const v = parseInt(s.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }

/** A material: five steps (outline, shade, the colour, light, highlight), and how much it glows by itself. */
interface Mat { ramp: Rgb[]; glow: number }
const mat = (glow: number, ...c: string[]): Mat => ({ ramp: c.map(rgb), glow })

/** The things' materials (shared with the polygon view, which builds the same things as meshes). */
export const MATS = {
  pole: mat(0, '#120a20', '#1e1434', '#34285a', '#4e4080', '#7466a8'),
  glassPink: mat(1, '#ff2fa0', '#ff2fa0', '#ff5fd0', '#ff5fd0', '#ffb0ec'),
  glassCyan: mat(1, '#2ff3ff', '#2ff3ff', '#6ff6ff', '#6ff6ff', '#c4fbff'),
  core: mat(1, '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'),
  stone: mat(0, '#2a2650', '#443f72', '#6f6aa0', '#9690c4', '#bcb6e4'),
  carve: mat(0, '#2a2650', '#34305e', '#443f72', '#443f72', '#5a558a'),
  moss: mat(0, '#12483f', '#1f7a6e', '#2fa88c', '#3fd8b0', '#8ffce0'),
  clay: mat(0, '#3a1812', '#7a3826', '#b0543a', '#e07a4e', '#ffa878'),
  bandCyan: mat(0.35, '#12708c', '#1a9fc4', '#2ff3ff', '#6ff6ff', '#c4fbff'),
  bandPink: mat(0.35, '#7a1050', '#b01874', '#ff2fa0', '#ff5fd0', '#ffb0ec'),
  dark: mat(0, '#0b0616', '#0b0616', '#120a20', '#1c1030', '#1c1030'),
  rock: mat(0, '#2a1f4a', '#5a5285', '#8f86b8', '#b4acdc', '#dcd6ff'),
  boulder: mat(0, '#1c1438', '#3a2c66', '#5b4b8e', '#7a68b0', '#9c8cd0'),
  crack: mat(0, '#1c1438', '#1c1438', '#271c4a', '#271c4a', '#3a2c66'),
  wood: mat(0, '#2c1622', '#472536', '#6e3d4e', '#8e5566', '#b07486'),
  ink: mat(0, '#2c1622', '#2c1622', '#472536', '#472536', '#472536'),
  shrine: mat(0, '#19143a', '#271f50', '#3a2f70', '#4a3d88', '#6456a8'),
  neon: mat(1, '#ff2fa0', '#ff2fa0', '#ff2fa0', '#ff5fd0', '#ff5fd0'),
  velvet: mat(0, '#5a0f2c', '#8a1840', '#c42a5a', '#ff3b5c', '#ffb0c8'),
  chrome: mat(0, '#2a1f4a', '#5a5285', '#8f86b8', '#cfc6ff', '#fff4ff'),
  board: mat(0, '#2a1426', '#3a1e2c', '#472536', '#6e3d4e', '#8e5566'),
  lip: mat(0, '#2a1426', '#472536', '#6e3d4e', '#8e5566', '#b07486'),
  front: mat(0, '#150c22', '#1f1430', '#2b1c40', '#3d2a58', '#4f3a70'),
  seam: mat(0, '#150c22', '#150c22', '#1a1028', '#1a1028', '#1a1028'),
  chestWood: mat(0, '#24140c', '#3a2418', '#6a4432', '#8a5a44', '#a87458'),
  sand: mat(0, '#493045', '#805347', '#ab795c', '#cf9a73', '#e4b58a'),
  chestViolet: mat(0, '#2c1260', '#54259e', '#7c3cd0', '#9a4ff0', '#ff8ae0'),
  gold: mat(0.3, '#7a4e0c', '#c4861c', '#ffd23f', '#fff1b0', '#ffffff'),
  blockPink: mat(0, '#3a0830', '#6a1050', '#8a1868', '#b01874', '#ff2fa0'),
  blockCyan: mat(0, '#083846', '#0f5a70', '#147890', '#1a9fc4', '#2ff3ff'),
} as const
export type MatName = keyof typeof MATS
const MAT_NAMES = Object.keys(MATS) as MatName[]

/** Which material a point of a solid is: one, or a rule by where the point is and which way it faces. */
export type Pick = MatName | ((x: number, y: number, z: number, nx: number, ny: number, nz: number) => MatName)

/** What a thing is built with: boxes, posts and balls, in scene px (32 to the tile) about the point of ground under its middle. */
export interface Solids {
  ball(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, pick: Pick): void
  post(cx: number, cy: number, z0: number, z1: number, r: number, pick: Pick): void
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pick: Pick): void
}

const W: number = PROP.w
const H: number = PROP.h
const FAR = -1e9
/** The artist's light: from above, a little from the south-west, so the top is lightest and the east side darkest. */
const LIGHT = (() => { const v = [-0.36, 0.26, 0.9]; const n = Math.hypot(v[0]!, v[1]!, v[2]!); return [v[0]! / n, v[1]! / n, v[2]! / n] as const })()

/** One thing on the bench: for every pixel how near it is, what it is made of and which way it faces. */
class Bench {
  readonly t: Float32Array
  readonly m: Int8Array
  readonly nx: Float32Array
  readonly ny: Float32Array
  readonly nz: Float32Array
  /** 1: the pixel lies on its tile's edge, where the thing goes on into the next tile: no line is drawn round it there. */
  readonly open: Uint8Array

  constructor(private readonly grid: { w: number; h: number; ax: number; ay: number } = PROP) {
    const n = grid.w * grid.h
    this.t = new Float32Array(n).fill(FAR)
    this.m = new Int8Array(n).fill(-1)
    this.nx = new Float32Array(n)
    this.ny = new Float32Array(n)
    this.nz = new Float32Array(n)
    this.open = new Uint8Array(n)
  }

  /** A point of a solid at pixel i, `t` along the line of sight (larger is nearer). */
  private hit(i: number, t: number, x: number, y: number, z: number, nx: number, ny: number, nz: number, pick: Pick) {
    if (t <= this.t[i]!) return
    this.t[i] = t
    this.m[i] = MAT_NAMES.indexOf(typeof pick === 'string' ? pick : pick(x, y, z, nx, ny, nz))
    this.nx[i] = nx; this.ny[i] = ny; this.nz[i] = nz
    this.open[i] = Math.abs(x) > 15.2 || Math.abs(y) > 15.2 ? 1 : 0
  }

  /** Every pixel's line of sight: it passes through (x0, y0, 0) and runs along (1, 1, 1) toward the viewer. */
  private each(fn: (i: number, x0: number, y0: number) => void) {
    const { w, h, ax, ay } = this.grid
    for (let py = 0; py < h; py++) for (let px = 0; px < w; px++) {
      const sx = px + 0.5 - ax
      const sy = py + 0.5 - ay
      fn(py * w + px, sx / 2 + sy, sy - sx / 2)
    }
  }

  /** An ellipsoid. */
  ball(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, pick: Pick) {
    const ax = 1 / (rx * rx)
    const ay = 1 / (ry * ry)
    const az = 1 / (rz * rz)
    this.each((i, x0, y0) => {
      const ox = x0 - cx
      const oy = y0 - cy
      const oz = -cz
      const A = ax + ay + az
      const B = 2 * (ox * ax + oy * ay + oz * az)
      const C = ox * ox * ax + oy * oy * ay + oz * oz * az - 1
      const d = B * B - 4 * A * C
      if (d < 0) return
      const t = (-B + Math.sqrt(d)) / (2 * A)
      if (t < 0) return
      const x = ox + t
      const y = oy + t
      const z = oz + t
      const n = Math.hypot(x * ax, y * ay, z * az) || 1
      this.hit(i, t, x + cx, y + cy, t, (x * ax) / n, (y * ay) / n, (z * az) / n, pick)
    })
  }

  /** A post: a standing cylinder from z0 to z1, flat on top. */
  post(cx: number, cy: number, z0: number, z1: number, r: number, pick: Pick) {
    this.each((i, x0, y0) => {
      const ox = x0 - cx
      const oy = y0 - cy
      const B = 2 * (ox + oy)
      const C = ox * ox + oy * oy - r * r
      const d = B * B - 8 * C
      if (d < 0) return
      const t = (-B + Math.sqrt(d)) / 4
      if (t >= z0 && t <= z1) { this.hit(i, t, x0 + t, y0 + t, t, (ox + t) / r, (oy + t) / r, 0, pick); return }
      if (t > z1) {
        const x = ox + z1
        const y = oy + z1
        if (x * x + y * y <= r * r) this.hit(i, z1, x0 + z1, y0 + z1, z1, 0, 0, 1, pick)
      }
    })
  }

  /** A box with its sides along the ground's axes. */
  box(x0b: number, y0b: number, z0b: number, x1b: number, y1b: number, z1b: number, pick: Pick) {
    this.each((i, x0, y0) => {
      const tx = x1b - x0
      const ty = y1b - y0
      const out = Math.min(tx, ty, z1b)
      const into = Math.max(x0b - x0, y0b - y0, z0b)
      if (into > out) return
      if (out === z1b) this.hit(i, out, x0 + out, y0 + out, out, 0, 0, 1, pick)
      else if (out === ty) this.hit(i, out, x0 + out, y0 + out, out, 0, 1, 0, pick)
      else this.hit(i, out, x0 + out, y0 + out, out, 1, 0, 0, pick)
    })
  }

  /**
   * The picture: colours picked in steps, the line round the lower right, shade under what stands in front.
   * `lined`: false for a part of something longer, whose silhouette is not the thing's own.
   */
  paint(albedo: Uint8ClampedArray, normal: Uint8ClampedArray, aw: number, ox: number, oy: number, lined = true) {
    const { w, h, ay } = this.grid
    const tone = new Int8Array(w * h)
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && this.m[y * w + x]! >= 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (this.m[i]! < 0) continue
      const lam = this.nx[i]! * LIGHT[0] + this.ny[i]! * LIGHT[1] + this.nz[i]! * LIGHT[2]
      let k = lam > 0.93 ? 4 : lam > 0.62 ? 3 : lam > 0.2 ? 2 : 1
      const glows = MATS[MAT_NAMES[this.m[i]!]!].glow >= 1
      if (!glows) {
        // Something well in front, up and to the left of this pixel, lays a step of shade on it.
        const up = y > 0 && this.m[i - w]! >= 0 ? this.t[i - w]! - this.t[i]! : 0
        const left = x > 0 && this.m[i - 1]! >= 0 ? this.t[i - 1]! - this.t[i]! : 0
        if (up > 3.2 || left > 3.2) k = Math.max(1, k - 1)
        // The line round the silhouette, on the lower right only.
        if (lined && !this.open[i] && (!filled(x + 1, y) || !filled(x, y + 1))) k = 0
        else if (k === 4 && (!filled(x - 1, y) || !filled(x, y - 1))) k = 3
      }
      tone[i] = k
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (this.m[i]! < 0) continue
      const M = MATS[MAT_NAMES[this.m[i]!]!]
      const c = M.ramp[tone[i]!]!
      const o = ((oy + y) * aw + ox + x) * 4
      albedo[o] = c[0]; albedo[o + 1] = c[1]; albedo[o + 2] = c[2]
      // A point (x, y, z) lies (x + y) / 2 px nearer than the anchor, which is its row on the screen plus its height.
      albedo[o + 3] = depthCode(y + 0.5 - ay + this.t[i]!)
      const S2 = Math.SQRT1_2
      normal[o] = Math.round(((this.nx[i]! - this.ny[i]!) * S2 * 0.5 + 0.5) * 255)
      normal[o + 1] = Math.round((this.nz[i]! * 0.5 + 0.5) * 255)
      normal[o + 2] = Math.round(((this.nx[i]! + this.ny[i]!) * S2 * 0.5 + 0.5) * 255)
      normal[o + 3] = Math.round(M.glow * 255)
    }
  }
}

/** Rasterise one prop at scene density for the art exporter, including space around its ground anchor. */
export function rasterThing(build: (solids: Solids) => void) {
  const draw: ((bench: Bench) => void)[] = []
  let left = 0
  let right = 0
  let top = 0
  let bottom = 0
  const bounds = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
    left = Math.min(left, x0 - y1)
    right = Math.max(right, x1 - y0)
    top = Math.min(top, (x0 + y0) / 2 - z1)
    bottom = Math.max(bottom, (x1 + y1) / 2 - z0)
  }
  build({
    box(x0, y0, z0, x1, y1, z1, pick) {
      bounds(x0, y0, z0, x1, y1, z1)
      draw.push(bench => bench.box(x0, y0, z0, x1, y1, z1, pick))
    },
    post(x, y, z0, z1, r, pick) {
      bounds(x - r, y - r, z0, x + r, y + r, z1)
      draw.push(bench => bench.post(x, y, z0, z1, r, pick))
    },
    ball(x, y, z, rx, ry, rz, pick) {
      bounds(x - rx, y - ry, z - rz, x + rx, y + ry, z + rz)
      draw.push(bench => bench.ball(x, y, z, rx, ry, rz, pick))
    },
  })
  if (!draw.length) throw new Error('A thing needs at least one solid')
  const ax = 1 - Math.floor(left)
  const ay = 1 - Math.floor(top)
  const w = ax + Math.ceil(right) + 1
  const h = ay + Math.ceil(bottom) + 1
  const bench = new Bench({ w, h, ax, ay })
  draw.forEach(paint => paint(bench))
  const albedo = new Uint8ClampedArray(w * h * 4)
  const normal = new Uint8ClampedArray(albedo.length)
  bench.paint(albedo, normal, w, 0, 0)
  return { w, h, ax, ay, albedo, normal }
}

function hash(x: number, y: number, salt = 0): number {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// ---------------------------------------------------------------------------
// The things
// ---------------------------------------------------------------------------

/** A lamp post: a foot, a thin pole, a lantern with four panes under a lid. */
function lamp(b: Solids, glass: 'glassPink' | 'glassCyan') {
  b.post(0, 0, 0, 2, 4.4, 'pole')
  b.post(0, 0, 2, 4, 3, 'pole')
  b.post(0, 0, 4, 34, 1.5, 'pole')
  b.post(0, 0, 32, 34.5, 2.8, 'pole')
  const pane = (x: number, y: number, z: number, nx: number, ny: number, nz: number): MatName => {
    if (nz > 0.5) return 'pole'
    // Along the pane, from its middle.
    const a = nx > 0.5 ? y : x
    if (z < 36.2 || z > 44.4 || Math.abs(a) > 3.6) return 'pole'
    return Math.abs(a) < 1.7 && z > 38.4 && z < 42.4 ? 'core' : glass
  }
  b.box(-4.8, -4.8, 34.5, 4.8, 4.8, 46, pane)
  b.box(-6, -6, 46, 6, 6, 47.6, 'pole')
  b.post(0, 0, 47.6, 49.4, 2.2, 'pole')
}

/** A gravestone: a slab on a plinth, its head rounded, a cross cut into its face, moss at its foot. */
function grave(b: Solids) {
  b.box(-8, -3.4, 0, 8, 3.4, 2.4, (x, _y, z, _nx, ny) => (ny > 0.5 && z < 1.6 && hash(x, 3, 7) > 0.45 ? 'moss' : 'stone'))
  const face = (x: number, _y: number, z: number, _nx: number, ny: number): MatName => {
    if (ny < 0.5) return 'stone'
    if ((Math.abs(x) < 1.1 && z > 6.5 && z < 16.5) || (Math.abs(x) < 3.7 && z > 11.2 && z < 13.4)) return 'carve'
    if (z < 5 && hash(x, z, 5) > 0.72) return 'moss'
    return 'stone'
  }
  b.box(-6, -2, 2.4, 6, 2, 17, face)
  b.ball(0, 0, 17, 6, 2, 4.6, 'stone')
}

/** A clay pot: a round belly with two bands of glaze, a neck, a rim round a dark mouth. */
function pot(b: Solids) {
  b.ball(0, 0, 8.2, 7.6, 7.6, 8.2, (_x, _y, z) => (z >= 9.6 && z < 11.6 ? 'bandCyan' : z >= 7.4 && z < 9.6 ? 'bandPink' : 'clay'))
  b.post(0, 0, 14.5, 17.5, 4.3, 'clay')
  b.post(0, 0, 17.5, 19.6, 5.8, (x, y, _z, _nx, _ny, nz) => (nz > 0.5 && Math.hypot(x, y) < 4 ? 'dark' : 'clay'))
}

/** A rock a hero can lift: three lumps grown together. */
function rock(b: Solids) {
  b.ball(0, 0, 5.4, 8, 7.2, 8, 'rock')
  b.ball(-3.6, 2.6, 3.4, 6, 5, 5, 'rock')
  b.ball(3.8, -1.2, 5.6, 5.2, 5.2, 6.4, 'rock')
}

/** A boulder only a blast moves: a great lump with two shoulders and a crack down its face. */
function boulder(b: Solids) {
  const cracked = (x: number, y: number, z: number): MatName => {
    // Along the face the viewer sees, from its middle.
    const a = (x - y) * Math.SQRT1_2
    const line = 1.2 + Math.sin(z * 0.8) * 1.6 + (z > 12 ? (z - 12) * 0.5 : 0)
    return z > 6 && z < 17.5 && Math.abs(a - line) < 0.75 ? 'crack' : 'boulder'
  }
  b.ball(0, 0, 8.6, 11.4, 10.8, 10.4, cracked)
  b.ball(5, 3.4, 5, 8, 7, 6.6, 'boulder')
  b.ball(-5.4, 1.2, 5.4, 7.2, 7.2, 7, 'boulder')
}

/** A signpost: a board on a post, two lines of writing on its face. */
function sign(b: Solids) {
  b.post(0, 0, 0, 13, 1.5, 'wood')
  const face = (x: number, _y: number, z: number, _nx: number, ny: number): MatName => {
    if (ny < 0.5) return 'wood'
    if (z > 20.2 && z < 21.8 && Math.abs(x) < 6.4) return 'ink'
    if (z > 16.2 && z < 17.8 && x > -6.4 && x < 3) return 'ink'
    return 'wood'
  }
  b.box(-9.4, -1.3, 12.5, 9.4, 1.3, 25, face)
}

/** A pillar: a shaft on a foot under a slab, a band of neon round it. */
function pillar(b: Solids, stone: 'stone' | 'shrine') {
  b.box(-6.5, -6.5, 0, 6.5, 6.5, 2.5, stone)
  b.box(-5, -5, 2.5, 5, 5, 25, (_x, _y, z, _nx, _ny, nz) => (nz < 0.5 && z > 14 && z < 16 ? 'neon' : stone))
  b.box(-6.5, -6.5, 25, 6.5, 6.5, 28, stone)
}

/** A bar stool: a round seat in red velvet on a chrome leg. */
function stool(b: Solids) {
  b.post(0, 0, 0, 1.6, 4, 'chrome')
  b.post(0, 0, 1.6, 10, 1.3, 'chrome')
  b.post(0, 0, 10, 11.2, 5.6, 'chrome')
  b.ball(0, 0, 11.2, 5.6, 5.6, 2.8, 'velvet')
}

/**
 * A counter's part of one tile: a wooden top with a lit lip on a panelled front. It runs to the tile's edge
 * wherever the counter goes on (east and west always, north and south as told), so the parts of a long
 * counter stand side by side as one; `narrow` is a counter that runs north to south.
 */
function counter(b: Solids, north: boolean, south: boolean, narrow = false) {
  const x0 = narrow ? -9 : -16
  const x1 = narrow ? 9 : 16
  const y0 = narrow || north ? -16 : -9
  const y1 = narrow || south ? 16 : 9
  const H = COUNTER_TOP
  b.box(x0, y0, 0, x1, y1, H, (x, y, z, _nx, _ny, nz) => {
    if (nz > 0.5) return x > x1 - 1.6 || y > y1 - 1.6 ? 'lip' : 'board'
    if (z > H - 2.2) return 'lip'
    if (z > H - 3.6 || z < 1.6) return 'seam'
    // Panels along the front, a seam between them.
    const a = _nx > 0.5 ? y : x
    return Math.abs(((a % 16) + 16) % 16 - 8) > 7.2 ? 'seam' : 'front'
  })
}

/** A treasure chest: a wooden box strapped in gold with a lock on its face; open, its lid stands up at the back over a dark inside. */
function chest(b: Solids, big: boolean, open: boolean) {
  const w = big ? 11.5 : 8.5
  const d = big ? 7.5 : 6
  const h = big ? 12 : 9
  const lid = big ? 6 : 4.5
  const wood: MatName = big ? 'chestViolet' : 'chestWood'
  const strapped = (top: number) => (x: number, y: number, z: number, nx: number, ny: number, nz: number): MatName => {
    if (nz > 0.5) {
      if (open && top === h) return Math.abs(x) < w - 1.6 && Math.abs(y) < d - 1.6 ? 'dark' : 'gold'
      return Math.abs(x) > w - 2 || Math.abs(x) < 1.4 ? 'gold' : wood
    }
    // Along the face, from its middle.
    const a = nx > 0.5 ? y : x
    const half = nx > 0.5 ? d : w
    if (z < 1.5 || z > top - 1.5 || Math.abs(a) > half - 2) return 'gold'
    if (ny > 0.5 && top === h && Math.abs(a) < 2.2 && z > h - 5.5) return Math.abs(a) < 0.8 && z > h - 4.4 && z < h - 2.4 ? 'dark' : 'gold'
    if (ny > 0.5 && top !== h && Math.abs(a) < 1.4) return 'gold'
    return wood
  }
  b.box(-w, -d, 0, w, d, h, strapped(h))
  if (open) b.box(-w, -d, h, w, -d + 2.2, h + d * 1.5, strapped(h + d * 1.5))
  else b.box(-w, -d, h, w, d, h + lid, strapped(h + lid))
}

/** One of the Shrine's crystal blocks, risen: a cube whose top is all light. */
function block(b: Solids, side: 'blockPink' | 'blockCyan', top: 'glassPink' | 'glassCyan') {
  b.box(-14, -14, 0, 14, 14, 15, (x, y, z, _nx, _ny, nz) => {
    if (nz > 0.5) return Math.abs(x) > 12.4 || Math.abs(y) > 12.4 ? side : x < -6 && y < -6 ? 'core' : top
    return z > 13 ? top : side
  })
}

/**
 * A fence's part of one tile: a post in the middle and two rails out to every side the fence goes on
 * (1 west, 2 east, 4 north, 8 south).
 */
function fence(b: Solids, sides: number) {
  for (const z of [6, 12.4]) {
    if (sides & 1) b.box(-16, -0.9, z, 0, 0.9, z + 2.4, 'wood')
    if (sides & 2) b.box(0, -0.9, z, 16, 0.9, z + 2.4, 'wood')
    if (sides & 4) b.box(-0.9, -16, z, 0.9, 0, z + 2.4, 'wood')
    if (sides & 8) b.box(-0.9, 0, z, 0.9, 16, z + 2.4, 'wood')
  }
  b.post(0, 0, 0, 17.5, 2, 'wood')
  b.post(0, 0, 17.5, 18.6, 2.6, 'wood')
}

/** How each thing is built (the polygon view builds the same things as meshes). */
export const BUILD: Record<PropKind, (b: Solids) => void> = {
  lampPink: b => lamp(b, 'glassPink'),
  lampCyan: b => lamp(b, 'glassCyan'),
  grave,
  pot,
  rock,
  boulder,
  sign,
  pillarStone: b => pillar(b, 'stone'),
  pillarShrine: b => pillar(b, 'shrine'),
  stool,
  counter: b => counter(b, false, false),
  counterN: b => counter(b, true, false),
  counterS: b => counter(b, false, true),
  counterNS: b => counter(b, true, true),
  counterY: b => counter(b, false, false, true),
  chest: b => chest(b, false, false),
  chestOpen: b => chest(b, false, true),
  bigChest: b => chest(b, true, false),
  bigChestOpen: b => chest(b, true, true),
  blockPink: b => block(b, 'blockPink', 'glassPink'),
  blockCyan: b => block(b, 'blockCyan', 'glassCyan'),
  ...Object.fromEntries(Array.from({ length: 16 }, (_, i) => [`fence${i}`, (b: Solids) => fence(b, i)])),
  ...PUZZLE_BUILD,
}

let built: PropAtlas | null = null

/** Cells to a row of the atlas: it stays narrower than the smallest texture a WebGL2 device promises. */
export const PROP_COLS = 8

/** Every thing in a grid, a cell each. */
export function buildProps(): PropAtlas {
  while (!stepProps()) { /* the next thing */ }
  return built!
}

let cells = 0
let wip: PropAtlas | null = null

/** Builds the next thing into the atlas, and says whether all of them are there now (as `stepMaterials`). */
export function stepProps(): boolean {
  if (built) return true
  const w = W * PROP_COLS
  const h = H * Math.ceil(PROP_KINDS.length / PROP_COLS)
  const a = wip ??= { w, h, albedo: new Uint8ClampedArray(w * h * 4), normal: new Uint8ClampedArray(w * h * 4), sprites: {} as Record<PropKind, PropSprite> }
  const k = cells++
  const kind = PROP_KINDS[k]!
  const b = new Bench()
  BUILD[kind]!(b)
  const x = (k % PROP_COLS) * W
  const y = Math.floor(k / PROP_COLS) * H
  b.paint(a.albedo, a.normal, w, x, y, !kind.startsWith('counter'))
  // The first row with anything on it: a thing that rises out of the ground starts there (`view.ts`).
  let top = 0
  rows: for (; top < H; top++) for (let u = 0; u < W; u++) if (a.albedo[((y + top) * w + x + u) * 4 + 3]) break rows
  a.sprites[kind] = { x, y, w: W, h: H, ax: PROP.ax, ay: PROP.ay, top }
  if (cells < PROP_KINDS.length) return false
  built = a
  wip = null
  return true
}
