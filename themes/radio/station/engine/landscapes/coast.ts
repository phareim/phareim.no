// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** Neon Shrine's home: the coast at dusk. D mixolydian, heroic but easy. */
export const coast: Landscape = {
  id: 'coast',
  name: 'Neon Coast',
  blurb: 'Dusk over the sea, the striped sun on the water.',
  tonic: 2,
  moods: ['mixolydian', 'dorian', 'aeolian'],
  mood: 0.2,
  bpm: 108,
  swing: 0,
  progressions: [
    { chords: '1 7 4 5', role: 'a', weight: 2 },
    { chords: '1 6 4 7', role: 'a' },
    { chords: '2 4 1 7', role: 'b' },
    { chords: '6 4 1 5', role: 'b' },
    { chords: '4:2 7:2', role: 'bridge' },
  ],
  color: 0.25,
  pad: { voice: 'pad.saw' },
  bass: {
    voice: 'bass.saw',
    patterns: ['', 'R-------R-------', 'R..R..R.R..R..5.', 'R.RRR.RRR.RR5.O.', 'R.ORR.ORR.OR5.Oa'],
  },
  arp: { voice: 'arp.pluck', pattern: 'updown', rate: [8, 8, 16, 16, 16], octaves: 2, low: 62 },
  lead: {
    voice: 'lead.square', range: [62, 86], density: 0.55, stepwise: 0.7,
    rhythm: ['straight', 'dotted', 'syncopated'], motifBars: 2, rest: 0.25,
    motifs: [
      '1 - 5, 1 2 3 - 5 | 4 - 3 - 2 - . .',
      '5 - - 3 4 5 6 5 | 3 - - - . . 2 3',
      "1' - 7 5 6 - 5 - | 3 - 5 - 2 - - .",
    ],
  },
  counter: { voice: 'counter.soft', style: 'guide' },
  drums: {
    kit: 'kit.synthwave',
    grooves: [
      {},
      {},
      { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
      { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xg' },
      { k: 'x...x...x...x...', s: '....X.......X...', c: '....x.......x...', h: 'xgxgxgxgxgxgxgxg', o: '..............x.' },
    ],
    fill: { k: 'x.....x.........', s: '....x...........', T: '........x.x.....', m: '............x.x.', t: '..............xx' },
  },
  layers: [
    ['ambience', 'pad'],
    ['ambience', 'pad', 'bass', 'arp'],
    ['ambience', 'pad', 'bass', 'arp', 'drums', 'lead'],
    ['ambience', 'pad', 'bass', 'arp', 'drums', 'lead', 'counter'],
    ['ambience', 'pad', 'bass', 'arp', 'drums', 'lead', 'counter'],
  ],
  fx: { reverb: 0.35, delay: 0.3, reverbSize: 2.6, tone: 0.8, grit: 0.3, pump: 0.25 },
  ambience: { waves: 0.5, gulls: 0.2, wind: 0.15 },
  accent: '#ff2fa0',
}
