// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Pitched voices: one synth patch per VoiceId in types.ts.
 *
 *   playVoice(v, id, midi, at, dur, vel, opts, pan) → NoteHandle
 *
 * `v` is the layer's VoiceCtx (its output bus and shared resources). Every
 * patch builds a few oscillators into a filter and a VCA, schedules its
 * envelope, stops every source and frees its nodes when done. Per-note node
 * counts stay small (4–12): this plays for hours on a laptop.
 *
 * Voices that want a shared effect (the string machine's ensemble chorus, the
 * choir's formant bank) build it once per layer in `v.cache` and play into it.
 *
 * Levels: LEVEL[id] scales each patch so they sit at a similar loudness for
 * the same velocity (calibrated with tests/audio-harness). The mix balance
 * between layers lives in the player, not here.
 */
import type { VoiceId, NoteEvent } from '../types.ts'
import {
  type VoiceCtx, type Note, type NoteHandle, type Env,
  begin, osc, noise, filter, gain, chain, envelope, finish, vibrato, stereo,
  hz, clamp, rand, velAmp, keyTrack, safeHz,
} from './synth.ts'

type Opts = NoteEvent['opts']
type Patch = (v: VoiceCtx, midi: number, at: number, dur: number, vel: number, opts: Opts, pan: number) => NoteHandle

/** Per-voice loudness trim (linear). Calibrated from the harness level table. */
const LEVEL: Record<VoiceId, number> = {
  'lead.square': 0.0935, 'lead.saw': 0.0817, 'lead.pulse': 0.176, 'lead.ep': 0.119, 'lead.hollow': 0.0874,
  'lead.fm': 0.104, 'lead.glide': 0.0772, 'lead.whistle': 0.0865,
  'mallet.kalimba': 0.117, 'mallet.marimba': 0.125, 'pluck.harp': 0.0817,
  'arp.square': 0.113, 'arp.pluck': 0.148, 'arp.warm': 0.138, 'arp.glass': 0.149, 'arp.seq': 0.122,
  'pad.saw': 0.0698, 'pad.strings': 0.0699, 'pad.choir': 0.242, 'pad.glass': 0.0524, 'pad.warm': 0.059, 'pad.dark': 0.0742,
  'bass.saw': 0.0836, 'bass.square': 0.0624, 'bass.round': 0.0875, 'bass.sub': 0.0629, 'bass.pluck': 0.0826, 'bass.fm': 0.0864,
  'bell.glass': 0.121, 'bell.fm': 0.108, 'bell.chime': 0.176,
  'counter.strings': 0.15, 'counter.soft': 0.107,
  'drone.sub': 0.0627, 'drone.organ': 0.0456, 'drone.shimmer': 0.0342,
}

// ---- helpers -----------------------------------------------------------------

/** Gated note with a standard envelope; returns the handle. */
function done(n: Note, dur: number, e: Env): NoteHandle {
  const env = envelope(n, dur, e)
  return finish(n, env, e.r, n.at + dur)
}

/** Filter envelope: from `peak` down to `rest` with time constant `tau`. */
function sweep(n: Note, f: BiquadFilterNode, peak: number, rest: number, tau: number, at = n.at): void {
  f.frequency.setValueAtTime(safeHz(n.ac, peak), at)
  f.frequency.setTargetAtTime(safeHz(n.ac, rest), at + 0.002, Math.max(0.005, tau))
}

/** An FM operator: a sine at `ratio × f` whose output (in Hz) modulates `target`. */
function modulator(n: Note, f: number, ratio: number, target: AudioParam, index: number, restIndex: number, tau: number): GainNode {
  const m = osc(n, 'sine', f * ratio)
  const g = n.ac.createGain()
  g.gain.setValueAtTime(index * f, n.at)
  g.gain.setTargetAtTime(restIndex * f, n.at + 0.001, Math.max(0.005, tau))
  m.connect(g)
  g.connect(target)
  return g
}

/** A partial with its own decay (sine at `ratio × f`, level `lvl`, time constant `tau`) into `dest`. */
function partial(n: Note, f: number, ratio: number, lvl: number, tau: number, dest: AudioNode, type: OscillatorType = 'sine'): void {
  if (f * ratio > n.ac.sampleRate * 0.42) return
  const o = osc(n, type, f * ratio)
  const g = n.ac.createGain()
  g.gain.setValueAtTime(lvl, n.at)
  g.gain.setTargetAtTime(0, n.at + 0.002, tau)
  o.connect(g)
  g.connect(dest)
}

/**
 * The string machine's ensemble: three chorus lines at 120° phase offsets,
 * each wobbling slowly (0.6 Hz) and quickly (5.5 Hz), spread left, centre,
 * right. Built once per layer; lives for the session.
 */
function ensemble(v: VoiceCtx): AudioNode {
  const hit = v.cache.get('ensemble')
  if (hit) return hit
  const ac = v.ac
  const input = gain(ac, 1)
  const out = ac.createChannelMerger(2)
  const dry = gain(ac, 0.35)
  input.connect(dry)
  dry.connect(out, 0, 0)
  dry.connect(out, 0, 1)
  const now = ac.currentTime
  const slowRate = 0.63
  const fastRate = 5.7
  for (let i = 0; i < 3; i++) {
    const d = ac.createDelay(0.05)
    d.delayTime.value = 0.009 + i * 0.0023
    const slow = ac.createOscillator()
    slow.frequency.value = slowRate
    const slowDepth = gain(ac, 0.0019)
    const fast = ac.createOscillator()
    fast.frequency.value = fastRate
    const fastDepth = gain(ac, 0.00022)
    slow.connect(slowDepth)
    slowDepth.connect(d.delayTime)
    fast.connect(fastDepth)
    fastDepth.connect(d.delayTime)
    // Phase offsets by staggered starts.
    slow.start(now + i / (3 * slowRate))
    fast.start(now + i / (3 * fastRate))
    input.connect(d)
    const w = gain(ac, 0.5)
    d.connect(w)
    if (i === 0) w.connect(out, 0, 0)
    else if (i === 2) w.connect(out, 0, 1)
    else { w.connect(out, 0, 0); w.connect(out, 0, 1) }
  }
  out.connect(v.out.input)
  v.cache.set('ensemble', input)
  return input
}

/**
 * The choir's formant bank ('aah'): parallel band-passes on F1–F3 plus a
 * little chest, stereo, with the vowel drifting slowly. Built once per layer.
 */
function formants(v: VoiceCtx): AudioNode {
  const hit = v.cache.get('formants')
  if (hit) return hit
  const ac = v.ac
  const input = gain(ac, 1)
  const sum = gain(ac, 1)
  const bands: Array<[number, number, number]> = [[760, 6, 1], [1160, 9, 0.5], [2650, 12, 0.2], [3400, 14, 0.08]]
  const now = ac.currentTime
  bands.forEach(([f, q, lvl], i) => {
    const bp = filter(ac, 'bandpass', f, q)
    const g = gain(ac, lvl)
    input.connect(bp)
    bp.connect(g)
    g.connect(sum)
    if (i < 2) {
      // Slow vowel drift: 'aah' leaning toward 'aw' and back.
      const lfo = ac.createOscillator()
      lfo.frequency.value = i === 0 ? 0.053 : 0.079
      const depth = gain(ac, i === 0 ? 45 : 110)
      lfo.connect(depth)
      depth.connect(bp.frequency)
      lfo.start(now)
    }
  })
  const chest = filter(ac, 'lowpass', 380, 0.7)
  const chestG = gain(ac, 0.18)
  input.connect(chest)
  chest.connect(chestG)
  chestG.connect(sum)
  const hp = filter(ac, 'highpass', 110, 0.7)
  sum.connect(hp)
  hp.connect(v.out.input)
  v.cache.set('formants', input)
  return input
}

// ---- leads ---------------------------------------------------------------------

const leadSquare: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'square', f)
  const b = osc(n, 'square', f, -7)
  const lp = filter(n.ac, 'lowpass', 3000, 1.4)
  const mix = gain(n.ac, 0.5)
  a.connect(mix); b.connect(mix)
  chain(mix, lp, n.amp)
  const top = keyTrack(3600, midi, 0.4) * (0.7 + 0.4 * vel)
  sweep(n, lp, top, keyTrack(1500, midi, 0.4), Math.max(0.08, dur * 0.5))
  vibrato(n, [a, b], dur, 5.6, 12, 0.2)
  return done(n, dur, { peak: LEVEL['lead.square'] * velAmp(vel), a: 0.006, d: 0.3, s: 0.78, r: 0.12 })
}

const leadSaw: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f, 8)
  const b = osc(n, 'sawtooth', f, -8)
  const lp = filter(n.ac, 'lowpass', 2600, 1.1)
  a.connect(lp); b.connect(lp)
  lp.connect(n.amp)
  sweep(n, lp, keyTrack(3000, midi, 0.4) * (0.7 + 0.4 * vel), keyTrack(1250, midi, 0.4), Math.max(0.1, dur * 0.5))
  vibrato(n, [a, b], dur, 5.2, 11, 0.22)
  return done(n, dur, { peak: LEVEL['lead.saw'] * velAmp(vel), a: 0.012, d: 0.4, s: 0.8, r: 0.16 })
}

const leadPulse: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const a = osc(n, 'pulse25', hz(midi))
  const lp = filter(n.ac, 'lowpass', keyTrack(3400, midi, 0.3), 0.6)
  chain(a, lp, n.amp)
  vibrato(n, [a], dur, 6.2, 9, 0.25)
  return done(n, dur, { peak: LEVEL['lead.pulse'] * velAmp(vel), a: 0.004, d: 0.25, s: 0.82, r: 0.08 })
}

/** Rhodes-ish FM tine: 1:1 body whose brightness follows velocity, and a 14:1 'ting' on the attack. */
const leadEp: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const car = osc(n, 'sine', f)
  const ks = Math.pow(2, -(midi - 60) / 30)
  modulator(n, f, 1, car.frequency, (0.9 + 1.9 * vel) * ks, 0.22 * ks, 0.32)
  if (f * 14 < n.ac.sampleRate * 0.4) modulator(n, f, 14, car.frequency, 0.5 * vel * ks, 0, 0.025)
  // A soft second-harmonic body so low notes are not hollow.
  const body = osc(n, 'sine', f * 2)
  const bodyG = gain(n.ac, 0.12)
  body.connect(bodyG)
  bodyG.connect(n.amp)
  car.connect(n.amp)
  return done(n, dur, { peak: LEVEL['lead.ep'] * velAmp(vel), a: 0.002, d: 0.45, s: 0.32, r: 0.28 })
}

/** Breathy synth flute: soft triangles, a slow swell, breath noise around the second harmonic. */
const leadHollow: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'triangle', f, 4)
  const b = osc(n, 'triangle', f, -4)
  const c = osc(n, 'sine', f * 2)
  const cg = gain(n.ac, 0.25)
  c.connect(cg)
  const lp = filter(n.ac, 'lowpass', 1500, 0.6)
  lp.frequency.setValueAtTime(safeHz(n.ac, keyTrack(1300, midi, 0.5)), at)
  lp.frequency.linearRampToValueAtTime(safeHz(n.ac, keyTrack(2600, midi, 0.5)), at + Math.min(0.25, dur))
  a.connect(lp); b.connect(lp); cg.connect(lp)
  const br = noise(n, n.res.white)
  const bp = filter(n.ac, 'bandpass', f * 2, 1.4)
  const bg = gain(n.ac, 0.07 + 0.05 * vel)
  chain(br, bp, bg, lp)
  lp.connect(n.amp)
  vibrato(n, [a, b, c], dur, 4.9, 10, 0.28)
  return done(n, dur, { peak: LEVEL['lead.hollow'] * velAmp(vel), a: Math.min(0.07, dur * 0.4), d: 0.3, s: 0.92, r: 0.2 })
}

/** DX-style glassy lead: 1:1 for body, 7:1 glint that fades, sustained brightness. */
const leadFm: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const car = osc(n, 'sine', f)
  const ks = Math.pow(2, -(midi - 60) / 24)
  modulator(n, f, 1, car.frequency, (1.6 + 1.4 * vel) * ks, 0.65 * ks, 0.35)
  if (f * 7 < n.ac.sampleRate * 0.4) modulator(n, f, 7, car.frequency, 0.9 * vel * ks, 0.05, 0.09)
  const lp = filter(n.ac, 'lowpass', 7500, 0.5)
  chain(car, lp, n.amp)
  vibrato(n, [car], dur, 5.4, 9, 0.25)
  return done(n, dur, { peak: LEVEL['lead.fm'] * velAmp(vel), a: 0.003, d: 0.5, s: 0.6, r: 0.3 })
}

/** Mono synthwave solo: two saws and a sub square, portamento between legato notes. */
const leadGlide: Patch = (v, midi, at, dur, vel, opts, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const prev = v.glide
  const legato = !!opts?.legato && prev !== null && prev.end >= at - 0.06 && prev.midi !== midi
  const a = osc(n, 'sawtooth', f, 6)
  const b = osc(n, 'sawtooth', f, -6)
  const s = osc(n, 'square', f / 2)
  const sg = gain(n.ac, 0.22)
  s.connect(sg)
  if (legato && prev) {
    const g = Math.min(0.11, dur * 0.4)
    for (const o of [a, b]) {
      o.frequency.setValueAtTime(safeHz(n.ac, hz(prev.midi)), at)
      o.frequency.exponentialRampToValueAtTime(safeHz(n.ac, f), at + g)
    }
    s.frequency.setValueAtTime(safeHz(n.ac, hz(prev.midi) / 2), at)
    s.frequency.exponentialRampToValueAtTime(safeHz(n.ac, f / 2), at + g)
  }
  const lp = filter(n.ac, 'lowpass', 2400, 2.2)
  a.connect(lp); b.connect(lp); sg.connect(lp)
  lp.connect(n.amp)
  const base = keyTrack(2100, midi, 0.4) * (0.65 + 0.5 * vel)
  sweep(n, lp, legato ? base * 1.1 : base * 1.8, base, 0.18)
  vibrato(n, [a, b], dur, 5.3, 13, 0.3)
  v.glide = { midi, end: at + dur }
  return done(n, dur, { peak: LEVEL['lead.glide'] * velAmp(vel), a: legato ? 0.025 : 0.01, d: 0.4, s: 0.85, r: 0.14 })
}

/** Ocarina / whistle: sine with a pitched breath, a scoop into the note, a chiff, vibrato. */
const leadWhistle: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'sine', f)
  a.detune.setValueAtTime(-35, at)
  a.detune.linearRampToValueAtTime(0, at + 0.06)
  const h = osc(n, 'sine', f * 2)
  const hg = gain(n.ac, 0.05)
  h.connect(hg)
  hg.connect(n.amp)
  a.connect(n.amp)
  // Breath tuned to the note (a narrow band-pass rings at the pitch).
  const br = noise(n, n.res.white)
  const bp = filter(n.ac, 'bandpass', f, 14)
  const bg = gain(n.ac, 0.5)
  chain(br, bp, bg, n.amp)
  // Chiff: a short high breath on the attack.
  const ch = noise(n, n.res.white)
  const hp = filter(n.ac, 'bandpass', Math.min(6000, f * 4), 1.2)
  const cg = n.ac.createGain()
  cg.gain.setValueAtTime(0.16 * vel, at)
  cg.gain.setTargetAtTime(0, at + 0.004, 0.025)
  chain(ch, hp, cg, n.amp)
  vibrato(n, [a, h], dur, 5.3, 15, 0.16)
  return done(n, dur, { peak: LEVEL['lead.whistle'] * velAmp(vel), a: 0.03, d: 0.3, s: 0.9, r: 0.12 })
}

// ---- mallets and plucks ----------------------------------------------------------

/** Thumb piano: fundamental with a short inharmonic partial, a tiny pitch drop on the strike. */
const kalimba: Patch = (v, midi, at, _dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const tau = clamp(0.5 * Math.pow(2, -(midi - 60) / 24), 0.18, 0.9)
  const a = osc(n, 'sine', f)
  a.detune.setValueAtTime(10, at)
  a.detune.setTargetAtTime(0, at, 0.015)
  a.connect(n.amp)
  partial(n, f, 5.4, 0.3 * (0.5 + vel), 0.05, n.amp)
  partial(n, f, 2.0, 0.08, tau * 0.4, n.amp)
  const env = envelope(n, 0, { peak: LEVEL['mallet.kalimba'] * velAmp(vel), a: 0.002, d: tau, s: 0, r: 0, gate: false })
  return finish(n, env, 0, at + tau)
}

/** Wooden bar: fundamental, 4th harmonic, a touch of the 10th for the mallet. */
const marimba: Patch = (v, midi, at, _dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const tau = clamp(0.42 * Math.pow(2, -(midi - 60) / 20), 0.12, 0.9)
  osc(n, 'sine', f).connect(n.amp)
  partial(n, f, 4, 0.3 * (0.6 + 0.6 * vel), 0.055, n.amp)
  partial(n, f, 9.9, 0.06 * vel, 0.012, n.amp)
  const env = envelope(n, 0, { peak: LEVEL['mallet.marimba'] * velAmp(vel), a: 0.003, d: tau, s: 0, r: 0, gate: false })
  return finish(n, env, 0, at + tau)
}

/** Harp / koto: a resonant noise pluck into a saw-triangle tone whose filter closes, a small bend down. */
const harp: Patch = (v, midi, at, _dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const tau = clamp(0.8 * Math.pow(2, -(midi - 60) / 24), 0.25, 1.4)
  const a = osc(n, 'sawtooth', f)
  const b = osc(n, 'triangle', f)
  for (const o of [a, b]) {
    o.detune.setValueAtTime(14, at)
    o.detune.setTargetAtTime(0, at, 0.02)
  }
  const lp = filter(n.ac, 'lowpass', f * 6, 0.9)
  const ag = gain(n.ac, 0.35)
  a.connect(ag)
  ag.connect(lp)
  b.connect(lp)
  sweep(n, lp, Math.min(9000, f * (5 + 5 * vel)), f * 1.6, 0.07)
  lp.connect(n.amp)
  const ex = noise(n, n.res.white)
  const bp = filter(n.ac, 'bandpass', f, 30)
  const eg = n.ac.createGain()
  eg.gain.setValueAtTime(1.2 * vel, at)
  eg.gain.setTargetAtTime(0, at + 0.002, 0.012)
  chain(ex, bp, eg, n.amp)
  const env = envelope(n, 0, { peak: LEVEL['pluck.harp'] * velAmp(vel), a: 0.002, d: tau, s: 0, r: 0, gate: false })
  return finish(n, env, 0, at + tau)
}

// ---- arps -------------------------------------------------------------------------

const arpSquare: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const a = osc(n, 'square', hz(midi))
  const lp = filter(n.ac, 'lowpass', keyTrack(2800, midi, 0.35), 0.7)
  chain(a, lp, n.amp)
  return done(n, dur * 0.8, { peak: LEVEL['arp.square'] * velAmp(vel), a: 0.003, d: 0.12, s: 0.65, r: 0.035 })
}

/** The sequencer pluck: saw plus a sub square through a resonant filter that snaps shut. */
const arpPluck: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f)
  const b = osc(n, 'square', f / 2, 5)
  const bg = gain(n.ac, 0.4)
  b.connect(bg)
  const lp = filter(n.ac, 'lowpass', 2500, 4.5)
  a.connect(lp); bg.connect(lp)
  lp.connect(n.amp)
  sweep(n, lp, keyTrack(2600, midi, 0.4) * (0.6 + 0.6 * vel), keyTrack(420, midi, 0.5), Math.max(0.03, dur * 0.3))
  return done(n, dur * 0.85, { peak: LEVEL['arp.pluck'] * velAmp(vel), a: 0.002, d: 0.14, s: 0.55, r: 0.035 })
}

const arpWarm: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f, 6)
  const b = osc(n, 'triangle', f, -6)
  const lp = filter(n.ac, 'lowpass', 2000, 1.3)
  const ag = gain(n.ac, 0.55)
  a.connect(ag)
  ag.connect(lp)
  b.connect(lp)
  lp.connect(n.amp)
  sweep(n, lp, keyTrack(2100, midi, 0.4) * (0.7 + 0.4 * vel), keyTrack(900, midi, 0.4), Math.max(0.05, dur * 0.5))
  return done(n, dur * 0.85, { peak: LEVEL['arp.warm'] * velAmp(vel), a: 0.006, d: 0.2, s: 0.7, r: 0.07 })
}

/** Sine bells: fundamental and a fast-fading 2.76 partial. Rings past the step. */
const arpGlass: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  osc(n, 'sine', f).connect(n.amp)
  partial(n, f, 2.76, 0.3, 0.09, n.amp)
  const tau = clamp(0.12 + dur * 0.5, 0.15, 0.5)
  const env = envelope(n, 0, { peak: LEVEL['arp.glass'] * velAmp(vel), a: 0.003, d: tau, s: 0, r: 0, gate: false })
  return finish(n, env, 0, at + tau)
}

/**
 * Berlin school: two slightly detuned saws through a 24 dB resonant low-pass.
 * `opts.cutoff` (0..1) sets the filter, which the composer sweeps slowly over a phrase.
 */
const arpSeq: Patch = (v, midi, at, dur, vel, opts, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f)
  const b = osc(n, 'sawtooth', f, 7)
  const bg = gain(n.ac, 0.5)
  b.connect(bg)
  const c = clamp(opts?.cutoff ?? 0.5, 0, 1)
  const base = keyTrack(170 * Math.pow(2, c * 5.8), midi, 0.3)
  const lp1 = filter(n.ac, 'lowpass', base, 0.7)
  const lp2 = filter(n.ac, 'lowpass', base, 4 + 2.5 * c)
  a.connect(lp1); bg.connect(lp1)
  chain(lp1, lp2, n.amp)
  const top = Math.min(10000, base * (1.8 + vel))
  sweep(n, lp1, top, base, 0.06)
  sweep(n, lp2, top, base, 0.06)
  return done(n, dur * 0.9, { peak: LEVEL['arp.seq'] * velAmp(vel), a: 0.002, d: 0.12, s: 0.72, r: 0.04 })
}

// ---- pads ---------------------------------------------------------------------------

const padAttack = (dur: number, max: number) => Math.max(0.05, Math.min(max, dur * 0.35))

/** Neon Shrine's pad: two detuned saws, one per side, a filter that opens and settles. */
const padSaw: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const st = stereo(n.ac, osc(n, 'sawtooth', f, 9), osc(n, 'sawtooth', f, -9))
  const lp = filter(n.ac, 'lowpass', 900, 0.6)
  const lo = keyTrack(850, midi, 0.3)
  lp.frequency.setValueAtTime(safeHz(n.ac, lo), at)
  lp.frequency.linearRampToValueAtTime(safeHz(n.ac, lo * 1.7), at + Math.max(0.3, dur * 0.5))
  lp.frequency.linearRampToValueAtTime(safeHz(n.ac, lo * 1.15), at + Math.max(0.6, dur))
  chain(st, lp, n.amp)
  return done(n, dur, { peak: LEVEL['pad.saw'] * velAmp(vel), a: padAttack(dur, 0.45), d: 0.5, s: 1, r: 0.7 })
}

/** Solina: saw at 8' and 4' through the shared ensemble chorus. */
const padStrings: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, ensemble(v), pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f, 3)
  const b = osc(n, 'sawtooth', f * 2, -4)
  const bg = gain(n.ac, 0.38)
  b.connect(bg)
  const lp = filter(n.ac, 'lowpass', keyTrack(3300, midi, 0.3), 0.5)
  const hp = filter(n.ac, 'highpass', 160, 0.6)
  a.connect(lp); bg.connect(lp)
  chain(lp, hp, n.amp)
  return done(n, dur, { peak: LEVEL['pad.strings'] * velAmp(vel), a: padAttack(dur, 0.35), d: 0.5, s: 1, r: 0.8 })
}

/** 'Aah' choir: two detuned saws, one per side, into the shared formant bank, with a slow vibrato. */
const padChoir: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, formants(v), pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f, 7)
  const b = osc(n, 'sawtooth', f, -7)
  chain(stereo(n.ac, a, b), n.amp)
  vibrato(n, [a, b], dur, 4.7, 8, 0.35)
  return done(n, dur, { peak: LEVEL['pad.choir'] * velAmp(vel), a: padAttack(dur, 0.7), d: 0.5, s: 1, r: 1.0 })
}

/** FM glass: a 3:1 modulator slightly off-ratio so the sidebands beat slowly (the shimmer). */
const padGlass: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const l = osc(n, 'sine', f)
  const r = osc(n, 'sine', f, 5)
  const m = osc(n, 'sine', f * 3 + 0.37)
  const idx = n.ac.createGain()
  const atk = padAttack(dur, 0.9)
  idx.gain.setValueAtTime(0.15 * f, at)
  idx.gain.linearRampToValueAtTime(0.75 * f * Math.pow(2, -(midi - 60) / 36), at + atk * 1.4)
  m.connect(idx)
  idx.connect(l.frequency)
  idx.connect(r.frequency)
  const lp = filter(n.ac, 'lowpass', 6500, 0.5)
  chain(stereo(n.ac, l, r), lp, n.amp)
  return done(n, dur, { peak: LEVEL['pad.glass'] * velAmp(vel), a: atk, d: 0.5, s: 1, r: 1.2 })
}

/** Round and soft: triangles left and right, a quiet saw in the middle, low-passed. */
const padWarm: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const st = stereo(n.ac, osc(n, 'triangle', f, -5), osc(n, 'triangle', f, 5))
  const s = osc(n, 'sawtooth', f, -2)
  const sg = gain(n.ac, 0.22)
  s.connect(sg)
  const lp = filter(n.ac, 'lowpass', keyTrack(1150, midi, 0.3), 0.6)
  st.connect(lp)
  sg.connect(lp)
  lp.connect(n.amp)
  return done(n, dur, { peak: LEVEL['pad.warm'] * velAmp(vel), a: padAttack(dur, 0.5), d: 0.5, s: 1, r: 0.9 })
}

/** Dark: detuned saws under a low low-pass, with a slow tape wow of its own (deeper with grit). */
const padDark: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f, 11)
  const b = osc(n, 'sawtooth', f, -11)
  const wow = osc(n, 'sine', rand(0.28, 0.4))
  const wowG = gain(n.ac, 7 * (1 + n.res.grit))
  const flut = osc(n, 'sine', rand(0.8, 1.1))
  const flutG = gain(n.ac, 2.5 * (1 + n.res.grit))
  wow.connect(wowG); flut.connect(flutG)
  for (const o of [a, b]) { wowG.connect(o.detune); flutG.connect(o.detune) }
  const lp = filter(n.ac, 'lowpass', keyTrack(620, midi, 0.3), 0.8)
  chain(stereo(n.ac, a, b), lp, n.amp)
  return done(n, dur, { peak: LEVEL['pad.dark'] * velAmp(vel), a: padAttack(dur, 0.8), d: 0.5, s: 1, r: 1.2 })
}

// ---- basses ---------------------------------------------------------------------------

const bassSaw: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f)
  const s = osc(n, 'square', f / 2)
  const sg = gain(n.ac, 0.45)
  s.connect(sg)
  const lp = filter(n.ac, 'lowpass', 1400, 3)
  a.connect(lp); sg.connect(lp)
  lp.connect(n.amp)
  sweep(n, lp, 1500 * (0.6 + 0.6 * vel), 280, Math.min(dur, 0.25) * 0.5)
  return done(n, dur, { peak: LEVEL['bass.saw'] * velAmp(vel), a: 0.004, d: 0.3, s: 0.85, r: 0.05 })
}

const bassSquare: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'square', f)
  const s = osc(n, 'square', f / 2)
  const sg = gain(n.ac, 0.5)
  s.connect(sg)
  const lp = filter(n.ac, 'lowpass', 900, 1.8)
  a.connect(lp); sg.connect(lp)
  lp.connect(n.amp)
  sweep(n, lp, 950 * (0.6 + 0.6 * vel), 280, Math.min(dur, 0.25) * 0.5)
  return done(n, dur, { peak: LEVEL['bass.square'] * velAmp(vel), a: 0.004, d: 0.3, s: 0.85, r: 0.045 })
}

const bassRound: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'triangle', f)
  const s = osc(n, 'sine', f / 2)
  const sg = gain(n.ac, 0.55)
  s.connect(sg)
  const lp = filter(n.ac, 'lowpass', 1100, 0.7)
  a.connect(lp); sg.connect(lp)
  lp.connect(n.amp)
  return done(n, dur, { peak: LEVEL['bass.round'] * velAmp(vel), a: 0.006, d: 0.4, s: 0.85, r: 0.07 })
}

/** Pure sub, with a whisper of second harmonic so small speakers still hear it. */
const bassSub: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  osc(n, 'sine', f).connect(n.amp)
  const h = osc(n, 'sine', f * 2)
  const hg = gain(n.ac, 0.14)
  h.connect(hg)
  hg.connect(n.amp)
  return done(n, dur, { peak: LEVEL['bass.sub'] * velAmp(vel), a: 0.015, d: 0.4, s: 0.9, r: 0.09 })
}

/** Synthwave eighths: saw and square in unison, a sub underneath, a quick filter snap. */
const bassPluck: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f)
  const b = osc(n, 'square', f, 5)
  const bg = gain(n.ac, 0.5)
  b.connect(bg)
  const lp = filter(n.ac, 'lowpass', 2000, 3.5)
  a.connect(lp); bg.connect(lp)
  sweep(n, lp, 2400 * (0.55 + 0.55 * vel), 300, 0.07)
  const sub = osc(n, 'sine', f / 2)
  const subG = gain(n.ac, 0.4)
  sub.connect(subG)
  subG.connect(n.amp)
  lp.connect(n.amp)
  return done(n, dur, { peak: LEVEL['bass.pluck'] * velAmp(vel), a: 0.002, d: 0.16, s: 0.5, r: 0.04 })
}

/** DX bass: 1:1 FM with a fast-decaying index, plus a sine sub. */
const bassFm: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const car = osc(n, 'sine', f)
  modulator(n, f, 1, car.frequency, 2.6 + 2.2 * vel, 0.7, 0.08)
  car.connect(n.amp)
  const sub = osc(n, 'sine', f)
  const sg = gain(n.ac, 0.35)
  sub.connect(sg)
  sg.connect(n.amp)
  return done(n, dur, { peak: LEVEL['bass.fm'] * velAmp(vel), a: 0.002, d: 0.25, s: 0.6, r: 0.05 })
}

// ---- bells and counter lines ---------------------------------------------------------------

/** Glass harmonica bell: a long pure tone with two soft partials. */
const bellGlass: Patch = (v, midi, at, _dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  osc(n, 'sine', f).connect(n.amp)
  partial(n, f, 3.003, 0.16, 0.45, n.amp)
  partial(n, f, 5.43, 0.06, 0.14, n.amp)
  const env = envelope(n, 0, { peak: LEVEL['bell.glass'] * velAmp(vel), a: 0.008, d: 1.3, s: 0, r: 0, gate: false })
  return finish(n, env, 0, at + 1.3)
}

/** Tubular FM bell: 1:1.4 inharmonic modulation that mellows, and a hum an octave below. */
const bellFm: Patch = (v, midi, at, _dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const car = osc(n, 'sine', f)
  modulator(n, f, 1.4, car.frequency, 2.2 + 1.5 * vel, 0.25, 0.9)
  const lp = filter(n.ac, 'lowpass', 6000, 0.5)
  chain(car, lp, n.amp)
  partial(n, f, 0.5, 0.22, 2.2, n.amp)
  const env = envelope(n, 0, { peak: LEVEL['bell.fm'] * velAmp(vel), a: 0.002, d: 1.4, s: 0, r: 0, gate: false })
  return finish(n, env, 0, at + 1.4)
}

/** Small high chime. */
const bellChime: Patch = (v, midi, at, _dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  osc(n, 'sine', f).connect(n.amp)
  partial(n, f, 2.76, 0.35, 0.14, n.amp)
  partial(n, f, 5.4, 0.12, 0.045, n.amp)
  const env = envelope(n, 0, { peak: LEVEL['bell.chime'] * velAmp(vel), a: 0.002, d: 0.55, s: 0, r: 0, gate: false })
  return finish(n, env, 0, at + 0.55)
}

/** A soft string line through the ensemble, bowed attack, late vibrato. */
const counterStrings: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, ensemble(v), pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f, 6)
  const b = osc(n, 'sawtooth', f, -6)
  const lp = filter(n.ac, 'lowpass', keyTrack(2100, midi, 0.4), 0.6)
  a.connect(lp); b.connect(lp)
  lp.connect(n.amp)
  vibrato(n, [a, b], dur, 5.0, 7, 0.3)
  return done(n, dur, { peak: LEVEL['counter.strings'] * velAmp(vel), a: Math.min(0.16, dur * 0.4), d: 0.4, s: 1, r: 0.35 })
}

/** Neon Shrine's counter line: saw and triangle, gently low-passed. */
const counterSoft: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const a = osc(n, 'sawtooth', f, 5)
  const ag = gain(n.ac, 0.6)
  a.connect(ag)
  const b = osc(n, 'triangle', f)
  const lp = filter(n.ac, 'lowpass', keyTrack(1800, midi, 0.4), 0.6)
  ag.connect(lp); b.connect(lp)
  lp.connect(n.amp)
  vibrato(n, [a, b], dur, 5.2, 6, 0.35)
  return done(n, dur, { peak: LEVEL['counter.soft'] * velAmp(vel), a: Math.min(0.08, dur * 0.4), d: 0.4, s: 1, r: 0.25 })
}

// ---- drones -----------------------------------------------------------------------------------

/** Root and fifth, very low: sine, soft triangle fifth, a slow breathing swell. */
const droneSub: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const breath = gain(n.ac, 1)
  const lfo = osc(n, 'sine', rand(0.08, 0.13))
  const lg = gain(n.ac, 0.14)
  lfo.connect(lg)
  lg.connect(breath.gain)
  osc(n, 'sine', f).connect(breath)
  const t = osc(n, 'triangle', f * 1.5)
  const tg = gain(n.ac, 0.22)
  t.connect(tg)
  tg.connect(breath)
  const o = osc(n, 'sine', f * 2, 3)
  const og = gain(n.ac, 0.14)
  o.connect(og)
  og.connect(breath)
  const lp = filter(n.ac, 'lowpass', 700, 0.5)
  chain(breath, lp, n.amp)
  return done(n, dur, { peak: LEVEL['drone.sub'] * velAmp(vel), a: Math.min(2.5, Math.max(0.3, dur * 0.4)), d: 0.5, s: 1, r: 2.2 })
}

/** Drawbar organ drone: root, fifth, octave, twelfth, fifteenth; slow tremolo. */
const droneOrgan: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  const f = hz(midi)
  const trem = gain(n.ac, 1)
  const lfo = osc(n, 'sine', rand(0.7, 0.9))
  const lg = gain(n.ac, 0.14)
  lfo.connect(lg)
  lg.connect(trem.gain)
  const bars: Array<[number, number]> = [[1, 1], [1.5, 0.45], [2, 0.6], [3, 0.22], [4, 0.14]]
  for (const [ratio, lvl] of bars) {
    const o = osc(n, 'sine', f * ratio, rand(-2, 2))
    const g = gain(n.ac, lvl)
    o.connect(g)
    g.connect(trem)
  }
  const lp = filter(n.ac, 'lowpass', 3200, 0.5)
  chain(trem, lp, n.amp)
  return done(n, dur, { peak: LEVEL['drone.organ'] * velAmp(vel), a: Math.min(1.2, Math.max(0.2, dur * 0.3)), d: 0.5, s: 1, r: 1.8 })
}

/** High overtone cluster: pairs of partials a fraction of a hertz apart, beating slowly, spread wide. */
const droneShimmer: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const n = begin(v.res, at, v.out.input, pan)
  let f = hz(midi)
  while (f * 2 < 380) f *= 2
  const left = gain(n.ac, 1)
  const right = gain(n.ac, 1)
  const parts: Array<[number, number, number, GainNode]> = [
    [2, 0, 1, left], [2, 0.23, 0.8, left],
    [3, 0, 0.7, right], [3, 0.31, 0.6, right],
    [4, 0, 0.45, left], [5, 0.17, 0.35, right],
    [6, 0, 0.25, right], [8, 0.11, 0.18, left],
  ]
  for (const [ratio, off, lvl, side] of parts) {
    if (f * ratio > 7000) continue
    const o = osc(n, 'sine', f * ratio + off)
    const g = gain(n.ac, lvl)
    o.connect(g)
    g.connect(side)
  }
  const lp = filter(n.ac, 'lowpass', 5000, 0.5)
  chain(stereo(n.ac, left, right), lp, n.amp)
  return done(n, dur, { peak: LEVEL['drone.shimmer'] * velAmp(vel), a: Math.min(3, Math.max(0.4, dur * 0.4)), d: 0.5, s: 1, r: 3 })
}

// ---- dispatch ------------------------------------------------------------------------------------

const PATCHES: Record<VoiceId, Patch> = {
  'lead.square': leadSquare, 'lead.saw': leadSaw, 'lead.pulse': leadPulse, 'lead.ep': leadEp,
  'lead.hollow': leadHollow, 'lead.fm': leadFm, 'lead.glide': leadGlide, 'lead.whistle': leadWhistle,
  'mallet.kalimba': kalimba, 'mallet.marimba': marimba, 'pluck.harp': harp,
  'arp.square': arpSquare, 'arp.pluck': arpPluck, 'arp.warm': arpWarm, 'arp.glass': arpGlass, 'arp.seq': arpSeq,
  'pad.saw': padSaw, 'pad.strings': padStrings, 'pad.choir': padChoir, 'pad.glass': padGlass,
  'pad.warm': padWarm, 'pad.dark': padDark,
  'bass.saw': bassSaw, 'bass.square': bassSquare, 'bass.round': bassRound, 'bass.sub': bassSub,
  'bass.pluck': bassPluck, 'bass.fm': bassFm,
  'bell.glass': bellGlass, 'bell.fm': bellFm, 'bell.chime': bellChime,
  'counter.strings': counterStrings, 'counter.soft': counterSoft,
  'drone.sub': droneSub, 'drone.organ': droneOrgan, 'drone.shimmer': droneShimmer,
}

export const VOICE_IDS = Object.keys(PATCHES) as VoiceId[]

/**
 * Play one note. `dur` is the gate length in seconds (percussive voices ring
 * on regardless). Returns a handle for ties, or null if the note was invalid.
 */
export function playVoice(
  v: VoiceCtx, id: VoiceId, midi: number, at: number, dur: number, vel: number, opts?: Opts, pan = 0,
): NoteHandle | null {
  const patch = PATCHES[id]
  if (!patch || !Number.isFinite(midi) || !Number.isFinite(at) || vel <= 0) return null
  const m = clamp(midi, 12, 120)
  const d = clamp(Number.isFinite(dur) ? dur : 0.2, 0.02, 60)
  return patch(v, m, at, d, clamp(vel, 0, 1), opts, pan)
}
