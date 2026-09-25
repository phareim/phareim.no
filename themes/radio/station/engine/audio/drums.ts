// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Drum kits: `playDrum(v, kit, hit, at, vel, len?)`.
 *
 * Seven kits, each mapping all twelve hit names (k s c h o r p t m T x z) to
 * its own synthesis. The hits are built from a handful of primitives
 * (pitched body, filtered noise, metal cluster, NES noise) with per-kit
 * parameters, so every kit keeps one character: synthwave punchy and gated,
 * soft dusty lofi, tribal skins and wood, brushes, dry motorik, a muffled
 * heartbeat, NES noise-channel chip drums.
 *
 * Every hit is one output gain (level × velocity) into the layer bus, and
 * optionally into the gated reverb. It is disconnected when its longest
 * source ends.
 */
import type { KitId, DrumHit } from '../types.ts'
import { type VoiceCtx, clamp, rand, safeHz } from './synth.ts'

interface Hit {
  ac: BaseAudioContext
  v: VoiceCtx
  at: number
  out: GainNode
  /** Nodes connected to the layer's live buses; disconnected when the hit is over. */
  taps: AudioNode[]
  last: AudioScheduledSourceNode | null
  end: number
}

type HitFn = (h: Hit, vel: number, len: number) => void

// ---- the hit wrapper -------------------------------------------------------------

function open(v: VoiceCtx, at: number, level: number, pan: number, gated: number): Hit {
  const ac = v.ac
  const out = ac.createGain()
  out.gain.value = level
  let tail: AudioNode = out
  if (pan) {
    const p = ac.createStereoPanner()
    p.pan.value = clamp(pan, -1, 1)
    out.connect(p)
    tail = p
  }
  tail.connect(v.out.input)
  const taps = [tail]
  if (gated > 0 && v.out.gate) {
    const g = ac.createGain()
    g.gain.value = gated
    out.connect(g)
    g.connect(v.out.gate)
    taps.push(g)
  }
  return { ac, v, at, out, taps, last: null, end: at }
}

function track(h: Hit, src: AudioScheduledSourceNode, end: number): void {
  src.stop(end)
  if (end >= h.end) { h.end = end; h.last = src }
}

function close(h: Hit): void {
  const src = h.last
  if (!src) return
  src.onended = () => {
    for (const t of h.taps) {
      try { t.disconnect() } catch { /* gone */ }
    }
  }
}

// ---- primitives ------------------------------------------------------------------

interface BodyP {
  /** Start and end pitch (Hz), pitch time constant. */
  f0: number; f1: number; pTau: number
  /** Amp decay time constant. */
  decay: number
  lvl: number
  type?: OscillatorType
  /** Low-pass on the body (muffle). */
  lp?: number
  /** Offset from the hit time. */
  delay?: number
}

/** A pitched body: an oscillator gliding down, with an exponential decay. Kicks, toms, congas, blocks. */
function body(h: Hit, p: BodyP): void {
  const ac = h.ac
  const at = h.at + (p.delay ?? 0)
  const o = ac.createOscillator()
  o.type = p.type ?? 'sine'
  o.frequency.setValueAtTime(safeHz(ac, p.f0), at)
  o.frequency.setTargetAtTime(safeHz(ac, p.f1), at, p.pTau)
  const g = ac.createGain()
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(p.lvl, at + 0.0015)
  g.gain.setTargetAtTime(0, at + 0.0015, p.decay)
  o.connect(g)
  if (p.lp) {
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = p.lp
    f.Q.value = 0.5
    g.connect(f)
    f.connect(h.out)
  } else g.connect(h.out)
  o.start(at)
  track(h, o, at + p.decay * 7 + 0.01)
}

interface NoiseP {
  buf?: AudioBuffer
  rate?: number
  /** Filter chain: [type, freq, Q]. */
  filters: Array<[BiquadFilterType, number, number]>
  /** Sweep the first filter to this frequency over `sweep` seconds. */
  sweepTo?: number
  sweep?: number
  attack?: number
  decay: number
  lvl: number
  delay?: number
  /** Hold at full level for this long before decaying (brush swish body). */
  hold?: number
}

/** Filtered noise with an envelope. Snares, hats, shakers, crashes, brushes. */
function noiseHit(h: Hit, p: NoiseP): void {
  const ac = h.ac
  const at = h.at + (p.delay ?? 0)
  const buf = p.buf ?? h.v.res.white
  const s = ac.createBufferSource()
  s.buffer = buf
  s.loop = true
  s.playbackRate.value = p.rate ?? 1
  let node: AudioNode = s
  p.filters.forEach(([type, f, q], i) => {
    const b = ac.createBiquadFilter()
    b.type = type
    b.frequency.value = safeHz(ac, f)
    b.Q.value = q
    if (i === 0 && p.sweepTo) {
      b.frequency.setValueAtTime(safeHz(ac, f), at)
      b.frequency.exponentialRampToValueAtTime(safeHz(ac, p.sweepTo), at + (p.sweep ?? p.decay))
    }
    node.connect(b)
    node = b
  })
  const g = ac.createGain()
  const a = p.attack ?? 0.001
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(p.lvl, at + a)
  const hold = p.hold ?? 0
  if (hold) g.gain.setValueAtTime(p.lvl, at + a + hold)
  g.gain.setTargetAtTime(0, at + a + hold, p.decay)
  node.connect(g)
  g.connect(h.out)
  s.start(at, Math.random() * (buf.duration - 0.05))
  track(h, s, at + a + hold + p.decay * 7 + 0.01)
}

/** Several quick noise bursts then a tail: a clap. */
function clapHit(h: Hit, bp: number, q: number, bursts: number, spacing: number, tail: number, lvl: number, lp = 9000): void {
  const ac = h.ac
  const at = h.at
  const s = ac.createBufferSource()
  s.buffer = h.v.res.white
  s.loop = true
  const f = ac.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = bp
  f.Q.value = q
  const l = ac.createBiquadFilter()
  l.type = 'lowpass'
  l.frequency.value = lp
  const g = ac.createGain()
  g.gain.setValueAtTime(0, at)
  for (let i = 0; i < bursts; i++) {
    const t = at + i * spacing * rand(0.85, 1.15)
    g.gain.setValueAtTime(lvl, t)
    g.gain.setTargetAtTime(lvl * 0.1, t + 0.001, 0.0035)
  }
  const tailAt = at + bursts * spacing
  g.gain.setValueAtTime(lvl * 0.8, tailAt)
  g.gain.setTargetAtTime(0, tailAt + 0.001, tail)
  s.connect(f)
  f.connect(l)
  l.connect(g)
  g.connect(h.out)
  s.start(at, Math.random() * 3)
  track(h, s, tailAt + tail * 7)
}

/** A rising swell over `len` seconds that stops dead at the end: the reverse-cymbal riser. */
function riser(h: Hit, len: number, p: { buf?: AudioBuffer; from: number; to: number; q: number; lvl: number; rate?: number }): void {
  const ac = h.ac
  const at = h.at
  const L = clamp(len, 0.2, 16)
  const s = ac.createBufferSource()
  s.buffer = p.buf ?? h.v.res.white
  s.loop = true
  s.playbackRate.value = p.rate ?? 1
  const f = ac.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = p.q
  f.frequency.setValueAtTime(safeHz(ac, p.from), at)
  f.frequency.exponentialRampToValueAtTime(safeHz(ac, p.to), at + L)
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(p.lvl, at + L * 0.97)
  g.gain.linearRampToValueAtTime(0, at + L + 0.02)
  s.connect(f)
  f.connect(g)
  g.connect(h.out)
  s.start(at, Math.random() * 2)
  track(h, s, at + L + 0.05)
}

// ---- kit building blocks ----------------------------------------------------------

/** A kick: body, optional click, optional sub tail. */
const kick = (f0: number, f1: number, pTau: number, decay: number, click: number, lp?: number): HitFn => (h, vel) => {
  body(h, { f0: f0 * (0.95 + 0.1 * vel), f1, pTau, decay, lvl: 1, lp })
  if (click > 0) noiseHit(h, { filters: [['highpass', 1800, 0.7], ['lowpass', 7000, 0.7]], decay: 0.004, lvl: click * vel })
}

const snare = (tone: number, toneDecay: number, hp: number, lp: number, nDecay: number, nLvl: number, tLvl = 0.6): HitFn => h => {
  body(h, { f0: tone * 1.35, f1: tone, pTau: 0.02, decay: toneDecay, lvl: tLvl, type: 'triangle' })
  noiseHit(h, { filters: [['highpass', hp, 0.7], ['lowpass', lp, 0.6]], decay: nDecay, lvl: nLvl })
}

const hat = (buf: 'metal' | 'white' | 'nesShort' | 'nesLong', hp: number, decay: number, lvl: number, bp?: number, rate = 1): HitFn => h => {
  const filters: Array<[BiquadFilterType, number, number]> = [['highpass', hp, 0.7]]
  if (bp) filters.push(['bandpass', bp, 0.9])
  noiseHit(h, { buf: h.v.res[buf], rate, filters, decay, lvl })
}

const tom = (f0: number, decay: number, noiseLvl: number, type: OscillatorType = 'sine', lp?: number): HitFn => h => {
  body(h, { f0: f0 * 1.6, f1: f0, pTau: 0.03, decay, lvl: 1, type, lp })
  if (noiseLvl) noiseHit(h, { filters: [['bandpass', f0 * 6, 1.2]], decay: 0.03, lvl: noiseLvl })
}

const shaker = (bp: number, attack: number, decay: number, lvl: number): HitFn => h =>
  noiseHit(h, { filters: [['highpass', bp * 0.7, 0.7], ['bandpass', bp, 1.2]], attack, decay, lvl })

const ride = (hp: number, decay: number, lvl: number, bell: number, bellF = 620): HitFn => h => {
  noiseHit(h, { buf: h.v.res.metal, filters: [['highpass', hp, 0.7], ['bandpass', hp * 1.5, 0.8]], decay, lvl })
  if (bell) {
    body(h, { f0: bellF, f1: bellF, pTau: 1, decay: decay * 0.6, lvl: bell, type: 'sine' })
    body(h, { f0: bellF * 2.41, f1: bellF * 2.41, pTau: 1, decay: decay * 0.35, lvl: bell * 0.5, type: 'sine' })
  }
}

const crash = (hp: number, decay: number, lvl: number, lp = 12000): HitFn => h => {
  noiseHit(h, { buf: h.v.res.metal, filters: [['highpass', hp, 0.7], ['lowpass', lp, 0.5]], decay, lvl: lvl * 0.6 })
  noiseHit(h, { filters: [['highpass', hp * 1.2, 0.7], ['lowpass', lp, 0.5]], decay: decay * 0.8, lvl: lvl * 0.5 })
}

const conga = (f: number, decay: number, slap: number): HitFn => (h, vel) => {
  body(h, { f0: f * 1.25, f1: f, pTau: 0.012, decay, lvl: 1 })
  body(h, { f0: f * 2.3, f1: f * 2.1, pTau: 0.02, decay: decay * 0.4, lvl: 0.22 })
  noiseHit(h, { filters: [['bandpass', 2200, 1.4]], decay: 0.012, lvl: slap * vel })
}

const block = (f: number, decay: number): HitFn => h => {
  body(h, { f0: f, f1: f * 0.97, pTau: 0.05, decay, lvl: 1, type: 'sine' })
  body(h, { f0: f * 2.7, f1: f * 2.6, pTau: 0.05, decay: decay * 0.5, lvl: 0.25, type: 'sine' })
}

const rim = (f = 1700): HitFn => h => {
  body(h, { f0: f, f1: f * 0.94, pTau: 0.02, decay: 0.012, lvl: 0.8, type: 'triangle' })
  body(h, { f0: f * 0.31, f1: f * 0.3, pTau: 0.02, decay: 0.025, lvl: 0.5, type: 'sine' })
  noiseHit(h, { filters: [['highpass', 3000, 0.7]], decay: 0.006, lvl: 0.4 })
}

/** Two hits in one (heartbeat lub-dub, flams). */
const both = (a: HitFn, b: HitFn): HitFn => (h, vel, len) => { a(h, vel, len); b(h, vel, len) }

/** Play `f` again `delay` seconds later at `scale` level (in the same hit output). */
const echo = (f: HitFn, delay: number, scale: number): HitFn => (h, vel, len) => {
  f(h, vel, len)
  const h2: Hit = { ...h, at: h.at + delay, out: h.ac.createGain() }
  h2.out.gain.value = scale
  h2.out.connect(h.out)
  f(h2, vel * scale, len)
  if (h2.end > h.end) { h.end = h2.end; h.last = h2.last }
}

// ---- the kits --------------------------------------------------------------------------

interface KitHit { fn: HitFn; lvl: number; pan?: number; gated?: number }
type Kit = Record<DrumHit, KitHit>

const KITS: Record<KitId, Kit> = {
  // Punchy kick, big gated snare, crisp hats, clap; Simmons toms into the gated room.
  'kit.synthwave': {
    k: { fn: kick(155, 44, 0.035, 0.16, 0.35), lvl: 0.78 },
    s: { fn: snare(185, 0.09, 1300, 9000, 0.07, 0.55), lvl: 0.666, gated: 0.8 },
    c: { fn: (h, vel) => clapHit(h, 1250, 1.1, 4, 0.009, 0.06, 0.9 * (0.6 + 0.4 * vel)), lvl: 0.718, gated: 0.8 },
    h: { fn: hat('metal', 7500, 0.012, 0.9, 10000), lvl: 0.71, pan: 0.18 },
    o: { fn: hat('metal', 6800, 0.075, 0.8, 9500), lvl: 0.479, pan: 0.18 },
    r: { fn: ride(5200, 0.28, 0.55, 0.08), lvl: 0.279, pan: 0.3 },
    p: { fn: shaker(7000, 0.006, 0.03, 0.7), lvl: 0.32, pan: -0.25 },
    t: { fn: tom(95, 0.16, 0.3), lvl: 0.397, pan: -0.3, gated: 0.5 },
    m: { fn: tom(135, 0.14, 0.3), lvl: 0.365, pan: 0, gated: 0.5 },
    T: { fn: tom(190, 0.12, 0.3), lvl: 0.334, pan: 0.3, gated: 0.5 },
    x: { fn: crash(3800, 0.55, 1), lvl: 0.252, pan: -0.15 },
    z: { fn: (h, _v, len) => riser(h, len, { from: 500, to: 7000, q: 1.3, lvl: 0.7 }), lvl: 0.24 },
  },
  // Lofi: round kick, soft papery snare, dusty hats, rim.
  'kit.soft': {
    k: { fn: kick(115, 48, 0.045, 0.2, 0, 900), lvl: 0.8 },
    s: { fn: snare(170, 0.07, 900, 4500, 0.06, 0.5, 0.45), lvl: 0.605 },
    c: { fn: (h, vel) => clapHit(h, 1000, 0.9, 3, 0.011, 0.05, 0.8 * (0.6 + 0.4 * vel), 4500), lvl: 0.559 },
    h: { fn: hat('white', 5000, 0.018, 0.8, 7500), lvl: 0.279, pan: 0.2 },
    o: { fn: hat('white', 4500, 0.08, 0.7, 7000), lvl: 0.219, pan: 0.2 },
    r: { fn: ride(4200, 0.35, 0.5, 0.05, 560), lvl: 0.251, pan: 0.3 },
    p: { fn: rim(1500), lvl: 0.269, pan: -0.2 },
    t: { fn: tom(90, 0.18, 0, 'sine', 1200), lvl: 0.45, pan: -0.25 },
    m: { fn: tom(125, 0.16, 0, 'sine', 1400), lvl: 0.42, pan: 0 },
    T: { fn: tom(170, 0.14, 0, 'sine', 1600), lvl: 0.4, pan: 0.25 },
    x: { fn: crash(3000, 0.5, 1, 7000), lvl: 0.151, pan: -0.15 },
    z: { fn: (h, _v, len) => riser(h, len, { buf: h.v.res.pink, from: 400, to: 3500, q: 1, lvl: 1.76 }), lvl: 0.18 },
  },
  // Skins and wood: deep kick, djembe slap, group claps, shakers, congas, woodblock, low gong swell.
  'kit.tribal': {
    k: { fn: kick(95, 42, 0.05, 0.3, 0.12, 1500), lvl: 0.8 },
    s: { fn: both(conga(330, 0.06, 0.9), (h) => noiseHit(h, { filters: [['bandpass', 1500, 0.9]], decay: 0.04, lvl: 0.629 })), lvl: 0.4, pan: 0.15 },
    c: { fn: (h, vel) => clapHit(h, 1100, 0.8, 6, 0.014, 0.07, 0.8 * (0.6 + 0.4 * vel), 6000), lvl: 0.533, pan: -0.1 },
    h: { fn: shaker(6200, 0.012, 0.035, 0.8), lvl: 0.317, pan: 0.3 },
    o: { fn: shaker(5200, 0.04, 0.08, 0.7), lvl: 0.285, pan: 0.3 },
    r: { fn: echo(block(1350, 0.05), 0.11, 0.6), lvl: 0.18, pan: -0.35 },
    p: { fn: conga(240, 0.13, 0.5), lvl: 0.36, pan: -0.3 },
    t: { fn: tom(78, 0.28, 0.2), lvl: 0.52, pan: -0.25 },
    m: { fn: tom(108, 0.24, 0.2), lvl: 0.48, pan: 0.05 },
    T: { fn: block(820, 0.06), lvl: 0.339, pan: 0.35 },
    x: {
      fn: h => {
        // Low gong: inharmonic partials swelling slightly, long decay.
        for (const [r, l] of [[1, 1], [1.48, 0.5], [2.12, 0.3], [2.83, 0.15]] as const) {
          body(h, { f0: 98 * r, f1: 96 * r, pTau: 0.6, decay: 0.9, lvl: l, type: 'sine' })
        }
      },
      lvl: 0.13,
    },
    z: { fn: (h, _v, len) => riser(h, len, { from: 3000, to: 8000, q: 1.5, lvl: 0.6 }), lvl: 0.2 },
  },
  // Brushes: soft kick, swishes, cross-stick, jazz ride with a bell.
  'kit.brush': {
    k: { fn: kick(95, 50, 0.04, 0.17, 0, 700), lvl: 0.66 },
    s: { fn: (h, vel) => noiseHit(h, { buf: h.v.res.pink, filters: [['bandpass', 2600, 0.8], ['lowpass', 6000, 0.5]], attack: 0.012, decay: 0.07 + 0.05 * vel, lvl: 2 }), lvl: 0.3 },
    c: { fn: h => noiseHit(h, { buf: h.v.res.pink, filters: [['bandpass', 2200, 1.1]], attack: 0.03, hold: 0.05, decay: 0.07, sweepTo: 3600, sweep: 0.12, lvl: 2 }), lvl: 0.24 },
    h: { fn: hat('metal', 6000, 0.02, 0.6, 8000), lvl: 0.601, pan: 0.22 },
    o: { fn: hat('metal', 5200, 0.12, 0.55, 7500), lvl: 0.398, pan: 0.22 },
    r: { fn: ride(5000, 0.4, 0.6, 0.12, 700), lvl: 0.231, pan: 0.35 },
    p: { fn: rim(1350), lvl: 0.252, pan: -0.15 },
    t: { fn: tom(88, 0.2, 0.1, 'sine', 900), lvl: 0.4, pan: -0.25 },
    m: { fn: tom(120, 0.18, 0.1, 'sine', 1100), lvl: 0.38, pan: 0 },
    T: { fn: tom(160, 0.15, 0.1, 'sine', 1300), lvl: 0.36, pan: 0.25 },
    x: { fn: crash(3500, 0.6, 1, 8000), lvl: 0.141, pan: 0.3 },
    z: { fn: (h, _v, len) => riser(h, len, { buf: h.v.res.pink, from: 1200, to: 5000, q: 0.8, lvl: 1.2 }), lvl: 0.16 },
  },
  // Dry and tight: short kick, tight snare, closed sixteenth hats, tambourine.
  'kit.motorik': {
    k: { fn: kick(130, 50, 0.025, 0.11, 0.3), lvl: 0.76 },
    s: { fn: snare(220, 0.05, 1600, 10000, 0.04, 0.55, 0.5), lvl: 0.537 },
    c: { fn: (h, vel) => clapHit(h, 1400, 1.2, 3, 0.008, 0.035, 0.9 * (0.6 + 0.4 * vel)), lvl: 0.533 },
    h: { fn: hat('metal', 8500, 0.008, 0.9, 11000), lvl: 1, pan: 0.15 },
    o: { fn: hat('metal', 7500, 0.04, 0.8, 10000), lvl: 0.637, pan: 0.15 },
    r: { fn: ride(6000, 0.22, 0.6, 0.06, 760), lvl: 0.301, pan: 0.3 },
    p: {
      fn: h => {
        // Tambourine: jingles (metal, band-passed high) with a short shake.
        noiseHit(h, { buf: h.v.res.metal, rate: 1.3, filters: [['bandpass', 9000, 2], ['highpass', 6000, 0.7]], decay: 0.05, lvl: 2.51 })
        noiseHit(h, { filters: [['highpass', 7000, 0.7]], attack: 0.003, decay: 0.02, lvl: 0.4 })
      },
      lvl: 0.16, pan: -0.25,
    },
    t: { fn: tom(100, 0.1, 0.2), lvl: 0.48, pan: -0.25 },
    m: { fn: tom(140, 0.09, 0.2), lvl: 0.44, pan: 0 },
    T: { fn: tom(190, 0.08, 0.2), lvl: 0.4, pan: 0.25 },
    x: { fn: crash(4500, 0.4, 1), lvl: 0.201, pan: 0.2 },
    z: { fn: (h, _v, len) => riser(h, len, { from: 800, to: 9000, q: 2, lvl: 0.848 }), lvl: 0.2 },
  },
  // Muffled and low: a double-thump kick, thuds, almost no highs.
  'kit.heartbeat': {
    k: { fn: echo(kick(78, 40, 0.04, 0.16, 0, 400), 0.19, 0.6), lvl: 0.9 },
    s: { fn: both(tom(110, 0.1, 0, 'sine', 500), h => noiseHit(h, { buf: h.v.res.brown, filters: [['lowpass', 700, 0.7]], decay: 0.06, lvl: 0.6 })), lvl: 0.42 },
    c: { fn: (h, vel) => clapHit(h, 700, 0.8, 3, 0.012, 0.05, 0.8 * (0.6 + 0.4 * vel), 1400), lvl: 0.38 },
    h: { fn: h => noiseHit(h, { buf: h.v.res.pink, filters: [['bandpass', 2600, 1.2], ['lowpass', 3500, 0.5]], decay: 0.012, lvl: 2 }), lvl: 0.06, pan: 0.15 },
    o: { fn: h => noiseHit(h, { buf: h.v.res.pink, filters: [['lowpass', 1800, 0.6]], attack: 0.05, decay: 0.15, lvl: 1 }), lvl: 0.08 },
    r: { fn: h => body(h, { f0: 330, f1: 330, pTau: 1, decay: 0.3, lvl: 1, lp: 900 }), lvl: 0.1, pan: 0.2 },
    p: { fn: h => body(h, { f0: 420, f1: 360, pTau: 0.02, decay: 0.03, lvl: 1, lp: 1000 }), lvl: 0.2, pan: -0.2 },
    t: { fn: tom(62, 0.24, 0, 'sine', 380), lvl: 0.55, pan: -0.2 },
    m: { fn: tom(80, 0.2, 0, 'sine', 420), lvl: 0.5 },
    T: { fn: tom(100, 0.18, 0, 'sine', 480), lvl: 0.46, pan: 0.2 },
    x: { fn: h => noiseHit(h, { buf: h.v.res.brown, filters: [['lowpass', 1200, 0.5]], attack: 0.1, decay: 0.6, lvl: 1.26 }), lvl: 0.2 },
    z: { fn: (h, _v, len) => riser(h, len, { buf: h.v.res.brown, from: 200, to: 1500, q: 0.7, lvl: 2.01 }), lvl: 0.3 },
  },
  // NES: triangle-channel kick and toms, LFSR noise snare and hats, pulse blip.
  'kit.chip': {
    k: {
      fn: h => {
        body(h, { f0: 200, f1: 48, pTau: 0.025, decay: 0.09, lvl: 1.26, type: 'triangle' })
        noiseHit(h, { buf: h.v.res.nesLong, rate: 0.5, filters: [['lowpass', 5000, 0.5]], decay: 0.01, lvl: 0.3 })
      },
      lvl: 0.8,
    },
    s: {
      fn: h => {
        noiseHit(h, { buf: h.v.res.nesLong, rate: 0.7, filters: [['lowpass', 9000, 0.5], ['highpass', 400, 0.7]], decay: 0.06, lvl: 0.794 })
        body(h, { f0: 330, f1: 180, pTau: 0.02, decay: 0.04, lvl: 0.35, type: 'triangle' })
      },
      lvl: 0.32,
    },
    c: { fn: h => { for (let i = 0; i < 3; i++) noiseHit(h, { buf: h.v.res.nesLong, rate: 0.6, filters: [['bandpass', 1600, 0.8]], decay: 0.012, lvl: 1, delay: i * 0.018 }) }, lvl: 0.34 },
    h: { fn: hat('nesShort', 4000, 0.01, 0.8, undefined, 1.6), lvl: 0.239, pan: 0.15 },
    o: { fn: hat('nesLong', 5000, 0.06, 0.8, undefined, 0.9), lvl: 0.19, pan: 0.15 },
    r: { fn: hat('nesShort', 3000, 0.12, 0.7, undefined, 1.1), lvl: 0.08, pan: 0.25 },
    p: {
      fn: h => {
        const ac = h.ac
        const o = ac.createOscillator()
        o.setPeriodicWave(h.v.res.pulse25)
        o.frequency.setValueAtTime(1320, h.at)
        o.frequency.setValueAtTime(1760, h.at + 0.025)
        const g = ac.createGain()
        g.gain.setValueAtTime(0.5, h.at)
        g.gain.setTargetAtTime(0, h.at + 0.03, 0.01)
        const lp = ac.createBiquadFilter()
        lp.frequency.value = 5000
        o.connect(lp)
        lp.connect(g)
        g.connect(h.out)
        o.start(h.at)
        track(h, o, h.at + 0.12)
      },
      lvl: 0.18, pan: -0.2,
    },
    t: { fn: h => body(h, { f0: 180, f1: 70, pTau: 0.05, decay: 0.12, lvl: 1, type: 'triangle' }), lvl: 0.5, pan: -0.2 },
    m: { fn: h => body(h, { f0: 260, f1: 100, pTau: 0.05, decay: 0.1, lvl: 1, type: 'triangle' }), lvl: 0.46 },
    T: { fn: h => body(h, { f0: 360, f1: 140, pTau: 0.05, decay: 0.09, lvl: 1, type: 'triangle' }), lvl: 0.42, pan: 0.2 },
    x: { fn: h => noiseHit(h, { buf: h.v.res.nesLong, rate: 0.8, filters: [['highpass', 1500, 0.7], ['lowpass', 10000, 0.5]], decay: 0.3, lvl: 0.631 }), lvl: 0.16 },
    z: { fn: (h, _v, len) => riser(h, len, { buf: h.v.res.nesLong, from: 600, to: 8000, q: 1.2, lvl: 0.7, rate: 0.5 }), lvl: 0.2 },
  },
}

/** Per-kit loudness (linear), calibrated so each kit's groove sits at about -24 LUFS through the drums layer. */
const KIT_GAIN: Record<KitId, number> = {
  'kit.synthwave': 0.266, 'kit.soft': 0.209, 'kit.tribal': 0.199, 'kit.brush': 0.224,
  'kit.motorik': 0.316, 'kit.heartbeat': 0.178, 'kit.chip': 0.295,
}

export const KIT_IDS = Object.keys(KITS) as KitId[]
export const HITS: DrumHit[] = ['k', 's', 'c', 'h', 'o', 'r', 'p', 't', 'm', 'T', 'x', 'z']

/** Play one drum hit. `len` (seconds) is only used by the riser 'z'. */
export function playDrum(v: VoiceCtx, kit: KitId, hit: DrumHit, at: number, vel: number, len = 1): void {
  const id = KITS[kit] ? kit : 'kit.synthwave'
  const k = KITS[id][hit]
  if (!k || !Number.isFinite(at) || !(vel > 0)) return
  const vv = clamp(vel, 0, 1)
  const h = open(v, at, KIT_GAIN[id] * k.lvl * vv * (0.4 + 0.6 * vv), k.pan ?? 0, k.gated ?? 0)
  k.fn(h, vv, len)
  close(h)
}
