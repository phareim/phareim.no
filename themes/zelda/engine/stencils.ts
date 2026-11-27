/**
 * What a foe's blow will hit, stencilled on the floor before it lands: shapes in tiles, read off the foe's own brain
 * state. Both views draw them flat under everything that stands (`render/stencils.ts`).
 */
import type { Enemy } from '../types'
import { HERO_R, MIXTRAL } from '../types'

/**
 * A lane from (x0, y0) to (x1, y1), `w` tiles wide, and `cap` tiles on past each end: a hero whose middle is
 * outside it is not touched.
 */
export type Stencil = { t: 'lane'; x0: number; y0: number; x1: number; y1: number; w: number; cap: number; k: number }
  // The examination's shapes (`render/examination.ts` `drawShape`), in tiles; `k` fills them, `dim` is a fainter copy.
  | { t: 'disc'; x: number; y: number; r: number; k: number; dim?: boolean }
  | { t: 'box'; x: number; y: number; w: number; h: number; k: number; dim?: boolean }
  | { t: 'path'; x0: number; y0: number; x1: number; y1: number; w: number; k: number; dim?: boolean }

/** The stencils a foe shows now (`k`: 0 to 1 as its tell runs out). */
export function stencilsOf(e: Enemy): Stencil[] {
  if (e.dead) return []
  if (e.kind === 'mixtral' && e.ai.mode === 'tell') {
    // As wide as the charge's touch (`contact`), so that standing outside the paint is standing clear.
    const reach = e.r + HERO_R - 0.05
    const whole = e.ai.phase === 2 ? MIXTRAL.tell2 : MIXTRAL.tell
    return [{ t: 'lane', x0: e.x, y0: e.y, x1: e.ai.lx as number, y1: e.ai.ly as number, w: reach * 2, cap: reach, k: Math.max(0, Math.min(1, 1 - e.ai.tell / whole)) }]
  }
  return []
}
