/**
 * Space Voyagers II: ships in the world: making them, finding them, and what
 * a hit does. Damage goes through the shield on the side it came from (front
 * or back), then the armour on that side (front, back, left, right), then the
 * core; the core gone and the ship is lost (DESIGN.md, "Damage").
 */
import { SHIPS } from './balance.ts'
import { makeControls } from './flight.ts'
import { q4, qCopyTo, unrotateTo, subTo, v3, copyTo, normTo } from './math.ts'
import type { Q4, V3 } from './math.ts'
import type { Ai, AiMode, GameEvent, Ship, ShipKind, Side, Turret, World } from './types.ts'

export function shipAt(w: World, id: number): Ship | null {
  if (id < 0) return null
  for (const s of w.ships) if (s.id === id) return s
  return null
}

/** Alive and in the fight: not dead, not escaped. */
export function live(s: Ship | null): s is Ship {
  return s !== null && s.dead === 0 && !s.gone
}

export function emit(w: World, e: GameEvent): void {
  w.events.push(e)
}

export function makeAi(mode: AiMode, skill: number, nerve = 0.6): Ai {
  return {
    mode, t: 0, think: 0, aim: v3(), err: v3(), leader: -1, slot: v3(), skill, nerve, order: null, out: makeControls(),
  }
}

export interface SpawnOpts {
  name?: string
  pilot?: string
  ai?: AiMode | null
  skill?: number
  nerve?: number
  role?: Ship['role']
  speed?: number
}

export function spawnShip(w: World, kind: ShipKind, side: Side, pos: V3, q: Q4 = q4(), o: SpawnOpts = {}): Ship {
  const k = SHIPS[kind]
  const turrets: Turret[] = (k.turrets ?? []).map(t => {
    const dir = normTo(v3(), v3(t.dir[0], t.dir[1], t.dir[2]))
    return { at: v3(t.at[0], t.at[1], t.at[2]), dir, cone: t.cone, aim: copyTo(v3(), dir), cool: 0, target: -1, hp: 1 }
  })
  const s: Ship = {
    id: w.nextId++,
    kind,
    side,
    name: o.name ?? k.label,
    pilot: o.pilot ?? '',
    pos: copyTo(v3(), pos),
    vel: v3(),
    q: qCopyTo(q4(), q),
    rate: v3(),
    speed: o.speed ?? k.cruise,
    cruise: k.cruise,
    fuel: 1,
    burning: false,
    shieldF: k.shield,
    shieldB: k.shield,
    armour: { f: k.armour, b: k.armour, l: k.armour, r: k.armour },
    core: k.core,
    energy: 1,
    gunCool: 0,
    gunSide: 1,
    missiles: k.missiles,
    missileCool: 0,
    lock: 0,
    decoys: k.decoys,
    target: -1,
    sinceHit: 9999,
    lastHitBy: -1,
    turrets,
    ai: o.ai ? makeAi(o.ai, o.skill ?? 0.5, o.nerve ?? 0.6) : null,
    dead: 0,
    gone: false,
    role: o.role ?? '',
    r: k.r,
    kills: 0,
  }
  w.ships.push(s)
  return s
}

const LOCAL = v3()
const REL = v3()

export type HitSide = 'f' | 'b' | 'l' | 'r'

/** Which side of `s` a hit from `from` lands on. */
export function sideOf(s: Ship, from: V3): HitSide {
  subTo(REL, from, s.pos)
  unrotateTo(LOCAL, s.q, REL)
  // The nose is -z: a source with negative local z is in front.
  const ax = Math.abs(LOCAL.x), az = Math.abs(LOCAL.z)
  if (az >= ax) return LOCAL.z < 0 ? 'f' : 'b'
  return LOCAL.x < 0 ? 'l' : 'r'
}

export interface HitResult {
  /** Points the shield took, the armour took, the core took. */
  shield: number
  armour: number
  core: number
  side: HitSide
  killed: boolean
}

/**
 * Hurt `s` by `dmg` from a point `from` (where the shot came from), done by
 * ship `by`. Returns what was taken where; emits the hit and, when it is
 * the last, the kill. A ship that is already dead takes nothing.
 */
export function hurt(w: World, s: Ship, dmg: number, from: V3, by: number, at: V3 = s.pos): HitResult {
  const res: HitResult = { shield: 0, armour: 0, core: 0, side: 'f', killed: false }
  if (!live(s) || dmg <= 0) return res
  const side = sideOf(s, from)
  res.side = side
  let left = dmg
  const front = side !== 'b'
  // The shield on the side the hit comes from; left and right hits share the front shield's
  // half that faces them: half on each.
  if (side === 'f' || side === 'b') {
    const take = Math.min(left, front ? s.shieldF : s.shieldB)
    if (front) s.shieldF -= take; else s.shieldB -= take
    left -= take; res.shield = take
  } else {
    const half = left / 2
    const tf = Math.min(half, s.shieldF), tb = Math.min(half, s.shieldB)
    s.shieldF -= tf; s.shieldB -= tb
    left -= tf + tb; res.shield = tf + tb
  }
  if (left > 0) {
    const take = Math.min(left, s.armour[side])
    s.armour[side] -= take
    left -= take; res.armour = take
  }
  if (left > 0) {
    const take = Math.min(left, s.core)
    s.core -= take
    res.core = take
  }
  s.sinceHit = 0
  s.lastHitBy = by
  emit(w, { type: res.armour > 0 || res.core > 0 ? 'armourHit' : 'shieldHit', a: s.id, b: by, pos: copyTo(v3(), at), value: dmg, kind: side })
  if (s.core <= 0) {
    res.killed = true
    kill(w, s, by)
  }
  return res
}

/** The ship is lost: it explodes (and its pilot ejects, in this game, always). */
export function kill(w: World, s: Ship, by: number): void {
  if (s.dead > 0) return
  s.dead = 1
  s.core = 0
  const killer = shipAt(w, by)
  if (killer && killer.side !== s.side) killer.kills++
  emit(w, { type: 'kill', a: s.id, b: by, kind: s.kind, pos: copyTo(v3(), s.pos), value: SHIPS[s.kind].points })
}

/** Fractions for the damage display: shield f/b, armour f/b/l/r and the core, each 0..1. */
export function condition(s: Ship): { sf: number; sb: number; af: number; ab: number; al: number; ar: number; core: number } {
  const k = SHIPS[s.kind]
  return {
    sf: k.shield ? s.shieldF / k.shield : 0,
    sb: k.shield ? s.shieldB / k.shield : 0,
    af: s.armour.f / k.armour,
    ab: s.armour.b / k.armour,
    al: s.armour.l / k.armour,
    ar: s.armour.r / k.armour,
    core: s.core / k.core,
  }
}

/** How whole a ship is, 0..1: armour and core together (shields left out). */
export function wholeness(s: Ship): number {
  const k = SHIPS[s.kind]
  const a = s.armour
  return (a.f + a.b + a.l + a.r + s.core) / (k.armour * 4 + k.core)
}
