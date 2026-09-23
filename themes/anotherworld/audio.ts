/**
 * Another Shore audio — synthesised Web Audio, no samples, no network.
 *
 * Another World's rule: silence by default, music is an event. So most of
 * the time only an ambience bed plays (filtered noise, slow LFOs, a few
 * sine/triangle partials), and a music cue comes in at a story beat and
 * goes again. Every GameEvent has a small one-shot recipe; the cutscenes
 * call named beats. All music is original.
 *
 * Nothing plays before `unlock()` (call it from the key/tap that starts
 * the game). While an ambience or a cue is active the site radio is parked,
 * exactly the way themes/zelda/audio.ts does it.
 */

import type { GameEvent, DeathCause } from './types'
import { getRadioEngine } from '../radio/engine'
import { MUTE_KEY as RADIO_MUTE_KEY } from '../radio/catalog'

export type Ambience = 'sea' | 'night' | 'hall' | 'storm' | 'dawn'
export type Cue = 'prologue' | 'chase' | 'capture' | 'ending'
export type Beat = 'engine' | 'lightning' | 'fall' | 'splash' | 'bubbles' | 'wings' | 'flash'

export interface ShoreAudio {
  /** Create/resume the AudioContext; call from a user gesture. Safe to call often. */
  unlock(): void
  setMuted(muted: boolean): void
  event(e: GameEvent): void
  ambience(kind: Ambience | null): void
  cue(name: Cue | null): void
  beat(name: Beat): void
  /** Pause/unpause everything (tab hidden, game paused). */
  suspend(on: boolean): void
  /** Stop all, release the context, unpark the radio. */
  dispose(): void
}

const MASTER_LEVEL = 0.8
const AMB_LEVEL = 0.22
const MUSIC_LEVEL = 0.42
const SFX_LEVEL = 0.9
const XFADE = 0.8
const LOOKAHEAD = 0.25
const TICK_MS = 50

const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)
const rand = (a: number, b: number): number => a + Math.random() * (b - a)
const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

interface Bed {
  kind: Ambience
  out: GainNode
  sources: AudioScheduledSourceNode[]
  /** context time of the next random detail */
  next: number
  /** plays one detail at `at`, returns seconds until the next */
  detail?: (at: number) => number
}

interface CueDef {
  /** seconds per step */
  step: number
  /** Infinity loops */
  steps: number
  /** seconds to let the last notes ring before the cue counts as idle */
  tail: number
  play(i: number, at: number, out: GainNode): void
}

interface CuePlayer {
  name: Cue
  def: CueDef
  out: GainNode
  i: number
  nextAt: number
}

interface ToneOpts {
  type?: OscillatorType
  f: number
  /** glide target */
  to?: number
  glide?: number
  at: number
  dur: number
  peak: number
  attack?: number
  dest?: AudioNode
  detune?: number
  /** lowpass cutoff */
  lp?: number
  q?: number
  /** vibrato depth in cents */
  vib?: number
  /** reverb send */
  wet?: number
}

interface HissOpts {
  at: number
  dur: number
  peak: number
  attack?: number
  type?: BiquadFilterType
  f: number
  to?: number
  glide?: number
  q?: number
  dest?: AudioNode
  brown?: boolean
  wet?: number
}

export function createShoreAudio(): ShoreAudio {
  let ac: AudioContext | null = null
  let master!: GainNode
  let ambBus!: GainNode
  let musicBus!: GainNode
  let sfxBus!: GainNode
  let verbIn!: GainNode
  let delayIn!: GainNode
  let white!: AudioBuffer
  let brown!: AudioBuffer
  let timer: ReturnType<typeof setInterval> | null = null
  let bed: Bed | null = null
  let wanted: Ambience | null = null
  let player: CuePlayer | null = null
  let muted = false
  let radioParked = false
  let lastStep = -1
  const lastPlayed = new Map<string, number>()

  const client = (): boolean => typeof window !== 'undefined'

  function impulse(seconds: number, decay: number): AudioBuffer {
    const c = ac!
    const len = Math.max(1, Math.floor(c.sampleRate * seconds))
    const buf = c.createBuffer(2, len, c.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
    }
    return buf
  }

  function ensure(): boolean {
    if (!client()) return false
    if (ac) {
      if (ac.state === 'suspended') ac.resume().catch(() => {})
      return true
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false
    try { ac = new Ctor() } catch { ac = null; return false }
    const c = ac
    // Gentle: it only keeps the thunder and the beam from clipping.
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.knee.value = 12
    comp.ratio.value = 3
    comp.attack.value = 0.01
    comp.release.value = 0.25
    comp.connect(c.destination)
    master = c.createGain()
    master.gain.value = muted ? 0 : MASTER_LEVEL
    master.connect(comp)
    ambBus = c.createGain()
    ambBus.gain.value = AMB_LEVEL
    ambBus.connect(master)
    musicBus = c.createGain()
    musicBus.gain.value = MUSIC_LEVEL
    musicBus.connect(master)
    sfxBus = c.createGain()
    sfxBus.gain.value = SFX_LEVEL
    sfxBus.connect(master)

    white = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
    const wd = white.getChannelData(0)
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1
    // Brown noise: the body of surf, rumble and wingbeats.
    brown = c.createBuffer(1, c.sampleRate * 4, c.sampleRate)
    const bd = brown.getChannelData(0)
    let last = 0
    for (let i = 0; i < bd.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      bd[i] = last * 3.5
    }

    // One shared hall reverb; music and one-shots send into it.
    verbIn = c.createGain()
    const verb = c.createConvolver()
    verb.buffer = impulse(2.6, 2.6)
    const verbOut = c.createGain()
    verbOut.gain.value = 0.35
    verbIn.connect(verb)
    verb.connect(verbOut)
    verbOut.connect(master)

    // Dotted-eighth-ish echo for the prologue arp.
    delayIn = c.createGain()
    const delay = c.createDelay(2)
    delay.delayTime.value = 0.47
    const fb = c.createGain()
    fb.gain.value = 0.32
    const dlp = c.createBiquadFilter()
    dlp.type = 'lowpass'
    dlp.frequency.value = 2400
    delayIn.connect(delay)
    delay.connect(dlp)
    dlp.connect(fb)
    fb.connect(delay)
    dlp.connect(musicBus)

    timer = setInterval(tick, TICK_MS)
    if (c.state === 'suspended') c.resume().catch(() => {})
    return true
  }

  // ---- radio --------------------------------------------------------------

  function parkRadio(): void {
    if (radioParked || muted) return
    try {
      if (localStorage.getItem(RADIO_MUTE_KEY) === '1') return
      const r = getRadioEngine()
      if (r.playing) { r.suspend(true); radioParked = true }
    } catch { /* no radio */ }
  }

  function unparkRadio(): void {
    if (!radioParked) return
    radioParked = false
    try {
      if (localStorage.getItem(RADIO_MUTE_KEY) === '1') return
      getRadioEngine().suspend(false)
    } catch { /* ignore */ }
  }

  function updateRadio(): void {
    if (bed || player) parkRadio()
    else unparkRadio()
  }

  // ---- building blocks -----------------------------------------------------

  function gain(value: number, dest?: AudioNode): GainNode {
    const g = ac!.createGain()
    g.gain.value = value
    if (dest) g.connect(dest)
    return g
  }

  /** A gain that drives an AudioParam: the depth of an LFO. */
  function depth(value: number, p: AudioParam): GainNode {
    const g = ac!.createGain()
    g.gain.value = value
    g.connect(p)
    return g
  }

  function filt(type: BiquadFilterType, f: number, q = 0.7, dest?: AudioNode): BiquadFilterNode {
    const b = ac!.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    if (dest) b.connect(dest)
    return b
  }

  /** Percussive envelope: quick linear rise, exponential fall. */
  function env(p: AudioParam, at: number, peak: number, attack: number, dur: number): void {
    p.setValueAtTime(0, at)
    p.linearRampToValueAtTime(peak, at + attack)
    p.exponentialRampToValueAtTime(0.0001, at + Math.max(dur, attack + 0.01))
  }

  /** Sustained envelope for pads and leads. */
  function hold(p: AudioParam, at: number, peak: number, attack: number, dur: number, release: number): void {
    p.setValueAtTime(0, at)
    p.linearRampToValueAtTime(peak, at + attack)
    p.setValueAtTime(peak, at + Math.max(attack, dur))
    p.setTargetAtTime(0, at + Math.max(attack, dur), release / 3)
  }

  function send(g: AudioNode, wet?: number): void {
    if (wet) g.connect(gain(wet, verbIn))
  }

  function tone(o: ToneOpts): OscillatorNode {
    const c = ac!
    const osc = c.createOscillator()
    osc.type = o.type ?? 'sine'
    osc.frequency.setValueAtTime(o.f, o.at)
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, o.at + (o.glide ?? o.dur))
    if (o.detune) osc.detune.setValueAtTime(o.detune, o.at)
    const g = c.createGain()
    env(g.gain, o.at, o.peak, o.attack ?? 0.005, o.dur)
    if (o.lp) osc.connect(filt('lowpass', o.lp, o.q ?? 0.7, g))
    else osc.connect(g)
    g.connect(o.dest ?? sfxBus)
    send(g, o.wet)
    const end = o.at + o.dur + 0.05
    if (o.vib) vibrato(osc, o.vib, 5.5, o.at, end)
    osc.start(o.at)
    osc.stop(end)
    return osc
  }

  function vibrato(osc: OscillatorNode, cents: number, rate: number, at: number, end: number): void {
    const l = ac!.createOscillator()
    l.frequency.value = rate
    l.connect(depth(cents, osc.detune))
    l.start(at)
    l.stop(end)
  }

  function hiss(o: HissOpts): AudioBufferSourceNode {
    const c = ac!
    const src = c.createBufferSource()
    src.buffer = o.brown ? brown : white
    src.loop = true
    const b = filt(o.type ?? 'bandpass', o.f, o.q ?? 0.8)
    b.frequency.setValueAtTime(o.f, o.at)
    if (o.to) b.frequency.exponentialRampToValueAtTime(o.to, o.at + (o.glide ?? o.dur))
    const g = c.createGain()
    env(g.gain, o.at, o.peak, o.attack ?? 0.004, o.dur)
    src.connect(b)
    b.connect(g)
    g.connect(o.dest ?? sfxBus)
    send(g, o.wet)
    src.start(o.at, Math.random() * (src.buffer.duration - 0.1))
    src.stop(o.at + o.dur + 0.05)
    return src
  }

  /** Amplitude wobble on a one-shot: gurgles, rasps, motors. */
  function wobble(p: AudioParam, rate: number, amount: number, at: number, end: number): void {
    const l = ac!.createOscillator()
    l.type = 'triangle'
    l.frequency.value = rate
    l.connect(depth(amount, p))
    l.start(at)
    l.stop(end)
  }

  /** A burst of tiny noise grains: crunch, crackle, gravel. */
  function grains(at: number, n: number, span: number, f: [number, number], peak: number, dest?: AudioNode): void {
    for (let i = 0; i < n; i++) {
      hiss({ at: at + Math.random() * span, dur: rand(0.015, 0.05), peak: peak * rand(0.5, 1), f: rand(f[0], f[1]), q: 2, dest })
    }
  }

  function thud(at: number, peak: number, f = 90, dest?: AudioNode): void {
    tone({ f, to: f * 0.4, at, dur: 0.35, peak, dest })
    hiss({ at, dur: 0.2, peak: peak * 0.6, type: 'lowpass', f: 500, to: 120, brown: true, dest })
  }

  /** Inharmonic partials with long decays: bells, chimes, clangs. */
  function bell(f: number, at: number, peak: number, dur: number, ratios: number[], dest?: AudioNode, wet = 0.5): void {
    ratios.forEach((r, i) => {
      tone({ f: f * r, at, dur: dur / (1 + i * 0.35), peak: peak / (1 + i * 0.6), dest, wet })
    })
  }

  function pad(notes: number[], at: number, dur: number, peak: number, lp: number, dest: AudioNode, attack = 0.5, release = 1.2): void {
    const c = ac!
    const g = c.createGain()
    hold(g.gain, at, peak, attack, dur, release)
    const f = filt('lowpass', lp, 0.6, g)
    g.connect(dest)
    send(g, 0.6)
    // setTargetAtTime needs ~5 time constants to reach silence without a click
    const end = at + dur + release * 1.7
    for (const m of notes) {
      for (const d of [-7, 7]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = midiHz(m)
        o.detune.value = d
        o.connect(f)
        o.start(at)
        o.stop(end)
      }
    }
  }

  // ---- ambience beds ---------------------------------------------------------

  function loopNoise(b: Bed, buf: AudioBuffer, dest: AudioNode): AudioBufferSourceNode {
    const s = ac!.createBufferSource()
    s.buffer = buf
    s.loop = true
    s.connect(dest)
    s.start(ac!.currentTime, Math.random() * (buf.duration - 0.1))
    b.sources.push(s)
    return s
  }

  function lfo(b: Bed, rate: number, amount: number, p: AudioParam, offset: number, type: OscillatorType = 'sine'): void {
    p.value = offset
    const o = ac!.createOscillator()
    o.type = type
    o.frequency.value = rate
    o.connect(depth(amount, p))
    o.start(ac!.currentTime)
    b.sources.push(o)
  }

  function partial(b: Bed, f: number, level: number, type: OscillatorType, dest: AudioNode, tremolo = 0): void {
    const o = ac!.createOscillator()
    o.type = type
    o.frequency.value = f
    const g = gain(level, dest)
    o.connect(g)
    if (tremolo) lfo(b, tremolo, level * 0.6, g.gain, level)
    o.start(ac!.currentTime)
    b.sources.push(o)
  }

  /** Surf: brown noise through a lowpass that opens as each wave swells. */
  function surf(b: Bed, rate: number, cutoff: number, level: number): void {
    const g = gain(level, b.out)
    const lp = filt('lowpass', cutoff, 0.5, g)
    loopNoise(b, brown, lp)
    lfo(b, rate, level * 0.75, g.gain, level)
    lfo(b, rate, cutoff * 0.45, lp.frequency, cutoff)
  }

  function wind(b: Bed, centre: number, q: number, level: number, rate: number): void {
    const g = gain(level, b.out)
    const bp = filt('bandpass', centre, q, g)
    loopNoise(b, white, bp)
    lfo(b, rate, centre * 0.4, bp.frequency, centre)
    lfo(b, rate * 1.37, level * 0.7, g.gain, level)
  }

  const BEDS: Record<Ambience, (b: Bed) => void> = {
    sea(b) {
      surf(b, 0.09, 750, 0.55)
      // foam: a thin high hiss on a slightly different swell, so the two drift
      const fg = gain(0.05, b.out)
      loopNoise(b, white, filt('bandpass', 3600, 0.6, fg))
      lfo(b, 0.093, 0.04, fg.gain, 0.05)
      wind(b, 650, 1.2, 0.05, 0.05)
      partial(b, 110, 0.012, 'triangle', b.out, 0.031)
      partial(b, 164.8, 0.008, 'sine', b.out, 0.043)
      b.detail = at => {
        // a bigger wave breaking further out
        hiss({ at, dur: 2.6, attack: 1.1, peak: 0.35, type: 'lowpass', f: 380, to: 900, brown: true, dest: b.out })
        return rand(7, 13)
      }
    },
    night(b) {
      surf(b, 0.06, 450, 0.45)
      wind(b, 1400, 7, 0.02, 0.03)
      // the distant drone: low fifths, one partial a few cents off so it beats
      const dg = gain(0.05, b.out)
      lfo(b, 0.04, 0.025, dg.gain, 0.05)
      partial(b, 41.2, 0.7, 'sine', dg)
      partial(b, 61.7, 0.35, 'sine', dg)
      partial(b, 82.6, 0.2, 'triangle', dg)
      b.detail = at => {
        tone({ f: 98, to: 91, at, dur: 3.2, attack: 1.2, peak: 0.05, dest: b.out })
        return rand(10, 18)
      }
    },
    hall(b) {
      const hg = gain(0.12, b.out)
      partial(b, 55, 0.8, 'sine', hg)
      partial(b, 55.4, 0.5, 'sine', hg)
      partial(b, 110, 0.25, 'sine', hg)
      partial(b, 165, 0.08, 'triangle', hg)
      const ag = gain(0.07, b.out)
      loopNoise(b, white, filt('lowpass', 900, 0.5, ag))
      lfo(b, 0.07, 0.03, ag.gain, 0.07)
      b.detail = at => {
        const f = rand(2400, 4200)
        tone({ f, at, dur: 0.08, peak: 0.05, dest: b.out })
        tone({ f: f * 1.41, at, dur: 0.05, peak: 0.02, dest: b.out })
        if (Math.random() < 0.35) tone({ f: f * 0.93, at: at + 0.14, dur: 0.07, peak: 0.035, dest: b.out })
        return rand(1.5, 5)
      }
    },
    storm(b) {
      const rg = gain(0.32, b.out)
      const hp = filt('highpass', 1200, 0.5)
      hp.connect(filt('lowpass', 7000, 0.5, rg))
      loopNoise(b, white, hp)
      lfo(b, 0.21, 0.06, rg.gain, 0.32)
      const gg = gain(0.2, b.out)
      const bp = filt('bandpass', 650, 0.9, gg)
      loopNoise(b, white, bp)
      lfo(b, 0.13, 350, bp.frequency, 650)
      lfo(b, 0.11, 0.18, gg.gain, 0.2)
      const lg = gain(0.5, b.out)
      loopNoise(b, brown, filt('lowpass', 110, 0.6, lg))
      lfo(b, 0.07, 0.3, lg.gain, 0.5)
      b.detail = at => {
        hiss({ at, dur: 4.2, attack: 1.2, peak: 0.6, type: 'lowpass', f: 140, to: 90, brown: true, dest: b.out })
        return rand(6, 14)
      }
    },
    dawn(b) {
      surf(b, 0.08, 500, 0.35)
      // D add9, sine + triangle, each voice breathing at its own rate
      const pg = gain(1, b.out)
      const lp = filt('lowpass', 1400, 0.5, pg)
      const notes: [number, number][] = [[50, 0.04], [57, 0.035], [64, 0.022], [66, 0.025], [69, 0.012]]
      notes.forEach(([m, level], i) => {
        partial(b, midiHz(m), level, i % 2 ? 'triangle' : 'sine', lp, 0.05 + i * 0.013)
        partial(b, midiHz(m) * 1.0035, level * 0.5, 'sine', lp)
      })
      b.detail = at => {
        // a seabird, far off
        const o = tone({ f: 2200, at, dur: 0.35, attack: 0.05, peak: 0.02, dest: b.out })
        o.frequency.linearRampToValueAtTime(2800, at + 0.12)
        o.frequency.linearRampToValueAtTime(2000, at + 0.33)
        return rand(10, 20)
      }
    },
  }

  function startBed(kind: Ambience): void {
    const c = ac!
    const t = c.currentTime
    const b: Bed = { kind, out: c.createGain(), sources: [], next: t + rand(3, 6) }
    b.out.gain.setValueAtTime(0, t)
    b.out.gain.linearRampToValueAtTime(1, t + XFADE)
    b.out.connect(ambBus)
    BEDS[kind](b)
    bed = b
  }

  function stopBed(b: Bed, fade = XFADE): void {
    const t = ac!.currentTime
    b.out.gain.cancelScheduledValues(t)
    b.out.gain.setValueAtTime(b.out.gain.value, t)
    b.out.gain.linearRampToValueAtTime(0, t + fade)
    for (const s of b.sources) {
      try { s.stop(t + fade + 0.1) } catch { /* already stopped */ }
    }
  }

  // ---- music cues ------------------------------------------------------------

  function kick(at: number, peak: number, dest: AudioNode): void {
    tone({ f: 120, to: 42, glide: 0.12, at, dur: 0.28, peak, dest })
  }

  function hat(at: number, peak: number, dest: AudioNode): void {
    hiss({ at, dur: 0.035, peak, type: 'highpass', f: 7000, q: 0.5, dest })
  }

  function clap(at: number, peak: number, dest: AudioNode): void {
    hiss({ at, dur: 0.18, peak, f: 1400, q: 0.9, dest, wet: 0.8 })
  }

  function bass(m: number, at: number, dur: number, peak: number, dest: AudioNode, cutoff = 520): void {
    tone({ type: 'sawtooth', f: midiHz(m), at, dur, peak, lp: cutoff, q: 4, dest })
  }

  // Prologue: A minor at 96 bpm, eight bars of sixteenth arps over a pulse
  // bass. The band comes in bar by bar; the filter opens as the ship climbs.
  const PRO_STEP = 60 / 96 / 4
  const PRO_ARP = [
    [69, 72, 76, 81], [65, 69, 72, 77], [67, 72, 76, 79], [67, 71, 74, 79],
    [69, 72, 76, 81], [65, 69, 72, 77], [62, 65, 69, 74], [64, 68, 71, 76],
  ]
  const PRO_BASS = [45, 41, 36, 43, 45, 41, 38, 40]
  const PRO_ORDER = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 3]

  const prologue: CueDef = {
    step: PRO_STEP,
    steps: 129,
    tail: 3,
    play(i, at, out) {
      const bar = Math.floor(i / 16)
      const s = i % 16
      if (i === 128) {
        pad([45, 57, 60, 64], at, 1.8, 0.03, 900, out, 0.05, 1.5)
        bass(33, at, 1.6, 0.14, out, 300)
        return
      }
      const arp = PRO_ARP[bar]!
      const cutoff = 900 + (2600 * i) / 128
      const g = gain(1, out)
      g.connect(delayIn)
      tone({ type: 'square', f: midiHz(arp[PRO_ORDER[s]!]!), at, dur: PRO_STEP * 1.6, peak: s % 4 === 0 ? 0.05 : 0.035, lp: cutoff, q: 2, dest: g })
      if (s === 0) pad(arp.slice(0, 3).map(m => m - 12), at, PRO_STEP * 15, 0.018, 1100, out, 0.4, 0.5)
      if (bar >= 2 && s % 2 === 0) bass(PRO_BASS[bar]! + (s % 8 === 6 ? 12 : 0), at, PRO_STEP * 1.8, 0.11, out)
      if (bar >= 4 && s % 4 === 0) kick(at, 0.35, out)
      if (bar >= 4 && s % 8 === 4) clap(at, 0.09, out)
      if (bar >= 3 && s % 2 === 1) hat(at, 0.02, out)
    },
  }

  // Chase: E phrygian at 150 bpm. A low saw ostinato, hats on every
  // sixteenth, a cluster stab that keeps the fear up. Loops until changed.
  const CH_STEP = 60 / 150 / 4
  const CH_OST = [0, 0, 12, 0, 0, 0, 1, 0, 0, 0, 12, 0, 3, 0, 1, 0]
  const CH_ROOT = [40, 40, 41, 39]

  const chase: CueDef = {
    step: CH_STEP,
    steps: Infinity,
    tail: 0,
    play(i, at, out) {
      const bar = Math.floor(i / 16) % 4
      const s = i % 16
      const accent = s % 4 === 0
      bass(CH_ROOT[bar]! + CH_OST[s]!, at, CH_STEP * 0.9, accent ? 0.16 : 0.11, out, accent ? 900 : 600)
      hat(at, s % 2 ? 0.035 : 0.018, out)
      if (s % 4 === 0) kick(at, 0.4, out)
      if ((bar % 2 === 0 && s === 0) || (bar === 3 && s === 10)) {
        for (const m of [64, 65, 70]) tone({ type: 'sawtooth', f: midiHz(m), at, dur: 0.28, peak: 0.045, lp: 2600, dest: out, wet: 0.3 })
      }
    },
  }

  // Capture: one dissonant stab sliding down a fifth over a low boom.
  const capture: CueDef = {
    step: 0.25,
    steps: 1,
    tail: 5,
    play(_i, at, out) {
      hiss({ at, dur: 0.25, peak: 0.3, type: 'highpass', f: 2500, dest: out })
      for (const m of [71, 72, 77, 78]) {
        tone({ type: 'sawtooth', f: midiHz(m), to: midiHz(m - 7), glide: 3.6, at, dur: 4.6, attack: 0.01, peak: 0.06, lp: 2600, dest: out, wet: 0.5 })
      }
      tone({ f: 70, to: 28, at, dur: 1.8, peak: 0.6, dest: out })
      hiss({ at, dur: 2, peak: 0.4, type: 'lowpass', f: 220, to: 80, brown: true, dest: out })
    },
  }

  // Ending: D major at 72 bpm, one step per bar. Pad, soft bass, a slow
  // triangle lead that climbs and comes home to D.
  const END_BEAT = 60 / 72
  const END_BARS: { chords: [number[], number][]; mel: [number, number][] }[] = [
    { chords: [[[50, 57, 62, 66], 4]], mel: [[66, 2], [69, 1], [74, 1]] },
    { chords: [[[47, 54, 59, 62], 4]], mel: [[73, 2], [71, 2]] },
    { chords: [[[43, 55, 59, 62], 4]], mel: [[74, 1], [71, 1], [67, 2]] },
    { chords: [[[45, 52, 57, 61], 4]], mel: [[69, 3], [64, 1]] },
    { chords: [[[42, 57, 62, 66], 4]], mel: [[66, 1], [67, 1], [69, 2]] },
    { chords: [[[43, 55, 59, 62], 4]], mel: [[71, 1], [74, 1], [76, 2]] },
    { chords: [[[40, 55, 59, 62], 2], [[45, 55, 57, 62], 1], [[45, 52, 57, 61], 1]], mel: [[74, 1], [73, 1], [71, 1], [73, 1]] },
    { chords: [[[38, 50, 57, 62, 66], 7]], mel: [[74, 7]] },
  ]

  function lead(m: number, at: number, dur: number, peak: number, dest: AudioNode): void {
    const c = ac!
    const g = c.createGain()
    hold(g.gain, at, peak, 0.08, dur - 0.05, 0.5)
    g.connect(dest)
    send(g, 0.7)
    const end = at + dur + 0.8
    const parts: [OscillatorType, number, number][] = [['triangle', 1, 1], ['sine', 2, 0.25]]
    for (const [type, mult, level] of parts) {
      const o = c.createOscillator()
      o.type = type
      o.frequency.value = midiHz(m) * mult
      o.connect(gain(level, g))
      vibrato(o, 9, 5, at + 0.3, end)
      o.start(at)
      o.stop(end)
    }
  }

  const ending: CueDef = {
    step: END_BEAT * 4,
    steps: END_BARS.length,
    tail: 9,
    play(i, at, out) {
      const bar = END_BARS[i]!
      const last = i === END_BARS.length - 1
      let t = at
      for (const [notes, beats] of bar.chords) {
        const dur = beats * END_BEAT
        pad(notes.slice(1), t, dur, last ? 0.022 : 0.018, last ? 1500 : 1100, out, last ? 0.3 : 0.7, last ? 3 : 1)
        tone({ f: midiHz(notes[0]!), at: t, dur: dur + (last ? 3 : 0.5), attack: 0.2, peak: 0.16, dest: out })
        t += dur
      }
      t = at
      for (const [m, beats] of bar.mel) {
        lead(m, t, beats * END_BEAT, 0.07, out)
        t += beats * END_BEAT
      }
      if (last) bell(midiHz(86), at, 0.03, 4, [1, 2.01, 3.02], out, 0.8)
    },
  }

  const CUES: Record<Cue, CueDef> = { prologue, chase, capture, ending }

  function stopCue(p: CuePlayer, fade: number): void {
    const t = ac!.currentTime
    p.out.gain.cancelScheduledValues(t)
    p.out.gain.setValueAtTime(p.out.gain.value, t)
    p.out.gain.linearRampToValueAtTime(0, t + fade)
    // notes already scheduled past the fade still sound into a dead gain; cut it loose
    setTimeout(() => { try { p.out.disconnect() } catch { /* gone */ } }, (fade + 0.1) * 1000)
  }

  /** The low pad that takes over when lightning cuts the prologue. */
  function omen(at: number): void {
    const c = ac!
    const g = c.createGain()
    hold(g.gain, at, 0.05, 1.2, 3.5, 2)
    const lp = filt('lowpass', 250, 1, g)
    lp.frequency.setValueAtTime(250, at)
    lp.frequency.linearRampToValueAtTime(480, at + 3)
    lp.frequency.linearRampToValueAtTime(200, at + 5.5)
    g.connect(musicBus)
    send(g, 0.6)
    for (const m of [33, 40, 46]) {
      for (const d of [-9, 9]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = midiHz(m)
        o.detune.value = d
        o.connect(lp)
        o.start(at)
        o.stop(at + 7)
      }
    }
  }

  // ---- scheduler ------------------------------------------------------------

  function tick(): void {
    if (!ac || ac.state !== 'running') return
    const now = ac.currentTime
    const p = player
    if (p) {
      // A throttled background tab: skip ahead rather than burst.
      while (p.nextAt < now - 0.1 && p.i < p.def.steps) { p.i++; p.nextAt += p.def.step }
      while (p.nextAt < now + LOOKAHEAD && p.i < p.def.steps) {
        try { p.def.play(p.i, p.nextAt, p.out) } catch { /* closed */ }
        p.i++
        p.nextAt += p.def.step
      }
      if (p.i >= p.def.steps && now > p.nextAt + p.def.tail) {
        player = null
        updateRadio()
      }
    }
    const b = bed
    if (b && b.detail && now >= b.next) {
      try { b.next = now + b.detail(now + 0.05) } catch { b.next = now + 5 }
    }
  }

  // ---- cutscene beats -------------------------------------------------------

  const BEATS: Record<Beat, (at: number) => void> = {
    engine(at) {
      const c = ac!
      const g = c.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.22, at + 2.5)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 3.3)
      const lp = filt('lowpass', 180, 3, g)
      lp.frequency.setValueAtTime(180, at)
      lp.frequency.exponentialRampToValueAtTime(1400, at + 2.8)
      g.connect(sfxBus)
      for (const [f, type] of [[55, 'sawtooth'], [55.7, 'sawtooth'], [82.5, 'square']] as [number, OscillatorType][]) {
        const o = c.createOscillator()
        o.type = type
        o.frequency.setValueAtTime(f, at)
        o.frequency.linearRampToValueAtTime(f * 1.12, at + 3)
        o.connect(lp)
        o.start(at)
        o.stop(at + 3.4)
      }
      hiss({ at, dur: 3.2, attack: 2.4, peak: 0.25, type: 'lowpass', f: 300, to: 900, brown: true })
    },
    lightning(at) {
      hiss({ at, dur: 0.12, peak: 0.9, type: 'highpass', f: 2000, q: 0.5 })
      hiss({ at: at + 0.02, dur: 0.9, peak: 0.5, type: 'lowpass', f: 9000, to: 1200, q: 0.5 })
      tone({ f: 60, to: 28, at, dur: 1.2, peak: 0.5 })
      grains(at, 10, 0.25, [3000, 8000], 0.3)
      if (player && player.name === 'prologue') {
        stopCue(player, 0.04)
        player = null
      }
      omen(at + 0.3)
    },
    fall(at) {
      tone({ f: 1600, to: 180, at, dur: 2.3, attack: 0.1, peak: 0.1, vib: 30 })
      hiss({ at, dur: 2.3, attack: 0.4, peak: 0.22, f: 1200, to: 300, q: 1.2 })
    },
    splash(at) {
      hiss({ at, dur: 0.9, peak: 0.75, type: 'lowpass', f: 5000, to: 400, q: 0.5, wet: 0.3 })
      tone({ f: 110, to: 40, at, dur: 0.5, peak: 0.5 })
      grains(at + 0.05, 14, 0.4, [1500, 5000], 0.18)
      BEATS.bubbles(at + 0.3)
    },
    bubbles(at) {
      const n = 8 + Math.floor(Math.random() * 5)
      for (let i = 0; i < n; i++) {
        const f = rand(300, 900)
        tone({ f, to: f * 1.8, at: at + Math.random() * 1.5, dur: 0.06, peak: 0.05 })
      }
    },
    wings(at) {
      for (let i = 0; i < 4; i++) {
        const t = at + i * 0.95
        hiss({ at: t, dur: 0.6, attack: 0.25, peak: 0.5, type: 'lowpass', f: 350, brown: true })
        hiss({ at: t + 0.1, dur: 0.45, attack: 0.2, peak: 0.08, f: 900, to: 500, q: 0.7 })
        tone({ f: 60, to: 45, at: t + 0.22, dur: 0.3, peak: 0.25 })
      }
    },
    flash(at) {
      tone({ type: 'square', f: 2400, to: 600, at, dur: 0.15, peak: 0.12, lp: 5000 })
      hiss({ at, dur: 0.1, peak: 0.35, type: 'highpass', f: 3000 })
      tone({ f: 3000, at, dur: 0.6, peak: 0.05, wet: 0.6 })
      // then the world drops away for a moment
      for (const bus of [ambBus, musicBus]) {
        const base = bus === ambBus ? AMB_LEVEL : MUSIC_LEVEL
        bus.gain.cancelScheduledValues(at)
        bus.gain.setValueAtTime(bus.gain.value, at)
        bus.gain.linearRampToValueAtTime(0, at + 0.06)
        bus.gain.setValueAtTime(0, at + 2.2)
        bus.gain.linearRampToValueAtTime(base, at + 3.7)
      }
    },
  }

  // ---- one-shots ------------------------------------------------------------

  function roar(at: number, dur: number, peak: number): void {
    const c = ac!
    // the throat: noise through a bandpass that opens and closes
    const src = c.createBufferSource()
    src.buffer = white
    src.loop = true
    const bp = filt('bandpass', 300, 3)
    bp.frequency.setValueAtTime(300, at)
    bp.frequency.exponentialRampToValueAtTime(1100, at + dur * 0.35)
    bp.frequency.exponentialRampToValueAtTime(380, at + dur)
    const g = c.createGain()
    env(g.gain, at, peak, dur * 0.2, dur)
    src.connect(bp)
    bp.connect(g)
    g.connect(sfxBus)
    send(g, 0.4)
    src.start(at, Math.random())
    src.stop(at + dur + 0.05)
    // the chest: a low saw growl with a fast rasp on its level
    const o = c.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(58, at)
    o.frequency.linearRampToValueAtTime(48, at + dur)
    const gg = c.createGain()
    env(gg.gain, at, peak * 0.8, dur * 0.15, dur)
    const rasp = gain(1, gg)
    o.connect(filt('lowpass', 420, 2, rasp))
    wobble(rasp.gain, 18, 0.5, at, at + dur)
    gg.connect(sfxBus)
    o.start(at)
    o.stop(at + dur + 0.05)
  }

  function zap(at: number, from: number, to: number, dur: number, peak: number, type: OscillatorType = 'square'): void {
    tone({ type, f: from, to, at, dur, peak, lp: 6000 })
    tone({ f: from * 1.5, to: to * 1.5, at, dur: dur * 0.7, peak: peak * 0.5 })
  }

  function gurgle(at: number, dur: number, peak: number): void {
    const c = ac!
    const g = c.createGain()
    env(g.gain, at, peak, 0.05, dur)
    const w = gain(1, g)
    wobble(w.gain, 11, 0.8, at, at + dur)
    const src = c.createBufferSource()
    src.buffer = brown
    src.loop = true
    src.connect(filt('lowpass', 500, 4, w))
    g.connect(sfxBus)
    src.start(at, Math.random())
    src.stop(at + dur + 0.05)
    for (let i = 0; i < 6; i++) {
      const f = rand(150, 400)
      tone({ f, to: f * 1.6, at: at + Math.random() * dur, dur: 0.07, peak: peak * 0.4 })
    }
  }

  const DEATHS: Record<DeathCause, (at: number) => void> = {
    fall(at) {
      hiss({ at, dur: 1.2, attack: 0.3, peak: 0.25, f: 900, to: 250, q: 1 })
      thud(at + 1.1, 0.25, 70)
    },
    tide(at) {
      hiss({ at, dur: 1.8, attack: 0.5, peak: 0.6, type: 'lowpass', f: 400, to: 2000, glide: 0.7, brown: true, wet: 0.3 })
      hiss({ at: at + 0.3, dur: 1.4, attack: 0.3, peak: 0.2, f: 2500, q: 0.6 })
    },
    tentacles(at) {
      gurgle(at, 1.3, 0.5)
      tone({ type: 'sawtooth', f: 45, to: 35, at, dur: 1.2, peak: 0.2, lp: 200 })
    },
    beast(at) {
      roar(at, 1.2, 0.5)
      thud(at + 0.25, 0.6, 80)
    },
    bolt(at) {
      zap(at, 900, 110, 0.25, 0.14, 'sawtooth')
      thud(at + 0.55, 0.35, 90)
    },
    leech(at) {
      hiss({ at, dur: 0.8, attack: 0.05, peak: 0.25, type: 'highpass', f: 3000 })
      tone({ f: 400, to: 90, at, dur: 0.2, peak: 0.2 })
    },
    rockfall(at) {
      grains(at, 16, 0.3, [400, 1600], 0.5)
      thud(at, 0.6, 70)
    },
  }

  type EventOf<K extends GameEvent['type']> = Extract<GameEvent, { type: K }>
  type Handlers = { [K in GameEvent['type']]: (e: EventOf<K>, at: number) => void }

  const SFX: Handlers = {
    step(_e, at) {
      hiss({ at, dur: 0.05, peak: rand(0.06, 0.1), f: rand(1200, 2200), q: 1.2 })
      tone({ f: rand(100, 140), to: 70, at, dur: 0.06, peak: 0.07 })
    },
    jump(_e, at) {
      hiss({ at, dur: 0.16, peak: 0.08, f: 600, to: 1400, q: 1 })
    },
    land(e, at) {
      if (e.hard) {
        thud(at, 0.55, 75)
        grains(at, 6, 0.08, [800, 2500], 0.2)
      } else {
        hiss({ at, dur: 0.08, peak: 0.12, type: 'lowpass', f: 900, brown: true })
        tone({ f: 110, to: 60, at, dur: 0.1, peak: 0.12 })
      }
    },
    kick(_e, at) {
      hiss({ at, dur: 0.13, peak: 0.12, f: 800, to: 2000, q: 1.2 })
    },
    kickHit(_e, at) {
      tone({ f: 300, to: 80, at, dur: 0.13, peak: 0.25 })
      hiss({ at, dur: 0.14, peak: 0.2, f: 600, to: 250, q: 5 })
    },
    splash(_e, at) {
      hiss({ at, dur: 0.5, peak: 0.35, type: 'lowpass', f: 4000, to: 500, q: 0.5 })
      grains(at + 0.03, 6, 0.25, [1500, 4000], 0.1)
    },
    stroke(_e, at) {
      hiss({ at, dur: 0.32, attack: 0.1, peak: 0.1, f: rand(800, 1000), q: 1 })
    },
    climb(_e, at) {
      hiss({ at, dur: 0.25, attack: 0.03, peak: 0.1, f: 2500, q: 2 })
      grains(at, 3, 0.2, [1500, 3000], 0.06)
    },
    tentacles(_e, at) {
      hiss({ at, dur: 2.2, attack: 1.4, peak: 0.45, type: 'lowpass', f: 150, to: 500, brown: true })
      tone({ type: 'sawtooth', f: 40, to: 70, at, dur: 2.2, attack: 1.2, peak: 0.12, lp: 260 })
      gurgle(at + 0.6, 1.5, 0.2)
    },
    leechDrop(_e, at) {
      tone({ f: 900, to: 300, at, dur: 0.08, peak: 0.12 })
      hiss({ at, dur: 0.04, peak: 0.08, f: 2000 })
    },
    leechDie(_e, at) {
      tone({ f: 500, to: 120, at, dur: 0.18, peak: 0.18 })
      hiss({ at, dur: 0.22, peak: 0.12, type: 'highpass', f: 2800 })
    },
    death(e, at) {
      DEATHS[e.cause](at)
    },
    lamp(e, at) {
      const f = midiHz(76)
      bell(f, at, 0.1, 2.2, [1, 1.5, 2, 3.01])
      if (e.final) {
        bell(midiHz(64), at + 0.12, 0.1, 4.5, [1, 1.5, 2, 2.52, 3.01])
        tone({ f: midiHz(40), at, dur: 4, attack: 1.2, peak: 0.2, wet: 0.6 })
        ;[76, 81, 83, 88, 93].forEach((m, i) => tone({ type: 'triangle', f: midiHz(m), at: at + 0.4 + i * 0.12, dur: 1.4, peak: 0.05, wet: 0.8 }))
      }
    },
    shot(_e, at) {
      zap(at, 1800, 400, 0.12, 0.12)
    },
    beam(_e, at) {
      tone({ f: 180, to: 40, at, dur: 0.55, peak: 0.6 })
      tone({ type: 'sawtooth', f: 90, to: 60, at, dur: 0.45, peak: 0.12, lp: 1400 })
      hiss({ at, dur: 0.6, peak: 0.4, type: 'lowpass', f: 3000, to: 200, q: 0.6, wet: 0.4 })
    },
    charge(_e, at) {
      tone({ type: 'sawtooth', f: 300, to: 1400, at, dur: 0.9, attack: 0.3, peak: 0.05, lp: 3000, vib: 25 })
      tone({ f: 600, to: 2800, at, dur: 0.9, attack: 0.3, peak: 0.04 })
    },
    chargeFull(_e, at) {
      tone({ f: 1760, at, dur: 0.18, peak: 0.08 })
      tone({ f: 2640, at: at + 0.04, dur: 0.16, peak: 0.05 })
    },
    shield(e, at) {
      const base = e.owner === 'player' ? 220 : 150
      tone({ f: base, to: base * 2, glide: 0.1, at, dur: 0.35, peak: 0.12, vib: 40 })
      tone({ type: 'square', f: base * 2, at, dur: 0.3, peak: 0.03, lp: 1800 })
    },
    shieldHit(_e, at) {
      bell(1200, at, 0.08, 0.3, [1, 1.44], sfxBus, 0.2)
      hiss({ at, dur: 0.04, peak: 0.15, type: 'highpass', f: 4000 })
    },
    shieldBreak(_e, at) {
      grains(at, 22, 0.4, [3000, 7000], 0.12)
      for (let i = 0; i < 5; i++) tone({ f: rand(2500, 5000), at: at + Math.random() * 0.3, dur: 0.12, peak: 0.04 })
      tone({ f: 440, to: 110, at, dur: 0.3, peak: 0.1 })
    },
    bolt(_e, at) {
      tone({ type: 'sawtooth', f: 700, to: 120, at, dur: 0.22, peak: 0.12, lp: 2200, q: 6 })
      tone({ type: 'square', f: 180, to: 70, at, dur: 0.2, peak: 0.06, lp: 900 })
    },
    guardAlert(_e, at) {
      // two syllables of an alien bark: a saw through two moving formants
      const c = ac!
      for (const [t, f0, fA, fB] of [[0, 140, 700, 1200], [0.16, 118, 420, 900]] as number[][]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f0!, at + t!)
        o.frequency.linearRampToValueAtTime(f0! * 0.85, at + t! + 0.15)
        const g = c.createGain()
        env(g.gain, at + t!, 0.3, 0.01, 0.15)
        o.connect(filt('bandpass', fA!, 6, g))
        o.connect(filt('bandpass', fB!, 8, g))
        g.connect(sfxBus)
        o.start(at + t!)
        o.stop(at + t! + 0.2)
      }
    },
    guardDie(_e, at) {
      tone({ type: 'sawtooth', f: 160, to: 50, at, dur: 0.6, peak: 0.12, lp: 700, q: 5 })
      thud(at + 0.45, 0.35, 85)
    },
    beastRoar(_e, at) {
      roar(at, 2.4, 0.55)
    },
    beastPounce(_e, at) {
      hiss({ at, dur: 0.3, peak: 0.25, f: 400, to: 2000, q: 1 })
      roar(at + 0.1, 0.5, 0.35)
      thud(at + 0.3, 0.55, 80)
    },
    rockfall(_e, at) {
      hiss({ at, dur: 1.2, attack: 0.2, peak: 0.4, type: 'lowpass', f: 200, brown: true })
      grains(at, 14, 1, [500, 2500], 0.2)
    },
    rockLand(_e, at) {
      thud(at, 0.7, 80)
      grains(at, 10, 0.25, [400, 1800], 0.3)
    },
    door(_e, at) {
      thud(at, 0.5, 70)
      hiss({ at: at + 0.05, dur: 1.2, attack: 0.1, peak: 0.35, f: 200, to: 400, q: 2, brown: true })
      tone({ type: 'sawtooth', f: 45, to: 52, at, dur: 1.2, peak: 0.08, lp: 300 })
      bell(180, at + 1.25, 0.15, 0.6, [1, 2.7, 4.1])
    },
    lift(_e, at) {
      const c = ac!
      const g = c.createGain()
      hold(g.gain, at, 0.08, 0.3, 2.2, 0.3)
      const w = gain(1, g)
      wobble(w.gain, 6, 0.3, at, at + 2.7)
      const lp = filt('lowpass', 600, 2, w)
      g.connect(sfxBus)
      for (const f of [80, 120]) {
        const o = c.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(f * 0.9, at)
        o.frequency.linearRampToValueAtTime(f, at + 0.4)
        o.connect(lp)
        o.start(at)
        o.stop(at + 2.7)
      }
      bell(220, at + 2.5, 0.1, 0.4, [1, 2.4])
    },
    cageCreak(_e, at) {
      const o = tone({ type: 'sawtooth', f: rand(80, 110), at, dur: 0.5, attack: 0.1, peak: 0.1, lp: rand(800, 1100), q: 12 })
      o.frequency.linearRampToValueAtTime(rand(70, 130), at + 0.45)
    },
    cageSnap(_e, at) {
      hiss({ at, dur: 0.06, peak: 0.6, type: 'highpass', f: 2500 })
      tone({ type: 'triangle', f: 400, to: 100, at, dur: 0.4, peak: 0.2 })
    },
    cageCrash(_e, at) {
      thud(at, 0.7, 70)
      grains(at, 12, 0.3, [600, 3000], 0.3)
      bell(320, at, 0.2, 1.2, [1, 1.58, 2.44, 3.3])
    },
    gun(_e, at) {
      ;[76, 83, 88].forEach((m, i) => tone({ type: 'triangle', f: midiHz(m), at: at + i * 0.07, dur: 0.5, peak: 0.08, wet: 0.5 }))
      tone({ f: midiHz(95), at: at + 0.21, dur: 0.6, peak: 0.03, wet: 0.7 })
    },
    thunder(_e, at) {
      hiss({ at, dur: 0.1, peak: 0.8, type: 'highpass', f: 1800, q: 0.5 })
      grains(at, 8, 0.2, [2000, 6000], 0.3)
      const c = ac!
      const g = c.createGain()
      g.gain.setValueAtTime(0, at)
      g.gain.linearRampToValueAtTime(0.7, at + 0.3)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 4.2)
      const w = gain(1, g)
      wobble(w.gain, 1.7, 0.4, at, at + 4.2)
      const src = c.createBufferSource()
      src.buffer = brown
      src.loop = true
      src.connect(filt('lowpass', 180, 0.8, w))
      g.connect(sfxBus)
      send(g, 0.3)
      src.start(at, Math.random())
      src.stop(at + 4.3)
    },
    buddy(_e, at) {
      tone({ type: 'triangle', f: midiHz(72), at, dur: 0.35, attack: 0.05, peak: 0.07, lp: 1400, vib: 15, wet: 0.5 })
      tone({ type: 'triangle', f: midiHz(67), at: at + 0.32, dur: 0.5, attack: 0.05, peak: 0.07, lp: 1400, vib: 15, wet: 0.5 })
    },
    chapter(e, at) {
      // a low bell, a step lower each chapter until the dawn
      const m = [45, 43, 41, 40, 50][e.chapter - 1] ?? 45
      bell(midiHz(m), at, 0.06, 5, [1, 2, 2.4, 3], sfxBus, 0.8)
    },
    cut() {
      // the cut itself is silent
    },
  }

  // ---- public ---------------------------------------------------------------

  return {
    unlock() {
      if (!ensure()) return
      if (wanted && !bed) {
        startBed(wanted)
        updateRadio()
      }
    },

    setMuted(m) {
      muted = m
      if (m) unparkRadio()
      else updateRadio()
      if (!ac) return
      master.gain.setTargetAtTime(m ? 0 : MASTER_LEVEL, ac.currentTime, 0.02)
    },

    event(e) {
      if (!ac || muted || e.type === 'cut') return
      const now = nowMs()
      if (e.type === 'step') {
        if (now - lastStep < 90) return
        lastStep = now
      }
      const key = JSON.stringify(e)
      if (now - (lastPlayed.get(key) ?? -1e9) < 30) return
      lastPlayed.set(key, now)
      try {
        (SFX[e.type] as (e: GameEvent, at: number) => void)(e, ac.currentTime + 0.005)
      } catch { /* context closed */ }
    },

    ambience(kind) {
      wanted = kind
      if (!ac) return
      if (bed && bed.kind === kind) return
      try {
        if (bed) stopBed(bed)
        bed = null
        if (kind) startBed(kind)
      } catch { bed = null }
      updateRadio()
    },

    cue(name) {
      if (!ac) return
      if (player && name && player.name === name) return
      try {
        if (player) stopCue(player, name === 'capture' ? 0.05 : 0.3)
        player = null
        if (name) {
          const out = gain(1, musicBus)
          player = { name, def: CUES[name], out, i: 0, nextAt: ac.currentTime + 0.05 }
          tick()
        }
      } catch { player = null }
      updateRadio()
    },

    beat(name) {
      // runs while muted too: lightning must still cut the prologue
      if (!ac) return
      try { BEATS[name](ac.currentTime + 0.01) } catch { /* closed */ }
      if (name === 'lightning') updateRadio()
    },

    suspend(on) {
      if (!ac) return
      if (on) ac.suspend().catch(() => {})
      else ac.resume().catch(() => {})
    },

    dispose() {
      if (timer) { clearInterval(timer); timer = null }
      bed = null
      wanted = null
      player = null
      lastPlayed.clear()
      unparkRadio()
      if (ac) ac.close().catch(() => {})
      ac = null
    },
  }
}
