/**
 * THE LATE SHOW: under the drive-in screen of Rerun Estates, where the picture has been the same for three nights
 * and there is a door in the middle of it (docs/worlds/atlas.md, "The Late Show"). A projection booth seen from
 * above, and reels of film played from the side (`kind: 'side'`), each dressed in its year (`render/eras.ts`) and
 * opened by an intertitle card (`engine/cards.ts`). One keyring, `lateshow`.
 *
 *   showbooth   (0,0) THE SCAFFOLD   (1,0) THE BOOTH   (2,0) THE SNACK BAR
 *   reel1958    (0,0) MAIN STREET    (1,0) THE BACKLOT
 *   reel1986    (0,0) THE VIDEO STORE
 *   chase1986   (0,0) THE ROAD (one wide room; its screen scrolls by itself, `engine/chase.ts`)
 *   reel2086    (0,0) THE OVERGROWN LOT   (1,0) THE LAST REEL
 *   weaver      (0,0) THE SCREEN (its floor and the outlines of what will land there)
 *
 * The route: the screen's door, the Scaffold, the Booth; the 1958 lens; Main Street, with a small key on the shop
 * roof; the Backlot, where THE STOMP lies on the alcove ledge; back to the booth, whose locked lens (1986) the key
 * opens. The Video Store's springs, up to the Road; COPILOT, whose fall gives the second key and opens the booth's
 * gate; the Snack Bar and the Usher, the lens of 2086 behind its lock; the Overgrown Lot with the third key; the
 * Last Reel, its locked inner door and the Big Key; the booth's great door, down to the Screen.
 *
 * One small key a reel, and at the moment any is picked up exactly one lock can be reached: the Snack Bar stands
 * behind a gate COPILOT opens, so no key can be spent on the wrong door.
 *
 * - The side rooms are 16 wide and 24 tall: a phone held upright shows one whole, and large.
 * - A side room's floor is three tiles deep (its top on row 21), so that the hollows under a cracked floor fit.
 * - A nook is a one-tile hollow under a cracked floor with solid ground under it: the hero falls 2 into it and
 *   jumps out again. It is never an ordinary way on.
 * - A pocket of floor behind a ledge has a ladder up out of it: a fall there is never the end of the way.
 * - Nothing hunts in the Scaffold or the Booth.
 */
import type { EntDef, MapDef, Mark } from '../types'
import { joinCells } from './cells'

const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })
const warp = (tile: 'D' | '>', to: string, entry: string): Mark => ({ tile, ent: { t: 'warp', to, entry } })
const chest = (id: string, item: Extract<EntDef, { t: 'chest' }>['item'], big = false): Mark => ({ ent: { t: 'chest', id, item, ...(big ? { big: true } : {}) } })
const foe = (kind: 'blob' | 'bat'): Mark => ({ ent: { t: 'enemy', kind } })

// ---------------------------------------------------------------------------
// The booth: the one place seen from above
// ---------------------------------------------------------------------------

// The catwalk behind the screen: planks over the dark, a rail either side, the stair back out at its west end.
const SCAFFOLD = [
  '################',
  '#OOOOOOOOOOOOOO#',
  '#OOOOOOOOOOOOOO#',
  '#FFFtFFFFFFtFFF#',
  '#..o...........#',
  '#.v.............',
  '#...............',
  '#..........o...#',
  '#FFFFFtFFFFFFtF#',
  '#OOOOOOOOOOOOOO#',
  '#OOOOOOOOOOOOOO#',
  '################',
]

// Two lenses in the north wall: 1958's open, 1986's behind its lock (the sign beside it stands in the wall's line).
// East, the Snack Bar's gate; south, behind the great door, the stair down to the Screen.
const BOOTH = [
  '################',
  '####a######b####',
  '#..j......#Lk..#',
  '#m.............#',
  '#[..........J.[#',
  '...............Q',
  '........p......X',
  '#..............#',
  '#[....nnn.....[#',
  '#oo..........oo#',
  '#######KK#######',
  '#######zz#######',
]

// The third lens, behind its lock, in a snack bar of 1986. The Usher keeps it, behind a gate that shuts after you.
const SNACK = [
  '################',
  '########A#######',
  '#.nn...#LE.....#',
  '#..............#',
  '#[.N..........[#',
  'W..............#',
  'X............U.#',
  '#..............#',
  '#[..nnnn......[#',
  '#oo..........oo#',
  '################',
  '################',
]

// ---------------------------------------------------------------------------
// Reel one, 1958: two screens, 16 × 24
// ---------------------------------------------------------------------------

/** A side room of 16 × 24: open air and a wall at the west edge, `put` laid over rows by their number. */
const reel = (put: Record<number, string>): string[] => Array.from({ length: 24 }, (_, y) => put[y] ?? (y >= 21 ? '################' : '#...............'))

// The porch the door opens on (a blow by it cannot throw the hero back out), the blob, the curb, the sentry's gutter,
// a stoop, the manhole, and the ladder up and over the shop with the key on it.
const MAIN_STREET = reel({
  15: '#............1..',
  16: '#...........Ħ##Ħ',
  17: '#...........Ħ##Ħ',
  18: '#...........Ħ##Ħ',
  19: 'd...........Ħ##Ħ',
  20: '##.2##.3#e..f##Ħ',
  21: '##########..####',
  22: '##########..####',
  23: '##########..####',
})

// The seam, the cracked floor over its nook, a platform, the alcove ledge with the Stomp, a crate that pens the blob.
const BACKLOT = [
  ...Array.from({ length: 16 }, () => '#...............'),
  '#...4.........5.',
  '#...........####',
  '................',
  '........¯¯¯.....',
  '...........#.6..',
  '#####%%#########',
  '####...7########',
  '################',
]

// ---------------------------------------------------------------------------
// Reel two, 1986: the Video Store, and the Road
// ---------------------------------------------------------------------------

// The door, the sign, the spring pad that throws up onto the shelves (top row 17), a second pad on top of them for the
// balcony (row 13) and the way to the Road. A nook with the heart piece under the cracked top of the shelves, and a
// ladder up their far side out of the floor the blobs keep.
const VIDEO_STORE = reel({
  ...Object.fromEntries(Array.from({ length: 21 }, (_, y) => [y, '#..............#'])),
  12: '#.............r#',
  13: '#..........¯¯¯¯#',
  17: '#....%%##▲Ħ....#',
  18: '#......6##Ħ....#',
  19: '#....#####Ħ....#',
  20: 'd.k..#####Ħ.22.#',
  21: '####▲###########',
})

// The Road: 64 wide, three pits of two, three parked wagons a step high (`render/lateshowPaint.ts` paints them over
// their blocks), and the ledge marks a hero left behind is put on.
const ROAD = [
  ...Array.from({ length: 20 }, () => '#..............................................................#'),
  '#d..e.c..###......e..###......e..###......e.........e.....5...x#',
  '##############..##########..##########..########################',
  '##############..##########..##########..########################',
  '##############..##########..##########..########################',
]

// ---------------------------------------------------------------------------
// Reel three, 2086: the Overgrown Lot and the Last Reel
// ---------------------------------------------------------------------------

// The Video Store again, grown over: pad, shelf, pad, and a slab high up that carries on east. Bats under it.
const LOT = reel({
  13: '#.........######',
  14: '#..............#',
  15: '#..............#',
  16: '#..............#',
  17: '#....###▲Ħ.4...#',
  18: '#....####Ħ...4.#',
  19: '#....####Ħ.....#',
  20: 'd....####Ħ.....#',
  21: '####▲###########',
  12: '#...........3...',
})

// In from the high slab, down eight, out by the door under it; east, two pads either side of a block, the lock in the
// wall, and the Big Key in the room behind it.
const LAST_REEL = reel({
  ...Object.fromEntries(Array.from({ length: 13 }, (_, y) => [y, '............#..#'])),
  13: '#####.......#..#',
  14: '#...........#..#',
  15: '#...........#..#',
  16: '#..4........#..#',
  17: '#......##...#..#',
  18: '#......##...#..#',
  19: '#......##...#..#',
  20: '#f.....##..2L.7#',
  21: '######▲##▲######',
})

// ---------------------------------------------------------------------------
// The Screen
// ---------------------------------------------------------------------------

// Floor, walls, a ceiling, and the stair back up. (What lives here comes with the Screen's own fight.)
const SCREEN = reel({
  0: '################',
  ...Object.fromEntries(Array.from({ length: 20 }, (_, y) => [y + 1, '#..............#'])),
  20: '#u.............#',
})

export const SHOWBOOTH: MapDef = {
  id: 'showbooth',
  name: 'THE PROJECTION BOOTH',
  kind: 'dungeon',
  track: 'dungeon',
  realm: 'rerun',
  keyring: 'lateshow',
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE SCAFFOLD', events: [{ when: { notFlag: 'lateshow.seen' }, lines: ['(THE BACK OF THE SCREEN. THE SKY IS PAINTED ON.)'], set: 'lateshow.seen' }] },
    '1,0': { name: 'THE BOOTH' },
    '2,0': { name: 'THE SNACK BAR', events: [{ when: { notFlag: 'lateshow.usher' }, lines: ['THE USHER. SEATS ARE ASSIGNED. SO IS BLAME.'], set: 'lateshow.usher.card' }] },
  },
  rows: joinCells([[SCAFFOLD, BOOTH, SNACK]]),
  entries: {
    door: { x: 3.5, y: 5.5, dir: 'right' },
    // In front of each lens, never on it and never behind its lock.
    lens1: { x: 20.5, y: 3.5, dir: 'down' },
    lens2: { x: 27.5, y: 3.5, dir: 'down' },
    lens3: { x: 40.5, y: 3.5, dir: 'down' },
    // At the head of the great door's stair.
    kdoor: { x: 23.5, y: 9.5, dir: 'up' },
  },
  // Each lens's year, painted on the floor in front of it, where both views show it whole.
  decals: [
    { x: 20.5, y: 4.3, text: '1958', tone: 'cream', scale: 1, align: 'center' },
    { x: 27.5, y: 4.3, text: '1986', tone: 'cream', scale: 1, align: 'center' },
    { x: 40.5, y: 4.3, text: '2086', tone: 'cream', scale: 1, align: 'center' },
  ],
  marks: {
    v: warp('>', 'rerun', 'screen'),
    a: warp('>', 'reel1958', 'lens'),
    b: warp('>', 'reel1986', 'lens'),
    j: sign('1958.'),
    k: sign('1986.'),
    m: sign('ONE REEL AT A TIME, PLEASE. THE NUMBERS ARE A SUGGESTION.'),
    p: { ent: { t: 'npc', id: 'showbooth.projectionist', look: 'vendor', talk: [{ lines: ['PROJECTIONIST: I HAVE SEEN IT SO OFTEN THAT IT HAS STARTED TO SEE ME BACK.'] }] } },
    J: sign('SNACK BAR. CLOSED UNTIL THE NEXT FEATURE ENDS.'),
    // Shut until COPILOT falls.
    Q: { ent: { t: 'gate', open: { flag: 'lateshow.copilot' } } },
    z: warp('>', 'weaver', 'stair'),
    // The Snack Bar.
    A: warp('>', 'reel2086', 'lens'),
    E: sign('2086.'),
    N: sign('SNACK BAR. EVERYTHING IS FROM 1986. SO IS THE USHER.'),
    W: { ent: { t: 'gate', trap: true } },
    U: { ent: { t: 'enemy', kind: 'sentry', tough: true, dir: 'left', once: 'lateshow.usher' } },
  },
}

export const REEL1958: MapDef = {
  id: 'reel1958',
  name: 'REEL ONE',
  kind: 'side',
  track: 'village',
  realm: 'rerun',
  look: 'suburb',
  keyring: 'lateshow',
  resume: true,
  era: '1958',
  cell: { w: 16, h: 24 },
  cells: {
    '0,0': { name: 'MAIN STREET', card: { title: '1958.', lines: ['A QUIET TOWN.', 'THE MUSIC DOES THE TALKING.'] } },
    '1,0': { name: 'THE BACKLOT' },
  },
  rows: MAIN_STREET.map((row, y) => row + BACKLOT[y]),
  entries: { lens: { x: 1.5, y: 19.5, dir: 'right' } },
  marks: {
    d: warp('D', 'showbooth', 'lens1'),
    // Main Street. The safe marks stand either side of the manhole (the far one at the ladder's foot).
    '2': { ent: { t: 'enemy', kind: 'blob' } },
    '3': { ent: { t: 'enemy', kind: 'sentry', dir: 'right' } },
    e: { ent: { t: 'ledge' } },
    f: { tile: 'Ħ', ent: { t: 'ledge' } },
    '1': chest('lateshow.key1', 'smallKey'),
    // The Backlot.
    '4': { ent: { t: 'enemy', kind: 'bat' } },
    '5': chest('lateshow.stomp', 'stomp', true),
    '6': { ent: { t: 'enemy', kind: 'blob' } },
    '7': chest('lateshow.nook', 'bits20'),
  },
}

export const REEL1986: MapDef = {
  id: 'reel1986',
  name: 'REEL TWO',
  kind: 'side',
  track: 'dungeon',
  realm: 'rerun',
  look: 'suburb',
  keyring: 'lateshow',
  resume: true,
  era: '1986',
  cell: { w: 16, h: 24 },
  cells: { '0,0': { name: 'THE VIDEO STORE', card: { title: '1986.', lines: ['THE TAPE HAS BEEN PLAYED', 'MANY TIMES. YOU CAN TELL.'] } } },
  rows: VIDEO_STORE,
  entries: { lens: { x: 1.5, y: 20.5, dir: 'right' }, road: { x: 12.5, y: 12.5, dir: 'left' } },
  marks: {
    d: warp('D', 'showbooth', 'lens2'),
    r: warp('>', 'chase1986', 'start'),
    k: sign('BE KIND. REWIND. THIS ONE REWINDS ITSELF.'),
    '2': foe('blob'),
    '6': chest('lateshow.piece', 'heartPiece'),
  },
}

export const CHASE1986: MapDef = {
  id: 'chase1986',
  name: 'THE ROAD',
  kind: 'side',
  track: 'dungeon',
  realm: 'rerun',
  look: 'suburb',
  keyring: 'lateshow',
  resume: true,
  era: '1986',
  cell: { w: 64, h: 24 },
  autoscroll: { vx: 3.4, from: 0, to: 48, wait: 1.5 },
  cells: {
    '0,0': {
      name: 'THE ROAD',
      card: { title: 'MEANWHILE...', lines: ['THE ROAD DOES NOT END.', 'IT JUST STOPS BEING FILMED.'] },
      events: [{ when: { notFlag: 'lateshow.copilot' }, lines: ['COPILOT. ONE OF THEM IS DRIVING.'], set: 'lateshow.copilot.card' }],
    },
  },
  rows: ROAD,
  entries: { start: { x: 3.5, y: 20.5, dir: 'right' } },
  marks: {
    d: warp('D', 'reel1986', 'road'),
    x: warp('D', 'showbooth', 'lens2'),
    // (Its row is the road it drives on.)
    c: { ent: { t: 'enemy', kind: 'copilot', once: 'lateshow.copilot' } },
    e: { ent: { t: 'ledge' } },
    '5': { ent: { t: 'chest', id: 'lateshow.key2', item: 'smallKey', appear: { flag: 'lateshow.copilot' } } },
  },
}

export const REEL2086: MapDef = {
  id: 'reel2086',
  name: 'REEL THREE',
  kind: 'side',
  track: 'lab',
  realm: 'rerun',
  look: 'suburb',
  keyring: 'lateshow',
  resume: true,
  era: '2086',
  cell: { w: 16, h: 24 },
  cells: {
    '0,0': { name: 'THE OVERGROWN LOT', card: { title: '2086.', lines: ['NOBODY IS WATCHING.', 'IT KEPT GOING.'] } },
    '1,0': { name: 'THE LAST REEL' },
  },
  rows: LOT.map((row, y) => row + LAST_REEL[y]),
  entries: { lens: { x: 1.5, y: 20.5, dir: 'right' } },
  marks: {
    d: warp('D', 'showbooth', 'lens3'),
    f: warp('D', 'showbooth', 'lens3'),
    '3': chest('lateshow.key3', 'smallKey'),
    '4': foe('bat'),
    '2': foe('blob'),
    '7': chest('lateshow.bigkey', 'bigKey', true),
  },
}

export const WEAVER: MapDef = {
  id: 'weaver',
  name: 'THE SCREEN',
  kind: 'side',
  track: 'boss',
  realm: 'rerun',
  look: 'suburb',
  keyring: 'lateshow',
  resume: true,
  era: 'screen',
  cell: { w: 16, h: 24 },
  cells: { '0,0': { name: 'THE SCREEN', events: [{ when: { notFlag: 'weaver' }, lines: ['THE UNCANNY WEAVER. IT HAS DRAWN A THOUSAND HANDS. IT HAS NEVER SEEN ONE.'], set: 'weaver.card' }] } },
  rows: SCREEN,
  entries: { stair: { x: 2.5, y: 20.5, dir: 'right' } },
  marks: { u: warp('>', 'showbooth', 'kdoor') },
}

/** This dungeon's maps by id (`lands.ts` takes them into the world). */
export const MAPS: Record<string, MapDef> = { showbooth: SHOWBOOTH, reel1958: REEL1958, reel1986: REEL1986, chase1986: CHASE1986, reel2086: REEL2086, weaver: WEAVER }
