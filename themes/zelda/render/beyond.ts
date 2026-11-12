/**
 * What lies beyond an outdoor map's edge. Pure: reads tile chars only.
 *
 * A map is a rectangle, and the classic camera never looks past it. A view
 * that turns the world (the 16-bit one) does: the rectangle becomes a
 * diamond, and round it there must be more world, or the land reads as a
 * board on a table. So the edge goes on: where the map ends in sea the sea
 * runs out to the horizon, where it ends in rock the rock is a massif behind
 * the map and a cliff over the sea in front of it, a road that leaves the map
 * keeps going, and everything else is woods. The
 * line between two of these (a coast, the foot of the rock) wanders a little
 * more the further out it is, so it does not run off as a ruled line.
 *
 * A painter asking for a neighbour across the map's edge is given the same
 * answer, so the map's last row is drawn for what lies next to it: sea runs
 * on without a shore, and rock over the sea shows its face.
 */
import type { TileChar } from '../types'

/** How many tiles of land a view may draw outside an outdoor map. */
export const BEYOND = 24

const isWall = (t: TileChar | undefined) => t === '#' || t === '%' || t === '^'

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Smooth noise, 0..1, one cell to `size` tiles. */
function smooth(x: number, y: number, size: number, salt: number): number {
  const fx = x / size
  const fy = y / size
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const u = fx - x0
  const v = fy - y0
  const su = u * u * (3 - 2 * u)
  const sv = v * v * (3 - 2 * v)
  const a = hash(x0 + salt * 57, y0)
  const b = hash(x0 + 1 + salt * 57, y0)
  const c = hash(x0 + salt * 57, y0 + 1)
  const d = hash(x0 + 1 + salt * 57, y0 + 1)
  return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv
}

/**
 * The tile at (x, y) outside a w × h map (inside it: the map's own tile).
 * One of '~' (sea), '#' (rock), ',' (a road going on) and 'T' (woods).
 */
export function beyondTile(tiles: readonly TileChar[], w: number, h: number, x: number, y: number): TileChar {
  if (x >= 0 && y >= 0 && x < w && y < h) return tiles[y * w + x]!
  const cx = Math.max(0, Math.min(w - 1, x))
  const cy = Math.max(0, Math.min(h - 1, y))
  // A road runs straight on.
  if (tiles[cy * w + cx] === ',' && (cx === x || cy === y)) return ','
  // How far out, and how much the borders may wander there: not at all beside the map.
  const d = Math.max(cx - x, x - cx, cy - y, y - cy)
  const amp = Math.min(4, (d - 1) * 0.55)
  const sx = Math.round((smooth(x, y, 5, 1) * 2 - 1) * amp)
  const sy = Math.round((smooth(x, y, 5, 2) * 2 - 1) * amp)
  const t = tiles[Math.max(0, Math.min(h - 1, y + sy)) * w + Math.max(0, Math.min(w - 1, x + sx))]
  if (t === '~') return '~'
  // Rock behind the map (north and west of it, as the turned view sees the land) is a massif. Rock in front of
  // it would be a bare tabletop between the viewer and the walking, so there the land ends in a cliff, and
  // the sea lies under it.
  if (isWall(t)) return x >= w || y >= h ? '~' : '#'
  return 'T'
}

/**
 * How many tiles tall the rock stands at (x, y) outside the map: one beside
 * the map, as the map's own rock is, and up to three in rising, uneven steps
 * further out.
 */
export function massifHeight(w: number, h: number, x: number, y: number): number {
  const d = Math.max(-x, x - (w - 1), -y, y - (h - 1), 0)
  return Math.max(1, Math.min(3, 1 + Math.floor((d - 3 + smooth(x, y, 4, 3) * 5) / 3)))
}
