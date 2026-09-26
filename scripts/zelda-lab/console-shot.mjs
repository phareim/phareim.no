#!/usr/bin/env node
// The login console in Petter's house, headless against the dev server:
// the hero at the console, then the panel unreachable (no fake), signed out
// and signed in (auth.phareim.no faked over CDP), LOG OUT, Escape closing it,
// and LOG IN leaving for the auth page with `portal.return` at the console.
// One browser at a time on Sleeper:
//
//   flock /tmp/sleeper-chromium.lock node scripts/zelda-lab/console-shot.mjs <devUrl> <outDir>
//
// outDir must be a non-hidden path under $HOME (snap Chromium).
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './cdp.mjs'

const [base = 'http://127.0.0.1:3030/', outArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: console-shot.mjs <devUrl> <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const origin = new URL(base).origin
const USER = { id: 'u1', email: 'petter@example.com', name: 'Petter', image: null }

/** Fakes auth.phareim.no: `mode` is 'off' (let requests fail), 'out' or 'in'. */
function fakeAuth(b, state) {
  b.on('Fetch.requestPaused', async p => {
    const url = p.request.url
    const cors = [
      { name: 'Access-Control-Allow-Origin', value: origin },
      { name: 'Access-Control-Allow-Credentials', value: 'true' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST' },
      { name: 'Content-Type', value: 'application/json' },
    ]
    const reply = (code, body, extra = []) => b.send('Fetch.fulfillRequest', {
      requestId: p.requestId, responseCode: code, responseHeaders: [...cors, ...extra],
      body: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)).toString('base64'),
    })
    state.seen.push(`${p.request.method} ${url}`)
    if (state.mode === 'off') return b.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'NameNotResolved' })
    if (p.request.method === 'OPTIONS') return reply(204, '')
    if (url.includes('/api/session')) return reply(200, { user: state.mode === 'in' ? USER : null })
    if (url.includes('/api/sign-out')) { state.mode = 'out'; return reply(200, { ok: true }) }
    // The auth page itself.
    return reply(200, '<!doctype html><title>auth</title><p>AUTH PAGE', [{ name: 'Content-Type', value: 'text/html' }])
  })
  return b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://auth.phareim.no/*' }] })
}

async function run(label, { width, height, dpr, mobile }) {
  const b = await launch({ width, height, dpr, mobile })
  const state = { mode: 'off', seen: [] }
  const shot = name => b.shot(join(out, `${label}-${name}.png`))
  const panelText = () => b.eval(`document.querySelector('.acct-box')?.innerText ?? null`)
  const press = async () => {
    if (mobile) {
      const r = await b.eval(`(() => { const e = document.querySelector('.zelda-pad-a'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
      if (!r) throw new Error('no A pad')
      await b.tap(r.x, r.y)
    } else await b.key('Space')
    await b.sleep(900)
  }
  const report = {}
  try {
    await fakeAuth(b, state)
    await b.goto(base)
    // Stand at the console, the way coming back from the auth page does.
    await b.eval(`sessionStorage.setItem('portal.return', JSON.stringify({ map: 'home', entry: 'login' }))`)
    await b.goto(base)
    await b.sleep(800)
    report.at = await b.eval(`(() => { const s = window.__portal.state; return s.map.id + ' ' + Math.floor(s.hero.x) + ',' + Math.floor(s.hero.y) + ' ' + s.hero.dir })()`)
    await shot('house')

    // Unreachable (as on localhost before the server exists).
    await press()
    report.offline = await panelText()
    await shot('offline')
    await b.key('Escape')
    await b.sleep(400)
    report.closedByEsc = (await panelText()) === null
    report.stillHome = await b.eval(`window.__portal.state.map.id + ' ' + window.__portal.state.mode + ' ' + location.search`)

    // Signed out.
    state.mode = 'out'
    await press()
    report.out = await panelText()
    await shot('signed-out')
    if (!mobile) {
      await b.key('ArrowDown')
      await b.sleep(200)
      await shot('signed-out-select')
    }
    await b.key('Escape')
    await b.sleep(400)

    // Signed in, then LOG OUT.
    state.mode = 'in'
    await press()
    report.in = await panelText()
    await shot('signed-in')
    if (mobile) {
      const r = await b.eval(`(() => { const e = [...document.querySelectorAll('.acct-btn')].find(x => x.textContent.includes('LOG OUT')); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
      await b.tap(r.x, r.y)
    } else await b.key('Enter')
    await b.sleep(900)
    report.afterLogout = await panelText()
    await shot('logged-out')

    // LOG IN leaves for the auth page and saves the spot.
    if (mobile) {
      const r = await b.eval(`(() => { const e = [...document.querySelectorAll('.acct-btn')].find(x => x.textContent.includes('LOG IN')); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
      await b.tap(r.x, r.y)
    } else {
      // Selection is back on the first button after the view changed.
      await b.key('Enter')
    }
    await b.sleep(1500)
    report.leftTo = await b.eval('location.href')
    // Back on the site as the auth page's redirect would bring you: at the console.
    await b.goto(base)
    await b.sleep(800)
    report.returnTo = await b.eval(`sessionStorage.getItem('portal.return')`)
    report.back = await b.eval(`(() => { const s = window.__portal.state; return s.map.id + ' ' + Math.floor(s.hero.x) + ',' + Math.floor(s.hero.y) + ' ' + s.hero.dir })()`)
    report.requests = state.seen
    report.errors = b.errors
  } finally {
    await b.close()
  }
  return report
}

for (const [label, vp] of [
  ['phone-375', { width: 375, height: 667, dpr: 2, mobile: true }],
  ['desktop-1280', { width: 1280, height: 800, dpr: 1, mobile: false }],
]) {
  const r = await run(label, vp)
  console.log(label, JSON.stringify(r, null, 1))
}
