// Night of the Dead Battery — the ground floor (Kjell's floor) through the
// real engine and content: matches, oil, the cat and the monocle, Gustav and
// the clock key, the thawed freezer's gloves, the junction box, Hedvig's
// poker and her séance (run with Espen as hero), the clock, and a LOOK AT
// for every hotspot.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hs, item } from './battery-helpers.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', 'themes', 'battery')

let B
let F
let SFX
before(async () => {
  // The usual bundle, plus the séance handler from the parlour.
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './engine/index'`,
        `export { CONTENT } from './content/index'`,
        `export { F } from './content/flags'`,
        `export { seance } from './content/rooms/parlour'`,
      ].join('; '),
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  B = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
  F = B.F
  const src = readFileSync(join(root, 'content/sfx.ts'), 'utf8')
  SFX = [...src.slice(0, src.indexOf('as const')).matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1])
})

const GROUND = ['foyer', 'parlour', 'kitchen', 'conservatory']

/** A game with `hero` in `room` at (x, y), no intro. */
function at(room, x, y, { hero = 'kjell', flags = {}, inv = [] } = {}) {
  const g = new B.Game(B.CONTENT)
  g.resize(320, 200)
  g.s.hero = hero
  Object.assign(g.s.actors[hero], { room, x, y, face: 'down', pose: '' })
  Object.assign(g.s.flags, flags)
  for (const it of inv) g.ctx().give(it, hero)
  g.resume()
  g.drain()
  return g
}

const scriptErrors = []
const origError = console.error
console.error = (...a) => { if (String(a[0]).includes('[battery]')) scriptErrors.push(a.map(String).join(' ')); else origError(...a) }

/** Step until idle, answering choices in order (strict: every choice must be answered). */
function step(g, answers = [], { strict = true, seen } = {}) {
  const said = []
  const ids = []
  const queue = [...answers]
  for (let i = 0; i < 300 * 60; i++) {
    if (g.choice) {
      seen?.push(g.shownChoices().map(o => o.id))
      const id = queue.shift()
      if (!id || !g.chooseId(id)) {
        if (strict) throw new Error('no answer for ' + JSON.stringify(g.shownChoices().map(o => o.id)) + ' (wanted ' + id + ')')
        g.chooseId(g.shownChoices().at(-1).id)
      }
    }
    g.update(1 / 60)
    for (const e of g.drain()) {
      if (e.t === 'speak') said.push(`${e.who}: ${e.text}`)
      if (e.t === 'solve') ids.push(e.id)
      if (e.t === 'sfx') assert.ok(SFX.includes(e.name), 'unknown sfx ' + e.name)
    }
    if (g.idle && !g.choice) {
      assert.deepEqual(scriptErrors.splice(0), [], 'a script threw')
      return { said, ids, text: said.join('\n') }
    }
  }
  throw new Error('still busy')
}

function run(g, verb, a, b, answers, opts) {
  g.act(verb, a, b)
  return step(g, answers, opts)
}

const solved = (g, id) => !!g.s.flags['solved.' + id]

describe('ground floor rooms', () => {
  it('are on the ground floor, wide enough, with every hotspot inside the room and answering LOOK AT', () => {
    for (const id of GROUND) {
      const r = B.CONTENT.rooms[id]
      assert.equal(r.floor, 'ground')
      assert.ok(r.w >= 400, id + ' is too narrow')
      for (const h of r.hotspots) {
        assert.ok(h.verbs?.look || h.exit, `${id}/${h.id} has no LOOK AT`)
        const [x, y, w, hh] = h.rect
        assert.ok(x >= 0 && y >= 0 && x + w <= r.w && y + hh <= 144, `${id}/${h.id} rect is outside the room`)
        if (h.at && !h.far) assert.ok(B.walkMap(r).ok(h.at[0], h.at[1]), `${id}/${h.id} stands off the floor at ${h.at}`)
      }
    }
  })

  it('Kjell\'s start and every exit\'s arrival are on the floor', () => {
    assert.ok(B.walkMap(B.CONTENT.rooms.foyer).ok(220, 128), 'Kjell\'s start')
    for (const id of GROUND) {
      for (const h of B.CONTENT.rooms[id].hotspots) {
        if (!h.exit || h.exit.to === 'driveway') continue
        const to = B.CONTENT.rooms[h.exit.to]
        assert.ok(B.walkMap(to).ok(h.exit.x, h.exit.y), `${id}/${h.id} lands off the floor in ${h.exit.to}`)
      }
    }
  })

  it('every hotspot\'s LOOK AT runs without a script error, in every state we can think of', () => {
    const states = [{}, { [F.furnaceLit]: true, [F.gustavFed]: true, [F.junctionOpen]: true, [F.catMonocle]: true, [F.seanceDone]: true, 'kitchen.freezerOpen': true, 'kitchen.drawerOpen': true, 'kitchen.cupboardOpen': true, [F.stairsDown]: true, [F.frontDoorOpen]: true }]
    for (const flags of states) {
      for (const id of GROUND) {
        const r = B.CONTENT.rooms[id]
        const g = at(id, r.walk[0][0][0] + 30, 130, { flags })
        if (flags[F.catMonocle]) Object.assign(g.s.actors.cat, { room: 'kitchen', x: 352, y: 78, pose: 'monocle' })
        for (const h of g.hotspots()) {
          if (h.exit && !h.verbs?.look) continue
          const { said } = run(g, 'look', hs(h.id))
          assert.ok(said.length > 0, `${id}/${h.id} said nothing`)
        }
      }
    }
  })

  it('walks between the four rooms through their doors', () => {
    const g = at('foyer', 220, 128)
    run(g, null, hs('to-kitchen'))
    assert.equal(g.s.actors.kjell.room, 'kitchen')
    run(g, null, hs('to-foyer'))
    assert.equal(g.s.actors.kjell.room, 'foyer')
    run(g, null, hs('to-parlour'))
    assert.equal(g.s.actors.kjell.room, 'parlour')
    run(g, null, hs('to-foyer'))
    run(g, null, hs('to-conservatory'))
    assert.equal(g.s.actors.kjell.room, 'conservatory')
    run(g, null, hs('to-foyer'))
    assert.equal(g.s.actors.kjell.room, 'foyer')
  })
})

describe('the foyer', () => {
  it('the front door growls and stays shut until the house lets go', () => {
    const g = at('foyer', 220, 128)
    const r = run(g, 'open', hs('frontdoor'))
    assert.match(r.text, /growl/i)
    assert.equal(g.s.actors.kjell.room, 'foyer')
  })

  it('the umbrella comes off the coat rack', () => {
    const g = at('foyer', 220, 128)
    run(g, 'pickup', hs('umbrella'))
    assert.ok(g.s.inv.kjell.includes('umbrella'))
    assert.ok(!g.hotspots().some(h => h.id === 'umbrella'))
  })

  it('the armour only echoes', () => {
    const g = at('foyer', 220, 128)
    const r = run(g, 'talk', hs('armour'))
    assert.ok(r.said.some(l => l.startsWith('narrator:')), 'an echo')
  })

  it('USE clock key WITH clock runs the midnight strike', () => {
    const g = at('foyer', 220, 128, { inv: ['clockkey'] })
    const r = run(g, 'use', item('clockkey'), hs('clock'), [], { strict: false })
    assert.ok(r.said.length > 0)
    assert.ok((g.s.flags[F.midnightTries] ?? 0) >= 1 || r.ids.includes('midnight'), 'the strike ran')
  })
})

describe('the kitchen', () => {
  it('puzzle 1: OPEN the drawer, PICK UP the matches', () => {
    const g = at('kitchen', 200, 124)
    assert.ok(!g.hotspots().some(h => h.id === 'matches'), 'no matches while the drawer is shut')
    run(g, 'open', hs('drawer'))
    const r = run(g, 'pickup', hs('matches'))
    assert.ok(g.s.inv.kjell.includes('matches'))
    assert.ok(g.s.flags[F.matchesTaken])
    assert.deepEqual(r.ids, ['matches'])
    assert.ok(!g.hotspots().some(h => h.id === 'matches'))
  })

  it('puzzle 2: OPEN the cupboard, PICK UP the oil; the sardines are a gag the cat judges', () => {
    const g = at('kitchen', 200, 124)
    run(g, 'open', hs('cupboard'))
    const r = run(g, 'pickup', hs('oil'))
    assert.ok(g.s.inv.kjell.includes('oil'))
    assert.deepEqual(r.ids, ['oil'])
    const s = run(g, 'pickup', hs('sardines'))
    assert.ok(g.s.inv.kjell.includes('sardines'))
    assert.match(s.text, /looks at the sardines/i)
    assert.equal(g.s.actors.cat.pose, 'sleep', 'she goes back to sleep')
  })

  it('puzzle 9: the cat hisses at rabbits until she gets the monocle, then lets Kjell carry her', () => {
    const g = at('kitchen', 200, 124)
    let r = run(g, 'pickup', hs('cat'))
    assert.ok(!g.s.inv.kjell.includes('cat'))
    assert.equal(g.s.actors.cat.room, 'kitchen')
    assert.equal(g.s.actors.cat.pose, 'sleep')
    assert.match(r.text, /hiss|spat/i)
    r = run(g, 'talk', hs('cat'))
    assert.match(r.text, /hiss/i)
    run(g, 'give', item('sardines'), hs('cat')) // she hasn't got them: no error, just refused
    g.ctx().give('monocle')
    r = run(g, 'give', item('monocle'), hs('cat'))
    assert.ok(g.s.flags[F.catMonocle])
    assert.ok(!g.s.inv.kjell.includes('monocle'), 'she wears it now')
    assert.deepEqual([g.s.actors.cat.x, g.s.actors.cat.y, g.s.actors.cat.pose], [352, 78, 'monocle'])
    assert.ok(g.hotspots().some(h => h.id === 'cat-counter'))
    r = run(g, 'pickup', hs('cat-counter'))
    assert.ok(g.s.inv.kjell.includes('cat'))
    assert.equal(g.s.actors.cat.room, null)
    assert.deepEqual(r.ids, ['cat'])
    assert.ok(!g.hotspots().some(h => h.actor === 'cat'))
  })

  it('USE monocle WITH cat works as well as GIVE', () => {
    const g = at('kitchen', 200, 124, { inv: ['monocle'] })
    run(g, 'use', item('monocle'), hs('cat'))
    assert.ok(g.s.flags[F.catMonocle])
  })

  it('puzzle 19: the freezer is frozen shut until the furnace is lit, then gives up the gloves', () => {
    const g = at('kitchen', 200, 124)
    run(g, 'open', hs('freezer'))
    assert.ok(!g.s.flags['kitchen.freezerOpen'])
    assert.ok(!g.hotspots().some(h => h.id === 'gloves'))
    g.s.flags[F.furnaceLit] = true
    run(g, 'open', hs('freezer'))
    assert.ok(g.s.flags['kitchen.freezerOpen'])
    const r = run(g, 'pickup', hs('gloves'))
    assert.ok(g.s.inv.kjell.includes('gloves'))
    assert.ok(g.s.flags[F.glovesTaken])
    assert.deepEqual(r.ids, ['gloves'])
  })

  it('the dumbwaiter hatch explains itself and the bell reaches Dag', () => {
    const g = at('kitchen', 200, 124)
    const r = run(g, 'look', hs('hatch'))
    assert.match(r.text, /dumbwaiter/i)
    const b = run(g, 'pull', hs('bell'))
    assert.ok(b.said.some(l => l.startsWith('dag:')))
  })
})

describe('the conservatory', () => {
  it('Gustav snaps at the rabbit and talks only in HRRMM', () => {
    const g = at('conservatory', 200, 124)
    const r = run(g, 'talk', hs('gustav'), undefined, ['rabbit', 'key', 'hungry', 'pot', 'cable', 'bye'])
    const gus = r.said.filter(l => l.startsWith('gustav:'))
    assert.ok(gus.length >= 6)
    for (const l of gus) assert.match(l, /^gustav: H+R+M+[MP.?!…]*[.?!…]*( HR+M+[.?!…]*)*$/)
  })

  it('puzzle 18: GIVE the sandwich to Gustav, he burps up the clock key and sleeps', () => {
    const g = at('conservatory', 200, 124, { inv: ['sandwich'] })
    assert.ok(!g.hotspots().some(h => h.id === 'clockkey'))
    const r = run(g, 'give', item('sandwich'), hs('gustav'))
    assert.ok(!g.s.inv.kjell.includes('sandwich'))
    assert.ok(g.s.flags[F.gustavFed])
    assert.equal(g.s.actors.gustav.pose, 'sleep')
    assert.deepEqual(r.ids, ['gustav'])
    run(g, 'pickup', hs('clockkey'))
    assert.ok(g.s.inv.kjell.includes('clockkey'))
    assert.ok(g.s.flags[F.clockKeyTaken])
    assert.ok(!g.hotspots().some(h => h.id === 'clockkey'))
  })

  it('puzzle 20: the poker bridges the cut only with the box open, Gustav asleep and gloves on', () => {
    const g = at('conservatory', 200, 124, { inv: ['poker'] })
    let r = run(g, 'use', item('poker'), hs('junction'))
    assert.ok(!g.s.flags[F.junctionBridged], 'shut box')
    run(g, 'open', hs('junction'))
    assert.ok(g.s.flags[F.junctionOpen])
    r = run(g, 'use', item('poker'), hs('junction'))
    assert.ok(!g.s.flags[F.junctionBridged], 'Gustav is awake')
    assert.match(r.text, /Gustav/)
    g.s.flags[F.gustavFed] = true
    g.s.actors.gustav.pose = 'sleep'
    r = run(g, 'use', item('poker'), hs('junction'))
    assert.ok(!g.s.flags[F.junctionBridged], 'no gloves')
    assert.match(r.text, /Don't|rubber/)
    assert.ok(g.s.inv.kjell.includes('poker'))
    g.ctx().give('gloves')
    r = run(g, 'use', item('poker'), hs('junction'))
    assert.ok(g.s.flags[F.junctionBridged])
    assert.ok(!g.s.inv.kjell.includes('poker'), 'the poker stays in the box')
    assert.ok(g.s.inv.kjell.includes('gloves'))
    assert.deepEqual(r.ids, ['junction'])
    r = run(g, 'close', hs('junction'))
    assert.ok(g.s.flags[F.junctionOpen], 'it will not close round the poker')
  })

  it('the wet leather gloves are a red herring', () => {
    const g = at('conservatory', 200, 124)
    const r = run(g, 'pickup', hs('leathergloves'))
    assert.match(r.text, /lamp/)
    assert.ok(!g.s.inv.kjell.includes('gloves'))
  })
})

describe('the parlour', () => {
  it('Hedvig refuses Kjell as a spirit of the living, and her dialogue tree ends', () => {
    const g = at('parlour', 240, 128)
    const r = run(g, 'talk', hs('hedvig'), undefined, ['who', 'what', 'me', 'poker', 'prof', 'battery', 'bye'])
    assert.match(r.text, /not a SPIRIT of the living/)
    assert.match(r.text, /paperwork/i)
    assert.match(r.text, /chimney/i)
  })

  it('puzzle 16: Hedvig guards the poker until the séance is done', () => {
    const g = at('parlour', 240, 128)
    let r = run(g, 'pickup', hs('poker'))
    assert.ok(!g.s.inv.kjell.includes('poker'))
    assert.ok(r.said.some(l => l.startsWith('hedvig:')))
    g.s.flags[F.seanceDone] = true
    r = run(g, 'pickup', hs('poker'))
    assert.ok(g.s.inv.kjell.includes('poker'))
    assert.ok(g.s.flags[F.pokerTaken])
    assert.deepEqual(r.ids, ['poker'])
    assert.ok(!g.hotspots().some(h => h.id === 'poker'))
  })

  it('knowing about Sigurd does not help Kjell: the spirits must say it from above', () => {
    const g = at('parlour', 240, 128, { flags: { [F.lettersRead]: true } })
    const r = run(g, 'talk', hs('hedvig'), undefined, ['sigurd', 'bye'])
    assert.ok(!g.s.flags[F.seanceDone])
    assert.match(r.text, /From above/i)
  })
})

describe('the séance (Espen down the chimney)', () => {
  function seanceGame(flags = {}) {
    const g = at('storeroom', 150, 124, { hero: 'espen', flags })
    g.run(B.seance)
    return g
  }

  it('without the letters, Sigurd is not an option, and wrong answers can be retried', () => {
    const g = seanceGame()
    const seen = []
    const r = step(g, ['yes', 'olav', 'beardy', 'fluffy', 'later'], { seen })
    assert.ok(!g.s.flags[F.seanceDone])
    for (const opts of seen.slice(1)) assert.ok(!opts.includes('sigurd'))
    assert.match(r.text, /BROTHER/)
    assert.match(r.text, /birthday clown/)
    assert.ok(r.said.some(l => l.startsWith('hedvig:')))
    assert.ok(!g.s.flags['parlour.seanceLive'], 'the ball calms down')
    assert.equal(g.viewRoom, null, 'the view comes back to Espen')
  })

  it('with the letters read, "Sigurd" wins her over: the living may have the poker', () => {
    const g = seanceGame({ [F.lettersRead]: true })
    const r = step(g, ['ghost', 'olav', 'sigurd'])
    assert.ok(g.s.flags[F.seanceDone])
    assert.deepEqual(r.ids, ['seance'])
    assert.match(r.text, /poker/)
    assert.equal(g.viewRoom, null)
    // Again: no second solve.
    g.run(B.seance)
    const again = step(g)
    assert.deepEqual(again.ids, [])
  })

  it('then Kjell can take the poker', () => {
    const g = seanceGame({ [F.lettersRead]: true })
    step(g, ['yes', 'sigurd'])
    g.s.hero = 'kjell'
    Object.assign(g.s.actors.kjell, { room: 'parlour', x: 240, y: 128 })
    run(g, 'pickup', hs('poker'))
    assert.ok(solved(g, 'poker'))
  })
})

describe('the furnace warms the ground floor', () => {
  it('the first room Kjell enters after the furnace is lit says so, once', () => {
    const g = at('foyer', 220, 128, { flags: { [F.furnaceLit]: true } })
    let r = run(g, null, hs('to-kitchen'))
    assert.match(r.text, /radiators/)
    r = run(g, null, hs('to-foyer'))
    assert.doesNotMatch(r.text, /radiators/)
  })
})
