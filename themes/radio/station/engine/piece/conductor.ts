// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The piece conductor plays a piece on the radio's player: bar n of the
 * plan is loop bar (start + n) mod loopBars, every track sounding at or
 * below the current intensity plays its written bar, and effects and
 * ambience come from the base landscape as the radio shapes them. It plans
 * nothing ahead, so edits (setPiece) and intensity land on the next bar.
 */
import type {
  BarPlan, ConductorLike, Controls, DrumEvent, FxSpec, Groove, Landscape, Layer, NoteEvent,
} from '../types.ts'
import { DEFAULT_CONTROLS, LAYERS } from '../types.ts'
import { scalePcs } from '../theory.ts'
import { shapeFx, thinAmbience } from '../conductor.ts'
import { grooveHits, noteEvents } from '../written.ts'
import type { Piece, PieceNote, Track } from './types.ts'
import { PIECE_PHRASE_BARS } from './types.ts'
import { parseDrumBar, parseNoteBar } from './notation.ts'
import { phraseSpans } from './chords.ts'

export interface PieceConductorOptions {
  piece: Piece
  /** Find a landscape by id (built-in or composed), for the base. */
  lookup: (id: string) => Landscape | undefined
  controls?: Partial<Controls>
  /** Metronome on. */
  click?: boolean
}

export interface PieceConductor extends ConductorLike {
  /** Replace the piece; the next planned bar plays it. */
  setPiece(p: Piece): void
  setClick(on: boolean): void
  /** Make the next planned bar this loop bar. */
  seek(loopBar: number): void
  readonly loopBars: number
  readonly piece: Piece
}

/** Effects when a piece has no base landscape. */
export const NEUTRAL_FX: FxSpec = { reverb: 0.3, delay: 0.2, reverbSize: 3, tone: 0.8, grit: 0.15, pump: 0 }

const CACHE_MAX = 2000
const noteCache = new Map<string, PieceNote[]>()
const drumCache = new Map<string, Groove>()

/** A note bar parsed (cached by string; a bad bar plays nothing). */
export function notesOf(bar: string): PieceNote[] {
  let n = noteCache.get(bar)
  if (!n) {
    const r = parseNoteBar(bar)
    n = 'error' in r ? [] : r.notes
    if (noteCache.size > CACHE_MAX) noteCache.clear()
    noteCache.set(bar, n)
  }
  return n
}

/** A drum bar parsed (cached by string; a bad bar plays nothing). */
export function grooveOf(bar: string): Groove {
  let g = drumCache.get(bar)
  if (!g) {
    const r = parseDrumBar(bar)
    g = 'error' in r ? {} : r.groove
    if (drumCache.size > CACHE_MAX) drumCache.clear()
    drumCache.set(bar, g)
  }
  return g
}

/** Drum events of a groove, X 1.0, x 0.8, g 0.35 (shared with the radio conductor's quotes in ../written.ts). */
export { grooveHits }

/** The tracks sounding at an intensity: entered, not muted, and soloed when any track is. */
export function soundingTracks(piece: Piece, intensity: number): Track[] {
  const solo = piece.tracks.some(t => t.solo)
  return piece.tracks.filter(t => t.enter <= intensity && !t.mute && (!solo || t.solo))
}

export function createPieceConductor(opts: PieceConductorOptions): PieceConductor {
  let piece = opts.piece
  let click = opts.click ?? false
  const controls: Controls = { ...DEFAULT_CONTROLS, intensity: piece.intensity, ...opts.controls }
  let base: Landscape | undefined
  let bar = 0
  /** Loop bar of plan bar 0. */
  let start = 0

  const loopBars = () => piece.phrases * PIECE_PHRASE_BARS
  const refreshBase = () => { base = piece.base ? opts.lookup(piece.base) : undefined }
  refreshBase()

  function setControls(c: Partial<Controls>): void {
    Object.assign(controls, c)
    controls.intensity = Math.max(0, Math.min(4, Math.round(controls.intensity))) as Controls['intensity']
  }

  function nextBar(): BarPlan {
    const n = loopBars()
    const lb = (((start + bar) % n) + n) % n
    const spans = phraseSpans(piece)
    const key = { tonic: piece.tonic, mode: piece.mode }
    const notes: NoteEvent[] = []
    const drums: DrumEvent[] = []
    const active = new Set<Layer>()

    for (const t of soundingTracks(piece, controls.intensity)) {
      const src = t.bars[lb] ?? ''
      if (!src) continue
      const gain = t.gain ?? 1
      if (t.kit) {
        const hits = grooveHits(grooveOf(src), t.layer === 'perc' ? 'perc' : 'drums', t.kit, gain)
        if (hits.length) active.add(t.layer)
        drums.push(...hits)
      } else if (t.voice) {
        const ns = notesOf(src)
        if (ns.length) active.add(t.layer)
        notes.push(...noteEvents(ns, t.layer, t.voice, gain))
      }
    }
    if (click) {
      for (const s of [0, 4, 8, 12]) drums.push({ layer: 'perc', kit: 'kit.chip', hit: 'h', step: s, vel: s === 0 ? 1 : 0.55 })
    }

    const fxSpec: FxSpec = { ...(base?.fx ?? NEUTRAL_FX), ...piece.fx }
    const fx = shapeFx(fxSpec, controls, active.has('drums'))
    const ambience = thinAmbience(piece.ambience ?? base?.ambience ?? {}, controls.intensity)
    if (Object.values(ambience).some(v => (v ?? 0) > 0)) active.add('ambience')
    const scene = base?.scene ?? base?.id ?? 'nightdrive'
    const id = base?.id ?? 'jam'
    const bpm = piece.bpm + controls.tempo
    const mix: BarPlan['mix'] = {}
    for (const l of LAYERS) mix[l] = { gain: 1, fadeBars: 0 }

    const index = bar
    bar++
    return {
      index,
      bpmStart: bpm,
      bpmEnd: bpm,
      swing: piece.swing,
      chords: spans[lb]!,
      key,
      scale: scalePcs(key),
      notes,
      drums,
      mix,
      fx,
      ambience,
      ambienceFadeBars: 2,
      meta: {
        landscape: id,
        scene: { from: scene, to: scene, blendStart: 1, blendEnd: 1 },
        phraseBar: lb % PIECE_PHRASE_BARS,
        phraseBars: PIECE_PHRASE_BARS,
        section: `P${Math.floor(lb / PIECE_PHRASE_BARS) + 1}`,
        active: LAYERS.filter(l => active.has(l)),
        upcoming: [],
        transition: { kind: 'none', from: id, to: id, progress: 1, note: '' },
        intensity: controls.intensity,
        nextChord: spans[(lb + 1) % n]?.[0]?.chord.symbol,
        loopBar: lb,
      },
    }
  }

  return {
    nextBar,
    setControls,
    setPiece(p: Piece) { piece = p; refreshBase() },
    setClick(on: boolean) { click = on },
    seek(loopBar: number) { start = loopBar - bar },
    get controls() { return { ...controls } },
    get loopBars() { return loopBars() },
    get piece() { return piece },
  }
}
