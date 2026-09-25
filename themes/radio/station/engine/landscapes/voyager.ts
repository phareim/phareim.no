// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** Space exploration: C lydian, a Berlin-school sequence, motorik drums. */
export const voyager: Landscape = {
  id: 'voyager',
  name: 'Voyager',
  blurb: 'A ringed planet through the window, the stars moving.',
  tonic: 0,
  moods: ['lydian', 'mixolydian', 'dorian'],
  mood: 0.15,
  bpm: 118,
  swing: 0,
  progressions: [
    { chords: '1 2 1 2', barsPerChord: 2, role: 'a', weight: 2 },
    { chords: '1 7 1 2', role: 'a' },
    { chords: '6 5 2:2', role: 'b' },
    { chords: '6 2 6 2', role: 'b' },
  ],
  color: 0.3,
  pad: { voice: 'pad.glass' },
  drone: { voice: 'drone.sub' },
  bass: {
    voice: 'bass.fm',
    patterns: ['', 'R---------------', 'R.R.R.R.R.R.R.R.', 'R.R.R.R.R.R.O.R.', 'RRR.RRR.RRO.RR5.'],
  },
  arp: {
    voice: 'arp.seq', pattern: 'sequence', rate: [8, 16, 16, 16, 16], octaves: 2, low: 55,
    sequence: [0, 2, 4, 7, 4, 2, 9, 7],
  },
  lead: {
    voice: 'lead.fm', range: [67, 88], density: 0.4, stepwise: 0.6,
    rhythm: ['long', 'straight'], motifBars: 2, rest: 0.4,
    motifs: [
      "1 - 5 - 2' - - - | 7 - 5 - 3 - - -",
      "3 - 4 - 5 - 7 - | 1' - - - - - - -",
      '5 - 4 - 3 - 2 - | 3 - - - - - . .',
    ],
  },
  counter: { voice: 'counter.soft', style: 'guide' },
  bells: { voice: 'bell.fm', density: 0.2 },
  drums: {
    kit: 'kit.motorik',
    grooves: [
      {},
      {},
      { k: 'x.......x.......', h: 'x.x.x.x.x.x.x.x.' },
      { k: 'x...x...x...x...', s: '....x.......x...', h: 'xgxgxgxgxgxgxgxg' },
      { k: 'x...x...x...x...', s: '....x.......x..g', h: 'xxxxxxxxxxxxxxxx', o: '..............x.' },
    ],
    fill: { k: 'x...x...x.......', s: '....x...x.x.x.x.', T: '............x.x.' },
  },
  layers: [
    ['ambience', 'pad', 'drone'],
    ['ambience', 'pad', 'drone', 'arp'],
    ['ambience', 'pad', 'drone', 'arp', 'bass', 'bells'],
    ['ambience', 'pad', 'drone', 'arp', 'bass', 'bells', 'drums', 'lead'],
    ['ambience', 'pad', 'drone', 'arp', 'bass', 'bells', 'drums', 'lead', 'counter'],
  ],
  fx: { reverb: 0.45, delay: 0.45, reverbSize: 4, tone: 0.9, grit: 0.2, pump: 0.15 },
  ambience: { radio: 0.35, shimmer: 0.3, 'space.hum': 0.2 },
  accent: '#9a4ff0',
}
