/**
 * What a foe's blow will hit, stencilled on the floor before it lands: shapes in tiles, read off the foe's own brain
 * state. Both views draw them flat under everything that stands (`render/stencils.ts`).
 */
import type { Enemy } from '../types'
import { DARK_HOUND, HERO_R, MIXTRAL, ORCA } from '../types'
import { dirVec } from './util'

/**
 * A lane from (x0, y0) to (x1, y1), `w` tiles wide, and `cap` tiles on past each end: a hero whose middle is
 * outside it is not touched.
 */
export type Stencil =
  | { t: 'lane'; x0: number; y0: number; x1: number; y1: number; w: number; cap: number; k: number }
  /** The Lighthouse's one shape: a plain rectangle from (x0, y0) `len` tiles along the unit way (ux, uy), `w` wide. */
  | { t: 'strip'; x0: number; y0: number; ux: number; uy: number; len: number; w: number; k: number }

/** The stencils a foe shows now (`k`: 0 to 1 as its tell runs out). */
export function stencilsOf(e: Enemy): Stencil[] {
  if (e.dead) return []
  // How far a tell of `whole` s has run, 0 to 1.
  const run = (whole: number) => Math.max(0, Math.min(1, 1 - e.ai.tell / whole))
  if (e.kind === 'orca' && e.stun <= 0) {
    const v = dirVec(e.dir)
    // The drag's lane, from its middle to where its bow will stop: up while it is told and while it dashes.
    if (e.ai.mode === 'dragTell' || e.ai.mode === 'drag') {
      const went = e.ai.mode === 'drag' ? (e.ai.went as number) : 0
      const x0 = e.x - v.x * went
      const y0 = e.y - v.y * went
      const len = e.ai.mode === 'drag' ? ORCA.dragLen : Math.hypot((e.ai.lx as number) - e.x, (e.ai.ly as number) - e.y) + e.r
      // (A dash a wall ends early keeps the lane the tell showed, less what the wall takes off it.)
      const shown = Math.min(len, Math.hypot((e.ai.lx as number) - x0, (e.ai.ly as number) - y0) + e.r)
      return [{ t: 'strip', x0, y0, ux: v.x, uy: v.y, len: shown, w: ORCA.dragW, k: e.ai.mode === 'drag' ? 1 : run(ORCA.dragTell) }]
    }
    if (e.ai.mode === 'sweepTell' || e.ai.mode === 'swing') {
      return [{ t: 'strip', x0: e.x + v.x * ORCA.sweepFrom, y0: e.y + v.y * ORCA.sweepFrom, ux: v.x, uy: v.y, len: ORCA.sweepTo - ORCA.sweepFrom, w: ORCA.sweepW, k: e.ai.mode === 'swing' ? 1 : run(ORCA.sweepTell) }]
    }
  }
  // The dark hound's lane: from where it stands to where its lunge will end, and the reach of its bite beyond.
  if (e.dark && e.stun <= 0 && e.ai.mode === 'tell' && e.ai.tell > 0) {
    const dx = (e.ai.lx as number) - e.x
    const dy = (e.ai.ly as number) - e.y
    const d = Math.hypot(dx, dy) || 1
    return [{ t: 'strip', x0: e.x, y0: e.y, ux: dx / d, uy: dy / d, len: d + e.r + HERO_R - 0.05, w: DARK_HOUND.w, k: run(DARK_HOUND.tell) }]
  }
  if (e.kind === 'mixtral' && e.ai.mode === 'tell') {
    // As wide as the charge's touch (`contact`), so that standing outside the paint is standing clear.
    const reach = e.r + HERO_R - 0.05
    const whole = e.ai.phase === 2 ? MIXTRAL.tell2 : MIXTRAL.tell
    return [{ t: 'lane', x0: e.x, y0: e.y, x1: e.ai.lx as number, y1: e.ai.ly as number, w: reach * 2, cap: reach, k: Math.max(0, Math.min(1, 1 - e.ai.tell / whole)) }]
  }
  return []
}
