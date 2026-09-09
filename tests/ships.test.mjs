import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  SHIPS, SHIP_IDS, STARTER_SHIP, UNLOCK_DISTINCT_GAMES,
  shipById, isShipId, unlockedShipIds, isShipUnlocked,
  unlockProgress, shipStates,
} from '../themes/ships/ships.ts'

describe('ship catalogue', () => {
  it('lists exactly two ships with distinct ids and valid hex colours', () => {
    assert.deepEqual(SHIP_IDS, ['dart', 'vandal'])
    assert.equal(new Set(SHIP_IDS).size, SHIPS.length)
    for (const s of SHIPS) {
      assert.ok(s.name.length > 0, s.id)
      assert.ok(s.tagline.length > 0, s.id)
      assert.ok(['dart', 'vandal'].includes(s.variant), s.id)
      for (const c of Object.values(s.colors)) {
        assert.match(c, /^#[0-9a-f]{6}$/i, `${s.id} colour ${c}`)
      }
    }
  })

  it('resolves defs by id and rejects the rest', () => {
    assert.equal(shipById('dart')?.name, 'Dart')
    assert.equal(shipById('vandal')?.variant, 'vandal')
    assert.equal(shipById('x-wing'), undefined)
    assert.equal(shipById(42), undefined)
    assert.equal(isShipId('dart'), true)
    assert.equal(isShipId('tie-fighter'), false)
    assert.equal(isShipId(null), false)
  })

  it('starts every player on the dart', () => {
    assert.equal(STARTER_SHIP, 'dart')
    assert.ok(isShipId(STARTER_SHIP))
  })
})

describe('ship unlock', () => {
  it('needs four distinct games for the second ship', () => {
    assert.equal(UNLOCK_DISTINCT_GAMES, 4)
    assert.deepEqual(unlockedShipIds(0), ['dart'])
    assert.deepEqual(unlockedShipIds(3), ['dart'])
    assert.deepEqual(unlockedShipIds(4), ['dart', 'vandal'])
    assert.deepEqual(unlockedShipIds(6), ['dart', 'vandal'])
  })

  it('gates each ship on the distinct count', () => {
    assert.equal(isShipUnlocked('dart', 0), true)
    assert.equal(isShipUnlocked('vandal', 3), false)
    assert.equal(isShipUnlocked('vandal', 4), true)
  })

  it('reports progress toward the unlock', () => {
    assert.deepEqual(unlockProgress(1), { unlocked: false, remaining: 3 })
    assert.deepEqual(unlockProgress(4), { unlocked: true, remaining: 0 })
    assert.deepEqual(unlockProgress(9), { unlocked: true, remaining: 0 })
  })

  it('builds per-ship states with reserved xp/level fields', () => {
    const states = shipStates(2)
    assert.equal(states.length, 2)
    assert.deepEqual(states[0], { id: 'dart', unlocked: true, xp: 0, level: 1 })
    assert.deepEqual(states[1], { id: 'vandal', unlocked: false, xp: 0, level: 1 })
    assert.equal(shipStates(4)[1].unlocked, true)
  })
})
