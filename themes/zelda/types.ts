/**
 * Neon Shrine (theme id `zelda`) — shared types.
 *
 * This file is the contract between world.ts (authored data), engine.ts
 * (pure simulation), renderer.ts (Canvas 2D, read-only) and Zelda.vue
 * (loop, input, audio). Nothing here imports Vue, the DOM or another theme
 * file. Positions are in TILE UNITS (floats): a room of 15×11 tiles spans
 * x 0..15, y 0..11, and the player is a circle of radius PLAYER_RADIUS.
 * See PLAN.md in this folder for the design.
 */

// ---------------------------------------------------------------------------
// World data (authored, immutable at runtime)
// ---------------------------------------------------------------------------

/** Tile legend used by the room strings in world.ts. One char per tile. */
export type TileChar =
  | '#' // wall (solid, blocks sword)
  | '.' // floor
  | '~' // grass (walkable, cut by the sword, may drop a heart)
  | 'o' // pot (solid until smashed by the sword, may drop a heart)
  | 'T' // tree (solid, overworld)
  | 'G' // gravestone (solid)
  | 'W' // water (not walkable, does not block sword)
  | 'L' // locked door (solid until a small key is used with interact/contact)
  | 'B' // Boss Key door (solid until the Boss Key is held)
  | 'S' // shut door — solid while the room's enemies live; opens when all are dead
  | ',' // floor variant (decorative dark tile, walkable)

export type Facing = 'up' | 'down' | 'left' | 'right'

export type EnemyKind = 'chaser' | 'wanderer' | 'turret' | 'bat' | 'knight' | 'slimeKnight'

export interface EnemyPlacement {
  /** Stable per room, e.g. 'meadow.chaser1'. */
  id: string
  kind: EnemyKind
  x: number
  y: number
  /** Turrets face one way; others ignore it. */
  facing?: Facing
}

export type ChestReward =
  | { kind: 'heartContainer' }
  | { kind: 'smallKey' }
  | { kind: 'bossKey' }
  | { kind: 'bossKeyAndHeartContainer' }
  | { kind: 'sword' }
  | { kind: 'relic' } // the victory relic — collecting it wins the game

export interface ChestPlacement {
  /** Stable, e.g. 'forest.heart'. Once opened, saved in progress.flags. */
  id: string
  x: number // tile column (integer)
  y: number // tile row (integer)
  reward: ChestReward
  /** Only appears once this flag is set (e.g. after the miniboss dies). */
  requiresFlag?: string
}

export interface PickupPlacement {
  /** Floor pickup lying in the open (the meadow sword). Stable id, one-time. */
  id: string
  x: number
  y: number
  reward: ChestReward
}

export interface Portal {
  /** Stable, e.g. 'meadow.east'. */
  id: string
  /** Trigger region in tile units of the source room. */
  x: number
  y: number
  w: number
  h: number
  /** Destination room and the safe arrival point (player centre, tile units). */
  toRoom: string
  toX: number
  toY: number
  /** Which way the camera slides. */
  dir: Facing
}

export interface Room {
  /** Stable id, e.g. 'meadow', 'dungeon.hub'. */
  id: string
  /** 'overworld' | 'dungeon' | 'boss' — picks the music loop and the backdrop. */
  area: 'overworld' | 'dungeon' | 'boss'
  /** Human name shown on entry ('THE MEADOW'). */
  name: string
  /** Rows of TileChar, all the same length. rows.length = height, rows[0].length = width. */
  rows: string[]
  enemies: EnemyPlacement[]
  chests: ChestPlacement[]
  pickups: PickupPlacement[]
  portals: Portal[]
  /** Safe entry points by id ('start', or a portal's id) — where death/resume puts the player. */
  entries: Record<string, { x: number; y: number; facing: Facing }>
}

export interface World {
  rooms: Record<string, Room>
  startRoom: string
  startEntry: string
}

// ---------------------------------------------------------------------------
// Simulation state
// ---------------------------------------------------------------------------

export const PLAYER_RADIUS = 0.35
export const PLAYER_SPEED = 5.5 // tiles per second
export const SWORD_REACH = 1.1 // tiles from player centre to arc edge
export const SWORD_ARC = Math.PI * 0.9 // total arc angle, centred on facing
export const SWING_TIME = 0.18 // seconds the arc is live
export const SWING_COOLDOWN = 0.26 // seconds between swing starts
export const INVULN_TIME = 1.0
export const KNOCKBACK_SPEED = 9 // tiles per second at t=0, decays
export const KNOCKBACK_TIME = 0.18
export const SLIDE_TIME = 0.35 // room transition
export const STEP = 1 / 120 // fixed simulation step
export const START_HEARTS = 3
export const MAX_HEARTS = 5
export const SAVE_KEY = 'zeldaSave'
export const BEST_KEY = 'zeldaBest'
export const SAVE_VERSION = 1

export interface Vec { x: number; y: number }

/** Per-tick input. `attack`/`interact` are edges (true for one step only). */
export interface Input {
  /** Analog movement, |move| ≤ 1 after the engine clamps it. */
  move: Vec
  attack: boolean
  interact: boolean
  /**
   * Touch only: when true and the player is at rest, a swing first turns
   * to face the nearest enemy in reach. Keyboard passes false.
   */
  autoFace: boolean
}

export interface Player {
  x: number
  y: number
  facing: Facing
  hp: number // whole hearts, integer 0..maxHp
  maxHp: number
  hasSword: boolean
  smallKeys: number
  hasBossKey: boolean
  invuln: number // seconds left
  swing: null | { t: number; facing: Facing; hit: Set<string> }
  cooldown: number
  /** Seconds a buffered sword press stays alive (engine ATTACK_BUFFER). */
  attackBuf: number
  knockback: null | { vx: number; vy: number; t: number }
  /** Velocity of the last step, for the renderer's walk cycle. */
  vx: number
  vy: number
}

export interface Enemy {
  id: string
  kind: EnemyKind
  x: number
  y: number
  hp: number
  facing: Facing
  /** Radius for contact and sword hits. */
  r: number
  invuln: number
  knockback: null | { vx: number; vy: number; t: number }
  /** Brain scratch: timers, targets, phase. Engine-private, renderer may read `phase`/`tell`. */
  brain: {
    t: number
    phase: string
    /** Seconds until an attack lands — renderer draws the telegraph while > 0. */
    tell: number
    [k: string]: unknown
  }
}

export interface Projectile {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** 'pink' for enemy shots; reserved for future player projectiles. */
  owner: 'enemy'
}

export interface Drop {
  id: number
  kind: 'heart' | 'smallKey'
  x: number
  y: number
  t: number // age, seconds
}

/** A runtime tile overlay: the room's rows plus what has changed (smashed pots, cut grass, opened doors). */
export interface RoomState {
  id: string
  width: number
  height: number
  /** Mutable copy of the tile grid, row-major, tiles[y][x]. */
  tiles: TileChar[][]
  enemies: Enemy[]
  projectiles: Projectile[]
  drops: Drop[]
  /** Chest ids still closed in this room (open ones are in progress.flags). */
  chestsClosed: string[]
  pickupsLeft: string[]
  /** Portal id the player is standing in, or null. Set on arrival so a portal cannot immediately refire. */
  insidePortal: string | null
}

/** Permanent progression — survives death, reload and room changes. */
export interface Progress {
  /** Opened chests, taken pickups, unlocked doors ('door:<room>:<x>,<y>'), 'miniboss', 'boss', 'won'. */
  flags: string[]
  /** Heart containers collected (ids), so maxHp can be recomputed. */
  containers: string[]
}

export type Phase =
  | 'play'
  | 'slide' // room transition, gameplay frozen
  | 'dying' // death vignette, then respawn (or, in quit path, stays)
  | 'won'

export interface GameState {
  phase: Phase
  room: RoomState
  player: Player
  progress: Progress
  /** Last safe entry: where death respawns and where a save resumes. */
  safe: { room: string; entry: string }
  slide: null | { from: string; to: string; dir: Facing; t: number; toX: number; toY: number; entry: string }
  dying: null | { t: number }
  /** Active simulation seconds: excludes slides, dying, pause (pause is the shell's business). */
  elapsed: number
  /** Seeded gameplay RNG state (mulberry32). Decorative randomness never touches it. */
  rng: number
  /** Monotonic id source for projectiles/drops. */
  nextId: number
  /** Screen shake request for the renderer (seconds left); engine sets, renderer reads. */
  shake: number
  /** True while an attract/demo run — must never be saved. */
  demo: boolean
}

// ---------------------------------------------------------------------------
// Events (returned by stepGame; drive sound + effects in Zelda.vue)
// ---------------------------------------------------------------------------

export type GameEvent =
  | { type: 'swing' }
  | { type: 'swordHit'; x: number; y: number; enemyId: string; killed: boolean }
  | { type: 'swordClank'; x: number; y: number } // hit a wall/guard
  | { type: 'playerHit'; x: number; y: number }
  | { type: 'playerDied' }
  | { type: 'respawn'; room: string }
  | { type: 'enemyDied'; x: number; y: number; kind: EnemyKind }
  | { type: 'potSmash'; x: number; y: number }
  | { type: 'grassCut'; x: number; y: number }
  | { type: 'pickup'; kind: Drop['kind'] }
  | { type: 'chestOpened'; id: string; reward: ChestReward }
  | { type: 'reward'; reward: ChestReward } // pickup or chest, after applying
  | { type: 'doorUnlocked'; x: number; y: number }
  | { type: 'doorOpened'; x: number; y: number } // shut door after room clear
  | { type: 'roomEnter'; room: string; name: string; area: Room['area'] }
  | { type: 'slideStart'; dir: Facing }
  | { type: 'bossPhase'; phase: number }
  | { type: 'bossDefeated'; kind: EnemyKind }
  | { type: 'won'; elapsed: number }
  | { type: 'hitStop'; ms: number } // presentation hold request; the shell decides
  | { type: 'shoot'; x: number; y: number }

// ---------------------------------------------------------------------------
// Save format (localStorage.zeldaSave)
// ---------------------------------------------------------------------------

export interface SaveData {
  v: typeof SAVE_VERSION
  room: string
  entry: string
  hp: number
  maxHp: number
  hasSword: boolean
  smallKeys: number
  hasBossKey: boolean
  flags: string[]
  containers: string[]
  rng: number
  elapsed: number
}

// ---------------------------------------------------------------------------
// Engine API (implemented in engine.ts)
// ---------------------------------------------------------------------------

export interface EngineOptions {
  seed?: number
  /** Resume from a save; ignored if invalid (createGame then starts fresh). */
  save?: SaveData | null
  demo?: boolean
}

export interface Engine {
  /** New game (or resume) in the given world. Never throws on a bad save. */
  createGame(world: World, opts?: EngineOptions): GameState
  /** Advance by dt seconds using fixed STEP substeps; returns the events of this call. */
  stepGame(world: World, state: GameState, dt: number, input: Input): GameEvent[]
  /** Serialize permanent progress + safe entry. Returns null for demo state. */
  toSave(state: GameState): SaveData | null
  /** Validate an unknown value from storage. */
  parseSave(raw: unknown): SaveData | null
  /** Attract-mode autopilot: input for the current state (wander, smash a pot, swing at a chaser). */
  autopilot(world: World, state: GameState): Input
  /** After 'dying' finishes — respawn at the safe entry with hp = maxHp. Called by stepGame automatically unless the shell has quit. */
  respawn(world: World, state: GameState): GameEvent[]
}

// ---------------------------------------------------------------------------
// Renderer API (implemented in renderer.ts)
// ---------------------------------------------------------------------------

export interface FrameUI {
  /** Room name banner text and remaining seconds (0 = hidden). */
  banner: { text: string; t: number } | null
  paused: boolean
  reducedMotion: boolean
  /** Interpolation alpha 0..1 between the last two engine steps (renderer may ignore). */
  alpha: number
  /** Touch: the floating stick, drawn when present. Screen px, relative to canvas. */
  stick: { originX: number; originY: number; dx: number; dy: number } | null
  /** Hint line under the room ('TAP TO START' etc.), empty to hide. */
  hint: string
}

export interface Renderer {
  /**
   * Fit the backing store to the canvas' CSS size. `touch` (default true)
   * keeps the side reserves for the touch control deck in landscape.
   */
  resize(width: number, height: number, dpr: number, touch?: boolean): void
  /** Draw one frame. `dt` is presentation time for particles only. */
  draw(state: GameState, ui: FrameUI, dt: number): void
  /** Feed events for particles/shake/flash; the renderer keeps its own bounded pools. */
  onEvents(events: GameEvent[]): void
  /** Screen-space rect (px) the room occupies, for the shell to place touch zones. */
  roomRect(): { x: number; y: number; w: number; h: number }
}
