// Space Voyagers II: the engine's 3D arithmetic (themes/voyagers2/engine/math.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  v3, q4, forwardTo, upTo, rightTo, qTurnBody, qLookTo, leadTo, rotateTo, unrotateTo, dist, maddTo, len,
} from '../themes/voyagers2/engine/math.ts'

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps
const nearV = (a, b, eps = 1e-6) => near(a.x, b.x, eps) && near(a.y, b.y, eps) && near(a.z, b.z, eps)

test('a fresh ship looks down -z with +y up and +x to the right', () => {
  const q = q4()
  assert.ok(nearV(forwardTo(v3(), q), v3(0, 0, -1)))
  assert.ok(nearV(upTo(v3(), q), v3(0, 1, 0)))
  assert.ok(nearV(rightTo(v3(), q), v3(1, 0, 0)))
})

test('pitch up lifts the nose, yaw left swings it left, roll left drops the right wing... up', () => {
  const q = q4()
  qTurnBody(q, 0.1, 0, 0)
  assert.ok(forwardTo(v3(), q).y > 0, 'pitch up: nose rises')
  const q2 = q4()
  qTurnBody(q2, 0, 0.1, 0)
  assert.ok(forwardTo(v3(), q2).x < 0, 'yaw left: nose goes to -x')
  const q3 = q4()
  qTurnBody(q3, 0, 0, 0.1)
  assert.ok(rightTo(v3(), q3).y > 0, 'roll left (counter-clockwise from behind): right wing rises')
})

test('turning is in the body frame: after a roll of 90 degrees, pitch moves the nose sideways', () => {
  const q = q4()
  qTurnBody(q, 0, 0, Math.PI / 2) // right wing now points up
  qTurnBody(q, 0.2, 0, 0)
  const f = forwardTo(v3(), q)
  assert.ok(Math.abs(f.y) < 1e-6, 'no climb')
  assert.ok(f.x < -0.1, 'the nose went to the old left')
})

test('qLookTo points the nose along a direction and keeps the top up', () => {
  for (const d of [v3(1, 0, 0), v3(0, 0, 1), v3(0.3, 0.5, -0.8), v3(-1, -1, 0)]) {
    const l = len(d); const u = v3(d.x / l, d.y / l, d.z / l)
    const q = qLookTo(q4(), u)
    assert.ok(nearV(forwardTo(v3(), q), u, 1e-5), `forward ${JSON.stringify(d)}`)
    assert.ok(upTo(v3(), q).y >= -1e-9, 'top stays on the up side')
  }
})

test('unrotate is the inverse of rotate', () => {
  const q = q4(); qTurnBody(q, 0.4, -0.7, 1.1)
  const v = v3(3, -2, 5)
  const back = unrotateTo(v3(), q, rotateTo(v3(), q, v))
  assert.ok(nearV(back, v, 1e-9))
})

test('leadTo: a shot aimed at the lead point meets a target flying across', () => {
  const from = v3(0, 0, 0), sv = v3(0, 0, -200)
  const target = v3(0, 0, -1500), tv = v3(300, 50, 0)
  const speed = 1400
  const aim = v3()
  const t = leadTo(aim, from, sv, target, tv, speed)
  assert.ok(t > 0)
  // Fly both for t seconds: the shot goes at speed toward aim, plus the shooter's velocity.
  const dir = v3(aim.x - from.x, aim.y - from.y, aim.z - from.z)
  const l = len(dir)
  const shot = maddTo(v3(), from, v3(dir.x / l * speed + sv.x, dir.y / l * speed + sv.y, dir.z / l * speed + sv.z), t)
  const where = maddTo(v3(), target, tv, t)
  assert.ok(dist(shot, where) < 0.5, `miss by ${dist(shot, where)}`)
})

test('leadTo: no solution against a target faster than the shot, flying away', () => {
  const aim = v3()
  const t = leadTo(aim, v3(), v3(), v3(0, 0, -100), v3(0, 0, -5000), 1400)
  assert.equal(t, -1)
})
