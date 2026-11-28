// Neon Shrine, THE ECHO BARROW (docs/worlds/atlas.md "The Echo Barrow"): the dungeon end to end. Scripted players walk
// and fight it with the pad's inputs, reading what a player sees (where things are, what a foe is doing, what is painted
// on the floor). Nobody plays it by hand before it ships, so the first test is the whole way through.
//   ECHO_LOG=1 prints how long each fight took and what it cost.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { FPS, inp, gap, ROOM, T, tile, roomOf, hands, play, use } from './zelda-plays/echo-barrow.mjs'

let Z
before(async () => { Z = await load(); use(Z) })

/** A game at an entry of a map with the blade, past any walk out of a door. */
function start(map, entry, seed, halfHearts) {
  const s = Z.createGame(Z.WORLD, { seed, at: { map, entry } })
  Object.assign(s, { mode: 'play', dialog: null })
  s.inv.sword = true
  s.hero.auto = null
  s.hero.maxHp = s.hero.hp = halfHearts
  return s
}

// ================================================================================================================

describe('the Echo Barrow', () => {
  it('is played from the door in Seter Fell to the Weight in hand, with a reload of the tab halfway', () => {
    play(Z, start('seterfell', 'mounds', 11, 20))
  })

  it('beats a hero who stands still before the Parrot, and puts them back in the porch', () => {
    for (const seed of [1, 2, 3, 4]) {
      const game = { s: start('echobarrow', 'start', seed, 12) }
      const { go, push, into, step } = hands(game)
      const s = game.s
      s.flags['bigkey:echobarrow'] = true
      go('porch', 7, 1)
      into('hall', 0, -1)
      go('hall', 7, 1)
      push(0, -1, 20)
      into('parrot', 0, -1)
      go('parrot', 3 + seed * 2, 6 + (seed % 3))
      let f = 0
      for (; f < 90 * FPS && s.mode !== 'dying'; f++) step()
      assert.equal(s.mode, 'dying', `seed ${seed}: stood 90 s and lived, ${s.hero.hp} half hearts left`)
      if (process.env.ECHO_LOG) console.log(`standing still, seed ${seed}: fell after ${(f / FPS).toFixed(1)} s`)
      for (let n = 0; n < 3 * FPS; n++) step()
      assert.equal(s.mode, 'play')
      // Back at the great lock, in the Parrot's room (the stair of its own), and still standing in the doorway loses too.
      assert.equal(roomOf(s), 'parrot')
      assert.ok(gap(s.hero, { x: ROOM.parrot[0] + 8.5, y: ROOM.parrot[1] + 11.5 }) < 0.01, `at the door: ${s.hero.x},${s.hero.y}`)
      assert.equal(tile(s, T('hall', 7, 0)), '.', 'the great lock stays open')
      assert.ok(!Z.hasWeight(s, 'weightMeaning'))
      // Standing in the doorway is no refuge either: it is recited at (from there most of it falls short, so it takes
      // longer) until he falls or a blow throws him out of the room, hurt.
      for (f = 0; f < 240 * FPS && s.mode !== 'dying' && roomOf(s) === 'parrot'; f++) step()
      assert.ok(s.mode === 'dying' || (roomOf(s) !== 'parrot' && s.hero.hp < s.hero.maxHp), `seed ${seed}: stood in the doorway for ${f / FPS} s unhurt`)
      if (process.env.ECHO_LOG) console.log(`standing in the doorway, seed ${seed}: ${s.mode === 'dying' ? 'fell' : 'thrown out'} after ${(f / FPS).toFixed(1)} s`)
    }
  })

  it('never saves the echo, and loads a save with it on B', () => {
    const game = { s: start('echobarrow', 'start', 3, 6) }
    const { run, leave } = hands(game)
    Z.grant(game.s, 'echo')
    run(20, inp({ move: { x: 0, y: -1 } }))
    leave('up')
    const withEcho = Z.toSave(game.s)
    const echo = game.s.echo
    game.s.echo = null
    assert.deepEqual(withEcho, Z.toSave(game.s), 'a save is the same with an echo left as without one')
    game.s.echo = echo
    const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(game.s))))
    assert.deepEqual([save.inv.echo, save.inv.selected], [true, 'echo'])
    game.s = Z.createGame(Z.WORLD, { save, at: { map: save.map, entry: save.entry } })
    assert.equal(game.s.echo, null)
    run(30)
    run(1, inp({ bPress: true }))
    assert.ok(game.s.echo, 'and B leaves one')
  })

  it('is a valid map with as many small keys as locked doors, and one big key for its great lock', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD), [])
    const info = Z.mapInfo(Z.WORLD, 'echobarrow')
    /** Doors of `ch`: runs of touching lock tiles (one key opens a run). */
    const doors = ch => {
      const seen = new Set()
      let n = 0
      info.base.forEach((t, i) => {
        if (t !== ch || seen.has(i)) return
        n++
        for (const q = [i]; q.length;) { const j = q.pop(); if (seen.has(j) || info.base[j] !== ch) continue; seen.add(j); q.push(j + 1, j - 1, j + info.w, j - info.w) }
      })
      return n
    }
    const ring = Object.values(Z.WORLD.maps).filter(d => d.keyring === info.def.keyring)
    assert.deepEqual(ring.map(d => d.id), ['echobarrow'], 'a keyring of its own')
    const chests = info.chestList.map(c => c.item)
    assert.deepEqual([doors('L'), chests.filter(i => i === 'smallKey').length], [2, 2])
    assert.deepEqual([doors('K'), chests.filter(i => i === 'bigKey').length], [1, 1])
  })
})
