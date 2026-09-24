/**
 * Dungeon maps authored room by room: each room is its own 16×12 grid
 * (walls included) and `joinCells` lays the rooms out on the camera grid.
 * Neighbouring rooms each keep their own wall, so a doorway is open on both
 * sides (a 2-tile gap in each wall).
 */

export const CELL_W = 16
export const CELL_H = 12

/** A room of solid rock (a camera room nobody visits). */
export const ROCK: string[] = Array.from({ length: CELL_H }, () => '#'.repeat(CELL_W))

/** Rows of a dungeon map from rows of rooms. Throws on a misshapen room, so a typo fails the tests loudly. */
export function joinCells(grid: string[][][]): string[] {
  const out: string[] = []
  grid.forEach((row, cy) => {
    row.forEach((room, cx) => {
      if (room.length !== CELL_H || room.some(r => r.length !== CELL_W)) {
        const bad = room.findIndex(r => r.length !== CELL_W)
        throw new Error(`room ${cx},${cy}: want ${CELL_W}×${CELL_H}, row ${bad} is ${room[bad]?.length}, ${room.length} rows`)
      }
    })
    for (let y = 0; y < CELL_H; y++) out.push(row.map(room => room[y]).join(''))
  })
  return out
}
