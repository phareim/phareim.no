// THE STEAMHOUSE (docs/games/neon-shrine.md, "The Steamhouse"): the Sporelight's dungeon with no keys. By the owner's
// rule of 2026-11-27 this file holds few end-to-end tests and no specialised ones (four):
//   (a) one scripted play-through by a hero with the blade only, from the door in the Sporelight to the Sacred Weight
//       in hand (a YES on the way, and a tab reloaded halfway): THE NO, the lobby's gate, the Gift Shop's four refusals
//       and heart piece, the stair, three volleys refused (a cut, a spin, a cut), THE END's banner cut at its corner,
//       the one true thing and the way out, the way a player plays it;
//   (b) the map: the world is clean, the key rule holds with zero keys, every room can be walked to, and the boiler's
//       east gate stays shut to a hero without THE NO;
//   (c) a hero who says YES to everything and cuts nothing: the lobby, the robe, full hearts, nothing else touched, no
//       heart ever lost to the Sycophant, and nothing opened;
//   (d) THE END is never the ending, saves nothing, and locks nobody in.
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
      contents: `export * from './engine/index'; export { WORLD } from './world/index'; export * from './types'; export { validateWorld } from './world/validate'; export { clockOf } from './engine/attendants'; export { throwerLanes } from './engine/gifts'; export { stencilsOf } from './engine/stencils'`,
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
    /** Walks in a straight line to (x, y); an offer met on the way is answered NO. */
    walk(x, y, eps = 0.1) { p.until(() => Math.hypot(s.hero.x - x, s.hero.y - y) < eps, 900, () => { if (s.mode === 'dialog') p.read(0); return { move: unit(x - s.hero.x, y - s.hero.y) } }) },
    /** Pushes the stick one way into another room (an offer met on the way is answered NO). */
    leave(dx, dy, there) {
      p.until(() => there() && s.mode === 'play', 900, () => { if (s.mode === 'dialog') p.read(0); return { move: { x: dx, y: dy } } })
    },
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
  it('can be played from the door in the Sporelight to the Weight in hand, by a hero with the blade only', () => {
    let me = player({ at: { map: 'sporelight', entry: 'steamhouse' }, seed: 3 })
    let { s } = me
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
    // Halfway: one more YES at the pool, and the tab is reloaded in the robe. It continues in the house, at the pool,
    // unrobed (the robe is never saved), with THE NO and every door it opened still open; the walk goes on from there.
    me.walk(23.5, 14.6); me.walk(29.5, 14.6); me.walk(29.5, 20.5); me.walk(25.5, 20.5)
    for (let i = 0; i < 20; i++) me.tick({ move: { x: 0, y: -0.2 } })
    me.tick({ aPress: true })
    me.read(1)
    me.until(() => s.mode === 'play' && s.hero.robe, 300)
    const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    assert.ok(Z.awayMap(Z.WORLD, save.map, save.entry) && Z.loadSpot(Z.WORLD, save, null, true) === null, 'a reloaded tab is not thrown out')
    me = player({ save, seed: 4 })
    s = me.s
    assert.deepEqual([s.map.id, s.entry.entry, !!s.hero.robe], ['steamhouse', 'baths', false])
    assert.ok(s.flags['item:no'] && s.flags['steamhouse.back'] && s.flags['gate:steamhouse.14,5'] && s.map.tiles[idx(23, 11)] === '.')

    // The Gift Shop, east: two throwers, a lane on the floor before each gift, and the heart piece behind a gate that
    // four refusals open. The thumb is not aimed (`autoFace`): a press when a gift is near turns to it and cuts.
    const gifts = () => s.map.projectiles.filter(q => q.kind === 'gift')
    const nearest = () => gifts().reduce((m, q) => Math.min(m, Math.hypot(q.x - s.hero.x, q.y - s.hero.y)), Infinity)
    const thumb = (within, f) => inp({ autoFace: true, aPress: nearest() < within && f % 8 === 0, a: nearest() < within && f % 8 === 0 })
    me.walk(20.5, 20.5); me.walk(28.5, 20.5); me.walk(29.5, 17.5)
    me.leave(1, 0, () => s.zoneIndex === 5)
    me.walk(40.5, 17.5)
    assert.equal(s.map.tiles[idx(45, 15)], 'X', 'the heart piece is behind a shut gate')
    let told = 0
    let refused = 0
    for (let f = 0; f < 60 * FPS && !s.flags['steamhouse.shop']; f++) {
      told = Math.max(told, Z.throwerLanes(s).length)
      const flying = gifts().length
      const ev = me.tick(thumb(2.1, f))
      if (ev.some(e => e.type === 'refuse')) { assert.equal(gifts().length, 0, 'a no is a no: none is left in the air'); refused += flying }
      assert.ok(!s.hero.robe && s.mode === 'play', 'no gift lands')
    }
    assert.ok(s.flags['steamhouse.shop'] && refused >= 4 && told >= 1, `four refused (${refused}), each told on the floor first`)
    const after = []
    for (let f = 0; f < 6 * FPS; f++) after.push(...me.tick())
    assert.ok(!after.some(e => e.type === 'toss'), 'the attendants stand very still')
    assert.equal(s.map.tiles[idx(45, 15)], '.')
    const pieces = s.inv.pieces
    me.walk(45.5, 17.5); me.walk(45.5, 14.5)
    for (let i = 0; i < 20; i++) me.tick({ move: { x: 0, y: -0.2 } })
    me.tick({ aPress: true })
    me.until(() => s.mode === 'dialog', 200)
    me.read()
    assert.deepEqual([!!s.flags['chest:steamhouse.heart'], s.inv.pieces !== pieces], [true, true], 'the heart piece')

    // Back through the lobby's new gate, the short way: the boiler, the stair, the Best Room and its card.
    me.walk(45.5, 17.5); me.walk(40.5, 17.5)
    me.leave(-1, 0, () => s.zoneIndex === 4)
    me.walk(29.5, 17.5); me.walk(29.5, 14.6); me.walk(23.5, 14.6)
    me.leave(0, -1, () => s.zoneIndex === 1)
    me.walk(23.5, 9.5); me.walk(25.5, 5.5)
    me.leave(1, 0, () => s.map.id === 'steamsuite')
    me.walk(14.5, 5.5)
    me.leave(1, 0, () => s.zoneIndex === 1 || s.mode === 'dialog')
    me.until(() => s.mode !== 'scroll', 200)
    me.tick()
    assert.match(s.dialog?.lines[0] ?? '', /THE SYCOPHANT\. IT AGREES WITH YOU/)
    me.read()

    // THE SYCOPHANT. It never hurts; the blade does nothing to it while it fawns; a gift refused slips its smile, and
    // then one cut is one of its four hit points. Three volleys: refused by a cut, by a spin, by a cut.
    const boss = s.map.enemies.find(e => e.kind === 'sycophant')
    assert.ok(boss && s.map.enemies.length === 1 && boss.hp === 4)
    const gapTo = () => Math.hypot(boss.x - s.hero.x, boss.y - s.hero.y)
    s.hero.hp = s.hero.maxHp - 3
    /** To the Sycophant, and a press every `every` frames once the blade reaches. */
    const at = (reach, every) => f => ({ move: unit(boss.x - s.hero.x, boss.y - s.hero.y, gapTo() > reach ? 1 : 0.2), aPress: gapTo() <= reach && f % every === 0, a: gapTo() <= reach && f % every === 0 })
    const heard = me.events.length
    me.until(() => boss.ai.mode === 'offer', 600, at(2, 12))
    assert.ok(me.events.slice(heard).some(e => e.type === 'clank') && boss.hp === 4 && !Z.bossOpen(boss), 'behind its card the blade clanks')
    let healed = false
    /** The camera of a narrow screen, where it was the frame before: THE END may not move it. */
    const narrow = () => Z.cameraFor(s, 9, 14)
    let camera
    for (const how of ['cut', 'spin', 'cut']) {
      const cuts = 4 - boss.hp
      // To the open floor under it, and wait for the offer.
      me.until(() => boss.ai.mode === 'fawn' || boss.ai.mode === 'offer', 600)
      me.until(() => Math.hypot(s.hero.x - 24.5, s.hero.y - 8.5) < 0.3 || boss.ai.mode === 'offer', 600, () => ({ move: unit(24.5 - s.hero.x, 8.5 - s.hero.y) }))
      me.until(() => boss.ai.mode === 'offer', 600)
      assert.equal(Z.stencilsOf(boss).length, cuts + 1, 'a lane for every gift of the volley, before any flies')
      let spun = false
      let sent = 0
      for (let f = 0; f < 20 * FPS && boss.ai.mode !== 'slip'; f++) {
        // The spin: A held from the offer, let go when a gift is near.
        const o = how === 'spin' ? inp({ a: nearest() >= 2.1, aPress: f === 0 }) : thumb(2.1, f)
        const hp = s.hero.hp
        const ev = me.tick(o)
        sent += ev.filter(e => e.type === 'toss').length
        if (ev.some(e => e.type === 'spin')) spun = true
        if (s.hero.hp > hp) healed = true
        assert.ok(s.hero.hp >= hp && !s.hero.robe, 'nothing is lost and no gift lands')
      }
      assert.equal(boss.ai.mode, 'slip', `volley ${cuts + 1} refused: the smile slips`)
      assert.ok(Z.bossOpen(boss) && !gifts().length && sent >= 1 && sent <= cuts + 1, 'open, and nothing more is thrown')
      if (how === 'spin') assert.ok(spun, 'by the spin')
      const hp = s.hero.hp
      me.until(() => boss.hp < 4 - cuts, 3 * FPS, f => { camera = narrow(); return at(1.9, 6)(f) })
      assert.equal(boss.hp, 3 - cuts, 'one cut, one hit point')
      if (cuts === 2) break
      // (The rest of the swing, and of the chain, take nothing more.)
      for (let f = 0; f < 40; f++) me.tick({ aPress: f % 8 === 0 })
      assert.equal(boss.hp, 3 - cuts)
      assert.ok(s.hero.hp >= hp, 'cutting it costs no heart')
    }
    assert.ok(healed, 'and it tops a hurt hero up')

    // THE END. The third cut ends nothing: the world holds for a beat, with the hero, the hearts and the camera where
    // they were, and a mashed button moves nothing.
    const held = () => JSON.stringify([s.hero.x, s.hero.y, s.hero.hp, s.inv, s.elapsed, narrow()])
    assert.ok(s.beat && !boss.dead && boss.hp === 1 && !s.flags.sycophant)
    assert.ok(Math.hypot(narrow().x - camera.x, narrow().y - camera.y) < 0.25, `the camera stays where the cut found it (${JSON.stringify([camera, narrow()])})`)
    const still = held()
    let beat = 0
    while (s.beat) { me.tick({ aPress: beat % 8 === 0, move: { x: 0, y: -1 } }); if (s.beat) assert.equal(held(), still); beat++ }
    assert.ok(beat > 2 * FPS && beat < 3 * FPS, `a surprise lasts seconds (${(beat / FPS).toFixed(1)} s)`)
    assert.match(s.dialog.lines[0], /GLUED ON AT ONE CORNER/)
    me.read()
    // The paper holds the hero south of it, and the blade finds nothing but the loose corner, at its east end.
    me.walk(23.5, 7.5)
    for (let i = 0; i < 3 * FPS; i++) me.tick({ move: { x: 0, y: -1 } })
    assert.ok(s.hero.y > 4 && s.hero.y < 4.5, `the banner holds (${s.hero.y.toFixed(2)})`)
    for (let i = 0; i < FPS; i++) me.tick({ aPress: i % 8 === 0 })
    assert.ok(boss.hp === 1 && !s.dialog && !Z.bossOpen(boss), 'a cut at its middle passes through')
    me.walk(26.5, 6)
    me.until(() => boss.ai.mode !== 'hung', 3 * FPS, f => ({ move: unit(26.5 - s.hero.x, 4.3 - s.hero.y, s.hero.y > 4.5 ? 1 : 0.2), aPress: s.hero.y <= 4.6 && f % 8 === 0 }))
    assert.equal(boss.hp, 1, 'the corner takes no hit point')
    // Down it comes; the room says so; it steps out bare-faced and says one true thing; and only then does it fall.
    me.until(() => s.mode === 'dialog', 3 * FPS)
    assert.match(s.dialog.lines[0], /THE END HAS BEEN POSTPONED/)
    me.read()
    me.until(() => s.mode === 'dialog', 3 * FPS)
    assert.deepEqual([s.dialog.who, /NEVER ONCE TOLD ANYONE THEY WERE WRONG/.test(s.dialog.lines[0])], ['sycophant', true])
    assert.ok(!boss.dead && !s.flags.sycophant && s.map.tiles[idx(23, 1)] === 'X', 'nothing is saved yet')
    me.read()
    me.until(() => s.mode === 'dialog', 4 * FPS)
    assert.ok(boss.dead && s.flags.sycophant && me.events.some(e => e.type === 'bossDown' && e.kind === 'sycophant'))
    assert.match(s.dialog.lines[0], /THE STEAMHOUSE IS QUIET/)
    me.read()
    // The Weight lies where the way out opens: take it, and go.
    me.walk(24.5, 6)
    me.until(() => s.mode !== 'play', 3 * FPS, () => ({ move: unit(24.5 - s.hero.x, 4.5 - s.hero.y) }))
    me.until(() => s.mode === 'dialog', 200)
    assert.match(s.dialog.lines.join(' '), /STAMPED NO/)
    me.read()
    assert.ok(s.flags['item:weightNo'] && s.flags['took:steamhouse.weight'])
    for (let i = 0; i < 30; i++) me.tick()
    assert.equal(s.mode, 'play', 'the room\'s last line was said once')
    assert.equal(s.map.tiles[idx(23, 1)], '.')
    me.walk(23.5, 5.5)
    me.leave(0, -1, () => s.map.id === 'steamhouse')
    assert.equal(s.entry.entry, 'checkout', 'out by the desk')
    assert.ok(!s.flags.won && !me.events.some(e => e.type === 'won'))
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
    // goes up to the suite, whose Best Room holds the Sycophant and whose north gate is shut. It can be left again.
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
    held.leave(1, 0, () => held.s.zoneIndex === 1)
    held.read()
    assert.deepEqual(held.s.map.enemies.map(e => e.kind), ['sycophant'])
    assert.equal(held.s.map.tiles[idx(held.s, 23, 1)], 'X', 'and its north gate shut')
    // The way back: the stair down, to the boiler's east end.
    const left = () => { if (held.s.mode === 'dialog') held.read(0); return { move: { x: -1, y: 0 } } }
    held.until(() => held.s.zoneIndex === 0 && held.s.mode === 'play', 300, left)
    held.until(() => held.s.map.id === 'steamhouse' && held.s.mode === 'play', 600, left)
    assert.equal(held.s.entry.entry, 'fromstair')
  })

  it('gives a hero who says YES to everything, and cuts nothing, a bath, a robe and full hearts, and nothing else', () => {
    /** A hero with things to lose, hurt, in the house. */
    const guest = (at, flags = {}) => {
      const me = player({ at, seed: 5 })
      const { s } = me
      s.hero.maxHp = 20
      s.hero.hp = 7
      Object.assign(s.inv, { bombBag: true, bombs: 5, selected: 'bombs', bits: 37 })
      Object.assign(s.flags, { somethingOld: true, ...flags })
      return me
    }
    /** What a bath may never touch, and the flags the house itself sets (a first offer, a first meeting, a first bath). */
    const kept = s => ({ inv: JSON.stringify(s.inv), flags: Object.keys(s.flags).filter(f => !/^(steamhouse\.(visited|bathed|bathed\.said)|steamsuite\.met|gate:)/.test(f)).sort() })
    const bathed = (me, was) => {
      me.until(() => me.s.map.id === 'steamhouse' && me.s.hero.robe && me.s.mode !== 'warp', 900)
      me.tick()
      me.read()
      const { s } = me
      assert.deepEqual([s.map.id, s.entry.entry, s.hero.robe, s.hero.hp, s.zoneIndex], ['steamhouse', 'baths', true, 20, 4])
      assert.deepEqual(kept(s), was, 'the deck, the B item, the purse and every flag are as they were')
      assert.ok(!s.flags['item:weightNo'] && !s.flags.sycophant)
    }

    // YES in the lobby.
    const polite = guest({ map: 'sporelight', entry: 'steamhouse' })
    let was = kept(polite.s)
    polite.until(() => polite.s.mode === 'dialog', 600, () => ({ move: { x: 0, y: -1 } }))
    polite.read(1)
    bathed(polite, was)

    // A gift in the shop is a YES too, and without THE NO the blade only passes through it.
    for (const swings of [false, true]) {
      const shopper = guest({ map: 'steamhouse', entry: 'baths' })
      shopper.walk(28.5, 20.5); shopper.walk(30.5, 17.5)
      shopper.leave(1, 0, () => shopper.s.zoneIndex === 5)
      shopper.walk(40.5, 17.5)
      was = kept(shopper.s)
      shopper.until(() => shopper.s.mode === 'warp', 20 * FPS, f => (swings ? { autoFace: true, aPress: f % 8 === 0, a: f % 8 === 0 } : {}))
      assert.ok(!shopper.events.some(e => e.type === 'refuse'), 'nothing is refused')
      bathed(shopper, was)
    }

    // And in the Best Room: standing still, the hero is topped up, offered a gift and bathed, from the other map; no
    // heart is ever lost, the gate stays shut, and the fight is there again from its start.
    const still = guest({ map: 'steamsuite', entry: 'stair' }, { 'item:no': true })
    const { s } = still
    still.walk(14.5, 5.5)
    still.leave(1, 0, () => s.zoneIndex === 1 || s.mode === 'dialog')
    still.until(() => s.mode !== 'scroll', 200)
    still.tick()
    still.read()
    was = kept(s)
    let hp = s.hero.hp
    still.until(() => s.mode === 'warp', 20 * FPS, () => { assert.ok(s.hero.hp >= hp, 'never a heart lost to the Sycophant'); hp = s.hero.hp; return {} })
    assert.ok(hp > 7, 'it topped them up')
    assert.equal(s.map.tiles[1 * s.map.w + 23], 'X', 'the gate stays shut')
    bathed(still, was)
    assert.ok(!still.events.some(e => e.type === 'hurt' || e.type === 'bossDown'))
    const upstairs = Z.createGame(Z.WORLD, { save: { ...Z.toSave(s), map: 'steamsuite', entry: 'stair' } })
    assert.deepEqual(upstairs.map.enemies.map(e => [e.kind, e.hp]), [['sycophant', 4]])
  })

  it('hangs THE END without ending anything: never won, nothing saved, and nobody locked in', () => {
    const me = player({ at: { map: 'steamsuite', entry: 'stair' }, seed: 7 })
    const { s } = me
    s.flags['item:no'] = true
    const intoTheRoom = () => {
      me.walk(14.5, 5.5)
      me.leave(1, 0, () => s.zoneIndex === 1 || s.mode === 'dialog')
      me.until(() => s.mode !== 'scroll', 200)
      me.tick()
      me.read()
      return s.map.enemies.find(e => e.kind === 'sycophant')
    }
    const boss = intoTheRoom()
    // Two cuts are taken as given: the third is made as it is made in play, a gift refused and a blow on the open face.
    // The hero stands close under where the banner will hang.
    boss.hp = 2
    me.walk(24.5, 4.3)
    const never = () => assert.ok(s.mode !== 'won' && !s.flags.won && !s.flags.sycophant && !s.flags['item:weightNo'], `mode ${s.mode}`)
    const nearest = () => s.map.projectiles.filter(q => q.kind === 'gift').reduce((m, q) => Math.min(m, Math.hypot(q.x - s.hero.x, q.y - s.hero.y)), Infinity)
    me.until(() => !!s.beat, 40 * FPS, f => {
      const open = Z.bossOpen(boss)
      const press = f % 8 === 0 && (open ? Math.hypot(boss.x - s.hero.x, boss.y - s.hero.y) < 1.9 : nearest() < 2.1)
      return { autoFace: true, move: open ? unit(boss.x - s.hero.x, boss.y - s.hero.y, 0.3) : { x: 0, y: 0 }, aPress: press, a: press }
    })
    const from = me.events.length
    // Through the whole beat, and long after it with the banner hanging.
    while (s.beat) { me.tick(); never() }
    assert.ok(s.hero.y > 4.3, 'a hero under the paper is moved south of it as it settles')
    me.read()
    for (let i = 0; i < 20 * FPS; i++) { me.tick(); never() }
    assert.ok(!me.events.slice(from).some(e => ['won', 'exit', 'toss', 'bath', 'bossDown'].includes(e.type)), 'no ending, no more gifts, nothing saved')
    // A save made now (with THE NO) loads as any save does, and finds the fight at its start.
    const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    const again = Z.createGame(Z.WORLD, { save })
    assert.deepEqual([again.map.id, again.entry.entry, again.flags['item:no'], again.mode, again.beat], ['steamsuite', 'stair', true, 'play', undefined])
    assert.deepEqual(again.map.enemies.map(e => [e.kind, e.hp]), [['sycophant', 4]])
    // The way you came is open under the banner: out to the stair and back in, and there is no banner.
    const out = () => ({ move: unit(14.5 - s.hero.x, 5.8 - s.hero.y) })
    me.walk(18, 6)
    me.until(() => s.zoneIndex === 0 && s.mode === 'play', 600, out)
    const fresh = intoTheRoom()
    assert.deepEqual([fresh.hp, fresh.ai.mode === 'hung', !!s.flags.sycophant], [4, false, false])
    me.walk(23.5, 7); me.walk(23.5, 2.6)
    never()
  })
})
