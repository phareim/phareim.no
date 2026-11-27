/**
 * THE NO (`ItemId 'no'`, the Steamhouse's treasure): a cut at the right moment refuses a blow. No slot, no button:
 * held by the flag `item:no`, used by swinging at the moment a foe's contact or lunge arrives.
 *
 * The window (`REFUSE`) opens with the opening swing of a chain (hit one) at its hit frame, or with a spin, and runs
 * to a moment after the swing ends; once one has opened no other opens for `cool` seconds. Hits two and three of a
 * chain carry none, so a hero who mashes A is covered under a third of the time and has to mean it. Nothing is held
 * and nothing is aimed. A blow met in the window, from a foe within `reach` in the front half of the swing's aim (all
 * round for the spin), does no harm: no hurt, no knock, no spent invulnerability, a gold ring where it met (event
 * `refuse`), and the foe reels `stun` seconds, which makes a tough foe `toughOpen` for the blade.
 *
 * It meets only what comes through `contact()` (`enemies.ts`): the ordinary and tough foes' touch and lunge. Shots,
 * shards, spikes, bombs and falls are as they were, and so is a `BIG` foe's blow: a boss is never refused.
 */
import type { Enemy } from '../types'
import { ROLL_IFRAMES, WINDUP } from '../types'
import { BIG, type Ctx } from './combat'
import { has } from './map'
import { swingDur } from './hero'
import { angleDiff, dirAngle } from './util'

/** The numbers of the window, first values to tune by playing. */
export const REFUSE = {
  /** Seconds the window stays open after the swing that opened it has ended. */
  tail: 0.1,
  /** Seconds from one window's opening to the next that may open. */
  cool: 0.9,
  /** The most a foe may be from the hero for a blow to be met (tiles, middle to middle). */
  reach: 2.2,
  /** Seconds the refused foe reels. */
  stun: 1.0,
}

/** Opens, holds and closes the window (every step the world runs; `engine/attendants.ts` calls it). */
export function stepRefuse(c: Ctx, dt: number) {
  const s = c.s
  const h = s.hero
  if (!has(s, 'item:no')) { h.refuseWin = undefined; return }
  if ((h.refuseCool ?? 0) > 0) h.refuseCool = Math.max(0, h.refuseCool! - dt)
  const sw = h.swing
  const live = h.spin
    ? { a: dirAngle(h.dir), spin: true }
    : sw && sw.n === 0 && sw.t / swingDur(sw) >= WINDUP ? { a: sw.a ?? dirAngle(sw.dir), spin: false } : null
  const w = h.refuseWin
  if (live) {
    if (!w && (live.spin || (h.refuseCool ?? 0) <= 0)) { h.refuseWin = { ...live }; h.refuseCool = REFUSE.cool }
    else if (w) { w.a = live.a; w.spin = live.spin; delete w.tail }
  } else if (w) {
    w.tail = (w.tail ?? REFUSE.tail) - dt
    if (w.tail <= 0) h.refuseWin = undefined
  }
}

/** Whether a blow can be refused right now (the window is open); used by the renderer's hint and by tests. */
export const refusing = (c: Ctx): boolean => !!c.s.hero.refuseWin

/**
 * The one call in `contact()`: the foe's touch or lunge is about to hurt. True when it was refused (the caller
 * hurts no one). Never for a boss, and never where `hurtHero` would not have hurt either (mercy, the roll's first
 * moments, the air, a door), so those keep their own rules and the two never both pay.
 */
export function tryRefuse(c: Ctx, e: Enemy): boolean {
  const h = c.s.hero
  const w = h.refuseWin
  if (!w || BIG.has(e.kind)) return false
  if (h.auto || h.invuln > 0 || h.air || h.act === 'fall' || h.act === 'dead' || h.act === 'get' || (h.roll && h.roll.t < ROLL_IFRAMES)) return false
  const dx = e.x - h.x
  const dy = e.y - h.y
  if (Math.hypot(dx, dy) > REFUSE.reach) return false
  if (!w.spin && angleDiff(Math.atan2(dy, dx), w.a) > Math.PI / 2) return false
  e.stun = Math.max(e.stun, REFUSE.stun)
  e.knock = null
  e.ai.tell = 0
  // A plain hound's lunge ends where it was refused: it rests, and comes again when it is up.
  if (e.kind === 'hound' && !e.tough) { e.ai.mode = 'rest'; e.ai.t = 0.5 }
  c.ev.push({ type: 'refuse', x: h.x + dx / 2, y: h.y + dy / 2 })
  return true
}
