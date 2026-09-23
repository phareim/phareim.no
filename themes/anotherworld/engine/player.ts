import type { Input, Platform, Water, World } from '../types'
import {
  AIR_ACCEL, AIR_BRAKE, BEAM_HOLD, BEAM_SPEED, BODY_H, COYOTE_TIME, CROUCH_H, GRAVITY, GROUND_BRAKE,
  HALF_W, HARD_LANDING_VY, HOP_BELOW_VX, HOP_VELOCITY, JUMP_BUFFER, JUMP_CUT, JUMP_VELOCITY,
  KICK_TIME, LAND_TIME, MANTLE_TIME, MAX_FALL, RUN_ACCEL, RUN_SPEED, SHOT_SPEED, TAP_HOLD,
  approach, bodyHeight, emit, solidAt,
} from './util'

// The figure: run, hop or long jump, crouch, mantle onto ledges, swim, kick,
// and — once it has the gun — Another World's one-button gun: a tap fires,
// a hold raises a shield, a longer hold charges a beam that breaks shields
// and blast doors. Movement stops while the gun is in use, as in the original.

/** Edge detection and forgiveness timers; kept out of World so a world stays a plain snapshot. */
export interface Controls {
  coyote: number
  buffer: number
  prevUp: boolean
  prevAction: boolean
  upEdge: boolean
  actionEdge: boolean
}

const controlsByWorld = new WeakMap<World, Controls>()

export function controlsFor(world: World): Controls {
  let c = controlsByWorld.get(world)
  if (!c) {
    c = { coyote: 0, buffer: 0, prevUp: false, prevAction: false, upEdge: false, actionEdge: false }
    controlsByWorld.set(world, c)
  }
  return c
}

/** Once per frame, before the substeps: turn held buttons into edges. */
export function latchInput(world: World, input: Input): void {
  const c = controlsFor(world)
  c.upEdge = input.up && !c.prevUp
  c.actionEdge = input.action && !c.prevAction
  if (c.upEdge) c.buffer = JUMP_BUFFER
  c.prevUp = input.up
  c.prevAction = input.action
}

export function resetControls(world: World): void {
  const c = controlsFor(world)
  c.coyote = 0
  c.buffer = 0
  c.upEdge = false
  c.actionEdge = false
}

const SWIM_SPEED = 130
const STROKE_VY = -300
/** Floating: the feet sit this far under the surface, head and shoulders out. */
const FLOAT_DEPTH = 36

export function waterAt(world: World, x: number, feetY: number): Water | null {
  for (const w of world.water) {
    if (x >= w.x && x <= w.x + w.w && feetY > w.y + 8) return w
  }
  return null
}

function moveX(world: World, h: number): void {
  const p = world.player
  if (p.vx === 0) return
  let nx = p.x + p.vx * h
  const top = p.y - bodyHeight(world)
  const bottom = p.y
  for (const pl of world.platforms) {
    if (bottom <= pl.y + 4) continue // at/above the top face: slide, don't slam
    if (top >= pl.y + pl.h) continue
    if (p.vx > 0 && p.x + HALF_W <= pl.x + 0.01 && nx + HALF_W > pl.x) {
      nx = pl.x - HALF_W
      p.vx = 0
    } else if (p.vx < 0 && p.x - HALF_W >= pl.x + pl.w - 0.01 && nx - HALF_W < pl.x + pl.w) {
      nx = pl.x + pl.w + HALF_W
      p.vx = 0
    }
  }
  p.x = Math.max(HALF_W, Math.min(world.width + 40, nx))
  if (p.x === HALF_W && p.vx < 0) p.vx = 0
}

/** Returns the platform landed on this substep, if any. */
function moveY(world: World, h: number): Platform | null {
  const p = world.player
  p.grounded = false
  const ny = p.y + p.vy * h
  const left = p.x - HALF_W
  const right = p.x + HALF_W
  if (p.vy >= 0) {
    let land: Platform | null = null
    for (const pl of world.platforms) {
      if (right <= pl.x || left >= pl.x + pl.w) continue
      if (p.y <= pl.y + 0.5 && ny >= pl.y && (!land || pl.y < land.y)) land = pl
    }
    if (land) {
      p.y = land.y
      p.grounded = true
      return land
    }
  } else {
    const bh = bodyHeight(world)
    const prevHead = p.y - bh
    const head = ny - bh
    for (const pl of world.platforms) {
      if (right <= pl.x || left >= pl.x + pl.w) continue
      if (prevHead >= pl.y + pl.h - 0.5 && head <= pl.y + pl.h) {
        p.y = pl.y + pl.h + bh
        p.vy = 0
        return null
      }
    }
  }
  p.y = ny
  return null
}

/**
 * A ledge to pull up onto: the figure is pressing into a face whose top is
 * between its knees and a little above its head, and there is room on top.
 */
function findMantle(world: World, dir: number, swimming: boolean): Platform | null {
  const p = world.player
  if (dir === 0) return null
  const reachTop = p.y - BODY_H - (swimming ? 30 : 18)
  const reachLow = p.y - (swimming ? 4 : 14)
  for (const pl of world.platforms) {
    if (pl.kind === 'lift' || pl.kind === 'door') continue
    if (pl.y < reachTop || pl.y > reachLow) continue
    const face = dir > 0 ? pl.x : pl.x + pl.w
    const edge = p.x + dir * HALF_W
    if (Math.abs(edge - face) > 7) continue
    if (dir > 0 ? pl.x + pl.w < p.x + HALF_W * 3 : pl.x > p.x - HALF_W * 3) continue
    const nx = dir > 0 ? pl.x + HALF_W + 4 : pl.x + pl.w - HALF_W - 4
    if (solidAt(world, nx - HALF_W + 1, nx + HALF_W - 1, pl.y - BODY_H, pl.y - 0.5)) continue
    return pl
  }
  return null
}

function fireGun(world: World): void {
  const p = world.player
  const f = p.facing
  const held = p.holdT
  p.holdT = 0
  // Crouched, the gun fires low enough to take a leech.
  const chestY = p.y - (p.crouching ? 12 : 34)
  if (held < TAP_HOLD) {
    if (p.gunCool > 0) return
    world.shots.push({ owner: 'player', kind: 'shot', x: p.x + f * 18, y: chestY, vx: f * SHOT_SPEED, alive: true, t: 0 })
    p.gunCool = 0.2
    p.shotT = 0.16
    emit(world, { type: 'shot' })
  } else if (held < BEAM_HOLD) {
    world.shields = world.shields.filter(s => s.owner !== 'player')
    world.shields.push({ owner: 'player', ownerId: 0, x: p.x + f * 24, y: p.y, h: 58, hp: 3, t: 0, life: 3.2 })
    p.shotT = 0.2
    emit(world, { type: 'shield', owner: 'player' })
  } else {
    world.shots.push({ owner: 'player', kind: 'beam', x: p.x + f * 18, y: chestY, vx: f * BEAM_SPEED, alive: true, t: 0 })
    p.gunCool = 0.35
    p.shotT = 0.32
    emit(world, { type: 'beam' })
  }
}

function kickHits(world: World): void {
  const p = world.player
  const f = p.facing
  for (const a of world.actors) {
    if (a.kind !== 'leech' || a.state === 'dead' || a.state === 'hang') continue
    const d = (a.x - p.x) * f
    if (d > 2 && d < 46 && Math.abs(a.y - p.y) < 18) {
      a.state = 'dead'
      a.t = 0
      emit(world, { type: 'leechDie' })
      emit(world, { type: 'kickHit' })
    }
  }
}

export function stepPlayer(world: World, input: Input, h: number): void {
  const p = world.player
  const c = controlsFor(world)

  if (p.mantle) {
    const m = p.mantle
    m.t += h
    const u = Math.min(1, m.t / MANTLE_TIME)
    // Up first, then over: the pull and the knee on the edge.
    const rise = Math.min(1, u / 0.6)
    const over = Math.max(0, (u - 0.45) / 0.55)
    p.y = m.y0 + (m.y1 - m.y0) * rise
    p.x = m.x0 + (m.x1 - m.x0) * over
    p.vx = 0
    p.vy = 0
    if (u >= 1) {
      p.mantle = null
      p.grounded = true
      p.swimming = false
      p.x = m.x1
      p.y = m.y1
    }
    return
  }

  c.coyote -= h
  c.buffer -= h
  if (p.landT > 0) p.landT -= h
  if (p.kickT > 0) p.kickT -= h
  if (p.shotT > 0) p.shotT -= h
  if (p.gunCool > 0) p.gunCool -= h

  const water = waterAt(world, p.x, p.y)
  if (water && !p.swimming) {
    p.swimming = true
    p.crouching = false
    p.holdT = 0
    if (p.vy > 200) emit(world, { type: 'splash' })
  } else if (!water && p.swimming) {
    p.swimming = false
  }

  const dirIn = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const locked = p.landT > 0
  const aiming = p.hasGun && p.holdT > TAP_HOLD * 0.5
  const planted = p.grounded && (p.crouching || p.kickT > 0 || aiming || p.shotT > 0)

  // Crouch: down on the ground. Standing up needs headroom.
  const wasCrouching = p.crouching
  if (p.grounded && !p.swimming && input.down && !locked) {
    if (!p.crouching) p.crouching = true
  } else if (p.crouching && (!input.down || !p.grounded)) {
    const room = !solidAt(world, p.x - HALF_W + 1, p.x + HALF_W - 1, p.y - BODY_H, p.y - CROUCH_H - 0.5)
    if (room) p.crouching = false
  }

  // Facing turns even while planted; a kick finishes where it started.
  if (dirIn !== 0 && !locked && p.kickT <= 0) p.facing = dirIn

  if (p.swimming) {
    p.vx = approach(p.vx, dirIn * SWIM_SPEED, 700 * h)
  } else if (locked || planted) {
    p.vx = approach(p.vx, 0, GROUND_BRAKE * h)
  } else if (dirIn !== 0) {
    p.vx = approach(p.vx, dirIn * RUN_SPEED, (p.grounded ? RUN_ACCEL : AIR_ACCEL) * h)
  } else {
    p.vx = approach(p.vx, 0, (p.grounded ? GROUND_BRAKE : AIR_BRAKE) * h)
  }

  // Jump (or a stroke in water).
  if (p.grounded) c.coyote = COYOTE_TIME
  if (p.swimming) {
    if (c.buffer > 0) {
      c.buffer = 0
      p.vy = STROKE_VY
      emit(world, { type: 'stroke' })
    }
  } else if (c.buffer > 0 && (p.grounded || c.coyote > 0) && !locked && p.kickT <= 0 && p.holdT <= 0) {
    if (p.crouching || wasCrouching) {
      c.buffer = 0 // up from a crouch just stands
    } else {
      p.hop = Math.abs(p.vx) < HOP_BELOW_VX
      p.vy = p.hop ? -HOP_VELOCITY : -JUMP_VELOCITY
      p.grounded = false
      c.coyote = 0
      c.buffer = 0
      emit(world, { type: 'jump' })
    }
  }

  // Action: a kick, or the gun.
  if (p.grounded && !p.swimming && !locked) {
    if (!p.hasGun) {
      if (c.actionEdge && p.kickT <= 0) {
        p.kickT = KICK_TIME
        emit(world, { type: 'kick' })
      }
    } else if (input.action) {
      const before = p.holdT
      p.holdT += h
      if (before < TAP_HOLD && p.holdT >= TAP_HOLD) emit(world, { type: 'charge' })
      if (before < BEAM_HOLD && p.holdT >= BEAM_HOLD) emit(world, { type: 'chargeFull' })
    } else if (p.holdT > 0) {
      fireGun(world)
    }
  } else if (!input.action) {
    p.holdT = 0
  }
  c.actionEdge = false
  // The kick lands a third of the way in.
  if (p.kickT > 0 && p.kickT <= KICK_TIME * 0.7 && p.kickT + h > KICK_TIME * 0.7) kickHits(world)

  // Vertical.
  const wasAirborne = !p.grounded
  const fallVy = p.vy
  if (p.swimming && water) {
    // Held up: rise. At the surface: float. Deeper down: sink slowly.
    const atSurface = p.y < water.y + FLOAT_DEPTH + 24
    const target = input.up ? -90 : input.down ? 110 : atSurface ? 0 : 45
    p.vy = approach(p.vy, target, (p.vy < target ? 520 : 900) * h)
  } else {
    if (!input.up && p.vy < JUMP_CUT) p.vy = JUMP_CUT
    p.vy = Math.min(p.vy + GRAVITY * h, MAX_FALL)
  }

  // Lifts carry whoever stands on them; they move in the actors step, and
  // the figure is re-seated there. Here it only has to not fall through.
  moveX(world, h)
  const landed = moveY(world, h)

  if (p.swimming && water) {
    const floatY = water.y + FLOAT_DEPTH
    if (p.y < floatY && p.vy < 0) {
      p.y = floatY
      p.vy = 0
    }
  }

  if (landed && wasAirborne) {
    p.hop = false
    const hard = fallVy >= HARD_LANDING_VY
    if (hard) p.landT = LAND_TIME
    p.vy = 0
    emit(world, { type: 'land', hard })
  } else if (landed) {
    p.vy = 0
  }

  // Mantle: pressing into a ledge top that is within reach.
  if (!p.grounded && (p.swimming || p.vy > -260)) {
    const pl = findMantle(world, dirIn, p.swimming)
    if (pl) {
      const x1 = dirIn > 0 ? pl.x + HALF_W + 4 : pl.x + pl.w - HALF_W - 4
      p.mantle = { t: 0, x0: p.x, y0: p.y, x1, y1: pl.y }
      p.crouching = false
      p.holdT = 0
      emit(world, { type: 'climb' })
    }
  }

  // Footsteps on the run.
  if (p.grounded && !p.crouching) {
    const before = Math.floor(p.stride / 52)
    p.stride += Math.abs(p.vx) * h
    if (Math.floor(p.stride / 52) !== before && Math.abs(p.vx) > 60) emit(world, { type: 'step' })
  }
}
