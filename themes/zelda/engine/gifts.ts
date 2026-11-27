/**
 * The Steamhouse's gifts (docs/games/neon-shrine.md, "The Steamhouse"): a souvenir lobbed along a lane that was
 * painted on the floor before it flew. It hurts nothing. It LANDS when it touches a hero who is neither rolling nor in
 * the air, and that is a YES: THE BATH. It is REFUSED when a swing of the blade touches it and the hero holds THE NO:
 * it bursts in paper scraps with every other gift in the air, and what was still to come of its volley is not thrown
 * ("a no is a no"). Without THE NO the blade passes through it. It flies straight, does not steer, hits no foe, and is
 * gone at the wall.
 *
 * Two throw them: the Gift Shop's attendants (`attend.mode: 'throw'`, a beat; so many refused in one visit set their
 * flag, and they stand still) and the Sycophant (`bossSycophant.ts`).
 *
 * One call from `stepObjects` (`stepGifts`).
 */
import type { Dir, GameState, GiftKind, Npc, Projectile, Vec, World } from '../types'
import { ARC_REACH, HERO_R, SPIN_REACH, SWORD_REACH, WINDUP } from '../types'
import { type Ctx } from './combat'
import { startBath } from './attendants'
import { slipSycophant } from './bossSycophant'
import { swingDur } from './hero'
import { cellIndex, cellRect, has, setFlag, solidTile } from './map'
import type { Stencil } from './stencils'
import { angleDiff, dirAngle, nextId, toDir } from './util'

/** The numbers of a gift and of the shop's beat (first values to tune by playing). */
export const GIFTS = {
  /** Tiles a second. */
  speed: 2.0,
  /** The lane painted for it, tiles wide. */
  width: 1.4,
  /** A gift's own radius: with the hero's, how near it lands. `2 * (touch + HERO_R)` is the lane's width, so the paint is what hurts. */
  touch: 0.36,
  /**
   * Seconds out of the sleeve before it can land (it can be cut from the first): the Sycophant may hang beside the
   * hero when it offers, and a gift that left the sleeve already touching would be a YES nobody was asked.
   */
  arm: 0.35,
  /** The blade's reach and this much more refuses it. */
  reach: 0.6,
  /** What the flight and the swing's step cover while a swing is out: a gift this much past that reach is gold. */
  lead: 0.55,
  /** `autoFace` turns the blade to a gift this near. */
  face: 3,
  /** A thrower throws this often, each throw a tell this long; the second thrower this much after the first. */
  beat: 3.0,
  tell: 1.2,
  second: 1.5,
  /** The first thrower's first tell, after the hero is in the room. */
  first: 1.0,
}

export const GIFT_KINDS: readonly GiftKind[] = ['towel', 'tea', 'heart', 'star', 'flower', 'bell']

/** Launches a gift from (x, y) along the lane to `to`. */
export function launchGift(c: Ctx, x: number, y: number, to: Vec, kind: GiftKind) {
  const d = Math.hypot(to.x - x, to.y - y)
  const vx = d > 0.01 ? (to.x - x) / d : 0
  const vy = d > 0.01 ? (to.y - y) / d : 1
  c.s.map.projectiles.push({ id: nextId(c.s), kind: 'gift', gift: kind, x, y, vx: vx * GIFTS.speed, vy: vy * GIFTS.speed, r: GIFTS.touch, t: 0, life: 30, to: { ...to } })
  c.ev.push({ type: 'toss', x, y })
}

/** What `laneOf` needs to know where a gift bursts: the world and the state. */
export type LaneWorld = { w: World; s: GameState }

/** Where a gift thrown from (x, y) toward `to` bursts: at the first wall or at the room's wall, the lane's true end. */
function laneEnd(lw: LaneWorld, x: number, y: number, to: Vec): Vec {
  const d = Math.hypot(to.x - x, to.y - y)
  const ux = d > 0.01 ? (to.x - x) / d : 0
  const uy = d > 0.01 ? (to.y - y) / d : 1
  const z = lw.s.zone
  let u = 0
  for (; u < 80; u += 0.05) {
    const px = x + ux * (u + 0.05)
    const py = y + uy * (u + 0.05)
    if (px < z.x + 1 || py < z.y + 1 || px > z.x + z.w - 1 || py > z.y + z.h - 1 || solidTile(lw.w, lw.s.map, Math.floor(px), Math.floor(py), 'shot')) break
  }
  return { x: x + ux * u, y: y + uy * u }
}

/**
 * A gift's lane on the floor: 1.4 tiles wide (what it lands on) from where it is thrown, straight on to the wall it
 * bursts on; `k`, 0 to 1, how near. Without the world it ends at the spot aimed at.
 */
export const laneOf = (x: number, y: number, to: Vec, k: number, lw?: LaneWorld): Stencil => {
  const end = lw ? laneEnd(lw, x, y, to) : to
  return { t: 'ray', x0: x, y0: y, x1: end.x, y1: end.y, w: GIFTS.width, k }
}

/** The lane still ahead of a gift in the air. */
export const flightLane = (p: Projectile, lw: LaneWorld): Stencil => laneOf(p.x, p.y, { x: p.x + p.vx, y: p.y + p.vy }, 0, lw)

/** How near the hero a gift turns gold: a cut pressed now will meet it. */
export const goldReach = (s: GameState) => (s.inv.arc ? ARC_REACH : SWORD_REACH) + GIFTS.reach + GIFTS.lead
export const giftGold = (s: GameState, p: { x: number; y: number }) => Math.hypot(p.x - s.hero.x, p.y - s.hero.y) <= goldReach(s)

/** True when the hero's blade touches the gift now: the cut's own part of a swing, in its front half, or a spin. */
function cutMeets(s: GameState, p: Projectile): boolean {
  const h = s.hero
  const d = Math.hypot(p.x - h.x, p.y - h.y)
  if (h.spin) return d <= SPIN_REACH + (s.inv.arc ? 0.2 : 0) + GIFTS.reach
  const sw = h.swing
  if (!sw || sw.t < 0 || sw.t / swingDur(sw) < WINDUP) return false
  if (d > (s.inv.arc ? ARC_REACH : SWORD_REACH) + (sw.n === 2 ? 0.1 : 0) + GIFTS.reach) return false
  return angleDiff(Math.atan2(p.y - h.y, p.x - h.x), sw.a ?? dirAngle(sw.dir)) <= Math.PI / 2
}

/** Every gift's step, and the throwers' beat. */
export function stepGifts(c: Ctx, dt: number) {
  stepThrowers(c, dt)
  const s = c.s
  const m = s.map
  const h = s.hero
  const flying = () => m.projectiles.filter(p => p.kind === 'gift')
  if (!flying().length) return
  const z = cellRect(c.info, s.zoneIndex)
  for (const p of flying()) {
    p.t += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    const out = p.x < z.x + 1 || p.y < z.y + 1 || p.x > z.x + z.w - 1 || p.y > z.y + z.h - 1
    if (out || p.t > p.life || solidTile(c.w, m, Math.floor(p.x), Math.floor(p.y), 'shot')) {
      c.ev.push({ type: 'scraps', x: p.x - p.vx * 0.1, y: p.y - p.vy * 0.1, refused: false })
      drop(c, p)
    }
  }
  // A refusal first: a cut and a landing in the same instant is a no.
  const met = has(s, 'item:no') ? flying().find(p => cutMeets(s, p)) : undefined
  if (met) { refuseAll(c, met); return }
  if (h.auto || h.roll || h.air || h.act === 'dead' || h.act === 'fall') return
  if (flying().some(p => p.t >= GIFTS.arm && Math.hypot(p.x - h.x, p.y - h.y) < p.r + HERO_R)) {
    for (const p of flying()) drop(c, p)
    startBath(c)
  }
}

function drop(c: Ctx, p: Projectile) {
  const i = c.s.map.projectiles.indexOf(p)
  if (i >= 0) c.s.map.projectiles.splice(i, 1)
}

/** "A no is a no": every gift in the air bursts, the shop counts them, and the Sycophant's smile slips. */
function refuseAll(c: Ctx, met: Projectile) {
  const s = c.s
  const all = s.map.projectiles.filter(p => p.kind === 'gift')
  c.ev.push({ type: 'refuse', x: met.x, y: met.y })
  c.ev.push({ type: 'hitStop', ms: 60 })
  for (const p of all) { c.ev.push({ type: 'scraps', x: p.x, y: p.y, refused: true }); drop(c, p) }
  for (const n of throwers(c)) {
    const t = n.toss!
    if (has(s, t.set)) continue
    t.refused += all.length
    if (t.refused < t.n) continue
    // Enough: the flag is set, and no thrower of it throws again.
    setFlag(s, t.set)
    for (const o of throwers(c)) if (o.toss!.set === t.set) o.toss!.tell = 0
    c.ev.push({ type: 'secret' })
  }
  for (const e of s.map.enemies) if (e.kind === 'sycophant' && !e.dead && e.cell === s.zoneIndex) slipSycophant(c, e)
}

/** The throwers of the hero's room. */
const throwers = (c: Ctx): Npc[] => c.s.map.npcs.filter(n => n.toss && cellIndex(c.info, n.x, n.y) === c.s.zoneIndex)

/** Where a thrower's gift leaves its sleeve: half a tile toward the spot it aims at. */
export function sleeveOf(n: Npc): Vec {
  const t = n.toss!
  const d = Math.hypot(t.x - n.x, t.y - n.y) || 1
  return { x: n.x + ((t.x - n.x) / d) * 0.55, y: n.y + ((t.y - n.y) / d) * 0.55 }
}

function stepThrowers(c: Ctx, dt: number) {
  const s = c.s
  const h = s.hero
  let place = 0
  for (const n of s.map.npcs) {
    const t = n.toss
    if (!t) continue
    const order = place++
    // A visit lasts until the hero leaves the room: the count, and the beat, start again.
    if (cellIndex(c.info, n.x, n.y) !== s.zoneIndex) {
      t.wait = GIFTS.first + (order % 2) * GIFTS.second
      t.tell = 0
      t.refused = 0
      continue
    }
    if (has(s, t.set)) { t.tell = 0; continue }
    t.wait -= dt
    if (t.tell > 0) {
      t.tell = Math.max(0, t.tell - dt)
      if (t.tell === 0) {
        const from = sleeveOf(n)
        launchGift(c, from.x, from.y, { x: t.x, y: t.y }, nextGift(s, n))
        t.thrown++
      }
    } else if (t.wait <= 0) {
      t.wait += GIFTS.beat
      t.tell = GIFTS.tell
      t.x = h.x
      t.y = h.y
      n.dir = toDir(h.x - n.x, h.y - n.y, n.dir)
    }
  }
}

/** The souvenir a thrower throws next: through the six, the two throwers never in step. */
export const nextGift = (s: GameState, n: Npc): GiftKind =>
  GIFT_KINDS[(n.toss!.thrown * 2 + s.map.npcs.filter(o => o.toss).indexOf(n)) % GIFT_KINDS.length]!

/** The lanes of the throws being told (the flying gifts' own lanes run from them to their spots). */
export function throwerLanes(lw: LaneWorld): Stencil[] {
  const s = lw.s
  const out: Stencil[] = []
  for (const n of s.map.npcs) {
    const t = n.toss
    if (!t || t.tell <= 0) continue
    const from = sleeveOf(n)
    out.push(laneOf(from.x, from.y, { x: t.x, y: t.y }, 1 - t.tell / GIFTS.tell, lw))
  }
  return out
}

type Faced = { d: number; dir: Dir; a: number }

/**
 * `autoFace`'s other targets: the nearest gift within `GIFTS.face` tiles, when it is nearer than `best` (the foe the
 * blade would turn to), so that a thumb that last dodged east still turns to a gift from the north.
 */
export function faceGift(c: Ctx, best: Faced | null): Faced | null {
  const h = c.s.hero
  let out = best
  if (!has(c.s, 'item:no')) return out
  for (const p of c.s.map.projectiles) {
    if (p.kind !== 'gift') continue
    const d = Math.hypot(p.x - h.x, p.y - h.y)
    if (d <= GIFTS.face && (!out || d < out.d)) out = { d, dir: toDir(p.x - h.x, p.y - h.y, h.dir), a: Math.atan2(p.y - h.y, p.x - h.x) }
  }
  return out
}
