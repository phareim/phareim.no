/**
 * Field battles (Chrono Trigger–style, on maps with `MapDef.battle`): the
 * types. The rules are in `engine/battle/`, the tables in
 * `engine/battle/data.ts`, the overlay in `render/battle.ts`; the system is
 * described in docs/games/neon-shrine-battle.md. Re-exported by types.ts.
 */
import type { ItemId, TrackId, Vec } from './types'

/** A foe of the battle table (`engine/battle/data.ts` FOES), not an EnemyKind: each one borrows a kind's look. */
export type BattleFoeId = 'goo' | 'flitter' | 'hound' | 'zapper' | 'drone' | 'skull' | 'spitter' | 'knight'
/** Who can be in the party (`PARTY`). */
export type MemberId = 'hero' | 'luna'
/** Techs (`TECHS`); a combo tech needs every member it names, all with full gauges. */
export type TechId = 'sweep' | 'crack' | 'zap' | 'mend' | 'lull' | 'storm' | 'lance'
/** stun: the gauge stands still; static: hurts each second; slow: the gauge fills at half speed; break: hits land half again as hard (and a guard is gone). */
export type BattleStatus = 'stun' | 'static' | 'slow' | 'break'
export type BattleElement = 'blade' | 'psi' | 'static' | 'blast'
export type BattleItem = 'tonic' | 'bomb'

/** A group of foes standing on a battle map; touching one (or being seen by one) starts the fight. */
export interface BattleGroupDef {
  id: string
  /** Where the group stands (tile units); its foes stand in a loose cluster round it. */
  x: number
  y: number
  /** One to four foes. */
  foes: BattleFoeId[]
  /** Spots the hero this far off (tiles, with a clear line) and starts the fight with a head start; none: only on contact. */
  sight?: number
  /** Won for good (flag `battle:<id>`); otherwise the group stands again whenever the map is entered. */
  once?: boolean
  /** No running away (a guardian). */
  noFlee?: boolean
  /** Given (item-get) the first time the group is beaten (flag `battle:<id>:prize`). */
  prize?: ItemId
  track?: TrackId
}

/** `MapDef.battle`: this map fights its foe groups in place, turn by turn, instead of the action combat. */
export interface MapBattleDef {
  groups: BattleGroupDef[]
  /** The music of a fight here (default 'boss'). */
  track?: TrackId
}

/** One side's combatant in a fight. Party members stand for the hero and Luna; foes for the map's enemies. */
export interface Fighter {
  /** 'hero', 'luna', or the Enemy's id. */
  id: string
  side: 'party' | 'foe'
  member?: MemberId
  foe?: BattleFoeId
  /** The hero's are `GameState.hero.hp` (half-hearts), kept in step; Luna's and the foes' live here. */
  hp: number
  maxHp: number
  /** The time gauge, 0 … 1 (full: may act). */
  atb: number
  /** Tech points (party), 0 … TP_MAX. */
  tp: number
  /** Where it stands in the fight (tile units). */
  home: Vec
  /** Seconds left of each status. */
  status: Partial<Record<BattleStatus, number>>
  down: boolean
  /** Foes: turns taken (their move patterns go by it); a guard raised (knight). */
  turns: number
  guard?: boolean
  /** Hit flash and the lunge offset the renderer sees through the entity's own position. */
  flash: number
}

export interface BattleAction {
  who: string
  kind: 'strike' | 'tech' | 'item' | 'flee' | 'move'
  tech?: TechId
  item?: BattleItem
  /** A foe's move (index into its FoeDef.moves). */
  move?: number
  target: string | null
  t: number
  /** When the blow lands and when the action is over (s). */
  hitAt: number
  dur: number
  /** The blow has landed. */
  landed: boolean
  /** Where the actor lunges to (tile units), or null to act from where it stands. */
  to: Vec | null
}

/** A number or word rising from a combatant. `tone`: hit (on a foe), hurt (on the party), heal, info. */
export interface BattlePop { x: number; y: number; text: string; tone: 'hit' | 'hurt' | 'heal' | 'info'; t: number }

export interface BattleMenu {
  /** The party member choosing. */
  who: string
  level: 'top' | 'tech' | 'item' | 'target'
  /** Cursor in the current list (top, tech or item). */
  cursor: number
  /** The top-level cursor, kept while in a sub-list. */
  top: number
  /** What the target is being picked for. */
  pending: null | { kind: 'strike' | 'tech' | 'item'; tech?: TechId; item?: BattleItem; from: 'top' | 'tech' | 'item'; sub: number }
  /** The fighter the target cursor is on. */
  target: string | null
  /** A direction was held last step (the cursor moves once per press). */
  held: boolean
}

export interface BattleState {
  group: string
  phase: 'intro' | 'fight' | 'won' | 'fled' | 'lost'
  /** Seconds in this phase. */
  t: number
  /** Who struck first: the hero's blade on a foe ('party'), a foe that saw the hero ('foes'), or contact (null). */
  first: 'party' | 'foes' | null
  fighters: Fighter[]
  /** Fighters whose gauge is full, in the order they filled. */
  queue: string[]
  act: BattleAction | null
  menu: BattleMenu | null
  pops: BattlePop[]
  /** Where each combatant started the intro walk from (tile units). */
  from: Record<string, Vec>
  /** The camera's focus (tile units), eased toward the fight and back. */
  cam: Vec
  /** Where the camera eases from and to in this phase. */
  camFrom: Vec
  camTo: Vec
  /** Running-away attempts so far (each makes the next likelier). */
  tries: number
  /** Bits won so far. */
  bits: number
  /** The way the party faces the foes (unit vector): where they ran from. */
  axis: Vec
}

/** A touch on the battle overlay, as the renderer resolved it: a command in the open list, a fighter, or nothing. */
export type BattlePick = { cmd: number } | { target: string } | { none: true }
