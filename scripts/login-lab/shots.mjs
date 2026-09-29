#!/usr/bin/env node
// Mini World's and Lag Din Figur's sign-in windows in a real browser
// (Playwright WebKit, iPad and iPhone sizes), with auth faked at both ends:
//   - the browser's calls to auth.phareim.no are answered by Playwright's
//     route (session, sign-in, sign-out; a wrong password, too many tries, auth
//     unreachable and a good sign-in), and a good sign-in drops a `session_token`
//     cookie for localhost;
//   - the dev server's own session check (server/utils/account.ts) asks a
//     fake auth server on 127.0.0.1 (PHAREIM_DEV_AUTH_BASE, honoured under
//     `nuxi dev` only) that knows one token.
// No real account. The script starts `nuxi dev` on its own port and stops it
// at the end; one browser at a time.
//
//   node scripts/login-lab/shots.mjs <outDir>
//
// Playwright is not a dependency of the site: install it anywhere and point
// PLAYWRIGHT_DIR at that folder (default /tmp/pw-login: `npm i playwright &&
// npx playwright install webkit` there).
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const out = resolve(process.argv[2] ?? 'login-shots')
mkdirSync(out, { recursive: true })
const req = createRequire(join(process.env.PLAYWRIGHT_DIR ?? '/tmp/pw-login', 'x.js'))
const { webkit, devices } = req('playwright')

const PORT = 3031
const AUTH_PORT = 3999
const BASE = `http://localhost:${PORT}`
const TOKEN = 'fake-session-token-1'
const USER = { id: 'user-fake-1', email: 'ulrikke@example.com', name: 'Ulrikke', image: null }
const GOOD = { email: 'ulrikke@example.com', password: 'fake-password-123' }
const notes = []
const note = (s) => { notes.push(s); console.log(s) }

// ---------------------------------------------------------------- the fake auth the dev server asks

const authCalls = []
const authServer = http.createServer((rq, rs) => {
  authCalls.push(rq.headers.cookie ?? '')
  const ok = /session_token=([^;]+)/.exec(rq.headers.cookie ?? '')?.[1] === TOKEN
  rs.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ user: ok ? USER : null }))
})
await new Promise(r => authServer.listen(AUTH_PORT, '127.0.0.1', r))

// ---------------------------------------------------------------- the dev server

const dev = spawn('npx', ['nuxi', 'dev', '--port', String(PORT), '--host', '127.0.0.1'], {
  cwd: repo, env: { ...process.env, PHAREIM_DEV_AUTH_BASE: `http://127.0.0.1:${AUTH_PORT}`, NUXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
})
let devLog = ''
dev.stdout.on('data', d => { devLog += d })
dev.stderr.on('data', d => { devLog += d })
const stopDev = () => { try { process.kill(-dev.pid, 'SIGTERM') } catch { /* gone */ } }
process.on('exit', stopDev)

async function waitForDev() {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/`)).ok) return } catch { /* not yet */ }
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error(`dev server did not start:\n${devLog.slice(-2000)}`)
}

// ---------------------------------------------------------------- the browser's fake auth

/** Routes https://auth.phareim.no/* for a context; `mode` is changed by the script. */
async function fakeAuth(context) {
  const st = { signedIn: false, unreachable: false, calls: [] }
  await context.route('https://auth.phareim.no/**', async (route) => {
    const r = route.request()
    const url = new URL(r.url())
    const cors = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', vary: 'Origin' }
    const json = (status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (st.unreachable) return route.abort('connectionrefused')
    st.calls.push(`${r.method()} ${url.pathname}`)
    if (url.pathname === '/api/session') return json(200, { user: st.signedIn ? USER : null })
    if (url.pathname === '/api/sign-out') {
      st.signedIn = false
      await context.clearCookies()
      return json(200, { success: true })
    }
    if (url.pathname === '/api/sign-in') {
      const { email, password } = JSON.parse(r.postData() ?? '{}')
      if (email === 'many@example.com') return json(429, { statusCode: 429, statusMessage: 'Too many attempts' })
      if (email !== GOOD.email || password !== GOOD.password) return json(401, { statusCode: 401, statusMessage: 'Invalid email or password' })
      st.signedIn = true
      await context.addCookies([{ name: 'session_token', value: TOKEN, url: BASE }])
      return json(200, { user: USER })
    }
    // The sign-up page a grown-up would use: a stand-in.
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/html' }, body: '<!doctype html><title>auth</title><p>AUTH PAGE (fake)</p>' })
  })
  return st
}

// ---------------------------------------------------------------- scenes

const GAMES = [
  { id: 'miniworld', name: 'Mini World', email: '#mw-email', password: '#mw-password', gear: 'button[aria-label="Innstillinger"]', inGame: '.mw-root:not(.mw-gate)' },
  { id: 'figur', name: 'Lag Din Figur', email: '#fg-email', password: '#fg-password', gear: 'button[aria-label="Innstillinger"]', inGame: '.fg-root:not(.fg-gate)' },
]
const VIEWPORTS = {
  ipad: devices['iPad Pro 11 landscape'],
  'ipad-portrait': devices['iPad Pro 11'],
  iphone: devices['iPhone 14'],
  'iphone-landscape': devices['iPhone 14 landscape'],
}

async function runGame(browser, game, vpName, full) {
  const context = await browser.newContext({ ...VIEWPORTS[vpName], locale: 'nb-NO' })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(String(e).slice(0, 200)))
  const st = await fakeAuth(context)
  const tag = `${game.id}-${vpName}`
  const shot = async (n) => { await page.waitForTimeout(350); await page.screenshot({ path: join(out, `${tag}-${n}.png`) }) }
  const url = `${BASE}/?theme=${game.id}`
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector(game.email, { timeout: 90_000 })
    note(`[${tag}] signed out: the window is up, no game behind it (${await page.locator(game.inGame).count()} game roots)`)
    await shot('1-window')
    if (!full) return { errors }

    // Nothing of the game to reach: the server says no to a signed-out browser.
    const raw = await page.evaluate(async () => {
      const id = '11111111-1111-4111-8111-111111111111'
      const get = async (p) => (await fetch(p, { cache: 'no-store' })).status
      const post = async (p, b) => (await fetch(p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).status
      return {
        state: await get(`/api/mw/state?player=${id}`),
        saveMw: await get(`/api/save?player=${id}&game=miniworld`),
        saveFigur: await get(`/api/save?player=${id}&game=figur`),
        saveZelda: await get(`/api/save?player=${id}&game=zelda`),
        walletMw: await post('/api/wallet', { playerId: id, ops: [], game: 'miniworld' }),
        link: await post('/api/account/link', {}),
      }
    })
    note(`[${tag}] signed-out API: ${JSON.stringify(raw)}`)

    // Empty, wrong, too many.
    await page.click('button[type=submit]')
    await page.waitForSelector('[role=alert]')
    await shot('2-empty')
    await page.fill(game.email, GOOD.email)
    await page.fill(game.password, 'wrong-password')
    await page.click('button[type=submit]')
    await page.waitForFunction(() => /FEIL E-POST/i.test(document.body.innerText))
    note(`[${tag}] wrong password: "${(await page.locator('[role=alert]').first().innerText()).trim()}"`)
    await shot('3-wrong')
    await page.fill(game.email, 'many@example.com')
    await page.click('button[type=submit]')
    await page.waitForFunction(() => /FOR MANGE/i.test(document.body.innerText))
    note(`[${tag}] too many: "${(await page.locator('[role=alert]').first().innerText()).trim()}"`)
    await shot('4-toomany')

    // Show the password.
    await page.fill(game.email, GOOD.email)
    await page.fill(game.password, 'wrong-password')
    await page.click('button[aria-pressed]')
    note(`[${tag}] password field type after VIS: ${await page.getAttribute(game.password, 'type')}`)
    await shot('5-show')
    await page.click('button[aria-pressed]')

    // Sign in (auth unreachable first: the calm message, then it works).
    await page.fill(game.password, GOOD.password)
    st.unreachable = true
    await page.click('button[type=submit]')
    await page.waitForFunction(() => /FÅR IKKE KONTAKT/i.test(document.body.innerText))
    note(`[${tag}] auth unreachable at sign-in: "${(await page.locator('[role=alert]').first().innerText()).trim()}"`)
    await shot('6-unreachable')
    st.unreachable = false
    await page.click('button[type=submit]')
    await page.waitForSelector(game.inGame, { timeout: 90_000 })
    await page.waitForTimeout(1500)
    note(`[${tag}] signed in: the game is up (${await page.locator(game.inGame).count()} game roots), auth calls ${st.calls.length}`)
    await shot('7-in')

    const signedIn = await page.evaluate(async () => {
      const p = JSON.parse(localStorage.getItem('phareim.player') ?? 'null')
      const id = p?.id
      const get = async (u) => (await fetch(u, { cache: 'no-store' })).status
      return { linked: !!id, state: id ? await get(`/api/mw/state?player=${id}`) : null, saveMw: id ? await get(`/api/save?player=${id}&game=miniworld`) : null, saveFigur: id ? await get(`/api/save?player=${id}&game=figur`) : null }
    })
    note(`[${tag}] signed-in API: ${JSON.stringify(signedIn)}`)

    // Reload: straight in.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForSelector(game.inGame, { timeout: 90_000 })
    note(`[${tag}] reload keeps the session: the game is up`)

    // Settings and Logg ut.
    await page.waitForTimeout(1000)
    if (game.id === 'miniworld') {
      // A new player has the welcome card (with its own way out); the gear shows once there is a person.
      await shot('7b-welcome')
      await page.evaluate(() => { const mw = window.__mw; mw.ctx.swap({ id: 'creator', personId: null }); mw.game.createPerson('Ulrikke'); mw.ctx.close() })
      await page.waitForSelector('.mw-menu', { timeout: 30_000 })
      await shot('7c-hud')
    }
    await page.click(game.gear)
    await page.waitForFunction(() => /LOGG UT/.test(document.body.innerText))
    await shot('8-settings')
    await page.getByRole('button', { name: 'LOGG UT' }).click()
    await shot('9-confirm')
    await page.getByRole('button', { name: 'JA' }).click()
    await page.waitForSelector(game.email, { timeout: 30_000 })
    note(`[${tag}] after Logg ut: the window is back`)
    await shot('10-out-again')
    // The sign-up line points at the auth page, for a grown-up.
    const href = await page.getAttribute('a:has-text("Spør en voksen")', 'href')
    note(`[${tag}] sign-up link: ${href}`)
    return { errors }
  } finally {
    if (errors.length) note(`[${tag}] page errors: ${errors.join(' | ')}`)
    await context.close()
  }
}

// The auth-unreachable window at page load, and the retry.
async function runOffline(browser, game, vpName) {
  const context = await browser.newContext({ ...VIEWPORTS[vpName], locale: 'nb-NO' })
  const page = await context.newPage()
  const st = await fakeAuth(context)
  st.unreachable = true
  const tag = `${game.id}-${vpName}`
  try {
    await page.goto(`${BASE}/?theme=${game.id}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => /FÅR IKKE KONTAKT/i.test(document.body.innerText), null, { timeout: 60_000 })
    await page.waitForTimeout(400)
    await page.screenshot({ path: join(out, `${tag}-offline.png`) })
    note(`[${tag}] auth unreachable at load: the retry window, not a blank page`)
    st.unreachable = false
    await page.getByRole('button', { name: 'PRØV IGJEN' }).click()
    await page.waitForSelector(game.email, { timeout: 30_000 })
    note(`[${tag}] retry reached auth: the sign-in window`)
  } finally {
    await context.close()
  }
}

let browser
try {
  await waitForDev()
  browser = await webkit.launch()
  for (const game of GAMES) {
    await runGame(browser, game, 'ipad', true)
    await runGame(browser, game, 'iphone', true)
    await runGame(browser, game, 'ipad-portrait', false)
    await runGame(browser, game, 'iphone-landscape', false)
    await runOffline(browser, game, 'iphone')
  }
  note(`the dev server's fake auth was asked ${authCalls.length} times; every ask carried only session_token: ${authCalls.filter(Boolean).every(c => /^session_token=[^;]+$/.test(c))}`)
} finally {
  await browser?.close()
  stopDev()
  authServer.close()
  writeFileSync(join(out, 'run-notes.txt'), notes.join('\n') + '\n')
}
