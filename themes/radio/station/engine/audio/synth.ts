// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
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
  /** NES noise channel, long mode (hiss) and short mode (metallic buzz), 1 s each. */
  nesLong: AudioBuffer
  nesShort: AudioBuffer
  pulse25: PeriodicWave
  pulse12: PeriodicWave
  /** Current grit 0..1; voices add a little random detune with it. */
  grit: number
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
  return { ac, white, pink, brown, metal, nesLong, nesShort, pulse25: pulse(0.25), pulse12: pulse(0.125), grit: 0 }
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

/** Returned by voices; lets the player tie a repeated pad/drone note instead of re-attacking it. */
export interface NoteHandle {
  /** Nominal end (at + dur), before the release. */
  end: number
  /** Move the release to `newEnd`. False if the note cannot be extended (percussive, already releasing). */
  extend(newEnd: number): boolean
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

/** An oscillator started at the note's time. `detune` in cents; grit adds a little random spread. */
export function osc(n: Note, type: Wave, f: number, detune = 0, at = n.at): OscillatorNode {
  const o = n.ac.createOscillator()
  if (type === 'pulse25') o.setPeriodicWave(n.res.pulse25)
  else if (type === 'pulse12') o.setPeriodicWave(n.res.pulse12)
  else o.type = type
  o.frequency.value = safeHz(n.ac, f)
  const spread = n.res.grit * (Math.random() * 2 - 1) * 5
  if (detune || spread) o.detune.value = detune + spread
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
  for (const s of n.srcs) s.stop(end)
  const first = n.srcs[0]
  if (first) {
    first.onended = () => {
      try { n.tail.disconnect() } catch { /* already gone */ }
    }
  }
  const handle: NoteHandle = {
    end: nominalEnd,
    extend(newEnd: number): boolean {
      if (relAt < 0 || newEnd <= relAt) return false
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
      g.setTargetAtTime(0, newEnd, Math.max(0.004, release / 5))
      relAt = newEnd
      end = newStop
      handle.end = newEnd
      return true
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
