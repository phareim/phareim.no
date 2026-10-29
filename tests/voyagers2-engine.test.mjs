// Space Voyagers II's engine (themes/voyagers2/engine): flying, damage, guns,
// missiles and decoys, the two seats, a sortie from launch to landing, and the
// bot table on the first sortie. Plain node, no DOM.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, step, makeInput, calzone, autoGoal, destroyCalzone, LAUNCH_TICKS, AUTO_TICKS, LAND_TICKS } from '../themes/voyagers2/engine/world.ts'
import { FIRST_SHIFT } from '../themes/voyagers2/engine/missions.ts'
import { SHIPS, MISSILE, SPACE } from '../themes/voyagers2/engine/balance.ts'
import { fly, steerTo, makeControls } from '../themes/voyagers2/engine/flight.ts'
import { spawnShip, hurt, live } from '../themes/voyagers2/engine/ships.ts'
import { fireGuns, stepShots } from '../themes/voyagers2/engine/guns.ts'
import { launchMissile, stepMissiles, stepLock, dropDecoy } from '../themes/voyagers2/engine/missiles.ts'
import { SWAP_TICKS, swapSeats } from '../themes/voyagers2/engine/seats.ts'
import { createBot, botInput } from '../themes/voyagers2/engine/bot.ts'
import { v3, q4, qLookTo, forwardTo, angleBetween, normTo, subTo, dist } from '../themes/voyagers2/engine/math.ts'

const idle = makeInput()
const world = (seed = 1, pilot = 'rex') => createWorld({ seed, mission: FIRST_SHIFT, pilot })
/** A world with nobody in it but the Calzone (and the carrier far behind), flying. */
function empty(seed = 1) {
  const w = world(seed)
  w.ships = w.ships.filter(s => s.id === w.player || s.id === w.carrier)
  w.mission.stage = 'fly'
  const me = calzone(w)
  me.speed = me.cruise
  return w
}
const run = (w, n, input = idle) => { for (let i = 0; i < n; i++) step(w, typeof input === 'function' ? input(w) : input) }

test('same seed, same inputs, same sortie', () => {
  const sig = seed => {
    const w = world(seed)
    const bot = createBot('casual', seed)
    run(w, 60 * 40, x => botInput(bot, x))
    return JSON.stringify(w.ships.map(s => [s.id, s.kind, Math.round(s.pos.x * 100), Math.round(s.pos.z * 100), Math.round(s.core)])) + w.score
  }
  assert.equal(sig(3), sig(3))
  assert.notEqual(sig(3), sig(4))
})

test('flying: cruise holds, the afterburner is fast and drains, the brake slows, slow turns tighter', () => {
  const w = empty()
  const s = calzone(w)
  const k = SHIPS.calzone
  const c = makeControls()
  for (let i = 0; i < 60; i++) fly(s, c, 1 / 60)
  assert.ok(Math.abs(s.speed - k.cruise) < 1)
  c.burn = true
  for (let i = 0; i < 90; i++) fly(s, c, 1 / 60)
  assert.ok(s.speed > k.cruise * 2.5, `burn ${s.speed}`)
  assert.ok(s.fuel < 0.8)
  c.burn = false; c.brake = true
  for (let i = 0; i < 180; i++) fly(s, c, 1 / 60)
  assert.ok(s.speed < k.cruise * 0.5)
  // Full pitch for a second, slow vs burning.
  const turned = (brake, burn) => {
    const t = spawnShip(w, 'calzone', 'us', v3(), q4())
    t.speed = brake ? k.min : burn ? k.burn : k.cruise
    const cc = makeControls(); cc.pitch = 1; cc.brake = brake; cc.burn = burn
    for (let i = 0; i < 60; i++) fly(t, cc, 1 / 60)
    return angleBetween(forwardTo(v3(), t.q), v3(0, 0, -1))
  }
  assert.ok(turned(true, false) > turned(false, false) && turned(false, false) > turned(false, true))
})

test('steering puts the nose on a point and keeps it there', () => {
  const w = empty()
  const s = calzone(w)
  for (const p of [v3(2000, 300, 0), v3(-500, -800, 900), v3(0, 0, 3000)]) {
    s.q = q4(); s.rate = v3()
    const c = makeControls()
    const dir = v3()
    let off = 9
    for (let i = 0; i < 60 * 4; i++) {
      normTo(dir, subTo(dir, p, s.pos))
      steerTo(c, s, dir)
      fly(s, c, 1 / 60)
      off = angleBetween(forwardTo(v3(), s.q), dir)
    }
    assert.ok(off < 0.03, `still ${(off * 57.3).toFixed(1)} degrees off ${JSON.stringify(p)}`)
  }
})

test('damage: the shield on the side hit, then that side armour, then the core; the kill is said once', () => {
  const w = empty()
  const r = spawnShip(w, 'rat', 'them', v3(0, 0, -500), qLookTo(q4(), v3(0, 0, 1)))
  const k = SHIPS.rat
  // The rat faces +z: a hit from +z is on its nose.
  const front = v3(0, 0, 0)
  hurt(w, r, k.shield - 1, front, w.player)
  assert.equal(r.shieldF, 1); assert.equal(r.shieldB, k.shield); assert.equal(r.armour.f, k.armour)
  hurt(w, r, 11, front, w.player)
  assert.equal(r.shieldF, 0); assert.equal(r.armour.f, k.armour - 10)
  // From behind: the back shield, untouched armour.
  hurt(w, r, 5, v3(0, 0, -1000), w.player)
  assert.equal(r.shieldB, k.shield - 5)
  w.events.length = 0
  hurt(w, r, 9999, front, w.player)
  assert.equal(r.dead, 1)
  assert.equal(w.events.filter(e => e.type === 'kill').length, 1)
  hurt(w, r, 10, front, w.player)
  assert.equal(w.events.filter(e => e.type === 'kill').length, 1)
})

test('guns: bolts leave the nose, hit what is in front, and draw on the capacitor', () => {
  const w = empty()
  const me = calzone(w)
  forwardTo(me.vel, me.q)
  const ahead = forwardTo(v3(), me.q)
  const r = spawnShip(w, 'rat', 'them', v3(me.pos.x + ahead.x * 600, me.pos.y + ahead.y * 600, me.pos.z + ahead.z * 600), me.q)
  r.speed = 0
  r.ai = null
  const before = r.shieldB + r.shieldF + r.armour.b + r.armour.f
  me.energy = 1
  let fired = 0
  for (let i = 0; i < 60; i++) {
    if (fireGuns(w, me, 'front', null, 0)) fired++
    me.gunCool = Math.max(0, me.gunCool - 1 / 60)
    stepShots(w, 1 / 60)
  }
  assert.ok(fired >= 7, `fired ${fired}`)
  assert.ok(me.energy < 1)
  assert.ok(r.shieldB + r.shieldF + r.armour.b + r.armour.f < before, 'the rat was hit')
})

test('missiles: the lock builds in the cone, a seeker hits, a decoy pulls one off and it misses the ship that dropped it', () => {
  const w = empty()
  const me = calzone(w)
  const ahead = forwardTo(v3(), me.q)
  const b = spawnShip(w, 'bear', 'them', v3(me.pos.x + ahead.x * 1500, me.pos.y + ahead.y * 1500, me.pos.z + ahead.z * 1500), me.q)
  b.ai = null
  me.target = b.id
  let t = 0
  while (me.lock < 1 && t < 200) { stepLock(w, me, 1 / 60); t++ }
  assert.ok(t <= Math.ceil(MISSILE.lockTime * 60) + 1, `lock took ${t} ticks`)
  const m = launchMissile(w, me)
  assert.equal(m.kind, 'seeker')
  let hit = false
  for (let i = 0; i < 600 && w.missiles.length; i++) {
    for (const s of w.ships) if (s.ai === null && s.id !== w.carrier) { forwardTo(s.vel, s.q); s.vel.x *= s.speed; s.vel.y *= s.speed; s.vel.z *= s.speed; s.pos.x += s.vel.x / 60; s.pos.y += s.vel.y / 60; s.pos.z += s.vel.z / 60 }
    w.events.length = 0
    stepMissiles(w, 1 / 60)
    if (w.events.some(e => e.type === 'hit' && e.a === b.id)) hit = true
  }
  assert.ok(hit, 'the seeker hit the bear')
  // Now the other way: the bear's missile at the Calzone, and a decoy.
  const w2 = empty(5)
  const me2 = calzone(w2)
  const back = forwardTo(v3(), me2.q)
  const b2 = spawnShip(w2, 'bear', 'them', v3(me2.pos.x - back.x * 1200, me2.pos.y - back.y * 1200, me2.pos.z - back.z * 1200), me2.q)
  b2.ai = null
  b2.target = me2.id
  b2.lock = 1
  const m2 = launchMissile(w2, b2)
  assert.ok(m2)
  run(w2, 30)
  let pulled = false
  for (let tries = 0; tries < 20 && !pulled; tries++) {
    me2.decoys = 6
    dropDecoy(w2, me2)
    pulled = w2.missiles.some(x => x.target >= 1_000_000)
  }
  assert.ok(pulled, 'a decoy pulled the missile')
  const coreBefore = me2.core + me2.shieldB + me2.armour.b
  run(w2, 240)
  assert.equal(me2.core + me2.shieldB + me2.armour.b, coreBefore, 'the Calzone was not hit by the decoyed missile')
})

test('seats: a change takes its moment; then the partner flies and the player has the turret', () => {
  const w = empty()
  const me = calzone(w)
  assert.equal(w.seat, 'front')
  assert.equal(w.front, 'rex')
  step(w, { ...idle, swap: true })
  assert.equal(w.seat, 'back')
  assert.equal(w.front, 'nova')
  assert.equal(w.back, 'rex')
  assert.ok(me.ai && me.ai.mode === 'turret')
  assert.equal(w.crew.swapping, SWAP_TICKS - 1)
  run(w, SWAP_TICKS)
  // The player swings the turret with the stick.
  const t = me.turrets[0]
  const aim0 = { ...t.aim }
  run(w, 30, { ...idle, yaw: 1 })
  assert.ok(Math.abs(t.aim.x - aim0.x) > 0.05, 'the turret swung')
  step(w, { ...idle, swap: true })
  run(w, SWAP_TICKS)
  assert.equal(w.seat, 'front')
  assert.equal(me.ai, null)
})

test('the back seat shoots what sits on the tail', () => {
  const w = empty(2)
  const me = calzone(w)
  const fwd = forwardTo(v3(), me.q)
  const r = spawnShip(w, 'rat', 'them', v3(me.pos.x - fwd.x * 400, me.pos.y - fwd.y * 400, me.pos.z - fwd.z * 400), me.q, { ai: 'idle', skill: 0 })
  r.speed = me.speed
  let hits = 0
  for (let i = 0; i < 60 * 6; i++) {
    step(w, idle)
    hits += w.events.filter(e => e.type === 'hit' && e.a === r.id && e.seat === 'back').length
    if (!live(r)) break
  }
  assert.ok(hits > 3, `the turret hit ${hits} times`)
})

test('a sortie: launch, autopilot when the sky is clear, a fight at the nav point, and home', () => {
  const w = world(9)
  run(w, LAUNCH_TICKS + 1)
  assert.equal(w.mission.stage, 'fly')
  assert.equal(autoGoal(w), 'nav')
  step(w, { ...idle, auto: true })
  assert.equal(w.mission.stage, 'auto')
  run(w, AUTO_TICKS)
  assert.equal(w.mission.stage, 'fly')
  assert.ok(w.mission.navs[1].met)
  assert.ok(dist(calzone(w).pos, w.mission.navs[1].pos) < SPACE.navReach * 2)
  assert.ok(w.ships.some(s => s.side === 'them' && live(s)), 'the fight began')
  assert.equal(autoGoal(w), 'none', 'no autopilot with bandits near')
})

test('losing the Calzone ejects the seats and loses the sortie', () => {
  const w = world(4)
  run(w, LAUNCH_TICKS + 2)
  destroyCalzone(w)
  run(w, 400)
  assert.equal(w.ejected, true)
  assert.equal(w.mission.result, 'lost')
  assert.equal(w.mission.why, 'eject')
})

test('the first sortie: every bot pilot comes home, with most of the hull', () => {
  for (const profile of ['clumsy', 'casual', 'sharp']) {
    for (const seed of [1, 2]) {
      const w = world(seed, seed % 2 ? 'rex' : 'nova')
      const bot = createBot(profile, seed)
      for (let i = 0; i < 60 * 60 * 6 && w.mission.stage !== 'done'; i++) step(w, botInput(bot, w))
      assert.equal(w.mission.result, 'won', `${profile} seed ${seed}: ${w.mission.result || 'timeout'} ${w.mission.why}`)
      assert.ok(w.score > 2000)
    }
  }
})

test('landing ends the sortie as won', () => {
  const w = world(11)
  const bot = createBot('sharp', 11)
  let landed = false
  for (let i = 0; i < 60 * 60 * 6 && w.mission.stage !== 'done'; i++) {
    step(w, botInput(bot, w))
    if (w.mission.stage === 'land') landed = true
  }
  assert.ok(landed)
  assert.equal(w.mission.why, 'landed')
  void LAND_TICKS
})
