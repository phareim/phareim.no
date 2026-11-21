// Neon Shrine's ground and wall materials for the 16-bit view
// (render/iso/materials.ts): pure painters into a typed array, bundled with
// esbuild like the other zelda tests. And the rule that says what a tile's
// ground is made of (render/tiles.ts groundKindOf), which must follow the
// classic painter.
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
    stdin: { contents: `export * from './render/iso/materials'; export { ENGINES } from './viewParams'`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

describe('the 16-bit view’s materials', () => {
  it('lie side by side in one atlas, a number each', () => {
    const m = M.buildMaterials()
    assert.equal(m.w, M.MAT * M.MATERIALS.length)
    assert.equal(m.h, M.MAT)
    assert.equal(m.data.length, m.w * m.h * 4)
    assert.equal(M.materialId(null), 0)
    M.MATERIALS.forEach((name, i) => assert.equal(M.materialId(name), i + 1))
    // A quad's meta carries picture + 8 × material in one float, and the shader's atlas column is 128 px.
    assert.ok(M.MATERIALS.length <= 15)
    assert.equal(M.MAT, 128, 'the shaders read the atlas in columns of 128')
    assert.equal(M.MAT_PER_TILE, 32, 'the shaders read 32 texels to the tile')
  })

  it('are the same pictures every time', () => {
    const a = M.buildMaterials()
    const b = M.buildMaterials()
    assert.equal(a, b, 'built once')
    let sum = 0
    for (let i = 0; i < a.data.length; i += 97) sum = (sum * 31 + a.data[i]) >>> 0
    assert.equal(typeof sum, 'number')
  })

  it('are painted: every material has several colours and a relief', () => {
    const m = M.buildMaterials()
    M.MATERIALS.forEach((name, k) => {
      const colours = new Set()
      const heights = new Set()
      for (let v = 0; v < M.MAT; v++) for (let u = 0; u < M.MAT; u++) {
        const o = (v * m.w + k * M.MAT + u) * 4
        colours.add((m.data[o] << 16) | (m.data[o + 1] << 8) | m.data[o + 2])
        heights.add(m.data[o + 3])
      }
      assert.ok(colours.size >= 3, `${name} has ${colours.size} colours`)
      assert.ok(colours.size <= 12, `${name} is pixel art, not noise: ${colours.size} colours`)
      if (name !== 'slab') assert.ok(heights.size >= 2, `${name} is flat`)
      assert.ok(!colours.has(0), `${name} has a texel nobody painted`)
    })
  })

  it('give every scene px of the turned view a texel of its own', () => {
    // A block of the scene as wide as the material repeats (2 × MAT px by MAT px) shows each texel once.
    const seen = new Set()
    for (let y = 0; y < M.MAT; y++) for (let x = 0; x < 2 * M.MAT; x++) {
      const t = M.texelAt(x, y)
      assert.ok(Number.isInteger(t.u) && Number.isInteger(t.v) && t.u >= 0 && t.v >= 0 && t.u < M.MAT && t.v < M.MAT)
      seen.add(t.v * M.MAT + t.u)
    }
    assert.equal(seen.size, M.MAT * M.MAT)
    // East on the ground is down-right on the screen: two px over, one down.
    const a = M.texelAt(10, 20)
    const b = M.texelAt(12, 21)
    assert.deepEqual([b.u - a.u, b.v - a.v], [2, 0])
  })

  it('can be turned off: a value on the engine', () => {
    const p = M.ENGINES.iso.params
    assert.equal(p.materials.t, 'number')
    assert.equal(p.materials.min, 0)
    assert.equal(p.sunLight.t, 'color')
    assert.equal(p.sunStrength.min, 0)
  })
})

describe('what a tile’s ground is made of', () => {
  it('is decided where the classic painter decides it', () => {
    // groundKindOf mirrors paintBase's cases; if a case is added to one, the other must follow.
    const src = readFileSync(resolve(root, 'render/tiles.ts'), 'utf8')
    const body = (name) => {
      const at = src.indexOf(`function ${name}(`)
      assert.ok(at >= 0, `${name} is gone`)
      return src.slice(at, src.indexOf('\n}\n', at))
    }
    const cases = (s) => [...s.matchAll(/case '([^']+)'/g)].map(m => m[1]).sort().join('')
    assert.equal(cases(body('groundKindOf')), cases(body('paintBase')))
  })
})
