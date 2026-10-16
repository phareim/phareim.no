/**
 * Space Voyagers II: what the comms make of a tick. The engine's events are
 * read once a tick and turned into cues for the director: a kill becomes
 * the partner's "GOOD." or the back seat's brag depending on who fired from
 * which seat, a shield gone becomes a complaint, the autopilot lighting up a
 * line. Pure; it keeps a little memory of its own (`Glue`).
 */
import { autoGoal, calzone } from '../engine/world.ts'
import type { Voyage } from '../engine/world.ts'
import { CUES } from './cues.ts'
import type { CueId } from './cues.ts'

export interface Glue {
  shieldsWereUp: boolean
  hurtSaid: boolean
  autoWas: boolean
  fought: boolean
  nextBanter: number
}

export function createGlue(): Glue {
  return { shieldsWereUp: true, hurtSaid: false, autoWas: false, fought: false, nextBanter: 600 }
}

const has = (id: string): id is CueId => Object.prototype.hasOwnProperty.call(CUES, id)

export function cuesFor(g: Glue, w: Voyage): CueId[] {
  const out: CueId[] = []
  const me = calzone(w)
  const playerSeat = w.seat
  for (const e of w.events) {
    switch (e.type) {
      case 'cue':
        if (e.cue && has(e.cue)) out.push(e.cue)
        if (e.cue === 'arrive') g.fought = true
        break
      case 'spawn':
        if (e.kind && has('spawn-' + e.kind)) out.push(('spawn-' + e.kind) as CueId)
        break
      case 'kill': {
        const victimTheirs = e.kind !== undefined && w.ships.some(s => s.id === e.a && s.side === 'them')
        if (!victimTheirs) break
        if (me && e.b === me.id) {
          if (e.seat === 'back') out.push(playerSeat === 'back' ? 'playerTurretKill' : 'turretKill')
          else out.push('kill')
        } else if (w.ships.some(s => s.id === e.b && s.side === 'us' && s.pilot === 'dougie')) out.push('wingKill')
        break
      }
      case 'missileIn':
        if (me && e.a === me.id) out.push('missileIn')
        break
      case 'locked':
        if (me && e.a === me.id && playerSeat === 'front') out.push('locked')
        break
      case 'armourHit': {
        const s = w.ships.find(x => x.id === e.a)
        if (s && s.side === 'us' && s.pilot === 'dougie') out.push('wingHit')
        break
      }
      case 'swap':
        out.push('swap')
        break
    }
  }
  if (me) {
    const down = me.shieldF <= 0 || me.shieldB <= 0
    if (down && g.shieldsWereUp) out.push('shieldsDown')
    g.shieldsWereUp = !down
    const coreFrac = me.core / 100
    if (coreFrac < 0.5 && !g.hurtSaid) { out.push('hurting'); g.hurtSaid = true }
  }
  // The autopilot lights after a fight.
  const auto = autoGoal(w) === 'nav'
  if (auto && !g.autoWas && g.fought) { out.push('navClear'); out.push('autoTeach') }
  g.autoWas = auto
  // Now and then: the enemy sings in a fight, the two talk when it is quiet.
  if (w.tick >= g.nextBanter) {
    g.nextBanter = w.tick + 60 * 9
    const enemies = w.ships.some(s => s.side === 'them' && s.dead === 0 && !s.gone)
    if (w.mission.stage === 'fly') out.push(enemies ? 'jingle' : 'chatter')
    else if (w.mission.stage === 'auto') out.push('chatter')
  }
  return out
}
