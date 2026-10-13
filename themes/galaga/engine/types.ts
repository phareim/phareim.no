/**
 * Space Voyagers: the shape of the world. Types only; nothing here runs.
 * Every list of things in the field is a fixed pool: iterate it and skip the
 * entries whose `active` is false. `kind` on a thing is its bitmap's name.
 */
import type { BossId, ConvoyId, Faction, PickupId, RescueId } from '../story/cues.ts'

export type Role = 'grunt' | 'flanker' | 'tank' | 'diver' | 'sniper' | 'splitter' | 'mite' | 'captor' | 'raider'
export type WeaponId = 'blaster' | 'disc' | 'boombox'
export type BossKind = BossId | 'deafstar'
export type FriendId = ConvoyId | RescueId

/** What a player gives each tick. With `hasTarget` the ship flies to (tx, ty); without, along (dx, dy). */
export interface Input {
  /** Direction, each -1..1 (keys). */
  dx: number
  dy: number
  /** A point to fly to (touch, the autopilot). */
  hasTarget: boolean
  tx: number
  ty: number
  /** Fire held. */
  fire: boolean
  /** DUET pressed. */
  duet: boolean
}

export interface Player {
  kind: string
  x: number
  y: number
  /** Valves left, 0 to 5. */
  hull: number
  /** Ticks of blinking safety left. */
  invuln: number
  weapon: WeaponId
  level: number
  fireT: number
  volleys: number
  /** Hits the soap bubble still takes. */
  bubble: number
  /** Ticks left of the magnet and of double score. */
  magnet: number
  quarter: number
  /** Tows left this run. */
  tows: number
  /** Ticks left of the tow under way (no control, no harm). */
  towing: number
  /** Ticks since the last pizza. */
  sincePizza: number
}

export type PartnerState = 'fly' | 'limp' | 'beamed' | 'hanging' | 'docking' | 'docked'

export interface Partner {
  kind: string
  x: number
  y: number
  state: PartnerState
  /** Ticks in the state. */
  t: number
  /** Hits taken since it last limped off; three and it goes. */
  hits: number
  invuln: number
  fireT: number
  volleys: number
  /** Which side of the player it flies on: -1 or 1. */
  side: number
  /** Ticks of dock left. */
  dock: number
  /** Pool index of the captor holding it, or -1. */
  captor: number
}

export type EnemyState = 'wait' | 'enter' | 'form' | 'aim' | 'dive' | 'return' | 'free' | 'hover' | 'seek' | 'latch' | 'through'

export interface Enemy {
  active: boolean
  /** A serial number, so a shot can remember what it has hit. */
  id: number
  role: Role
  gang: Faction
  kind: string
  x: number
  y: number
  /** Where it was a tick ago: (x - px, y - py) is its velocity. */
  px: number
  py: number
  hp: number
  maxHp: number
  /** Half the hit box. */
  hw: number
  hh: number
  score: number
  state: EnemyState
  /** Time in the state, in enemy ticks (TRACKING slows them). */
  t: number
  dur: number
  /** A captor on its way to the partner: nothing hurts it until its beam begins to warm. */
  shield: boolean
  /** Its place in the formation, or -1. */
  col: number
  row: number
  /** The curve it is flying: a cubic from (ax, ay) by (bx, by) and (cx, cy) to (ex, ey). */
  ax: number
  ay: number
  bx: number
  by: number
  cx: number
  cy: number
  ex: number
  ey: number
  /** A straight velocity, for the states that have one. */
  vx: number
  vy: number
  fireT: number
  /** Ticks since it was last hit and lived (the renderer's flash). */
  flash: number
  /** Ticks left standing still in the hairspray. */
  frozen: number
  /** A captor holding the partner. */
  carrying: boolean
  /** A bonus-run target: harmless, counted. */
  bonus: boolean
  /** Times it has left the bottom and come back. */
  wraps: number
  /** What its dive ends in: 0 off the bottom and back round, 1 a hover. For a raider, the rig it is after. */
  mode: number
  /** The thing a raider is on: an offset from its target. */
  ox: number
  oy: number
}

/** A shot of ours. */
export interface Shot {
  active: boolean
  kind: 'bolt' | 'disc' | 'bass' | 'wing'
  /** 0 the player, 1 the partner, 2 the rescued friend. */
  owner: number
  x: number
  y: number
  vx: number
  vy: number
  dmg: number
  /** Further targets it may pass through. */
  pierce: number
  /** Half its width and half its height. */
  hw: number
  hh: number
  /** Width gained per tick (a bass arc opens as it goes). */
  grow: number
  life: number
  /** Enemy serials it has already hit. */
  seen: number[]
  seenN: number
}

/** A shot of theirs. */
export interface Bolt {
  active: boolean
  kind: 'bolt' | 'aimed' | 'mine' | 'note' | 'ring'
  x: number
  y: number
  vx: number
  vy: number
  r: number
  /** Ticks left; a mine sits when `stopAt` is reached. */
  life: number
  stopAt: number
  frozen: number
}

/** A line shown before an aimed shot goes along it. */
export interface Aim {
  active: boolean
  kind: 'sniper' | 'diver' | 'boss'
  /** Origin and a point on the line. */
  x: number
  y: number
  tx: number
  ty: number
  /** Ticks until it fires. */
  warn: number
  speed: number
  /** Enemy pool index that owns it (the origin follows it), or -1. */
  owner: number
  ownerId: number
  /** Shots still to go along the line after the first. */
  burst: number
}

export type ZoneKind = 'ray' | 'tile' | 'key' | 'ram' | 'wall' | 'note' | 'squeeze' | 'beam'

/** A patch of the field that hurts while it is live. It is shown for `warn` ticks first. */
export interface Zone {
  active: boolean
  kind: ZoneKind
  /** Top-left and size. */
  x: number
  y: number
  w: number
  h: number
  /** Velocity while live. */
  vx: number
  vy: number
  warn: number
  live: number
}

/** CAL's doors: a row across the field that stops shots, except in the gap. */
export interface Barrier {
  active: boolean
  y: number
  hh: number
  gapX: number
  gapW: number
  /** 0 open, 1 shut to the gap. */
  shut: number
  /** 1 closing, -1 opening, 0 still. */
  dir: number
  /** Gap drift. */
  vx: number
}

export interface Pickup {
  active: boolean
  id: PickupId
  kind: string
  x: number
  y: number
  age: number
}

export type RigJob = 'convoy' | 'cb' | 'pass'

/** A trucker's rig: cover on a convoy, a bulldozer when called. */
export interface Rig {
  active: boolean
  kind: string
  job: RigJob
  x: number
  y: number
  hw: number
  hh: number
  vy: number
  /** A convoy rig that has lost its trailer. */
  unhooked: boolean
  /** A pass that has already struck the boss. */
  struck: boolean
}

export type WingState = 'off' | 'drift' | 'stalled' | 'flying' | 'lost' | 'pass'

/** The stranded ship, and after the jump start the third ship. */
export interface Wing {
  state: WingState
  id: RescueId
  kind: string
  x: number
  y: number
  /** The jumper cables, 0 to 1. */
  bar: number
  fireT: number
  t: number
}

export interface Convoy {
  active: boolean
  id: ConvoyId
  /** Cargo left, 0 to 1. */
  cargo: number
  t: number
  done: boolean
}

export interface Duo {
  active: boolean
  kind: string
  x: number
  y: number
  /** Enemies he still means to pop, and how many he has passed under. */
  quota: number
  passed: number
  seen: boolean
}

export interface Boss {
  active: boolean
  id: BossKind
  kind: string
  x: number
  y: number
  /** Half the body. */
  hw: number
  hh: number
  /** The body is half a disc hanging from its top edge (the Deaf Star), not a box. */
  round: boolean
  /** The part that takes damage: an offset and half its size. */
  wx: number
  wy: number
  whw: number
  whh: number
  /** Where its shots leave from, an offset. */
  mx: number
  my: number
  hp: number
  maxHp: number
  /** 1, 2, 3. */
  phase: number
  state: 'enter' | 'fight' | 'ram' | 'dying'
  t: number
  homeY: number
  /** The attack under way, or ''. */
  attack: string
  attackT: number
  /** Steps left of it, and ticks to the next step. */
  steps: number
  stepT: number
  /** Ticks until the next attack is chosen. */
  rest: number
  rot: number
  flash: number
  /** Ticks since it was last hit (the Excess Machine cools). */
  sinceHit: number
  /** Damage it can still take in full this second (BOSS_SOAK). */
  soak: number
  /** Tests and the lab: only this attack is used when set. */
  force: string
  /** Scratch for an attack. */
  a: number
  b: number
}

export interface Formation {
  cols: number
  rows: number
  /** Sideways offset of the whole block right now. */
  off: number
  /** How far apart the columns stand right now (it breathes). */
  dx: number
  dy: number
  top: number
  t: number
}

export interface Cloud {
  active: boolean
  x: number
  y: number
  r: number
  t: number
}

/** A friend's run through the last fight. */
export interface Pass {
  active: boolean
  id: FriendId
  kind: string
  x: number
  y: number
  vx: number
  t: number
  /** She was flying along as the third ship and left it for this pass: she goes back to it after. */
  wing: boolean
}

export type * from './events.ts'
export type * from './state.ts'
