/**
 * Shared WebAudio sound engine for the phareim.no game themes.
 *
 * Everything is synthesized — no audio assets, no dependencies, no network.
 * That keeps the Cloudflare Pages bundle unchanged (no new static files)
 * and works offline from the first paint.
 *
 * Usage in a game component (`<script setup>`):
 *
 *   const sound = useSound()
 *   sound.unlock()            // call from the Enter/tap gesture that starts the run
 *   sound.sfx.shoot()         // one-shot effects
 *   sound.music.start('breakout')
 *   sound.music.stop()
 *
 * The AudioContext is created lazily on the client only (SSR-safe: every
 * method no-ops on the server). Attract/demo modes should stay silent —
 * start music in `resetGame`/`startGame`, stop it on game over, pause and
 * unmount.
 */

export type MusicStyle =
  | 'breakout'
  | 'cyberpunk'
  | 'rtype'
  | 'invaders'
  | 'starfox'
  | 'tetris'
  | 'shore'

const MUTE_KEY = 'phareim-sound-muted'

// ---------------------------------------------------------------------------
// Singleton audio graph (module scope, client only)
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let musicBus: GainNode | null = null
let noiseBuf: AudioBuffer | null = null

function ensureCtx(): AudioContext | null {
  if (import.meta.server || typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = mutedState.value ? 0 : 0.9
    master.connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.gain.value = 0.5
    sfxBus.connect(master)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.16
    musicBus.connect(master)
    // Shared 1 s white-noise buffer for explosions, crashes, surf, wind.
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// Muted flag lives in module scope so the engine works even when called
// outside a component setup (game logic in plain functions). The composable
// mirrors it into a useState for reactive toggles.
const mutedState = { value: false }
let mutedLoaded = false

function loadMuted(): boolean {
  if (mutedLoaded) return mutedState.value
  mutedLoaded = true
  try {
    mutedState.value = localStorage.getItem(MUTE_KEY) === '1'
  } catch { /* private mode etc. — sound stays on */ }
  return mutedState.value
}

// ---------------------------------------------------------------------------
// Primitive voices
// ---------------------------------------------------------------------------

type OscType = OscillatorType

interface ToneOpts {
  /** MIDI note number (69 = A4). */
  note?: number
  /** Raw frequency in Hz (overrides note). */
  freq?: number
  /** Frequency the oscillator glides to over the duration. */
  glideTo?: number
  /** Seconds. */
  dur?: number
  type?: OscType
  /** 0..1 peak gain. */
  vol?: number
  /** Seconds from now. */
  delay?: number
}

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
}

function tone(o: ToneOpts, when = 0): void {
  const c = ensureCtx()
  if (!c || !sfxBus) return
  const t0 = c.currentTime + (o.delay ?? 0) + when
  const osc = c.createOscillator()
  const g = c.createGain()
  const f0 = o.freq ?? midiToFreq(o.note ?? 69)
  osc.type = o.type ?? 'square'
  osc.frequency.setValueAtTime(Math.max(20, f0), t0)
  if (o.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.glideTo), t0 + (o.dur ?? 0.1))
  const vol = o.vol ?? 0.5
  const dur = o.dur ?? 0.1
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.005)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  osc.connect(g)
  g.connect(sfxBus)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

interface NoiseOpts {
  dur?: number
  vol?: number
  delay?: number
  /** Lowpass cutoff Hz. */
  cutoff?: number
  /** Highpass cutoff Hz (0 = off). */
  highpass?: number
}

function noise(o: NoiseOpts, when = 0): void {
  const c = ensureCtx()
  if (!c || !sfxBus || !noiseBuf) return
  const t0 = c.currentTime + (o.delay ?? 0) + when
  const src = c.createBufferSource()
  src.buffer = noiseBuf
  src.loop = true
  const dur = o.dur ?? 0.3
  const g = c.createGain()
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(o.vol ?? 0.5, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
  let node: AudioNode = src
  if (o.cutoff) {
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = o.cutoff
    node.connect(lp)
    node = lp
  }
  if (o.highpass) {
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = o.highpass
    node.connect(hp)
    node = hp
  }
  node.connect(g)
  g.connect(sfxBus)
  src.start(t0)
  src.stop(t0 + dur + 0.05)
}

// ---------------------------------------------------------------------------
// One-shot sound effects
// ---------------------------------------------------------------------------

export interface Sfx {
  shoot(): void
  enemyShoot(): void
  laser(): void
  explosion(big?: boolean): void
  hit(): void
  paddle(): void
  brick(): void
  brickBreak(): void
  wall(): void
  powerup(): void
  shield(): void
  lifeLost(): void
  levelClear(): void
  gameOver(): void
  extraLife(): void
  move(): void
  rotate(): void
  lock(): void
  clear(count: number): void
  levelup(): void
  hold(): void
  hardDrop(): void
  jump(): void
  land(): void
  death(): void
  checkpoint(): void
  win(): void
  ring(): void
  roll(): void
  ufo(): void
  marchStep(): void
  charge(): void
  beam(): void
  uiStart(): void
}

const sfx: Sfx = {
  shoot() { tone({ freq: 880, glideTo: 220, dur: 0.12, type: 'square', vol: 0.35 }) },
  enemyShoot() { tone({ freq: 330, glideTo: 110, dur: 0.18, type: 'sawtooth', vol: 0.22 }) },
  laser() { tone({ freq: 1200, glideTo: 300, dur: 0.1, type: 'sawtooth', vol: 0.3 }) },
  explosion(big = false) {
    noise({ dur: big ? 0.7 : 0.35, vol: big ? 0.8 : 0.55, cutoff: big ? 900 : 1400 })
    tone({ freq: big ? 120 : 160, glideTo: 30, dur: big ? 0.6 : 0.3, type: 'sine', vol: 0.7 })
  },
  hit() { noise({ dur: 0.12, vol: 0.4, cutoff: 2500 }); tone({ freq: 200, glideTo: 60, dur: 0.12, type: 'triangle', vol: 0.5 }) },
  paddle() { tone({ freq: 520, dur: 0.06, type: 'square', vol: 0.4 }) },
  brick() { tone({ freq: 700, dur: 0.05, type: 'square', vol: 0.35 }) },
  brickBreak() { noise({ dur: 0.15, vol: 0.4, cutoff: 4000, highpass: 800 }); tone({ freq: 900, glideTo: 1400, dur: 0.08, type: 'square', vol: 0.3 }) },
  wall() { tone({ freq: 260, dur: 0.04, type: 'square', vol: 0.22 }) },
  powerup() {
    tone({ note: 72, dur: 0.09, type: 'square', vol: 0.4 })
    tone({ note: 76, dur: 0.09, type: 'square', vol: 0.4, delay: 0.08 })
    tone({ note: 79, dur: 0.16, type: 'square', vol: 0.4, delay: 0.16 })
  },
  shield() { tone({ freq: 300, glideTo: 900, dur: 0.2, type: 'sine', vol: 0.45 }) },
  lifeLost() {
    tone({ freq: 400, glideTo: 80, dur: 0.5, type: 'sawtooth', vol: 0.45 })
    noise({ dur: 0.4, vol: 0.3, cutoff: 800 })
  },
  levelClear() {
    for (const [i, n] of [72, 76, 79, 84].entries()) {
      tone({ note: n, dur: 0.14, type: 'square', vol: 0.4, delay: i * 0.1 })
    }
  },
  gameOver() {
    for (const [i, n] of [64, 60, 57, 52].entries()) {
      tone({ note: n, dur: 0.3, type: 'triangle', vol: 0.5, delay: i * 0.22 })
    }
  },
  extraLife() {
    for (const [i, n] of [76, 79, 84, 88].entries()) {
      tone({ note: n, dur: 0.1, type: 'sine', vol: 0.5, delay: i * 0.07 })
    }
  },
  move() { tone({ freq: 240, dur: 0.03, type: 'square', vol: 0.18 }) },
  rotate() { tone({ freq: 360, glideTo: 480, dur: 0.06, type: 'square', vol: 0.28 }) },
  lock() { tone({ freq: 180, dur: 0.07, type: 'triangle', vol: 0.45 }); noise({ dur: 0.05, vol: 0.25, cutoff: 1200 }) },
  clear(count: number) {
    const steps = Math.min(Math.max(count, 1), 4)
    for (let i = 0; i < steps; i++) {
      tone({ note: 72 + i * 2, dur: 0.12, type: 'square', vol: 0.4, delay: i * 0.08 })
    }
    if (count >= 4) tone({ note: 88, dur: 0.3, type: 'square', vol: 0.4, delay: steps * 0.08 })
  },
  levelup() {
    for (const [i, n] of [67, 71, 74, 79].entries()) {
      tone({ note: n, dur: 0.12, type: 'triangle', vol: 0.45, delay: i * 0.09 })
    }
  },
  hold() { tone({ freq: 500, glideTo: 350, dur: 0.08, type: 'sine', vol: 0.35 }) },
  hardDrop() { noise({ dur: 0.12, vol: 0.45, cutoff: 1000 }); tone({ freq: 140, glideTo: 50, dur: 0.12, type: 'sine', vol: 0.6 }) },
  jump() { tone({ freq: 250, glideTo: 600, dur: 0.15, type: 'square', vol: 0.25 }) },
  land() { noise({ dur: 0.08, vol: 0.3, cutoff: 600 }) },
  death() {
    tone({ freq: 500, glideTo: 60, dur: 0.6, type: 'sawtooth', vol: 0.4 })
    noise({ dur: 0.5, vol: 0.35, cutoff: 1000 })
  },
  checkpoint() {
    tone({ note: 79, dur: 0.2, type: 'sine', vol: 0.45 })
    tone({ note: 84, dur: 0.35, type: 'sine', vol: 0.45, delay: 0.15 })
  },
  win() {
    for (const [i, n] of [72, 76, 79, 84, 88, 91].entries()) {
      tone({ note: n, dur: 0.25, type: 'triangle', vol: 0.45, delay: i * 0.13 })
    }
  },
  ring() { tone({ note: 84, dur: 0.15, type: 'sine', vol: 0.45 }); tone({ note: 91, dur: 0.25, type: 'sine', vol: 0.4, delay: 0.08 }) },
  roll() { noise({ dur: 0.25, vol: 0.3, cutoff: 2000, highpass: 400 }) },
  ufo() { tone({ freq: 600, glideTo: 900, dur: 0.3, type: 'sine', vol: 0.3 }) },
  marchStep() { tone({ freq: 90, dur: 0.08, type: 'sine', vol: 0.5 }); noise({ dur: 0.04, vol: 0.2, cutoff: 500 }) },
  charge() { tone({ freq: 150, glideTo: 900, dur: 0.5, type: 'sawtooth', vol: 0.2 }) },
  beam() { tone({ freq: 1400, glideTo: 150, dur: 0.35, type: 'sawtooth', vol: 0.4 }); noise({ dur: 0.3, vol: 0.35, cutoff: 3000 }) },
  uiStart() { tone({ note: 72, dur: 0.08, type: 'square', vol: 0.35 }); tone({ note: 79, dur: 0.12, type: 'square', vol: 0.35, delay: 0.07 }) },
}

// ---------------------------------------------------------------------------
// Procedural background music: a tiny lookahead step sequencer.
// Each style is a bass line + an arp/lead line over 16 steps.
// ---------------------------------------------------------------------------

interface MusicPattern {
  bpm: number
  /** MIDI notes per 16th step, 0 = rest. */
  bass: number[]
  lead: number[]
  bassType: OscType
  leadType: OscType
  leadVol: number
}

// Minor-key loops written for this site (original, no licensed melodies).
const PATTERNS: Record<MusicStyle, MusicPattern> = {
  // Synthwave bounce: Am – F – C – G.
  breakout: {
    bpm: 102, bassType: 'triangle', leadType: 'square', leadVol: 0.16,
    bass: [45, 0, 45, 0, 41, 0, 41, 0, 48, 0, 48, 0, 43, 0, 43, 0],
    lead: [69, 0, 72, 76, 0, 77, 76, 0, 72, 0, 67, 72, 0, 74, 71, 0],
  },
  // Driving E-minor 16th bass for the Cyberpunk shmup.
  cyberpunk: {
    bpm: 138, bassType: 'sawtooth', leadType: 'square', leadVol: 0.1,
    bass: [40, 40, 0, 40, 0, 40, 43, 0, 40, 40, 0, 40, 45, 0, 43, 42],
    lead: [64, 0, 0, 67, 0, 0, 64, 0, 62, 0, 64, 0, 0, 69, 67, 0],
  },
  // Forward-driving minor for R-Type.
  rtype: {
    bpm: 148, bassType: 'sawtooth', leadType: 'square', leadVol: 0.12,
    bass: [38, 0, 38, 38, 0, 38, 0, 41, 36, 0, 36, 36, 0, 43, 41, 39],
    lead: [62, 0, 65, 0, 69, 0, 65, 0, 62, 0, 65, 69, 0, 72, 69, 65],
  },
  // The four-note descending march, like the 1978 original's heartbeat.
  invaders: {
    bpm: 132, bassType: 'sine', leadType: 'square', leadVol: 0.0,
    bass: [50, 0, 0, 48, 0, 0, 46, 0, 0, 45, 0, 0, 48, 0, 50, 0],
    lead: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
  // Heroic major lift for Star Fox.
  starfox: {
    bpm: 120, bassType: 'triangle', leadType: 'square', leadVol: 0.14,
    bass: [48, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0, 43, 0, 47, 0],
    lead: [72, 0, 76, 79, 0, 79, 81, 0, 79, 0, 76, 0, 74, 76, 74, 0],
  },
  // Restless A-minor groove for Tetris (original melody, chiptune voice).
  tetris: {
    bpm: 140, bassType: 'triangle', leadType: 'square', leadVol: 0.15,
    bass: [45, 0, 45, 0, 41, 0, 43, 0, 45, 0, 45, 0, 47, 0, 43, 0],
    lead: [69, 72, 0, 74, 0, 72, 69, 0, 67, 0, 64, 67, 0, 69, 67, 0],
  },
  // Sparse low pads for Another Shore — ambience, not a loop to follow.
  shore: {
    bpm: 60, bassType: 'sine', leadType: 'sine', leadVol: 0.2,
    bass: [38, 0, 0, 0, 0, 0, 0, 0, 36, 0, 0, 0, 0, 0, 0, 0],
    lead: [62, 0, 0, 0, 0, 0, 0, 0, 60, 0, 0, 0, 0, 0, 58, 0],
  },
}

let musicTimer: ReturnType<typeof setInterval> | null = null
let musicStyle: MusicStyle | null = null
let musicStep = 0
let musicNextTime = 0

function scheduleStep(step: number, time: number): void {
  const c = ctx
  const bus = musicBus
  const pattern = musicStyle ? PATTERNS[musicStyle] : null
  if (!c || !bus || !pattern) return
  const playNote = (midi: number, type: OscType, vol: number, dur: number) => {
    if (midi <= 0) return
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = type
    osc.frequency.value = midiToFreq(midi)
    g.gain.setValueAtTime(0, time)
    g.gain.linearRampToValueAtTime(vol, time + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, time + dur)
    osc.connect(g)
    g.connect(bus)
    osc.start(time)
    osc.stop(time + dur + 0.05)
  }
  const stepDur = 60 / pattern.bpm / 4
  playNote(pattern.bass[step % 16], pattern.bassType, 0.5, stepDur * 1.8)
  playNote(pattern.lead[step % 16], pattern.leadType, pattern.leadVol, stepDur * 1.5)
}

function musicTick(): void {
  const c = ctx
  const pattern = musicStyle ? PATTERNS[musicStyle] : null
  if (!c || !pattern) return
  const stepDur = 60 / pattern.bpm / 4
  // Schedule ~0.25 s ahead.
  while (musicNextTime < c.currentTime + 0.25) {
    scheduleStep(musicStep, musicNextTime)
    musicStep = (musicStep + 1) % 16
    musicNextTime += stepDur
  }
}

const music = {
  /** Start (or switch) the loop for a style. Safe to call repeatedly. */
  start(style: MusicStyle): void {
    const c = ensureCtx()
    if (!c) return
    if (musicStyle === style && musicTimer) return
    musicStyle = style
    musicStep = 0
    musicNextTime = c.currentTime + 0.06
    if (!musicTimer) {
      musicTimer = setInterval(musicTick, 90)
    }
  },
  stop(): void {
    if (musicTimer) {
      clearInterval(musicTimer)
      musicTimer = null
    }
    musicStyle = null
  },
  get playing(): boolean {
    return musicTimer !== null
  },
}

// ---------------------------------------------------------------------------
// Composable
// ---------------------------------------------------------------------------

export interface Sound {
  sfx: Sfx
  music: typeof music
  muted: Ref<boolean>
  toggleMute(): void
  /** Create/resume the context from a user gesture. */
  unlock(): void
}

export const useSound = (): Sound => {
  const muted = useState('soundMuted', () => {
    if (import.meta.server) return false
    return loadMuted()
  })

  // Keep the module-scope flag and the gain in sync (client only).
  if (import.meta.client) {
    loadMuted()
    muted.value = mutedState.value
    watch(muted, (v: boolean) => {
      mutedState.value = v
      try {
        localStorage.setItem(MUTE_KEY, v ? '1' : '0')
      } catch { /* ignore */ }
      if (master && ctx) {
        master.gain.setTargetAtTime(v ? 0 : 0.9, ctx.currentTime, 0.02)
      }
    })
  }

  return {
    sfx,
    music,
    muted,
    toggleMute() {
      muted.value = !muted.value
    },
    unlock() {
      ensureCtx()
    },
  }
}
