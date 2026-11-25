/**
 * Windows at night (Neon Shrine art task L1), shared by the kits' night variants of their houses.
 *
 * A lit pane is lamplight: `gold` with a white-hot corner (`core`) that dithers out into the gold, so the
 * pane's own glow is stronger than the daytime pane's. The one-px frame round it becomes a rim of spill
 * light (`glassRose`, a warm glow), so the pane blooms in the iso view. The TV pane is a checker of
 * `glassViolet` and `bandCyan`, which reads as a cold blue, with a violet rim.
 *
 * Every function takes a point on a pane in the pane's own terms: `a` along the wall from the pane's left
 * edge as the face is seen (0…w), `z` up from its sill (0…h). Mullions and sills stay the caller's.
 */
import type { MatName } from '../props'

/** The spill-light rim round a lit pane, and round the TV's. */
export const RIM: MatName = 'glassRose'
export const TV_RIM: MatName = 'glassViolet'

const odd = (a: number, z: number) => ((Math.floor(a) + Math.floor(z)) & 1) === 1

/**
 * Lamplight: white at the top left, a checker of white and gold, gold in the far corner. Half the pane or more
 * is `core`, which no eave's shade darkens, so a pane under a deep eave still reads lit.
 */
export function lamplight(a: number, z: number, w: number, h: number): MatName {
  const d = a / w + (h - z) / h
  if (d < 0.55) return 'core'
  if (d < 1.45) return odd(a, z) ? 'core' : 'gold'
  return 'gold'
}

/** A television's light: violet and cyan in a checker (blue), one brighter scan band across the top third, in a violet rim. */
export function television(a: number, z: number, _w: number, h: number): MatName {
  if (Math.abs(z - h * 0.68) < 0.55) return 'glassCyan'
  return odd(a, z) ? 'bandCyan' : 'glassViolet'
}

/** Whether a point lies on the one-px edge of the pane's rectangle (inside it). */
export function onRim(a: number, z: number, w: number, h: number): boolean {
  return a < 1 || a > w - 1 || z < 1 || z > h - 1
}
