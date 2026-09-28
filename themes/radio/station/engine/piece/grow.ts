// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Growing: the radio's composer writes a track for a piece. It plays one
 * layer of a landscape (the piece read as one, or another landscape's part
 * for that layer) over the piece's own chords, bar by bar with its memory
 * carried across the loop, and the result is written down in bar notation.
 */
import type { DrumEvent, Groove, Landscape, Layer, NoteEvent, VoiceId } from '../types.ts'
import { LAYERS } from '../types.ts'
import { composeBar, makeMotif, newMemory, varyMotif } from '../composer.ts'
import type { Motif, PhraseShape } from '../composer.ts'
import { createRng, hashSeed } from '../rng.ts'
import { scalePcs } from '../theory.ts'
import type { Instrument, Level, Piece, PieceNote, Track } from './types.ts'
import { PIECE_PHRASE_BARS } from './types.ts'
import { formatDrumBar, formatNoteBar } from './notation.ts'
import { phraseSpans } from './chords.ts'
import { pieceToLandscape, withLayerSpec } from './derive.ts'

export interface GrowOptions {
  lookup: (id: string) => Landscape | undefined
  seed?: number
  /** A landscape id whose part for this layer to borrow. */
  from?: string
  /** The track's ladder level; defaults to the level it is grown at. */
  enter?: Level
}

const SHAPE_WEIGHTS = { A: [2, 2, 1], A2: [1, 1, 2], B: [1, 1, 1] }
/** Lead register per phrase kind, in semitones from the centre of its range. */
const LIFT = { A: -2, A2: 3, B: -2 }

/** A stable seed from a string (FNV-1a). */
export function stringSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** L with `from`'s part for one layer. */
function borrow(L: Landscape, from: Landscape, layer: Layer): Landscape {
  switch (layer) {
    case 'drums': return { ...L, drums: { ...from.drums, perc: L.drums.perc } }
    case 'perc': return from.drums.perc ? { ...L, drums: { ...L.drums, kit: from.drums.kit, perc: from.drums.perc } } : L
    case 'bass': return { ...L, bass: from.bass }
    case 'pad': return { ...L, pad: from.pad }
    case 'drone': case 'arp': case 'lead': case 'counter': case 'bells':
      return from[layer] ? { ...L, [layer]: from[layer] } : L
    default: return L
  }
}

function voiceOf(L: Landscape, layer: Layer): VoiceId | undefined {
  switch (layer) {
    case 'pad': return L.pad.voice
    case 'bass': return L.bass.voice
    case 'drone': case 'arp': case 'lead': case 'counter': case 'bells': return L[layer]?.voice
    default: return undefined
  }
}

function instrumentFor(layer: Layer): Instrument {
  return layer === 'bass' ? 'bass' : layer === 'drums' || layer === 'perc' ? 'drums' : layer === 'lead' ? 'touch' : 'piano'
}

function uniqueId(piece: Piece, layer: Layer): string {
  const taken = new Set(piece.tracks.map(t => t.id))
  let id: string = layer
  for (let n = 2; taken.has(id); n++) id = `${layer}-${n}`
  return id
}

/** Drum events as a groove: X from 0.9, x from 0.5, else g; a riser holds with '-'. */
function eventsToGroove(events: DrumEvent[]): Groove {
  const rows: Partial<Record<string, string[]>> = {}
  const rank: Record<string, number> = { '.': 0, '-': 1, g: 2, x: 3, X: 4 }
  for (const e of events) {
    const row = rows[e.hit] ??= Array(16).fill('.')
    const ch = e.vel >= 0.9 ? 'X' : e.vel >= 0.5 ? 'x' : 'g'
    const s = Math.round(e.step)
    if (s < 16 && rank[ch]! > rank[row[s]!]!) row[s] = ch
    if (e.hit === 'z') for (let k = s + 1; k < Math.min(16, s + (e.len ?? 1)); k++) if (row[k] === '.') row[k] = '-'
  }
  return Object.fromEntries(Object.entries(rows).map(([h, r]) => [h, r!.join('')])) as Groove
}

/** Compose one layer over the piece's loop with landscape L at a pattern level. */
function grow(piece: Piece, layer: Layer, level: Level, enter: Level, L: Landscape, seed: number): Track {
  if (layer === 'ambience') throw new Error('ambience is not a track')
  const G: Landscape = { ...withLayerSpec(L, layer), layers: [[layer], [layer], [layer], [layer], [layer]] }
  const spans = phraseSpans(piece)
  const n = spans.length
  const key = { tonic: piece.tonic, mode: piece.mode }
  const scale = scalePcs(key)
  const master = createRng(seed)
  const density = 0.5

  // The radio's form over the loop: phrases on the opening chords state the
  // theme (varied from the third phrase on), other phrases get a contrast motif.
  const theme = makeMotif(G, master.fork(1), density, 1)
  const varied = varyMotif(theme, G, master.fork(2), density)
  const contrast = new Map<string, Motif>()
  const motifs = piece.chords.map((c, p) => {
    if (c === piece.chords[0]) return p < 2 ? theme : varied
    if (!contrast.has(c)) contrast.set(c, makeMotif(G, master.fork(10 + p), density, 0.35))
    return contrast.get(c)!
  })
  const motifsB = motifs.map((m, p) => varyMotif(m, G, master.fork(20 + p), density))
  // Each phrase's shape and register, as the radio picks them per section:
  // the theme low and plain, its return higher and more developed, contrast
  // phrases low. No 'call': a grown track plays alone, with no line to answer.
  const phrasePlans = piece.chords.map((c, p) => {
    const kind = c !== piece.chords[0] ? 'B' : p < 2 ? 'A' : 'A2'
    const shape = master.fork(40 + p).weighted<PhraseShape>(['classic', 'period', 'sentence'], SHAPE_WEIGHTS[kind])
    return { shape, lift: LIFT[kind] }
  })
  const fills = piece.chords.map((_, p) => p === piece.phrases - 1 || p % 2 === 1 || master.fork(30 + p).chance(0.3))
  const drumsLayer = layer === 'drums'

  const mem = newMemory()
  const bars: string[] = []
  // Two passes: the first warms the memory (voicing, melody) so bar 0 follows the loop's last bar.
  for (let pass = 0; pass < 2; pass++) {
    for (let b = 0; b < n; b++) {
      const p = Math.floor(b / PIECE_PHRASE_BARS)
      const pb = b % PIECE_PHRASE_BARS
      const nextChord = spans[(b + 1) % n]![0]!.chord
      // The bass walks into a new chord at the end of a phrase, as on the radio.
      const walk = pb === PIECE_PHRASE_BARS - 1 && level >= 2 && nextChord.bass !== spans[b]![spans[b]!.length - 1]!.chord.bass
      const out = composeBar({
        L: G, key, scale, spans: spans[b]!, next: nextChord, level, density,
        rng: createRng(hashSeed(seed, b + 1000)), phraseBar: pb, phraseBars: PIECE_PHRASE_BARS,
        motif: motifs[p]!, motifB: motifsB[p]!, leadOn: true,
        shape: phrasePlans[p]!.shape, lift: phrasePlans[p]!.lift, walk,
        fill: drumsLayer && pb === PIECE_PHRASE_BARS - 1 && fills[p]!, pickup: false, crash: drumsLayer && b === 0,
        present: new Set<Layer>([layer]), mem, mood: 0.5,
      })
      if (pass === 0) continue
      if (layer === 'drums' || layer === 'perc') {
        bars.push(formatDrumBar(eventsToGroove(out.drums.filter(d => d.layer === layer))))
      } else {
        const notes: PieceNote[] = out.notes.filter((x: NoteEvent) => x.layer === layer).map(x => ({ step: x.step, midi: x.midi, len: x.len, vel: x.vel }))
        bars.push(formatNoteBar(notes))
      }
    }
  }

  const track: Track = {
    id: uniqueId(piece, layer),
    name: layer[0]!.toUpperCase() + layer.slice(1),
    layer,
    instrument: instrumentFor(layer),
    enter,
    source: 'grown',
    bars,
  }
  if (layer === 'drums' || layer === 'perc') track.kit = G.drums.kit
  else track.voice = voiceOf(G, layer)
  return track
}

/**
 * Grow one layer of a piece at an intensity level: the piece read as a
 * landscape over its base, or `from`'s part for this layer.
 */
export function growLayer(piece: Piece, layer: Layer, level: Level, opts: GrowOptions): Track {
  const base = piece.base ? opts.lookup(piece.base) : undefined
  let L = pieceToLandscape(piece, base, { written: false })
  const from = opts.from ? opts.lookup(opts.from) : undefined
  if (from) L = borrow(L, from, layer)
  const seed = hashSeed(opts.seed ?? stringSeed(piece.id), LAYERS.indexOf(layer) + 1)
  return grow(piece, layer, level, opts.enter ?? level, L, seed)
}

/**
 * Grow the layers the base's ladder (base ?? 'coast') brings in that no
 * track covers, each entering where the ladder brings it in and playing the
 * pattern the radio plays at the piece's intensity (or at its entry, when
 * that is higher). Returns only the new tracks.
 */
export function growLadder(piece: Piece, opts: { lookup: GrowOptions['lookup']; seed?: number }): Track[] {
  const ladder = opts.lookup(piece.base ?? 'coast') ?? opts.lookup('coast')
  if (!ladder) return []
  const L = pieceToLandscape(piece, ladder, { written: false })
  const covered = new Set<Layer>(piece.tracks.map(t => t.layer))
  const out: Track[] = []
  let acc = piece
  const seed = opts.seed ?? stringSeed(piece.id)
  for (let lvl = 0; lvl < 5; lvl++) {
    for (const layer of ladder.layers[lvl]!) {
      if (layer === 'ambience' || covered.has(layer)) continue
      covered.add(layer)
      const level = Math.max(lvl, piece.intensity) as Level
      const t = grow(acc, layer, level, lvl as Level, L, hashSeed(seed, LAYERS.indexOf(layer) + 1))
      out.push(t)
      acc = { ...acc, tracks: [...acc.tracks, t] }
    }
  }
  return out
}
