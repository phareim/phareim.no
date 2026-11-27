/**
 * What a foe's blow will hit, stencilled on the floor before it lands: shapes in tiles, read off the foe's own brain
 * state. Both views draw them flat under everything that stands (`render/stencils.ts`).
 */
import type { Enemy } from '../types'
import { HERO_R, MIXTRAL } from '../types'
import { sycophantLanes } from './bossSycophant'

/**
 * A lane from (x0, y0) to (x1, y1), `w` tiles wide, and `cap` tiles on past each end: a hero whose middle is
 * outside it is not touched.
 */
export type Stencil = { t: 'lane'; x0: number; y0: number; x1: number; y1: number; w: number; cap: number; k: number }
  /** A straight way at any angle, `w` tiles wide, from (x0, y0) to (x1, y1): a gift's (`gifts.ts`). */
  | { t: 'ray'; x0: number; y0: number; x1: number; y1: number; w: number; k: number }

/** The stencils a foe shows now (`k`: 0 to 1 as its tell runs out). */
export function stencilsOf(e: Enemy): Stencil[] {
  if (e.dead) return []
  if (e.kind === 'sycophant') return sycophantLanes(e)
  if (e.kind === 'mixtral' && e.ai.mode === 'tell') {
    // As wide as the charge's touch (`contact`), so that standing outside the paint is standing clear.
    const reach = e.r + HERO_R - 0.05
    const whole = e.ai.phase === 2 ? MIXTRAL.tell2 : MIXTRAL.tell
    return [{ t: 'lane', x0: e.x, y0: e.y, x1: e.ai.lx as number, y1: e.ai.ly as number, w: reach * 2, cap: reach, k: Math.max(0, Math.min(1, 1 - e.ai.tell / whole)) }]
  }
  return []
}
