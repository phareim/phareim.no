/**
 * Space Voyagers' radio: who can speak, and every moment the game can ask for
 * words (a cue). The words themselves are in `lines.ts`; the director that
 * paces them is `director.ts`. Pure data, no DOM. DESIGN.md, "Who talks".
 */

export type PilotId = 'rex' | 'nova'

export type SpeakerId =
  | PilotId
  | 'mei' | 'babs'
  | 'marge' | 'duckie' | 'barton'
  | 'ridley' | 'lena'
  | 'duo'
  | 'knight' | 'humdinger' | 'durant' | 'cal' | 'fader'

export interface Speaker {
  /** The name plate under the portrait. */
  name: string
  /** The channel shown on the monitor. */
  channel: string
  /** The portraits this speaker has: `public/galaga/portrait-<id>-<mood>.png`. The first is the default. */
  moods: readonly string[]
  /** A boss cuts in on every band: the monitor tears while it talks. */
  cutsIn?: boolean
}

export const SPEAKERS: Record<SpeakerId, Speaker> = {
  rex: { name: 'REX', channel: 'SHIP', moods: ['cheerful', 'eating', 'worried', 'sheepish'] },
  nova: { name: 'NOVA', channel: 'SHIP', moods: ['calm', 'smirk', 'angry', 'eyeroll'] },
  mei: { name: 'MEI', channel: 'RFS 88.9', moods: ['calm', 'excited'] },
  babs: { name: 'BABS ARELLA', channel: 'LOVE BAND 96.9', moods: ['purr', 'wink', 'alarm'] },
  marge: { name: 'BIG MARGE', channel: 'CB 19', moods: ['calm', 'spooky'] },
  duckie: { name: 'RUBBER DUCKIE', channel: 'CB 19', moods: ['calm', 'shout'] },
  barton: { name: 'JACK BARTON', channel: 'CB 19', moods: ['calm', 'shout'] },
  ridley: { name: 'ELLEN RIDLEY', channel: 'DISTRESS', moods: ['calm', 'grim'] },
  lena: { name: 'PRINCESS LENA', channel: 'DISTRESS', moods: ['calm', 'stern'] },
  duo: { name: 'HANS DUO', channel: 'OPEN', moods: ['grin', 'sweat'] },
  knight: { name: 'SATURDAY KNIGHT', channel: 'ALL BANDS', moods: ['calm', 'angry'], cutsIn: true },
  humdinger: { name: 'LORD HUMDINGER', channel: 'ALL BANDS', moods: ['calm', 'angry'], cutsIn: true },
  durant: { name: 'DR DURANT DURANT', channel: 'ALL BANDS', moods: ['calm', 'angry'], cutsIn: true },
  cal: { name: 'CAL 9000', channel: 'ALL BANDS', moods: ['calm', 'angry'], cutsIn: true },
  fader: { name: 'DARK FADER', channel: 'ALL BANDS', moods: ['calm', 'angry'], cutsIn: true },
}

/** One thing said. `text` is capitals, at most 84 characters, at most three rows of 28. */
export interface Line {
  who: SpeakerId
  /** One of the speaker's moods; left out, the default. */
  mood?: string
  text: string
}

/** Lines played one after another: a taunt and its answers. */
export type Exchange = readonly Line[]

export type Faction = 'glitterati' | 'hogs' | 'lovemachines' | 'chromons' | 'noise'
export type BossId = 'knight' | 'humdinger' | 'durant' | 'cal' | 'fader'
export type ConvoyId = 'marge' | 'duckie'
export type RescueId = 'babs' | 'ridley' | 'lena'
export type PickupId =
  | 'tube' | 'blaster' | 'disc' | 'boombox' | 'pizza' | 'bubble'
  | 'cb' | 'mirrorball' | 'tracking' | 'hairspray' | 'magnet' | 'quarter'

/** How often a cue may be answered. */
export type Once = 'session' | 'run' | 'sector'

export interface CueRule {
  /** 3 story (interrupts), 2 teaching and events, 1 banter (only after 9 s of silence). */
  priority: 1 | 2 | 3
  /** Answered once per page load, per run or per sector; left out, every time the cooldown allows. */
  once?: Once
  /** Game-clock seconds before the cue is answered again. */
  cooldown?: number
}

const story = (once: Once = 'run'): CueRule => ({ priority: 3, once })
const teach = (once: Once = 'session'): CueRule => ({ priority: 2, once })
const event = (once: Once = 'sector'): CueRule => ({ priority: 2, once })
const banter = (cooldown: number): CueRule => ({ priority: 1, cooldown })

/**
 * Every cue. A key ending in `.rex` or `.nova` names who it happened to: for
 * `partner.*` the pilot in the second ship, for `hit.*` the one the player flies.
 */
export const CUES = {
  // The run.
  'briefing': story('session'),
  'retry': story(),
  'sector.1': story('sector'), 'sector.2': story('sector'), 'sector.3': story('sector'),
  'sector.4': story('sector'), 'sector.5': story('sector'),
  'voyage2': story(),
  'ending': story(),
  'gameover': { priority: 3 },
  'best': { priority: 2, once: 'run' },

  // Between the shooting.
  'idle': banter(22),
  'waveClear': banter(18),
  'bonus.start': event(),
  'bonus.perfect': { priority: 2 },
  'bonus.miss': { priority: 1 },

  // First sight of a gang, and of the roles that need a word.
  'see.glitterati': event(), 'see.hogs': event(), 'see.lovemachines': event(),
  'see.chromons': event(), 'see.noise': event(),
  'see.sniper': teach(), 'see.tank': teach(), 'see.splitter': teach(),
  'see.captor': teach(),

  // The hull. `hit.rex`: Rex is flown by the player and was hit.
  'hit.rex': banter(14), 'hit.nova': banter(14),
  'lowHull': { priority: 2, cooldown: 30 },
  'tow.first': { priority: 3 },
  'tow.last': { priority: 3 },

  // The partner.
  'partner.hit.rex': banter(16), 'partner.hit.nova': banter(16),
  'partner.limp.rex': { priority: 2, cooldown: 20 }, 'partner.limp.nova': { priority: 2, cooldown: 20 },
  'partner.back.rex': { priority: 1, cooldown: 20 }, 'partner.back.nova': { priority: 1, cooldown: 20 },
  'partner.captured.rex': { priority: 3 }, 'partner.captured.nova': { priority: 3 },
  'partner.hanging.rex': banter(12), 'partner.hanging.nova': banter(12),
  'partner.freed.rex': { priority: 3 }, 'partner.freed.nova': { priority: 3 },
  /** Freed by a captor shot in formation: loose, but no dock. */
  'partner.loose.rex': { priority: 2 }, 'partner.loose.nova': { priority: 2 },

  // DUET.
  'duet.ready': { priority: 2, cooldown: 40 },
  'duet.teach': teach(),
  'duet.go': { priority: 3 },
  'duet.end': banter(10),

  // Power-ups, first time each.
  'pick.tube': teach(), 'pick.blaster': teach(), 'pick.disc': teach(), 'pick.boombox': teach(),
  'pick.pizza': teach(), 'pick.bubble': teach(), 'pick.cb': teach(), 'pick.mirrorball': teach(),
  'pick.tracking': teach(), 'pick.hairspray': teach(), 'pick.magnet': teach(), 'pick.quarter': teach(),
  /** Any pizza after the first: Rex rates it. */
  'pizza.again': banter(25),

  // Convoys. `duckie` is the convoy of three; Barton is in it.
  'convoy.marge.hail': event(), 'convoy.marge.threat': { priority: 2, cooldown: 15 },
  'convoy.marge.chat': banter(12), 'convoy.marge.safe': event(), 'convoy.marge.lost': event(),
  'convoy.duckie.hail': event(), 'convoy.duckie.threat': { priority: 2, cooldown: 15 },
  'convoy.duckie.chat': banter(12), 'convoy.duckie.safe': event(), 'convoy.duckie.lost': event(),

  // Rescues.
  'rescue.babs.hail': event(), 'rescue.babs.cables': event(), 'rescue.babs.saved': event(), 'rescue.babs.lost': event(),
  'rescue.babs.chat': banter(14),
  'rescue.ridley.hail': event(), 'rescue.ridley.cables': event(), 'rescue.ridley.saved': event(), 'rescue.ridley.lost': event(),
  'rescue.ridley.chat': banter(14),
  'rescue.lena.hail': event(), 'rescue.lena.cables': event(), 'rescue.lena.saved': event(), 'rescue.lena.lost': event(),
  'rescue.lena.chat': banter(14),

  // Hans Duo.
  'duo.arrive.2': event(), 'duo.leave.2': event(),
  'duo.arrive.4': event(), 'duo.leave.4': event(),

  // Bosses: walking on, half health, down.
  'boss.knight.enter': story('sector'), 'boss.knight.half': story('sector'), 'boss.knight.dead': story('sector'),
  'boss.humdinger.enter': story('sector'), 'boss.humdinger.half': story('sector'), 'boss.humdinger.dead': story('sector'),
  'boss.durant.enter': story('sector'), 'boss.durant.half': story('sector'), 'boss.durant.dead': story('sector'),
  'boss.cal.enter': story('sector'), 'boss.cal.half': story('sector'), 'boss.cal.dead': story('sector'),
  'boss.fader.enter': story('sector'), 'boss.fader.half': story('sector'), 'boss.fader.dead': story('sector'),
  /** The Deaf Star, after Dark Fader's own ship is down. */
  'boss.deafstar.enter': story('sector'), 'boss.deafstar.dead': story('sector'),
  /** During the fight, now and then. */
  'boss.knight.taunt': banter(16), 'boss.humdinger.taunt': banter(16), 'boss.durant.taunt': banter(16),
  'boss.cal.taunt': banter(16), 'boss.fader.taunt': banter(16),
  /** The Deaf Star only plays notes: Mei and the two pilots talk over it. */
  'boss.deafstar.taunt': banter(16),

  // The last fight: a friend's pass.
  'cavalry.marge': story('sector'), 'cavalry.duckie': story('sector'), 'cavalry.babs': story('sector'),
  'cavalry.ridley': story('sector'), 'cavalry.lena': story('sector'), 'cavalry.none': story('sector'),
} as const satisfies Record<string, CueRule>

export type CueId = keyof typeof CUES

/** What `lines.ts` holds: for each cue, the exchanges to choose between. */
export type Script = Record<CueId, readonly Exchange[]>

export const MAX_LINE = 84
export const ROW_CHARS = 28
export const MAX_ROWS = 3
