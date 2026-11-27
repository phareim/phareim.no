/**
 * The view blocks' pictures (`□` square, `◇` diamond), one per tile at TILE px. Pure: colours, no canvas. Both
 * painters use them (`tiles.ts` draws them each frame; the isometric view stands the up ones as low blocks of the
 * dungeon's wall material, `iso/view.ts`).
 *
 * Up, a block carries its shape cut into its top face in cyan; down, the same shape is a dim outline on the floor.
 * The shape is the corner's own, as it looks ON SCREEN: a square is a square and a diamond a diamond in either
 * picture. `face` says which picture the tile will be seen in:
 *
 * - 'flat', from straight above: the up block is a top face over a south face, as the classic art draws a mass.
 * - 'iso', the ground turned and halved in height, so a tile px (u, v) lands at (u − v, (u + v) / 2): the square is
 *   drawn as what lands square, and the diamond as the tile's own square, which lands as the corner's 2:1 diamond.
 *   The up block is its top face alone (the whole tile); its sides are cut from a plain patch of it (`SIDE_PATCH`).
 *
 * The block's stone is the Shrine's wall colours, so the isometric view lays its own wall materials over it as it
 * does over a wall; the cyan is no stone colour, and stays.
 */
import type { ViewSide } from '../types'
import { TILE } from '../types'

export type BlockShape = 'square' | 'diamond'

export const BLOCK_INK = {
  ink: '#0b0616', top: '#1f1a3c', face: '#3a2f70', faceL: '#4a3d88', faceD: '#271f50',
  /** The cut, up: the light cyan of the dungeon's neon, with its dark inside edge. */
  cut: '#3ff0ff', groove: '#0f4a60',
  /** The outline, down: dim, so it lies on the floor and glows nothing. */
  floor: '#2596b6',
} as const

/** The up block's south face in the 'flat' picture: its first row. */
export const FACE_ROW = 12
/** A plain patch of the 'iso' picture's stone, for its sides: x, y, w, h in tile px. */
export const SIDE_PATCH = { x: 1, y: 1, w: 2, h: 2 } as const

/**
 * How far (du, dv) from a tile's middle is from it, in the measure whose level lines are the shape on screen.
 */
function reach(shape: BlockShape, face: ViewSide, du: number, dv: number): number {
  if (face === 'flat') return shape === 'square' ? Math.max(Math.abs(du), Math.abs(dv)) : Math.abs(du) + Math.abs(dv)
  // Where the px lands, in the tile's own measure: across u − v, down (u + v) / 2.
  return shape === 'square' ? Math.max(Math.abs(du - dv), Math.abs(du + dv) / 2) : Math.max(Math.abs(du), Math.abs(dv))
}

/**
 * The isometric square's outline, down: about as heavy on every edge. Its upright edges are diagonals
 * of the tile, and a thinner line drops out where the legacy picture samples the turned ground.
 */
function isoSquareLine(du: number, dv: number): boolean {
  const across = Math.abs(du - dv)
  const down = Math.abs(du + dv) / 2
  return across <= 5 && down <= 5 && !(across <= 3 && down <= 3.5)
}

/** The cut's outer and inner edge in `reach`, and the outline's, by picture. */
const CUT: Record<ViewSide, Record<BlockShape, [number, number]>> = {
  flat: { square: [4, 2], diamond: [5, 3] },
  iso: { square: [4.5, 2.5], diamond: [5, 3] },
}
const LINE: Record<ViewSide, Record<BlockShape, [number, number]>> = {
  flat: { square: [5, 4], diamond: [7, 5] },
  // (The square's is `isoSquareLine`.)
  iso: { square: [5, 4], diamond: [6, 5] },
}

/** The picture, row by row; null is clear. */
export function viewBlockPixels(shape: BlockShape, up: boolean, face: ViewSide): Array<string | null> {
  const T = TILE
  const px = new Array<string | null>(T * T).fill(null)
  const set = (x: number, y: number, c: string) => { px[y * T + x] = c }
  /** The middle of the top face, and of the floor. */
  const mid = T / 2
  const cy = up && face === 'flat' ? FACE_ROW / 2 : mid
  if (up) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) set(x, y, BLOCK_INK.top)
    // The lit edge of the top, toward the light.
    const last = face === 'flat' ? FACE_ROW - 1 : T - 1
    for (let x = 0; x < T; x++) set(x, 0, BLOCK_INK.faceL)
    for (let y = 0; y <= last; y++) set(0, y, BLOCK_INK.faceL)
    if (face === 'flat') {
      for (let y = FACE_ROW; y < T; y++) for (let x = 0; x < T; x++) set(x, y, y === T - 1 ? BLOCK_INK.ink : y === FACE_ROW ? BLOCK_INK.faceL : BLOCK_INK.face)
      for (const x of [5, 10]) for (let y = FACE_ROW + 1; y < T - 1; y++) set(x, y, BLOCK_INK.faceD)
      for (let y = 0; y < T; y++) { set(0, y, BLOCK_INK.ink); set(T - 1, y, BLOCK_INK.ink) }
    }
  }
  const [out, inn] = (up ? CUT : LINE)[face][shape]
  for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
    const du = x + 0.5 - mid
    const dv = y + 0.5 - cy
    const d = reach(shape, face, du, dv)
    const line = !up && face === 'iso' && shape === 'square' ? isoSquareLine(du, dv) : d <= out && d > inn
    if (line) set(x, y, up ? BLOCK_INK.cut : BLOCK_INK.floor)
    else if (up && d <= inn && d > inn - 1) set(x, y, BLOCK_INK.groove)
  }
  return px
}
