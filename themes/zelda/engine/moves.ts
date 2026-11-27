/**
 * The blade's acrobatics and the hop (docs/games/neon-shrine.md, "Combos and the hop"): the hero leaves the ground.
 *
 * - *In the air* (`Hero.air`). A flip out of a roll (R, A: FLIP CUT) comes down in an overhead chop; a flip back
 *   out of the chain (A, R: BACKFLIP) or off a wall a roll ran into (WALL SPRING) can be followed by A, the COMET,
 *   a thrust that rockets through whatever stands along the aim; A right as the finisher lands takes off into the
 *   TEMPEST, an aerial double whirl. No foe harms the hero in the air (`hurtHero`'s `foe`); a rolling stone or a
 *   blast still does, and brings him down. The air never crosses a pit, spikes or ice, flown head on or along a
 *   wall (it stops at their edge, as the chain's lunge does), so no gap the hook is for and no ice lane is skipped.
 * - *SLIP*. A blow that passes through the roll's first moments slows the world (`GameState.slow`) for a moment,
 *   the hero at full pace, and their next blow is critical (`Hero.edge`).
 * - *Mastery* (`Inventory.moves`). Each combo counts when it lands (BACKFLIP and WALL SPRING when done with a foe
 *   near, SLIP when it slips); `MOVES[].need` of them masters it, and a mastered combo hits harder or goes farther.
 * - *The art* (`ARTS`): HOP, the Keeper's. It sits on B among the items (`UseItem`), resting a moment after use; a
 *   landed blow of the blade shortens the rest (`ART_FEED`). A quick low hop away from the nearest foe (along the
 *   stick when it is pushed), turned to face it, out of reach of its blows while in the air. It may come out of a hit
 *   of the chain, a roll or a held charge, and fight on: the chain keeps its count through it, and A in the hop or
 *   just after it is the HOP CUT, the chain's next hit sprung back in at the foe (critical when a blow passed under).
 */
import type { AirKind, ArtId, Enemy, GameState, Input, ItemId, MoveId, UseItem } from '../types'
import {
  AIR, ART_FEED, ARC_REACH, ARTS, BUFFER_A, COMET_DMG, COMET_WINDOW, FLIP_CHOP, HERO_R, HOP, MOVES, SLIP_COOL,
  SLIP_TIME, SWORD_REACH, TEMPEST, TEMPEST_FROM, TEMPEST_WINDOW,
} from '../types'
import { hitEnemy, type Ctx, type HitOpts } from './combat'
import { enemyActive } from './enemies'
import { cellIndex, lineClear, moveCircle, solidTile, tileAt } from './map'
import { iceUnder } from './puzzles/index'
import { angleDiff, toDir } from './util'
import { TILE_INFO } from '../world/tiles'
import { bladeHits, swingDur, underfoot, aimOf } from './hero'

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const ART_IDS: readonly ArtId[] = ARTS.map(a => a.id)
export const isArt = (u: UseItem | null | undefined): u is ArtId => !!u && (ART_IDS as readonly string[]).includes(u)
export const artDef = (id: ArtId) => ARTS.find(a => a.id === id)!
export const knowsArt = (s: GameState, id: ArtId) => !!s.inv.arts?.includes(id)
/** The art an item teaches (null: not an art). */
export const artOfItem = (item: ItemId): ArtId | null => ARTS.find(a => a.item === item)?.id ?? null
export const moveDef = (id: MoveId) => MOVES.find(m => m.id === id)!
export const moveCount = (s: GameState, id: MoveId) => s.inv.moves?.[id] ?? 0
export const mastered = (s: GameState, id: MoveId) => moveCount(s, id) >= moveDef(id).need

/** Learn an art (no presentation): it joins the B items, and is in hand. */
export function learnArt(s: GameState, id: ArtId) {
  const inv = s.inv
  if (!inv.arts) inv.arts = []
  if (!inv.arts.includes(id)) inv.arts.push(id)
  inv.selected = id
}

/** One more of a combo towards its mastery, and the call-out. */
export function credit(c: Ctx, id: MoveId) {
  const inv = c.s.inv
  if (!inv.moves) inv.moves = {}
  const n = Math.min(999, (inv.moves[id] ?? 0) + 1)
  inv.moves[id] = n
  c.ev.push({ type: 'move', id, n, first: n === 1, mastered: n === moveDef(id).need })
}

/** A foe in the fight near the hero (BACKFLIP and WALL SPRING count towards mastery only then). */
function foeNear(c: Ctx, d: number) {
  const h = c.s.hero
  return c.s.map.enemies.some(e => enemyActive(c, e) && Math.hypot(e.x - h.x, e.y - h.y) < d)
}

/** Every art still resting rests a little less (a landed blow of the blade). */
export function feedArts(s: GameState) {
  const cool = s.hero.artCool
  if (!cool) return
  for (const k of Object.keys(cool) as ArtId[]) cool[k] = Math.max(0, (cool[k] ?? 0) - ART_FEED)
}

/** Clear what is under way in the air (a hurt, a door, a find, a scroll, a fall), and the windows after it. */
export function endMoves(h: GameState['hero']) {
  h.air = null
  h.cometT = 0
  h.hopT = 0
  h.hopDodged = false
}

/** Clear all of it, a SLIP's edge and its slow too: a new map. */
export function resetMoves(s: GameState) {
  endMoves(s.hero)
  s.hero.edge = false
  s.slow = 0
}

// ---------------------------------------------------------------------------
// In the air
// ---------------------------------------------------------------------------

/** Seconds a kind stays in the air. */
export const airTime = (kind: AirKind) => AIR[kind].time

/** How high the hero is now (tiles above the ground): the arc of the move under way; 0 on the ground. */
export function heroZ(h: { air?: GameState['hero']['air'] }): number {
  const a = h.air
  if (!a) return 0
  const d = AIR[a.kind]
  const p = Math.min(1, a.t / d.time)
  // From where it began (a comet out of a flip), along the move's own arc.
  return a.z0 * (1 - p) + 4 * d.top * p * (1 - p)
}

/** Is the ground at (x, y) one the air must not cross (a pit, spikes, ice)? */
function hazard(c: Ctx, x: number, y: number) {
  const t = TILE_INFO[tileAt(c.s.map, Math.floor(x), Math.floor(y))]
  return !!t?.pit || !!t?.hurt || iceUnder(c, x, y)
}

/**
 * Take off: `kind` along (dx, dy) (unit), the blow along angle `a`. On ice, nothing (the slide keeps its lanes).
 * Returns whether the hero left the ground.
 */
export function startAir(c: Ctx, kind: AirKind, dx: number, dy: number, a: number, from?: AirKind): boolean {
  const s = c.s
  const h = s.hero
  if (iceUnder(c)) return false
  const d = AIR[kind]
  let sp = d.speed
  if ((kind === 'back' && mastered(s, 'backflip')) || (kind === 'spring' && mastered(s, 'spring'))) sp *= 1.25
  const z0 = heroZ(h)
  h.air = { t: 0, kind, vx: dx * sp, vy: dy * sp, a, hit: [], z0, ...(from ? { from } : {}) }
  h.roll = null
  h.swing = null
  h.spin = null
  // (A charge held into a hop is kept: let go once down, and the spin comes.)
  if (kind !== 'hop') h.charge = -1
  h.bufA = 0
  h.bufRoll = 0
  h.push = 0
  h.cometT = 0
  h.hopT = 0
  h.hopDodged = false
  h.slipped = false
  h.act = 'air'
  h.actT = 0
  if (kind !== 'back') { h.dir = toDir(Math.cos(a), Math.sin(a), h.dir); h.aim = a }
  // (The hop flies one way and faces another: the figure and the blade go by `a`.)
  c.ev.push({ type: 'air', kind })
  return true
}

/** The nearest foe in the fight within `d` of (x, y), and within `cone` of angle `a` when given. */
function nearestFoe(c: Ctx, x: number, y: number, d: number, a?: number, cone = Math.PI): Enemy | null {
  let best: Enemy | null = null
  let bd = Infinity
  for (const e of c.s.map.enemies) {
    if (!enemyActive(c, e)) continue
    const dd = Math.hypot(e.x - x, e.y - y)
    if (dd > d + e.r || dd >= bd) continue
    if (a !== undefined && dd > 0.3 && angleDiff(Math.atan2(e.y - y, e.x - x), a) > cone) continue
    if (!lineClear(c.w, c.s.map, x, y, e.x, e.y)) continue
    best = e
    bd = dd
  }
  return best
}

/** The way the stick points (unit), or null when it is at rest. */
function stickOf(inp: Input): { x: number; y: number } | null {
  const m = Math.hypot(inp.move.x, inp.move.y)
  return m > 0.3 ? { x: inp.move.x / m, y: inp.move.y / m } : null
}

/** FLIP CUT: a press of A in a roll springs into a somersault along it. */
export function startFlip(c: Ctx, inp: Input): boolean {
  const h = c.s.hero
  const r = h.roll
  if (!r) return false
  const st = stickOf(inp)
  let dx = st?.x ?? r.vx
  let dy = st?.y ?? r.vy
  const m = Math.hypot(dx, dy) || 1
  dx /= m
  dy /= m
  return startAir(c, 'flip', dx, dy, Math.atan2(dy, dx))
}

/**
 * BACKFLIP: a roll pressed during the chain (or just after a hit of it) with the stick at rest or pulled back flips
 * away from the blow, still facing it. Null when this roll is an ordinary one.
 */
export function backflipWanted(c: Ctx, inp: Input): boolean {
  const h = c.s.hero
  const inChain = (h.swing && h.swing.n !== undefined) || (h.combo && h.combo.t > 0)
  if (!inChain) return false
  const st = stickOf(inp)
  if (!st) return true
  const a = h.swing?.a ?? aimOf(h)
  return st.x * Math.cos(a) + st.y * Math.sin(a) < -0.35
}

export function startBackflip(c: Ctx): boolean {
  const s = c.s
  const h = s.hero
  const a = h.swing?.a ?? aimOf(h)
  h.combo = undefined
  const dir = h.dir
  const ok = startAir(c, 'back', -Math.cos(a), -Math.sin(a), a)
  h.dir = dir
  if (ok && foeNear(c, 3.5)) credit(c, 'backflip')
  return ok
}

/** WALL SPRING: a roll that runs into a wall kicks off it, the way it came reflected off the wall. */
export function wallSpring(c: Ctx, hitX: boolean, hitY: boolean): boolean {
  const s = c.s
  const h = s.hero
  const r = h.roll
  if (!r || r.t < 0.04) return false
  let vx = r.vx
  let vy = r.vy
  const v = Math.hypot(vx, vy) || 1
  // Only a real wall (a tree, a wall, a cliff), met nearly head on along that axis.
  // The map's own rim is no wall: off it lies the next map (a pass, an open edge).
  const wallAt = (sx: number, sy: number) => {
    const tx = Math.floor(h.x + sx * (HERO_R + 0.12))
    const ty = Math.floor(h.y + sy * (HERO_R + 0.12))
    if (tx < 0 || ty < 0 || tx >= s.map.w || ty >= s.map.h) return false
    return solidTile(c.w, s.map, tx, ty, 'shot')
  }
  let ok = false
  if (hitX && Math.abs(vx) > v * 0.55 && wallAt(Math.sign(vx), 0)) { vx = -vx; ok = true }
  if (hitY && Math.abs(vy) > v * 0.55 && wallAt(0, Math.sign(vy))) { vy = -vy; ok = true }
  if (!ok) return false
  const m = Math.hypot(vx, vy) || 1
  const went = startAir(c, 'spring', vx / m, vy / m, Math.atan2(vy, vx))
  if (went && foeNear(c, 5)) credit(c, 'spring')
  return went
}

/** COMET: out of a back flip or a wall spring (or just after either lands), along the stick or the aim. */
export function canComet(h: GameState['hero']): boolean {
  if (h.air) return (h.air.kind === 'back' || h.air.kind === 'spring') && h.air.t > 0.05
  return (h.cometT ?? 0) > 0
}

export function startComet(c: Ctx, inp: Input): boolean {
  const h = c.s.hero
  const from = h.air?.kind ?? 'back'
  const st = stickOf(inp)
  let a = st ? Math.atan2(st.y, st.x) : aimOf(h)
  // The nearest foe roughly that way draws the thrust to it.
  const e = nearestFoe(c, h.x, h.y, 4.5, a, Math.PI * 0.3)
  if (e) a = Math.atan2(e.y - h.y, e.x - h.x)
  return startAir(c, 'comet', Math.cos(a), Math.sin(a), a, from)
}

/** TEMPEST: A from late in the finisher, or just after it. */
export function canTempest(h: GameState['hero']): boolean {
  const sw = h.swing
  if (sw) return sw.n === 2 && sw.t / swingDur(sw) >= TEMPEST_FROM
  return !!h.combo && h.combo.n === 2 && h.combo.t > 0 && h.combo.t <= TEMPEST_WINDOW
}

export function startTempest(c: Ctx, inp: Input): boolean {
  const h = c.s.hero
  const st = stickOf(inp)
  const a = h.swing?.a ?? aimOf(h)
  h.combo = undefined
  const ok = startAir(c, 'tempest', st?.x ?? 0, st?.y ?? 0, a)
  if (ok && h.air) h.air.turn = -1
  return ok
}

const bladeReach = (s: GameState) => (s.inv.arc ? ARC_REACH : SWORD_REACH)
const arcMul = (s: GameState) => (s.inv.arc ? 2 : 1)

/** A step of the hero in the air. */
export function stepAir(c: Ctx, inp: Input, dt: number) {
  const s = c.s
  const h = s.hero
  const a = h.air!
  const d = AIR[a.kind]
  // A press of A out of a back flip or a wall spring: the comet, at once. Any other waits for the landing.
  if (inp.aPress && s.inv.sword && canComet(h)) { startComet(c, inp); return }
  if (inp.aPress && s.inv.sword) a.queued = true
  a.t += dt
  const p = Math.min(1, a.t / d.time)
  // A little steering (not the comet's, which goes where it was sent).
  if (a.kind !== 'comet') {
    const st = stickOf(inp)
    if (st) {
      const v = Math.hypot(a.vx, a.vy)
      if (v > 0.5) {
        const cur = Math.atan2(a.vy, a.vx)
        const want = Math.atan2(st.y, st.x)
        const turn = Math.max(-3 * dt, Math.min(3 * dt, Math.atan2(Math.sin(want - cur), Math.cos(want - cur))))
        a.vx = Math.cos(cur + turn) * v
        a.vy = Math.sin(cur + turn) * v
      } else if (a.kind === 'tempest') { a.vx = st.x * d.speed; a.vy = st.y * d.speed }
    }
  }
  const k = 1 - d.drag * p
  let mx = a.vx * k * dt
  let my = a.vy * k * dt
  // Never over a pit, spikes or ice: the air stops at their edge.
  const len = Math.hypot(mx, my)
  const er = HERO_R + 0.06
  if (len > 1e-6 && hazard(c, h.x + (mx / len) * er + mx, h.y + (my / len) * er + my)) { mx = 0; my = 0; a.vx = 0; a.vy = 0 }
  // Pressed to a wall, that probe lands in the wall while the other axis slides along it: then look ahead of
  // where the slide goes (moveCircle is pure; only a clamped axis asks, so a flight past a corner keeps its line).
  if (mx !== 0 && my !== 0) {
    const t = moveCircle(c.w, s.map, h.x, h.y, HERO_R, mx, my)
    if ((t.hitX && hazard(c, t.x, t.y + Math.sign(my) * er)) || (t.hitY && hazard(c, t.x + Math.sign(mx) * er, t.y))) { mx = 0; my = 0; a.vx = 0; a.vy = 0 }
  }
  // In a dungeon the air stays in the hero's room.
  if (c.info.def.kind === 'dungeon' && cellIndex(c.info, h.x + mx * 4, h.y + my * 4) !== cellIndex(c.info, h.x, h.y)) { mx = 0; my = 0; a.vx = 0; a.vy = 0 }
  const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, mx, my)
  h.x = r.x
  h.y = r.y
  h.vx = mx / dt
  h.vy = my / dt
  h.walkT += dt

  const mul = arcMul(s)
  switch (a.kind) {
    case 'comet': {
      // Through everything along the way, blade first.
      const dmg = (COMET_DMG + (mastered(s, 'comet') ? 1 : 0)) * mul
      const opt: HitOpts = { knock: 1.1, stagger: 0.45, stop: 45 }
      let n = bladeHits(c, a.a, bladeReach(s) * 0.85, dmg, 'sword', a.hit, opt)
      for (const e of s.map.enemies) {
        if (!enemyActive(c, e) || a.hit.includes(e.id)) continue
        if (Math.hypot(e.x - h.x, e.y - h.y) < e.r + HERO_R + 0.4) {
          a.hit.push(e.id)
          if (hitEnemy(c, e, dmg, h.x - Math.cos(a.a) * 0.5, h.y - Math.sin(a.a) * 0.5, 'sword', opt)) n++
        }
      }
      if (n > 0 && !a.landed) { a.landed = true; credit(c, 'comet') }
      // A wall ends it there.
      if (r.hitX || r.hitY) a.t = d.time
      break
    }
    case 'tempest': {
      // Two whirls in the air, each half turn a fresh blow at everything round.
      const half = Math.floor(p * TEMPEST.turns * 2)
      if (half !== a.turn) { a.turn = half; a.hit = a.hit.filter(id => id.startsWith('t')) }
      const dmg = (TEMPEST.dmg + (mastered(s, 'tempest') ? 1 : 0)) * mul
      const base = a.a
      const p0 = Math.max(0, (a.t - dt) / d.time)
      let n = 0
      for (let j = 0; j <= 3; j++) {
        const q = p0 + ((p - p0) * j) / 3
        n += bladeHits(c, base + Math.PI * 2 * TEMPEST.turns * q, TEMPEST.reach + (s.inv.arc ? 0.2 : 0), dmg, 'spin', a.hit, { knock: 0.7, stagger: 0.3, stop: 30, chain: true })
      }
      if (n > 0 && !a.landed) { a.landed = true; credit(c, 'tempest') }
      break
    }
    case 'flip': {
      // The chop comes round overhead in the last part, and cuts as it comes down (`land`).
      break
    }
  }
  // (A blow just struck may have taken the hero out of the air: a zapper's shock.)
  if (h.air !== a || s.mode !== 'play') return
  if (a.t >= d.time) land(c)
}

/** Down again: what the landing does, and back on the ground. */
function land(c: Ctx) {
  const s = c.s
  const h = s.hero
  const a = h.air
  if (!a) return
  const d = AIR[a.kind]
  const mul = arcMul(s)
  let heavy = false
  if (a.kind === 'flip') {
    heavy = true
    // The chop turns to the nearest foe within reach, wherever the flip came down.
    const e = nearestFoe(c, h.x, h.y, FLIP_CHOP.reach + 0.9)
    const at = e ? Math.atan2(e.y - h.y, e.x - h.x) : a.a
    a.a = at
    h.dir = toDir(Math.cos(at), Math.sin(at), h.dir)
    h.aim = at
    const dmg = (FLIP_CHOP.dmg + (mastered(s, 'flip') ? 1 : 0)) * mul
    const opt: HitOpts = { knock: 1.5, stagger: 0.45, stop: 70 }
    let n = 0
    for (let j = 0; j <= 6; j++) n += bladeHits(c, at - FLIP_CHOP.arc / 2 + (FLIP_CHOP.arc * j) / 6, FLIP_CHOP.reach, dmg, 'sword', a.hit, opt)
    // And the ground shakes all round.
    for (const f of s.map.enemies) {
      if (!enemyActive(c, f) || a.hit.includes(f.id)) continue
      if (Math.hypot(f.x - h.x, f.y - h.y) < FLIP_CHOP.ring + f.r && lineClear(c.w, s.map, h.x, h.y, f.x, f.y)) {
        a.hit.push(f.id)
        if (hitEnemy(c, f, mul, h.x, h.y, 'sword', { knock: 1, stagger: 0.3, stop: 40 })) n++
      }
    }
    if (n > 0) credit(c, 'flip')
    s.shake = Math.max(s.shake, 0.1)
  } else if (a.kind === 'back' || a.kind === 'spring') {
    h.cometT = COMET_WINDOW
  } else if (a.kind === 'hop') {
    h.hopT = HOP.window
    h.hopDodged = !!a.dodged
  }
  c.ev.push({ type: 'touchdown', kind: a.kind, x: h.x, y: h.y, heavy, a: a.a })
  if (s.mode !== 'play') { h.air = null; return }
  h.air = null
  h.act = 'idle'
  h.actT = 0
  h.vx = 0
  h.vy = 0
  h.cooldown = Math.max(h.cooldown, d.rest)
  // A pressed in the air strikes as soon as the landing lets the blade go.
  if (a.queued) h.bufA = BUFFER_A + d.rest
  underfoot(c)
}

/** A step after landing: the comet's and the hop cut's windows close. */
export function stepAfter(h: GameState['hero'], dt: number) {
  if ((h.cometT ?? 0) > 0) h.cometT = Math.max(0, h.cometT! - dt)
  if ((h.hopT ?? 0) > 0) { h.hopT = Math.max(0, h.hopT! - dt); if (!h.hopT) h.hopDodged = false }
  if ((h.slipCool ?? 0) > 0) h.slipCool = Math.max(0, h.slipCool! - dt)
}

// ---------------------------------------------------------------------------
// SLIP
// ---------------------------------------------------------------------------

/** A foe's blow passed through the roll's first moments: the world slows, and the next blow is critical. */
export function slip(c: Ctx, x: number, y: number) {
  const s = c.s
  const h = s.hero
  if (h.slipped || (h.slipCool ?? 0) > 0) return
  h.slipped = true
  h.slipCool = SLIP_COOL
  s.slow = SLIP_TIME + (mastered(s, 'slip') ? 0.5 : 0)
  h.edge = true
  c.ev.push({ type: 'slip', x, y })
  credit(c, 'slip')
}

/** The slow runs out on the hero's clock; with it goes the edge. */
export function stepSlow(s: GameState, dt: number) {
  if (!s.slow) return
  s.slow = Math.max(0, s.slow - dt)
  if (s.slow <= 0) { s.slow = 0; s.hero.edge = false }
}

// ---------------------------------------------------------------------------
// The art: HOP
// ---------------------------------------------------------------------------

/** May the art be used now (learned, rested)? */
export const artReady = (s: GameState, id: ArtId) => knowsArt(s, id) && (s.hero.artCool?.[id] ?? 0) <= 0
/** 0..1: how rested the art is (1 ready). */
export function artRest(s: GameState, id: ArtId): number {
  const left = s.hero.artCool?.[id] ?? 0
  return left <= 0 ? 1 : Math.max(0, 1 - left / artDef(id).cool)
}

/** B with an art in hand. False when it could not be used (resting, on ice): the buzz. */
export function useArt(c: Ctx, inp: Input, id: ArtId): boolean {
  const s = c.s
  const h = s.hero
  if (!artReady(s, id)) { c.ev.push({ type: 'error' }); return false }
  const ok = id === 'hop' && hop(c, inp)
  if (!ok) { c.ev.push({ type: 'error' }); return false }
  if (!h.artCool) h.artCool = {}
  h.artCool[id] = artDef(id).cool
  return true
}

/** Each art's rest runs down (the B box fills; a rest this short needs no chime). */
export function stepArts(c: Ctx, dt: number) {
  const cool = c.s.hero.artCool
  if (!cool) return
  for (const k of Object.keys(cool) as ArtId[]) cool[k] = Math.max(0, (cool[k] ?? 0) - dt)
}

/**
 * HOP: a quick low hop away from the nearest foe (along the stick when it is pushed), turned to face it. A hit of the
 * chain it cuts short, or the one just done, stays the chain's last: the next press goes on with the chain (after
 * the finisher it starts over).
 */
function hop(c: Ctx, inp: Input): boolean {
  const h = c.s.hero
  const e = nearestFoe(c, h.x, h.y, HOP.seek)
  const face = e ? Math.atan2(e.y - h.y, e.x - h.x) : h.swing?.a ?? aimOf(h)
  const st = stickOf(inp)
  const way = st ? Math.atan2(st.y, st.x) : face + Math.PI
  const n = h.swing?.n ?? (h.combo && h.combo.t > 0 ? h.combo.n : undefined)
  if (!startAir(c, 'hop', Math.cos(way), Math.sin(way), face)) return false
  h.combo = n === undefined || n === 2 ? undefined : { n, t: AIR.hop.time + HOP.window }
  return true
}

/** A foe's blow passed under the hop: the HOP CUT after it is critical. */
export function hopDodge(h: GameState['hero']) {
  if (h.air?.kind === 'hop') h.air.dodged = true
}

/**
 * The HOP CUT: A in a hop or just after it lands. Where the chain's next hit springs back in (the stick, else the
 * aim, drawn to the nearest foe roughly that way) and how far; null when no hop is that recent.
 */
export function hopCut(c: Ctx, inp: Input): { a: number; dist: number; crit: boolean } | null {
  const h = c.s.hero
  if (!((h.hopT ?? 0) > 0)) return null
  const crit = !!h.hopDodged
  h.hopT = 0
  h.hopDodged = false
  const st = stickOf(inp)
  const a = st ? Math.atan2(st.y, st.x) : aimOf(h)
  const e = nearestFoe(c, h.x, h.y, HOP.reach, a, HOP.cone)
  if (!e) return { a, dist: HOP.bare, crit }
  const d = Math.hypot(e.x - h.x, e.y - h.y)
  // Up to the foe's edge: the spring itself stops once the foe is within half the blade's reach.
  return { a: Math.atan2(e.y - h.y, e.x - h.x), dist: Math.min(HOP.spring, Math.max(0.3, d - e.r)), crit }
}

/** Is the ground at (x, y) one the HOP CUT's spring must stop short of (a pit, spikes, ice)? */
export const springStops = (c: Ctx, x: number, y: number) => hazard(c, x, y)
