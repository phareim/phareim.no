// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The master chain and the shared effects.
 *
 *   input ─ HP 24 Hz ─ tone LP ─ tape (drive → shaper → makeup) ─ wow ─ width ─ glue comp ─ trim ─ limiter ─ soft clip ─ output
 *                                   └ hiss (grit)
 *   reverbIn ─ HP/LP ─ convolver A/B (crossfaded on size changes) ─┐
 *   gatedIn ─ gated convolver ──────────────────────────────────────┼─ input
 *   delayIn ─ HP/LP ─ ping-pong dotted eighth (filtered feedback) ──┘
 *
 * Returns join the master input, so tone, tape and width apply to the
 * whole mix. Every parameter moves with setTargetAtTime (no zipper noise).
 */
import type { FxState } from '../types.ts'
import { dottedEighth } from './timing.ts'
import { clamp } from './synth.ts'

export interface Fx {
  input: GainNode
  reverbIn: GainNode
  delayIn: GainNode
  gatedIn: GainNode
  output: AudioNode
  /** The mix just before the limiter (for level checks). */
  probe: AudioNode
  /** Glide to a bar's fx state starting at `t0`; `bar` is the bar length (s). */
  apply(s: FxState, t0: number, bar: number, bpm: number): void
}

/** Master trim before the limiter; calibrated so a full mix peaks near -3 dBFS. */
const TRIM = 1.0
/**
 * Reverb and delay returns. Chrome normalises a convolver's impulse to a fixed
 * power per sample, so its output grows with tail length; `sizeComp` keeps the
 * wet energy level as the room grows. At the usual sends (fx.reverb ≈ 0.35)
 * the reverb sits about 10 dB under a lead, the first echo about 12 dB under.
 */
const REVERB_RETURN = 2.8
const DELAY_RETURN = 1.4
const sizeComp = (size: number) => Math.sqrt(2.5 / size)

// ---- impulse responses ------------------------------------------------------------

/**
 * A stereo hall impulse: a few early reflections, then decorrelated noise
 * decaying to -60 dB at `rt60`, darkening as it decays (a one-pole low-pass
 * whose cutoff falls from ~11 kHz to ~1.8 kHz). Warm, never splashy.
 */
export function hallImpulse(ac: BaseAudioContext, rt60: number): AudioBuffer {
  const sr = ac.sampleRate
  const pre = 0.014
  const len = Math.floor(sr * (pre + rt60 * 1.05))
  const buf = ac.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / sr - pre
      if (t < 0) continue
      const env = Math.exp((-6.9 * t) / rt60) * Math.min(1, t / 0.025)
      const cutoff = 1800 + 9500 * Math.exp(-t / (rt60 * 0.3))
      const a = Math.exp((-2 * Math.PI * cutoff) / sr)
      lp = (1 - a) * (Math.random() * 2 - 1) + a * lp
      d[i] = lp * env
    }
    // Early reflections: sparse taps in the first 70 ms, different per side.
    for (let k = 0; k < 7; k++) {
      const t = pre + 0.006 + Math.random() * 0.065
      const i = Math.floor(t * sr)
      if (i < len) d[i] = d[i]! + (Math.random() < 0.5 ? -1 : 1) * 0.5 * Math.exp(-t * 18)
    }
  }
  return buf
}

/** The 80s gated room: dense for ~0.22 s, then cut. */
function gatedImpulse(ac: BaseAudioContext): AudioBuffer {
  const sr = ac.sampleRate
  const len = Math.floor(sr * 0.3)
  const buf = ac.createBuffer(2, len, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < len; i++) {
      const t = i / len
      const env = t < 0.72 ? 0.55 * Math.min(1, i / (sr * 0.004)) : Math.max(0, (1 - t) * 2)
      lp = 0.55 * (Math.random() * 2 - 1) + 0.45 * lp
      d[i] = lp * env
    }
  }
  return buf
}

/** Tape curve: normalised tanh over the shaper's input range. */
function tapeCurve() {
  const n = 4096
  const c = new Float32Array(n)
  const k = 3
  const norm = Math.tanh(k)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    // A touch of asymmetry for even harmonics; DC is removed by the HP after.
    c[i] = Math.tanh(k * x + 0.08 * k * x * x) / norm
  }
  return c
}

/** Soft clip: linear to 0.8, then eases to a 0.98 ceiling. The last line of defence. */
function softClipCurve() {
  const n = 4096
  const c = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    const a = Math.abs(x)
    const y = a <= 0.8 ? a : 0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18)
    c[i] = Math.sign(x) * y
  }
  return c
}

// ---- the chain -----------------------------------------------------------------------

export function createFx(ac: BaseAudioContext): Fx {
  const g = (v: number) => { const n = ac.createGain(); n.gain.value = v; return n }
  const f = (type: BiquadFilterType, fr: number, q = 0.7) => {
    const b = ac.createBiquadFilter()
    b.type = type
    b.frequency.value = fr
    b.Q.value = q
    return b
  }

  const input = g(1)
  const hp = f('highpass', 24, 0.6)
  const tone = f('lowpass', 16000, 0.5)
  // Tape: pre-gain sets how hard the curve is driven; post-gain undoes the small-signal gain.
  const drive = g(0.1)
  const shaper = ac.createWaveShaper()
  shaper.curve = tapeCurve()
  shaper.oversample = '2x'
  const makeup = g(1)
  const dc = f('highpass', 12, 0.5)
  // Wow and flutter: the whole mix through a short delay whose time wobbles.
  const wow = ac.createDelay(0.05)
  wow.delayTime.value = 0.008
  const wowLfo = ac.createOscillator()
  wowLfo.frequency.value = 0.31
  const wowDepth = g(0)
  const flutLfo = ac.createOscillator()
  flutLfo.frequency.value = 5.3
  const flutDepth = g(0)
  wowLfo.connect(wowDepth)
  wowDepth.connect(wow.delayTime)
  flutLfo.connect(flutDepth)
  flutDepth.connect(wow.delayTime)
  wowLfo.start()
  flutLfo.start()
  // Hiss: pink-ish noise, high-passed, only with grit.
  const hissSrc = ac.createBufferSource()
  hissSrc.buffer = hissBuffer(ac)
  hissSrc.loop = true
  const hissHp = f('highpass', 2500, 0.5)
  const hiss = g(0)
  hissSrc.connect(hissHp)
  hissHp.connect(hiss)
  hissSrc.start()
  // Width: L' = aL + bR, R' = aR + bL.
  const split = ac.createChannelSplitter(2)
  const merge = ac.createChannelMerger(2)
  const ll = g(1), rr = g(1), lr = g(0), rl = g(0)
  split.connect(ll, 0); split.connect(lr, 0)
  split.connect(rr, 1); split.connect(rl, 1)
  ll.connect(merge, 0, 0); rl.connect(merge, 0, 0)
  rr.connect(merge, 0, 1); lr.connect(merge, 0, 1)
  const widthIn = g(1)
  widthIn.connect(split)
  // Dynamics: a gentle glue compressor, a trim, a fast limiter, a soft clip.
  const glue = ac.createDynamicsCompressor()
  glue.threshold.value = -20
  glue.knee.value = 12
  glue.ratio.value = 2.2
  glue.attack.value = 0.025
  glue.release.value = 0.35
  const trim = g(TRIM)
  const limiter = ac.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 1
  limiter.ratio.value = 20
  limiter.attack.value = 0.002
  limiter.release.value = 0.12
  const clip = ac.createWaveShaper()
  clip.curve = softClipCurve()
  const output = g(1)

  input.connect(hp)
  hp.connect(tone)
  tone.connect(drive)
  drive.connect(shaper)
  shaper.connect(makeup)
  makeup.connect(dc)
  hiss.connect(dc)
  dc.connect(wow)
  wow.connect(widthIn)
  merge.connect(glue)
  glue.connect(trim)
  trim.connect(limiter)
  limiter.connect(clip)
  clip.connect(output)

  // ---- reverb: two convolvers, crossfaded on the input side --------------------------
  const reverbIn = g(0)
  const revHp = f('highpass', 180, 0.6)
  const revLp = f('lowpass', 8500, 0.5)
  reverbIn.connect(revHp)
  revHp.connect(revLp)
  const revOut = g(REVERB_RETURN)
  revOut.connect(input)
  interface Verb { conv: ConvolverNode; send: GainNode; size: number }
  const makeVerb = (size: number, level: number): Verb => {
    const conv = ac.createConvolver()
    conv.buffer = hallImpulse(ac, size)
    const send = g(level * sizeComp(size))
    revLp.connect(send)
    send.connect(conv)
    conv.connect(revOut)
    return { conv, send, size }
  }
  let verb = makeVerb(2.5, 1)
  let retiring: Verb | null = null

  const gatedIn = g(1)
  const gated = ac.createConvolver()
  gated.buffer = gatedImpulse(ac)
  const gatedHp = f('highpass', 250, 0.6)
  const gatedOut = g(0.55)
  gatedIn.connect(gatedHp)
  gatedHp.connect(gated)
  gated.connect(gatedOut)
  gatedOut.connect(input)

  // ---- delay: ping-pong dotted eighth ---------------------------------------------------
  const delayIn = g(0)
  delayIn.channelCount = 1
  delayIn.channelCountMode = 'explicit'
  const delHp = f('highpass', 320, 0.6)
  const delLp = f('lowpass', 4200, 0.6)
  const dl = ac.createDelay(2)
  const dr = ac.createDelay(2)
  dl.delayTime.value = 0.375
  dr.delayTime.value = 0.375
  const fb = g(0.36)
  const fbLp = f('lowpass', 2800, 0.5)
  const delOut = ac.createChannelMerger(2)
  const delRet = g(DELAY_RETURN)
  delayIn.connect(delHp)
  delHp.connect(delLp)
  delLp.connect(dl)
  dl.connect(dr)
  dr.connect(fbLp)
  fbLp.connect(fb)
  fb.connect(dl)
  dl.connect(delOut, 0, 0)
  dr.connect(delOut, 0, 1)
  delOut.connect(delRet)
  delRet.connect(input)

  let first = true

  function apply(s: FxState, t0: number, bar: number, bpm: number): void {
    const tau = Math.max(0.05, bar / 4)
    const set = (p: AudioParam, v: number) => {
      if (!Number.isFinite(v)) return
      if (first) p.setValueAtTime(v, t0)
      else p.setTargetAtTime(v, t0, tau)
    }
    const grit = clamp(s.grit ?? 0, 0, 1)
    const toneHz = 1000 * Math.pow(18, clamp(s.tone ?? 0.8, 0, 1)) * (1 - 0.3 * grit)
    set(tone.frequency, Math.min(toneHz, ac.sampleRate * 0.45))
    // Drive 0.1 (clean) .. 0.55 (warm); makeup keeps the small-signal gain at 1.
    const dv = 0.1 + 0.45 * grit
    set(drive.gain, dv)
    set(makeup.gain, Math.tanh(3) / (3 * dv))
    set(wowDepth.gain, 0.0011 * Math.pow(grit, 1.5))
    set(flutDepth.gain, 0.00005 * grit)
    set(hiss.gain, 0.0022 * grit * grit)
    const w = 0.5 + 0.9 * clamp(s.width ?? 0.55, 0, 1)
    set(ll.gain, (1 + w) / 2); set(rr.gain, (1 + w) / 2)
    set(lr.gain, (1 - w) / 2); set(rl.gain, (1 - w) / 2)
    set(reverbIn.gain, clamp(s.reverb ?? 0.3, 0, 1) * 2)
    set(delayIn.gain, clamp(s.delay ?? 0.2, 0, 1) * 2)
    const dt = dottedEighth(bpm)
    set(dl.delayTime, dt)
    set(dr.delayTime, dt)
    // Reverb size: rebuild and crossfade over a bar when it moves by more than half a second.
    const size = clamp(s.reverbSize ?? 2.5, 0.8, 9)
    if (first) {
      if (Math.abs(size - verb.size) > 0.05) {
        try { verb.send.disconnect(); verb.conv.disconnect() } catch { /* gone */ }
        verb = makeVerb(size, 1)
      }
    } else if (Math.abs(size - verb.size) > 0.5) {
      if (retiring) {
        try { retiring.send.disconnect(); retiring.conv.disconnect() } catch { /* gone */ }
      }
      const old = verb
      old.send.gain.setValueAtTime(sizeComp(old.size), t0)
      old.send.gain.linearRampToValueAtTime(0, t0 + bar)
      verb = makeVerb(size, 0)
      verb.send.gain.setValueAtTime(0, t0)
      verb.send.gain.linearRampToValueAtTime(sizeComp(size), t0 + bar)
      retiring = old
      // Free the old convolver once its tail has rung out.
      const ms = Math.max(0, (t0 + bar + old.size + 0.5 - ac.currentTime) * 1000)
      const gone = old
      setTimeoutSafe(() => {
        if (retiring !== gone) return
        try { gone.send.disconnect(); gone.conv.disconnect() } catch { /* gone */ }
        retiring = null
      }, ms)
    }
    first = false
  }

  return { input, reverbIn, delayIn, gatedIn, output, probe: trim, apply }
}

function hissBuffer(ac: BaseAudioContext): AudioBuffer {
  const sr = ac.sampleRate
  const b = ac.createBuffer(2, sr * 3, sr)
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < d.length; i++) {
      lp = 0.6 * lp + 0.4 * (Math.random() * 2 - 1)
      d[i] = lp
    }
  }
  return b
}

/** setTimeout that is harmless where there is no timer (offline renders finish first anyway). */
function setTimeoutSafe(fn: () => void, ms: number): void {
  if (typeof setTimeout === 'function') setTimeout(fn, ms)
}
