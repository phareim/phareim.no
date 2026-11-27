#!/usr/bin/env node
// THE LATE SHOW in the running shell (a local dev server only), in headless Chrome, driven by real key and pointer
// events: from the door in Rerun Estates through the booth and reel one to reel two's floor, with keys at 1280 × 800
// and on the touch deck at 390 × 844; the stomp onto a foe, a cracked floor and (in a yard made here) a spring pad;
// a held jump at 30 pictures a second; the 1958 card; a reload in the booth and in a reel; how often a thumb's stomp
// lands with B let go first; and the frame time over ten seconds. The visit is given the blade and many hearts, and
// some scenes set the hero or a foe on a spot first (each is printed); every move that is pictured is an input.
// Every request that leaves this machine is blocked.
//   CHROME_BIN=… [SHOTS=booth] node scripts/zelda-lab/lateshow-shot.mjs http://127.0.0.1:3187 <outDir> [desk|phone]
import { mkdirSync, writeFileSync } from 'node:fs'
import { launch } from './cdp.mjs'
import { cachedBytes, readPins } from './lib/artcache.mjs'

const PINNED = new Map(Object.values(readPins().PACKS).flatMap(p => ['albedo', 'normal', 'index'].filter(k => p[k]).map(k => [p[k].url, p[k]])))

const [base, out, only] = process.argv.slice(2)
if (!base || !out || !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)) { console.error('usage: lateshow-shot.mjs <local base url> <outDir> [desk|phone]'); process.exit(2) }
mkdirSync(out, { recursive: true })

const R = 0.34
let failed = false
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) failed = true }
const results = {}
const FLAGS = ['--use-angle=metal', '--enable-gpu', '--disable-frame-rate-limit', '--disable-gpu-vsync']

/** A spring pad in the floor, the ledge 4 up beside it, a cracked floor, and a sentry that stands still. */
const YARD = (() => {
  const rows = Array.from({ length: 24 }, (_, y) => Array.from({ length: 16 }, (_, x) => {
    if (y === 21) return x === 4 ? '▲' : x === 10 || x === 11 ? '%' : '#'
    if (y === 22) return x >= 9 && x <= 12 ? '.' : '#'
    if (y === 23) return '#'
    if (x === 0 || x === 15) return '#'
    if (y >= 17 && x >= 5 && x <= 7) return '#'
    return x === 2 && y === 20 ? '@' : '.'
  }).join(''))
  return { id: 'springyard', name: 'THE YARD', kind: 'side', track: 'dungeon', era: '1958', look: 'suburb', cell: { w: 16, h: 24 }, rows, marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } } } }
})()

async function open(opts) {
  const b = await launch({ ...opts, args: FLAGS })
  await b.send('Network.enable')
  await b.send('Network.setBlockedURLs', { urls: ['wss://*'] })
  // Nothing leaves the machine: the pinned art packs are answered from the cache `npm run art:pull` filled, and
  // every other https request fails.
  await b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] })
  b.on('Fetch.requestPaused', ({ requestId, request }) => {
    const f = PINNED.get(request.url)
    const bytes = f && cachedBytes(f)
    const answer = bytes
      ? b.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: request.url.endsWith('.json') ? 'application/json' : 'image/png' }, { name: 'access-control-allow-origin', value: '*' }], body: Buffer.from(bytes).toString('base64') })
      : b.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
    // (A request of a page just left is gone before it is answered.)
    answer.catch(() => {})
  })
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__ft = null;
    const raf = window.requestAnimationFrame.bind(window);
    window.__held = [];
    window.requestAnimationFrame = cb => raf(t => {
      if (window.__frozen) { window.__held.push(cb); return }
      const a = performance.now(); cb(t); window.__ft?.push([t, performance.now() - a]);
      if (window.__when?.()) { window.__when = null; window.__frozen = true }
    });
    window.__raf = raf;
  ` })
  await load(b)
  return b
}
async function load(b) {
  await b.goto(`${base}/`)
  for (let i = 0; i < 240 && !(await b.eval('!!window.__zelda?.state')); i++) await b.sleep(500)
  await b.sleep(3000)
  await b.eval(`(() => { const e = document.createElement('style'); e.textContent = '#nuxt-devtools-container, nuxt-devtools-frame { display: none !important }'; document.head.appendChild(e) })()`)
}
/** Hold the picture from the first frame on which `when` is true, take it, and let the game go on. */
async function still(b, path, when, act = async () => {}, ms = 3000) {
  await b.eval(`window.__when = () => { const s = window.__zelda.state, h = s.hero; return ${when} }`)
  await act()
  let held = false
  for (let i = 0; i < ms / 10 && !(held = await b.eval('!!window.__frozen')); i++) await b.sleep(10)
  if (held) { await b.sleep(80); await b.shot(path) }
  await b.eval('(() => { window.__when = null; window.__frozen = false; for (const cb of window.__held.splice(0)) window.requestAnimationFrame(cb) })()')
  if (!held) console.log('note never held for', path)
  return held
}
/** Frames of a patch of the room (tiles), 30 a second, onto one sheet. */
async function filmStart(b, n, a) {
  await b.eval(`(() => {
    const cap = window.__cap = { shots: [], done: false }
    const cv = document.querySelector('.zelda-canvas'), s = window.__zelda.state
    const T = 16, W = cv.width, H = cv.height
    const scale = Math.max(1, Math.min(Math.floor(W / 256), Math.floor(H / 384)))
    const vw = Math.ceil(W / scale), vh = Math.ceil(H / scale), ox = Math.floor((W - vw * scale) / 2), oy = Math.floor((H - vh * scale) / 2)
    const z = s.zone, cx = Math.round((z.x + (z.w - vw / T) / 2) * T), cy = Math.round((z.y + (z.h - vh / T) / 2) * T)
    const px = tx => (tx * T - cx) * scale + ox, py = ty => (ty * T - cy) * scale + oy
    const sx = px(${a.x0}), sy = py(${a.y0}), sw = px(${a.x1}) - sx, sh = py(${a.y1}) - sy
    let t0 = 0
    const grab = t => {
      t0 ||= t
      if (t - t0 >= cap.shots.length * 1000 / 30 - 1) {
        const k = Math.min(1, 320 / sw), c = document.createElement('canvas'); c.width = sw * k; c.height = sh * k
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false
        g.drawImage(cv, sx, sy, sw, sh, 0, 0, c.width, c.height)
        cap.shots.push({ c, t: t - t0, feet: s.hero.y + ${R}, x: s.hero.x })
      }
      if (cap.shots.length < ${n}) window.__raf(grab); else cap.done = true
    }
    window.__raf(grab)
  })()`)
}
async function filmSave(b, path, cols) {
  for (let i = 0; i < 200 && !(await b.eval('window.__cap.done')); i++) await b.sleep(50)
  const url = await b.eval(`(() => {
    const shots = window.__cap.shots, cols = ${cols}, w = shots[0].c.width, h = shots[0].c.height
    const c = document.createElement('canvas'); c.width = cols * (w + 4); c.height = Math.ceil(shots.length / cols) * (h + 4)
    const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height)
    g.font = '14px monospace'
    shots.forEach((k, i) => { const x = (i % cols) * (w + 4), y = Math.floor(i / cols) * (h + 4); g.drawImage(k.c, x, y); g.fillStyle = '#ffffff'; g.fillText((i + 1) + '  ' + Math.round(k.t) + ' ms', x + 4, y + 14) })
    return c.toDataURL('image/png')
  })()`)
  writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'))
}
const stats = a => { const s = [...a].sort((x, y) => x - y); const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: s.length, mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +s.at(-1).toFixed(2) } }
async function frameTime(b, play) {
  await b.eval('window.__ft = []')
  await play(10000)
  const ft = await b.eval('(() => { const f = window.__ft; window.__ft = null; return f })()')
  const by = new Map()
  for (const [t, d] of ft) by.set(t, (by.get(t) ?? 0) + d)
  const stamps = [...by.keys()].sort((a, c) => a - c)
  return { interval: stats(stamps.slice(1).map((t, i) => t - stamps[i])), work: stats([...by.values()]) }
}

/** The hands: keys, or the touch deck. Both answer `dir(x, y)`, `bDown`, `bUp`, `a`, `view`. */
function keys(b) {
  const held = new Set()
  const set = async (name, on) => { if (on && !held.has(name)) { held.add(name); await b.keyDown(name) } else if (!on && held.delete(name)) await b.keyUp(name) }
  return {
    async dir(x, y = 0) { await set('ArrowLeft', x < 0); await set('ArrowRight', x > 0); await set('ArrowUp', y < 0); await set('ArrowDown', y > 0) },
    bDown: () => set('KeyK', true),
    bUp: () => set('KeyK', false),
    async a(ms = 50) { await set('Space', true); await b.sleep(ms); await set('Space', false) },
    view: () => b.key('KeyV'),
  }
}
async function touch(b) {
  const down = new Map()
  const pts = () => [...down].map(([id, p]) => ({ id, ...p }))
  const send = (type, touchPoints) => b.send('Input.dispatchTouchEvent', { type, touchPoints })
  const press = async (id, p) => { down.set(id, p); await send('touchStart', pts()) }
  const move = async (id, p) => { down.set(id, p); await send('touchMove', pts()) }
  const lift = async (id) => { if (!down.has(id)) return; const p = down.get(id); down.delete(id); await send('touchEnd', down.size ? [{ id, ...p }] : []) }
  const STICK = { x: 90, y: 740 }
  const pad = sel => b.eval(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, top: r.y, left: r.x, label: e.getAttribute('aria-label') } })()`)
  return {
    pad,
    async dir(x, y = 0) {
      if (!x && !y) return lift(1)
      if (!down.has(1)) await press(1, STICK)
      await move(1, { x: STICK.x + x * 38, y: STICK.y + y * 38 })
    },
    async bDown() { const p = await pad('.zelda-pad-b'); if (p) await press(2, { x: p.x, y: p.y }) },
    bUp: () => lift(2),
    // (While lines are up the deck steps aside, and a tap on the world moves them on.)
    async a(ms = 50) { const p = await pad('.zelda-pad-a'); await press(3, p ? { x: p.x, y: p.y } : { x: 300, y: 420 }); await b.sleep(ms); await lift(3) },
    async view() { const v = await pad('.zelda-turn'); await b.tap(v.x, v.y) },
  }
}

async function run(size, opts) {
  const b = await open(opts)
  const phone = !!opts.mobile
  const I = phone ? await touch(b) : keys(b)
  const shot = name => b.shot(`${out}/${size}-${name}.png`)
  const st = async () => (await read()) ?? (await b.sleep(200), await read()) ?? Promise.reject(new Error(`the page lost its game (reloaded?): ${b.errors.slice(-3).join(' | ')}`))
  const read = () => b.eval(`(() => { const s = window.__zelda.state, h = s.hero, d = h.side; return { map: s.map.id, entry: s.entry.entry, mode: s.mode, zone: s.zoneIndex, card: s.card ? s.card.title : null, x: h.x, y: h.y, feet: h.y + ${R}, vx: h.vx, vy: d?.vy ?? 0, ground: !!d?.ground, ladder: !!d?.ladder, dive: !!d?.dive, act: h.act, hp: h.hp, stomp: s.inv.stomp, keys: s.inv.keyrings.lateshow ?? 0, view: s.view, flags: Object.keys(s.flags).filter(f => /lateshow|reel/.test(f)), foes: s.map.enemies.map(e => ({ kind: e.kind, x: e.x, y: e.y, dead: e.dead, hp: e.hp, cell: e.cell })) } })()`)
  const until = async (pred, ms = 4000) => { const end = Date.now() + ms; let s = await st(); while (!pred(s) && Date.now() < end) { await b.sleep(8); s = await st() } return s }
  const note = what => console.log('set ', `${size}: ${what}`)
  /** Set a scene: the hero with feet on `row` at x. */
  const put = async (x, row) => { note(`the hero set at ${x}, feet ${row}`); await b.eval(`(() => { const s = window.__zelda.state, h = s.hero; h.x = ${x}; h.y = ${row} - ${R}; h.knock = null; h.invuln = 0; h.swing = null; h.charge = -1; h.act = 'idle'; delete h.side })()`); await b.sleep(250) }
  const heal = () => b.eval('(() => { const h = window.__zelda.state.hero; h.maxHp = h.hp = 20 })()')
  /** Close whatever words are up. */
  const words = async () => { for (let i = 0; i < 40; i++) { const s = await st(); if (s.mode === 'play') return; if (s.mode === 'dialog' || s.mode === 'get') await I.a(); await b.sleep(220) } }
  /** From above: a way in the world as a way on the screen (the controls turn with the picture). */
  const steer = async (x, y) => {
    const iso = (await st()).view === 'iso'
    return iso ? I.dir(Math.sign(x - y), Math.sign(x + y)) : I.dir(Math.sign(x), Math.sign(y))
  }
  /** From above: toward (x, y) until there. */
  const walkTo = async (x, y, tol = 0.2) => {
    for (let i = 0; i < 500; i++) {
      const s = await st()
      if (s.mode === 'dialog' || s.mode === 'get') { await I.dir(0, 0); await words(); continue }
      const dx = x - s.x, dy = y - s.y
      if (Math.hypot(dx, dy) < tol) break
      await steer(Math.abs(dx) > tol * 0.6 ? Math.sign(dx) : 0, Math.abs(dy) > tol * 0.6 ? Math.sign(dy) : 0)
      await b.sleep(12)
    }
    await I.dir(0, 0)
  }
  const warp = async (x, y, map) => { await steer(x, y); await until(s => s.map === map && s.mode !== 'warp' || !!s.card, 5000); await I.dir(0, 0); await b.sleep(500); return st() }
  /** Along the ground to x: held while far, then taps, so that a slow machine does not carry the hero past. */
  const walk = async (x) => {
    const s0 = await st()
    const way = x > s0.x ? 1 : -1
    if (Math.abs(x - s0.x) > 1.4) {
      await I.dir(way)
      await until(s => s.mode !== 'play' || way * (s.x - x) >= -0.9)
      await I.dir(0)
      await b.sleep(120)
    }
    for (let i = 0; i < 12; i++) {
      const s = await st()
      if (s.mode !== 'play' || Math.abs(x - s.x) < 0.2) break
      await I.dir(Math.sign(x - s.x))
      await b.sleep(Math.max(8, Math.abs(x - s.x) * 120))
      await I.dir(0)
      await b.sleep(150)
    }
    await b.sleep(80)
  }
  /** B held to the landing, the stick let go in time to come down near x. */
  const jump = async (x) => {
    await until(s => s.ground)
    const s0 = await st()
    const way = x > s0.x ? 1 : -1
    await I.dir(way)
    await I.bDown()
    await until(s => !s.ground, 500)
    await until(s => s.ground || way * (x - s.x - (s.vx * Math.abs(s.vx)) / 80) <= 0.05)
    await I.dir(0)
    const s = await until(s => s.ground || s.act === 'fall')
    await I.bUp()
    await b.sleep(150)
    return s
  }
  const climb = async (way, row) => { await I.dir(0, way); const s = await until(s => s.ground && !s.ladder && Math.abs(s.feet - row) < 0.05, 6000); await I.dir(0, 0); await b.sleep(200); return s }
  /** Cut at the foe of `kind` in this room until it falls, from where the hero stands or beside it. */
  const fight = async (kind, stay = false) => {
    for (let i = 0; i < 200; i++) {
      const s = await st()
      if (s.map !== 'reel1958') return false
      const e = s.foes.find(f => f.kind === kind && !f.dead && f.cell === s.zone)
      if (!e) return true
      if (s.mode !== 'play') { await words(); continue }
      const dx = e.x - s.x
      if (Math.abs(dx) < 1.45 && Math.abs(e.y - s.y) < 1.2) { await I.dir(Math.sign(dx) * (phone ? 0.5 : 1)); await b.sleep(10); await I.a(40); await I.dir(0); await b.sleep(90) }
      else if (stay && i < 120) await b.sleep(60)
      // (Never on to the reel's own door, at the west edge.)
      else if (dx > 0 || s.x > 1.9) { await I.dir(Math.sign(dx)); await b.sleep(50); await I.dir(0); await b.sleep(30) }
      else await b.sleep(60)
    }
    return false
  }

  /** The view gem (V) until the picture stands on `side`. */
  const view = async (side) => {
    for (let i = 0; i < 4 && (await st()).view !== side; i++) { await I.view(); await b.sleep(1600) }
    await b.sleep(900)
    check((await st()).view === side, `the ${side === 'iso' ? 'isometric' : '8-bit'} view`)
  }

  // -- the door -----------------------------------------------------------------
  await b.eval(`(() => { const s = window.__zelda.state; s.inv.sword = true; s.hero.maxHp = s.hero.hp = 20; s.dialog = null; s.hero.auto = null; s.mode = 'warp'; s.warp = { t: 0, to: 'rerun', entry: 'screen', swapped: false } })()`)
  note('the blade and 20 half hearts given; into Rerun Estates at the screen door')
  await b.sleep(2600)
  await words()
  await view('iso'); await shot('01-door-iso')
  await view('flat'); await shot('02-door-classic')
  await view('iso')
  // The sign below the door, and Lenny.
  await put(74.5, 12.84)
  await b.eval(`window.__zelda.state.hero.dir = 'right'`)
  await I.a(); await b.sleep(1400)
  await shot('03-door-sign')
  await words()
  await put(73.5, 17.84)
  await b.eval(`(() => { const h = window.__zelda.state.hero; h.dir = 'right' })()`)
  await I.a(); await b.sleep(1600)
  await shot('04-lenny')
  await words()
  await put(75.4, 10.84)
  let s = await warp(1, 0, 'showbooth')
  check(s.map === 'showbooth', `through the door in the screen into the booth's Scaffold (${s.map})`)
  await b.sleep(900)
  await shot('05-scaffold-line')
  await words(); await b.sleep(600)
  await view('iso'); await shot('06-scaffold-iso')
  await view('flat'); await shot('07-scaffold-classic')
  await walkTo(14.5, 6)
  await walkTo(17.5, 6)
  await b.sleep(900)
  await walkTo(20.5, 4.5)
  await b.sleep(700)
  await view('flat'); await shot('08-booth-classic')
  await view('iso'); await shot('09-booth-iso')
  // (The year sign, read.)
  await walkTo(19.5, 3.5, 0.12)
  await steer(0, -1); await b.sleep(60); await I.dir(0, 0); await I.a(); await b.sleep(700)
  await shot('10-year-sign')
  await words()
  await walkTo(20.5, 3.5, 0.15)
  const viewBefore = await b.eval(`document.querySelector('.zelda-turn')?.getAttribute('aria-label')`)

  const told = () => b.eval(`document.querySelector('.zelda-turn-said')?.textContent ?? ''`)
  const toldBefore = await told()

  if (process.env.SHOTS === 'booth') { await b.close(); return }

  // -- reel one -----------------------------------------------------------------
  // (Rerun's drones have had their time with the hero while the pictures were taken.)
  await heal()
  // The picture held once the card has faded in and shows its prompt.
  await still(b, `${out}/${size}-11-card-1958.png`, 's.card && s.card.t > 0.9', async () => { await steer(0, -1); await until(s => !!s.card, 5000); await I.dir(0, 0) }, 4000)
  s = await st()
  check(s.map === 'reel1958', `the 1958 lens (${s.map}), its card ${s.card ?? 'passed by itself'}`)
  await I.a(); await b.sleep(900)
  s = await st()
  check(!s.card, 'A passes the card')
  const said = await told()
  check(said === toldBefore, `the reel pins the classic picture without announcing it (the live region: "${toldBefore}" before, "${said}" in the reel)`)
  await b.sleep(1800)
  await shot('12-main-street')
  if (phone) {
    const room = await b.eval(`(() => { const cv = document.querySelector('.zelda-canvas'), W = cv.width, H = cv.height, r = devicePixelRatio; const scale = Math.max(1, Math.min(Math.floor(W / 256), Math.floor(H / 384))); const top = (H - 384 * scale) / 2 / r, t = 16 * scale / r; return { scale, top, bottom: top + 24 * t, floorTop: top + 21 * t, width: 256 * scale / r, left: (W / r - 256 * scale / r) / 2, tile: t } })()`)
    const A = await I.pad('.zelda-pad-a'), B = await I.pad('.zelda-pad-b'), ROLL = await I.pad('.zelda-pad-roll')
    results.phone = { room, A, B, ROLL, between: +Math.hypot(A.x - B.x, A.y - B.y).toFixed(0) }
    check(B.w === A.w && A.w === 88, `B is as large as A (${B.w}, ${A.w}), ${results.phone.between} px apart`)
    for (const [n, p] of [['A', A], ['B', B], ['roll', ROLL]]) check(p.top >= room.bottom - 0.5, `the ${n} pad (top ${p.top.toFixed(0)}) is under the room's floor rows (${room.floorTop.toFixed(0)}-${room.bottom.toFixed(0)})`)
  }
  // The blob, the curb, the sentry, the stoop, the manhole, the ladder, the key.
  await fight('blob'); await heal()
  await walk(3.2); await jump(4.9)
  await walk(5.3)
  await shot('13-sentry-from-curb')
  await fight('sentry', true); await heal()
  await words()
  s = await st()
  check(s.foes.filter(f => f.cell === 0).every(f => f.dead), `Main Street's two fall to the blade (${JSON.stringify(s.foes.filter(f => f.cell === 0 && !f.dead))})`)
  await b.sleep(700)
  if (s.x < 5.2 || s.x > 7) { await put(5.5, 20) }
  await walk(5.5)
  // A held jump, filmed.
  await filmStart(b, 30, { x0: 3, x1: 12, y0: 15.5, y1: 22 })
  s = await jump(8.45)
  await filmSave(b, `${out}/${size}-14-held-jump-30fps.png`, 6)
  await walk(8.7)
  s = await jump(12.45)
  check(s.ground && s.x > 11.8 && Math.abs(s.feet - 21) < 0.05, `over the manhole (${s.x.toFixed(2)}, ${s.feet.toFixed(2)})`)
  if (!(s.x > 11.8 && Math.abs(s.feet - 21) < 0.05)) await put(12.45, 21)
  await walk(12.5)
  s = await climb(-1, 16)
  check(Math.abs(s.feet - 16) < 0.05, `up the ladder to the shop roof (${s.feet.toFixed(2)})`)
  await I.dir(phone ? 0.5 : 1); await b.sleep(30); await I.dir(0); await I.a(); await b.sleep(1000)
  await shot('15-key-on-the-roof')
  await words()
  s = await st()
  check(s.keys === 1, `the key off the roof (${s.keys})`)
  await walk(12.35); s = await jump(14.5)
  await walk(15.45); s = await climb(1, 21)
  await I.dir(1); await until(s => s.zone === 1, 4000); await b.sleep(250); await I.dir(0); await b.sleep(900)
  s = await st()
  check(s.zone === 1, 'over the seam into the Backlot')
  await shot('16-backlot')
  // The platform, the ledge, the Stomp. (The bat is put down first: the pictures are of the climb.)
  await b.eval(`(() => { for (const e of window.__zelda.state.map.enemies) if (e.kind === 'bat') { e.dead = true; e.deathT = 1 } })()`)
  note('the Backlot bat put down')
  await walk(23.4); s = await jump(25)
  await walk(26.4); s = await jump(29)
  check(Math.abs(s.feet - 17) < 0.05, `onto the alcove ledge by the platform (${s.x.toFixed(2)}, ${s.feet.toFixed(2)})`)
  if (Math.abs(s.feet - 17) > 0.05) await put(29, 17)
  await walk(29.3)
  await I.dir(phone ? 0.5 : 1); await b.sleep(30); await I.dir(0); await I.a(); await b.sleep(900)
  await shot('17-the-stomp')
  await b.sleep(900)
  await shot('18-the-stomp-words')
  await words()
  s = await st()
  check(s.stomp, 'the Stomp is got')
  await b.sleep(500)
  await shot('19-on-the-ledge')

  // The stomp on the blob: from the floor under the ledge, a tap of B, then A.
  let flat = false
  for (let k = 0; k < 8 && !flat; k++) {
    s = await st()
    const e = s.foes.find(f => f.kind === 'blob' && f.cell === 1 && !f.dead)
    if (!e) break
    if (s.hp < 8) await heal()
    // (The blob set standing in the open below the ledge's end.)
    await b.eval(`(() => { const e = window.__zelda.state.map.enemies.find(e => e.kind === 'blob' && e.cell === 1); e.x = 29.6; e.y = 20.62; e.ai.mode = 'idle'; e.ai.t = 4 })()`)
    note('the blob set at x 29.6 on the floor, at rest')
    await put(28.9, 17)
    await I.dir(-1); await until(s => !s.ground, 800); await I.dir(0)
    await put(29.4, 17.0)
    await b.eval(`(() => { const h = window.__zelda.state.hero; h.x = 29.4; h.y = 18.3; delete h.side })()`)
    note('the hero set in the air over it')
    await filmStart(b, 24, { x0: 25, x1: 32, y0: 15, y1: 22 })
    await b.sleep(40); await I.a(40)
    await filmSave(b, `${out}/${size}-20-stomp-foe-30fps.png`, 6)
    await shot('21-stomp-foe-after')
    await b.sleep(700)
    flat = !(await st()).foes.find(f => f.kind === 'blob' && f.cell === 1 && !f.dead)
  }
  check(flat, 'the stomp flattens the blob')

  // The cracked floor: a tap of B, then A.
  await put(22.5, 21)
  await b.sleep(400)
  await shot('22-cracked-floor')
  await filmStart(b, 24, { x0: 19, x1: 26, y0: 16, y1: 24 })
  await I.bDown(); await b.sleep(50); await I.bUp(); await b.sleep(60); await I.a(40)
  await filmSave(b, `${out}/${size}-23-stomp-crack-30fps.png`, 6)
  await b.sleep(400)
  s = await st()
  check(s.ground && s.feet > 22.9, `through the cracked floor into the nook (${s.feet.toFixed(2)})`)
  await shot('24-in-the-nook')
  await I.dir(phone ? 0.5 : 1); await b.sleep(40); await I.dir(0); await I.a(); await b.sleep(1200); await words()
  check((await st()).flags.includes('chest:lateshow.nook'), 'the chest under the floor')
  await walk(22.5); s = await jump(24.4)
  check(Math.abs(s.feet - 21) < 0.05, `out of the nook by a held jump (${s.x.toFixed(2)}, ${s.feet.toFixed(2)})`)

  // -- the frame time -----------------------------------------------------------
  await heal()
  await put(18, 21)
  results[`${size}Frames`] = await frameTime(b, async (ms) => {
    const end = Date.now() + ms
    let way = 1
    while (Date.now() < end) {
      await I.dir(way)
      await I.bDown(); await b.sleep(120); await I.bUp()
      await b.sleep(120); await I.a(40); await b.sleep(500)
      const s = await st()
      if (s.x > 26) way = -1
      if (s.x < 18) way = 1
      if (s.mode !== 'play') await words()
      if (s.feet > 21.5) await put(19, 21)
    }
    await I.dir(0)
  })

  // -- back, the reload, the locked lens, reel two ------------------------------
  await heal()
  await put(17, 21)
  await I.dir(-1); await until(s => s.zone === 0, 4000); await b.sleep(200); await I.dir(0); await b.sleep(900)
  // A reload inside a reel: back in the side picture, at the lens, with the card again.
  s = await st()
  console.log('note before the reload', JSON.stringify({ map: s.map, entry: s.entry, x: s.x, feet: s.feet }), await b.eval(`JSON.stringify(Object.entries(localStorage).filter(([k]) => /zelda/i.test(k)).map(([k, v]) => [k, /"entry"/.test(v) ? v.match(/"map":"[^"]*","entry":"[^"]*"/)?.[0] : v.length])) + ' out=' + sessionStorage.getItem('zelda.out')`))
  await load(b)
  s = await st()
  check(s.map === 'reel1958' && s.entry === 'lens' && s.stomp && s.keys === 1, `a reload in a reel comes back at its lens (${s.map} ${s.entry})`)
  check((await b.eval(`document.querySelector('.zelda-turn')?.getAttribute('aria-label')`))?.includes('only'), 'in the 8-bit picture, pinned')
  await shot('25-reload-in-reel')
  await b.sleep(3000)
  await heal()
  await put(1.6, 20)
  s = await warp(-1, 0, 'showbooth')
  check(s.map === 'showbooth' && s.entry === 'lens1', `out by the reel's door to the lens it came from (${s.map} ${s.entry})`)
  await b.sleep(2200)
  const viewAfter = await b.eval(`document.querySelector('.zelda-turn')?.getAttribute('aria-label')`)
  check(viewAfter === viewBefore, `the view the player had is back ("${viewAfter}")`)
  await shot('26-back-in-booth')
  await load(b)
  s = await st()
  check(s.map === 'showbooth' && s.entry === 'lens1', `a reload in the booth stays in the booth (${s.map} ${s.entry})`)
  await heal()
  await walkTo(27.5, 4)
  await walkTo(27.5, 3.5, 0.15)
  await shot('27-locked-lens')
  await steer(0, -1); await b.sleep(300); await I.dir(0, 0)
  s = await st()
  check(s.keys === 0, 'the locked lens opens to the bump')
  s = await warp(0, -1, 'reel1986')
  await b.sleep(2000)
  check(s.map === 'reel1986', `the 1986 lens (${(await st()).map})`)
  await shot('28-reel-two')
  s = await warp(-1, 0, 'showbooth')
  check(s.map === 'showbooth' && s.entry === 'lens2', `and back (${s.entry})`)

  // -- the yard: a spring pad (no room has one yet), and the thumb ---------------
  await b.eval(`(() => { const z = window.__zelda; z.world.maps.springyard = ${JSON.stringify(YARD)}; const s = z.state; s.mode = 'warp'; s.warp = { t: 0, to: 'springyard', entry: 'start', swapped: false } })()`)
  note('a yard made by this script (a pad, a ledge, cracks) handed to the page')
  await b.sleep(1800)
  if (!(await st()).stomp) { note('the Stomp given (the run above did not get it)'); await b.eval('window.__zelda.state.inv.stomp = true') }
  await put(3.8, 21)
  await shot('29-yard-spring')
  console.log('note in the yard', JSON.stringify(await st()).slice(0, 220))
  await filmStart(b, 36, { x0: 1, x1: 9, y0: 14, y1: 22 })
  await I.bDown(); await b.sleep(40); await I.bUp(); await b.sleep(60); await I.a(40)
  await until(s => s.vy > -1, 1500); await I.dir(1); await b.sleep(250); await I.dir(0)
  await filmSave(b, `${out}/${size}-31-spring-30fps.png`, 6)
  s = await until(s => s.ground, 2000)
  check(Math.abs(s.feet - 17) < 0.05, `off the pad onto the ledge 4 up (${s.x.toFixed(2)}, ${s.feet.toFixed(2)})`)
  await shot('32-on-the-ledge-over-the-pad')

  // The thumb: B tapped or held a while, let go, then A. Does the stomp come?
  const trials = []
  for (const [hold, gap] of [[30, 20], [40, 60], [50, 120], [60, 200], [60, 40], [90, 60], [90, 140], [120, 60], [120, 120], [150, 40], [150, 100], [200, 60], [200, 140], [40, 260], [60, 300]]) {
    for (const on of ['spring', 'crack']) {
      await b.eval(`(() => { const s = window.__zelda.state, m = s.map; for (const x of [10, 11]) m.tiles[21 * m.w + x] = '%'; m.version++ })()`)
      await put(on === 'spring' ? 3.8 : 10.2, 21)
      await b.eval(`(() => { window.__dived = false; window.__stop = false; (function f() { if (window.__zelda.state.hero.side?.dive) window.__dived = true; if (!window.__stop) window.__raf(f) })() })()`)
      await I.bDown(); await b.sleep(hold); await I.bUp(); await b.sleep(gap); await I.a(40)
      await b.sleep(900)
      trials.push({ on, hold, gap, dived: await b.eval('window.__dived') })
      await b.eval('window.__stop = true'); await b.sleep(30)
    }
  }
  results[`${size}Thumb`] = { landed: trials.filter(t => t.dived).length, of: trials.length, missed: trials.filter(t => !t.dived) }

  const errs = b.errors.filter(e => !/ERR_BLOCKED|Failed to load resource|net::|\[vite\]|WebSocket/.test(e))
  check(errs.length === 0, `no script errors (${errs.slice(0, 3).join(' | ')})`)
  await b.close()
}

if (only !== 'phone') await run('desk', { width: 1280, height: 800 })
if (only !== 'desk') await run('phone', { width: 390, height: 844, dpr: 3, mobile: true })
console.log(JSON.stringify(results, null, 1))
if (process.env.SHOTS !== 'booth') writeFileSync(`${out}/results${only ? `-${only}` : ''}.json`, JSON.stringify(results, null, 1))
process.exit(failed ? 1 : 0)
