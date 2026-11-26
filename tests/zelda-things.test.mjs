// Neon Shrine's things drawn by hand for the isometric view (render/iso/things.ts, thingArt.ts; part 23): the van, the
// tents, the fires, the mast, the tanks, the DJ booths and the furniture, drawn by Codex over guides built from solids,
// each px with the guide's normal and depth. Bundled with esbuild like the other zelda tests; no canvas is made here.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installArtFetch, kitTable } from './helpers/art.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export * from './render/iso/things'; export { THING_ART } from './render/iso/thingArt'; export { rowsHash } from './render/iso/folk'; export { buildProps, depthCode } from './render/iso/props'; export { spriteRows } from './render/sheet'; export { REALM_ART_LOADERS, loadRealmArt, realmArt, hasRealmArt, kitsFor } from './render/iso/frontierArt'; export { WORLD } from './world'; export { sceneryAt, sceneryPlaces } from './world/scenery'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
/** Every realm's kit, each loaded from its own art pack (`frontierArt/index.ts`, `artPack.ts`) as the view does. */
let REALM_KIT
/** The same packs unpacked to rows and palettes (tests/helpers/art.mjs), for the checks on what is drawn. */
let REALM_THING_ART
before(async () => {
  installArtFetch()
  M = await load()
  REALM_KIT = Object.fromEntries(await Promise.all(Object.keys(M.REALM_ART_LOADERS).map(async r => [r, await M.loadRealmArt(r)])))
  REALM_THING_ART = Object.fromEntries(await Promise.all(Object.entries(REALM_KIT).map(async ([r, kit]) => [r, await kitTable(Object.values(kit)[0].pack)])))
})

// Every thing drawn, and the animations that must keep all their frames.
const THINGS = ['van', 'tent', 'fort', 'bike', 'mast', 'mast_on', 'tank_0', 'tank_1', 'campfire_0', 'campfire_1', 'campfire_2',
  'bonfire_0', 'bonfire_1', 'bonfire_2', 'speaker', 'table_mixer', 'table_records', 'lights_0', 'lights_1', 'lights_2', 'lights_3']
// Drawn from the studio's live pack (the bonfire as the site shows it), not the repo's rows.
const LIVE = new Set(['bonfire_0', 'bonfire_1', 'bonfire_2'])
const bytes = b64 => Buffer.from(b64, 'base64')

describe('things drawn by hand', () => {
  it('has every thing, each a clean rectangle in its palette, with a normal and a depth for every px', () => {
    for (const id of THINGS) assert.ok(M.THING_ART[id], id)
    for (const [id, t] of Object.entries(M.THING_ART)) {
      const geo = t.like ? M.THING_ART[t.like] : t
      assert.ok(geo && !geo.like, `${id}: like`)
      assert.equal(geo.w, t.w, id); assert.equal(geo.h, t.h, id)
      assert.equal(t.rows.length, t.h, id)
      const deep = bytes(geo.deep)
      assert.equal(deep.length, t.w * t.h, id)
      let n = 0
      for (let y = 0; y < t.h; y++) {
        assert.equal(t.rows[y].length, t.w, `${id} row ${y}`)
        for (let x = 0; x < t.w; x++) {
          const ch = t.rows[y][x]
          if (ch === '.') continue
          n++
          assert.ok(t.pal[ch], `${id}: ${ch}`)
          assert.ok(geo.npal[geo.nrows[y].charCodeAt(x) - 48], `${id}: normal at ${x},${y}`)
          assert.ok(deep[y * t.w + x] > 0, `${id}: depth at ${x},${y}`)
        }
      }
      assert.ok(n > 100, `${id} has ${n} px`)
      // The anchor (the ground under the middle) lies in the picture, its middle third across.
      assert.ok(t.ax > t.w / 3 && t.ax < (t.w * 2) / 3, `${id} ax ${t.ax}`)
      // (The fairy lights hang on their poles over the speakers: their ground lies below the picture.)
      assert.ok(t.ay > 0 && t.ay <= t.h + (id.startsWith('lights') ? 30 : 4), `${id} ay ${t.ay}`)
      for (const v of Object.values(t.glow)) assert.ok(v > 0 && v <= 1, id)
    }
  })

  it('was drawn from the classic sprites the game shows now', () => {
    for (const [id, t] of Object.entries(M.THING_ART)) {
      for (const [name, hash] of Object.entries(t.src ?? {})) {
        assert.match(hash, /^[0-9a-f]{8}$/)
        if (!LIVE.has(id)) assert.equal(M.rowsHash(M.spriteRows(name)), hash, `${id} from ${name}`)
      }
    }
    for (const id of ['van', 'tent', 'fort', 'bike', 'campfire_0', 'tank_1', 'mast_on']) assert.ok(M.hasThing(id), id)
  })

  it('lets the fires, the lamps and the bulbs glow, and not the van\'s paint', () => {
    const glowing = id => { const t = M.THING_ART[id]; let g = 0, n = 0; for (const r of t.rows) for (const ch of r) if (ch !== '.') { n++; if (t.glow[ch]) g++ } return g / n }
    for (const id of ['campfire_0', 'bonfire_1']) assert.ok(glowing(id) > 0.1, id)
    assert.ok(glowing('mast_on') > glowing('mast'))
    assert.ok(glowing('van') < 0.05)
  })

  it('packs them under the built things, leaving those as they were', () => {
    const props = M.buildProps()
    const a = M.withThings(props)
    assert.equal(a.w, props.w)
    assert.ok(a.h > props.h)
    assert.deepEqual(a.albedo.subarray(0, props.albedo.length), props.albedo)
    assert.deepEqual(a.normal.subarray(0, props.normal.length), props.normal)
    const boxes = Object.keys(M.THING_ART).map(id => a.sprites[M.thingKey(id)])
    for (const b of boxes) assert.ok(b.y >= props.h && b.x >= 0 && b.x + b.w <= a.w && b.y + b.h <= a.h)
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const p = boxes[i], q = boxes[j]
      assert.ok(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y, 'overlap')
    }
    assert.equal(M.withThings(props), a)
  })

  it('packs each realm kit separately and supplies every landmark frame of every map', () => {
    const props = M.buildProps()
    const base = M.withThings(props)
    for (const [realm, art] of Object.entries(REALM_THING_ART)) {
      const atlas = M.withThings(props, REALM_KIT[realm])
      assert.ok(atlas.h <= 2048, `${realm} atlas: ${atlas.h}px tall`)
      assert.deepEqual(Object.keys(REALM_KIT[realm]), Object.keys(art), realm)
      for (const [id, t] of Object.entries(art)) {
        const box = atlas.sprites[M.thingKey(id)]
        assert.ok(box && box.y >= base.h, id)
        assert.equal(t.rows.length, t.h, id)
        assert.equal(t.nrows.length, t.h, id)
        assert.equal(bytes(t.deep).length, t.w * t.h, id)
      }
    }
    for (const [id, def] of Object.entries(M.WORLD.maps)) {
      const kits = M.kitsFor(def).map(k => REALM_THING_ART[k])
      for (const lm of def.isoLandmarks ?? []) {
        const variants = [lm.art, lm.night, lm.lit?.art].filter(Boolean)
        for (const variant of variants) {
          const names = lm.motion && !lm.motion.bob
            ? Array.from({ length: lm.motion.frames }, (_, i) => `${variant}_${i}`)
            : [variant]
          for (const name of names) assert.ok(M.THING_ART[name] || kits.some(k => k?.[name]), `${id}: ${name}`)
        }
        if (lm.art.startsWith('road_lantern_')) {
          const x = Math.floor(lm.x), y = Math.floor(lm.y)
          assert.match(def.rows[y][x], /^[.:;-]$/, `${id}: lantern on the verge`)
          assert.ok([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([nx, ny]) => def.rows[ny][nx] === ','), id)
        }
      }
    }
    // The presets the lands will be drawn with have their art in their realm's kit too.
    let found = 0
    for (const [realm, place] of M.sceneryPlaces()) {
      for (const lm of M.sceneryAt(realm, place, 0, 0)) {
        found++
        const names = lm.motion && !lm.motion.bob ? Array.from({ length: lm.motion.frames }, (_, i) => `${lm.art}_${i}`) : [lm.art]
        for (const name of names) assert.ok(M.THING_ART[name] || REALM_THING_ART[realm]?.[name] || REALM_THING_ART.coast?.[name], `${realm}/${place}: ${name}`)
      }
    }
    assert.ok(found > 30, `${found} preset landmarks`)
    // A map that names more kits than its realm's (Seter Fell's meadow) puts them on the GPU together: they still fit.
    for (const [id, def] of Object.entries(M.WORLD.maps)) {
      const kits = M.kitsFor(def)
      if (kits.length < 2) continue
      const atlas = M.withThings(props, Object.assign({}, ...kits.map(k => REALM_KIT[k])))
      assert.ok(atlas.h <= 2048, `${id}'s kits ${kits.join('+')} pack ${atlas.h}px tall`)
    }
    assert.equal(M.withThings(props), base)
  })

  it('adds lit night windows and keeps each directional lamp frame distinct', () => {
    const windowPairs = [
      ['seterfell', 'seter_hut_0', 'seter_hut_night_0'],
      ['seterfell', 'seter_hut_1', 'seter_hut_night_1'],
      ['yulefjord', 'fjord_cottage', 'fjord_cottage_night'],
      ['sporelight', 'sporelight_bathhouse', 'sporelight_bathhouse_night'],
      ...[0, 1, 1958, 1986, 2086].map(era => ['rerun', `rerun_house_${era}`, `rerun_house_${era}_night`]),
    ]
    const glow = t => t.rows.reduce((total, row) => total + [...row].reduce((sum, pixel) => sum + (t.glow[pixel] ?? 0), 0), 0)
    for (const [realm, day, night] of windowPairs) {
      const a = REALM_THING_ART[realm][day]
      const b = REALM_THING_ART[realm][night]
      assert.deepEqual([a.w, a.h, a.ax, a.ay], [b.w, b.h, b.ax, b.ay], night)
      assert.notDeepEqual(a.pal, b.pal, night)
      assert.ok(glow(b) > 0, night)
    }
    for (const [realm, stem, count] of [['yulefjord', 'fjord_lighthouse_lens', 4], ['fogstage', 'fogstage_spotlight', 8]]) {
      const frames = Array.from({ length: count }, (_, i) => REALM_THING_ART[realm][`${stem}_${i}`])
      assert.ok(frames.every(t => glow(t) > 0), stem)
      assert.equal(new Set(frames.map(t => JSON.stringify([t.rows, t.pal, t.glow]))).size, count, stem)
    }
  })

  it('registers both road axes for each arch and the coast waymarks and barrier poses', () => {
    for (const realm of ['seterfell', 'sporelight', 'stillsand', 'rerun', 'lumenby', 'fogstage']) {
      const kit = REALM_THING_ART[realm]
      for (const stamp of ['gate', 'gate:ew']) {
        const [lm] = M.sceneryAt(realm, stamp, 10, 20)
        assert.deepEqual([lm.x, lm.y], [11.5, 21.5], realm)
        const off = kit[lm.art], on = kit[lm.night]
        assert.deepEqual([off.w, off.h, off.ax, off.ay], [on.w, on.h, on.ax, on.ay], lm.art)
        assert.deepEqual(off.glow, {}, lm.art)
        assert.ok(Object.keys(on.glow).length > 0, lm.night)
      }
    }
    const coast = REALM_THING_ART.coast
    for (const stem of ['waymark_seterfell_n', 'waymark_sporelight_n', 'waymark_stillsand_e', 'waymark_rerun_e', 'waymark_lumenby_n', 'waymark_fogstage_w']) {
      const [on, dim] = [coast[`${stem}_0`], coast[`${stem}_1`]]
      assert.notDeepEqual(on.glow, dim.glow, stem)
    }
    for (const road of ['ns', 'ew']) for (const pose of ['up', 'down']) assert.ok(coast[`border_${road}_${pose}`])
  })

  it('stands a piece of furniture once for its run of tiles', () => {
    const grid = ['#[[.[.#', '#((( ((', '#ww.Y.#', '#nn.~~.', '#nn....']
    const at = (x, y) => grid[y]?.[x] ?? '#'
    const f = (x, y, map = 'home') => M.furnitureAt(at, x, y, { map, lab: false, tick: 0 })
    if (M.hasThing('shelf_2')) { assert.deepEqual(f(1, 0), { id: 'shelf_2', x: 2, y: 0.3 }); assert.equal(f(2, 0), 'part') }
    if (M.hasThing('shelf_1')) assert.deepEqual(f(4, 0), { id: 'shelf_1', x: 4.5, y: 0.3 })
    if (M.hasThing('sofa_3')) { assert.deepEqual(f(1, 1), { id: 'sofa_3', x: 2.5, y: 1.5 }); assert.equal(f(3, 1), 'part') }
    assert.equal(f(5, 1), null) // a sofa two tiles long has no piece
    if (M.hasThing('plant')) assert.deepEqual(f(4, 2), { id: 'plant', x: 4.5, y: 2.55 })
    assert.equal(f(1, 3), null) // a counter is a counter, but in a room that says otherwise
    if (M.hasThing('bed')) { assert.deepEqual(f(1, 3, 'hut2'), null); assert.deepEqual(f(1, 1 + 2, 'x'), null) }
    assert.equal(f(3, 2), null)
    // In a lab: a console blinks between its two frames, a bench stands two tiles at a time, the coolant `~` is not a table.
    const lab = ['MnnnnS~~']
    const g = (x, tick = 0) => M.furnitureAt((x, y) => lab[y]?.[x] ?? '#', x, 0, { map: 'lab1', lab: true, tick })
    if (M.hasThing('console_0')) { assert.equal(g(0).id, 'console_0'); assert.equal(g(0, 1).id, 'console_1') }
    if (M.hasThing('bench_2')) { assert.deepEqual(g(1), { id: 'bench_2', x: 2, y: 0.5 }); assert.equal(g(2), 'part'); assert.deepEqual(g(3), { id: 'bench_2', x: 4, y: 0.5 }) }
    assert.equal(g(6), null)
  })
})
