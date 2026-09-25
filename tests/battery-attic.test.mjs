// Night of the Dead Battery — the attic and roof (Espen's floor) through the
// real engine and content: the heavy trunk, the letters, the radio and
// Espen's ears, the monocle and the diary, Count Flapula and the jam, the
// dormer window, the lightning rod and its oil, the chimney's séance.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from './battery-load.mjs'
import { hs, item, settle, doing } from './battery-helpers.mjs'

let B
let F
let SFX
before(async () => {
  B = await load()
  F = B.F
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'themes/battery/content/sfx.ts'), 'utf8')
  SFX = [...src.slice(0, src.indexOf('as const')).matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1])
})

/** A game with Espen in `room` at (x, y), no intro. */
function espenIn(room, x, y, { flags = {}, inv = [] } = {}) {
  const g = new B.Game(B.CONTENT)
  g.resize(320, 200)
  g.s.hero = 'espen'
  Object.assign(g.s.actors.espen, { room, x, y, face: 'down', pose: '' })
  Object.assign(g.s.flags, flags)
  for (const it of inv) g.ctx().give(it, 'espen')
  g.resume()
  g.drain()
  return g
}

const solved = (g, id) => !!g.s.flags['solved.' + id]
const solves = events => events.filter(e => e.t === 'solve').map(e => e.id)

const scriptErrors = []
const origError = console.error
console.error = (...a) => { if (String(a[0]).includes('[battery]')) scriptErrors.push(a.map(String).join(' ')); else origError(...a) }

/** Act and settle, returning the lines and the solve ids that fired. */
function run(g, verb, a, b, opts) {
  const said = []
  const ids = []
  g.act(verb, a, b)
  for (let i = 0; i < 240 * 60; i++) {
    if (g.choice) {
      // The given answers in order; with none left, the last option (usually "bye").
      const id = opts?.answers?.shift()
      if (!id || !g.chooseId(id)) {
        if (opts?.strict) throw new Error('no answer for ' + JSON.stringify(g.shownChoices().map(o => o.id)))
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
      return { said, ids }
    }
  }
  throw new Error('still busy')
}

describe('attic rooms', () => {
  it('are at least 400 wide, on the attic floor, and every hotspot answers LOOK AT', () => {
    for (const id of ['storeroom', 'study', 'roof']) {
      const r = B.CONTENT.rooms[id]
      assert.equal(r.floor, 'attic')
      assert.ok(r.w >= 400, id + ' is too narrow')
      for (const h of r.hotspots) {
        assert.ok(h.verbs?.look || h.exit, `${id}/${h.id} has no LOOK AT`)
        const [x, y, w, hh] = h.rect
        assert.ok(x >= 0 && y >= 0 && x + w <= r.w && y + hh <= 144, `${id}/${h.id} rect is outside the room`)
      }
    }
  })
  it('have every stand-at point on the floor', () => {
    for (const id of ['storeroom', 'study', 'roof']) {
      const r = B.CONTENT.rooms[id]
      const m = B.walkMap(r)
      for (const h of r.hotspots) {
        if (!h.at || h.far) continue
        assert.ok(m.ok(h.at[0], h.at[1]), `${id}/${h.id} at ${h.at} is off the floor`)
      }
      for (const h of r.hotspots) if (h.exit) {
        const to = B.CONTENT.rooms[h.exit.to]
        assert.ok(B.walkMap(to).ok(h.exit.x, h.exit.y), `${id}/${h.id} arrives off the floor in ${h.exit.to}`)
      }
    }
  })
  it('lets Espen start where the intro drops him', () => {
    const r = B.CONTENT.rooms.storeroom
    assert.ok(B.walkMap(r).ok(150, 124))
  })
})

describe('storeroom', () => {
  it('the heavy trunk will not push, but pulls aside and opens the study door', () => {
    const g = espenIn('storeroom', 150, 124)
    let r = run(g, 'open', hs('door'))
    assert.equal(g.actor('espen').room, 'storeroom', 'the trunk blocks the door')
    r = run(g, 'push', hs('heavy-trunk'))
    assert.ok(!g.s.flags[F.trunkMoved])
    assert.match(r.said.join(' '), /budge/i)
    r = run(g, 'pull', hs('heavy-trunk'))
    assert.ok(g.s.flags[F.trunkMoved])
    assert.deepEqual(r.ids, ['trunk'])
    assert.equal(g.actor('espen').pose, '', 'the strain pose is cleared')
    run(g, null, hs('door'))
    assert.equal(g.actor('espen').room, 'study')
    run(g, null, hs('to-storeroom'))
    assert.equal(g.actor('espen').room, 'storeroom')
    assert.ok(g.hotspots().some(h => h.id === 'heavy-trunk-moved'))
  })

  it('opens the old trunk and takes the letters (solved once)', () => {
    const g = espenIn('storeroom', 150, 124)
    assert.ok(!g.hotspots().some(h => h.id === 'letters'))
    run(g, 'open', hs('letter-trunk'))
    const r = run(g, 'pickup', hs('letters'))
    assert.ok(g.s.inv.espen.includes('letters'))
    assert.ok(g.s.flags[F.lettersTaken])
    assert.deepEqual(r.ids, ['letters'])
    assert.ok(!g.hotspots().some(h => h.id === 'letters'), 'the bundle is gone from the trunk')
    const again = run(g, 'pickup', hs('letter-trunk'))
    assert.deepEqual(again.ids, [])
    // Reading them (items.ts) teaches Sigurd.
    const read = run(g, 'look', item('letters'))
    assert.ok(g.s.flags[F.lettersRead])
    assert.match(read.said.join(' '), /Sigurd/)
  })

  it('the radio: no antenna, so Espen\'s ear wire becomes one, and the forecast says midnight', () => {
    const g = espenIn('storeroom', 150, 124)
    const r = run(g, 'use', hs('radio'))
    assert.ok(g.s.flags[F.earsFlop], 'the ears flop now')
    assert.ok(g.s.flags[F.radioHeard])
    const text = r.said.join(' ')
    assert.match(text, /ears/i)
    assert.match(text, /narrator: .*stroke of midnight/i)
    const again = run(g, 'use', hs('radio'))
    assert.match(again.said.join(' '), /midnight/i)
  })

  it('the mannequin interview is a dialogue that ends', () => {
    const g = espenIn('storeroom', 150, 124)
    const r = run(g, 'talk', hs('mannequin'), undefined, { answers: ['name', 'knock', 'fans', 'bye'], strict: true })
    assert.match(r.said.join(' '), /Margit/)
  })

  it('every hotspot survives every verb and the EMF meter', () => {
    for (const [room, x, y, flags] of [
      ['storeroom', 150, 124, {}], ['storeroom', 150, 124, { [F.trunkMoved]: true, 'storeroom.lettersOpen': true }],
      ['study', 200, 120, {}], ['study', 200, 120, { [F.batFed]: true, [F.windowOpen]: true, 'study.drawerOpen': true }],
      ['roof', 100, 120, {}], ['roof', 100, 120, { [F.rodUp]: true, [F.socketOiled]: true }],
    ]) {
      const base = espenIn(room, x, y, { flags })
      for (const h of base.hotspots()) {
        if (h.exit) continue
        for (const v of ['look', 'pickup', 'use', 'open', 'push', 'close', 'talk', 'pull']) {
          const g = espenIn(room, x, y, { flags: { ...flags } })
          g.s.actors.bat.room = 'study'
          if (flags[F.batFed]) Object.assign(g.s.actors.bat, { x: 214, y: 13, pose: 'rafter' })
          run(g, v, hs(h.id), undefined, { answers: ['bye', 'bye', 'bye'] })
        }
        const g = espenIn(room, x, y, { flags: { ...flags }, inv: ['emf'] })
        run(g, 'use', item('emf'), hs(h.id))
      }
    }
  })
})

describe('study', () => {
  it('the drawer holds the monocle', () => {
    const g = espenIn('study', 60, 120)
    assert.ok(!g.hotspots().some(h => h.id === 'monocle'))
    run(g, 'open', hs('drawer'))
    const r = run(g, 'pickup', hs('monocle'))
    assert.ok(g.s.inv.espen.includes('monocle'))
    assert.ok(g.s.flags[F.monocleTaken])
    assert.deepEqual(r.ids, ['monocle'])
    run(g, 'close', hs('drawer'))
    run(g, 'open', hs('drawer'))
    assert.ok(!g.hotspots().some(h => h.id === 'monocle'))
  })

  it('the diary names the transmogrifier and nine lives, solved once', () => {
    const g = espenIn('study', 60, 120)
    const r = run(g, 'look', hs('diary'))
    assert.ok(g.s.flags[F.diaryRead])
    assert.deepEqual(r.ids, ['diary'])
    const text = r.said.join(' ')
    assert.match(text, /Test tonight\. Subject: me\. Target: something with nine lives, just in case\./)
    const again = run(g, 'look', hs('diary'))
    assert.deepEqual(again.ids, [])
  })

  it('the window will not open while the Count hangs on the latch', () => {
    const g = espenIn('study', 60, 120)
    run(g, 'open', hs('window'))
    assert.ok(!g.s.flags[F.windowOpen])
    assert.equal(g.actor('espen').room, 'study')
  })

  it('the Count refuses a closed jar, takes an open one, and the window opens onto the roof', () => {
    const g = espenIn('study', 60, 120, { inv: ['jam'] })
    const talk = run(g, 'talk', hs('bat'), undefined, { answers: ['blood', 'veg', 'bye'], strict: true })
    assert.match(talk.said.join(' '), /large rabbit/i)
    let r = run(g, 'give', item('jam'), hs('bat'))
    assert.match(r.said.join(' '), /GLASS/)
    assert.ok(!g.s.flags[F.batFed])
    assert.ok(g.s.inv.espen.includes('jam'))
    g.s.flags[F.jamOpen] = true
    r = run(g, 'give', item('jam'), hs('bat'))
    assert.match(r.said.join(' '), /It's red\. That will do\./)
    assert.ok(g.s.flags[F.batFed])
    assert.ok(!g.s.inv.espen.includes('jam'), 'the Count has the jar')
    assert.deepEqual(r.ids, ['bat'])
    const bat = g.actor('bat')
    assert.equal(bat.pose, 'rafter')
    assert.ok(bat.y < 30, 'he is up on a rafter')
    assert.ok(g.hotspots().some(h => h.id === 'bat-rafter'))
    r = run(g, 'open', hs('window'))
    assert.ok(g.s.flags[F.windowOpen])
    assert.deepEqual(r.ids, ['window'])
    run(g, null, hs('window-out'))
    assert.equal(g.actor('espen').room, 'roof')
    run(g, null, hs('window-in'))
    assert.equal(g.actor('espen').room, 'study')
  })
})

describe('roof', () => {
  it('the rod is rusted solid until the socket is oiled', () => {
    const g = espenIn('roof', 100, 120, { inv: ['oil'] })
    let r = run(g, 'pull', hs('rod'))
    assert.ok(!g.s.flags[F.rodUp])
    assert.match(r.said.join(' '), /rusted solid/i)
    run(g, 'use', hs('rod'))
    assert.ok(!g.s.flags[F.rodUp])
    r = run(g, 'use', item('oil'), hs('socket'))
    assert.ok(g.s.flags[F.socketOiled])
    assert.ok(!g.s.inv.espen.includes('oil'), 'the oil is used up')
    r = run(g, 'pull', hs('rod'))
    assert.ok(g.s.flags[F.rodUp])
    assert.deepEqual(r.ids, ['rod'])
    assert.ok(g.hotspots().some(h => h.id === 'rod-up'))
    const a = g.actor('espen')
    assert.deepEqual([Math.round(a.x), Math.round(a.y)], [326, 118], 'he stands where the finale expects him')
  })

  it('oil works on the rod itself too', () => {
    const g = espenIn('roof', 100, 120, { inv: ['oil'] })
    run(g, 'use', item('oil'), hs('rod'))
    assert.ok(g.s.flags[F.socketOiled])
    run(g, 'use', hs('rod'))
    assert.ok(g.s.flags[F.rodUp])
  })

  it('the chimney carries the séance down to the parlour', () => {
    const g = espenIn('roof', 100, 120)
    const chimney = g.hotspot('chimney')
    assert.ok(chimney?.verbs?.talk, 'TALK TO chimney exists')
    assert.equal(chimney.default, 'talk')
    const look = run(g, 'look', hs('chimney'))
    assert.match(look.said.join(' '), /humming/i)
    // The séance is the parlour's (ground floor): without the letters there is no Sigurd.
    let r = run(g, 'talk', hs('chimney'), undefined, { answers: ['yes', 'olav', 'later'], strict: true })
    assert.ok(!g.s.flags[F.seanceDone])
    assert.match(r.said.join(' '), /hedvig: /)
    g.s.flags[F.lettersRead] = true
    r = run(g, 'talk', hs('chimney'), undefined, { answers: ['yes', 'sigurd'], strict: true })
    assert.ok(g.s.flags[F.seanceDone])
    assert.deepEqual(r.ids, ['seance'])
    assert.equal(g.actor('espen').room, 'roof', 'the view comes back to the roof')
    assert.equal(g.viewRoom, null)
  })

  it('Espen cannot walk off the roof', () => {
    const r = B.CONTENT.rooms.roof
    const m = B.walkMap(r)
    for (let y = 0; y < 144; y += 2) {
      assert.ok(!m.ok(440, y), 'past the edge at y ' + y)
      assert.ok(!m.ok(200, y) || (y >= 106 && y <= 134), 'on the slates at y ' + y)
    }
  })
})

describe('Espen\'s floor, start to finish', () => {
  it('trunk, study, monocle, diary, letters, radio, the Count, the window, the rod and the séance', () => {
    const g = espenIn('storeroom', 150, 124, { inv: ['emf'] })
    const all = []
    const go = (...a) => { const r = run(g, ...a); all.push(...r.ids); return r }
    go('open', hs('letter-trunk'))
    go('pickup', hs('letters'))
    go('look', item('letters'))
    go('use', hs('radio'))
    go('pull', hs('heavy-trunk'))
    go(null, hs('door'))
    assert.equal(g.actor('espen').room, 'study')
    go('open', hs('drawer'))
    go('pickup', hs('monocle'))
    go('look', hs('diary'))
    // The monocle goes down to Kjell; the open jam comes up from Dag.
    go('give', item('monocle'), { kind: 'hero', id: 'kjell' })
    assert.ok(g.s.inv.kjell.includes('monocle'))
    g.s.flags[F.jamOpen] = true
    g.ctx().give('jam', 'dag')
    g.s.hero = 'dag'
    go('give', item('jam'), { kind: 'hero', id: 'espen' })
    g.s.hero = 'espen'
    assert.ok(g.s.inv.espen.includes('jam'))
    go('give', item('jam'), hs('bat'))
    go('open', hs('window'))
    go(null, hs('window-out'))
    assert.equal(g.actor('espen').room, 'roof')
    g.ctx().give('oil', 'espen')
    go('use', item('oil'), hs('socket'))
    go('pull', hs('rod'))
    const r = run(g, 'talk', hs('chimney'), undefined, { answers: ['yes', 'sigurd'], strict: true })
    all.push(...r.ids)
    assert.deepEqual(all.sort(), ['bat', 'diary', 'letters', 'monocle', 'rod', 'seance', 'trunk', 'window'])
    for (const f of [F.trunkMoved, F.monocleTaken, F.diaryRead, F.lettersRead, F.lettersTaken, F.batFed, F.windowOpen, F.socketOiled, F.rodUp, F.radioHeard, F.earsFlop, F.seanceDone]) {
      assert.ok(g.s.flags[f], f)
    }
    const a = g.actor('espen')
    assert.deepEqual([Math.round(a.x), Math.round(a.y), g.actor('espen').room], [168, 118, 'roof'], 'by the chimney')
  })
})
