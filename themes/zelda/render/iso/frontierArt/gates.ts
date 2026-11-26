/**
 * THE WAYS IN (Neon Shrine art tasks W1 and W2): the gates where the walking roads from the hand-made world enter
 * the realms. Built as solids at the scene's own density (32 px to the tile, x east, y south, z up from the ground)
 * and drawn by `rasterThing`; `node scripts/zelda-lab/frontier-art.mjs gates` bakes each realm's arches into that realm's art
 * pack (`scripts/zelda-lab/art-pack.mjs`, `../artPack.ts`).
 *
 * W1, an arch per realm, three tiles wide and about two and a half tall, the road running under it through a
 * clear opening a little over two tiles wide and at least 40 px high: LUMENBY's timber headframe with a cyan
 * lumen lamp, SETER FELL's two turf-roofed gateposts with a birch pole across, the SPORELIGHT's two mushroom
 * stems bending into one cap, STILLSAND's quartz pillars under a sun disc, FOGSTAGE's proscenium of painted flats
 * with a marquee, RERUN ESTATES' welcome sign on two brick posts. Each is drawn for a road running north-south
 * (`_ns`: the arch spans east-west and shows its face to the south) and for one running east-west (`_ew`: it
 * spans north-south and shows its face to the east), its neon off (`_off`) and on (`_on`), every frame the same
 * size and anchor. The anchor is the ground under the middle of the opening.
 *
 * W2, the coast side: a waymark naming the realm in the pixel font's letters (`themes/base/pixel/font.ts`), one
 * px a font px, steady cyan, over a neon arrow that blinks: `_0` lit, `_1` dim. It points the way the road runs
 * from the coast (`docs/art/codex-tasks.md`, "The ways in"): north to SETER FELL, the SPORELIGHT and LUMENBY, east
 * to STILLSAND and RERUN ESTATES, west to FOGSTAGE; `waymark()` draws the other headings too. And the wardens'
 * barrier arm with a BORDER plate on it, down across the road and up, for either road axis.
 *
 * The parts are laid out in the arch's own frame: `a` along the span from west to east as the face is read
 * (left to right on the screen), `c` across it toward the viewer, `z` up. The faces that show are the front
 * (`nc` > 0.5) and one end (|`na`| > 0.5).
 */
import { glyphRows } from '../../../../base/pixel/font'
import type { MatName, Pick, Solids } from '../props'
import { noise } from './seter'

type Thing = (b: Solids) => void
/** The way the road runs under a gate. */
export type Road = 'ns' | 'ew'
type Local = (a: number, c: number, z: number, na: number, nc: number, nz: number) => MatName
type LPick = MatName | Local
interface Frame {
  box(a0: number, c0: number, z0: number, a1: number, c1: number, z1: number, pick: LPick): void
  post(a: number, c: number, z0: number, z1: number, r: number, pick: LPick): void
  ball(a: number, c: number, z: number, ra: number, rc: number, rz: number, pick: LPick): void
}

/**
 * The solids in a gate's own frame. 'ns' is the world's (a east, c south); 'ew' turns it a quarter (a north,
 * c east), a rotation, not a mirror, so letters read left to right on the east face as on the south.
 */
function across(b: Solids, road: Road): Frame {
  if (road === 'ns') return b
  const turn = (pick: LPick): Pick => (typeof pick === 'string' ? pick : (x, y, z, nx, ny, nz) => pick(-y, x, z, -ny, nx, nz))
  return {
    box: (a0, c0, z0, a1, c1, z1, pick) => b.box(c0, -a1, z0, c1, -a0, z1, turn(pick)),
    post: (a, c, z0, z1, r, pick) => b.post(c, -a, z0, z1, r, turn(pick)),
    ball: (a, c, z, ra, rc, rz, pick) => b.ball(c, -a, z, rc, ra, rz, turn(pick)),
  }
}

/** A run of small boxes from one point to another: a brace, a ray, a spoke. */
function strut(f: Frame, a0: number, c0: number, z0: number, a1: number, c1: number, z1: number, r: number, pick: LPick): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(a1 - a0), Math.abs(c1 - c0), Math.abs(z1 - z0)) * 1.5))
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = a0 + (a1 - a0) * t
    const c = c0 + (c1 - c0) * t
    const z = z0 + (z1 - z0) * t
    f.box(a - r, c - r, z - r, a + r, c + r, z + r, pick)
  }
}

/**
 * Lines of the pixel font on a face, centred on a = 0: one px a font px, the first line's foot at `foot`, lines
 * 9 px apart going down. Faces drawn at whole-px `c` show every font px as exactly one screen px.
 */
function lettering(lines: string[], foot: number) {
  const rows = lines.map(line => {
    const glyphs = [...line].map(ch => glyphRows(ch))
    const w = glyphs.reduce((sum, g) => sum + g[0]!.length + 1, -1)
    return { glyphs, w, left: -Math.round(w / 2) }
  })
  const width = Math.max(...rows.map(r => r.w))
  return {
    width,
    at(a: number, z: number): boolean {
      const line = Math.floor((foot + 7 - z) / 9)
      const r = rows[line]
      if (!r) return false
      const row = 6 - Math.floor(z - (foot - line * 9))
      let col = Math.floor(a - r.left)
      if (row < 0 || row > 6 || col < 0 || col >= r.w) return false
      for (const g of r.glyphs) {
        const gw = g[0]!.length
        if (col < gw) return g[row]![col] === '#'
        col -= gw + 1
        if (col < 0) return false
      }
      return false
    },
  }
}

const front = (nc: number) => nc > 0.5

// ---------------------------------------------------------------------------
// W1 · The arches
// ---------------------------------------------------------------------------

/** Sawn timber: the tops pale; a beam has a butt joint every 18 px, a leg an iron strap every 16 px up. */
const timber = (along: 'a' | 'z'): Local => (a, _c, z, _na, _nc, nz) => {
  if (nz > 0.5) return 'lip'
  if (along === 'a') return Math.floor(a + 64) % 18 === 0 ? 'ink' : 'wood'
  return Math.floor(z) % 16 < 2 && z > 8 ? 'pole' : 'wood'
}

/** LUMENBY: a pit headframe of sawn timber over the road, the winding wheel on top, a cyan lumen lamp hanging under the beam. */
function lumenby(f: Frame, lit: boolean): void {
  for (const s of [-1, 1]) {
    const a = s * 40
    f.box(a - 6, -7, 0, a + 6, 7, 3, 'stone')
    f.box(a - 3, -3, 3, a + 3, 3, 64, timber('z'))
    // The legs splay out to the foot of the frame, a front and a back brace each side.
    for (const c of [-4.5, 4.5]) strut(f, a + s * 8, c, 3, a + s * 1.5, c * 0.5, 44, 1.3, 'wood')
    f.box(a - 4, -5.5, 22, a + 4, 5.5, 24.5, timber('a'))
  }
  f.box(-47, -3.5, 58, 47, 3.5, 64, timber('a'))
  // The winding wheel: a rim of iron round a hub on six spokes, standing in two cheeks on the beam.
  const wz = 75
  for (const s of [-1, 1]) f.box(-1, s * 3 - 0.8, 64, 1, s * 3 + 0.8, wz + 1, 'wood')
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2
    f.ball(Math.cos(t) * 9, 0, wz + Math.sin(t) * 9, 1.2, 1.4, 1.2, 'chrome')
  }
  for (let k = 0; k < 6; k++) {
    const t = (k / 6) * Math.PI * 2 + 0.26
    strut(f, 0, 0, wz, Math.cos(t) * 8.4, 0, wz + Math.sin(t) * 8.4, 0.45, 'rock')
  }
  f.ball(0, 0, wz, 1.9, 3.6, 1.9, 'pole')
  // The cable over the wheel and down to the west leg.
  strut(f, -9, 1.6, wz, -38, 1.6, 64, 0.35, 'pole')
  // The lamp: a chain, a lid, four panes of lumen light (dark cyan glass when it is out), a foot.
  f.post(0, 0, 51.4, 58, 0.45, 'pole')
  f.box(-3.6, -3.6, 50, 3.6, 3.6, 51.4, 'pole')
  f.box(-3, -3, 44, 3, 3, 50, (a, c, z, na, _nc, nz) => {
    if (nz > 0.5) return 'pole'
    const along = Math.abs(na) > 0.5 ? c : a
    if (Math.abs(along) > 2.2) return 'pole'
    if (!lit) return 'blockCyan'
    return Math.abs(along) < 0.9 && z > 46 && z < 48.5 ? 'core' : 'glassCyan'
  })
  f.box(-2.2, -2.2, 42.8, 2.2, 2.2, 44, 'pole')
}

/** Upright logs: a seam every 3 px across, a darker course every 12 px up. */
const gatepost: Local = (a, c, z, na, _nc, nz) => {
  if (nz > 0.5) return 'chestWood'
  const along = Math.abs(na) > 0.5 ? c : a
  if (Math.floor(z) % 12 === 0) return 'ink'
  return Math.floor(along + 64) % 3 === 0 ? 'ink' : 'chestWood'
}

/** SETER FELL: two log gateposts on stone, each under its own turf roof, a birch pole slung between them, two lanterns on it. */
function seterfell(f: Frame, lit: boolean): void {
  for (const s of [-1, 1]) {
    const a = s * 40
    f.box(a - 6.5, -6.5, 0, a + 6.5, 6.5, 6, (pa, _c, pz, na, _nc, nz) => {
      if (nz > 0.5) return noise(pa * 2, 3, 61) > 0.6 ? 'moss' : 'stone'
      return Math.floor(pz) % 3 === 0 || Math.floor(pa + 64 + (Math.floor(pz / 3) % 2) * 2) % 5 === 0 ? 'carve' : 'stone'
    })
    f.box(a - 4.5, -4.5, 6, a + 4.5, 4.5, 64, gatepost)
    // The turf roof: a little gable, its ridge running across, the sod lying thick and green.
    for (let i = 0; i < 8; i++) {
      const half = 8.5 - i * 1.05
      f.box(a - half, -8, 63 + i, a + half, 8, 64 + i, (pa, pc, pz, _na, nc, nz) => {
        if (i < 1) return nz > 0.5 ? 'moss' : 'chestWood'
        if (nc > 0.5 || nc < -0.5) return i < 2 ? 'chestWood' : noise(pa, pz, 62) > 0.75 ? 'chestWood' : 'moss'
        const k = noise(pa * 3, pc * 3 + pz, 63)
        return k > 0.94 ? 'velvet' : k < 0.06 ? 'sand' : 'moss'
      })
    }
    for (let i = 0; i < 4; i++) {
      const ta = a - 5 + i * 3.4
      f.post(ta, (noise(i, s, 64) - 0.5) * 6, 70, 72 + noise(i, s, 65) * 2.6, 0.55, i % 3 ? 'moss' : 'sand')
    }
  }
  // The birch pole: pale bark with dark marks, resting in notches in the posts' inner sides.
  for (let a = -36; a <= 36; a += 0.8) {
    f.ball(a, 0, 55 + Math.cos((a / 36) * Math.PI / 2) * -1.2, 2.1, 2.1, 2.1, (pa, _c, pz) =>
      (noise(pa * 1.4, pz * 1.6, 66) > 0.8 ? 'ink' : 'chrome'))
  }
  // A lantern hanging from the pole either side of the road.
  for (const s of [-1, 1]) {
    const a = s * 20
    f.post(a, 0, 47.4, 53.6, 0.4, 'ink')
    f.box(a - 2.8, -2.8, 46.4, a + 2.8, 2.8, 47.6, 'pole')
    f.box(a - 2.2, -2.2, 40.6, a + 2.2, 2.2, 46.4, (pa, pc, pz, na, _nc, nz) => {
      if (nz > 0.5) return 'pole'
      const along = Math.abs(na) > 0.5 ? pc : pa - a
      if (Math.abs(along) > 1.5) return 'pole'
      if (!lit) return 'dark'
      return pz > 42.4 && pz < 44.8 ? 'core' : 'gold'
    })
    f.box(a - 1.4, -1.4, 39.8, a + 1.4, 1.4, 40.6, 'pole')
  }
}

/** SPORELIGHT: two pale stems rising from mossy bulbs, bending in to share one wide cap; its gills and spots glow when lit. */
function sporelight(f: Frame, lit: boolean): void {
  for (const s of [-1, 1]) {
    f.ball(s * 40, 0, 2.4, 8, 7.4, 3.6, (pa, pc, pz) => (lit && noise(pa * 2, pc * 2 + pz, 71) > 0.9 ? 'bandCyan' : 'moss'))
    for (let t = 0; t <= 1.0001; t += 1 / 64) {
      const a = s * (40 - 25 * t * t)
      const r = 5 - 1.3 * t
      f.ball(a, 0, 4 + 58 * t, r, r, r, (pa, _c, pz) => {
        // A skirt of ring partway up; fibres running up the stem.
        if (Math.abs(t - 0.42) < 0.03) return lit ? 'bandPink' : 'velvet'
        return noise(pa * 2, Math.floor(pz / 3), 72) > 0.82 ? 'rock' : 'chrome'
      })
    }
  }
  const cap: Local = (a, c, z, _na, _nc, nz) => {
    if (nz < 0.15 && z < 68) {
      // Gills: fine ribs under the cap, alternately bright.
      if (!lit) return Math.floor(a + 64) % 2 ? 'blockCyan' : 'shrine'
      return Math.floor(a + 64) % 2 ? 'glassCyan' : 'bandCyan'
    }
    // Round spots in a loose grid over the top, a pale band round the rim.
    const ga = (((a + 64) % 9) + 9) % 9 - 4.5
    const gc = (((c + 64 + Math.floor((a + 64) / 9) * 3) % 7) + 7) % 7 - 3.5
    if (nz > 0.3 && ga * ga / 5 + gc * gc / 2.2 < 1 && noise(Math.floor((a + 64) / 9), Math.floor((c + 64) / 7), 73) < 0.5) {
      return lit ? 'glassPink' : 'blockPink'
    }
    return nz < 0.45 ? 'chestViolet' : 'shrine'
  }
  f.ball(0, 0, 66, 37, 15, 8, cap)
  f.ball(-1, -1, 71, 27, 11, 7, cap)
  // Spore drops hanging on threads from the cap's rim.
  for (const [a, c, z, pink] of [[-27, 3, 52, false], [-9, 6, 55, true], [12, 6, 54, false], [26, 2, 51.5, true]] as const) {
    f.post(a, c, z + 1.5, 61, 0.3, 'moss')
    f.ball(a, c, z, 1.5, 1.5, 1.8, lit ? (pink ? 'glassPink' : 'glassCyan') : (pink ? 'blockPink' : 'blockCyan'))
  }
}

/** Sandstone in layers, as STILLSAND's islands are. */
const sandstone: Local = (a, c, z, _na, _nc, nz) => {
  if (nz > 0.6) return Math.sin(a / 4 + c / 9) > 0.65 ? 'sand' : 'rock'
  const band = Math.floor(z + Math.sin((a + c) / 7) * 2)
  return band % 8 === 0 ? 'carve' : band % 8 < 3 ? 'shrine' : 'stone'
}

/** Quartz: pale faces, a bright edge, a violet vein winding up the middle that glows when lit. */
function quartz(centre: number, lit: boolean): Local {
  return (a, c, z, na, _nc, nz) => {
    if (nz > 0.5) return 'chrome'
    const along = Math.abs(na) > 0.5 ? c : a - centre
    if (Math.abs(along - Math.sin(z / 5) * 1.6) < 0.8 && z > 10 && z < 50) return lit ? 'glassViolet' : 'shrine'
    if (Math.abs(along) > 3.6) return 'chrome'
    return Math.floor(z * 0.5 + along) % 7 === 0 ? 'stone' : 'rock'
  }
}

/** STILLSAND: two quartz pillars on sandstone plinths, a lintel across, the sun disc on it with eight rays. */
function stillsand(f: Frame, lit: boolean): void {
  for (const s of [-1, 1]) {
    const a = s * 40
    const q = quartz(a, lit)
    f.box(a - 7.5, -7.5, 0, a + 7.5, 7.5, 5, sandstone)
    f.box(a - 5, -4, 5, a + 5, 4, 54, q)
    f.box(a - 4, -5, 5, a + 4, 5, 54, q)
    // The pillar's point, and a small crystal leaning out at its foot.
    for (let i = 0; i < 9; i++) {
      const half = 4.8 - i * 0.52
      f.box(a - half, -half * 0.85, 54 + i * 1.6, a + half, half * 0.85, 55.6 + i * 1.6, q)
    }
    for (let i = 0; i < 7; i++) {
      const half = 2.4 - i * 0.3
      const ca = a + s * (7.5 + i * 0.7)
      f.box(ca - half, 2 - half, 5 + i * 1.8, ca + half, 2 + half, 6.8 + i * 1.8, q)
    }
  }
  f.box(-47, -4, 45, 47, 4, 51, sandstone)
  f.box(-48, -5, 51, 48, 5, 53, (a, c, z, na, nc, nz) => (nz > 0.5 ? 'sand' : sandstone(a, c, z, na, nc, nz)))
  // The sun: a disc standing on the lintel, its middle white when lit, a dark rim, rays all round.
  f.box(-3, -2, 53, 3, 2, 56, 'carve')
  const cz = 65
  f.ball(0, 0, cz, 9.6, 1.8, 9.6, (a, _c, z) => {
    const r = Math.hypot(a, z - cz)
    if (r > 8.4) return lit ? 'clay' : 'chestWood'
    if (r < 3.6) return lit ? 'core' : 'sand'
    return lit ? 'gold' : 'clay'
  })
  for (let k = 0; k < 8; k++) {
    const t = (k / 8) * Math.PI * 2 + Math.PI / 8
    const [ca, sz] = [Math.cos(t), Math.sin(t)]
    if (sz < -0.5) continue
    strut(f, ca * 10.6, 0, cz + sz * 10.6, ca * 14, 0, cz + sz * 14, 0.7, lit ? 'gold' : 'clay')
  }
}

/** A painted flat's curtain: folds of red, the tie-back, a frame of raw timber at its edges and behind. */
function curtain(centre: number): Local {
  return (a, _c, z, na, nc, nz) => {
    if (nz > 0.5 || !front(nc) || Math.abs(na) > 0.5) return 'chestWood'
    const d = Math.abs(a - centre)
    if (d > 6 || z < 2 || z > 56) return 'chestWood'
    if (Math.abs(z - 26 - (a - centre) * 0.4) < 1) return 'sand'
    return Math.floor((a + 64) / 2.5) % 2 ? 'velvet' : 'blockPink'
  }
}

/** FOGSTAGE: a proscenium of painted flats, a header with a swagged valance, the marquee with its name and bulbs. */
function fogstage(f: Frame, lit: boolean): void {
  for (const s of [-1, 1]) {
    const a = s * 40
    f.box(a - 7, -2, 0, a + 7, 2, 58, curtain(a))
    // A brace behind each flat and a sandbag on its foot.
    strut(f, a, -2.5, 42, a, -15, 1, 0.9, 'wood')
    f.ball(a, -15, 2, 4, 3, 2.2, 'sand')
  }
  f.box(-47, -2, 58, 47, 2, 76, (a, _c, z, na, nc, nz) => {
    if (nz > 0.5 || !front(nc) || Math.abs(na) > 0.5) return 'chestWood'
    if (Math.abs(a) > 45 || z < 59.5 || z > 74.5) return 'chestWood'
    return Math.floor(z) % 4 === 0 ? 'shrine' : 'velvet'
  })
  f.box(-22, -1.5, 76, 22, 1.5, 79, (a, _c, _z, _na, nc) => (front(nc) && Math.abs(a) < 20 ? 'shrine' : 'chestWood'))
  // The valance: swags of velvet under the header, a sand fringe on each.
  for (let k = -3; k <= 3; k++) {
    f.ball(k * 11, 1.5, 57, 6.2, 1.6, 4, (_a, _c, z) => (z < 54 ? 'sand' : 'velvet'))
  }
  // The marquee: a board on the header's face, a ring of bulbs round the name.
  const name = lettering(['FOGSTAGE'], 64)
  const half = Math.ceil(name.width / 2) + 6
  f.box(-half, 2, 61, half, 3, 74, (a, _c, z, na, nc, nz) => {
    if (nz > 0.5 || !front(nc) || Math.abs(na) > 0.5) return 'pole'
    const ring = Math.abs(a) > half - 1.5 || z < 62.5 || z > 72.5
    if (ring) {
      const bulb = (Math.floor(Math.abs(a) + Math.floor(z)) % 3) === 0
      if (!bulb) return 'pole'
      return lit ? (Math.floor(a + z + 64) % 2 ? 'core' : 'gold') : 'carve'
    }
    if (name.at(a, z)) return lit ? 'neon' : 'blockPink'
    return 'dark'
  })
}

/** Brick: courses three px tall, the joints staggered, the mortar pale. */
const brick: Local = (a, c, z, na, _nc, nz) => {
  if (nz > 0.5) return 'stone'
  const along = Math.abs(na) > 0.5 ? c : a
  if (Math.floor(z) % 3 === 0) return 'sand'
  return Math.floor(along + 64 + (Math.floor(z / 3) % 2) * 2.5) % 5 === 0 ? 'sand' : 'clay'
}

/** RERUN ESTATES: a welcome sign on two brick posts, globe lamps on their caps, a neon WELCOME, a cyan tube round its crest. */
function rerun(f: Frame, lit: boolean): void {
  for (const s of [-1, 1]) {
    const a = s * 41
    f.box(a - 5, -5, 0, a + 5, 5, 50, brick)
    f.box(a - 6, -6, 50, a + 6, 6, 53, 'stone')
    f.post(a, 0, 53, 55, 1.4, 'chrome')
    f.ball(a, 0, 58, 3.2, 3.2, 3.2, lit ? 'glassCyan' : 'blockCyan')
  }
  const words = lettering(['WELCOME'], 58)
  const since = lettering(['EST 1958'], 47)
  f.box(-36, -2, 44, 36, 1, 70, (a, _c, z, na, nc, nz) => {
    if (nz > 0.5 || !front(nc) || Math.abs(na) > 0.5) return 'velvet'
    if (Math.abs(a) > 34 || z < 45.5 || z > 68.5) return 'velvet'
    if (words.at(a, z)) return lit ? 'neon' : 'blockPink'
    if (since.at(a, z)) return 'chestWood'
    return 'sand'
  })
  // The crest: an arch of steps over the board, a cyan tube along its edge.
  for (let k = 0; k < 8; k++) {
    const hw = 30 * Math.sqrt(1 - ((k + 0.5) / 8.5) ** 2)
    f.box(-hw, -2, 70 + k, hw, 1, 71 + k, (a, _c, _z, _na, nc, nz) => {
      const edge = Math.abs(a) > hw - 1.4 || k === 7 || (nz > 0.5 && Math.abs(a) > hw - 3)
      if (edge && (front(nc) || nz > 0.5)) return lit ? 'glassCyan' : 'blockCyan'
      return 'velvet'
    })
  }
}

const ARCHES: Record<string, (f: Frame, lit: boolean) => void> = { lumenby, seterfell, sporelight, stillsand, fogstage, rerun }

function arch(realm: string, road: Road, lit: boolean): Thing {
  return b => ARCHES[realm]!(across(b, road), lit)
}

// ---------------------------------------------------------------------------
// W2 · The coast side
// ---------------------------------------------------------------------------

/** Which way a waymark's arrow points. */
export type Heading = 'n' | 'e' | 's' | 'w'

/** The names on the waymarks, in the pixel font's letters; two lines where one would be too wide. */
const NAMES: Record<string, string[]> = {
  lumenby: ['LUMENBY'],
  seterfell: ['SETER FELL'],
  sporelight: ['SPORELIGHT'],
  stillsand: ['STILLSAND'],
  fogstage: ['FOGSTAGE'],
  rerun: ['RERUN', 'ESTATES'],
}

/**
 * A waymark: two posts, a dark board with the realm's name in steady cyan, under it a neon arrow lit (frame 0) or
 * dim (frame 1). East and west boards face south, north and south ones face east; the arrow points along the board.
 */
export function waymark(lines: string[], heading: Heading, lit: boolean): Thing {
  return b => {
    const f = across(b, heading === 'e' || heading === 'w' ? 'ns' : 'ew')
    const dir = heading === 'e' || heading === 'n' ? 1 : -1
    const top = 39 + (lines.length - 1) * 9
    const name = lettering(lines, top - 7)
    const half = Math.ceil(name.width / 2) + 3
    for (const s of [-1, 1]) {
      const a = s * (half - 3)
      f.box(a - 2.4, -2.4, 0, a + 2.4, 2.4, 2, 'stone')
      f.post(a, -0.5, 2, top + 3, 1.2, 'pole')
    }
    f.box(-half, -2, 30, half, 1, top + 2, (a, _c, z, na, nc, nz) => {
      if (nz > 0.5 || !front(nc) || Math.abs(na) > 0.5) return 'pole'
      if (Math.abs(a) > half - 1 || z < 31 || z > top + 1) return 'pole'
      return name.at(a, z) ? 'glassCyan' : 'dark'
    })
    // The arrow, one px slab a row: a shaft and a head, its face neon, its edges dark.
    const tip = half - 2
    for (let row = 0; row < 9; row++) {
      const d = Math.abs(row - 4)
      const from = d <= 1 ? -half + 4 : tip - 9
      const to = tip - d * 1.6
      if (to <= from) continue
      const [a0, a1] = dir > 0 ? [from, to] : [-to, -from]
      f.box(a0, -2, 19 + row, a1, 1, 20 + row, (_a, _c, _z, na, nc, nz) => {
        if (nz > 0.5 || !front(nc) || Math.abs(na) > 0.5) return 'pole'
        return lit ? 'neon' : 'bandPink'
      })
    }
  }
}

/**
 * The wardens' barrier: a striped arm on a housing at the west end (as the face is seen), a rest post at the east;
 * the arm down across the road or up. The BORDER plate rides on the arm, so up it reads from the bottom.
 */
function border(road: Road, up: boolean): Thing {
  return b => {
    const f = across(b, road)
    const plate = lettering(['BORDER'], 0)
    // In the arm's own terms: u along it from the hinge, w across it (the letters' rows run 0…7 up the arm's face).
    const arm: Local = (a, _c, z, na, nc, nz) => {
      const u = up ? z - 15 : a + 36
      const w = up ? -30 - a : z - 16
      if (!front(nc) || nz > 0.5 || Math.abs(na) > 0.5) return 'pole'
      const t = u - 44
      if (Math.abs(t) < plate.width / 2 + 2.5) {
        if (w < -0.5 || w > 7.5) return 'chrome'
        return plate.at(t, w) ? 'neon' : 'dark'
      }
      return Math.floor((u + 64) / 6) % 2 ? 'velvet' : 'chrome'
    }
    if (up) f.box(-38, -2, 15, -29, 1, 86, arm)
    else f.box(-36, -2, 15, 36, 1, 24, arm)
    // The housing with its counterweight, and the rest post the arm lies in when it is down.
    f.box(-42, -5, 0, -30, 4, 22, (a, _c, z, na, nc, nz) => {
      if (nz > 0.5) return 'pole'
      if (front(nc) && Math.abs(z - 17) < 1.5) return Math.floor((a + 64) / 3) % 2 ? 'velvet' : 'chrome'
      return Math.abs(na) > 0.5 ? 'carve' : 'stone'
    })
    f.box(-46, -3, 14, -42, 2, 24, 'pole')
    f.box(34, -2, 0, 38, 1, 14, 'pole')
    f.box(33, -2, 14, 39, 1, 15.4, (_a, _c, _z, _na, nc) => (front(nc) ? 'chrome' : 'pole'))
  }
}

const REALMS = ['lumenby', 'seterfell', 'sporelight', 'stillsand', 'fogstage', 'rerun'] as const
/** The way each realm's road runs from the coast, as the task names it. */
const WAYMARK_HEADING: Record<(typeof REALMS)[number], Heading> = {
  lumenby: 'n', seterfell: 'n', sporelight: 'n', stillsand: 'e', fogstage: 'w', rerun: 'e',
}

/** Every gate thing by id: `gate_<realm>_<road>_<off|on>`, `waymark_<realm>_<heading>_<0 lit|1 dim>`, `border_<road>_<down|up>`. */
export const GATES_THINGS: Record<string, Thing> = {
  ...Object.fromEntries(REALMS.flatMap(realm => (['ns', 'ew'] as const).flatMap(road => [
    [`gate_${realm}_${road}_off`, arch(realm, road, false)],
    [`gate_${realm}_${road}_on`, arch(realm, road, true)],
  ]))),
  ...Object.fromEntries(REALMS.flatMap(realm => [0, 1].map(frame => [
    `waymark_${realm}_${WAYMARK_HEADING[realm]}_${frame}`, waymark(NAMES[realm]!, WAYMARK_HEADING[realm], frame === 0),
  ]))),
  border_ns_down: border('ns', false),
  border_ns_up: border('ns', true),
  border_ew_down: border('ew', false),
  border_ew_up: border('ew', true),
}
