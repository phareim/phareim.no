// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** Deep cold forest: E aeolian, slow, a heartbeat under the snow. */
export const frostwood: Landscape = {
  id: 'frostwood',
  name: 'Frostwood',
  blurb: 'Dark pines under snow, a pale moon, breath in the air.',
  tonic: 4,
  moods: ['dorian', 'aeolian', 'phrygian'],
  mood: 0.5,
  bpm: 72,
  swing: 0,
  progressions: [
    { chords: '1 6 4 1', barsPerChord: 2, role: 'a', weight: 2 },
    { chords: '1 7 6 7', barsPerChord: 2, role: 'a' },
    { chords: '6 7 1:4', barsPerChord: 2, role: 'b' },
    { chords: '4 5 1:4', barsPerChord: 2, role: 'b' },
  ],
  color: 0.45,
  pad: { voice: 'pad.dark' },
  drone: { voice: 'drone.sub' },
  bass: {
    voice: 'bass.sub',
    patterns: ['', '', 'R---------------', 'R-------R.....5.', 'R.....R.R.....5.'],
  },
  arp: { voice: 'arp.glass', pattern: 'random', rate: [4, 4, 8, 8, 16], octaves: 2, low: 64 },
  lead: {
    voice: 'lead.hollow', range: [59, 79], density: 0.3, stepwise: 0.8,
    rhythm: ['long', 'dotted'], motifBars: 2, rest: 0.4,
    motifs: [
      '5 - - - - - 4 - | 3 - - - 2 - - -',
      '1 - - 2 3 - - - | 5 - - - 4 - 3 -',
      '3 - 2 - 1 - - - | 7, - - - 1 - - .',
    ],
  },
  counter: { voice: 'counter.strings', style: 'guide' },
  bells: { voice: 'bell.glass', density: 0.3 },
  drums: {
    kit: 'kit.heartbeat',
    grooves: [
      {},
      {},
      {},
      { k: 'x..x......x.....', h: '........g.......' },
      { k: 'x..x....x..x....', s: '........x.......', h: '..g...g...g...g.' },
    ],
    fill: { k: 'x..x....x..x....', s: '............x.x.', z: '........x-------' },
  },
  layers: [
    ['ambience', 'pad', 'drone'],
    ['ambience', 'pad', 'drone', 'bells'],
    ['ambience', 'pad', 'drone', 'bells', 'arp', 'bass'],
    ['ambience', 'pad', 'drone', 'bells', 'arp', 'bass', 'lead', 'drums'],
    ['ambience', 'pad', 'drone', 'bells', 'arp', 'bass', 'lead', 'drums', 'counter'],
  ],
  fx: { reverb: 0.6, delay: 0.4, reverbSize: 6, tone: 0.55, grit: 0.35 },
  ambience: { wind: 0.35, snow: 0.3, owl: 0.25 },
  accent: '#9ad0ff',
}
