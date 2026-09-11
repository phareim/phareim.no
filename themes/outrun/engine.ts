/**
 * OutRun engine — the whole game as pure, deterministic logic: no DOM,
 * canvas, audio or Vue imports, so `node --test` runs it and the renderer
 * only ever reads the state.
 *
 * The shape of a run (rebuilt 2026-09-11, second version): five stages
 * joined by forks, like the 1986 cabinet. Every stage ends in a Y; the left
 * branch leads to the easier stage, the right one to the harder. Fifteen
 * stages in a pyramid (1 + 2 + 3 + 4 + 5), five of them per run, and a goal
 * at the end of the fifth. The clock is the enemy: 75 s to start, extended
 * at each checkpoint.
 *
 * Coordinates. `position` is the world z of the player's car. Lateral
 * positions are in road half-widths in one global frame: the road centre
 * starts at 0, and every fork moves it by ±FORK_SPLIT, so no coordinate is
 * ever rewritten under the player. A segment carries one road centre, or two
 * inside a fork. Props and traffic are stored as (side, rel): `rel` from the
 * centre of the branch picked by `side`, which is how a fork can drop the
 * branch the player did not take.
 *
 * Driving model, per 1/120 s substep:
 * - throttle through a five-speed automatic box (a short torque dip at each
 *   upshift, which the audio turns into a gear change), drag, braking, and
 *   gravity along the slope, so crests and dips change the speed;
 * - steering is a smoothed input (keys ramp, touch is analog) that moves the
 *   car sideways at a rate that grows with speed;
 * - curves push the car outward with speed²; asking more of the tyres than
 *   GRIP scrubs speed and squeals (the `skid` value drives smoke and audio);
 * - off the asphalt the car bogs down towards OFFROAD_MAX;
 * - traffic is always slower than you: a soft hit is a BUMP (speed matched,
 *   shoved aside), a hard one a SPIN; a roadside prop at speed is a TUMBLE.
 */

// ------------------------------------------------------------ constants

/** World units per road segment. */
export const SEG_LEN = 200
/** Segments the renderer draws ahead of the camera (and the engine keeps built). */
export const DRAW_DIST = 190
/** Road half-width in world units (renderer scale for lateral positions). */
export const ROAD_W = 1800
/** Lane centres, in road half-widths from the branch centre. */
export const LANES = [-0.64, 0, 0.64] as const
/** Distance between road centre and each branch centre at the end of a fork. */
export const FORK_SPLIT = 3.2

/** Top speed, world units per second (60 segments/s). */
export const MAX_SPEED = SEG_LEN * 60
/** What the speedo reads at MAX_SPEED. */
export const KMH_AT_MAX = 293
/** Upshift points as fractions of top speed; five gears. */
export const GEAR_UP = [0.17, 0.35, 0.53, 0.73] as const
/** Peak acceleration per gear, units/s². */
export const GEAR_ACCEL = [5400, 4300, 3400, 2600, 1900] as const
/** Seconds of reduced drive after an upshift. */
export const SHIFT_TIME = 0.16
/** Coasting deceleration: constant plus proportional part. */
export const COAST_DECEL = 500
export const DRAG = 0.02
/** Braking deceleration. */
export const BRAKE_DECEL = 9500
/** Off-road speed cap and how hard the dirt drags the car to it. */
export const OFFROAD_MAX = MAX_SPEED * 0.42
export const OFFROAD_DECEL = 7000
/** Gravity along the slope: units/s² per unit of rise over run. */
export const GRAVITY = 3200
/** What pulls the body back down after a crest (visual only). */
export const AIR_GRAVITY = 9000

/** Lateral speed at full steering lock and full speed, half-widths per second. */
export const STEER_RATE = 2.15
/** How quickly the steering follows the input (per second). */
export const STEER_RAMP = 6
export const STEER_RETURN = 9
/** Outward push in curves, scaled by curve × (speed/top)². */
export const CENTRIFUGAL = 0.27
/** Lateral load above which the tyres let go. */
export const GRIP = 1.35
/** Speed lost per second at full skid. */
export const SKID_SCRUB = 1400

/** Player car half-width and traffic half-widths, in road half-widths. */
export const PLAYER_HALF_W = 0.22
/** Half the length of a car, world units (collision window along z). */
export const CAR_HALF_LEN = 150
/** Relative speed above which hitting a car spins you out instead of bumping. */
export const SPIN_REL = MAX_SPEED * 0.3
/** Seconds of each crash kind. */
export const SPIN_TIME = 1.3
export const TUMBLE_TIME = 2.6
export const BUMP_TIME = 0.35
/** Minimum speed for a roadside prop to wreck the car. */
export const TUMBLE_SPEED = MAX_SPEED * 0.3

/** Segments of stage body, fork and the shared run-in to the next stage. */
export const STAGE_SEGS = 2900
export const FORK_SEGS = 150
export const TRANSITION_SEGS = 240
/** Where the checkpoint gantry stands inside the run-in. */
export const CHECKPOINT_AT = 12
/** Goal gantry position in the final run-out, and the run-out length. */
export const GOAL_AT = 40
export const RUNOUT_SEGS = 600
export const STAGE_COUNT = 5

/** Clock at the start, and the extension at each checkpoint by column. */
export const START_TIME = 75
export const EXTEND_TIME = [0, 65, 64, 63, 62] as const
/** Countdown before GO. */
export const COUNTDOWN = 3

/** Score: points per km/h per second, bonuses. */
export const SCORE_PER_KMH = 10
export const CLOSE_PASS_SCORE = 1000
export const CLOSE_PASS_GAP = 0.62
export const STAGE_SCORE = 50000
export const GOAL_TIME_SCORE = 20000

// --------------------------------------------------------------- stages

export type Biome = 'coast' | 'peaks' | 'mesa' | 'city' | 'canyon' | 'grid'
export type Sky = 'dusk' | 'midnight' | 'ember' | 'teal' | 'rose'

export interface StageDef {
  name: string
  biome: Biome
  sky: Sky
}

/** The pyramid: column k has k + 1 stages. Left keeps the index, right adds one. */
export const STAGES: readonly (readonly StageDef[])[] = [
  [{ name: 'NEON COAST', biome: 'coast', sky: 'dusk' }],
  [{ name: 'PALM VEIL', biome: 'coast', sky: 'rose' }, { name: 'WIRE PEAKS', biome: 'peaks', sky: 'midnight' }],
  [{ name: 'MIRAGE MESA', biome: 'mesa', sky: 'ember' }, { name: 'CHROME CITY', biome: 'city', sky: 'midnight' }, { name: 'GLASS CANYON', biome: 'canyon', sky: 'teal' }],
  [{ name: 'STARLIGHT PIER', biome: 'coast', sky: 'midnight' }, { name: 'MIDNIGHT GRID', biome: 'grid', sky: 'rose' }, { name: 'EMBER DUNES', biome: 'mesa', sky: 'dusk' }, { name: 'AURORA PASS', biome: 'peaks', sky: 'teal' }],
  [{ name: 'SUNSET BOULEVARD', biome: 'city', sky: 'dusk' }, { name: 'LASER LAGOON', biome: 'coast', sky: 'teal' }, { name: 'ELECTRIC DESERT', biome: 'mesa', sky: 'rose' }, { name: 'VAPOR HEIGHTS', biome: 'peaks', sky: 'ember' }, { name: 'AFTERBURN', biome: 'grid', sky: 'ember' }],
]

export function stageDef(col: number, node: number): StageDef {
  return STAGES[col][node]
}

/** 0 for the first stage, rising to the top of the far right: steers curves, traffic, clock. */
export function difficulty(col: number, node: number): number {
  return col * 0.18 + node * 0.12
}

// ---------------------------------------------------------------- props

/** Roadside prop kinds. The renderer draws them; `w` is the collision half-width. */
export const PROP = {
  palm: { w: 0.16, solid: true },
  lamp: { w: 0.08, solid: true },
  billboard: { w: 0.42, solid: true },
  rock: { w: 0.34, solid: true },
  pine: { w: 0.2, solid: true },
  cactus: { w: 0.14, solid: true },
  spire: { w: 0.22, solid: true },
  pylon: { w: 0.08, solid: true },
  tower: { w: 0.6, solid: true },
  hut: { w: 0.36, solid: true },
  gore: { w: 0.4, solid: true },
  chevron: { w: 0.12, solid: true },
  arch: { w: 0, solid: false },
  gantry: { w: 0, solid: false },
} as const

export type PropKind = keyof typeof PROP

export interface RoadProp {
  kind: PropKind
  /** -1 left branch, 1 right branch, 0 the midpoint between them (single road: ignored). */
  side: -1 | 0 | 1
  /** Half-widths from that centre. */
  rel: number
  /** Per-prop variation for the renderer (0..1). */
  v: number
  /** Gantry/billboard/gore text. */
  label?: string
}

export interface RoadSegment {
  index: number
  /** Bend, -7..7; positive bends right. */
  curve: number
  /** World height at the segment's near edge. */
  y: number
  /** Road centres: one, or two inside a fork. */
  centers: number[]
  props: RoadProp[]
  /** Stage (col, node) this segment belongs to, and palette blend from the previous stage. */
  col: number
  node: number
  fromNode: number
  blend: number
  /** Segment role, for gantries and triggers. */
  tag?: 'start' | 'fork-decide' | 'checkpoint' | 'goal'
}

// -------------------------------------------------------------- traffic

export const TRAFFIC_KINDS = [
  { name: 'sedan', halfW: 0.21, speed: [0.3, 0.46] },
  { name: 'truck', halfW: 0.27, speed: [0.24, 0.36] },
  { name: 'bug', halfW: 0.17, speed: [0.32, 0.5] },
  { name: 'coupe', halfW: 0.2, speed: [0.42, 0.58] },
] as const

export interface TrafficCar {
  id: number
  z: number
  /** Branch side (used while the road is forked) and lateral offset from that branch centre. */
  side: -1 | 1
  rel: number
  targetRel: number
  laneT: number
  speed: number
  kind: number
  paint: number
  passed: boolean
}

// ---------------------------------------------------------------- state

export interface OutrunInput {
  /** -1..1; keyboard sends ±1 and the engine smooths it. */
  steer: number
  gas: boolean
  brake: boolean
}

export type CrashKind = 'bump' | 'spin' | 'tumble'

export type OutrunEvent =
  | { type: 'countdown', n: number }
  | { type: 'go' }
  | { type: 'shift', gear: number }
  | { type: 'crash', kind: CrashKind }
  | { type: 'close' }
  | { type: 'fork', side: -1 | 1, col: number, node: number }
  | { type: 'checkpoint', col: number, node: number, extend: number }
  | { type: 'offroad', on: boolean }
  | { type: 'timeup' }
  | { type: 'goal', timeBonus: number }
  | { type: 'warn', n: number }

export type Status = 'countdown' | 'run' | 'timeout' | 'goal'

/** What a finished run hands to the landing. */
export interface OutrunResult {
  score: number
  reason: 'timeup' | 'goal' | 'quit'
  route: string[]
  stage: number
}

export interface OutrunState {
  seed: number
  rng: number
  status: Status
  /** Seconds left in the countdown (status 'countdown'). */
  countdown: number
  segments: RoadSegment[]
  /** World z of the player's car. */
  position: number
  playerX: number
  /** Smoothed steering, -1..1, and its visual echo (for the car's yaw). */
  steer: number
  speed: number
  gear: number
  shiftT: number
  /** 0..1 engine revs within the gear, for the tacho and the engine note. */
  rpm: number
  throttle: number
  skid: number
  offroad: boolean
  /** The car body's height and vertical speed: it leaves the road over sharp crests (visual only). */
  bodyY: number
  bodyVy: number
  crash: { kind: CrashKind, t: number, dur: number, dir: number } | null
  time: number
  score: number
  /** Current stage column and node; `route` holds the node of each column visited. */
  col: number
  node: number
  route: number[]
  /** Road centre of the current (single) road, global frame. */
  base: number
  /** Index where the current fork's decision happens (-1 when none pending). */
  forkDecide: number
  forkZoneStart: number
  forkZoneEnd: number
  /** Segment index of the next checkpoint gantry (-1 until a fork is decided) and of the goal. */
  checkpointAt: number
  goalAt: number
  cars: TrafficCar[]
  nextCarId: number
  spawnT: number
  closes: number
  crashes: number
  /** Last whole second announced by the low-time warning. */
  warned: number
  goalBonus: number
}

// ------------------------------------------------------------------ RNG

/** mulberry32 — small, seedable, plenty for road generation. */
export function nextRandom(rng: number): { value: number, rng: number } {
  const a = (rng + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, rng: a }
}

function rand(state: OutrunState, lo = 0, hi = 1): number {
  const r = nextRandom(state.rng)
  state.rng = r.rng
  return lo + r.value * (hi - lo)
}

function pick<T>(state: OutrunState, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(rand(state) * items.length))]
}

// ---------------------------------------------------------------- track

const easeIn = (a: number, b: number, t: number) => a + (b - a) * t * t
const easeInOut = (a: number, b: number, t: number) => a + (b - a) * (0.5 - Math.cos(t * Math.PI) / 2)
export const smoothstep = (t: number) => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)

function lastY(state: OutrunState): number {
  const n = state.segments.length
  return n === 0 ? 0 : state.segments[n - 1].y
}

function addSegment(state: OutrunState, curve: number, y: number, centers?: number[]): RoadSegment {
  const seg: RoadSegment = {
    index: state.segments.length,
    curve,
    y,
    centers: centers ?? [state.base],
    props: [],
    col: state.col,
    node: state.node,
    fromNode: state.node,
    blend: 1,
  }
  state.segments.push(seg)
  return seg
}

/** A road section: ease into the curve, hold it, ease out, while the height eases by dy. */
function addRoad(state: OutrunState, enter: number, hold: number, leave: number, curve: number, dy: number): void {
  const y0 = lastY(state)
  const total = enter + hold + leave
  for (let n = 0; n < enter; n++) addSegment(state, easeIn(0, curve, n / enter), easeInOut(y0, y0 + dy, n / total))
  for (let n = 0; n < hold; n++) addSegment(state, curve, easeInOut(y0, y0 + dy, (enter + n) / total))
  for (let n = 0; n < leave; n++) addSegment(state, easeInOut(curve, 0, n / leave), easeInOut(y0, y0 + dy, (enter + hold + n) / total))
}

/** Hill character per biome: [min, max] rise of one section. */
const BIOME_HILLS: Record<Biome, [number, number]> = {
  coast: [300, 1400],
  peaks: [900, 3000],
  mesa: [200, 1200],
  city: [0, 700],
  canyon: [600, 2200],
  grid: [400, 2600],
}

/** Builds one stage body: STAGE_SEGS segments of curves, hills and straights. */
function buildStageBody(state: OutrunState): void {
  const def = stageDef(state.col, state.node)
  const diff = difficulty(state.col, state.node)
  const [hLo, hHi] = BIOME_HILLS[def.biome]
  const start = state.segments.length
  const end = start + STAGE_SEGS - 120
  const maxCurve = 3 + diff * 5
  let last = ''
  // The first stage opens on a long straight behind the start gantry.
  if (state.col === 0) addRoad(state, 10, 90, 10, 0, 0)
  else addRoad(state, 20, 40, 20, 0, rand(state, -hLo, hLo))
  while (state.segments.length < end) {
    let kind = pick(state, ['curve', 'curve', 'hill', 'scurve', 'sweeper', 'straight', 'crest'] as const)
    if (kind === last) kind = pick(state, ['curve', 'hill', 'scurve', 'sweeper'] as const)
    last = kind
    const dir = rand(state) < 0.5 ? -1 : 1
    const rise = () => (rand(state) < 0.5 ? -1 : 1) * rand(state, hLo, hHi)
    switch (kind) {
      case 'straight':
        addRoad(state, 20, Math.round(rand(state, 30, 70)), 20, 0, rise() * 0.4)
        break
      case 'curve':
        addRoad(state, Math.round(rand(state, 25, 45)), Math.round(rand(state, 30, 80)), Math.round(rand(state, 25, 45)), dir * rand(state, 2, maxCurve), rise() * 0.5)
        break
      case 'sweeper':
        addRoad(state, 50, Math.round(rand(state, 80, 140)), 50, dir * rand(state, 1.5, 3), rise())
        break
      case 'hill':
        addRoad(state, 30, Math.round(rand(state, 20, 50)), 30, 0, rise() * 1.4)
        break
      case 'crest': {
        const up = rand(state, hLo, hHi) + 400
        addRoad(state, 30, 10, 30, 0, up)
        addRoad(state, 30, 10, 30, dir * rand(state, 0, maxCurve * 0.6), -up)
        break
      }
      case 'scurve': {
        const c = rand(state, 2.5, maxCurve)
        const len = Math.round(rand(state, 30, 45))
        addRoad(state, len, len, len, dir * c, rise() * 0.3)
        addRoad(state, len, len, len, -dir * c, rise() * 0.3)
        break
      }
    }
  }
  // Settle before the fork or goal: a straight that levels out.
  const y0 = lastY(state)
  const remain = Math.max(60, start + STAGE_SEGS - state.segments.length)
  // Easing part of the height back keeps altitude from drifting run after run.
  for (let n = 0; n < remain; n++) addSegment(state, 0, easeInOut(y0, y0 * 0.6, n / remain))
  decorate(state, start, state.segments.length, def.biome)
}

/** Roadside dressing for a stretch, per biome. Props never sit on the asphalt. */
function decorate(state: OutrunState, from: number, to: number, biome: Biome): void {
  const put = (i: number, kind: PropKind, rel: number, label?: string) => {
    const seg = state.segments[i]
    if (seg) seg.props.push({ kind, side: rel < 0 ? -1 : 1, rel, v: rand(state), label })
  }
  const sideOf = (i: number) => (i % 2 === 0 ? -1 : 1)
  for (let i = from + 20; i < to - 10; i++) {
    const s = sideOf(Math.floor(i / 7))
    const r = rand(state)
    switch (biome) {
      case 'coast':
        if (i % 9 === 0) put(i, 'palm', s * rand(state, 1.45, 2.1))
        if (i % 13 === 0) put(i, 'palm', -s * rand(state, 1.7, 3))
        if (i % 97 === 0) put(i, 'billboard', s * 2.1, pick(state, BILLBOARD_TEXT))
        if (i % 61 === 0 && r < 0.6) put(i, 'hut', -s * rand(state, 2.2, 3))
        break
      case 'peaks':
        if (i % 5 === 0) put(i, 'pine', sideOf(i) * rand(state, 1.35, 3.2))
        if (i % 17 === 0 && r < 0.7) put(i, 'rock', s * rand(state, 1.5, 2.6))
        if (i % 24 === 0) put(i, 'pylon', 1.25 * s)
        break
      case 'mesa':
        if (i % 11 === 0) put(i, 'cactus', s * rand(state, 1.35, 2.6))
        if (i % 23 === 0) put(i, 'rock', -s * rand(state, 1.5, 3))
        if (i % 89 === 0) put(i, 'billboard', -s * 2.1, pick(state, BILLBOARD_TEXT))
        break
      case 'city':
        if (i % 8 === 0) { put(i, 'lamp', -1.22); put(i, 'lamp', 1.22) }
        if (i % 3 === 0) put(i, 'tower', sideOf(i / 3) * rand(state, 2.4, 4.5))
        if (i % 53 === 0) put(i, 'billboard', s * 1.9, pick(state, BILLBOARD_TEXT))
        break
      case 'canyon':
        if (i % 4 === 0) put(i, 'spire', sideOf(i / 4) * rand(state, 1.4, 3.4))
        if (i % 19 === 0) put(i, 'rock', s * rand(state, 1.45, 2.2))
        break
      case 'grid':
        if (i % 5 === 0) { put(i, 'pylon', -1.25); put(i, 'pylon', 1.25) }
        if (i % 45 === 0) put(i, 'arch', 0)
        if (i % 71 === 0) put(i, 'billboard', s * 2.1, pick(state, BILLBOARD_TEXT))
        break
    }
  }
}

export const BILLBOARD_TEXT = ['NEON DREAMS', 'TURBO', 'NIGHT DRIVE', 'HIGH SCORE', 'INSERT COIN', 'SLIPSTREAM', 'MAGNETIC', 'PHAREIM.NO'] as const

/** The Y at the end of a stage: two branches drift apart, then a shared run-in. */
function buildFork(state: OutrunState): void {
  const b = state.base
  const y0 = lastY(state)
  state.forkZoneStart = state.segments.length
  state.forkDecide = -1
  const nextColEarly = state.col + 1
  const board = state.segments[state.forkZoneStart - 45]
  if (board) board.props.push({ kind: 'gantry', side: 1, rel: 0, v: 0, label: `${stageDef(nextColEarly, state.node).name}|${stageDef(nextColEarly, state.node + 1).name}` })
  const nextCol = state.col + 1
  const leftName = stageDef(nextCol, state.node).name
  const rightName = stageDef(nextCol, state.node + 1).name
  let gorePlaced = false
  for (let n = 0; n < FORK_SEGS; n++) {
    const s = FORK_SPLIT * smoothstep(n / (FORK_SEGS * 0.8))
    const seg = addSegment(state, 0, y0, s < 0.001 ? [b] : [b - s, b + s])
    // Decide once the branches no longer touch: inner edges apart.
    if (state.forkDecide < 0 && s >= 1.25) {
      state.forkDecide = seg.index
      seg.tag = 'fork-decide'
    }
    // The gore: a sign where the median opens, then chevrons down its middle.
    if (s >= 0.55 && !gorePlaced) {
      gorePlaced = true
      seg.props.push({ kind: 'gore', side: 0, rel: 0, v: 0, label: `${leftName}|${rightName}` })
    } else if (s > 1.3 && n % 6 === 0) {
      seg.props.push({ kind: 'chevron', side: 0, rel: 0, v: 0 })
    }
    if (n % 10 === 0) {
      seg.props.push({ kind: 'lamp', side: -1, rel: -1.22, v: 0 })
      seg.props.push({ kind: 'lamp', side: 1, rel: 1.22, v: 0 })
    }
  }
  state.forkZoneEnd = state.segments.length
  // Shared run-in, both branches still drawn until the decision rewrites it.
  for (let n = 0; n < TRANSITION_SEGS; n++) {
    const seg = addSegment(state, 0, y0, [b - FORK_SPLIT, b + FORK_SPLIT])
    if (n === CHECKPOINT_AT) {
      seg.tag = 'checkpoint'
      seg.props.push({ kind: 'gantry', side: -1, rel: 0, v: 0, label: leftName })
      seg.props.push({ kind: 'gantry', side: 1, rel: 0, v: 0, label: rightName })
    }
    if (n % 10 === 5) {
      for (const side of [-1, 1] as const) {
        seg.props.push({ kind: 'lamp', side, rel: -1.22, v: 0 })
        seg.props.push({ kind: 'lamp', side, rel: 1.22, v: 0 })
      }
    }
  }
}

/** After the fifth stage: the goal gantry and a long run-out. */
function buildGoal(state: OutrunState): void {
  const y0 = lastY(state)
  for (let n = 0; n < RUNOUT_SEGS; n++) {
    const seg = addSegment(state, n > 200 ? 1.2 * Math.sin(n / 60) : 0, y0)
    if (n === GOAL_AT) {
      seg.tag = 'goal'
      state.goalAt = seg.index
      seg.props.push({ kind: 'gantry', side: 1, rel: 0, v: 0, label: 'GOAL' })
    }
    if (n % 6 === 0) {
      seg.props.push({ kind: 'palm', side: -1, rel: -1.4, v: rand(state) })
      seg.props.push({ kind: 'palm', side: 1, rel: 1.4, v: rand(state) })
    }
  }
}

/** Stage body plus what follows it (fork, or the goal after the last column). */
function buildStage(state: OutrunState): void {
  buildStageBody(state)
  if (state.col < STAGE_COUNT - 1) buildFork(state)
  else {
    state.forkDecide = -1
    buildGoal(state)
  }
}

/** Resolves a (side, rel) placement to the global frame on one segment. */
export function worldX(seg: RoadSegment, side: -1 | 0 | 1, rel: number): number {
  const c = seg.centers
  if (c.length === 1) return c[0] + rel
  if (side === 0) return (c[0] + c[1]) / 2 + rel
  return (side < 0 ? c[0] : c[1]) + rel
}

export function segmentAt(state: OutrunState, z: number): RoadSegment {
  const i = Math.max(0, Math.min(state.segments.length - 1, Math.floor(z / SEG_LEN)))
  return state.segments[i]
}

/** Road height at an exact z (interpolated between segment edges). */
export function roadY(state: OutrunState, z: number): number {
  const i = Math.floor(z / SEG_LEN)
  const a = state.segments[Math.max(0, Math.min(state.segments.length - 1, i))]
  const b = state.segments[Math.max(0, Math.min(state.segments.length - 1, i + 1))]
  const t = z / SEG_LEN - i
  return a.y + (b.y - a.y) * t
}

// ----------------------------------------------------------------- game

export function createGame(seed = 1986, opts: { countdown?: boolean, col?: number, node?: number } = {}): OutrunState {
  const col = Math.max(0, Math.min(STAGE_COUNT - 1, opts.col ?? 0))
  const node = Math.max(0, Math.min(col, opts.node ?? 0))
  const state: OutrunState = {
    seed,
    rng: seed | 0,
    status: opts.countdown === false ? 'run' : 'countdown',
    countdown: COUNTDOWN,
    segments: [],
    position: SEG_LEN * 4,
    playerX: 0,
    steer: 0,
    speed: 0,
    gear: 0,
    shiftT: 0,
    rpm: 0,
    throttle: 0,
    skid: 0,
    offroad: false,
    bodyY: 0,
    bodyVy: 0,
    crash: null,
    time: START_TIME,
    score: 0,
    col,
    node,
    // A start further up the pyramid (tests, previews) gets a plausible route behind it.
    route: Array.from({ length: col + 1 }, (_, c) => Math.max(0, node - (col - c))),
    base: 0,
    forkDecide: -1,
    forkZoneStart: -1,
    forkZoneEnd: -1,
    checkpointAt: -1,
    goalAt: -1,
    cars: [],
    nextCarId: 1,
    spawnT: 0,
    closes: 0,
    crashes: 0,
    warned: 11,
    goalBonus: 0,
  }
  buildStage(state)
  // The start gantry, just ahead of the grid slot.
  const startSeg = state.segments[12]
  startSeg.tag = 'start'
  startSeg.props.push({ kind: 'gantry', side: 1, rel: 0, v: 0, label: 'START' })
  // Some traffic already out on the road.
  for (let i = 0; i < 6; i++) spawnCar(state, state.position + SEG_LEN * (40 + i * 28 + rand(state, 0, 12)))
  return state
}

/** km/h on the speedo. */
export function displaySpeed(state: OutrunState): number {
  return Math.round((state.speed / MAX_SPEED) * KMH_AT_MAX)
}

/** Whole-number score. */
export function totalScore(state: OutrunState): number {
  return Math.floor(state.score)
}

/** Fraction of the whole five-stage course covered, 0..1. */
export function courseProgress(state: OutrunState): number {
  const stageLen = STAGE_SEGS + FORK_SEGS + TRANSITION_SEGS
  const seg = state.position / SEG_LEN
  return Math.max(0, Math.min(1, seg / (stageLen * (STAGE_COUNT - 1) + STAGE_SEGS)))
}

function gearFor(ratio: number, current: number): number {
  let g = current
  while (g < GEAR_UP.length && ratio > GEAR_UP[g]) g++
  while (g > 0 && ratio < GEAR_UP[g - 1] - 0.05) g--
  return g
}

/** Revs within the current gear, 0.3..1. */
function rpmFor(ratio: number, gear: number): number {
  const lo = gear === 0 ? 0 : GEAR_UP[gear - 1] - 0.05
  const hi = gear < GEAR_UP.length ? GEAR_UP[gear] : 1.02
  return 0.3 + 0.7 * Math.max(0, Math.min(1, (ratio - lo) / (hi - lo)))
}

function spawnCar(state: OutrunState, z: number): void {
  const seg = segmentAt(state, z)
  if (!seg || seg.tag === 'goal' || seg.index >= state.segments.length - 20) return
  const diff = difficulty(state.col, state.node)
  const kind = rand(state) < 0.16 + diff * 0.1 ? 1 : Math.floor(rand(state, 0, TRAFFIC_KINDS.length))
  const k = TRAFFIC_KINDS[kind]
  const lane = pick(state, LANES)
  // Do not stack a new car on top of one already in that lane.
  for (const c of state.cars) {
    if (Math.abs(c.z - z) < SEG_LEN * 6 && Math.abs(c.rel - lane) < 0.3) return
  }
  state.cars.push({
    id: state.nextCarId++,
    z,
    side: rand(state) < 0.5 ? -1 : 1,
    rel: lane,
    targetRel: lane,
    laneT: rand(state, 2, 8),
    speed: MAX_SPEED * rand(state, k.speed[0], k.speed[1]),
    kind,
    paint: Math.floor(rand(state, 0, 4)),
    passed: false,
  })
}

/** Keeps traffic density ahead of the car; denser on harder stages. */
function updateTrafficSpawns(state: OutrunState, dt: number): void {
  state.spawnT -= dt
  if (state.spawnT > 0) return
  const diff = difficulty(state.col, state.node)
  state.spawnT = Math.max(0.5, 1.5 - diff * 0.9) * rand(state, 0.6, 1.4)
  spawnCar(state, state.position + SEG_LEN * (DRAW_DIST + rand(state, 0, 30)))
}

/** The player's road centre: nearest branch centre on the car's segment. */
export function nearestCenter(seg: RoadSegment, x: number): number {
  let best = seg.centers[0]
  for (const c of seg.centers) if (Math.abs(c - x) < Math.abs(best - x)) best = c
  return best
}

/**
 * The simple driver behind the attract loop and the goal run-out: picks the
 * lane with the most room ahead, leans into curves, lifts for hairpins.
 */
export function autopilot(state: OutrunState): OutrunInput {
  const seg = segmentAt(state, state.position)
  // Near a fork, pick a side (fixed per run and column) and drive to it.
  const forking = state.forkDecide >= 0 && seg.index >= state.forkZoneStart - 40
  const prefer: -1 | 1 = (state.seed + state.col) % 2 === 0 ? -1 : 1
  const center = forking && seg.centers.length === 2 ? seg.centers[prefer < 0 ? 0 : 1] : nearestCenter(seg, state.playerX)
  // Room per lane, in seconds until we would reach the first car in it.
  const HORIZON = 3
  const room = LANES.map(lane => {
    const x = center + lane
    let r = HORIZON
    for (const car of state.cars) {
      const dz = car.z - state.position
      if (dz < -CAR_HALF_LEN * 2) continue
      const cs = segmentAt(state, car.z)
      const cx = worldX(cs, car.side, car.rel)
      const tx = worldX(cs, car.side, car.targetRel)
      if (Math.abs(cx - x) >= 0.55 && Math.abs(tx - x) >= 0.55) continue
      const ttc = Math.max(0, dz - CAR_HALF_LEN * 2) / Math.max(200, state.speed - car.speed)
      r = Math.min(r, ttc)
    }
    return r
  })
  let cur = 0
  for (let i = 1; i < LANES.length; i++) {
    if (Math.abs(center + LANES[i] - state.playerX) < Math.abs(center + LANES[cur] - state.playerX)) cur = i
  }
  // Stay put while the lane is clear; otherwise take the roomiest lane that
  // can be reached without cutting across a car.
  let best = cur
  if (forking && seg.centers.length === 1) {
    // Before the split: move to the lane on the chosen side when it is clear.
    const want = prefer < 0 ? 0 : LANES.length - 1
    if (room[want] > 1.2 && (want === cur || room[1] > 0.8)) best = want
  } else if (room[cur] < HORIZON) {
    for (let i = 0; i < LANES.length; i++) {
      const lo = Math.min(i, cur)
      const hi = Math.max(i, cur)
      let clear = true
      for (let j = lo; j <= hi; j++) if (j !== cur && room[j] < 0.7) clear = false
      if (clear && room[i] > room[best] + 0.3) best = i
    }
  }
  const bestLane = LANES[best]
  const targetX = center + bestLane
  const ratio = state.speed / MAX_SPEED
  const ahead = segmentAt(state, state.position + SEG_LEN * 12)
  const lean = (seg.curve * ratio * ratio * CENTRIFUGAL) / Math.max(0.2, STEER_RATE * Math.min(1, ratio / 0.35))
  const steer = Math.max(-1, Math.min(1, (targetX - state.playerX) * 2.2 + lean))
  const blocked = room[best] < 0.6 && ratio > 0.3
  const brake = blocked || (Math.abs(ahead.curve) > 4.8 && ratio > 0.78)
  return { steer, gas: !brake, brake }
}

/** Stage extension for the column just entered. */
export function extendFor(col: number): number {
  return EXTEND_TIME[Math.min(col, EXTEND_TIME.length - 1)]
}

/**
 * Advances the game by dt seconds (split into 1/120 s substeps). Returns the
 * events of this step. `demo` freezes the clock and suppresses scoring — the
 * attract loop; `input` is ignored while a crash animation runs.
 */
export function stepGame(state: OutrunState, dt: number, input: OutrunInput, demo = false): OutrunEvent[] {
  const events: OutrunEvent[] = []
  if (dt <= 0) return events
  let left = Math.min(dt, 0.1)
  while (left > 1e-6) {
    const h = Math.min(left, 1 / 120)
    substep(state, h, input, demo, events)
    left -= h
  }
  return events
}

function substep(state: OutrunState, dt: number, input: OutrunInput, demo: boolean, events: OutrunEvent[]): void {
  // ---- countdown: revs only
  if (state.status === 'countdown') {
    const before = Math.ceil(state.countdown)
    state.countdown -= dt
    state.throttle += ((input.gas ? 1 : 0) - state.throttle) * Math.min(1, dt * 10)
    state.rpm += ((input.gas ? 0.95 : 0.3) - state.rpm) * Math.min(1, dt * 5)
    const after = Math.ceil(state.countdown)
    if (after !== before && after > 0) events.push({ type: 'countdown', n: after })
    if (state.countdown <= 0) {
      state.status = 'run'
      events.push({ type: 'go' })
    }
    moveTraffic(state, dt)
    return
  }

  const finished = state.status === 'timeout' || state.status === 'goal'
  // After TIME UP the car rolls to a stop; after the goal it cruises on autopilot.
  const control: OutrunInput = state.status === 'timeout'
    ? { steer: 0, gas: false, brake: false }
    : state.status === 'goal' ? autopilot(state) : input

  const ratio0 = state.speed / MAX_SPEED
  const seg = segmentAt(state, state.position)
  const crash = state.crash

  // ---- steering (smoothed)
  const target = crash ? 0 : Math.max(-1, Math.min(1, control.steer))
  const rate = Math.abs(target) > Math.abs(state.steer) && Math.sign(target) === Math.sign(state.steer || target) ? STEER_RAMP : STEER_RETURN
  state.steer += Math.max(-rate * dt, Math.min(rate * dt, target - state.steer))

  // ---- lateral
  const grip = state.offroad ? 0.8 : 1
  const steerAuth = Math.min(1, ratio0 / 0.35)
  const steerMove = state.steer * STEER_RATE * steerAuth * grip
  const push = seg.curve * ratio0 * ratio0 * CENTRIFUGAL
  let lateral = steerMove - push
  // Tyres: lateral load beyond grip slides and scrubs speed.
  const load = Math.abs(state.steer) * ratio0 * 0.9 + Math.abs(seg.curve) * ratio0 * ratio0 * 0.3
  const skidTarget = !crash && !state.offroad && ratio0 > 0.45 ? Math.max(0, Math.min(1, (load - GRIP * 0.72) / (GRIP * 0.5))) : 0
  state.skid += (skidTarget - state.skid) * Math.min(1, dt * 8)
  // A sliding car answers the wheel less and runs wide.
  if (state.skid > 0.05) lateral = steerMove * (1 - state.skid * 0.25) - push
  if (crash?.kind === 'bump') lateral = crash.dir * 2.2 * (crash.t / crash.dur)
  if (crash?.kind === 'spin') lateral = crash.dir * 0.8 * ratio0
  if (crash?.kind === 'tumble') lateral = crash.dir * 0.5 * ratio0
  state.playerX += lateral * dt
  const lo = Math.min(...seg.centers) - 2.7
  const hi = Math.max(...seg.centers) + 2.7
  state.playerX = Math.max(lo, Math.min(hi, state.playerX))

  // ---- off-road
  const center = nearestCenter(seg, state.playerX)
  const off = Math.abs(state.playerX - center) > 1.03
  if (off !== state.offroad) {
    state.offroad = off
    events.push({ type: 'offroad', on: off })
  }

  // ---- longitudinal
  const gas = !crash && !finished && control.gas && !control.brake
  const cruise = state.status === 'goal' && control.gas
  state.throttle += ((gas || cruise ? 1 : 0) - state.throttle) * Math.min(1, dt * 8)
  let accel = 0
  if (crash) {
    const k = crash.kind === 'tumble' ? 3.2 : crash.kind === 'spin' ? 0.7 : 0.4
    accel = -state.speed * k
  } else {
    if (gas || cruise) {
      const g = GEAR_ACCEL[state.gear]
      const fade = 1 - Math.pow(ratio0, 3) * 0.85
      accel += g * fade * (state.shiftT > 0 ? 0.35 : 1) * (cruise ? 0.5 : 1)
    }
    if (control.brake && !finished) accel -= BRAKE_DECEL
    accel -= COAST_DECEL * (gas ? 0.2 : 1) + state.speed * DRAG
    if (state.offroad && state.speed > OFFROAD_MAX) accel -= OFFROAD_DECEL
    if (state.offroad) accel -= state.speed * 0.25
    accel -= state.skid * SKID_SCRUB
    if (state.status === 'timeout') accel -= 2200
  }
  // Gravity along the slope.
  const next = state.segments[Math.min(state.segments.length - 1, seg.index + 1)]
  const slope = (next.y - seg.y) / SEG_LEN
  accel -= slope * GRAVITY
  state.speed = Math.max(0, Math.min(MAX_SPEED * 1.04, state.speed + accel * dt))
  if (state.speed < 30 && !gas) state.speed = Math.max(0, state.speed - 50 * dt)

  // ---- gearbox
  const ratio = state.speed / MAX_SPEED
  const gear = gearFor(ratio, state.gear)
  if (gear > state.gear) {
    state.shiftT = SHIFT_TIME
    events.push({ type: 'shift', gear })
  } else if (gear < state.gear) {
    events.push({ type: 'shift', gear })
  }
  state.gear = gear
  state.shiftT = Math.max(0, state.shiftT - dt)
  const rpmTarget = rpmFor(ratio, gear) * (state.shiftT > 0 ? 0.82 : 1)
  state.rpm += (rpmTarget - state.rpm) * Math.min(1, dt * 14)

  // ---- forward; the body keeps its vertical speed over a crest and falls back
  const prevY = roadY(state, state.position)
  state.position += state.speed * dt
  const nowY = roadY(state, state.position)
  const roadVy = (nowY - prevY) / dt
  if (state.bodyY <= prevY + 0.5) {
    state.bodyY = nowY
    state.bodyVy = roadVy
  } else {
    state.bodyVy -= AIR_GRAVITY * dt
    state.bodyY += state.bodyVy * dt
    if (state.bodyY <= nowY) {
      state.bodyY = nowY
      state.bodyVy = roadVy
    }
  }

  // ---- crash timer
  if (crash) {
    crash.t += dt
    if (crash.t >= crash.dur) {
      if (crash.kind === 'tumble') {
        // Back on the asphalt, nearest lane, from standstill.
        const s = segmentAt(state, state.position)
        const c = nearestCenter(s, state.playerX)
        state.playerX = c + Math.max(-0.64, Math.min(0.64, state.playerX - c))
        state.speed = 0
        state.gear = 0
      }
      state.crash = null
    }
  }

  // ---- stage triggers
  const segNow = segmentAt(state, state.position)
  if (state.forkDecide >= 0 && segNow.index >= state.forkDecide) decideFork(state, events)
  if (state.checkpointAt >= 0 && segNow.index >= state.checkpointAt) enterStage(state, state.segments[state.checkpointAt], events, demo)
  if (state.goalAt >= 0 && segNow.index >= state.goalAt && state.status === 'run') {
    state.status = 'goal'
    if (!demo) {
      state.goalBonus = Math.ceil(state.time) * GOAL_TIME_SCORE
      state.score += state.goalBonus + STAGE_SCORE
    }
    events.push({ type: 'goal', timeBonus: state.goalBonus })
  }

  // ---- traffic
  moveTraffic(state, dt)
  if (state.status === 'run' || state.status === 'goal') updateTrafficSpawns(state, dt)
  if (!crash && state.status !== 'goal') collide(state, events, demo)

  // ---- clock and score
  if (!demo && state.status === 'run') {
    state.time -= dt
    state.score += displaySpeed(state) * SCORE_PER_KMH * dt
    const whole = Math.ceil(state.time)
    if (whole <= 10 && whole < state.warned && whole > 0) {
      state.warned = whole
      events.push({ type: 'warn', n: whole })
    }
    if (state.time <= 0) {
      state.time = 0
      state.status = 'timeout'
      events.push({ type: 'timeup' })
    }
  }
}

/** The player passed the point of no return in a fork: keep one branch. */
function decideFork(state: OutrunState, events: OutrunEvent[]): void {
  const mid = state.base
  const side: -1 | 1 = state.playerX < mid ? -1 : 1
  const newBase = mid + side * FORK_SPLIT
  const nextNode = state.node + (side < 0 ? 0 : 1)
  const nextCol = state.col + 1
  // Rewrite the run-in: one road, the chosen branch's props, a palette blend.
  for (let i = state.forkZoneEnd; i < state.segments.length; i++) {
    const seg = state.segments[i]
    seg.centers = [newBase]
    seg.props = seg.props.filter(p => p.side === side).map(p => ({ ...p, side: 1 as const }))
    seg.col = nextCol
    seg.fromNode = state.node
    seg.node = nextNode
    seg.blend = smoothstep((i - state.forkZoneEnd) / TRANSITION_SEGS)
  }
  // Traffic beyond the fork on the other branch is gone; in the zone it drives on.
  state.cars = state.cars.filter(c => c.z < state.forkZoneEnd * SEG_LEN || c.side === side)
  for (const c of state.cars) if (c.z >= state.forkZoneEnd * SEG_LEN) c.side = 1
  state.forkDecide = -1
  state.checkpointAt = state.forkZoneEnd + CHECKPOINT_AT
  events.push({ type: 'fork', side, col: nextCol, node: nextNode })
  // Build the next stage onto the end of the run-in.
  const prevCol = state.col
  const prevNode = state.node
  state.base = newBase
  state.col = nextCol
  state.node = nextNode
  buildStage(state)
  // The live stage (clock, score, HUD) switches at the checkpoint gantry.
  state.col = prevCol
  state.node = prevNode
}

function enterStage(state: OutrunState, seg: RoadSegment, events: OutrunEvent[], demo: boolean): void {
  state.checkpointAt = -1
  state.col = seg.col
  state.node = seg.node
  state.route.push(seg.node)
  const extend = extendFor(seg.col)
  if (!demo) {
    state.time += extend
    state.score += STAGE_SCORE
  }
  state.warned = 11
  events.push({ type: 'checkpoint', col: seg.col, node: seg.node, extend })
}

function moveTraffic(state: OutrunState, dt: number): void {
  for (const car of state.cars) {
    car.z += car.speed * dt
    car.laneT -= dt
    // Only cars well ahead change lanes, so the one in front of you stays readable.
    if (car.laneT <= 0 && car.z - state.position > SEG_LEN * 18) {
      const diff = difficulty(state.col, state.node)
      car.laneT = Math.max(1.5, 6 - diff * 4) * (0.6 + ((car.id * 7919) % 100) / 100)
      const i = LANES.indexOf(car.targetRel as typeof LANES[number])
      const j = Math.max(0, Math.min(2, (i < 0 ? 1 : i) + (((car.id + Math.floor(car.z)) & 1) ? 1 : -1)))
      car.targetRel = LANES[j]
    }
    const d = car.targetRel - car.rel
    car.rel += Math.sign(d) * Math.min(Math.abs(d), 0.55 * dt)
  }
  state.cars = state.cars.filter(c => c.z > state.position - SEG_LEN * 3 && c.z < state.segments.length * SEG_LEN - SEG_LEN * 4)
}

function collide(state: OutrunState, events: OutrunEvent[], demo: boolean): void {
  const seg = segmentAt(state, state.position)
  // Traffic.
  for (const car of state.cars) {
    const dz = car.z - state.position
    const cseg = segmentAt(state, car.z)
    const cx = worldX(cseg, car.side, car.rel)
    const gap = Math.abs(cx - state.playerX)
    const reach = PLAYER_HALF_W + TRAFFIC_KINDS[car.kind].halfW
    if (Math.abs(dz) < CAR_HALF_LEN * 2 && gap < reach && state.speed <= car.speed) {
      // A car catching a slowed player brakes behind it rather than drive through.
      car.speed = Math.max(0, state.speed * 0.9)
      continue
    }
    if (Math.abs(dz) < CAR_HALF_LEN * 2 && gap < reach) {
      const rel = state.speed - car.speed
      const dir = state.playerX < cx ? -1 : 1
      state.crashes++
      if (rel > SPIN_REL) {
        state.crash = { kind: 'spin', t: 0, dur: SPIN_TIME, dir }
        state.speed = car.speed * 0.75
        events.push({ type: 'crash', kind: 'spin' })
      } else {
        state.crash = { kind: 'bump', t: 0, dur: BUMP_TIME, dir }
        state.speed = car.speed * 0.85
        events.push({ type: 'crash', kind: 'bump' })
      }
      car.speed = Math.min(MAX_SPEED * 0.6, car.speed + rel * 0.3)
      car.z = Math.max(car.z, state.position + CAR_HALF_LEN * 2)
      return
    }
    // Passing: once it drops behind, a tight pass at speed pays.
    if (!car.passed && dz < -CAR_HALF_LEN) {
      car.passed = true
      if (gap < CLOSE_PASS_GAP && state.speed > MAX_SPEED * 0.6) {
        state.closes++
        if (!demo) state.score += CLOSE_PASS_SCORE
        events.push({ type: 'close' })
      }
    }
  }
  // Roadside props: only where the car is off the asphalt.
  if (!state.offroad) return
  for (let k = 0; k <= 1; k++) {
    const s = state.segments[seg.index + k]
    if (!s) continue
    const dz = s.index * SEG_LEN - state.position
    if (dz < -SEG_LEN * 0.2 || dz > SEG_LEN * 0.8) continue
    for (const p of s.props) {
      const def = PROP[p.kind]
      if (!def.solid) continue
      const px = worldX(s, p.side, p.rel)
      if (Math.abs(px - state.playerX) < PLAYER_HALF_W + def.w) {
        const dir = state.playerX < px ? -1 : 1
        state.crashes++
        if (state.speed > TUMBLE_SPEED) {
          state.crash = { kind: 'tumble', t: 0, dur: TUMBLE_TIME, dir }
          events.push({ type: 'crash', kind: 'tumble' })
        } else {
          state.crash = { kind: 'bump', t: 0, dur: BUMP_TIME, dir }
          state.speed *= 0.4
          events.push({ type: 'crash', kind: 'bump' })
        }
        return
      }
    }
  }
}
