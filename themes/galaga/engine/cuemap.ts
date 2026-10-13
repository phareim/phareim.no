/**
 * Which cue the engine asks for when. Written out in full, one literal per
 * cue, so `tests/galaga-script.test.mjs` can check that every cue in
 * `story/cues.ts` is asked for somewhere, and the compiler that none is
 * misspelt. The page asks for five itself: briefing, retry, best, gameover
 * and ending.
 */
import type { ConvoyId, CueId, Faction, PickupId, PilotId, RescueId } from '../story/cues.ts'
import type { BossKind, FriendId, Role } from './types.ts'

export const SECTOR_CUE: readonly CueId[] = ['sector.1', 'sector.2', 'sector.3', 'sector.4', 'sector.5']

export const SEE_GANG: Record<Faction, CueId> = {
  glitterati: 'see.glitterati', hogs: 'see.hogs', lovemachines: 'see.lovemachines',
  chromons: 'see.chromons', noise: 'see.noise',
}

export const SEE_ROLE: Partial<Record<Role, CueId>> = {
  sniper: 'see.sniper', tank: 'see.tank', splitter: 'see.splitter', captor: 'see.captor',
}

/** The pilot the player flies was hit. */
export const HIT_CUE: Record<PilotId, CueId> = { rex: 'hit.rex', nova: 'hit.nova' }

/** Keyed by the pilot in the second ship. */
export const PARTNER_CUE: Record<PilotId, Record<'hit' | 'limp' | 'back' | 'captured' | 'hanging' | 'freed' | 'loose', CueId>> = {
  rex: {
    hit: 'partner.hit.rex', limp: 'partner.limp.rex', back: 'partner.back.rex', captured: 'partner.captured.rex',
    hanging: 'partner.hanging.rex', freed: 'partner.freed.rex', loose: 'partner.loose.rex',
  },
  nova: {
    hit: 'partner.hit.nova', limp: 'partner.limp.nova', back: 'partner.back.nova', captured: 'partner.captured.nova',
    hanging: 'partner.hanging.nova', freed: 'partner.freed.nova', loose: 'partner.loose.nova',
  },
}

export const PICK_CUE: Record<PickupId, CueId> = {
  tube: 'pick.tube', blaster: 'pick.blaster', disc: 'pick.disc', boombox: 'pick.boombox',
  pizza: 'pick.pizza', bubble: 'pick.bubble', cb: 'pick.cb', mirrorball: 'pick.mirrorball',
  tracking: 'pick.tracking', hairspray: 'pick.hairspray', magnet: 'pick.magnet', quarter: 'pick.quarter',
}

export const CONVOY_CUE: Record<ConvoyId, Record<'hail' | 'threat' | 'chat' | 'safe' | 'lost', CueId>> = {
  marge: {
    hail: 'convoy.marge.hail', threat: 'convoy.marge.threat', chat: 'convoy.marge.chat',
    safe: 'convoy.marge.safe', lost: 'convoy.marge.lost',
  },
  duckie: {
    hail: 'convoy.duckie.hail', threat: 'convoy.duckie.threat', chat: 'convoy.duckie.chat',
    safe: 'convoy.duckie.safe', lost: 'convoy.duckie.lost',
  },
}

export const RESCUE_CUE: Record<RescueId, Record<'hail' | 'cables' | 'saved' | 'lost' | 'chat', CueId>> = {
  babs: {
    hail: 'rescue.babs.hail', cables: 'rescue.babs.cables', saved: 'rescue.babs.saved',
    lost: 'rescue.babs.lost', chat: 'rescue.babs.chat',
  },
  ridley: {
    hail: 'rescue.ridley.hail', cables: 'rescue.ridley.cables', saved: 'rescue.ridley.saved',
    lost: 'rescue.ridley.lost', chat: 'rescue.ridley.chat',
  },
  lena: {
    hail: 'rescue.lena.hail', cables: 'rescue.lena.cables', saved: 'rescue.lena.saved',
    lost: 'rescue.lena.lost', chat: 'rescue.lena.chat',
  },
}

/** Hans Duo, by the sector he turns up in. */
export const DUO_CUE: Record<number, { arrive: CueId; leave: CueId }> = {
  2: { arrive: 'duo.arrive.2', leave: 'duo.leave.2' },
  4: { arrive: 'duo.arrive.4', leave: 'duo.leave.4' },
}

export const BOSS_CUE: Record<BossKind, { enter: CueId; half?: CueId; dead: CueId; taunt?: CueId }> = {
  knight: { enter: 'boss.knight.enter', half: 'boss.knight.half', dead: 'boss.knight.dead', taunt: 'boss.knight.taunt' },
  humdinger: { enter: 'boss.humdinger.enter', half: 'boss.humdinger.half', dead: 'boss.humdinger.dead', taunt: 'boss.humdinger.taunt' },
  durant: { enter: 'boss.durant.enter', half: 'boss.durant.half', dead: 'boss.durant.dead', taunt: 'boss.durant.taunt' },
  cal: { enter: 'boss.cal.enter', half: 'boss.cal.half', dead: 'boss.cal.dead', taunt: 'boss.cal.taunt' },
  fader: { enter: 'boss.fader.enter', half: 'boss.fader.half', dead: 'boss.fader.dead', taunt: 'boss.fader.taunt' },
  deafstar: { enter: 'boss.deafstar.enter', dead: 'boss.deafstar.dead', taunt: 'boss.deafstar.taunt' },
}

export const CAVALRY_CUE: Record<FriendId, CueId> = {
  marge: 'cavalry.marge', duckie: 'cavalry.duckie', babs: 'cavalry.babs', ridley: 'cavalry.ridley', lena: 'cavalry.lena',
}

/** The cues the page asks for itself; the engine never does. */
export const PAGE_CUES: readonly CueId[] = ['briefing', 'retry', 'best', 'gameover', 'ending']
