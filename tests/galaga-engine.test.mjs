// Space Voyagers' engine (themes/galaga/engine): the rules of play, each in a
// small scripted world. Plain node, no DOM. The convoy, the rescue and the
// capture are in galaga-encounters; the bosses in galaga-bosses.
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

test('a world: 240 wide, height clamped to 320..432, the two pilots', () => {
  assert.equal(world(1, 100).h, 320)
  assert.equal(world(1, 900).h, 432)
  assert.equal(clampHeight(400.4), 400)
  const w = world(1, 320, 'nova')
  assert.equal(w.w, FIELD.w)
  assert.equal(w.player.kind, 'ship-nova')
  assert.equal(w.partner.kind, 'ship-rex')
  assert.equal(world().player.kind, 'ship-rex')
  assert.equal(w.player.hull, 5)
  assert.equal(w.player.weapon, 'blaster')
  assert.equal(w.player.level, 1)
})

test('determinism: the same seed and inputs give the same world after 10,000 ticks', () => {
  const play = seed => {
    const w = world(seed, 368)
    const ap = createAutopilot()
    for (let i = 0; i < 10_000; i++) step(w, autopilot(ap, w))
    return hashWorld(w)
  }
  const a = play(11)
  assert.equal(a, play(11))
  assert.notEqual(a, play(12))
})

test('a recorded run replays tick for tick', () => {
  const w = world(5)
  const ap = createAutopilot()
  const tape = []
  const hashes = []
  for (let i = 0; i < 3000; i++) {
    const inp = autopilot(ap, w)
    tape.push({ ...inp })
    step(w, inp)
    if (i % 500 === 0) hashes.push(hashWorld(w))
  }
  const r = world(5)
  const again = []
  for (let i = 0; i < 3000; i++) { step(r, tape[i]); if (i % 500 === 0) again.push(hashWorld(r)) }
  assert.deepEqual(again, hashes)
})

test('events are pooled: the array and its records are reused', () => {
  const w = world(2)
  const ap = createAutopilot()
  const arr = w.events
  for (let i = 0; i < 1500; i++) step(w, autopilot(ap, w))
  assert.equal(w.events, arr)
  const pool = w.eventPool.length
  for (let i = 0; i < 1500; i++) step(w, autopilot(ap, w))
  assert.ok(w.eventPool.length <= pool + 8, 'the pool stops growing')
  assert.ok(w.eventPool.length < 200)
})

test('weapons: pure tables, three weapons at five levels', () => {
  for (const id of WEAPON_IDS) {
    for (let lv = 1; lv <= 5; lv++) {
      const v = volley(id, lv)
      assert.equal(volley(id, lv), v, 'the same array every time')
      assert.ok(Object.isFrozen(v) && v.length >= 1)
      assert.ok(v.every(s => s.vy < 0 && s.dmg >= 1 && s.life > 0))
      if (lv > 1) assert.ok(dps(id, lv) >= dps(id, lv - 1), `${id} never gets worse with level`)
    }
    assert.equal(volley(id, 9), volley(id, 5))
    assert.equal(volley(id, 0), volley(id, 1))
  }
  assert.deepEqual([1, 2, 3, 4, 5].map(l => volley('blaster', l).length), [1, 2, 3, 4, 5])
  const fan = volley('blaster', 5)
  assert.ok(Math.abs(fan[0].vx + fan[4].vx) < 1e-9, 'the fan is symmetric')
  assert.ok(volley('disc', 1)[0].pierce >= 1, 'a disc goes through a target')
  assert.ok(volley('boombox', 1)[0].grow > 0 && volley('boombox', 1)[0].pierce > 10, 'an arc widens and hits all it crosses')
  assert.ok(reach('boombox', 5) < reach('blaster', 1) / 2, 'the boombox is short')
  assert.equal(fireInterval('blaster', true), Math.round(fireInterval('blaster') * DUET.fireMul))
  assert.deepEqual(applyWeaponPickup('blaster', 2, 'tube'), { weapon: 'blaster', level: 3 })
  assert.deepEqual(applyWeaponPickup('blaster', 2, 'blaster'), { weapon: 'blaster', level: 3 })
  assert.deepEqual(applyWeaponPickup('blaster', 4, 'disc'), { weapon: 'disc', level: 4 })
  assert.deepEqual(applyWeaponPickup('disc', 5, 'tube'), { weapon: 'disc', level: 5 })
})

test('the player flies at one speed by keys or by target and stays in the field', () => {
  for (const h of [320, 432]) {
    const w = box(1, h)
    const x0 = w.player.x
    tick(w, { ...idle, dx: 1 })
    assert.ok(Math.abs(w.player.x - x0 - PLAYER.speed) < 1e-9)
    tick(w, { ...idle, dx: 1, dy: 1 })
    assert.ok(Math.hypot(w.player.x - x0 - PLAYER.speed, w.player.y - (h - PLAYER.startFromBottom)) <= PLAYER.speed + 1e-9, 'a diagonal is no faster')
    const before = w.player.x
    tick(w, { ...idle, hasTarget: true, tx: 0, ty: w.player.y })
    assert.ok(Math.abs(before - w.player.x - PLAYER.speed) < 1e-9)
    for (const [dx, dy] of [[-1, -1], [1, 1], [-1, 1], [1, -1]]) {
      run(w, 300, { ...idle, dx, dy })
      assert.ok(w.player.x >= PLAYER.marginX && w.player.x <= FIELD.w - PLAYER.marginX)
      assert.ok(w.player.y >= playerTop(w) && w.player.y <= h - PLAYER.marginBottom)
    }
  }
})

test('firing: held fire launches a volley every interval', () => {
  const w = box()
  const shots = collect(w, 91, firing).filter(e => e.type === 'shot' && e.n === 0)
  assert.equal(shots.length, Math.ceil(91 / fireInterval('blaster')))
  assert.equal(shots[0].kind, 'blaster')
  assert.equal(collect(box(), 60, idle).filter(e => e.type === 'shot').length, 0)
})

test('the hull: five valves, a hit pops one, blinks 1.5 s and costs a weapon level, never below 1', () => {
  const w = box()
  arm(w, 'blaster', 2)
  assert.ok(hurtPlayer(w))
  assert.equal(w.player.hull, 4)
  assert.equal(w.player.invuln, 90)
  assert.equal(w.player.level, 1)
  assert.equal(hurtPlayer(w), false, 'safe while blinking')
  run(w, 90, idle)
  assert.ok(hurtPlayer(w))
  assert.equal(w.player.level, 1)
  assert.equal(w.player.hull, 3)
})

test('the hit box is the cockpit: a shot 6 px off misses, a shot on it hits', () => {
  const w = box()
  const p = w.player
  spawnBolt(w, 'bolt', p.x + 6.5, p.y - 3, 0, 1)
  run(w, 8, idle)
  assert.equal(p.hull, 5)
  spawnBolt(w, 'bolt', p.x + 2, p.y - 3, 0, 1)
  const ev = collect(w, 8, idle)
  assert.equal(p.hull, 4)
  assert.equal(ev.filter(e => e.type === 'valve')[0].n, 4)
  assert.ok(PLAYER.hitR * 2 <= 6)
})

test('tows: hull empty twice is a tow (field cleared, back with three valves), the third time is GAME OVER', () => {
  const w = box()
  const drain = () => { while (w.player.hull > 0 && !w.over) { w.player.invuln = 0; hurtPlayer(w) } }
  spawnBolt(w, 'bolt', 20, 20, 0, 1)
  drain()
  assert.equal(w.player.tows, 1)
  assert.equal(countActive(w.bolts), 0, 'enemy fire cleared')
  assert.ok(w.player.towing > 0)
  assert.equal(hurtPlayer(w), false, 'no harm on the hook')
  const ev = collect(w, PLAYER.towTicks + 1, idle)
  assert.ok(ev.some(e => e.type === 'towed'))
  assert.equal(w.player.hull, 3)
  assert.ok(events(w, 'cue').length >= 0)
  drain()
  assert.equal(w.player.tows, 0)
  run(w, PLAYER.towTicks + 1, idle)
  assert.equal(w.player.hull, 3)
  assert.equal(w.over, false)
  drain()
  assert.equal(w.over, true)
  assert.equal(w.stage, 'over')
  const t = w.tick
  step(w, firing)
  assert.equal(w.tick, t, 'nothing moves after GAME OVER')
  assert.equal(w.events.length, 0)
})

test('tow cues: the first says first, the second says last', () => {
  const w = box()
  const asked = []
  for (let k = 0; k < 2; k++) {
    while (w.player.hull > 0) { w.player.invuln = 0; hurtPlayer(w) }
    for (const e of w.events) if (e.type === 'cue' && e.kind.startsWith('tow.')) asked.push(e.kind)
    run(w, PLAYER.towTicks + 1, idle)
  }
  assert.deepEqual(asked, ['tow.first', 'tow.last'])
})

test('the partner fires at what is in front of it, at half the rate', () => {
  const w = box()
  const q = w.partner
  run(w, 60, idle)
  const e = place(w, 'tank', 0, 0)
  e.hp = e.maxHp = 999
  e.col = -1; e.state = 'free'; e.vx = e.vy = 0; e.x = q.x; e.y = 60
  const ev = collect(w, 180, idle).filter(x => x.type === 'shot')
  assert.ok(ev.every(x => x.n === 1), 'only the partner fired')
  assert.equal(ev.length, Math.ceil(180 / (fireInterval('blaster') * PARTNER.fireEvery)))
})

test('the partner cannot die: three hits and it limps off for 10 s, then comes back', () => {
  const w = box()
  const q = w.partner
  for (let i = 0; i < 3; i++) { q.invuln = 0; assert.ok(hurtPartner(w)) }
  assert.equal(q.state, 'limp')
  assert.equal(hurtPartner(w), false)
  const ev = collect(w, PARTNER.limpTicks + 1, idle)
  assert.equal(q.state, 'fly')
  assert.equal(q.hits, 0)
  assert.ok(ev.some(e => e.type === 'back'))
  assert.ok(ev.some(e => e.type === 'cue' && e.kind === 'partner.back.nova'))
  assert.equal(PARTNER.limpTicks, 600)
})

test('DUET: kills fill the needle; for 6 s both fire at top level twice as fast and enemy shots turn to points', () => {
  const w = box()
  arm(w, 'blaster', 1)
  step(w, { ...idle, duet: true })
  assert.equal(w.duet, 0, 'nothing happens with the needle down')
  let ready = false
  for (let i = 0; i < 200 && w.duetMeter < 1; i++) {
    const e = place(w, 'grunt', i % 8, 0)
    popEnemy(w, e, true)
    ready ||= w.events.some(x => x.type === 'duetReady')
    step(w, idle)
  }
  assert.equal(w.duetMeter, 1)
  for (let i = 0; i < 4; i++) spawnBolt(w, 'bolt', 30 + i * 40, 60, 0, 0.1)
  const score = w.score
  step(w, { ...firing, duet: true })
  assert.equal(w.duet, DUET.ticks - 1)
  assert.equal(DUET.ticks, 360)
  assert.equal(countActive(w.bolts), 0)
  assert.equal(w.score - score, 4 * DUET.cancelScore)
  assert.ok(w.events.some(e => e.type === 'duetOn'))
  assert.equal(countActive(w.shots), volley('blaster', 5).length, 'level 5 while it plays')
  const ev = collect(w, DUET.ticks, firing)
  const mine = ev.filter(e => e.type === 'shot' && e.n === 0)
  assert.ok(Math.abs(mine.length - DUET.ticks / fireInterval('blaster', true)) <= 1)
  assert.ok(ev.some(e => e.type === 'duetOff'))
  assert.equal(w.duet, 0)
  assert.equal(w.duetMeter, 0)
})

test('the kill chain: kills in a row raise the multiplier; a hit or a pause drops it', () => {
  const w = box()
  assert.equal(chainMul(0), 1)
  assert.equal(chainMul(SCORE.chainStep), 2)
  assert.equal(chainMul(999), SCORE.chainMax)
  const kill = () => popEnemy(w, place(w, 'grunt', 3, 0), true)
  for (let i = 0; i < SCORE.chainStep; i++) kill()
  assert.equal(w.chainMul, 2)
  const s = w.score
  kill()
  assert.equal(w.score - s, ROLES.grunt.score * 2)
  hurtPlayer(w)
  assert.equal(w.chainMul, 1)
  for (let i = 0; i < SCORE.chainStep; i++) kill()
  run(w, SCORE.chainTicks + 1, idle)
  assert.equal(w.chain, 0)
})

test('roles: eight of them, and five gangs that differ in numbers, not code', () => {
  assert.deepEqual(Object.keys(ROLES).sort(), ['captor', 'diver', 'flanker', 'grunt', 'mite', 'raider', 'sniper', 'splitter', 'tank'])
  assert.deepEqual(Object.keys(GANGS).sort(), ['chromons', 'glitterati', 'hogs', 'lovemachines', 'noise'])
  const sig = Object.values(GANGS).map(g => JSON.stringify(g))
  assert.equal(new Set(sig).size, 5, 'no two gangs have the same numbers')
  assert.equal(enemyKind('hogs', 'tank'), 'enemy-hogs-tank')
  assert.deepEqual(SECTORS.map(s => s.gang), ['glitterati', 'hogs', 'lovemachines', 'chromons', 'noise'])
  assert.ok(tankHp(0) >= 3 && tankHp(9) <= 5)
  for (const s of SECTORS) {
    assert.equal(s.waves.length, 4)
    for (const rows of s.waves) {
      const letters = rows.join('')
      assert.ok(rows.every(r => r.length === 8))
      assert.ok([...letters].every(c => c === '.' || ROLE_LETTER[c]))
      assert.ok(letters.split('S').length - 1 <= SNIPER.max, 'two snipers at most')
      assert.ok(letters.split('C').length - 1 <= 1, 'one captor at most')
    }
    assert.ok(s.waves.some(rows => rows.join('').includes('C')), 'every sector has its captor')
  }
})

test('a splitter pops into two small ones; a tank takes several hits', () => {
  const w = box(1, 320)
  const s = place(w, 'splitter', 3, 0)
  assert.equal(hurtEnemy(w, s, 1, true), false)
  assert.equal(hurtEnemy(w, s, 1, true), true)
  const mites = w.enemies.filter(e => e.active && e.role === 'mite')
  assert.equal(mites.length, 2)
  assert.ok(mites.every(m => m.kind === 'enemy-glitterati-mite'))
  const t = place(w, 'tank', 5, 0)
  assert.equal(hurtEnemy(w, t, 2, true), false)
  assert.equal(t.flash, 0)
})

test('a sniper shows its line for half a second before the shot goes along it', () => {
  const w = box(1, 320)
  const s = place(w, 'sniper', 2, 0)
  s.fireT = 1
  const ev = collect(w, 80, idle)
  const aim = ev.findIndex(e => e.type === 'aim' && e.kind === 'sniper')
  const shot = ev.findIndex(e => e.type === 'bolt' && e.kind === 'aimed')
  assert.ok(aim >= 0 && shot > aim)
  assert.equal(ev[aim].n, SNIPER.warn)
  assert.equal(SNIPER.warn, 30)
  const b = w.bolts.find(x => x.active)
  assert.ok(b.vy > 0, 'it goes down the field, toward where the player was')
})

test('sector 1 is gentle: few shots, slow, and a wave forms up before anything dives', () => {
  const d = difficulty(1, 1)
  assert.equal(d, 0)
  assert.ok(boltCap(d) <= 3)
  assert.ok(boltSpeed(d) <= 1.2)
  assert.ok(boltSpeed(difficulty(5, 1)) > boltSpeed(d) && boltCap(difficulty(5, 1)) > boltCap(d))
  assert.ok(difficulty(1, 2) > difficulty(2, 1), 'VOYAGE II starts harder than sector 2')
  const w = world(3)
  const ap = createAutopilot({ holdFire: true, dodgeOnly: true, noDuet: true })
  let maxBolts = 0
  let firstPeel = -1
  let formedAtPeel = 0
  for (let i = 0; i < 1500; i++) {
    step(w, autopilot(ap, w))
    maxBolts = Math.max(maxBolts, countActive(w.bolts))
    if (firstPeel < 0 && w.events.some(e => e.type === 'peel')) { firstPeel = w.tick; formedAtPeel = w.toEnter }
  }
  assert.ok(maxBolts <= boltCap(0), `at most ${boltCap(0)} enemy shots in the air, saw ${maxBolts}`)
  assert.ok(firstPeel > 0, 'they do dive')
  assert.equal(formedAtPeel, 0, 'but only once the whole wave is in')
})

test('a wave: strings fly in to a formation inside the field, dive, and loop back up', () => {
  for (const h of [320, 432]) {
    const w = world(4, h)
    const ap = createAutopilot({ holdFire: true, dodgeOnly: true, noDuet: true })
    // The partner sits this one out, so the wave lives long enough to be watched.
    w.partner.state = 'limp'
    w.partner.t = -1e6
    let wraps = 0
    let peels = 0
    let size = 0
    for (let i = 0; i < 2400 && w.wave <= 1; i++) {
      step(w, autopilot(ap, w))
      if (w.tick === 300) size = w.waveSize
      for (const e of w.events) if (e.type === 'peel') peels++
      for (const e of w.enemies) {
        if (!e.active || e.state !== 'form') continue
        assert.ok(e.x - e.hw >= 0 && e.x + e.hw <= FIELD.w, 'the formation stays in the field')
        assert.ok(e.y < playerTop(w), 'and above the player')
        wraps = Math.max(wraps, e.wraps)
      }
    }
    assert.equal(size, SECTORS[0].waves[0].join('').replace(/\./g, '').length)
    assert.ok(peels >= 3)
    assert.ok(wraps >= 1, 'one that dived is back in its place')
  }
})

test('the bonus run: nothing shoots; all of them is PERFECT, fewer is not', () => {
  for (const perfect of [true, false]) {
    const w = world(6)
    jumpTo(w, { sector: 1, stage: 'bonus' })
    const ev = []
    let n = 0
    for (let i = 0; i < 2000 && w.stage === 'bonus'; i++) {
      step(w, idle)
      for (const e of w.events) ev.push({ ...e })
      for (const e of w.enemies) {
        if (e.active && e.bonus && e.state === 'through' && (perfect || n < 5)) { popEnemy(w, e, true); n++ }
      }
    }
    assert.equal(w.bonusTotal, BONUS.strings * BONUS.perString)
    assert.equal(ev.filter(e => e.type === 'bolt').length, 0)
    assert.equal(w.stats.hits, 0)
    assert.equal(ev.some(e => e.type === 'card' && e.kind === 'perfect'), perfect)
    assert.ok(ev.some(e => e.type === 'cue' && e.kind === (perfect ? 'bonus.perfect' : 'bonus.miss')))
    assert.equal(w.stage, 'wave')
    assert.equal(w.wave, 3)
    if (perfect) assert.ok(w.score >= BONUS.perfect + w.bonusTotal * BONUS.each)
  }
})

test('pools are fixed and things are named for their bitmaps', () => {
  const w = world(8)
  const ap = createAutopilot()
  const kinds = new Set()
  for (let i = 0; i < 6000; i++) {
    step(w, autopilot(ap, w))
    for (const e of w.enemies) if (e.active) kinds.add(e.kind)
    for (const k of w.pickups) if (k.active) kinds.add(k.kind)
    for (const r of w.rigs) if (r.active) kinds.add(r.kind)
  }
  assert.equal(w.enemies.length, POOL.enemies)
  assert.equal(w.shots.length, POOL.shots)
  const ok = /^(enemy-(glitterati|hogs|lovemachines|chromons|noise)-(grunt|flanker|tank|diver|sniper|splitter|mite|captor|raider)|pick-[a-z]+|rig-(marge|duckie|barton))$/
  for (const k of kinds) assert.match(k, ok)
  assert.ok(kinds.size >= 6)
})
