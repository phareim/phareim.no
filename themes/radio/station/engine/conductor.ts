// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The conductor steers the music toward the listener's Controls, one bar at
 * a time, and moves only where a musician would:
 *
 * - Layers enter one by one on half-phrase boundaries, two bars apart;
 *   drums get a pickup fill, the lead waits for a phrase to begin.
 * - Layers leave when the phrase ends; drums close with a fill.
 * - A new landscape waits for the phrase to end, then a four-bar bridge
 *   (eight across a big tempo gap, with the glide landing after arrival)
 *   pivots the harmony into the new key while tempo, effects, ambience and
 *   the painted scene glide across. The new place arrives with pad and
 *   drone and builds back up to the chosen intensity.
 * - Mood changes the mode at the next phrase; density and Era's voices
 *   too. Tempo glides across a phrase.
 * - Left alone, the music has form: sections A, A2, B, A over the
 *   landscape's progressions, and now and then a phrase where the drums and
 *   lead step out to breathe.
 * - A landscape with written phrases (made in jam) quotes one now and then:
 *   a section W that plays the phrase over its own chords for eight bars,
 *   its parts in place of the composer on their layers, then the cycle goes
 *   on where it was.
 */
import type {
  ArpPattern, BarPlan, Chord, ChordSpan, ConductorLike, Controls, FxSpec, FxState, Key, Landscape, Layer, LayerMix,
  Mode, Progression, TransitionInfo,
} from './types.ts'
import { DEFAULT_CONTROLS, LAYERS } from './types.ts'
import { createRng, hashSeed } from './rng.ts'
import type { Rng } from './rng.ts'
import { keyName, parseProgression, parseToken, scalePcs, MODE_STEPS } from './theory.ts'
import type { ParsedToken } from './theory.ts'
import { composeBar, makeMotif, newMemory, varyMotif } from './composer.ts'
import type { Motif, PhraseShape } from './composer.ts'
import { orchestrate } from './orchestra.ts'
import { eraBar } from './palette.ts'
import type { Orchestration } from './orchestra.ts'
import { DEFAULT_QUOTE, preparedWritten, WRITTEN_BARS, writtenBar, writtenSpans } from './written.ts'
import type { PreparedPhrase } from './written.ts'

export interface ConductorOptions {
  /** Find a landscape by id (built-in or composed). */
  lookup: (id: string) => Landscape | undefined
  seed?: number
  controls?: Partial<Controls>
}

export interface Conductor extends ConductorLike {
  readonly seed: number
  readonly landscape: Landscape
}

/** The order layers join a build. Pad and drone arrive together. */
const ENTRY_ORDER: Layer[] = ['drone', 'pad', 'bass', 'perc', 'drums', 'arp', 'bells', 'counter', 'lead']
/** Layers that swell in and die away rather than start on the beat. */
const SOFT: ReadonlySet<Layer> = new Set<Layer>(['pad', 'drone', 'bells', 'counter', 'ambience'])

interface Section {
  name: 'A' | 'A2' | 'B' | 'W'
  startBar: number
  prog: Progression
  seed: number
  motif: Motif
  motifB: Motif
  phrases: number
  phrasesDone: number
  /** The section's instruments (orchestra.ts). */
  orch: Orchestration
  /** B: the arp plays another pattern. */
  arpPattern?: ArpPattern
  /** An A that follows the contrast: the theme comes home. */
  returning: boolean
  /** W: the written phrase it quotes, and the section that was due when it came in (it follows). */
  written?: PreparedPhrase
  resume?: 'A' | 'A2' | 'B'
}

interface Scheduled { bar: number; layer: Layer; on: boolean }

interface BridgeSlot { spans: ChordSpan[]; key: Key; side: 'from' | 'to' }

interface LandscapeMove {
  from: Landscape
  to: Landscape
  requestBar: number
  bridgeStart: number
  /** 4, or 8 across a big tempo gap (each harmony slot then lasts two bars). */
  bridgeBars: number
  /** Bars after the arrival the tempo keeps gliding (0, or 4 across a big gap). */
  tail: number
  /** The four harmony slots of the bridge: chord tokens and the key each is heard in. */
  bridge: BridgeSlot[] | null
  pivot: string
}

/** A tempo gap (bpm) from which a crossing takes its time: an 8-bar bridge and a glide that lands after arrival. */
export const BIG_TEMPO_GAP = 12

/** Bridge and tail lengths for a crossing between two tempos. */
export function crossingBars(fromBpm: number, toBpm: number): { bridge: number; tail: number } {
  return Math.abs(toBpm - fromBpm) >= BIG_TEMPO_GAP ? { bridge: 8, tail: 4 } : { bridge: 4, tail: 0 }
}

interface TempoGlide { from: number; to: number; start: number; bars: number }

/** Smoothstep: a glide leaves and lands gently instead of lurching at its ends. */
function ease(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

function glideAt(g: TempoGlide, at: number): number {
  return g.from + (g.to - g.from) * ease((at - g.start) / g.bars)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

/**
 * The mood knob is centred on the landscape's own mood: at 0.5 the place
 * sounds as written, toward 0 it brightens, toward 1 it darkens.
 */
export function modeFor(L: Landscape, mood: number): Mode {
  const m = Math.max(0, Math.min(1, mood))
  const eff = m < 0.5 ? lerp(0, L.mood, m / 0.5) : lerp(L.mood, 1, (m - 0.5) / 0.5)
  return L.moods[Math.round(eff * (L.moods.length - 1))]!
}

/** Crush at the 8-bit end: enough staircase to be a console, short of crackle. */
export const ERA_CRUSH = 0.75

/**
 * A landscape's effects shaped by the Space, Era and Mood knobs. The pump
 * only works while drums sound. Era's middle keeps the landscape's tape;
 * toward 8-bit the tape goes and bit crush comes in (gently over the first
 * stretch, and never all the way to the coarse staircase), toward analog the
 * tape deepens a little.
 */
export function shapeFx(f: FxSpec, controls: Pick<Controls, 'space' | 'era' | 'mood'>, drums: boolean): FxState {
  const space = controls.space
  const chip = Math.max(0, Math.min(1, (0.5 - controls.era) * 2))
  const analog = Math.max(0, Math.min(1, (controls.era - 0.5) * 2))
  return {
    reverb: Math.min(1, f.reverb * (0.35 + 1.3 * space)),
    delay: Math.min(1, f.delay * (0.35 + 1.3 * space)),
    reverbSize: f.reverbSize * (0.65 + 0.7 * space),
    tone: Math.max(0.05, Math.min(1, f.tone * (1.08 - 0.16 * controls.mood))),
    grit: Math.min(1, (f.grit * 0.4 + 0.225) * (1 - chip) + 0.35 * analog),
    crush: ERA_CRUSH * chip * chip,
    pump: (f.pump ?? 0) * (drums ? 1 : 0),
    width: 0.55 + 0.45 * space,
  }
}

/** Ambience levels thinned a little as intensity rises. */
export function thinAmbience(ambience: Landscape['ambience'], intensity: number): BarPlan['ambience'] {
  const thin = 1 - 0.1 * intensity
  const out: BarPlan['ambience'] = {}
  for (const [k, v] of Object.entries(ambience)) out[k as keyof BarPlan['ambience']] = (v ?? 0) * thin
  return out
}

/** The chord a mode cadences into its tonic from, as a token. */
const CADENCE: Record<Mode, string[]> = {
  lydian: ['2M'],
  ionian: ['5s4:0.5', '5:0.5'],
  mixolydian: ['b7M'],
  dorian: ['4M'],
  aeolian: ['b7M'],
  harmonicMinor: ['5s4:0.5', '5M7:0.5'],
  phrygian: ['b2M'],
}

function tokensToSpans(tokens: string[], key: Key): ChordSpan[] {
  const spans: ChordSpan[] = []
  let at = 0
  for (const t of tokens) {
    const p = parseToken(t, key, 1)
    if (!p) continue
    const len = Math.round(p.bars * 16)
    spans.push({ from: at, len, chord: p.chord })
    at += len
  }
  return spans
}

function pcsOf(c: Chord): number[] {
  return c.tones.filter(t => t < 12).map(t => (c.root + t) % 12)
}

export function createConductor(opts: ConductorOptions): Conductor {
  const fallback = opts.lookup('coast')
  const find = (id: string): Landscape => opts.lookup(id) ?? fallback ?? opts.lookup(DEFAULT_CONTROLS.landscape)!
  const controls: Controls = { ...DEFAULT_CONTROLS, ...opts.controls }
  const seed = (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) >>> 0
  const master = createRng(seed)

  let L = find(controls.landscape)
  controls.landscape = L.id
  let bar = 0
  let phraseStart = 0
  let phraseBars: number = L.phraseBars ?? 8
  let key: Key = { tonic: L.tonic, mode: modeFor(L, controls.mood) }
  let density = controls.density
  /** Era as the voices hear it: latched at phrase starts, so no one changes instrument mid-phrase. */
  let era = controls.era
  let present = new Set<Layer>(['ambience'])
  let schedule: Scheduled[] = []
  let move: LandscapeMove | null = null
  let building: { from: string; to: string; startBar: number; total: number } | null = null
  /** A phrase where drums and lead step out: [start, until). */
  let breath: { start: number; until: number } | null = null
  let nextBreath = 3 + master.int(3)
  let sectionCount = 0
  let theme: Motif
  let homeProg: Progression
  let section: Section
  let leadOn = true
  let mem = newMemory()
  let bpmStart = L.bpm + controls.tempo
  let bpmEnd = bpmStart
  let bpmGlide: TempoGlide | null = null
  let lastMode: Mode = key.mode
  let modeNote: { text: string; until: number } | null = null
  /** No entries before this bar (a new place settles first). */
  let settleUntil = 0
  /** The pattern level the parts play at (bass pattern, groove, arp rate). */
  let groove = 0
  /** Index of the written phrase quoted last (not quoted twice running when there are others). */
  let lastQuote = -1

  // ---- sections ------------------------------------------------------------

  function pickProgression(role: 'a' | 'b', rng: Rng, avoid?: Progression): Progression {
    let pool = L.progressions.filter(p => (p.role ?? 'a') === role && p !== avoid)
    if (!pool.length) pool = L.progressions.filter(p => p !== avoid)
    if (!pool.length) pool = L.progressions
    return rng.weighted(pool, pool.map(p => p.weight ?? 1))
  }

  /** A landscape opens with one of its written themes; later home themes may be invented. */
  function freshTheme(first = false): void {
    const rng = master.fork(hashSeed(sectionCount, 77))
    homeProg = pickProgression('a', rng)
    theme = makeMotif(L, rng, density, first ? 1 : 0.8)
  }

  function newSection(name: Section['name'], startBar: number, returning = false): Section {
    sectionCount++
    const sseed = hashSeed(seed, sectionCount * 7919)
    const rng = createRng(sseed)
    // Every few cycles the landscape finds a new home theme, so hours of play keep moving.
    if (name === 'A' && sectionCount > 1 && sectionCount % 8 === 1) freshTheme()
    let prog = homeProg
    let motif = theme
    if (name === 'A2') motif = varyMotif(theme, L, rng, density)
    if (name === 'B') {
      prog = rng.chance(0.15) && L.progressions.some(p => p.role === 'bridge')
        ? L.progressions.find(p => p.role === 'bridge')!
        : pickProgression('b', rng, homeProg)
      // The contrast section mostly invents; now and then it borrows another written theme.
      motif = makeMotif(L, rng, density, 0.35)
    }
    const motifB = varyMotif(motif, L, rng.fork(3), density)
    const phrases = phraseBars === 4 ? 4 : 2
    const orng = createRng(hashSeed(sseed, 0x0c4e))
    const orch = orchestrate(L, name, orng, controls.intensity, returning)
    let arpPattern: ArpPattern | undefined
    const own = L.arp?.pattern
    if (name === 'B' && own && own !== 'sequence' && own !== 'random' && orng.chance(0.5)) {
      arpPattern = orng.pick((['up', 'down', 'updown', 'broken', 'pedal'] as ArpPattern[]).filter(p => p !== own))
    }
    return { name, startBar, prog, seed: sseed, motif, motifB, phrases, phrasesDone: 0, orch, arpPattern, returning }
  }

  /** Lead register per phrase of a section (semitones from the centre of its range): low, then higher. */
  const LIFT: Record<Section['name'], [number, number]> = { A: [-2, 1], A2: [1, 4], B: [-3, -1], W: [0, 0] }
  const SHAPES: PhraseShape[] = ['classic', 'period', 'sentence', 'call']
  const SHAPE_WEIGHTS: Record<'A' | 'home' | 'A2' | 'B', number[]> = {
    A: [2, 2, 1, 0], home: [2, 1, 2, 0], A2: [1, 1, 2, 1], B: [1, 1, 1, 2],
  }
  let phrasePlan: { key: string; shape: PhraseShape; lift: number | undefined } = { key: '', shape: 'classic', lift: undefined }

  /**
   * The lead's shape and register for the phrase playing now, decided on its
   * first bar from the section's seed (so hold loops it exactly). A 'call'
   * needs the counter line to answer, so only while the counter sounds.
   */
  function phraseFor(sec: Section): { shape: PhraseShape; lift: number | undefined } {
    const i = sec.phrasesDone % sec.phrases
    const k = `${sec.seed}:${i}:${phraseStart}`
    if (phrasePlan.key === k) return phrasePlan
    if (sec.written) {
      phrasePlan = { key: k, shape: 'classic', lift: undefined }
      return phrasePlan
    }
    const rng = createRng(hashSeed(sec.seed, 0x5a4e + i))
    const kind = sec.name === 'A' && sec.returning ? 'home' : sec.name === 'W' ? 'A' : sec.name
    const weights = SHAPE_WEIGHTS[kind].map((w, j) => (SHAPES[j] === 'call' && !present.has('counter') ? 0 : w))
    const lifts = sec.returning ? [0, 3] : LIFT[sec.name]
    const lift = lifts[Math.min(1, Math.floor((i * 2) / sec.phrases))]!
    phrasePlan = { key: k, shape: rng.weighted(SHAPES, weights), lift }
    return phrasePlan
  }

  function nextSectionName(prev: Section['name']): 'A' | 'A2' | 'B' {
    return prev === 'A' ? 'A2' : prev === 'A2' ? 'B' : 'A'
  }

  /**
   * Now and then (Landscape.quote) a section that is due becomes W: one
   * written phrase (by weight, not the last one when there are others),
   * eight bars long. Not during a landscape move or while a new place builds
   * up, not into a breath, never two in a row; `due` follows it.
   */
  function quoteSection(due: 'A' | 'A2' | 'B', startBar: number): Section | null {
    const phrases = preparedWritten(L)
    if (!phrases.length || move || building) return null
    if (breath && startBar >= breath.start && startBar < breath.until) return null
    const rng = createRng(hashSeed(seed, sectionCount * 7919 + 0x51c7))
    if (!rng.chance(L.quote ?? DEFAULT_QUOTE)) return null
    let pool = phrases.filter(p => p.index !== lastQuote)
    if (!pool.length) pool = phrases
    const pick = rng.weighted(pool, pool.map(p => p.phrase.weight ?? 1))
    lastQuote = pick.index
    sectionCount++
    const sseed = hashSeed(seed, sectionCount * 7919)
    const motifB = varyMotif(theme, L, createRng(sseed).fork(3), density)
    const phrases8 = Math.max(1, Math.round(WRITTEN_BARS / phraseBars))
    return {
      name: 'W', startBar, prog: homeProg, seed: sseed, motif: theme, motifB, phrases: phrases8, phrasesDone: 0,
      orch: { voices: {} }, returning: false, written: pick, resume: due,
    }
  }

  /** The display name of a section: W sections carry their phrase's name. */
  function sectionLabel(sec: Section): string {
    return sec.written?.phrase.name ? `W:${sec.written.phrase.name}` : sec.name
  }

  /** Chord spans of one bar from the section's progression. */
  function sectionHarmony(sec: Section, b: number, k: Key): ChordSpan[] {
    if (sec.written) return writtenSpans(sec.written.phrase, k, b - sec.startBar)
    const colourRng = createRng(hashSeed(sec.seed, 0xc0))
    const colours = Array.from({ length: 32 }, () => ({
      extra7: colourRng.chance(L.color),
      extra9: colourRng.chance(L.color * 0.5),
    }))
    const parsed = parseProgression(sec.prog.chords, k, sec.prog.barsPerChord ?? 1, i => colours[i % 32]!)
    if ('error' in parsed) return [{ from: 0, len: 16, chord: parseToken('1', k)!.chord }]
    const total = parsed.bars
    const pos = (((b - sec.startBar) % total) + total) % total
    const spans: ChordSpan[] = []
    let t = 0
    for (const tok of parsed.chords as ParsedToken[]) {
      const s = t
      const e = t + tok.bars
      t = e
      if (e <= pos || s >= pos + 1) continue
      const from = Math.round((Math.max(s, pos) - pos) * 16)
      const to = Math.round((Math.min(e, pos + 1) - pos) * 16)
      spans.push({ from, len: to - from, chord: tok.chord })
    }
    return spans.length ? spans : [{ from: 0, len: 16, chord: parsed.chords[0]!.chord }]
  }

  // ---- layers --------------------------------------------------------------

  function desired(at: number): Set<Layer> {
    const I = controls.intensity
    let want = new Set<Layer>(L.layers[I])
    if (breath && at >= breath.start && at < breath.until) {
      // Breathing: drums, perc, lead and counter step out; the rest stays.
      const low = new Set<Layer>(L.layers[Math.max(0, I - 2)])
      for (const l of ['pad', 'drone', 'arp', 'bells', 'bass'] as Layer[]) if (want.has(l)) low.add(l)
      want = low
    }
    want.add('ambience')
    return want
  }

  function halfBoundary(from: number): number {
    const half = Math.max(1, phraseBars / 2)
    const rel = from - phraseStart
    return phraseStart + Math.ceil(Math.max(0, rel) / half) * half
  }

  function phraseBoundary(from: number): number {
    const rel = from - phraseStart
    return phraseStart + Math.ceil(Math.max(0, rel) / phraseBars) * phraseBars
  }

  /** Plan entries and exits so `present` moves toward `desired()`. */
  function reconcile(): void {
    if (move) return
    // Additions follow what is wanted now; removals what is wanted when the phrase turns.
    const edge = phraseBoundary(bar)
    const wantEdge = desired(edge)
    const wantNow = desired(bar)
    const want = new Set([...wantNow].filter(l => wantEdge.has(l) || edge === bar))
    for (const l of present) if (!wantEdge.has(l)) want.delete(l)
    schedule = schedule.filter(e => e.bar >= bar)
    const willHave = (l: Layer): boolean => {
      const last = [...schedule].reverse().find(e => e.layer === l)
      return last ? last.on : present.has(l)
    }
    for (const l of LAYERS) {
      if (l === 'ambience') continue
      if (want.has(l) === willHave(l)) continue
      // Cancel a pending move for this layer first; it may be all that was needed.
      schedule = schedule.filter(e => e.layer !== l)
      if (want.has(l) === present.has(l)) continue
      if (!want.has(l)) schedule.push({ bar: edge, layer: l, on: false })
    }
    const adds = ENTRY_ORDER.filter(l => want.has(l) && !willHave(l))
    if (!adds.length) return
    const cold = [...present].every(l => l === 'ambience')
    const pendingOn = schedule.filter(e => e.on).map(e => e.bar)
    let t = Math.max(cold ? bar : halfBoundary(bar), settleUntil)
    if (pendingOn.length) t = Math.max(t, Math.max(...pendingOn) + 2)
    for (const l of adds) {
      if (l === 'drums') t = Math.max(t, halfBoundary(t))
      if (l === 'lead') t = Math.max(t, phraseBoundary(t))
      schedule.push({ bar: t, layer: l, on: true })
      // Drone and pad arrive together; everything else two bars apart.
      if (!(l === 'drone' && adds.includes('pad'))) t += 2
    }
  }

  // ---- landscape moves -------------------------------------------------------

  function planBridge(m: LandscapeMove): void {
    const fromKey: Key = { tonic: m.from.tonic, mode: key.mode }
    const toKey: Key = { tonic: m.to.tonic, mode: modeFor(m.to, controls.mood) }
    const toScale = new Set(scalePcs(toKey))
    // A pivot: a chord of the old key whose notes all live in the new one.
    let pivot: string | null = null
    for (const d of ['4', '6', '2', '5', '3']) {
      const c = parseToken(d, fromKey)!.chord
      if (pcsOf(c).every(pc => toScale.has(pc))) { pivot = d; break }
    }
    const pivotSpans = tokensToSpans([pivot ?? '4'], fromKey)
    const cad = tokensToSpans(CADENCE[toKey.mode], toKey)
    // The bar before the cadence: a chord of the new key unlike the pivot and the cadence.
    const taken = new Set([pivotSpans[0]!.chord.symbol, cad[0]!.chord.symbol, cad[cad.length - 1]!.chord.symbol])
    let pre = tokensToSpans(['4'], toKey)
    for (const d of ['4', '2', '6', '7', '3']) {
      const c = tokensToSpans([d], toKey)
      if (!taken.has(c[0]!.chord.symbol) && !c[0]!.chord.symbol.includes('dim') && !c[0]!.chord.symbol.includes('b5')) { pre = c; break }
    }
    m.pivot = pivot ? pivotSpans[0]!.chord.symbol : ''
    m.bridge = [
      { spans: tokensToSpans(['1'], fromKey), key: fromKey, side: 'from' },
      { spans: pivotSpans, key: fromKey, side: 'from' },
      { spans: pre, key: toKey, side: 'to' },
      { spans: cad, key: toKey, side: 'to' },
    ]
  }

  /**
   * Bar `i` of the bridge. A long bridge gives each slot two bars, and a
   * cadence of two half-bar chords (5sus4 5) holds its first chord a bar
   * before it resolves.
   */
  function bridgeSlot(m: LandscapeMove, i: number): BridgeSlot {
    const per = m.bridgeBars / 4
    const slot = m.bridge![Math.min(3, Math.floor(i / per))]!
    if (per > 1 && i === m.bridgeBars - per && slot.spans.length > 1) {
      return { ...slot, spans: [{ from: 0, len: 16, chord: slot.spans[0]!.chord }] }
    }
    return slot
  }

  function sizeCrossing(m: LandscapeMove): void {
    const c = crossingBars(m.from.bpm, m.to.bpm)
    m.bridgeBars = c.bridge
    m.tail = c.tail
  }

  function startMove(to: Landscape): void {
    const bridgeStart = phraseBoundary(bar)
    const m: LandscapeMove = { from: L, to, requestBar: bar, bridgeStart, bridgeBars: 4, tail: 0, bridge: null, pivot: '' }
    sizeCrossing(m)
    planBridge(m)
    move = m
    building = null
    breath = null
    // The old place thins out: rhythm and melody finish the phrase, the arp and bells two bars later.
    // Across a big tempo gap the bass goes with them, so the glide happens under sustained pad and drone.
    schedule = schedule.filter(e => !e.on && e.bar >= bar)
    for (const l of ['drums', 'perc', 'lead', 'counter'] as Layer[]) {
      if (present.has(l)) schedule.push({ bar: bridgeStart, layer: l, on: false })
    }
    const thin: Layer[] = m.tail ? ['arp', 'bells', 'bass'] : ['arp', 'bells']
    for (const l of thin) {
      if (present.has(l)) schedule.push({ bar: bridgeStart + 2, layer: l, on: false })
    }
  }

  /** The new place takes over. Returns the layers that swell in with it (the drone). */
  function arrive(m: LandscapeMove): Layer[] {
    L = m.to
    controls.landscape = L.id
    move = null
    phraseStart = bar
    phraseBars = L.phraseBars ?? 8
    key = { tonic: L.tonic, mode: modeFor(L, controls.mood) }
    lastMode = key.mode
    mem = { ...newMemory(), pad: mem.pad }
    schedule = []
    // The tempo lands before anything rhythmic enters.
    settleUntil = bar + Math.max(2, m.tail)
    // Keep what the new place starts with; everything else builds from here.
    const keep = new Set<Layer>(['ambience', 'pad'])
    if (L.drone && L.layers[controls.intensity]?.includes('drone')) keep.add('drone')
    if (L.layers[Math.min(1, controls.intensity)]?.includes('bass') && present.has('bass')) keep.add('bass')
    present = new Set([...present].filter(l => keep.has(l)))
    if (!present.has('pad')) present.add('pad')
    // The drone arrives with the pad; it sustains, so it does not wait for the tempo to land.
    const swell: Layer[] = keep.has('drone') && !present.has('drone') ? ['drone'] : []
    for (const l of swell) present.add(l)
    freshTheme(true)
    section = newSection('A', bar)
    nextBreath = sectionCount + 3 + master.int(3)
    const before = present.size
    reconcile()
    building = { from: m.from.id, to: L.id, startBar: bar, total: Math.max(1, schedule.length + present.size - before) }
    return swell
  }

  // ---- controls ---------------------------------------------------------------

  function setControls(c: Partial<Controls>): void {
    const prevIntensity = controls.intensity
    Object.assign(controls, c)
    controls.intensity = Math.max(0, Math.min(4, Math.round(controls.intensity))) as Controls['intensity']
    if (c.landscape !== undefined) {
      const target = find(c.landscape)
      if (move) {
        if (target.id === move.from.id && bar < move.bridgeStart) {
          // Changed our mind before the bridge: stay, and undo the thinning.
          move = null
          schedule = schedule.filter(e => e.on)
          controls.landscape = L.id
          reconcile()
        } else if (target.id !== move.to.id) {
          move.to = target
          // A bridge already under way keeps its length; the tempo glide re-aims in nextBar.
          if (bar < move.bridgeStart) sizeCrossing(move)
          planBridge(move)
        }
      } else if (target.id !== L.id) {
        startMove(target)
      }
      if (move) controls.landscape = move.to.id
    }
    if (c.intensity !== undefined && c.intensity !== prevIntensity) breath = null
    if (!move) reconcile()
  }

  // ---- one bar ----------------------------------------------------------------

  function fxFor(land: Landscape): FxState {
    return shapeFx(land.fx, controls, present.has('drums'))
  }

  function mixFx(a: FxState, b: FxState, t: number): FxState {
    return {
      reverb: lerp(a.reverb, b.reverb, t), delay: lerp(a.delay, b.delay, t),
      reverbSize: lerp(a.reverbSize, b.reverbSize, t), tone: lerp(a.tone, b.tone, t),
      grit: lerp(a.grit, b.grit, t), crush: lerp(a.crush, b.crush, t), pump: lerp(a.pump, b.pump, t), width: lerp(a.width, b.width, t),
    }
  }

  function ambienceFor(land: Landscape): BarPlan['ambience'] {
    return thinAmbience(land.ambience, controls.intensity)
  }

  /** The highest intensity whose layers are all sounding. */
  function effectiveLevel(): number {
    let lvl = 0
    for (let i = 0; i < 5; i++) if (L.layers[i]!.every(l => l === 'ambience' || present.has(l))) lvl = i
    return lvl
  }

  function nextBar(): BarPlan {
    const b = bar
    const entered = new Set<Layer>()
    const left = new Set<Layer>()

    // Landscape arrival happens on the bar after the bridge.
    const arriving = !!move && b === move.bridgeStart + move.bridgeBars
    if (arriving) for (const l of arrive(move!)) entered.add(l)

    // New phrase?
    const phraseStartsHere = b === phraseStart + phraseBars || (b === phraseStart && b === 0)
    if (b === phraseStart + phraseBars) phraseStart = b
    if (phraseStartsHere || arriving) era = controls.era
    let sectionStart = b === 0
    if (b === 0) { freshTheme(true); section = newSection('A', 0) }
    if (phraseStartsHere && b > 0 && !(move && b >= move.bridgeStart)) {
      if (!building || b !== building.startBar) {
        section.phrasesDone++
        if (section.phrasesDone >= section.phrases && !controls.hold) {
          const due = section.resume ?? nextSectionName(section.name)
          // An A is only ever due after the contrast: the theme comes home.
          section = (section.written ? null : quoteSection(due, b)) ?? newSection(due, b, due === 'A')
          sectionStart = true
        }
      }
      density = controls.density
      const mode = modeFor(L, controls.mood)
      if (mode !== lastMode) {
        modeNote = { text: `${keyName({ tonic: L.tonic, mode: lastMode })} → ${keyName({ tonic: L.tonic, mode })}`, until: b + 4 }
        lastMode = mode
      }
      key = { tonic: L.tonic, mode }
      const rng = createRng(hashSeed(section.seed, 0x1ead + (section.phrasesDone % section.phrases)))
      leadOn = !rng.chance(L.lead?.rest ?? 0) || !present.has('lead')
      // Breath: decided a phrase ahead so the drums can close with a fill.
      const lastPhrase = section.phrasesDone === section.phrases - 1
      const settled = !building && !schedule.some(e => e.on)
      if (lastPhrase && settled && !breath && !controls.hold && !move && controls.intensity >= 2 && sectionCount >= nextBreath) {
        breath = { start: b + phraseBars, until: b + 2 * phraseBars }
        nextBreath = sectionCount + 3 + master.int(3)
      }
      // Tempo glides across the phrase toward the target (a crossing's glide runs on to its end).
      const target = L.bpm + controls.tempo
      if (!(bpmGlide && Math.abs(bpmGlide.to - target) < 0.01)) {
        bpmGlide = Math.abs(target - bpmEnd) > 0.01 ? { from: bpmEnd, to: target, start: b, bars: phraseBars } : null
      }
    }
    if (breath && b >= breath.until) breath = null
    if (!move) reconcile()

    // Apply the schedule.
    for (const e of schedule.filter(e => e.bar === b)) {
      if (e.on && !present.has(e.layer)) { present.add(e.layer); entered.add(e.layer) }
      if (!e.on && present.has(e.layer)) { present.delete(e.layer); left.add(e.layer) }
    }
    schedule = schedule.filter(e => e.bar > b)
    if (entered.has('lead')) leadOn = true

    // Where are we?
    const phraseBar = b - phraseStart
    const inBridge = move && b >= move.bridgeStart && b < move.bridgeStart + move.bridgeBars
    const bridgeBar = inBridge ? b - move!.bridgeStart : -1
    const slot = inBridge ? bridgeSlot(move!, bridgeBar) : null
    const bridgeBars = move ? move.bridgeBars : 4
    const land = slot?.side === 'to' ? move!.to : L
    const barKey = slot ? slot.key : key
    const spans = slot ? slot.spans : sectionHarmony(section, b, key)
    const scale = scalePcs(barKey)

    // Tempo. A crossing glides from the bridge's first bar through its tail
    // after the arrival; if the destination changes on the way, it re-aims
    // from where it is over what is left.
    if (inBridge) {
      const z = move!.to.bpm + controls.tempo
      const left = move!.bridgeBars - bridgeBar + move!.tail
      if (bridgeBar === 0) bpmGlide = { from: bpmEnd, to: z, start: b, bars: left }
      else if (!bpmGlide || Math.abs(bpmGlide.to - z) > 0.01) bpmGlide = { from: bpmEnd, to: z, start: b, bars: left }
    }
    if (bpmGlide) {
      const k = b - bpmGlide.start
      bpmStart = glideAt(bpmGlide, b)
      bpmEnd = glideAt(bpmGlide, b + 1)
      if (k + 1 >= bpmGlide.bars) bpmGlide = null
    } else {
      bpmStart = bpmEnd
    }

    // Drum punctuation.
    const drumsOffNext = schedule.some(e => e.bar === b + 1 && e.layer === 'drums' && !e.on)
    const drumsOnNext = schedule.some(e => e.bar === b + 1 && e.layer === 'drums' && e.on)
    const rng = createRng(hashSeed(section.seed, (b - section.startBar) % (section.phrases * phraseBars) + 1000))
    const lastOfPhrase = phraseBar === phraseBars - 1
    const sectionEnds = lastOfPhrase && section.phrasesDone >= section.phrases - 1
    const fill = present.has('drums') && !inBridge && (drumsOffNext || (lastOfPhrase && (sectionEnds || rng.chance(0.3))))
    const crash = present.has('drums') && (entered.has('drums') || (sectionStart && !entered.size && b > 0))

    // Patterns climb one level at a time, with an entry or on a half-phrase,
    // and come down only where the phrase turns, with the layers that leave.
    const aim = inBridge ? 1 : Math.min(controls.intensity, effectiveLevel() + 1)
    const onHalf = phraseBar % Math.max(1, phraseBars / 2) === 0
    if (b === 0 || inBridge) groove = aim
    else if (aim > groove && (onHalf || entered.size)) groove++
    else if (aim < groove && phraseBar === 0) groove = aim
    // The contrast section starts a step lighter at drive and surge, and builds back through its second phrase.
    const lighter = !inBridge && section.name === 'B' && section.phrasesDone % section.phrases === 0 && groove >= 3
    const level = lighter ? groove - 1 : groove
    const phrase = inBridge ? null : phraseFor(section)
    const nextSpans = inBridge
      ? (bridgeBar < bridgeBars - 1 ? bridgeSlot(move!, bridgeBar + 1).spans : tokensToSpans(['1'], { tonic: move!.to.tonic, mode: modeFor(move!.to, controls.mood) }))
      : sectionHarmony(section, b + 1, key)
    // The bass walks into a new chord at the end of a phrase, now and then (always before a new section).
    const walk = !inBridge && lastOfPhrase && level >= 2 && nextSpans[0]!.chord.bass !== spans[spans.length - 1]!.chord.bass
      && (sectionEnds || createRng(hashSeed(section.seed, b * 31 + 7)).chance(0.5))
    const composed = composeBar({
      L: land,
      key: barKey,
      scale,
      spans,
      next: nextSpans[0]!.chord,
      level,
      density,
      rng,
      phraseBar: inBridge ? bridgeBar : phraseBar,
      phraseBars: inBridge ? bridgeBars : phraseBars,
      motif: section.motif,
      motifB: section.motifB,
      leadOn: leadOn && !inBridge,
      fill,
      pickup: drumsOnNext && !inBridge,
      crash,
      present,
      mem,
      mood: controls.mood,
      orch: inBridge ? undefined : section.orch,
      shape: phrase?.shape,
      lift: phrase?.lift,
      arpPattern: inBridge ? undefined : section.arpPattern,
      walk,
    })
    let notes = composed.notes
    let drumHits = composed.drums
    // A riser under the contrast's last bar lifts the music back into the home theme.
    if (sectionEnds && section.name === 'B' && present.has('drums') && controls.intensity >= 2 && !drumHits.some(d => d.hit === 'z')) {
      drumHits.push({ layer: 'drums', kit: land.drums.kit, hit: 'z', step: 8, vel: 0.7, len: 8 })
    }

    // A quote: the written parts that sound replace the composer on their layers.
    const quoting = !inBridge && section.written ? section.written : null
    if (quoting) {
      const w = writtenBar(quoting, b - section.startBar, level, present, { tonic: L.tonic, mode: modeFor(L, 0.5) }, barKey, spans)
      notes = [...notes.filter(n => !quoting.layers.has(n.layer)), ...w.notes]
      drumHits = [...drumHits.filter(d => !quoting.layers.has(d.layer)), ...w.drums]
    }

    // Era: layers that have handed over play their chip or acoustic counterpart.
    ;({ notes, drums: drumHits } = eraBar(notes, drumHits, era))

    // Mix: entering layers swell or start on the beat; leaving ones die away.
    const mix: BarPlan['mix'] = {}
    for (const l of LAYERS) {
      const on = present.has(l)
      const m: LayerMix = { gain: on ? 1 : 0, fadeBars: 0 }
      if (entered.has(l)) m.fadeBars = SOFT.has(l) ? 1 : 0
      else if (left.has(l)) m.fadeBars = SOFT.has(l) ? 2 : 1
      mix[l] = m
    }

    // Effects, ambience and scene.
    let fx = fxFor(L)
    let ambience = ambienceFor(L)
    let ambienceFadeBars = 2
    const sceneOf = (x: Landscape) => x.scene ?? x.id
    let scene = { from: sceneOf(L), to: sceneOf(L), blendStart: 1, blendEnd: 1 }
    if (move && b >= move.bridgeStart) {
      const t0 = bridgeBar / bridgeBars
      const t1 = (bridgeBar + 1) / bridgeBars
      fx = mixFx(fxFor(move.from), fxFor(move.to), t1)
      ambience = ambienceFor(move.to)
      ambienceFadeBars = Math.max(1, bridgeBars - bridgeBar)
      scene = { from: sceneOf(move.from), to: sceneOf(move.to), blendStart: t0, blendEnd: t1 }
    }

    // Display.
    const upcoming = schedule.filter(e => e.on).map(e => ({ layer: e.layer, inBars: e.bar - b }))
    let transition: TransitionInfo = { kind: 'none', from: L.id, to: L.id, progress: 1, note: '' }
    if (move) {
      const total = move.bridgeStart + move.bridgeBars - move.requestBar
      const done = b - move.requestBar
      transition = {
        kind: 'landscape', from: move.from.id, to: move.to.id,
        progress: Math.min(0.7, (done / Math.max(1, total)) * 0.7),
        note: b < move.bridgeStart
          ? `→ ${move.to.name} · bridge in ${move.bridgeStart - b}`
          : `→ ${move.to.name} · bridge ${bridgeBar + 1}/${bridgeBars}${move.pivot ? ' · pivot ' + move.pivot : ''}`,
      }
    } else if (building && (upcoming.length || b - building.startBar < 2)) {
      const next = upcoming[0]
      transition = {
        kind: 'landscape', from: building.from, to: building.to,
        progress: 0.7 + 0.3 * (1 - upcoming.length / Math.max(1, building.total)),
        note: next ? `arriving · ${next.layer} in ${next.inBars}` : 'arriving',
      }
    } else if (breath && b >= breath.start) {
      transition = { kind: 'intensity', from: L.id, to: L.id, progress: 0.5, note: 'breathing' }
    } else if (upcoming.length || schedule.some(e => !e.on)) {
      const next = upcoming[0]
      const off = schedule.find(e => !e.on)
      transition = {
        kind: 'intensity', from: L.id, to: L.id, progress: 0.5,
        note: next ? `${next.layer} in ${next.inBars}` : off ? `${off.layer} out in ${off.bar - b}` : '',
      }
    } else if (modeNote && modeNote.until > b) {
      transition = { kind: 'mood', from: L.id, to: L.id, progress: 1, note: modeNote.text }
    } else if (quoting) {
      transition = { kind: 'none', from: L.id, to: L.id, progress: 1, note: `quoting ${quoting.phrase.name || 'a written phrase'}` }
    }
    if (building && !upcoming.length && b - building.startBar >= 2) building = null

    bar++
    return {
      index: b,
      bpmStart,
      bpmEnd,
      swing: land.swing,
      chords: spans,
      key: barKey,
      scale,
      notes,
      drums: drumHits,
      mix,
      fx,
      ambience,
      ambienceFadeBars,
      meta: {
        landscape: land.id,
        scene,
        phraseBar: inBridge ? bridgeBar : phraseBar,
        phraseBars: inBridge ? bridgeBars : phraseBars,
        section: inBridge ? 'bridge' : sectionLabel(section),
        active: LAYERS.filter(l => present.has(l)),
        upcoming,
        transition,
        intensity: level,
        nextChord: nextSpans[0]?.chord.symbol,
      },
    }
  }

  return {
    nextBar,
    setControls,
    get controls() { return { ...controls } },
    get seed() { return seed },
    get landscape() { return L },
  }
}

/** Exposed for tests. */
export const _internal = { CADENCE, MODE_STEPS }
