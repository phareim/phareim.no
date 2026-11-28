// THE BALANCE and THE SUPPLY ROOM (docs/games/neon-shrine-balance.md): a few end-to-end tests, four at the most
// (Petter, 2026-11-27). A scripted player goes from the Shrine's pedestal down to the machine's hall, each store
// room by each of its ways, pressing what a player presses, fights THE PAPERCLIP MAXIMIZER with the blade, answers its
// last question, sees the second ending and walks home; a hero who stands still loses to it; its fight keeps its place
// across a save and a death; and the maps hold together. The player is handed the Weights and the treasures.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'
import { json, reload, step, run, tile, through, boss, tick, fight, player, play, use } from './zelda-plays/balance.mjs'

let Z
let P
before(async () => { Z = await load(); P = walker(Z); use(Z) })

const MAPS = ['balance', 'supply', 'supplyroom']
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

describe('The Balance', () => {
  it('goes from the pedestal through the lid, the Balance and the three store rooms, each by each of its ways, fights the machine with the blade, says NO to its question, and ends the game the second way', () => {
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
    // A save that already held the prism finds the lid open as the map loads.
    const old = hero()
    Z.enterMap(Z.WORLD, old, 'shrine', 'start', [])
    assert.equal(tile(old, 25, 9), '>')
    play(Z, s)
  })

  it('is lost by a hero who stands still, in every part and every round: the paint comes to them', () => {
    const begun = ['maximizer.card', 'maximizer.p2', 'maximizer.t2']
    const third = [...begun, 'maximizer.p3', 'maximizer.t3', 'maximizer.clipline']
    const rounds = Z.WEIGHTS.map((w, i) => ({ name: `round ${i + 1}`, part: 3, hp: 8 - i, flags: [...third, ...Z.WEIGHTS.slice(0, i).map((_, n) => `maximizer.w${n + 1}`)] }))
    // (In part one also from behind the ring's piles, where a blow has thrown them: cover holds one lane, not two.)
    const cases = [{ name: 'part one', part: 1, hp: 24, flags: [] }, { name: 'part one, in cover', part: 1, hp: 24, flags: [], at: [2, 5] }, { name: 'part two', part: 2, hp: 16, flags: begun }, ...rounds]
    const took = []
    for (const c of cases) {
      const s = hero()
      s.hero.maxHp = s.hero.hp = 20
      for (const f of c.flags) s.flags[f] = true
      Z.enterMap(Z.WORLD, s, 'supplyroom', 'in', [])
      step(s)
      if (c.at) [s.hero.x, s.hero.y] = c.at
      const under = []
      let secs = 0
      for (; secs < 200 && s.mode !== 'dying'; secs += s.mode === 'dialog' ? 0 : 1 / 60) {
        const mode = boss(s).ai.mode
        if (tick(s).some(e => e.type === 'hurt')) under.push(mode)
      }
      assert.equal(s.mode, 'dying', `${c.name}: ${s.hero.hp} half hearts left after ${secs.toFixed(0)} s`)
      assert.deepEqual([boss(s).ai.part, boss(s).hp, new Set(under)], [c.part, c.hp, new Set([c.part < 3 ? 'reach' : 'blow'])], c.name)
      if (c.name === 'part one') assert.equal(under.length, 10)
      took.push(`${c.name} ${secs.toFixed(1)} s (${under.length} blows)`)
    }
    if (process.env.BALANCE_LOG) console.log(`a still hero of ten hearts dies: ${took.join(', ')}`)

    // The echo cuts the machine only for a hero who is beside it: from afar it clanks, from beside it counts.
    const e1 = hero()
    e1.hero.maxHp = e1.hero.hp = 40
    Z.enterMap(Z.WORLD, e1, 'supplyroom', 'in', [])
    step(e1)
    fight(e1, () => ({}), () => boss(e1).ai.mode === 'ask', 60)
    const m1 = boss(e1)
    const c1 = Z.ctx(Z.WORLD, e1, [])
    const full = m1.hp
    Object.assign(e1.hero, { x: 2.5, y: 9.5 })
    Z.hitEnemy(c1, m1, 1, 8.5, 5.5, 'echo')
    assert.equal(m1.hp, full, 'an echo\'s cut from afar clanks')
    Object.assign(e1.hero, { x: m1.x, y: m1.y + 2.5 })
    Z.hitEnemy(c1, m1, 1, 8.5, 5.5, 'echo')
    assert.equal(m1.hp, full - 1, 'from beside it counts')

    // The Lamp's beam is one hit point an opening: set down by a hero who then stands still, it takes some, and
    // never more than one in an opening, so part one is not cleared.
    const l1 = hero()
    l1.hero.maxHp = l1.hero.hp = 40
    Z.enterMap(Z.WORLD, l1, 'supplyroom', 'in', [])
    step(l1)
    P.settle(l1)
    Object.assign(l1.hero, { x: 2.5, y: 3.5 })
    P.useB(l1, 'lamp', 'right', 20)
    assert.ok(l1.lamp, 'the lamp stands')
    let ask = null
    let beam = 0
    let most = 0
    for (let k = 0; k < 60 * 30; k++) {
      const m = boss(l1)
      tick(l1)
      if (m.ai.mode === 'ask' && !ask) ask = m.hp
      if (m.ai.mode !== 'ask' && ask !== null) { most = Math.max(most, ask - m.hp); beam += ask - m.hp; ask = null }
      assert.ok(l1.mode === 'play' || l1.mode === 'dialog', 'the hero stands')
    }
    if (process.env.BALANCE_LOG) console.log(`lamp beam: ${beam} in 30 s, ${most} at most an opening, hp ${boss(l1).hp}, hero ${l1.hero.hp}`)
    assert.ok(beam > 0 && most <= 1 && boss(l1).ai.part === 1, `the beam took ${beam} in all, ${most} at most an opening, part ${boss(l1).ai.part}`)

    // A station is drawn lit only when it will fire: after an opening left uncut, the hero still on it, it is dim.
    const t1 = hero()
    t1.hero.maxHp = t1.hero.hp = 40
    for (const f of third) t1.flags[f] = true
    Z.enterMap(Z.WORLD, t1, 'supplyroom', 'in', [])
    step(t1)
    let sawLit = false
    let lit = null
    for (let k = 0; k < 60 * 40 && lit === null; k++) {
      const m = boss(t1)
      const st = Z.stationOf(m)?.live
      if (st?.lit) { sawLit = true; Object.assign(t1.hero, { x: st.x, y: st.y }) }
      if (m.ai.mode === 'trick' || m.ai.mode === 'open') Object.assign(t1.hero, { x: Z.STATIONS[0].x, y: Z.STATIONS[0].y })
      tick(t1)
      if (m.ai.mode === 'blow' && m.ai.armed === false) lit = Z.stationOf(m).live.lit
    }
    assert.ok(sawLit && lit === false, `lit before it fired: ${sawLit}; lit after an uncut opening: ${lit}`)
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

    // A save from after the second ending: the hall holds no machine, its gate stays open, and its line is said once.
    for (const f of ['maximizer', 'ending2', 'maximizer.card']) s.flags[f] = true
    const after = reload(s)
    Z.enterMap(Z.WORLD, after, 'supplyroom', 'in', [])
    run(after, 0.2)
    assert.deepEqual([after.dialog?.lines, boss(after)?.dead ?? true], [['(THE HALL IS QUIET. ONE CLIP LIES ON THE FLOOR.)'], true])
    P.settle(after)
    run(after, 3)
    assert.deepEqual([after.mode, tile(after, 7, 10), Z.has(after, 'ending2'), Z.has(after, 'won')], ['play', '.', true, true])
    Z.enterMap(Z.WORLD, after, 'supplyroom', 'in', [])
    run(after, 0.2)
    assert.equal(after.mode, 'play')
    // The ending's flag opens no way a hero without the prism has not got: the lid is the prism's.
    const none = hero([])
    delete none.flags['item:prism']
    none.inv.prism = false
    none.flags.ending2 = true
    Z.enterMap(Z.WORLD, none, 'shrine', 'start', [])
    assert.equal(tile(none, 25, 9), '.')
  })
})
