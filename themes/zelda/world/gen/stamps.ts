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

  // --- Lumenby Quarry -----------------------------------------------------------
  /** Chalk lots on the ground, each waiting for its house (dig & build fills them). */
  lots: {
    rows: [
      '...........',
      '.,,,,,.,,,.',
      '.,...,.,.,.',
      '.,...,.,.,.',
      '.,,.,,.,,,.',
      '.....6.....',
      '...........',
    ],
  },
  /** A rusted haul truck, sometimes with something in the back. */
  truck: {
    rows: [
      '......',
      '.ZZZ..',
      '....2.',
      '......',
    ],
    props: [{ kind: 'van', x: 2.5, y: 2 }],
  },
  /** The shift whistle's tower, out of order. */
  whistle: {
    rows: [
      '.......',
      '..rZr..',
      '.t.,.t.',
      '...,...',
    ],
    props: [{ kind: 'mast', x: 3.5, y: 2 }],
  },

  // --- Seter Fell ---------------------------------------------------------------
  /** A seter: turf-roofed huts round a meadow, a stone fence ring, the milk trough. */
  seter: {
    rows: [
      'FFFF,,,FFFF',
      'F.........F',
      'F.HHH.HHH.F',
      'F.HHH.HHH.F',
      'F.HHH.HHH.F',
      'F..1.:.1..F',
      'F.:.....:.F',
      'F..n.6.n..F',
      'F.........F',
      'FFFF,,,FFFF',
      '...........',
    ],
  },
  /** A troll asleep as a hill: rock, a nose stone, birches on its back. */
  trollhump: {
    rows: [
      '  .....  ',
      ' ..#T#.. ',
      '..##T##..',
      '.T#####r.',
      '..#####..',
      ' ..###.. ',
      '  ..,..  ',
    ],
  },
  /** A haug: a grassy mound with a tusse home under it. */
  mound: {
    rows: [
      ' ;;;;; ',
      ';;***;;',
      ';**G**;',
      ';;*,*;;',
      ' ;;,;; ',
    ],
  },
  /** Cairns along the path; a lantern cairn where the paths meet. */
  cairns: {
    rows: [
      '.......',
      '.I.t.I.',
      '..,6,..',
      '...,...',
    ],
  },

  // --- Yule Fjord ---------------------------------------------------------------
  /** A fishing hamlet on the shelf: stilt-huts, a pier into the fjord, drying racks. */
  stilts: {
    rows: [
      ' ~~~~=~~~~ ',
      ' ~~~~=~~~~ ',
      '.....=.....',
      '.HHH.,.HHH.',
      '.HHH.,.HHH.',
      '.HHH.,.HHH.',
      '..1.,,,.1..',
      '.F.,,6,,.F.',
      '.F..,t,..F.',
      '....,,,....',
    ],
  },
  /** A boathouse on the strand. */
  boathouse: {
    rows: [
      '~~~~~~~',
      '~HHHHH~',
      '~HHHHH~',
      '-HHHHH-',
      '--,1,--',
      '-------',
    ],
  },
  /** Stockfish drying racks. */
  racks: {
    rows: [
      '.......',
      '.F.F.F.',
      '.......',
      '.F.F.F.',
      '...2...',
    ],
  },
  /** The lighthouse at the fjord's mouth, its keeper awake. */
  lighthouse: {
    rows: [
      '-------',
      '--ttt--',
      '--HHH--',
      '-tHHHt-',
      '--HHH--',
      '---1---',
      '-------',
    ],
  },

  // --- Stillsand ----------------------------------------------------------------
  /** An island over the dunes: cliffs all round, a root tree and its hum-quartz on top. */
  island: {
    rows: [
      '  ----  ',
      ' -####- ',
      '-##T:##-',
      '-#:::T#-',
      '-##:I##-',
      ' -####- ',
      '  -,,-  ',
    ],
  },
  /** A giant stone bird's ribs, walkable under. */
  ribs: {
    rows: [
      '---------',
      '-I-----I-',
      '--I---I--',
      '---I-I---',
      '---------',
      '---I-I---',
      '--I-2-I--',
      '-I-----I-',
      '----,----',
    ],
  },
  /** An oasis: a pond, reeds, a cyan lamp. */
  oasis: {
    rows: [
      ' ;;;;; ',
      ';~~~~~;',
      ';~~~~~;',
      'T;;t;;T',
      '--,1,--',
      '---,---',
    ],
  },
  /** A Warden, half-buried, waiting for a beam. */
  warden: {
    rows: [
      '-----',
      '-r-r-',
      '--I--',
      '-r3r-',
      '--,--',
    ],
  },
  /** A caravan camped on the sand: tents round a fire. */
  caravan: {
    rows: [
      '---------',
      '-ZZ---ZZ-',
      '----1----',
      '----Z----',
      '--1---2--',
      '---------',
    ],
    props: [{ kind: 'tent', x: 2, y: 2 }, { kind: 'tent', x: 7, y: 2, tone: 'cyan' }, { kind: 'campfire', x: 4.5, y: 4 }],
  },

  // --- the Sporelight -----------------------------------------------------------
  /** A clean well: a ring of flowers round stairs down into the Under (a cave). */
  well: {
    rows: [
      ' ::::: ',
      ':#####:',
      ':##5##:',
      ':.,,,.:',
      ' ::,:: ',
    ],
  },
  /** A clicker clearing: flowers, a spirit, caps in a line pointing somewhere. */
  clickers: {
    rows: [
      ' ::::: ',
      ':.:.:.:',
      ':.,1,.:',
      ':.:,:.:',
      ' ::,:: ',
    ],
  },
  /** A shellyard: grazers' shed shells, one of them hollow. */
  shellyard: {
    rows: [
      '.......',
      '.r.r.r.',
      '..r2r..',
      '.r...r.',
      '...,...',
    ],
  },
  /** A ridge hamlet whose windmill keeps the haze down. */
  windmill: {
    rows: [
      '.........',
      '..HHH.Z..',
      '..HHH....',
      '..HHH....',
      '.t.,1,.t.',
      '....,....',
    ],
    props: [{ kind: 'mast', x: 6.5, y: 2 }],
  },

  // --- Fogstage -----------------------------------------------------------------
  /** A hill town above the fog: cliffs with footlights, houses, the ticket booth at the ramp. */
  hilltown: {
    rows: [
      '..t.t.t.t.t..',
      '.###########.',
      '.#.HHH.HHH.#.',
      '.#.HHH.HHH.#.',
      '.#.HHH.HHH.#.',
      '.#..1...1..#.',
      '.#.:.,,,.:.#.',
      '.#.HHH,n6..#.',
      '.#.HHH,....#.',
      '.#.HHH,....#.',
      '.####,,,####.',
      '.t...,,,...t.',
      '.............',
    ],
    pad: 1,
  },
  /** A ghost light: one bare lamp in the fog, where no fight starts. */
  ghostlight: {
    rows: [
      ' ,,, ',
      ',,t,,',
      ',,,,,',
      ' ,,, ',
    ],
  },
  /** Scenery flats: a painted fence and its sign (a castle, a moon, a ship). */
  flats: {
    rows: [
      '.......',
      '.FFFF6.',
      '.......',
    ],
  },
  /** A reed bed, and something waiting in it. */
  reeds: {
    rows: [
      ' ;;;; ',
      ';;;;;;',
      ';;3;;;',
      ' ;;;; ',
    ],
  },

  // --- Rerun Estates ------------------------------------------------------------
  /** A cul-de-sac: a turning circle with a lamp in it, houses round. */
  culdesac: {
    rows: [
      '.HHH.....HHH.',
      '.HHH.....HHH.',
      '.HHH.....HHH.',
      '..,..,,,..,..',
      '..,,,,,,,,,..',
      '.6.,,,t,,,.:.',
      '...,,,,,,,...',
      '.HHH.,,,.HHH.',
      '.HHH.,,,.HHH.',
      '.HHH.,1,.HHH.',
      '.....,,,.....',
    ],
    pad: 1,
  },
  /** A lot: a house, a drive, a mailbox, a fence, sometimes a pool. */
  lot: {
    rows: [
      '.........',
      '..HHHH.T.',
      '..HHHH...',
      '.:HHHH:..',
      '....,..1.',
      '.6..,..~~',
      'FFF.,.FFF',
      '.........',
    ],
  },
  /** A phone booth on a corner (one day it saves, and jumps years). */
  booth: {
    rows: [
      '.....',
      '.M.6.',
      '.,,,.',
      '.....',
    ],
  },
  /** A hedge maze with something in the middle. */
  hedgemaze: {
    rows: [
      '*********',
      '*...*...*',
      '*.*.*.*.*',
      '*.*...*.*',
      '*.**2**.*',
      '*.......*',
      '****,****',
      '.........',
    ],
  },
  /** A garage sale: everything is a bit. */
  garagesale: {
    rows: [
      '.HHH...',
      '.HHH...',
      '.HHH...',
      'n.n.n..',
      '..1....',
      '.......',
    ],
  },
}
