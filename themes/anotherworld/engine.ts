import type { Input, World } from './types'

// Another Shore — pure deterministic platformer physics + authored level.
// y points down, units are px, dt is seconds. Player x/y is feet centre,
// body 22 wide x 52 tall. No rendering, no Vue, no randomness here.

// ---- tuning ----
const GRAVITY = 2100 // px/s^2, pulls +y
const JUMP_VELOCITY = 840 // takeoff speed (-y); height ~168px, range ~200px
const MAX_FALL = 950
const RUN_SPEED = 250
const RUN_ACCEL = 2000
const AIR_ACCEL = 1400
const GROUND_BRAKE = 2600
const AIR_BRAKE = 800
const COYOTE_TIME = 0.12
const JUMP_BUFFER = 0.15
const JUMP_CUT = -280 // releasing jump while rising faster than this clips the rise
const HALF_W = 11
const BODY_H = 52
const GROUND_Y = 420
const KILL_Y = 620 // below the world: a fall
const FIXED_STEP = 1 / 120 // physics substep; keeps fast falls swept
const MAX_FRAME_DT = 0.1 // clamp: huge tabs/pauses never tunnel or explode
const BEACON_DX = 36
const BEACON_DY = 90
const SPAWN_X = 80

interface Timers {
  coyote: number
  buffer: number
  prevJump: boolean
}

// Jump buffering + coyote time live outside World so the public state stays
// a plain snapshot (and stays serialisable for the determinism test).
const timersByWorld = new WeakMap<World, Timers>()

function timersFor(world: World): Timers {
  let t = timersByWorld.get(world)
  if (!t) {
    t = { coyote: 0, buffer: 0, prevJump: false }
    timersByWorld.set(world, t)
  }
  return t
}

function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(v + step, target)
  if (v > target) return Math.max(v - step, target)
  return v
}

function buildLevel(world: World): void {
  // Ground tops sit at y=420 and run down past the 540 view to y=560.
  // Gaps are absences; blocks sit on top and are jumped over.
  const G = (x: number, w: number) => world.platforms.push({ x, y: GROUND_Y, w, h: 140 })
  const block = (x: number, top: number, w: number) =>
    world.platforms.push({ x, y: top, w, h: GROUND_Y - top })
  const spikes = (x: number, w: number) =>
    world.hazards.push({ x, y: GROUND_Y - 16, w, h: 16 })

  // Section 1 — shore: flat, one small gap, one low rock. Teaches run + jump.
  G(0, 620) // 0-620
  block(950, 388, 50) // low rock on the flat
  G(700, 450) // 700-1150
  // gap 1150-1210 (60)
  G(1210, 390) // 1210-1600
  world.beacons.push({ x: 1500, y: GROUND_Y, lit: false })

  // Section 2 — broken causeway: wider gaps, hazards on the flat.
  // gap 1600-1700 (100)
  G(1700, 350) // 1700-2050
  spikes(1900, 40)
  // gap 2050-2160 (110)
  G(2160, 340) // 2160-2500
  block(2300, 380, 60)
  // gap 2500-2610 (110)
  G(2610, 690) // 2610-3300
  spikes(2900, 60)
  world.beacons.push({ x: 3200, y: GROUND_Y, lit: false })

  // Section 3 — signal tower: taller rock, wide gaps, a raised ledge.
  // gap 3300-3410 (110)
  G(3410, 340) // 3410-3750
  block(3520, 384, 60) // lone rock with flat run-up on both sides
  // gap 3750-3860 (110)
  G(3860, 290) // 3860-4150
  spikes(4020, 50)
  // gap 4150-4240 (90) up onto the ledge, 36 higher
  world.platforms.push({ x: 4240, y: 384, w: 200, h: 176 }) // 4240-4440
  // gap 4440-4520 (80) stepping back down
  G(4520, 480) // 4520-5000
  world.beacons.push({ x: 4850, y: GROUND_Y, lit: false })
}

export function createWorld(): World {
  const world: World = {
    player: { x: SPAWN_X, y: GROUND_Y, vx: 0, vy: 0, grounded: true, facing: 1 },
    platforms: [],
    hazards: [],
    beacons: [],
    width: 5000,
    time: 0,
    deaths: 0,
    checkpoint: -1, // index into beacons; -1 = still at spawn
    won: false,
  }
  buildLevel(world)
  return world
}

function respawn(world: World): void {
  const t = timersFor(world)
  const p = world.player
  const cp = world.checkpoint
  const base =
    cp >= 0 && cp < world.beacons.length && world.beacons[cp].lit
      ? world.beacons[cp]
      : { x: SPAWN_X, y: GROUND_Y }
  p.x = base.x
  p.y = base.y
  p.vx = 0
  p.vy = 0
  p.grounded = false
  t.coyote = 0
  t.buffer = 0
  world.deaths += 1
}

function moveX(world: World, h: number): void {
  const p = world.player
  if (p.vx === 0) return
  let nx = p.x + p.vx * h
  const top = p.y - BODY_H
  const bottom = p.y
  for (const pl of world.platforms) {
    if (bottom <= pl.y + 4) continue // at/above the top face: slide, don't slam
    if (top >= pl.y + pl.h) continue // fully below
    if (p.vx > 0 && p.x + HALF_W <= pl.x && nx + HALF_W > pl.x) {
      nx = pl.x - HALF_W
      p.vx = 0
    } else if (p.vx < 0 && p.x - HALF_W >= pl.x + pl.w && nx - HALF_W < pl.x + pl.w) {
      nx = pl.x + pl.w + HALF_W
      p.vx = 0
    }
  }
  p.x = nx
  if (p.x < HALF_W) {
    p.x = HALF_W
    if (p.vx < 0) p.vx = 0
  } else if (p.x > world.width - HALF_W) {
    p.x = world.width - HALF_W
    if (p.vx > 0) p.vx = 0
  }
}

function moveY(world: World, h: number): void {
  const p = world.player
  p.grounded = false
  const ny = p.y + p.vy * h
  const left = p.x - HALF_W
  const right = p.x + HALF_W
  if (p.vy >= 0) {
    // Falling: swept landing — catch any top face crossed this substep.
    let landY = Infinity
    for (const pl of world.platforms) {
      if (right <= pl.x || left >= pl.x + pl.w) continue
      if (p.y <= pl.y + 0.5 && ny >= pl.y && pl.y < landY) landY = pl.y
    }
    if (landY !== Infinity) {
      p.y = landY
      p.vy = 0
      p.grounded = true
      return
    }
  } else {
    // Rising: swept head bump — catch any underside crossed this substep.
    const prevHead = p.y - BODY_H
    const head = ny - BODY_H
    for (const pl of world.platforms) {
      if (right <= pl.x || left >= pl.x + pl.w) continue
      if (prevHead >= pl.y + pl.h - 0.5 && head <= pl.y + pl.h) {
        p.y = pl.y + pl.h + BODY_H
        p.vy = 0
        return
      }
    }
  }
  p.y = ny
}

function touchHazards(world: World): boolean {
  const p = world.player
  const l = p.x - HALF_W
  const r = p.x + HALF_W
  const t = p.y - BODY_H
  const b = p.y
  for (const hz of world.hazards) {
    if (l < hz.x + hz.w && r > hz.x && t < hz.y + hz.h && b > hz.y) return true
  }
  return false
}

function touchBeacons(world: World): void {
  const p = world.player
  for (let i = 0; i < world.beacons.length; i++) {
    const b = world.beacons[i]
    if (Math.abs(p.x - b.x) < BEACON_DX && Math.abs(p.y - b.y) < BEACON_DY) {
      b.lit = true
      if (i > world.checkpoint) world.checkpoint = i
      if (i === world.beacons.length - 1) world.won = true
    }
  }
}

function substep(world: World, input: Input, h: number): void {
  const t = timersFor(world)
  const p = world.player
  t.coyote -= h
  t.buffer -= h

  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  if (dir !== 0) {
    p.vx = approach(p.vx, dir * RUN_SPEED, (p.grounded ? RUN_ACCEL : AIR_ACCEL) * h)
    p.facing = dir
  } else {
    p.vx = approach(p.vx, 0, (p.grounded ? GROUND_BRAKE : AIR_BRAKE) * h)
  }

  if (p.grounded) t.coyote = COYOTE_TIME
  if (t.buffer > 0 && (p.grounded || t.coyote > 0)) {
    p.vy = -JUMP_VELOCITY
    p.grounded = false
    t.coyote = 0
    t.buffer = 0
  }
  if (!input.jump && p.vy < JUMP_CUT) p.vy = JUMP_CUT
  p.vy = Math.min(p.vy + GRAVITY * h, MAX_FALL)

  moveX(world, h)
  moveY(world, h)

  if (touchHazards(world) || p.y > KILL_Y) {
    respawn(world)
    return
  }
  touchBeacons(world)
}

export function stepWorld(world: World, input: Input, dt: number): void {
  if (!Number.isFinite(dt) || dt <= 0) return
  const frame = Math.min(dt, MAX_FRAME_DT)
  const t = timersFor(world)
  // Edge-trigger the buffer once per call; substeps below consume it.
  if (input.jump && !t.prevJump) t.buffer = JUMP_BUFFER
  t.prevJump = input.jump
  const n = Math.max(1, Math.ceil(frame / FIXED_STEP))
  const h = frame / n
  for (let i = 0; i < n; i++) {
    if (world.won) break
    substep(world, input, h)
  }
  world.time += frame
}

// Autopilot through the authored course with the same physics the player
// gets. Always heads right; jumps for gap edges, rock steps and hazards it
// can see ahead; holds jump while rising for full height. Once won it idles —
// restarting the demo is the caller's job.
export function demoInput(world: World): Input {
  const p = world.player
  if (world.won) return { left: false, right: false, jump: false }
  if (!p.grounded && p.vy < -50) return { left: false, right: true, jump: true }

  const front = p.x + HALF_W
  let jump = false

  // Nearest supporting top face: leap before its edge runs out.
  let edge: number | null = null
  for (const pl of world.platforms) {
    if (Math.abs(pl.y - p.y) <= 3 && p.x + HALF_W > pl.x && p.x - HALF_W < pl.x + pl.w) {
      const e = pl.x + pl.w
      edge = edge === null ? e : Math.max(edge, e)
    }
  }
  const lead = 20 + Math.max(0, p.vx) * 0.12
  if (edge !== null) {
    if (edge - front < lead) jump = true
  } else if (p.grounded) {
    jump = true // stepped past an edge; spend coyote time at once
  }

  // Rock steps / the raised ledge: anything face-high overlapping the body.
  if (!jump) {
    for (const pl of world.platforms) {
      const gap = pl.x - front
      if (gap >= 0 && gap < 70 && pl.y < p.y - 6 && pl.y + pl.h > p.y - BODY_H + 6) {
        jump = true
        break
      }
    }
  }

  // Hazards on the running line.
  if (!jump) {
    for (const hz of world.hazards) {
      const gap = hz.x - front
      const tail = hz.x + hz.w - (p.x - HALF_W)
      if (gap < 80 && tail > 0 && Math.abs(hz.y + hz.h - p.y) < 70) {
        jump = true
        break
      }
    }
  }

  return { left: false, right: true, jump }
}
