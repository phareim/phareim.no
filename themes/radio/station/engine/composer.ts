// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The composer writes one bar of music at a time for the conductor: pads
 * with voice leading, a drone, a bass line from the landscape's patterns, an
 * arp, a lead melody grown from a motif, a counter line, bells and drums.
 *
 * Melody is the part a listener remembers, so it is built like a person
 * would: a one- or two-bar motif (a rhythm cell and a contour of scale
 * steps) is stated, repeated as a sequence over the next chords, varied,
 * and closed with a cadence on a chord tone. A section keeps its motif, so
 * the music repeats enough to feel written.
 */
import type {
  Chord, ChordSpan, DrumEvent, Groove, Key, Landscape, Layer, NoteEvent, VoiceId,
} from './types.ts'
import type { Rng } from './rng.ts'
import {
  chordPcs, chordTonesIn, isAvoid, nearest, pentatonicPcs, scaleTonesIn, voiceLead,
} from './theory.ts'

// ---- motifs ----------------------------------------------------------------

type Cell = Array<[number, number]> // [start step, length in steps] within one bar
type Rhythm = 'long' | 'straight' | 'dotted' | 'syncopated' | 'sixteenths'

const CELLS: Record<Rhythm, Cell[]> = {
  long: [
    [[0, 16]], [[0, 8], [8, 8]], [[0, 12], [12, 4]], [[0, 6], [6, 10]], [[4, 12]], [[0, 8], [10, 6]], [[2, 14]],
  ],
  straight: [
    [[0, 4], [4, 4], [8, 4], [12, 4]], [[0, 2], [2, 2], [4, 4], [8, 8]], [[0, 4], [4, 2], [6, 2], [8, 8]],
    [[0, 8], [8, 4], [12, 4]], [[0, 4], [6, 2], [8, 4], [12, 4]], [[0, 4], [4, 4], [8, 8]],
  ],
  dotted: [
    [[0, 6], [6, 6], [12, 4]], [[0, 3], [3, 3], [6, 2], [8, 8]], [[0, 6], [6, 2], [8, 6], [14, 2]], [[0, 6], [6, 10]],
  ],
  syncopated: [
    [[0, 3], [3, 5], [8, 3], [11, 5]], [[2, 4], [6, 6], [12, 4]], [[0, 6], [6, 4], [10, 6]],
    [[0, 2], [3, 3], [6, 2], [8, 8]], [[0, 3], [3, 3], [6, 10]], [[2, 2], [4, 6], [10, 6]],
  ],
  sixteenths: [
    [[0, 1], [1, 1], [2, 1], [3, 1], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 2], [2, 1], [3, 1], [4, 2], [6, 2], [8, 8]],
    [[0, 1], [1, 1], [2, 2], [4, 1], [5, 1], [6, 2], [8, 8]],
  ],
}

/** Cells that end a phrase: land and hold. */
const CADENCE_CELLS: Cell[] = [[[0, 16]], [[0, 4], [4, 12]], [[0, 2], [2, 2], [4, 12]], [[0, 8], [8, 8]]]

export interface Motif {
  /** One cell per bar of the motif. */
  cells: Cell[]
  /** Scale-step movement into each note after the first (first entry is 0). */
  contour: number[]
  /** Written themes: the scale degree (0-based) the theme starts on. */
  start?: number
  /** Written themes keep their passing notes; only real clashes are corrected. */
  written?: boolean
}

function noteCount(cells: Cell[]): number {
  return cells.reduce((n, c) => n + c.length, 0)
}

function pickCell(L: Landscape, rng: Rng, density: number): Cell {
  const vocab = L.lead?.rhythm ?? ['straight']
  const style = rng.pick(vocab)
  const cells = CELLS[style]
  // Density leans toward busier or sparser cells of the chosen style.
  const d = Math.min(1, Math.max(0, (L.lead?.density ?? 0.5) * 0.6 + density * 0.4))
  const weights = cells.map(c => {
    const busy = c.length / 8
    return 1 + (d > 0.5 ? busy * (d - 0.5) * 4 : (1 - busy) * (0.5 - d) * 4)
  })
  return rng.weighted(cells, weights)
}

function makeContour(n: number, rng: Rng, stepwise: number): number[] {
  const out = [0]
  let dir = rng.chance(0.6) ? 1 : -1
  let pos = 0
  for (let i = 1; i < n; i++) {
    let move: number
    const prev = out[i - 1]!
    if (Math.abs(prev) >= 3) {
      // After a leap, step back the other way (gap fill).
      move = -Math.sign(prev) * (rng.chance(0.7) ? 1 : 2)
    } else if (rng.chance(stepwise)) {
      move = dir * (rng.chance(0.75) ? 1 : 2)
      if (rng.chance(0.08)) move = 0
    } else {
      move = dir * rng.pick([2, 3, 3, 4])
    }
    // Arch: rise through the first half, fall through the second.
    if (i === Math.floor(n / 2)) dir = -dir
    if (Math.abs(pos + move) > 6) move = -move
    pos += move
    out.push(move)
  }
  return out
}

const DEGREE = /^([1-7])('*|,*)$/

/**
 * A written theme ('1 - 5, 1 2 3 - 5 | 4 - 3 - 2 - . .') as a Motif:
 * rhythm from the token positions, contour from the degree steps.
 * Null when it does not parse.
 */
export function parseMotif(src: string): Motif | null {
  const bars = src.split('|').map(b => b.trim().split(/\s+/))
  if (!bars.length || bars.length > 2 || bars.some(b => b.length !== 8 && b.length !== 16)) return null
  const cells: Cell[] = []
  const degrees: number[] = []
  let open: [number, number] | null = null
  for (const toks of bars) {
    const cell: Cell = []
    const stride = 16 / toks.length
    toks.forEach((tok, i) => {
      if (tok === '-') { if (open) open[1] += stride; return }
      if (tok === '.') { open = null; return }
      const m = DEGREE.exec(tok)
      if (!m) throw new Error(tok)
      const oct = m[2]!.startsWith("'") ? m[2]!.length : -m[2]!.length
      degrees.push(Number(m[1]) - 1 + oct * 7)
      open = [i * stride, stride]
      cell.push(open)
    })
    cells.push(cell)
  }
  if (!degrees.length) return null
  const contour = degrees.map((d, i) => (i === 0 ? 0 : d - degrees[i - 1]!))
  return { cells, contour, start: ((degrees[0]! % 7) + 7) % 7, written: true }
}

function safeParseMotif(src: string): Motif | null {
  try { return parseMotif(src) } catch { return null }
}

/** A theme for the landscape: mostly one of its written motifs, else invented. */
export function makeMotif(L: Landscape, rng: Rng, density: number, written = 0.8): Motif {
  const themes = (L.lead?.motifs ?? []).map(safeParseMotif).filter((m): m is Motif => m !== null)
  if (themes.length && rng.chance(written)) return rng.pick(themes)
  return inventMotif(L, rng, density)
}

function inventMotif(L: Landscape, rng: Rng, density: number): Motif {
  const bars = L.lead?.motifBars ?? 2
  const cells: Cell[] = []
  for (let b = 0; b < bars; b++) cells.push(pickCell(L, rng, density))
  // A two-bar motif breathes: its second bar is often a longer answer.
  if (bars === 2 && noteCount(cells) > 7 && rng.chance(0.6)) cells[1] = rng.pick(CELLS.long)
  return { cells, contour: makeContour(noteCount(cells), rng, L.lead?.stepwise ?? 0.7) }
}

/** A related motif: same rhythm with a new contour, or inverted, or a new second bar. */
export function varyMotif(m: Motif, L: Landscape, rng: Rng, density: number): Motif {
  const kind = rng.weighted(['invert', 'contour', 'rhythm'], [2, 2, 1])
  // Inverting keeps a written theme recognisable; a new contour does not.
  if (kind === 'invert') return { cells: m.cells, contour: m.contour.map(v => -v), written: m.written }
  if (kind === 'contour') return { cells: m.cells, contour: makeContour(m.contour.length, rng, L.lead?.stepwise ?? 0.7) }
  const cells = [...m.cells]
  cells[cells.length - 1] = pickCell(L, rng, density)
  return { cells, contour: makeContour(noteCount(cells), rng, L.lead?.stepwise ?? 0.7) }
}

// ---- context -----------------------------------------------------------------

/** What survives from bar to bar inside the composer. */
export interface Memory {
  pad: number[] | null
  lead: number | null
  counter: number | null
  /** Pitch the current motif statement starts from. */
  anchor: number | null
  arpIndex: number
  /** Motif note cursor while a statement is running. */
  cursor: number
}

export function newMemory(): Memory {
  return { pad: null, lead: null, counter: null, anchor: null, arpIndex: 0, cursor: 0 }
}

export interface BarContext {
  L: Landscape
  key: Key
  scale: number[]
  spans: ChordSpan[]
  /** First chord of the next bar (for approach notes). */
  next: Chord
  /** Pattern level 0..4 for bass, drums, arp rate. */
  level: number
  density: number
  rng: Rng
  phraseBar: number
  phraseBars: number
  motif: Motif
  /** The phrase's second motif (bars 5–6 of eight). */
  motifB: Motif
  leadOn: boolean
  /** Replace the drums with the fill this bar. */
  fill: boolean
  /** Drums enter next bar: play the fill's second half as a pickup. */
  pickup: boolean
  /** A crash on beat one. */
  crash: boolean
  /** Layers that should get notes this bar. */
  present: ReadonlySet<Layer>
  mem: Memory
  /** Mood 0..1, tints voicing registers. */
  mood: number
}

/**
 * The pattern level for a layer: never below the level where the landscape
 * brings that layer in (its pattern there is the one written for it), and
 * skipping empty patterns upward.
 */
function levelFor<T>(ctx: BarContext, layer: Layer, items: readonly T[], empty: (t: T) => boolean): number {
  const first = Math.max(0, ctx.L.layers.findIndex(ls => ls.includes(layer)))
  let lvl = Math.min(4, Math.max(Math.round(ctx.level), first))
  while (lvl < 4 && empty(items[lvl]!)) lvl++
  return lvl
}

function chordAt(spans: ChordSpan[], step: number): Chord {
  let c = spans[0]!.chord
  for (const s of spans) if (s.from <= step) c = s.chord
  return c
}

const PAN: Partial<Record<Layer, number>> = { arp: 0.28, counter: -0.3, bells: 0.4, perc: -0.2 }

// ---- parts -------------------------------------------------------------------

function pad(ctx: BarContext, out: NoteEvent[]): void {
  const voice = ctx.L.pad.voice
  const lift = ctx.mood < 0.35 ? 2 : ctx.mood > 0.7 ? -2 : 0
  for (const s of ctx.spans) {
    const v = voiceLead(ctx.mem.pad, s.chord, 4, 52 + lift, 76 + lift)
    ctx.mem.pad = v
    v.forEach((m, i) => out.push({ layer: 'pad', voice, midi: m, step: s.from, len: s.len + 0.5, vel: 0.62, pan: (i - 1.5) * 0.18 }))
  }
}

function drone(ctx: BarContext, out: NoteEvent[]): void {
  if (!ctx.L.drone) return
  // A pedal on the key's tonic, retriggered every two bars with overlap.
  if (ctx.phraseBar % 2 !== 0) return
  const root = 36 + ctx.key.tonic
  const voice = ctx.L.drone.voice
  const low = voice === 'drone.shimmer' ? root + 36 : voice === 'drone.organ' ? root + 12 : root
  out.push({ layer: 'drone', voice, midi: low, step: 0, len: 40, vel: 0.55 })
  out.push({ layer: 'drone', voice, midi: low + 7, step: 0, len: 40, vel: 0.4 })
}

function bass(ctx: BarContext, out: NoteEvent[]): void {
  const spec = ctx.L.bass
  const pat = spec.patterns[levelFor(ctx, 'bass', spec.patterns, p => !p)] ?? ''
  if (!pat) return
  const base = spec.octave ?? 36
  let last: NoteEvent | null = null
  for (let s = 0; s < 16; s++) {
    const ch = pat[s]
    if (ch === '-') { if (last) last.len += 1; continue }
    if (ch === '.' || ch === undefined) { last = null; continue }
    const c = chordAt(ctx.spans, s)
    const root = base + c.bass
    let midi: number
    if (ch === 'a') {
      // Approach the chord that comes next: a step below its bass note.
      const nextSpan = ctx.spans.find(sp => sp.from > s)
      const target = base + (nextSpan ? nextSpan.chord.bass : ctx.next.bass)
      if (spec.chromaticApproach) midi = target - 1
      else {
        const below = scaleTonesIn(ctx.scale, target - 3, target - 1)
        midi = below.length ? below[below.length - 1]! : target - 2
      }
    } else {
      const off = ch === 'O' ? 12 : ch === '5' ? 7 : ch === '3' ? (c.tones[1] ?? 4) : ch === '7' ? (c.tones.find(t => t === 10 || t === 11) ?? 10) : 0
      midi = (ch === 'O' || ch === '5' || ch === '3' || ch === '7') ? base + c.root + off : root
      if (midi - base > 19) midi -= 12
    }
    const accent = s % 4 === 0 ? 0.9 : 0.72
    last = { layer: 'bass', voice: spec.voice, midi, step: s, len: 1, vel: accent + ctx.rng.range(-0.04, 0.04) }
    out.push(last)
  }
}

function arpRate(ctx: BarContext): number {
  const spec = ctx.L.arp!
  let rate: number = spec.rate[levelFor(ctx, 'arp', spec.rate, () => false)] ?? 8
  if (ctx.density > 0.78 && rate < 16) rate *= 2
  if (ctx.density < 0.22 && rate > 4) rate /= 2
  return rate
}

function arp(ctx: BarContext, out: NoteEvent[]): void {
  const spec = ctx.L.arp
  if (!spec) return
  const rate = arpRate(ctx)
  const stride = 16 / rate
  const phase = ctx.phraseBar / ctx.phraseBars
  for (let s = 0; s < 16; s += stride) {
    const c = chordAt(ctx.spans, s)
    const tones = chordTonesIn(c, spec.low, spec.low + 12 * spec.octaves)
    if (!tones.length) continue
    const n = tones.length
    const i = ctx.mem.arpIndex++
    let midi: number
    switch (spec.pattern) {
      case 'down': midi = tones[n - 1 - (i % n)]!; break
      case 'updown': {
        const cyc = Math.max(1, 2 * n - 2)
        const k = i % cyc
        midi = tones[k < n ? k : cyc - k]!
        break
      }
      case 'random': midi = tones[ctx.rng.int(n)]!; break
      case 'broken': {
        const order = [0, 2, 1, 3, 2, 4, 3, 1]
        midi = tones[order[i % order.length]! % n]!
        break
      }
      case 'pedal': midi = i % 2 === 0 ? tones[0]! : tones[1 + ((i >> 1) % Math.max(1, n - 1))]!; break
      case 'sequence': {
        const seq = spec.sequence ?? [0, 2, 4, 7]
        const deg = seq[i % seq.length]!
        const sc = scaleTonesIn(ctx.scale, spec.low - 12, spec.low + 36)
        const rootAt = nearest(sc.filter(m => m % 12 === c.root), spec.low + 2)
        const idx = sc.indexOf(rootAt)
        midi = sc[Math.max(0, Math.min(sc.length - 1, idx + deg))]!
        break
      }
      default: midi = tones[i % n]!
    }
    const onBeat = s % 4 === 0
    const vel = (onBeat ? 0.8 : 0.62) + ctx.rng.range(-0.05, 0.05)
    const cutoff = 0.35 + 0.35 * Math.sin(phase * Math.PI) + ctx.level * 0.06
    out.push({
      layer: 'arp', voice: spec.voice, midi, step: s, len: stride * 0.9, vel, pan: PAN.arp,
      opts: spec.voice === 'arp.seq' ? { cutoff: Math.min(1, cutoff) } : undefined,
    })
  }
}

/** Scale (or pentatonic) tones across the lead's range. */
function leadPitches(ctx: BarContext): number[] {
  const spec = ctx.L.lead!
  const pcs = spec.pentatonic ? pentatonicPcs(ctx.key) : ctx.scale
  return scaleTonesIn(pcs, spec.range[0], spec.range[1])
}

/**
 * Which motif material a bar of the phrase plays. Eight bars:
 * statement, sequence, variation, cadence (two bars each).
 */
function leadPlan(ctx: BarContext): { motif: Motif; bar: number; cadence: boolean; start: boolean; rest: boolean } {
  const bars = ctx.motif.cells.length
  const pb = ctx.phraseBar
  const half = ctx.phraseBars / 2
  const cadence = pb === ctx.phraseBars - 1
  const inB = ctx.phraseBars === 8 && pb >= half && pb < ctx.phraseBars - 2
  const motif = inB ? ctx.motifB : ctx.motif
  const bar = pb % bars
  // Sparse settings let the variation bars rest (call, then space).
  const rest = inB && ctx.density < 0.3 && ctx.rng.chance(0.7)
  return { motif, bar, cadence, start: bar === 0, rest }
}

function lead(ctx: BarContext, out: NoteEvent[]): void {
  const spec = ctx.L.lead
  if (!spec || !ctx.leadOn) return
  const plan = leadPlan(ctx)
  if (plan.rest) { ctx.mem.lead = null; return }
  const pitches = leadPitches(ctx)
  if (!pitches.length) return
  const centre = (spec.range[0] + spec.range[1]) / 2
  const cell = plan.cadence ? ctx.rng.pick(CADENCE_CELLS) : plan.motif.cells[plan.bar]!

  if (plan.start || ctx.mem.anchor === null) {
    // A new statement starts on a chord tone near the last note (or the centre),
    // nudged a step each statement so the sequence climbs or falls.
    const c = chordAt(ctx.spans, cell[0]?.[0] ?? 0)
    const ref = ctx.mem.lead ?? centre + (ctx.phraseBar >= ctx.phraseBars / 2 ? 2 : -2)
    const tones = chordTonesIn(c, spec.range[0] + 2, spec.range[1] - 4)
    ctx.mem.anchor = tones.length ? nearest(tones, ref) : nearest(pitches, ref)
    if (plan.motif.start !== undefined && !plan.cadence) {
      // A written theme starts on its own degree when that degree belongs to the chord.
      const pc = ctx.scale[plan.motif.start]!
      if (chordPcs(c).includes(pc)) {
        const own = scaleTonesIn([pc], spec.range[0] + 2, spec.range[1] - 4)
        if (own.length) ctx.mem.anchor = nearest(own, ref)
      }
    }
    ctx.mem.cursor = 0
  }
  // Cursor into the motif's contour for this bar.
  let cursor = 0
  for (let b = 0; b < plan.bar; b++) cursor += plan.motif.cells[b]!.length
  let idx = pitches.indexOf(nearest(pitches, ctx.mem.lead ?? ctx.mem.anchor!))
  if (plan.bar === 0 || ctx.mem.lead === null) idx = pitches.indexOf(nearest(pitches, ctx.mem.anchor!))

  cell.forEach(([step, len], i) => {
    const c = chordAt(ctx.spans, step)
    const last = i === cell.length - 1
    let midi: number
    if (plan.cadence && last) {
      // Land on the root or third, near where the line is.
      const land = chordTonesIn(c, spec.range[0], spec.range[1]).filter(m => {
        const rel = (m - c.root + 12) % 12
        return rel === 0 || rel === 3 || rel === 4
      })
      midi = nearest(land.length ? land : pitches, pitches[idx]!)
    } else {
      const move = (plan.cadence ? (i === 0 ? 0 : -1) : plan.motif.contour[cursor + i] ?? 0)
      if (!(plan.bar === 0 && i === 0)) idx += move
      // Reflect at the edges of the range.
      if (idx < 0) idx = Math.min(pitches.length - 1, -idx)
      if (idx >= pitches.length) idx = Math.max(0, 2 * (pitches.length - 1) - idx)
      midi = pitches[idx]!
      const strong = step % 4 === 0 || len >= 4
      if (plan.motif.written) {
        if (isAvoid(midi % 12, c)) {
          const tones = chordTonesIn(c, spec.range[0], spec.range[1])
          if (tones.length) midi = nearest(tones, midi)
        }
      } else if (strong) {
        // Strong beats and long notes sit on chord tones.
        const tones = chordTonesIn(c, spec.range[0], spec.range[1])
        if (tones.length && !tones.includes(midi)) {
          const t = nearest(tones, midi)
          if (Math.abs(t - midi) <= 2) midi = t
        }
      } else if (isAvoid(midi % 12, c)) {
        midi = pitches[Math.max(0, idx - 1)]!
      }
      // The contour asked for movement: don't let snapping flatten it into a repeat.
      if (move !== 0 && midi === ctx.mem.lead) {
        const dir = Math.sign(move)
        const pool = strong ? chordTonesIn(c, spec.range[0], spec.range[1]) : pitches
        const alt = dir > 0 ? pool.find(m => m > midi) : [...pool].reverse().find(m => m < midi)
        if (alt !== undefined && Math.abs(alt - midi) <= 5) midi = alt
      }
      idx = pitches.indexOf(nearest(pitches, midi))
    }
    const vel = (step === 0 ? 0.86 : step % 4 === 0 ? 0.8 : 0.7) + ctx.rng.range(-0.04, 0.04)
    const legato = spec.voice === 'lead.glide' && i > 0 && cell[i - 1]![0] + cell[i - 1]![1] >= step
    out.push({
      layer: 'lead', voice: spec.voice, midi, step, len: Math.max(1, len - 0.15), vel,
      opts: legato ? { legato: true } : undefined,
    })
    ctx.mem.lead = midi
  })
}

function counter(ctx: BarContext, out: NoteEvent[]): void {
  const spec = ctx.L.counter
  if (!spec) return
  const lo = 55
  const hi = 72
  for (const s of ctx.spans) {
    // Guide tones: the third or seventh, nearest the previous note, so the line moves by step.
    const c = s.chord
    const guides = c.tones.filter(t => t === 3 || t === 4 || t === 10 || t === 11 || t === 2 || t === 5).map(t => (c.root + t) % 12)
    const pcs = guides.length ? guides : chordPcs(c)
    const cands: number[] = []
    for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) cands.push(m)
    if (!cands.length) continue
    const midi = nearest(cands, ctx.mem.counter ?? 64)
    ctx.mem.counter = midi
    if (spec.style === 'guide') {
      out.push({ layer: 'counter', voice: spec.voice, midi, step: s.from, len: s.len, vel: 0.55, pan: PAN.counter })
    } else if (s.len >= 8) {
      // Answer: enter after the downbeat, in the space the lead leaves.
      out.push({ layer: 'counter', voice: spec.voice, midi, step: s.from + 4, len: s.len - 4, vel: 0.55, pan: PAN.counter })
    }
  }
}

function bells(ctx: BarContext, out: NoteEvent[]): void {
  const spec = ctx.L.bells
  if (!spec) return
  const pcs = pentatonicPcs(ctx.key)
  const tones = scaleTonesIn(pcs, 72, 93)
  for (let beat = 0; beat < 4; beat++) {
    const p = spec.density * (0.25 + ctx.density * 0.5) * (beat === 0 ? 1.4 : 1)
    if (!ctx.rng.chance(p)) continue
    const c = chordAt(ctx.spans, beat * 4)
    const chordish = tones.filter(m => chordPcs(c).includes(m % 12))
    const midi = ctx.rng.pick(chordish.length && ctx.rng.chance(0.7) ? chordish : tones)
    const step = beat * 4 + (ctx.rng.chance(0.3) ? 2 : 0)
    out.push({ layer: 'bells', voice: spec.voice as VoiceId, midi, step, len: 8, vel: 0.4 + ctx.rng.range(0, 0.25), pan: ctx.rng.range(-0.5, 0.5) })
  }
}

// ---- drums -------------------------------------------------------------------

const VEL: Record<string, number> = { X: 1, x: 0.8, g: 0.34 }

function grooveEvents(g: Groove, ctx: BarContext, layer: 'drums' | 'perc', from = 0, out: DrumEvent[]): void {
  const kit = ctx.L.drums.kit
  for (const [hit, pat] of Object.entries(g)) {
    if (!pat) continue
    for (let s = from; s < 16; s++) {
      const ch = pat[s]!
      if (ch === '.' || ch === '-') continue
      if (ch === 'g' && ctx.density < 0.3) continue
      let len: number | undefined
      if (hit === 'z') {
        len = 1
        while (s + len < 16 && pat[s + len] === '-') len++
      }
      out.push({
        layer, kit, hit: hit as DrumEvent['hit'], step: s,
        vel: Math.min(1, (VEL[ch] ?? 0.8) + ctx.rng.range(-0.06, 0.06)), len,
      })
    }
  }
}

function drums(ctx: BarContext, out: DrumEvent[]): void {
  const spec = ctx.L.drums
  const emptyGroove = (g: Groove) => !Object.values(g).some(p => p && /[xXg]/.test(p))
  const lvl = levelFor(ctx, 'drums', spec.grooves, emptyGroove)
  const plvl = spec.perc ? levelFor(ctx, 'perc', spec.perc, emptyGroove) : 0
  if (ctx.present.has('drums')) {
    const groove = ctx.fill ? spec.fill : spec.grooves[lvl]!
    grooveEvents(groove, ctx, 'drums', 0, out)
    if (ctx.crash) out.push({ layer: 'drums', kit: spec.kit, hit: 'x', step: 0, vel: 0.7 })
    // Busy settings add ghost hats between the written ones.
    if (ctx.density > 0.7 && !ctx.fill && groove.h) {
      for (let s = 1; s < 16; s += 2) {
        if (groove.h[s] === '.' && ctx.rng.chance((ctx.density - 0.7) * 1.2)) {
          out.push({ layer: 'drums', kit: spec.kit, hit: 'h', step: s, vel: 0.25 })
        }
      }
    }
  } else if (ctx.pickup) {
    grooveEvents(spec.fill, ctx, 'drums', 8, out)
  }
  if (ctx.present.has('perc') && spec.perc) grooveEvents(spec.perc[plvl]!, ctx, 'perc', 0, out)
}

// ---- the bar -----------------------------------------------------------------

export function composeBar(ctx: BarContext): { notes: NoteEvent[]; drums: DrumEvent[] } {
  const notes: NoteEvent[] = []
  const hits: DrumEvent[] = []
  const has = (l: Layer) => ctx.present.has(l)
  if (has('pad')) pad(ctx, notes)
  else ctx.mem.pad = null
  if (has('drone')) drone(ctx, notes)
  if (has('bass')) bass(ctx, notes)
  if (has('arp')) arp(ctx, notes)
  if (has('lead')) lead(ctx, notes)
  else { ctx.mem.lead = null; ctx.mem.anchor = null }
  if (has('counter')) counter(ctx, notes)
  if (has('bells')) bells(ctx, notes)
  drums(ctx, hits)
  return { notes, drums: hits }
}
