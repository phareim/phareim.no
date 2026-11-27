/**
 * A screen that scrolls by itself (`MapDef.autoscroll`, docs/games/neon-shrine.md "The chase"): the camera is the
 * screen's left edge and nothing else, and the screen is `CHASE.screen` tiles wide. After a still moment it moves from
 * `from` to `to` and holds there for good, an ordinary fixed screen.
 *
 * The right edge is a wall. The left edge is a wall that moves: it carries a hero it catches. Behind the screen is a
 * fall: a hero it cannot carry (a wall or a wagon ahead of him, a pit under him), or one who falls out of the bottom,
 * loses half a heart and is put on the first ledge mark ahead of the screen, at rest.
 *
 * The step runs in 'play' alone, so a card, a line or the menu holds the screen where it is; entering the map starts
 * it over (a retry, a reload).
 */
import type { GameState, Vec, World } from '../types'
import { HERO_R } from '../types'
import type { Ctx } from './combat'
import { mapInfo, moveCircle, solidTile } from './map'
import { FOOT, sideOf } from './side'
import { stompDrop } from './stomp'

/**
 * Tiles. `screen`: the screen's width. `edge`: the hero's middle is carried no nearer the left edge than this;
 * `right`: and goes no further from it than this. `ahead`: a hero put back lands at least this far in.
 */
export const CHASE = { screen: 16, edge: 0.6, right: 15.5, ahead: 3 } as const

/** The hero has come into a map: its screen, if it has one that moves, stands at the start. */
export function startChase(world: World, s: GameState) {
  const info = mapInfo(world, s.map.id)
  const a = info.def.autoscroll
  if (!a) return
  s.map.chase = { left: a.from, wait: a.wait }
  s.zone = { x: a.from, y: 0, w: CHASE.screen, h: info.h }
}

/** Where a hero left behind is put: the first ledge mark `CHASE.ahead` or more into the screen, else the last. */
function markAhead(c: Ctx, left: number): Vec {
  const marks = c.info.marks.filter(m => m.ent.t === 'ledge').sort((a, b) => a.x - b.x)
  const m = marks.find(k => k.x + 0.5 >= left + CHASE.ahead) ?? marks[marks.length - 1]!
  return { x: m.x + 0.5, y: m.y + 1 - HERO_R - 1e-4 }
}

/** Nothing at all under feet at x: a pit, not a step down. */
function overPit(c: Ctx, x: number, feet: number): boolean {
  for (let tx = Math.floor(x - FOOT); tx <= Math.floor(x + FOOT); tx++) {
    for (let ty = Math.floor(feet); ty < c.s.map.h; ty++) if (solidTile(c.w, c.s.map, tx, ty, 'hero')) return false
  }
  return true
}

/** Behind the screen: the pit's own fall (`hero.ts`: half a heart, and back to `Hero.safe`). */
function leftBehind(c: Ctx, left: number) {
  const h = c.s.hero
  const sd = sideOf(c)
  stompDrop(sd)
  sd.snap = true
  sd.jumpT = -1
  sd.buffer = sd.coyote = 0
  h.safe = markAhead(c, left)
  h.vx = h.vy = 0
  h.act = 'fall'
  h.actT = 0
  h.swing = null
  h.spin = null
  h.roll = null
  h.knock = null
  h.charge = -1
  c.ev.push({ type: 'fall' })
}

export function stepChase(c: Ctx, dt: number) {
  const s = c.s
  const ch = s.map.chase
  const a = c.info.def.autoscroll
  if (!ch || !a) return
  if (ch.wait > 0) ch.wait -= dt
  else if (ch.left < a.to) ch.left = Math.min(a.to, ch.left + a.vx * dt)
  s.zone = { x: ch.left, y: 0, w: CHASE.screen, h: c.info.h }
  const h = s.hero
  if (h.act === 'dead') return
  const moving = ch.left < a.to
  if (h.act === 'fall') {
    // (The screen goes on while he falls: the mark he comes up on is the one ahead of it then.)
    if (moving) h.safe = markAhead(c, ch.left)
    return
  }
  if (h.x > ch.left + CHASE.right) {
    h.x = ch.left + CHASE.right
    if (h.side) h.side.vx = Math.min(h.side.vx, a.vx)
  }
  const wall = ch.left + (moving ? CHASE.edge : HERO_R)
  if (h.x >= wall) return
  const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, wall - h.x, 0)
  if (moving && (r.hitX || (sideOf(c).ground && overPit(c, r.x, h.y + HERO_R + 0.01)))) { leftBehind(c, ch.left); return }
  h.x = r.x
  if (h.side && h.side.vx < 0) h.side.vx = 0
}
