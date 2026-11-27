// Neon Shrine's ground materials and standing things for the 16-bit view (render/iso/materials.ts, props.ts): pure
// painters into typed arrays, one gate each for what ships. Bundled with esbuild like the other zelda tests.
import { it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

let M
before(async () => {
  const out = esbuild.buildSync({
    stdin: { contents: `export * from './render/iso/materials'; export * from './render/iso/props'`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  M = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

// 2048 px is the smallest texture a WebGL2 device promises.
it('paints every material, with colours and a relief and no texel left out, into one atlas a device can hold', () => {
  const m = M.buildMaterials()
  assert.deepEqual([m.w, m.h, m.data.length], [M.MAT * M.MATERIALS.length, M.MAT, m.w * m.h * 4])
  assert.ok(m.w <= 2048 && m.h <= 2048, `${m.w}x${m.h}`)
  M.MATERIALS.forEach((name, k) => {
    assert.equal(M.materialId(name), k + 1, name)
    const colours = new Set()
    const heights = new Set()
    for (let v = 0; v < M.MAT; v++) for (let u = 0; u < M.MAT; u++) {
      const o = (v * m.w + k * M.MAT + u) * 4
      colours.add((m.data[o] << 16) | (m.data[o + 1] << 8) | m.data[o + 2])
      heights.add(m.data[o + 3])
    }
    assert.ok(colours.size >= 3, `${name} has ${colours.size} colours`)
    if (name !== 'slab') assert.ok(heights.size >= 2, `${name} is flat`)
    assert.ok(!colours.has(0), `${name} has a texel nobody painted`)
  })
})

it('builds every standing thing, each pixel facing a way, into one atlas a device can hold', () => {
  const a = M.buildProps()
  assert.ok(a.w <= 2048 && a.h <= 2048, `${a.w}x${a.h}`)
  for (const kind of M.PROP_KINDS) {
    const sp = a.sprites[kind]
    let n = 0
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) {
      const o = ((sp.y + y) * a.w + sp.x + x) * 4
      if (!a.albedo[o + 3]) continue
      n++
      const normal = [0, 1, 2].map(c => a.normal[o + c] / 127.5 - 1)
      assert.ok(Math.abs(Math.hypot(...normal) - 1) < 0.06, `${kind} has a normal of length ${Math.hypot(...normal)}`)
      // Nothing the viewer sees faces away from them.
      assert.ok(normal[2] > -0.75, `${kind} shows a back`)
    }
    assert.ok(n > 0, `${kind} is empty`)
  }
})
