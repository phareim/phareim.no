// Space Voyagers' engine: the partner's capture, dock and loose; the convoy
// and the rescue with both their outcomes; Hans Duo; friends' passes in the
// last fight. Small scripted worlds, plain node.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, step, makeInput } from '../themes/galaga/engine/index.ts'
import { sandbox, place, run, jumpTo, arm } from '../themes/galaga/engine/debug.ts'
import { createAutopilot, autopilot } from '../themes/galaga/engine/autopilot.ts'
import { CAPTOR, CONVOY, PARTNER, RESCUE, SCORE, SECTORS, WING_GUNS, BOSSES } from '../themes/galaga/engine/balance.ts'
import { hurtEnemy } from '../themes/galaga/engine/combat.ts'
import { launchDive } from '../themes/galaga/engine/waves.ts'
import { fireInterval } from '../themes/galaga/engine/weapons.ts'

const idle = makeInput()
const firing = { ...makeInput(), fire: true }
function collect(w, n, input = idle, until = () => false) {
  const out = []
  for (let i = 0; i < n && !w.over; i++) {
    step(w, typeof input === 'function' ? input(w) : input)
    for (const e of w.events) out.push({ ...e })
    if (until(w)) break
  }
  return out
}
const has = (ev, type, kind) => ev.some(e => e.type === type && (kind === undefined || e.kind === kind))
const cues = ev => ev.filter(e => e.type === 'cue').map(e => e.kind)

/** A captor in the formation that has just been sent for the partner. */
function capture(pilot = 'rex') {
  const w = createWorld({ seed: 1, height: 320, pilot })
  sandbox(w)
  run(w, 30, idle)
  const c = place(w, 'captor', 4, 0)
  launchDive(w, c, w.enemies.indexOf(c))
  const ev = collect(w, 600, idle, x => x.partner.state === 'hanging' && c.state === 'form')
  return { w, c, ev }
}

test('capture: the captor hovers, shows its beam, lifts the partner (never the player) and hangs it in formation', () => {
  const { w, c, ev } = capture()
  const order = ['beam', 'beamOn', 'capture'].map(t => ev.findIndex(e => e.type === t))
  assert.ok(order.every(i => i >= 0) && order.join() === [...order].sort((a, b) => a - b).join(), `in order: ${order}`)
  assert.equal(ev.find(e => e.type === 'beam').n, CAPTOR.warn, 'the beam is shown before it is on')
  assert.equal(w.partner.state, 'hanging')
  assert.equal(c.carrying, true)
  assert.equal(c.state, 'form')
  assert.ok(Math.abs(w.partner.x - c.x) < 1 && w.partner.y > c.y)
  assert.equal(w.player.hull, 5)
  assert.equal(w.player.y, 280, 'the player is where it was')
  assert.ok(cues(ev).includes('partner.captured.nova'))
  assert.ok(cues(ev).includes('see.captor'))
  const more = collect(w, 900, idle)
  assert.ok(cues(more).includes('partner.hanging.nova'), 'and complains on the radio')
})

test('freed on the dive: the partner docks for 12 s and the two fire as one', () => {
  const { w, c } = capture()
  launchDive(w, c, w.enemies.indexOf(c))
  run(w, 20, idle)
  assert.equal(c.state, 'dive')
  const score = w.score
  hurtEnemy(w, c, 99, true)
  assert.equal(w.score - score, CAPTOR.freedScore)
  assert.equal(w.partner.state, 'docking')
  const ev = collect(w, 400, firing, x => x.partner.state === 'docked')
  assert.equal(w.partner.state, 'docked')
  assert.equal(w.partner.dock, PARTNER.dockTicks)
  assert.equal(PARTNER.dockTicks, 720)
  assert.ok(Math.abs(Math.abs(w.partner.x - w.player.x) - PARTNER.dockOffset) < 1e-9, 'side by side')
  const shots = collect(w, 180, { ...firing, dx: 1 }).filter(e => e.type === 'shot')
  const mine = shots.filter(e => e.n === 0).length
  assert.equal(shots.filter(e => e.n === 1).length, mine, 'double guns: one volley each, together')
  assert.equal(mine, 180 / fireInterval('blaster'))
  assert.ok(Math.abs(Math.abs(w.partner.x - w.player.x) - PARTNER.dockOffset) < 1e-9, 'and it stays alongside')
  const after = collect(w, PARTNER.dockTicks, idle)
  assert.ok(has(after, 'undocked'))
  assert.equal(w.partner.state, 'fly')
})

test('the freed cue is asked when the captor pops on the dive', () => {
  const { w, c } = capture('nova')
  launchDive(w, c, w.enemies.indexOf(c))
  run(w, 20, idle)
  hurtEnemy(w, c, 99, true)
  assert.ok(cues(w.events).includes('partner.freed.rex'))
  assert.ok(has(w.events, 'freed'))
})

test('loose: a captor shot in formation lets the partner go without a dock', () => {
  const { w, c } = capture()
  assert.equal(c.state, 'form')
  hurtEnemy(w, c, 99, true)
  assert.equal(w.partner.state, 'fly')
  assert.ok(has(w.events, 'loose'))
  assert.ok(cues(w.events).includes('partner.loose.nova'))
  const ev = collect(w, 400, idle)
  assert.ok(!has(ev, 'docked'))
  assert.equal(w.stats.docks, 0)
})

test('the captor leaves a limping partner alone, and the player can pull the partner clear', () => {
  const w = createWorld({ seed: 2, height: 320 })
  sandbox(w)
  run(w, 30, idle)
  const c = place(w, 'captor', 4, 0)
  launchDive(w, c, w.enemies.indexOf(c))
  // Fly away from the beam: the partner follows the player out of it.
  const ev = collect(w, 400, { ...idle, dx: -1 })
  assert.ok(has(ev, 'beamOn'))
  assert.ok(!has(ev, 'capture'))
  assert.equal(w.partner.state, 'fly')
})

/** Sector `n`, wave 3: the event begins on the first tick. */
function event(sector, seed = 1, height = 320) {
  const w = createWorld({ seed, height })
  jumpTo(w, { sector, stage: 'wave', wave: 3 })
  arm(w, 'blaster', 3)
  return w
}

test('convoy, home safe: 40 s up a side lane, cover from enemy shots, a crate of two, a bonus and a friend', () => {
  const w = event(1)
  const ap = createAutopilot()
  const ev = collect(w, 4000, x => autopilot(ap, x), x => !x.convoy.active && x.tick > 100)
  assert.ok(has(ev, 'convoyIn', 'marge'))
  assert.ok(cues(ev).includes('convoy.marge.hail'))
  assert.ok(has(ev, 'convoySafe', 'marge'))
  assert.ok(cues(ev).includes('convoy.marge.safe'))
  assert.deepEqual(w.friends, ['marge'])
  assert.ok(Math.abs(w.tick - CONVOY.ticks) < 200, `about 40 s, took ${w.tick} ticks`)
  assert.equal(ev.filter(e => e.type === 'drop' && e.y === 24).length, CONVOY.crate)
  assert.ok(has(ev, 'latch', 'rig'), 'raiders went for it')
  assert.ok(w.convoy.cargo > 0)
})

test('convoy, a rig is cover: it stops their shots and lets ours through', async () => {
  const { spawnBolt, spawnRig } = await import('../themes/galaga/engine/world.ts')
  const w = createWorld({ seed: 1 })
  sandbox(w)
  spawnRig(w, 'rig-marge', 'convoy', 120, 200, 0, CONVOY.rigHw, CONVOY.rigHh)
  const b = spawnBolt(w, 'bolt', 120, 110, 0, 2)
  const far = spawnBolt(w, 'bolt', 60, 110, 0, 2)
  const e = place(w, 'tank', 0, 0)
  e.hp = e.maxHp = 50; e.col = -1; e.state = 'free'; e.vx = e.vy = 0; e.x = 120; e.y = 60
  w.convoy.active = false
  for (let i = 0; i < 30; i++) step(w, firing)
  assert.equal(b.active, false, 'stopped by the rig')
  assert.equal(far.active, true)
  assert.ok(e.hp < 50, 'the player shot through it')
  assert.equal(w.player.hull, 5)
})

test('convoy, cargo gone: the cab unhooks and drives on, no bonus, no friend', () => {
  const w = event(2, 3)
  const ap = createAutopilot({ holdFire: true, dodgeOnly: true, noDuet: true })
  w.partner.state = 'limp'
  w.partner.t = -1e6
  const score = w.score
  const ev = collect(w, 6000, x => autopilot(ap, x), x => !x.convoy.active && x.tick > 100)
  assert.ok(has(ev, 'convoyIn', 'duckie'))
  assert.equal(w.rigs.length >= 3, true)
  assert.ok(has(ev, 'convoyLost', 'duckie'))
  assert.ok(cues(ev).includes('convoy.duckie.lost'))
  assert.ok(cues(ev).includes('convoy.duckie.threat'))
  assert.ok(!has(ev, 'convoySafe'))
  assert.deepEqual(w.friends, [])
  assert.ok(w.score - score < SCORE.convoy)
  assert.deepEqual(SECTORS[1].event, { type: 'convoy', id: 'duckie' })
})

test('rescue, saved: clear the raiders, hold beside her for 2 s, and she flies along with a bigger gun', () => {
  for (const [sector, id] of [[3, 'babs'], [4, 'ridley'], [5, 'lena']]) {
    const w = event(sector, 2)
    const ap = createAutopilot()
    const ev = collect(w, 6000, x => autopilot(ap, x), x => x.wing.state === 'flying')
    assert.ok(has(ev, 'rescueIn', id))
    assert.equal(w.wing.kind, `stranded-${id}`)
    assert.ok(cues(ev).includes(`rescue.${id}.hail`))
    assert.ok(has(ev, 'cables', id))
    assert.ok(cues(ev).includes(`rescue.${id}.cables`))
    assert.ok(has(ev, 'rescued', id), `${id} rescued`)
    assert.ok(cues(ev).includes(`rescue.${id}.saved`))
    assert.deepEqual(w.friends, [id])
    const after = collect(w, 900, x => autopilot(ap, x))
    assert.ok(after.some(e => e.type === 'shot' && e.kind === 'wing' && e.n === 2), 'she fires her own gun')
    const g = WING_GUNS[id]
    assert.ok(g.dmg * g.dxs.length * 60 / g.every > 60 / fireInterval('blaster'), 'bigger than a level 1 blaster')
  }
  assert.equal(Math.round(1 / RESCUE.fill), 120, 'two seconds of cables')
})

test('rescue: the bar fills only within reach and drains slowly away from it', () => {
  const w = event(3, 4)
  const g = w.wing
  run(w, 2, idle)
  for (const e of w.enemies) e.active = false
  g.state = 'stalled'; g.x = 120; g.y = w.h * RESCUE.yShare
  w.raidT = 1e9
  w.player.x = 120; w.player.y = g.y + 30
  run(w, 60, idle)
  assert.ok(Math.abs(g.bar - 60 * RESCUE.fill) < 1e-9)
  run(w, 100, { ...idle, hasTarget: true, tx: 20, ty: w.h - 30 })
  const bar = g.bar
  assert.ok(bar < 60 * RESCUE.fill && bar > 0.3, 'it drains slowly when you leave')
  assert.ok(RESCUE.drain < RESCUE.fill / 2)
})

test('rescue, lost: raiders drag her off the top; she says she is fine, and is no friend this run', () => {
  const w = event(4, 5)
  const ap = createAutopilot({ holdFire: true, dodgeOnly: true, noDuet: true })
  w.partner.state = 'limp'
  w.partner.t = -1e6
  const ev = collect(w, 9000, x => { for (const e of x.enemies) if (e.active && e.role !== 'raider') e.active = false; return autopilot(ap, x) }, x => x.wing.state === 'off' && x.tick > 200)
  assert.ok(has(ev, 'latch', 'stranded'))
  assert.ok(has(ev, 'rescueLost', 'ridley'))
  assert.ok(cues(ev).includes('rescue.ridley.lost'))
  assert.deepEqual(w.friends, [])
  assert.equal(w.wing.state, 'off')
})

test('raiders go for the rig or the stranded ship, not for the player', () => {
  const w = event(1, 6)
  const ap = createAutopilot({ holdFire: true, dodgeOnly: true, noDuet: true })
  w.partner.state = 'limp'
  w.partner.t = -1e6
  let seen = 0
  for (let i = 0; i < 1500; i++) {
    for (const e of w.enemies) if (e.active && e.role !== 'raider') e.active = false
    step(w, autopilot(ap, w))
    for (const e of w.enemies) {
      if (!e.active || e.role !== 'raider' || e.state !== 'latch') continue
      seen++
      const rig = w.rigs[e.mode]
      assert.ok(Math.abs(e.x - rig.x) <= CONVOY.rigHw + 6)
    }
  }
  assert.ok(seen > 0)
  assert.equal(w.stats.hits, 0)
})

test('Hans Duo turns up in sectors 2 and 4, clears about half a wave for no points, and leaves', () => {
  assert.deepEqual(SECTORS.map(s => s.duo), [false, true, false, true, false])
  for (const sector of [2, 4]) {
    const w = createWorld({ seed: 3 })
    jumpTo(w, { sector, stage: 'wave', wave: 2 })
    const ap = createAutopilot({ holdFire: true, dodgeOnly: true, noDuet: true })
    w.partner.state = 'limp'
    w.partner.t = -1e6
    let before = 0
    const ev = collect(w, 2500, x => { if (!x.duo.active && !x.duoDone) before = x.inForm; return autopilot(ap, x) }, x => x.duoDone && !x.duo.active)
    assert.ok(has(ev, 'duoIn') && has(ev, 'duoOut'))
    assert.equal(w.duo.kind, 'duo')
    assert.ok(cues(ev).includes(`duo.arrive.${sector}`) && cues(ev).includes(`duo.leave.${sector}`))
    const popped = ev.filter(e => e.type === 'pop')
    assert.ok(popped.length >= 2 && popped.length <= Math.ceil(before / 2), `popped ${popped.length} of ${before}`)
    assert.ok(popped.every(e => e.n === 0), 'he takes the credit')
    assert.equal(w.score, 0)
  }
  const w = createWorld({ seed: 3 })
  jumpTo(w, { sector: 1, stage: 'wave', wave: 2 })
  assert.ok(!has(collect(w, 1500, idle), 'duoIn'))
})

test('friends come back: each one made makes a pass when the last boss changes phase; no friends, no passes', () => {
  const fight = friends => {
    const w = createWorld({ seed: 9 })
    for (const f of friends) w.friends.push(f)
    jumpTo(w, { sector: 5, stage: 'boss' })
    arm(w, 'blaster', 5)
    const ap = createAutopilot()
    return { w, ev: collect(w, 30000, x => autopilot(ap, x), x => x.stage === 'clear') }
  }
  const all = fight(['marge', 'duckie', 'babs', 'ridley', 'lena'])
  assert.equal(all.w.stage, 'clear', 'Dark Fader and then the Deaf Star are beaten')
  assert.deepEqual(all.ev.filter(e => e.type === 'pass').map(e => e.kind), ['marge', 'duckie', 'babs', 'ridley', 'lena'])
  for (const f of ['marge', 'duckie', 'babs', 'ridley', 'lena']) assert.ok(cues(all.ev).includes(`cavalry.${f}`))
  assert.ok(!cues(all.ev).includes('cavalry.none'))
  assert.deepEqual(all.ev.filter(e => e.type === 'bossIn').map(e => e.kind), ['fader', 'deafstar'])
  assert.deepEqual(SECTORS[4].bosses, ['fader', 'deafstar'])
  const none = fight([])
  assert.equal(none.ev.filter(e => e.type === 'pass').length, 0)
  assert.equal(cues(none.ev).filter(c => c === 'cavalry.none').length, 1)
  assert.ok(BOSSES.deafstar.phases[1] > 0, 'the Deaf Star has three phases')
})
