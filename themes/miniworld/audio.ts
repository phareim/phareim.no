/**
 * Mini World — audio (2026-09-26). Synthesised Web Audio, no samples.
 *
 * Music: the tunes live in `audioScore.ts` as note data; a 40 ms lookahead
 * scheduler compiles one bar at a time and places each note a little
 * before it sounds. `setMusic` crossfades: the old track keeps playing
 * while it fades out, the new one fades in. Sound effects are small
 * recipes, one per `MiniSfx` name; `magic` has one per weapon magic.
 *
 * Silent until `unlock()` runs inside a user gesture (iOS). SSR-safe:
 * nothing touches window or AudioContext before then. The site radio is
 * held silent while Mini World is open (the theme is `ownRadio`) and
 * released in `dispose()`, like Neon Shrine does (docs/games/global-radio.md).
 */
import type { MiniAudio, MiniMusic, MiniSfx } from './scene/contracts'
import type { WeaponMagicId } from './types'
import { getRadioEngine } from '../radio/engine'
import { MUTE_KEY as RADIO_MUTE_KEY } from '../radio/catalog'
import { SECTIONS, STEPS, TRACKS, compileBar, hz, type NoteEv, type TrackId, type Voice } from './audioScore'

export const MUTE_KEY = 'miniworld.muted'

const MASTER = 0.8
const MUSIC = 0.34
const SFX = 0.6
const TICK_MS = 40
/** How far ahead notes are placed (seconds). */
const AHEAD = 0.15
/** Crossfade: time constant of the ramps and when the old track is dropped. */
const FADE_TC = 0.3
const FADE_DROP = 1.6

interface Player {
  id: TrackId
  out: GainNode
  /** Position in the form. */
  sec: number
  bar: number
  pass: number
  /** Downbeat of the bar in `events`. */
  barAt: number
  events: NoteEv[]
  ei: number
  /** When a fading player is dropped (Infinity while it plays). */
  dropAt: number
}

export interface MiniAudioDebug {
  ctx: AudioContext | null
  track: TrackId | null
  fading: number
  muted: boolean
  radioHeld: boolean
}

function readMuted(): boolean {
  try { return typeof window !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

export function createMiniAudio(): MiniAudio & { debug(): MiniAudioDebug } {
  let ac: AudioContext | null = null
  let master!: GainNode
  let musicBus!: GainNode
  let sfxBus!: GainNode
  let verb!: ConvolverNode
  let verbSend!: GainNode
  let noise!: AudioBuffer
  let timer: ReturnType<typeof setInterval> | null = null

  let muted = readMuted()
  let disposed = false
  let hidden = false
  let radioHeld = false
  let want: MiniMusic = 'off'
  let current: Player | null = null
  const fading: Player[] = []
  const lastSfx = new Map<string, number>()

  const client = () => typeof window !== 'undefined'

  // ---- the radio --------------------------------------------------------------

  function holdRadio(): void {
    if (radioHeld || !client()) return
    try { getRadioEngine().hold(true); radioHeld = true } catch { /* no radio */ }
  }

  function releaseRadio(): void {
    if (!radioHeld) return
    radioHeld = false
    try {
      const r = getRadioEngine()
      r.hold(false)
      let radioMuted = false
      try { radioMuted = localStorage.getItem(RADIO_MUTE_KEY) === '1' } catch { /* none */ }
      if (r.playing && !radioMuted) r.suspend(false)
    } catch { /* ignore */ }
  }

  holdRadio()

  // ---- the graph ----------------------------------------------------------------

  function impulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
    const len = Math.max(1, Math.floor(c.sampleRate * seconds))
    const b = c.createBuffer(2, len, c.sampleRate)
    let seed = 7
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch)
      for (let i = 0; i < len; i++) {
        seed = (seed * 16807) % 2147483647
        d[i] = ((seed / 2147483647) * 2 - 1) * Math.pow(1 - i / len, decay)
      }
    }
    return b
  }

  function ensure(): boolean {
    if (disposed || !client()) return false
    if (ac) return true
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const Ctor = w.AudioContext || w.webkitAudioContext
    if (!Ctor) return false
    try { ac = new Ctor() } catch { ac = null; return false }
    const c = ac
    const comp = c.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 12
    comp.ratio.value = 3
    comp.attack.value = 0.006
    comp.release.value = 0.25
    comp.connect(c.destination)
    master = c.createGain()
    master.gain.value = muted ? 0 : MASTER
    master.connect(comp)
    musicBus = c.createGain()
    musicBus.gain.value = MUSIC
    musicBus.connect(master)
    sfxBus = c.createGain()
    sfxBus.gain.value = SFX
    sfxBus.connect(master)
    verb = c.createConvolver()
    verb.buffer = impulse(c, 1.6, 3)
    const ret = c.createGain()
    ret.gain.value = 0.35
    verb.connect(ret)
    ret.connect(master)
    verbSend = c.createGain()
    verbSend.gain.value = 1
    verbSend.connect(verb)
    noise = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate)), c.sampleRate)
    const d = noise.getChannelData(0)
    let seed = 3
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647
      d[i] = (seed / 2147483647) * 2 - 1
    }
    timer = setInterval(tick, TICK_MS)
    return true
  }

  // ---- building blocks ------------------------------------------------------------

  /** A gain with a quick attack and an exponential-ish decay to silence. */
  function env(t: number, peak: number, attack: number, dur: number, dest: AudioNode): GainNode {
    const c = ac!
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(peak, t + attack)
    g.gain.setTargetAtTime(0, t + attack, Math.max(0.01, dur / 4))
    g.connect(dest)
    return g
  }

  function osc(type: OscillatorType, f: number, t: number, end: number, dest: AudioNode, f2?: number, glide?: number): OscillatorNode {
    const o = ac!.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f, t)
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + (glide ?? end - t))
    o.connect(dest)
    o.start(t)
    o.stop(end)
    return o
  }

  function filt(type: BiquadFilterType, f: number, dest: AudioNode, q = 0.7): BiquadFilterNode {
    const n = ac!.createBiquadFilter()
    n.type = type
    n.frequency.value = f
    n.Q.value = q
    n.connect(dest)
    return n
  }

  /** A blip: one oscillator, optional pitch glide, short envelope. */
  function blip(t: number, f: number, dur: number, vol: number, type: OscillatorType = 'sine', f2?: number, dest: AudioNode = sfxBus): void {
    const g = env(t, vol, 0.004, dur, dest)
    osc(type, f, t, t + dur + 0.05, g, f2, dur)
  }

  /** Filtered noise, optional filter sweep. */
  function hiss(t: number, dur: number, vol: number, type: BiquadFilterType, f: number, f2?: number, dest: AudioNode = sfxBus, q = 0.9): void {
    const c = ac!
    const src = c.createBufferSource()
    src.buffer = noise
    const g = env(t, vol, 0.004, dur, dest)
    const fl = filt(type, f, g, q)
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur)
    src.connect(fl)
    src.start(t, 0)
    src.stop(t + dur + 0.05)
  }

  /** One pitched note in a voice, to `dest` (a player's bus or the sfx bus). */
  function voice(v: Voice, midi: number, t: number, len: number, vel: number, dest: AudioNode, send = 0.25): void {
    const c = ac!
    const f = hz(midi)
    const g = c.createGain()
    g.connect(dest)
    if (send > 0) {
      const s = c.createGain()
      s.gain.value = send
      g.connect(s)
      s.connect(verbSend)
    }
    const p = g.gain
    p.setValueAtTime(0, t)
    switch (v) {
      case 'marimba': {
        p.linearRampToValueAtTime(0.5 * vel, t + 0.004)
        p.setTargetAtTime(0, t + 0.004, 0.14)
        osc('sine', f, t, t + 0.9, g)
        const h = c.createGain()
        h.gain.setValueAtTime(0.35 * vel, t)
        h.gain.setTargetAtTime(0, t, 0.02)
        h.connect(dest)
        osc('sine', f * 4, t, t + 0.15, h)
        break
      }
      case 'bell':
      case 'musicbox': {
        const box = v === 'musicbox'
        p.linearRampToValueAtTime((box ? 0.32 : 0.28) * vel, t + 0.003)
        p.setTargetAtTime(0, t + 0.003, box ? 0.28 : 0.45)
        osc('sine', f, t, t + 2, g)
        const h = c.createGain()
        h.gain.setValueAtTime((box ? 0.12 : 0.1) * vel, t)
        h.gain.setTargetAtTime(0, t, box ? 0.05 : 0.12)
        h.connect(dest)
        osc('sine', f * (box ? 3 : 2.76), t, t + 0.6, h)
        break
      }
      case 'flute': {
        const d = Math.max(0.12, len)
        p.linearRampToValueAtTime(0.26 * vel, t + 0.05)
        p.setValueAtTime(0.26 * vel, t + d * 0.8)
        p.linearRampToValueAtTime(0, t + d + 0.12)
        const lp = filt('lowpass', f * 3, g)
        const o = osc('triangle', f, t, t + d + 0.2, lp)
        o.detune.setValueAtTime(0, t)
        o.detune.linearRampToValueAtTime(8, t + d)
        break
      }
      case 'pluck': {
        p.linearRampToValueAtTime(0.22 * vel, t + 0.003)
        p.setTargetAtTime(0, t + 0.003, 0.12)
        const lp = filt('lowpass', f * 6, g)
        lp.frequency.setTargetAtTime(f * 1.5, t, 0.08)
        osc('sawtooth', f, t, t + 0.7, lp)
        break
      }
      case 'square': {
        const d = Math.max(0.1, len * 0.85)
        p.linearRampToValueAtTime(0.12 * vel, t + 0.005)
        p.setTargetAtTime(0.08 * vel, t + 0.01, 0.08)
        p.setTargetAtTime(0, t + d, 0.03)
        const lp = filt('lowpass', 2600, g)
        osc('square', f, t, t + d + 0.2, lp)
        break
      }
      case 'brass': {
        const d = Math.max(0.15, len)
        p.linearRampToValueAtTime(0.2 * vel, t + 0.04)
        p.setTargetAtTime(0.15 * vel, t + 0.05, 0.1)
        p.setTargetAtTime(0, t + d, 0.06)
        const lp = filt('lowpass', f * 1.5, g)
        lp.frequency.setValueAtTime(f * 1.5, t)
        lp.frequency.linearRampToValueAtTime(f * 4, t + 0.06)
        lp.frequency.setTargetAtTime(f * 2.5, t + 0.06, 0.15)
        osc('sawtooth', f, t, t + d + 0.4, lp)
        break
      }
      case 'bass': {
        const d = Math.max(0.1, len)
        p.linearRampToValueAtTime(0.42 * vel, t + 0.008)
        p.setTargetAtTime(0.3 * vel, t + 0.01, 0.15)
        p.setTargetAtTime(0, t + d, 0.04)
        osc('triangle', f, t, t + d + 0.25, g)
        break
      }
      case 'pad': {
        const d = Math.max(0.3, len)
        p.linearRampToValueAtTime(0.06 * vel, t + Math.min(0.4, d / 3))
        p.setValueAtTime(0.06 * vel, t + d * 0.85)
        p.linearRampToValueAtTime(0, t + d + 0.3)
        const lp = filt('lowpass', 1400, g)
        osc('triangle', f, t, t + d + 0.35, lp)
        osc('sine', f * 1.003, t, t + d + 0.35, lp)
        break
      }
      default:
        break
    }
  }

  function drum(v: Voice, t: number, vel: number, dest: AudioNode): void {
    switch (v) {
      case 'kick': {
        const g = env(t, 0.55 * vel, 0.002, 0.18, dest)
        osc('sine', 130, t, t + 0.3, g, 45, 0.12)
        break
      }
      case 'tom': {
        const g = env(t, 0.45 * vel, 0.003, 0.35, dest)
        osc('sine', 110, t, t + 0.5, g, 70, 0.3)
        break
      }
      case 'snare':
        hiss(t, 0.12, 0.22 * vel, 'bandpass', 1800, undefined, dest, 0.8)
        blip(t, 220, 0.06, 0.12 * vel, 'triangle', 160, dest)
        break
      case 'clap':
        hiss(t, 0.1, 0.24 * vel, 'bandpass', 1400, undefined, dest, 1.2)
        break
      case 'hat':
        hiss(t, 0.04, 0.12 * vel, 'highpass', 7000, undefined, dest)
        break
      case 'shaker':
        hiss(t, 0.05, 0.09 * vel, 'highpass', 5000, undefined, dest)
        break
      case 'tick':
        blip(t, 1800, 0.03, 0.08 * vel, 'sine', undefined, dest)
        break
      default:
        break
    }
  }

  // ---- music ----------------------------------------------------------------------

  const DRUM_VOICES = new Set<Voice>(['kick', 'snare', 'clap', 'hat', 'shaker', 'tick', 'tom'])
  const eighth = (p: Player) => 30 / TRACKS[p.id].bpm

  function loadBar(p: Player): void {
    const t = TRACKS[p.id]
    p.events = compileBar(p.id, t.form[p.sec], p.bar, p.pass)
    p.ei = 0
  }

  function advance(p: Player): void {
    const t = TRACKS[p.id]
    p.barAt += STEPS * eighth(p)
    p.bar++
    if (p.bar >= SECTIONS[t.form[p.sec]].chords.length) {
      p.bar = 0
      p.sec++
      if (p.sec >= t.form.length) { p.sec = 0; p.pass++ }
    }
    loadBar(p)
  }

  function startPlayer(id: TrackId, at: number): Player {
    const c = ac!
    const out = c.createGain()
    out.gain.setValueAtTime(0, c.currentTime)
    out.gain.setTargetAtTime(TRACKS[id].level, at, FADE_TC)
    out.connect(musicBus)
    const p: Player = { id, out, sec: 0, bar: 0, pass: 0, barAt: at, events: [], ei: 0, dropAt: Infinity }
    loadBar(p)
    return p
  }

  function schedule(p: Player, until: number): void {
    const c = ac!
    // After a stall (a suspended context, a slow tab) skip ahead rather than pile notes up.
    if (p.barAt + STEPS * eighth(p) < c.currentTime - 0.1) {
      while (p.barAt + STEPS * eighth(p) < c.currentTime) advance(p)
    }
    const e8 = eighth(p)
    const swing = TRACKS[p.id].swing
    for (let guard = 0; guard < 256; guard++) {
      if (p.ei >= p.events.length) { advance(p); continue }
      const ev = p.events[p.ei]
      const lean = Math.floor(ev.step) % 2 === 1 && ev.step % 1 === 0 ? swing : 0
      const t = p.barAt + (ev.step + lean) * e8
      if (t >= until) break
      p.ei++
      if (t < c.currentTime - 0.02 || muted || hidden) continue
      const at = Math.max(t, c.currentTime)
      if (DRUM_VOICES.has(ev.voice)) drum(ev.voice, at, ev.vel, p.out)
      else voice(ev.voice, ev.midi, at, ev.len * e8, ev.vel, p.out, ev.voice === 'bass' ? 0 : 0.25)
    }
  }

  function tick(): void {
    if (!ac || disposed) return
    const now = ac.currentTime
    const until = now + AHEAD
    if (current) schedule(current, until)
    for (let i = fading.length - 1; i >= 0; i--) {
      const p = fading[i]
      if (now >= p.dropAt) {
        try { p.out.disconnect() } catch { /* gone */ }
        fading.splice(i, 1)
      } else schedule(p, until)
    }
    if (lastSfx.size > 64) lastSfx.clear()
  }

  function applyMusic(): void {
    if (!ac) return
    const id = want === 'off' ? null : want as TrackId
    if (current?.id === id) return
    const now = ac.currentTime
    if (current) {
      const old = current
      old.out.gain.cancelScheduledValues(now)
      old.out.gain.setTargetAtTime(0, now, FADE_TC)
      old.dropAt = now + FADE_DROP
      fading.push(old)
      // Never more than two tracks fading at once.
      while (fading.length > 2) {
        const gone = fading.shift()!
        try { gone.out.disconnect() } catch { /* gone */ }
      }
      current = null
    }
    if (id) current = startPlayer(id, now + 0.08)
  }

  // ---- sound effects --------------------------------------------------------------

  /** A run of notes in one voice to the sfx bus. */
  function run(t: number, midis: number[], gap: number, v: Voice, vel = 1, len = 0.15): void {
    midis.forEach((m, i) => voice(v, m, t + i * gap, len, vel, sfxBus, 0.3))
  }

  let seed = 11
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }

  const MAGIC: Record<WeaponMagicId, (t: number) => void> = {
    bubbles: t => {
      for (let i = 0; i < 4; i++) {
        const f = 380 + rnd() * 380
        blip(t + i * 0.055, f, 0.09, 0.18, 'sine', f * 2.2)
      }
    },
    stars: t => run(t, [88, 91, 93, 96], 0.04, 'bell', 0.9),
    hearts: t => {
      voice('marimba', 72, t, 0.2, 0.8, sfxBus)
      voice('marimba', 79, t + 0.12, 0.2, 0.9, sfxBus)
      blip(t + 0.12, 520, 0.3, 0.1, 'triangle', 660)
    },
    confetti: t => {
      for (let i = 0; i < 6; i++) hiss(t + rnd() * 0.25, 0.03, 0.18, 'highpass', 3000 + rnd() * 3000)
      voice('bell', 91, t + 0.05, 0.2, 0.6, sfxBus)
    },
    rainbow: t => run(t, [72, 74, 76, 79, 81, 84, 88], 0.035, 'musicbox', 0.7),
    snow: t => {
      hiss(t, 0.35, 0.06, 'highpass', 4000, 8000)
      for (let i = 0; i < 3; i++) blip(t + 0.05 + i * 0.08, 1800 + rnd() * 900, 0.4, 0.06, 'sine')
    },
    lightning: t => {
      hiss(t, 0.2, 0.2, 'bandpass', 4000, 700, sfxBus, 1.5)
      blip(t, 1200, 0.16, 0.05, 'square', 220)
      voice('bell', 84, t + 0.1, 0.2, 0.5, sfxBus)
    },
    flowers: t => run(t, [72, 76, 79, 81, 84], 0.05, 'pluck', 0.8),
    dragon: t => {
      const g = env(t, 0.2, 0.03, 0.35, sfxBus)
      const lp = filt('lowpass', 700, g, 2)
      lp.frequency.linearRampToValueAtTime(1600, t + 0.3)
      osc('sawtooth', 110, t, t + 0.5, lp, 240, 0.3)
      hiss(t, 0.3, 0.12, 'lowpass', 900, 2400)
    },
  }

  const RECIPES: Record<MiniSfx, (t: number, magic?: WeaponMagicId) => void> = {
    jump: t => blip(t, 330, 0.14, 0.22, 'sine', 700),
    land: t => { blip(t, 170, 0.08, 0.2, 'sine', 90); hiss(t, 0.06, 0.08, 'lowpass', 500) },
    bounce: t => { blip(t, 200, 0.32, 0.22, 'triangle', 820); blip(t + 0.02, 400, 0.2, 0.06, 'sine', 1400) },
    splash: t => {
      hiss(t, 0.4, 0.22, 'bandpass', 1400, 400, sfxBus, 0.6)
      for (let i = 0; i < 3; i++) blip(t + 0.05 + i * 0.07, 900 + rnd() * 700, 0.07, 0.08, 'sine', 1800)
    },
    respawn: t => { hiss(t, 0.3, 0.07, 'bandpass', 600, 3000); run(t + 0.05, [72, 76, 79, 84], 0.06, 'bell', 0.8) },
    checkpoint: t => run(t, [79, 84], 0.09, 'bell', 1, 0.3),
    finish: t => { run(t, [72, 76, 79, 84, 88], 0.08, 'marimba', 1); run(t + 0.4, [84, 88, 91], 0, 'bell', 0.7, 0.8) },
    star: t => { run(t, [88, 95], 0.05, 'bell', 0.9); hiss(t, 0.15, 0.03, 'highpass', 8000) },
    coin: t => { blip(t, hz(83), 0.05, 0.12, 'triangle'); blip(t + 0.06, hz(88), 0.25, 0.12, 'triangle') },
    pop: t => { blip(t, 620, 0.06, 0.22, 'sine', 160); hiss(t, 0.03, 0.12, 'highpass', 2500) },
    magic: (t, m) => (m && MAGIC[m] ? MAGIC[m] : MAGIC.stars)(t),
    door: t => { voice('marimba', 55, t, 0.2, 0.9, sfxBus); voice('marimba', 60, t + 0.1, 0.2, 0.9, sfxBus); hiss(t, 0.25, 0.05, 'lowpass', 900, 300) },
    sit: t => { hiss(t, 0.15, 0.1, 'lowpass', 700, 250); blip(t, 200, 0.12, 0.12, 'sine', 140) },
    click: t => blip(t, 1200, 0.03, 0.1, 'sine'),
    open: t => run(t, [72, 79], 0.06, 'marimba', 0.8),
    close: t => run(t, [79, 72], 0.06, 'marimba', 0.7),
    buy: t => { RECIPES.coin(t); run(t + 0.14, [84, 88, 91], 0, 'bell', 0.6, 0.5) },
    poor: t => { blip(t, hz(64), 0.14, 0.14, 'triangle', hz(63)); blip(t + 0.15, hz(60), 0.22, 0.14, 'triangle', hz(59)) },
    equip: t => { hiss(t, 0.12, 0.1, 'highpass', 3500, 7000); run(t + 0.03, [84, 91], 0.05, 'bell', 0.7) },
    dress: t => { hiss(t, 0.22, 0.12, 'bandpass', 700, 2600, sfxBus, 1.2); run(t + 0.15, [91, 96], 0.05, 'bell', 0.5) },
    place: t => { voice('marimba', 60, t, 0.2, 1, sfxBus); hiss(t, 0.05, 0.08, 'lowpass', 600) },
    pick: t => run(t, [67, 72], 0.05, 'marimba', 0.8),
    rotate: t => { blip(t, 900, 0.03, 0.08); blip(t + 0.06, 1200, 0.03, 0.08) },
    store: t => { hiss(t, 0.18, 0.07, 'bandpass', 2000, 500); run(t + 0.05, [72, 67], 0.07, 'marimba', 0.7) },
    upgrade: t => { run(t, [72, 76, 79, 84, 88, 91], 0.05, 'bell', 0.8); hiss(t + 0.25, 0.3, 0.04, 'highpass', 7000) },
    flip: t => { hiss(t, 0.05, 0.1, 'bandpass', 2200); blip(t, 700, 0.025, 0.05) },
    match: t => { run(t, [88, 91], 0.08, 'bell', 0.9, 0.3); voice('marimba', 76, t, 0.2, 0.6, sfxBus) },
    win: t => { run(t, [72, 76, 79, 84, 88, 91], 0.07, 'marimba', 0.9); run(t + 0.45, [84, 88, 91], 0, 'bell', 0.6, 1) },
    fanfare: t => {
      run(t, [67, 72, 76], 0.1, 'brass', 0.9, 0.09)
      voice('brass', 79, t + 0.3, 0.6, 1, sfxBus, 0.3)
      voice('brass', 84, t + 0.3, 0.6, 0.7, sfxBus, 0.3)
    },
    gift: t => { for (let i = 0; i < 5; i++) voice('bell', [84, 86, 88, 91, 93][Math.floor(rnd() * 5)] + (i > 2 ? 12 : 0), t + i * 0.07, 0.2, 0.6, sfxBus, 0.35) },
    crown: t => { RECIPES.fanfare(t); run(t + 0.5, [91, 95, 98], 0.05, 'bell', 0.6, 0.5) },
    judge: t => voice('bell', 91, t, 0.3, 0.9, sfxBus, 0.35),
  }

  // ---- the page -------------------------------------------------------------------

  function onVisibility(): void {
    hidden = typeof document !== 'undefined' && !!document.hidden
    if (!ac || disposed) return
    if (hidden) ac.suspend().catch(() => {})
    else if (!muted) ac.resume().catch(() => {})
  }
  const canWatch = client() && typeof document !== 'undefined' && typeof document.addEventListener === 'function'
  if (canWatch) document.addEventListener('visibilitychange', onVisibility)

  // ---- the interface --------------------------------------------------------------

  return {
    unlock() {
      if (disposed || !client()) return
      holdRadio()
      const fresh = !ac
      if (!ensure() || !ac) return
      const c = ac
      if (fresh) {
        // iOS: a silent buffer played inside the gesture opens the audio path.
        try {
          const b = c.createBuffer(1, 1, c.sampleRate)
          const s = c.createBufferSource()
          s.buffer = b
          s.connect(c.destination)
          s.start(0)
        } catch { /* ignore */ }
        applyMusic()
      }
      if (c.state === 'suspended' && !muted && !hidden) c.resume().catch(() => {})
    },

    setMusic(track: MiniMusic) {
      if (disposed || track === want) return
      want = track
      applyMusic()
    },

    sfx(name: MiniSfx, opts?: { magic?: WeaponMagicId }) {
      if (!ac || disposed || muted || hidden) return
      const key = name === 'magic' ? `magic:${opts?.magic ?? ''}` : name
      const now = ac.currentTime
      const prev = lastSfx.get(key)
      if (prev !== undefined && now - prev < 0.03) return
      lastSfx.set(key, now)
      const r = RECIPES[name]
      if (!r) return
      try { r(now + 0.005, opts?.magic) } catch { /* a bad recipe never breaks the game */ }
    },

    setMuted(m: boolean) {
      if (disposed) return
      muted = m
      try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* private mode */ }
      if (!ac) return
      master.gain.cancelScheduledValues(ac.currentTime)
      master.gain.setTargetAtTime(m ? 0 : MASTER, ac.currentTime, 0.03)
      if (m) ac.suspend().catch(() => {})
      else if (!hidden) ac.resume().catch(() => {})
    },

    get muted() { return muted },

    dispose() {
      if (disposed) return
      disposed = true
      if (timer !== null) clearInterval(timer)
      timer = null
      if (canWatch) document.removeEventListener('visibilitychange', onVisibility)
      current = null
      fading.length = 0
      if (ac) ac.close().catch(() => {})
      ac = null
      releaseRadio()
    },

    debug(): MiniAudioDebug {
      return { ctx: ac, track: current?.id ?? null, fading: fading.length, muted, radioHeld }
    },
  }
}
