// Another Shore — the shared contract between engine, renderer, audio and
// the Vue shell. World units are px at scale 1, y points down. The player's
// x/y is the centre of the feet.

export type ChapterId = 1 | 2 | 3 | 4 | 5
export type PaletteName = 'dusk' | 'night' | 'hall' | 'storm' | 'dawn'
export type SceneryKind = 'shore' | 'causeway' | 'hall' | 'tower'

export interface Input {
  left: boolean
  right: boolean
  /** Jump; swims up in water. */
  up: boolean
  /** Crouch. */
  down: boolean
  /** Kick without the gun. With it: tap fires, a hold raises a shield, a longer hold charges a beam. */
  action: boolean
}

export type PlatformKind = 'ground' | 'slab' | 'rock' | 'ledge' | 'wall' | 'floor' | 'door' | 'lift' | 'cage'

export interface Platform {
  x: number; y: number; w: number; h: number
  kind: PlatformKind
  /** Doors and lifts are addressed by id from the chapter scripts. */
  id?: string
}

/** A body of water. Inside it the figure swims; `y` is the surface. */
export interface Water { x: number; w: number; y: number; bottom: number }

export interface Lamp {
  x: number; y: number
  lit: boolean
  /** The tower lamp: lighting it ends the crossing. */
  final?: boolean
}

// ---- hazards ----

/** A tide surge over a low slab; lethal only at full rise. See tideLevel(). */
export interface TideHazard {
  kind: 'tide'
  x: number; y: number; w: number; h: number
  period: number
  phase: number
}

/** A wedge under a cracked overhang; drops when the figure enters the trigger, then stays as a rock. */
export interface RockfallHazard {
  kind: 'rockfall'
  x: number; y: number; w: number; h: number
  triggerX: number; triggerW: number
  top: number
  vy: number
  state: 'hanging' | 'falling' | 'landed'
}

/** The pool's tentacles: they start rising a moment after the figure is in the water. */
export interface TentacleHazard {
  kind: 'tentacles'
  x: number; w: number
  /** World y of the tips; starts at the pool floor and rises. */
  tip: number
  floor: number
  /** Seconds before they move, counted from the first moment the figure swims. */
  delay: number
  t: number
  active: boolean
}

export type Hazard = TideHazard | RockfallHazard | TentacleHazard

// ---- actors ----

export interface Leech {
  kind: 'leech'
  id: number
  x: number; y: number
  dir: number
  state: 'crawl' | 'hang' | 'drop' | 'dead'
  vy: number
  /** crawl bounds */
  minX: number; maxX: number
  /** seconds since death, for the flip-away */
  t: number
}

export interface Shield {
  owner: 'player' | 'guard'
  ownerId: number
  x: number
  /** feet y */
  y: number
  h: number
  hp: number
  t: number
  /** seconds left */
  life: number
}

export interface Guard {
  kind: 'guard'
  id: number
  x: number; y: number
  facing: number
  state: 'idle' | 'walk' | 'alert' | 'dying' | 'dead'
  /** walk target for entrances */
  goalX: number
  fireT: number
  shieldT: number
  alertT: number
  crouch: boolean
  crouchT: number
  t: number
  /** Sees this far; guards never shoot from off screen. */
  range: number
  /** Shots per shield. */
  shieldHp: number
  fireEvery: number
  /** Drops the gun when it dies (the cage guard). */
  carriesGun?: boolean
}

export interface Beast {
  kind: 'beast'
  id: number
  x: number; y: number
  state: 'hidden' | 'chase' | 'pounce' | 'gone'
  speed: number
  t: number
}

export interface Buddy {
  kind: 'buddy'
  id: number
  x: number; y: number
  facing: number
  /** What the chapter script has him do; the renderer poses him from it. */
  state: 'hidden' | 'caged' | 'stand' | 'point' | 'run' | 'crank' | 'carry' | 'gone'
  goalX: number
  t: number
}

export type Actor = Leech | Guard | Beast | Buddy

export interface Shot {
  owner: 'player' | 'guard'
  kind: 'shot' | 'beam' | 'bolt'
  x: number; y: number
  vx: number
  alive: boolean
  t: number
}

/** The gun pickup (the cage guard drops it). */
export interface Item { kind: 'gun'; x: number; y: number; taken: boolean }

// ---- the figure ----

export type DeathCause = 'fall' | 'tide' | 'rockfall' | 'tentacles' | 'leech' | 'beast' | 'bolt'

export interface Player {
  x: number; y: number
  vx: number; vy: number
  grounded: boolean
  facing: number
  /** true while the current jump started from a near standstill */
  hop: boolean
  /** landing crouch after a hard drop, seconds left; input ignored */
  landT: number
  crouching: boolean
  /** seconds of kick left */
  kickT: number
  /** a mantle onto a ledge in progress */
  mantle: { t: number; x0: number; y0: number; x1: number; y1: number } | null
  swimming: boolean
  hasGun: boolean
  /** seconds the action button has been held (gun only) */
  holdT: number
  /** recoil pose timer after a shot */
  shotT: number
  /** cooldown between shots */
  gunCool: number
  /** run-cycle distance, drives the pose frame and footsteps */
  stride: number
}

export interface Cage {
  pivotX: number; pivotY: number
  rope: number
  theta: number
  omega: number
  state: 'hang' | 'fall' | 'down'
  x: number; y: number
  vx: number; vy: number
  /** the last pump direction, so holding one key does nothing */
  lastPump: number
  t: number
}

export interface Lift {
  id: string
  x: number; w: number
  y: number
  yTop: number; yBottom: number
  state: 'up' | 'lowering' | 'down' | 'rising'
  /** seconds the figure has stood on it */
  t: number
}

/** Scenery the renderer draws at a world position; no collision. */
export interface Prop {
  kind: 'wreck' | 'ridgeBeast' | 'arch' | 'vent' | 'doorway' | 'window' | 'pillar' | 'overhang' | 'lampTower'
  x: number; y: number
  w: number; h: number
}

export type GameEvent =
  | { type: 'step' } | { type: 'jump' } | { type: 'land'; hard: boolean }
  | { type: 'kick' } | { type: 'kickHit' }
  | { type: 'splash' } | { type: 'stroke' } | { type: 'climb' }
  | { type: 'tentacles' } | { type: 'leechDrop' } | { type: 'leechDie' }
  | { type: 'death'; cause: DeathCause }
  | { type: 'lamp'; final: boolean }
  | { type: 'shot' } | { type: 'beam' } | { type: 'charge' } | { type: 'chargeFull' }
  | { type: 'shield'; owner: 'player' | 'guard' } | { type: 'shieldHit' } | { type: 'shieldBreak' }
  | { type: 'bolt' } | { type: 'guardAlert' } | { type: 'guardDie' }
  | { type: 'beastRoar' } | { type: 'beastPounce' }
  | { type: 'rockfall' } | { type: 'rockLand' }
  | { type: 'door' } | { type: 'lift' }
  | { type: 'cageCreak' } | { type: 'cageSnap' } | { type: 'cageCrash' }
  | { type: 'gun' } | { type: 'thunder' } | { type: 'buddy' }
  | { type: 'chapter'; chapter: ChapterId } | { type: 'cut'; id: CutId }

export interface World {
  chapter: ChapterId
  width: number
  /** default ground line, used by the camera when nothing else applies */
  groundY: number
  /** camera may not look above this world y (vertical chapters) */
  camTop: number
  /** below this the figure has fallen */
  killY: number
  palette: PaletteName
  scenery: SceneryKind
  player: Player
  platforms: Platform[]
  water: Water[]
  hazards: Hazard[]
  actors: Actor[]
  shots: Shot[]
  shields: Shield[]
  lamps: Lamp[]
  items: Item[]
  lifts: Lift[]
  props: Prop[]
  cage: Cage | null
  checkpoint: number
  time: number
  /** the death vignette in progress; then a hard cut back to the checkpoint */
  dying: { cause: DeathCause; t: number } | null
  /** script flags, set once */
  flags: string[]
  /** script clocks, seconds */
  timers: Record<string, number>
  /** true once the figure walks off the chapter's right edge (or the script ends it) */
  exit: boolean
  /** the chapter's own ending cut, if any, fires instead of a plain exit */
  exitCut: CutId | null
  /** a small line the shell may show while it is set (gun tutorial) */
  hint: string | null
  events: GameEvent[]
  /** palette override for the last chapter's dawn */
  dawn: boolean
  /** next actor id */
  nextId: number
}

export type CutId = 'prologue' | 'capture' | 'ending' | 'card'

export interface Cut {
  id: CutId
  t: number
  /** total length in seconds */
  length: number
}

export interface Game {
  mode: 'cut' | 'play' | 'done'
  cut: Cut | null
  world: World
  /** play time in seconds, cutscenes excluded */
  elapsed: number
  deaths: number
  /** events drained by the shell every frame */
  events: GameEvent[]
}

/** What survives a reload: the chapter, the last lamp, the gun, the clock. */
export interface ShoreSave {
  v: 1
  chapter: ChapterId
  checkpoint: number
  hasGun: boolean
  deaths: number
  elapsed: number
  savedAt: number
}
