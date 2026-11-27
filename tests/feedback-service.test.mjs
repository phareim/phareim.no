// The feedback service (servers/feedback/): the real app on port 0, a temp store, a fake auth server that counts its
// calls, and the CLI on the same folder. Node strips the TypeScript.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, utimesSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from '../servers/feedback/app.ts'
import { createSessionChecker } from '../server/utils/sessionCheck.ts'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const WEB = 'https://phareim.no'
const REVIEW = 'https://sleeper.phareim.no'
const HOSTILE = '"><img src=x onerror=alert(1)>'
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('tiny jpeg body'), Buffer.from([0xff, 0xd9])])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])
const SAVE = JSON.stringify({ v: 1, area: 'town', hp: 3 })

/** Fake auth: cookie -> account, counting every question. `mode.down` makes it answer 500. */
async function fakeAuth() {
  const accounts = {
    mail: { id: 'u-mail', email: 'Proof@Example.invalid' },
    id: { id: 'u-id', email: 'else@example.invalid' },
    other: { id: 'u-other', email: 'other@example.invalid' },
  }
  const mode = { down: false, calls: 0 }
  const server = http.createServer((req, res) => {
    mode.calls++
    if (mode.down) { res.writeHead(500).end(); return }
    const m = /session_token=([^;]+)/.exec(req.headers.cookie ?? '')
    const acct = m && accounts[m[1]]
    if (!acct) { res.writeHead(401).end(); return }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ user: acct }))
  })
  await new Promise(r => server.listen(0, '127.0.0.1', r))
  return { mode, base: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(r => { server.close(r); server.closeAllConnections() }) }
}

async function rig(extra = {}, root = mkdtempSync(join(tmpdir(), 'feedback-test-'))) {
  const auth = await fakeAuth()
  const app = await startServer({
    port: 0, root, auth: createSessionChecker({ base: auth.base }),
    allowedEmails: [' proof@example.invalid ', ''], allowedIds: ['u-id'], minFreeBytes: 1, ...extra,
  })
  const url = `http://127.0.0.1:${app.port}`
  const done = async () => { await app.close(); await auth.close() }
  return { auth, app, url, root, done }
}

/** Raw request: status, headers and body, with no default headers added. */
function req(url, { method = 'GET', headers = {}, body } = {}) {
  return fetch(url, { method, headers, body }).then(async r => ({
    status: r.status, headers: Object.fromEntries([...r.headers].filter(([k]) => k !== 'date')), body: Buffer.from(await r.arrayBuffer()),
  }))
}
const cookie = (name) => ({ cookie: `session_token=${name}` })
const WH = (name = 'mail') => ({ origin: WEB, ...cookie(name) })
const RH = (name = 'mail') => ({ origin: REVIEW, ...cookie(name) })

function form({ meta, text = 'it broke', shot = JPEG, shotType = 'image/jpeg', save = SAVE, extra = {} } = {}) {
  const fd = new FormData()
  fd.set('meta', meta ?? JSON.stringify({
    v: 1, app: 'zelda', url: 'https://phareim.no/?theme=zelda#secret',
    where: { map: { id: 'town', name: HOSTILE, kind: 'town' }, area: 'north', tile: { x: 4, y: 7 }, pos: { x: 4.5, y: 7.25 }, entry: { map: 'town', entry: 'gate' } },
    version: { n: 12, hash: 'abc', date: '2026-11-27' },
  }))
  if (text !== null) fd.set('text', text)
  if (shot) fd.set('shot', new Blob([shot], { type: shotType }), 'shot.jpg')
  if (save !== null) fd.set('save', save)
  for (const [k, v] of Object.entries(extra)) fd.set(k, v)
  return fd
}

test('gate: every refusal is the same 404 without CORS; the allowed accounts get through; the lookup budget holds', async () => {
  const { auth, url, done } = await rig()
  try {
    const refusals = []
    const ask = async (path, opts) => { const r = await req(url + path, opts); refusals.push({ path, ...r }); return r }
    const before = () => auth.mode.calls

    // Wrong origin: auth is never asked.
    let n = before()
    await ask('/can', { headers: { origin: 'https://evil.example', ...cookie('mail') } })
    await ask('/can', { headers: cookie('mail') })
    await ask('/entry', { method: 'POST', headers: { origin: REVIEW, ...cookie('mail') }, body: form() })
    await ask('/entries', { headers: { origin: WEB, ...cookie('mail') } })
    await ask('/entry/2026-01-01T00-00-00Z-aaaa/done', { method: 'POST', headers: { origin: WEB, ...cookie('mail') } })
    await ask('/entry/2026-01-01T00-00-00Z-aaaa/done', { method: 'POST', headers: { origin: 'null', ...cookie('mail') } })
    await ask('/can', { headers: { ...WH(), 'sec-fetch-site': 'cross-site' } })
    assert.equal(before(), n, 'a wrong origin costs no auth call')

    // Cookie and account problems.
    await ask('/can', { headers: { origin: WEB } })
    await ask('/can', { headers: WH('nobody') })
    await ask('/can', { headers: WH('other') })
    await ask('/entry', { method: 'POST', headers: WH('other'), body: form() })
    await ask('/entries', { headers: RH('other') })
    auth.mode.down = true
    await ask('/can', { headers: WH('mail') })
    auth.mode.down = false

    // Unknown path, other methods, health behind nginx.
    await ask('/nope', { headers: WH() })
    await ask('/can', { method: 'OPTIONS', headers: { ...WH(), 'access-control-request-method': 'GET' } })
    await ask('/can', { method: 'POST', headers: WH() })
    await ask('/entry/not-an-id/shot.jpg', { headers: RH() })
    await ask('/health', { headers: { 'x-real-ip': '203.0.113.9' } })

    assert.ok(refusals.length >= 15)
    const first = refusals[0]
    assert.equal(first.status, 404)
    assert.deepEqual(first.headers['content-type'], 'text/plain')
    assert.equal(first.headers['content-length'], '0')
    assert.equal(first.headers['cache-control'], 'no-store')
    for (const r of refusals) {
      assert.equal(r.status, first.status, r.path)
      assert.deepEqual(r.headers, first.headers, `${r.path} headers`)
      assert.equal(r.body.length, 0, r.path)
      assert.ok(!Object.keys(r.headers).some(k => k.startsWith('access-control')), r.path)
    }

    // The allowed accounts: the email (any case, list items trimmed) and the id.
    for (const who of ['mail', 'id']) {
      const ok = await req(url + '/can', { headers: WH(who) })
      assert.equal(ok.status, 200, who)
      assert.equal(ok.body.toString(), '{"ok":true}')
      assert.equal(ok.headers['access-control-allow-origin'], WEB)
      assert.equal(ok.headers['access-control-allow-credentials'], 'true')
      assert.equal(ok.headers.vary, 'Origin')
      assert.equal(ok.headers['cache-control'], 'no-store')
    }
    const www = await req(url + '/can', { headers: { origin: 'https://www.phareim.no', ...cookie('id') } })
    assert.equal(www.headers['access-control-allow-origin'], 'https://www.phareim.no')
    const rev = await req(url + '/entries', { headers: RH('mail') })
    assert.equal(rev.status, 200)
    assert.ok(!Object.keys(rev.headers).some(k => k.startsWith('access-control')))
    const health = await req(url + '/health')
    assert.equal(health.status, 200)
    assert.equal(JSON.parse(health.body).ok, true)

    // The budget (last: it spends the key `local`). Known tokens never count; unknown ones stop at 20 auth calls.
    n = before()
    for (let i = 0; i < 5; i++) assert.equal((await req(url + '/can', { headers: WH('mail') })).status, 200)
    assert.equal(before() - n, 0, 'a known token is answered from the cache')
    n = before()
    for (let i = 0; i < 25; i++) await req(url + '/can', { headers: WH('junk' + i) })
    assert.ok(before() - n <= 20, `auth calls ${before() - n}`)
    assert.equal((await req(url + '/can', { headers: WH('mail') })).status, 200, 'the allowed token is not counted')
  } finally { await done() }
})

test('round trip: a hostile entry is stored, listed as data, served, marked done, and the CLI agrees', async () => {
  const { url, root, done } = await rig()
  try {
    const post = await req(url + '/entry', { method: 'POST', headers: WH(), body: form({ text: HOSTILE }) })
    assert.equal(post.status, 201)
    assert.equal(post.headers['access-control-allow-origin'], WEB)
    const { id } = JSON.parse(post.body)
    assert.match(id, /^\d{4}-\d\d-\d\dT\d\d-\d\d-\d\dZ-[a-z0-9]{4}$/)
    assert.deepEqual(readdirSync(root), [id])
    assert.deepEqual(readdirSync(join(root, id)).sort(), ['meta.json', 'save.json', 'shot.jpg'])
    assert.ok(readFileSync(join(root, id, 'shot.jpg')).equals(JPEG))
    const stored = JSON.parse(readFileSync(join(root, id, 'meta.json'), 'utf8'))
    assert.equal(stored.client.url, 'https://phareim.no/')
    assert.equal(stored.by, 'u-mail')
    assert.ok(!readFileSync(join(root, id, 'meta.json'), 'utf8').includes('proof@'), 'no email on disk')

    const list = await req(url + '/entries', { headers: RH() })
    assert.equal(list.headers['content-type'], 'application/json')
    assert.equal(list.headers['content-security-policy'], "default-src 'none'; sandbox")
    assert.equal(list.headers['x-content-type-options'], 'nosniff')
    const body = JSON.parse(list.body)
    assert.equal(body.items.length, 1)
    assert.equal(body.items[0].text, HOSTILE)
    assert.equal(body.items[0].where.map, HOSTILE)
    assert.deepEqual(body.items[0].where.tile, { x: 4, y: 7 })
    assert.equal(body.items[0].shot, true)
    assert.equal(body.next, null)

    const page = await req(url + '/', { headers: RH() })
    assert.equal(page.status, 200)
    assert.equal(page.headers['content-type'], 'text/html; charset=utf-8')
    const html = page.body.toString()
    const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1]
    const hash = createHash('sha256').update(script).digest('base64')
    const csp = page.headers['content-security-policy']
    assert.ok(csp.includes(`script-src 'sha256-${hash}'`), csp)
    assert.ok(csp.includes("frame-ancestors 'none'") && csp.includes("default-src 'none'"))
    assert.equal(page.headers['x-frame-options'], 'DENY')
    assert.ok(!Object.keys(page.headers).some(k => k.startsWith('access-control')))

    const shot = await req(`${url}/entry/${id}/shot.jpg`, { headers: RH() })
    assert.equal(shot.headers['content-type'], 'image/jpeg')
    assert.ok(shot.body.equals(JPEG))
    const save = await req(`${url}/entry/${id}/save.json`, { headers: RH() })
    assert.equal(save.body.toString(), SAVE)
    assert.equal(JSON.parse((await req(`${url}/entry/${id}/meta.json`, { headers: RH() })).body).id, id)

    const env = { ...process.env, FEEDBACK_ROOT: root }
    const cli = (...a) => execFileSync(process.execPath, [join(repo, 'servers/feedback/cli.mjs'), ...a], { env, encoding: 'utf8' })
    assert.match(cli('list'), new RegExp(id + '.*open'))
    const shown = cli('show')
    assert.ok(shown.includes('TILE 4,7') && shown.includes(join(root, id, 'shot.jpg')))
    assert.ok(shown.includes("enterMap(WORLD, s, 'town', 'gate', [], {x:4.5,y:7.25})"))
    assert.ok(cli('show', id.slice(0, 13)).includes(id))

    const flip = await req(`${url}/entry/${id}/done`, { method: 'POST', headers: RH() })
    assert.equal(flip.status, 200)
    assert.equal(JSON.parse(flip.body).ok, true)
    assert.equal(JSON.parse((await req(url + '/entries', { headers: RH() })).body).items[0].status, 'done')
    assert.equal(cli('list'), '', 'open list is empty once done')
    assert.match(cli('list', '--all'), /done/)

    const second = JSON.parse((await req(url + '/entry', { method: 'POST', headers: WH(), body: form({ shot: null, save: null, text: 'second' }) })).body).id
    assert.deepEqual(readdirSync(join(root, second)), ['meta.json'])
    assert.ok(cli('done', second).includes(second))
    assert.equal(JSON.parse(readFileSync(join(root, second, 'meta.json'), 'utf8')).status, 'done')
  } finally { await done() }
})

test('limits: too large, bad parts and a full store are refused and store nothing; old .tmp folders go at start', async () => {
  const root = mkdtempSync(join(tmpdir(), 'feedback-test-'))
  const old = join(root, 'x.tmp'), fresh = join(root, 'y.tmp')
  mkdirSync(old); mkdirSync(fresh)
  const past = new Date(Date.now() - 20 * 60_000)
  utimesSync(old, past, past)
  const { url, done, app } = await rig({}, root)
  try {
    assert.ok(!existsSync(old), 'the 20-minute-old tmp folder is swept')
    assert.ok(existsSync(fresh), 'a fresh one is kept')
    rmSync(fresh, { recursive: true })

    const good = await req(url + '/entry', { method: 'POST', headers: WH(), body: form() })
    assert.equal(good.status, 201)
    const goodId = JSON.parse(good.body).id

    const big = await req(url + '/entry', { method: 'POST', headers: WH(), body: form({ extra: { filler: 'x'.repeat(650_000) } }) })
    assert.equal(big.status, 413)
    assert.deepEqual(JSON.parse(big.body), { ok: false, error: 'too-large' })
    assert.equal(big.headers['access-control-allow-origin'], WEB)

    const png = await req(url + '/entry', { method: 'POST', headers: WH(), body: form({ shot: PNG, shotType: 'image/jpeg' }) })
    assert.equal(png.status, 400)
    assert.equal(JSON.parse(png.body).error, 'bad-request')
    const png2 = await req(url + '/entry', { method: 'POST', headers: WH(), body: form({ shot: PNG, shotType: 'image/png' }) })
    assert.equal(png2.status, 400)
    const badMeta = await req(url + '/entry', { method: 'POST', headers: WH(), body: form({ meta: 'not json' }) })
    assert.equal(badMeta.status, 400)
    const wrongV = await req(url + '/entry', { method: 'POST', headers: WH(), body: form({ meta: JSON.stringify({ v: 2, app: 'zelda' }) }) })
    assert.equal(wrongV.status, 400)
    const badSave = await req(url + '/entry', { method: 'POST', headers: WH(), body: form({ save: '{nope' }) })
    assert.equal(badSave.status, 400)
    const plain = await req(url + '/entry', { method: 'POST', headers: { ...WH(), 'content-type': 'application/json' }, body: '{}' })
    assert.equal(plain.status, 400)
    assert.ok(JSON.parse(plain.body).why.length <= 60)

    // A store at its cap answers 507 to the next POST.
    const fullAuth = await fakeAuth()
    const full = await startServer({ port: 0, root, auth: createSessionChecker({ base: fullAuth.base }), allowedEmails: ['proof@example.invalid'], allowedIds: [], capBytes: 10, minFreeBytes: 1 })
    try {
      const r = await req(`http://127.0.0.1:${full.port}/entry`, { method: 'POST', headers: WH(), body: form() })
      assert.equal(r.status, 507)
      assert.deepEqual(JSON.parse(r.body), { ok: false, error: 'store-full' })
    } finally { await full.close(); await fullAuth.close() }

    assert.deepEqual(readdirSync(root), [goodId], 'only the good entry is stored, no tmp folders')
  } finally { await done(); void app }
})
