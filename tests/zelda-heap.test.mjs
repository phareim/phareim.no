// Neon Shrine, THE HEAP (docs/games/neon-shrine-heap.md), under the Underglow's rails: the whole way through it by one
// scripted player, from the hollow wall to the Weight; that the Scrape Golem punishes standing still and gives way to
// nothing but a cart; what the Magnet leaves in a save; and the two maps' own bargain with the world. Nobody plays it
// by hand before it ships, so the play-through is the proof that every room can be left the way it says.
//
// `HEAP_LOG=1` prints the play-through's checkpoints.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'
import { tileAt, play, use } from './zelda-plays/heap.mjs'

let Z
let P
before(async () => { Z = await load(); P = walker(Z); use(Z) })

describe('the Heap', () => {
  it('is played from the hollow wall to the Weight, with the blade and what the Heap gives', () => {
    const s = Z.createGame(Z.WORLD, { seed: 5, at: { map: 'underglow1', entry: 'up' } })
    Object.assign(s.inv, { sword: true, bombBag: true, bombs: 8, selected: 'bombs' })
    play(Z, s)
  })

  it('beats a hero who stands still before the Golem, gives no way past it without a cart, and holds the review\'s rules: a tap passes a crate that cannot fly, a wounded Golem comes back grown, gold means open, no lee is safe, a tell hurts what is painted', () => {
    /** The Heap's room as a hero comes into it, the card read. */
    const arrive = () => {
      const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'heap2', entry: 'down' } })
      Object.assign(s.inv, { sword: true, magnet: true, selected: 'magnet' })
      Z.enterMap(Z.WORLD, s, 'heap2', 'down', [], { x: 17.5, y: 5.5 })
      s.mode = 'play'
      P.frames(s, 5)
      P.settle(s)
      return s
    }
    // Just inside the door, outside both rings: what it spits still finds them.
    const still = arrive()
    for (let k = 0; k < 60 * 60 && still.mode === 'play'; k++) P.step(still)
    assert.equal(still.mode, 'dying', `still standing with ${still.hero.hp}`)

    // The blade alone, for two minutes, by a hero nothing can hurt.
    const s = arrive()
    const g = s.map.enemies.find(e => e.kind === 'golem')
    let clanks = 0
    for (let k = 0; k < 60 * 120; k++) {
      s.hero.invuln = 1
      const dx = g.x - s.hero.x
      const dy = g.y - s.hero.y
      const d = Math.hypot(dx, dy)
      const near = d <= g.r + 0.8
      const swing = near && !s.hero.swing && k % 20 === 0
      const ev = P.step(s, P.inp({ move: near ? { x: (dx / d) * 0.2, y: (dy / d) * 0.2 } : { x: dx / d, y: dy / d }, a: swing, aPress: swing }))
      clanks += ev.filter(e => e.type === 'clank').length
      if (s.mode !== 'play') P.settle(s)
    }
    assert.ok(clanks > 10, 'the blade reached it')
    assert.deepEqual([g.hp, g.dead, !!s.flags['heap.golem']], [18, false, false])

    // A crate before the Sorting Floor's rim bolt (2,2 -> 3,2 by a tap from the strip) hid the bolt from a hero
    // shut in the strip: the tap fizzled for ever. It passes to the nearest metal that can move.
    {
      const W = Z.WORLD
      const s = Z.createGame(W, { seed: 1, at: { map: 'heap1', entry: 'door' } })
      Object.assign(s.inv, { sword: true, magnet: true, selected: 'magnet' })
      Z.enterMap(W, s, 'heap1', 'door', [], { x: 17.5, y: 5.5 })
      s.mode = 'play'
      P.frames(s, 3)
      const ox = 16
      const tile = (x, y) => tileAt(s, ox + x, y)
      const tapAt = (hx, hy, a) => {
        s.hero.x = ox + hx
        s.hero.y = hy
        const move = { x: Math.cos(a) * 0.3, y: Math.sin(a) * 0.3 }
        s.hero.dir = Math.abs(move.x) > Math.abs(move.y) ? (move.x > 0 ? 'right' : 'left') : (move.y > 0 ? 'down' : 'up')
        P.frames(s, 30)
        const ev = P.step(s, P.inp({ bPress: true, move }))
        for (let k = 0; k < 240 && (s.hook || s.map.iron?.flights.length); k++) { s.hero.invuln = 1; P.step(s) }
        P.frames(s, 30)
        return ev.map(e => e.type)
      }
      assert.deepEqual(tapAt(3, 2, (68 * Math.PI) / 180), ['latch'])
      assert.equal(tile(3, 3), '▣')
      assert.deepEqual(tapAt(1.5, 1.5, 0), ['latch'])
      assert.equal(tile(2, 2), '▣')
      P.walkTo(s, ox + 3, 2)
      s.hero.dir = 'right'
      P.frames(s, 30)
      P.step(s, P.inp({ bPress: true }))
      P.frames(s, 90)
      assert.equal(tile(7, 5), 'X', 'the shutter is still shut: the crate is not on the plate')
      assert.ok(s.hero.x > ox + 6, 'in the strip')
      assert.deepEqual(tapAt(s.hero.x - ox, s.hero.y, Math.PI), ['latch'], 'the crate comes')
      assert.equal(tile(3, 2), '▣')
      // The crate on (3,2) cannot fly on (only pit lies between), so it no longer hides the bolt in the rim.
      P.walkTo(s, ox + 6, 4)
      P.frames(s, 30)
      assert.deepEqual(tapAt(s.hero.x - ox, s.hero.y, Math.PI), ['latch'])
      assert.ok(s.hero.x < ox + 2.5, `the hero is home on the west bank: ${s.hero.x - ox}`)
    }

    // The Golem, wounded to the half or less, left and met again: grown, as it was (not small with a fresh shake).
    {
      const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'heap2', entry: 'down' } })
      Object.assign(s.inv, { sword: true, magnet: true, selected: 'magnet' })
      Z.enterMap(Z.WORLD, s, 'heap2', 'down', [], { x: 17.5, y: 5.5 })
      s.mode = 'play'
      P.frames(s, 5)
      P.settle(s)
      const g = s.map.enemies.find(e => e.kind === 'golem')
      g.hp = 9
      // (The Big Key's door at the Foot stands open for this walk.)
      for (const y of [5, 6]) s.map.tiles[y * s.map.w + 15] = '.'
      P.walkTo(s, 13, 5)
      P.settle(s)
      P.walkTo(s, 18, 5)
      P.settle(s)
      assert.equal(s.zoneIndex, 1)
      for (let k = 0; k < 5; k++) { s.hero.invuln = 1; P.step(s) }
      assert.deepEqual([g.hp, g.ai.phase, g.r], [9, 2, Z.GOLEM.r[1]])
      let ring = 0
      for (let k = 0; k < 60 * 4 && !ring; k++) { s.hero.invuln = 1; P.step(s); ring = Z.stencilsOf(g).find(st => st.t === 'ring')?.r ?? 0 }
      assert.equal(ring, Z.GOLEM.ring[1], 'it pulls with the grown ring')
    }

    // Gold means open: the Storm Lamp's beam and a bomb do nothing to a PHI that is not open, and take one that is.
    {
      const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'heap1', entry: 'door' } })
      Object.assign(s.inv, { sword: true, magnet: true, lamp: true, bombBag: true, bombs: 4, selected: 'lamp' })
      s.flags['heap.grok'] = true
      Z.enterMap(Z.WORLD, s, 'heap1', 'door', [], { x: 49.5, y: 17.5 })
      s.mode = 'play'
      s.hero.maxHp = s.hero.hp = 60
      P.frames(s, 5)
      P.settle(s)
      const [a, b] = s.map.enemies.filter(e => e.kind === 'phi')
      s.hero.dir = 'right'
      P.step(s, P.inp({ bPress: true }))
      assert.ok(s.lamp, 'the lamp is down')
      const stand = (e, x, y) => { Object.assign(e, { x, y }); e.ai.mode = 'wander'; e.ai.cool = 5; e.stun = 0 }
      stand(a, s.hero.x + 2.5, s.hero.y)
      let rings = 0
      for (let k = 0; k < 90; k++) { s.hero.invuln = 1; stand(a, s.hero.x + 2.5, s.hero.y); rings += P.step(s).filter(v => v.type === 'clank' && Math.hypot(v.x - a.x, v.y - a.y) < 0.1).length }
      assert.deepEqual([a.hp, a.dead, a.stun > 0], [2, false, false], 'the beam does not burn a shut PHI')
      assert.equal(rings, 2, 'it rings on it, once as it touches and once a second after')
      stand(b, s.hero.x + 3, s.hero.y + 3)
      s.map.bombs.push({ id: 'b1', x: b.x, y: b.y, t: 1.69 })
      for (let k = 0; k < 20; k++) { s.hero.invuln = 1; P.step(s) }
      assert.deepEqual([b.hp, b.dead], [2, false], 'a bomb does not hurt a shut PHI')
      b.ai.mode = 'rest'
      b.ai.t = 1.4
      s.map.bombs.push({ id: 'b2', x: b.x, y: b.y, t: 1.69 })
      for (let k = 0; k < 20; k++) { s.hero.invuln = 1; P.step(s) }
      assert.ok(b.dead, 'an open one takes it')
    }

    // No safe lee: a hero standing still just west of a pillar was never darted (the PHI sat in their row).
    {
      const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'heap1', entry: 'door' } })
      Object.assign(s.inv, { sword: true })
      s.flags['heap.grok'] = true
      Z.enterMap(Z.WORLD, s, 'heap1', 'door', [], { x: 51.5, y: 20.5 })
      s.mode = 'play'
      s.hero.maxHp = s.hero.hp = 400
      P.frames(s, 3)
      P.settle(s)
      const phis = s.map.enemies.filter(e => e.kind === 'phi')
      const was = phis.map(() => '')
      let darts = 0
      for (let k = 0; k < 60 * 40; k++) {
        P.step(s)
        phis.forEach((e, i) => { if (e.ai.mode === 'dart' && was[i] !== 'dart') darts++; was[i] = e.ai.mode })
      }
      assert.ok(darts > 5, `darted ${darts} times`)
    }

    // GROK's tell hurts what is painted: beside its lane the hero is not hurt; in it, is.
    {
      const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'heap1', entry: 'door' } })
      Object.assign(s.inv, { sword: true })
      Z.enterMap(Z.WORLD, s, 'heap1', 'door', [], { x: 33.5, y: 17.5 })
      s.mode = 'play'
      s.hero.maxHp = s.hero.hp = 12
      P.frames(s, 3)
      P.settle(s)
      const g = s.map.enemies.find(e => e.kind === 'grok')
      const tell = (across) => {
        Object.assign(g, { dir: 'right', x: 40.5, y: 17.5 })
        g.ai.mode = 'tell'
        g.ai.t = g.ai.tell = 0.7
        s.hero.x = 40.5
        s.hero.y = 17.5 + across
        s.hero.hp = 12
        s.hero.invuln = 0
        for (let k = 0; k < 10; k++) { s.hero.x = 40.5; s.hero.y = 17.5 + across; P.step(s) }
        return s.hero.hp
      }
      assert.equal(tell(0.65), 12, 'beside the painted lane (0.5 either side): not hurt')
      assert.equal(tell(0.3), 10, 'in it: hurt')
    }
  })

  it('keeps the Magnet in a save as an item and a flag and nothing else', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'heap1', entry: 'door' } })
    s.inv.sword = true
    const before = Z.toSave(s)
    Z.grant(s, 'magnet')
    Z.enterMap(Z.WORLD, s, 'heap1', 'door', [], { x: 18.5, y: 8.5 })
    s.mode = 'play'
    s.hero.dir = 'right'
    P.step(s, P.inp({ bPress: true }))
    assert.equal(s.map.iron.flights.length, 1, 'iron is in the air')
    const flying = Z.toSave(s)
    assert.deepEqual(Object.keys(flying).sort(), Object.keys(before).sort())
    assert.deepEqual(flying.inv, { ...before.inv, magnet: true, selected: 'magnet' })
    assert.deepEqual(flying.flags.filter(f => !before.flags.includes(f)), ['item:magnet'])

    const loaded = Z.parseSave(JSON.parse(JSON.stringify(flying)))
    assert.deepEqual([loaded.inv.magnet, loaded.inv.selected], [true, 'magnet'])
    const again = Z.createGame(Z.WORLD, { seed: 2, save: loaded })
    assert.equal(again.inv.selected, 'magnet')
    assert.equal(tileAt(again, 22, 8), '▣', 'the iron stands where the map has it')

    const old = JSON.parse(JSON.stringify(before))
    delete old.inv.magnet
    const parsed = Z.parseSave(old)
    assert.ok(parsed, 'a save from before the Magnet loads')
    assert.equal(parsed.inv.magnet, false)
    assert.ok(!Z.useItems(Z.createGame(Z.WORLD, { save: parsed })).includes('magnet'))
  })

  it('is a wing of the Underglow that fits the world: valid maps, a key for every lock, a door you can walk to', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD), [])
    // The Underglow's one keyring, the wing's key and locks with the floors'.
    const ring = Object.values(Z.WORLD.maps).filter(d => d.keyring === 'underglow')
    assert.deepEqual(ring.map(d => d.id).sort(), ['heap1', 'heap2', 'underglow1', 'underglow2', 'underglow3'])
    const items = ring.flatMap(d => Object.values(d.marks).map(m => m.ent.item))
    /** Locked doors of one kind: runs of touching lock tiles. */
    const doors = ch => ring.reduce((n, d) => {
      const seen = new Set()
      d.rows.forEach((r, y) => [...r].forEach((t, x) => {
        if (t !== ch || seen.has(`${x},${y}`)) return
        n++
        for (const st = [[x, y]]; st.length;) {
          const [a, b] = st.pop()
          if (seen.has(`${a},${b}`) || d.rows[b]?.[a] !== ch) continue
          seen.add(`${a},${b}`)
          st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1])
        }
      }))
      return n
    }, 0)
    assert.deepEqual([items.filter(i => i === 'smallKey').length, doors('L')], [4, 4])
    assert.deepEqual([items.filter(i => i === 'bigKey').length, doors('K')], [1, 1])
    // The rails room keeps its size; the hole in its wall and the way back are where the Heap says.
    const under = Z.WORLD.maps.underglow1
    assert.deepEqual([under.rows[0].length, under.rows.length], [48, 24])
    const info = Z.mapInfo(Z.WORLD, 'underglow1')
    const hole = info.warps.find(w => w.to === 'heap1')
    assert.ok(Z.mapInfo(Z.WORLD, hole.to).entries[hole.entry], 'the hole lands on an entry')
    assert.ok(Z.mapInfo(Z.WORLD, 'heap1').entries.door && info.entries.heap)
    const s = Z.createGame(Z.WORLD, { at: { map: 'underglow1', entry: 'up' } })
    assert.equal(tileAt(s, hole.x, hole.y), '%')
    assert.ok(P.path(s, hole.x, hole.y - 1), 'the hollow wall can be walked up to')
  })
})
