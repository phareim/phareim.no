/**
 * ORCA (the Lighthouse's miniboss in the Flooded Cellar, docs/games/neon-shrine-lighthouse.md): half a boat, stranded
 * since the sea was drained off. It rows slowly, keeping off the hero, and strikes in two ways, each stencilled on the
 * floor before it lands (`stencils.ts`): further off, a DRAG down a straight lane, its oar planted at the end; near, a
 * SWEEP of the oar through a box in front of it. Planted or off balance it is open to the blade (`combat.ts`
 * `bossRules`). Its touch does no harm (`STATS.orca.dmg` 0): only the two strikes hurt, from here. The storm lamp's
 * beam burns it and stuns it, which cancels a strike on its way (`orcaStunned`). The numbers are `ORCA`.
 */
import type { Dir, Enemy } from '../types'
import { ORCA } from '../types'
import { type Ctx, hurtHero } from './combat'
import { heroDist, lineEnd, seesHero, walk } from './enemies'
import { cellRect, circleBlocked } from './map'
import { dirVec, toDir } from './util'

/** The four-way facing along the longer axis toward (dx, dy). */
const axisTo = (dx: number, dy: number): Dir => (Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down')

function rest(e: Enemy) {
  e.ai.mode = 'idle'
  e.ai.t = ORCA.idle
  e.ai.tell = 0
}

/** An opening begins: the blade's cap counts from nothing. */
function open(e: Enemy, mode: 'planted' | 'off', time: number) {
  e.ai.mode = mode
  e.ai.t = time
  e.ai.tell = 0
  e.ai.took = 0
}

/**
 * The lamp's stun has just landed: a strike announced or under way is over, and the stun is an opening of its own.
 * (Stunned while already open, the opening goes on where it was, with what it has left to give.)
 */
export function orcaStunned(e: Enemy) {
  if (e.ai.mode === 'planted' || e.ai.mode === 'off') return
  rest(e)
  e.ai.took = 0
}

/**
 * Is the hero's middle in the box from `from` to `to` tiles ahead of (x, y) along the facing `d`, `w` wide? (The same
 * box the floor shows.)
 */
function inBox(c: Ctx, x: number, y: number, d: Dir, from: number, to: number, w: number): boolean {
  const h = c.s.hero
  const v = dirVec(d)
  const along = (h.x - x) * v.x + (h.y - y) * v.y
  const across = Math.abs((h.x - x) * v.y - (h.y - y) * v.x)
  return along >= from && along <= to && across <= w / 2
}

/** A strike lands on the hero once, at most. */
function strike(c: Ctx, e: Enemy) {
  const v = dirVec(e.dir)
  // (Thrown off along the strike's way, from a little behind the hero.)
  if (hurtHero(c, ORCA.dmg, c.s.hero.x - v.x, c.s.hero.y - v.y, false, true)) e.ai.struck = true
}

export function orca(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  const dx = h.x - e.x
  const dy = h.y - e.y
  switch (ai.mode) {
    case 'dragTell': {
      // (The lane is fixed as the tell begins; a lamp set down in it since stops the dash short, and the floor says so.)
      const v = dirVec(e.dir)
      const end = lineEnd(c, e, v.x, v.y, ORCA.dragLen - e.r)
      ai.lx = end.x
      ai.ly = end.y
      if (ai.t <= 0) {
        ai.mode = 'drag'
        ai.tell = 0
        ai.went = 0
        ai.struck = false
        c.ev.push({ type: 'push', x: e.x, y: e.y })
      }
      return
    }
    case 'drag': {
      const v = dirVec(e.dir)
      const left = ORCA.dragLen - e.r - (ai.went as number)
      const step = Math.min(left, ORCA.dragSpeed * dt)
      const x0 = e.x
      const y0 = e.y
      const blocked = walk(c, e, v.x * (step / dt), v.y * (step / dt), dt, true)
      ai.went = (ai.went as number) + Math.hypot(e.x - x0, e.y - y0)
      // The bow and the hull it drags past: from a body behind its middle (never behind the lane's start) to its bow.
      if (!ai.struck && inBox(c, e.x, e.y, e.dir, -Math.min(e.r, ai.went as number), e.r, ORCA.dragW)) strike(c, e)
      if (!blocked && left - step > 1e-6) return
      c.ev.push({ type: 'boom', x: e.x + v.x * e.r, y: e.y + v.y * e.r })
      c.s.shake = Math.max(c.s.shake, 0.25)
      open(e, 'planted', ORCA.planted)
      return
    }
    case 'sweepTell':
      if (ai.t > 0) return
      ai.mode = 'swing'
      ai.t = ORCA.swing
      ai.tell = 0
      ai.struck = false
      c.ev.push({ type: 'throw' })
      // (The oar is through the box from its first moment.)
      if (inBox(c, e.x, e.y, e.dir, ORCA.sweepFrom, ORCA.sweepTo, ORCA.sweepW)) strike(c, e)
      return
    case 'swing':
      if (!ai.struck && inBox(c, e.x, e.y, e.dir, ORCA.sweepFrom, ORCA.sweepTo, ORCA.sweepW)) strike(c, e)
      if (ai.t <= 0) open(e, 'off', ORCA.offBalance)
      return
    case 'planted':
    case 'off':
      if (ai.t <= 0) rest(e)
      return
  }
  // Between moves: rowing, keeping off the hero and coming into line with him.
  ai.mode = 'idle'
  const d = heroDist(c, e) || 1
  const sees = seesHero(c, e, 20)
  const flat = Math.abs(dx) >= Math.abs(dy)
  const across = Math.abs(flat ? dy : dx)
  const near = d <= ORCA.near
  const way = axisTo(dx, dy)
  const v = dirVec(way)
  const end = lineEnd(c, e, v.x, v.y, ORCA.dragLen - e.r)
  const clear = Math.hypot(end.x - e.x, end.y - e.y) >= ORCA.dragLeast
  // Waited long enough, it drags out of line; far too long, into whatever the hero stands behind.
  if (ai.t <= 0 && (near ? sees : (clear && (across < ORCA.dragW / 2 || ai.t < -ORCA.patience)) || ai.t < -ORCA.patience * 3)) {
    e.dir = way
    ai.mode = near ? 'sweepTell' : 'dragTell'
    ai.t = ai.tell = near ? ORCA.sweepTell : ORCA.dragTell
    ai.lx = end.x
    ai.ly = end.y
    c.ev.push({ type: 'lever', x: e.x, y: e.y })
    return
  }
  let vx = 0
  let vy = 0
  if (sees && clear) {
    // Along the longer axis it keeps its distance (nearer when far off); along the shorter it comes into line.
    const far = Math.abs(flat ? dx : dy)
    const to = far > ORCA.keep + 1.5 ? 1 : d < ORCA.keep ? -1 : 0
    const side = flat ? dy : dx
    const line = Math.sign(side) * Math.min(1, Math.abs(side))
    vx = flat ? Math.sign(dx) * to : line
    vy = flat ? line : Math.sign(dy) * to
  } else {
    // Cover in the way: round it, to a berth from which a lane runs to him.
    ai.look = ((ai.look as number | undefined) ?? 0) - dt
    if ((ai.look as number) <= 0) {
      const p = berth(c, e)
      ai.look = ORCA.look
      ai.bx = p ? p.x : h.x
      ai.by = p ? p.y : h.y
    }
    vx = (ai.bx as number) - e.x
    vy = (ai.by as number) - e.y
  }
  const n = Math.hypot(vx, vy)
  if (n > 0.05) walk(c, e, (vx / n) * ORCA.row, (vy / n) * ORCA.row, dt)
  e.dir = toDir(dx, dy, e.dir)
}

/**
 * The next step toward the nearest place (half a tile at a time, where its hull fits) from which a drag would reach the
 * hero: in line with him, off `near` and within the lane, nothing in between. Null when the room has none.
 */
function berth(c: Ctx, e: Enemy): { x: number; y: number } | null {
  const h = c.s.hero
  const z = cellRect(c.info, e.cell)
  const STEP = 0.5
  const key = (x: number, y: number) => `${Math.round(x / STEP)},${Math.round(y / STEP)}`
  const fits = (x: number, y: number) => x >= z.x + 1 + e.r && x <= z.x + z.w - 1 - e.r && y >= z.y + 1 + e.r && y <= z.y + z.h - 1 - e.r
    && !circleBlocked(c.w, c.s.map, x, y, e.r, 'enemy')
  const goal = (x: number, y: number) => {
    const dx = h.x - x
    const dy = h.y - y
    const far = Math.max(Math.abs(dx), Math.abs(dy))
    if (Math.min(Math.abs(dx), Math.abs(dy)) >= ORCA.dragW / 2 - 0.2 || far <= ORCA.near || far > ORCA.dragLen) return false
    const v = dirVec(axisTo(dx, dy))
    const end = lineEnd(c, { ...e, x, y }, v.x, v.y, ORCA.dragLen - e.r)
    return Math.hypot(end.x - x, end.y - y) >= far - e.r
  }
  // (Breadth first from where it floats; each place remembers the first step that leads to it.)
  const seen = new Set([key(e.x, e.y)])
  const queue: Array<{ x: number; y: number; first: { x: number; y: number } | null }> = [{ x: e.x, y: e.y, first: null }]
  for (let i = 0; i < queue.length && i < 600; i++) {
    const at = queue[i]!
    if (at.first && goal(at.x, at.y)) return at.first
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = at.x + ox * STEP
      const y = at.y + oy * STEP
      const k = key(x, y)
      if (seen.has(k) || !fits(x, y)) continue
      seen.add(k)
      queue.push({ x, y, first: at.first ?? { x, y } })
    }
  }
  return null
}
