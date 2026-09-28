// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Shared synthesis kit for voices, drums and ambience: generated buffers and
 * waves (built once per context), the per-layer voice context, and a small
 * note builder that starts, envelopes, stops and cleans up a note's nodes.
 *
 * Everything takes a BaseAudioContext, so the same code renders live and in
 * an OfflineAudioContext (tests/audio-harness).
 */
import type { Layer } from '../types.ts'

// ---- resources -------------------------------------------------------------

export interface Resources {
  ac: BaseAudioContext
  /** 4 s mono white noise, loops cleanly (no DC). */
  white: AudioBuffer
  /** 4 s mono pink noise (Kellet filter), -1..1. */
  pink: AudioBuffer
  /** 6 s mono brown noise, start = end so it loops without a click. */
  brown: AudioBuffer
  /** 1.5 s of six detuned square waves (the TR-808 cymbal cluster). */
  metal: AudioBuffer
  /** 1.5 s of the metal cluster under dense white noise: a real cymbal's spectrum with a little ring (kit.acoustic). */
  cymbal: AudioBuffer
  /** NES noise channel, long mode (hiss) and short mode (metallic buzz), 1 s each. */
  nesLong: AudioBuffer
  nesShort: AudioBuffer
  pulse25: PeriodicWave
  pulse12: PeriodicWave
  /** 50 % square with the same 48 harmonics as the pulses (the chip voices' square). */
  pulse50: PeriodicWave
  /** The NES triangle channel: a 4-bit staircase, 32 steps a cycle (band-limited, 48 harmonics). */
  tri4: PeriodicWave
  /** A 10-step triangle for vibrato LFOs at 6 Hz: one step per 60 Hz frame, like a sound driver's pitch table. */
  vibStep: PeriodicWave
  /** Flute tone: the fundamental with weaker 2nd and 3rd harmonics and a trace of the 4th and 5th. */
  flute: PeriodicWave
  /** Waves built on demand and kept for the context (chip.pad's arpeggio gates), by key. */
  wave(key: string, build: () => PeriodicWave): PeriodicWave
  /** Current grit 0..1; voices add a little random detune with it. */
  grit: number
  /** Rendered note buffers (plucked strings, pianos), built on first use. */
  bufs: BufferCache
}

export function createResources(ac: BaseAudioContext): Resources {
  const sr = ac.sampleRate
  const mono = (seconds: number, fill: (d: Float32Array) => void): AudioBuffer => {
    const b = ac.createBuffer(1, Math.floor(sr * seconds), sr)
    fill(b.getChannelData(0))
    return b
  }
  const white = mono(4, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1 })
  const pink = mono(4, d => {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      b0 = 0.99886 * b0 + w * 0.0555179
      b1 = 0.99332 * b1 + w * 0.0750759
      b2 = 0.969 * b2 + w * 0.153852
      b3 = 0.8665 * b3 + w * 0.3104856
      b4 = 0.55 * b4 + w * 0.5329522
      b5 = -0.7616 * b5 - w * 0.016898
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11
      b6 = w * 0.115926
    }
    normalise(d, 0.9)
  })
  const brown = mono(6, d => {
    let x = 0
    for (let i = 0; i < d.length; i++) {
      x = (x + (Math.random() * 2 - 1) * 0.02) * 0.998
      d[i] = x
    }
    // Remove the linear drift so the loop point is seamless, then centre.
    const n = d.length
    const d0 = d[0]!, d1 = d[n - 1]!
    let mean = 0
    for (let i = 0; i < n; i++) { d[i] = d[i]! - (d0 + ((d1 - d0) * i) / (n - 1)); mean += d[i]! }
    mean /= n
    for (let i = 0; i < n; i++) d[i] = d[i]! - mean
    normalise(d, 0.9)
  })
  const metal = mono(1.5, d => {
    // 808 cymbal oscillators; aliasing is fine, everything using it is high-passed.
    const fs = [205.3, 304.4, 369.6, 522.7, 540, 800].map(f => f * 1.6)
    for (let i = 0; i < d.length; i++) {
      let s = 0
      for (const f of fs) s += Math.sin((2 * Math.PI * f * i) / sr) >= 0 ? 1 : -1
      d[i] = s / 6
    }
  })
  const cymbal = mono(1.5, d => {
    const m = metal.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = 0.45 * m[i]! + 0.75 * (Math.random() * 2 - 1)
    normalise(d, 0.9)
  })
  const lfsr = (short: boolean, clock: number) => mono(1, d => {
    let reg = 1
    let acc = 0
    let out = 1
    for (let i = 0; i < d.length; i++) {
      acc += clock / sr
      while (acc >= 1) {
        acc -= 1
        const bit = (reg ^ (reg >> (short ? 6 : 1))) & 1
        reg = (reg >> 1) | (bit << 14)
        out = reg & 1 ? 1 : -1
      }
      d[i] = out * 0.8
    }
  })
  const nesLong = lfsr(false, 28000)
  const nesShort = lfsr(true, 11000)
  const pulse = (duty: number): PeriodicWave => {
    const n = 48
    const real = new Float32Array(n)
    const imag = new Float32Array(n)
    // Band-limited pulse, with a gentle roll-off on the top partials (less fizz).
    for (let k = 1; k < n; k++) imag[k] = ((2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty)) * (k > 24 ? 0.6 : 1)
    return ac.createPeriodicWave(real, imag)
  }
  // The NES triangle: 15, 14, .. 0, 0, 1, .. 15, each step held for 1/32 of the cycle, centred.
  const tri4 = waveFrom(ac, x => {
    const k = Math.floor(x * 32)
    return ((k < 16 ? 15 - k : k - 16) - 7.5) / 7.5
  }, 48)
  // Vibrato table: a triangle sampled at ten points (0, .4, .8, .8, .4, 0, -.4, ...), held.
  const vibStep = waveFrom(ac, x => {
    const k = Math.floor(x * 10)
    return [0, 0.4, 0.8, 0.8, 0.4, 0, -0.4, -0.8, -0.8, -0.4][k] ?? 0
  }, 40, { smooth: true })
  const flute = harmonicWave(ac, [1, 0.3, 0.12, 0.045, 0.018])
  const waves = new Map<string, PeriodicWave>()
  return {
    ac, white, pink, brown, metal, cymbal, nesLong, nesShort,
    pulse25: pulse(0.25), pulse12: pulse(0.125), pulse50: pulse(0.5), tri4, vibStep, flute,
    wave(key, build) {
      let w = waves.get(key)
      if (!w) { w = build(); waves.set(key, w) }
      return w
    },
    grit: 0,
    bufs: createBufferCache(ac),
  }
}

/**
 * A PeriodicWave from one cycle of a shape (`shape(phase)`, phase 0..1),
 * by its first `harmonics` Fourier terms (the DC term is dropped). `smooth`
 * applies Lanczos sigma factors: the steps get ramps of a few milliseconds
 * instead of ringing. `raw` keeps the amplitudes as computed (no
 * normalisation to a peak of 1), for gates and offsets.
 */
export function waveFrom(
  ac: BaseAudioContext, shape: (phase: number) => number, harmonics: number, o: { smooth?: boolean; raw?: boolean } = {},
): PeriodicWave {
  const M = 2048
  const x = new Float64Array(M)
  for (let i = 0; i < M; i++) x[i] = shape((i + 0.5) / M)
  const real = new Float32Array(harmonics + 1)
  const imag = new Float32Array(harmonics + 1)
  for (let k = 1; k <= harmonics; k++) {
    let a = 0, b = 0
    const w = (2 * Math.PI * k) / M
    for (let i = 0; i < M; i++) {
      a += x[i]! * Math.cos(w * (i + 0.5))
      b += x[i]! * Math.sin(w * (i + 0.5))
    }
    const u = (Math.PI * k) / (harmonics + 1)
    const sigma = o.smooth ? Math.sin(u) / u : 1
    real[k] = (2 * a / M) * sigma
    imag[k] = (2 * b / M) * sigma
  }
  return ac.createPeriodicWave(real, imag, { disableNormalization: !!o.raw })
}

/** A PeriodicWave of sine harmonics at the given levels (index 0 = the fundamental), all in sine phase. */
export function harmonicWave(ac: BaseAudioContext, levels: readonly number[]): PeriodicWave {
  const real = new Float32Array(levels.length + 1)
  const imag = new Float32Array(levels.length + 1)
  levels.forEach((l, i) => { imag[i + 1] = l })
  return ac.createPeriodicWave(real, imag)
}

// ---- rendered note buffers ----------------------------------------------------

/**
 * Note buffers rendered in JS (Karplus-Strong strings, additive pianos),
 * keyed by voice, pitch and velocity bucket. Least recently used entries go
 * first once the total passes `budget` samples (default 12 M: 48 MB, about
 * 40 held piano notes or 80 guitar notes).
 */
export interface BufferCache {
  get(key: string, render: () => Float32Array): AudioBuffer
  /** Samples held, for leak checks. */
  readonly samples: number
  readonly size: number
}

export function createBufferCache(ac: BaseAudioContext, budget = 12_000_000): BufferCache {
  const map = new Map<string, AudioBuffer>()
  let samples = 0
  return {
    get(key, render) {
      const hit = map.get(key)
      if (hit) {
        // Map order is insertion order: re-insert to mark it recently used.
        map.delete(key)
        map.set(key, hit)
        return hit
      }
      const data = render()
      const buf = ac.createBuffer(1, Math.max(1, data.length), ac.sampleRate)
      buf.getChannelData(0).set(data)
      map.set(key, buf)
      samples += buf.length
      for (const [k, b] of map) {
        if (samples <= budget || map.size <= 1) break
        map.delete(k)
        samples -= b.length
      }
      return buf
    },
    get samples() { return samples },
    get size() { return map.size },
  }
}

function normalise(d: Float32Array, peak: number): void {
  let m = 0
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]!))
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] = (d[i]! / m) * peak
}

// ---- voice context -----------------------------------------------------------

export interface LayerOut {
  /** Into the layer fader; the layer's reverb and delay sends are post-fader. */
  input: AudioNode
  /** Into the gated reverb (drums and perc only). */
  gate: AudioNode | null
}

/** One per layer. Voices, drums and ambience play into `out`. */
export interface VoiceCtx {
  ac: BaseAudioContext
  res: Resources
  layer: Layer
  out: LayerOut
  /** Persistent per-layer helpers built on first use (ensemble chorus, formant bank). */
  cache: Map<string, AudioNode>
  /** The last lead.glide note on this layer, for portamento. */
  glide: { midi: number; end: number } | null
}

// ---- small helpers -----------------------------------------------------------

export const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12)
export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x)
export const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo)
export const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!

/** Velocity to amplitude: between linear and square, so soft notes stay audible. */
export const velAmp = (vel: number): number => {
  const v = clamp(Number.isFinite(vel) ? vel : 0.7, 0, 1)
  return v * (0.35 + 0.65 * v)
}

/** Key-tracked frequency: `f0` at middle C, moving `amount` octaves per octave. */
export const keyTrack = (f0: number, midi: number, amount = 0.5): number => f0 * Math.pow(2, (amount * (midi - 60)) / 12)

/** Keep filter and oscillator frequencies in a range every browser accepts. */
export const safeHz = (ac: BaseAudioContext, f: number): number => clamp(Number.isFinite(f) ? f : 440, 10, ac.sampleRate * 0.45)

// ---- the note builder --------------------------------------------------------

export type Wave = OscillatorType | 'pulse25' | 'pulse12'

/**
 * An oscillator on a shared PeriodicWave, exactly in tune: no grit spread
 * (the chip voices and the chip.pad gates want the pitch the chip would play).
 * Low rates are allowed (LFOs and gates under 10 Hz).
 */
export function waveOsc(n: Note, wave: PeriodicWave, f: number, at = n.at): OscillatorNode {
  const o = n.ac.createOscillator()
  o.setPeriodicWave(wave)
  o.frequency.value = clamp(Number.isFinite(f) ? f : 440, 0.01, n.ac.sampleRate * 0.45)
  o.start(at)
  n.srcs.push(o)
  return o
}

export interface Note {
  ac: BaseAudioContext
  res: Resources
  at: number
  /** Every started source; all are stopped by `finish`. */
  srcs: AudioScheduledSourceNode[]
  /** The note's VCA. Build the sound into it. */
  amp: GainNode
  /** The node connected to the destination (amp or a panner after it). */
  tail: AudioNode
}

/**
 * A scheduled sound the transport can cut (RadioPlayer.cut): notes, drum hits
 * and ambience events all return one.
 */
export interface Cuttable {
  /** Audio time it starts sounding. */
  readonly start: number
  /** Audio time its sources stop (it is silent from here); moves when it is extended or cut. */
  readonly gone: number
  /**
   * Cut at `at` (clamped to now). Starting at or after `at`: it never sounds.
   * Sounding at `at`: it fades to silence over `fade` seconds, except that
   * with `ring` a percussive sound (no held phase) rings out as scheduled.
   */
  cut(at: number, fade: number, ring: boolean): void
}

/**
 * Freeze an AudioParam's automation at `t`: later events are dropped, the
 * value at `t` holds. Where cancelAndHoldAtTime is missing (Firefox) events
 * from `t` on are dropped and false is returned, so a caller that knows the
 * value can land on it.
 */
export function holdAt(p: AudioParam, t: number): boolean {
  const hold = (p as AudioParam & { cancelAndHoldAtTime?: (t: number) => AudioParam }).cancelAndHoldAtTime
  if (typeof hold === 'function') { hold.call(p, t); return true }
  p.cancelScheduledValues(t)
  return false
}

/**
 * A Cuttable for a one-shot sound whose output passes through `gate`, a gain
 * with no automation of its own (a drum hit's output, an ambience event's
 * input). The owner adds the sound's sources to `srcs` and
 * moves `gone` to the time the last one stops.
 */
export interface GateHandle extends Cuttable {
  gone: number
  srcs: AudioScheduledSourceNode[]
}

export function gateHandle(ac: BaseAudioContext, gate: GainNode, start: number, percussive: boolean): GateHandle {
  const h: GateHandle = {
    start,
    gone: start,
    srcs: [],
    cut(at, fade, ring) {
      const t = Math.max(Number.isFinite(at) ? at : 0, ac.currentTime)
      if (t >= h.gone) return
      if (t <= h.start) {
        gate.gain.setValueAtTime(0, t)
        stopAll(h.srcs, h.start)
        h.gone = h.start
        return
      }
      if (ring && percussive) return
      const f = Math.max(0.005, Number.isFinite(fade) ? fade : 0.08)
      const stop = t + Math.max(0.01, f * 1.3)
      if (stop >= h.gone) return
      holdAt(gate.gain, t)
      gate.gain.setTargetAtTime(0, t, f / 5)
      stopAll(h.srcs, stop)
      h.gone = stop
    },
  }
  return h
}

function stopAll(srcs: AudioScheduledSourceNode[], t: number): void {
  for (const s of srcs) {
    try { s.stop(t) } catch { /* not started or gone */ }
  }
}

/** Returned by voices; lets the player tie a repeated pad/drone note instead of re-attacking it, and cut it. */
export interface NoteHandle extends Cuttable {
  /** Nominal end (at + dur), before the release. */
  end: number
  /** Move the release to `newEnd`. False if the note cannot be extended (percussive, already releasing). */
  extend(newEnd: number): boolean
  /**
   * Release the note at `at` (clamped to now): cancel the scheduled release
   * and fade out over the envelope's release, then stop the sources. No-op
   * once the note is already releasing or gone.
   */
  release(at: number): void
}

/** Start a note: a VCA (silent until an envelope is applied), panned if asked, into `dest`. */
export function begin(res: Resources, at: number, dest: AudioNode, pan = 0): Note {
  const ac = res.ac
  const amp = ac.createGain()
  amp.gain.value = 0
  let tail: AudioNode = amp
  if (pan) {
    const p = ac.createStereoPanner()
    p.pan.value = clamp(pan, -1, 1)
    amp.connect(p)
    tail = p
  }
  tail.connect(dest)
  return { ac, res, at, srcs: [], amp, tail }
}

/**
 * An oscillator started at the note's time. `detune` in cents; grit adds a
 * little random spread. It also runs the voices' LFOs, so rates go down to
 * 0.01 Hz (safeHz's 10 Hz floor is for filters).
 */
export function osc(n: Note, type: Wave, f: number, detune = 0, at = n.at): OscillatorNode {
  const o = n.ac.createOscillator()
  if (type === 'pulse25') o.setPeriodicWave(n.res.pulse25)
  else if (type === 'pulse12') o.setPeriodicWave(n.res.pulse12)
  else o.type = type
  o.frequency.value = clamp(Number.isFinite(f) ? f : 440, 0.01, n.ac.sampleRate * 0.45)
  const spread = n.res.grit * (Math.random() * 2 - 1) * 5
  if (detune || spread) o.detune.value = detune + spread
  o.start(at)
  n.srcs.push(o)
  return o
}

/** A sine LFO at `rate` Hz (0.01–50), started at `at`, with no grit spread. */
export function lfo(n: Note, rate: number, at = n.at): OscillatorNode {
  const o = n.ac.createOscillator()
  o.frequency.value = clamp(Number.isFinite(rate) ? rate : 5, 0.01, 50)
  o.start(at)
  n.srcs.push(o)
  return o
}

/** A looping noise source from a shared buffer, at a random offset. */
export function noise(n: Note, buf: AudioBuffer, rate = 1, at = n.at): AudioBufferSourceNode {
  const s = n.ac.createBufferSource()
  s.buffer = buf
  s.loop = true
  s.playbackRate.value = rate
  s.start(at, Math.random() * (buf.duration - 0.1))
  n.srcs.push(s)
  return s
}

export function filter(ac: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
  const b = ac.createBiquadFilter()
  b.type = type
  b.frequency.value = safeHz(ac, f)
  b.Q.value = q
  return b
}

export function gain(ac: BaseAudioContext, value: number): GainNode {
  const g = ac.createGain()
  g.gain.value = value
  return g
}

/** Connect a chain of nodes left to right; returns the last. */
export function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i]!.connect(nodes[i + 1]!)
  return nodes[nodes.length - 1]!
}

export interface Env {
  /** Peak amplitude. */
  peak: number
  /** Attack seconds (linear). */
  a: number
  /** Decay time constant (seconds) toward the sustain; for percussive notes, the decay to silence. */
  d: number
  /** Sustain as a fraction of peak (gated notes). */
  s: number
  /** Release seconds (to about -55 dB). */
  r: number
  /** false = percussive: ignores the note length and rings out on `d`. */
  gate?: boolean
}

/**
 * Apply an ADSR to the note's VCA. Returns the time the sound is gone.
 * Exponential segments use setTargetAtTime, which never overshoots and needs
 * no zero-guards.
 */
export function envelope(n: Note, dur: number, e: Env): { end: number; relAt: number } {
  const g = n.amp.gain
  const at = n.at
  const a = Math.max(0.001, e.a)
  g.setValueAtTime(0, at)
  g.linearRampToValueAtTime(e.peak, at + a)
  if (e.gate === false) {
    g.setTargetAtTime(0, at + a, Math.max(0.005, e.d))
    return { end: at + a + Math.max(0.005, e.d) * 7, relAt: -1 }
  }
  if (e.s < 1 && e.d > 0) g.setTargetAtTime(e.peak * e.s, at + a, e.d)
  const relAt = Math.max(at + a, at + dur)
  g.setTargetAtTime(0, relAt, Math.max(0.004, e.r / 5))
  return { end: relAt + Math.max(0.02, e.r * 1.3), relAt }
}

/**
 * Stop every source at `end`, free the graph when it has played, and return
 * a handle. `release` is the envelope's release time, needed to extend it.
 */
export function finish(n: Note, env: { end: number; relAt: number }, release: number, nominalEnd: number): NoteHandle {
  let end = env.end
  let relAt = env.relAt
  let released = false
  for (const s of n.srcs) s.stop(end)
  const first = n.srcs[0]
  if (first) {
    first.onended = () => {
      try { n.tail.disconnect() } catch { /* already gone */ }
    }
  }
  const rel = Math.max(0.004, release / 5)
  const handle: NoteHandle = {
    end: nominalEnd,
    extend(newEnd: number): boolean {
      if (released || relAt < 0 || newEnd <= relAt) return false
      // Only while the release is still ahead of the audio clock.
      if (relAt < n.ac.currentTime + 0.02) return false
      const newStop = newEnd + Math.max(0.02, release * 1.3)
      try {
        for (const s of n.srcs) s.stop(newStop)
      } catch {
        return false
      }
      const g = n.amp.gain
      g.cancelScheduledValues(relAt)
      g.setTargetAtTime(0, newEnd, rel)
      relAt = newEnd
      end = newStop
      handle.end = newEnd
      return true
    },
    release(at: number): void {
      const t = Math.max(Number.isFinite(at) ? at : 0, n.ac.currentTime)
      if (released || t >= end || (relAt >= 0 && t >= relAt)) return
      released = true
      const g = n.amp.gain
      // Hold the curve where it is at t (mid-attack or mid-decay), then fall from there.
      holdAt(g, t)
      // Percussive notes (no gate) have a short release of zero: damp them like a quick hand.
      const tau = relAt < 0 ? 0.02 : rel
      g.setTargetAtTime(0, t, tau)
      const stop = t + Math.max(0.03, tau * 6.5)
      if (stop < end) {
        try {
          for (const s of n.srcs) s.stop(stop)
        } catch { /* the sources end on their own schedule */ }
      }
      relAt = t
      end = Math.min(end, stop)
      handle.end = t
    },
    start: n.at,
    get gone() { return end },
    cut(at: number, fade: number, ring: boolean): void {
      const t = Math.max(Number.isFinite(at) ? at : 0, n.ac.currentTime)
      if (t >= end) return
      const g = n.amp.gain
      if (t <= n.at) {
        // Not started: the VCA stays at 0 and the sources stop as they start.
        g.cancelScheduledValues(t)
        g.setValueAtTime(0, t)
        const stop = Math.max(t, n.at)
        try {
          for (const s of n.srcs) s.stop(stop)
        } catch { /* the sources end on their own schedule */ }
        released = true
        relAt = t
        end = stop
        handle.end = t
        return
      }
      if (ring && relAt < 0) return
      const f = Math.max(0.005, Number.isFinite(fade) ? fade : 0.08)
      const stop = t + Math.max(0.01, f * 1.3)
      if (stop >= end) return
      holdAt(g, t)
      g.setTargetAtTime(0, t, f / 5)
      try {
        for (const s of n.srcs) s.stop(stop)
      } catch { /* the sources end on their own schedule */ }
      released = true
      relAt = t
      end = stop
      handle.end = Math.min(handle.end, t)
    },
  }
  return handle
}

/** Delayed vibrato (cents) on a set of oscillators; skipped on short notes. */
export function vibrato(n: Note, oscs: OscillatorNode[], dur: number, rate: number, cents: number, delay: number): void {
  if (dur < delay + 0.12 || cents <= 0) return
  const lfo = osc(n, 'sine', rate * (0.97 + Math.random() * 0.06))
  const depth = n.ac.createGain()
  depth.gain.setValueAtTime(0, n.at)
  depth.gain.setValueAtTime(0, n.at + delay)
  depth.gain.linearRampToValueAtTime(cents, n.at + delay + 0.35)
  lfo.connect(depth)
  for (const o of oscs) depth.connect(o.detune)
}

/** A stereo pair: two sources hard left and right into one stereo node. */
export function stereo(ac: BaseAudioContext, left: AudioNode, right: AudioNode): ChannelMergerNode {
  const m = ac.createChannelMerger(2)
  left.connect(m, 0, 0)
  right.connect(m, 0, 1)
  return m
}
