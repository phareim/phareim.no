/**
 * Space Voyagers II: how a ship flies. No inertia past a little weight in
 * the turn and the speed: the ship goes where its nose points, at the speed
 * it is asked for, as in Wing Commander (DESIGN.md, "Flying"). Slower turns
 * tighter; the afterburner turns wide.
 */
import { SHIPS, TURN_AT_SPEED, TURN_LAG } from './balance.ts'
import { approach, clamp, forwardTo, maddTo, qTurnBody, scaleTo, unrotateTo, v3 } from './math.ts'
import type { V3 } from './math.ts'
import type { Controls, Ship } from './types.ts'

/** How much of a ship's turn rate it has at its present speed. */
export function turnScale(s: Ship): number {
  const k = SHIPS[s.kind]
  const v = s.speed
  if (v <= k.cruise) {
    const t = k.cruise > k.min ? clamp((v - k.min) / (k.cruise - k.min), 0, 1) : 1
    return TURN_AT_SPEED.min + (TURN_AT_SPEED.cruise - TURN_AT_SPEED.min) * t
  }
  if (v <= k.max) {
    const t = k.max > k.cruise ? (v - k.cruise) / (k.max - k.cruise) : 1
    return TURN_AT_SPEED.cruise + (TURN_AT_SPEED.max - TURN_AT_SPEED.cruise) * t
  }
  const t = k.burn > k.max ? clamp((v - k.max) / (k.burn - k.max), 0, 1) : 1
  return TURN_AT_SPEED.max + (TURN_AT_SPEED.burn - TURN_AT_SPEED.max) * t
}

/** One tick of flight for one ship under its controls. */
export function fly(s: Ship, c: Controls, dt: number): void {
  const k = SHIPS[s.kind]
  if (k.fixed) return
  if (k.capital && !s.ai) {
    // Big ships cruise straight; their turrets do the fighting.
    s.speed = approach(s.speed, s.cruise, k.accel * dt)
    forwardTo(s.vel, s.q)
    scaleTo(s.vel, s.vel, s.speed)
    maddTo(s.pos, s.pos, s.vel, dt)
    return
  }
  // Speed: burn wins over brake; fuel drains while burning and comes back when not.
  const wantsBurn = c.burn && s.fuel > 0.02
  s.burning = wantsBurn
  if (wantsBurn) s.fuel = Math.max(0, s.fuel - dt / k.fuel)
  else s.fuel = Math.min(1, s.fuel + dt / k.refuel)
  const want = wantsBurn ? k.burn : c.brake ? k.min : s.cruise
  // The afterburner kicks hard; slowing down is quick too (the retros).
  const accel = wantsBurn ? k.accel * 3 : s.speed > want ? k.accel * 1.6 : k.accel
  s.speed = approach(s.speed, want, accel * dt)

  // Turn: the rates chase the stick with a little lag.
  const m = turnScale(s)
  const blend = Math.min(1, dt / TURN_LAG)
  s.rate.x += (clamp(c.pitch, -1, 1) * k.pitch * m - s.rate.x) * blend
  s.rate.y += (clamp(c.yaw, -1, 1) * k.yaw * m - s.rate.y) * blend
  s.rate.z += (clamp(c.roll, -1, 1) * k.roll - s.rate.z) * blend
  qTurnBody(s.q, s.rate.x * dt, s.rate.y * dt, s.rate.z * dt)

  forwardTo(s.vel, s.q)
  scaleTo(s.vel, s.vel, s.speed)
  maddTo(s.pos, s.pos, s.vel, dt)
}

const B = v3()

/**
 * Controls that turn a ship's nose towards a world direction `dir` (unit).
 * Far off the nose it banks and pulls (roll the point overhead, then pitch up),
 * as a pilot does; near the nose it tracks with pitch and yaw. Rates already
 * turning are taken into account so it settles instead of swinging past.
 * `bank` 0..1: how much it rolls into a turn even when tracking (looks alive).
 */
export function steerTo(out: Controls, s: Ship, dir: V3, bank = 0.5): Controls {
  const k = SHIPS[s.kind]
  unrotateTo(B, s.q, dir)
  const ahead = -B.z
  const up = Math.atan2(B.y, ahead) // the point's angle above the nose
  const side = Math.atan2(-B.x, ahead) // its angle to the left of the nose
  const off = Math.acos(clamp(ahead / Math.max(1e-9, Math.sqrt(B.x * B.x + B.y * B.y + B.z * B.z)), -1, 1))
  const m = turnScale(s)
  // Rates the ship could have now; derivative terms in "seconds of turn".
  const dp = s.rate.x / (k.pitch * m || 1)
  const dy = s.rate.y / (k.yaw * m || 1)
  if (off > 0.45) {
    // Bank and pull: roll so the point is over the canopy, pull towards it.
    const rollErr = Math.atan2(B.x, B.y) // 0 when the point is overhead; + when it is to the right
    out.roll = clamp(-rollErr * 2.2 - s.rate.z / k.roll * 0.35, -1, 1)
    const lined = Math.abs(rollErr) < 1.0 ? 1 : 0.35
    out.pitch = clamp((B.y >= -0.2 * Math.abs(B.x) ? 1 : 0.4) * lined, -1, 1)
    out.yaw = clamp(side * 1.5 - dy * 0.3, -1, 1)
  } else {
    // Track: pitch and yaw straight at it, with damping.
    out.pitch = clamp(up * 5.5 - dp * 0.45, -1, 1)
    out.yaw = clamp(side * 5.5 - dy * 0.45, -1, 1)
    // Lean into the turn a little.
    out.roll = clamp(-side * 3 * bank - s.rate.z / k.roll * 0.3, -1, 1) * (off > 0.05 ? 1 : 0.3)
  }
  return out
}

/** An all-zero set of controls. */
export function makeControls(): Controls {
  return { pitch: 0, yaw: 0, roll: 0, burn: false, brake: false, fire: false, missile: false }
}

export function clearControls(c: Controls): Controls {
  c.pitch = 0; c.yaw = 0; c.roll = 0
  c.burn = false; c.brake = false; c.fire = false; c.missile = false
  return c
}
