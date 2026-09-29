// The browser side of the sign-in for Mini World and Lag Din Figur
// (composables/useAccount.ts, themes/zelda/account.ts): the state the windows
// show, the texts, linking the profile, keeping two children's local saves
// apart, and signing out. Auth and the site's own /api/account/link are a
// fake fetch; each "page" is a fresh bundle instance (module state included)
// on a fake window. No real account, no network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync, readdirSync, statSync } from 'node:fs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

const tilde = {
  name: 'tilde',
  setup(build) {
    build.onResolve({ filter: /^~\// }, args => ({ path: require.resolve(join(repo, args.path.slice(2)) + '.ts') }))
    build.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'vue-core' }))
    build.onLoad({ filter: /.*/, namespace: 'vue-core' }, () => ({ contents: `export * from '@vue/runtime-core'`, resolveDir: repo }))
  },
}
const bundle = (await esbuild.build({
  stdin: {
    contents: [
      `export * from '~/composables/useAccount'`,
      `export { useLeaderboard, readStoredPlayer } from '~/composables/useLeaderboard'`,
    ].join('; '),
    resolveDir: repo,
    loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'node', logLevel: 'error',
  plugins: [tilde],
  define: { 'process.env.NODE_ENV': '"production"' },
})).outputFiles[0].text

let pageNo = 0
const openPage = () => import('data:text/javascript;base64,' + Buffer.from(`${bundle}\n//${++pageNo}`).toString('base64'))

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const ALICE = { id: 'user-alice', email: 'alice@example.com', name: 'Alice', image: null }
const BOB = { id: 'user-bob', email: 'bob@example.com', name: 'Bob', image: null }
const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'

/**
 * One browser and the two servers behind its fetch. `world.session` is who
 * auth says is signed in, `world.password` what signs in, `world.link` what
 * the site's link route answers.
 */
function browser(over = {}) {
  const data = new Map(Object.entries(over.storage ?? {}))
  const world = {
    session: over.session ?? null,
    authDown: false,
    password: { 'alice@example.com': ['correct horse 1', ALICE], 'bob@example.com': ['battery staple 2', BOB] },
    tooMany: false,
    linkStatus: 200,
    linkCode: undefined,
    link: user => ({ playerId: user === BOB ? P2 : P1, name: user === BOB ? 'BOB PLAYER' : 'ALICE PLAYER' }),
    calls: [],
    reloads: 0,
    signOutOk: true,
  }
  const listeners = new Map()
  globalThis.localStorage = { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) }
  globalThis.window = { addEventListener: (t, cb) => listeners.set(t, cb), removeEventListener() {} }
  globalThis.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} }
  globalThis.location = { href: 'https://phareim.no/?theme=miniworld', reload: () => { world.reloads++ } }
  const state = new Map()
  globalThis.useState = (key, init) => {
    if (!state.has(key)) state.set(key, { value: init() })
    return state.get(key)
  }
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url)
    world.calls.push({ url: u, method: init.method ?? 'GET', body: init.body, credentials: init.credentials })
    if (u.startsWith('https://auth.phareim.no')) {
      if (world.authDown) throw new TypeError('Failed to fetch')
      if (u.endsWith('/api/session')) return json({ user: world.session })
      if (u.endsWith('/api/sign-out')) return world.signOutOk ? json({ success: true }) : json({}, 500)
      if (u.endsWith('/api/sign-in')) {
        if (world.tooMany) return json({ statusCode: 429 }, 429)
        const { email, password } = JSON.parse(init.body)
        const hit = world.password[email]
        if (!hit || hit[0] !== password) return json({ statusCode: 401, statusMessage: 'Invalid' }, 401)
        world.session = hit[1]
        return json({ user: hit[1] })
      }
    }
    if (u === '/api/account/link') {
      if (world.linkStatus !== 200) return json({ statusCode: world.linkStatus, data: world.linkCode ? { code: world.linkCode } : undefined }, world.linkStatus)
      return json({ ...world.link(world.session), linked: 'claimed' })
    }
    throw new Error(`unexpected request ${u}`)
  }
  return { data, world, state }
}

const tick = () => new Promise(r => setImmediate(r))
const account = async () => {
  const page = await openPage()
  return { page, api: page.useAccount() }
}

test('no session: the sign-in window, with no line about a problem', async () => {
  const b = browser()
  const { api } = await account()
  assert.equal(api.state.value, 'checking')
  await api.check()
  assert.equal(api.state.value, 'out')
  assert.equal(api.problem.value, '')
  assert.equal(api.user.value, null)
  // The session call went to auth with the cookie, and nothing was linked.
  assert.deepEqual(b.world.calls.map(c => [c.method, c.url, c.credentials]), [['GET', 'https://auth.phareim.no/api/session', 'include']])
})

test('a session: the profile is linked, its id adopted, and the game may start', async () => {
  const b = browser({ session: ALICE, storage: { 'phareim.player': JSON.stringify({ id: P2, name: 'OLD PLAYER' }) } })
  const { page, api } = await account()
  await api.check()
  assert.equal(api.state.value, 'in')
  assert.equal(api.user.value.email, 'alice@example.com')
  // The browser told the server which profile it has; the answer was the account's.
  const link = b.world.calls.find(c => c.url === '/api/account/link')
  assert.equal(JSON.parse(link.body).playerId, P2)
  assert.deepEqual(JSON.parse(b.data.get('phareim.player')), { id: P1, name: 'ALICE PLAYER' })
  assert.equal(page.useLeaderboard().player.value.id, P1)
  assert.equal(b.data.get('phareim.account'), 'user-alice')
})

test('a browser with no profile sends none and gets one', async () => {
  const b = browser({ session: ALICE })
  const { api } = await account()
  await api.check()
  assert.equal(JSON.parse(b.world.calls.find(c => c.url === '/api/account/link').body).playerId, null)
  assert.equal(JSON.parse(b.data.get('phareim.player')).id, P1)
})

test('auth out of reach: a calm retry, then it works', async () => {
  const b = browser({ session: ALICE })
  b.world.authDown = true
  const { api } = await account()
  await api.check()
  assert.equal(api.state.value, 'offline')
  assert.equal(api.problem.value, 'Får ikke kontakt akkurat nå. Prøv igjen om litt.')
  b.world.authDown = false
  await api.check()
  assert.equal(api.state.value, 'in')
  assert.equal(api.problem.value, '')
})

test('the site\'s own server: auth-down and errors are a retry, a plain 401 sends back to the sign-in', async () => {
  for (const [status, code, want] of [[401, 'auth-down', 'offline'], [500, undefined, 'offline'], [401, 'sign-in', 'out']]) {
    const b = browser({ session: ALICE })
    b.world.linkStatus = status
    b.world.linkCode = code
    const { api } = await account()
    await api.check()
    assert.equal(api.state.value, want, `${status} ${code}`)
    assert.ok(api.problem.value.length > 0)
    assert.equal(api.user.value, null)
    assert.equal(b.data.get('phareim.player'), undefined)
  }
})

test('signing in: the texts for a wrong password, too many tries and no contact', async () => {
  const b = browser()
  const { api } = await account()
  await api.check()
  assert.equal(await api.submit('', ''), false)
  assert.equal(api.problem.value, 'Skriv inn e-post og passord')
  assert.equal(await api.submit('alice@example.com', ''), false)
  assert.equal(b.world.calls.filter(c => c.url.endsWith('/api/sign-in')).length, 0)

  assert.equal(await api.submit('alice@example.com', 'nope'), false)
  assert.equal(api.problem.value, 'Feil e-post eller passord')
  assert.equal(api.state.value, 'out')

  b.world.tooMany = true
  assert.equal(await api.submit('alice@example.com', 'correct horse 1'), false)
  assert.equal(api.problem.value, 'For mange forsøk, vent litt')
  b.world.tooMany = false

  b.world.authDown = true
  assert.equal(await api.submit('alice@example.com', 'correct horse 1'), false)
  assert.equal(api.problem.value, 'Får ikke kontakt akkurat nå. Prøv igjen om litt.')
  assert.equal(api.state.value, 'out') // still the sign-in window: the form stays for another try
  assert.equal(api.busy.value, false)
})

test('signing in works: the email is trimmed, the profile linked, and the password is kept nowhere', async () => {
  const b = browser()
  const { api } = await account()
  await api.check()
  assert.equal(await api.submit('  alice@example.com ', 'correct horse 1'), true)
  assert.equal(api.state.value, 'in')
  assert.equal(api.problem.value, '')
  const call = b.world.calls.find(c => c.url.endsWith('/api/sign-in'))
  assert.equal(call.method, 'POST')
  assert.equal(call.credentials, 'include')
  assert.equal(JSON.parse(call.body).email, 'alice@example.com')
  for (const v of b.data.values()) assert.ok(!v.includes('correct horse'), 'the password reached storage')
  assert.equal(b.world.reloads, 0)
})

test('a different account on this browser clears the local game copies first; the same one, or the first, does not', async () => {
  const copies = { 'miniworld.save': '{"a":1}', 'miniworld.heroColors': '{}', 'figur.save': '{"b":2}', 'figur.heroColors': '{}', 'phareim.wallet': '{"server":5,"pending":[]}', 'phareim.player': JSON.stringify({ id: P1, name: 'ALICE PLAYER' }), zeldaSave: '{"z":1}' }

  // Bob after Alice: Alice's copies must not become Bob's.
  const b = browser({ session: BOB, storage: { ...copies, 'phareim.account': 'user-alice' } })
  const { api } = await account()
  await api.check()
  for (const k of Object.keys(copies)) if (k !== 'zeldaSave' && k !== 'phareim.player') assert.equal(b.data.get(k), undefined, k)
  assert.equal(b.data.get('zeldaSave'), '{"z":1}', 'Neon Shrine\'s save is not touched')
  assert.equal(JSON.parse(b.data.get('phareim.player')).id, P2, 'the player is Bob\'s now')
  assert.equal(b.data.get('phareim.account'), 'user-bob')

  // Alice again: nothing cleared.
  const c = browser({ session: ALICE, storage: { ...copies, 'phareim.account': 'user-alice' } })
  await (await account()).api.check()
  assert.equal(c.data.get('miniworld.save'), '{"a":1}')

  // A browser from before logins (no last account): what it has is kept, and gets claimed.
  const d = browser({ session: ALICE, storage: copies })
  await (await account()).api.check()
  assert.equal(d.data.get('miniworld.save'), '{"a":1}')
  assert.equal(d.data.get('figur.save'), '{"b":2}')
})

test('a session that ends mid-game sends the window back; signing in again starts the page over', async () => {
  const b = browser({ session: ALICE })
  const { api } = await account()
  await api.check()
  assert.equal(api.state.value, 'in')
  b.world.session = null
  await api.recheck()
  assert.equal(api.state.value, 'out')
  assert.equal(api.problem.value, 'Du er logget ut. Logg inn igjen.')
  assert.equal(await api.submit('bob@example.com', 'battery staple 2'), true)
  assert.equal(b.world.reloads, 1, 'a reload, so nothing of Alice is left in memory')
})

test('a quiet re-check keeps the game when auth cannot answer, and does nothing before sign-in', async () => {
  const b = browser({ session: ALICE })
  const { api } = await account()
  await api.recheck()
  assert.equal(b.world.calls.length, 0)
  await api.check()
  b.world.authDown = true
  await api.recheck()
  assert.equal(api.state.value, 'in')
})

test('a 401 from any route of the game asks whether the session is still there', async () => {
  const b = browser({ session: ALICE })
  const { page, api } = await account()
  await api.check()
  b.world.session = null
  const before = b.world.calls.length
  page.reportUnauthorized()
  page.reportUnauthorized() // twice in a row: one question
  await tick(); await tick()
  assert.equal(b.world.calls.length, before + 1)
  assert.equal(api.state.value, 'out')
})

test('logging out: the last save goes first, then the session ends and the page starts over', async () => {
  const b = browser({ session: ALICE })
  const { api } = await account()
  await api.check()
  const order = []
  const orig = globalThis.fetch
  globalThis.fetch = (u, i) => { if (String(u).endsWith('/api/sign-out')) order.push('sign-out'); return orig(u, i) }
  assert.equal(await api.logOut(async () => { order.push('save') }), true)
  assert.deepEqual(order, ['save', 'sign-out'])
  assert.equal(b.world.reloads, 1)

  // A sign-out that did not go through leaves the child playing, with a line that says so.
  const f = browser({ session: ALICE })
  const second = await account()
  await second.api.check()
  f.world.signOutOk = false
  assert.equal(await second.api.logOut(), false)
  assert.equal(second.api.problem.value, 'Fikk ikke logget ut. Prøv igjen.')
  assert.equal(f.world.reloads, 0)
  assert.equal(second.api.state.value, 'in')
})

test('sign-up stays on the auth page: a link back to this page, no form and no invite phrase in the code', async () => {
  browser()
  const { api } = await account()
  const u = new URL(api.signUpUrl())
  assert.equal(u.origin, 'https://auth.phareim.no')
  assert.equal(u.searchParams.get('redirect'), 'https://phareim.no/?theme=miniworld')
  assert.equal(u.searchParams.get('mode'), 'signup')

  const hits = []
  const walk = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n)
      if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p) } else if (/\.(ts|vue|js|mjs)$/.test(n)) {
        const t = readFileSync(p, 'utf8')
        if (/inviteCode|ulrikke-er/i.test(t)) hits.push(p.slice(repo.length + 1))
      }
    }
  }
  for (const d of ['themes', 'composables', 'components', 'pages', 'server', 'servers', 'plugins']) walk(join(repo, d))
  assert.deepEqual(hits, [])
})

test('both games mount nothing of the game before the account says `in`', () => {
  for (const [game, comp, win] of [['miniworld', 'MiniWorldGame', 'MwSignIn'], ['figur', 'FigurGame', 'FgSignIn']]) {
    const landing = readFileSync(join(repo, `themes/${game}/Landing.vue`), 'utf8')
    assert.match(landing, new RegExp(`<${comp} v-if="account\\.state\\.value === 'in'" />\\s*<${win} v-else :account="account" />`))
    // The game is only ever rendered by that line.
    assert.equal(landing.split(`<${comp}`).length - 1, 1)
  }
})

test('Mini World\'s window: labelled fields, a show/hide password, big targets, the texts, the sign-up line, and Logg ut in the settings', () => {
  const w = readFileSync(join(repo, 'themes/miniworld/ui/SignIn.vue'), 'utf8')
  assert.match(w, /<label[^>]*for="mw-email"/)
  assert.match(w, /<label[^>]*for="mw-password"/)
  assert.match(w, /type="email"/)
  assert.match(w, /autocomplete="username"/)
  assert.match(w, /autocomplete="current-password"/)
  assert.match(w, /:type="show \? 'text' : 'password'"/)
  assert.match(w, /:aria-pressed="show"/)
  assert.match(w, /font-size: 18px/)
  assert.match(w, /\.mw-gate-input \{[^}]*min-height: 56px/)
  assert.match(w, /mw-btn--big mw-btn--wide/)
  assert.match(w, /role="alert"/)
  assert.match(w, /PRØV IGJEN/)
  assert.match(w, /Har du ikke konto\?\s*<a class="mw-gate-link" :href="account\.signUpUrl\(\)">Spør en voksen<\/a>/)
  assert.equal(w.split('<form').length - 1, 1)
  assert.doesNotMatch(w.replace(/<!--[\s\S]*?-->/g, ''), /sign-up|invite/i)
  assert.match(w, /class="mw-root mw-gate"/)
  assert.match(w, /px-box mw-box/)
  assert.match(w, /useKeyboardInset/)

  const hud = readFileSync(join(repo, 'themes/miniworld/ui/Hud.vue'), 'utf8')
  assert.match(hud, /aria-label="Innstillinger" @click="\$emit\('open', 'settings'\)"/)
  const game = readFileSync(join(repo, 'themes/miniworld/Game.vue'), 'utf8')
  assert.match(game, /<SettingsPanel v-else-if="top\.id === 'settings'" \/>/)
  assert.match(game, /setWalletGame\('miniworld'\)/)
  assert.match(game, /setWalletGame\(null\)/)
  const panel = readFileSync(join(repo, 'themes/miniworld/ui/SettingsPanel.vue'), 'utf8')
  assert.match(panel, /LOGGE UT\?/)
  assert.match(panel, /ctx\.game\.flush\(\)\s*await savesSettled\(\)\s*await syncWallet\(\)/)
})
