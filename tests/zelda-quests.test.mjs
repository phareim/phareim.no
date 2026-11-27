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

describe('the questlines', () => {
  for (const [name, steps] of Object.entries(LINES)) {
    it(`talks ${name} through from the coast to its end`, () => {
      const s = hero()
      for (const [who, flag] of steps) {
        P.talkTo(s, who)
        assert.ok(s.flags[flag], `${who} sets ${flag}`)
      }
      // The first step stands on the hand-made coast or in the Wildwood.
      assert.ok(!Z.WORLD.maps[P.whereIs(steps[0][0]).map].away, `${steps[0][0]} starts the line in the old world`)
    })
  }
})

describe('Gunn, on the story', () => {
  const BOTH = ["GUNN: BROR IS FINE. THE LETTERS ARE LIT. I'VE RUN OUT OF THINGS TO WAIT FOR."]
  const SIGN = ['GUNN: THE SIGN IS LIT. NOW ALL IT NEEDS IS A TOWN UNDER IT.']
  const DUST = ["GUNN: THE SUN SET. EVERY LETTER ON THE HILL IS LIT. I'M NOT CRYING. IT'S LUMEN DUST."]

  it('has a line for a lamp brought home and a sign lit, and speaks of the lumen dust once after the sunset', () => {
    assert.deepEqual(P.talkTo(hero('q.lamp.done', 'q.lumenby.sign.done'), 'q.gunn'), BOTH)
    for (const [flags, after] of [[[], SIGN], [['q.lamp.done'], BOTH]]) {
      const s = hero('item:prism', 'q.lumenby.sign.done', ...flags)
      assert.deepEqual(P.talkTo(s, 'q.gunn'), DUST)
      assert.ok(s.flags['lumenby.sunset'])
      assert.deepEqual(P.talkTo(s, 'q.gunn'), after)
      assert.deepEqual(P.talkTo(s, 'q.gunn'), after)
    }
  })

  it('pays a heart piece for the lamp and one for the sign, whichever comes first, and no third', () => {
    for (const order of [['q.lamp.got', 'q.lumenby.sign7'], ['q.lumenby.sign7', 'q.lamp.got']]) {
      const s = hero('q.lumenby.sign1', 'q.lumenby.sign2', 'q.lumenby.sign3', 'q.lumenby.sign4', 'q.lumenby.sign5', 'q.lumenby.sign6')
      for (const [i, flag] of order.entries()) {
        s.flags[flag] = true
        P.talkTo(s, 'q.gunn')
        assert.equal(s.inv.pieces, i + 1, `a piece after ${flag}`)
      }
      assert.ok(s.flags['q.lamp.done'] && s.flags['q.lumenby.sign.done'])
      P.talkTo(s, 'q.gunn')
      assert.equal(s.inv.pieces, 2, `${order[0]} first: and no third`)
    }
  })
})

describe('Arne, on the story', () => {
  it('pays for the boots and starts the pages with a hero who shut the Gate before they met', () => {
    const s = hero('gateShut')
    const bits = s.inv.bits
    const first = P.talkTo(s, 'q.map.surveyor')
    assert.match(first.at(-1), /HERE, FOR BOOTS/)
    assert.equal(s.inv.bits, bits + 20)
    assert.ok(s.flags['q.map.asked'])
    assert.match(P.talkTo(s, 'q.map.surveyor').at(-1), /THE NEEDLE IS BACK ON NORTH/)
  })
})
