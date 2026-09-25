// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The scheduling core, independent of how it is clocked: takes BarPlans from
 * the conductor, turns steps into audio times, plays notes, drums, mix moves,
 * fx glides and ambience, and keeps the queues `visual()` reads.
 *
 * It works on any BaseAudioContext. The live player (player.ts) ticks it from
 * a Web Worker; the harness ticks it once over an OfflineAudioContext.
 *
 * Mixer, per layer:
 *
 *   voices ─ fader (mix × trim) ─ [pump] ─┬─ fx.input      (dry)
 *                                         ├─ reverb send ─ fx.reverbIn
 *                                         └─ delay send  ─ fx.delayIn
 *   drums/perc also: gate fader ─ fx.gatedIn
 *
 * Fades are scheduled one linear ramp per bar (see timing.ts `Fade`), so no
 * automation that is already sounding ever has to be cancelled.
 */
import type { BarPlan, ConductorLike, Layer, VisualState, NoteEvent, DrumEvent } from '../types.ts'
import { LAYERS } from '../types.ts'
import { barTiming, type BarTiming, type Fade, fadeAtBarStart, fadeAtBarEnd } from './timing.ts'
import { createResources, type Resources, type VoiceCtx, type NoteHandle, clamp } from './synth.ts'
import { createFx, type Fx } from './fx.ts'
import { playVoice } from './voices.ts'
import { playDrum } from './drums.ts'
import { createAmbience, type Ambience } from './ambience.ts'

/** Layer balance at mix gain 1: lead on top, pads under, ambience a background texture. */
export const LAYER_TRIM: Record<Layer, number> = {
  ambience: 0.55, drone: 0.6, pad: 0.62, bass: 0.9, drums: 0.8, perc: 0.62,
  arp: 0.52, lead: 0.85, counter: 0.5, bells: 0.5,
}

/** Post-fader [reverb, delay] sends per layer (scaled by fx.reverb / fx.delay). */
const SENDS: Record<Layer, [number, number]> = {
  ambience: [0.3, 0], drone: [0.5, 0], pad: [0.45, 0.04], bass: [0.05, 0], drums: [0.1, 0],
  perc: [0.25, 0.08], arp: [0.3, 0.35], lead: [0.35, 0.26], counter: [0.42, 0.14], bells: [0.55, 0.3],
}

/** Default stereo placement when a note has no pan of its own. */
const DEFAULT_PAN: Partial<Record<Layer, number>> = { arp: 0.22, counter: -0.26 }

/** Layers whose repeated notes are tied instead of re-attacked. */
const TIE: Partial<Record<Layer, boolean>> = { pad: true, drone: true }

interface Bus {
  fader: GainNode
  pump: GainNode | null
  gate: GainNode | null
  fade: Fade
  vc: VoiceCtx
  /** Mix gain (untrimmed) over the last scheduled bar: [t0, v0, t1, v1]. */
  ramp: [number, number, number, number]
  started: boolean
}

interface ScheduledBar {
  plan: BarPlan
  t0: number
  t1: number
  tm: BarTiming
  fired: boolean
}

interface Pending { t: number; run: () => void }
interface Sounding { layer: Layer; midi: number; t: number; end: number; vel: number }

export interface Core {
  res: Resources
  fx: Fx
  /** The master output (connect to the destination). */
  output: AudioNode
  /** Plan and schedule everything up to `horizon`; `now` is the audio clock. */
  tick(now: number, horizon: number): void
  /** Bars that have started sounding by `now` and were not reported yet. */
  due(now: number): BarPlan[]
  visual(now: number): Omit<VisualState, 'playing'>
  /** Audio time the first bar started (or -1). */
  readonly startTime: number
  /** Internal queue lengths, for leak checks. */
  sizes(): Record<string, number>
}

export function createCore(ac: BaseAudioContext, conductor: ConductorLike): Core {
  const res = createResources(ac)
  const fx = createFx(ac)

  const buses = {} as Record<Layer, Bus>
  for (const layer of LAYERS) {
    const fader = ac.createGain()
    fader.gain.value = 0
    let post: AudioNode = fader
    let pump: GainNode | null = null
    if (layer === 'pad' || layer === 'drone') {
      pump = ac.createGain()
      fader.connect(pump)
      post = pump
    }
    post.connect(fx.input)
    const [rv, dl] = SENDS[layer]
    if (rv > 0) { const s = ac.createGain(); s.gain.value = rv; post.connect(s); s.connect(fx.reverbIn) }
    if (dl > 0) { const s = ac.createGain(); s.gain.value = dl; post.connect(s); s.connect(fx.delayIn) }
    let gate: GainNode | null = null
    if (layer === 'drums' || layer === 'perc') {
      gate = ac.createGain()
      gate.gain.value = 0
      gate.connect(fx.gatedIn)
    }
    const vc: VoiceCtx = { ac, res, layer, out: { input: fader, gate }, cache: new Map(), glide: null }
    buses[layer] = { fader, pump, gate, fade: { from: 0, to: 0, start: 0, bars: 0 }, vc, ramp: [0, 0, 0, 0], started: false }
  }
  const ambience: Ambience = createAmbience(buses.ambience.vc)

  let nextStart = -1
  let startTime = -1
  const bars: ScheduledBar[] = []
  const pending: Pending[] = []
  let pendingAt = 0
  const sounding: Sounding[] = []
  const hits: Array<{ layer: Layer; t: number; vel: number }> = []
  const kicks: number[] = []
  const ties = new Map<string, NoteHandle>()
  let pumpDepth = 0
  let beatLen = 0.5

  // ---- scheduling ---------------------------------------------------------------------

  function scheduleMix(plan: BarPlan, t0: number, t1: number): void {
    for (const layer of LAYERS) {
      const b = buses[layer]
      const m = plan.mix?.[layer]
      if (m && Number.isFinite(m.gain)) {
        const target = clamp(m.gain, 0, 1.5)
        if (target !== b.fade.to || !b.started) b.fade = { from: fadeAtBarStart(b.fade, plan.index), to: target, start: plan.index, bars: Math.max(0, m.fadeBars || 0) }
      }
      const v0 = fadeAtBarStart(b.fade, plan.index)
      const v1 = fadeAtBarEnd(b.fade, plan.index)
      const trim = LAYER_TRIM[layer]
      const params = b.gate ? [b.fader.gain, b.gate.gain] : [b.fader.gain]
      for (const p of params) {
        if (!b.started) p.setValueAtTime(v0 * trim, t0)
        if (b.fade.bars <= 0 && plan.index === b.fade.start) p.linearRampToValueAtTime(v1 * trim, Math.min(t1, t0 + 0.03))
        p.linearRampToValueAtTime(v1 * trim, t1)
      }
      b.started = true
      b.ramp = [t0, v0, t1, v1]
    }
  }

  function noteEvent(e: NoteEvent, t: number, dur: number): void {
    const b = buses[e.layer] ?? buses.lead
    const pan = e.pan ?? (e.layer === 'bells' ? (Math.random() * 2 - 1) * 0.35 : DEFAULT_PAN[e.layer] ?? 0)
    if (TIE[e.layer]) {
      const key = `${e.layer}|${e.voice}|${e.midi}`
      const prev = ties.get(key)
      if (prev && Math.abs(prev.end - t) < 0.03 && prev.extend(t + dur)) return
      const h = playVoice(b.vc, e.voice, e.midi, t, dur, e.vel, e.opts, pan)
      if (h) ties.set(key, h)
      return
    }
    playVoice(b.vc, e.voice, e.midi, t, dur, e.vel, e.opts, pan)
  }

  function drumEvent(e: DrumEvent, t: number, len: number): void {
    const b = buses[e.layer] ?? buses.drums
    playDrum(b.vc, e.kit, e.hit, t, e.vel, len)
    if (e.hit === 'k' && e.layer === 'drums') {
      kicks.push(t)
      // The pump: duck pads and drones on the kick, recover over about a quarter of a beat.
      const drumsLevel = b.ramp[3]
      const depth = clamp(pumpDepth * drumsLevel, 0, 1) * 0.6
      if (depth > 0.01) {
        for (const l of ['pad', 'drone'] as const) {
          const p = buses[l].pump!.gain
          p.setTargetAtTime(1 - depth, t, 0.006)
          p.setTargetAtTime(1, t + 0.04, beatLen * 0.22)
        }
      }
    }
  }

  function scheduleBar(plan: BarPlan, t0: number): number {
    const tm = barTiming(plan.bpmStart, plan.bpmEnd, plan.swing ?? 0)
    const t1 = t0 + tm.dur
    const bpm = plan.bpmStart
    beatLen = 60 / Math.max(20, bpm || 100)
    res.grit = clamp(plan.fx?.grit ?? 0, 0, 1)
    pumpDepth = clamp(plan.fx?.pump ?? 0, 0, 1)
    if (plan.fx) fx.apply(plan.fx, t0, tm.dur, bpm)
    scheduleMix(plan, t0, t1)
    ambience.bar(plan, t0, t1)

    const evs: Pending[] = []
    for (const e of plan.notes ?? []) {
      if (!Number.isFinite(e.step) || !Number.isFinite(e.midi)) continue
      const t = t0 + tm.at(e.step)
      const dur = Math.max(0.02, tm.at(e.step + Math.max(0.05, e.len)) - tm.at(e.step))
      evs.push({ t, run: () => noteEvent(e, t, dur) })
      sounding.push({ layer: e.layer, midi: e.midi, t, end: t + dur, vel: e.vel })
    }
    for (const e of plan.drums ?? []) {
      if (!Number.isFinite(e.step)) continue
      const t = t0 + tm.at(e.step)
      const len = e.len ? tm.at(e.step + e.len) - tm.at(e.step) : tm.dur / 4
      evs.push({ t, run: () => drumEvent(e, t, len) })
      hits.push({ layer: e.layer, t, vel: e.vel })
    }
    evs.sort((a, b) => a.t - b.t)
    for (const ev of evs) pending.push(ev)
    sounding.sort((a, b) => a.t - b.t)
    bars.push({ plan, t0, t1, tm, fired: false })
    return t1
  }

  function tick(now: number, horizon: number): void {
    if (nextStart < 0) {
      nextStart = now + 0.08
      startTime = nextStart
    }
    // After a stall (CPU starvation, a suspended tab), pick up from now instead of rushing.
    if (nextStart < now) nextStart = now + 0.05
    let guard = 0
    while (nextStart <= horizon && guard++ < 64) {
      const plan = conductor.nextBar()
      nextStart = scheduleBar(plan, nextStart)
    }
    // Create the nodes for everything due before the horizon; drop what is badly late.
    while (pendingAt < pending.length && pending[pendingAt]!.t < horizon) {
      const ev = pending[pendingAt++]!
      if (ev.t >= now - 0.08) {
        try { ev.run() } catch (err) { if (typeof console !== 'undefined') console.error('radio: event failed', err) }
      }
    }
    if (pendingAt > 256) { pending.splice(0, pendingAt); pendingAt = 0 }
    ambience.run(horizon)
    prune(now)
  }

  function prune(now: number): void {
    const old = now - 3
    let i = 0
    while (i < sounding.length && sounding[i]!.end < old && sounding[i]!.t < old) i++
    if (i > 0) sounding.splice(0, i)
    // Sounding is sorted by start; long notes can hold older entries, cap the length instead.
    if (sounding.length > 600) sounding.splice(0, sounding.length - 600)
    let j = 0
    while (j < hits.length && hits[j]!.t < old) j++
    if (j > 0) hits.splice(0, j)
    let k = 0
    while (k < kicks.length && kicks[k]! < old) k++
    if (k > 0) kicks.splice(0, k)
    while (bars.length > 2 && bars[1]!.t0 <= now && bars[0]!.fired && bars[1]!.fired) bars.shift()
    if (ties.size > 64) for (const [key, h] of ties) if (h.end < now - 1) ties.delete(key)
  }

  function due(now: number): BarPlan[] {
    const out: BarPlan[] = []
    for (const b of bars) {
      if (!b.fired && b.t0 <= now) {
        b.fired = true
        out.push(b.plan)
      }
    }
    return out
  }

  // ---- what the page reads ------------------------------------------------------------

  function visual(now: number): Omit<VisualState, 'playing'> {
    let cur: ScheduledBar | null = null
    for (const b of bars) if (b.t0 <= now) cur = b
    const step = cur ? clamp(cur.tm.stepAt(now - cur.t0), 0, 16) : 0
    const sc = cur?.plan.meta?.scene
    const scene = sc
      ? { from: sc.from, to: sc.to, blend: clamp(sc.blendStart + ((sc.blendEnd - sc.blendStart) * step) / 16, 0, 1) }
      : { from: '', to: '', blend: 0 }
    let beat = 0
    for (let i = kicks.length - 1; i >= 0; i--) {
      const k = kicks[i]!
      if (k > now) continue
      const x = (now - k) / beatLen
      beat = x < 1 ? (1 - x) * (1 - x) : 0
      break
    }
    const levels = {} as Record<Layer, number>
    const act = {} as Record<Layer, number>
    for (const l of LAYERS) act[l] = 0
    for (const n of sounding) {
      if (n.t > now) continue
      const tail = now - n.end
      const a = tail <= 0 ? n.vel : n.vel * Math.max(0, 1 - tail / 0.4)
      if (a > act[n.layer]) act[n.layer] = a
    }
    for (const h of hits) {
      if (h.t > now) continue
      const a = h.vel * Math.max(0, 1 - (now - h.t) / 0.3)
      if (a > act[h.layer]) act[h.layer] = a
    }
    act.ambience = ambience.level(now)
    for (const l of LAYERS) {
      const [t0, v0, t1, v1] = buses[l].ramp
      const g = now >= t1 ? v1 : now <= t0 ? v0 : v0 + ((v1 - v0) * (now - t0)) / (t1 - t0)
      levels[l] = clamp(g * act[l], 0, 1)
    }
    const recent: VisualState['recent'] = []
    for (const n of sounding) {
      if (n.t <= now && now - n.t < 2) recent.push({ layer: n.layer, midi: n.midi, age: now - n.t })
    }
    recent.sort((a, b) => b.age - a.age)
    if (recent.length > 24) recent.splice(0, recent.length - 24)
    return {
      bar: cur ? cur.plan : null,
      step,
      scene,
      beat,
      levels,
      recent,
      time: startTime < 0 ? 0 : Math.max(0, now - startTime),
    }
  }

  return {
    res,
    fx,
    output: fx.output,
    tick,
    due,
    visual,
    get startTime() { return startTime },
    sizes: () => ({ bars: bars.length, pending: pending.length - pendingAt, sounding: sounding.length, hits: hits.length, kicks: kicks.length, ties: ties.size }),
  }
}
