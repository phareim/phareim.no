/**
 * The sun the polygon view bakes into its meshes. Pure.
 *
 * Each corner of the static geometry knows whether it lies in the sun's shadow (`mesh.ts`, marched through the
 * tile masses when a stretch is built), so a new sun means building the stretches again. With the day running
 * (after the Sun Prism) the hour's sun moves all the time: `dayLook` turns it a little every tenth of a second.
 * The view used to take every one of those as a new map, dropping every stretch and building them again a few a
 * frame, so the ground and all that stands on it went missing and came back several times a second (the
 * flashing of 2026-11-23 for a player who has the real sun). The baked sun moves in steps instead (a few
 * degrees of direction or a tenth of the shadow's length), so the stretches are built again every several
 * seconds, and while they are, the old ones are drawn. The light itself (the sun's direction and colour on the
 * corners) follows the hour without steps.
 */

/** Degrees the hour's sun may turn from the baked one before the meshes are built again. */
export const SUN_STEP = 4
/** Ratio the hour's shadow length may grow or shrink by from the baked one before they are. */
export const SHADOW_STEP = 1.1

export interface BakedSun { angle: number; length: number; key: number }

/**
 * A sun baker for one view: given the hour's sun each frame (and the view's own, which is the sun without a
 * day), it gives the sun to bake into the meshes and a key that changes only when that does. It holds its sun
 * until the hour's has turned more than `SUN_STEP` degrees from it or its shadows have grown or shrunk by more
 * than `SHADOW_STEP`, and then takes the hour's as it is, direction and length together, so one rebuild covers
 * both. Without a day the hour's sun is the view's own, and so is the baked one, exactly.
 */
export function createSunBaker() {
  let now: BakedSun | null = null
  return (angle: number, length: number): BakedSun => {
    const len = Math.max(0.05, length)
    if (now) {
      const turn = Math.abs(((((angle - now.angle) % 360) + 540) % 360) - 180)
      const grow = Math.abs(Math.log(len / now.length))
      if (turn <= SUN_STEP && grow <= Math.log(SHADOW_STEP)) return now
    }
    now = { angle, length: len, key: (now?.key ?? 0) + 1 }
    return now
  }
}

/**
 * How fast the light this view lights with is changing, per second (the largest change of any of its numbers,
 * smoothed twice over about three quarters of a second each). With the day running the light drifts (fastest
 * at dawn and in the evening), and every 15-bit step it crosses is a pixel of the dither turning over
 * somewhere: a sparkle the classic view, which rounds to 8 bits, does not have. The view softens the dither by
 * how fast the light moves (`softness`). The hour reaches the view in steps (a tenth of a second, its ambient
 * in steps of 1/255), so the rate is smoothed twice, and the softening moves by a hundredth or so a frame. A
 * jump (a door, the turn) counts as no more than `JUMP` a frame, so it softens only briefly.
 */
export function createDriftMeter(tau = 1.5) {
  let last: number[] | null = null
  let r1 = 0
  let r2 = 0
  return (light: readonly number[], dt: number): number => {
    const t = Math.max(0, Math.min(0.1, dt))
    if (last && last.length === light.length && t > 0) {
      let d = 0
      for (let i = 0; i < light.length; i++) d = Math.max(d, Math.abs(light[i]! - last[i]!))
      const k = 1 - Math.exp(-t / (tau / 2))
      r1 += (Math.min(d, JUMP) / t - r1) * k
      r2 += (r1 - r2) * k
    }
    last = light.slice()
    return r2
  }
}
/** The most a frame's change counts for in the drift. */
export const JUMP = 0.002
/** Light drifting slower than this (per second) keeps the whole dither; at `DRIFT_FULL` and over it is softened by `SOFT_MAX`. */
export const DRIFT_CALM = 0.0006
export const DRIFT_FULL = 0.003
/** How much of the unrounded colour shows through the dither at the most: a turned-over pixel is then that much less than a 15-bit step. */
export const SOFT_MAX = 0.5

/** How far to soften the dither for a light drifting at `rate` per second. */
export function softness(rate: number): number {
  return SOFT_MAX * Math.max(0, Math.min(1, (rate - DRIFT_CALM) / (DRIFT_FULL - DRIFT_CALM)))
}
