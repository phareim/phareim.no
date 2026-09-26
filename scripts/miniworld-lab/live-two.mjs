#!/usr/bin/env node
// Mini World's shared world with two players: one headless Chromium, two
// incognito contexts (separate storage, so two players), both on the dev
// server. Makes a person in each, walks one, and screenshots each seeing
// the other; then taps the peer, befriends by tap, and emotes. Needs the
// Nuxt dev server (default http://localhost:3035) and the world service
// (ws://localhost:3034/ws). Run under the lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/miniworld-lab/live-two.mjs [outDir] [baseUrl]
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'

const out = resolve(process.argv[2] || join(homedir(), 'zshots', 'miniworld', 'live'))
const base = process.argv[3] || 'http://localhost:3035'
const URL_ = `${base}/?theme=miniworld`
mkdirSync(out, { recursive: true })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const checks = []
const ok = (name, cond, info = '') => { checks.push([name, !!cond]); console.log(cond ? 'ok  ' : 'FAIL', name, info) }

const W = 390
const H = 844
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(homedir(), 'zshots', 'prof-'))
const proc = spawn('chromium-browser', [
  '--headless=new', '--no-sandbox', '--hide-scrollbars', '--mute-audio', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${W},${H}`, 'about:blank',
], { stdio: 'ignore' })

/** One CDP connection (browser or page level). */
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl)
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }) })
  let id = 0
  const pending = new Map()
  const errors = []
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map(a => a.value ?? a.description).join(' '))
  })
  const send = (method, params = {}) => new Promise((res, rej) => {
    const mid = ++id
    pending.set(mid, m => (m.error ? rej(new Error(`${method}: ${m.error.message}`)) : res(m.result)))
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  return { ws, send, errors }
}

async function page(browser, name) {
  const { browserContextId } = await browser.send('Target.createBrowserContext', { disposeOnDetach: true })
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId })
  let t
  for (let i = 0; i < 40 && !t; i++) {
    t = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find(x => x.id === targetId)
    if (!t) await sleep(100)
  }
  const c = await connect(t.webSocketDebuggerUrl)
  await c.send('Runtime.enable')
  await c.send('Page.enable')
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true })
  await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  const p = {
    name,
    errors: c.errors,
    send: c.send,
    async goto(url) { await c.send('Page.navigate', { url }); await sleep(3000) },
    async eval(expr) {
      const r = await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
      if (r.exceptionDetails) throw new Error(`${name}: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`)
      return r.result.value
    },
    async until(expr, ms = 15000) {
      const end = Date.now() + ms
      while (Date.now() < end) { if (await p.eval(expr).catch(() => false)) return true; await sleep(250) }
      return false
    },
    async tap(x, y) {
      await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      await sleep(60)
      await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await sleep(80)
    },
    async shot(file) {
      await c.send('Page.bringToFront')
      await sleep(300)
      const r = await c.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(out, file), Buffer.from(r.data, 'base64'))
    },
    close() { try { c.ws.close() } catch { /* ignore */ } },
  }
  return p
}

let browser
const pages = []
try {
  let ver
  for (let i = 0; i < 160 && !ver; i++) {
    try { ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json() } catch { await sleep(250) }
  }
  if (!ver) throw new Error('chromium did not start')
  browser = await connect(ver.webSocketDebuggerUrl)

  const a = await page(browser, 'A')
  const b = await page(browser, 'B')
  pages.push(a, b)
  const MW = 'window.__mw'
  for (const [p, who] of [[a, 'Ada'], [b, 'Bo']]) {
    await p.goto(URL_)
    ok(`${p.name}: game ready`, await p.until(`!!${MW} && ${MW}.game.ready.value`, 30000))
    const made = await p.eval(`JSON.stringify(${MW}.game.createPerson('${who}'))`)
    ok(`${p.name}: made ${who}`, made.includes('true'), made)
    await sleep(1500)
    await p.goto(URL_) // back in without the welcome card
    ok(`${p.name}: runtime up`, await p.until(`!!${MW}.runtime && !!${MW}.runtime.selfState()`, 40000))
    ok(`${p.name}: world online`, await p.until(`${MW}.ctx.world.status.value === 'online'`, 15000), await p.eval(`${MW}.ctx.world.status.value`))
  }

  // Each sees the other.
  ok('A sees one other in the world', await a.until(`${MW}.ctx.world.peers.size === 1`), await a.eval(`${MW}.ctx.world.peers.size`))
  ok('B sees one other in the world', await b.until(`${MW}.ctx.world.peers.size === 1`), await b.eval(`${MW}.ctx.world.peers.size`))
  ok('A: 1 HER', await a.until(`${MW}.ctx.world.here.value === 1`), await a.eval(`${MW}.ctx.world.here.value`))

  // B walks a little (touch stick on the left half) while A watches.
  const s0 = await b.eval(`JSON.stringify(${MW}.runtime.selfState())`)
  await b.eval(`${MW}.runtime.input.moveY = 1; ${MW}.runtime.input.moveX = 0.4`)
  await sleep(900)
  await b.eval(`${MW}.runtime.input.moveY = 0; ${MW}.runtime.input.moveX = 0`)
  await sleep(700)
  const s1 = await b.eval(`JSON.stringify(${MW}.runtime.selfState())`)
  ok('B moved', s0 !== s1, `${s0} → ${s1}`)
  await a.shot('a-sees-b.png')
  await b.shot('b-sees-a.png')

  // Emote from B (key 1 path goes through Game.vue's emote), A should get an fx.
  await b.eval(`${MW}.ctx.world.emote('wave')`)
  await sleep(400)
  await a.shot('a-sees-b-wave.png')

  // A opens B's card (the runtime's 'peer' event: tap in the view).
  const bSession = await a.eval(`[...${MW}.ctx.world.peers.keys()][0]`)
  await a.eval(`${MW}.ctx.open({ id: 'peer', peer: ${JSON.stringify(bSession)} })`)
  await sleep(600)
  await a.shot('a-peer-card.png')
  const hasPub = await a.eval(`!!${MW}.ctx.world.peers.get(${JSON.stringify(bSession)}).pub`)
  ok('B has a public id on the wire', hasPub)
  const friendBtn = await a.eval(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('BLI VENNER')); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  ok('peer card offers BLI VENNER', !!friendBtn)
  if (friendBtn) {
    await a.tap(friendBtn.x, friendBtn.y)
    ok('A and B are friends', await a.until(`${MW}.social.isFriend(${MW}.ctx.world.peers.get(${JSON.stringify(bSession)}).pub)`, 8000))
    await sleep(500)
    await a.shot('a-befriended.png')
    await sleep(2200)
    await a.shot('a-peer-card-friends.png')
  }
  // A waves back from the card.
  const waveBtn = await a.eval(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'VINK'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (waveBtn) { await a.tap(waveBtn.x, waveBtn.y); await sleep(400); await b.shot('b-sees-a-wave.png') }
  ok('A waved back from the card', !!waveBtn)

  // B's castle marks A as HER NÅ.
  await b.eval(`${MW}.social.refresh()`)
  await b.eval(`${MW}.ctx.open({ id: 'castle' })`)
  await sleep(1500)
  ok('B: castle marks A HER NÅ', await b.eval(`document.body.textContent.includes('HER NÅ')`))
  await b.shot('b-castle-online.png')

  // Landscape phone: the HUD marker and the emote row stay clear of each other.
  await a.eval(`${MW}.ctx.closeAll()`)
  await a.send('Emulation.setDeviceMetricsOverride', { width: 667, height: 375, deviceScaleFactor: 1, mobile: true })
  await sleep(800)
  await a.shot('a-landscape.png')

  for (const p of pages) if (p.errors.length) ok(`${p.name}: no page errors`, false, p.errors.slice(0, 4).join('\n'))
} catch (err) {
  ok('run', false, err.stack)
} finally {
  for (const p of pages) p.close()
  try { if (browser) await Promise.race([browser.send('Browser.close'), sleep(1500)]) } catch { /* ignore */ }
  try { browser?.ws.close() } catch { /* ignore */ }
  proc.kill('SIGKILL')
}
const failed = checks.filter(c => !c[1]).length
console.log(`${checks.length - failed}/${checks.length} ok · shots in ${out}`)
process.exit(failed ? 1 : 0)
