/**
 * Space Voyagers II: the Calzone's two seats (DESIGN.md, "One ship, two
 * seats"). The front seat flies and fires the nose guns and missiles; the
 * back seat works the turret, which covers everything behind, and the decoys.
 * The player sits in one; the other pilot does the other's job:
 *
 *  - player in front: the partner in the back shoots what comes up behind,
 *    in bursts, with their own eye (Nova is the better shot, Rex the keener),
 *    and drops a decoy when a missile comes in;
 *  - player in the back: the partner flies (the `turret` mode in `ai.ts`):
 *    away from what chases, weaving, so it stays in the turret's arc. The
 *    player swings the turret and fires; the decoys are still the partner's.
 *
 * Changing seats (Tab, or the partner's face) takes a moment: both climb over.
 */
import { GUN, PARTNER, SHIPS, TURRET } from './balance.ts'
import { setMode } from './ai.ts'
import { fireTurret, inTurretArc, leadDir, slewTurret, turretWorld } from './guns.ts'
import { angleBetween, clamp, copyTo, dist, normTo, rotateTo, unrotateTo, v3 } from './math.ts'
import { dropDecoy } from './missiles.ts'
import { rand } from './rng.ts'
import { live, makeAi, shipAt } from './ships.ts'
import type { Input, PilotId, Ship, Turret, World } from './types.ts'

/** Ticks the seats take to change: nobody flies or shoots meanwhile, the ship flies straight. */
export const SWAP_TICKS = 50

export interface Crew {
  /** Ticks left of a seat change under way. */
  swapping: number
  /** The back seat's own target, burst and rest timers (ticks), and its aim error now. */
  target: number
  burst: number
  rest: number
  look: number
  err: { x: number; y: number; z: number }
  /** Decoys asked for: tick to drop at. */
  decoyAt: number[]
  /** For the radio: the last enemy called out behind. */
  calledBehind: number
}

export function makeCrew(): Crew {
  return { swapping: 0, target: -1, burst: 0, rest: 0, look: 0, err: v3(), decoyAt: [], calledBehind: -1 }
}

export function calzoneTurret(s: Ship): Turret | null {
  return s.turrets[0] ?? null
}

/** The pilot the player is: in the front seat or the back. */
export function playerPilot(w: World): PilotId {
  return w.seat === 'front' ? w.front : w.back
}
/** The other one. */
export function partnerPilot(w: World): PilotId {
  return w.seat === 'front' ? w.back : w.front
}

/** Begin a change of seats. */
export function swapSeats(w: World, crew: Crew, s: Ship): void {
  if (crew.swapping > 0 || !live(s)) return
  crew.swapping = SWAP_TICKS
  const was = w.seat
  w.seat = was === 'front' ? 'back' : 'front'
  // The pilots climb over: whoever the player is goes to the other seat.
  const f = w.front
  w.front = w.back
  w.back = f
  if (w.seat === 'back') {
    // The partner takes the stick.
    if (!s.ai) s.ai = makeAi('turret', 0.7, 0.8)
    setMode(s.ai, 'turret')
  } else {
    s.ai = null
  }
  w.events.push({ type: 'swap', a: s.id, seat: w.seat })
}

const AT = v3()
const AIM = v3()
const WANT = v3()

/** Pick the back seat's target: what is in the arc, chasing us first, nearest. */
function pickRear(w: World, s: Ship, t: Turret): number {
  let best = -1, bestScore = Infinity
  for (const o of w.ships) {
    if (!live(o) || o.side === s.side || SHIPS[o.kind].capital) continue
    if (!inTurretArc(s, t, o, TURRET.range)) continue
    // Whatever is on our tail first: it is chasing us and it is near.
    const d = dist(o.pos, s.pos) - (o.target === s.id ? 700 : 0)
    if (d < bestScore) { bestScore = d; best = o.id }
  }
  return best
}

/**
 * The back seat when it is not the player: aim, fire in bursts, and call
 * out what comes up behind.
 */
export function partnerTurret(w: World, crew: Crew, s: Ship, who: PilotId, dt: number): void {
  const t = calzoneTurret(s)
  if (!t) return
  const p = PARTNER[who]
  crew.look--
  let o = shipAt(w, crew.target)
  if (crew.look <= 0 || !live(o) || !inTurretArc(s, t, o, TURRET.range)) {
    crew.look = Math.round(p.react * 60)
    crew.target = pickRear(w, s, t)
    o = shipAt(w, crew.target)
    // A fresh aim error each look.
    crew.err.x = (rand(w.rng) - 0.5) * 2 * p.aimError
    crew.err.y = (rand(w.rng) - 0.5) * 2 * p.aimError
    crew.err.z = (rand(w.rng) - 0.5) * 2 * p.aimError
    if (live(o) && o.id !== crew.calledBehind && dist(o.pos, s.pos) < 1100) {
      crew.calledBehind = o.id
      w.events.push({ type: 'cue', cue: 'behind', a: o.id })
    }
  }
  if (!live(o)) return
  turretWorld(s, t, AT, AIM)
  if (!leadDir(WANT, AT, s, o, GUN.turretSpeed)) return
  WANT.x += crew.err.x; WANT.y += crew.err.y; WANT.z += crew.err.z
  normTo(WANT, WANT)
  const left = slewTurret(s, t, WANT, dt)
  // Bursts: fire for `burst` seconds, rest for `rest`.
  if (crew.burst > 0) {
    crew.burst--
    if (left < 0.06 && dist(o.pos, s.pos) < 1100) fireTurret(w, s, t, 'back', 0.01, TURRET.dmg, true)
    if (crew.burst <= 0) crew.rest = Math.round(p.rest * 60)
  } else if (crew.rest > 0) {
    crew.rest--
  } else if (left < 0.06) {
    crew.burst = Math.round(p.burst * 60)
  }
}

/**
 * The back seat when it is the player: the stick swings the turret, fire
 * fires it, and the bolts bend to the lead of the turret's target inside the
 * aim help's cone.
 */
export function playerTurret(w: World, crew: Crew, s: Ship, input: Input, dt: number): void {
  const t = calzoneTurret(s)
  if (!t) return
  // The turret's target: the one the player picked, else the nearest in the arc.
  let o = shipAt(w, crew.target)
  if (input.nextTarget || !live(o) || !inTurretArc(s, t, o, TURRET.range * 1.3)) {
    crew.target = input.nextTarget ? nextInArc(w, s, t, crew.target) : pickRear(w, s, t)
    o = shipAt(w, crew.target)
  }
  // Swing: the stick moves the aim in the turret's own frame, like a crosshair.
  turretWorld(s, t, AT, AIM)
  const rate = TURRET.slew * 0.55 * dt
  // In the gunner's view, up on the stick lifts the aim, left moves it left.
  // The gunner faces the tail, so "left" for the gunner is the ship's right.
  unrotateTo(WANT, s.q, AIM)
  const yaw = Math.atan2(WANT.x, WANT.z) + clamp(input.yaw, -1, 1) * rate
  const pitch = Math.asin(clamp(WANT.y, -1, 1)) + clamp(input.pitch, -1, 1) * rate
  const cp = Math.cos(clamp(pitch, -1.45, 1.45))
  WANT.x = Math.sin(yaw) * cp
  WANT.y = Math.sin(clamp(pitch, -1.45, 1.45))
  WANT.z = Math.cos(yaw) * cp
  rotateTo(WANT, s.q, WANT)
  slewTurret(s, t, WANT, 1)
  if (input.fire) {
    // Aim help: bend to the lead when it is close to where the turret points.
    turretWorld(s, t, AT, AIM)
    const cone = input.touch ? GUN.assistTouch * 1.2 : GUN.assistKeys * 1.2
    if (live(o) && leadDir(WANT, AT, s, o, GUN.turretSpeed) && angleBetween(AIM, WANT) < cone) {
      const keep = copyTo(v3(), t.aim)
      unrotateTo(t.aim, s.q, WANT)
      fireTurret(w, s, t, 'back', 0, TURRET.dmg, true)
      copyTo(t.aim, keep)
    } else {
      fireTurret(w, s, t, 'back', 0, TURRET.dmg, true)
    }
  }
}

function nextInArc(w: World, s: Ship, t: Turret, current: number): number {
  const list = w.ships.filter(o => live(o) && o.side !== s.side && !SHIPS[o.kind].capital && inTurretArc(s, t, o, TURRET.range * 1.3))
  if (list.length === 0) return -1
  list.sort((a, b) => a.id - b.id)
  const i = list.findIndex(o => o.id === current)
  return list[(i + 1) % list.length]!.id
}

/** Decoys: the partner drops one a moment after a missile comes in. */
export function stepDecoys(w: World, crew: Crew, s: Ship): void {
  const who = partnerPilot(w)
  for (const e of w.events) {
    if (e.type === 'missileIn' && e.a === s.id && s.decoys > 0) {
      crew.decoyAt.push(w.tick + Math.round(PARTNER[who].decoyDelay * 60))
    }
  }
  for (let i = crew.decoyAt.length - 1; i >= 0; i--) {
    if (crew.decoyAt[i]! <= w.tick) {
      crew.decoyAt.splice(i, 1)
      if (dropDecoy(w, s)) w.events.push({ type: 'cue', cue: 'decoy', a: s.id })
    }
  }
}

/** Where the turret aims, as a world direction (for the gunner's camera). */
export function turretAim(s: Ship, out = v3()): ReturnType<typeof v3> {
  const t = calzoneTurret(s)
  if (!t) return out
  return rotateTo(out, s.q, t.aim)
}
