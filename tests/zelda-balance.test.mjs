// THE BALANCE and THE SUPPLY ROOM (docs/games/neon-shrine-balance.md): a few end-to-end tests, four at the most
// (Petter, 2026-11-27). A scripted player goes from the Shrine's pedestal down to the machine's hall, each store
// room by each of its ways, pressing what a player presses, and fights THE PAPERCLIP MAXIMIZER with the blade to its
// last question; a hero who stands still loses to it; its fight keeps its place across a save and a death; and the maps
// hold together. Not every Weight and treasure can be won in the world yet, so the player is handed them.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

let Z
let P
before(async () => { Z = await load(); P = walker(Z) })

const MAPS = ['balance', 'supply', 'supplyroom']
const json = x => JSON.parse(JSON.stringify(x))
/** The tab reloaded: the save as it is stored, and the game begun where a page load begins it (`loadSpot`). */
function reload(s) {
  const save = Z.parseSave(json({ ...Z.toSave(s), savedAt: 1 }))
  assert.ok(save, 'the save is taken back')
  return Z.createGame(Z.WORLD, { seed: 7, save, at: Z.loadSpot(Z.WORLD, save, null, Z.awayMap(Z.WORLD, save.map, save.entry)) })
}
const step = (s, i = {}) => Z.stepGame(Z.WORLD, s, 1 / 60, P.inp(i))
const run = (s, secs, i) => { const ev = []; for (let k = 0; k < Math.round(secs * 60); k++) ev.push(...step(s, i)); return ev }
const tile = (s, x, y) => Z.tileAt(s.map, x, y)
const gate = (s, id) => Z.has(s, `gate:${id}`)

/** A hero as the last dungeon finds him: the quest won, the prism in hand, `weights` of the seven, every treasure. */
function hero(weights = Z.WEIGHTS) {
  const s = Z.createGame(Z.WORLD, { seed: 7 })
  s.mode = 'play'
  s.dialog = null
  for (const id of ['sword', 'echo', 'lamp', 'magnet', 'no', 'duck', 'lens', 'prism', ...weights.map(w => w.id)]) Z.grant(s, id)
  for (const f of ['boss', 'gateShut', 'won', 'took:shrine.prism', 'took:shrine.container']) s.flags[f] = true
  s.hero.hp = s.hero.maxHp
  return s
}

/** From wherever he stands into the stair or door at (x, y): through the fade, and the words that greet him. */
function through(s, x, y, to) {
  P.walkTo(s, x, y)
  P.until(s, () => s.map.id === to && s.mode === 'play')
}
/** North through a doorway into the next room. */
function north(s, x, y, cell) {
  P.walkTo(s, x, y + 1)
  P.until(s, () => s.zoneIndex === cell && s.mode === 'play', P.inp({ move: { x: 0, y: -1 } }))
}
/** Stand on (x, y), face `dir` and tap B with `item`. */
function tap(s, item, x, y, dir) {
  P.walkTo(s, x, y)
  run(s, 0.2)
  P.useB(s, item, dir, 80)
}

const boss = s => s.map.enemies.find(e => e.kind === 'maximizer')

/** One step of the machine's hall: a line read and put away as a player does it, or `input()` played. */
function tick(s, input = () => ({})) {
  if (s.mode !== 'dialog') return step(s, input())
  Z.stepGame(Z.WORLD, s, 0.3, P.inp())
  return step(s, { a: true, aPress: true })
}
/** Plays on with `input` until `done`; every event of the way. */
function fight(s, input, done, secs = 240) {
  const ev = []
  for (let k = 0; k < secs * 60 && !done(); k++) {
    assert.ok(s.mode === 'play' || s.mode === 'dialog', `the hero stands (${s.mode}, part ${boss(s).ai.part}, ${boss(s).ai.mode})`)
    ev.push(...tick(s, input))
  }
  assert.ok(done(), `part ${boss(s).ai.part}, ${boss(s).ai.mode}, hp ${boss(s).hp}`)
  return ev
}

/**
 * A player of the Maximizer's fight with the blade alone, who goes by what is painted on the floor, a moment after it
 * appears: out of the pink, onto a lit station, beside the machine while its bar is gold, and one cut there. `clip`:
 * once, in part two, they stay in a circle and lose a heart to it.
 */
function player(s, { clip = false } = {}) {
  let was = ''
  let since = 0
  let k = 0
  return () => {
    const m = s.map
    const h = s.hero
    const e = boss(s)
    const mark = `${e.ai.mode}.${e.ai.cycle}.${e.ai.round}`
    since = mark === was ? since + 1 / 60 : 0
    was = mark
    if (clip && e.ai.part === 2 && !s.clips && e.ai.mode === 'work') return {}
    const pink = since < 0.25 ? [] : Z.stencilsOf(e, { w: Z.WORLD, s }).filter(p => p.tone !== 'cyan' && !p.fake && !p.dim)
    const safe = (x, y) => !pink.some(p => [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]].some(([a, b]) => Z.inStencil(p, x + a, y + b)))
    const free = (x, y) => !Z.circleBlocked(Z.WORLD, m, x, y, Z.HERO_R)
    const clear = (x, y) => {
      const d = Math.hypot(x - h.x, y - h.y)
      for (let u = 0.15; u < d; u += 0.15) if (!free(h.x + ((x - h.x) * u) / d, h.y + ((y - h.y) * u) / d)) return false
      return free(x, y)
    }
    const station = Z.stationOf(e)?.live
    const open = Z.bossOpen(e)
    let goal = null
    if (station?.lit) goal = station
    else if (open) {
      if (Math.hypot(e.x - h.x, e.y - h.y) <= 2.3) {
        if (!h.swing) h.dir = Math.abs(e.x - h.x) > Math.abs(e.y - h.y) ? (e.x > h.x ? 'right' : 'left') : (e.y > h.y ? 'down' : 'up')
        const press = ++k % 8 === 0
        return { a: press, aPress: press }
      }
      goal = { x: e.x, y: e.y + 2.2 }
    } else if (e.ai.part < 3) goal = { x: 8.5, y: 6.5 }
    // Out of the paint: to the nearest clear spot, leaning to where they were going.
    if (pink.length && (!safe(h.x, h.y) || (goal && !safe(goal.x, goal.y)))) {
      let best = Infinity
      const want = goal ?? { x: 8.5, y: 6 }
      for (let y = 1.4; y <= 9.6; y += 0.2) for (let x = 1.4; x <= 14.6; x += 0.2) {
        const cost = Math.hypot(x - h.x, y - h.y) + 0.25 * Math.hypot(x - want.x, y - want.y)
        if (cost < best && safe(x, y) && clear(x, y)) { best = cost; goal = { x, y } }
      }
    }
    if (!goal) return {}
    // Round the piles, a tile at a time, where the straight way is shut.
    if (!clear(goal.x, goal.y)) {
      const way = P.path(s, Math.floor(goal.x), Math.floor(goal.y))
      if (way?.[1]) goal = { x: way[1][0] + 0.5, y: way[1][1] + 0.5 }
    }
    const dx = goal.x - h.x
    const dy = goal.y - h.y
    const d = Math.hypot(dx, dy)
    return d > 0.08 ? { move: { x: dx / d, y: dy / d } } : {}
  }
}

describe('The Balance', () => {
  it('goes from the pedestal through the lid, the Balance and the three store rooms, each by each of its ways, and fights the machine with the blade to its question', () => {
    // The pedestal: floor until the prism is in hand, and no stair under a hero who stands on the spot.
    let s = hero()
    delete s.flags['item:prism']
    s.inv.prism = false
    Z.enterMap(Z.WORLD, s, 'shrine', 'start', [], { x: 25.5, y: 9.5 })
    run(s, 0.5)
    assert.equal(tile(s, 25, 9), '.', 'no lid without the prism')
    Z.grant(s, 'prism')
    P.settle(s)
    run(s, 0.5)
    assert.deepEqual([tile(s, 25, 9), s.map.id], ['.', 'shrine'], 'it waits while he stands there')
    P.walkTo(s, 24, 9)
    run(s, 0.1)
    assert.equal(tile(s, 25, 9), '>', 'the stair appears')
    through(s, 25, 9, 'balance')
    assert.equal(s.entry.entry, 'lid')
    // A save that already held the prism finds the lid open as the map loads.
    const old = hero()
    Z.enterMap(Z.WORLD, old, 'shrine', 'start', [])
    assert.equal(tile(old, 25, 9), '>')

    // The Balance: the Weights go down by themselves, the hero free all the while; then it is level and opens.
    const shut = [[7, 5], [8, 5], [7, 6], [8, 6]]
    const ev = []
    let first = null
    let last = null
    for (let k = 0; k < 60 * 8 && !Z.has(s, 'balance.level'); k++) {
      if (s.mode === 'dialog') { P.settle(s); continue }
      const got = step(s)
      for (const e of got) if (e.type === 'pan') { first ??= k; last = k }
      ev.push(...got)
    }
    assert.equal(ev.filter(e => e.type === 'pan').length, 7)
    assert.ok((last - first) / 60 <= 2.5, `seven pans in ${(last - first) / 60} s after the first`)
    assert.ok(Z.WEIGHTS.every(w => Z.has(s, `balance.${w.word.toLowerCase()}`) && Z.hasWeight(s, w.id)), 'down on the pans, and still held')
    assert.ok(ev.some(e => e.type === 'secret'), 'the floor opens with its jingle')
    P.settle(s)
    assert.ok(Z.has(s, 'balance.leveled') && shut.every(([x, y]) => tile(s, x, y) === '>'))
    through(s, 7, 6, 'supply')
    assert.equal(s.entry.entry, 'in')

    // The Counting Room, by the Echo: leave it on one plate, stand on the other.
    const door = Z.toSave(s)
    tap(s, 'echo', 11, 29, 'right')
    assert.ok(s.echo && !gate(s, 'supply.7,24'), 'one plate is not enough')
    P.walkTo(s, 2, 29)
    run(s, 0.2)
    assert.ok(gate(s, 'supply.7,24') && tile(s, 7, 24) === '.', 'both held: open for good')

    // By the Magnet, from the same door: pull the crate onto the far plate and stand on the near one.
    const m = Z.createGame(Z.WORLD, { seed: 7, save: Z.parseSave(json(door)) })
    assert.deepEqual([m.map.id, m.entry.entry, gate(m, 'supply.7,24')], ['supply', 'in', false])
    tap(m, 'magnet', 10, 29, 'right')
    assert.equal(tile(m, 11, 29), '▣', 'the crate rests on the plate')
    assert.ok(!gate(m, 'supply.7,24'))
    P.walkTo(m, 2, 29)
    run(m, 0.2)
    assert.ok(gate(m, 'supply.7,24'))

    // The heart piece wants both at once: a crate, the echo and the hero on three plates.
    tap(m, 'magnet', 10, 30, 'right')
    assert.equal(tile(m, 11, 30), '▣')
    tap(m, 'echo', 6, 30, 'up')
    assert.ok(!gate(m, 'supply.2,27'))
    P.walkTo(m, 2, 31)
    run(m, 0.2)
    assert.ok(gate(m, 'supply.2,27'), 'the closet opens')
    P.walkTo(m, 2, 26)
    P.face(m, 'up')
    const pieces = m.inv.pieces
    P.pressA(m)
    assert.deepEqual([Z.has(m, 'chest:supply.heart'), m.inv.pieces], [true, pieces + 1])

    // North into the Dark Store, which is dim for a hero with the lamp, and lit once the receiver is.
    north(s, 7, 24, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 7, 20))
    P.settle(s)
    const dark = Z.toSave(s)
    // By the Lamp, on the view rule: from above the beam ends at the square blocks; turned, it goes through them.
    Z.setViewRule(s, 'flat')
    tap(s, 'lamp', 7, 21, 'up')
    run(s, 1)
    assert.ok(s.lamp && !Z.has(s, 'supply.lit'), 'the squares stop it')
    assert.ok(Z.setViewRule(s, 'iso'), 'a turn is free south of the blocks')
    run(s, 0.3)
    assert.ok(Z.has(s, 'supply.lit') && gate(s, 'supply.11,12'), 'lit, and the east gate open')
    north(s, 11, 12, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 11, 5))

    // By the Lens, from the same door: stand still, find the chest, take its key, unlock the west door.
    let l = Z.createGame(Z.WORLD, { seed: 7, save: Z.parseSave(json(dark)) })
    Z.setViewRule(l, 'flat')
    north(l, 7, 24, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 7, 20))
    P.settle(l)
    P.walkTo(l, 2, 16)
    P.face(l, 'up')
    assert.ok(!Z.lensUp(l))
    run(l, 1)
    assert.ok(Z.lensUp(l) && l.map.lensSeen.includes(15 * 16 + 2), 'the glass shows the chest')
    P.pressA(l)
    assert.deepEqual([Z.has(l, 'chest:supply.key'), Z.keyCount(l)], [true, 1])
    P.walkTo(l, 3, 13)
    P.face(l, 'up')
    P.pressA(l)
    assert.deepEqual([tile(l, 3, 12), Z.keyCount(l), Z.has(l, 'supply.lit')], ['.', 0, false])
    north(l, 3, 12, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 3, 5))

    // The Loading Bay by the Duck, from its own door: set it down in the south, east of the middle, and walk the west
    // wall to the lever while both hounds stand looking at it. No blow is struck at either.
    P.settle(s)
    const d = Z.createGame(Z.WORLD, { seed: 7, save: Z.parseSave(json(Z.toSave(s))) })
    north(d, 7, 24, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 7, 20))
    P.settle(d)
    Z.setViewRule(d, 'iso')
    north(d, 11, 12, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 11, 5))
    P.settle(d)
    tap(d, 'duck', 8, 8, 'right')
    assert.ok(d.duck, 'the Duck is down')
    run(d, 1)
    const watching = d.map.enemies.filter(e => e.kind === 'hound' && e.ai.lure > 0)
    assert.equal(watching.length, 2, 'both look at it')
    P.walkTo(d, 2, 3)
    P.swing(d, 'up')
    run(d, 0.2)
    assert.ok(gate(d, 'supply.7,2') && d.map.enemies.filter(e => e.kind === 'hound' && !e.dead && e.hp === e.maxHp).length === 2)
    through(d, 7, 1, 'supplyroom')

    // The Loading Bay, by the No: let the hounds come, refuse each lunge with a cut, and cut while it reels.
    // (No hand of god here: the hero's own hearts, and nothing that shields him.)
    P.settle(s)
    s.hero.hp = s.hero.maxHp
    s.hero.invuln = 0
    const hounds = s.map.enemies.filter(e => e.kind === 'hound')
    assert.equal(hounds.length, 2)
    let refused = 0
    let blows = 0
    for (let k = 0; k < 60 * 90 && hounds.some(e => !e.dead); k++) {
      if (s.mode !== 'play') { P.settle(s); continue }
      const h = s.hero
      const near = hounds.filter(e => !e.dead).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0]
      const dx = near.x - h.x
      const dy = near.y - h.y
      const d = Math.hypot(dx, dy)
      const reels = near.stun > 0 && d < 1.9
      // The lunge told and begun: the swing's first cut is the one that meets it.
      const comes = near.ai.mode === 'lunge' && d < 3
      if ((comes || reels) && !h.swing) h.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')
      const press = (comes && !h.swing) || (reels && k % 8 === 0)
      // (A reeling hound a step off is walked up to.)
      const go = near.stun > 0 && d >= 1.2 ? { x: dx / d, y: dy / d } : { x: 0, y: 0 }
      const got = step(s, { move: go, a: press, aPress: press })
      refused += got.filter(e => e.type === 'refuse').length
      blows += got.filter(e => e.type === 'hurt').length
      assert.ok(s.hero.hp > 0, 'the hero stands')
    }
    assert.ok(hounds.every(e => e.dead) && refused >= 2, `both down, ${refused} lunges refused, ${blows} blows taken`)
    if (process.env.BALANCE_LOG) console.log(`hounds: ${refused} refused, ${blows} blows, hp ${s.hero.hp}/${s.hero.maxHp}`)
    // The lever in its alcove, one swing, and the way up.
    P.walkTo(s, 2, 3)
    P.swing(s, 'up')
    run(s, 0.2)
    assert.ok(Z.has(s, 'supply.lever3') && gate(s, 'supply.7,2'))
    through(s, 7, 1, 'supplyroom')

    // The hall: the trap gate shuts behind the hero, the machine has said who it is, and part one is fought. No hand
    // of god from here: the hero's own hearts.
    run(s, 0.3)
    assert.deepEqual([s.entry.entry, tile(s, 7, 10), tile(s, 8, 10), boss(s).hp, Z.has(s, 'maximizer.card')], ['in', 'X', 'X', 24, true])
    s.hero.hp = s.hero.maxHp
    s.hero.invuln = 0
    const hall = []
    const parts = {}
    /** Notes when each part begins, with its hit points. */
    const watch = (state, input) => () => { const e = boss(state); parts[e.ai.part] ??= { at: state.elapsed, hp: e.hp }; return input() }
    const play = player(s, { clip: true })
    // To the middle of part two, a clip held.
    hall.push(...fight(s, watch(s, play), () => s.mode === 'play' && boss(s).ai.part === 2 && boss(s).ai.mode === 'ask' && s.clips > 0))
    assert.ok(Z.has(s, 'maximizer.p2') && boss(s).hp > 8 && boss(s).hp <= 16 && Z.has(s, 'maximizer.clipline'))
    assert.deepEqual([s.hero.maxHp, Z.heroCap(s)], [6, 4])
    assert.ok(s.hero.hp <= Z.heroCap(s))

    // The tab reloaded there: at the hall's entry, part two from its start, every heart a heart, the doors as left.
    const back = reload(s)
    assert.deepEqual([back.map.id, back.entry.entry, back.hero.maxHp, back.hero.hp, back.clips], ['supplyroom', 'in', 6, 6, undefined])
    for (const id of ['supply.7,24', 'supply.11,12', 'supply.7,2']) assert.ok(gate(back, id), id)
    assert.ok(Z.has(back, 'balance.level') && Z.hasWeight(back, 'weightNo') && !back.flags[`seen:supplyroom`])
    run(back, 0.1)
    assert.deepEqual([boss(back).ai.part, boss(back).hp, tile(back, 7, 10)], [2, 16, 'X'])

    // On to the end: part two again, the four stations' worth of clips, the seven Weights, each cut once.
    const rounds = new Set()
    const on = player(back)
    const rest = fight(back, watch(back, () => { const st = Z.stationOf(boss(back))?.live; if (st) rounds.add(st.weight); return on() }), () => boss(back).ai.mode === 'question')
    const ev2 = [...hall, ...rest]
    assert.deepEqual([parts[1].hp, parts[2].hp, parts[3].hp], [24, 16, 8])
    assert.deepEqual([...rounds], Z.WEIGHTS.map(w => w.id))
    assert.ok([1, 2, 3, 4, 5, 6, 7].every(n => Z.has(back, `maximizer.w${n}`)) && Z.has(back, 'maximizer.q'))
    // Nothing is asked yet and the machine stands: the hero safe, the floor bare, the game in play, no ending.
    fight(back, () => ({}), () => back.mode === 'play', 5)
    run(back, 3)
    assert.deepEqual([back.mode, boss(back).hp, boss(back).dead, back.clips, Z.stencilsOf(boss(back)).length, Z.stationOf(boss(back))], ['play', 1, false, undefined, 0, null])
    assert.ok(!back.map.tiles.includes('▩') && Z.has(back, 'won') && !Z.has(back, 'maximizer') && !Z.has(back, 'ending2'))
    assert.ok(!ev2.some(e => e.type === 'won' || e.type === 'bossDown' || e.type === 'died'))
    // And the question is what a save from here comes back to.
    const asked = reload(back)
    run(asked, 0.1)
    assert.deepEqual([boss(asked).ai.mode, boss(asked).hp], ['question', 1])
    if (process.env.BALANCE_LOG) console.log(`maximizer: part one ${(parts[2].at - parts[1].at).toFixed(1)} s, part three ${(back.elapsed - parts[3].at).toFixed(1)} s; ${ev2.filter(e => e.type === 'hurt').length} blows taken`)

    // And reloaded in the Dark Store, back at the Counting Room's stair: two rooms back, through doors still open.
    const mid = reload(l)
    assert.deepEqual([mid.map.id, mid.entry.entry, tile(mid, 3, 12), tile(mid, 7, 24)], ['supply', 'in', '.', '.'])
  })

  it('is lost by a hero who stands still: the lane comes to them until the hearts are gone', () => {
    const s = hero()
    s.hero.maxHp = s.hero.hp = 20
    Z.enterMap(Z.WORLD, s, 'supplyroom', 'in', [])
    const under = []
    let secs = 0
    for (; secs < 90 && s.mode !== 'dying'; secs += s.mode === 'dialog' ? 0 : 1 / 60) {
      const mode = boss(s).ai.mode
      if (tick(s).some(e => e.type === 'hurt')) under.push(mode)
    }
    assert.equal(s.mode, 'dying', `${s.hero.hp} half hearts left after ${secs.toFixed(0)} s`)
    assert.deepEqual([under.length, new Set(under), boss(s).hp], [10, new Set(['reach']), 24])
    if (process.env.BALANCE_LOG) console.log(`a still hero of ten hearts dies after ${secs.toFixed(1)} s`)
  })

  it('keeps its place and the hero\'s hearts: a save mid fight holds no clip, and a death starts the round reached', () => {
    // In part two, a heart already a clip.
    const s = hero()
    s.hero.maxHp = s.hero.hp = 14
    for (const f of ['maximizer.card', 'maximizer.p2', 'maximizer.t2']) s.flags[f] = true
    Z.enterMap(Z.WORLD, s, 'supplyroom', 'in', [])
    fight(s, () => ({}), () => s.clips === 1 && s.mode === 'play', 20)
    const held = json({ ...Z.toSave(s), savedAt: 1 })
    assert.deepEqual([held.maxHp, held.hp, 'clips' in held, held.map, held.entry], [14, 14, false, 'supplyroom', 'in'])
    assert.ok(held.flags.includes('maximizer.p2'))
    // Whatever B holds, the save is taken: the clips never reach the pack.
    for (const selected of ['echo', 'lamp', 'magnet', null]) {
      const save = Z.parseSave({ ...held, inv: { ...held.inv, selected } })
      assert.deepEqual([save?.inv.selected, save?.maxHp], [selected, 14])
      const l = Z.createGame(Z.WORLD, { seed: 7, save, at: Z.loadSpot(Z.WORLD, save, null, true) })
      run(l, 0.1)
      assert.deepEqual([l.entry.entry, boss(l).ai.part, boss(l).hp, l.clips, l.hero.hp], ['in', 2, 16, undefined, 14])
    }
    // Part three takes four hearts, each round's station gives one back, and a death starts the round reached with no
    // more clips than a first try would hold there, the hearts filled and the floor bare.
    for (const f of ['maximizer.p3', 'maximizer.t3', 'maximizer.clipline', 'maximizer.w1']) s.flags[f] = true
    Z.respawn(Z.WORLD, s)
    run(s, 0.1)
    assert.deepEqual([boss(s).ai.part, boss(s).ai.round, boss(s).hp, s.clips, s.hero.hp, s.hero.maxHp], [3, 2, 7, 3, 8, 14])
    fight(s, player(s), () => boss(s).ai.round === 4, 60)
    assert.deepEqual([boss(s).hp, s.clips], [5, 1])
    // (Cut down there.)
    s.hero.invuln = 0
    Z.hurtHero(Z.ctx(Z.WORLD, s, []), 99, 8, 8)
    assert.equal(s.mode, 'dying')
    run(s, 2.5)
    assert.deepEqual([s.mode, s.entry.entry, boss(s).ai.round, boss(s).hp, s.clips, s.hero.hp], ['play', 'in', 4, 5, 1, 12])
  })

  it('holds together: the validator and the key rule, the rooms in their order, six Weights open nothing, the Shrine as it was', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD), [])
    const marks = MAPS.flatMap(id => {
      const def = Z.WORLD.maps[id]
      assert.ok(def.resume && def.kind === 'dungeon' && def.keyring === 'supply', id)
      return Z.mapInfo(Z.WORLD, id).marks.map(m => m.ent)
    })
    // One small key, one locked run, no big door and no big key.
    const supply = Z.mapInfo(Z.WORLD, 'supply')
    const locks = supply.base.filter((t, i) => t === 'L' && supply.base[i - 1] !== 'L').length
    const keys = marks.filter(e => (e.t === 'chest' && e.item === 'smallKey') || (e.t === 'enemy' && e.carries === 'smallKey')).length
    assert.deepEqual([keys, locks], [1, 1])
    assert.ok(!marks.some(e => e.item === 'bigKey') && MAPS.every(id => !Z.mapInfo(Z.WORLD, id).base.includes('K')))
    // South to north: each doorway of a store room leads into the next, and every way down or up lands.
    const warps = MAPS.flatMap(id => Z.mapInfo(Z.WORLD, id).warps.map(w => `${id}>${w.to}:${w.entry}`))
    assert.deepEqual([...new Set(warps)].sort(), ['balance>shrine:lid', 'balance>supply:in', 'supply>balance:hole', 'supply>supplyroom:in', 'supplyroom>supply:fromhall'])
    for (const y of [11, 23]) assert.ok(supply.base.slice(y * 16, y * 16 + 16).some((t, x) => t === '.' && ['.', 'L', 'X'].includes(supply.base[(y + 1) * 16 + x])), `a way between rows ${y} and ${y + 1}`)
    // The Shrine keeps its size, and the lid is where the pedestal is.
    const shrine = Z.WORLD.maps.shrine
    assert.deepEqual([shrine.rows.length, shrine.rows[0].length], [48, 48])
    assert.deepEqual(Z.mapInfo(Z.WORLD, 'shrine').warps.find(w => w.to === 'balance'), { x: 25, y: 9, w: 1, h: 1, to: 'balance', entry: 'lid', when: { item: 'prism' } })

    // Six Weights: six pans, nothing level, the floor shut; nothing is refused and nothing is taken away.
    const s = hero(Z.WEIGHTS.slice(0, 6))
    Z.enterMap(Z.WORLD, s, 'balance', 'lid', [])
    for (let k = 0; k < 400; k++) { if (s.mode === 'dialog') P.settle(s); else step(s) }
    assert.equal(Z.WEIGHTS.filter(w => Z.has(s, `balance.${w.word.toLowerCase()}`)).length, 6)
    assert.ok(!Z.has(s, 'balance.level') && tile(s, 7, 5) === '.')
    P.walkTo(s, 7, 5)
    run(s, 1)
    assert.deepEqual([s.map.id, s.mode], ['balance', 'play'], 'floor, and no way down')
    assert.equal(Z.weightCount(s), 6)
    through(s, 7, 10, 'shrine')
    // The seventh, won later, goes down the next time he walks in.
    Z.grant(s, Z.WEIGHTS[6].id)
    P.settle(s)
    P.walkTo(s, 24, 10)
    through(s, 25, 9, 'balance')
    for (let k = 0; k < 400 && !Z.has(s, 'balance.level'); k++) { if (s.mode === 'dialog') P.settle(s); else step(s) }
    P.settle(s)
    assert.ok(Z.has(s, 'balance.level') && tile(s, 7, 5) === '>' && Z.weightCount(s) === 7)
  })
})
