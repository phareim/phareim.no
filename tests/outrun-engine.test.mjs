import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  SEG_LEN, MAX_SPEED, STAGE_SEGS, FORK_SEGS, TRANSITION_SEGS, FORK_SPLIT, CHECKPOINT_AT,
  START_TIME, COUNTDOWN, OFFROAD_MAX, TUMBLE_TIME, CLOSE_PASS_SCORE, GOAL_TIME_SCORE,
  STAGES, STAGE_COUNT, EXTEND_TIME, LANES,
  createGame, stepGame, autopilot, displaySpeed, totalScore, worldX, nearestCenter,
  segmentAt, difficulty,
} from '../themes/outrun/engine.ts'

const GAS = { steer: 0, gas: true, brake: false }
const COAST = { steer: 0, gas: false, brake: false }

/** A game past its countdown with no traffic, for clean physics. */
function clean(seed = 1, opts = {}) {
  const s = createGame(seed, { countdown: false, ...opts })
  s.cars = []
  s.spawnT = 1e9
  return s
}

function run(s, seconds, input = GAS, demo = false) {
  const events = []
  for (let t = 0; t < seconds; t += 1 / 60) {
    s.spawnT = Math.max(s.spawnT, 1e8)
    events.push(...stepGame(s, 1 / 60, typeof input === 'function' ? input(s) : input, demo))
  }
  return events
}

/** Flattens a straight, level stretch ahead of the car and parks the car at its start. */
function parkOnStraight(s, len = 30) {
  const i = Math.floor(s.position / SEG_LEN) + 5
  const y = s.segments[i].y
  for (let k = i; k < i + len + 2 && k < s.segments.length; k++) {
    s.segments[k].curve = 0
    s.segments[k].y = y
  }
  s.position = i * SEG_LEN
  s.playerX = s.segments[i].centers[0]
  return i
}

describe('stages', () => {
  it('is a pyramid of fifteen named stages', () => {
    assert.equal(STAGES.length, STAGE_COUNT)
    STAGES.forEach((col, k) => assert.equal(col.length, k + 1))
    const names = STAGES.flat().map(d => d.name)
    assert.equal(new Set(names).size, 15)
  })

  it('gets harder to the right and further in', () => {
    assert.ok(difficulty(0, 0) < difficulty(1, 0))
    assert.ok(difficulty(1, 0) < difficulty(1, 1))
    assert.ok(difficulty(4, 4) > difficulty(4, 0))
  })
})

describe('road', () => {
  it('is deterministic per seed', () => {
    const a = createGame(42)
    const b = createGame(42)
    assert.equal(a.segments.length, b.segments.length)
    assert.deepEqual(a.segments.slice(0, 500).map(s => [s.curve, s.y]), b.segments.slice(0, 500).map(s => [s.curve, s.y]))
    const c = createGame(43)
    assert.notDeepEqual(a.segments.slice(0, 800).map(s => s.curve), c.segments.slice(0, 800).map(s => s.curve))
  })

  it('builds a stage body, a fork and a shared run-in', () => {
    const s = createGame(7)
    assert.ok(s.forkZoneStart >= STAGE_SEGS && s.forkZoneStart < STAGE_SEGS + 80)
    assert.equal(s.segments.length, s.forkZoneStart + FORK_SEGS + TRANSITION_SEGS)
    assert.ok(s.forkDecide > s.forkZoneStart && s.forkDecide < s.forkZoneEnd)
    // Branches open up through the fork and stay apart in the run-in.
    const zone = s.segments.slice(s.forkZoneStart, s.forkZoneEnd)
    assert.ok(zone.some(seg => seg.props.some(p => p.kind === 'gore')))
    const runIn = s.segments[s.forkZoneEnd + 5]
    assert.deepEqual(runIn.centers, [-FORK_SPLIT, FORK_SPLIT])
    assert.ok(s.segments[s.forkZoneEnd + CHECKPOINT_AT].tag === 'checkpoint')
    // A direction board over the road before the split.
    assert.ok(s.segments.slice(s.forkZoneStart - 60, s.forkZoneStart).some(seg => seg.props.some(p => p.kind === 'gantry' && p.label?.includes('|'))))
  })

  it('never puts roadside props on the asphalt', () => {
    const s = createGame(3)
    for (const seg of s.segments) {
      if (seg.centers.length !== 1) continue
      for (const p of seg.props) {
        if (p.kind === 'gantry' || p.kind === 'arch') continue
        assert.ok(Math.abs(p.rel) > 1.1, `${p.kind} at ${p.rel} on segment ${seg.index}`)
      }
    }
  })

  it('resolves branch placements', () => {
    const seg = { centers: [-2, 2] }
    assert.equal(worldX(seg, -1, 0.5), -1.5)
    assert.equal(worldX(seg, 1, -0.5), 1.5)
    assert.equal(worldX(seg, 0, 0), 0)
    assert.equal(worldX({ centers: [3] }, -1, 0.64), 3.64)
    assert.equal(nearestCenter(seg, -0.1), -2)
    assert.equal(nearestCenter(seg, 0.1), 2)
  })
})

describe('start', () => {
  it('counts down before the car can move', () => {
    const s = createGame(1)
    s.cars = []
    const z0 = s.position
    const events = run(s, COUNTDOWN - 0.1)
    assert.equal(s.status, 'countdown')
    assert.equal(s.position, z0)
    assert.deepEqual(events.filter(e => e.type === 'countdown').map(e => e.n), [2, 1])
    const go = run(s, 0.3)
    assert.ok(go.some(e => e.type === 'go'))
    assert.equal(s.status, 'run')
    assert.equal(s.time <= START_TIME, true)
  })
})

describe('driving', () => {
  it('accelerates through five gears to near top speed', () => {
    const s = clean(5)
    parkOnStraight(s, 400)
    s.speed = 0
    const events = run(s, 14)
    const shifts = events.filter(e => e.type === 'shift').map(e => e.gear)
    assert.deepEqual(shifts.slice(0, 4), [1, 2, 3, 4])
    assert.ok(displaySpeed(s) > 255, `only ${displaySpeed(s)} km/h`)
    assert.ok(displaySpeed(s) < 300)
  })

  it('reaches 200 km/h in a few seconds', () => {
    const s = clean(5)
    parkOnStraight(s, 300)
    s.speed = 0
    run(s, 4.5)
    assert.ok(displaySpeed(s) >= 200, `${displaySpeed(s)} km/h after 4.5 s`)
  })

  it('coasts down without gas and brakes hard', () => {
    const s = clean(5)
    parkOnStraight(s, 400)
    s.speed = MAX_SPEED * 0.9
    run(s, 1, COAST)
    const coasted = s.speed
    assert.ok(coasted < MAX_SPEED * 0.9)
    assert.ok(coasted > MAX_SPEED * 0.75, 'lifting off is not a brake')
    run(s, 1, { steer: 0, gas: false, brake: true })
    assert.ok(s.speed < coasted - MAX_SPEED * 0.5)
  })

  it('bogs down in the dirt', () => {
    const s = clean(5)
    const i = parkOnStraight(s, 300)
    for (let k = i; k < i + 300; k++) s.segments[k].props = []
    s.playerX = s.segments[i].centers[0] + 1.8
    s.speed = MAX_SPEED
    const ev = run(s, 2.5)
    assert.ok(ev.some(e => e.type === 'offroad' && e.on))
    assert.ok(s.speed < OFFROAD_MAX * 1.1, `${displaySpeed(s)} km/h off-road`)
  })

  it('smooths the steering and steers harder at speed', () => {
    const s = clean(5)
    parkOnStraight(s, 400)
    s.speed = MAX_SPEED * 0.8
    stepGame(s, 1 / 60, { steer: 1, gas: true, brake: false })
    assert.ok(s.steer > 0 && s.steer < 0.5)
    const x0 = s.playerX
    run(s, 0.4, { steer: 1, gas: true, brake: false })
    const fast = s.playerX - x0
    assert.ok(fast > 0.4, `moved ${fast}`)
    const t = clean(5)
    parkOnStraight(t, 400)
    t.speed = MAX_SPEED * 0.1
    const y0 = t.playerX
    run(t, 0.4, { steer: 1, gas: false, brake: false })
    assert.ok(t.playerX - y0 < fast / 2)
  })

  it('is pushed to the outside of a bend', () => {
    const s = clean(9)
    let i = s.segments.findIndex((seg, k) => k > 50 && seg.curve > 3 && s.segments[k + 20]?.curve > 3)
    if (i < 0) {
      i = 200
      for (let k = i; k < i + 60; k++) s.segments[k].curve = 4
    }
    s.position = i * SEG_LEN
    s.playerX = s.segments[i].centers[0]
    s.speed = MAX_SPEED
    run(s, 0.25, COAST)
    assert.ok(s.playerX < s.segments[i].centers[0] - 0.05, `drifted to ${s.playerX}`)
  })

  it('changes lanes at speed without scrubbing, squeals in a hard bend', () => {
    const s = clean(5)
    parkOnStraight(s, 400)
    s.speed = MAX_SPEED
    run(s, 0.3, { steer: 1, gas: true, brake: false })
    assert.ok(s.skid < 0.05, `skid ${s.skid} on a straight`)
    const i = Math.floor(s.position / SEG_LEN) + 2
    for (let k = i; k < i + 100; k++) s.segments[k].curve = 6
    s.position = i * SEG_LEN
    s.playerX = s.segments[i].centers[0]
    s.speed = MAX_SPEED
    run(s, 0.6, { steer: 1, gas: true, brake: false })
    assert.ok(s.skid > 0.3, `skid ${s.skid} in the bend`)
  })
})

describe('traffic', () => {
  function withCarAhead(relSpeed, dzSegs = 2) {
    const s = clean(11)
    const i = parkOnStraight(s, 200)
    const c = s.segments[i].centers[0]
    s.playerX = c
    s.speed = MAX_SPEED * 0.9
    s.cars = [{ id: 1, z: s.position + dzSegs * SEG_LEN, side: 1, rel: 0, targetRel: 0, laneT: 99, speed: s.speed - relSpeed, kind: 0, paint: 0, passed: false }]
    return s
  }

  it('bumps on a soft hit', () => {
    const s = withCarAhead(MAX_SPEED * 0.15)
    const ev = run(s, 1)
    assert.ok(ev.some(e => e.type === 'crash' && e.kind === 'bump'))
    assert.equal(s.crashes, 1)
  })

  it('spins out on a hard hit', () => {
    const s = withCarAhead(MAX_SPEED * 0.5, 3)
    const ev = run(s, 1)
    assert.ok(ev.some(e => e.type === 'crash' && e.kind === 'spin'))
    assert.ok(s.speed < MAX_SPEED * 0.5)
  })

  it('pays for a close pass', () => {
    const s = withCarAhead(MAX_SPEED * 0.4, 6)
    s.cars[0].rel = 0.5
    s.cars[0].targetRel = 0.5
    s.playerX = s.segments[Math.floor(s.position / SEG_LEN)].centers[0] + 0.02
    const before = s.score
    const ev = run(s, 1.5)
    assert.ok(ev.some(e => e.type === 'close'))
    assert.ok(s.score - before >= CLOSE_PASS_SCORE)
    assert.equal(s.crashes, 0)
  })
})

describe('crashes', () => {
  it('tumbles into a roadside prop and restarts on the asphalt', () => {
    const s = clean(13)
    const i = parkOnStraight(s, 200)
    const c = s.segments[i].centers[0]
    for (let k = i; k < i + 200; k++) s.segments[k].props = []
    s.segments[i + 20].props.push({ kind: 'palm', side: 1, rel: 1.6, v: 0 })
    s.playerX = c + 1.6
    s.speed = MAX_SPEED * 0.8
    const ev = run(s, 1)
    assert.ok(ev.some(e => e.type === 'crash' && e.kind === 'tumble'))
    run(s, TUMBLE_TIME, COAST)
    assert.equal(s.crash, null)
    assert.ok(Math.abs(s.playerX - nearestCenter(segmentAt(s, s.position), s.playerX)) <= 0.65)
    assert.ok(s.speed < MAX_SPEED * 0.05)
  })
})

describe('forks and checkpoints', () => {
  function driveThroughFork(side) {
    const s = clean(21)
    s.position = (s.forkZoneStart - 20) * SEG_LEN
    s.playerX = 0
    s.speed = MAX_SPEED * 0.7
    const events = run(s, 8, st => {
      const seg = segmentAt(st, st.position)
      const target = seg.centers.length === 2 ? seg.centers[side < 0 ? 0 : 1] : seg.centers[0] + side * 0.64
      return { steer: Math.max(-1, Math.min(1, (target - st.playerX) * 3)), gas: true, brake: false }
    })
    return { s, events }
  }

  it('takes the left branch to the easier stage', () => {
    const { s, events } = driveThroughFork(-1)
    const fork = events.find(e => e.type === 'fork')
    assert.ok(fork)
    assert.equal(fork.side, -1)
    assert.equal(fork.node, 0)
    const cp = events.find(e => e.type === 'checkpoint')
    assert.ok(cp, 'checkpoint passed')
    assert.equal(s.col, 1)
    assert.equal(s.node, 0)
    assert.deepEqual(s.route, [0, 0])
    assert.equal(cp.extend, EXTEND_TIME[1])
  })

  it('takes the right branch to the harder stage and keeps one road', () => {
    const { s, events } = driveThroughFork(1)
    assert.equal(events.find(e => e.type === 'fork').node, 1)
    assert.equal(s.node, 1)
    assert.equal(s.base, FORK_SPLIT)
    // The run-in now carries one road, on the chosen side.
    const next = segmentAt(s, s.position + SEG_LEN * 30)
    assert.deepEqual(next.centers, [FORK_SPLIT])
    // The next stage was built onto the run-in.
    assert.ok(s.segments.length > STAGE_SEGS * 2)
  })

  it('extends the clock at the checkpoint', () => {
    const { s, events } = driveThroughFork(-1)
    assert.ok(events.some(e => e.type === 'checkpoint'))
    assert.ok(s.time > START_TIME - 8 + EXTEND_TIME[1] - 1)
  })
})

describe('clock', () => {
  it('runs out into TIME UP and the car rolls to a stop', () => {
    const s = clean(2)
    parkOnStraight(s, 400)
    s.speed = MAX_SPEED * 0.8
    s.time = 0.5
    const ev = run(s, 1)
    assert.ok(ev.some(e => e.type === 'timeup'))
    assert.equal(s.status, 'timeout')
    run(s, 8)
    assert.ok(s.speed < 1)
  })

  it('warns each second under ten', () => {
    const s = clean(2)
    parkOnStraight(s, 400)
    s.time = 5.5
    const ev = run(s, 3)
    assert.deepEqual(ev.filter(e => e.type === 'warn').map(e => e.n), [6, 5, 4, 3])
  })

  it('freezes in demo mode and scores nothing', () => {
    const s = clean(2)
    parkOnStraight(s, 400)
    run(s, 3, GAS, true)
    assert.equal(s.time, START_TIME)
    assert.equal(totalScore(s), 0)
  })

  it('scores with speed', () => {
    const s = clean(2)
    parkOnStraight(s, 600)
    s.speed = MAX_SPEED
    run(s, 2)
    assert.ok(totalScore(s) > 4000)
  })
})

describe('goal', () => {
  it('pays the time left at the goal of the fifth stage', () => {
    const s = clean(4, { col: 4, node: 2 })
    assert.equal(s.route.length, 5)
    assert.ok(s.goalAt > 0)
    s.position = (s.goalAt - 10) * SEG_LEN
    s.playerX = s.segments[s.goalAt].centers[0]
    s.speed = MAX_SPEED * 0.8
    s.time = 12.3
    const ev = run(s, 1.5)
    const goal = ev.find(e => e.type === 'goal')
    assert.ok(goal)
    assert.equal(goal.timeBonus, 13 * GOAL_TIME_SCORE)
    assert.equal(s.status, 'goal')
  })
})

describe('autopilot', () => {
  it('drives the attract loop from the start through the first fork', () => {
    const s = createGame(77, { countdown: false })
    let tumbles = 0
    for (let t = 0; t < 80 && s.col === 0; t += 1 / 60) {
      for (const e of stepGame(s, 1 / 60, autopilot(s), true)) if (e.type === 'crash' && e.kind === 'tumble') tumbles++
    }
    assert.equal(s.col, 1, 'reached stage 2')
    assert.equal(tumbles, 0)
  })

  it('keeps to the lanes', () => {
    const s = createGame(78, { countdown: false })
    let off = 0
    let n = 0
    for (let t = 0; t < 40; t += 1 / 60) {
      stepGame(s, 1 / 60, autopilot(s), true)
      if (s.offroad) off++
      n++
    }
    assert.ok(off / n < 0.03, `off-road ${Math.round((off / n) * 100)}% of the time`)
    assert.ok(LANES.length === 3)
  })
})
