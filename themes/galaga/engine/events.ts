/**
 * Space Voyagers: what the engine tells the look and the sound. Each tick
 * `world.events` holds what happened; the README says what x, y, kind and n
 * mean for each type. Types only.
 */
import type { BossId, ConvoyId, CueId, PickupId, RescueId } from '../story/cues.ts'
import type { Aim, Bolt, BossKind, FriendId, WeaponId, ZoneKind } from './types.ts'

type E<T extends string, K = string> = {
  readonly type: T
  readonly x: number
  readonly y: number
  readonly kind: K
  readonly n: number
  readonly alt: string
}

export type CardKind = 'sector' | 'bonus' | 'perfect' | 'boss' | 'clear' | 'ending' | 'voyage' | 'gameover'

/** What happened this tick. The README says what x, y, kind and n mean for each. */
export type GameEvent =
  | E<'cue', CueId>
  | E<'card', CardKind>
  | E<'wave'>
  | E<'shot', WeaponId | 'wing'>
  | E<'bolt', Bolt['kind']>
  | E<'aim', Aim['kind']>
  | E<'zone', ZoneKind>
  | E<'zoneLive', ZoneKind>
  | E<'hit', 'enemy' | 'boss' | 'armor' | 'door'>
  | E<'pop'>
  | E<'split'>
  | E<'peel'>
  | E<'drop', PickupId>
  | E<'pick', PickupId>
  | E<'power', PickupId>
  | E<'powerOff', PickupId>
  | E<'valve'>
  | E<'mend'>
  | E<'bubble'>
  | E<'tow'>
  | E<'towed'>
  | E<'gameover'>
  | E<'partnerHit'>
  | E<'limp'>
  | E<'back'>
  | E<'beam'>
  | E<'beamOn'>
  | E<'capture'>
  | E<'freed'>
  | E<'docked'>
  | E<'undocked'>
  | E<'loose'>
  | E<'duetReady'>
  | E<'duetOn'>
  | E<'duetOff'>
  | E<'cancel'>
  | E<'chain'>
  | E<'freeze'>
  | E<'bossIn', BossKind>
  | E<'bossAttack'>
  | E<'bossPhase', BossKind>
  | E<'bossDown', BossKind>
  | E<'door'>
  | E<'convoyIn', ConvoyId>
  | E<'latch', 'rig' | 'stranded'>
  | E<'cargo'>
  | E<'convoySafe', ConvoyId>
  | E<'convoyLost', ConvoyId>
  | E<'rescueIn', RescueId>
  | E<'cables', RescueId>
  | E<'rescued', RescueId>
  | E<'rescueLost', RescueId>
  | E<'friend', FriendId>
  | E<'pass', FriendId>
  | E<'duoIn'>
  | E<'duoOut'>
  | E<'rig'>
  | E<'sectorClear'>
  | E<'ending'>
  | E<'voyage'>

export type EventType = GameEvent['type']

/** The pooled record behind every event. */
export interface EventRecord {
  type: string
  x: number
  y: number
  kind: string
  n: number
  alt: string
}
