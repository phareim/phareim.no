/**
 * Star Fox balance — pure tuning with no three.js, DOM or Vue imports, so
 * plain `node --test` can exercise it. Flight.vue imports the constants and
 * wires them to the scene; tests/starfox-balance.test.mjs pins them.
 *
 * The contract (decided 2026-09-08): a 100 HP health meter instead of
 * single lives, rings heal, endless sectors (~80 s of travel, then a
 * WARNING and a gunship boss with its own HP), and fiercer enemies paid
 * for by the HP buffer.
 *
 * Expanded 2026-09-08: a full bestiary (weaver/dasher/bulwark/splitter/
 * mite past sector 1), mines + arches as extra obstacles, a hittable AI
 * wingman that respawns, and a boss scaled up to match (~+60 % allied
 * DPS, net harder).
 *
 * Redesign 2026-09-25 (OPERATION NIGHTLIGHT): three new kinds (carrier,
 * turret, missile), display names, per-kind behaviour as data, lane
 * helpers for fairness checks, per-sector pick tables with ECHO loops.
 * The five sector bosses live in bosses.ts, power-ups in arsenal.ts, the
 * scripted travel in encounters.ts. The DREADNOUGHT block below stays
 * until Flight.vue moves to bosses.ts.
 */

import { loopOf, sectorIndex } from './ids.ts'

/** Display name of the sector boss. */
export const BOSS_NAME = 'DREADNOUGHT'

/** Full health. Damage and healing below are tuned against this. */
export const HP_MAX = 100

/** Contact / bolt damage by source. */
export const DMG = {
  /** aimed enemy bolt */
  bolt: 12,
  /** enemy rams the ship */
  ram: 25,
  /** ground pillar */
  pillar: 20,
  /** floating rock */
  rock: 20,
  /** boss aimed bolt */
  bossBolt: 12,
  /** boss spread fan, per bolt */
  bossSpread: 10,
  /** ramming the boss hull (discouraged, not fatal by itself) */
  bossRam: 30,
  /** homing missile (carriers, hornets in space and ECHO) */
  missile: 16,
  /** a Pincer claw sweeping through the ship's lane */
  claw: 25,
  /** a Furnace stomp shockwave rolling under a ship flying too low */
  shockwave: 18,
  /** a Furnace lava lob landing on the ship */
  lob: 16,
  /** the Crown's eye beam, per contact */
  beam: 20,
  /** a mine or spore mine going off next to the ship */
  mine: 20,
} as const

export type DamageSource = keyof typeof DMG

/** Rings heal — the risk/reward loop: fly through danger to recover. */
export const HEAL_RING = 12
/** Sector-clear bonus heal when the boss dies. */
export const HEAL_CLEAR = 40

/** Seconds of TRAVEL flight before the WARNING banner. */
export const TRAVEL_TIME = 80
/** Seconds the WARNING banner holds while the field drains. */
export const WARNING_TIME = 2.5
/** Seconds the CLEAR banner holds before the next sector. */
export const CLEAR_TIME = 3

export type SectorPhase = 'travel' | 'warning' | 'boss' | 'clear'

/**
 * The endless loop, as a pure step: TRAVEL drains into WARNING, WARNING
 * releases the boss, CLEAR (after the kill) rolls the next sector. The
 * boss→clear edge lives in the scene (killBoss), not here.
 */
export function advanceSector(phase: SectorPhase, phaseT: number): SectorPhase {
  if (phase === 'travel' && phaseT >= TRAVEL_TIME) return 'warning'
  if (phase === 'warning' && phaseT >= WARNING_TIME) return 'boss'
  if (phase === 'clear' && phaseT >= CLEAR_TIME) return 'travel'
  return phase
}

/** Boss core hits to kill: 55 on sector 1, +20 per sector after.
 * Retuned 2026-09-08 for the wingman (allied DPS ≈ +60 % of a level-1
 * player): the extra 15 base + 5/sector over the old 40 + 15 keeps
 * time-to-kill roughly flat while the fiercer wheel (below) makes the
 * fight itself harder. */
export function bossMaxHp(sector: number): number {
  return 55 + 20 * (Math.max(1, Math.floor(sector)) - 1)
}

/** Seconds between boss attacks: fiercer every sector. */
export function bossAttackInterval(sector: number): number {
  const s = Math.max(1, Math.floor(sector))
  return s >= 3 ? 1.15 : s >= 2 ? 1.35 : 1.6
}

/** Enrage multiplier on the attack clock below 30 % core health. */
export const BOSS_ENRAGE_RATE = 1.5

/** Bolts in the boss spread fan per sector. */
export function bossFanCount(sector: number): number {
  const s = Math.max(1, Math.floor(sector))
  return s >= 3 ? 9 : s >= 2 ? 7 : 5
}

/** Full width of the spread fan (lateral direction units). */
export function bossFanSpread(sector: number): number {
  const s = Math.max(1, Math.floor(sector))
  return s >= 3 ? 1.0 : s >= 2 ? 0.85 : 0.7
}

/** Minion screen per sector: pairs of [kind, lateral offset]. */
export function bossMinions(sector: number): { kind: EnemyKind; dx: number }[] {
  const s = Math.max(1, Math.floor(sector))
  const out: { kind: EnemyKind; dx: number }[] = [
    { kind: 'drone', dx: -6 },
    { kind: 'drone', dx: 6 },
  ]
  if (s >= 2) out.push({ kind: 'weaver', dx: -9 }, { kind: 'sniper', dx: 9 })
  if (s >= 3) out.push({ kind: 'bulwark', dx: 0 }, { kind: 'kamikaze', dx: -3 })
  return out
}

/** Steps in the boss attack wheel: aimed → fan → minions → mine-seed. */
export const BOSS_WHEEL_LEN = 4

/** Sector backdrop palette: mountains, grid and fog shift per sector. */
export interface SectorPalette {
  /** mountain face fill */
  face: number
  /** mountain wireframe edge */
  edge: number
  /** grid line colour (the magenta accent) */
  grid: number
  /** fog colour */
  fog: number
  /** sky horizon band */
  sky: number
}

const SECTOR_PALETTES: SectorPalette[] = [
  // 1 — violet dusk (the original look)
  { face: 0x0d0718, edge: 0xb169f5, grid: 0xff2fa0, fog: 0x1a0b2e, sky: 0x6b1450 },
  // 2 — emerald night
  { face: 0x06180f, edge: 0x3ff5a5, grid: 0x2df5a0, fog: 0x06231a, sky: 0x0d5a3c },
  // 3 — ember storm
  { face: 0x1c0a06, edge: 0xff7a3f, grid: 0xff5a3f, fog: 0x2b0e06, sky: 0x7a2a10 },
  // 4 — deep azure
  { face: 0x080e24, edge: 0x5aa5ff, grid: 0xb12fff, fog: 0x0a1030, sky: 0x1c2a6b },
]

export function sectorPalette(sector: number): SectorPalette {
  const s = Math.max(1, Math.floor(sector))
  return SECTOR_PALETTES[(s - 1) % SECTOR_PALETTES.length]!
}

/** Score bonus for killing the sector boss. */
export function sectorClearBonus(sector: number): number {
  return 1000 * Math.max(1, Math.floor(sector))
}

/** Aimed-shot interval range (s): sectors shoot sooner, floored at 0.7. */
export function enemyFireInterval(sector: number): { lo: number; hi: number } {
  const cut = 0.15 * (Math.max(1, sector) - 1)
  return { lo: Math.max(0.7, 1.6 - cut), hi: Math.max(0.9, 2.8 - cut) }
}

/** Extra bolt speed per sector past the first. */
export function boltSpeedBonus(sector: number): number {
  return 7 * (Math.max(1, sector) - 1)
}

/** Share of spawned enemies that shoot back. */
export function enemyShootChance(sector: number): number {
  return Math.min(0.95, 0.65 + 0.06 * (Math.max(1, sector) - 1))
}

/** Formation size, 2–3 on sector 1, up to 5 later (absolute sector, so
 * every ECHO sector gets the full 2–5). */
export function formationSize(sector: number, rng: () => number = Math.random): number {
  const max = sector >= 3 ? 5 : sector >= 2 ? 4 : 3
  return 2 + Math.floor(rng() * (max - 1))
}

/** Enemy kinds (ids stable: the wingman AI and story key on them).
 * Display names: drone GNAT, kamikaze SPIKE, weaver MANTA, sniper LANCER,
 * dasher HORNET, bulwark BULWARK, splitter POD, mite MITE, plus CARRIER,
 * TURRET, MISSILE and the rival, MEGA COBRA. Mites spawn from pods, gnats from carriers, missiles
 * from carriers and hornets; turrets and carriers come from the encounter
 * script, and so does the rival. `pickEnemyKind` never returns mite,
 * carrier, turret, missile or rival. */
export type EnemyKind =
  | 'drone'
  | 'sniper'
  | 'kamikaze'
  | 'weaver'
  | 'dasher'
  | 'bulwark'
  | 'splitter'
  | 'mite'
  | 'carrier'
  | 'turret'
  | 'missile'
  | 'rival'

export const ENEMY_KINDS: readonly EnemyKind[] = [
  'drone', 'sniper', 'kamikaze', 'weaver', 'dasher', 'bulwark', 'splitter', 'mite', 'carrier', 'turret', 'missile', 'rival',
]

/** Per-kind stats: hits to kill, score value, HUD/intercom name. */
export const ENEMY_STATS: Record<EnemyKind, { hp: number; score: number; name: string }> = {
  drone: { hp: 1, score: 100, name: 'GNAT' },
  sniper: { hp: 1, score: 120, name: 'LANCER' },
  kamikaze: { hp: 1, score: 130, name: 'SPIKE' },
  weaver: { hp: 1, score: 140, name: 'MANTA' },
  dasher: { hp: 1, score: 150, name: 'HORNET' },
  bulwark: { hp: 3, score: 300, name: 'BULWARK' },
  splitter: { hp: 2, score: 200, name: 'POD' },
  mite: { hp: 1, score: 50, name: 'MITE' },
  carrier: { hp: 14, score: 1200, name: 'CARRIER' },
  turret: { hp: 3, score: 250, name: 'TURRET' },
  missile: { hp: 1, score: 60, name: 'MISSILE' },
  /** MEGA COBRA's fighter; HP per duel comes from `rivalHp` */
  rival: { hp: 40, score: 5000, name: 'MEGA COBRA' },
}

/** Kinds the random pick may return; the rest are scripted or launched. */
export const PICKABLE_KINDS: readonly EnemyKind[] = [
  'drone', 'sniper', 'kamikaze', 'weaver', 'dasher', 'bulwark', 'splitter',
]

/** First-pass pick weights per sector index (0 coast … 4 space). Coast is
 * gnats only (onboarding); woods keeps the old sector-2 mix, ember the old
 * sector-3 mix; lake leans on lancers, space on hornets. Order matters:
 * the rng walks the entries in this order. */
const PICK_FIRST: readonly (readonly [EnemyKind, number][])[] = [
  [['drone', 1]],
  [['weaver', 0.22], ['dasher', 0.18], ['sniper', 0.20], ['drone', 0.40]],
  [['bulwark', 0.10], ['splitter', 0.10], ['kamikaze', 0.14], ['sniper', 0.16], ['weaver', 0.16], ['dasher', 0.14], ['drone', 0.20]],
  [['bulwark', 0.10], ['splitter', 0.08], ['kamikaze', 0.12], ['sniper', 0.24], ['weaver', 0.12], ['dasher', 0.12], ['drone', 0.22]],
  [['bulwark', 0.08], ['splitter', 0.10], ['kamikaze', 0.14], ['sniper', 0.12], ['weaver', 0.12], ['dasher', 0.22], ['drone', 0.22]],
]

/** ECHO pick weights: the whole bestiary everywhere, each sector keeping
 * a lean toward its own signature. */
const PICK_ECHO: readonly (readonly [EnemyKind, number][])[] = [
  [['bulwark', 0.08], ['splitter', 0.10], ['kamikaze', 0.18], ['sniper', 0.12], ['weaver', 0.12], ['dasher', 0.12], ['drone', 0.28]],
  [['bulwark', 0.08], ['splitter', 0.08], ['kamikaze', 0.12], ['sniper', 0.16], ['weaver', 0.22], ['dasher', 0.18], ['drone', 0.16]],
  [['bulwark', 0.14], ['splitter', 0.14], ['kamikaze', 0.14], ['sniper', 0.14], ['weaver', 0.12], ['dasher', 0.12], ['drone', 0.20]],
  [['bulwark', 0.12], ['splitter', 0.08], ['kamikaze', 0.12], ['sniper', 0.24], ['weaver', 0.12], ['dasher', 0.12], ['drone', 0.20]],
  [['bulwark', 0.10], ['splitter', 0.10], ['kamikaze', 0.14], ['sniper', 0.12], ['weaver', 0.12], ['dasher', 0.24], ['drone', 0.18]],
]

/** The weighted table `pickEnemyKind` uses for an absolute sector. */
export function pickTable(sector: number): readonly (readonly [EnemyKind, number])[] {
  const i = sectorIndex(sector)
  return loopOf(sector) > 0 ? PICK_ECHO[i]! : PICK_FIRST[i]!
}

/** Random filler kind for an absolute sector (6 = ECHO I coast). */
export function pickEnemyKind(sector: number, rng: () => number = Math.random): EnemyKind {
  const table = pickTable(sector)
  if (table.length === 1) return table[0]![0]
  let total = 0
  for (const [, w] of table) total += w
  let r = rng() * total
  for (const [kind, w] of table) {
    if (r < w) return kind
    r -= w
  }
  return table[table.length - 1]![0]
}

/** Kinds each sector introduces (index 0–4). The encounter script meets
 * each one on purpose (a `meet:<kind>` cue) before filler uses it. */
export const SIGNATURE_KINDS: readonly (readonly EnemyKind[])[] = [
  ['drone', 'kamikaze'],
  ['weaver', 'sniper', 'dasher'],
  ['turret', 'bulwark', 'splitter'],
  ['carrier'],
  ['missile'],
]

/** Carriers and hornets carry missiles in THE HOLLOW CROWN and every ECHO. */
export function firesMissiles(sector: number): boolean {
  return sectorIndex(sector) === 4 || loopOf(sector) > 0
}

/** ECHO multiplier for counts and HP: 1 on the first pass, +0.25 a loop. */
export function echoMul(sector: number): number {
  return 1 + 0.25 * loopOf(sector)
}

/** ECHO tempo: attack clocks run this much faster (telegraphs are floored
 * separately), 1 on the first pass, capped at 1.6. */
export function loopTempo(sector: number): number {
  return Math.min(1.6, 1 + 0.15 * loopOf(sector))
}

// ---- the corridor, in the units Flight.vue uses ------------------------------

/** Flight lane and corridor bounds (world units; ship at z = 0). */
export const LANE = {
  /** lateral half-width on a landscape screen */
  xWide: 11,
  /** lateral half-width on a portrait phone */
  xPortrait: 6.5,
  yLo: -1.5,
  yHi: 6,
  spawnZ: -230,
  killZ: 18,
} as const

/** Ship steering speed (units/s) with the keyboard. */
export const SHIP_SPEED = { x: 13, y: 11 } as const

/** Ship hit radius against bolts and hazards. */
export const SHIP_RADIUS = 1.2

/** Boss fairness counts the corridor as five lanes across. */
export const LANES = 5

/** Lane 0–4 of a normalised x (−1 … 1 across the corridor). */
export function laneOf(xNorm: number): number {
  const i = Math.floor(((Math.max(-1, Math.min(1, xNorm)) + 1) / 2) * LANES)
  return Math.min(LANES - 1, Math.max(0, i))
}

/** Normalised x of a lane's centre. */
export function laneCenter(lane: number): number {
  return -1 + (2 * (lane + 0.5)) / LANES
}

/** Lanes per second the ship can cross at a corridor half-width. */
export function shipLaneRate(halfWidth: number = LANE.xWide): number {
  return SHIP_SPEED.x / ((2 * halfWidth) / LANES)
}

/** World y of a normalised height (0 = lane floor, 1 = lane ceiling). */
export function laneY(u: number): number {
  return LANE.yLo + (LANE.yHi - LANE.yLo) * u
}

// ---- per-kind behaviour ------------------------------------------------------
// Distances are world units, times seconds, speeds units/s. `driftMul` is
// the share of the corridor speed a kind closes on the ship with.

/** GNAT formation entry paths: curved legs from the sides and above into
 * the formation slot, in normalised lane space (x −1…1, y 0…1; values
 * past the edges start off screen). */
export type EntryPath = 'dropTop' | 'sweepLeft' | 'sweepRight' | 'hookLeft' | 'hookRight' | 'arc'

export const ENTRY_PATHS: readonly EntryPath[] = ['dropTop', 'sweepLeft', 'sweepRight', 'hookLeft', 'hookRight', 'arc']

interface EntryCurve {
  /** start point; `null` x means "above the slot" */
  from: [number | null, number]
  /** first control point, absolute; `side` mirrors x by the slot's side */
  c1: [number, number]
  /** second control point, relative to the slot */
  c2: [number, number]
  side?: boolean
}

const ENTRY_CURVES: Record<EntryPath, EntryCurve> = {
  dropTop: { from: [null, 1.9], c1: [0, 1.6], c2: [0, 0.35] },
  sweepLeft: { from: [-1.8, 0.6], c1: [-1.0, 1.1], c2: [-0.5, 0.2] },
  sweepRight: { from: [1.8, 0.6], c1: [1.0, 1.1], c2: [0.5, 0.2] },
  hookLeft: { from: [-1.8, 0.1], c1: [0.4, -0.1], c2: [0.6, 0.3] },
  hookRight: { from: [1.8, 0.1], c1: [-0.4, -0.1], c2: [-0.6, 0.3] },
  arc: { from: [0, 1.9], c1: [1.3, 1.4], c2: [0, 0.3], side: true },
}

export const GNAT = {
  /** seconds from spawn to the formation slot */
  entryTime: 1.6,
  /** delay between formation members */
  stagger: 0.18,
  /** normalised spacing between slots */
  slotSpacing: 0.3,
  /** normalised height step of the V */
  rowDy: 0.12,
  driftMul: 0.6,
} as const

/** Point on a gnat's entry curve at progress u (0…1) toward its slot,
 * normalised. u = 1 is exactly the slot. Writes into `out`. */
export function gnatEntry(
  path: EntryPath, u: number, slotX: number, slotY: number,
  out: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const c = ENTRY_CURVES[path]
  const t = Math.max(0, Math.min(1, u))
  const e = t * t * (3 - 2 * t)
  const side = c.side ? (slotX < 0 ? -1 : 1) : 1
  const p0x = c.from[0] === null ? slotX : c.from[0] * side
  const p0y = c.from[1]
  const p1x = c.c1[0] * side
  const p1y = c.c1[1]
  const p2x = slotX + c.c2[0]
  const p2y = slotY + c.c2[1]
  const k = 1 - e
  out.x = k * k * k * p0x + 3 * k * k * e * p1x + 3 * k * e * e * p2x + e * e * e * slotX
  out.y = k * k * k * p0y + 3 * k * k * e * p1y + 3 * k * e * e * p2y + e * e * e * slotY
  return out
}

/** Formation slot i of n: a shallow V centred on (cx, cy), normalised and
 * kept inside the corridor. */
export function formationSlot(i: number, n: number, cx: number, cy: number): { x: number; y: number } {
  const off = i - (n - 1) / 2
  const x = Math.max(-0.95, Math.min(0.95, cx + off * GNAT.slotSpacing))
  const y = Math.max(0.05, Math.min(0.95, cy + Math.abs(off) * GNAT.rowDy))
  return { x, y }
}

/** SPIKE: locks at lockZ, blinks (the telegraph), then dives. */
export const SPIKE = { lockZ: -140, blink: 0.45, turn: { x: 6, y: 5 }, driftMul: 1.1 } as const

/** MANTA: wide sine strafe; drops a trailing mine now and then. */
export const MANTA = {
  sineAmp: 5.5,
  sineRate: [1.5, 3] as const,
  mineEvery: [3.2, 5.0] as const,
  minesEach: 2,
  mineZ: [-170, -45] as const,
  driftMul: 0.6,
} as const

/** LANCER: a pink sightline to its target for `sightline` s (aim frozen at
 * its start), then a fast bolt along it. */
export const LANCER = {
  sightline: 0.5,
  boltMul: 1.6,
  reload: [2.2, 3.2] as const,
  fireZ: [-170, -30] as const,
  driftMul: 0.6,
} as const

/** HORNET: spawns behind the camera, overtakes on the outside of the
 * ship, turns at turnZ and comes back firing; Claude warns `warnLead` s
 * before it appears (`warn:behind`). */
export const HORNET = {
  spawnZ: 16,
  warnLead: 1.2,
  /** lateral offset from the ship's x as it passes (never through it) */
  sideOffset: 3.5,
  /** closing speed toward −z while overtaking, relative to the ship */
  overtakeSpeed: 44,
  turnZ: -75,
  turnTime: 0.9,
  /** drift after the turn, like any attacker */
  driftMul: 1.0,
  attackBolts: 2,
  boltGap: 0.35,
} as const

/** BULWARK: the front shield soaks lasers; it opens `openLead` s before
 * each shot and stays open `openTime` s. Charge shots and bombs break it. */
export const BULWARK = {
  fireEvery: [2.2, 3.0] as const,
  openLead: 0.35,
  openTime: 0.8,
  boltMul: 0.85,
  driftMul: 0.45,
  /** seconds a broken shield stays down */
  brokenTime: 4,
} as const

/** Is a bulwark's shield open? `untilShot` = seconds to its next shot,
 * `sinceShot` = seconds since its last. */
export function bulwarkShieldOpen(untilShot: number, sinceShot: number): boolean {
  return untilShot <= BULWARK.openLead || sinceShot < BULWARK.openTime - BULWARK.openLead
}

/** POD: pops into `mites` diving mites `spread` apart. */
export const POD = { mites: 2, spread: 1.5 } as const
export const MITE = { turn: { x: 4, y: 3.5 }, driftMul: 1.1 } as const

/** CARRIER: slow, parks at parkZ, launches gnats, climbs away after
 * holdTime if still alive. Parts glow brighter as it takes damage. */
export const CARRIER = {
  driftMul: 0.22,
  /** where it parks: the mid-field, where it reads as the big ship it is */
  parkZ: -85,
  holdTime: 16,
  firstLaunch: 1.2,
  launchEvery: 2.6,
  launchCount: 2,
  /** gnats of its own alive at once */
  maxGnats: 6,
  missileEvery: 5.5,
  /** glowing parts; `carrierPartsLit` maps HP to how many glow */
  parts: 3,
  dropsCapsule: true,
} as const

/** How many of a carrier's parts glow at this HP (more as it breaks). */
export function carrierPartsLit(hp: number, maxHp: number = ENEMY_STATS.carrier.hp): number {
  const lost = 1 - Math.max(0, Math.min(maxHp, hp)) / maxHp
  return Math.min(CARRIER.parts, Math.floor(lost * (CARRIER.parts + 1)))
}

/** TURRET: a ground emplacement riding the ground; fires a short upward
 * burst when the ship is inside its narrow forward cone. */
export const TURRET = {
  /** half-angle of the lateral fire cone (radians, ~9°) */
  cone: 0.16,
  fireZ: [-150, -25] as const,
  fireEvery: [1.5, 2.3] as const,
  burst: 2,
  burstGap: 0.18,
  boltMul: 0.9,
  /** mount height on the ground */
  mountY: -2.4,
  /** they ride the ground: the full corridor speed */
  driftMul: 1,
} as const

/** Is the ship inside a turret's fire cone? (ship ahead of it in +z,
 * inside the fire window, laterally within the cone) */
export function turretInCone(tx: number, tz: number, sx: number, sz = 0): boolean {
  const dz = sz - tz
  if (tz < TURRET.fireZ[0] || tz > TURRET.fireZ[1] || dz <= 0) return false
  return Math.abs(sx - tx) <= Math.tan(TURRET.cone) * dz
}

/** MISSILE: homing, shootable. Speeds are relative to the ship. A steady
 * slide gets caught; a hard break inside ~25 units beats it (the Star Fox
 * way: wait, then jink), and so do a barrel roll or a laser. */
export const MISSILE = {
  speed: 36,
  /** radians per second (see `steerHoming`) */
  turnRate: 1.2,
  life: 4.5,
  /** seconds flying straight before it starts homing */
  arm: 0.3,
  /** detonates within this distance of its target */
  proximity: 1.3,
  maxAlive: 4,
} as const

/** Turn velocity (vx, vy, vz) toward the direction (dx, dy, dz) by at most
 * turnRate·dt radians, keeping its speed. Pure: missiles and the charge
 * orb both steer with it. Writes into `out`. */
export function steerHoming(
  vx: number, vy: number, vz: number,
  dx: number, dy: number, dz: number,
  turnRate: number, dt: number,
  out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): { x: number; y: number; z: number } {
  const speed = Math.hypot(vx, vy, vz)
  const dl = Math.hypot(dx, dy, dz)
  if (speed === 0 || dl === 0) {
    out.x = vx; out.y = vy; out.z = vz
    return out
  }
  const ax = vx / speed, ay = vy / speed, az = vz / speed
  const bx = dx / dl, by = dy / dl, bz = dz / dl
  const cos = Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz))
  const ang = Math.acos(cos)
  const maxTurn = turnRate * dt
  if (ang <= maxTurn || ang < 1e-9) {
    out.x = bx * speed; out.y = by * speed; out.z = bz * speed
    return out
  }
  // slerp from a toward b by maxTurn
  const sin = Math.sin(ang)
  const wa = Math.sin(ang - maxTurn) / sin
  const wb = Math.sin(maxTurn) / sin
  out.x = (ax * wa + bx * wb) * speed
  out.y = (ay * wa + by * wb) * speed
  out.z = (az * wa + bz * wb) * speed
  return out
}

/** Corridor scroll speed: the old 2-minute ramp, +4 per sector, capped. */
export function worldSpeedFor(elapsed: number, sector: number): number {
  const d = Math.min(1, Math.max(0, elapsed / 120))
  return Math.min(96, 42 + 38 * d + 4 * (Math.max(1, sector) - 1))
}

/** Normal-spawn interval multiplier per sector (never below 0.4 pace). */
export function spawnPace(sector: number): number {
  return Math.max(0.4, Math.pow(0.9, Math.max(1, sector) - 1))
}

/** Wingman tuning: a hittable AI co-flyer that respawns. */
export const BUDDY_HP = 50
/** Seconds the wingman stays down before returning. */
export const BUDDY_RESPAWN = 10
/** Formation offset behind-right of the player (world units). */
export const BUDDY_OFFSET: { x: number; y: number } = { x: 3.5, y: -0.8 }
/** Seconds of invulnerability after the wingman (re)spawns. */
export const BUDDY_INVULN = 2
/** Wingman fire interval: ~60 % of a level-1 player's output. */
export const BUDDY_FIRE_INTERVAL = 0.28
/** Share of aimed enemy fire drawn to the wingman while it is alive. */
export const BUDDY_AGGRO = 0.35

// ---- the squad: three wingmen at once (2026-09-25) -----------------------------
// Animal pilots from the Hall of Fame. HERON the ace hunts far and steals
// kills; BISON the veteran stays close, tanks, and shoots down whatever
// threatens the player; DINGO the rookie is fragile and in between.
// WALRUS and ZEBRA are reserves (a reserve takes the slot of the pilot it
// replaces). Retuned after the first playthrough (2026-09-25): the hunt
// windows reach into the mid-field only (~−95 at most), leashes are
// shorter and heron/dingo sturdier and less shot at, so the player gets
// most kills and a wingman loss is an event (Dingo's trouble aside). The BUDDY_* constants above are the single-wingman tuning
// Flight.vue still uses until the squad lands there.

export type WingId = 'heron' | 'bison' | 'dingo' | 'walrus' | 'zebra'

export const SQUAD: readonly WingId[] = ['heron', 'bison', 'dingo']
export const RESERVES: readonly WingId[] = ['walrus', 'zebra']

export interface WingProfile {
  name: string
  role: 'ace' | 'veteran' | 'rookie' | 'reserve'
  /** formation offset from the ship (world units; +z is behind, toward
   * the camera). Clear of the laser lines and the camera's view of the ship. */
  slot: { x: number; y: number; z: number }
  hp: number
  /** seconds down before it flies again */
  respawn: number
  /** seconds between shots */
  fireInterval: number
  /** weight of enemy aimed fire it draws (see `aggroShares`) */
  aggro: number
  /** depth window it hunts in */
  huntZ: readonly [number, number]
  /** how far across from the ship it will go while hunting */
  leash: number
  /** extra threat for things coming at the player (missiles on the ship,
   * dives near the ship) */
  guard: number
  /** pull toward targets in the player's own line (the ace steals kills) */
  steal: number
  /** cost margin a new target needs to steal its lock */
  margin: number
  /** player hull below which it drops everything and covers */
  coverHp: number
  /** multiplier on the hunt turn rate */
  turn: number
}

export const WINGMEN: Readonly<Record<WingId, WingProfile>> = {
  heron: {
    name: 'HERON', role: 'ace', slot: { x: -4.6, y: 1.8, z: 0.8 },
    hp: 55, respawn: 12, fireInterval: 0.24, aggro: 0.1,
    huntZ: [-95, -8], leash: 7, guard: 0, steal: 1.5, margin: 1.5, coverHp: 20, turn: 1.25,
  },
  bison: {
    name: 'BISON', role: 'veteran', slot: { x: 4.4, y: -0.4, z: 1.4 },
    hp: 80, respawn: 10, fireInterval: 0.32, aggro: 0.2,
    huntZ: [-75, -3], leash: 4, guard: 2.5, steal: 0, margin: 3, coverHp: 45, turn: 0.9,
  },
  dingo: {
    name: 'DINGO', role: 'rookie', slot: { x: -3.4, y: -1.0, z: 4.2 },
    hp: 40, respawn: 9, fireInterval: 0.3, aggro: 0.07,
    huntZ: [-85, -8], leash: 5.5, guard: 0.5, steal: 0.5, margin: 2.5, coverHp: 30, turn: 1,
  },
  walrus: {
    name: 'WALRUS', role: 'reserve', slot: { x: 4.4, y: -0.4, z: 1.4 },
    hp: 70, respawn: 10, fireInterval: 0.34, aggro: 0.18,
    huntZ: [-75, -3], leash: 4, guard: 2, steal: 0, margin: 3, coverHp: 40, turn: 0.9,
  },
  zebra: {
    name: 'ZEBRA', role: 'reserve', slot: { x: -4.6, y: 1.8, z: 0.8 },
    hp: 45, respawn: 11, fireInterval: 0.26, aggro: 0.09,
    huntZ: [-90, -8], leash: 6.5, guard: 0, steal: 1, margin: 2, coverHp: 25, turn: 1.15,
  },
}

/** Seconds of invulnerability after any wingman (re)spawns. */
export const WING_INVULN = 2

/** At most this share of enemy aimed fire goes to wingmen, however many fly. */
export const WING_AGGRO_MAX = 0.45

/** Share of enemy aimed fire each live wingman draws (aligned with
 * `alive`); the rest goes to the player. The sum never passes
 * WING_AGGRO_MAX, and fewer wingmen draw less. */
export function aggroShares(alive: readonly WingId[]): number[] {
  let sum = 0
  for (const id of alive) sum += WINGMEN[id].aggro
  const k = sum > WING_AGGRO_MAX ? WING_AGGRO_MAX / sum : 1
  return alive.map(id => WINGMEN[id].aggro * k)
}

/** Who an aimed shot goes for: a wingman, or null for the player. `r` is
 * one uniform draw in [0, 1). */
export function pickAggroTarget(alive: readonly WingId[], r: number): WingId | null {
  const shares = aggroShares(alive)
  let acc = 0
  for (let i = 0; i < alive.length; i++) {
    acc += shares[i]!
    if (r < acc) return alive[i]!
  }
  return null
}

// ---- set pieces with the squad and the rival -------------------------------------

/** DINGO in trouble: he breaks formation with chasers on his tail; kill
 * them all within `time` s and he is saved, else he is shot down. He
 * weaves ahead of the player so the chasers can be shot. */
export const DINGO_TROUBLE = {
  time: 12,
  /** chasers: gnats glued `gap` units behind him */
  chaserKind: 'drone' as EnemyKind,
  gap: 5,
  /** his weave, normalised lane units */
  weave: { amp: 0.45, rate: 0.9, y: 0.55, yAmp: 0.18 },
  /** depth he flies at, ahead of the player */
  z: -38,
} as const

/** DINGO's weave point `t` s into the set piece (normalised x, y), on the
 * `side` he broke off to. */
export function dingoWeave(t: number, side: -1 | 1): { x: number; y: number } {
  const w = DINGO_TROUBLE.weave
  return {
    x: side * 0.35 + w.amp * Math.sin(t * w.rate * Math.PI),
    y: w.y + w.yAmp * Math.sin(t * w.rate * 2.1),
  }
}

export type DingoOutcome = 'running' | 'saved' | 'lost'

export function dingoTroubleOutcome(chasersAlive: number, elapsed: number): DingoOutcome {
  if (chasersAlive <= 0) return 'saved'
  return elapsed >= DINGO_TROUBLE.time ? 'lost' : 'running'
}

/** MEGA COBRA's fighter: faster across than the player, keeps its range,
 * rolls out of a steady aim, fires aimed bursts and a spread. In the
 * sector-3 duel it escapes once it has lost `escapeAt` of its HP (or when
 * the duel runs out); the sector-5 duel is to the end. */
export const RIVAL = {
  speed: 16,
  z: [-70, -35] as const,
  /** rolls when the player has held it in line this long */
  dodgeAfter: 0.4,
  /** lateral distance that counts as "in line" */
  lineX: 1.4,
  roll: 0.5,
  rollCooldown: 1.6,
  /** fraction of HP lost before it escapes (sector 3) */
  escapeAt: 0.6,
  /** the sector-3 duel ends by escape after this long regardless */
  duelTime: 25,
  /** the final duel's hard stop: it retreats into the Crown */
  finalTime: 60,
  /** flyby duration (sector 2, taunt only) */
  flybyTime: 4,
  burst: { telegraph: 0.35, bolts: 3, gap: 0.12, boltMul: 1.25 },
  spread: { telegraph: 0.5, bolts: 5, spread: 0.7, boltMul: 1 },
  /** seconds between attacks */
  attackEvery: [1.2, 1.8] as const,
  /** bar fraction below which the cue `cobra:hit` plays */
  hitCueAt: 0.75,
} as const

/** Rival HP for a duel: 40 in sector 3, 60 in the final, × ECHO. */
export function rivalHp(sector: number, final: boolean): number {
  return Math.round(40 * (final ? 1.5 : 1) * echoMul(sector))
}

/** Does the rival leave now? Never in the final duel. */
export function rivalEscapes(hpFrac: number, final: boolean, duelT: number): boolean {
  if (final) return false
  return hpFrac <= 1 - RIVAL.escapeAt || duelT >= RIVAL.duelTime
}

/** Should it roll? The player has held it in line `inLineT` s and the
 * roll is off cooldown. */
export function rivalShouldRoll(inLineT: number, sinceRoll: number): boolean {
  return inLineT >= RIVAL.dodgeAfter && sinceRoll >= RIVAL.rollCooldown
}

/** `cobra:hit` the first time its HP crosses RIVAL.hitCueAt. */
export function rivalHitCue(prevFrac: number, frac: number): string | null {
  return prevFrac > RIVAL.hitCueAt && frac <= RIVAL.hitCueAt ? 'cobra:hit' : null
}

/** Mine tuning: drifting proximity-fused obstacles. */
export const MINE_FUSE_RADIUS = 3.2
export const MINE_BLAST_RADIUS = 3.4
export const MINE_SCORE = 75
/** Max concurrent mines — visual-clutter cap. */
export const MAX_MINES = 6
/** Max concurrent bulwarks — they soak 3 hits each. */
export const MAX_BULWARKS = 2
/** Max concurrent arches (twin pillars + lethal lintel). */
export const MAX_ARCHES = 3

export function applyDamage(hp: number, dmg: number): number {
  return Math.max(0, hp - dmg)
}

export function heal(hp: number, amount: number): number {
  return Math.min(HP_MAX, hp + amount)
}
