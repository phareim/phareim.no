/**
 * Star Fox balance — pure tuning with no three.js, DOM or Vue imports, so
 * plain `node --test` can exercise it. Flight.vue imports the constants and
 * wires them to the scene; tests/starfox-balance.test.mjs pins them.
 *
 * The contract (decided 2026-09-08): a 100 HP health meter instead of
 * single lives, rings heal, endless sectors (~80 s of travel, then a
 * WARNING and a gunship boss with its own HP), and fiercer enemies paid
 * for by the HP buffer.
 */

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

/** Boss core hits to kill: 40 on sector 1, +15 per sector after. */
export function bossMaxHp(sector: number): number {
  return 40 + 15 * (Math.max(1, Math.floor(sector)) - 1)
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
  return 6 * (Math.max(1, sector) - 1)
}

/** Share of spawned enemies that shoot back. */
export function enemyShootChance(sector: number): number {
  return Math.min(0.9, 0.6 + 0.05 * (Math.max(1, sector) - 1))
}

/** Formation size, 2–3 on sector 1, up to 5 later. */
export function formationSize(sector: number, rng: () => number = Math.random): number {
  const max = sector >= 3 ? 5 : sector >= 2 ? 4 : 3
  return 2 + Math.floor(rng() * (max - 1))
}

/** Enemy kinds past sector 1: snipers shoot faster bolts, kamikazes dive. */
export type EnemyKind = 'drone' | 'sniper' | 'kamikaze'

export function pickEnemyKind(sector: number, rng: () => number = Math.random): EnemyKind {
  if (sector < 2) return 'drone'
  const r = rng()
  if (sector >= 3 && r < 0.2) return 'kamikaze'
  if (r < 0.45) return 'sniper'
  return 'drone'
}

/** Corridor scroll speed: the old 2-minute ramp, +4 per sector, capped. */
export function worldSpeedFor(elapsed: number, sector: number): number {
  const d = Math.min(1, Math.max(0, elapsed / 120))
  return Math.min(96, 42 + 38 * d + 4 * (Math.max(1, sector) - 1))
}

/** Normal-spawn interval multiplier per sector (never below half pace). */
export function spawnPace(sector: number): number {
  return Math.max(0.5, Math.pow(0.92, Math.max(1, sector) - 1))
}

export function applyDamage(hp: number, dmg: number): number {
  return Math.max(0, hp - dmg)
}

export function heal(hp: number, amount: number): number {
  return Math.min(HP_MAX, hp + amount)
}
