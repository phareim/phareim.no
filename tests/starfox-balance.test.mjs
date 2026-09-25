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
  ENEMY_STATS, BUDDY_HP, BUDDY_RESPAWN, BUDDY_INVULN, BUDDY_FIRE_INTERVAL, BUDDY_AGGRO,
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
    assert.equal(BUDDY_AGGRO, 0.35)
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

// ---- redesign 2026-09-25: new kinds, behaviour data, ECHO, the five bosses ----

import {
  ENEMY_KINDS, PICKABLE_KINDS, SIGNATURE_KINDS, pickTable, firesMissiles, echoMul, loopTempo,
  LANE, LANES, SHIP_SPEED, SHIP_RADIUS, laneOf, laneCenter, shipLaneRate, laneY,
  ENTRY_PATHS, GNAT, gnatEntry, formationSlot, HORNET, BULWARK, bulwarkShieldOpen,
  CARRIER, carrierPartsLit, TURRET, turretInCone, MISSILE, steerHoming, LANCER,
} from '../themes/starfox/balance.ts'
import { sectorIndex, loopOf, absoluteSector, biomeOf, bossOf, BOSSES } from '../themes/starfox/ids.ts'
import {
  BOSS_DEFS, TELEGRAPH_MIN, bossHpMul, bossParts, bossBarMax, bossPhase, bossEnraged, bossTiming, nextBossAttack,
  pincerPattern, pincerClawSweep, clawCovers, pincerSafeLanes,
  MOTH_PUSH, mothWingPush, mothSporeRow, mothCoreExposed,
  FURNACE_WAVE, FURNACE_KNEEL, furnaceStompSchedule, shockwaveHits, furnaceCoreOpen, furnaceSafeBand,
  twinsBeat, twinsLit, twinsPhase, twinsCrossGaps, twinsWallGap,
  crownPhase, CROWN_BEAM, crownBeamLane,
} from '../themes/starfox/bosses.ts'

const seq = (n) => { let i = 0; return () => ((i++ * 0.6180339887) % 1) }

describe('Star Fox ids and ECHO loops', () => {
  it('maps absolute sectors to index, loop, biome and boss', () => {
    assert.equal(sectorIndex(1), 0)
    assert.equal(sectorIndex(5), 4)
    assert.equal(sectorIndex(6), 0)
    assert.equal(loopOf(5), 0)
    assert.equal(loopOf(6), 1)
    assert.equal(loopOf(11), 2)
    assert.equal(absoluteSector(0, 1), 6)
    assert.equal(biomeOf(3), 'ember')
    assert.equal(bossOf(9), 'twins')
  })

  it('scales monotonically with the loop, with caps', () => {
    for (let s = 1; s < 40; s++) {
      assert.ok(echoMul(s + 5) > echoMul(s))
      assert.ok(loopTempo(s + 5) >= loopTempo(s))
      assert.ok(loopTempo(s) <= 1.6)
      assert.ok(bossHpMul(s + 5) > bossHpMul(s))
      assert.ok(enemyFireInterval(s + 1).lo <= enemyFireInterval(s).lo)
      assert.ok(spawnPace(s + 1) <= spawnPace(s))
    }
    assert.equal(echoMul(5), 1)
    assert.equal(loopTempo(5), 1)
  })
})

describe('Star Fox bestiary (redesign)', () => {
  it('names every kind and keeps stats sane', () => {
    const names = { drone: 'GNAT', kamikaze: 'SPIKE', weaver: 'MANTA', sniper: 'LANCER', dasher: 'HORNET', bulwark: 'BULWARK', splitter: 'POD', mite: 'MITE', carrier: 'CARRIER', turret: 'TURRET', missile: 'MISSILE', rival: 'MEGA COBRA' }
    assert.equal(ENEMY_KINDS.length, 12)
    for (const k of ENEMY_KINDS) assert.equal(ENEMY_STATS[k].name, names[k], k)
    assert.equal(ENEMY_STATS.carrier.hp, 14)
    assert.ok(ENEMY_STATS.carrier.score > ENEMY_STATS.bulwark.score)
    assert.ok(DMG.missile > DMG.bolt)
  })

  it('never picks scripted or launched kinds at random', () => {
    for (let s = 1; s <= 20; s++) {
      const rng = seq()
      for (let i = 0; i < 300; i++) {
        const k = pickEnemyKind(s, rng)
        assert.ok(PICKABLE_KINDS.includes(k), `${k} on sector ${s}`)
      }
      const total = pickTable(s).reduce((a, [, w]) => a + w, 0)
      assert.ok(Math.abs(total - 1) < 1e-9, `weights of sector ${s} sum to 1`)
    }
  })

  it('unlocks the whole bestiary in ECHO, coast included', () => {
    const kinds = new Set(Array.from({ length: 500 }, (_, i) => pickEnemyKind(6, () => (i * 37 % 100) / 100)))
    for (const k of PICKABLE_KINDS) assert.ok(kinds.has(k), k)
  })

  it('gives every sector its signature kinds, each met once in the first pass', () => {
    assert.equal(SIGNATURE_KINDS.length, 5)
    const seen = new Set()
    for (const list of SIGNATURE_KINDS) for (const k of list) {
      assert.ok(!seen.has(k), `${k} introduced twice`)
      seen.add(k)
    }
    assert.ok(SIGNATURE_KINDS[0].includes('drone'))
    assert.ok(firesMissiles(5) && firesMissiles(6) && !firesMissiles(4))
  })
})

describe('Star Fox lanes and behaviour data', () => {
  it('splits the corridor into five lanes', () => {
    assert.equal(LANES, 5)
    assert.equal(laneOf(-1), 0)
    assert.equal(laneOf(1), 4)
    assert.equal(laneOf(0), 2)
    for (let l = 0; l < LANES; l++) assert.equal(laneOf(laneCenter(l)), l)
    assert.ok(shipLaneRate(LANE.xPortrait) > shipLaneRate(LANE.xWide))
    assert.equal(laneY(0), LANE.yLo)
    assert.equal(laneY(1), LANE.yHi)
  })

  it('brings gnats in on curves from off screen into their slot', () => {
    for (const path of ENTRY_PATHS) {
      const slot = formationSlot(1, 3, 0.2, 0.5)
      const start = gnatEntry(path, 0, slot.x, slot.y)
      const end = gnatEntry(path, 1, slot.x, slot.y)
      assert.ok(Math.abs(end.x - slot.x) < 1e-9 && Math.abs(end.y - slot.y) < 1e-9, path)
      assert.ok(Math.abs(start.x) > 1 || start.y > 1, `${path} starts off screen`)
      const mid = gnatEntry(path, 0.5, slot.x, slot.y)
      const straightX = (start.x + end.x) / 2, straightY = (start.y + end.y) / 2
      assert.ok(Math.hypot(mid.x - straightX, mid.y - straightY) > 0.05, `${path} curves`)
    }
    assert.ok(GNAT.entryTime > 0 && GNAT.stagger > 0)
    for (let i = 0; i < 6; i++) {
      const s = formationSlot(i, 6, 0.9, 0.9)
      assert.ok(Math.abs(s.x) <= 0.95 && s.y <= 0.95 && s.y >= 0.05)
    }
  })

  it('opens the bulwark shield around its shot only', () => {
    assert.equal(bulwarkShieldOpen(2, 5), false)
    assert.equal(bulwarkShieldOpen(0.2, 5), true)
    assert.equal(bulwarkShieldOpen(2, 0.1), true)
    assert.equal(bulwarkShieldOpen(2, BULWARK.openTime), false)
  })

  it('warns before hornets overtake, on the outside of the ship', () => {
    assert.ok(HORNET.spawnZ > 0 && HORNET.spawnZ < LANE.killZ)
    assert.ok(HORNET.warnLead >= 1)
    assert.ok(HORNET.sideOffset > SHIP_RADIUS * 2)
    assert.ok(HORNET.turnZ < -40)
    assert.equal(LANCER.sightline, 0.5)
  })

  it('lights carrier parts as it breaks', () => {
    assert.equal(carrierPartsLit(14), 0)
    assert.equal(carrierPartsLit(0), CARRIER.parts)
    let prev = 0
    for (let hp = 14; hp >= 0; hp--) {
      const n = carrierPartsLit(hp)
      assert.ok(n >= prev)
      prev = n
    }
  })

  it('fires turrets only at a ship ahead of them and in their narrow cone', () => {
    assert.equal(turretInCone(0, -100, 0), true)
    assert.equal(turretInCone(0, -40, 10), false)
    assert.equal(turretInCone(0, -200, 0), false, 'outside the fire window')
    assert.equal(turretInCone(0, -10, 0), false, 'too close')
    assert.ok(TURRET.cone < 0.3)
  })

  it('steers homing projectiles at a bounded turn rate, keeping speed', () => {
    const v = steerHoming(0, 0, -36, 1, 0, 0, MISSILE.turnRate, 0.1)
    assert.ok(Math.abs(Math.hypot(v.x, v.y, v.z) - 36) < 1e-9)
    const ang = Math.acos(-v.z / 36)
    assert.ok(Math.abs(ang - MISSILE.turnRate * 0.1) < 1e-9)
    const w = steerHoming(0, 0, -36, 0, 0.001, -1, MISSILE.turnRate, 0.1)
    assert.ok(w.z < -35.99, 'snaps when the turn is small')
  })

  it('lets a ship that breaks late beat a missile', () => {
    const fly = (breakAt, startX) => {
      let mx = 0, my = 2, mz = -80, vx = 0, vy = 0, vz = MISSILE.speed
      let sx = startX
      const dir = startX > 0 ? -1 : 1
      const dt = 1 / 60
      let closest = Infinity
      for (let t = 0; t < MISSILE.life; t += dt) {
        if (-mz < breakAt) sx = Math.max(-LANE.xWide, Math.min(LANE.xWide, sx + dir * SHIP_SPEED.x * dt))
        if (t > MISSILE.arm) {
          const v = steerHoming(vx, vy, vz, sx - mx, 2 - my, 0 - mz, MISSILE.turnRate, dt)
          vx = v.x; vy = v.y; vz = v.z
        }
        mx += vx * dt; my += vy * dt; mz += vz * dt
        closest = Math.min(closest, Math.hypot(sx - mx, 2 - my, 0 - mz))
        if (mz > 5) break
      }
      return closest
    }
    for (const breakAt of [10, 15, 20, 25]) for (const x of [-8, -3, 0, 3, 8]) {
      assert.ok(fly(breakAt, x) > MISSILE.proximity, `break at ${breakAt} from x ${x}`)
    }
    assert.ok(fly(200, 0) < MISSILE.proximity, 'a steady slide from the start gets caught')
  })
})

describe('Star Fox bosses', () => {
  it('defines all five bosses with parts, a wheel and a fatal part', () => {
    for (const id of BOSSES) {
      const d = BOSS_DEFS[id]
      assert.equal(d.id, id)
      assert.ok(d.parts.some(p => p.fatal), id)
      assert.ok(d.wheel.length >= 4, id)
      assert.ok(bossBarMax(id, 1) >= 40, id)
      for (const a of d.wheel) {
        assert.ok(a.telegraph >= 0.3 && a.active > 0 && a.recover > 0, `${id}.${a.id}`)
        assert.ok(a.phases.length > 0)
      }
      // every phase has at least two attacks to cycle
      const phases = id === 'crown' ? [1, 2, 3] : [1, 2]
      for (const ph of phases) assert.ok(d.wheel.filter(a => a.phases.includes(ph)).length >= 2, `${id} phase ${ph}`)
    }
  })

  it('scales HP per loop and whole numbers only', () => {
    for (const id of BOSSES) {
      assert.ok(bossBarMax(id, absoluteSector(BOSSES.indexOf(id), 1)) > bossBarMax(id, absoluteSector(BOSSES.indexOf(id), 0)))
      for (const p of bossParts(id, 13)) assert.ok(Number.isInteger(p.hp) && p.hp >= 1)
    }
  })

  it('walks phases and enrage from the bar', () => {
    assert.equal(bossPhase('pincer', 1), 1)
    assert.equal(bossPhase('pincer', 0.5), 2)
    assert.equal(bossPhase('moth', 0.2), 2)
    assert.ok(bossEnraged('furnace', 0.25))
    assert.ok(!bossEnraged('furnace', 0.8))
  })

  it('steps the wheel through the attacks of the current phase only', () => {
    let step = 0
    const seen = []
    for (let i = 0; i < 6; i++) {
      const r = nextBossAttack('pincer', step, 1)
      seen.push(r.attack.id)
      step = r.step
    }
    assert.deepEqual(seen, ['clawSweep', 'spit', 'roar', 'clawSweep', 'spit', 'roar'])
    step = 0
    const p2 = new Set()
    for (let i = 0; i < 8; i++) { const r = nextBossAttack('pincer', step, 2); p2.add(r.attack.id); step = r.step }
    assert.ok(p2.has('brood'))
    for (let i = 0; i < 12; i++) assert.ok(nextBossAttack('crown', i, 3).attack.phases.includes(3))
  })

  it('never shortens a telegraph below the floor; enrage only cuts recovery', () => {
    for (const id of BOSSES) for (const a of BOSS_DEFS[id].wheel) for (const s of [1, 6, 11, 16, 50]) {
      const calm = bossTiming(a, s, false, id)
      const mad = bossTiming(a, s, true, id)
      assert.ok(calm.telegraph >= TELEGRAPH_MIN)
      assert.equal(mad.telegraph, calm.telegraph)
      assert.ok(mad.recover < calm.recover)
      assert.ok(bossTiming(a, s + 5, false, id).active <= calm.active)
    }
  })

  it('Pincer: claw sweeps always leave a lane open, and it is reachable in time', () => {
    const rate = shipLaneRate(LANE.xWide)
    for (const phase of [1, 2]) for (let step = 0; step < 6; step++) for (const alive of [[true, true], [true, false], [false, true]]) {
      const pat = pincerPattern(step, phase, alive)
      assert.ok(pat.left + pat.right <= LANES - 1)
      const safe = pincerSafeLanes(pat)
      assert.ok(safe.length >= 1)
      for (const sector of [1, 6, 16]) {
        // a ship starting in any lane heads for the nearest safe lane
        for (let start = 0; start < LANES; start++) {
          let pos = start
          const target = safe.reduce((b, l) => Math.abs(l - start) < Math.abs(b - start) ? l : b, safe[0])
          const sw = { stage: 'telegraph', left: 0, right: 0 }
          for (let t = 0; t < 5; t += 1 / 60) {
            pincerClawSweep(t, pat, sector, sw)
            const dir = Math.sign(target - pos)
            pos = dir > 0 ? Math.min(target, pos + rate / 60) : Math.max(target, pos - rate / 60)
            const lane = Math.round(pos)
            // count the lane the ship's centre is in
            if (sw.stage !== 'telegraph') assert.ok(!clawCovers(sw, lane), `phase ${phase} step ${step} start ${start} t ${t.toFixed(2)}`)
            let open = 0
            for (let l = 0; l < LANES; l++) if (!clawCovers(sw, l)) open++
            assert.ok(open >= 1)
          }
        }
      }
    }
  })

  it('Moth: gusts are weaker than the ship, spore rows keep a gap, the core opens with a panel', () => {
    assert.ok(MOTH_PUSH.max < SHIP_SPEED.x * 0.6)
    for (let t = 0; t <= 1.4; t += 0.05) assert.ok(Math.abs(mothWingPush(t, 1.4, 4, 1)) <= MOTH_PUSH.max + 1e-9)
    assert.equal(mothWingPush(-0.1, 1.4, 4, 1), 0)
    assert.ok(mothWingPush(0.7, 1.4, 0, -1) < 0)
    assert.ok(Math.abs(mothWingPush(0.7, 1.4, 1, 1)) < Math.abs(mothWingPush(0.7, 1.4, 4, 1)))
    for (let step = 0; step < 10; step++) {
      assert.equal(mothSporeRow(step, 1).filter(m => !m).length, 2)
      assert.equal(mothSporeRow(step, 2).filter(m => !m).length, 1)
    }
    assert.equal(mothCoreExposed(4), false)
    assert.equal(mothCoreExposed(3), true)
  })

  it('Furnace: stomp waves can always be flown over, spaced, one per live leg', () => {
    assert.ok(furnaceSafeBand() >= 2, 'at least two units of sky above the wave')
    for (const s of [1, 3, 8, 13, 48]) for (const ph of [1, 2]) {
      const sch = furnaceStompSchedule(s, ph)
      assert.ok(sch.length >= 3)
      for (let i = 1; i < sch.length; i++) assert.ok(sch[i].at - sch[i - 1].at >= 0.5)
      for (const st of sch) {
        assert.equal(shockwaveHits(st.top, LANE.yHi), false)
        assert.ok(st.top < LANE.yHi - SHIP_RADIUS - 2)
      }
      // time to climb from the floor over the wave before it arrives
      const climb = (sch[0].top + SHIP_RADIUS - LANE.yLo) / SHIP_SPEED.y
      const travel = Math.abs(BOSS_DEFS.furnace.parkZ) / sch[0].speed
      assert.ok(climb < travel + TELEGRAPH_MIN)
    }
    assert.equal(shockwaveHits(FURNACE_WAVE.groundY + FURNACE_WAVE.height, LANE.yLo), true)
    const two = furnaceStompSchedule(1, 1, [true, false, true])
    assert.ok(two.every(s => s.leg !== 1))
    assert.equal(furnaceStompSchedule(1, 1, [false, false, false]).length, 0)
    assert.equal(furnaceCoreOpen(2, 0), false)
    assert.equal(furnaceCoreOpen(2, FURNACE_KNEEL.open), true)
    assert.equal(furnaceCoreOpen(0, 0), true)
  })

  it('Twins: the lit core swaps on the beat with a tell; walls stay reachable', () => {
    const beat = twinsBeat(1)
    assert.equal(twinsLit(0, beat).lit, 0)
    assert.equal(twinsLit(beat + 0.01, beat).lit, 1)
    assert.equal(twinsLit(beat - 0.1, beat).warn, true)
    assert.equal(twinsLit(0.5, beat).warn, false)
    assert.equal(twinsLit(beat * 1.5, beat, [true, false]).lit, 0)
    assert.equal(twinsLit(0, beat, [false, true]).lit, 1)
    assert.equal(twinsPhase([true, true]), 1)
    assert.equal(twinsPhase([false, true]), 2)
    assert.ok(twinsBeat(21) >= 2.4 && twinsBeat(21) < twinsBeat(1))
    for (const s of [1, 6, 16, 50]) {
      const gap = twinsWallGap(s)
      for (let step = 0; step < 12; step++) {
        const gaps = twinsCrossGaps(step)
        assert.equal(gaps.length, 4)
        for (let i = 1; i < gaps.length; i++) {
          const lanes = Math.abs(gaps[i] - gaps[i - 1])
          assert.ok(lanes <= 2)
          assert.ok(lanes / shipLaneRate(LANE.xWide) < gap, `sector ${s}: ${lanes} lanes in ${gap}s`)
        }
      }
    }
  })

  it('Crown: three phases from its parts at any loop; the beam is slower than the ship', () => {
    for (const s of [5, 10, 15, 30]) {
      const parts = bossParts('crown', s)
      const max = bossBarMax('crown', s)
      const turrets = parts.find(p => p.role === 'turret')
      assert.equal(crownPhase(1, s), 1)
      assert.equal(crownPhase((max - turrets.hp * turrets.count + 1) / max, s), 1)
      assert.equal(crownPhase((max - turrets.hp * turrets.count) / max, s), 2, 'turrets gone → eye')
      const heart = parts.find(p => p.role === 'heart')
      assert.equal(crownPhase(heart.hp / max, s), 3, 'eye gone → chase')
      assert.equal(bossPhase('crown', heart.hp / max, s), 3)
    }
    assert.ok(CROWN_BEAM.lanesPerSec < shipLaneRate(LANE.xWide))
    assert.equal(crownBeamLane(0, true), 0)
    assert.equal(crownBeamLane(99, true), LANES - 1)
    assert.equal(crownBeamLane(0, false), LANES - 1)
  })
})

// ---- the squad, aggro, allied DPS, MEGA COBRA, DINGO (2026-09-25) ----------------

import {
  WINGMEN, SQUAD, RESERVES, WING_AGGRO_MAX, aggroShares, pickAggroTarget,
  DINGO_TROUBLE, dingoWeave, dingoTroubleOutcome,
  RIVAL, rivalHp, rivalEscapes, rivalShouldRoll, rivalHitCue,
} from '../themes/starfox/balance.ts'
import {
  PLAYER_BOSS_DPS, alliedDps, wingmanDps, bossTtk, bossTtkRecovering, BOSS_UPTIME,
} from '../themes/starfox/bosses.ts'

describe('Star Fox squad profiles', () => {
  it('flies three named pilots with two in reserve', () => {
    assert.deepEqual([...SQUAD], ['heron', 'bison', 'dingo'])
    assert.deepEqual([...RESERVES], ['walrus', 'zebra'])
    assert.equal(WINGMEN.heron.role, 'ace')
    assert.equal(WINGMEN.bison.role, 'veteran')
    assert.equal(WINGMEN.dingo.role, 'rookie')
  })

  it('makes bison tanky, dingo fragile, heron the hunter, bison the guard', () => {
    assert.ok(WINGMEN.bison.hp > WINGMEN.heron.hp && WINGMEN.heron.hp > WINGMEN.dingo.hp)
    assert.ok(WINGMEN.heron.huntZ[0] < WINGMEN.dingo.huntZ[0] && WINGMEN.dingo.huntZ[0] < WINGMEN.bison.huntZ[0])
    assert.ok(WINGMEN.heron.leash > WINGMEN.dingo.leash && WINGMEN.dingo.leash > WINGMEN.bison.leash)
    assert.ok(WINGMEN.bison.guard > WINGMEN.dingo.guard && WINGMEN.heron.guard === 0)
    assert.ok(WINGMEN.heron.steal > 0 && WINGMEN.bison.steal === 0)
    assert.ok(WINGMEN.heron.fireInterval < WINGMEN.bison.fireInterval)
    for (const id of [...SQUAD, ...RESERVES]) {
      const p = WINGMEN[id]
      assert.ok(p.respawn >= 8 && p.respawn <= 14, id)
      assert.ok(p.fireInterval > 1 / 6, `${id} fires slower than the player`)
    }
  })

  it('keeps formation slots clear of the lasers, the ship and each other', () => {
    const LASER_X = 3.1 // Flight.vue LASER_OFFS
    for (const id of SQUAD) {
      const s = WINGMEN[id].slot
      // lasers fly forward (−z) from x ±3.1: a slot beside them or behind the ship
      assert.ok(Math.abs(Math.abs(s.x) - LASER_X) >= 0.3 || s.z >= 2, `${id} off the laser lines`)
      assert.ok(s.z >= 0, `${id} not ahead of the ship`)
      // camera sits behind and above (0, 3.6, 10.5): stay out of its line to the ship
      assert.ok(Math.abs(s.x) >= 2.5, `${id} out of the camera's line to the ship`)
    }
    for (let i = 0; i < SQUAD.length; i++) for (let j = i + 1; j < SQUAD.length; j++) {
      const a = WINGMEN[SQUAD[i]].slot, b = WINGMEN[SQUAD[j]].slot
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >= 2.5, `${SQUAD[i]}/${SQUAD[j]} apart`)
    }
    const sides = SQUAD.map(id => Math.sign(WINGMEN[id].slot.x))
    assert.ok(sides.includes(1) && sides.includes(-1), 'both sides covered')
  })
})

describe('Star Fox aggro split', () => {
  it('bounds the share of fire drawn by wingmen, fewer wingmen draw less', () => {
    const all = aggroShares(SQUAD)
    const sum = all.reduce((a, b) => a + b, 0)
    assert.ok(sum <= WING_AGGRO_MAX + 1e-9 && sum > 0.3)
    assert.ok(WING_AGGRO_MAX <= 0.45)
    const two = aggroShares(['heron', 'dingo']).reduce((a, b) => a + b, 0)
    assert.ok(two < sum)
    assert.deepEqual(aggroShares([]), [])
    // bison draws the most
    assert.ok(all[1] > all[0] && all[0] > all[2])
    // five pilots at once are still capped
    const five = aggroShares([...SQUAD, ...RESERVES]).reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(five - WING_AGGRO_MAX) < 1e-9)
  })

  it('picks the player for the rest of the draws', () => {
    const n = 1000
    const counts = { player: 0, heron: 0, bison: 0, dingo: 0 }
    for (let i = 0; i < n; i++) counts[pickAggroTarget(SQUAD, (i + 0.5) / n) ?? 'player']++
    assert.ok(counts.player / n >= 1 - WING_AGGRO_MAX - 0.01)
    assert.ok(counts.bison > counts.heron && counts.heron > counts.dingo)
    assert.equal(pickAggroTarget([], 0.01), null)
  })
})

describe('Star Fox allied DPS and time-to-kill', () => {
  const s = (id) => BOSSES.indexOf(id) + 1

  it('adds each wingman to the player and doubles them under the wing overdrive', () => {
    assert.equal(alliedDps(2, []), PLAYER_BOSS_DPS[2])
    const three = alliedDps(2, SQUAD)
    assert.ok(Math.abs(three - PLAYER_BOSS_DPS[2] - SQUAD.reduce((a, id) => a + wingmanDps(id), 0)) < 1e-9)
    assert.ok(alliedDps(2, SQUAD, true) > three)
    assert.ok(three / alliedDps(2, []) < 1.8, 'the squad helps without replacing the player')
    for (const id of SQUAD) assert.ok(wingmanDps(id) < PLAYER_BOSS_DPS[1])
  })

  it('keeps a typical fight (TWIN+, three wingmen) at 30–65 s', () => {
    for (const id of BOSSES) {
      const ttk = bossTtk(id, s(id), alliedDps(2, SQUAD))
      assert.ok(ttk >= 30 && ttk <= 65, `${id}: ${ttk.toFixed(1)} s`)
    }
  })

  it('never melts a boss, even at HYPER with the wing overdrive', () => {
    for (const id of BOSSES) assert.ok(bossTtk(id, s(id), alliedDps(3, SQUAD, true)) >= 15, id)
  })

  it('stays fightable with the whole squad down', () => {
    for (const id of BOSSES) {
      // down for the whole fight at TWIN+
      assert.ok(bossTtk(id, s(id), alliedDps(2, [])) <= 100, `${id} alone`)
      // down at the start at TWIN, back after their respawn
      assert.ok(bossTtkRecovering(id, s(id), 1, SQUAD, SQUAD) <= 100, `${id} recovering`)
      assert.ok(bossTtkRecovering(id, s(id), 2, SQUAD, SQUAD) > bossTtk(id, s(id), alliedDps(2, SQUAD)))
    }
  })

  it('gets longer in ECHO but not twice as long per loop', () => {
    for (const id of BOSSES) {
      const a = bossTtk(id, s(id), alliedDps(2, SQUAD))
      const b = bossTtk(id, s(id) + 5, alliedDps(2, SQUAD))
      assert.ok(b > a && b < a * 1.6, id)
    }
    for (const id of BOSSES) assert.ok(BOSS_UPTIME[id] > 0 && BOSS_UPTIME[id] <= 1)
  })
})

describe('Star Fox DINGO in trouble and MEGA COBRA', () => {
  it('weaves DINGO ahead of the player inside the corridor', () => {
    for (const side of [-1, 1]) for (let t = 0; t <= DINGO_TROUBLE.time; t += 0.25) {
      const p = dingoWeave(t, side)
      assert.ok(Math.abs(p.x) <= 0.85 && p.y >= 0.2 && p.y <= 0.9)
    }
    assert.ok(DINGO_TROUBLE.z < -20 && DINGO_TROUBLE.time >= 10 && DINGO_TROUBLE.time <= 14)
    assert.equal(dingoTroubleOutcome(0, 3), 'saved')
    assert.equal(dingoTroubleOutcome(2, 3), 'running')
    assert.equal(dingoTroubleOutcome(1, DINGO_TROUBLE.time), 'lost')
  })

  it('makes MEGA COBRA fast, evasive, ~40 HP, escaping at 60 % in sector 3 only', () => {
    assert.equal(ENEMY_STATS.rival.name, 'MEGA COBRA')
    assert.ok(!PICKABLE_KINDS.includes('rival'))
    assert.ok(RIVAL.speed > SHIP_SPEED.x)
    assert.equal(rivalHp(3, false), 40)
    assert.ok(rivalHp(5, true) > rivalHp(3, false))
    assert.ok(rivalHp(8, false) > rivalHp(3, false))
    assert.equal(rivalEscapes(0.5, false, 5), false)
    assert.equal(rivalEscapes(0.4, false, 5), true, 'escapes after taking 60 %')
    assert.equal(rivalEscapes(0.9, false, RIVAL.duelTime), true, 'or when the duel runs out')
    assert.equal(rivalEscapes(0.01, true, 999), false, 'the final is to the end')
    assert.ok(rivalShouldRoll(RIVAL.dodgeAfter, RIVAL.rollCooldown))
    assert.ok(!rivalShouldRoll(RIVAL.dodgeAfter - 0.1, 9))
    assert.ok(!rivalShouldRoll(9, RIVAL.rollCooldown - 0.1))
    assert.equal(rivalHitCue(0.8, 0.74), 'cobra:hit')
    assert.equal(rivalHitCue(0.7, 0.6), null)
    assert.ok(RIVAL.burst.telegraph >= TELEGRAPH_MIN * 0.75 && RIVAL.spread.telegraph >= TELEGRAPH_MIN)
  })
})
