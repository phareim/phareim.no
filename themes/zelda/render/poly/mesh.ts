/**
 * The polygon view's geometry. Pure: no canvas, no DOM.
 *
 * Builds the world of one stretch of a map as triangles: the ground as a
 * lattice on the land (`terrain.ts`), and on it what stands, read from how a
 * tile stands in the classic art (`iso/shape.ts`): a wall's top lifted one
 * row south of where it is drawn, its southern row a face, a house's two face
 * rows under a roof that rises toward the back with an end wall and a gable
 * at either end, a card stood up. Trees are built in code (stacked cones, a
 * blob on a trunk, a palm by the sand), and the standing things the 16-bit
 * view builds from boxes, posts and balls (`iso/props.ts`) are built from the
 * same recipes as small meshes. Every triangle is flat: one normal for its
 * three corners, so the light shows its facets.
 *
 * A vertex's height is in three parts, so the turn can do its work in the
 * vertex shader: its own height over the ground it stands on (scaled by how
 * far it has come up, `role`), the ground's height (lifted by the turn,
 * `terrain.ts` `lift`), and a part that only the finished view has (a roof's
 * pitch, `zk`).
 *
 * In a room the camera looks north from inside the room's south edge, so the
 * south wall is cut down to a kerb (`roomCut`).
 */
import type { MapKind, TileChar } from '../../types'
import { TILE } from '../../types'
import { ROOF, shapeOf, type At, type Shape } from '../iso/shape'
import { BUILD, MATS, type MatName, type Pick, type PropKind, type Solids } from '../iso/props'
import type { Rect } from '../iso/project'
import type { Land } from './terrain'

/** Floats per vertex, and where each attribute lies in them. */
export const STRIDE = 20
/** `snormal`: the normal shared at the corner (smooth shading, the 64-bit look); `normal` is the facet's own. */
export const AT = { pos: 0, ground: 3, normal: 4, uv: 7, tex: 9, color: 10, sun: 13, role: 14, flags: 15, zk: 16, snormal: 17 } as const

/** What a triangle's texel comes from. */
export const TEX = {
  /** Its colour alone. */
  COLOR: 0,
  /** The ground: a material by kind, with what the classic art lays on it (uv: world tiles). */
  GROUND: 1,
  /** The classic art's standing things (uv: map px). */
  OBJS: 2,
  /** A cell of this frame's atlas of people and things (uv: atlas px). */
  ATLAS: 3,
  /** The water's surface (uv: world tiles). */
  WATER: 4,
  /** A blob shadow (uv: −1 … 1 across it). */
  BLOB: 5,
  /** The classic art's ground (uv: map px). */
  BASE: 6,
  /** The hero model's own texture (uv: 0 … 1). */
  HERO: 7,
  /** A material of the atlas, MAT + its place (uv: texels, repeating). */
  MAT: 10,
} as const

/** How a vertex's own height comes up over the turn: always there, the plants' growth, the things' rise, and the classic stand-ins that sink as those come up. */
export const ROLE = { STAY: 0, GROW: 1, SINK: 2, RISE: 3, FALL: 4 } as const
/** 1: may be seen through when it stands between the camera and the hero. 2: shines by itself. */
/** 4: a wall's face, seen through only when the camera may stand anywhere (the 64-bit look). */
export const FLAG = { SEE: 1, GLOW: 2, FACE: 4 } as const

/** Materials the mesher names (`materials.ts`'s order: their place is MAT + index). */
export const MAT_SLOTS = ['grass', 'cobbles', 'sand', 'flags', 'boards', 'moss', 'lane', 'shingles', 'siding', 'rockface', 'bricks', 'blocks', 'panel', 'slab', 'plates', 'steel'] as const
export type MatSlot = typeof MAT_SLOTS[number]
export const matTex = (m: MatSlot): number => TEX.MAT + MAT_SLOTS.indexOf(m)

const T = TILE
/** A card's picture touches the ground this many px above its tile's bottom edge (as in the 16-bit view). */
const FOOT = 3
/** Overhang kept above a card's tile (a lamp's head, a crown's top), px. */
const UP = 10
/** How high a wall stands in a room's south rows, tiles: a kerb. */
export const KERB = 0.22

/** What the mesher reads of a map. Everything is a function of tile coordinates, the land beyond the edge included. */
export interface Field {
  kind: MapKind
  look?: string
  w: number
  h: number
  tile(x: number, y: number): TileChar
  /** The tile is an exit's, drawn by the exit itself (a cabinet, a kiosk): bare ground. */
  own(x: number, y: number): boolean
  /** A crystal block that is up. */
  raised(x: number, y: number): boolean
  /** The chest on this tile, as it is now. */
  chest(x: number, y: number): 'chest' | 'chestOpen' | 'bigChest' | 'bigChestOpen' | null
  /** A sign the exits frame in neon (it keeps the classic sign). */
  signExit(x: number, y: number): boolean
  /** The canopy's mood here: 0 teal, 1 moonlit violet (the classic painter's own choice). */
  mood(x: number, y: number): number
  /** Water the town built (a fountain's pool): its shore is a neon rim, not foam. */
  pool(x: number, y: number): boolean
  /** A hash 0..1 per tile and salt, the classic painters' (`tiles.ts` `hash2`). */
  hash(x: number, y: number, salt: number): number
  land: Land
}

export interface BuildOptions {
  /** How much a house's roof rises for every tile in from its eaves. */
  pitch: number
  /** The room drawn (a dungeon's, an interior's): its south wall is a kerb. None outdoors. */
  room: Rect | null
  /** The low sun: the way to it on the ground (unit), how fast its rays climb (tiles up per tile along), and what stands where. None indoors. */
  sun: { dx: number; dy: number; rise: number; mass: (x: number, y: number) => number } | null
  /** Build the things this view makes itself (props, trees). Off: the classic cards. */
  props: boolean
  /** Coarse cells everywhere (a device that cannot keep up): the shore's curves are cut in fewer facets. */
  coarse?: boolean
}

/** A growing list of vertices. */
export class Verts {
  data: Float32Array
  n = 0
  constructor(cap = 4096) { this.data = new Float32Array(cap * STRIDE) }
  reserve(more: number) {
    if ((this.n + more) * STRIDE <= this.data.length) return
    let len = this.data.length * 2
    while ((this.n + more) * STRIDE > len) len *= 2
    const next = new Float32Array(len)
    next.set(this.data.subarray(0, this.n * STRIDE))
    this.data = next
  }
  clear() { this.n = 0 }
}

/** One corner: world x, y, own height, ground height, uv, the part of its height only the finished view has. */
interface P { x: number; y: number; z: number; g: number; u: number; v: number; zk?: number; /** The normal shared at this corner (none: the facet's own). */ sn?: readonly [number, number, number] }

/** What a triangle is painted with, shared by its three corners. */
interface Brush { tex: number; r: number; g: number; b: number; role: number; flags: number }

const hex = (s: string): [number, number, number] => { const v = parseInt(s.slice(1, 7), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255] }

/**
 * How tall a wall stands in a room, as a share of its height: the south rows of the room are a kerb, so the
 * south wall never stands between the camera and the room. 1 everywhere else and outdoors.
 */
export function roomCut(room: Rect | null, ty: number): number {
  if (!room) return 1
  return ty >= room.y + room.h - 2 ? KERB : 1
}

const isWall = (t: TileChar) => t === '#' || t === '%' || t === '^'

/**
 * How a tile stands in this view: as in the 16-bit view (`shapeOf`), except that a room's wall with floor to its
 * west stands. (That view sees a room from the south-east and lays such a wall down; this one looks north from
 * the south, and the room's east wall is one it looks at.)
 */
export function polyShape(t: TileChar, kind: MapKind, at: At, own: boolean, raised: boolean): Shape {
  if (kind !== 'overworld' && isWall(t)) {
    const at2: At = (dx, dy) => (dx === -1 && dy === 0 ? '#' : at(dx, dy))
    return shapeOf(t, kind, at2, own, raised)
  }
  return shapeOf(t, kind, at, own, raised)
}

/** Builds the geometry of stretches of one field. */
export class Mesher {
  private v: Verts = new Verts()
  /** What the last build stood alone on the ground (x, y, radius, in threes): each throws a blob of shadow. */
  stands: number[] = []
  private brush: Brush = { tex: 0, r: 1, g: 1, b: 1, role: 0, flags: 0 }
  private shapes = new Map<number, Shape>()
  constructor(private f: Field, private o: BuildOptions) {}

  /** The shape of a tile, worked out once. */
  shape(x: number, y: number): Shape {
    const key = (y + 1024) * 4096 + (x + 1024)
    let s = this.shapes.get(key)
    if (!s) {
      const f = this.f
      s = polyShape(f.tile(x, y), f.kind, (dx, dy) => f.tile(x + dx, y + dy), f.own(x, y), f.raised(x, y))
      this.shapes.set(key, s)
    }
    return s
  }

  private set(tex: number, color: readonly number[] = [1, 1, 1], role: number = ROLE.STAY, flags = 0) {
    this.brush = { tex, r: color[0]!, g: color[1]!, b: color[2]!, role, flags }
  }

  private sunAt(x: number, y: number, z: number): number {
    const s = this.o.sun
    if (!s) return 1
    for (let t = 0.15; t < 7; t += 0.22) {
      const px = x + s.dx * t
      const py = y + s.dy * t
      const ray = z + s.rise * t
      if (ray > 4.5) return 1
      if (s.mass(px, py) > ray + 0.02 || this.f.land.height(px, py) > ray + 0.04) return 0
    }
    return 1
  }

  /** One flat triangle. */
  tri(a: P, b: P, c: P, normal?: readonly [number, number, number]) {
    const v = this.v
    v.reserve(3)
    let n = normal
    if (!n) {
      const ax = b.x - a.x, ay = b.y - a.y, az = (b.z + b.g + (b.zk ?? 0)) - (a.z + a.g + (a.zk ?? 0))
      const bx = c.x - a.x, by = c.y - a.y, bz = (c.z + c.g + (c.zk ?? 0)) - (a.z + a.g + (a.zk ?? 0))
      let nx = ay * bz - az * by
      let ny = az * bx - ax * bz
      let nz = ax * by - ay * bx
      const l = Math.hypot(nx, ny, nz) || 1
      // Facing the camera's side of the world: up, or south.
      if (nz < -1e-6 || (Math.abs(nz) < 1e-6 && ny < 0)) { nx = -nx; ny = -ny; nz = -nz }
      n = [nx / l, ny / l, nz / l]
    }
    const B = this.brush
    for (const p of [a, b, c]) {
      const o = v.n * STRIDE
      const d = v.data
      d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z; d[o + 3] = p.g
      d[o + 4] = n[0]; d[o + 5] = n[1]; d[o + 6] = n[2]
      d[o + 7] = p.u; d[o + 8] = p.v
      d[o + 9] = B.tex
      d[o + 10] = B.r; d[o + 11] = B.g; d[o + 12] = B.b
      d[o + 13] = this.o.sun ? this.sunAt(p.x, p.y, p.z + p.g + (p.zk ?? 0)) : 1
      d[o + 14] = B.role
      d[o + 15] = B.flags
      d[o + 16] = p.zk ?? 0
      const sn = p.sn ?? n
      d[o + 17] = sn[0]; d[o + 18] = sn[1]; d[o + 19] = sn[2]
      v.n++
    }
  }

  /** A quad: corners top-left, top-right, bottom-right, bottom-left of its picture. */
  quad(a: P, b: P, c: P, d: P, normal?: readonly [number, number, number]) {
    this.tri(a, b, c, normal)
    this.tri(a, c, d, normal)
  }

  /** Everything in the tiles of `r`, appended to `out` (cleared first). */
  build(r: Rect, out: Verts): Verts {
    this.v = out
    out.clear()
    this.stands.length = 0
    const room = this.o.room
    for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) {
      if (room && (tx < room.x || ty < room.y || tx >= room.x + room.w || ty >= room.y + room.h)) continue
      this.ground(tx, ty)
      this.water(tx, ty)
      this.standing(tx, ty)
    }
    return out
  }

  // --- the ground --------------------------------------------------------------------------------------------

  private ground(tx: number, ty: number) {
    // (In a room a wall has no floor of its own: what its mass does not cover is outside the room, and dark.)
    if (this.o.room && isWall(this.f.tile(tx, ty))) return
    const land = this.f.land
    // (Fine near the water, where the shore curves; coarse cells elsewhere draw the same surface.)
    const res = this.o.coarse ? Math.min(2, land.step(tx, ty)) : land.step(tx, ty)
    const s = 1 / res
    this.set(TEX.GROUND)
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x0 = tx + i * s
      const y0 = ty + j * s
      // (The smooth normal: the land's slope round the corner, so a knoll rolls when the corners share it.)
      const p = (x: number, y: number): P => {
        const e = 0.25
        const gx = (land.height(x + e, y) - land.height(x - e, y)) / (2 * e)
        const gy = (land.height(x, y + e) - land.height(x, y - e)) / (2 * e)
        const l = Math.hypot(gx, gy, 1)
        return { x, y, z: 0, g: land.height(x, y), u: x, v: y, sn: [-gx / l, -gy / l, 1 / l] }
      }
      const nw = p(x0, y0)
      const ne = p(x0 + s, y0)
      const sw = p(x0, y0 + s)
      const se = p(x0 + s, y0 + s)
      // Split from the north-west corner to the south-east one, as the land is (`terrain.ts`).
      this.tri(nw, ne, se)
      this.tri(nw, se, sw)
    }
  }

  private water(tx: number, ty: number) {
    const f = this.f
    let near = false
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (f.tile(tx + dx, ty + dy) === '~') { near = true; break }
    if (!near) return
    // A pool the town built has a neon rim; a pond in the open has foam.
    let built = false
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (f.tile(tx + dx, ty + dy) === '~' && f.pool(tx + dx, ty + dy)) built = true
    this.set(TEX.WATER, [built ? 1 : 0, 0, 0])
    const w = f.land.waterLevel
    // (A hair under the ground's own level: at the classic end of the turn the two lie together, and the ground's picture is the one shown.)
    const p = (x: number, y: number): P => ({ x, y, z: -0.003, g: w, u: x, v: y })
    this.quad(p(tx, ty), p(tx + 1, ty), p(tx + 1, ty + 1), p(tx, ty + 1), [0, 0, 1])
  }

  // --- what stands ---------------------------------------------------------------------------------------------

  private inMap(x: number, y: number) { return x >= 0 && y >= 0 && x < this.f.w && y < this.f.h }

  /** The tile's picture in the classic art, map px: its rectangle, or a patch of it. */
  private art(tx: number, ty: number): { u0: number; v0: number; u1: number; v1: number } {
    return { u0: tx * T, v0: ty * T, u1: tx * T + T, v1: ty * T + T }
  }

  /** The row of the face tile with `d` face rows under it, in column tx below row ty; -1 if the art has none. */
  private faceRow(tx: number, ty: number, d: number): number {
    let y = ty + 1
    while (y <= ty + 8 && this.shape(tx, y).k === 'top') y++
    for (let n = 0; n < 4; n++, y++) {
      const q = this.shape(tx, y)
      if (q.k !== 'face') return -1
      if (q.d === d) return y
    }
    return -1
  }

  private standing(tx: number, ty: number) {
    const f = this.f
    const shp = this.shape(tx, ty)
    const t = f.tile(tx, ty)
    const outdoors = f.kind === 'overworld'
    const props = this.o.props
    // Trees are built, wherever they stand.
    if (t === 'T' && outdoors) {
      this.tree(tx, ty, shp)
      if (props) this.classic(tx, ty, shp, ROLE.SINK)
      return
    }
    if (props) {
      const prop = this.propOf(tx, ty, t, shp)
      if (prop) {
        this.prop(prop.kind, tx + 0.5, ty + prop.y)
        this.classic(tx, ty, shp, ROLE.FALL)
        return
      }
    }
    if (shp.k === 'flat') return
    if (shp === ROOF && outdoors) { this.house(tx, ty); return }
    this.classic(tx, ty, shp, ROLE.STAY)
  }

  /** Which of the things this view builds stands on a tile (and how far south in it), if any. */
  private propOf(tx: number, ty: number, t: TileChar, shp: Shape): { kind: PropKind; y: number } | null {
    const f = this.f
    const outdoors = f.kind === 'overworld'
    if (t === 'F' && outdoors) {
      const sides = (f.tile(tx - 1, ty) === 'F' ? 1 : 0) | (f.tile(tx + 1, ty) === 'F' ? 2 : 0) | (f.tile(tx, ty - 1) === 'F' ? 4 : 0) | (f.tile(tx, ty + 1) === 'F' ? 8 : 0)
      return { kind: `fence${sides}`, y: 0.5 }
    }
    if (t === 'n' && f.look !== 'lab' && !(this.inMap(tx, ty) && f.own(tx, ty))) {
      const n = f.tile(tx, ty - 1) === 'n'
      const s = f.tile(tx, ty + 1) === 'n'
      const along = f.tile(tx - 1, ty) === 'n' || f.tile(tx + 1, ty) === 'n'
      return { kind: !along && (n || s) ? 'counterY' : n && s ? 'counterNS' : n ? 'counterN' : s ? 'counterS' : 'counter', y: 0.5 }
    }
    if (shp.k !== 'card') return null
    let kind: PropKind | null = null
    if (t === 'G' && outdoors) kind = 'grave'
    else if (t === 'o') kind = 'pot'
    else if (t === 'r') kind = 'rock'
    else if (t === 'R') kind = 'boulder'
    else if (t === 'S' && outdoors && !(this.inMap(tx, ty) && f.signExit(tx, ty))) kind = 'sign'
    else if (t === 'I' && f.look !== 'lab') kind = outdoors ? 'pillarStone' : 'pillarShrine'
    else if (t === 'P') kind = 'blockPink'
    else if (t === 'C') kind = 'blockCyan'
    else if (t === '$') kind = f.chest(tx, ty)
    else if (t === 'i' && f.kind === 'interior') kind = 'stool'
    else if (t === 't' && f.kind !== 'dungeon') {
      // (A torch on the beach keeps its flame.)
      const sandy = [f.tile(tx + 1, ty), f.tile(tx - 1, ty), f.tile(tx, ty + 1), f.tile(tx, ty - 1)].filter(q => q === '-').length >= 2
      if (!(outdoors && sandy)) kind = f.hash(tx, ty, 11) < 0.5 ? 'lampPink' : 'lampCyan'
    }
    if (!kind) return null
    return { kind, y: kind === 'blockPink' || kind === 'blockCyan' ? 0.5 : 0.62 }
  }

  /**
   * A tile as the classic art has it, stood up as the 16-bit view stands it: a top lifted with sides, a face, a
   * card. `role` says whether it stays, or sinks as this view's own thing comes up in its place.
   */
  private classic(tx: number, ty: number, shp: Shape, role: number) {
    const f = this.f
    const g0 = 0
    const t = f.tile(tx, ty)
    const inMap = this.inMap(tx, ty)
    // (By where the mass stands: a top's footprint lies `f` rows south of its picture.)
    const cut = shp.k === 'top' ? roomCut(this.o.room, ty + shp.f) : shp.k === 'face' ? roomCut(this.o.room, ty) : 1
    const flags = role === ROLE.STAY && (shp.k === 'top' || shp.k === 'card') ? FLAG.SEE : shp.k === 'face' ? FLAG.FACE : 0
    /**
     * A room's walls (but the kerb) stand two tiles tall at the end of the turn: the face picture again over
     * itself, a course darker, so the room is a box one looks into. (The second course is height only the
     * finished view has: at the classic end the wall is the classic one.)
     */
    const twice = !!this.o.room && cut === 1 && role === ROLE.STAY && (isWall(t) || t === 'D' || t === 'L' || t === 'K' || t === 'X')
    /** The second course over a quad (corners top-left, top-right, bottom-right, bottom-left): the same picture again over it, darker. */
    const course = (a: P, b: P, c: P, d: P, n: readonly [number, number, number], dark: number) => {
      if (!twice) return
      void c
      // Plain wall, never the tile's own picture again (a sign, a row of letters, a screen, a shelf, a door would
      // stand twice): the map's wall material, in two steps darker toward the top.
      const B = this.brush
      const plain = matTex(this.f.look === 'lab' ? 'steel' : this.f.kind === 'dungeon' ? 'bricks' : 'panel')
      const h = a.z - d.z
      const along = (p: P) => (n[0] !== 0 ? p.y : p.x) * 16
      const at = (p: P, up: number): P => ({ ...p, zk: (p.zk ?? 0) + up, u: along(p), v: (1 - up / h) * 16 * h })
      this.set(plain, [dark * 1.08, dark * 1.08, dark * 1.12], B.role, B.flags)
      this.quad(at(a, h / 2), at(b, h / 2), at(b, 0), at(a, 0), n)
      this.set(plain, [dark * 0.86, dark * 0.86, dark * 0.92], B.role, B.flags)
      this.quad(at(a, h), at(b, h), at(b, h / 2), at(a, h / 2), n)
      this.set(B.tex, [B.r, B.g, B.b], B.role, B.flags)
    }
    if (shp.k === 'top') {
      // (A kerb stands on its own row: a row further south, where the art's reading puts a wall's mass, is
      // outside the room.)
      const fy = ty + (cut < 1 ? 0 : shp.f)
      const hz = (shp.h / T) * cut
      const a = this.art(tx, ty)
      if (inMap) this.set(TEX.OBJS, [1, 1, 1], role, flags)
      else this.set(TEX.GROUND, [1, 1, 1], role, flags)
      const top = (x: number, y: number, u: number, v: number): P => ({ x, y, z: hz, g: g0, zk: twice ? hz : 0, u: inMap ? u : x, v: inMap ? v : y })
      this.quad(top(tx, fy, a.u0, a.v0), top(tx + 1, fy, a.u1, a.v0), top(tx + 1, fy + 1, a.u1, a.v1), top(tx, fy + 1, a.u0, a.v1), [0, 0, 1])
      if (!shp.sides) return
      // The sides nobody drew: the face picture of the column again, darker.
      const fr = this.faceRow(tx, ty, 0)
      const side = (dark: number) => {
        if (inMap) this.set(TEX.OBJS, [dark, dark * 0.95, dark], role, flags)
        else this.set(matTex(f.look === 'lab' ? 'steel' : 'rockface'), [dark, dark, dark], role, flags)
      }
      const fv = (fr < 0 ? ty : fr) * T
      const below = this.shape(tx, ty + 1)
      if (below.k !== 'top' && below.k !== 'face') {
        side(0.85)
        const q = (x: number, z: number, u: number, v: number): P => ({ x, y: fy + 1, z, g: 0, u: inMap ? u : x * 16, v: inMap ? v : (1 - z) * 16 })
        this.quad(q(tx, hz, a.u0, fv), q(tx + 1, hz, a.u1, fv), q(tx + 1, 0, a.u1, fv + T), q(tx, 0, a.u0, fv + T), [0, 1, 0])
        course(q(tx, hz, a.u0, fv), q(tx + 1, hz, a.u1, fv), q(tx + 1, 0, a.u1, fv + T), q(tx, 0, a.u0, fv + T), [0, 1, 0], 0.72)
      }
      for (const dir of [1, -1]) {
        const nx = tx + dir
        const ns = this.shape(nx, ty)
        if (ns.k === 'top' && ns.h >= shp.h && roomCut(this.o.room, ty + ns.f) <= cut) continue
        side(0.62)
        const x = dir > 0 ? tx + 1 : tx
        const q = (y: number, z: number, u: number, v: number): P => ({ x, y, z, g: 0, u: inMap ? u : y * 16, v: inMap ? v : (1 - z) * 16 })
        this.quad(q(fy, hz, a.u0, fv), q(fy + 1, hz, a.u1, fv), q(fy + 1, 0, a.u1, fv + T), q(fy, 0, a.u0, fv + T), [dir, 0, 0])
        course(q(fy, hz, a.u0, fv), q(fy + 1, hz, a.u1, fv), q(fy + 1, 0, a.u1, fv + T), q(fy, 0, a.u0, fv + T), [dir, 0, 0], 0.72)
      }
      return
    }
    if (shp.k === 'face') {
      const y = ty + 1 + shp.d
      const a = this.art(tx, ty)
      const z0 = shp.d * cut
      const z1 = (shp.d + 1) * cut
      // (A kerb shows the face's top rows: the wall's lip.)
      const v1 = cut < 1 ? a.v0 + Math.round(T * cut) : a.v1
      this.set(inMap ? TEX.OBJS : matTex('rockface'), [1, 1, 1], role, flags)
      const q = (x: number, z: number, u: number, v: number): P => ({ x, y, z, g: 0, u: inMap ? u : x * 16, v: inMap ? v : (1 - z) * 16 })
      this.quad(q(tx, z1, a.u0, a.v0), q(tx + 1, z1, a.u1, a.v0), q(tx + 1, z0, a.u1, v1), q(tx, z0, a.u0, v1), [0, 1, 0])
      course(q(tx, z1, a.u0, a.v0), q(tx + 1, z1, a.u1, a.v0), q(tx + 1, z0, a.u1, v1), q(tx, z0, a.u0, v1), [0, 1, 0], 0.72)
      // A rock face outdoors with nothing on it (a wall one tile deep): a cap of its own picture, and its ends.
      const n = this.shape(tx, ty - 1).k
      if (f.kind === 'overworld' && isWall(t) && n !== 'top' && n !== 'face' && shp.d === 0) {
        this.set(inMap ? TEX.OBJS : matTex('rockface'), [0.8, 0.8, 0.85], role, flags)
        const cu = a.u0 + 6
        const cv = a.v0 + 12
        const c = (x: number, yy: number): P => ({ x, y: yy, z: z1, g: 0, u: inMap ? cu : x * 16, v: inMap ? cv : yy * 16 })
        this.quad(c(tx, y - 1), c(tx + 1, y - 1), c(tx + 1, y), c(tx, y), [0, 0, 1])
        for (const dir of [1, -1]) {
          const e = this.shape(tx + dir, ty).k
          if (e !== 'flat' && e !== 'card') continue
          this.set(inMap ? TEX.OBJS : matTex('rockface'), [0.62, 0.6, 0.66], role, flags)
          const x = dir > 0 ? tx + 1 : tx
          const s = (yy: number, z: number, u: number, v: number): P => ({ x, y: yy, z, g: 0, u: inMap ? u : yy * 16, v: inMap ? v : (1 - z) * 16 })
          this.quad(s(y - 1, z1, a.u0, a.v0), s(y, z1, a.u1, a.v0), s(y, z0, a.u1, a.v1), s(y - 1, z0, a.u0, a.v1), [dir, 0, 0])
        }
      }
      return
    }
    if (shp.k === 'card') {
      // The tile's picture upright on its foot, with what reaches above it when nothing stands there.
      const up = this.shape(tx, ty - 1).k === 'flat' ? UP : 0
      const a = this.art(tx, ty)
      const x = tx + 0.5
      const y = ty + 1 - FOOT / T
      const g = f.land.height(x, y)
      const foot = -FOOT / T
      const top = foot + (T + up) / T
      this.set(TEX.OBJS, [1, 1, 1], role, FLAG.SEE)
      if (role === ROLE.STAY) this.stands.push(x, y - 0.1, 0.3)
      const q = (dx: number, z: number, u: number, v: number): P => ({ x: x + dx, y, z, g, u, v })
      this.quad(q(-0.5, top, a.u0, a.v0 - up), q(0.5, top, a.u1, a.v0 - up), q(0.5, foot, a.u1, a.v1), q(-0.5, foot, a.u0, a.v1), [0, 0.6, 0.8])
    }
  }

  /**
   * A house, built once from the first roof tile of each of its columns: the roof is one plane from the eaves
   * rising toward the back (so what is painted on it stays whole), and where the house ends east or west an
   * end wall and a gable close it. The faces under the eaves are the classic art's own (`classic`).
   */
  private house(tx: number, ty: number) {
    if (this.shape(tx, ty - 1) === ROOF) return
    let r1 = ty
    while (r1 - ty < 16 && this.shape(tx, r1 + 1) === ROOF) r1++
    const depth = r1 - ty + 1
    const yb = ty + 2
    const yf = r1 + 3
    const rise = this.o.pitch * depth
    const inMap = this.inMap(tx, ty)
    // The front of the roof over the eaves, a little out over the faces.
    const over = 0.18
    this.set(inMap ? TEX.OBJS : matTex('shingles'), [1, 1, 1], ROLE.STAY, FLAG.SEE)
    const v0 = ty * T
    const v1 = (r1 + 1) * T
    const r = (x: number, y: number, k: number, u: number, v: number): P => ({ x, y, z: 2, g: 0, zk: k * rise, u, v })
    const slope = (yf - yb)
    this.quad(r(tx, yb, 1, tx * T, v0), r(tx + 1, yb, 1, tx * T + T, v0), r(tx + 1, yf + over, -over / slope, tx * T + T, v1), r(tx, yf + over, -over / slope, tx * T, v1))
    // The eave's edge, and the back of the house: plain.
    this.set(matTex('shingles'), [0.45, 0.35, 0.5], ROLE.STAY, FLAG.SEE)
    const e = (x: number, z: number, k: number): P => ({ x, y: yf + over, z, g: 0, zk: k * rise, u: x * 16, v: z * 16 })
    this.quad(e(tx, 2, -over / slope), e(tx + 1, 2, -over / slope), e(tx + 1, 1.94, -over / slope), e(tx, 1.94, -over / slope), [0, 1, 0])
    // (Only what rises over the eaves: below them the house's own back is never seen, and at the classic end of the
    // turn a wall there would stand over whatever the art has behind the roof.)
    const b = (x: number, z: number, k: number): P => ({ x, y: yb, z, g: 0, zk: k * rise, u: x * 16, v: z * 16 })
    this.quad(b(tx, 2, 1), b(tx + 1, 2, 1), b(tx + 1, 2, 0), b(tx, 2, 0), [0, -1, 0])
    // The ends: a wall of boards to the eaves and a gable over it.
    for (const dir of [-1, 1]) {
      if (this.shape(tx + dir, ty) === ROOF) continue
      const x = dir > 0 ? tx + 1 : tx
      this.set(matTex('siding'), dir > 0 ? [0.62, 0.58, 0.7] : [0.78, 0.74, 0.86], ROLE.STAY, FLAG.SEE)
      const w = (y: number, z: number, k: number): P => ({ x, y, z, g: 0, zk: k * rise, u: y * 16, v: (2 - z) * 16 - k * rise * 16 })
      this.quad(w(yb, 2, 1), w(yf, 2, 0), w(yf, 0, 0), w(yb, 0, 0), [dir, 0, 0])
    }
  }

  // --- trees --------------------------------------------------------------------------------------------------

  private tree(tx: number, ty: number, shp: Shape) {
    const f = this.f
    const h1 = f.hash(tx, ty, 21)
    const h2 = f.hash(tx, ty, 22)
    const h3 = f.hash(tx, ty, 23)
    // (Rows of the art: a crown drawn as a top stands a row further south.)
    const fy = shp.k === 'top' ? ty + shp.f : ty
    const x = tx + 0.5 + (h1 - 0.5) * 0.4
    const y = fy + 0.55 + (h2 - 0.5) * 0.3
    const g = f.land.height(x, y)
    const lone = shp.k === 'card'
    const sand = [f.tile(tx - 1, ty), f.tile(tx + 1, ty), f.tile(tx, ty + 1), f.tile(tx, ty - 1)].includes('-')
    const wild = f.look === 'wild'
    const violet = f.mood(tx, ty) > 0
    const pal = violet ? ['#1a1f4c', '#27366e', '#3f58a4', '#86a2ff'] : wild ? ['#0f3a3a', '#145a52', '#1f8a72', '#3fd8b0'] : ['#0f3445', '#1b5763', '#2a8579', '#5fd6b8']
    const trunk = hex('#3a2240')
    const flags = FLAG.SEE
    if (lone) this.stands.push(x, y, 0.5)
    if (sand) {
      // A palm: a leaning trunk in segments and a star of fronds.
      this.prism(x, y, g, 0, 1.5, 0.07, 0.05, 5, trunk, ROLE.GROW, flags, 0.18)
      const cx = x + 0.18
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + h3
        const tipx = cx + Math.cos(a) * 0.85
        const tipy = y + Math.sin(a) * 0.6
        const midx = cx + Math.cos(a) * 0.45
        const midy = y + Math.sin(a) * 0.32
        const px = -Math.sin(a) * 0.14
        const py = Math.cos(a) * 0.1
        this.set(TEX.COLOR, hex(i % 2 ? pal[2]! : pal[1]!), ROLE.GROW, flags)
        this.tri({ x: cx, y, z: 1.55, g, u: 0, v: 0 }, { x: midx + px, y: midy + py, z: 1.5, g, u: 0, v: 0 }, { x: tipx, y: tipy, z: 1.05, g, u: 0, v: 0 })
        this.tri({ x: cx, y, z: 1.55, g, u: 0, v: 0 }, { x: tipx, y: tipy, z: 1.05, g, u: 0, v: 0 }, { x: midx - px, y: midy - py, z: 1.5, g, u: 0, v: 0 })
      }
      return
    }
    const scale = (lone ? 0.95 : 1.1) * (0.85 + h3 * 0.3)
    this.prism(x, y, g, 0, 0.5 * scale, 0.09 * scale, 0.08 * scale, 5, trunk, ROLE.GROW, flags)
    if (h3 > 0.72 && !wild) {
      // A blob on a trunk: a broad crown, cut in facets.
      this.blob(x, y, g, 1.05 * scale, 0.62 * scale, 0.55 * scale, pal, ROLE.GROW, flags, h1)
      return
    }
    // Two stacked cones of five sides: few, large facets, so a tree line reads as cones with a lit side and a
    // shaded one even at the size of a phone.
    this.cone(x, y, g, 0.34 * scale, 1.45 * scale, 0.74 * scale, 5, pal, 0, ROLE.GROW, flags, h1 * 6)
    this.cone(x, y, g, 0.98 * scale, 2.05 * scale, 0.5 * scale, 5, pal, 1, ROLE.GROW, flags, h1 * 6 + 0.6)
  }

  /** An upright prism of `n` sides: a trunk, a post. `lean` tips its top east. */
  private prism(x: number, y: number, g: number, z0: number, z1: number, r0: number, r1: number, n: number, color: readonly number[], role: number, flags: number, lean = 0) {
    this.set(TEX.COLOR, color, role, flags)
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2
      const a1 = ((i + 1) / n) * Math.PI * 2
      const p = (a: number, z: number, r: number, l: number): P => ({ x: x + Math.cos(a) * r + l, y: y + Math.sin(a) * r, z, g, u: 0, v: 0 })
      this.quad(p(a0, z1, r1, lean), p(a1, z1, r1, lean), p(a1, z0, r0, 0), p(a0, z0, r0, 0))
    }
  }

  /** A cone of `n` sides from a ring at z0 to a point at z1, one colour a tier: the light makes its sides. */
  private cone(x: number, y: number, g: number, z0: number, z1: number, r: number, n: number, pal: readonly string[], tier: number, role: number, flags: number, twist: number) {
    const tip: P = { x, y, z: z1, g, u: 0, v: 0, sn: [0, 0, 1] }
    const side = Math.hypot(z1 - z0, r)
    this.set(TEX.COLOR, hex(pal[tier === 0 ? 2 : 3]!).map(q => q * (tier === 0 ? 1 : 0.85)) as [number, number, number], role, flags)
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 + twist
      const a1 = ((i + 1) / n) * Math.PI * 2 + twist
      const p = (a: number): P => ({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, z: z0, g, u: 0, v: 0, sn: [Math.cos(a) * (z1 - z0) / side, Math.sin(a) * (z1 - z0) / side, r / side] })
      this.tri(tip, p(a0), p(a1))
    }
  }

  /** A faceted blob (a ball of 7 slices and 4 rings). */
  private blob(x: number, y: number, g: number, cz: number, rxy: number, rz: number, pal: readonly string[], role: number, flags: number, twist: number) {
    const S = 7
    const R = 4
    const pt = (i: number, j: number): P => {
      const a = (i / S) * Math.PI * 2 + twist * 3
      const b = -Math.PI / 2 + (j / R) * Math.PI
      return { x: x + Math.cos(a) * Math.cos(b) * rxy, y: y + Math.sin(a) * Math.cos(b) * rxy, z: cz + Math.sin(b) * rz, g, u: 0, v: 0, sn: [Math.cos(a) * Math.cos(b), Math.sin(a) * Math.cos(b), Math.sin(b)] }
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < S; i++) {
      this.set(TEX.COLOR, hex(pal[Math.min(3, j === R - 1 ? 3 : 1 + ((i + j) % 2))]!), role, flags)
      const a = pt(i, j + 1), b = pt(i + 1, j + 1), c = pt(i + 1, j), d = pt(i, j)
      if (j === 0) this.tri(a, b, c)
      else if (j === R - 1) this.tri(a, c, d)
      else this.quad(a, b, c, d)
    }
  }

  // --- the things in the round -----------------------------------------------------------------------------------

  /** One of the 16-bit view's things (`iso/props.ts`), built from its own recipe as a mesh. 32 px to the tile. */
  prop(kind: PropKind, x: number, y: number) {
    const g = this.f.land.height(x, y)
    this.stands.push(x, y, kind.startsWith('fence') ? 0.18 : kind.startsWith('counter') ? 0 : kind === 'boulder' ? 0.42 : kind.startsWith('lamp') ? 0.2 : 0.3)
    const solids = new MeshSolids(this, x, y, g)
    BUILD[kind](solids)
  }

  /** For `MeshSolids`: paint the next triangles in a material of the things. */
  paint(m: MatName, role: number) {
    const mat = MATS[m]
    const c = mat.ramp[2]!
    this.set(TEX.COLOR, [c[0] / 255, c[1] / 255, c[2] / 255], role, FLAG.SEE | (mat.glow >= 1 ? FLAG.GLOW : 0))
  }
}

/** The 16-bit view's boxes, posts and balls as small meshes, each face cut in cells so a material can change across it. */
class MeshSolids implements Solids {
  constructor(private m: Mesher, private x: number, private y: number, private g: number) {}
  private p(px: number, py: number, pz: number): P {
    return { x: this.x + px / 32, y: this.y + py / 32, z: pz / 32, g: this.g, u: 0, v: 0 }
  }
  private pick(pick: Pick, x: number, y: number, z: number, nx: number, ny: number, nz: number): MatName {
    return typeof pick === 'string' ? pick : pick(x, y, z, nx, ny, nz)
  }
  /** A face: an origin, two edges (scene px), its normal (in the recipe's axes: x east, y south, z up), cut in cells of about `cell` px. */
  private face(o: [number, number, number], e1: [number, number, number], e2: [number, number, number], n: [number, number, number], pick: Pick, cell = 3) {
    const l1 = Math.hypot(...e1)
    const l2 = Math.hypot(...e2)
    const c1 = typeof pick === 'string' ? 1 : Math.max(1, Math.min(8, Math.round(l1 / cell)))
    const c2 = typeof pick === 'string' ? 1 : Math.max(1, Math.min(8, Math.round(l2 / cell)))
    const at = (a: number, b: number): [number, number, number] => [o[0] + e1[0] * a + e2[0] * b, o[1] + e1[1] * a + e2[1] * b, o[2] + e1[2] * a + e2[2] * b]
    for (let j = 0; j < c2; j++) for (let i = 0; i < c1; i++) {
      const mid = at((i + 0.5) / c1, (j + 0.5) / c2)
      this.m.paint(this.pick(pick, mid[0], mid[1], mid[2], n[0], n[1], n[2]), ROLE.RISE)
      const a = at(i / c1, j / c2), b = at((i + 1) / c1, j / c2), c = at((i + 1) / c1, (j + 1) / c2), d = at(i / c1, (j + 1) / c2)
      this.m.quad(this.p(...a), this.p(...b), this.p(...c), this.p(...d), n)
    }
  }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, pick: Pick) {
    this.face([x0, y0, z1], [x1 - x0, 0, 0], [0, y1 - y0, 0], [0, 0, 1], pick)
    this.face([x0, y1, z1], [x1 - x0, 0, 0], [0, 0, z0 - z1], [0, 1, 0], pick)
    this.face([x1, y1, z1], [0, y0 - y1, 0], [0, 0, z0 - z1], [1, 0, 0], pick)
    this.face([x0, y0, z1], [0, y1 - y0, 0], [0, 0, z0 - z1], [-1, 0, 0], pick)
    this.face([x1, y0, z1], [x0 - x1, 0, 0], [0, 0, z0 - z1], [0, -1, 0], pick)
  }
  post(cx: number, cy: number, z0: number, z1: number, r: number, pick: Pick) {
    const n = 6
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2
      const a1 = ((i + 1) / n) * Math.PI * 2
      const am = (a0 + a1) / 2
      const o: [number, number, number] = [cx + Math.cos(a0) * r, cy + Math.sin(a0) * r, z1]
      const e1: [number, number, number] = [Math.cos(a1) * r - Math.cos(a0) * r, Math.sin(a1) * r - Math.sin(a0) * r, 0]
      this.face(o, e1, [0, 0, z0 - z1], [Math.cos(am), Math.sin(am), 0], pick)
      // The cap.
      this.m.paint(this.pick(pick, cx, cy, z1, 0, 0, 1), ROLE.RISE)
      this.m.tri(this.p(cx, cy, z1), this.p(o[0], o[1], z1), this.p(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r, z1), [0, 0, 1])
    }
  }
  ball(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, pick: Pick) {
    const S = 8
    const R = 5
    const pt = (i: number, j: number): [number, number, number] => {
      const a = (i / S) * Math.PI * 2
      const b = -Math.PI / 2 + (j / R) * Math.PI
      return [cx + Math.cos(a) * Math.cos(b) * rx, cy + Math.sin(a) * Math.cos(b) * ry, cz + Math.sin(b) * rz]
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < S; i++) {
      const a = pt(i, j + 1), b = pt(i + 1, j + 1), c = pt(i + 1, j), d = pt(i, j)
      const mx = (a[0] + c[0]) / 2 - cx, my = (a[1] + c[1]) / 2 - cy, mz = (a[2] + c[2]) / 2 - cz
      const l = Math.hypot(mx / rx, my / ry, mz / rz) || 1
      // (Under the ground nothing is seen: a ball that sits in it is cut there.)
      if (Math.max(a[2], b[2], c[2], d[2]) < 0) continue
      this.m.paint(this.pick(pick, cx + mx, cy + my, cz + mz, mx / rx / l, my / ry / l, mz / rz / l), ROLE.RISE)
      if (j === 0) this.m.tri(this.p(...a), this.p(...b), this.p(...c))
      else if (j === R - 1) this.m.tri(this.p(...a), this.p(...c), this.p(...d))
      else this.m.quad(this.p(...a), this.p(...b), this.p(...c), this.p(...d))
    }
  }
}

/**
 * How tall the mass over a ground point is, tiles, for the sun's shadows: a wall's top where it stands (a row
 * south of its picture), a house to its roof, a wood's crowns. A function of the field, built per tile once.
 */
export function massOf(f: Field, mesher: Mesher, r: Rect, pitch: number, trees = true): (x: number, y: number) => number {
  const grid = new Float32Array(r.w * r.h)
  for (let ty = r.y; ty < r.y + r.h; ty++) for (let tx = r.x; tx < r.x + r.w; tx++) {
    const s = mesher.shape(tx, ty)
    const t = f.tile(tx, ty)
    let h = 0
    let fy = ty
    if (t === 'T') { if (!trees) continue; h = 1.6; fy = s.k === 'top' ? ty + s.f : ty }
    else if (s.k === 'top') {
      fy = ty + s.f
      h = s.h / T
      if (s === ROOF) {
        let n = 0
        while (n < 12 && mesher.shape(tx, ty + n + 1) === ROOF) n++
        h += pitch * (n + 1)
      }
    } else if (s.k === 'face' && isWall(t)) { fy = ty; h = s.d + 1 }
    if (fy - r.y >= r.h || h === 0) continue
    const o = (fy - r.y) * r.w + (tx - r.x)
    if (h > grid[o]!) grid[o] = h
  }
  return (x, y) => {
    const i = Math.floor(x) - r.x
    const j = Math.floor(y) - r.y
    return i < 0 || j < 0 || i >= r.w || j >= r.h ? 0 : grid[j * r.w + i]!
  }
}
