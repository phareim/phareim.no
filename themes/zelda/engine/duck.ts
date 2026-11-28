/**
 * THE DUCK (docs/games/neon-shrine-examination.md, "The Duck"), the Examination's treasure: a decoy that B sets down.
 *
 * - B puts it on the farthest of the tile two ahead, the tile one ahead and the hero's own that will take it. With it
 *   down, B beside it (`DUCK.take`) takes it up; B anywhere else moves it. One at a time, a tap, never held down.
 * - It is not solid and nothing hurts it. It lives until the hero leaves the room, dies or warps. Never saved
 *   (`GameState.duck`).
 * - It weighs one on the tile it stands on (`puzzles/` `weightOn`) and it floats: on a float plate (a sluice tile with
 *   `float`) it holds the plate down.
 * - Foes look at it (`lured`, asked by `enemies.ts` before a foe's own brain).
 */
import type { Enemy } from '../types'
import { DUCK, HERO_R, roomed } from '../types'
import { TILE_INFO, isViewBlock } from '../world/tiles'
import { BIG, type Ctx } from './combat'
import { walk } from './enemies'
import { cellIndex, circleOnTile, lineClear, solidTile, tileAt } from './map'
import { STATS } from './spawn'
import { dirVec, toDir } from './util'

/** Is tile (tx, ty) one of a gate's, open or shut, or a door, a stair or a warp? */
function doorway(c: Ctx, tx: number, ty: number): boolean {
  const i = ty * c.s.map.w + tx
  const was = c.info.base[i]
  const t = c.s.map.tiles[i]
  if (t === 'D' || t === '>' || was === 'L' || was === 'K' || was === 'X' || c.info.gates.some(g => g.tiles.includes(i))) return true
  return c.info.warps.some(w => tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h)
}

/**
 * May the Duck stand on tile (tx, ty)? Open ground, a plate or pan, sluice water or its bed; not a pit, spikes, anything
 * solid, a door, stair, warp or gate, nor a tile with a foe, a pot, a block, a boulder, someone or something on it.
 * `own`: the hero's own tile, the one place it may share with the hero.
 */
export function duckMayStand(c: Ctx, tx: number, ty: number, own = false): boolean {
  const s = c.s
  const m = s.map
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h || doorway(c, tx, ty)) return false
  if (roomed(c.info.def.kind) && cellIndex(c.info, tx + 0.5, ty + 0.5) !== s.zoneIndex) return false
  const t = tileAt(m, tx, ty)
  if (TILE_INFO[t].pit || t === 'x' || isViewBlock(t)) return false
  // (Sluice water is the one thing solid to the hero that it takes: it floats.)
  if (t !== 'ω' && solidTile(c.w, m, tx, ty, 'hero')) return false
  const at = (x: number, y: number) => Math.floor(x) === tx && Math.floor(y) === ty
  if (m.enemies.some(e => !e.dead && circleOnTile(e.x, e.y, e.r, tx, ty))) return false
  if (m.npcs.some(n => at(n.x, n.y)) || m.moving.some(b => b.tx === tx && b.ty === ty) || m.phys?.rolling.some(r => at(r.x, r.y))) return false
  if (s.echo && at(s.echo.x, s.echo.y)) return false
  return own || !circleOnTile(s.hero.x, s.hero.y, HERO_R, tx, ty)
}

/** Where B would put it now: two ahead, one ahead or at the hero's feet; null when none of the three will take it. */
export function duckSpot(c: Ctx): { x: number; y: number } | null {
  const h = c.s.hero
  const v = dirVec(h.dir)
  const hx = Math.floor(h.x)
  const hy = Math.floor(h.y)
  for (const k of [2, 1, 0]) {
    const tx = hx + v.x * k
    const ty = hy + v.y * k
    // (It hops over water or a pit, never through a wall or a shut gate.)
    if (k === 2 && thrownOver(c, hx + v.x, hy + v.y)) continue
    if (duckMayStand(c, tx, ty, k === 0)) return { x: tx + 0.5, y: ty + 0.5 }
  }
  return null
}

/** Does tile (tx, ty) stand in the Duck's way to the tile beyond it? */
function thrownOver(c: Ctx, tx: number, ty: number): boolean {
  const t = tileAt(c.s.map, tx, ty)
  return !TILE_INFO[t].pit && t !== 'ω' && t !== '~' && solidTile(c.w, c.s.map, tx, ty, 'shot')
}

/** B with the Duck in hand: take it up if it is at the hero's side, else set it down (moving it, if it is out). */
export function useDuck(c: Ctx): boolean {
  const s = c.s
  const h = s.hero
  if (s.duck && Math.hypot(s.duck.x - h.x, s.duck.y - h.y) <= DUCK.take) {
    const { x, y } = s.duck
    delete s.duck
    squeak(c, x, y, false)
    return true
  }
  const spot = duckSpot(c)
  if (!spot) { c.ev.push({ type: 'error' }); return false }
  s.duck = spot
  squeak(c, spot.x, spot.y, true)
  return true
}

function squeak(c: Ctx, x: number, y: number, down: boolean) {
  const h = c.s.hero
  h.act = 'use'
  h.actT = 0
  c.ev.push({ type: 'duck', x, y, down })
}

/**
 * A blow is coming down where the Duck stands: it hops to the nearest tile that will take it and whose middle `clear`
 * allows. Nothing hurts it: with nowhere to go it stays.
 */
export function duckHop(c: Ctx, clear: (x: number, y: number) => boolean = () => true) {
  const d = c.s.duck
  if (!d) return
  const tx = Math.floor(d.x)
  const ty = Math.floor(d.y)
  for (let r = 1; r <= 5; r++) {
    let best: { x: number; y: number; far: number } | null = null
    for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
      if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r || !duckMayStand(c, x, y) || !clear(x + 0.5, y + 0.5)) continue
      const far = Math.hypot(x - tx, y - ty)
      if (!best || far < best.far) best = { x: x + 0.5, y: y + 0.5, far }
    }
    if (!best) continue
    c.s.duck = { x: best.x, y: best.y }
    c.ev.push({ type: 'duck', x: best.x, y: best.y, down: true })
    return
  }
}

/** The modes a foe's brains use between a blow's tell and its rest: a decoy draws none of them away, and none is left standing in one. */
const COMMITTED = ['tell', 'alert', 'charge', 'dash', 'lunge', 'strike', 'aim', 'sweep', 'go', 'back', 'dazed', 'spent', 'cool', 'rest']

/** Whom a decoy can draw at all: no boss, nothing that cannot be hurt, no calm one left in peace, none mid blow (its tell, strike or rest). */
function gullible(e: Enemy): boolean {
  // (PHI is a miniboss that comes five at a time, and none of them is in `BIG`.)
  if (BIG.has(e.kind) || e.kind === 'phi' || STATS[e.kind].invulnerable || (e.calm && !e.ai.angry)) return false
  return !COMMITTED.includes(e.ai.mode as string)
}

/** A look is over: a foe somehow left in a committed mode goes back to its calm one, with a short fresh wait (it never resumes a blow). */
function lookOver(e: Enemy) {
  delete e.ai.lure
  e.ai.bored = DUCK.bored
  if (!COMMITTED.includes(e.ai.mode as string)) return
  e.ai.mode = 'idle'
  e.ai.t = 0.5
  e.ai.tell = 0
}

/** A blow has landed on a foe that was looking (`combat.ts` `hitEnemy`): the looking is over for a while. */
export function duckStruck(e: Enemy) {
  delete e.ai.lure
  e.ai.bored = DUCK.struck
}

/**
 * Is `e` looking at the Duck this step? Then it walks up to `DUCK.near` of it and stands facing it, its own brain
 * left where it was, for `DUCK.look` s; after that it is bored for `DUCK.bored` s and may look again.
 */
export function lured(c: Ctx, e: Enemy, dt: number): boolean {
  const ai = e.ai
  const bored = (ai.bored as number | undefined) ?? 0
  if (bored > 0) { ai.bored = Math.max(0, bored - dt); return false }
  const d = c.s.duck
  const looking = (ai.lure as number | undefined) ?? 0
  const sees = !!d && gullible(e) && Math.hypot(d.x - e.x, d.y - e.y) <= DUCK.sight && lineClear(c.w, c.s.map, e.x, e.y, d.x, d.y)
  if (!sees) {
    // Taken from under its nose (or walked out of its sight): it has had enough of that for a while.
    if (looking > 0) lookOver(e)
    return false
  }
  const left = (looking > 0 ? looking : DUCK.look) - dt
  if (left <= 0) { lookOver(e); return false }
  ai.lure = left
  ai.tell = 0
  const dx = d.x - e.x
  const dy = d.y - e.y
  const far = Math.hypot(dx, dy)
  if (far > DUCK.near) {
    const v = Math.min(DUCK.speed, (far - DUCK.near) / Math.max(dt, 1e-6))
    walk(c, e, (dx / far) * v, (dy / far) * v, dt)
  }
  e.dir = toDir(dx, dy, e.dir)
  return true
}
