/**
 * Space Voyagers II: the shape of the world. Types only; nothing here runs.
 * DESIGN.md one folder up says what the game is; `balance.ts` holds every
 * number. Lists of things in space are plain arrays: a thing that is gone is
 * swapped out of its list the tick it goes.
 */
import type { V3, Q4 } from './math.ts'
import type { Rng } from './rng.ts'

export type Side = 'us' | 'them'
export type PilotId = 'rex' | 'nova'
/** Which seat of the Calzone the player sits in. */
export type Seat = 'front' | 'back'

/** Every kind of ship in the game. The renderer has a model of each. */
export type ShipKind =
  // ours
  | 'calzone' // Rex and Nova's two-seater
  | 'rig' // Big Marge's armed rig, a wingman
  | 'tug' // Ellen Ridley's tug, a wingman
  | 'pigeon' // Hans Duo's Century Pigeon
  | 'moped' // Dougie's light fighter
  | 'deepdish' // the carrier: Slop's Orbital
  | 'hauler' // a freighter to escort
  // theirs: the Franchise
  | 'rat' // light fighter
  | 'bear' // medium fighter
  | 'gorilla' // heavy fighter, rear turret
  | 'hound' // torpedo bomber
  | 'parmesan' // the prince's own fighter
  | 'buffet' // the Franchise's carrier
  | 'outlet' // a corvette: turrets and a shield generator

/** What a pilot asks for this tick: the same for the player, the back seat, an AI. */
export interface Controls {
  /** Turn commands, each -1..1: nose up, nose left, roll left. */
  pitch: number
  yaw: number
  roll: number
  /** Hold to afterburn, hold to brake (both: burn wins). */
  burn: boolean
  brake: boolean
  /** Guns held. */
  fire: boolean
  /** Missile pressed this tick. */
  missile: boolean
}

/** What the person gives each tick, whichever seat they are in. */
export interface Input extends Controls {
  /** Pressed this tick: cycle target, target nearest attacker. */
  nextTarget: boolean
  attacker: boolean
  /** Pressed this tick: change seats. */
  swap: boolean
  /** Pressed this tick: autopilot to the next nav point (when it is lit). */
  auto: boolean
  /** A comms order to the wing this tick, or null. */
  order: WingOrder | null
  /** A target picked by touch on the view (a ship id), or null. */
  pick: number | null
  /** Touch: aim help is wider. */
  touch: boolean
}

export type WingOrder = 'attack' | 'form' | 'help' | 'taunt'

/** One armour value a side, as the damage display draws them. */
export interface Armour { f: number; b: number; l: number; r: number }

export type AiMode =
  | 'idle' // drift (a parked ship, a target in the lab)
  | 'attack' // pursue and shoot the target
  | 'break' // turn away after a pass, then come round again
  | 'evade' // jink: something is on its tail
  | 'flee' // armour gone: run for it
  | 'form' // fly on a leader
  | 'escort' // stay with a ship and go for whatever comes near it
  | 'strike' // a bomber's run on a big ship
  | 'nav' // fly to a point
  | 'turret' // the Calzone's pilot while the player is on the turret: keep the enemy behind

export interface Ai {
  mode: AiMode
  /** Ticks in the mode. */
  t: number
  /** Ticks until the brain looks again; between looks it holds its last controls. */
  think: number
  /** A point it is turning for (break, evade, nav). */
  aim: V3
  /** Its aim error now, added to the lead direction (picked again at each look). */
  err: V3
  /** The ship it formates on or escorts, by id. */
  leader: number
  /** Formation slot offset in the leader's frame. */
  slot: V3
  /** How good it is, 0..1: reaction, aim, nerve. */
  skill: number
  /** How keen to fight, 0..1. */
  nerve: number
  /** What it was told by the player (wingmen). */
  order: WingOrder | null
  /** The last controls it gave, held between looks. */
  out: Controls
}

export interface Turret {
  /** Mount in the ship's own frame. */
  at: V3
  /** The direction it covers (ship frame) and the half-angle of its cone. */
  dir: V3
  cone: number
  /** Where it points now (ship frame, unit). */
  aim: V3
  cool: number
  /** Turret's own target, by ship id, or -1. */
  target: number
  hp: number
}

export interface Ship {
  id: number
  kind: ShipKind
  side: Side
  /** Shown on the target display and said on the radio. */
  name: string
  /** Who flies it (a speaker id for the radio), or ''. */
  pilot: string
  pos: V3
  vel: V3
  q: Q4
  /** Body turn rates now (rad/s): pitch, yaw, roll. They chase the commands. */
  rate: V3
  speed: number
  /** The speed it cruises at. */
  cruise: number
  /** Afterburner fuel 0..1. */
  fuel: number
  burning: boolean
  shieldF: number
  shieldB: number
  armour: Armour
  /** What is left when the armour on a side has gone: zero and the ship is lost. */
  core: number
  /** The gun capacitor, 0..1. */
  energy: number
  gunCool: number
  /** Which gun fires next (they alternate). */
  gunSide: number
  missiles: number
  missileCool: number
  /** Lock on the target, 0..1; 1 is locked. */
  lock: number
  decoys: number
  target: number
  /** Ticks since it was last hit (shields wait before they come back). */
  sinceHit: number
  /** The ship that hit it last, by id. */
  lastHitBy: number
  turrets: Turret[]
  ai: Ai | null
  /** Ticks since it went; ships linger a moment to explode. */
  dead: number
  /** Escaped (fled out of the fight, or jumped away). */
  gone: boolean
  /** Mission flags: must survive, must die, is the target of a strike. */
  role: '' | 'protect' | 'kill' | 'ace'
  /** Collision radius (metres). */
  r: number
  /** Kills scored by this ship (wingmen and the Calzone's two seats). */
  kills: number
}

export type ShotKind = 'tube' | 'turret' | 'flak' | 'ion'

export interface Shot {
  kind: ShotKind
  side: Side
  /** Ship id that fired it, and for the Calzone which seat. */
  from: number
  seat: Seat | ''
  pos: V3
  /** Where it was last tick, for the swept hit test and the drawn streak. */
  prev: V3
  vel: V3
  dmg: number
  /** Seconds of flight left. */
  life: number
}

export type MissileKind = 'dart' | 'seeker' | 'torpedo'

export interface Missile {
  id: number
  kind: MissileKind
  side: Side
  from: number
  /** What it chases, by ship id (-1 for none), or a decoy (decoy index + 1e6). */
  target: number
  pos: V3
  vel: V3
  q: Q4
  life: number
  /** Seconds it flies blind before it starts to turn. */
  arm: number
  /** Points it takes from bolts before it pops (torpedoes can be shot down). */
  hp: number
}

export interface Decoy { pos: V3; vel: V3; life: number; side: Side }

/** A mark in space the mission is built from. */
export interface Nav {
  name: string
  pos: V3
  /** Who waits there: spawned when the Calzone arrives. */
  groups: SpawnGroup[]
  /** Reached: the encounter has been met. */
  met: boolean
}

export interface SpawnGroup {
  kind: ShipKind
  count: number
  /** Where they come from relative to the Calzone on arrival: ahead, behind, side, above. */
  from: 'ahead' | 'behind' | 'left' | 'right' | 'above' | 'below' | 'far'
  /** Metres out. */
  range: number
  /** What they go for: the Calzone, a protected ship, or a named ship. */
  goFor: 'player' | 'protect' | 'carrier' | 'wing'
  /** Seconds after arrival (a second wave). */
  delay: number
  /** Speaker id of their leader (an ace), or ''. */
  ace?: string
  skill?: number
}

export type EventType =
  | 'shot' | 'hit' | 'shieldHit' | 'armourHit' | 'kill' | 'eject' | 'explode'
  | 'missile' | 'missileIn' | 'lockOn' | 'locked' | 'decoy' | 'missileMiss'
  | 'burn' | 'swap' | 'autoReady' | 'auto' | 'arrive' | 'navClear' | 'spawn'
  | 'objective' | 'land' | 'lost' | 'cue' | 'order' | 'warn'

export interface GameEvent {
  type: EventType
  /** Ship ids it concerns, and a seat when the Calzone did it. */
  a?: number
  b?: number
  seat?: Seat
  kind?: string
  /** A cue for the radio (type 'cue'), with who said it. */
  cue?: string
  pos?: V3
  value?: number
}

export type MissionStage = 'launch' | 'fly' | 'auto' | 'land' | 'done'

export interface MissionState {
  id: string
  stage: MissionStage
  /** Ticks in the stage. */
  t: number
  navs: Nav[]
  /** The nav being flown to (index), and the one whose fight is on. */
  nav: number
  /** Ships still to come at the current nav: [tick, group] */
  pending: { at: number; group: SpawnGroup; nav: number }[]
  /** Won: every objective met; lost: a must-survive ship lost or the Calzone lost. */
  result: '' | 'won' | 'lost'
  /** Why it ended, for the debrief. */
  why: string
  kills: number
  /** Seconds the autopilot skipped (time and space between navs). */
  skipped: number
}

export interface World {
  tick: number
  rng: Rng
  /** Its own chance for the radio, so talk does not change the fight. */
  talkRng: Rng
  ships: Ship[]
  shots: Shot[]
  missiles: Missile[]
  decoys: Decoy[]
  events: GameEvent[]
  nextId: number
  /** The Calzone's id, and the carrier's (-1 when there is none). */
  player: number
  carrier: number
  seat: Seat
  /** Who is in which seat. */
  front: PilotId
  back: PilotId
  mission: MissionState
  score: number
  /** The Calzone was lost: the seats ejected. */
  ejected: boolean
}
