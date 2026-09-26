// The browser side of the wallet and Mini World (composables/useWallet.ts,
// useMiniWorld.ts, useMiniWorldSocial.ts) against the real server rules on
// the memory store, in plain node: a fake window (localStorage, events,
// visibility) and a fetch that calls the route logic. Each "page" is a
// fresh bundle instance, so two pages sharing one localStorage are two tabs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { load } from './miniworld-load.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const m = await load()

const tilde = {
  name: 'tilde',
  setup(build) {
    build.onResolve({ filter: /^~\// }, args => ({ path: require.resolve(join(repo, args.path.slice(2)) + '.ts') }))
    // Vue's reactivity without runtime-dom (which wants a real document).
    build.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'vue-core' }))
    build.onLoad({ filter: /.*/, namespace: 'vue-core' }, () => ({ contents: `export * from '@vue/runtime-core'`, resolveDir: repo }))
  },
}
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export * from '~/composables/useWallet'`,
      `export * from '~/composables/useMiniWorld'`,
      `export * from '~/composables/useMiniWorldSocial'`,
      `export { useLeaderboard } from '~/composables/useLeaderboard'`,
    ].join('; '),
    resolveDir: repo,
    loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'node', logLevel: 'error',
  plugins: [tilde],
  define: { 'process.env.NODE_ENV': '"production"' },
})).outputFiles[0].text

let pageNo = 0
/** A new page (module instance) on the current globals. */
async function openPage() {
  const page = await import('data:text/javascript;base64,' + Buffer.from(`${bundle}\n//${++pageNo}`).toString('base64'))
  // A Nuxt auto-import in useGameSave.
  globalThis.useLeaderboard = page.useLeaderboard
  return page
}

const tick = () => new Promise(r => setImmediate(r))
async function settle(n = 20) { for (let i = 0; i < n; i++) await tick() }

/** One browser: localStorage shared by its pages, a server behind fetch. */
function browser(server) {
  const data = new Map()
  const listeners = { window: new Map(), document: new Map() }
  const on = where => (type, cb) => {
    const list = listeners[where].get(type) ?? []
    list.push(cb)
    listeners[where].set(type, list)
  }
  globalThis.localStorage = {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k),
  }
  globalThis.window = { addEventListener: on('window'), removeEventListener() {} }
  globalThis.document = { visibilityState: 'visible', addEventListener: on('document'), removeEventListener() {} }
  const state = new Map()
  globalThis.useState = (key, init) => {
    if (!state.has(key)) state.set(key, { value: init() })
    return state.get(key)
  }
  globalThis.fetch = (url, init) => server.fetch(url, init)
  return { data, listeners }
}

/** The routes the composables use, on the real rules and a memory store. */
function fakeServer() {
  const players = new Map()
  const saves = new Map()
  const store = new m.MemoryMwStore(async id => players.get(id) ?? null)
  const server = {
    store,
    players,
    saves,
    /** Set to make the next wallet POST apply but lose its answer. */
    dropNextWalletAnswer: false,
    /** Resolves a held profile pull (see holdPulls). */
    held: [],
    holdPulls: false,
    async fetch(url, init = {}) {
      const u = new URL(url, 'http://x')
      const body = init.body ? JSON.parse(init.body) : {}
      const caller = body.playerId ?? u.searchParams.get('viewer') ?? u.searchParams.get('player')
      const json = (x, status = 200) => {
        // No answer carries another player's private id.
        const text = JSON.stringify(x)
        for (const id of players.keys()) if (id !== caller) assert.ok(!text.includes(id), `${u.pathname} leaked a private id`)
        return { ok: status < 400, status, json: async () => x }
      }
      const run = async (fn) => {
        try { return json(await fn()) } catch (e) {
          if (e instanceof m.api.MwError) return json({ data: { code: e.code } }, e.status)
          throw e
        }
      }
      const q = Object.fromEntries(u.searchParams)
      switch (`${init.method ?? 'GET'} ${u.pathname}`) {
        case 'POST /api/player': players.set(body.id, { name: body.name }); return json({ ok: true })
        case 'GET /api/wallet': return run(() => m.api.walletGet(store, q))
        case 'POST /api/wallet': {
          const res = await run(() => m.api.walletPost(store, body))
          if (server.dropNextWalletAnswer) { server.dropNextWalletAnswer = false; throw new TypeError('network') }
          return res
        }
        case 'GET /api/save': {
          const answer = () => json({ save: saves.get(q.player) ?? null })
          if (server.holdPulls) return new Promise(resolve => server.held.push(() => resolve(answer())))
          return answer()
        }
        case 'POST /api/save': {
          if (!players.has(body.playerId)) return json({}, 404)
          const old = saves.get(body.playerId)
          if (!old || body.savedAt > old.savedAt) saves.set(body.playerId, { data: body.data, savedAt: body.savedAt, best: null, clears: 0 })
          return json({ save: saves.get(body.playerId) })
        }
        case 'GET /api/mw/state': return run(() => m.api.stateGet(store, q))
        case 'POST /api/mw/profile': return run(() => m.api.profilePost(store, body))
        case 'POST /api/mw/friend': return run(() => m.api.friendPost(store, body))
        case 'POST /api/mw/gift': return run(() => m.api.giftPost(store, body))
        case 'POST /api/mw/gift/open': return run(() => m.api.giftOpenPost(store, body))
        case 'GET /api/mw/house': return run(() => m.api.houseGet(store, q))
        default: throw new Error(`no route ${u.pathname}`)
      }
    },
  }
  return server
}

/** Registers a player on the server and stores it in this browser. */
function withPlayer(server, name = 'PLAYER') {
  const id = randomUUID()
  server.players.set(id, { name })
  localStorage.setItem('phareim.player', JSON.stringify({ id, name }))
  return id
}

// ---------------------------------------------------------------- wallet

test('wallet: ops wait for a player, then land once; a lost answer is retried without paying twice', async () => {
  const server = fakeServer()
  browser(server)
  const page = await openPage()
  page.addToWallet(50, 'mw:welcome')
  page.addToWallet(-20, 'mw:shop')
  await page.syncWallet()
  assert.equal(page.readWallet(), 30, 'no player yet: the ops wait')

  const id = withPlayer(server)
  server.dropNextWalletAnswer = true
  await page.syncWallet()
  assert.equal(await server.store.bits(id), 30, 'the server applied them')
  assert.equal(page.readWallet(), 30)
  await page.syncWallet()
  assert.equal(await server.store.bits(id), 30, 'the retry changed nothing')
  assert.deepEqual(JSON.parse(localStorage.getItem('phareim.wallet')).pending, [])
})

test('wallet: two tabs on one browser add up; neither pays the other\'s ops twice', async () => {
  const server = fakeServer()
  browser(server)
  const id = withPlayer(server)
  const a = await openPage()
  const b = await openPage()
  a.addToWallet(10, 'shrine')
  b.addToWallet(5, 'mw:stars')
  await Promise.all([a.syncWallet(), b.syncWallet()])
  await Promise.all([a.syncWallet(), b.syncWallet()])
  assert.equal(await server.store.bits(id), 15)
  assert.equal(a.readWallet(), 15)
  assert.equal(b.readWallet(), 15)
})

test('wallet: a long run of pickups compacts, never below 0 or above 99 999', async () => {
  const server = fakeServer()
  browser(server)
  const id = withPlayer(server)
  const page = await openPage()
  for (let i = 0; i < 300; i++) page.addToWallet(1, 'shrine')
  assert.ok(JSON.parse(localStorage.getItem('phareim.wallet')).pending.length <= 41)
  assert.equal(page.addToWallet(-1000, 'mw:shop'), 0)
  assert.equal(page.addToWallet(150_000, 'x'), 99_999)
  await page.syncWallet()
  assert.equal(await server.store.bits(id), 99_999)
  assert.equal(page.readWallet(), 99_999)
})

// ---------------------------------------------------------------- gifts of bits

test('bits gifts: taken from the sender once, given once, the local wallets follow', async () => {
  const server = fakeServer()
  browser(server)
  const other = randomUUID()
  server.players.set(other, { name: 'FRIEND' })
  const me = withPlayer(server)
  await server.store.createProfile(other, 'FRIEND')
  await server.store.createProfile(me, 'MEMEME')
  await server.store.addFriendPair(me, other, 1)
  const page = await openPage()
  page.addToWallet(100, 'mw:welcome')
  const social = page.useMiniWorldSocial()
  const to = (await server.store.publicIds([other])).get(other)
  assert.equal(await social.sendGift(to, { kind: 'bits', amount: 500 }), 'poor')
  assert.equal(await social.sendGift(to, { kind: 'bits', amount: 40 }), 'ok')
  assert.equal(await server.store.bits(me), 60)
  assert.equal(page.readWallet(), 60)

  // The friend opens it (twice): credited once.
  const [gift] = await server.store.inbox(other, 40)
  await m.api.giftOpenPost(server.store, { playerId: other, id: gift.id })
  await m.api.giftOpenPost(server.store, { playerId: other, id: gift.id })
  assert.equal(await server.store.bits(other), 40)
  await assert.rejects(m.api.giftOpenPost(server.store, { playerId: me, id: gift.id }), e => e.code === 'not-found')
})

// ---------------------------------------------------------------- the save

test('save: the first person brings the welcome once, makes the player and shows them to others', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const server = fakeServer()
  browser(server)
  const page = await openPage()
  const game = page.useMiniWorld()
  await settle()
  assert.equal(game.ready.value, true)
  assert.equal(game.createPerson('Ulrikke').ok, true)
  await settle()
  const id = JSON.parse(localStorage.getItem('phareim.player')).id
  assert.ok(server.players.has(id), 'the first person made the player')
  t.mock.timers.tick(3500)
  await settle()
  const profiles = await server.store.profiles([id])
  assert.equal(JSON.parse(profiles[0]?.data ?? 'null')?.person?.name, 'Ulrikke', 'the person was published')
  assert.equal(await server.store.bits(id), 50)
  game.deletePerson(game.active.value.id)
  game.createPerson('Ulrikke')
  t.mock.timers.tick(2000)
  await settle()
  assert.equal(page.readWallet(), 50, 'the welcome came once')
})

test('save: a slow profile answer still wins over a fresh local save, and nothing is pushed before it', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const server = fakeServer()
  browser(server)
  const id = withPlayer(server)
  const theirs = m.createPerson(m.newSave(), 'Ulrikke')
  server.saves.set(id, { data: { ...theirs, savedAt: 1000 }, savedAt: 1000, best: null, clears: 0 })
  server.holdPulls = true
  const page = await openPage()
  const game = page.useMiniWorld()
  await settle()
  t.mock.timers.tick(3000)
  await settle()
  assert.equal(game.ready.value, true, 'play starts on the local save')
  game.createPerson('Ny')
  t.mock.timers.tick(2500)
  await settle()
  assert.equal(server.saves.get(id).savedAt, 1000, 'no push before the profile answered')
  server.held.shift()()
  await settle()
  assert.deepEqual(game.save.value.persons.map(p => p.name), ['Ulrikke'], 'the profile\'s save came in')
  assert.equal(JSON.parse(localStorage.getItem('miniworld.save')).persons[0].name, 'Ulrikke')
})

test('item gifts: furniture leaves the sender, arrives once however often the parcel is opened', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const server = fakeServer()
  browser(server)
  const friend = randomUUID()
  server.players.set(friend, { name: 'FRIEND' })
  const me = withPlayer(server)
  await server.store.createProfile(friend, 'FRIEND')
  await server.store.addFriendPair(me, friend, 1)
  const page = await openPage()
  const game = page.useMiniWorld()
  const social = page.useMiniWorldSocial()
  await settle()
  game.createPerson('Ulrikke')
  page.addToWallet(1000, 'test')
  const bought = game.buyFurniture('piano')
  assert.equal(bought.ok, true)
  const before = game.save.value.furniture.length
  await social.refresh()
  const to = social.state.value.friends[0].id
  assert.notEqual(to, friend)
  assert.equal(social.neighbors.value[0].playerId, to, 'Nabogata knows the friend by public id')
  assert.equal(await social.sendGift(to, { kind: 'furniture', uid: bought.uid }), 'ok')
  assert.equal(game.save.value.furniture.length, before - 1)
  assert.ok(!game.save.value.furniture.some(f => f.uid === bought.uid))

  // The friend sends one back; opening it twice (a retry) takes it in once.
  const back = await m.api.giftPost(server.store, { playerId: friend, to: social.me.value, kind: 'furniture', item: 'piano', level: 2 })
  await social.refresh()
  assert.equal(social.inboxCount.value, 1)
  const n = game.save.value.furniture.length
  assert.equal((await social.openGift(back.gift.id)).result, 'ok')
  assert.equal((await social.openGift(back.gift.id)).result, 'ok')
  assert.equal(game.save.value.furniture.length, n + 1)
  assert.equal(game.save.value.furniture.at(-1).level, 2)
  assert.equal(social.inboxCount.value, 0)
})
