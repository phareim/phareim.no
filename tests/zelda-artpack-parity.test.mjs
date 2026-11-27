// Neon Shrine's iso art packs as the game ships them (the pins of render/iso/artIndex.ts, from the .art-cache): every
// pack is pinned, the game's loader (artPack.ts) paints it as `paintThing` paints the same pack unpacked, atlas byte
// for byte, and artIndex.ts is each pack's own index.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinnedBytes } from '../scripts/zelda-lab/lib/artcache.mjs'
import { GROUPS } from '../scripts/zelda-lab/lib/artgroups.mjs'
import { installArtFetch, kitTable, readPins } from './helpers/art.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

let M
before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { withThings, thingKey } from './render/iso/things'; export { buildProps } from './render/iso/props'; export { loadKit } from './render/iso/artPack'; export { ART_INDEX, PACKS } from './render/iso/artIndex'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  M = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
  installArtFetch()
})

function firstDiff(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return `px ${i >> 2} byte ${i & 3}: ${a[i]} vs ${b[i]}`
  return a.length === b.length ? '' : 'length'
}

describe('zelda art packs', () => {
  it('the game\'s loader paints each pinned pack as paintThing paints it unpacked, and artIndex.ts is each pack\'s index', async () => {
    const pins = readPins()
    assert.deepEqual(GROUPS.filter(g => pins.PACKS[g]?.albedo && pins.PACKS[g]?.normal && pins.PACKS[g]?.index), GROUPS, 'every pack is pinned, with both maps')
    const props = M.buildProps()
    for (const group of GROUPS) {
      const pin = M.PACKS[group]
      const index = JSON.parse(await pinnedBytes(pin.index))
      assert.deepEqual([index.w, index.h], [pin.w, pin.h], group)
      const rects = Object.entries(M.ART_INDEX).filter(([, r]) => r.pack === group)
      assert.deepEqual(rects.map(([id]) => id), Object.keys(index.pieces), `${group}: the same pieces in the same order`)
      for (const [id, r] of rects) {
        const p = index.pieces[id]
        assert.deepEqual([r.x, r.y, r.w, r.h, r.ax, r.ay, r.src ?? null], [p.x, p.y, p.w, p.h, p.ax, p.ay, p.src ?? null], `${group}/${id}`)
      }
      const kit = await M.loadKit(group)
      const table = await kitTable(group)
      const a = M.withThings(props, kit)
      const b = M.withThings(props, table)
      assert.deepEqual([a.w, a.h], [b.w, b.h], group)
      for (const id of Object.keys(table)) assert.deepEqual(a.sprites[M.thingKey(id)], b.sprites[M.thingKey(id)], `${group}/${id}: its place in the atlas`)
      assert.equal(firstDiff(a.albedo, b.albedo), '', `${group}: albedo`)
      assert.equal(firstDiff(a.normal, b.normal), '', `${group}: normal`)
    }
  })
})
