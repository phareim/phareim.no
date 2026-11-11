/**
 * INVASIVE: the sound. No loop and no samples: the game is its own music.
 * The heart is the kick (and gets faster as the sky grows); every cell that
 * dies in a cascade is the next note up a pentatonic scale, so a big cut
 * plays a run. Voices come from the shared engine (`composables/useSound`),
 * which owns the context, the buses and the mute.
 */
import { playNoise, playTone } from '~/composables/useSound'

/** A minor pentatonic, as semitones. */
const SCALE = [0, 3, 5, 7, 10]

/** The note for step `n` of a run: up the scale, three octaves, then round again. */
export function runNote(n: number, root = 57): number {
  const i = ((n % 15) + 15) % 15
  return root + SCALE[i % 5]! + 12 * Math.floor(i / 5)
}

let lastPop = 0
let lastShot = 0
let lastClank = 0

function now(): number {
  return typeof performance === 'undefined' ? 0 : performance.now()
}

export const voice = {
  /** Lub-dub. `danger` 0–1 makes it louder. */
  beat(danger: number) {
    const v = 0.35 + danger * 0.5
    playTone({ freq: 70, glideTo: 38, dur: 0.16, type: 'sine', vol: v })
    playTone({ freq: 58, glideTo: 34, dur: 0.13, type: 'sine', vol: v * 0.7, delay: 0.11 })
  },
  shot() {
    const t = now()
    if (t - lastShot < 90) return
    lastShot = t
    playTone({ freq: 1300, glideTo: 600, dur: 0.04, type: 'triangle', vol: 0.05 })
  },
  /** One cell gone. In a cascade `chain` counts up and the notes climb. */
  pop(chain: number, root: number) {
    const t = now()
    if (t - lastPop < 28) return
    lastPop = t
    if (chain <= 0) playTone({ note: root - 12, dur: 0.06, type: 'square', vol: 0.07 })
    else playTone({ note: runNote(chain >> 1, root), dur: 0.09, type: 'triangle', vol: 0.16 })
  },
  clank() {
    const t = now()
    if (t - lastClank < 70) return
    lastClank = t
    playTone({ freq: 1900, glideTo: 900, dur: 0.035, type: 'square', vol: 0.06 })
  },
  /** The cut itself: a snip, deeper for a bigger piece. */
  sever(n: number) {
    playNoise({ dur: 0.12, vol: 0.2, highpass: 2500 })
    playTone({ freq: n > 30 ? 82 : 110, glideTo: 55, dur: 0.25, type: 'sawtooth', vol: Math.min(0.3, 0.1 + n / 300) })
  },
  heartHit() {
    playTone({ freq: 140, glideTo: 60, dur: 0.09, type: 'square', vol: 0.18 })
  },
  heartDown(last: boolean) {
    playNoise({ dur: last ? 1.4 : 0.6, vol: 0.5, cutoff: 900 })
    playTone({ freq: 220, glideTo: 30, dur: last ? 1.2 : 0.5, type: 'sawtooth', vol: 0.35 })
  },
  /** A tendril has a roof. */
  latch() {
    playTone({ freq: 196, dur: 0.12, type: 'sawtooth', vol: 0.2 })
    playTone({ freq: 185, dur: 0.2, type: 'sawtooth', vol: 0.2, delay: 0.13 })
  },
  /** A window goes out. */
  window() {
    playTone({ freq: 440, glideTo: 330, dur: 0.22, type: 'square', vol: 0.16 })
    playTone({ freq: 330, glideTo: 208, dur: 0.3, type: 'square', vol: 0.14, delay: 0.2 })
  },
  relight() {
    for (let i = 0; i < 6; i++) playTone({ note: runNote(i + 5, 60), dur: 0.14, type: 'triangle', vol: 0.2, delay: i * 0.07 })
  },
  stun() {
    playNoise({ dur: 0.25, vol: 0.35, cutoff: 1800 })
    playTone({ freq: 300, glideTo: 70, dur: 0.3, type: 'sawtooth', vol: 0.2 })
  },
  mote() {
    playTone({ freq: 1568, dur: 0.07, type: 'sine', vol: 0.14 })
    playTone({ freq: 2093, dur: 0.09, type: 'sine', vol: 0.1, delay: 0.05 })
  },
  lanceOn() {
    playTone({ freq: 110, glideTo: 880, dur: 0.4, type: 'sawtooth', vol: 0.25 })
    playNoise({ dur: 0.4, vol: 0.2, highpass: 3000 })
  },
  /** The lance's burn, asked for a few times a second while it is lit. */
  lanceHum() {
    playTone({ freq: 220, glideTo: 233, dur: 0.12, type: 'sawtooth', vol: 0.07 })
  },
  layer() {
    playTone({ freq: 55, glideTo: 110, dur: 0.9, type: 'sine', vol: 0.4 })
  },
  start() {
    playTone({ note: 69, dur: 0.08, type: 'square', vol: 0.15 })
    playTone({ note: 76, dur: 0.12, type: 'square', vol: 0.15, delay: 0.08 })
  },
  over() {
    for (let i = 0; i < 5; i++) playTone({ note: 64 - i * 3, dur: 0.35, type: 'triangle', vol: 0.22, delay: i * 0.22 })
    playTone({ freq: 55, glideTo: 28, dur: 1.6, type: 'sine', vol: 0.4, delay: 1.1 })
  },
}
