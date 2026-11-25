/**
 * THE UNDERGLOW's things for the isometric view (`docs/art/codex-tasks.md` U1 and U2,
 * `docs/worlds/realm-underglow.md`): the spiral ledges' edges with the rock hanging below them, Rut's
 * rope lift (cage, rope, top wheel), the Delvers' Club glowsticks in the five rank colours, and the
 * layers' landmarks (a fossil arcade cabinet, the Upside Grove's tree, glass-sea shards, a broadcast
 * mast, the Sun Below's glow disc).
 *
 * Built from the props' solids (`props.ts`) in scene px, 32 to the tile: x east, y south, z up, 0 the
 * ground under the thing's middle (a ledge's top; what hangs under a ledge has z below 0). The light
 * here comes from below, so the lowest rock catches warm colour and every glow is small and bright.
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

/** A straight run of small blocks from one point to another: a brace, a rope, a strut at any slope. */
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

/** A crystal: shrinking blocks that lean by (dx, dy) a layer to a point; glass to the south, `side` east. */
function crystal(b: Solids, x: number, y: number, z: number, r: number, h: number, dx: number, dy: number, glass: MatName, side: MatName, glint: MatName = 'core') {
  const n = Math.max(2, Math.round(h / 2))
  for (let i = 0; i < n; i++) {
    const s = r * (1 - i / n) + 0.35
    const cx = x + dx * i
    const cy = y + dy * i
    const z0 = z + (i * h) / n
    b.box(cx - s, cy - s, z0, cx + s, cy + s, z + ((i + 1) * h) / n, (px, _y, pz, nx) => {
      if (nx > 0.5) return side
      return i === 1 && px < cx - s + 1.1 && pz < z0 + 1.2 ? glint : glass
    })
  }
}

/** A hanging spike of rock: blocks that shrink as they go down, the tip warm with the light from below. */
function stalactite(b: Solids, x: number, y: number, z: number, r: number, h: number, pick: Pick) {
  const n = Math.max(2, Math.round(h / 3))
  for (let i = 0; i < n; i++) {
    const s = r * (1 - i / (n + 0.6))
    const z1 = z - (i * h) / n
    const z0 = z - ((i + 1) * h) / n
    // Only the tip catches the light from below: warm on its lowest px, gold at the very point.
    b.box(x - s, y - s, z0, x + s, y + s, z1, i === n - 1 ? (_x, _y, pz) => (pz < z0 + 1.2 ? 'gold' : 'clay') : pick)
  }
}

// ---------------------------------------------------------------------------
// U1 · Ledge set
// ---------------------------------------------------------------------------

/** How deep a ledge's rock runs below its top before the spikes. */
const LEDGE_DEPTH = 40

/** The ledge's rock: courses of cut stone, cracks, the lowest course warm with the Sun Below's light. */
const ledgeRock: Pick = (x, y, z, nx, _ny, nz) => {
  if (nz > 0.5) {
    // The top: flagstones, every row a little offset.
    const row = Math.floor((y + 16) / 8)
    const col = Math.floor((x + 16 + (row & 1) * 4) / 8)
    const sx = ((x + 16 + (row & 1) * 4) % 8 + 8) % 8
    const sy = ((y + 16) % 8 + 8) % 8
    if (sx < 0.8 || sy < 0.8) return 'carve'
    return hash(col, row, 51) > 0.82 ? 'shrine' : 'stone'
  }
  const a = nx > 0.5 ? y : x
  const course = Math.floor(-z / 7)
  const fz = ((-z % 7) + 7) % 7
  const fa = ((a + 32 + (course & 1) * 5) % 10 + 10) % 10
  if (z < -LEDGE_DEPTH + 1.2 && z > -LEDGE_DEPTH - 0.1) return 'clay'
  if (fz < 0.9 || fa < 0.9) return 'crack'
  const k = hash(Math.floor((a + 32 + (course & 1) * 5) / 10), course, nx > 0.5 ? 52 : 53)
  return k > 0.75 ? 'shrine' : k < 0.12 ? 'rock' : 'boulder'
}

/**
 * A ledge's edge: the tile's rock running down under its top, a kerb of stones along the edge that faces
 * the shaft, spikes of rock hanging under that edge, a violet crystal in the face. `south`, `east`: which
 * edges face the void (a piece's other sides meet more ledge).
 */
function ledge(south: boolean, east: boolean, salt: number): Thing {
  return b => {
    b.box(-16, -16, -LEDGE_DEPTH, 16, 16, 0, ledgeRock)
    // The kerb.
    if (south) for (let x = -16; x < 16; x += 6) b.box(x + 0.5, 12.5, 0, x + 5.5, 15.5, 2 + hash(x, 1, salt) * 1.5, 'stone')
    if (east) for (let y = -16; y < (south ? 12 : 16); y += 6) b.box(12.5, y + 0.5, 0, 15.5, y + 5.5, 2 + hash(y, 2, salt) * 1.5, 'stone')
    // Moss along the kerb, and a lit crack.
    if (south) b.box(-9, 11.6, 0, -4, 12.5, 0.6, 'moss')
    if (east) b.box(11.6, -6, 0, 12.5, -1, 0.6, 'moss')
    // The spikes: under the open edges, and a row further in that shows between them.
    const spikes: Array<[number, number]> = []
    if (south) for (let x = -13; x <= 13; x += 6.5) spikes.push([x, 12])
    if (east) for (let y = -13; y <= (south ? 6 : 13); y += 6.5) spikes.push([12, y])
    for (let i = 0; i < 4; i++) spikes.push([-10 + hash(i, 3, salt) * 18, -10 + hash(i, 4, salt) * 14])
    for (const [i, [x, y]] of spikes.entries()) {
      const r = 2.6 + hash(i, 5, salt) * 2
      const h = 10 + hash(i, 6, salt) * 20
      stalactite(b, x, y, -LEDGE_DEPTH, r, h, ledgeRock)
    }
    // Violet crystals breaking out of the face.
    if (south) crystal(b, -6 + hash(7, 7, salt) * 12, 16.4, -18, 2, 7, 0, 0.45, 'chestViolet', 'shrine', 'glassPink')
    if (east) crystal(b, 16.4, -4 + hash(8, 8, salt) * 8, -24, 1.7, 6, 0.45, 0, 'chestViolet', 'shrine', 'glassPink')
  }
}

// ---------------------------------------------------------------------------
// U1 · Rut's rope lift
// ---------------------------------------------------------------------------

/** The lift's cage: a plank floor, iron posts and bars, a roof with a bail on top, a lamp inside. z 0 is its floor. */
function cage(b: Solids) {
  const R = 9
  const H = 26
  b.box(-R, -R, 0, R, R, 2, (_x, y, _z, _nx, _ny, nz) => (nz > 0.5 && ((y + 16) % 4 + 4) % 4 < 0.7 ? 'ink' : 'wood'))
  // A lamp on a chain from the roof (inside, seen between the bars).
  b.box(-0.4, -0.4, 18, 0.4, 0.4, H, 'pole')
  b.ball(0, 0, 16.5, 2, 2, 2.4, (_x, _y, z) => (z > 17.6 ? 'pole' : 'gold'))
  b.ball(0, 0, 16, 0.9, 0.9, 0.9, 'core')
  for (const x of [-R + 0.8, R - 0.8]) for (const y of [-R + 0.8, R - 0.8]) b.box(x - 0.8, y - 0.8, 2, x + 0.8, y + 0.8, H, 'chrome')
  for (let a = -R + 4; a <= R - 4; a += 3.5) {
    for (const s of [-R + 0.5, R - 0.5]) {
      b.box(a - 0.45, s - 0.45, 2, a + 0.45, s + 0.45, H, 'pole')
      b.box(s - 0.45, a - 0.45, 2, s + 0.45, a + 0.45, H, 'pole')
    }
  }
  // Rails round the middle and the top, and the gate's plate.
  for (const z of [11, H - 2]) {
    b.box(-R, R - 1, z, R, R, z + 1.4, 'chrome')
    b.box(R - 1, -R, z, R, R, z + 1.4, 'chrome')
    b.box(-R, -R, z, R, -R + 1, z + 1.4, 'chrome')
    b.box(-R, -R, z, -R + 1, R, z + 1.4, 'chrome')
  }
  b.box(-R - 0.6, -R - 0.6, H, R + 0.6, R + 0.6, H + 2, (x, y, _z, _nx, _ny, nz) => (nz > 0.5 && Math.abs(x) < R - 1.5 && Math.abs(y) < R - 1.5 ? 'pole' : 'chrome'))
  // The bail: two straps up to a ring the rope ties to.
  beam(b, -6, 0, H + 2, -0.8, 0, H + 8, 0.6, 0.6, 0.6, 'pole')
  beam(b, 6, 0, H + 2, 0.8, 0, H + 8, 0.6, 0.6, 0.6, 'pole')
  b.ball(0, 0, H + 9.6, 2, 0.8, 2, 'chrome')
}

/** One tile's height of the lift rope (z 0 to 32): a hemp lay that repeats every 4 px, so pieces stack. */
function rope(b: Solids) {
  b.box(-0.6, -0.6, 0, 0.6, 0.6, 32, (x, y, z) => ((((z + x - y) % 4) + 4) % 4 < 1.2 ? 'chestWood' : 'sand'))
}

/**
 * The lift's head: a jib reaching out over the shaft on two posts, the wheel at its tip turning by a
 * sixteenth a frame (four spokes, so four frames go round), the hoist rope down over the edge and the
 * hauling rope down to a winch drum. Stands on the ledge's edge with the jib out to the south.
 */
function liftHead(frame: number): Thing {
  return b => {
    // Footing and posts, braced to the back.
    b.box(-8, -14, 0, 8, -6, 2.5, 'stone')
    for (const x of [-5.5, 5.5]) {
      b.box(x - 1.3, -11.3, 2.5, x + 1.3, -8.7, 48, 'wood')
      beam(b, x, -14, 3, x, -10, 30, 0.6, 0.6, 0.6, 'lip')
    }
    b.box(-7, -12, 44, 7, -8, 46.5, 'wood')
    // Two jib beams from the posts out past the edge.
    for (const x of [-4.2, 4.2]) b.box(x - 0.9, -12, 46.5, x + 0.9, 24, 49, 'wood')
    for (const y of [-2, 8]) b.box(-5, y - 0.8, 46.5, 5, y + 0.8, 48, 'wood')
    // Struts under the jib.
    for (const x of [-4.2, 4.2]) beam(b, x, -9.5, 26, x, 14, 46, 0.6, 0.6, 0.6, 'lip')
    // A gold lamp hung at the jib's tip.
    b.box(4.4, 23, 42, 5.2, 23.8, 46.5, 'pole')
    b.ball(4.8, 23.4, 40.6, 1.6, 1.6, 2, (_x, _y, z) => (z > 41.6 ? 'pole' : 'gold'))
    b.ball(4.8, 23.4, 40, 0.7, 0.7, 0.7, 'core')
    // The wheel, in the plane of the jib (its axle runs east to west), at (0, 16, 54).
    const cy = 16
    const cz = 54
    const R = 7
    for (let i = 0; i < 30; i++) {
      const a = (i / 30) * Math.PI * 2
      b.ball(0, cy + Math.cos(a) * R, cz + Math.sin(a) * R, 0.9, 1.2, 1.2, 'chrome')
    }
    const turn = (frame * Math.PI) / 8
    for (let s = 0; s < 4; s++) {
      const a = turn + (s * Math.PI) / 2
      for (let k = 1; k <= 3; k++) b.ball(0, cy + Math.cos(a) * k * 1.9, cz + Math.sin(a) * k * 1.9, 0.7, 0.8, 0.8, 'rock')
    }
    // One gold-tipped spoke, so the turning shows.
    b.ball(0, cy + Math.cos(turn) * R, cz + Math.sin(turn) * R, 1.1, 1.4, 1.4, 'gold')
    // The axle in its bearings on the jib beams.
    b.box(-4.2, cy - 1, cz - 1, 4.2, cy + 1, cz + 1, 'pole')
    for (const x of [-4.2, 4.2]) beam(b, x, cy, 49, x, cy, cz, 0.9, 0.9, 0.6, 'wood')
    b.ball(4.6, cy, cz, 0.8, 1.5, 1.5, 'gold')
    // The hoist rope off the wheel's far side, down over the ledge's edge into the shaft.
    b.box(-0.6, cy + R - 0.6, -40, 0.6, cy + R + 0.6, cz, (_x, y, z) => ((((z - y) % 4) + 4) % 4 < 1.2 ? 'chestWood' : 'sand'))
    // The hauling rope off its near side, down to the winch drum between the posts.
    b.box(-0.6, cy - R - 0.6, 6, 0.6, cy - R + 0.6, cz, (_x, y, z) => ((((z - y) % 4) + 4) % 4 < 1.2 ? 'chestWood' : 'sand'))
    b.box(-6.5, 6, 2, -5, 12, 6, 'wood')
    b.box(5, 6, 2, 6.5, 12, 6, 'wood')
    b.ball(0, cy - R, 5.4, 5, 2.6, 2.6, (x, _y, _z, nx) => (Math.abs(nx) > 0.8 ? 'wood' : ((x + 8) % 2 + 2) % 2 < 0.8 ? 'chestWood' : 'sand'))
    // The crank on the drum's east end.
    b.box(5.2, cy - R - 0.4, 5, 6, cy - R + 0.4, 9.5, 'pole')
    b.box(5.2, cy - R - 0.4, 9, 8.4, cy - R + 0.4, 9.8, 'chrome')
  }
}

// ---------------------------------------------------------------------------
// U1 · Glowstick markers, by rank
// ---------------------------------------------------------------------------

/** The five ranks: the stick's glow, its hot middle line. */
const RANKS: Record<'rose' | 'pink' | 'cyan' | 'violet' | 'gold', [MatName, MatName]> = {
  rose: ['glassRose', 'core'],
  pink: ['neon', 'glassPink'],
  cyan: ['glassCyan', 'core'],
  violet: ['glassViolet', 'core'],
  gold: ['gold', 'core'],
}

/** A glowstick marker: a stake in a cairn of three stones, the stick bound to its top, a dark cap. */
function glowstick(rank: keyof typeof RANKS): Thing {
  const [glow, hot] = RANKS[rank]
  return b => {
    b.ball(0, 0, 1.2, 3.2, 3, 1.8, 'boulder')
    b.ball(-1.8, 1.8, 0.9, 1.8, 1.6, 1.3, 'rock')
    b.ball(2, 1.2, 0.8, 1.5, 1.4, 1.1, 'stone')
    b.box(-0.6, -0.6, 2, 0.6, 0.6, 11, 'pole')
    b.post(0, 0, 10, 11.2, 2, 'pole')
    b.post(0, 0, 11.2, 22, 1.6, (_x, _y, z, nx, ny) => (Math.abs(nx - ny) < 0.32 && z > 18 && z < 20.6 ? hot : glow))
    b.post(0, 0, 22, 23.2, 1.9, 'pole')
    b.box(-0.3, -0.3, 23.2, 0.3, 0.3, 24.6, 'pole')
  }
}

// ---------------------------------------------------------------------------
// U2 · Layer landmarks
// ---------------------------------------------------------------------------

/**
 * A fossil arcade cabinet (layer 5): an upright cabinet facing south, its screen still faintly playing,
 * a gold marquee, half grown into a rock with a fossil spine curling over it.
 */
function cabinet(b: Solids) {
  const crust: Pick = (x, y, z) => (hash(x * 0.7, z * 0.7 + y * 0.3, 61) > 0.82 ? 'crack' : 'boulder')
  // The rock it grew into, behind and to the west.
  b.ball(-4, -12, 16, 13, 7, 18, crust)
  b.ball(-13, -4, 9, 6, 9, 10, crust)
  b.ball(9, -11, 8, 7, 5, 9, crust)
  // The fossil: a spine of rose bone arching over the cabinet, ribs hanging off it.
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI * (0.08 + (i / 16) * 0.8)
    const x = -Math.cos(a) * 14
    const z = 14 + Math.sin(a) * 26
    b.ball(x, -6.5, z, 1.6, 1.6, 1.4, 'sand')
    if (i % 3 === 1 && i < 15) beam(b, x, -6.5, z - 1.5, x * 0.85, -4.5, z - 7, 0.5, 0.5, 0.5, 'sand')
  }
  b.ball(13.5, -6.5, 18, 3.2, 2.4, 2.6, 'sand')
  b.ball(14.6, -5, 17.4, 0.7, 0.7, 0.7, 'dark')
  // The cabinet: plinth, lower body with a coin door, control deck, screen hood, marquee.
  const body: Pick = (x, y, z, nx, ny, nz) => {
    if (nz > 0.5) return 'shrine'
    if (nx > 0.5) {
      // The side art: a rose stripe sweeping up the side, the edge trim in chrome.
      if (y > 3.2 || y < -5.2) return 'chrome'
      return Math.abs(z - 14 - (y + 6) * 1.3) < 1.4 ? 'velvet' : 'shrine'
    }
    if (ny > 0.5 && z > 5 && z < 13 && Math.abs(x + 1) < 4) {
      // Coin door, two coin slots lit rose.
      if (z > 9.6 && z < 11 && (Math.abs(x + 2.6) < 0.8 || Math.abs(x - 0.6) < 0.8)) return 'bandPink'
      return Math.abs(x + 1) > 3.2 || z < 5.8 || z > 12.2 ? 'pole' : 'front'
    }
    return 'shrine'
  }
  b.box(-8, -6, 0, 8, 4, 2.5, 'dark')
  b.box(-8, -6, 2.5, 8, 4, 15, body)
  b.box(-8.4, -6, 15, 8.4, 8, 18, (x, y, _z, nx, ny, nz) => {
    if (nz > 0.5) {
      if (Math.hypot(x + 4, y - 4.5) < 1.3) return 'pole'
      if (Math.hypot(x - 1, y - 5.2) < 1) return 'neon'
      if (Math.hypot(x - 3.8, y - 4.6) < 1) return 'glassCyan'
      if (Math.hypot(x - 6.2, y - 5.2) < 1) return 'gold'
      return 'front'
    }
    return nx > 0.5 || ny > 0.5 ? 'chrome' : 'shrine'
  })
  b.post(-4, 4.5, 18, 20.6, 0.5, 'pole')
  b.ball(-4, 4.5, 21.2, 1.2, 1.2, 1.1, 'velvet')
  // The screen hood, its glass on the south: an invader in cyan, a score in pink, a dark bezel.
  b.box(-8, -6, 18, 8, 2, 31, (x, _y, z, nx, ny, nz) => {
    if (nz > 0.5) return 'shrine'
    if (nx > 0.5) return Math.abs(z - 24 - (x - 8)) < 1.2 ? 'velvet' : 'shrine'
    if (ny < 0.5) return 'shrine'
    if (Math.abs(x) > 6 || z < 19.5 || z > 29.5) return 'dark'
    const u = Math.floor(x + 6)
    const v = Math.floor(29.5 - z)
    const INVADER = ['..........', '..........', '...#..#...', '..######..', '.##.##.##.', '.########.', '.#.#..#.#.', '...#..#...', '..........', '..........']
    if (v === 0 && u >= 1 && u <= 4) return 'neon'
    if (INVADER[v]?.[u - 1] === '#') return 'glassCyan'
    return v === 9 && u % 3 === 0 ? 'bandCyan' : 'blockCyan'
  })
  // The marquee overhangs, gold, its name in rose blocks.
  b.box(-8.4, -6, 31, 8.4, 4.4, 36.5, (x, _y, z, nx, ny, nz) => {
    if (nz > 0.5 || nx > 0.5 || ny < 0.5) return 'shrine'
    if (Math.abs(x) > 7.4 || z < 31.8 || z > 35.7) return 'pole'
    return z > 32.8 && z < 34.8 && Math.abs(x) < 6 && ((Math.floor(x + 6) % 3) + 3) % 3 !== 2 ? 'velvet' : 'gold'
  })
  // Crust over its top-west corner, and violet crystals at its foot.
  b.ball(-8, -3, 33, 4.6, 5, 4.4, crust)
  b.ball(-9.5, 2, 4, 3.6, 4, 4.2, crust)
  crystal(b, 10.5, 5, 0, 2.4, 9, 0.3, 0.2, 'chestViolet', 'shrine', 'glassPink')
  crystal(b, 13, 1.5, 0, 1.6, 6, 0.35, 0, 'chestViolet', 'shrine', 'glassPink')
}

/**
 * The Upside Grove's tree (layer 2), the updraft's way up: its crown sits on the ledge like a bank of
 * teal moss with pink and cyan blossoms, its trunk stands up out of it, and its roots spread up and out
 * into the air, glowshrooms on their tips and a bit of bark floating up off one.
 */
function upsideTree(b: Solids) {
  const leaf: Pick = (x, y, z) => {
    const k = hash(x * 0.9 + 3, y * 0.9 + z * 0.7, 71)
    return k > 0.94 ? 'glassPink' : k > 0.9 ? 'glassCyan' : k > 0.55 ? 'moss' : 'blockCyan'
  }
  b.ball(0, 0, 6, 13, 11, 6.5, leaf)
  b.ball(-8, 5, 4.5, 7, 6, 4.5, leaf)
  b.ball(8, 4, 5, 7, 6, 5, leaf)
  b.ball(2, -7, 7, 8, 6, 5.5, leaf)
  // Hanging fronds: the crown's leaves droop up, toward the trunk.
  for (const [x, y] of [[-6, 9], [4, 10], [11, 6], [-12, 2]] as const) b.ball(x, y, 2.6, 2.2, 2, 2.6, leaf)
  const bark: Pick = (x, y, z, _nx, _ny, nz) => (nz > 0.5 ? 'lip' : ((Math.atan2(y, x) * 4 + z * 0.15) % 1 + 1) % 1 < 0.22 ? 'ink' : 'wood')
  b.post(0, 0, 9, 34, 3.2, bark)
  b.post(0, 0, 30, 36, 4, bark)
  // The roots: five, curling up and out, thinning toward their tips.
  const roots: Array<[number, number, number]> = [[1, 0.25, 22], [-0.8, 0.6, 18], [0.2, -1, 20], [-0.9, -0.5, 16], [0.6, 0.9, 14]]
  for (const [i, [dx, dy, len]] of roots.entries()) {
    const n = 18
    let tip: [number, number, number] = [0, 0, 36]
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const out = len * Math.pow(t, 0.75)
      const x = dx * out + Math.sin(t * 5 + i) * 1.2
      const y = dy * out
      const z = 35 + t * (10 + len * 0.6) - t * t * 6
      const r = 2.6 * (1 - t) + 0.6
      b.ball(x, y, z, r, r, r, 'wood')
      tip = [x, y, z]
    }
    // A glowshroom cap on the tip.
    b.ball(tip[0], tip[1], tip[2] + 1.2, 1.8, 1.8, 0.9, i % 2 ? 'glassPink' : 'glassCyan')
  }
  // Bits that fell, rising: a chip of bark and a leaf floating over the roots.
  b.box(5, 3, 58, 6.4, 4.2, 59, 'wood')
  b.ball(-6, -2, 62, 1, 0.8, 0.6, 'moss')
}

/** A glass shard: a slab that tapers and leans as it rises, cyan glass, the aurora's violet in a band on its face. */
function shard(b: Solids, x: number, y: number, w: number, d: number, h: number, lean: number, salt: number) {
  const n = Math.max(3, Math.round(h / 2))
  for (let i = 0; i < n; i++) {
    const t = i / n
    const sw = w * (1 - t * 0.85) + 0.4
    const sd = d * (1 - t * 0.5) + 0.3
    const cx = x + lean * i * 2
    const z0 = (i * h) / n
    b.box(cx - sw, y - sd, z0, cx + sw, y + sd, ((i + 1) * h) / n, (px, _py, pz, nx, _ny, nz) => {
      if (i === n - 1) return 'glassCyan'
      if (nz > 0.5) return 'blockCyan'
      if (nx > 0.5) return 'blockCyan'
      if (px < cx - sw + 1) return 'glassCyan'
      const band = Math.abs(pz - h * 0.45 - (px - x) * 0.7 - salt)
      if (band < 1.1) return 'chestViolet'
      if (band < 1.9) return 'bandPink'
      return 'blockCyan'
    })
  }
}

/** A cluster of glass-sea shards in a scatter of pale grit. `big`: three tall ones; else two small. */
function shards(big: boolean): Thing {
  return b => {
    for (const [x, y, r] of [[-7, 6, 2.4], [6, 7, 2], [9, -3, 1.6], [-3, 9, 1.4]] as const) b.ball(x, y, r * 0.5, r, r, r * 0.6, 'rock')
    if (big) {
      shard(b, -4, -3, 6, 2.2, 34, 0.18, 0)
      shard(b, 5, 1, 4.4, 2, 22, -0.22, 3)
      shard(b, -1, 6, 3.4, 1.6, 12, 0.3, 1)
      crystal(b, 9, 6, 0, 1.6, 6, 0.3, 0.1, 'glassCyan', 'bandCyan')
    } else {
      shard(b, -2, -1, 4.4, 1.8, 18, 0.2, 2)
      shard(b, 4, 4, 3, 1.4, 10, -0.25, 0)
    }
  }
}

/**
 * A broadcast mast (layer 4): a two-stage lattice tower on a plinth with its tuning box, a crystal on top.
 * 0: dead (the crystal dull); 1: static (pink, sparks crackling off it); 2: tuned (cyan, a ring round it).
 */
function mast(state: 0 | 1 | 2): Thing {
  return b => {
    b.box(-8, -8, 0, 8, 8, 3, (x, y, _z, _nx, _ny, nz) => (nz > 0.5 && (Math.abs(x) > 6.8 || Math.abs(y) > 6.8) ? 'rock' : 'stone'))
    // The tuning box with its dial: dark, pink, cyan by state.
    b.box(4, 4.5, 3, 9.5, 8.5, 11, 'pole')
    b.box(5.4, 8.5, 6.4, 8.2, 8.9, 9.2, state === 0 ? 'carve' : state === 1 ? 'neon' : 'glassCyan')
    b.box(7.6, 6, 11, 8.4, 6.8, 14, 'pole')
    const leg = (r: number, z0: number, z1: number) => {
      for (const x of [-r, r]) for (const y of [-r, r]) b.box(x - 0.7, y - 0.7, z0, x + 0.7, y + 0.7, z1, 'chrome')
    }
    leg(5, 3, 42)
    leg(3, 42, 72)
    const girt = (r: number, z: number) => {
      b.box(-r, r - 0.4, z, r, r + 0.4, z + 0.8, 'chrome')
      b.box(r - 0.4, -r, z, r + 0.4, r, z + 0.8, 'chrome')
      b.box(-r, -r - 0.4, z, r, -r + 0.4, z + 0.8, 'pole')
      b.box(-r - 0.4, -r, z, -r + 0.4, r, z + 0.8, 'pole')
    }
    for (let z = 11; z < 42; z += 10) girt(5, z)
    for (let z = 42; z < 72; z += 10) girt(3, z)
    // Zigzag bracing on the two faces that show.
    for (const [r, z0, z1] of [[5, 3, 41], [3, 42, 72]] as const) {
      const steps = Math.round((z1 - z0) / 10)
      for (let s = 0; s < steps; s++) {
        const za = z0 + ((z1 - z0) * s) / steps
        const zb = z0 + ((z1 - z0) * (s + 1)) / steps
        const flip = s % 2 ? 1 : -1
        beam(b, -r * flip, r, za, r * flip, r, zb, 0.4, 0.4, 0.4, 'pole')
        beam(b, r, -r * flip, za, r, r * flip, zb, 0.4, 0.4, 0.4, 'pole')
      }
    }
    // Arms for the dishes, and the top pole.
    b.box(-9, -0.5, 60, 9, 0.5, 61, 'chrome')
    for (const x of [-9, 9]) b.ball(x, 0, 60.5, 0.6, 2.2, 2.2, 'rock')
    b.post(0, 0, 72, 78, 1, 'chrome')
    // The aviation lamp at the top of the first stage.
    b.ball(5, 5, 43.4, 1, 1, 1, state === 0 ? 'carve' : state === 1 ? 'glassPink' : 'neon')
    // The crystal.
    const [glass, side, glint]: [MatName, MatName, MatName] =
      state === 0 ? ['rock', 'boulder', 'chrome'] : state === 1 ? ['neon', 'blockPink', 'glassPink'] : ['glassCyan', 'bandCyan', 'core']
    crystal(b, 0, 0, 77, 2.6, 13, 0, 0, glass, side, glint)
    crystal(b, 2.4, 1, 77, 1.4, 7, 0.4, 0.15, glass, side, glint)
    crystal(b, -2, 1.6, 77, 1.2, 6, -0.35, 0.2, glass, side, glint)
    if (state === 1) {
      // Static: a crackle of sparks jumping off the crystal and down the mast.
      for (let i = 0; i < 9; i++) {
        const a = hash(i, 1, 81) * Math.PI * 2
        const r = 4 + hash(i, 2, 81) * 5
        const z = 70 + hash(i, 3, 81) * 24
        b.box(Math.cos(a) * r - 0.5, Math.sin(a) * r - 0.5, z - 0.5, Math.cos(a) * r + 0.5, Math.sin(a) * r + 0.5, z + 0.5, i % 3 ? 'glassPink' : 'core')
      }
      beam(b, 3, 3, 88, 6, 4, 83, 0.4, 0.4, 0.4, 'glassPink')
      beam(b, 6, 4, 83, 5, 7, 79, 0.4, 0.4, 0.4, 'glassPink')
    }
    if (state === 2) {
      // Tuned: a ring of light round the crystal's foot, and a steady glow at the dishes.
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2
        b.ball(Math.cos(a) * 6.5, Math.sin(a) * 6.5, 80, 0.7, 0.7, 0.5, 'glassCyan')
      }
      for (const x of [-9, 9]) b.ball(x + 0.6, 0, 60.5, 0.4, 0.8, 0.8, 'core')
    }
  }
}

/**
 * The Sun Below's glow disc (layer 6): a low stepped dome of light lying in the Core's floor, white at
 * its heart, gold round it, a rose rim. Its rays turn between the two frames.
 */
function sun(frame: number): Thing {
  return b => {
    const R = 40
    const rings = 9
    const phase = (frame * Math.PI) / 12
    for (let i = 0; i < rings; i++) {
      const r = R * Math.sqrt(1 - Math.pow(i / rings, 2)) * (1 - i * 0.04)
      b.post(0, 0, i * 1.4, (i + 1) * 1.4, r, (x, y, _z, _nx, _ny, nz) => {
        const d = Math.hypot(x, y)
        if (nz < 0.5) return i === 0 ? 'bandPink' : 'gold'
        if (i === 0 && d > r - 2.2) return 'bandPink'
        if (d < R * 0.3) return 'core'
        // Twelve rays, each a thin wedge of white over the gold, turning half a ray between the frames.
        const turn = (((Math.atan2(y, x) + phase) / (Math.PI * 2)) * 12 % 1 + 1) % 1
        if (d < R * 0.5) return turn < 0.4 ? 'core' : 'gold'
        return turn < 0.14 ? 'core' : 'gold'
      })
    }
  }
}

export const UNDERGLOW_THINGS: Record<string, Thing> = {
  underglow_ledge_s: ledge(true, false, 1),
  underglow_ledge_e: ledge(false, true, 2),
  underglow_ledge_se: ledge(true, true, 3),
  underglow_lift_cage: cage,
  underglow_lift_rope: rope,
  underglow_lift_wheel_0: liftHead(0),
  underglow_lift_wheel_1: liftHead(1),
  underglow_lift_wheel_2: liftHead(2),
  underglow_lift_wheel_3: liftHead(3),
  underglow_glowstick_rose: glowstick('rose'),
  underglow_glowstick_pink: glowstick('pink'),
  underglow_glowstick_cyan: glowstick('cyan'),
  underglow_glowstick_violet: glowstick('violet'),
  underglow_glowstick_gold: glowstick('gold'),
  underglow_cabinet: cabinet,
  underglow_roots: upsideTree,
  underglow_shards_0: shards(true),
  underglow_shards_1: shards(false),
  underglow_mast_0: mast(0),
  underglow_mast_1: mast(1),
  underglow_mast_2: mast(2),
  underglow_sun_0: sun(0),
  underglow_sun_1: sun(1),
}
