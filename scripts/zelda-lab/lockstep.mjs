// The running shell in headless Chrome, one frame at a time, driven synchronously: the page's clock is held and a
// frame runs only when asked, 1/60 s on, so a script that reads the game and presses real keys or touches the deck
// plays the same on a loaded machine as on a quiet one. The browser (`cdp.mjs`) lives in a worker thread; this side
// blocks on it, so a player written for the engine (`tests/zelda-reel.mjs`) can drive the shell as it stands.
//   const b = lockstep({ width: 390, height: 844, dpr: 3, mobile: true }, 'http://127.0.0.1:3257')
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'

const SIZE = 24 * 1024 * 1024

if (!isMainThread && workerData?.lockstep) {
  const { launch } = await import('./cdp.mjs')
  const { cachedBytes, readPins } = await import('./lib/artcache.mjs')
  const PINNED = new Map(Object.values(readPins().PACKS).flatMap(p => ['albedo', 'normal', 'index'].filter(k => p[k]).map(k => [p[k].url, p[k]])))
  const ctl = new Int32Array(workerData.sab, 0, 2)
  const body = new Uint8Array(workerData.sab, 8)
  let b
  const ops = {
    async open(opts, source) {
      b = await launch({ ...opts, args: ['--use-angle=metal', '--enable-gpu', '--disable-frame-rate-limit', '--disable-gpu-vsync'] })
      await b.send('Network.enable')
      await b.send('Network.setBlockedURLs', { urls: ['wss://*'] })
      // Nothing leaves the machine: the pinned art packs come from the cache `npm run art:pull` filled.
      await b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] })
      b.on('Fetch.requestPaused', ({ requestId, request }) => {
        const f = PINNED.get(request.url)
        const bytes = f && cachedBytes(f)
        const answer = bytes
          ? b.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: request.url.endsWith('.json') ? 'application/json' : 'image/png' }, { name: 'access-control-allow-origin', value: '*' }], body: Buffer.from(bytes).toString('base64') })
          : b.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
        answer.catch(() => {})
      })
      await b.send('Page.addScriptToEvaluateOnNewDocument', { source })
    },
    goto: url => b.goto(url),
    eval: expr => b.eval(expr),
    send: (method, params) => b.send(method, params),
    shot: path => b.shot(path),
    sleep: ms => b.sleep(ms),
    errors: () => b.errors,
    close: () => b.close(),
  }
  parentPort.on('message', async ({ op, args }) => {
    let out
    try { out = { ok: (await ops[op](...args)) ?? null } } catch (e) { out = { fail: String(e?.stack ?? e) } }
    const bytes = Buffer.from(JSON.stringify(out))
    body.set(bytes)
    ctl[1] = bytes.length
    Atomics.store(ctl, 0, 1)
    Atomics.notify(ctl, 0)
  })
}

/** What every page gets first: a held clock, and a stepper for it. */
const CLOCK = `
  window.__manual = false; window.__q = []; window.__vt = 0; window.__ft = null;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => {
    if (window.__manual) { window.__q.push(cb); return 1 }
    return raf(t => { if (window.__manual) { window.__q.push(cb); return } const a = performance.now(); window.__vt = t; cb(t); window.__ft?.push([t, performance.now() - a]) })
  };
  window.__raf = raf;
  window.__step = n => { for (let k = 0; k < n; k++) { window.__vt += 1000 / 60; for (const cb of window.__q.splice(0)) cb(window.__vt) } };
  window.__run = () => { window.__manual = false; for (const cb of window.__q.splice(0)) window.requestAnimationFrame(cb) };
`

export function lockstep(opts, base) {
  const sab = new SharedArrayBuffer(8 + SIZE)
  const ctl = new Int32Array(sab, 0, 2)
  const worker = new Worker(new URL(import.meta.url), { workerData: { lockstep: true, sab } })
  const dec = new TextDecoder()
  const call = (op, ...args) => {
    Atomics.store(ctl, 0, 0)
    worker.postMessage({ op, args })
    if (Atomics.wait(ctl, 0, 0, 120000) === 'timed-out') throw new Error(`lockstep: ${op} did not answer`)
    const out = JSON.parse(dec.decode(new Uint8Array(sab, 8, ctl[1]).slice()))
    if (out.fail) throw new Error(out.fail)
    return out.ok
  }
  call('open', opts, CLOCK)
  const b = {
    eval: expr => call('eval', expr),
    send: (method, params) => call('send', method, params),
    sleep: ms => call('sleep', ms),
    errors: () => call('errors'),
    /** The page loaded (or loaded again), its game up, the clock running. */
    load() {
      call('goto', `${base}/`)
      for (let i = 0; i < 240 && !call('eval', '!!window.__zelda?.state'); i++) call('sleep', 500)
      call('sleep', 3000)
      call('eval', `(() => { const e = document.createElement('style'); e.textContent = '#nuxt-devtools-container, nuxt-devtools-frame { display: none !important }'; document.head.appendChild(e) })()`)
    },
    hold() { call('eval', 'window.__manual = true'); call('sleep', 120) },
    run() { call('eval', 'window.__run()') },
    /** A real frame let by: touches are handed to the page in step with it, and are there when this returns. */
    settle: () => call('eval', 'new Promise(r => window.__raf(() => r(true)))'),
    /** `n` frames on, and the value of `expr` after them. */
    step: (n = 1, expr = 'null') => call('eval', `(() => { window.__step(${n}); return ${expr} })()`),
    /** The picture as it stands (a real frame is let by, so that it is on the glass). */
    shot(path) { call('eval', 'new Promise(r => window.__raf(() => window.__raf(() => r(true))))'); call('shot', path) },
    close() { try { call('close') } finally { worker.terminate() } },
  }
  return b
}
