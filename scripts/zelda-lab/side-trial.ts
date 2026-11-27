/**
 * The side view's trial room (`MapDef.kind` 'side', docs/games/neon-shrine.md "The side view"): a fixture, not in
 * `WORLD`. Played by `tests/zelda-side.test.mjs`, measured and shot by `side-measure.mjs` and `side-shot.mjs`
 * (which hands the map to the running shell). Two rooms, one above the other:
 *
 *   THE PIT (below, 16 × 12): a floor, a gap of three tiles over a fall, a blob, a ledge three tiles up with a
 *     chest on it, a sentry on a platform three over that, and a ladder up.
 *   THE LOFT (above, 16 × 24): the ladder's top beside a safe ledge, platforms zigzagging up over a fall, a bat, a
 *     small key on a high ledge and the locked door it opens.
 */
import type { MapDef, World } from '../../themes/zelda/types'

export const SIDE_TRIAL: MapDef = {
  id: 'sidetrial',
  name: 'THE SIDE TRIAL',
  kind: 'side',
  track: 'dungeon',
  keyring: 'sidetrial',
  cell: { w: 16, h: 12 },
  cells: { '0,0': { name: 'THE LOFT', tall: 2 }, '0,2': { name: 'THE PIT' } },
  rows: [
    // THE LOFT: rows 0–23
    '################',
    '#..#...........#',
    '#..#...........#',
    '#..#...........#',
    '#..#....4.....5#',
    '#..#.........###',
    '#..L...........#',
    '#7.L...........#',
    '######...¯¯¯...#',
    '#..............#',
    '#..............#',
    '#.....¯¯¯......#',
    '#..............#',
    '#..............#',
    '#.¯¯¯..........#',
    '#..............#',
    '#..............#',
    '#.....¯¯¯......#',
    '#..............#',
    '#..........6...#',
    '#.........¯¯¯Ħ¯#',
    '#............Ħ.#',
    '#............Ħ.#',
    '#............Ħ.#',
    // THE PIT: rows 24–35
    '#############Ħ##',
    '#............Ħ.#',
    '#....2.......Ħ.#',
    '#..¯¯¯¯¯¯¯¯..Ħ.#',
    '#............Ħ.#',
    '#............Ħ3#',
    '#..........#####',
    '#..........#####',
    '#.@......1.#####',
    '#####...########',
    '#####...########',
    '#####...########',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'start', dir: 'right' } },
    '1': { ent: { t: 'enemy', kind: 'blob', once: 'sidetrial.blob' } },
    '2': { ent: { t: 'enemy', kind: 'sentry', dir: 'left', once: 'sidetrial.sentry' } },
    '3': { ent: { t: 'chest', id: 'sidetrial.bits', item: 'bits20' } },
    '4': { ent: { t: 'enemy', kind: 'bat', once: 'sidetrial.bat' } },
    '5': { ent: { t: 'item', id: 'sidetrial.key', item: 'smallKey' } },
    '6': { ent: { t: 'ledge' } },
    '7': { ent: { t: 'chest', id: 'sidetrial.prize', item: 'heartPiece' } },
  },
}

/** A world of the trial room alone: what the test and the lab start a game in. */
export const SIDE_LAB: World = { maps: { sidetrial: SIDE_TRIAL }, start: { map: 'sidetrial', entry: 'start' } }
