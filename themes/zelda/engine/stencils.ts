/**
 * What a foe's blow will hit, stencilled on the floor before it lands: shapes in tiles, read off the foe's own brain
 * state. Both views draw them flat under everything that stands (`render/floorMarks.ts`), and the Parrot's blows ask
 * the same shapes (`inStencil`), so that standing outside the paint is standing clear.
 */
import type { Enemy } from '../types'
import { HERO_R, MIXTRAL } from '../types'
import { PARROT, type ParrotMove, type Reciter } from './parrot'
import { angleDiff } from './util'

export type StencilShape =
  /** A lane from (x0, y0) to (x1, y1) along `a`, `w` tiles wide, and `cap` tiles on past each end. */
  | { t: 'lane'; x0: number; y0: number; x1: number; y1: number; a: number; w: number; cap: number }
  | { t: 'ring'; x: number; y: number; r: number }
  /** The sector of radius `r` and angle `arc` about the way `a`. */
  | { t: 'arc'; x: number; y: number; r: number; a: number; arc: number }
  /** Footsteps from (x0, y0) to (x1, y1): where it will walk. Nothing there is hit. */
  | { t: 'steps'; x0: number; y0: number; x1: number; y1: number }
/** `k`: 0 to 1 as its tell runs out; `dim`: a copy's, painted fainter. */
export type Stencil = StencilShape & { k: number; dim?: boolean }

/** Is a hero's middle at (x, y) in the paint? */
export function inStencil(s: StencilShape, x: number, y: number): boolean {
  switch (s.t) {
    case 'lane': {
      const ux = Math.cos(s.a)
      const uy = Math.sin(s.a)
      const u = (x - s.x0) * ux + (y - s.y0) * uy
      const len = Math.hypot(s.x1 - s.x0, s.y1 - s.y0)
      return u >= -s.cap && u <= len + s.cap && Math.abs((y - s.y0) * ux - (x - s.x0) * uy) <= s.w / 2
    }
    case 'ring': return Math.hypot(x - s.x, y - s.y) <= s.r
    case 'arc': {
      const d = Math.hypot(x - s.x, y - s.y)
      return d <= s.r && (d < 1e-6 || angleDiff(Math.atan2(y - s.y, x - s.x), s.a) <= s.arc / 2)
    }
    case 'steps': return false
  }
}

/** The shape of the move a reciter of the Parrot's is on (`engine/parrot.ts`), from its place in `ai`. */
export function moveStencil(e: Enemy, p: Reciter): StencilShape | null {
  const n = (k: string) => e.ai[p + k] as number
  const move = (e.ai.said as string | undefined)?.[n('beat')] as ParrotMove | undefined
  const reach = e.r + HERO_R - 0.05
  switch (move) {
    case 'C': return { t: 'arc', x: n('x'), y: n('y'), r: PARROT.cut.r, a: n('a'), arc: PARROT.cut.arc }
    case 'S': return { t: 'ring', x: n('x'), y: n('y'), r: PARROT.spin }
    // As wide as the Parrot's touch, so the rush is all in the paint.
    case 'R': return { t: 'lane', x0: n('x'), y0: n('y'), x1: n('ex'), y1: n('ey'), a: n('a'), w: reach * 2, cap: reach }
    case 'H': return { t: 'ring', x: n('ex'), y: n('ey'), r: PARROT.hop.r }
    case 'B': return { t: 'ring', x: n('x'), y: n('y'), r: PARROT.blast }
    case 'W': return { t: 'steps', x0: n('x'), y0: n('y'), x1: n('ex'), y1: n('ey') }
    default: return null
  }
}

const unit = (k: number) => Math.max(0, Math.min(1, k))

/** The stencils a foe shows now. */
export function stencilsOf(e: Enemy): Stencil[] {
  if (e.dead) return []
  const out: Stencil[] = []
  if (e.kind === 'mixtral' && e.ai.mode === 'tell') {
    // As wide as the charge's touch (`contact`).
    const reach = e.r + HERO_R - 0.05
    const whole = e.ai.phase === 2 ? MIXTRAL.tell2 : MIXTRAL.tell
    const x1 = e.ai.lx as number
    const y1 = e.ai.ly as number
    const a = { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 }[e.dir]
    out.push({ t: 'lane', x0: e.x, y0: e.y, x1, y1, a, w: reach * 2, cap: reach, k: unit(1 - e.ai.tell / whole) })
  }
  if (e.kind === 'parrot') {
    for (const p of ['', 'c'] as const) {
      const bt = e.ai[`${p}bt`] as number
      // A move's footprint lies until it is done: the jump's, until it lands.
      if (e.ai.mode === 'recite' && (!p || e.ai.copy) && e.ai[`${p}on`]) {
        const st = moveStencil(e, p)
        const move = (e.ai.said as string)[e.ai[`${p}beat`] as number]
        if (st && (!e.ai[`${p}act`] || (move === 'H' && !e.ai[`${p}land`]))) out.push({ ...st, k: unit(bt / PARROT.show), dim: !!p })
      }
      // Its bomb on the floor: the blast's reach, while the fuse burns.
      const fuse = (e.ai[`${p}fuse`] as number | undefined) ?? 0
      if (fuse > 0) out.push({ t: 'ring', x: e.ai[`${p}bx`] as number, y: e.ai[`${p}by`] as number, r: PARROT.blast, k: unit(1 - fuse / PARROT.fuse), dim: !!p })
    }
  }
  return out
}
