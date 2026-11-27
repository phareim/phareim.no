/**
 * THE EXAMINATION's rounds. A camera room with `CellDef.round` is a round: it begins when the hero is in it and it
 * is not yet passed, with a rule, a score, a pass mark and a score card at its end. What it keeps is live
 * (`MapState.exam`); what lasts is the flags `exam.<id>` (passed) and `exam.<id>.full` (with every mark).
 *
 * - Marks: the worth of every pad latched, `foeWorth` for each foe of the room that is down, less the penalties.
 * - It ends on the HAND IN pad, or, in a round with no mark pads, as its last foe falls.
 * - Passed, the room is quiet for good (its foes are not there). Not passed, the card plays and the hero is put
 *   back at the round's door with the map loaded afresh: nothing is lost.
 * - A hero who walks out of a round that is still running abandons it; coming back begins it afresh.
 * - TIME WAITS (`rule: 'still'`): the world's clock runs only as the hero does something (`stillK`, which `play()`
 *   multiplies into the time foes and things are stepped by). The hero, the pads and the cards keep their own.
 *
 * Also here: the pot stands that fill one at a time (`stand` marks with a `wait`).
 * Every clock here runs on the hero's `dt`. Docs: docs/games/neon-shrine-examination.md.
 */
import type { Enemy, ExamState, GameState, Input, RoundDef, World } from '../types'
import { EXAM, HERO_R, STILL } from '../types'
import type { Ctx } from './combat'
import { cellDef, circleOnTile, condMet, has, mapInfo, setFlag, type MapInfo, type PadInfo } from './map'

export function stepExam(c: Ctx, dt: number, inp: Input) {
  const s = c.s
  if (s.demo) return
  stepStands(c, dt)
  const m = s.map
  const card = m.exam?.card
  if (card) {
    card.t += dt
    if (card.t >= EXAM.card && cardDone(c, m.exam!)) return
  }
  const round = cellDef(c.info, s.zoneIndex)?.round
  if (round && !has(s, `exam.${round.id}`) && (!m.exam || (m.exam.over && m.exam.card?.passed !== false))) begin(c, round)
  const x = m.exam
  if (!round || !x || x.over || x.cell !== s.zoneIndex) return
  if (x.rule === 'still') stepStill(c, x, inp, dt)
  // A heart lost is seen by the hit points going down since the last step.
  if (s.hero.hp < x.hp) x.lost += x.hp - s.hero.hp
  x.hp = s.hero.hp
  const pads = c.info.pads.filter(p => p.cell === x.cell)
  let handedIn = false
  for (const p of pads) {
    if (x.got.includes(p.id) || !latches(c, x, p, dt)) continue
    if (p.handin) { handedIn = true; continue }
    x.got.push(p.id)
    c.ev.push({ type: 'pad', x: p.x + p.size / 2, y: p.y + p.size / 2, ok: p.worth > 0 })
  }
  x.marks = tally(c, x, round, pads)
  const foes = m.enemies.filter(e => e.cell === x.cell)
  const cleared = !pads.some(p => !p.handin) && foes.length > 0 && foes.every(e => e.dead)
  if (handedIn || cleared) end(c, x, round)
}

/** What the hero does besides walking, in a room where time waits: each of these lets it run. */
const DOING: ReadonlySet<string> = new Set(['swing', 'spin', 'roll', 'air', 'lift', 'throw', 'use', 'hook', 'push', 'hurt'])

/**
 * TIME WAITS: `k` eases to 1 while the hero does something and to 0 while not. The stick has two thresholds, so that
 * a thumb resting at the edge of its dead zone does not flicker the world.
 */
function stepStill(c: Ctx, x: ExamState, inp: Input, dt: number) {
  const mag = Math.hypot(inp.move.x, inp.move.y)
  x.moving = mag > STILL.on || (!!x.moving && mag >= STILL.off)
  const does = x.moving || DOING.has(c.s.hero.act)
  x.k = does ? Math.min(1, x.k + STILL.up * dt) : Math.max(0, x.k - STILL.down * dt)
  if (x.k > 0) { x.stood = 0; return }
  if (!x.stood) c.ev.push({ type: 'still' })
  x.stood = (x.stood ?? 0) + dt
}

/** The world's share of the hero's clock: 1, except in a running round where time waits. */
export function stillK(s: GameState): number {
  const x = s.map.exam
  return x && x.rule === 'still' && !x.over && x.cell === s.zoneIndex ? x.k : 1
}

/**
 * The examination's foes in the states in which their touch does no harm (`enemies.ts` `contact`): FALCON stuck in
 * the sand, and in its dive, which hurts by its lane and ring alone (`bossFalcon.ts`).
 */
export function examBossHarmless(e: Enemy): boolean {
  return e.kind === 'falcon' && (e.ai.mode === 'stuck' || e.ai.mode === 'dive')
}

/** Does the hero's standing here latch pad `p` now? */
function latches(c: Ctx, x: ExamState, p: PadInfo, dt: number): boolean {
  const s = c.s
  const h = s.hero
  if (p.when) return condMet(s, c.w, p.when, x.cell)
  const on = h.x >= p.x && h.x < p.x + p.size && h.y >= p.y && h.y < p.y + p.size && h.act !== 'fall' && h.act !== 'dead'
  // A pad with no hold latches on touch, at any speed. Any other wants the hero on its feet and all but still.
  if (p.hold <= 0) return on
  const still = !h.roll && !h.air && !h.knock && !s.hook && Math.hypot(h.vx, h.vy) <= EXAM.still + 1e-6
  const t = on && still ? (x.hold[p.id] ?? 0) + dt : 0
  x.hold[p.id] = t
  return t >= p.hold - 1e-9
}

function tally(c: Ctx, x: ExamState, round: RoundDef, pads: PadInfo[]): number {
  let n = 0
  for (const p of pads) if (x.got.includes(p.id)) n += p.worth
  for (const e of c.s.map.enemies) if (e.cell === x.cell && e.dead) n += round.foeWorth ?? 0
  n -= ((round.penalty?.hurt ?? 0) * x.lost) / 2
  n -= (round.penalty?.shatter ?? 0) * x.shattered.length
  return n
}

function begin(c: Ctx, round: RoundDef) {
  const m = c.s.map
  // (A card of the round just passed plays on over the next one's first moments.)
  m.exam = {
    id: round.id, cell: c.s.zoneIndex, ...(round.rule ? { rule: round.rule } : {}), marks: 0, got: [], hold: {}, lost: 0, shattered: [],
    card: m.exam?.card ?? null, over: false, k: 1, hp: c.s.hero.hp,
  }
}

/** The result: the flags, the room quiet at once (a card is never a danger), and the score card. */
function end(c: Ctx, x: ExamState, round: RoundDef) {
  const s = c.s
  const m = s.map
  x.marks = Math.max(0, x.marks)
  const passed = x.marks >= round.pass
  if (passed) setFlag(s, `exam.${round.id}`)
  if (x.marks >= round.max) setFlag(s, `exam.${round.id}.full`)
  x.over = true
  delete x.rule
  x.k = 1
  quiet(s, x.cell)
  m.projectiles.length = 0
  m.bombs.length = 0
  m.blasts.length = 0
  m.thrown.length = 0
  x.card = { id: round.id, entry: round.entry, cell: x.cell, marks: x.marks, pass: round.pass, max: round.max, passed, t: 0 }
  c.ev.push({ type: 'stamp', passed })
}

/**
 * The card has played. A round not passed is sat again: a fade back to its door and the map afresh (foes, pots,
 * panes), no hearts lost. A hero who has walked out in the meantime stays where it is. True: the fade has begun.
 */
function cardDone(c: Ctx, x: ExamState): boolean {
  const s = c.s
  const card = x.card!
  x.card = null
  // (A passed round's card may have played on over the next round: that one goes on.)
  if (x.over) delete s.map.exam
  if (card.passed || s.zoneIndex !== card.cell) return false
  s.mode = 'warp'
  s.warp = { t: 0, to: s.map.id, entry: card.entry, swapped: false }
  s.hero.act = 'idle'
  c.ev.push({ type: 'warp' })
  return true
}

/** The room's foes are not there (they carry no `once` flag, so nothing else is touched). */
function quiet(s: GameState, cell: number) {
  for (const e of s.map.enemies) {
    if (e.cell !== cell || e.dead) continue
    e.dead = true
    e.knock = null
    delete e.deathT
  }
}

/** Is the round of this room quiet: passed, or just over? */
function done(s: GameState, info: MapInfo, cell: number): boolean {
  const round = cellDef(info, cell)?.round
  return !!round && (has(s, `exam.${round.id}`) || (!!s.map.exam?.over && s.map.exam.cell === cell))
}

/**
 * The hero is in a new room (`game.ts` `enterCell`, after its foes were made fresh): a round walked out of is gone,
 * a passed one has no foes, and a round's room is the continue point from now.
 */
export function examEnterCell(c: Ctx, index: number) {
  const s = c.s
  const m = s.map
  if (m.exam && m.exam.cell !== index && !m.exam.over) {
    // (The card of the round passed before it may still be playing: it is left to play, belonging to no room.)
    if (m.exam.card?.passed) Object.assign(m.exam, { over: true, cell: -1, rule: undefined })
    else delete m.exam
  }
  if (done(s, c.info, index)) quiet(s, index)
  const round = cellDef(c.info, index)?.round
  if (round) s.entry = { map: m.id, entry: round.entry }
}

/** A map loaded afresh: the passed rounds' rooms have no foes. */
export function examEnterMap(world: World, s: GameState) {
  const info = mapInfo(world, s.map.id)
  for (const e of s.map.enemies) if (done(s, info, e.cell)) quiet(s, e.cell)
}

/** A stand of its own gets its pot back `wait` s after it went, as soon as nothing is on the tile. */
function stepStands(c: Ctx, dt: number) {
  if (!c.info.lends.length) return
  const s = c.s
  const m = s.map
  const waits = (m.stands ??= {})
  for (const st of c.info.lends) {
    if (m.tiles[st.idx] === st.tile) { delete waits[st.idx]; continue }
    const t = (waits[st.idx] ?? 0) + dt
    waits[st.idx] = t
    if (t < st.wait || m.tiles[st.idx] !== '.') continue
    const tx = st.idx % m.w
    const ty = Math.floor(st.idx / m.w)
    const on = (x: number, y: number, r: number) => circleOnTile(x, y, r, tx, ty)
    const h = s.hero
    if (on(h.x, h.y, HERO_R) || m.enemies.some(e => !e.dead && on(e.x, e.y, e.r)) || m.thrown.some(o => on(o.x, o.y, 0.3)) ||
      m.bombs.some(b => on(b.x, b.y, 0.2)) || m.moving.some(b => b.tx === tx && b.ty === ty)) continue
    m.tiles[st.idx] = st.tile
    m.version++
    delete waits[st.idx]
    c.ev.push({ type: 'restock', x: tx + 0.5, y: ty + 0.5 })
  }
}
