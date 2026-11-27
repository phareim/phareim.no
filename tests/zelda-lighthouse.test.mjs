// Neon Shrine, THE LIGHTHOUSE (docs/games/neon-shrine-lighthouse.md): Yule Fjord's tower and the storm lamp. Three of
// the file's four tests are here: the map and its keys (and the door in the land), the lamp never saved, and the walk
// from the door in Yule Fjord to the Lamp Room's inside, played by a scripted hero with the blade and the lamp: every
// room, both small keys, the Big Key, the lamp in all four puzzle rooms, ORCA and the dark hound fought (the lamp's
// beam stunning each, then the blade), and a save made halfway and loaded as a reloaded tab would be. Part three puts
// the Black Box into this same walk.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

let Z
let P
before(async () => { Z = await load(); P = walker(Z) })

const FPS = 60
const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, rollPress: false, cycle: false, autoFace: false, ...o })
const V = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
const unit = (x, y, k = 1) => { const d = Math.hypot(x, y) || 1; return { x: (x / d) * k, y: (y / d) * k } }
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/** A fresh game standing at an entry of a map, with the blade and ten hearts, in play. */
function at(map, entry, { seed = 7, inv = {}, flags = [] } = {}) {
  const s = Z.createGame(Z.WORLD, { seed, at: { map, entry } })
  Object.assign(s.inv, { sword: true }, inv)
  for (const f of flags) s.flags[f] = true
  s.mode = 'play'
  s.dialog = null
  s.hero.auto = null
  s.hero.maxHp = s.hero.hp = 20
  return s
}

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
  })

  // ---- (1), the first half: from the door to the Lamp Room -------------------------------------------------------
  it('goes from the door in Yule Fjord to the Lamp Room, with the blade and the lamp: both keys, the Big Key, ORCA and the dark hound, a reload on the way', () => {
    const tile = (s, x, y) => s.map.tiles[y * s.map.w + x]
    const step = (s, i = inp()) => Z.stepGame(Z.WORLD, s, 1 / FPS, i)
    const run = (s, n, i = inp()) => { for (let k = 0; k < n; k++) { s.hero.invuln = Math.max(s.hero.invuln, 0.2); step(s, i) } }
    /** Hold the stick until the hero stops moving (a slide over ice ends), or `max` frames. */
    const hold = (s, dir, max = 600) => {
      let still = 0
      for (let k = 0; k < max; k++) {
        s.hero.invuln = 1
        const x0 = s.hero.x
        const y0 = s.hero.y
        step(s, inp({ move: V[dir] }))
        if (Math.hypot(s.hero.x - x0, s.hero.y - y0) < 0.002) { if (++still > 30) break } else still = 0
      }
    }
    const press = (s, dir, frames) => { for (let k = 0; k < frames; k++) { s.hero.invuln = 1; step(s, inp({ move: V[dir] })) } }
    /** B with the lamp, facing `dir`; the lamp's room plays on for a moment. */
    const lamp = (s, dir, wait = 20) => {
      s.inv.selected = 'lamp'
      s.hero.dir = dir
      const ev = step(s, inp({ bPress: true }))
      run(s, wait)
      return ev
    }
    /** Stand at (x, y), face `dir` and press A: a chest, a lock, a mirror. */
    const open = (s, x, y, dir) => { P.walkTo(s, x, y); s.hero.dir = dir; P.pressA(s) }
    /** Through a doorway or onto stairs: walk on until the map or the room is what it should be. */
    const through = (s, pred, dir) => { P.until(s, () => pred() && s.mode === 'play', inp({ move: V[dir] }), 900); P.settle(s) }
    const wait = (s, secs) => run(s, Math.round(secs * FPS))

    let s = at('yulefjord', 'lighthouse', { seed: 11 })

    // The door in the land, and the Foot: nothing in it but a cat, a sign and the way on.
    P.walkTo(s, 4, 32)
    through(s, () => s.map.id === 'lighthouse1', 'up')
    assert.equal(s.zoneIndex, 0)
    assert.equal(s.map.enemies.length === 0 || s.map.enemies.every(e => e.cell !== 0), true, 'no foe in the Foot')

    // The Parlour: the lamp, taught in the light. A beam along the one open row lights the receiver, and the key shows.
    P.walkTo(s, 15, 5)
    through(s, () => s.zoneIndex === 1, 'right')
    P.walkTo(s, 17, 5)
    s.hero.dir = 'up'
    P.walkTo(s, 23, 3)
    s.hero.dir = 'up'
    P.pressA(s)
    assert.equal(s.inv.lamp, true)
    assert.equal(s.inv.selected, 'lamp')
    P.walkTo(s, 23, 5)
    let ev = lamp(s, 'right', 5)
    assert.ok(ev.some(e => e.type === 'error') && !s.lamp, 'the lamp is refused on a pillar of the wall, and stays in the hand')
    P.walkTo(s, 17, 5)
    lamp(s, 'right', 40)
    assert.ok(s.lamp && !s.flags['lighthouse.parlour'], 'row 5 ends at a pillar of the wall: the receiver stays dark')
    step(s, inp({ bPress: true }))
    assert.equal(s.lamp, null)
    P.walkTo(s, 17, 6)
    lamp(s, 'right', 40)
    assert.deepEqual(s.lamp && [s.lamp.idx % s.map.w, Math.floor(s.lamp.idx / s.map.w), s.lamp.dir], [18, 6, 'right'])
    assert.equal(tile(s, 18, 6), 'Φ')
    assert.ok(s.flags['lighthouse.parlour'], 'the beam through the gap lights the receiver')
    wait(s, 1)
    assert.equal(tile(s, 30, 6), '$', 'the key shows behind it')
    // B again within 1.6 tiles takes it up; the tile gets its floor back.
    step(s, inp({ bPress: true }))
    assert.equal(s.lamp, null)
    assert.equal(tile(s, 18, 6), '.')
    open(s, 30, 5, 'down')
    assert.equal(s.inv.keyrings.lighthouse, 1, 'small key A')

    // The way down: the Ice Store. The lamp, tested on salt ice, two mirrors, six things done.
    P.walkTo(s, 2, 5)
    through(s, () => s.map.id === 'lighthouse0', 'left')
    P.settle(s)
    assert.equal(s.zoneIndex, 0)
    assert.equal(tile(s, 14, 5), 'ω', 'the sluice holds the water back')
    P.walkTo(s, 2, 8)
    hold(s, 'right')
    P.walkTo(s, 2, 9)
    hold(s, 'right')
    hold(s, 'up')
    assert.equal(tile(s, 13, 3), 'ν', 'the first mirror rests at the top of column 13')
    s.hero.dir = 'up'
    P.swing(s, 'up')
    assert.equal(tile(s, 13, 3), 'μ')
    hold(s, 'down')
    hold(s, 'left')
    P.walkTo(s, 2, 6)
    hold(s, 'right')
    assert.equal(tile(s, 13, 6), 'ν', 'the second mirror rests in row 6, short of the water')
    s.hero.dir = 'right'
    P.swing(s, 'right')
    assert.equal(tile(s, 13, 6), 'μ')
    hold(s, 'left')
    P.walkTo(s, 2, 6)
    lamp(s, 'right', 40)
    assert.ok(s.flags['lighthouse.drained'], 'the beam goes east, up and east again into the sluice\'s eye')
    wait(s, 0.5)
    assert.equal(tile(s, 14, 5), 'ψ', 'the doorway is drained floor now')
    // The lamp does not slide, and does not hold a plate: it is simply taken up.
    P.walkTo(s, 3, 7)
    s.hero.dir = 'up'
    P.step(s, inp({ bPress: true }))
    assert.equal(s.lamp, null, 'B beside the lamp takes it up')

    // The Flooded Cellar: ORCA. Its card is read, the gate shuts behind the hero; the lamp across its drag stops it in
    // the light, and the blade does the rest while its oar is planted.
    P.walkTo(s, 3, 5)
    press(s, 'right', 100)
    through(s, () => s.zoneIndex === 1, 'right')
    wait(s, 0.1)
    assert.ok(s.flags['lighthouse.orca.met'] && s.mode === 'dialog', 'its card on the way in')
    P.settle(s)
    P.walkTo(s, 18, 5)
    wait(s, 0.3)
    assert.equal(tile(s, 16, 5), 'X', 'shut in')
    const orca = s.map.enemies.find(e => e.kind === 'orca' && e.cell === 1)
    assert.ok(orca && orca.once === 'lighthouse.orca')
    const lit = duel(s, orca, 60, { lamp: true, until: () => orca.stun > 0 })
    assert.ok(orca.stun > 0 && Z.bossOpen(orca) && orca.hp < 10, `the beam across the lane stops the drag and opens it (${lit.seconds.toFixed(1)} s)`)
    assert.equal(Z.stencilsOf(orca).length, 0, 'and its strike is off the floor')
    const fought = duel(s, orca, 60)
    assert.ok(orca.dead, `ORCA: ${orca.hp} left after ${fought.seconds.toFixed(1)} s, ${fought.hurts} blows taken`)
    assert.ok(s.flags['lighthouse.orca'])
    wait(s, 0.2)
    P.settle(s)
    assert.ok(s.flags['lighthouse.orca.fell'], 'the line as it falls')
    wait(s, 0.5)
    assert.equal(tile(s, 29, 9), '$', 'the chest of key B shows')
    open(s, 29, 8, 'down')
    assert.equal(s.inv.keyrings.lighthouse, 2, 'small key B')

    // Back up the stair, across the ice by row 5.
    P.walkTo(s, 17, 5)
    P.walkTo(s, 15, 5)
    hold(s, 'left')
    P.walkTo(s, 1, 10)
    through(s, () => s.map.id === 'lighthouse1', 'down')
    assert.equal(s.zoneIndex, 0)

    // The Foot's north alcove: the lock takes a key and the whole run opens.
    open(s, 7, 3, 'up')
    assert.equal(s.inv.keyrings.lighthouse, 1)
    assert.equal(tile(s, 7, 2), '.')
    assert.equal(tile(s, 8, 2), '.')
    P.walkTo(s, 7, 2)
    through(s, () => s.map.id === 'lighthouse2', 'up')

    // A reload here: the tab continues at the stair it came up, with the doors as opened, and the lamp in the hand.
    {
      const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
      assert.equal(save.map, 'lighthouse2')
      assert.equal(save.entry, 'arrive')
      assert.ok(!save.flags.some(f => f.startsWith('seen:lighthouse')), 'no seen: flag for the tower')
      const spot = Z.loadSpot(Z.WORLD, save, { map: 'overworld', entry: 'start' }, true)
      assert.equal(spot, null, 'a tab that was in the tower continues where it saved')
      s = Z.createGame(Z.WORLD, { save, at: spot })
      s.mode = 'play'
      s.dialog = null
      s.hero.auto = null
      s.hero.maxHp = s.hero.hp = 20
      assert.equal(s.map.id, 'lighthouse2')
      assert.equal(s.lamp, null)
      assert.equal(s.inv.lamp, true)
      assert.equal(s.inv.selected, 'lamp')
      assert.equal(s.inv.keyrings.lighthouse, 1)
      assert.ok(Z.has(s, 'lighthouse.drained') && Z.has(s, 'lighthouse.orca') && Z.has(s, 'lighthouse.parlour'))
    }

    // The Quarters: dark, three bats. The receiver across the boards lights the room for good.
    P.settle(s)
    assert.equal(s.zoneIndex, 0)
    const info = Z.mapInfo(Z.WORLD, 'lighthouse2')
    assert.equal(Z.cellIsDark(s, info, 0), true)
    assert.equal(s.map.enemies.filter(e => e.cell === 0 && e.kind === 'bat').length, 3)
    P.killCell(s)
    P.walkTo(s, 9, 3)
    lamp(s, 'left', 40)
    assert.ok(s.lamp && s.flags['lighthouse.quarters'], 'the beam crosses the boards')
    assert.equal(Z.cellIsDark(s, info, 0), false, 'the room is lit for good')
    step(s, inp({ bPress: true }))
    assert.equal(s.lamp, null)
    assert.equal(Z.cellIsDark(s, info, 0), false)
    // The heart: the mirror pushed into the nook, turned, and the lamp set on its row.
    P.walkTo(s, 11, 8)
    press(s, 'right', 50)
    assert.equal(tile(s, 13, 8), 'μ')
    s.hero.dir = 'right'
    P.swing(s, 'right')
    assert.equal(tile(s, 13, 8), 'ν')
    press(s, 'right', 50)
    assert.equal(tile(s, 14, 8), 'ν', 'the mirror stands in the nook')
    P.walkTo(s, 12, 8)
    lamp(s, 'right', 60)
    assert.ok(s.flags['lighthouse.heart'], 'the beam goes down over the board to the corner')
    wait(s, 1)
    assert.equal(tile(s, 14, 2), '.', 'the heart\'s gate is open')
    open(s, 14, 2, 'up')
    assert.equal(s.inv.pieces, 1)
    step(s, inp({ bPress: true }))
    P.walkTo(s, 14, 5)
    s.hero.dir = 'right'
    press(s, 'right', 30)
    assert.equal(s.inv.keyrings.lighthouse, 0, 'the Quarters\' lock takes the second key')
    assert.equal(tile(s, 15, 5), '.')

    // The Oil Store: the dark hound, two eyes until the beam finds it. The gate shuts behind the hero.
    P.walkTo(s, 17, 6)
    through(s, () => s.zoneIndex === 1, 'right')
    wait(s, 0.1)
    assert.ok(s.flags['lighthouse.hound.met'], 'the room\'s line, read on the way in')
    P.walkTo(s, 17, 6)
    const hound = s.map.enemies.find(e => e.kind === 'hound' && e.cell === 1)
    assert.ok(hound && hound.tough && hound.dark && hound.once === 'lighthouse.hound')
    wait(s, 0.2)
    assert.equal(tile(s, 16, 5), 'X', 'shut in')
    const dark = Z.mapInfo(Z.WORLD, 'lighthouse2')
    assert.ok(Z.unseen(s, dark, hound), 'in the dark there is nothing of it but its eyes')
    const found = duel(s, hound, 60, { lamp: true, until: () => hound.stun > 0 })
    assert.ok(Z.toughOpen(hound) && hound.hp < 10 && !Z.unseen(s, dark, hound), `the beam shows it, stuns it and burns it (${found.seconds.toFixed(1)} s)`)
    const fought2 = duel(s, hound, 60)
    assert.ok(hound.dead, `the dark hound: ${hound.hp} left after ${fought2.seconds.toFixed(1)} s, ${fought2.hurts} blows taken`)
    wait(s, 0.5)
    assert.equal(tile(s, 26, 9), '$', 'the Big Key shows')
    assert.equal(tile(s, 23, 2), '.', 'the gate over the stair is open')
    open(s, 26, 8, 'down')
    assert.ok(s.flags['bigkey:lighthouse'])
    P.walkTo(s, 23, 3)
    through(s, () => s.map.id === 'lighthouse3', 'up')

    // The Gallery: dark, two draugs on the ring. Three mirrors turned, the lamp up the east side, the beam goes round the
    // tower into the receiver in the west wall.
    assert.equal(s.zoneIndex, 0)
    assert.equal(s.map.enemies.filter(e => e.cell === 0 && e.kind === 'skull').length, 2)
    P.killCell(s)
    P.walkTo(s, 1, 6)
    lamp(s, 'down', 40)
    assert.ok(s.lamp && !s.flags['lighthouse.gallery'], 'the lamp near the receiver is not enough by itself')
    step(s, inp({ bPress: true }))
    open(s, 1, 3, 'up')
    assert.equal(tile(s, 1, 2), 'μ')
    open(s, 13, 3, 'up')
    assert.equal(tile(s, 13, 2), 'ν')
    open(s, 1, 8, 'down')
    assert.equal(tile(s, 1, 9), 'μ')
    P.walkTo(s, 13, 10)
    lamp(s, 'up', 80)
    assert.ok(s.flags['lighthouse.gallery'], 'the beam goes up, west, down and west to the receiver')
    wait(s, 1)
    assert.equal(tile(s, 14, 5), '.', 'the gate before the Big-Key door is open')
    P.walkTo(s, 14, 5)
    s.hero.dir = 'right'
    press(s, 'right', 30)
    assert.equal(tile(s, 15, 5), '.', 'the Big Key opens the great door')

    // The Lamp Room, with no Box in it yet.
    through(s, () => s.zoneIndex === 1, 'right')
    assert.equal(s.zone.x, 16)
    assert.equal(s.map.enemies.filter(e => e.cell === 1).length, 0)
    assert.equal(tile(s, 24, 6), 'Ξ')
    assert.equal(tile(s, 24, 2), 'ρ')
    assert.ok(s.hero.hp > 0)
  })
})

// ---- the scripted hero -----------------------------------------------------------------------------------------

/**
 * Plays ORCA's fight or the dark hound's on what a player can see: the strips on the floor, the gold bar and where the
 * foe (or its eyes) is. A strip with him in it, he steps out of it sideways after a quarter of a second; open, he runs
 * in and cuts; else he keeps three to four tiles off. With `lamp`, he also sets it: ORCA's as it announces a drag, to
 * shine across the lane; the hound's, in line with it, to shine at it. Every blow taken is counted.
 */
function duel(s, e, seconds, { lamp = false, until = () => false } = {}) {
  const mem = { seen: 0, laid: -999 }
  const policy = f => {
    const h = s.hero
    const d = gap(h, e)
    const toward = (k = 1) => unit(e.x - h.x, e.y - h.y, k)
    const away = (k = 1) => unit(h.x - e.x, h.y - e.y, k)
    const open = e.kind === 'orca' ? Z.bossOpen(e) : Z.toughOpen(e)
    const strip = Z.stencilsOf(e)[0]
    mem.seen = strip ? mem.seen + 1 : 0
    const out = mem.seen > 12 ? outOf(s, strip) : null
    if (out) return inp({ move: out, rollPress: !h.roll && mem.seen > 26 })
    if (lamp && e.kind === 'orca' && !s.lamp && strip && e.ai.mode === 'dragTell' && mem.seen > 12) {
      const along = (h.x - strip.x0) * strip.ux + (h.y - strip.y0) * strip.uy
      const across = (h.y - strip.y0) * strip.ux - (h.x - strip.x0) * strip.uy
      if (along > 1.2 && along < strip.len + 0.5 && Math.abs(across) < 3.5) {
        const x = strip.uy * Math.sign(across)
        const y = -strip.ux * Math.sign(across)
        h.dir = Math.abs(x) > 0.5 ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up'
        return inp({ bPress: true })
      }
    }
    if (strip) return inp()
    if (open) return d < Z.SWORD_REACH + e.r - 0.15 ? inp({ move: toward(0.05), aPress: f % 4 === 0, a: true }) : inp({ move: toward() })
    // (The lamp left out a while and of no use now: back to it, and take it up.)
    if (s.lamp && f - mem.laid > 1.5 * FPS) {
      const l = { x: (s.lamp.idx % s.map.w) + 0.5, y: Math.floor(s.lamp.idx / s.map.w) + 0.5 }
      if (gap(h, l) > 1.5) return inp({ move: unit(l.x - h.x, l.y - h.y) })
      mem.laid = f
      return inp({ bPress: true })
    }
    if (lamp && e.kind === 'hound' && !s.lamp && d > 1.6 && d < 7) {
      const flat = Math.abs(e.x - h.x) > Math.abs(e.y - h.y)
      if (Math.abs(flat ? e.y - h.y : e.x - h.x) >= e.r - 0.15) return inp({ move: flat ? unit(0, e.y - h.y) : unit(e.x - h.x, 0) })
      h.dir = flat ? (e.x < h.x ? 'left' : 'right') : e.y < h.y ? 'up' : 'down'
      mem.laid = f
      return inp({ bPress: true })
    }
    if (d < 3.1) return inp({ move: away() })
    if (d > 4.2) return inp({ move: toward() })
    return inp({ move: toward(0.05) })
  }
  let hurts = 0
  let hp = s.hero.hp
  let f = 0
  s.inv.selected = 'lamp'
  for (; f < seconds * FPS && !e.dead && !until() && s.mode === 'play'; f++) {
    const standing = !!s.lamp
    Z.stepGame(Z.WORLD, s, 1 / FPS, policy(f))
    if (s.lamp && !standing) mem.laid = f
    if (s.hero.hp < hp) hurts++
    hp = s.hero.hp
  }
  return { seconds: f / FPS, hurts }
}

/** The way out of a strip: sideways from its middle line to whichever side has floor, else along it. Null when clear. */
function outOf(s, st) {
  const h = s.hero
  const along = (h.x - st.x0) * st.ux + (h.y - st.y0) * st.uy
  const across = (h.y - st.y0) * st.ux - (h.x - st.x0) * st.uy
  if (along < -0.35 || along > st.len + 0.35 || Math.abs(across) > st.w / 2 + 0.35) return null
  const side = across >= 0 ? 1 : -1
  for (const k of [side, -side]) {
    const way = { x: -st.uy * k, y: st.ux * k }
    const need = st.w / 2 + 0.35 - across * k
    if (!Z.circleBlocked(Z.WORLD, s.map, h.x + way.x * need, h.y + way.y * need, 0.34)) return way
  }
  return along > st.len / 2 ? { x: st.ux, y: st.uy } : { x: -st.ux, y: -st.uy }
}
