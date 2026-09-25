// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** Dense green and water: A dorian, marimba and congas, a whistled tune. */
export const jungle: Landscape = {
  id: 'jungle',
  name: 'Jungle',
  blurb: 'Canopy, vines, a waterfall into a hidden pool.',
  tonic: 9,
  moods: ['mixolydian', 'dorian', 'aeolian'],
  mood: 0.5,
  bpm: 104,
  swing: 0.2,
  progressions: [
    { chords: '1 4 1 4', role: 'a', weight: 2 },
    { chords: '1 7 4 1', role: 'a' },
    { chords: '3 4 5 1', role: 'b' },
    { chords: '4:2 5 7', role: 'b' },
  ],
  color: 0.35,
  pad: { voice: 'pad.warm' },
  bass: {
    voice: 'bass.round',
    patterns: ['', 'R.......5.......', 'R..R..5.R...5.3.', 'R..R..5.O..R.5.a', 'R.RR.R5.O.R.R5Oa'],
  },
  arp: { voice: 'mallet.marimba', pattern: 'broken', rate: [8, 8, 16, 16, 16], octaves: 2, low: 57 },
  lead: {
    voice: 'lead.whistle', range: [67, 88], density: 0.45, stepwise: 0.65,
    rhythm: ['syncopated', 'straight', 'dotted'], motifBars: 2, rest: 0.3, pentatonic: true,
    motifs: [
      "5 . 5 6 . 1' 6 5 | 3 - . 5 - . . .",
      "1' 7 5 . 6 5 3 . | 5 - - - . . . .",
      '. 3 5 . 6 - 5 3 | 1 - 3 - 2 - . .',
    ],
  },
  counter: { voice: 'mallet.kalimba', style: 'answer' },
  drums: {
    kit: 'kit.tribal',
    grooves: [
      {},
      {},
      { k: 'x.......x.......', s: '........g.......', t: '......x.......x.' },
      { k: 'x.....x...x.....', s: '....x.......x...', t: '...x......x...x.', T: '.......x........' },
      { k: 'x..x..x...x..x..', s: '....x..g....x...', t: '...x......x...x.', T: '.x.....x.....x..' },
    ],
    fill: { k: 'x.......x.......', m: '..........x.x...', t: '........x.....x.', T: '............x.xx' },
    perc: [
      {},
      { p: '..x...x...x...x.' },
      { p: 'x.gxx.gxx.gxx.gx' },
      { p: 'xgxxxgxxxgxxxgxx', h: '..x...x...x...x.' },
      { p: 'xgxxxgxxxgxxxgxx', h: 'x.xgx.xgx.xgx.xg', o: '......x.......x.' },
    ],
  },
  layers: [
    ['ambience', 'pad'],
    ['ambience', 'pad', 'perc', 'arp'],
    ['ambience', 'pad', 'perc', 'arp', 'bass', 'drums'],
    ['ambience', 'pad', 'perc', 'arp', 'bass', 'drums', 'lead'],
    ['ambience', 'pad', 'perc', 'arp', 'bass', 'drums', 'lead', 'counter'],
  ],
  fx: { reverb: 0.3, delay: 0.25, reverbSize: 2.2, tone: 0.85, grit: 0.2 },
  ambience: { 'birds.jungle': 0.45, insects: 0.35, stream: 0.25 },
  accent: '#3fe0a0',
}
