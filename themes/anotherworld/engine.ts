import type { DeathCause, Input, RockfallHazard, TideHazard, World } from './types'

// Another Shore — pure deterministic platformer physics + authored level.
// y points down, units are px, dt is seconds. Player x/y is feet centre,
// body 22 wide x 52 tall. No rendering, no Vue, no randomness here.
//
// The crossing is three places: the shore (flat, teaches run and jump; a
// stranded lamp post is the first beacon), the causeway (slabs over water,
// an arch, the tide surge; a lamp post on the last slab is the second), and
// the tower (a cracked overhang drops a rock, then three ledges up the
// tower base to the lamp; lighting it wins).

// ---- tuning ----
const GRAVITY = 2100 // px/s^2, pulls +y
const JUMP_VELOCITY = 840 // running takeoff (-y); height ~168px, range ~200px
const HOP_VELOCITY = 600 // standing takeoff; height ~86px
const HOP_BELOW_VX = 120 // slower than this at takeoff = a hop, not a jump
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
const BEACON_DY = 60
const SPAWN_X = 80
const HARD_LANDING_VY = 900 // faster than this on touchdown = a 250 ms crouch
const CROUCH_TIME = 0.25
export const DEATH_TIME = 0.8 // the vignette; then a hard cut to the checkpoint

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

// ---- level ----

/** World x of the arch legs (near layer, drawn in front of the figure). */
export const ARCHES = [1100, 2330]
/** The tower wall behind the lamp platform: world x range. Renderer geometry. */
export const TOWER = { x0: 4480, x1: 4760, lampX: 4600 }
/** The cracked overhang the rock hangs from: x range and its underside y. */
export const OVERHANG = { x0: 3560, x1: 3820, y: 232 }

function buildLevel(world: World): void {
  // Ground tops sit at y=420 and run down past the view to y=560.
  // Gaps are absences; blocks sit on top and are jumped over.
  const G = (x: number, w: number) => world.platforms.push({ x, y: GROUND_Y, w, h: 140 })
  const block = (x: number, top: number, w: number) =>
    world.platforms.push({ x, y: top, w, h: GROUND_Y - top })
  const lamp = (x: number, y: number) => world.beacons.push({ x, y, lit: false })

  // The shore (0–1700): flat, one small gap, a low rock, a wider gap.
  G(0, 620) // 0-620
  // gap 620-700 (80)
  G(700, 500) // 700-1200
  block(950, 392, 44) // low rock, 28 high
  // gap 1200-1290 (90)
  G(1290, 410) // 1290-1700
  lamp(1500, GROUND_Y) // a stranded lamp post

  // The causeway (1700–3400): slabs over water, the arch, the tide.
  // gap 1700-1800 (100)
  G(1800, 300) // 1800-2100
  // gap 2100-2200 (100)
  G(2200, 260) // 2200-2460, under the arch
  // gap 2460-2570 (110)
  world.platforms.push({ x: 2570, y: 436, w: 200, h: 124 }) // the low slab, 16 lower
  const tide: TideHazard = { kind: 'tide', x: 2580, y: 436 - 44, w: 180, h: 44, period: 4, phase: 1.5 }
  world.hazards.push(tide)
  // gap 2770-2870 (100)
  G(2870, 530) // 2870-3400
  block(3050, 396, 40) // a rock, 24 high
  lamp(3250, GROUND_Y)

  // The tower (3400–5000): the rockfall, then three ledges up to the lamp.
  // gap 3400-3500 (100)
  G(3500, 1500) // 3500-5000
  const rock: RockfallHazard = {
    kind: 'rockfall',
    x: 3700, y: GROUND_Y - 40, w: 52, h: 40,
    triggerX: 3620, triggerW: 40,
    dropY: OVERHANG.y, top: OVERHANG.y, vy: 0,
    state: 'hanging',
  }
  world.hazards.push(rock)
  // Three stacks up to the lamp platform at the tower's foot; each is solid
  // down to the ground so a missed jump lands beside it, not under it.
  world.platforms.push({ x: 3900, y: 372, w: 160, h: 48 }) // stack 1, 48 up
  world.platforms.push({ x: 4160, y: 324, w: 140, h: 96 }) // stack 2, 96 up
  world.platforms.push({ x: 4400, y: 276, w: 300, h: 144 }) // the lamp platform, 144 up
  lamp(TOWER.lampX, 276)
}

export function createWorld(): World {
  const world: World = {
    player: { x: SPAWN_X, y: GROUND_Y, vx: 0, vy: 0, grounded: true, facing: 1, crouch: 0, hop: false },
    platforms: [],
    hazards: [],
    beacons: [],
    width: 5000,
    time: 0,
    deaths: 0,
    checkpoint: -1, // index into beacons; -1 = still at spawn
    won: false,
    dying: null,
  }
  buildLevel(world)
  return world
}

// ---- hazards ----

/**
 * Tide rise 0..1 at a moment. One cycle: quiet, rising over 15 % of the
 * period (visible, harmless), full for 30 % (lethal), retreating 10 %.
 */
export function tideLevel(hz: TideHazard, time: number): number {
  const u = (((time + hz.phase) % hz.period) + hz.period) % hz.period / hz.period
  if (u < 0.35) return 0
  if (u < 0.5) return (u - 0.35) / 0.15
  if (u < 0.8) return 1
  if (u < 0.9) return 1 - (u - 0.8) / 0.1
  return 0
}

/** Cycle position 0..1 of a tide; the demo uses it to time its crossing. */
export function tidePhase(hz: TideHazard, time: number): number {
  return (((time + hz.phase) % hz.period) + hz.period) % hz.period / hz.period
}

function tideLethal(hz: TideHazard, time: number): boolean {
  return tideLevel(hz, time) >= 0.999
}

function overlaps(l: number, r: number, t: number, b: number, x: number, y: number, w: number, h: number): boolean {
  return l < x + w && r > x && t < y + h && b > y
}

function die(world: World, cause: DeathCause): void {
  world.dying = { cause, t: 0 }
  world.deaths += 1
  const p = world.player
  p.vx = 0
  p.crouch = 0
  if (cause !== 'fall') p.vy = 0
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
  p.crouch = 0
  p.hop = false
  t.coyote = 0
  t.buffer = 0
  world.dying = null
}

// Advance hazards, then return the cause if one has the figure. During a
// vignette (live = false) nothing triggers or kills, but a falling rock
// still lands — the wedge stays where it came down.
function stepHazards(world: World, h: number, live: boolean): DeathCause | null {
  const p = world.player
  const l = p.x - HALF_W
  const r = p.x + HALF_W
  const t = p.y - BODY_H
  const b = p.y
  let cause: DeathCause | null = null
  for (const hz of world.hazards) {
    if (hz.kind === 'tide') {
      if (live && tideLethal(hz, world.time) && overlaps(l, r, t, b, hz.x, hz.y, hz.w, hz.h)) cause = 'tide'
    } else {
      if (hz.state === 'hanging') {
        if (live && r > hz.triggerX && l < hz.triggerX + hz.triggerW) {
          hz.state = 'falling'
          hz.vy = 0
        }
      } else if (hz.state === 'falling') {
        hz.vy += GRAVITY * h
        hz.top += hz.vy * h
        let landed = false
        if (hz.top >= hz.y) {
          hz.top = hz.y
          landed = true
        }
        if (live && overlaps(l, r, t, b, hz.x, hz.top, hz.w, hz.h)) cause = 'rockfall'
        if (landed) {
          hz.state = 'landed'
          hz.vy = 0
          world.platforms.push({ x: hz.x, y: hz.y, w: hz.w, h: hz.h })
        }
      }
    }
  }
  return cause
}

// ---- movement ----

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
  const wasAirborne = !p.grounded
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
      if (wasAirborne && p.vy >= HARD_LANDING_VY) p.crouch = CROUCH_TIME
      p.vy = 0
      p.grounded = true
      p.hop = false
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

  if (world.dying) {
    // The vignette: no input, no hazards. A fall keeps falling out of frame;
    // the others hold the figure where it was. Then the hard cut.
    world.dying.t += h
    if (world.dying.cause === 'fall') {
      p.vy = Math.min(p.vy + GRAVITY * h, MAX_FALL)
      p.y += p.vy * h
    }
    stepHazards(world, h, false)
    if (world.dying.t >= DEATH_TIME) respawn(world)
    return
  }

  t.coyote -= h
  t.buffer -= h
  if (p.crouch > 0) p.crouch -= h
  const controllable = p.crouch <= 0

  const dir = controllable ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0
  if (dir !== 0) {
    p.vx = approach(p.vx, dir * RUN_SPEED, (p.grounded ? RUN_ACCEL : AIR_ACCEL) * h)
    p.facing = dir
  } else {
    p.vx = approach(p.vx, 0, (p.grounded ? GROUND_BRAKE : AIR_BRAKE) * h)
  }

  if (p.grounded) t.coyote = COYOTE_TIME
  if (controllable && t.buffer > 0 && (p.grounded || t.coyote > 0)) {
    p.hop = Math.abs(p.vx) < HOP_BELOW_VX
    p.vy = p.hop ? -HOP_VELOCITY : -JUMP_VELOCITY
    p.grounded = false
    t.coyote = 0
    t.buffer = 0
  }
  if (!input.jump && p.vy < JUMP_CUT) p.vy = JUMP_CUT
  p.vy = Math.min(p.vy + GRAVITY * h, MAX_FALL)

  moveX(world, h)
  moveY(world, h)

  const cause = stepHazards(world, h, true)
  if (cause) {
    die(world, cause)
    return
  }
  if (p.y > KILL_Y) {
    die(world, 'fall')
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

// ---- demo autopilot ----

const NONE: Input = { left: false, right: false, jump: false }

// Waits for the tide and the rock the way a careful player would: it stops
// short of a tide slab until the band has retreated, and stops the moment
// the rock starts falling ahead of it. Everything else is the old runner.
function shouldWait(world: World, front: number): boolean {
  for (const hz of world.hazards) {
    if (hz.kind === 'tide') {
      if (front >= hz.x) continue // on or past the slab: keep going
      if (hz.x - front > 220) continue
      const u = tidePhase(hz, world.time)
      // Crossing takes ~1.6 s (0.4 of the period); start only just after
      // the retreat so the whole run happens on a quiet sea.
      const open = u >= 0.88 || u < 0.05
      if (!open) return true
    } else if (hz.kind === 'rockfall') {
      if (hz.state === 'falling' && front < hz.x && hz.x - front < 200) return true
    }
  }
  return false
}

// Autopilot through the authored course with the same physics the player
// gets. Always heads right; jumps for gap edges, rock steps and ledges it
// can see ahead; holds jump while rising for full height. Once won it idles —
// restarting the demo is the caller's job.
export function demoInput(world: World): Input {
  const p = world.player
  if (world.won || world.dying || p.crouch > 0) return NONE
  if (!p.grounded && p.vy < -50) return { left: false, right: true, jump: true }

  const front = p.x + HALF_W
  if (p.grounded && shouldWait(world, front)) return NONE
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

  // Rock steps / the ledges: anything face-high overlapping the body.
  if (!jump) {
    for (const pl of world.platforms) {
      const gap = pl.x - front
      if (gap >= 0 && gap < 70 && pl.y < p.y - 6 && pl.y + pl.h > p.y - BODY_H + 6) {
        jump = true
        break
      }
    }
  }

  return { left: false, right: true, jump }
}
