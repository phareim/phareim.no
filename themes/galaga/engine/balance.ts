/**
 * Space Voyagers: every number that can be tuned, in one place. Pure data and
 * pure functions; the tests pin them and Petter changes them here. Lengths
 * are field pixels, times are ticks (60 a second) unless a name says seconds.
 * DESIGN.md says what each rule is for.
 */
import type { BossId, ConvoyId, Faction, PickupId, RescueId } from '../story/cues.ts'
import type { BossKind, Role, WeaponId } from './types.ts'

export const TPS = 60
export const FIELD = { w: 240, minH: 320, maxH: 432 } as const

export function clampHeight(h: number): number {
  return Math.max(FIELD.minH, Math.min(FIELD.maxH, Math.round(h) || FIELD.minH))
}

// ── The player ───────────────────────────────────────────────────────────
export const PLAYER = {
  speed: 2.6,
  hull: 5,
  /** 1.5 s of blinking after a hit. */
  invuln: 90,
  /** The cockpit: 6 px across. */
  hitR: 3,
  /** How far the ship may go: the sides, and the upper edge as a share of the height. */
  marginX: 14,
  topShare: 0.42,
  marginBottom: 20,
  startFromBottom: 40,
  tows: 2,
  towTicks: 150,
  towHull: 3,
  /** Weapon levels a hit costs (never below 1). */
  hitLevelLoss: 1,
  pickR: 15,
} as const

export const PARTNER = {
  speed: 1.7,
  offset: 52,
  /** Fires at half the player's rate, at what is within this many px of its nose. */
  fireEvery: 2,
  aimX: 16,
  hitR: 7,
  hits: 3,
  invuln: 60,
  limpTicks: 600,
  dockTicks: 720,
  dockOffset: 24,
} as const

export const DUET = {
  ticks: 360,
  /** Needle gained per kill, per hit point of the thing popped, and per boss hit. */
  perKillHp: 0.014,
  perBossHit: 0.0012,
  /** Both ships fire at this level, this much faster. */
  level: 5,
  fireMul: 0.5,
  cancelScore: 50,
} as const

// ── Weapons (the volleys are built from these in weapons.ts) ─────────────
export const WEAPONS: Record<WeaponId, { every: number; speed: number }> = {
  blaster: { every: 9, speed: 6.5 },
  disc: { every: 16, speed: 4.6 },
  boombox: { every: 22, speed: 3.4 },
}
export const LEVEL_MAX = 5
/** BLASTER: the fan's angles in degrees and sideways offsets, by level. */
export const BLASTER_FANS: readonly (readonly [number, number][])[] = [
  [[0, 0]],
  [[0, -4], [0, 4]],
  [[-8, -3], [0, 0], [8, 3]],
  [[-12, -6], [0, -3], [0, 3], [12, 6]],
  [[-14, -6], [-7, -3], [0, 0], [7, 3], [14, 6]],
]
/** DISC: how many, how hard, how many targets each goes through, by level. */
export const DISC_LEVELS: readonly { n: number; dmg: number; pierce: number }[] = [
  { n: 1, dmg: 2, pierce: 1 }, { n: 1, dmg: 2, pierce: 2 }, { n: 2, dmg: 2, pierce: 2 },
  { n: 2, dmg: 3, pierce: 3 }, { n: 3, dmg: 3, pierce: 3 },
]
export const DISC_TURN_RANGE = 110
/** BOOMBOX: arcs per volley, damage, reach and how wide the arc ends, by level. */
export const BOOMBOX_LEVELS: readonly { n: number; dmg: number; reach: number; width: number }[] = [
  { n: 1, dmg: 2, reach: 140, width: 26 }, { n: 1, dmg: 3, reach: 150, width: 30 },
  { n: 1, dmg: 4, reach: 160, width: 36 }, { n: 2, dmg: 3, reach: 170, width: 40 },
  { n: 2, dmg: 4, reach: 180, width: 46 },
]

// ── Difficulty: one number for a sector of a voyage ──────────────────────
/** 0 in sector 1 of the first voyage, 4 in sector 5; VOYAGE II starts at 2.5. */
export function difficulty(sector: number, voyage: number): number {
  return Math.min(9, Math.max(0, sector - 1) + Math.max(0, voyage - 1) * 2.5)
}
export const diveEvery = (d: number): number => Math.max(40, Math.round(170 - 30 * d))
export const maxDivers = (d: number): number => Math.min(7, 2 + Math.floor(d))
export const pairChance = (d: number): number => Math.min(0.6, 0.08 + 0.1 * d)
export const fireEvery = (d: number): number => Math.max(32, Math.round(130 - 25 * d))
export const boltCap = (d: number): number => Math.min(14, 3 + Math.floor(2 * d))
export const boltSpeed = (d: number): number => Math.min(3, 1.15 + 0.3 * d)
export const diveTicks = (d: number): number => Math.max(95, Math.round(200 - 22 * d))
export const enterTicks = (d: number): number => Math.max(80, Math.round(120 - 8 * d))
export const diverSpeed = (d: number): number => Math.min(4.2, 2.3 + 0.3 * d)
export const tankHp = (d: number): number => Math.min(5, 3 + Math.floor((d + 1) / 2))
/** From sector 3 the small ones take a second hit. */
export const veteranHp = (d: number): number => (d >= 2 ? 1 : 0)
/** The chance that one flying in lets a shot go on the way (never in sector 1). */
export const enterFire = (d: number): number => Math.min(0.5, 0.1 * d)
/** Dives begin once this many have formed up; in sector 1 the whole wave is let in first. */
export const diveAfter = (d: number): number => (d < 1 ? 99 : 4)
export const SNIPER = { warn: 30, speed: 3.4, every: 200, max: 2 } as const
export const DIVER_WARN = 30
export const TANK = { every: 190, fan: 0.32 } as const

// ── Roles and gangs ──────────────────────────────────────────────────────
export const ROLES: Record<Role, { hp: number; score: number; hw: number; hh: number; drop: number }> = {
  grunt: { hp: 1, score: 100, hw: 9, hh: 9, drop: 0.09 },
  flanker: { hp: 1, score: 120, hw: 9, hh: 9, drop: 0.09 },
  tank: { hp: 3, score: 300, hw: 13, hh: 13, drop: 0.4 },
  diver: { hp: 1, score: 150, hw: 9, hh: 9, drop: 0.1 },
  sniper: { hp: 1, score: 160, hw: 9, hh: 9, drop: 0.12 },
  splitter: { hp: 2, score: 200, hw: 10, hh: 10, drop: 0 },
  mite: { hp: 1, score: 50, hw: 6, hh: 6, drop: 0.08 },
  captor: { hp: 4, score: 400, hw: 13, hh: 13, drop: 0.5 },
  raider: { hp: 2, score: 150, hw: 9, hh: 9, drop: 0.12 },
}
/** A captor popped on the dive with the partner under it. */
export const CAPTOR = { freedScore: 1000, hoverUp: 112, beamHalf: 22, warn: 45, beam: 100, pull: 0.9, lift: 1.6 } as const

export type DiveStyle = 'arc' | 'charge' | 'wobble' | 'rail'
export interface Gang {
  /** How its dives are flown. */
  dive: DiveStyle
  /** The formation glides or moves in steps. */
  sway: 'smooth' | 'step'
  swayAmp: number
  /** Multipliers on speed, on how often it fires and on its shots' speed. */
  speed: number
  fire: number
  bolt: number
  /** Added to a tank's hit points. */
  tankHp: number
  /** Shots a diving one lets go. */
  diveShots: number
  /** Added to the chance that two dive together. */
  pair: number
}
export const GANGS: Record<Faction, Gang> = {
  glitterati: { dive: 'arc', sway: 'smooth', swayAmp: 12, speed: 0.9, fire: 0.8, bolt: 0.95, tankHp: 0, diveShots: 1, pair: 0 },
  hogs: { dive: 'charge', sway: 'smooth', swayAmp: 8, speed: 1.15, fire: 0.7, bolt: 1, tankHp: 1, diveShots: 0, pair: 0.1 },
  lovemachines: { dive: 'wobble', sway: 'smooth', swayAmp: 10, speed: 0.95, fire: 1, bolt: 0.9, tankHp: 0, diveShots: 1, pair: 0 },
  chromons: { dive: 'arc', sway: 'step', swayAmp: 12, speed: 1, fire: 1.25, bolt: 1.15, tankHp: 0, diveShots: 1, pair: 0.05 },
  noise: { dive: 'rail', sway: 'smooth', swayAmp: 10, speed: 1.1, fire: 1.2, bolt: 1.1, tankHp: 0, diveShots: 2, pair: 0.2 },
}

export const FORMATION = { cols: 8, dx: 25, dy: 24, top: 40, swayRate: 0.02, breathe: 0.06, stepPx: 6 } as const
/** Ticks between two of a string, and between two strings. */
export const STRING = { gap: 9, between: 40 } as const

// ── Sectors ──────────────────────────────────────────────────────────────
export type SectorEvent = { type: 'convoy'; id: ConvoyId } | { type: 'rescue'; id: RescueId }
export interface SectorDef {
  name: string
  gang: Faction
  event: SectorEvent
  bosses: readonly BossKind[]
  /** Hans Duo drops by in wave 2. */
  duo: boolean
  /**
   * The four waves: rows of the formation, front row last. G grunt, F flanker,
   * T tank, D diver, S sniper, P splitter, C captor, . empty.
   */
  waves: readonly (readonly string[])[]
}
export const SECTORS: readonly SectorDef[] = [
  {
    name: 'LOW ORBIT', gang: 'glitterati', event: { type: 'convoy', id: 'marge' }, bosses: ['knight'], duo: false,
    waves: [
      ['..GGGG..', '.GGGGGG.'],
      ['...C....', '.GGGGGG.', 'FF....FF'],
      ['..T..T..', '.GGGGGG.', '..GGGG..'],
      ['..T.C.T.', '.GGGGGG.', 'FF.DD.FF'],
    ],
  },
  {
    name: 'THE LONG HAUL', gang: 'hogs', event: { type: 'convoy', id: 'duckie' }, bosses: ['humdinger'], duo: true,
    waves: [
      ['.D.TT.D.', 'GGGGGGGG', 'FF....FF'],
      ['..S.C.S.', '.GPGGPG.', 'FF.GG.FF'],
      ['.T.DD.T.', 'GGPGGPGG', 'FF....FF'],
      ['.TSC.ST.', '.GGGGGG.', 'FFD..DFF'],
    ],
  },
  {
    name: 'THE SHAG NEBULA', gang: 'lovemachines', event: { type: 'rescue', id: 'babs' }, bosses: ['durant'], duo: false,
    waves: [
      ['.P.TT.P.', 'GGGGGGGG', 'FFD..DFF'],
      ['.S.CT.S.', 'GPGPPGPG', 'FF.DD.FF'],
      ['.T.SS.T.', 'PGGPPGGP', 'FFDGGDFF'],
      ['.TSCPST.', 'GPGGGGPG', 'FFDDDDFF'],
    ],
  },
  {
    name: 'THE DEAD BAND', gang: 'chromons', event: { type: 'rescue', id: 'ridley' }, bosses: ['cal'], duo: true,
    waves: [
      ['.S.TT.S.', 'GGGGGGGG', 'FFDGGDFF', '..GGGG..'],
      ['TS.C..ST', 'GGPGGPGG', 'FFDGGDFF', '.G.GG.G.'],
      ['.TS..ST.', 'GDGPPGDG', 'FFGGGGFF', '..DGGD..'],
      ['TS.CT.ST', 'GPGDDGPG', 'FFGGGGFF', '.GDGGDG.'],
    ],
  },
  {
    name: 'THE DEEP END', gang: 'noise', event: { type: 'rescue', id: 'lena' }, bosses: ['fader', 'deafstar'], duo: false,
    waves: [
      ['.S.TT.S.', 'GGDGGDGG', 'FFFGGFFF', '.GG..GG.'],
      ['TS.C..ST', 'GPGDDGPG', 'FFFGGFFF', '.GDGGDG.'],
      ['.TSPPST.', 'GDGGGGDG', 'FFFDDFFF', 'G.GGGG.G'],
      ['TSTC.TST', 'GPDGGDPG', 'FFFGGFFF', 'GDGPPGDG'],
    ],
  },
]
export const ROLE_LETTER: Record<string, Role> = {
  G: 'grunt', F: 'flanker', T: 'tank', D: 'diver', S: 'sniper', P: 'splitter', C: 'captor',
}
/** Stage lengths. */
export const STAGE = { card: 180, betweenWaves: 80, clear: 200, ending: 600, bossDying: 110, bossEnter: 150 } as const
export const BONUS = { strings: 4, perString: 6, gap: 12, between: 150, flyTicks: 230, each: 100, perfect: 5000 } as const

// ── Power-ups ────────────────────────────────────────────────────────────
export const PICKUP_IDS: readonly PickupId[] = [
  'tube', 'blaster', 'disc', 'boombox', 'pizza', 'bubble', 'cb', 'mirrorball', 'tracking', 'hairspray', 'magnet', 'quarter',
]
export const PICKUP = {
  maxFalling: 3,
  fall: 0.75,
  /** A wave never goes this many kills without a drop. */
  pityKills: 11,
  /** Hull at 1 and no pizza for this long: the next pop drops one. */
  pizzaPity: 20 * TPS,
  magnetTicks: 10 * TPS,
  quarterTicks: 10 * TPS,
  trackingTicks: 5 * TPS,
  trackingSlow: 0.4,
  cloudTicks: 5 * TPS,
  cloudR: 34,
  cloudAhead: 62,
  holdTicks: 4 * TPS,
  bubbleHits: 2,
  mirrorDmg: 2,
  mirrorBossDmg: 14,
  magnetPull: 2.2,
  rigSpeed: 3.2,
  rigDmg: 6,
  rigBossDmg: 22,
} as const
/** The chance of each drop, before the rules in pickups.ts take some out. */
export const PICKUP_WEIGHT: Record<PickupId, number> = {
  tube: 30, blaster: 6, disc: 7, boombox: 6, pizza: 10, bubble: 6, cb: 5, mirrorball: 4,
  tracking: 5, hairspray: 5, magnet: 4, quarter: 6,
}

// ── Scoring ──────────────────────────────────────────────────────────────
export const SCORE = {
  /** A kill within this long of the last keeps the chain. */
  chainTicks: 150,
  /** Kills per step of the multiplier, and its top. */
  chainStep: 6,
  chainMax: 5,
  boss: 5000,
  convoy: 3000,
  rescue: 3000,
  sector: 1000,
  valve: 200,
} as const
export const chainMul = (chain: number): number => Math.min(SCORE.chainMax, 1 + Math.floor(chain / SCORE.chainStep))

// ── The sector's event ───────────────────────────────────────────────────
export const CONVOY = {
  ticks: 40 * TPS,
  rigHw: 18,
  rigHh: 75,
  gap: 14,
  laneX: 30,
  /** Cargo (0..1) one raider eats per tick. */
  drain: 1 / 1400,
  crate: 2,
} as const
export const CONVOY_RIGS: Record<ConvoyId, readonly string[]> = {
  marge: ['rig-marge'],
  duckie: ['rig-duckie', 'rig-duckie', 'rig-barton'],
}
export const RESCUE = {
  /** Where it stalls, as a share of the height, and how near the player must hold. */
  yShare: 0.5,
  reach: 44,
  fill: 1 / 120,
  drain: 1 / 480,
  drag: 0.11,
  settle: 0.05,
  driftIn: 0.6,
  hw: 16,
  hh: 20,
} as const
export const RAIDER = { every: 330, first: 150, max: 3, speed: 1.5 } as const
export const raiderEvery = (d: number): number => Math.max(170, Math.round(RAIDER.every - 30 * d))
/** The rescued friend's own gun: bigger than yours. */
export const WING_GUNS: Record<RescueId, { every: number; dmg: number; pierce: number; hw: number; speed: number; dxs: readonly number[] }> = {
  babs: { every: 14, dmg: 2, pierce: 0, hw: 3, speed: 6, dxs: [-9, 0, 9] },
  ridley: { every: 26, dmg: 7, pierce: 2, hw: 8, speed: 4.5, dxs: [0] },
  lena: { every: 8, dmg: 2, pierce: 0, hw: 2, speed: 7.5, dxs: [-5, 5] },
}
export const DUO = { speed: 2.2, minWave: 6, share: 0.5 } as const
/** A friend's pass in the last fight: the share of the boss's hull it takes. */
export const PASS = { dmgShare: 0.07, rigSpeed: 3.6, flySpeed: 2.6 } as const

// ── Bosses ───────────────────────────────────────────────────────────────
export interface BossDef {
  hp: number
  hw: number
  hh: number
  /** The part that takes damage: offset from the centre, half its size. */
  weak: readonly [number, number, number, number]
  /** Hull shares at which phase 2 and phase 3 begin. */
  phases: readonly [number, number]
  /** Ticks between attacks, phase 1 and the last phase. */
  rest: readonly [number, number]
  /** Attacks in turn, by phase. */
  attacks: readonly (readonly string[])[]
}
export const BOSSES: Record<BossKind, BossDef> = {
  knight: { hp: 600, hw: 34, hh: 30, weak: [0, 0, 34, 30], phases: [0.5, 0], rest: [150, 100], attacks: [['ray', 'floor', 'glint'], ['rays', 'floor2', 'ray', 'glint']] },
  humdinger: { hp: 800, hw: 36, hh: 34, weak: [0, 0, 36, 34], phases: [0.5, 0], rest: [140, 95], attacks: [['mines', 'ram', 'hogs'], ['ram2', 'mines', 'hogs', 'ram']] },
  durant: { hp: 900, hw: 52, hh: 26, weak: [0, 0, 52, 26], phases: [0.66, 0.33], rest: [120, 60], attacks: [['scale', 'chord'], ['trill', 'chord', 'scale'], ['chord', 'trill', 'notes', 'scale']] },
  cal: { hp: 260, hw: 112, hh: 22, weak: [0, 14, 10, 10], phases: [0.5, 0], rest: [150, 110], attacks: [['eye', 'pods', 'eye'], ['eyes', 'pods', 'eyes']] },
  fader: { hp: 700, hw: 30, hh: 30, weak: [0, 0, 30, 30], phases: [0.5, 0], rest: [150, 110], attacks: [['sliders', 'choke'], ['sliders', 'treble', 'choke']] },
  deafstar: { hp: 300, hw: 120, hh: 44, weak: [0, 40, 9, 9], phases: [0.66, 0.33], rest: [170, 120], attacks: [['rings', 'note'], ['rings', 'static', 'note'], ['squeeze', 'rings', 'note', 'static']] },
}
/** VOYAGE II and on: more hull. */
export const bossHp = (id: BossKind, voyage: number): number => Math.round(BOSSES[id].hp * (1 + 0.35 * Math.max(0, voyage - 1)))
/**
 * A boss's fight should not be five times shorter at weapon level 5 than at level 1:
 * it takes up to `dps` damage a second in full, and what comes on top of that at `over`.
 */
export const BOSS_SOAK = { dps: 14, over: 0.35 } as const
export const BOSS_ORDER: readonly BossId[] = ['knight', 'humdinger', 'durant', 'cal', 'fader']
/** The numbers of each attack. */
export const ATTACK = {
  ray: { w: 26, warn: 55, live: 150, speed: 1.1 },
  rays: { w: 26, warn: 60, live: 90, gap: 34, shift: 40 },
  floor: { cols: 4, rows: 3, warn: 60, live: 30 },
  glint: { n: 5, fan: 0.9, speed: 1.3 },
  ram: { w: 68, warn: 65, live: 55, speed: 6 },
  mines: { n: 5, fall: 0.85, sit: 240, r: 5 },
  hogs: { n: 3 },
  keys: { cols: 8, warn: 45, live: 12, stagger: 16, safe: 2, chordWarn: 60, chordLive: 22, trillGap: 34 },
  notes: { n: 4, speed: 1.1 },
  /** The Excess Machine cools when left alone: hull back per tick after `after` ticks, never past the phase. */
  cool: { after: 120, per: 0.12 },
  doors: { gap: 48, gap2: 38, shutTicks: 70, open: 200, shut: 420, drift: 0.35, below: 60 },
  eye: { warn: 42, speed: 4.2, between: 34 },
  pods: { n: 2 },
  sliders: { n: 3, between: 85, gap: 56, gap2: 46, speed: 1.25, speed2: 1.6, h: 10, shift: 100, warn: 30 },
  choke: { warn: 45, speed: 3.4, burst: 3 },
  treble: { n: 12, speed: 1.2 },
  rings: { n: 28, gap: 5, speed: 1.3, between: 55 },
  note: { w: 72, w3: 96, warn: 80, live: 50 },
  static: { n: 3 },
  squeeze: { w: 46, warn: 70, live: 150 },
} as const

/** The radio's between-times, in ticks. */
export const TALK = { idle: 600, chat: 480, taunt: 620, hanging: 420 } as const

export const enemyKind = (gang: Faction, role: Role): string => `enemy-${gang}-${role}`
