/**
 * THE LATE SHOW: under the drive-in screen of Rerun Estates, where the picture has been the same for three nights
 * and there is a door in the middle of it (docs/worlds/atlas.md, "The Late Show"). A projection booth seen from
 * above, and reels of film played from the side (`kind: 'side'`), each dressed in its year (`render/eras.ts`) and
 * opened by an intertitle card (`engine/cards.ts`). One keyring, `lateshow`.
 *
 *   showbooth   (0,0) THE SCAFFOLD   (1,0) THE BOOTH   (2,0) rock
 *   reel1958    (0,0) MAIN STREET    (1,0) THE BACKLOT
 *   reel1986    (0,0) THE VIDEO STORE (its floor and its way out)
 *
 * The route: the screen's door, the Scaffold, the Booth; the 1958 lens; Main Street, with a small key on the shop
 * roof; the Backlot, where THE STOMP lies on the alcove ledge; back to the booth, whose locked lens (1986) the key
 * opens.
 *
 * - The side rooms are 16 wide and 24 tall: a phone held upright shows one whole, and large.
 * - A side room's floor is three tiles deep (its top on row 21), so that the hollows under a cracked floor fit.
 * - A nook is a one-tile hollow under a cracked floor with solid ground under it: the hero falls 2 into it and
 *   jumps out again. It is never an ordinary way on.
 * - Nothing hunts in the Scaffold or the Booth.
 */
import type { EntDef, MapDef, Mark } from '../types'
import { joinCells, ROCK } from './cells'

const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })
const warp = (tile: 'D' | '>', to: string, entry: string): Mark => ({ tile, ent: { t: 'warp', to, entry } })
const chest = (id: string, item: Extract<EntDef, { t: 'chest' }>['item'], big = false): Mark => ({ ent: { t: 'chest', id, item, ...(big ? { big: true } : {}) } })

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
const BOOTH = [
  '################',
  '####a######b####',
  '#..j......#Lk..#',
  '#m.............#',
  '#[............[#',
  '...............#',
  '........p......#',
  '#..............#',
  '#[....nnn.....[#',
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
  },
  rows: joinCells([[SCAFFOLD, BOOTH, ROCK]]),
  entries: {
    door: { x: 3.5, y: 5.5, dir: 'right' },
    // In front of each lens, never on it and never behind its lock.
    lens1: { x: 20.5, y: 3.5, dir: 'down' },
    lens2: { x: 27.5, y: 3.5, dir: 'down' },
  },
  // Each lens's year, painted on the floor in front of it, where both views show it whole.
  decals: [
    { x: 20.5, y: 4.3, text: '1958', tone: 'cream', scale: 1, align: 'center' },
    { x: 27.5, y: 4.3, text: '1986', tone: 'cream', scale: 1, align: 'center' },
  ],
  marks: {
    v: warp('>', 'rerun', 'screen'),
    a: warp('>', 'reel1958', 'lens'),
    b: warp('>', 'reel1986', 'lens'),
    j: sign('1958.'),
    k: sign('1986.'),
    m: sign('ONE REEL AT A TIME, PLEASE. THE NUMBERS ARE A SUGGESTION.'),
    p: { ent: { t: 'npc', id: 'showbooth.projectionist', look: 'vendor', talk: [{ lines: ['PROJECTIONIST: I HAVE SEEN IT SO OFTEN THAT IT HAS STARTED TO SEE ME BACK.'] }] } },
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

/** Reel two as far as it goes: its floor and its way back to the booth. */
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
  cells: { '0,0': { name: 'THE VIDEO STORE' } },
  rows: reel({
    20: 'd..............#',
    ...Object.fromEntries(Array.from({ length: 20 }, (_, y) => [y, '#..............#'])),
  }),
  entries: { lens: { x: 1.5, y: 20.5, dir: 'right' } },
  marks: { d: warp('D', 'showbooth', 'lens2') },
}

/** This dungeon's maps by id (`lands.ts` takes them into the world). */
export const MAPS: Record<string, MapDef> = { showbooth: SHOWBOOTH, reel1958: REEL1958, reel1986: REEL1986 }
