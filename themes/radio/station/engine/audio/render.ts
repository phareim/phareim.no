// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Note renderers for the played instruments (instruments.ts): plucked
 * strings by Karplus-Strong, pianos and vibraphone bars by additive
 * synthesis, computed in JS into sample arrays. Pure math, no Web Audio, so node tests cover it.
 *
 * Why not in the audio graph: a Karplus-Strong loop needs a delay shorter
 * than one period (0.4 ms for a high E), and a feedback DelayNode cannot go
 * below one render quantum (128 frames, 2.7 ms). A piano wants 20-40
 * partials with their own decays, which would cost 60+ nodes a note. Both
 * render once per voice, pitch and velocity bucket and are cached as
 * AudioBuffers (synth.ts BufferCache), so a played note costs two nodes.
 *
 * Every render starts at zero with a short fade-in, ends with a fade to
 * zero, has no DC, and peaks at or under 1.
 */
import { createRng } from '../rng.ts'

// ---- shared DSP ------------------------------------------------------------------

/** RBJ peaking EQ, run in place. */
function peaking(x: Float32Array, sr: number, f: number, q: number, db: number): void {
  if (f >= sr * 0.45 || db === 0) return
  const A = Math.pow(10, db / 40)
  const w = (2 * Math.PI * f) / sr
  const al = Math.sin(w) / (2 * q)
  const cs = Math.cos(w)
  const a0 = 1 + al / A
  const b0 = (1 + al * A) / a0, b1 = (-2 * cs) / a0, b2 = (1 - al * A) / a0
  const a1 = (-2 * cs) / a0, a2 = (1 - al / A) / a0
  biquad(x, b0, b1, b2, a1, a2)
}

/** RBJ low-pass, run in place. */
function lowpass(x: Float32Array, sr: number, f: number, q = 0.707): void {
  if (f >= sr * 0.45) return
  const w = (2 * Math.PI * f) / sr
  const al = Math.sin(w) / (2 * q)
  const cs = Math.cos(w)
  const a0 = 1 + al
  biquad(x, (1 - cs) / 2 / a0, (1 - cs) / a0, (1 - cs) / 2 / a0, (-2 * cs) / a0, (1 - al) / a0)
}

function biquad(x: Float32Array, b0: number, b1: number, b2: number, a1: number, a2: number): void {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]!
    const y = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
    x2 = x1; x1 = x0; y2 = y1; y1 = y
    x[i] = y
  }
}

/** One-pole DC blocker (high-pass near `f` Hz), in place. */
function dcBlock(x: Float32Array, sr: number, f = 12): void {
  const r = Math.exp((-2 * Math.PI * f) / sr)
  let x1 = 0, y1 = 0
  for (let i = 0; i < x.length; i++) {
    const y = x[i]! - x1 + r * y1
    x1 = x[i]!
    y1 = y
    x[i] = y
  }
}

/**
 * Level the note: RMS over its first `win` seconds to `rms`, but never a
 * peak over `peak`; fade in over `fadeIn` s (raised cosine) and out over the
 * last `fadeOut` s. Removes any NaN (as zero) so a bad render stays silent.
 */
function finishNote(x: Float32Array, sr: number, rms: number, peak: number, fadeIn: number, fadeOut: number, win = 0.25): Float32Array {
  const n = x.length
  const fi = Math.min(n, Math.max(1, Math.round(fadeIn * sr)))
  for (let i = 0; i < fi; i++) x[i] = x[i]! * (0.5 - 0.5 * Math.cos((Math.PI * i) / fi))
  const fo = Math.min(n - fi, Math.max(1, Math.round(fadeOut * sr)))
  for (let i = 0; i < fo; i++) {
    const k = n - fo + i
    x[k] = x[k]! * (0.5 + 0.5 * Math.cos((Math.PI * (i + 1)) / fo))
  }
  let sum = 0, m = 0
  const w = Math.min(n, Math.round(win * sr))
  for (let i = 0; i < n; i++) {
    const v = x[i]!
    if (!Number.isFinite(v)) { x[i] = 0; continue }
    if (i < w) sum += v * v
    const a = Math.abs(v)
    if (a > m) m = a
  }
  const cur = Math.sqrt(sum / Math.max(1, w))
  let g = cur > 0 ? rms / cur : 0
  if (m * g > peak) g = peak / m
  for (let i = 0; i < n; i++) x[i] = x[i]! * g
  return x
}

// ---- plucked strings (Karplus-Strong) -------------------------------------------------

export interface PluckSpec {
  sr: number
  /** Pitch in Hz. */
  f: number
  /** Seconds for the fundamental to fall 60 dB. */
  t60: number
  /** Seconds for the partials around `hiHz` to fall 60 dB (sets the loop filter: lower = darker). */
  hiT60: number
  hiHz: number
  /** Pick brightness: the excitation's low-pass (Hz), two poles. */
  exciteHz: number
  /** Pluck position as a fraction of the string from the bridge (0.05..0.5): a comb on the excitation. */
  pos: number
  /** Render length cap, seconds (the note fades out over its last 12 %). */
  maxDur: number
  seed: number
  /** Body resonances: [Hz, Q, dB]. */
  body?: ReadonlyArray<readonly [number, number, number]>
  /** Output low-pass (Hz), after the body. */
  tone?: number
  /** A short low thump under the pluck (palm mute, finger on a bass): level relative to the string, 0 = none. */
  thump?: number
}

/**
 * Solve the one-pole loop filter coefficient `a` (H = (1-a) / (1 - a z^-1))
 * so partials at `hiHz` die `ratio` times faster (in dB per second) than the
 * fundamental.
 */
export function loopCoefficient(sr: number, f: number, t60: number, hiT60: number, hiHz: number): number {
  const w1 = (2 * Math.PI * f) / sr
  const wh = (2 * Math.PI * Math.min(hiHz, sr * 0.45)) / sr
  if (!(hiT60 < t60) || wh <= w1) return 0
  const mag = (a: number, w: number) => (1 - a) / Math.sqrt(1 - 2 * a * Math.cos(w) + a * a)
  // Target: per-period log loss at hiHz minus that at f.
  const want = (-3 * Math.LN10 / f) * (1 / hiT60 - 1 / t60)
  let lo = 0, hi = 0.995
  for (let i = 0; i < 50; i++) {
    const a = (lo + hi) / 2
    const got = Math.log(mag(a, wh)) - Math.log(mag(a, w1))
    if (got > want) lo = a
    else hi = a
  }
  return (lo + hi) / 2
}

export function renderPluck(p: PluckSpec): Float32Array {
  const sr = p.sr
  const f = Math.min(Math.max(p.f, 20), sr / 8)
  const t60 = Math.max(0.05, p.t60)
  const len = Math.max(64, Math.round(Math.min(p.maxDur, t60 * 1.05) * sr))
  const out = new Float32Array(len)
  const rng = createRng(p.seed)

  // Loop: delay L → gain g → one-pole low-pass a → allpass (fractional delay) → back.
  const a = loopCoefficient(sr, f, t60, p.hiT60, p.hiHz)
  const w1 = (2 * Math.PI * f) / sr
  const lpDelay = Math.atan2(a * Math.sin(w1), 1 - a * Math.cos(w1)) / w1
  const lpMag = (1 - a) / Math.sqrt(1 - 2 * a * Math.cos(w1) + a * a)
  // The loop gain that gives the fundamental its t60, never above 1: the low-pass passes DC at unity, so a
  // gain over 1 would grow whatever sits below the fundamental. (A dark filter on a high note then shortens it.)
  const g = Math.min(0.99995, Math.pow(10, -3 / (t60 * f)) / lpMag)
  const period = sr / f
  const rest = period - lpDelay
  let L = Math.floor(rest - 0.5)
  if (L < 2) L = 2
  let frac = rest - L
  // The allpass tunes well for a delay in 0.5..1.5 samples; its phase delay at f, not at DC, is what counts.
  let C = (1 - frac) / (1 + frac)
  const apDelayAt = (c: number) => {
    const ph = Math.atan2(-Math.sin(w1), c + Math.cos(w1)) - Math.atan2(-c * Math.sin(w1), 1 + c * Math.cos(w1))
    return -ph / w1
  }
  for (let k = 0; k < 4; k++) {
    frac = Math.min(1.49, Math.max(0.51, frac + (rest - L) - apDelayAt(C)))
    C = (1 - frac) / (1 + frac)
  }

  // Excitation: one period of noise, two-pole low-passed, combed by the pluck position, zero mean.
  const n0 = Math.max(4, Math.round(period))
  const ex = new Float32Array(n0)
  const ea = Math.exp((-2 * Math.PI * Math.min(p.exciteHz, sr * 0.45)) / sr)
  let s1 = 0, s2 = 0
  // Warm the filters up so the burst starts mid-signal, not from a step.
  for (let i = -32; i < n0; i++) {
    const w = rng.next() * 2 - 1
    s1 = (1 - ea) * w + ea * s1
    s2 = (1 - ea) * s1 + ea * s2
    if (i >= 0) ex[i] = s2
  }
  const d = Math.max(1, Math.round(Math.min(0.5, Math.max(0.05, p.pos)) * n0))
  for (let i = n0 - 1; i >= d; i--) ex[i] = ex[i]! - ex[i - d]!
  let mean = 0
  for (let i = 0; i < n0; i++) mean += ex[i]!
  mean /= n0
  // Taper the burst's ends (a fifth of it each) so it has no steps; the middle stays full for a crisp attack.
  const tp = Math.max(1, Math.floor(n0 * 0.2))
  for (let i = 0; i < n0; i++) {
    const e = Math.min(i + 0.5, n0 - i - 0.5)
    ex[i] = (ex[i]! - mean) * (e < tp ? 0.5 - 0.5 * Math.cos((Math.PI * e) / tp) : 1)
  }

  const line = new Float64Array(L)
  let idx = 0, lp = 0, apx = 0, apy = 0
  for (let i = 0; i < len; i++) {
    const x = line[idx]!
    lp = (1 - a) * g * x + a * lp
    const ap = C * lp + apx - C * apy
    apx = lp
    apy = ap
    // Tap after the loop filter: the first pass of the burst is shaped like every later one (no raw spike).
    out[i] = ap
    line[idx] = ap + (i < n0 ? ex[i]! : 0)
    idx = idx + 1 === L ? 0 : idx + 1
  }
  // The first period is silence (the burst is travelling the loop): shift it out.
  const shifted = out.subarray(Math.min(L, len - 1))
  const x = new Float32Array(shifted.length)
  x.set(shifted)
  if (p.thump) {
    // A damped low sine (the hand on the string, the finger on the body), relative to the string's first 50 ms.
    const tf = Math.max(55, Math.min(140, f))
    const tau = 0.025
    let e = 0
    const w = Math.min(x.length, Math.round(0.05 * sr))
    for (let i = 0; i < w; i++) e += x[i]! * x[i]!
    const amp = p.thump * 1.4 * Math.sqrt(e / Math.max(1, w))
    for (let i = 0; i < Math.min(x.length, sr * 0.2); i++) {
      const t = i / sr
      x[i] = x[i]! + amp * Math.exp(-t / tau) * Math.sin(2 * Math.PI * tf * t)
    }
  }
  for (const [bf, bq, bdb] of p.body ?? []) peaking(x, sr, bf, bq, bdb)
  if (p.tone) lowpass(x, sr, p.tone, 0.6)
  dcBlock(x, sr, Math.min(20, f * 0.3))
  return finishNote(x, sr, 0.25, 0.95, 0.0015, Math.min(0.25, x.length / sr * 0.12))
}

// ---- pianos (additive) -------------------------------------------------------------------

export interface PianoSpec {
  sr: number
  midi: number
  /** Velocity 0..1: hammer brightness (the level is the envelope's job). */
  vel: number
  /** Felt piano: muted, soft attack, shorter and darker. */
  felt: boolean
  /** Render length cap, seconds. */
  maxDur: number
  seed: number
}

/** The piano's key-tracked decay (T60 of the fundamental's long, 'aftersound' stage), seconds. */
export function pianoT60(midi: number, felt: boolean): number {
  const t = Math.min(16, Math.max(1.5, 30 * Math.pow(2, -(midi - 21) / 20)))
  return felt ? t * 0.55 : t
}

/**
 * Additive piano. Partial k sits at k·f·sqrt(1 + B·k²) (stretched: stiff
 * strings), shaped by the hammer (1/k roll-off, a notch near the 7th from
 * the strike point, a low-pass that opens with velocity). Each partial is two
 * slightly detuned strings, one dying fast (the prompt sound) and one slow
 * (the aftersound), so it beats and decays in two stages like a real unison.
 * Higher partials die faster. A short filtered-noise hammer knock sits on
 * the attack.
 */
export function renderPiano(p: PianoSpec): Float32Array {
  const sr = p.sr
  const midi = Math.min(120, Math.max(12, p.midi))
  const f = 440 * Math.pow(2, (midi - 69) / 12)
  const vel = Math.min(1, Math.max(0.05, p.vel))
  const felt = p.felt
  const rng = createRng(p.seed)
  const t60 = pianoT60(midi, felt)
  const len = Math.max(256, Math.round(Math.min(p.maxDur, t60) * sr))
  const acc = new Float64Array(len)

  const B = 0.00012 * Math.pow(2, (midi - 60) / 19)
  const top = Math.min(sr * 0.42, felt ? 6000 : 11000)
  // Hammer brightness: the partials' low-pass corner, in Hz.
  const fc = felt
    ? Math.min(2600, f * (1.4 + 3 * vel * vel))
    : Math.min(9000, f * (3 + 13 * Math.pow(vel, 1.6)))
  // Frequency-dependent loss: partials near fD die twice as fast as the fundamental.
  const fD = felt ? 700 : 1800
  const tauA = t60 / 6.9
  const detune = (0.25 + 0.5 * rng.next()) / 1731 // about 0.25..0.75 cents either side
  const strike = 1 / (7 + rng.next())
  const onset = Math.max(1, Math.round((felt ? 0.004 : 0.0012) * sr))

  for (let k = 1; k <= 40; k++) {
    const fk = k * f * Math.sqrt(1 + B * k * k)
    if (fk > top) break
    const hammer = Math.pow(k, -0.8) * (0.2 + 0.8 * Math.abs(Math.sin(Math.PI * k * strike)))
    const bright = 1 / (1 + Math.pow(fk / fc, 2))
    const amp = hammer * bright
    if (amp < 0.005) continue
    const damp = 1 + Math.pow(fk / fD, 1.3)
    const tauSlow = tauA / damp
    const tauFast = tauSlow / 4
    // Two phasors, (re, im) · r e^{jw} per sample, output the imaginary parts (they start at 0):
    // the prompt string (fast decay) and the aftersound string (slow), a fraction of a cent apart.
    const wa = (2 * Math.PI * fk * (1 + detune)) / sr
    const wb = (2 * Math.PI * fk * (1 - detune)) / sr
    const ra = Math.exp(-1 / (tauFast * sr)), rb = Math.exp(-1 / (tauSlow * sr))
    const ar = ra * Math.cos(wa), ai = ra * Math.sin(wa)
    const br = rb * Math.cos(wb), bi = rb * Math.sin(wb)
    // Random starting phases above the fundamental: the same spectrum with a lower crest factor
    // (all sines starting together stack into a sharp spike). The onset ramp makes the start smooth.
    const ph = k === 1 ? 0 : rng.next() * 2 * Math.PI
    let are = amp * 0.55 * Math.cos(ph), aim = amp * 0.55 * Math.sin(ph)
    let bre = amp * 0.45 * Math.cos(ph), bim = amp * 0.45 * Math.sin(ph)
    // Stop each once it is 60 dB under the fundamental.
    const stopA = Math.min(len, Math.ceil(tauFast * sr * Math.log(Math.max(1, (amp * 0.55) / 1e-3))))
    const stopB = Math.min(len, Math.ceil(tauSlow * sr * Math.log(Math.max(1, (amp * 0.45) / 1e-3))))
    for (let i = 0; i < stopA; i++) {
      acc[i] = acc[i]! + aim + bim
      let t = are * ar - aim * ai
      aim = are * ai + aim * ar
      are = t
      t = bre * br - bim * bi
      bim = bre * bi + bim * br
      bre = t
    }
    for (let i = stopA; i < stopB; i++) {
      acc[i] = acc[i]! + bim
      const t = bre * br - bim * bi
      bim = bre * bi + bim * br
      bre = t
    }
  }

  // Hammer knock: noise through a two-pole low-pass, a fast decay; felt is softer and duller.
  const x = new Float32Array(len)
  let fund = 0
  for (let k = 0; k < Math.min(len, sr * 0.25); k++) fund = Math.max(fund, Math.abs(acc[k]!))
  const kHz = felt ? 700 + 500 * vel : 1200 + 3200 * vel
  const ka = Math.exp((-2 * Math.PI * kHz) / sr)
  const kTau = felt ? 0.018 : 0.009
  const kAmp = fund * (felt ? 0.16 : 0.1) * (0.5 + vel)
  let n1 = 0, n2 = 0
  for (let i = 0; i < len; i++) {
    let v = acc[i]!
    if (i < sr * 0.12) {
      const w = rng.next() * 2 - 1
      n1 = (1 - ka) * w + ka * n1
      n2 = (1 - ka) * n1 + ka * n2
      v += n2 * kAmp * 4 * Math.exp(-i / (kTau * sr))
    }
    // The attack: partials rise over `onset` (felt a little slower).
    if (i < onset) v *= i / onset
    x[i] = v
  }
  if (felt) {
    // Close and warm: a low-mid body and a gentle top roll-off.
    peaking(x, sr, 180, 0.8, 2.5)
    lowpass(x, sr, 3200, 0.6)
  } else {
    peaking(x, sr, 110, 0.9, 1.5)
  }
  dcBlock(x, sr, 15)
  return finishNote(x, sr, 0.22, 0.95, 0.0008, Math.min(0.4, (len / sr) * 0.1))
}

// ---- vibraphone (additive) ----------------------------------------------------------------

export interface BarSpec {
  sr: number
  midi: number
  /** Velocity 0..1: mallet hardness (the level is the envelope's job). */
  vel: number
  /** Render length cap, seconds. */
  maxDur: number
  seed: number
}

/** The vibraphone's key-tracked ring (T60 of the fundamental, pedal down), seconds. */
export function vibesT60(midi: number): number {
  return Math.min(9, Math.max(2.5, 7 * Math.pow(2, -(midi - 53) / 18)))
}

/**
 * Vibraphone bar struck by a yarn mallet. An undercut aluminium bar is tuned
 * so its first three modes sit near 1 : 4 : 10; the resonator tube under it
 * feeds the fundamental, which rings for seconds, while the 4th dies in a
 * few tenths and the 10th is little more than the strike. A harder mallet
 * (velocity) excites the upper modes more and lands faster; a soft felt
 * thud (low-passed noise) sits under the onset. The motor tremolo is not in
 * the render: it is one shared gain per layer (instruments.ts), so every
 * note on the layer pulses together, as on the instrument.
 */
export function renderVibes(p: BarSpec): Float32Array {
  const sr = p.sr
  const midi = Math.min(100, Math.max(40, p.midi))
  const f = 440 * Math.pow(2, (midi - 69) / 12)
  const vel = Math.min(1, Math.max(0.05, p.vel))
  const rng = createRng(p.seed)
  const t60 = vibesT60(midi)
  const len = Math.max(256, Math.round(Math.min(p.maxDur, t60) * sr))
  const acc = new Float64Array(len)
  // [ratio, level, T60 as a fraction of the fundamental's]
  const modes: Array<[number, number, number]> = [
    [1, 1, 1],
    [3.99, 0.3 * (0.3 + vel), 0.16],
    [9.86, 0.12 * vel * vel, 0.035],
    // A faint torsional mode between them, off the harmonic grid: the metal in the tone.
    [2.76, 0.035 * vel, 0.05],
  ]
  for (const [ratio, amp, frac] of modes) {
    const fk = f * ratio
    if (fk > sr * 0.42 || amp <= 0) continue
    const tau = Math.max(0.012, (t60 * frac) / 6.9)
    const w = (2 * Math.PI * fk) / sr
    const r = Math.exp(-1 / (tau * sr))
    const cr = r * Math.cos(w), ci = r * Math.sin(w)
    const ph = ratio === 1 ? 0 : rng.next() * 2 * Math.PI
    let re = amp * Math.cos(ph), im = amp * Math.sin(ph)
    const stop = Math.min(len, Math.ceil(tau * sr * Math.log(Math.max(1, amp / 1e-4))))
    for (let i = 0; i < stop; i++) {
      acc[i] = acc[i]! + im
      const t = re * cr - im * ci
      im = re * ci + im * cr
      re = t
    }
  }
  // Mallet: the onset rises over 1 ms (hard) to 4 ms (soft); a felt thud under it.
  const onset = Math.max(1, Math.round((0.004 - 0.003 * vel) * sr))
  const tHz = 500 + 1800 * vel
  const ta = Math.exp((-2 * Math.PI * tHz) / sr)
  const tTau = 0.006
  let n1 = 0, n2 = 0
  const x = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    let v = acc[i]!
    if (i < sr * 0.05) {
      const w = rng.next() * 2 - 1
      n1 = (1 - ta) * w + ta * n1
      n2 = (1 - ta) * n1 + ta * n2
      v += n2 * (0.5 + 0.8 * vel) * Math.exp(-i / (tTau * sr))
    }
    if (i < onset) v *= 0.5 - 0.5 * Math.cos((Math.PI * i) / onset)
    x[i] = v
  }
  dcBlock(x, sr, 15)
  return finishNote(x, sr, 0.22, 0.95, 0.0005, Math.min(0.4, (len / sr) * 0.1))
}
