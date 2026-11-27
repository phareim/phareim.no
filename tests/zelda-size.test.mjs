// What the isometric view costs a visitor of `/` (docs/site.md → "What `/` costs"): the view's chunk and what it
// pulls in statically, minified and gzipped, as esbuild splits it (close to the site build's own chunk). Each realm's
// scenery, the machines and the stalls are art packs (render/iso/artPack.ts), PNGs fetched only where they stand, and
// only their geometry (artIndex.ts) rides in the view; this keeps it that way and keeps the view from growing back
// silently. Measured 2026-11-25: about 1.18 MB minified, 386 KB gzip (with every
// realm's art inside it, before, 1.98 MB and 990 KB). Raise a ceiling only on purpose, and say so in docs/site.md.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

/** The ceilings, with about a fifth of headroom over the measurement above. */
const MAX_MIN = 1_450_000
const MAX_GZIP = 470_000

let out
before(async () => {
  out = await esbuild.build({
    entryPoints: [resolve(root, 'render/iso/view.ts')],
    bundle: true, splitting: true, format: 'esm', minify: true, write: false, outdir: '/out',
    platform: 'browser', logLevel: 'error', metafile: true,
  })
})

/** The view's own chunk and every chunk it imports statically: what must arrive before it can draw. */
function staticClosure() {
  const outputs = out.metafile.outputs
  const entry = Object.keys(outputs).find(k => outputs[k].entryPoint?.endsWith('render/iso/view.ts'))
  const seen = new Set()
  const walk = k => {
    if (seen.has(k)) return
    seen.add(k)
    for (const imp of outputs[k].imports) if (imp.kind === 'import-statement') walk(imp.path)
  }
  walk(entry)
  return [...seen]
}

describe('the isometric view\'s size', () => {
  it('stays under its ceiling, minified and gzipped', () => {
    const files = new Map(out.outputFiles.map(f => [f.path, f.contents]))
    let min = 0
    let gz = 0
    for (const k of staticClosure()) {
      const bytes = files.get(resolve('/', k))
      assert.ok(bytes, k)
      min += bytes.length
      gz += gzipSync(bytes).length
    }
    assert.ok(min < MAX_MIN, `the iso view is ${min} bytes minified (ceiling ${MAX_MIN})`)
    assert.ok(gz < MAX_GZIP, `the iso view is ${gz} bytes gzipped (ceiling ${MAX_GZIP})`)
  })
})
