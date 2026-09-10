import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  SEG_LEN, RUMBLE, DRAW_DIST, ROAD_WIDTH, MAX_SPEED, ACCEL, BRAKE,
  M_PER_SEG, START_TIME, CHECKPOINT_TIME, CHECKPOINT_M, CHECKPOINT_SCORE,
  NEAR_MISS_SCORE, PASS_SCORE, CRASH_GAP, NEAR_MISS_GAP,
  createGame, stepGame, totalScore, displaySpeed, ensureRoad,
  appendSection, stageName, stagePalette, nextRandom,
} from '../themes/outrun/engine.ts'

const INPUT = { left: false, right: false, brake: false }

function fullSpeed(state, seconds = 8) {
  for (let t = 0; t < seconds; t += 1 / 60) stepGame(state, 1 / 60, INPUT)
}

/** A traffic-free run: deterministic speed/position for physics tests. */
function cleanRun(state, seconds = 8) {
  state.spawnT = 1e9
  state.cars = []
  for (let t = 0; t < seconds; t += 1 / 60) {
    state.spawnT = 1e9
    state.playerX = 0 // the fixture holds the centre through bends
    stepGame(state, 1 / 60, INPUT)
  }
  state.cars = []
  state.playerX = 0
  state.offroad = false
}

describe('OutRun road generation', () => {
  it('opens with a straight and a gantry arch', () => {
    const s = createGame(7)
    assert.ok(s.segments.length > DRAW_DIST)
    assert.equal(s.segments[0].curve, 0)
    assert.ok(s.segments[30].props.some(p => p.kind === 3))
  })

  it('is deterministic per seed and varies across seeds', () => {
    const a = createGame(11)
    const b = createGame(11)
    const c = createGame(12)
    fullSpeed(a, 30)
    fullSpeed(b, 30)
    fullSpeed(c, 30)
    assert.equal(a.segments.length, b.segments.length)
    assert.equal(a.position, b.position)
    assert.notEqual(a.segments.length, c.segments.length)
  })

  it('builds road ahead on demand and alternates rumble bands', () => {
    const s = createGame(3)
    ensureRoad(s, 5000)
    assert.ok(s.segments.length > 5000 + DRAW_DIST)
    const bands = s.segments.slice(0, RUMBLE * 4).map(g => g.band)
    assert.deepEqual(bands, [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 1, 1])
  })

  it('appendSection never repeats a kind three times', () => {
    const s = createGame(5)
    const kinds = []
    for (let i = 0; i < 40; i++) {
      appendSection(s)
      kinds.push(s.lastKind)
    }
    for (let i = 2; i < kinds.length; i++) {
      assert.ok(!(kinds[i] === kinds[i - 1] && kinds[i] === kinds[i - 2]), `triple ${kinds[i]} at ${i}`)
    }
  })

  it('mulberry32 stays in [0, 1)', () => {
    let rng = 42
    for (let i = 0; i < 1000; i++) {
      const r = nextRandom(rng)
      rng = r.rng
      assert.ok(r.value >= 0 && r.value < 1)
    }
  })
})

describe('OutRun driving', () => {
  it('auto-accelerates towards top speed and shows km/h', () => {
    const s = createGame(1)
    cleanRun(s, 10)
    assert.ok(s.speed > MAX_SPEED * 0.95, `speed ${s.speed}`)
    assert.ok(displaySpeed(s) > 250)
  })

  it('brakes slow the car and steering moves it', () => {
    const s = createGame(1)
    cleanRun(s, 8)
    const fast = s.speed
    for (let t = 0; t < 2; t += 1 / 60) stepGame(s, 1 / 60, { left: false, right: false, brake: true })
    assert.ok(s.speed < fast, `brake ${s.speed} vs ${fast}`)
    const x0 = s.playerX
    for (let t = 0; t < 1; t += 1 / 60) stepGame(s, 1 / 60, { left: false, right: true, brake: false })
    assert.ok(s.playerX > x0, `steer ${s.playerX} vs ${x0}`)
  })

  it('curves fling the car outwards without input', () => {
    const s = createGame(1)
    // Park the car mid-track on a bend at speed.
    fullSpeed(s, 20)
    s.playerX = 0
    let pushed = false
    let prev = 0
    for (let t = 0; t < 30; t += 1 / 60) {
      const seg = s.segments[Math.floor(s.position / SEG_LEN)]
      stepGame(s, 1 / 60, INPUT)
      if (Math.abs(seg.curve) > 2 && Math.abs(s.playerX - prev) > 1e-9) pushed = true
      prev = s.playerX
    }
    assert.ok(pushed, 'centrifugal force never moved the car on bends')
  })

  it('off-road caps speed and reports the surface', () => {
    const s = createGame(1)
    cleanRun(s, 8)
    s.playerX = 1.8
    s.offroad = false
    let sawOn = false
    for (let t = 0; t < 6; t += 1 / 60) {
      for (const e of stepGame(s, 1 / 60, INPUT)) if (e.type === 'offroad' && e.on) sawOn = true
    }
    assert.ok(sawOn, 'no offroad event')
    assert.ok(s.speed <= MAX_SPEED / 4 + 1, `offroad speed ${s.speed}`)
  })

  it('stays inside the guard rails', () => {
    const s = createGame(9)
    for (let t = 0; t < 60; t += 1 / 60) {
      stepGame(s, 1 / 60, { left: true, right: false, brake: false })
      assert.ok(Math.abs(s.playerX) <= 2.4)
    }
  })
})

describe('OutRun traffic and scoring', () => {
  it('spawns traffic ahead and prunes it behind', () => {
    const s = createGame(2)
    fullSpeed(s, 20)
    assert.ok(s.cars.length > 0, 'no traffic spawned')
    for (const c of s.cars) assert.ok(c.z > s.position, 'car spawned behind')
  })

  it('a shunt slows the car and fires one crash event', () => {
    const s = createGame(4)
    cleanRun(s, 8)
    s.spawnT = 1e9
    const before = s.speed
    s.cars.push({ z: s.position + 900, offset: s.playerX, speed: MAX_SPEED * 0.3, color: 0, counted: true })
    let crashes = 0
    for (let t = 0; t < 2; t += 1 / 60) {
      for (const e of stepGame(s, 1 / 60, INPUT)) if (e.type === 'crash') crashes++
    }
    assert.equal(crashes, 1)
    assert.equal(s.crashes, 1)
    assert.ok(s.speed < before, `crash speed ${s.speed} vs ${before}`)
    assert.ok(s.crashT >= 0)
  })

  it('threading traffic pays a near-miss bonus', () => {
    const s = createGame(6)
    cleanRun(s, 8)
    s.spawnT = 1e9
    const bonus0 = s.bonus
    // A car just ahead in the next lane: overlap-free but inside the gap.
    s.cars.push({ z: s.position + 1200, offset: s.playerX + (NEAR_MISS_GAP - 0.1), speed: 0, color: 1, counted: false })
    let nears = 0
    for (let t = 0; t < 4; t += 1 / 60) {
      for (const e of stepGame(s, 1 / 60, INPUT)) if (e.type === 'nearmiss') nears++
    }
    assert.equal(nears, 1)
    assert.equal(s.nearMisses, 1)
    assert.equal(s.bonus - bonus0, NEAR_MISS_SCORE)
  })

  it('a wide pass pays the cruise bonus', () => {
    const s = createGame(6)
    cleanRun(s, 8)
    s.spawnT = 1e9
    const bonus0 = s.bonus
    s.cars.push({ z: s.position + 1200, offset: s.playerX > 0 ? -0.85 : 0.85, speed: 0, color: 2, counted: false })
    let passes = 0
    for (let t = 0; t < 4; t += 1 / 60) {
      for (const e of stepGame(s, 1 / 60, INPUT)) if (e.type === 'pass') passes++
    }
    assert.equal(passes, 1)
    assert.equal(s.bonus - bonus0, PASS_SCORE)
  })

  it('score is metres plus bonuses', () => {
    const s = createGame(1)
    cleanRun(s, 5)
    s.bonus += 100
    assert.equal(totalScore(s), Math.floor(s.meters + s.bonus))
    assert.ok(s.meters > 0)
  })
})

describe('OutRun clock and stages', () => {
  it('counts down from 60 and times out into status timeout', () => {
    const s = createGame(1)
    assert.equal(s.time, START_TIME)
    let timeups = 0
    for (let t = 0; t < START_TIME + 30; t += 1 / 60) {
      // Rewind checkpoints so the clock can actually die.
      s.nextCheckpointM = 1e12
      for (const e of stepGame(s, 1 / 60, INPUT)) if (e.type === 'timeup') timeups++
      if (s.status === 'timeout') break
    }
    assert.equal(s.status, 'timeout')
    assert.equal(timeups, 1)
    assert.equal(s.time, 0)
  })

  it('checkpoints add time, score and a stage', () => {
    const s = createGame(1)
    cleanRun(s, 2)
    s.meters = CHECKPOINT_M - 0.5
    s.nextCheckpointM = CHECKPOINT_M
    const time0 = s.time
    const bonus0 = s.bonus
    const stages = []
    let steps = 0
    for (let t = 0; t < 3 && stages.length === 0; t += 1 / 60) {
      steps++
      for (const e of stepGame(s, 1 / 60, INPUT)) if (e.type === 'checkpoint') stages.push(e.stage)
    }
    assert.deepEqual(stages, [1])
    assert.equal(s.stage, 1)
    assert.ok(Math.abs(s.time - (time0 - steps / 60 + CHECKPOINT_TIME)) < 1e-6)
    assert.equal(s.bonus - bonus0, CHECKPOINT_SCORE)
  })

  it('demo mode freezes the clock and steers itself', () => {
    const s = createGame(21)
    for (let t = 0; t < 20; t += 1 / 60) stepGame(s, 1 / 60, INPUT, true)
    assert.equal(s.time, START_TIME)
    assert.equal(s.crashes, 0)
    assert.ok(s.speed > MAX_SPEED * 0.9)
    assert.ok(Math.abs(s.playerX) < 1.5, `demo drifted to ${s.playerX}`)
  })

  it('stage names and palettes cycle without gaps', () => {
    for (let i = 0; i < 12; i++) {
      assert.ok(stageName(i).length > 0)
      const p = stagePalette(i)
      for (const k of ['skyTop', 'skyMid', 'skyGlow', 'sunTop', 'sunBottom', 'mountainFar', 'mountainNear', 'groundA', 'groundB']) {
        assert.match(p[k], /^#[0-9a-f]{6}$/i, `stage ${i} ${k}`)
      }
    }
    assert.equal(stageName(0), stageName(7))
  })
})
