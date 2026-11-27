// The frontier's realm looks (themes/zelda/render/looks.ts): the one gate for
// them. Every look has a row in every per-look table, and the pure painters
// (the materials, the plants, the sky) run for each.
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
    stdin: { contents: `export * from './render/looks'; export { LOOK_SHEETS, buildLookMaterials, buildMaterials } from './render/iso/materials'; export { buildBackdrop } from './render/iso/backdrop'`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

/** The plants' painter, with the one call it makes into the DOM (`makeCanvas`, for the atlas) stood in for. */
async function loadFlora() {
  const stub = `export const makeCanvas = (w, h) => ({ width: w, height: h, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) })`
  const out = await esbuild.build({
    stdin: { contents: `export * from './render/iso/flora'`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
    plugins: [{ name: 'sheet', setup(b) { b.onResolve({ filter: /\/sheet$/ }, () => ({ path: 'sheet', namespace: 'stub' })); b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: stub, loader: 'js' })) } }],
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let L
let F
before(async () => { L = await load(); F = await loadFlora() })

describe('the realm looks', () => {
  it('each have their row in every table, and their materials, plants and sky build', () => {
    assert.ok(L.REALM_LOOKS.length >= 6)
    const base = L.buildMaterials()
    const had = globalThis.document
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) }
    try {
      for (const look of L.REALM_LOOKS) {
        for (const [name, table] of Object.entries({ CLASSIC: L.CLASSIC, GROUND: L.GROUND, MOOD: L.MOOD, LOOK_SHEETS: L.LOOK_SHEETS })) assert.ok(table[look], `${name} has ${look}`)
        assert.equal(L.realmLook(look), look)
        // Its light and life: lamps, the shafts' colour, what moves in the air.
        const mood = L.MOOD[look]
        assert.ok(mood.lamps > 0 && mood.glow > 0 && mood.hero >= 0 && mood.hero <= 1 && Array.isArray(mood.life), look)
        for (const c of [...mood.lamp, mood.raysColor]) assert.match(c, /^#[0-9a-f]{6}$/, `${look}: ${c}`)
        const m = L.buildLookMaterials(look)
        assert.deepEqual([m.w, m.h], [base.w, base.h], `${look}: materials`)
        const flora = F.buildFlora(look)
        for (const kind of ['tree', 'canopy', 'bush', 'tall', 'tuft']) assert.ok(flora.sprites[kind].length > 0, `${look} ${kind}`)
        assert.ok(L.buildBackdrop(look, 640, 400).layers.length > 0, `${look}: the sky`)
      }
    } finally { globalThis.document = had }
    for (const other of [undefined, 'wild', 'lab', 'coast']) assert.equal(L.realmLook(other), null)
  })
})
