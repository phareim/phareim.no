import type { GameEvent, Platform, World } from '../types'

// ---- tuning shared by the engine modules ----
export const GRAVITY = 2100 // px/s², pulls +y
export const JUMP_VELOCITY = 840 // running takeoff; height ~168, range ~200
export const HOP_VELOCITY = 600 // standing takeoff; height ~86
export const HOP_BELOW_VX = 120
export const MAX_FALL = 950
export const RUN_SPEED = 250
export const RUN_ACCEL = 2000
export const AIR_ACCEL = 1400
export const GROUND_BRAKE = 2600
export const AIR_BRAKE = 800
export const COYOTE_TIME = 0.12
export const JUMP_BUFFER = 0.15
export const JUMP_CUT = -280
export const HALF_W = 11
export const BODY_H = 52
export const CROUCH_H = 32
export const HARD_LANDING_VY = 900
export const LAND_TIME = 0.25
export const MANTLE_TIME = 0.34
export const KICK_TIME = 0.38
/** Action held shorter than this is a shot; up to BEAM_HOLD a shield; past it a beam. */
export const TAP_HOLD = 0.22
export const BEAM_HOLD = 0.9
export const SHOT_SPEED = 900
export const BEAM_SPEED = 1300
export const BOLT_SPEED = 540
export const DEATH_TIME = 0.9
export const FIXED_STEP = 1 / 120
export const MAX_FRAME_DT = 0.1

export const GUARD_H = 66
export const GUARD_CROUCH_H = 40
export const GUARD_HALF_W = 12

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(v + step, target)
  if (v > target) return Math.max(v - step, target)
  return v
}

export function overlaps(l: number, r: number, t: number, b: number, x: number, y: number, w: number, h: number): boolean {
  return l < x + w && r > x && t < y + h && b > y
}

export function emit(world: World, e: GameEvent): void {
  world.events.push(e)
}

export function hasFlag(world: World, f: string): boolean {
  return world.flags.includes(f)
}

export function setFlag(world: World, f: string): void {
  if (!world.flags.includes(f)) world.flags.push(f)
}

export function bodyHeight(world: World): number {
  return world.player.crouching ? CROUCH_H : BODY_H
}

/** Is any solid platform in this box? */
export function solidAt(world: World, l: number, r: number, t: number, b: number, skip?: Platform): boolean {
  for (const pl of world.platforms) {
    if (pl === skip) continue
    if (overlaps(l, r, t, b, pl.x, pl.y, pl.w, pl.h)) return true
  }
  return false
}

/** The top face under a point, searching down from y; Infinity if none. */
export function floorBelow(world: World, x: number, y: number): number {
  let best = Infinity
  for (const pl of world.platforms) {
    if (x < pl.x || x > pl.x + pl.w) continue
    if (pl.y >= y - 0.5 && pl.y < best) best = pl.y
  }
  return best
}
