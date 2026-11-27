/**
 * THE STOCHASTIC PARROT (the Echo Barrow's boss; docs/games/neon-shrine.md, "The Stochastic Parrot"): it has heard
 * everything and understood none of it. Its brain goes round four states:
 *
 * - *listen*: it hops sideways round the hero at a distance and notes what the hero does (the moves: C a cut, S a
 *   spin, R a roll, H a hop or any air move, B a bomb laid, W a second with none of those), keeping the last three;
 *   with fewer than two moves heard (a walk is none) it makes the phrase up to two from the ones that hurt;
 * - *recite*: it gives the three back in another order, one to a beat: the move's footprint is stencilled from where
 *   it stands toward where the hero stands, and then it does it. From half its hit points a still copy of it, left
 *   where it stood, recites the same a moment later;
 * - *think*: open to the blade;
 * - *rouse*: harmless, it leaps off to listen again, away from the hero and from an echo.
 *
 * Everything it will hit is a shape in `engine/stencils.ts`, built from its `ai` and asked by the blow itself, so the
 * paint on the floor and the harm are one thing. Hit rules: `combat.ts` `bossRules`.
 */
import type { Enemy } from '../types'
import { BOMB_FUSE, BOMB_RADIUS, HERO_R } from '../types'
import { hurtHero, type Ctx } from './combat'
import { ECHO_R } from './echo'
import { cellRect, circleBlocked, moveCircle } from './map'
import { inStencil, moveStencil } from './stencils'
import { chance, clamp, nextId, pick } from './util'

export const PARROT = {
  /** Seconds it listens, and how long without a move counts as a walk. */
  listen: 2.4, quiet: 1,
  /** A beat of the recital, how long its stencil lies before the move, and how far behind the copy recites. */
  beat: 0.9, show: 0.5, lag: 0.45,
  /** Open: after a recital, and after the echo has struck its back; what one such opening gives the blade. */
  think: 2, struck: 1.2, take: 6,
  rouse: 0.6,
  /** Listening: it keeps this far off, hopping this often, this long in the air. */
  ring: 4, hopEvery: 0.48, hopAir: 0.3,
  /** The moves: the cut's arc, the spin's ring, the rush, the jump and its landing, the three steps. */
  cut: { r: 2.1, arc: Math.PI * 0.9 }, spin: 1.8, roll: { len: 2.4, time: 0.22 }, hop: { len: 2, r: 1.2, time: 0.3 }, walk: { len: 1.8, time: 0.36 },
  /** Its bomb's fuse, and the paint round it: where the ordinary blast reaches the hero's middle. */
  fuse: 1.2, blast: BOMB_RADIUS + HERO_R - 0.2,
  /** Its own bomb catches it only this near: "still there". A rush, a jump or its steps carry it farther in time. */
  there: 1.2,
  /** A move's blow: a heart. */
  dmg: 2,
} as const

export type ParrotMove = 'C' | 'S' | 'R' | 'H' | 'B' | 'W'
/** Who recites: the Parrot (''), or the copy it leaves ('c'): each keeps its place in `ai` under that prefix. */
export type Reciter = '' | 'c'

const num = (e: Enemy, k: string) => (e.ai[k] as number | undefined) ?? 0

/** The radius of its middle: what must stay on open floor when it stands against something. */
const CORE = 0.1

/** Is its body harmless now: open, rousing, not yet begun, or in the air of its own rush or jump? */
export const parrotHarmless = (e: Enemy) => e.ai.mode === 'think' || e.ai.mode === 'rouse' || e.ai.mode === 'idle' || !!e.ai.air

/** The floor of its room, as far as its middle may go; `spare` tiles further, into the mouth of a doorway. */
function inside(c: Ctx, e: Enemy, x: number, y: number, spare = 0) {
  const z = cellRect(c.info, e.cell)
  const m = 1 + e.r - spare
  return { x: clamp(x, z.x + m, z.x + z.w - m), y: clamp(y, z.y + m, z.y + z.h - m) }
}

/** May it come down at (x, y): clear of walls, pillars and pots, and not on the echo. */
function free(c: Ctx, e: Enemy, x: number, y: number) {
  const echo = c.s.echo
  return !circleBlocked(c.w, c.s.map, x, y, e.r, 'enemy') && !(echo && Math.hypot(x - echo.x, y - echo.y) < e.r + ECHO_R)
}

/** A jump's way from where it began (`ai.fx`, `fy`) to where it lands (`hx`, `hy`): over whatever lies between. */
function leap(e: Enemy, k: number, high: number) {
  e.x = num(e, 'fx') + (num(e, 'hx') - num(e, 'fx')) * k
  e.y = num(e, 'fy') + (num(e, 'hy') - num(e, 'fy')) * k
  e.ai.z = k < 1 ? Math.sin(Math.PI * k) * high : 0
}

/** Where `len` tiles along `a` from (x, y) end, by the walker's own collision: a pillar or the wall stops it short. */
function along(c: Ctx, e: Enemy, x: number, y: number, a: number, len: number) {
  // (Setting off from against a pillar it walked up to, only its middle collides.)
  const wide = circleBlocked(c.w, c.s.map, x, y, e.r, 'enemy') ? CORE : e.r
  for (let d = 0; d < len - 1e-9; d += 0.1) {
    const k = Math.min(0.1, len - d)
    const r = moveCircle(c.w, c.s.map, x, y, wide, Math.cos(a) * k, Math.sin(a) * k, 'enemy')
    const p = inside(c, e, r.x, r.y)
    x = p.x
    y = p.y
    if (r.hitX || r.hitY || p.x !== r.x || p.y !== r.y) break
  }
  return { x, y }
}

// ---------------------------------------------------------------------------
// Listening
// ---------------------------------------------------------------------------

/** The newest of the hero's own bombs on the floor. */
const heroBomb = (c: Ctx) => c.s.map.bombs.reduce((n, b) => (b.by ? n : Math.max(n, b.id)), 0)

function listen(c: Ctx, e: Enemy) {
  const h = c.s.hero
  Object.assign(e.ai, {
    mode: 'listen', t: PARROT.listen, heard: '', quiet: 0, hop: 0, z: 0, air: false,
    // (What is already under way is not news: only a move that begins now.)
    swT: h.swing ? h.swing.t : -9, spT: h.spin ? h.spin.t : -9, roT: h.roll ? h.roll.t : -9, aiT: h.air ? h.air.t : -9,
    bomb: heroBomb(c), side: chance(c.s, 0.5) ? 1 : -1,
  })
}

/** Takes note of what the hero begins this step. */
function hear(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  let heard = ai.heard as string
  const note = (m: ParrotMove) => { heard = (heard + m).slice(-3); ai.quiet = 0 }
  // A move's clock starting over (or starting at all) is a new one.
  const began = (key: string, now: { t: number } | null | undefined, m: ParrotMove) => {
    const was = num(e, key)
    if (now && (was === -9 || now.t < was)) note(m)
    ai[key] = now ? now.t : -9
  }
  began('swT', h.swing, 'C')
  began('spT', h.spin, 'S')
  began('roT', h.roll, 'R')
  began('aiT', h.air, 'H')
  const bomb = heroBomb(c)
  if (bomb > num(e, 'bomb')) note('B')
  ai.bomb = bomb
  ai.quiet = num(e, 'quiet') + dt
  if (num(e, 'quiet') >= PARROT.quiet) note('W')
  ai.heard = heard
}

/** A sideways hop round the hero, keeping its distance; walled in on one side, it goes round the other way. */
function circle(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (num(e, 'hop') <= 0) {
    const from = Math.atan2(e.y - h.y, e.x - h.x)
    let to: { x: number; y: number } | null = null
    // This way round, a longer hop if the near spot is taken; then the other way.
    for (const turn of [0.55, 0.9, -0.55, -0.9]) {
      const a = from + num(e, 'side') * turn
      const p = inside(c, e, h.x + Math.cos(a) * PARROT.ring, h.y + Math.sin(a) * PARROT.ring)
      if (Math.hypot(p.x - e.x, p.y - e.y) < 0.8 || Math.hypot(p.x - h.x, p.y - h.y) < 2.8 || !free(c, e, p.x, p.y)) continue
      if (turn < 0) ai.side = -num(e, 'side')
      to = p
      break
    }
    Object.assign(ai, { fx: e.x, fy: e.y, hx: to?.x ?? e.x, hy: to?.y ?? e.y, hop: PARROT.hopEvery })
  }
  ai.hop = num(e, 'hop') - dt
  const k = Math.min(1, (PARROT.hopEvery - num(e, 'hop')) / PARROT.hopAir)
  leap(e, k, 0.5)
}

/**
 * Where a walk of `len` tiles along `a` from (x, y) ends. It walks straight, up over any pot or pillar, and may come to
 * rest leaning on one, its middle on open floor (where the blade reaches it); after a hero who is in a doorway it goes
 * on into the doorway's mouth. So nowhere in its room is a refuge from its body.
 */
function stroll(c: Ctx, e: Enemy, x: number, y: number, a: number, len: number) {
  const z = cellRect(c.info, e.cell)
  const h = c.s.hero
  const doorway = h.x < z.x + 1 || h.x > z.x + z.w - 1 || h.y < z.y + 1 || h.y > z.y + z.h - 1
  const to = inside(c, e, x + Math.cos(a) * len, y + Math.sin(a) * len, doorway ? 0.9 : 0)
  // Ending up on something solid, it steps off to the open floor nearest by, on the hero's side of it.
  for (let r = 0; r <= 1.5; r += 0.25) {
    let best: { x: number; y: number } | null = null
    for (let i = 0; i < (r ? 16 : 1); i++) {
      const p = inside(c, e, to.x + Math.cos((i / 16) * Math.PI * 2) * r, to.y + Math.sin((i / 16) * Math.PI * 2) * r, doorway ? 0.9 : 0)
      if (circleBlocked(c.w, c.s.map, p.x, p.y, CORE, 'enemy')) continue
      if (!best || Math.hypot(p.x - h.x, p.y - h.y) < Math.hypot(best.x - h.x, best.y - h.y)) best = p
    }
    if (best) return best
  }
  return to
}

/** How high it stands where it is: up on whatever solid is under it. */
const perch = (c: Ctx, e: Enemy) => (circleBlocked(c.w, c.s.map, e.x, e.y, e.r * 0.6, 'enemy') ? 0.7 : 0)

// ---------------------------------------------------------------------------
// Reciting
// ---------------------------------------------------------------------------

/** The three moves in an order other than the one they were done in (three of a kind have only the one). */
function another(c: Ctx, heard: string): string {
  const [a, b, d] = [heard[0]!, heard[1]!, heard[2]!]
  const other = [a + d + b, b + a + d, b + d + a, d + a + b, d + b + a].filter(o => o !== heard)
  return other.length ? pick(c.s, other) : heard
}

function recite(c: Ctx, e: Enemy) {
  const ai = e.ai
  // Fewer than two moves heard (a walk is no move): it makes up the rest, from what hurts, drawn by the game's own rng.
  let said = ai.heard as string
  if (said.replace(/W/g, '').length < 2) {
    said = said.replace(/W/g, '')
    while (said.length < 2) said += pick(c.s, ['C', 'S', 'R', 'H', 'B'])
  }
  const heard = (said + 'WWW').slice(0, 3)
  Object.assign(ai, { mode: 'recite', t: 0, said: another(c, heard), z: 0, air: false, beat: 0, bt: 0, on: false, copy: false })
  // Half its hit points gone: it leaves a copy of itself where it listened from.
  if (ai.phase === 2) Object.assign(ai, { copy: true, cx: e.x, cy: e.y, cbeat: 0, cbt: -PARROT.lag, con: false })
}

/** One step of a reciter's beat: the stencil, the move, its landing. */
function perform(c: Ctx, e: Enemy, p: Reciter, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  const beat = num(e, `${p}beat`)
  if (beat >= 3) return
  const bt = num(e, `${p}bt`) + dt
  ai[`${p}bt`] = bt
  if (bt < 0) return
  const move = (ai.said as string)[beat] as ParrotMove
  if (!ai[`${p}on`]) {
    // The beat begins: aimed from where it stands at where the hero stands now.
    const x = p ? num(e, 'cx') : e.x
    const y = p ? num(e, 'cy') : e.y
    const a = Math.atan2(h.y - y, h.x - x)
    const len = move === 'R' ? PARROT.roll.len : move === 'H' ? PARROT.hop.len : move === 'W' ? PARROT.walk.len : 0
    const end = !len ? { x, y } : move === 'W' ? stroll(c, e, x, y, a, len) : along(c, e, x, y, a, len)
    Object.assign(ai, { [`${p}on`]: true, [`${p}act`]: false, [`${p}land`]: false, [`${p}a`]: a, [`${p}x`]: x, [`${p}y`]: y, [`${p}ex`]: end.x, [`${p}ey`]: end.y })
  }
  /** The move has come: its sound and its flash (`recited`). */
  const show = (m: 'C' | 'S' | 'R' | 'H', end = false) => c.ev.push({ type: 'recited', move: m, x: num(e, p + (end ? 'ex' : 'x')), y: num(e, p + (end ? 'ey' : 'y')), a: num(e, `${p}a`) })
  const strike = () => {
    const st = moveStencil(e, p)
    if (st && inStencil(st, h.x, h.y)) hurtHero(c, PARROT.dmg, num(e, `${p}x`), num(e, `${p}y`), false, true)
  }
  const done = bt - PARROT.show
  if (done >= 0 && !ai[`${p}act`]) {
    ai[`${p}act`] = true
    if (move === 'C' || move === 'S' || move === 'R') strike()
    if (move === 'C' || move === 'S' || move === 'R') show(move)
    if (move === 'B') {
      const x = num(e, `${p}x`)
      const y = num(e, `${p}y`)
      c.s.map.bombs.push({ id: nextId(c.s), x, y, t: BOMB_FUSE - PARROT.fuse, by: p ? 'copy' : 'parrot' })
      Object.assign(ai, { [`${p}fuse`]: PARROT.fuse, [`${p}bx`]: x, [`${p}by`]: y })
      c.ev.push({ type: 'bombPlace' })
    }
  }
  if (move === 'H' && done >= PARROT.hop.time && !ai[`${p}land`]) {
    ai[`${p}land`] = true
    strike()
    show(move, true)
  }
  // The Parrot itself goes where the move takes it, along the painted line; the copy stands still.
  if (!p && done >= 0 && (move === 'R' || move === 'H' || move === 'W')) {
    const k = Math.min(1, done / PARROT[move === 'R' ? 'roll' : move === 'H' ? 'hop' : 'walk'].time)
    e.x = num(e, 'x') + (num(e, 'ex') - num(e, 'x')) * k
    e.y = num(e, 'y') + (num(e, 'ey') - num(e, 'y')) * k
    // (Its rush and its jump are over the hero's head; its three little steps are not.)
    ai.air = move !== 'W' && k < 1
    ai.z = k >= 1 ? perch(c, e) : move === 'H' ? Math.sin(Math.PI * k) * 1.1 : move === 'W' ? Math.max(perch(c, e), Math.abs(Math.sin(Math.PI * 3 * k)) * 0.2) : 0
  }
  if (bt >= PARROT.beat) {
    ai[`${p}beat`] = beat + 1
    ai[`${p}bt`] = bt - PARROT.beat
    ai[`${p}on`] = false
  }
}

// ---------------------------------------------------------------------------
// Thinking, rousing
// ---------------------------------------------------------------------------

/** Open for `secs`: its copy goes, and the blade has a fresh `take`. */
function think(c: Ctx, e: Enemy, secs: number) {
  Object.assign(e.ai, { mode: 'think', t: secs, took: 0, copy: false, air: false, z: perch(c, e), on: false })
}

/** The echo's blade at its back: the recital breaks off and it stops to think. */
export function parrotStruck(c: Ctx, e: Enemy) {
  if (e.ai.mode === 'think') return
  think(c, e, PARROT.struck)
  c.s.shake = Math.max(c.s.shake, 0.2)
}

/** Shut again, it leaps to the best spot round the hero: far from the hero and from an echo, not far to go. */
function rouse(c: Ctx, e: Enemy) {
  const h = c.s.hero
  const echo = c.s.echo
  let best = { x: e.x, y: e.y }
  let score = -Infinity
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    const p = inside(c, e, h.x + Math.cos(a) * PARROT.ring, h.y + Math.sin(a) * PARROT.ring)
    if (!free(c, e, p.x, p.y)) continue
    const v = Math.min(PARROT.ring, Math.hypot(p.x - h.x, p.y - h.y)) * 2
      + (echo ? Math.min(PARROT.ring, Math.hypot(p.x - echo.x, p.y - echo.y)) * 1.5 : 0) - Math.hypot(p.x - e.x, p.y - e.y) * 0.2
    if (v > score) { score = v; best = p }
  }
  Object.assign(e.ai, { mode: 'rouse', t: PARROT.rouse, fx: e.x, fy: e.y, hx: best.x, hy: best.y })
}

export function parrot(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  // It always faces the hero.
  e.dir = h.x > e.x ? 'right' : 'left'
  for (const k of ['fuse', 'cfuse']) if (num(e, k) > 0) ai[k] = num(e, k) - dt
  switch (ai.mode) {
    case 'idle':
      if (ai.t <= 0) listen(c, e)
      return
    case 'listen':
      circle(c, e, dt)
      hear(c, e, dt)
      if (ai.t <= 0) recite(c, e)
      return
    case 'recite':
      perform(c, e, '', dt)
      if (ai.copy) perform(c, e, 'c', dt)
      if (num(e, 'beat') >= 3 && (!ai.copy || num(e, 'cbeat') >= 3)) think(c, e, PARROT.think)
      return
    case 'think':
      if (ai.t <= 0) rouse(c, e)
      return
    case 'rouse':
      leap(e, clamp(1 - ai.t / PARROT.rouse, 0, 1), 0.9)
      if (ai.t <= 0) listen(c, e)
  }
}
