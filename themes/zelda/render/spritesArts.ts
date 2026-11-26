/**
 * The art's icon (16×16, `engine/moves.ts`): on the B box and button, held up when it is learned, and on the
 * pause screen's MOVES page. Drawn from shapes, outlined in the shared dark, in the shared palette. Original designs.
 */
import { type Rows, blank, join, outline, stamp } from './spritesWildKit'

/** Fill every px of a 16×16 grid whose centre `f` gives a letter for (null: leave it). */
function paint(f: (x: number, y: number) => string | null): string[][] {
  const g = blank(16, 16)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ch = f(x + 0.5, y + 0.5); if (ch) g[y]![x] = ch }
  return g
}

/** HOP: the hop's arc back over the ground, an arrowhead where it comes down, a puff where it left. */
const itemHop: Rows = (() => {
  const curve = (x: number) => 2.6 + ((x - 9.5) / 5.2) ** 2 * 8
  const g = paint((x, y) => {
    if (x < 4.5 || x > 14.6 || y > 12) return null
    const d = Math.abs(y - curve(x)) / Math.hypot(1, (2 * 8 * (x - 9.5)) / 5.2 ** 2)
    if (d < 0.6) return x < 9.5 ? 'w' : 'c'
    if (d < 1.05) return 'C'
    return null
  })
  // The arrowhead where it comes down, pointing at the ground.
  for (const [x, y, ch] of [[1, 10, 'C'], [2, 10, 'c'], [2, 11, 'w'], [3, 11, 'w'], [3, 12, 'w'], [4, 12, 'w'], [4, 13, 'w'], [5, 12, 'w'], [6, 11, 'w'], [7, 10, 'c'], [6, 10, 'c']] as const) g[y]![x] = ch
  // A puff where the hop left the ground.
  for (const [x, y] of [[12, 14], [13, 14], [15, 13], [14, 12]] as const) g[y]![x] = 'w'
  return outline(join(g))
})()

export const ARTS_ICONS: Record<string, Rows> = {
  item_hop: itemHop,
}
