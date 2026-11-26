/**
 * The systems' first maps, set into the lands as places with a reason: the Battle Glade down a root stair in the
 * Sporelight (field battles), the Puzzle Lab inside Stillsand's gold pyramid (the physical puzzles). Each is a
 * hand-made map (`arena.ts`, `puzzlelab.ts`); the land has the way down (a warp to the map's `start`) and the entry
 * `from-<map>` beside it, and `linkBack` gives the map its way back up.
 */
import type { MapDef } from '../types'

export interface Demo { map: string; land: string }

export const DEMOS: Demo[] = [
  { map: 'arena', land: 'sporelight' },
  { map: 'puzzlelab', land: 'stillsand' },
]

/**
 * A copy of a demo map with a way back up to its land: the tile under its start (its south edge) becomes a warp.
 * The start stands one tile north of the map's bottom row or two; the tiles straight below it lead out.
 */
export function linkBack(def: MapDef): MapDef {
  const demo = DEMOS.find(d => d.map === def.id)
  if (!demo) return def
  const start = Object.entries(def.marks).find(([, m]) => m.ent.t === 'entry' && m.ent.id === 'start')
  if (!start) return def
  const y0 = def.rows.findIndex(r => r.includes(start[0]))
  const x = def.rows[y0]!.indexOf(start[0])
  // (A private-use char no map uses: the warp's marker.)
  const CH = '\uf8f1'
  const rows = def.rows.slice()
  for (let y = y0 + 1; y < rows.length; y++) {
    const r = [...rows[y]!]
    r[x] = y === rows.length - 1 ? CH : r[x] === '#' || r[x] === 'T' ? ',' : r[x]!
    rows[y] = r.join('')
  }
  return { ...def, rows, marks: { ...def.marks, [CH]: { ent: { t: 'warp', to: demo.land, entry: `from-${demo.map}` }, tile: 'D' } } }
}
