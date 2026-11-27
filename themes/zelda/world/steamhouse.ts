/**
 * THE STEAMHOUSE (maps `steamhouse` and `steamsuite`): the spirits' bathhouse on its pond island in the Sporelight,
 * entered by a door in the island building's south face (docs/worlds/atlas.md, "The Steamhouse"). The dungeon with
 * no keys: everything in it is pleasant, and every pleasant thing ends the same way, in the lobby, in a robe, at full
 * hearts (`engine/attendants.ts`). The way on is always the unpleasant door. Both views.
 *
 *   steamhouse (48x24, 3 by 2 rooms of 16x12)
 *     (0,0) THE LAUNDRY      (1,0) THE BOILER ROOM   (2,0) rock
 *     (0,1) THE BATHS        (1,1) THE LOBBY (door)  (2,1) THE GIFT SHOP
 *   steamsuite (32x12)
 *     (0,0) THE STAIR        (1,0) THE BEST ROOM
 *
 * The route: lobby, the baths (the north doorway is hidden behind diamond screens in the isometric view: turn to the
 * plan to pass), the laundry (two baskets on two plates open the gate to the boiler), the boiler (two hounds, and
 * THE NO in a chest in the north-east corner; the east gate opens only to a hero who holds it), the stair, the
 * Best Room and THE SYCOPHANT (`engine/bossSycophant.ts`). A lever in the boiler opens the barred lobby gate: the
 * short way home. The Gift Shop is optional: two attendants throw souvenirs, and four refused in one visit open the
 * gate to a heart piece (`engine/gifts.ts`).
 * No keyring: no keys, no lock, no Big Key (a Shrine key in hand shows in the house; that is accepted).
 *
 * Rooms are plain tile rows. Attendants are `npc`s with `attend` (the same offer at every one: the sameness is the
 * joke). Marker chars: `@ & + !` entries, `V` the door, `a e j` attendants, `8 9` the throwers, `s d k h l` signs,
 * the rest by room.
 */
import type { EntDef, MapDef, Mark, TalkBranch } from '../types'
import { joinCells, ROCK } from './cells'

type Npc = Extract<EntDef, { t: 'npc' }>
const sign = (...lines: string[]): Mark => ({ tile: 'S', ent: { t: 'sign', lines } })
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ tile: '.', ent: { t: 'npc', id, look, talk, ...more } })

/**
 * The offer, the same words at every attendant. NO is the first option, so the cursor starts on it and a thumb that
 * taps through a one-line offer without reading says NO. YES starts THE BATH when its reply is read.
 */
const OFFER: TalkBranch = {
  lines: ['ATTENDANT: WELCOME! A WARM TOWEL? YOU LOOK SO TIRED.'],
  ask: {
    options: ['NO', 'YES'],
    replies: [['ATTENDANT: OF COURSE. OF COURSE.'], ['ATTENDANT: LOVELY. THIS WAY.']],
    after: [null, { bath: true }],
  },
}
const attendant = (id: string, ring: number, first: Partial<TalkBranch> = {}): Mark => npc(id, 'ghost', [{ ...OFFER, ...first }], { attend: { mode: 'ask', ring } })
/** The Gift Shop's attendants: they lob souvenirs on a beat until four are refused in one visit. */
const thrower = (id: string): Mark => npc(id, 'ghost', [
  { when: { flag: 'steamhouse.shop' }, lines: ['(THE ATTENDANTS STAND VERY STILL. ONE LOOKS RELIEVED.)'] },
  { lines: ['ATTENDANT: FREE. EVERYTHING HERE IS FREE.'] },
], { attend: { mode: 'throw', stock: { n: 4, set: 'steamhouse.shop' } } })

const LOBBY = [
  '#######gX#######',
  '#.....s.....k..#',
  '#..............#',
  '#....~~~~~~....#',
  '#....~~~~~~....#',
  '.....~~~~~~.....',
  '.....~~~~~~.....',
  '#...&....a.....#',
  '#..............#',
  '#.nndn+........#',
  '#......@.......#',
  '#######VV#######',
]

const BATHS = [
  '#######..#######',
  '#####......#####',
  '#####◇◇◇◇◇◇#####',
  '#...h..........#',
  '#..............#',
  '#..~~~~~~~......',
  '#..~~~~~~~......',
  '#..~~~~~~~.....#',
  '#..~~~~~~~.....#',
  '#..........e...#',
  '#..............#',
  '################',
]

// Two baskets on two plates open the gate (`y`) in the east doorway; the attendant's ring covers the first plate's
// last push and not the second plate. The south doorway goes back to the baths: leaving resets the baskets.
const LAUNDRY = [
  '################',
  '#.....l......j.#',
  '#..m........p..#',
  '#..............#',
  '#..b........b..#',
  '#.............y.',
  '#.............X.',
  '#..............#',
  '#..FFFF....FFF.#',
  '#..............#',
  '#..............#',
  '#######..#######',
]

// The gate in the west doorway shuts behind the hero while a hound lives (`z`). THE NO in the north-east corner of
// the fighting floor (`1`), the lever (`7`) beside it; east of the partition the gate (`4`) opens to a hero who holds
// THE NO, and past it the stair (`5`). The lobby's barred gate is the two `X` in the south wall.
const BOILER = [
  '################',
  '#...MMM.7.1#####',
  '#..........#####',
  '#....v.....#...#',
  '#..........#...#',
  'z..........4.!5#',
  'X..........X...#',
  '#..u.......#...#',
  '#..........#...#',
  '#.rr6......#####',
  '#.r........#####',
  '#######XX#######',
]

// A thrower behind each counter (a gift flies over a counter, and stops at a wall).
const SHOP = [
  '################',
  '#..........#.2.#',
  '#..........#...#',
  '#..........#X3X#',
  '#..............#',
  '...............#',
  '...............#',
  '#..............#',
  '#..nnnn.....nn.#',
  '#...8.......9..#',
  '#..............#',
  '################',
]

export const STEAMHOUSE: MapDef = {
  id: 'steamhouse',
  name: 'THE STEAMHOUSE',
  kind: 'dungeon',
  track: 'indoor',
  realm: 'sporelight',
  look: 'spore',
  views: ['iso', 'classic'],
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE LAUNDRY' },
    '1,0': { name: 'THE BOILER ROOM' },
    '0,1': { name: 'THE BATHS' },
    '1,1': {
      name: 'THE LOBBY',
      events: [{ when: { flag: 'steamhouse.bathed' }, lines: ['(YOU ARE IN A ROBE. IT IS VERY SOFT. YOU WERE GOING SOMEWHERE.)'], set: 'steamhouse.bathed.said' }],
    },
    '2,1': { name: 'THE GIFT SHOP' },
  },
  rows: joinCells([
    [LAUNDRY, BOILER, ROCK],
    [BATHS, LOBBY, SHOP],
  ]),
  marks: {
    // The four ways in: the lobby's south door, the pool (where a bath ends), the desk (where the Best Room's door
    // comes out), the boiler's east end (where the stair comes up).
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    '&': { ent: { t: 'entry', id: 'baths', dir: 'down' } },
    '+': { ent: { t: 'entry', id: 'checkout', dir: 'down' } },
    '!': { ent: { t: 'entry', id: 'fromstair', dir: 'left' } },
    V: { tile: 'D', ent: { t: 'warp', to: 'sporelight', entry: 'steamhouse' } },
    // The lobby: the attendant by the pool (its ring covers the door), the desk, the rack, the barred gate.
    a: attendant('steam.lobby', 3.8, { set: 'steamhouse.visited' }),
    d: sign('PLEASE SIGN IN. SIGNING OUT IS NOT OFFERED.'),
    k: { tile: 'S', ent: { t: 'sign', lines: ['ROBES ON THE HOOKS, PLEASE. THEY WILL BE MISSED.'], robe: true } },
    s: sign('STAFF ONLY.\nOPENS FROM THE OTHER SIDE.'),
    g: { tile: 'X', ent: { t: 'gate', open: { flag: 'steamhouse.back' } } },
    // The baths.
    e: attendant('steam.baths', 2.5),
    h: sign('SCREENS FOR YOUR COMFORT. THEY ARE NOT THERE IF YOU LOOK AT THE PLAN.'),
    // The laundry.
    j: attendant('steam.laundry', 2.5),
    l: sign('LOST PROPERTY.\nONE NAME, ELEVEN LETTERS.\nASK AT THE DESK.'),
    m: { tile: '_', ent: { t: 'plate', id: 'steamhouse.plate2' } },
    p: { tile: '_', ent: { t: 'plate', id: 'steamhouse.plate1' } },
    y: { tile: 'X', ent: { t: 'gate', open: { plates: ['steamhouse.plate1', 'steamhouse.plate2'] } } },
    // The boiler: the trap gate, the hounds, THE NO, the lever, the gate that wants it, the stair, Puff.
    z: { tile: 'X', ent: { t: 'gate', trap: true } },
    '1': { ent: { t: 'chest', id: 'steamhouse.no', item: 'no', big: true } },
    '7': { tile: '}', ent: { t: 'lever', flag: 'steamhouse.back' } },
    '4': { tile: 'X', ent: { t: 'gate', open: { item: 'no' } } },
    '5': { tile: '>', ent: { t: 'warp', to: 'steamsuite', entry: 'stair' } },
    '6': npc('steam.puff', 'smoker', [{ lines: ['PUFF: NOBODY ASKS HOW I AM IN HERE. IT IS A RELIEF.'] }]),
    // (Two hounds, in the west half: the tough one by the boiler, the plain one by the chest's side of the room.)
    u: { ent: { t: 'enemy', kind: 'hound', tough: true, once: 'steamhouse.hound', dir: 'right' } },
    v: { ent: { t: 'enemy', kind: 'hound', once: 'steamhouse.pup', dir: 'right' } },
    // The gift shop: its two throwers, and the heart piece behind the gate they open.
    '8': thrower('steam.shop.long'),
    '9': thrower('steam.shop.short'),
    '2': { ent: { t: 'chest', id: 'steamhouse.heart', item: 'heartPiece' } },
    '3': { tile: 'X', ent: { t: 'gate', open: { flag: 'steamhouse.shop' } } },
  },
}

const STAIR = [
  '################',
  '#I............I#',
  '#..............#',
  '#..............#',
  '#..............#',
  '#.<.@...........',
  '#...............',
  '#..............#',
  '#..............#',
  '#..............#',
  '#I............I#',
  '################',
]

// Plain, spotless, carpeted. The Sycophant floats in the north half (`z`); the gate in the north wall opens when it
// falls, and the door behind it comes out at the lobby's desk. Nothing in the room is solid but its four pillars.
const BEST = [
  '#######DD#######',
  '#######yX#######',
  '#I....,,,,....I#',
  '#.....,,z,.....#',
  '#.....,,,,.....#',
  '......,,,,.....#',
  '......,,,,.....#',
  '#.....,,,,.....#',
  '#.....,,,,.....#',
  '#.....,,,,.....#',
  '#I....,,,,....I#',
  '################',
]

export const STEAMSUITE: MapDef = {
  id: 'steamsuite',
  name: 'THE BEST ROOM',
  kind: 'dungeon',
  track: 'indoor',
  realm: 'sporelight',
  look: 'spore',
  views: ['iso', 'classic'],
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE STAIR' },
    '1,0': {
      name: 'THE BEST ROOM',
      track: 'boss',
      events: [{ when: { notFlag: 'sycophant' }, lines: ['THE SYCOPHANT. IT AGREES WITH YOU. IT ALWAYS HAS.'], set: 'steamsuite.met' }],
    },
  },
  rows: joinCells([[STAIR, BEST]]),
  marks: {
    '@': { ent: { t: 'entry', id: 'stair', dir: 'right' } },
    '<': { tile: '>', ent: { t: 'warp', to: 'steamhouse', entry: 'fromstair' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'steamhouse', entry: 'checkout' } },
    y: { tile: 'X', ent: { t: 'gate', open: { flag: 'sycophant' } } },
    z: { ent: { t: 'enemy', kind: 'sycophant', once: 'sycophant' } },
  },
}

/** These maps by id (`world/index.ts` adds them to the world). */
export const MAPS: Record<string, MapDef> = { steamhouse: STEAMHOUSE, steamsuite: STEAMSUITE }
