/**
 * SPACE PADDLE — THE ODYSSEY: the rules. Pure: no DOM, no clock, no sound.
 * Time is the game's own `t` (seconds) and randomness the injected `rng`, so
 * a seed gives the same boards and drops every time (tests/breakout-engine.test.mjs).
 * Breakout.vue draws the state, turns the events into sound and particles,
 * and reports score, lives and level up to Landing.vue.
 *
 * Geometry is in CSS px. The ball moves in steps of at most STEP_PX, so at
 * top speed it cannot pass through a brick or the paddle between two steps.
 */

export const BALL_R = 6
export const BASE_SPEED = 520 // px/s at level 1 (was 380 before the Odyssey)
export const SPEED_PER_LEVEL = 34
export const MAX_SPEED = 1100
export const LIVES = 3
export const MAX_BALLS = 12
export const STEP_PX = 3 // longest move inside one sub-step
export const MAX_STEPS = 60 // dt is clamped to 50 ms, so 1100 px/s needs about 19
export const PADDLE_H = 14
export const PADDLE_SPEED = 720
export const EXPAND_SCALE = 1.7
export const LASER_EVERY = 0.28 // s between shots
export const BOLT_SPEED = 900
export const DROP_SPEED = 140
export const GRAVITY = 900 // px/s² at a planet's centre
export const PULSE_PERIOD = 2.4 // s; a pulse brick is open for half of it
export const DEMO_LAUNCH = 1.2 // s before the attract ball is served
export const POWER_SECONDS = { expand: 12, laser: 8, warp: 8 } as const
export const ROW_COLORS = ['#ff2fa0', '#ff8a3d', '#ffd23f', '#9a4ff0', '#3fd8b0'] as const

export const POWER_TYPES = ['expand', 'multi', 'laser', 'warp', 'shield', 'life'] as const
export type PowerType = (typeof POWER_TYPES)[number]

/** Drop weights out of 100 (a dropped capsule is one of these). */
export const POWER_WEIGHTS: Record<PowerType, number> = {
  multi: 30, expand: 22, laser: 16, warp: 14, shield: 10, life: 8,
}
export const POWER_INFO: Record<PowerType, { label: string; color: string; name: string }> = {
  expand: { label: 'E', color: '#2ff3ff', name: 'EXPAND' },
  multi: { label: 'X', color: '#ff2fa0', name: 'MULTI-BALL' },
  laser: { label: 'L', color: '#ffd23f', name: 'LASER' },
  warp: { label: 'T', color: '#9a4ff0', name: 'TIME WARP' },
  shield: { label: 'S', color: '#3fd8b0', name: 'SHIELD' },
  life: { label: '+', color: '#ff8a3d', name: 'EXTRA LIFE' },
}
/** Chance that a destroyed brick drops a capsule. */
export const DROP_CHANCE = 0.14

export type Rng = () => number

/** mulberry32: a small seeded generator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export interface Brick {
  row: number
  col: number
  /** Where the brick sits before any drift. */
  baseX: number
  x: number
  y: number
  w: number
  h: number
  hp: number
  maxHp: number
  /** 'stone' takes two or three hits; 'pulse' is solid for half of PULSE_PERIOD. */
  kind: 'crystal' | 'stone' | 'pulse'
  points: number
  /** Drift amplitude in px (0 = still); the row slides left and right. */
  amp: number
  phase: number
  flash: number
  color: string
}

export interface Ball {
  x: number
  y: number
  vx: number
  vy: number
  speed: number
  stuck: boolean
  trail: { x: number; y: number }[]
}

export interface Bolt { x: number; y: number }
export interface Drop { x: number; y: number; power: PowerType }
export interface Planet { fx: number; x: number; y: number; r: number }

export type GameEvent =
  | { type: 'launch' }
  | { type: 'wall'; x: number; y: number }
  | { type: 'paddle'; x: number; y: number }
  | { type: 'shield'; x: number; y: number }
  | { type: 'solid'; x: number; y: number }
  | { type: 'brick'; x: number; y: number; color: string }
  | { type: 'break'; x: number; y: number; color: string; points: number; combo: number }
  | { type: 'powerup'; x: number; y: number; power: PowerType }
  | { type: 'laser'; x: number; y: number }
  | { type: 'lost'; x: number; y: number }
  | { type: 'gameover'; x: number; y: number }
  | { type: 'levelclear'; level: number }
  | { type: 'death' }

export interface Game {
  W: number
  H: number
  bandBottom: number
  rng: Rng
  t: number
  /** Attract mode: the game plays itself, lives do not run out, nothing scores. */
  demo: boolean
  /** Columns of bricks, fixed for a run (from the width when it starts). */
  cols: number
  paddle: { x: number; y: number; w: number; baseW: number; h: number; visible: boolean }
  balls: Ball[]
  bricks: Brick[]
  bolts: Bolt[]
  drops: Drop[]
  planet: Planet | null
  /** One-use floor line under the paddle; a ball that reaches it bounces and the line goes. */
  shield: boolean
  timers: { expand: number; laser: number; warp: number }
  laserCd: number
  /** Attract mode: seconds until the stuck ball is served. */
  launchIn: number
  score: number
  lives: number
  level: number
  combo: number
  over: boolean
  overAt: number
  overEmitted: boolean
  /** Seconds left on the "LEVEL n" banner. */
  banner: number
  events: GameEvent[]
}

export interface Input { left?: boolean; right?: boolean }

// ---------------------------------------------------------------- geometry

export interface Geometry {
  margin: number
  gap: number
  bw: number
  bh: number
  top: number
}

export function geometry(W: number, H: number, cols: number): Geometry {
  const margin = Math.max(12, W * 0.04)
  const gap = 5
  const bw = (W - margin * 2 - gap * (cols - 1)) / cols
  const bh = Math.min(22, Math.max(14, bw * 0.38))
  const top = Math.max(64, H * 0.11)
  return { margin, gap, bw, bh, top }
}

export function colsFor(W: number): number {
  return clamp(Math.round(W / 72), 5, 14)
}

export function paddleY(H: number, bandBottom: number): number {
  return H - 56 - bandBottom
}

export function ballSpeed(level: number): number {
  return Math.min(BASE_SPEED + (level - 1) * SPEED_PER_LEVEL, MAX_SPEED)
}

// ---------------------------------------------------------------- boards

/**
 * What level `n` brings. Rows add up from 5 to 9; the layout cycles through
 * five patterns; from level 2 every third row drifts; from level 3 some bricks
 * pulse open and shut; from level 4 every second level has a planet whose
 * gravity bends the ball.
 */
export function boardSpec(n: number) {
  return {
    rows: Math.min(5 + Math.floor((n - 1) / 2), 9),
    pattern: (n - 1) % 5,
    drifting: n >= 2,
    pulses: n >= 3,
    planet: n >= 4 && n % 2 === 0,
  }
}

function cellPresent(pattern: number, r: number, c: number, cols: number, rows: number): boolean {
  const mid = (cols - 1) / 2
  switch (pattern) {
    case 1: return (r + c) % 2 === 0 // checker
    case 2: return Math.abs(c - mid) <= (cols * (1 - r / (rows + 1))) / 2 // pyramid
    case 3: return c % 4 !== 3 || r % 3 === 0 // columns
    case 4: return (Math.abs(c - mid) + r) % 3 !== 2 // chevrons
    default: return true // full wall
  }
}

/** Rows drift in the middle of the field, so they keep one free column at each side. */
export function isDriftRow(n: number, r: number): boolean {
  return boardSpec(n).drifting && r % 3 === 2
}

export function isOpen(b: Brick, t: number): boolean {
  return (t + b.phase) % PULSE_PERIOD < PULSE_PERIOD / 2
}

function layoutBricks(g: Game) {
  const geo = geometry(g.W, g.H, g.cols)
  for (const b of g.bricks) {
    b.baseX = geo.margin + b.col * (geo.bw + geo.gap)
    b.y = geo.top + b.row * (geo.bh + geo.gap)
    b.w = geo.bw
    b.h = geo.bh
    b.amp = b.amp > 0 ? (geo.bw + geo.gap) * 0.9 : 0
    b.x = b.baseX + b.amp * Math.sin(g.t * 0.8 + b.phase)
  }
  if (g.planet) {
    g.planet.x = g.W * g.planet.fx
    g.planet.y = g.H * 0.6
  }
}

function buildBoard(g: Game) {
  const spec = boardSpec(g.level)
  const hardRows = Math.min(g.level, 3)
  const bricks: Brick[] = []
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!cellPresent(spec.pattern, r, c, g.cols, spec.rows)) continue
      const drifting = isDriftRow(g.level, r)
      if (drifting && (c === 0 || c === g.cols - 1)) continue
      let hp = r < hardRows ? 2 : 1
      if (g.level >= 4 && r === 0) hp = 3
      let kind: Brick['kind'] = hp > 1 ? 'stone' : 'crystal'
      if (spec.pulses && hp === 1 && g.rng() < 0.14) kind = 'pulse'
      const color = kind === 'pulse' ? '#2ff3ff' : ROW_COLORS[r % ROW_COLORS.length]!
      bricks.push({
        row: r,
        col: c,
        baseX: 0,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        hp,
        maxHp: hp,
        kind,
        points: (spec.rows - r) * 10 * hp * (kind === 'pulse' ? 2 : 1),
        amp: drifting ? 1 : 0,
        phase: g.rng() * Math.PI * 2,
        flash: 0,
        color,
      })
    }
  }
  g.bricks = bricks
  g.planet = spec.planet
    ? { fx: 0.3 + 0.4 * g.rng(), x: 0, y: 0, r: 24 + Math.min(g.level, 8) * 2 }
    : null
  layoutBricks(g)
}

// ---------------------------------------------------------------- lifecycle

function newGame(W: number, H: number, bandBottom: number, rng: Rng): Game {
  const baseW = Math.min(120, Math.max(72, W * 0.24))
  return {
    W, H, bandBottom, rng,
    t: 0,
    demo: true,
    cols: colsFor(W),
    paddle: { x: W / 2, y: paddleY(H, bandBottom), w: baseW, baseW, h: PADDLE_H, visible: true },
    balls: [],
    bricks: [],
    bolts: [],
    drops: [],
    planet: null,
    shield: false,
    timers: { expand: 0, laser: 0, warp: 0 },
    laserCd: 0,
    launchIn: 0,
    score: 0,
    lives: LIVES,
    level: 1,
    combo: 0,
    over: false,
    overAt: 0,
    overEmitted: false,
    banner: 0,
    events: [],
  }
}

export function createGame(opts: { W: number; H: number; bandBottom?: number; rng: Rng }): Game {
  const g = newGame(opts.W, opts.H, opts.bandBottom ?? 0, opts.rng)
  startDemo(g)
  return g
}

/** Keep the field in step with the window. The brick grid stays as it is. */
export function resize(g: Game, W: number, H: number, bandBottom: number) {
  g.W = W
  g.H = H
  g.bandBottom = bandBottom
  g.paddle.y = paddleY(H, bandBottom)
  g.paddle.baseW = Math.min(120, Math.max(72, W * 0.24))
  g.paddle.x = clamp(g.paddle.x, g.paddle.w / 2, W - g.paddle.w / 2)
  layoutBricks(g)
  for (const b of g.balls) if (b.stuck) { b.x = g.paddle.x; b.y = g.paddle.y - BALL_R - 1 }
}

function newBall(g: Game): Ball {
  return {
    x: g.paddle.x,
    y: g.paddle.y - BALL_R - 1,
    vx: 0,
    vy: 0,
    speed: ballSpeed(g.level),
    stuck: true,
    trail: [],
  }
}

/** Clears everything a run owns. The clock `t` keeps running. */
function resetRun(g: Game) {
  g.combo = 0
  g.over = false
  g.overEmitted = false
  g.timers = { expand: 0, laser: 0, warp: 0 }
  g.laserCd = 0
  g.shield = false
  g.bolts = []
  g.drops = []
  g.banner = 0
  g.paddle.visible = true
  g.paddle.x = g.W / 2
  g.cols = colsFor(g.W)
  g.level = 1
  buildBoard(g)
  g.balls = [newBall(g)]
}

/** A new run: score 0, three lives, level 1. */
export function startRun(g: Game) {
  resetRun(g)
  g.demo = false
  g.score = 0
  g.lives = LIVES
  g.launchIn = 0
}

/** Attract mode behind the start card: the game plays itself. */
export function startDemo(g: Game) {
  resetRun(g)
  g.demo = true
  g.lives = LIVES
  g.launchIn = DEMO_LAUNCH
}

// ---------------------------------------------------------------- input

export function setPaddleX(g: Game, x: number) {
  g.paddle.x = clamp(x, g.paddle.w / 2, g.W - g.paddle.w / 2)
}

/** Serve every stuck ball. True when there was one. */
export function launchBalls(g: Game): boolean {
  let any = false
  for (const b of g.balls) {
    if (!b.stuck) continue
    const angle = g.rng() * 0.6 - 0.3
    b.vx = Math.sin(angle) * b.speed
    b.vy = -Math.cos(angle) * b.speed
    b.stuck = false
    any = true
  }
  if (any) g.events.push({ type: 'launch' })
  return any
}

/** Where the attract-mode paddle goes: under the lowest falling ball, a little ahead of it. */
export function autopilotX(g: Game): number {
  let target = g.W / 2
  let best = -Infinity
  for (const b of g.balls) {
    if (b.stuck) return b.x
    if (b.vy > 0 && b.y > best) {
      best = b.y
      target = b.x + b.vx * 0.12
    }
  }
  return target
}

/** The run ends now, the way a lost last life ends it (the Escape hold). */
export function quitRun(g: Game) {
  if (g.demo || g.over) return
  g.lives = 0
  endRun(g)
}

// ---------------------------------------------------------------- the step

export function stepGame(g: Game, dtIn: number, input: Input = {}): void {
  const dt = clamp(dtIn, 0, 0.05)
  g.t += dt
  g.banner = Math.max(0, g.banner - dt)
  for (const k of ['expand', 'laser', 'warp'] as const) g.timers[k] = Math.max(0, g.timers[k] - dt)

  for (const b of g.bricks) {
    if (b.amp > 0) b.x = b.baseX + b.amp * Math.sin(g.t * 0.8 + b.phase)
    if (b.flash > 0) b.flash = Math.max(0, b.flash - 4 * dt)
  }

  // Paddle: width from the expand timer, then movement.
  g.paddle.w = g.timers.expand > 0 ? g.paddle.baseW * EXPAND_SCALE : g.paddle.baseW
  if (g.demo) {
    g.paddle.x += (autopilotX(g) - g.paddle.x) * Math.min(1, dt * 6)
  } else if (!g.over) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    if (dir) g.paddle.x += dir * PADDLE_SPEED * dt
  }
  setPaddleX(g, g.paddle.x)

  // Attract mode serves its own ball.
  if (g.demo && g.launchIn > 0) {
    g.launchIn -= dt
    if (g.launchIn <= 0) launchBalls(g)
  }

  if (g.timers.laser > 0 && !g.over) fireLasers(g, dt)
  stepBolts(g, dt)
  stepDrops(g, dt)
  stepBalls(g, dt)

  if (g.balls.length === 0 && !g.over) loseBall(g)
  if (g.bricks.length === 0 && !g.over) clearBoard(g)

  if (g.over && !g.overEmitted && g.t - g.overAt > 0.9) {
    g.overEmitted = true
    g.events.push({ type: 'death' })
  }
}

function fireLasers(g: Game, dt: number) {
  g.laserCd -= dt
  if (g.laserCd > 0) return
  g.laserCd = LASER_EVERY
  const half = g.paddle.w * 0.35
  g.bolts.push({ x: g.paddle.x - half, y: g.paddle.y }, { x: g.paddle.x + half, y: g.paddle.y })
  g.events.push({ type: 'laser', x: g.paddle.x, y: g.paddle.y })
}

/** Bolts check the whole segment they cover this step, so they cannot skip a brick. */
function stepBolts(g: Game, dt: number) {
  for (let i = g.bolts.length - 1; i >= 0; i--) {
    const bolt = g.bolts[i]!
    const prevY = bolt.y
    bolt.y -= BOLT_SPEED * dt
    let spent = bolt.y < -10
    if (!spent) {
      for (let j = 0; j < g.bricks.length; j++) {
        const b = g.bricks[j]!
        if (b.kind === 'pulse' && !isOpen(b, g.t)) continue
        if (bolt.x < b.x - 1 || bolt.x > b.x + b.w + 1) continue
        if (b.y > prevY || b.y + b.h < bolt.y) continue
        hitBrick(g, j, bolt.x, b.y + b.h / 2)
        spent = true
        break
      }
    }
    if (spent) g.bolts.splice(i, 1)
  }
}

function stepDrops(g: Game, dt: number) {
  for (let i = g.drops.length - 1; i >= 0; i--) {
    const d = g.drops[i]!
    d.y += DROP_SPEED * dt
    const p = g.paddle
    if (p.visible && d.y >= p.y - 6 && d.y <= p.y + p.h + 6 && Math.abs(d.x - p.x) <= p.w / 2 + 10) {
      applyPower(g, d.power, d.x, d.y)
      g.drops.splice(i, 1)
    } else if (d.y > g.H + 20) {
      g.drops.splice(i, 1)
    }
  }
}

function stepBalls(g: Game, dt: number) {
  const slow = g.timers.warp > 0 ? 0.6 : 1
  const p = g.paddle
  const shieldY = p.y + p.h + 10
  for (let i = g.balls.length - 1; i >= 0; i--) {
    const ball = g.balls[i]!
    if (ball.stuck) {
      ball.x = p.x
      ball.y = p.y - BALL_R - 1
      continue
    }
    if (g.over) continue
    ball.trail.push({ x: ball.x, y: ball.y })
    if (ball.trail.length > 8) ball.trail.shift()

    const dist = Math.hypot(ball.vx, ball.vy) * slow * dt
    const steps = clamp(Math.ceil(dist / STEP_PX), 1, MAX_STEPS)
    const sdt = (dt * slow) / steps
    let lost = false
    for (let s = 0; s < steps && !lost; s++) {
      const prevX = ball.x
      const prevY = ball.y
      if (g.planet) pull(g, ball, sdt)
      ball.x += ball.vx * sdt
      ball.y += ball.vy * sdt

      // Walls and ceiling.
      if (ball.x - BALL_R < 0) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx); g.events.push({ type: 'wall', x: ball.x, y: ball.y }) }
      if (ball.x + BALL_R > g.W) { ball.x = g.W - BALL_R; ball.vx = -Math.abs(ball.vx); g.events.push({ type: 'wall', x: ball.x, y: ball.y }) }
      if (ball.y - BALL_R < 0) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy); g.events.push({ type: 'wall', x: ball.x, y: ball.y }) }

      // The shield line bounces once, then goes.
      if (g.shield && ball.vy > 0 && prevY + BALL_R <= shieldY && ball.y + BALL_R >= shieldY) {
        ball.y = shieldY - BALL_R
        ball.vy = -Math.abs(ball.vy)
        g.shield = false
        g.events.push({ type: 'shield', x: ball.x, y: shieldY })
        continue
      }

      if (ball.y - BALL_R > g.H) { lost = true; break }

      // The paddle: a crossing of its top edge, so a fast ball cannot pass through it.
      if (
        p.visible && ball.vy > 0 &&
        prevY + BALL_R <= p.y && ball.y + BALL_R >= p.y &&
        Math.abs(ball.x - p.x) <= p.w / 2 + BALL_R
      ) {
        const rel = clamp((ball.x - p.x) / (p.w / 2), -1, 1)
        const angle = rel * (Math.PI / 3)
        ball.speed = Math.min(ball.speed * 1.02, MAX_SPEED)
        ball.vx = Math.sin(angle) * ball.speed
        ball.vy = -Math.cos(angle) * ball.speed
        ball.y = p.y - BALL_R
        g.combo = 0
        g.events.push({ type: 'paddle', x: ball.x, y: p.y })
        continue
      }

      // Bricks: the first one the ball overlaps this step takes the hit.
      for (let j = 0; j < g.bricks.length; j++) {
        const b = g.bricks[j]!
        const nx = clamp(ball.x, b.x, b.x + b.w)
        const ny = clamp(ball.y, b.y, b.y + b.h)
        const dx = ball.x - nx
        const dy = ball.y - ny
        if (dx * dx + dy * dy > BALL_R * BALL_R) continue

        const fromSide = prevX < b.x || prevX > b.x + b.w
        if (fromSide) {
          ball.vx = -ball.vx
          ball.x = prevX
        } else {
          ball.vy = -ball.vy
          ball.y = prevY
        }
        // Keep the ball from going flat.
        if (Math.abs(ball.vy) < ball.speed * 0.18) {
          ball.vy = (ball.vy < 0 ? -1 : 1) * ball.speed * 0.18
          ball.vx = Math.sign(ball.vx || 1) * Math.sqrt(Math.max(0, ball.speed ** 2 - ball.vy ** 2))
        }

        if (b.kind === 'pulse' && !isOpen(b, g.t)) {
          g.events.push({ type: 'solid', x: nx, y: ny })
        } else {
          hitBrick(g, j, nx, ny)
        }
        break
      }
    }
    if (lost) g.balls.splice(i, 1)
  }
}

/** Gravity from the planet bends the ball's course and keeps its speed. */
function pull(g: Game, ball: Ball, sdt: number) {
  const pl = g.planet!
  const dx = pl.x - ball.x
  const dy = pl.y - ball.y
  const d = Math.hypot(dx, dy)
  const reach = pl.r * 4
  if (d <= 0 || d >= reach) return
  const f = GRAVITY * (1 - d / reach) * sdt
  ball.vx += (dx / d) * f
  ball.vy += (dy / d) * f
  const sp = Math.hypot(ball.vx, ball.vy)
  if (sp > 0) {
    ball.vx = (ball.vx / sp) * ball.speed
    ball.vy = (ball.vy / sp) * ball.speed
  }
}

/** A brick takes one hit. Destroyed bricks score (scaled by combo) and may drop a capsule. */
function hitBrick(g: Game, index: number, x: number, y: number) {
  const b = g.bricks[index]!
  b.hp -= 1
  b.flash = 1
  if (b.hp > 0) {
    g.events.push({ type: 'brick', x, y, color: b.color })
    return
  }
  g.bricks.splice(index, 1)
  g.combo++
  const points = b.points * Math.min(g.combo, 4)
  if (!g.demo) g.score += points
  g.events.push({ type: 'break', x, y, color: b.color, points, combo: g.combo })
  if (!g.demo && g.rng() < DROP_CHANCE) {
    g.drops.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, power: pickPower(g.rng) })
  }
}

export function pickPower(rng: Rng): PowerType {
  let roll = rng() * 100
  for (const p of POWER_TYPES) {
    roll -= POWER_WEIGHTS[p]
    if (roll < 0) return p
  }
  return 'multi'
}

export function applyPower(g: Game, power: PowerType, x: number, y: number) {
  if (power === 'expand') g.timers.expand = POWER_SECONDS.expand
  if (power === 'laser') { g.timers.laser = POWER_SECONDS.laser; g.laserCd = 0 }
  if (power === 'warp') g.timers.warp = POWER_SECONDS.warp
  if (power === 'shield') g.shield = true
  if (power === 'life') g.lives++
  if (power === 'multi') {
    const moving = g.balls.filter(b => !b.stuck)
    if (moving.length === 0) {
      g.balls.push(newBall(g), newBall(g))
    }
    for (const b of moving) {
      const speed = Math.hypot(b.vx, b.vy) || b.speed
      const base = Math.atan2(b.vy, b.vx)
      for (const d of [-0.4, 0.4]) {
        if (g.balls.length >= MAX_BALLS) break
        g.balls.push({ x: b.x, y: b.y, vx: Math.cos(base + d) * speed, vy: Math.sin(base + d) * speed, speed: b.speed, stuck: false, trail: [] })
      }
    }
  }
  g.events.push({ type: 'powerup', x, y, power })
}

function loseBall(g: Game) {
  g.combo = 0
  g.events.push({ type: 'lost', x: g.paddle.x, y: g.paddle.y })
  if (g.demo) {
    g.balls = [newBall(g)]
    g.launchIn = 0.9
    return
  }
  g.lives--
  g.timers = { expand: 0, laser: 0, warp: 0 }
  g.laserCd = 0
  g.shield = false
  if (g.lives <= 0) {
    endRun(g)
    return
  }
  g.balls = [newBall(g)]
}

/** The run is over: the last life is gone or the Escape hold quit it. */
function endRun(g: Game) {
  g.over = true
  g.overAt = g.t
  g.combo = 0
  g.paddle.visible = false
  g.balls = []
  g.bolts = []
  g.drops = []
  g.timers = { expand: 0, laser: 0, warp: 0 }
  g.events.push({ type: 'gameover', x: g.paddle.x, y: g.paddle.y })
}

function clearBoard(g: Game) {
  if (g.demo) {
    buildBoard(g)
    g.balls = [newBall(g)]
    g.launchIn = DEMO_LAUNCH
    return
  }
  g.level++
  g.combo = 0
  buildBoard(g)
  g.balls = [newBall(g)]
  g.drops = []
  g.bolts = []
  g.banner = 1.5
  g.events.push({ type: 'levelclear', level: g.level })
}
