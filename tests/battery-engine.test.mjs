// Night of the Dead Battery — the engine on its own, with a tiny made-up
// house: walking round furniture, the SCUMM sentence, scripts and choices,
// the dumbwaiter, the layouts and saves.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './battery-load.mjs'
import { hs, item, hero, settle, doing } from './battery-helpers.mjs'

let B
before(async () => { B = await load() })

const fail = { give: ['no'], pickup: ['no'], use: ['no'], open: ['no'], look: ['hm'], push: ['no'], close: ['no'], talk: ['no'], pull: ['no'] }
function heroDef(id, floor, room) {
  return { id, name: id, color: '#fff', floor, start: { room, x: 50, y: 120, face: 'down' }, inv: [], speed: 60, talkY: 50, fail, failWith: ['nope'] }
}
function room(id, floor, extra = {}) {
  return { id, name: id, floor, w: 400, walk: [[[0, 100], [400, 100], [400, 140], [0, 140]]], hotspots: [], ...extra }
}
const LONG_MENU = Array.from({ length: 9 }, (_, i) => ({
  id: 'o' + i,
  text: i % 3 === 1 ? `Option ${i}, which goes on and on about teacups, chimneys, beards and the spirits of the living until it has to wrap.` : `Option ${i}.`,
}))
function content() {
  const rooms = {
    a: room('a', 'ground', {
      blocks: [[[150, 100], [250, 100], [250, 135], [150, 135]]],
      hotspots: [
        { id: 'box', name: 'box', rect: [300, 60, 40, 40], at: [320, 120], verbs: { look: 'A box.', pickup: c => { c.give('key'); c.set('box.taken') } }, when: s => !s.flags['box.taken'] },
        { id: 'jar', name: 'jar', rect: [310, 70, 10, 10], at: [320, 120], z: 1, verbs: { look: 'A jar on the box.' } },
        { id: 'door', name: 'door', rect: [380, 40, 20, 60], at: [390, 120], exit: { to: 'b', x: 20, y: 120, face: 'right' } },
        { id: 'lock', name: 'lock', rect: [0, 40, 20, 60], at: [10, 120], exit: { to: 'b', x: 20, y: 120, open: s => !!s.flags.unlocked, locked: 'Locked.' } },
        { id: 'crow', name: 'crow', rect: [100, 40, 20, 20], at: [110, 120], verbs: { talk: function* (c) { const r = yield c.choose(LONG_MENU); c.set('crow.said', r) } } },
        { id: 'owl', name: 'owl', rect: [60, 40, 20, 20], at: [70, 120], verbs: { talk: function* (c) { const r = yield c.choose([{ id: 'hi', text: 'Hi.' }, { id: 'secret', text: 'Secret.', when: c.is('knows') }]); c.set('owl.said', r) } } },
      ],
    }),
    b: room('b', 'cellar', { first: c => { c.set('b.first') } }),
    c: room('c', 'attic'),
  }
  const items = {
    key: { id: 'key', name: 'key', look: 'A key.' },
    cake: { id: 'cake', name: 'cake', look: 'Cake.', send: (c, to) => to === 'z' ? 'No cake for z.' : undefined, arrive: { y: 'Cake!' } },
  }
  return {
    rooms, items,
    heroes: { kjell: heroDef('kjell', 'ground', 'a'), dag: heroDef('dag', 'cellar', 'b'), espen: heroDef('espen', 'attic', 'c') },
    npcs: {},
    hint: c => c.say('A hint.'),
  }
}

describe('walking', () => {
  it('goes round a block and arrives', () => {
    const g = new B.Game(content())
    g.resize(320, 200)
    const path = B.findPath(g.content.rooms.a, [100, 120], [300, 120])
    assert.ok(path.length >= 2, 'a detour, not a straight line')
    for (const [x, y] of path) assert.ok(!(x > 152 && x < 248 && y > 102 && y < 133), `point ${x},${y} is inside the block`)
    g.act(null, hs('box'))
    settle(g)
    const a = g.actor('kjell')
    assert.deepEqual([Math.round(a.x), Math.round(a.y)], [320, 120])
  })
  it('snaps a click off the floor onto it', () => {
    const [x, y] = B.nearestWalkable(B.walkMap(content().rooms.a), 50, 20)
    assert.ok(y >= 100 && y <= 140 && Math.abs(x - 50) < 4)
  })
})

describe('sentences', () => {
  it('runs verbs, falls back to the hero lines, and prefers the smaller rect', () => {
    const g = new B.Game(content())
    g.resize(320, 200)
    assert.deepEqual(doing(g, 'look', hs('box')), ['kjell: A box.'])
    assert.deepEqual(doing(g, 'push', hs('box')), ['kjell: no'])
    assert.equal(g.hotspotAt(315, 75).id, 'jar')
    doing(g, 'pickup', hs('box'))
    assert.deepEqual(g.s.inv.kjell, ['key'])
    assert.equal(g.hotspotAt(305, 65), null, 'the box is gone')
  })
  it('goes through doors, refuses locked ones, and runs a room\'s first script once', () => {
    const g = new B.Game(content())
    g.resize(320, 200)
    assert.deepEqual(doing(g, null, hs('lock')), ['kjell: Locked.'])
    assert.equal(g.room, 'a')
    doing(g, null, hs('door'))
    assert.equal(g.room, 'b')
    assert.equal(g.s.flags['b.first'], true)
  })
  it('hands choices back to the script, hiding options that are off', () => {
    const g = new B.Game(content())
    g.resize(320, 200)
    g.act('talk', hs('owl'))
    for (let i = 0; i < 600 && !g.choice; i++) g.update(1 / 60)
    assert.deepEqual(g.shownChoices().map(o => o.id), ['hi'])
    settle(g, { answers: ['hi'] })
    assert.equal(g.s.flags['owl.said'], 'hi')
  })
  for (const [w, h] of [[320, 200], [390, 844], [168, 362]]) {
    it(`keeps a long menu inside the panel and scrolls to every option (${w}×${h})`, () => {
      const g = new B.Game(content())
      g.resize(w, h)
      g.act('talk', hs('crow'))
      for (let i = 0; i < 600 && !g.choice; i++) g.update(1 / 60)
      const L = g.lay
      const seen = new Set()
      for (let step = 0; step < 20; step++) {
        const rows = g.choiceRows()
        assert.ok(rows.length > 0)
        for (const r of rows) {
          assert.ok(r.y + r.h <= L.choices.y + L.choices.h, 'row ' + r.i + ' spills out of the panel')
          assert.ok(r.lines.length >= 1 && r.lines.length <= 3)
          seen.add(r.i)
        }
        if (!g.canScrollChoices(1)) break
        g.pointerDown(L.choiceDown.x + 2, L.choiceDown.y + 2)
      }
      assert.equal(seen.size, LONG_MENU.length, 'every option can be reached')
      assert.ok(g.canScrollChoices(-1))
      const last = g.choiceRows().at(-1)
      g.pointerDown(last.x + 4, last.y + 2)
      settle(g, {})
      assert.equal(g.s.flags['crow.said'], 'o8')
    })
  }
})

describe('the dumbwaiter', () => {
  it('sends an item to a friend and says so', () => {
    const g = new B.Game(content())
    g.resize(320, 200)
    g.s.inv.kjell.push('cake')
    const said = doing(g, 'give', item('cake'), hero('espen'))
    assert.deepEqual(g.s.inv.espen, ['cake'])
    assert.equal(said.length, 1)
    assert.match(said[0], /up/i, 'the attic is up from the ground floor')
  })
  it('switches hero and camera', () => {
    const g = new B.Game(content())
    g.resize(320, 200)
    g.switchHero('dag')
    assert.equal(g.room, 'b')
    assert.ok(g.drain().some(e => e.t === 'music' && e.floor === 'cellar'))
  })
})

describe('layout and saves', () => {
  it('keeps DOTT\'s 320×200 on a monitor and a big panel on an upright phone', () => {
    const w = B.layout(320, 200)
    assert.equal(w.tall, false)
    assert.deepEqual([w.scene.y, w.scene.h], [0, 144])
    assert.equal(w.verbs.length, 9)
    for (const v of w.verbs) assert.ok(v.y + v.h <= 200)
    const t = B.layout(390, 844, 20)
    assert.equal(t.tall, true)
    for (const p of t.portraits) assert.ok(p.y + p.h <= 844 - 20, 'portraits stay out of the bottom band')
    assert.ok(t.scene.y + t.scene.h < t.sentence.y + 1)
    assert.ok(t.verbs[0].h >= 22, 'thumb-sized verbs')
  })
  it('zooms in on an upright phone: the scene fills the width at a bigger scale', () => {
    // iPhone 14 (390×844 at dpr 3), iPhone SE in a tab and installed (48 px band), a Pixel.
    for (const [cw, ch, dpr, top, bot] of [[390, 844, 3, 0, 0], [375, 667, 2, 0, 0], [375, 667, 2, 20, 48], [412, 915, 2.625, 0, 0]]) {
      const [minW, minH] = B.stageMin(cw, ch, top, bot)
      const W = Math.round(cw * dpr), H = Math.round(ch * dpr)
      const scale = Math.max(1, Math.floor(Math.min(W / minW, H / minH)))
      const vw = Math.ceil(W / scale), vh = Math.ceil(H / scale)
      const k = scale / dpr
      const L = B.layout(vw, vh, Math.ceil(bot / k), Math.ceil(top / k))
      const tag = cw + '×' + ch + '@' + dpr + ' band ' + bot
      assert.equal(L.tall, true, tag)
      assert.ok(vw >= B.TALL_MIN_W && vw < 240, tag + ': view ' + vw + ' wide')
      assert.ok(k >= 1.5, tag + ': the scene is zoomed in (' + k + ' css px per pixel)')
      assert.ok(L.scene.y >= Math.ceil(top / k), tag + ': the scene clears the status bar')
      assert.ok(L.scene.y + L.scene.h <= L.sentence.y, tag)
      for (const p of L.portraits) assert.ok(p.y + p.h <= vh - Math.ceil(bot / k), tag + ': faces stay out of the bottom band')
      for (const v of L.verbs) assert.ok(v.w >= 44 && v.h >= 15, tag + ': verbs keep their size')
      assert.ok(L.cols >= 3, tag)
    }
  })
  it('round-trips a save and drops what the content no longer has', () => {
    const g = new B.Game(content())
    g.s.flags.x = 3
    g.s.inv.dag.push('key', 'ghost-item')
    const back = B.parseState(JSON.parse(JSON.stringify(g.s)), content())
    assert.equal(back.flags.x, 3)
    assert.deepEqual(back.inv.dag, ['key'])
    assert.equal(B.parseState({ v: 2 }, content()), null)
  })
})
