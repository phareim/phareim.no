// Mini World's shared world, the motion rules (themes/miniworld/scene/peerMotion.ts):
// the interpolation buffer, shortest-arc facing, extrapolation and snaps,
// and which place key you have where.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const scene = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'miniworld', 'scene')

function load() {
  const out = esbuild.buildSync({
    entryPoints: [join(scene, 'peerMotion.ts')],
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

const M = await load()
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps
const st = (x, z, o = {}) => ({ pl: 'town', x, y: 0, z, r: 0, a: 'walk', s: 0.5, ...o })

test('angleDelta takes the short way round', () => {
  assert.ok(near(M.angleDelta(0, Math.PI / 2), Math.PI / 2))
  assert.ok(near(M.angleDelta(3, -3), 2 * Math.PI - 6)) // across ±π: +0.28, not -6
  assert.ok(near(M.angleDelta(-3, 3), -(2 * Math.PI - 6)))
  assert.ok(near(M.angleDelta(0, 10 * Math.PI + 0.1), 0.1))
  for (let i = 0; i < 200; i++) {
    const d = M.angleDelta(Math.random() * 40 - 20, Math.random() * 40 - 20)
    assert.ok(d > -Math.PI - 1e-9 && d <= Math.PI + 1e-9)
  }
  // Halfway from 170° to -170° is 180°, not 0°.
  const mid = M.lerpAngle((170 * Math.PI) / 180, (-170 * Math.PI) / 180, 0.5)
  assert.ok(near(Math.cos(mid), -1, 1e-9))
})

test('drawn DELAY_MS behind, interpolated between the two states around it', () => {
  const m = new M.Motion()
  const out = M.emptySample()
  assert.equal(m.sample(0, out), false)
  m.push(st(0, 0), 1000)
  m.push(st(1, 0), 1100)
  m.push(st(2, 0), 1200)
  assert.ok(m.sample(1100 + M.DELAY_MS, out))
  assert.ok(near(out.x, 1))
  m.sample(1150 + M.DELAY_MS, out)
  assert.ok(near(out.x, 1.5))
  // Before the first state: hold it.
  const m2 = new M.Motion()
  m2.push(st(5, 5), 1000)
  m2.sample(1000, out)
  assert.equal(out.x, 5)
  assert.equal(out.z, 5)
})

test('facing interpolates along the shortest arc', () => {
  const m = new M.Motion()
  const out = M.emptySample()
  m.push(st(0, 0, { r: 3.0 }), 0)
  m.push(st(0.5, 0, { r: -3.0 }), 100)
  m.sample(50 + M.DELAY_MS, out)
  assert.ok(Math.abs(Math.cos(out.r) - Math.cos(Math.PI)) < 0.01, `r ${out.r}`)
})

test('a walker is carried on for at most MAX_EXTRAP_MS, then held; a stander holds', () => {
  const m = new M.Motion()
  const out = M.emptySample()
  m.push(st(0, 0), 0)
  m.push(st(1, 0), 100) // 10 units/s along x
  m.sample(100 + M.DELAY_MS + 100, out) // 100 ms past the newest
  assert.ok(near(out.x, 2, 1e-9), `x ${out.x}`)
  m.sample(100 + M.DELAY_MS + 1000, out) // far past: capped
  assert.ok(near(out.x, 1 + M.MAX_EXTRAP_MS / 100, 1e-9), `x ${out.x}`)
  assert.equal(out.y, 0)

  const idle = new M.Motion()
  idle.push(st(0, 0), 0)
  idle.push(st(1, 0, { a: 'idle', s: 0 }), 100)
  idle.sample(100 + M.DELAY_MS + 200, out)
  assert.equal(out.x, 1)
})

test('a jump over SNAP_DIST or a new place snaps straight there', () => {
  const m = new M.Motion()
  const out = M.emptySample()
  m.push(st(0, 0), 0)
  m.push(st(1, 0), 100)
  m.sample(100, out)
  const e0 = out.epoch
  m.push(st(1 + M.SNAP_DIST + 1, 0), 200) // respawn
  assert.equal(m.count, 1)
  m.sample(200, out) // at once, not 120 ms later
  assert.equal(out.x, 1 + M.SNAP_DIST + 1)
  assert.notEqual(out.epoch, e0)

  const e1 = out.epoch
  m.push(st(out.x + 0.2, 0, { pl: 'stars' }), 300)
  m.sample(300, out)
  assert.equal(out.pl, 'stars')
  assert.notEqual(out.epoch, e1)
  // A small step does not snap.
  m.push(st(out.x + 0.5, 0, { pl: 'stars' }), 400)
  assert.equal(m.count, 2)
})

test('after a pause the next step starts from where they stood', () => {
  const m = new M.Motion()
  const out = M.emptySample()
  m.push(st(0, 0, { a: 'idle', s: 0 }), 0)
  m.push(st(0.5, 0), 5000)
  m.sample(5000, out) // render time 4880: still at the old spot, not 97% of the way
  assert.ok(out.x < 0.05, `x ${out.x}`)
  m.sample(5000 + M.DELAY_MS, out)
  assert.ok(near(out.x, 0.5))
})

test('buffer stays bounded and in order', () => {
  const m = new M.Motion()
  const out = M.emptySample()
  for (let i = 0; i < 100; i++) m.push(st(i * 0.1, 0), i * 100)
  assert.ok(m.count <= M.BUFFER_MAX)
  m.sample(9900 + M.DELAY_MS, out)
  assert.ok(near(out.x, 9.9))
  // Late or equal stamps are nudged forward, never backwards in time.
  m.push(st(10, 0), 50)
  assert.ok(m.last.t > 9900)
})

test('place keys', () => {
  const tok = M.localToken(() => 0.5)
  assert.match(tok, /^[A-Za-z0-9_-]{1,32}$/)
  assert.notEqual(M.localToken(), M.localToken())
  assert.equal(M.placeKey({ kind: 'town' }, 'PUB1', tok), 'town')
  assert.equal(M.placeKey({ kind: 'house', edit: false }, 'PUB1', tok), 'house:PUB1')
  assert.equal(M.placeKey({ kind: 'house', edit: true }, '', tok), `house:${tok}`)
  assert.equal(M.placeKey({ kind: 'visit', playerId: 'Friend_2' }, 'PUB1', tok), 'house:Friend_2')
  assert.equal(M.placeKey({ kind: 'obby', level: 'hard' }, 'PUB1', tok), 'obby:hard')
  assert.equal(M.placeKey({ kind: 'stars' }, 'PUB1', tok), 'stars')
  assert.equal(M.placeKey({ kind: 'catwalk' }, 'PUB1', tok), 'catwalk:PUB1')
  assert.equal(M.placeKey({ kind: 'catwalk' }, '', tok), `catwalk:${tok}`)
  // Every key passes the wire's place check.
  const PLACE_RE = /^(town|stars|obby:(easy|medium|hard)|house:[A-Za-z0-9_-]{1,32}|catwalk:[A-Za-z0-9_-]{1,32})$/
  for (const p of [{ kind: 'house', edit: false }, { kind: 'visit', playerId: 'bad id!' }, { kind: 'catwalk' }]) {
    assert.match(M.placeKey(p, '', tok), PLACE_RE)
  }
})
