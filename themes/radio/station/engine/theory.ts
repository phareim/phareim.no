// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Music theory for the composer: modes, the chord-token grammar of
 * `Progression.chords`, chord naming, voice leading.
 *
 * Chords are built diatonically from the current mode unless a token forces
 * a quality, so one progression darkens as the mood knob moves the mode
 * (degree 4 is IV in dorian and iv in aeolian).
 */
import type { Chord, Key, Mode } from './types.ts'

export const MODE_STEPS: Record<Mode, number[]> = {
  lydian: [0, 2, 4, 6, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
}

/** The ladder the mood knob walks, brightest first. */
export const BRIGHTNESS: Mode[] = ['lydian', 'ionian', 'mixolydian', 'dorian', 'aeolian', 'harmonicMinor', 'phrygian']

/** Modes whose third is minor. */
export function isMinorMode(m: Mode): boolean {
  return MODE_STEPS[m][2] === 3
}

/** Pitch classes of the key's scale, degree 1 first. */
export function scalePcs(key: Key): number[] {
  return MODE_STEPS[key.mode].map(s => (key.tonic + s) % 12)
}

/** The mode's five-note pentatonic subset (as pitch classes). */
export function pentatonicPcs(key: Key): number[] {
  const sc = scalePcs(key)
  const degrees = isMinorMode(key.mode) ? [0, 2, 3, 4, 6] : [0, 1, 2, 4, 5]
  return degrees.map(d => sc[d]!)
}

// ---- names ---------------------------------------------------------------

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** Relative major tonic of a key (for the key signature). */
function relativeMajor(key: Key): number {
  const offset = { lydian: 7, ionian: 0, mixolydian: 5, dorian: 10, aeolian: 3, phrygian: 8, harmonicMinor: 3 }[key.mode]
  return (key.tonic + offset) % 12
}

/** Spell pitch classes with sharps in sharp keys, flats otherwise. */
export function pcName(pc: number, key?: Key): string {
  const p = ((pc % 12) + 12) % 12
  if (key && [7, 2, 9, 4, 11].includes(relativeMajor(key))) return SHARP_NAMES[p]!
  return FLAT_NAMES[p]!
}

export function keyName(key: Key): string {
  const mode = key.mode === 'harmonicMinor' ? 'harmonic minor' : key.mode
  return `${pcName(key.tonic, key)} ${mode}`
}

export function midiName(m: number, key?: Key): string {
  return `${pcName(m, key)}${Math.floor(m / 12) - 1}`
}

/** Name a chord's quality from its tones. */
export function qualityName(tones: number[]): string {
  const has = (t: number) => tones.includes(t)
  const third = has(4) ? 'M' : has(3) ? 'm' : has(5) ? 's4' : has(2) ? 's2' : '5'
  const fifth = has(6) && !has(7) ? 'b5' : ''
  const sev = has(11) ? 'maj7' : has(10) ? '7' : has(9) && third === 'm' && fifth ? 'dim7' : ''
  const nine = has(14) ? '9' : ''
  const six = !sev && has(9) ? '6' : ''
  if (third === 'M') {
    if (sev === 'maj7') return nine ? 'maj9' : 'maj7'
    if (sev === '7') return nine ? '9' : '7'
    if (six) return nine ? '6/9' : '6'
    return nine ? 'add9' : ''
  }
  if (third === 'm') {
    if (fifth) return sev === '7' ? 'm7b5' : sev === 'dim7' ? 'dim7' : 'dim'
    if (sev === 'maj7') return 'm(maj7)'
    if (sev === '7') return nine ? 'm9' : 'm7'
    if (six) return 'm6'
    return nine ? 'madd9' : 'm'
  }
  if (third === 's4') return sev === '7' ? '7sus4' : 'sus4'
  if (third === 's2') return sev === '7' ? '7sus2' : 'sus2'
  return '5'
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

// ---- chord tokens ----------------------------------------------------------

export interface ParsedToken {
  chord: Chord
  /** Duration in bars (0.5 allowed). */
  bars: number
}

const TOKEN = /^(b|#)?([1-7])(M|m|d|s2|s4|5)?(7|9|6|add9)?(?:\/(b|#)?([1-7]))?(?::(\d+(?:\.\d+)?))?$/

/**
 * Parse one chord token in a key. `extra7`/`extra9` let the composer colour
 * a plain triad (the landscape's `color`); forced qualities keep their shape.
 */
export function parseToken(tok: string, key: Key, barsPerChord = 1, extra7 = false, extra9 = false): ParsedToken | null {
  const m = TOKEN.exec(tok)
  if (!m) return null
  const [, acc, degStr, quality, ext, bassAcc, bassDeg, dur] = m
  const deg = Number(degStr) - 1
  const steps = MODE_STEPS[key.mode]
  // Accidentals count from the major scale, as in roman numerals: bVII is
  // ten semitones up in any mode. A chromatic root that lands on the mode's
  // own degree (bVII in aeolian) is simply diatonic.
  const shift = acc === 'b' ? -1 : acc === '#' ? 1 : 0
  const rootOff = acc ? (MODE_STEPS.ionian[deg]! + shift + 12) % 12 : steps[deg]!
  const root = (key.tonic + rootOff) % 12
  const diatonic = rootOff === steps[deg]!

  /** Diatonic interval above the chord root for the chord's nth scale step (2 = third). */
  const stack = (n: number): number => {
    const i = deg + n
    const oct = Math.floor(i / 7) * 12
    return (steps[i % 7]! + oct - steps[deg]! + 24) % 24
  }

  let tones: number[]
  switch (quality) {
    case 'M': tones = [0, 4, 7]; break
    case 'm': tones = [0, 3, 7]; break
    case 'd': tones = [0, 3, 6]; break
    case 's2': tones = [0, 2, 7]; break
    case 's4': tones = [0, 5, 7]; break
    case '5': tones = [0, 7]; break
    default:
      tones = diatonic ? [0, stack(2), stack(4)] : [0, 4, 7]
  }

  const seventh = (): number => {
    if (diatonic && !quality) return stack(6)
    if (diatonic && quality !== 'd') {
      // A forced quality on a diatonic root: keep the scale's 7th unless it clashes.
      const s = stack(6)
      if (quality === 'm' && s === 11) return 10
      return s
    }
    return quality === 'd' ? 9 : 10
  }
  const ninth = (): number => (diatonic ? stack(8) : 14)

  const wants7 = ext === '7' || ext === '9' || (!ext && extra7 && tones.length === 3 && quality !== '5')
  const wants9 = ext === '9' || ext === 'add9' || (!ext && extra9 && tones.length === 3 && quality !== '5')
  if (wants7) tones.push(seventh())
  if (ext === '6') tones.push(diatonic ? stack(5) : 9)
  if (wants9) {
    const n = ninth()
    // A minor ninth over the root sounds wrong in this music: leave it out.
    if (n === 14 && !tones.includes(2)) tones.push(14)
  }
  tones = [...new Set(tones)].sort((a, b) => a - b)

  let bass = root
  if (bassDeg) {
    const bs = bassAcc === 'b' ? -1 : bassAcc === '#' ? 1 : 0
    const bd = Number(bassDeg) - 1
    bass = (key.tonic + (bassAcc ? MODE_STEPS.ionian[bd]! + bs : steps[bd]!) + 12) % 12
  }

  const q = qualityName(tones)
  const symbol = `${pcName(root, key)}${q}${bass !== root ? '/' + pcName(bass, key) : ''}`
  const minorish = tones.includes(3) && !tones.includes(4)
  const numeral = ROMAN[deg]!
  // Label against the major scale, as musicians do: bVII in dorian, bIII in aeolian.
  const vsMajor = (rootOff - MODE_STEPS.ionian[deg]! + 12) % 12
  const accName = vsMajor === 11 ? 'b' : vsMajor === 1 ? '#' : ''
  const suffix = ({ m: '', m7: '7', m9: '9', madd9: 'add9', m6: '6', dim: '°', dim7: '°7', m7b5: 'ø7' } as Record<string, string>)[q]
  const degreeLabel = accName + (minorish ? numeral.toLowerCase() : numeral) + (minorish && suffix !== undefined ? suffix : q)
  return {
    chord: { root, bass, tones, symbol, degree: degreeLabel },
    bars: dur ? Number(dur) : barsPerChord,
  }
}

/** Parse a whole progression; null plus the bad token on failure. */
export function parseProgression(
  chords: string,
  key: Key,
  barsPerChord = 1,
  colour?: (i: number) => { extra7: boolean; extra9: boolean },
): { chords: ParsedToken[]; bars: number } | { error: string } {
  const toks = chords.trim().split(/\s+/)
  const out: ParsedToken[] = []
  let bars = 0
  for (let i = 0; i < toks.length; i++) {
    const c = colour?.(i) ?? { extra7: false, extra9: false }
    const p = parseToken(toks[i]!, key, barsPerChord, c.extra7, c.extra9)
    if (!p) return { error: `bad chord token '${toks[i]}'` }
    if (!(p.bars > 0) || Math.round(p.bars * 2) !== p.bars * 2) return { error: `bad duration in '${toks[i]}'` }
    out.push(p)
    bars += p.bars
  }
  return { chords: out, bars }
}

// ---- voicing ---------------------------------------------------------------

/** Pitch classes a chord sounds (root first). */
export function chordPcs(c: Chord): number[] {
  return c.tones.map(t => (c.root + t) % 12)
}

/** Chord tones as MIDI notes in [lo, hi]. */
export function chordTonesIn(c: Chord, lo: number, hi: number): number[] {
  const pcs = new Set(chordPcs(c))
  const out: number[] = []
  for (let m = lo; m <= hi; m++) if (pcs.has(m % 12)) out.push(m)
  return out
}

/** Scale tones as MIDI notes in [lo, hi]. */
export function scaleTonesIn(pcs: number[], lo: number, hi: number): number[] {
  const set = new Set(pcs)
  const out: number[] = []
  for (let m = lo; m <= hi; m++) if (set.has(m % 12)) out.push(m)
  return out
}

/**
 * Pad voicing with smooth voice leading: choose which tones to keep (drop
 * the fifth first when there are more than `voices`), place each in
 * [lo, hi], and pick the placement with the least total movement from
 * `prev`. Without `prev`, prefer a voicing centred in the range. Avoids
 * seconds below middle C.
 */
export function voiceLead(prev: number[] | null, c: Chord, voices = 4, lo = 52, hi = 76): number[] {
  let pcs = chordPcs(c)
  if (pcs.length > voices) {
    const fifth = (c.root + 7) % 12
    pcs = pcs.filter(p => p !== fifth)
  }
  if (pcs.length > voices) pcs = [pcs[0]!, ...pcs.slice(pcs.length - voices + 1)]
  const options = pcs.map(pc => {
    const o: number[] = []
    for (let m = lo; m <= hi; m++) if (m % 12 === pc) o.push(m)
    return o
  })
  let best: number[] = []
  let bestCost = Infinity
  const centre = (lo + hi) / 2
  const pick: number[] = []
  const walk = (i: number): void => {
    if (i === options.length) {
      const v = [...pick].sort((a, b) => a - b)
      for (let k = 1; k < v.length; k++) {
        const gap = v[k]! - v[k - 1]!
        if (gap < 2) return
        if (gap < 3 && v[k - 1]! < 60) return
      }
      if (v[v.length - 1]! - v[0]! > 19) return
      let cost = 0
      if (prev && prev.length) {
        const p = [...prev].sort((a, b) => a - b)
        for (let k = 0; k < v.length; k++) cost += Math.abs(v[k]! - (p[Math.min(k, p.length - 1)] ?? v[k]!))
      } else {
        const mean = v.reduce((a, b) => a + b, 0) / v.length
        cost = Math.abs(mean - centre) * 2 + (v[v.length - 1]! - v[0]!) * 0.1
      }
      if (cost < bestCost) { bestCost = cost; best = v }
      return
    }
    for (const m of options[i]!) { pick.push(m); walk(i + 1); pick.pop() }
  }
  walk(0)
  if (!best.length) {
    // Range too tight for the rules: stack the tones upward from lo.
    best = pcs.map(pc => lo + ((pc - lo) % 12 + 12) % 12).sort((a, b) => a - b)
  }
  return best
}

/** The MIDI note in `candidates` nearest to `target` (ties go down). */
export function nearest(candidates: number[], target: number): number {
  let best = candidates[0] ?? target
  for (const c of candidates) if (Math.abs(c - target) < Math.abs(best - target)) best = c
  return best
}

/** Does this pitch class clash (a semitone above a chord tone) on a strong beat? */
export function isAvoid(pc: number, c: Chord): boolean {
  const pcs = chordPcs(c)
  return pcs.some(t => (pc - t + 12) % 12 === 1)
}
