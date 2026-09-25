// Night of the Dead Battery — the whole game, from a new game to the
// credits, the way a player would solve it: every step is a SCUMM sentence
// (verb, item, thing) or a door, with hero switches and dumbwaiter sends.
// Plus the level checks: every stand-at point and door arrival is on the
// floor, every hotspot answers LOOK AT, and every sfx name is known.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './battery-load.mjs'
import { hs, item, hero, settle } from './battery-helpers.mjs'

let B
before(async () => { B = await load() })

describe('the whole game', () => {
  it('can be played from the intro to the credits', () => {
    const g = new B.Game(B.CONTENT)
    g.resize(320, 200)
    const log = []
    const sfx = new Set()
    const solved = []
    const pump = (opts) => {
      return settle(g, { max: 400, ...opts })
    }
    // settle() drains events; keep the ones we check.
    const origDrain = g.drain.bind(g)
    g.drain = () => {
      const ev = origDrain()
      for (const e of ev) {
        if (e.t === 'sfx') sfx.add(e.name)
        if (e.t === 'solve') solved.push(e.id)
        if (e.t === 'speak') log.push(`${e.who}: ${e.text}`)
      }
      return ev
    }
    const step = (verb, a, b, opts) => {
      try {
        g.act(verb, a, b)
        return pump(opts)
      } catch (e) {
        throw new Error(`${g.hero} in ${g.room}: ${verb} ${JSON.stringify(a)} ${b ? JSON.stringify(b) : ''}: ${e.message}\n--- last lines:\n${log.slice(-8).join('\n')}`)
      }
    }
    const go = id => step(null, hs(id))
    const as = id => { g.switchHero(id); pump() }
    const has = (h, it) => assert.ok(g.s.inv[h].includes(it), `${h} should have ${it}; has ${g.s.inv[h].join(', ')}\n${log.slice(-6).join('\n')}`)
    const flag = f => assert.ok(g.s.flags[f], `flag ${f} should be set\n${log.slice(-6).join('\n')}`)

    g.begin()
    pump()
    assert.equal(g.hero, 'kjell')
    assert.equal(g.room, 'foyer')

    // Kjell: matches and oil from the kitchen; the manual and matches down to Dag, the oil up to Espen.
    go('to-kitchen')
    step('open', hs('drawer')); step('pickup', hs('matches')); has('kjell', 'matches')
    step('open', hs('cupboard')); step('pickup', hs('oil')); has('kjell', 'oil')
    step('give', item('manual'), hero('dag'))
    step('give', item('matches'), hero('dag'))
    step('give', item('oil'), hero('espen'))

    // Espen: the trunk, the study, the monocle and the diary; the letters.
    as('espen')
    step('push', hs('heavy-trunk'))
    assert.ok(!g.s.flags[B.F.trunkMoved], 'pushing the trunk does nothing')
    step('pull', hs('heavy-trunk')); flag(B.F.trunkMoved)
    go('door')
    step('open', hs('drawer')); step('pickup', hs('monocle')); has('espen', 'monocle')
    step('look', hs('diary')); flag(B.F.diaryRead)
    step('give', item('monocle'), hero('kjell'))
    go('to-storeroom')
    step('open', hs('letter-trunk')); step('pickup', hs('letters')); has('espen', 'letters')
    step('look', item('letters')); flag(B.F.lettersRead)

    // Kjell: the monocle for the cat, the cat down to Dag.
    as('kjell')
    step('give', item('monocle'), hs('cat')); flag(B.F.catMonocle)
    step('pickup', hs('cat-counter')); has('kjell', 'cat')
    step('give', item('cat'), hero('dag'))

    // Dag: jam, the furnace, Mr Bones' key, the jar, the lab, the booth, the lever.
    as('dag')
    step('pickup', hs('jam')); has('dag', 'jam')
    step('give', item('sandwich'), hero('kjell'))
    has('dag', 'sandwich') // not before the jam
    go('to-boiler')
    step('use', item('matches'), hs('furnace'))
    has('dag', 'matches') // the damp coal would waste it
    step('use', item('manual'), hs('furnace'))
    step('use', item('matches'), hs('furnace')); flag(B.F.furnaceLit)
    step('talk', hs('bones'), undefined, { answers: ['bye'] })
    has('dag', 'labkey')
    step('use', item('jam'), hs('furnace')); flag(B.F.jamOpen)
    step('use', item('labkey'), hs('labdoor')); flag(B.F.labOpen)
    go('labdoor')
    step('use', item('cat'), hs('booth')); flag(B.F.catInBooth)
    step('pull', hs('lever')); flag(B.F.leverArmed)
    step('give', item('jam'), hero('espen')); has('espen', 'jam')
    step('give', item('sandwich'), hero('kjell')); has('kjell', 'sandwich')

    // Espen: the Count, the window, the roof, the rod, the séance.
    as('espen')
    go('door')
    step('give', item('jam'), hs('bat')); flag(B.F.batFed)
    step('open', hs('window')); flag(B.F.windowOpen)
    go('window-out')
    assert.equal(g.room, 'roof')
    step('pull', hs('rod'))
    assert.ok(!g.s.flags[B.F.rodUp], 'rusted solid without oil')
    step('use', item('oil'), hs('socket'))
    step('pull', hs('rod')); flag(B.F.rodUp)
    step('talk', hs('chimney'), undefined, { answers: ['yes', 'sigurd'] }); flag(B.F.seanceDone)

    // Kjell: the poker, the gloves, Gustav, the junction, midnight.
    as('kjell')
    go('to-foyer'); go('to-parlour')
    step('pickup', hs('poker')); has('kjell', 'poker')
    go('to-foyer'); go('to-kitchen')
    step('open', hs('freezer')); step('pickup', hs('gloves')); has('kjell', 'gloves')
    go('to-foyer'); go('to-conservatory')
    step('give', item('sandwich'), hs('gustav')); flag(B.F.gustavFed)
    step('pickup', hs('clockkey')); has('kjell', 'clockkey')
    step('open', hs('junction'))
    step('use', item('poker'), hs('junction')); flag(B.F.junctionBridged)
    go('to-foyer')
    g.act('use', item('clockkey'), hs('clock'))
    for (let i = 0; i < 60 * 900 && !g.ended; i++) {
      if (g.choice) g.chooseId(g.shownChoices()[0].id)
      g.update(1 / 60)
      g.drain()
    }
    assert.ok(g.ended, 'the credits ran to the end\n' + log.slice(-10).join('\n'))
    flag(B.F.won)
    const want = ['matches', 'oil', 'furnace', 'bones-key', 'lab', 'jam', 'trunk', 'monocle', 'diary', 'cat', 'booth', 'bat', 'window', 'rod', 'letters', 'seance', 'poker', 'gustav', 'gloves', 'junction', 'lever', 'midnight']
    assert.deepEqual([...new Set(solved)].sort(), [...want].sort(), 'every puzzle solved once')
    assert.equal(solved.length, new Set(solved).size, 'no puzzle solved twice')
    assert.equal(B.solvedCount(g.s), B.SOLVE_COUNT)
    for (const n of sfx) assert.ok(B.SFX.includes(n), `unknown sfx ${n}`)
  })
})

describe('the level', () => {
  it('puts every stand-at point, door arrival and start on the floor', () => {
    const bad = []
    for (const r of Object.values(B.CONTENT.rooms)) {
      const m = B.walkMap(r)
      for (const h of r.hotspots) {
        if (h.at && !h.far && !h.exit && !m.ok(h.at[0], h.at[1])) bad.push(`${r.id}.${h.id} at ${h.at}`)
        if (h.exit) {
          const t = B.walkMap(B.CONTENT.rooms[h.exit.to])
          if (!t.ok(h.exit.x, h.exit.y)) bad.push(`${r.id}.${h.id} arrives off the floor in ${h.exit.to}`)
        }
      }
    }
    for (const [id, h] of Object.entries(B.CONTENT.heroes)) if (!B.walkMap(B.CONTENT.rooms[h.start.room]).ok(h.start.x, h.start.y)) bad.push(`${id} start`)
    assert.deepEqual(bad, [])
  })
  it('answers LOOK AT on every hotspot and item, with a line that fits the font', () => {
    const g = new B.Game(B.CONTENT)
    g.resize(320, 200)
    const missing = []
    for (const r of Object.values(B.CONTENT.rooms)) for (const h of r.hotspots) if (!h.exit && !h.verbs?.look) missing.push(`${r.id}.${h.id}`)
    for (const it of Object.values(B.CONTENT.items)) if (!it.look) missing.push(it.id)
    assert.deepEqual(missing, [])
  })

  it('answers every verb on every hotspot without an error, in lines the font can draw', () => {
    const floorHero = { ground: 'kjell', cellar: 'dag', attic: 'espen', outside: 'kjell' }
    const verbs = ['look', 'pickup', 'use', 'open', 'close', 'push', 'pull', 'talk', 'give']
    const unknown = new Set()
    const tooLong = []
    const errors = []
    const origError = console.error
    console.error = (...a) => errors.push(a.map(String).join(' ').slice(0, 200))
    const q = B.glyphRows('?').join('')
    try {
      for (const r of Object.values(B.CONTENT.rooms)) {
        for (const h of r.hotspots) {
          if (h.exit) continue
          for (const verb of verbs) {
            const g = new B.Game(B.CONTENT)
            g.resize(320, 200)
            const hero = floorHero[r.floor]
            g.s.hero = hero
            const a = g.s.actors[hero]
            a.room = r.id
            const m = B.walkMap(r)
            const [x, y] = B.nearestWalkable(m, r.w / 2, 124)
            a.x = x; a.y = y
            g.resume()
            if (h.when && !h.when(g.s)) continue
            g.act(verb, hs(h.id))
            for (let i = 0; i < 60 * 120 && !(g.idle && !g.choice); i++) {
              if (g.choice) { const o = g.shownChoices(); g.chooseId(o[o.length - 1].id) }
              g.update(1 / 60)
              for (const e of g.drain()) {
                if (e.t !== 'speak') continue
                for (const ch of e.text.toUpperCase()) if (ch !== '?' && B.glyphRows(ch).join('') === q) unknown.add(ch)
                if (B.wrapText(e.text.toUpperCase(), 210).length > 4) tooLong.push(`${r.id}.${h.id} ${verb}: ${e.text.slice(0, 60)}…`)
              }
            }
          }
        }
      }
    } finally {
      console.error = origError
    }
    assert.deepEqual(errors, [], 'no script errors')
    assert.deepEqual([...unknown], [], 'characters the pixel font does not have')
    assert.ok(tooLong.length <= 3, 'lines longer than four wrapped rows:\n' + tooLong.join('\n'))
  })
})

