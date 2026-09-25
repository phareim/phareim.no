/**
 * Night of the Dead Battery — the instrument kit. Web Audio primitives and
 * the score's instruments, each a small recipe of oscillators, noise and
 * filters that schedules one note at an exact time. Nothing here runs at
 * import; everything takes a Kit made after unlock.
 *
 * Voices share one signature: (kit, out, midi, time, seconds, velocity).
 * Velocity is 0..1; peaks stay well under 0.4 so a full arrangement sums
 * below clipping before the master compressor.
 */

export type WaveName = 'organ' | 'reed' | 'brass' | 'accordion' | 'harpsi' | 'pizz' | 'theremin' | 'flute'

export interface Kit {
  ac: AudioContext
  white: AudioBuffer
  brown: AudioBuffer
  waves: Partial<Record<WaveName, PeriodicWave>>
}

export type Voice = (k: Kit, out: AudioNode, m: number, t: number, dur: number, v: number, from?: number) => void

export const hz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))
const TINY = 0.0001

// ---------------------------------------------------------------------------
// The kit
// ---------------------------------------------------------------------------

/** Harmonic amplitudes, index 1 = fundamental. */
const SPECTRA: Record<WaveName, number[]> = {
  // Drawbars 8' 4' 2 2/3' 2' 1 3/5' 1 1/3' 1'.
  organ: [0, 1, 0.7, 0.45, 0.5, 0.12, 0.25, 0, 0.2],
  // Bassoon: a weak fundamental and strong low partials is the nasal buzz.
  reed: [0, 0.55, 1, 0.8, 0.55, 0.5, 0.3, 0.25, 0.15, 0.1, 0.06],
  // Tuba: round, a few partials; the filter adds the blat.
  brass: [0, 1, 0.62, 0.36, 0.22, 0.13, 0.08, 0.05],
  // Free reeds: bright, lots of partials.
  accordion: [0, 1, 0.75, 0.85, 0.55, 0.6, 0.42, 0.38, 0.3, 0.24, 0.2, 0.14, 0.1],
  harpsi: [],
  pizz: [0, 1, 0.45, 0.28, 0.12, 0.06],
  theremin: [0, 1, 0.1, 0.045, 0.015],
  flute: [0, 1, 0.22, 0.07, 0.03],
}
// Harpsichord: a string plucked near its end, so the spectrum is rich and
// shaped by the pluck point (a comb of gentle notches).
for (let n = 1; n <= 28; n++) SPECTRA.harpsi[n] = Math.abs(Math.sin(n * Math.PI * 0.13)) / Math.pow(n, 0.9)
SPECTRA.harpsi[0] = 0

export function makeKit(ac: AudioContext): Kit {
  const len = Math.max(1, Math.floor(ac.sampleRate * 2))
  const white = ac.createBuffer(1, len, ac.sampleRate)
  const wd = white.getChannelData(0)
  for (let i = 0; i < len; i++) wd[i] = Math.random() * 2 - 1
  const blen = Math.max(1, Math.floor(ac.sampleRate * 4))
  const brown = ac.createBuffer(1, blen, ac.sampleRate)
  const bd = brown.getChannelData(0)
  let b = 0
  for (let i = 0; i < blen; i++) {
    b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02
    bd[i] = b * 3.5
  }
  const waves: Kit['waves'] = {}
  for (const name of Object.keys(SPECTRA) as WaveName[]) {
    const s = SPECTRA[name]
    const real = new Float32Array(s.length)
    const imag = new Float32Array(s.length)
    for (let i = 1; i < s.length; i++) imag[i] = s[i]!
    try { waves[name] = ac.createPeriodicWave(real, imag) } catch { /* plain waves then */ }
  }
  return { ac, white, brown, waves }
}

/** A stereo room convolver impulse: exponential decay of noise. */
export function impulse(ac: AudioContext, seconds: number, decay: number, pre = 0): AudioBuffer {
  const len = Math.max(1, Math.floor(ac.sampleRate * seconds))
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) {
      const x = i / len
      const early = x < pre ? x / pre : 1
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, decay) * early
    }
  }
  return buf
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function osc(k: Kit, type: OscillatorType | WaveName, f: number, t: number, end: number, detune = 0): OscillatorNode {
  const o = k.ac.createOscillator()
  if (type === 'sine' || type === 'square' || type === 'sawtooth' || type === 'triangle') o.type = type
  else {
    const w = k.waves[type as WaveName]
    if (w) o.setPeriodicWave(w)
    else o.type = type === 'flute' || type === 'theremin' ? 'sine' : type === 'pizz' || type === 'organ' ? 'triangle' : 'sawtooth'
  }
  o.frequency.setValueAtTime(clamp(f, 10, 20000), t)
  if (detune) o.detune.setValueAtTime(detune, t)
  o.start(t)
  o.stop(end)
  return o
}

export function gain(k: Kit, v = 1): GainNode {
  const g = k.ac.createGain()
  g.gain.value = v
  return g
}

export function filt(k: Kit, type: BiquadFilterType, f: number, q = 0.707): BiquadFilterNode {
  const n = k.ac.createBiquadFilter()
  n.type = type
  n.frequency.value = clamp(f, 10, 20000)
  n.Q.value = q
  return n
}

/** A looping noise source starting at a random point, so repeats never line up. */
export function noise(k: Kit, t: number, dur: number, color: 'white' | 'brown' = 'white', rate = 1): AudioBufferSourceNode {
  const s = k.ac.createBufferSource()
  s.buffer = color === 'white' ? k.white : k.brown
  s.loop = true
  if (rate !== 1) s.playbackRate.value = rate
  const len = s.buffer.duration
  s.start(t, Math.random() * len * 0.9)
  s.stop(t + dur)
  return s
}

/** A stereo panner when the browser has one; a plain pass-through otherwise. */
export function panner(k: Kit, p: number): AudioNode {
  const ac = k.ac as AudioContext & { createStereoPanner?: () => StereoPannerNode }
  if (typeof ac.createStereoPanner === 'function') {
    const n = ac.createStereoPanner()
    n.pan.value = clamp(p, -1, 1)
    return n
  }
  return gain(k, 1)
}

/** Attack, hold, exponential release. Ends at t + a + hold + rel. */
export function ahr(p: AudioParam, t: number, peak: number, a: number, hold: number, rel: number): number {
  const pk = Math.max(TINY * 2, peak)
  p.setValueAtTime(0, t)
  p.linearRampToValueAtTime(pk, t + a)
  if (hold > 0) p.setValueAtTime(pk, t + a + hold)
  p.exponentialRampToValueAtTime(TINY, t + a + hold + rel)
  return t + a + hold + rel
}

/** A pluck: fast attack, exponential decay. */
export function pluck(p: AudioParam, t: number, peak: number, a: number, decay: number): number {
  const pk = Math.max(TINY * 2, peak)
  p.setValueAtTime(0, t)
  p.linearRampToValueAtTime(pk, t + a)
  p.exponentialRampToValueAtTime(TINY, t + a + decay)
  return t + a + decay
}

/** A slow vibrato: an LFO into a detune param, fading in after `delay`. */
export function vibrato(k: Kit, target: AudioParam, t: number, end: number, rate: number, cents: number, delay = 0.2): void {
  const lfo = osc(k, 'sine', rate, t, end)
  const depth = gain(k, 0)
  depth.gain.setValueAtTime(0, t)
  depth.gain.linearRampToValueAtTime(cents, t + Math.max(0.01, delay))
  lfo.connect(depth)
  depth.connect(target)
}

// ---------------------------------------------------------------------------
// The instruments
// ---------------------------------------------------------------------------

/** Harpsichord: two 8' stops a hair apart, a bright filter that closes, dampers on release. */
export const harpsi: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const decay = clamp(1.7 - (m - 48) * 0.03, 0.45, 1.7)
  const stopAt = Math.min(decay, Math.max(0.14, dur) + 0.12)
  const end = t + stopAt + 0.05
  const lp = filt(k, 'lowpass', Math.min(9000, f * 12), 0.8)
  lp.frequency.setValueAtTime(Math.min(9000, f * 12), t)
  lp.frequency.exponentialRampToValueAtTime(Math.max(900, f * 3), t + stopAt * 0.7 + 0.02)
  const g = gain(k, 0)
  pluck(g.gain, t, 0.11 * v, 0.002, stopAt)
  osc(k, 'harpsi', f, t, end, 3).connect(lp)
  const o2 = osc(k, 'harpsi', f, t, end, -4)
  const g2 = gain(k, 0.55)
  o2.connect(g2)
  g2.connect(lp)
  lp.connect(g)
  g.connect(out)
}

/** Tuba: a brass wave with a scoop up to pitch and a filter "blat" on the attack. */
export const tuba: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const len = Math.max(0.12, dur)
  const end = t + len + 0.15
  const o = osc(k, 'brass', f, t, end)
  o.detune.setValueAtTime(-30, t)
  o.detune.linearRampToValueAtTime(0, t + 0.045)
  const lp = filt(k, 'lowpass', 260, 1.4)
  lp.frequency.setValueAtTime(260, t)
  lp.frequency.linearRampToValueAtTime(Math.min(1400, f * 11), t + 0.03)
  lp.frequency.exponentialRampToValueAtTime(Math.min(700, f * 6), t + 0.22)
  const g = gain(k, 0)
  ahr(g.gain, t, 0.3 * v, 0.022, Math.max(0, len - 0.1), 0.1)
  o.connect(lp)
  lp.connect(g)
  g.connect(out)
}

/** Bassoon: the reed spectrum through a nasal resonance, a lazy scoop and a delayed vibrato. */
export const bassoon: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const len = Math.max(0.15, dur)
  const end = t + len + 0.2
  const o = osc(k, 'reed', f, t, end)
  o.detune.setValueAtTime(-18, t)
  o.detune.linearRampToValueAtTime(0, t + 0.06)
  if (len > 0.5) vibrato(k, o.detune, t, end, 5, 9, 0.35)
  const bp = filt(k, 'lowpass', 1250, 3.2)
  const g = gain(k, 0)
  ahr(g.gain, t, 0.2 * v, 0.04, Math.max(0, len - 0.1), 0.12)
  o.connect(bp)
  bp.connect(g)
  g.connect(out)
}

/** Pizzicato: a plucked string, short and round. */
export const pizz: Voice = (k, out, m, t, _dur, v) => {
  const f = hz(m)
  const decay = clamp(0.55 - (m - 36) * 0.008, 0.18, 0.55)
  const end = t + decay + 0.05
  const o = osc(k, 'pizz', f, t, end)
  const lp = filt(k, 'lowpass', Math.min(5000, f * 7), 0.9)
  lp.frequency.setValueAtTime(Math.min(5000, f * 7), t)
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.6), t + decay)
  const g = gain(k, 0)
  pluck(g.gain, t, 0.3 * v, 0.004, decay)
  o.connect(lp)
  lp.connect(g)
  g.connect(out)
}

/** Celesta: a sine with a quick metallic fourth partial. */
export const celesta: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const decay = clamp(Math.max(0.6, dur + 0.4), 0.6, 1.8)
  const end = t + decay + 0.05
  const g = gain(k, 0)
  pluck(g.gain, t, 0.13 * v, 0.002, decay)
  osc(k, 'sine', f, t, end).connect(g)
  const g2 = gain(k, 0)
  pluck(g2.gain, t, 0.035 * v, 0.001, 0.22)
  osc(k, 'sine', f * 4, t, t + 0.3).connect(g2)
  g2.connect(out)
  g.connect(out)
}

/** Music box: a thin tine with a high inharmonic ping. */
export const musicBox: Voice = (k, out, m, t, _dur, v) => {
  const f = hz(m)
  const g = gain(k, 0)
  pluck(g.gain, t, 0.07 * v, 0.001, 0.9)
  osc(k, 'triangle', f, t, t + 0.95).connect(g)
  const g2 = gain(k, 0)
  pluck(g2.gain, t, 0.025 * v, 0.001, 0.1)
  osc(k, 'sine', f * 5.4, t, t + 0.14).connect(g2)
  g2.connect(out)
  g.connect(out)
}

/** Theremin: near-sine, glides from the last note, a wide slow vibrato. */
export const theremin: Voice = (k, out, m, t, dur, v, from) => {
  const f = hz(m)
  const len = Math.max(0.1, dur)
  const end = t + len + 0.3
  const o = osc(k, 'theremin', f, t, end)
  if (from !== undefined && Math.abs(from - m) <= 12) {
    o.frequency.setValueAtTime(hz(from), t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.075)
  }
  vibrato(k, o.detune, t, end, 5.6, 22, 0.18)
  const g = gain(k, 0)
  ahr(g.gain, t, 0.14 * v, 0.05, Math.max(0, len - 0.06), 0.2)
  o.connect(g)
  g.connect(out)
}

/** Flute: near-sine plus a breath of noise at the pitch, and a gentle vibrato. */
export const flute: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const len = Math.max(0.1, dur)
  const end = t + len + 0.2
  const o = osc(k, 'flute', f, t, end)
  if (len > 0.35) vibrato(k, o.detune, t, end, 5, 12, 0.25)
  const g = gain(k, 0)
  ahr(g.gain, t, 0.1 * v, 0.045, Math.max(0, len - 0.06), 0.14)
  o.connect(g)
  const n = noise(k, t, len + 0.2)
  const bp = filt(k, 'bandpass', f * 2, 6)
  const ng = gain(k, 0)
  ahr(ng.gain, t, 0.05 * v, 0.02, 0.03, Math.max(0.08, len * 0.5))
  n.connect(bp)
  bp.connect(ng)
  ng.connect(out)
  g.connect(out)
}

/** Accordion: two reeds tuned apart (musette), short bellows attack. */
export const accordion: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const len = Math.max(0.1, dur)
  const end = t + len + 0.12
  const lp = filt(k, 'lowpass', 3200, 0.7)
  osc(k, 'accordion', f, t, end, 11).connect(lp)
  osc(k, 'accordion', f, t, end, -11).connect(lp)
  const g = gain(k, 0)
  ahr(g.gain, t, 0.065 * v, 0.025, Math.max(0, len - 0.04), 0.07)
  lp.connect(g)
  g.connect(out)
}

/** Organ: drawbar wave, a soft swell in and a slow release. */
export const organ: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const len = Math.max(0.2, dur)
  const end = t + len + 0.45
  const g = gain(k, 0)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.045 * v, t + 0.09)
  g.gain.linearRampToValueAtTime(0.06 * v, t + len * 0.8)
  g.gain.setTargetAtTime(0, t + len, 0.1)
  osc(k, 'organ', f, t, end, 2).connect(g)
  g.connect(out)
}

/** Glass harmonica: rubbed glass, a slow bloom, a trembling tremolo, a long ring. */
export const glass: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const len = Math.max(0.3, dur)
  const end = t + len + 1.0
  const g = gain(k, 0)
  ahr(g.gain, t, 0.11 * v, 0.16, Math.max(0, len - 0.16), 0.8)
  const trem = gain(k, 0.8)
  const lfo = osc(k, 'sine', 4.6, t, end)
  const depth = gain(k, 0.2)
  lfo.connect(depth)
  depth.connect(trem.gain)
  osc(k, 'sine', f, t, end).connect(trem)
  const g2 = gain(k, 0.14)
  osc(k, 'sine', f * 2.005, t, end).connect(g2)
  g2.connect(trem)
  trem.connect(g)
  g.connect(out)
}

/** Synth brass for the finale: two saws, a filter that opens bright and settles. */
export const brass: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const len = Math.max(0.1, dur)
  const end = t + len + 0.18
  const lp = filt(k, 'lowpass', 600, 1.1)
  lp.frequency.setValueAtTime(600, t)
  lp.frequency.linearRampToValueAtTime(Math.min(5000, f * 7), t + 0.045)
  lp.frequency.exponentialRampToValueAtTime(Math.min(2400, f * 4), t + 0.3)
  osc(k, 'sawtooth', f, t, end, 7).connect(lp)
  osc(k, 'sawtooth', f, t, end, -7).connect(lp)
  const g = gain(k, 0)
  ahr(g.gain, t, 0.07 * v, 0.03, Math.max(0, len - 0.06), 0.12)
  lp.connect(g)
  g.connect(out)
}

/** Tremolo strings for the tension cue. */
export const strings: Voice = (k, out, m, t, dur, v) => {
  const f = hz(m)
  const len = Math.max(0.2, dur)
  const end = t + len + 0.3
  const lp = filt(k, 'lowpass', Math.min(2600, f * 6), 0.8)
  osc(k, 'sawtooth', f, t, end, 6).connect(lp)
  osc(k, 'sawtooth', f, t, end, -6).connect(lp)
  const trem = gain(k, 0.6)
  const lfo = osc(k, 'triangle', 11, t, end)
  const depth = gain(k, 0.4)
  lfo.connect(depth)
  depth.connect(trem.gain)
  const g = gain(k, 0)
  ahr(g.gain, t, 0.045 * v, 0.12, Math.max(0, len - 0.12), 0.25)
  lp.connect(trem)
  trem.connect(g)
  g.connect(out)
}

/** A tuned water drop: a sine that bends up as it lands. */
export const drip: Voice = (k, out, m, t, _dur, v) => {
  const f = hz(m)
  const o = osc(k, 'sine', f * 0.72, t, t + 0.25)
  o.frequency.exponentialRampToValueAtTime(f * 1.2, t + 0.045)
  const g = gain(k, 0)
  pluck(g.gain, t, 0.09 * v, 0.003, 0.17)
  o.connect(g)
  g.connect(out)
}

// ---------------------------------------------------------------------------
// Percussion (no pitch argument needed; m is ignored or used as a tint)
// ---------------------------------------------------------------------------

export function kick(k: Kit, out: AudioNode, t: number, v: number): void {
  const o = osc(k, 'sine', 95, t, t + 0.22)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14)
  const g = gain(k, 0)
  pluck(g.gain, t, 0.32 * v, 0.004, 0.18)
  o.connect(g)
  g.connect(out)
}

/** Brushes: a soft swish, not a hit. */
export function brush(k: Kit, out: AudioNode, t: number, v: number, len = 0.14): void {
  const n = noise(k, t, len + 0.05)
  const bp = filt(k, 'bandpass', 3400, 0.7)
  const g = gain(k, 0)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.06 * v, t + Math.min(0.02, len * 0.3))
  g.gain.exponentialRampToValueAtTime(TINY, t + len)
  n.connect(bp)
  bp.connect(g)
  g.connect(out)
}

export function snare(k: Kit, out: AudioNode, t: number, v: number): void {
  const n = noise(k, t, 0.2)
  const hp = filt(k, 'highpass', 1400)
  const g = gain(k, 0)
  pluck(g.gain, t, 0.13 * v, 0.002, 0.14)
  n.connect(hp)
  hp.connect(g)
  g.connect(out)
  const o = osc(k, 'triangle', 190, t, t + 0.1)
  const og = gain(k, 0)
  pluck(og.gain, t, 0.1 * v, 0.002, 0.07)
  o.connect(og)
  og.connect(out)
}

export function cymbal(k: Kit, out: AudioNode, t: number, v: number): void {
  const n = noise(k, t, 2.2)
  const hp = filt(k, 'highpass', 5500)
  const g = gain(k, 0)
  pluck(g.gain, t, 0.07 * v, 0.004, 2.0)
  n.connect(hp)
  hp.connect(g)
  g.connect(out)
}

export function shaker(k: Kit, out: AudioNode, t: number, v: number): void {
  const n = noise(k, t, 0.08)
  const hp = filt(k, 'highpass', 6000)
  const g = gain(k, 0)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.03 * v, t + 0.015)
  g.gain.exponentialRampToValueAtTime(TINY, t + 0.07)
  n.connect(hp)
  hp.connect(g)
  g.connect(out)
}

export function timpani(k: Kit, out: AudioNode, m: number, t: number, v: number): void {
  const f = hz(m)
  const o = osc(k, 'sine', f * 1.04, t, t + 1.6)
  o.frequency.exponentialRampToValueAtTime(f, t + 0.08)
  const g = gain(k, 0)
  pluck(g.gain, t, 0.3 * v, 0.004, 1.4)
  o.connect(g)
  g.connect(out)
  const o2 = osc(k, 'sine', f * 1.5, t, t + 0.6)
  const g2 = gain(k, 0)
  pluck(g2.gain, t, 0.08 * v, 0.004, 0.45)
  o2.connect(g2)
  g2.connect(out)
  const n = noise(k, t, 0.12)
  const lp = filt(k, 'lowpass', 900)
  const ng = gain(k, 0)
  pluck(ng.gain, t, 0.12 * v, 0.002, 0.08)
  n.connect(lp)
  lp.connect(ng)
  ng.connect(out)
}

/** The clock: tick high, tock low. A wooden click with a tiny ringing escapement. */
export function tick(k: Kit, out: AudioNode, t: number, v: number, tock: boolean): void {
  const f = tock ? 1500 : 2600
  const n = noise(k, t, 0.05)
  const bp = filt(k, 'bandpass', f, 5)
  const g = gain(k, 0)
  pluck(g.gain, t, 1.4 * v, 0.001, 0.03)
  n.connect(bp)
  bp.connect(g)
  g.connect(out)
  const o = osc(k, 'sine', f * 0.8, t, t + 0.08)
  const og = gain(k, 0)
  pluck(og.gain, t, 0.12 * v, 0.001, 0.06)
  o.connect(og)
  og.connect(out)
}

/** A windscreen wiper: a rubbery swish across the glass. */
export function wiper(k: Kit, out: AudioNode, t: number, v: number, dir: 1 | -1): void {
  const n = noise(k, t, 0.4)
  const bp = filt(k, 'bandpass', dir > 0 ? 900 : 1300, 2)
  bp.frequency.setValueAtTime(dir > 0 ? 900 : 1300, t)
  bp.frequency.linearRampToValueAtTime(dir > 0 ? 1400 : 800, t + 0.3)
  const g = gain(k, 0)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.045 * v, t + 0.12)
  g.gain.exponentialRampToValueAtTime(TINY, t + 0.34)
  n.connect(bp)
  bp.connect(g)
  g.connect(out)
}
