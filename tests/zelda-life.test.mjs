import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { readdirSync } from 'node:fs'

// Every critter file in render/life/ (all but index.ts and types.ts) must be in the registry.
const dir = fileURLToPath(new URL('../themes/zelda/render/life/', import.meta.url))
const files = readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'types.ts')

const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: `export { CRITTERS, lifeShows } from './render/life/index'`,
    resolveDir: fileURLToPath(new URL('../themes/zelda/', import.meta.url)),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'neutral',
  logLevel: 'error',
})
const { CRITTERS, lifeShows } = await import('data:text/javascript;base64,' + Buffer.from(bundle.text).toString('base64'))

test('every critter file is registered once, with a unique id named after its file', () => {
  const ids = CRITTERS.map(c => c.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual([...ids].sort(), files.map(f => f.replace(/\.ts$/, '')).sort())
})

test('critter frames are rectangular, at most 16x16, in their own palette, named after the critter', () => {
  for (const c of CRITTERS) {
    const names = Object.keys(c.frames)
    assert.ok(names.length >= 2, c.id)
    for (const name of names) {
      assert.ok(name.startsWith(c.id + '_'), `${c.id}: ${name}`)
      const rows = c.frames[name]
      assert.ok(rows.length >= 1 && rows.length <= 16, `${name} height`)
      const w = rows[0].length
      assert.ok(w >= 1 && w <= 16, `${name} width`)
      for (const row of rows) {
        assert.equal(row.length, w, `${name} ragged`)
        for (const ch of row) assert.ok(ch === '.' || /^#[0-9a-fA-F]{6}$/.test(c.pal[ch] ?? ''), `${name}: '${ch}'`)
      }
    }
    for (const v of Object.values(c.pal)) assert.match(v, /^#[0-9a-fA-F]{6}$/, c.id)
  }
})

test('each critter lives somewhere and shows at some hour', () => {
  for (const c of CRITTERS) {
    assert.ok((c.maps?.length ?? 0) + (c.realms?.length ?? 0) > 0, c.id)
    const where = c.maps?.[0] ?? ''
    const realm = c.maps?.length ? '' : c.realms[0]
    const kind = c.kinds?.[0] ?? 'overworld'
    assert.ok([-1, 0.1, 0.25, 1].some(sun => lifeShows(c, where, realm, kind, sun)), c.id)
  }
})

test('the show-gate keeps dark critters at the stuck dusk and day ones out of it', () => {
  const mk = when => ({ id: 'x', maps: ['overworld'], when, pal: {}, frames: {}, queue() {} })
  assert.equal(lifeShows(mk('dark'), 'overworld', '', 'overworld', 0.1), true)
  assert.equal(lifeShows(mk('day'), 'overworld', '', 'overworld', 0.1), false)
  assert.equal(lifeShows(mk('day'), 'overworld', '', 'overworld', 1), true)
  assert.equal(lifeShows(mk('dusk-dawn'), 'overworld', '', 'overworld', 1), false)
  assert.equal(lifeShows(mk('always'), 'overworld', '', 'interior', 1), false)
  assert.equal(lifeShows(mk('always'), 'wildwood', '', 'overworld', 1), false)
})
