// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** Deep space quiet: Bb lydian, a chord every four bars, almost nothing moves. */
export const deepspace: Landscape = {
  id: 'deepspace',
  name: 'Deep Space',
  blurb: 'Near-black, a few stars, a galaxy far off.',
  tonic: 10,
  moods: ['lydian', 'ionian', 'aeolian'],
  mood: 0.2,
  bpm: 60,
  swing: 0,
  progressions: [
    { chords: '1 2', barsPerChord: 4, role: 'a', weight: 2 },
    { chords: '1 6', barsPerChord: 4, role: 'a' },
    { chords: '6 5', barsPerChord: 4, role: 'b' },
    { chords: '3 2', barsPerChord: 4, role: 'b' },
  ],
  color: 0.6,
  pad: { voice: 'pad.glass' },
  drone: { voice: 'drone.shimmer' },
  bass: {
    voice: 'bass.sub',
    patterns: ['', '', 'R---------------', 'R---------------', 'R-------R-------'],
  },
  arp: { voice: 'arp.glass', pattern: 'random', rate: [4, 4, 4, 8, 8], octaves: 2, low: 70 },
  lead: {
    voice: 'lead.hollow', range: [62, 82], density: 0.2, stepwise: 0.7,
    rhythm: ['long'], motifBars: 2, rest: 0.5, pentatonic: true,
    motifs: [
      '5 - - - - - - - | 3 - - - - - - -',
      "1' - - - - - - - | 7 - - - 5 - - -",
    ],
  },
  bells: { voice: 'bell.glass', density: 0.3 },
  drums: {
    kit: 'kit.heartbeat',
    grooves: [{}, {}, {}, {}, { k: 'x..x............' }],
    fill: { k: 'x..x............' },
  },
  layers: [
    ['ambience', 'drone'],
    ['ambience', 'drone', 'pad'],
    ['ambience', 'drone', 'pad', 'bells', 'bass'],
    ['ambience', 'drone', 'pad', 'bells', 'bass', 'arp', 'lead'],
    ['ambience', 'drone', 'pad', 'bells', 'bass', 'arp', 'lead', 'drums'],
  ],
  fx: { reverb: 0.75, delay: 0.5, reverbSize: 9, tone: 0.6, grit: 0.1 },
  ambience: { 'space.hum': 0.4, shimmer: 0.2 },
  accent: '#6a7bff',
}
