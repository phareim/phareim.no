/**
 * The Puzzle Lab (map `puzzlelab`): six rooms, each teaching one of the
 * physical puzzles (`engine/puzzles/`), and a last one that needs four of them
 * together, ending in a chest. Not linked from the world yet: it is entered at
 * `puzzlelab:start` (the lab's shot scenes and the tests go there directly).
 *
 *   F final  ← E sluice ← D boulder
 *                           ↑
 *   A weights → B ice  → C beams
 *
 * A: a heavy plate the hero alone is too light for (carry a pot onto it).
 * B: ice; slide the block onto the heavy plate across the lake.
 * C: a prism splits the beam; turn both mirrors toward the receivers.
 * D: throw the lever: the boulder rolls, breaks the cracked wall, fills the pit.
 * E: two valves, two basins: one drains as the other floods.
 * F: the boulder opens the beam's way; slide the mirror over the ice into it and turn it to the receiver.
 */
import type { MapDef } from '../types'
import { joinCells } from './cells'

const A = [
  '################',
  '#..............#',
  '#..............#',
  '#..............#',
  '#...o.o........#',
  '#..........H...1',
  '#..............X',
  '#...o..........#',
  '#..............#',
  '#......@.......#',
  '#..............#',
  '################',
]

const B = [
  '################',
  '#...#..........#',
  '#.ααααααααααJ..#',
  '#.ααααααααααα..#',
  '#.ααbαααααααα..#',
  '...αααααααααα..2',
  '...αααααααααα..X',
  '#.ααααααααααα..#',
  '#..............#',
  '#..............#',
  '#..............#',
  '################',
]

const C = [
  '#######3X#######',
  '#u............v#',
  '#.......k......#',
  '#..............#',
  '#μ......π.....ν#',
  '...............#',
  '...........E...#',
  '#..............#',
  '#..............#',
  '#..h...........#',
  '#..............#',
  '################',
]

const D = [
  '################',
  '...O#..........#',
  '...O%.......z..#',
  '#..O#..........#',
  '#..O#...E......#',
  '#..O#..........#',
  '#..O#.....E....#',
  '#..O#..........#',
  '#..O#.....N....#',
  '#..O#..d.......#',
  '#..O#..........#',
  '#######..#######',
]

const E = [
  '################',
  '#..AA.....WW....',
  '#..AA.....WW....',
  '#..AA.....WW...#',
  '...AA.....WW...#',
  '...AA.....WW...#',
  '#..AA.....WW.m.#',
  '#..AA.....WW...#',
  '#..AA..m..WW...#',
  '#..AA.....WW.e.#',
  '#..AA.....WW...#',
  '################',
]

const F = [
  '################',
  '#...Q..........#',
  '#.U.....ααIα...#',
  '#p..%...αααα...#',
  '#.......αααα....',
  '#.......ααμα....',
  '#..............#',
  '#..........#####',
  '#.........y#.9.#',
  '#..j.......6...#',
  '#..........#...#',
  '################',
]

export const PUZZLELAB: MapDef = {
  id: 'puzzlelab',
  name: 'THE PUZZLE LAB',
  kind: 'dungeon',
  track: 'dungeon',
  views: ['iso', 'classic'],
  keyring: 'puzzlelab',
  cell: { w: 16, h: 12 },
  rows: joinCells([[F, E, D], [A, B, C]]),
  cells: {
    '0,1': { name: 'THE WEIGH HOUSE' },
    '1,1': { name: 'THE COLD ROOM' },
    '2,1': { name: 'THE MIRROR ROOM' },
    '2,0': { name: 'THE STONE RUN' },
    '1,0': { name: 'THE SLUICE HALL' },
    '0,0': { name: 'THE LAST ROOM' },
  },
  marks: {
    '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
    // A: weights
    H: { ent: { t: 'plate', id: 'lab.a.heavy' }, tile: 'η' },
    '1': { ent: { t: 'gate', open: { plates: ['lab.a.heavy'] } } },
    // B: ice
    J: { ent: { t: 'plate', id: 'lab.b.heavy' }, tile: 'η' },
    '2': { ent: { t: 'gate', open: { plates: ['lab.b.heavy'] } } },
    // C: beams
    h: { ent: { t: 'sign', lines: ['THE MIRROR ROOM. TWO EYES IN THE WALL HAVE BEEN WAITING A LONG TIME FOR THE LIGHT.'] } },
    k: { ent: { t: 'emitter', dir: 'down' } },
    u: { ent: { t: 'receiver', flag: 'lab.c.a' } },
    v: { ent: { t: 'receiver', flag: 'lab.c.b' } },
    '3': { ent: { t: 'gate', open: { flags: ['lab.c.a', 'lab.c.b'] } } },
    E: { ent: { t: 'enemy', kind: 'blob' } },
    // D: the rolling stone
    d: { ent: { t: 'sign', lines: ['THE STONE RUN. THE STONE HAS ONE ROAD AND NO MANNERS.'] } },
    z: { ent: { t: 'boulder', dir: 'left', flag: 'lab.d.roll' } },
    N: { ent: { t: 'lever', flag: 'lab.d.roll' } },
    // E: sluices
    e: { ent: { t: 'sign', lines: ['THE SLUICE HALL. TWO BASINS SHARE ONE TIDE, AND NEITHER SHARES NICELY.'] } },
    W: { ent: { t: 'sluice', flag: 'lab.e.tide' } },
    A: { ent: { t: 'sluice', flag: 'lab.e.tide', invert: true } },
    m: { ent: { t: 'valve', flag: 'lab.e.tide' } },
    // F: all together
    j: { ent: { t: 'sign', lines: ['THE LAST ROOM. ALL OF THE ABOVE, AT ONCE.'] } },
    Q: { ent: { t: 'boulder', dir: 'down', flag: 'lab.f.roll' } },
    U: { ent: { t: 'lever', flag: 'lab.f.roll' } },
    p: { ent: { t: 'emitter', dir: 'right' } },
    y: { ent: { t: 'receiver', flag: 'lab.f.lit' } },
    '6': { ent: { t: 'gate', open: { flag: 'lab.f.lit' } } },
    '9': { ent: { t: 'chest', id: 'puzzlelab.prize', item: 'bits50', big: true } },
  },
}
