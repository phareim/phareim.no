// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
import type { Landscape } from '../types.ts'

/** Above the clouds: D lydian, open and slow, a flute over a choir. */
export const summit: Landscape = {
  id: 'summit',
  name: 'Mountain Top',
  blurb: 'Above the clouds, the peaks catching the last light.',
  tonic: 2,
  moods: ['lydian', 'ionian', 'mixolydian'],
  mood: 0.1,
  bpm: 84,
  swing: 0,
  progressions: [
    { chords: '1 2 1 2', barsPerChord: 2, role: 'a', weight: 2 },
    { chords: '1add9 2 6 5', role: 'a' },
    { chords: '6 5 2:2', role: 'b' },
    { chords: '3 6 2 5s4', role: 'b' },
  ],
  color: 0.4,
  pad: { voice: 'pad.choir' },
  drone: { voice: 'drone.sub' },
  bass: {
    voice: 'bass.round',
    patterns: ['', 'R---------------', 'R-------5-------', 'R.....R.5.....5.', 'R..R..R.R..R..5.'],
  },
  arp: { voice: 'arp.glass', pattern: 'up', rate: [4, 8, 8, 16, 16], octaves: 2, low: 67 },
  lead: {
    voice: 'lead.hollow', range: [62, 84], density: 0.35, stepwise: 0.6,
    rhythm: ['long', 'dotted'], motifBars: 2, rest: 0.35, pentatonic: true,
    motifs: [
      '3 - 4 - 5 - - - | 2 - - - - - . .',
      '5 - - - 6 - 7 - | 5 - - - - - - .',
      '1 - 2 - 3 - - - | 5 - - - 3 - - -',
    ],
  },
  counter: { voice: 'counter.strings', style: 'guide' },
  bells: { voice: 'bell.glass', density: 0.25 },
  drums: {
    kit: 'kit.tribal',
    grooves: [
      {},
      {},
      { k: 'x...............', t: '........x.......' },
      { k: 'x.....x.........', s: '........x.......', t: '..........x..x..' },
      { k: 'x.....x...x.....', s: '........X.......', t: '...x......x.x...', T: '..............x.', h: 'x.x.x.x.x.x.x.x.' },
    ],
    fill: { k: 'x.......x.......', T: 'x.x.............', m: '....x.x.x.......', t: '..........x.x.x.' },
  },
  layers: [
    ['ambience', 'pad', 'drone'],
    ['ambience', 'pad', 'drone', 'bass', 'arp'],
    ['ambience', 'pad', 'drone', 'bass', 'arp', 'lead', 'bells'],
    ['ambience', 'pad', 'drone', 'bass', 'arp', 'lead', 'bells', 'drums', 'counter'],
    ['ambience', 'pad', 'drone', 'bass', 'arp', 'lead', 'bells', 'drums', 'counter'],
  ],
  fx: { reverb: 0.55, delay: 0.35, reverbSize: 5, tone: 0.75, grit: 0.15 },
  ambience: { 'wind.high': 0.45, wind: 0.3 },
  accent: '#cfc6ff',
}
