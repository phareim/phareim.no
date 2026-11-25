/**
 * Places the generator sets down in a region: small grids of tile chars plus
 * the stamp's own slots, which the generator fills from the realm:
 *
 *   ' '  leave the land as it is        '1'  someone of the realm's folk
 *   '2'  a chest (the realm's loot)      '3'  a foe of the realm
 *   '4'  the region's camp: the entry death and the ferry bring you to
 *   '5'  stairs down into a cave (a generated dungeon)
 *   '6'  a sign with the realm's lore    '7'  a chest with a heart piece (rare)
 *   '8'  the ferry back to town (the Landing only)
 *
 * Every other char is a tile (types.ts). A stamp's edge row should be open
 * ground, so the road can reach it from any side.
 */
import type { Prop } from '../../types'

export interface Stamp {
  rows: string[]
  /** Set dressing, in the stamp's tile units. */
  props?: Prop[]
  /** Keep this stamp off the region's edge band by this much more (big places). */
  pad?: number
}

export const STAMPS: Record<string, Stamp> = {
  camp: {
    rows: [
      ' ,,,,, ',
      ',,t6t,,',
      ',,,4,,,',
      ' ,,,,, ',
    ],
  },
  landing: {
    rows: [
      '~~~~~~~~~~~',
      '~~~~~=~~~~~',
      '~~~~~8~~~~~',
      '~~~~~=~~~~~',
      '---t-=-t---',
      '-----,-----',
      '--6--4--1--',
      '-----,-----',
      ' ,,,,,,,,, ',
    ],
    pad: 0,
  },
  house: {
    rows: [
      '.......',
      '.HHHHH.',
      '.HHHHH.',
      '.HHHHH.',
      '..t.1..',
      '.......',
    ],
  },
  hamlet: {
    rows: [
      '..............',
      '.HHHH....HHHH.',
      '.HHHH....HHHH.',
      '.HHHH.,,.HHHH.',
      '..1..,,,,..t..',
      '..,,,,t6,,,,..',
      '.t..,,,,,,.1..',
      '.HHHH.,,.HHHH.',
      '.HHHH....HHHH.',
      '.HHHH..1.HHHH.',
      '..............',
    ],
    pad: 1,
  },
  shrine: {
    rows: [
      '.......',
      '.I.,.I.',
      '..,2,..',
      '.I.,.I.',
      '.......',
    ],
  },
  relic: {
    rows: [
      '.........',
      '.I#####I.',
      '.#..3..#.',
      '.#.,7,.#.',
      '.I##,##I.',
      '....,....',
    ],
    pad: 1,
  },
  graves: {
    rows: [
      '.......',
      '.G.G.G.',
      '.......',
      '.G.3.G.',
      '.......',
    ],
  },
  cave: {
    rows: [
      ' ##### ',
      '###5###',
      '#.,,,.#',
      '..,,,..',
    ],
  },
  pond: {
    rows: [
      ' ::::: ',
      ':~~~~~:',
      ':~~~~~:',
      ' ::2:: ',
    ],
  },
  market: {
    rows: [
      '.........',
      '.n.n.n.n.',
      '.1.,.,.1.',
      '..,,,,,..',
      '...t6t...',
    ],
  },
  ruin: {
    rows: [
      '........',
      '.##.#.#.',
      '.#..o..#',
      '...3..o.',
      '.#.o...#',
      '.#.##.#.',
      '........',
    ],
  },
  grove: {
    rows: [
      '  :::  ',
      ' :TTT: ',
      ':TT1TT:',
      ' :T,T: ',
      '  :,:  ',
    ],
  },
  stones: {
    rows: [
      '.......',
      '.r.I.r.',
      '..,,,..',
      '.I,2,I.',
      '..,,,..',
      '.r.I.r.',
      '.......',
    ],
  },
}
