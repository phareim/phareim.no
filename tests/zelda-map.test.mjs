// Where the hero has been (engine/explore.ts), which the chart and the MAP page draw: seen as they walk, kept in the
// save, and small enough there with the whole world seen.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const walk = (s, x, y, frames) => { for (let i = 0; i < frames; i++) Z.stepGame(Z.WORLD, s, 1 / 60, inp({ move: { x, y } })) }
const seenCount = (s, id) => {
  const info = Z.mapInfo(Z.WORLD, id)
  let n = 0
  for (let y = 0; y < info.h; y += Z.CHUNK) for (let x = 0; x < info.w; x += Z.CHUNK) if (Z.seenTile(s, id, info.w, x, y)) n++
  return n
}

describe('where the hero has been', () => {
  it('sees round the hero outdoors and more as they walk, a dungeon room whole, and keeps nothing indoors', () => {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'overworld', entry: 'hut' } })
    walk(s, 0, 0, 2)
    const first = seenCount(s, 'overworld')
    assert.ok(first > 0, 'the start is seen')
    assert.ok(Z.seenTile(s, 'overworld', s.map.w, Math.floor(s.hero.x), Math.floor(s.hero.y)), 'where the hero stands')
    assert.ok(!Z.seenTile(s, 'overworld', s.map.w, 0, 0) || Math.hypot(s.hero.x, s.hero.y) < Z.SIGHT + Z.CHUNK * 1.5, 'not the far corner')
    walk(s, 1, 0, 240)
    assert.ok(seenCount(s, 'overworld') > first, 'walking sees more')
    // A dungeon room is seen whole on walking in.
    {
      const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'shrine', entry: 'start' } })
      walk(s, 0, 0, 2)
      const z = s.zone
      for (const [x, y] of [[z.x, z.y], [z.x + z.w - 1, z.y], [z.x, z.y + z.h - 1], [z.x + z.w - 1, z.y + z.h - 1]]) {
        assert.ok(Z.seenTile(s, 'shrine', s.map.w, x, y), `room corner ${x},${y}`)
      }
    }
    // Rooms indoors keep nothing.
    {
      const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'hut', entry: Object.keys(Z.mapInfo(Z.WORLD, 'hut').entries)[0] } })
      walk(s, 0, 1, 30)
      assert.equal(s.explored?.hut, undefined)
      assert.equal(Z.charted(Z.WORLD.maps.hut), false)
      assert.equal(Z.charted(Z.WORLD.maps.overworld), true)
    }
  })

  it('goes into the save and comes back', () => {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'overworld', entry: 'hut' } })
    s.inv.sword = true
    walk(s, 1, 0, 120)
    const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    assert.deepEqual(save.explored, s.explored)
    const again = Z.createGame(Z.WORLD, { save, at: { map: 'overworld', entry: 'hut' } })
    assert.deepEqual(again.explored, s.explored)
  })

  it('fits in the save with the whole world seen, every map of it, and keeps at most EXPLORE_MAPS maps', () => {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'overworld', entry: 'hut' } })
    s.inv.sword = true
    const ids = Object.keys(Z.WORLD.maps)
    for (const id of ids) {
      const def = Z.WORLD.maps[id]
      const w = def.rows[0].length
      const h = def.rows.length
      Z.reveal(s, id, w, h, { x: 0, y: 0, w, h })
    }
    const bytes = JSON.stringify(Z.toSave(s).explored).length
    assert.ok(bytes < 6000, `${bytes} bytes for ${Object.keys(s.explored).length} maps`)
    const charted = ids.filter(id => Z.charted(Z.WORLD.maps[id]))
    assert.ok(charted.length > 0)
    for (const id of charted) assert.ok(s.explored[id], `${id} is in the explored data`)
    // More maps than the cap: the first written make room.
    {
      const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'overworld', entry: 'hut' } })
      s.explored = {}
      for (let i = 0; i < Z.EXPLORE_MAPS + 5; i++) Z.reveal(s, `m${i}`, 16, 16, { x: 0, y: 0, w: 1, h: 1 })
      const ids = Object.keys(s.explored)
      assert.equal(ids.length, Z.EXPLORE_MAPS)
      assert.ok(!ids.includes('m0') && ids.includes(`m${Z.EXPLORE_MAPS + 4}`))
    }
  })
})
