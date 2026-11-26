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

/** Walk up to `id` (entering its map at the entry nearest to it, the foes cleared), talk to it and return the lines. */
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
  P.step(s, P.inp({ aPress: true, a: true }))
  const said = s.dialog?.lines
  P.settle(s)
  return said
}

/** A hero out of the old world's start with the gear the lines need, and `flags` already set. */
function hero(...flags) {
  const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'overworld', entry: 'start' } })
  Object.assign(s.inv, { sword: true, bombBag: true, bombs: 10, hook: true })
  for (const f of ['item:sword', 'item:bombBag', 'item:hook', 'intro', ...flags]) s.flags[f] = true
  return s
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

/** The story's two late flags, as a player has them who finished the old world before starting a line. */
const STARTS = [['', []], [', the Gate already shut and the Prism in the bag', ['gateShut', 'item:prism']]]

describe('the questlines', () => {
  for (const [when, flags] of STARTS) {
    for (const [name, steps] of Object.entries(LINES)) {
      it(`talks ${name} through from the coast to its end${when}`, () => {
        const s = hero(...flags)
        for (const [who, flag] of steps) {
          talkTo(s, who)
          assert.ok(s.flags[flag], `${who} sets ${flag}`)
        }
        // The first step stands on the hand-made coast or in the Wildwood.
        assert.ok(!Z.WORLD.maps[whereIs(steps[0][0]).map].away, `${steps[0][0]} starts the line in the old world`)
      })
    }
  }
})

describe('Gunn, on the story', () => {
  const BOTH = ["GUNN: BROR IS FINE. THE LETTERS ARE LIT. I'VE RUN OUT OF THINGS TO WAIT FOR."]
  const SIGN = ['GUNN: THE SIGN IS LIT. NOW ALL IT NEEDS IS A TOWN UNDER IT.']
  const DUST = ["GUNN: THE SUN SET. EVERY LETTER ON THE HILL IS LIT. I'M NOT CRYING. IT'S LUMEN DUST."]

  it('has one line for a lamp brought home and a sign lit', () => {
    assert.deepEqual(talkTo(hero('q.lamp.done', 'q.lumenby.sign.done'), 'q.gunn'), BOTH)
  })

  for (const [what, flags, after] of [['the sign', [], SIGN], ['the lamp and the sign', ['q.lamp.done'], BOTH]]) {
    it(`speaks of the lumen dust once after the sunset, then of ${what}`, () => {
      const s = hero('item:prism', 'q.lumenby.sign.done', ...flags)
      assert.deepEqual(talkTo(s, 'q.gunn'), DUST)
      assert.ok(s.flags['lumenby.sunset'])
      assert.deepEqual(talkTo(s, 'q.gunn'), after)
      assert.deepEqual(talkTo(s, 'q.gunn'), after)
    })
  }

  for (const order of [['q.lamp.got', 'q.lumenby.sign7'], ['q.lumenby.sign7', 'q.lamp.got']]) {
    it(`pays a heart piece for the lamp and one for the sign, ${order[0] === 'q.lamp.got' ? 'lamp' : 'sign'} first`, () => {
      const s = hero('q.lumenby.sign1', 'q.lumenby.sign2', 'q.lumenby.sign3', 'q.lumenby.sign4', 'q.lumenby.sign5', 'q.lumenby.sign6')
      for (const [i, flag] of order.entries()) {
        s.flags[flag] = true
        talkTo(s, 'q.gunn')
        assert.equal(s.inv.pieces, i + 1, `a piece after ${flag}`)
      }
      assert.ok(s.flags['q.lamp.done'] && s.flags['q.lumenby.sign.done'])
      talkTo(s, 'q.gunn')
      assert.equal(s.inv.pieces, 2, 'and no third')
    })
  }

  it('pays the sign on a save that took the lamp piece before a step had its own key', () => {
    const s = hero('q.lamp.done', 'got:q.gunn:heartPiece', 'q.lumenby.sign1', 'q.lumenby.sign2', 'q.lumenby.sign3', 'q.lumenby.sign4', 'q.lumenby.sign5', 'q.lumenby.sign6', 'q.lumenby.sign7')
    talkTo(s, 'q.gunn')
    assert.equal(s.inv.pieces, 1)
    assert.ok(s.flags['got:q.gunn:heartPiece:q.lumenby.sign.done'])
  })

  it('still asks after Bror when the sun has set and nothing is done', () => {
    const s = hero('item:prism')
    const said = talkTo(s, 'q.gunn')
    assert.ok(s.flags['q.lamp.ask'])
    assert.match(said[0], /MY BROTHER BROR/)
    assert.match(said.at(-1), /THE SUN SET\. NOW THE ORDERS COME/)
  })
})

describe('Arne, on the story', () => {
  it('pays for the boots and starts the pages with a hero who shut the Gate before they met', () => {
    const s = hero('gateShut')
    const bits = s.inv.bits
    const first = talkTo(s, 'q.map.surveyor')
    assert.match(first.at(-1), /HERE, FOR BOOTS/)
    assert.equal(s.inv.bits, bits + 20)
    assert.ok(s.flags['q.map.asked'])
    assert.match(talkTo(s, 'q.map.surveyor').at(-1), /THE NEEDLE IS BACK ON NORTH/)
  })
})
