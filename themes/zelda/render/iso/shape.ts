/**
 * What a tile is, once the world gets depth. Pure: reads tile chars only.
 *
 * The classic art is drawn three-quarters from above: of a wall you see the
 * top, and on its southern row the face. The isometric view takes that at
 * its word. Each tile's own picture is used exactly once:
 *
 * - 'flat'  lies on the ground (floors, paths, water, rugs);
 * - 'top'   is the top of a mass, `h` px up. The art draws it `f` rows north
 *           of where it stands (the face rows take that room), so its
 *           footprint is `f` rows south of the tile;
 * - 'face'  is a vertical face, standing on the south edge of the mass's
 *           bottom row; `d` is how many face rows lie below it (a house has
 *           two: the window row above the foot);
 * - 'card'  is a thing that stands on its tile and faces the viewer (a pot,
 *           a lamp post, a lone tree).
 *
 * With every height at zero these fall back onto the classic picture pixel
 * for pixel, which is what lets one view turn into the other.
 */
import type { MapKind, TileChar } from '../../types'

export type At = (dx: number, dy: number) => TileChar

export interface Shape {
  k: 'flat' | 'top' | 'face' | 'card'
  /** top: height in px. */
  h: number
  /** top: rows the footprint lies south of the tile. */
  f: number
  /** face: face rows below this one. */
  d: number
  /** top: has side walls. */
  sides: boolean
}

const make = (k: Shape['k'], h = 0, f = 0, d = 0, sides = false): Shape => Object.freeze({ k, h, f, d, sides })

export const FLAT = make('flat')
export const CARD = make('card')
export const FACE0 = make('face', 0, 0, 0)
export const FACE1 = make('face', 0, 0, 1)
export const WALL_TOP = make('top', 16, 1, 0, true)
export const ROOF = make('top', 32, 2, 0, true)
export const CANOPY = make('top', 16, 1, 0, true)

const isWall = (t: TileChar) => t === '#' || t === '%' || t === '^'
const isDoor = (t: TileChar) => t === 'L' || t === 'K' || t === 'X'
const isTree = (t: TileChar) => t === 'T'
const isBuilding = (t: TileChar) => t === 'H' || t === 'M'
/** Things that stand alone on their tile. */
const CARDS = new Set<TileChar>(['*', 'o', 'r', 'R', 't', 'S', 'G', '$', 'I', 'c', 'Y', '|', '}', 'b', 'B', 'i'])
/** Things that come in rows: a row along x stands up as one strip, a row along y lies down. */
const RUNS = new Set<TileChar>(['F', '¤', 'n', 'w', '(', '[', 'q', 'l'])

/**
 * The shape of tile `t`. `own`: an exit draws this tile itself (a cabinet, a
 * kiosk), so the tile is bare ground. `raised`: a crystal block that is up.
 */
export function shapeOf(t: TileChar, kind: MapKind, at: At, own = false, raised = false): Shape {
  if (own) return FLAT
  if (isWall(t)) {
    const below = at(0, 1)
    const face = !isWall(below) && !(kind === 'dungeon' && (below === 'L' || below === 'K'))
    if (face) return FACE0
    // A wall with floor to its west would stand in front of that floor: leave it down, like a cut-away room.
    if (kind !== 'overworld') {
      const west = at(-1, 0)
      if (!isWall(west) && !isDoor(west)) return FLAT
    }
    return WALL_TOP
  }
  if (isDoor(t)) {
    const below = at(0, 1)
    return kind !== 'overworld' && !isWall(below) && !isDoor(below) ? FACE0 : FLAT
  }
  if (kind === 'overworld') {
    const b = (q: TileChar) => isBuilding(q) || q === 'D'
    if (isBuilding(t)) {
      if (!b(at(0, 1))) return FACE0
      if (!b(at(0, 2))) return FACE1
      return ROOF
    }
    if (t === 'D') return isBuilding(at(0, -1)) ? FACE0 : FLAT
  } else {
    if (t === 'M') return CARD
    if (t === 'D') return isWall(at(-1, 0)) && isWall(at(1, 0)) && !isWall(at(0, 1)) && at(0, 1) !== 'D' ? FACE0 : FLAT
  }
  if (isTree(t)) return isTree(at(0, 1)) ? CANOPY : CARD
  if (t === 'P' || t === 'C') return raised ? CARD : FLAT
  if (CARDS.has(t)) return CARD
  if (RUNS.has(t)) {
    if (at(-1, 0) === t || at(1, 0) === t) return FACE0
    if (at(0, -1) === t || at(0, 1) === t) return FLAT
    return CARD
  }
  return FLAT
}
