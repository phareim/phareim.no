/**
 * How much canvas a device can afford (2026-09-30).
 *
 * The pixel stage composites the whole device-pixel surface four or five times
 * a frame, so its cost is the surface area and nothing else. On a 390×844
 * phone at devicePixelRatio 3 that is 2.96 Mpx per pass; measured on a
 * 4x-throttled CPU, dropping the stage to 1× took the main thread from
 * 5,999 ms of long tasks in a 6 s window down to 536 ms.
 *
 * So the ratio is a capability question, not a constant. This is the same
 * ladder Mini World already uses for its three.js scene
 * (`themes/miniworld/Game.vue`), lifted out so every canvas can ask.
 *
 * Only whole ratios are ever returned. The stage's whole-number `scale` tracks
 * the ratio exactly (a 390×844 phone at 1, 2 and 3 all give scale 1, 2 and 3
 * and the identical 390×844 logical buffer), so 1, 2 and 3 differ only in
 * sharpness. A ratio in between would change the logical buffer and `k` — the
 * size a game draws its sprites — so it is not offered.
 */

const DEFAULT_CORES = 8
const DEFAULT_MEMORY = 8

type Nav = Navigator & { deviceMemory?: number }

/** True for a phone or tablet: coarse pointer with no hover. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches
}

/**
 * The device's budget, as Mini World describes it: few cores, or a touch
 * device that also admits to little memory.
 */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Nav
  const cores = nav.hardwareConcurrency ?? DEFAULT_CORES
  if (cores <= 4) return true
  return isTouchDevice() && (nav.deviceMemory ?? DEFAULT_MEMORY) <= 4
}

/**
 * The device pixel ratio a canvas game should render at: the device's own,
 * capped at 3, stepped down to 2 or 1 where the device is plainly short on
 * cores, memory or both.
 *
 * Read once per canvas, before anything is baked — the ratio is baked into
 * sprite bakes and layout, so it must not change under a running game.
 */
export function canvasPixelRatio(max = 3): number {
  if (typeof window === 'undefined') return 1
  const dpr = window.devicePixelRatio || 1
  const ceiling = Math.max(1, Math.min(max, Math.round(dpr)))
  if (!isLowPowerDevice()) return ceiling
  return Math.max(1, ceiling - 1)
}
