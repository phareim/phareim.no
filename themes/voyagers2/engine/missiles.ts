/**
 * Space Voyagers II: missiles. Hold a target in the nose's cone and the lock
 * builds (the tone rises); locked, a missile seeks; unlocked it flies straight
 * (a dart). A seeker turns slower than a fighter can at low speed and is
 * slower than an afterburner: the way out is to burn or to turn hard, and
 * the back seat drops a decoy (DESIGN.md, "Missiles"). Bombers carry
 * torpedoes: slow, heavy, and they can be shot down.
 */
import { MISSILE, SHIPS } from './balance.ts'
import {
  angleBetween, copyTo, dist, forwardTo, maddTo, normTo, q4, qCopyTo, qLookTo, scaleTo, subTo, v3,
} from './math.ts'
import { chance } from './rng.ts'
import { hurt, live, shipAt } from './ships.ts'
import type { Missile, MissileKind, Ship, World } from './types.ts'

/** Missiles and torpedoes hold this many points against bolts. */
export const MISSILE_HP: Record<MissileKind, number> = { dart: 4, seeker: 4, torpedo: 24 }
/** How near a missile has to come to hit: a proximity fuse. */
const FUSE = 6
/** The decoy flag in `Missile.target`: a decoy's index plus this. */
export const DECOY = 1_000_000
/** Lock range. */
export const LOCK_RANGE = 3000

const D = v3()
const F = v3()

/** Build or lose the lock on `s`'s target. Emits lockOn when it starts, locked when it is full. */
export function stepLock(w: World, s: Ship, dt: number): void {
  const o = shipAt(w, s.target)
  const k = SHIPS[s.kind]
  // The Calzone with torpedoes on the rack locks a big ship for a torpedo: longer, from further.
  const calTorp = live(o) && s.torps > 0 && SHIPS[o.kind].capital === true
  if (!live(o) || (s.missiles <= 0 && !calTorp) || k.capital || k.fixed) { s.lock = 0; return }
  subTo(D, o.pos, s.pos)
  const d = Math.sqrt(D.x * D.x + D.y * D.y + D.z * D.z)
  normTo(D, D)
  forwardTo(F, s.q)
  const torp = s.kind === 'hound'
  const cone = torp ? MISSILE.lockCone * 1.4 : MISSILE.lockCone
  const time = calTorp ? MISSILE.calzoneTorpLock : torp ? MISSILE.lockTime * 2.5 : MISSILE.lockTime
  const range = calTorp ? MISSILE.calzoneTorpRange : torp ? 3200 : LOCK_RANGE
  const before = s.lock
  if (d < range && angleBetween(F, D) < cone) {
    s.lock = Math.min(1, s.lock + dt / time)
    if (before === 0 && s.lock > 0) w.events.push({ type: 'lockOn', a: s.id, b: o.id })
    if (before < 1 && s.lock >= 1) w.events.push({ type: 'locked', a: s.id, b: o.id })
  } else {
    s.lock = Math.max(0, s.lock - dt * MISSILE.lockDecay)
  }
}

export function launchMissile(w: World, s: Ship): Missile | null {
  if (s.missileCool > 0 || !live(s)) return null
  const tgt = shipAt(w, s.target)
  // A torpedo from the Calzone: only at a big ship, only locked.
  const calTorp = s.torps > 0 && live(tgt) && SHIPS[tgt.kind].capital === true
  if (calTorp && s.lock < 1) return null
  if (!calTorp && s.missiles <= 0) return null
  const torp = s.kind === 'hound' || calTorp
  const kind: MissileKind = torp ? 'torpedo' : s.lock >= 1 ? 'seeker' : 'dart'
  if (torp && s.lock < 1) return null
  forwardTo(F, s.q)
  const m: Missile = {
    id: w.nextId++,
    kind,
    side: s.side,
    from: s.id,
    target: kind === 'dart' ? -1 : s.target,
    pos: maddTo(v3(), s.pos, F, s.r + 2),
    vel: scaleTo(v3(), F, s.speed + 80),
    q: qCopyTo(q4(), s.q),
    life: kind === 'torpedo' ? 16 : MISSILE.life,
    arm: MISSILE.arm,
    hp: MISSILE_HP[kind],
  }
  w.missiles.push(m)
  if (calTorp) s.torps--
  else s.missiles--
  s.missileCool = MISSILE.cool
  s.lock = 0
  w.events.push({ type: 'missile', a: s.id, b: m.target, kind })
  const t = shipAt(w, m.target)
  if (t && kind !== 'dart') w.events.push({ type: 'missileIn', a: t.id, b: s.id, kind })
  return m
}

/** Drop a decoy behind `s`. Missiles chasing it, not yet too close, may turn for it. */
export function dropDecoy(w: World, s: Ship): boolean {
  if (s.decoys <= 0 || !live(s)) return false
  s.decoys--
  forwardTo(F, s.q)
  const d = { pos: maddTo(v3(), s.pos, F, -s.r * 2), vel: scaleTo(v3(), s.vel, 0.25), life: MISSILE.decoyLife, side: s.side }
  w.decoys.push(d)
  const idx = w.decoys.length - 1
  for (const m of w.missiles) {
    if (m.target !== s.id || m.kind === 'torpedo') continue
    const r = dist(m.pos, s.pos)
    if (r > 120 && r < 1800 && chance(w.rng, MISSILE.decoyChance)) m.target = DECOY + idx
  }
  w.events.push({ type: 'decoy', a: s.id })
  return true
}

const WANT = v3()

/** Fly every missile one step: seek, hit, or run out. */
export function stepMissiles(w: World, dt: number): void {
  for (const s of w.ships) s.missileCool = Math.max(0, s.missileCool - dt)
  for (let i = w.decoys.length - 1; i >= 0; i--) {
    const d = w.decoys[i]!
    d.life -= dt
    maddTo(d.pos, d.pos, d.vel, dt)
  }
  const ms = w.missiles
  for (let i = ms.length - 1; i >= 0; i--) {
    const m = ms[i]!
    m.life -= dt
    m.arm -= dt
    let tpos: { x: number; y: number; z: number } | null = null
    let ship: Ship | null = null
    if (m.target >= DECOY) {
      const d = w.decoys[m.target - DECOY]
      if (d && d.life > 0) tpos = d.pos
    } else if (m.target >= 0) {
      ship = shipAt(w, m.target)
      if (live(ship)) tpos = ship.pos
      else ship = null
    }
    const torp = m.kind === 'torpedo'
    const speed = torp ? MISSILE.torpedoSpeed : MISSILE.speed
    forwardTo(F, m.q)
    if (tpos && m.arm <= 0) {
      subTo(WANT, tpos, m.pos)
      normTo(WANT, WANT)
      const ang = angleBetween(F, WANT)
      const max = (torp ? MISSILE.turn * 0.4 : MISSILE.turn) * dt
      if (ang > 1e-6) {
        const k = Math.min(1, max / ang)
        F.x += (WANT.x - F.x) * k; F.y += (WANT.y - F.y) * k; F.z += (WANT.z - F.z) * k
        normTo(F, F)
        qLookTo(m.q, F)
      }
    }
    const sp = Math.sqrt(m.vel.x * m.vel.x + m.vel.y * m.vel.y + m.vel.z * m.vel.z)
    const nsp = sp + Math.sign(speed - sp) * Math.min(Math.abs(speed - sp), 600 * dt)
    scaleTo(m.vel, F, nsp)
    const px = m.pos.x, py = m.pos.y, pz = m.pos.z
    maddTo(m.pos, m.pos, m.vel, dt)
    // Hit: a seeker or a torpedo only what it chases (one pulled onto a decoy flies past the ship
    // that dropped it); a dart anything of the other side it flies into.
    let hit: Ship | null = null
    for (const s of w.ships) {
      if (!live(s) || s.side === m.side) continue
      if (m.kind !== 'dart' && s.id !== m.target) continue
      const r = s.r + FUSE + (SHIPS[s.kind].capital ? 0 : 0)
      // Swept: the closest point of this step to the ship.
      const sx = m.pos.x - px, sy = m.pos.y - py, sz = m.pos.z - pz
      const tx = s.pos.x - px, ty = s.pos.y - py, tz = s.pos.z - pz
      const l2 = sx * sx + sy * sy + sz * sz
      const t = l2 > 0 ? Math.max(0, Math.min(1, (tx * sx + ty * sy + tz * sz) / l2)) : 0
      const dx = px + sx * t - s.pos.x, dy = py + sy * t - s.pos.y, dz = pz + sz * t - s.pos.z
      if (dx * dx + dy * dy + dz * dz <= r * r) { hit = s; break }
    }
    let gone = m.life <= 0 || m.hp <= 0
    if (hit) {
      const from = maddTo(v3(), hit.pos, normTo(v3(), m.vel), -200)
      const dmg = torp ? MISSILE.torpedoDmg : m.kind === 'seeker' ? MISSILE.dmg : MISSILE.dartDmg
      hurt(w, hit, dmg, from, m.from, copyTo(v3(), m.pos), torp)
      w.events.push({ type: 'hit', a: hit.id, b: m.from, kind: m.kind, pos: copyTo(v3(), m.pos) })
      gone = true
    } else if (m.target >= DECOY && tpos && Math.hypot(tpos.x - m.pos.x, tpos.y - m.pos.y, tpos.z - m.pos.z) < 12) {
      // It found its decoy: both go up.
      gone = true
    } else if (m.target >= DECOY && !tpos) {
      // Its decoy burnt out: the missile flies on blind.
      m.target = -1
    }
    if (gone) {
      if (!hit) w.events.push({ type: 'missileMiss', a: m.target, b: m.from, kind: m.kind, pos: copyTo(v3(), m.pos) })
      ms[i] = ms[ms.length - 1]!
      ms.pop()
    }
  }
  // Decoys out of life go after the missiles have looked at them (indices stay put until here).
  for (let i = w.decoys.length - 1; i >= 0; i--) {
    if (w.decoys[i]!.life > 0) continue
    // A missile chasing a decoy that goes flies blind.
    const last = w.decoys.length - 1
    for (const m of ms) {
      if (m.target === DECOY + i) m.target = -1
      else if (m.target === DECOY + last) m.target = DECOY + i
    }
    w.decoys[i] = w.decoys[last]!
    w.decoys.pop()
  }
}
