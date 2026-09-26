// The login console in Petter's house talks to auth.phareim.no through
// themes/zelda/account.ts. A fake fetch plays the server, so nothing here
// touches the network: the session in, out and unreachable, sign-out, the
// auth page links, and that the shell opens the panel on the engine's event.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let A
before(async () => {
  const out = esbuild.buildSync({
    entryPoints: [join(root, 'themes/zelda/account.ts')],
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  A = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

/** A fake fetch: records each call and answers with `reply(url, init)`. */
function fake(reply) {
  const calls = []
  const f = async (url, init) => {
    calls.push({ url, init })
    return reply(url, init)
  }
  return { f, calls }
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const USER = { id: 'u1', email: 'someone@example.com', name: 'Someone', image: null }

describe('account console: auth.phareim.no', () => {
  it('keeps the auth address in one constant', () => {
    assert.equal(A.AUTH_BASE, 'https://auth.phareim.no')
    // Nowhere else in the site's code.
    const hits = []
    const walk = dir => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|vue|js|mjs)$/.test(name) && readFileSync(p, 'utf8').includes('https://auth.phareim.no')) hits.push(p.slice(root.length + 1))
      }
    }
    for (const d of ['themes', 'components', 'composables', 'pages', 'server']) walk(join(root, d))
    assert.deepEqual(hits, ['themes/zelda/account.ts'])
  })

  it('links to the auth page in the neon theme, back to where it was opened', () => {
    assert.equal(A.authPageUrl('signin', 'https://phareim.no/'), 'https://auth.phareim.no/?theme=neon&redirect=https%3A%2F%2Fphareim.no%2F')
    assert.equal(A.authPageUrl('signup', 'https://phareim.no/'), 'https://auth.phareim.no/?theme=neon&redirect=https%3A%2F%2Fphareim.no%2F&mode=signup')
    const u = new URL(A.authPageUrl('signup', 'http://localhost:3030/'))
    assert.equal(u.searchParams.get('redirect'), 'http://localhost:3030/')
    assert.equal(u.searchParams.get('theme'), 'neon')
    assert.equal(u.searchParams.get('mode'), 'signup')
  })

  it('asks for the session with the cookie, and reads who is in', async () => {
    const { f, calls } = fake(() => json({ user: USER }))
    assert.deepEqual(await A.fetchSession(f), { state: 'in', user: USER })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://auth.phareim.no/api/session')
    assert.equal(calls[0].init.credentials, 'include')
    assert.equal(calls[0].init.method, 'GET')
  })

  it('reads a signed-out session', async () => {
    assert.deepEqual(await A.fetchSession(fake(() => json({ user: null })).f), { state: 'out' })
  })

  it('fills in a missing name and image as null', async () => {
    const s = await A.fetchSession(fake(() => json({ user: { id: 'u2', email: 'x@example.com' } })).f)
    assert.deepEqual(s, { state: 'in', user: { id: 'u2', email: 'x@example.com', name: null, image: null } })
  })

  it('calls it offline when the server refuses, fails, lies or never answers', async () => {
    const cases = [
      () => { throw new TypeError('Failed to fetch') }, // CORS refused on localhost, no network
      () => json({ error: 'boom' }, 500),
      () => new Response('<html>', { status: 200 }),
      () => json({ nope: true }),
      () => json({ user: { id: 'u3' } }),
      () => json({ user: 'petter' }),
    ]
    for (const reply of cases) assert.deepEqual(await A.fetchSession(fake(reply).f), { state: 'offline' })
    // A server that hangs: the timeout aborts it.
    const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
    assert.deepEqual(await A.fetchSession(hang, A.AUTH_BASE, 30), { state: 'offline' })
  })

  it('signs out with a POST and the cookie', async () => {
    const { f, calls } = fake(() => json({ ok: true }))
    assert.equal(await A.signOut(f), true)
    assert.equal(calls[0].url, 'https://auth.phareim.no/api/sign-out')
    assert.equal(calls[0].init.method, 'POST')
    assert.equal(calls[0].init.credentials, 'include')
    assert.equal(await A.signOut(fake(() => json({}, 500)).f), false)
    assert.equal(await A.signOut(fake(() => { throw new TypeError('offline') }).f), false)
  })

  it('opens the panel in the shell on the engine\'s panel event, and the panel uses the fetch it is given', () => {
    // The shell and the panel are Vue files; these checks read their source.
    const shell = readFileSync(join(root, 'themes/zelda/Zelda.vue'), 'utf8')
    assert.match(shell, /case 'panel': openPanel\(e\.id, e\.panel\)/)
    assert.match(shell, /<AccountConsole v-if="panel === 'account'"/)
    assert.match(shell, /writeReturn\(state\.map\.id, panelExit\)/, 'LOG IN must save the spot at the console')
    const panel = readFileSync(join(root, 'themes/zelda/AccountConsole.vue'), 'utf8')
    assert.match(panel, /fetchSession\(f, AUTH_BASE\)/)
    assert.match(panel, /props\.fetcher \?\? fetch/)
    assert.match(panel, /INVITE PHRASE/)
    assert.match(panel, /window\.location\.origin/)
  })
})
