// Neon Shrine's things drawn by hand for the isometric view (render/iso/things.ts, thingArt.ts; part 23): the van, the
// tents, the fires, the mast, the tanks, the DJ booths and the furniture, drawn by Codex over guides built from solids,
// each px with the guide's normal and depth. Bundled with esbuild like the other zelda tests; no canvas is made here.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export * from './render/iso/things'; export { THING_ART } from './render/iso/thingArt'; export { rowsHash } from './render/iso/folk'; export { buildProps, depthCode } from './render/iso/props'; export { spriteRows } from './render/sheet'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

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
