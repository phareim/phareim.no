// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** Under the shrine: D harmonic minor, harp and chip drums, water in the dark. */
export const caverns: Landscape = {
  id: 'caverns',
  name: 'Crystal Caverns',
  blurb: 'Glowing crystals over an underground lake.',
  tonic: 2,
  moods: ['dorian', 'harmonicMinor', 'phrygian'],
  mood: 0.5,
  bpm: 90,
  swing: 0,
  progressions: [
    { chords: '1 6 4 5', role: 'a', weight: 2 },
    { chords: '1 b7M 6 5', role: 'a' },
    { chords: '4 1 6 5', role: 'b' },
    { chords: '6 4 5:2', role: 'b' },
  ],
  color: 0.25,
  pad: { voice: 'pad.dark' },
  drone: { voice: 'drone.organ' },
  bass: {
    voice: 'bass.square',
    patterns: ['', 'R-------R-------', 'R..R..R.R..R..5.', 'R.RR.RR.R.RR.R5.', 'RRORR.RORRORR.5a'],
  },
  arp: { voice: 'pluck.harp', pattern: 'updown', rate: [8, 8, 16, 16, 16], octaves: 2, low: 57 },
  lead: {
    voice: 'lead.pulse', range: [62, 84], density: 0.45, stepwise: 0.7,
    rhythm: ['straight', 'dotted'], motifBars: 2, rest: 0.3,
    motifs: [
      '1 - 2 3 - 2 1 7, | 1 - - - 5, - - -',
      '5 - 6 5 - 3 - 2 | 3 - 2 - 1 - - -',
      '3 - 4 5 - 4 3 2 | 7, - - - . . . .',
    ],
  },
  counter: { voice: 'counter.soft', style: 'guide' },
  bells: { voice: 'bell.glass', density: 0.2 },
  drums: {
    kit: 'kit.chip',
    grooves: [
      {},
      {},
      { k: 'x.......x.......', s: '....x.......x...' },
      { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      { k: 'x.....x.x.....x.', s: '....x.......x.x.', h: 'xgxgxgxgxgxgxgxg' },
    ],
    fill: { k: 'x.....x.x.......', s: '....x...x.x.xxxx', h: 'x.x.x.x.........' },
  },
  layers: [
    ['ambience', 'pad', 'drone'],
    ['ambience', 'pad', 'drone', 'arp'],
    ['ambience', 'pad', 'drone', 'arp', 'bass', 'bells'],
    ['ambience', 'pad', 'drone', 'arp', 'bass', 'bells', 'drums', 'lead'],
    ['ambience', 'pad', 'drone', 'arp', 'bass', 'bells', 'drums', 'lead', 'counter'],
  ],
  fx: { reverb: 0.55, delay: 0.4, reverbSize: 3.5, tone: 0.7, grit: 0.25 },
  ambience: { stream: 0.3, shimmer: 0.2, wind: 0.1 },
  accent: '#2ff3ff',
}
