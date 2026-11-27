// THE BALANCE and THE SUPPLY ROOM (docs/games/neon-shrine-balance.md): a few end-to-end tests, four at the most
// (Petter, 2026-11-27). A scripted player goes from the Shrine's pedestal down to the machine's hall, each store
// room by each of its ways, pressing what a player presses; and the maps hold together. Not every Weight and treasure
// can be won in the world yet, so the player is handed them.
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
  for (const id of ['sword', 'echo', 'lamp', 'magnet', 'no', 'lens', 'prism', ...weights.map(w => w.id)]) Z.grant(s, id)
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

describe('The Balance', () => {
  it('goes from the pedestal through the lid, the Balance and the three store rooms, each by each of its ways, to the machine\'s hall', () => {
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

    // The hall: empty, its trap gate open, and the way back by the door.
    run(s, 0.5)
    assert.deepEqual([s.entry.entry, tile(s, 7, 10), s.map.enemies.length], ['in', '.', 0])
    through(s, 7, 11, 'supply')
    assert.equal(s.entry.entry, 'fromhall')
    through(s, 7, 1, 'supplyroom')

    // A tab reloaded: at the hall's entry, with every door as it was left.
    const back = reload(s)
    assert.deepEqual([back.map.id, back.entry.entry], ['supplyroom', 'in'])
    for (const id of ['supply.7,24', 'supply.11,12', 'supply.7,2']) assert.ok(gate(back, id), id)
    assert.ok(Z.has(back, 'balance.level') && Z.hasWeight(back, 'weightNo') && !back.flags[`seen:supplyroom`])
    // And reloaded in the Dark Store, back at the Counting Room's stair: two rooms back, through doors still open.
    const mid = reload(l)
    assert.deepEqual([mid.map.id, mid.entry.entry, tile(mid, 3, 12), tile(mid, 7, 24)], ['supply', 'in', '.', '.'])
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
