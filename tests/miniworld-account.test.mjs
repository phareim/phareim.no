// The sign-in gate for Mini World and Lag Din Figur, server side
// (server/utils/sessionCheck.ts, accountLinks.ts, account.ts and the routes
// that use them). Auth is a fake fetch: no real account, no network. The
// routes run for real, in plain node, on the D1 store's SQL (node's SQLite
// with the repo's migrations). Every route file under server/api/mw/ is
// listed here, so a new one cannot go live without the gate.
import { test, describe, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { load } from './miniworld-load.mjs'
import { loadRoutes, routeNames } from './account-load.mjs'

const m = await load()
const { sessionCheck, account, accountLinks } = m
const d1 = await import('./miniworld-d1.mjs').then(x => x.d1, () => null)

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const ALICE = { id: 'user-alice', email: 'alice@example.com', name: 'Alice', image: null }
const BOB = { id: 'user-bob', email: 'bob@example.com', name: 'Bob', image: null }
const TOKENS = { 'alice-token': ALICE, 'bob-token': BOB }
const cookieOf = t => `theme=dark; session_token=${t}; other=1`

/** A fake auth.phareim.no: knows two tokens, records what it was asked, can be taken down. */
function fakeAuth() {
  const calls = []
  const auth = {
    calls,
    mode: 'up',
    fetch: async (url, init) => {
      calls.push({ url: String(url), method: init?.method, headers: { ...init?.headers } })
      if (auth.mode === 'down') throw new TypeError('fetch failed')
      if (auth.mode === 'error') return json({ statusCode: 500 }, 500)
      if (auth.mode === 'junk') return new Response('<html>', { status: 200 })
      const token = /session_token=([^;]+)/.exec(init?.headers?.cookie ?? '')?.[1]
      return json({ user: TOKENS[token] ?? null })
    },
  }
  return auth
}

/** A clock the tests move. */
function clock(start = 1_000_000) {
  const c = { t: start, now: () => c.t, tick: (ms) => { c.t += ms } }
  return c
}

// ---------------------------------------------------------------- the session check

describe('session check', () => {
  test('reads only the session_token cookie', () => {
    const f = sessionCheck.sessionTokenFrom
    assert.equal(f('session_token=abc'), 'abc')
    assert.equal(f('a=1; session_token=abc.def-ghi_; b=2'), 'abc.def-ghi_')
    assert.equal(f('xsession_token=abc'), null)
    assert.equal(f('a=1'), null)
    assert.equal(f(''), null)
    assert.equal(f(undefined), null)
    assert.equal(f('session_token='), null)
    assert.equal(f('session_token=a b'), null)
    assert.equal(f(`session_token=${'x'.repeat(600)}`), null)
  })

  test('forwards the token alone to auth, and asks nothing without one', async () => {
    const auth = fakeAuth()
    const c = sessionCheck.createSessionChecker({ fetch: auth.fetch, base: 'http://auth.test' })
    assert.deepEqual(await c.check(undefined), { state: 'out' })
    assert.deepEqual(await c.check('theme=dark'), { state: 'out' })
    assert.equal(auth.calls.length, 0)
    const v = await c.check(cookieOf('alice-token'))
    assert.deepEqual(v, { state: 'in', user: ALICE })
    assert.equal(auth.calls.length, 1)
    assert.equal(auth.calls[0].url, 'http://auth.test/api/session')
    assert.equal(auth.calls[0].method, 'GET')
    // The other cookies never leave.
    assert.equal(auth.calls[0].headers.cookie, 'session_token=alice-token')
  })

  test('a signed-in answer lives 5 minutes, a signed-out one 30 seconds', async () => {
    const auth = fakeAuth()
    const clk = clock()
    const c = sessionCheck.createSessionChecker({ fetch: auth.fetch, base: 'http://auth.test', now: clk.now })
    await c.check(cookieOf('alice-token'))
    await c.check(cookieOf('alice-token'))
    assert.equal(auth.calls.length, 1)
    clk.tick(5 * 60_000 - 1000)
    await c.check(cookieOf('alice-token'))
    assert.equal(auth.calls.length, 1)
    clk.tick(2000)
    await c.check(cookieOf('alice-token'))
    assert.equal(auth.calls.length, 2)

    assert.deepEqual(await c.check(cookieOf('stale-token')), { state: 'out' })
    assert.equal(auth.calls.length, 3)
    clk.tick(20_000)
    await c.check(cookieOf('stale-token'))
    assert.equal(auth.calls.length, 3)
    clk.tick(11_000)
    await c.check(cookieOf('stale-token'))
    assert.equal(auth.calls.length, 4)
  })

  test('another token is another question', async () => {
    const auth = fakeAuth()
    const c = sessionCheck.createSessionChecker({ fetch: auth.fetch, base: 'http://auth.test' })
    assert.equal((await c.check(cookieOf('alice-token'))).user.id, 'user-alice')
    assert.equal((await c.check(cookieOf('bob-token'))).user.id, 'user-bob')
    assert.equal(auth.calls.length, 2)
  })

  test('auth down, slow, erroring or answering nonsense is `down`, never cached', async () => {
    const auth = fakeAuth()
    const clk = clock()
    const c = sessionCheck.createSessionChecker({ fetch: auth.fetch, base: 'http://auth.test', now: clk.now, timeoutMs: 30 })
    for (const mode of ['down', 'error', 'junk']) {
      auth.mode = mode
      assert.deepEqual(await c.check(cookieOf('alice-token')), { state: 'down' }, mode)
    }
    // Back up: answered at once, the outage was not remembered.
    auth.mode = 'up'
    assert.equal((await c.check(cookieOf('alice-token'))).state, 'in')
    // A hanging auth server: the abort signal ends the wait.
    const slow = sessionCheck.createSessionChecker({
      fetch: (_url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))),
      base: 'http://auth.test', timeoutMs: 30,
    })
    assert.deepEqual(await slow.check(cookieOf('alice-token')), { state: 'down' })
  })

  test('a cached yes does not survive an outage past its time: fail closed', async () => {
    const auth = fakeAuth()
    const clk = clock()
    const c = sessionCheck.createSessionChecker({ fetch: auth.fetch, base: 'http://auth.test', now: clk.now })
    assert.equal((await c.check(cookieOf('alice-token'))).state, 'in')
    auth.mode = 'down'
    assert.equal((await c.check(cookieOf('alice-token'))).state, 'in') // inside the 5 minutes
    clk.tick(5 * 60_000 + 1)
    assert.equal((await c.check(cookieOf('alice-token'))).state, 'down')
  })

  test('401 and 403 from auth are a plain no', async () => {
    for (const status of [401, 403]) {
      const c = sessionCheck.createSessionChecker({ fetch: async () => json({}, status), base: 'http://auth.test' })
      assert.deepEqual(await c.check(cookieOf('alice-token')), { state: 'out' })
    }
  })

  test('two requests at once share one question', async () => {
    const auth = fakeAuth()
    const c = sessionCheck.createSessionChecker({ fetch: auth.fetch, base: 'http://auth.test' })
    const [a, b] = await Promise.all([c.check(cookieOf('alice-token')), c.check(cookieOf('alice-token'))])
    assert.equal(a.state, 'in')
    assert.equal(b.state, 'in')
    assert.equal(auth.calls.length, 1)
  })

  test('the cache stays bounded', async () => {
    let asked = 0
    const c = sessionCheck.createSessionChecker({ fetch: async () => { asked++; return json({ user: ALICE }) }, base: 'http://auth.test' })
    for (let i = 0; i < 700; i++) await c.check(`session_token=t${i}`)
    assert.equal(asked, 700)
    await c.check('session_token=t699') // the newest is still there
    assert.equal(asked, 700)
    await c.check('session_token=t0') // the oldest went
    assert.equal(asked, 701)
  })

  test('the checker never logs a token', async () => {
    const seen = []
    const orig = { log: console.log, warn: console.warn, error: console.error }
    console.log = console.warn = console.error = (...a) => seen.push(a.join(' '))
    try {
      const auth = fakeAuth()
      auth.mode = 'down'
      const c = sessionCheck.createSessionChecker({ fetch: auth.fetch, base: 'http://auth.test' })
      await c.check(cookieOf('alice-token'))
    } finally { Object.assign(console, orig) }
    assert.ok(!seen.join('\n').includes('alice-token'))
  })
})

// ---------------------------------------------------------------- profile links

for (const [kind, makeLinks] of [
  ['memory', () => {
    const known = new Set()
    const links = new accountLinks.MemoryAccountLinks(async id => known.has(id))
    return { links, addPlayer: id => known.add(id) }
  }],
  ...(d1 ? [['d1', () => {
    const db = d1()
    return { links: new accountLinks.D1AccountLinks(db), addPlayer: id => db.raw.prepare('INSERT INTO players (id, name) VALUES (?, ?)').run(id, `P ${id.slice(0, 6)}`) }
  }]] : []),
]) {
  describe(`links: ${kind}`, () => {
    test('one profile per account, one account per profile', async () => {
      const { links, addPlayer } = makeLinks()
      const p1 = randomUUID(), p2 = randomUUID()
      addPlayer(p1); addPlayer(p2)
      assert.equal(await links.claim('u1', p1, 5), 'ok')
      assert.equal(await links.claim('u1', p1, 6), 'same')
      assert.equal(await links.claim('u1', p2, 7), 'user-linked')
      assert.equal(await links.claim('u2', p1, 8), 'player-taken')
      assert.equal(await links.claim('u2', randomUUID(), 9), 'no-player')
      assert.equal(await links.playerOf('u1'), p1)
      assert.equal(await links.ownerOf(p1), 'u1')
      assert.equal(await links.playerOf('u2'), null)
      assert.equal(await links.ownerOf(p2), null)
      assert.equal(await links.claim('u2', p2, 10), 'ok')
    })
  })

  describe(`authorizePlayer and linkProfile: ${kind}`, () => {
    test('a first use claims the profile, so a save from before logins is kept', async () => {
      const { links, addPlayer } = makeLinks()
      const p = randomUUID()
      addPlayer(p)
      await account.authorizePlayer(links, ALICE, p)
      assert.equal(await links.ownerOf(p), ALICE.id)
      await account.authorizePlayer(links, ALICE, p) // again: fine
    })

    test('someone else\'s profile, or a second profile, is 403 not-yours', async () => {
      const { links, addPlayer } = makeLinks()
      const p1 = randomUUID(), p2 = randomUUID()
      addPlayer(p1); addPlayer(p2)
      await account.authorizePlayer(links, ALICE, p1)
      for (const [user, id] of [[BOB, p1], [ALICE, p2]]) {
        await assert.rejects(account.authorizePlayer(links, user, id), e => e instanceof account.AccountError && e.status === 403 && e.code === 'not-yours')
      }
      // Nothing was claimed by the failures.
      assert.equal(await links.ownerOf(p2), null)
    })

    test('an unknown or malformed id passes: the route answers 404 or 400 itself', async () => {
      const { links } = makeLinks()
      await account.authorizePlayer(links, ALICE, randomUUID())
      await account.authorizePlayer(links, ALICE, 'nonsense')
      await account.authorizePlayer(links, ALICE, undefined)
      assert.equal(await links.playerOf(ALICE.id), null)
    })

    test('linkProfile: the account\'s own profile wins, so a new device gets the same saves', async () => {
      const { links, addPlayer } = makeLinks()
      const players = new Map()
      const store = {
        getPlayer: async id => players.get(id) ?? null,
        upsertPlayer: async (id, name) => {
          if ([...players.values()].some(p => p.name === name)) return 'name-taken'
          players.set(id, { id, name }); addPlayer(id); return 'ok'
        },
      }
      const ipad = randomUUID()
      players.set(ipad, { id: ipad, name: 'IPAD PLAYER' }); addPlayer(ipad)
      // First sign-in on the iPad: its own profile is claimed.
      const a = await account.linkProfile(store, links, ALICE.id, ipad)
      assert.deepEqual([a.playerId, a.linked, a.fresh], [ipad, 'claimed', false])
      // The phone has a profile of its own from before; the account's wins.
      const phone = randomUUID()
      players.set(phone, { id: phone, name: 'PHONE PLAYER' }); addPlayer(phone)
      const b = await account.linkProfile(store, links, ALICE.id, phone)
      assert.deepEqual([b.playerId, b.name, b.linked], [ipad, 'IPAD PLAYER', 'existing'])
      // A browser with nothing at all gets it too.
      assert.equal((await account.linkProfile(store, links, ALICE.id, null)).playerId, ipad)
    })

    test('linkProfile: a profile someone else owns, an unknown one, or none makes a fresh one', async () => {
      const { links, addPlayer } = makeLinks()
      const players = new Map()
      const store = {
        getPlayer: async id => players.get(id) ?? null,
        upsertPlayer: async (id, name) => {
          if ([...players.values()].some(p => p.name === name)) return 'name-taken'
          players.set(id, { id, name }); addPlayer(id); return 'ok'
        },
      }
      const shared = randomUUID()
      players.set(shared, { id: shared, name: 'SHARED IPAD' }); addPlayer(shared)
      await account.linkProfile(store, links, ALICE.id, shared)
      const bob = await account.linkProfile(store, links, BOB.id, shared)
      assert.equal(bob.linked, 'created')
      assert.equal(bob.fresh, true)
      assert.notEqual(bob.playerId, shared)
      assert.equal(await links.ownerOf(shared), ALICE.id)
      assert.equal(await links.ownerOf(bob.playerId), BOB.id)
      const carol = await account.linkProfile(store, links, 'user-carol', randomUUID())
      assert.equal(carol.linked, 'created')
      const dave = await account.linkProfile(store, links, 'user-dave', 'not-a-uuid')
      assert.equal(dave.linked, 'created')
      assert.equal(new Set([shared, bob.playerId, carol.playerId, dave.playerId]).size, 4)
    })

    test('linkProfile: a name clash is rerolled, and the profile still gets made', async () => {
      const { links, addPlayer } = makeLinks()
      const players = new Map()
      let refused = 3
      const store = {
        getPlayer: async id => players.get(id) ?? null,
        upsertPlayer: async (id, name) => {
          if (refused-- > 0) return 'name-taken'
          players.set(id, { id, name }); addPlayer(id); return 'ok'
        },
      }
      const r = await account.linkProfile(store, links, ALICE.id, null)
      assert.equal(r.linked, 'created')
      assert.equal(refused, -1)
    })

    test('the wallet without a game hint: open until the profile is linked, then its owner\'s', async () => {
      const { links, addPlayer } = makeLinks()
      const auth = fakeAuth()
      const checker = sessionCheck.createSessionChecker({ fetch: auth.fetch, base: 'http://auth.test' })
      const p = randomUUID()
      addPlayer(p)
      await account.guardLinked(links, checker, undefined, p) // unlinked: open, and no question to auth
      assert.equal(auth.calls.length, 0)
      await links.claim(ALICE.id, p, 1)
      await assert.rejects(account.guardLinked(links, checker, undefined, p), e => e.status === 401 && e.code === 'sign-in')
      await assert.rejects(account.guardLinked(links, checker, cookieOf('bob-token'), p), e => e.status === 403)
      await account.guardLinked(links, checker, cookieOf('alice-token'), p)
      auth.mode = 'down'
      checker.clear()
      await assert.rejects(account.guardLinked(links, checker, cookieOf('alice-token'), p), e => e.status === 401 && e.code === 'auth-down')
    })
  })
}

// ---------------------------------------------------------------- the routes

describe('routes', { skip: !d1 && 'node:sqlite needs Node 22.5 or newer' }, async () => {
  let R, routes, auth, db, clk

  before(async () => {
    R = await loadRoutes()
    routes = R.routes
  })

  beforeEach(() => {
    auth = fakeAuth()
    clk = clock()
    db = d1()
    // The routes' own bundle has its own module instances: the checker goes in there.
    R.mod.u_account.useSessionChecker(R.mod.u_sessionCheck.createSessionChecker({ fetch: auth.fetch, base: 'http://auth.test', now: clk.now }))
  })

  const event = (o = {}) => ({
    headers: o.token ? { cookie: cookieOf(o.token) } : {},
    query: o.query,
    body: o.body,
    context: { cloudflare: { env: { LEADERBOARD_DB: db } } },
  })
  const newPlayer = (name = `P${randomUUID().slice(0, 6)}`) => {
    const id = randomUUID()
    db.raw.prepare('INSERT INTO players (id, name) VALUES (?, ?)').run(id, name)
    return id
  }
  const call = (route, o) => routes[route](event(o))
  const status = async (route, o) => {
    try { await call(route, o); return 200 } catch (e) { return e.statusCode ?? 'threw' }
  }
  const code = async (route, o) => {
    try { await call(route, o); return null } catch (e) { return e.data?.code ?? e.statusMessage }
  }

  const PUB = 'a1b2c3d4e5f6'
  /** A request for each route under server/api/mw/, by the player it names. */
  const mwRequests = P => ({
    'mw/friend.post': { body: { playerId: P, code: 'ABCDEF' } },
    'mw/gift.post': { body: { playerId: P, to: PUB, kind: 'bits', amount: 5 } },
    'mw/gift/open.post': { body: { playerId: P, id: 'abcdefghij' } },
    'mw/hood.post': { body: { playerId: P, action: 'leave' } },
    'mw/house.get': { query: { viewer: P, player: PUB } },
    'mw/profile.post': { body: { playerId: P, person: null, house: null } },
    'mw/state.get': { query: { player: P } },
    'mw/unfriend.post': { body: { playerId: P, friendId: PUB } },
  })

  test('the test knows every route under server/api/mw/', () => {
    assert.deepEqual(routeNames.filter(n => n.startsWith('mw/')), Object.keys(mwRequests(randomUUID())).sort())
  })

  test('every /api/mw/* route: 401 without a session, 401 with a dead one, 401 when auth is down', async () => {
    const P = newPlayer()
    for (const [route, req] of Object.entries(mwRequests(P))) {
      assert.equal(await code(route, req), 'sign-in', `${route} without a cookie`)
      assert.equal(await code(route, { ...req, token: 'nobody-token' }), 'sign-in', `${route} with a dead session`)
      auth.mode = 'down'
      clk.tick(60_000)
      assert.equal(await code(route, { ...req, token: 'alice-token' }), 'auth-down', `${route} with auth down`)
      auth.mode = 'up'
    }
    // Nothing was linked by the refusals.
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM account_links').get().n, 0)
  })

  test('every /api/mw/* route: someone else\'s profile is 403, the owner is let through', async () => {
    const P = newPlayer()
    await call('account/link.post', { token: 'alice-token', body: { playerId: P } })
    for (const [route, req] of Object.entries(mwRequests(P))) {
      assert.equal(await status(route, { ...req, token: 'bob-token' }), 403, `${route} as another account`)
      const s = await status(route, { ...req, token: 'alice-token' })
      assert.ok(s !== 401 && s !== 403, `${route} as the owner answered ${s}`)
    }
  })

  test('the gate takes the caller from the right field of each route', async () => {
    const P = newPlayer()
    const Q = newPlayer()
    await call('account/link.post', { token: 'alice-token', body: { playerId: P } })
    // Alice names her own profile as the viewer/player: through. Bob's or nobody's: 403.
    assert.equal(await status('mw/state.get', { token: 'alice-token', query: { player: P } }), 200)
    assert.equal(await status('mw/state.get', { token: 'alice-token', query: { player: Q } }), 403)
    assert.equal(await status('mw/house.get', { token: 'alice-token', query: { viewer: Q, player: PUB } }), 403)
    assert.equal(await status('mw/profile.post', { token: 'alice-token', body: { playerId: Q } }), 403)
  })

  test('the save slots of Mini World and Lag Din Figur need the account, the others stay open', async () => {
    const P = newPlayer()
    for (const game of ['miniworld', 'figur']) {
      assert.equal(await code('save.get', { query: { player: P, game } }), 'sign-in', `get ${game}`)
      assert.equal(await code('save.post', { body: { playerId: P, game, data: { v: 1 }, savedAt: Date.now() } }), 'sign-in', `post ${game}`)
      auth.mode = 'down'
      clk.tick(60_000)
      assert.equal(await code('save.get', { token: 'alice-token', query: { player: P, game } }), 'auth-down')
      auth.mode = 'up'
    }
    // Neon Shrine, Another Shore and the Battery are as they were.
    for (const game of ['zelda', 'anotherworld', 'battery']) {
      assert.equal(await status('save.get', { query: { player: P, game } }), 200, `get ${game}`)
      assert.equal(await status('save.post', { body: { playerId: P, game, data: { v: 1 }, savedAt: Date.now() } }), 200, `post ${game}`)
    }
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM game_saves WHERE game IN (?, ?)').get('miniworld', 'figur').n, 0)
  })

  test('Neon Shrine\'s slot (and the other adventures\') is open until the profile is an account\'s, then its owner\'s alone', async () => {
    const P = newPlayer()
    const at = Date.now()
    for (const game of ['zelda', 'anotherworld', 'battery']) {
      assert.equal(await status('save.post', { body: { playerId: P, game, data: { v: 0 }, savedAt: at } }), 200, `open ${game}`)
    }
    await call('account/link.post', { token: 'alice-token', body: { playerId: P } })
    for (const game of ['zelda', 'anotherworld', 'battery']) {
      assert.equal(await code('save.get', { query: { player: P, game } }), 'sign-in', `get ${game}`)
      assert.equal(await code('save.post', { body: { playerId: P, game, data: { v: 9 }, savedAt: at + 1 } }), 'sign-in', `post ${game}`)
      assert.equal(await code('save.post', { token: 'bob-token', body: { playerId: P, game, data: { v: 9 }, savedAt: at + 1 } }), 'not-yours', `bob ${game}`)
      assert.equal((await call('save.post', { token: 'alice-token', body: { playerId: P, game, data: { v: 2 }, savedAt: at + 2 } })).save.data.v, 2, `alice ${game}`)
      assert.equal((await call('save.get', { token: 'alice-token', query: { player: P, game } })).save.data.v, 2)
    }
  })

  test('an account reads and writes its own slot, and not another account\'s', async () => {
    const P = newPlayer(), Q = newPlayer()
    await call('account/link.post', { token: 'alice-token', body: { playerId: P } })
    await call('account/link.post', { token: 'bob-token', body: { playerId: Q } })
    const at = Date.now()
    const w = await call('save.post', { token: 'alice-token', body: { playerId: P, game: 'figur', data: { hello: 'alice' }, savedAt: at } })
    assert.equal(w.save.data.hello, 'alice')
    assert.equal((await call('save.get', { token: 'alice-token', query: { player: P, game: 'figur' } })).save.data.hello, 'alice')
    assert.equal(await status('save.get', { token: 'bob-token', query: { player: P, game: 'figur' } }), 403)
    assert.equal(await status('save.post', { token: 'bob-token', body: { playerId: P, game: 'figur', data: { hello: 'bob' }, savedAt: at + 1 } }), 403)
    assert.equal(await status('save.get', { query: { player: P, game: 'figur' } }), 401)
    assert.equal((await call('save.get', { token: 'alice-token', query: { player: P, game: 'figur' } })).save.data.hello, 'alice')
  })

  test('the wallet: Mini World needs the account; Neon Shrine\'s open until the profile is linked', async () => {
    const P = newPlayer()
    const ops = [{ id: 'abcdefgh12', delta: 5, reason: 'zelda:rupee' }]
    // As Neon Shrine (no game hint), nothing linked: as before.
    assert.equal((await call('wallet.post', { body: { playerId: P, ops } })).bits, 5)
    assert.equal((await call('wallet.get', { query: { player: P } })).bits, 5)
    // As Mini World: no.
    assert.equal(await code('wallet.post', { body: { playerId: P, ops: [], game: 'miniworld' } }), 'sign-in')
    assert.equal(await code('wallet.get', { query: { player: P, game: 'miniworld' } }), 'sign-in')
    // Alice signs in with it: linked, and now the wallet is hers even without the hint.
    assert.equal((await call('wallet.post', { token: 'alice-token', body: { playerId: P, ops: [], game: 'miniworld' } })).bits, 5)
    assert.equal(await code('wallet.get', { query: { player: P } }), 'sign-in')
    assert.equal(await code('wallet.post', { token: 'bob-token', body: { playerId: P, ops: [] } }), 'not-yours')
    assert.equal((await call('wallet.get', { token: 'alice-token', query: { player: P } })).bits, 5)
  })

  test('the Hangar profile shows Mini World\'s and Figur\'s slots only to their owner', async () => {
    const P = newPlayer()
    await call('account/link.post', { token: 'alice-token', body: { playerId: P } })
    const at = Date.now()
    await call('save.post', { token: 'alice-token', body: { playerId: P, game: 'miniworld', data: { persons: [] }, savedAt: at } })
    await call('save.post', { token: 'alice-token', body: { playerId: P, game: 'zelda', data: { v: 1 }, savedAt: at } })
    const keys = async token => Object.keys((await call('profile.get', { token, query: { player: P } })).profile.saves).sort()
    assert.deepEqual(await keys(undefined), ['zelda'])
    assert.deepEqual(await keys('bob-token'), ['zelda'])
    assert.deepEqual(await keys('alice-token'), ['miniworld', 'zelda'])
    // Auth down is no proof of anything: the slot stays hidden.
    auth.mode = 'down'
    clk.tick(6 * 60_000)
    assert.deepEqual(await keys('alice-token'), ['zelda'])
  })

  test('/api/account/link: needs a session; claims, remembers, and gives a new device the same profile', async () => {
    assert.equal(await code('account/link.post', { body: {} }), 'sign-in')
    const ipad = newPlayer('IPAD PLAYER')
    // Her save from before logins existed:
    db.raw.prepare('INSERT INTO game_saves (player_id, game, data, saved_at) VALUES (?, ?, ?, ?)').run(ipad, 'miniworld', '{"persons":[{"name":"ULRIKKE"}]}', 5)

    const first = await call('account/link.post', { token: 'alice-token', body: { playerId: ipad } })
    assert.deepEqual([first.playerId, first.name, first.linked], [ipad, 'IPAD PLAYER', 'claimed'])
    // The save survived: it is what she gets.
    const save = await call('save.get', { token: 'alice-token', query: { player: ipad, game: 'miniworld' } })
    assert.equal(save.save.data.persons[0].name, 'ULRIKKE')

    // A new device with a stray profile of its own, and another with nothing.
    const stray = newPlayer('STRAY')
    for (const body of [{ playerId: stray }, {}, { playerId: null }]) {
      const again = await call('account/link.post', { token: 'alice-token', body })
      assert.deepEqual([again.playerId, again.linked], [ipad, 'existing'])
    }
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM account_links WHERE user_id = ?').get(ALICE.id).n, 1)

    // Bob on the same iPad: the profile is taken, he gets his own.
    const bob = await call('account/link.post', { token: 'bob-token', body: { playerId: ipad } })
    assert.equal(bob.linked, 'created')
    assert.notEqual(bob.playerId, ipad)
    assert.equal(await status('save.get', { token: 'bob-token', query: { player: ipad, game: 'miniworld' } }), 403)
    assert.equal((await call('save.get', { token: 'bob-token', query: { player: bob.playerId, game: 'miniworld' } })).save, null)
    // The link answer never carries an email or a user id.
    assert.ok(!JSON.stringify(first).includes('alice'))
  })

  test('linked profiles are removed with their player (the cascade), and re-linked fresh', async () => {
    const P = newPlayer()
    await call('account/link.post', { token: 'alice-token', body: { playerId: P } })
    db.raw.prepare('DELETE FROM players WHERE id = ?').run(P)
    assert.equal(db.raw.prepare('SELECT COUNT(*) AS n FROM account_links').get().n, 0)
    const again = await call('account/link.post', { token: 'alice-token', body: { playerId: P } })
    assert.equal(again.linked, 'created')
  })
})
