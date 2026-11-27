/**
 * THE ECHO BARROW (map `echobarrow`): the hidden folk's hall under THE MOUNDS of Seter Fell, where every call comes
 * back (docs/worlds/atlas.md, "The Echo Barrow"). A 3×3 grid of 16×12 camera rooms on a keyring of its own; the
 * ninth cell is rock. Both views.
 *
 *   (0,0) THE ANSWERING ROOM   (1,0) THE PARROT       (2,0) THE SHIELD HALL
 *   (0,1) MIXTRAL'S ROOM       (1,1) THE HALL (hub)   (2,1) THE CROSSING
 *         rock                 (1,2) THE PORCH        (2,2) THE TURNING STONES
 *
 * The route: the porch, east to the Turning Stones (small key A); the hall, west (A) to Mixtral, who guards THE
 * ECHO; north of it the Answering Room (small key B, behind a gate that is open only while its plate is held); the
 * hall's east way, whose shutter opens to whoever holds the echo, and its lock (B); the Crossing; the Shield Hall
 * (two knights; the Big Key, and a lever for the short way back); the great lock north of the hall.
 *
 * - The look is `wild` (its chart inks, its fireflies). No look repaints a dungeon's floor or walls in either view,
 *   so the turf is laid as tiles: the terrain's turf (`в`, flat here: the map has no heights), grass in the 8-bit
 *   view and moss in the isometric one, grown in from the walls round the Shrine's old stone and pillars (`I`).
 * - No foe in the porch, the hall or the two puzzle rooms (the Answering Room, the Crossing).
 * - The hall's east shutter is what keeps key A for the west door: a hero who could spend it east would be stuck,
 *   with key B lying behind the west door.
 */
import type { MapDef } from '../types'
import { joinCells, ROCK } from './cells'

const ANSWERING = [
  '################',
  '#вв.......#....#',
  '#в........#..вв#',
  '#.........#..2.#',
  '#.....вв..#....#',
  '#....ввв..a....#',
  '#.....в...X....#',
  '#.........#....#',
  '#.kp......#...в#',
  '#.......вв#..вв#',
  '#вв....ввв#.ввв#',
  '#######..#######',
]

const PARROT = [
  '################',
  '#вввв......вввв#',
  '#вI..........Iв#',
  '#в.&..........в#',
  '#.....вzвв.....#',
  '#....вв..вв....#',
  '#....ввu.вв....#',
  '#.....вввв.....#',
  '#в..........&.в#',
  '#вI..........Iв#',
  '#вввв......вввв#',
  '#######.?#######',
]

const SHIELD = [
  '################',
  '#вв..........вв#',
  '#в.I...5....I.в#',
  '#..............#',
  '#....N....Q....#',
  '#......вв......#',
  '#.....вввв.....#',
  '#в.....вв.....в#',
  '#в.I........I.в#',
  '#вв...........в#',
  '#вв........7...#',
  '#####yX######yX#',
]

const MIXTRAL_ROOM = [
  '#######eX#######',
  '#ввв........ввв#',
  '#вв..........вв#',
  '#в............в#',
  '#..............#',
  '#..m...........g',
  '#......4.......X',
  '#..............#',
  '#в............в#',
  '#вв..........вв#',
  '#ввв........ввв#',
  '################',
]

const HALL = [
  '#######KK#######',
  '#вв..........вв#',
  '#в.I........I.в#',
  '#...o......o...#',
  '#.....вввв.....#',
  'L....вввввв....#',
  'L....вввввв....#',
  '#.....вввв....##',
  '#.............8L',
  '#в............XL',
  '#ввo.........в##',
  '#######..#######',
]

// The way north: the cyan row (down while the crystals are pink, as they start), two rows of ground, the pink row.
// The switch lies out of the blade's reach of anything past the first row. East of the wall, the short way back down.
const CROSSING = [
  '#####..######6X#',
  '#вв...!...вв#..#',
  '#в.........в#..#',
  '#PPPPPPPPPPP#..#',
  '#....вв.....#вв#',
  '#...вв......#в.#',
  '#CCCCCCCCCCC#..#',
  '#в.........в#..#',
  '...............#',
  '..............в#',
  '#вв...c.....ввв#',
  '################',
]

const PORCH = [
  '#######..#######',
  '#ввв........ввв#',
  '#ввI........Iвв#',
  '#вв..........вв#',
  '#в............в#',
  '#...............',
  '#...............',
  '#в............в#',
  '#вв..h.....I..в#',
  '#ввв........ввв#',
  '#вввв..@...вввв#',
  '#######VV#######',
]

// A wall of square blocks, then one of diamond blocks, to the chest; below the chest, three rows of them in turn,
// one row of ground between each, to the heart piece.
const STONES = [
  '################',
  '#вв.□...◇....вв#',
  '#в..□.9.◇..1..в#',
  '#...□...◇......#',
  '#.j.□...◇......#',
  '....□...#□□□□□□#',
  '....□...#......#',
  '#...□...#◇◇◇◇◇◇#',
  '#вв.□...#......#',
  '#вв.□.0.#□□□□□□#',
  '#ввв□вв.#в.3..в#',
  '################',
]

export const ECHOBARROW: MapDef = {
  id: 'echobarrow',
  name: 'THE ECHO BARROW',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'wild',
  views: ['iso', 'classic'],
  keyring: 'echobarrow',
  crystal: 'echobarrow',
  // A reload in here stays in here, at the porch (not `away`: no chart of the world, no land's marks).
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE ANSWERING ROOM' },
    '1,0': {
      name: 'THE PARROT',
      stair: 'parrot',
      track: 'boss',
      events: [
        { when: { notFlag: 'parrot' }, lines: ['THE STOCHASTIC PARROT. IT HAS HEARD EVERYTHING. IT HAS UNDERSTOOD NONE OF IT.'], set: 'echobarrow.parrot.met' },
        { when: { flag: 'parrot' }, lines: ['(THE HALL IS QUIET. YOUR OWN HELLO COMES BACK, ONCE, AND STOPS.)'], set: 'echobarrow.parrot.quiet' },
      ],
    },
    '2,0': { name: 'THE SHIELD HALL', stair: 'crossing' },
    '0,1': {
      name: 'MIXTRAL\'S ROOM',
      events: [{ when: { notFlag: 'echobarrow.mixtral' }, lines: ['MIXTRAL. EIGHT OPINIONS AND ONE HEADACHE.'], set: 'echobarrow.mixtral.met' }],
    },
    '1,1': { name: 'THE HALL' },
    '2,1': { name: 'THE CROSSING' },
    '1,2': { name: 'THE PORCH' },
    '2,2': { name: 'THE TURNING STONES' },
  },
  rows: joinCells([
    [ANSWERING, PARROT, SHIELD],
    [MIXTRAL_ROOM, HALL, CROSSING],
    [ROCK, PORCH, STONES],
  ]),
  marks: {
    '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
    // The two stairs of the way: walking into the Shield Hall or the Parrot's room from the south makes these the
    // continue point (`CellDef.stair`): just north of the Crossing, and in the great lock's doorway.
    '!': { ent: { t: 'entry', id: 'crossing', dir: 'up' } },
    '?': { ent: { t: 'entry', id: 'parrot', dir: 'up' } },
    V: { tile: 'D', ent: { t: 'warp', to: 'seterfell', entry: 'echobarrow' } },
    h: { ent: { t: 'sign', lines: ['(SOMEBODY SHOUTED HELLO IN HERE, LONG AGO. IT IS STILL GOING ROUND.)'] } },
    j: { ent: { t: 'sign', lines: ['SOME STONES ARE ONLY THERE FROM ONE SIDE. TURN AND LOOK.'] } },
    k: { ent: { t: 'sign', lines: ['THE DOOR OPENS FOR WHOEVER STANDS HERE. IT DOES NOT ASK WHO.'] } },
    // The Turning Stones: small key A, and the heart piece behind the harder stagger.
    '1': { ent: { t: 'chest', id: 'echobarrow.key1', item: 'smallKey' } },
    '3': { ent: { t: 'item', id: 'echobarrow.heart', item: 'heartPiece' } },
    '9': { ent: { t: 'enemy', kind: 'bat' } },
    '0': { ent: { t: 'enemy', kind: 'skull' } },
    // The hall's east way: a shutter before the lock, opened to whoever holds the echo.
    '8': { tile: 'X', ent: { t: 'gate', open: { item: 'echo' } } },
    // Mixtral: the room shuts behind the hero, both ways; its fall opens them and the chest appears.
    m: { ent: { t: 'enemy', kind: 'mixtral', once: 'echobarrow.mixtral', dir: 'right' } },
    g: { tile: 'X', ent: { t: 'gate', trap: true } },
    e: { tile: 'X', ent: { t: 'gate', trap: true } },
    '4': { ent: { t: 'chest', id: 'echobarrow.echo', item: 'echo', big: true, appear: { flag: 'echobarrow.mixtral' } } },
    // The Answering Room: the plate holds the gate; the chest behind it holds the gate open for good.
    p: { tile: 'θ', ent: { t: 'plate', id: 'echobarrow.answer' } },
    a: { tile: 'X', ent: { t: 'gate', open: { plates: ['echobarrow.answer'] }, latch: { flag: 'chest:echobarrow.key2' } } },
    '2': { ent: { t: 'chest', id: 'echobarrow.key2', item: 'smallKey' } },
    // The Crossing's end of the short way back: the Shield Hall's lever, once both knights are down.
    '6': { tile: 'X', ent: { t: 'gate', open: { flags: ['echobarrow.lever', 'echobarrow.shield1', 'echobarrow.shield2'] } } },
    // The Shield Hall.
    y: { tile: 'X', ent: { t: 'gate', trap: true } },
    N: { ent: { t: 'enemy', kind: 'knight', once: 'echobarrow.shield1', dir: 'down' } },
    Q: { ent: { t: 'enemy', kind: 'knight', once: 'echobarrow.shield2', dir: 'down' } },
    '5': { ent: { t: 'chest', id: 'echobarrow.bigkey', item: 'bigKey', big: true, appear: { flags: ['echobarrow.shield1', 'echobarrow.shield2'] } } },
    '7': { tile: '}', ent: { t: 'lever', flag: 'echobarrow.lever' } },
    // The Parrot's room: the Parrot, two pots on their stands, and the Weight, which lies where the Parrot fell (after
    // a reload: where it is marked, in the middle).
    z: { tile: 'в', ent: { t: 'enemy', kind: 'parrot', once: 'parrot' } },
    u: { tile: 'в', ent: { t: 'item', id: 'echobarrow.weight', item: 'weightMeaning', appear: { flag: 'parrot' }, atFall: true } },
    '&': { tile: 'o', ent: { t: 'stand' } },
  },
}

/** This map by id (`lands.ts` collects it into the world). */
export const MAPS: Record<string, MapDef> = { echobarrow: ECHOBARROW }
