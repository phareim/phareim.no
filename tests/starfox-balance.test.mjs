import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  HP_MAX, DMG, HEAL_RING, HEAL_CLEAR, BOSS_NAME,
  TRAVEL_TIME, WARNING_TIME, CLEAR_TIME,
  bossMaxHp, sectorClearBonus, enemyFireInterval, boltSpeedBonus,
  bossAttackInterval, BOSS_ENRAGE_RATE, bossFanCount, bossFanSpread,
  bossMinions, sectorPalette, BOSS_WHEEL_LEN,
  enemyShootChance, formationSize, pickEnemyKind, worldSpeedFor,
  spawnPace, applyDamage, heal, advanceSector,
  ENEMY_STATS, BUDDY_HP, BUDDY_RESPAWN, BUDDY_INVULN, BUDDY_FIRE_INTERVAL,
  MINE_FUSE_RADIUS, MINE_BLAST_RADIUS, MINE_SCORE, MAX_MINES, MAX_BULWARKS, MAX_ARCHES,
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

  it('quickens spawns per sector, never past 0.4 pace', () => {
    assert.equal(spawnPace(1), 1)
    assert.ok(spawnPace(3) < 1)
    assert.ok(spawnPace(99) >= 0.4)
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
    assert.ok(enemyShootChance(99) <= 0.95)
  })

  it('keeps sector 1 to drones, grows formations later', () => {
    for (let i = 0; i < 50; i++) assert.equal(pickEnemyKind(1, () => i / 50), 'drone')
    const kinds3 = new Set(Array.from({ length: 400 }, (_, i) => pickEnemyKind(3, () => (i * 37 % 100) / 100)))
    assert.ok(kinds3.has('sniper') && kinds3.has('kamikaze'))
    assert.ok(kinds3.has('weaver') && kinds3.has('dasher'))
    assert.ok(kinds3.has('bulwark') && kinds3.has('splitter'))
    assert.ok(!kinds3.has('mite'), 'mites spawn from splitters, never directly')
    const kinds2 = new Set(Array.from({ length: 200 }, (_, i) => pickEnemyKind(2, () => (i * 37 % 100) / 100)))
    assert.ok(kinds2.has('weaver') && kinds2.has('dasher') && kinds2.has('sniper'))
    assert.ok(!kinds2.has('bulwark') && !kinds2.has('splitter') && !kinds2.has('mite'))
    for (let i = 0; i < 50; i++) {
      const n = formationSize(1, () => i / 50)
      assert.ok(n >= 2 && n <= 3)
      assert.ok(formationSize(3, () => i / 50) <= 5)
    }
  })

  it('pins per-kind HP and score stats', () => {
    assert.equal(ENEMY_STATS.bulwark.hp, 3)
    assert.equal(ENEMY_STATS.splitter.hp, 2)
    for (const [kind, st] of Object.entries(ENEMY_STATS)) {
      assert.ok(st.hp >= 1, kind)
      assert.ok(st.score > 0, kind)
    }
    assert.ok(ENEMY_STATS.bulwark.score > ENEMY_STATS.drone.score)
    assert.equal(ENEMY_STATS.mite.score, 50)
  })
})

describe('Star Fox boss', () => {
  it('has a name and 55 core hits, +20 per sector', () => {
    assert.equal(BOSS_NAME, 'DREADNOUGHT')
    assert.equal(bossMaxHp(1), 55)
    assert.equal(bossMaxHp(2), 75)
    assert.equal(bossMaxHp(4), 115)
  })

  it('runs a 4-step attack wheel', () => {
    assert.equal(BOSS_WHEEL_LEN, 4)
  })

  it('attacks faster on later sectors, enraged below 30 %', () => {
    assert.ok(bossAttackInterval(2) < bossAttackInterval(1))
    assert.ok(bossAttackInterval(3) <= bossAttackInterval(2))
    assert.ok(bossAttackInterval(1) <= 1.6)
    assert.ok(BOSS_ENRAGE_RATE > 1)
  })

  it('throws wider fans on later sectors', () => {
    assert.ok(bossFanCount(2) > bossFanCount(1))
    assert.ok(bossFanCount(3) >= bossFanCount(2))
    assert.ok(bossFanSpread(3) >= bossFanSpread(1))
  })

  it('brings deadlier minion screens on later sectors', () => {
    assert.equal(bossMinions(1).length, 2)
    assert.ok(bossMinions(2).length > 2)
    assert.ok(bossMinions(2).some(m => m.kind === 'sniper'))
    assert.ok(bossMinions(2).some(m => m.kind === 'weaver'))
    assert.ok(bossMinions(3).some(m => m.kind === 'kamikaze'))
    assert.ok(bossMinions(3).some(m => m.kind === 'bulwark'))
  })
})

describe('Star Fox wingman and obstacles', () => {
  it('pins wingman HP, respawn and fire pacing', () => {
    assert.equal(BUDDY_HP, 50)
    assert.equal(BUDDY_RESPAWN, 10)
    assert.ok(BUDDY_INVULN > 0 && BUDDY_INVULN <= BUDDY_RESPAWN)
    // ~60 % of a level-1 player's output (twin bolts every 1/6 s).
    assert.ok(BUDDY_FIRE_INTERVAL > 1 / 6)
  })

  it('pins mine, bulwark and arch caps', () => {
    assert.ok(MINE_FUSE_RADIUS > 0 && MINE_BLAST_RADIUS >= MINE_FUSE_RADIUS - 1)
    assert.ok(MINE_SCORE > 0)
    assert.equal(MAX_MINES, 6)
    assert.equal(MAX_BULWARKS, 2)
    assert.equal(MAX_ARCHES, 3)
  })

  it('keeps shoot chance capped and bolt bonus positive', () => {
    assert.ok(enemyShootChance(99) <= 0.95)
    assert.ok(enemyShootChance(1) >= 0.6)
    assert.equal(boltSpeedBonus(1), 0)
    assert.ok(boltSpeedBonus(3) > 0)
  })
})

describe('Star Fox sector palettes', () => {
  it('shifts the backdrop palette per sector and cycles', () => {
    const p1 = sectorPalette(1)
    const p2 = sectorPalette(2)
    assert.ok(p1.face !== p2.face && p1.edge !== p2.edge && p1.grid !== p2.grid)
    for (const p of [p1, p2, sectorPalette(3), sectorPalette(4)]) {
      for (const c of [p.face, p.edge, p.grid, p.fog, p.sky]) {
        assert.ok(Number.isInteger(c) && c >= 0 && c <= 0xffffff)
      }
    }
    assert.deepEqual(sectorPalette(5), p1)
  })
})
