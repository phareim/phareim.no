/**
 * Space Voyagers II: guns, turrets and the bolts they fire. A bolt carries
 * its ship's velocity and flies straight; it is tested against every ship of
 * the other side along the whole of its step (a bolt covers more than a
 * fighter's length in a tick). Big ships are hit as ellipsoids, small ones as
 * spheres. DESIGN.md, "Guns".
 */
import { GUN, SHIPS, TURRET } from './balance.ts'
import {
  addTo, angleBetween, clamp, copyTo, dot, forwardTo, leadTo, maddTo, normTo, rightTo, rotateTo, scaleTo, subTo,
  unrotateTo, v3,
} from './math.ts'
import type { V3 } from './math.ts'
import { rand } from './rng.ts'
import { hurt, live, shipAt } from './ships.ts'
import type { Seat, Ship, Shot, ShotKind, Turret, World } from './types.ts'

/** Half sizes of the big ships, for the ellipsoid hit test (ship frame: x across, y up, z along). */
export const HULLS: Partial<Record<string, [number, number, number]>> = {
  deepdish: [170, 45, 190],
  buffet: [70, 60, 230],
  outlet: [30, 25, 75],
  hauler: [18, 16, 45],
}

const FWD = v3()
const RIGHT = v3()
const DIR = v3()
const AIM = v3()
const MUZ = v3()

export function spawnShot(w: World, kind: ShotKind, s: Ship, seat: Seat | '', from: V3, dir: V3, speed: number, life: number, dmg: number): Shot {
  const shot: Shot = {
    kind, side: s.side, from: s.id, seat,
    pos: copyTo(v3(), from), prev: copyTo(v3(), from),
    vel: maddTo(v3(), scaleTo(v3(), s.vel, GUN.inherit), dir, speed),
    dmg, life,
  }
  w.shots.push(shot)
  return shot
}

/**
 * Fire the forward guns if they are ready. `assist`: a direction (unit) the
 * bolts may bend towards when it is within `cone` of the nose (the lead pip
 * of the target), or null.
 */
export function fireGuns(w: World, s: Ship, seat: Seat | '', assist: V3 | null, cone: number): boolean {
  const k = SHIPS[s.kind]
  if (s.gunCool > 0 || k.gunRate <= 0) return false
  if (s.energy < k.gunCost) return false
  s.energy -= k.gunCost
  s.gunCool = 1 / k.gunRate
  forwardTo(FWD, s.q)
  copyTo(DIR, FWD)
  if (assist && angleBetween(FWD, assist) < cone) copyTo(DIR, assist)
  rightTo(RIGHT, s.q)
  maddTo(MUZ, s.pos, RIGHT, k.gunSpread * s.gunSide)
  maddTo(MUZ, MUZ, FWD, s.r * 0.6)
  s.gunSide = -s.gunSide
  spawnShot(w, 'tube', s, seat, MUZ, DIR, GUN.speed, GUN.life, k.gunDmg)
  w.events.push({ type: 'shot', a: s.id, seat: seat || undefined, kind: 'tube' })
  return true
}

/** Where a turret sits and points in the world now. */
export function turretWorld(s: Ship, t: Turret, at: V3, aim: V3): void {
  rotateTo(at, s.q, t.at)
  addTo(at, at, s.pos)
  rotateTo(aim, s.q, t.aim)
}

const TAT = v3()
const TAIM = v3()
const TDIR = v3()
const TCONE = v3()
const TO = v3()

/** Is ship `o` inside the cone a turret covers, and in range? */
export function inTurretArc(s: Ship, t: Turret, o: Ship, range: number): boolean {
  rotateTo(TAT, s.q, t.at)
  addTo(TAT, TAT, s.pos)
  subTo(TO, o.pos, TAT)
  const d = Math.sqrt(dot(TO, TO))
  if (d > range + o.r) return false
  rotateTo(TCONE, s.q, t.dir)
  scaleTo(TO, TO, 1 / (d || 1))
  return angleBetween(TCONE, TO) < t.cone
}

/**
 * Swing a turret towards a world direction at its slew rate, kept inside its
 * cone. Returns the angle still to go.
 */
export function slewTurret(s: Ship, t: Turret, worldDir: V3, dt: number): number {
  unrotateTo(TDIR, s.q, worldDir)
  // Keep the wanted direction inside the cone.
  const off = angleBetween(t.dir, TDIR)
  if (off > t.cone) {
    // Pull it back to the cone's edge: mix the cone's axis with the wanted direction.
    const k = t.cone / off
    TDIR.x = t.dir.x + (TDIR.x - t.dir.x) * k
    TDIR.y = t.dir.y + (TDIR.y - t.dir.y) * k
    TDIR.z = t.dir.z + (TDIR.z - t.dir.z) * k
    normTo(TDIR, TDIR)
  }
  const ang = angleBetween(t.aim, TDIR)
  const max = TURRET.slew * dt
  if (ang <= max || ang < 1e-6) copyTo(t.aim, TDIR)
  else {
    const k = max / ang
    t.aim.x += (TDIR.x - t.aim.x) * k
    t.aim.y += (TDIR.y - t.aim.y) * k
    t.aim.z += (TDIR.z - t.aim.z) * k
    normTo(t.aim, t.aim)
  }
  return Math.max(0, ang - max)
}

/** Fire one turret along its aim, with `spread` radians of scatter. */
export function fireTurret(w: World, s: Ship, t: Turret, seat: Seat | '', spread: number, dmg = TURRET.dmg, twin = false, rate = TURRET.rate): boolean {
  if (t.cool > 0 || t.hp <= 0) return false
  t.cool = 1 / rate
  turretWorld(s, t, TAT, TAIM)
  if (spread > 0) {
    TAIM.x += (rand(w.rng) - 0.5) * 2 * spread
    TAIM.y += (rand(w.rng) - 0.5) * 2 * spread
    TAIM.z += (rand(w.rng) - 0.5) * 2 * spread
    normTo(TAIM, TAIM)
  }
  if (twin) {
    // Two barrels side by side, fired together (the Calzone's bubble).
    rightTo(MUZ, s.q)
    TAT.x -= MUZ.x * 0.6; TAT.y -= MUZ.y * 0.6; TAT.z -= MUZ.z * 0.6
    spawnShot(w, 'turret', s, seat, TAT, TAIM, GUN.turretSpeed, GUN.turretLife, dmg)
    TAT.x += MUZ.x * 1.2; TAT.y += MUZ.y * 1.2; TAT.z += MUZ.z * 1.2
  }
  spawnShot(w, 'turret', s, seat, TAT, TAIM, GUN.turretSpeed, GUN.turretLife, dmg)
  w.events.push({ type: 'shot', a: s.id, seat: seat || undefined, kind: 'turret' })
  return true
}

const LEAD = v3()

/** The direction (unit, world) a shot from `from` must take to meet `o`; false when there is none. */
export function leadDir(out: V3, from: V3, shooter: Ship, o: Ship, speed: number): boolean {
  const t = leadTo(LEAD, from, scaleTo(AIM, shooter.vel, GUN.inherit), o.pos, o.vel, speed)
  subTo(out, LEAD, from)
  normTo(out, out)
  return t > 0
}

/**
 * Turrets that run themselves: every turret of every ship except the one
 * the Calzone's back seat works (`skip`). They pick the nearest enemy in
 * their arc, swing to its lead and fire short bursts.
 */
export function stepAutoTurrets(w: World, dt: number, skip: Turret | null): void {
  for (const s of w.ships) {
    if (!live(s) || s.turrets.length === 0) continue
    const k = SHIPS[s.kind]
    const capital = k.capital === true
    for (const t of s.turrets) {
      t.cool = Math.max(0, t.cool - dt)
      if (t === skip || t.hp <= 0) continue
      // Look for a target now and then (every 20 ticks), keep it otherwise.
      let o = shipAt(w, t.target)
      if (!live(o) || !inTurretArc(s, t, o, TURRET.range) || (w.tick + s.id) % 20 === 0) {
        o = null
        let best = Infinity
        for (const c of w.ships) {
          if (!live(c) || c.side === s.side || SHIPS[c.kind].capital) continue
          if (!inTurretArc(s, t, c, TURRET.range)) continue
          const d = (c.pos.x - s.pos.x) ** 2 + (c.pos.y - s.pos.y) ** 2 + (c.pos.z - s.pos.z) ** 2
          if (d < best) { best = d; o = c }
        }
        t.target = o ? o.id : -1
      }
      if (!o) continue
      turretWorld(s, t, TAT, TAIM)
      if (!leadDir(TDIR, TAT, s, o, GUN.turretSpeed)) continue
      const left = slewTurret(s, t, TDIR, dt)
      // Big ships' guns are flak-steady; a fighter's tail gun is shakier.
      if (left < 0.05) fireTurret(w, s, t, '', capital ? 0.03 : 0.045, k.tdmg ?? TURRET.dmg, false, k.trate ?? TURRET.rate)
    }
  }
}

const SEG = v3()
const TOC = v3()
const LA = v3()
const LB = v3()

/** Does the segment a→b pass within r of c? */
function segHitsSphere(a: V3, b: V3, c: V3, r: number): boolean {
  subTo(SEG, b, a)
  subTo(TOC, c, a)
  const l2 = dot(SEG, SEG)
  const t = l2 > 0 ? clamp(dot(TOC, SEG) / l2, 0, 1) : 0
  const dx = a.x + SEG.x * t - c.x, dy = a.y + SEG.y * t - c.y, dz = a.z + SEG.z * t - c.z
  return dx * dx + dy * dy + dz * dz <= r * r
}

/** Does the segment pass through ship `s`'s hull ellipsoid? */
function segHitsHull(a: V3, b: V3, s: Ship, h: [number, number, number]): boolean {
  subTo(LA, a, s.pos); unrotateTo(LA, s.q, LA)
  subTo(LB, b, s.pos); unrotateTo(LB, s.q, LB)
  LA.x /= h[0]; LA.y /= h[1]; LA.z /= h[2]
  LB.x /= h[0]; LB.y /= h[1]; LB.z /= h[2]
  return segHitsSphere(LA, LB, ZERO, 1)
}
const ZERO = v3()

const FROM = v3()

/** Move every bolt one step and let it hit what it meets. */
export function stepShots(w: World, dt: number): void {
  const shots = w.shots
  for (let i = shots.length - 1; i >= 0; i--) {
    const b = shots[i]!
    copyTo(b.prev, b.pos)
    maddTo(b.pos, b.pos, b.vel, dt)
    b.life -= dt
    let hit: Ship | null = null
    for (const s of w.ships) {
      if (!live(s) || s.side === b.side) continue
      const hull = HULLS[s.kind]
      // Cheap reject: far from the segment's middle.
      const mx = (b.pos.x + b.prev.x) / 2 - s.pos.x, my = (b.pos.y + b.prev.y) / 2 - s.pos.y, mz = (b.pos.z + b.prev.z) / 2 - s.pos.z
      const reach = (hull ? Math.max(hull[0], hull[1], hull[2]) : s.r) + 40
      if (mx * mx + my * my + mz * mz > reach * reach) continue
      if (hull ? segHitsHull(b.prev, b.pos, s, hull) : segHitsSphere(b.prev, b.pos, s.pos, s.r)) { hit = s; break }
    }
    if (hit) {
      // The side it lands on is the side it came from: a point back along its path.
      normTo(FROM, b.vel)
      maddTo(FROM, hit.pos, FROM, -200)
      const res = hurt(w, hit, b.dmg, FROM, b.from, b.pos)
      // The kill is the last event `hurt` made: say which seat scored it.
      if (res.killed && b.seat) w.events[w.events.length - 1]!.seat = b.seat
      w.events.push({ type: 'hit', a: hit.id, b: b.from, seat: b.seat || undefined, pos: copyTo(v3(), b.pos) })
    }
    if (hit || b.life <= 0) {
      shots[i] = shots[shots.length - 1]!
      shots.pop()
    }
  }
}

/** The gun capacitor refills, gun and turret cooldowns run down. */
export function stepGunCharge(w: World, dt: number): void {
  for (const s of w.ships) {
    if (!live(s)) continue
    const k = SHIPS[s.kind]
    s.gunCool = Math.max(0, s.gunCool - dt)
    s.energy = Math.min(1, s.energy + k.gunRecharge * dt)
  }
}
