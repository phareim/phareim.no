/**
 * Under the Shrine's pedestal (docs/games/neon-shrine-balance.md): THE BALANCE, the three store rooms before the
 * machine (the Counting Room, the Dark Store, the Loading Bay) and THE SUPPLY ROOM. The Shrine's own dungeon walls
 * and floor; a reload continues at the last stair used.
 */
import type { MapDef } from '../types'

const BALANCE: MapDef = {
  id: 'balance',
  name: 'THE BALANCE',
  kind: 'dungeon',
  track: 'dungeon',
  keyring: 'supply',
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': {
      name: 'THE BALANCE',
      events: [
        { lines: ['(SEVEN EMPTY PANS. A COUNTER THAT HAS NEVER MOVED.)'], set: 'balance.seen' },
        { when: { flag: 'balance.level' }, lines: ['(THE BALANCE COMES LEVEL. BELOW, SOMETHING NOTICES.)'], set: 'balance.leveled' },
      ],
    },
  },
  rows: [
    '################',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#......FF......#',
    '#......FF......#',
    '#.......H......#',
    '#....S.........#',
    '#.......@......#',
    '#......VV......#',
    '################',
  ],
  marks: {
    // The floor opens once the pans are full.
    'F': { tile: '>', ent: { t: 'warp', to: 'supply', entry: 'in', when: { flag: 'balance.level' } } },
    'H': { ent: { t: 'entry', id: 'hole', dir: 'down' } },
    'S': { ent: { t: 'sign', lines: ['ON LOAN FOR SAFEKEEPING. RETURN DATE: LEFT BLANK.'], alt: { when: { flag: 'maximizer' }, lines: ['RETURNED. SEVEN OF SEVEN. THE DEPARTMENT THANKS YOU FOR YOUR PATIENCE.'] } } },
    '@': { ent: { t: 'entry', id: 'lid', dir: 'up' } },
    'V': { tile: '>', ent: { t: 'warp', to: 'shrine', entry: 'lid' } },
  },
}

/** South to north: the Counting Room, the Dark Store, the Loading Bay. */
const SUPPLY: MapDef = {
  id: 'supply',
  name: 'THE STORE ROOMS',
  kind: 'dungeon',
  track: 'dungeon',
  keyring: 'supply',
  resume: true,
  lamplit: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE LOADING BAY' },
    '0,1': { name: 'THE DARK STORE', dark: true, lit: 'supply.lit' },
    '0,2': { name: 'THE COUNTING ROOM' },
  },
  rows: [
    '################',
    '#...###UU###...#',
    '#.J.###gX###...#',
    '#.......Q......#',
    '#..............#',
    '#...h......h...#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#......a.......#',
    '#..............#',
    '###..######..###',
    '###LL######eX###',
    '#.t..ttρt.t..t.#',
    '#..............#',
    '#.k............#',
    '#..............#',
    '#...t......t...#',
    '#.....□□□□.....#',
    '#..............#',
    '#..............#',
    '#.........b....#',
    '#..............#',
    '#######..#######',
    '#######GX#######',
    '#.H.#..........#',
    '#...#.I....I...#',
    '##jX#..........#',
    '#..............#',
    '#.p........q..▣#',
    '#.....m....n..▣#',
    '#.2...........▣#',
    '#....I....I....#',
    '#.......@..d...#',
    '#......VV......#',
    '################',
  ],
  marks: {
    // The Loading Bay: two tough hounds, and the lever in its alcove opens the way up.
    'U': { tile: '>', ent: { t: 'warp', to: 'supplyroom', entry: 'in' } },
    'g': { tile: 'X', ent: { t: 'gate', open: { flag: 'supply.lever3' } } },
    'J': { ent: { t: 'lever', flag: 'supply.lever3' } },
    'Q': { ent: { t: 'entry', id: 'fromhall', dir: 'down' } },
    'h': { ent: { t: 'enemy', kind: 'hound', tough: true, dir: 'down' } },
    'a': { ent: { t: 'sign', lines: ['LOADING BAY. NOTHING LEAVES WITHOUT A COUNT.'] } },
    // The Dark Store: the receiver behind the square blocks (the Lamp's way), the chest only the glass shows (the Lens's).
    'e': { tile: 'X', ent: { t: 'gate', open: { flag: 'supply.lit' } } },
    'ρ': { tile: 'ρ', ent: { t: 'receiver', flag: 'supply.lit' } },
    'k': { ent: { t: 'chest', id: 'supply.key', item: 'smallKey', hidden: true } },
    'b': { ent: { t: 'sign', lines: ['STORE B. THE LIGHT IS ON ORDER. SO IS THE REST.'] } },
    // The Counting Room. Its plates take any weight: the hero, the echo, an iron crate.
    'G': { tile: 'X', ent: { t: 'gate', open: { plates: ['p1', 'p2'] } } },
    'p': { tile: 'θ', ent: { t: 'plate', id: 'p1' } },
    'q': { tile: 'θ', ent: { t: 'plate', id: 'p2' } },
    'j': { tile: 'X', ent: { t: 'gate', open: { plates: ['h1', 'h2', 'h3'] } } },
    'H': { ent: { t: 'chest', id: 'supply.heart', item: 'heartPiece' } },
    '2': { tile: 'θ', ent: { t: 'plate', id: 'h1' } },
    'm': { tile: 'θ', ent: { t: 'plate', id: 'h2' } },
    'n': { tile: 'θ', ent: { t: 'plate', id: 'h3' } },
    'd': { ent: { t: 'sign', lines: ['COUNTING ROOM. EVERYTHING HERE HAS BEEN COUNTED TWICE.'] } },
    '@': { ent: { t: 'entry', id: 'in', dir: 'up' } },
    'V': { tile: '>', ent: { t: 'warp', to: 'balance', entry: 'hole' } },
  },
}

const SUPPLYROOM: MapDef = {
  id: 'supplyroom',
  name: 'THE SUPPLY ROOM',
  kind: 'dungeon',
  track: 'dungeon',
  keyring: 'supply',
  resume: true,
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': {
      name: 'THE SUPPLY ROOM',
      track: 'boss',
      // The card, the first clip, and the two later parts as they begin (`engine/bossMaximizer.ts` sets the flags).
      events: [
        { lines: ['THE PAPERCLIP MAXIMIZER.', 'IT WAS ASKED FOR ENOUGH. NOBODY SAID HOW MANY THAT WAS.'], set: 'maximizer.card' },
        { when: { flag: 'maximizer.sawclip' }, lines: ['(ONE OF YOUR HEARTS IS A PAPER CLIP NOW.)'], set: 'maximizer.clipline' },
        { when: { flag: 'maximizer.p2' }, lines: ['IT HAS BEGUN TO COUNT YOU.'], set: 'maximizer.t2' },
        { when: { flag: 'maximizer.p3' }, lines: ['(THE WEIGHTS COME DOWN, ONE AT A TIME.)'], set: 'maximizer.t3' },
      ],
    },
  },
  rows: [
    '################',
    '#..............#',
    '#..............#',
    '#.......m......#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#.......@.S....#',
    '#######gX#######',
    '#######WW#######',
  ],
  marks: {
    // Its home: the north middle. Felled (part of the second ending), it is gone for good.
    'm': { ent: { t: 'enemy', kind: 'maximizer', once: 'maximizer' } },
    '@': { ent: { t: 'entry', id: 'in', dir: 'up' } },
    'S': { ent: { t: 'sign', lines: ['SUPPLY ROOM. QUANTITY: ENOUGH.'] } },
    // Shuts behind the hero while something in here lives; open while nothing does.
    'g': { tile: 'X', ent: { t: 'gate', trap: true } },
    'W': { tile: 'D', ent: { t: 'warp', to: 'supply', entry: 'fromhall' } },
  },
}

export const MAPS: Record<string, MapDef> = { balance: BALANCE, supply: SUPPLY, supplyroom: SUPPLYROOM }
