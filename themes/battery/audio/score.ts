/**
 * Night of the Dead Battery — the score, as data. One original theme: a
 * spooky-whimsical oompah waltz in D minor. Pure, no Web Audio: the tests
 * compile and check every bar.
 *
 * The theme (132 bpm, 3/4), 64 bars that loop:
 *
 *   A   16 bars  the hook. "DUM · di-di-di | DAAA di-da": D, a tumble F-E-D,
 *                a leap to A with a chromatic wink (G#-A). Answered in Gm,
 *                a half cadence on A7 with a spooky flat nine (Bb over A7),
 *                then the hook again climbing to D6 over Bb and Gm6, down
 *                through a tritone-flavoured Bb7 to the cadence.
 *   B   16 bars  tiptoe: staccato arpeggios in F major, a turn, a sneaky
 *                Bb7 (the blue flat five), and a chromatic creep A-Bb-B-C-C#
 *                that walks back into the hook.
 *   A2  16 bars  the hook with ornaments (a trill, a comic mordent) and a
 *                full stop.
 *   C   16 bars  the lament: the bass walks down D-C-B-Bb-A under a slow,
 *                sighing tune (the "clock" section); ends on A7 into A.
 *
 * Every floor plays these same bars at the same tempo, so switching floors
 * is only a change of orchestra at a bar line (iMUSE). The cues borrow the
 * theme: the intro is the hook as a 2/4 polka, the séance is the hook in
 * slow motion over organ, the tension cue sequences the hook up a semitone
 * onto the Neapolitan (Eb), the finale is the hook in D major, the credits
 * are a relaxed D major and F major.
 */

// ---------------------------------------------------------------------------
// Notes and chords
// ---------------------------------------------------------------------------

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** 'C#5' → 73, 'Bb4' → 70; -1 when it does not parse. */
export function noteMidi(tok: string): number {
  const m = /^([A-G])(#|b)?(\d)$/.exec(tok)
  if (!m) return -1
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return 12 * (Number(m[3]) + 1) + PC[m[1]!]! + acc
}

export interface Chord {
  sym: string
  /** Pitch class of the root. */
  root: number
  /** Pitch class of the bass (slash chords). */
  bass: number
  /** Semitones above the root. */
  tones: readonly number[]
  /** Pitch classes of the chord. */
  pcs: readonly number[]
}

const QUALITY: Record<string, readonly number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  m6: [0, 3, 7, 9],
  '6': [0, 4, 7, 9],
  dim: [0, 3, 6],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  aug: [0, 4, 8],
  sus4: [0, 5, 7],
}

/** 'Dm', 'Bbmaj7', 'Dm/A', 'Bm7b5' → Chord; null when it does not parse. */
export function parseChord(sym: string): Chord | null {
  const m = /^([A-G])(#|b)?(maj7|m7b5|dim7|m6|m7|dim|aug|sus4|m|7|6)?(?:\/([A-G])(#|b)?)?$/.exec(sym)
  if (!m) return null
  const acc = (s?: string) => (s === '#' ? 1 : s === 'b' ? -1 : 0)
  const root = (PC[m[1]!]! + acc(m[2]) + 12) % 12
  const bass = m[4] ? (PC[m[4]]! + acc(m[5]) + 12) % 12 : root
  const tones = QUALITY[m[3] ?? '']!
  return { sym, root, bass, tones, pcs: tones.map(x => (root + x) % 12) }
}

// ---------------------------------------------------------------------------
// Sections: one [chord, melody] per bar
// ---------------------------------------------------------------------------

/**
 * A bar: the chord ('Dm', or 'E7|A7' split: the second chord from the last
 * beat), and the melody as eighths (6 tokens in 3/4, 8 in 4/4) or
 * sixteenths (12 / 16). A token is a note ('F#5'), '-' holds, '.' rests.
 */
export type Bar = readonly [chord: string, melody: string]

export interface SectionDef {
  bars: readonly Bar[]
}

const S = (bars: Bar[]): SectionDef => ({ bars })

/** Section with some bars replaced (1-based bar numbers). */
function vary(base: SectionDef, changes: Record<number, Bar>): SectionDef {
  return { bars: base.bars.map((b, i) => changes[i + 1] ?? b) }
}

/** Melody moved by semitones (chords unchanged). */
function shiftMel(base: SectionDef, semis: number): SectionDef {
  return {
    bars: base.bars.map(([c, mel]) => [c, mel.split(/\s+/).map(tok => {
      const m = noteMidi(tok)
      return m < 0 ? tok : midiName(m + semis)
    }).join(' ')] as const),
  }
}

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B']
export function midiName(m: number): string {
  return NAMES[((m % 12) + 12) % 12]! + String(Math.floor(m / 12) - 1)
}

// The theme ------------------------------------------------------------------

const A = S([
  ['Dm', 'D5 - . F5 E5 D5'],
  ['Dm', 'A5 - - - G#5 A5'],
  ['Gm', 'Bb5 - A5 - G5 -'],
  ['Dm/A', 'F5 - - - E5 F5'],
  ['A7', 'E5 - F5 - G5 -'],
  ['A7', 'Bb5 - - - A5 G5'],
  ['Dm', 'F5 - E5 D5 C#5 D5'],
  ['A7', 'E5 - - - . A4'],
  ['Dm', 'D5 - . F5 E5 D5'],
  ['Dm', 'A5 - - - G#5 A5'],
  ['Bb', 'D6 - - - C6 Bb5'],
  ['Gm6', 'Bb5 - G5 - E5 -'],
  ['Dm/A', 'F5 - A5 - D6 -'],
  ['Bb7', 'D6 - C6 - Ab5 -'],
  ['A7', 'G5 - E5 - C#5 E5'],
  ['Dm', 'D5 - . A4 D4 .'],
])

const B = S([
  ['F', 'C5 . F5 . A5 .'],
  ['C7', 'Bb5 . G5 . E5 .'],
  ['F', 'A5 - G5 F5 E5 F5'],
  ['F', 'C6 - - - . .'],
  ['Bb', 'D6 . Bb5 . F5 .'],
  ['F/C', 'A5 . F5 . C5 .'],
  ['G7', 'B4 - C5 - D5 -'],
  ['C7', 'E5 - - - G5 A5'],
  ['Gm', 'Bb5 - A5 - G5 F5'],
  ['Dm', 'A5 - - - F5 D5'],
  ['Bb7', 'Ab5 - - - G5 F5'],
  ['A7', 'E5 - G5 - Bb5 -'],
  ['Dm', 'A5 - F5 - D5 -'],
  ['Gm6', 'Bb5 - G5 - E5 -'],
  ['A7', 'A4 - Bb4 - B4 -'],
  ['A7', 'C5 - C#5 - - .'],
])

const A2 = vary(A, {
  2: ['Dm', 'A5 - - - G#5 A5'],
  7: ['Dm', 'F5 - - - E5 - D5 - C#5 D5 C#5 D5'],
  10: ['Dm', 'A5 - - - - - - - G#5 A5 Bb5 A5'],
  13: ['Dm/A', 'F5 - A5 - D6 E6 F6 - E6 - D6 -'],
  15: ['A7', 'G5 - E5 - C#5 -'],
  16: ['Dm', 'D5 - - - - -'],
})

const C = S([
  ['Dm', 'D6 - - - A5 -'],
  ['Dm/C', 'F5 - - - E5 F5'],
  ['Bm7b5', 'D5 - - - - -'],
  ['Bbmaj7', 'F5 - - - E5 D5'],
  ['A7', 'C#5 - - - E5 -'],
  ['A7', 'G5 - - - F5 E5'],
  ['Dm', 'F5 - - - D5 -'],
  ['A7', 'E5 - - - . .'],
  ['Dm', 'A5 - - - - -'],
  ['Dm/C', 'A5 - - - G5 F5'],
  ['Bm7b5', 'F5 - - - D5 F5'],
  ['Bbmaj7', 'A5 - - - F5 D5'],
  ['Gm6', 'E5 - - - G5 -'],
  ['A7', 'G5 - F5 - E5 -'],
  ['Dm', 'D5 - - - - -'],
  ['A7', '. . . . C#5 -'],
])

// The intro: the hook as a driving 2/4 polka (written in 4/4 bars) -----------

const D = S([
  ['Dm', 'D5 . F5 E5 D5 . A4 .'],
  ['Dm', 'A5 - - G#5 A5 . . .'],
  ['Gm', 'Bb5 . A5 . G5 . F5 .'],
  ['A7', 'E5 - - - C#5 . A4 .'],
  ['Dm', 'D5 . F5 E5 D5 . A4 .'],
  ['Dm', 'A5 - - G#5 A5 . D6 .'],
  ['A7', 'C#6 . Bb5 . G5 . E5 .'],
  ['Dm', 'D5 . A4 . D5 . . .'],
])

const D2 = S([
  ['F', 'C5 . F5 . A5 . C6 .'],
  ['C7', 'Bb5 . G5 . E5 . C5 .'],
  ['F', 'A5 - G5 F5 E5 F5 A5 .'],
  ['F', 'C6 - - - . . . .'],
  ['Bb', 'D6 . Bb5 . F5 . D5 .'],
  ['Gm6', 'E5 . G5 . Bb5 . G5 .'],
  ['A7', 'A5 . G5 . E5 . C#5 .'],
  ['A7', 'A4 . . . . . . .'],
])

// The séance: the hook in slow motion, D - F E D - A, for glass harmonica ----

const SE = S([
  ['Dm', 'D5 - - - - -'],
  ['Dm', 'F5 - - - E5 D5'],
  ['Bbmaj7', 'A5 - - - - -'],
  ['Bbmaj7', 'G5 - - - F5 -'],
  ['Gm6', 'E5 - - - - -'],
  ['Gm6', 'G5 - - - Bb5 -'],
  ['A7', 'C#5 - - - E5 -'],
  ['A7', 'G5 - - - - -'],
  ['Dm', 'F5 - - - - -'],
  ['Dm/C', 'A5 - - - - -'],
  ['Bm7b5', 'D5 - - - F5 -'],
  ['Bbmaj7', 'F5 - - - - -'],
  ['Eb', 'G5 - - - Bb5 -'],
  ['A7', 'A5 - G5 - E5 -'],
  ['Dm', 'F5 - - - D5 -'],
  ['A7', 'E5 - - - C#5 -'],
])
const SE2 = shiftMel(SE, 12)

// Tension: the clock, then the hook climbing onto the Neapolitan -------------

const REST4 = '. . . . . . . .'
const T1 = S([['Dm', REST4], ['Dm', REST4], ['Dm', REST4], ['Dm', REST4]])
const T2 = S([['Dm', REST4], ['Eb', REST4], ['Dm', REST4], ['A7', REST4]])
const T3 = S([
  ['Dm', 'A4 - - - - - - -'],
  ['Eb', 'Bb4 - - - - - - -'],
  ['Dm', 'A4 - - - - - - -'],
  ['A7', 'C#5 - - - - - - -'],
])
const T4 = S([
  ['Dm', 'D5 . F5 E5 D5 . . .'],
  ['Eb', 'Eb5 . G5 F5 Eb5 . . .'],
  ['Dm', 'D5 . F5 E5 D5 . A5 .'],
  ['A7', 'C#6 - - - A5 - E5 -'],
])

// The finale: the hook in D major, a bright bridge, a grand cadence ----------

const F = S([
  ['D', 'D5 - . F#5 E5 D5'],
  ['D', 'A5 - - - G#5 A5'],
  ['G', 'B5 - A5 - G5 -'],
  ['D/A', 'F#5 - - - E5 F#5'],
  ['A7', 'E5 - F#5 - G5 -'],
  ['A7', 'B5 - - - A5 G5'],
  ['D', 'F#5 - E5 D5 C#5 D5'],
  ['A7', 'E5 - - - . A4'],
  ['D', 'D5 - . F#5 E5 D5'],
  ['D', 'A5 - - - G#5 A5'],
  ['Bb', 'D6 - - - C6 Bb5'],
  ['G', 'B5 - G5 - E5 -'],
  ['D/A', 'F#5 - A5 - D6 -'],
  ['E7', 'D6 - B5 - G#5 -'],
  ['A7', 'G5 - E5 - C#5 E5'],
  ['D', 'D5 - . A4 D4 .'],
])

const FB = S([
  ['F', 'C5 . F5 . A5 .'],
  ['C7', 'Bb5 . G5 . E5 .'],
  ['F', 'A5 - G5 F5 E5 F5'],
  ['F', 'C6 - - - . .'],
  ['Bb', 'D6 . Bb5 . F5 .'],
  ['F/C', 'A5 . F5 . C5 .'],
  ['G7', 'B4 - C5 - D5 -'],
  ['C7', 'E5 - - - G5 A5'],
  ['Gm', 'Bb5 - A5 - G5 F5'],
  ['C7', 'E5 - G5 - Bb5 -'],
  ['F', 'A5 - - - C6 -'],
  ['Bb', 'D6 - - - Bb5 -'],
  ['G', 'B5 - - - D6 -'],
  ['E7', 'E6 - D6 - B5 -'],
  ['A7', 'C#6 - A5 - E5 G5'],
  ['A7', 'A5 - - - . .'],
])

const FE = vary(F, {
  7: ['D', 'F#5 - - - E5 - D5 - C#5 D5 E5 F#5'],
  15: ['A7', 'G5 - E5 - C#6 -'],
  16: ['D', 'D6 - - - - -'],
})

export const SECTIONS = { A, B, A2, C, D, D2, SE, SE2, T1, T2, T3, T4, F, FB, FE } as const
export type SectionId = keyof typeof SECTIONS

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

export type TrackId = 'theme' | 'intro' | 'seance' | 'tension' | 'finale' | 'credits'

export interface TrackDef {
  bpm: number
  meter: 3 | 4
  form: readonly SectionId[]
  /** Form index the loop returns to (default 0). */
  loopFrom?: number
  /** Per pass after the first: semitones up and bpm added, capped at `maxSteps` passes. */
  trStep?: number
  bpmStep?: number
  maxSteps?: number
}

export const TRACKS: Record<TrackId, TrackDef> = {
  theme: { bpm: 132, meter: 3, form: ['A', 'B', 'A2', 'C'] },
  intro: { bpm: 152, meter: 4, form: ['D', 'D2'] },
  seance: { bpm: 84, meter: 3, form: ['SE', 'SE2'] },
  tension: { bpm: 116, meter: 4, form: ['T1', 'T2', 'T3', 'T4'], loopFrom: 1, trStep: 1, bpmStep: 3, maxSteps: 5 },
  finale: { bpm: 144, meter: 3, form: ['F', 'FB', 'FE'] },
  credits: { bpm: 108, meter: 3, form: ['F', 'B', 'C', 'FE'] },
}

// ---------------------------------------------------------------------------
// Compiling: bars of absolute events
// ---------------------------------------------------------------------------

/** A note: start and length in eighths from the start of its bar. */
export interface Ev { at: number; len: number; m: number }

export interface BarData {
  sec: SectionId
  /** Bar number within the section, 0-based, and the section's length. */
  i: number
  n: number
  /** One chord per beat. */
  chords: readonly Chord[]
  mel: readonly Ev[]
}

export interface Compiled {
  bars: readonly BarData[]
  /** Bar index the loop returns to. */
  loopBar: number
  /** Eighths per bar. */
  eighths: number
}

const cache = new Map<TrackId, Compiled>()

export function compileTrack(id: TrackId): Compiled {
  const hit = cache.get(id)
  if (hit) return hit
  const def = TRACKS[id]
  const eighths = def.meter * 2
  const bars: BarData[] = []
  let loopBar = 0
  let open: { ev: Ev; bar: number } | null = null
  def.form.forEach((sid, fi) => {
    if (fi === (def.loopFrom ?? 0)) loopBar = bars.length
    const sec = SECTIONS[sid]
    sec.bars.forEach(([csym, mel], i) => {
      const parts = csym.split('|')
      const c1 = parseChord(parts[0]!)!
      const c2 = parts[1] ? parseChord(parts[1])! : c1
      const chords = Array.from({ length: def.meter }, (_, b) => (b === def.meter - 1 ? c2 : c1))
      const evs: Ev[] = []
      const toks = mel.trim().split(/\s+/)
      const unit = eighths / toks.length
      toks.forEach((tok, j) => {
        if (tok === '-') {
          if (open) open.ev.len += unit
          return
        }
        open = null
        if (tok === '.') return
        const ev = { at: j * unit, len: unit, m: noteMidi(tok) }
        evs.push(ev)
        open = { ev, bar: bars.length }
      })
      bars.push({ sec: sid, i, n: sec.bars.length, chords, mel: evs })
    })
    // Notes never tie across the end of a section into the next.
    open = null
  })
  const c = { bars, loopBar, eighths }
  cache.set(id, c)
  return c
}

/** Every problem with the score, as readable strings; [] when clean. */
export function validateScore(): string[] {
  const errs: string[] = []
  for (const [sid, sec] of Object.entries(SECTIONS)) {
    sec.bars.forEach(([csym, mel], i) => {
      for (const p of csym.split('|')) if (!parseChord(p)) errs.push(`${sid} bar ${i + 1}: chord ${p}`)
      const toks = mel.trim().split(/\s+/)
      for (const tok of toks) {
        if (tok !== '-' && tok !== '.' && noteMidi(tok) < 0) errs.push(`${sid} bar ${i + 1}: note ${tok}`)
      }
      const four = sid.startsWith('D') || sid.startsWith('T')
      const ok = four ? [8, 16] : [6, 12]
      if (!ok.includes(toks.length)) errs.push(`${sid} bar ${i + 1}: ${toks.length} tokens`)
    })
  }
  for (const [id, def] of Object.entries(TRACKS) as [TrackId, TrackDef][]) {
    for (const sid of def.form) if (!SECTIONS[sid]) errs.push(`${id}: no section ${sid}`)
    const c = compileTrack(id)
    for (const b of c.bars) for (const e of b.mel) {
      if (e.m < 40 || e.m > 96) errs.push(`${id} ${b.sec} bar ${b.i + 1}: note ${e.m} out of range`)
    }
  }
  return errs
}
