// Neon Shrine's bits are the site wallet: the shell's bridge (themes/zelda/wallet.ts)
// sends every change the engine makes to the wallet and takes the wallet's
// balance back when it moves elsewhere; old saves' bits move in once.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')

let W
before(async () => {
  const out = esbuild.buildSync({
    stdin: { contents: `export * from './wallet'; export { MAX_BITS } from './types'; export { WORLD } from './world/index'`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  W = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

/** A wallet like useWallet's: never below 0, a change callback that fires inside add(). */
function fakeWallet(start = 0) {
  let bits = start
  const ops = []
  const listeners = []
  return {
    ops,
    listeners,
    read: () => bits,
    add(delta, reason) {
      bits = Math.max(0, Math.min(99999, bits + delta))
      ops.push([delta, reason])
      for (const cb of listeners) cb(bits)
      return bits
    },
    /** Another tab or Mini World spent or earned. */
    elsewhere(delta) { bits += delta; for (const cb of listeners) cb(bits) },
  }
}

const inv = (bits = 0) => ({ bits })

describe('bits bridge', () => {
  it('a new state carries the wallet', () => {
    const w = fakeWallet(77)
    const b = W.createBitsBridge(w)
    const i = inv(5)
    b.adopt(i)
    assert.equal(i.bits, 77)
    assert.equal(b.step(i), 0, 'adopting is not a change')
    assert.deepEqual(w.ops, [])
  })

  it('pickups and purchases become wallet ops', () => {
    const w = fakeWallet(10)
    const b = W.createBitsBridge(w)
    const i = inv()
    b.adopt(i)
    i.bits += 20
    assert.equal(b.step(i), 20)
    i.bits -= 15
    assert.equal(b.step(i), -15)
    assert.deepEqual(w.ops, [[20, 'shrine'], [-15, 'shrine']])
    assert.equal(w.read(), 15)
    assert.equal(i.bits, 15)
  })

  it('the change callback firing inside add() does not double-count', () => {
    const w = fakeWallet(0)
    const b = W.createBitsBridge(w)
    const i = inv()
    w.listeners.push(bal => b.external(i, bal))
    b.adopt(i)
    i.bits += 5
    b.step(i)
    assert.equal(b.step(i), 0)
    assert.equal(w.read(), 5)
    assert.equal(i.bits, 5)
  })

  it('a change elsewhere lands in the hero\'s purse without an op', () => {
    const w = fakeWallet(40)
    const b = W.createBitsBridge(w)
    const i = inv()
    w.listeners.push(bal => b.external(i, bal))
    b.adopt(i)
    w.elsewhere(-25)
    assert.equal(i.bits, 15)
    assert.equal(b.step(i), 0)
    assert.deepEqual(w.ops, [])
  })

  it('a wallet above MAX_BITS shows the cap here and stays exact', () => {
    const w = fakeWallet(W.MAX_BITS + 500)
    const b = W.createBitsBridge(w)
    const i = inv()
    b.adopt(i)
    assert.equal(i.bits, W.MAX_BITS)
    i.bits -= 100
    b.step(i)
    assert.equal(w.read(), W.MAX_BITS + 400)
    assert.equal(i.bits, W.MAX_BITS)
  })

  it('carried() clamps junk', () => {
    assert.equal(W.carried(NaN), 0)
    assert.equal(W.carried(-3), 0)
    assert.equal(W.carried(12.7), 12)
    assert.equal(W.MAX_BITS, 9999)
  })
})

describe('one-time rewards', () => {
  const paidSet = () => { const set = new Set(); return { set, has: f => set.has(f), add: f => set.add(f) } }
  const rewards = new Map([['chest:arcade.chest', 20], ['took:coin', 5]])

  it('a chest pays once per browser, not once per run (START OVER, or every visit before the sword)', () => {
    const w = fakeWallet(0)
    const paid = paidSet()
    const b = W.createBitsBridge(w, { rewards, paid })
    for (let run = 0; run < 3; run++) {
      const i = inv()
      const flags = {}
      b.adopt(i, flags)
      flags['chest:arcade.chest'] = true
      i.bits += 20
      b.step(i, flags)
      assert.equal(i.bits, 20, `run ${run}: the purse shows the wallet`)
    }
    assert.equal(w.read(), 20)
    assert.deepEqual(w.ops, [[20, 'shrine']])
  })

  it('drops and a new reward in the same frame still pay; an NPC gift pays once', () => {
    const w = fakeWallet(0)
    const paid = paidSet()
    paid.add('chest:arcade.chest')
    paid.add('got:toby:bits50')
    const b = W.createBitsBridge(w, { rewards, paid })
    const i = inv()
    const flags = {}
    b.adopt(i, flags)
    flags['chest:arcade.chest'] = true
    i.bits += 20 + 1 // the chest (paid before) and an enemy's bit
    assert.equal(b.step(i, flags), 1)
    flags['got:toby:bits50'] = true
    i.bits += 50
    assert.equal(b.step(i, flags), 0)
    flags['took:coin'] = true
    i.bits += 5
    assert.equal(b.step(i, flags), 5)
    assert.equal(w.read(), 6)
    assert.equal(i.bits, 6)
    assert.ok(paid.has('took:coin'))
  })

  it('a loaded save\'s opened chests count as paid', () => {
    const w = fakeWallet(100)
    const paid = paidSet()
    const b = W.createBitsBridge(w, { rewards, paid })
    b.adopt(inv(), { 'chest:arcade.chest': true, 'item:sword': true })
    assert.deepEqual([...paid.set], ['chest:arcade.chest'])
    const i = inv()
    const flags = {}
    b.adopt(i, flags)
    flags['chest:arcade.chest'] = true
    i.bits += 20
    assert.equal(b.step(i, flags), 0)
    assert.equal(w.read(), 100)
  })

  it('bitRewards finds the world\'s bit chests; the paid store survives a reload and bad storage', () => {
    const world = { maps: { a: { marks: {
      $: { ent: { t: 'chest', id: 'x', item: 'bits50' } },
      k: { ent: { t: 'chest', id: 'y', item: 'smallKey' } },
      c: { ent: { t: 'item', id: 'z', item: 'bits5' } },
    } } } }
    assert.deepEqual([...W.bitRewards(world)], [['chest:x', 50], ['took:z', 5]])
    const real = W.bitRewards(W.WORLD)
    assert.equal(real.get('chest:arcade.chest'), 20, 'the arcade chest, open before the sword')
    assert.ok(real.size >= 8)
    const m = new Map()
    const kv = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }
    W.paidFlagStore(() => kv).add('chest:x')
    assert.ok(W.paidFlagStore(() => kv).has('chest:x'), 'a new page reads it back')
    const bad = W.paidFlagStore(() => { throw new Error('private') })
    bad.add('chest:y')
    assert.ok(bad.has('chest:y'), 'without storage the page still remembers')
  })
})

describe('old saves', () => {
  const store = () => {
    const m = new Map()
    return { m, getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }
  }
  const save = bits => ({ inv: { bits } })

  it('moves a save\'s bits into the wallet once', () => {
    const w = fakeWallet(50)
    const s = store()
    assert.equal(W.migrateSaveBits(save(123), s, w), 123)
    assert.equal(w.read(), 173)
    assert.equal(W.migrateSaveBits(save(123), s, w), 0, 'second time: nothing')
    assert.equal(w.read(), 173)
    assert.ok(s.getItem(W.MIGRATED_KEY))
  })

  it('no save or no bits: the flag is set and nothing moves', () => {
    const w = fakeWallet()
    const s = store()
    assert.equal(W.migrateSaveBits(null, s, w), 0)
    assert.equal(W.migrateSaveBits(save(40), s, w), 0, 'a save that turns up later is past the migration')
    assert.deepEqual(w.ops, [])
  })

  it('storage that throws moves nothing', () => {
    const w = fakeWallet()
    const bad = { getItem() { throw new Error('private') }, setItem() { throw new Error('private') } }
    assert.equal(W.migrateSaveBits(save(9), bad, w), 0)
    assert.deepEqual(w.ops, [])
  })
})
