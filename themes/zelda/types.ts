/**
 * Neon Shrine (theme id `zelda`) — the contract between the world data
 * (`world/`), the pure simulation (`engine/`), the Canvas renderer
 * (`render/`), the audio (`audio.ts`) and the Vue shell (`Zelda.vue`).
 *
 * Positions are in TILE UNITS (floats). A map of W×H tiles spans x 0..W,
 * y 0..H; a tile (tx, ty) covers [tx, tx+1) × [ty, ty+1). The renderer
 * draws one tile as TILE logical pixels. Nothing here imports Vue or the DOM.
 * Design: DESIGN.md next to this file; status and checks: docs/games/neon-shrine.md.
 */

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

export type Dir = 'up' | 'down' | 'left' | 'right'
export interface Vec { x: number; y: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface Spot {
  x: number
  y: number
  dir: Dir
  /** Spawn on the door tile and walk one tile out along `dir` before control returns (stepping out of a house). */
  out?: boolean
}

export const TILE = 16 // logical pixels per tile
export const STEP = 1 / 120 // fixed simulation step (s)

export const HERO_R = 0.34
export const HERO_SPEED = 5.4 // tiles/s
export const CHARGE_SPEED = 2.8 // while holding a charged sword
export const CARRY_SPEED = 4.2
export const SWING_TIME = 0.2
export const SWING_COOLDOWN = 0.06
export const SWORD_REACH = 1.2
export const SWORD_ARC = Math.PI * 0.95
export const CHARGE_TIME = 0.55 // hold this long for a spin
export const SPIN_TIME = 0.42
export const SPIN_REACH = 1.55
export const INVULN = 1.0
export const KNOCK_SPEED = 10
export const KNOCK_TIME = 0.16
export const SCROLL_TIME = 0.6 // dungeon room-to-room camera scroll
export const WARP_TIME = 0.32 // each half of a fade warp
export const LIFT_TIME = 0.18
export const THROW_SPEED = 10
export const THROW_RANGE = 4.2
export const BOMB_FUSE = 1.7
export const BOMB_RADIUS = 1.55
export const DISC_SPEED = 13
export const DISC_RANGE = 6
export const HOOK_SPEED = 17 // tiles/s, out and back
export const HOOK_RANGE = 8
export const HOOK_PULL_SPEED = 13
export const ARC_REACH = 1.4 // the Arc Blade's swing
export const BEAM_SPEED = 12
export const PSI_SPEED = 11 // a psi block sliding, tiles/s
export const PUSH_DELAY = 0.32 // walk into a block this long to push it
export const PUSH_TIME = 0.28
export const MAX_BITS = 9999
export const START_HP = 6 // half-hearts
export const SAVE_KEY = 'zeldaSave'
export const BEST_KEY = 'zeldaBest'
/** When this browser last cleared its save (new game, win), in ms — see progress.ts reconcile. */
export const CLEARED_KEY = 'zeldaClearedAt'
export const SAVE_VERSION = 2

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

/**
 * One char per tile in the authored rows. Behaviour lives in `world/tiles.ts`
 * (TILE_INFO); the look depends on the map's kind (grass in the overworld,
 * stone in the shrine, planks indoors).
 */
export type TileChar =
  | '.' // ground
  | ',' // path / carpet (walkable decor)
  | ':' // glowing flowers (walkable decor)
  | ';' // tall grass (walkable, cut by sword, may drop)
  | '*' // bush (solid, cut by sword / spin / bomb, may drop)
  | 'T' // tree (solid)
  | '#' // wall / cliff (solid, stops everything)
  | '~' // water (solid to walkers, projectiles fly over)
  | '=' // bridge (walkable)
  | 'o' // pot (solid, liftable, may hide a drop)
  | 'r' // rock (solid, liftable)
  | 'R' // cracked boulder (solid, bombs break it for good)
  | '%' // cracked wall (solid, bombs open it for good)
  | 'L' // locked door (small key)
  | 'K' // big-key door
  | 'X' // shutter gate (opens on its gate condition)
  | 'b' // push block
  | '_' // pressure plate (walkable)
  | 'c' // crystal switch (solid; sword/disc/bomb toggles pink ⇄ cyan)
  | 'P' // pink crystal block (raised while crystal = pink)
  | 'C' // cyan crystal block (raised while crystal = cyan)
  | 'x' // spikes (walkable, hurts)
  | 'O' // pit (fall → back to the room entry, half a heart)
  | 't' // torch / lamp post (solid, light)
  | 'S' // sign (solid, readable)
  | 'G' // gravestone (solid)
  | 'F' // fence / railing (solid, projectiles pass)
  | 'H' // building (solid; roof + wall painted by neighbours)
  | 'D' // doorway (walkable; a warp sits on it)
  | '>' // stairs (walkable; a warp sits on it)
  | '$' // chest (solid; contents by position)
  | 'n' // counter / table (solid, projectiles pass)
  | 'I' // pillar / statue (solid)
  | 'M' // neon sign / machine (solid, light)
  | 'Z' // blocked tile (solid, invisible barrier)
  // Interior furniture (the portal's rooms; painted from neighbours where they join)
  | '[' // bookshelf (solid, stops everything; stands against a wall, reaches up over it)
  | '(' // sofa (solid; a run of them paints as one sofa with arms at the ends)
  | 'w' // desk (solid; a run is one desk, its first tile carries a glowing monitor)
  | 'Y' // potted plant (solid, not liftable)
  | 'i' // bar stool (walkable decor)
  | 'f' // patterned rug (walkable decor; a run paints as one rug with a border)
  | '^' // wall with a framed picture (a wall tile in every other way)
  // The Wildwood and Project Horizon's labs
  | '|' // hook post (solid, projectiles pass; the hook grabs it)
  | 'l' // static vines (solid; only the Arc Blade cuts them)
  | 'B' // psi block (solid; with Luna along, A slides it until it hits something)
  | '{' // letter stone (walkable; stepping on stones spells a word, see MapDef.codes)
  | '}' // lever / breaker (solid; a hit throws it for good and sets its flag)
  // The town's beach
  | '-' // sand (walkable)

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** What a chest, pickup, NPC or shop gives. */
export type ItemId =
  | 'sword'
  | 'bombBag' // unlocks bombs, 8 of them
  | 'bombs5'
  | 'disc' // the Prism Disc (boomerang)
  | 'smallKey'
  | 'bigKey'
  | 'heartPiece'
  | 'heartContainer'
  | 'heart' // refill one heart
  | 'bits5'
  | 'bits20'
  | 'bits50'
  | 'prism' // the Sun Prism — picking it up wins
  | 'hook' // the grappling hook
  | 'arc' // the Arc Blade: the sword, upgraded
  | 'bigBag' // a bigger bomb bag (20)
  | 'waffle' // for Luna
  | 'shroom' // one of Mossa's three glowshrooms
  | 'tube' // a vacuum tube for Dusty's radio
  | 'walkie' // Toby's lost walkie-talkie
  | 'hat' // the troll's hat

export type UseItem = 'disc' | 'bombs' | 'hook'

// ---------------------------------------------------------------------------
// Authored world
// ---------------------------------------------------------------------------

export type MapKind = 'overworld' | 'dungeon' | 'interior'
export type TrackId = 'title' | 'overworld' | 'village' | 'beach' | 'dungeon' | 'boss' | 'indoor' | 'ending' | 'forest' | 'lab' | 'static'

export type EnemyKind =
  | 'blob' // slow hopping slime
  | 'spitter' // pops up, fires a pellet along its facing
  | 'sentry' // patrols; charges when it sees you
  | 'bat' // erratic flyer
  | 'dasher' // snake; dashes when you line up
  | 'zapper' // electric — sword contact shocks you unless it is stunned
  | 'skull' // hops back from the sword
  | 'eye' // invulnerable statue; sweeps, fires a laser when it sees you
  | 'blade' // spike trap; slides when you line up
  | 'knight' // miniboss: guards its front, charges
  | 'king' // boss: the Static King
  | 'hound' // static hound: circles, then lunges
  | 'drone' // lab drone: hovers, zaps along a line
  | 'llama' // miniboss: wool turns the blade; only its own spit (reflected) or a bomb hurts
  | 'mistral' // boss: the cold wind; hook it down, then strike
  | 'deepseek' // miniboss: swims under the floor, surfaces to bite; the hook drags it up
  | 'gemini' // boss: one of the twins; both must fall close together

/** A condition on progress. `clear` = every enemy of the gate's room is dead. */
export type Cond =
  | { flag: string }
  | { notFlag: string }
  | { clear: true }
  | { plates: string[] }
  | { item: ItemId }
  | { flags: string[]; not?: string[] } // all of `flags`, none of `not`

export interface TalkBranch {
  /** First branch whose condition holds is spoken. No condition = default. */
  when?: Cond
  lines: string[]
  /** Given once after the lines (flag `got:<npc id>` prevents repeats). */
  give?: ItemId
  /** Flag set after speaking. */
  set?: string
  /** Flag cleared after speaking. */
  clear?: string
}

/** Entity placed by a marker char in the rows. */
export type EntDef =
  | { t: 'enemy'; kind: EnemyKind; dir?: Dir; once?: string; carries?: ItemId }
  | { t: 'chest'; id: string; item: ItemId; big?: boolean; appear?: Cond }
  | { t: 'item'; id: string; item: ItemId; appear?: Cond } // lies on the floor, one-time
  | {
    t: 'npc'; id: string; look: NpcLook; dir?: Dir; talk: TalkBranch[]; wander?: boolean
    /** Not there while this holds (checked on load and after every talk). */
    hide?: Cond
    /** Joins the hero as a follower once `hide` holds after a talk (Luna). */
    join?: boolean
  }
  | { t: 'sign'; lines: string[] }
  | { t: 'shop'; id: string; item: ItemId; price: number; once?: boolean }
  | { t: 'plate'; id: string }
  | { t: 'entry'; id: string; dir?: Dir } // an entry point at the marker's tile centre
  | { t: 'warp'; to: string; entry: string } // stepping on this tile warps
  | { t: 'gate'; open: Cond } // on one tile of an X run (tile 'X')
  | { t: 'glyph'; ch: string } // a letter stone (tile '{')
  | { t: 'lever'; flag: string } // a lever or breaker (tile '}'): a hit sets `flag` for good
  | ExitDef

export type NpcLook = 'keeper' | 'vendor' | 'kid' | 'robot' | 'cat' | 'ghost' | 'petter' | 'luna' | 'mossa' | 'dusty' | 'toby' | 'max' | 'owl' | 'troll' | 'dancer' | 'surfer' | 'raver'

/**
 * Where an exit leads: another theme on phareim.no (`?theme=<id>`), the
 * portal at `/`, or a page outside the site. The engine only reports it (the
 * `exit` event); the Vue shell does the navigating. `reset` is the NEW GAME
 * machine in Petter's house: it leaves nothing, its lines close into a
 * `startOver` event and the shell asks yes or no. `panel` is the login
 * console in Petter's house: it leaves nothing either, its A press becomes
 * a `panel` event and the shell opens that HTML panel over the world.
 */
export type ExitTarget = { theme: string } | { home: true } | { url: string } | { reset: true } | { panel: PanelId }

/** The shell's HTML panels an exit can open: `account` is the login console (`AccountConsole.vue`). */
export type PanelId = 'account'

/** How the renderer draws an exit. The engine ignores it. */
export type ExitLook = 'door' | 'cabinet' | 'board' | 'kiosk' | 'terminal' | 'console' | 'sign' | 'booth'

/**
 * A way out of the game: the town's cabinets, doors, kiosk and terminals.
 * - On a walkable tile ('D' door, '>' stairs): stepping on it starts the
 *   usual warp fade; at full dark the engine emits `exit` and enters mode 'exit'.
 * - On a solid tile (cabinet 'M', sign 'S', board 'I', …): pressing A while
 *   facing it shows `lines` as a dialog (if any); closing the dialog starts
 *   the same fade and exit.
 * The engine also registers an entry named `id` on the neighbouring tile on
 * `side` (default 'down'): facing the exit for a solid one, facing away (along
 * `side`) for a walkable one. The portal spawns you there when you come back.
 */
export interface ExitDef {
  t: 'exit'
  id: string
  to: ExitTarget
  side?: Dir
  look?: ExitLook
  /** Renderer art key: a theme id for a cabinet's marquee ('galaga', 'outrun', …); a DJ booth's kit ('mixer', 'records'). */
  art?: string
  /** Short name shown over the exit when the hero is next to it ('GALAGA'). */
  label?: string
  lines?: string[]
}

/** Neon lettering painted into the world (Petter's name over the town). */
export interface Decal {
  /** Anchor in tile units: the text's top edge, and its left edge or centre (align). */
  x: number
  y: number
  text: string
  color?: string
  /** Whole-number pixel scale of the 5×7 font (default 2). */
  scale?: 1 | 2 | 3
  align?: 'left' | 'center'
}

export interface Mark {
  ent: EntDef
  /** Tile placed under the marker (default '.'). */
  tile?: TileChar
}

export interface Warp {
  x: number
  y: number
  w?: number
  h?: number
  to: string // map id
  entry: string // entry id in that map
}

export interface CellDef {
  name?: string
  dark?: boolean
  /** A dark room is lit once this flag is set (the lab's power). */
  lit?: string
  track?: TrackId
  /** 'static': the Other Side leaks in — red-violet tint and drifting ash. */
  mood?: 'static'
  /** Scripted beats: the first time the hero is in this room while `when` holds, the lines play and `set` is set. */
  events?: Array<{ when?: Cond; lines: string[]; who?: string; set: string }>
}

/**
 * Renderer-only set dressing, in tile units (the tiles under it do the
 * blocking): tents, a campfire, the radio mast, the wall of Christmas
 * lights that spells a word, the Gate, specimen tanks.
 */
export interface Prop {
  kind: 'tent' | 'campfire' | 'mast' | 'lights' | 'rift' | 'tank' | 'van' | 'fort' | 'bike' | 'lift'
  x: number
  y: number
  w?: number
  h?: number
  /** 'lights': the word the bulbs spell; 'stone'/'truck': a label. */
  text?: string
  color?: string
  /** Drawn only while this holds (the Gate after it shuts). */
  when?: Cond
}

export interface MapDef {
  id: string
  name: string
  kind: MapKind
  track: TrackId
  rows: string[]
  /** Dungeons: the map is cut into camera rooms of this size (tiles). */
  cell?: { w: number; h: number }
  /** Per camera room, keyed 'cx,cy'. */
  cells?: Record<string, CellDef>
  /** Marker chars → entities. A char listed here is a marker everywhere in this map's rows, even if it is also a tile char. */
  marks: Record<string, Mark>
  /** Extra entries/warps besides the ones placed by markers. */
  entries?: Record<string, Spot>
  warps?: Warp[]
  /**
   * Named regions of an overworld: banner, music, and (entry) where death puts
   * you after visiting it. `intro` opens a dialog the first time the hero walks
   * in while `when` holds, and sets `flag` so it never repeats.
   */
  areas?: Array<Rect & { name: string; track?: TrackId; entry?: string; intro?: AreaIntro }>
  /** Painted lettering, drawn over the ground and under entities. */
  decals?: Decal[]
  /**
   * Maps sharing a keyring share small keys and a big key (a dungeon's
   * floors). Default 'shrine': `Inventory.keys`/`bigKey`; any other ring
   * keeps its small keys in `Inventory.keyrings` and its big key in the
   * flag `bigkey:<ring>`.
   */
  keyring?: string
  /** The painter's palette: Project Horizon's labs, the deep Wildwood. */
  look?: 'lab' | 'wild'
  /** Crystal switches of every map in this group share one state (a flag), across rooms and floors. */
  crystal?: string
  /** Pits drop to this map (same size) at the same spot instead of hurting. */
  below?: string
  /** Letter stones: walking over them in this order sets `flag`. */
  codes?: Array<{ word: string; flag: string }>
  props?: Prop[]
}

export interface AreaIntro {
  lines: string[]
  who?: string | null
  flag: string
  when?: Cond
}

export interface World {
  maps: Record<string, MapDef>
  start: { map: string; entry: string }
  /** What Luna says when the hero talks to her while she follows (first branch that holds). */
  luna?: TalkBranch[]
  /** Dialog opened when a new game (no save) starts, after any walk-out from the start entry. */
  intro?: { lines: string[]; who?: string | null }
}

// ---------------------------------------------------------------------------
// Simulation state
// ---------------------------------------------------------------------------

export interface Enemy {
  id: string
  kind: EnemyKind
  x: number
  y: number
  r: number
  hp: number
  maxHp: number
  dir: Dir
  /** Camera room index (dungeons) or -1. Only the hero's room simulates. */
  cell: number
  invuln: number
  stun: number
  knock: null | { vx: number; vy: number; t: number }
  /** Brain state. `mode` and `tell` are readable by the renderer. */
  ai: { mode: string; t: number; tell: number; [k: string]: number | string | boolean }
  once?: string
  carries?: ItemId
  /** Spawn point, for respawning on room re-entry. */
  home: Vec
  dead: boolean
  /** Hit flash for the renderer (seconds left). */
  flash: number
}

export interface Projectile {
  id: number
  kind: 'pellet' | 'laser' | 'spark' | 'shard' | 'wave' | 'beam' | 'spit' | 'gust'
  x: number
  y: number
  vx: number
  vy: number
  r: number
  t: number
  life: number
  /** Deflectable by the sword (pellets). */
  reflect?: boolean
  /** Reflected shots hurt enemies instead. */
  friendly?: boolean
}

export type DropKind = 'heart' | 'bit' | 'bit5' | 'bomb' | 'key'

export interface Drop {
  id: number
  kind: DropKind
  x: number
  y: number
  t: number
  /** Bounce height for the renderer (tiles). */
  z: number
  vz: number
  /** Disappears at this age unless permanent (keys). */
  life: number
}

export interface Bomb { id: number; x: number; y: number; t: number }
export interface Blast { id: number; x: number; y: number; t: number }

export interface Disc {
  x: number
  y: number
  vx: number
  vy: number
  t: number
  returning: boolean
  hit: string[]
  /** Drop ids being carried back. */
  carrying: number[]
}

export interface Thrown {
  id: number
  kind: 'pot' | 'rock'
  x: number
  y: number
  vx: number
  vy: number
  z: number
  dist: number
}

export interface MovingBlock {
  id: number; fx: number; fy: number; tx: number; ty: number; t: number
  /** Slide time (default PUSH_TIME); psi blocks slide further and longer. */
  dur?: number
  kind?: 'b' | 'B'
  /** Slid into a hole: gone when it arrives (it lands on the floor below). */
  falls?: boolean
}

export interface Npc {
  id: string
  look: NpcLook
  x: number
  y: number
  dir: Dir
  home: Vec
  wander: boolean
  t: number
  vx: number
  vy: number
}

/** An exit as the renderer sees it (tile centre). */
export interface ExitSpot {
  id: string
  x: number
  y: number
  to: ExitTarget
  look: ExitLook
  art?: string
  label?: string
  /** True for a door/stairs exit you walk onto, false for one you face and press A. */
  walk: boolean
}

export interface Pickup {
  id: string
  item: ItemId
  x: number
  y: number
  shop?: { price: number; once: boolean }
  appear?: Cond
  /** True while its appear condition is unmet (not drawn, not collectable). */
  hidden: boolean
}

export interface MapState {
  id: string
  w: number
  h: number
  /** Mutable tiles, row-major: tiles[y * w + x]. */
  tiles: TileChar[]
  /** Bumped whenever tiles change; the renderer rebuilds its cache. */
  version: number
  enemies: Enemy[]
  projectiles: Projectile[]
  drops: Drop[]
  bombs: Bomb[]
  blasts: Blast[]
  thrown: Thrown[]
  moving: MovingBlock[]
  npcs: Npc[]
  pickups: Pickup[]
  exits: ExitSpot[]
  /** Plate ids currently held down. */
  plates: string[]
  /** Crystal blocks the hero stood on when they rose; solid once left. */
  pending: number[]
  /** Crystal state per camera room ('pink' raises P, 'cyan' raises C). */
  crystal: Record<number, 'pink' | 'cyan'>
  /** Seconds before a crystal switch answers again (a blade and its beam strike together). */
  crystalCool?: number
  /** The shared state of a crystal group (MapDef.crystal); overrides `crystal`. */
  crystalAll?: 'pink' | 'cyan'
  /** Letters spelled so far on this map's letter stones, and the stones lit by them. */
  spell: string
  spellTiles: number[]
  /** The letter stone the hero stands on (a letter counts once per step onto it). */
  onGlyph: number
  /** MapDef.keyring, resolved. */
  ring: string
}

export type HeroAct =
  | 'idle' | 'walk' | 'swing' | 'spin' | 'lift' | 'carry' | 'throw' | 'push'
  | 'use' | 'hurt' | 'get' | 'fall' | 'dead' | 'hook'

export interface Hero {
  x: number
  y: number
  dir: Dir
  vx: number
  vy: number
  hp: number // half-hearts
  maxHp: number
  act: HeroAct
  /** Seconds in the current act (animation clock). */
  actT: number
  walkT: number
  invuln: number
  knock: null | { vx: number; vy: number; t: number }
  swing: null | { t: number; dir: Dir; hit: string[] }
  spin: null | { t: number; hit: string[] }
  /** Seconds the sword button has been held since the last swing (charge). */
  charge: number
  cooldown: number
  carry: null | 'pot' | 'rock'
  push: number
  /** Where a pit fall returns the hero. */
  safe: Vec
  /** Walking out of a door after spawning on a `Spot.out` entry: input is ignored until it ends at (x, y). */
  auto?: null | { dir: Dir; t: number; x: number; y: number; intro?: boolean }
}

export interface Inventory {
  sword: boolean
  bombBag: boolean
  bombs: number
  disc: boolean
  bits: number
  keys: number
  bigKey: boolean
  pieces: number // heart pieces towards the next container (0..3)
  selected: UseItem | null
  prism: boolean
  hook: boolean
  /** The Arc Blade (the sword, upgraded). */
  arc: boolean
  /** Bomb bag holds 20 instead of 12. */
  bigBag: boolean
  /** Mossa's glowshrooms found (0..3). */
  shrooms: number
  /** Small keys per dungeon other than the Shrine (whose keys are `keys`), by MapDef.keyring. */
  keyrings: Record<string, number>
}

/** The grappling hook in flight. Positions in tiles. */
export interface Hook {
  x: number
  y: number
  dx: number
  dy: number
  /** Tiles travelled out. */
  dist: number
  phase: 'out' | 'back' | 'pull'
  /** Where a pull ends (the hero's centre). */
  to: Vec | null
  hit: string[]
  carrying: number[]
}

/** Luna, following the hero. */
export interface Follower {
  x: number
  y: number
  dir: Dir
  walkT: number
  /** The hero's recent positions, newest last. */
  trail: Vec[]
  /** Seconds left of her "moving something with her mind" pose. */
  psi: number
  /** Set once the hero has walked away from her fort; coming back to it then sits her down there. */
  armed?: boolean
}

/** 'exit' is terminal like 'won': the screen stays dark and the shell navigates away. */
export type Mode = 'play' | 'scroll' | 'warp' | 'dialog' | 'get' | 'dying' | 'won' | 'exit'

export interface Dialog {
  lines: string[]
  /** Index of the line being shown. */
  line: number
  /** Characters revealed of that line. */
  chars: number
  /** Speaker look, for a portrait-free name tag. */
  who: string | null
  /** Shop purchase awaiting the last line, applied on close; `exit` starts that exit's fade on close. */
  after: null | { give?: ItemId; set?: string[]; clear?: string[]; sourceId?: string; price?: number; exit?: { id: string; to: ExitTarget }; startOver?: true }
  /** Exit dialogs: the answer picked on the last line, 0 = YES (go), 1 = NO (stay). */
  choice?: 0 | 1
  /** A direction was held last frame (the choice moves once per press). */
  held?: boolean
}

export interface GameState {
  mode: Mode
  map: MapState
  hero: Hero
  inv: Inventory
  /** Permanent progress. */
  flags: Record<string, true>
  /** Where death and Continue put you. */
  entry: { map: string; entry: string }
  /** Camera room (tiles) the camera is clamped to. */
  zone: Rect
  zoneIndex: number
  scroll: null | { from: Rect; to: Rect; t: number; dx: number; dy: number; index: number }
  /**
   * A door fade. With `exit` it leaves the game at full dark (mode 'exit')
   * instead of changing map; with `at` it lands on that spot (a drop through
   * a hole) instead of an entry.
   */
  warp: null | { t: number; to: string; entry: string; swapped: boolean; exit?: { id: string; to: ExitTarget }; at?: Vec; drop?: boolean }
  dialog: Dialog | null
  get: null | { item: ItemId; t: number; text: string[] }
  dying: null | { t: number }
  /** Area banner (overworld regions, dungeon rooms). */
  area: string
  elapsed: number
  rng: number
  nextId: number
  /** Screen shake request (seconds). */
  shake: number
  demo: boolean
  disc: Disc | null
  hook: Hook | null
  luna: Follower | null
}

// ---------------------------------------------------------------------------
// Input and events
// ---------------------------------------------------------------------------

export interface Input {
  /** Analog move, clamped to length ≤ 1. */
  move: Vec
  /** A (sword / talk / lift / throw): held and pressed this frame. */
  a: boolean
  aPress: boolean
  /** B (selected item). */
  bPress: boolean
  /** Next item. */
  cycle: boolean
  /** Touch: a swing at rest turns to the nearest enemy first. */
  autoFace: boolean
  /** A tap this frame on the left (-1) or right (1) half of the screen; picks YES or NO. */
  tapSide?: -1 | 1
}

export const NO_INPUT: Input = { move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false }

export type GameEvent =
  | { type: 'swing' }
  | { type: 'spin' }
  | { type: 'charged' }
  | { type: 'hit'; x: number; y: number; kind: EnemyKind; killed: boolean }
  | { type: 'clank'; x: number; y: number }
  | { type: 'hurt'; x: number; y: number }
  | { type: 'shock'; x: number; y: number }
  | { type: 'died' }
  | { type: 'respawn' }
  | { type: 'kill'; x: number; y: number; kind: EnemyKind }
  | { type: 'cut'; x: number; y: number; tile: TileChar }
  | { type: 'shatter'; x: number; y: number; kind: 'pot' | 'rock' }
  | { type: 'lift' }
  | { type: 'throw' }
  | { type: 'drop'; kind: DropKind }
  | { type: 'collect'; kind: DropKind }
  | { type: 'chest'; x: number; y: number }
  | { type: 'itemGet'; item: ItemId }
  | { type: 'secret' }
  | { type: 'unlock'; x: number; y: number }
  | { type: 'gate'; x: number; y: number }
  | { type: 'plate'; x: number; y: number }
  | { type: 'crystal'; state: 'pink' | 'cyan' }
  | { type: 'push'; x: number; y: number }
  | { type: 'bombPlace' }
  | { type: 'boom'; x: number; y: number }
  | { type: 'disc' }
  | { type: 'discHit'; x: number; y: number }
  | { type: 'fall' }
  | { type: 'shoot'; x: number; y: number; kind: Projectile['kind'] }
  | { type: 'reflect'; x: number; y: number }
  | { type: 'enter'; map: string; area: string; track: TrackId }
  | { type: 'area'; name: string; track: TrackId }
  | { type: 'scroll' }
  | { type: 'warp' }
  | { type: 'talk' }
  | { type: 'text' } // a character was typed (throttled by the shell)
  | { type: 'choose' } // the YES/NO cursor moved
  | { type: 'back' } // an exit's lines were closed without leaving
  | { type: 'buy'; ok: boolean }
  | { type: 'bossPhase'; phase: number }
  | { type: 'bossDown'; kind: EnemyKind }
  | { type: 'won'; elapsed: number }
  | { type: 'exit'; id: string; to: ExitTarget }
  | { type: 'startOver' } // the NEW GAME machine's lines closed: the shell asks yes or no
  | { type: 'panel'; id: string; panel: PanelId } // the login console was used: the shell opens its panel
  | { type: 'hitStop'; ms: number }
  | { type: 'cycle'; item: UseItem | null }
  | { type: 'error' } // a buzz: no bombs, no key, can't afford
  | { type: 'hook' }
  | { type: 'hookHit'; x: number; y: number }
  | { type: 'pull' }
  | { type: 'psi'; x: number; y: number }
  | { type: 'glyph'; x: number; y: number; ok: boolean }
  | { type: 'lever'; x: number; y: number }
  | { type: 'land' }
  | { type: 'beam' }
  | { type: 'gust'; x: number; y: number }
  | { type: 'join' }
  | { type: 'wait' } // Luna sat down at her fort
  | { type: 'bark'; x: number; y: number }

// ---------------------------------------------------------------------------
// Save (localStorage.zeldaSave, mirrored to the player's profile)
// ---------------------------------------------------------------------------

export interface SaveData {
  v: typeof SAVE_VERSION
  map: string
  entry: string
  hp: number
  maxHp: number
  inv: Inventory
  flags: string[]
  rng: number
  elapsed: number
  /** Wall-clock ms of the write, set by the shell; newest wins against the profile copy. */
  savedAt?: number
}
