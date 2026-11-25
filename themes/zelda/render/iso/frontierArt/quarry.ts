/**
 * LUMENBY QUARRY's things for the isometric view (`docs/art/codex-tasks.md` Q1 and Q2,
 * `docs/worlds/realm-lumenby.md`): the hillside sign's seven letters, each unlit and lit, and the
 * quarry's working things (mine cart, haul ramp, headframe, lumen vein, a crate of tubes).
 *
 * Built from the props' solids (`props.ts`) in scene px, 32 to the tile: x east, y south, z up, 0 the
 * ground under the thing's middle. The view looks from the south-east, so a thing shows its top, its
 * south face (+y) and its east face (+x); the letters carry their faces south.
 */
import type { MatName, Solids } from '../props'

type Thing = (b: Solids) => void
type Pick = MatName | ((x: number, y: number, z: number, nx: number, ny: number, nz: number) => MatName)

function hash(x: number, y: number, salt = 0): number {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

/** A straight run of small blocks from one point to another: a brace, a rope, a rail at any slope. */
function beam(b: Solids, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, rx: number, ry: number, rz: number, pick: Pick) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0))))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const x = x0 + (x1 - x0) * t
    const y = y0 + (y1 - y0) * t
    const z = z0 + (z1 - z0) * t
    b.box(x - rx, y - ry, z - rz, x + rx, y + ry, z + rz, pick)
  }
}

/**
 * A crystal of lumen: a stack of shrinking blocks that leans by (dx, dy) a layer, so it ends in a point.
 * The south side and the tops are the glass, the east side a step darker; one white glint low on the south.
 */
function crystal(b: Solids, x: number, y: number, z: number, r: number, h: number, dx: number, dy: number, glass: MatName = 'glassCyan', side: MatName = 'bandCyan') {
  const n = Math.max(2, Math.round(h / 2))
  for (let i = 0; i < n; i++) {
    const s = r * (1 - i / n) + 0.35
    const cx = x + dx * i
    const cy = y + dy * i
    const z0 = z + (i * h) / n
    b.box(cx - s, cy - s, z0, cx + s, cy + s, z + ((i + 1) * h) / n, (px, _y, pz, nx) => {
      if (nx > 0.5) return side
      return i === 1 && px < cx - s + 1.1 && pz < z0 + 1.2 ? 'core' : glass
    })
  }
}

// ---------------------------------------------------------------------------
// Q1 · The hill sign: L U M E N B Y, unlit (grey violet) and lit (pink neon)
// ---------------------------------------------------------------------------

/**
 * A letter's strokes on its face, (u, v) = (x, height above the letter's foot), each a centre line
 * [u0, v0, u1, v1]. An upright or level stroke is a bar with square ends; a slanted one has round ends
 * (they fill the joints), and every stroke is cut off at the letter's box.
 */
type Seg = readonly [number, number, number, number]
interface Glyph { w: number; segs: readonly Seg[] }

/** Half a stroke's width: a stroke is 6 px, a rim, a step of panel, the tube (2 px), panel, rim. */
const HW = 3
/** The letters' height, and how far over the ground their foot stands (on their scaffold). */
const LH = 40
const FOOT = 12
/** The letters are narrow: 4 px from back to face. */
const FACE = 2
const BACK = -2

const GLYPHS: Record<'l' | 'u' | 'm' | 'e' | 'n' | 'b' | 'y', Glyph> = {
  l: { w: 24, segs: [[-9, 3, -9, 37], [-9, 3, 9, 3]] },
  u: { w: 24, segs: [[-9, 9, -9, 37], [9, 9, 9, 37], [-3, 3, 3, 3], [-9, 9, -3, 3], [9, 9, 3, 3]] },
  // Wider, so the legs' diagonals meet in a V that reaches a quarter of the way down.
  m: { w: 28, segs: [[-11, 3, -11, 37], [11, 3, 11, 37], [-12.375, 40, 0, 13], [12.375, 40, 0, 13]] },
  e: { w: 24, segs: [[-9, 3, -9, 37], [-9, 37, 9, 37], [-9, 20, 6, 20], [-9, 3, 9, 3]] },
  // The diagonal runs flush from the top of the left leg to the foot of the right.
  n: { w: 24, segs: [[-9, 3, -9, 37], [9, 3, 9, 37], [-10.588, 40, 10.588, 0]] },
  b: {
    w: 24,
    segs: [
      [-9, 3, -9, 37],
      [-9, 37, 4, 37], [4, 37, 8, 33], [8, 33, 8, 24], [8, 24, 4, 20],
      [-9, 20, 5, 20], [5, 20, 9, 16], [9, 16, 9, 7], [9, 7, 5, 3], [-9, 3, 5, 3],
    ],
  },
  y: { w: 24, segs: [[-10.5, 40, 0, 19], [10.5, 40, 0, 19], [0, 3, 0, 19]] },
}

/** How far (u, v) lies from a stroke's centre line. */
function segDist(s: Seg, u: number, v: number): number {
  const [u0, v0, u1, v1] = s
  const du = u1 - u0
  const dv = v1 - v0
  const t = Math.max(0, Math.min(1, ((u - u0) * du + (v - v0) * dv) / (du * du + dv * dv)))
  return Math.hypot(u - u0 - du * t, v - v0 - dv * t)
}

function inStroke(s: Seg, u: number, v: number): boolean {
  const [u0, v0, u1, v1] = s
  if (u0 === u1 || v0 === v1) {
    return u >= Math.min(u0, u1) - HW && u <= Math.max(u0, u1) + HW && v >= Math.min(v0, v1) - HW && v <= Math.max(v0, v1) + HW
  }
  return segDist(s, u, v) <= HW
}

function inGlyph(g: Glyph, u: number, v: number): boolean {
  return Math.abs(u) <= g.w / 2 && v >= 0 && v <= LH && g.segs.some(s => inStroke(s, u, v))
}

function tubeDist(g: Glyph, u: number, v: number): number {
  let d = Infinity
  for (const s of g.segs) d = Math.min(d, segDist(s, u, v))
  return d
}

/** The letter's face: a dark rim, a panel, and the tube down the middle of every stroke. */
function letterFace(g: Glyph, lit: boolean): Pick {
  return (x, _y, z, nx, ny, nz) => {
    if (nz > 0.5) return lit ? 'blockPink' : 'shrine'
    if (nx > 0.5 || ny < 0.5) return 'shrine'
    const u = x
    const v = z - FOOT
    const e = 1.2
    if (!inGlyph(g, u - e, v) || !inGlyph(g, u + e, v) || !inGlyph(g, u, v - e) || !inGlyph(g, u, v + e)) return lit ? 'blockPink' : 'shrine'
    const d = tubeDist(g, u, v)
    if (lit) return d < 0.55 ? 'glassPink' : d < 1.45 ? 'neon' : 'blockPink'
    return d < 1.45 ? 'carve' : 'stone'
  }
}

/** The letter itself: a row of 1 px slabs, one run of the glyph each (rows alike are one slab). */
function letterBody(b: Solids, g: Glyph, pick: Pick) {
  let prev = ''
  let from = 0
  let runs: Array<[number, number]> = []
  const flush = (to: number) => {
    for (const [u0, u1] of runs) b.box(u0, BACK, FOOT + from, u1, FACE, FOOT + to, pick)
  }
  for (let v = 0; v <= LH; v++) {
    const row: Array<[number, number]> = []
    if (v < LH) {
      let start: number | null = null
      for (let u = -g.w / 2; u <= g.w / 2; u++) {
        const on = u < g.w / 2 && inGlyph(g, u + 0.5, v + 0.5)
        if (on && start === null) start = u
        if (!on && start !== null) { row.push([start, u]); start = null }
      }
    }
    const key = row.map(r => r.join(',')).join(' ')
    if (key !== prev) {
      flush(v)
      prev = key
      from = v
      runs = row
    }
  }
}

/** The scaffold behind a letter: two posts on footings, rails across, a brace under the letter's foot. */
function scaffold(b: Solids, w: number, lit: boolean) {
  const px = w / 2 - 4
  for (const x of [-px, px]) {
    b.box(x - 2.4, -7.4, 0, x + 2.4, -2.6, 2, 'stone')
    b.box(x - 1.3, -6.3, 2, x + 1.3, -3.7, FOOT + LH - 6, 'wood')
  }
  for (const z of [FOOT + 6, FOOT + LH - 14]) b.box(-px - 1.5, -6.6, z, px + 1.5, -4.6, z + 2, 'wood')
  b.box(-px, -6.2, 4, px, -4.6, 5.6, 'wood')
  beam(b, -px + 1.5, -5.4, 6, px - 1.5, -5.4, FOOT - 1, 0.7, 0.7, 0.7, 'lip')
  // The letter's transformer box, its pip dark or pink: the letter has power.
  b.box(px - 5, -4, 6, px - 1.5, -2.2, 10, 'pole')
  b.box(px - 4, -2.2, 7.6, px - 2.6, -2, 8.8, lit ? 'glassPink' : 'carve')
}

function letter(g: Glyph, lit: boolean): Thing {
  return b => {
    scaffold(b, g.w, lit)
    letterBody(b, g, letterFace(g, lit))
  }
}

// ---------------------------------------------------------------------------
// Q2 · Quarry things
// ---------------------------------------------------------------------------

/** A short run of track along x: sleepers and two rails, the cart's own piece of line. */
function track(b: Solids, half: number) {
  for (let x = -half + 3; x <= half - 3; x += 7) b.box(x - 1.6, -8, 0, x + 1.6, 8, 1.3, (px, py) => (hash(px, py, 3) > 0.85 ? 'ink' : 'wood'))
  for (const y of [-5, 5]) b.box(-half, y - 0.6, 1.3, half, y + 0.6, 2.6, 'chrome')
}

/** The cart's tub: iron plates, ribs, a pale rolled rim, rust low down, a gold number plate on its side. */
function tubFace(full: boolean): Pick {
  return (x, y, z, nx, ny, nz) => {
    if (nz > 0.5) {
      if (Math.abs(x) < 9 && Math.abs(y) < 6) return full ? 'boulder' : y < -4.6 ? 'shrine' : 'dark'
      return 'chrome'
    }
    if (z > 17.6) return 'chrome'
    const a = nx > 0.5 ? y : x
    if (Math.abs(a % 6.5) < 0.7 || (z > 15.6 && z < 16.6)) return 'pole'
    if (ny > 0.5 && x > 2 && x < 6.5 && z > 10 && z < 13.6) return x > 2.8 && x < 5.8 && z > 10.8 && z < 12.8 && hash(x * 2, z * 2, 9) > 0.45 ? 'clay' : 'gold'
    if (z < 11.5 && hash(a * 0.7, z * 0.8, nx > 0.5 ? 4 : 5) > 0.72) return 'clay'
    return 'stone'
  }
}

/** A cart wheel seen edge on: a flat round iron disc with a bright hub. */
function wheel(b: Solids, x: number, y: number) {
  b.ball(x, y, 5.4, 3.3, 0.9, 3.3, (px, _py, pz) => (Math.hypot(px - x, pz - 5.4) < 1.1 ? 'chrome' : 'pole'))
}

/** The mine cart on its bit of track, empty or heaped with lumen ore. */
function cart(full: boolean): Thing {
  return b => {
    track(b, 15)
    for (const x of [-6.5, 6.5]) for (const y of [-6.2, 6.2]) wheel(b, x, y)
    b.box(-9, -5, 4.6, 9, 5, 8.5, 'pole')
    for (const s of [-1, 1]) b.box(s > 0 ? 10 : -12.4, -1.4, 7.2, s > 0 ? 12.4 : -10, 1.4, 9.6, 'pole')
    const face = tubFace(full)
    b.box(-10, -7, 8, 10, 7, 18.5, face)
    // The rolled rim stands proud of the tub on the two sides that show.
    b.box(-10.8, 7, 16.6, 10.8, 7.8, 18.5, 'chrome')
    b.box(10, -7.8, 16.6, 10.8, 7.8, 18.5, 'chrome')
    if (!full) return
    b.ball(0, 0, 18.4, 9.6, 6.6, 4.4, (x, y, z) => {
      const k = hash(x * 0.6 + 7, y * 0.6 + z * 0.4, 11)
      return k > 0.86 ? 'glassCyan' : k > 0.7 ? 'bandCyan' : k > 0.35 ? 'boulder' : 'rock'
    })
    b.ball(-5, 2.5, 21.6, 3.4, 3, 2.6, 'boulder')
    b.ball(4.5, -1.5, 21.8, 3.2, 3, 2.8, 'rock')
    crystal(b, -1, 1, 20, 2.2, 7, 0.2, 0.15)
    crystal(b, 5.5, 3.2, 19.6, 1.6, 5, 0.35, 0.1)
    crystal(b, -6.5, -2.5, 20.4, 1.4, 4.5, -0.2, 0)
  }
}

/**
 * A haul ramp's piece of one tile: a plank deck rising a whole level (32 px) to the north, rails up its
 * middle for the carts, a timber trestle under it. `west`: the same piece turned to rise to the west.
 */
function haulRamp(west: boolean): Thing {
  return solids => {
    // Built as rising north; turned, x and y swap (in the solids and in what the pick is told).
    const b: Solids = !west ? solids : {
      box: (x0, y0, z0, x1, y1, z1, pick) => solids.box(y0, x0, z0, y1, x1, z1, typeof pick === 'string' ? pick : (x, y, z, nx, ny, nz) => pick(y, x, z, ny, nx, nz)),
      post: (x, y, z0, z1, r, pick) => solids.post(y, x, z0, z1, r, typeof pick === 'string' ? pick : (px, py, z, nx, ny, nz) => pick(py, px, z, ny, nx, nz)),
      ball: (x, y, z, rx, ry, rz, pick) => solids.ball(y, x, z, ry, rx, rz, typeof pick === 'string' ? pick : (px, py, pz, nx, ny, nz) => pick(py, px, pz, ny, nx, nz)),
    }
    const top = (y: number) => 16 - y
    const deck: Pick = (x, y, _z, _nx, _ny, nz) => {
      if (nz < 0.5) return 'ink'
      const plank = Math.floor((y + 16) / 4)
      if (((y + 16) % 4 + 4) % 4 < 0.9) return 'ink'
      if (Math.abs(x) > 14.5) return 'lip'
      return hash(plank, Math.floor((x + 16) / 9), 21) > 0.8 ? 'lip' : 'wood'
    }
    // The trestle first: bents of two posts with a cap, every 10 px up the slope, braced on the east side.
    for (const y of [3, -6, -14]) {
      const h = top(y + 1.5) - 3
      for (const x of [-13, 13]) b.box(x - 1.2, y - 1.2, 0, x + 1.2, y + 1.2, h, 'wood')
      b.box(-14, y - 1.4, h - 2, 14, y + 1.4, h, 'wood')
      if (h > 12) beam(b, -12, y + 1.6, 2, 12, y + 1.6, h - 3, 0.6, 0.4, 0.6, 'lip')
    }
    beam(b, 14.6, 3, 1.5, 14.6, -6, top(-6) - 6, 0.5, 0.6, 0.6, 'lip')
    beam(b, 14.6, -6, 1.5, 14.6, -14, top(-14) - 6, 0.5, 0.6, 0.6, 'lip')
    // The deck, a px at a time up the slope, 3 px thick.
    for (let i = 0; i < 32; i++) {
      const y1 = 16 - i
      const z = i + 1
      b.box(-16, y1 - 1, Math.max(0, z - 3), 16, y1, z, deck)
      for (const x of [-5, 5]) b.box(x - 0.6, y1 - 1, z, x + 0.6, y1, z + 1.2, 'chrome')
    }
  }
}

/** The headframe over a shaft: a two-stage timber tower, braced, a sheave wheel on its deck. */
function headframe(b: Solids) {
  // The shaft's collar: a stone kerb round a dark hole.
  b.box(-10, -10, 0, 10, 10, 2, (x, y, _z, _nx, _ny, nz) => (nz > 0.5 && Math.abs(x) < 6.5 && Math.abs(y) < 6.5 ? 'dark' : 'stone'))
  const leg = (x: number, y: number, z0: number, z1: number) => b.box(x - 1.3, y - 1.3, z0, x + 1.3, y + 1.3, z1, 'wood')
  for (const x of [-12, 12]) for (const y of [-12, 12]) leg(x, y, 0, 31)
  for (const x of [-9, 9]) for (const y of [-9, 9]) leg(x, y, 31, 58)
  // Girts round each stage, and the ledge where the tower steps in.
  const ring = (r: number, z: number) => {
    b.box(-r - 1.4, r - 1, z, r + 1.4, r + 1, z + 2, 'wood')
    b.box(-r - 1.4, -r - 1, z, r + 1.4, -r + 1, z + 2, 'wood')
    b.box(r - 1, -r - 1.4, z, r + 1, r + 1.4, z + 2, 'wood')
    b.box(-r - 1, -r - 1.4, z, -r + 1, r + 1.4, z + 2, 'wood')
  }
  ring(12, 14)
  ring(12, 29)
  ring(9, 44)
  // Braces crossing on the two sides that show.
  for (const [r, z0, z1] of [[12, 2, 14], [12, 16, 29], [9, 31, 44], [9, 46, 57]] as const) {
    beam(b, -r + 1, r + 0.6, z0, r - 1, r + 0.6, z1, 0.6, 0.5, 0.7, 'lip')
    beam(b, r + 0.6, r - 1, z0, r + 0.6, -r + 1, z1, 0.5, 0.6, 0.7, 'lip')
  }
  // The deck, its rail posts, and a gold lamp on the south-east corner.
  b.box(-12, -12, 58, 12, 12, 61, (x, y, _z, _nx, _ny, nz) => (nz > 0.5 && (Math.abs(x) > 10.6 || Math.abs(y) > 10.6) ? 'lip' : nz > 0.5 && ((y + 12) % 4 + 4) % 4 < 0.8 ? 'ink' : 'wood'))
  for (const [x, y] of [[-11, 11], [11, -11], [-11, -11]] as const) b.box(x - 0.6, y - 0.6, 61, x + 0.6, y + 0.6, 66, 'wood')
  b.box(-11.6, 10.6, 65, 11.6, 11.6, 66.2, 'wood')
  b.box(10.6, -11.6, 65, 11.6, 11.6, 66.2, 'wood')
  b.post(11, 11, 61, 67, 0.7, 'pole')
  b.box(9.6, 9.6, 67, 12.4, 12.4, 70.4, (_x, _y, z, _nx, _ny, nz) => (nz > 0.5 ? 'pole' : z > 68 && z < 69.6 ? 'core' : 'gold'))
  b.box(9.2, 9.2, 70.4, 12.8, 12.8, 71.4, 'pole')
  // The sheave: an iron rim of beads round four spokes and a gold hub, on two bearing blocks.
  for (const y of [-3.2, 3.2]) {
    beam(b, -6, y, 61.5, -0.6, y, 72, 0.7, 0.6, 0.7, 'wood')
    beam(b, 6, y, 61.5, 0.6, y, 72, 0.7, 0.6, 0.7, 'wood')
  }
  const cz = 73
  const R = 9
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2
    b.ball(Math.cos(a) * R, 0, cz + Math.sin(a) * R, 1.3, 1, 1.3, 'chrome')
  }
  for (let s = 0; s < 4; s++) {
    const a = Math.PI / 4 + (s * Math.PI) / 2
    for (let k = 1; k <= 4; k++) b.ball(Math.cos(a) * k * 2, 0, cz + Math.sin(a) * k * 2, 0.8, 0.8, 0.8, 'rock')
  }
  b.ball(0, 0, cz, 1.8, 3.8, 1.8, 'gold')
  // The hoist rope off the wheel's east side, down into the shaft.
  b.box(R - 0.4, -0.4, 1, R + 0.4, 0.4, cz, 'sand')
}

/** A rock face with a seam of lumen through it: cyan crystals breaking out along the seam. */
function vein(b: Solids) {
  const seam = (x: number, y: number, z: number) => z - 0.42 * x + 0.18 * y - 9 + Math.sin(x * 0.5) * 1.2
  const rock: Pick = (x, y, z) => {
    const s = Math.abs(seam(x, y, z))
    if (s < 0.8) return 'glassCyan'
    if (s < 2.1) return 'bandCyan'
    if (s < 3 && hash(x, z, 31) > 0.5) return 'bandCyan'
    const c = Math.abs(z * 0.6 + x * 0.9 - 4 - Math.sin(z) * 0.8)
    if (c < 0.55 && z > 4) return 'crack'
    return hash(x * 0.5, z * 0.5 + y * 0.3, 32) > 0.8 ? 'stone' : 'boulder'
  }
  b.ball(0, -1, 9.5, 13.5, 11, 11, rock)
  b.ball(-8, 4, 6, 8, 7, 7, rock)
  b.ball(8, 3, 5.5, 7.5, 7.5, 6.5, rock)
  b.ball(2, 8, 3, 6, 4.5, 3.6, rock)
  // Crystals where the seam meets the surface, leaning out of it.
  crystal(b, -2, 7.5, 6, 3.2, 14, 0.1, 0.3)
  crystal(b, 3.5, 6.5, 9, 2.6, 11, 0.25, 0.25)
  crystal(b, 8.5, 4.5, 11, 2.2, 9, 0.35, 0.15)
  crystal(b, -7.5, 6.5, 4, 2, 8, -0.25, 0.25)
  crystal(b, 10.5, -1.5, 13, 1.8, 7, 0.3, 0)
  // Loose spoil at its foot.
  for (const [x, y, r] of [[-12, 9, 1.6], [12, 9, 1.3], [5, 13, 1.1]] as const) b.ball(x, y, r * 0.7, r, r, r * 0.8, 'rock')
}

/** A crate of tubes from the glassworks: a slatted crate, straw, glass tubes standing in it (two of them lit). */
function crate(b: Solids) {
  const W = 10
  const D = 8
  const H = 14
  b.box(-W, -D, 0, W, D, H, (x, y, z, nx, ny, nz) => {
    if (nz > 0.5) return Math.abs(x) > W - 1.6 || Math.abs(y) > D - 1.6 ? 'lip' : hash(x * 1.3, y * 1.3, 41) > 0.7 ? 'clay' : 'sand'
    const a = nx > 0.5 ? y : x
    const half = nx > 0.5 ? D : W
    if (Math.abs(a) > half - 1.8 || z > H - 1.6 || z < 1.6) return 'lip'
    if (((z - 1.6) % 4 + 4) % 4 < 0.7) return 'ink'
    // A brace across the south face and a pink stencil: GLASS, this way up.
    if (ny > 0.5 && Math.abs(x - (z - 7) * 1.25) < 1) return 'lip'
    if (ny > 0.5 && x > 3 && x < 7 && z > 8 && z < 9.6) return 'bandPink'
    return 'wood'
  })
  // Tubes in the straw: pale glass, one cyan and one pink hairpin lit for show.
  const tube = (x: number, y: number, h: number, glass: MatName) => {
    b.post(x, y, H - 1, H + h, 0.9, glass)
    b.post(x, y, H + h, H + h + 0.8, 0.9, glass === 'chrome' ? 'rock' : 'core')
  }
  tube(-6.5, -4, 13, 'chrome')
  tube(-4, -5.5, 9, 'chrome')
  tube(-2.5, -1.5, 15, 'glassCyan')
  tube(6.5, -5, 11, 'chrome')
  tube(1.5, -6, 7, 'chrome')
  // The pink hairpin: two legs and the bend across the top.
  b.post(2.5, 2, H - 1, H + 10, 0.9, 'neon')
  b.post(6.5, 2, H - 1, H + 10, 0.9, 'neon')
  b.box(2, 1.2, H + 10, 7, 2.8, H + 11.4, 'glassPink')
  // Two long tubes laid across the straw, and a twist of straw.
  b.box(-8.5, 3.5, H, 1, 5, H + 1.4, 'chrome')
  b.box(-8, 5.6, H, 2.5, 7, H + 1.2, 'rock')
  b.ball(-5, 1, H + 0.6, 2.4, 2, 1.2, 'sand')
}

export const QUARRY_THINGS: Record<string, Thing> = {
  ...Object.fromEntries(
    (Object.keys(GLYPHS) as Array<keyof typeof GLYPHS>).flatMap(k => [
      [`quarry_letter_${k}_off`, letter(GLYPHS[k], false)],
      [`quarry_letter_${k}_on`, letter(GLYPHS[k], true)],
    ]),
  ),
  quarry_cart_empty: cart(false),
  quarry_cart_full: cart(true),
  quarry_ramp_n: haulRamp(false),
  quarry_ramp_w: haulRamp(true),
  quarry_headframe: headframe,
  quarry_vein: vein,
  quarry_crate: crate,
}
