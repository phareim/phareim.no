/**
 * The Deep Lab: under the bunker past the ravine, two floors of 3×3 camera
 * rooms, and the Gate to the Other Side at the bottom.
 *
 * Floor 1 (deep1): the elevator; Room Eleven, Luna's old cell, where a wall
 * of Christmas lights still blinks a word; the letter floor in the hall,
 * where walking that word opens the vault with the ARC BLADE; the coolant
 * room (hook) and DEEPSEEK's pit (a small key); the chute, where Luna
 * slides a psi block into a hole so it lands on a plate one floor down;
 * the crystal switch; and the stairs down, overgrown with static vines only
 * the Arc Blade cuts.
 * Floor 2 (deep2): a ladder in the cage room climbs back to the chute (a
 * hero who follows the block down the hole is not stuck inside the vines);
 * the block from the chute opens the cage round the big
 * key; the static hall's pink blocks drop only when the switch upstairs has
 * turned the lab cyan; GEMINI waits by the Gate.
 *
 *   deep1                                       deep2
 *   (0,0) Room 11 (1,0) elevator (2,0) coolant   ·          (1,0) GEMINI    ·
 *   (0,1) chute   (1,1) hall     (2,1) DEEPSEEK  (0,1) cage  (1,1) ante      ·
 *   (0,2) vines   (1,2) vault    (2,2) crystals  (0,2) stairs(1,2) static  (2,2) supply
 */
import type { MapDef, Mark } from '../types'
import { joinCells, ROCK } from './cells'

const NOTE = (lines: string[]): Mark => ({ tile: 'S', ent: { t: 'sign', lines } })
const letter = (ch: string): Mark => ({ ent: { t: 'glyph', ch } })

// ---------------------------------------------------------------- deep1

const ROOM11 = [
  '################',
  '################',
  '#.nn...........#',
  '#.nn......Y....#',
  '#..............#',
  '#...............',
  '#......r........',
  '#..............#',
  '#..ff..........#',
  '#......k.......#',
  '#t............t#',
  '################',
]

const ELEVATOR = [
  '################',
  '#t.....VV.....t#',
  '#......@.......#',
  '#..M........M..#',
  '#..............#',
  '................',
  '................',
  '#..M........M..#',
  '#......d.......#',
  '#..............#',
  '#t............t#',
  '#######..#######',
]

const COOLANT = [
  '################',
  '#t.~~~~~~~~~~~t#',
  '#..~~~~~~~~~~~~#',
  '#..~~~~~~~~~~~~#',
  '#..~~~~~~|~~~~~#',
  '...~~~~~~.|~~~~#',
  '.I.~~~~~~.~~~~~#',
  '#..~~~~~~~~~~~~#',
  '#..~~~a~~~~a~~~#',
  '#..~~~.....~~~~#',
  '#..~~~...t.~~~~#',
  '#######..#######',
]

const CHUTE = [
  '################',
  '#t..........e.t#',
  '#..............#',
  '#...I......O...#',
  '#..............#',
  '#...............',
  '#...............',
  '#.........I....#',
  '#..B........I..#',
  '#..............#',
  '#t.........s..t#',
  '################',
]

const HALL = [
  '#######..#######',
  '#t............t#',
  '#......w.......#',
  '#...1.2.3.4....#',
  '#..............#',
  'L...5.6.4.7....#',
  'L..............#',
  '#...8.9.9.4....#',
  '#..............#',
  '#..............#',
  '#t............t#',
  '#######Xv#######',
]

const DEEPSEEK = [
  '#######..#######',
  '#t............t#',
  '#..............#',
  '#...I......I...#',
  '#..............#',
  '#......Q.......#',
  '#..............#',
  '#..............#',
  '#...I......I...#',
  '#......q.......#',
  '#t............t#',
  '################',
]

const VINES = [
  '################',
  '#t............t#',
  '#..............#',
  '#..llll........#',
  '#..l>El........#',
  '#..llll.........',
  '#...............',
  '#......x.......#',
  '#..............#',
  '#......h.......#',
  '#t............t#',
  '################',
]

const VAULT = [
  '#######..#######',
  '#t............t#',
  '#..I........I..#',
  '#..............#',
  '#.....::::.....#',
  '......:A::......',
  '......::::......',
  '#..............#',
  '#..I........I..#',
  '#..............#',
  '#t............t#',
  '################',
]

const CRYSTAL = [
  '################',
  '#t............t#',
  '#..............#',
  '#..CCC....c....#',
  '#..CpC.........#',
  '...CCC.........#',
  '...............#',
  '#.......y......#',
  '#..............#',
  '#......d.......#',
  '#t............t#',
  '################',
]

// ---------------------------------------------------------------- deep2

const GEMINI = [
  '################',
  '#t...ZZZZZZ...t#',
  '#....ZZZZZZ....#',
  '#..............#',
  '#..............#',
  '#...A......B...#',
  '#..............#',
  '#..............#',
  '#......0.......#',
  '#............Xe#',
  '#t............t#',
  '#######..#######',
]

const CAGE = [
  '################',
  '#t..........v.t#',
  '#..............#',
  '#..........j...#',
  '#..............#',
  '#....XXX.......#',
  '#....XkX.......#',
  '#....XgX.......#',
  '#..............#',
  '#..............#',
  '#t............t#',
  '#######..#######',
]

const ANTE = [
  '#######KK#######',
  '#t....I..I....t#',
  '#..............#',
  '#...o......o...#',
  '#..............#',
  '#......z.......#',
  '#..............#',
  '#..I........I..#',
  '#..............#',
  '#..............#',
  '#t............t#',
  '#######..#######',
]

const ARRIVAL = [
  '#######..#######',
  '#t............t#',
  '#..............#',
  '#...u..........#',
  '#...U..........#',
  '#...............',
  '#...............',
  '#..............#',
  '#......s.......#',
  '#..............#',
  '#t............t#',
  '################',
]

const STATIC = [
  '#######LL#######',
  '#t.....PP.....t#',
  '#..............#',
  '#..h........h..#',
  '#..............#',
  '................',
  '................',
  '#..............#',
  '#..I...r....I..#',
  '#..............#',
  '#t............t#',
  '################',
]

const SUPPLY = [
  '################',
  '#o.o.o....o.o.o#',
  '#..............#',
  '#..............#',
  '#......d.......#',
  '...............#',
  '...............#',
  '#..............#',
  '#o............o#',
  '#o............o#',
  '#t............t#',
  '################',
]

const LUNA_ROOM = [
  'LUNA: THIS WAS MY ROOM. ROOM ELEVEN.',
  'LUNA: THEY TALKED TO ME WITH THE LIGHTS ON THE WALL. ONE LETTER AT A TIME.',
  'LUNA: WATCH THEM. THEY STILL SAY IT.',
]

export const DEEP1: MapDef = {
  id: 'deep1',
  name: 'THE DEEP LAB',
  kind: 'dungeon',
  keyring: 'deep',
  track: 'lab',
  look: 'lab',
  crystal: 'deep',
  below: 'deep2',
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { dark: true, events: [{ when: { flag: 'luna' }, lines: LUNA_ROOM, who: 'luna', set: 'room11' }] },
    '2,1': {
      track: 'boss',
      events: [{ when: { notFlag: 'deepseek' }, lines: ['DEEPSEEK. IT HUNTS UNDER THE FLOOR, WHERE THE LIGHT DOES NOT GO.'], set: 'deepseek.met' }],
    },
  },
  props: [{ kind: 'lights', x: 1.5, y: 1, w: 13, h: 1, text: 'DUSK' }],
  rows: joinCells([
    [ROOM11, ELEVATOR, COOLANT],
    [CHUTE, HALL, DEEPSEEK],
    [VINES, VAULT, CRYSTAL],
  ]),
  codes: [{ word: 'DUSK', flag: 'deep.dusk' }],
  marks: {
    '@': { ent: { t: 'entry', id: 'start', dir: 'down' } },
    V: { tile: '>', ent: { t: 'warp', to: 'wildwood', entry: 'deepDoor' } },
    v: { tile: 'X', ent: { t: 'gate', open: { flag: 'deep.dusk' } } },
    E: { ent: { t: 'entry', id: 'up', dir: 'left' } },
    e: { ent: { t: 'entry', id: 'ladder', dir: 'down' } },
    '>': { tile: '>', ent: { t: 'warp', to: 'deep2', entry: 'down' } },
    k: { ent: { t: 'chest', id: 'deep.key1', item: 'smallKey' } },
    q: { ent: { t: 'chest', id: 'deep.key2', item: 'smallKey', appear: { flag: 'deepseek' } } },
    A: { ent: { t: 'chest', id: 'deep.arc', item: 'arc', big: true } },
    p: { ent: { t: 'chest', id: 'deep.bits', item: 'bits50' } },
    Q: { ent: { t: 'enemy', kind: 'deepseek', once: 'deepseek' } },
    d: { ent: { t: 'enemy', kind: 'drone' } },
    h: { ent: { t: 'enemy', kind: 'hound' } },
    a: { tile: '~', ent: { t: 'enemy', kind: 'bat' } },
    // The letter floor: D A W N / S U N K / M O O N — the word is DUSK.
    '1': letter('D'), '2': letter('A'), '3': letter('W'), '4': letter('N'), '5': letter('S'),
    '6': letter('U'), '7': letter('K'), '8': letter('M'), '9': letter('O'),
    r: NOTE(['A WALL OF CHRISTMAS LIGHTS, A LETTER PAINTED UNDER EACH BULB.', 'SOME OF THE BULBS STILL BLINK, ONE AT A TIME, OVER AND OVER.']),
    w: NOTE(['THE VAULT DOOR HAS NO KEYHOLE. A PLATE SAYS:', 'THE VAULT LISTENS FOR ONE WORD. SPEAK IT WITH YOUR FEET.']),
    s: NOTE(['DELIVERY CHUTE TO SUBLEVEL 2. DROP CRATES, NOT STAFF.']),
    x: NOTE(['THE STAIRS DOWN ARE CHOKED WITH STATIC VINES. THEY HUM.']),
    y: NOTE(['CRYSTAL RELAY. EVERY SWITCH IN THE DEEP LAB, BOTH FLOORS, SHARES ONE STATE.']),
  },
}

export const DEEP2: MapDef = {
  id: 'deep2',
  name: 'THE OTHER SIDE',
  kind: 'dungeon',
  keyring: 'deep',
  track: 'static',
  look: 'lab',
  crystal: 'deep',
  cell: { w: 16, h: 12 },
  cells: {
    '1,0': {
      track: 'boss', mood: 'static',
      events: [
        { when: { notFlag: 'gemini' }, lines: ['GEMINI. TWO MINDS, ONE THOUGHT.'], set: 'gemini.met' },
        {
          when: { flag: 'gemini' },
          who: 'luna',
          lines: [
            'LUNA: NOW. MOVE.',
            '(LUNA STEPS UP TO THE GATE AND RAISES BOTH HANDS. HER NOSE BLEEDS. THE GATE SCREAMS, SHRINKS, AND FOLDS SHUT LIKE A WOUND HEALING.)',
            'LUNA: … IT IS SHUT. THE STATIC HAS NOWHERE TO COME FROM NOW.',
            'LUNA: THE LIFT IN THE CORNER GOES STRAIGHT UP. THE VINES IN THE GRAVES WILL BE DEAD. GO GET YOUR SUN.',
          ],
          set: 'gateShut',
        },
      ],
    },
    '0,1': { mood: 'static' },
    '1,1': { mood: 'static' },
    '0,2': { mood: 'static' },
    '1,2': { mood: 'static' },
    '2,2': { mood: 'static' },
  },
  props: [
    { kind: 'rift', x: 21, y: 0.5, w: 6, h: 2.5, when: { notFlag: 'gateShut' } },
    { kind: 'lift', x: 29.5, y: 9.5, when: { flag: 'gateShut' } },
  ],
  rows: joinCells([
    [ROCK, GEMINI, ROCK],
    [CAGE, ANTE, ROCK],
    [ARRIVAL, STATIC, SUPPLY],
  ]),
  warps: [{ x: 29, y: 9, to: 'wildwood', entry: 'deepDoor' }],
  marks: {
    U: { ent: { t: 'entry', id: 'down', dir: 'down' } },
    u: { tile: '>', ent: { t: 'warp', to: 'deep1', entry: 'up' } },
    // A hero who jumps down the chute before the Arc Blade would land inside
    // the vines upstairs; the ladder takes them back up to the chute instead.
    v: { tile: '>', ent: { t: 'warp', to: 'deep1', entry: 'ladder' } },
    j: { ent: { t: 'plate', id: 'deep.chute' } },
    g: { tile: 'X', ent: { t: 'gate', open: { plates: ['deep.chute'] } } },
    k: { ent: { t: 'chest', id: 'deep.bigkey', item: 'bigKey', big: true } },
    e: { tile: 'X', ent: { t: 'gate', open: { flag: 'gateShut' } } },
    A: { ent: { t: 'enemy', kind: 'gemini', once: 'gemini' } },
    B: { ent: { t: 'enemy', kind: 'gemini', once: 'gemini' } },
    '0': { ent: { t: 'item', id: 'deep.container', item: 'heartContainer', appear: { flag: 'gemini' } } },
    d: { ent: { t: 'enemy', kind: 'drone' } },
    h: { ent: { t: 'enemy', kind: 'hound' } },
    z: { ent: { t: 'enemy', kind: 'hound' } },
    s: NOTE(['THE AIR HERE TASTES OF BATTERIES. THE WALLS BREATHE.', 'SOMEONE HAS SCRATCHED: WE ARE UNDER THE LAB. WE ARE ALSO SOMEWHERE ELSE.']),
    r: NOTE(['A SIGN, UPSIDE DOWN: GATE ANTECHAMBER. PINK RELAY HOLDS THE DOOR.']),
  },
}
