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
  RETARGET_MARGIN,
  inHuntZone,
  isHuntable,
  stepSquad,
  brainOf,
  turnRate,
  threatensShip,
  DEFAULT_BRAIN
} from '../themes/starfox/wingmanAi.ts'
import { WINGMEN, SQUAD } from '../themes/starfox/balance.ts'

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

// ---- redesign 2026-09-25: missiles, carriers, ground turrets, boss parts ----

test('THREAT ranks the new kinds: missile first, carrier low, parts like turrets', () => {
  assert.ok(THREAT.missile > THREAT.kamikaze)
  assert.ok(THREAT.carrier < THREAT.drone * 1.5 && THREAT.carrier > THREAT.bulwark)
  assert.equal(THREAT.part, 2.5)
  assert.ok(THREAT.part > THREAT.core)
})

test('pickTarget shoots down a missile before a diving kamikaze', () => {
  const targets = [
    { id: 1, kind: 'kamikaze', x: 0, y: 0, z: -40, vx: 0 },
    { id: 2, kind: 'missile', x: 0, y: 0, z: -40, vx: 0 }
  ]
  assert.equal(pickTarget(targets, { x: 0, y: 0 }, null).id, 2)
})

test('pickTarget prefers the missile homing on the player', () => {
  const targets = [
    { id: 1, kind: 'missile', x: 1, y: 0, z: -30, vx: 0 },
    { id: 2, kind: 'missile', x: 1, y: 0, z: -30, vx: 0, onShip: true }
  ]
  assert.equal(pickTarget(targets, { x: 0, y: 0 }, null).id, 2)
})

test('missiles stay huntable closer in than the normal window', () => {
  const missile = { id: 1, kind: 'missile', x: 0, y: 0, z: -5, vx: 0 }
  const drone = { id: 2, kind: 'drone', x: 0, y: 0, z: -5, vx: 0 }
  assert.equal(inHuntZone(missile), true)
  assert.equal(inHuntZone(drone), false)
  assert.ok(WING_AI.missileZ > WING_AI.huntZ[1])
  assert.equal(pickTarget([missile, drone], { x: 0, y: 0 }, null).id, 1)
  // and Claude fires at it when lined up
  const step = stepWingman(createWingAi(), input({ buddy: { x: 0, y: 0 }, targets: [missile] }))
  assert.equal(step.fire, true)
})

test('ground turrets are skipped unless nearly in line', () => {
  const buddy = { x: 0, y: 0 }
  const far = { id: 1, kind: 'turret', x: 6, y: -2.4, z: -80, vx: 0 }
  const near = { id: 2, kind: 'turret', x: 1.5, y: -2.4, z: -80, vx: 0 }
  assert.equal(isHuntable(far, buddy), false)
  assert.equal(isHuntable(near, buddy), true)
  assert.equal(pickTarget([far], buddy, null), null)
  const drone = { id: 3, kind: 'drone', x: 8, y: 0, z: -80, vx: 0 }
  assert.equal(pickTarget([far, drone], buddy, null).id, 3)
})

test('carriers come after the fast threats', () => {
  const targets = [
    { id: 1, kind: 'carrier', x: 0, y: 0, z: -80, vx: 0 },
    { id: 2, kind: 'dasher', x: 0, y: 0, z: -80, vx: 0 }
  ]
  assert.equal(pickTarget(targets, { x: 0, y: 0 }, null).id, 2)
})

test('boss parts beat the core', () => {
  const targets = [
    { id: 1, kind: 'core', x: 0, y: 0, z: -60, vx: 0 },
    { id: 2, kind: 'part', x: 0, y: 0, z: -60, vx: 0 }
  ]
  assert.equal(pickTarget(targets, { x: 0, y: 0 }, null).id, 2)
})

// ---- three wingmen at once (2026-09-25) -------------------------------------------

/** A squad member at its slot around a ship at x 0. */
function member(id, targets, overrides = {}) {
  const slot = WINGMEN[id].slot
  return {
    ai: createWingAi(id),
    input: input({ buddy: { x: slot.x, y: slot.y }, formation: { x: slot.x, y: slot.y }, targets, ...overrides })
  }
}

test('createWingAi() with no id keeps the original brain', () => {
  const ai = createWingAi()
  assert.equal(ai.id, null)
  assert.equal(brainOf(null), DEFAULT_BRAIN)
  assert.equal(DEFAULT_BRAIN.leash, Infinity)
  assert.equal(DEFAULT_BRAIN.margin, RETARGET_MARGIN)
  assert.equal(createWingAi('heron').id, 'heron')
})

test('three instances keep separate state', () => {
  const targets = [{ id: 1, kind: 'drone', x: 0, y: 0, z: -80, vx: 0 }]
  const squad = SQUAD.map(id => member(id, targets))
  stepSquad(squad)
  squad[0].ai.modeT = 99
  assert.equal(squad[1].ai.modeT < 1, true)
  assert.notEqual(squad[0].ai, squad[1].ai)
  assert.deepEqual(squad.map(m => m.ai.id), ['heron', 'bison', 'dingo'])
})

test('stepSquad spreads three wingmen over three enemies', () => {
  const targets = [
    { id: 1, kind: 'drone', x: -3, y: 1, z: -60, vx: 0 },
    { id: 2, kind: 'drone', x: 0, y: 1, z: -60, vx: 0 },
    { id: 3, kind: 'drone', x: 3, y: 1, z: -60, vx: 0 }
  ]
  const squad = SQUAD.map(id => member(id, targets))
  for (let f = 0; f < 30; f++) stepSquad(squad)
  const locks = squad.map(m => m.ai.targetId)
  assert.ok(locks.every(id => id !== null))
  assert.equal(new Set(locks).size, 3, `locks ${locks}`)
})

test('without de-confliction they would pile on one target', () => {
  const targets = [
    { id: 1, kind: 'kamikaze', x: 0, y: 1, z: -60, vx: 0 },
    { id: 2, kind: 'drone', x: 2, y: 1, z: -60, vx: 0 }
  ]
  const lone = SQUAD.map(id => member(id, targets))
  for (const m of lone) stepWingman(m.ai, m.input)
  assert.equal(new Set(lone.map(m => m.ai.targetId)).size, 1, 'each alone picks the kamikaze')
  const squad = SQUAD.map(id => member(id, targets))
  stepSquad(squad)
  assert.equal(new Set(squad.map(m => m.ai.targetId)).size, 2, 'as a squad they split')
})

test('all three may share a boss core', () => {
  const targets = [{ id: 900, kind: 'core', x: 0, y: 2, z: -60, vx: 0 }]
  const squad = SQUAD.map(id => member(id, targets))
  for (let f = 0; f < 5; f++) stepSquad(squad)
  assert.deepEqual(squad.map(m => m.ai.targetId), [900, 900, 900])
})

test('a claimed target is still taken when nothing else is left', () => {
  const targets = [{ id: 1, kind: 'drone', x: 0, y: 1, z: -60, vx: 0 }]
  const squad = SQUAD.map(id => member(id, targets))
  stepSquad(squad)
  assert.ok(squad.every(m => m.ai.targetId === 1))
})

test('bison guards the player: a missile on the ship beats a nearer drone', () => {
  const ship = { x: 0 }
  const drone = { id: 1, kind: 'drone', x: 4.4, y: -0.4, z: -40, vx: 0 }
  const missile = { id: 2, kind: 'missile', x: 1, y: 0, z: -30, vx: 0, onShip: true }
  assert.equal(threatensShip(missile, ship), true)
  const bison = pickTarget([drone, missile], { x: 4.4, y: -0.4 }, 1, { brain: brainOf('bison'), ship })
  assert.equal(bison.id, 2, 'bison drops its lock for the missile')
  const kami = { id: 3, kind: 'kamikaze', x: 0.5, y: 0, z: -50, vx: 0 }
  assert.equal(threatensShip(kami, ship), true)
  assert.equal(threatensShip({ ...kami, x: 9 }, ship), false)
})

test('bison stays close; heron hunts far and wide', () => {
  const ship = { x: 0 }
  const far = { id: 1, kind: 'drone', x: 10, y: 1, z: -150, vx: 0 }
  assert.equal(pickTarget([far], { x: 4.4, y: 0 }, null, { brain: brainOf('bison'), ship }), null)
  assert.equal(pickTarget([far], { x: -4.6, y: 1.8 }, null, { brain: brainOf('heron'), ship }).id, 1)
  const deep = { id: 2, kind: 'drone', x: 0, y: 1, z: -190, vx: 0 }
  assert.equal(inHuntZone(deep, brainOf('heron')), true)
  assert.equal(inHuntZone(deep, brainOf('dingo')), false)
  // the leash clamps where bison flies even when its target drifts wide
  const b = member('bison', [{ id: 3, kind: 'kamikaze', x: 6.5, y: 1, z: -60, vx: 0 }])
  const step = stepWingman(b.ai, b.input)
  assert.ok(step.tx <= WINGMEN.bison.leash + 1e-9)
})

test('heron steals kills in the player\'s line', () => {
  const ship = { x: 0 }
  const inLine = { id: 1, kind: 'drone', x: 0.5, y: 1, z: -90, vx: 0 }
  const near = { id: 2, kind: 'drone', x: -4, y: 1.8, z: -90, vx: 0 }
  assert.equal(pickTarget([inLine, near], { x: -4.6, y: 1.8 }, null, { brain: brainOf('heron'), ship }).id, 1)
  assert.equal(pickTarget([inLine, near], { x: -4.6, y: 1.8 }, null, { brain: DEFAULT_BRAIN, ship }).id, 2)
})

test('bison covers the player sooner than heron', () => {
  const hp = 40
  const b = member('bison', [], { ship: { x: 0, y: 0, hp } })
  const h = member('heron', [], { ship: { x: 0, y: 0, hp } })
  assert.equal(stepWingman(b.ai, b.input).mode, 'cover')
  assert.notEqual(stepWingman(h.ai, h.input).mode, 'cover')
})

test('turn rate scales with the pilot in hunt mode only', () => {
  const heron = createWingAi('heron')
  heron.mode = 'hunt'
  assert.ok(turnRate(heron) > WING_AI.turnRate.hunt)
  assert.equal(turnRate(heron, 'formation'), WING_AI.turnRate.formation)
  assert.equal(turnRate(createWingAi(), 'hunt'), WING_AI.turnRate.hunt)
})

test('steps report which callout they spoke', () => {
  const m = member('dingo', [{ id: 1, kind: 'drone', x: -3.4, y: -1, z: -80, vx: 0 }])
  const step = stepWingman(m.ai, m.input)
  assert.equal(step.sayKey, 'breakOff')
  assert.ok(CALLOUTS.breakOff.includes(step.say))
})
