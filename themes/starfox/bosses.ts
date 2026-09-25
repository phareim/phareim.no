/**
 * Star Fox sector bosses — pure tables and helpers, no three.js, DOM or Vue,
 * so tests/starfox-balance.test.mjs can pin them (2026-09-25).
 *
 * Each boss has parts (HP per part, which ones count toward the HP bar,
 * which ones kill it, what opens a gated part), phase thresholds on the bar
 * fraction, an enrage threshold, and an attack wheel: every attack has a
 * telegraph (the tell), an active window and a recovery, and names the
 * phases it runs in. The scene steps the wheel with `nextBossAttack` and
 * scales it with `bossTiming`; the pure helpers below answer the fairness
 * questions (which lanes a claw covers, where a stomp wave tops out, which
 * twin is lit) so the tests can prove a safe gap always exists.
 *
 * Lanes: the corridor is five lanes across (balance.ts `LANES`, `laneOf`).
 * ECHO loops scale HP by `bossHpMul` and the clocks by `loopTempo`;
 * telegraphs never drop below TELEGRAPH_MIN.
 */

import type { BossId } from './ids.ts'
import { loopOf } from './ids.ts'
import { LANE, LANES, SHIP_RADIUS, WINGMEN, laneOf, loopTempo, type EnemyKind, type WingId } from './balance.ts'

export type BossPartRole = 'core' | 'claw' | 'panel' | 'knee' | 'twin' | 'turret' | 'eye' | 'heart'

/** What opens a gated part to laser damage. */
export type BossGate =
  | 'always'
  /** Pincer core: only while the maw is open (the roar) */
  | 'roar'
  /** Moth core: once at least one wing panel is gone */
  | 'panelDown'
  /** Furnace core: while kneeling after a knee breaks, always once all knees are gone */
  | 'kneel'
  /** Twins: only the twin whose core is lit */
  | 'lit'
  /** Crown eye: from phase 2; Crown heart: phase 3 */
  | 'phase2'
  | 'phase3'

export interface BossPartDef {
  role: BossPartRole
  /** HP of one part at loop 0 */
  hp: number
  count: number
  /** the boss dies when every fatal part is dead */
  fatal: boolean
  /** counts toward the HP bar (and so toward phases) */
  inBar: boolean
  gate: BossGate
  /** score per part destroyed (fatal parts: the sector bonus pays instead) */
  score: number
}

export type BossAttackId =
  | 'clawSweep' | 'spit' | 'roar' | 'brood'
  | 'dust' | 'sporeMines' | 'wingBeat' | 'swarm'
  | 'stomp' | 'flame' | 'lavaLob' | 'vent'
  | 'aimed' | 'cross' | 'mirrorFan' | 'swap'
  | 'ringVolley' | 'spiral' | 'launch' | 'beam' | 'eyeFan' | 'missiles' | 'debris' | 'rearMines' | 'heartShot'

export interface BossAttackDef {
  id: BossAttackId
  /** seconds of tell before anything dangerous happens */
  telegraph: number
  /** seconds the attack runs */
  active: number
  /** seconds before the next attack's telegraph */
  recover: number
  /** phases (1-based) the attack is in the wheel for */
  phases: readonly number[]
  /** bolts, spawns, … — per-attack knobs */
  params?: Readonly<Record<string, number>>
  /** minions it launches, if any */
  minions?: readonly EnemyKind[]
}

export interface BossDef {
  id: BossId
  /** world z where it parks after the entrance */
  parkZ: number
  entranceSpeed: number
  parts: readonly BossPartDef[]
  /** bar fractions at which phase 2, 3, … begin (descending) */
  phaseAt: readonly number[]
  /** bar fraction at or below which the clock runs at enrageRate */
  enrageAt: number
  enrageRate: number
  wheel: readonly BossAttackDef[]
}

/** No telegraph shrinks below this, however deep the ECHO. */
export const TELEGRAPH_MIN = 0.45

const P = (role: BossPartRole, hp: number, count: number, fatal: boolean, inBar: boolean, gate: BossGate, score: number): BossPartDef =>
  ({ role, hp, count, fatal, inBar, gate, score })

export const BOSS_DEFS: Readonly<Record<BossId, BossDef>> = {
  // THE PINCER — a crab carrier skimming the water. Claws sweep lanes; the
  // core sits in the maw and only takes damage while it roars. Breaking a
  // claw is optional (score, and that claw stops sweeping).
  pincer: {
    id: 'pincer',
    parkZ: -60,
    entranceSpeed: 55,
    parts: [P('core', 80, 1, true, true, 'roar', 0), P('claw', 14, 2, false, false, 'always', 500)],
    phaseAt: [0.5],
    enrageAt: 0.3,
    enrageRate: 1.4,
    wheel: [
      { id: 'clawSweep', telegraph: 0.9, active: 2.05, recover: 0.5, phases: [1, 2] },
      { id: 'spit', telegraph: 0.4, active: 0.6, recover: 0.6, phases: [1, 2], params: { bolts: 3 } },
      { id: 'roar', telegraph: 0.6, active: 2.6, recover: 0.4, phases: [1, 2], params: { fan: 5, spread: 0.8 } },
      { id: 'brood', telegraph: 0.5, active: 0.3, recover: 0.8, phases: [2], minions: ['drone', 'drone'] },
    ],
  },
  // THE MOTH — four wing panels shield the core, shot off one by one; drops
  // spore mines in rows with a gap; wing beats push the ship sideways.
  moth: {
    id: 'moth',
    parkZ: -62,
    entranceSpeed: 50,
    parts: [P('core', 96, 1, true, true, 'panelDown', 0), P('panel', 22, 4, false, true, 'always', 300)],
    phaseAt: [0.5],
    enrageAt: 0.3,
    enrageRate: 1.4,
    wheel: [
      { id: 'dust', telegraph: 0.4, active: 0.8, recover: 0.6, phases: [1, 2], params: { bolts: 4 } },
      { id: 'sporeMines', telegraph: 0.6, active: 1.0, recover: 0.6, phases: [1, 2] },
      { id: 'wingBeat', telegraph: 0.8, active: 1.4, recover: 0.5, phases: [1, 2] },
      { id: 'swarm', telegraph: 0.5, active: 0.3, recover: 0.9, phases: [2], minions: ['weaver', 'weaver'] },
    ],
  },
  // THE FURNACE — a three-legged walker. Stomps roll shockwaves along the
  // ground (fly over them); knees are the weak points; a broken knee drops
  // it to a kneel and opens the belly core.
  furnace: {
    id: 'furnace',
    parkZ: -64,
    entranceSpeed: 40,
    parts: [P('core', 120, 1, true, true, 'kneel', 0), P('knee', 24, 3, false, true, 'always', 400)],
    phaseAt: [0.5],
    enrageAt: 0.3,
    enrageRate: 1.4,
    wheel: [
      { id: 'stomp', telegraph: 0.8, active: 2.0, recover: 0.8, phases: [1, 2] },
      { id: 'flame', telegraph: 0.5, active: 0.9, recover: 0.6, phases: [1, 2], params: { fan: 7, spread: 0.9 } },
      { id: 'lavaLob', telegraph: 0.8, active: 1.2, recover: 0.6, phases: [1, 2], params: { lobs: 3, blast: 2.5 } },
      { id: 'vent', telegraph: 0.5, active: 0.3, recover: 0.9, phases: [2], minions: ['kamikaze', 'kamikaze'] },
    ],
  },
  // THE TWINS — two mirrored ships; only the lit one can be hurt; they
  // swap on a beat and fire crossing walls. Kill both. Phase 2 = one left
  // (use `twinsPhase`, the bar can't tell which twin fell).
  twins: {
    id: 'twins',
    parkZ: -52,
    entranceSpeed: 60,
    parts: [P('twin', 78, 2, true, true, 'lit', 1500)],
    phaseAt: [],
    enrageAt: 0.3,
    enrageRate: 1.4,
    wheel: [
      { id: 'aimed', telegraph: 0.3, active: 0.6, recover: 0.5, phases: [1, 2], params: { bolts: 3 } },
      { id: 'cross', telegraph: 0.6, active: 3.2, recover: 0.6, phases: [1, 2], params: { walls: 4 } },
      { id: 'mirrorFan', telegraph: 0.5, active: 0.6, recover: 0.6, phases: [1, 2], params: { fan: 5, spread: 0.7 } },
      { id: 'swap', telegraph: 0.7, active: 1.0, recover: 0.5, phases: [1] },
    ],
  },
  // THE CROWN — the mothership. Phase 1: a ring of six turrets; phase 2:
  // the eye opens (beam, fans, missiles); phase 3: it runs, and you chase
  // the heart through its own debris.
  crown: {
    id: 'crown',
    parkZ: -70,
    entranceSpeed: 45,
    parts: [
      P('turret', 14, 6, false, true, 'always', 250),
      P('eye', 110, 1, false, true, 'phase2', 1000),
      P('heart', 60, 1, true, true, 'phase3', 0),
    ],
    // derived from the parts in crownPhase(); kept here for the generic path
    phaseAt: [170 / 254, 60 / 254],
    enrageAt: 0.12,
    enrageRate: 1.3,
    wheel: [
      { id: 'ringVolley', telegraph: 0.5, active: 0.8, recover: 0.5, phases: [1], params: { stagger: 0.12 } },
      { id: 'spiral', telegraph: 0.6, active: 2.0, recover: 0.6, phases: [1], params: { bolts: 16, gap: 3, spin: 1.2 } },
      { id: 'launch', telegraph: 0.8, active: 0.4, recover: 1.0, phases: [1], minions: ['dasher', 'dasher'] },
      { id: 'beam', telegraph: 1.0, active: 1.6, recover: 0.6, phases: [2] },
      { id: 'eyeFan', telegraph: 0.5, active: 0.6, recover: 0.6, phases: [2], params: { fan: 9, spread: 1.0 } },
      { id: 'missiles', telegraph: 0.6, active: 0.6, recover: 0.9, phases: [2], params: { count: 3 } },
      { id: 'debris', telegraph: 0.4, active: 1.5, recover: 0.3, phases: [3], params: { every: 0.9 } },
      { id: 'rearMines', telegraph: 0.5, active: 0.6, recover: 0.6, phases: [3], params: { mines: 4 } },
      { id: 'heartShot', telegraph: 0.3, active: 0.6, recover: 0.5, phases: [3], params: { bolts: 3 } },
    ],
  },
}

// ---- scaling -----------------------------------------------------------------

/** Boss HP multiplier: 1 on the first pass, +0.4 per ECHO loop. */
export function bossHpMul(sector: number): number {
  return 1 + 0.4 * loopOf(sector)
}

export type ScaledPart = BossPartDef

/** The boss's parts for an absolute sector, HP scaled (whole numbers). */
export function bossParts(id: BossId, sector: number): ScaledPart[] {
  const mul = bossHpMul(sector)
  return BOSS_DEFS[id].parts.map(p => ({ ...p, hp: Math.max(1, Math.round(p.hp * mul)) }))
}

/** Full HP bar: the sum of every in-bar part. */
export function bossBarMax(id: BossId, sector: number): number {
  let n = 0
  for (const p of bossParts(id, sector)) if (p.inBar) n += p.hp * p.count
  return n
}

/** Current phase (1-based) from the bar fraction. The Crown's thresholds
 * come from its parts; the Twins' phase comes from `twinsPhase`. */
export function bossPhase(id: BossId, barFrac: number, sector = 1): number {
  if (id === 'crown') return crownPhase(barFrac, sector)
  const at = BOSS_DEFS[id].phaseAt
  let phase = 1
  for (const t of at) if (barFrac <= t) phase++
  return phase
}

export function bossEnraged(id: BossId, barFrac: number): boolean {
  return barFrac <= BOSS_DEFS[id].enrageAt
}

/** Scaled timings for one attack: ECHO tempo shortens everything (the
 * telegraph floored at TELEGRAPH_MIN); enrage shortens only the recovery,
 * so a tell never gets shorter than the loop allows. */
export function bossTiming(
  attack: BossAttackDef, sector: number, enraged = false, bossId?: BossId,
): { telegraph: number; active: number; recover: number } {
  const tempo = loopTempo(sector)
  const rate = enraged ? (bossId ? BOSS_DEFS[bossId].enrageRate : 1.4) : 1
  return {
    telegraph: Math.max(TELEGRAPH_MIN, Math.min(attack.telegraph, attack.telegraph / tempo)),
    active: attack.active / tempo,
    recover: attack.recover / (tempo * rate),
  }
}

/** Step the wheel: the next attack at or after `step` that runs in this
 * phase, and the step to continue from. */
export function nextBossAttack(id: BossId, step: number, phase: number): { attack: BossAttackDef; step: number } {
  const wheel = BOSS_DEFS[id].wheel
  const n = wheel.length
  const start = ((Math.floor(step) % n) + n) % n
  for (let k = 0; k < n; k++) {
    const a = wheel[(start + k) % n]!
    if (a.phases.includes(phase)) return { attack: a, step: start + k + 1 }
  }
  // no attack for this phase (should not happen): fall back to the first
  return { attack: wheel[0]!, step: start + 1 }
}

// ---- allied DPS and time-to-kill (retuned 2026-09-25 for three wingmen) --------
// A model, not a measurement: effective damage per second on a boss weak
// point while dodging. Calibrated so the old DREADNOUGHT (55 HP, core open
// most of the fight, a level-1 player plus the single wingman) came out
// near 20 s; not yet checked in play. HP above is set so a typical fight —
// laser TWIN+, three wingmen flying — lands at ~35–60 s, and losing the
// whole squad makes it ~1.5× longer, not a slog.

/** Effective player DPS on a boss weak point by laser level (1–3). */
export const PLAYER_BOSS_DPS = [0, 2.5, 5, 9] as const

/** Share of a wingman's bolts that land during a boss fight. */
export const WING_HIT_SHARE = 0.25

/** Share of a fight each boss's weak points are open and in reach. */
export const BOSS_UPTIME: Readonly<Record<BossId, number>> = {
  pincer: 0.3,
  moth: 0.6,
  furnace: 0.55,
  twins: 0.45,
  crown: 0.55,
}

/** One wingman's effective boss DPS (× 2 under the wing overdrive). */
export function wingmanDps(id: WingId, wingOd = false): number {
  return (WING_HIT_SHARE / WINGMEN[id].fireInterval) * (wingOd ? 2 : 1)
}

/** Allied DPS on a boss: the player at a laser level plus the live wingmen. */
export function alliedDps(laser: number, wingmen: readonly WingId[], wingOd = false): number {
  const lv = Math.max(1, Math.min(3, Math.floor(laser)))
  let d = PLAYER_BOSS_DPS[lv]!
  for (const id of wingmen) d += wingmanDps(id, wingOd)
  return d
}

/** HP the allies must chew through: the whole bar, except the Pincer,
 * whose claws are optional (the bar is its core). */
export function bossEffortHp(id: BossId, sector: number): number {
  return bossBarMax(id, sector)
}

/** Estimated seconds to kill a boss at a given allied DPS. */
export function bossTtk(id: BossId, sector: number, dps: number): number {
  return bossEffortHp(id, sector) / (Math.max(1e-6, dps) * BOSS_UPTIME[id])
}

/** Seconds to kill when the listed wingmen are down at the start of the
 * fight and fly again after their respawn time (the realistic "all
 * three down" case); `squad` is who flies once everyone is back. */
export function bossTtkRecovering(
  id: BossId, sector: number, laser: number,
  squad: readonly WingId[], downAtStart: readonly WingId[],
): number {
  let left = bossEffortHp(id, sector)
  const up = BOSS_UPTIME[id]
  const dt = 0.1
  let t = 0
  while (left > 0 && t < 3600) {
    let d = PLAYER_BOSS_DPS[Math.max(1, Math.min(3, Math.floor(laser)))]!
    for (const w of squad) if (!downAtStart.includes(w) || t >= WINGMEN[w].respawn) d += wingmanDps(w)
    left -= d * up * dt
    t += dt
  }
  return t
}

// ---- THE PINCER --------------------------------------------------------------

/** Claw sweep timings after the telegraph (seconds at tempo 1). */
export const PINCER_CLAW = { extend: 0.9, hold: 0.55, retract: 0.6 } as const

/** How far each claw reaches, in lanes from its own edge. */
export interface ClawPattern { left: number; right: number }

const PINCER_P1: readonly ClawPattern[] = [{ left: 3, right: 0 }, { left: 0, right: 3 }]
const PINCER_P2: readonly ClawPattern[] = [{ left: 3, right: 1 }, { left: 1, right: 3 }, { left: 2, right: 2 }]

/** The sweep for this attack: one claw at a time in phase 1, both in
 * phase 2, a broken claw reaching nowhere. The reach sum never exceeds
 * LANES − 1, so one lane always stays open. */
export function pincerPattern(step: number, phase: number, clawsAlive: readonly [boolean, boolean] = [true, true]): ClawPattern {
  const list = phase >= 2 ? PINCER_P2 : PINCER_P1
  const p = list[((Math.floor(step) % list.length) + list.length) % list.length]!
  return { left: clawsAlive[0] ? p.left : 0, right: clawsAlive[1] ? p.right : 0 }
}

export type SweepStage = 'telegraph' | 'extend' | 'hold' | 'retract' | 'done'

export interface ClawSweep {
  stage: SweepStage
  /** lanes covered right now from the left edge */
  left: number
  /** lanes covered right now from the right edge */
  right: number
}

/** Lane coverage of a claw sweep `t` s after the attack began (telegraph
 * included). Claws cover lanes one by one from their edge while extending.
 * Writes into `out`. */
export function pincerClawSweep(
  t: number, pattern: ClawPattern, sector = 1,
  out: ClawSweep = { stage: 'telegraph', left: 0, right: 0 },
): ClawSweep {
  const tempo = loopTempo(sector)
  const tele = Math.max(TELEGRAPH_MIN, BOSS_DEFS.pincer.wheel[0]!.telegraph / tempo)
  const ext = PINCER_CLAW.extend / tempo
  const hold = PINCER_CLAW.hold / tempo
  const ret = PINCER_CLAW.retract / tempo
  let f = 0
  if (t < tele) { out.stage = 'telegraph'; f = 0 }
  else if (t < tele + ext) { out.stage = 'extend'; f = (t - tele) / ext }
  else if (t < tele + ext + hold) { out.stage = 'hold'; f = 1 }
  else if (t < tele + ext + hold + ret) { out.stage = 'retract'; f = 1 - (t - tele - ext - hold) / ret }
  else { out.stage = 'done'; f = 0 }
  out.left = f <= 0 ? 0 : Math.min(pattern.left, Math.ceil(f * pattern.left))
  out.right = f <= 0 ? 0 : Math.min(pattern.right, Math.ceil(f * pattern.right))
  return out
}

/** Is `lane` inside a claw right now? */
export function clawCovers(sweep: ClawSweep, lane: number): boolean {
  return lane < sweep.left || lane >= LANES - sweep.right
}

/** Lanes open at full extension — where to be when the claws close. */
export function pincerSafeLanes(pattern: ClawPattern): number[] {
  const out: number[] = []
  for (let l = 0; l < LANES; l++) if (l >= pattern.left && l < LANES - pattern.right) out.push(l)
  return out
}

// ---- THE MOTH ----------------------------------------------------------------

/** Wing-beat gust: lateral push (units/s) at full wings, ramping in and
 * out; well under the ship's 13 u/s, so steering always wins. */
export const MOTH_PUSH = { max: 6.5, ramp: 0.25 } as const

/** Lateral push `t` s into the active window of a wing beat (dir ±1),
 * scaled by the panels still on (a bare moth still gusts a little). */
export function mothWingPush(t: number, active: number, panelsAlive: number, dir: 1 | -1): number {
  if (t < 0 || t > active) return 0
  const rampIn = Math.min(1, t / MOTH_PUSH.ramp)
  const rampOut = Math.min(1, (active - t) / MOTH_PUSH.ramp)
  const wings = 0.25 + 0.75 * Math.max(0, Math.min(4, panelsAlive)) / 4
  return dir * MOTH_PUSH.max * wings * Math.min(rampIn, rampOut)
}

/** Lanes a spore-mine row covers (true = mine): three mines in phase 1
 * (two open lanes), four in phase 2 (one open lane); the gap walks. */
export function mothSporeRow(step: number, phase: number): boolean[] {
  const row = new Array<boolean>(LANES).fill(true)
  const gaps = phase >= 2 ? 1 : 2
  const g = ((Math.floor(step) * 2 + 1) % LANES + LANES) % LANES
  for (let k = 0; k < gaps; k++) row[(g + k) % LANES] = false
  return row
}

export function mothCoreExposed(panelsAlive: number): boolean {
  return panelsAlive < 4
}

// ---- THE FURNACE -------------------------------------------------------------

/** Stomp shockwaves: they roll along the ground toward the ship. A wave
 * tops out at `groundY + height`; fly above it. */
export const FURNACE_WAVE = { groundY: -2.6, height: 3.2, speed: 34 } as const
/** A broken knee drops the walker: the belly opens for `open` s and the
 * wheel pauses for `stun` s. */
export const FURNACE_KNEEL = { open: 5, stun: 2 } as const

export interface Stomp {
  /** seconds after the telegraph ends */
  at: number
  /** 0–2 */
  leg: number
  /** wave speed toward the ship (units/s, relative) */
  speed: number
  /** world y of the wave's top */
  top: number
}

/** The stomps of one stomp attack: three legs 0.75 s apart in phase 1,
 * four stomps 0.6 s apart in phase 2, tighter in ECHO but never under
 * 0.5 s. Legs whose knee is broken don't stomp. */
export function furnaceStompSchedule(
  sector: number, phase: number, kneesAlive: readonly boolean[] = [true, true, true],
): Stomp[] {
  const tempo = loopTempo(sector)
  const gap = Math.max(0.5, (phase >= 2 ? 0.6 : 0.75) / tempo)
  const n = phase >= 2 ? 4 : 3
  const speed = FURNACE_WAVE.speed + 4 * loopOf(sector)
  const top = FURNACE_WAVE.groundY + FURNACE_WAVE.height
  const legs = [0, 1, 2].filter(l => kneesAlive[l] !== false)
  const out: Stomp[] = []
  if (legs.length === 0) return out
  for (let i = 0; i < n; i++) out.push({ at: i * gap, leg: legs[i % legs.length]!, speed, top })
  return out
}

/** Does a wave at the ship's plane hit a ship at height y? */
export function shockwaveHits(waveTop: number, shipY: number): boolean {
  return shipY - SHIP_RADIUS < waveTop
}

export function furnaceCoreOpen(kneesAlive: number, kneelT: number): boolean {
  return kneesAlive <= 0 || kneelT > 0
}

// ---- THE TWINS ---------------------------------------------------------------

/** Seconds between swaps (the lit core moves to the other twin); a warn
 * blink runs for `warn` s before each swap. */
export const TWINS_BEAT = { base: 4, min: 2.4, warn: 0.6 } as const

export function twinsBeat(sector: number): number {
  return Math.max(TWINS_BEAT.min, TWINS_BEAT.base / loopTempo(sector))
}

/** Which twin is lit `t` s into the fight, and whether the swap tell is
 * showing. A lone survivor is always lit. */
export function twinsLit(
  t: number, beat: number, alive: readonly [boolean, boolean] = [true, true],
): { lit: 0 | 1; warn: boolean } {
  if (alive[0] && !alive[1]) return { lit: 0, warn: false }
  if (!alive[0] && alive[1]) return { lit: 1, warn: false }
  const k = Math.floor(Math.max(0, t) / beat)
  const into = Math.max(0, t) - k * beat
  return { lit: (k % 2) as 0 | 1, warn: into >= beat - TWINS_BEAT.warn }
}

export function twinsPhase(alive: readonly [boolean, boolean]): number {
  return alive[0] && alive[1] ? 1 : 2
}

/** Crossing walls: each twin fires a wall of bolts covering every lane but
 * one; consecutive walls' gaps are at most two lanes apart, and the time
 * between walls is enough to get there. */
const CROSS_GAPS: readonly (readonly number[])[] = [
  [1, 3, 2, 0],
  [3, 1, 2, 4],
  [2, 0, 1, 3],
  [2, 4, 3, 1],
  [0, 2, 4, 2],
  [4, 2, 0, 2],
]

/** Gap lane of each wall in cross attack number `step`. */
export function twinsCrossGaps(step: number, walls = 4): number[] {
  const g = CROSS_GAPS[((Math.floor(step) % CROSS_GAPS.length) + CROSS_GAPS.length) % CROSS_GAPS.length]!
  const out: number[] = []
  for (let i = 0; i < walls; i++) out.push(g[i % g.length]!)
  return out
}

/** Seconds between walls (floored so two lanes stay reachable). */
export function twinsWallGap(sector: number): number {
  return Math.max(0.8, 1.0 / loopTempo(sector))
}

// ---- THE CROWN ---------------------------------------------------------------

/** Crown phase from the bar fraction: 1 while turrets stand, 2 once they
 * are all down (the eye opens), 3 once the eye is gone (the chase). The
 * thresholds come from the scaled parts, so they are exact at any loop. */
export function crownPhase(hpFrac: number, sector = 1): number {
  const parts = bossParts('crown', sector)
  const eye = parts.find(p => p.role === 'eye')!
  const heart = parts.find(p => p.role === 'heart')!
  const max = bossBarMax('crown', sector)
  if (hpFrac <= heart.hp / max) return 3
  if (hpFrac <= (eye.hp + heart.hp) / max) return 2
  return 1
}

/** The eye beam: after a sightline tell it sweeps across the lanes at
 * `lanesPerSec` (slower than the ship crosses them), `width` lanes wide. */
export const CROWN_BEAM = { lanesPerSec: 1.8, width: 1 } as const

/** Where the beam is `t` s into its active window: the lane position of
 * its centre (float, 0…LANES−1) sweeping from `fromLeft`'s edge. */
export function crownBeamLane(t: number, fromLeft: boolean): number {
  const x = Math.max(0, Math.min(LANES - 1, t * CROWN_BEAM.lanesPerSec))
  return fromLeft ? x : LANES - 1 - x
}

/** Phase 3: the Crown runs, the corridor speeds up, debris falls from it. */
export const CROWN_CHASE = { fleeZ: -95, speedMul: 1.25, debrisEvery: 0.9, rearMinesEvery: 2.2 } as const

/** The safe band above a stomp wave — exported for the tests' sake. */
export function furnaceSafeBand(): number {
  return LANE.yHi - (FURNACE_WAVE.groundY + FURNACE_WAVE.height + SHIP_RADIUS)
}

// ---- the fight in play: the wheel clock, the bar, lane helpers ------------------
// Pure pieces of scene/boss.ts, here so tests/starfox-bosses.test.mjs can
// pin them (2026-09-25).

export type WheelStage = 'telegraph' | 'active' | 'recover'
export type ClockEvent = 'begin' | 'active' | 'recover' | null

/** The attack wheel as a clock: telegraph → active → recover → next. */
export interface BossClock {
  /** wheel position for `nextBossAttack` */
  step: number
  /** the running attack; null before the first */
  attack: BossAttackDef | null
  stage: WheelStage
  /** seconds into the current stage */
  t: number
  /** length of the current stage */
  dur: number
  /** seconds since the running attack's telegraph began */
  atkT: number
  /** seconds the wheel is frozen (the Furnace kneeling) */
  stun: number
  timing: { telegraph: number; active: number; recover: number }
}

/** A clock whose first attack begins after `firstDelay` s. */
export function createBossClock(firstDelay = 1.2): BossClock {
  return { step: 0, attack: null, stage: 'recover', t: 0, dur: firstDelay, atkT: 0, stun: 0, timing: { telegraph: 0, active: 0, recover: firstDelay } }
}

/** Advance the clock; returns the stage the wheel just entered, if any.
 * The next attack is picked for the phase at the moment it begins. */
export function tickBossClock(
  c: BossClock, id: BossId, dt: number, phase: number, sector: number, enraged: boolean,
): ClockEvent {
  if (c.stun > 0) {
    c.stun = Math.max(0, c.stun - dt)
    return null
  }
  c.t += dt
  if (c.attack) c.atkT += dt
  if (c.t < c.dur) return null
  c.t = Math.min(c.t - c.dur, 0.25)
  if (c.attack && c.stage === 'telegraph') {
    c.stage = 'active'
    c.dur = c.timing.active
    return 'active'
  }
  if (c.attack && c.stage === 'active') {
    c.stage = 'recover'
    c.dur = c.timing.recover
    return 'recover'
  }
  const n = nextBossAttack(id, c.step, phase)
  c.step = n.step
  c.attack = n.attack
  c.atkT = c.t
  const tm = bossTiming(n.attack, sector, enraged, id)
  c.timing.telegraph = tm.telegraph
  c.timing.active = tm.active
  c.timing.recover = tm.recover
  c.stage = 'telegraph'
  c.dur = tm.telegraph
  return 'begin'
}

/** Freeze the wheel for `s` s and drop the running attack; the next one
 * begins after the stun plus a short breath. */
export function stunBossClock(c: BossClock, s: number): void {
  c.stun = Math.max(c.stun, s)
  c.attack = null
  c.stage = 'recover'
  c.t = 0
  c.dur = 0.6
  c.atkT = 0
}

/** One live part's bookkeeping, as far as the bar cares. */
export interface BarPart { hp: number; inBar: boolean; fatal: boolean }

/** The order parts give up HP when the bar is set by hand (the debug
 * hook): the breakable in-bar parts first, then the fatal ones, each
 * group in part order. Parts outside the bar never drain. */
export function drainOrder(parts: readonly BarPart[]): number[] {
  const out: number[] = []
  for (let i = 0; i < parts.length; i++) if (parts[i]!.inBar && !parts[i]!.fatal) out.push(i)
  for (let i = 0; i < parts.length; i++) if (parts[i]!.inBar && parts[i]!.fatal) out.push(i)
  return out
}

/** New HP per part so the bar holds `target` (clamped to 0…current),
 * drained in `drainOrder`. */
export function drainTo(parts: readonly BarPart[], target: number): number[] {
  const hp = parts.map(p => p.hp)
  let bar = 0
  for (const p of parts) if (p.inBar) bar += p.hp
  let take = Math.max(0, bar - Math.max(0, target))
  for (const i of drainOrder(parts)) {
    if (take <= 0) break
    const d = Math.min(hp[i]!, take)
    hp[i]! -= d
    take -= d
  }
  return hp
}

/** Lane (0–4) of a world x at a corridor half-width. */
export function laneAt(x: number, halfWidth: number): number {
  return laneOf(x / Math.max(1e-6, halfWidth))
}

/** Float lane position (0 = left edge's centre … 4) of a world x. */
export function laneFloat(x: number, halfWidth: number): number {
  const u = (Math.max(-1, Math.min(1, x / Math.max(1e-6, halfWidth))) + 1) / 2
  return u * LANES - 0.5
}

/** World x of a lane's centre. */
export function laneX(lane: number, halfWidth: number): number {
  return (-1 + (2 * (lane + 0.5)) / LANES) * halfWidth
}

/** Does the eye beam (centre at float lane `beam`) touch a ship at float
 * lane `ship`? The ship's radius is counted in lanes at that width. */
export function crownBeamHits(beam: number, ship: number, halfWidth: number): boolean {
  const shipLanes = SHIP_RADIUS / ((2 * halfWidth) / LANES)
  return Math.abs(beam - ship) < CROWN_BEAM.width / 2 + shipLanes * 0.6
}

/** Which way the beam sweeps: it starts on the ship's side of the
 * corridor, so the ship outruns it toward the far side. */
export function crownBeamFromLeft(shipLane: number): boolean {
  return shipLane < (LANES - 1) / 2
}

/** Phase-3 rear mines: `mines` mines in distinct lanes, never all five;
 * the open lane walks with `step`. */
export function crownRearMineLanes(step: number, mines = 4): boolean[] {
  const n = Math.max(0, Math.min(LANES - 1, Math.floor(mines)))
  const gap = ((Math.floor(step) * 3 + 2) % LANES + LANES) % LANES
  const row = new Array<boolean>(LANES).fill(false)
  for (let k = 1; k <= n; k++) row[(gap + k) % LANES] = true
  return row
}

/** Twins' crossing wall: does it cover the ship at world x? A wall covers
 * every lane but `gap`; the ship is safe while its hull is inside the gap
 * lane (a little grace at the edges). */
export function twinsWallHits(gap: number, x: number, halfWidth: number): boolean {
  const w = (2 * halfWidth) / LANES
  const cx = laneX(gap, halfWidth)
  // the edge lanes run on past the corridor's edge
  if (gap === 0 && x < cx) return false
  if (gap === LANES - 1 && x > cx) return false
  return Math.abs(x - cx) > w / 2 - SHIP_RADIUS * 0.35
}
