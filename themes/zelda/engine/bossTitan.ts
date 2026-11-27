/**
 * THE BENCHMARK TITAN (the Examination's boss, `examtop`, docs/games/neon-shrine-examination.md): top of every table,
 * and it has seen the questions.
 *
 * - It walks toward the hero, raises its stamp (the square it will hit is stencilled: `titanStencils`), brings it down
 *   and leans on it. Leaning (`rest`) it is open; at every other time, `look` excepted, every blow clanks off.
 * - Two cards hang over it (`ai.picA` the older, `ai.picB` the newer): the last two KINDS of blow that hurt it. Open,
 *   a blow of a kind on a card is turned aside; any other hurts for `TITAN.blow` and takes the older card's place.
 * - THE DUCK in its sight turns its head (`look`, open), and its next stamp comes down where the Duck stands. The
 *   Duck hops out of the square. A turned head is no blow: it hangs no card.
 * - With half its hit points gone it aims quicker, rests shorter and stamps twice: the second square lies beyond the
 *   first, toward the Titan, so the two make one band.
 * Every state is in `Enemy.ai`. The numbers are `TITAN`.
 */
import type { Enemy } from '../types'
import { TITAN } from '../types'
import { type Ctx, type HitSource, hurtHero } from './combat'
import { duckHop } from './duck'
import { walk } from './enemies'
import { lineClear } from './map'
import type { Stencil } from './stencils'
import { STATS } from './spawn'
import { toDir } from './util'

/** The kinds of blow, as the cards name them. */
export type TitanKind = 'BLADE' | 'SPIN' | 'POT' | 'BOULDER' | 'BOMB' | 'DISC' | 'HOOK' | 'BEAM' | 'OTHER'

/** Which kind a blow is. The echo's blade is the blade; a source with no picture of its own is OTHER. */
export function titanKind(src: HitSource): TitanKind {
  switch (src) {
    case 'sword': case 'echo': return 'BLADE'
    case 'spin': return 'SPIN'
    case 'pot': return 'POT'
    case 'boulder': return 'BOULDER'
    case 'bomb': return 'BOMB'
    case 'disc': return 'DISC'
    case 'hook': return 'HOOK'
    case 'shot': case 'beam': return 'BEAM'
    default: return 'OTHER'
  }
}

/** The two cards, older first, as they hang now (as the fight begins: SPIN and POT). */
export const titanCards = (e: Enemy): [TitanKind, TitanKind] => [(e.ai.picA as TitanKind | undefined) ?? 'SPIN', (e.ai.picB as TitanKind | undefined) ?? 'POT']

/** May a blow hurt it now (`combat.ts` `bossOpen`)? Leaning on its stamp, or looking at the Duck. */
export const titanOpen = (e: Enemy) => e.ai.mode === 'rest' || e.ai.mode === 'look'

const half = (e: Enemy) => e.hp <= TITAN.half

function walkOn(e: Enemy) {
  e.ai.mode = 'walk'
  e.ai.t = TITAN.walk
}

/**
 * The stamp goes up: aimed once, at the tile of (x, y). With half its hit points gone and no `one`, a second square
 * lies `TITAN.stamp` on from the first, straight toward the Titan (along the longer way of the two).
 */
function aim(c: Ctx, e: Enemy, x: number, y: number, one = false) {
  const ai = e.ai
  ai.ax = Math.floor(x) + 0.5
  ai.ay = Math.floor(y) + 0.5
  ai.band = half(e) && !one
  if (ai.band) {
    const dx = e.x - (ai.ax as number)
    const dy = e.y - (ai.ay as number)
    const flat = Math.abs(dx) > Math.abs(dy)
    ai.bx = (ai.ax as number) + (flat ? Math.sign(dx) : 0) * TITAN.stamp
    ai.by = (ai.ay as number) + (flat ? 0 : Math.sign(dy) || -1) * TITAN.stamp
  }
  ai.mode = 'tell'
  ai.whole = one || !half(e) ? TITAN.tell : TITAN.tell2
  ai.t = ai.tell = ai.whole as number
  ai.pending = 0
  e.dir = toDir((ai.ax as number) - e.x, 0, e.dir)
  c.ev.push({ type: 'lever', x: e.x, y: e.y })
}

const square = (x: number, y: number) => ({ t: 'box' as const, x, y, w: TITAN.stamp, h: TITAN.stamp })
const within = (x: number, y: number, sx: number, sy: number) => Math.abs(x - sx) <= TITAN.stamp / 2 && Math.abs(y - sy) <= TITAN.stamp / 2

/** A square lands: a heart to a hero in it; the Duck hops out of it, and out of the one still to come. */
function land(c: Ctx, e: Enemy, x: number, y: number) {
  const s = c.s
  c.ev.push({ type: 'boom', x, y })
  s.shake = Math.max(s.shake, 0.35)
  if (within(s.hero.x, s.hero.y, x, y)) hurtHero(c, STATS.titan.dmg, x, y, false, true)
  const d = s.duck
  if (!d || !within(d.x, d.y, x, y)) return
  const next = e.ai.pending ? { x: e.ai.bx as number, y: e.ai.by as number } : null
  duckHop(c, (px, py) => !within(px, py, x, y) && !(next && within(px, py, next.x, next.y)))
}

export function titan(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const s = c.s
  const h = s.hero
  if (ai.mode === 'idle') {
    ;[ai.picA, ai.picB] = titanCards(e)
    walkOn(e)
  }
  for (const k of ['flip', 'turnT', 'rested'] as const) if (((ai[k] as number | undefined) ?? 0) > 0) ai[k] = Math.max(0, (ai[k] as number) - dt)
  // THE DUCK in its sight turns its head, whatever it is about; not again for `TITAN.again` s after.
  const duck = s.duck
  if (duck && ai.mode !== 'look' && !(ai.rested as number) && Math.hypot(duck.x - e.x, duck.y - e.y) <= TITAN.sight && lineClear(c.w, s.map, e.x, e.y, duck.x, duck.y)) {
    ai.mode = 'look'
    ai.t = TITAN.look
    ai.tell = 0
    ai.pending = 0
    ai.rested = TITAN.look + TITAN.again
    ai.lx = duck.x
    ai.ly = duck.y
  }
  switch (ai.mode) {
    case 'walk': {
      const dx = h.x - e.x
      const dy = h.y - e.y
      const far = Math.hypot(dx, dy)
      e.dir = toDir(dx, dy, e.dir)
      if (far > TITAN.keep) {
        const v = Math.min(TITAN.speed, (far - TITAN.keep) / Math.max(dt, 1e-6))
        walk(c, e, (dx / far) * v, (dy / far) * v, dt)
      }
      if (ai.t <= 0) aim(c, e, h.x, h.y)
      return
    }
    case 'look': {
      if (s.duck) { ai.lx = s.duck.x; ai.ly = s.duck.y }
      e.dir = toDir((ai.lx as number) - e.x, (ai.ly as number) - e.y, e.dir)
      // Its next stamp is for the Duck: one square, at the unhurried pace. (Taken up meanwhile, it is the hero's.)
      if (ai.t <= 0) aim(c, e, s.duck?.x ?? h.x, s.duck?.y ?? h.y, !!s.duck)
      return
    }
    case 'tell':
      if (ai.t > 0) return
      ai.mode = 'slam'
      ai.tell = 0
      ai.pending = ai.band ? 1 : 0
      ai.t = TITAN.slam + (ai.band ? TITAN.second : 0)
      land(c, e, ai.ax as number, ai.ay as number)
      return
    case 'slam':
      if (ai.pending && ai.t <= TITAN.slam) {
        ai.pending = 0
        land(c, e, ai.bx as number, ai.by as number)
      }
      if (ai.t > 0) return
      ai.mode = 'rest'
      ai.t = half(e) ? TITAN.rest2 : TITAN.rest
      return
    case 'rest':
      if (ai.t <= 0) walkOn(e)
      return
  }
}

/** Is this blow one it turns aside as it watches: open, and of a kind on a card? */
export const titanSees = (e: Enemy, src: HitSource) => titanOpen(e) && titanCards(e).includes(titanKind(src))

/**
 * A blow at it (`combat.ts` `bossRules`): the kind that lands, or null. Shut, it clanks off; open, a kind on a card is
 * turned aside, and that card flashes. No shove and no mercy comes of either: the next kind must not be swallowed.
 */
export function titanTakes(c: Ctx, e: Enemy, src: HitSource): TitanKind | null {
  const kind = titanKind(src)
  const open = titanOpen(e)
  if (open && !titanCards(e).includes(kind)) return kind
  if (open) { e.ai.turned = kind; e.ai.turnT = TITAN.flash }
  c.ev.push({ type: 'clank', x: e.x, y: e.y })
  return null
}

/** A blow of `kind` has hurt it: its picture takes the older card's place; at half its hit points the band begins. */
export function titanStruck(c: Ctx, e: Enemy, kind: TitanKind) {
  const [older, newer] = titanCards(e)
  e.ai.was = older
  e.ai.picA = newer
  e.ai.picB = kind
  e.ai.flip = TITAN.flip
  e.ai.turnT = 0
  e.knock = null
  if (e.dead || e.ai.phase === 2 || !half(e)) return
  e.ai.phase = 2
  c.ev.push({ type: 'bossPhase', phase: 2 })
  c.ev.push({ type: 'hitStop', ms: 120 })
  c.s.shake = 0.4
}

/** The stamp's footprint on the floor: filling from its edge as the tell runs out; whole while the second is to come. */
export function titanStencils(e: Enemy): Stencil[] {
  const ai = e.ai
  const first = () => square(ai.ax as number, ai.ay as number)
  const second = () => square(ai.bx as number, ai.by as number)
  if (ai.mode === 'tell') {
    const k = Math.max(0, Math.min(1, 1 - ai.tell / (ai.whole as number)))
    return ai.band ? [{ ...first(), k }, { ...second(), k }] : [{ ...first(), k }]
  }
  return ai.mode === 'slam' && ai.pending ? [{ ...second(), k: 1 }] : []
}
