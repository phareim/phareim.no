// Neon Shrine, THE LIGHTHOUSE (docs/games/neon-shrine-lighthouse.md): Yule Fjord's tower and the storm lamp. Four
// tests, all scripted players: the map and its keys (and the door in the land); the lamp never saved; the walk from the
// door in Yule Fjord to the Weight in hand, with the blade and the lamp (every room, both small keys, the Big Key, the
// lamp in all four puzzle rooms, ORCA, the dark hound and the Black Box through its three rounds, and a save made
// halfway and loaded as a reloaded tab would be; no pushed mirror coming to rest on an arrival tile, and coming home; the
// lamp heard again when set down afresh, refused by the receivers of a map not marked for it, taken home by the water; a
// wounded Box back at its round); and a hero who stands still before the Black Box, who loses.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'
import { FPS, inp, at, play, use } from './zelda-plays/lighthouse.mjs'

let Z
let P
before(async () => {
  Z = await load()
  P = walker(Z)
  use(Z)
})

describe('the Lighthouse', () => {
  // ---- (4) the map and the key rule, the door, the land's size ----------------------------------------------------
  it('is four floors of two rooms on one keyring, the world still valid, with the door in Yule Fjord reachable and the land its size', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD), [])
    const rooms = { lighthouse0: ['THE ICE STORE', 'THE FLOODED CELLAR'], lighthouse1: ['THE FOOT', 'THE PARLOUR'], lighthouse2: ['THE QUARTERS', 'THE OIL STORE'], lighthouse3: ['THE GALLERY', 'THE LAMP ROOM'] }
    for (const [id, names] of Object.entries(rooms)) {
      const def = Z.WORLD.maps[id]
      assert.equal(def.kind, 'dungeon')
      assert.equal(def.keyring, 'lighthouse')
      assert.equal(def.realm, 'yulefjord')
      assert.deepEqual(def.views, ['iso'])
      // A reload continues in the tower, but the tower is not a land out past the coast: no seen: flag, no area words.
      assert.equal(def.resume, true)
      assert.ok(!def.away)
      assert.ok(Z.awayMap(Z.WORLD, id, 'door') || Z.awayMap(Z.WORLD, id, 'stair') || Z.awayMap(Z.WORLD, id, 'arrive') || Z.awayMap(Z.WORLD, id, 'up'))
      assert.deepEqual([def.cells['0,0'].name, def.cells['1,0'].name], names)
      assert.equal(def.rows.length, 12)
      assert.equal(def.rows[0].length, 32)
    }
    assert.equal(Z.WORLD.maps.lighthouse2.below, 'lighthouse1')
    // Per ring: small-key chests and carriers equal the locked doors (runs of L), and one big key for the K run.
    const ring = Object.values(Z.WORLD.maps).filter(m => m.keyring === 'lighthouse')
    let smallKeys = 0
    let bigKeys = 0
    let lRuns = 0
    let kRuns = 0
    for (const def of ring) {
      for (const m of Object.values(def.marks)) {
        if (m.ent.t === 'chest' && m.ent.item === 'smallKey') smallKeys++
        if (m.ent.t === 'chest' && m.ent.item === 'bigKey') bigKeys++
        if (m.ent.t === 'enemy' && m.ent.carries === 'smallKey') smallKeys++
      }
      const grid = def.rows.map(r => [...r])
      const seen = new Set()
      for (const [ch, tag] of [['L', 'l'], ['K', 'k']]) {
        grid.forEach((row, y) => row.forEach((c, x) => {
          if (c !== ch || seen.has(`${x},${y}`)) return
          const stack = [[x, y]]
          seen.add(`${x},${y}`)
          while (stack.length) {
            const [cx, cy] = stack.pop()
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const key = `${cx + dx},${cy + dy}`
              if (grid[cy + dy]?.[cx + dx] === ch && !seen.has(key)) { seen.add(key); stack.push([cx + dx, cy + dy]) }
            }
          }
          if (tag === 'l') lRuns++
          else kRuns++
        }))
      }
    }
    assert.deepEqual({ smallKeys, lRuns, bigKeys, kRuns }, { smallKeys: 2, lRuns: 2, bigKeys: 1, kRuns: 1 })
    // The door: one tile of the lighthouse's foot, a way in from the path before it, and the land its size.
    const land = Z.WORLD.maps.yulefjord
    assert.equal(land.rows.length, 52)
    assert.equal(land.rows[0].length, 88)
    assert.equal(land.rows[31][4], 'Q')
    assert.deepEqual(land.marks.Q.ent, { t: 'warp', to: 'lighthouse1', entry: 'door' })
    assert.deepEqual(land.entries.lighthousedoor, { x: 4.5, y: 32.5, dir: 'down' })
    const s = at('yulefjord', 'lighthouse')
    assert.ok(P.path(s, 4, 32), 'the path before the door is reached from the land')
    // And the door in the Foot leads back out in front of it.
    assert.deepEqual(Z.WORLD.maps.lighthouse1.marks.D.ent, { t: 'warp', to: 'yulefjord', entry: 'lighthousedoor' })
  })

  // ---- (3) the lamp is never saved --------------------------------------------------------------------------------
  it('is never in a save: the lamp set down is back in the hand, and a save with it on B loads', () => {
    const s = at('lighthouse1', 'door', { inv: { lamp: true, selected: 'lamp' } })
    P.walkTo(s, 7, 8)
    s.hero.dir = 'up'
    P.step(s, inp({ bPress: true }))
    assert.ok(s.lamp, 'the lamp is down')
    assert.equal(s.map.tiles[7 * s.map.w + 7], 'Φ')
    const save = Z.toSave(s)
    assert.equal(save.inv.lamp, true)
    assert.equal(save.inv.selected, 'lamp')
    assert.ok(!('lamp' in save) && !JSON.stringify(save).includes('Φ'), 'where the lamp stands is not in the save')
    const again = Z.createGame(Z.WORLD, { save: Z.parseSave(JSON.parse(JSON.stringify(save))) })
    assert.equal(again.lamp, null)
    assert.equal(again.inv.lamp, true)
    assert.equal(again.inv.selected, 'lamp')
    assert.ok(!again.map.tiles.includes('Φ'))
    // One from the lab with the lamp on B and nothing else it knows of: loads, with nothing in hand (the lamp is not in the bag).
    const bare = Z.parseSave({ ...JSON.parse(JSON.stringify(save)), inv: { ...save.inv, lamp: undefined, selected: 'lamp' } })
    assert.ok(bare, 'a save from before the lamp, with it on B, loads')
    assert.equal(bare.inv.selected, null)
    // Leaving the room, falling, dying or warping puts it back in the hand.
    P.step(s, inp())
    Z.enterMap(Z.WORLD, s, 'lighthouse2', 'arrive', [])
    assert.equal(s.lamp, null)

    // The lamp lights receivers where the map says so (the tower, below) and nowhere else: in the Puzzle Lab's last room
    // its beam ends in the receiver with a buzz, and the room stays unsolved.
    const lab = at('puzzlelab', 'start', { inv: { lamp: true, selected: 'lamp' } })
    Object.assign(lab.hero, { x: 4.5, y: 8.5, dir: 'right' })
    for (let k = 0; k < 150; k++) P.step(lab, inp())
    lab.dialog = null
    lab.mode = 'play'
    Object.assign(lab.hero, { x: 4.5, y: 8.5, dir: 'right' })
    P.step(lab, inp({ bPress: true }))
    for (let k = 0; k < 40; k++) P.step(lab, inp())
    assert.ok(lab.lamp && lab.map.phys.beams.some(b => b.src === 'lamp'), 'the lamp shines along row 8 of the last room')
    assert.ok(!lab.flags['lab.f.lit'], 'and lights nothing there')
    assert.ok(lab.lamp.buzzed, 'its beam met a receiver it may not light')
    // The water takes a lamp home: set on the drained floor of the Sluice Hall, it is in the hand when the basin floods.
    const hall = at('puzzlelab', 'start', { inv: { lamp: true, selected: 'lamp' } })
    Object.assign(hall.hero, { x: 17.5, y: 5.5, dir: 'right' })
    for (let k = 0; k < 120; k++) P.step(hall, inp())
    hall.dialog = null
    hall.mode = 'play'
    Object.assign(hall.hero, { x: 18.5, y: 5.5, dir: 'right' })
    P.step(hall, inp({ bPress: true }))
    assert.equal(hall.map.tiles[5 * hall.map.w + 19], 'Φ', 'a lamp on the drained floor')
    hall.flags['lab.e.tide'] = true
    for (let k = 0; k < 30; k++) P.step(hall, inp())
    assert.equal(hall.lamp, null, 'the water comes and the lamp is back in the hand')
    assert.equal(hall.map.tiles[5 * hall.map.w + 19], 'ω', 'with no dry tile left in the basin')
  })

  // ---- (1) from the door to the Weight ---------------------------------------------------------------------------
  it('goes from the door in Yule Fjord to the Weight in hand, with the blade and the lamp: both keys, the Big Key, ORCA, the dark hound and the Black Box, a reload on the way', () => {
    play(Z, at('yulefjord', 'lighthouse', { seed: 11 }))
  })

  // ---- (2) standing still loses ------------------------------------------------------------------------------------
  it('beats a hero who stands still in the west lane: the Black Box blurts at the lane he is in', () => {
    const s = at('lighthouse3', 'up', { inv: { lamp: true } })
    Z.enterMap(Z.WORLD, s, 'lighthouse3', 'up', [], { x: 20.5, y: 6.5 })
    s.mode = 'play'
    s.hero.auto = null
    s.hero.hp = s.hero.maxHp = 6
    // (A receiver left lit by an earlier visit goes dark.)
    s.flags['lighthouse.box.n'] = true
    const box = s.map.enemies.find(e => e.kind === 'blackbox')
    P.step(s, inp())
    P.settle(s)
    const blurts = []
    let was = 'idle'
    for (let f = 0; f < 40 * FPS && s.mode !== 'dying'; f++) {
      Z.stepGame(Z.WORLD, s, 1 / FPS, inp())
      if (box.ai.mode === 'blurt' && was !== 'blurt') blurts.push(f / FPS)
      was = box.ai.mode
    }
    assert.equal(s.mode, 'dying', `${s.hero.hp} half hearts left after ${blurts.length} blurts`)
    assert.equal(blurts.length, 3)
    assert.ok(blurts[0] > 7.5 && blurts[0] < 8.5, `the first after eight quiet seconds (${blurts[0]})`)
    assert.ok(blurts.slice(1).every((t, i) => Math.abs(t - blurts[i] - 5.5) < 0.2), `then every 5.5 s (${blurts})`)
    assert.equal(box.hp, 14)
    assert.ok(!s.flags['lighthouse.box.n'] && !s.flags['lighthouse.box'])
  })
})

