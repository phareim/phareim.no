/**
 * The battle glade: a demo of field battles (`MapDef.battle`). Four foe
 * groups of rising strength stand in a walled glade; touching one starts
 * a turn-by-turn fight where everyone stands. A chest by the way in holds
 * three neon tonics. Down the stairs at `fr:7,2` in the Sporelight
 * (`gen/demos.ts`); docs/games/neon-shrine-battle.md.
 */
import type { MapDef } from '../types'

export const ARENA: MapDef = {
  id: 'arena',
  name: 'THE BATTLE GLADE',
  kind: 'overworld',
  track: 'forest',
  look: 'wild',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TT....;;;.....TTT.......:...TTTT',
    'TT..........t..T....~~~~.....TTT',
    'TT.;.....,,,,,,,,..~~~~~~....TTT',
    'TT......,..........~~~~~~~....TT',
    'TT..r...,....:.....~~~~~~.....TT',
    'TT......,...........~~~~......TT',
    'TTT.....,......r.........;;...TT',
    'TTT.....,,,,,,,,,,,,,,,,,,,...TT',
    'TT..;;.........,.........,....TT',
    'TT..;;...:.....,....r....,....TT',
    'TT.............,.........,..:.TT',
    'TT....r........,.........,....TT',
    'TT....,,,,,,,,,,,,,,,,,,,,....TT',
    'TT..........:..,..............TT',
    'TTT.........;;.,...;;.....r...TT',
    'TTT..t.........,.........t....TT',
    'TTTT...........,......c......TTT',
    'TTTTT..........,.S..........TTTT',
    'TTTTTT.........@...........TTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
    c: { ent: { t: 'chest', id: 'arena.tonics', item: 'tonic3' } },
    S: {
      ent: {
        t: 'sign',
        lines: [
          'THE BATTLE GLADE. HERE EVERYONE WAITS THEIR TURN TO FIGHT. EVEN THE FOES.',
          'THE KNIGHT IN THE NORTH-WEST CORNER HAS NEVER LOST A FIGHT. HE MENTIONS IT OFTEN.',
        ],
      },
    },
  },
  battle: {
    track: 'boss',
    groups: [
      { id: 'arena.goo', x: 8.5, y: 16, foes: ['goo', 'goo'] },
      { id: 'arena.flit', x: 23.5, y: 12, foes: ['flitter', 'goo', 'flitter'] },
      { id: 'arena.pond', x: 18.5, y: 6.2, foes: ['zapper', 'drone', 'drone'], sight: 2.6 },
      { id: 'arena.knight', x: 6.5, y: 4.5, foes: ['knight', 'skull'], once: true, prize: 'bits50' },
    ],
  },
}
