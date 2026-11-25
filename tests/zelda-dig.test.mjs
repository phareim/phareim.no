// Neon Shrine dig & build (engine/dig.ts, engine/digGround.ts, world/quarry.ts): heights and ramps in the
// collision, the tools gating their verbs, materials, building, edits kept through map changes and saves,
// the caps, and old saves.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const step = (s, i = inp(), dt = 1 / 60) => Z.stepGame(Z.WORLD, s, dt, i)
const AT = { map: 'quarry', entry: 'start' }

function quarry(tools = []) {
  const s = Z.createGame(Z.WORLD, { seed: 3, at: AT })
  s.inv.sword = true
  for (const t of tools) s.flags[`item:${t}`] = true
  // The foes stay out of the way.
  for (const e of s.map.enemies) { e.dead = true; e.x = -9; e.y = -9 }
  return s
}
/** Stand on the middle of tile (x, y) facing `dir`. */
function stand(s, x, y, dir = 'up') { s.hero.x = x + 0.5; s.hero.y = y + 0.5; s.hero.dir = dir; s.hero.aim = undefined; step(s) }
function settle(s) { for (let i = 0; i < 400 && s.mode !== 'play'; i++) { if (s.mode === 'dialog') { step(s, inp(), 0.3); step(s, inp({ aPress: true, a: true })) } else step(s) } }
/** B with `item` out; returns the events. */
function use(s, item) { s.inv.selected = item; const ev = step(s, inp({ bPress: true })); settle(s); for (let i = 0; i < 12; i++) step(s); return ev }
const tile = (s, x, y) => s.map.tiles[y * s.map.w + x]
const height = (s, x, y) => s.map.dig.h[y * s.map.w + x]
/** Walk `dir` for `n` frames. */
function walk(s, dir, n = 60) {
  const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]
  for (let i = 0; i < n; i++) step(s, inp({ move: { x: v[0], y: v[1] } }))
}

describe('Neon Shrine dig & build', () => {
  it('is on only where a map says so', () => {
    const s = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'overworld', entry: 'hut' } })
    assert.equal(s.map.dig, undefined)
    for (const [id, def] of Object.entries(Z.WORLD.maps)) if (id !== 'quarry') assert.equal(def.dig, undefined, id)
    const q = quarry()
    assert.equal(q.map.dig.g, 1)
    assert.equal(height(q, 5, 13), 2) // the turf ring
    assert.equal(height(q, 12, 12), 3) // the outcrop
  })

  it('stops a walker at a step up, lets it step down, and takes it up a ramp', () => {
    const s = quarry(['hammer'])
    // South of the plateau (h 2) on the ground (h 1): north is a wall.
    stand(s, 16, 9, 'up')
    walk(s, 'up', 60)
    assert.ok(s.hero.y > 8.3, `walked into the plateau: y ${s.hero.y}`)
    // A ramp on the tile in front of the step takes the hero up.
    s.inv.mats = { stone: 3 }
    stand(s, 16, 9, 'up')
    const ev = use(s, 'build')
    assert.ok(ev.some(e => e.type === 'dig' && e.verb === 'build'), 'built')
    assert.equal(tile(s, 16, 8), 'ж')
    assert.equal(height(s, 16, 8), 2)
    assert.equal(s.inv.mats.stone, 2)
    walk(s, 'up', 70)
    assert.ok(s.hero.y < 7.6, `went up the ramp: y ${s.hero.y}`)
    assert.equal(s.map.dig.z, 2)
    // Off the east side of the plateau and down onto the ground: free.
    stand(s, 20, 7, 'right')
    walk(s, 'right', 40)
    assert.ok(s.hero.x > 21.3, `stepped down: x ${s.hero.x}`)
    step(s)
    assert.equal(s.map.dig.z, 1)
  })

  it('gates each verb by its tool, and keeps what it digs', () => {
    const s = quarry()
    // No tool, no DIG in the cycle.
    s.inv.selected = null
    step(s, inp({ cycle: true }))
    assert.equal(s.inv.selected, null)
    s.flags['item:shovel'] = true
    step(s, inp({ cycle: true }))
    assert.equal(s.inv.selected, 'dig')
    // The shovel digs the turf ring down to the ground and keeps the dirt.
    stand(s, 5, 12, 'down')
    use(s, 'dig')
    assert.equal(height(s, 5, 13), 1)
    assert.equal(tile(s, 5, 13), 'д')
    assert.equal(Z.matCount(s, 'dirt'), 1)
    // Stone wants the pickaxe: a clank, a line the first time, nothing changes.
    stand(s, 5, 9, 'up')
    const ev = use(s, 'dig')
    assert.ok(ev.some(e => e.type === 'clank'))
    assert.ok(s.flags['dighint:pickaxe'])
    assert.equal(height(s, 5, 8), 2)
    s.flags['item:pickaxe'] = true
    use(s, 'dig')
    assert.equal(height(s, 5, 8), 1)
    assert.equal(Z.matCount(s, 'lumen'), 1, 'the ore gives lumen')
    // Trees want the axe.
    stand(s, 25, 13, 'up')
    use(s, 'dig')
    assert.equal(tile(s, 25, 12), 'T')
    s.flags['item:axe'] = true
    use(s, 'dig')
    assert.equal(tile(s, 25, 12), '.')
    assert.equal(Z.matCount(s, 'wood'), 2)
  })

  it('digs a hole, fills it back, and leaves no edit when the ground is as it was', () => {
    const s = quarry(['shovel'])
    stand(s, 18, 12, 'up')
    use(s, 'dig')
    assert.equal(tile(s, 18, 11), 'к')
    assert.equal(height(s, 18, 11), 0)
    assert.ok(s.digEdits.quarry)
    // Facing the hole: the shovel fills it.
    use(s, 'dig')
    assert.equal(height(s, 18, 11), 1)
    assert.equal(tile(s, 18, 11), '.')
    assert.equal(s.digEdits.quarry, undefined)
    assert.equal(Z.matCount(s, 'dirt'), 0)
  })

  it('lets a hero with only the shovel step into a hole and out again, any way', () => {
    for (const dir of ['up', 'down', 'left', 'right']) {
      const s = quarry(['shovel'])
      stand(s, 18, 12, 'up')
      use(s, 'dig')
      assert.equal(height(s, 18, 11), 0)
      stand(s, 18, 11, dir)
      assert.equal(s.map.dig.z, 0, 'in the hole')
      const [x0, y0] = [s.hero.x, s.hero.y]
      walk(s, dir, 50)
      assert.ok(Math.hypot(s.hero.x - x0, s.hero.y - y0) > 1, `climbed out ${dir}: ${s.hero.x}, ${s.hero.y}`)
      assert.equal(s.map.dig.z, 1)
    }
    // One up only: from a hole a block one above the ground still stops the hero.
    const s = quarry(['shovel'])
    stand(s, 16, 9, 'up')
    use(s, 'dig') // (16, 8), at the foot of the plateau (h 2)
    stand(s, 16, 8, 'up')
    assert.equal(s.map.dig.z, 0)
    walk(s, 'up', 60)
    assert.ok(s.hero.y > 7.3, `climbed two: y ${s.hero.y}`)
  })

  it('builds blocks, planks and lamps, spends their materials, and takes them back whole', () => {
    const s = quarry(['hammer'])
    s.inv.mats = { stone: 1, wood: 3, lumen: 1 }
    // A stone block in front: a wall one up.
    stand(s, 18, 12, 'up')
    s.inv.build = 'stone'
    use(s, 'build')
    assert.equal(tile(s, 18, 11), 'а')
    assert.equal(height(s, 18, 11), 2)
    assert.equal(Z.matCount(s, 'stone'), 0)
    // With nothing to build with, the hammer buzzes.
    const kept = s.inv.mats
    s.inv.mats = {}
    stand(s, 17, 12, 'up')
    const ev = use(s, 'build')
    assert.ok(ev.some(e => e.type === 'error'))
    assert.equal(height(s, 17, 11), 1)
    s.inv.mats = kept
    // The hammer takes the block back.
    stand(s, 18, 12, 'up')
    use(s, 'build')
    assert.equal(height(s, 18, 11), 1)
    assert.equal(tile(s, 18, 11), '.')
    assert.equal(Z.matCount(s, 'stone'), 1)
    // A plank over the lake, a lamp on the shore.
    stand(s, 21, 4, 'right')
    use(s, 'build')
    assert.equal(tile(s, 22, 4), '=')
    assert.equal(Z.matCount(s, 'wood'), 2)
    stand(s, 21, 6, 'up')
    s.inv.build = 'lamp'
    use(s, 'build')
    assert.equal(tile(s, 21, 5), 't')
    assert.equal(Z.matCount(s, 'lumen'), 0)
    assert.equal(Z.matCount(s, 'wood'), 1)
    // The cycle steps through the kinds that can be built.
    s.inv.mats = { stone: 1, wood: 1, lumen: 1 }
    s.inv.selected = 'build'; s.inv.build = 'stone'
    step(s, inp({ cycle: true }))
    assert.equal(s.inv.build, 'wood')
    step(s, inp({ cycle: true }))
    assert.equal(s.inv.build, 'lamp')
  })

  it('takes back the top block of a stack and leaves the one under it as built', () => {
    for (const [kind, ch] of [['stone', 'а'], ['wood', 'б']]) {
      const s = quarry(['hammer'])
      s.inv.mats = { [kind]: 2 }
      s.inv.build = kind
      // From the plateau (h 2), two blocks on the ground east of it: 1 → 2 → 3.
      stand(s, 20, 6, 'right')
      use(s, 'build')
      use(s, 'build')
      assert.equal(height(s, 21, 6), 3)
      assert.equal(Z.matCount(s, kind), 0)
      use(s, 'build') // the top one back
      assert.equal(tile(s, 21, 6), ch, `${kind}: the block under it`)
      assert.equal(height(s, 21, 6), 2)
      assert.equal(Z.matCount(s, kind), 1)
      // From the ground, the last one back: the map as it was.
      stand(s, 21, 7, 'up')
      use(s, 'build')
      assert.equal(tile(s, 21, 6), '.')
      assert.equal(height(s, 21, 6), 1)
      assert.equal(Z.matCount(s, kind), 2)
      assert.equal(s.digEdits?.quarry, undefined)
    }
  })

  it('keeps a ledge chest out of reach until the hero stands as high', () => {
    const s = quarry()
    stand(s, 16, 5, 'up') // on the plateau (h 2), the chest north of the hero
    // From below (the hero's tile lowered to the ground): A does not reach it.
    s.map.dig.h[5 * s.map.w + 16] = 1
    step(s)
    step(s, inp({ aPress: true, a: true }))
    assert.ok(!s.flags['chest:quarry.ledge'], 'opened from below')
    s.map.dig.h[5 * s.map.w + 16] = 2
    for (let i = 0; i < 40; i++) step(s) // (A swung the blade instead: let it end)
    step(s, inp({ aPress: true, a: true }))
    settle(s)
    assert.ok(s.flags['chest:quarry.ledge'])
  })

  it('turns up a cache once', () => {
    const s = quarry(['shovel'])
    const bits = s.inv.bits
    stand(s, 10, 18, 'up')
    use(s, 'dig')
    assert.equal(s.inv.bits, bits + 20)
    assert.ok(s.flags['took:quarry.cache1'])
    use(s, 'dig') // fill it back
    use(s, 'dig') // and dig again: nothing more
    assert.equal(s.inv.bits, bits + 20)
  })

  it('keeps the edits through leaving the map, and through a save', () => {
    const s = quarry(['shovel', 'pickaxe'])
    s.inv.bits = 1
    stand(s, 5, 12, 'down')
    use(s, 'dig')
    stand(s, 12, 14, 'up')
    use(s, 'dig') // the outcrop's stone, 2 → 1
    assert.equal(tile(s, 11, 13), 'е')
    stand(s, 11, 14, 'up')
    use(s, 'dig')
    assert.equal(height(s, 11, 13), 1)
    assert.equal(tile(s, 11, 13), 'а')
    Z.enterMap(Z.WORLD, s, 'overworld', 'hut', [])
    Z.enterMap(Z.WORLD, s, 'quarry', 'start', [])
    assert.equal(height(s, 5, 13), 1)
    assert.equal(tile(s, 5, 13), 'д')
    assert.equal(height(s, 11, 13), 1)
    const save = Z.toSave(s)
    assert.equal(typeof save.dig.quarry, 'string')
    const back = Z.parseSave(JSON.parse(JSON.stringify(save)))
    assert.ok(back)
    assert.deepEqual(back.inv.mats, s.inv.mats)
    const t = Z.createGame(Z.WORLD, { seed: 1, save: back, at: AT })
    assert.equal(tile(t, 5, 13), 'д')
    assert.equal(height(t, 5, 13), 1)
    assert.equal(tile(t, 11, 13), 'а')
    assert.equal(height(t, 12, 12), 3)
  })

  it('holds the caps, in play and in a save', () => {
    const s = quarry(['shovel'])
    // Fill the map's quota with edits, then the next dig is refused with a line.
    const ed = {}
    for (let i = 0; i < Z.DIG_CAP; i++) ed[1000 + i] = 'д1'
    s.digEdits = { quarry: ed }
    s.inv.mats = {}
    stand(s, 18, 12, 'up')
    s.inv.selected = 'dig'
    step(s, inp({ bPress: true }))
    assert.equal(s.mode, 'dialog')
    assert.equal(tile(s, 18, 11), '.')
    settle(s)
    // A tile already edited can still change.
    stand(s, 5, 12, 'down')
    s.digEdits.quarry[13 * s.map.w + 5] = 'в2'
    use(s, 'dig')
    assert.equal(height(s, 5, 13), 1)
    // Maps: at most DIG_MAPS hold edits.
    const many = {}
    for (let k = 0; k < Z.DIG_MAPS + 3; k++) many[`fr:${k},0`] = '1д1,2д1'
    const dec = Z.decodeDig(many)
    assert.equal(Object.keys(dec).length, Z.DIG_MAPS)
    // A save's long list is cut at the cap; junk is dropped.
    const long = Array.from({ length: Z.DIG_CAP + 50 }, (_, i) => i.toString(36) + 'д1').join(',')
    assert.equal(Object.keys(Z.decodeDig({ quarry: long }).quarry).length, Z.DIG_CAP)
    assert.deepEqual(Z.decodeDig({ quarry: 'zz#1,1Q9,,x' }), undefined)
    assert.equal(Z.decodeDig('nope'), undefined)
  })

  it('reads old saves, and saves with the tools out', () => {
    const s = quarry(['shovel'])
    const save = Z.toSave(s)
    delete save.dig
    delete save.inv.mats
    delete save.inv.build
    const old = Z.parseSave(save)
    assert.ok(old)
    assert.equal(old.dig, undefined)
    assert.equal('mats' in old.inv, false)
    const g = Z.createGame(Z.WORLD, { save: old, at: AT })
    assert.equal(g.digEdits, undefined)
    assert.equal(height(g, 5, 13), 2)
    // The tools out and odd materials.
    const odd = Z.parseSave({ ...save, inv: { ...save.inv, selected: 'dig', mats: { stone: 500, dirt: -2, gold: 3 }, build: 'castle' }, dig: { quarry: 5 } })
    assert.ok(odd)
    assert.equal(odd.inv.selected, 'dig')
    assert.deepEqual(odd.inv.mats, { stone: 99 })
    assert.equal(odd.inv.build, undefined)
    assert.equal(odd.dig, undefined)
    assert.equal(Z.parseSave({ ...save, inv: { ...save.inv, selected: 'spade' } }), null)
  })

  it('plays the quarry through: each tool opens the way to the next, and the hammer climbs and bridges', () => {
    const s = quarry()
    /** Walk straight to the middle of tile (x, y), one axis at a time; true when there. */
    const go = (x, y) => {
      for (let i = 0; i < 900; i++) {
        settle(s)
        const dx = x + 0.5 - s.hero.x
        const dy = y + 0.5 - s.hero.y
        if (Math.abs(dx) < 0.06 && Math.abs(dy) < 0.06) return true
        const mx = Math.abs(dx) >= 0.06 ? Math.sign(dx) * Math.min(1, Math.abs(dx) * 4 + 0.2) : 0
        step(s, inp({ move: Math.abs(mx) > 0 ? { x: mx, y: 0 } : { x: 0, y: Math.sign(dy) * Math.min(1, Math.abs(dy) * 4 + 0.2) } }))
      }
      return false
    }
    const face = dir => { s.hero.dir = dir; s.hero.aim = undefined }
    const open = (dir, flag) => { face(dir); step(s, inp({ aPress: true, a: true })); settle(s); assert.ok(s.flags[flag], flag) }
    const dig = (dir, item = 'dig') => { face(dir); use(s, item) }
    // The shovel by the road.
    assert.ok(go(13, 19)); open('up', 'chest:quarry.shovel')
    // Through the ring of turf to the pickaxe.
    assert.ok(go(10, 19)); assert.ok(go(10, 12)); assert.ok(go(5, 12)); dig('down')
    assert.ok(go(5, 15), 'through the turf'); open('down', 'chest:quarry.pickaxe')
    // Through the stone wall (its ore) to the axe, and a block of the wall for stone.
    assert.ok(go(5, 9)); dig('up')
    assert.ok(go(4, 9)); dig('up')
    assert.ok(go(5, 6), 'through the wall'); open('up', 'chest:quarry.axe')
    assert.ok(Z.matCount(s, 'stone') >= 1 && Z.matCount(s, 'lumen') >= 1)
    // Into the grove to the hammer, wood on the way.
    assert.ok(go(5, 10)); assert.ok(go(25, 10)); assert.ok(go(25, 11)); dig('down')
    assert.ok(go(24, 11)); dig('down')
    assert.ok(go(25, 14), 'into the grove'); open('down', 'chest:quarry.hammer')
    // Up a ramp to the ledge chest.
    s.inv.build = 'stone'
    assert.ok(go(25, 11)); assert.ok(go(16, 11)); assert.ok(go(16, 9)); dig('up', 'build')
    assert.equal(tile(s, 16, 8), 'ж')
    assert.ok(go(16, 5), 'up the ramp'); open('up', 'chest:quarry.ledge')
    // Planks to the island.
    assert.ok(go(21, 5), 'down off the ledge'); assert.ok(go(21, 4))
    for (let x = 22; x <= 24; x++) {
      if (Z.matCount(s, 'wood') < 1) s.inv.mats.wood = 1 // (a tree more would do)
      dig('right', 'build')
      assert.equal(tile(s, x, 4), '=')
      assert.ok(go(x, 4))
    }
    assert.ok(go(25, 5)); open('right', 'chest:quarry.island')
  })

  it('keeps foes out of a lamp\'s light', () => {
    const s = quarry()
    const e = s.map.enemies.find(f => f.kind === 'blob')
    e.dead = false
    s.map.tiles[15 * s.map.w + 10] = 't'
    s.map.version++
    e.x = 10.5; e.y = 14.2
    e.ai.mode = 'wait'; e.ai.t = 9
    stand(s, 2, 20)
    for (let i = 0; i < 120; i++) step(s)
    assert.ok(Math.hypot(e.x - 10.5, e.y - 15.5) > 2.2, `the blob stayed in the light: ${e.x}, ${e.y}`)
  })
})
