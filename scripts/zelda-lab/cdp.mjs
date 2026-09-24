// Minimal Chrome DevTools Protocol driver for headless play-throughs of the
// Neon Shrine (no puppeteer on Sleeper). Node 22's global WebSocket talks to
// a headless chromium-browser started with a debugging port.
//
//   const b = await launch({ width: 1440, height: 900, mobile: false })
//   await b.goto('http://localhost:3001/')
//   await b.key('Enter'); await b.hold('ArrowUp', 400)
//   await b.shot('/home/petter/zshots/x.png'); b.errors; await b.close()
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
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
  KeyK: { key: 'k', code: 'KeyK', keyCode: 75 },
  KeyQ: { key: 'q', code: 'KeyQ', keyCode: 81 },
  KeyP: { key: 'p', code: 'KeyP', keyCode: 80 },
  KeyN: { key: 'n', code: 'KeyN', keyCode: 78 },
  KeyR: { key: 'r', code: 'KeyR', keyCode: 82 },
  KeyY: { key: 'y', code: 'KeyY', keyCode: 89 },
  KeyT: { key: 't', code: 'KeyT', keyCode: 84 },
}

export async function launch({ width = 1440, height = 900, dpr = 1, mobile = false } = {}) {
  const port = 9300 + Math.floor(Math.random() * 500)
  const profile = mkdtempSync(join(homedir(), 'zshots', 'prof-'))
  const proc = spawn('chromium-browser', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: 'ignore' })
  let targets
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (targets.length) break } catch { /* not yet */ }
    await sleep(250)
  }
  const page = targets.find(t => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise(r => ws.addEventListener('open', r, { once: true }))
  let id = 0
  const pending = new Map()
  const errors = []
  const logs = []
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
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
    async goto(url) { await send('Page.navigate', { url }); await sleep(2500) },
    async eval(expr) { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); return r.result.value },
    async keyDown(name) { const k = KEYS[name]; await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode }) },
    async keyUp(name) { const k = KEYS[name]; await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.key, code: k.code, windowsVirtualKeyCode: k.keyCode }) },
    async key(name, ms = 60) { await b.keyDown(name); await sleep(ms); await b.keyUp(name); await sleep(40) },
    async hold(name, ms) { await b.keyDown(name); await sleep(ms); await b.keyUp(name) },
    async touch(type, points) { await send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) }) },
    async tap(x, y) { await b.touch('touchStart', [{ x, y }]); await sleep(60); await b.touch('touchEnd', []); await sleep(60) },
    async shot(path) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(r.data, 'base64')) },
    sleep,
    // Snap's chromium-browser is a wrapper: killing it orphans the real
    // browser, so ask the browser itself to quit first.
    async close() {
      try { await Promise.race([send('Browser.close'), sleep(1500)]) } catch { /* ignore */ }
      try { ws.close() } catch { /* ignore */ }
      proc.kill('SIGKILL')
    },
  }
  return b
}
