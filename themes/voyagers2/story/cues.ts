/**
 * Space Voyagers II: who can speak on the comms, and every moment the game
 * can ask for words (a cue). The words are in `lines.ts`; the director that
 * paces them is `director.ts` (Space Voyagers I's, with seats). Pure data.
 * DESIGN.md, "Who talks".
 */
import type { PilotId } from '../engine/types.ts'

export type { PilotId }

export type SpeakerId =
  | PilotId
  | 'mei' | 'nonna' | 'tiny' | 'babs'
  | 'dougie' | 'marge' | 'ridley' | 'duo'
  | 'parmesan' | 'mascot'

export interface Speaker {
  name: string
  channel: string
  /** Portraits: `public/<dir>/portrait-<id>-<mood>.png`. The first mood is the default. */
  moods: readonly string[]
  dir: 'galaga' | 'voyagers2'
  /** The enemy cuts in on the band: the screen tears while it talks. */
  cutsIn?: boolean
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  rex: { name: 'REX', channel: 'INTERCOM', moods: ['cheerful', 'eating', 'worried', 'sheepish'], dir: 'galaga' },
  nova: { name: 'NOVA', channel: 'INTERCOM', moods: ['calm', 'smirk', 'angry', 'eyeroll'], dir: 'galaga' },
  mei: { name: 'MEI', channel: 'DEEP DISH', moods: ['calm', 'excited'], dir: 'galaga' },
  nonna: { name: 'NONNA ROSA', channel: 'DEEP DISH', moods: ['calm', 'stern'], dir: 'voyagers2' },
  tiny: { name: 'TINY', channel: 'DEEP DISH', moods: ['calm', 'grin'], dir: 'voyagers2' },
  babs: { name: 'BABS ARELLA', channel: 'LOVE BAND 96.9', moods: ['purr', 'wink', 'alarm'], dir: 'galaga' },
  dougie: { name: 'DOUGIE', channel: 'CB 19', moods: ['eager', 'scared'], dir: 'voyagers2' },
  marge: { name: 'BIG MARGE', channel: 'CB 19', moods: ['calm', 'spooky'], dir: 'galaga' },
  ridley: { name: 'ELLEN RIDLEY', channel: 'CB 19', moods: ['calm', 'grim'], dir: 'galaga' },
  duo: { name: 'HANS DUO', channel: 'CB 19', moods: ['grin', 'sweat'], dir: 'galaga' },
  parmesan: { name: 'PRINCE PARMESAN', channel: 'ALL BANDS', moods: ['calm', 'angry'], dir: 'voyagers2', cutsIn: true },
  mascot: { name: 'FRANCHISE PILOT', channel: 'OPEN BAND', moods: ['rat', 'bear', 'gorilla', 'hound'], dir: 'voyagers2', cutsIn: true },
}

/** One thing said: capitals, at most 96 characters, three rows of 34. */
export interface Line {
  who: SpeakerId
  mood?: string
  text: string
}
export type Exchange = readonly Line[]

export type Once = 'session' | 'run' | 'mission'

/** Which seat says a cue's first line: the director picks a variant whose first speaker sits there. */
export type By = 'front' | 'back' | 'partner' | 'player'

export interface CueRule {
  /** 3 story (cuts in), 2 teaching and events, 1 banter (only into silence). */
  priority: 1 | 2 | 3
  once?: Once
  /** Game seconds before it is answered again. */
  cooldown?: number
  by?: By
}

const story = (once: Once = 'mission', by?: By): CueRule => ({ priority: 3, once, by })
const teach = (by?: By): CueRule => ({ priority: 2, once: 'session', by })
const event = (cooldown: number, by?: By): CueRule => ({ priority: 2, cooldown, by })
const banter = (cooldown: number, by?: By): CueRule => ({ priority: 1, cooldown, by })

export const CUES = {
  // The sortie's spine.
  launch: story('mission'),
  launched: story('mission', 'partner'),
  autopilot: event(20, 'partner'),
  arrive: event(8),
  home: story('mission'),
  landing: story('mission'),
  won: story('mission'),
  lost: story('mission'),
  eject: story('mission', 'partner'),
  carrierLost: story('mission'),
  convoyLost: event(10),
  // First sight of each kind.
  'spawn-rat': teach(),
  'spawn-bear': teach(),
  'spawn-gorilla': teach(),
  'spawn-hound': teach(),
  // The seats.
  swap: event(6, 'partner'),
  behind: event(14, 'back'),
  decoy: event(10, 'back'),
  missileIn: event(8, 'back'),
  locked: event(25, 'partner'),
  kill: event(12, 'partner'),
  turretKill: event(12, 'back'),
  playerTurretKill: event(15, 'front'),
  shieldsDown: event(25, 'partner'),
  hurting: event(30, 'partner'),
  navClear: teach('partner'),
  autoTeach: teach(),
  // Orders and their answers.
  'order-attack': event(4),
  'order-form': event(4),
  'order-help': event(4),
  'order-taunt': event(6, 'back'),
  taunted: event(6),
  // The wing and the enemy.
  'wingKill-dougie': event(15),
  'wingHit-dougie': event(15),
  'wingKill-marge': event(18),
  'wingHit-marge': event(18),
  'wingKill-ridley': event(18),
  'wingHit-ridley': event(18),
  'wingKill-duo': event(14),
  'wingHit-duo': event(18),
  convoyHit: event(12),
  // The story in flight.
  homeFight: story('mission'),
  ambush: story('mission'),
  defect: story('mission'),
  duoFlees: story('mission'),
  hansBack: story('mission'),
  'spawn-parmesan': story('run'),
  dareLeave: story('mission'),
  parmesanFlees: story('mission'),
  aceFlees: event(20),
  help: story('mission'),
  targetDown: story('mission'),
  'spawn-outlet': story('mission'),
  'spawn-buffet': story('mission'),
  'spawn-hut': story('mission'),
  'launch-fighters': event(30),
  torpLock: teach(),
  torpAway: event(10, 'partner'),
  scrape: event(10, 'partner'),
  enemyFlees: event(20),
  enemyGone: event(30),
  jingle: banter(40),
  chatter: banter(25, 'partner'),
} as const satisfies Record<string, CueRule>

export type CueId = keyof typeof CUES

export const MAX_ROWS = 3
export const ROW_CHARS = 34
