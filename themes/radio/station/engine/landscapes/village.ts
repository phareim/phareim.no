// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** A small village at dusk: F major sevenths, a lazy swing, an electric piano. */
export const village: Landscape = {
  id: 'village',
  name: 'Village',
  blurb: 'Lit windows, chimney smoke, lanterns on a string.',
  tonic: 5,
  moods: ['ionian', 'mixolydian', 'dorian'],
  mood: 0.2,
  bpm: 96,
  swing: 0.3,
  progressions: [
    { chords: '1 6 2 5', role: 'a', weight: 2 },
    { chords: '1 3 4 5', role: 'a' },
    { chords: '4 3 2 5', role: 'b', weight: 2 },
    { chords: '4 4m 3 6', role: 'b' },
    { chords: '2 5 1:2', role: 'bridge' },
  ],
  color: 0.75,
  pad: { voice: 'pad.warm' },
  bass: {
    voice: 'bass.round',
    patterns: ['', 'R.......5.......', 'R..5..R.O..5..3.', 'R..5..R.O..5..3a', 'R.R5..R.O.R5..3a'],
  },
  arp: { voice: 'arp.warm', pattern: 'broken', rate: [8, 8, 8, 16, 16], octaves: 1, low: 60 },
  lead: {
    voice: 'lead.ep', range: [60, 81], density: 0.5, stepwise: 0.75,
    rhythm: ['straight', 'syncopated', 'dotted'], motifBars: 2, rest: 0.3,
    motifs: [
      '3 - 5 - 6 5 3 - | 2 - 1 - . . . .',
      ". 5 6 1' - 7 6 5 | 6 - - - 3 - - -",
      '1 2 3 5 - 3 2 1 | 2 - - - . . . .',
    ],
  },
  counter: { voice: 'counter.soft', style: 'answer' },
  bells: { voice: 'bell.chime', density: 0.15 },
  drums: {
    kit: 'kit.brush',
    grooves: [
      {},
      {},
      { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      { k: 'x.......x.x.....', s: '....x.......x.g.', h: 'x.xgx.xgx.xgx.xg' },
      { k: 'x.....x.x.x.....', s: '....x..g....x.g.', h: 'x.xgx.xgx.xgx.xg', r: 'x...x...x...x...' },
    ],
    fill: { k: 'x.......x.......', s: '....x...x.x.x.xx', h: 'x.x.x.x.........' },
  },
  layers: [
    ['ambience', 'pad'],
    ['ambience', 'pad', 'arp', 'bells'],
    ['ambience', 'pad', 'arp', 'bells', 'bass', 'drums'],
    ['ambience', 'pad', 'arp', 'bells', 'bass', 'drums', 'lead'],
    ['ambience', 'pad', 'arp', 'bells', 'bass', 'drums', 'lead', 'counter'],
  ],
  fx: { reverb: 0.3, delay: 0.2, reverbSize: 1.8, tone: 0.8, grit: 0.35 },
  ambience: { birds: 0.3, chimes: 0.25, 'bell.distant': 0.2, fire: 0.15 },
  accent: '#ffd23f',
}
