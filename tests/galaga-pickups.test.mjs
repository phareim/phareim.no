// Space Voyagers' engine: the twelve power-ups and the rules for what drops,
// each in a small scripted world. Plain node, no DOM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, step, makeInput, hashWorld, POOL, playerTop } from '../themes/galaga/engine/index.ts'
import { sandbox, place, run, jumpTo, arm } from '../themes/galaga/engine/debug.ts'
import { createAutopilot, autopilot } from '../themes/galaga/engine/autopilot.ts'
import {
  FIELD, PLAYER, PARTNER, DUET, PICKUP, PICKUP_IDS, SCORE, GANGS, SECTORS, ROLES, ROLE_LETTER, BONUS, SNIPER,
  boltCap, boltSpeed, difficulty, tankHp, chainMul, clampHeight, enemyKind,
} from '../themes/galaga/engine/balance.ts'
import { volley, fireInterval, applyWeaponPickup, reach, dps, WEAPON_IDS } from '../themes/galaga/engine/weapons.ts'
import { hurtPlayer, hurtPartner, hurtEnemy, popEnemy } from '../themes/galaga/engine/combat.ts'
import { applyPickup, chooseDrop, dropWeight, maybeDrop } from '../themes/galaga/engine/pickups.ts'
import { spawnBolt, spawnPickup, countActive } from '../themes/galaga/engine/world.ts'

const idle = makeInput()
const firing = { ...makeInput(), fire: true }
const world = (seed = 1, height = 320, pilot = 'rex') => createWorld({ seed, height, pilot })
const box = (seed, height) => { const w = world(seed, height); sandbox(w); return w }
const events = (w, type) => w.events.filter(e => e.type === type)
/** Step once and return the events of a type. */
const tick = (w, input = idle) => { step(w, input); return w.events }
/** Step n ticks, collecting every event. */
function collect(w, n, input = idle) {
  const out = []
  for (let i = 0; i < n && !w.over; i++) { step(w, typeof input === 'function' ? input(w) : input); for (const e of w.events) out.push({ ...e }) }
  return out
}

test('power-ups: each of the twelve does what DESIGN.md says', () => {
  assert.equal(PICKUP_IDS.length, 12)
  let w = box()
  applyPickup(w, 'tube'); assert.equal(w.player.level, 2)
  applyPickup(w, 'disc'); assert.deepEqual([w.player.weapon, w.player.level], ['disc', 2])
  applyPickup(w, 'disc'); assert.equal(w.player.level, 3)
  applyPickup(w, 'boombox'); assert.deepEqual([w.player.weapon, w.player.level], ['boombox', 3])
  applyPickup(w, 'blaster'); assert.equal(w.player.weapon, 'blaster')
  // Pizza: mends a valve; with the hull full it is a one-hit bubble.
  w.player.hull = 3
  applyPickup(w, 'pizza'); assert.equal(w.player.hull, 4)
  w.player.hull = 5
  applyPickup(w, 'pizza'); assert.equal(w.player.bubble, 1)
  // The bubble takes two hits.
  applyPickup(w, 'bubble'); assert.equal(w.player.bubble, PICKUP.bubbleHits)
  hurtPlayer(w); w.player.invuln = 0; hurtPlayer(w); w.player.invuln = 0
  assert.deepEqual([w.player.hull, w.player.bubble], [5, 0])
  hurtPlayer(w); assert.equal(w.player.hull, 4)
  // The quarter doubles the score for 10 s.
  w = box()
  applyPickup(w, 'quarter')
  let s = w.score
  popEnemy(w, place(w, 'grunt', 3, 0), true)
  assert.equal(w.score - s, ROLES.grunt.score * 2)
  run(w, PICKUP.quarterTicks, idle)
  s = w.score
  popEnemy(w, place(w, 'grunt', 3, 0), true)
  assert.equal(w.score - s, ROLES.grunt.score)
  assert.equal(PICKUP.quarterTicks, 600)
})

test('power-ups: the mirror ball clears every shot and hurts every enemy', () => {
  const w = box()
  const grunt = place(w, 'grunt', 1, 0)
  const tank = place(w, 'tank', 4, 0)
  spawnBolt(w, 'bolt', 50, 100, 0, 1)
  applyPickup(w, 'mirrorball')
  assert.equal(countActive(w.bolts), 0)
  assert.equal(grunt.active, false)
  assert.equal(tank.hp, ROLES.tank.hp - PICKUP.mirrorDmg)
})

test('power-ups: TRACKING slows enemies and their shots for 5 s, not the player', () => {
  const w = box()
  const b = spawnBolt(w, 'bolt', 30, 50, 0, 1)
  applyPickup(w, 'tracking')
  const x = w.player.x
  step(w, { ...idle, dx: 1 })
  assert.ok(Math.abs(b.y - 50 - PICKUP.trackingSlow) < 1e-9)
  assert.ok(Math.abs(w.player.x - x - PLAYER.speed) < 1e-9)
  run(w, PICKUP.trackingTicks, idle)
  assert.equal(w.slow, 0)
  assert.equal(PICKUP.trackingTicks, 300)
})

test('power-ups: EXTRA HOLD is a cloud ahead of the ship; what flies into it stands still for 4 s', () => {
  const w = box()
  applyPickup(w, 'hairspray')
  const c = w.cloud
  assert.ok(c.active && c.y < w.player.y)
  const e = place(w, 'grunt', 0, 0)
  e.col = -1; e.state = 'free'; e.vx = 0; e.vy = 2; e.x = c.x; e.y = c.y - c.r - 30
  const b = spawnBolt(w, 'bolt', c.x + 5, c.y - c.r - 4, 0, 1)
  run(w, 40, idle)
  assert.ok(e.frozen > 0)
  const y = e.y
  run(w, 100, idle)
  assert.equal(e.y, y, 'it stands still')
  assert.ok(b.frozen > 0 || !b.active)
  run(w, PICKUP.holdTicks, idle)
  assert.ok(e.y > y || !e.active, 'and goes on afterwards')
  assert.equal(b.active, false, 'a held shot is spent')
  assert.equal(PICKUP.holdTicks, 240)
})

test('power-ups: the CB handset calls a rig up the lane, and it flattens what is in it', () => {
  const w = box()
  const inLane = place(w, 'tank', 0, 1)
  inLane.col = -1; inLane.state = 'free'; inLane.vx = inLane.vy = 0; inLane.x = w.player.x; inLane.y = 100
  const outside = place(w, 'grunt', 7, 0)
  applyPickup(w, 'cb')
  const rig = w.rigs.find(r => r.active)
  assert.equal(rig.kind, 'rig-duckie')
  assert.equal(rig.x, w.player.x)
  run(w, 200, idle)
  assert.equal(inLane.active, false)
  assert.equal(outside.active, true)
  assert.equal(countActive(w.rigs), 0, 'and drives off the top')
})

test('power-ups: the magnet brings pick-ups to the ship for 10 s', () => {
  const w = box()
  applyPickup(w, 'magnet')
  spawnPickup(w, 'quarter', 30, 80)
  const ev = collect(w, 200, idle)
  assert.ok(ev.some(e => e.type === 'pick' && e.kind === 'quarter'))
  assert.equal(PICKUP.magnetTicks, 600)
  const far = box()
  spawnPickup(far, 'quarter', 30, 80)
  assert.ok(!collect(far, 200, idle).some(e => e.type === 'pick'), 'without it the pick-up just falls')
})

test('drops: the first is a tube, at most three fall, a pizza is owed to a ship on its last valve', () => {
  const w = box()
  assert.equal(chooseDrop(w), 'tube')
  for (let i = 0; i < 400; i++) popEnemy(w, place(w, 'grunt', 3, 0), true)
  assert.equal(countActive(w.pickups), PICKUP.maxFalling)
  assert.equal(PICKUP.maxFalling, 3)
  const p = box()
  p.drops = 1
  p.player.hull = 1
  p.player.sincePizza = PICKUP.pizzaPity
  maybeDrop(p, place(p, 'grunt', 3, 0))
  assert.equal(p.pickups.find(k => k.active).id, 'pizza')
  assert.equal(PICKUP.pizzaPity, 1200)
  assert.equal(dropWeight(p, 'bubble') > 0, true)
  p.player.bubble = 2
  assert.equal(dropWeight(p, 'bubble'), 0)
  p.player.hull = 5
  assert.equal(dropWeight(p, 'pizza'), 0, 'no pizza for a full hull with a bubble')
})

