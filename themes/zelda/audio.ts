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
 * - Two flavours of all of it (`setFlavor`). '8-bit' is the above. '16-bit'
 *   plays the same notes on another chip, for the isometric view: wavetable
 *   "samples" (flute, pan pipes, reed, strings, choir, fretless and slap
 *   bass, harp), FM brass, keys and bells, a drum kit rendered at 32 kHz, a
 *   soft top, and a stereo echo with a lowpass in its loop. A change of
 *   flavour crossfades the playing track; the song goes on where it was.
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
  /** Which sound chip plays: '8-bit' (the default) or '16-bit'. The songs are the same; a playing track crossfades, it does not start over. */
  setFlavor(flavor: AudioFlavor): void
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

  // The beach: slow Balearic chill-out at 92 bpm (the sand's sway, render/exits.ts
  // BEACH_BEAT). Swelling major sevenths, a round bass, glassy arps, a hollow
  // flute that takes its time, and tape wow like an old cassette.
  beach: {
    bpm: 92, swing: 0.18, lead: 'hollow', bass: 'round', reverb: 0.5, delay: 0.45,
    arpVoice: 'glass', padSwell: true, wow: 6, level: 0.9,
    form: ['I', 'A', 'B'], loopFrom: 1,
    sections: {
      I: {
        chords: 'Fmaj7 Em7 Fmaj7 Em7',
        bass: 'R-------5-----.-',
        drums: { k: 'x.........x.....', s: '................', h: '....x.......x...' },
        arp: 'up', arpRate: 8, pad: true,
      },
      A: {
        chords: 'Fmaj7 Em7 Dm7 Cmaj7 Fmaj7 Em7 Dm7 E7',
        lead: [
          'A5 - - - G5 - E5 -', 'G5 - - - - - . .', 'F5 - - - E5 - C5 -', 'E5 - - - - - . .',
          'A5 - - - C6 - B5 -', 'G5 - - - E5 - . .', 'F5 - E5 - D5 - C5 -', 'B4 - - - G#4 - - -',
        ],
        bass: 'R-----R-5---O---',
        drums: { k: 'x.....x...x.....', s: '....g.......x...', h: '..x...x...x...x.' },
        arp: 'updown', arpRate: 8, pad: true,
      },
      B: {
        chords: 'Dm7 Em7 Fmaj7 G Dm7 Em7 Am7 Am7',
        lead: [
          'F5 - - - A5 - - -', 'G5 - - - E5 - - -', 'A5 - - - C6 - - -', 'B5 - - - D6 - - -',
          'C6 - - - A5 - F5 -', 'G5 - - - B5 - G5 -', 'E5 - - - - - . .', '. . . . . . . .',
        ],
        counter: [
          'A4 - - - - - - -', 'B4 - - - - - - -', 'C5 - - - - - - -', 'D5 - - - - - - -',
          'A4 - - - - - - -', 'G4 - - - - - - -', 'C5 - - - - - - -', 'E5 - - - - - - -',
        ],
        bass: 'R-----R-5---O---',
        drums: { k: 'x.....x...x.....', s: '....g.......x...', h: '..x...x...x...x.' },
        fill: { k: 'x.....x.........', s: '....g.....g.g.g.', h: '..x...x.........' },
        arp: 'up', arpRate: 8, pad: true,
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
// The 16-bit flavour (pure data): the same songs through another sound chip
// ---------------------------------------------------------------------------
//
// The isometric view is the next machine, and the next machine had a sample
// chip with an echo unit (the SNES's SPC700). Nothing in a song changes: the
// same notes, tempo and form go to other instruments. Wavetables stand in for
// the chip's looped samples, small FM pairs for brass, keys and bells, the
// drum kit is rendered once at the chip's 32 kHz and played back as samples,
// and everything passes a soft top (the chip's gaussian interpolation) and a
// stereo echo with a lowpass in its loop.

export type AudioFlavor = '8-bit' | '16-bit'

/** The flavour a view plays in: the isometric engine brings the 16-bit chip, unless its values say `sound: '8-bit'`. */
export function flavorForView(engine: string, params?: Record<string, unknown> | null): AudioFlavor {
  return engine === 'iso' && params?.sound !== '8-bit' ? '16-bit' : '8-bit'
}

const partials = (n: number, amp: (k: number) => number): number[] => Array.from({ length: n }, (_, i) => amp(i + 1))

export type SpcWave = 'flute' | 'pan' | 'reed' | 'strings' | 'choir' | 'fretless' | 'slap' | 'harp' | 'softSquare' | 'softSaw'

/** One cycle of each "sample", as harmonic amplitudes from the fundamental up. Few partials: the chip's samples were short and dull on top. */
export const SPC_WAVES: Record<SpcWave, readonly number[]> = {
  // A flute is nearly a sine with a little octave in it.
  flute: [1, 0.42, 0.14, 0.07, 0.03, 0.015],
  // Pan pipes are stopped tubes: the odd harmonics carry the tone.
  pan: [1, 0.16, 0.34, 0.05, 0.11, 0.02, 0.04],
  // An oboe-ish reed: nasal, odd-heavy, a bump around the fifth harmonic.
  reed: [1, 0.2, 0.5, 0.1, 0.2, 0.04, 0.08, 0.02],
  strings: partials(20, k => 1 / Math.pow(k, 1.15)),
  // The choir's vowel comes from formant filters; this is only the throat.
  choir: partials(14, k => 1 / Math.pow(k, 1.4)),
  fretless: [1, 0.35, 0.14, 0.07, 0.03],
  slap: partials(14, k => 1 / Math.pow(k, 0.9)),
  harp: partials(12, k => (k % 2 ? 1 : 0.7) / Math.pow(k, 1.3)),
  // What a square and a saw are after the chip's interpolation (the SFX use them).
  softSquare: partials(15, k => (k % 2 ? 1 / Math.pow(k, 1.5) : 0)),
  softSaw: partials(16, k => 1 / Math.pow(k, 1.4)),
}

export type SpcLead = 'flute' | 'pan' | 'brass' | 'reed' | 'keys' | 'chime'
export type SpcBass = 'fretless' | 'slap'
export type SpcArp = 'harp' | 'glass' | 'mallet'
export type SpcPad = 'strings' | 'choir'
export type SpcDrum = 'kick' | 'snare' | 'hat' | 'openHat' | 'tom'

export interface SpcPatch {
  lead: SpcLead
  bass: SpcBass
  arp: SpcArp
  pad: SpcPad
  /** Send into the echo, and how much of each repeat comes round again. */
  echo: number
  feedback: number
  /** Send into the room. */
  room: number
  /** Level against the 8-bit mix of the same track (1 = as loud; set from scripts/zelda-lab/audio-render.mjs). */
  level: number
  /** This track's bass and lead against the instrument's own gain (default 1), where a song wants one of them further back. */
  bassLevel?: number
  leadLevel?: number
}

/** Who plays each track on the 16-bit chip. */
export const SPC_PATCHES: Record<TrackId, SpcPatch> = {
  // A lone flute over strings and a harp.
  title: { lead: 'flute', bass: 'fretless', arp: 'harp', pad: 'strings', echo: 0.5, feedback: 0.5, room: 0.35, level: 1 },
  // The hero's tune goes to the brass, the bass gets a thumb.
  overworld: { lead: 'brass', bass: 'slap', arp: 'harp', pad: 'strings', echo: 0.32, feedback: 0.42, room: 0.2, level: 1 },
  village: { lead: 'keys', bass: 'fretless', arp: 'harp', pad: 'strings', echo: 0.3, feedback: 0.4, room: 0.25, level: 1, bassLevel: 0.85 },
  beach: { lead: 'pan', bass: 'fretless', arp: 'glass', pad: 'strings', echo: 0.5, feedback: 0.55, room: 0.4, level: 1.06 },
  // The shrine sings: a reed under a choir, the echo long.
  dungeon: { lead: 'reed', bass: 'fretless', arp: 'harp', pad: 'choir', echo: 0.55, feedback: 0.6, room: 0.45, level: 1, bassLevel: 0.75, leadLevel: 0.6 },
  boss: { lead: 'brass', bass: 'slap', arp: 'harp', pad: 'strings', echo: 0.25, feedback: 0.35, room: 0.15, level: 1, leadLevel: 0.7 },
  indoor: { lead: 'keys', bass: 'fretless', arp: 'harp', pad: 'strings', echo: 0.32, feedback: 0.4, room: 0.3, level: 1 },
  ending: { lead: 'brass', bass: 'slap', arp: 'harp', pad: 'strings', echo: 0.4, feedback: 0.45, room: 0.3, level: 1.05 },
  forest: { lead: 'flute', bass: 'fretless', arp: 'harp', pad: 'strings', echo: 0.45, feedback: 0.5, room: 0.35, level: 1, leadLevel: 1.25 },
  // The lab's sequencer becomes a mallet line, its cold lead a reed.
  lab: { lead: 'reed', bass: 'slap', arp: 'mallet', pad: 'strings', echo: 0.4, feedback: 0.5, room: 0.25, level: 1.12, leadLevel: 0.8 },
  static: { lead: 'chime', bass: 'fretless', arp: 'glass', pad: 'choir', echo: 0.6, feedback: 0.62, room: 0.5, level: 1.1 },
}

/** Who plays a jingle's lead line on the 16-bit chip. */
export const SPC_JINGLE_LEAD: Record<JingleName, SpcLead> = {
  item: 'brass', secret: 'chime', fanfare: 'brass', heartPiece: 'chime', gameOver: 'reed', friend: 'flute',
}

/** Peak gain per 16-bit instrument. A lead's is times the note's own volume; the rest are absolute. */
export const SPC_GAIN = {
  lead: { flute: 0.95, pan: 1.15, brass: 0.75, reed: 0.7, keys: 1.5, chime: 1.3 } as Record<SpcLead, number>,
  bass: { fretless: 0.56, slap: 0.6 } as Record<SpcBass, number>,
  arp: { harp: 0.13, glass: 0.07, mallet: 0.26 } as Record<SpcArp, number>,
  pad: { strings: 0.05, choir: 0.09 } as Record<SpcPad, number>,
  counter: 0.09,
  drums: { kick: 0.55, snare: 0.5, hat: 0.2, openHat: 0.18, tom: 0.55 } as Record<SpcDrum, number>,
}

/** The chip's sample rate: the drum kit is rendered at it and the browser plays it back resampled. */
export const SPC_RATE = 32000

/** The echo's delay for a tempo: a dotted sixteenth on the chip's 16 ms grid, inside what its echo buffer held (64 to 240 ms). */
export function spcEchoTime(bpm: number): number {
  const want = (60 / bpm / 4) * 1.5
  return Math.max(4, Math.min(15, Math.round(want / 0.016))) * 0.016
}

const SPC_DRUM_SECONDS: Record<SpcDrum, number> = { kick: 0.26, snare: 0.3, hat: 0.07, openHat: 0.34, tom: 0.36 }

/**
 * One drum of the 16-bit kit as a mono sample, peak 0.9, ending on silence.
 * The same every time (its noise is seeded), so the kit is data, not chance.
 */
export function renderSpcDrum(name: SpcDrum, rate = SPC_RATE): Float32Array {
  const n = Math.max(8, Math.floor(rate * SPC_DRUM_SECONDS[name]))
  const out = new Float32Array(n)
  let seed = 0x2f6e2b1 + name.length * 7919
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2147483648 - 1 }
  const TAU = Math.PI * 2
  // One-pole lowpass states; a highpass is the input minus its lowpass.
  let lpA = 0
  let lpB = 0
  let ph = 0
  let ph2 = 0
  const pole = (hzCut: number) => 1 - Math.exp(-TAU * hzCut / rate)
  // The six squares of a drum machine's cymbal, pushed up into the hat's range.
  const metal = [205.3, 304.4, 369.6, 522.7, 540, 800].map(f => f * 11.5)
  for (let i = 0; i < n; i++) {
    const t = i / rate
    let v = 0
    if (name === 'kick') {
      // The beater's click, then a body that falls from 150 Hz to under 50.
      ph += TAU * (46 + 108 * Math.exp(-t / 0.032)) / rate
      lpA += pole(2600) * (rnd() - lpA)
      v = Math.tanh(1.5 * (Math.sin(ph) * Math.exp(-t / 0.05) + lpA * 0.5 * Math.exp(-t / 0.004)))
    } else if (name === 'snare') {
      // A shell (two detuned modes) under the wires (noise with the bottom taken out).
      ph += TAU * (176 + 70 * Math.exp(-t / 0.018)) / rate
      ph2 += TAU * 331 / rate
      const x = rnd()
      lpA += pole(900) * (x - lpA)
      lpB += pole(7200) * (x - lpA - lpB)
      const wires = lpB * (0.75 * Math.exp(-t / 0.07) + 0.4 * Math.exp(-t / 0.014))
      v = Math.sin(ph) * 0.62 * Math.exp(-t / 0.05) + Math.sin(ph2) * 0.22 * Math.exp(-t / 0.03) + wires * 1.5
    } else if (name === 'tom') {
      ph += TAU * (112 + 74 * Math.exp(-t / 0.045)) / rate
      lpA += pole(1800) * (rnd() - lpA)
      v = Math.sin(ph) * Math.exp(-t / 0.11) + lpA * 0.4 * Math.exp(-t / 0.008)
    } else {
      let m = 0
      for (const f of metal) m += Math.sin(TAU * f * t) >= 0 ? 1 : -1
      const x = m / 6 * 0.65 + rnd() * 0.45
      lpA += pole(6500) * (x - lpA)
      const hp = x - lpA
      lpB += pole(5000) * (hp - lpB)
      v = (hp - lpB) * (name === 'hat' ? Math.exp(-t / 0.011) : 0.8 * Math.exp(-t / 0.085) + 0.2 * Math.exp(-t / 0.012))
    }
    out[i] = v
  }
  // End on silence, and bring the peak to 0.9.
  const fade = Math.min(n, Math.floor(rate * 0.004))
  for (let i = 0; i < fade; i++) out[n - 1 - i] = out[n - 1 - i]! * (i / fade)
  let peak = 0
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]!))
  if (peak > 0) for (let i = 0; i < n; i++) out[i] = out[i]! * (0.9 / peak)
  return out
}

/** What is wrong with the 16-bit tables (empty = fine). Pure; used by tests. */
export function validateSpc(): string[] {
  const out: string[] = []
  const sane = (what: string, v: number, max: number) => { if (!Number.isFinite(v) || v <= 0 || v > max) out.push(`${what}: ${v}`) }
  for (const [name, amps] of Object.entries(SPC_WAVES)) {
    if (amps.length < 2 || amps.length > 32) out.push(`wave ${name}: ${amps.length} partials`)
    if (amps[0] !== 1) out.push(`wave ${name}: fundamental ${amps[0]}`)
    for (const a of amps) if (!Number.isFinite(a) || a < 0 || a > 1) out.push(`wave ${name}: partial ${a}`)
  }
  for (const id of Object.keys(TRACKS) as TrackId[]) {
    const p = SPC_PATCHES[id]
    if (!p) { out.push(`${id}: no 16-bit patch`); continue }
    if (!(p.lead in SPC_GAIN.lead)) out.push(`${id}: lead ${p.lead}`)
    if (!(p.bass in SPC_GAIN.bass)) out.push(`${id}: bass ${p.bass}`)
    if (!(p.arp in SPC_GAIN.arp)) out.push(`${id}: arp ${p.arp}`)
    if (!(p.pad in SPC_GAIN.pad)) out.push(`${id}: pad ${p.pad}`)
    sane(`${id}: echo`, p.echo, 0.8)
    // The echo must die away: each repeat quieter than the last.
    sane(`${id}: feedback`, p.feedback, 0.7)
    sane(`${id}: room`, p.room, 0.8)
    sane(`${id}: level`, p.level, 2)
    sane(`${id}: bassLevel`, p.bassLevel ?? 1, 2)
    sane(`${id}: leadLevel`, p.leadLevel ?? 1, 2)
  }
  for (const id of Object.keys(SPC_PATCHES)) if (!(id in TRACKS)) out.push(`patch for no track: ${id}`)
  for (const id of Object.keys(JINGLES) as JingleName[]) {
    if (!(SPC_JINGLE_LEAD[id] in SPC_GAIN.lead)) out.push(`jingle ${id}: no 16-bit lead`)
  }
  for (const [kind, table] of Object.entries(SPC_GAIN)) {
    if (typeof table === 'number') sane(`gain ${kind}`, table, 2)
    else for (const [name, g] of Object.entries(table)) sane(`gain ${kind}.${name}`, g, 2)
  }
  for (const name of Object.keys(SPC_GAIN.drums) as SpcDrum[]) {
    const d = renderSpcDrum(name)
    let peak = 0
    for (const v of d) { if (!Number.isFinite(v)) { out.push(`drum ${name}: not a number`); break } peak = Math.max(peak, Math.abs(v)) }
    if (peak < 0.5 || peak > 0.95) out.push(`drum ${name}: peak ${peak}`)
    if (Math.abs(d[d.length - 1]!) > 0.001) out.push(`drum ${name}: does not end on silence`)
  }
  return out
}

// ---------------------------------------------------------------------------
// Live engine
// ---------------------------------------------------------------------------

/** A player's sends on the 16-bit chip: straight out, into the echo, into the room. */
interface SpcOut { dry: AudioNode; echo: AudioNode; room: AudioNode }
interface SpcBuses { dry: GainNode; echo: GainNode; room: GainNode }

/** Something a player has scheduled: kept until it has sounded, so a change of flavour can voice it again on the other chip. */
interface Held {
  at: number
  dur: number
  play: (at: number, dur: number) => void
  /** The chips it has been voiced on. */
  chip: boolean
  spc: boolean
}

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
  /** The 16-bit sends; made the first time this player sounds in that flavour. */
  spc: SpcBuses | null
  held: Held[]
  alive: boolean
}

const MUSIC_LEVEL = 0.3
const SFX_LEVEL = 1
const MASTER_LEVEL = 0.85

function readMuted(): boolean {
  try { return typeof window !== 'undefined' && localStorage.getItem(SOUND_MUTE_KEY) === '1' } catch { return false }
}

export function createZeldaAudio(): ZeldaAudio {
  return buildAudio(null)
}

/**
 * The lab's seam (scripts/zelda-lab/audio-render.mjs): the same engine on a
 * context someone else owns and clocks, an OfflineAudioContext there. It
 * starts no timer and leaves the radio alone; `tick()` schedules the next
 * 150 ms of music from the context's clock.
 */
export function createZeldaAudioOn(context: BaseAudioContext): ZeldaAudio & { tick(): void } {
  return buildAudio(context)
}

function buildAudio(host: BaseAudioContext | null): ZeldaAudio & { tick(): void } {
  let ac: BaseAudioContext | null = null
  /** The context when it is our own: only that one is suspended, resumed and closed. */
  let live: AudioContext | null = null
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
  let flavor: AudioFlavor = '8-bit'
  let spc: Spc | null = null

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
      if (live && live.state === 'suspended') live.resume().catch(() => {})
      return true
    }
    if (host) ac = host
    else {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return false
      try { ac = live = new Ctor() } catch { ac = live = null; return false }
    }
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

    if (live && live.state === 'suspended') live.resume().catch(() => {})
    return true
  }

  // ---- radio --------------------------------------------------------------

  function parkRadio(): void {
    if (radioParked || host) return
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

  // ---- the 16-bit chip --------------------------------------------------------

  /** The 16-bit chip's shared nodes; built the first time that flavour sounds. */
  interface Spc {
    /** Where its music goes in: the chip's voice (soft top, a little warmth), then the music bus. */
    in: GainNode
    echo: Echo
    room: ConvolverNode
    /** The same three sends for SFX and jingles. */
    sfx: SpcOut
    kit: Record<SpcDrum, AudioBuffer>
    waves: Partial<Record<SpcWave, PeriodicWave | null>>
  }

  interface Echo { in: GainNode; set(time: number, feedback: number): void }

  /** Left or right of the middle (-1..1); a plain gain where the browser has no panner. */
  function panner(v: number): AudioNode {
    const c = ac!
    if (typeof c.createStereoPanner !== 'function') return c.createGain()
    const p = c.createStereoPanner()
    p.pan.value = v
    return p
  }

  function biquad(type: BiquadFilterType, freq: number, q = 0.7, gain = 0): BiquadFilterNode {
    const f = ac!.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    if (gain) f.gain.value = gain
    return f
  }

  /** The chip's echo: one repeat left, the next right, each duller than the last (a lowpass sits in the loop). */
  function makeEcho(out: AudioNode, time: number, feedback: number, tone: number): Echo {
    const c = ac!
    const input = c.createGain()
    // The send is summed to mono, so the repeats land hard left and hard right whatever came in.
    input.channelCount = 1
    input.channelCountMode = 'explicit'
    const dl = c.createDelay(1)
    const dr = c.createDelay(1)
    const fl = biquad('lowpass', tone)
    const fr = biquad('lowpass', tone)
    const backL = c.createGain()
    const backR = c.createGain()
    const pl = panner(-0.8)
    const pr = panner(0.8)
    input.connect(dl)
    dl.connect(fl)
    fl.connect(pl)
    fl.connect(backL)
    backL.connect(dr)
    dr.connect(fr)
    fr.connect(pr)
    fr.connect(backR)
    backR.connect(dl)
    pl.connect(out)
    pr.connect(out)
    const set = (t: number, fb: number) => {
      const now = c.currentTime
      dl.delayTime.setTargetAtTime(t, now, 0.05)
      dr.delayTime.setTargetAtTime(t, now, 0.05)
      backL.gain.setTargetAtTime(fb, now, 0.05)
      backR.gain.setTargetAtTime(fb, now, 0.05)
    }
    dl.delayTime.value = time
    dr.delayTime.value = time
    backL.gain.value = feedback
    backR.gain.value = feedback
    return { in: input, set }
  }

  function ensure16(): Spc {
    if (spc) return spc
    const c = ac!
    // The chip's voice: its interpolation rolled the top off, and the samples were warm below.
    const voice = (dest: AudioNode, top: number): GainNode => {
      const input = c.createGain()
      const shelf = biquad('highshelf', 5500, 0.7, -3.5)
      const lp = biquad('lowpass', top, 0.6)
      const warm = biquad('lowshelf', 170, 0.7, 1.5)
      input.connect(shelf)
      shelf.connect(lp)
      lp.connect(warm)
      warm.connect(dest)
      return input
    }
    const input = voice(musicBus, 12500)
    const echo = makeEcho(input, 0.176, 0.45, 3800)
    // The big room: a dark, even tail under the echo.
    const room = c.createConvolver()
    room.buffer = impulse(1.7, t => Math.pow(1 - t, 2.4) * 0.5)
    const roomTone = biquad('lowpass', 4200)
    room.connect(roomTone)
    roomTone.connect(input)

    const sfxIn = voice(sfxBus, 11000)
    // The echo and the warmth add a little; this keeps an effect as loud as its 8-bit self.
    sfxIn.gain.value = 0.9
    const sfxEcho = makeEcho(sfxIn, 0.112, 0.3, 3200)
    const sfxSend = c.createGain()
    sfxSend.gain.value = 0.22
    sfxSend.connect(sfxEcho.in)

    const kit = {} as Record<SpcDrum, AudioBuffer>
    for (const name of Object.keys(SPC_GAIN.drums) as SpcDrum[]) {
      let buf: AudioBuffer
      let data = renderSpcDrum(name)
      try {
        buf = c.createBuffer(1, data.length, SPC_RATE)
      } catch {
        // A browser that will not hold a 32 kHz buffer gets the kit at its own rate.
        data = renderSpcDrum(name, c.sampleRate)
        buf = c.createBuffer(1, data.length, c.sampleRate)
      }
      buf.getChannelData(0).set(data)
      kit[name] = buf
    }
    spc = { in: input, echo, room, sfx: { dry: sfxIn, echo: sfxSend, room: sfxVerb }, kit, waves: {} }
    return spc
  }

  /** One of the chip's "samples" as a wavetable; null where the browser will not make one. */
  function table(name: SpcWave): PeriodicWave | null {
    const s = ensure16()
    let w = s.waves[name]
    if (w === undefined) {
      const amps = SPC_WAVES[name]
      const real = new Float32Array(amps.length + 1)
      const imag = new Float32Array(amps.length + 1)
      amps.forEach((a, i) => { imag[i + 1] = a })
      try { w = ac!.createPeriodicWave(real, imag) } catch { w = null }
      s.waves[name] = w
    }
    return w
  }

  /** A wavetable oscillator: one of the chip's "samples" at a pitch. */
  function wave(name: SpcWave, freq: number, at: number, stop: number, detune = 0): OscillatorNode {
    const c = ac!
    const w = table(name)
    const o = c.createOscillator()
    if (w) o.setPeriodicWave(w)
    else o.type = 'triangle'
    o.frequency.setValueAtTime(freq, at)
    if (detune) o.detune.setValueAtTime(detune, at)
    o.start(at)
    o.stop(stop)
    return o
  }

  /** Send a voice out: dry, and as much of it into the echo and the room as asked (0 = none, 1 = all). */
  function send16(src: AudioNode, o: SpcOut, echo: number, room: number): void {
    const c = ac!
    src.connect(o.dry)
    for (const [dest, amount] of [[o.echo, echo], [o.room, room]] as const) {
      if (amount >= 1) src.connect(dest)
      else if (amount > 0) {
        const g = c.createGain()
        g.gain.value = amount
        src.connect(g)
        g.connect(dest)
      }
    }
  }

  /** A struck or plucked envelope: up fast, down to `sustain` of the peak over `decay`, held to the note's end, released. */
  function struck(g: GainNode, at: number, peak: number, attack: number, sustain: number, decay: number, dur: number, release: number): void {
    const hold = Math.max(attack + 0.005, dur)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak, at + attack)
    if (hold > attack + decay) {
      g.gain.exponentialRampToValueAtTime(peak * sustain, at + attack + decay)
      g.gain.setValueAtTime(peak * sustain, at + hold)
    } else {
      // A short note leaves in the middle of its decay.
      g.gain.exponentialRampToValueAtTime(peak * Math.pow(sustain, (hold - attack) / decay), at + hold)
    }
    g.gain.exponentialRampToValueAtTime(0.0001, at + hold + release)
  }

  /** Vibrato that waits: nothing for a moment, then `cents` either way. */
  function vibrato(oscs: OscillatorNode[], at: number, end: number, cents: number, rate = 5.2, wait = 0.2): void {
    const c = ac!
    const lfo = osc('sine', rate, at, end)
    const depth = c.createGain()
    depth.gain.setValueAtTime(0, at)
    depth.gain.linearRampToValueAtTime(0, at + wait)
    depth.gain.linearRampToValueAtTime(cents, at + wait + 0.3)
    lfo.connect(depth)
    for (const o of oscs) depth.connect(o.detune)
  }

  /** An FM pair at 1:1 leaves a standing offset that thumps with the envelope: take it out below the note. */
  function fmOut(car: OscillatorNode, f: number): AudioNode {
    const hp = biquad('highpass', Math.max(40, f * 0.5))
    car.connect(hp)
    return hp
  }

  function lead16(o: SpcOut, inst: SpcLead, midi: number, at: number, dur: number, vol: number, wow?: number): void {
    const c = ac!
    const f = hz(midi)
    const peak = vol * SPC_GAIN.lead[inst]
    const end = at + dur + 0.35
    const g = c.createGain()
    const lp = biquad('lowpass', 6000)
    const mix = c.createGain()
    /** What carries the pitch (vibrato and tape wow bend these). */
    const tuned: OscillatorNode[] = []
    if (inst === 'flute' || inst === 'pan') {
      const pipes = inst === 'pan'
      const o1 = wave(inst, f, at, end)
      // The lip finds the note from just below.
      o1.detune.setValueAtTime(pipes ? -42 : -16, at)
      o1.detune.linearRampToValueAtTime(0, at + (pipes ? 0.07 : 0.045))
      o1.connect(lp)
      tuned.push(o1)
      lp.frequency.setValueAtTime(Math.min(7000, f * 2.5), at)
      lp.frequency.linearRampToValueAtTime(Math.min(9000, f * 5), at + Math.min(0.12, dur))
      env(g, at, peak, Math.min(pipes ? 0.028 : 0.045, dur * 0.4), dur, 0.16)
      // Breath: a chiff of air on the attack, a thread of it under the note.
      const air = noiseSrc(at, dur + 0.2)
      air.loop = true
      const band = biquad('bandpass', Math.max(1400, Math.min(5200, f * 2.2)), 1.1)
      const ag = c.createGain()
      const breath = peak * (pipes ? 0.9 : 0.55)
      const hold = Math.max(0.11, dur)
      ag.gain.setValueAtTime(0, at)
      ag.gain.linearRampToValueAtTime(breath, at + 0.012)
      ag.gain.exponentialRampToValueAtTime(breath * 0.16, at + 0.1)
      ag.gain.setValueAtTime(breath * 0.16, at + hold)
      ag.gain.exponentialRampToValueAtTime(0.0001, at + hold + 0.12)
      air.connect(band)
      band.connect(ag)
      ag.connect(mix)
    } else if (inst === 'brass') {
      // An FM pair: the modulator opens with the breath and settles, a lip buzzing into a horn. A soft saw beside it is the section.
      const car = osc('sine', f, at, end)
      const mod = osc('sine', f, at, end)
      const index = c.createGain()
      index.gain.setValueAtTime(f * 0.3, at)
      index.gain.linearRampToValueAtTime(f * 2, at + 0.05)
      index.gain.exponentialRampToValueAtTime(f * 1.1, at + 0.3)
      mod.connect(index)
      index.connect(car.frequency)
      const body = wave('softSaw', f, at, end, -7)
      const bg = c.createGain()
      bg.gain.value = 0.4
      body.connect(bg)
      bg.connect(lp)
      fmOut(car, f).connect(lp)
      tuned.push(car, mod, body)
      lp.frequency.setValueAtTime(1400, at)
      lp.frequency.linearRampToValueAtTime(3000, at + 0.06)
      lp.frequency.exponentialRampToValueAtTime(2000, at + Math.max(0.1, dur))
      env(g, at, peak, Math.min(0.03, dur * 0.4), dur, 0.11)
    } else if (inst === 'reed') {
      const o1 = wave('reed', f, at, end)
      o1.connect(lp)
      tuned.push(o1)
      lp.frequency.setValueAtTime(Math.min(3200, f * 4), at)
      env(g, at, peak, Math.min(0.022, dur * 0.4), dur, 0.12)
    } else if (inst === 'keys') {
      // An electric piano: an FM pair whose bite dies away, and the tine's ping on top.
      const car = osc('sine', f, at, end)
      const mod = osc('sine', f, at, end)
      const index = c.createGain()
      index.gain.setValueAtTime(f * 1.8, at)
      index.gain.exponentialRampToValueAtTime(f * 0.3, at + 0.4)
      mod.connect(index)
      index.connect(car.frequency)
      fmOut(car, f).connect(lp)
      const tine = osc('sine', f * 4, at, at + 0.2)
      const tg = c.createGain()
      tg.gain.setValueAtTime(0.22, at)
      tg.gain.exponentialRampToValueAtTime(0.0001, at + 0.14)
      tine.connect(tg)
      tg.connect(lp)
      tuned.push(car, mod)
      struck(g, at, peak, 0.006, 0.38, 0.3, dur, 0.22)
    } else {
      // A chime: an FM pair at a ratio no string has, ringing out.
      const ring = at + Math.max(0.5, dur) + 0.6
      const car = osc('sine', f, at, ring)
      const mod = osc('sine', f * 3.5, at, ring)
      const index = c.createGain()
      index.gain.setValueAtTime(f * 2, at)
      index.gain.exponentialRampToValueAtTime(f * 0.08, at + 0.8)
      mod.connect(index)
      index.connect(car.frequency)
      car.connect(lp)
      tuned.push(car, mod)
      lp.frequency.setValueAtTime(9000, at)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(peak, at + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(0.5, dur) + 0.5)
    }
    if (dur > 0.3 && inst !== 'chime' && inst !== 'keys') vibrato(tuned, at, end, inst === 'brass' ? 11 : 15)
    wobble(tuned, wow, at, end)
    lp.connect(g)
    g.connect(mix)
    send16(mix, o, 1, 1)
  }

  function bass16(o: SpcOut, inst: SpcBass, midi: number, at: number, dur: number, vol = 1): void {
    const c = ac!
    const f = hz(midi)
    const end = at + dur + 0.12
    const g = c.createGain()
    const peak = SPC_GAIN.bass[inst] * vol
    // The finger damps the string a little before the next note, as the 8-bit bass's envelope does.
    const gate = Math.max(0.03, dur - 0.04)
    if (inst === 'fretless') {
      // The finger slides up into the note; long ones get the fretless singing.
      const o1 = wave('fretless', f, at, end)
      o1.detune.setValueAtTime(-30, at)
      o1.detune.linearRampToValueAtTime(0, at + 0.05)
      const lp = biquad('lowpass', 1000, 1)
      lp.frequency.setValueAtTime(1000, at)
      lp.frequency.exponentialRampToValueAtTime(480, at + Math.min(dur, 0.35) + 0.02)
      o1.connect(lp)
      lp.connect(g)
      if (dur > 0.8) vibrato([o1], at, end, 8, 4.6, 0.4)
      struck(g, at, peak, 0.012, 0.72, 0.3, gate, 0.07)
    } else {
      // A thumb on the string: bright for a moment, then round, with the pop of the slap.
      const o1 = wave('slap', f, at, end)
      const lp = biquad('lowpass', 2000, 2.5)
      lp.frequency.setValueAtTime(2000, at)
      lp.frequency.exponentialRampToValueAtTime(400, at + 0.14)
      o1.connect(lp)
      lp.connect(g)
      struck(g, at, peak, 0.003, 0.55, 0.16, gate, 0.04)
      const pop = noiseSrc(at, 0.02)
      const band = biquad('bandpass', 2000, 2)
      const pg = c.createGain()
      pg.gain.setValueAtTime(peak * 0.3, at)
      pg.gain.exponentialRampToValueAtTime(0.0001, at + 0.014)
      pop.connect(band)
      band.connect(pg)
      pg.connect(o.dry)
    }
    g.connect(o.dry)
  }

  function arp16(o: SpcOut, inst: SpcArp, midi: number, at: number, dur: number, pan: number): void {
    const c = ac!
    const f = hz(midi)
    const g = c.createGain()
    const peak = SPC_GAIN.arp[inst]
    const mix = panner(pan)
    if (inst === 'harp') {
      // A plucked string: bright at the finger, duller as it rings, and it rings past its step.
      const ring = Math.max(dur, 0.2) + 0.7
      const o1 = wave('harp', f, at, at + ring + 0.05)
      const lp = biquad('lowpass', 6000, 0.8)
      lp.frequency.setValueAtTime(Math.min(9000, f * 6), at)
      lp.frequency.exponentialRampToValueAtTime(Math.max(500, f * 1.4), at + 0.3)
      o1.connect(lp)
      lp.connect(g)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(peak, at + 0.003)
      g.gain.exponentialRampToValueAtTime(0.0001, at + ring)
    } else if (inst === 'glass') {
      const ring = dur + 0.9
      const car = osc('sine', f, at, at + ring + 0.05)
      const mod = osc('sine', f * 3, at, at + ring + 0.05, 6)
      const index = c.createGain()
      index.gain.setValueAtTime(f * 1.3, at)
      index.gain.exponentialRampToValueAtTime(f * 0.05, at + 0.5)
      mod.connect(index)
      index.connect(car.frequency)
      car.connect(g)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(peak, at + 0.004)
      g.gain.exponentialRampToValueAtTime(0.0001, at + ring)
    } else {
      // A mallet on wood: the bar's note and, for a moment, the knock two octaves up.
      const ring = Math.max(0.12, dur * 0.9) + 0.22
      osc('sine', f, at, at + ring + 0.05).connect(g)
      const knock = osc('sine', f * 4, at, at + 0.08)
      const kg = c.createGain()
      kg.gain.setValueAtTime(0.3, at)
      kg.gain.exponentialRampToValueAtTime(0.0001, at + 0.05)
      knock.connect(kg)
      kg.connect(g)
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(peak, at + 0.002)
      g.gain.exponentialRampToValueAtTime(0.0001, at + ring)
    }
    g.connect(mix)
    send16(mix, o, 1, 0)
  }

  /** One bowed line (the counter melody, a jingle's chord tones): two strings a few cents apart, a slow bow. */
  function string16(o: SpcOut, midi: number, at: number, dur: number, peak: number, pan: number, attack: number, wow?: number): void {
    const c = ac!
    const end = at + dur + 0.4
    const g = c.createGain()
    const lp = biquad('lowpass', 1500)
    lp.frequency.setValueAtTime(1500, at)
    lp.frequency.linearRampToValueAtTime(2300, at + Math.min(0.4, dur))
    const pair = [wave('strings', hz(midi), at, end, 6), wave('strings', hz(midi), at, end, -6)]
    for (const s of pair) s.connect(lp)
    if (dur > 0.4) vibrato(pair, at, end, 9, 5, 0.25)
    wobble(pair, wow, at, end)
    const a = Math.min(attack, dur * 0.5)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak, at + a)
    g.gain.setValueAtTime(peak, at + Math.max(a + 0.01, dur - 0.05))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.28)
    lp.connect(g)
    const mix = panner(pan)
    g.connect(mix)
    send16(mix, o, 0.6, 1)
  }

  /** The pad: a string section or a choir, one player of each pair to the left and one to the right, bowed in slowly. */
  function pad16(o: SpcOut, inst: SpcPad, notes: number[], at: number, dur: number, def: TrackDef): void {
    const c = ac!
    const tail = def.padSwell ? 1.1 : 0.6
    const end = at + dur + tail + 0.1
    const det = def.padDetune ?? 9
    const left = panner(-0.75)
    const right = panner(0.75)
    const oscs: OscillatorNode[] = []
    for (const m of notes) {
      const a = wave(inst, hz(m), at, end, det)
      const b = wave(inst, hz(m), at, end, -det)
      a.connect(left)
      b.connect(right)
      oscs.push(a, b)
    }
    wobble(oscs, def.wow, at, end)
    const g = c.createGain()
    const peak = SPC_GAIN.pad[inst]
    if (inst === 'choir') {
      // "Aah": the throat through three formants, and a little chest under them. The singers waver.
      vibrato(oscs, at, end, 7, 4.8, 0.3)
      const chest = biquad('lowpass', 480)
      const chestGain = c.createGain()
      chestGain.gain.value = 0.5
      for (const side of [left, right]) side.connect(chest)
      chest.connect(chestGain)
      chestGain.connect(g)
      for (const [freq, q, amount] of [[620, 3.5, 1], [1080, 4.5, 0.7], [2700, 6, 0.25]] as const) {
        const formant = biquad('bandpass', freq, q)
        const fg = c.createGain()
        fg.gain.value = amount
        for (const side of [left, right]) side.connect(formant)
        formant.connect(fg)
        fg.connect(g)
      }
    } else {
      const lp = biquad('lowpass', 1200)
      lp.frequency.setValueAtTime(1200, at)
      lp.frequency.linearRampToValueAtTime(2400, at + dur * 0.5)
      lp.frequency.linearRampToValueAtTime(1500, at + dur)
      for (const side of [left, right]) side.connect(lp)
      lp.connect(g)
    }
    const swell = def.padSwell ? dur * 0.45 : Math.min(0.5, dur * 0.35)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak, at + swell)
    g.gain.setValueAtTime(peak, at + Math.max(swell + 0.01, dur - 0.05))
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur + tail)
    send16(g, o, 0.5, 1)
  }

  /** One hit of the sampled kit. `step` places the toms: a fill falls in pitch and crosses from left to right. */
  function drum16(o: SpcOut, lane: 'k' | 's' | 'h', ch: string, at: number, step: number): void {
    const c = ac!
    const s = ensure16()
    const hit = (name: SpcDrum, vol: number, rate: number, pan: number, echo: number, room: number) => {
      const src = c.createBufferSource()
      src.buffer = s.kit[name]
      src.playbackRate.value = rate
      const g = c.createGain()
      g.gain.value = vol * SPC_GAIN.drums[name]
      src.connect(g)
      const mix = pan ? panner(pan) : g
      if (mix !== g) g.connect(mix)
      send16(mix, o, echo, room)
      src.start(at)
    }
    if (lane === 'k') hit('kick', ch === 'X' ? 1.15 : 1, 1, 0, 0, 0)
    else if (lane === 's') {
      if (ch === 't') hit('tom', 1, [1.5, 1.26, 1.06, 0.84][step % 4]!, [-0.5, -0.17, 0.17, 0.5][step % 4]!, 0.5, 0.5)
      else if (ch === 'g') hit('snare', 0.3, 1.08, 0.1, 0.3, 0.3)
      else hit('snare', 1, 1, 0.1, 0.5, 0.6)
    } else {
      // A drummer leans on the beat: the hats between are lighter.
      const lean = step % 4 === 0 ? 1 : step % 2 === 0 ? 0.8 : 0.6
      hit(ch === 'o' ? 'openHat' : 'hat', lean, 1, 0.3, 0, 0)
    }
  }

  /** A player's sends on the 16-bit chip, at `start` of their level (0 = silent, to be faded in). */
  function spcBuses(def: TrackDef, id: TrackId, start: number): SpcBuses {
    const c = ac!
    const s = ensure16()
    const lv = spcLevels(def, id)
    const mk = (dest: AudioNode, v: number) => {
      const g = c.createGain()
      g.gain.setValueAtTime(0, c.currentTime)
      if (start > 0) g.gain.linearRampToValueAtTime(v * start, c.currentTime + 0.4)
      g.connect(dest)
      return g
    }
    return { dry: mk(s.in, lv.dry), echo: mk(s.echo.in, lv.echo), room: mk(s.room, lv.room) }
  }

  function spcLevels(def: TrackDef, id: TrackId): { dry: number; echo: number; room: number } {
    const patch = SPC_PATCHES[id]
    const level = (def.level ?? 1) * patch.level
    return { dry: level, echo: patch.echo * level, room: patch.room * level }
  }

  function spcOut(p: Player): SpcBuses {
    return p.spc ?? (p.spc = spcBuses(p.def, p.id, 1))
  }

  /** How long one chip takes to hand a playing track to the other. */
  const XFADE = 0.4

  /** Hand a playing track to the other chip: its sends crossfade, and whatever is still sounding or already scheduled is voiced again there. */
  function crossFlavor(p: Player): void {
    const c = ac!
    const t = c.currentTime
    const sixteen = flavor === '16-bit'
    const ramp = (g: GainNode, v: number, secs: number) => {
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.linearRampToValueAtTime(v, t + secs)
    }
    // The chip that takes over comes up fast (its notes bring their own attacks); the one that leaves fades.
    const level = p.def.level ?? 1
    const chip: Array<[GainNode, number]> = [[p.dry, level], [p.del, p.def.delay * level], [p.rev, p.def.reverb * level], [p.gated, 0.6 * level]]
    for (const [g, v] of chip) ramp(g, sixteen ? 0 : v, sixteen ? XFADE : XFADE * 0.3)
    if (sixteen && !p.spc) p.spc = spcBuses(p.def, p.id, 0)
    if (p.spc) {
      const lv = spcLevels(p.def, p.id)
      for (const k of ['dry', 'echo', 'room'] as const) ramp(p.spc[k], sixteen ? lv[k] : 0, sixteen ? XFADE * 0.3 : XFADE)
    }
    for (const h of p.held) {
      if (sixteen ? h.spc : h.chip) continue
      if (h.at > t + 0.005) h.play(h.at, h.dur)
      else if (h.at + h.dur - t > 0.12) h.play(t + 0.02, h.at + h.dur - t - 0.02)
      else continue
      if (sixteen) h.spc = true
      else h.chip = true
    }
  }

  // ---- scheduler ------------------------------------------------------------

  function scheduleStep(p: Player): void {
    const def = p.def
    const bar = p.comp.bars[p.bar]!
    const s = p.step
    const sixteenth = 60 / def.bpm / 4
    const at = p.nextTime + (s % 4 === 2 ? def.swing * sixteenth : 0)
    const patch = SPC_PATCHES[p.id]
    // What has sounded is forgotten; the rest is what a change of flavour voices again.
    const now = ac!.currentTime
    if (p.held.length) p.held = p.held.filter(h => h.at + h.dur > now)
    /** Play something on the chip of the moment, and remember it. */
    const sound = (dur: number, play: Held['play']) => {
      play(at, dur)
      p.held.push({ at, dur, play, chip: flavor === '8-bit', spc: flavor === '16-bit' })
    }
    const sixteen = () => flavor === '16-bit'

    for (const lane of ['k', 's', 'h'] as const) {
      const ch = bar.drums[lane][s]
      if (ch && ch !== '.') sound(0, t => (sixteen() ? drum16(spcOut(p), lane, ch, t, s) : drumHit(p, lane, ch, t)))
    }
    for (const e of bar.bass) {
      if (e.step === s) sound(e.len * sixteenth * 0.92, (t, d) => (sixteen() ? bass16(spcOut(p), patch.bass, e.midi, t, d, patch.bassLevel ?? 1) : bassNote(p, def.bass, e.midi, t, d)))
    }
    for (const e of bar.lead) {
      if (e.step === s) sound(e.len * sixteenth * 0.95, (t, d) => (sixteen() ? lead16(spcOut(p), patch.lead, e.midi, t, d, 0.2 * (patch.leadLevel ?? 1), def.wow) : leadNote(p, def.lead, e.midi, t, d, 0.2)))
    }
    for (const e of bar.counter) {
      if (e.step === s) sound(e.len * sixteenth, (t, d) => (sixteen() ? string16(spcOut(p), e.midi, t, d, SPC_GAIN.counter, -0.3, 0.1, def.wow) : counterNote(p, e.midi, t, d)))
    }
    for (const ch of bar.chords) {
      if (ch.from === s && bar.pad) {
        const notes = padVoicing(ch.c)
        sound(ch.len * sixteenth, (t, d) => (sixteen() ? pad16(spcOut(p), patch.pad, notes, t, d, def) : padChord(p, notes, t, d)))
      }
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
      // On the 16-bit chip the harp's notes fall left and right in turn.
      const side = p.arpI % 2 ? 0.4 : -0.4
      p.arpI++
      const midi = tones[idx]!
      sound(sixteenth * (bar.arpRate === 16 ? 1 : 2), (t, d) => (sixteen() ? arp16(spcOut(p), patch.arp, midi, t, d, side) : arpNote(p, midi, t, d)))
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
    // A context someone else clocks is ticked by them.
    if (!timer && !host) timer = setInterval(tick, 25)
  }

  function makePlayer(id: TrackId): Player {
    const c = ac!
    const def = TRACKS[id]
    const sixteen = flavor === '16-bit'
    // A track that starts on the 16-bit chip keeps its 8-bit sends silent until a change of flavour asks for them.
    const level = sixteen ? 0 : def.level ?? 1
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
      spc: sixteen ? spcBuses(def, id, 1) : null,
      held: [],
      alive: true,
    }
  }

  function fadeOut(p: Player, secs: number): void {
    const c = ac!
    p.alive = false
    p.held.length = 0
    const t = c.currentTime
    const sends = [p.dry, p.del, p.rev, p.gated, ...(p.spc ? [p.spc.dry, p.spc.echo, p.spc.room] : [])]
    for (const g of sends) {
      g.gain.cancelScheduledValues(t)
      g.gain.setValueAtTime(g.gain.value, t)
      g.gain.linearRampToValueAtTime(0, t + secs)
    }
    fading.push(p)
    setTimeout(() => {
      for (const g of sends) { try { g.disconnect() } catch { /* gone */ } }
      const i = fading.indexOf(p)
      if (i >= 0) fading.splice(i, 1)
    }, secs * 1000 + 600)
  }

  // ---- sfx primitives ---------------------------------------------------------

  /** Where an effect goes out. 8-bit: the SFX bus (and its reverb when asked). 16-bit: through the chip's voice, with a touch of its echo. */
  function sfxOut(g: AudioNode, verb: boolean): void {
    if (flavor === '16-bit') {
      const s = ensure16()
      g.connect(s.sfx.dry)
      g.connect(s.sfx.echo)
    } else g.connect(sfxBus)
    if (verb) g.connect(sfxVerb)
  }

  /** The 16-bit chip's attack for an effect: a few milliseconds softer, never more than a third of a short sound. */
  function softAttack(attack: number, dur: number): number {
    return Math.max(attack, Math.min(0.007, dur * 0.33))
  }

  interface ToneOpts { f: number; to?: number; dur: number; type?: OscillatorType; vol: number; at?: number; attack?: number; verb?: boolean; lp?: number }

  function tone(o: ToneOpts): void {
    const c = ac!
    const at = c.currentTime + (o.at ?? 0)
    const osc1 = c.createOscillator()
    osc1.type = o.type ?? 'square'
    // On the 16-bit chip the hard waves are its soft "samples" of them, and nothing starts quite so sharply.
    const soft = flavor === '16-bit'
    const softWave = soft && osc1.type !== 'sine' && osc1.type !== 'triangle' ? table(osc1.type === 'square' ? 'softSquare' : 'softSaw') : null
    if (softWave) osc1.setPeriodicWave(softWave)
    osc1.frequency.setValueAtTime(Math.max(20, o.f), at)
    if (o.to) osc1.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), at + o.dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(o.vol, at + (soft ? softAttack(o.attack ?? 0.004, o.dur) : o.attack ?? 0.004))
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
    sfxOut(g, !!o.verb)
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
    g.gain.linearRampToValueAtTime(o.vol, at + (flavor === '16-bit' ? softAttack(o.attack ?? 0.003, o.dur) : o.attack ?? 0.003))
    g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur)
    src.connect(f)
    f.connect(g)
    sfxOut(g, !!o.verb)
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
      sfxOut(g, false)
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
      sfxOut(g, true)
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
      sfxOut(g, true)
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

  function playJingle(j: JingleDef, lead: SpcLead): number {
    const c = ac!
    const beat = 60 / j.bpm
    const t0 = c.currentTime + 0.03
    let end = 0
    for (const [b, m, len, v] of j.notes) {
      const at = t0 + b * beat
      const dur = len * beat
      end = Math.max(end, b * beat + dur)
      if (flavor === '16-bit') {
        // The same notes on the other chip: the lead to its own instrument, a flute under it, chimes, strings, a fretless bass.
        const o = ensure16().sfx
        if (v === 'lead') lead16(o, lead, m, at, dur * 0.95, 0.15)
        else if (v === 'harm') lead16(o, 'flute', m, at, dur * 0.95, 0.09)
        else if (v === 'bell') lead16(o, 'chime', m, at, dur, 0.09)
        else if (v === 'pad') string16(o, m, at, dur, 0.055, 0, 0.08)
        else bass16(o, 'fretless', m, at, dur * 0.95, 0.46)
        continue
      }
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
      // The 16-bit echo follows the track too, once that chip exists (a change of flavour sets it otherwise).
      if (flavor === '16-bit') ensure16()
      spc?.echo.set(spcEchoTime(def.bpm), SPC_PATCHES[track].feedback)
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
        const len = playJingle(j, SPC_JINGLE_LEAD[name])
        const t = ac.currentTime
        musicBus.gain.cancelScheduledValues(t)
        musicBus.gain.setValueAtTime(musicBus.gain.value, t)
        musicBus.gain.linearRampToValueAtTime(MUSIC_LEVEL * 0.15, t + 0.06)
        duckUntil = Math.max(duckUntil, t + len)
        ensureTimer()
      } catch { /* ignore */ }
    },

    pause(on) {
      if (!live) return
      if (on) live.suspend().catch(() => {})
      else live.resume().catch(() => {})
    },

    setMuted(m) {
      muted = m
      if (!ac) return
      master.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, ac.currentTime, 0.02)
    },

    setFlavor(f) {
      if (f === flavor) return
      flavor = f
      if (!ac) return
      try {
        if (f === '16-bit' && current) ensure16().echo.set(spcEchoTime(current.def.bpm), SPC_PATCHES[current.id].feedback)
        if (current) crossFlavor(current)
      } catch { /* context closed */ }
    },

    holdRadio() {
      parkRadio()
    },

    tick,

    dispose() {
      if (timer) { clearInterval(timer); timer = null }
      current = null
      fading.length = 0
      unparkRadio()
      if (live) live.close().catch(() => {})
      ac = live = null
      grit = null
      spc = null
    },
  }
}
