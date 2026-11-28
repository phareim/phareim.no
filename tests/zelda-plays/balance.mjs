// THE BALANCE and THE SUPPLY ROOM: the play from the pedestal to the second ending and home, on a game it did not make. `tests/zelda-balance.test.mjs` plays it on
// the game it makes; `tests/zelda-whole-game.test.mjs` plays it with the one hero who goes through everything.
import assert from 'node:assert/strict'
import { walker } from '../zelda-walk.mjs'

let Z
let P
/** The engine the helpers here play on. */
export function use(engine) { Z = engine; P = walker(Z) }

export const json = x => JSON.parse(JSON.stringify(x))
/** The tab reloaded: the save as it is stored, and the game begun where a page load begins it (`loadSpot`). */
export function reload(s) {
  const save = Z.parseSave(json({ ...Z.toSave(s), savedAt: 1 }))
  assert.ok(save, 'the save is taken back')
  return Z.createGame(Z.WORLD, { seed: 7, save, at: Z.loadSpot(Z.WORLD, save, null, Z.awayMap(Z.WORLD, save.map, save.entry)) })
}
export const step = (s, i = {}) => Z.stepGame(Z.WORLD, s, 1 / 60, P.inp(i))
export const run = (s, secs, i) => { const ev = []; for (let k = 0; k < Math.round(secs * 60); k++) ev.push(...step(s, i)); return ev }
export const tile = (s, x, y) => Z.tileAt(s.map, x, y)
const gate = (s, id) => Z.has(s, `gate:${id}`)

/** From wherever he stands into the stair or door at (x, y): through the fade, and the words that greet him. */
export function through(s, x, y, to) {
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

/** Walk to tile (tx, ty) as a hero who can be hurt: no refilled hearts, no shield (`P.walkTo` has both). */
function afoot(s, tx, ty) {
  let p = P.path(s, tx, ty)
  assert.ok(p, `no path to ${tx},${ty}`)
  let i = 0
  for (let n = 0; n < 1800; n++) {
    if (s.mode === 'dialog') { P.settle(s); continue }
    const h = s.hero
    if (Math.floor(h.x) === tx && Math.floor(h.y) === ty && Math.hypot(h.x - tx - 0.5, h.y - ty - 0.5) < 0.12) return
    while (i < p.length - 1 && Math.floor(h.x) === p[i][0] && Math.floor(h.y) === p[i][1] && Math.hypot(h.x - p[i][0] - 0.5, h.y - p[i][1] - 0.5) < 0.25) i++
    const [gx, gy] = p[Math.min(i, p.length - 1)]
    const d = Math.hypot(gx + 0.5 - h.x, gy + 0.5 - h.y) || 1
    step(s, { move: { x: (gx + 0.5 - h.x) / d, y: (gy + 0.5 - h.y) / d } })
    if (n % 90 === 89) { p = P.path(s, tx, ty) ?? p; i = 0 }
  }
  assert.fail(`afoot ${tx},${ty} timed out at ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)}`)
}

export const boss = s => s.map.enemies.find(e => e.kind === 'maximizer')

/** One step of the machine's hall: a line read and put away as a player does it, or `input()` played. */
export function tick(s, input = () => ({})) {
  if (s.mode !== 'dialog') return step(s, input())
  Z.stepGame(Z.WORLD, s, 0.3, P.inp())
  return step(s, { a: true, aPress: true })
}
/** Plays on with `input` until `done`; every event of the way. */
export function fight(s, input, done, secs = 240) {
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
export function player(s, { clip = false } = {}) {
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

/** From beside the Shrine's pedestal (the prism in hand, the seven Weights held) through the store rooms and the fight to the second ending, and home to the Shrine. Returns the game as it ends (a reload on the way makes a new one). */
export function play(engine, g, opts = {}) {
  use(engine)
  let s = g
  /** The hero's own hearts, in half hearts: the clips are counted against them. */
  const M = s.hero.maxHp
  P.walkTo(s, 24, 9)
  run(s, 0.1)
  assert.equal(tile(s, 25, 9), '>', 'the stair appears')
  through(s, 25, 9, 'balance')
  assert.equal(s.entry.entry, 'lid')

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
  assert.deepEqual([Z.has(m, 'chest:supply.heart'), m.inv.pieces], [true, (pieces + 1) % 4])

  // North into the Dark Store, which is dim for a hero with the lamp, and lit once the receiver is.
  north(s, 7, 24, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 7, 20))
  P.settle(s)
  const dark = Z.toSave(s)
  // The lane between the blocks and the receiver is no place for the Lamp: walking round the blocks and setting it
  // down there is refused (the hero still walks there), and nothing is lit.
  const round = Z.createGame(Z.WORLD, { seed: 7, save: Z.parseSave(json(dark)) })
  Z.setViewRule(round, 'flat')
  north(round, 7, 24, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 7, 20))
  P.settle(round)
  for (const y of [16, 14]) {
    tap(round, 'lamp', 7, y, 'up')
    assert.ok(!round.lamp && !Z.has(round, 'supply.lit') && Math.floor(round.hero.y) === y, `no lamp stands at 7,${y - 1}`)
  }
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
  // Out and in again with the glass down: the opened chest is still a chest, solid.
  const chestBack = reload(l)
  run(chestBack, 0.1)
  assert.notEqual(tile(chestBack, 2, 15), '.', 'an opened hidden chest stays solid after a reload')
  P.walkTo(l, 3, 13)
  P.face(l, 'up')
  P.pressA(l)
  assert.deepEqual([tile(l, 3, 12), Z.keyCount(l), Z.has(l, 'supply.lit')], ['.', 0, false])
  north(l, 3, 12, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 3, 5))

  // The Loading Bay by the Duck, from its east gate, by a hero who can be hurt: set it down in the south, east of the
  // middle, and walk the west wall to the lever while both hounds stand looking at it. No blow is struck at either,
  // and over a handful of seeds he loses no more than a heart on the way.
  P.settle(s)
  const gateSave = json(Z.toSave(s))
  const lost = []
  for (const seed of [7, 11, 23, 41, 59]) {
    const d = Z.createGame(Z.WORLD, { seed, save: Z.parseSave(gateSave) })
    north(d, 7, 24, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 7, 20))
    P.settle(d)
    Z.setViewRule(d, 'iso')
    north(d, 11, 12, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 11, 5))
    P.settle(d)
    d.hero.hp = d.hero.maxHp
    d.hero.invuln = 0
    afoot(d, 8, 8)
    P.face(d, 'right')
    d.inv.selected = 'duck'
    step(d, { bPress: true })
    assert.ok(d.duck, `seed ${seed}: the Duck is down`)
    run(d, 1)
    assert.equal(d.map.enemies.filter(e => e.kind === 'hound' && e.ai.lure > 0).length, 2, `seed ${seed}: both look at it`)
    afoot(d, 2, 3)
    P.swing(d, 'up')
    run(d, 0.2)
    assert.ok(gate(d, 'supply.7,2') && d.map.enemies.filter(e => e.kind === 'hound' && !e.dead && e.hp === e.maxHp).length === 2, `seed ${seed}: the lever, and no blow struck`)
    lost.push(d.hero.maxHp - d.hero.hp)
    if (seed === 7) through(d, 7, 1, 'supplyroom')
  }
  if (process.env.BALANCE_LOG) console.log(`duck walk, hit points lost over five seeds: ${lost}`)
  assert.ok(lost.every(n => n <= 2), `hit points lost on the Duck's way: ${lost}`)

  // A doorway is no seat: a hero who stands on the open tile of the Bay's south wall is reached by a lunge.
  const camp = Z.createGame(Z.WORLD, { seed: 7, save: Z.parseSave(gateSave) })
  north(camp, 7, 24, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 7, 20))
  P.settle(camp)
  north(camp, 11, 12, Z.cellIndex(Z.mapInfo(Z.WORLD, 'supply'), 11, 5))
  P.settle(camp)
  P.walkTo(camp, 11, 11)
  camp.hero.hp = camp.hero.maxHp
  camp.hero.invuln = 0
  let camped = 0
  for (let k = 0; k < 60 * 20 && !camped && camp.mode === 'play'; k++) camped += step(camp).filter(e => e.type === 'hurt').length
  assert.ok(camped > 0 && Math.floor(camp.hero.y) === 11, 'a hero camped in the doorway is hit')

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
  assert.deepEqual([s.hero.maxHp, Z.heroCap(s)], [M, M - 2])
  assert.ok(s.hero.hp <= Z.heroCap(s))

  // The tab reloaded there: at the hall's entry, part two from its start, every heart a heart, the doors as left.
  const back = reload(s)
  assert.deepEqual([back.map.id, back.entry.entry, back.hero.maxHp, back.hero.hp, back.clips], ['supplyroom', 'in', M, M, undefined])
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
  if (process.env.BALANCE_LOG) console.log(`maximizer: part one ${(parts[2].at - parts[1].at).toFixed(1)} s, part three ${(back.elapsed - parts[3].at).toFixed(1)} s; ${ev2.filter(e => e.type === 'hurt').length} blows taken`)
  // (Seven rounds, each with its blow to read: no quick hero is done before the paint has landed.)
  assert.ok(back.elapsed - parts[3].at > 45, 'part three takes its time')
  const flags = Object.keys(back.flags)

  // THE QUESTION: the floor bare, the hero safe, and a moment later it asks, the cursor on NO.
  const q = () => back.mode === 'dialog' && back.dialog.ask && back.dialog.line === back.dialog.lines.length - 1
  const asks = () => { for (let k = 0; k < 600 && !q(); k++) { if (back.mode === 'dialog') tick(back); else step(back) } assert.ok(q(), 'it asks') }
  asks()
  assert.deepEqual([back.dialog.ask.options, back.dialog.choice, back.dialog.who, boss(back).hp, back.clips], [['YES', 'NO'], 1, 'MAXIMIZER', 1, undefined])
  assert.ok(!back.map.tiles.includes('▩') && !back.map.bombs.length)
  // B backs out of it; it asks again.
  step(back, { bPress: true })
  assert.equal(back.mode, 'play')
  run(back, 0.5)
  assert.equal(back.mode, 'play', 'a breath first')
  asks()
  // YES: the row of hearts shows as clips for a moment, nothing is taken, and the question comes back.
  const mine = () => json([back.hero.hp, back.hero.maxHp, back.clips ?? 0, back.inv])
  const had = mine()
  run(back, 2)
  step(back, { move: { x: -1, y: 0 } })
  step(back, { a: true, aPress: true })
  assert.equal(back.dialog.lines[0], 'MAXIMIZER: LOVELY. HOLD STILL.')
  for (let k = 0; k < 20 && back.mode === 'dialog'; k++) tick(back)
  run(back, 0.2)
  assert.ok(back.clipFlash > 2 && !Z.has(back, 'maximizer.yes'))
  assert.deepEqual(mine(), had)
  asks()
  assert.deepEqual([back.dialog.lines[0], back.dialog.lines.length, back.dialog.choice, back.clipFlash], ['(IT DID NOT TAKE.)', 2, 1, undefined])
  // NO, with a thumb that has only been cutting: A ten times a second. Each page (the question, the three of the
  // reply) stands at least 0.6 s fully typed before a press takes it.
  const end = []
  const stood = []
  let page = null
  let from = 0
  let k = 0
  for (; k < 900 && boss(back).ai.mode !== 'down'; k++) {
    const d = back.mode === 'dialog' ? back.dialog : null
    const id = d ? `${d.lines[0]}|${d.line}` : null
    const typed = d && d.chars >= d.lines[d.line].length
    if (id !== page) { if (page && from >= 0) stood.push(k - from); page = id; from = -1 }
    if (typed && from < 0) from = k
    end.push(...step(back, { a: k % 6 === 0, aPress: k % 6 === 0 }))
  }
  if (page && from >= 0) stood.push(k - from)
  assert.equal(stood.length, 4, 'the question and its three pages were each shown')
  if (process.env.BALANCE_LOG) console.log(`frames each page stood typed: ${stood}`)
  assert.ok(stood.every(n => n >= 36), `frames each page stood typed before it was answered: ${stood}`)
  assert.equal(boss(back).ai.mode, 'down')
  assert.deepEqual([boss(back).hp, boss(back).dead, end.filter(e => e.type === 'bossDown').length], [0, false, 1])
  // A tab closed in the middle of the fall comes back to the question, so the ending is never lost.
  run(back, 1.5)
  const cut = reload(back)
  run(cut, 0.1)
  assert.deepEqual([boss(cut).ai.mode, boss(cut).hp, Z.has(cut, 'maximizer'), Z.has(cut, 'ending2')], ['question', 1, false, false])

  // THE SECOND ENDING: the mode, the flag, the event, the gate open; and not one thing of the first ending's.
  for (let k = 0; k < 600 && back.mode === 'play'; k++) end.push(...step(back))
  assert.deepEqual([back.mode, Z.has(back, 'ending2'), Z.has(back, 'maximizer'), boss(back).dead], ['end2', true, true, true])
  assert.deepEqual([end.filter(e => e.type === 'end2').length, end.filter(e => e.type === 'bossDown').length, [tile(back, 7, 10), tile(back, 8, 10)]], [1, 1, ['.', '.']])
  assert.ok(![...ev2, ...end].some(e => e.type === 'won' || e.type === 'died'))
  assert.deepEqual(Object.keys(back.flags).filter(f => !flags.includes(f) && !f.startsWith('gate:')).sort(), ['ending2', 'maximizer'])
  assert.ok(Z.has(back, 'won'), 'the first ending is as it was')
  // The world holds still under the page; the first ending's way back does not move it.
  const held = back.elapsed
  Z.resumeAfterWin(back)
  run(back, 1)
  assert.deepEqual([back.mode, back.elapsed, Z.has(back, 'maximizer.after')], ['end2', held, false])
  // Played on: one line in the quiet hall, once, and the way home through doors still open to the Shrine.
  Z.resumeAfterEnd2(back)
  run(back, 0.1)
  assert.deepEqual([back.mode, back.dialog?.lines], ['dialog', ['(THE HALL IS QUIET. ONE CLIP LIES ON THE FLOOR.)']])
  P.settle(back)
  run(back, 1)
  assert.equal(back.mode, 'play')
  through(back, 7, 11, 'supply')
  assert.equal(back.entry.entry, 'fromhall')
  // South through the three store rooms (the Dark Store by the door the Lamp's way opened).
  P.walkTo(back, 7, 10)
  P.walkTo(back, 11, 13)
  P.settle(back)
  P.walkTo(back, 7, 22)
  P.walkTo(back, 7, 25)
  P.settle(back)
  through(back, 7, 34, 'balance')
  through(back, 7, 10, 'shrine')
  assert.deepEqual([back.entry.entry, back.mode], ['lid', 'play'])

  // And reloaded in the Dark Store, back at the Counting Room's stair: two rooms back, through doors still open.
  const mid = reload(l)
  assert.deepEqual([mid.map.id, mid.entry.entry, tile(mid, 3, 12), tile(mid, 7, 24)], ['supply', 'in', '.', '.'])
  return back
}
