// The frontier's realm looks (themes/zelda/render/looks.ts): every look has a
// row in every per-look table, the ground's classic colours keep to the colour
// family the 16-bit view's ground shader takes for the slot they are laid in,
// and the pure painters (the materials, the plants' tables) run for each look.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

async function load() {
  const out = esbuild.buildSync({
    stdin: { contents: `export * from './render/looks'; export { LOOK_SHEETS, buildLookMaterials, buildMaterials, MATERIALS, MAT } from './render/iso/materials'`, resolveDir: root, loader: 'ts' },
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

const rgb = hex => { const v = parseInt(hex.slice(1, 7), 16); return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255] }
const luma = ([r, g, b]) => r * 0.299 + g * 0.587 + b * 0.114
/** The ground shader's `fits` (render/iso/shaders.ts), per material slot family. */
const FITS = {
  grass: ([r, g, b]) => b > r + 0.05 && g > r + 0.03 && luma([r, g, b]) < 0.78,
  moss: ([r, g, b]) => b > r + 0.05 && g > r + 0.03 && luma([r, g, b]) < 0.78,
  cobbles: c => c[0] > c[1] + 0.06 && c[2] > c[1] + 0.05 && luma(c) > 0.2 && luma(c) < 0.75,
  lane: c => c[0] > c[1] + 0.06 && c[2] > c[1] + 0.05 && luma(c) > 0.2 && luma(c) < 0.75,
  sand: c => c[0] > c[1] + 0.03 && c[0] > c[2] - 0.04 && luma(c) > 0.25 && luma(c) < 0.8,
}

describe('the realm looks', () => {
  it('each have a row in every table', () => {
    assert.deepEqual([...L.REALM_LOOKS].sort(), ['dune', 'fog', 'quarry', 'snow', 'spore', 'suburb'])
    for (const look of L.REALM_LOOKS) {
      for (const [name, table] of Object.entries({ CLASSIC: L.CLASSIC, GROUND: L.GROUND, MOOD: L.MOOD, LOOK_SHEETS: L.LOOK_SHEETS })) {
        assert.ok(table[look], `${name} has ${look}`)
      }
      assert.equal(L.realmLook(look), look)
    }
    for (const other of [undefined, 'wild', 'lab', 'coast']) assert.equal(L.realmLook(other), null)
  })

  it('are the looks the map data may name (types.ts), and the plants and the backdrop know them', () => {
    const types = readFileSync(resolve(root, 'types.ts'), 'utf8')
    const union = /look\?: ('lab'[^\n]*)/.exec(types)[1]
    for (const look of L.REALM_LOOKS) assert.ok(union.includes(`'${look}'`), `MapDef.look names ${look}`)
    const flora = readFileSync(resolve(root, 'render/iso/flora.ts'), 'utf8')
    const backdrop = readFileSync(resolve(root, 'render/iso/backdrop.ts'), 'utf8')
    for (const look of L.REALM_LOOKS) {
      assert.match(flora.slice(flora.indexOf('const REALM_FLORA')), new RegExp(`\\n  ${look}: \\{`), `flora has ${look}`)
      assert.match(backdrop.slice(backdrop.indexOf('const REALM_SKY')), new RegExp(`\\n  ${look}: \\{`), `backdrop has ${look}`)
    }
  })

  it('paint their classic ground in the colours the 16-bit ground takes for its slot', () => {
    for (const look of L.REALM_LOOKS) {
      const p = L.CLASSIC[look]
      const g = L.GROUND[look]
      for (const key of ['g0', 'g1', 'g2', 'g3']) assert.ok(FITS[g.grass](rgb(p[key])), `${look} ${key} fits ${g.grass}`)
      for (const key of ['path', 'pathL', 'pathD']) assert.ok(FITS[g.path](rgb(p[key])), `${look} ${key} fits ${g.path}`)
      for (const key of ['sand', 'sandD']) assert.ok(FITS[g.sand](rgb(p[key])), `${look} ${key} fits ${g.sand}`)
      // Open water: deep and blue, which the shader takes for water.
      for (const key of ['water', 'waterD']) { const c = rgb(p[key]); assert.ok(c[2] > c[0] + 0.15 && luma(c) < 0.27, `${look} ${key} is water`) }
    }
  })

  it('build their materials: the coast’s atlas with the look’s own slots painted again', () => {
    const base = L.buildMaterials()
    for (const look of L.REALM_LOOKS) {
      const m = L.buildLookMaterials(look)
      assert.equal(m.w, base.w)
      assert.equal(m.h, base.h)
      for (const [slot, i] of L.MATERIALS.map((s, i) => [s, i])) {
        const same = (() => { for (let v = 0; v < L.MAT; v += 7) for (let u = 0; u < L.MAT; u += 5) { const o = (v * m.w + i * L.MAT + u) * 4; for (let c = 0; c < 4; c++) if (m.data[o + c] !== base.data[o + c]) return false } return true })()
        assert.equal(same, !(slot in L.LOOK_SHEETS[look]), `${look} ${slot}`)
      }
    }
  })

  it('paint their plants', () => {
    for (const look of L.REALM_LOOKS) {
      const atlas = F.buildFlora(look)
      for (const kind of ['tree', 'canopy', 'bush', 'tall', 'tuft']) assert.ok(atlas.sprites[kind].length > 0, `${look} ${kind}`)
    }
  })
})
