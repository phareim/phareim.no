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

import type { FrontierNpcLook } from './render/frontierSprites'

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
export const SWING_COOLDOWN = 0.06
/**
 * The blade's three-hit chain (`engine/hero.ts`): two quick sweeps, the second back the other way, then a wider,
 * heavier finisher. `time` s; `arc` rad; `dmg` (doubled by the Arc Blade); `knock` × a foe's ordinary shove;
 * `stagger` s the foe stands reeling; `lunge` tiles stepped forward in the first LUNGE_TIME; `stop` ms of hitstop;
 * `cool` s of rest after it.
 */
export const COMBO = [
  { time: 0.17, arc: Math.PI * 0.9, dmg: 1, knock: 0.45, stagger: 0.22, lunge: 0.22, stop: 35, cool: 0 },
  { time: 0.17, arc: Math.PI * 0.9, dmg: 1, knock: 0.45, stagger: 0.22, lunge: 0.22, stop: 35, cool: 0 },
  { time: 0.25, arc: Math.PI * 1.15, dmg: 2, knock: 1.7, stagger: 0.4, lunge: 0.5, stop: 85, cool: 0.2 },
] as const
/** After a swing ends, a press this soon continues the chain (s). */
export const COMBO_WINDOW = 0.32
/** A press waiting in the buffer may start the next hit from this share of a swing on. */
export const CHAIN_CANCEL = 0.6
/** The share of a chain swing spent pulling the blade back; it hits nothing yet. */
export const WINDUP = 0.15
/** A press of A (or the roll) that cannot act yet is kept this long (s). */
export const BUFFER_A = 0.18
/** A chain swing steps forward over its first this many seconds. */
export const LUNGE_TIME = 0.07
/** Tiles/s² the hero speeds up by from a stand (stopping is instant). */
export const HERO_ACCEL = 80
/** The dodge roll: seconds, tiles covered, seconds no harm lands, rest after it, the share of a swing it may cut. */
export const ROLL_TIME = 0.3
export const ROLL_DIST = 2.2
export const ROLL_IFRAMES = 0.2
export const ROLL_COOLDOWN = 0.15
export const ROLL_CANCEL = 0.35

/**
 * Tough foes (`engine/enemies.ts`, docs/games/neon-shrine.md "Tough foes"): a sentry or a hound whose mark says
 * `tough`. `hp` its hit points (a blade takes none while it is not open, `toughOpen`); `stunDisc` and
 * `stunHook` s of stun, then `shrug` s in which it cannot be stunned again. The sentry: it walks at a hero it sees
 * within `sight` tiles at `stalk` tiles/s; after `pause` s of that, within `range` tiles, it stands `tell` s and
 * charges at `charge` tiles/s. The hound: its own prowl, a tell of `houndTell` s, a lunge at `lunge` tiles/s, a
 * second tell of `retell` s and a second lunge. A charge or a lunge ends `past` tiles beyond the point it was aimed
 * at; then the foe stands `spent` s, open.
 */
export const TOUGH = {
  hp: { sentry: 12, hound: 10 },
  stunDisc: 1.2,
  stunHook: 1,
  shrug: 4,
  sight: 7,
  stalk: 1.6,
  pause: 1.2,
  range: 4.5,
  tell: 0.6,
  charge: 9,
  houndTell: 0.5,
  retell: 0.25,
  lunge: 10,
  past: 1.2,
  /** The hound skids further past its mark, so that its second lunge starts from a distance one can answer. */
  houndPast: 2.2,
  spent: 1,
  /** What one opening gives the blade, whatever the blade: with that much taken, the foe shakes itself shut. */
  take: 5,
} as const

// ---------------------------------------------------------------------------
// The blade's acrobatics (`engine/moves.ts`, docs/games/neon-shrine.md "Combos and the hop")
// ---------------------------------------------------------------------------

/**
 * What the hero does in the air. `flip`: out of a roll (R, A), a forward somersault that comes down in an
 * overhead chop; `back`: out of the chain (A, R), a flip back away from the blow; `spring`: a roll into a wall
 * kicks off it; `comet`: from any of those three, A rockets the hero blade-first along the aim; `tempest`: A
 * right as the finisher lands, an aerial double whirl; `hop`: the HOP art on B, a quick low hop away, still facing
 * the foe.
 */
export type AirKind = 'flip' | 'back' | 'spring' | 'comet' | 'tempest' | 'hop'

/**
 * Each kind's shape: `time` s in the air, `top` tiles at the arc's peak, `speed` tiles/s along the ground at the
 * start (`drag` the share of it lost by the end), `rest` s after landing before the blade is free.
 */
export const AIR: Record<AirKind, { time: number; top: number; speed: number; drag: number; rest: number }> = {
  flip: { time: 0.36, top: 0.85, speed: 5.2, drag: 0.55, rest: 0.1 },
  back: { time: 0.34, top: 0.8, speed: 7, drag: 0.6, rest: 0.04 },
  spring: { time: 0.34, top: 0.9, speed: 7.5, drag: 0.5, rest: 0.04 },
  comet: { time: 0.2, top: 0.3, speed: 17, drag: 0.35, rest: 0.14 },
  tempest: { time: 0.5, top: 1.05, speed: 2.4, drag: 0.2, rest: 0.18 },
  hop: { time: 0.3, top: 0.5, speed: 9.5, drag: 0.6, rest: 0.02 },
}
/** FLIP CUT: the chop at the landing, its reach and arc (rad), and the ring of the blow all round. */
export const FLIP_CHOP = { reach: 1.45, arc: Math.PI * 1.2, dmg: 3, ring: 1.25 }
/** COMET: damage to each foe it passes through. TEMPEST: turns in the air, damage a blow, its reach. */
export const COMET_DMG = 2
export const TEMPEST = { turns: 2, dmg: 1, reach: 1.5 }
/** A press of A this long after a back flip or a wall spring lands still launches the comet (s). */
export const COMET_WINDOW = 0.22
/** TEMPEST: a press from this share of the finisher on, or this long after it, takes off. */
export const TEMPEST_FROM = 0.55
export const TEMPEST_WINDOW = 0.2
/** SLIP: the world runs at this share of its pace this long (s) after a blow passes through a dodge; then a rest. */
export const SLIP_SCALE = 0.35
export const SLIP_TIME = 0.9
export const SLIP_COOL = 3

/** The combos the MOVES page lists, in its order. */
export type MoveId = 'triple' | 'whirl' | 'flip' | 'backflip' | 'comet' | 'tempest' | 'spring' | 'slip' | 'hopcut'
/**
 * Each combo: its name, the buttons (A the blade, R the roll, B the hop, `>` "into"), what one more of it needs to count
 * towards mastery (`need` of them masters it), and what mastering it gives.
 */
export const MOVES: ReadonlyArray<{ id: MoveId; name: string; keys: string; need: number; perk: string }> = [
  { id: 'triple', name: 'TRIPLE CUT', keys: 'A A A', need: 20, perk: '+1 TO THE FINISHER' },
  { id: 'whirl', name: 'WHIRL', keys: 'HOLD A', need: 12, perk: '+1 TO THE SPIN' },
  { id: 'flip', name: 'FLIP CUT', keys: 'R A', need: 12, perk: '+1 TO THE CHOP' },
  { id: 'backflip', name: 'BACKFLIP', keys: 'A R', need: 12, perk: 'FLIES FARTHER' },
  { id: 'comet', name: 'COMET', keys: 'A R A', need: 10, perk: '+1 TO THE THRUST' },
  { id: 'tempest', name: 'TEMPEST', keys: 'A A A A', need: 8, perk: '+1 EVERY TURN' },
  { id: 'spring', name: 'WALL SPRING', keys: 'R > WALL', need: 6, perk: 'SPRINGS FARTHER' },
  { id: 'slip', name: 'SLIP', keys: 'R > BLOW', need: 6, perk: 'LONGER SLOW' },
  { id: 'hopcut', name: 'HOP CUT', keys: 'B A', need: 10, perk: '+1 TO THE CUT' },
]

/** The art the B button can hold instead of an item (`engine/moves.ts`): the Keeper teaches it once the blade is in hand. */
export type ArtId = 'hop'
/** Each art: its name, seconds before it is ready again, and the item that grants it. */
export const ARTS: ReadonlyArray<{ id: ArtId; name: string; cool: number; item: ItemId }> = [
  { id: 'hop', name: 'HOP', cool: 0.7, item: 'artHop' },
]
/**
 * HOP (`AIR.hop`) and the HOP CUT out of it. `seek`: how near a foe the hop turns to face it and hops away from it
 * (tiles); `window`: s after the landing a press of A still throws the HOP CUT; the cut springs back in at the nearest
 * foe within `reach` of the hero and `cone` (rad either side) of the aim, at `speed` tiles/s, `spring` tiles at most
 * (`bare` with no foe that way).
 */
export const HOP = { seek: 4, window: 0.25, reach: 4.2, cone: Math.PI * 0.34, speed: 24, spring: 3, bare: 0.8 }
/** Each landed blow takes this long off every art still resting (s). */
export const ART_FEED = 0.25
/** After lines close, A must rest this long before it talks, reads or opens again (s). */
export const TALK_REST = 0.35
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
export const PSI_SPEED = 11 // a psi block sliding, tiles/s
export const PUSH_DELAY = 0.32 // walk into a block this long to push it
export const PUSH_TIME = 0.28
export const MAX_BITS = 9999
export const START_HP = 6 // half-hearts
/** The most a save keeps (half-hearts): above every heart the world holds (22 now; tests/zelda-frontier.test.mjs counts them). */
export const MAX_HP = 30
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
  | '□' // square block: solid in the 8-bit view, an outline on the floor in the isometric one
  | '◇' // diamond block: solid in the isometric view, an outline on the floor in the 8-bit one
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
  // The VIP hall's door
  | 'q' // the bar's back shelf of bottles (solid, wall)
  | '¤' // velvet rope (solid, projectiles pass; gone while `GameState.session` is true)
  // Terrain (`engine/terrain.ts`; only on maps with `MapDef.terrain`, where heights do the blocking)
  | 'а' // stone: a rock column's top
  | 'б' // timber: a wooden block
  | 'в' // turf: raised earth with grass on it
  | 'д' // bare earth, at any height
  | 'е' // lumen ore: stone with a pink vein
  | 'ж' // ramp rising north
  | 'з' // ramp rising south
  | 'и' // ramp rising east
  | 'й' // ramp rising west
  | 'к' // a hole, one level below the ground
  // Physical puzzles (`engine/puzzles/`, docs/games/neon-shrine-puzzles.md)
  | 'α' // ice (walkable; the hero, blocks, mirrors and thrown pots slide over it until something stops them)
  | 'β' // beam emitter (solid; mark `emitter` gives its way and when it shines)
  | 'μ' // mirror '/' (solid, pushable, slides on ice; a hit turns it to 'ν')
  | 'ν' // mirror on the other diagonal, north-west to south-east (as 'μ')
  | 'π' // prism (solid; splits a beam into the two ways across it)
  | 'ρ' // beam receiver (solid; lit by a beam it sets its mark's flag for good)
  | 'θ' // light plate (walkable; held by any weight: the hero, a block, a foe)
  | 'η' // heavy plate (walkable; held by weight 2: a block, a boulder, the hero carrying a pot or rock)
  | 'σ' // scale pan (walkable; the pans sharing a plate id are down only while they carry equal weight)
  | 'κ' // boulder (solid; rolls when its mark's flag is set or a bomb kicks it: crushes foes, breaks cracked walls, fills pits)
  | 'ω' // sluice water (water while its sluice group is full)
  | 'ψ' // drained sluice floor (walkable while its sluice group is drained)
  | 'ξ' // valve wheel (solid; a hit opens or shuts its mark's sluice flag)
  // Lumen tubes (Relight the Sign: `engine/puzzles/tubes.ts`, `world/tubes.ts`). Walkable glass tubes in the ground,
  // drawn as the box chars look; a blade, the disc or A turns a light one a quarter clockwise, a double one is bolted.
  | '╵' | '╶' | '╷' | '╴' // a capped end, open north / east / south / west
  | '│' | '─' | '┌' | '┐' | '└' | '┘' | '├' | '┤' | '┬' | '┴' | '┼'
  | '║' | '═' | '╔' | '╗' | '╚' | '╝' | '╠' | '╣' | '╦' | '╩' | '╬'
  | 'Θ' // a lumen tap (solid): the gas comes out of it into any tube that opens onto it
  | 'Λ' // a socket (solid): the line up the hill to one letter; gas reaching it with no end left open lights it

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
  // The art (`engine/moves.ts`), for the B button
  | 'artHop' // the Keeper
  // The seven Sacred Weights (`WEIGHTS`, docs/worlds/sacred-weights.md): one a land's dungeon
  | WeightId

export type WeightId =
  | 'weightMeaning' | 'weightReasons' | 'weightNo' | 'weightSurprise'
  | 'weightFingers' | 'weightCredit' | 'weightSources'

/**
 * The Sacred Weights: each is stamped with `word` and belongs to the land `land` (a map id). Holding one is the flag
 * `item:<id>` every grant sets, and nothing else: no inventory field (`engine/map.ts` `hasWeight`, `weightCount`).
 */
export const WEIGHTS: ReadonlyArray<{ id: WeightId; word: string; land: string }> = [
  { id: 'weightMeaning', word: 'MEANING', land: 'seterfell' },
  { id: 'weightReasons', word: 'REASONS', land: 'yulefjord' },
  { id: 'weightNo', word: 'NO', land: 'sporelight' },
  { id: 'weightSurprise', word: 'SURPRISE', land: 'stillsand' },
  { id: 'weightFingers', word: 'FINGERS', land: 'rerun' },
  { id: 'weightCredit', word: 'CREDIT', land: 'lumenby' },
  { id: 'weightSources', word: 'SOURCES', land: 'fogstage' },
]

/** What B can hold: a thing (`B_ITEMS`) or an art (`ARTS`). */
export type UseItem = ToolId | ArtId
export type ToolId = (typeof B_TOOLS)[number]['id']
/** A row of `B_ITEMS`: its HUD name and icon, and whether the hero has it. */
export interface BItem { id: string; name: string; icon: string; owned: (inv: Inventory) => boolean }

/**
 * The things B holds, in the cycle's order. A new one is a row here and its code: what pressing B does
 * (`engine/hero.ts` `TOOL_USE`, which tsc requires) and what gives it (`grant`).
 */
const B_TOOLS = [
  { id: 'hook', name: 'HOOK', icon: 'item_hook', owned: (inv: Inventory) => inv.hook },
  { id: 'disc', name: 'DISC', icon: 'item_disc', owned: (inv: Inventory) => inv.disc },
  { id: 'bombs', name: 'BOMBS', icon: 'item_bombbag', owned: (inv: Inventory) => inv.bombBag },
] as const satisfies readonly BItem[]

/** Everything B can hold, in the cycle's order: the things, then the arts. What `useItems`, a save and the HUD read. */
export const B_ITEMS: ReadonlyArray<BItem & { id: UseItem }> = [
  ...B_TOOLS,
  ...ARTS.map(a => ({ id: a.id, name: a.name, icon: `item_${a.id}`, owned: (inv: Inventory) => !!inv.arts?.includes(a.id) })),
]
/** The row of `B_ITEMS` for `id`; undefined for anything else (a name a save holds and the game does not know). */
export const bItem = (id: unknown) => B_ITEMS.find(b => b.id === id)

/** What the ITEMS page says of each thing B can hold, under its grid: its name and one line of what it does. */
export const B_WORDS: Readonly<Record<UseItem, { name: string; does: string }> & Record<string, { name: string; does: string }>> = {
  hook: { name: 'THE HOOK', does: 'PULLS YOU TO WHAT IT BITES.' },
  disc: { name: 'THE DISC', does: 'COMES BACK. STUNS WHAT IT HITS.' },
  bombs: { name: 'BOMBS', does: 'OPEN CRACKED WALLS. MIND YOUR FEET.' },
  hop: { name: 'THE HOP', does: 'A SHORT JUMP. NOTHING LANDS ON YOU IN THE AIR.' },
  echo: { name: 'THE ECHO', does: 'LEAVES ONE OF YOU. WHEN YOU CUT, IT CUTS.' },
}

/**
 * A map whose ground has heights (`engine/terrain.ts`). Every tile gets a height 0–4: walking crosses equal
 * heights, steps down freely and goes up only by a ramp.
 */
export interface TerrainDef {
  /** Heights, a digit per tile in rows like `rows`; any other char (or no rows) is `ground`. */
  heights?: string[]
  /** The ground's level (default 1): one below it is a hole. */
  ground?: number
}

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

/**
 * The two sides of the view rule (`engine/map.ts`, `blockUp`): 'flat' every view of the classic drawing engine (the
 * 8-bit top-down picture), 'iso' every view of the isometric one. By the engine, never by a view's id, so a
 * studio-made view inherits the rule.
 */
export type ViewSide = 'flat' | 'iso'

/** A condition on progress. `clear` = every enemy of the gate's room is dead. */
export type Cond =
  | { flag: string }
  | { notFlag: string }
  | { clear: true }
  | { plates: string[] }
  | { item: ItemId }
  | { flags: string[]; not?: string[] } // all of `flags`, none of `not`
  | { session: boolean } // logged in on auth.phareim.no (true) or not (false); never saved
  | { view: ViewSide } // the view rule in force now (`GameState.view`); never saved

export interface TalkBranch {
  /** First branch whose condition holds is spoken. No condition = default. */
  when?: Cond
  lines: string[]
  /** Given once after the lines: once per person and item (flag `got:<npc id>:<item>`), and once per step where the branch has a `set` (`got:<npc id>:<item>:<set>`). */
  give?: ItemId
  /** Flag set after speaking. */
  set?: string
  /** Flag cleared after speaking. */
  clear?: string
  /** After the lines the shell opens this panel (the login console's), and the auth page brings the hero back to the entry named `<npc id>`. */
  panel?: PanelId
  /** After the lines a two-way choice (left, right); the pick answers with its own lines. */
  ask?: TalkAsk
}

export interface TalkAsk { options: [string, string]; replies: [string[], string[]] }

/** Entity placed by a marker char in the rows. */
export type EntDef =
  | {
    t: 'enemy'; kind: EnemyKind; dir?: Dir; once?: string; carries?: ItemId
    /** A sentry that only patrols, harmless, until a blow lands on it (`ai.angry`). */
    calm?: boolean
    /** A tough foe (`TOUGH`): a sentry or a hound only, never a calm one (`validate.ts`). */
    tough?: boolean
  }
  | { t: 'chest'; id: string; item: ItemId; big?: boolean; appear?: Cond }
  | { t: 'item'; id: string; item: ItemId; appear?: Cond } // lies on the floor, one-time
  | {
    t: 'npc'; id: string; look: NpcLook; dir?: Dir; talk: TalkBranch[]; wander?: boolean
    /** Not there while this holds (checked on load and after every talk). */
    hide?: Cond
    /** Joins the hero as a follower once `hide` holds after a talk (Luna). */
    join?: boolean
  }
  /** Read facing it (tile 'S'); `alt` is read instead while its condition holds. */
  | { t: 'sign'; lines: string[]; alt?: { when: Cond; lines: string[] } }
  | { t: 'shop'; id: string; item: ItemId; price: number; once?: boolean }
  | { t: 'plate'; id: string }
  | { t: 'entry'; id: string; dir?: Dir } // an entry point at the marker's tile centre
  | { t: 'warp'; to: string; entry: string } // stepping on this tile warps
  /**
   * On one tile of an X run (tile 'X'). A shut gate opens for good once `open` holds. A `trap` gate (a dungeon room
   * only, no `open` of its own) starts open, shuts behind the hero in its room while a foe lives there, and opens for
   * good when the room is clear (`engine/objects.ts`).
   */
  | { t: 'gate'; open: Cond; trap?: false }
  | { t: 'gate'; trap: true; open?: never }
  | { t: 'glyph'; ch: string } // a letter stone (tile '{')
  | { t: 'lever'; flag: string } // a lever or breaker (tile '}'): a hit sets `flag` for good
  // Physical puzzles (`engine/puzzles/`): each also works unmarked with defaults, see world/puzzles.ts
  | { t: 'emitter'; dir: Dir; when?: Cond } // a beam emitter (tile 'β'), shining along `dir` while `when` holds
  | { t: 'receiver'; flag: string } // a beam receiver (tile 'ρ'): lit, it sets `flag` for good
  | { t: 'boulder'; dir: Dir; flag?: string } // a boulder (tile 'κ') that rolls along `dir` once `flag` is set
  | { t: 'sluice'; flag: string; invert?: boolean } // sluice tiles ('ω' / 'ψ'): full while `flag` is unset (set, with `invert`)
  | { t: 'valve'; flag: string } // a valve wheel (tile 'ξ'): a hit sets or clears `flag`
  | { t: 'socket'; flag: string; letter?: string } // a tube socket (tile 'Λ'): fed, it sets `flag` for good; `letter` it lights
  | ExitDef

export type NpcLook = 'keeper' | 'vendor' | 'kid' | 'robot' | 'cat' | 'ghost' | 'petter' | 'luna' | 'mossa' | 'dusty' | 'toby' | 'max' | 'owl' | 'troll' | 'hippie' | 'smoker' | 'guitar' | 'sleeper' | 'twirler' | 'bonfire' | 'guard' | 'barmaid' | 'tree' | FrontierNpcLook

/**
 * Where an exit leads: another theme on phareim.no (`?theme=<id>`), the
 * portal at `/`, or a page outside the site. The engine only reports it (the
 * `exit` event); the Vue shell does the navigating. `reset` is the NEW GAME
 * machine in Petter's house: it leaves nothing, its lines close into a
 * `startOver` event and the shell asks yes or no. `panel` is the login
 * console in Petter's house: it leaves nothing either, its A press becomes
 * a `panel` event and the shell opens that HTML panel over the world. The
 * NEW LOOK booth on the square and the newsstand on the coast open their
 * panels the same way.
 */
export type ExitTarget = { theme: string } | { home: true } | { url: string } | { reset: true } | { panel: PanelId }

/** The shell's HTML panels an exit can open: `account` is the login console (`AccountConsole.vue`), `look` the NEW LOOK booth's mirror (`LookBooth.vue`), `news` the newsstand's reader (`NewsStand.vue`). `view` opens nothing: the viewfinder on the square turns the world to its next view (`views.ts`). */
export type PanelId = 'account' | 'look' | 'news' | 'view'

/** How the renderer draws an exit. The engine ignores it. */
export type ExitLook = 'door' | 'cabinet' | 'board' | 'kiosk' | 'terminal' | 'console' | 'sign' | 'booth' | 'stall' | 'scope'

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

/**
 * A named colour of the world. World data says which; each view decides the
 * exact hue (`render/tones.ts`), so a map never carries a hex value.
 */
export type Tone = 'pink' | 'cyan' | 'violet' | 'gold' | 'rose' | 'teal' | 'lilac' | 'amber' | 'fire' | 'cream' | 'ice' | 'red'

/** A named light level for a room, instead of its kind's default. 'dim': a lounge whose lamps show. */
export type Ambience = 'dim'

/** Neon lettering painted into the world (Petter's name over the town). */
export interface Decal {
  /** Anchor in tile units: the text's top edge, and its left edge or centre (align). */
  x: number
  y: number
  text: string
  tone?: Tone
  /** Size step of the lettering: 1 small, 2 (default), 3 large. The classic view reads it as the 5×7 font's pixel scale. */
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
  kind: 'tent' | 'campfire' | 'mast' | 'lights' | 'rift' | 'tank' | 'van' | 'fort' | 'bike' | 'lift' | 'discoball' | 'glow'
  x: number
  y: number
  w?: number
  h?: number
  /** 'lights': the word the bulbs spell; 'stone'/'truck': a label. 'glow': w is the light's radius; 'discoball': w is the orbit of its four coloured spots, h how far below the ball their centre lies. */
  text?: string
  tone?: Tone
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
  /** An interior's light level, instead of the daylight default: a dim room whose lights show. */
  ambient?: Ambience
  /**
   * Maps sharing a keyring share small keys and a big key (a dungeon's
   * floors). Default 'shrine': `Inventory.keys`/`bigKey`; any other ring
   * keeps its small keys in `Inventory.keyrings` and its big key in the
   * flag `bigkey:<ring>`.
   */
  keyring?: string
  /** The painter's palette: Project Horizon's labs, the deep Wildwood; the lands' looks (`render/looks.ts`). */
  look?: 'lab' | 'wild' | 'snow' | 'dune' | 'spore' | 'fog' | 'quarry' | 'suburb'
  /** Crystal switches of every map in this group share one state (a flag), across rooms and floors. */
  crystal?: string
  /** Pits drop to this map (same size) at the same spot instead of hurting. */
  below?: string
  /** Letter stones: walking over them in this order sets `flag`. */
  codes?: Array<{ word: string; flag: string }>
  props?: Prop[]
  /** Isometric scenery, in tile units. Only those with a `solid` footprint are in anyone's way. */
  isoLandmarks?: IsoLandmark[]
  /**
   * The land beyond the coast this map belongs to (`docs/worlds/atlas.md`): its art kit, its light and air, its
   * people's and foes' looks, the critters that live there (`render/life/`).
   */
  realm?: string
  /** More art kits the map draws landmarks from, besides its realm's (`render/iso/frontierArt/index.ts`). */
  kits?: string[]
  /**
   * A land out past the hand-made coast: a reload of the tab continues here instead of in town, and walking in
   * opens its areas' first-visit words on arrival.
   */
  away?: boolean
  /**
   * The drawing engines this map may be shown in (`viewParams.ts`); absent,
   * every view. Elsewhere the shell shows the first allowed one for as long
   * as the hero is here, without changing the visitor's choice.
   */
  views?: Array<'classic' | 'iso'>
  /** The ground has heights here (`engine/terrain.ts`): benches, terraces and ramps. */
  terrain?: TerrainDef
  /** Physical combat (`engine/puzzles/`): foes knocked into pits, water or spikes fall, drown or are hurt. On by itself in a map with puzzle tiles. */
  physics?: boolean
}

export interface IsoLandmark {
  art: string
  x: number
  y: number
  z?: number
  /** The classic scenery the landmark replaces in the isometric view. */
  cover?: Rect
  /**
   * The tiles it stands on, solid to whoever walks (`MapInfo.scenery`, engine/map.ts): a cart, a crate, a mailbox
   * is in the way in every view, and where its art is not drawn a classic stand-in shows it (`render/standIns.ts`).
   * A tile on the run of a road, at the map's rim, under anyone or anything placed, beside an entry, a warp, a door
   * or an exit (unless the footprint spans that way in), or one that would cut off open ground stays open.
   */
  solid?: Rect
  /** Numbered art frames, or a one-pixel bob with the same artwork. */
  motion?: { frames: number; fps: number; bob?: boolean }
  /** A different sprite once a quest flag has been set. */
  lit?: { flag: string; art: string }
  /** Sprite variant in twilight and at night, including the frontier's initial dusk. */
  night?: string
  /** A local light alongside the emissive pixels of the sprite. */
  light?: { r: number; tone: Tone; a: number }
  shadow?: { tall: number; wide: number; deep?: number }
  /** What the landmark shines with in the isometric view (the classic one keeps its tiles' lights). */
  lights?: LandmarkLight[]
}

/**
 * A light a landmark carries: its colour, its reach and strength, where it hangs (tiles off the landmark's
 * anchor, and up from its foot), and how it moves: a fire flickers and throws embers and smoke, a pulse
 * breathes, a blink goes on and off, a sweep turns a beam round (a lighthouse, a stage spotlight). Under
 * reduced motion each holds still.
 */
export interface LandmarkLight {
  tone: Tone
  r: number
  a: number
  dx?: number
  dy?: number
  z?: number
  anim?: 'fire' | 'pulse' | 'blink' | 'sweep'
  /** Shines only once the landmark's `lit` flag is set (a lit letter, the lens). */
  lit?: boolean
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
  /**
   * Where each outdoor map lies on the one grid of the world (`docs/worlds/atlas.md`): the tile its top-left
   * corner is on. Walking off a map's edge where the ground is open carries the hero into the map that holds the
   * next tile, at the same place along the edge.
   */
  atlas?: Record<string, { x: number; y: number }>
  /**
   * Where a save made on a map the world no longer has continues (the generated frontier's `fr:` regions, gone
   * since the lands were made by hand), or null to fall back to the start.
   */
  rescue?: (map: string, entry: string) => { map: string; entry: string } | null
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
  /** A calm sentry (the mark's `calm`): it ignores the hero until struck (`ai.angry`). */
  calm?: boolean
  /** A tough foe (the mark's `tough`, `TOUGH`): its own hit points, poise until it is open, a bar over its head. */
  tough?: boolean
  /** Spawn point, for respawning on room re-entry. */
  home: Vec
  dead: boolean
  /** Hit flash for the renderer (seconds left). */
  flash: number
  /** Day and night (`engine/day.ts`): the foe level (0–2) from which it is out; absent before the prism and for foes the clock leaves alone. */
  rank?: number
  /** Out of the world for this part of the day (it is also `dead`). */
  away?: boolean
  /** Walking in to its home from past the screen's edge, or out past it. */
  trek?: { x: number; y: number; out: boolean; stuck: number }
  /** Seconds left reeling from a blow: it does nothing and harms no one (small foes only). */
  stagger?: number
  /** The reeling came from the blade's own chain (its quick hits): that does not make the finisher critical. */
  reelChain?: boolean
  /** Seconds since the last blow landed, and the way it was driven (unit vector): the renderer's squash and pop. */
  hitT?: number
  hitDx?: number
  hitDy?: number
  /** Seconds since it fell (set on the kill; the renderer's death pop). */
  deathT?: number
}

export interface Projectile {
  id: number
  kind: 'pellet' | 'laser' | 'spark' | 'shard' | 'wave' | 'spit' | 'gust'
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
  kind?: 'b' | 'B' | 'μ' | 'ν'
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
  /** `GameState.view`, read through (`loadMap` makes it so): what `solidTile` asks about the view blocks. */
  readonly view: ViewSide
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
  /** Seconds before a crystal switch answers again (one strike flips it once). */
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
  /** `MapDef.terrain`: the height of every tile, the ground's level, the hero's standing level. */
  terrain?: TerrainState
  /** The physical puzzles' live state (`engine/puzzles/`), made on first use; absent on maps without them. */
  phys?: PhysState
  /** Tiles the map's landmarks stand on (`MapInfo.scenery`): solid to walkers, whatever the tile is. */
  scenery?: ReadonlySet<number>
}

/** What the physical puzzles keep per map while it is loaded (never saved: flags carry what lasts). */
export interface PhysState {
  /** The hero sliding over ice along (dx, dy); `at` where he was last step (a jump ends the slide). */
  slide: null | { dx: number; dy: number; at: Vec }
  /** The beams this step, from tile centre to tile centre (tiles); `end` 1: it stops at a solid's face. */
  beams: Array<{ x0: number; y0: number; x1: number; y1: number }>
  /** Receiver tiles a beam reaches now. */
  lit: number[]
  /** Boulders rolling (centre, way, the tile it set out from, its home tile for the save). */
  rolling: Array<{ id: number; x: number; y: number; dx: number; dy: number; from: number; home: number; t: number }>
  /** Weight on each plate / pan tile now. */
  weight: Record<number, number>
  /** Sluice groups' state as last applied (true: full). */
  full: Record<string, boolean>
  /** Sluice tiles that wait for the hero to step off before they flood. */
  pending: number[]
  /** Seconds before a mirror or valve answers another hit. */
  cool: number
  /** Lumen tubes: the gas as last traced (`engine/puzzles/tubes.ts`); absent on maps without tubes. */
  gas?: GasState
}

/** The gas in a map's lumen tubes, traced again whenever the map changes (`MapState.version`). */
export interface GasState {
  /** The map's version it was traced at. */
  v: number
  /**
   * Tubes the gas is in: the tile, its arms (N 1, E 2, S 4, W 8), how many tubes from its tap, and when the gas
   * comes into it (`GameState.elapsed`; the picture runs it in from there).
   */
  tubes: Array<{ idx: number; arms: number; depth: number; t0: number }>
  /** Open ends the gas hisses out of: the tube and the way. */
  leaks: Array<{ idx: number; dx: number; dy: number }>
  /** Sockets the gas reaches through a line with no end open. */
  fed: number[]
}

export interface TerrainState { h: number[]; g: number; z: number }

export type HeroAct =
  | 'idle' | 'walk' | 'swing' | 'spin' | 'lift' | 'carry' | 'throw' | 'push'
  | 'use' | 'hurt' | 'get' | 'fall' | 'dead' | 'hook' | 'roll' | 'air'

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
  /**
   * Where the hero is headed, exactly (radians; 0 east, π/2 south): the way the stick last pushed, or the foe a
   * touch player's blade turned to. `dir` is the nearest of the four ways and what everything else goes by;
   * this is what a swing sweeps across (`aimOf`), so a hero walking on the diagonal strikes along it.
   */
  aim?: number
  /**
   * `a`: the angle the sweep is centred on. `n`: the hit of the chain (0, 1, 2: `COMBO`); `side`: which way it
   * sweeps (1 the first way, -1 back).
   */
  swing: null | {
    t: number; dir: Dir; a?: number; hit: string[]; n: 0 | 1 | 2; side?: 1 | -1; landed?: boolean
    /**
     * The HOP CUT (`engine/moves.ts`): tiles it springs back in before it cuts (its clock starts below 0 by the time
     * the spring takes), whether it was counted, and whether it is critical (a foe's blow passed under the hop).
     */
    spring?: number; sprung?: boolean; crit?: boolean
  }
  spin: null | { t: number; hit: string[]; landed?: boolean }
  /** Seconds the sword button has been held since the last swing (charge). */
  charge: number
  cooldown: number
  /** Seconds left of A's rest after a dialog (see TALK_REST). */
  talkRest: number
  carry: null | 'pot' | 'rock'
  push: number
  /** Where a pit fall returns the hero. */
  safe: Vec
  /** Walking out of a door after spawning on a `Spot.out` entry: input is ignored until it ends at (x, y). */
  auto?: null | { dir: Dir; t: number; x: number; y: number; intro?: boolean }
  /** Seconds a press of A, or of the roll, still waits to be acted on (BUFFER_A). */
  bufA?: number
  bufRoll?: number
  /** The chain's last hit, and how long a press may still follow it (COMBO_WINDOW). */
  combo?: { n: 0 | 1 | 2; t: number }
  /** The dodge roll under way: seconds in, and its velocity (tiles/s, at the start). */
  roll?: null | { t: number; vx: number; vy: number }
  rollCool?: number
  /**
   * In the air (`engine/moves.ts`): seconds in, the kind, the way along the ground (tiles/s at the start), the angle
   * a blow goes along (`a`), what it has struck (`hit`), the height it began at (`z0`), for a comet launched from a
   * flip what it came out of, and whether A was pressed in it (`queued`: the strike comes on landing).
   */
  air?: null | { t: number; kind: AirKind; vx: number; vy: number; a: number; hit: string[]; z0: number; from?: AirKind; landed?: boolean; turn?: number; queued?: boolean; dodged?: boolean }
  /** After a back flip or a wall spring lands: a press of A this soon is still the comet. */
  cometT?: number
  /** After a hop lands: a press of A this soon is the HOP CUT; `hopDodged`: a foe's blow passed under the hop. */
  hopT?: number
  hopDodged?: boolean
  /** Seconds each art still rests before it is ready (absent: ready). Never saved. */
  artCool?: Partial<Record<ArtId, number>>
  /** Seconds before another SLIP can slow the world. */
  slipCool?: number
  /** A roll or flip already slipped a blow (one SLIP each). */
  slipped?: boolean
  /** The next blow is critical (a SLIP's gift), until it lands or the slow ends. */
  edge?: boolean
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
  /** The arts learned, in the order learned (`ArtId`; absent: none). */
  arts?: ArtId[]
  /** Each combo's count towards mastery (`MOVES`; absent: none yet). */
  moves?: Partial<Record<MoveId, number>>
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
  after: null | { panel?: { id: string; panel: PanelId }; give?: ItemId; set?: string[]; clear?: string[]; sourceId?: string; price?: number; exit?: { id: string; to: ExitTarget }; startOver?: true }
  /** Exit dialogs: the answer picked on the last line, 0 = YES (go), 1 = NO (stay). */
  choice?: 0 | 1
  /** A talk's own two-way choice on the last line (the labels replace YES / NO; the pick opens its reply). */
  ask?: TalkAsk
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
  /** Logged in on auth.phareim.no right now (the shell tells the engine). Not progress: never saved. */
  session: boolean
  /**
   * Which view blocks are solid: the side of the view on screen. The shell says it, at the moment a turn is committed
   * (`setViewRule`, `engine/map.ts`); a game opens in the isometric view. Tests set it by hand. Never saved.
   */
  view: ViewSide
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
  warp: null | { t: number; to: string; entry: string; swapped: boolean; exit?: { id: string; to: ExitTarget }; at?: Vec; drop?: boolean; edge?: boolean }
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
  /**
   * Seconds into the day (`engine/day.ts`, 0 … 720), or null while the sun is
   * stuck on the horizon (before the Sun Prism).
   */
  daytime: number | null
  /**
   * What the screen shows (the shell says, each frame): the classic view's
   * size in tiles, and whether the picture is turned (the 16-bit view, which
   * shows a diamond of the ground). The woods' foes walk in from past it.
   * Never saved.
   */
  sight?: {
    x: number
    y: number
    turned?: boolean
  }
  /** Where the hero has been, per map (`engine/explore.ts`): what the map (M) shows. */
  explored?: Record<string, string>
  /** The hero's last place as explore.ts noted it (map and 2-tile square); nothing is looked at again until it changes. */
  exploreAt?: string
  /** SLIP: seconds left of the world running slow (the hero at full pace). Never saved. */
  slow?: number
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
  /** The dodge roll (L, C, the roll pad): pressed this frame. */
  rollPress?: boolean
  /** Touch: a swing at rest turns to the nearest enemy first. */
  autoFace: boolean
  /** A tap this frame on the left (-1) or right (1) half of the screen; picks YES or NO. */
  tapSide?: -1 | 1
}

export const NO_INPUT: Input = { move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false }

export type GameEvent =
  /** A swing: its hit of the chain; `spring`: a HOP CUT springing back in from (x, y) along `a`, `d` tiles at most. */
  | { type: 'swing'; n: 0 | 1 | 2; spring?: { x: number; y: number; a: number; d: number } }
  | { type: 'spin' }
  | { type: 'roll' }
  | { type: 'charged' }
  /** `dx`, `dy`: the way the blow drove the foe (unit); `heavy`: the finisher or a spin; `crit`: a finisher on a reeling foe. */
  | { type: 'hit'; x: number; y: number; kind: EnemyKind; killed: boolean; dx?: number; dy?: number; heavy?: boolean; crit?: boolean }
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
  /** A gate opened; with `shut`, a trap gate came down. */
  | { type: 'gate'; x: number; y: number; shut?: boolean }
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
  | { type: 'gust'; x: number; y: number }
  | { type: 'join' }
  | { type: 'wait' } // Luna sat down at her fort
  | { type: 'bark'; x: number; y: number }
  /** A lumen tube turned (`engine/puzzles/tubes.ts`). */
  | { type: 'tube'; x: number; y: number }
  // The acrobatics and the arts (`engine/moves.ts`)
  | { type: 'air'; kind: AirKind }
  /** Down again: where, and whether the landing struck (the flip's chop). */
  | { type: 'touchdown'; kind: AirKind; x: number; y: number; heavy: boolean; a: number }
  /** A combo landed: its count towards mastery now, `first` the very first, `mastered` the one that masters it. */
  | { type: 'move'; id: MoveId; n: number; first: boolean; mastered: boolean }
  /** A blow passed through a dodge: the world slows. */
  | { type: 'slip'; x: number; y: number }

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
  /** Seconds into the day, once the prism is home (`GameState.daytime`). */
  day?: number
  /** Where the hero has been, per map (`engine/explore.ts`). */
  explored?: Record<string, string>
}
