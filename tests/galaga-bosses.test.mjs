// Space Voyagers' five bosses and the Deaf Star: each can be beaten, each of
// its attacks can be avoided by a ship that moves at the player's speed, each
// plays differently, and nothing aimed comes without its warning.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, step, makeInput } from '../themes/galaga/engine/index.ts'
import { jumpTo, arm, run } from '../themes/galaga/engine/debug.ts'
import { createAutopilot, autopilot } from '../themes/galaga/engine/autopilot.ts'
import { ATTACK, ATTACK as A, BOSSES, BOSS_SOAK, PLAYER, SCORE, bossHp } from '../themes/galaga/engine/balance.ts'
import { ATTACK_NAMES } from '../themes/galaga/engine/attacks.ts'
import { hurtBoss } from '../themes/galaga/engine/combat.ts'
import { doorBlocks } from '../themes/galaga/engine/shots.ts'

const SECTOR = { knight: 1, humdinger: 2, durant: 3, cal: 4, fader: 5, deafstar: 5 }
const IDS = Object.keys(BOSSES)
const idle = makeInput()

function fight(id, { seed = 3, height = 320, level = 1 } = {}) {
  const w = createWorld({ seed, height })
  jumpTo(w, { sector: SECTOR[id], stage: 'boss', boss: id })
  arm(w, 'blaster', level)
  return w
}
/** Send the partner off to mend for the length of the test, so only the player's shots count. */
const alone = w => { w.partner.state = 'limp'; w.partner.t = -1e6; return w }

test('six bosses, in their sectors, each with its own attacks', () => {
  assert.deepEqual(IDS, ['knight', 'humdinger', 'durant', 'cal', 'fader', 'deafstar'])
  const all = IDS.flatMap(id => [...new Set(BOSSES[id].attacks.flat())])
  assert.equal(new Set(all).size, all.length, 'no attack is shared between two bosses')
  for (const name of all) assert.ok(ATTACK_NAMES.includes(name), `${name} is built`)
  for (const name of ATTACK_NAMES) assert.ok(all.includes(name), `${name} is used`)
  for (const id of IDS) {
    const d = BOSSES[id]
    assert.ok(d.attacks.length >= 2, `${id} has phases`)
    assert.notDeepEqual(d.attacks[d.attacks.length - 1], d.attacks[0], `${id} fights differently in its last phase`)
    assert.ok(bossHp(id, 2) > bossHp(id, 1), 'VOYAGE II: more hull')
  }
})

test('a boss walks on unharmed, then fights; its hull does not depend on the weapon level', () => {
  const w = fight('knight')
  const b = w.boss
  assert.equal(b.kind, 'boss-knight')
  assert.equal(b.state, 'enter')
  assert.equal(hurtBoss(w, 50), false)
  assert.equal(b.hp, bossHp('knight', 1))
  run(w, 200, idle)
  assert.equal(b.state, 'fight')
  // Gunfire is soaked: up to BOSS_SOAK.dps a second in full, the rest at a fraction.
  const hp = b.hp
  b.soak = BOSS_SOAK.dps
  hurtBoss(w, 100)
  assert.ok(Math.abs(hp - b.hp - (BOSS_SOAK.dps + (100 - BOSS_SOAK.dps) * BOSS_SOAK.over)) < 1e-9)
  const hp2 = b.hp
  hurtBoss(w, 40, true)
  assert.equal(hp2 - b.hp, 40, 'a rig or a friend hits whole')
})

for (const id of IDS) {
  test(`${id}: beaten by the autopilot at weapon level 1, with its phases and its cues`, () => {
    const w = fight(id)
    const ap = createAutopilot({ noDuet: true })
    // It was started by the jump: the entrance cue is in the events already.
    const cues = w.events.filter(e => e.type === 'cue').map(e => e.kind)
    const phases = []
    let attacks = new Set()
    let t = 0
    while (w.boss.active && !w.over && t++ < 15000) {
      step(w, autopilot(ap, w))
      for (const e of w.events) {
        if (e.type === 'cue') cues.push(e.kind)
        if (e.type === 'bossPhase') phases.push(e.n)
        if (e.type === 'bossAttack') attacks.add(e.kind)
      }
    }
    assert.equal(w.over, false)
    assert.equal(w.boss.active, false, `${id} went down (in ${(t / 60).toFixed(0)} s)`)
    assert.ok(t < 15000 && t > 600, `a fight, not a volley: ${t} ticks`)
    assert.equal(w.stats.bossesDown, 1)
    assert.ok(cues.includes(`boss.${id}.enter`) && cues.includes(`boss.${id}.dead`))
    assert.ok(cues.includes(`boss.${id}.taunt`))
    if (id !== 'deafstar') assert.ok(cues.includes(`boss.${id}.half`))
    assert.deepEqual(phases, BOSSES[id].phases[1] > 0 ? [2, 3] : [2])
    for (const name of new Set(BOSSES[id].attacks.flat())) assert.ok(attacks.has(name), `${id} used ${name}`)
    assert.ok(w.score >= SCORE.boss * SECTOR[id])
  })
}

for (const id of IDS) {
  test(`${id}: every attack can be avoided at the player's speed, at both heights and in every phase`, () => {
    for (const height of [320, 432]) {
      for (const name of new Set(BOSSES[id].attacks.flat())) {
        for (const late of [false, true]) {
          const w = fight(id, { seed: 7, height })
          // It flies and does not shoot: the boss cannot be hurried, the attack repeats for a minute.
          const ap = createAutopilot({ holdFire: true, dodgeOnly: true, noDuet: true })
          w.partner.state = 'limp'
          w.partner.t = -1e6
          run(w, 200, x => autopilot(ap, x))
          w.boss.force = name
          if (late) w.boss.hp = w.boss.maxHp * 0.2
          let used = 0
          for (let i = 0; i < 3600; i++) {
            step(w, autopilot(ap, w))
            for (const e of w.events) if (e.type === 'bossAttack' && e.kind === name) used++
          }
          assert.ok(used >= 5, `${name} was used (${used})`)
          assert.equal(w.stats.hits, 0, `${id} ${name} at ${height}${late ? ', last phase' : ''}`)
          assert.equal(w.player.hull, PLAYER.hull)
        }
      }
    }
  })
}

test('nothing aimed comes without its warning', () => {
  for (const id of IDS) {
    const w = fight(id, { seed: 5, level: 3 })
    const ap = createAutopilot({ holdFire: true, dodgeOnly: true, noDuet: true })
    const live = new Map()
    for (let i = 0; i < 4000; i++) {
      const aimsBefore = w.aims.filter(a => a.active).length
      step(w, autopilot(ap, w))
      for (const e of w.events) {
        // A lit patch is shown for at least half a second before it hurts.
        if (e.type === 'zone') assert.ok(e.n >= 30, `${id}: a ${e.kind} is shown ${e.n} ticks first`)
        // An aimed shot only ever leaves a line that was already showing.
        if (e.type === 'bolt' && e.kind === 'aimed') assert.ok(aimsBefore > 0, `${id}: an aimed shot had its line`)
        if (e.type === 'aim') { assert.ok(e.n >= 30); live.set(id, true) }
      }
    }
  }
  assert.ok(ATTACK.eye.warn >= 30 && ATTACK.choke.warn >= 30 && ATTACK.note.warn >= 60 && ATTACK.ram.warn >= 60)
})

test('Lord Humdinger shows a lane, then charges down it and back', () => {
  const w = fight('humdinger')
  run(w, 200, idle)
  w.boss.force = 'ram'
  let lowest = 0
  let zone = null
  for (let i = 0; i < 400; i++) {
    step(w, idle)
    zone ??= w.zones.find(z => z.active && z.kind === 'ram') ?? null
    lowest = Math.max(lowest, w.boss.y)
  }
  assert.ok(zone && zone.w === A.ram.w)
  assert.ok(lowest > w.h * 0.6, 'he comes right down the field')
  assert.ok(Math.abs(w.boss.y - w.boss.homeY) < 1 || w.boss.state === 'ram', 'and goes back up')
})

test('the Excess Machine cools when left alone, but never back past a phase it has reached', () => {
  const w = alone(fight('durant'))
  run(w, 200, idle)
  const b = w.boss
  hurtBoss(w, b.maxHp * 0.1, true)
  const hp = b.hp
  run(w, A.cool.after + 200, idle)
  assert.ok(b.hp > hp, 'it cools')
  hurtBoss(w, b.maxHp * 0.5, true)
  run(w, 2, idle)
  assert.equal(b.phase, 2)
  run(w, 4000, idle)
  assert.ok(b.hp <= b.maxHp * BOSSES.durant.phases[0] + 1e-9, 'phase 2 stays reached')
  assert.equal(b.phase, 2)
})

test('CAL 9000: only the lens takes damage, and the doors stop shots except in the gap', () => {
  const w = alone(fight('cal'))
  run(w, 200, idle)
  const b = w.boss
  assert.ok(b.whw < b.hw / 5, 'the lens is a small part of the wall')
  const door = w.barriers[0]
  assert.ok(door.active && door.y < w.h * PLAYER.topShare, 'the doors are above where the player can fly')
  let shut = false
  for (let i = 0; i < 1200 && !shut; i++) { step(w, idle); shut = door.shut === 1 }
  assert.ok(shut, 'the doors close')
  assert.equal(doorBlocks(door, door.gapX, w.w), false)
  assert.equal(doorBlocks(door, door.gapX + door.gapW / 2 + 3, w.w), true)
  assert.equal(doorBlocks(door, 2, w.w), true)
  // A shot that meets a panel is gone; one through the gap flies on.
  w.player.x = Math.min(220, door.gapX + door.gapW / 2 + 20)
  w.player.y = w.h - 40
  const ev = []
  for (let i = 0; i < 60; i++) { step(w, { ...idle, fire: true }); for (const e of w.events) ev.push({ ...e }) }
  assert.ok(ev.some(e => e.type === 'hit' && e.kind === 'door'))
  assert.ok(!ev.some(e => e.type === 'hit' && e.kind === 'boss'))
})

test('the Deaf Star: the tweeter is a small target in a wall that stops everything else', () => {
  const w = alone(fight('deafstar'))
  run(w, 200, idle)
  const b = w.boss
  assert.ok(b.whw * 2 <= 20 && b.hw >= 90)
  w.player.x = 40
  const ev = []
  for (let i = 0; i < 90; i++) { step(w, { ...idle, fire: true }); for (const e of w.events) ev.push({ ...e }) }
  assert.ok(ev.some(e => e.type === 'hit' && e.kind === 'armor'))
  assert.equal(b.hp, b.maxHp, 'a miss does nothing')
  w.player.x = b.x + b.wx
  for (let i = 0; i < 90; i++) step(w, { ...idle, fire: true })
  assert.ok(b.hp < b.maxHp)
})
