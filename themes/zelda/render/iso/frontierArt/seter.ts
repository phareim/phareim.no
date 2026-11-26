/**
 * SETER FELL's things (Neon Shrine art tasks F1 and F2), built as solids at the scene's own density (32 px to the
 * tile, x east, y south, z up from the ground) and drawn by `rasterThing`, so every pixel knows its depth and facing.
 *
 * F1, the seter farm: the turf-roofed log hut (chimney smoke in two frames; `seter_hut_night_*` the same two frames
 * with the window lit for the night, task L1), the byre on its stone footing, the
 * dry-stone fence by the tile (east-west, north-south and an end stack) and the milk churn stand.
 * F2, the sleeping trolls: moss hills of rounded rock with a face on the valley side and birches on the back,
 * asleep (`_0`) and waking (`_1`), a small one on 2×2 tiles and a long one on 3×2.
 *
 * The view looks from the south-east, so the faces that show are the tops, the south (+y) and the east (+x): the
 * huts' doors face south, the trolls look east-south-east, as the troll hump stamp's nose rock does.
 */
import type { MatName, Solids } from '../props'
import { RIM, lamplight } from './nightPanes'

/** A material rule: where a point of a solid is and which way it faces (as `Pick`). */
export type Paint = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => MatName
type Thing = (b: Solids) => void

/** A steady pseudo-random number in [0, 1) for a whole-px cell. */
export function noise(x: number, y: number, salt = 0): number {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263 + salt * 2246822519) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const paint = (pick: MatName | Paint): Paint => (typeof pick === 'string' ? () => pick : pick)

/**
 * The same solids in a house's own frame: u along the ridge, v across it. 'x' puts the ridge east-west (the long
 * wall shows south, the gable east); 'y' puts it north-south (the gable shows south, the long wall east).
 * Rules given to it are told the house's own coordinates and facings.
 */
export function turned(b: Solids, axis: 'x' | 'y'): Solids {
  if (axis === 'x') return b
  return {
    box: (u0, v0, z0, u1, v1, z1, pick) => {
      const p = paint(pick)
      b.box(v0, u0, z0, v1, u1, z1, (x, y, z, nx, ny, nz) => p(y, x, z, ny, nx, nz))
    },
    post: (cu, cv, z0, z1, r, pick) => {
      const p = paint(pick)
      b.post(cv, cu, z0, z1, r, (x, y, z, nx, ny, nz) => p(y, x, z, ny, nx, nz))
    },
    ball: (cu, cv, cz, ru, rv, rz, pick) => {
      const p = paint(pick)
      b.ball(cv, cu, cz, rv, ru, rz, (x, y, z, nx, ny, nz) => p(y, x, z, ny, nx, nz))
    },
  }
}

/** A gabled house in its own frame (`turned`): walls -u..u by -v..v, a pitched roof over them. */
export interface House {
  u: number
  v: number
  /** The top of the walls, where the eaves rest. */
  wall: number
  ridge: number
  /** How far the roof reaches past the long walls, and past the gables. */
  eave: number
  end: number
  /** The roof's thickness, across: under it the gable wall rises into the roof. */
  band: number
  walls: Paint
  /** The roof, told also how many layers above the eave this point lies. */
  roof: (u: number, v: number, z: number, nu: number, nv: number, nz: number, layer: number) => MatName
}

/** Where the roof's top lies at v (out from the ridge), for placing things on it. */
export function roofAt(h: House, v: number): number {
  const out = h.v + h.eave
  const z0 = h.wall - 2
  return z0 + (Math.round(h.ridge - z0)) * (1 - Math.min(out, Math.abs(v)) / out)
}

/** The house: its walls, the gables rising under the roof, the roof laid as one-px layers up to the ridge. */
export function house(b: Solids, h: House): void {
  const out0 = h.v + h.eave
  const z0 = h.wall - 2
  const n = Math.round(h.ridge - z0)
  const run = out0 / n
  b.box(-h.u, -h.v, 0, h.u, h.v, h.wall, h.walls)
  for (let i = 0; i < n; i++) {
    const z = z0 + i
    const outer = out0 - i * run
    const inner = outer - h.band
    const roof: Paint = (u, v, zz, nu, nv, nz) => h.roof(u, v, zz, nu, nv, nz, i)
    if (z + 1 > h.wall && inner > 0) b.box(-h.u, -inner - 0.6, Math.max(z, h.wall), h.u, inner + 0.6, z + 1, h.walls)
    if (inner > run) {
      b.box(-h.u - h.end, inner, z, h.u + h.end, outer, z + 1, roof)
      b.box(-h.u - h.end, -outer, z, h.u + h.end, -inner, z + 1, roof)
    } else b.box(-h.u - h.end, -outer, z, h.u + h.end, outer, z + 1, roof)
  }
}

// ---------------------------------------------------------------------------
// The seter's timber, stone and turf
// ---------------------------------------------------------------------------

/** Laid logs: three px a course, the dark seam under each. */
const logRows = (z: number): MatName => (Math.floor(z) % 3 === 0 ? 'ink' : 'chestWood')

/** Upright boards (a gable, a door): a dark seam every `w` px along. */
const boards = (a: number, w: number, face: MatName, seam: MatName = 'ink'): MatName =>
  (((Math.floor(a) % w) + w) % w === 0 ? seam : face)

/** Turf: grass with a little dry straw and heather in it; the sod's edge and the holding log where it is cut. */
function turf(eaveRows: number): House['roof'] {
  return (u, v, z, nu, _nv, nz, layer) => {
    if (nu > 0.5 || nu < -0.5) return layer < eaveRows ? 'chestWood' : noise(v, z, 3) > 0.7 ? 'chestWood' : 'moss'
    if (layer < eaveRows) return nz > 0.5 ? 'moss' : 'chestWood'
    // Heather and dry straw lie in patches, not as a scatter.
    const patch = noise(Math.floor((u + 64) / 6), Math.floor((Math.abs(v) + 64) / 3), 12)
    const k = noise(u, v * 3 + z, 11)
    if (patch < 0.07 && k > 0.6) return 'velvet'
    if (patch > 0.86 && nz > 0.5 && k > 0.3) return 'sand'
    return 'moss'
  }
}

/** Tufts of tall grass and a few flowers on a turf roof's south slope. */
function roofGrass(b: Solids, h: House, salt: number): void {
  for (let u = -h.u - h.end + 2; u < h.u + h.end - 1; u += 2.3) {
    const k = noise(u * 7, salt, 5)
    // Along the ridge, then a scatter down the slope.
    const v = k < 0.55 ? 1.5 + k * 3 : 4 + noise(u, salt, 6) * (h.v + h.eave - 7)
    const z = roofAt(h, v)
    const tall = 1.2 + noise(u, salt, 7) * 2.6
    b.post(u, v, z, z + tall, 0.55, noise(u, salt, 8) > 0.8 ? 'sand' : 'moss')
    if (noise(u, salt, 9) > 0.86) b.ball(u + 0.8, v + 0.5, z + 0.6, 0.8, 0.8, 0.7, noise(u, salt, 10) > 0.5 ? 'gold' : 'velvet')
  }
}

/** The four laft corners: each course's logs run on past the wall, crossing, their cut ends light. */
function laftCorners(b: Solids, u: number, v: number, z0: number, z1: number): void {
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const cu = su * u
    const cv = sv * v
    for (let k = 0, z = z0; z + 2 <= z1; k++, z += 3) {
      const along = k % 2 === 0
      const a0 = along ? cu - su : cu - su * 2.6
      const a1 = along ? cu + su * 3.4 : cu + su * 0.7
      const b0 = along ? cv - sv * 2.6 : cv - sv
      const b1 = along ? cv + sv * 0.7 : cv + sv * 3.4
      b.box(Math.min(a0, a1), Math.min(b0, b1), z + 0.5, Math.max(a0, a1), Math.max(b0, b1), z + 3, (_x, _y, _z, nx, ny) =>
        (along ? Math.abs(nx) > 0.5 : Math.abs(ny) > 0.5) ? 'sand' : 'chestWood')
    }
  }
}

/** A stone stack: courses of stones with mortar between, staggered. */
const masonry = (a: number, z: number): MatName => {
  const row = Math.floor(z / 3)
  if (Math.floor(z) % 3 === 0) return 'carve'
  return ((Math.floor(a + (row % 2) * 2) % 4) + 4) % 4 === 0 ? 'carve' : 'stone'
}

/** A chimney of stacked stone with a slab on top, smoke drifting north-east (frame 0 or 1). */
function chimney(b: Solids, x: number, y: number, z0: number, z1: number, smoke: 0 | 1): void {
  b.box(x - 3, y - 3, z0, x + 3, y + 3, z1, (px, py, pz, nx) => masonry(nx > 0.5 ? py : px, pz))
  b.box(x - 4, y - 4, z1, x + 4, y + 4, z1 + 1.6, 'stone')
  b.box(x - 1.6, y - 1.6, z1 + 1.6, x + 1.6, y + 1.6, z1 + 2.2, 'dark')
  const puffs = smoke === 0
    ? [[0, 0, 4, 2.4], [1.5, -2.5, 9, 3.2], [3.5, -6, 15, 2.6], [5, -10, 20, 1.6]]
    : [[0.5, -0.5, 6, 2.9], [2.5, -4, 12, 3], [4.5, -8, 18, 2.1], [5.5, -12.5, 22.5, 1.2]]
  for (const [dx, dy, dz, r] of puffs) b.ball(x + dx!, y + dy!, z1 + dz!, r!, r!, r! * 0.85, 'rock')
}

// ---------------------------------------------------------------------------
// F1 · The seter farm
// ---------------------------------------------------------------------------

const HUT: Omit<House, 'walls' | 'roof'> = { u: 23, v: 16, wall: 22, ridge: 40, eave: 4, end: 4, band: 4.5 }

/**
 * The hut's walls: logs, a plank door, a lit four-pane window on the south; boards and a loft hatch in the east gable.
 * At night (L1) the window's frame is a rim of spill light and its panes are brighter lamplight.
 */
const hutWalls = (night: boolean): Paint => (x, y, z, nx, ny, nz) => {
  if (nz > 0.5) return 'chestWood'
  if (nx > 0.5) {
    if (z >= HUT.wall) return Math.abs(y) < 2.6 && z > 25 && z < 30.5 ? (Math.abs(y) < 1.6 && z > 26 && z < 29.5 ? 'dark' : 'lip') : boards(y + 64, 4, 'chestWood')
    return logRows(z)
  }
  if (ny > 0.5) {
    // The door: upright planks, iron straps, a latch.
    if (x > 4 && x < 13 && z < 15) {
      if ((z > 3 && z < 4.2) || (z > 10.5 && z < 11.7)) return x < 9 ? 'pole' : 'wood'
      if (x > 10.6 && x < 11.8 && z > 7 && z < 8.4) return 'gold'
      return boards(x - 4, 3, 'wood')
    }
    // The window: four panes of lamplight in a pale frame.
    if (x > -16 && x < -6 && z > 8 && z < 16) {
      if (x < -15 || x > -7 || z < 9 || z > 15) return night ? RIM : 'lip'
      if (Math.abs(x + 11) < 0.6 || Math.abs(z - 12) < 0.55) return 'ink'
      if (night) return lamplight(x + 15, z - 9, 8, 6)
      return x < -13 && z > 13 ? 'core' : 'gold'
    }
    return logRows(z)
  }
  return logRows(z)
}

function hut(smoke: 0 | 1, night = false): Thing {
  return b => {
    const h: House = { ...HUT, walls: hutWalls(night), roof: turf(2) }
    // The door's frame and step, the window's sill: they stand out of the wall and shade it.
    b.box(-1, -4, 0, 1, 4, 0.4, 'dark')
    house(b, h)
    laftCorners(b, HUT.u, HUT.v, 0, HUT.wall)
    b.box(3, HUT.v, 0, 4.4, HUT.v + 1.2, 16, 'chestWood')
    b.box(12.6, HUT.v, 0, 14, HUT.v + 1.2, 16, 'chestWood')
    b.box(3, HUT.v, 15, 14, HUT.v + 1.4, 16.6, 'chestWood')
    b.box(2, HUT.v, 0, 15, HUT.v + 4.5, 2, (px, _py, _pz, _nx, _ny, nz) => (nz > 0.5 && noise(px, 1, 4) > 0.7 ? 'moss' : 'stone'))
    b.box(-17, HUT.v, 7, -5, HUT.v + 1.8, 8.2, 'lip')
    // A stack of firewood under the east gable's eave.
    b.box(HUT.u + 3.4, -9, 0, HUT.u + 8, 7, 9, (_px, py, pz, nx, _ny, nz) => {
      if (nx < 0.5) return nz > 0.5 ? 'chestWood' : 'ink'
      const cy = ((py + 64) % 3) - 1.5
      const cz = (pz % 3) - 1.5
      return cy * cy + cz * cz < 1.3 ? 'sand' : 'chestWood'
    })
    roofGrass(b, h, 1)
    chimney(b, -12, -3, 24, 44, smoke)
  }
}

const BYRE: Omit<House, 'walls' | 'roof'> = { u: 36, v: 17, wall: 23, ridge: 38, eave: 3, end: 4, band: 4.5 }

/** The byre's walls: a stone footing, logs over it, a pair of braced doors, two small vents; boards and a hay hatch in the gable. */
const byreWalls: Paint = (x, y, z, nx, ny, nz) => {
  if (nz > 0.5) return 'chestWood'
  const door = ny > 0.5 && Math.abs(x) < 9 && z < 18
  if (z < 5 && !door) return masonry(nx > 0.5 ? y : x, z + 1)
  if (nx > 0.5) {
    if (z >= BYRE.wall) {
      if (Math.abs(y) < 4.6 && z > 24 && z < 32) return Math.abs(y) < 3.4 && z > 25 && z < 31 ? 'dark' : 'sand'
      return boards(y + 64, 4, 'chestWood')
    }
    return logRows(z)
  }
  if (door) {
    // Two leaves, each a Z of lighter boards on dark planks.
    if (Math.abs(x) < 0.6) return 'ink'
    if (z > 17) return 'chestWood'
    const a = Math.abs(x)
    if ((z > 1.5 && z < 3) || (z > 14 && z < 15.5)) return 'sand'
    const diag = 2.2 + (9 - a) * (12 / 8.4)
    if (Math.abs(z - diag) < 0.9 && a < 8.4) return 'sand'
    if (a > 4.2 && a < 5.4 && z > 7.5 && z < 8.7) return 'pole'
    return boards(a, 3, 'wood')
  }
  if (ny > 0.5 && Math.abs(Math.abs(x) - 24) < 3 && z > 12 && z < 18) {
    return Math.abs(Math.abs(x) - 24) < 2 && z > 13 && z < 17 ? 'dark' : 'sand'
  }
  return logRows(z - 5)
}

const byre: Thing = b => {
  const h: House = { ...BYRE, walls: byreWalls, roof: turf(2) }
  b.box(-BYRE.u - 1, -BYRE.v - 1, 0, BYRE.u + 1, BYRE.v + 1, 5, (x, y, z, nx, ny, nz) =>
    (nz > 0.5 ? 'stone' : byreWalls(x, ny > 0.5 ? y - 1 : y, z, nx, ny, nz)))
  house(b, h)
  laftCorners(b, BYRE.u, BYRE.v, 5, BYRE.wall)
  // A bank of earth up to the doors, and hay spilling from the gable's hatch.
  b.box(-10, BYRE.v + 1, 0, 10, BYRE.v + 6, 1.6, (x, _y, _z, _nx, _ny, nz) => (nz > 0.5 && noise(x, 2, 5) > 0.6 ? 'sand' : 'chestWood'))
  b.box(-10, BYRE.v, 17, 10, BYRE.v + 1.4, 18.6, 'chestWood')
  b.ball(BYRE.u + 0.8, 0, 25.4, 1.8, 3.4, 1.6, (x, y) => (noise(x * 3, y * 3, 2) > 0.7 ? 'gold' : 'sand'))
  b.box(BYRE.u, 3.6, 24, BYRE.u + 5.5, 4.6, 32, (_x, _y, _z, _nx, ny) => (ny > 0.5 ? 'wood' : 'chestWood'))
  roofGrass(b, h, 2)
}

/** One stone of a dry wall: grey-violet, moss settled where it faces up. */
function stone(salt: number): Paint {
  const tone: MatName = (['rock', 'stone', 'boulder', 'rock'] as const)[Math.floor(noise(salt, 0, 21) * 4)]!
  return (x, y, _z, _nx, _ny, nz) => (nz > 0.72 && noise(x * 2, y * 2, salt) > 0.4 ? 'moss' : tone)
}

/** A tile of dry-stone fence along the x axis (`turned` stands it north-south): two courses, mossy on top. */
function fenceRun(b: Solids, salt: number): void {
  for (let i = 0; i < 5; i++) {
    const u = -12.8 + i * 6.4
    const j = noise(i, salt, 1)
    b.ball(u + (j - 0.5) * 1.2, (noise(i, salt, 2) - 0.5) * 1.4, 2.6, 3.6 + j * 0.6, 3.4, 3, stone(salt * 10 + i))
  }
  for (let i = 0; i < 5; i++) {
    const u = -16 + i * 6.4 + (i === 0 ? 0.4 : 0)
    const j = noise(i, salt, 3)
    b.ball(u, (j - 0.5) * 1.2, 7.4, 3.3 + j * 0.6, 3, 2.6, stone(salt * 10 + i + 5))
  }
  for (let i = 0; i < 3; i++) {
    const u = -9.6 + i * 9.6 + (noise(i, salt, 4) - 0.5) * 3
    b.ball(u, 0, 10, 2.4, 2, 1.4, 'moss')
    b.post(u + 1, 0.6, 10, 12.2, 0.55, 'moss')
  }
}

/** The end of a fence run or a corner: a broad stack, a flat cap, a tuft. */
const fenceEnd: Thing = b => {
  b.ball(0, 0, 3, 6, 5.6, 3.6, stone(91))
  b.ball(-0.6, 0.4, 8, 5, 4.6, 3, stone(92))
  b.ball(0.4, -0.2, 12.2, 4, 3.8, 2.2, stone(93))
  b.box(-4.4, -4, 14, 4.4, 4, 15.6, (x, y, _z, _nx, _ny, nz) => (nz > 0.5 && noise(x, y, 94) > 0.55 ? 'moss' : 'stone'))
  b.post(1.6, 1, 15.6, 18.4, 0.55, 'moss')
  b.post(-1, 1.6, 15.6, 17.6, 0.55, 'moss')
}

/** A milk churn: a tall tin can, two rolled hoops, a shoulder, a neck, a lid with a knob, a handle. */
function churn(b: Solids, x: number, y: number, z: number, tall: number): void {
  b.post(x, y, z, z + tall, 3.4, (_px, _py, pz) => (Math.abs(pz - z - 1.6) < 0.6 || Math.abs(pz - z - tall + 1.8) < 0.6 ? 'pole' : 'chrome'))
  b.ball(x, y, z + tall, 3.4, 3.4, 1.8, 'chrome')
  b.post(x, y, z + tall, z + tall + 3.4, 1.9, 'chrome')
  b.post(x, y, z + tall + 3.4, z + tall + 4.6, 2.5, 'pole')
  b.post(x, y, z + tall + 4.6, z + tall + 5.4, 0.8, 'pole')
  b.box(x - 0.5, y + 2.6, z + tall - 3.8, x + 0.5, y + 4.2, z + tall - 2.4, 'pole')
}

/** The milk churn stand: a plank table at cart height on four legs, three churns waiting for the cart. */
const churnStand: Thing = b => {
  for (const [x, y] of [[-10, -7], [10, -7], [-10, 7], [10, 7]]) b.post(x!, y!, 0, 12, 1.3, 'wood')
  b.box(-11.2, -1, 4, 11.2, 0.6, 5.4, 'wood')
  b.box(-12.4, -9, 12, 12.4, 9, 14.4, (x, y, _z, nx, ny, nz) => {
    if (nz > 0.5) return Math.floor(y + 9) % 4 === 0 ? 'ink' : 'wood'
    const a = nx > 0.5 ? y : x
    return ny > 0.5 && Math.abs(a) > 11.4 ? 'ink' : 'lip'
  })
  churn(b, -5.2, -3.6, 14.4, 11)
  churn(b, 3, -4.4, 14.4, 11)
  churn(b, -1.4, 4.2, 14.4, 9)
  // A tin cup on a nail, and a scrap of the seter's mark on the front plank.
  b.box(-12.4, 9, 12.4, -8.4, 9.4, 14, 'ink')
  b.post(8.4, 5, 14.4, 16.4, 1.4, 'chrome')
}

// ---------------------------------------------------------------------------
// F2 · The sleeping trolls
// ---------------------------------------------------------------------------

/** Rock where it falls away, moss where it faces up, a crack or a fleck of heather now and then. */
function hide(salt: number, high = 0.6): Paint {
  return (x, y, z, _nx, _ny, nz) => {
    const patch = noise(Math.floor((x + 64) / 4), Math.floor((y + z + 64) / 4), salt)
    const k = noise(x * 1.5 + z, y * 1.5 - z, salt + 1)
    if (nz > high + (patch - 0.5) * 0.45) return k > 0.985 ? 'velvet' : k < 0.03 ? 'sand' : 'moss'
    if (k > 0.975) return 'crack'
    return nz < 0.05 ? 'boulder' : 'rock'
  }
}

/** A birch on a troll's back: a pale trunk with dark marks, a small crown going gold. */
function birch(b: Solids, x: number, y: number, z: number, tall: number, salt: number): void {
  b.post(x, y, z - 2, z + tall, 1.1, (_px, _py, pz, nx) => (noise(pz, nx * 3, salt) > 0.72 ? 'ink' : 'chrome'))
  b.post(x + 1.2, y, z + tall * 0.55, z + tall * 0.55 + 0.9, 1.6, 'chrome')
  const crown = (px: number, py: number, pz: number, _nx: number, _ny: number, nz: number): MatName => {
    const k = noise(px * 2 + pz, py * 2 - pz, salt)
    if (k < 0.12) return 'moss'
    return nz > 0.3 && k > 0.55 ? 'gold' : 'sand'
  }
  b.ball(x - 1, y + 0.6, z + tall * 0.72, 3.6, 3.6, 3.4, crown)
  b.ball(x + 1.4, y - 1, z + tall * 0.9, 3.4, 3.4, 3.6, crown)
  b.ball(x, y, z + tall + 1.4, 2.8, 2.8, 3, crown)
}

/** A small spruce: a stack of dark green skirts narrowing to a tip. */
function spruce(b: Solids, x: number, y: number, z: number, tall: number): void {
  b.post(x, y, z - 2, z + 3, 1, 'chestWood')
  const tiers = 4
  for (let i = 0; i < tiers; i++) {
    const r = 4.6 * (1 - i / tiers) + 1
    const zz = z + 2 + (i * (tall - 4)) / tiers
    b.ball(x, y, zz + r * 0.45, r, r, r * 0.75, (px, py, pz, _nx, _ny, nz) => (nz > 0.6 && noise(px, py + pz, 7) > 0.7 ? 'chrome' : 'moss'))
  }
  b.post(x, y, z + tall - 1, z + tall + 1.6, 0.6, 'moss')
}

interface Face {
  /** The middle of the head. */
  x: number; y: number; z: number
  r: number
  /** Which way it looks, along the ground. */
  fx: number; fy: number
  awake: boolean
}

/**
 * A troll's head grown into its hill: a lump of rock, heavy brows, a great nose, the eyes shut in a crease or open
 * and lit pink, the mouth a seam or open a crack with a tooth in it.
 */
function head(b: Solids, f: Face, salt: number): void {
  const n = Math.hypot(f.fx, f.fy)
  const fx = f.fx / n
  const fy = f.fy / n
  // Across the face, toward the viewer's right.
  const sx = fy
  const sy = -fx
  const at = (fwd: number, side: number, up: number) => [f.x + fx * fwd + sx * side, f.y + fy * fwd + sy * side, f.z + up] as const
  const eyeUp = f.r * 0.22
  const eyeSide = f.r * 0.36
  const skin = hide(salt, 0.72)
  const face: Paint = (x, y, z, nx, ny, nz) => {
    const dx = x - f.x
    const dy = y - f.y
    const fwd = dx * fx + dy * fy
    if (fwd < f.r * 0.35) return skin(x, y, z, nx, ny, nz)
    const side = dx * sx + dy * sy
    const up = z - f.z
    for (const s of [-1, 1]) {
      const a = side - s * eyeSide
      const v = up - eyeUp
      if (f.awake) {
        const e = (a * a) / 6.2 + (v * v) / 3.2
        if (e < 1) return Math.abs(a + 0.4) < 0.6 && Math.abs(v) < 1.3 ? 'dark' : a < -0.6 && v > 0.4 ? 'core' : 'glassPink'
        if (e < 1.7 && v < 0) return 'crack'
      } else if (Math.abs(a) < 3.2 && Math.abs(v + 0.12 * a * a - 0.3) < 0.7) return 'crack'
    }
    // The mouth, under the nose.
    const mv = up + f.r * 0.5
    if (f.awake) {
      const e = (side * side) / 20 + (mv * mv) / 2.4
      if (e < 1) return Math.abs(side - 1.4) < 0.9 && mv > -0.2 ? 'stone' : 'dark'
    } else if (Math.abs(side) < 4.8 && Math.abs(mv - 0.05 * side * side) < 0.7) return 'crack'
    if (Math.abs(up) < f.r * 0.62 && noise(x * 2, y * 2 + z, salt) > 0.975) return 'crack'
    return nz > 0.8 ? 'moss' : nz < -0.25 ? 'boulder' : 'rock'
  }
  b.ball(f.x, f.y, f.z, f.r, f.r, f.r * 0.92, face)
  // Brows: two shelves of rock over the eyes, raised a little when it wakes.
  const lift = f.awake ? 1.3 : 0
  for (const s of [-1, 1]) {
    const [x, y, z] = at(f.r * 0.7, s * eyeSide, eyeUp + 2.6 + lift)
    b.ball(x, y, z, 3.6, 3.6, 2, hide(salt + s, 0.88))
  }
  // The nose: a round knob of rock, the biggest thing on the face.
  const [nx, ny, nz] = at(f.r * 0.98, 0.3, -f.r * 0.02)
  b.ball(nx, ny, nz, f.r * 0.33, f.r * 0.33, f.r * 0.36, (_x, _y, _z, _ax, _ay, az) => (az < -0.35 ? 'boulder' : 'stone'))
}

/** A troll's great hand laid on the ground in front of it, fingers curled. */
function hand(b: Solids, x: number, y: number, salt: number): void {
  b.ball(x, y, 3, 5.4, 4.6, 3.6, hide(salt, 0.8))
  for (let i = 0; i < 3; i++) b.ball(x + 4.6, y - 2.8 + i * 2.8, 1.8, 2, 1.3, 1.8, 'rock')
  b.ball(x + 1, y + 4.6, 1.8, 2.2, 1.5, 1.8, 'rock')
}

/** Pebbles shaken loose as a troll stirs, and a clod of moss sliding. */
function stir(b: Solids, x: number, y: number, z: number): void {
  b.ball(x, y, z, 1.4, 1.4, 1.2, 'rock')
  b.ball(x + 3, y - 2, z + 4, 1, 1, 0.9, 'rock')
  b.ball(x - 2.4, y + 1.2, z + 6.4, 0.8, 0.8, 0.8, 'boulder')
}

/** The small troll, 2×2 tiles: curled round, its face to the east-south-east, a birch on its back. */
function trollSmall(awake: boolean): Thing {
  return b => {
    const s = 31
    const up = awake ? 1 : 0
    b.ball(-20, -12, 4.4, 10, 9, 6.4, hide(s + 2))
    b.ball(-19, 9, 4.6, 10, 9, 6.6, hide(s + 1))
    b.ball(2, -19, 4.6, 11, 8, 6.6, hide(s + 3))
    b.ball(-7, -5, 11, 19, 17, 13, hide(s))
    b.ball(-4, 11, 6.4, 12, 8, 7.4, hide(s + 6))
    hand(b, 2, 21, s + 7)
    head(b, { x: 12, y: 7, z: 10.5 + up, r: 12.5, fx: 1, fy: 0.75, awake }, s + 8)
    birch(b, -10, -8, 23, 15, s)
    if (awake) stir(b, 2, -16, 22)
  }
}

/** The big troll, 3×2 tiles: lying long east-west, the head at the east end, a hand before it, a birch and a spruce on its back. */
function trollBig(awake: boolean): Thing {
  return b => {
    const s = 47
    const up = awake ? 1.4 : 0
    b.ball(-37, 2, 4.4, 10, 11, 6.6, hide(s + 1))
    b.ball(-28, -17, 4.6, 12, 9, 6.8, hide(s + 2))
    b.ball(-4, -21, 4.8, 15, 8, 7, hide(s + 3))
    b.ball(-20, 15, 4.6, 14, 9, 6.8, hide(s + 4))
    b.ball(-27, -3, 10.5, 15, 15, 12, hide(s + 6))
    b.ball(-6, -6, 15, 21, 18, 16, hide(s))
    b.ball(2, 12, 7.4, 13, 8, 7.4, hide(s + 9))
    hand(b, 16, 22, s + 10)
    head(b, { x: 22, y: 6, z: 13 + up, r: 15, fx: 1, fy: 0.7, awake }, s + 11)
    birch(b, -12, -9, 29, 18, s)
    birch(b, -26, -5, 21, 13, s + 1)
    spruce(b, 0, -16, 23, 14)
    if (awake) {
      stir(b, -4, -22, 30)
      stir(b, 12, 18, 16)
    }
  }
}

// ---------------------------------------------------------------------------
// The varde on Cairn Ridge (art round 4)
// ---------------------------------------------------------------------------

/**
 * The varde: a tall cairn of flat grey stones stacked into a tapering tower on one tile of the ridge, lichen and moss
 * where the stones face up, a stick wedged in its top with a strip of cloth flying from it (east, with the wind over
 * the tops). About 1 tile across and 3½ tall, so it shows from the Big Seter and the fell road.
 */
const varde: Thing = b => {
  // A ring of footing stones half sunk in the heather.
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4
    b.ball(Math.cos(a) * 11, Math.sin(a) * 10, 1.6, 4 + noise(i, 1, 61) * 1.4, 3.4, 2.4, stone(600 + i))
  }
  // The stack: flat slabs, each a little smaller and a little off the one under it.
  const courses = 22
  for (let k = 0; k < courses; k++) {
    const t = k / (courses - 1)
    const r = 12.5 - t * 7.5 + (noise(k, 2, 62) - 0.5) * 1.6
    const z = 2 + k * 4.6
    const dx = (noise(k, 3, 63) - 0.5) * 2.2
    const dy = (noise(k, 4, 64) - 0.5) * 2
    b.ball(dx, dy, z + 2.2, r, r * (0.86 + noise(k, 5, 65) * 0.12), 2.5, (x, y, zz, nx, ny, nz) => {
      if (nz > 0.6) return noise(x * 2, y * 2, 70 + k) > 0.85 ? 'moss' : k % 3 === 0 ? 'rock' : 'stone'
      // Grey-lilac stone with dark seams between the slabs, lichen in patches.
      if (zz < z + 0.9) return 'crack'
      const lichen = noise(Math.floor((x + 64) / 3), Math.floor((y + zz + 64) / 3), 80 + k)
      if (lichen > 0.86) return 'sand'
      return (['stone', 'rock', 'boulder', 'rock'] as const)[Math.floor(noise(k, nx * 3 + ny, 66) * 4)]!
    })
  }
  // The top: a capstone, a weathered stick wedged in it, the cloth strip flying east from its tip.
  const top = 2 + courses * 4.6
  b.ball(0.6, 0, top + 1.6, 4.2, 3.8, 2.4, 'stone')
  b.post(0.4, -0.4, top + 2, top + 22, 0.9, 'chestWood')
  for (let i = 0; i < 6; i++) {
    const u = 1.2 + i * 2.2
    b.box(u, -0.9, top + 18.5 - i * 0.9 - (i % 2) * 0.6, u + 2.4, -0.1, top + 21.5 - i * 1.1 - (i % 2) * 0.6, i < 2 ? 'velvet' : i < 4 ? 'sand' : 'blockCyan')
  }
}

/** Every SETER FELL thing by id; `_0`/`_1` are the frames of one thing. */
export const SETER_THINGS: Record<string, Thing> = {
  seter_hut_0: hut(0),
  seter_hut_1: hut(1),
  seter_hut_night_0: hut(0, true),
  seter_hut_night_1: hut(1, true),
  seter_byre: byre,
  seter_fence_ew: b => fenceRun(b, 3),
  seter_fence_ns: b => fenceRun(turned(b, 'y'), 4),
  seter_fence_end: fenceEnd,
  seter_churns: churnStand,
  seter_troll_small_0: trollSmall(false),
  seter_troll_small_1: trollSmall(true),
  seter_troll_big_0: trollBig(false),
  seter_troll_big_1: trollBig(true),
  seter_varde: varde,
}
