/**
 * Neon Shrine audio — synthesised Web Audio, no samples, no network.
 *
 * - Music: a small tracker. Each track is data (bpm, swing, a form of
 *   sections; a section is a bar-per-chord progression, a lead melody per
 *   bar in eighth or sixteenth tokens, an optional counter line, a bass
 *   pattern, drum lanes, arp and pad switches). `compileTrack` turns it
 *   into per-bar note events; a 25 ms lookahead scheduler plays them
 *   through detuned-saw pads, a square/pulse/saw lead with vibrato, a
 *   filtered bass, noise drums with a gated reverb on the snare, a hall
 *   reverb and a dotted-eighth delay. Switching tracks crossfades.
 * - Jingles: short one-shots (item get, secret, fanfare, heart piece, game
 *   over) over a ducked loop.
 * - SFX: one function per game event, all small oscillator/noise recipes.
 *
 * All melodies are original. Nothing plays before `unlock()` (call it from
 * the key/tap that starts a run). While a track plays, the site radio is
 * parked, exactly like composables/useSound.ts does it.
 */

import type { TrackId } from './types'
import { getRadioEngine } from '../radio/engine'
import { MUTE_KEY as RADIO_MUTE_KEY } from '../radio/catalog'

export type SfxName =
  | 'sword' | 'spin' | 'charge' | 'hit' | 'kill' | 'clank' | 'hurt' | 'shock' | 'die' | 'cut'
  | 'shatter' | 'lift' | 'throw' | 'coin' | 'heart' | 'key' | 'chest' | 'unlock' | 'door' | 'plate'
  | 'crystal' | 'push' | 'bombPlace' | 'boom' | 'disc' | 'discHit' | 'fall' | 'pellet' | 'laser'
  | 'reflect' | 'warp' | 'stairs' | 'text' | 'menu' | 'select' | 'error' | 'bossRoar' | 'bossHit'
  | 'bossDie' | 'lowHp' | 'gate'
  // The Wildwood and Project Horizon
  | 'hook' | 'hookHit' | 'pull' | 'psi' | 'glyph' | 'lever' | 'land' | 'beam' | 'gust' | 'bark'

export type JingleName = 'item' | 'secret' | 'fanfare' | 'heartPiece' | 'gameOver' | 'friend'

export interface ZeldaAudio {
  unlock(): void
  music(track: TrackId | null): void
  sfx(name: SfxName): void
  jingle(name: JingleName): void
  pause(on: boolean): void
  setMuted(muted: boolean): void
  /** Silence the site radio now, before any track plays (the portal on arrival). Released by dispose. */
  holdRadio(): void
  dispose(): void
}

const SOUND_MUTE_KEY = 'phareim-sound-muted'

// ---------------------------------------------------------------------------
// Pure data: notes, chords, tracks
// ---------------------------------------------------------------------------

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 'C#5' → 73, 'Bb4' → 70; -1 when it does not parse. */
export function noteMidi(tok: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(tok)
  if (!m) return -1
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return 12 * (Number(m[3]) + 1) + PC[m[1]!]! + acc
}

export const hz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

export interface Chord {
  /** Pitch class of the root. */
  root: number
  /** Pitch class of the bass note (slash chords). */
  bass: number
  /** Semitones above the root. */
  tones: number[]
}

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  '5': [0, 7],
  add9: [0, 4, 7, 14],
}

/** 'F#m', 'Bbmaj7', 'G/B' → Chord; null when it does not parse. */
export function parseChord(sym: string): Chord | null {
  const m = /^([A-G])(#|b)?(maj7|m7|sus2|sus4|dim|add9|m|7|5)?(?:\/([A-G])(#|b)?)?$/.exec(sym)
  if (!m) return null
  const acc = (s?: string) => (s === '#' ? 1 : s === 'b' ? -1 : 0)
  const root = (PC[m[1]!]! + acc(m[2]) + 12) % 12
  const bass = m[4] ? (PC[m[4]]! + acc(m[5]) + 12) % 12 : root
  return { root, bass, tones: QUALITY[m[3] ?? '']! }
}

interface Drums { k: string; s: string; h: string }

interface SectionDef {
  /** One symbol per bar; 'G|A' splits a bar in halves. */
  chords: string
  /** One string per bar: 8 (eighths) or 16 (sixteenths) tokens. Note, '-' hold, '.' rest. */
  lead?: string[]
  /** A second, softer sustained line. */
  counter?: string[]
  /** 16 steps: R root, O root+12, 5 fifth, 3 chord third, 7 chord seventh, - hold, . rest. */
  bass: string
  drums: Drums
  /** Replaces the drums on the section's last bar. */
  fill?: Drums
  arp?: 'up' | 'down' | 'updown'
  arpRate?: 8 | 16
  pad?: boolean
}

type LeadVoice = 'square' | 'saw' | 'pulse' | 'soft' | 'bell' | 'hollow'
type BassVoice = 'saw' | 'square' | 'round'
/** 'square' chip arp (default), 'pluck' resonant saw sequence, 'warm' soft detuned analog, 'glass' sine bells. */
type ArpVoice = 'square' | 'pluck' | 'warm' | 'glass'

export interface TrackDef {
  bpm: number
  /** 0..0.5 of a sixteenth: delay of the off-beat eighths. */
  swing: number
  form: string[]
  /** Form index the loop returns to (default 0). */
  loopFrom?: number
  sections: Record<string, SectionDef>
  lead: LeadVoice
  bass: BassVoice
  /** Send levels into the hall reverb and the dotted-eighth delay. */
  reverb: number
  delay: number
  /** Overall level of this track (1 = default). */
  level?: number
  arpVoice?: ArpVoice
  /** Pad saws detuned this many cents either side (default 9). */
  padDetune?: number
  /** Pads swell in over half the chord instead of snapping in. */
  padSwell?: boolean
  /** Tape wow: a slow pitch drift on lead and pads, in cents (default none). */
  wow?: number
}

const D_NONE: Drums = { k: '................', s: '................', h: '................' }

export const TRACKS: Record<TrackId, TrackDef> = {
  // The sun going down over the coast: pads, a slow arp, a lonely lead.
  title: {
    bpm: 84, swing: 0, lead: 'saw', bass: 'round', reverb: 0.45, delay: 0.4,
    form: ['A', 'P'],
    sections: {
      A: {
        chords: 'Am F C G Am F Dm E',
        lead: [
          'E5 - - - - - . .', 'A5 - - - G5 - F5 -', 'E5 - - - - - . .', 'D5 - - - B4 - - .',
          'C5 - - - E5 - A5 -', 'C6 - - - - - A5 -', 'F5 - - - E5 - D5 -', 'E5 - - - G#4 - - -',
        ],
        bass: 'R-----.-R---5---',
        drums: { k: '................', s: '................', h: '....x.......x...' },
        arp: 'up', arpRate: 16, pad: true,
      },
      P: {
        chords: 'Am F C G Am F Dm E',
        lead: [
          '. . . . A5 - - -', '- - - - . . . .', '. . . . G5 - - -', '- - - - . . . .',
          '. . . . E5 - - -', 'F5 - - - . . . .', '. . . . D5 - - -', 'B4 - - - G#4 - - -',
        ],
        bass: 'R-----.-R---5---',
        drums: { k: 'x.........x.....', s: '........x.......', h: '..x...x...x...x.' },
        arp: 'updown', arpRate: 16, pad: true,
      },
    },
  },

  // The heart of the game: heroic D mixolydian, a minor B that yearns.
  overworld: {
    bpm: 124, swing: 0, lead: 'square', bass: 'saw', reverb: 0.25, delay: 0.3,
    form: ['I', 'A', 'A2', 'B', 'A2'], loopFrom: 1,
    sections: {
      I: {
        chords: 'D D',
        bass: 'R.RRR.RRR.RR5.O.',
        drums: { k: 'x.....x.x.....x.', s: '................', h: 'x.x.x.x.x.x.x.x.' },
        fill: { k: 'x.....x.x.......', s: '....x...x.x.tttt', h: 'x.x.x.x.........' },
        pad: true,
      },
      A: {
        chords: 'D C G A D C G A',
        lead: [
          'D5 - - A4 D5 E5 F#5 -', 'G5 - E5 - C5 - D5 E5', 'D5 - - B4 G4 - A4 B4', 'C#5 - A4 - E5 - - .',
          'D5 - - A4 D5 E5 F#5 A5', 'G5 - - E5 C5 - E5 G5', 'B5 - A5 G5 F#5 - E5 D5', 'E5 - - - C#5 - A4 .',
        ],
        bass: 'R.RRR.RRR.RR5.O.',
        drums: { k: 'x.....x.x.....x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' },
        arp: 'updown', arpRate: 8, pad: true,
      },
      A2: {
        chords: 'D C G A D C G|A D',
        lead: [
          'D5 - - A4 D5 E5 F#5 -', 'G5 - E5 - C5 - D5 E5', 'D5 - - B4 G4 - A4 B4', 'C#5 - A4 - E5 - - .',
          'D5 - - A4 D5 E5 F#5 A5', 'G5 - - E5 C5 - E5 G5', 'B5 - A5 G5 F#5 - E5 -', 'D5 - A4 - D5 - . .',
        ],
        counter: [
          'F#4 - - - - - - -', 'E4 - - - - - - -', 'D4 - - - - - - -', 'C#4 - - - E4 - - -',
          'F#4 - - - A4 - - -', 'G4 - - - E4 - - -', 'D4 - - - C#4 - - -', 'D4 - - - - - . .',
        ],
        bass: 'R.RRR.RRR.RR5.O.',
        drums: { k: 'x.....x.x.....x.', s: '....x.......x...', h: 'xxx.xxx.xxx.xxxo' },
        fill: { k: 'x.....x.x.......', s: '....x...x.x.xxxx', h: 'xxx.xxx.x.......' },
        arp: 'up', arpRate: 16, pad: true,
      },
      B: {
        chords: 'Bm G D A Bm G Em F#',
        lead: [
          'F#5 - - - E5 - D5 -', 'D5 - B4 - - - G4 A4', 'A4 - - - F#4 - A4 -', 'E5 - - - - - C#5 -',
          'F#5 - - - G5 - A5 -', 'B5 - - - A5 - G5 -', 'G5 - F#5 - E5 - D5 -', 'C#5 - - - A#4 - F#4 -',
        ],
        bass: 'R-.R..R.R-.R..5.',
        drums: { k: 'x.........x.....', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
        fill: { k: 'x.........x.....', s: 'x...x...x.x.tttt', h: 'x.x.x.x.x.......' },
        arp: 'up', arpRate: 16, pad: true,
      },
    },
  },

  // Night market: warm sevenths, a lazy swing, an electric-piano lead.
  village: {
    bpm: 100, swing: 0.3, lead: 'soft', bass: 'round', reverb: 0.3, delay: 0.2,
    form: ['A', 'B', 'A'],
    sections: {
      A: {
        chords: 'Fmaj7 Dm7 Gm7 C7 Fmaj7 Dm7 Gm7 C7',
        lead: [
          'C5 - A4 C5 . . F5 -', 'E5 - D5 - C5 - A4 -', 'Bb4 - D5 - F5 - E5 D5', 'C5 - - - . . G4 -',
          'C5 - A4 C5 . . F5 G5', 'A5 - G5 - F5 - D5 -', 'Bb5 - A5 - G5 - E5 -', 'F5 - - - . . . .',
        ],
        bass: 'R..5..R.O..5..3.',
        drums: { k: 'x.......x.x.....', s: '....x.......x.g.', h: 'x.x.x.x.x.x.x.x.' },
        pad: true,
      },
      B: {
        chords: 'Bbmaj7 Am7 Gm7 C7 Bbmaj7 Am7 Gm7 C7',
        lead: [
          'D5 - F5 - A5 - - -', 'G5 - E5 - C5 - - -', 'Bb4 - D5 - F5 - G5 -', 'E5 - - - C5 - - -',
          'D5 - F5 - A5 - C6 -', 'A5 - G5 - E5 - C5 -', 'D5 - E5 - F5 - G5 -', 'E5 - - - G5 - - -',
        ],
        bass: 'R..5..R.O..5..7.',
        drums: { k: 'x.......x.x.....', s: '....x.......x.g.', h: 'x.xox.x.x.xox.x.' },
        fill: { k: 'x.......x.......', s: '....x...x.x.x.xx', h: 'x.x.x.x.x.......' },
        pad: true,
      },
    },
  },

  // The shrine: D minor, a low pulse, eerie arps, a lead that barely speaks.
  dungeon: {
    bpm: 96, swing: 0, lead: 'pulse', bass: 'square', reverb: 0.55, delay: 0.45,
    form: ['A', 'B'],
    sections: {
      A: {
        chords: 'Dm Dm Bb A Dm Gm Bb A',
        lead: [
          'A4 - - - - - . .', 'Bb4 - - - A4 - - -', 'F4 - - - - - . .', 'E4 - - - C#5 - - -',
          'D5 - - - - - . .', 'Eb5 - - - D5 - - -', 'F5 - - - D5 - - -', 'C#5 - - - - - . .',
        ],
        bass: 'R.R.R.R.R.R.O.R.',
        drums: { k: 'x.......x.......', s: '................', h: '..x...x...x...x.' },
        arp: 'updown', arpRate: 16, pad: true,
      },
      B: {
        chords: 'Gm Eb Dm A Gm Eb Bb A',
        lead: [
          'G5 - - - - - - -', 'G5 - - - Bb5 - - -', 'A5 - - - - - - -', 'C#6 - - - - - . .',
          'D6 - - - - - - -', 'Eb6 - - - D6 - - -', 'F5 - - - - - - -', 'E5 - - - C#5 - - -',
        ],
        bass: 'R.R.R.R.R.R.O.R.',
        drums: { k: 'x.......x.....x.', s: '........g.......', h: '..x...x...x...x.' },
        fill: { k: 'x.......x.......', s: '........t...t.tt', h: '..x...x.........' },
        arp: 'up', arpRate: 16, pad: true,
      },
    },
  },

  // The Static King: E minor, 16th bass, stabbing lead.
  boss: {
    bpm: 150, swing: 0, lead: 'saw', bass: 'saw', reverb: 0.2, delay: 0.2,
    form: ['A', 'B'],
    sections: {
      A: {
        chords: 'Em C D B Em C D B',
        lead: [
          'E5 E5 . G5 . E5 B5 -', 'C6 - B5 - G5 - E5 -', 'F#5 F#5 . A5 . F#5 D6 -', 'D#6 - - - B5 - F#5 -',
          'E5 E5 . G5 . E5 B5 -', 'C6 - B5 - C6 - E6 -', 'D6 - C6 - B5 - A5 -', 'B5 - - - - - . .',
        ],
        bass: 'RRORRRORRRORR5O5',
        drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
      },
      B: {
        chords: 'Am Em F B Am Em F B',
        lead: [
          'A5 - - - C6 - - -', 'B5 - - - G5 - - -', 'A5 - - - C6 - - -', 'D#6 - - - F#6 - - -',
          'E6 - D6 - C6 - B5 -', 'G5 - A5 - B5 - E5 -', 'F5 - A5 - C6 - F6 -', 'D#6 - B5 - F#5 - D#5 -',
        ],
        bass: 'RRORRRORRRORR5O5',
        drums: { k: 'x...x...x...x...', s: '....x.......x.xx', h: 'xxxxxxxxxxxxxxxx' },
        fill: { k: 'x...x...x...x...', s: 'x.x.x.x.xxxxxxxx', h: 'xxxxxxxx........' },
        arp: 'up', arpRate: 16,
      },
    },
  },

  // Cabins and shops: G major sevenths, soft keys, a bell answer.
  indoor: {
    bpm: 90, swing: 0.2, lead: 'soft', bass: 'round', reverb: 0.35, delay: 0.25,
    form: ['A', 'B'],
    sections: {
      A: {
        chords: 'Gmaj7 Em7 Cmaj7 D Gmaj7 Em7 Cmaj7 D',
        lead: [
          'B4 - D5 - F#5 - - -', 'G5 - - - E5 - D5 -', 'E5 - - - G5 - B4 -', 'A4 - - - - - . .',
          'B4 - D5 - F#5 - A5 -', 'G5 - - - B5 - A5 -', 'G5 - E5 - D5 - C5 -', 'D5 - - - - - . .',
        ],
        bass: 'R-----5-O-----5-',
        drums: { k: 'x.......x.......', s: '................', h: '....x.......x...' },
        pad: true,
      },
      B: {
        chords: 'Gmaj7 Em7 Cmaj7 D Gmaj7 Em7 Cmaj7 D',
        lead: [
          '. . . . D6 - - -', 'B5 - - - . . . .', '. . . . G5 - - -', 'F#5 - - - . . . .',
          '. . . . D6 - - -', 'E6 - - - D6 - - -', 'B5 - - - G5 - - -', 'A5 - - - - - . .',
        ],
        bass: 'R-----5-O-----5-',
        drums: { k: 'x.......x.......', s: '............g...', h: '..x...x...x...x.' },
        arp: 'up', arpRate: 8, pad: true,
      },
    },
  },

  // The sun sets right again: triumphant, then warm.
  ending: {
    bpm: 110, swing: 0, lead: 'square', bass: 'saw', reverb: 0.4, delay: 0.3,
    form: ['A', 'B'],
    sections: {
      A: {
        chords: 'C G/B Am F C G F G',
        lead: [
          'G4 - C5 - E5 - G5 -', 'D5 - - - B4 - G4 -', 'C5 - - - E5 - A5 -', 'A5 - G5 - F5 - C5 -',
          'E5 - - - G5 - C6 -', 'B5 - - - D6 - - -', 'C6 - A5 - F5 - A5 -', 'G5 - - - - - . .',
        ],
        counter: [
          'E4 - - - - - - -', 'D4 - - - - - - -', 'C4 - - - E4 - - -', 'F4 - - - - - - -',
          'G4 - - - - - - -', 'G4 - - - B4 - - -', 'A4 - - - - - - -', 'B4 - - - D5 - - -',
        ],
        bass: 'R.RRR.RRR.RR5.O.',
        drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' },
        fill: { k: 'x...x...x.......', s: '....x...x.x.tttt', h: 'x.x.x.x.........' },
        arp: 'up', arpRate: 16, pad: true,
      },
      B: {
        chords: 'F G Em Am Dm G C C',
        lead: [
          'A5 - - - C6 - - -', 'B5 - - - D6 - - -', 'G5 - - - B5 - - -', 'C6 - - - E6 - - -',
          'F6 - E6 - D6 - C6 -', 'B5 - - - D6 - B5 -', 'C6 - - - - - - -', '- - - - . . . .',
        ],
        bass: 'R-.R..R.R-.R..5.',
        drums: { k: 'x.........x.....', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
        arp: 'updown', arpRate: 16, pad: true,
      },
    },
  },

  // The Wildwood at night: E dorian (the bright C# of the A chord) that
  // slips into aeolian further in. A soft analog arp, a hollow flute-ish
  // lead walking between the trunks, a dotted bass. I is a pedal intro;
  // A wanders, B climbs toward the canopy, C goes deep and quiet.
  forest: {
    bpm: 106, swing: 0, lead: 'hollow', bass: 'saw', reverb: 0.42, delay: 0.38,
    arpVoice: 'warm',
    form: ['I', 'A', 'B', 'C'], loopFrom: 1,
    sections: {
      I: {
        chords: 'Em7 A/E Em7 A/E',
        bass: 'R-------R---5---',
        drums: { k: 'x...............', s: '................', h: '................' },
        fill: { k: 'x.........x.....', s: '............g.g.', h: '..x...x...x...x.' },
        arp: 'up', arpRate: 16, pad: true,
      },
      A: {
        chords: 'Em7 A Em7 A Cmaj7 D Bm7 A',
        lead: [
          'B4 - - - E5 - F#5 G5', 'F#5 - E5 - C#5 - - -', 'B4 - - - E5 - F#5 G5', 'A5 - - - F#5 - - .',
          'G5 - - - E5 - B4 -', 'A5 - F#5 - D5 - E5 F#5', 'D5 - - - B4 - A4 -', 'C#5 - - - - - . .',
        ],
        bass: 'R..R..R...R.5.O.',
        drums: { k: 'x.....x...x.....', s: '....x.......x..g', h: '..x...x...x...x.' },
        arp: 'updown', arpRate: 16, pad: true,
      },
      B: {
        chords: 'Cmaj7 G D Em Cmaj7 G Asus4 A',
        lead: [
          'E5 - G5 - B5 - - -', 'D6 - - - B5 - G5 -', 'A5 - - - F#5 - A5 -', 'B5 - - - G5 - E5 F#5',
          'G5 - - - E5 - C6 -', 'B5 - - - D6 - B5 -', 'A5 - - - D6 - - -', 'C#6 - - - - - . .',
        ],
        counter: [
          'C5 - - - - - - -', 'B4 - - - - - - -', 'A4 - - - - - - -', 'G4 - - - - - - -',
          'E4 - - - - - - -', 'D4 - - - - - - -', 'D4 - - - - - - -', 'C#4 - - - E4 - - -',
        ],
        bass: 'R-.R..R.O-.R..5.',
        drums: { k: 'x.....x...x...x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' },
        fill: { k: 'x.....x.x.......', s: '....x...t.t.tttt', h: 'x.x.x.x.........' },
        arp: 'up', arpRate: 16, pad: true,
      },
      C: {
        chords: 'Am7 Em7 Am7 Em7 Cmaj7 D Em7 C|D',
        lead: [
          'C5 - - - B4 - A4 -', 'G4 - - - - - . .', 'C5 - - - D5 - E5 -', 'B4 - - - - - . .',
          'G4 - - - B4 - E5 -', 'F#5 - - - A5 - - -', 'G5 - - - F#5 - E5 -', 'D5 - - - F#5 - - .',
        ],
        bass: 'R-------5-------',
        drums: { k: 'x.........x.....', s: '................', h: '....x.......x...' },
        fill: { k: 'x.........x.....', s: '........g...g.gg', h: '....x.......x...' },
        arp: 'down', arpRate: 8, pad: true,
      },
    },
  },

  // Project HORIZON: C minor, a resonant saw sequence running steady
  // sixteenths (four notes on triads, five on the sevenths, so it drifts
  // against the bar), an eighth-note ostinato bass, a cold lead that says
  // little. I is sequence and bass alone; A settles in; B turns through a
  // Neapolitan Dbmaj7; C drops the lead and climbs a counter line over a
  // sixteenth pulse back into A.
  lab: {
    bpm: 104, swing: 0, lead: 'saw', bass: 'saw', reverb: 0.32, delay: 0.36,
    arpVoice: 'pluck',
    form: ['I', 'A', 'B', 'C'], loopFrom: 1,
    sections: {
      I: {
        chords: 'Cm Cm Abmaj7 Abmaj7',
        bass: 'R.R.R.R.R.R.R.R.',
        drums: D_NONE,
        fill: { k: 'x.......x.......', s: '............g.g.', h: '................' },
        arp: 'up', arpRate: 16,
      },
      A: {
        chords: 'Cm Cm Abmaj7 Abmaj7 Cm Cm Fm7 G',
        lead: [
          'G5 - - - - - - -', '- - - - Eb5 - - -', 'C5 - - - - - - -', 'G5 - - - - - . .',
          'G5 - - - Ab5 - G5 -', 'Eb5 - - - - - . .', 'F5 - - - Ab5 - C6 -', 'B5 - - - - - . .',
        ],
        bass: 'R.R.O.R.R.R.O.R.',
        drums: { k: 'x.......x.......', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
        arp: 'up', arpRate: 16, pad: true,
      },
      B: {
        chords: 'Abmaj7 Ebmaj7 Fm7 Cm Abmaj7 Ebmaj7 Dbmaj7 G',
        lead: [
          'C6 - - - - - Bb5 -', 'G5 - - - - - . .', 'Ab5 - - - G5 - F5 -', 'G5 - - - - - . .',
          'Eb6 - - - - - C6 -', 'D6 - - - Bb5 - - -', 'C6 - - - Ab5 - F5 -', 'D5 - - - B4 - - -',
        ],
        counter: [
          'Eb4 - - - - - - -', 'D4 - - - - - - -', 'C4 - - - - - - -', 'Eb4 - - - - - - -',
          'Eb4 - - - - - - -', 'G4 - - - - - - -', 'F4 - - - - - - -', 'F4 - - - - - - -',
        ],
        bass: 'R.R.O.R.R.R.O.5.',
        drums: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
        fill: { k: 'x.......x.x.....', s: '....x.......tttt', h: 'x.xxx.xxx.......' },
        arp: 'up', arpRate: 16, pad: true,
      },
      C: {
        chords: 'Fm7 Fm7 Cm Cm Fm7 Fm7 G G',
        counter: [
          'Ab4 - - - - - - -', 'Bb4 - - - - - - -', 'C5 - - - - - - -', 'Eb5 - - - - - - -',
          'F5 - - - - - - -', 'Ab5 - - - - - - -', 'B5 - - - - - - -', 'D6 - - - - - . .',
        ],
        bass: 'RRRRRRRRRRRRRRRR',
        drums: { k: 'x...x...x...x...', s: '................', h: '..x...x...x...x.' },
        fill: { k: 'x...x...x...x...', s: 'x.x.x.x.xxxxtttt', h: 'xxxxxxxx........' },
        arp: 'up', arpRate: 16,
      },
    },
  },

  // The Other Side: B minor with a Phrygian C leaning on a B pedal. Wide
  // detuned pads swelling in and out, a drone bass, tape wow on everything,
  // a sad bell motif (F# D C# B, answered E C B G). A is almost only the
  // drone; B lifts through Gmaj7 and Cmaj7 with slow glass bells falling.
  static: {
    bpm: 74, swing: 0, lead: 'bell', bass: 'round', reverb: 0.62, delay: 0.5,
    arpVoice: 'glass', padDetune: 17, padSwell: true, wow: 16,
    form: ['A', 'B'],
    sections: {
      A: {
        chords: 'Bm Bm C/B C/B Bm Bm Gmaj7 F#sus4',
        lead: [
          'F#5 - - - D5 - C#5 -', 'B4 - - - - - - -', 'E5 - - - C5 - B4 -', 'G4 - - - - - - -',
          '. . . . F#5 - D5 -', 'A5 - - - F#5 - - -', 'F#5 - - - D5 - B4 -', 'C#5 - - - B4 - - -',
        ],
        bass: 'R---------------',
        drums: { k: 'x...............', s: '................', h: '................' },
        pad: true,
      },
      B: {
        chords: 'Gmaj7 Gmaj7 Em7 Em7 Cmaj7 Cmaj7 F#sus4 F#m',
        lead: [
          'D6 - - - B5 - - -', 'F#5 - - - - - - -', 'G5 - - - E5 - D5 -', 'B4 - - - - - - -',
          'E5 - - - G5 - B5 -', 'C6 - - - B5 - - -', 'B5 - - - A5 - F#5 -', 'C#5 - - - - - - -',
        ],
        counter: [
          'D4 - - - - - - -', '- - - - - - - -', 'E4 - - - - - - -', '- - - - D4 - - -',
          'E4 - - - - - - -', '- - - - - - - -', 'C#4 - - - - - - -', '- - - - . . . .',
        ],
        bass: 'R-------5-------',
        drums: { k: 'x.........x.....', s: '............g...', h: '................' },
        arp: 'down', arpRate: 8, pad: true,
      },
    },
  },
}

// ---- compile ---------------------------------------------------------------

export interface NoteEv { step: number; midi: number; len: number }

export interface CBar {
  chords: Array<{ from: number; len: number; c: Chord }>
  lead: NoteEv[]
  counter: NoteEv[]
  bass: NoteEv[]
  drums: Drums
  arp: SectionDef['arp'] | null
  arpRate: 8 | 16
  pad: boolean
}

export interface CompiledTrack { bars: CBar[]; loopBar: number }

function chordAt(bar: CBar, step: number): Chord {
  let c = bar.chords[0]!.c
  for (const ch of bar.chords) if (ch.from <= step) c = ch.c
  return c
}

/** Bass midi for a chord: root pitch class in C2..B2. */
function bassRoot(c: Chord): number {
  return 36 + c.bass
}

/** Parse one melodic line (bars of 8 or 16 tokens) into events; holds may cross bars. */
function parseLine(bars: string[], out: NoteEv[][]): string[] {
  const errors: string[] = []
  let last: NoteEv | null = null
  bars.forEach((bar, bi) => {
    const toks = bar.trim().split(/\s+/)
    if (toks.length !== 8 && toks.length !== 16) errors.push(`bar ${bi}: ${toks.length} tokens`)
    const size = 16 / toks.length
    toks.forEach((tok, i) => {
      const step = Math.round(i * size)
      if (tok === '-') {
        if (last) last.len += size
      } else if (tok === '.') {
        last = null
      } else {
        const m = noteMidi(tok)
        if (m < 0) { errors.push(`bar ${bi}: bad token ${tok}`); last = null; return }
        last = { step, midi: m, len: size }
        out[bi]!.push(last)
      }
    })
  })
  return errors
}

export function compileTrack(def: TrackDef): { track: CompiledTrack; errors: string[] } {
  const errors: string[] = []
  const bars: CBar[] = []
  const leadLines: string[] = []
  const counterLines: string[] = []
  let loopBar = 0
  def.form.forEach((name, fi) => {
    const sec = def.sections[name]
    if (!sec) { errors.push(`form: no section ${name}`); return }
    if (fi === (def.loopFrom ?? 0)) loopBar = bars.length
    const syms = sec.chords.trim().split(/\s+/)
    if (sec.lead && sec.lead.length !== syms.length) errors.push(`${name}: ${sec.lead.length} lead bars for ${syms.length} chords`)
    if (sec.counter && sec.counter.length !== syms.length) errors.push(`${name}: counter length`)
    for (const [lane, pat] of Object.entries(sec.drums)) {
      if (pat.length !== 16) errors.push(`${name}: drum ${lane} not 16`)
    }
    if (sec.bass.length !== 16 || /[^RO537.\-]/.test(sec.bass)) errors.push(`${name}: bad bass pattern`)
    syms.forEach((sym, bi) => {
      const parts = sym.split('|')
      const len = 16 / parts.length
      const chords = parts.map((p, i) => {
        const c = parseChord(p)
        if (!c) errors.push(`${name}: bad chord ${p}`)
        return { from: i * len, len, c: c ?? { root: 0, bass: 0, tones: [0, 4, 7] } }
      })
      const last = bi === syms.length - 1
      bars.push({
        chords,
        lead: [],
        counter: [],
        bass: [],
        drums: last && sec.fill ? sec.fill : sec.drums,
        arp: sec.arp ?? null,
        arpRate: sec.arpRate ?? 16,
        pad: !!sec.pad,
      })
      leadLines.push(sec.lead?.[bi] ?? '. . . . . . . .')
      counterLines.push(sec.counter?.[bi] ?? '. . . . . . . .')
    })
  })
  const leadOut = bars.map(b => b.lead)
  const counterOut = bars.map(b => b.counter)
  for (const e of parseLine(leadLines, leadOut)) errors.push(`lead ${e}`)
  for (const e of parseLine(counterLines, counterOut)) errors.push(`counter ${e}`)
  // Bass: pattern per bar, notes follow the chord at each step.
  let secIndex = 0
  let barInSec = 0
  let lastBass: NoteEv | null = null
  for (const bar of bars) {
    const name = def.form[secIndex]!
    const sec = def.sections[name]
    const pat = sec?.bass ?? '................'
    for (let s = 0; s < 16; s++) {
      const ch = pat[s]
      if (ch === '-') { if (lastBass) lastBass.len += 1; continue }
      if (ch === '.' || ch === undefined) { lastBass = null; continue }
      const c = chordAt(bar, s)
      const r = bassRoot(c)
      const off = ch === 'O' ? 12
        : ch === '5' ? 7
          : ch === '3' ? (c.tones[1] ?? 4)
            : ch === '7' ? (c.tones[3] ?? 10)
              : 0
      lastBass = { step: s, midi: r + off, len: 1 }
      bar.bass.push(lastBass)
    }
    barInSec++
    const count = sec ? sec.chords.trim().split(/\s+/).length : 0
    if (barInSec >= count) { barInSec = 0; secIndex++ }
  }
  for (const b of bars) {
    for (const e of [...b.lead, ...b.counter, ...b.bass]) {
      if (!Number.isFinite(e.midi) || e.midi < 24 || e.midi > 108) errors.push(`note out of range ${e.midi}`)
    }
  }
  return { track: { bars, loopBar }, errors }
}

/** Every track's compile errors (empty = fine). Pure; used by tests. */
export function validateTracks(): string[] {
  const out: string[] = []
  for (const [id, def] of Object.entries(TRACKS)) {
    const { track, errors } = compileTrack(def)
    for (const e of errors) out.push(`${id}: ${e}`)
    if (track.bars.length < 16) out.push(`${id}: only ${track.bars.length} bars`)
  }
  for (const [id, j] of Object.entries(JINGLES)) {
    for (const n of j.notes) if (!Number.isFinite(n[1]) || n[1] < 24 || n[1] > 108) out.push(`jingle ${id}: bad note`)
  }
  return out
}

/** Chord tones for the arp, one octave from around G4. */
function arpTones(c: Chord): number[] {
  let base = 60 + c.root
  if (base < 64) base += 12
  const t = c.tones.filter(x => x < 12).map(x => base + x)
  return [...t, base + 12]
}

/** Pad voicing: chord tones folded into G3..F#4 plus the root an octave down. */
function padVoicing(c: Chord): number[] {
  const out: number[] = []
  for (const t of c.tones) {
    let m = 48 + ((c.root + t) % 12)
    if (m < 55) m += 12
    out.push(m)
  }
  return out
}

// ---- jingles (tempo in bpm, notes: [beat, midi, beats, voice]) ------------

type JVoice = 'lead' | 'harm' | 'bell' | 'pad' | 'bass'
interface JingleDef { bpm: number; notes: Array<[number, number, number, JVoice]> }

const N = noteMidi
export const JINGLES: Record<JingleName, JingleDef> = {
  item: {
    bpm: 150,
    notes: [
      [0, N('A4'), 0.5, 'lead'], [0.5, N('C#5'), 0.5, 'lead'], [1, N('E5'), 0.5, 'lead'], [1.5, N('A5'), 0.5, 'lead'],
      [2, N('B5'), 0.5, 'lead'], [2.5, N('C#6'), 2, 'lead'],
      [2, N('E5'), 0.5, 'harm'], [2.5, N('E5'), 2, 'harm'], [2.5, N('A5'), 2, 'harm'],
      [0, N('A2'), 2, 'bass'], [2, N('E2'), 0.5, 'bass'], [2.5, N('A2'), 2, 'bass'],
      [2.5, N('E7'), 0.4, 'bell'], [2.75, N('A7'), 0.4, 'bell'],
    ],
  },
  secret: {
    bpm: 160,
    notes: [
      [0, N('E5'), 0.25, 'bell'], [0.25, N('G#5'), 0.25, 'bell'], [0.5, N('B5'), 0.25, 'bell'], [0.75, N('D#6'), 0.25, 'bell'],
      [1, N('F#6'), 0.25, 'bell'], [1.25, N('B6'), 1.5, 'bell'],
      [1.25, N('B4'), 1.5, 'pad'], [1.25, N('D#5'), 1.5, 'pad'], [1.25, N('F#5'), 1.5, 'pad'],
    ],
  },
  fanfare: {
    bpm: 132,
    notes: [
      [0, N('G4'), 0.33, 'lead'], [0.33, N('C5'), 0.33, 'lead'], [0.66, N('E5'), 0.34, 'lead'],
      [1, N('D5'), 1, 'lead'], [2, N('G5'), 1, 'lead'],
      [3, N('F5'), 0.5, 'lead'], [3.5, N('E5'), 0.5, 'lead'], [4, N('D5'), 0.5, 'lead'], [4.5, N('G5'), 0.5, 'lead'],
      [5, N('C6'), 3, 'lead'],
      [1, N('B4'), 1, 'harm'], [2, N('D5'), 1, 'harm'], [3, N('A4'), 1, 'harm'], [4, N('B4'), 1, 'harm'], [5, N('E5'), 3, 'harm'], [5, N('G5'), 3, 'harm'],
      [0, N('C3'), 1, 'bass'], [1, N('G2'), 2, 'bass'], [3, N('F2'), 1, 'bass'], [4, N('G2'), 1, 'bass'], [5, N('C3'), 3, 'bass'],
      [1, N('G3'), 2, 'pad'], [1, N('B3'), 2, 'pad'], [3, N('A3'), 2, 'pad'], [3, N('C4'), 2, 'pad'],
      [5, N('C4'), 3, 'pad'], [5, N('E4'), 3, 'pad'], [5, N('G4'), 3, 'pad'],
      [5, N('C7'), 0.5, 'bell'], [5.5, N('G7'), 0.5, 'bell'],
    ],
  },
  heartPiece: {
    bpm: 140,
    notes: [
      [0, N('C6'), 0.5, 'bell'], [0.5, N('E6'), 0.5, 'bell'], [1, N('G6'), 0.5, 'bell'], [1.5, N('C7'), 1.5, 'bell'],
      [0, N('C5'), 3, 'pad'], [0, N('E5'), 3, 'pad'], [0, N('G5'), 3, 'pad'],
    ],
  },
  gameOver: {
    bpm: 96,
    notes: [
      [0, N('E5'), 0.5, 'lead'], [0.5, N('D5'), 0.5, 'lead'], [1, N('C5'), 0.5, 'lead'], [1.5, N('B4'), 0.5, 'lead'],
      [2, N('A4'), 2, 'lead'],
      [0, N('A2'), 2, 'bass'], [2, N('A1'), 2, 'bass'],
      [2, N('A3'), 2, 'pad'], [2, N('C4'), 2, 'pad'], [2, N('E4'), 2, 'pad'],
    ],
  },
  // Someone joins you: two voices in thirds walking IV–V–I into F, a bell on top.
  friend: {
    bpm: 112,
    notes: [
      [0, N('D5'), 0.5, 'lead'], [0.5, N('F5'), 0.5, 'lead'], [1, N('E5'), 0.5, 'lead'], [1.5, N('G5'), 0.5, 'lead'],
      [2, N('A5'), 2, 'lead'],
      [0, N('Bb4'), 0.5, 'harm'], [0.5, N('D5'), 0.5, 'harm'], [1, N('C5'), 0.5, 'harm'], [1.5, N('E5'), 0.5, 'harm'],
      [2, N('F5'), 2, 'harm'],
      [0, N('Bb2'), 1, 'bass'], [1, N('C3'), 1, 'bass'], [2, N('F2'), 2, 'bass'],
      [0, N('Bb3'), 1, 'pad'], [0, N('D4'), 1, 'pad'], [0, N('F4'), 1, 'pad'],
      [1, N('C4'), 1, 'pad'], [1, N('E4'), 1, 'pad'], [1, N('G4'), 1, 'pad'],
      [2, N('F4'), 2, 'pad'], [2, N('A4'), 2, 'pad'], [2, N('C5'), 2, 'pad'],
      [2, N('F6'), 0.5, 'bell'], [2.5, N('C7'), 0.5, 'bell'], [3, N('A6'), 1, 'bell'],
    ],
  },
}

// ---------------------------------------------------------------------------
// Live engine
// ---------------------------------------------------------------------------

interface Player {
  id: TrackId
  def: TrackDef
  comp: CompiledTrack
  bar: number
  step: number
  nextTime: number
  arpI: number
  dry: GainNode
  del: GainNode
  rev: GainNode
  gated: GainNode
  alive: boolean
}

const MUSIC_LEVEL = 0.3
const SFX_LEVEL = 1
const MASTER_LEVEL = 0.85

function readMuted(): boolean {
  try { return typeof window !== 'undefined' && localStorage.getItem(SOUND_MUTE_KEY) === '1' } catch { return false }
}

export function createZeldaAudio(): ZeldaAudio {
  let ac: AudioContext | null = null
  let master!: GainNode
  let sfxBus!: GainNode
  let musicBus!: GainNode
  let hall!: ConvolverNode
  let gatedVerb!: ConvolverNode
  let sfxVerb!: ConvolverNode
  let delay!: DelayNode
  let noise!: AudioBuffer
  let pulseWave: PeriodicWave | null = null
  let timer: ReturnType<typeof setInterval> | null = null
  let current: Player | null = null
  const fading: Player[] = []
  let muted = readMuted()
  let radioParked = false
  let lastText = 0
  let glyphI = 0
  let lastGlyph = 0
  let grit: WaveShaperNode | null = null
  let duckUntil = 0

  const client = () => typeof window !== 'undefined'

  function impulse(seconds: number, shape: (t: number) => number): AudioBuffer {
    const c = ac!
    const len = Math.max(1, Math.floor(c.sampleRate * seconds))
    const buf = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * shape(i / len)
    }
    return buf
  }

  function ensure(): boolean {
    if (!client()) return false
    if (ac) {
      if (ac.state === 'suspended') ac.resume().catch(() => {})
      return true
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false
    try { ac = new Ctor() } catch { ac = null; return false }
    const c = ac
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.knee.value = 8
    comp.ratio.value = 6
    comp.attack.value = 0.004
    comp.release.value = 0.2
    comp.connect(c.destination)
    master = c.createGain()
    master.gain.value = muted ? 0 : MASTER_LEVEL
    master.connect(comp)
    sfxBus = c.createGain()
    sfxBus.gain.value = SFX_LEVEL
    sfxBus.connect(master)
    musicBus = c.createGain()
    musicBus.gain.value = MUSIC_LEVEL
    musicBus.connect(master)

    noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const nd = noise.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1

    hall = c.createConvolver()
    hall.buffer = impulse(2.4, t => Math.pow(1 - t, 3) * 0.6)
    hall.connect(musicBus)
    gatedVerb = c.createConvolver()
    // The 80s gated snare: dense for ~0.25 s, then cut dead.
    gatedVerb.buffer = impulse(0.3, t => (t < 0.8 ? 0.55 : Math.max(0, (1 - t) * 2.5)))
    gatedVerb.connect(musicBus)
    sfxVerb = c.createConvolver()
    sfxVerb.buffer = impulse(1.1, t => Math.pow(1 - t, 2.5) * 0.4)
    const sfxVerbGain = c.createGain()
    sfxVerbGain.gain.value = 0.5
    sfxVerb.connect(sfxVerbGain)
    sfxVerbGain.connect(sfxBus)

    delay = c.createDelay(2)
    delay.delayTime.value = 0.36
    const fb = c.createGain()
    fb.gain.value = 0.33
    const dlp = c.createBiquadFilter()
    dlp.type = 'lowpass'
    dlp.frequency.value = 2600
    delay.connect(dlp)
    dlp.connect(fb)
    fb.connect(delay)
    dlp.connect(musicBus)

    // 25 % pulse for the chip lead.
    const n = 32
    const real = new Float32Array(n)
    const imag = new Float32Array(n)
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25)
    try { pulseWave = c.createPeriodicWave(real, imag) } catch { pulseWave = null }

    if (c.state === 'suspended') c.resume().catch(() => {})
    return true
  }

  // ---- radio --------------------------------------------------------------

  function parkRadio(): void {
    if (radioParked) return
    try {
      getRadioEngine().hold(true)
      radioParked = true
    } catch { /* no radio */ }
  }

  function unparkRadio(): void {
    if (!radioParked) return
    radioParked = false
    try {
      const r = getRadioEngine()
      r.hold(false)
      if (r.playing && localStorage.getItem(RADIO_MUTE_KEY) !== '1') r.suspend(false)
    } catch { /* ignore */ }
  }

  // ---- music voices -----------------------------------------------------------

  function env(g: GainNode, at: number, peak: number, attack: number, dur: number, release = 0.05): void {
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak, at + attack)
    g.gain.setValueAtTime(peak, at + Math.max(attack, dur - release))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + release)
  }

  function osc(type: OscillatorType | 'pulse', freq: number, at: number, stop: number, detune = 0): OscillatorNode {
    const o = ac!.createOscillator()
    if (type === 'pulse') {
      if (pulseWave) o.setPeriodicWave(pulseWave)
      else o.type = 'square'
    } else o.type = type
    o.frequency.setValueAtTime(freq, at)
    if (detune) o.detune.setValueAtTime(detune, at)
    o.start(at)
    o.stop(stop)
    return o
  }

  function leadNote(p: Player, voice: LeadVoice, midi: number, at: number, dur: number, vol: number): void {
    const c = ac!
    const f = hz(midi)
    const g = c.createGain()
    const end = at + dur + 0.25
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 2
    const shaped: OscillatorNode[] = []
    if (voice === 'square') {
      shaped.push(osc('square', f, at, end), osc('square', f, at, end, -7))
      lp.frequency.setValueAtTime(4200, at)
      lp.frequency.exponentialRampToValueAtTime(1600, at + Math.max(0.08, dur))
      env(g, at, vol * 0.55, 0.008, dur, 0.12)
    } else if (voice === 'saw') {
      shaped.push(osc('sawtooth', f, at, end, 8), osc('sawtooth', f, at, end, -8))
      lp.frequency.setValueAtTime(3200, at)
      lp.frequency.exponentialRampToValueAtTime(1300, at + Math.max(0.08, dur))
      env(g, at, vol * 0.5, 0.01, dur, 0.15)
    } else if (voice === 'pulse') {
      shaped.push(osc('pulse', f, at, end))
      lp.frequency.setValueAtTime(3000, at)
      env(g, at, vol * 0.7, 0.006, dur, 0.1)
    } else if (voice === 'soft') {
      shaped.push(osc('triangle', f, at, end), osc('sine', f * 2, at, end))
      lp.frequency.setValueAtTime(5000, at)
      // Electric-piano-ish: fast decay to a quiet sustain.
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(vol * 1.1, at + 0.006)
      g.gain.exponentialRampToValueAtTime(vol * 0.35, at + 0.25)
      g.gain.setValueAtTime(vol * 0.35, at + Math.max(0.26, dur))
      g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.26, dur) + 0.2)
    } else if (voice === 'hollow') {
      // A breathy synth flute: two soft triangles, a slow swell, a dark filter.
      shaped.push(osc('triangle', f, at, end, 4), osc('triangle', f, at, end, -4), osc('sine', f * 2, at, end))
      lp.frequency.setValueAtTime(1500, at)
      lp.frequency.linearRampToValueAtTime(2600, at + Math.min(0.2, dur))
      env(g, at, vol * 0.95, Math.min(0.05, dur * 0.4), dur, 0.18)
    } else {
      shaped.push(osc('sine', f, at, end), osc('sine', f * 3.01, at, end))
      lp.frequency.setValueAtTime(8000, at)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(vol, at + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.4, dur) + 0.3)
    }
    // Delayed vibrato on long notes.
    if (dur > 0.3 && voice !== 'bell') {
      const lfo = osc('sine', 5.6, at, end)
      const depth = c.createGain()
      depth.gain.setValueAtTime(0, at)
      depth.gain.linearRampToValueAtTime(0, at + 0.18)
      depth.gain.linearRampToValueAtTime(14, at + 0.45)
      lfo.connect(depth)
      for (const o of shaped) depth.connect(o.detune)
    }
    wobble(shaped, p.def.wow, at, end)
    for (const o of shaped) o.connect(lp)
    lp.connect(g)
    g.connect(p.dry)
    g.connect(p.del)
    g.connect(p.rev)
  }

  function bassNote(p: Player, voice: BassVoice, midi: number, at: number, dur: number): void {
    const c = ac!
    const f = hz(midi)
    const end = at + dur + 0.1
    const g = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = voice === 'saw' ? 6 : 2
    if (voice === 'round') {
      osc('triangle', f, at, end).connect(lp)
      osc('sine', f / 2, at, end).connect(lp)
      lp.frequency.setValueAtTime(1200, at)
      env(g, at, 0.42, 0.006, dur, 0.06)
    } else {
      osc(voice === 'saw' ? 'sawtooth' : 'square', f, at, end).connect(lp)
      osc('square', f / 2, at, end).connect(lp)
      lp.frequency.setValueAtTime(voice === 'saw' ? 1500 : 900, at)
      lp.frequency.exponentialRampToValueAtTime(260, at + Math.min(dur, 0.25) + 0.02)
      env(g, at, voice === 'saw' ? 0.32 : 0.26, 0.004, dur, 0.04)
    }
    lp.connect(g)
    g.connect(p.dry)
  }

  /** Tape wow: a slow shared pitch drift (cents) on a note's oscillators. */
  function wobble(oscs: OscillatorNode[], cents: number | undefined, at: number, end: number): void {
    if (!cents) return
    const c = ac!
    const lfo = osc('sine', 0.23, at, end)
    const lfo2 = osc('sine', 0.61, at, end)
    const depth = c.createGain()
    depth.gain.value = cents
    const depth2 = c.createGain()
    depth2.gain.value = cents * 0.4
    lfo.connect(depth)
    lfo2.connect(depth2)
    for (const o of oscs) { depth.connect(o.detune); depth2.connect(o.detune) }
  }

  function padChord(p: Player, notes: number[], at: number, dur: number): void {
    const c = ac!
    const def = p.def
    const g = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(900, at)
    lp.frequency.linearRampToValueAtTime(1500, at + dur * 0.5)
    lp.frequency.linearRampToValueAtTime(1000, at + dur)
    const tail = def.padSwell ? 1.1 : 0.4
    const end = at + dur + tail + 0.1
    const det = def.padDetune ?? 9
    const oscs: OscillatorNode[] = []
    for (const m of notes) oscs.push(osc('sawtooth', hz(m), at, end, det), osc('sawtooth', hz(m), at, end, -det))
    wobble(oscs, def.wow, at, end)
    for (const o of oscs) o.connect(lp)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(0.045, at + (def.padSwell ? dur * 0.45 : Math.min(0.35, dur * 0.3)))
    g.gain.setValueAtTime(0.045, at + dur - 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + tail)
    lp.connect(g)
    g.connect(p.dry)
    g.connect(p.rev)
  }

  function arpNote(p: Player, midi: number, at: number, dur: number): void {
    const c = ac!
    const g = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    const f = hz(midi)
    const voice = p.def.arpVoice ?? 'square'
    if (voice === 'pluck') {
      // The sequencer: a saw through a resonant filter that snaps shut.
      lp.Q.value = 7
      lp.frequency.setValueAtTime(2800, at)
      lp.frequency.exponentialRampToValueAtTime(420, at + Math.max(0.05, dur * 0.9))
      osc('sawtooth', f, at, at + dur + 0.05).connect(lp)
      osc('square', f / 2, at, at + dur + 0.05, 5).connect(lp)
      env(g, at, 0.07, 0.002, dur * 0.85, 0.03)
    } else if (voice === 'warm') {
      lp.Q.value = 2
      lp.frequency.setValueAtTime(2000, at)
      lp.frequency.exponentialRampToValueAtTime(900, at + Math.max(0.05, dur))
      osc('sawtooth', f, at, at + dur + 0.08, 6).connect(lp)
      osc('triangle', f, at, at + dur + 0.08, -6).connect(lp)
      env(g, at, 0.05, 0.006, dur * 0.8, 0.06)
    } else if (voice === 'glass') {
      lp.frequency.value = 7000
      osc('sine', f, at, at + dur + 0.6).connect(lp)
      osc('sine', f * 2.76, at, at + dur + 0.6).connect(lp)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.04, at + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.5)
    } else {
      lp.frequency.value = 3200
      osc('square', f, at, at + dur + 0.05).connect(lp)
      env(g, at, 0.055, 0.003, dur * 0.8, 0.03)
    }
    lp.connect(g)
    g.connect(p.dry)
    g.connect(p.del)
  }

  function counterNote(p: Player, midi: number, at: number, dur: number): void {
    const c = ac!
    const g = c.createGain()
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1800
    const end = at + dur + 0.3
    osc('sawtooth', hz(midi), at, end, 5).connect(lp)
    osc('triangle', hz(midi), at, end).connect(lp)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(0.07, at + 0.08)
    g.gain.setValueAtTime(0.07, at + Math.max(0.09, dur - 0.05))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.25)
    lp.connect(g)
    g.connect(p.dry)
    g.connect(p.rev)
  }

  function noiseSrc(at: number, dur: number): AudioBufferSourceNode {
    const src = ac!.createBufferSource()
    src.buffer = noise
    src.start(at, Math.random() * 1.5)
    src.stop(at + dur + 0.02)
    return src
  }

  function drumHit(p: Player, lane: 'k' | 's' | 'h', ch: string, at: number): void {
    const c = ac!
    if (lane === 'k') {
      const o = osc('sine', 160, at, at + 0.3)
      o.frequency.exponentialRampToValueAtTime(40, at + 0.14)
      const g = c.createGain()
      g.gain.setValueAtTime(ch === 'X' ? 0.95 : 0.8, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22)
      o.connect(g)
      g.connect(p.dry)
      return
    }
    if (lane === 's') {
      if (ch === 't') {
        const o = osc('sine', 190, at, at + 0.3)
        o.frequency.exponentialRampToValueAtTime(85, at + 0.2)
        const g = c.createGain()
        g.gain.setValueAtTime(0.5, at)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.24)
        o.connect(g)
        g.connect(p.dry)
        g.connect(p.gated)
        return
      }
      const vol = ch === 'g' ? 0.12 : 0.36
      const src = noiseSrc(at, 0.2)
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1400
      const g = c.createGain()
      g.gain.setValueAtTime(vol, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.17)
      src.connect(hp)
      hp.connect(g)
      g.connect(p.dry)
      if (ch !== 'g') g.connect(p.gated)
      const o = osc('triangle', 200, at, at + 0.12)
      o.frequency.exponentialRampToValueAtTime(150, at + 0.08)
      const g2 = c.createGain()
      g2.gain.setValueAtTime(vol * 0.6, at)
      g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
      o.connect(g2)
      g2.connect(p.dry)
      return
    }
    const open = ch === 'o'
    const src = noiseSrc(at, open ? 0.25 : 0.06)
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = open ? 6500 : 8000
    const g = c.createGain()
    g.gain.setValueAtTime(open ? 0.09 : 0.1, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + (open ? 0.22 : 0.04))
    src.connect(hp)
    hp.connect(g)
    g.connect(p.dry)
  }

  // ---- scheduler ------------------------------------------------------------

  function scheduleStep(p: Player): void {
    const def = p.def
    const bar = p.comp.bars[p.bar]!
    const s = p.step
    const sixteenth = 60 / def.bpm / 4
    const at = p.nextTime + (s % 4 === 2 ? def.swing * sixteenth : 0)

    for (const lane of ['k', 's', 'h'] as const) {
      const ch = bar.drums[lane][s]
      if (ch && ch !== '.') drumHit(p, lane, ch, at)
    }
    for (const e of bar.bass) if (e.step === s) bassNote(p, def.bass, e.midi, at, e.len * sixteenth * 0.92)
    for (const e of bar.lead) if (e.step === s) leadNote(p, def.lead, e.midi, at, e.len * sixteenth * 0.95, 0.2)
    for (const e of bar.counter) if (e.step === s) counterNote(p, e.midi, at, e.len * sixteenth)
    for (const ch of bar.chords) {
      if (ch.from === s && bar.pad) padChord(p, padVoicing(ch.c), at, ch.len * sixteenth)
    }
    if (bar.arp && (bar.arpRate === 16 || s % 2 === 0)) {
      const tones = arpTones(chordAt(bar, s))
      const n = tones.length
      let idx: number
      if (bar.arp === 'up') idx = p.arpI % n
      else if (bar.arp === 'down') idx = n - 1 - (p.arpI % n)
      else {
        const cyc = Math.max(1, 2 * n - 2)
        const k = p.arpI % cyc
        idx = k < n ? k : cyc - k
      }
      p.arpI++
      arpNote(p, tones[idx]!, at, sixteenth * (bar.arpRate === 16 ? 1 : 2))
    }

    p.nextTime += sixteenth
    p.step++
    if (p.step >= 16) {
      p.step = 0
      p.bar++
      if (p.bar >= p.comp.bars.length) p.bar = p.comp.loopBar
    }
  }

  function tick(): void {
    if (!ac) return
    const horizon = ac.currentTime + 0.15
    if (current && current.alive) {
      // Never schedule into the past after a stall (tab throttling).
      if (current.nextTime < ac.currentTime - 0.1) current.nextTime = ac.currentTime + 0.02
      let guard = 0
      while (current.nextTime < horizon && guard++ < 64) scheduleStep(current)
    }
    if (duckUntil && ac.currentTime >= duckUntil) {
      duckUntil = 0
      musicBus.gain.cancelScheduledValues(ac.currentTime)
      musicBus.gain.setValueAtTime(musicBus.gain.value, ac.currentTime)
      musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL, ac.currentTime + 0.4)
    }
    if (!current && !fading.length && timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function ensureTimer(): void {
    if (!timer) timer = setInterval(tick, 25)
  }

  function makePlayer(id: TrackId): Player {
    const c = ac!
    const def = TRACKS[id]
    const level = def.level ?? 1
    const mk = (dest: AudioNode, v: number) => {
      const g = c.createGain()
      g.gain.setValueAtTime(0, c.currentTime)
      g.gain.linearRampToValueAtTime(v, c.currentTime + 0.4)
      g.connect(dest)
      return g
    }
    return {
      id,
      def,
      comp: compileTrack(def).track,
      bar: 0,
      step: 0,
      nextTime: c.currentTime + 0.08,
      arpI: 0,
      dry: mk(musicBus, level),
      del: mk(delay, def.delay * level),
      rev: mk(hall, def.reverb * level),
      gated: mk(gatedVerb, 0.6 * level),
      alive: true,
    }
  }

  function fadeOut(p: Player, secs: number): void {
    const c = ac!
    p.alive = false
    const t = c.currentTime
    for (const g of [p.dry, p.del, p.rev, p.gated]) {
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.linearRampToValueAtTime(0, t + secs)
    }
    fading.push(p)
    setTimeout(() => {
      for (const g of [p.dry, p.del, p.rev, p.gated]) { try { g.disconnect() } catch { /* gone */ } }
      const i = fading.indexOf(p)
      if (i >= 0) fading.splice(i, 1)
    }, secs * 1000 + 600)
  }

  // ---- sfx primitives ---------------------------------------------------------

  interface ToneOpts { f: number; to?: number; dur: number; type?: OscillatorType; vol: number; at?: number; attack?: number; verb?: boolean; lp?: number }

  function tone(o: ToneOpts): void {
    const c = ac!
    const at = c.currentTime + (o.at ?? 0)
    const osc1 = c.createOscillator()
    osc1.type = o.type ?? 'square'
    osc1.frequency.setValueAtTime(Math.max(20, o.f), at)
    if (o.to) osc1.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), at + o.dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(o.vol, at + (o.attack ?? 0.004))
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur)
    let node: AudioNode = osc1
    if (o.lp) {
      const f = c.createBiquadFilter()
      f.type = 'lowpass'
      f.frequency.value = o.lp
      osc1.connect(f)
      node = f
    }
    node.connect(g)
    g.connect(sfxBus)
    if (o.verb) g.connect(sfxVerb)
    osc1.start(at)
    osc1.stop(at + o.dur + 0.05)
  }

  interface NoiseOpts { dur: number; vol: number; at?: number; type?: BiquadFilterType; f: number; to?: number; q?: number; verb?: boolean; attack?: number }

  function nz(o: NoiseOpts): void {
    const c = ac!
    const at = c.currentTime + (o.at ?? 0)
    const src = c.createBufferSource()
    src.buffer = noise
    const f = c.createBiquadFilter()
    f.type = o.type ?? 'bandpass'
    f.frequency.setValueAtTime(o.f, at)
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, at + o.dur)
    f.Q.value = o.q ?? 1
    const g = c.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(o.vol, at + (o.attack ?? 0.003))
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur)
    src.connect(f)
    f.connect(g)
    g.connect(sfxBus)
    if (o.verb) g.connect(sfxVerb)
    src.start(at, Math.random() * 1.5)
    src.stop(at + o.dur + 0.05)
  }

  const SFX: Record<SfxName, () => void> = {
    sword() {
      nz({ dur: 0.13, vol: 0.4, f: 900, to: 3800, q: 1.6 })
      tone({ f: 620, to: 1100, dur: 0.07, vol: 0.07 })
    },
    spin() {
      nz({ dur: 0.38, vol: 0.45, f: 500, to: 4200, q: 2 })
      nz({ dur: 0.3, vol: 0.25, f: 2500, to: 600, q: 2, at: 0.1 })
      tone({ f: 300, to: 950, dur: 0.34, type: 'sawtooth', vol: 0.09, lp: 2400 })
    },
    charge() {
      ;[1568, 1976, 2349, 3136].forEach((f, i) => tone({ f, dur: 0.14, type: 'sine', vol: 0.12, at: i * 0.045, verb: true }))
      tone({ f: 3136, dur: 0.04, type: 'square', vol: 0.06, at: 0.2 })
    },
    hit() {
      nz({ dur: 0.08, vol: 0.5, type: 'lowpass', f: 2200 })
      tone({ f: 230, to: 90, dur: 0.1, vol: 0.3 })
    },
    kill() {
      nz({ dur: 0.26, vol: 0.4, f: 1600, to: 250, q: 0.8 })
      tone({ f: 180, to: 60, dur: 0.18, type: 'sine', vol: 0.3 })
      ;[1568, 2093, 2637].forEach((f, i) => tone({ f, dur: 0.12, type: 'sine', vol: 0.1, at: 0.08 + i * 0.045, verb: true }))
    },
    clank() {
      tone({ f: 1420, dur: 0.14, vol: 0.14 })
      tone({ f: 1893, dur: 0.12, type: 'triangle', vol: 0.14 })
      nz({ dur: 0.04, vol: 0.2, type: 'highpass', f: 5000 })
    },
    hurt() {
      tone({ f: 520, to: 140, dur: 0.22, type: 'sawtooth', vol: 0.28, lp: 3000 })
      tone({ f: 260, to: 70, dur: 0.24, vol: 0.18 })
    },
    shock() {
      for (let i = 0; i < 7; i++) {
        const f = [180, 2400, 90, 1800, 300, 2900, 140][i]!
        tone({ f, to: f * 1.5, dur: 0.028, type: 'square', vol: 0.18, at: i * 0.03 })
      }
      nz({ dur: 0.22, vol: 0.25, f: 3000, q: 4 })
    },
    die() {
      tone({ f: 720, to: 60, dur: 0.9, type: 'sawtooth', vol: 0.3, lp: 2500 })
      ;[76, 72, 69, 64].forEach((m, i) => tone({ f: hz(m), dur: 0.2, type: 'triangle', vol: 0.18, at: 0.1 + i * 0.16 }))
    },
    cut() {
      nz({ dur: 0.05, vol: 0.3, type: 'highpass', f: 4000 })
      nz({ dur: 0.05, vol: 0.2, f: 2500, q: 2, at: 0.035 })
    },
    shatter() {
      nz({ dur: 0.16, vol: 0.45, f: 2600, q: 0.8 })
      ;[2200, 3400, 2800, 3900].forEach((f, i) => tone({ f, dur: 0.06, type: 'triangle', vol: 0.08, at: 0.02 + i * 0.03 }))
    },
    lift() { tone({ f: 300, to: 520, dur: 0.09, type: 'triangle', vol: 0.22 }) },
    throw() { nz({ dur: 0.14, vol: 0.28, f: 600, to: 1600, q: 1.2 }) },
    coin() {
      tone({ f: 988, dur: 0.06, vol: 0.13 })
      tone({ f: 1319, dur: 0.2, vol: 0.13, at: 0.06 })
    },
    heart() {
      ;[880, 1175, 1397].forEach((f, i) => tone({ f, dur: 0.12, type: 'triangle', vol: 0.18, at: i * 0.06 }))
    },
    key() {
      ;[1568, 2093, 2637, 3136].forEach((f, i) => tone({ f, dur: 0.1, type: 'triangle', vol: 0.14, at: i * 0.05, verb: true }))
    },
    chest() {
      tone({ f: 110, to: 150, dur: 0.28, type: 'sawtooth', vol: 0.18, lp: 700 })
      nz({ dur: 0.25, vol: 0.12, type: 'lowpass', f: 500 })
      ;[1760, 2217, 2637].forEach((f, i) => tone({ f, dur: 0.3, type: 'sine', vol: 0.08, at: 0.22 + i * 0.05, verb: true }))
    },
    unlock() {
      tone({ f: 1800, dur: 0.02, vol: 0.15 })
      tone({ f: 420, to: 210, dur: 0.1, type: 'triangle', vol: 0.25, at: 0.04 })
      tone({ f: 2400, dur: 0.02, vol: 0.12, at: 0.16 })
    },
    door() {
      nz({ dur: 0.5, vol: 0.45, type: 'lowpass', f: 420, attack: 0.03 })
      tone({ f: 62, dur: 0.5, type: 'sawtooth', vol: 0.18, lp: 300, attack: 0.03 })
    },
    gate() {
      nz({ dur: 0.32, vol: 0.4, type: 'lowpass', f: 520, attack: 0.02 })
      tone({ f: 70, dur: 0.3, type: 'sawtooth', vol: 0.16, lp: 300 })
      tone({ f: 120, to: 50, dur: 0.14, type: 'sine', vol: 0.4, at: 0.3 })
    },
    plate() {
      tone({ f: 180, dur: 0.05, vol: 0.2 })
      nz({ dur: 0.03, vol: 0.2, type: 'highpass', f: 3000 })
    },
    crystal() {
      tone({ f: 1760, dur: 0.5, type: 'sine', vol: 0.16, verb: true })
      tone({ f: 2637, dur: 0.4, type: 'sine', vol: 0.1, at: 0.02, verb: true })
      tone({ f: 3520, dur: 0.2, type: 'triangle', vol: 0.06, at: 0.04 })
    },
    push() { nz({ dur: 0.3, vol: 0.38, type: 'lowpass', f: 300, to: 520, attack: 0.03 }) },
    bombPlace() {
      tone({ f: 200, dur: 0.05, type: 'triangle', vol: 0.25 })
      nz({ dur: 0.18, vol: 0.08, type: 'highpass', f: 5000, at: 0.05 })
    },
    boom() {
      nz({ dur: 0.85, vol: 0.9, type: 'lowpass', f: 1400, to: 90 })
      tone({ f: 120, to: 32, dur: 0.55, type: 'sine', vol: 0.8 })
      nz({ dur: 0.12, vol: 0.4, type: 'highpass', f: 2000 })
    },
    disc() {
      const c = ac!
      const at = c.currentTime
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(620, at)
      const lfo = c.createOscillator()
      lfo.frequency.value = 28
      const depth = c.createGain()
      depth.gain.value = 180
      lfo.connect(depth)
      depth.connect(o.frequency)
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1400
      bp.Q.value = 1.5
      const g = c.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.16, at + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32)
      o.connect(bp)
      bp.connect(g)
      g.connect(sfxBus)
      o.start(at)
      lfo.start(at)
      o.stop(at + 0.35)
      lfo.stop(at + 0.35)
    },
    discHit() {
      tone({ f: 1300, to: 900, dur: 0.07, type: 'triangle', vol: 0.2 })
      nz({ dur: 0.04, vol: 0.2, type: 'highpass', f: 3000 })
    },
    fall() { tone({ f: 1200, to: 180, dur: 0.7, type: 'sine', vol: 0.25 }) },
    pellet() { tone({ f: 520, to: 300, dur: 0.07, vol: 0.14 }) },
    laser() {
      tone({ f: 2200, to: 380, dur: 0.22, type: 'sawtooth', vol: 0.18, lp: 5000 })
      tone({ f: 1100, to: 200, dur: 0.22, vol: 0.1 })
    },
    reflect() {
      tone({ f: 2000, dur: 0.15, type: 'triangle', vol: 0.2, verb: true })
      tone({ f: 3000, dur: 0.12, type: 'sine', vol: 0.12, at: 0.02 })
    },
    warp() {
      tone({ f: 300, to: 1200, dur: 0.4, type: 'sine', vol: 0.18, verb: true })
      tone({ f: 303, to: 1212, dur: 0.4, type: 'triangle', vol: 0.1 })
    },
    stairs() {
      ;[72, 69, 65, 62, 57].forEach((m, i) => tone({ f: hz(m), dur: 0.07, type: 'triangle', vol: 0.18, at: i * 0.06 }))
    },
    text() {
      const now = performance.now()
      if (now - lastText < 35) return
      lastText = now
      tone({ f: 1200, dur: 0.02, vol: 0.05 })
    },
    menu() {
      tone({ f: 660, dur: 0.05, vol: 0.12 })
      tone({ f: 990, dur: 0.07, vol: 0.12, at: 0.05 })
    },
    select() {
      tone({ f: 990, dur: 0.04, vol: 0.12 })
      tone({ f: 1320, dur: 0.06, vol: 0.1, at: 0.04 })
    },
    error() {
      tone({ f: 110, dur: 0.18, vol: 0.2 })
      tone({ f: 116, dur: 0.18, vol: 0.16 })
    },
    bossRoar() {
      const c = ac!
      const at = c.currentTime
      const o = c.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(95, at)
      o.frequency.exponentialRampToValueAtTime(50, at + 1)
      const trem = c.createOscillator()
      trem.frequency.value = 11
      const td = c.createGain()
      td.gain.value = 0.15
      const g = c.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.35, at + 0.08)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 1.05)
      trem.connect(td)
      td.connect(g.gain)
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 900
      o.connect(lp)
      lp.connect(g)
      g.connect(sfxBus)
      g.connect(sfxVerb)
      o.start(at)
      trem.start(at)
      o.stop(at + 1.1)
      trem.stop(at + 1.1)
      nz({ dur: 0.9, vol: 0.25, type: 'lowpass', f: 700, attack: 0.08 })
    },
    bossHit() {
      nz({ dur: 0.18, vol: 0.6, type: 'lowpass', f: 1800 })
      tone({ f: 200, to: 55, dur: 0.22, vol: 0.4 })
      tone({ f: 1500, dur: 0.08, type: 'triangle', vol: 0.12 })
    },
    bossDie() {
      for (let i = 0; i < 6; i++) {
        nz({ dur: 0.6, vol: 0.7 - i * 0.07, type: 'lowpass', f: 1300 - i * 120, to: 80, at: i * 0.28 })
        tone({ f: 130 - i * 8, to: 30, dur: 0.45, type: 'sine', vol: 0.55, at: i * 0.28 })
      }
      tone({ f: 900, to: 50, dur: 1.9, type: 'sawtooth', vol: 0.2, lp: 2000 })
    },
    lowHp() {
      tone({ f: 880, dur: 0.07, type: 'sine', vol: 0.1 })
      tone({ f: 880, dur: 0.07, type: 'sine', vol: 0.08, at: 0.14 })
    },

    // ---- the Wildwood and Project Horizon ----
    hook() {
      nz({ dur: 0.28, vol: 0.28, f: 450, to: 2800, q: 1.4 })
      for (let i = 0; i < 7; i++) {
        const at = i * 0.034 + (i % 2) * 0.007
        nz({ dur: 0.022, vol: 0.12, f: 4200 + (i % 3) * 900, q: 6, at })
        tone({ f: 2600 + (i % 3) * 430, dur: 0.03, type: 'triangle', vol: 0.05, at })
      }
    },
    hookHit() {
      tone({ f: 320, to: 170, dur: 0.05, vol: 0.12, lp: 1400 })
      tone({ f: 2150, dur: 0.18, type: 'triangle', vol: 0.16, verb: true })
      tone({ f: 3170, dur: 0.13, type: 'sine', vol: 0.09 })
      tone({ f: 5230, dur: 0.08, type: 'sine', vol: 0.05 })
      nz({ dur: 0.03, vol: 0.2, type: 'highpass', f: 6000 })
    },
    pull() {
      nz({ dur: 0.36, vol: 0.2, f: 700, to: 4200, q: 3 })
      for (let i = 0; i < 10; i++) tone({ f: 260 * Math.pow(1.19, i), dur: 0.028, vol: 0.07, at: i * 0.032, lp: 3500 })
    },
    psi() {
      const c = ac!
      const at = c.currentTime
      // The deep warble: two sines swelling, their pitch wobbling at 7 Hz.
      const g = c.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.32, at + 0.22)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.8)
      const lfo = c.createOscillator()
      lfo.frequency.value = 7
      const depth = c.createGain()
      depth.gain.value = 60
      lfo.connect(depth)
      for (const [f, to] of [[72, 110], [145, 222]] as const) {
        const o = c.createOscillator()
        o.type = f < 100 ? 'sine' : 'triangle'
        o.frequency.setValueAtTime(f, at)
        o.frequency.exponentialRampToValueAtTime(to, at + 0.7)
        depth.connect(o.detune)
        o.connect(g)
        o.start(at)
        o.stop(at + 0.85)
      }
      lfo.start(at)
      lfo.stop(at + 0.85)
      g.connect(sfxBus)
      g.connect(sfxVerb)
      // The shimmer above it.
      ;[2637, 3520, 4186, 5274].forEach((f, i) => tone({ f, dur: 0.55, type: 'sine', vol: 0.04, attack: 0.18, at: 0.08 + i * 0.05, verb: true }))
      nz({ dur: 0.6, vol: 0.05, type: 'highpass', f: 7000, attack: 0.2, at: 0.1 })
    },
    glyph() {
      // Each stone in a run rings the next note of a pentatonic; a pause starts over.
      const now = performance.now()
      if (now - lastGlyph > 2500) glyphI = 0
      lastGlyph = now
      const f = hz([76, 79, 81, 83, 86, 88, 91][glyphI % 7]!)
      glyphI++
      tone({ f, dur: 0.7, type: 'sine', vol: 0.12, verb: true })
      tone({ f: f * 3.01, dur: 0.22, type: 'sine', vol: 0.025 })
      tone({ f: f * 2, dur: 0.4, type: 'sine', vol: 0.04, at: 0.005 })
    },
    lever() {
      nz({ dur: 0.14, vol: 0.5, type: 'lowpass', f: 650 })
      tone({ f: 95, to: 50, dur: 0.16, type: 'sine', vol: 0.45 })
      tone({ f: 160, dur: 0.05, vol: 0.14, lp: 1200, at: 0.02 })
      // The breaker takes hold: mains hum rising, a few sparks.
      tone({ f: 50, to: 120, dur: 1, type: 'sawtooth', vol: 0.13, attack: 0.35, at: 0.12, lp: 900 })
      tone({ f: 100, to: 240, dur: 0.95, type: 'square', vol: 0.05, attack: 0.35, at: 0.14, lp: 1400 })
      ;[0.55, 0.68, 0.74, 0.9].forEach(at => nz({ dur: 0.025, vol: 0.14, type: 'highpass', f: 5000, at }))
    },
    land() {
      tone({ f: 140, to: 45, dur: 0.22, type: 'sine', vol: 0.5 })
      nz({ dur: 0.16, vol: 0.35, type: 'lowpass', f: 420 })
      tone({ f: 220, to: 110, dur: 0.06, type: 'triangle', vol: 0.12 })
      nz({ dur: 0.12, vol: 0.07, f: 1800, q: 1, at: 0.03 })
    },
    beam() {
      tone({ f: 1760, to: 2640, dur: 0.09, type: 'triangle', vol: 0.12 })
      tone({ f: 2400, to: 1200, dur: 0.2, type: 'square', vol: 0.08, lp: 6000 })
      tone({ f: 3520, dur: 0.24, type: 'sine', vol: 0.08, at: 0.02, verb: true })
      nz({ dur: 0.12, vol: 0.12, type: 'highpass', f: 5500 })
    },
    gust() {
      nz({ dur: 0.75, vol: 0.42, f: 350, to: 1400, q: 0.8, attack: 0.12 })
      nz({ dur: 0.6, vol: 0.2, f: 2400, to: 900, q: 2, at: 0.1, attack: 0.1 })
      tone({ f: 900, to: 1300, dur: 0.6, type: 'sine', vol: 0.03, attack: 0.2, at: 0.05 })
    },
    bark() {
      const c = ac!
      if (!grit) {
        grit = c.createWaveShaper()
        const curve = new Float32Array(1024)
        for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh(((i / 511.5) - 1) * 7)
        grit.curve = curve
        const bp = c.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1100
        bp.Q.value = 0.9
        const out = c.createGain()
        out.gain.value = 0.5
        grit.connect(bp)
        bp.connect(out)
        out.connect(sfxBus)
      }
      const shaper = grit
      // Two barks, the second lower, each a pitch-dropping saw pair driven into the shaper.
      ;[[0, 400], [0.17, 330]].forEach(([dt, f]) => {
        const at = c.currentTime + dt!
        const g = c.createGain()
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(0.5, at + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13)
        for (const [ff, type] of [[f!, 'sawtooth'], [f! / 2 + 7, 'square']] as const) {
          const o = c.createOscillator()
          o.type = type
          o.frequency.setValueAtTime(ff, at)
          o.frequency.exponentialRampToValueAtTime(ff * 0.45, at + 0.12)
          o.connect(g)
          o.start(at)
          o.stop(at + 0.15)
        }
        g.connect(shaper)
        nz({ dur: 0.1, vol: 0.2, f: 1600, q: 1.5, at: dt })
      })
      // The static in its throat.
      for (let i = 0; i < 5; i++) nz({ dur: 0.02, vol: 0.1, type: 'highpass', f: 4500, at: 0.02 + i * 0.07 })
    },
  }

  function playJingle(j: JingleDef): number {
    const c = ac!
    const beat = 60 / j.bpm
    const t0 = c.currentTime + 0.03
    let end = 0
    for (const [b, m, len, v] of j.notes) {
      const at = t0 + b * beat
      const dur = len * beat
      end = Math.max(end, b * beat + dur)
      const g = c.createGain()
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      const stop = at + dur + 0.6
      if (v === 'lead') {
        osc('square', hz(m), at, stop).connect(lp)
        osc('square', hz(m), at, stop, -8).connect(lp)
        lp.frequency.value = 3600
        env(g, at, 0.13, 0.006, dur * 0.95, 0.15)
      } else if (v === 'harm') {
        osc('triangle', hz(m), at, stop).connect(lp)
        lp.frequency.value = 4000
        env(g, at, 0.12, 0.006, dur * 0.95, 0.15)
      } else if (v === 'bell') {
        osc('sine', hz(m), at, stop).connect(lp)
        osc('sine', hz(m) * 3.01, at, stop).connect(lp)
        lp.frequency.value = 9000
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(0.12, at + 0.004)
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.4)
      } else if (v === 'pad') {
        osc('sawtooth', hz(m), at, stop, 9).connect(lp)
        osc('sawtooth', hz(m), at, stop, -9).connect(lp)
        lp.frequency.value = 1400
        env(g, at, 0.05, 0.08, dur, 0.4)
      } else {
        osc('sawtooth', hz(m), at, stop).connect(lp)
        lp.frequency.value = 700
        env(g, at, 0.2, 0.005, dur * 0.95, 0.1)
      }
      lp.connect(g)
      g.connect(sfxBus)
      g.connect(sfxVerb)
    }
    return end + 0.3
  }

  // ---- public ---------------------------------------------------------------

  return {
    unlock() {
      ensure()
    },

    music(track) {
      if (!ac) return
      if (track === null) {
        if (current) { fadeOut(current, 0.6); current = null }
        unparkRadio()
        return
      }
      if (current && current.id === track) return
      if (current) fadeOut(current, 0.4)
      const def = TRACKS[track]
      if (!def) return
      delay.delayTime.setTargetAtTime((60 / def.bpm) * 0.75, ac.currentTime, 0.05)
      current = makePlayer(track)
      parkRadio()
      ensureTimer()
    },

    sfx(name) {
      if (!ac || muted) return
      try { SFX[name]() } catch { /* context closed */ }
    },

    jingle(name) {
      if (!ac || muted) return
      const j = JINGLES[name]
      if (!j) return
      try {
        const len = playJingle(j)
        const t = ac.currentTime
        musicBus.gain.cancelScheduledValues(t)
        musicBus.gain.setValueAtTime(musicBus.gain.value, t)
        musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL * 0.15, t + 0.06)
        duckUntil = Math.max(duckUntil, t + len)
        ensureTimer()
      } catch { /* ignore */ }
    },

    pause(on) {
      if (!ac) return
      if (on) ac.suspend().catch(() => {})
      else ac.resume().catch(() => {})
    },

    setMuted(m) {
      muted = m
      if (!ac) return
      master.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, ac.currentTime, 0.02)
    },

    holdRadio() {
      parkRadio()
    },

    dispose() {
      if (timer) { clearInterval(timer); timer = null }
      current = null
      fading.length = 0
      unparkRadio()
      if (ac) ac.close().catch(() => {})
      ac = null
      grit = null
    },
  }
}
