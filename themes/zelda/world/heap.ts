/**
 * THE HEAP (docs/games/neon-shrine-heap.md): the scrapyard under the Underglow's own missing end, where the Delvers'
 * Union tipped everything it could not sell. Behind a hollow wall at the east of THE RAILS (`underglow1`), which a
 * bomb opens. Two maps on the Underglow's keyring; its treasure is THE MAGNET (`engine/magnet.ts`).
 *
 *   heap1  THE HEAP (4 × 2 rooms; the north-east and south-west corners are rock)
 *     (0,0) the hollow: stairs up        (1,0) the sorting floor: THE MAGNET   (2,0) the strongroom: a cart, the key
 *     (1,1) the line: bats, the bridge   (2,1) the pump house: stairs down     (3,1) the dark shift: the Big Key
 *
 *   heap2  THE FOOT OF THE HEAP (2 × 1 rooms)
 *     (0,0) the foot: stairs up, the Big Key's door          (1,0) the heap
 *
 * The way is a line east: the Magnet on the sorting floor's near bank; across by a bolt, or a crate pulled onto a
 * plate; the strongroom's cart sent down its rail for the small key; back over the pit by a bolt and down to the line;
 * across the line by a bolt to the lever that lets the drawbridge down; the key's door to the pump house.
 *
 * Every room is laid so that the hook, which every hero here owns, skips none of the Magnet's crossings: no post,
 * pillar, torch or chest stands where it would carry the hero over, and the bridge's lever stands behind a stub of
 * wall, out of the hook's line and the disc's reach.
 *
 * Entries: `door` (the hollow), `stair` (the pump house), `down` (the foot). Marker chars are listed in each `marks`.
 */
import type { Dir, IsoLandmark, MapDef, Mark } from '../types'
import { ROCK, joinCells } from './cells'
import { at, cycle, light, prop } from './scenery'

const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })
const entry = (id: string, dir: Dir = 'down'): Mark => ({ ent: { t: 'entry', id, dir } })
const stairs = (to: string, id: string): Mark => ({ tile: '>', ent: { t: 'warp', to, entry: id } })
const rail = (len: number, tile?: Mark['tile']): Mark => (tile ? { tile, ent: { t: 'rail', len, dir: 'right' } } : { ent: { t: 'rail', len, dir: 'right' } })
const pad = (dir: Dir): Mark => ({ ent: { t: 'pad', dir } })
const bats: Mark = { ent: { t: 'enemy', kind: 'bat' } }
/** Broken things in the heaps, glinting. */
const shards = (n: 0 | 1, x: number, y: number): IsoLandmark => prop(`underglow_shards_${n}`, x + 0.5, y + 0.5)

// ====================================================================== heap1: THE HEAP

const HOLLOW = [
  '################',
  '#tV.....:....oo#',
  '#.@..........o.#',
  '#....##........#',
  '#o.............#',
  '#..6............',
  '#...............',
  '#..............#',
  '#..............#',
  '#..............#',
  '#t............t#',
  '################',
]

const SORTING = [
  '################',
  '#...OO.#.....oo#',
  '▧..8OO.▧.......#',
  '#...OO.#.......#',
  '#.m.OO.#.......#',
  '....OO.g........',
  '....OO.X........',
  '#...OO.#.......#',
  '#.8pOO▣#.......#',
  '#1..OO.#.......#',
  '#...OO.#.....o.#',
  '##..############',
]

const STRONGROOM = [
  '################',
  '#t............t#',
  '#.7.........d..#',
  '#..............#',
  '#2.............#',
  '...............#',
  '.......9....9..#',
  '####...........#',
  '#k.j...........#',
  '#..X...........#',
  '####..........t#',
  '################',
]

const LINE = [
  '##..############',
  '#.....OOOO.....#',
  '#.....Oh.▧.....#',
  '#.3...OO.O.▧...#',
  '#.....OOOO.....#',
  '#.....uXXX.....L',
  '#.....XXXX.....L',
  '#...a.OOOO.....#',
  '#.....OOOO.▧...#',
  '#.....OOOO.....#',
  '#...a.OOOO.#.y.#',
  '################',
]

const PUMP_HOUSE = [
  '################',
  '#~~~~~~~~~~#.Ev#',
  '#...▣..........#',
  '#...▣..........#',
  '#...▣..........#',
  '................',
  '................',
  '#..............#',
  '#.4............#',
  '#..............#',
  '#..............#',
  '################',
]

const DARK_SHIFT = [
  '################',
  '#..............#',
  '#..............#',
  '#...##.....##..#',
  '#...##.....##..#',
  '.............Q.#',
  '...............#',
  '#..............#',
  '#...##.....##..#',
  '#...##.....##..#',
  '#..............#',
  '################',
]

export const HEAP1: MapDef = {
  id: 'heap1',
  name: 'THE HEAP',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'quarry',
  realm: 'underglow',
  views: ['iso'],
  keyring: 'underglow',
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE HOLLOW', events: [{ lines: ['(THE RAILS GO ON IN HERE. SOMETHING HAS SORTED THE SCRAP FOR YEARS. BADLY.)'], set: 'heap1.hollow' }] },
    '1,0': { name: 'THE SORTING FLOOR' },
    '2,0': { name: 'THE STRONGROOM' },
    '1,1': { name: 'THE LINE' },
    '2,1': { name: 'THE PUMP HOUSE' },
    '3,1': { name: 'THE DARK SHIFT' },
  },
  rows: joinCells([
    [HOLLOW, SORTING, STRONGROOM, ROCK],
    [ROCK, LINE, PUMP_HOUSE, DARK_SHIFT],
  ]),
  isoLandmarks: [
    // The hollow: the first of the sorting, and the Delvers' last glowstick.
    shards(0, 11, 2), shards(1, 7, 8),
    prop('underglow_glowstick_gold', 4.45, 1.5, { lights: [light('gold', 2.6, 0.85, { z: 0.5, anim: 'pulse' })] }),
    shards(1, 29, 1), shards(0, 45, 9),
    // The pump house: the pump, still standing in what it was meant to drain.
    prop('tank', 38.5, 13.5, { ...at(38, 13), motion: cycle(2, 1.2), lights: [light('cyan', 2, 0.6, { z: 0.8 })] }),
  ],
  marks: {
    V: stairs('underglow1', 'heap'),
    '@': entry('door'),
    '6': rail(12),
    m: { ent: { t: 'chest', id: 'heap1.magnet', item: 'magnet', big: true } },
    '1': sign('SORTING FLOOR.\nIRON TO THE LEFT.\nTHE REST: ALSO LEFT.'),
    '8': pad('right'),
    p: { ent: { t: 'plate', id: 'heap1.sort' } },
    g: { tile: 'X', ent: { t: 'gate', open: { plates: ['heap1.sort'] } } },
    '2': sign('STRONGROOM.\nEVERYTHING HERE IS SIGNED FOR.\nNOBODY CAN FIND THE PEN.'),
    '7': rail(11, '▦'),
    d: { ent: { t: 'plate', id: 'heap1.safe' } },
    '9': pad('left'),
    j: { tile: 'X', ent: { t: 'gate', open: { plates: ['heap1.safe'] } } },
    k: { ent: { t: 'chest', id: 'heap1.key', item: 'smallKey' } },
    '3': sign('THE LINE.\nPLEASE MIND THE GAP.\nTHE GAP MINDS YOU BACK.'),
    h: { ent: { t: 'item', id: 'heap1.piece', item: 'heartPiece' } },
    u: { tile: 'X', ent: { t: 'gate', open: { flag: 'heap1.bridge' } } },
    y: { ent: { t: 'lever', flag: 'heap1.bridge' } },
    a: bats,
    '4': sign('PUMP HOUSE.\nNO FLOODING.\n(IT IS FLOODED.)'),
    v: stairs('heap2', 'down'),
    E: entry('stair'),
    Q: { ent: { t: 'chest', id: 'heap1.bigkey', item: 'bigKey', appear: { clear: true } } },
  },
}

// ====================================================================== heap2: THE FOOT OF THE HEAP

const FOOT = [
  '################',
  '#tV.....oo....t#',
  '#.@............#',
  '#..............#',
  '#oo.........1..#',
  '#..............K',
  '#..............K',
  '#..............#',
  '#..............#',
  '#..:........:..#',
  '#t............t#',
  '################',
]

const THE_HEAP = [
  '################',
  '#....5....6....#',
  '#..............#',
  '#..............#',
  '#.J.......U..▥.#',
  '...............#',
  '...............#',
  '#..............#',
  '#.....▤..▤.....#',
  '#....▤....▤....#',
  '#..............#',
  '################',
]

export const HEAP2: MapDef = {
  id: 'heap2',
  name: 'THE FOOT OF THE HEAP',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'quarry',
  realm: 'underglow',
  views: ['iso'],
  keyring: 'underglow',
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE FOOT' },
    '1,0': { name: 'THE HEAP', track: 'boss' },
  },
  rows: joinCells([[FOOT, THE_HEAP]]),
  isoLandmarks: [shards(0, 5, 8), shards(1, 10, 2)],
  marks: {
    V: stairs('heap1', 'stair'),
    '@': entry('down'),
    '1': sign('THE FOOT OF THE HEAP.\nTHE HEAP HAS NO TOP.\nIT HAS A MOUTH.'),
    // The two rails of the heap, each with a striped cart at its outer end, and the pads that face them.
    J: rail(4, '▥'),
    U: rail(4),
    '5': pad('left'),
    '6': pad('right'),
  },
}

/** The Heap's maps by id (`underglow.ts` takes them into the Underglow's own). */
export const HEAP_MAPS: Record<string, MapDef> = { heap1: HEAP1, heap2: HEAP2 }
