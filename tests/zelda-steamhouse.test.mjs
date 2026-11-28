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
// The review's fixes (tmp/dungeons/briefs/20-steamhouse-fixes.md) are folded into these four: a tap at an offer is a NO
// and a bath from the suite opens the lobby's gate once the hounds are down (a, c); the Laundry's baskets cannot be
// pushed into a doorway and go home on leaving, and a gift never lands outside its paint (b); the bar is gold while the
// banner hangs (a).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { STEAM_EXPORTS, FPS, unit, player, play, use } from './zelda-plays/steamhouse.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')

/** The engine and the world, as every zelda test loads them, and the Steamhouse's own numbers on top. */
async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export * from './engine/index'; export { WORLD } from './world/index'; export * from './types'; export { validateWorld } from './world/validate'; ${STEAM_EXPORTS}`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let Z
before(async () => { Z = await load(); use(Z) })

describe('the Steamhouse', () => {
  it('can be played from the door in the Sporelight to the Weight in hand, by a hero with the blade only', () => {
    const g = Z.createGame(Z.WORLD, { at: { map: 'sporelight', entry: 'steamhouse' }, seed: 3 })
    g.hero.maxHp = g.hero.hp = 30
    // A hero who carries things, so that a bath can be seen to take only the hurt.
    Object.assign(g.inv, { bombBag: true, bombs: 5, selected: 'bombs', bits: 37 })
    g.flags.somethingOld = true
    play(Z, g)
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

    // THE LAUNDRY: a basket is never pushed to a stop in a doorway, and the baskets go home when the hero comes back.
    const wash = player({ at: { map: 'steamhouse', entry: 'baths' }, seed: 3 })
    const ws = wash.s
    const at = (x, y) => ws.map.tiles[idx(ws, x, y)]
    const tele = (x, y, zone) => { ws.hero.x = x; ws.hero.y = y; wash.until(() => ws.zoneIndex === zone && ws.mode === 'play', 300) }
    tele(7.5, 9.5, 0)
    // Two baskets at the south doorway's mouth, pushed south: they stay where they are.
    ws.map.tiles[idx(ws, 7, 10)] = 'b'; ws.map.tiles[idx(ws, 8, 10)] = 'b'
    for (const x of [7.5, 8.5]) {
      ws.hero.x = x; ws.hero.y = 9.0
      for (let i = 0; i < 120; i++) wash.tick({ move: { x: 0, y: 1 } })
    }
    assert.deepEqual([at(7, 10), at(8, 10), at(7, 11), at(8, 11)], ['b', 'b', '.', '.'], 'no basket in the south doorway')
    // The gate open, two baskets on the way east: the corridor mouth stays clear.
    for (const x of [14, 15]) for (const y of [5, 6]) ws.map.tiles[idx(ws, x, y)] = '.'
    ws.flags['gate:steamhouse.14,5'] = true
    ws.map.tiles[idx(ws, 13, 5)] = 'b'; ws.map.tiles[idx(ws, 13, 6)] = 'b'
    for (const y of [5.5, 6.5]) {
      ws.hero.x = 12.0; ws.hero.y = y
      for (let i = 0; i < 160; i++) wash.tick({ move: { x: 1, y: 0 } })
    }
    assert.deepEqual([at(14, 5), at(14, 6), at(15, 5), at(15, 6)], ['b', 'b', '.', '.'], 'no basket in the east doorway')
    // Out by the south door and back in: the baskets are home, solved room or not.
    tele(7.5, 14.5, 3)
    tele(7.5, 9.5, 0)
    assert.deepEqual([at(3, 4), at(12, 4), at(14, 5), at(7, 10)], ['b', 'b', '.', '.'], 'the baskets come home')

    // The Gift Shop, many seeds, a hero put down at random places and often just outside a lane: a gift that lands on
    // him (the bath begins) lands inside the paint, which runs from the sleeve to the wall the gift bursts on.
    let landed = 0
    let nearMiss = 0
    for (let seed = 1; seed <= 10; seed++) {
      const me = player({ at: { map: 'steamhouse', entry: 'baths' }, seed })
      const { s } = me
      s.hero.x = 29.5; s.hero.y = 17.5
      me.until(() => s.zoneIndex === 4 && s.mode === 'play', 300)
      me.leave(1, 0, () => s.zoneIndex === 5)
      let r = seed * 7919
      const rnd = () => { r = (r * 1103515245 + 12345) & 0x7fffffff; return r / 0x7fffffff }
      const lw = { w: Z.WORLD, s }
      const memory = new Map()
      for (let f = 0; f < 50 * FPS && s.mode === 'play'; f++) {
        const gifts = s.map.projectiles.filter(q => q.kind === 'gift')
        for (const p of gifts) if (!memory.has(p.id)) memory.set(p.id, Z.flightLane(p, lw))
        const lanes = [...Z.throwerLanes(lw), ...gifts.map(p => memory.get(p.id))]
        if (f % 20 === 0) {
          // A spot beside a lane (0.6 to 1.0 tiles off its middle) or anywhere on the floor.
          const L = lanes[Math.floor(rnd() * lanes.length)]
          if (L && rnd() < 0.8) {
            const dx = L.x1 - L.x0, dy = L.y1 - L.y0, len = Math.hypot(dx, dy) || 1
            const u = 0.5 + rnd() * (len - 0.5), lat = (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.4)
            const x = L.x0 + (dx / len) * u - (dy / len) * lat, y = L.y0 + (dy / len) * u + (dx / len) * lat
            if (x > 33.5 && x < 46.5 && y > 16 && y < 19.8) { s.hero.x = x; s.hero.y = y }
          } else { s.hero.x = 33.5 + rnd() * 13; s.hero.y = 16 + rnd() * 3.8 }
        }
        const ev = me.tick()
        if (ev.some(e => e.type === 'bath')) {
          landed++
          assert.ok(lanes.some(L => Z.inStencil(L, s.hero.x, s.hero.y)), `seed ${seed}: a gift landed on ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)} outside every lane`)
        } else if (lanes.some(L => !Z.inStencil(L, s.hero.x, s.hero.y) && Math.abs((s.hero.y - L.y0) * (L.x1 - L.x0) - (s.hero.x - L.x0) * (L.y1 - L.y0)) / Math.hypot(L.x1 - L.x0, L.y1 - L.y0) < 0.85)) nearMiss++
      }
    }
    assert.ok(landed >= 5 && nearMiss >= 50, `the trial is not empty (${landed} landed, ${nearMiss} steps just outside a lane)`)
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
    const kept = s => ({ inv: JSON.stringify(s.inv), flags: Object.keys(s.flags).filter(f => !/^(steamhouse\.(visited|bathed|bathed\.said|back)|steamsuite\.met|gate:)/.test(f)).sort() })
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
    // A bath from the suite opens the way back to the stair: the lobby's north gate. It still waits for the boiler's
    // hounds (they are alive here), and opens the moment they are down.
    assert.ok(s.flags['steamhouse.back'], 'a bath from the Best Room sets the short way')
    for (let i = 0; i < 20; i++) still.tick()
    assert.equal(s.map.tiles[12 * s.map.w + 23], 'X', 'the gate waits for the hounds')
    s.flags['gate:steamhouse.16,5'] = true
    for (let i = 0; i < 20; i++) still.tick()
    assert.equal(s.map.tiles[12 * s.map.w + 23], '.', 'and then the stair is two rooms from the pool')
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
