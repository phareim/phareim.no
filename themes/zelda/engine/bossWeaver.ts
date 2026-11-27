/**
 * THE UNCANNY WEAVER, the Late Show's boss (docs/games/neon-shrine.md "The Uncanny Weaver"): a face on the blank
 * screen that draws hands, never having seen one. It hurts by what it draws, never by touch. Hit points: 12.
 *
 * Three rounds, a hand each, on the slots `MapDef.stamps` names (a step up and three tiles on, one after another):
 *
 *   draw    the tell: its arm comes down, the footprint over the slot is stencilled pink (and, from the second round,
 *           the two strips along the floor where the ripple will run)
 *   slam    the hand falls; what is in the footprint is hurt
 *   rest    it lies there, and its gold finger is open to a stomp (`stomp.ts` strikes it); the blade does nothing
 *   lift    nobody came: it goes up and is drawn again. Nothing is lost.
 *
 * A finger struck puts the hand right: it becomes a ledge (the stamp's tiles, and its flag, saved), the Weaver loses
 * two, and the next round begins. With all three right the face is all that is left: it watches, sinks to the top
 * ledge, yawns (open to the blade, `take` a yawn), tells its bite as a rectangle, snaps and rises.
 *
 * Outside its open moments of the face it aims a scribble at where the hero stands: a pink lane, then a pellet down
 * it that a step, a jump or the blade clears. (It scribbles through a hand's rest too: a hero who only stands still
 * loses in some twelve seconds.)
 *
 * A hero who steps out and comes back finds the face as wounded as he left it (`GameState.wounds`, the rule that a
 * boss keeps its wounds). A death or a reload starts at the part reached: the flags say how many hands are right, and
 * the face's wounds are lost.
 */
import type { Enemy, TileChar } from '../types'
import { HERO_R, SPIN_TIME, SWORD_REACH, WINDUP } from '../types'
import { hitEnemy, hurtHero, type Ctx } from './combat'
import { swingDur } from './hero'
import { has, setFlag, solidTile, tileAt, type MapInfo } from './map'
import { inSideCut } from './side'
import { inStencil, type StencilShape } from './stencils'
import { PLATFORM } from '../world/tiles'

/**
 * Seconds, tiles (the room's own) and tiles/s. `face`: the face's middle at rest, and sunk. `floor`: the floor's top.
 * `finger`: the stomp's ring round a gold finger, `up` tiles over its slot's top: a held jump from the step before
 * the slot gets the feet to within 0.15 of it, a held jump from any lower footing stops 0.25 short of the ring. `scribble`: how often, by the hands put right (the last: the
 * face's watch), its lane's width, how long it lies, and the pellet's speed. `bite`: what the snap takes.
 */
export const WEAVER = {
  face: { x: 8, y: 11.5, low: 16.4 },
  floor: 21,
  finger: 0.6, up: 2.05,
  gap: 1.5, draw: 1.1, slam: 0.3, lift: 0.8, rest: [6, 5, 4.5],
  dmg: 2,
  /** What a finger's stomp takes, and the most the blade takes in one yawn. */
  stomp: 2, take: 3,
  watch: 3.6, sink: 0.6, yawn: 2.1, bite: 0.9, snap: 0.2, rise: 0.6,
  rect: { x: 7, y: 14.5, w: 4, h: 3.5 },
  wave: { speed: 6.5, half: 0.5, again: 0.9 },
  scribble: { every: [3.2, 2.8, 2.4, 2.6], wide: 1.2, warn: 1, speed: 12, r: 0.5, from: 1.4 },
} as const

const num = (e: Enemy, k: string) => (e.ai[k] as number | undefined) ?? 0

/** How many hands are right, 0 to 3. */
export const handsRight = (e: Enemy) => num(e, 'n')

/** Slot `n` (0 to 2): the tile its ledge starts at, and its top (the ledge's row). */
export function weaverSlot(info: MapInfo, n: number): { x: number; y: number } {
  const i = info.def.stamps![n]!.at[0]!
  return { x: i % info.w, y: Math.floor(i / info.w) }
}

/** The gold finger while a hand rests: at the hand's near end, over the hand's top (`WEAVER.up`). */
export function weaverFinger(info: MapInfo, e: Enemy): { x: number; y: number } | null {
  if (e.dead || e.kind !== 'weaver' || e.ai.mode !== 'rest') return null
  const s = weaverSlot(info, handsRight(e))
  return { x: s.x + 0.5, y: s.y - WEAVER.up }
}

/** The footprint of the hand now being drawn or laid on its slot: three wide, down from the hand's top to the floor. */
export function weaverFootprint(info: MapInfo, n: number): StencilShape & { t: 'box' } {
  const s = weaverSlot(info, n)
  return { t: 'box', x: s.x, y: s.y - 2, w: 3, h: WEAVER.floor - s.y + 2 }
}

/** Does the floor's row bear a wave at tile `tx`: a ledge or a wall stops one. */
function stops(c: Ctx, tx: number): boolean {
  const ty = WEAVER.floor - 1
  return tileAt(c.s.map, tx, ty) === PLATFORM || solidTile(c.w, c.s.map, tx, ty, 'hero')
}

/** Where a wave from `x` going `way` ends: the near face of the ledge or wall in its path. */
function waveEnd(c: Ctx, x: number, way: number): number {
  for (let tx = Math.floor(x); tx >= 0 && tx < c.s.map.w; tx += way) if (stops(c, tx)) return way > 0 ? tx : tx + 1
  return way > 0 ? c.s.map.w : 0
}

/**
 * The two strips along the floor where the ripple will run, stencilled while the hand is drawn and falls, and, in
 * the third round, again until the second pair has set off (from where the first did).
 */
export function weaverStrips(c: Ctx, e: Enemy): Array<StencilShape & { t: 'box' }> {
  const n = handsRight(e)
  const second = num(e, 'again') > 0
  if (e.dead || (!second && (n < 1 || n > 2 || (e.ai.mode !== 'draw' && e.ai.mode !== 'slam')))) return []
  const mid = second ? num(e, 'from') : weaverSlot(c.info, n).x + 1.5
  return [-1, 1].map(way => {
    const end = waveEnd(c, mid, way)
    return { t: 'box', x: Math.min(mid, end), y: WEAVER.floor - 1, w: Math.abs(end - mid), h: 1 }
  })
}

/** The scribble's lane, while it lies and while the pellet runs down it: its ends are capped, as the pellet fills it. */
export function weaverLane(e: Enemy): (StencilShape & { t: 'lane' }) | null {
  if (e.dead || !e.ai.sk) return null
  const [x0, y0, x1, y1, w] = [num(e, 'x0'), num(e, 'y0'), num(e, 'x1'), num(e, 'y1'), WEAVER.scribble.wide]
  return { t: 'lane', x0, y0, x1, y1, a: Math.atan2(y1 - y0, x1 - x0), w, cap: w / 2 }
}

/** The pellet in flight, or null. */
export function weaverPellet(e: Enemy): { x: number; y: number } | null {
  if (e.dead || e.ai.sk !== 'fly') return null
  const len = Math.hypot(num(e, 'x1') - num(e, 'x0'), num(e, 'y1') - num(e, 'y0')) || 1
  const k = Math.min(1, num(e, 'su') / len)
  return { x: num(e, 'x0') + (num(e, 'x1') - num(e, 'x0')) * k, y: num(e, 'y0') + (num(e, 'y1') - num(e, 'y0')) * k }
}

/** The ripple's waves now running: where each is (its middle) and which way it goes. */
export function weaverWaves(e: Enemy): Array<{ i: number; x: number; way: number }> {
  if (e.dead) return []
  return [0, 1, 2, 3].filter(i => num(e, `w${i}d`)).map(i => ({ i, x: num(e, `w${i}x`), way: num(e, `w${i}d`) }))
}

/** A blow of the Weaver's: two half hearts, thrown from (fromX, fromY). */
const strike = (c: Ctx, fromX: number, fromY: number) => hurtHero(c, WEAVER.dmg, fromX, fromY)

function to(e: Enemy, mode: string, t: number) {
  e.ai.mode = mode
  e.ai.t = t
  e.ai.tell = mode === 'draw' || mode === 'bite' ? t : 0
}

function waves(c: Ctx, e: Enemy, first: number) {
  const mid = weaverSlot(c.info, handsRight(e)).x + 1.5
  for (const [k, way] of [-1, 1].entries()) {
    e.ai[`w${first + k}x`] = mid
    e.ai[`w${first + k}d`] = way
  }
}

/** The hand is down: whatever is in its footprint, the shake, and from the second round the ripple. */
function land(c: Ctx, e: Enemy) {
  const h = c.s.hero
  const n = handsRight(e)
  const box = weaverFootprint(c.info, n)
  if (inStencil(box, h.x, h.y)) strike(c, box.x + 1.5, h.y)
  c.s.shake = Math.max(c.s.shake, 0.35)
  c.ev.push({ type: 'slam', x: box.x + 1.5, y: box.y + 2 })
  if (n >= 1) waves(c, e, 0)
  // (The third round sends a second pair after the first.)
  e.ai.again = n >= 2 ? WEAVER.wave.again : 0
  to(e, 'rest', WEAVER.rest[n]!)
}

function ripple(c: Ctx, e: Enemy, dt: number) {
  const h = c.s.hero
  if (num(e, 'again') > 0) {
    e.ai.again = num(e, 'again') - dt
    // (The second pair sets off from where the first did, though a hand struck meanwhile has gone on.)
    if (num(e, 'again') <= 0) for (const [k, way] of [-1, 1].entries()) { e.ai[`w${2 + k}x`] = num(e, 'from'); e.ai[`w${2 + k}d`] = way }
  }
  for (const w of weaverWaves(e)) {
    const x = w.x + w.way * WEAVER.wave.speed * dt
    if (stops(c, Math.floor(x + w.way * WEAVER.wave.half))) { e.ai[`w${w.i}d`] = 0; continue }
    e.ai[`w${w.i}x`] = x
    // A tile tall: any jump clears it, and so does standing on a ledge.
    if (Math.abs(h.x - x) < WEAVER.wave.half + HERO_R * 0.5 && h.y + HERO_R > WEAVER.floor - 0.85) strike(c, x - w.way, h.y)
  }
}

/** Is the pellet within the blade now swinging? */
function swatted(c: Ctx, p: { x: number; y: number }): boolean {
  const h = c.s.hero
  const dx = p.x - h.x
  const dy = p.y - h.y
  const near = Math.hypot(dx, dy) <= SWORD_REACH + WEAVER.scribble.r
  if (h.spin) return near && h.spin.t < SPIN_TIME
  const sw = h.swing
  return !!sw && near && sw.t / swingDur(sw) >= WINDUP && inSideCut(h.dir, dx, dy, WEAVER.scribble.r)
}

/** The clock that makes a still hero lose: aim, lie, run. */
function scribble(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  const S = WEAVER.scribble
  const mode = ai.mode
  if (mode !== 'sink' && mode !== 'yawn' && mode !== 'bite' && mode !== 'snap' && mode !== 'rise') {
    ai.clk = num(e, 'clk') + dt
    if (num(e, 'clk') >= S.every[handsRight(e)]! && !ai.sk) {
      ai.clk = 0
      const d = Math.hypot(h.x - e.x, h.y - e.y) || 1
      Object.assign(ai, { sk: 'aim', st: S.warn, x0: e.x + ((h.x - e.x) / d) * S.from, y0: e.y + ((h.y - e.y) / d) * S.from, x1: h.x, y1: h.y, su: 0 })
    }
  }
  if (ai.sk === 'aim') {
    ai.st = num(e, 'st') - dt
    if (num(e, 'st') <= 0) { ai.sk = 'fly'; c.ev.push({ type: 'shoot', x: num(e, 'x0'), y: num(e, 'y0'), kind: 'pellet' }) }
    return
  }
  if (ai.sk !== 'fly') return
  ai.su = num(e, 'su') + S.speed * dt
  const p = weaverPellet(e)!
  // Broken by the blade, and never sent back.
  if (swatted(c, p)) { ai.sk = ''; c.ev.push({ type: 'reflect', x: p.x, y: p.y }); return }
  if (Math.hypot(h.x - p.x, h.y - p.y) <= S.wide / 2 && h.invuln <= 0) { ai.sk = ''; strike(c, p.x, p.y); return }
  if (num(e, 'su') >= Math.hypot(num(e, 'x1') - num(e, 'x0'), num(e, 'y1') - num(e, 'y0'))) ai.sk = ''
}

/** A cut at a resting hand rings off it: a spark, no more. */
function handClank(c: Ctx, e: Enemy) {
  const f = weaverFinger(c.info, e)
  const sw = c.s.hero.swing
  if (!f || !sw || sw.hit.includes('hand') || sw.t / swingDur(sw) < WINDUP) return
  const h = c.s.hero
  // (The hand lies three tiles from its finger on: the nearest of it to the hero.)
  const x = Math.max(f.x, Math.min(f.x + 2.2, h.x))
  const dx = x - h.x
  // (The hand's own body, half a tile over the slot: the finger stands higher.)
  const y = f.y + WEAVER.up - 0.5
  const dy = y - h.y
  if (Math.hypot(dx, dy) > SWORD_REACH + 0.4 || !inSideCut(h.dir, dx, dy, 0.4)) return
  sw.hit.push('hand')
  c.ev.push({ type: 'clank', x, y })
}

/** The stomp has come down on the gold finger (`stomp.ts`): the hand is put right, for good. */
export function fingerStruck(c: Ctx, e: Enemy) {
  const m = c.s.map
  const stamp = c.info.def.stamps![handsRight(e)]!
  const f = weaverFinger(c.info, e)!
  // (A clank off its face a moment ago must not swallow this.)
  e.invuln = 0
  if (!hitEnemy(c, e, WEAVER.stomp, f.x, f.y, 'stomp')) return
  for (const i of stamp.at) m.tiles[i] = stamp.ch as TileChar
  m.version++
  setFlag(c.s, stamp.flag)
  // The hand, and where it went up from: the picture's.
  e.ai.n = handsRight(e) + 1
  c.ev.push({ type: 'secret' })
  if (handsRight(e) === 3) {
    c.ev.push({ type: 'bossPhase', phase: 2 })
    // (The face's own clock starts with its first watch: nothing half drawn is carried into it.)
    e.ai.sk = ''
    e.ai.clk = 0
  }
  to(e, 'gap', WEAVER.gap)
}

export function weaver(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  if (ai.mode === 'idle') {
    const n = c.info.def.stamps!.findIndex(st => !has(c.s, st.flag))
    ai.n = n < 0 ? 3 : n
    // (The hands are flags; the face's wounds are what the hero left it with, if he stepped out.)
    e.hp = Math.min(e.maxHp - WEAVER.stomp * handsRight(e), c.s.wounds?.weaver ?? e.maxHp)
    ai.clk = 0
    to(e, 'gap', WEAVER.gap)
  }
  e.knock = null
  switch (ai.mode) {
    case 'gap':
      if (ai.t > 0) break
      if (handsRight(e) < 3) to(e, 'draw', WEAVER.draw)
      else watch(e)
      break
    case 'draw':
      if (ai.t <= 0) to(e, 'slam', WEAVER.slam)
      break
    case 'slam':
      if (ai.t <= 0) { ai.from = weaverSlot(c.info, handsRight(e)).x + 1.5; land(c, e) }
      break
    case 'rest':
      if (ai.t <= 0) to(e, 'lift', WEAVER.lift)
      break
    case 'lift':
      if (ai.t <= 0) to(e, 'draw', WEAVER.draw)
      break
    case 'watch':
      if (ai.t <= 0) to(e, 'sink', WEAVER.sink)
      break
    case 'sink':
      if (ai.t <= 0) { to(e, 'yawn', WEAVER.yawn); ai.took = 0 }
      break
    case 'yawn':
      if (ai.t <= 0) to(e, 'bite', WEAVER.bite)
      break
    case 'bite':
      if (ai.t <= 0) { to(e, 'snap', WEAVER.snap); c.s.shake = Math.max(c.s.shake, 0.2); c.ev.push({ type: 'slam', x: e.x, y: e.y + 1.4 }) }
      break
    case 'snap':
      if (inStencil({ t: 'box', ...WEAVER.rect }, h.x, h.y)) strike(c, e.x, h.y)
      if (ai.t <= 0) to(e, 'rise', WEAVER.rise)
      break
    case 'rise':
      if (ai.t <= 0) watch(e)
      break
  }
  // The face goes down to the top ledge for its yawn, and up again.
  const low = WEAVER.face.low - WEAVER.face.y
  const k = ai.mode === 'sink' ? 1 - Math.max(0, ai.t) / WEAVER.sink : ai.mode === 'rise' ? Math.max(0, ai.t) / WEAVER.rise : ai.mode === 'yawn' || ai.mode === 'bite' || ai.mode === 'snap' ? 1 : 0
  e.x = WEAVER.face.x
  e.y = WEAVER.face.y + low * k
  ripple(c, e, dt)
  scribble(c, e, dt)
  handClank(c, e)
  ;(c.s.wounds ??= {}).weaver = e.hp
}

/** The face at rest again: two scribbles come in the watch, the second gone before the yawn. */
function watch(e: Enemy) {
  to(e, 'watch', WEAVER.watch)
  e.ai.clk = WEAVER.scribble.every[3]! - 0.05
}
