// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Written phrases (Landscape.written): phrases written note for note in jam
 * that the conductor quotes now and then between its generated sections.
 * Here: the phrases parsed once per landscape, their chords, the mapping of
 * written pitches into the key that sounds, and one bar of a quote as events.
 */
import type {
  ChordSpan, DrumEvent, DrumHit, Groove, Key, KitId, Landscape, Layer, NoteEvent, WrittenPart, WrittenPhrase,
} from './types.ts'
import { chordPcs, MODE_STEPS } from './theory.ts'
import { PAN } from './composer.ts'
import { parseDrumBar, parseNoteBar } from './piece/notation.ts'
import { progressionSpans } from './piece/chords.ts'
import type { PieceNote } from './piece/types.ts'

/** How often a section quotes when a landscape has written phrases and no `quote`. */
export const DEFAULT_QUOTE = 0.35
/** A written phrase lasts eight bars. */
export const WRITTEN_BARS = 8

export interface PreparedPart {
  part: WrittenPart
  /** Per bar: parsed notes (note parts) or grooves (kit parts); a bad bar is empty. */
  notes: PieceNote[][]
  grooves: Groove[]
}

export interface PreparedPhrase {
  phrase: WrittenPhrase
  /** Position in Landscape.written. */
  index: number
  parts: PreparedPart[]
  /** The layers the phrase has a part on: the composer stays off them while it is quoted. */
  layers: ReadonlySet<Layer>
}

const prepared = new WeakMap<Landscape, PreparedPhrase[]>()

/** The landscape's written phrases, parsed (cached per landscape object). */
export function preparedWritten(L: Landscape): PreparedPhrase[] {
  if (!L.written?.length) return []
  let out = prepared.get(L)
  if (out) return out
  out = L.written.map((phrase, index) => {
    const parts = phrase.parts.map(part => {
      const bars = Array.from({ length: WRITTEN_BARS }, (_, i) => part.bars[i] ?? '')
      return {
        part,
        notes: part.kit ? [] : bars.map(b => { const r = parseNoteBar(b); return 'error' in r ? [] : r.notes }),
        grooves: part.kit ? bars.map(b => { const r = parseDrumBar(b); return 'error' in r ? {} : r.groove }) : [],
      }
    })
    return { phrase, index, parts, layers: new Set(phrase.parts.map(p => p.layer)) }
  })
  prepared.set(L, out)
  return out
}

/** The key written phrases are written in: the landscape's tonic, in its mode at mood 0.5. */
export function writtenKey(L: Landscape, modeAt: (mood: number) => Key['mode']): Key {
  return { tonic: L.tonic, mode: modeAt(0.5) }
}

const spanCache = new Map<string, ChordSpan[][]>()

/** The chord spans of bar `bar` (0..7) of a written phrase, heard in `key` (chords as written, no added colour). */
export function writtenSpans(phrase: WrittenPhrase, key: Key, bar: number): ChordSpan[] {
  const bpc = phrase.chordBars ?? 2
  const k = `${key.tonic}|${key.mode}|${bpc}|${phrase.chords}`
  let bars = spanCache.get(k)
  if (!bars) {
    bars = progressionSpans(phrase.chords, key, bpc)
    if (spanCache.size > 256) spanCache.clear()
    spanCache.set(k, bars)
  }
  return bars[((bar % WRITTEN_BARS) + WRITTEN_BARS) % WRITTEN_BARS]!
}

/**
 * A written pitch moved from the key it was written in into the key that
 * sounds. A note that is a tone of the chord sounding under it stays (so
 * notes over chords with a written quality, like a major V in minor, keep
 * fitting them); other scale notes move by scale degree; chromatic notes
 * keep their pitch. A different tonic transposes first (by at most a
 * tritone).
 */
export function mapPitch(midi: number, from: Key, to: Key, chordPcsHere?: readonly number[]): number {
  let shift = (((to.tonic - from.tonic) % 12) + 12) % 12
  if (shift > 6) shift -= 12
  const m = midi + shift
  if (from.mode === to.mode) return m
  if (chordPcsHere?.includes(((m % 12) + 12) % 12)) return m
  const rel = (((m - to.tonic) % 12) + 12) % 12
  const a = MODE_STEPS[from.mode]
  const d = a.indexOf(rel)
  return d < 0 ? m : m + MODE_STEPS[to.mode][d]! - a[d]!
}

const DRUM_VEL: Record<string, number> = { X: 1, x: 0.8, g: 0.35 }

/** Drum events of a groove row by row: X 1.0, x 0.8, g 0.35; a riser lasts its '-' run. */
export function grooveHits(g: Groove, layer: 'drums' | 'perc', kit: KitId, gain = 1): DrumEvent[] {
  const out: DrumEvent[] = []
  for (const [hit, row] of Object.entries(g)) {
    if (!row) continue
    for (let s = 0; s < 16; s++) {
      const ch = row[s]!
      const v = DRUM_VEL[ch]
      if (v === undefined) continue
      const ev: DrumEvent = { layer, kit, hit: hit as DrumHit, step: s, vel: Math.min(1, v * gain) }
      if (hit === 'z') {
        let len = 1
        while (s + len < 16 && row[s + len] === '-') len++
        ev.len = len
      }
      out.push(ev)
    }
  }
  return out
}

/** Note events of a note bar: velocity × gain, the composer's pan for the layer, legato for the glide lead. */
export function noteEvents(ns: PieceNote[], layer: Layer, voice: NoteEvent['voice'], gain = 1, pitch: (n: PieceNote) => number = n => n.midi): NoteEvent[] {
  const out: NoteEvent[] = []
  const glide = voice === 'lead.glide'
  let prevStart = -1
  let prevEnd = -1
  for (const x of ns) {
    const ev: NoteEvent = { layer, voice, midi: pitch(x), step: x.step, len: x.len, vel: Math.min(1, x.vel * gain) }
    const pan = PAN[layer]
    if (pan !== undefined) ev.pan = pan
    if (glide && prevStart < x.step && prevEnd >= x.step) ev.opts = { legato: true }
    prevStart = x.step
    prevEnd = Math.max(prevEnd, x.step + x.len)
    out.push(ev)
  }
  return out
}

function chordPcsAt(spans: ChordSpan[], step: number): number[] {
  let c = spans[0]!.chord
  for (const s of spans) if (s.from <= step) c = s.chord
  return chordPcs(c)
}

/**
 * One bar of a quoted phrase: the parts that sound, i.e. whose layer is on
 * (`present`) and whose `enter` is at or below the pattern `level`. Notes
 * move from `from` (the written key) into `to` (the key that sounds) against
 * `spans`, the chords of this bar in `to`. Drums play as written.
 */
export function writtenBar(
  pp: PreparedPhrase, bar: number, level: number, present: ReadonlySet<Layer>, from: Key, to: Key, spans: ChordSpan[],
): { notes: NoteEvent[]; drums: DrumEvent[] } {
  const notes: NoteEvent[] = []
  const drums: DrumEvent[] = []
  const i = ((bar % WRITTEN_BARS) + WRITTEN_BARS) % WRITTEN_BARS
  for (const { part, notes: ns, grooves } of pp.parts) {
    if (!present.has(part.layer) || part.enter > level) continue
    const gain = part.gain ?? 1
    if (part.kit) {
      drums.push(...grooveHits(grooves[i] ?? {}, part.layer === 'perc' ? 'perc' : 'drums', part.kit, gain))
    } else if (part.voice) {
      notes.push(...noteEvents(ns[i] ?? [], part.layer, part.voice, gain, n => mapPitch(n.midi, from, to, chordPcsAt(spans, n.step))))
    }
  }
  return { notes, drums }
}
