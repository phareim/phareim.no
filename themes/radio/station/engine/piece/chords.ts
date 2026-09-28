// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * A piece's harmony: its per-phrase progressions laid out bar by bar over
 * the loop, in the radio's chord-token grammar. Tokens without a quality are
 * diatonic in the piece's mode, as in the radio. Chords are taken as written
 * (no added colour tones).
 */
import type { Chord, ChordSpan, Key, Mode } from '../types.ts'
import { parseProgression, parseToken } from '../theory.ts'
import type { Piece } from './types.ts'
import { PIECE_PHRASE_BARS } from './types.ts'

const cache = new Map<string, ChordSpan[][]>()

/** The chord spans of one bar at `pos` bars into a parsed progression (cycling). */
function barOf(tokens: Array<{ chord: Chord; bars: number }>, total: number, pos: number): ChordSpan[] {
  const at = ((pos % total) + total) % total
  const spans: ChordSpan[] = []
  let t = 0
  for (const tok of tokens) {
    const s = t
    const e = t + tok.bars
    t = e
    if (e <= at || s >= at + 1) continue
    const from = Math.round((Math.max(s, at) - at) * 16)
    const to = Math.round((Math.min(e, at + 1) - at) * 16)
    if (to > from) spans.push({ from, len: to - from, chord: tok.chord })
  }
  return spans.length ? spans : [{ from: 0, len: 16, chord: tokens[0]!.chord }]
}

/** The spans of an eight-bar phrase from one progression (the tonic when it does not parse). */
export function progressionSpans(chords: string, key: Key, chordBars = 2): ChordSpan[][] {
  const parsed = parseProgression(chords, key, chordBars)
  const bars: ChordSpan[][] = []
  for (let b = 0; b < PIECE_PHRASE_BARS; b++) {
    if ('error' in parsed || !(parsed.bars > 0)) bars.push([{ from: 0, len: 16, chord: parseToken('1', key)!.chord }])
    else bars.push(barOf(parsed.chords, parsed.bars, b))
  }
  return bars
}

/** Per loop bar, the chord spans of that bar (steps 0..16). */
export function phraseSpans(piece: Piece): ChordSpan[][] {
  const key: Key = { tonic: piece.tonic, mode: piece.mode }
  const ck = `${piece.tonic}|${piece.mode}|${piece.chordBars ?? 2}|${piece.phrases}|${piece.chords.join('\n')}`
  const hit = cache.get(ck)
  if (hit) return hit
  const out: ChordSpan[][] = []
  for (let p = 0; p < piece.phrases; p++) out.push(...progressionSpans(piece.chords[p] ?? '1', key, piece.chordBars ?? 2))
  if (cache.size > 64) cache.clear()
  cache.set(ck, out)
  return out
}

/** The chord sounding at a step of a loop bar. */
export function chordAt(piece: Piece, loopBar: number, step: number): Chord {
  const all = phraseSpans(piece)
  const spans = all[((loopBar % all.length) + all.length) % all.length]!
  let c = spans[0]!.chord
  for (const s of spans) if (s.from <= step) c = s.chord
  return c
}

/** The scale's chords for the chord chips: triads on degrees 1..7, then their diatonic 7ths. */
export function diatonicChords(tonic: number, mode: Mode): Array<{ token: string; chord: Chord }> {
  const key: Key = { tonic, mode }
  const out: Array<{ token: string; chord: Chord }> = []
  for (const ext of ['', '7']) {
    for (let d = 1; d <= 7; d++) {
      const token = `${d}${ext}`
      out.push({ token, chord: parseToken(token, key)!.chord })
    }
  }
  return out
}
