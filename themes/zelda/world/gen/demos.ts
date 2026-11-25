/**
 * The three systems' first maps, set into the frontier: the old quarry under
 * Lumenby (dig & build: the four tools are found there), the Battle Glade in
 * Sporelight (field battles) and the Puzzle Lab under Stillsand (the physical
 * puzzles). Each is a hand-made map (`world/quarry.ts`, `arena.ts`,
 * `puzzlelab.ts`); a site in its region leads down into it, and `linkBack`
 * gives the map a way back up to that site.
 */
import type { MapDef, Mark } from '../../types'
import type { Site } from './types'

export interface Demo { map: string; region: string; name: string; lines: string[] }

export const DEMOS: Demo[] = [
  { map: 'quarry', region: 'fr:2,2', name: 'THE OLD QUARRY', lines: ['THE OLD QUARRY. STAIRS DOWN.', 'WHEN THE SHIFT WHISTLE STOPPED, THE MINERS WENT HOME. THEIR TOOLS STAYED DOWN THERE.'] },
  { map: 'arena', region: 'fr:7,2', name: 'THE BATTLE GLADE', lines: ['THE BATTLE GLADE. STAIRS DOWN.', 'THEY FIGHT FAIR DOWN THERE, AND IN TURNS. MOSTLY.'] },
  { map: 'puzzlelab', region: 'fr:9,4', name: 'THE PUZZLE LAB', lines: ['THE PUZZLE LAB. STAIRS DOWN.', 'SOMEONE BUILT SIX ROOMS DOWN THERE AND LEFT THEM RUNNING. THE LIGHTS ARE STILL ON.'] },
]

/** The way down: stairs in a little rock, a sign beside them, and where you come back up. */
export const DEMO_SITES: Site[] = DEMOS.map(d => ({
  id: `demo.${d.map}`,
  region: d.region,
  rows: [
    ' ### ',
    '##D##',
    '.SE..',
    '.....',
  ],
  marks: {
    D: { ent: { t: 'warp', to: d.map, entry: 'start' }, tile: '>' },
    E: { ent: { t: 'entry', id: `from-${d.map}`, dir: 'down' }, tile: ',' },
    S: { ent: { t: 'sign', lines: d.lines } },
  } satisfies Record<string, Mark>,
}))

/**
 * A copy of a demo map with a way back to its site: the tile under its start (its south edge) becomes a warp up.
 * The start stands one tile north of the map's bottom row or two; the tiles straight below it lead out.
 */
export function linkBack(def: MapDef, demo: Demo): MapDef {
  const start = Object.entries(def.marks).find(([, m]) => m.ent.t === 'entry' && m.ent.id === 'start')
  if (!start) return def
  const y0 = def.rows.findIndex(r => r.includes(start[0]))
  const x = def.rows[y0]!.indexOf(start[0])
  const CH = ''
  const rows = def.rows.slice()
  for (let y = y0 + 1; y < rows.length; y++) {
    const r = [...rows[y]!]
    r[x] = y === rows.length - 1 ? CH : r[x] === '#' || r[x] === 'T' ? ',' : r[x]!
    rows[y] = r.join('')
  }
  return { ...def, rows, marks: { ...def.marks, [CH]: { ent: { t: 'warp', to: demo.region, entry: `from-${demo.map}` }, tile: 'D' } } }
}
