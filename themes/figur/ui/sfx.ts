/**
 * The studio's small sounds: a pop when something is picked, a sparkle
 * on save, a chirp for Pip, a soft tick while painting. Web Audio, made
 * on the first user gesture (browsers keep audio off until then), quiet,
 * and a mute that the page remembers (localStorage `figur.muted`).
 *
 * The site radio is held silent while the studio is open (the theme is
 * `ownRadio`, so its widget is hidden and nothing else could stop it) and
 * released in `dispose()`, like Mini World (docs/games/global-radio.md).
 */
import { getRadioEngine } from '../../radio/engine'
import { MUTE_KEY as RADIO_MUTE_KEY } from '../../radio/catalog'

export type Sfx = 'pop' | 'sparkle' | 'chirp' | 'tick' | 'whoosh' | 'no'

const MUTE_KEY = 'figur.muted'
const VOLUME = 0.12

export interface FigurSfx {
  /** Call from every user gesture: makes the audio context, or resumes it until it runs. */
  unlock(): void
  play(name: Sfx): void
  muted: boolean
  setMuted(m: boolean): void
  dispose(): void
}

function readMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === '1' } catch { return false }
}

export function createSfx(): FigurSfx {
  let ctx: AudioContext | null = null
  let out: GainNode | null = null
  let muted = readMuted()
  let lastTick = 0
  let radioHeld = false

  function holdRadio(): void {
    if (radioHeld || typeof window === 'undefined') return
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

  function tone(freq: number, at: number, dur: number, type: OscillatorType, gain = 1, slideTo?: number): void {
    if (!ctx || !out) return
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, at)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur)
    g.gain.setValueAtTime(0.0001, at)
    g.gain.exponentialRampToValueAtTime(gain, at + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    o.connect(g).connect(out)
    o.start(at)
    o.stop(at + dur + 0.02)
  }

  const api: FigurSfx = {
    unlock() {
      if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return }
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!AC) return
        ctx = new AC()
        out = ctx.createGain()
        out.gain.value = VOLUME
        out.connect(ctx.destination)
      } catch {
        ctx = null
      }
    },
    play(name) {
      if (muted || !ctx || ctx.state !== 'running') return
      const t = ctx.currentTime + 0.005
      switch (name) {
        case 'pop':
          tone(520, t, 0.09, 'square', 0.5, 880)
          break
        case 'tick': {
          // Painting: at most one tick per 60 ms, very soft.
          const now = performance.now()
          if (now - lastTick < 60) return
          lastTick = now
          tone(1200 + Math.random() * 300, t, 0.03, 'triangle', 0.25)
          break
        }
        case 'sparkle':
          ;[880, 1175, 1568, 2093].forEach((f, i) => tone(f, t + i * 0.06, 0.14, 'triangle', 0.6))
          break
        case 'chirp':
          tone(1400, t, 0.08, 'sine', 0.7, 2200)
          tone(1600, t + 0.11, 0.1, 'sine', 0.7, 2600)
          break
        case 'whoosh':
          tone(300, t, 0.18, 'triangle', 0.5, 900)
          break
        case 'no':
          tone(300, t, 0.12, 'square', 0.35, 200)
          break
      }
    },
    get muted() { return muted },
    setMuted(m) {
      muted = m
      try { localStorage.setItem(MUTE_KEY, m ? '1' : '0') } catch { /* no storage */ }
    },
    dispose() {
      releaseRadio()
      try { void ctx?.close() } catch { /* closed */ }
      ctx = null
      out = null
    },
  }
  return api
}
