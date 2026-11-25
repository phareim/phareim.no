// Neon Shrine field battles (MapDef.battle; docs/games/neon-shrine-battle.md): fights start on contact only on
// battle maps, the time gauges decide who acts, the four commands, combo techs need Luna, statuses, the three
// ways a fight ends, and the same seed and presses give the same fight.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const step = (s, i = inp(), dt = 1 / 60) => Z.stepGame(Z.WORLD, s, dt, i)
const group = id => Z.WORLD.maps.arena.battle.groups.find(g => g.id === id)
const foesOf = (s, id) => s.battle.fighters.filter(f => f.side === 'foe' && (!id || f.foe === id))
const me = (s, m) => s.battle.fighters.find(f => f.member === m)

/** In the glade with the blade (and Luna), next to group `id`; returns the state. */
function glade(id, { luna = false, seed = 4, hp = 10 } = {}) {
  const s = Z.createGame(Z.WORLD, { seed, at: { map: 'arena', entry: 'start' } })
  s.inv.sword = true
  s.hero.maxHp = hp
  s.hero.hp = hp
  if (luna) s.flags.luna = true
  const g = group(id)
  Z.enterMap(Z.WORLD, s, 'arena', 'start', [], { x: g.x, y: g.y + 2.8 })
  s.hero.dir = 'up'
  return s
}

/** Walk up into the group until the fight is on and everyone stands in place. */
function engage(s) {
  for (let k = 0; k < 600 && s.mode === 'play'; k++) step(s, inp({ move: { x: 0, y: -1 } }))
  assert.equal(s.mode, 'battle')
  for (let k = 0; k < 120 && s.battle.phase === 'intro'; k++) step(s)
  assert.equal(s.battle.phase, 'fight')
}

/** Run time until `who`'s menu is open (others' menus answered with A). */
function untilMenu(s, who = 'hero', max = 3000) {
  for (let k = 0; k < max; k++) {
    if (s.mode !== 'battle') return false
    const m = s.battle.menu
    if (m && m.who === who) return true
    step(s, m ? inp({ aPress: true }) : inp())
  }
  return false
}

/** Let the action in flight play out. */
function settle(s) { for (let k = 0; k < 200 && s.mode === 'battle' && s.battle.act; k++) step(s) }

describe('field battles', () => {
  it('start on contact only on a battle map; its foes do not fight in real time', () => {
    const s = glade('arena.goo')
    const goo = s.map.enemies.filter(e => e.group === 'arena.goo')
    assert.equal(goo.length, 2)
    // Standing still beside them for a while: nothing hurts, nothing starts.
    for (let k = 0; k < 120; k++) step(s)
    assert.equal(s.mode, 'play')
    assert.equal(s.hero.hp, 10)
    engage(s)
    assert.equal(s.battle.group, 'arena.goo')
    assert.equal(foesOf(s).length, 2)
    // After the prism the day's clock leaves the groups alone (no night twins that fight in real time).
    const d = glade('arena.goo')
    d.inv.prism = true
    d.daytime = 230
    Z.enterMap(Z.WORLD, d, 'arena', 'start', [])
    assert.ok(d.map.enemies.every(e => e.group && e.rank === undefined))
    // A placed enemy on an ordinary map is still the action combat's.
    const o = Z.createGame(Z.WORLD, { seed: 4, at: { map: 'overworld', entry: 'hut' } })
    o.inv.sword = true
    const blob = o.map.enemies.find(e => e.kind === 'blob')
    o.hero.auto = null
    o.hero.x = blob.x; o.hero.y = blob.y + 0.3
    for (let k = 0; k < 30; k++) step(o)
    assert.notEqual(o.mode, 'battle')
    assert.ok(!o.battle)
  })

  it('a blade struck first gives the party full gauges; a group that sees the hero gets a head start', () => {
    const s = glade('arena.goo')
    const e = s.map.enemies.find(x => x.group === 'arena.goo')
    s.hero.x = e.x; s.hero.y = e.y + 1.05; s.hero.dir = 'up'
    step(s, inp({ aPress: true, a: true }))
    for (let k = 0; k < 20 && s.mode === 'play'; k++) step(s)
    assert.equal(s.mode, 'battle')
    assert.equal(s.battle.first, 'party')
    assert.equal(me(s, 'hero').atb, 1)
    assert.ok(foesOf(s).every(f => f.atb === 0))
    const p = glade('arena.pond')
    p.hero.y += 0.4
    for (let k = 0; k < 400 && p.mode === 'play'; k++) step(p, inp({ move: { x: 0, y: -0.4 } }))
    assert.equal(p.battle.first, 'foes')
    assert.ok(foesOf(p).every(f => f.atb >= 0.5))
  })

  it('the fuller gauge acts first, and the menu stops the clock', () => {
    const s = glade('arena.flit')
    engage(s)
    const [a, b] = foesOf(s, 'flitter')
    for (const f of s.battle.fighters) f.atb = 0
    a.atb = 0.8
    b.atb = 0.95
    for (let k = 0; k < 600 && !s.battle.act; k++) step(s)
    assert.equal(s.battle.act.who, b.id)
    settle(s)
    for (let k = 0; k < 600 && !s.battle.act; k++) step(s)
    assert.equal(s.battle.act.who, a.id)
    // Once the hero's gauge is full his menu opens and nothing fills while it is up.
    assert.ok(untilMenu(s))
    const before = s.battle.fighters.map(f => f.atb)
    for (let k = 0; k < 120; k++) step(s)
    assert.deepEqual(s.battle.fighters.map(f => f.atb), before)
  })

  it('STRIKE, TECH, ITEM and FLEE', () => {
    const s = glade('arena.goo', { hp: 10 })
    s.inv.tonics = 2
    engage(s)
    assert.ok(untilMenu(s))
    const hero = me(s, 'hero')
    const tp = hero.tp
    // STRIKE: A, A (the nearest foe).
    const hp0 = foesOf(s).map(f => f.hp).reduce((a, b) => a + b)
    step(s, inp({ aPress: true }))
    assert.equal(s.battle.menu.level, 'target')
    step(s, inp({ aPress: true }))
    settle(s)
    const hp1 = foesOf(s).map(f => f.hp).reduce((a, b) => a + b)
    assert.ok(hp1 < hp0, 'the strike hurt a foe')
    assert.ok(hero.tp === tp + 1 || hp1 === hp0)
    // TECH: SWEEP hits the target and its neighbour (they stand together), and costs a tech point.
    assert.ok(untilMenu(s))
    hero.tp = 2
    s.battle.fighters.forEach(f => { if (f.side === 'foe') f.hp = f.maxHp })
    step(s, inp({ pick: { cmd: 1 } }))
    assert.equal(s.battle.menu.level, 'tech')
    step(s, inp({ pick: { cmd: 0 } }))
    assert.equal(s.battle.menu.level, 'target')
    step(s, inp({ aPress: true }))
    settle(s)
    assert.equal(hero.tp, 1)
    assert.ok(foesOf(s).every(f => f.hp < f.maxHp || f.down), 'the sweep reached both')
    // ITEM: a tonic heals and is used up.
    assert.ok(untilMenu(s))
    s.hero.hp = 3
    step(s, inp({ pick: { cmd: 2 } }))
    step(s, inp({ pick: { cmd: 0 } }))
    step(s, inp({ aPress: true }))
    settle(s)
    assert.equal(s.inv.tonics, 1)
    assert.ok(s.hero.hp >= 7)
    // FLEE: the party runs back the way it came, the foes stand winded and start nothing for a while.
    assert.ok(untilMenu(s))
    const x0 = s.hero.y
    step(s, inp({ pick: { cmd: 3 } }))
    for (let k = 0; k < 200 && s.mode === 'battle'; k++) step(s)
    assert.equal(s.mode, 'play')
    assert.ok(!s.battle)
    assert.ok(s.hero.y > x0 + 1, 'ran away from them')
    const left = s.map.enemies.filter(e => e.group === 'arena.goo' && !e.dead)
    assert.ok(left.length > 0 && left.every(e => e.stun > 0))
    for (let k = 0; k < 60; k++) step(s, inp({ move: { x: 0, y: -1 } }))
    assert.equal(s.mode, 'play', 'winded foes start no fight')
  })

  it('no running from the knight', () => {
    const s = glade('arena.knight', { hp: 20 })
    engage(s)
    assert.ok(untilMenu(s))
    assert.equal(Z.menuView(s).lines[3].ok, false)
    step(s, inp({ pick: { cmd: 3 } }))
    assert.equal(s.mode, 'battle')
    assert.ok(s.battle.menu, 'still choosing')
  })

  it('a combo tech needs Luna, and both full gauges', () => {
    const solo = glade('arena.goo')
    engage(solo)
    assert.ok(untilMenu(solo))
    me(solo, 'hero').tp = 3
    solo.battle.menu.level = 'tech'
    assert.deepEqual(Z.menuView(solo).lines.map(l => l.label), ['SWEEP', 'CRACK'])

    const s = glade('arena.goo', { luna: true })
    assert.ok(s.luna)
    engage(s)
    assert.equal(s.battle.fighters.filter(f => f.side === 'party').length, 2)
    assert.ok(untilMenu(s))
    const hero = me(s, 'hero')
    const luna = me(s, 'luna')
    hero.tp = 3; luna.tp = 3
    luna.atb = 0.4
    s.battle.queue = s.battle.queue.filter(id => id !== 'luna')
    s.battle.menu.level = 'tech'
    let lines = Z.menuView(s).lines
    assert.deepEqual(lines.map(l => l.label), ['SWEEP', 'CRACK', 'STORM', 'LANCE'])
    assert.equal(lines[2].ok, false, 'Luna is not ready')
    luna.atb = 1
    lines = Z.menuView(s).lines
    assert.equal(lines[2].ok, true)
    const before = foesOf(s).map(f => f.hp)
    step(s, inp({ pick: { cmd: 2 } }))
    assert.ok(s.battle.act, 'STORM hits all: no target to pick')
    assert.equal(hero.atb, 0)
    assert.equal(luna.atb, 0, 'both turns spent')
    assert.equal(hero.tp, 2)
    assert.equal(luna.tp, 2)
    settle(s)
    foesOf(s).forEach((f, i) => assert.ok(f.down || f.hp < before[i]))
  })

  it('statuses: static on a foe by the water soaks and dazes it, slow halves the gauge, break hits harder', () => {
    const s = glade('arena.pond', { luna: true, hp: 20 })
    engage(s)
    const drone = foesOf(s, 'drone').find(f => Z.wet(Z.ctx(Z.WORLD, s, []), f))
    assert.ok(drone, 'a drone hovers by the pond')
    assert.ok(untilMenu(s, 'luna'))
    me(s, 'luna').tp = 3
    drone.hp = drone.maxHp = 200
    step(s, inp({ pick: { cmd: 1 } }))
    step(s, inp({ pick: { cmd: 0 } })) // ZAP
    step(s, inp({ pick: { target: drone.id } }))
    settle(s)
    const zapped = 200 - drone.hp
    assert.ok(drone.status.stun > 0, 'soaked: dazed')
    assert.ok(drone.status.static > 0)
    // ZAP is 6 × 1.3 ≈ 8 dry; the pond doubles it, and the drone is weak to static.
    assert.ok(zapped >= 18, `zap by the water hit ${zapped}`)
    // Static stings each second.
    const hp = drone.hp
    for (const f of s.battle.fighters) f.atb = f.side === 'party' ? -100 : 0
    s.battle.queue = []
    s.battle.menu = null
    for (let k = 0; k < 75; k++) step(s)
    assert.ok(drone.hp < hp)
    // Slow: half the fill.
    const g = glade('arena.goo')
    engage(g)
    const [a, b] = foesOf(g)
    for (const f of g.battle.fighters) f.atb = 0
    me(g, 'hero').atb = -100
    a.status.slow = 30
    for (let k = 0; k < 120; k++) step(g)
    assert.ok(Math.abs(a.atb * 2 - b.atb) < 0.01, `slow ${a.atb} vs ${b.atb}`)
    // Break: a sweep on a broken foe hits half again as hard (the roll is ±10 %, so it always shows).
    const sweep = (broken) => {
      assert.ok(untilMenu(g))
      me(g, 'hero').tp = 3
      for (const f of foesOf(g)) { f.hp = f.maxHp = 300; f.status = broken ? { break: 30 } : {} }
      step(g, inp({ pick: { cmd: 1 } }))
      step(g, inp({ pick: { cmd: 0 } }))
      step(g, inp({ pick: { target: a.id } }))
      settle(g)
      return 300 - a.hp
    }
    me(g, 'hero').atb = 1
    const plain = sweep(false)
    const broken = sweep(true)
    assert.ok(broken > plain * 1.2, `broken ${broken} vs ${plain}`)
  })

  it('a win pays bits, the foes are gone, a once-group stays gone and gives its prize', () => {
    const s = glade('arena.knight', { hp: 20 })
    const bits = s.inv.bits
    engage(s)
    assert.ok(untilMenu(s))
    for (const f of foesOf(s)) f.hp = 1
    for (const f of foesOf(s)) f.status = {}
    foesOf(s, 'knight')[0].guard = false
    // Strike them down one turn at a time.
    for (let k = 0; k < 20 && s.mode === 'battle'; k++) {
      if (!untilMenu(s)) break
      step(s, inp({ aPress: true }))
      step(s, inp({ aPress: true }))
      settle(s)
      for (const f of foesOf(s)) if (!f.down) f.hp = 1
    }
    for (let k = 0; k < 120 && s.mode === 'battle'; k++) step(s)
    assert.equal(s.mode, 'get', 'the prize is held up')
    assert.ok(s.inv.bits >= bits + 50 + 35)
    assert.ok(s.map.enemies.filter(e => e.group === 'arena.knight').every(e => e.dead))
    assert.ok(s.flags['battle:arena.knight'])
    Z.enterMap(Z.WORLD, s, 'arena', 'start', [])
    assert.equal(s.map.enemies.filter(e => e.group === 'arena.knight').length, 0)
    assert.equal(s.map.enemies.filter(e => e.group === 'arena.goo').length, 2, 'the others stand again')
  })

  it('falling in a fight is the usual death', () => {
    const s = glade('arena.flit', { hp: 1 })
    engage(s)
    for (const f of foesOf(s)) f.hp = f.maxHp = 500
    for (let k = 0; k < 4000 && s.mode === 'battle'; k++) step(s, s.battle?.menu ? inp({ aPress: true }) : inp())
    assert.equal(s.mode, 'dying')
    for (let k = 0; k < 200 && s.mode === 'dying'; k++) step(s)
    assert.equal(s.mode, 'play')
    assert.ok(!s.battle)
    assert.equal(s.hero.hp, s.hero.maxHp)
  })

  it('the same seed and presses give the same fight', () => {
    const run = () => {
      const s = glade('arena.pond', { luna: true, seed: 11, hp: 12 })
      engage(s)
      let n = 0
      for (let k = 0; k < 2400 && s.mode === 'battle'; k++) step(s, s.battle?.menu && n++ % 7 === 0 ? inp({ aPress: true }) : inp())
      return JSON.stringify({ mode: s.mode, hp: s.hero.hp, rng: s.rng, bits: s.inv.bits, b: s.battle && s.battle.fighters.map(f => [f.hp, f.atb.toFixed(4)]) })
    }
    assert.equal(run(), run())
  })

  it('tonics are saved, and an older save without them still loads', () => {
    const s = glade('arena.goo')
    s.inv.tonics = 3
    const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    assert.equal(save.inv.tonics, 3)
    const old = JSON.parse(JSON.stringify(Z.toSave(s)))
    delete old.inv.tonics
    const back = Z.parseSave(old)
    assert.ok(back)
    assert.equal(Z.createGame(Z.WORLD, { save: back }).inv.tonics, 0)
  })

  it('keeps a guardian group (noFlee) from being fled, knight or not', () => {
    const g = group('arena.goo')
    g.noFlee = true
    try {
      const s = glade('arena.goo')
      engage(s)
      assert.ok(untilMenu(s))
      const flee = Z.menuView(s).lines.find(l => l.label === 'FLEE')
      assert.equal(flee.ok, false)
    } finally { delete g.noFlee }
  })

  it('lets no guard go up while BREAK is on', () => {
    const s = glade('arena.knight', { hp: 40 })
    engage(s)
    const knight = foesOf(s, 'knight')[0]
    knight.status.break = 5
    knight.guard = false
    for (let k = 0; k < 3000 && s.mode === 'battle' && knight.status.break > 0.5; k++) {
      step(s, s.battle.menu ? inp({ aPress: true }) : inp())
      assert.ok(!(knight.guard && knight.status.break > 0), 'a guard under BREAK')
    }
  })

  it('beats a once-group for good only when its prize is given, in the same step', () => {
    const s = glade('arena.knight', { hp: 40 })
    engage(s)
    for (const f of foesOf(s)) f.hp = 1
    let sawWonWithoutPrize = false
    for (let k = 0; k < 4000 && s.mode === 'battle'; k++) {
      step(s, s.battle?.menu ? inp({ aPress: true }) : inp())
      if (s.flags['battle:arena.knight'] && !s.flags['battle:arena.knight:prize'] && group('arena.knight').prize) sawWonWithoutPrize = true
    }
    assert.equal(sawWonWithoutPrize, false)
    assert.equal(s.flags['battle:arena.knight'], true)
  })
})
