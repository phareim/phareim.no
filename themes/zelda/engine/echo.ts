/**
 * THE ECHO (docs/games/neon-shrine.md, "The Echo"), the Echo Barrow's treasure: B leaves a copy of the hero where
 * the hero stands, facing the way they faced.
 *
 * - One at a time: B again moves it. It is gone when the hero leaves the room, dies or warps, when something solid
 *   takes its tile, and out in the open once the hero is off a screen away. Never saved (`GameState.echo`).
 * - It weighs what the hero weighs, on a weighed plate or a scale pan (`puzzles/` `weightOn`: 1), and it holds a
 *   plain plate `_` down as a resting block does (`objects.ts`).
 * - When the hero cuts, it cuts: every blow of the blade (`bladeHits` calls `echoBlade` beside the hero's own) from
 *   where it stands, with the same reach, arc and damage, centred on the nearest thing a blade can hit within that
 *   reach (a foe, a lever not yet thrown, a crystal switch, a pot), else along its own facing. Its blows are
 *   `HitSource` 'echo': the blade to every rule of armour, with a mercy of their own on a foe, so they land beside
 *   the hero's. An echo's blow never hurts or shoves the hero, and counts for no combo.
 * - Foes neither see it nor strike it; walkers walk round it as round a pot (`enemies.ts` `walk`). A charge goes
 *   through it.
 */
import type { Dir, Echo, EchoBlow, Enemy } from '../types'
import { HERO_R } from '../types'
import { TILE_INFO, isViewBlock } from '../world/tiles'
import { hitEnemy, type Ctx, type HitOpts } from './combat'
import { enemyActive } from './enemies'
import { bladeHits } from './hero'
import { circleBlocked, circleOnTile, has, lineClear, solidTile, tileAt } from './map'
import { STATS } from './spawn'
import { dirAngle, toDir } from './util'

/** The room the echo takes on the floor (a foe's circle stops short of it). */
export const ECHO_R = HERO_R

/** Beyond this from the hero, out of doors, an echo is gone: it is a screen away (the foes' neighbourhood). */
const FAR = { x: 15, y: 12 }

/**
 * May an echo be left at (x, y)? On floor: not on a pit or water, not on a block that is or may come up (a crystal
 * block, a view block: nothing may stand where one rises), and not in a door's tile (a doorway, stairs, an opened
 * lock, a shutter's tiles).
 */
export function echoMayStand(c: Ctx, x: number, y: number): boolean {
  const m = c.s.map
  const under = tileAt(m, Math.floor(x), Math.floor(y))
  if (TILE_INFO[under].pit || under === '~' || under === 'ω') return false
  for (let ty = Math.floor(y - ECHO_R); ty <= Math.floor(y + ECHO_R); ty++) {
    for (let tx = Math.floor(x - ECHO_R); tx <= Math.floor(x + ECHO_R); tx++) {
      if (!circleOnTile(x, y, ECHO_R, tx, ty)) continue
      const t = tileAt(m, tx, ty)
      if (isViewBlock(t) || t === 'P' || t === 'C' || t === 'D' || t === '>') return false
      if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return false
      const i = ty * m.w + tx
      const was = c.info.base[i]
      if (was === 'L' || was === 'K' || c.info.gates.some(g => g.tiles.includes(i))) return false
      if (c.info.warps.some(w => tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h)) return false
    }
  }
  return !circleBlocked(c.w, m, x, y, ECHO_R - 0.04)
}

/** B with the echo in hand: leave one here (the one before goes), or buzz where none may stand. */
export function setEcho(c: Ctx): boolean {
  const s = c.s
  const h = s.hero
  if (!echoMayStand(c, h.x, h.y)) { c.ev.push({ type: 'error' }); return false }
  s.echo = { x: h.x, y: h.y, dir: h.dir, cut: null }
  h.act = 'use'
  h.actT = 0
  c.ev.push({ type: 'echo', x: h.x, y: h.y })
  return true
}

/** Its blow's picture runs on; an echo something has taken the ground from, or left far behind, is gone. */
export function stepEcho(c: Ctx, dt: number) {
  const s = c.s
  const e = s.echo
  if (!e) return
  if (e.cut) e.cut.t += dt
  const h = s.hero
  if (c.info.def.kind !== 'dungeon' && (Math.abs(e.x - h.x) > FAR.x || Math.abs(e.y - h.y) > FAR.y)) { s.echo = null; return }
  // A chest that appeared there, a shutter, a block.
  if (solidTile(c.w, s.map, Math.floor(e.x), Math.floor(e.y))) s.echo = null
}

/** Does tile (tx, ty) hold the echo (nothing is pushed onto it)? */
export function echoOnTile(c: Ctx, tx: number, ty: number): boolean {
  const e = c.s.echo
  return !!e && Math.floor(e.x) === tx && Math.floor(e.y) === ty
}

/**
 * The way the echo's blow goes: at the nearest thing a blade of this `reach` can hit from where it stands (a foe, a
 * lever not yet thrown, a crystal switch, a pot); null with nothing there.
 */
export function echoAim(c: Ctx, e: Pick<Echo, 'x' | 'y'>, reach: number): number | null {
  const s = c.s
  const m = s.map
  let best: number | null = null
  let near = Infinity
  for (const f of m.enemies) {
    if (!enemyActive(c, f) || STATS[f.kind].invulnerable) continue
    const d = Math.hypot(f.x - e.x, f.y - e.y)
    if (d > reach + f.r || d - f.r >= near || !lineClear(c.w, m, e.x, e.y, f.x, f.y)) continue
    near = d - f.r
    best = Math.atan2(f.y - e.y, f.x - e.x)
  }
  for (let ty = Math.floor(e.y - reach - 1); ty <= Math.floor(e.y + reach + 1); ty++) {
    for (let tx = Math.floor(e.x - reach - 1); tx <= Math.floor(e.x + reach + 1); tx++) {
      const t = tileAt(m, tx, ty)
      if (t !== 'c' && t !== 'o' && !(t === '}' && !has(s, c.info.levers.get(ty * m.w + tx) ?? ''))) continue
      const d = Math.hypot(tx + 0.5 - e.x, ty + 0.5 - e.y)
      if (d - 0.5 >= near) continue
      const a = Math.atan2(ty + 0.5 - e.y, tx + 0.5 - e.x)
      // The blade bites tiles at these two points along its way (`bladeHits`): one of them must land in this tile.
      if (![0.75, reach - 0.1].some(r => Math.floor(e.x + Math.cos(a) * r) === tx && Math.floor(e.y + Math.sin(a) * r) === ty)) continue
      near = d - 0.5
      best = a
    }
  }
  return best
}

/** One blow of the hero's, as the echo copies it. */
export interface EchoMove {
  /** The hero's move under way (the same object all through it). */
  of: object
  /** The hero's list of what this lap of it has struck. */
  lap: string[]
  kind: EchoBlow
  n?: 0 | 1 | 2
  /** The way the hero's blow is centred (rad): the echo's goes as far off its own aim as the blade is off this. */
  base: number
  /** Seconds the blow's picture lasts. */
  dur: number
}

/** The echo's blow beside the hero's: taken up on the first of a new move, then followed through its arc. */
function takeUp(c: Ctx, mv: EchoMove, reach: number): NonNullable<Echo['cut']> | null {
  const e = c.s.echo
  if (!e) return null
  let cut = e.cut
  if (!cut || cut.of !== mv.of) {
    cut = e.cut = {
      of: mv.of, lap: mv.lap, hit: [], a: echoAim(c, e, reach) ?? dirAngle(e.dir), kind: mv.kind, n: mv.n ?? 0, t: 0, dur: mv.dur,
    }
    c.ev.push({ type: 'echoCut', x: e.x, y: e.y })
  } else if (cut.lap !== mv.lap) {
    cut.lap = mv.lap
    cut.hit = []
  }
  return cut
}

/** The blade at the hero's angle `a`, struck from the echo too. */
export function echoBlade(c: Ctx, mv: EchoMove, a: number, reach: number, dmg: number, opt?: HitOpts) {
  const cut = takeUp(c, mv, reach)
  if (!cut) return
  const e = c.s.echo!
  const at = cut.a + (a - mv.base)
  bladeHits(c, at, reach, dmg, 'echo', cut.hit, opt, { x: e.x, y: e.y, dir: toDir(Math.cos(cut.a), Math.sin(cut.a), e.dir) as Dir })
}

/** A landing that shakes the ground all round (the flip's chop), round the echo too. */
export function echoRing(c: Ctx, mv: EchoMove, radius: number, dmg: number, opt?: HitOpts) {
  const cut = takeUp(c, mv, radius)
  if (!cut) return
  const e = c.s.echo!
  for (const f of c.s.map.enemies) {
    if (!enemyActive(c, f) || cut.hit.includes(f.id)) continue
    if (Math.hypot(f.x - e.x, f.y - e.y) >= radius + f.r || !lineClear(c.w, c.s.map, e.x, e.y, f.x, f.y)) continue
    cut.hit.push(f.id)
    hitEnemy(c, f, dmg, e.x, e.y, 'echo', opt)
  }
}

/**
 * A walker's step from (x0, y0) to (x, y) with the echo in the way: round it, as round a pot; where it ends up. A step
 * that would go into it runs along its edge instead (head on, it takes a side and goes that way round).
 */
export function roundEcho(c: Ctx, f: Enemy, x0: number, y0: number, x: number, y: number): { x: number; y: number; hit: boolean } {
  const e = c.s.echo
  if (!e) return { x, y, hit: false }
  const reach = f.r + ECHO_R
  const d0 = Math.hypot(x0 - e.x, y0 - e.y)
  const d = Math.hypot(x - e.x, y - e.y)
  // Only a step that goes further into it is turned: one already inside may always walk out.
  if (d >= reach || d >= d0 - 1e-9) return { x, y, hit: false }
  // (One that was standing in it when it was left keeps its distance: never a jump out.)
  const keep = Math.min(reach, d0)
  const from = Math.atan2(y0 - e.y, x0 - e.x)
  const most = Math.hypot(x - x0, y - y0) / Math.max(keep, 0.1)
  let turn = Math.atan2(Math.sin(Math.atan2(y - e.y, x - e.x) - from), Math.cos(Math.atan2(y - e.y, x - e.x) - from))
  const side = turn > 1e-4 ? 1 : turn < -1e-4 ? -1 : f.home.x + f.home.y > e.x + e.y ? 1 : -1
  turn = side * Math.max(Math.abs(turn), most * 0.6)
  const nx = e.x + Math.cos(from + turn) * keep
  const ny = e.y + Math.sin(from + turn) * keep
  if (circleBlocked(c.w, c.s.map, nx, ny, f.r, 'enemy')) return { x: x0, y: y0, hit: true }
  return { x: nx, y: ny, hit: true }
}
