/**
 * Neon Shrine (theme id `zelda`) — pure deterministic game simulation.
 *
 * Single self-contained file on purpose: the repo's `node --test` suites
 * import engine files with an explicit `.ts` extension, which plain node
 * type-stripping resolves — but any *relative* runtime import between two
 * .ts files breaks one verifier or the other (extensionless specifiers fail
 * under node, `.ts` specifiers fail under tsc/TS5097; verified 2026-09-16).
 * So this module has no runtime imports at all: it imports only *types*
 * from `./types` (erased before runtime) and re-declares every numeric
 * tuning constant locally. `tests/zelda-engine.test.mjs` pins each local
 * copy against `types.ts` so the two can never drift apart silently.
 *
 * Fixed timestep STEP = 1/120 with an accumulator in stepGame. All gameplay
 * randomness flows through state.rng (mulberry32). Positions are tile
 * units; the player is a circle of PLAYER_RADIUS.
 */

import type {
  ChestPlacement,
  ChestReward,
  Drop,
  Engine,
  Enemy,
  EnemyKind,
  EnemyPlacement,
  Facing,
  GameEvent,
  GameState,
  Input,
  PickupPlacement,
  Portal,
  Projectile,
  Room,
  RoomState,
  SaveData,
  TileChar,
  Vec,
  World,
} from './types'

// ---------------------------------------------------------------------------
// Local copies of the tuning constants from types.ts (see note above).
// A test pins every one of these against types.ts.
// ---------------------------------------------------------------------------

export const PLAYER_RADIUS = 0.35
export const PLAYER_SPEED = 5.5
export const SWORD_REACH = 1.1
export const SWORD_ARC = Math.PI * 0.9
export const SWING_TIME = 0.18
export const SWING_COOLDOWN = 0.26
export const INVULN_TIME = 1.0
export const KNOCKBACK_SPEED = 9
export const KNOCKBACK_TIME = 0.18
export const SLIDE_TIME = 0.35
export const STEP = 1 / 120
export const START_HEARTS = 3
export const MAX_HEARTS = 5
export const SAVE_VERSION = 1
/** A sword press this close before the cooldown ends still swings (seconds). */
export const ATTACK_BUFFER = 0.14
/** How far (tiles) a blocked axis-aligned walk may slip sideways round a corner. */
export const CORNER_ASSIST = 0.3

/** Max catch-up simulated per stepGame call; the rest is discarded. */
export const MAX_CATCH_UP = 0.25
/** Analog dead zone for input.move. */
export const DEAD_ZONE = 0.15
/** Enemy hit i-frames after a sword hit. */
export const ENEMY_INVULN = 0.25
/** Enemy knockback duration after a sword hit. */
export const ENEMY_KNOCKBACK_TIME = 0.12
/** Enemy knockback speed after a sword hit. */
export const ENEMY_KNOCKBACK_SPEED = 6
/** Heart drop chance on enemy death (0 for knight/boss). */
export const ENEMY_HEART_CHANCE = 0.3
/** Heart drop chance on smashed pots. */
export const POT_HEART_CHANCE = 0.4
/** Heart drop chance on cut grass. */
export const GRASS_HEART_CHANCE = 0.15
/** Drops older than this vanish. */
export const DROP_LIFETIME = 8
/** Caps per room. */
export const MAX_DROPS = 12
export const MAX_PROJECTILES = 24
/** Death vignette length. */
export const DYING_TIME = 0.8
/** Screen shake request on player hit. */
export const PLAYER_SHAKE = 0.25
/** Screen shake request on boss slam. */
export const SLAM_SHAKE = 0.2

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

export function facingVec(f: Facing): Vec {
  if (f === 'up') return { x: 0, y: -1 }
  if (f === 'down') return { x: 0, y: 1 }
  if (f === 'left') return { x: -1, y: 0 }
  return { x: 1, y: 0 }
}

/** Cardinal facing for a vector, by dominant axis. Ties keep `fallback`. */
export function dominantFacing(dx: number, dy: number, fallback: Facing): Facing {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  if (ax === 0 && ay === 0) return fallback
  if (ax > ay) return dx > 0 ? 'right' : 'left'
  if (ay > ax) return dy > 0 ? 'down' : 'up'
  return fallback
}

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32). Gameplay draws go through state.rng only.
// ---------------------------------------------------------------------------

/** One mulberry32 draw: `value` in [0,1), `next` is the advanced state. */
export function rand(state: number): { value: number; next: number } {
  let s = (state + 0x6d2b79f5) | 0
  let t = s
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const mixed = (t ^ (t >>> 14)) >>> 0
  return { value: mixed / 4294967296, next: s }
}

/** Pure ranged draw. */
export function randRange(state: number, min: number, max: number): { value: number; next: number } {
  const r = rand(state)
  return { value: min + r.value * (max - min), next: r.next }
}

/** Pure coin flip with probability p. */
export function chance(state: number, p: number): { hit: boolean; next: number } {
  const r = rand(state)
  return { hit: r.value < p, next: r.next }
}

/** Mutating draw against a GameState: advances state.rng, returns [0,1). */
export function draw(state: GameState): number {
  const r = rand(state.rng)
  state.rng = r.next
  return r.value
}

/** Tile column/row containing point (x, y). */
export function worldToTile(x: number, y: number): { tx: number; ty: number } {
  return { tx: Math.floor(x), ty: Math.floor(y) }
}

// ---------------------------------------------------------------------------
// Tiles, collision, raycast
// ---------------------------------------------------------------------------

/** Tiles solid for walking. Water blocks movement but never blocks swords. */
export function isSolidTile(ch: TileChar): boolean {
  return ch === '#' || ch === 'o' || ch === 'T' || ch === 'G' || ch === 'L' || ch === 'B' || ch === 'S' || ch === 'W'
}

/** Tiles that kill projectiles. Water does not. */
export function blocksProjectile(ch: TileChar): boolean {
  return ch !== 'W' && isSolidTile(ch)
}

/** Read a tile; outside the grid counts as wall. */
export function tileAt(room: RoomState, tx: number, ty: number): TileChar {
  if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return '#'
  const row = room.tiles[ty]
  if (!row) return '#'
  const ch = row[tx]
  // Unknown chars are solid — a typo must block, never let the player out.
  if (
    ch !== '#' && ch !== '.' && ch !== '~' && ch !== 'o' && ch !== 'T' &&
    ch !== 'G' && ch !== 'W' && ch !== 'L' && ch !== 'B' && ch !== 'S' && ch !== ','
  ) return '#'
  return ch
}

/** Is a closed chest occupying tile (tx, ty)? Needs the world room. */
function chestTileSolid(room: RoomState, worldRoom: Room | null, tx: number, ty: number): boolean {
  if (!worldRoom) return false
  for (const c of worldRoom.chests) {
    if (c.x === tx && c.y === ty && room.chestsClosed.includes(c.id)) return true
  }
  return false
}

/** Circle-vs-grid test. `flyOver` skips every solid except '#'. */
export function circleHitsSolid(
  room: RoomState, x: number, y: number, r: number,
  worldRoom: Room | null, flyOver: boolean,
): boolean {
  const x0 = Math.floor(x - r)
  const x1 = Math.floor(x + r)
  const y0 = Math.floor(y - r)
  const y1 = Math.floor(y + r)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(room, tx, ty)
      const solid = flyOver ? ch === '#' : isSolidTile(ch)
      const chest = !flyOver && chestTileSolid(room, worldRoom, tx, ty)
      if (!solid && !chest) continue
      const cx = clamp(x, tx, tx + 1)
      const cy = clamp(y, ty, ty + 1)
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy < r * r) return true
    }
  }
  return false
}

/**
 * Move a circle with wall sliding: resolve x, then y. Returns the new
 * position (old coordinate kept on the blocked axis).
 */
export function moveCircle(
  room: RoomState, x: number, y: number, r: number, dx: number, dy: number,
  worldRoom: Room | null, flyOver: boolean,
): { x: number; y: number } {
  // A blocked axis advances flush to the obstacle (bisected fraction of the
  // step) instead of stopping a partial step short — no invisible gaps, and
  // contact triggers such as locked doors fire reliably.
  const flush = (horizontal: boolean, bx: number, by: number, d: number): number => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2
      const hit = horizontal
        ? circleHitsSolid(room, bx + d * mid, by, r, worldRoom, flyOver)
        : circleHitsSolid(room, bx, by + d * mid, r, worldRoom, flyOver)
      if (hit) hi = mid
      else lo = mid
    }
    return d * lo
  }
  let nx = x + dx
  if (dx !== 0 && circleHitsSolid(room, nx, y, r, worldRoom, flyOver)) nx = x + flush(true, x, y, dx)
  let ny = y + dy
  if (dy !== 0 && circleHitsSolid(room, nx, ny, r, worldRoom, flyOver)) ny = y + flush(false, nx, y, dy)
  return { x: nx, y: ny }
}

/**
 * Tile-granularity raycast (Amanatides & Woo DDA) from (x0,y0) to (x1,y1).
 * Returns true when the line crosses a '#' tile strictly after leaving the
 * start tile. Never per-pixel: only whole tiles are tested.
 */
export function rayBlockedByWall(room: RoomState, x0: number, y0: number, x1: number, y1: number): boolean {
  let tx = Math.floor(x0)
  let ty = Math.floor(y0)
  const endTx = Math.floor(x1)
  const endTy = Math.floor(y1)
  const dx = x1 - x0
  const dy = y1 - y0
  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity
  const fx = x0 - tx
  const fy = y0 - ty
  let tMaxX = stepX !== 0 ? (stepX > 0 ? (1 - fx) * tDeltaX : fx * tDeltaX) : Infinity
  let tMaxY = stepY !== 0 ? (stepY > 0 ? (1 - fy) * tDeltaY : fy * tDeltaY) : Infinity
  // The start tile never blocks (the player stands in it).
  for (let i = 0; i < 256; i++) {
    if (tx === endTx && ty === endTy) return false
    if (tMaxX < tMaxY) {
      tx += stepX
      tMaxX += tDeltaX
    } else {
      ty += stepY
      tMaxY += tDeltaY
    }
    if (tx === endTx && ty === endTy) return false
    if (tileAt(room, tx, ty) === '#') return true
  }
  return false
}

/** Point-in-rect test for portal trigger regions (tile units). */
export function inRect(x: number, y: number, r: { x: number; y: number; w: number; h: number }): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
}

/** Angle between facing direction and vector (dx, dy), in radians. */
function angleOffFacing(f: Facing, dx: number, dy: number): number {
  const v = facingVec(f)
  const want = Math.atan2(dy, dx)
  const have = Math.atan2(v.y, v.x)
  let d = want - have
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return Math.abs(d)
}

/** Is point (px,py) inside the sword arc swung from (x,y) towards facing? */
export function inSwordArc(
  x: number, y: number, f: Facing, px: number, py: number, reach: number,
): boolean {
  const dx = px - x
  const dy = py - y
  const d2 = dx * dx + dy * dy
  if (d2 > reach * reach || d2 === 0) return false
  return angleOffFacing(f, dx, dy) <= SWORD_ARC / 2
}

// ---------------------------------------------------------------------------
// Rooms: build from world data + permanent flags
// ---------------------------------------------------------------------------

export function enemyBaseStats(kind: EnemyKind): { hp: number; r: number } {
  if (kind === 'chaser') return { hp: 2, r: 0.4 }
  if (kind === 'wanderer') return { hp: 1, r: 0.35 }
  if (kind === 'turret') return { hp: 3, r: 0.4 }
  if (kind === 'bat') return { hp: 1, r: 0.3 }
  if (kind === 'knight') return { hp: 3, r: 0.55 }
  return { hp: 8, r: 0.9 } // slimeKnight
}

/** Fresh runtime enemy from an authored placement. */
export function spawnEnemy(p: EnemyPlacement): Enemy {
  const base = enemyBaseStats(p.kind)
  return {
    id: p.id,
    kind: p.kind,
    x: p.x,
    y: p.y,
    hp: base.hp,
    facing: p.facing ?? 'down',
    r: base.r,
    invuln: 0,
    knockback: null,
    brain: { t: 0, phase: 'idle', tell: 0 },
  }
}

function doorFlag(roomId: string, tx: number, ty: number): string {
  return `door:${roomId}:${tx},${ty}`
}

/**
 * Build a live RoomState from authored data, applying permanent progress:
 * opened chests vanish, taken pickups vanish, unlocked L/B doors are floor,
 * dead miniboss/boss never respawn, and S doors stand open in empty rooms.
 */
export function buildRoom(world: World, roomId: string, flags: string[]): RoomState {
  const room = world.rooms[roomId]
  if (!room) throw new Error(`unknown room ${roomId}`)
  const width = room.rows[0]?.length ?? 0
  const height = room.rows.length
  const tiles: TileChar[][] = room.rows.map((row) => [...row] as TileChar[])
  const enemies: Enemy[] = []
  for (const p of room.enemies) {
    if (flags.includes(`dead:${p.id}`)) continue
    if (p.kind === 'knight' && flags.includes('miniboss')) continue
    if (p.kind === 'slimeKnight' && flags.includes('boss')) continue
    enemies.push(spawnEnemy(p))
  }
  for (let ty = 0; ty < height; ty++) {
    for (let tx = 0; tx < width; tx++) {
      const ch = tiles[ty]?.[tx]
      if (ch === 'L' || ch === 'B') {
        if (flags.includes(doorFlag(roomId, tx, ty))) {
          const row = tiles[ty]
          if (row) row[tx] = '.'
        }
      }
    }
  }
  if (enemies.length === 0) {
    for (let ty = 0; ty < height; ty++) {
      const row = tiles[ty]
      if (!row) continue
      for (let tx = 0; tx < width; tx++) {
        if (row[tx] === 'S') row[tx] = '.'
      }
    }
  }
  const chestsClosed: string[] = []
  for (const c of room.chests) {
    if (flags.includes(`chest:${c.id}`)) continue
    if (c.requiresFlag && !flags.includes(c.requiresFlag)) continue
    chestsClosed.push(c.id)
  }
  const pickupsLeft: string[] = []
  for (const p of room.pickups) {
    if (flags.includes(`pickup:${p.id}`)) continue
    pickupsLeft.push(p.id)
  }
  return {
    id: roomId,
    width,
    height,
    tiles,
    enemies,
    projectiles: [],
    drops: [],
    chestsClosed,
    pickupsLeft,
    insidePortal: null,
  }
}

/** Resolve an entry id to a spawn point, falling back to the world start. */
export function entryFor(world: World, room: Room, entryId: string): { x: number; y: number; facing: Facing } {
  const direct = room.entries[entryId]
  if (direct) return { x: direct.x, y: direct.y, facing: direct.facing }
  const start = room.entries['start']
  if (start) return { x: start.x, y: start.y, facing: start.facing }
  const keys = Object.keys(room.entries)
  if (keys.length > 0) {
    const first = room.entries[keys[0] as string]
    if (first) return { x: first.x, y: first.y, facing: first.facing }
  }
  const sr = world.rooms[world.startRoom]
  const se = sr?.entries[world.startEntry]
  if (se) return { x: se.x, y: se.y, facing: se.facing }
  return { x: 1.5, y: 1.5, facing: 'down' }
}

/** Id of the portal whose trigger contains (x, y), or null. */
export function portalAt(room: Room, x: number, y: number): string | null {
  for (const p of room.portals) {
    if (inRect(x, y, p)) return p.id
  }
  return null
}

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v)
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((e) => typeof e === 'string')
}

/** Validate an unknown value from storage. Never throws. */
export function parseSave(raw: unknown): SaveData | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (o['v'] !== SAVE_VERSION) return null
  if (typeof o['room'] !== 'string' || o['room'].length === 0) return null
  if (typeof o['entry'] !== 'string' || o['entry'].length === 0) return null
  if (!isInt(o['hp']) || (o['hp'] as number) < 0 || (o['hp'] as number) > MAX_HEARTS) return null
  if (!isInt(o['maxHp']) || (o['maxHp'] as number) < 1 || (o['maxHp'] as number) > MAX_HEARTS) return null
  if (typeof o['hasSword'] !== 'boolean') return null
  if (!isInt(o['smallKeys']) || (o['smallKeys'] as number) < 0 || (o['smallKeys'] as number) > 999) return null
  if (typeof o['hasBossKey'] !== 'boolean') return null
  if (!isStringArray(o['flags'])) return null
  if (!isStringArray(o['containers'])) return null
  // rng is a signed int32 mulberry32 state (toSave emits state.rng | 0).
  if (!isInt(o['rng']) || (o['rng'] as number) < -0x80000000 || (o['rng'] as number) > 0xffffffff) return null
  if (typeof o['elapsed'] !== 'number' || !Number.isFinite(o['elapsed']) || (o['elapsed'] as number) < 0) return null
  return {
    v: SAVE_VERSION,
    room: o['room'] as string,
    entry: o['entry'] as string,
    hp: o['hp'] as number,
    maxHp: o['maxHp'] as number,
    hasSword: o['hasSword'] as boolean,
    smallKeys: o['smallKeys'] as number,
    hasBossKey: o['hasBossKey'] as boolean,
    flags: [...(o['flags'] as string[])],
    containers: [...(o['containers'] as string[])],
    rng: (o['rng'] as number) | 0,
    elapsed: o['elapsed'] as number,
  }
}

/** Serialize permanent progress + safe entry. Null for demo state. */
export function toSave(state: GameState): SaveData | null {
  if (state.demo) return null
  return {
    v: SAVE_VERSION,
    room: state.safe.room,
    entry: state.safe.entry,
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    hasSword: state.player.hasSword,
    smallKeys: state.player.smallKeys,
    hasBossKey: state.player.hasBossKey,
    flags: [...state.progress.flags],
    containers: [...state.progress.containers],
    rng: state.rng | 0,
    elapsed: state.elapsed,
  }
}

// ---------------------------------------------------------------------------
// createGame
// ---------------------------------------------------------------------------

export function maxHpFor(containers: string[]): number {
  return Math.min(MAX_HEARTS, START_HEARTS + containers.length)
}

/** New game, or resume from a save. Never throws on a bad save. */
export function createGame(world: World, opts?: { seed?: number; save?: SaveData | null; demo?: boolean }): GameState {
  const save = opts?.save ? parseSave(opts.save) : null
  const demo = opts?.demo ?? false
  const startRoom = world.rooms[world.startRoom]
  if (!startRoom) throw new Error(`unknown start room ${world.startRoom}`)

  if (save && world.rooms[save.room]) {
    const room = world.rooms[save.room] as Room
    const maxHp = maxHpFor(save.containers)
    const entry = entryFor(world, room, save.entry)
    const roomState = buildRoom(world, room.id, save.flags)
    roomState.insidePortal = portalAt(room, entry.x, entry.y)
    return {
      phase: 'play',
      room: roomState,
      player: {
        x: entry.x,
        y: entry.y,
        facing: entry.facing,
        hp: clamp(save.hp, 1, maxHp),
        maxHp,
        hasSword: save.hasSword,
        smallKeys: save.smallKeys,
        hasBossKey: save.hasBossKey,
        invuln: 0,
        swing: null,
        cooldown: 0,
        attackBuf: 0,
        knockback: null,
        vx: 0,
        vy: 0,
      },
      progress: { flags: [...save.flags], containers: [...save.containers] },
      safe: {
        room: room.id,
        entry: room.entries[save.entry] ? save.entry : room.entries['start'] ? 'start' : save.entry,
      },
      slide: null,
      dying: null,
      elapsed: save.elapsed,
      rng: save.rng,
      nextId: 1,
      shake: 0,
      demo,
    }
  }

  const entry = entryFor(world, startRoom, world.startEntry)
  const roomState = buildRoom(world, startRoom.id, [])
  roomState.insidePortal = portalAt(startRoom, entry.x, entry.y)
  return {
    phase: 'play',
    room: roomState,
    player: {
      x: entry.x,
      y: entry.y,
      facing: entry.facing,
      hp: START_HEARTS,
      maxHp: START_HEARTS,
      hasSword: false,
      smallKeys: 0,
      hasBossKey: false,
      invuln: 0,
      swing: null,
      cooldown: 0,
      attackBuf: 0,
      knockback: null,
      vx: 0,
      vy: 0,
    },
    progress: { flags: [], containers: [] },
    safe: { room: startRoom.id, entry: world.startEntry },
    slide: null,
    dying: null,
    elapsed: 0,
    rng: (opts?.seed ?? 0xc0ffee) | 0,
    nextId: 1,
    shake: 0,
    demo,
  }
}

// ---------------------------------------------------------------------------
// Player: movement, facing, knockback, damage
// ---------------------------------------------------------------------------

/** Clamp + dead-zone an analog stick vector. */
export function cleanMove(m: Vec): Vec {
  const len = Math.hypot(m.x, m.y)
  if (len < DEAD_ZONE || len === 0) return { x: 0, y: 0 }
  const s = Math.min(1, len) / len
  return { x: m.x * s, y: m.y * s }
}

/** One player movement substep. Facing follows the dominant axis. */
/**
 * Corner assist: an axis-aligned walk that is fully blocked slips sideways
 * when free passage lies within CORNER_ASSIST tiles — the player rounds tile
 * corners instead of snagging on them. Flat walls never qualify.
 */
function cornerAssist(
  room: RoomState, x: number, y: number, m: Vec, step: number, worldRoom: Room | null,
): { x: number; y: number } | null {
  const horizontal = Math.abs(m.x) > Math.abs(m.y) * 2
  const vertical = Math.abs(m.y) > Math.abs(m.x) * 2
  if (!horizontal && !vertical) return null
  const dir = Math.sign(horizontal ? m.x : m.y)
  const free = (px: number, py: number): boolean => !circleHitsSolid(room, px, py, PLAYER_RADIUS, worldRoom, false)
  for (let off = 0.05; off <= CORNER_ASSIST + 1e-9; off += 0.05) {
    for (const side of [-1, 1]) {
      const sx = horizontal ? x : x + side * off
      const sy = horizontal ? y + side * off : y
      const ax = horizontal ? sx + dir * step : sx
      const ay = horizontal ? sy : sy + dir * step
      if (!free(sx, sy) || !free(ax, ay)) continue
      const slip = side * Math.min(step, off)
      const nx = horizontal ? x : x + slip
      const ny = horizontal ? y + slip : y
      return free(nx, ny) ? { x: nx, y: ny } : null
    }
  }
  return null
}

export function stepPlayerMove(world: World, state: GameState, move: Vec, dt: number): void {
  const p = state.player
  const room = state.room
  const worldRoom = world.rooms[room.id] ?? null
  const m = cleanMove(move)
  const hasInput = m.x !== 0 || m.y !== 0
  const swinging = p.swing !== null
  if (hasInput && !swinging) {
    p.facing = dominantFacing(m.x, m.y, p.facing)
  }
  const vx = m.x * PLAYER_SPEED
  const vy = m.y * PLAYER_SPEED
  let moved = moveCircle(room, p.x, p.y, PLAYER_RADIUS, vx * dt, vy * dt, worldRoom, false)
  if (hasInput && Math.abs(moved.x - p.x) + Math.abs(moved.y - p.y) < PLAYER_SPEED * dt * 0.25) {
    moved = cornerAssist(room, p.x, p.y, m, PLAYER_SPEED * dt, worldRoom) ?? moved
  }
  p.x = moved.x
  p.y = moved.y
  p.vx = vx
  p.vy = vy
  // Knockback rides on top of voluntary movement and still hits walls.
  if (p.knockback) {
    const kb = p.knockback
    kb.t -= dt
    const k = Math.max(0, kb.t / KNOCKBACK_TIME)
    const kMoved = moveCircle(
      room, p.x, p.y, PLAYER_RADIUS,
      kb.vx * k * dt, kb.vy * k * dt, worldRoom, false,
    )
    p.x = kMoved.x
    p.y = kMoved.y
    if (kb.t <= 0) p.knockback = null
  }
}

/**
 * Hurt the player from a source point. Knights and boss slams deal 2,
 * everything else 1; hp never drops below 0. Returns true when damage
 * landed (false while invulnerable). Zero-hp starts the dying vignette.
 */
export function hurtPlayer(
  state: GameState, events: GameEvent[], sx: number, sy: number, heavy: boolean,
): boolean {
  const p = state.player
  if (state.phase !== 'play' || p.invuln > 0) return false
  const dmg = heavy ? 2 : 1
  p.hp = Math.max(0, p.hp - dmg)
  p.invuln = INVULN_TIME
  const dx = p.x - sx
  const dy = p.y - sy
  const len = Math.hypot(dx, dy) || 1
  p.knockback = { vx: (dx / len) * KNOCKBACK_SPEED, vy: (dy / len) * KNOCKBACK_SPEED, t: KNOCKBACK_TIME }
  state.shake = Math.max(state.shake, PLAYER_SHAKE)
  events.push({ type: 'playerHit', x: p.x, y: p.y })
  events.push({ type: 'hitStop', ms: 60 })
  if (p.hp <= 0) {
    state.phase = 'dying'
    state.dying = { t: DYING_TIME }
    events.push({ type: 'playerDied' })
  }
  return true
}

/** Tick invuln/cooldown/swing timers. */
export function tickPlayerTimers(state: GameState, dt: number): void {
  const p = state.player
  if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt)
  if (p.cooldown > 0) p.cooldown = Math.max(0, p.cooldown - dt)
  if (p.attackBuf > 0) p.attackBuf = Math.max(0, p.attackBuf - dt)
  if (p.swing) {
    p.swing.t += dt
    if (p.swing.t >= SWING_TIME) p.swing = null
  }
}

// ---------------------------------------------------------------------------
// Sword
// ---------------------------------------------------------------------------

/** Nearest enemy whose centre is within its own sword-hit range. */
function nearestEnemyInReach(state: GameState): Enemy | null {
  const p = state.player
  let best: Enemy | null = null
  let bestD2 = Infinity
  for (const e of state.room.enemies) {
    const range = SWORD_REACH + e.r
    const d2 = dist2(p.x, p.y, e.x, e.y)
    if (d2 <= range * range && d2 < bestD2) {
      best = e
      bestD2 = d2
    }
  }
  return best
}

/**
 * Attack edge: start a swing. Touch auto-face turns to the nearest enemy
 * in reach first (only when standing still). Needs the sword and cooldown.
 */
export function tryStartSwing(world: World, state: GameState, input: Input, events: GameEvent[]): void {
  void world
  const p = state.player
  if (!p.hasSword) return
  // Buffer the press: mashing a hair early still swings when the cooldown ends.
  if (input.attack) p.attackBuf = ATTACK_BUFFER
  if (p.attackBuf <= 0 || p.swing || p.cooldown > 0) return
  p.attackBuf = 0
  const m = cleanMove(input.move)
  if (input.autoFace && m.x === 0 && m.y === 0) {
    const near = nearestEnemyInReach(state)
    if (near) p.facing = dominantFacing(near.x - p.x, near.y - p.y, p.facing)
  }
  p.swing = { t: 0, facing: p.facing, hit: new Set<string>() }
  p.cooldown = SWING_COOLDOWN
  events.push({ type: 'swing' })
}

/** Is the knight guarding against a hit from (hx, hy)? Never in recovery. */
function knightGuards(e: Enemy, hx: number, hy: number): boolean {
  if (e.kind !== 'knight') return false
  if (e.brain['phase'] === 'recover') return false
  const v = facingVec(e.facing)
  const dx = hx - e.x
  const dy = hy - e.y
  const len = Math.hypot(dx, dy) || 1
  return (dx / len) * v.x + (dy / len) * v.y > 0
}

/** Apply the live arc: enemies, pots, grass, walls. Once per swing per id. */
export function stepSwingHits(world: World, state: GameState, events: GameEvent[]): void {
  const p = state.player
  const swing = p.swing
  if (!swing) return
  const room = state.room

  for (const e of room.enemies) {
    if (swing.hit.has(e.id)) continue
    const range = SWORD_REACH + e.r
    if (!inSwordArc(p.x, p.y, swing.facing, e.x, e.y, range)) continue
    if (rayBlockedByWall(room, p.x, p.y, e.x, e.y)) continue
    swing.hit.add(e.id)
    if (knightGuards(e, p.x, p.y)) {
      events.push({ type: 'swordClank', x: e.x, y: e.y })
      continue
    }
    damageEnemy(world, state, e, p.x, p.y, events)
  }

  // Pots and grass whose tile centre is in the arc. Reach + half a tile so
  // all eight neighbouring tiles are hittable when faced.
  const reach = SWORD_REACH + 0.5
  const x0 = Math.floor(p.x - reach)
  const x1 = Math.floor(p.x + reach)
  const y0 = Math.floor(p.y - reach)
  const y1 = Math.floor(p.y + reach)
  const keyPrefix = 'tile:'
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const ch = tileAt(room, tx, ty)
      if (ch !== 'o' && ch !== '~') continue
      const cx = tx + 0.5
      const cy = ty + 0.5
      if (!inSwordArc(p.x, p.y, swing.facing, cx, cy, reach)) continue
      const key = `${keyPrefix}${tx},${ty}`
      if (swing.hit.has(key)) continue
      swing.hit.add(key)
      const row = room.tiles[ty]
      if (!row) continue
      row[tx] = '.'
      if (ch === 'o') {
        events.push({ type: 'potSmash', x: cx, y: cy })
        if (draw(state) < POT_HEART_CHANCE) spawnDrop(state, 'heart', cx, cy)
      } else {
        events.push({ type: 'grassCut', x: cx, y: cy })
        if (draw(state) < GRASS_HEART_CHANCE) spawnDrop(state, 'heart', cx, cy)
      }
    }
  }

  // Clank when the arc meets a wall tile (once per swing).
  if (!swing.hit.has('wall')) {
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tileAt(room, tx, ty) !== '#') continue
        if (!inSwordArc(p.x, p.y, swing.facing, tx + 0.5, ty + 0.5, reach)) continue
        swing.hit.add('wall')
        events.push({ type: 'swordClank', x: tx + 0.5, y: ty + 0.5 })
        ty = y1 + 1
        break
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Enemies, part A: movement brains, projectiles, contact damage
// ---------------------------------------------------------------------------

/** Decrement the shared enemy timers (i-frames, knockback). */
export function tickEnemyTimers(e: Enemy, dt: number): void {
  if (e.invuln > 0) e.invuln = Math.max(0, e.invuln - dt)
  if (e.knockback) {
    e.knockback.t -= dt
    if (e.knockback.t <= 0) e.knockback = null
  }
  const cd = e.brain['cd']
  if (typeof cd === 'number' && cd > 0) e.brain['cd'] = Math.max(0, cd - dt)
}

/** Apply an enemy's knockback drift (wall-colliding). */
function driftKnockback(world: World, state: GameState, e: Enemy, dt: number, fly: boolean): void {
  const kb = e.knockback
  if (!kb) return
  const room = state.room
  const worldRoom = world.rooms[room.id] ?? null
  const k = Math.max(0, kb.t / ENEMY_KNOCKBACK_TIME)
  const moved = moveCircle(room, e.x, e.y, e.r, kb.vx * k * dt, kb.vy * k * dt, worldRoom, fly)
  e.x = moved.x
  e.y = moved.y
}

/** Pick a random unit direction through the gameplay rng. */
function randomDir(state: GameState): Vec {
  const a = draw(state) * Math.PI * 2
  return { x: Math.cos(a), y: Math.sin(a) }
}

function stepChaser(world: World, state: GameState, e: Enemy, dt: number): void {
  const p = state.player
  const room = state.room
  const worldRoom = world.rooms[room.id] ?? null
  const brain = e.brain
  const d = Math.hypot(p.x - e.x, p.y - e.y) || 0.0001
  const phase = (brain['phase'] as string) ?? 'chase'
  if (phase === 'tell') {
    brain['t'] = (brain['t'] as number) - dt
    brain['tell'] = Math.max(0, brain['t'] as number)
    if ((brain['t'] as number) <= 0) {
      brain['phase'] = 'lunge'
      brain['t'] = 0.4
      brain['tell'] = 0
    }
    return
  }
  if (phase === 'lunge') {
    const lx = (brain['lx'] as number) ?? 0
    const ly = (brain['ly'] as number) ?? 1
    const moved = moveCircle(room, e.x, e.y, e.r, lx * 7 * dt, ly * 7 * dt, worldRoom, false)
    e.x = moved.x
    e.y = moved.y
    brain['t'] = (brain['t'] as number) - dt
    if ((brain['t'] as number) <= 0) {
      brain['phase'] = 'chase'
      brain['cd'] = 1.5
    }
    return
  }
  // chase / wander
  if (d <= 6) {
    brain['phase'] = 'chase'
    const cd = (brain['cd'] as number) ?? 0
    if (d <= 3 && cd <= 0) {
      brain['phase'] = 'tell'
      brain['t'] = 0.3
      brain['tell'] = 0.3
      brain['lx'] = (p.x - e.x) / d
      brain['ly'] = (p.y - e.y) / d
      return
    }
    const moved = moveCircle(room, e.x, e.y, e.r, ((p.x - e.x) / d) * 3.2 * dt, ((p.y - e.y) / d) * 3.2 * dt, worldRoom, false)
    e.x = moved.x
    e.y = moved.y
    e.facing = dominantFacing(p.x - e.x, p.y - e.y, e.facing)
  } else {
    brain['phase'] = 'wander'
    let t = (brain['t'] as number) ?? 0
    t -= dt
    if (t <= 0) {
      const dir = randomDir(state)
      brain['dx'] = dir.x
      brain['dy'] = dir.y
      t = 1 + draw(state) * 1
    }
    brain['t'] = t
    const dx = (brain['dx'] as number) ?? 1
    const dy = (brain['dy'] as number) ?? 0
    const moved = moveCircle(room, e.x, e.y, e.r, dx * 1.5 * dt, dy * 1.5 * dt, worldRoom, false)
    e.x = moved.x
    e.y = moved.y
  }
}

function stepWanderer(world: World, state: GameState, e: Enemy, dt: number): void {
  const room = state.room
  const worldRoom = world.rooms[room.id] ?? null
  const brain = e.brain
  let t = (brain['t'] as number) ?? 0
  t -= dt
  if (t <= 0 || brain['dx'] === undefined) {
    const dir = randomDir(state)
    brain['dx'] = dir.x
    brain['dy'] = dir.y
    t = 1 + draw(state) * 1
  }
  brain['t'] = t
  let dx = brain['dx'] as number
  let dy = brain['dy'] as number
  // Bounce off walls axis by axis.
  const nx = e.x + dx * 2 * dt
  if (circleHitsSolid(room, nx, e.y, e.r, worldRoom, false)) {
    dx = -dx
    brain['dx'] = dx
  } else {
    e.x = nx
  }
  const ny = e.y + dy * 2 * dt
  if (circleHitsSolid(room, e.x, ny, e.r, worldRoom, false)) {
    dy = -dy
    brain['dy'] = dy
  } else {
    e.y = ny
  }
}

function stepTurret(world: World, state: GameState, e: Enemy, dt: number, events: GameEvent[]): void {
  void world
  const brain = e.brain
  const phase = (brain['phase'] as string) ?? 'idle'
  if (phase === 'tell') {
    brain['t'] = (brain['t'] as number) - dt
    brain['tell'] = Math.max(0, brain['t'] as number)
    if ((brain['t'] as number) <= 0) {
      brain['phase'] = 'idle'
      brain['t'] = 1.2
      brain['tell'] = 0
      if (state.room.projectiles.length < MAX_PROJECTILES) {
        const v = facingVec(e.facing)
        state.room.projectiles.push({
          id: state.nextId++,
          x: e.x + v.x * (e.r + 0.2),
          y: e.y + v.y * (e.r + 0.2),
          vx: v.x * 4.5,
          vy: v.y * 4.5,
          r: 0.18,
          owner: 'enemy',
        })
        events.push({ type: 'shoot', x: e.x, y: e.y })
      }
    }
    return
  }
  brain['phase'] = 'idle'
  brain['t'] = ((brain['t'] as number) ?? 1.2) - dt
  if ((brain['t'] as number) <= 0) {
    brain['phase'] = 'tell'
    brain['t'] = 0.4
    brain['tell'] = 0.4
  }
}

function stepBat(world: World, state: GameState, e: Enemy, dt: number): void {
  const p = state.player
  const room = state.room
  const worldRoom = world.rooms[room.id] ?? null
  const brain = e.brain
  brain['t'] = ((brain['t'] as number) ?? 0) + dt
  const t = brain['t'] as number
  const dx = p.x - e.x
  const dy = p.y - e.y
  const d = Math.hypot(dx, dy) || 0.0001
  // Sine flight toward the player; only '#' blocks a bat.
  const px = -dy / d
  const py = dx / d
  const wobble = Math.sin(t * 6) * 1.6
  const vx = (dx / d) * 3.5 + px * wobble
  const vy = (dy / d) * 3.5 + py * wobble
  const moved = moveCircle(room, e.x, e.y, e.r, vx * dt, vy * dt, worldRoom, true)
  e.x = moved.x
  e.y = moved.y
  e.facing = dominantFacing(dx, dy, e.facing)
}

/** Move projectiles; kill them on solid-except-water tiles, hurt on contact. */
export function stepProjectiles(world: World, state: GameState, dt: number, events: GameEvent[]): void {
  void world
  const room = state.room
  const kept: Projectile[] = []
  for (const pr of room.projectiles) {
    pr.x += pr.vx * dt
    pr.y += pr.vy * dt
    const { tx, ty } = worldToTile(pr.x, pr.y)
    const ch = tileAt(room, tx, ty)
    if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height || blocksProjectile(ch)) continue
    const p = state.player
    if (dist2(pr.x, pr.y, p.x, p.y) < (pr.r + PLAYER_RADIUS) * (pr.r + PLAYER_RADIUS)) {
      hurtPlayer(state, events, pr.x, pr.y, false)
      continue
    }
    kept.push(pr)
  }
  room.projectiles = kept
}

/** Contact damage for every enemy touching the player. */
export function stepEnemyContact(state: GameState, events: GameEvent[]): void {
  const p = state.player
  for (const e of state.room.enemies) {
    const rr = e.r + PLAYER_RADIUS
    if (dist2(p.x, p.y, e.x, e.y) < rr * rr) {
      hurtPlayer(state, events, e.x, e.y, e.kind === 'knight' || e.kind === 'slimeKnight')
    }
  }
}

// ---------------------------------------------------------------------------
// Enemies, part B: knight, boss, damage/death, drops
// ---------------------------------------------------------------------------

function stepKnight(world: World, state: GameState, e: Enemy, dt: number): void {
  const p = state.player
  const room = state.room
  const worldRoom = world.rooms[room.id] ?? null
  const brain = e.brain
  const phase = (brain['phase'] as string) ?? 'guard'
  const dx = p.x - e.x
  const dy = p.y - e.y
  const d = Math.hypot(dx, dy) || 0.0001
  if (phase === 'tell') {
    brain['t'] = (brain['t'] as number) - dt
    brain['tell'] = Math.max(0, brain['t'] as number)
    if ((brain['t'] as number) <= 0) {
      brain['phase'] = 'charge'
      brain['t'] = 0.5
      brain['tell'] = 0
      brain['lx'] = dx / d
      brain['ly'] = dy / d
    }
    return
  }
  if (phase === 'charge') {
    const lx = (brain['lx'] as number) ?? 0
    const ly = (brain['ly'] as number) ?? 1
    e.facing = dominantFacing(lx, ly, e.facing)
    const moved = moveCircle(room, e.x, e.y, e.r, lx * 6 * dt, ly * 6 * dt, worldRoom, false)
    e.x = moved.x
    e.y = moved.y
    brain['t'] = (brain['t'] as number) - dt
    if ((brain['t'] as number) <= 0) {
      brain['phase'] = 'recover'
      brain['t'] = 0.7
    }
    return
  }
  if (phase === 'recover') {
    brain['t'] = (brain['t'] as number) - dt
    if ((brain['t'] as number) <= 0) {
      brain['phase'] = 'guard'
      brain['cd'] = 1.0
    }
    return
  }
  // guard: drift toward the player, charge at what it can see ahead.
  brain['phase'] = 'guard'
  if (d <= 5 && d > 0.01) {
    const moved = moveCircle(room, e.x, e.y, e.r, (dx / d) * 1.5 * dt, (dy / d) * 1.5 * dt, worldRoom, false)
    e.x = moved.x
    e.y = moved.y
  }
  const cd = (brain['cd'] as number) ?? 0
  const v = facingVec(e.facing)
  const ahead = (dx / d) * v.x + (dy / d) * v.y > 0
  if (d <= 2.5 && ahead && cd <= 0) {
    brain['phase'] = 'tell'
    brain['t'] = 0.5
    brain['tell'] = 0.5
  }
}

function aliveWanderers(state: GameState): number {
  let n = 0
  for (const e of state.room.enemies) if (e.kind === 'wanderer') n++
  return n
}

function stepBoss(world: World, state: GameState, e: Enemy, dt: number, events: GameEvent[]): void {
  const p = state.player
  const room = state.room
  const worldRoom = world.rooms[room.id] ?? null
  const brain = e.brain
  const phase = (brain['phase'] as string) ?? 'hop'
  const stage = (brain['stage'] as number) ?? 1
  const dx = p.x - e.x
  const dy = p.y - e.y
  const d = Math.hypot(dx, dy) || 0.0001
  if (phase === 'tell') {
    brain['t'] = (brain['t'] as number) - dt
    brain['tell'] = Math.max(0, brain['t'] as number)
    if ((brain['t'] as number) <= 0) {
      // The slam lands now.
      const rr = 1.6 + PLAYER_RADIUS
      if (dist2(p.x, p.y, e.x, e.y) < rr * rr) {
        hurtPlayer(state, events, e.x, e.y, true)
      }
      state.shake = Math.max(state.shake, SLAM_SHAKE)
      const slams = ((brain['slams'] as number) ?? 0) + 1
      brain['slams'] = slams
      if (stage === 1 && e.hp <= 4) {
        brain['stage'] = 2
        events.push({ type: 'bossPhase', phase: 2 })
      }
      const nowStage = (brain['stage'] as number) ?? 1
      if (nowStage === 2 && slams % 2 === 0) {
        let want = 0
        const alive = aliveWanderers(state)
        if (alive < 4) want = Math.min(2, 4 - alive)
        for (let i = 0; i < want; i++) {
          if (room.enemies.length >= 24) break
          const a = draw(state) * Math.PI * 2
          const w = spawnEnemy({
            id: `boss.spawn${state.nextId++}`,
            kind: 'wanderer',
            x: clamp(e.x + Math.cos(a) * 1.2, 1, room.width - 1),
            y: clamp(e.y + Math.sin(a) * 1.2, 1, room.height - 1),
          })
          room.enemies.push(w)
        }
      }
      brain['phase'] = 'recover'
      brain['t'] = 0.7
      brain['tell'] = 0
    }
    return
  }
  if (phase === 'recover') {
    brain['t'] = (brain['t'] as number) - dt
    if ((brain['t'] as number) <= 0) {
      brain['phase'] = 'hop'
      brain['t'] = 0.7
    }
    return
  }
  // hop toward the player, then the telegraphed slam.
  brain['phase'] = 'hop'
  if (d > 0.01) {
    const moved = moveCircle(room, e.x, e.y, e.r, (dx / d) * 3 * dt, (dy / d) * 3 * dt, worldRoom, false)
    e.x = moved.x
    e.y = moved.y
  }
  brain['t'] = ((brain['t'] as number) ?? 0.7) - dt
  if ((brain['t'] as number) <= 0) {
    brain['phase'] = 'tell'
    brain['t'] = 0.6
    brain['tell'] = 0.6
  }
}

/** Bounded drop spawn. Drops beyond MAX_DROPS are silently skipped. */
export function spawnDrop(state: GameState, kind: Drop['kind'], x: number, y: number): void {
  if (state.room.drops.length >= MAX_DROPS) return
  state.room.drops.push({ id: state.nextId++, kind, x, y, t: 0 })
}

/**
 * Damage an enemy from (fromX, fromY). Emits swordHit (killed or not),
 * enemyDied + boss bookkeeping on death. Hits during i-frames are ignored.
 */
export function damageEnemy(world: World, state: GameState, e: Enemy, fromX: number, fromY: number, events: GameEvent[]): void {
  if (e.invuln > 0) return
  e.hp -= 1
  e.invuln = ENEMY_INVULN
  const dx = e.x - fromX
  const dy = e.y - fromY
  const len = Math.hypot(dx, dy) || 1
  e.knockback = {
    vx: (dx / len) * ENEMY_KNOCKBACK_SPEED,
    vy: (dy / len) * ENEMY_KNOCKBACK_SPEED,
    t: ENEMY_KNOCKBACK_TIME,
  }
  if (e.hp <= 0) {
    state.room.enemies = state.room.enemies.filter((o) => o !== e)
    events.push({ type: 'swordHit', x: e.x, y: e.y, enemyId: e.id, killed: true })
    events.push({ type: 'enemyDied', x: e.x, y: e.y, kind: e.kind })
    events.push({ type: 'hitStop', ms: 40 })
    if (e.kind === 'knight') {
      addFlag(state, 'miniboss')
      events.push({ type: 'bossDefeated', kind: 'knight' })
    } else if (e.kind === 'slimeKnight') {
      addFlag(state, 'boss')
      events.push({ type: 'bossDefeated', kind: 'slimeKnight' })
    } else if (draw(state) < ENEMY_HEART_CHANCE) {
      spawnDrop(state, 'heart', e.x, e.y)
    }
    refreshVisibleChests(world, state)
    openShutDoors(state, events)
    return
  }
  events.push({ type: 'swordHit', x: e.x, y: e.y, enemyId: e.id, killed: false })
}

/** One enemy substep: timers, knockback drift, brain, (contact is separate). */
export function stepEnemy(world: World, state: GameState, e: Enemy, dt: number, events: GameEvent[]): void {
  tickEnemyTimers(e, dt)
  driftKnockback(world, state, e, dt, e.kind === 'bat')
  if (e.kind === 'chaser') stepChaser(world, state, e, dt)
  else if (e.kind === 'wanderer') stepWanderer(world, state, e, dt)
  else if (e.kind === 'turret') stepTurret(world, state, e, dt, events)
  else if (e.kind === 'bat') stepBat(world, state, e, dt)
  else if (e.kind === 'knight') stepKnight(world, state, e, dt)
  else stepBoss(world, state, e, dt, events)
}

// ---------------------------------------------------------------------------
// Items: flags, drops, chests, pickups, rewards, doors, portals
// ---------------------------------------------------------------------------

export function addFlag(state: GameState, flag: string): void {
  if (!state.progress.flags.includes(flag)) state.progress.flags.push(flag)
}

function findChest(world: World, roomId: string, id: string): ChestPlacement | null {
  const room = world.rooms[roomId]
  if (!room) return null
  for (const c of room.chests) if (c.id === id) return c
  return null
}

function findPickup(world: World, roomId: string, id: string): PickupPlacement | null {
  const room = world.rooms[roomId]
  if (!room) return null
  for (const p of room.pickups) if (p.id === id) return p
  return null
}

/** Apply a chest/pickup reward. Emits `reward` (chests also get chestOpened). */
export function applyReward(state: GameState, reward: ChestReward, sourceId: string, events: GameEvent[]): void {
  const p = state.player
  if (reward.kind === 'sword') {
    p.hasSword = true
  } else if (reward.kind === 'smallKey') {
    p.smallKeys += 1
  } else if (reward.kind === 'bossKey') {
    p.hasBossKey = true
  } else if (reward.kind === 'heartContainer') {
    if (!state.progress.containers.includes(sourceId)) state.progress.containers.push(sourceId)
    p.maxHp = maxHpFor(state.progress.containers)
    p.hp = p.maxHp
  } else if (reward.kind === 'bossKeyAndHeartContainer') {
    p.hasBossKey = true
    if (!state.progress.containers.includes(sourceId)) state.progress.containers.push(sourceId)
    p.maxHp = maxHpFor(state.progress.containers)
    p.hp = p.maxHp
  } else {
    addFlag(state, 'won')
    state.phase = 'won'
    events.push({ type: 'won', elapsed: state.elapsed })
  }
  events.push({ type: 'reward', reward })
}

/** Re-add chests whose requiresFlag just became satisfied (e.g. relic after boss). */
export function refreshVisibleChests(world: World, state: GameState): void {
  const worldRoom = world.rooms[state.room.id]
  if (!worldRoom) return
  for (const c of worldRoom.chests) {
    if (state.progress.flags.includes(`chest:${c.id}`)) continue
    if (c.requiresFlag && !state.progress.flags.includes(c.requiresFlag)) continue
    if (!state.room.chestsClosed.includes(c.id)) state.room.chestsClosed.push(c.id)
  }
}

/** Interact edge: open the nearest closed chest within 1.1 tiles. */
export function tryInteract(world: World, state: GameState, events: GameEvent[]): void {
  const p = state.player
  const room = state.room
  let best: ChestPlacement | null = null
  let bestD2 = 1.1 * 1.1
  for (const id of room.chestsClosed) {
    const c = findChest(world, room.id, id)
    if (!c) continue
    const d2 = dist2(p.x, p.y, c.x + 0.5, c.y + 0.5)
    if (d2 <= bestD2) {
      bestD2 = d2
      best = c
    }
  }
  if (best) {
    room.chestsClosed = room.chestsClosed.filter((id) => id !== best?.id)
    addFlag(state, `chest:${best.id}`)
    events.push({ type: 'chestOpened', id: best.id, reward: best.reward })
    applyReward(state, best.reward, best.id, events)
    refreshVisibleChests(world, state)
    return
  }
  // No chest: try an adjacent locked door.
  tryUnlockAdjacent(world, state, events)
}

/** Age drops (8 s lifetime) and pick up overlapping ones. */
export function stepDrops(state: GameState, dt: number, events: GameEvent[]): void {
  const p = state.player
  const kept: Drop[] = []
  for (const d of state.room.drops) {
    d.t += dt
    if (d.t > DROP_LIFETIME) continue
    const rr = 0.3 + PLAYER_RADIUS
    if (dist2(p.x, p.y, d.x, d.y) < rr * rr) {
      if (d.kind === 'heart') p.hp = Math.min(p.maxHp, p.hp + 1)
      else p.smallKeys += 1
      events.push({ type: 'pickup', kind: d.kind })
      continue
    }
    kept.push(d)
  }
  state.room.drops = kept
}

/** Floor pickups are taken by walking over them. */
export function stepFloorPickups(world: World, state: GameState, events: GameEvent[]): void {
  const p = state.player
  const room = state.room
  const left: string[] = []
  for (const id of room.pickupsLeft) {
    const pk = findPickup(world, room.id, id)
    if (!pk) continue
    const rr = 0.3 + PLAYER_RADIUS
    if (dist2(p.x, p.y, pk.x, pk.y) < rr * rr) {
      addFlag(state, `pickup:${id}`)
      applyReward(state, pk.reward, id, events)
      refreshVisibleChests(world, state)
    } else {
      left.push(id)
    }
  }
  room.pickupsLeft = left
}

/** Unlock one L/B tile. Key consumption and tile change are atomic. */
function unlockDoorTile(state: GameState, tx: number, ty: number, events: GameEvent[]): boolean {
  const room = state.room
  const row = room.tiles[ty]
  if (!row) return false
  const ch = row[tx]
  const p = state.player
  if (ch === 'L') {
    if (p.smallKeys <= 0) return false
    p.smallKeys -= 1
    row[tx] = '.'
    addFlag(state, doorFlag(room.id, tx, ty))
    events.push({ type: 'doorUnlocked', x: tx + 0.5, y: ty + 0.5 })
    return true
  }
  if (ch === 'B') {
    if (!p.hasBossKey) return false
    row[tx] = '.'
    addFlag(state, doorFlag(room.id, tx, ty))
    events.push({ type: 'doorUnlocked', x: tx + 0.5, y: ty + 0.5 })
    return true
  }
  return false
}

/** Tiles overlapping the player's circle (for contact-unlock). */
function playerOverlapTiles(state: GameState): Array<{ tx: number; ty: number }> {
  const p = state.player
  const out: Array<{ tx: number; ty: number }> = []
  const r = PLAYER_RADIUS + 0.02
  for (let ty = Math.floor(p.y - r); ty <= Math.floor(p.y + r); ty++) {
    for (let tx = Math.floor(p.x - r); tx <= Math.floor(p.x + r); tx++) {
      const cx = clamp(p.x, tx, tx + 1)
      const cy = clamp(p.y, ty, ty + 1)
      const dx = p.x - cx
      const dy = p.y - cy
      if (dx * dx + dy * dy < r * r) out.push({ tx, ty })
    }
  }
  return out
}

/** Walking into a locked door with the key opens it. */
export function stepDoorContact(state: GameState, events: GameEvent[]): void {
  for (const t of playerOverlapTiles(state)) {
    const row = state.room.tiles[t.ty]
    if (!row) continue
    const ch = row[t.tx]
    if (ch === 'L' || ch === 'B') unlockDoorTile(state, t.tx, t.ty, events)
  }
}

/** Interact edge against a nearby locked door. */
function tryUnlockAdjacent(world: World, state: GameState, events: GameEvent[]): void {
  void world
  const p = state.player
  const room = state.room
  for (let ty = Math.floor(p.y - 1.6); ty <= Math.floor(p.y + 1.6); ty++) {
    for (let tx = Math.floor(p.x - 1.6); tx <= Math.floor(p.x + 1.6); tx++) {
      const row = room.tiles[ty]
      if (!row) continue
      const ch = row[tx]
      if (ch !== 'L' && ch !== 'B') continue
      if (dist2(p.x, p.y, tx + 0.5, ty + 0.5) > 1.1 * 1.1) continue
      if (unlockDoorTile(state, tx, ty, events)) return
    }
  }
}

/** Open every S door once the room is empty. Emits doorOpened per tile. */
export function openShutDoors(state: GameState, events: GameEvent[]): void {
  if (state.room.enemies.length > 0) return
  const room = state.room
  for (let ty = 0; ty < room.height; ty++) {
    const row = room.tiles[ty]
    if (!row) continue
    for (let tx = 0; tx < room.width; tx++) {
      if (row[tx] === 'S') {
        row[tx] = '.'
        events.push({ type: 'doorOpened', x: tx + 0.5, y: ty + 0.5 })
      }
    }
  }
}

/** Portal triggers: entering a fresh trigger starts the slide. */
export function stepPortals(world: World, state: GameState, events: GameEvent[]): void {
  const room = state.room
  const worldRoom = world.rooms[room.id]
  if (!worldRoom) return
  const p = state.player
  if (room.insidePortal) {
    const cur = worldRoom.portals.find((q) => q.id === room.insidePortal) ?? null
    if (!cur || !inRect(p.x, p.y, cur)) room.insidePortal = null
  }
  for (const portal of worldRoom.portals) {
    if (room.insidePortal === portal.id) continue
    if (!inRect(p.x, p.y, portal)) continue
    room.insidePortal = portal.id
    state.phase = 'slide'
    state.slide = {
      from: room.id,
      to: portal.toRoom,
      dir: portal.dir,
      t: 0,
      toX: portal.toX,
      toY: portal.toY,
      entry: portal.id,
    }
    events.push({ type: 'slideStart', dir: portal.dir })
    return
  }
}

/** Finish a slide: build the destination room and place the player. */
export function arriveSlide(world: World, state: GameState, events: GameEvent[]): void {
  const slide = state.slide
  if (!slide) {
    state.phase = 'play'
    return
  }
  const dest = world.rooms[slide.to]
  if (!dest) {
    state.phase = 'play'
    state.slide = null
    return
  }
  const room = buildRoom(world, dest.id, state.progress.flags)
  const p = state.player
  p.x = slide.toX
  p.y = slide.toY
  p.vx = 0
  p.vy = 0
  p.swing = null
  p.knockback = null
  room.insidePortal = portalAt(dest, slide.toX, slide.toY)
  state.room = room
  state.phase = 'play'
  state.slide = null
  if (dest.entries[slide.entry]) state.safe = { room: dest.id, entry: slide.entry }
  else if (dest.entries['start']) state.safe = { room: dest.id, entry: 'start' }
  events.push({ type: 'roomEnter', room: dest.id, name: dest.name, area: dest.area })
}

// ---------------------------------------------------------------------------
// respawn, stepGame, autopilot, engine const
// ---------------------------------------------------------------------------

/**
 * Respawn at the safe entry with hp = maxHp. The room is rebuilt from world
 * data (enemies, pots, grass reset); open chests, taken pickups and unlocked
 * doors stay per progress.flags. Emits respawn + roomEnter.
 */
export function respawn(world: World, state: GameState): GameEvent[] {
  const events: GameEvent[] = []
  const startRoom = world.rooms[world.startRoom]
  const safeRoom = world.rooms[state.safe.room] ?? startRoom
  if (!safeRoom) throw new Error('world has no rooms')
  const entry = entryFor(world, safeRoom, state.safe.entry)
  const room = buildRoom(world, safeRoom.id, state.progress.flags)
  room.insidePortal = portalAt(safeRoom, entry.x, entry.y)
  state.room = room
  const p = state.player
  p.x = entry.x
  p.y = entry.y
  p.facing = entry.facing
  p.hp = p.maxHp
  p.invuln = INVULN_TIME
  p.swing = null
  p.cooldown = 0
  p.knockback = null
  p.vx = 0
  p.vy = 0
  state.phase = 'play'
  state.slide = null
  state.dying = null
  state.shake = 0
  events.push({ type: 'respawn', room: safeRoom.id })
  events.push({ type: 'roomEnter', room: safeRoom.id, name: safeRoom.name, area: safeRoom.area })
  return events
}

/** One fixed substep of live play. Events append in order. */
function playSubstep(world: World, state: GameState, input: Input, events: GameEvent[]): void {
  state.elapsed += STEP
  stepPlayerMove(world, state, input.move, STEP)
  tryStartSwing(world, state, input, events)
  stepSwingHits(world, state, events)
  if (input.interact) tryInteract(world, state, events)
  stepDoorContact(state, events)
  // damageEnemy can remove entries — iterate over a snapshot.
  const foes = [...state.room.enemies]
  for (const e of foes) {
    if (!state.room.enemies.includes(e)) continue
    stepEnemy(world, state, e, STEP, events)
  }
  stepProjectiles(world, state, STEP, events)
  stepEnemyContact(state, events)
  if (state.phase !== 'play') return
  stepDrops(state, STEP, events)
  stepFloorPickups(world, state, events)
  if (state.phase !== 'play') return
  stepPortals(world, state, events)
  tickPlayerTimers(state, STEP)
}

/**
 * Advance by dt seconds using fixed STEP substeps. At most MAX_CATCH_UP
 * (0.25 s) is simulated per call; the rest is discarded. Elapsed play time
 * accrues only in phase 'play' — slides and dying are frozen presentation.
 */
export function stepGame(world: World, state: GameState, dt: number, input: Input): GameEvent[] {
  const events: GameEvent[] = []
  if (!Number.isFinite(dt) || dt <= 0) return events
  let budget = Math.min(dt, MAX_CATCH_UP)
  if (state.phase === 'won') return events
  while (budget >= STEP) {
    if (state.phase === 'play') {
      playSubstep(world, state, input, events)
    } else if (state.phase === 'slide') {
      const slide = state.slide
      if (!slide) {
        state.phase = 'play'
        continue
      }
      slide.t += STEP
      if (slide.t >= SLIDE_TIME) arriveSlide(world, state, events)
    } else if (state.phase === 'dying') {
      const dying = state.dying
      if (!dying) {
        events.push(...respawn(world, state))
      } else {
        dying.t -= STEP
        if (dying.t <= 0) events.push(...respawn(world, state))
      }
    } else {
      break
    }
    budget -= STEP
  }
  return events
}

// ---------------------------------------------------------------------------
// Autopilot (attract mode): deterministic wander, never leaves the room.
// ---------------------------------------------------------------------------

function portalDanger(world: World, roomId: string, x: number, y: number, margin: number): Portal | null {
  const room = world.rooms[roomId]
  if (!room) return null
  const portals: Portal[] = room.portals
  for (const portal of portals) {
    if (
      x >= portal.x - margin && x < portal.x + portal.w + margin &&
      y >= portal.y - margin && y < portal.y + portal.h + margin
    ) return portal
  }
  return null
}

function probeHitsPortal(world: World, roomId: string, x: number, y: number): boolean {
  const room = world.rooms[roomId]
  if (!room) return true
  for (const portal of room.portals) {
    if (inRect(x, y, portal)) return true
  }
  return false
}

/**
 * Attract-mode input: walk to the nearest pot, chest, pickup or enemy,
 * swing when something is within reach, retreat from telegraphed attacks,
 * and turn away one tile before any portal trigger.
 */
export function autopilot(world: World, state: GameState): Input {
  const calm: Input = { move: { x: 0, y: 0 }, attack: false, interact: false, autoFace: true }
  if (state.phase !== 'play') return calm
  const p = state.player
  const room = state.room
  const worldRoom = world.rooms[room.id]

  // Retreat from anything about to land.
  let threat: Enemy | null = null
  let threatD2 = 3.5 * 3.5
  for (const e of room.enemies) {
    if (e.brain['tell'] !== undefined && (e.brain['tell'] as number) > 0) {
      const d2 = dist2(p.x, p.y, e.x, e.y)
      if (d2 < threatD2) {
        threatD2 = d2
        threat = e
      }
    }
  }
  if (threat) {
    const dx = p.x - threat.x
    const dy = p.y - threat.y
    const d = Math.hypot(dx, dy) || 1
    return { move: steerClearOfPortals(world, state, { x: dx / d, y: dy / d }), attack: false, interact: false, autoFace: true }
  }

  // Nearest point of interest: enemies, pots, chests, floor pickups.
  let tx = p.x
  let ty = p.y
  let bestD2 = Infinity
  let targetKind = ''
  for (const e of room.enemies) {
    const d2 = dist2(p.x, p.y, e.x, e.y)
    if (d2 < bestD2) {
      bestD2 = d2
      tx = e.x
      ty = e.y
      targetKind = 'enemy'
    }
  }
  const reach = SWORD_REACH + 0.5
  for (let y = 0; y < room.height; y++) {
    const row = room.tiles[y]
    if (!row) continue
    for (let x = 0; x < room.width; x++) {
      if (row[x] !== 'o') continue
      const d2 = dist2(p.x, p.y, x + 0.5, y + 0.5)
      if (d2 < bestD2) {
        bestD2 = d2
        tx = x + 0.5
        ty = y + 0.5
        targetKind = 'pot'
      }
    }
  }
  if (worldRoom) {
    for (const id of room.chestsClosed) {
      const c = worldRoom.chests.find((k) => k.id === id)
      if (!c) continue
      const d2 = dist2(p.x, p.y, c.x + 0.5, c.y + 0.5)
      if (d2 < bestD2) {
        bestD2 = d2
        tx = c.x + 0.5
        ty = c.y + 0.5
        targetKind = 'chest'
      }
    }
    for (const id of room.pickupsLeft) {
      const k = worldRoom.pickups.find((q) => q.id === id)
      if (!k) continue
      const d2 = dist2(p.x, p.y, k.x, k.y)
      if (d2 < bestD2) {
        bestD2 = d2
        tx = k.x
        ty = k.y
        targetKind = 'pickup'
      }
    }
  }

  let dir: Vec
  let attack = false
  if (targetKind === '') {
    // Nothing to do: slow deterministic circle.
    const a = state.elapsed * 0.7
    dir = { x: Math.cos(a) * 0.6, y: Math.sin(a) * 0.6 }
  } else {
    const dx = tx - p.x
    const dy = ty - p.y
    const d = Math.hypot(dx, dy)
    if (targetKind === 'enemy' && d <= reach && p.hasSword) {
      return {
        move: steerClearOfPortals(world, state, { x: 0, y: 0 }),
        attack: true,
        interact: false,
        autoFace: true,
      }
    }
    if (d < 0.05) {
      dir = { x: 0, y: 0 }
    } else {
      dir = { x: dx / d, y: dy / d }
    }
    if ((targetKind === 'pot' || targetKind === 'enemy') && d <= reach + 0.2 && p.hasSword) attack = true
    if (targetKind === 'chest' && d <= 1.0) {
      return { move: { x: 0, y: 0 }, attack: false, interact: true, autoFace: true }
    }
  }
  return { move: steerClearOfPortals(world, state, dir), attack, interact: false, autoFace: true }
}

/**
 * Steer a desired direction away from portal triggers: repel inside the
 * 1-tile margin ring, and rotate the heading when the probe point ahead
 * would land inside a trigger. Deterministic, no rng.
 */
function steerClearOfPortals(world: World, state: GameState, dir: Vec): Vec {
  const p = state.player
  const room = state.room
  const danger = portalDanger(world, room.id, p.x, p.y, 1.0)
  if (danger) {
    const cx = danger.x + danger.w / 2
    const cy = danger.y + danger.h / 2
    const dx = p.x - cx
    const dy = p.y - cy
    const d = Math.hypot(dx, dy) || 1
    return { x: dx / d, y: dy / d }
  }
  if (dir.x === 0 && dir.y === 0) return dir
  const len = Math.hypot(dir.x, dir.y) || 1
  const nx = dir.x / len
  const ny = dir.y / len
  if (!probeHitsPortal(world, room.id, p.x + nx * 0.6, p.y + ny * 0.6)) return dir
  const candidates = [
    { x: -ny, y: nx },
    { x: ny, y: -nx },
    { x: -nx, y: -ny },
  ]
  for (const c of candidates) {
    if (!probeHitsPortal(world, room.id, p.x + c.x * 0.6, p.y + c.y * 0.6)) return c
  }
  return { x: 0, y: 0 }
}

/** The Engine interface, as one object for the shell's dynamic import. */
export const engine: Engine = {
  createGame,
  stepGame,
  toSave,
  parseSave,
  autopilot,
  respawn,
}

