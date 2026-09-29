#!/usr/bin/env node
// The VIP hall headless against the dev server, auth.phareim.no faked over CDP:
// signed out (rope, guard, his lines, the login panel opening), signed in (no
// rope, the guard's welcome, through the door, the two cabinets inside), and the
// arcade without them. One browser at a time on Sleeper:
//
//   heavy -x chrome -- node scripts/zelda-lab/vip-shot.mjs <devUrl> <outDir>
//
// outDir must be a non-hidden path under $HOME (snap Chromium).
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './cdp.mjs'

const [base = 'http://127.0.0.1:3030/', outArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: vip-shot.mjs <devUrl> <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const origin = new URL(base).origin
const USER = { id: 'u1', email: 'petter@example.com', name: 'Petter', image: null }

function fakeAuth(b, state) {
  b.on('Fetch.requestPaused', async p => {
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
    if (p.request.method === 'OPTIONS') return reply(204, '')
    if (p.request.url.includes('/api/session')) return reply(200, { user: state.mode === 'in' ? USER : null })
    if (p.request.url.includes('/api/sign-out')) { state.mode = 'out'; return reply(200, { ok: true }) }
    return reply(200, '<!doctype html><title>auth</title><p>AUTH PAGE', [{ name: 'Content-Type', value: 'text/html' }])
  })
  return b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://auth.phareim.no/*' }] })
}

async function run(label, vp) {
  const b = await launch(vp)
  const state = { mode: 'out' }
  const shot = n => b.shot(join(out, `${label}-${n}.png`))
  const at = () => b.eval(`(() => { const s = window.__portal.state; return s.map.id + ' ' + s.hero.x.toFixed(1) + ',' + s.hero.y.toFixed(1) + ' ' + s.mode })()`)
  const rope = () => b.eval(`window.__portal.state.map.tiles.filter(t => t === '¤').length`)
  const stand = async (map, entry) => {
    await b.eval(`sessionStorage.setItem('portal.return', JSON.stringify({ map: '${map}', entry: '${entry}' }))`)
    await b.goto(base)
    await b.sleep(800)
  }
  const report = {}
  try {
    await fakeAuth(b, state)
    await b.goto(base)

    // Signed out, in front of the guard.
    await stand('overworld', 'vipguard')
    report.outStart = await at()
    report.outRope = await rope()
    await shot('out-front')
    await b.key('Space'); await b.sleep(900)
    await shot('out-guard')
    // Read the lines through; the panel opens when they close (stop pressing then: Space would press LOG IN).
    for (let i = 0; i < 8 && !(await b.eval(`!!document.querySelector('.acct-box')`)); i++) { await b.key('Space'); await b.sleep(700) }
    await b.sleep(500)
    report.outPanel = await b.eval(`document.querySelector('.acct-box')?.innerText ?? null`)
    await shot('out-panel')
    await b.key('Escape'); await b.sleep(400)
    // Walk at the rope: it holds.
    await b.hold('ArrowLeft', 500)
    await b.hold('ArrowUp', 900)
    report.outPressed = await at()

    // Signed in.
    state.mode = 'in'
    await stand('overworld', 'vipguard')
    report.inRope = await rope()
    await shot('in-front')
    await b.key('Space'); await b.sleep(900)
    await shot('in-guard')
    for (let i = 0; i < 3; i++) { await b.key('Space'); await b.sleep(600) }
    await b.hold('ArrowLeft', 380)
    await b.hold('ArrowUp', 1100)
    await b.sleep(1200)
    report.inside = await at()
    await shot('vip-inside')
    await b.hold('ArrowUp', 900)
    await b.key('Space'); await b.sleep(900)
    for (let i = 0; i < 3; i++) await b.sleep(700)
    await shot('vip-cabinet')
    report.errors = b.errors

    // The arcade, without the kids' cabinets.
    await stand('arcade', 'door')
    await shot('arcade')
  } finally {
    await b.close()
  }
  return report
}

for (const [label, vp] of [
  ['desktop-1280', { width: 1280, height: 800, dpr: 1, mobile: false }],
  ['phone-375', { width: 375, height: 667, dpr: 2, mobile: true }],
]) {
  console.log(label, JSON.stringify(await run(label, vp), null, 1))
}
