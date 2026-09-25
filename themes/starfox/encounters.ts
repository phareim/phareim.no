/**
 * Star Fox encounters — each sector's ~80 s of travel as a script instead
 * of pure random spawns (2026-09-25). Pure: no three.js, DOM or Vue, so
 * tests/starfox-encounters.test.mjs can walk every sector.
 *
 * A sector opens with a wave, meets its signature enemies on purpose (a
 * `meet:<kind>` cue), runs a mid-sector set piece (`set:rings`,
 * `set:turrets`, `set:carrier`, `set:ambush`), places three gold rings
 * off the easy line, and ends in WARNING (`boss:warning`). Random filler
 * (formations, obstacles, silver rings) fills the gaps, kept under a
 * density cap and quiet around scripted beats and during set pieces.
 *
 * Positions are normalised: x −1…1 across the corridor (× laneX), y 0…1
 * from the lane floor to its ceiling (balance.ts `laneY`). The scene
 * spawns at its usual SPAWN_Z unless an event says otherwise.
 *
 *   const run = createEncounterRunner(index, loop, rng)
 *   for (const ev of run.step(dt)) spawn(ev)   // the array is reused
 */

import {
  TRAVEL_TIME, ENTRY_PATHS, HORNET, SIGNATURE_KINDS, DINGO_TROUBLE, RIVAL, SQUAD,
  pickEnemyKind, formationSize, spawnPace, firesMissiles, rivalHp,
  type EnemyKind, type EntryPath, type WingId,
} from './balance.ts'
import { absoluteSector, BOSSES, type BossId } from './ids.ts'
import type { CapsuleType } from './arsenal.ts'

export type SetPieceId = 'rings' | 'turrets' | 'carrier' | 'ambush' | 'dingoTrouble' | 'cobra' | 'rivalDuel'
/** How a set piece ended: DINGO saved or lost, the rival escaped or
 * went down, or it simply ran its course. */
export type SetPieceOutcome = 'done' | 'saved' | 'lost' | 'escape' | 'down'

/** Cue for a resolved set piece (story.ts keys). */
export const OUTCOME_CUES: Readonly<Partial<Record<SetPieceId, Partial<Record<SetPieceOutcome, string>>>>> = {
  dingoTrouble: { saved: 'dingo:saved', lost: 'dingo:lost' },
  rivalDuel: { escape: 'cobra:escape', down: 'cobra:down' },
}
export type ObstacleKind = 'pillar' | 'rock' | 'mine' | 'arch'

interface EvBase {
  /** runner time (s since the sector's travel began) */
  t: number
  /** from the script (false = random filler) */
  scripted: boolean
  /** intercom cue (story.ts key) to raise when this spawns */
  story?: string
}

export type EncounterEvent = EvBase & (
  /** gnat-style formation on a curved entry path; `kinds` per member */
  | { type: 'formation'; kinds: EnemyKind[]; path: EntryPath; x: number; y: number }
  | { type: 'enemy'; kind: EnemyKind; x: number; y: number; behind?: boolean; missiles?: boolean }
  | { type: 'carrier'; x: number; y: number; missiles: boolean }
  /** a row of ground turrets, one per x; later rows `spacing` z apart */
  | { type: 'turrets'; xs: number[] }
  /** a ring gate: silver rings in a slalom, `spacing` world z apart */
  | { type: 'ringGate'; xs: number[]; ys: number[]; spacing: number }
  | { type: 'goldRing'; x: number; y: number }
  | { type: 'ring'; x: number; y: number }
  /** `capsule` null = pick by need at spawn (arsenal.ts `pickCapsule`) */
  | { type: 'capsule'; capsule: CapsuleType | null; x: number; y: number }
  /** `x` null = the scene picks as before */
  | { type: 'obstacle'; obstacle: ObstacleKind; x: number | null }
  /** hornets are coming from behind: the warning; they follow as
   * `enemy` events with `behind: true` HORNET.warnLead s later */
  | { type: 'ambush'; count: number; side: -1 | 1 }
  | { type: 'setPiece'; id: SetPieceId; phase: 'start' | 'end'; outcome?: SetPieceOutcome }
  /** DINGO breaks formation toward `side` with `chasers` gnats on his
   * tail; save him within `time` s (balance.ts DINGO_TROUBLE, dingoWeave) */
  | { type: 'dingoTrouble'; chasers: number; side: -1 | 1; time: number }
  /** MEGA COBRA: `flyby` crosses the screen untouchable and silent (a
   * taunt); `duel` fights and escapes (balance.ts rivalEscapes); `final`
   * fights to the end. `hp` from rivalHp. */
  | { type: 'rival'; mode: 'flyby' | 'duel' | 'final'; hp: number; side: -1 | 1 }
  | { type: 'warning'; boss: BossId }
)

export type EncounterType = EncounterEvent['type']

// ---- the scripts ---------------------------------------------------------------

type Spec =
  | { type: 'formation'; kind: EnemyKind; count: number; path: EntryPath; x: number; y: number }
  | { type: 'enemy'; kind: EnemyKind; x: number; y: number }
  | { type: 'carrier'; x: number; y: number }
  | { type: 'turrets'; xs: number[] }
  | { type: 'ringGate'; n: number }
  | { type: 'goldRing'; x: number; y: number }
  | { type: 'capsule'; capsule: CapsuleType | null; x: number; y: number }
  | { type: 'obstacle'; obstacle: ObstacleKind; x: number | null }
  | { type: 'ambush'; count: number; side: -1 | 1 }
  | { type: 'setPiece'; id: SetPieceId; phase: 'start' | 'end' }
  | { type: 'dingoTrouble' }
  | { type: 'cobraFlyby' }
  | { type: 'rivalDuel'; final: boolean }

export interface Beat { at: number; spec: Spec; story?: string }

const F = (at: number, kind: EnemyKind, count: number, path: EntryPath, x: number, y: number, story?: string): Beat =>
  ({ at, spec: { type: 'formation', kind, count, path, x, y }, story })
const E = (at: number, kind: EnemyKind, x: number, y: number, story?: string): Beat =>
  ({ at, spec: { type: 'enemy', kind, x, y }, story })
const C = (at: number, x: number, y: number, story?: string): Beat => ({ at, spec: { type: 'carrier', x, y }, story })
const T = (at: number, xs: number[], story?: string): Beat => ({ at, spec: { type: 'turrets', xs }, story })
const G = (at: number, x: number, y: number): Beat => ({ at, spec: { type: 'goldRing', x, y } })
const K = (at: number, capsule: CapsuleType | null, x: number, y: number): Beat => ({ at, spec: { type: 'capsule', capsule, x, y } })
const O = (at: number, obstacle: ObstacleKind, x: number | null): Beat => ({ at, spec: { type: 'obstacle', obstacle, x } })
const A = (at: number, count: number, side: -1 | 1): Beat => ({ at, spec: { type: 'ambush', count, side }, story: 'warn:behind' })
const RG = (at: number, n: number): Beat => ({ at, spec: { type: 'ringGate', n } })
const S = (at: number, id: SetPieceId, phase: 'start' | 'end'): Beat =>
  ({ at, spec: { type: 'setPiece', id, phase }, story: phase === 'start' ? `set:${id}` : undefined })
/** DINGO in trouble — only if DINGO is flying at that moment. */
const DT = (at: number): Beat => ({ at, spec: { type: 'dingoTrouble' }, story: 'dingo:trouble' })
/** MEGA COBRA flies past: a taunt, no fight. */
const CF = (at: number): Beat => ({ at, spec: { type: 'cobraFlyby' }, story: 'cobra:flyby' })
/** MEGA COBRA duel: escapes in sector 3, fights to the end in sector 5. */
const RD = (at: number, final: boolean): Beat =>
  ({ at, spec: { type: 'rivalDuel', final }, story: final ? 'cobra:duel' : 'cobra:arrive' })

/** Travel scripts per sector index. Gold rings sit off the easy line: at
 * the corridor's edges, its ceiling, or down low beside a hazard. */
export const SCRIPTS: readonly (readonly Beat[])[] = [
  // 0 CORAL COAST — onboarding: gnats, a ring gate, two spikes to finish
  [
    F(1.5, 'drone', 3, 'dropTop', 0, 0.55, 'meet:drone'),
    F(6, 'drone', 3, 'sweepLeft', -0.3, 0.5),
    K(10, 'laser', 0.3, 0.45),
    F(12, 'drone', 4, 'sweepRight', 0.3, 0.6),
    G(16, -0.85, 0.92),
    F(18, 'drone', 3, 'hookLeft', 0, 0.4),
    S(22, 'rings', 'start'),
    RG(23, 7),
    F(31, 'drone', 2, 'arc', 0, 0.7),
    G(33, 0.88, 0.1),
    S(38, 'rings', 'end'),
    K(40, null, 0, 0.5),
    F(42, 'drone', 4, 'dropTop', -0.2, 0.6),
    F(47, 'drone', 3, 'sweepRight', 0.4, 0.5),
    E(51, 'kamikaze', -0.4, 0.5, 'meet:kamikaze'),
    E(51.6, 'kamikaze', 0.4, 0.5),
    K(55, null, -0.4, 0.5),
    F(57, 'drone', 4, 'hookRight', 0, 0.5),
    O(61, 'pillar', 0.3),
    G(61.2, -0.05, 0.06),
    F(65, 'drone', 5, 'sweepLeft', 0, 0.55),
    K(69, null, 0.5, 0.5),
    F(70, 'drone', 3, 'dropTop', -0.5, 0.5),
    F(73, 'drone', 3, 'sweepRight', 0.5, 0.6),
  ],
  // 1 WHISPER WOODS — mantas, a lancer, hornets from behind, DINGO in
  // trouble, MEGA COBRA's first flyby
  [
    F(1.5, 'drone', 4, 'sweepLeft', 0, 0.55),
    F(5, 'weaver', 2, 'arc', 0, 0.6, 'meet:weaver'),
    O(9, 'mine', -0.3),
    K(11, null, 0.2, 0.5),
    E(14, 'sniper', 0.6, 0.75, 'meet:sniper'),
    F(17, 'drone', 3, 'hookRight', -0.2, 0.5),
    G(19, 0.9, 0.95),
    S(23, 'ambush', 'start'),
    A(24, 3, -1),
    A(29, 2, 1),
    F(33, 'weaver', 3, 'sweepRight', 0, 0.5),
    S(36, 'ambush', 'end'),
    K(38, null, -0.3, 0.5),
    F(40, 'drone', 3, 'dropTop', 0.2, 0.6),
    DT(43),
    O(46, 'mine', -0.62),
    G(46.2, -0.9, 0.08),
    K(49, null, 0, 0.5),
    E(55.5, 'sniper', -0.7, 0.8),
    E(55.9, 'sniper', 0.7, 0.8),
    F(58, 'weaver', 3, 'sweepLeft', 0, 0.45),
    K(60, null, 0.4, 0.5),
    CF(62),
    O(67, 'arch', null),
    G(67.3, 0, 0.97),
    K(70, null, -0.3, 0.5),
    F(71, 'drone', 5, 'arc', 0, 0.6),
    F(74, 'weaver', 2, 'hookLeft', -0.3, 0.5),
  ],
  // 2 EMBER FIELDS — turrets on the basalt, bulwarks, pods; the gauntlet;
  // MEGA COBRA's first duel (he escapes)
  [
    F(1.5, 'drone', 4, 'dropTop', 0, 0.6),
    T(5, [-0.5, 0.5], 'meet:turret'),
    E(8, 'bulwark', 0, 0.5, 'meet:bulwark'),
    K(11, null, -0.3, 0.55),
    E(14, 'splitter', 0.3, 0.6, 'meet:splitter'),
    F(16, 'kamikaze', 2, 'sweepLeft', -0.2, 0.5),
    T(19, [0.72]),
    G(19.3, 0.9, 0.07),
    F(23, 'weaver', 3, 'arc', 0, 0.55),
    S(26, 'turrets', 'start'),
    T(27, [-0.8, -0.3, 0.3, 0.8]),
    T(30, [-0.55, 0, 0.55]),
    G(32, 0, 0.1),
    T(33, [-0.8, -0.3, 0.3, 0.8]),
    F(36, 'drone', 3, 'dropTop', 0, 0.75),
    S(39, 'turrets', 'end'),
    K(40, null, 0.3, 0.5),
    F(43, 'drone', 4, 'sweepRight', -0.2, 0.55),
    E(46, 'bulwark', -0.5, 0.5),
    E(46.5, 'bulwark', 0.5, 0.5),
    RD(50, false),
    K(54, null, 0, 0.5),
    G(56, -0.9, 0.95),
    F(60, 'kamikaze', 3, 'hookRight', 0, 0.5),
    F(64, 'weaver', 3, 'sweepLeft', 0, 0.5),
    K(66, null, -0.4, 0.5),
    F(69, 'drone', 5, 'arc', 0, 0.6),
    E(73, 'sniper', -0.6, 0.8),
    E(73.4, 'sniper', 0.6, 0.8),
  ],
  // 3 MIRROR LAKE — lancers over the water, the first carrier, DINGO in
  // trouble again
  [
    F(1.5, 'drone', 4, 'sweepLeft', 0, 0.55),
    E(5, 'sniper', -0.6, 0.8),
    E(5.4, 'sniper', 0.6, 0.8),
    F(9, 'weaver', 3, 'arc', 0, 0.5),
    K(12, null, 0.3, 0.5),
    A(14, 2, -1),
    G(18, 0.88, 0.93),
    F(21, 'drone', 5, 'dropTop', 0, 0.6),
    S(25, 'carrier', 'start'),
    C(26, 0, 0.62, 'meet:carrier'),
    G(30, -0.9, 0.95),
    F(34, 'drone', 3, 'sweepRight', 0.4, 0.4),
    S(42, 'carrier', 'end'),
    K(44, null, 0, 0.5),
    E(46, 'bulwark', 0, 0.5),
    DT(47),
    F(49, 'drone', 4, 'hookLeft', -0.2, 0.55),
    O(51.8, 'pillar', 0.35),
    G(52, 0, 0.06),
    E(55, 'sniper', -0.7, 0.85),
    E(55.4, 'sniper', 0.7, 0.85),
    K(57, null, -0.3, 0.5),
    A(60, 3, 1),
    F(64, 'weaver', 3, 'sweepLeft', 0, 0.5),
    T(67, [-0.6, 0.6]),
    K(69, null, 0.3, 0.5),
    F(70, 'drone', 5, 'arc', 0, 0.6),
    E(74, 'splitter', 0, 0.6),
  ],
  // 4 THE HOLLOW CROWN — missiles, a carrier with teeth, a double ambush,
  // then the final duel with MEGA COBRA; WARNING waits for it
  [
    F(1.5, 'drone', 5, 'dropTop', 0, 0.6),
    A(5, 2, -1),
    F(10, 'weaver', 3, 'sweepRight', 0, 0.5),
    K(12, null, 0, 0.5),
    E(15, 'bulwark', -0.4, 0.5),
    E(15.5, 'splitter', 0.4, 0.6),
    G(18, -0.9, 0.94),
    F(21, 'kamikaze', 3, 'hookLeft', 0, 0.5),
    S(24, 'carrier', 'start'),
    C(25, -0.4, 0.65),
    G(28, 0.9, 0.08),
    F(31, 'drone', 3, 'sweepRight', 0.4, 0.5),
    S(38, 'carrier', 'end'),
    K(40, null, 0, 0.5),
    S(42, 'ambush', 'start'),
    A(43, 3, 1),
    A(47, 3, -1),
    F(50, 'weaver', 3, 'arc', 0, 0.5),
    S(52, 'ambush', 'end'),
    K(53, null, -0.3, 0.5),
    F(56, 'drone', 5, 'sweepLeft', 0, 0.6),
    E(59, 'sniper', -0.6, 0.8),
    E(59.4, 'sniper', 0.6, 0.8),
    O(62, 'arch', null),
    G(62.3, 0, 0.97),
    RD(64, true),
    K(65, null, 0.3, 0.5),
  ],
]

/** The first hornets of THE HOLLOW CROWN carry the `meet:missile` cue
 * (they are the first to fire missiles on the first pass). */
const MISSILE_MEET_INDEX = 4

// ---- filler and pacing -----------------------------------------------------------

export const FILLER = {
  /** seconds between filler formations at sector 1 (× spawnPace) */
  enemyEvery: 3.2,
  /** seconds between filler obstacles at sector 1 (× spawnPace) */
  obstacleEvery: 1.9,
  ringEvery: [5, 8.5] as const,
  /** no filler formation this close to a scripted enemy beat */
  clearOfBeat: 1.5,
  /** filler stops this long before WARNING */
  tailQuiet: 3,
} as const

/** What filler does during each set piece: enemy rate multiplier,
 * obstacles on/off, silver rings on/off. */
/** `holdScript`: scripted enemy beats that fall inside the set piece are
 * dropped (DINGO's chase and the duels own the sky). */
export const SET_PIECE_POLICY: Readonly<Record<SetPieceId, { enemies: number; obstacles: boolean; rings: boolean; holdScript: boolean }>> = {
  rings: { enemies: 0, obstacles: false, rings: false, holdScript: false },
  turrets: { enemies: 0, obstacles: false, rings: true, holdScript: false },
  carrier: { enemies: 0.4, obstacles: true, rings: true, holdScript: false },
  ambush: { enemies: 0, obstacles: true, rings: true, holdScript: false },
  dingoTrouble: { enemies: 0, obstacles: false, rings: true, holdScript: true },
  cobra: { enemies: 0, obstacles: true, rings: true, holdScript: false },
  rivalDuel: { enemies: 0, obstacles: false, rings: true, holdScript: true },
}

/** DINGO's chasers: three the first time (woods, first pass), four after. */
export function dingoChasers(index: number, loop: number): number {
  return index === 1 && loop === 0 ? 3 : 4
}

/** Density: spawn weight inside any `window` s may not pass `cap`. */
export const DENSITY = { window: 6, capBase: 10, capPerSector: 1.5, capMax: 18 } as const

export function densityCap(sector: number): number {
  return Math.min(DENSITY.capMax, DENSITY.capBase + DENSITY.capPerSector * (Math.max(1, sector) - 1))
}

/** Spawn weight of an event: enemies count one each, a carrier four (it
 * launches gnats), a turret one; everything else nothing. */
export function eventWeight(ev: EncounterEvent): number {
  switch (ev.type) {
    case 'formation': return ev.kinds.length
    case 'enemy': return 1
    case 'carrier': return 4
    case 'turrets': return ev.xs.length
    case 'dingoTrouble': return ev.chasers
    case 'rival': return ev.mode === 'flyby' ? 0 : 4
    default: return 0
  }
}

/** Obstacle mix per sector index; ECHO coast gets the varied mix. */
const OBSTACLE_MIX: readonly (readonly [ObstacleKind, number][])[] = [
  [['pillar', 0.55], ['rock', 0.45]],
  [['pillar', 0.34], ['rock', 0.22], ['mine', 0.24], ['arch', 0.20]],
  [['pillar', 0.40], ['rock', 0.25], ['mine', 0.15], ['arch', 0.20]],
  [['pillar', 0.35], ['rock', 0.20], ['mine', 0.25], ['arch', 0.20]],
  // space: no ground, so no pillars
  [['rock', 0.50], ['mine', 0.30], ['arch', 0.20]],
]

export function obstacleMix(index: number, loop: number): readonly (readonly [ObstacleKind, number])[] {
  return index === 0 && loop > 0 ? OBSTACLE_MIX[1]! : OBSTACLE_MIX[index]!
}

/** ECHO adds members to scripted formations and hornets to ambushes. */
export function echoExtra(loop: number): number {
  return loop >= 3 ? 2 : loop >= 1 ? 1 : 0
}

/** A ring-gate slalom: consecutive rings at most `maxStep` apart across
 * (x) and 0.2 up/down (y), so the line is always flyable. */
export const RING_GATE = { spacing: 16, maxStep: 0.3 } as const

export function ringGateLine(n: number, rng: () => number): { xs: number[]; ys: number[] } {
  const xs: number[] = []
  const ys: number[] = []
  let x = (rng() - 0.5) * 0.6
  let y = 0.35 + rng() * 0.3
  let dir = rng() < 0.5 ? -1 : 1
  for (let i = 0; i < n; i++) {
    xs.push(x)
    ys.push(y)
    const step = RING_GATE.maxStep * (0.6 + 0.4 * rng())
    if (Math.abs(x + dir * step) > 0.75) dir = -dir as -1 | 1
    x += dir * step
    y = Math.max(0.15, Math.min(0.85, y + (rng() - 0.5) * 0.4))
  }
  return { xs, ys }
}

/** Seeded rng (mulberry32) for deterministic runs and tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---- the runner ----------------------------------------------------------------

export interface EncounterRunner {
  readonly index: number
  readonly loop: number
  /** absolute 1-based sector */
  readonly sector: number
  readonly t: number
  /** true once WARNING has been emitted */
  readonly done: boolean
  /** the set piece running now, or null */
  readonly setPiece: SetPieceId | null
  /** advance; returns this step's events (the array is reused) */
  step(dt: number): EncounterEvent[]
  /** the scene reports how a running set piece ended (DINGO saved or
   * lost, the rival escaped or down); the end event, with its cue, comes
   * on the next step. False if that set piece isn't running. Unresolved,
   * DINGO is lost at his deadline and the sector-3 rival escapes. */
  resolve(id: SetPieceId, outcome: SetPieceOutcome): boolean
}

export interface RunnerOpts {
  /** who is flying right now (DINGO's set piece needs DINGO); default all three */
  squad?: () => readonly WingId[]
}

export function createEncounterRunner(
  index: number, loop: number, rng: () => number = Math.random, opts: RunnerOpts = {},
): EncounterRunner {
  const squad = opts.squad ?? (() => SQUAD)
  const idx = ((Math.floor(index) % SCRIPTS.length) + SCRIPTS.length) % SCRIPTS.length
  const lp = Math.max(0, Math.floor(loop))
  const sector = absoluteSector(idx, lp)
  const script = SCRIPTS[idx]!
  const extra = echoExtra(lp)
  const missiles = firesMissiles(sector)
  const pace = spawnPace(sector)
  const cap = densityCap(sector)
  const mix = obstacleMix(idx, lp)
  const beatTimes = script.filter(b => isEnemySpec(b.spec)).map(b => b.at)

  const out: EncounterEvent[] = []
  /** [time, weight] of everything spawned in the last window */
  const log: [number, number][] = []
  /** scripted spawns still to come, at their base weight: filler and ECHO
   * extras leave room for them, so no window ever passes the cap */
  const planned: { at: number; w: number; done: boolean }[] = []
  const beatPlan: number[] = []
  for (const b of script) {
    beatPlan.push(planned.length)
    const w = specWeight(b.spec)
    if (b.spec.type === 'ambush') {
      const n = b.spec.count + (lp >= 2 ? 1 : 0)
      for (let i = 0; i < n; i++) planned.push({ at: b.at + HORNET.warnLead + i * HORNET_GAP, w: 1, done: false })
    } else if (b.spec.type === 'dingoTrouble') planned.push({ at: b.at, w: dingoChasers(idx, lp), done: false })
    else if (b.spec.type === 'rivalDuel') planned.push({ at: b.at, w: 4, done: false })
    else planned.push({ at: b.at, w, done: w === 0 })
  }
  /** a set piece the runner ends itself: by `resolve` or at `until` */
  let timed: { id: SetPieceId; until: number; fallback: SetPieceOutcome } | null = null
  let resolution: SetPieceOutcome | null = null
  /** hornets waiting behind an ambush warning */
  const pending: { at: number; side: -1 | 1; i: number; plan: number; story?: string; filler?: boolean }[] = []
  let t = 0
  let cursor = 0
  let done = false
  let setPiece: SetPieceId | null = null
  let missileMet = false
  let metDasher = false
  /** kinds the script has put in the air; on the first pass filler
   * holds back this sector's signature kinds until they are met */
  const met = new Set<EnemyKind>()
  const signature = SIGNATURE_KINDS[idx]!
  const rand = (lo: number, hi: number) => lo + (hi - lo) * rng()
  let enemyT = rand(1.5, 2.5) + FILLER.enemyEvery * pace
  let obstacleT = rand(0.8, 1.6)
  let ringT = rand(3, 5)

  function windowWeight(now: number): number {
    while (log.length && log[0]![0] <= now - DENSITY.window) log.shift()
    let w = 0
    for (const [, v] of log) w += v
    return w
  }

  function upcoming(now: number): number {
    let w = 0
    for (const p of planned) if (!p.done && p.at <= now + DENSITY.window) w += p.w
    return w
  }

  function room(now: number): number {
    return cap - windowWeight(now) - upcoming(now)
  }

  function push(ev: EncounterEvent) {
    const w = eventWeight(ev)
    if (w > 0) log.push([ev.t, w])
    if (ev.scripted) {
      if (ev.type === 'formation') for (const k of ev.kinds) met.add(k)
      else if (ev.type === 'enemy') met.add(ev.kind)
      else if (ev.type === 'ambush') met.add('dasher')
    }
    out.push(ev)
  }

  /** A filler kind, or a gnat while the script has yet to meet it. */
  function fillerKind(): EnemyKind {
    const k = pickEnemyKind(sector, rng)
    return lp === 0 && signature.includes(k) && !met.has(k) ? 'drone' : k
  }

  /** Hornets come from behind with a warning, never inside a formation. */
  function queueHornets(n: number, side: -1 | 1, story?: string) {
    for (let i = 0; i < n; i++) {
      const plan = planned.length
      planned.push({ at: t + HORNET.warnLead + i * HORNET_GAP, w: 1, done: false })
      pending.push({ at: planned[plan]!.at, side, i, plan, story: i === 0 ? story : undefined, filler: true })
    }
  }

  /** Drop a beat: its planned weight no longer reserves room. */
  function skipBeat(b: Beat, plan: number) {
    const n = b.spec.type === 'ambush' ? b.spec.count + (lp >= 2 ? 1 : 0) : 1
    for (let i = 0; i < n; i++) planned[plan + i]!.done = true
  }

  function startTimed(id: SetPieceId, story: string | undefined, length: number, fallback: SetPieceOutcome) {
    setPiece = id
    timed = { id, until: t + length, fallback }
    resolution = null
    push({ t, scripted: true, story, type: 'setPiece', id, phase: 'start' })
  }

  function endTimed(outcome: SetPieceOutcome) {
    const id = timed!.id
    timed = null
    resolution = null
    setPiece = null
    push({ t, scripted: true, story: OUTCOME_CUES[id]?.[outcome], type: 'setPiece', id, phase: 'end', outcome })
  }

  function emitBeat(b: Beat, plan: number) {
    const s = b.spec
    const pol = setPiece ? SET_PIECE_POLICY[setPiece] : null
    if (pol?.holdScript && (isEnemySpec(s) || s.type === 'cobraFlyby')) { skipBeat(b, plan); return }
    if (s.type === 'dingoTrouble' && (setPiece !== null || !squad().includes('dingo'))) { skipBeat(b, plan); return }
    if ((s.type === 'rivalDuel' || s.type === 'cobraFlyby') && setPiece !== null) { skipBeat(b, plan); return }
    const base = { t, scripted: true as const, story: b.story }
    if (s.type !== 'ambush') planned[plan]!.done = true
    switch (s.type) {
      case 'dingoTrouble': {
        const side: -1 | 1 = rng() < 0.5 ? -1 : 1
        startTimed('dingoTrouble', b.story, DINGO_TROUBLE.time, 'lost')
        push({ t, scripted: true, type: 'dingoTrouble', chasers: dingoChasers(idx, lp), side, time: DINGO_TROUBLE.time })
        break
      }
      case 'cobraFlyby': {
        const side: -1 | 1 = rng() < 0.5 ? -1 : 1
        startTimed('cobra', b.story, RIVAL.flybyTime, 'done')
        push({ t, scripted: true, type: 'rival', mode: 'flyby', hp: rivalHp(sector, false), side })
        break
      }
      case 'rivalDuel': {
        const side: -1 | 1 = rng() < 0.5 ? -1 : 1
        startTimed('rivalDuel', b.story, s.final ? RIVAL.finalTime : RIVAL.duelTime, 'escape')
        push({ t, scripted: true, type: 'rival', mode: s.final ? 'final' : 'duel', hp: rivalHp(sector, s.final), side })
        break
      }
      case 'formation': {
        const free = Math.max(0, Math.floor(room(t)) - s.count)
        const n = Math.min(6, s.count + Math.min(extra, free))
        push({ ...base, type: 'formation', kinds: new Array<EnemyKind>(n).fill(s.kind), path: s.path, x: s.x, y: s.y })
        break
      }
      case 'enemy': push({ ...base, type: 'enemy', kind: s.kind, x: s.x, y: s.y }); break
      case 'carrier': push({ ...base, type: 'carrier', x: s.x, y: s.y, missiles }); break
      case 'turrets': push({ ...base, type: 'turrets', xs: s.xs.slice() }); break
      case 'ringGate': {
        const line = ringGateLine(s.n, rng)
        push({ ...base, type: 'ringGate', xs: line.xs, ys: line.ys, spacing: RING_GATE.spacing })
        break
      }
      case 'goldRing': push({ ...base, type: 'goldRing', x: s.x, y: s.y }); break
      case 'capsule': push({ ...base, type: 'capsule', capsule: s.capsule, x: s.x, y: s.y }); break
      case 'obstacle': push({ ...base, type: 'obstacle', obstacle: s.obstacle, x: s.x }); break
      case 'ambush': {
        const n = s.count + (lp >= 2 ? 1 : 0)
        push({ ...base, type: 'ambush', count: n, side: s.side })
        for (let i = 0; i < n; i++) {
          let story: string | undefined
          if (i === 0 && idx === MISSILE_MEET_INDEX && !missileMet) { story = 'meet:missile'; missileMet = true }
          else if (i === 0 && idx === 1 && !metDasher) { story = 'meet:dasher'; metDasher = true }
          pending.push({ at: planned[plan + i]!.at, side: s.side, i, plan: plan + i, story })
        }
        break
      }
      case 'setPiece':
        setPiece = s.phase === 'start' ? s.id : null
        push({ ...base, type: 'setPiece', id: s.id, phase: s.phase })
        break
    }
  }

  function nearBeat(now: number): boolean {
    for (const at of beatTimes) if (Math.abs(at - now) < FILLER.clearOfBeat) return true
    return false
  }

  function filler(dt: number) {
    const tail = t > TRAVEL_TIME - FILLER.tailQuiet
    const pol = setPiece ? SET_PIECE_POLICY[setPiece] : null
    // enemies
    const rate = pol ? pol.enemies : 1
    enemyT -= dt * rate
    if (enemyT <= 0) {
      enemyT = FILLER.enemyEvery * pace * rand(0.75, 1.25)
      if (!tail && !nearBeat(t)) {
        let lead = fillerKind()
        // too late for a hornet to arrive before the tail: a gnat instead
        if (lead === 'dasher' && t + HORNET.warnLead + HORNET_GAP > TRAVEL_TIME - FILLER.tailQuiet) lead = 'drone'
        if (lead === 'dasher') {
          // a lone hornet from behind, announced like an ambush
          if (Math.floor(room(t)) >= 1) {
            const side: -1 | 1 = rng() < 0.5 ? -1 : 1
            push({ t, scripted: false, type: 'ambush', count: 1, side, story: 'warn:behind' })
            queueHornets(1, side)
          }
        } else {
          const n = lead === 'drone' ? formationSize(sector, rng) : Math.min(3, formationSize(sector, rng))
          const m = Math.min(n, Math.floor(room(t)))
          if (m >= 1) {
            const kinds: EnemyKind[] = []
            for (let i = 0; i < m; i++) {
              const k = i === 0 ? lead : fillerKind()
              kinds.push(k === 'dasher' ? 'drone' : k)
            }
            const path = ENTRY_PATHS[Math.floor(rng() * ENTRY_PATHS.length)]!
            push({ t, scripted: false, type: 'formation', kinds, path, x: rand(-0.75, 0.75), y: rand(0.13, 0.87) })
          }
        }
      }
    }
    // obstacles
    obstacleT -= dt
    if (obstacleT <= 0) {
      obstacleT = FILLER.obstacleEvery * pace * rand(0.7, 1.3)
      if (!tail && (!pol || pol.obstacles)) {
        let r = rng()
        let pick: ObstacleKind = mix[mix.length - 1]![0]
        for (const [k, w] of mix) {
          if (r < w) { pick = k; break }
          r -= w
        }
        push({ t, scripted: false, type: 'obstacle', obstacle: pick, x: null })
      }
    }
    // silver rings
    ringT -= dt
    if (ringT <= 0) {
      ringT = rand(FILLER.ringEvery[0], FILLER.ringEvery[1])
      if (!pol || pol.rings) push({ t, scripted: false, type: 'ring', x: rand(-0.8, 0.8), y: rand(0.15, 0.8) })
    }
  }

  return {
    index: idx,
    loop: lp,
    sector,
    get t() { return t },
    get done() { return done },
    get setPiece() { return setPiece },
    resolve(id: SetPieceId, outcome: SetPieceOutcome): boolean {
      if (!timed || timed.id !== id) return false
      resolution = outcome
      return true
    },
    step(dt: number): EncounterEvent[] {
      out.length = 0
      if (done) return out
      t += Math.max(0, dt)
      if (timed && (resolution || t >= timed.until)) endTimed(resolution ?? timed.fallback)
      while (cursor < script.length && script[cursor]!.at <= t) {
        emitBeat(script[cursor]!, beatPlan[cursor]!)
        cursor++
      }
      for (let k = 0; k < pending.length;) {
        const p = pending[k]!
        if (p.at <= t) {
          const x = Math.max(-0.9, Math.min(0.9, p.side * (0.35 + 0.18 * p.i)))
          planned[p.plan]!.done = true
          push({ t, scripted: !p.filler, type: 'enemy', kind: 'dasher', x, y: 0.35 + 0.12 * (p.i % 3), behind: true, missiles, story: p.story })
          pending.splice(k, 1)
        } else k++
      }
      if (t < TRAVEL_TIME) filler(dt)
      else if (timed?.id === 'rivalDuel') {
        // the final duel holds WARNING until it is decided
      } else {
        done = true
        setPiece = null
        push({ t, scripted: true, type: 'warning', boss: BOSSES[idx]!, story: 'boss:warning' })
      }
      return out
    },
  }
}

/** Seconds between hornets of one ambush. */
const HORNET_GAP = 0.35

function specWeight(s: Spec): number {
  switch (s.type) {
    case 'formation': return s.count
    case 'enemy': return 1
    case 'carrier': return 4
    case 'turrets': return s.xs.length
    default: return 0
  }
}

function isEnemySpec(s: Spec): boolean {
  return s.type === 'formation' || s.type === 'enemy' || s.type === 'carrier' || s.type === 'turrets' || s.type === 'ambush'
    || s.type === 'dingoTrouble' || s.type === 'rivalDuel'
}

/** Run a whole sector's travel and collect every event (tests, debug).
 * `onEvent` may play the scene's part, e.g. resolve a set piece. */
export function runEncounter(
  index: number, loop: number, rng: () => number, dt = 1 / 30,
  opts: RunnerOpts & { onEvent?: (ev: EncounterEvent, run: EncounterRunner) => void } = {},
): EncounterEvent[] {
  const run = createEncounterRunner(index, loop, rng, opts)
  const all: EncounterEvent[] = []
  let guard = 0
  while (!run.done && guard++ < 100000) {
    for (const ev of run.step(dt)) {
      all.push(ev)
      opts.onEvent?.(ev, run)
    }
  }
  return all
}

/** Kinds a sector's script introduces on purpose (its signature). */
export function signatureKinds(index: number): readonly EnemyKind[] {
  return SIGNATURE_KINDS[((Math.floor(index) % 5) + 5) % 5]!
}
