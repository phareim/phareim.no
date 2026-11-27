/**
 * COPILOT, the Road's miniboss (docs/games/neon-shrine.md "COPILOT"): a wagon that runs on the screen, not on the
 * world. Its place is `r`, tiles in from the screen's left edge (`engine/chase.ts`), so its round is the same while
 * the screen scrolls and after it has stopped. It ignores the road's pits and wagons, and its touch is harmless but
 * in a pass.
 *
 *   behind   off the screen to the left
 *   honk     the tell: its headlights at the edge, the lane stencilled pink as high as what will hurt
 *   pass     it drives through, the whole screen across: a hero whose feet are low as it goes by is hurt (a jump
 *            clears it). Nowhere on the screen is out of its way.
 *   back     it brakes and rolls back to where it stands; harmless
 *   stall    it stands in the road: open to the blade (`take` a stall) and to the stomp (one a stall)
 *   rev      the tell of its leaving: still standing, still a thing to stomp
 *   leave    it drives off to the right
 */
import type { Enemy } from '../types'
import { HERO_R } from '../types'
import { hurtHero, type Ctx } from './combat'

/**
 * Seconds, tiles and tiles/s. `first`: the screen has moved this long before the first honk. `up`: its middle over
 * the road. `hit`: the wagon as drawn is this high, and a pass hurts feet lower than this over the road, within `half` tiles of its middle (and the hero's
 * own radius). `take`: the most the blade takes in one stall. `stomp`: what a stomp takes.
 */
export const COPILOT = {
  first: 3, behind: 2.2, honk: 1.2, from: -4, past: 16, to: 9, speed: 11, stall: 3.6, rev: 0.5, away: 12, leave: 1, off: -5,
  up: 0.7, hit: 15 / 16, half: 0.6, dmg: 2, take: 4, stomp: 3, spin: 0.8,
} as const

/** It stands still in the road: the stomp may come down on it (`stomp.ts`). */
export const copilotStill = (e: Enemy) => e.ai.mode === 'stall' || e.ai.mode === 'rev'

/** The road's top under it (tiles down), by the row it was placed on. */
export const copilotRoad = (e: Enemy) => Math.floor(e.home.y) + 1

export function copilot(c: Ctx, e: Enemy, dt: number) {
  const s = c.s
  const ai = e.ai
  const left = s.map.chase?.left ?? s.zone.x
  const road = copilotRoad(e)
  let r = (ai.r as number | undefined) ?? COPILOT.off
  const to = (mode: string, t: number) => { ai.mode = mode; ai.t = t; ai.tell = mode === 'honk' || mode === 'rev' ? t : 0 }
  if (ai.mode === 'idle') to('behind', COPILOT.first)
  // The screen has not begun to move: it has not begun to come.
  if ((s.map.chase?.wait ?? 0) > 0) ai.t = COPILOT.first
  switch (ai.mode) {
    case 'behind':
      r = COPILOT.off
      if (ai.t <= 0) { to('honk', COPILOT.honk); c.ev.push({ type: 'honk' }) }
      break
    case 'honk':
      if (ai.t <= 0) { to('pass', 0); r = COPILOT.from }
      break
    case 'pass':
      r = Math.min(COPILOT.past, r + COPILOT.speed * dt)
      if (r >= COPILOT.past) to('back', 0)
      break
    case 'back':
      r = Math.max(COPILOT.to, r - COPILOT.speed * dt)
      if (r <= COPILOT.to) { to('stall', COPILOT.stall); ai.took = 0; ai.stomped = false }
      break
    case 'stall':
      if (ai.t <= 0) to('rev', COPILOT.rev)
      break
    case 'rev':
      if (ai.t <= 0) to('leave', COPILOT.leave)
      break
    case 'leave':
      r += COPILOT.away * dt
      if (ai.t <= 0) { to('behind', COPILOT.behind); r = COPILOT.off }
      break
  }
  ai.r = r
  e.x = left + r
  e.y = road - COPILOT.up
  e.dir = 'right'
  if (ai.mode !== 'pass') return
  const h = s.hero
  if (Math.abs(h.x - e.x) < COPILOT.half + HERO_R && h.y + HERO_R > road - COPILOT.hit && h.invuln <= 0) {
    // Nothing but the air dodges it: no roll goes under a wagon.
    h.roll = null
    hurtHero(c, COPILOT.dmg, e.x, e.y)
  }
}
