// Minimal Chrome DevTools Protocol driver for headless play-throughs of the
// Neon Shrine (no puppeteer on Sleeper). Node 22's global WebSocket talks to
// a headless chromium-browser started with a debugging port.
//
//   const b = await launch({ width: 1440, height: 900, mobile: false })
//   await b.goto('http://localhost:3001/')
//   await b.key('Enter'); await b.hold('ArrowUp', 400)
//   await b.shot('/home/petter/zshots/x.png'); b.errors; await b.close()
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const sleep = ms => new Promise(r => setTimeout(r, ms))

const KEYS = {
  Enter: { key: 'Enter', code: 'Enter', keyCode: 13 },
  Space: { key: ' ', code: 'Space', keyCode: 32 },
  Escape: { key: 'Escape', code: 'Escape', keyCode: 27 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 },
  Home: { key: 'Home', code: 'Home', keyCode: 36 },
  End: { key: 'End', code: 'End', keyCode: 35 },
  KeyK: { key: 'k', code: 'KeyK', keyCode: 75 },
  KeyM: { key: 'm', code: 'KeyM', keyCode: 77 },
  KeyQ: { key: 'q', code: 'KeyQ', keyCode: 81 },
  KeyP: { key: 'p', code: 'KeyP', keyCode: 80 },
  KeyN: { key: 'n', code: 'KeyN', keyCode: 78 },
  KeyR: { key: 'r', code: 'KeyR', keyCode: 82 },
  KeyY: { key: 'y', code: 'KeyY', keyCode: 89 },
  KeyT: { key: 't', code: 'KeyT', keyCode: 84 },
  KeyV: { key: 'v', code: 'KeyV', keyCode: 86 },
}

/**
 * A port nothing listens on. (Several lab scripts run at once on one machine: a random port that another script's
 * Chrome already holds would hand this script that Chrome.)
 */
async function freePort() {
  const { createServer } = await import('node:net')
  for (let tries = 0; tries < 40; tries++) {
    const port = 9300 + Math.floor(Math.random() * 6000)
    const free = await new Promise(done => {
      const probe = createServer()
      probe.once('error', () => done(false))
      probe.listen(port, '127.0.0.1', () => probe.close(() => done(true)))
    })
    if (free) return port
  }
  throw new Error('cdp: no free port for the browser')
}

// `args`: more flags for the browser (`side-shot.mjs` takes the frame limit off to time frames).
export async function launch({ width = 1440, height = 900, dpr = 1, mobile = false, args = [] } = {}) {
  const port = await freePort()
  mkdirSync(join(homedir(), 'zshots'), { recursive: true })
  const profile = mkdtempSync(join(homedir(), 'zshots', 'prof-'))
  // CHROME_BIN: another browser (the Mac's Chrome, where the lab can use the GPU). The mock keychain keeps a Mac's
  // Chrome, started over ssh with a new profile, from asking the desktop for a keychain to store its key in.
  const proc = spawn(process.env.CHROME_BIN || 'chromium-browser', [
    '--headless=new', '--no-sandbox', ...(process.env.CHROME_BIN ? [] : ['--disable-gpu']), '--hide-scrollbars', '--mute-audio', '--use-mock-keychain', '--password-store=basic', '--allow-file-access-from-files',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, ...args, 'about:blank',
  ], { stdio: 'ignore' })
  const exited = new Promise(done => { proc.once('exit', done); proc.once('error', done) })
  /** Kill the browser, wait for it to be gone, and remove the profile made above (that directory only). */
  const discard = async () => {
    proc.kill('SIGKILL')
    await Promise.race([exited, sleep(3000)])
    // (Its helpers may still be writing for a moment: `rmSync` tries again.)
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }) } catch (e) { console.warn(`cdp: ${profile} not removed: ${e.message}`) }
  }
  let targets
  for (let i = 0; i < 160; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break } catch { /* not yet */ }
    await sleep(250)
  }
  const page = targets?.find(t => t.type === 'page')
  if (!page) {
    // A browser that never answered must not be left running.
    await discard()
    throw new Error('chromium did not start within 40 s (server busy?)')
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r => ws.addEventListener('open', r, { once: true }))
  let id = 0
  const pending = new Map()
  const errors = []
  const logs = []
  /** CDP event listeners by method (b.on), e.g. Fetch.requestPaused to fake a server. */
  const listeners = new Map()
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
    if (msg.method) for (const fn of listeners.get(msg.method) ?? []) fn(msg.params)
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text)
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value ?? a.description).join(' ')
      if (msg.params.type === 'error') errors.push(text)
      logs.push(text)
    }
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, m => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)))
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile })
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

  const b = {
    errors,
    logs,
    send,
    on(method, fn) { listeners.set(method, [...(listeners.get(method) ?? []), fn]) },
    async goto(url) { await send('Page.navigate', { url }); await sleep(2500) },
    async eval(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result.value },
    async keyDown(name) { const k = KEYS[name]; await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode }) },
    async keyUp(name) { const k = KEYS[name]; await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode }) },
    async key(name, ms = 60) { await b.keyDown(name); await sleep(ms); await b.keyUp(name); await sleep(40) },
    async hold(name, ms) { await b.keyDown(name); await sleep(ms); await b.keyUp(name) },
    async touch(type, points) { await send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) }) },
    async tap(x, y) { await b.touch('touchStart', [{ x, y }]); await sleep(60); await b.touch('touchEnd', []); await sleep(60) },
    // The window changes size (an upright phone with its keyboard up), at the same pixel ratio and touch.
    async resize(w, h) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile }); await sleep(400) },
    async shot(path) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(r.data, 'base64')) },
    sleep,
    // Snap's chromium-browser is a wrapper: killing it orphans the real
    // browser, so ask the browser itself to quit first.
    async close() {
      try { await Promise.race([send('Browser.close'), sleep(1500)]); await Promise.race([exited, sleep(2000)]) } catch { /* ignore */ }
      try { ws.close() } catch { /* ignore */ }
      await discard()
    },
  }
  return b
}
