import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  CAPSULE_TYPES, CAPSULES, LASER_MAX, laserName, MAXED_SCORE,
  SHIELD, OVERDRIVE, WING_OD, BOMB, bombFuse, inBlast, bombDamage,
  CHARGE, chargeLevel, chargeReady, pickChargeTarget, RINGS,
  createArsenal, newSector, applyCapsule, collectRing, shieldAbsorb, shieldUp, laserHit, useBomb,
  tickArsenal, fireRateMul, laserPierce, wingFireMul, DROP, capsuleWeights, pickCapsule,
} from '../themes/starfox/arsenal.ts'
import { ENEMY_STATS, HP_MAX, HEAL_RING } from '../themes/starfox/balance.ts'

const ctx = (o = {}) => ({ hp: HP_MAX, bombs: 3, laser: 1, wingDown: false, shieldOn: false, ...o })

describe('Star Fox capsules', () => {
  it('has five lettered capsules', () => {
    assert.deepEqual([...CAPSULE_TYPES], ['laser', 'bomb', 'shield', 'wing', 'overdrive'])
    assert.deepEqual(CAPSULE_TYPES.map(t => CAPSULES[t].letter), ['L', 'B', 'S', 'W', 'O'])
  })

  it('raises the laser TWIN → TWIN+ → HYPER, and a hit drops one level', () => {
    const s = createArsenal()
    assert.equal(laserName(s.laser), 'TWIN')
    assert.equal(applyCapsule(s, 'laser').cue, 'pick:laser')
    assert.equal(laserName(s.laser), 'TWIN+')
    assert.equal(applyCapsule(s, 'laser').cue, 'laser:hyper')
    assert.equal(laserName(s.laser), 'HYPER')
    const r = applyCapsule(s, 'laser')
    assert.equal(s.laser, LASER_MAX)
    assert.ok(r.score >= MAXED_SCORE, 'a maxed laser pays score')
    assert.equal(laserHit(s), 2)
    laserHit(s); laserHit(s)
    assert.equal(s.laser, 1)
  })

  it('starts with 3 bombs and caps them at 5', () => {
    const s = createArsenal()
    assert.equal(s.bombs, BOMB.start)
    assert.equal(BOMB.start, 3)
    assert.equal(BOMB.max, 5)
    applyCapsule(s, 'bomb'); applyCapsule(s, 'bomb')
    assert.equal(s.bombs, 5)
    const r = applyCapsule(s, 'bomb')
    assert.equal(s.bombs, 5)
    assert.equal(r.bombs, 0)
    assert.ok(r.score >= MAXED_SCORE)
  })

  it('shield absorbs 40 damage or lasts 12 s, whichever comes first', () => {
    assert.equal(SHIELD.absorb, 40)
    assert.equal(SHIELD.time, 12)
    const s = createArsenal()
    assert.equal(shieldAbsorb(s, 12), 12, 'no shield: all through')
    applyCapsule(s, 'shield')
    assert.ok(shieldUp(s))
    assert.equal(shieldAbsorb(s, 25), 0)
    assert.equal(shieldAbsorb(s, 25), 10, 'the rest spills to the hull')
    assert.ok(!shieldUp(s))
    applyCapsule(s, 'shield')
    const ev = tickArsenal(s, 11.9)
    assert.ok(shieldUp(s) && !ev.shieldDown)
    assert.ok(tickArsenal(s, 0.2).shieldDown)
    assert.ok(!shieldUp(s))
    assert.equal(shieldAbsorb(s, 12), 12)
  })

  it('overdrive: 8 s of double fire and piercing lasers, capped when stacked', () => {
    const s = createArsenal()
    assert.equal(fireRateMul(s), 1)
    assert.equal(laserPierce(s), 0)
    applyCapsule(s, 'overdrive')
    assert.equal(s.overdriveT, OVERDRIVE.time)
    assert.equal(OVERDRIVE.time, 8)
    assert.equal(fireRateMul(s), 2)
    assert.ok(laserPierce(s) > 0)
    applyCapsule(s, 'overdrive')
    assert.ok(s.overdriveT <= OVERDRIVE.cap)
    tickArsenal(s, 5)
    const ev = tickArsenal(s, 99)
    assert.ok(ev.overdriveEnd)
    assert.equal(fireRateMul(s), 1)
  })

  it('wing: Claude back at once, then 10 s of double fire', () => {
    const s = createArsenal()
    const r = applyCapsule(s, 'wing')
    assert.equal(r.respawnWing, true)
    assert.equal(r.cue, 'pick:wing')
    assert.equal(WING_OD.time, 10)
    assert.equal(wingFireMul(s), 2)
    assert.ok(tickArsenal(s, 10).wingOdEnd)
    assert.equal(wingFireMul(s), 1)
  })

  it('tick writes into the given object (no per-frame allocation)', () => {
    const s = createArsenal()
    const out = { shieldDown: true, overdriveEnd: true, wingOdEnd: true }
    assert.equal(tickArsenal(s, 1 / 60, out), out)
    assert.equal(out.shieldDown, false)
  })
})

describe('Star Fox rings', () => {
  it('silver heals as before; gold heals 25 and scores', () => {
    const s = createArsenal()
    assert.equal(collectRing(s, 'silver').heal, HEAL_RING)
    const g = collectRing(s, 'gold')
    assert.equal(g.heal, 25)
    assert.equal(g.cue, 'pick:gold')
    assert.ok(g.score > RINGS.silver.score)
  })

  it('three gold in a sector pay ALL GOLD and a bomb; a new sector starts over', () => {
    const s = createArsenal()
    collectRing(s, 'gold'); collectRing(s, 'gold')
    const third = collectRing(s, 'gold')
    assert.equal(third.cue, 'gold:all')
    assert.equal(third.bombs, 1)
    assert.equal(s.bombs, BOMB.start + 1)
    assert.ok(third.score >= RINGS.gold.score + RINGS.allGold.score)
    newSector(s)
    assert.equal(s.gold, 0)
    collectRing(s, 'gold'); collectRing(s, 'gold')
    assert.equal(collectRing(s, 'gold').cue, 'gold:all')
  })

  it('ALL GOLD with full bombs pays score instead', () => {
    const s = createArsenal()
    s.bombs = BOMB.max
    collectRing(s, 'gold'); collectRing(s, 'gold')
    const r = collectRing(s, 'gold')
    assert.equal(r.bombs, 0)
    assert.equal(s.bombs, BOMB.max)
    assert.ok(r.score >= RINGS.gold.score + RINGS.allGold.score + MAXED_SCORE)
  })
})

describe('Star Fox NOVA BOMB', () => {
  it('fires only with bombs in stock and off cooldown', () => {
    const s = createArsenal()
    assert.ok(useBomb(s))
    assert.equal(s.bombs, 2)
    assert.ok(!useBomb(s), 'cooldown')
    tickArsenal(s, BOMB.cooldown)
    assert.ok(useBomb(s))
    tickArsenal(s, BOMB.cooldown)
    assert.ok(useBomb(s))
    tickArsenal(s, BOMB.cooldown)
    assert.equal(s.bombs, 0)
    assert.ok(!useBomb(s))
  })

  it('detonates at range; kills ordinary enemies, not carriers; hits bosses hard', () => {
    assert.ok(bombFuse() > 0.4 && bombFuse() < 1.2)
    assert.ok(BOMB.blastRadius > BOMB.contactRadius)
    assert.ok(inBlast(0, 0, -70, 5, 3, -60))
    assert.ok(!inBlast(0, 0, -70, 0, 0, -40))
    for (const k of ['drone', 'sniper', 'kamikaze', 'weaver', 'dasher', 'bulwark', 'splitter', 'mite', 'turret', 'missile']) {
      assert.ok(bombDamage(k) >= ENEMY_STATS[k].hp, k)
    }
    assert.ok(bombDamage('carrier') < ENEMY_STATS.carrier.hp)
    assert.ok(bombDamage('core') > CHARGE.bossDamage)
    assert.ok(bombDamage('part') > 0)
    assert.ok(BOMB.clearsBolts && BOMB.breaksShields)
  })
})

describe('Star Fox charge shot', () => {
  it('fills over 0.7 s and is ready from there', () => {
    assert.equal(CHARGE.hold, 0.7)
    assert.equal(chargeLevel(0), 0)
    assert.ok(Math.abs(chargeLevel(0.35) - 0.5) < 1e-9)
    assert.equal(chargeLevel(3), 1)
    assert.ok(!chargeReady(0.69))
    assert.ok(chargeReady(0.7))
    assert.ok(CHARGE.breaksShields)
    assert.ok(CHARGE.damage > 1 && CHARGE.blastRadius > 0 && CHARGE.turnRate > 0)
  })

  it('locks the nearest target inside the forward cone and range', () => {
    const ship = { x: 0, y: 1 }
    const targets = [
      { id: 1, x: 0, y: 1, z: -120 },
      { id: 2, x: 2, y: 1, z: -60 },
      { id: 3, x: 40, y: 1, z: -30 }, // outside the cone
      { id: 4, x: 0, y: 1, z: -400 }, // out of range
      { id: 5, x: 0, y: 1, z: 20 }, // behind
    ]
    assert.equal(pickChargeTarget(ship, targets).id, 2)
    assert.equal(pickChargeTarget(ship, targets.slice(2)), null)
    assert.equal(pickChargeTarget(ship, []), null)
  })
})

describe('Star Fox capsule drops', () => {
  it('spaces capsules regularly', () => {
    assert.ok(DROP.minGap >= 8 && DROP.maxGap > DROP.minGap)
  })

  it('weights by need', () => {
    const base = capsuleWeights(ctx())
    assert.equal(base.wing, 0, 'no wing capsule while Claude flies')
    assert.ok(capsuleWeights(ctx({ hp: 20 })).shield > base.shield * 2)
    assert.ok(capsuleWeights(ctx({ bombs: 0 })).bomb > base.bomb * 2)
    assert.equal(capsuleWeights(ctx({ bombs: BOMB.max })).bomb, 0)
    assert.ok(capsuleWeights(ctx({ wingDown: true })).wing > 0)
    assert.ok(capsuleWeights(ctx({ laser: 3 })).laser < base.laser)
    assert.ok(capsuleWeights(ctx({ hp: 20, shieldOn: true })).shield < capsuleWeights(ctx({ hp: 20 })).shield)
  })

  it('picks every type sometime and favours the need', () => {
    const count = (c) => {
      const n = { laser: 0, bomb: 0, shield: 0, wing: 0, overdrive: 0 }
      for (let i = 0; i < 1000; i++) n[pickCapsule(c, () => (i + 0.5) / 1000)]++
      return n
    }
    const calm = count(ctx({ wingDown: true }))
    for (const t of CAPSULE_TYPES) assert.ok(calm[t] > 0, t)
    const hurt = count(ctx({ hp: 15 }))
    assert.ok(hurt.shield > calm.shield)
    const dry = count(ctx({ bombs: 0 }))
    assert.ok(dry.bomb > calm.bomb)
  })
})

describe('Star Fox wing capsule with a squad (2026-09-25)', () => {
  it('revives every downed wingman and puts the whole squad in overdrive', () => {
    const s = createArsenal()
    const r = applyCapsule(s, 'wing')
    assert.equal(r.respawnWing, true, 'the scene revives all downed wingmen at full hull')
    assert.equal(wingFireMul(s), 2)
  })

  it('wants the wing capsule more the more wingmen are down', () => {
    const w = (n) => capsuleWeights(ctx({ wingsDown: n })).wing
    assert.equal(w(0), 0)
    assert.ok(w(1) > 0 && w(2) > w(1) && w(3) > w(2))
    assert.equal(capsuleWeights(ctx({ wingDown: true })).wing, w(1), 'the single-wingman form still works')
  })

  it('bombs hurt MEGA COBRA like a boss part, not an ordinary enemy', () => {
    assert.equal(bombDamage('rival'), BOMB.partDamage)
    assert.ok(bombDamage('rival') < ENEMY_STATS.rival.hp)
  })
})
