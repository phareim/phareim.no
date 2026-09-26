/**
 * Horizon Lab: Project Horizon's building in the Wildwood, two floors of
 * 3×3 camera rooms. The power is off: its breaker is down on B1, behind a
 * locked door and pink crystal blocks that only drop when the switch up in
 * the stairwell turns the whole lab cyan. With the power on, the lobby's
 * shutter opens onto the hub. East, Luna slides a psi block onto a plate;
 * the LLAMA guards the grappling hook. The hub's shaft drops to a sealed
 * room on B1 (the second key), the dorms hold Toby's walkie-talkie behind
 * cyan blocks, and the coolant vault is crossed hook by hook to the big key.
 * MISTRAL waits north of the hub.
 *
 *   floor 1 (lab1)                      B1 (lab1b)
 *   (0,0) vault   (1,0) MISTRAL (2,0) LLAMA      ·        ·         ·
 *   (0,1) dorms   (1,1) hub     (2,1) psi room   ·     (1,1) shaft     ·
 *   (0,2) security(1,2) lobby   (2,2) stairwell  ·     (1,2) breaker (2,2) landing
 */
import type { MapDef } from '../types'
import { joinCells, ROCK } from './cells'

// ---------------------------------------------------------------- floor 1

const VAULT = [
  '################',
  '#.....I.k.....t#',
  '#..............#',
  '#~~~~~~~~~~~~~~#',
  '#~~~~~~|~~~~~~~#',
  '#~~~~~..~~~~~~~#',
  '#~~~~~~~~~~~~~~#',
  '#~~~~~~~~~~~~~~#',
  '#..............#',
  '#t....I.......t#',
  '#..............#',
  '#######..#######',
]

const MISTRAL = [
  '################',
  '#t............t#',
  '#xx..........xx#',
  '#xx..I....I..xx#',
  '#xx..........xx#',
  '#xx.....Q....xx#',
  '#xx..........xx#',
  '#xx..I....I..xx#',
  '#xx..........xx#',
  '#xx....0.....xx#',
  '#t............t#',
  '#######..#######',
]

const LLAMA = [
  '################',
  '#t............t#',
  '#..............#',
  '#...I......I...#',
  '#..............#',
  '#.......N......#',
  '#.......H......#',
  '#..............#',
  '#...I......I...#',
  '#..............#',
  '#t............t#',
  '#######..#######',
]

const DORMS = [
  '#######..#######',
  '#nn.nn....nn.nn#',
  '#..............#',
  '#..a.......a...#',
  '#s.............#',
  '#......h........',
  '#...............',
  '#nn.nn....CCC..#',
  '#.........CWC..#',
  '#.........CCC..#',
  '#t............t#',
  '################',
]

const HUB = [
  '#######KK#######',
  '#t.....::.....t#',
  '#......::......#',
  '#..I........I..#',
  '#.....OOOO.....#',
  'L.....OOOO......',
  'L.....OOOO......',
  '#.....OOOO.....#',
  '#..I........I..#',
  '#......::......#',
  '#t.....::.....t#',
  '#######..#######',
]

const PSI = [
  '#######Xg#######',
  '#......j.......#',
  '#..............#',
  '#.............S#',
  '#....I.....I...#',
  '...............#',
  '...............#',
  '#..............#',
  '#..B....I......#',
  '#..............#',
  '#t............t#',
  '################',
]

const SECURITY = [
  '################',
  '#M.M.M....M.M.M#',
  '#..............#',
  '#...d......d...#',
  '#..............#',
  '#......1........',
  '#...............',
  '#..nn......nn..#',
  '#......d.......#',
  '#..............#',
  '#t............t#',
  '################',
]

const LOBBY = [
  '#######Xp#######',
  '#t............t#',
  '#......s.......#',
  '#..M..nnnn..M..#',
  '#..............#',
  '................',
  '................',
  '#..M........M..#',
  '#..............#',
  '#......r.......#',
  '#t.....@......t#',
  '#######VV#######',
]

const STAIRS = [
  '################',
  '#t.........P4P.#',
  '#.....c....PPP.#',
  '#..............#',
  '#..I.......I...#',
  '...............#',
  '...............#',
  '#..I.......I...#',
  '#..............#',
  '#...........Ev.#',
  '#t............t#',
  '################',
]

// ---------------------------------------------------------------- B1

const SHAFT = [
  '################',
  '#t............t#',
  '#..............#',
  '#..h........h..#',
  '#..............#',
  '#.....::::.....#',
  '#.....::::.....#',
  '#..............#',
  '#......2.......#',
  '#..d........d..#',
  '#t............t#',
  '#######Xq#######',
]

const BREAKER = [
  '#######..#######',
  '#t............t#',
  '#..M}M.........#',
  '#.....I.....I..#',
  '#..............#',
  '#...............',
  '#......s........',
  '#..............#',
  '#..I........I..#',
  '#...........T..#',
  '#t............t#',
  '################',
]

const LANDING = [
  '################',
  '#t............t#',
  '#......c.......#',
  '#..............#',
  '#..I.......I...#',
  'LP.............#',
  'LP.............#',
  '#..I.......I...#',
  '#..............#',
  '#...........Uu.#',
  '#t............t#',
  '################',
]

const NOTE = (lines: string[]) => ({ tile: 'S' as const, ent: { t: 'sign' as const, lines } })

export const LAB1: MapDef = {
  id: 'lab1',
  name: 'HORIZON LAB',
  kind: 'dungeon',
  keyring: 'lab1',
  track: 'lab',
  look: 'lab',
  crystal: 'lab1',
  cell: { w: 16, h: 12 },
  cells: {
    '1,0': {
      track: 'boss',
      events: [
        { when: { notFlag: 'mistral' }, lines: ['MISTRAL, THE COLD WIND. IT BLOWS FROM THE NORTH AND NEVER STOPS TO LISTEN.'], set: 'mistral.met' },
        {
          when: { flag: 'mistral' },
          who: 'luna',
          lines: ['LUNA: THE WIND IS GONE.', 'LUNA: NOW THE LIFT IN THE DEEP WOODS WILL RUN. PAST THE RAVINE, IN THE BUNKER. THE GATE IS DOWN THERE.'],
          set: 'mistral.told',
        },
      ],
    },
    '2,0': {
      track: 'boss',
      events: [{ when: { notFlag: 'llama' }, lines: ['L.L.A.M.A.: LAB LLAMA, ACCESS MANAGEMENT ASSISTANT.', 'IT HAS OPINIONS, AND IT SPITS THEM.'], set: 'llama.met' }],
    },
    '0,1': { dark: true, lit: 'lab1.power' },
    '1,1': { dark: true, lit: 'lab1.power' },
    '0,2': { dark: true, lit: 'lab1.power' },
  },
  rows: joinCells([
    [VAULT, MISTRAL, LLAMA],
    [DORMS, HUB, PSI],
    [SECURITY, LOBBY, STAIRS],
  ]),
  below: 'lab1b',
  marks: {
    '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
    V: { tile: '>', ent: { t: 'warp', to: 'wildwood', entry: 'lab' } },
    v: { tile: '>', ent: { t: 'warp', to: 'lab1b', entry: 'up' } },
    E: { ent: { t: 'entry', id: 'down', dir: 'left' } },
    // The lobby's shutter opens with the power.
    p: { tile: 'X', ent: { t: 'gate', open: { flag: 'lab1.power' } } },
    // Luna's block on the plate opens the way to the llama.
    g: { tile: 'X', ent: { t: 'gate', open: { plates: ['lab1.psi'] } } },
    j: { ent: { t: 'plate', id: 'lab1.psi' } },
    '1': { ent: { t: 'chest', id: 'lab1.key1', item: 'smallKey', appear: { clear: true } } },
    '4': { ent: { t: 'chest', id: 'lab1.bits', item: 'bits20' } },
    H: { ent: { t: 'chest', id: 'lab1.hook', item: 'hook', big: true, appear: { flag: 'llama' } } },
    k: { ent: { t: 'chest', id: 'lab1.bigkey', item: 'bigKey', big: true } },
    W: { ent: { t: 'chest', id: 'lab1.walkie', item: 'walkie' } },
    '0': { ent: { t: 'item', id: 'lab1.container', item: 'heartContainer', appear: { flag: 'mistral' } } },
    N: { ent: { t: 'enemy', kind: 'llama', once: 'llama', dir: 'down' } },
    Q: { ent: { t: 'enemy', kind: 'mistral', once: 'mistral' } },
    d: { ent: { t: 'enemy', kind: 'drone' } },
    h: { ent: { t: 'enemy', kind: 'hound' } },
    a: { ent: { t: 'enemy', kind: 'bat' } },
    r: NOTE([
      'A TERMINAL, STILL ON:',
      'PROJECT HORIZON. WE LISTEN TO THE STATIC BETWEEN THE STATIONS. IT IS NOT NOISE. IT IS A PLACE.',
      'POWER: OFFLINE. MAIN BREAKER: SUBLEVEL B1.',
    ]),
    s: NOTE(['LAB NOTE: SUBJECT L MOVED A 40-KILO BLOCK TODAY. THEN ASKED FOR A WAFFLE.']),
    S: NOTE(['LAB NOTE: THE PINK AND CYAN CRYSTALS ARE WIRED THROUGH THE WHOLE BUILDING.', 'FLIP ONE AND EVERY FLOOR CHANGES.']),
  },
}

export const LAB1B: MapDef = {
  id: 'lab1b',
  name: 'HORIZON LAB B1',
  kind: 'dungeon',
  keyring: 'lab1',
  track: 'lab',
  look: 'lab',
  crystal: 'lab1',
  cell: { w: 16, h: 12 },
  cells: {
    '1,1': { dark: true, lit: 'lab1.power' },
  },
  rows: joinCells([
    [ROCK, ROCK, ROCK],
    [ROCK, SHAFT, ROCK],
    [ROCK, BREAKER, LANDING],
  ]),
  marks: {
    U: { ent: { t: 'entry', id: 'up', dir: 'left' } },
    u: { tile: '>', ent: { t: 'warp', to: 'lab1', entry: 'down' } },
    q: { tile: 'X', ent: { t: 'gate', open: { clear: true } } },
    '2': { ent: { t: 'chest', id: 'lab1.key2', item: 'smallKey', appear: { clear: true } } },
    T: { ent: { t: 'chest', id: 'lab1.tube', item: 'tube' } },
    '}': { ent: { t: 'lever', flag: 'lab1.power' } },
    d: { ent: { t: 'enemy', kind: 'drone' } },
    h: { ent: { t: 'enemy', kind: 'hound' } },
    s: NOTE(['MAIN BREAKER. HIT IT HARD.', '(SOMEONE HAS SCRATCHED UNDER IT: THE OTHER DOOR IS IN THE DEEP LAB, PAST THE RAVINE. DO NOT GO.)']),
  },
}
