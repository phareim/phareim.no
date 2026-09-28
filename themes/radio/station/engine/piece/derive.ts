// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * pieceToLandscape: a piece read back as a radio Landscape. The piece's
 * progressions, its bass line (as a pattern of chord functions), its
 * grooves per intensity, its lead's opening phrases (as written motifs) and
 * its voices and ladder carry over; the base landscape fills in the rest.
 * Its phrases themselves come along note for note as `written` phrases,
 * which the radio's conductor quotes now and then. The result always passes
 * validateLandscape, so it is a starting draft for a channel and the
 * landscape growing composes with.
 */
import type {
  ArpSpec, BassSpec, DrumSpec, Groove, Key, KitId, Landscape, Layer, MelodySpec, Progression, VoiceId,
  WrittenPart, WrittenPhrase,
} from '../types.ts'
import { LAYERS } from '../types.ts'
import { BRIGHTNESS, scalePcs, scaleTonesIn } from '../theory.ts'
import { DRUM_HITS, SCENE_IDS } from '../catalog.ts'
import { parseMotif } from '../composer.ts'
import type { Piece, PieceNote, Track } from './types.ts'
import { PIECE_PHRASE_BARS } from './types.ts'
import { formatDrumBar } from './notation.ts'
import { chordAt } from './chords.ts'
import { grooveOf, NEUTRAL_FX, notesOf } from './conductor.ts'
import { DEFAULT_QUOTE } from '../written.ts'
import { MAX_WRITTEN_PARTS } from '../validate.ts'

type Five<T> = [T, T, T, T, T]
const LEVELS = [0, 1, 2, 3, 4] as const
const five = <T>(f: (level: number) => T): Five<T> => LEVELS.map(f) as Five<T>

/** Voices for a layer when neither the piece nor the base names one. */
export const DEFAULT_VOICES: Partial<Record<Layer, VoiceId>> = {
  pad: 'pad.warm', drone: 'drone.sub', bass: 'bass.round', arp: 'arp.warm', lead: 'lead.ep', counter: 'counter.soft', bells: 'bell.glass',
}
const DEFAULT_BASS: Five<string> = ['', 'R-------R-------', 'R...R...R...R..a', 'R.R.R.R.R.R.R.5.', 'R.RRR.RRR.RR5.O.']
const DEFAULT_DRUMS: DrumSpec = {
  kit: 'kit.soft',
  grooves: [
    {}, {},
    { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xg' },
    { k: 'x.....x.x.x.....', s: '....X.......X..g', h: 'xgxgxgxgxgxgxgxg' },
  ],
  fill: { k: 'x.......x.......', s: '....x...x.x.xxxx' },
  perc: [{}, { p: '..x...x...x...x.' }, { p: '..x...x...x...x.' }, { p: 'x.x.x.xgx.x.x.xg' }, { p: 'x.x.x.xgx.x.x.xg' }],
}

/** A copy of L with a spec for `layer` (the base's or a default), using `voice` when given. */
export function withLayerSpec(L: Landscape, layer: Layer, voice?: VoiceId): Landscape {
  const v = (fallback?: VoiceId): VoiceId => voice ?? fallback ?? DEFAULT_VOICES[layer]!
  const out: Landscape = { ...L }
  switch (layer) {
    case 'pad': out.pad = { voice: v(L.pad?.voice) }; break
    case 'drone': out.drone = { voice: v(L.drone?.voice) }; break
    case 'bass': out.bass = { ...L.bass, voice: v(L.bass?.voice) }; break
    case 'arp': out.arp = { ...(L.arp ?? { pattern: 'broken', rate: [8, 8, 8, 16, 16], octaves: 1, low: 60 }), voice: v(L.arp?.voice) } as ArpSpec; break
    case 'lead': out.lead = { ...(L.lead ?? { range: [62, 84], density: 0.45, stepwise: 0.7, rhythm: ['straight', 'dotted'], motifBars: 2, rest: 0.25 }), voice: v(L.lead?.voice) } as MelodySpec; break
    case 'counter': out.counter = { style: L.counter?.style ?? 'guide', voice: v(L.counter?.voice) }; break
    case 'bells': out.bells = { density: L.bells?.density ?? 0.2, voice: v(L.bells?.voice) }; break
    case 'perc': if (!L.drums.perc) out.drums = { ...L.drums, perc: DEFAULT_DRUMS.perc }; break
  }
  return out
}

/** Several grooves as one: per step the strongest of the hits written there. */
function mergeGrooves(gs: Groove[]): Groove {
  const rank: Record<string, number> = { '.': 0, '-': 1, g: 2, x: 3, X: 4 }
  const out: Groove = {}
  for (const g of gs) for (const h of DRUM_HITS) {
    const row = g[h]
    if (!row) continue
    const cur = out[h] ?? '................'
    out[h] = [...row].map((c, i) => ((rank[c] ?? 0) > (rank[cur[i]!] ?? 0) ? c : cur[i]!)).join('')
  }
  return out
}

const isEmptyGroove = (g: Groove) => !formatDrumBar(g)

/** A kit track's groove: its most common non-empty bar (the first of equals), so a crash or a fill is not taken for it. */
function typicalGroove(t: Track): Groove {
  const counts = new Map<string, number>()
  for (const b of t.bars) {
    const f = formatDrumBar(grooveOf(b))
    if (f) counts.set(f, (counts.get(f) ?? 0) + 1)
  }
  let best = ''
  for (const [f, c] of counts) if (c > (counts.get(best) ?? 0)) best = f
  return grooveOf(best)
}

/** Grooves per intensity from kit tracks: the typical grooves of the tracks entered by then. */
function groovesOf(tracks: Track[]): Five<Groove> {
  return five(l => mergeGrooves(tracks.filter(t => t.enter <= l).map(typicalGroove)))
}

/**
 * A bass track as one of the radio's 16-step patterns (R O 5 3 7 a - .)
 * from its first non-empty phrase-opening bar, and the octave its roots sit in.
 */
function bassPattern(piece: Piece, t: Track): { pattern: string; octave: number } | null {
  const order = [...t.bars.keys()].sort((a, b) => Number(a % PIECE_PHRASE_BARS !== 0) - Number(b % PIECE_PHRASE_BARS !== 0) || a - b)
  const at = order.find(i => notesOf(t.bars[i]!).length)
  if (at === undefined) return null
  const byStep = new Map<number, PieceNote>()
  for (const n of notesOf(t.bars[at]!)) {
    const s = Math.round(n.step)
    if (s < 16 && (!byStep.has(s) || n.midi < byStep.get(s)!.midi)) byStep.set(s, n)
  }
  const roots = [...byStep].map(([s, n]) => n.midi - chordAt(piece, at, s).bass).filter(r => r % 12 === 0)
  const octave = roots.length ? Math.max(24, Math.min(48, Math.min(...roots))) : 36
  const chars: string[] = Array(16).fill('.')
  for (let s = 0; s < 16; s++) {
    const n = byStep.get(s)
    if (!n) continue
    const c = chordAt(piece, at, s)
    const rel = (((n.midi - c.root) % 12) + 12) % 12
    const next = [...byStep].find(([k]) => k > s)?.[1]
    let ch: string
    if ((((n.midi - c.bass) % 12) + 12) % 12 === 0) ch = n.midi - c.bass >= octave + 12 && c.bass === c.root ? 'O' : 'R'
    else if (rel === 0) ch = 'O'
    else if (rel === 7) ch = '5'
    else if (rel === c.tones[1] || rel === 3 || rel === 4) ch = '3'
    else if (rel === 10 || rel === 11) ch = '7'
    else if (next && next.midi - n.midi >= 1 && next.midi - n.midi <= 3) ch = 'a'
    else ch = rel >= 5 && rel <= 8 ? '5' : 'R'
    chars[s] = ch
    for (let k = s + 1; k < 16 && k < s + Math.round(n.len) && !byStep.has(k); k++) chars[k] = '-'
  }
  const pattern = chars.join('')
  return /[RO537a]/.test(pattern) ? { pattern, octave } : null
}

/**
 * One or two bars of a melody as a written motif for the radio: eighth-note
 * scale degrees (the top note of each eighth, snapped to the scale) with
 * octave marks against the tonic below the first note, '-' while a note
 * holds, '.' rests. '' when there is no note.
 */
export function motifFromNotes(notes: PieceNote[][], key: Key): string {
  const bars = notes.slice(0, 2)
  const opening = bars.find(b => b.length)
  if (!opening) return ''
  const t0 = Math.min(...opening.map(n => n.step))
  const lead = opening.filter(n => n.step === t0).reduce((a, x) => (x.midi > a.midi ? x : a))
  const ref = lead.midi - ((((lead.midi - key.tonic) % 12) + 12) % 12)
  const tones = scaleTonesIn(scalePcs(key), ref - 48, ref + 48)
  const refIdx = tones.indexOf(ref)
  const token = (midi: number): string => {
    let best = 0
    for (let i = 0; i < tones.length; i++) if (Math.abs(tones[i]! - midi) < Math.abs(tones[best]! - midi)) best = i
    const i = best - refIdx
    const oct = Math.floor(i / 7)
    return String((((i % 7) + 7) % 7) + 1) + (oct > 0 ? "'".repeat(oct) : ','.repeat(-oct))
  }
  let heldUntil = -1
  const out = bars.map((bar, b) => {
    const row: string[] = []
    for (let e = 0; e < 8; e++) {
      const at = b * 16 + e * 2
      const here = bar.filter(n => n.step >= e * 2 && n.step < e * 2 + 2)
      if (here.length) {
        const n = here.reduce((a, x) => (x.midi > a.midi ? x : a))
        row.push(token(n.midi))
        heldUntil = b * 16 + n.step + n.len
      } else row.push(heldUntil > at + 1 ? '-' : '.')
    }
    return row.join(' ')
  })
  return out.join(' | ')
}

/**
 * The piece's phrases as written phrases: per phrase its progression and
 * one part per track that is not muted (solo is ignored) and has notes
 * somewhere in the loop, named P1, P2, ... A track silent in a phrase keeps
 * its (empty) part there, so a quote keeps the piece's silences on that
 * layer. Phrases where nothing plays are left out. At most 10 parts a
 * phrase: those that play in it first, then by entry level.
 */
export function writtenPhrases(piece: Piece): WrittenPhrase[] {
  const tracks = piece.tracks.filter(t => !t.mute && t.bars.some(b => b.trim()))
  const out: WrittenPhrase[] = []
  for (let p = 0; p < piece.phrases; p++) {
    const parts = tracks.map((t, i) => {
      const part: WrittenPart = { layer: t.layer, enter: t.enter, bars: t.bars.slice(p * PIECE_PHRASE_BARS, (p + 1) * PIECE_PHRASE_BARS) }
      if (t.voice) part.voice = t.voice
      if (t.kit) part.kit = t.kit
      if (t.gain !== undefined && t.gain !== 1) part.gain = t.gain
      return { part, i, plays: part.bars.some(b => b.trim()) }
    })
    if (!parts.some(x => x.plays)) continue
    const kept = [...parts]
      .sort((a, b) => Number(b.plays) - Number(a.plays) || a.part.enter - b.part.enter || a.i - b.i)
      .slice(0, MAX_WRITTEN_PARTS)
      .sort((a, b) => a.i - b.i)
    out.push({ name: `P${p + 1}`, chords: piece.chords[p]!, chordBars: piece.chordBars ?? 2, parts: kept.map(x => x.part) })
  }
  return out
}

function slug(id: string): string {
  const s = id.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '').slice(0, 37)
  return `jam-${s || 'piece'}`
}

/**
 * A draft Landscape from a piece, filled in from `base`; passes
 * validateLandscape. With `written` (default true) it carries the piece's
 * phrases as written phrases and `quote` 0.35.
 */
export function pieceToLandscape(piece: Piece, base?: Landscape, opts: { written?: boolean } = {}): Landscape {
  const live = piece.tracks.filter(t => !t.mute)
  const covered = new Set(piece.tracks.map(t => t.layer))
  const noteTrack = (l: Layer) => live.find(t => t.layer === l && t.voice)
  const kitTracks = (l: 'drums' | 'perc') => live.filter(t => t.layer === l && t.kit)

  const i = BRIGHTNESS.indexOf(piece.mode)
  const moods = [BRIGHTNESS[i - 1], piece.mode, BRIGHTNESS[i + 1]].filter((m): m is Piece['mode'] => !!m)
  const progressions: Progression[] = []
  piece.chords.forEach((chords, p) => {
    if (progressions.some(x => x.chords === chords)) return
    progressions.push({ chords, barsPerChord: piece.chordBars ?? 2, role: p === 0 ? 'a' : 'b' })
  })

  const layers = five(lvl => {
    const s = new Set<Layer>(['ambience'])
    for (const t of live) if (t.enter <= lvl) s.add(t.layer)
    for (const l of base?.layers[lvl] ?? []) if (!covered.has(l)) s.add(l)
    return LAYERS.filter(l => s.has(l))
  })

  // Drums and perc: written grooves where the piece has kit tracks, else the base's.
  const drumT = kitTracks('drums')
  const percT = kitTracks('perc')
  const baseDrums = base?.drums ?? DEFAULT_DRUMS
  const drums: DrumSpec = { ...baseDrums, kit: (drumT[0]?.kit ?? percT[0]?.kit ?? baseDrums.kit) as KitId }
  if (drumT.length) {
    drums.grooves = groovesOf(drumT)
    const top = formatDrumBar(drums.grooves[4])
    drums.fill = baseDrums.fill
    for (let p = 0; p < piece.phrases; p++) {
      const g = mergeGrooves(drumT.map(t => grooveOf(t.bars[p * PIECE_PHRASE_BARS + 7] ?? '')))
      if (!isEmptyGroove(g) && formatDrumBar(g) !== top) { drums.fill = g; break }
    }
  }
  if (percT.length) drums.perc = groovesOf(percT)

  // Bass: the piece's line as a pattern from where it enters.
  let bass: BassSpec = { ...(base?.bass ?? { voice: DEFAULT_VOICES.bass!, patterns: DEFAULT_BASS }) }
  const bt = noteTrack('bass')
  if (bt) {
    bass.voice = bt.voice!
    const d = bassPattern(piece, bt)
    if (d) bass = { ...bass, patterns: five(l => (l >= bt.enter ? d.pattern : '')), octave: d.octave }
  }

  const borrowed: Partial<Landscape> = {}
  if (base) for (const k of ['drone', 'arp', 'lead', 'counter', 'bells'] as const) if (base[k]) Object.assign(borrowed, { [k]: base[k] })

  let L: Landscape = {
    id: slug(piece.id),
    name: (piece.name.trim() || 'Jam').slice(0, 24),
    blurb: `Made in jam: ${(piece.feel?.brief || piece.name || 'a piece').trim().slice(0, 140)}`,
    tonic: piece.tonic,
    moods,
    mood: moods.length > 1 ? moods.indexOf(piece.mode) / (moods.length - 1) : 0.5,
    bpm: Math.max(50, Math.min(170, piece.bpm)),
    swing: piece.swing,
    phraseBars: 8,
    progressions,
    color: base?.color ?? 0.3,
    pad: { voice: noteTrack('pad')?.voice ?? base?.pad.voice ?? DEFAULT_VOICES.pad! },
    ...borrowed,
    bass,
    drums,
    layers,
    fx: { ...(base?.fx ?? NEUTRAL_FX), ...piece.fx },
    ambience: { ...(piece.ambience ?? base?.ambience ?? {}) },
    accent: base?.accent ?? '#ff8a3d',
    scene: [base?.scene, base?.id].find(s => s && (SCENE_IDS as readonly string[]).includes(s)) ?? 'nightdrive',
  }

  // Voices from the piece's tracks, and specs for every layer on the ladder.
  for (const l of ['drone', 'arp', 'lead', 'counter', 'bells'] as const) {
    const t = noteTrack(l)
    if (t || layers[4].includes(l)) L = withLayerSpec(L, l, t?.voice)
  }
  if (layers[4].includes('perc')) L = withLayerSpec(L, 'perc')

  // Lead: its phrase openings become the themes; its range follows the notes.
  const lt = noteTrack('lead')
  if (lt && L.lead) {
    const key: Key = { tonic: piece.tonic, mode: piece.mode }
    const motifs: string[] = []
    for (let p = 0; p < piece.phrases && motifs.length < 4; p++) {
      const m = motifFromNotes([notesOf(lt.bars[p * 8] ?? ''), notesOf(lt.bars[p * 8 + 1] ?? '')], key)
      if (m && !motifs.includes(m) && parseMotif(m)) motifs.push(m)
    }
    const all = lt.bars.flatMap(b => notesOf(b).map(n => n.midi))
    const lead: MelodySpec = { ...L.lead }
    if (motifs.length) { lead.motifs = motifs; lead.motifBars = 2 }
    if (all.length) {
      let lo = Math.max(48, Math.min(...all) - 2)
      let hi = Math.min(96, Math.max(...all) + 2)
      while (hi - lo < 10) { if (lo > 48) lo--; else hi++ }
      lead.range = [lo, hi]
    }
    L.lead = lead
  }

  if (opts.written ?? true) {
    const written = writtenPhrases(piece)
    if (written.length) { L.written = written; L.quote = DEFAULT_QUOTE }
  }
  return L
}
