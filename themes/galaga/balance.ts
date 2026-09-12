/**
 * Galaga balance — pure tuning with no Vue/DOM/canvas imports, so plain
 * `node --test` can exercise it. Galaga.vue imports the constants and wires
 * them to the game; tests/galaga-balance.test.mjs pins them.
 *
 * The contract (decided 2026-09-12): a 5-segment hull instead of one-hit
 * death, shield as a pre-hull layer that heals first, one weapon step lost
 * per hull hit (never a full wipe), and a wave-driven difficulty ramp on
 * the wave axis (Star Fox uses sectors; Galaga uses waves). Boss HP is
 * deliberately decoupled from the player's bullet level — the old
 * `18 * 1.35^(bulletLevel-1)` punished skilled play.
 */

/** Hull segments: five hits to kill. */
export const HULL_MAX = 5

/** Damage by source, in hull segments. */
export const DMG = {
  /** normal enemy bolt */
  bolt: 1,
  /** boss bolt */
  bossBolt: 1,
  /** ramming an enemy or the boss hull */
  ram: 1,
} as const

export type DamageSource = keyof typeof DMG

/** Heal on boss kill (the objective reward). */
export const HEAL_BOSS = 1
/** Seconds of blink-invulnerability after each hull hit. */
export const INVULN_TIME = 1.2
/** Cap on the bullet spread level (the fan is visually capped at 70°). */
export const BULLET_LEVEL_MAX = 5
/** Pity: hull <= 1 and this long since an S capsule → force S next. */
export const PITY_TIME_MS = 20_000

/** Max concurrent falling powerups (R-Type/Invaders both cap at 3). */
export const MAX_FALLING_POWERUPS = 3

/** Cap on concurrent particles (Galaga previously had none). */
export const MAX_PARTICLES = 300

export function applyDamage(hull: number, dmg: number): number {
  return Math.max(0, hull - dmg)
}

export function heal(hull: number, amount: number): number {
  return Math.min(HULL_MAX, hull + amount)
}

/** Milliseconds between waves: 2500 → 1100 floor after ~23 waves. */
export function waveIntervalFor(w: number): number {
  return Math.max(1100, 2500 - 60 * Math.max(0, Math.floor(w)))
}

/** Multiplier on enemy vx/vy: +3 %/wave, capped at +80 %. */
export function enemySpeedMul(w: number): number {
  return 1 + Math.min(0.8, 0.03 * Math.max(0, Math.floor(w)))
}

/** First-shot delay per enemy (ms): 2600 → 700 floor over ~21 waves. */
export function enemyFireFirstFor(w: number): number {
  return Math.max(700, 2600 - 90 * Math.max(0, Math.floor(w)))
}

/** Refire window width (ms) after the first shot: 2500 → 800 floor. */
export function enemyRefireWindowFor(w: number): number {
  return Math.max(800, 2500 - 80 * Math.max(0, Math.floor(w)))
}

/** Enemy bolt speed: ~2.5–4.0 early → ~5.5–7.0 late (+ rand*1.5). */
export function boltSpeedFor(w: number): number {
  return 2.5 + Math.min(3.0, 0.12 * Math.max(0, Math.floor(w)))
}

/** Share of enemies allowed to shoot: gates the update loop. */
export function shootChanceFor(w: number): number {
  return Math.min(0.9, 0.5 + 0.04 * Math.max(0, Math.floor(w)))
}

/** Enemies per normal wave: viewport base + 1 every 6 waves, cap 9. */
export function waveCountFor(w: number, viewportW: number): number {
  return Math.min(9, 4 + Math.floor(viewportW / 350) + Math.floor(Math.max(0, w) / 6))
}

/** Armoured HP: 3 → 5, +1 every 8 waves. */
export function heavyHpFor(w: number): number {
  return 3 + Math.min(2, Math.floor(Math.max(0, w) / 8))
}

/** Scouts gain a 2-HP veteran variant from wave 6. */
export function scoutHpFor(w: number): number {
  return Math.max(0, w) >= 6 ? 2 : 1
}

/** Seconds between boss spawns: 25 → 14 floor. */
export function bossEveryFor(n: number): number {
  return Math.max(14, 25 - 2 * Math.max(0, Math.floor(n)))
}

/**
 * Boss max HP: decoupled from player power (regression guard in tests).
 * Boss #1 ≈ 24, boss #5 at wave 20 ≈ 94.
 */
export function bossMaxHpFor(bossNum: number, wave: number): number {
  return 24 + 6 * Math.max(0, Math.floor(bossNum)) + 2 * Math.max(0, Math.floor(wave))
}

/** Boss base attack clock (ms): 800 → 600 floor, spread narrows too. */
export function bossAttackFor(n: number): { base: number; spread: number } {
  const k = Math.max(0, Math.floor(n))
  return { base: Math.max(600, 800 - 40 * k), spread: Math.max(400, 1200 - 60 * k) }
}

/** Boss fan: 2 bolts, aimed 3rd bolt from boss #3. */
export function bossFanCount(n: number): number {
  return Math.max(0, n) >= 3 ? 3 : 2
}

/** Boss bounty grows with boss number (the sector-clear-bonus analogue). */
export function bossBountyFor(n: number): number {
  return 500 + 250 * Math.max(0, Math.floor(n))
}

/** Enemy kinds: the three originals plus six new ones. */
export type EnemyKind =
  | 'scout'
  | 'squadron'
  | 'heavy'
  | 'diver'
  | 'weaver'
  | 'sniper'
  | 'splitter'
  | 'mite'
  | 'bulwark'
  | 'stinger'

/** Per-kind stats: hits to kill (base) and score value. */
export const ENEMY_STATS: Record<EnemyKind, { hp: number; score: number }> = {
  scout: { hp: 1, score: 100 },
  squadron: { hp: 1, score: 100 },
  heavy: { hp: 3, score: 250 },
  diver: { hp: 1, score: 150 },
  weaver: { hp: 1, score: 140 },
  sniper: { hp: 1, score: 130 },
  splitter: { hp: 2, score: 200 },
  mite: { hp: 1, score: 50 },
  bulwark: { hp: 5, score: 300 },
  stinger: { hp: 1, score: 120 },
}

/** Wave tiers communicated in docs/HUD. */
export function waveTier(w: number): 0 | 1 | 2 | 3 {
  const k = Math.max(0, Math.floor(w))
  if (k >= 15) return 3
  if (k >= 10) return 2
  if (k >= 5) return 1
  return 0
}

/** Powerup kinds: the two originals plus seven new ones. */
export type PowerupKind =
  | 'shield'
  | 'weapon'
  | 'dual'
  | 'rear'
  | 'aegis'
  | 'tempo'
  | 'nova'
  | 'magnet'
  | 'combo'

/** Letters painted on the gold capsules. */
export const POWERUP_LETTERS: Record<PowerupKind, string> = {
  shield: 'S',
  weapon: 'P',
  dual: 'D',
  rear: 'R',
  aegis: 'A',
  tempo: 'T',
  nova: 'N',
  magnet: 'M',
  combo: 'C',
}

/** Durations in seconds of active play (0 = instant / permanent). */
export const POWERUP_DURATION: Record<PowerupKind, number> = {
  shield: 0,
  weapon: 0,
  dual: 25,
  rear: 15,
  aegis: 0,
  tempo: 8,
  nova: 0,
  magnet: 20,
  combo: 15,
}

/**
 * Spawn weights. Weapon stays the progression backbone; nova is rarest.
 * Shield/aegis share a slot; aegis only spawns once the player has seen
 * mid-game (wave >= 4).
 */
export function powerupWeights(
  wave: number,
  opts: { shieldActive: boolean; aegisActive: boolean; hullFull?: boolean },
): { kind: PowerupKind; weight: number }[] {
  const out: { kind: PowerupKind; weight: number }[] = [{ kind: 'weapon', weight: 45 }]
  if (!opts.aegisActive) {
    out.push({ kind: 'shield', weight: opts.shieldActive && opts.hullFull !== false ? 0 : 14 })
    if (Math.max(0, wave) >= 4) out.push({ kind: 'aegis', weight: 6 })
  }
  out.push(
    { kind: 'dual', weight: 7 },
    { kind: 'rear', weight: 7 },
    { kind: 'tempo', weight: 6 },
    { kind: 'magnet', weight: 5 },
    { kind: 'combo', weight: 6 },
    { kind: 'nova', weight: 4 },
  )
  return out.filter(w => w.weight > 0)
}

/** Weighted pick with an injectable rng (deterministic in tests). */
export function pickPowerup(
  wave: number,
  opts: { shieldActive: boolean; aegisActive: boolean; hullFull?: boolean },
  rng: () => number = Math.random,
): PowerupKind {
  const table = powerupWeights(wave, opts)
  const total = table.reduce((n, e) => n + e.weight, 0)
  let r = rng() * total
  for (const e of table) {
    r -= e.weight
    if (r <= 0) return e.kind
  }
  return 'weapon'
}

/**
 * Music intensity tier for the adaptive sequencer: follows the wave tier
 * (0 scouts … 3 late-game), boss forces tier 3 with a transposition on top.
 */
export function intensityFor(waveNumber: number, bossActive: boolean): 0 | 1 | 2 | 3 {
  if (bossActive) return 3
  return waveTier(waveNumber)
}
