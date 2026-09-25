// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The conductor steers the music toward the listener's Controls, one bar at
 * a time, and moves only where a musician would:
 *
 * - Layers enter one by one on half-phrase boundaries, two bars apart;
 *   drums get a pickup fill, the lead waits for a phrase to begin.
 * - Layers leave when the phrase ends; drums close with a fill.
 * - A new landscape waits for the phrase to end, then a four-bar bridge
 *   pivots the harmony into the new key while tempo, effects, ambience and
 *   the painted scene glide across. The new place arrives with pad and
 *   drone and builds back up to the chosen intensity.
 * - Mood changes the mode at the next phrase; density too. Tempo glides
 *   across a phrase.
 * - Left alone, the music has form: sections A, A2, B, A over the
 *   landscape's progressions, and now and then a phrase where the drums and
 *   lead step out to breathe.
 */
import type {
  BarPlan, Chord, ChordSpan, ConductorLike, Controls, FxState, Key, Landscape, Layer, LayerMix,
  Mode, Progression, TransitionInfo,
} from './types.ts'
import { DEFAULT_CONTROLS, LAYERS } from './types.ts'
import { createRng, hashSeed } from './rng.ts'
import type { Rng } from './rng.ts'
import { keyName, parseProgression, parseToken, scalePcs, MODE_STEPS } from './theory.ts'
import type { ParsedToken } from './theory.ts'
import { composeBar, makeMotif, newMemory, varyMotif } from './composer.ts'
import type { Motif } from './composer.ts'

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
  name: 'A' | 'A2' | 'B'
  startBar: number
  prog: Progression
  seed: number
  motif: Motif
  motifB: Motif
  phrases: number
  phrasesDone: number
}

interface Scheduled { bar: number; layer: Layer; on: boolean }

interface LandscapeMove {
  from: Landscape
  to: Landscape
  requestBar: number
  bridgeStart: number
  bridgeBars: number
  /** The four bridge bars: chord tokens and the key each is heard in. */
  bridge: Array<{ spans: ChordSpan[]; key: Key; side: 'from' | 'to' }> | null
  pivot: string
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
  let bpmGlide: { from: number; to: number; start: number; bars: number } | null = null
  let lastMode: Mode = key.mode
  let modeNote: { text: string; until: number } | null = null
  /** No entries before this bar (a new place settles first). */
  let settleUntil = 0

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

  function newSection(name: Section['name'], startBar: number): Section {
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
    return { name, startBar, prog, seed: sseed, motif, motifB, phrases, phrasesDone: 0 }
  }

  function nextSectionName(prev: Section['name']): Section['name'] {
    return prev === 'A' ? 'A2' : prev === 'A2' ? 'B' : 'A'
  }

  /** Chord spans of one bar from the section's progression. */
  function sectionHarmony(sec: Section, b: number, k: Key): ChordSpan[] {
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

  function startMove(to: Landscape): void {
    const bridgeStart = phraseBoundary(bar)
    const m: LandscapeMove = { from: L, to, requestBar: bar, bridgeStart, bridgeBars: 4, bridge: null, pivot: '' }
    planBridge(m)
    move = m
    building = null
    breath = null
    // The old place thins out: rhythm and melody finish the phrase, the arp and bells two bars later.
    schedule = schedule.filter(e => !e.on && e.bar >= bar)
    for (const l of ['drums', 'perc', 'lead', 'counter'] as Layer[]) {
      if (present.has(l)) schedule.push({ bar: bridgeStart, layer: l, on: false })
    }
    for (const l of ['arp', 'bells'] as Layer[]) {
      if (present.has(l)) schedule.push({ bar: bridgeStart + 2, layer: l, on: false })
    }
  }

  function arrive(m: LandscapeMove): void {
    L = m.to
    controls.landscape = L.id
    move = null
    phraseStart = bar
    phraseBars = L.phraseBars ?? 8
    key = { tonic: L.tonic, mode: modeFor(L, controls.mood) }
    lastMode = key.mode
    mem = { ...newMemory(), pad: mem.pad }
    schedule = []
    settleUntil = bar + 2
    // Keep what the new place starts with; everything else builds from here.
    const keep = new Set<Layer>(['ambience', 'pad'])
    if (L.drone && L.layers[controls.intensity]?.includes('drone')) keep.add('drone')
    if (L.layers[Math.min(1, controls.intensity)]?.includes('bass') && present.has('bass')) keep.add('bass')
    present = new Set([...present].filter(l => keep.has(l)))
    if (!present.has('pad')) present.add('pad')
    freshTheme(true)
    section = newSection('A', bar)
    bpmGlide = null
    nextBreath = sectionCount + 3 + master.int(3)
    const before = present.size
    reconcile()
    building = { from: m.from.id, to: L.id, startBar: bar, total: Math.max(1, schedule.length + present.size - before) }
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
    const f = land.fx
    const space = controls.space
    return {
      reverb: Math.min(1, f.reverb * (0.35 + 1.3 * space)),
      delay: Math.min(1, f.delay * (0.35 + 1.3 * space)),
      reverbSize: f.reverbSize * (0.65 + 0.7 * space),
      tone: Math.max(0.05, Math.min(1, f.tone * (1.08 - 0.16 * controls.mood))),
      grit: Math.min(1, f.grit * 0.4 + controls.grit * 0.75),
      pump: (f.pump ?? 0) * (present.has('drums') ? 1 : 0),
      width: 0.55 + 0.45 * space,
    }
  }

  function mixFx(a: FxState, b: FxState, t: number): FxState {
    return {
      reverb: lerp(a.reverb, b.reverb, t), delay: lerp(a.delay, b.delay, t),
      reverbSize: lerp(a.reverbSize, b.reverbSize, t), tone: lerp(a.tone, b.tone, t),
      grit: lerp(a.grit, b.grit, t), pump: lerp(a.pump, b.pump, t), width: lerp(a.width, b.width, t),
    }
  }

  function ambienceFor(land: Landscape): BarPlan['ambience'] {
    const thin = 1 - 0.1 * controls.intensity
    const out: BarPlan['ambience'] = {}
    for (const [k, v] of Object.entries(land.ambience)) out[k as keyof BarPlan['ambience']] = (v ?? 0) * thin
    return out
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
    if (move && b === move.bridgeStart + move.bridgeBars) arrive(move)

    // New phrase?
    const phraseStartsHere = b === phraseStart + phraseBars || (b === phraseStart && b === 0)
    if (b === phraseStart + phraseBars) phraseStart = b
    let sectionStart = b === 0
    if (b === 0) { freshTheme(true); section = newSection('A', 0) }
    if (phraseStartsHere && b > 0 && !(move && b >= move.bridgeStart)) {
      if (!building || b !== building.startBar) {
        section.phrasesDone++
        if (section.phrasesDone >= section.phrases && !controls.hold) {
          section = newSection(nextSectionName(section.name), b)
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
      // Tempo glides across the phrase toward the target.
      const target = L.bpm + controls.tempo
      bpmGlide = Math.abs(target - bpmEnd) > 0.01 ? { from: bpmEnd, to: target, start: b, bars: phraseBars } : null
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
    const bridgeSlot = inBridge ? move!.bridge![bridgeBar]! : null
    const land = bridgeSlot?.side === 'to' ? move!.to : L
    const barKey = bridgeSlot ? bridgeSlot.key : key
    const spans = bridgeSlot ? bridgeSlot.spans : sectionHarmony(section, b, key)
    const scale = scalePcs(barKey)

    // Tempo.
    if (inBridge) {
      const a = move!.from.bpm + controls.tempo
      const z = move!.to.bpm + controls.tempo
      bpmStart = lerp(a, z, bridgeBar / 4)
      bpmEnd = lerp(a, z, (bridgeBar + 1) / 4)
    } else if (bpmGlide) {
      const k = b - bpmGlide.start
      bpmStart = lerp(bpmGlide.from, bpmGlide.to, k / bpmGlide.bars)
      bpmEnd = lerp(bpmGlide.from, bpmGlide.to, (k + 1) / bpmGlide.bars)
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

    const lvlNow = effectiveLevel()
    const level = inBridge ? 1 : Math.min(controls.intensity, lvlNow + 1)
    const nextSpans = inBridge
      ? (bridgeBar < 3 ? move!.bridge![bridgeBar + 1]!.spans : tokensToSpans(['1'], { tonic: move!.to.tonic, mode: modeFor(move!.to, controls.mood) }))
      : sectionHarmony(section, b + 1, key)
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
      phraseBars: inBridge ? 4 : phraseBars,
      motif: section.motif,
      motifB: section.motifB,
      leadOn: leadOn && !inBridge,
      fill,
      pickup: drumsOnNext && !inBridge,
      crash,
      present,
      mem,
      mood: controls.mood,
    })

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
      const t0 = bridgeBar / 4
      const t1 = (bridgeBar + 1) / 4
      fx = mixFx(fxFor(move.from), fxFor(move.to), t1)
      ambience = ambienceFor(move.to)
      ambienceFadeBars = Math.max(1, 4 - bridgeBar)
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
          : `→ ${move.to.name} · bridge ${bridgeBar + 1}/4${move.pivot ? ' · pivot ' + move.pivot : ''}`,
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
      notes: composed.notes,
      drums: composed.drums,
      mix,
      fx,
      ambience,
      ambienceFadeBars,
      meta: {
        landscape: land.id,
        scene,
        phraseBar: inBridge ? bridgeBar : phraseBar,
        phraseBars: inBridge ? 4 : phraseBars,
        section: inBridge ? 'bridge' : section.name,
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
