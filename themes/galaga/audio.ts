/**
 * Space Voyagers' audio (the theme id is still `galaga`): everything
 * synthesised with Web Audio, no samples.
 *
 * A full radio sequencer after the OutRun template (buses, shared noise,
 * gated reverb, dotted-eighth delay, 25 ms / 0.14 s lookahead scheduler):
 * three original chip loops, which the site's radio plays as its first
 * three stations (`themes/radio/engine.ts` imports TRACKS from here).
 * Intensity follows the run (arp alone on a sector's card, the full band
 * from wave 3, a boss transposes +2 and halves the arp grid). The game
 * itself uses the one-shots: `SFX_NAMES` lists them, `soundFor()` says
 * which one an engine event makes.
 *
 * Nothing starts before a user gesture (`start()` is called when a run
 * begins and again from every gesture in it: a context made after the tap
 * that asked for the game stays suspended on iOS until the next one); a
 * browser that refuses audio stays quiet.
 */

interface Track {
  name: string
  bpm: number
  /** Per bar: chord root for the bass (midi) and the triad for pad/arp. */
  bars: { root: number; chord: number[] }[]
  bass: string
  lead: string[]
  kick: string
  snare: string
  hat: string
  arp: boolean
  pad: boolean
}

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, Bb: 10, B: 11 }
export function midi(name: string): number {
  const m = /^([A-G](?:#|b)?)(\d)$/.exec(name)
  if (!m) return -1
  return 12 * (Number(m[2]) + 1) + NOTE[m[1]]
}
export const hz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12)

export const TRACKS: readonly Track[] = [
  {
    name: 'STARDUST RUN',
    bpm: 128,
    bars: [
      { root: 45, chord: [57, 60, 64] }, { root: 41, chord: [53, 57, 60] }, { root: 48, chord: [55, 60, 64] }, { root: 43, chord: [55, 59, 62] },
      { root: 45, chord: [57, 60, 64] }, { root: 41, chord: [53, 57, 60] }, { root: 43, chord: [55, 59, 62] }, { root: 43, chord: [55, 59, 62] },
    ],
    bass: 'R.R.o.R.R.R.o.5.',
    lead: [
      'E5 . B4 E5 - G5 A5 G5', 'A4 . E4 A4 - C5 D5 C5', 'G4 . D4 G4 - Bb4 C5 D5', 'F#4 . D4 F#4 - A4 B4 A4',
      'E5 . B4 E5 - G5 B5 A5', 'A4 . E4 A4 - G5 E5 C5', 'D5 - C5 B4 - A4 B4 -', 'A4 - - - - - . .',
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x...',
    hat: '..x...x...x...x.',
    arp: true,
    pad: true,
  },
  {
    name: 'VOID CHOIR',
    bpm: 96,
    bars: [
      { root: 45, chord: [57, 60, 64] }, { root: 41, chord: [53, 56, 60] }, { root: 36, chord: [48, 52, 55] }, { root: 43, chord: [55, 58, 62] },
      { root: 45, chord: [57, 60, 64] }, { root: 41, chord: [53, 56, 60] }, { root: 38, chord: [50, 53, 57] }, { root: 43, chord: [55, 59, 62] },
    ],
    bass: 'R..R..R.o..R.5..',
    lead: [
      'A4 - - E4 - C4 E4 G4', 'F4 - - C4 - A3 C4 F4', 'G4 - - D4 - B3 D4 G4', 'F#4 - - - . D4 E4 F#4',
      'A4 - - E5 - D5 C5 A4', 'F4 - G4 - A4 - G4 F4', 'E4 - F#4 - B4 - A4 G4', 'A4 - - - F#4 - D4 -',
    ],
    kick: 'x......x..x.....',
    snare: '....x.......x...',
    hat: 'x.x.x.x.x.x.x.x.',
    arp: false,
    pad: true,
  },
  {
    name: 'BULLET BALLET',
    bpm: 142,
    bars: [
      { root: 40, chord: [52, 55, 59] }, { root: 40, chord: [52, 55, 59] }, { root: 36, chord: [48, 52, 55] }, { root: 38, chord: [50, 53, 57] },
      { root: 40, chord: [52, 55, 59] }, { root: 43, chord: [55, 59, 62] }, { root: 38, chord: [50, 53, 57] }, { root: 43, chord: [55, 59, 62] },
    ],
    bass: 'RoRoRoRoRoRoRoRo',
    lead: [
      'A4 - C5 - D5 C5 B4 -', 'A4 - - - G4 - A4 C5', 'F4 - A4 - G4 F4 E4 -', 'F4 - - - E4 - D4 E4',
      'A4 - C5 - E5 - D5 C5', 'D5 - C5 - A4 - C5 D5', 'E5 - D5 - B4 - D5 E5', 'D#5 - - - E5 - A4 -',
    ],
    kick: 'x...x...x...x...',
    snare: '....x.......x..x',
    hat: 'xxxxxxxxxxxxxxxx',
    arp: true,
    pad: false,
  },
]

export const TRACK_NAMES = TRACKS.map(t => t.name)

/** Which voices the scheduler plays at an intensity tier. */
export function intensityVoices(tier: 0 | 1 | 2 | 3): { arp: boolean; bass: boolean; lead: boolean; snare: boolean } {
  if (tier === 0) return { arp: true, bass: false, lead: false, snare: false }
  if (tier === 1) return { arp: true, bass: true, lead: false, snare: false }
  if (tier === 2) return { arp: true, bass: true, lead: true, snare: true }
  return { arp: true, bass: true, lead: true, snare: true }
}

/** Boss transposition in semitones (the dim lift on top of tier 3). */
export function transposeFor(bossActive: boolean): number {
  return bossActive ? 2 : 0
}

/** Lead lines parsed to 16th steps: [midi or -1 rest or -2 hold]. */
export function parseLead(bars: string[]): number[] {
  const out: number[] = []
  for (const bar of bars) {
    for (const tok of bar.trim().split(/\s+/)) {
      const v = tok === '-' ? -2 : tok === '.' ? -1 : midi(tok)
      out.push(v, -2)
    }
  }
  return out
}

/** Every one-shot `play()` knows. */
export const SFX_NAMES = [
  'shoot', 'disc', 'bass', 'kill', 'armourTick', 'bossHit', 'bossKill', 'pickup', 'shield', 'mend', 'combo',
  'mirrorball', 'death', 'waveStart', 'bossStinger', 'radioOpen', 'radioClose', 'cutIn', 'beam', 'capture', 'dock',
  'tow', 'duetReady', 'duet', 'horn', 'warning', 'hullHit',
] as const
export type Sfx = typeof SFX_NAMES[number]

/**
 * The one-shot for an engine event (`themes/galaga/engine/README.md`,
 * "Events"), or null when the event is silent. `n` is the event's number:
 * for a shot the owner (only the player's own guns are heard), for a pop
 * the points (a pop that is not the player's is silent).
 */
export function soundFor(type: string, kind: string, n: number): Sfx | null {
  switch (type) {
    case 'shot': return n !== 0 ? null : kind === 'disc' ? 'disc' : kind === 'boombox' ? 'bass' : 'shoot'
    case 'pop': return n > 0 ? 'kill' : null
    case 'hit': return kind === 'boss' ? 'bossHit' : kind === 'enemy' ? null : 'armourTick'
    case 'partnerHit': return 'armourTick'
    case 'pick': return 'pickup'
    case 'power': return kind === 'mirrorball' ? 'mirrorball' : kind === 'bubble' ? 'shield' : null
    case 'bubble': return 'shield'
    case 'mend': return 'mend'
    case 'valve': case 'limp': return 'hullHit'
    case 'tow': return 'tow'
    case 'gameover': return 'death'
    case 'chain': return 'combo'
    case 'wave': return 'waveStart'
    case 'card': return kind === 'boss' ? 'warning' : null
    case 'bossIn': case 'bossPhase': return 'bossStinger'
    case 'bossDown': return 'bossKill'
    case 'beamOn': return 'beam'
    case 'capture': return 'capture'
    case 'docked': return 'dock'
    case 'duetReady': return 'duetReady'
    case 'duetOn': return 'duet'
    case 'convoyIn': case 'rig': return 'horn'
    case 'pass': return kind === 'marge' || kind === 'duckie' ? 'horn' : null
    default: return null
  }
}

export type GalagaAudio = ReturnType<typeof createGalagaAudio>

export function createGalagaAudio() {
  let ac: AudioContext | null = null
  let master: GainNode
  let sfx: GainNode
  let musicBus: GainNode
  let noise: AudioBuffer
  let reverb: ConvolverNode
  let delay: DelayNode
  let enabled = true
  let track = -1
  let step = 0
  let nextTime = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let fadeTimer: ReturnType<typeof setTimeout> | null = null
  let lead: number[] = []
  let tier: 0 | 1 | 2 | 3 = 0
  let bossMode = false
  let lastShoot = 0

  /**
   * Ask a context that is not running to run. A browser grants it only from inside a gesture, and iOS
   * has a state of its own, 'interrupted' (a call, the app switcher), so this is asked again from every
   * gesture and must cost nothing and throw nothing when there is nothing to do.
   */
  function wake(): void {
    if (!ac || ac.state === 'running' || ac.state === 'closed') return
    try {
      ac.resume().catch(() => {})
    } catch {
      // Not now: the next gesture asks again.
    }
  }

  function ensure(): boolean {
    if (!enabled) return false
    if (ac) {
      wake()
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
    sfx = ac.createGain()
    sfx.gain.value = 0.7
    sfx.connect(master)
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
    wake()
    return true
  }

  function noiseSource(loop = true): AudioBufferSourceNode {
    const src = ac!.createBufferSource()
    src.buffer = noise
    src.loop = loop
    if (loop) src.loopStart = Math.random()
    return src
  }

  function tone(freq: number, dur: number, type: OscillatorType, vol: number, at = 0, slideTo?: number): void {
    if (!ac) return
    const t = ac.currentTime + at
    const o = ac.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(Math.max(20, freq), t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(vol, t + 0.008)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(sfx)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  function burst(dur: number, vol: number, fromHz: number, toHz: number, type: BiquadFilterType = 'lowpass'): void {
    if (!ac) return
    const t = ac.currentTime
    const src = noiseSource(false)
    const f = ac.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(fromHz, t)
    f.frequency.exponentialRampToValueAtTime(Math.max(30, toHz), t + dur)
    const g = ac.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f)
    f.connect(g)
    g.connect(sfx)
    src.start(t)
    src.stop(t + dur + 0.05)
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
    if (!ac || track < 0) return
    const tr = TRACKS[track]!
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

  /** Make the context, or wake it. Safe to call from every gesture: it never throws and makes one context only. */
  function start(): boolean {
    try {
      return ensure()
    } catch {
      return false
    }
  }

  function playTrack(i: number): void {
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
    if (!ensure() || i < 0 || i >= TRACKS.length) return
    stopTrack()
    if (ac) {
      try {
        musicBus.gain.cancelScheduledValues(ac.currentTime)
        musicBus.gain.setValueAtTime(0.3, ac.currentTime)
      } catch {
        // context gone
      }
    }
    track = i
    step = 0
    lead = parseLead(TRACKS[i]!.lead)
    nextTime = ac!.currentTime + 0.06
    delay.delayTime.value = 60 / TRACKS[i]!.bpm * 0.75
    timer = setInterval(schedule, 25)
  }

  function stopTrack(): void {
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    track = -1
  }

  function fadeMusic(s = 2): void {
    if (!ac) {
      stopTrack()
      return
    }
    const t = ac.currentTime
    try {
      musicBus.gain.cancelScheduledValues(t)
      musicBus.gain.setValueAtTime(musicBus.gain.value, t)
      musicBus.gain.exponentialRampToValueAtTime(0.0001, t + s)
    } catch {
      // already silent
    }
    const tr = track
    fadeTimer = setTimeout(() => {
      fadeTimer = null
      stopTrack()
      if (ac && tr >= 0) {
        try {
          musicBus.gain.cancelScheduledValues(ac.currentTime)
          musicBus.gain.setValueAtTime(0.3, ac.currentTime)
        } catch {
          // context gone
        }
      }
    }, s * 1000 + 50)
  }

  function setIntensity(t: 0 | 1 | 2 | 3, boss: boolean): void {
    tier = t
    bossMode = boss
  }

  function suspend(on: boolean): void {
    if (!ac) return
    if (on) ac.suspend().catch(() => {})
    else ac.resume().catch(() => {})
  }

  function setEnabled(on: boolean): void {
    enabled = on
    if (!on) {
      stopTrack()
      if (ac) ac.close().catch(() => {})
      ac = null
    }
  }

  function dispose(): void {
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null }
    stopTrack()
    if (ac) ac.close().catch(() => {})
    ac = null
  }

  const sounds: Record<Sfx, (now: number) => void> = {
    shoot(now) {
      if (now - lastShoot < 0.09) return
      lastShoot = now
      tone(880, 0.06, 'square', 0.04, 0, 440)
    },
    disc(now) {
      if (now - lastShoot < 0.09) return
      lastShoot = now
      tone(1320, 0.07, 'sawtooth', 0.03, 0, 1760)
    },
    bass(now) {
      // The boom box: a low thump with a short rattle on top.
      if (now - lastShoot < 0.09) return
      lastShoot = now
      tone(130, 0.14, 'sine', 0.14, 0, 55)
      burst(0.06, 0.05, 900, 300)
    },
    kill() {
      burst(0.18, 0.25, 3000, 300)
      tone(220, 0.16, 'square', 0.12, 0, 55)
    },
    armourTick() {
      tone(1400, 0.05, 'square', 0.07)
    },
    bossHit() {
      tone(180, 0.1, 'sawtooth', 0.1, 0, 90)
    },
    bossKill() {
      burst(0.7, 0.4, 4000, 100)
      tone(110, 0.7, 'sawtooth', 0.2, 0, 30)
      tone(440, 0.5, 'square', 0.08, 0.05, 880)
    },
    pickup() {
      tone(659, 0.09, 'square', 0.1)
      tone(988, 0.12, 'square', 0.1, 0.09)
    },
    shield() {
      tone(520, 0.12, 'triangle', 0.12, 0, 780)
    },
    mend() {
      // A valve warming up.
      tone(330, 0.1, 'triangle', 0.09, 0, 440)
      tone(660, 0.16, 'triangle', 0.08, 0.1)
    },
    combo() {
      tone(784, 0.08, 'square', 0.09)
      tone(1047, 0.1, 'square', 0.09, 0.08)
    },
    mirrorball() {
      burst(0.5, 0.4, 5000, 200)
      tone(90, 0.5, 'sawtooth', 0.22, 0, 45)
    },
    death() {
      tone(400, 1.0, 'sawtooth', 0.2, 0, 40)
      burst(1.0, 0.35, 4000, 100)
    },
    waveStart() {
      tone(660, 0.07, 'square', 0.06)
    },
    bossStinger() {
      tone(220, 0.5, 'square', 0.12, 0, 880)
      burst(0.4, 0.2, 6000, 1000, 'highpass')
    },
    radioOpen() {
      // A CB keyed: the click, then the squelch opening.
      tone(1900, 0.018, 'square', 0.05)
      burst(0.09, 0.07, 2600, 1400, 'bandpass')
    },
    radioClose() {
      // The squelch tail and the click as the key is let go.
      burst(0.12, 0.06, 1800, 700, 'bandpass')
      tone(1500, 0.016, 'square', 0.04, 0.11)
    },
    cutIn() {
      // A boss on every band: a detuned low chord sliding down.
      tone(147, 0.9, 'sawtooth', 0.05, 0, 110)
      tone(156, 0.9, 'sawtooth', 0.04, 0, 116)
      tone(220, 0.7, 'triangle', 0.05, 0.05, 165)
      burst(0.5, 0.08, 1800, 300, 'bandpass')
    },
    beam() {
      // The tractor beam: two tones a wobble apart, rising.
      tone(196, 0.7, 'sine', 0.09, 0, 392)
      tone(203, 0.7, 'sine', 0.08, 0, 406)
      tone(784, 0.5, 'triangle', 0.025, 0.1, 1568)
    },
    capture() {
      tone(523, 0.5, 'triangle', 0.1, 0, 131)
      tone(392, 0.4, 'square', 0.04, 0.12, 98)
    },
    dock() {
      // Two hulls meeting: a clunk and a rising pair.
      tone(110, 0.08, 'square', 0.12, 0, 70)
      tone(523, 0.1, 'triangle', 0.09, 0.08)
      tone(784, 0.16, 'triangle', 0.09, 0.18)
    },
    tow() {
      // The hook going on and the winch taking up.
      tone(90, 0.1, 'square', 0.16, 0, 60)
      burst(0.12, 0.2, 1200, 200)
      tone(220, 0.6, 'sawtooth', 0.06, 0.14, 330)
    },
    duetReady() {
      tone(988, 0.08, 'triangle', 0.07)
      tone(1319, 0.12, 'triangle', 0.07, 0.08)
    },
    duet() {
      tone(330, 0.5, 'sawtooth', 0.1, 0, 1320)
      tone(660, 0.4, 'square', 0.05, 0.1, 1760)
      burst(0.4, 0.2, 6000, 800, 'highpass')
    },
    horn() {
      // A rig's air horn: two notes a minor third apart, twice.
      for (let i = 0; i < 2; i++) {
        tone(233, 0.28, 'sawtooth', 0.09, i * 0.34)
        tone(277, 0.28, 'sawtooth', 0.08, i * 0.34)
      }
    },
    warning() {
      for (let i = 0; i < 3; i++) tone(440, 0.22, 'square', 0.06, i * 0.32, 330)
    },
    hullHit() {
      tone(300, 0.25, 'sawtooth', 0.18, 0, 80)
      burst(0.25, 0.3, 2500, 200)
    },
  }

  function play(name: string): void {
    if (!ensure()) return
    sounds[name as Sfx]?.(ac!.currentTime)
  }

  return {
    start, playTrack, stopTrack, fadeMusic, setIntensity, suspend, setEnabled, dispose, play,
    get trackIndex() { return track },
  }
}
