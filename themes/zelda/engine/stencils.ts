/**
 * What a foe's blow will hit, stencilled on the floor before it lands: shapes in tiles, read off the foe's own brain
 * state. Both views draw them flat under everything that stands (`render/floorMarks.ts`), and the Parrot's blows ask
 * the same shapes (`inStencil`), so that standing outside the paint is standing clear.
 */
import type { Enemy } from '../types'
import { DARK_HOUND, HERO_R, MIXTRAL, ORCA } from '../types'
import { GROK, PHI } from './heapFoes'
import { PARROT, type ParrotMove, type Reciter } from './parrot'
import { angleDiff, dirVec } from './util'
import { sycophantLanes } from './bossSycophant'
import { golemStencils } from './bossGolem'
import type { LaneWorld } from './gifts'
import { boxStencils } from './bossBlackBox'
import { falconStencils } from './bossFalcon'

export type StencilShape =
  /** A lane from (x0, y0) to (x1, y1) along `a`, `w` tiles wide, and `cap` tiles on past each end. */
  | { t: 'lane'; x0: number; y0: number; x1: number; y1: number; a: number; w: number; cap: number }
  | { t: 'ring'; x: number; y: number; r: number }
  /** The sector of radius `r` and angle `arc` about the way `a`. */
  | { t: 'arc'; x: number; y: number; r: number; a: number; arc: number }
  /** Footsteps from (x0, y0) to (x1, y1): where it will walk. Nothing there is hit. */
  | { t: 'steps'; x0: number; y0: number; x1: number; y1: number }
  /** A straight way at any angle, `w` tiles wide, from (x0, y0) to (x1, y1): a gift's (`gifts.ts`). */
  | { t: 'ray'; x0: number; y0: number; x1: number; y1: number; w: number }
  /** The Lighthouse's one shape: a plain rectangle from (x0, y0) `len` tiles along the unit way (ux, uy), `w` wide. */
  | { t: 'strip'; x0: number; y0: number; ux: number; uy: number; len: number; w: number; hot?: boolean }
  // The examination's shapes (`render/examination.ts` `drawShape`), in tiles.
  | { t: 'disc'; x: number; y: number; r: number }
  | { t: 'box'; x: number; y: number; w: number; h: number }
  | { t: 'path'; x0: number; y0: number; x1: number; y1: number; w: number }
  /** The Black Box's: a face's strip (its middle; `vert`: it runs north to south) with its number. Nothing there is hit. */
  | { t: 'face'; x: number; y: number; vert: boolean; n: number; glow?: 'cyan' | 'pink'; spin?: number }
  /** The Black Box's: the dashed way of a beam to come. Nothing there is hit (the beam itself is). */
  | { t: 'dash'; x0: number; y0: number; x1: number; y1: number; hue: 'cyan' | 'pink' }
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
    case 'face': return false
    case 'dash': return false
    case 'strip': {
      const u = (x - s.x0) * s.ux + (y - s.y0) * s.uy
      return u >= 0 && u <= s.len && Math.abs((y - s.y0) * s.ux - (x - s.x0) * s.uy) <= s.w / 2
    }
    case 'disc': return Math.hypot(x - s.x, y - s.y) <= s.r
    case 'box': return x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h
    case 'path':
    case 'ray': {
      const dx = s.x1 - s.x0
      const dy = s.y1 - s.y0
      const len = Math.hypot(dx, dy) || 1
      const u = ((x - s.x0) * dx + (y - s.y0) * dy) / len
      return u >= 0 && u <= len && Math.abs((y - s.y0) * dx - (x - s.x0) * dy) / len <= s.w / 2
    }
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
export function stencilsOf(e: Enemy, lw?: LaneWorld): Stencil[] {
  if (e.dead) return []
  if (e.kind === 'sycophant') return sycophantLanes(e, lw)
  if (e.kind === 'golem') return golemStencils(e)
  if (e.kind === 'blackbox') return boxStencils(e)
  if (e.kind === 'falcon') return falconStencils(e)
  const out: Stencil[] = []
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
  if (e.kind === 'mixtral' && (e.ai.mode === 'tell' || e.ai.mode === 'charge')) {
    // As wide as the charge's touch (`contact`).
    const reach = e.r + HERO_R - 0.05
    const whole = e.ai.phase === 2 ? MIXTRAL.tell2 : MIXTRAL.tell
    const x1 = e.ai.lx as number
    const y1 = e.ai.ly as number
    const a = { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 }[e.dir]
    out.push({ t: 'lane', x0: e.x, y0: e.y, x1, y1, a, w: reach * 2, cap: reach, k: unit(1 - e.ai.tell / whole) })
  }
  // GROK's roll and PHI's dart: the lane as wide as the blow, from where it is to where it will end.
  const rolling = e.ai.mode === 'tell' || e.ai.mode === (e.kind === 'grok' ? 'roll' : 'dart') || (e.kind === 'grok' && e.ai.mode === 'drill')
  if ((e.kind === 'grok' || e.kind === 'phi') && rolling && e.stun <= 0) {
    const a = { left: Math.PI, right: 0, up: -Math.PI / 2, down: Math.PI / 2 }[e.dir]
    const whole = e.kind === 'phi' ? PHI.tell : e.ai.phase === 2 ? GROK.tell2 : GROK.tell
    out.push({ t: 'lane', x0: e.x, y0: e.y, x1: e.ai.lx as number, y1: e.ai.ly as number, a, w: e.kind === 'phi' ? PHI.lane : GROK.lane, cap: e.r, k: unit(1 - e.ai.tell / whole) })
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
