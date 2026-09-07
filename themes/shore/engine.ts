/**
 * Another Shore II — the engine.
 *
 * Pure and deterministic: no DOM, no randomness, no clock but `dt`. The
 * shell steps it at a fixed 1/60 s and the tests step it the same way.
 *
 * Stage units, y down. The figure is a 22×52 box standing on its feet
 * point (x, y); crouched it is 22×30. One shot is live at a time; walking
 * off an edge moves the figure to the next shot's entry point (a hard cut
 * for the renderer, `world.cut` for one step).
 *
 * Deaths are vignettes: the world keeps running the falling body or the
 * tide for 0.7–0.9 s, cuts to black, then respawns at the last beacon.
 */
import { SHOTS, BEACONS, START, ATTRACT_END_X, FIGURE_W, FIGURE_H, CROUCH_H } from './shots'
import type { World, Input, Figure, Solid, Shot, DeathKind, TideHazard, RockHazard } from './types'

export const STEP = 1 / 60

const RUN = 160
const CRAWL = 70
const GRAVITY = 1500
const MAX_FALL = 900
const HOP_VY = -330
const JUMP_VY = -400
const JUMP_VX = 200
const COYOTE = 0.08
const JUMP_BUFFER = 0.1
const STEP_UP = 28
const HARD_LANDING_DROP = 90
const LAND_RECOVERY = 0.25
const ROCK_GRAVITY = 800
const FLASH = 0.06
const STORM_STRIKE_EVERY = 7
const INTRO = 0.7
const BLACK = 0.3
const LOOP_BLACK = 0.6

const DEATH_LENGTH: Record<DeathKind, number> = { fall: 0.9, tide: 0.8, rock: 0.75 }

const HALF = FIGURE_W / 2

export interface WorldOptions {
  attract?: boolean
}

function newFigure(x: number, y: number): Figure {
  return {
    x, y, vx: 0, vy: 0, grounded: true, facing: 1, crouch: false, pose: 'idle',
    runTime: 0, airTime: 0, airTop: y, landTimer: 0, coyote: 0, jumpBuffer: 0, jumpHeld: false,
  }
}

export function createWorld(opts: WorldOptions = {}): World {
  const rock = SHOTS.find((s) => s.hazards.some((h) => h.kind === 'rock'))!.hazards.find((h) => h.kind === 'rock') as RockHazard
  return {
    shot: 0,
    figure: newFigure(START[0], START[1]),
    beacons: BEACONS.map((b) => ({ ...b, lit: false })),
    checkpoint: -1,
    palette: 0,
    flashUntil: -1,
    stormSince: -1,
    rock: { state: 'hanging', y: rock.hangY, vy: 0 },
    beastTurned: false,
    death: null,
    blackout: 0,
    after: null,
    intro: INTRO,
    won: false,
    time: 0,
    deaths: 0,
    attract: !!opts.attract,
    loops: 0,
    cut: false,
  }
}

export function currentShot(w: World): Shot {
  return SHOTS[w.shot]
}

/** Solids the figure collides with in the live shot: the authored ones plus a landed rock. */
export function solidsOf(w: World): Solid[] {
  const shot = SHOTS[w.shot]
  const rock = shot.hazards.find((h) => h.kind === 'rock') as RockHazard | undefined
  if (rock && w.rock.state === 'landed') {
    return [...shot.solids, { x: rock.x, y: rock.groundY - rock.h, w: rock.w, h: rock.h, look: 'hidden' }]
  }
  return shot.solids
}

function overlapsX(s: Solid, x0: number, x1: number): boolean {
  return s.x < x1 && s.x + s.w > x0
}

/** Height of the standing/crouched box. */
function bodyH(f: Figure): number {
  return f.crouch ? CROUCH_H : FIGURE_H
}

/** A solid whose underside is inside the standing box at (x, y)? */
function ceilingAt(solids: Solid[], x: number, y: number, h: number): Solid | null {
  for (const s of solids) {
    if (!overlapsX(s, x - HALF, x + HALF)) continue
    const bottom = s.y + s.h
    if (bottom > y - h && s.y < y - 1) return s
  }
  return null
}

/** Top of the highest walkable surface under (x) between yFrom and yTo. */
export function groundBelow(solids: Solid[], x: number, yFrom: number, yTo: number): number | null {
  let best: number | null = null
  for (const s of solids) {
    if (!overlapsX(s, x - HALF + 1, x + HALF - 1)) continue
    if (s.y >= yFrom && s.y <= yTo && (best === null || s.y < best)) best = s.y
  }
  return best
}

/** Where the tide band's top sits (stage y) at this phase of its cycle. */
export function tideTop(h: TideHazard, time: number): number {
  const phase = ((time % h.period) + h.period) % h.period
  const peak = h.y - 6
  const rise = 0.6
  if (phase >= h.coverFrom && phase < h.coverTo) return peak
  if (phase >= h.coverFrom - rise && phase < h.coverFrom) {
    const k = (phase - (h.coverFrom - rise)) / rise
    return h.restY + (peak - h.restY) * k
  }
  if (phase >= h.coverTo && phase < h.coverTo + rise) {
    const k = (phase - h.coverTo) / rise
    return peak + (h.restY - peak) * k
  }
  return h.restY
}

function beginDeath(w: World, kind: DeathKind) {
  if (w.death) return
  w.death = { kind, t: 0, x: w.figure.x, y: w.figure.y }
  w.deaths += 1
  w.figure.vx = 0
  if (kind !== 'fall') w.figure.vy = 0
}

function respawn(w: World) {
  w.death = null
  if (w.checkpoint < 0) {
    w.shot = 0
    w.figure = newFigure(START[0], START[1])
    w.intro = INTRO
  } else {
    const b = w.beacons[w.checkpoint]
    w.shot = b.shot
    w.figure = newFigure(b.x, b.y)
  }
  w.cut = true
}

function loopRestart(w: World) {
  w.shot = 0
  w.figure = newFigure(START[0], START[1])
  w.intro = INTRO
  w.loops += 1
  w.cut = true
}

function moveToShot(w: World, index: number, fromLeft: boolean) {
  const shot = SHOTS[index]
  const [x, y] = fromLeft ? shot.enterLeft : shot.enterRight
  w.shot = index
  w.figure.x = x
  w.figure.y = y
  w.figure.vy = 0
  w.figure.grounded = true
  w.figure.crouch = false
  w.cut = true
}

function stepRock(w: World, dt: number) {
  const shot = SHOTS[w.shot]
  const rock = shot.hazards.find((h) => h.kind === 'rock') as RockHazard | undefined
  if (!rock) return
  const r = w.rock
  const f = w.figure
  if (r.state === 'hanging') {
    if (f.x > rock.triggerX) {
      r.state = 'falling'
      r.vy = 0
    }
    return
  }
  if (r.state === 'falling') {
    r.vy += ROCK_GRAVITY * dt
    r.y += r.vy * dt
    if (r.y + rock.h >= rock.groundY) {
      r.y = rock.groundY - rock.h
      r.vy = 0
      r.state = 'landed'
      const under = f.x + HALF > rock.x && f.x - HALF < rock.x + rock.w && f.y > r.y && f.y - bodyH(f) < rock.groundY
      if (under && !w.death) beginDeath(w, 'rock')
    }
  }
}

function stepTide(w: World) {
  const shot = SHOTS[w.shot]
  const tide = shot.hazards.find((h) => h.kind === 'tide') as TideHazard | undefined
  if (!tide || w.death) return
  const f = w.figure
  const top = tideTop(tide, w.time)
  if (top > tide.y) return
  if (f.x + HALF > tide.x && f.x - HALF < tide.x + tide.w && f.y >= tide.y - 2) beginDeath(w, 'tide')
}

function stepBeacons(w: World, prevX: number) {
  const f = w.figure
  for (let i = 0; i < w.beacons.length; i++) {
    const b = w.beacons[i]
    if (b.lit || b.shot !== w.shot) continue
    const crossed = (prevX - b.x) * (f.x - b.x) <= 0
    const near = Math.abs(f.x - b.x) < 16
    if ((crossed || near) && f.y > b.y - 70 && f.y < b.y + 8) {
      b.lit = true
      w.checkpoint = i
      w.palette = w.beacons.filter((x) => x.lit).length
      if (w.palette === 2) {
        w.flashUntil = w.time + FLASH
        w.stormSince = w.time
      }
      if (i === w.beacons.length - 1) {
        w.won = true
        f.vx = 0
        f.pose = 'idle'
      }
    }
  }
}

function stepStorm(w: World, dt: number) {
  if (w.palette !== 2 || w.stormSince < 0) return
  const since = w.time - w.stormSince
  const k = Math.floor(since / STORM_STRIKE_EVERY)
  if (k >= 1 && since - k * STORM_STRIKE_EVERY < dt) w.flashUntil = w.time + FLASH
}

function updatePose(w: World, dt: number) {
  const f = w.figure
  if (f.landTimer > 0) {
    f.pose = 'land'
    return
  }
  if (!f.grounded) {
    f.pose = f.vy < 0 ? 'jump' : 'fall'
    return
  }
  if (f.crouch) {
    f.pose = 'crouch'
    f.runTime += Math.abs(f.vx) > 1 ? dt * 0.6 : 0
    return
  }
  if (Math.abs(f.vx) > 1) {
    f.pose = 'run'
    f.runTime += dt
  } else {
    f.pose = 'idle'
    f.runTime = 0
  }
}

function stepFigure(w: World, input: Input, dt: number) {
  const f = w.figure
  const shot = SHOTS[w.shot]
  const solids = solidsOf(w)

  // Timers.
  if (f.landTimer > 0) f.landTimer = Math.max(0, f.landTimer - dt)
  if (f.coyote > 0) f.coyote = Math.max(0, f.coyote - dt)
  if (f.jumpBuffer > 0) f.jumpBuffer = Math.max(0, f.jumpBuffer - dt)
  if (input.jump && !f.jumpHeld) f.jumpBuffer = JUMP_BUFFER
  f.jumpHeld = input.jump

  const controllable = f.landTimer <= 0 && !w.won
  const dir = controllable ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0

  // Crouch: on request, or forced while a ceiling is too low to stand.
  if (f.grounded) {
    const wantCrouch = controllable && input.crouch
    const forced = !!ceilingAt(solids, f.x, f.y, FIGURE_H)
    f.crouch = wantCrouch || forced
  }

  // Horizontal intent while grounded; airborne velocity is committed.
  if (f.grounded) {
    f.vx = dir * (f.crouch ? CRAWL : RUN)
    if (dir !== 0) f.facing = dir as 1 | -1
  }

  // Jump: standing hop, or the long jump when already running.
  if ((f.grounded || f.coyote > 0) && f.jumpBuffer > 0 && !f.crouch && controllable) {
    const running = Math.abs(f.vx) > 1
    f.vy = running ? JUMP_VY : HOP_VY
    if (running) f.vx = f.facing * JUMP_VX
    f.grounded = false
    f.coyote = 0
    f.jumpBuffer = 0
    f.airTime = 0
    f.airTop = f.y
  }

  if (!f.grounded) {
    f.vy = Math.min(MAX_FALL, f.vy + GRAVITY * dt)
    f.airTime += dt
    f.airTop = Math.min(f.airTop, f.y)
  }

  const h = bodyH(f)

  // X move with step-up and walls.
  let nx = f.x + f.vx * dt
  if (f.vx !== 0) {
    const lead = nx + Math.sign(f.vx) * HALF
    for (const s of solids) {
      if (!(s.y < f.y - 0.5 && s.y + s.h > f.y - h + 0.5)) continue
      const inX = f.vx > 0 ? lead > s.x && f.x + HALF <= s.x + 0.01 : lead < s.x + s.w && f.x - HALF >= s.x + s.w - 0.01
      if (!inX) continue
      const rise = f.y - s.y
      const canStep = f.grounded && rise > 0 && rise <= STEP_UP && !ceilingAt(solids, f.x, s.y, h)
      if (canStep) {
        f.y = s.y
      } else {
        // Blocked. Airborne velocity is kept: a jump into a ledge slides up
        // its face and lands on top once the feet clear it.
        nx = f.vx > 0 ? s.x - HALF : s.x + s.w + HALF
      }
    }
  }
  f.x = nx

  // Y move: land on tops when falling, bump heads when rising.
  if (!f.grounded) {
    const ny = f.y + f.vy * dt
    if (f.vy >= 0) {
      const top = groundBelow(solids, f.x, f.y - 0.01, ny)
      if (top !== null) {
        f.y = top
        f.vy = 0
        f.grounded = true
        // A long drop costs a beat of recovery; an ordinary jump does not.
        if (f.y - f.airTop > HARD_LANDING_DROP) f.landTimer = LAND_RECOVERY
        f.airTime = 0
      } else {
        f.y = ny
      }
    } else {
      let hit: number | null = null
      for (const s of solids) {
        if (!overlapsX(s, f.x - HALF + 1, f.x + HALF - 1)) continue
        const bottom = s.y + s.h
        if (bottom <= f.y - h + 0.01 && bottom > ny - h && (hit === null || bottom > hit)) hit = bottom
      }
      if (hit !== null) {
        f.y = hit + h
        f.vy = 0
      } else {
        f.y = ny
      }
    }
  } else {
    // Still supported?
    const top = groundBelow(solids, f.x, f.y - 0.5, f.y + 0.5)
    if (top === null) {
      f.grounded = false
      f.coyote = COYOTE
      f.airTime = 0
      f.airTop = f.y
    }
  }

  // Edges: the left wall in the first shot, hard cuts elsewhere.
  if (shot.leftWall && f.x < HALF) {
    f.x = HALF
    if (f.grounded) f.vx = Math.max(0, f.vx)
  }
  if (f.x < 0 && w.shot > 0) {
    moveToShot(w, w.shot - 1, false)
  } else if (f.x > shot.stageW && w.shot < SHOTS.length - 1) {
    moveToShot(w, w.shot + 1, true)
  } else if (f.x > shot.stageW - HALF && w.shot === SHOTS.length - 1) {
    f.x = shot.stageW - HALF
  }

  if (f.y > SHOTS[w.shot].abyssY) beginDeath(w, 'fall')
}

export function stepWorld(w: World, input: Input, dtRaw: number): void {
  if (!(dtRaw > 0)) return
  const dt = Math.min(dtRaw, 0.1)
  w.time += dt
  w.cut = false

  if (w.blackout > 0) {
    w.blackout -= dt
    if (w.blackout <= 0) {
      w.blackout = 0
      if (w.after === 'respawn') respawn(w)
      else if (w.after === 'loop') loopRestart(w)
      w.after = null
    }
    return
  }

  if (w.death) {
    w.death.t += dt
    const f = w.figure
    if (w.death.kind === 'fall') {
      f.vy = Math.min(MAX_FALL, f.vy + GRAVITY * dt)
      f.y += f.vy * dt
      f.pose = 'fall'
    }
    if (w.death.t >= DEATH_LENGTH[w.death.kind]) {
      w.blackout = BLACK
      w.after = 'respawn'
    }
    return
  }

  if (w.intro > 0) {
    w.intro = Math.max(0, w.intro - dt)
    w.figure.pose = 'idle'
    return
  }

  if (w.won) {
    updatePose(w, dt)
    return
  }

  const prevX = w.figure.x
  const prevShot = w.shot
  stepFigure(w, input, dt)
  stepRock(w, dt)
  stepTide(w)
  stepBeacons(w, prevShot === w.shot ? prevX : w.figure.x)
  stepStorm(w, dt)
  if (SHOTS[w.shot].beast && w.figure.x > SHOTS[w.shot].beast!.turnX) w.beastTurned = true
  updatePose(w, dt)

  if (w.attract && w.shot === 0 && w.figure.x > ATTRACT_END_X && !w.death) {
    w.blackout = LOOP_BLACK
    w.after = 'loop'
  }
}

const NONE: Input = { left: false, right: false, jump: false, crouch: false }

/**
 * The autopilot: runs right, crouches under low ceilings, jumps gaps and
 * low walls, waits for the tide. Deterministic given the world.
 */
export function demoInput(w: World): Input {
  if (w.won || w.death || w.blackout > 0 || w.intro > 0) return NONE
  const f = w.figure
  const shot = SHOTS[w.shot]
  const solids = solidsOf(w)
  const out: Input = { left: false, right: true, jump: false, crouch: false }

  // Low ceiling ahead (or overhead): crouch through it.
  for (const s of solids) {
    const bottom = s.y + s.h
    const crawlable = bottom > f.y - FIGURE_H && bottom <= f.y - CROUCH_H
    if (crawlable && s.x < f.x + HALF + 44 && s.x + s.w > f.x - HALF) {
      out.crouch = true
    }
  }

  // The tide: wait on the slab before it until the band has just receded.
  const tide = shot.hazards.find((h) => h.kind === 'tide') as TideHazard | undefined
  if (tide && f.grounded && f.x >= tide.x - 110 && f.x < tide.x - 60) {
    const phase = ((w.time % tide.period) + tide.period) % tide.period
    const safe = phase >= tide.coverTo || phase < 1.2
    if (!safe) return NONE
  }

  if (!f.grounded || out.crouch) return out

  // A gap under the next step, or a wall too tall to step up: jump.
  // Anything within STEP_UP is walked up (wading out of the pool).
  const aheadX = f.x + HALF + 12
  const groundAhead = groundBelow(solids, aheadX, f.y - STEP_UP, f.y + 4)
  if (groundAhead === null) out.jump = true
  for (const s of solids) {
    const rise = f.y - s.y
    if (rise > STEP_UP && rise <= 60 && s.x > f.x + HALF - 1 && s.x <= f.x + HALF + 30 && s.y + s.h > f.y - 1) out.jump = true
  }
  // The engine buffers jumps on the press edge: release for a step between presses.
  if (f.jumpHeld) out.jump = false
  return out
}
