/** Small helpers the boss brains share (2026-09-25). */
import type { BossAttackDef } from '../../bosses'
import type { Ctx } from '../ctx'
import type { BossRt } from './types'

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)
export const smooth = (u: number): number => { const v = clamp01(u); return v * v * (3 - 2 * v) }
export const approach = (v: number, to: number, rate: number, dt: number): number => v + (to - v) * Math.min(1, rate * dt)

/** A fan of `n` bolts along +z from (x, y, z), `spread` wide, skewed by `skew`. */
export function fan(ctx: Ctx, x: number, y: number, z: number, n: number, spread: number, mul: number, dmg: number, skew = 0, dy = 0): void {
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) - 0.5 : 0
    ctx.shots.boltDir(x, y, z, u * spread + skew, dy, mul, dmg)
  }
}

/** Seconds into the active window (0 before it). */
export function activeT(rt: BossRt): number {
  return rt.clock.stage === 'active' ? rt.clock.t : rt.clock.stage === 'recover' ? rt.clock.timing.active : 0
}

/** Seconds into the telegraph, as a 0 → 1 fraction (1 once past it). */
export function teleU(rt: BossRt): number {
  return rt.clock.stage === 'telegraph' ? clamp01(rt.clock.t / Math.max(0.01, rt.clock.timing.telegraph)) : 1
}

/** A staggered burst: how many of `n` shots are due `t` s into the window. */
export function dueShots(t: number, n: number, stagger: number): number {
  return Math.min(n, Math.floor(t / Math.max(0.001, stagger)) + 1)
}

export function param(atk: BossAttackDef, key: string, fallback: number): number {
  return atk.params?.[key] ?? fallback
}
