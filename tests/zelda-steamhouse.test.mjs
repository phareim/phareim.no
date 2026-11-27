// THE STEAMHOUSE (docs/games/neon-shrine.md, "The Steamhouse"): the Sporelight's dungeon with no keys. By the owner's
// rule of 2026-11-27 this file holds few end-to-end tests and no specialised ones (at most four when the whole job is
// done). Part one:
//   (a) one scripted play-through by a hero with the blade only, from the door in the Sporelight to THE NO in hand and
//       the lobby's gate open (and a tab reloaded on the way), the way a player plays it;
//   (b) the map: the world is clean, the key rule holds with zero keys, every room can be walked to, and the boiler's
//       east gate stays shut to a hero without THE NO.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')

/** The engine and the world, as every zelda test loads them, and the Steamhouse's own numbers on top. */
async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export * from './engine/index'; export { WORLD } from './world/index'; export * from './types'; export { validateWorld } from './world/validate'; export { clockOf } from './engine/attendants'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let Z
before(async () => { Z = await load() })

const FPS = 60
const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const unit = (x, y, k = 1) => { const d = Math.hypot(x, y) || 1; return { x: (x / d) * k, y: (y / d) * k } }

/** A scripted player: the game, its clock, and what it can do with a stick and two buttons. */
function player(opts) {
  const s = Z.createGame(Z.WORLD, opts)
  s.inv.sword = true
  const events = []
  const p = {
    s, events,
    tick(o) { const e = Z.stepGame(Z.WORLD, s, 1 / FPS, inp(o)); events.push(...e); return e },
    until(done, max = 1200, o = () => ({})) {
      for (let i = 0; i < max; i++) { if (done()) return i; p.tick(o(i)) }
      throw new Error(`timeout on ${s.map.id} at ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)} in mode ${s.mode}`)
    },
    /** Walks in a straight line to (x, y). */
    walk(x, y, eps = 0.1) { p.until(() => Math.hypot(s.hero.x - x, s.hero.y - y) < eps, 900, () => ({ move: unit(x - s.hero.x, y - s.hero.y) })) },
    /** Reads a dialog to its end, answering its question (0 NO, 1 YES) when it asks one. */
    read(answer) {
      for (let g = 0; s.mode === 'dialog' && g < 3000; g++) {
        const d = s.dialog
        if (d.chars < d.lines[d.line].length) { p.tick({ aPress: true }); p.tick(); continue }
        if (d.ask && d.line === d.lines.length - 1 && answer !== undefined) {
          p.tick()
          if (d.choice !== answer) { p.tick({ move: { x: answer ? 1 : -1, y: 0 } }); p.tick() }
        }
        p.tick({ aPress: true }); p.tick()
      }
    },
  }
  return p
}

describe('the Steamhouse', () => {
  it('can be played from the door in the Sporelight to THE NO and the lobby gate, by a hero with the blade only', () => {
    const me = player({ at: { map: 'sporelight', entry: 'steamhouse' }, seed: 3 })
    const { s } = me
    const idx = (x, y) => y * s.map.w + x
    s.hero.maxHp = s.hero.hp = 30
    // A hero who is hurt and carries things, so that a bath can be seen to take only the hurt.
    s.hero.hp = 4
    Object.assign(s.inv, { bombBag: true, bombs: 5, selected: 'bombs', bits: 37 })
    s.flags.somethingOld = true
    const before = { inv: JSON.stringify(s.inv), flags: Object.keys(s.flags) }

    // The door: up the path and in. The lobby's attendant offers at once, NO first.
    me.until(() => s.map.id === 'steamhouse', 300, () => ({ move: { x: 0, y: -1 } }))
    me.until(() => s.mode === 'dialog', 300)
    assert.deepEqual([s.entry.entry, s.dialog.ask.options, s.dialog.choice], ['door', ['NO', 'YES'], 0], 'the cursor starts on NO')
    assert.ok(!s.hero.robe)
    // A NO, and the hero stays in the ring: a clock turns, pink for its last stretch, and then the attendant says YES for
    // them. (The bath is the same bath as a YES's.)
    me.read(0)
    const lobbyAttendant = s.map.npcs.find(n => n.id === 'steam.lobby')
    const seen = []
    me.until(() => s.mode !== 'play', 8 * FPS, () => { const c = Z.clockOf(lobbyAttendant); if (c) seen.push(c); return {} })
    assert.ok(seen.length > 60 && !seen[0].pink && seen[seen.length - 1].pink && seen.every((c, i) => !i || c.k >= seen[i - 1].k), 'the clock fills, and ends pink')
    assert.match(s.dialog.lines[0], /LOVELY/)
    me.read()
    me.until(() => s.mode === 'play', 300)
    me.tick()
    me.read()
    assert.deepEqual([s.map.id, s.entry.entry, s.hero.robe, s.hero.hp === s.hero.maxHp], ['steamhouse', 'baths', true, true])
    // One deliberate YES, asked for by pressing A on the attendant: white, the pool, a robe, full hearts, and nothing
    // else touched. (The robe is on already; the hearts are not.)
    s.hero.hp = 4
    me.walk(21.5, 20.5); me.walk(25.5, 20.5)
    for (let i = 0; i < 20; i++) me.tick({ move: { x: 0, y: -0.2 } })
    me.tick({ aPress: true })
    assert.equal(s.mode, 'dialog', 'pressing A on an attendant asks again')
    me.read(1)
    me.until(() => s.mode === 'play', 300)
    assert.deepEqual([s.map.id, s.entry.entry, s.hero.robe, s.hero.hp === s.hero.maxHp], ['steamhouse', 'baths', true, true])
    assert.equal(JSON.stringify(s.inv), before.inv, 'the deck, the B item and the purse are as they were')
    assert.deepEqual(Object.keys(s.flags).filter(f => !before.flags.includes(f)).sort(), ['steamhouse.bathed', 'steamhouse.bathed.said', 'steamhouse.visited'], 'no flag but the house\'s own')
    assert.ok(before.flags.every(f => s.flags[f]), 'and none lost')
    assert.ok(me.events.some(e => e.type === 'bath' && e.phase === 'begin'))
    // A tab reloaded here continues in the house, at the pool, without the robe (it is never saved).
    const save = Z.toSave(s)
    assert.ok(Z.awayMap(Z.WORLD, save.map, save.entry) && Z.loadSpot(Z.WORLD, save, null, true) === null, 'a reloaded tab is not thrown out')
    const reloaded = Z.createGame(Z.WORLD, { save })
    assert.deepEqual([reloaded.map.id, reloaded.entry.entry, !!reloaded.hero.robe], ['steamhouse', 'baths', false])
    // The rack takes the robe off (A, facing it).
    me.walk(20.5, 20.5); me.walk(28.5, 20.5); me.walk(28.5, 14.6)
    for (let i = 0; i < 20; i++) me.tick({ move: { x: 0, y: -0.2 } })
    me.tick({ aPress: true })
    assert.equal(s.hero.robe, false)

    // The baths, in the isometric view: the screens stand in front of the staff door, and the hero cannot pass.
    me.walk(28.5, 20.5); me.walk(17.5, 20.5); me.walk(17.5, 17.6); me.walk(14.6, 17.6); me.walk(14.6, 15.6); me.walk(7.5, 15.6)
    assert.equal(s.view, 'iso')
    for (let i = 0; i < FPS; i++) me.tick({ move: { x: 0, y: -1 } })
    assert.ok(s.hero.y > 14.9 && s.zoneIndex === 3, `the screens hold (${s.hero.y.toFixed(2)})`)
    // The plan shows the doorway: turn, and walk through into the laundry.
    assert.ok(Z.setViewRule(s, 'flat'))
    me.until(() => s.zoneIndex === 0 && s.mode === 'play', 300, () => ({ move: { x: 0, y: -1 } }))

    // The laundry: two baskets onto two plates open the gate. The attendant offers at the last push; NO, and the
    // clock starts to fill while the hero stays in the ring.
    const onPlate = (x, y) => s.map.tiles[idx(x, y)] === 'b' && s.map.moving.length === 0
    me.walk(7.5, 7.5); me.walk(3.5, 7.5); me.walk(3.5, 5.5)
    me.until(() => onPlate(3, 2), 400, () => ({ move: { x: 0, y: -1 } }))
    me.walk(3.5, 5.5); me.walk(3.5, 7.5); me.walk(12.5, 7.5); me.walk(12.5, 5.5)
    let offered = false
    me.until(() => onPlate(12, 2), 600, () => {
      if (s.mode === 'dialog') { offered = true; me.read(0) }
      return { move: { x: 0, y: -1 } }
    })
    assert.ok(offered, 'the attendant in the far corner covers the last push')
    for (let i = 0; i < 10; i++) me.tick()
    assert.ok(s.flags['gate:steamhouse.14,5'] && s.map.tiles[idx(14, 5)] === '.', 'both plates held: the gate is open')
    const lingering = s.map.npcs.find(n => n.id === 'steam.laundry')
    assert.ok(Z.clockOf(lingering) !== null, 'after the NO the clock is running')

    // Into the boiler: the gate shuts behind the hero while a hound lives.
    me.walk(14.5, 5.5)
    me.until(() => s.zoneIndex === 1 && s.mode === 'play', 400, () => ({ move: { x: 1, y: 0 } }))
    me.walk(19, 5.5)
    me.until(() => s.map.tiles[idx(16, 5)] === 'X', 120)
    const tough = s.map.enemies.find(e => e.tough)
    const pup = s.map.enemies.find(e => !e.tough)
    assert.ok(tough && pup && s.map.enemies.length === 2, 'two hounds, one tough')
    // The chest with THE NO, fetched under both of them.
    me.until(() => Math.hypot(s.hero.x - 26.5, s.hero.y - 2.6) < 0.15, 900, () => ({ move: unit(26.5 - s.hero.x, 2.6 - s.hero.y) }))
    for (let i = 0; i < 20; i++) me.tick({ move: { x: 0, y: -0.2 } })
    me.tick({ aPress: true })
    me.until(() => s.mode === 'dialog', 200)
    me.read()
    assert.ok(s.flags['item:no'] && s.flags['chest:steamhouse.no'])

    // The fight, THE NO in hand. The tough hound is fought by the blade alone: its strike is rolled off, and the blade
    // takes it while it stands open. The plain hound's lunge is met by a cut at its first moment (a press too late
    // is struck first and shoved, as it always was) and refused: it reels, and is cut down. A blow refused is no hurt.
    const gap = e => Math.hypot(e.x - s.hero.x, e.y - s.hero.y)
    const toward = (e, k = 1) => unit(e.x - s.hero.x, e.y - s.hero.y, k)
    const away = (e, k = 1) => unit(s.hero.x - e.x, s.hero.y - e.y, k)
    const reach = e => Z.SWORD_REACH + e.r - 0.15
    const cut = (e, f) => gap(e) >= reach(e) ? inp({ move: toward(e) }) : inp({ move: toward(e, 0.3), aPress: f % 5 === 0, a: true })
    const mem = {}
    const dance = (e, f) => {
      const h = s.hero
      const d = gap(e)
      const mode = e.ai.mode
      if (mode === 'charge' || mode === 'lunge') {
        // Square to the strike, toward the middle of the room, and roll a tenth of a second after it starts.
        let q = unit(-(Number(e.ai.vy) || 0), Number(e.ai.vx) || 0)
        if (q.x * (21.5 - h.x) + q.y * (6 - h.y) < 0) q = { x: -q.x, y: -q.y }
        if (mem.mode !== mode) { mem.mode = mode; mem.owed = !h.roll; mem.since = 0 }
        if (h.roll) mem.owed = false
        return inp({ move: q, rollPress: mem.owed && mem.since++ >= 6 })
      }
      mem.mode = mode
      mem.open = Z.toughOpen(e) ? (mem.open ?? 0) + 1 : 0
      if (Z.toughOpen(e)) return mem.open > 0.65 * FPS ? inp({ move: away(e), rollPress: !h.roll && !h.swing && d < 2 }) : cut(e, f)
      if (mode === 'tell') return inp({ move: toward(e, 0.05) })
      return d < 3 ? inp({ move: away(e) }) : d > 4 ? inp({ move: toward(e) }) : inp({ move: toward(e, 0.05) })
    }
    let pupRefused = 0
    let hurtInWindow = 0
    for (let f = 0; f < 80 * FPS && (!tough.dead || !pup.dead); f++) {
      const h = s.hero
      let o
      if (!pup.dead && pup.ai.mode === 'lunge' && !h.swing && !h.roll && gap(pup) >= 2.7 && gap(pup) < 3.6 && !pupRefused) o = inp({ move: toward(pup, 0.3), aPress: true, a: true })
      else if (!pup.dead && pup.stun > 0 && gap(pup) < 3) o = cut(pup, f)
      else if (!tough.dead) o = dance(tough, f)
      else if (!pup.dead) o = gap(pup) < 3 ? inp({ move: away(pup) }) : gap(pup) > 3.8 ? inp({ move: toward(pup) }) : inp({ move: toward(pup, 0.3) })
      else o = inp()
      const hp = h.hp
      const ev = me.tick(o)
      if (ev.some(e => e.type === 'refuse')) {
        if (pup.stun > 0 && !tough.stun) pupRefused++
        if (h.hp < hp) hurtInWindow++
      }
    }
    assert.ok(tough.dead && pup.dead && s.mode === 'play', 'both hounds fall')
    assert.ok(pupRefused >= 1, 'the plain hound\'s lunge was refused')
    assert.equal(hurtInWindow, 0, 'a refused blow is no hurt')
    assert.ok(s.flags['steamhouse.hound'] && s.flags['steamhouse.pup'])
    for (let i = 0; i < 30; i++) me.tick()
    assert.ok(s.flags['gate:steamhouse.16,5'] && s.map.tiles[idx(16, 5)] === '.', 'the room is clear: the way back opens')

    // The lever by the chest opens the barred gate to the lobby; the short way home is two rooms.
    assert.equal(s.map.tiles[idx(23, 11)], 'X')
    me.walk(24.5, 2.6)
    for (let i = 0; i < 20; i++) me.tick({ move: { x: 0, y: -0.2 } })
    me.tick({ aPress: true })
    assert.ok(s.flags['steamhouse.back'], 'the lever is thrown')
    for (let i = 0; i < 10; i++) me.tick()
    assert.equal(s.map.tiles[idx(23, 11)], '.')
    me.walk(23.5, 9.5)
    me.until(() => s.zoneIndex === 4 && s.mode === 'play', 600, () => ({ move: { x: 0, y: 1 } }))
    assert.equal(s.map.id, 'steamhouse')
    // A tab reloaded now is in the lobby, and the doors it opened are open.
    const again = Z.createGame(Z.WORLD, { save: Z.toSave(s) })
    assert.deepEqual([again.map.id, again.entry.entry, again.flags['item:no'], again.flags['steamhouse.back'], again.flags['gate:steamhouse.14,5']], ['steamhouse', 'baths', true, true, true])
    assert.equal(again.map.tiles[idx(23, 11)], '.')
  })

  it('is one clean map in both views, with no keys, whose rooms can all be walked to and whose east gate wants THE NO', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD), [], 'the world is clean (every route is walked in both views)')
    const house = Z.WORLD.maps.steamhouse
    const suite = Z.WORLD.maps.steamsuite
    for (const m of [house, suite]) {
      assert.deepEqual(m.views, ['iso', 'classic'])
      assert.equal(m.keyring, undefined, 'no keyring: no keys')
      // The key rule (tests/wildwood.test.mjs) groups by keyring: with none, these maps add nothing to the Shrine's.
      const marks = Object.values(m.marks).map(k => k.ent)
      assert.equal(marks.filter(e => (e.t === 'chest' || e.t === 'item') && (e.item === 'smallKey' || e.item === 'bigKey')).length, 0)
      assert.equal(marks.filter(e => e.t === 'enemy' && e.carries).length, 0)
      assert.ok(!m.rows.some(r => /[LK]/.test(r)), 'no lock tile')
    }
    // The Sporelight keeps its size, and its door leads in.
    assert.deepEqual([Z.WORLD.maps.sporelight.rows.length, Z.WORLD.maps.sporelight.rows[0].length], [52, 80])
    assert.ok(Z.hasEntry(Z.WORLD, 'sporelight', 'steamhouse') && Z.hasEntry(Z.WORLD, 'steamhouse', 'door'))

    // The boiler's east gate stays shut to a hero without THE NO, and opens to one who holds it; the stair beyond it
    // goes up to the suite, whose Best Room is empty and whose north gate is shut.
    const idx = (s, x, y) => y * s.map.w + x
    const bare = player({ at: { map: 'steamhouse', entry: 'door' } })
    bare.tick()
    bare.read(0)
    for (let i = 0; i < 30; i++) bare.tick()
    assert.equal(bare.s.map.tiles[idx(bare.s, 27, 5)], 'X', 'shut without THE NO')
    const held = player({ at: { map: 'steamhouse', entry: 'fromstair' } })
    held.s.flags['item:no'] = true
    for (let i = 0; i < 30; i++) held.tick()
    assert.equal(held.s.map.tiles[idx(held.s, 27, 5)], '.', 'open with it')
    held.walk(29.5, 5.5)
    held.until(() => held.s.map.id === 'steamsuite' && held.s.mode === 'play', 300, () => ({ move: { x: 1, y: 0 } }))
    assert.equal(held.s.entry.entry, 'stair', 'death returns to the stair once it is taken')
    held.walk(14.5, 5.5)
    held.until(() => held.s.zoneIndex === 1 && held.s.mode === 'play', 300, () => ({ move: { x: 1, y: 0 } }))
    assert.equal(held.s.map.enemies.length, 0, 'the Best Room is empty')
    assert.equal(held.s.map.tiles[idx(held.s, 23, 1)], 'X', 'and its north gate shut')
    // The way back: the stair down, to the boiler's east end.
    const left = () => ({ move: { x: -1, y: 0 } })
    held.until(() => held.s.zoneIndex === 0 && held.s.mode === 'play', 300, left)
    held.until(() => held.s.map.id === 'steamhouse' && held.s.mode === 'play', 600, left)
    assert.equal(held.s.entry.entry, 'fromstair')
  })
})
