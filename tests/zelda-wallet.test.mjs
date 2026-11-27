// Neon Shrine's bits are the site wallet: the shell's bridge (themes/zelda/wallet.ts)
// sends every change the engine makes to the wallet and takes the wallet's
// balance back when it moves elsewhere, and pays each one-time reward once a browser. An old save's bits moving in
// is `zelda-old-saves.test.mjs`.
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
  it('pickups and purchases become wallet ops, once, whatever else moves the wallet', () => {
    const w = fakeWallet(40)
    const b = W.createBitsBridge(w)
    const i = inv(5)
    // The shell's wiring: the wallet's change callback fires inside add() and lands in the purse.
    w.listeners.push(bal => b.external(i, bal))
    b.adopt(i)
    assert.equal(i.bits, 40, 'a new state carries the wallet')
    assert.equal(b.step(i), 0, 'adopting is not a change')
    // Another tab spends.
    w.elsewhere(-25)
    assert.deepEqual([i.bits, b.step(i), w.ops.length], [15, 0, 0])
    i.bits += 20
    assert.equal(b.step(i), 20)
    i.bits -= 15
    assert.equal(b.step(i), -15)
    assert.equal(b.step(i), 0, 'the callback inside add() counts nothing twice')
    assert.deepEqual(w.ops, [[20, 'shrine'], [-15, 'shrine']])
    assert.deepEqual([w.read(), i.bits], [20, 20])
    // Storage that throws (a locked-down browser) breaks nothing and moves nothing.
    const bad = { getItem() { throw new Error('private') }, setItem() { throw new Error('private') } }
    assert.equal(W.migrateSaveBits({ inv: { bits: 9 } }, bad, w), 0)
    const paid = W.paidFlagStore(() => { throw new Error('private') })
    paid.add('chest:y')
    assert.ok(paid.has('chest:y'), 'without storage the page still remembers')
    assert.equal(w.read(), 20)
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
})

describe('one-time rewards', () => {
  const paidSet = () => { const set = new Set(); return { set, has: f => set.has(f), add: f => set.add(f) } }
  const rewards = new Map([['chest:arcade.chest', 20], ['took:coin', 5]])

  it('a chest pays once per browser, not once per run, beside a drop, a gift and a loaded save', () => {
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
    // A drop in the same frame as a reward already paid still pays; a gift pays once.
    {
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
    }
    // A loaded save's opened chests count as paid.
    {
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
    }
  })

  it('knows the one-time bits of every map', () => {
    const rewards = W.bitRewards(W.WORLD)
    const value = { bits5: 5, bits20: 20, bits50: 50 }
    let chests = 0
    for (const def of Object.values(W.WORLD.maps)) {
      for (const m of Object.values(def.marks)) {
        if (m.ent.t === 'chest' && value[m.ent.item]) { chests++; assert.equal(rewards.get(`chest:${m.ent.id}`), value[m.ent.item], m.ent.id) }
      }
    }
    assert.ok(chests > 0, 'a chest with bits')
    assert.equal(rewards.get('chest:fr:99,99.c0'), undefined)
    assert.equal(rewards.get('chest:arcade.chest'), 20, 'the arcade chest, open before the sword')
  })
})
