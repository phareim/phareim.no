// Slottet inside (themes/miniworld/scene/castle.ts): the gate, Slottsboka
// and the seats are there; you arrive standing free on the floor; you can
// walk from the gate up the dais to the throne, and to the book.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'miniworld')

// A canvas that accepts every call (textures are painted into nothing).
const noop = () => {}
const ctx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined : noop), set: () => true })
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) }

const out = esbuild.buildSync({
  stdin: {
    contents: [
      `export { buildCastle, THRONE_UID } from './scene/castle'`,
      `export { createBody, createEvents, stepBody, PHYS } from './scene/physics'`,
      `export { inZone } from './scene/place'`,
    ].join('; '),
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  mainFields: ['module', 'main'],
})
const M = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

const overlaps = (w, x, y, z, hw, h) => w.statics.some(b => b.kind === 'solid'
  && x + hw > b.minX && x - hw < b.maxX && z + hw > b.minZ && z - hw < b.maxZ && y + h > b.minY + 0.01 && y < b.maxY - 0.01)

/** Walks toward (tx, tz) for up to `seconds`; returns the body. */
function walk(c, from, tx, tz, seconds = 6) {
  const b = M.createBody(from.x, from.y, from.z)
  const ev = M.createEvents()
  for (let t = 0; t < seconds; t += M.PHYS.dt) {
    const dx = tx - b.x, dz = tz - b.z, l = Math.hypot(dx, dz)
    if (l < 0.3) break
    M.stepBody(c.world, b, { mx: dx / l, mz: dz / l, jump: false }, ev)
  }
  return b
}

test('the castle has a way out, Slottsboka and the thrones', () => {
  const c = M.buildCastle()
  const ids = c.zones.map(z => z.id)
  assert.ok(ids.includes('exit'))
  assert.ok(ids.includes('castle-book'))
  const us = c.usables()
  const throne = us.find(u => u.uid === M.THRONE_UID)
  assert.ok(throne && throne.what === 'throne' && throne.use === 'sit')
  assert.ok(us.some(u => u.use === 'music'), 'the piano')
  assert.ok(us.filter(u => u.use === 'sit').length >= 5, 'three thrones and the chairs')
  c.dispose()
})

test('you arrive on the floor, free of walls and furniture, and not in a zone', () => {
  const c = M.buildCastle()
  const s = c.spawn
  assert.equal(s.y, 0)
  assert.ok(!overlaps(c.world, s.x, s.y, s.z, M.PHYS.halfWidth, M.PHYS.height))
  for (const z of c.zones) assert.ok(!M.inZone(z, s.x, s.y, s.z), z.id)
  c.dispose()
})

test('the gate leads to the throne up the dais, and to the book', () => {
  const c = M.buildCastle()
  const throne = c.usables().find(u => u.uid === M.THRONE_UID)
  const b = walk(c, c.spawn, throne.at.x, throne.at.z + 1)
  assert.ok(Math.hypot(b.x - throne.at.x, b.z - throne.at.z) < 1.7, `stopped at ${b.x.toFixed(2)}, ${b.z.toFixed(2)}`)
  assert.ok(b.y > 0.7, 'up on the dais')
  const book = c.zones.find(z => z.id === 'castle-book')
  const bx = (book.minX + book.maxX) / 2, bz = book.maxZ - 0.4
  const b2 = walk(c, c.spawn, bx, bz)
  assert.ok(M.inZone(book, b2.x, b2.y, b2.z), `stopped at ${b2.x.toFixed(2)}, ${b2.z.toFixed(2)}`)
  const exit = c.zones.find(z => z.id === 'exit')
  const b3 = walk(c, { x: throne.at.x, y: 0.8, z: throne.at.z + 1.5 }, 0, (exit.minZ + exit.maxZ) / 2)
  assert.ok(M.inZone(exit, b3.x, b3.y, b3.z), 'back at the gate')
  c.dispose()
})
