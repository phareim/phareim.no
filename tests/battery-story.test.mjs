// Night of the Dead Battery — the story: the intro, the midnight strike
// (each missing piece named, then the clock resets), the finale to the end,
// and the portrait hints at every stage of the game.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from './battery-load.mjs'
import { hs, item, hero, settle } from './battery-helpers.mjs'

let B
before(async () => { B = await load() })

const here = dirname(fileURLToPath(import.meta.url))
const sfxSrc = readFileSync(join(here, '..', 'themes', 'battery', 'content', 'sfx.ts'), 'utf8')
const SFX = new Set([...sfxSrc.slice(0, sfxSrc.indexOf('] as const')).matchAll(/'([a-z-]+)'/g)].map(m => m[1]))
const MUSIC = new Set([...sfxSrc.slice(sfxSrc.indexOf('export const MUSIC')).matchAll(/'([a-z-]+)'/g)].map(m => m[1]))

/** Run until idle, collecting lines, sounds and music; fails on unknown sounds. */
function run(g, max = 600) {
  const said = []
  const sfx = []
  for (let i = 0; i < max * 60; i++) {
    g.update(1 / 60)
    for (const e of g.drain()) {
      if (e.t === 'speak') said.push(`${e.who}: ${e.text}`)
      if (e.t === 'sfx') { sfx.push(e.name); assert.ok(SFX.has(e.name), 'unknown sfx ' + e.name) }
      if (e.t === 'music' && e.name) assert.ok(MUSIC.has(e.name), 'unknown music ' + e.name)
    }
    if ((g.idle || (g.ended && !g.running)) && !g.choice) return { said, sfx }
  }
  throw new Error('still busy after ' + max + ' s')
}

/** Every line fits the speech rules: three wrapped lines at most, font characters only. */
function checkLines(said) {
  for (const l of said) {
    const text = l.slice(l.indexOf(': ') + 2)
    assert.ok(text.length <= 110, 'line too long: ' + text)
    assert.match(text.toUpperCase(), /^[A-Z0-9 .,!?'":;\-+/()%&*#=<>_ÆØÅ…’—]*$/, 'odd character in: ' + text)
  }
}

const ALL = ['rod.up', 'junction.bridged', 'lever.armed', 'cat.booth']

function atClock(flags) {
  const g = new B.Game(B.CONTENT)
  g.s.flags['visited.foyer'] = true
  for (const f of flags) g.s.flags[f] = true
  g.s.inv.kjell.push('clockkey')
  g.s.flags[B.F.clockKeyTaken] = true
  Object.assign(g.s.actors.kjell, { room: 'foyer', x: 106, y: 110 })
  g.resume()
  g.drain()
  return g
}

describe('the intro', () => {
  it('runs to idle and leaves everyone at their start, Kjell current', () => {
    const g = new B.Game(B.CONTENT)
    g.begin()
    const { said, sfx } = run(g, 300)
    assert.equal(g.s.hero, 'kjell')
    for (const h of ['kjell', 'dag', 'espen']) {
      const a = g.s.actors[h]
      const st = B.CONTENT.heroes[h].start
      assert.equal(a.room, st.room, h + ' room')
      assert.equal(a.x, st.x, h + ' x')
      assert.equal(a.y, st.y, h + ' y')
      assert.equal(a.visible, true, h + ' visible')
    }
    assert.equal(g.viewRoom, null)
    assert.equal(g.split, null)
    assert.ok(!g.s.flags[B.F.stairsDown], 'the stairs are folded up')
    assert.ok(!g.s.flags[B.F.frontDoorOpen], 'the door is shut')
    assert.ok(!g.s.flags['foyer.trapOpen'] && !g.s.flags['storeroom.hatchOpen'], 'trapdoor and hatch shut again')
    assert.ok(said.some(l => /jam down here/i.test(l)), 'Dag finds the jam')
    assert.ok(said.some(l => /dumbwaiter/i.test(l)), 'the dumbwaiter is explained')
    assert.ok(sfx.includes('car-click'))
    checkLines(said)
  })

  it('can be clicked through quickly', () => {
    const g = new B.Game(B.CONTENT)
    g.resize(320, 200)
    g.begin()
    let t = 0
    for (; t < 200 * 60 && !(g.idle && t > 10); t++) {
      if (t % 20 === 0) g.key('.')
      g.update(1 / 60)
      g.drain()
    }
    assert.ok(t / 60 < 75, 'skipping every line takes ' + (t / 60).toFixed(1) + ' s')
    assert.equal(g.s.actors.kjell.room, 'foyer')
  })
})

describe('midnight', () => {
  it('USE clock key WITH the foyer clock runs the midnight strike (the import ring is harmless)', () => {
    const g = atClock([])
    const hsClock = B.CONTENT.rooms.foyer.hotspots.find(h => h.id === 'clock')
    assert.ok(hsClock, 'the foyer has a clock')
    g.act('use', item('clockkey'), hs('clock'))
    const { sfx } = run(g)
    assert.equal(g.s.flags[B.F.midnightTries], 1)
    assert.ok(sfx.includes('clock-wind') && sfx.includes('clock-chime'))
  })

  const cases = [
    ['rod.up', /rod|rooster|vane/i],
    ['junction.bridged', /cable|junction|cut/i],
    ['lever.armed', /arm/i],
    ['cat.booth', /booth/i],
  ]
  for (const [missing, re] of cases) {
    it(`without ${missing} it names it and clicks back to 11:59`, () => {
      const g = atClock(ALL.filter(f => f !== missing))
      g.act('use', item('clockkey'), hs('clock'))
      const { said } = run(g)
      assert.ok(said.some(l => re.test(l)), `names ${missing}: ${said.join(' | ')}`)
      assert.ok(said.some(l => /11:59/.test(l)))
      assert.equal(g.s.flags[B.F.midnightTries], 1)
      assert.ok(!g.s.flags[B.F.won] && !g.s.flags[B.F.struck])
      assert.ok(g.s.inv.kjell.includes('clockkey'), 'Kjell keeps the key')
      assert.equal(g.viewRoom, null)
      assert.equal(g.ended, false)
      assert.equal(g.s.flags['midnight.fail'], undefined)
      checkLines(said)
    })
  }

  it('names the first missing piece, top of the house down', () => {
    const g = atClock([])
    g.act('use', item('clockkey'), hs('clock'))
    const { said } = run(g)
    assert.ok(said.some(l => /rod|rooster/i.test(l)))
    g.act('use', item('clockkey'), hs('clock'))
    run(g)
    assert.equal(g.s.flags[B.F.midnightTries], 2)
  })

  it('with everything in place: the finale, the credits, the end', () => {
    const g = atClock(ALL)
    Object.assign(g.s.actors.cat, { room: 'lab', x: 340, y: 110, pose: 'booth' })
    g.act('use', item('clockkey'), hs('clock'))
    const { said, sfx } = run(g, 900)
    assert.equal(g.ended, true)
    for (const f of [B.F.won, B.F.struck, B.F.batteryOut, B.F.stairsDown, B.F.frontDoorOpen, 'solved.midnight']) assert.ok(g.s.flags[f], f)
    assert.equal(g.s.actors.professor.visible, true)
    assert.equal(g.s.actors.cat.visible, false)
    assert.ok(said.some(l => /^professor:/.test(l) && /monocle/i.test(l)), 'she keeps the monocle')
    assert.ok(said.some(l => /episode twelve/i.test(l)))
    assert.ok(sfx.includes('car-start') && sfx.includes('machine-charge'))
    checkLines(said)
  })
})

describe('hints', () => {
  const PAIRS = [['kjell', 'dag'], ['kjell', 'espen'], ['dag', 'kjell'], ['dag', 'espen'], ['espen', 'kjell'], ['espen', 'dag']]
  const F = () => B.F

  // The game, step by step: each stage adds to the one before.
  const stages = [
    ['start', () => {}, /kitchen|drawer|pull|trunk/i],
    ['matches', (s) => { s.flags[F().matchesTaken] = true; give(s, 'matches', 'kjell') }, /send|match|manual|dry/i],
    ['sent', (s) => { give(s, 'matches', 'dag'); give(s, 'manual', 'dag') }, /manual|dry|kindling/i],
    ['kindling', (s) => { s.flags[F().furnaceKindling] = true; take(s, 'manual') }, /match/i],
    ['furnace', (s) => { s.flags[F().furnaceLit] = true; take(s, 'matches') }, /bones|butler/i],
    ['bones', (s) => { s.flags[F().bonesKey] = true; give(s, 'labkey', 'dag') }, /key|door/i],
    ['lab', (s) => { s.flags[F().labOpen] = true }, /jam|lid/i],
    ['jam', (s) => { s.flags[F().jamOpen] = true; s.flags[F().dagAte] = true; give(s, 'jam', 'dag') }, null],
    ['trunk', (s) => { s.flags[F().trunkMoved] = true }, null],
    ['monocle', (s) => { s.flags[F().monocleTaken] = true; give(s, 'monocle', 'espen') }, null],
    ['diary', (s) => { s.flags[F().diaryRead] = true }, null],
    ['monocle sent', (s) => { give(s, 'monocle', 'kjell') }, null],
    ['cat', (s) => { s.flags[F().catMonocle] = true; take(s, 'monocle') }, null],
    ['cat held', (s) => { give(s, 'cat', 'kjell') }, null],
    ['cat sent', (s) => { give(s, 'cat', 'dag') }, null],
    ['booth', (s) => { s.flags[F().catInBooth] = true; take(s, 'cat') }, null],
    ['lever', (s) => { s.flags[F().leverArmed] = true }, null],
    ['jam sent', (s) => { give(s, 'jam', 'espen') }, null],
    ['bat', (s) => { s.flags[F().batFed] = true; take(s, 'jam') }, null],
    ['window', (s) => { s.flags[F().windowOpen] = true }, null],
    ['oil', (s) => { s.flags[F().oilTaken] = true; give(s, 'oil', 'kjell') }, null],
    ['oil sent', (s) => { give(s, 'oil', 'espen') }, null],
    ['socket', (s) => { s.flags[F().socketOiled] = true; take(s, 'oil') }, null],
    ['rod', (s) => { s.flags[F().rodUp] = true }, null],
    ['letters', (s) => { s.flags[F().lettersRead] = true; s.flags[F().lettersTaken] = true; give(s, 'letters', 'espen') }, null],
    ['seance', (s) => { s.flags[F().seanceDone] = true }, null],
    ['poker', (s) => { s.flags[F().pokerTaken] = true; give(s, 'poker', 'kjell') }, null],
    ['sandwich', (s) => { give(s, 'sandwich', 'kjell') }, null],
    ['gustav', (s) => { s.flags[F().gustavFed] = true; take(s, 'sandwich') }, null],
    ['clockkey', (s) => { s.flags[F().clockKeyTaken] = true; give(s, 'clockkey', 'kjell') }, null],
    ['gloves', (s) => { s.flags[F().glovesTaken] = true; give(s, 'gloves', 'kjell') }, null],
    ['junction', (s) => { s.flags[F().junctionOpen] = true; s.flags[F().junctionBridged] = true }, /clock|midnight/i],
    ['won', (s) => { s.flags[F().struck] = true; s.flags[F().won] = true }, null],
  ]
  function give(s, it, h) { take(s, it); s.inv[h].push(it) }
  function take(s, it) { for (const h of ['kjell', 'dag', 'espen']) s.inv[h] = s.inv[h].filter(i => i !== it) }

  it('every pair has something to say at every stage, nudging first and plain second', () => {
    const g = new B.Game(B.CONTENT)
    const talks = new Set()
    for (const [name, setup, re] of stages) {
      setup(g.s)
      for (const [a, b] of PAIRS) {
        g.s.hero = a
        g.act('talk', hero(b))
        const first = settle(g)
        assert.ok(first.length >= 2, `${name} ${a}->${b}: ${first.join(' | ')}`)
        checkLines(first)
        talks.add(first.slice(1).join('|'))
        if (re && a === 'kjell' && b === 'dag') assert.ok(first.some(l => re.test(l)), `${name} ${a}->${b}: ${first.join(' | ')}`)
      }
    }
    assert.ok(talks.size > 40, 'the hints vary: ' + talks.size)
  })

  it('a second talk about the same step is plainer', () => {
    const g = new B.Game(B.CONTENT)
    g.act('talk', hero('dag'))
    const first = settle(g)
    g.act('talk', hero('dag'))
    const second = settle(g)
    assert.ok(second.some(l => /drawer/i.test(l)), second.join(' | '))
    assert.notDeepEqual(first.slice(1), second.slice(1))
  })

  it('a portrait answers LOOK AT for every pair', () => {
    const g = new B.Game(B.CONTENT)
    for (const [a, b] of PAIRS) {
      g.s.hero = a
      g.act('look', hero(b))
      const said = settle(g)
      assert.equal(said.length, 1)
      checkLines(said)
    }
  })
})
