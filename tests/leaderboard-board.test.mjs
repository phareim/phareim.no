// The Hall of Fame boards never show a private player id (the only
// credential, kept in its own browser): rows carry a public `key` and
// `me` instead. Both stores: memory (dev) and D1's SQL on node's SQLite.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const tilde = {
  name: 'tilde',
  setup(build) {
    build.onResolve({ filter: /^~\// }, args => ({ path: require.resolve(join(repo, args.path.slice(2)) + '.ts') }))
  },
}
const out = await esbuild.build({
  stdin: { contents: `export { MemoryStore, D1Store, isPublicId } from '~/server/utils/store'`, resolveDir: repo, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error', plugins: [tilde],
})
const S = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const d1 = await import('./miniworld-d1.mjs').then(x => x.d1, () => null)

const stores = [['memory', () => new S.MemoryStore()], ...(d1 ? [['d1', () => new S.D1Store(d1())]] : [])]

for (const [kind, make] of stores) {
  test(`${kind}: board rows name players by public key, mark my own row, leak no private id`, async () => {
    const store = make()
    const ids = Array.from({ length: 14 }, () => randomUUID())
    for (const [i, id] of ids.entries()) {
      await store.upsertPlayer(id, `PILOT ${i}`)
      await store.submitScore(id, 'galaga', 1000 + i * 10)
    }
    const me = ids[0] // the lowest score: outside the top ten
    const boards = await store.boards(me)
    const text = JSON.stringify(boards)
    for (const id of ids) assert.ok(!text.includes(id), 'no private id on the board')
    const g = boards.galaga
    assert.equal(g.top.length, 10)
    assert.ok(g.top.every(r => S.isPublicId(r.key) && r.me === false))
    assert.equal(new Set(g.top.map(r => r.key)).size, 10)
    assert.equal(g.me.me, true)
    assert.equal(g.me.name, 'PILOT 0')
    const again = await store.boards(null)
    assert.deepEqual(again.galaga.top.map(r => r.key), g.top.map(r => r.key), 'keys are stable')
    assert.equal(again.galaga.me, null)
    // The key leads back to the player only on the server.
    assert.equal(await store.privateId(g.top[0].key), ids[13])
    assert.equal(await store.privateId('nobody000000'), null)
  })
}
