/**
 * YULE FJORD's things (Neon Shrine art tasks Y1 and Y2), built as solids at the scene's own density (32 px to the
 * tile, x east, y south, z up from the ground or the still water) and drawn by `rasterThing`.
 *
 * Y1, the fjord village: the red boathouse on stilts (boat doors to the east, a deck over the water), the
 * ochre snow-roofed cottage (its gable and door to the south, icicles on the eaves), the small tarred stave church
 * (an arcaded gallery, dragon heads, the bell in its turret, a spire), the lighthouse whose beam turns through the
 * four quarters (`_0` east, `_1` south, `_2` west, `_3` north: clockwise seen from above), and a lantern post, lit
 * and put out.
 * L1/L2, the night: the cottage with its windows lit (`fjord_cottage_night`, rims of spill light round the panes),
 * and the lighthouse's lens frames without the baked beam (`fjord_lighthouse_lens_0`…`_3`, the same quarters as
 * the beam frames), the lamp room brighter and its lit side white-gold, for a beam drawn by the renderer.
 * Y2, the ice: three floes, the mirror block for the beam puzzles (`_a` its mirror from north-west to south-east,
 * `_b` from north-east to south-west, drawn as a line on its top), and the frozen edge where the ice breaks off
 * toward open water, by the side the water lies on (`_n`, `_e`, `_s`, `_w`).
 *
 * Snow is the pale lavender of `chrome`, ice the deep `blockCyan`; the lamps are gold with a white heart.
 */
import type { MatName, Solids } from '../props'
import { RIM, lamplight } from './nightPanes'
import { house, noise, roofAt, turned, type House, type Paint } from './seter'

type Thing = (b: Solids) => void

/** The same solids raised by `dz` (a house on stilts); its rules are told heights from the new floor. */
function lifted(b: Solids, dz: number): Solids {
  const at = (pick: MatName | Paint): MatName | Paint =>
    typeof pick === 'string' ? pick : (x, y, z, nx, ny, nz) => pick(x, y, z - dz, nx, ny, nz)
  return {
    box: (x0, y0, z0, x1, y1, z1, pick) => b.box(x0, y0, z0 + dz, x1, y1, z1 + dz, at(pick)),
    post: (x, y, z0, z1, r, pick) => b.post(x, y, z0 + dz, z1 + dz, r, at(pick)),
    ball: (x, y, z, rx, ry, rz, pick) => b.ball(x, y, z + dz, rx, ry, rz, at(pick)),
  }
}

/** Snow wherever a surface faces up enough, the material under it elsewhere. */
const snowy = (under: MatName, above = 0.55): Paint => (x, y, _z, _nx, _ny, nz) =>
  (nz > above + (noise(x * 2, y * 2, 5) - 0.5) * 0.2 ? 'chrome' : under)

/** A roof under snow: the snow lies thick on every layer, the shingle or board edge shows at the eave and the ends. */
function snowRoof(edge: MatName): House['roof'] {
  return (_u, _v, _z, nu, _nv, nz, layer) => {
    if (Math.abs(nu) > 0.5) return layer < 1 ? edge : layer % 3 === 0 ? edge : 'chrome'
    if (layer < 1) return nz > 0.5 ? 'chrome' : edge
    return 'chrome'
  }
}

/** Icicles under an eave, along u at v, hanging from z. */
function icicles(b: Solids, u0: number, u1: number, v: number, z: number, salt: number): void {
  for (let u = u0; u <= u1; u += 2.6) {
    const k = noise(u * 5, salt, 31)
    if (k < 0.45) continue
    b.post(u, v, z - 1 - (k - 0.45) * 5, z, 0.55, 'blockCyan')
  }
}

/** Upright boards: a darker seam every `w` px along. */
const boards = (a: number, w: number, face: MatName, seam: MatName): MatName =>
  (((Math.floor(a) % w) + w) % w === 0 ? seam : face)

/**
 * A four-pane window of lamplight in a white frame: `a` along the wall from its middle, `z` from its sill.
 * At night the frame is a rim of spill light and the panes are brighter.
 */
function pane(a: number, z: number, w: number, h: number, night = false): MatName | null {
  if (Math.abs(a) > w / 2 || z < 0 || z > h) return null
  if (Math.abs(a) > w / 2 - 1 || z < 1 || z > h - 1) return night ? RIM : 'chrome'
  if (Math.abs(a) < 0.55 || Math.abs(z - h / 2) < 0.55) return 'ink'
  if (night) return lamplight(a + w / 2 - 1, z - 1, w - 2, h - 2)
  return a < -w / 2 + 2.2 && z > h - 2.6 ? 'core' : 'gold'
}

// ---------------------------------------------------------------------------
// Y1 · The fjord village
// ---------------------------------------------------------------------------

const BOATHOUSE: Omit<House, 'walls' | 'roof'> = { u: 30, v: 18, wall: 21, ridge: 40, eave: 4, end: 4, band: 4.5 }
const FLOOR = 10

/** Red boards with white corner boards; two lit windows and a door on the south, the boat doors in the east gable. */
const boathouseWalls: Paint = (x, y, z, nx, ny, nz) => {
  const { u, v } = BOATHOUSE
  if (nz > 0.5) return 'clay'
  if (nx > 0.5) {
    if (Math.abs(y) > v - 1.6) return 'chrome'
    // The boat doors: two leaves with a white X each, the gap between them dark.
    if (Math.abs(y) < 10 && z < 17) {
      if (z > 16 || Math.abs(y) > 9) return 'chrome'
      if (Math.abs(y) < 0.6) return 'dark'
      const a = Math.abs(y) - 0.6
      if (Math.abs(z - 1 - a * 1.75) < 0.95 || Math.abs(z - 15.8 + a * 1.75) < 0.95) return 'chrome'
      return boards(y + 64, 3, 'clay', 'wood')
    }
    // The loft hatch high in the gable.
    if (Math.abs(y) < 3.2 && z > 23 && z < 29) return Math.abs(y) < 2.2 && z > 24 && z < 28 ? 'wood' : 'chrome'
    return boards(y + 64, 4, 'clay', 'wood')
  }
  if (ny > 0.5) {
    if (Math.abs(x) > u - 1.6 || z < 1) return 'chrome'
    for (const wx of [-19, -5]) { const p = pane(x - wx, z - 7, 7, 7); if (p) return p }
    if (x > 8 && x < 16 && z < 15) {
      if (x < 9 || x > 15 || z > 14) return 'chrome'
      return boards(x - 8, 3, 'wood', 'ink')
    }
    return boards(x + 64, 4, 'clay', 'wood')
  }
  return 'clay'
}

const boathouse: Thing = b => {
  const { u, v } = BOATHOUSE
  // Stilts in the water, braced; the floor beams; a deck over the water at the boat doors.
  for (const x of [-28, -14, 0, 14, 28, 44]) for (const y of [-16, 16]) b.post(x, y, 0, FLOOR, 1.6, x === 44 ? 'wood' : 'pole')
  b.box(-30, 15.4, 3.6, 30, 16.6, 4.8, 'pole')
  b.box(-u - 2, -v - 2, FLOOR - 2.4, u + 2, v + 2, FLOOR, 'wood')
  b.box(u, -v - 2, FLOOR - 1.4, u + 16, v + 2, FLOOR, (x, y, _z, nx, ny, nz) => {
    if (nz > 0.5) return noise(x, y * 0.4, 9) > 0.82 ? 'chrome' : Math.floor(x - u) % 4 === 0 ? 'ink' : 'wood'
    return nx > 0.5 || ny > 0.5 ? 'wood' : 'ink'
  })
  // The deck's bollard and its rope, a crate, snow heaped at the deck's corner.
  b.post(u + 13.5, v - 1, FLOOR, FLOOR + 4.2, 1.4, snowy('pole'))
  b.box(u + 5, -v + 1, FLOOR, u + 10, -v + 6, FLOOR + 4.4, snowy('chestWood'))
  b.ball(u + 14, -v, FLOOR + 0.6, 2.4, 2.4, 1.6, 'chrome')
  const up = lifted(b, FLOOR)
  const h: House = { ...BOATHOUSE, walls: boathouseWalls, roof: snowRoof('board') }
  house(up, h)
  // The steps down from the door to the strand.
  for (let i = 0; i < 4; i++) b.box(8.6, v + 1.6 + i * 2.4, 0, 15.4, v + 4 + i * 2.4, FLOOR - i * 2.5, snowy('wood', 0.5))
  // The hoist beam out of the gable, its rope and hook.
  up.box(u, -0.8, 31, u + 7, 0.8, 32.6, snowy('wood'))
  up.post(u + 6, 0, 25, 31, 0.45, 'ink')
  up.box(u + 5.4, -0.5, 24, u + 6.6, 0.5, 25, 'pole')
  // A life ring on the south wall, red and white.
  up.ball(-12, v + 0.6, 10, 2.8, 0.7, 2.8, (x, _y, z) => {
    const dx = x + 12
    const dz = z - FLOOR - 10
    if (Math.hypot(dx, dz) < 1.2) return 'clay'
    return Math.floor((Math.atan2(dz, dx) / Math.PI + 1) * 2) % 2 ? 'velvet' : 'chrome'
  })
  // A lantern on a bracket at the south-east corner, lit.
  up.box(u - 0.5, v, 17, u + 0.5, v + 3, 18, 'pole')
  up.box(u - 1.6, v + 1.4, 12.4, u + 1.6, v + 4.6, 16.4, (_x, _y, z, _nx, _ny, nz) => (nz > 0.5 ? 'pole' : z - FLOOR > 13.2 && z - FLOOR < 15.6 ? 'core' : 'gold'))
  up.box(u - 2, v + 1, 16.4, u + 2, v + 5, 17.2, 'chrome')
  icicles(up, -u - 2, u + 2, v + BOATHOUSE.eave - 0.6, BOATHOUSE.wall - 2, 3)
}

const COTTAGE: Omit<House, 'walls' | 'roof'> = { u: 19, v: 15, wall: 19, ridge: 36, eave: 4, end: 3, band: 4.5 }

/**
 * The cottage in its own frame (ridge north-south: u is south, v is east): ochre boards with white corners, the
 * red door in the south gable with a chalk cross on it, a lit window over it, two lit windows on the east wall.
 */
const cottageWalls = (night: boolean): Paint => (u, v, z, nu, nv, nz) => {
  if (nz > 0.5) return 'sand'
  const clap = Math.floor(z) % 3 === 0 ? 'chestWood' : 'sand'
  if (nu > 0.5) {
    if (Math.abs(v) > COTTAGE.v - 1.6) return 'chrome'
    if (Math.abs(v) < 4.6 && z < 15.6) {
      if (Math.abs(v) > 3.6 || z > 14.6) return 'chrome'
      // The chalk cross, drawn a little crooked.
      if ((Math.abs(v + 0.2) < 0.5 && z > 8 && z < 12.6) || (Math.abs(z - 10.8) < 0.5 && Math.abs(v) < 1.8)) return 'chrome'
      if (v > 2 && v < 3 && z > 6.6 && z < 7.8) return 'gold'
      return boards(v + 64, 3, 'clay', 'wood')
    }
    const p = pane(v, z - 22, 6, 6, night)
    if (p) return p
    return z >= COTTAGE.wall ? boards(v + 64, 3, 'sand', 'chestWood') : clap
  }
  if (nv > 0.5) {
    if (Math.abs(u) > COTTAGE.u - 1.6) return 'chrome'
    for (const wu of [-8, 7]) { const p = pane(u - wu, z - 6, 7, 8, night); if (p) return p }
  }
  return clap
}

const cottage = (night: boolean): Thing => b => {
  const t = turned(b, 'y')
  const h: House = { ...COTTAGE, walls: cottageWalls(night), roof: snowRoof('chrome') }
  house(t, h)
  // A brick chimney through the snow near the north end, capped white.
  const cz = roofAt(h, 3) - 2
  t.box(-12, -5, cz, -7, 1, cz + 12, (u, v, z, nu) => {
    const a = nu > 0.5 ? v : u
    const row = Math.floor(z / 2.5)
    return Math.floor(z * 0.4) === z * 0.4 || ((Math.floor(a + (row % 2) * 1.5) % 3) + 3) % 3 === 0 ? 'wood' : 'clay'
  })
  t.box(-12.8, -5.8, cz + 12, -6.2, 1.8, cz + 13.4, 'chrome')
  // The door step, a snow drift along the east wall, icicles on the east eave.
  t.box(COTTAGE.u, -5.5, 0, COTTAGE.u + 4, 5.5, 2, snowy('stone', 0.5))
  for (const [u, r] of [[-14, 3.6], [-6, 2.6], [12, 3.2]] as const) t.ball(u, COTTAGE.v + 1, 0.6, r * 1.6, r, r * 0.7, 'chrome')
  icicles(t, -COTTAGE.u - 2, COTTAGE.u + 2, COTTAGE.v + COTTAGE.eave - 0.6, COTTAGE.wall - 2, 5)
  // A wreath of spruce on the door.
  t.ball(COTTAGE.u + 0.5, 0, 12.6, 0.5, 1.5, 1.5, (_u, v, z) => (Math.abs(v) < 0.5 && z < 12.6 ? 'velvet' : 'moss'))
}

/** The church's walls: tarred upright staves, small round windows lit gold, and the gallery's arcade below. */
const staves: Paint = (x, y, z, nx, ny, nz) => {
  if (nz > 0.5) return 'chestWood'
  const a = nx > 0.5 ? y : x
  if (z > 20 && (ny > 0.5 || nx > 0.5)) {
    for (const wa of nx > 0.5 ? [0] : [-12, 0, 12]) {
      const d = Math.hypot(a - wa, z - 24)
      if (d < 1.9) return d < 1 ? 'core' : 'gold'
      if (d < 2.6) return 'sand'
    }
  }
  return boards(a + 64, 3, 'chestWood', 'ink')
}

const gallery: Paint = (x, y, z, nx, ny, nz) => {
  if (nz > 0.5) return 'chestWood'
  const a = nx > 0.5 ? y : x
  if (z > 10) return 'board'
  // The portal in the middle of the south side: carved pale posts, a dark door with a strip of light under it.
  if (ny > 0.5 && Math.abs(x) < 5) {
    if (Math.abs(x) > 3.6 || z > 9.4 - 0.25 * x * x * 0.3) return 'sand'
    if (z < 1.2) return 'gold'
    return Math.abs(x) < 0.4 ? 'ink' : 'wood'
  }
  // The arcade: round-headed openings between the posts.
  const p = (((a + 64) % 6) + 6) % 6 - 3
  if (Math.abs(p) < 1.9 && z > 3 && z < 8 + Math.sqrt(Math.max(0, 3.6 - p * p)) - 0.2) return 'dark'
  if (z < 2.4) return 'board'
  return 'chestWood'
}

/** A dragon head curling up off a gable's tip, toward `s` (1 east, -1 west). */
function dragon(b: Solids, x: number, z: number, s: number): void {
  const links: [number, number, number][] = [[0, 0, 1.6], [1.6, 1.4, 1.4], [2.8, 3.2, 1.3], [3, 5.2, 1.2], [2, 6.6, 1.1]]
  for (const [dx, dz, r] of links) b.ball(x + s * dx, 0, z + dz, r, r, r, 'chestWood')
  b.ball(x + s * 3.4, 0, z + 6.6, 1.3, 0.9, 0.7, 'ink')
  b.box(x + s * 2.2 - 0.4, -1.2, z + 6.6, x + s * 2.2 + 0.4, 1.2, z + 7.4, 'gold')
}

const church: Thing = b => {
  b.box(-31, -21, 0, 31, 21, 3, snowy('stone', 0.5))
  b.box(-29, -19, 3, 29, 19, 11, gallery)
  // The gallery's lean-to roof, layer on layer up to the nave's walls, deep in snow.
  for (let i = 0; i < 6; i++) {
    const ox = 31 - i * 1.4
    const oy = 21 - i * 1.4
    b.box(-ox, -oy, 11 + i, ox, oy, 12 + i, (_x, _y, _z, _nx, _ny, nz) => (nz > 0.5 || i > 0 ? 'chrome' : 'board'))
  }
  const nave: House = { u: 22, v: 13, wall: 30, ridge: 52, eave: 3, end: 3, band: 4.5, walls: staves, roof: snowRoof('board') }
  house(b, nave)
  dragon(b, nave.u + nave.end, nave.ridge - 1, 1)
  dragon(b, -nave.u - nave.end, nave.ridge - 1, -1)
  // The turret: an open belfry with the bell in it, a skirt of roof, the spire, a cross.
  b.box(-5, -5, 46, 5, 5, 60, (x, y, z, nx, _ny, nz) => {
    if (nz > 0.5) return 'chrome'
    const a = nx > 0.5 ? y : x
    if (Math.abs(a) < 3 && z > 51 && z < 58) {
      const bell = (a / 2.2) ** 2 + ((z - 54.6) / 2.6) ** 2
      if (bell < 1 && z < 56.6) return z < 52.6 && Math.abs(a) > 1.2 ? 'core' : 'gold'
      if (Math.abs(a) < 0.4 && z > 56.4) return 'pole'
      return 'dark'
    }
    return boards(a + 64, 3, 'chestWood', 'ink')
  })
  for (let i = 0; i < 4; i++) {
    const r = 7.5 - i * 0.9
    b.box(-r, -r, 60 + i, r, r, 61 + i, (_x, _y, _z, _nx, _ny, nz) => (nz > 0.5 || i > 0 ? 'chrome' : 'board'))
  }
  for (let i = 0; i < 18; i++) {
    const r = 4.6 * (1 - i / 18) + 0.5
    b.box(-r, -r, 64 + i, r, r, 65 + i, (_x, _y, _z, _nx, _ny, nz) => (nz > 0.5 ? 'chrome' : i % 3 === 2 ? 'chrome' : 'board'))
  }
  b.box(-0.5, -0.5, 82, 0.5, 0.5, 89, 'gold')
  b.box(-2.2, -0.5, 85.4, 2.2, 0.5, 86.4, 'gold')
}

/**
 * The lighthouse: a striped tower on a snowy rock, a gallery, the lamp room, its beam out toward `dir`.
 * `bakedBeam` keeps the beam in the current map's four frames. The lens-only frames will be used by the
 * procedural beam. Both use the brighter white-gold lens.
 */
function lighthouse(dir: 0 | 1 | 2 | 3, bakedBeam: boolean): Thing {
  const [dx, dy] = ([[1, 0], [0, 1], [-1, 0], [0, -1]] as const)[dir]
  return b => {
    // The rock it stands on.
    for (const [x, y, r, h] of [[-9, 6, 8, 5], [8, -7, 8, 5], [7, 8, 7, 4], [-8, -8, 7, 4.4], [0, 12, 5, 3]] as const) {
      b.ball(x, y, h * 0.5, r, r * 0.9, h, snowy('rock', 0.45))
    }
    b.post(0, 0, 0, 6, 12.5, snowy('stone', 0.5))
    // The tower: ten-px bands of red and white, narrowing as it climbs; a door, slit windows, one lit.
    for (let k = 0; k < 11; k++) {
      const z0 = 6 + k * 5
      const r = 9.6 - k * 0.28
      b.post(0, 0, z0, z0 + 5, r, (x, y, z, nx, ny) => {
        const band = Math.floor((z - 6) / 10) % 2 === 0 ? 'clay' : 'chrome'
        const south = ny > 0.86 && Math.abs(x) < 3.4
        if (south && z < 18) return Math.abs(x) > 2.6 || z > 17 ? 'chrome' : Math.abs(x) < 0.5 ? 'ink' : 'board'
        if (south && Math.abs(x) < 1.4 && ((z > 30 && z < 35) || (z > 47 && z < 52))) return z > 47 ? 'gold' : 'dark'
        if (nx > 0.86 && Math.abs(y) < 1.4 && z > 38 && z < 43) return 'dark'
        return band
      })
    }
    // The gallery and its railing.
    b.post(0, 0, 61, 63, 10.5, 'pole')
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      b.post(Math.cos(a) * 9.8, Math.sin(a) * 9.8, 63, 67, 0.5, 'pole')
    }
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2
      b.box(Math.cos(a) * 9.8 - 0.7, Math.sin(a) * 9.8 - 0.7, 66.4, Math.cos(a) * 9.8 + 0.7, Math.sin(a) * 9.8 + 0.7, 67.4, 'pole')
    }
    // The lamp room: gold panes between dark bars, the pane the light faces white.
    b.post(0, 0, 63, 65, 6.4, 'pole')
    b.post(0, 0, 65, 74, 5.8, (x, _y, z, nx, ny) => {
      const a = Math.atan2(ny, nx) / (Math.PI / 4)
      if (Math.abs(a - Math.round(a)) < 0.14) return 'pole'
      const toward = nx * dx + ny * dy
      // White where it faces the beam, a white-gold checker either side of that, gold round the back.
      if (toward > 0.55) return 'core'
      if (toward > -0.05) return (Math.floor(x * 1.3) + Math.floor(z)) & 1 ? 'core' : 'gold'
      return 'gold'
    })
    // The lens itself, a white bull's-eye in a gold ring on the lit side; under it, the lamp's light on the gallery floor.
    b.ball(dx * 5.4, dy * 5.4, 69.5, 2.9, 2.9, 3.1, 'gold')
    b.ball(dx * 6.2, dy * 6.2, 69.5, 1.9, 1.9, 2.1, 'core')
    b.box(dx * 7.2 - 1.4 + Math.min(0, dx) * 2, dy * 7.2 - 1.4 + Math.min(0, dy) * 2, 63, dx * 7.2 + 1.4 + Math.max(0, dx) * 2, dy * 7.2 + 1.4 + Math.max(0, dy) * 2, 63.4, 'gold')
    b.post(0, 0, 74, 75.6, 7.4, snowy('pole', 0.5))
    b.ball(0, 0, 75.6, 6.2, 6.2, 5.2, snowy('clay', 0.8))
    b.post(0, 0, 80, 84, 0.7, 'pole')
    b.ball(0, 0, 84.6, 1.2, 1.2, 1.2, 'gold')
    if (bakedBeam) beam(b, dx, dy, 69, dir)
  }
}

/**
 * The beam: a flat fan of light out of the lamp room, a white heart in its middle near the lamp, cyan at its
 * edges, breaking up into scattered motes as it widens and fades.
 */
function beam(b: Solids, dx: number, dy: number, z: number, salt: number): void {
  const lx = -dy
  const ly = dx
  for (let s = 7; s < 66; s++) {
    const half = 1.2 + (s - 7) * 0.14
    const fade = s < 18 ? 1 : 1 - (s - 18) / 56
    for (let l = -Math.floor(half); l <= Math.floor(half); l++) {
      const edge = Math.abs(l) / (half + 0.5)
      const solid = s < 22 && edge < 0.5
      if (!solid && (((s + l) % 2 + 2) % 2 !== 0 || noise(s, l, 70 + salt) > fade * (1.05 - edge * 0.7))) continue
      const m: MatName = edge < 0.3 && s < 46 ? 'core' : 'glassCyan'
      const x = dx * s + lx * l
      const y = dy * s + ly * l
      b.box(x - 0.5, y - 0.5, z, x + 0.5, y + 0.5, z + 1, m)
    }
  }
}

/** A lantern post: a dark timber post, an arm to the east, a lantern hanging from it, snow on the tops. */
function lanternPost(lit: boolean): Thing {
  return b => {
    b.box(-2.4, -2.4, 0, 2.4, 2.4, 2.4, snowy('stone', 0.5))
    b.box(-1.3, -1.3, 2.4, 1.3, 1.3, 30, (_x, _y, z, _nx, _ny, nz) => (nz > 0.5 ? 'chrome' : Math.abs(z - 20) < 0.6 ? 'pole' : 'wood'))
    b.box(-1, -0.8, 27, 9, 0.8, 28.6, snowy('wood'))
    b.box(-0.4, -0.4, 22, 0.4, 0.4, 27, 'wood')
    b.post(7.4, 0, 25, 27, 0.4, 'pole')
    b.box(5, -2.4, 24, 9.8, 2.4, 25, 'pole')
    b.box(5.4, -2, 17.4, 9.4, 2, 24, (x, y, z, nx, _ny, nz) => {
      if (nz > 0.5) return 'pole'
      const a = nx > 0.5 ? y : x - 7.4
      if (Math.abs(a) > 1.4 || z < 18.2 || z > 23.2) return 'pole'
      if (!lit) return 'dark'
      return Math.abs(a) < 0.7 && z > 19.6 && z < 21.8 ? 'core' : 'gold'
    })
    b.box(5.8, -1.6, 16.6, 9, 1.6, 17.4, 'pole')
    b.ball(7.4, 0, 25.2, 2.2, 2.2, 0.8, 'chrome')
  }
}

// ---------------------------------------------------------------------------
// Y2 · The ice
// ---------------------------------------------------------------------------

/** Ice: deep cyan, snow lying in patches on top, a bright rim at the top of every broken side, a glint or two. */
const ice: Paint = (x, y, z, _nx, _ny, nz) => {
  if (nz > 0.5) {
    const patch = noise(Math.floor((x + 64) / 4), Math.floor((y + 64) / 3), 17)
    if (patch > 0.55) return 'chrome'
    return noise(x, y, 18) > 0.975 ? 'glassCyan' : 'blockCyan'
  }
  return z > 2.2 ? 'bandCyan' : 'blockCyan'
}

/** A floe: a few slabs grown into one angular piece, three px out of the water. */
function floe(parts: readonly (readonly [number, number, number, number])[]): Thing {
  return b => {
    for (const [x0, y0, x1, y1] of parts) b.box(x0, y0, 0, x1, y1, 3, ice)
  }
}

/** The mirror block: a cube of ice framed in frost, its faces a silver pane with shine across it; the mirror's line on top. */
function mirror(diag: 1 | -1): Thing {
  return b => {
    b.box(-12, -12, 0, 12, 12, 22, (x, y, z, nx, _ny, nz) => {
      if (nz > 0.5) {
        if (Math.abs(x) > 10.4 || Math.abs(y) > 10.4) return 'blockCyan'
        const d = Math.abs(x - diag * y) * Math.SQRT1_2
        if (d < 0.9) return 'core'
        if (d < 1.8) return 'glassCyan'
        return noise(x, y, 23) > 0.96 ? 'glassCyan' : 'chrome'
      }
      const a = nx > 0.5 ? y : x
      if (Math.abs(a) > 10.2 || z < 1.8 || z > 20.2) return 'blockCyan'
      // Two shine streaks slanting across the pane.
      const t = a + z * 0.9
      if (Math.abs(t - 3) < 1.6) return 'glassCyan'
      if (Math.abs(t - 6.6) < 0.6 || Math.abs(t + 7) < 0.6) return 'core'
      return 'chrome'
    })
    // Frost heaped on the top corners.
    b.ball(-9.6, -9.6, 22, 2.6, 2.6, 1.2, 'chrome')
    b.ball(9.8, 9.4, 22, 2, 2, 1, 'chrome')
  }
}

/**
 * The frozen edge: a tile of shelf ice whose side toward the open water is broken into blocks, two shards
 * drifting off it. `side`: where the water lies.
 */
function frozenEdge(side: 'n' | 'e' | 's' | 'w'): Thing {
  // a: along the edge, c: across it toward the water.
  const map = (a: number, c: number): [number, number] =>
    side === 's' ? [a, c] : side === 'n' ? [a, -c] : side === 'e' ? [c, a] : [-c, a]
  return b => {
    const slab = (a0: number, c0: number, a1: number, c1: number, z1: number) => {
      const [x0, y0] = map(a0, c0)
      const [x1, y1] = map(a1, c1)
      b.box(Math.min(x0, x1), Math.min(y0, y1), 0, Math.max(x0, x1), Math.max(y0, y1), z1, ice)
    }
    slab(-16, -16, 16, 6, 3)
    let a = -16
    let i = 0
    while (a < 16) {
      const w = 3.5 + noise(i, 1, 41) * 4
      const reach = 6 + noise(i, 2, 41) * 8
      slab(a, 5, Math.min(16, a + w), reach, 3 - (noise(i, 3, 41) > 0.6 ? 0.6 : 0))
      a += w
      i++
    }
    slab(-9, 17.5, -3.5, 21.5, 2)
    slab(4, 18.5, 7, 20.5, 1.6)
  }
}

/** Every YULE FJORD thing by id; `_0`…`_3` are the frames of one thing. */
export const FJORD_THINGS: Record<string, Thing> = {
  fjord_boathouse: boathouse,
  fjord_cottage: cottage(false),
  fjord_cottage_night: cottage(true),
  fjord_church: church,
  fjord_lighthouse_0: lighthouse(0, true),
  fjord_lighthouse_1: lighthouse(1, true),
  fjord_lighthouse_2: lighthouse(2, true),
  fjord_lighthouse_3: lighthouse(3, true),
  fjord_lighthouse_lens_0: lighthouse(0, false),
  fjord_lighthouse_lens_1: lighthouse(1, false),
  fjord_lighthouse_lens_2: lighthouse(2, false),
  fjord_lighthouse_lens_3: lighthouse(3, false),
  fjord_lantern: lanternPost(true),
  fjord_lantern_out: lanternPost(false),
  fjord_floe_small: floe([[-7, -6, 6, 4], [-4, 2, 7, 8]]),
  fjord_floe_mid: floe([[-12, -9, 6, 5], [-3, -12, 12, 2], [-8, 3, 10, 11]]),
  fjord_floe_large: floe([[-24, -14, 4, 8], [-6, -22, 20, 2], [0, 0, 24, 18], [-18, 6, 6, 20]]),
  fjord_mirror_a: mirror(1),
  fjord_mirror_b: mirror(-1),
  fjord_edge_n: frozenEdge('n'),
  fjord_edge_e: frozenEdge('e'),
  fjord_edge_s: frozenEdge('s'),
  fjord_edge_w: frozenEdge('w'),
}
