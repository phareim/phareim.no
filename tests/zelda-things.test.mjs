// Neon Shrine's things drawn by hand for the isometric view (render/iso/things.ts, thingArt.ts): the one gate for the
// thing art as shipped, every land's kit from its real pack with every landmark of every map in it, and the furniture
// over the real rooms. Bundled with esbuild like the other zelda tests; no canvas is made here.
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

// Drawn from the studio's live pack (the bonfire as the site shows it), not the repo's rows.
const LIVE = new Set(['bonfire_0', 'bonfire_1', 'bonfire_2'])
const bytes = b64 => Buffer.from(b64, 'base64')

describe('things drawn by hand', () => {
  it('draws each as a rectangle in its palette with a normal and a depth for every px, fresh against the classic sprites', () => {
    for (const [id, t] of Object.entries(M.THING_ART)) {
      const geo = t.like ? M.THING_ART[t.like] : t
      assert.ok(geo && !geo.like, `${id}: like`)
      assert.deepEqual([geo.w, geo.h, t.rows.length], [t.w, t.h, t.h], id)
      const deep = bytes(geo.deep)
      assert.equal(deep.length, t.w * t.h, id)
      for (let y = 0; y < t.h; y++) {
        assert.equal(t.rows[y].length, t.w, `${id} row ${y}`)
        for (let x = 0; x < t.w; x++) {
          const ch = t.rows[y][x]
          if (ch === '.') continue
          assert.ok(t.pal[ch], `${id}: ${ch}`)
          assert.ok(geo.npal[geo.nrows[y].charCodeAt(x) - 48], `${id}: normal at ${x},${y}`)
          assert.ok(deep[y * t.w + x] > 0, `${id}: depth at ${x},${y}`)
        }
      }
      for (const [name, hash] of Object.entries(t.src ?? {})) if (!LIVE.has(id)) assert.equal(M.rowsHash(M.spriteRows(name)), hash, `${id} was drawn from other rows of ${name}`)
    }
  })

  it("packs each land's kit under the built things within 2048 px, with art for every landmark frame of every map and preset", () => {
    const props = M.buildProps()
    const base = M.withThings(props)
    for (const [realm, art] of Object.entries(REALM_THING_ART)) {
      const atlas = M.withThings(props, REALM_KIT[realm])
      assert.ok(atlas.h <= 2048, `${realm} atlas: ${atlas.h}px tall`)
      assert.deepEqual(Object.keys(REALM_KIT[realm]), Object.keys(art), realm)
      // The built things stand as they were, the kit under them, nothing on anything else.
      assert.deepEqual(atlas.albedo.subarray(0, props.albedo.length), props.albedo, realm)
      const boxes = [...Object.keys(M.THING_ART), ...Object.keys(art)].map(id => [id, atlas.sprites[M.thingKey(id)]])
      for (const [i, [id, p]] of boxes.entries()) {
        assert.ok(p && p.y >= props.h && p.x >= 0 && p.x + p.w <= atlas.w && p.y + p.h <= atlas.h, `${realm}: ${id} outside the atlas`)
        for (const [other, q] of boxes.slice(i + 1)) assert.ok(p === q || p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y, `${realm}: ${id} on ${other}`)
      }
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

  it('gives every furnished tile of the real rooms and labs a piece it has, a part of one, or the classic painter', () => {
    let pieces = 0
    let parts = 0
    for (const [map, def] of Object.entries(M.WORLD.maps)) {
      if (def.kind !== 'interior' && def.look !== 'lab') continue
      const at = (x, y) => def.rows[y]?.[x] ?? '#'
      for (let y = 0; y < def.rows.length; y++) for (let x = 0; x < def.rows[y].length; x++) for (const tick of [0, 1]) {
        const p = M.furnitureAt(at, x, y, { map, lab: def.look === 'lab', tick })
        if (p === 'part') parts++
        else if (p) {
          pieces++
          assert.ok(M.hasThing(p.id), `${map} ${x},${y}: ${p.id}`)
          assert.ok(Math.abs(p.x - x) <= 2 && Math.abs(p.y - y) <= 2, `${map} ${x},${y}: ${p.id} stands at ${p.x},${p.y}`)
        }
      }
    }
    assert.ok(pieces > 20 && parts > 0, `${pieces} pieces, ${parts} parts`)
  })
})
