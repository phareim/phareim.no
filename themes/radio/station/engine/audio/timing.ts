// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Step timing inside one bar: tempo glide and swing. Pure math, no Web Audio,
 * so node tests cover it.
 *
 * A bar is 16 steps. The tempo glides linearly from `bpmStart` at step 0 to
 * `bpmEnd` at step 16 (linear in steps, not in seconds). A sixteenth at tempo
 * `bpm` lasts 15 / bpm seconds, so the time to reach step s is the integral
 *
 *   t(s) = ∫0^s 15 / (a + b·u) du = (15 / b) · ln((a + b·s) / a)
 *
 * with a = bpmStart and b = (bpmEnd - bpmStart) / 16. Past the bar end the
 * tempo stays at bpmEnd (notes may ring over the barline).
 *
 * Swing delays the odd sixteenths by `swing × sixteenth`. It is applied as a
 * warp of the step axis inside each pair of sixteenths, so fractional steps
 * (triplets) and note ends move continuously with it:
 *
 *   p in [0, 1): p · (1 + swing)          (the on-beat half stretches)
 *   p in [1, 2): 1 + swing + (p - 1) · (1 - swing)   (the off-beat half shrinks)
 */

export interface BarTiming {
  /** Bar length in seconds. */
  dur: number
  /** Seconds from the bar start to step `s` with swing applied (fractional, may exceed 16). */
  at(s: number): number
  /** Seconds from the bar start to step `s`, no swing. */
  straight(s: number): number
  /** Inverse of `straight`: the (unswung) step position `t` seconds into the bar. */
  stepAt(t: number): number
  /** Tempo at step `s`. */
  bpmAt(s: number): number
}

const EPS = 1e-9

/** Warp a step position by swing (0..0.5 of a sixteenth). Even steps stay put. */
export function swingWarp(s: number, swing: number): number {
  const sw = Math.max(0, Math.min(0.5, swing || 0))
  if (sw === 0) return s
  const pair = Math.floor(s / 2)
  const p = s - pair * 2
  const w = p < 1 ? p * (1 + sw) : 1 + sw + (p - 1) * (1 - sw)
  return pair * 2 + w
}

export function barTiming(bpmStart: number, bpmEnd: number, swing: number): BarTiming {
  const a = sane(bpmStart)
  const e = sane(bpmEnd)
  const b = (e - a) / 16

  const straight = (s: number): number => {
    if (s <= 0) return (s * 15) / a
    if (s > 16) return straight(16) + ((s - 16) * 15) / e
    if (Math.abs(b) < EPS) return (15 * s) / a
    return (15 / b) * Math.log((a + b * s) / a)
  }
  const dur = straight(16)
  const stepAt = (t: number): number => {
    if (t <= 0) return (t * a) / 15
    if (t > dur) return 16 + ((t - dur) * e) / 15
    if (Math.abs(b) < EPS) return (t * a) / 15
    return (a / b) * (Math.exp((b * t) / 15) - 1)
  }
  return {
    dur,
    straight,
    stepAt,
    at: (s: number) => straight(swingWarp(s, swing)),
    bpmAt: (s: number) => (s >= 16 ? e : s <= 0 ? a : a + b * s),
  }
}

/** A tempo the math can survive: finite, 20..400 bpm. */
function sane(bpm: number): number {
  return Number.isFinite(bpm) ? Math.max(20, Math.min(400, bpm)) : 100
}

/** Seconds of a dotted eighth at `bpm` (the delay time). */
export function dottedEighth(bpm: number): number {
  return (0.75 * 60) / sane(bpm)
}

/**
 * A multi-bar linear fade, evaluated per bar so the player can schedule one
 * ramp per bar and never has to cancel automation already running.
 */
export interface Fade {
  from: number
  to: number
  /** Bar index at which the fade starts. */
  start: number
  /** Length in bars; 0 = jump at the start bar. */
  bars: number
}

/** Value of a fade at the start of bar `j`. */
export function fadeAtBarStart(f: Fade, j: number): number {
  if (j <= f.start) return f.from
  if (f.bars <= 0) return f.to
  const p = Math.min(1, (j - f.start) / f.bars)
  return f.from + (f.to - f.from) * p
}

/** Value of a fade at the end of bar `j`. */
export function fadeAtBarEnd(f: Fade, j: number): number {
  if (j < f.start) return f.from
  if (f.bars <= 0) return f.to
  const p = Math.min(1, (j - f.start + 1) / f.bars)
  return f.from + (f.to - f.from) * p
}
