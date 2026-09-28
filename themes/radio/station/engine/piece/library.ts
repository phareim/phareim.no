// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The radio's patterns as a library for jam, and pieces made from
 * landscapes: a starting piece is a landscape's progressions laid out over
 * one or two phrases with its whole ladder grown as tracks.
 */
import type { KitId, Landscape, Mode, VoiceId } from '../types.ts'
import { INTENSITY_NAMES } from '../catalog.ts'
import { modeFor } from '../conductor.ts'
import { parseToken } from '../theory.ts'
import type { Instrument, Level, Piece, Track } from './types.ts'
import { PIECE_PHRASE_BARS, PIECE_VERSION } from './types.ts'
import { formatDrumBar } from './notation.ts'
import { growLadder } from './grow.ts'

export interface LibraryItem {
  id: string
  name: string
  kind: 'drums' | 'perc' | 'bass' | 'arp' | 'lead' | 'pad'
  /** The landscape it comes from. */
  from: string
  level: Level
  kit?: KitId
  voice?: VoiceId
  /** A drum bar for drums and perc; the rest are grown with growLayer(..., { from }). */
  bar?: string
}

/** Where a new track for each instrument goes and what it sounds like, until the player picks. */
export const INSTRUMENT_DEFAULTS: Record<Instrument, Pick<Track, 'layer' | 'voice' | 'kit'>> = {
  piano: { layer: 'pad', voice: 'keys.piano' },
  guitar: { layer: 'arp', voice: 'guitar.nylon' },
  bass: { layer: 'bass', voice: 'bass.finger' },
  drums: { layer: 'drums', kit: 'kit.soft' },
  touch: { layer: 'lead', voice: 'lead.glide' },
}

/** Drum and perc grooves (one per distinct groove and level, plus fills) and one bass/arp/lead/pad part per landscape. */
export function patternLibrary(landscapes: Landscape[]): LibraryItem[] {
  const out: LibraryItem[] = []
  for (const L of landscapes) {
    const kit = L.drums.kit
    const first = (layer: string): Level => Math.max(0, L.layers.findIndex(ls => ls.includes(layer as never))) as Level
    const grooves = (kind: 'drums' | 'perc', list: Landscape['drums']['grooves'] | undefined) => {
      const seen = new Set<string>()
      list?.forEach((g, lvl) => {
        const bar = formatDrumBar(g)
        if (!bar || seen.has(bar)) return
        seen.add(bar)
        const name = `${L.name} ${INTENSITY_NAMES[lvl]}${kind === 'perc' ? ' perc' : ''}`
        out.push({ id: `${L.id}:${kind}:${lvl}`, name, kind, from: L.id, level: lvl as Level, kit, bar })
      })
    }
    grooves('drums', L.drums.grooves)
    const fill = formatDrumBar(L.drums.fill)
    if (fill) out.push({ id: `${L.id}:fill`, name: `${L.name} fill`, kind: 'drums', from: L.id, level: first('drums'), kit, bar: fill })
    grooves('perc', L.drums.perc)
    const parts: Array<[LibraryItem['kind'], VoiceId | undefined]> = [
      ['bass', L.bass.voice], ['arp', L.arp?.voice], ['lead', L.lead?.voice], ['pad', L.pad.voice],
    ]
    for (const [kind, voice] of parts) {
      if (!voice) continue
      out.push({ id: `${L.id}:${kind}`, name: `${L.name} ${kind}`, kind, from: L.id, level: first(kind), voice })
    }
  }
  return out
}

/**
 * A progression laid out over exactly eight bars (repeating, the last chord
 * cut at the phrase end), with an explicit ':n' on every token that does not
 * last `chordBars`.
 */
export function phraseChords(chords: string, barsPerChord: number, key: { tonic: number; mode: Mode }, chordBars: 1 | 2): string {
  const toks = chords.trim().split(/\s+/).map(t => {
    const p = parseToken(t, key, barsPerChord)
    return { t: t.replace(/:[\d.]+$/, ''), bars: p?.bars ?? barsPerChord }
  })
  const out: string[] = []
  let at = 0
  for (let i = 0; at < PIECE_PHRASE_BARS && i < 64; i++) {
    const tok = toks[i % toks.length]!
    const bars = Math.min(tok.bars, PIECE_PHRASE_BARS - at)
    out.push(bars === chordBars ? tok.t : `${tok.t}:${bars}`)
    at += bars
  }
  return out.join(' ')
}

/**
 * A piece from a radio landscape: its key and mode at the default mood, its
 * first 'a' progression (and a 'b' one for the second phrase), and every
 * layer of its ladder grown as a track.
 */
export function pieceFromLandscape(
  L: Landscape,
  opts: { lookup: (id: string) => Landscape | undefined; phrases?: 1 | 2; level?: Level; seed?: number },
): Piece {
  const mode = modeFor(L, 0.5)
  const key = { tonic: L.tonic, mode }
  const as = L.progressions.filter(p => (p.role ?? 'a') === 'a')
  const first = as[0] ?? L.progressions[0]!
  const second = L.progressions.find(p => p.role === 'b') ?? as[1] ?? first
  const progs = (opts.phrases ?? 2) === 2 ? [first, second] : [first]
  const bpc = first.barsPerChord ?? 1
  const chordBars: 1 | 2 = bpc === 1 ? 1 : 2
  const piece: Piece = {
    v: PIECE_VERSION,
    id: L.id.slice(0, 40),
    name: L.name,
    tonic: L.tonic,
    mode,
    bpm: L.bpm,
    swing: L.swing,
    phrases: progs.length as 1 | 2,
    chords: progs.map(p => phraseChords(p.chords, p.barsPerChord ?? 1, key, chordBars)),
    chordBars,
    tracks: [],
    intensity: opts.level ?? 2,
    base: L.id,
  }
  piece.tracks = growLadder(piece, { lookup: opts.lookup, seed: opts.seed })
  return piece
}

/** A new piece: one phrase of '1 6 4 5', two bars a chord, no tracks, over Night Drive. */
export function emptyPiece(opts: { tonic?: number; mode?: Mode; bpm?: number; id?: string } = {}): Piece {
  return {
    v: PIECE_VERSION,
    id: opts.id ?? 'untitled',
    name: 'Untitled',
    tonic: opts.tonic ?? 9,
    mode: opts.mode ?? 'aeolian',
    bpm: opts.bpm ?? 100,
    swing: 0,
    phrases: 1,
    chords: ['1 6 4 5'],
    chordBars: 2,
    tracks: [],
    intensity: 2,
    base: 'nightdrive',
  }
}
