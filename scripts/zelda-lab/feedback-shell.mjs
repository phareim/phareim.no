#!/usr/bin/env node
// The feedback button in the shell (themes/zelda/feedback/, docs/games/neon-shrine-feedback.md), in a headless Chrome
// against a dev server and the fake service: on an upright phone and a desktop window, in the 8-bit view and the
// isometric one. With DEV MODE off there is no button, no request and none of the feature's code; with it on the
// button shows only after a yes; its window stops the world, hears the typing, sends the picture, the words, the place
// and the save, keeps them when the sending fails, and fits above a keyboard.
//
//   npm run smoke:feedback                       against a dev server on http://localhost:3030 (`npm run dev`)
//   npm run smoke:feedback -- <url> [shotsDir]   against another address, saving pictures
//
// It starts the fake itself on port 3957. Requests to any other machine are answered inside the browser (as a visitor
// who is signed in nowhere), so nothing outside this machine is asked. CHROME_BIN names the browser. It removes the
// browser profiles it made. Exit code 1 when a check fails.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { connect } from 'node:net'
import { basename } from 'node:path'
import { launch } from './cdp.mjs'
import { startFake } from './feedback-fake.mjs'

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!process.env.CHROME_BIN && process.platform === 'darwin' && existsSync(MAC_CHROME)) process.env.CHROME_BIN = MAC_CHROME

const [url = 'http://localhost:3030/', shots] = process.argv.slice(2)
if (shots) mkdirSync(shots, { recursive: true })
const PORT = 3957
const NOT_SENT = 'NOT SENT: NO ANSWER OR NOT SIGNED IN'

/** A game some way in: the blade, the disc in hand, the bomb bag; standing in town. */
const SAVE = {
  v: 2, map: 'overworld', entry: 'hut', hp: 6, maxHp: 8,
  inv: { sword: true, bombBag: true, bombs: 4, disc: true, bits: 12, keys: 0, bigKey: false, pieces: 1, selected: 'disc', prism: false, hook: false, arc: false, bigBag: false, shrooms: 0, keyrings: {} },
  flags: ['item:sword', 'item:disc', 'item:bombBag'], rng: 7, elapsed: 900,
}

const listening = host => new Promise((done) => {
  const s = connect({ port: PORT, host })
  s.once('connect', () => { s.destroy(); done(true) })
  s.once('error', () => done(false))
})
const busy = () => {
  console.log(`FAIL port ${PORT} is busy: stop whatever listens there (a hand-run feedback-fake.mjs?) and run this again`)
  process.exit(1)
}
if (await listening('127.0.0.1') || await listening('::1')) busy()
const fake = await startFake({ port: PORT }).catch(busy)

let failed = 0
let mode = 'yes'
const setMode = (m) => { mode = m; fake.setMode(m) }
/** What each browser logged that the fake did not mean it to. */
const noise = []
const outside = new Set()
const numbers = []

function ok(what, pass, detail = '') {
  if (!pass) failed++
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${what}${detail ? ` (${detail})` : ''}`)
}

/** A browser of one size, with what it asks for and complains of written down. */
async function browser(size) {
  const b = await launch({ ...size, args: ['--enable-automation'] })
  // The profile this browser was given, to be removed with it.
  const line = await b.send('Browser.getBrowserCommandLine')
  b.profile = line.arguments.find(a => a.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length)
  b.asked = []
  const urls = new Map()
  const complain = (text, about = '') => {
    // The fake's own refusals and broken sockets are the point of those steps.
    if (mode !== 'yes' && `${text} ${about}`.includes(`:${PORT}/`)) return
    noise.push(`${text}${about ? ` ${about}` : ''}`.slice(0, 300))
  }
  b.on('Network.requestWillBeSent', (p) => { urls.set(p.requestId, p.request.url); b.asked.push(p.request.url) })
  b.on('Network.loadingFailed', (p) => { if (!p.canceled) complain(`request failed: ${p.errorText}`, urls.get(p.requestId)) })
  b.on('Network.responseReceived', (p) => { if (p.response.status >= 400) complain(`HTTP ${p.response.status}`, p.response.url) })
  b.on('Log.entryAdded', ({ entry }) => { if (entry.level === 'error') complain(entry.text, entry.url) })
  b.on('Runtime.exceptionThrown', p => complain(p.exceptionDetails.exception?.description ?? p.exceptionDetails.text))
  b.on('Runtime.consoleAPICalled', p => { if (p.type === 'error') complain(p.args.map(a => a.value ?? a.description).join(' ')) })
  // Every address on another machine (all of them https here) is answered in the browser.
  b.on('Fetch.requestPaused', (p) => {
    const to = new URL(p.request.url)
    outside.add(to.host)
    const origin = p.request.headers.Origin ?? new URL(url).origin
    void b.send('Fetch.fulfillRequest', {
      requestId: p.requestId, responseCode: 200,
      responseHeaders: [['content-type', 'application/json'], ['access-control-allow-origin', origin], ['access-control-allow-credentials', 'true'], ['access-control-allow-headers', 'content-type']].map(([name, value]) => ({ name, value })),
      body: Buffer.from(to.pathname === '/api/session' ? '{"user":null}' : '{}').toString('base64'),
    }).catch(() => {})
  })
  await b.send('Network.enable')
  await b.send('Log.enable')
  await b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] })
  return b
}

async function shut(b) {
  if (!b) return
  await b.close()
  // Only the profile this run's own browser named, one of `cdp.mjs`'s.
  if (b.profile && basename(b.profile).startsWith('prof-')) {
    await new Promise(r => setTimeout(r, 500))
    rmSync(b.profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
}

async function until(what, ms = 8000) {
  const end = Date.now() + ms
  let v = await what()
  while (!v && Date.now() < end) { await new Promise(r => setTimeout(r, 50)); v = await what() }
  return v
}

const q = (b, expr) => b.eval(expr)
const exists = (b, sel) => q(b, `!!document.querySelector(${JSON.stringify(sel)})`)
const rect = (b, sel) => q(b, `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom } })()`)
const hero = b => q(b, `(() => { const h = window.__zelda?.state.hero; return h ? { x: h.x, y: h.y } : null })()`)
const value = b => q(b, `document.querySelector('.fbk-text')?.value ?? null`)
const status = b => q(b, `document.querySelector('.fbk-status')?.textContent.trim() ?? null`)
const paused = b => q(b, `!!document.querySelector('canvas.zelda-canvas--paused')`)

const middle = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

/** A finger on the middle of an element, or the mouse's press there. */
async function press(b, sel) {
  const r = await until(() => rect(b, sel))
  if (!r) { ok(`there is a ${sel} to press`, false); return }
  await pressAt(b, middle(r))
}

/** Both halves of the press are handed to the browser at once, so the next one need not wait for the page's frames. */
function pressAt(b, { x, y }) {
  return Promise.all(b.size.mobile
    ? [b.touch('touchStart', [{ x, y }]), b.touch('touchEnd', [])]
    : ['mousePressed', 'mouseReleased'].map(type => b.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 })))
}

async function type(b, word) {
  for (const ch of word) {
    const k = { key: ch, code: `Key${ch.toUpperCase()}`, windowsVirtualKeyCode: ch.toUpperCase().charCodeAt(0) }
    await b.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, ...k })
    await b.sleep(40)
    await b.send('Input.dispatchKeyEvent', { type: 'keyUp', ...k })
  }
}

/** The world up, the hero standing in it, nothing said. */
async function play(b) {
  const ready = () => q(b, `(() => { const c = document.querySelector('.zelda-corner'); const s = window.__zelda?.state
    return !!s && !!c && !c.classList.contains('zelda-corner--night') && s.mode === 'play' && !s.hero.auto && !c.classList.contains('zelda-corner--away') })()`)
  for (let i = 0; i < 8; i++) {
    if (await until(ready, i ? 1500 : 60_000)) break
    await b.key('Enter')
  }
  await b.sleep(700)
}
async function load(b) {
  await b.goto(url)
  await play(b)
}

async function picture(b, name, clip) {
  if (!shots) return
  if (!clip) { await b.shot(`${shots}/${name}.png`); return }
  // (`scale` is on top of the screen's own pixel ratio: four picture px to a CSS px.)
  const r = await b.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 4 / b.size.dpr } })
  writeFileSync(`${shots}/${name}.png`, Buffer.from(r.data, 'base64'))
}

/** A JPEG's size, from its frame header. */
function jpegSize(buf) {
  for (let i = 2; i + 9 < buf.length;) {
    if (buf[i] !== 0xff) return null
    const m = buf[i + 1]
    if (m >= 0xc0 && m <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
    i += 2 + buf.readUInt16BE(i + 2)
  }
  return null
}

/** The field, SEND, CANCEL and the line under them lie whole inside a window `h` high. */
async function fits(b, what, w, h) {
  for (const sel of ['.fbk-text', '.fbk-send', '.fbk-cancel', '.fbk-status']) {
    const r = await rect(b, sel)
    ok(`${what}: ${sel} is inside the window`, !!r && r.x >= 0 && r.y >= 0 && r.right <= w && r.bottom <= h, r && `${Math.round(r.y)}–${Math.round(r.bottom)} of ${h}`)
  }
}

async function run(b, name, view) {
  const tag = `${name} ${view}`
  const file = `${name}-${view}`

  // DEV MODE off.
  setMode('yes')
  await q(b, `localStorage.removeItem('zelda.dev')`)
  let before = fake.requests.length
  b.asked.length = 0
  await load(b)
  await b.sleep(1000)
  ok(`${tag}: the view is the one asked for`, await q(b, `localStorage.getItem('zelda.view')`) === view)
  ok(`${tag}: dev off, no FB`, !await exists(b, '.zelda-fb'))
  ok(`${tag}: dev off, the fake saw no request`, fake.requests.length === before, `${fake.requests.length - before}`)
  // (Not the stylesheets: the dev server names every component's in its page, the newsstand's too; a build does not.)
  const code = b.asked.filter(u => /\/feedback\/|:3957/.test(u) && !u.includes('useFeedback') && !u.includes('type=style'))
  ok(`${tag}: dev off, none of the feature's code was fetched`, !code.length, code.join(' '))

  // DEV MODE on, refused.
  setMode('no')
  await q(b, `localStorage.setItem('zelda.dev', '1')`)
  before = fake.requests.length
  await load(b)
  await until(() => fake.requests.length > before)
  await b.sleep(800)
  ok(`${tag}: refused, the question was asked once`, fake.requests.slice(before).map(r => r.method + r.path).join() === 'GET/can', fake.requests.slice(before).map(r => r.method + r.path).join())
  ok(`${tag}: refused, no FB`, !await exists(b, '.zelda-fb'))

  // Allowed.
  setMode('yes')
  await load(b)
  ok(`${tag}: allowed, FB is there`, !!await until(() => exists(b, '.zelda-fb')))
  await b.sleep(600)
  const fb = await rect(b, '.zelda-fb')
  const win = await q(b, `({ w: innerWidth, h: innerHeight })`)
  ok(`${tag}: FB is 44 × 44 inside the safe area`, !!fb && fb.w === 44 && fb.h === 44 && fb.x >= 0 && fb.y >= 0 && fb.right <= win.w && fb.bottom <= win.h, JSON.stringify(fb))
  const under = await q(b, `(() => { const seen = new Set(); for (let x = 2; x < 44; x += 8) for (let y = 2; y < 44; y += 8) for (const e of document.elementsFromPoint(x, y)) if (e.matches('a, button, input, textarea, [role=button]')) seen.add(e.className); return [...seen] })()`)
  ok(`${tag}: no other control in the top-left 44 × 44`, under.length === 1 && under[0].includes('zelda-fb'), under.join(' | '))
  // (The strip's words stand in the middle of the screen: the crop runs to their end.)
  const end = await q(b, `(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('.zelda-dev')); return r.getBoundingClientRect().right })()`)
  await picture(b, `${file}-1-strip`, { x: 0, y: 0, width: Math.min(win.w, Math.ceil(end) + 8), height: 64 })

  // The menu has the screen: the button steps away.
  await b.key('KeyP')
  await b.sleep(500)
  ok(`${tag}: FB steps away under the menu`, await q(b, `(() => { const e = document.querySelector('.zelda-fb'); return e.disabled && getComputedStyle(e).visibility === 'hidden' })()`))
  await b.key('Escape')
  await play(b)

  // From the keyboard: Enter on the button, Escape in the field and Escape beside it are CANCEL.
  if (!b.size.mobile) {
    for (const where of ['in the field', 'on the window']) {
      await q(b, `document.querySelector('.zelda-fb').focus()`)
      // (An Enter that types its character, as a real one does: that is what presses a focused button.)
      const enter = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }
      await b.send('Input.dispatchKeyEvent', { type: 'keyDown', text: '\r', ...enter })
      await b.send('Input.dispatchKeyEvent', { type: 'keyUp', ...enter })
      const open = !!await until(() => exists(b, '.fbk-box'))
      await b.sleep(500)
      if (where === 'on the window') await q(b, `document.querySelector('.fbk-box').focus()`)
      await b.key('KeyM')
      const still = await exists(b, '.fbk-box') && !await paused(b)
      await b.key('Escape')
      ok(`${tag}: Enter on FB opens, M ${where} opens no menu, Escape closes`, open && still && !!await until(async () => !await exists(b, '.fbk-box')) && !await paused(b))
      await play(b)
    }
    await q(b, `localStorage.removeItem('zelda.feedbackDraft')`)
    await load(b)
    await until(() => exists(b, '.zelda-fb'))
    await b.sleep(600)
  }

  // The window.
  const at = await hero(b)
  const tile = { x: Math.floor(at.x), y: Math.floor(at.y) }
  const had = fake.entries().length
  await press(b, '.zelda-fb')
  ok(`${tag}: a tap opens the window`, !!await until(() => exists(b, '.fbk-box')))
  const first = await hero(b)
  await b.sleep(3000)
  const later = await hero(b)
  ok(`${tag}: the hero stands still behind it`, first.x === later.x && first.y === later.y)
  ok(`${tag}: the picture is shown`, !!await until(() => q(b, `document.querySelector('.fbk-img')?.naturalWidth > 0`)))
  const focused = await q(b, `document.activeElement?.classList.contains('fbk-text')`)
  ok(`${tag}: the field ${b.size.mobile ? 'waits for a finger' : 'has the keyboard'}`, focused === !b.size.mobile)
  await picture(b, `${file}-2-panel`)
  if (b.size.mobile) await press(b, '.fbk-text')
  await b.sleep(200)
  await type(b, 'wasdpvt')
  await b.sleep(500)
  const typed = await hero(b)
  ok(`${tag}: the typing is in the field`, await value(b) === 'wasdpvt', await value(b))
  ok(`${tag}: and nowhere else: the hero did not move, no menu, the same view`, typed.x === first.x && typed.y === first.y && !await paused(b) && await q(b, `localStorage.getItem('zelda.view')`) === view)
  await press(b, '.fbk-send')
  ok(`${tag}: SENT.`, !!await until(async () => await status(b) === 'SENT.'), await status(b))
  await picture(b, `${file}-5-sent`)
  const entry = fake.entries()[had]
  ok(`${tag}: the fake holds one entry`, fake.entries().length === had + 1, `${fake.entries().length - had}`)
  if (entry) {
    const size = entry.shot ? jpegSize(entry.shot) : null
    ok(`${tag}: its picture is a JPEG of at most 300 000 bytes and 1280 px`, !!size && entry.shot.length <= 300_000 && Math.max(size.w, size.h) <= 1280, size && `${size.w} × ${size.h}, ${entry.shot.length} B, q ${entry.meta.shot?.q}`)
    ok(`${tag}: its tile is the one the hero stood on`, entry.meta.where.tile.x === tile.x && entry.meta.where.tile.y === tile.y, `${JSON.stringify(entry.meta.where.tile)} / ${JSON.stringify(tile)}`)
    ok(`${tag}: its save is there and its words`, entry.save?.map === 'overworld' && entry.text === 'wasdpvt')
    numbers.push(`${tag}: shot ${size?.w}x${size?.h} ${entry.shot?.length} B q${entry.meta.shot?.q}; meta ${Buffer.byteLength(JSON.stringify(entry.meta))} B; save ${Buffer.byteLength(JSON.stringify(entry.save))} B; view ${entry.meta.where.view.id} rule ${entry.meta.where.view.rule}`)
    if (shots && entry.shot) writeFileSync(`${shots}/${file}-3-received-shot.jpg`, entry.shot)
  }
  ok(`${tag}: the window closes and the draft is gone`, !!await until(async () => !await exists(b, '.fbk-box')) && await q(b, `localStorage.getItem('zelda.feedbackDraft')`) === null)

  // A sending that fails.
  await play(b)
  const count = fake.entries().length
  setMode('drop')
  await press(b, '.zelda-fb')
  await until(() => exists(b, '.fbk-box'))
  await b.sleep(500)
  if (b.size.mobile) await press(b, '.fbk-text')
  await b.send('Input.insertText', { text: 'ON AN ISLAND, NO WAY OFF' })
  await press(b, '.fbk-send')
  ok(`${tag}: ${NOT_SENT}`, !!await until(async () => await status(b) === NOT_SENT, 20_000), await status(b))
  ok(`${tag}: the words are still there, SEND reads RETRY`, await value(b) === 'ON AN ISLAND, NO WAY OFF' && await q(b, `document.querySelector('.fbk-send').textContent.trim()`) === 'RETRY')
  await picture(b, `${file}-4-not-sent`)
  await press(b, '.fbk-cancel')
  await until(async () => !await exists(b, '.fbk-box'))
  await play(b)
  await press(b, '.zelda-fb')
  await until(() => exists(b, '.fbk-box'))
  await b.sleep(500)
  ok(`${tag}: CANCEL and FB again restore it`, await value(b) === 'ON AN ISLAND, NO WAY OFF' && await status(b) === NOT_SENT && !!await until(() => exists(b, '.fbk-img')))
  setMode('yes')
  await press(b, '.fbk-send')
  await until(async () => await status(b) === 'SENT.')
  await until(async () => !await exists(b, '.fbk-box'))
  ok(`${tag}: RETRY leaves exactly one entry`, fake.entries().length === count + 1 && !!fake.entries().at(-1).shot && fake.entries().at(-1).text === 'ON AN ISLAND, NO WAY OFF', `${fake.entries().length - count}`)

  // The words over a reload; then SEND at once, before the picture is made.
  await play(b)
  await press(b, '.zelda-fb')
  await until(() => exists(b, '.fbk-box'))
  await b.sleep(500)
  if (b.size.mobile) await press(b, '.fbk-text')
  await b.send('Input.insertText', { text: 'KEPT' })
  const send = middle(await rect(b, '.fbk-send'))
  await press(b, '.fbk-cancel')
  await load(b)
  await until(() => exists(b, '.zelda-fb'))
  await b.sleep(600)
  const sofar = fake.entries().length
  // Where SEND stands was seen a moment ago (`send`): the press goes there as soon as the page says the window is up.
  await q(b, `(() => { window.__fb = {}; window.__fb.up = new Promise((done) => { new MutationObserver((_, o) => { if (document.querySelector('.fbk-send')) { window.__fb.open = performance.now(); o.disconnect(); done(true) } }).observe(document.body, { childList: true, subtree: true }) })
    addEventListener('pointerdown', (e) => { if (e.target.closest?.('.fbk-send')) window.__fb.send = e.timeStamp }, true) })()`)
  const button = middle(await rect(b, '.zelda-fb'))
  const up = q(b, `window.__fb.up`)
  const opening = pressAt(b, button)
  await up
  await Promise.all([opening, pressAt(b, send)])
  const gap = await q(b, `window.__fb.send - window.__fb.open`)
  const kept = await value(b)
  await until(() => fake.entries().length > sofar)
  const early = fake.entries()[sofar]
  ok(`${tag}: SEND within 100 ms of the window opening arrives with its picture`, gap >= 0 && gap < 100 && fake.entries().length === sofar + 1 && !!early?.shot, `${Math.round(gap)} ms`)
  ok(`${tag}: the words came through a reload`, kept === 'KEPT' && early?.text === 'KEPT', early?.text)
  await until(async () => !await exists(b, '.fbk-box'))
}

/** The window in a window cut down by a keyboard. */
async function keyboard(b, name, w, h, cut) {
  setMode('drop')
  await play(b)
  await press(b, '.zelda-fb')
  await until(() => exists(b, '.fbk-box'))
  await b.sleep(500)
  // With the longest status line standing under the buttons.
  await press(b, '.fbk-send')
  await until(async () => await status(b) === NOT_SENT, 20_000)
  await b.resize(w, h - cut)
  await fits(b, `${name}, ${w} × ${h - cut}`, w, h - cut)
  await picture(b, `${name}-6-keyboard`)
  await b.resize(w, h)
  // An iPhone's keyboard lies over the page instead: the window keeps clear of it by `--fb-kb`.
  await q(b, `document.querySelector('.fbk').style.setProperty('--fb-kb', '${cut}px')`)
  await b.sleep(200)
  await fits(b, `${name}, --fb-kb ${cut}px`, w, h - cut)
  setMode('yes')
  await press(b, '.fbk-send')
  await until(async () => !await exists(b, '.fbk-box'))
}

let b
try {
  for (const [name, size] of [['390x844', { width: 390, height: 844, dpr: 3, mobile: true }], ['1280x800', { width: 1280, height: 800, dpr: 1, mobile: false }]]) {
    b = await browser(size)
    b.size = size
    await b.goto(url)
    if (!await until(() => exists(b, 'canvas.zelda-canvas'), 120_000)) throw new Error(`no Neon Shrine at ${url} (is the dev server up?)`)
    await q(b, `(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('zeldaSave', ${JSON.stringify(JSON.stringify({ ...SAVE, savedAt: Date.now() }))}); localStorage.setItem('zelda.cornerLessons', '7') })()`)
    await load(b)
    for (const view of ['classic', 'iso']) {
      // V turns to the view (a visit starts in the isometric one), and the choice is kept over the reloads.
      await play(b)
      await b.key('KeyV')
      await until(() => q(b, `localStorage.getItem('zelda.view') === '${view}'`))
      await b.sleep(1200)
      await run(b, name, view)
    }
    if (size.mobile) {
      await keyboard(b, name, 390, 844, 320)
      // The narrowest phone: DEV MODE's words, as long as they get, beside the button.
      await b.resize(360, 780)
      await play(b)
      const gap = await q(b, `(() => { const s = document.querySelector('.zelda-dev'); const t = s.firstChild; const was = t.data; t.data = '120 FPS · UP 188.8 MB · DN 188.8 MB · V 888'
        const r = document.createRange(); r.selectNodeContents(s); const left = r.getBoundingClientRect().left
        const f = document.querySelector('.zelda-fb'); r.selectNodeContents(f); const right = r.getBoundingClientRect().right; t.data = was; return { text: left, fb: right } })()`)
      ok('360 px wide: the strip\'s words do not reach the button\'s letters', gap.text >= gap.fb + 4, `letters end at ${Math.round(gap.fb)}, the words begin at ${Math.round(gap.text)}`)
      await picture(b, '360x780-1-strip', { x: 0, y: 0, width: 360, height: 64 })
      numbers.push(`360 px: FB letters end at x ${gap.fb}, the strip's longest words begin at x ${gap.text}`)
    }
    // A notch: the button keeps under it.
    await b.resize(size.width, size.height)
    try {
      await b.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, left: 0, bottom: 34, right: 0 } })
      await load(b)
      await until(() => exists(b, '.zelda-fb'))
      await b.sleep(600)
      const r = await rect(b, '.zelda-fb')
      ok(`${name}: under a 47 px notch FB stands at 47`, r?.y === 47, `${r?.y}`)
      if (size.mobile) await picture(b, `${name}-1-strip-notch`, { x: 0, y: 0, width: 260, height: 112 })
    } catch (e) {
      console.log(`     (no safe-area emulation in this browser: ${e.message})`)
    }
    await shut(b)
    b = null
  }
  const small = { width: 375, height: 667, dpr: 2, mobile: true }
  b = await browser(small)
  b.size = small
  setMode('yes')
  await b.goto(url)
  await until(() => exists(b, 'canvas.zelda-canvas'), 60_000)
  await q(b, `(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('zeldaSave', ${JSON.stringify(JSON.stringify({ ...SAVE, savedAt: Date.now() }))}); localStorage.setItem('zelda.cornerLessons', '7'); localStorage.setItem('zelda.dev', '1') })()`)
  await load(b)
  await until(() => exists(b, '.zelda-fb'))
  await keyboard(b, '375x667', 375, 667, 270)
  ok('the console is clean, and no request failed but the fake\'s own', !noise.length, [...new Set(noise)].slice(0, 6).join(' | '))
} catch (e) {
  failed++
  console.log(`FAIL ${e.stack ?? e.message}`)
} finally {
  await shut(b)
  await fake.close()
}
for (const line of numbers) console.log(`     ${line}`)
console.log(`     answered in the browser instead of by another machine: ${[...outside].join(', ') || 'nothing'}`)
console.log(failed ? `${failed} failed` : 'all ok')
process.exit(failed ? 1 : 0)
