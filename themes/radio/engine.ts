/**
 * The global radio engine — one Web Audio sequencer for the whole site.
 *
 * Galaga and OutRun used to build near-identical music graphs (master bus,
 * shared noise, gated reverb, dotted-eighth delay, 25 ms / 0.14 s lookahead
 * scheduler) inside their own per-game audio objects, which were disposed on
 * theme switch — so the music always died at the pager. This module keeps a
 * single module-level instance behind `getRadioEngine()` that is created on
 * the first user gesture and never disposed by a theme unmount. Games drive
 * it (station, intensity) and keep only their SFX / engine-sound contexts
 * local.
 *
 * Track data is imported, not copied: `STATIONS` in `catalog.ts` decides the
 * order, the `TRACKS` arrays in the game audio modules own the notes.
 */
import { TRACKS as GALAGA_TRACKS, intensityVoices, transposeFor, hz } from '../galaga/audio'
import { TRACKS as OUTRUN_TRACKS } from '../outrun/audio'
import { STATIONS } from './catalog'

interface SeqTrack {
  bpm: number
  bars: readonly { root: number; chord: readonly number[] }[]
  bass: string
  lead: readonly string[]
  kick: string
  snare: string
  hat: string
  arp: boolean
  pad: boolean
}

const SEQ_TRACKS: readonly SeqTrack[] = [...GALAGA_TRACKS, ...OUTRUN_TRACKS]

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, Bb: 10, B: 11 }

function midi(name: string): number {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name)
  if (!m) return -1
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]]!
}

/** Lead lines parsed to 16th steps: [midi or -1 rest or -2 hold]. */
function parseLead(bars: readonly string[]): number[] {
  const out: number[] = []
  for (const bar of bars) {
    for (const tok of bar.trim().split(/\s+/)) {
      const v = tok === '-' ? -2 : tok === '.' ? -1 : midi(tok)
      out.push(v, -2)
    }
  }
  return out
}

export type RadioEngine = ReturnType<typeof createRadioEngine>

function createRadioEngine() {
  let ac: AudioContext | null = null
  let master: GainNode
  let musicBus: GainNode
  let noise: AudioBuffer
  let reverb: ConvolverNode
  let delay: DelayNode
  let station = -1
  let step = 0
  let nextTime = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let lead: number[] = []
  let tier: 0 | 1 | 2 | 3 = 3
  let bossMode = false

  function ensure(): boolean {
    if (ac) {
      if (ac.state === 'suspended') ac.resume().catch(() => {})
      return true
    }
    const Ctor = typeof window !== 'undefined'
      ? (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      : null
    if (!Ctor) return false
    try {
      ac = new Ctor()
    } catch {
      return false
    }
    master = ac.createGain()
    master.gain.value = 0.8
    master.connect(ac.destination)
    musicBus = ac.createGain()
    musicBus.gain.value = 0.3
    musicBus.connect(master)
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    reverb = ac.createConvolver()
    const len = Math.floor(ac.sampleRate * 0.9)
    const ir = ac.createBuffer(2, len, ac.sampleRate)
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c)
      for (let i = 0; i < len; i++) {
        const t = i / len
        ch[i] = (Math.random() * 2 - 1) * (t < 0.55 ? 1 - t * 0.6 : Math.max(0, (1 - t) * 1.4)) * 0.5
      }
    }
    reverb.buffer = ir
    const revGain = ac.createGain()
    revGain.gain.value = 0.35
    reverb.connect(revGain)
    revGain.connect(musicBus)
    delay = ac.createDelay(1)
    const fb = ac.createGain()
    fb.gain.value = 0.32
    const wet = ac.createGain()
    wet.gain.value = 0.3
    delay.connect(fb)
    fb.connect(delay)
    delay.connect(wet)
    wet.connect(musicBus)
    if (ac.state === 'suspended') ac.resume().catch(() => {})
    return true
  }

  function noiseSource(loop = true): AudioBufferSourceNode {
    const src = ac!.createBufferSource()
    src.buffer = noise
    src.loop = loop
    if (loop) src.loopStart = Math.random()
    return src
  }

  function voice(m: number, at: number, dur: number, type: OscillatorType, vol: number): void {
    if (!ac || m < 0) return
    const t = at
    const o = ac.createOscillator()
    o.type = type
    o.frequency.value = hz(m)
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3200, t)
    lp.frequency.exponentialRampToValueAtTime(500, t + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(lp)
    lp.connect(g)
    g.connect(musicBus)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  function drum(kind: 'k' | 's' | 'h', at: number): void {
    if (!ac) return
    if (kind === 'k') {
      const o = ac.createOscillator()
      o.type = 'sine'
      o.frequency.setValueAtTime(150, at)
      o.frequency.exponentialRampToValueAtTime(42, at + 0.12)
      const g = ac.createGain()
      g.gain.setValueAtTime(0.5, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14)
      o.connect(g)
      g.connect(musicBus)
      o.start(at)
      o.stop(at + 0.2)
    } else if (kind === 's') {
      const src = noiseSource(false)
      const f = ac.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = 1800
      const g = ac.createGain()
      g.gain.setValueAtTime(0.3, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
      src.connect(f)
      f.connect(g)
      g.connect(musicBus)
      g.connect(reverb)
      const o = ac.createOscillator()
      o.type = 'triangle'
      o.frequency.value = 185
      const g2 = ac.createGain()
      g2.gain.setValueAtTime(0.18, at)
      g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
      o.connect(g2)
      g2.connect(musicBus)
      src.start(at)
      src.stop(at + 0.2)
      o.start(at)
      o.stop(at + 0.15)
    } else {
      const src = noiseSource(false)
      const f = ac.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = 7000
      const g = ac.createGain()
      g.gain.setValueAtTime(0.12, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04)
      src.connect(f)
      f.connect(g)
      g.connect(musicBus)
      src.start(at)
      src.stop(at + 0.08)
    }
  }

  function schedule(): void {
    if (!ac || station < 0) return
    const tr = SEQ_TRACKS[station]!
    const stepDur = 60 / tr.bpm / 4
    const v = intensityVoices(tier)
    const transpose = transposeFor(bossMode)
    while (nextTime < ac.currentTime + 0.14) {
      const s16 = step % 16
      const bar = Math.floor(step / 16) % tr.bars.length
      const barDef = tr.bars[bar]!
      const at = nextTime
      if (tr.kick[s16] === 'x') drum('k', at)
      if (v.snare && tr.snare[s16] === 'x') drum('s', at)
      if (tr.hat[s16] === 'x') drum('h', at)
      const bch = tr.bass[s16]
      if (v.bass && bch && bch !== '.') {
        const off = bch === 'R' ? 0 : bch === 'o' ? -12 : bch === '5' ? 7 : 0
        voice(barDef.root + off + transpose, at, stepDur * 1.8, 'sawtooth', 0.16)
      }
      if (v.arp && tr.arp) {
        const arpNote = barDef.chord[(s16 * (bossMode ? 2 : 1)) % barDef.chord.length]! + transpose + 12
        voice(arpNote, at, stepDur * 0.9, 'square', 0.05)
      }
      if (tr.pad && s16 === 0) {
        for (const n of barDef.chord) voice(n + transpose, at, stepDur * 16, 'sawtooth', 0.035)
      }
      const li = step % lead.length
      const ln = lead[li]
      if (v.lead && ln !== undefined && ln >= 0) {
        voice(ln + transpose, at, stepDur * 1.5, 'square', 0.07)
        const o = ac.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = hz(ln + transpose)
        const g = ac.createGain()
        g.gain.setValueAtTime(0.03, at)
        g.gain.exponentialRampToValueAtTime(0.0001, at + stepDur * 1.5)
        o.connect(g)
        g.connect(delay)
        o.start(at)
        o.stop(at + stepDur * 1.5 + 0.05)
      }
      nextTime += stepDur
      step++
    }
  }

  /** Create/resume the context. Must run inside a user gesture. */
  function start(): boolean {
    return ensure()
  }

  /**
   * Start station i, restarting the loop from the top — unless it is
   * already playing, in which case this only resumes the context (so a
   * theme switch mid-song does not restart the track).
   */
  function playStation(i: number): void {
    if (!ensure() || i < 0 || i >= STATIONS.length) return
    if (station === i && timer) return
    stopScheduler()
    if (ac) {
      try {
        musicBus.gain.cancelScheduledValues(ac.currentTime)
        musicBus.gain.setValueAtTime(0.3, ac.currentTime)
      } catch {
        // context gone
      }
    }
    station = i
    step = 0
    lead = parseLead(SEQ_TRACKS[i]!.lead)
    nextTime = ac!.currentTime + 0.06
    delay.delayTime.value = 60 / SEQ_TRACKS[i]!.bpm * 0.75
    timer = setInterval(schedule, 25)
  }

  function stopScheduler(): void {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  /** Galaga drives this per wave (tier) and per boss (transpose +2). */
  function setIntensity(t: 0 | 1 | 2 | 3, boss: boolean): void {
    tier = t
    bossMode = boss
  }

  /** OutRun never thins the band: full intensity, no transpose. */
  function setFull(): void {
    tier = 3
    bossMode = false
  }

  function suspend(on: boolean): void {
    if (!ac) return
    if (on) ac.suspend().catch(() => {})
    else ac.resume().catch(() => {})
  }

  /** Only for tests/HMR — themes never dispose the shared radio. */
  function dispose(): void {
    stopScheduler()
    station = -1
    if (ac) ac.close().catch(() => {})
    ac = null
  }

  return {
    start,
    playStation,
    setIntensity,
    setFull,
    suspend,
    dispose,
    get station() { return station },
    /** True once a context exists (it may still be suspended). */
    get started() { return ac !== null },
    get playing() { return timer !== null },
  }
}

let instance: RadioEngine | null = null

/** The site-wide music engine. Stable across theme switches by design. */
export function getRadioEngine(): RadioEngine {
  if (!instance) instance = createRadioEngine()
  return instance
}
