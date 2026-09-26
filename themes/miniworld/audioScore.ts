/**
 * Mini World — the music as data (2026-09-26). Pure: no Web Audio, so the
 * node tests can read it. `audio.ts` plays what `compileBar` returns.
 *
 * Notation: a bar is eight eighth-note tokens separated by spaces. A note
 * is a name with octave (`C5`, `F#6`, `Bb5`), `-` holds the previous note,
 * `.` is a rest. Chords are one symbol per bar, or two separated by a
 * space (half a bar each): `C`, `Am`, `G7`, `Fmaj7`, `Em7`, `Dsus4`.
 *
 * Sections are shared between tracks (the shop and the castle borrow the
 * town tune). A track walks its `form` again and again; each pass through
 * the form hands the tune to the next voice in `leads` and flips the
 * accompaniment pattern, so the loop keeps changing colour.
 */

export type Voice =
  | 'marimba' | 'bell' | 'flute' | 'pluck' | 'brass' | 'musicbox' | 'square'
  | 'bass' | 'pad'
  | 'kick' | 'snare' | 'clap' | 'hat' | 'shaker' | 'tick' | 'tom'
export type Comp = 'arp' | 'broken' | 'block' | 'offbeat' | 'strum'
export type BassStyle = 'root' | 'walk' | 'pump' | 'synco' | 'long'
export type Drums = 'none' | 'shaker' | 'soft' | 'drive' | 'four' | 'march'

export interface Section {
  chords: string[]
  /** Eight bars of melody, or null: the band plays on without the tune. */
  mel: string[] | null
}

export interface TrackDef {
  bpm: number
  /** Semitones added to every note. */
  transpose: number
  /** Swing: how far (in eighths) the off-beat eighths lean late. */
  swing: number
  form: string[]
  /** The tune's voice, one per pass through the form. */
  leads: Voice[]
  comp: Comp
  compVoice: Voice
  bass: BassStyle
  pad: boolean
  drums: Drums
  /** Overall level of the track (0–1). */
  level: number
}

export interface NoteEv {
  /** Start in eighths from the bar's downbeat (fractions allowed). */
  step: number
  /** Length in eighths. */
  len: number
  /** MIDI note; 0 for drums. */
  midi: number
  voice: Voice
  /** 0–1. */
  vel: number
}

export const STEPS = 8

// ---------------------------------------------------------------- sections

export const SECTIONS: Record<string, Section> = {
  // Town: C major, a skipping tune that climbs to C6 and walks home.
  townA: {
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F G', 'C'],
    mel: [
      'E5 - G5 - C6 - B5 A5',
      'G5 - - - D5 - G5 -',
      'A5 - C6 - E6 - D6 C6',
      'C6 - A5 - F5 - - -',
      'E5 G5 C6 - E6 - D6 C6',
      'D6 - B5 - G5 - A5 B5',
      'C6 - A5 - B5 - D6 -',
      'C6 - - - . . . .',
    ],
  },
  townA2: {
    chords: ['C', 'G', 'Am', 'F', 'Dm', 'G', 'Em Am', 'Dm G'],
    mel: [
      'E5 - G5 - C6 - B5 A5',
      'G5 - - - D5 - G5 -',
      'A5 - C6 - E6 - D6 C6',
      'C6 - A5 - F5 - A5 C6',
      'D6 - F6 - E6 - D6 -',
      'B5 - G5 - D5 - G5 -',
      'B5 - - C6 A5 - E5 -',
      'F5 - - - D5 - - -',
    ],
  },
  townB: {
    chords: ['F', 'G', 'Em', 'Am', 'Dm', 'Em F', 'G', 'G7'],
    mel: [
      'A5 - - G5 F5 - A5 -',
      'B5 - - A5 G5 - D5 -',
      'G5 - - F5 E5 - G5 -',
      'C6 - - B5 A5 - - -',
      'F5 - A5 - D6 - C6 -',
      'B5 - G5 - A5 - C6 -',
      'D6 - - - B5 - G5 -',
      'F5 - - - D5 - . .',
    ],
  },
  townC: {
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G'],
    mel: [
      '. . E5 - A5 - . .',
      '. . F5 - A5 - C6 -',
      'G5 - - - . . . .',
      '. . D5 - G5 - B5 -',
      '. . E5 - A5 - B5 -',
      'C6 - B5 - A5 - F5 -',
      'G5 - E5 - C5 - E5 -',
      'D5 - - - . . . .',
    ],
  },
  townRest: { chords: ['C', 'Am', 'F', 'G', 'C', 'Am', 'Dm', 'G'], mel: null },

  // Castle: a little fanfare in front of the town tune.
  castleF: {
    chords: ['C', 'F C', 'G', 'C', 'C', 'F C', 'G', 'C'],
    mel: [
      'C6 - - G5 C6 - E6 -',
      'F6 - E6 - D6 - C6 -',
      'D6 - - - G5 - - -',
      'C6 - G5 - E5 - G5 -',
      'E6 - - C6 E6 - G6 -',
      'A6 - G6 - F6 - E6 -',
      'D6 - B5 - G5 - B5 -',
      'C6 - - - . . . .',
    ],
  },

  // House: F major, a music box by the fire.
  houseA: {
    chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb C', 'F'],
    mel: [
      'A5 - C6 - A5 - F5 -',
      'A5 - - - D5 - F5 -',
      'G5 - Bb5 - D6 - C6 Bb5',
      'A5 - - - G5 - - -',
      'A5 - C6 - F6 - E6 D6',
      'C6 - - - E5 - A5 -',
      'Bb5 - A5 - G5 - E5 -',
      'F5 - - - . . . .',
    ],
  },
  houseB: {
    chords: ['Bb', 'F', 'Gm', 'C', 'Dm', 'Am', 'Bb', 'C7'],
    mel: [
      'D6 - - C6 Bb5 - - -',
      'A5 - - G5 F5 - - -',
      'Bb5 - - A5 G5 - D6 -',
      'C6 - - - . . E5 G5',
      'A5 - - G5 F5 - D5 -',
      'E5 - - F5 G5 - A5 -',
      'Bb5 - A5 - G5 - F5 -',
      'G5 - - - . . . .',
    ],
  },
  houseRest: { chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C'], mel: null },

  // Obby: G major, bouncy and quick.
  obbyA: {
    chords: ['G', 'G', 'C', 'D', 'G', 'Em', 'C D', 'G'],
    mel: [
      'B5 - D6 - B5 G5 . D5',
      'G5 A5 B5 - D6 - B5 -',
      'C6 - E6 - C6 G5 . E5',
      'F#5 G5 A5 - D6 - A5 -',
      'B5 - D6 - G6 - D6 B5',
      'E6 - B5 - G5 - E5 -',
      'C6 - E6 - D6 - F#6 -',
      'G6 - - - . . . .',
    ],
  },
  obbyB: {
    chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'A', 'D'],
    mel: [
      'E5 . E5 G5 B5 - . .',
      'C6 . C6 B5 G5 - . .',
      'D6 . D6 B5 G5 - D5 -',
      'F#5 - A5 - D6 - . .',
      'E5 . E5 G5 B5 - E6 -',
      'E6 - D6 C6 B5 - G5 -',
      'A5 - C#6 - E6 - C#6 -',
      'D6 - A5 - F#5 - D5 -',
    ],
  },
  obbyRest: { chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'C', 'D'], mel: null },

  // Stars: D major, a glockenspiel in the night sky (a sunny one).
  starsA: {
    chords: ['D', 'A', 'Bm', 'G', 'D', 'A', 'G A', 'D'],
    mel: [
      'F#6 - A6 - F#6 - D6 -',
      'E6 - C#6 - A5 - - -',
      'D6 - F#6 - B6 - A6 -',
      'G6 - D6 - B5 - - -',
      'A5 D6 F#6 A6 F#6 - D6 -',
      'E6 - A6 - G6 - E6 -',
      'D6 - B5 - C#6 - E6 -',
      'D6 - - - . . . .',
    ],
  },
  starsB: {
    chords: ['G', 'A', 'F#m', 'Bm', 'Em', 'A', 'G', 'A7'],
    mel: [
      'B5 . D6 . G6 . . .',
      'C#6 . E6 . A6 . . .',
      'C#6 . F#6 . A6 . . .',
      'D6 . F#6 . B6 . . .',
      'G6 - E6 - B5 - G5 -',
      'A5 - C#6 - E6 - A6 -',
      'B6 - A6 - G6 - D6 -',
      'C#6 - - - E6 - - -',
    ],
  },
  starsRest: { chords: ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'A'], mel: null },

  // Fashion: a catwalk groove round F–Em–Dm–C.
  fashionA: {
    chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
    mel: [
      '. A5 . C6 . E6 - C6',
      '. G5 . B5 . D6 - B5',
      '. F5 . A5 . C6 - A5',
      'G5 - - - E5 - G5 -',
      '. A5 . C6 . E6 - F6',
      'E6 - D6 - B5 - G5 -',
      'A5 - C6 - D6 - F6 -',
      'E6 - - - . . . .',
    ],
  },
  fashionB: {
    chords: ['Am7', 'Dm7', 'G', 'C', 'Am7', 'Dm7', 'G', 'G'],
    mel: [
      'C6 - . C6 . E6 . .',
      'D6 - . D6 . F6 . .',
      'B5 - . D6 . G6 . .',
      'E6 - - - C6 - - -',
      'C6 - . C6 . E6 . A6',
      'F6 - E6 - D6 - C6 -',
      'B5 - D6 - G6 - F6 -',
      'D6 - - - . . . .',
    ],
  },
  fashionRest: { chords: ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Em7', 'Dm7', 'G'], mel: null },

  // Memory: G major, slow and calm, room to think.
  memoryA: {
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am D', 'G'],
    mel: [
      'D5 - - - G5 - B5 -',
      'B5 - - - A5 - G5 -',
      'E5 - - - G5 - C6 -',
      'A5 - - - F#5 - - -',
      'D5 - - - G5 - B5 -',
      'D6 - - - B5 - G5 -',
      'A5 - - - F#5 - A5 -',
      'G5 - - - . . . .',
    ],
  },
  memoryB: {
    chords: ['C', 'G', 'Am', 'D', 'Em', 'Bm', 'C', 'D'],
    mel: [
      'E6 - - - D6 - C6 -',
      'B5 - - - D6 - - -',
      'C6 - - - B5 - A5 -',
      'F#5 - - - A5 - - -',
      'G5 - - - B5 - E6 -',
      'D6 - - - F#5 - - -',
      'E5 - G5 - C6 - B5 -',
      'A5 - - - . . . .',
    ],
  },
  memoryRest: { chords: ['G', 'Em', 'C', 'D', 'G', 'C', 'Am', 'D'], mel: null },
}

// ---------------------------------------------------------------- tracks

export type TrackId = 'town' | 'house' | 'obby' | 'stars' | 'fashion' | 'memory' | 'shop' | 'castle'

export const TRACKS: Record<TrackId, TrackDef> = {
  town: {
    bpm: 100, transpose: 0, swing: 0.08,
    form: ['townA', 'townA2', 'townB', 'townA', 'townC', 'townRest', 'townB', 'townA2'],
    leads: ['marimba', 'bell', 'flute'],
    comp: 'arp', compVoice: 'marimba', bass: 'root', pad: false, drums: 'soft', level: 0.9,
  },
  house: {
    bpm: 84, transpose: 0, swing: 0.16,
    form: ['houseA', 'houseB', 'houseA', 'houseRest'],
    leads: ['musicbox', 'flute'],
    comp: 'broken', compVoice: 'marimba', bass: 'long', pad: true, drums: 'none', level: 0.85,
  },
  obby: {
    bpm: 132, transpose: 0, swing: 0,
    form: ['obbyA', 'obbyB', 'obbyA', 'obbyRest'],
    leads: ['square', 'marimba'],
    comp: 'offbeat', compVoice: 'pluck', bass: 'pump', pad: false, drums: 'drive', level: 0.8,
  },
  stars: {
    bpm: 112, transpose: 0, swing: 0,
    form: ['starsA', 'starsB', 'starsA', 'starsRest'],
    leads: ['bell', 'musicbox'],
    comp: 'arp', compVoice: 'bell', bass: 'root', pad: true, drums: 'shaker', level: 0.8,
  },
  fashion: {
    bpm: 108, transpose: 0, swing: 0.1,
    form: ['fashionA', 'fashionB', 'fashionA', 'fashionRest'],
    leads: ['pluck', 'bell'],
    comp: 'offbeat', compVoice: 'marimba', bass: 'synco', pad: true, drums: 'four', level: 0.85,
  },
  memory: {
    bpm: 80, transpose: 0, swing: 0,
    form: ['memoryA', 'memoryB', 'memoryA', 'memoryRest'],
    leads: ['flute', 'musicbox'],
    comp: 'broken', compVoice: 'marimba', bass: 'long', pad: true, drums: 'none', level: 0.8,
  },
  shop: {
    bpm: 92, transpose: 5, swing: 0.14,
    form: ['townC', 'townA', 'townRest', 'townB'],
    leads: ['pluck', 'musicbox'],
    comp: 'strum', compVoice: 'pluck', bass: 'walk', pad: false, drums: 'shaker', level: 0.8,
  },
  castle: {
    bpm: 88, transpose: 2, swing: 0,
    form: ['castleF', 'townA', 'townB', 'castleF', 'townRest'],
    leads: ['brass', 'bell'],
    comp: 'block', compVoice: 'pad', bass: 'root', pad: false, drums: 'march', level: 0.8,
  },
}

// ---------------------------------------------------------------- parsing

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** `C5` → 72, `F#6` → 90, `Bb5` → 82. NaN when it does not parse. */
export function noteMidi(name: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name)
  if (!m) return NaN
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0)
}

export interface Chord { root: number; tones: number[] }

const QUALITY: Record<string, number[]> = {
  '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  sus2: [0, 2, 7], sus4: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14],
}

/** `Am7` → root pitch class 9 and intervals. Null when it does not parse. */
export function parseChord(sym: string): Chord | null {
  const m = /^([A-G])(#|b)?(.*)$/.exec(sym)
  if (!m || !(m[3] in QUALITY)) return null
  const root = (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12
  return { root, tones: QUALITY[m[3]] }
}

/** A bar of melody tokens → notes with lengths (holds extend the note before). */
export function parseMel(bar: string): { step: number; len: number; midi: number }[] {
  const toks = bar.trim().split(/\s+/)
  const out: { step: number; len: number; midi: number }[] = []
  toks.forEach((t, i) => {
    if (t === '-') { if (out.length) out[out.length - 1].len++; return }
    if (t === '.') return
    out.push({ step: i, len: 1, midi: noteMidi(t) })
  })
  return out
}

/** Every problem in the score; empty when it is clean. */
export function validateScore(): string[] {
  const errs: string[] = []
  for (const [id, s] of Object.entries(SECTIONS)) {
    if (s.chords.length !== 8) errs.push(`${id}: ${s.chords.length} chord bars`)
    for (const bar of s.chords) {
      for (const sym of bar.split(' ')) if (!parseChord(sym)) errs.push(`${id}: chord ${sym}`)
    }
    if (s.mel) {
      if (s.mel.length !== 8) errs.push(`${id}: ${s.mel.length} melody bars`)
      s.mel.forEach((bar, i) => {
        const toks = bar.trim().split(/\s+/)
        if (toks.length !== STEPS) errs.push(`${id} bar ${i + 1}: ${toks.length} steps`)
        for (const t of toks) if (t !== '-' && t !== '.' && Number.isNaN(noteMidi(t))) errs.push(`${id} bar ${i + 1}: ${t}`)
      })
    }
  }
  for (const [id, t] of Object.entries(TRACKS)) {
    for (const s of t.form) if (!SECTIONS[s]) errs.push(`${id}: no section ${s}`)
    if (!t.leads.length) errs.push(`${id}: no lead`)
  }
  return errs
}

// ---------------------------------------------------------------- arranging

/** Chord spans in a bar: one or two chords, each with its start and length in eighths. */
function spans(bar: string): { c: Chord; at: number; len: number }[] {
  const syms = bar.split(' ')
  const len = STEPS / syms.length
  return syms.map((s, i) => ({ c: parseChord(s) ?? { root: 0, tones: [0, 4, 7] }, at: i * len, len }))
}

/** A chord tone at or above `floor` (MIDI), for tone index i (wraps up an octave). */
function tone(c: Chord, i: number, floor: number): number {
  const n = c.tones.length
  const oct = Math.floor(i / n)
  const base = c.root + c.tones[((i % n) + n) % n] + 12 * oct
  let m = base
  while (m < floor) m += 12
  return m
}

function bassNote(c: Chord, interval = 0): number {
  // The root sits between E2 (40) and D#3 (51).
  let m = 36 + c.root + interval
  while (m < 40) m += 12
  while (m > 51) m -= 12
  return m
}

const DRUMS: Record<Exclude<Drums, 'none'>, [Voice, number, number][]> = {
  shaker: [[ 'shaker', 0, 0.5 ], [ 'shaker', 1, 0.3 ], [ 'shaker', 2, 0.45 ], [ 'shaker', 3, 0.3 ],
    [ 'shaker', 4, 0.5 ], [ 'shaker', 5, 0.3 ], [ 'shaker', 6, 0.45 ], [ 'shaker', 7, 0.3 ]],
  soft: [[ 'kick', 0, 0.55 ], [ 'tick', 2, 0.4 ], [ 'kick', 4, 0.45 ], [ 'tick', 6, 0.4 ],
    [ 'shaker', 1, 0.25 ], [ 'shaker', 3, 0.25 ], [ 'shaker', 5, 0.25 ], [ 'shaker', 7, 0.25 ]],
  drive: [[ 'kick', 0, 0.8 ], [ 'kick', 3, 0.5 ], [ 'kick', 4, 0.7 ], [ 'snare', 2, 0.55 ], [ 'snare', 6, 0.55 ],
    [ 'hat', 0, 0.3 ], [ 'hat', 1, 0.2 ], [ 'hat', 2, 0.3 ], [ 'hat', 3, 0.2 ],
    [ 'hat', 4, 0.3 ], [ 'hat', 5, 0.2 ], [ 'hat', 6, 0.3 ], [ 'hat', 7, 0.2 ]],
  four: [[ 'kick', 0, 0.75 ], [ 'kick', 2, 0.65 ], [ 'kick', 4, 0.75 ], [ 'kick', 6, 0.65 ],
    [ 'clap', 2, 0.5 ], [ 'clap', 6, 0.5 ],
    [ 'hat', 1, 0.3 ], [ 'hat', 3, 0.3 ], [ 'hat', 5, 0.3 ], [ 'hat', 7, 0.3 ], [ 'shaker', 3.5, 0.2 ], [ 'shaker', 7.5, 0.2 ]],
  march: [[ 'tom', 0, 0.6 ], [ 'tom', 4, 0.5 ], [ 'snare', 2, 0.3 ], [ 'snare', 6, 0.35 ], [ 'snare', 7, 0.25 ], [ 'snare', 7.5, 0.3 ]],
}

/**
 * Every note of one bar: the tune, the band and the drums. `pass` counts
 * trips through the form (it picks the lead and flips the patterns).
 */
export function compileBar(id: TrackId, sectionId: string, bar: number, pass: number): NoteEv[] {
  const t = TRACKS[id]
  const s = SECTIONS[sectionId]
  const tr = t.transpose
  const out: NoteEv[] = []
  const last = bar === 7
  const flip = pass % 2 === 1

  // The tune.
  if (s.mel) {
    const lead = t.leads[pass % t.leads.length]
    for (const n of parseMel(s.mel[bar])) {
      out.push({ step: n.step, len: n.len, midi: n.midi + tr, voice: lead, vel: n.step % 4 === 0 ? 0.9 : 0.75 })
    }
  }

  // The band.
  for (const { c, at, len } of spans(s.chords[bar])) {
    const chord: Chord = { root: (c.root + tr + 12) % 12, tones: c.tones }
    const cv = t.compVoice
    switch (t.comp) {
      case 'arp': {
        // Up the chord in eighths; the second pass comes back down.
        const order = flip ? [4, 3, 2, 1, 2, 3, 2, 1] : [0, 1, 2, 3, 2, 1, 2, 3]
        for (let k = 0; k < len; k++) {
          // Without a tune the arpeggio climbs higher, where the tune would be.
          const floor = s.mel ? 60 : 67
          out.push({ step: at + k, len: 1, midi: tone(chord, order[(at + k) % 8], floor), voice: cv, vel: k === 0 ? 0.5 : 0.35 })
        }
        break
      }
      case 'broken': {
        const order = flip ? [0, 2, 1, 2] : [0, 2, 1, 3]
        for (let k = 0; k < len; k += 2) {
          out.push({ step: at + k, len: 2, midi: tone(chord, order[(k / 2) % 4], 55), voice: cv, vel: k === 0 ? 0.45 : 0.32 })
        }
        break
      }
      case 'block':
        for (let k = 0; k < len; k += 4) {
          for (let i = 0; i < 3; i++) out.push({ step: at + k, len: Math.min(4, len - k) - 0.2, midi: tone(chord, i, 55), voice: cv, vel: 0.4 })
        }
        break
      case 'offbeat':
        for (let k = 1; k < len; k += 2) {
          for (let i = 0; i < 3; i++) out.push({ step: at + k, len: 0.5, midi: tone(chord, i + (flip ? 1 : 0), 60), voice: cv, vel: 0.3 })
        }
        break
      case 'strum':
        for (const k of [0, 3, 6]) {
          if (k >= len) continue
          for (let i = 0; i < 4; i++) out.push({ step: at + k + i * 0.06, len: 1.5, midi: tone(chord, i, 55), voice: cv, vel: k === 0 ? 0.42 : 0.3 })
        }
        break
    }

    if (t.pad) {
      for (let i = 0; i < 3; i++) out.push({ step: at, len: len - 0.1, midi: tone(chord, i, 60), voice: 'pad', vel: 0.35 })
    }

    const b = (step: number, l: number, iv: number, vel: number) =>
      out.push({ step: at + step, len: l, midi: bassNote(chord, iv), voice: 'bass', vel })
    switch (t.bass) {
      case 'root':
        b(0, Math.min(3.5, len), 0, 0.8)
        if (len > 4) b(4, 3.5, 7, 0.6)
        break
      case 'long':
        b(0, len - 0.2, 0, 0.7)
        break
      case 'walk': {
        const iv = [0, chord.tones[1], 7, 9]
        for (let k = 0; k < len; k += 2) b(k, 1.8, iv[(k / 2) % 4], k === 0 ? 0.8 : 0.6)
        break
      }
      case 'pump':
        for (let k = 0; k < len; k++) b(k, 0.8, k % 2 ? 12 : 0, k % 2 ? 0.5 : 0.8)
        break
      case 'synco':
        b(0, 1, 0, 0.85)
        b(1.5, 0.5, 0, 0.55)
        if (len > 4) { b(3, 1, 7, 0.65); b(4.5, 0.5, 12, 0.6); b(6, 1, 0, 0.75); b(7, 0.8, 10, 0.55) }
        else b(3, 0.8, 7, 0.6)
        break
    }
  }

  // The drums, with a fill into the next section.
  if (t.drums !== 'none') {
    for (const [v, step, vel] of DRUMS[t.drums]) {
      if (last && step >= 6 && (v === 'snare' || v === 'clap' || v === 'tick')) continue
      out.push({ step, len: 0.5, midi: 0, voice: v, vel })
    }
    if (last && t.drums !== 'shaker') {
      const fill: Voice = t.drums === 'soft' ? 'tick' : t.drums === 'march' ? 'snare' : 'snare'
      for (const step of [6, 6.5, 7, 7.5]) out.push({ step, len: 0.5, midi: 0, voice: fill, vel: 0.3 + (step - 6) * 0.15 })
    }
  }

  return out.sort((a, z) => a.step - z.step)
}

/** MIDI → Hz. */
export function hz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
}
