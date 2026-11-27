/**
 * THE EXAMINATION: the test behind the Puzzle Lab in Stillsand's gold pyramid. A dungeon with no keys: four rounds,
 * each with its rule on a card at its door, a score and a pass mark (`CellDef.round`, `engine/exam.ts`), and a pass
 * is what opens the way on. Docs: docs/games/neon-shrine-examination.md.
 *
 *   marking ← r4 ← perch ← r3        and `examtop`, the Titan's hall, up the stair in the Marking Room
 *      ↓                    ↑
 *   desk   → r1 → r2   → staff
 *
 * All four rounds passed open the stair in the Marking Room; the lever there opens the short way down to the desk.
 * In the hall a trap gate shuts behind the hero while the Titan stands; two levers each send a stone down a lane.
 */
import type { Cond, EntDef, MapDef, Mark, PadPic, TalkBranch } from '../types'
import { joinCells } from './cells'

const DESK = [
  '#######..#######',
  '#[[..........[[#',
  '#[..I.....nnn.[#',
  '#..........V...#',
  '#...I..........#',
  '#...............',
  '#...............',
  '###............#',
  '##<@...........#',
  '###..........Y.#',
  '#.............Y#',
  '################',
]

const R1 = [
  '################',
  '#.......p....k.#',
  '#..p.....zOO..##',
  '#.....p.......h#',
  '!.............n#',
  '.1........sO...5',
  '.....k.....O...X',
  '#........d.....#',
  '#..p..p........#',
  '#.........yOO..#',
  '#.k.....p....z.#',
  '################',
]

const R2 = [
  '################',
  '#..............#',
  '#.E..A..J..A..##',
  '#.............h#',
  '?.............n#',
  '..A..N..f..U...6',
  '.2.............X',
  '#..............#',
  '#.A..U..A..E...#',
  '#..............#',
  '#..............#',
  '################',
]

const STAFF = [
  '#######7X#######',
  '#[[............#',
  '#..Q.........I.#',
  '#....c.........#',
  '#...........I..#',
  '.......vvv.....#',
  '.......vjv.....#',
  '#......vvv.....#',
  '#..............#',
  '#...I........I.#',
  '#[[............#',
  '################',
]

const ROUND3 = [
  '################',
  '#.g..........g.#',
  '##..e......e...#',
  '#h..###..###...#',
  '#n..........y..#',
  '8..y...g.......#',
  'X..............#',
  '#...###..###...#',
  '#.g.........g..#',
  '#..............#',
  '#......3.].....#',
  '#######..#######',
]

const PERCH = [
  '################',
  '##....IwI.....##',
  '#..............#',
  '#..............#',
  '#..............#',
  '0...............',
  'X...............',
  '#..............#',
  '#..............#',
  '#..............#',
  '##............##',
  '################',
]

const ROUND4 = [
  '################',
  '#.........WG...#',
  '##.............#',
  '#h.............#',
  '#n..p.q........=',
  '9.............4.',
  'X........b.....#',
  '#...p..........#',
  '#........P.P...#',
  '#.........C....#',
  '#..............#',
  '################',
]

const MARKING = [
  '################',
  '#.....#u#......#',
  '#.....#&#......#',
  '#..H...m..K....#',
  '#..............#',
  '#...............',
  '#...............',
  '#..............#',
  '#..............#',
  '#....}.........#',
  '#..............#',
  '#######$X#######',
]

const HALL = [
  '################',
  '###..A....B..###',
  '##......wT....##',
  '4..............5',
  '#..............#',
  '#..............#',
  '#.p..........p.#',
  '#..............#',
  '#..............#',
  '##............##',
  '###.....2....###',
  '########1#######',
]

const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })
const entry = (id: string, dir: 'up' | 'down' | 'left' | 'right'): Mark => ({ ent: { t: 'entry', id, dir } })
const gate = (open: Cond): Mark => ({ ent: { t: 'gate', open } })
const foe = (kind: Extract<EntDef, { t: 'enemy' }>['kind']): Mark => ({ ent: { t: 'enemy', kind } })
/** A pane of round two's board: two tiles square from its mark. */
const pane = (pic: PadPic): Mark => ({ ent: { t: 'pad', pic, size: 2 } })
/** A pond tile: full of water (nothing in the world drains it). */
const water: Mark = { tile: 'ω', ent: { t: 'sluice', flag: 'examination.pond' } }
/** The pond's middle: a float plate, held by what floats on it. */
const middle: Mark = { tile: 'ω', ent: { t: 'sluice', flag: 'examination.pond', float: 'exam.pond' } }

const INVIGILATOR: TalkBranch[] = [
  { when: { flags: [], not: ['exam.met'] }, lines: ['INVIGILATOR: RULES ARE ON THE DOORS. I DO NOT REPEAT THEM.'], set: 'exam.met' },
  // (`engine/exam.ts` reads the flag and clears it: every round short of full marks is sat again.)
  { lines: ['INVIGILATOR: A RESIT. PENS UP. THE ROOMS ARE NEW.'], set: 'exam.resit' },
]

export const EXAMINATION: MapDef = {
  id: 'examination',
  name: 'THE EXAMINATION',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'dune',
  ambient: 'sandstone',
  realm: 'stillsand',
  views: ['iso'],
  keyring: 'examination',
  physics: true,
  resume: true,
  cell: { w: 16, h: 12 },
  rows: joinCells([[MARKING, ROUND4, PERCH, ROUND3], [DESK, R1, R2, STAFF]]),
  cells: {
    '0,1': { name: 'THE FRONT DESK' },
    '1,1': { name: 'ROUND ONE', round: { id: 'r1', entry: 'r1', pass: 6, max: 10, rule: 'noBlade', foeWorth: 2 } },
    '2,1': { name: 'ROUND TWO', round: { id: 'r2', entry: 'r2', pass: 10, max: 12, foeWorth: 2 } },
    '3,1': { name: 'THE STAFF ROOM' },
    '3,0': { name: 'ROUND THREE', round: { id: 'r3', entry: 'r3', pass: 6, max: 10, rule: 'still', penalty: { hurt: 2 } } },
    '2,0': {
      name: 'THE PERCH',
      events: [
        { when: { flags: [], not: ['examination.falcon'] }, set: 'examination.falcon.card', lines: ['FALCON. SLIGHTLY DEAF. NEVER WRONG.'] },
        { when: { flag: 'examination.falcon' }, set: 'examination.falcon.down', lines: ['(THE FALCON SITS IN THE SAND. IT STILL THINKS IT WAS RIGHT.)'] },
      ],
    },
    '1,0': { name: 'ROUND FOUR', round: { id: 'r4', entry: 'r4', pass: 8, max: 10, penalty: { shatter: 2 } } },
    '0,0': { name: 'THE MARKING ROOM' },
  },
  marks: {
    // The Front Desk: the stair back to the Lab, and who minds the desk.
    '<': { tile: '>', ent: { t: 'warp', to: 'puzzlelab', entry: 'from-exam' } },
    '@': entry('desk', 'right'),
    V: { ent: { t: 'npc', id: 'examination.invigilator', look: 'gardenbot', talk: INVIGILATOR } },
    // Round one: no blade. Pots and stones that come back, pits to drop a foe in.
    '!': sign('ROUND ONE. NO BLADE. CLEAR THE ROOM.'),
    '1': entry('r1', 'right'),
    p: { ent: { t: 'stand', wait: 5 } },
    k: { tile: 'r', ent: { t: 'stand', wait: 5 } },
    z: foe('blob'),
    s: foe('skull'),
    y: foe('sentry'),
    d: foe('dasher'),
    h: { ent: { t: 'pad', handin: true } },
    '5': gate({ flag: 'exam.r1' }),
    // Round two: the board on the floor, and the cactus that walks.
    '?': sign('ROUND TWO. PROVE YOU ARE NOT A MACHINE. STAND ON EACH CACTUS.'),
    '2': entry('r2', 'right'),
    A: pane('cactus'),
    E: pane('palm'),
    J: pane('stone'),
    N: pane('cloud'),
    U: pane('bones'),
    f: foe('spitter'),
    '6': gate({ flag: 'exam.r2' }),
    // The Staff Room: the chest, the pond and the gate north.
    Q: { ent: { t: 'chest', id: 'examination.duck', item: 'duck', big: true, appear: { flag: 'exam.r2' } } },
    c: sign('STAFF ROOM. THE POND IS DECORATIVE. THE DUCK IS ON STAFF.'),
    v: water,
    j: middle,
    '7': gate({ plates: ['exam.pond'] }),
    // Round three: five mark pads, two drones and two sentries, in a room where time waits.
    ']': sign('ROUND THREE. TIME MOVES WHEN YOU DO.'),
    g: { ent: { t: 'pad', worth: 2, hold: 0 } },
    e: foe('drone'),
    // The Perch.
    w: { ent: { t: 'enemy', kind: 'falcon', once: 'examination.falcon' } },
    // Their doors and entries, and round four's.
    '3': entry('r3', 'up'),
    '8': gate({ flag: 'exam.r3' }),
    '0': { ent: { t: 'gate', trap: true } },
    '4': entry('r4', 'left'),
    '9': gate({ flag: 'exam.r4' }),
    // The Marking Room: the stair up (all four rounds passed) and the short way down to the desk.
    m: entry('mark', 'down'),
    u: { tile: '>', ent: { t: 'warp', to: 'examtop', entry: 'stair' } },
    '&': gate({ flags: ['exam.r1', 'exam.r2', 'exam.r3', 'exam.r4'] }),
    '}': { ent: { t: 'lever', flag: 'examination.back' } },
    '$': gate({ flag: 'examination.back' }),
    K: sign('MARKING ROOM. FULL MARKS GET A SMALL THING.'),
    H: { ent: { t: 'chest', id: 'examination.heart', item: 'heartPiece', appear: { flags: ['exam.r1.full', 'exam.r2.full', 'exam.r3.full', 'exam.r4.full'] } } },
    // Round four: the Weigh House again, and one of its pots hollow.
    '=': sign('ROUND FOUR. THE WEIGH HOUSE. AS PRACTISED.'),
    q: { tile: 'ô', ent: { t: 'stand', wait: 5 } },
    W: { tile: 'η', ent: { t: 'plate', id: 'exam.r4.heavy' } },
    P: { tile: 'σ', ent: { t: 'plate', id: 'exam.r4.scale' } },
    G: { ent: { t: 'pad', worth: 5, when: { plates: ['exam.r4.heavy'] } } },
    C: { ent: { t: 'pad', worth: 5, when: { plates: ['exam.r4.scale'] } } },
  },
}

export const EXAMTOP: MapDef = {
  id: 'examtop',
  name: 'THE TITAN\'S HALL',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'dune',
  ambient: 'sandstone',
  realm: 'stillsand',
  views: ['iso'],
  keyring: 'examination',
  physics: true,
  resume: true,
  cell: { w: 16, h: 12 },
  rows: HALL,
  cells: {
    '0,0': {
      name: 'THE TITAN\'S HALL',
      track: 'boss',
      events: [
        { when: { flags: [], not: ['examination.titan'] }, set: 'examination.titan.card', lines: ['THE BENCHMARK TITAN. TOP OF EVERY TABLE. IT HAS SEEN THE QUESTIONS.'] },
        { when: { flag: 'examination.titan' }, set: 'examination.titan.down', lines: ['(ITS CLIPBOARD IS BLANK. IT LOOKS AT THE BRASS WEIGHT.)'] },
      ],
    },
  },
  entries: { stair: { x: 8, y: 9.5, dir: 'up' } },
  marks: {
    // The way back to the Marking Room, behind a gate that will shut for the fight.
    '1': { tile: 'D', ent: { t: 'warp', to: 'examination', entry: 'mark' } },
    '2': { ent: { t: 'gate', trap: true } },
    // THE BENCHMARK TITAN at its home in the north (eight tiles from the stair, as every foe is from a way in), and
    // the Weight it sat on, which lies where it falls.
    T: { ent: { t: 'enemy', kind: 'titan', once: 'examination.titan' } },
    w: { ent: { t: 'item', id: 'examination.weight', item: 'weightSurprise', appear: { flag: 'examination.titan' }, atFall: true } },
    // The stands that lend pots through the fight, and the two stones with their levers.
    p: { ent: { t: 'stand', wait: 5 } },
    A: { ent: { t: 'boulder', dir: 'down', flag: 'examination.boulder.w' } },
    B: { ent: { t: 'boulder', dir: 'down', flag: 'examination.boulder.e' } },
    '4': { ent: { t: 'lever', flag: 'examination.boulder.w' } },
    '5': { ent: { t: 'lever', flag: 'examination.boulder.e' } },
  },
}
