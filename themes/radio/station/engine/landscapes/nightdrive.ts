// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** The car trip: A minor synthwave, pumping pads, a gliding lead. */
export const nightdrive: Landscape = {
  id: 'nightdrive',
  name: 'Night Drive',
  blurb: 'The coastal highway at night, the city lights ahead.',
  tonic: 9,
  moods: ['dorian', 'aeolian', 'harmonicMinor'],
  mood: 0.5,
  bpm: 112,
  swing: 0,
  progressions: [
    { chords: '1 6 3 7', role: 'a', weight: 2 },
    { chords: '6 7 1:2', role: 'a' },
    { chords: '4 6 7:2', role: 'b' },
    { chords: '6 3 7 1', role: 'b' },
    { chords: '6 7 5M:2', role: 'bridge' },
  ],
  color: 0.3,
  pad: { voice: 'pad.strings' },
  bass: {
    voice: 'bass.pluck',
    patterns: ['', 'R-------R-------', 'R.R.R.R.R.R.R.R.', 'R.R.O.R.R.R.O.R.', 'RRORRRORRRORRROR'],
  },
  arp: { voice: 'arp.pluck', pattern: 'up', rate: [16, 16, 16, 16, 16], octaves: 2, low: 57 },
  lead: {
    voice: 'lead.glide', range: [64, 88], density: 0.5, stepwise: 0.7,
    rhythm: ['long', 'dotted', 'straight'], motifBars: 2, rest: 0.3,
    motifs: [
      '5 - - - 3 - 4 - | 5 - 6 - 5 - 3 -',
      "1' - - 7 - 5 - - | 6 - - - - - . .",
      "3 - 4 5 - - 7 - | 1' - - - 7 - 5 -",
    ],
  },
  counter: { voice: 'counter.strings', style: 'guide' },
  drums: {
    kit: 'kit.synthwave',
    grooves: [
      {},
      {},
      { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' },
      { k: 'x...x...x...x...', s: '....X.......X...', c: '....x.......x...', h: '..x...x...x...x.' },
      { k: 'x...x...x...x...', s: '....X.......X...', c: '....x.......x...', h: 'xgxgxgxgxgxgxgxg', o: '..x...x...x...x.' },
    ],
    fill: { k: 'x...x...x.......', s: '....X...x.x.xxxx', z: '........x-------' },
  },
  layers: [
    ['ambience', 'pad'],
    ['ambience', 'pad', 'bass', 'arp'],
    ['ambience', 'pad', 'bass', 'arp', 'drums'],
    ['ambience', 'pad', 'bass', 'arp', 'drums', 'lead'],
    ['ambience', 'pad', 'bass', 'arp', 'drums', 'lead', 'counter'],
  ],
  fx: { reverb: 0.35, delay: 0.35, reverbSize: 2.8, tone: 0.8, grit: 0.3, pump: 0.55 },
  ambience: { road: 0.45, passing: 0.3 },
  accent: '#ff8a3d',
}
