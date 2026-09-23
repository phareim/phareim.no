import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  volley, applyWeaponPickup, pickTarget, steer, seekerCount, clampLevel,
  FIRE_INTERVAL, SEEKER_SPEED,
} from '../themes/galaga/weapons.ts'

test('spread keeps the original fan: n streams, capped at 70 degrees', () => {
  assert.equal(volley('spread', 1).length, 1)
  assert.equal(volley('spread', 3).length, 3)
  const five = volley('spread', 5)
  assert.equal(five.length, 5)
  const angles = five.map(s => Math.atan2(s.vx, -s.vy) * 180 / Math.PI)
  assert.ok(Math.abs(angles[0] + 25) < 0.01 && Math.abs(angles[4] - 25) < 0.01)
  assert.ok(five.every(s => s.kind === 'bolt' && s.dmg === 1 && s.pierce === 0))
})

test('lances pierce and grow with level', () => {
  const l1 = volley('laser', 1)
  assert.equal(l1.length, 1)
  assert.ok(l1[0].kind === 'lance' && l1[0].pierce >= 2 && l1[0].vy < -10)
  assert.equal(volley('laser', 3).reduce((n, s) => n + s.dmg, 0), 4)
  assert.equal(volley('laser', 5).length, 5)
})

test('seekers launch on even volleys only, more with level', () => {
  const even = volley('homing', 1, { index: 0 })
  const odd = volley('homing', 1, { index: 1 })
  assert.equal(even.filter(s => s.kind === 'seeker').length, 1)
  assert.equal(odd.filter(s => s.kind === 'seeker').length, 0)
  assert.equal(seekerCount(5), 4)
  assert.ok(seekerCount(1) <= seekerCount(3) && seekerCount(3) <= seekerCount(5))
  // Seekers fan out to both sides before they steer in.
  const s = volley('homing', 4, { index: 2 }).filter(s => s.kind === 'seeker')
  assert.ok(s.some(x => x.vx < 0) && s.some(x => x.vx > 0))
})

test('escort, rear gun and SYNC add their shots', () => {
  const base = volley('spread', 2).length
  assert.equal(volley('spread', 2, { escort: true }).length, base + 1)
  const rear = volley('spread', 2, { rear: true }).find(s => s.kind === 'rear')
  assert.ok(rear && rear.vy > 0)
  // SYNC fires at level 5 with seekers on top of any module.
  const synced = volley('spread', 1, { sync: true, index: 0 })
  assert.equal(synced.filter(s => s.kind === 'bolt').length, 5)
  assert.equal(synced.filter(s => s.kind === 'seeker').length, 2)
  assert.ok(FIRE_INTERVAL.laser < FIRE_INTERVAL.spread)
})

test('pickups: same module or P raises the level, a new module keeps it', () => {
  assert.deepEqual(applyWeaponPickup('spread', 2, 'weapon'), { kind: 'spread', level: 3 })
  assert.deepEqual(applyWeaponPickup('laser', 2, 'laser'), { kind: 'laser', level: 3 })
  assert.deepEqual(applyWeaponPickup('spread', 3, 'homing'), { kind: 'homing', level: 3 })
  assert.deepEqual(applyWeaponPickup('laser', 5, 'weapon'), { kind: 'laser', level: 5 })
  assert.equal(clampLevel(0), 1)
  assert.equal(clampLevel(9), 5)
})

test('seekers pick the nearest target ahead and turn toward it at a capped rate', () => {
  const far = { x: 300, y: 0 }, near = { x: 110, y: 200 }, behind = { x: 100, y: 500 }
  assert.equal(pickTarget(100, 300, [far, near, behind]), near)
  assert.equal(pickTarget(100, 300, [behind]), null)
  const s = { x: 0, y: 0, vx: 0, vy: -SEEKER_SPEED }
  steer(s, 100, 0) // target straight to the right: a 90 degree turn wanted
  const turned = Math.atan2(s.vy, s.vx) - Math.atan2(-1, 0)
  assert.ok(turned > 0 && turned <= 0.111)
  assert.ok(Math.abs(Math.hypot(s.vx, s.vy) - SEEKER_SPEED) < 1e-9)
})
