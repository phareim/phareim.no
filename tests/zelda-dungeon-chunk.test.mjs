// The dungeons' chunk (docs/games/neon-shrine.md, "The world in two parts"): the home page's world holds no dungeon;
// a door into one waits behind the fade until `world/dungeons.ts` has come, and gives up well when it does not. The
// engine, the loader and the real worlds, with loaders of the test's own; and the dungeons' pictures, which come with
// the maps, as the 8-bit painter asks for them. The size on `/` and the chunk's are in `zelda-world.test.mjs`.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const zelda = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')
let Z
before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export * from './engine/index'; export * from './dungeonLoad'; export { WORLD } from './world/index'
        export { CORE, worldExits, worldStartingAt } from './world/core'; export { DUNGEONS } from './world/dungeons'
        export { DUNGEON_BITS } from './world/dungeon-bits'; export { ATLAS } from './world/atlas'
        export { DUNGEON_SPRITES } from './render/spritesDungeons'; export { SPRITES } from './render/sprites'
        export { bitRewards } from './wallet'; export { WARP_TIME } from './types'`,
      resolveDir: zelda, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

/** The home page's world as a visit finds it: its own maps, the dungeons still to come. */
const home = () => ({ ...Z.CORE, maps: { ...Z.CORE.maps }, lazy: { pending: true } })
const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const step = (w, s, i = inp()) => Z.stepGame(w, s, 1 / 60, i)
const steps = (w, s, n, i = inp()) => { for (let k = 0; k < n; k++) step(w, s, i) }
const settle = () => new Promise(r => setImmediate(r))
const open = (s) => { s.dialog = null; s.mode = 'play' }

/** A new game on `map`, blade in hand, the foes away. */
function onMap(w, map) {
  const s = Z.createGame(w, { at: { map, entry: Object.keys(Z.mapInfo(w, map).entries)[0] } })
  // (The blade; and the prism, for a door that waits for it.)
  s.inv.sword = true
  s.inv.prism = true
  s.flags['item:prism'] = true
  open(s)
  s.map.enemies = []
  s.hero.auto = null
  return s
}

/** Walks the hero into `door` (a warp of the map `s` is on) from the first side that leads in; returns that way. */
function walkIn(w, s, door) {
  const info = Z.mapInfo(w, s.map.id)
  // (A cracked wall in front of a door is bombed first.)
  const at = door.y * info.w + door.x
  if (Z.solidTile(w, s.map, door.x, door.y)) { s.map.tiles[at] = '.'; s.map.version++ }
  for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0]]) {
    const x = door.x + dx + 0.5
    const y = door.y + dy + 0.5
    if (Z.circleBlocked(w, s.map, x, y, 0.34)) continue
    open(s)
    Object.assign(s.hero, { x, y, auto: null, knock: null })
    s.zoneIndex = Z.cellIndex(info, x, y)
    s.zone = info.def.kind === 'dungeon' ? Z.cellRect(info, s.zoneIndex) : s.zone
    const move = { x: -dx, y: -dy }
    for (let k = 0; k < 90 && s.mode !== 'warp'; k++) {
      step(w, s, inp({ move }))
      if (s.mode === 'dialog') open(s)
    }
    if (s.mode === 'warp' && s.warp.to === door.to) return move
  }
  assert.fail(`no way into the door to ${door.to} on ${s.map.id}`)
}

describe('the dungeons\' chunk', () => {
  it('the split changes nothing: the same maps, rewards, doors and exits, in two parts', () => {
    const core = Object.keys(Z.CORE.maps)
    const far = Object.keys(Z.DUNGEONS)
    assert.deepEqual(far.filter(id => core.includes(id)), [], 'a map is in both: take it out of world/lands.ts, world/core.ts or its land\'s MAPS (world/dungeons.ts keeps it)')
    assert.deepEqual([...core, ...far].sort(), Object.keys(Z.WORLD.maps).sort(), 'world/index.ts must be world/core.ts and world/dungeons.ts and no more: register a dungeon in world/dungeons.ts only')
    assert.deepEqual(new Map([...Z.bitRewards(Z.CORE), ...Object.entries(Z.DUNGEON_BITS)]), Z.bitRewards(Z.WORLD),
      'what the dungeons\' chests and floor items pay: keep world/dungeon-bits.ts in step')
    for (const [id, def] of Object.entries(Z.DUNGEONS)) {
      const stay = `${id} cannot be in world/dungeons.ts: move it to world/core.ts (or give it what a dungeon needs)`
      assert.ok(def.resume, `${stay}; it is not \`resume: true\``)
      assert.ok(!Z.ATLAS[id], `${stay}; it is on the atlas`)
      assert.ok(!Object.values(def.marks).some(m => m.ent.t === 'exit'), `${stay}; it holds an exit`)
    }
    // Every door out of a dungeon, and every door into one, leads somewhere: to a map of either part, to an entry it has.
    for (const [id, def] of Object.entries(Z.WORLD.maps)) {
      const inside = !!Z.DUNGEONS[id]
      for (const wp of Z.mapInfo(Z.WORLD, id).warps) {
        if (!inside && !Z.DUNGEONS[wp.to]) continue
        assert.ok(Z.hasEntry(Z.WORLD, wp.to, wp.entry), `${id}: the door to ${wp.to}:${wp.entry} leads nowhere (world/dungeons.ts)`)
      }
      if (inside && def.below) assert.ok(Z.WORLD.maps[def.below], `${id}: its pits drop to ${def.below}, which no part holds (world/dungeons.ts)`)
    }
    assert.deepEqual(Z.worldExits(Z.CORE), Z.worldExits(Z.WORLD), 'an exit stands in a dungeon: the home page\'s link list would drop it (its map belongs in world/core.ts)')
  })

  it('a door whose map is not there yet holds dark until it comes, and a save inside waits for it', async () => {
    const w = home()
    // A save made in a dungeon, a tile or two of it seen.
    const inside = onMap(Z.WORLD, 'echobarrow')
    steps(Z.WORLD, inside, 5)
    const save = Z.toSave(inside)
    assert.ok(save.explored?.echobarrow, 'the Barrow was seen')
    const town = Z.toSave(onMap(w, 'overworld'))
    const old = { ...town, map: 'fr:3,4', entry: 'camp', explored: { 'fr:3,4': save.explored.echobarrow } }
    assert.equal(Z.bootPlan(w, null, null, false), 'now')
    assert.equal(Z.bootPlan(w, town, null, true), 'now')
    assert.equal(Z.bootPlan(w, old, null, true), 'now', 'a save from the frontier that is gone waits for nothing')
    assert.equal(Z.bootPlan(w, save, null, true), 'wait')
    assert.equal(Z.bootPlan(w, save, null, false), 'now', 'a new visit starts in town')
    // A game made before the chunk keeps what the save saw of the dungeon, and still drops what is gone.
    const early = Z.createGame(w, { save, at: w.start })
    assert.equal(Z.toSave(early).explored.echobarrow, save.explored.echobarrow)
    assert.equal(Z.createGame(w, { save: old }).explored?.['fr:3,4'], undefined)
    assert.ok(Z.doorAhead(w, 'seterfell') && !Z.doorAhead(w, 'overworld'), 'the chunk is fetched in a land with a door, not in town')

    const copy = Z.worldStartingAt('overworld', 'start', w)
    const s = onMap(w, 'seterfell')
    const door = Z.mapInfo(w, 'seterfell').warps.find(d => d.to === 'echobarrow')
    walkIn(w, s, door)
    let arrive
    const hold = Z.newHold(() => Z.loadDungeons(() => new Promise(r => { arrive = r }), w))
    for (let k = 0; k < 120; k++) { step(w, s); assert.equal(Z.holdStep(s, w, hold, 1 / 60), 'wait') }
    assert.deepEqual([s.mode, s.warp.t, s.warp.swapped, s.map.id], ['warp', Z.WARP_TIME, false, 'seterfell'])
    arrive(Z.DUNGEONS)
    await settle()
    step(w, s)
    assert.deepEqual([s.map.id, s.entry], ['echobarrow', { map: 'echobarrow', entry: door.entry }])
    assert.equal(Z.holdStep(s, w, hold, 1 / 60), 'none')
    steps(w, s, 60)
    assert.equal(s.mode === 'warp', false)
    // The copy made before the load sees it too, and so does a reload: the save continues where it was.
    assert.equal(copy.lazy.pending, false)
    assert.equal(Z.createGame(copy, { save }).map.id, 'echobarrow')
    // The site's own loader brings the same maps.
    const again = home()
    await Z.loadDungeons(undefined, again)
    assert.deepEqual(Object.keys(again.maps).sort(), Object.keys(Z.WORLD.maps).sort())
  })

  it('a chunk that fails: asked again, then every door gives the hero back unharmed, and the next try is a new one', async () => {
    const down = () => Promise.reject(new TypeError('Failed to fetch dynamically imported module'))
    const w = home()
    // A failure is forgotten: the next call asks again.
    await assert.rejects(Z.loadDungeons(down, w))
    assert.equal(w.lazy.pending, true)
    await Z.loadDungeons(async () => Z.DUNGEONS, w)
    assert.equal(w.lazy.pending, false)
    // One second try, but none for a file that is gone with its build.
    for (const [outdated, error, asks] of [[false, 'Failed to fetch dynamically imported module', 2], [true, 'Failed to fetch', 1], [false, "'text/html' is not a valid JavaScript MIME type", 1]]) {
      let n = 0
      await assert.rejects(Z.withRetry(() => { n++; return Promise.reject(new TypeError(error)) }, () => outdated))
      assert.equal(n, asks, error)
    }
    let flaky = 0
    await Z.withRetry(() => (flaky++ ? Promise.resolve() : down()))

    // Every door into a dungeon.
    const shut = home()
    const doors = Object.keys(shut.maps).flatMap(map => Z.mapInfo(shut, map).warps.filter(d => Z.DUNGEONS[d.to]).map(door => ({ map, door })))
    assert.ok(doors.length >= 7, `${doors.length} doors`)
    for (const [i, { map, door }] of doors.entries()) {
      const where = `${map} → ${door.to}`
      const s = onMap(shut, map)
      walkIn(shut, s, door)
      // By turns: the fetch fails, or it never answers and the wait runs out.
      const fails = i % 2 === 0
      let reject
      const hold = Z.newHold(() => (fails ? down() : new Promise((_, no) => { reject = no })))
      let verdict = 'wait'
      let waited = 0
      for (; verdict === 'wait' && waited < 900; waited++) {
        step(shut, s)
        verdict = Z.holdStep(s, shut, hold, 1 / 60)
        await settle()
      }
      assert.equal(verdict, 'abort', where)
      assert.equal(s.warp.t, Z.WARP_TIME, `${where}: given up only in the full dark`)
      assert.equal(hold.failed, fails, where)
      assert.ok(fails ? waited < 60 : Math.abs(waited / 60 - Z.HOLD_S) < 0.1, `${where}: gave up after ${waited / 60} s`)
      const before = Z.toSave(s)
      const offline = i === 0
      assert.equal(Z.abortWarp(s, shut, offline), true)
      const clear = () => {
        const h = s.hero
        assert.ok(!Z.circleBlocked(shut, s.map, h.x, h.y, 0.34), `${where}: set down on open ground`)
        for (const r of Z.mapInfo(shut, map).warps) assert.ok(!(h.x >= r.x && h.x < r.x + r.w && h.y >= r.y && h.y < r.y + r.h), `${where}: off every door`)
        assert.ok(Math.hypot(h.x - door.x - 0.5, h.y - door.y - 0.5) < 2.6, `${where}: beside the door`)
      }
      clear()
      steps(shut, s, 30)
      assert.deepEqual([s.map.id, s.mode, s.dialog?.lines], [map, 'dialog', [offline ? Z.DOOR_SHUT_OFFLINE : Z.DOOR_SHUT]], where)
      assert.deepEqual(Z.toSave(s), before, `${where}: nothing of the save changed`)
      for (let k = 0; k < 600 && s.mode === 'dialog'; k++) step(shut, s, inp({ aPress: k % 6 === 0 }))
      assert.equal(s.mode, 'play', where)
      for (let k = 0; k < 100; k++) { step(shut, s); assert.notEqual(s.mode, 'warp', `${where}: the door does not take the hero back by itself`) }
      clear()
      // The next walk into the door is a new try, and a late failure of the one given up on is not held against it.
      const late = reject
      walkIn(shut, s, door)
      assert.equal(Z.holdStep(s, shut, hold, 1 / 60), 'wait', where)
      late?.(new TypeError('late'))
      await settle()
      assert.equal(hold.failed, fails, `${where}: only the new try's own failure counts`)
    }
  })

  it('the dungeons\' pictures come with their maps: none on `/` but what is carried out of them, every one there once loaded', async () => {
    // The table takes every row the dungeons bring: it leaves out a name that is taken, and rows that are no picture.
    assert.deepEqual(Object.entries(Z.DUNGEON_SPRITES).filter(([n, rows]) => Z.SPRITES[n]?.rows !== rows).map(([n]) => n), [],
      'not in the table: a doubled name, ragged rows or a letter the palette lacks')
    // The home page's modules as the site splits them: what arrives at once, and the chunk as a file of its own.
    const dir = mkdtempSync(join(tmpdir(), 'zelda-chunk-'))
    const had = globalThis.document
    try {
      writeFileSync(join(dir, 'package.json'), '{"type":"module"}')
      esbuild.buildSync({
        stdin: {
          contents: `export * from './engine/index'; export { enterMap } from './engine/game'; export { mapInfo } from './engine/map'
            export { CORE } from './world/core'; export { loadDungeons } from './dungeonLoad'; export { SPRITES } from './render/sprites'
            export { sprite } from './render/sheet'; export { createRenderer } from './render/renderer'; export { itemSpriteName } from './render/itemIcon'
            export { B_ITEMS } from './types'`,
          resolveDir: zelda, loader: 'ts', sourcefile: 'home.ts',
        },
        bundle: true, splitting: true, format: 'esm', outdir: dir, platform: 'neutral', logLevel: 'error', external: ['./render/iso/view'],
      })
      globalThis.document = { createElement: () => fakeCanvas() }
      const H = await import(pathToFileURL(join(dir, 'stdin.js')))
      // Every name the table is asked for and does not hold.
      const missing = new Set()
      Object.setPrototypeOf(H.SPRITES, new Proxy({}, { get: (_, name) => { if (typeof name === 'string') missing.add(name); return undefined } }))
      const renderer = H.createRenderer(fakeCanvas(), H.CORE)
      renderer.resize(1280, 800, 1)
      const ui = { paused: false, confirmReset: false, muted: true, reducedMotion: false, touch: false, stick: null, attract: false, cam: null, banner: null, keys: { a: 'SPACE', b: 'K', cycle: 'Q' } }
      const draw = (s, more) => renderer.draw(s, { ...ui, ...more }, 1 / 60)

      // Before: no boss, and everything a save can carry out of a dungeon.
      // Each dungeon's boss by one of its frames.
      const frames = { parrot: 'parrot_0', sycophant: 'syco_0', blackbox: 'box_0', golem: 'golem_m_0', weaver: 'weaver_face_0', copilot: 'copilot_side_neon', hallucinator: 'hallu_0' }
      const bosses = Object.values(frames)
      assert.deepEqual(bosses.filter(n => Object.hasOwn(H.SPRITES, n)), [], 'a boss is on the home page')
      const items = ['sword', 'bombBag', 'bombs5', 'disc', 'smallKey', 'bigKey', 'heartPiece', 'heartContainer', 'heart', 'bits5', 'bits20', 'bits50', 'prism', 'hook', 'arc', 'bigBag', 'waffle', 'shroom', 'tube', 'walkie', 'hat', 'artHop', 'echo', 'no', 'lamp', 'magnet', 'stomp', 'lens', 'duck', 'weightMeaning', 'weightReasons', 'weightNo', 'weightSurprise', 'weightFingers', 'weightCredit', 'weightSources']
      missing.clear()
      for (const name of [...items.map(H.itemSpriteName), ...H.B_ITEMS.map(t => t.icon)]) H.sprite(name)
      // The treasures in use in the town: the ITEMS page, the HUD, the lamp and the duck set down.
      const town = H.createGame(H.CORE, { seed: 7 })
      Object.assign(town.inv, { sword: true, lamp: true, magnet: true, duck: true, echo: true, no: true, stomp: true, lens: true, selected: 'lamp' })
      for (const i of items.filter(n => n.startsWith('weight'))) town.flags[`item:${i}`] = true
      town.dialog = null
      town.mode = 'play'
      const at = (dx) => ({ x: town.hero.x + dx, y: town.hero.y })
      town.lamp = { idx: Math.floor(at(1).y) * town.map.w + Math.floor(at(1).x), dir: 'right', under: '.' }
      town.duck = { ...town.duck, ...at(-1) }
      draw(town)
      draw(town, { paused: true, menu: 'items' })
      assert.deepEqual([...missing], [], 'seen outside a dungeon, so it belongs on the home page (render/spritesCarried.ts)')

      // A picture asked for too early is a blank that does no harm, and is not remembered.
      assert.deepEqual([H.sprite('parrot_0').width, H.sprite('parrot_0', true).width], [1, 1])
      await H.loadDungeons()
      assert.deepEqual([H.sprite('parrot_0').width, H.sprite('parrot_0', true).width], [48, 48])
      // (And the paper banner, which comes down only at the Sycophant's true line: no bystander gets there.)
      assert.deepEqual([...bosses, 'banner_end', 'banner_loose'].filter(n => !Object.hasOwn(H.SPRITES, n)), [])

      // (Adding the rows looked each name up first.)
      missing.clear()

      // After: every dungeon map from each of its ways in, and every boss through half a minute of its fight (the hero
      // standing by and unharmed; the boss struck now and then, worn down, and at last felled).
      const far = Object.keys(H.CORE.maps).filter(id => !Z.CORE.maps[id])
      assert.deepEqual(far.sort(), Object.keys(Z.DUNGEONS).sort())
      const seen = new Set()
      const idle = { move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false }
      for (const id of far) {
        const info = H.mapInfo(H.CORE, id)
        for (const entry of Object.keys(info.entries)) {
          const s = H.createGame(H.CORE, { seed: 7, at: { map: id, entry } })
          s.dialog = null
          s.mode = 'play'
          draw(s)
        }
        const there = H.createGame(H.CORE, { seed: 7, at: { map: id, entry: Object.keys(info.entries)[0] } })
        for (const boss of there.map.enemies.filter(e => frames[e.kind])) {
          seen.add(boss.kind)
          const s = H.createGame(H.CORE, { seed: 7 })
          s.inv.sword = true
          H.enterMap(H.CORE, s, id, '', [], { x: boss.x, y: boss.y + 2 })
          const e = s.map.enemies.find(o => o.kind === boss.kind)
          const full = e.hp
          for (let k = 0; k < 900; k++) {
            s.dialog = null
            s.mode = 'play'
            Object.assign(s.hero, { hp: s.hero.maxHp, invuln: 1 })
            if (k % 90 === 45) e.flash = 0.2
            if (k === 450) e.hp = Math.max(1, Math.floor(full / 3))
            if (k === 870) e.dead = true
            H.stepGame(H.CORE, s, 1 / 30, idle)
            draw(s)
          }
        }
      }
      assert.deepEqual([...seen].sort(), Object.keys(frames).sort(), 'every boss was looked at')
      // (The bar over a foe measures both steps of a walk, whether there are two: these are no pictures anyone drew.)
      const probes = ['copilot_side_neon_0', 'golem_m_1']
      assert.deepEqual([...missing].filter(n => !probes.includes(n)), [], 'asked for in a dungeon and in no table: its rows are not in render/spritesDungeons.ts')
    } finally {
      globalThis.document = had
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

/** A canvas that takes anything drawn on it. */
function fakeCanvas() {
  const noop = () => {}
  const pixels = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h) * 4) })
  const target = {
    getImageData: (x, y, w, h) => pixels(w, h), createImageData: pixels, measureText: () => ({ width: 0 }),
    createLinearGradient: () => ({ addColorStop: noop }), createRadialGradient: () => ({ addColorStop: noop }), createPattern: () => null,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  }
  const g = new Proxy(target, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true } })
  return { width: 1, height: 1, style: {}, getContext: () => g }
}
