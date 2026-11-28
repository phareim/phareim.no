/**
 * FALCON (the Examination's miniboss in the Perch, docs/games/neon-shrine-examination.md): slightly deaf, never wrong.
 *
 * - It sits on its perch once, then circles the room's edge, and aims: at the Duck if it is down and in sight, else at
 *   the tile the hero stands on. The aim is stencilled (`falconStencils`: a lane to a ring) and does not steer.
 * - It dives down the lane. The lane hurts a hero as it passes, the ring where it lands; a Duck in the ring hops aside.
 * - Then it is stuck in the sand: open (`combat.ts` `bossRules`), harmless to touch. Longer if it dived at the Duck.
 *   In every other state it is stone to every blow, and its touch hurts (the dive's: by lane and ring alone).
 * - Free of the sand it gathers itself (`rise`: harmless, shut to blows), then flies.
 * - With half its hit points gone it aims quicker and dives twice, stuck only after the second.
 * The numbers are `FALCON`.
 */
import type { Enemy } from '../types'
import { FALCON } from '../types'
import { type Ctx, hurtHero } from './combat'
import { duckHop } from './duck'
import { cellRect, lineClear } from './map'
import type { Stencil } from './stencils'
import { STATS } from './spawn'
import { clamp, toDir } from './util'

/** The flight's loop keeps this far in from the room's walls. */
const INSET = 2.6

/** The point `d` tiles along the loop round the room (clockwise from its north-west corner). */
function loop(c: Ctx, e: Enemy, d: number): { x: number; y: number; len: number } {
  const z = cellRect(c.info, e.cell)
  const x0 = z.x + INSET
  const x1 = z.x + z.w - INSET
  const y0 = z.y + INSET
  const y1 = z.y + z.h - INSET
  const w = x1 - x0
  const h = y1 - y0
  const len = 2 * (w + h)
  let t = ((d % len) + len) % len
  if (t < w) return { x: x0 + t, y: y0, len }
  t -= w
  if (t < h) return { x: x1, y: y0 + t, len }
  t -= h
  if (t < w) return { x: x1 - t, y: y1, len }
  return { x: x0, y: y1 - (t - w), len }
}

/** Off to circle: from the point of the loop nearest to where it is. */
function takeOff(c: Ctx, e: Enemy) {
  const { len } = loop(c, e, 0)
  let best = 0
  let far = Infinity
  for (let d = 0; d < len; d += 0.25) {
    const p = loop(c, e, d)
    const q = Math.hypot(p.x - e.x, p.y - e.y)
    if (q < far) { far = q; best = d }
  }
  e.ai.mode = 'fly'
  e.ai.t = FALCON.fly
  e.ai.at = best
  e.ai.dives = 0
}

/** The aim, taken once: the Duck if it is down in sight, else the hero's tile; kept where its body fits. */
function aim(c: Ctx, e: Enemy) {
  const ai = e.ai
  const s = c.s
  const h = s.hero
  const duck = s.duck && lineClear(c.w, s.map, e.x, e.y, s.duck.x, s.duck.y) ? s.duck : null
  const at = duck ?? { x: Math.floor(h.x) + 0.5, y: Math.floor(h.y) + 0.5 }
  const z = cellRect(c.info, e.cell)
  const r = STATS.falcon.r
  ai.tx = clamp(at.x, z.x + 1 + r, z.x + z.w - 1 - r)
  ai.ty = clamp(at.y, z.y + 1 + r, z.y + z.h - 1 - r)
  ai.sx = e.x
  ai.sy = e.y
  ai.duck = !!duck
  ai.mode = 'tell'
  ai.whole = ai.phase === 2 ? FALCON.tell2 : FALCON.tell
  ai.t = ai.tell = ai.whole as number
  e.dir = toDir((ai.tx as number) - e.x, 0, e.dir)
  c.ev.push({ type: 'lever', x: e.x, y: e.y })
}

export function falcon(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  // (The round is read off its hit points, so it holds after a return to the room as well as after a blow.)
  if (e.hp <= STATS.falcon.hp / 2) ai.phase = 2
  switch (ai.mode) {
    case 'perch':
      if (ai.t <= 0) takeOff(c, e)
      return
    case 'fly': {
      ai.at = (ai.at as number) + FALCON.flySpeed * dt
      const p = loop(c, e, ai.at as number)
      const dx = p.x - e.x
      const dy = p.y - e.y
      const d = Math.hypot(dx, dy)
      // (From where it was stuck it comes up to the loop a little faster than it goes round it.)
      const step = Math.min(d, FALCON.flySpeed * 1.8 * dt)
      if (d > 1e-6) { e.x += (dx / d) * step; e.y += (dy / d) * step }
      e.dir = toDir(dx, 0, e.dir)
      if (ai.t <= 0) aim(c, e)
      return
    }
    case 'tell':
      if (ai.t > 0) return
      ai.mode = 'dive'
      ai.tell = 0
      ai.struck = false
      c.ev.push({ type: 'throw' })
      return
    case 'dive': {
      const sx = ai.sx as number
      const sy = ai.sy as number
      const len = Math.hypot((ai.tx as number) - sx, (ai.ty as number) - sy)
      const ux = len > 1e-6 ? ((ai.tx as number) - sx) / len : 0
      const uy = len > 1e-6 ? ((ai.ty as number) - sy) / len : 0
      const was = Math.hypot(e.x - sx, e.y - sy)
      const now = Math.min(len, was + FALCON.dive * dt)
      e.x = sx + ux * now
      e.y = sy + uy * now
      // The lane, as it passes: a hero whose middle is in the paint it has just gone over.
      const along = (h.x - sx) * ux + (h.y - sy) * uy
      const off = Math.abs((h.y - sy) * ux - (h.x - sx) * uy)
      if (!ai.struck && len > 0.05 && along >= was - 0.05 && along <= now && off <= FALCON.lane / 2 && hurtHero(c, FALCON.dmg, e.x - ux, e.y - uy, false, true)) ai.struck = true
      if (now < len - 1e-6) return
      land(c, e)
      return
    }
    case 'again':
      if (ai.t <= 0) aim(c, e)
      return
    case 'stuck':
      // (It gathers itself first: wings up, harmless, shut to blows, and then it flies.)
      if (ai.t <= 0) { ai.mode = 'rise'; ai.t = FALCON.rise }
      return
    case 'rise':
      if (ai.t <= 0) takeOff(c, e)
      return
  }
  // As it is made: onto its perch.
  ai.mode = 'perch'
  ai.t = FALCON.perch
}

/** It comes down: the ring's blow, the Duck out of the way, and then its second aim or the sand holds it. */
function land(c: Ctx, e: Enemy) {
  const ai = e.ai
  const h = c.s.hero
  const x = ai.tx as number
  const y = ai.ty as number
  const inRing = (px: number, py: number) => Math.hypot(px - x, py - y) <= FALCON.ring
  c.ev.push({ type: 'land' })
  c.s.shake = Math.max(c.s.shake, 0.25)
  if (!ai.struck && inRing(h.x, h.y)) hurtHero(c, FALCON.dmg, x, y, false, true)
  if (c.s.duck && inRing(c.s.duck.x, c.s.duck.y)) duckHop(c, (px, py) => !inRing(px, py))
  ai.dives = (ai.dives as number) + 1
  if (ai.phase === 2 && (ai.dives as number) < 2) {
    ai.mode = 'again'
    ai.t = FALCON.again
    return
  }
  ai.mode = 'stuck'
  ai.t = ai.duck ? FALCON.stare : FALCON.stuck
  // An opening begins: the blade's cap counts from nothing.
  ai.took = 0
}

/** A blow has hurt it (`combat.ts`): it stays planted, and at half its hit points it turns to diving twice. */
export function falconStruck(c: Ctx, e: Enemy) {
  e.knock = null
  if (e.dead || e.ai.phase === 2 || e.hp > STATS.falcon.hp / 2) return
  e.ai.phase = 2
  c.ev.push({ type: 'bossPhase', phase: 2 })
  c.ev.push({ type: 'hitStop', ms: 120 })
  c.s.shake = 0.4
}

/** The dive on the floor: a ring on the target and a thin lane to it, filling as the aim runs out. */
export function falconStencils(e: Enemy): Stencil[] {
  const ai = e.ai
  if (ai.mode !== 'tell' && ai.mode !== 'dive') return []
  const x = ai.tx as number
  const y = ai.ty as number
  const sx = ai.sx as number
  const sy = ai.sy as number
  const k = ai.mode === 'dive' ? 1 : Math.max(0, Math.min(1, 1 - ai.tell / (ai.whole as number)))
  const out: Stencil[] = []
  const len = Math.hypot(x - sx, y - sy)
  if (len > FALCON.ring) {
    const t = (len - FALCON.ring) / len
    out.push({ t: 'path', x0: sx, y0: sy, x1: sx + (x - sx) * t, y1: sy + (y - sy) * t, w: FALCON.lane, k })
  }
  out.push({ t: 'disc', x, y, r: FALCON.ring, k })
  return out
}
