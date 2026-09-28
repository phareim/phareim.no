// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
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
 *
 * Live notes (`live()`, an instrument under the player's fingers) play on
 * the same buses 5 ms after the call, with a 30 s nominal length that the
 * returned handle's release() cuts short.
 *
 * Transport (jam): `cut(at)` takes back what is scheduled from `at` on. Every
 * scheduled note, drum hit and ambience event keeps a Cuttable (synth.ts)
 * until its sources stop; the cut silences those starting from `at`, fades
 * or rings out those sounding, drops the bar and visual queues after `at`,
 * holds mix, pump and fx automation at their values there, and makes `at`
 * the start of the next bar. `tick(now, horizon, false)` is the idle
 * transport: it plays out what is scheduled but plans no bars, and fades the
 * ambience out once the scheduled music has ended. Live notes are never cut.
 */
import type { BarPlan, ConductorLike, Layer, VisualState, NoteEvent, DrumEvent, LiveSound, LiveNote } from '../types.ts'
import { LAYERS } from '../types.ts'
import {
  barTiming, type BarTiming, type Fade, type PlacedBar, type Ramp, fadeAtBarStart, fadeAtBarEnd, positionIn,
  rampAt, pruneRamps, cutBars, keepWhere,
} from './timing.ts'
import { createResources, type Resources, type VoiceCtx, type NoteHandle, type Cuttable, clamp, holdAt } from './synth.ts'
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
  ramp: Ramp
  /** The recent ramps, to read the gain back at a cut. */
  ramps: Ramp[]
  started: boolean
  /** The glide state the last scheduled lead.glide note left (a cut forgets it). */
  glide: VoiceCtx['glide']
}

interface ScheduledBar {
  plan: BarPlan
  t0: number
  t1: number
  tm: BarTiming
  fired: boolean
  /** The last bar before a cut: it shows in visual() only until its (cut) end. */
  cut?: boolean
}

interface Pending { t: number; run: () => void }
interface Sounding { layer: Layer; midi: number; t: number; end: number; vel: number; live?: boolean }
interface Hit { layer: Layer; t: number; vel: number; live?: boolean }

/** How long the ambience takes to fade out once an idle transport has run out of bars. */
const IDLE_AMBIENCE_FADE = 0.5

export interface Core {
  res: Resources
  fx: Fx
  /** The master output (connect to the destination). */
  output: AudioNode
  /**
   * Plan and schedule everything up to `horizon`; `now` is the audio clock.
   * With `plan` false (an idle transport) no new bar is planned: what is
   * scheduled plays out, then the ambience fades out.
   */
  tick(now: number, horizon: number, plan?: boolean): void
  /**
   * Take back everything scheduled from `at` on (RadioPlayer.cut). `at` is
   * clamped to [now, end of the scheduled bars]; the next planned bar starts at it.
   */
  cut(at: number, fade: number, ring: boolean): void
  /** If the scheduled bars end before `at`, the next bar starts at `at` (leaving idle). */
  rearm(at: number): void
  /** Bars that have started sounding by `now` and were not reported yet. */
  due(now: number): BarPlan[]
  visual(now: number): Omit<VisualState, 'playing'>
  /** Play a note now on `layer`'s bus (see RadioPlayer.live). */
  live(layer: Layer, sound: LiveSound, vel: number, pan?: number): LiveNote
  /** The bar and musical step at audio time `time`, or null outside the scheduled bars. */
  positionAt(time: number): { bar: number; step: number } | null
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
    buses[layer] = {
      fader, pump, gate, fade: { from: 0, to: 0, start: 0, bars: 0 }, vc, ramp: [0, 0, 0, 0], ramps: [], started: false, glide: null,
    }
  }
  const ambience: Ambience = createAmbience(buses.ambience.vc)

  let nextStart = -1
  let startTime = -1
  const bars: ScheduledBar[] = []
  /** Timing of the recent and scheduled bars, kept a few seconds longer than `bars` for positionAt. */
  const placed: PlacedBar[] = []
  const pending: Pending[] = []
  let pendingAt = 0
  const sounding: Sounding[] = []
  const hits: Hit[] = []
  const kicks: number[] = []
  const ties = new Map<string, NoteHandle>()
  /** Scheduled notes and drum hits that have not stopped yet, for a cut. */
  const scheduled: Cuttable[] = []
  /** The idle transport has faded the ambience out (reset when a bar is planned or cut). */
  let idle = false
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
      const jump = b.fade.bars <= 0 && plan.index === b.fade.start
      for (const p of params) {
        if (!b.started) p.setValueAtTime(v0 * trim, t0)
        if (jump) p.linearRampToValueAtTime(v1 * trim, Math.min(t1, t0 + 0.03))
        p.linearRampToValueAtTime(v1 * trim, t1)
      }
      b.started = true
      b.ramp = [t0, v0, t1, v1]
      if (jump) b.ramps.push([t0, v0, Math.min(t1, t0 + 0.03), v1], [Math.min(t1, t0 + 0.03), v1, t1, v1])
      else b.ramps.push(b.ramp)
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
      if (h) { ties.set(key, h); scheduled.push(h) }
      return
    }
    const h = playVoice(b.vc, e.voice, e.midi, t, dur, e.vel, e.opts, pan)
    if (h) scheduled.push(h)
    if (e.voice === 'lead.glide') b.glide = b.vc.glide
  }

  /** A drum hit; scheduled ones (not `live`) are kept for a cut. */
  function drumEvent(e: DrumEvent, t: number, len: number, live = false): void {
    const b = buses[e.layer] ?? buses.drums
    const h = playDrum(b.vc, e.kit, e.hit, t, e.vel, len)
    if (h && !live) scheduled.push(h)
    if (e.hit === 'k' && e.layer === 'drums') {
      // Sorted: a live kick can land before kicks already scheduled.
      let i = kicks.length
      while (i > 0 && kicks[i - 1]! > t) i--
      kicks.splice(i, 0, t)
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
    placed.push({ index: plan.index, t0, t1, tm })
    return t1
  }

  function tick(now: number, horizon: number, plan = true): void {
    if (plan) {
      if (nextStart < 0) {
        nextStart = now + 0.08
        startTime = nextStart
      }
      // After a stall (CPU starvation, a suspended tab), pick up from now instead of rushing.
      if (nextStart < now) nextStart = now + 0.05
      let guard = 0
      while (nextStart <= horizon && guard++ < 64) {
        const bar = conductor.nextBar()
        nextStart = scheduleBar(bar, nextStart)
        idle = false
      }
    } else if (!idle && (nextStart < 0 || now >= nextStart)) {
      // Idle, and the scheduled music has ended: nothing will move the ambience again, so fade it out.
      idle = true
      if (nextStart >= 0) ambience.silence(now, IDLE_AMBIENCE_FADE)
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
    while (placed.length > 1 && placed[0]!.t1 < now - 8) placed.shift()
    if (ties.size > 64) for (const [key, h] of ties) if (h.end < now - 1) ties.delete(key)
    keepWhere(scheduled, h => h.gone >= now)
    ambience.prune(now)
    for (const l of LAYERS) pruneRamps(buses[l].ramps, now - 1)
  }

  // ---- the transport cut ----------------------------------------------------------------

  function cut(at0: number, fade: number, ring: boolean): void {
    if (!Number.isFinite(at0) || nextStart < 0) return
    // Past the scheduled bars nothing is left to take back; never before now.
    const at = Math.max(Math.min(at0, nextStart), ac.currentTime)
    // Bars: nothing starts from `at`; the bar sounding there ends there.
    cutBars(bars, at)
    const last = bars[bars.length - 1]
    if (last) last.cut = true
    cutBars(placed, at)
    // Events not built yet are dropped; built ones are cut through their handles.
    const rest = pending.slice(pendingAt).filter(ev => ev.t < at)
    pending.length = 0
    pending.push(...rest)
    pendingAt = 0
    for (const h of scheduled) h.cut(at, fade, ring)
    ambience.cut(at, fade, ring)
    ties.clear()
    // Visual queues: what starts from `at` never happened; scheduled notes sounding there end there.
    keepWhere(sounding, n => n.live === true || n.t < at)
    for (const n of sounding) if (!n.live && n.end > at) n.end = at
    keepWhere(hits, h => h.live === true || h.t < at)
    keepWhere(kicks, k => k < at)
    // Mix and pump: hold the faders where they are at `at`; the pump recovers (its kicks are gone).
    for (const l of LAYERS) {
      const b = buses[l]
      const lv = rampAt(b.ramps, at, b.ramp[3])
      const trim = LAYER_TRIM[l]
      for (const p of b.gate ? [b.fader.gain, b.gate.gain] : [b.fader.gain]) {
        // Without cancelAndHoldAtTime the ramp is gone: land on the gain it had at `at`.
        if (!holdAt(p, at)) p.linearRampToValueAtTime(lv * trim, at)
      }
      if (b.pump) {
        holdAt(b.pump.gain, at)
        b.pump.gain.setTargetAtTime(1, at, 0.03)
      }
      b.fade = { from: lv, to: lv, start: 0, bars: 0 }
      b.ramp = [at, lv, at, lv]
      b.ramps.length = 0
      b.ramps.push(b.ramp)
      // A glide note that was cut must not slide into the next bar's first note.
      if (b.glide && b.vc.glide === b.glide && b.glide.end > at) b.vc.glide = null
      b.glide = null
    }
    fx.hold(at)
    nextStart = at
    idle = false
  }

  function rearm(at: number): void {
    if (!Number.isFinite(at) || nextStart >= at) return
    nextStart = at
    if (startTime < 0) startTime = at
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
    if (cur?.cut && now >= cur.t1) cur = null
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

  // ---- live notes ---------------------------------------------------------------------

  const LIVE_DUR = 30

  function live(layer: Layer, sound: LiveSound, vel: number, pan?: number): LiveNote {
    const t = ac.currentTime + 0.005
    const b = buses[layer] ?? buses.lead
    const v = clamp(Number.isFinite(vel) ? vel : 0.7, 0, 1)
    if ('kit' in sound) {
      const l = b.vc.layer
      // Drums and perc as scheduled hits (the kick pumps and drives the beat); any other layer just plays it.
      if (l === 'drums' || l === 'perc') drumEvent({ layer: l, kit: sound.kit, hit: sound.hit, step: 0, vel: v }, t, beatLen, true)
      else playDrum(b.vc, sound.kit, sound.hit, t, v, beatLen)
      insertHit({ layer: l, t, vel: v, live: true })
      return { release() {} }
    }
    const p = pan ?? DEFAULT_PAN[b.vc.layer] ?? 0
    // Legato for the mono glide lead: it slides only while the previous live note is still held.
    const h = playVoice(b.vc, sound.voice, sound.midi, t, LIVE_DUR, v, { legato: true }, p)
    const s: Sounding = { layer: b.vc.layer, midi: sound.midi, t, end: t + LIVE_DUR, vel: v, live: true }
    insertSounding(s)
    let done = false
    return {
      release() {
        if (done) return
        done = true
        const r = ac.currentTime
        h?.release(r)
        if (s.end > r) s.end = r
        const g = b.vc.glide
        if (g && g.midi === sound.midi && g.end > r) g.end = r
      },
    }
  }

  function insertSounding(s: Sounding): void {
    let i = sounding.length
    while (i > 0 && sounding[i - 1]!.t > s.t) i--
    sounding.splice(i, 0, s)
  }

  function insertHit(h: Hit): void {
    let i = hits.length
    while (i > 0 && hits[i - 1]!.t > h.t) i--
    hits.splice(i, 0, h)
  }

  return {
    res,
    fx,
    live,
    positionAt: (time: number) => positionIn(placed, time),
    output: fx.output,
    tick,
    cut,
    rearm,
    due,
    visual,
    get startTime() { return startTime },
    sizes: () => ({
      bars: bars.length, placed: placed.length, pending: pending.length - pendingAt, sounding: sounding.length,
      hits: hits.length, kicks: kicks.length, ties: ties.size, bufs: res.bufs.size,
      scheduled: scheduled.length, ambienceEvents: ambience.events,
    }),
  }
}
