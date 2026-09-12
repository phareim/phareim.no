import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  HULL_MAX, DMG, HEAL_BOSS, INVULN_TIME, BULLET_LEVEL_MAX, PITY_TIME_MS,
  MAX_FALLING_POWERUPS, MAX_PARTICLES,
  applyDamage, heal,
  waveIntervalFor, enemySpeedMul, enemyFireFirstFor, enemyRefireWindowFor,
  boltSpeedFor, shootChanceFor, waveCountFor, heavyHpFor, scoutHpFor,
  bossEveryFor, bossMaxHpFor, bossAttackFor, bossFanCount, bossBountyFor,
  ENEMY_STATS, waveTier, pickPowerup, powerupWeights, intensityFor,
} from '../themes/galaga/balance.ts'

test('hull: 5 segments, clamped damage and heal', () => {
  assert.equal(HULL_MAX, 5)
  assert.equal(applyDamage(5, DMG.bolt), 4)
  assert.equal(applyDamage(1, DMG.ram), 0)
  assert.equal(applyDamage(0, 1), 0)
  assert.equal(heal(4, HEAL_BOSS), 5)
  assert.equal(heal(5, 1), 5)
  assert.ok(INVULN_TIME > 0 && BULLET_LEVEL_MAX === 5 && PITY_TIME_MS === 20_000)
  assert.equal(MAX_FALLING_POWERUPS, 3)
  assert.equal(MAX_PARTICLES, 300)
})

test('wave interval ramps to its floor', () => {
  assert.equal(waveIntervalFor(0), 2500)
  assert.equal(waveIntervalFor(23), 1120)
  assert.equal(waveIntervalFor(100), 1100)
  assert.ok(waveIntervalFor(10) < waveIntervalFor(0))
})

test('enemy fire/bolt ramps are monotonic with floors', () => {
  assert.ok(enemyFireFirstFor(0) === 2600 && enemyFireFirstFor(100) === 700)
  assert.ok(enemyFireFirstFor(20) < enemyFireFirstFor(0))
  assert.ok(enemyRefireWindowFor(0) === 2500 && enemyRefireWindowFor(100) === 800)
  assert.ok(boltSpeedFor(0) < boltSpeedFor(10) && boltSpeedFor(100) <= 5.5 + 0.001)
  assert.ok(shootChanceFor(0) === 0.5 && shootChanceFor(100) === 0.9)
  assert.ok(enemySpeedMul(0) === 1 && enemySpeedMul(100) === 1.8)
})

test('wave counts and HP gating', () => {
  assert.ok(waveCountFor(0, 375) <= waveCountFor(12, 375))
  assert.equal(waveCountFor(100, 1440), 9)
  assert.equal(heavyHpFor(0), 3)
  assert.equal(heavyHpFor(16), 5)
  assert.equal(scoutHpFor(0), 1)
  assert.equal(scoutHpFor(6), 2)
})

test('boss scales on wave/boss number, never on bullet level', () => {
  // Same wave, different player power → identical HP (regression guard).
  assert.equal(bossMaxHpFor(1, 10), bossMaxHpFor(1, 10))
  assert.ok(bossMaxHpFor(1, 0) >= 24)
  assert.ok(bossMaxHpFor(5, 20) > bossMaxHpFor(1, 0))
  assert.equal(bossEveryFor(0), 25)
  assert.equal(bossEveryFor(100), 14)
  assert.ok(bossAttackFor(5).base <= bossAttackFor(0).base)
  assert.equal(bossFanCount(0), 2)
  assert.equal(bossFanCount(3), 3)
  assert.ok(bossBountyFor(2) > bossBountyFor(0))
})

test('bestiary economy is sane', () => {
  assert.equal(ENEMY_STATS.scout.score, 100)
  assert.equal(ENEMY_STATS.heavy.score, 250)
  assert.equal(ENEMY_STATS.bulwark.score, 300)
  assert.equal(ENEMY_STATS.mite.score, 50)
  assert.equal(waveTier(0), 0)
  assert.equal(waveTier(5), 1)
  assert.equal(waveTier(10), 2)
  assert.equal(waveTier(15), 3)
})

test('powerup weights respect shield state and pity gating', () => {
  const noShield = powerupWeights(0, { shieldActive: false, aegisActive: false })
  assert.ok(noShield.some(w => w.kind === 'shield'))
  const withShield = powerupWeights(0, { shieldActive: true, aegisActive: false })
  assert.ok(!withShield.some(w => w.kind === 'shield'))
  const early = powerupWeights(0, { shieldActive: false, aegisActive: false })
  assert.ok(!early.some(w => w.kind === 'aegis'))
  const mid = powerupWeights(5, { shieldActive: false, aegisActive: false })
  assert.ok(mid.some(w => w.kind === 'aegis'))
  // Deterministic pick with injected rng.
  assert.equal(pickPowerup(0, { shieldActive: true, aegisActive: true }, () => 0), 'weapon')
  const kinds = new Set(Array.from({ length: 50 }, (_, i) => pickPowerup(6, { shieldActive: false, aegisActive: false }, () => (i + 0.5) / 50)))
  assert.ok(kinds.has('weapon') && kinds.size > 3)
})

test('music intensity follows the wave pattern, boss forces tier 3', () => {
  assert.equal(intensityFor(0, false), 0)
  assert.equal(intensityFor(3, false), 3)
  assert.equal(intensityFor(0, true), 3)
  assert.equal(intensityFor(7, false), 3)
})
