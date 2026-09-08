import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createWingAi,
  callout,
  pickTarget,
  canFire,
  stepWingman,
  CALLOUTS,
  WING_AI,
  THREAT,
  RETARGET_MARGIN
} from '../themes/starfox/wingmanAi.ts'

/**
 * Build a WingInput with sensible defaults, overridable by the caller.
 */
function input(overrides = {}) {
  return {
    dt: 1 / 60,
    now: 0,
    buddy: { x: 3.5, y: -0.8 },
    ship: { x: 0, y: 0, hp: 100 },
    formation: { x: 3.5, y: -0.8 },
    lane: { xMax: 11, yLo: -1.5, yHi: 6 },
    targets: [],
    demo: false,
    ...overrides
  }
}

test('pickTarget prefers kamikaze over drone despite closer z', () => {
  const targets = [
    { id: 1, kind: 'kamikaze', x: 0, y: 0, z: -80, vx: 0 },
    { id: 2, kind: 'drone', x: 0, y: 0, z: -60, vx: 0 }
  ]
  const buddy = { x: 0, y: 0 }
  const result = pickTarget(targets, buddy, null)
  assert.equal(result?.id, 1, 'kamikaze (threat 3) should beat drone (threat 1) despite closer z')
})

test('pickTarget ignores targets outside huntZ', () => {
  const targets = [
    { id: 1, kind: 'dasher', x: 0, y: 0, z: -200, vx: 0 },
    { id: 2, kind: 'dasher', x: 0, y: 0, z: -5, vx: 0 }
  ]
  const buddy = { x: 0, y: 0 }
  const result = pickTarget(targets, buddy, null)
  assert.equal(result, null, 'both targets outside huntZ bounds')
})

test('pickTarget is sticky to current target', () => {
  const targets = [
    { id: 1, kind: 'drone', x: 0, y: 0, z: -80, vx: 0 },
    { id: 2, kind: 'kamikaze', x: 10, y: 0, z: -80, vx: 0 }
  ]
  const buddy = { x: 0, y: 0 }
  const result = pickTarget(targets, buddy, 1)
  assert.equal(result?.id, 1, 'should return current target even if worse-scored')
})

test('pickTarget prefers turret over core at equal positions', () => {
  const targets = [
    { id: 1, kind: 'turret', x: 0, y: 0, z: -80, vx: 0 },
    { id: 2, kind: 'core', x: 0, y: 0, z: -80, vx: 0 }
  ]
  const buddy = { x: 0, y: 0 }
  const result = pickTarget(targets, buddy, null)
  assert.equal(result?.id, 1, 'turret (threat 2.5) should beat core (threat 1)')
})

test('canFire: true at (0.5, 1.0) offset', () => {
  const buddy = { x: 0, y: 0 }
  const target = { x: 0.5, y: 1.0 }
  assert.equal(canFire(buddy, target), true)
})

test('canFire: false at (1.5, 0) offset', () => {
  const buddy = { x: 0, y: 0 }
  const target = { x: 1.5, y: 0 }
  assert.equal(canFire(buddy, target), false, 'x distance 1.5 exceeds fireTolX')
})

test('canFire: false at (0, 2) offset', () => {
  const buddy = { x: 0, y: 0 }
  const target = { x: 0, y: 2 }
  assert.equal(canFire(buddy, target), false, 'y distance 2 exceeds fireTolY')
})

test('stepWingman demo mode ignores targets', () => {
  const ai = createWingAi()
  const inp = input({
    demo: true,
    targets: [{ id: 1, kind: 'dasher', x: 0, y: 0, z: -80, vx: 0 }]
  })
  const step = stepWingman(ai, inp)
  assert.equal(step.mode, 'formation')
  assert.equal(step.fire, false)
  assert.equal(step.say, null)
  assert.equal(step.tx, inp.formation.x)
  assert.equal(step.ty, inp.formation.y)
})

test('stepWingman formation → hunt → regroup → formation cycle', () => {
  const ai = createWingAi()
  const target = { id: 1, kind: 'dasher', x: 5, y: 2, z: -80, vx: 1 }

  // Step 1: target appears, formation → hunt with breakOff
  let inp = input({ targets: [target] })
  let step = stepWingman(ai, inp)
  assert.equal(step.mode, 'hunt')
  assert.ok(CALLOUTS.breakOff.includes(step.say), 'should emit breakOff callout')
  assert.equal(ai.leftSlot, true)
  const firstTx = step.tx
  assert.ok(firstTx > 3.5, 'tx should approach target.x + lead time')

  // Steps 2-10: stay in hunt with target
  for (let i = 0; i < 9; i++) {
    inp = input({ targets: [target] })
    step = stepWingman(ai, inp)
    assert.equal(step.mode, 'hunt', `step ${i + 2}`)
    assert.equal(step.say, null, `no callout in stable hunt`)
  }

  // Step 11+: remove target, hunt continues until minHuntTime expires
  // Keep buddy away from formation so it doesn't immediately transition to formation
  for (let i = 0; i < 100; i++) {
    inp = input({ targets: [], buddy: { x: 0, y: 0 } })
    step = stepWingman(ai, inp)
    if (step.mode === 'regroup') break
  }
  assert.equal(step.mode, 'regroup', 'should transition to regroup after minHuntTime')

  // Regroup: buddy approaches formation
  ai.modeT = 0
  inp = input({ buddy: { x: 3.5, y: -0.8 }, targets: [] })
  step = stepWingman(ai, inp)
  assert.equal(step.mode, 'formation')
  assert.ok(CALLOUTS.regroup.includes(step.say), 'should emit regroup callout')
  assert.equal(ai.leftSlot, false, 'leftSlot should reset')
})

test('stepWingman lock on different target after retargetCooldown', () => {
  const ai = createWingAi()
  const target1 = { id: 1, kind: 'drone', x: 5, y: 2, z: -80, vx: 1 }
  const target2 = { id: 2, kind: 'kamikaze', x: 6, y: 1, z: -100, vx: 0 }

  // Set up: already in hunt with target1
  ai.mode = 'hunt'
  ai.targetId = 1
  ai.retargetT = 0 // Cooldown expired

  // Target1 gone, target2 (better) appears
  const inp = input({ targets: [target2] })
  const step = stepWingman(ai, inp)
  assert.ok(CALLOUTS.lock.includes(step.say), 'should emit lock callout')
  assert.equal(ai.targetId, 2, 'should switch to new target')
})

test('stepWingman cover mode', () => {
  const ai = createWingAi()

  // Ship HP critical: formation → cover with cover callout
  let inp = input({ ship: { x: 0, y: 0, hp: 20 } })
  let step = stepWingman(ai, inp)
  assert.equal(step.mode, 'cover')
  assert.ok(CALLOUTS.cover.includes(step.say), 'should emit cover callout')
  assert.equal(step.tx, inp.formation.x)
  assert.equal(step.ty, inp.formation.y)

  // Second step: stay in cover, no new callout
  inp = input({ ship: { x: 0, y: 0, hp: 20 } })
  step = stepWingman(ai, inp)
  assert.equal(step.mode, 'cover')
  assert.equal(step.say, null, 'no second callout in cover')

  // With target in line of sight: still fire
  inp = input({
    ship: { x: 0, y: 0, hp: 20 },
    buddy: { x: 0, y: 0 },
    targets: [{ id: 1, kind: 'dasher', x: 0.3, y: 0.5, z: -80, vx: 0 }]
  })
  step = stepWingman(ai, inp)
  assert.equal(step.fire, true, 'should fire at target in lane')

  // Ship recovers: cover → regroup (keep buddy away from formation)
  inp = input({ ship: { x: 0, y: 0, hp: 50 }, buddy: { x: 0, y: 0 } })
  step = stepWingman(ai, inp)
  assert.equal(step.mode, 'regroup', 'should transition to regroup')
  assert.equal(step.say, null, 'no callout when exiting cover')
})

test('stepWingman lane clamping', () => {
  const ai = createWingAi()
  const target = { id: 1, kind: 'dasher', x: 40, y: 40, z: -80, vx: 0 }
  ai.mode = 'hunt'
  ai.targetId = 1

  const inp = input({ targets: [target] })
  const step = stepWingman(ai, inp)
  assert.equal(step.tx, inp.lane.xMax, 'tx clamped to lane.xMax')
  assert.equal(step.ty, inp.lane.yHi, 'ty clamped to lane.yHi')
})

test('stepWingman fire only with line of sight', () => {
  const ai = createWingAi()

  // Target too far in x
  let inp = input({
    buddy: { x: 0, y: 0 },
    targets: [{ id: 1, kind: 'dasher', x: 3, y: 0, z: -80, vx: 0 }]
  })
  let step = stepWingman(ai, inp)
  assert.equal(step.fire, false, 'target too far in x')

  // Target in range
  inp = input({
    buddy: { x: 0, y: 0 },
    targets: [{ id: 1, kind: 'dasher', x: 0.3, y: 0.5, z: -80, vx: 0 }]
  })
  step = stepWingman(ai, inp)
  assert.equal(step.fire, true, 'target in line of sight')
})

test('callout cycles deterministically', () => {
  const ai = createWingAi()
  const callouts = CALLOUTS.lock

  const s1 = callout(ai, 'lock')
  const s2 = callout(ai, 'lock')
  const s3 = callout(ai, 'lock')

  assert.equal(s1, callouts[0])
  assert.equal(s2, callouts[1])
  if (callouts.length >= 3) {
    assert.equal(s3, callouts[2])
  } else {
    assert.equal(s3, callouts[0]) // Wraps if list shorter
  }
})

test('WING_AI constants', () => {
  assert.equal(WING_AI.retargetCooldown, 0.6)
  assert.equal(WING_AI.minHuntTime, 1.0)
  assert.equal(WING_AI.fireTolX, 0.9)
  assert.equal(WING_AI.fireTolY, 1.3)
  assert.deepEqual(WING_AI.huntZ, [-170, -10])
  assert.equal(WING_AI.leadTime, 0.45)
  assert.equal(WING_AI.coverHp, 30)
  assert.equal(WING_AI.calloutTime, 2.2)
  assert.equal(WING_AI.regroupRadius, 1.5)
  assert.equal(WING_AI.turnRate.formation, 5)
  assert.equal(WING_AI.turnRate.hunt, 7)
  assert.equal(WING_AI.turnRate.regroup, 5)
  assert.equal(WING_AI.turnRate.cover, 5)
})

test('THREAT table', () => {
  assert.equal(THREAT.kamikaze, 3)
  assert.equal(THREAT.mite, 3)
  assert.equal(THREAT.dasher, 3)
  assert.equal(THREAT.sniper, 2)
  assert.equal(THREAT.weaver, 1.5)
  assert.equal(THREAT.splitter, 1.5)
  assert.equal(THREAT.drone, 1)
  assert.equal(THREAT.bulwark, 0.5)
  assert.equal(THREAT.turret, 2.5)
  assert.equal(THREAT.core, 1)
})

test('pickTarget lets a much better target steal the lock', () => {
  const buddy = { x: 0, y: 0 }
  // current: a far-off drone; newcomer: a kamikaze right in the lane
  const drone = { id: 1, kind: 'drone', x: 8, y: 0, z: -100, vx: 0 }
  const kami = { id: 2, kind: 'kamikaze', x: 0, y: 0, z: -60, vx: 0 }
  assert.equal(pickTarget([drone, kami], buddy, 1).id, 2)
  // a marginally better neighbour does not: stickiness holds
  const drone2 = { id: 3, kind: 'drone', x: 7, y: 0, z: -100, vx: 0 }
  assert.equal(pickTarget([drone, drone2], buddy, 1).id, 1)
  assert.ok(RETARGET_MARGIN > 0)
})
