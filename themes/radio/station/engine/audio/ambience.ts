// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Ambience: background textures under the music.
 *
 * Each AmbienceId is a texture with a level gain into the ambience layer.
 * A texture has a continuous bed (looping noise through filters, its
 * parameters wandering on slow random walks) and/or events from its own
 * random timers (birds, drops, gull cries, chimes, passing cars). Key-aware
 * events (gulls, owl, chimes, distant bell, radio, shimmer, space hum) take
 * their pitches from the current BarPlan's key and scale.
 *
 * Levels in a BarPlan are targets reached over `ambienceFadeBars` bars, one
 * linear ramp per bar. A texture whose level has reached 0 is stopped and
 * its nodes freed; nothing is scheduled for it until it comes back.
 */
import type { AmbienceId, BarPlan, Key } from '../types.ts'
import { type VoiceCtx, type Resources, clamp, rand, pick, hz, safeHz } from './synth.ts'
import { type Fade, fadeAtBarStart, fadeAtBarEnd } from './timing.ts'

// ---- texture plumbing ------------------------------------------------------------

interface Env {
  ac: BaseAudioContext
  res: Resources
  /** The texture's level gain. */
  out: GainNode
  key(): Key
  scale(): number[]
}

interface Tx {
  start(t: number): void
  stop(t: number): void
  /** Schedule modulation and events in [from, to). `level` is the texture's level 0..1. */
  run(from: number, to: number, level: number): void
}

type Factory = (e: Env) => Tx

/** A timer that fires `fn` at random intervals. */
interface Timer { next: number }

function every(tm: Timer, from: number, to: number, gap: () => number, fn: (t: number) => void): void {
  let guard = 0
  while (tm.next < to && guard++ < 200) {
    if (tm.next >= from - 0.02) fn(tm.next)
    tm.next += Math.max(0.01, gap())
  }
}

/** Book-keeping for a texture's persistent sources and nodes. */
class Bed {
  srcs: AudioScheduledSourceNode[] = []
  nodes: AudioNode[] = []
  e: Env
  constructor(e: Env) { this.e = e }
  loop(buf: AudioBuffer, t: number, rate = 1): AudioBufferSourceNode {
    const s = this.e.ac.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.playbackRate.value = rate
    s.start(t, Math.random() * (buf.duration - 0.1))
    this.srcs.push(s)
    return s
  }
  osc(type: OscillatorType, f: number, t: number): OscillatorNode {
    const o = this.e.ac.createOscillator()
    o.type = type
    o.frequency.value = safeHz(this.e.ac, f)
    o.start(t)
    this.srcs.push(o)
    return o
  }
  filter(type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const b = this.e.ac.createBiquadFilter()
    b.type = type
    b.frequency.value = safeHz(this.e.ac, f)
    b.Q.value = q
    this.nodes.push(b)
    return b
  }
  gain(v: number): GainNode {
    const g = this.e.ac.createGain()
    g.gain.value = v
    this.nodes.push(g)
    return g
  }
  pan(p: number): StereoPannerNode {
    const n = this.e.ac.createStereoPanner()
    n.pan.value = p
    this.nodes.push(n)
    return n
  }
  stop(t: number): void {
    for (const s of this.srcs) { try { s.stop(t) } catch { /* not started */ } }
    const last = this.srcs[0]
    const nodes = [...this.srcs, ...this.nodes]
    const free = () => { for (const n of nodes) { try { n.disconnect() } catch { /* gone */ } } }
    if (last) last.onended = free
    else free()
    this.srcs = []
    this.nodes = []
  }
}

/** One event's output: gain → (low-pass for distance) → panner → texture out. Freed when its source ends. */
function shot(e: Env, pan: number, lp = 0): { input: GainNode; done(src: AudioScheduledSourceNode, end: number): void } {
  const ac = e.ac
  const input = ac.createGain()
  let node: AudioNode = input
  if (lp > 0) {
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = safeHz(ac, lp)
    f.Q.value = 0.5
    node.connect(f)
    node = f
  }
  const p = ac.createStereoPanner()
  p.pan.value = clamp(pan, -1, 1)
  node.connect(p)
  p.connect(e.out)
  return {
    input,
    done(src, end) {
      src.stop(end)
      src.onended = () => { try { p.disconnect() } catch { /* gone */ } }
    },
  }
}

/** Wander a parameter to a random value in [lo, hi]. */
function wander(p: AudioParam, t: number, lo: number, hi: number, tau: number): void {
  p.setTargetAtTime(rand(lo, hi), t, tau)
}

// ---- pitch helpers ---------------------------------------------------------------------

/** A random MIDI note in [lo, hi] on the current scale. */
function scaleNote(e: Env, lo: number, hi: number): number {
  const sc = e.scale()
  const opts: number[] = []
  for (let m = Math.ceil(lo); m <= hi; m++) if (sc.includes(((m % 12) + 12) % 12)) opts.push(m)
  return opts.length ? pick(opts) : Math.round((lo + hi) / 2)
}

/** Pentatonic pitch classes of the current key: 1 2 3 5 6 on major modes, 1 b3 4 5 b7 on minor ones. */
function pentatonic(e: Env): number[] {
  const { tonic } = e.key()
  const deg = [...new Set(e.scale().map(pc => (((pc - tonic) % 12) + 12) % 12))].sort((a, b) => a - b)
  if (deg.length < 7) return deg.map(d => (d + tonic) % 12)
  const major = deg.includes(4)
  const idx = major ? [0, 1, 2, 4, 5] : [0, 2, 3, 4, 6]
  return idx.map(i => (deg[i]! + tonic) % 12)
}

/** MIDI note of pitch class `pc` in the octave at or above `lo`. */
function inOctave(pc: number, lo: number): number {
  let m = lo - (((lo - pc) % 12) + 12) % 12
  if (m < lo) m += 12
  return m
}

// ---- the textures ------------------------------------------------------------------------

const wind: Factory = e => {
  let bed: Bed
  let sides: Array<{ bp: BiquadFilterNode; g: GainNode }> = []
  const tm: Timer = { next: 0 }
  return {
    start(t) {
      bed = new Bed(e)
      const m = e.ac.createChannelMerger(2)
      bed.nodes.push(m)
      sides = [0, 1].map(ch => {
        const src = bed.loop(e.res.brown, t, rand(0.9, 1.1))
        const bp = bed.filter('bandpass', rand(300, 700), 0.8)
        const g = bed.gain(0.5)
        src.connect(bp)
        bp.connect(g)
        g.connect(m, 0, ch)
        return { bp, g }
      })
      const out = bed.gain(1.1)
      m.connect(out)
      out.connect(e.out)
      tm.next = t
    },
    stop(t) { bed.stop(t) },
    run(from, to) {
      every(tm, from, to, () => rand(1.5, 4), t => {
        const gust = Math.random() < 0.15 ? rand(0.9, 1.3) : rand(0.3, 0.8)
        for (const s of sides) {
          wander(s.bp.frequency, t, 250, 900 * gust, rand(1, 2.5))
          s.g.gain.setTargetAtTime(gust * rand(0.8, 1.1), t + rand(0, 0.5), rand(0.8, 2))
        }
      })
    },
  }
}

const windHigh: Factory = e => {
  let bed: Bed
  let bands: Array<{ bp: BiquadFilterNode; g: GainNode }> = []
  const tm: Timer = { next: 0 }
  return {
    start(t) {
      bed = new Bed(e)
      bands = [-0.5, 0.5].map(p => {
        const src = bed.loop(e.res.pink, t, rand(0.95, 1.05))
        const bp = bed.filter('bandpass', rand(1400, 2600), 9)
        const g = bed.gain(0.4)
        const pn = bed.pan(p)
        src.connect(bp); bp.connect(g); g.connect(pn); pn.connect(e.out)
        return { bp, g }
      })
      tm.next = t
    },
    stop(t) { bed.stop(t) },
    run(from, to) {
      every(tm, from, to, () => rand(1.2, 3.5), t => {
        for (const b of bands) {
          wander(b.bp.frequency, t, 1200, 3200, rand(1, 3))
          wander(b.g.gain, t, 0.2, 1.1, rand(1, 2))
        }
      })
    },
  }
}

// Birds: a few individuals per session, each with its own song, sung with variations.
type Syl = 'chirp' | 'down' | 'trill' | 'warble' | 'teeoo' | 'tik'
interface Bird { f: number; song: Syl[]; pan: number; dist: number; pace: number }

function sing(e: Env, bird: Bird, t: number, level: number): void {
  const ac = e.ac
  const s = shot(e, bird.pan, 9000 - bird.dist * 5000)
  const o = ac.createOscillator()
  o.type = 'sine'
  const g = ac.createGain()
  g.gain.value = 0
  o.connect(g)
  g.connect(s.input)
  const fq = o.frequency
  const peak = (0.5 + 0.5 * (1 - bird.dist)) * (0.6 + 0.4 * level)
  let at = t
  const f = bird.f * rand(0.97, 1.03)
  fq.setValueAtTime(f, at)
  const song = Math.random() < 0.3 ? bird.song.slice(0, Math.max(1, bird.song.length - 2)) : bird.song
  const note = (f0: number, f1: number, len: number, amp = 1) => {
    fq.setValueAtTime(safeHz(ac, f0), at)
    fq.linearRampToValueAtTime(safeHz(ac, f1), at + len)
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(peak * amp, at + Math.min(0.012, len * 0.3))
    g.gain.linearRampToValueAtTime(peak * amp * 0.6, at + len * 0.8)
    g.gain.linearRampToValueAtTime(0, at + len)
    at += len
  }
  for (const syl of song) {
    if (syl === 'chirp') note(f * 0.8, f * 1.3, 0.05)
    else if (syl === 'down') note(f * 1.4, f * 0.9, rand(0.07, 0.11))
    else if (syl === 'tik') note(f * 1.1, f * 1.05, 0.02, 0.7)
    else if (syl === 'teeoo') { note(f * 1.2, f * 1.22, 0.12); note(f * 1.05, f * 0.8, 0.2, 0.8) }
    else if (syl === 'trill') {
      const n = Math.floor(rand(6, 12))
      for (let i = 0; i < n; i++) note(i % 2 ? f * 1.12 : f, i % 2 ? f * 1.1 : f * 1.02, 0.028, 0.8)
    } else if (syl === 'warble') {
      const n = Math.floor(rand(8, 14))
      for (let i = 0; i < n; i++) note(f * (i % 2 ? 1.12 : 0.92), f * (i % 2 ? 0.92 : 1.12), 0.016, 0.9)
    }
    at += rand(0.03, 0.09) * bird.pace
  }
  o.start(t)
  s.done(o, at + 0.05)
}

const birds: Factory = e => {
  const tm: Timer = { next: 0 }
  const shapes: Syl[][] = [
    ['chirp', 'chirp', 'down'], ['trill'], ['teeoo', 'teeoo'], ['tik', 'tik', 'warble', 'down'],
    ['chirp', 'trill', 'chirp'], ['warble'], ['down', 'down', 'down', 'tik'], ['teeoo', 'trill'],
  ]
  let flock: Bird[] = []
  return {
    start(t) {
      tm.next = t + rand(0.2, 1.5)
      flock = Array.from({ length: 4 }, () => ({
        f: rand(2000, 4000), song: pick(shapes), pan: rand(-0.85, 0.85), dist: rand(0.1, 0.9), pace: rand(0.6, 1.6),
      }))
    },
    stop() { /* events only */ },
    run(from, to, level) {
      every(tm, from, to, () => rand(0.7, 3.5) / (0.4 + level), t => {
        const b = pick(flock)
        sing(e, b, t, level)
        // Sometimes a neighbour answers.
        if (Math.random() < 0.25) sing(e, pick(flock), t + rand(0.5, 1.2), level)
        // Once in a while a bird flies off and another arrives.
        if (Math.random() < 0.04) flock[Math.floor(Math.random() * flock.length)] = { f: rand(2000, 4000), song: pick(shapes), pan: rand(-0.85, 0.85), dist: rand(0.1, 0.9), pace: rand(0.6, 1.6) }
      })
    },
  }
}

const birdsJungle: Factory = e => {
  const tm: Timer = { next: 0 }
  const call = (t: number, level: number) => {
    const ac = e.ac
    const kind = pick(['whoop', 'gliss', 'parrot', 'twotone', 'whoop', 'gliss'] as const)
    const far = rand(0.2, 1)
    const s = shot(e, rand(-0.9, 0.9), kind === 'parrot' ? 3200 : 8000 - far * 4000)
    const o = ac.createOscillator()
    const g = ac.createGain()
    g.gain.value = 0
    const peak = (0.35 + 0.45 * (1 - far)) * (0.6 + 0.4 * level)
    let end = t
    if (kind === 'whoop') {
      o.type = 'sine'
      const n = Math.floor(rand(3, 6))
      const base = rand(450, 700)
      let at = t
      for (let i = 0; i < n; i++) {
        const len = 0.34 - i * 0.03
        o.frequency.setValueAtTime(base * (1 + i * 0.06), at)
        o.frequency.exponentialRampToValueAtTime(base * (2 + i * 0.1), at + len)
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(peak, at + len * 0.6)
        g.gain.linearRampToValueAtTime(0, at + len)
        at += len + 0.06
      }
      end = at
      o.connect(g)
    } else if (kind === 'gliss') {
      o.type = 'sine'
      const len = rand(0.8, 1.6)
      const hi = rand(2400, 3400)
      o.frequency.setValueAtTime(hi, t)
      o.frequency.exponentialRampToValueAtTime(hi * rand(0.25, 0.4), t + len)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(peak * 0.8, t + 0.08)
      g.gain.linearRampToValueAtTime(peak * 0.5, t + len * 0.8)
      g.gain.linearRampToValueAtTime(0, t + len)
      end = t + len
      o.connect(g)
    } else if (kind === 'parrot') {
      // Far-off squawks: a buzzy saw with a jagged pitch through a nasal band-pass.
      o.type = 'sawtooth'
      const bp = ac.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1700
      bp.Q.value = 2.5
      let at = t
      const n = Math.floor(rand(1, 4))
      for (let i = 0; i < n; i++) {
        const len = rand(0.15, 0.3)
        const f = rand(650, 950)
        for (let k = 0; k < 6; k++) o.frequency.setValueAtTime(f * (k % 2 ? 1.18 : 0.9), at + (k * len) / 6)
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(peak * 0.7, at + 0.02)
        g.gain.linearRampToValueAtTime(0, at + len)
        at += len + rand(0.1, 0.25)
      }
      end = at
      o.connect(bp)
      bp.connect(g)
    } else {
      // 'koo-kah', repeated.
      o.type = 'triangle'
      const f = rand(700, 1000)
      let at = t
      const n = Math.floor(rand(2, 5))
      for (let i = 0; i < n; i++) {
        for (const [ff, len] of [[f, 0.14], [f * 0.8, 0.2]] as const) {
          o.frequency.setValueAtTime(ff, at)
          g.gain.setValueAtTime(0, at)
          g.gain.linearRampToValueAtTime(peak * 0.7, at + 0.02)
          g.gain.linearRampToValueAtTime(0, at + len)
          at += len + 0.03
        }
        at += rand(0.2, 0.4)
      }
      end = at
      o.connect(g)
    }
    g.connect(s.input)
    o.start(t)
    s.done(o, end + 0.05)
  }
  return {
    start(t) { tm.next = t + rand(0.5, 2) },
    stop() { /* events only */ },
    run(from, to, level) { every(tm, from, to, () => rand(1.2, 5) / (0.4 + level), t => call(t, level)) },
  }
}

const insects: Factory = e => {
  let bed: Bed
  let swell: GainNode
  const tm: Timer = { next: 0 }
  const crickets: Array<{ f: number; pan: number; period: number; tm: Timer }> = []
  return {
    start(t) {
      bed = new Bed(e)
      // Cicadas: band-passed noise, amplitude-pulsed at ~40 Hz, swelling slowly.
      const src = bed.loop(e.res.white, t)
      const bp = bed.filter('bandpass', 4300, 4)
      const bp2 = bed.filter('bandpass', 4600, 6)
      const am = bed.gain(0.5)
      const lfo = bed.osc('triangle', rand(36, 46), t)
      const depth = bed.gain(0.5)
      lfo.connect(depth)
      depth.connect(am.gain)
      swell = bed.gain(0.5)
      src.connect(bp); bp.connect(bp2); bp2.connect(am); am.connect(swell)
      const out = bed.gain(1.4)
      swell.connect(out)
      out.connect(e.out)
      tm.next = t
      crickets.length = 0
      for (let i = 0; i < 2; i++) crickets.push({ f: rand(3700, 4400), pan: rand(-0.8, 0.8), period: rand(0.55, 0.9), tm: { next: t + rand(0, 1) } })
    },
    stop(t) { bed.stop(t) },
    run(from, to, level) {
      every(tm, from, to, () => rand(2, 6), t => wander(swell.gain, t, 0.15, 1, rand(1.5, 4)))
      for (const c of crickets) {
        every(c.tm, from, to, () => c.period * rand(0.95, 1.05) * (Math.random() < 0.1 ? 3 : 1), t => {
          const s = shot(e, c.pan)
          const o = e.ac.createOscillator()
          o.frequency.value = c.f
          const g = e.ac.createGain()
          g.gain.value = 0
          const peak = 0.12 * (0.6 + 0.4 * level)
          for (let k = 0; k < 3; k++) {
            const at = t + k * 0.032
            g.gain.setValueAtTime(0, at)
            g.gain.linearRampToValueAtTime(peak, at + 0.004)
            g.gain.linearRampToValueAtTime(0, at + 0.018)
          }
          o.connect(g)
          g.connect(s.input)
          o.start(t)
          s.done(o, t + 0.12)
        })
      }
    },
  }
}

/** A short water drop: a tick of band-passed noise, or a small pitched plink. */
function drop(e: Env, t: number, lvl: number, lo: number, hi: number, pan: number, plink: boolean): void {
  const ac = e.ac
  const s = shot(e, pan)
  const g = ac.createGain()
  g.connect(s.input)
  if (plink) {
    const o = ac.createOscillator()
    const f = rand(lo, hi)
    o.frequency.setValueAtTime(f * 1.25, t)
    o.frequency.exponentialRampToValueAtTime(f, t + 0.02)
    g.gain.setValueAtTime(lvl, t)
    g.gain.setTargetAtTime(0, t + 0.002, 0.02)
    o.connect(g)
    o.start(t)
    s.done(o, t + 0.16)
  } else {
    const n = ac.createBufferSource()
    n.buffer = e.res.white
    const bp = ac.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = rand(lo, hi)
    bp.Q.value = 3
    g.gain.setValueAtTime(lvl * 2.5, t)
    g.gain.setTargetAtTime(0, t + 0.001, 0.004)
    n.connect(bp)
    bp.connect(g)
    n.start(t, Math.random() * 3)
    s.done(n, t + 0.05)
  }
}

const rain: Factory = e => {
  let bed: Bed
  let body: GainNode
  const tm: Timer = { next: 0 }
  const mod: Timer = { next: 0 }
  return {
    start(t) {
      bed = new Bed(e)
      const m = e.ac.createChannelMerger(2)
      bed.nodes.push(m)
      for (const ch of [0, 1]) {
        const src = bed.loop(e.res.pink, t, rand(0.97, 1.03))
        const hp = bed.filter('highpass', 500, 0.6)
        const lp = bed.filter('lowpass', 6500, 0.5)
        src.connect(hp); hp.connect(lp); lp.connect(m, 0, ch)
      }
      body = bed.gain(0.4)
      m.connect(body)
      body.connect(e.out)
      tm.next = t
      mod.next = t
    },
    stop(t) { bed.stop(t) },
    run(from, to, level) {
      every(mod, from, to, () => rand(3, 8), t => wander(body.gain, t, 0.3, 0.5, 3))
      every(tm, from, to, () => rand(0.05, 0.3) / (0.4 + level), t =>
        drop(e, t, rand(0.05, 0.2), 2200, 6500, rand(-0.9, 0.9), Math.random() < 0.15))
    },
  }
}

const rainRoof: Factory = e => {
  let bed: Bed
  const tm: Timer = { next: 0 }
  const drip: Timer = { next: 0 }
  const period = rand(1.1, 1.8)
  const dripPan = rand(-0.6, 0.6)
  return {
    start(t) {
      bed = new Bed(e)
      const m = e.ac.createChannelMerger(2)
      bed.nodes.push(m)
      for (const ch of [0, 1]) {
        const src = bed.loop(e.res.pink, t, rand(0.9, 1.0))
        const lp = bed.filter('lowpass', 2200, 0.5)
        const hp = bed.filter('highpass', 150, 0.5)
        src.connect(hp); hp.connect(lp); lp.connect(m, 0, ch)
      }
      const drum = bed.loop(e.res.brown, t)
      const bp = bed.filter('bandpass', 380, 0.9)
      const dg = bed.gain(0.4)
      drum.connect(bp); bp.connect(dg); dg.connect(e.out)
      const out = bed.gain(0.55)
      m.connect(out)
      out.connect(e.out)
      tm.next = t
      drip.next = t + rand(0.3, 1)
    },
    stop(t) { bed.stop(t) },
    run(from, to, level) {
      every(tm, from, to, () => rand(0.03, 0.14) / (0.4 + level), t =>
        drop(e, t, rand(0.05, 0.15), 700, 1900, rand(-0.9, 0.9), false))
      every(drip, from, to, () => period * rand(0.9, 1.12) * (Math.random() < 0.08 ? 2 : 1), t =>
        drop(e, t, rand(0.25, 0.4), 380, 560, dripPan, true))
    },
  }
}

const stream: Factory = e => {
  let bed: Bed
  const tm: Timer = { next: 0 }
  const deep: Timer = { next: 0 }
  return {
    start(t) {
      bed = new Bed(e)
      const src = bed.loop(e.res.pink, t)
      const lp = bed.filter('lowpass', 1300, 0.5)
      const hp = bed.filter('highpass', 180, 0.5)
      const g = bed.gain(0.3)
      src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(e.out)
      tm.next = t
      deep.next = t + rand(1, 3)
    },
    stop(t) { bed.stop(t) },
    run(from, to, level) {
      // Babble: small bubbles rising in pitch.
      every(tm, from, to, () => rand(0.04, 0.2) / (0.4 + level), t => {
        const ac = e.ac
        const s = shot(e, rand(-0.7, 0.7))
        const o = ac.createOscillator()
        const f = rand(350, 1300)
        const len = rand(0.025, 0.07)
        o.frequency.setValueAtTime(f, t)
        o.frequency.exponentialRampToValueAtTime(f * rand(1.4, 2), t + len)
        const g = ac.createGain()
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(rand(0.05, 0.14), t + 0.004)
        g.gain.setTargetAtTime(0, t + len * 0.5, len * 0.4)
        o.connect(g)
        g.connect(s.input)
        o.start(t)
        s.done(o, t + len * 3)
      })
      // Now and then a clear drip (caverns).
      every(deep, from, to, () => rand(1.5, 5), t => drop(e, t, rand(0.18, 0.3), 600, 1100, rand(-0.6, 0.6), true))
    },
  }
}

const waves: Factory = e => {
  let bed: Bed
  const gens: Array<{ lp: BiquadFilterNode; g: GainNode; tm: Timer }> = []
  return {
    start(t) {
      bed = new Bed(e)
      gens.length = 0
      for (const p of [-0.45, 0.45]) {
        const src = bed.loop(e.res.brown, t, rand(0.95, 1.05))
        const lp = bed.filter('lowpass', 400, 0.6)
        const g = bed.gain(0.1)
        const pn = bed.pan(p)
        src.connect(lp); lp.connect(g); g.connect(pn); pn.connect(e.out)
        gens.push({ lp, g, tm: { next: t + rand(0, 4) } })
      }
      // Steady far surf underneath.
      const src = bed.loop(e.res.pink, t)
      const lp = bed.filter('lowpass', 700, 0.5)
      const g = bed.gain(0.12)
      src.connect(lp); lp.connect(g); g.connect(e.out)
    },
    stop(t) { bed.stop(t) },
    run(from, to) {
      for (const w of gens) {
        every(w.tm, from, to, () => rand(7, 11), t => {
          // Swell: level and brightness rise together, then the wash falls away.
          const rise = rand(2.2, 3.4)
          const peak = rand(0.55, 1)
          w.g.gain.setTargetAtTime(peak, t, rise / 3)
          w.lp.frequency.setTargetAtTime(rand(1600, 2600), t, rise / 3)
          w.g.gain.setTargetAtTime(0.08, t + rise + 0.3, rand(1.4, 2.2))
          w.lp.frequency.setTargetAtTime(380, t + rise + 0.3, 2)
        })
      }
    },
  }
}

const gulls: Factory = e => {
  const tm: Timer = { next: 0 }
  return {
    start(t) { tm.next = t + rand(1, 5) },
    stop() { /* events only */ },
    run(from, to, level) {
      every(tm, from, to, () => rand(6, 18), t => {
        const ac = e.ac
        const far = rand(0.3, 1)
        const s = shot(e, rand(-0.9, 0.9), 4200 - far * 1500)
        const o = ac.createOscillator()
        o.type = 'sawtooth'
        const bp = ac.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = 1500
        bp.Q.value = 1.6
        const g = ac.createGain()
        g.gain.value = 0
        o.connect(bp); bp.connect(g); g.connect(s.input)
        const p = hz(scaleNote(e, 74, 84))
        const peak = 0.35 * (1.2 - far) * (0.6 + 0.4 * level)
        let at = t
        const laugh = Math.random() < 0.3
        const n = Math.floor(rand(2, laugh ? 6 : 4))
        for (let i = 0; i < n; i++) {
          const len = laugh ? 0.11 : rand(0.26, 0.4)
          o.frequency.setValueAtTime(p * 0.82, at)
          o.frequency.linearRampToValueAtTime(p, at + len * 0.25)
          o.frequency.linearRampToValueAtTime(p * 0.68, at + len)
          g.gain.setValueAtTime(0, at)
          g.gain.linearRampToValueAtTime(peak, at + len * 0.2)
          g.gain.linearRampToValueAtTime(peak * 0.5, at + len * 0.7)
          g.gain.linearRampToValueAtTime(0, at + len)
          at += len + (laugh ? 0.04 : rand(0.12, 0.3))
        }
        o.start(t)
        s.done(o, at + 0.05)
      })
    },
  }
}

const owl: Factory = e => {
  const tm: Timer = { next: 0 }
  return {
    start(t) { tm.next = t + rand(3, 10) },
    stop() { /* events only */ },
    run(from, to, level) {
      every(tm, from, to, () => rand(14, 35), t => {
        const ac = e.ac
        const s = shot(e, rand(-0.7, 0.7), 1400)
        const p = hz(scaleNote(e, 63, 69))
        const o = ac.createOscillator()
        const g = ac.createGain()
        g.gain.value = 0
        const peak = 0.4 * (0.6 + 0.4 * level)
        // Hoo ... hoo-ooo: a short note, then a longer one a step lower that sags at the end.
        const notes: Array<[number, number, number]> = [[0, 0.32, p], [0.62, 0.62, p * 0.94]]
        for (const [off, len, f] of notes) {
          const at = t + off
          o.frequency.setValueAtTime(f * 0.97, at)
          o.frequency.linearRampToValueAtTime(f, at + 0.06)
          o.frequency.linearRampToValueAtTime(f * 0.95, at + len)
          g.gain.setValueAtTime(0, at)
          g.gain.linearRampToValueAtTime(peak, at + 0.07)
          g.gain.linearRampToValueAtTime(peak * 0.7, at + len * 0.8)
          g.gain.linearRampToValueAtTime(0, at + len)
        }
        o.connect(g)
        g.connect(s.input)
        // A little breath on the hoot.
        const n = ac.createBufferSource()
        n.buffer = e.res.pink
        const bp = ac.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = p * 2
        bp.Q.value = 3
        const ng = ac.createGain()
        ng.gain.value = 0.25
        n.connect(bp); bp.connect(ng); ng.connect(g)
        n.start(t, Math.random() * 2)
        n.stop(t + 1.4)
        o.start(t)
        s.done(o, t + 1.4)
      })
    },
  }
}

const snow: Factory = e => {
  let bed: Bed
  let air: GainNode
  const mod: Timer = { next: 0 }
  const creak: Timer = { next: 0 }
  return {
    start(t) {
      bed = new Bed(e)
      const src = bed.loop(e.res.pink, t)
      const lp = bed.filter('lowpass', 900, 0.5)
      air = bed.gain(0.25)
      src.connect(lp); lp.connect(air); air.connect(e.out)
      const hi = bed.loop(e.res.white, t)
      const bp = bed.filter('bandpass', 6500, 0.7)
      const hg = bed.gain(0.015)
      hi.connect(bp); bp.connect(hg); hg.connect(e.out)
      mod.next = t
      creak.next = t + rand(4, 12)
    },
    stop(t) { bed.stop(t) },
    run(from, to, level) {
      every(mod, from, to, () => rand(3, 7), t => wander(air.gain, t, 0.1, 0.3, 2.5))
      every(creak, from, to, () => rand(8, 25), t => {
        const ac = e.ac
        if (Math.random() < 0.35) {
          // Snow sliding off a branch: a soft puff.
          const s = shot(e, rand(-0.8, 0.8), 1600)
          const n = ac.createBufferSource()
          n.buffer = e.res.pink
          const g = ac.createGain()
          g.gain.setValueAtTime(0, t)
          g.gain.linearRampToValueAtTime(0.25 * (0.6 + 0.4 * level), t + 0.15)
          g.gain.setTargetAtTime(0, t + 0.2, 0.25)
          n.connect(g); g.connect(s.input)
          n.start(t, Math.random() * 3)
          s.done(n, t + 2)
          return
        }
        // Creak: stick-slip pulses of a low saw through a woody band-pass.
        const s = shot(e, rand(-0.8, 0.8))
        const o = ac.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = rand(70, 150)
        const bp = ac.createBiquadFilter()
        bp.type = 'bandpass'
        bp.frequency.value = rand(700, 1100)
        bp.Q.value = 3
        const g = ac.createGain()
        g.gain.value = 0
        const len = rand(0.2, 0.5)
        let at = t
        const peak = 0.2 * (0.6 + 0.4 * level)
        while (at < t + len) {
          g.gain.setValueAtTime(peak * rand(0.4, 1), at)
          g.gain.setTargetAtTime(0, at + 0.001, 0.004)
          at += rand(0.01, 0.035)
        }
        o.connect(bp); bp.connect(g); g.connect(s.input)
        o.start(t)
        s.done(o, t + len + 0.05)
      })
    },
  }
}

/** A buffer of crackles: clustered clicks of random size, occasionally a loud pop. */
function crackleBuffer(ac: BaseAudioContext, seconds: number): AudioBuffer {
  const sr = ac.sampleRate
  const b = ac.createBuffer(1, Math.floor(sr * seconds), sr)
  const d = b.getChannelData(0)
  let t = 0
  while (t < seconds - 0.01) {
    const burst = Math.random() < 0.3 ? Math.floor(rand(3, 9)) : 1
    for (let k = 0; k < burst; k++) {
      const start = Math.floor((t + k * rand(0.004, 0.02)) * sr)
      const len = Math.floor(sr * rand(0.0005, 0.004))
      const amp = Math.min(1, 0.12 / Math.pow(Math.random() + 0.02, 0.8))
      for (let i = 0; i < len && start + i < d.length; i++) d[start + i]! += (Math.random() * 2 - 1) * amp * Math.exp((-4 * i) / len)
    }
    t += rand(0.02, 0.35)
  }
  let m = 0
  for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]!))
  if (m > 0) for (let i = 0; i < d.length; i++) d[i] = (d[i]! / m) * 0.9
  return b
}

const fire: Factory = e => {
  let bed: Bed
  let roar: GainNode
  const mod: Timer = { next: 0 }
  return {
    start(t) {
      bed = new Bed(e)
      const src = bed.loop(e.res.brown, t)
      const lp = bed.filter('lowpass', 320, 0.6)
      roar = bed.gain(0.5)
      src.connect(lp); lp.connect(roar); roar.connect(e.out)
      const hiss = bed.loop(e.res.pink, t)
      const bp = bed.filter('bandpass', 1500, 0.5)
      const hg = bed.gain(0.05)
      hiss.connect(bp); bp.connect(hg); hg.connect(e.out)
      for (const [secs, p] of [[7.3, -0.4], [5.1, 0.4]] as const) {
        const cr = bed.loop(crackleBuffer(e.ac, secs), t, rand(0.9, 1.1))
        const hp = bed.filter('highpass', 900, 0.6)
        const lp2 = bed.filter('lowpass', 7000, 0.5)
        const g = bed.gain(0.3)
        const pn = bed.pan(p)
        cr.connect(hp); hp.connect(lp2); lp2.connect(g); g.connect(pn); pn.connect(e.out)
      }
      mod.next = t
    },
    stop(t) { bed.stop(t) },
    run(from, to) {
      every(mod, from, to, () => rand(0.6, 2), t => wander(roar.gain, t, 0.3, 0.7, rand(0.4, 1)))
    },
  }
}

const chimes: Factory = e => {
  const tm: Timer = { next: 0 }
  return {
    start(t) { tm.next = t + rand(1, 4) },
    stop() { /* events only */ },
    run(from, to, level) {
      every(tm, from, to, () => rand(3, 10), t => {
        const pcs = pentatonic(e)
        const n = Math.floor(rand(2, 7))
        let at = t
        for (let i = 0; i < n; i++) {
          const k = Math.floor(Math.random() * pcs.length)
          const midi = inOctave(pcs[k]!, 84)
          // Each tube hangs in its own place.
          const pan = -0.7 + (1.4 * k) / Math.max(1, pcs.length - 1)
          const ac = e.ac
          const s = shot(e, pan)
          const f = hz(midi)
          const amp = rand(0.08, 0.2) * (0.6 + 0.4 * level)
          const g = ac.createGain()
          g.gain.setValueAtTime(amp, at)
          g.gain.setTargetAtTime(0, at + 0.002, rand(0.9, 1.6))
          const o = ac.createOscillator()
          o.frequency.value = f
          const o2 = ac.createOscillator()
          o2.frequency.value = f * 2.76
          const g2 = ac.createGain()
          g2.gain.setValueAtTime(0.25, at)
          g2.gain.setTargetAtTime(0, at + 0.002, 0.2)
          o.connect(g); o2.connect(g2); g2.connect(g); g.connect(s.input)
          o.start(at); o2.start(at)
          o2.stop(at + 2)
          s.done(o, at + 11)
          at += rand(0.08, 0.5)
        }
      })
    },
  }
}

const bellDistant: Factory = e => {
  const tm: Timer = { next: 0 }
  return {
    start(t) { tm.next = t + rand(4, 15) },
    stop() { /* events only */ },
    run(from, to, level) {
      every(tm, from, to, () => rand(25, 70), t => {
        const ac = e.ac
        const f = hz(inOctave(e.key().tonic, 50))
        const strikes = Math.floor(rand(1, 4))
        const pan = rand(-0.5, 0.5)
        for (let k = 0; k < strikes; k++) {
          const at = t + k * rand(2.2, 2.8)
          const s = shot(e, pan, 1600)
          const sum = ac.createGain()
          sum.gain.value = 0.3 * (0.6 + 0.4 * level)
          sum.connect(s.input)
          // Church bell partials: hum, prime, minor-third tierce, quint, nominal.
          const parts: Array<[number, number, number]> = [[0.5, 0.6, 3], [1, 1, 2.4], [1.19, 0.45, 1.6], [1.5, 0.3, 1.1], [2, 0.35, 0.9]]
          let first: OscillatorNode | null = null
          for (const [r, a, tau] of parts) {
            const o = ac.createOscillator()
            o.frequency.value = f * r
            const g = ac.createGain()
            g.gain.setValueAtTime(0, at)
            g.gain.linearRampToValueAtTime(a, at + 0.004)
            g.gain.setTargetAtTime(0, at + 0.004, tau)
            o.connect(g); g.connect(sum)
            o.start(at)
            if (!first) first = o
            else o.stop(at + tau * 7)
          }
          if (first) s.done(first, at + 21)
        }
      })
    },
  }
}

const road: Factory = e => {
  let bed: Bed
  let engine: OscillatorNode
  let engine2: OscillatorNode
  let tyres: GainNode
  const mod: Timer = { next: 0 }
  const seam: Timer = { next: 0 }
  let base = 46
  return {
    start(t) {
      bed = new Bed(e)
      base = rand(42, 52)
      engine = bed.osc('sawtooth', base, t)
      engine2 = bed.osc('sine', base * 2, t)
      const lp = bed.filter('lowpass', 170, 1)
      const eg = bed.gain(0.35)
      const e2g = bed.gain(0.15)
      engine.connect(lp); lp.connect(eg); eg.connect(e.out)
      engine2.connect(e2g); e2g.connect(e.out)
      const m = e.ac.createChannelMerger(2)
      bed.nodes.push(m)
      for (const ch of [0, 1]) {
        const src = bed.loop(e.res.brown, t, rand(0.95, 1.05))
        const tl = bed.filter('lowpass', 650, 0.5)
        src.connect(tl); tl.connect(m, 0, ch)
      }
      tyres = bed.gain(0.6)
      m.connect(tyres)
      tyres.connect(e.out)
      // Wind on the windscreen.
      const w = bed.loop(e.res.pink, t)
      const wb = bed.filter('bandpass', 1100, 0.6)
      const wg = bed.gain(0.04)
      w.connect(wb); wb.connect(wg); wg.connect(e.out)
      mod.next = t
      seam.next = t + rand(3, 8)
    },
    stop(t) { bed.stop(t) },
    run(from, to, level) {
      every(mod, from, to, () => rand(2, 5), t => {
        const f = base * rand(0.96, 1.04)
        engine.frequency.setTargetAtTime(f, t, 2.5)
        engine2.frequency.setTargetAtTime(f * 2, t, 2.5)
        wander(tyres.gain, t, 0.5, 0.7, 2)
      })
      // Road seams: two soft thumps as the wheels cross.
      every(seam, from, to, () => rand(4, 12), t => {
        for (const off of [0, 0.11]) {
          const s = shot(e, 0)
          const o = e.ac.createOscillator()
          o.frequency.setValueAtTime(70, t + off)
          o.frequency.exponentialRampToValueAtTime(45, t + off + 0.06)
          const g = e.ac.createGain()
          g.gain.setValueAtTime(0.25 * (0.6 + 0.4 * level), t + off)
          g.gain.setTargetAtTime(0, t + off + 0.002, 0.03)
          o.connect(g); g.connect(s.input)
          o.start(t + off)
          s.done(o, t + off + 0.25)
        }
      })
    },
  }
}

const passing: Factory = e => {
  const tm: Timer = { next: 0 }
  return {
    start(t) { tm.next = t + rand(1, 5) },
    stop() { /* events only */ },
    run(from, to, level) {
      every(tm, from, to, () => rand(5, 15), t => {
        const ac = e.ac
        const len = rand(2, 3.4)
        const mid = t + len * rand(0.5, 0.6)
        const dir = Math.random() < 0.5 ? -1 : 1
        const pan = ac.createStereoPanner()
        pan.pan.setValueAtTime(-0.9 * dir, t)
        pan.pan.linearRampToValueAtTime(0.9 * dir, t + len)
        pan.connect(e.out)
        const g = ac.createGain()
        const peak = rand(0.35, 0.6) * (0.6 + 0.4 * level)
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(peak, mid)
        g.gain.exponentialRampToValueAtTime(0.0001, t + len)
        g.connect(pan)
        // Tyre/air whoosh: its band falls as the car passes (doppler).
        const n = ac.createBufferSource()
        n.buffer = e.res.pink
        n.loop = true
        const bp = ac.createBiquadFilter()
        bp.type = 'bandpass'
        bp.Q.value = 0.9
        bp.frequency.setValueAtTime(2200, t)
        bp.frequency.setTargetAtTime(700, mid - 0.1, 0.25)
        n.connect(bp); bp.connect(g)
        // Engine note, dropping in pitch at the pass.
        const o = ac.createOscillator()
        o.type = 'sawtooth'
        const f = rand(90, 140)
        o.frequency.setValueAtTime(f * 1.07, t)
        o.frequency.setTargetAtTime(f * 0.92, mid - 0.1, 0.2)
        const lp = ac.createBiquadFilter()
        lp.frequency.value = 380
        const og = ac.createGain()
        og.gain.value = 0.35
        o.connect(lp); lp.connect(og); og.connect(g)
        n.start(t, Math.random() * 3)
        n.stop(t + len + 0.05)
        o.start(t)
        o.stop(t + len + 0.05)
        o.onended = () => { try { pan.disconnect() } catch { /* gone */ } }
      })
    },
  }
}

const city: Factory = e => {
  let bed: Bed
  let hum: GainNode
  const mod: Timer = { next: 0 }
  const horn: Timer = { next: 0 }
  return {
    start(t) {
      bed = new Bed(e)
      const m = e.ac.createChannelMerger(2)
      bed.nodes.push(m)
      for (const ch of [0, 1]) {
        const src = bed.loop(e.res.brown, t, rand(0.95, 1.05))
        const lp = bed.filter('lowpass', 320, 0.5)
        src.connect(lp); lp.connect(m, 0, ch)
      }
      hum = bed.gain(0.5)
      m.connect(hum)
      hum.connect(e.out)
      const tr = bed.loop(e.res.pink, t)
      const bp = bed.filter('bandpass', 800, 0.5)
      const tg = bed.gain(0.06)
      tr.connect(bp); bp.connect(tg); tg.connect(e.out)
      mod.next = t
      horn.next = t + rand(5, 15)
    },
    stop(t) { bed.stop(t) },
    run(from, to, level) {
      every(mod, from, to, () => rand(3, 8), t => wander(hum.gain, t, 0.35, 0.65, 3))
      every(horn, from, to, () => rand(12, 40), t => {
        const ac = e.ac
        const s = shot(e, rand(-0.9, 0.9), 1300)
        const g = ac.createGain()
        g.gain.value = 0
        g.connect(s.input)
        const f = rand(330, 440)
        const beeps = Math.random() < 0.35 ? 2 : 1
        let at = t
        for (let i = 0; i < beeps; i++) {
          const len = rand(0.15, 0.5)
          g.gain.setValueAtTime(0, at)
          g.gain.linearRampToValueAtTime(0.08 * (0.6 + 0.4 * level), at + 0.02)
          g.gain.setValueAtTime(0.08 * (0.6 + 0.4 * level), at + len - 0.03)
          g.gain.linearRampToValueAtTime(0, at + len)
          at += len + 0.12
        }
        let first: OscillatorNode | null = null
        for (const r of [1, 1.26]) {
          const o = ac.createOscillator()
          o.type = 'square'
          o.frequency.value = f * r
          o.connect(g)
          o.start(t)
          if (!first) first = o
          else o.stop(at)
        }
        if (first) s.done(first, at + 0.05)
      })
    },
  }
}

const radio: Factory = e => {
  let bed: Bed
  let carrier: GainNode
  const tm: Timer = { next: 0 }
  const mod: Timer = { next: 0 }
  return {
    start(t) {
      bed = new Bed(e)
      const src = bed.loop(e.res.white, t)
      const bp = bed.filter('bandpass', 2500, 1.2)
      carrier = bed.gain(0.02)
      src.connect(bp); bp.connect(carrier); carrier.connect(e.out)
      tm.next = t + rand(0.5, 2)
      mod.next = t
    },
    stop(t) { bed.stop(t) },
    run(from, to, level) {
      every(mod, from, to, () => rand(2, 6), t => wander(carrier.gain, t, 0.005, 0.03, 1.5))
      every(tm, from, to, () => rand(1.5, 5), t => {
        const ac = e.ac
        const kind = Math.random()
        const s = shot(e, rand(-0.8, 0.8), 5000)
        const g = ac.createGain()
        g.gain.value = 0
        g.connect(s.input)
        const amp = 0.12 * (0.6 + 0.4 * level)
        if (kind < 0.6) {
          // Blips: a few beeps on scale tones, like a far telemetry line.
          const o = ac.createOscillator()
          o.type = Math.random() < 0.5 ? 'sine' : 'triangle'
          let at = t
          const n = Math.floor(rand(2, 7))
          const len = rand(0.04, 0.11)
          for (let i = 0; i < n; i++) {
            o.frequency.setValueAtTime(hz(scaleNote(e, 81, 96)), at)
            g.gain.setValueAtTime(0, at)
            g.gain.linearRampToValueAtTime(amp, at + 0.003)
            g.gain.setValueAtTime(amp, at + len - 0.003)
            g.gain.linearRampToValueAtTime(0, at + len)
            at += len + rand(0.05, 0.15)
          }
          o.connect(g)
          o.start(t)
          s.done(o, at + 0.05)
        } else if (kind < 0.85) {
          // A burst of static, flickering.
          const n = ac.createBufferSource()
          n.buffer = e.res.white
          const bp = ac.createBiquadFilter()
          bp.type = 'bandpass'
          bp.frequency.value = rand(1200, 2600)
          bp.Q.value = 0.8
          const len = rand(0.2, 0.7)
          for (let at = t; at < t + len; at += rand(0.01, 0.025)) g.gain.setValueAtTime(amp * rand(0, 0.9), at)
          g.gain.setValueAtTime(0, t + len)
          n.connect(bp); bp.connect(g)
          n.start(t, Math.random() * 3)
          s.done(n, t + len + 0.05)
        } else {
          // A tuning sweep.
          const o = ac.createOscillator()
          const len = rand(0.6, 1.2)
          o.frequency.setValueAtTime(rand(300, 600), t)
          o.frequency.exponentialRampToValueAtTime(rand(1800, 2600), t + len)
          g.gain.setValueAtTime(0, t)
          g.gain.linearRampToValueAtTime(amp * 0.6, t + 0.1)
          g.gain.linearRampToValueAtTime(0, t + len)
          o.connect(g)
          o.start(t)
          s.done(o, t + len + 0.05)
        }
      })
    },
  }
}

const spaceHum: Factory = e => {
  let bed: Bed
  let oscs: Array<{ o: OscillatorNode; ratio: number; off: number }> = []
  let rumble: GainNode
  let tonic = -1
  const mod: Timer = { next: 0 }
  const root = () => hz(inOctave(e.key().tonic, 28))
  return {
    start(t) {
      bed = new Bed(e)
      tonic = e.key().tonic
      const f = root()
      const lp = bed.filter('lowpass', 160, 0.5)
      const g = bed.gain(0.5)
      oscs = ([[1, 0, 1], [1, 0.27, 0.8], [1.5, 0.11, 0.35], [2, 0.19, 0.2]] as const).map(([ratio, off, lvl]) => {
        const o = bed.osc('sine', f * ratio + off, t)
        const og = bed.gain(lvl)
        o.connect(og); og.connect(lp)
        return { o, ratio, off }
      })
      lp.connect(g); g.connect(e.out)
      const src = bed.loop(e.res.brown, t, 0.7)
      const rl = bed.filter('lowpass', 110, 0.6)
      rumble = bed.gain(0.5)
      src.connect(rl); rl.connect(rumble); rumble.connect(e.out)
      mod.next = t
    },
    stop(t) { bed.stop(t) },
    run(from, to) {
      every(mod, from, to, () => rand(3, 7), t => {
        wander(rumble.gain, t, 0.25, 0.7, 2.5)
        if (e.key().tonic !== tonic) {
          tonic = e.key().tonic
          const f = root()
          for (const x of oscs) x.o.frequency.setTargetAtTime(f * x.ratio + x.off, t, 2)
        }
      })
    },
  }
}

const shimmer: Factory = e => {
  const tm: Timer = { next: 0 }
  return {
    start(t) { tm.next = t + rand(0.3, 1.5) },
    stop() { /* events only */ },
    run(from, to, level) {
      every(tm, from, to, () => rand(0.4, 1.6) / (0.5 + level), t => {
        const ac = e.ac
        const run = Math.random() < 0.15 ? 3 : 1
        for (let i = 0; i < run; i++) {
          const at = t + i * 0.09
          const s = shot(e, rand(-0.9, 0.9))
          const o = ac.createOscillator()
          o.frequency.value = hz(scaleNote(e, 86, 100))
          const g = ac.createGain()
          const amp = rand(0.04, 0.1) * (0.6 + 0.4 * level)
          g.gain.setValueAtTime(0, at)
          g.gain.linearRampToValueAtTime(amp, at + 0.015)
          g.gain.setTargetAtTime(0, at + 0.02, rand(0.3, 0.7))
          o.connect(g); g.connect(s.input)
          o.start(at)
          s.done(o, at + 5)
        }
      })
    },
  }
}

const FACTORIES: Record<AmbienceId, Factory> = {
  wind, 'wind.high': windHigh, birds, 'birds.jungle': birdsJungle, insects, rain, 'rain.roof': rainRoof,
  stream, waves, gulls, owl, snow, fire, chimes, 'bell.distant': bellDistant, road, passing, city, radio,
  'space.hum': spaceHum, shimmer,
}

/** Per-texture loudness at level 1 (linear), calibrated with the harness. */
const TRIM: Record<AmbienceId, number> = {
  wind: 0.706, 'wind.high': 0.599, birds: 0.0622, 'birds.jungle': 0.111, insects: 0.25, rain: 0.281, 'rain.roof': 0.237,
  stream: 0.401, waves: 0.45, gulls: 1.13, owl: 0.199, snow: 0.477, fire: 0.379, chimes: 0.315, 'bell.distant': 0.199,
  road: 0.177, passing: 0.67, city: 0.315, radio: 0.617, 'space.hum': 0.05, shimmer: 0.5,
}

export const AMBIENCE_IDS = Object.keys(FACTORIES) as AmbienceId[]

// ---- the ambience engine -------------------------------------------------------------------

export interface Ambience {
  /** A bar is being scheduled: take its targets, key and scale; ramp each texture's level over the bar. */
  bar(plan: BarPlan, t0: number, t1: number): void
  /** Schedule events and modulation up to `to` (audio time). */
  run(to: number): void
  /** The loudest texture level at time `t`, 0..1 (for the display). */
  level(t: number): number
}

interface Slot {
  fade: Fade
  gain: GainNode
  tx: Tx | null
  /** Level at the end of the last scheduled bar. */
  last: number
  /** For the display: [t0, v0, t1, v1] of the last ramp. */
  ramp: [number, number, number, number]
}

export function createAmbience(v: VoiceCtx): Ambience {
  const ac = v.ac
  let key: Key = { tonic: 0, mode: 'ionian' }
  let scale: number[] = [0, 2, 4, 5, 7, 9, 11]
  const slots = new Map<AmbienceId, Slot>()
  let ranTo = 0

  const envFor = (out: GainNode): Env => ({ ac, res: v.res, out, key: () => key, scale: () => scale })

  function slot(id: AmbienceId): Slot {
    let s = slots.get(id)
    if (!s) {
      const gain = ac.createGain()
      gain.gain.value = 0
      gain.connect(v.out.input)
      s = { fade: { from: 0, to: 0, start: 0, bars: 0 }, gain, tx: null, last: 0, ramp: [0, 0, 0, 0] }
      slots.set(id, s)
    }
    return s
  }

  function bar(plan: BarPlan, t0: number, t1: number): void {
    if (plan.key) key = plan.key
    if (plan.scale?.length) scale = plan.scale
    const idx = plan.index
    const bars = Math.max(0, plan.ambienceFadeBars ?? 4)
    const ids = new Set<AmbienceId>([...slots.keys(), ...(Object.keys(plan.ambience ?? {}) as AmbienceId[])])
    for (const id of ids) {
      if (!FACTORIES[id]) continue
      const target = clamp(plan.ambience?.[id] ?? 0, 0, 1)
      const s = slot(id)
      if (target !== s.fade.to) s.fade = { from: fadeAtBarStart(s.fade, idx), to: target, start: idx, bars }
      const v0 = fadeAtBarStart(s.fade, idx)
      const v1 = fadeAtBarEnd(s.fade, idx)
      const trim = TRIM[id]
      if (v0 <= 0 && v1 <= 0) {
        if (s.tx && s.last <= 0) {
          s.tx.stop(t0)
          s.tx = null
        }
        s.last = 0
        s.ramp = [t0, 0, t1, 0]
        continue
      }
      if (!s.tx) {
        s.tx = FACTORIES[id](envFor(s.gain))
        s.gain.gain.setValueAtTime(0, t0)
        s.tx.start(t0)
      }
      if (s.fade.bars <= 0 && idx === s.fade.start) s.gain.gain.linearRampToValueAtTime(v1 * trim, Math.min(t1, t0 + 0.05))
      s.gain.gain.linearRampToValueAtTime(v1 * trim, t1)
      s.last = v1
      s.ramp = [t0, v0, t1, v1]
    }
  }

  function run(to: number): void {
    const from = ranTo
    for (const s of slots.values()) {
      if (s.tx && s.last > 0.001) s.tx.run(from, to, s.last)
    }
    ranTo = to
  }

  function level(t: number): number {
    let m = 0
    for (const s of slots.values()) {
      const [t0, v0, t1, v1] = s.ramp
      const x = t >= t1 ? v1 : t <= t0 ? v0 : v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
      if (x > m) m = x
    }
    return m
  }

  return { bar, run, level }
}
