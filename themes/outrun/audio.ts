/**
 * OutRun audio — everything synthesised with Web Audio, no samples.
 *
 * - Engine: two detuned saws and a square sub through a soft clipper and a
 *   low-pass that opens with throttle and revs; a square LFO at half the
 *   engine note gives the firing pulse. Revs come from the engine state, so
 *   the gearbox is heard as the note drops at each upshift.
 * - Tyres, wind and dirt: looped noise through band/low-pass filters, gains
 *   driven by skid, speed² and off-road.
 * - One-shots for crashes, bumps, close passes, checkpoints, the countdown,
 *   the low-time warning, TIME UP and the goal.
 * - The radio: three original synthwave loops on a small step sequencer
 *   (bass, pad, arpeggio, lead with a dotted-eighth delay, drums through a
 *   short gated reverb). Chosen on the SELECT MUSIC screen, M cycles.
 *
 * Nothing starts before a user gesture (`start()` is called from the key or
 * tap that begins a run); a browser that refuses audio just stays quiet.
 */

export interface EngineInput {
  rpm: number
  throttle: number
  speed: number
  gear: number
  skid: number
  offroad: boolean
  running: boolean
}

interface Track {
  name: string
  bpm: number
  /** Per bar: chord root for the bass (midi) and the triad for pad/arp. */
  bars: { root: number, chord: number[] }[]
  bass: string
  lead: string[]
  kick: string
  snare: string
  hat: string
  arp: boolean
  pad: boolean
}

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, Bb: 10, B: 11 }
function midi(name: string): number {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name)
  if (!m) return -1
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]]
}
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12)

export const TRACKS: readonly Track[] = [
  {
    name: 'MIDNIGHT SHOWER',
    bpm: 124,
    bars: [
      { root: 41, chord: [53, 57, 60] }, { root: 43, chord: [55, 59, 62] }, { root: 40, chord: [52, 55, 59] }, { root: 45, chord: [57, 60, 64] },
      { root: 41, chord: [53, 57, 60] }, { root: 43, chord: [55, 59, 62] }, { root: 45, chord: [57, 60, 64] }, { root: 45, chord: [57, 60, 64] },
    ],
    bass: 'R.R.o.R.R.R.o.R.',
    lead: [
      'C5 . A4 C5 - D5 C5 A4', 'B4 . G4 B4 - D5 E5 D5', 'E5 - - D5 B4 - G4 B4', 'A4 - - - . E4 A4 C5',
      'C5 . A4 C5 - F5 E5 C5', 'D5 . B4 D5 - G5 F5 D5', 'E5 - D5 C5 - B4 C5 -', 'A4 - - - - - . .',
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    arp: true,
    pad: true,
  },
  {
    name: 'PASSING NEON',
    bpm: 102,
    bars: [
      { root: 38, chord: [50, 53, 57] }, { root: 34, chord: [46, 50, 53] }, { root: 41, chord: [53, 57, 60] }, { root: 36, chord: [48, 52, 55] },
      { root: 38, chord: [50, 53, 57] }, { root: 34, chord: [46, 50, 53] }, { root: 43, chord: [55, 58, 62] }, { root: 45, chord: [57, 61, 64] },
    ],
    bass: 'R..R..R.o..R.5..',
    lead: [
      'A4 - - F4 - D4 F4 G4', 'A4 - - - . F4 G4 A4', 'C5 - A4 - G4 - F4 -', 'E4 - - - G4 - - .',
      'A4 - - F4 - D5 C5 A4', 'Bb4 - A4 - G4 - F4 G4', 'G4 - Bb4 - D5 - C5 Bb4', 'A4 - - - C#5 - E5 -',
    ],
    kick: 'x......x..x.....',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    arp: false,
    pad: true,
  },
  {
    name: 'SPLASH GRID',
    bpm: 136,
    bars: [
      { root: 40, chord: [52, 55, 59] }, { root: 36, chord: [48, 52, 55] }, { root: 43, chord: [55, 59, 62] }, { root: 38, chord: [50, 54, 57] },
      { root: 40, chord: [52, 55, 59] }, { root: 36, chord: [48, 52, 55] }, { root: 38, chord: [50, 54, 57] }, { root: 35, chord: [47, 51, 54] },
    ],
    bass: 'RoRoRoRoRoRoRoRo',
    lead: [
      'E5 - G5 - F#5 E5 D5 -', 'E5 - - - B4 - C5 D5', 'D5 - B4 - G4 - B4 D5', 'F#5 - - E5 D5 - A4 -',
      'E5 - G5 - B5 - A5 G5', 'G5 - E5 - C5 - E5 G5', 'F#5 - D5 - A4 - D5 F#5', 'D#5 - - - F#5 - B4 -',
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x..x',
    hat: 'xxxxxxxxxxxxxxxx',
    arp: true,
    pad: false,
  },
]

export const TRACK_NAMES = TRACKS.map(t => t.name)

/** Lead lines parsed to 16th steps: [midi or -1 rest or -2 hold]. */
function parseLead(bars: string[]): number[] {
  const out: number[] = []
  for (const bar of bars) {
    for (const tok of bar.trim().split(/\s+/)) {
      const v = tok === '-' ? -2 : tok === '.' ? -1 : midi(tok)
      out.push(v, -2)
    }
  }
  return out
}

export function createAudio() {
  let ac: AudioContext | null = null
  let master: GainNode
  let sfx: GainNode
  let musicBus: GainNode
  let noise: AudioBuffer
  let reverb: ConvolverNode
  let delay: DelayNode
  let enabled = true
  // Engine graph.
  let eng: {
    o1: OscillatorNode, o2: OscillatorNode, o3: OscillatorNode, lfo: OscillatorNode
    lp: BiquadFilterNode, gain: GainNode, trem: GainNode
    squeal: GainNode, squealBp: BiquadFilterNode, whistle: OscillatorNode, whistleGain: GainNode
    wind: GainNode, windLp: BiquadFilterNode, dirt: GainNode
  } | null = null
  // Sequencer.
  let track = -1
  let step = 0
  let nextTime = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let lead: number[] = []

  function ensure(): boolean {
    if (!enabled) return false
    if (ac) {
      if (ac.state === 'suspended') ac.resume().catch(() => {})
      return true
    }
    const Ctor = typeof window !== 'undefined' ? (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) : null
    if (!Ctor) return false
    try {
      ac = new Ctor()
    } catch {
      return false
    }
    master = ac.createGain()
    master.gain.value = 0.8
    master.connect(ac.destination)
    sfx = ac.createGain()
    sfx.gain.value = 0.7
    sfx.connect(master)
    musicBus = ac.createGain()
    musicBus.gain.value = 0.32
    musicBus.connect(master)
    // Two seconds of white noise, shared by every noise voice.
    noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate)
    const d = noise.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    // A short, bright, gated reverb (the 1985 snare), built from decaying noise.
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

  function buildEngine() {
    if (!ac || eng) return
    const t = ac.currentTime
    const o1 = ac.createOscillator()
    o1.type = 'sawtooth'
    const o2 = ac.createOscillator()
    o2.type = 'sawtooth'
    o2.detune.value = 14
    const o3 = ac.createOscillator()
    o3.type = 'square'
    const g3 = ac.createGain()
    g3.gain.value = 0.55
    const shaper = ac.createWaveShaper()
    const curve = new Float32Array(512)
    for (let i = 0; i < 512; i++) {
      const x = (i / 511) * 2 - 1
      curve[i] = Math.tanh(x * 2.2)
    }
    shaper.curve = curve
    const trem = ac.createGain()
    trem.gain.value = 0.72
    const lfo = ac.createOscillator()
    lfo.type = 'square'
    const lfoGain = ac.createGain()
    lfoGain.gain.value = 0.25
    lfo.connect(lfoGain)
    lfoGain.connect(trem.gain)
    const lp = ac.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 4
    const gain = ac.createGain()
    gain.gain.value = 0
    const mixer = ac.createGain()
    mixer.gain.value = 0.3
    o1.connect(mixer)
    o2.connect(mixer)
    o3.connect(g3)
    g3.connect(mixer)
    mixer.connect(shaper)
    shaper.connect(trem)
    trem.connect(lp)
    lp.connect(gain)
    gain.connect(sfx)

    // Tyres: a narrow noise band plus a wavering whistle.
    const sq = noiseSource()
    const squealBp = ac.createBiquadFilter()
    squealBp.type = 'bandpass'
    squealBp.frequency.value = 2300
    squealBp.Q.value = 9
    const squeal = ac.createGain()
    squeal.gain.value = 0
    sq.connect(squealBp)
    squealBp.connect(squeal)
    const whistle = ac.createOscillator()
    whistle.type = 'triangle'
    whistle.frequency.value = 1050
    const whistleGain = ac.createGain()
    whistleGain.gain.value = 0
    whistle.connect(whistleGain)
    whistleGain.connect(squeal)
    squeal.connect(sfx)
    // Wind.
    const wn = noiseSource()
    const windLp = ac.createBiquadFilter()
    windLp.type = 'lowpass'
    windLp.frequency.value = 600
    const wind = ac.createGain()
    wind.gain.value = 0
    wn.connect(windLp)
    windLp.connect(wind)
    wind.connect(sfx)
    // Dirt rumble.
    const dn = noiseSource()
    const dirtLp = ac.createBiquadFilter()
    dirtLp.type = 'lowpass'
    dirtLp.frequency.value = 220
    const dirt = ac.createGain()
    dirt.gain.value = 0
    dn.connect(dirtLp)
    dirtLp.connect(dirt)
    dirt.connect(sfx)

    for (const n of [o1, o2, o3, lfo, whistle]) n.start(t)
    sq.start(t)
    wn.start(t)
    dn.start(t)
    eng = { o1, o2, o3, lfo, lp, gain, trem, squeal, squealBp, whistle, whistleGain, wind, windLp, dirt }
  }

  function updateEngine(e: EngineInput) {
    if (!ac || !enabled) return
    if (!eng) buildEngine()
    if (!eng) return
    const t = ac.currentTime
    const k = 0.04
    const f = 42 + e.rpm * 118 + e.gear * 7
    eng.o1.frequency.setTargetAtTime(f, t, 0.03)
    eng.o2.frequency.setTargetAtTime(f, t, 0.03)
    eng.o3.frequency.setTargetAtTime(f / 2, t, 0.03)
    eng.lfo.frequency.setTargetAtTime(f / 2, t, 0.03)
    eng.lp.frequency.setTargetAtTime(260 + e.throttle * 1300 + e.rpm * 900, t, k)
    eng.gain.gain.setTargetAtTime(e.running ? 0.12 + e.throttle * 0.13 : 0, t, 0.08)
    const sk = e.running ? e.skid : 0
    eng.squeal.gain.setTargetAtTime(sk * 0.3, t, 0.05)
    eng.whistleGain.gain.setTargetAtTime(sk * 0.05, t, 0.05)
    eng.whistle.frequency.setTargetAtTime(950 + Math.sin(t * 13) * 90, t, 0.02)
    eng.squealBp.frequency.setTargetAtTime(2100 + Math.sin(t * 9) * 250, t, 0.02)
    eng.wind.gain.setTargetAtTime(e.running ? e.speed * e.speed * 0.09 : 0, t, 0.1)
    eng.windLp.frequency.setTargetAtTime(400 + e.speed * 1400, t, 0.1)
    eng.dirt.gain.setTargetAtTime(e.running && e.offroad ? 0.2 + e.speed * 0.5 : 0, t, 0.05)
  }

  // ------------------------------------------------------------ one-shots

  function tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, dest?: AudioNode, slideTo?: number) {
    if (!ac) return
    const t = ac.currentTime + at
    const o = ac.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(dest ?? sfx)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  function burst(dur: number, vol: number, fromHz: number, toHz: number, at = 0, type: BiquadFilterType = 'lowpass') {
    if (!ac) return
    const t = ac.currentTime + at
    const src = noiseSource(false)
    const f = ac.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(fromHz, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(40, toHz), t + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(sfx)
    src.start(t)
    src.stop(t + dur + 0.05)
  }

  function play(name: string) {
    if (!ac || !enabled) return
    switch (name) {
      case 'bump':
        tone(110, 0.18, 'sine', 0.5, 0, undefined, 50)
        burst(0.2, 0.25, 2500, 300)
        break
      case 'spin':
        tone(120, 0.3, 'sine', 0.6, 0, undefined, 40)
        burst(0.7, 0.35, 4000, 200)
        burst(1.1, 0.12, 2400, 1800, 0.05, 'bandpass')
        break
      case 'tumble':
        tone(90, 0.4, 'sine', 0.8, 0, undefined, 35)
        burst(1.2, 0.5, 5000, 120)
        tone(70, 0.3, 'sine', 0.6, 0.55, undefined, 30)
        burst(0.5, 0.3, 3000, 150, 0.55)
        tone(60, 0.3, 'sine', 0.5, 1.1, undefined, 30)
        burst(0.4, 0.2, 2000, 150, 1.1)
        break
      case 'close':
        burst(0.28, 0.2, 500, 2500, 0, 'bandpass')
        tone(1319, 0.09, 'square', 0.05, 0.05)
        tone(1760, 0.12, 'square', 0.05, 0.12)
        break
      case 'checkpoint':
        ;[523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.14, 'square', 0.07, i * 0.07))
        break
      case 'count':
        tone(440, 0.22, 'square', 0.1)
        break
      case 'go':
        tone(880, 0.55, 'square', 0.12)
        break
      case 'warn':
        tone(1200, 0.07, 'square', 0.06)
        break
      case 'timeup':
        ;[523, 440, 349, 262].forEach((f, i) => tone(f, 0.3, 'square', 0.08, i * 0.22))
        break
      case 'goal':
        ;[523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i === 6 ? 0.8 : 0.16, 'square', 0.08, i * 0.12))
        break
      case 'shift':
        burst(0.05, 0.08, 1800, 600)
        break
      case 'select':
        tone(988, 0.06, 'square', 0.06)
        break
    }
  }

  // ------------------------------------------------------------ sequencer

  function voice(freq: number, at: number, dur: number, type: OscillatorType, vol: number, cutoff: number, dest: AudioNode, detune = 0) {
    const o = ac!.createOscillator()
    o.type = type
    o.frequency.value = freq
    o.detune.value = detune
    const f = ac!.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(cutoff, at)
    f.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.35), at + dur)
    const g = ac!.createGain()
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01)
    g.gain.setTargetAtTime(0.0001, at + dur * 0.7, dur * 0.25)
    o.connect(f)
    f.connect(g)
    g.connect(dest)
    o.start(at)
    o.stop(at + dur + 0.3)
  }

  function drum(kind: 'k' | 's' | 'h', at: number, accent: number) {
    const a = ac!
    if (kind === 'k') {
      const o = a.createOscillator()
      o.frequency.setValueAtTime(150, at)
      o.frequency.exponentialRampToValueAtTime(42, at + 0.14)
      const g = a.createGain()
      g.gain.setValueAtTime(0.9, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32)
      o.connect(g)
      g.connect(musicBus)
      o.start(at)
      o.stop(at + 0.35)
    } else {
      const src = noiseSource(false)
      const f = a.createBiquadFilter()
      f.type = 'highpass'
      f.frequency.value = kind === 's' ? 1100 : 7000
      const g = a.createGain()
      const dur = kind === 's' ? 0.18 : 0.035
      g.gain.setValueAtTime(kind === 's' ? 0.38 : 0.07 * accent, at)
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
      src.connect(f)
      f.connect(g)
      g.connect(musicBus)
      if (kind === 's') {
        g.connect(reverb)
        voice(185, at, 0.08, 'triangle', 0.18, 2000, musicBus)
      }
      src.start(at)
      src.stop(at + dur + 0.02)
    }
  }

  function schedule() {
    if (!ac || track < 0) return
    const tr = TRACKS[track]
    const stepDur = 60 / tr.bpm / 4
    while (nextTime < ac.currentTime + 0.14) {
      const bar = Math.floor(step / 16) % tr.bars.length
      const s = step % 16
      const at = nextTime
      const b = tr.bars[bar]
      // Drums.
      if (tr.kick[s] === 'x') drum('k', at, 1)
      if (tr.snare[s] === 'x') drum('s', at, 1)
      if (tr.hat[s] === 'x') drum('h', at, s % 4 === 2 ? 1.4 : 0.8)
      // Bass.
      const bc = tr.bass[s]
      if (bc !== '.') {
        const n = bc === 'o' ? b.root + 12 : bc === '5' ? b.root + 7 : b.root
        voice(hz(n), at, stepDur * 1.6, 'sawtooth', 0.2, 900, musicBus)
      }
      // Pad, once per bar.
      if (tr.pad && s === 0) {
        for (const n of b.chord) {
          voice(hz(n), at, stepDur * 16, 'sawtooth', 0.025, 1400, musicBus, -8)
          voice(hz(n), at, stepDur * 16, 'sawtooth', 0.025, 1400, reverb, 8)
        }
      }
      // Arpeggio.
      if (tr.arp) {
        const n = b.chord[[0, 1, 2, 1][s % 4]] + 12
        voice(hz(n), at, stepDur * 0.9, 'square', 0.028, 2600, musicBus)
      }
      // Lead, with the delay.
      const li = step % lead.length
      const ln = lead[li]
      if (ln >= 0) {
        let len = 1
        while (lead[(li + len) % lead.length] === -2 && len < 16) len++
        voice(hz(ln), at, stepDur * len, 'square', 0.06, 3200, musicBus)
        voice(hz(ln), at, stepDur * len, 'sawtooth', 0.035, 2400, delay, 7)
      }
      nextTime += stepDur
      step++
    }
  }

  function playTrack(i: number) {
    if (!ensure()) {
      track = -1
      return
    }
    stopTrack()
    if (i < 0 || i >= TRACKS.length) return
    track = i
    lead = parseLead(TRACKS[i].lead)
    delay.delayTime.value = (60 / TRACKS[i].bpm) * 0.75
    step = 0
    nextTime = ac!.currentTime + 0.08
    musicBus.gain.cancelScheduledValues(ac!.currentTime)
    musicBus.gain.setValueAtTime(0.32, ac!.currentTime)
    timer = setInterval(schedule, 25)
    schedule()
  }

  function stopTrack() {
    if (timer) clearInterval(timer)
    timer = null
    track = -1
  }

  /** Fades the radio out (TIME UP, game over). */
  function fadeMusic(seconds = 2) {
    if (!ac || track < 0) return
    const t = ac.currentTime
    musicBus.gain.setTargetAtTime(0.0001, t, seconds / 4)
    setTimeout(() => {
      stopTrack()
      if (ac) musicBus.gain.setValueAtTime(0.32, ac.currentTime)
    }, seconds * 1000)
  }

  function silenceEngine() {
    if (!ac || !eng) return
    const t = ac.currentTime
    for (const g of [eng.gain, eng.squeal, eng.whistleGain, eng.wind, eng.dirt]) g.gain.setTargetAtTime(0, t, 0.05)
  }

  function suspend(on: boolean) {
    if (!ac) return
    if (on) ac.suspend().catch(() => {})
    else ac.resume().catch(() => {})
  }

  function setEnabled(on: boolean) {
    enabled = on
    if (!on) {
      stopTrack()
      silenceEngine()
    }
  }

  function dispose() {
    stopTrack()
    if (ac) ac.close().catch(() => {})
    ac = null
    eng = null
  }

  return { start: ensure, updateEngine, play, playTrack, stopTrack, fadeMusic, silenceEngine, suspend, setEnabled, dispose }
}

export type OutrunAudio = ReturnType<typeof createAudio>
