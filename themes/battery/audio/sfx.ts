/**
 * Night of the Dead Battery — the sound effects. One recipe per name in
 * content/sfx.ts, all synthesised: oscillators, filtered noise, a few
 * resonances. Each recipe gets an Fx: a start time, a dry and a reverb
 * output, and two builders (tone, nz) that cover most sounds in one line.
 */
import * as K from './kit'
import type { Kit, WaveName } from './kit'

export interface ToneOpts {
  f: number
  /** Glide to this frequency by the end (or by `glide` seconds). */
  to?: number
  glide?: number
  /** Frequency points [seconds, hz] after the start (linear ramps). */
  fpts?: readonly (readonly [number, number])[]
  type?: OscillatorType | WaveName
  dur: number
  vol: number
  at?: number
  attack?: number
  hold?: number
  lp?: number
  hp?: number
  bp?: number
  q?: number
  /** Filter points [seconds, hz] for the one filter (bp, else lp, else hp). */
  ffpts?: readonly (readonly [number, number])[]
  /** Amplitude modulation [rate hz, depth 0..1]: rattle, growl, purr. */
  am?: readonly [number, number]
  vib?: readonly [number, number]
  verb?: number
  pan?: number
  detune?: number
  /** Keep the pitch exact (musical sounds). */
  fixed?: boolean
}

export interface NzOpts {
  dur: number
  vol: number
  at?: number
  attack?: number
  hold?: number
  type?: BiquadFilterType
  f?: number
  to?: number
  q?: number
  color?: 'white' | 'brown'
  am?: readonly [number, number]
  verb?: number
  pan?: number
  rate?: number
}

export interface Fx {
  k: Kit
  t: number
  out: AudioNode
  verb: AudioNode
  /** A small per-play pitch wobble so repeats are never identical. */
  p: number
  /** Seconds since this sound last played (Infinity the first time). */
  since: number
  r(): number
  tone(o: ToneOpts): void
  nz(o: NzOpts): void
}

export function makeFx(k: Kit, t: number, out: AudioNode, verb: AudioNode): Fx {
  const r = Math.random
  const fx: Fx = {
    k, t, out, verb, r,
    p: 1 + (r() - 0.5) * 0.05,
    since: Infinity,
    tone(o) {
      const t0 = fx.t + (o.at ?? 0)
      const dur = Math.max(0.02, o.dur)
      const end = t0 + dur + 0.05
      const pm = o.fixed ? 1 : fx.p
      const osc = K.osc(k, o.type ?? 'sine', o.f * pm, t0, end, o.detune ?? 0)
      if (o.fpts) for (const [s, f] of o.fpts) osc.frequency.linearRampToValueAtTime(K.clamp(f * pm, 10, 20000), t0 + s)
      else if (o.to) osc.frequency.exponentialRampToValueAtTime(K.clamp(o.to * pm, 10, 20000), t0 + Math.min(dur, o.glide ?? dur))
      if (o.vib) K.vibrato(k, osc.detune, t0, end, o.vib[0], o.vib[1], 0.05)
      let node: AudioNode = osc
      const fType: BiquadFilterType | null = o.bp ? 'bandpass' : o.lp ? 'lowpass' : o.hp ? 'highpass' : null
      if (fType) {
        const ff = o.bp ?? o.lp ?? o.hp!
        const fl = K.filt(k, fType, ff, o.q ?? (fType === 'bandpass' ? 2 : 0.8))
        fl.frequency.setValueAtTime(ff, t0)
        if (o.ffpts) for (const [s, f] of o.ffpts) fl.frequency.linearRampToValueAtTime(K.clamp(f, 20, 18000), t0 + s)
        node.connect(fl)
        node = fl
        if (o.bp && o.hp) {
          const hp = K.filt(k, 'highpass', o.hp)
          node.connect(hp)
          node = hp
        }
      }
      node = amp(fx, node, t0, end, o.am)
      finish(fx, node, t0, dur, o.vol, o.attack ?? 0.005, o.hold ?? 0, o.verb, o.pan)
    },
    nz(o) {
      const t0 = fx.t + (o.at ?? 0)
      const dur = Math.max(0.01, o.dur)
      const src = K.noise(k, t0, dur + 0.05, o.color ?? 'white', o.rate ?? 1)
      let node: AudioNode = src
      if (o.type) {
        const f0 = o.f ?? 1000
        const fl = K.filt(k, o.type, f0, o.q ?? (o.type === 'bandpass' ? 1.2 : 0.7))
        fl.frequency.setValueAtTime(f0, t0)
        if (o.to) fl.frequency.exponentialRampToValueAtTime(K.clamp(o.to, 20, 18000), t0 + dur)
        node.connect(fl)
        node = fl
      }
      node = amp(fx, node, t0, t0 + dur + 0.05, o.am)
      finish(fx, node, t0, dur, o.vol, o.attack ?? 0.004, o.hold ?? 0, o.verb, o.pan)
    },
  }
  return fx
}

function amp(fx: Fx, node: AudioNode, t0: number, end: number, am?: readonly [number, number]): AudioNode {
  if (!am) return node
  const g = K.gain(fx.k, 1 - am[1] / 2)
  const lfo = K.osc(fx.k, 'square', am[0], t0, end)
  const d = K.gain(fx.k, am[1] / 2)
  lfo.connect(d)
  d.connect(g.gain)
  node.connect(g)
  return g
}

function finish(fx: Fx, node: AudioNode, t0: number, dur: number, vol: number, attack: number, hold: number, verb?: number, pan?: number): void {
  const g = K.gain(fx.k, 0)
  const a = Math.min(attack, dur * 0.8)
  const h = Math.max(0, Math.min(hold, dur - a - 0.01))
  K.ahr(g.gain, t0, vol, a, h, Math.max(0.01, dur - a - h))
  node.connect(g)
  let out: AudioNode = g
  if (pan !== undefined) {
    const p = K.panner(fx.k, pan)
    g.connect(p)
    out = p
  }
  out.connect(fx.out)
  if (verb) {
    const s = K.gain(fx.k, verb)
    out.connect(s)
    s.connect(fx.verb)
  }
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

/** Wood rubbing wood: a slow saw of stick-slip clicks through a hollow resonance. */
function creak(fx: Fx, at: number, dur: number, rate: number, formant: number, loud: number): void {
  // Stick-slip clicks through a narrow resonance ring hard: keep the level modest.
  const vol = loud * 0.7
  const w = (x: number) => rate * (0.8 + fx.r() * 0.6) * x
  fx.tone({
    type: 'sawtooth', f: w(1), at, dur, vol, attack: Math.min(0.06, dur * 0.2), hold: dur * 0.5,
    fpts: [[dur * 0.25, w(1.3)], [dur * 0.5, w(0.8)], [dur * 0.75, w(1.4)], [dur, w(0.9)]],
    bp: formant, q: 4, ffpts: [[dur, formant * 1.15]],
  })
  fx.tone({ type: 'sawtooth', f: w(1.02), at, dur, vol: vol * 0.45, attack: 0.05, hold: dur * 0.4, bp: formant * 2.3, q: 5 })
}

/** A knock on wood. */
function knock(fx: Fx, at: number, f: number, vol: number): void {
  fx.tone({ f, to: f * 0.7, dur: 0.09, vol, at, attack: 0.002 })
  fx.nz({ at, dur: 0.035, vol: vol * 1.2, type: 'bandpass', f: f * 3, q: 2 })
}

/** Struck metal: inharmonic partials of a bar. */
function metal(fx: Fx, at: number, f: number, vol: number, len: number, verb = 0.25): void {
  const parts: readonly [number, number, number][] = [[1, 1, 1], [2.76, 0.55, 0.65], [5.4, 0.35, 0.4], [8.93, 0.2, 0.25], [13.3, 0.1, 0.15]]
  for (const [ratio, v, d] of parts) fx.tone({ f: f * ratio, dur: len * d, vol: vol * v, at, attack: 0.001, verb })
  fx.nz({ at, dur: 0.03, vol: vol * 1.5, type: 'highpass', f: 2500 })
}

function click(fx: Fx, at: number, f: number, vol: number): void {
  fx.nz({ at, dur: 0.015, vol, type: 'bandpass', f, q: 3 })
}

function bubble(fx: Fx, at: number, f: number, vol: number): void {
  fx.tone({ f, to: f * 2.4, dur: 0.07, vol, at, attack: 0.004 })
}

function thump(fx: Fx, at: number, vol: number, f = 80): void {
  fx.tone({ f, to: f * 0.55, dur: 0.3, vol: vol * 0.7, at, attack: 0.003 })
  fx.nz({ at, dur: 0.28, vol: vol * 1.4, type: 'lowpass', f: 260, color: 'brown' })
}

/** A small service bell. */
function bell(fx: Fx, at: number, f: number, vol: number): void {
  const parts: readonly [number, number, number][] = [[1, 1, 1.5], [2.0, 0.3, 0.9], [2.74, 0.45, 0.6], [3.76, 0.25, 0.4], [5.93, 0.15, 0.25]]
  for (const [ratio, v, d] of parts) fx.tone({ f: f * ratio, dur: d, vol: vol * v, at, attack: 0.001, verb: 0.35, fixed: true })
  click(fx, at, 5000, vol * 2)
}

/** Kit voices played as a sound effect (stings, the gramophone, the fanfare). */
function play(fx: Fx, voice: K.Voice, m: number, at: number, dur: number, v: number, out?: AudioNode): void {
  voice(fx.k, out ?? fx.out, m, fx.t + at, dur, v)
}

function verbSend(fx: Fx, amount: number): AudioNode {
  const g = K.gain(fx.k, 1)
  g.connect(fx.out)
  const s = K.gain(fx.k, amount)
  g.connect(s)
  s.connect(fx.verb)
  return g
}

// ---------------------------------------------------------------------------
// The recipes
// ---------------------------------------------------------------------------

export const RECIPES: Record<string, (fx: Fx) => void> = {
  // doors, things
  door(fx) {
    creak(fx, 0, 0.42, 55, 950, 2.6)
    thump(fx, 0.4, 0.5)
    click(fx, 0.44, 2600, 0.35)
  },
  'door-locked'(fx) {
    for (let i = 0; i < 5; i++) {
      const at = i * 0.075 + fx.r() * 0.02
      knock(fx, at, 280 + fx.r() * 60, 0.22)
      metal(fx, at, 1100 + fx.r() * 400, 0.04, 0.12, 0)
    }
    thump(fx, 0.42, 0.35, 110)
  },
  creak(fx) {
    creak(fx, 0, 1.35, 42, 780, 3)
    fx.tone({ type: 'sawtooth', f: 38, at: 0.2, dur: 1.0, vol: 0.6, attack: 0.2, fpts: [[0.5, 60], [1.0, 34]], bp: 1650, q: 6, verb: 0.3 })
  },
  drawer(fx) {
    fx.nz({ dur: 0.36, vol: 0.7, type: 'bandpass', f: 650, to: 1050, q: 2, attack: 0.03, am: [19, 0.7] })
    knock(fx, 0.34, 210, 0.35)
  },
  cupboard(fx) {
    creak(fx, 0, 0.3, 75, 1300, 2.2)
    knock(fx, 0.28, 180, 0.4)
  },
  pickup(fx) {
    fx.tone({ f: 520, to: 1040, dur: 0.12, vol: 0.16, attack: 0.004 })
    fx.tone({ type: 'triangle', f: 1568, at: 0.08, dur: 0.16, vol: 0.06, verb: 0.3 })
  },
  drop(fx) {
    fx.tone({ f: 190, to: 90, dur: 0.12, vol: 0.28 })
    fx.nz({ dur: 0.1, vol: 0.45, type: 'lowpass', f: 900 })
    knock(fx, 0.09, 420, 0.15)
    knock(fx, 0.16, 520, 0.08)
  },
  'key-turn'(fx) {
    click(fx, 0, 3600, 0.4)
    metal(fx, 0.02, 2300, 0.03, 0.15, 0)
    knock(fx, 0.14, 420, 0.28)
    click(fx, 0.16, 2200, 0.3)
  },
  'lock-rattle'(fx) {
    for (let i = 0; i < 8; i++) {
      const at = fx.r() * 0.5
      click(fx, at, 2000 + fx.r() * 2500, 0.3)
      if (i % 3 === 0) knock(fx, at, 300 + fx.r() * 100, 0.15)
    }
  },
  'trunk-roll'(fx) {
    fx.nz({ dur: 1.3, vol: 1.1, type: 'lowpass', f: 280, color: 'brown', attack: 0.15, hold: 0.8, am: [14, 0.6] })
    fx.tone({ f: 1700, dur: 1.2, vol: 0.03, attack: 0.1, hold: 0.8, fpts: [[0.3, 2050], [0.6, 1750], [0.9, 2150], [1.2, 1800]] })
    creak(fx, 0.1, 1.0, 34, 600, 1.4)
  },
  'trunk-thud'(fx) {
    fx.tone({ f: 70, to: 38, dur: 0.5, vol: 0.45 })
    fx.nz({ dur: 0.45, vol: 1.2, type: 'lowpass', f: 220, color: 'brown' })
    knock(fx, 0.02, 140, 0.3)
  },
  'window-open'(fx) {
    creak(fx, 0, 0.5, 62, 1500, 2)
    fx.nz({ dur: 0.55, vol: 0.4, type: 'bandpass', f: 900, to: 2400, q: 1.5, attack: 0.05 })
    fx.nz({ at: 0.35, dur: 1.3, vol: 0.22, type: 'highpass', f: 700, attack: 0.3, hold: 0.3 })
    fx.nz({ at: 0.35, dur: 1.4, vol: 0.5, type: 'bandpass', f: 500, to: 900, q: 1.5, attack: 0.4, color: 'white' })
  },
  hatch(fx) {
    creak(fx, 0, 0.22, 80, 1400, 1.8)
    knock(fx, 0.2, 260, 0.45)
    knock(fx, 0.25, 330, 0.18)
  },
  dumbwaiter(fx) {
    for (let i = 0; i < 5; i++) {
      const at = i * 0.27
      fx.nz({ at, dur: 0.17, vol: 0.45, type: 'bandpass', f: 1300 + fx.r() * 300, q: 1.6, attack: 0.05 })
      fx.tone({ at: at + 0.03, f: 1300, dur: 0.12, vol: 0.035, fpts: [[0.05, 1680], [0.12, 1420]] })
    }
    fx.nz({ dur: 1.5, vol: 0.7, type: 'lowpass', f: 200, color: 'brown', attack: 0.3, hold: 0.6 })
    knock(fx, 1.4, 240, 0.3)
    bell(fx, 1.55, 2093, 0.1)
  },
  bell(fx) {
    bell(fx, 0, 2093, 0.12)
  },

  // the house
  'clock-tick'(fx) {
    K.tick(fx.k, fx.out, fx.t, 0.8, false)
    K.tick(fx.k, fx.out, fx.t + 0.5, 0.8, true)
  },
  'clock-chime'(fx) {
    // The gears whirr before the first strike of a run, not before every one.
    const first = fx.since > 2
    const at = first ? 0.22 : 0
    if (first) fx.nz({ dur: 0.26, vol: 0.4, type: 'bandpass', f: 900, q: 3, am: [42, 0.8] })
    const f = 147
    const parts: readonly [number, number, number][] = [[0.5, 0.5, 3.8], [1, 1, 3], [1.19, 0.45, 2.4], [1.5, 0.35, 2], [2, 0.4, 1.6], [2.52, 0.2, 1.1], [3.0, 0.14, 0.8]]
    for (const [ratio, v, d] of parts) fx.tone({ f: f * ratio, at, dur: d, vol: 0.16 * v, attack: 0.003, verb: 0.5, fixed: true })
    fx.nz({ at, dur: 0.05, vol: 0.3, type: 'bandpass', f: 1200 })
  },
  'clock-wind'(fx) {
    let at = 0
    for (let i = 0; i < 10; i++) {
      click(fx, at, 3000 + i * 160, 0.4)
      fx.tone({ type: 'square', f: 1600 + i * 70, at, dur: 0.015, vol: 0.025, hp: 1000 })
      at += 0.12 - i * 0.006
    }
    fx.tone({ f: 180, to: 330, dur: at, vol: 0.02, attack: 0.1 })
  },
  'pipes-knock'(fx) {
    for (const [at, f] of [[0, 190], [0.22, 210], [0.37, 175], [0.8, 230]] as const) {
      fx.tone({ f, dur: 0.3, vol: 0.2, at, attack: 0.002, verb: 0.35 })
      fx.tone({ f: f * 2.76, dur: 0.14, vol: 0.07, at, attack: 0.002 })
      fx.nz({ at, dur: 0.06, vol: 0.4, type: 'lowpass', f: 600 })
    }
    for (let i = 0; i < 5; i++) bubble(fx, 0.95 + i * 0.1 + fx.r() * 0.04, 150 + fx.r() * 150, 0.14)
  },
  'furnace-whoosh'(fx) {
    fx.nz({ dur: 1.9, vol: 0.55, type: 'lowpass', f: 150, to: 2200, attack: 0.35, hold: 0.5 })
    fx.nz({ dur: 2.2, vol: 1.1, type: 'lowpass', f: 420, color: 'brown', attack: 0.4, hold: 0.9 })
    fx.tone({ f: 45, dur: 2, vol: 0.2, attack: 0.3, hold: 0.9 })
    for (let i = 0; i < 8; i++) click(fx, 0.6 + fx.r() * 1.3, 2500 + fx.r() * 2500, 0.25 + fx.r() * 0.25)
  },
  'fire-crackle'(fx) {
    fx.nz({ dur: 1.5, vol: 0.5, type: 'lowpass', f: 320, color: 'brown', attack: 0.2, hold: 0.8 })
    for (let i = 0; i < 16; i++) click(fx, fx.r() * 1.4, 2200 + fx.r() * 3000, 0.2 + fx.r() * 0.35)
  },
  'match-strike'(fx) {
    fx.nz({ dur: 0.13, vol: 0.9, type: 'bandpass', f: 2800, q: 1.2, am: [60, 0.8], attack: 0.01 })
    fx.nz({ at: 0.1, dur: 0.55, vol: 0.45, type: 'lowpass', f: 700, to: 4000, attack: 0.03, hold: 0.1 })
    fx.nz({ at: 0.12, dur: 0.6, vol: 0.2, type: 'bandpass', f: 400, q: 1, attack: 0.05, color: 'brown' })
  },
  'match-fizzle'(fx) {
    fx.nz({ dur: 0.8, vol: 0.28, type: 'highpass', f: 3000, am: [23, 0.8] })
    fx.tone({ f: 900, to: 300, at: 0.1, dur: 0.5, vol: 0.03 })
    fx.nz({ at: 0.65, dur: 0.2, vol: 0.35, type: 'lowpass', f: 600 })
  },
  'paper-rip'(fx) {
    fx.nz({ dur: 0.42, vol: 1.0, type: 'bandpass', f: 2600, q: 0.9, am: [47, 0.8], attack: 0.02 })
    fx.nz({ at: 0.12, dur: 0.22, vol: 0.5, type: 'highpass', f: 4000, am: [71, 0.9] })
  },
  'jar-pop'(fx) {
    fx.tone({ f: 620, to: 210, dur: 0.07, vol: 0.35 })
    fx.nz({ dur: 0.04, vol: 0.7, type: 'bandpass', f: 1200, q: 2 })
    fx.nz({ at: 0.02, dur: 0.28, vol: 0.09, type: 'highpass', f: 5000 })
    fx.tone({ type: 'triangle', f: 1760, at: 0.12, dur: 0.22, vol: 0.04, verb: 0.3 })
  },
  glug(fx) {
    for (let i = 0; i < 4; i++) {
      bubble(fx, i * 0.15, 170 + i * 22 + fx.r() * 20, 0.28)
      fx.nz({ at: i * 0.15, dur: 0.1, vol: 0.35, type: 'lowpass', f: 420, color: 'brown' })
    }
  },
  'rust-squeal'(fx) {
    fx.tone({ type: 'square', f: 900, dur: 0.95, vol: 0.28, attack: 0.08, hold: 0.5, fpts: [[0.2, 1250], [0.4, 1050], [0.6, 1420], [0.95, 1100]], bp: 1300, q: 3 })
    fx.nz({ dur: 0.9, vol: 0.35, type: 'bandpass', f: 2000, q: 2, am: [31, 0.7], attack: 0.05 })
  },
  'rod-clang'(fx) {
    metal(fx, 0, 330, 0.18, 2.3, 0.4)
    metal(fx, 0.004, 497, 0.08, 1.4, 0.3)
    thump(fx, 0, 0.25, 110)
  },
  spark(fx) {
    for (let i = 0; i < 11; i++) click(fx, fx.r() * 0.22, 3000 + fx.r() * 5000, 0.35 + fx.r() * 0.3)
    fx.tone({ type: 'square', f: 2400, to: 800, dur: 0.08, vol: 0.04, hp: 800 })
  },
  zap(fx) {
    fx.tone({ type: 'sawtooth', f: 1400, to: 60, dur: 0.5, vol: 0.12, lp: 4000, am: [60, 0.8] })
    fx.nz({ dur: 0.35, vol: 0.35, type: 'highpass', f: 2000, am: [90, 0.9] })
    fx.tone({ f: 120, to: 40, dur: 0.3, vol: 0.25 })
  },
  'machine-hum'(fx) {
    fx.tone({ type: 'sawtooth', f: 50, dur: 2.1, vol: 0.2, lp: 420, attack: 0.3, hold: 1.2 })
    fx.tone({ type: 'sawtooth', f: 100, dur: 2.1, vol: 0.08, lp: 600, attack: 0.3, hold: 1.2, detune: 7 })
    fx.tone({ f: 420, to: 520, dur: 2.1, vol: 0.03, attack: 0.5, hold: 0.9, vib: [7, 10] })
  },
  'machine-charge'(fx) {
    fx.tone({ type: 'sawtooth', f: 90, to: 1400, dur: 2.8, vol: 0.1, lp: 3000, attack: 0.2, hold: 2.2, am: [13, 0.5] })
    fx.tone({ f: 50, dur: 2.8, vol: 0.2, attack: 0.3, hold: 2.1 })
    for (let i = 0; i < 14; i++) click(fx, 0.3 + fx.r() * 2.3, 3000 + fx.r() * 4000, 0.2 + fx.r() * 0.4)
    bell(fx, 2.75, 2637, 0.08)
  },
  'lever-clunk'(fx) {
    for (let i = 0; i < 3; i++) click(fx, i * 0.05, 2400, 0.35)
    fx.tone({ f: 110, to: 60, at: 0.15, dur: 0.3, vol: 0.45 })
    metal(fx, 0.15, 240, 0.1, 0.7)
    fx.nz({ at: 0.15, dur: 0.15, vol: 0.6, type: 'lowpass', f: 700 })
  },
  'booth-door'(fx) {
    creak(fx, 0, 0.3, 90, 1800, 1.8)
    knock(fx, 0.28, 500, 0.3)
    for (let i = 0; i < 4; i++) fx.tone({ f: 3200 + fx.r() * 1200, at: 0.3 + i * 0.045, dur: 0.12, vol: 0.02, attack: 0.001 })
  },
  'radio-static'(fx) {
    fx.nz({ dur: 1.3, vol: 0.5, type: 'bandpass', f: 2200, q: 0.6, am: [18, 0.6], attack: 0.02, hold: 0.9 })
    fx.tone({ f: 2400, dur: 1.2, vol: 0.03, fpts: [[0.3, 900], [0.7, 1600], [1.2, 1200]] })
  },
  'radio-voice'(fx) {
    fx.nz({ dur: 1.7, vol: 0.18, type: 'bandpass', f: 2000, q: 0.7, attack: 0.02, hold: 1.4 })
    const pitches = [170, 190, 160, 185, 175, 0, 195, 170, 180, 150, 0, 165, 175, 140]
    pitches.forEach((f, i) => {
      if (!f) return
      fx.tone({ type: 'sawtooth', f, to: f * 0.92, at: 0.08 + i * 0.1, dur: 0.085, vol: 0.4, bp: 1300, q: 3, hp: 380 })
    })
  },
  'piano-plonk'(fx) {
    const notes: readonly [number, number][] = [[62, 0], [65, 0.22], [61, 0.46], [62, 0.46]]
    for (const [m, at] of notes) {
      const f = K.hz(m)
      fx.tone({ type: 'triangle', f, dur: 1.2, vol: 0.09, at, attack: 0.003, detune: 18, fixed: true, verb: 0.2 })
      fx.tone({ type: 'triangle', f, dur: 1.2, vol: 0.09, at, attack: 0.003, detune: -14, fixed: true })
      fx.tone({ f: f * 2, dur: 0.5, vol: 0.03, at, attack: 0.003, fixed: true })
      knock(fx, at, 120, 0.08)
    }
  },
  'phone-jingle'(fx) {
    // A 1987 local-radio ident: an electric-piano run and a brassy stab.
    const run: readonly [number, number][] = [[77, 0], [81, 0.1], [84, 0.2], [81, 0.3], [89, 0.4]]
    for (const [m, at] of run) {
      const f = K.hz(m)
      fx.tone({ f, dur: 0.35, vol: 0.08, at, attack: 0.002, fixed: true })
      fx.tone({ f: f * 3.5, dur: 0.08, vol: 0.02, at, attack: 0.001, fixed: true })
    }
    for (const m of [65, 69, 72, 77]) play(fx, K.brass, m, 0.55, 0.5, 0.7)
    fx.tone({ f: 800, to: 2400, at: 0.5, dur: 0.25, vol: 0.02 })
  },
  gramophone(fx) {
    // The house's record: the theme's hook through a tin horn, wobbling.
    fx.nz({ dur: 3.4, vol: 0.05, type: 'highpass', f: 3000, attack: 0.1, hold: 2.8 })
    for (let i = 0; i < 26; i++) click(fx, fx.r() * 3.3, 1500 + fx.r() * 3000, 0.1 + fx.r() * 0.15)
    const horn = K.filt(fx.k, 'bandpass', 1300, 1.1)
    horn.connect(verbSend(fx, 0.25))
    const e = 60 / 120 / 2
    const tune: readonly [number, number, number][] = [[74, 0, 2], [77, 3, 1], [76, 4, 1], [74, 5, 1], [81, 6, 4], [80, 10, 1], [81, 11, 1], [82, 12, 2], [81, 14, 2], [79, 16, 2]]
    for (const [m, at, len] of tune) play(fx, K.accordion, m, 0.2 + at * e, len * e * 0.9, 1.6, horn)
    for (const [m, at] of [[50, 0], [45, 6], [50, 12]] as const) play(fx, K.tuba, m, 0.2 + at * e, e * 1.5, 0.8, horn)
  },
  splash(fx) {
    fx.nz({ dur: 0.65, vol: 0.9, type: 'lowpass', f: 2600, to: 500 })
    fx.nz({ dur: 0.25, vol: 0.4, type: 'bandpass', f: 1200 })
    for (let i = 0; i < 3; i++) bubble(fx, 0.2 + i * 0.12 + fx.r() * 0.05, 300 + fx.r() * 300, 0.12)
  },
  drip(fx) {
    K.drip(fx.k, verbSend(fx, 0.5), 86 + Math.floor(fx.r() * 6), fx.t, 0.2, 1.1)
  },
  thud(fx) {
    thump(fx, 0, 0.6)
  },
  squeak(fx) {
    fx.tone({ f: 1700, dur: 0.15, vol: 0.16, fpts: [[0.05, 2500], [0.15, 1900]] })
    fx.tone({ type: 'triangle', f: 1700, dur: 0.15, vol: 0.07, fpts: [[0.05, 2500], [0.15, 1900]] })
  },
  slurp(fx) {
    fx.nz({ dur: 0.55, vol: 0.8, type: 'bandpass', f: 500, to: 2200, q: 2, am: [22, 0.6], attack: 0.05 })
    fx.tone({ f: 300, to: 700, dur: 0.5, vol: 0.05 })
  },
  burp(fx) {
    fx.tone({ type: 'sawtooth', f: 110, dur: 0.7, vol: 0.34, lp: 850, q: 3, am: [27, 0.45], attack: 0.02, hold: 0.3, fpts: [[0.15, 95], [0.35, 104], [0.7, 78]] })
    fx.tone({ type: 'sawtooth', f: 55, dur: 0.7, vol: 0.15, lp: 400, attack: 0.02, hold: 0.3 })
    fx.nz({ at: 0.68, dur: 0.05, vol: 0.2, type: 'bandpass', f: 800 })
  },
  chomp(fx) {
    for (const at of [0, 0.22]) {
      fx.tone({ f: 170, to: 80, dur: 0.08, vol: 0.4, at })
      fx.nz({ at, dur: 0.02, vol: 0.3, type: 'highpass', f: 3000 })
      fx.nz({ at: at + 0.01, dur: 0.08, vol: 0.35, type: 'bandpass', f: 900 })
    }
  },
  snore(fx) {
    fx.nz({ dur: 1.1, vol: 0.7, type: 'bandpass', f: 450, to: 700, q: 1.5, attack: 0.6, am: [30, 0.7] })
    fx.tone({ type: 'sawtooth', f: 55, dur: 1.1, vol: 0.08, lp: 300, attack: 0.6, am: [30, 0.6] })
    fx.nz({ at: 1.2, dur: 0.9, vol: 0.35, type: 'bandpass', f: 800, to: 400, attack: 0.1 })
    fx.tone({ f: 950, to: 650, at: 1.25, dur: 0.8, vol: 0.03, attack: 0.2 })
  },
  munch(fx) {
    for (const at of [0, 0.2, 0.42]) {
      fx.nz({ at, dur: 0.07, vol: 0.6, type: 'bandpass', f: 1800 + fx.r() * 800, q: 1, am: [80, 0.8] })
      fx.tone({ f: 200, to: 120, dur: 0.06, vol: 0.18, at })
    }
  },

  // people
  emf(fx) {
    let at = 0
    for (let i = 0; i < 9; i++) {
      fx.tone({ type: 'square', f: 1400 + i * 90, at, dur: 0.04, vol: 0.09, hp: 800 })
      at += Math.max(0.05, 0.17 - i * 0.015)
    }
    fx.nz({ dur: at, vol: 0.08, type: 'bandpass', f: 3000, am: [12, 0.8] })
  },
  'bones-rattle'(fx) {
    for (let i = 0; i < 11; i++) {
      const at = fx.r() * 0.6
      const f = 600 + fx.r() * 800
      fx.tone({ f, dur: 0.05, vol: 0.14, at, attack: 0.001 })
      fx.tone({ type: 'triangle', f: f * 2.7, dur: 0.03, vol: 0.04, at, attack: 0.001 })
      click(fx, at, 3500, 0.15)
    }
  },
  'bones-collapse'(fx) {
    let at = 0
    for (let i = 0; i < 22; i++) {
      const f = 1400 - i * 38 + fx.r() * 200
      fx.tone({ f, dur: 0.05, vol: 0.13, at, attack: 0.001, pan: fx.r() - 0.5 })
      click(fx, at, 3000, 0.12)
      at += 0.02 + fx.r() * 0.07
    }
    thump(fx, at + 0.05, 0.45, 100)
    // And one last rib, a beat late.
    fx.tone({ f: 900, dur: 0.06, vol: 0.12, at: at + 0.45, attack: 0.001 })
  },
  'ghost-woo'(fx) {
    fx.tone({ type: 'theremin', f: 280, dur: 1.8, vol: 0.13, attack: 0.3, hold: 0.9, fpts: [[0.5, 560], [1.0, 620], [1.8, 330]], vib: [5.5, 40], verb: 0.7 })
    fx.nz({ dur: 1.6, vol: 0.12, type: 'bandpass', f: 600, q: 2, attack: 0.4, verb: 0.5 })
  },
  'ghost-gasp'(fx) {
    fx.nz({ dur: 0.35, vol: 0.55, type: 'bandpass', f: 900, to: 2600, q: 2, attack: 0.25, verb: 0.5 })
    fx.tone({ f: 500, to: 800, dur: 0.3, vol: 0.04, attack: 0.2, verb: 0.5 })
  },
  'cat-meow'(fx) {
    fx.tone({
      type: 'sawtooth', f: 620, dur: 0.65, vol: 0.5, attack: 0.04, hold: 0.35, fpts: [[0.15, 780], [0.35, 720], [0.65, 520]],
      bp: 1100, q: 2.5, ffpts: [[0.15, 2300], [0.4, 1400], [0.65, 900]], vib: [7, 15],
    })
  },
  'cat-hiss'(fx) {
    fx.nz({ dur: 0.8, vol: 0.35, type: 'highpass', f: 3500, attack: 0.06, hold: 0.4 })
    fx.nz({ dur: 0.05, vol: 0.4, type: 'bandpass', f: 1500 })
  },
  'cat-purr'(fx) {
    fx.nz({ dur: 1.9, vol: 1.1, type: 'lowpass', f: 350, color: 'brown', attack: 0.5, hold: 0.8, am: [24, 0.9] })
    fx.tone({ f: 48, dur: 1.9, vol: 0.06, attack: 0.5, hold: 0.8, am: [24, 0.9] })
  },
  'bat-flap'(fx) {
    for (let i = 0; i < 6; i++) fx.nz({ at: i * 0.09, dur: 0.06, vol: 0.6, type: 'lowpass', f: 900, attack: 0.015, pan: -0.6 + i * 0.24 })
  },
  'bat-squeak'(fx) {
    for (const at of [0, 0.09, 0.21]) fx.tone({ f: 2600, to: 3600, dur: 0.05, vol: 0.12, at })
  },
  'plant-snap'(fx) {
    fx.nz({ dur: 0.12, vol: 0.45, type: 'bandpass', f: 600, to: 2000 })
    fx.tone({ f: 200, to: 90, at: 0.1, dur: 0.1, vol: 0.5 })
    fx.nz({ at: 0.1, dur: 0.03, vol: 0.5, type: 'highpass', f: 2000 })
    fx.nz({ at: 0.11, dur: 0.14, vol: 0.5, type: 'bandpass', f: 700 })
  },
  'plant-hrrm'(fx) {
    fx.tone({ type: 'sawtooth', f: 52, dur: 1.3, vol: 0.45, lp: 380, q: 4, am: [32, 0.5], attack: 0.1, hold: 0.8, fpts: [[0.4, 60], [0.9, 58], [1.3, 47]], ffpts: [[0.5, 480], [1.3, 300]] })
    fx.tone({ type: 'sawtooth', f: 104, dur: 1.3, vol: 0.12, lp: 500, attack: 0.1, hold: 0.8, fpts: [[0.4, 120], [1.3, 94]] })
  },
  poof(fx) {
    fx.nz({ dur: 0.55, vol: 0.8, type: 'bandpass', f: 3000, to: 500, q: 1, attack: 0.02 })
    for (let i = 0; i < 4; i++) fx.tone({ f: 2000 + fx.r() * 2000, at: 0.1 + fx.r() * 0.25, dur: 0.15, vol: 0.03, verb: 0.5 })
  },
  magic(fx) {
    const out = verbSend(fx, 0.6)
    ;[74, 76, 78, 81, 83, 86, 88, 90, 93, 95].forEach((m, i) => play(fx, K.celesta, m, i * 0.05, 0.3, 0.8, out))
    fx.nz({ dur: 0.9, vol: 0.06, type: 'highpass', f: 6000, attack: 0.3, verb: 0.5 })
  },
  fanfare(fx) {
    const out = verbSend(fx, 0.25)
    const e = 0.1
    ;[[69, 0], [74, 1], [78, 2]].forEach(([m, i]) => play(fx, K.brass, m!, i! * e, e * 0.9, 1.1, out))
    play(fx, K.brass, 81, 3 * e, 0.9, 1.2, out)
    for (const m of [62, 66, 69]) play(fx, K.brass, m, 3 * e, 0.9, 0.7, out)
    K.timpani(fx.k, out, 50, fx.t + 3 * e, 0.8)
    K.cymbal(fx.k, out, fx.t + 3 * e, 0.7)
  },

  // the car
  'car-click'(fx) {
    for (const at of [0, 0.2, 0.4, 0.6]) {
      fx.nz({ at, dur: 0.03, vol: 1.5, type: 'bandpass', f: 1800, q: 3 })
      fx.tone({ type: 'square', f: 120, at, dur: 0.02, vol: 0.15 })
      fx.tone({ f: 180, to: 120, at, dur: 0.05, vol: 0.25 })
    }
  },
  'car-start'(fx) {
    for (let i = 0; i < 7; i++) {
      const at = i * 0.14
      fx.nz({ at, dur: 0.12, vol: 0.8, type: 'lowpass', f: 400, color: 'brown' })
      fx.tone({ type: 'sawtooth', f: 70, to: 55, at, dur: 0.1, vol: 0.12, lp: 300 })
    }
    fx.tone({ type: 'sawtooth', f: 30, at: 1.0, dur: 2.3, vol: 0.28, lp: 520, attack: 0.05, hold: 1.5, am: [25, 0.5], fpts: [[0.3, 58], [0.7, 72], [1.2, 44], [2.3, 42]] })
    fx.nz({ at: 1.0, dur: 2.1, vol: 0.7, type: 'lowpass', f: 600, color: 'brown', attack: 0.1, hold: 1.4 })
  },
  'car-cough'(fx) {
    for (let i = 0; i < 3; i++) {
      const at = i * 0.14
      fx.nz({ at, dur: 0.12, vol: 0.7, type: 'lowpass', f: 400, color: 'brown' })
      fx.tone({ type: 'sawtooth', f: 70, to: 55, at, dur: 0.1, vol: 0.1, lp: 300 })
    }
    for (const at of [0.55, 0.9, 1.12]) {
      fx.nz({ at, dur: 0.14, vol: 1.1, type: 'lowpass', f: 700, color: 'brown' })
      fx.tone({ type: 'sawtooth', f: 60, to: 35, at, dur: 0.15, vol: 0.18, lp: 500 })
    }
    fx.tone({ type: 'sawtooth', f: 55, to: 20, at: 1.3, dur: 0.7, vol: 0.14, lp: 300 })
    knock(fx, 1.95, 150, 0.2)
  },
  'car-horn'(fx) {
    fx.tone({ type: 'sawtooth', f: 415, dur: 0.65, vol: 0.075, lp: 1800, attack: 0.02, hold: 0.5 })
    fx.tone({ type: 'sawtooth', f: 523, dur: 0.65, vol: 0.065, lp: 1800, attack: 0.02, hold: 0.5, detune: -20 })
  },
  bonnet(fx) {
    creak(fx, 0, 0.35, 60, 900, 2)
    metal(fx, 0.33, 140, 0.14, 0.8)
    fx.tone({ f: 90, to: 60, at: 0.33, dur: 0.3, vol: 0.4 })
    fx.nz({ at: 0.33, dur: 0.2, vol: 0.5, type: 'lowpass', f: 600 })
  },
}

/**
 * Level trims in dB, from offline renders (loudest 300 ms of each recipe):
 * small sounds up so a pickup or a key still reads over the rain, harsh
 * high ones (hiss, squeal) down. Big moments (the furnace, the car starting)
 * stay the loudest.
 */
export const TRIM: Record<string, number> = {
  pickup: 8, drawer: 5, drop: 3, 'key-turn': 5, 'lock-rattle': 4, 'clock-tick': 0, 'clock-wind': 10,
  'match-strike': 3, 'match-fizzle': 2, 'jar-pop': 4, glug: 4, spark: 7, squeak: 4, slurp: 6, munch: 5,
  emf: 10, 'bat-flap': 6, 'bat-squeak': 5, 'car-click': 0, drip: 10, snore: 2, 'ghost-gasp': 3,
  'bones-rattle': 4, 'car-cough': 4, bell: 3, 'pipes-knock': 3, 'radio-voice': 3, 'car-horn': 5,
  'furnace-whoosh': -3, 'cat-hiss': -5, 'rust-squeal': -3, 'trunk-roll': -2, creak: -2,
}

/** A name nobody wrote a recipe for: a soft blip, never an error. */
export function blip(fx: Fx): void {
  fx.tone({ f: 660, to: 880, dur: 0.08, vol: 0.05 })
}

// ---------------------------------------------------------------------------
// Other one-shots: stings, hero switch, room change
// ---------------------------------------------------------------------------

/** Three cheerful little stings in D, picked by the puzzle id. Each returns its length. */
export const STINGS: readonly ((fx: Fx) => number)[] = [
  // Ta-da: a harpsichord run up the D major chord, a celesta star, oom-pah.
  fx => {
    const out = verbSend(fx, 0.3)
    ;[69, 74, 78, 81].forEach((m, i) => play(fx, K.harpsi, m, i * 0.07, 0.1, 1.3, out))
    for (const m of [74, 78, 81]) play(fx, K.harpsi, m, 0.32, 0.6, 1.1, out)
    play(fx, K.celesta, 86, 0.32, 0.8, 1.3, out)
    play(fx, K.tuba, 38, 0.32, 0.25, 1.1, out)
    play(fx, K.tuba, 45, 0.6, 0.35, 1, out)
    return 1.2
  },
  // An oom-pah cadence, A7 to D, the theremin gliding home.
  fx => {
    const out = verbSend(fx, 0.3)
    play(fx, K.tuba, 45, 0, 0.2, 1.1, out)
    for (const m of [61, 64, 67]) play(fx, K.harpsi, m, 0.2, 0.15, 1, out)
    play(fx, K.tuba, 38, 0.42, 0.4, 1.2, out)
    for (const m of [62, 66, 69]) play(fx, K.harpsi, m, 0.42, 0.5, 1.1, out)
    K.theremin(fx.k, out, 81, fx.t + 0.42, 0.6, 1.1, 74)
    return 1.3
  },
  // A celesta sparkle up the scale, and two bwomps from the tuba.
  fx => {
    const out = verbSend(fx, 0.45)
    ;[74, 76, 78, 79, 81, 83, 85, 86].forEach((m, i) => play(fx, K.celesta, m, i * 0.04, 0.2, 1, out))
    play(fx, K.tuba, 38, 0.38, 0.18, 1.2, out)
    play(fx, K.tuba, 33, 0.58, 0.3, 1.1, out)
    play(fx, K.musicBox, 86, 0.62, 0.5, 1.3, out)
    return 1.2
  },
]

export function heroWhoosh(fx: Fx): void {
  fx.nz({ dur: 0.22, vol: 0.25, type: 'bandpass', f: 500, to: 2500, q: 1.5, attack: 0.1 })
  click(fx, 0.2, 3000, 0.15)
}

export function roomStep(fx: Fx): void {
  knock(fx, 0, 150, 0.12)
  click(fx, 0.05, 2400, 0.08)
}
