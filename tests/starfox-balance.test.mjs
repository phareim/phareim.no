import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  HP_MAX, DMG, HEAL_RING, HEAL_CLEAR, BOSS_NAME,
  TRAVEL_TIME, WARNING_TIME, CLEAR_TIME,
  bossMaxHp, sectorClearBonus, enemyFireInterval, boltSpeedBonus,
  enemyShootChance, formationSize, pickEnemyKind, worldSpeedFor,
  spawnPace, applyDamage, heal, advanceSector,
} from '../themes/starfox/balance.ts'

describe('Star Fox health', () => {
  it('holds 100 HP and floors damage at zero', () => {
    assert.equal(HP_MAX, 100)
    assert.equal(applyDamage(100, DMG.bolt), 100 - DMG.bolt)
    assert.equal(applyDamage(10, DMG.ram), 0)
    assert.equal(applyDamage(0, DMG.bolt), 0)
  })

  it('heals with rings but never past full', () => {
    assert.equal(heal(50, HEAL_RING), 50 + HEAL_RING)
    assert.equal(heal(95, HEAL_RING), HP_MAX)
    assert.equal(heal(HP_MAX, HEAL_CLEAR), HP_MAX)
  })

  it('punishes rams more than bolts', () => {
    assert.ok(DMG.ram > DMG.bolt)
    assert.ok(DMG.bossRam > DMG.bossBolt)
    for (const v of Object.values(DMG)) assert.ok(v > 0)
  })
})

describe('Star Fox sectors', () => {
  it('flies ~80 s, warns briefly, clears briefly', () => {
    assert.equal(TRAVEL_TIME, 80)
    assert.equal(WARNING_TIME, 2.5)
    assert.equal(CLEAR_TIME, 3)
  })

  it('walks travel → warning → boss → (kill) → clear → travel', () => {
    assert.equal(advanceSector('travel', 79), 'travel')
    assert.equal(advanceSector('travel', 80), 'warning')
    assert.equal(advanceSector('warning', 2.4), 'warning')
    assert.equal(advanceSector('warning', 2.5), 'boss')
    assert.equal(advanceSector('boss', 999), 'boss')
    assert.equal(advanceSector('clear', 2.9), 'clear')
    assert.equal(advanceSector('clear', 3), 'travel')
  })

  it('pays a bigger bounty per sector', () => {
    assert.equal(sectorClearBonus(1), 1000)
    assert.equal(sectorClearBonus(3), 3000)
  })

  it('ramps speed with time and sector, capped', () => {
    const early = worldSpeedFor(0, 1)
    const late = worldSpeedFor(120, 1)
    assert.ok(late > early)
    assert.ok(worldSpeedFor(0, 3) > early)
    assert.ok(worldSpeedFor(9999, 99) <= 96)
  })

  it('quickens spawns per sector, never past half pace', () => {
    assert.equal(spawnPace(1), 1)
    assert.ok(spawnPace(3) < 1)
    assert.ok(spawnPace(99) >= 0.5)
  })
})

describe('Star Fox enemies', () => {
  it('shoots sooner on later sectors, floored', () => {
    const s1 = enemyFireInterval(1)
    const s5 = enemyFireInterval(5)
    assert.ok(s5.lo < s1.lo && s5.hi < s1.hi)
    assert.ok(s5.lo >= 0.7 && s5.hi >= 0.9)
  })

  it('throws faster bolts and keener shots per sector', () => {
    assert.equal(boltSpeedBonus(1), 0)
    assert.ok(boltSpeedBonus(3) > 0)
    assert.ok(enemyShootChance(3) > enemyShootChance(1))
    assert.ok(enemyShootChance(99) <= 0.9)
  })

  it('keeps sector 1 to drones, grows formations later', () => {
    for (let i = 0; i < 50; i++) assert.equal(pickEnemyKind(1, () => i / 50), 'drone')
    const kinds = new Set(Array.from({ length: 200 }, (_, i) => pickEnemyKind(3, () => (i * 37 % 100) / 100)))
    assert.ok(kinds.has('sniper') && kinds.has('kamikaze'))
    for (let i = 0; i < 50; i++) {
      const n = formationSize(1, () => i / 50)
      assert.ok(n >= 2 && n <= 3)
      assert.ok(formationSize(3, () => i / 50) <= 5)
    }
  })
})

describe('Star Fox boss', () => {
  it('has a name and 40 core hits, +15 per sector', () => {
    assert.equal(BOSS_NAME, 'DREADNOUGHT')
    assert.equal(bossMaxHp(1), 40)
    assert.equal(bossMaxHp(2), 55)
    assert.equal(bossMaxHp(4), 85)
  })
})
