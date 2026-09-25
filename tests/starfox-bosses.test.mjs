// The boss fight's pure pieces (themes/starfox/bosses.ts, 2026-09-25): the
// attack clock the scene steps, the debug bar drain, and the lane helpers
// behind the fairness rules (walls, beam, rear mines).
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  BOSS_DEFS, CROWN_BEAM, bossTiming, createBossClock, crownBeamFromLeft, crownBeamHits, crownBeamLane,
  crownRearMineLanes, drainOrder, drainTo, laneAt, laneFloat, laneX, stunBossClock, tickBossClock, twinsCrossGaps,
  twinsWallGap, twinsWallHits,
} from '../themes/starfox/bosses.ts'
import { LANE, LANES, SHIP_SPEED, SHIP_RADIUS, shipLaneRate } from '../themes/starfox/balance.ts'
import { BOSSES } from '../themes/starfox/ids.ts'

/** Run a clock for `secs` in `dt` steps; returns the events with times. */
function runClock(id, secs, { phase = 1, sector = 1, enraged = false, dt = 0.01 } = {}) {
  const c = createBossClock(1)
  const out = []
  for (let t = 0; t < secs; t += dt) {
    const ev = tickBossClock(c, id, dt, phase, sector, enraged)
    if (ev) out.push({ t, ev, id: c.attack?.id })
  }
  return { c, out }
}

describe('Star Fox boss clock', () => {
  it('steps telegraph → active → recover → next, in wheel order', () => {
    const { out } = runClock('pincer', 12)
    assert.equal(out[0].ev, 'begin')
    assert.ok(out[0].t >= 0.99 && out[0].t < 1.05, 'first attack after the delay')
    for (let i = 0; i + 2 < out.length; i += 3) {
      assert.deepEqual(out.slice(i, i + 3).map(e => e.ev), ['begin', 'active', 'recover'])
    }
    const begins = out.filter(e => e.ev === 'begin').map(e => e.id)
    // phase 1 skips brood (phase 2 only)
    assert.deepEqual(begins.slice(0, 4), ['clawSweep', 'spit', 'roar', 'clawSweep'])
  })

  it('holds each stage for its scaled timing', () => {
    const { out } = runClock('moth', 8, { dt: 0.005 })
    const b = out.findIndex(e => e.ev === 'begin')
    const atk = BOSS_DEFS.moth.wheel.find(a => a.id === out[b].id)
    const tm = bossTiming(atk, 1)
    assert.ok(Math.abs(out[b + 1].t - out[b].t - tm.telegraph) < 0.02)
    assert.ok(Math.abs(out[b + 2].t - out[b + 1].t - tm.active) < 0.02)
  })

  it('only picks attacks of the current phase', () => {
    for (const id of BOSSES) {
      for (const phase of [1, 2, 3]) {
        if (!BOSS_DEFS[id].wheel.some(a => a.phases.includes(phase))) continue
        const { out } = runClock(id, 30, { phase })
        for (const e of out.filter(x => x.ev === 'begin')) {
          assert.ok(BOSS_DEFS[id].wheel.find(a => a.id === e.id).phases.includes(phase), `${id} ${phase} ${e.id}`)
        }
      }
    }
  })

  it('a stun drops the attack and freezes the wheel', () => {
    const c = createBossClock(0.1)
    for (let i = 0; i < 20; i++) tickBossClock(c, 'furnace', 0.01, 1, 1, false)
    assert.ok(c.attack)
    stunBossClock(c, 2)
    assert.equal(c.attack, null)
    let ev = null
    for (let i = 0; i < 190; i++) ev = tickBossClock(c, 'furnace', 0.01, 1, 1, false) ?? ev
    assert.equal(ev, null, 'nothing during the stun')
    for (let i = 0; i < 80; i++) ev = tickBossClock(c, 'furnace', 0.01, 1, 1, false) ?? ev
    assert.equal(ev, 'begin', 'the wheel resumes after it')
  })

  it('enrage shortens recovery only', () => {
    const atk = BOSS_DEFS.twins.wheel[0]
    const a = bossTiming(atk, 1, false, 'twins')
    const b = bossTiming(atk, 1, true, 'twins')
    assert.equal(a.telegraph, b.telegraph)
    assert.ok(b.recover < a.recover)
  })
})

describe('Star Fox boss bar drain (debug)', () => {
  const crown = [
    ...Array.from({ length: 6 }, () => ({ hp: 14, inBar: true, fatal: false })),
    { hp: 110, inBar: true, fatal: false },
    { hp: 60, inBar: true, fatal: true },
  ]
  it('takes breakable parts first, the fatal ones last', () => {
    assert.deepEqual(drainOrder(crown), [0, 1, 2, 3, 4, 5, 6, 7])
    const hp = drainTo(crown, 170)
    assert.deepEqual(hp.slice(0, 6), [0, 0, 0, 0, 0, 0])
    assert.equal(hp[6], 110)
    assert.equal(hp[7], 60)
  })
  it('never drains parts outside the bar', () => {
    const pincer = [{ hp: 80, inBar: true, fatal: true }, { hp: 14, inBar: false, fatal: false }, { hp: 14, inBar: false, fatal: false }]
    assert.deepEqual(drainTo(pincer, 40), [40, 14, 14])
  })
})

describe('Star Fox boss lanes and fairness in play', () => {
  it('maps world x to lanes and back', () => {
    for (const hw of [LANE.xWide, LANE.xPortrait]) {
      for (let l = 0; l < LANES; l++) {
        assert.equal(laneAt(laneX(l, hw), hw), l)
        assert.ok(Math.abs(laneFloat(laneX(l, hw), hw) - l) < 1e-9)
      }
    }
  })

  it('a crossing wall spares its gap lane and hits every other', () => {
    for (const hw of [LANE.xWide, LANE.xPortrait]) {
      for (let gap = 0; gap < LANES; gap++) {
        assert.equal(twinsWallHits(gap, laneX(gap, hw), hw), false, `gap ${gap}`)
        for (let l = 0; l < LANES; l++) if (l !== gap) assert.equal(twinsWallHits(gap, laneX(l, hw), hw), true)
      }
      // the edge lanes run on past the corridor
      assert.equal(twinsWallHits(0, -hw, hw), false)
      assert.equal(twinsWallHits(LANES - 1, hw, hw), false)
    }
  })

  it('the next wall gap is reachable before the wall arrives', () => {
    for (let step = 0; step < 6; step++) {
      const gaps = twinsCrossGaps(step)
      for (let i = 1; i < gaps.length; i++) {
        const lanes = Math.abs(gaps[i] - gaps[i - 1])
        for (const hw of [LANE.xWide, LANE.xPortrait]) {
          const need = (lanes * (2 * hw) / LANES) / SHIP_SPEED.x
          assert.ok(need < twinsWallGap(1) && need < twinsWallGap(26), `step ${step} wall ${i}`)
        }
      }
    }
  })

  it('the eye beam starts on the ship side and the ship outruns it', () => {
    assert.equal(crownBeamFromLeft(0), true)
    assert.equal(crownBeamFromLeft(4), false)
    assert.ok(CROWN_BEAM.lanesPerSec < shipLaneRate(LANE.xWide))
    assert.ok(CROWN_BEAM.lanesPerSec < shipLaneRate(LANE.xPortrait))
    // it touches the lane it is in, and not two lanes away
    assert.equal(crownBeamHits(crownBeamLane(0, true), 0, LANE.xWide), true)
    assert.equal(crownBeamHits(crownBeamLane(0, true), 2, LANE.xWide), false)
    // a ship that heads for the far side at full speed from the start lane is never caught after the tell
    for (const hw of [LANE.xWide, LANE.xPortrait]) {
      const rate = shipLaneRate(hw)
      const tell = BOSS_DEFS.crown.wheel.find(a => a.id === 'beam').telegraph
      for (let t = 0; t <= 1.6; t += 0.02) {
        const ship = Math.min(LANES - 1, (tell + t) * rate)
        assert.equal(crownBeamHits(crownBeamLane(t, true), ship, hw), false, `hw ${hw} t ${t.toFixed(2)}`)
      }
    }
  })

  it('rear mines always leave a lane open', () => {
    for (let step = 0; step < 12; step++) {
      for (const n of [1, 3, 4, 5, 9]) {
        const row = crownRearMineLanes(step, n)
        assert.equal(row.length, LANES)
        assert.ok(row.some(v => !v), `step ${step} mines ${n}`)
        assert.equal(row.filter(Boolean).length, Math.min(n, LANES - 1))
      }
    }
  })

  it('ship radius fits inside a gap lane on a phone', () => {
    assert.ok((2 * LANE.xPortrait) / LANES > SHIP_RADIUS * 2)
  })
})
