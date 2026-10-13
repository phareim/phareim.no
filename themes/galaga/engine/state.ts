/**
 * Space Voyagers: the world itself, the one object `step()` advances. Types only.
 */
import type { Faction, PilotId } from '../story/cues.ts'
import type { EventRecord, GameEvent } from './events.ts'
import type { Rng } from './rng.ts'
import type {
  Aim, Barrier, Bolt, Boss, Cloud, Convoy, Duo, Enemy, Formation, FriendId, Partner, Pass, Pickup, Player, Rig, Shot, Wing, Zone,
} from './types.ts'

/** `idle` is the lab's and the tests': a field in which nothing is scheduled. */
export type Stage = 'card' | 'wave' | 'bonus' | 'boss' | 'clear' | 'ending' | 'over' | 'idle'

export interface World {
  seed: number
  /** Ticks stepped; a tick is 1/60 s. */
  tick: number
  /** The field: 240 by 320..432, y downward. */
  w: number
  h: number
  pilot: PilotId
  partnerPilot: PilotId
  voyage: number
  /** 1 to 5. */
  sector: number
  gang: Faction
  stage: Stage
  /** Ticks in the stage. */
  stageT: number
  /** The wave within the sector, 1 to 4 (0 before the first). */
  wave: number
  /** Ticks until the next wave or stage begins, when counting. */
  pause: number
  rng: Rng
  /** The radio's own stream, so what has been heard cannot change the game. */
  talkRng: Rng
  over: boolean

  score: number
  /** Kills in a row, its multiplier and the ticks left to keep it. */
  chain: number
  chainMul: number
  chainT: number
  /** DUET: the needle 0 to 1, and ticks left while it plays. */
  duetMeter: number
  duet: number
  /** Ticks left of TRACKING. */
  slow: number
  /** Kills since something last dropped, kills and drops this run. */
  sinceDrop: number
  kills: number
  drops: number

  player: Player
  partner: Partner
  wing: Wing
  convoy: Convoy
  duo: Duo
  boss: Boss
  formation: Formation
  cloud: Cloud
  pass: Pass
  /** Friends made this voyage, in the order they were made, and who has still to make a pass. */
  friends: FriendId[]
  passQueue: FriendId[]
  /** Passes owed by the phase changes so far. */
  passDue: number
  noCavalrySaid: boolean
  /** The last fight: the tick by which the radio will have said the story lines asked for so far (TALK.air). */
  air: number
  /** Which of the sector's bosses is up. */
  bossIdx: number

  enemies: Enemy[]
  shots: Shot[]
  bolts: Bolt[]
  aims: Aim[]
  zones: Zone[]
  barriers: Barrier[]
  pickups: Pickup[]
  rigs: Rig[]

  /** The wave under way: how many it began with, how many are left, how many are still flying in. */
  waveSize: number
  waveLeft: number
  toEnter: number
  /** Counted once a tick: in formation, diving, enemy shots in the air, raiders latched on. */
  inForm: number
  diving: number
  boltsOut: number
  latched: number
  diveT: number
  fireT: number
  raidT: number
  idleT: number
  chatT: number
  /** The bonus run: targets sent and hit. */
  bonusTotal: number
  bonusHits: number
  nextId: number
  /** Whether the sector's event has been started, and Duo's visit made. */
  eventStarted: boolean
  duoDone: boolean

  /** This tick's events. `events.length` is how many; the array is reused. */
  events: GameEvent[]
  eventPool: EventRecord[]

  /** Counters for tests and the report; the game does not read them. */
  stats: Stats
}

export interface Stats {
  hits: number
  kills: number
  shotsFired: number
  boltsFired: number
  picks: number
  tows: number
  captures: number
  docks: number
  duets: number
  bossesDown: number
  sectorsCleared: number
}
