// The five questlines that run through the lands (docs/worlds/atlas.md, "The stories start in the old world"),
// talked through from start to end in the real maps: each person is found where they stand, walked up to and
// talked to, and each step sets the flag the next one reads. The first step of every line stands on the
// hand-made coast or in the Wildwood; the rest are out in the lands.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

let Z
let P
before(async () => {
  Z = await load()
  P = walker(Z)
})

/** Where an NPC is written: its map and tile. */
function whereIs(id) {
  for (const [map, def] of Object.entries(Z.WORLD.maps)) {
    for (let y = 0; y < def.rows.length; y++) {
      const row = [...def.rows[y]]
      for (let x = 0; x < row.length; x++) {
        const e = def.marks[row[x]]?.ent
        if (e?.t === 'npc' && e.id === id) return { map, x, y }
      }
    }
  }
  return null
}

/** Walk up to `id` (entering its map at the entry nearest to it, the foes cleared) and talk to it. */
function talkTo(s, id) {
  const at = whereIs(id)
  assert.ok(at, `${id} stands somewhere`)
  const entries = Z.mapInfo(Z.WORLD, at.map).entries
  const entry = Object.entries(entries).sort(([, a], [, b]) => Math.abs(a.x - at.x) + Math.abs(a.y - at.y) - (Math.abs(b.x - at.x) + Math.abs(b.y - at.y)))[0][0]
  Z.enterMap(Z.WORLD, s, at.map, entry, [])
  s.mode = 'play'
  s.dialog = null
  for (let i = 0; i < 30; i++) { s.map.enemies = []; P.step(s); if (s.mode === 'dialog') P.settle(s) }
  const n = s.map.npcs.find(x => x.id === id)
  assert.ok(n, `${id} is there in ${at.map}`)
  const nx = Math.floor(n.x)
  const ny = Math.floor(n.y)
  const spots = [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]
  const spot = spots.find(([dx, dy]) => P.path(s, nx + dx, ny + dy))
  assert.ok(spot, `a way to ${id} in ${at.map}`)
  s.map.enemies = []
  P.walkTo(s, nx + spot[0], ny + spot[1])
  // (Someone who wanders may have stepped on; face them where they are now.)
  const m = s.map.npcs.find(x => x.id === id)
  const dx = m.x - s.hero.x
  const dy = m.y - s.hero.y
  P.face(s, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'))
  P.pressA(s)
}

const LINES = {
  'the cracked bell': [
    ['q.bell.girl', 'q.bell.heard'], ['q.bell.ringer', 'q.bell.crack'], ['q.bell.forewoman', 'q.bell.ore'], ['q.gunn', 'q.bell.chrome'],
    ['q.bell.forewoman', 'q.bell.cast'], ['q.bell.ringer', 'q.bell.rung'], ['q.bell.home', 'got:q.bell.home:bits50'],
  ],
  'the surveyor\'s pages': [
    ['q.map.kid', 'q.map.p1'], ['q.map.surveyor', 'q.map.asked'], ['q.map.programs', 'q.map.p2'], ['q.map.cairn', 'q.map.p3'],
    ['q.map.paperboy', 'q.map.p4'], ['q.map.surveyor', 'q.map.done'],
  ],
  'the stolen last act': [['q.act.busker', 'q.act.heard'], ['q.act.prompter', 'q.act.trap'], ['q.act.repairman', 'q.act.tape'], ['q.act.director', 'q.act.done']],
  'the clean seed': [
    ['q.seed.tender', 'q.seed.heard'], ['q.seed.keeper', 'q.seed.well'], ['q.seed.spirit', 'q.seed.got'], ['q.seed.bed', 'q.seed.planted'],
    ['q.seed.tender', 'got:q.seed.tender:bits50'],
  ],
  'Bror\'s lamp': [['q.lamp.miner', 'q.lamp.heard'], ['q.gunn', 'q.lamp.ask'], ['q.lamp.bror', 'q.lamp.got'], ['q.gunn', 'q.lamp.done']],
}

describe('the questlines', () => {
  for (const [name, steps] of Object.entries(LINES)) {
    it(`talks ${name} through from the coast to its end`, () => {
      const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'overworld', entry: 'start' } })
      Object.assign(s.inv, { sword: true, bombBag: true, bombs: 10, hook: true })
      for (const f of ['item:sword', 'item:bombBag', 'item:hook', 'intro']) s.flags[f] = true
      for (const [who, flag] of steps) {
        talkTo(s, who)
        assert.ok(s.flags[flag], `${who} sets ${flag}`)
      }
      // The first step stands on the hand-made coast or in the Wildwood.
      assert.ok(!Z.WORLD.maps[whereIs(steps[0][0]).map].away, `${steps[0][0]} starts the line in the old world`)
    })
  }
})
