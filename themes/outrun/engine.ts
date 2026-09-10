/**
 * OutRun engine — pure pseudo-3D road-racer logic with no DOM, canvas or Vue
 * imports, so plain `node --test` can exercise it. OutRun.vue imports the
 * constants and `createGame`/`stepGame`, and owns all rendering and input.
 *
 * The contract (decided 2026-09-10): an endless arcade checkpoint racer in
 * the Neon Dreams palette. Auto-accelerating rear-view car, steer with
 * left/right, brake with down. Traffic to dodge, near-miss bonuses,
 * off-road slowdown, crash spin-downs, a 60 s countdown with +25 s per
 * checkpoint, and a stage (palette + name) per checkpoint. Score is metres
 * driven plus pass and checkpoint bonuses. No lives — the clock is the
 * enemy, like the 1986 original.
 *
 * The road is an endless list of segments (SEG_LEN world units each) built
 * procedurally ahead of the car with a seeded RNG, so runs are
 * deterministic per seed. Curves push the car wide (centrifugal force);
 * hills are pure scenery plus camera height.
 */

/** World units per road segment. */
export const SEG_LEN = 200
/** Segments per rumble-strip colour band. */
export const RUMBLE = 3
/** How far ahead the renderer draws (and the engine guarantees built). */
export const DRAW_DIST = 140
/** Half-width of the road in world units; playerX is in units of it. */
export const ROAD_WIDTH = 2100
/** Camera height above the road surface. */
export const CAMERA_HEIGHT = 1050
/** Field of view in degrees, for the projection. */
export const FIELD_OF_VIEW = 100

/** Top speed in world units per second (SEG_LEN * 60 segments/s). */
export const MAX_SPEED = SEG_LEN * 60
/** Acceleration to top speed, per second. */
export const ACCEL = MAX_SPEED / 4
/** Braking deceleration, per second. */
export const BRAKE = -MAX_SPEED * 0.9
/** Aerodynamic drag: proportional to speed, so the car settles at top speed. */
export const DRAG = 0.12
/** Off-road speed cap (dust slows the car). */
export const OFFROAD_MAX = MAX_SPEED / 4
/** Off-road deceleration towards the cap, per second. */
export const OFFROAD_DECEL = -MAX_SPEED / 1.2
/** How hard curves fling the car outwards. */
export const CENTRIFUGAL = 0.31
/** Steering authority at full speed, road-half-widths per second. */
export const STEER_SPEED = 2.4

/** Metres the scoreboard credits per segment travelled. */
export const M_PER_SEG = 4
/** Countdown at the start of a run, in seconds. */
export const START_TIME = 60
/** Extra seconds per checkpoint. */
export const CHECKPOINT_TIME = 25
/** Metres between checkpoints. */
export const CHECKPOINT_M = 6000
/** Score bonus per checkpoint (flat — the clock is the reward). */
export const CHECKPOINT_SCORE = 1500
/** Score bonus for threading past traffic. */
export const NEAR_MISS_SCORE = 150
/** Lateral gap (road-half-widths) under which a pass counts as near. */
export const NEAR_MISS_GAP = 0.55
/** Score bonus for any clean pass at speed. */
export const PASS_SCORE = 25
/** Overlap (road-half-widths) under which a car hits. */
export const CRASH_GAP = 0.34
/** Speed after a crash, as a fraction of top speed. */
export const CRASH_SPEED_FRac = 0.22
/** Seconds of shake/spin feedback after a crash. */
export const CRASH_TIME = 1.1

/** Traffic colours, indices into the renderer's paint list. */
export const CAR_COLORS = 4

export type SectionKind = 'straight' | 'curve' | 'hill' | 'scurve' | 'combo'

export interface RoadProp {
  /** Lateral position in road-half-widths (sign = side). */
  offset: number
  /** 0 = neon pylon, 1 = billboard, 2 = palm, 3 = gantry arch. */
  kind: number
}

export interface RoadSegment {
  index: number
  /** -6..6, positive bends right. */
  curve: number
  /** World height at the segment's far end. */
  y: number
  /** Alternating ground/rumble band. */
  band: 0 | 1
  props: RoadProp[]
}

export interface TrafficCar {
  /** Absolute world-z of the car. */
  z: number
  /** Lateral position in road-half-widths. */
  offset: number
  /** World units per second (always slower than top speed). */
  speed: number
  color: number
  /** True once the player has gone by — used for pass bonuses. */
  counted: boolean
}

export interface OutrunInput {
  left: boolean
  right: boolean
  brake: boolean
}

export type OutrunEvent =
  | { type: 'crash' }
  | { type: 'nearmiss' }
  | { type: 'pass' }
  | { type: 'checkpoint', stage: number }
  | { type: 'timeup' }
  | { type: 'offroad', on: boolean }

export interface OutrunState {
  rng: number
  segments: RoadSegment[]
  /** Absolute world-z of the camera. */
  position: number
  /** Lateral position in road-half-widths (0 = centre, ±1 = edge). */
  playerX: number
  speed: number
  time: number
  /** Metres driven (fractional). */
  meters: number
  /** Bonus pool on top of metres. */
  bonus: number
  /** Checkpoints cleared. */
  stage: number
  nextCheckpointM: number
  cars: TrafficCar[]
  /** Seconds until the next traffic spawn. */
  spawnT: number
  nearMisses: number
  passes: number
  crashes: number
  crashT: number
  offroad: boolean
  status: 'run' | 'timeout'
  timeupFired: boolean
  /** Last section kind, so the generator varies the road. */
  lastKind: SectionKind | ''
}

/** Stage names shown on the checkpoint banner, one per checkpoint. */
export const STAGE_NAMES = [
  'NEON COAST',
  'PALM VEIL',
  'MIRAGE MILE',
  'GRID HORIZON',
  'SUNSET OVERDRIVE',
  'AFTERBURNER',
  'ENDLESS SUMMER',
] as const

export function stageName(stage: number): string {
  return STAGE_NAMES[stage % STAGE_NAMES.length]
}

/** Per-stage look. The renderer reads these; the game stays readable on all. */
export interface StagePalette {
  skyTop: string
  skyMid: string
  skyGlow: string
  sunTop: string
  sunBottom: string
  mountainFar: string
  mountainNear: string
  groundA: string
  groundB: string
}

export const STAGE_PALETTES: readonly StagePalette[] = [
  { // violet dusk — the site's home colours
    skyTop: '#060310', skyMid: '#0b0616', skyGlow: '#170a30',
    sunTop: '#ffd23f', sunBottom: '#ff2fa0',
    mountainFar: '#2a1650', mountainNear: '#170a30',
    groundA: '#0b0616', groundB: '#0e0820',
  },
  { // emerald night
    skyTop: '#02120e', skyMid: '#06231c', skyGlow: '#0a3d2c',
    sunTop: '#d8fff0', sunBottom: '#2ff3ff',
    mountainFar: '#0e4d3a', mountainNear: '#07271e',
    groundA: '#04120d', groundB: '#071c15',
  },
  { // ember desert
    skyTop: '#160604', skyMid: '#2b0f08', skyGlow: '#57200f',
    sunTop: '#ffe9a8', sunBottom: '#ff6a3d',
    mountainFar: '#5c2a18', mountainNear: '#2c130b',
    groundA: '#170806', groundB: '#21100a',
  },
  { // azure midnight
    skyTop: '#030818', skyMid: '#0a1230', skyGlow: '#1b2a6b',
    sunTop: '#fff3b0', sunBottom: '#ff2fa0',
    mountainFar: '#27357a', mountainNear: '#121a45',
    groundA: '#050a1c', groundB: '#0a1128',
  },
] as const

export function stagePalette(stage: number): StagePalette {
  return STAGE_PALETTES[stage % STAGE_PALETTES.length]
}

// ------------------------------------------------------------------ RNG

/** mulberry32 — tiny, seedable, good enough for road generation. */
export function nextRandom(rng: number): { value: number, rng: number } {
  let a = (rng + 0x6d2b79f5) | 0
  const t = Math.imul(a ^ (a >>> 15), 1 | a)
  const v = ((t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t) >>> 0
  return { value: ((v ^ (v >>> 14)) >>> 0) / 4294967296, rng: a }
}

function randRange(state: OutrunState, lo: number, hi: number): number {
  const r = nextRandom(state.rng)
  state.rng = r.rng
  return lo + r.value * (hi - lo)
}

function randChoice<T>(state: OutrunState, items: readonly T[]): T {
  return items[Math.floor(randRange(state, 0, items.length)) % items.length]
}

// ------------------------------------------------------------------ track

function easeIn(a: number, b: number, t: number): number {
  return a + (b - a) * t * t
}

function easeInOut(a: number, b: number, t: number): number {
  return a + (b - a) * ((-Math.cos(t * Math.PI) / 2) + 0.5)
}

function lastY(state: OutrunState): number {
  return state.segments.length === 0 ? 0 : state.segments[state.segments.length - 1].y
}

function addSegment(state: OutrunState, curve: number, y: number): void {
  const index = state.segments.length
  const seg: RoadSegment = {
    index,
    curve,
    y,
    band: Math.floor(index / RUMBLE) % 2 === 0 ? 0 : 1,
    props: [],
  }
  // Roadside dressing: pylons fan out regularly, billboards and palms
  // sparsely, a gantry arch opens longer straights.
  if (index > 20) {
    if (index % 12 === 0) {
      seg.props.push({ offset: index % 24 === 0 ? -1.35 : 1.35, kind: 0 })
    } else if (index % 47 === 0) {
      seg.props.push({ offset: index % 94 === 0 ? -1.8 : 1.8, kind: 1 })
    } else if (index % 31 === 0) {
      seg.props.push({ offset: index % 62 === 0 ? -1.6 : 1.6, kind: 2 })
    }
  }
  state.segments.push(seg)
}

function addRoad(state: OutrunState, enter: number, hold: number, leave: number, curve: number, dy: number): void {
  const startY = lastY(state)
  const endY = startY + dy
  const total = enter + hold + leave
  for (let n = 0; n < enter; n++) addSegment(state, easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total))
  for (let n = 0; n < hold; n++) addSegment(state, curve, easeInOut(startY, endY, (enter + n) / total))
  for (let n = 0; n < leave; n++) addSegment(state, easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total))
}

function addStraight(state: OutrunState, len = 60): void {
  addRoad(state, len, len, len, 0, 0)
}

function addCurve(state: OutrunState, curve: number, len = 80, dy = 0): void {
  addRoad(state, len, len, len, curve, dy)
}

function addHill(state: OutrunState, dy: number, len = 90): void {
  addRoad(state, len, len, len, 0, dy)
}

function addSCurves(state: OutrunState): void {
  addRoad(state, 50, 50, 50, -4, 0)
  addRoad(state, 50, 50, 50, 4, 0)
  addRoad(state, 50, 50, 50, 2, 0)
}

/** Builds the opening straight (with a gantry arch) plus the first miles. */
function buildOpening(state: OutrunState): void {
  addStraight(state, 50)
  if (state.segments.length > 30) {
    state.segments[30].props.push({ offset: 0, kind: 3 })
  }
  addCurve(state, 2, 60)
  addStraight(state, 40)
  addHill(state, 600, 70)
  state.lastKind = 'straight'
}

const SECTION_BUILDERS: readonly SectionKind[] = ['straight', 'curve', 'hill', 'scurve', 'combo']

/** Appends one generated section, avoiding three repeats of a kind. */
export function appendSection(state: OutrunState): void {
  let kind = randChoice(state, SECTION_BUILDERS)
  if (kind === state.lastKind) kind = randChoice(state, SECTION_BUILDERS)
  const dir = randRange(state, 0, 1) < 0.5 ? -1 : 1
  const hard = Math.min(1, 0.35 + state.stage * 0.08)
  switch (kind) {
    case 'straight':
      addStraight(state, Math.round(randRange(state, 40, 90)))
      break
    case 'curve':
      addCurve(state, dir * randRange(state, 2, 2 + 4 * hard), Math.round(randRange(state, 50, 100)))
      break
    case 'hill':
      addHill(state, dir * randRange(state, 300, 900), Math.round(randRange(state, 60, 100)))
      break
    case 'scurve':
      addSCurves(state)
      break
    case 'combo':
      addCurve(state, dir * randRange(state, 3, 6 * hard), Math.round(randRange(state, 50, 80)), dir * randRange(state, 200, 700))
      break
  }
  state.lastKind = kind
}

/** Guarantees road built up to (and past) the given segment index. */
export function ensureRoad(state: OutrunState, upToSeg: number): void {
  while (state.segments.length <= upToSeg + DRAW_DIST + 40) appendSection(state)
}

export function segmentAt(state: OutrunState, segIndex: number): RoadSegment {
  ensureRoad(state, segIndex)
  return state.segments[segIndex]
}

// ------------------------------------------------------------------ game

export function createGame(seed = 1986): OutrunState {
  const state: OutrunState = {
    rng: seed | 0,
    segments: [],
    position: 0,
    playerX: 0,
    speed: 0,
    time: START_TIME,
    meters: 0,
    bonus: 0,
    stage: 0,
    nextCheckpointM: CHECKPOINT_M,
    cars: [],
    spawnT: 2,
    nearMisses: 0,
    passes: 0,
    crashes: 0,
    crashT: 0,
    offroad: false,
    status: 'run',
    timeupFired: false,
    lastKind: '',
  }
  buildOpening(state)
  ensureRoad(state, DRAW_DIST + 60)
  return state
}

/** Whole-number score: metres driven plus the bonus pool. */
export function totalScore(state: OutrunState): number {
  return Math.floor(state.meters + state.bonus)
}

/** km/h shown on the speedo. */
export function displaySpeed(state: OutrunState): number {
  return Math.round((state.speed / MAX_SPEED) * 278)
}

function spawnTraffic(state: OutrunState, dt: number): void {
  state.spawnT -= dt
  if (state.spawnT > 0) return
  // Denser traffic as the stages pile on (floored so stage 0 still breathes).
  const gap = Math.max(0.7, 1.7 - state.stage * 0.2)
  state.spawnT = gap + randRange(state, 0, 0.9)
  const playerSeg = Math.floor(state.position / SEG_LEN)
  const ahead = playerSeg + DRAW_DIST + Math.round(randRange(state, 10, 60))
  ensureRoad(state, ahead)
  state.cars.push({
    z: ahead * SEG_LEN,
    offset: randRange(state, -0.85, 0.85),
    speed: MAX_SPEED * randRange(state, 0.24, 0.42),
    color: Math.floor(randRange(state, 0, CAR_COLORS)) % CAR_COLORS,
    counted: false,
  })
}

/**
 * Advances the simulation by dt seconds. Returns the events of this step
 * (crashes, passes, checkpoints, time running out) for HUD/canvas feedback.
 * In demo mode the clock freezes, the car steers itself and traffic is a
 * ghost — the attract loop behind the idle landing.
 */
export function stepGame(state: OutrunState, dt: number, input: OutrunInput, demo = false): OutrunEvent[] {
  const events: OutrunEvent[] = []
  if (dt <= 0 || state.status !== 'run') return events
  const step = Math.min(dt, 0.05)

  const playerSegIndex = Math.floor(state.position / SEG_LEN)
  const playerSegment = segmentAt(state, playerSegIndex)
  const speedRatio = state.speed / MAX_SPEED

  // --- steering (demo: chase the road's own curvature)
  let steer = 0
  let lookCurve = 0
  if (demo) {
    const look = segmentAt(state, playerSegIndex + 18)
    lookCurve = look.curve
    steer = Math.max(-1.6, Math.min(1.6, -state.playerX * 1.2 - look.curve * 0.17))
  } else {
    if (input.left) steer -= 1
    if (input.right) steer += 1
  }
  const dx = step * STEER_SPEED * speedRatio
  state.playerX += steer * dx
  // Centrifugal push flings the car to the outside of bends.
  state.playerX -= dx * speedRatio * playerSegment.curve * CENTRIFUGAL
  state.playerX = Math.max(-2.4, Math.min(2.4, state.playerX))

  // --- speed
  if (state.crashT > 0) {
    state.crashT = Math.max(0, state.crashT - step)
    state.speed += (MAX_SPEED * CRASH_SPEED_FRac - state.speed) * Math.min(1, step * 2.2)
  } else if (!demo && input.brake) {
    state.speed += BRAKE * step
  } else if (demo && Math.abs(lookCurve) > 4.2 && state.speed > MAX_SPEED * 0.55) {
    // The autopilot brakes for hairpins so the attract loop stays on board.
    state.speed += BRAKE * 0.6 * step
  } else {
    state.speed += ACCEL * step
  }
  state.speed -= state.speed * DRAG * step
  // Off the asphalt the car bogs down.
  const off = Math.abs(state.playerX) > 1.02
  if (off !== state.offroad) {
    state.offroad = off
    events.push({ type: 'offroad', on: off })
  }
  if (off && state.speed > OFFROAD_MAX) state.speed += OFFROAD_DECEL * step
  state.speed = Math.max(0, Math.min(MAX_SPEED, state.speed))

  // --- forward
  state.position += state.speed * step
  state.meters += (state.speed * step) / SEG_LEN * M_PER_SEG
  ensureRoad(state, Math.floor(state.position / SEG_LEN))

  // --- traffic
  if (!demo) spawnTraffic(state, step)
  const playerZ = state.position
  const crashZ = playerZ + CAMERA_HEIGHT * (1 / Math.tan(((FIELD_OF_VIEW / 2) * Math.PI) / 180))
  for (const car of state.cars) {
    car.z += car.speed * step
    if (car.counted || car.z > playerZ) continue
    // The car is now behind the camera: the player went past it.
    car.counted = true
    if (state.crashT > 0) continue
    const gap = Math.abs(state.playerX - car.offset)
    if (gap < NEAR_MISS_GAP && state.speed > MAX_SPEED * 0.5) {
      state.nearMisses++
      state.bonus += NEAR_MISS_SCORE
      events.push({ type: 'nearmiss' })
    } else {
      state.passes++
      state.bonus += PASS_SCORE
      events.push({ type: 'pass' })
    }
  }
  // Collisions: anything overlapping the car's nose this step.
  if (!demo && state.crashT <= 0) {
    for (const car of state.cars) {
      const rel = car.z - crashZ
      if (rel < -SEG_LEN || rel > SEG_LEN * 1.5) continue
      if (Math.abs(state.playerX - car.offset) < CRASH_GAP) {
        state.crashes++
        state.crashT = CRASH_TIME
        state.speed = Math.min(state.speed, MAX_SPEED * CRASH_SPEED_FRac + car.speed * 0.4)
        // Shove clear so one shunt is one crash, not a grind.
        state.playerX += state.playerX <= car.offset ? -0.45 : 0.45
        state.playerX = Math.max(-2.2, Math.min(2.2, state.playerX))
        events.push({ type: 'crash' })
        break
      }
    }
  }
  // Prune traffic far behind.
  state.cars = state.cars.filter(c => c.z > playerZ - SEG_LEN * 10)

  // --- clock and checkpoints
  if (!demo) {
    state.time -= step
    while (state.meters >= state.nextCheckpointM) {
      state.nextCheckpointM += CHECKPOINT_M
      state.stage++
      state.time += CHECKPOINT_TIME
      state.bonus += CHECKPOINT_SCORE
      events.push({ type: 'checkpoint', stage: state.stage })
    }
    if (state.time <= 0) {
      state.time = 0
      state.status = 'timeout'
      if (!state.timeupFired) {
        state.timeupFired = true
        events.push({ type: 'timeup' })
      }
    }
  }
  return events
}
