/**
 * THE LIGHTHOUSE (maps `lighthouse0` to `lighthouse3`), Yule Fjord's dungeon: a tower at the fjord's mouth, climbed
 * in the dark with one light, the STORM LAMP (docs/games/neon-shrine-lighthouse.md; docs/worlds/atlas.md, "Yule
 * Fjord"). Four maps of two rooms each, all 32×12, one keyring. The cellar counts as a floor.
 *
 *   FLOOR 3  lighthouse3   (0,0) THE GALLERY (dark)       (1,0) THE LAMP ROOM (boss, dark)
 *   FLOOR 2  lighthouse2   (0,0) THE QUARTERS (dark)      (1,0) THE OIL STORE (hound, dark)
 *   FLOOR 1  lighthouse1   (0,0) THE FOOT (entry, hub)    (1,0) THE PARLOUR (the lamp)
 *   CELLAR   lighthouse0   (0,0) THE ICE STORE            (1,0) THE FLOODED CELLAR (Orca)
 *
 * The route: the door in Yule Fjord into the Foot; east, the Parlour, where the lamp lies and is taught in the
 * light (its receiver gives small key A); west, the stair down to the Ice Store (two mirrors on salt ice; its
 * receiver drains the sluice) and past it the Flooded Cellar, where a hound stands in for Orca (small key B). Key A
 * or B opens the Foot's north alcove (the stair up) to the Quarters (dark: a receiver across the rotten boards lights
 * it for good; a second one, past a bend that wants a pushed mirror, opens the heart piece's gate); its east door
 * takes the second key into the Oil Store, where a hound stands in for the dark one (the Big Key, and the gate over
 * the stair); the Gallery (a ring of walkway round a block of wall, three mirrors on its corners and two draugs)
 * and its Big-Key door into the Lamp Room, which here has no Box in it.
 *
 * - Lit: the Foot, the Parlour, the Ice Store and the Flooded Cellar. Dark: the four rooms above. A dark room is
 *   dim to a hero who owns the lamp, and lit for good once its `lit` flag is set (a receiver).
 * - The Foot is the hub: no foe in it, nor in the Parlour, the cellar's Ice Store or the Lamp Room. Three foes a room
 *   at most.
 * - Holes: the Quarters' rotten boards drop the hero, unhurt, onto the Foot at the same place (`below`).
 * - Both views: `views: ['iso']` as the land and the Underglow; the 8-bit painter is the fallback.
 * - `resume`: a reload of the tab inside the tower continues at its last stair or door (not `away`: no seen:<id>
 *   flag, no area words, no MAP page world).
 */
import type { EntDef, MapDef, Mark, TalkBranch } from '../types'
import { joinCells } from './cells'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })

// ---------------------------------------------------------------------------
// FLOOR 1: the Foot and the Parlour
// ---------------------------------------------------------------------------

const FOOT = [
  '################',
  '#######vv#######',
  '#######LL#######',
  '#.......q......#',
  '#I..I......I...#',
  '#Ve.............',
  '#V..............',
  '#I.............#',
  '#.W............#',
  '#...a..........#',
  '#......@.......#',
  '#######D########',
]

// A wall of pillars with a one-row gap (row 6): the beam must be set in that row. The receiver stands in the east, the
// chest of small key A behind it.
const PARLOUR = [
  '################',
  '#.......I......#',
  '#.j....hI......#',
  '#.......I......#',
  '#.......I......#',
  '........I......#',
  '.............uk#',
  '#.......I......#',
  '#.......I......#',
  '#.......I......#',
  '#.......I......#',
  '################',
]

export const LIGHTHOUSE1: MapDef = {
  id: 'lighthouse1',
  name: 'THE LIGHTHOUSE',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'snow',
  realm: 'yulefjord',
  views: ['iso'],
  keyring: 'lighthouse',
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE FOOT' },
    '1,0': { name: 'THE PARLOUR' },
  },
  rows: joinCells([[FOOT, PARLOUR]]),
  marks: {
    // The door in Yule Fjord; the stair down to the cellar; the stair up (behind the lock); and where each lands.
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'yulefjord', entry: 'lighthousedoor' } },
    V: { tile: '>', ent: { t: 'warp', to: 'lighthouse0', entry: 'stair' } },
    e: { ent: { t: 'entry', id: 'cellar', dir: 'right' } },
    q: { ent: { t: 'entry', id: 'quarters', dir: 'down' } },
    v: { tile: '>', ent: { t: 'warp', to: 'lighthouse2', entry: 'arrive' } },
    W: npc('lighthouse.wick', 'cat', [{ lines: ['(THE CAT SITS AT THE STAIRS. IT HAS THE LOOK OF SOMEONE WHO WENT UP ONCE.)'] }]),
    a: sign("LIGHTHOUSE: 4 FLOORS, NO LIFT.\nKEEPER'S PARLOUR: EAST.\nDON'T STAY FOR TEA."),
    // The Parlour: the lamp, the keeper's log, the receiver and the key it gives.
    h: { ent: { t: 'chest', id: 'lighthouse1.lamp', item: 'lamp', big: true } },
    j: sign('NIGHT 1: BEAM OUT. BEAM BACK.\nNIGHT 90: BEAM OUT.\nSOMETHING BACK.'),
    u: { ent: { t: 'receiver', flag: 'lighthouse.parlour' } },
    k: { ent: { t: 'chest', id: 'lighthouse1.keyA', item: 'smallKey', appear: { flag: 'lighthouse.parlour' } } },
  },
}

// ---------------------------------------------------------------------------
// The CELLAR: the Ice Store and the Flooded Cellar
// ---------------------------------------------------------------------------

// Salt ice from the rim to the east wall: a lamp cannot stand on it, and the only way a beam gets into the sluice's eye
// (the receiver in the east wall, row 3) is east along row 3 from a mirror resting at (13,3), which only a mirror sent up
// column 13 gets to, and that mirror needs a beam turned up out of row 6 by a second one. Two mirrors on the rim, both
// pushed over the ice and turned by the blade; the lamp on the rim in row 6. The doorway to the cellar is the water at
// the east end of rows 5 and 6.
const ICE_STORE = [
  '################',
  '################',
  '################',
  '#IIIαααααααααααu',
  '#a..ααααααααααα#',
  '#...ααααααααααww',
  '#..νααααααααααww',
  '#...αααααααααα##',
  '#..ναααααααααα##',
  '#...αααααααααα##',
  '#@..αααααααααα##',
  '#V##############',
]

// The basin is drained when the hero comes in (all sluice floor), a rim round it; the gate shuts behind him.
const FLOODED = [
  '################',
  '#..............#',
  '#.............z#',
  '#..wwwwwwwwww..#',
  '#..wwwIwwwwww..#',
  'g..wwwwwwwwww..#',
  'X..wwwwwwwwww..#',
  '#..wwwwwwwIww..#',
  '#..wwwwwwwwww..#',
  '#............k.#',
  '#..............#',
  '################',
]

export const LIGHTHOUSE0: MapDef = {
  id: 'lighthouse0',
  name: 'THE LIGHTHOUSE',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'snow',
  realm: 'yulefjord',
  views: ['iso'],
  keyring: 'lighthouse',
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE ICE STORE' },
    '1,0': { name: 'THE FLOODED CELLAR' },
  },
  rows: joinCells([[ICE_STORE, FLOODED]]),
  marks: {
    '@': { ent: { t: 'entry', id: 'stair', dir: 'up' } },
    V: { tile: '>', ent: { t: 'warp', to: 'lighthouse1', entry: 'cellar' } },
    // The sluice's eye in the Ice Store, and the water it holds back (the doorway, the Flooded Cellar's basin).
    a: sign('COLD STORE.\nTHE SEA CAME IN ONE NIGHT\nAND WAS NEVER ASKED TO LEAVE.'),
    u: { ent: { t: 'receiver', flag: 'lighthouse.drained' } },
    w: { tile: 'ω', ent: { t: 'sluice', flag: 'lighthouse.drained' } },
    // The Flooded Cellar: the gate shuts behind the hero while the hound lives; its fall opens it and the chest of key B.
    g: { tile: 'X', ent: { t: 'gate', trap: true } },
    z: { ent: { t: 'enemy', kind: 'hound', tough: true, once: 'lighthouse.orca', dir: 'left' } },
    k: { ent: { t: 'chest', id: 'lighthouse0.keyB', item: 'smallKey', appear: { flag: 'lighthouse.orca' } } },
  },
}

// ---------------------------------------------------------------------------
// FLOOR 2: the Quarters and the Oil Store
// ---------------------------------------------------------------------------

// Rotten boards down the middle (a way across at rows 5 and 6): a beam crosses them; the lamp is refused on one. West
// of them the receiver that lights the room. The heart's receiver stands in the south-east corner behind a board and a
// pillar: only a beam sent down from the nook at (14,8) reaches it, and a lamp set in the nook shines the way its hero
// faced, east into the wall, so the mirror goes into the nook (pushed east along row 8), is turned, and the lamp is
// set west of it on that row.
const QUARTERS = [
  '################',
  '#.nn..#......#h#',
  '#.....#....d.#N#',
  '#u....O........#',
  '#...d.O........#',
  '#..............L',
  '#..............L',
  '#.....O.......##',
  '#..d..O.....μ..#',
  '#.....O.......O#',
  '#.....O..@...Iy#',
  '#########VV#####',
]

const OIL_STORE = [
  '################',
  '#######vv#######',
  '#######GX#######',
  '#.......q......#',
  '#..o....I...o..#',
  'g..............#',
  'X............z.#',
  '#...n.......n..#',
  '#.o.........o..#',
  '#.........k....#',
  '#..............#',
  '################',
]

export const LIGHTHOUSE2: MapDef = {
  id: 'lighthouse2',
  name: 'THE LIGHTHOUSE',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'snow',
  realm: 'yulefjord',
  views: ['iso'],
  keyring: 'lighthouse',
  resume: true,
  below: 'lighthouse1',
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': {
      name: 'THE QUARTERS',
      dark: true,
      lit: 'lighthouse.quarters',
      events: [{ lines: ['(THE BED IS MADE. THE PILLOW IS WARM. NOBODY IS HOME.)'], set: 'lighthouse.quarters.met' }],
    },
    '1,0': { name: 'THE OIL STORE', dark: true },
  },
  rows: joinCells([[QUARTERS, OIL_STORE]]),
  marks: {
    '@': { ent: { t: 'entry', id: 'arrive', dir: 'up' } },
    V: { tile: '>', ent: { t: 'warp', to: 'lighthouse1', entry: 'quarters' } },
    // The Quarters: the receiver across the boards (the room lit for good), the one in the corner (the heart's gate).
    u: { ent: { t: 'receiver', flag: 'lighthouse.quarters' } },
    y: { ent: { t: 'receiver', flag: 'lighthouse.heart' } },
    N: { tile: 'X', ent: { t: 'gate', open: { flag: 'lighthouse.heart' } } },
    h: { ent: { t: 'chest', id: 'lighthouse2.heart', item: 'heartPiece' } },
    d: { ent: { t: 'enemy', kind: 'bat' } },
    // The Oil Store: the gate shuts behind the hero while the hound lives; its fall gives the Big Key and opens the stair.
    g: { tile: 'X', ent: { t: 'gate', trap: true } },
    z: { ent: { t: 'enemy', kind: 'hound', tough: true, once: 'lighthouse.hound', dir: 'left' } },
    k: { ent: { t: 'chest', id: 'lighthouse2.bigkey', item: 'bigKey', big: true, appear: { flag: 'lighthouse.hound' } } },
    G: { tile: 'X', ent: { t: 'gate', open: { flag: 'lighthouse.hound' } } },
    v: { tile: '>', ent: { t: 'warp', to: 'lighthouse3', entry: 'up' } },
    q: { ent: { t: 'entry', id: 'fromgallery', dir: 'down' } },
  },
}

// ---------------------------------------------------------------------------
// FLOOR 3: the Gallery and the Lamp Room
// ---------------------------------------------------------------------------

// A walkway two tiles wide round a block of wall: a lamp is a solid thing and never closes it. Three mirrors on the
// inner corners (the blade turns them), the receiver by the stair, and a gate in front of the Big-Key door that opens
// on it. Two draugs walk the ring.
const GALLERY = [
  '################',
  '#.....s........#',
  '#.ν..........μ.#',
  '#..##########..#',
  '#..##########..#',
  '#..##########.GK',
  '#..##########.XK',
  '#..##########..#',
  '#..##########..#',
  '#..ρ.........ν.#',
  '#.@........s...#',
  '#VV#############',
]

// A room of open floor with rock corners; the pedestal (3×3) in the middle and four lanes out of its faces, their
// floor laid as path. Three receivers, north, east and west. No Box yet.
const LAMP_ROOM = [
  '#####......#####',
  '###..........###',
  '##.....,1,....##',
  '#......,,,.....#',
  '#......,,,.....#',
  '..,,,,,ΞΞΞ,,,,.#',
  '..3,,,,ΞΞΞ,,,2.#',
  '#.,,,,,ΞΞΞ,,,,.#',
  '#......,,,.....#',
  '#......,,,.....#',
  '##.....,,,....##',
  '#####......#####',
]

export const LIGHTHOUSE3: MapDef = {
  id: 'lighthouse3',
  name: 'THE LIGHTHOUSE',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'snow',
  realm: 'yulefjord',
  views: ['iso'],
  keyring: 'lighthouse',
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE GALLERY', dark: true, lit: 'lighthouse.gallery' },
    '1,0': { name: 'THE LAMP ROOM', dark: true, lit: 'lighthouse.box', track: 'boss' },
  },
  rows: joinCells([[GALLERY, LAMP_ROOM]]),
  marks: {
    '@': { ent: { t: 'entry', id: 'up', dir: 'up' } },
    V: { tile: '>', ent: { t: 'warp', to: 'lighthouse2', entry: 'fromgallery' } },
    // The Gallery: two draugs on the ring; the receiver by the stair lights the room for good and opens the gate in front of the Big-Key door.
    s: { ent: { t: 'enemy', kind: 'skull' } },
    ρ: { ent: { t: 'receiver', flag: 'lighthouse.gallery' } },
    G: { tile: 'X', ent: { t: 'gate', open: { flag: 'lighthouse.gallery' } } },
    // The Lamp Room's three receivers (flags `lighthouse.box.n`, `.e`, `.w`).
    '1': { ent: { t: 'receiver', flag: 'lighthouse.box.n' } },
    '2': { ent: { t: 'receiver', flag: 'lighthouse.box.e' } },
    '3': { ent: { t: 'receiver', flag: 'lighthouse.box.w' } },
  },
}

/** This land's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = { lighthouse0: LIGHTHOUSE0, lighthouse1: LIGHTHOUSE1, lighthouse2: LIGHTHOUSE2, lighthouse3: LIGHTHOUSE3 }
