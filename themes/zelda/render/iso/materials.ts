/**
 * The ground of the 16-bit view. Pure: no canvas, no DOM.
 *
 * The classic ground is a flat colour with a few marks on it, sixteen px to
 * the tile, and smoothing it only makes it a smoother flat colour. A 16-bit
 * machine had the tiles for more: here every kind of ground is a material
 * painted at the view's own density (32 texels to the tile, four tiles
 * before it repeats), with a ramp of its own and a height for the light to
 * catch: a lawn in three greens with blades standing in it, cobbles with a
 * lit and a shaded shoulder, sand the wind has combed, flagstones with a
 * bevel, floorboards with a grain.
 *
 * A material is painted for the turned view. On the ground a texel is
 * (u east, v south); at k = 1 the engine shows every texel as exactly one
 * scene px, at (u − v, ⌊(u + v) / 2⌋) (`GROUND_FS` reads them half a texel
 * south of the grid, which is what makes that one to one). So what should
 * stand upright on the screen (a blade of grass) is stamped through `spot`,
 * which takes offsets in scene px, and what lies on the ground (a joint
 * between stones) is drawn along u and v and comes out as the 2:1 lines of
 * isometric pixel art.
 *
 * What stands has materials too: shingles on a roof, boards on a house's
 * wall, rock in a cliff's face, bricks and dressed blocks in the Shrine,
 * panelling and plaster indoors, steel in the labs. A roof or a wall's top is laid like the
 * ground; a face is painted with a running east or south along the wall and
 * b up it from the ground, and there too every scene px gets a texel.
 *
 * `buildMaterials()` is seeded: the same pictures every time, built once (`stepMaterials()` a sheet at a time).
 * `scripts/zelda-lab/materials-sheet.mjs` draws them as the view shows them.
 */

/** Texels a side: 32 to the tile, so a material repeats every four tiles. */
import type { RealmLook } from '../looks'

export const MAT = 128
/** Texels to the tile. */
export const MAT_PER_TILE = 32

/**
 * The materials, in the order they lie in the atlas. A tile's number in the
 * tile data is its place here plus one (0: the ground as the classic art
 * paints it).
 */
export const MATERIALS = ['grass', 'cobbles', 'sand', 'flags', 'boards', 'moss', 'lane', 'shingles', 'siding', 'rockface', 'bricks', 'blocks', 'panel', 'slab', 'plates', 'steel'] as const
export type Material = typeof MATERIALS[number]
export const materialId = (m: Material | null): number => m ? MATERIALS.indexOf(m) + 1 : 0

export interface Materials {
  /** RGBA, `w` × `h`: colour, and in the alpha how high the texel stands (0 a joint, 255 a blade's tip). */
  data: Uint8ClampedArray
  w: number
  h: number
}

type Rgb = readonly [number, number, number]
const rgb = (s: string): Rgb => { const v = parseInt(s.slice(1, 7), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }
const ramp = (...c: string[]): Rgb[] => c.map(rgb)
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]

const wrap = (n: number) => ((n % MAT) + MAT) % MAT

function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** Smooth noise that repeats with the material: `cell` texels to a lattice step (a divisor of MAT). */
function noise(u: number, v: number, cell: number, salt: number): number {
  const n = MAT / cell
  const gx = Math.floor(u / cell)
  const gy = Math.floor(v / cell)
  const fx = u / cell - gx
  const fy = v / cell - gy
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const at = (x: number, y: number) => hash(((x % n) + n) % n, ((y % n) + n) % n, salt)
  const a = at(gx, gy)
  const b = at(gx + 1, gy)
  const c = at(gx, gy + 1)
  const d = at(gx + 1, gy + 1)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

/**
 * The turned view shows the texels of one scene row in pairs: (u, v) and (u − 1, v) lie side by side
 * when u + v is odd. A mark one texel wide that runs across the screen is a dotted line; asked through
 * this, both of a pair answer alike and it is a whole one.
 */
const pairU = (u: number, v: number) => ((u + v) & 1 ? u - 1 : u)

/** One material on the bench: a colour and a height for every texel. */
class Sheet {
  readonly r = new Uint8ClampedArray(MAT * MAT)
  readonly g = new Uint8ClampedArray(MAT * MAT)
  readonly b = new Uint8ClampedArray(MAT * MAT)
  readonly z = new Float32Array(MAT * MAT)
  set(u: number, v: number, c: Rgb, z?: number) {
    const i = wrap(v) * MAT + wrap(u)
    this.r[i] = c[0]; this.g[i] = c[1]; this.b[i] = c[2]
    if (z !== undefined) this.z[i] = z
  }
  /**
   * A px of something that stands at ground texel (u, v): `dx` scene px to the right of it, `dy` down
   * (up is negative). The texel that the turned view shows there gets the colour.
   */
  spot(u: number, v: number, dx: number, dy: number, c: Rgb, z?: number) {
    const X = u - v + dx
    const Y = Math.floor((u + v) / 2) + dy
    const odd = ((X % 2) + 2) % 2
    this.set((X + 2 * Y + odd) / 2, (2 * Y + odd - X) / 2, c, z)
  }
}

// ---------------------------------------------------------------------------
// Grass
// ---------------------------------------------------------------------------

interface Lawn {
  /** Dark to light: three steps of body, the blade, its tip. */
  ramp: Rgb[]
  /** Blades to the tile. */
  blades: number
  /** A blossom now and then: its heart and its petal (null: none). */
  bloom: readonly [Rgb, Rgb] | null
  blooms: number
  seed: number
  /** A mown lawn: bands this many texels wide, every other one a step lighter (0: none). */
  stripes?: number
}

function lawn(L: Lawn): Sheet {
  const s = new Sheet()
  const [d, m, l, blade, tip] = L.ramp as [Rgb, Rgb, Rgb, Rgb, Rgb]
  // The body: soft patches, their borders broken up a texel at a time so no edge is a line.
  const body = (u: number, v: number) => noise(u, v, 32, L.seed) * 0.56 + noise(u, v, 8, L.seed + 1) * 0.36 + hash(pairU(u, v), v, L.seed + 2) * 0.08
  for (let v = 0; v < MAT; v++) for (let u = 0; u < MAT; u++) {
    const n = body(u, v)
    let i = n < 0.4 ? 0 : n < 0.6 ? 1 : 2
    if (L.stripes && Math.floor(u / L.stripes) % 2) i = Math.min(2, i + 1)
    s.set(u, v, i === 0 ? d : i === 1 ? m : l, 0.25 + i * 0.12)
  }
  // Blades stand in it, more of them where the lawn is light: a dark foot, a body, a lit tip.
  const count = Math.round(L.blades * (MAT / MAT_PER_TILE) ** 2 * 1.6)
  for (let i = 0; i < count; i++) {
    const u = Math.floor(hash(i, 1, L.seed + 3) * MAT)
    const v = Math.floor(hash(i, 2, L.seed + 3) * MAT)
    const n = body(u, v)
    if (hash(i, 3, L.seed + 3) > 0.25 + n * 1.1) continue
    const kind = hash(i, 4, L.seed + 3)
    s.spot(u, v, 1, 0, d, 0.1)
    if (kind < 0.5) {
      // One blade.
      s.spot(u, v, 0, 0, blade, 0.6)
      s.spot(u, v, 0, -1, n > 0.55 ? tip : blade, 0.8)
    } else if (kind < 0.85) {
      // A pair that leans apart.
      s.spot(u, v, 0, 0, blade, 0.6)
      s.spot(u, v, -1, -1, blade, 0.75)
      s.spot(u, v, 1, -1, n > 0.5 ? tip : blade, 0.8)
    } else {
      // A tuft: three, the middle one taller.
      s.spot(u, v, -1, 0, blade, 0.55)
      s.spot(u, v, 0, 0, m, 0.5)
      s.spot(u, v, 2, 0, d, 0.1)
      s.spot(u, v, 1, 0, blade, 0.55)
      s.spot(u, v, -2, -1, blade, 0.7)
      s.spot(u, v, 0, -1, blade, 0.75)
      s.spot(u, v, 2, -1, tip, 0.8)
      s.spot(u, v, 0, -2, tip, 0.95)
    }
  }
  if (L.bloom) {
    for (let i = 0; i < L.blooms; i++) {
      const u = Math.floor(hash(i, 5, L.seed + 4) * MAT)
      const v = Math.floor(hash(i, 6, L.seed + 4) * MAT)
      s.spot(u, v, 0, 0, d, 0.1)
      s.spot(u, v, 0, -1, L.bloom[1], 0.8)
      s.spot(u, v, 1, -1, L.bloom[0], 0.9)
      s.spot(u, v, 0, -2, L.bloom[0], 0.9)
    }
  }
  return s
}

// ---------------------------------------------------------------------------
// Cobbles
// ---------------------------------------------------------------------------

interface Paving {
  /** The joint, then the stone from its shaded shoulder to its lit one. */
  ramp: Rgb[]
  /** Stones across the material (a divisor of MAT). */
  across: number
  /** What grows in the joints and over a stone now and then (null: bare). */
  moss: Rgb[] | null
  /** Where the light comes from across the material (default: the low sun on the ground). */
  light?: { x: number; y: number }
  seed: number
}

/** Toward the low sun on the ground (the view's own sun stands in the west-north-west). */
const SUN = { x: -0.9, y: -0.43 }

function paving(P: Paving): Sheet {
  const s = new Sheet()
  const [joint, dark, mid, light, hi] = P.ramp as [Rgb, Rgb, Rgb, Rgb, Rgb]
  const n = P.across
  const cell = MAT / n
  const sun = P.light ?? SUN
  // Every stone has a heart, a little off its place in the grid; a texel belongs to the nearest one.
  // (The hearts are worked out once, with a ring of the neighbours beyond the sheet's edge.)
  const N = n + 2
  const hx = new Float64Array(N * N)
  const hy = new Float64Array(N * N)
  for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
    const wi = ((i % n) + n) % n
    const wj = ((j % n) + n) % n
    hx[(j + 1) * N + i + 1] = (i + 0.5 + (hash(wi, wj, P.seed) - 0.5) * 0.7) * cell
    hy[(j + 1) * N + i + 1] = (j + 0.5 + (hash(wi, wj, P.seed + 1) - 0.5) * 0.7) * cell
  }
  for (let v = 0; v < MAT; v++) for (let u = 0; u < MAT; u++) {
    const gi = Math.floor(u / cell)
    const gj = Math.floor(v / cell)
    let s1 = Infinity
    let s2 = Infinity
    let bi = 0
    let bj = 0
    let bx = 0
    let by = 0
    for (let j = gj - 1; j <= gj + 1; j++) for (let i = gi - 1; i <= gi + 1; i++) {
      const dx = u + 0.5 - hx[(j + 1) * N + i + 1]!
      const dy = v + 0.5 - hy[(j + 1) * N + i + 1]!
      // Squarer than round: stones cut to lie together. (The root is taken of the two nearest only.)
      const ss = Math.pow(Math.abs(dx), 2.6) + Math.pow(Math.abs(dy), 2.6)
      if (ss < s1) { s2 = s1; s1 = ss; bi = i; bj = j; bx = dx; by = dy }
      else if (ss < s2) s2 = ss
    }
    const edge = Math.pow(s2, 1 / 2.6) - Math.pow(s1, 1 / 2.6)
    const wi = ((bi % n) + n) % n
    const wj = ((bj % n) + n) % n
    const mossy = P.moss && hash(wi, wj, P.seed + 5) > 0.72
    if (edge < 1.3) {
      // The joint: earth, or what grows in it.
      const grown = P.moss && hash(u, v, P.seed + 6) > 0.45
      s.set(u, v, grown ? P.moss![hash(u, v, P.seed + 7) > 0.6 ? 1 : 0]! : joint, grown ? 0.2 : 0)
      continue
    }
    // The stone's own shade, then its shoulders: lit toward the sun, dark away from it.
    const tone = hash(wi, wj, P.seed + 2)
    let i = tone < 0.3 ? 1 : tone < 0.78 ? 2 : 3
    const len = Math.hypot(bx, by) || 1
    const facing = (bx * sun.x + by * sun.y) / len
    if (edge < 3.2) i += facing > 0.3 ? 1 : facing < -0.3 ? -1 : 0
    else if (hash(u, v, P.seed + 3) > 0.94) i += hash(u, v, P.seed + 4) > 0.5 ? 1 : -1
    i = Math.max(1, Math.min(4, i))
    let c = [joint, dark, mid, light, hi][i]!
    if (mossy && edge < 4 && facing < 0.2) c = P.moss![i > 2 ? 1 : 0]!
    s.set(u, v, c, edge < 3.2 ? 0.55 : 0.9)
  }
  return s
}

// ---------------------------------------------------------------------------
// Sand
// ---------------------------------------------------------------------------

function sand(seed: number, colors: Rgb[] = ramp('#876652', '#a47f66', '#bd9877', '#d8b68e')): Sheet {
  const s = new Sheet()
  const [d, m, l, h] = colors as [Rgb, Rgb, Rgb, Rgb]
  for (let v = 0; v < MAT; v++) for (let u0 = 0; u0 < MAT; u0++) {
    const u = pairU(u0, v)
    // Drifts, and across them the ripples the wind left: they run across the screen, a lit crest over a shaded trough.
    const n = noise(u, v, 32, seed) * 0.6 + noise(u, v, 16, seed + 1) * 0.4
    const row = Math.floor((u + v) / 2)
    const along = row * 2 + (noise(u, v, 16, seed + 2) - 0.5) * 14
    const wave = Math.sin((along / 16) * Math.PI * 2)
    const gate = noise(u, v, 8, seed + 3)
    let i = n < 0.4 ? 1 : 2
    let z = 0.5
    if (wave > 0.82 && gate > 0.3) { i = 3; z = 0.9 }
    else if (wave < -0.8 && gate > 0.4) { i = 0; z = 0.15 }
    else if (hash(u, v, seed + 4) > 0.985) { i = hash(u, v, seed + 5) > 0.5 ? 3 : 0; z = i === 3 ? 0.8 : 0.3 }
    s.set(u0, v, [d, m, l, h][i]!, z)
  }
  return s
}

// ---------------------------------------------------------------------------
// Flagstones and floorboards
// ---------------------------------------------------------------------------

function flags(seed: number): Sheet {
  const s = new Sheet()
  const [grout, dark, mid, light, edge] = ramp('#17122f', '#242049', '#2c2657', '#352e66', '#4c4288') as [Rgb, Rgb, Rgb, Rgb, Rgb]
  const tiles = MAT / MAT_PER_TILE
  for (let v = 0; v < MAT; v++) for (let u = 0; u < MAT; u++) {
    const lu = u % MAT_PER_TILE
    const lv = v % MAT_PER_TILE
    const tu = Math.floor(u / MAT_PER_TILE)
    const tv = Math.floor(v / MAT_PER_TILE)
    const last = MAT_PER_TILE - 1
    if (lu === last || lv === last) { s.set(u, v, grout, 0); continue }
    // A slab a tile wide, one of two shades by turns, worn lighter in its middle.
    const alt = (tu + tv) % 2 === 0
    const n = noise(u, v, 8, seed) * 0.6 + hash(u, v, seed + 1) * 0.4
    const inner = lu > 5 && lv > 5 && lu < last - 6 && lv < last - 6
    let i = (alt ? 1 : 2) + (inner && n > 0.42 ? 1 : 0) - (!inner && n < 0.3 ? 1 : 0)
    let z = 0.8
    // The bevel: its lit edge toward the room's light, its dark one away.
    if (lu === 0 || lv === 0) { i = 4; z = 0.5 }
    else if (lu === last - 1 || lv === last - 1) { i = 0; z = 0.45 }
    else if (lu === 1 || lv === 1) i += 1
    i = Math.max(0, Math.min(4, i))
    s.set(u, v, i === 0 ? mixRgb(grout, dark, 0.5) : [grout, dark, mid, light, edge][i]!, z)
  }
  // A crack in one slab in three: a few texels wandering in from an edge, a lit lip beside them.
  for (let tv = 0; tv < tiles; tv++) for (let tu = 0; tu < tiles; tu++) {
    if (hash(tu, tv, seed + 2) > 0.36) continue
    let u = tu * MAT_PER_TILE + 4 + Math.floor(hash(tu, tv, seed + 3) * 20)
    let v = tv * MAT_PER_TILE + 2
    const len = 7 + Math.floor(hash(tu, tv, seed + 4) * 9)
    for (let k = 0; k < len; k++) {
      s.set(u, v, grout, 0.1)
      s.set(u + 1, v, edge, 0.7)
      v += 1
      const turn = hash(tu * 31 + k, tv, seed + 5)
      if (turn < 0.3) u -= 1
      else if (turn > 0.72) u += 1
    }
  }
  return s
}

/**
 * Boards, eight texels wide with a dark gap between them and a grain along them. `upright`: they stand
 * (a wall's cladding: a along the wall, b up it) and run unbroken; lying (a floor) they run east in
 * lengths, their ends staggered from row to row, a nail at each end.
 */
function boards(seed: number, colors: Rgb[], upright = false, rail = false): Sheet {
  const s = new Sheet()
  const [gap, dark, mid, light, hi] = colors as [Rgb, Rgb, Rgb, Rgb, Rgb]
  const WIDE = 8
  const LONG = 64
  for (let q = 0; q < MAT; q++) for (let p = 0; p < MAT; p++) {
    // p runs along the board, q across the boards.
    const row = Math.floor(q / WIDE)
    const lq = q % WIDE
    const off = upright ? 0 : Math.floor(hash(row, 0, seed) * 4) * 16
    const lp = (p + off) % LONG
    const board = upright ? 0 : Math.floor((p + off) / LONG) % (MAT / LONG)
    const put = (i: number, z: number) => {
      const c = i <= 0 ? mixRgb(gap, dark, i < 0 ? 0 : 0.4) : [gap, dark, mid, light, hi][Math.min(4, i)]!
      if (upright) s.set(q, p, c, z)
      else s.set(p, q, c, z)
    }
    if (lq === WIDE - 1 || (!upright && lp === LONG - 1)) { put(-1, 0); continue }
    const tone = hash(row, board, seed + 1)
    let i = tone < 0.3 ? 1 : tone < 0.75 ? 2 : 3
    // The grain: long streaks along the board, a texel wide.
    const streak = hash(Math.floor((p + off + hash(row, lq, seed + 2) * 40) / (6 + Math.floor(hash(row, lq, seed + 3) * 10))), row * WIDE + lq, seed + 4)
    if (streak > 0.8) i += 1
    else if (streak < 0.16) i -= 1
    let z = 0.8
    if (lq === 0) { i += 1; z = 0.6 }
    if (lq === WIDE - 2) { i -= 1; z = 0.55 }
    if (!upright && (lp === 2 || lp === LONG - 4) && (lq === 2 || lq === 5)) { i = 0; z = 0.3 }
    // A rail across a panelled wall, two thirds of the way up each tile: a lit top, a shadow under it.
    if (rail) {
      const up = p % MAT_PER_TILE
      if (up === 21) { i = 4; z = 1 }
      else if (up === 20) { i = Math.max(i, 3); z = 1 }
      else if (up === 19) { i = 0; z = 0.4 }
    }
    put(Math.max(0, i), z)
  }
  return s
}

/** Shingles: rows that run east, each lying over the row south of it, their butts catching the light. */
function shingles(seed: number, colors: Rgb[] = ramp('#421338', '#74265e', '#8a2f70', '#a03c82', '#c65a9c')): Sheet {
  const s = new Sheet()
  const [gap, dark, mid, light, hi] = colors as [Rgb, Rgb, Rgb, Rgb, Rgb]
  const ROW = 8
  const WIDE = 8
  for (let v = 0; v < MAT; v++) for (let u = 0; u < MAT; u++) {
    const row = Math.floor(v / ROW)
    const lv = v % ROW
    const off = row % 2 ? 4 : 0
    const lu = (u + off) % WIDE
    const col = Math.floor((u + off) / WIDE) % (MAT / WIDE)
    const tone = hash(col, row, seed)
    let i = tone < 0.26 ? 1 : tone < 0.8 ? 2 : 3
    let z = 0.35 + 0.55 * (lv / ROW)
    if (lv === 0) { i = 0; z = 0.05 }
    else if (lv === 1) i -= 1
    else if (lv === ROW - 1) i += 1
    else if (lu === WIDE - 1 && lv < 6) i -= 1
    else if (hash(u, v, seed + 1) > 0.95) i += hash(u, v, seed + 2) > 0.5 ? 1 : -1
    i = Math.max(0, Math.min(4, i))
    s.set(u, v, i === 0 ? gap : [gap, dark, mid, light, hi][i]!, z)
  }
  return s
}

/** Bricks in a wall's face (a along it, b up): courses eight texels high, lit along their top edge. */
function bricks(seed: number): Sheet {
  const s = new Sheet()
  const [mortar, dark, mid, light, hi] = ramp('#1c153c', '#2e255e', '#382e6c', '#44387e', '#584a9a') as [Rgb, Rgb, Rgb, Rgb, Rgb]
  for (let b = 0; b < MAT; b++) for (let a = 0; a < MAT; a++) {
    const course = Math.floor(b / 8)
    const lb = b % 8
    const off = course % 2 ? 8 : 0
    const la = (a + off) % 16
    const brick = Math.floor((a + off) / 16) % (MAT / 16)
    if (lb === 0 || la === 15) { s.set(a, b, mortar, 0); continue }
    const tone = hash(brick, course, seed)
    let i = tone < 0.3 ? 1 : tone < 0.8 ? 2 : 3
    if (lb === 7) i += 1
    else if (lb === 1 || la === 14) i -= 1
    else if (hash(a, b, seed + 1) > 0.93) i += hash(a, b, seed + 2) > 0.5 ? 1 : -1
    i = Math.max(1, Math.min(4, i))
    s.set(a, b, [mortar, dark, mid, light, hi][i]!, lb === 7 || lb === 1 ? 0.6 : 0.85)
  }
  return s
}

/** Dressed blocks on a wall's top: sixteen texels square, staggered, with a bevel. */
function blocks(seed: number, colors: Rgb[] = ramp('#110d26', '#191534', '#1f1a3e', '#27214c', '#352d62')): Sheet {
  const s = new Sheet()
  const [joint, dark, mid, light, hi] = colors as [Rgb, Rgb, Rgb, Rgb, Rgb]
  for (let v = 0; v < MAT; v++) for (let u = 0; u < MAT; u++) {
    const row = Math.floor(v / 16)
    const lv = v % 16
    const off = row % 2 ? 8 : 0
    const lu = (u + off) % 16
    const col = Math.floor((u + off) / 16) % (MAT / 16)
    if (lv === 15 || lu === 15) { s.set(u, v, joint, 0); continue }
    const tone = hash(col, row, seed)
    let i = tone < 0.35 ? 1 : tone < 0.85 ? 2 : 3
    let z = 0.85
    if (lv === 0 || lu === 0) { i += 1; z = 0.55 }
    else if (lv === 14 || lu === 14) { i -= 1; z = 0.5 }
    else if (noise(u, v, 4, seed + 1) * 0.5 + hash(u, v, seed + 2) * 0.5 > 0.68) i += 1
    i = Math.max(1, Math.min(4, i))
    s.set(u, v, [joint, dark, mid, light, hi][i]!, z)
  }
  return s
}

/** Plaster on the top of a room's wall: one dark, mottled, with nothing to count. */
function slab(seed: number): Sheet {
  const s = new Sheet()
  const [dark, mid, light] = ramp('#22162f', '#291b3c', '#312147') as [Rgb, Rgb, Rgb]
  for (let v = 0; v < MAT; v++) for (let u = 0; u < MAT; u++) {
    const n = noise(u, v, 16, seed) * 0.5 + noise(u, v, 4, seed + 1) * 0.3 + hash(u, v, seed + 2) * 0.2
    s.set(u, v, n < 0.4 ? dark : n < 0.63 ? mid : light, 0.5)
  }
  return s
}

/** The labs' floor: steel plates a tile wide, brushed along their length, a tread pressed into one in four. */
function plates(seed: number): Sheet {
  const s = new Sheet()
  const [seam, dark, mid, light, hi] = ramp('#10152a', '#181e34', '#1d243b', '#232c46', '#2f3a5c') as [Rgb, Rgb, Rgb, Rgb, Rgb]
  const last = MAT_PER_TILE - 1
  for (let v = 0; v < MAT; v++) for (let u = 0; u < MAT; u++) {
    const lu = u % MAT_PER_TILE
    const lv = v % MAT_PER_TILE
    const tu = Math.floor(u / MAT_PER_TILE)
    const tv = Math.floor(v / MAT_PER_TILE)
    if (lu === last || lv === last) { s.set(u, v, seam, 0); continue }
    let i = (tu + tv) % 2 ? 1 : 2
    let z = 0.7
    // Brushed: short streaks along the plate, a texel wide.
    const streak = hash(Math.floor((u + hash(tu, v, seed) * 30) / (5 + Math.floor(hash(tu, v, seed + 1) * 8))), v, seed + 2)
    if (streak > 0.86) i += 1
    else if (streak < 0.1) i -= 1
    if (lu === 0 || lv === 0) { i += 1; z = 0.5 }
    else if (lu === last - 1 || lv === last - 1) { i -= 1; z = 0.45 }
    else if (hash(tu, tv, seed + 3) > 0.74 && lu > 4 && lv > 4 && lu < last - 5 && lv < last - 5) {
      // The tread: short raised bars, leaning one way and then the other.
      const cu = (lu - 5) % 6
      const cv = (lv - 5) % 6
      const lean = (Math.floor((lu - 5) / 6) + Math.floor((lv - 5) / 6)) % 2
      if (cv === 2 && cu >= 1 && cu <= 3 && lean === 0) { i += 1; z = 0.95 }
      else if (cu === 2 && cv >= 1 && cv <= 3 && lean === 1) { i += 1; z = 0.95 }
    }
    i = Math.max(1, Math.min(4, i))
    s.set(u, v, [seam, dark, mid, light, hi][i]!, z)
  }
  return s
}

/** The labs' walls (a along the wall, b up it): steel panels half a tile wide, a kick plate, a bolt in each corner. */
function steel(seed: number): Sheet {
  const s = new Sheet()
  const [seam, dark, mid, light, hi] = ramp('#1a2240', '#2f3b62', '#3a4874', '#465688', '#6276ac') as [Rgb, Rgb, Rgb, Rgb, Rgb]
  for (let b = 0; b < MAT; b++) for (let a = 0; a < MAT; a++) {
    const la = a % 16
    const lb = b % MAT_PER_TILE
    const panel = Math.floor(a / 16)
    if (la === 15) { s.set(a, b, seam, 0); continue }
    let i = hash(panel, Math.floor(b / MAT_PER_TILE), seed) > 0.5 ? 2 : 3
    let z = 0.8
    // Brushed up and down.
    const streak = hash(a, Math.floor((b + hash(a, panel, seed + 1) * 30) / (6 + Math.floor(hash(a, 1, seed + 2) * 9))), seed + 3)
    if (streak > 0.86) i += 1
    else if (streak < 0.12) i -= 1
    if (la === 0) { i += 1; z = 0.6 }
    else if (la === 14) { i -= 1; z = 0.55 }
    // The kick plate along the floor, and the seam above it.
    if (lb < 5) i -= 1
    if (lb === 5) { i = 0; z = 0.2 }
    if ((la === 2 || la === 12) && (lb === 8 || lb === 28)) { i = 4; z = 1 }
    else if ((la === 3 || la === 13) && (lb === 7 || lb === 27)) { i = 0; z = 0.3 }
    i = Math.max(0, Math.min(4, i))
    s.set(a, b, i === 0 ? mixRgb(seam, dark, 0.4) : [seam, dark, mid, light, hi][i]!, z)
  }
  return s
}

// ---------------------------------------------------------------------------
// The atlas
// ---------------------------------------------------------------------------

const PAINT: Record<Material, () => Sheet> = {
  // Greener than the classic lawn's teal: a low sun on blue-green is grey, on green it is gold.
  grass: () => lawn({ ramp: ramp('#133b40', '#184c44', '#205e4a', '#2f8558', '#5fc480'), blades: 13, bloom: [rgb('#ff8ae0'), rgb('#c93aa6')], blooms: 7, seed: 11 }),
  cobbles: () => paving({ ramp: ramp('#352a4e', '#584a6e', '#685a7e', '#7a6c90', '#9c8eae'), across: 8, moss: null, seed: 23 }),
  sand: () => sand(37),
  flags: () => flags(41),
  boards: () => boards(53, ramp('#2a1628', '#40243a', '#4e2c45', '#5c3550', '#74465f')),
  // The Wildwood's floor: a deeper night, fewer blades, small lights of its own.
  moss: () => lawn({ ramp: ramp('#0d2638', '#113244', '#16404c', '#1f5a56', '#37947e'), blades: 8, bloom: [rgb('#8ffce0'), rgb('#3fd8b0')], blooms: 5, seed: 67 }),
  // Its paths: the same stones, older, with the wood growing into them.
  lane: () => paving({ ramp: ramp('#2a1f44', '#463760', '#52446e', '#62547e', '#80729a'), across: 8, moss: ramp('#16404c', '#22665c'), seed: 79 }),
  shingles: () => shingles(83),
  // A house's wall: boards standing side by side under the eaves.
  siding: () => boards(89, ramp('#20173e', '#30245a', '#3a2c66', '#453674', '#58488c'), true),
  // A cliff's face: blocks the frost split, lit from above.
  rockface: () => paving({ ramp: ramp('#231a44', '#3b2e68', '#4a3c7a', '#5a4b8e', '#7868ac'), across: 8, moss: null, light: { x: -0.45, y: 0.89 }, seed: 97 }),
  bricks: () => bricks(101),
  blocks: () => blocks(103),
  panel: () => boards(107, ramp('#21153a', '#30224c', '#3a2856', '#453162', '#5a437c'), true, true),
  slab: () => slab(109),
  plates: () => plates(113),
  steel: () => steel(127),
}

let built: Materials | null = null
let sheets = 0
let wip: Uint8ClampedArray | null = null

/**
 * Paints the next material into the atlas, and says whether all of them are there now. A sheet is some
 * milliseconds of work and all of them a noticeable pause, so a view that is on screen asks for one at a time.
 */
export function stepMaterials(): boolean {
  if (built) return true
  const w = MAT * MATERIALS.length
  const data = wip ??= new Uint8ClampedArray(w * MAT * 4)
  const k = sheets++
  lay(data, w, k, PAINT[MATERIALS[k]!]())
  if (sheets < MATERIALS.length) return false
  built = { data, w, h: MAT }
  wip = null
  return true
}

/** A sheet into its column (k) of an atlas `w` texels wide. */
function lay(data: Uint8ClampedArray, w: number, k: number, s: Sheet) {
  for (let v = 0; v < MAT; v++) for (let u = 0; u < MAT; u++) {
    const i = v * MAT + u
    const o = (v * w + k * MAT + u) * 4
    data[o] = s.r[i]!; data[o + 1] = s.g[i]!; data[o + 2] = s.b[i]!
    data[o + 3] = Math.round(Math.max(0, Math.min(1, s.z[i]!)) * 255)
  }
}

/** Every material side by side, MAT texels each. */
export function buildMaterials(): Materials {
  while (!stepMaterials()) { /* the next sheet */ }
  return built!
}

/**
 * The texel the turned view shows at scene px (x, y) of a ground whose texel (0, 0) lies at the scene's
 * origin: what `GROUND_FS` does at k = 1, for the lab's sheet and the tests.
 */
export function texelAt(x: number, y: number): { u: number; v: number } {
  const odd = ((x % 2) + 2) % 2
  return { u: wrap((x + 2 * y + odd) / 2), v: wrap((2 * y + odd - x) / 2) }
}

// ---------------------------------------------------------------------------
// The realms' looks (`../looks.ts`): some slots painted again
// ---------------------------------------------------------------------------

/** Snow: drifts the wind combed (the sand's ripples), white on the crests and violet in the troughs, and glints. */
function snow(seed: number): Sheet {
  const s = dunes(seed, ramp('#9aa6dc', '#bccaf0', '#d0dcf6', '#f2f6ff'))
  const white = rgb('#ffffff')
  const ice = rgb('#9ff4ff')
  for (let i = 0; i < 70; i++) {
    const u = Math.floor(hash(i, 1, seed + 9) * MAT)
    const v = Math.floor(hash(i, 2, seed + 9) * MAT)
    s.set(u, v, hash(i, 3, seed + 9) > 0.7 ? ice : white, 1)
  }
  return s
}

/**
 * Dune sand: long soft swells, a lit slope and a rose-violet shaded one, and on them ripples wider apart
 * than the beach's, a pale crest over each.
 */
function dunes(seed: number, colors: Rgb[] = ramp('#d2a29c', '#f4c8a4', '#fcd8b4', '#fff0d4')): Sheet {
  const s = new Sheet()
  const [shade, body, light, crest] = colors as [Rgb, Rgb, Rgb, Rgb]
  for (let v = 0; v < MAT; v++) for (let u0 = 0; u0 < MAT; u0++) {
    const u = pairU(u0, v)
    const n = noise(u, v, 64, seed) * 0.7 + noise(u, v, 32, seed + 1) * 0.3
    const row = Math.floor((u + v) / 2)
    const along = row * 2 + (noise(u, v, 32, seed + 2) - 0.5) * 22
    const wave = Math.sin((along / 32) * Math.PI * 2)
    let i = n < 0.38 ? 0 : n < 0.62 ? 1 : 2
    let z = 0.5
    if (wave > 0.9 && noise(u, v, 16, seed + 3) > 0.35) { i = Math.min(3, i + 1); z = 0.85 }
    else if (wave < -0.88 && i > 0) { i -= 1; z = 0.25 }
    s.set(u0, v, [shade, body, light, crest][i]!, z)
  }
  return s
}

/**
 * The slots each realm look paints again, in place of the coast's (`GROUND` in `../looks.ts` says which ground
 * lies in which slot). What a slot is called stays: a look's "cobbles" may be its hardpan.
 */
export const LOOK_SHEETS: Record<RealmLook, Partial<Record<Material, () => Sheet>>> = {
  snow: {
    grass: () => snow(131),
    // Paths: stones in the violet shade with the snow lying in their joints.
    cobbles: () => paving({ ramp: ramp('#5a4a7e', '#8a7aac', '#9a8abc', '#ac9ccc', '#cabce0'), across: 8, moss: ramp('#c8d6f4', '#e8f0ff'), seed: 137 }),
    // The shore: gravel under a crust of old snow.
    sand: () => dunes(139, ramp('#7a7098', '#968cb4', '#aaa2c6', '#c8c4e2')),
    // Snow on the roofs, the walls red boards.
    shingles: () => shingles(149, ramp('#5a64a0', '#a8b4e0', '#c4ceee', '#dce4fa', '#f4f8ff')),
    siding: () => boards(151, ramp('#3a1020', '#6a1a2c', '#7e2234', '#922a3e', '#b04454'), true),
  },
  dune: {
    // The hardpan between the dunes: rose clay cracked into big plates.
    cobbles: () => paving({ ramp: ramp('#8a5a6e', '#b08494', '#bc90a0', '#c89cac', '#dcb4c0'), across: 4, moss: null, seed: 157 }),
    sand: () => dunes(163),
    lane: () => paving({ ramp: ramp('#5a4a7a', '#8a7aa8', '#9a8ab8', '#ac9cc8', '#c8bce0'), across: 8, moss: ramp('#c88a7c', '#e4a890'), seed: 167 }),
    rockface: () => paving({ ramp: ramp('#3a2e5a', '#5e5088', '#6e6098', '#8070aa', '#a092c8'), across: 8, moss: null, light: { x: -0.45, y: 0.89 }, seed: 173 }),
  },
  spore: {
    // Moss full of small lights.
    moss: () => lawn({ ramp: ramp('#0e2a40', '#123a4e', '#1a4a58', '#22665e', '#3ab89a'), blades: 9, bloom: [rgb('#e0fff8'), rgb('#3ad0d8')], blooms: 10, seed: 179 }),
    lane: () => paving({ ramp: ramp('#1e1638', '#3e2e62', '#4a3870', '#584682', '#7462a4'), across: 8, moss: ramp('#16404c', '#2a8a7a'), seed: 181 }),
    sand: () => sand(191, ramp('#4a3a52', '#5e4a64', '#725a76', '#8a7090')),
  },
  fog: {
    // The lowland under the fog: a pink-grey turf; the hilltops' green one.
    cobbles: () => lawn({ ramp: ramp('#5e4660', '#6e5470', '#7e6280', '#9a7a98', '#c4a0bc'), blades: 9, bloom: [rgb('#ffd23f'), rgb('#ff8ac0')], blooms: 3, seed: 193 }),
    grass: () => lawn({ ramp: ramp('#123a3a', '#184a42', '#22604c', '#348258', '#6ac47e'), blades: 12, bloom: [rgb('#ff8ae0'), rgb('#c93aa6')], blooms: 6, seed: 197 }),
    lane: () => paving({ ramp: ramp('#3e2a3e', '#6a4a62', '#7a5670', '#8c6680', '#aa84a0'), across: 8, moss: ramp('#3a5a4a', '#4a7a5a'), seed: 199 }),
  },
  quarry: {
    // The benches: dressed blocks in ochre and rust; rose topsoil; grey-violet gravel; rust blocks in the faces.
    sand: () => blocks(211, ramp('#3e2a1c', '#94683e', '#a6764a', '#b88656', '#d4a46c')),
    cobbles: () => lawn({ ramp: ramp('#4a2e3e', '#5a3a4a', '#6a4656', '#9a7a5a', '#c8a070'), blades: 5, bloom: null, blooms: 0, seed: 223 }),
    lane: () => paving({ ramp: ramp('#2e2236', '#56465e', '#64546c', '#74647c', '#90809a'), across: 16, moss: null, seed: 227 }),
    rockface: () => blocks(229, ramp('#2a1420', '#6e3a30', '#804634', '#94543a', '#b0704a')),
  },
  suburb: {
    // A mown lawn in stripes, pink pavers, pastel siding under slate roofs.
    grass: () => lawn({ ramp: ramp('#1a5a3a', '#22704a', '#2a8452', '#46a860', '#8ad884'), blades: 10, bloom: [rgb('#ff8ae0'), rgb('#ffffff')], blooms: 3, seed: 233, stripes: 16 }),
    cobbles: () => paving({ ramp: ramp('#4a2a48', '#8a6082', '#9a6e90', '#ac80a2', '#c89cbc'), across: 8, moss: null, seed: 239 }),
    siding: () => boards(241, ramp('#4a5a7a', '#7a9ab8', '#8aacc8', '#9abcd6', '#bcd8ec'), true),
    shingles: () => shingles(251, ramp('#1e2440', '#3a4466', '#465276', '#546088', '#6e7ca4')),
  },
}

const lookBuilt = new Map<RealmLook, Materials>()
const lookWip = new Map<RealmLook, { data: Uint8ClampedArray; at: number }>()

/**
 * Paints the next of a realm look's own sheets into a copy of the atlas, and says whether that look's atlas is
 * all there (the coast's first, as `stepMaterials`). The last few looks are kept.
 */
export function stepLookMaterials(look: RealmLook): boolean {
  if (lookBuilt.has(look)) return true
  if (!stepMaterials()) return false
  const base = built!
  let w = lookWip.get(look)
  if (!w) lookWip.set(look, w = { data: base.data.slice(), at: 0 })
  const list = Object.entries(LOOK_SHEETS[look]) as Array<[Material, () => Sheet]>
  if (w.at < list.length) {
    const [slot, paint] = list[w.at++]!
    lay(w.data, base.w, MATERIALS.indexOf(slot), paint())
    if (w.at < list.length) return false
  }
  lookBuilt.set(look, { data: w.data, w: base.w, h: base.h })
  lookWip.delete(look)
  if (lookBuilt.size > 3) lookBuilt.delete(lookBuilt.keys().next().value!)
  return true
}

/** A realm look's atlas: the coast's materials with the look's own sheets in their slots. */
export function buildLookMaterials(look: RealmLook): Materials {
  while (!stepLookMaterials(look)) { /* the next sheet */ }
  return lookBuilt.get(look)!
}
