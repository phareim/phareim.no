/**
 * Field battles: the tables. Party members, their techs (combo techs name
 * every member they need), the foes (each borrows an EnemyKind's look, so
 * it is drawn before it has art of its own) and the level curve. Adding a
 * companion: a row in PARTY, its techs in TECHS, and a way into
 * `partyOf` (fight.ts); the menu, the gauges and the combos follow.
 * Growth is items and hearts, not levels.
 */
import type { BattleElement, BattleFoeId, BattleStatus, EnemyKind, MemberId, TechId } from '../../types'

/** Tech points: each member holds up to this many; a blow that lands earns one. */
export const TP_MAX = 3
/** Tech points each member has when a fight starts. */
export const TP_START = 1

export interface MemberDef {
  name: string
  /** Seconds for an empty gauge to fill. */
  wait: number
  /** The basic attack: its menu word, its element and its strength. */
  strike: { name: string; elem: BattleElement; power: number }
  /** Battle hit points for a member who has none in the game (the hero's are his hearts). */
  hp?: number
  /** Its own techs, in menu order (combos are found through TECHS). */
  techs: TechId[]
}

export const PARTY: Record<MemberId, MemberDef> = {
  hero: { name: 'YOU', wait: 2.1, strike: { name: 'STRIKE', elem: 'blade', power: 12 }, techs: ['sweep', 'crack'] },
  luna: { name: 'LUNA', wait: 2.1, hp: 8, strike: { name: 'PSI', elem: 'psi', power: 6 }, techs: ['zap', 'mend', 'lull'] },
}

/**
 * - one: the target. near: the target and every foe within `reach` of it (a sweep through a cluster).
 * - line: every foe on the line from the user through the target (a lance through a row).
 * - all: every foe. ally: one party member (a heal).
 */
export type TechArea = 'one' | 'near' | 'line' | 'all' | 'ally'

export interface TechDef {
  name: string
  /** Members it needs; two or more is a combo (every one of them must have a full gauge, and each pays the cost). */
  who: MemberId[]
  area: TechArea
  /** Damage as a multiple of the user's strike (summed over the members for a combo); 0 for none. */
  power: number
  elem: BattleElement
  /** Tech points each member pays. */
  tp: number
  /** A status put on what it hits, for this many seconds. */
  status?: { kind: BattleStatus; s: number }
  /** Half-hearts healed (ally). */
  heal?: number
  reach?: number
}

export const TECHS: Record<TechId, TechDef> = {
  sweep: { name: 'SWEEP', who: ['hero'], area: 'near', reach: 1.6, power: 0.8, elem: 'blade', tp: 1 },
  crack: { name: 'CRACK', who: ['hero'], area: 'one', power: 0.9, elem: 'blade', tp: 1, status: { kind: 'break', s: 8 } },
  zap: { name: 'ZAP', who: ['luna'], area: 'one', power: 1.3, elem: 'static', tp: 1, status: { kind: 'static', s: 4 } },
  mend: { name: 'MEND', who: ['luna'], area: 'ally', power: 0, elem: 'psi', tp: 1, heal: 4 },
  lull: { name: 'LULL', who: ['luna'], area: 'all', power: 0, elem: 'psi', tp: 2, status: { kind: 'slow', s: 8 } },
  storm: { name: 'STORM', who: ['hero', 'luna'], area: 'all', power: 1.1, elem: 'static', tp: 1, status: { kind: 'static', s: 4 } },
  lance: { name: 'LANCE', who: ['hero', 'luna'], area: 'line', power: 1.6, elem: 'psi', tp: 1, status: { kind: 'break', s: 8 } },
}

/** The combos a member can call, in menu order, after its own techs. */
export function combosOf(m: MemberId): TechId[] {
  return (Object.keys(TECHS) as TechId[]).filter(t => TECHS[t].who.length > 1 && TECHS[t].who.includes(m))
}

/**
 * A foe's move. hit: one party member; all: every one; guard: raises a guard
 * (blades and psi do a quarter until it is broken); status: only the status.
 */
export interface FoeMove {
  name: string
  kind: 'hit' | 'all' | 'guard'
  /** Half-hearts. */
  power: number
  status?: { kind: BattleStatus; s: number; p: number }
  /** Lunges to its target (melee) instead of acting from where it stands. */
  lunge?: boolean
}

export interface FoeDef {
  name: string
  /** The enemy whose look it wears. */
  look: EnemyKind
  hp: number
  /** Seconds for an empty gauge to fill. */
  wait: number
  /** Its moves, used in turn: `pattern` indexes into `moves`, one turn after the other. */
  moves: FoeMove[]
  pattern: number[]
  weak?: BattleElement[]
  resist?: BattleElement[]
  /** Chance a blade misses it (it flits or hops away); slowed, it never does. */
  evade?: number
  /** A blade that strikes it while it is not stunned shocks the striker back (a zapper). */
  shocks?: boolean
  bits: number
}

export const FOES: Record<BattleFoeId, FoeDef> = {
  goo: {
    name: 'GOO', look: 'blob', hp: 18, wait: 5.6, bits: 2,
    moves: [{ name: 'BUMP', kind: 'hit', power: 1, lunge: true }, { name: 'OOZE', kind: 'hit', power: 0, status: { kind: 'slow', s: 5, p: 1 }, lunge: true }],
    pattern: [0, 0, 1], weak: ['static'],
  },
  flitter: {
    name: 'FLITTER', look: 'bat', hp: 12, wait: 4.2, bits: 2, evade: 0.35,
    moves: [{ name: 'NIP', kind: 'hit', power: 1, lunge: true }], pattern: [0], weak: ['psi'],
  },
  hound: {
    name: 'HOUND', look: 'hound', hp: 30, wait: 4.6, bits: 4,
    moves: [{ name: 'BITE', kind: 'hit', power: 1, lunge: true }, { name: 'HOWL', kind: 'all', power: 0, status: { kind: 'slow', s: 4, p: 0.7 } }, { name: 'LUNGE', kind: 'hit', power: 2, lunge: true }],
    pattern: [0, 1, 2], resist: ['static'],
  },
  zapper: {
    name: 'ZAPPER', look: 'zapper', hp: 26, wait: 5.4, bits: 4, shocks: true,
    moves: [{ name: 'SHOCK', kind: 'hit', power: 1, status: { kind: 'static', s: 3, p: 0.6 } }], pattern: [0],
    weak: ['blast', 'psi'], resist: ['static'],
  },
  drone: {
    name: 'DRONE', look: 'drone', hp: 22, wait: 5.2, bits: 4,
    moves: [{ name: 'SCAN', kind: 'hit', power: 1 }, { name: 'SWEEP BEAM', kind: 'all', power: 1 }], pattern: [0, 1], weak: ['static'],
  },
  skull: {
    name: 'SKULL', look: 'skull', hp: 28, wait: 5.2, bits: 5, evade: 0.3,
    moves: [{ name: 'GNAW', kind: 'hit', power: 2, lunge: true }, { name: 'RATTLE', kind: 'hit', power: 0, status: { kind: 'stun', s: 1.6, p: 0.8 } }],
    pattern: [0, 1, 0], weak: ['psi'],
  },
  spitter: {
    name: 'SPITTER', look: 'spitter', hp: 18, wait: 4.5, bits: 3,
    moves: [{ name: 'SPIT', kind: 'hit', power: 1 }], pattern: [0], weak: ['blade'],
  },
  knight: {
    name: 'CHROME KNIGHT', look: 'knight', hp: 80, wait: 4.6, bits: 30,
    moves: [{ name: 'SLASH', kind: 'hit', power: 2, lunge: true }, { name: 'SHIELD', kind: 'guard', power: 0 }, { name: 'CLEAVE', kind: 'all', power: 1, lunge: true }],
    pattern: [1, 0, 2, 0], resist: ['static'],
  },
}
