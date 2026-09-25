/**
 * Night of the Dead Battery — shared types. The engine (engine/) is pure
 * TypeScript with no DOM; content/ is the game's data and scripts; render/
 * paints on the pixel stage. See DESIGN.md.
 *
 * Coordinates: room pixels. A room is `w` wide and ROOM_H tall; an actor's
 * (x, y) is where its feet touch the floor.
 */

export const ROOM_H = 144

export type HeroId = 'kjell' | 'dag' | 'espen'
export const HERO_IDS: readonly HeroId[] = ['kjell', 'dag', 'espen']

/** Heroes and the house's people. */
export type ActorId = HeroId | 'bones' | 'hedvig' | 'gustav' | 'cat' | 'bat' | 'professor' | 'narrator'

export type Verb = 'give' | 'pickup' | 'use' | 'open' | 'look' | 'push' | 'close' | 'talk' | 'pull'
/** The verb grid, row by row (DOTT's order). */
export const VERB_GRID: readonly Verb[] = ['give', 'pickup', 'use', 'open', 'look', 'push', 'close', 'talk', 'pull']
export const VERB_LABEL: Record<Verb, string> = {
  give: 'Give', pickup: 'Pick up', use: 'Use', open: 'Open', look: 'Look at',
  push: 'Push', close: 'Close', talk: 'Talk to', pull: 'Pull',
}
/** Keyboard shortcuts. */
export const VERB_KEY: Record<Verb, string> = {
  give: 'g', pickup: 'p', use: 'u', open: 'o', look: 'l', push: 's', close: 'c', talk: 't', pull: 'y',
}

export type Dir = 'left' | 'right' | 'up' | 'down'
export type Floor = 'ground' | 'cellar' | 'attic' | 'outside'

export type Pt = readonly [number, number]
/** A polygon, clockwise or not. */
export type Poly = readonly Pt[]
/** x, y, w, h. */
export type Rect = readonly [number, number, number, number]

export type RoomId =
  | 'driveway'
  | 'foyer' | 'parlour' | 'kitchen' | 'conservatory'
  | 'pantry' | 'boiler' | 'lab'
  | 'storeroom' | 'study' | 'roof'

export type ItemId =
  | 'manual' | 'keys' | 'sandwich' | 'emf'
  | 'matches' | 'oil' | 'sardines' | 'umbrella'
  | 'monocle' | 'letters'
  | 'jam' | 'labkey' | 'cat'
  | 'gloves' | 'poker' | 'clockkey'

// ---------------------------------------------------------------------------
// State (what a save holds)
// ---------------------------------------------------------------------------

export type FlagValue = boolean | number | string

export interface ActorState {
  /** null: not in any room (not placed yet, or gone). */
  room: RoomId | null
  x: number
  y: number
  face: Dir
  /** Hidden actors are not drawn and cannot be clicked. */
  visible: boolean
  /** A named pose the painter knows ('reach', 'shrug', 'sleep', …); '' is idle/walk. */
  pose: string
}

export interface GameState {
  v: 1
  hero: HeroId
  actors: Record<string, ActorState>
  inv: Record<HeroId, ItemId[]>
  flags: Record<string, FlagValue>
  /** Seconds of play. */
  time: number
}

// ---------------------------------------------------------------------------
// Scripts: generators that yield commands
// ---------------------------------------------------------------------------

export interface ChoiceOption {
  id: string
  text: string
  /** Shown only when true. */
  when?: boolean
}

/**
 * A command a script yields. Blocking commands hold the script until they
 * finish (a line is read out, a walk arrives, a fade is done); the rest
 * apply at once and the script continues in the same tick.
 */
export type Cmd =
  /** A line of speech over `who`'s head. Blocking; a click skips it. */
  | { t: 'say'; who: ActorId; text: string }
  /** Walk `who` (in their own room) to (x, y). Blocking unless `wait` is false. */
  | { t: 'walk'; who: ActorId; x: number; y: number; wait?: boolean }
  /** Wait until `who` has stopped walking. */
  | { t: 'arrive'; who: ActorId }
  | { t: 'face'; who: ActorId; dir: Dir }
  /** Set a pose ('' clears). With `s`, the pose clears itself after s seconds (non-blocking). */
  | { t: 'pose'; who: ActorId; pose: string; s?: number }
  | { t: 'wait'; s: number }
  /** Put an actor in a room at once (no fade). */
  | { t: 'place'; who: ActorId; room: RoomId | null; x: number; y: number; face?: Dir }
  | { t: 'show'; who: ActorId; visible: boolean }
  /** The current hero goes through a door: fade out, place, fade in. Blocking. */
  | { t: 'go'; room: RoomId; x: number; y: number; face?: Dir }
  /** Show a room other than the current hero's (cutscene cuts), or null to go back. Blocking fade when `fade`. */
  | { t: 'view'; room: RoomId | null; fade?: boolean; camX?: number }
  /** DOTT split screen: up to three rooms side by side, each centred on an x. */
  | { t: 'split'; panes: { room: RoomId; x: number }[] | null }
  /** Change hero (the view follows). */
  | { t: 'hero'; id: HeroId }
  /** A dialogue choice; the script gets the chosen option's id back from `yield`. */
  | { t: 'choose'; options: ChoiceOption[] }
  /** A caption card over a black screen ("MEANWHILE, IN THE CELLAR…"). Blocking. */
  | { t: 'card'; text: string; s: number }
  /** Fade the scene to black (1) or back (0). Blocking. */
  | { t: 'fade'; to: 0 | 1; s: number }
  | { t: 'sfx'; name: string }
  /** 'auto' follows the current hero's floor; a name forces a cue; null is silence. */
  | { t: 'music'; name: string | null }
  | { t: 'flash'; color: string; a: number }
  | { t: 'shake'; s: number; px?: number }
  /** A lightning strike now (storm light and thunder). */
  | { t: 'lightning'; a?: number }
  /** A puzzle solved: the sting, and the save point. */
  | { t: 'solve'; id: string }
  /** The game is over; the page shows the end. */
  | { t: 'end' }

export type Script = Generator<Cmd, void, any>
/** A handler either returns a script, a line for the hero to say, or nothing. */
export type HandlerResult = Script | string | void
export type Handler = (c: Ctx) => HandlerResult

/**
 * What a handler sees. Mutations (`set`, `give`, `take`, `move`…) apply at
 * once; the command makers (`say`, `walk`, `wait`…) build commands to `yield`.
 *
 *   look: c => 'A clock. Stopped at 11:59.'
 *   use: function* (c) { yield c.say('Here goes.'); c.set('clock.wound'); yield c.sfx('clock') }
 */
export interface Ctx {
  readonly s: GameState
  /** The hero doing the sentence (the current hero). */
  readonly hero: HeroId
  /** The hero's room. */
  readonly room: RoomId

  flag(name: string): FlagValue | undefined
  is(name: string): boolean
  set(name: string, v?: FlagValue): void
  clear(name: string): void
  /** Adds to `n` (default 1) and returns the new count. */
  bump(name: string, n?: number): number

  has(item: ItemId, hero?: HeroId): boolean
  /** Into the hero's inventory (default the current one). Removes it from anyone else. */
  give(item: ItemId, hero?: HeroId): void
  /** Out of whoever has it. */
  take(item: ItemId): void
  who(item: ItemId): HeroId | null

  actor(id: ActorId): ActorState

  /** One of these, at random (a script-stable pick). */
  pick<T>(options: readonly T[]): T
  /** By hero: `c.by({ kjell: '…', dag: '…', espen: '…' })`. */
  by<T>(lines: Record<HeroId, T>): T

  say(text: string): Cmd
  sayAs(who: ActorId, text: string): Cmd
  walk(x: number, y: number, wait?: boolean): Cmd
  walkAs(who: ActorId, x: number, y: number, wait?: boolean): Cmd
  arrive(who: ActorId): Cmd
  face(dir: Dir, who?: ActorId): Cmd
  pose(pose: string, s?: number, who?: ActorId): Cmd
  wait(s: number): Cmd
  place(who: ActorId, room: RoomId | null, x: number, y: number, face?: Dir): Cmd
  show(who: ActorId, visible: boolean): Cmd
  go(room: RoomId, x: number, y: number, face?: Dir): Cmd
  view(room: RoomId | null, fade?: boolean, camX?: number): Cmd
  split(panes: { room: RoomId; x: number }[] | null): Cmd
  heroCmd(id: HeroId): Cmd
  choose(options: ChoiceOption[]): Cmd
  card(text: string, s?: number): Cmd
  fade(to: 0 | 1, s?: number): Cmd
  sfx(name: string): Cmd
  music(name: string | null): Cmd
  flash(color?: string, a?: number): Cmd
  shake(s?: number, px?: number): Cmd
  lightning(a?: number): Cmd
  solve(id: string): Cmd
  end(): Cmd
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

export type HandlerMap = Partial<Record<Verb, Handler | string>>

export interface HotspotDef {
  id: string
  /** Shown on the sentence line. May depend on state. */
  name: string | ((s: GameState) => string)
  /** Click area in room pixels. */
  rect: Rect
  /** Where the hero stands to use it (feet). Omit with `far`. */
  at?: Pt
  /** Which way the hero faces there. */
  face?: Dir
  /** Too far to walk to (the sky, a view): verbs run where the hero stands. */
  far?: boolean
  /** Present only while true. */
  when?: (s: GameState) => boolean
  /** Right-click, and the verb lit while hovering. Default 'look' (or 'open' for exits… no: exits walk). */
  default?: Verb
  /** Verbs with no second object. A string is a line for the hero. */
  verbs?: HandlerMap
  /** USE <item> WITH this. */
  useWith?: Partial<Record<ItemId, Handler | string>>
  /** GIVE <item> TO this. */
  giveWith?: Partial<Record<ItemId, Handler | string>>
  /** Line (or handler) for USE/GIVE of any other item on this. */
  anyItem?: Handler | string
  /** A door or passage: walking onto it (or any click with no verb) goes through. */
  exit?: ExitDef
  /** An NPC: speech from TALK TO etc. is placed over this actor. */
  actor?: ActorId
  /**
   * Stack order when rects overlap: higher wins. Default 0; actors and
   * small things on bigger things (a jar on a shelf) go higher.
   */
  z?: number
}

export interface ExitDef {
  to: RoomId
  /** Arrival point in the target room. */
  x: number
  y: number
  face?: Dir
  /** While false, the exit refuses: `locked` is said (or run) instead. */
  open?: (s: GameState) => boolean
  locked?: Handler | string
}

export interface RoomDef {
  id: RoomId
  name: string
  floor: Floor
  /** Width in pixels (≥ 400 so a phone's view is filled); height is ROOM_H. */
  w: number
  /** The floor the heroes can walk on: the union of these polygons. */
  walk: Poly[]
  /** Holes in the walk area (furniture on the floor). */
  blocks?: Poly[]
  hotspots: HotspotDef[]
  /** Runs when the current hero comes in (after the fade). */
  enter?: Handler
  /** Runs once per game, the first time a hero comes in (before `enter`). */
  first?: Handler
}

export interface ItemDef {
  id: ItemId
  /** Inventory name; may depend on state (the jam opens). */
  name: string | ((s: GameState) => string)
  /** LOOK AT. */
  look: Handler | string
  /** USE with no second object runs at once (instead of "Use X with …"). */
  useAlone?: Handler | string
  /** Other verbs on the item in the inventory (OPEN letters, PULL …). */
  verbs?: HandlerMap
  /** USE this WITH another item. */
  combine?: Partial<Record<ItemId, Handler | string>>
  /**
   * The dumbwaiter. Return a line (or script) to refuse; void lets it go.
   * Omit to always allow.
   */
  send?: (c: Ctx, to: HeroId) => HandlerResult
  /** Said by the receiving hero when it arrives. */
  arrive?: Partial<Record<HeroId, string>>
}

export interface HeroDef {
  id: HeroId
  name: string
  /** Speech colour. */
  color: string
  floor: Floor
  start: { room: RoomId; x: number; y: number; face: Dir }
  inv: ItemId[]
  /** Walking speed, px/s. */
  speed: number
  /** Head height above the feet, for speech. */
  talkY: number
  /** Fallback lines per verb when nothing handles the sentence. */
  fail: Record<Verb, readonly string[]>
  /** USE/GIVE with something that doesn't fit. */
  failWith: readonly string[]
}

export interface NpcDef {
  id: Exclude<ActorId, HeroId>
  name: string
  color: string
  start: { room: RoomId | null; x: number; y: number; face: Dir; pose?: string; visible?: boolean }
  talkY: number
}

// ---------------------------------------------------------------------------
// Engine ↔ shell
// ---------------------------------------------------------------------------

/** Things that happened this tick, for audio and effects. */
export type GameEvent =
  | { t: 'sfx'; name: string }
  | { t: 'music'; name: string | null; floor: Floor }
  | { t: 'speak'; who: ActorId; text: string }
  | { t: 'lightning'; a: number }
  | { t: 'flash'; color: string; a: number }
  | { t: 'shake'; s: number; px: number }
  | { t: 'solve'; id: string }
  | { t: 'room'; room: RoomId }
  | { t: 'hero'; id: HeroId }
  | { t: 'save' }
  | { t: 'end' }

/** A line being spoken, for the renderer. */
export interface Speech {
  who: ActorId
  text: string
  /** Seconds since it began. */
  age: number
  dur: number
}

export interface SaveFile {
  v: 1
  state: GameState
  savedAt: number
}
