// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * validatePiece: checks a Piece from any source (the app, the store, Opus)
 * and returns a normalised copy. Messages name the field, track, bar and
 * token so Opus can repair its own output.
 */
import { AMBIENCE_IDS, KIT_IDS, LAYER_IDS, MODE_IDS, VOICE_IDS } from '../catalog.ts'
import { parseProgression } from '../theory.ts'
import type { Piece, Track } from './types.ts'
import { PIECE_PHRASE_BARS } from './types.ts'
import { noteName, parseDrumBar, parseNoteBar } from './notation.ts'

export interface PieceValidation {
  ok: boolean
  errors: string[]
  piece?: Piece
}

export const MAX_TRACKS = 24
export const MAX_BAR_CHARS = 600

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const int = (x: unknown, lo: number, hi: number): boolean => num(x) && Number.isInteger(x) && x >= lo && x <= hi

const PIECE_KEYS = ['v', 'id', 'name', 'tonic', 'mode', 'bpm', 'swing', 'phrases', 'chords', 'chordBars', 'tracks', 'intensity', 'base', 'fx', 'ambience', 'feel', 'channel']
const TRACK_KEYS = ['id', 'name', 'layer', 'voice', 'kit', 'instrument', 'enter', 'gain', 'mute', 'solo', 'source', 'bars']
const SOURCES = ['played', 'written', 'library', 'grown', 'opus']
const INSTRUMENTS = ['piano', 'guitar', 'bass', 'drums', 'touch']
const FX_RANGES: Record<string, [number, number]> = { reverb: [0, 1], delay: [0, 1], tone: [0, 1], grit: [0, 1], pump: [0, 1], reverbSize: [0.8, 10] }

/** Keep only the listed keys (drops fields no one reads). */
function pick<T>(o: Record<string, unknown>, keys: string[]): T {
  const out: Record<string, unknown> = {}
  for (const k of keys) if (o[k] !== undefined) out[k] = o[k]
  return out as T
}

function checkTrack(t: unknown, i: number, bars: number, err: (m: string) => void): Track | null {
  if (!isObj(t)) { err(`tracks[${i}]: not an object`); return null }
  const tr = pick<Track>(t, TRACK_KEYS)
  const idOk = typeof tr.id === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(tr.id)
  const at = idOk ? `tracks[${i}] '${tr.id}'` : `tracks[${i}]`
  if (!idOk) err(`${at}.id: [A-Za-z0-9_-]{1,32}`)
  if (typeof tr.name !== 'string' || tr.name.length > 40) err(`${at}.name: string of at most 40 chars`)
  if (!LAYER_IDS.includes(tr.layer) || tr.layer === 'ambience') err(`${at}.layer: one of ${LAYER_IDS.filter(l => l !== 'ambience').join('|')}`)
  const hasVoice = tr.voice !== undefined
  const hasKit = tr.kit !== undefined
  if (hasVoice === hasKit) err(`${at}: exactly one of voice (note bars) and kit (drum bars)`)
  if (hasVoice && !VOICE_IDS.includes(tr.voice!)) err(`${at}.voice: unknown voice '${String(tr.voice)}'`)
  if (hasKit) {
    if (!KIT_IDS.includes(tr.kit!)) err(`${at}.kit: one of ${KIT_IDS.join('|')}`)
    if (tr.layer !== 'drums' && tr.layer !== 'perc') err(`${at}: a kit track plays on layer 'drums' or 'perc'`)
  }
  if (tr.instrument !== undefined && !INSTRUMENTS.includes(tr.instrument)) err(`${at}.instrument: one of ${INSTRUMENTS.join('|')}`)
  if (!int(tr.enter, 0, 4)) err(`${at}.enter: integer 0..4`)
  if (tr.gain !== undefined && (!num(tr.gain) || tr.gain < 0 || tr.gain > 1.5)) err(`${at}.gain: 0..1.5`)
  if (tr.mute !== undefined && typeof tr.mute !== 'boolean') err(`${at}.mute: boolean`)
  if (tr.solo !== undefined && typeof tr.solo !== 'boolean') err(`${at}.solo: boolean`)
  if (!SOURCES.includes(tr.source)) err(`${at}.source: one of ${SOURCES.join('|')}`)
  if (!Array.isArray(tr.bars) || tr.bars.length !== bars) { err(`${at}.bars: ${bars} strings (phrases × 8), got ${Array.isArray(tr.bars) ? tr.bars.length : 'none'}`); return tr }
  tr.bars = [...tr.bars]
  tr.bars.forEach((b, j) => {
    if (typeof b !== 'string') { err(`${at} bar ${j}: not a string`); return }
    if (b.length > MAX_BAR_CHARS) { err(`${at} bar ${j}: ${b.length} chars (max ${MAX_BAR_CHARS})`); return }
    if (hasKit) {
      const r = parseDrumBar(b)
      if ('error' in r) err(`${at} bar ${j}: ${r.error}`)
    } else if (hasVoice) {
      const r = parseNoteBar(b)
      if ('error' in r) err(`${at} bar ${j}: ${r.error}`)
      else {
        const off = r.notes.find(n => n.midi < 12 || n.midi > 120)
        if (off) err(`${at} bar ${j}: note ${noteName(off.midi)} out of range C0..C9`)
      }
    }
  })
  return tr
}

/** Check a piece; `piece` is a normalised copy when ok. */
export function validatePiece(input: unknown): PieceValidation {
  const errors: string[] = []
  const err = (m: string) => errors.push(m)
  if (!isObj(input)) return { ok: false, errors: ['not an object'] }
  const P = pick<Piece>(structuredClone(input), PIECE_KEYS)

  if (P.v !== 1) err('v: 1')
  if (typeof P.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(P.id)) err('id: [A-Za-z0-9_-]{1,40}')
  if (typeof P.name !== 'string' || P.name.length > 60) err('name: string of at most 60 chars')
  if (!int(P.tonic, 0, 11)) err('tonic: integer 0..11 (C = 0)')
  if (!MODE_IDS.includes(P.mode)) err(`mode: one of ${MODE_IDS.join('|')}`)
  if (!num(P.bpm) || P.bpm < 50 || P.bpm > 200) err('bpm: 50..200')
  if (!num(P.swing) || P.swing < 0 || P.swing > 0.5) err('swing: 0..0.5')
  const phrasesOk = int(P.phrases, 1, 4)
  if (!phrasesOk) err('phrases: 1, 2, 3 or 4')
  if (P.chordBars !== undefined && P.chordBars !== 1 && P.chordBars !== 2) err('chordBars: 1 or 2')
  if (!int(P.intensity, 0, 4)) err('intensity: integer 0..4')

  if (!Array.isArray(P.chords)) err('chords: one progression string per phrase')
  else {
    if (phrasesOk && P.chords.length !== P.phrases) err(`chords: ${P.phrases} progressions (one per phrase), got ${P.chords.length}`)
    const mode = MODE_IDS.includes(P.mode) ? P.mode : 'ionian'
    const bpc = P.chordBars === 1 ? 1 : 2
    P.chords.forEach((c, i) => {
      if (typeof c !== 'string') { err(`chords[${i}]: string`); return }
      const r = parseProgression(c, { tonic: int(P.tonic, 0, 11) ? P.tonic : 0, mode }, bpc)
      if ('error' in r) err(`chords[${i}]: ${r.error}`)
      else if (r.bars !== PIECE_PHRASE_BARS) err(`chords[${i}]: '${c}' lasts ${r.bars} bars (needs exactly 8; tokens without ':n' last chordBars = ${bpc})`)
    })
  }

  if (!Array.isArray(P.tracks)) err('tracks: list')
  else {
    if (P.tracks.length > MAX_TRACKS) err(`tracks: at most ${MAX_TRACKS}, got ${P.tracks.length}`)
    const bars = phrasesOk ? P.phrases * PIECE_PHRASE_BARS : -1
    const seen = new Set<string>()
    P.tracks = P.tracks.slice(0, MAX_TRACKS).map((t, i) => {
      const tr = checkTrack(t, i, bars, err)
      if (tr && typeof tr.id === 'string') {
        if (seen.has(tr.id)) err(`tracks[${i}]: id '${tr.id}' used twice`)
        seen.add(tr.id)
      }
      return tr as Track
    })
  }

  if (P.base !== undefined && (typeof P.base !== 'string' || !/^[a-z0-9][a-z0-9-]{0,60}$/.test(P.base))) err('base: a landscape id')
  if (P.channel !== undefined && (typeof P.channel !== 'string' || !/^[a-z0-9][a-z0-9-]{0,60}$/.test(P.channel))) err('channel: a landscape id')
  if (P.fx !== undefined) {
    if (!isObj(P.fx)) err('fx: object')
    else for (const [k, v] of Object.entries(P.fx)) {
      const range = FX_RANGES[k]
      if (!range) err(`fx: unknown '${k}' (${Object.keys(FX_RANGES).join('|')})`)
      else if (!num(v) || v < range[0] || v > range[1]) err(`fx.${k}: ${range[0]}..${range[1]}`)
    }
  }
  if (P.ambience !== undefined) {
    if (!isObj(P.ambience)) err('ambience: object')
    else for (const [k, v] of Object.entries(P.ambience)) {
      if (!AMBIENCE_IDS.includes(k as never)) err(`ambience: unknown '${k}'`)
      if (!num(v) || v < 0 || v > 1) err(`ambience.${k}: 0..1`)
    }
  }
  if (P.feel !== undefined) {
    const f = P.feel as unknown
    if (!isObj(f) || !Array.isArray(f.messages) || typeof f.brief !== 'string') err('feel: { messages: [...], brief: string }')
    else f.messages.forEach((m, i) => {
      if (!isObj(m) || (m.role !== 'petter' && m.role !== 'opus') || typeof m.text !== 'string' || (m.at !== undefined && typeof m.at !== 'string')) {
        err(`feel.messages[${i}]: { role: 'petter'|'opus', text, at? }`)
      }
    })
  }

  return errors.length ? { ok: false, errors } : { ok: true, errors: [], piece: P }
}

