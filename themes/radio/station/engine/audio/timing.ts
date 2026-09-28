// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
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
  /** Inverse of `at`: the musical (swung) step `t` seconds into the bar. */
  stepAtSwung(t: number): number
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

/** Inverse of swingWarp: the musical step at warped position `w`. */
export function swingUnwarp(w: number, swing: number): number {
  const sw = Math.max(0, Math.min(0.5, swing || 0))
  if (sw === 0) return w
  const pair = Math.floor(w / 2)
  const q = w - pair * 2
  const p = q < 1 + sw ? q / (1 + sw) : 1 + (q - 1 - sw) / (1 - sw)
  return pair * 2 + p
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
    stepAtSwung: (t: number) => swingUnwarp(stepAt(t), swing),
  }
}

/** A scheduled bar on the audio clock. */
export interface PlacedBar {
  /** BarPlan.index */
  index: number
  t0: number
  t1: number
  tm: BarTiming
}

/**
 * Where audio time `time` falls among scheduled bars (sorted by t0, back to
 * back): the bar's index and the musical step 0..16 (swing and tempo glide
 * undone), or null before the first bar or past the last one.
 */
export function positionIn(bars: readonly PlacedBar[], time: number): { bar: number; step: number } | null {
  if (!Number.isFinite(time)) return null
  let lo = 0, hi = bars.length - 1, hit = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (bars[mid]!.t0 <= time) { hit = mid; lo = mid + 1 } else hi = mid - 1
  }
  if (hit < 0) return null
  const b = bars[hit]!
  if (time >= b.t1) return null
  const step = Math.max(0, Math.min(16, b.tm.stepAtSwung(time - b.t0)))
  return { bar: b.index, step: step >= 16 ? 16 - 1e-9 : step }
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

// ---- transport cut (RadioPlayer.cut) -------------------------------------------------

/** One linear segment of a param scheduled bar by bar: v0 at t0 to v1 at t1. */
export type Ramp = [t0: number, v0: number, t1: number, v1: number]

/**
 * The value of back-to-back linear ramps (sorted by t0) at time `t`: inside a
 * ramp it interpolates, after the last one it holds v1, before the first it
 * is the first v0; `fallback` when there are none.
 */
export function rampAt(ramps: readonly Ramp[], t: number, fallback = 0): number {
  if (!ramps.length) return fallback
  let hit = -1
  for (let i = ramps.length - 1; i >= 0; i--) if (ramps[i]![0] <= t) { hit = i; break }
  if (hit < 0) return ramps[0]![1]
  const [t0, v0, t1, v1] = ramps[hit]!
  if (t >= t1 || t1 <= t0) return v1
  return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0)
}

/** Drop ramps that ended before `before`, keeping at least the last one. */
export function pruneRamps(ramps: Ramp[], before: number): void {
  let i = 0
  while (i < ramps.length - 1 && ramps[i]![2] < before) i++
  if (i > 0) ramps.splice(0, i)
}

/**
 * Cut a queue of back-to-back bars (sorted by t0) at `at`, in place: bars
 * starting at or after `at` are removed, the bar sounding at `at` ends there
 * (t1 = at). Returns the removed bars.
 */
export function cutBars<T extends { t0: number; t1: number }>(bars: T[], at: number): T[] {
  let i = bars.length
  while (i > 0 && bars[i - 1]!.t0 >= at) i--
  const gone = bars.splice(i)
  const last = bars[bars.length - 1]
  if (last && last.t1 > at) last.t1 = at
  return gone
}

/** Remove, in place, the items for which `keep` is false (order kept). */
export function keepWhere<T>(xs: T[], keep: (x: T) => boolean): void {
  let j = 0
  for (let i = 0; i < xs.length; i++) if (keep(xs[i]!)) xs[j++] = xs[i]!
  xs.length = j
}

/** `t` rounded up to the next render quantum (128 frames) of a `sampleRate` clock. */
export function quantumAfter(t: number, sampleRate: number): number {
  const q = 128 / (sampleRate > 0 ? sampleRate : 48000)
  return Math.ceil(t / q - 1e-9) * q
}
