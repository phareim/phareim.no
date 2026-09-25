// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** A rainy city street: G dorian ninths, swung lofi, an electric piano. */
export const neonrain: Landscape = {
  id: 'neonrain',
  name: 'Neon Rain',
  blurb: 'Rain on a city street, neon in the puddles.',
  tonic: 7,
  moods: ['ionian', 'dorian', 'aeolian'],
  mood: 0.5,
  bpm: 84,
  swing: 0.25,
  progressions: [
    { chords: '1 4', barsPerChord: 2, role: 'a', weight: 2 },
    { chords: '1 7 3 4', role: 'a' },
    { chords: '4 3 2 1', role: 'b' },
    { chords: '2 5 1:2', role: 'b' },
  ],
  color: 0.85,
  pad: { voice: 'pad.warm' },
  bass: {
    voice: 'bass.round',
    patterns: ['', 'R.......R.......', 'R.....R...5.....', 'R..R..R...5..R.a', 'R..R.RR...5.3R.a'],
  },
  arp: { voice: 'arp.warm', pattern: 'broken', rate: [4, 8, 8, 8, 16], octaves: 1, low: 62 },
  lead: {
    voice: 'lead.ep', range: [62, 81], density: 0.4, stepwise: 0.75,
    rhythm: ['syncopated', 'dotted', 'long'], motifBars: 2, rest: 0.35,
    motifs: [
      '. 3 5 7 - 5 3 . | 4 - - 3 - . . .',
      '5 - 4 3 - 1 . . | 2 - 3 - - - . .',
      '1 - 3 - 5 - 7 6 | 5 - - - . . . .',
    ],
  },
  counter: { voice: 'counter.soft', style: 'answer' },
  drums: {
    kit: 'kit.soft',
    grooves: [
      {},
      {},
      { k: 'x.........x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      { k: 'x.......x.x.....', s: '....x.......x..g', h: 'x.xgx.xgx.xgx.xg' },
      { k: 'x..x....x.x..x..', s: '....x..g....x..g', h: 'xgxgxgxgxgxgxgxg', p: '...x.......x....' },
    ],
    fill: { k: 'x.........x.....', s: '....x......gx.gx', h: 'x.x.x.x.x.......' },
  },
  layers: [
    ['ambience', 'pad'],
    ['ambience', 'pad', 'arp'],
    ['ambience', 'pad', 'arp', 'bass', 'drums'],
    ['ambience', 'pad', 'arp', 'bass', 'drums', 'lead'],
    ['ambience', 'pad', 'arp', 'bass', 'drums', 'lead', 'counter'],
  ],
  fx: { reverb: 0.35, delay: 0.3, reverbSize: 2.2, tone: 0.6, grit: 0.55 },
  ambience: { rain: 0.5, city: 0.25 },
  accent: '#ff8ae0',
}
