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
 *
 * Mix (2026-09-15): stereo field (pad wide, arp left, hats right, ping-pong
 * delay), kick-ducked pad bus, gentle master compressor, exponential-decay
 * reverb tail. Arrangement: crash on every second loop start, snare fill
 * into the loop restart at tier ≥ 2, open-hat shimmer and an octave-jumping
 * arp at tier 3, swing on the laid-back stations.
 */
import { TRACKS as GALAGA_TRACKS, intensityVoices, transposeFor, thirdFor, hz } from '../galaga/audio'
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
  swing?: number
}

const SEQ_TRACKS: readonly SeqTrack[] = [...GALAGA_TRACKS, ...OUTRUN_TRACKS]

const NOTE: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, Bb: 10, B: 11,
}

function midi(name: string): number {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name)
  if (!m) return -1
  const semi = NOTE[m[1]]!
  if (semi === undefined) return -1
  return 12 * (Number(m[2]) + 1) + semi
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
  let padBus: GainNode
  let noise: AudioBuffer
  let reverb: ConvolverNode
  let delayL: DelayNode
  let delayR: DelayNode
  let station = -1
  let step = 0
  let nextTime = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let lead: number[] = []
  let tier: 0 | 1 | 2 | 3 = 3
  let bossMode = false

  /** Pan a voice, falling back to mono where StereoPanner is missing. */
  function panTo(node: AudioNode, value: number, dest: AudioNode): void {
    if (!ac) return
    if (typeof ac.createStereoPanner === 'function') {
      const p = ac.createStereoPanner()
      p.pan.value = value
      node.connect(p)
      p.connect(dest)
    } else {
      node.connect(dest)
    }
  }

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
    master.gain.value = 0.9
    if (typeof ac.createDynamicsCompressor === 'function') {
      const comp = ac.createDynamicsCompressor()
      comp.threshold.value = -16
      comp.knee.value = 24
      comp.ratio.value = 4
      comp.attack.value = 0.003
      comp.release.value = 0.22
      master.connect(comp)
      comp.connect(ac.destination)
    } else {
      master.connect(ac.destination)
    }
    musicBus = ac.createGain()
    musicBus.gain.value = 0.3
    musicBus.connect(master)
    // The pads live on their own bus so the kick can duck them.
    padBus = ac.createGain()
    padBus.gain.value = 0.9
    padBus.connect(musicBus)
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    reverb = ac.createConvolver()
    const len = Math.floor(ac.sampleRate * 1.4)
    const ir = ac.createBuffer(2, len, ac.sampleRate)
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c)
      for (let i = 0; i < len; i++) {
        const t = i / len
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8) * 0.5
      }
    }
    reverb.buffer = ir
    const revGain = ac.createGain()
    revGain.gain.value = 0.3
    reverb.connect(revGain)
    revGain.connect(musicBus)
    // Ping-pong dotted-eighth: lead feeds left, the channels cross-feed.
    delayL = ac.createDelay(1)
    delayR = ac.createDelay(1)
    const fb = ac.createGain()
    fb.gain.value = 0.34
    const wetL = ac.createGain()
    wetL.gain.value = 0.22
    const wetR = ac.createGain()
    wetR.gain.value = 0.22
    delayL.connect(fb)
    fb.connect(delayR)
    delayR.connect(fb)
    fb.connect(delayL)
    panTo(delayL, -0.6, wetL)
    panTo(delayR, 0.6, wetR)
    wetL.connect(musicBus)
    wetR.connect(musicBus)
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

  /** Kick ducking: the pads breathe around each kick hit. */
  function duckPad(at: number): void {
    if (!ac) return
    padBus.gain.setTargetAtTime(0.6, at, 0.012)
    padBus.gain.setTargetAtTime(0.9, at + 0.1, 0.09)
  }

  function bassVoice(m: number, at: number, dur: number, vol: number): void {
    if (!ac || m < 0) return
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(850, at)
    lp.frequency.exponentialRampToValueAtTime(220, at + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(vol, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    lp.connect(g)
    g.connect(musicBus)
    for (const [type, mult] of [['sawtooth', 1], ['square', 0.5]] as const) {
      const o = ac.createOscillator()
      o.type = type
      o.frequency.value = hz(m) * mult
      o.connect(lp)
      o.start(at)
      o.stop(at + dur + 0.05)
    }
  }

  function arpVoice(m: number, at: number, dur: number, vol: number): void {
    if (!ac || m < 0) return
    const o = ac.createOscillator()
    o.type = 'square'
    o.frequency.value = hz(m)
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2600, at)
    lp.frequency.exponentialRampToValueAtTime(900, at + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(vol, at + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(lp)
    lp.connect(g)
    panTo(g, -0.25, musicBus)
    o.start(at)
    o.stop(at + dur + 0.05)
  }

  /** Wide detuned pad pair with a soft attack (no click on bar starts). */
  function padChord(notes: readonly number[], at: number, dur: number): void {
    if (!ac) return
    for (const n of notes) {
      if (n < 0) continue
      // One chain per side: the detune lives in the stereo difference,
      // so the pad reads wide instead of dual-mono.
      for (const [detune, pan] of [[-7, -0.35], [7, 0.35]] as const) {
        const o = ac.createOscillator()
        o.type = 'sawtooth'
        o.frequency.value = hz(n)
        o.detune.value = detune
        const lp = ac.createBiquadFilter()
        lp.type = 'lowpass'
        lp.frequency.value = 1200
        const g = ac.createGain()
        g.gain.setValueAtTime(0, at)
        g.gain.linearRampToValueAtTime(0.035, at + 0.4)
        g.gain.setTargetAtTime(0.0001, at + dur * 0.75, dur * 0.2)
        o.connect(lp)
        lp.connect(g)
        panTo(g, pan, padBus)
        o.start(at)
        o.stop(at + dur + 0.3)
      }
    }
  }

  /** Lead: square dry + detuned saw into the ping-pong, gentle vibrato. */
  function leadVoice(m: number, at: number, dur: number, vol: number): void {
    if (!ac || m < 0) return
    const dry = ac.createOscillator()
    dry.type = 'square'
    dry.frequency.value = hz(m)
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(3200, at)
    lp.frequency.exponentialRampToValueAtTime(900, at + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(0, at)
    g.gain.linearRampToValueAtTime(vol, at + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    dry.connect(lp)
    lp.connect(g)
    g.connect(musicBus)
    const wet = ac.createOscillator()
    wet.type = 'sawtooth'
    wet.frequency.value = hz(m)
    wet.detune.value = 5
    const wg = ac.createGain()
    wg.gain.setValueAtTime(0, at)
    wg.gain.linearRampToValueAtTime(vol * 0.5, at + 0.012)
    wg.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    wet.connect(wg)
    wg.connect(delayL)
    // Vibrato fades in after the attack so stabs stay centered.
    const lfo = ac.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 5.5
    const depth = ac.createGain()
    depth.gain.setValueAtTime(0, at)
    depth.gain.linearRampToValueAtTime(6, at + 0.18)
    lfo.connect(depth)
    depth.connect(dry.detune)
    depth.connect(wet.detune)
    for (const o of [dry, wet]) {
      o.start(at)
      o.stop(at + dur + 0.05)
    }
    lfo.start(at)
    lfo.stop(at + dur + 0.05)
  }

  function kick(at: number, accent: number): void {
    if (!ac) return
    const o = ac.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(160, at)
    o.frequency.exponentialRampToValueAtTime(40, at + 0.11)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.65 * accent, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.26)
    o.connect(g)
    g.connect(musicBus)
    o.start(at)
    o.stop(at + 0.3)
    // Click transient so the kick reads on small speakers.
    const src = noiseSource(false)
    const f = ac.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 4000
    const cg = ac.createGain()
    cg.gain.setValueAtTime(0.16 * accent, at)
    cg.gain.exponentialRampToValueAtTime(0.0001, at + 0.02)
    src.connect(f)
    f.connect(cg)
    cg.connect(musicBus)
    src.start(at)
    src.stop(at + 0.05)
  }

  function snare(at: number, accent: number): void {
    if (!ac) return
    const src = noiseSource(false)
    const f = ac.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 1800
    const g = ac.createGain()
    g.gain.setValueAtTime(0.3 * accent, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
    src.connect(f)
    f.connect(g)
    g.connect(musicBus)
    g.connect(reverb)
    const o = ac.createOscillator()
    o.type = 'triangle'
    o.frequency.value = 190
    const g2 = ac.createGain()
    g2.gain.setValueAtTime(0.2 * accent, at)
    g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
    o.connect(g2)
    g2.connect(musicBus)
    // Stick snap.
    const snap = ac.createOscillator()
    snap.type = 'triangle'
    snap.frequency.value = 340
    const g3 = ac.createGain()
    g3.gain.setValueAtTime(0.12 * accent, at)
    g3.gain.exponentialRampToValueAtTime(0.0001, at + 0.04)
    snap.connect(g3)
    g3.connect(musicBus)
    src.start(at)
    src.stop(at + 0.2)
    o.start(at)
    o.stop(at + 0.15)
    snap.start(at)
    snap.stop(at + 0.08)
  }

  function hat(at: number, accent: number, open = false): void {
    if (!ac) return
    const src = noiseSource(false)
    const f = ac.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 7500
    const g = ac.createGain()
    const dur = open ? 0.28 : 0.035
    g.gain.setValueAtTime((open ? 0.07 : 0.11) * accent, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    src.connect(f)
    f.connect(g)
    panTo(g, 0.3, musicBus)
    src.start(at)
    src.stop(at + dur + 0.03)
  }

  function crash(at: number): void {
    if (!ac) return
    const src = noiseSource(false)
    const f = ac.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 4500
    const g = ac.createGain()
    g.gain.setValueAtTime(0.2, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1)
    src.connect(f)
    f.connect(g)
    g.connect(musicBus)
    g.connect(reverb)
    src.start(at)
    src.stop(at + 1.2)
  }

  function schedule(): void {
    if (!ac || station < 0) return
    const tr = SEQ_TRACKS[station]!
    const stepDur = 60 / tr.bpm / 4
    const swing = tr.swing ?? 0
    const v = intensityVoices(tier)
    const transpose = transposeFor(bossMode)
    const loopLen = tr.bars.length * 16
    const full = tier === 3
    while (nextTime < ac.currentTime + 0.14) {
      const s16 = step % 16
      const bar = Math.floor(step / 16) % tr.bars.length
      const barDef = tr.bars[bar]!
      const at = nextTime + (s16 % 2 === 1 ? swing * stepDur : 0)
      const downbeat = s16 === 0
      // Crash on every second loop start — the loop restart gets a lift.
      if (step % loopLen === 0 && Math.floor(step / loopLen) % 2 === 1 && tier >= 2) crash(at)
      if (tr.kick[s16] === 'x') {
        kick(at, downbeat ? 1 : 0.85)
        duckPad(at)
      }
      if (v.snare && tr.snare[s16] === 'x') snare(at, s16 === 4 || s16 === 12 ? 1 : 0.8)
      // Fill into the loop restart: rising 16th roll over the last bar.
      if (tier >= 2 && bar === tr.bars.length - 1 && s16 >= 12) {
        snare(at, 0.55 + (s16 - 12) * 0.15)
      }
      if (tr.hat[s16] === 'x') hat(at, s16 % 4 === 2 ? 1.3 : 0.85)
      else if (full && s16 % 4 === 2) hat(at, 0.9, true)
      const bch = tr.bass[s16]
      if (v.bass && bch && bch !== '.') {
        const off = bch === 'R' ? 0 : bch === 'o' ? 12 : bch === '5' ? 7 : bch === '3' ? thirdFor(barDef) : bch === '7' ? 10 : 0
        bassVoice(barDef.root + off + transpose, at, stepDur * 1.8, downbeat ? 0.2 : 0.16)
      }
      if (v.arp && tr.arp) {
        const arpNote = barDef.chord[(s16 * (bossMode ? 2 : 1)) % barDef.chord.length]! + transpose + 12
        arpVoice(arpNote, at, stepDur * 0.9, 0.05)
        // Tier 3 shimmer: a soft octave-up echo on every other 16th.
        if (full && s16 % 2 === 1) arpVoice(arpNote + 12, at, stepDur * 0.7, 0.028)
      }
      if (tr.pad && s16 === 0) {
        padChord(barDef.chord.map(n => n + transpose), at, stepDur * 16)
      }
      const li = step % lead.length
      const ln = lead[li]
      if (v.lead && ln !== undefined && ln >= 0) {
        leadVoice(ln + transpose, at, stepDur * 1.5, downbeat ? 0.085 : 0.07)
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
        // Soft relaunch instead of a hard gain reset — no click on switch.
        musicBus.gain.setTargetAtTime(0.3, ac.currentTime, 0.03)
        padBus.gain.setTargetAtTime(0.9, ac.currentTime, 0.03)
      } catch {
        // context gone
      }
    }
    station = i
    step = 0
    lead = parseLead(SEQ_TRACKS[i]!.lead)
    nextTime = ac!.currentTime + 0.06
    const dotted = 60 / SEQ_TRACKS[i]!.bpm * 0.75
    delayL.delayTime.value = dotted
    delayR.delayTime.value = dotted
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
