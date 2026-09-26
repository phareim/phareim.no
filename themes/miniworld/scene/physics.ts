/**
 * Mini World's character controller (2026-09-26). Pure TypeScript, no
 * three.js, so node tests drive it directly (tests/miniworld-physics).
 *
 * The world is axis-aligned boxes: solid ground, walls and platforms,
 * trampolines (`bounce`), kill bricks (`kill`), plus moving platforms that
 * follow a sine path and spinning kill bars. The player is an upright box
 * (feet at y). Everything steps at a fixed 120 Hz, so a slow phone never
 * tunnels through a floor: a 20 fps frame is six small steps.
 *
 * Feel targets (Roblox): walk 8 u/s, jump 2.2 units, snappy acceleration,
 * coyote time and a jump buffer, small ledges stepped up without a jump,
 * and a ledge assist that lifts you onto a top you just missed.
 */

export type BoxKind = 'solid' | 'kill' | 'bounce'

export interface Box {
  minX: number; minY: number; minZ: number
  maxX: number; maxY: number; maxZ: number
  kind: BoxKind
  /** bounce: launch speed (u/s) when landed on. */
  bounce?: number
  /** Moving platforms: velocity during the last step (set by updateMovers). */
  vx: number; vy: number; vz: number
  /** Free tag for the owner (obby platform index, zone, …). */
  tag: number
  /** Query stamp (internal). */
  q: number
}

export function box(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, kind: BoxKind = 'solid', tag = -1): Box {
  return { minX, minY, minZ, maxX, maxY, maxZ, kind, vx: 0, vy: 0, vz: 0, tag, q: 0 }
}

/** A box from its centre and full size. */
export function boxAt(cx: number, cy: number, cz: number, sx: number, sy: number, sz: number, kind: BoxKind = 'solid', tag = -1): Box {
  return box(cx - sx / 2, cy - sy / 2, cz - sz / 2, cx + sx / 2, cy + sy / 2, cz + sz / 2, kind, tag)
}

/** A platform moving back and forth: offset = amp * sin(2π t / period + phase). */
export interface Mover {
  box: Box
  /** Rest position (min corner) and amplitude. */
  x0: number; y0: number; z0: number
  ax: number; ay: number; az: number
  period: number
  phase: number
}

export function mover(b: Box, ax: number, ay: number, az: number, period: number, phase = 0): Mover {
  return { box: b, x0: b.minX, y0: b.minY, z0: b.minZ, ax, ay, az, period, phase }
}

/** A kill bar spinning around a vertical axis (the obby's sweepers). */
export interface Spinner {
  cx: number; cz: number
  /** Bottom and top of the bar. */
  y0: number; y1: number
  /** Arm length from the centre (the bar spans both sides). */
  len: number
  /** Half thickness of the bar. */
  half: number
  /** rad/s */
  speed: number
  angle: number
}

export interface PhysWorld {
  /** Static boxes in a uniform grid (see addStatic). */
  cells: Map<number, Box[]>
  statics: Box[]
  movers: Mover[]
  spinners: Spinner[]
  /** Below this the body counts as fallen. */
  killY: number
  /** Below this (town) the body is in the sea. -Infinity: no water. */
  waterY: number
  time: number
  stamp: number
}

const CELL = 8
const key = (ix: number, iz: number) => (ix + 4096) * 8192 + (iz + 4096)

export function createWorld(opts: { killY?: number; waterY?: number } = {}): PhysWorld {
  return { cells: new Map(), statics: [], movers: [], spinners: [], killY: opts.killY ?? -60, waterY: opts.waterY ?? -Infinity, time: 0, stamp: 1 }
}

export function addStatic(w: PhysWorld, b: Box): Box {
  w.statics.push(b)
  const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL)
  const z0 = Math.floor(b.minZ / CELL), z1 = Math.floor(b.maxZ / CELL)
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const k = key(ix, iz)
    let list = w.cells.get(k)
    if (!list) { list = []; w.cells.set(k, list) }
    list.push(b)
  }
  return b
}

export function addMover(w: PhysWorld, m: Mover): Mover {
  w.movers.push(m)
  placeMover(m, w.time)
  return m
}

function placeMover(m: Mover, t: number) {
  const s = Math.sin((2 * Math.PI * t) / m.period + m.phase)
  const b = m.box
  const sx = b.maxX - b.minX, sy = b.maxY - b.minY, sz = b.maxZ - b.minZ
  b.minX = m.x0 + m.ax * s; b.maxX = b.minX + sx
  b.minY = m.y0 + m.ay * s; b.maxY = b.minY + sy
  b.minZ = m.z0 + m.az * s; b.maxZ = b.minZ + sz
}

/** Moves every platform to time t and records its velocity. */
export function updateMovers(w: PhysWorld, dt: number) {
  w.time += dt
  const t = w.time
  for (const m of w.movers) {
    const b = m.box
    const px = b.minX, py = b.minY, pz = b.minZ
    placeMover(m, t)
    b.vx = (b.minX - px) / dt; b.vy = (b.minY - py) / dt; b.vz = (b.minZ - pz) / dt
  }
  for (const s of w.spinners) s.angle += s.speed * dt
}

const out: Box[] = []

/** Boxes near an area (statics from the grid, then every mover). Reuses one array. */
export function query(w: PhysWorld, minX: number, minZ: number, maxX: number, maxZ: number): Box[] {
  out.length = 0
  const stamp = ++w.stamp
  const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL)
  const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL)
  for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
    const list = w.cells.get(key(ix, iz))
    if (!list) continue
    for (const b of list) if (b.q !== stamp) { b.q = stamp; out.push(b) }
  }
  for (const m of w.movers) out.push(m.box)
  return out
}

// ---------------------------------------------------------------- body

export const PHYS = {
  dt: 1 / 120,
  gravity: 42,
  jumpHeight: 2.2,
  walk: 8,
  accelGround: 90,
  accelAir: 38,
  maxFall: 48,
  /** Ledges up to this high are walked up. */
  step: 0.6,
  /** In the air, a top this far above the feet still catches you (ledge assist). */
  ledge: 0.6,
  coyote: 0.12,
  jumpBuffer: 0.14,
  halfWidth: 0.42,
  height: 2.5,
  maxSteps: 12,
}
export const JUMP_V = Math.sqrt(2 * PHYS.gravity * PHYS.jumpHeight)

export interface Body {
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  hw: number; h: number
  onGround: boolean
  ground: Box | null
  /** Time since the feet left the ground. */
  air: number
  /** Time left on a buffered jump press. */
  jumpBuf: number
  /** True from a jump until landing (no coyote jump then). */
  jumped: boolean
  /** Scale of walk speed (1 normal). */
  speed: number
}

export function createBody(x = 0, y = 0, z = 0): Body {
  return { x, y, z, vx: 0, vy: 0, vz: 0, hw: PHYS.halfWidth, h: PHYS.height, onGround: false, ground: null, air: 0, jumpBuf: 0, jumped: false, speed: 1 }
}

export function placeBody(b: Body, x: number, y: number, z: number) {
  b.x = x; b.y = y; b.z = z; b.vx = 0; b.vy = 0; b.vz = 0
  b.onGround = false; b.ground = null; b.air = 0; b.jumpBuf = 0; b.jumped = false
}

/** What the controller wants this step: a world-space direction (length ≤ 1). */
export interface Intent {
  mx: number; mz: number
  /** Jump held (unused by the fixed-height jump, kept for callers). */
  jump: boolean
}

/** What happened during one step (flags; the caller reads and reacts). */
export interface StepEvents {
  jumped: boolean
  /** Landing speed (u/s) when the feet touched down this step, else 0. */
  landed: number
  bounced: boolean
  killed: boolean
  fell: boolean
  water: boolean
}

export function createEvents(): StepEvents {
  return { jumped: false, landed: 0, bounced: false, killed: false, fell: false, water: false }
}

function clearEvents(e: StepEvents) {
  e.jumped = false; e.landed = 0; e.bounced = false; e.killed = false; e.fell = false; e.water = false
}

const EPS = 1e-4

function overlaps(b: Body, o: Box): boolean {
  return b.x + b.hw > o.minX + EPS && b.x - b.hw < o.maxX - EPS &&
    b.z + b.hw > o.minZ + EPS && b.z - b.hw < o.maxZ - EPS &&
    b.y + b.h > o.minY + EPS && b.y < o.maxY - EPS
}

function freeAt(w: PhysWorld, b: Body, x: number, y: number, z: number, list: Box[]): boolean {
  for (const o of list) {
    if (o.kind === 'kill') continue
    if (x + b.hw > o.minX + EPS && x - b.hw < o.maxX - EPS && z + b.hw > o.minZ + EPS && z - b.hw < o.maxZ - EPS && y + b.h > o.minY + EPS && y < o.maxY - EPS) return false
  }
  return true
}

/** Press jump (buffered for a moment, so an early press still counts). */
export function pressJump(b: Body) {
  b.jumpBuf = PHYS.jumpBuffer
}

function approach(v: number, target: number, rate: number): number {
  if (v < target) return Math.min(target, v + rate)
  if (v > target) return Math.max(target, v - rate)
  return v
}

/**
 * One fixed step. Movers must already be at this step's position
 * (`updateMovers` first), so a body on a platform is carried by its delta.
 */
export function stepBody(w: PhysWorld, b: Body, intent: Intent, ev: StepEvents, dt = PHYS.dt) {
  clearEvents(ev)
  // Carried by the platform under the feet.
  const g = b.ground
  if (b.onGround && g && (g.vx !== 0 || g.vy !== 0 || g.vz !== 0)) {
    b.x += g.vx * dt; b.y += g.vy * dt; b.z += g.vz * dt
    if (g.vy > 0 || b.y < g.maxY) b.y = g.maxY
  }

  const list = query(w, b.x - b.hw - 2, b.z - b.hw - 2, b.x + b.hw + 2, b.z + b.hw + 2)
  depenetrate(b, list)

  // Horizontal velocity toward the wish.
  const top = PHYS.walk * b.speed
  const tx = intent.mx * top, tz = intent.mz * top
  const acc = (b.onGround ? PHYS.accelGround : PHYS.accelAir) * dt
  b.vx = approach(b.vx, tx, acc)
  b.vz = approach(b.vz, tz, acc)

  // Jump: buffered press, on the ground or just off it.
  if (b.jumpBuf > 0) b.jumpBuf -= dt
  if (b.jumpBuf > 0 && (b.onGround || (!b.jumped && b.air < PHYS.coyote))) {
    b.vy = JUMP_V
    b.jumpBuf = 0
    b.jumped = true
    b.onGround = false
    b.ground = null
    ev.jumped = true
  }

  b.vy = Math.max(-PHYS.maxFall, b.vy - PHYS.gravity * dt)
  const wasGround = b.onGround

  // X, then Z, then Y.
  b.x += b.vx * dt
  resolveHorizontal(w, b, list, 0, wasGround)
  b.z += b.vz * dt
  resolveHorizontal(w, b, list, 1, wasGround)

  const fallSpeed = -b.vy
  b.y += b.vy * dt
  b.onGround = false
  b.ground = null
  for (const o of list) {
    if (o.kind === 'kill' || !overlaps(b, o)) continue
    if (b.vy <= 0 && b.y - b.vy * dt >= o.maxY - PHYS.step * 0.5 - EPS) {
      // Landed on its top (the feet were at or above it before this step).
      b.y = o.maxY
      if (!b.ground || o.maxY >= b.ground.maxY) b.ground = o
      b.onGround = true
    } else if (b.vy > 0 && b.y + b.h - b.vy * dt <= o.minY + EPS) {
      b.y = o.minY - b.h
      b.vy = 0
    } else {
      // Side contact during the vertical move (a mover pushing): go around it.
      depenetrate(b, list)
    }
  }
  if (b.onGround) {
    const gnd = b.ground!
    if (gnd.kind === 'bounce' && b.vy <= 0) {
      b.vy = gnd.bounce ?? 24
      b.onGround = false
      b.ground = null
      b.jumped = true
      ev.bounced = true
    } else {
      if (!wasGround && fallSpeed > 0) ev.landed = fallSpeed
      b.vy = Math.min(0, gnd.vy)
      if (b.vy < 0) b.vy = 0
      b.air = 0
      b.jumped = false
    }
  } else {
    b.air += dt
  }

  // Hazards.
  for (const o of list) if (o.kind === 'kill' && overlaps(b, o)) { ev.killed = true; break }
  if (!ev.killed) for (const s of w.spinners) if (hitsSpinner(b, s)) { ev.killed = true; break }
  if (b.y < w.waterY) ev.water = true
  else if (b.y < w.killY) ev.fell = true
}

function resolveHorizontal(w: PhysWorld, b: Body, list: Box[], axis: 0 | 1, wasGround: boolean) {
  const v = axis === 0 ? b.vx : b.vz
  if (v === 0) return
  for (const o of list) {
    if (o.kind === 'kill' || !overlaps(b, o)) continue
    const rise = o.maxY - b.y
    // Step up a small ledge on the ground, or catch a top just missed in the air.
    const canStep = wasGround ? rise <= PHYS.step : (b.vy <= 1 && rise <= PHYS.ledge)
    if (rise > 0 && canStep && freeAt(w, b, b.x, o.maxY, b.z, list)) {
      b.y = o.maxY
      if (b.vy < 0) b.vy = 0
      continue
    }
    if (axis === 0) {
      b.x = v > 0 ? o.minX - b.hw - EPS : o.maxX + b.hw + EPS
      // A mover pushing us keeps us moving with it.
      b.vx = o.vx
    } else {
      b.z = v > 0 ? o.minZ - b.hw - EPS : o.maxZ + b.hw + EPS
      b.vz = o.vz
    }
  }
}

/** Push the body out of anything it is inside of, along the shortest way. */
function depenetrate(b: Body, list: Box[]) {
  for (let pass = 0; pass < 3; pass++) {
    let moved = false
    for (const o of list) {
      if (o.kind === 'kill' || !overlaps(b, o)) continue
      const px1 = o.maxX - (b.x - b.hw), px0 = (b.x + b.hw) - o.minX
      const pz1 = o.maxZ - (b.z - b.hw), pz0 = (b.z + b.hw) - o.minZ
      const py1 = o.maxY - b.y, py0 = (b.y + b.h) - o.minY
      const m = Math.min(px1, px0, pz1, pz0, py1 + 0.2, py0 + 0.4)
      if (m === py1 + 0.2) { b.y = o.maxY; if (b.vy < 0) b.vy = 0 }
      else if (m === px1) b.x += px1 + EPS
      else if (m === px0) b.x -= px0 + EPS
      else if (m === pz1) b.z += pz1 + EPS
      else if (m === pz0) b.z -= pz0 + EPS
      else { b.y = o.minY - b.h; if (b.vy > 0) b.vy = 0 }
      moved = true
    }
    if (!moved) return
  }
}

function hitsSpinner(b: Body, s: Spinner): boolean {
  if (b.y > s.y1 || b.y + b.h < s.y0) return false
  // Distance from the body's centre to the bar's segment, in xz.
  const dx = Math.cos(s.angle), dz = Math.sin(s.angle)
  const rx = b.x - s.cx, rz = b.z - s.cz
  let t = rx * dx + rz * dz
  t = Math.max(-s.len, Math.min(s.len, t))
  const ex = rx - dx * t, ez = rz - dz * t
  const r = s.half + b.hw * 0.8
  return ex * ex + ez * ez < r * r
}

/** Height of the highest walkable top under (x, z) at or below y + 0.1, or -Infinity. */
export function groundBelow(w: PhysWorld, x: number, y: number, z: number, hw = 0.2): number {
  const list = query(w, x - hw, z - hw, x + hw, z + hw)
  let best = -Infinity
  for (const o of list) {
    if (o.kind === 'kill') continue
    if (x + hw > o.minX && x - hw < o.maxX && z + hw > o.minZ && z - hw < o.maxZ && o.maxY <= y + 0.1 && o.maxY > best) best = o.maxY
  }
  return best
}

/**
 * The first hit of a ray (origin, unit direction) against solids, as a
 * distance, or maxDist. The camera uses it to stay in front of walls.
 */
export function raycast(w: PhysWorld, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number, pad = 0): number {
  const ex = ox + dx * maxDist, ez = oz + dz * maxDist
  const list = query(w, Math.min(ox, ex) - pad, Math.min(oz, ez) - pad, Math.max(ox, ex) + pad, Math.max(oz, ez) + pad)
  let best = maxDist
  for (const o of list) {
    if (o.kind === 'kill') continue
    const t = rayBox(ox, oy, oz, dx, dy, dz, o.minX - pad, o.minY - pad, o.minZ - pad, o.maxX + pad, o.maxY + pad, o.maxZ + pad)
    if (t >= 0 && t < best) best = t
  }
  return best
}

function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
  let tmin = -Infinity, tmax = Infinity
  const ax = [ox, oy, oz], ad = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1]
  for (let i = 0; i < 3; i++) {
    const o = ax[i]!, d = ad[i]!
    if (Math.abs(d) < 1e-9) {
      if (o < lo[i]! || o > hi[i]!) return -1
    } else {
      let t0 = (lo[i]! - o) / d, t1 = (hi[i]! - o) / d
      if (t0 > t1) { const s = t0; t0 = t1; t1 = s }
      if (t0 > tmin) tmin = t0
      if (t1 < tmax) tmax = t1
      if (tmin > tmax) return -1
    }
  }
  if (tmax < 0) return -1
  // Starting inside a box does not count as a hit (the player's own ledge).
  return tmin < 0 ? -1 : tmin
}

/**
 * Steps the world and body for a frame of `frameDt` seconds with a fixed
 * step. `acc` carries the remainder between frames. Returns the steps run.
 */
export function advance(w: PhysWorld, b: Body, intent: Intent, ev: StepEvents, frameDt: number, acc: { t: number }, onStep?: (ev: StepEvents) => void): number {
  acc.t = Math.min(acc.t + frameDt, PHYS.dt * PHYS.maxSteps)
  let n = 0
  while (acc.t >= PHYS.dt) {
    acc.t -= PHYS.dt
    updateMovers(w, PHYS.dt)
    stepBody(w, b, intent, ev)
    onStep?.(ev)
    n++
  }
  return n
}

/**
 * How far the controller can jump: horizontal edge-to-edge reach for a
 * height change dh (positive up), running at full speed, with no coyote
 * time and no ledge assist (the conservative figure the obby is built on).
 */
export function jumpReach(dh: number): number {
  const g = PHYS.gravity, v0 = JUMP_V
  const disc = v0 * v0 - 2 * g * dh
  if (disc < 0) return 0
  const t = (v0 + Math.sqrt(disc)) / g
  return PHYS.walk * t + 2 * PHYS.halfWidth
}
