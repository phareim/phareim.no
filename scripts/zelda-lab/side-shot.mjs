#!/usr/bin/env node
// The side view's trial room in the running shell (a local dev server only), in headless Chrome, driven by real key
// and pointer events: pictures of standing, mid-jump, a fight, the ladder, the upper room, a fall, the pinned view
// and the MAP page; a contact sheet of one held jump at 30 pictures a second; the frame time over ten seconds of
// play; and what the shell does on the way in and out. The trial map is handed to the page through the dev handle
// (`window.__zelda`), and some scenes put the hero on their spot first; every move that is pictured is an input.
// Every request that leaves this machine is blocked.
//   CHROME_BIN=… node scripts/zelda-lab/side-shot.mjs http://127.0.0.1:3047 tmp/dungeons/shots/side
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const [base, out] = process.argv.slice(2)
if (!base || !out || !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)) { console.error('usage: side-shot.mjs <local base url> <outDir>'); process.exit(2) }
mkdirSync(out, { recursive: true })

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const bundled = esbuild.buildSync({ entryPoints: [resolve(repo, 'scripts/zelda-lab/side-trial.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error' })
const { SIDE_TRIAL } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'))

const R = 0.34
let failed = false
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) failed = true }

/** The GPU, and no frame limit: headless Chrome else paces even a blank page unevenly, and a frame's interval is then its cost. */
const FLAGS = ['--use-angle=metal', '--enable-gpu', '--disable-frame-rate-limit', '--disable-gpu-vsync']
async function open(opts) {
  const b = await launch({ ...opts, args: FLAGS })
  await b.send('Network.enable')
  // (By scheme: the dev server is the one thing on plain http. A pattern on a host's name would match local paths.)
  await b.send('Network.setBlockedURLs', { urls: ['https://*', 'wss://*'] })
  // Every animation frame's own work, timed; and a frame can be held the moment something is so (`still`).
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
  await b.goto(`${base}/`)
  for (let i = 0; i < 120 && !(await b.eval('!!window.__zelda?.state')); i++) await b.sleep(500)
  await b.sleep(2500)
  // (The dev server's own badge is not the game's.)
  await b.eval(`(() => { const e = document.createElement('style'); e.textContent = '#nuxt-devtools-container, nuxt-devtools-frame { display: none !important }'; document.head.appendChild(e) })()`)
  return b
}
/**
 * Hold the picture from the first frame on which `when` (an expression of the hero `h` and the state `s`) is true,
 * do `act` meanwhile, take it, and let the game go on. False when it never came true.
 */
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

const handle = b => ({
  st: () => b.eval(`(() => { const s = window.__zelda.state, h = s.hero, d = h.side; return { map: s.map.id, mode: s.mode, zone: s.zoneIndex, x: h.x, feet: h.y + ${R}, vx: h.vx, vy: h.vy, ground: !!d?.ground, ladder: !!d?.ladder, act: h.act, dir: h.dir, hp: h.hp, swing: h.swing ? { n: h.swing.n, t: h.swing.t, dir: h.swing.dir } : null, keys: s.inv.keyrings.sidetrial ?? 0, foes: s.map.enemies.map(e => ({ kind: e.kind, x: e.x, y: e.y, dead: e.dead, mode: e.ai.mode, t: e.ai.t })) } })()`),
  /** Into the trial room by the warp's own fade, with the blade. */
  enter: () => b.eval(`(() => { const z = window.__zelda; z.world.maps.sidetrial = ${JSON.stringify(SIDE_TRIAL)}; const s = z.state; s.inv.sword = true; s.hero.maxHp = s.hero.hp = 20; s.dialog = null; s.mode = 'warp'; s.warp = { t: 0, to: 'sidetrial', entry: 'start', swapped: false } })()`),
  /** Set a scene: the hero on (x, row), in the room that holds it. */
  put: (x, row) => b.eval(`(() => { const s = window.__zelda.state, h = s.hero; h.x = ${x}; h.y = ${row} - ${R}; h.knock = null; h.invuln = 0; h.swing = null; h.spin = null; h.roll = null; h.charge = -1; h.act = 'idle'; delete h.side; const z = ${row} <= 24 ? 0 : 2; if (s.zoneIndex !== z) { s.zoneIndex = z; s.zone = z === 0 ? { x: 0, y: 0, w: 16, h: 24 } : { x: 0, y: 24, w: 16, h: 12 } } })()`),
  /** Set a scene: the blob at rest well back from the gap, for the length of a jump. */
  rest: () => b.eval(`(() => { const e = window.__zelda.state.map.enemies.find(e => e.kind === 'blob'); if (e && !e.dead) { e.x = 10.4; e.ai.mode = 'idle'; e.ai.t = 1.6 } })()`),
  turnLabel: () => b.eval(`document.querySelector('.zelda-turn')?.getAttribute('aria-label') ?? null`),
  said: () => b.eval(`document.querySelector('.zelda-turn-said')?.textContent ?? ''`),
})

async function until(b, H, pred, ms = 4000) {
  const end = Date.now() + ms
  let s = await H.st()
  while (!pred(s) && Date.now() < end) { await b.sleep(8); s = await H.st() }
  return s
}

/** Frames of the room round (x0..x1, y0..y1 in tiles), one every 33.3 ms (30 a second), onto one sheet. */
async function filmStart(b, n, area) {
  await b.eval(`(() => {
    const cap = window.__cap = { shots: [], done: false }
    const cv = document.querySelector('.zelda-canvas'), s = window.__zelda.state
    const T = 16, W = cv.width, H = cv.height
    const scale = Math.max(1, Math.min(Math.floor(W / 256), Math.floor(H / 192)))
    const vw = Math.ceil(W / scale), vh = Math.ceil(H / scale), ox = Math.floor((W - vw * scale) / 2), oy = Math.floor((H - vh * scale) / 2)
    const z = s.zone, cx = Math.round((z.x + (z.w - vw / T) / 2) * T), cy = Math.round((z.y + (z.h - vh / T) / 2) * T)
    const px = tx => (tx * T - cx) * scale + ox, py = ty => (ty * T - cy) * scale + oy
    const a = ${JSON.stringify(area)}
    const sx = px(a.x0), sy = py(a.y0), sw = px(a.x1) - sx, sh = py(a.y1) - sy
    let t0 = 0
    const grab = t => {
      t0 ||= t
      if (t - t0 >= cap.shots.length * 1000 / 30 - 1) {
        const c = document.createElement('canvas'); c.width = sw / 2; c.height = sh / 2
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
    g.font = '16px monospace'
    shots.forEach((k, i) => {
      const x = (i % cols) * (w + 4), y = Math.floor(i / cols) * (h + 4)
      g.drawImage(k.c, x, y)
      g.fillStyle = '#ffffff'; g.fillText((i + 1) + '  ' + Math.round(k.t) + ' ms', x + 6, y + 18)
    })
    return c.toDataURL('image/png')
  })()`)
  writeFileSync(path, Buffer.from(url.split(',')[1], 'base64'))
  return b.eval(`window.__cap.shots.map(k => [Math.round(k.t), +k.feet.toFixed(2), +k.x.toFixed(2)])`)
}

const stats = a => { const s = [...a].sort((x, y) => x - y); const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: s.length, mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +s.at(-1).toFixed(2) } }
async function frameTime(b, play) {
  await b.eval('window.__ft = []')
  await play(10000)
  const ft = await b.eval('(() => { const f = window.__ft; window.__ft = null; return f })()')
  // (Several loops may run in a frame: their work is summed by the frame's stamp.)
  if (!ft?.length) throw new Error('no frames were timed (did the page reload?)')
  const by = new Map()
  for (const [t, d] of ft) by.set(t, (by.get(t) ?? 0) + d)
  const stamps = [...by.keys()].sort((a, c) => a - c)
  return { interval: stats(stamps.slice(1).map((t, i) => t - stamps[i])), work: stats([...by.values()]) }
}
const results = {}
/** A cut thrown from the floor with the blob in front of it. */
const FIGHTING = "h.swing && h.side.ground && h.swing.t > 0.07 && s.map.enemies.some(e => e.kind === 'blob' && Math.abs(e.x - h.x) < 1.7)"

// ---------------------------------------------------------------------------
// 1280 × 800, keys
// ---------------------------------------------------------------------------
{
  const b = await open({ width: 1280, height: 800 })
  const H = handle(b)
  const shot = name => b.shot(`${out}/desk-${name}.png`)
  const walk = async (x) => {
    const s0 = await H.st()
    const key = x > s0.x ? 'ArrowRight' : 'ArrowLeft'
    await b.keyDown(key)
    await until(b, H, s => s.mode !== 'play' || (key === 'ArrowRight' ? s.x >= x - 0.08 : s.x <= x + 0.08))
    await b.keyUp(key)
  }
  /** B held to the landing, the arrow let go in time to come down near x. */
  const jump = async (x) => {
    const s0 = await H.st()
    const way = x > s0.x ? 1 : -1
    const key = way > 0 ? 'ArrowRight' : 'ArrowLeft'
    await b.keyDown(key)
    await b.keyDown('KeyK')
    await until(b, H, s => !s.ground, 500)
    await until(b, H, s => s.ground || way * (x - s.x - (s.vx * Math.abs(s.vx)) / 80) <= 0.05)
    await b.keyUp(key)
    const s = await until(b, H, s => s.ground || s.act === 'fall')
    await b.keyUp('KeyK')
    return s
  }
  const before = await H.turnLabel()
  await H.enter()
  await b.sleep(150)
  await shot('00-fade')
  await b.sleep(1100)
  let s = await H.st()
  check(s.map === 'sidetrial' && s.ground, `in the trial room, standing (feet ${s.feet.toFixed(2)})`)
  const label = await H.turnLabel()
  check(/8-BIT ONLY HERE|Classic only here/i.test(label ?? ''), `the view is pinned: "${label}" (outside it was "${before}")`)
  await shot('01-standing')
  await b.key('KeyV')
  await b.sleep(350)
  await shot('02-pinned-v')
  check(/classic only here/i.test(await H.said()), `V says: "${await H.said()}"`)
  await b.sleep(1700)

  // Mid-jump: up on the keys is a jump too.
  await still(b, `${out}/desk-03-mid-jump.png`, 'h.side && !h.side.ground && h.side.vy > -3', () => b.keyDown('ArrowUp'))
  await b.keyUp('ArrowUp')
  await until(b, H, s => s.ground)

  // Over the gap, filmed.
  await walk(4.75)
  await H.rest()
  await filmStart(b, 30, { x0: 2.5, x1: 11, y0: 27.5, y1: 35 })
  s = await jump(8.1)
  results.deskFilm = await filmSave(b, `${out}/desk-04-held-jump-30fps.png`, 6)
  check(s.ground && s.x > 7.6 && Math.abs(s.feet - 33) < 0.02, `over the 3 tile gap with keys (${s.x.toFixed(2)}, ${s.feet.toFixed(2)})`)

  // A fight on the floor.
  let pictured = false
  for (let i = 0; i < 60; i++) {
    s = await H.st()
    const e = s.foes.find(f => f.kind === 'blob')
    if (e.dead) break
    const dx = e.x - s.x
    if (Math.abs(dx) < 1.4) {
      const key = dx > 0 ? 'ArrowRight' : 'ArrowLeft'
      const go = async () => { await b.keyDown(key); await b.keyDown('Space'); await b.sleep(30); await b.keyUp(key) }
      if (!pictured) pictured = await still(b, `${out}/desk-05-fight.png`, FIGHTING, go, 600)
      else { await go(); await b.sleep(50) }
      await b.keyUp('Space'); await b.sleep(120)
    } else { const key = dx > 0 ? 'ArrowRight' : 'ArrowLeft'; await b.keyDown(key); await b.sleep(60); await b.keyUp(key) }
  }
  s = await H.st()
  check(s.foes.find(f => f.kind === 'blob').dead, `the blob falls to cuts from Space (${JSON.stringify(s.foes.find(f => f.kind === 'blob'))}, hero ${s.x.toFixed(2)},${s.feet.toFixed(2)})`)
  // The roll's stop at an edge: from the gap's far side, rolling back toward it.
  await b.sleep(700)
  await H.put(9.4, 33)
  await b.sleep(400)
  await b.key('ArrowLeft', 40)
  await b.sleep(200)
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'l', code: 'KeyL', windowsVirtualKeyCode: 76 })
  await b.sleep(60)
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'l', code: 'KeyL', windowsVirtualKeyCode: 76 })
  await b.sleep(500)
  s = await H.st()
  await shot('05b-roll-at-edge')
  check(s.ground && s.x > 7.9 && s.x < 8.5, `a roll with the stick at rest stops at the edge (x ${s.x.toFixed(2)})`)

  await walk(10.3)
  s = await jump(12)
  check(s.ground && Math.abs(s.feet - 30) < 0.02, `up the 3 tile ledge with keys (${s.x.toFixed(2)}, ${s.feet.toFixed(2)})`)
  await shot('06-ledge')

  // The ladder.
  await H.put(13.5, 30)
  await b.sleep(200)
  await still(b, `${out}/desk-07-ladder.png`, 'h.side?.ladder && h.y < 27', () => b.keyDown('ArrowUp'))
  s = await H.st()
  check(s.ladder, `on the ladder (feet ${s.feet.toFixed(2)})`)
  s = await until(b, H, s => s.zone === 0 && s.ground && !s.ladder, 6000)
  await b.keyUp('ArrowUp')
  check(s.zone === 0 && Math.abs(s.feet - 20) < 0.02, `up into the loft (feet ${s.feet.toFixed(2)})`)
  await b.sleep(900)
  await shot('08-upper-room')
  await walk(11.5)
  await walk(10.4)
  s = await jump(7.9)
  check(Math.abs(s.feet - 17) < 0.02, `onto the first platform (feet ${s.feet.toFixed(2)})`)
  await walk(6.4)
  s = await jump(4.2)
  check(Math.abs(s.feet - 14) < 0.02, `onto the second platform (feet ${s.feet.toFixed(2)})`)
  await shot('09-platforms')

  // A fall.
  const hp = (await H.st()).hp
  await still(b, `${out}/desk-10-fall.png`, "h.act === 'fall' && h.actT > 0.2", () => b.keyDown('ArrowLeft'))
  await b.keyUp('ArrowLeft')
  await b.sleep(900)
  s = await H.st()
  check(s.ground && Math.abs(s.x - 11.5) < 0.1 && s.hp === hp - 1, `back on the safe ledge, half a heart poorer (${s.x.toFixed(2)}, ${s.feet.toFixed(2)}, ${s.hp}/${hp})`)
  await shot('11-put-back')

  // A cut upward, pictured: up and Space together from the third platform, the bat held still above.
  await H.put(7.2, 11)
  await b.sleep(300)
  await b.eval(`(() => { const s = window.__zelda.state, e = s.map.enemies.find(e => e.kind === 'bat'); if (e) { e.x = 7.5; e.y = 8.3; e.ai.mode = 'rest'; e.ai.t = 3 } })()`)
  await still(b, `${out}/desk-12-up-cut.png`, "h.swing && h.swing.dir === 'up' && h.swing.t > 0.07", async () => { await b.keyDown('ArrowUp'); await b.keyDown('Space') }, 800)
  await b.keyUp('Space'); await b.keyUp('ArrowUp')
  await b.sleep(900)

  // The bat, flying, overhead.
  await H.put(7.2, 11)
  for (let i = 0; i < 500; i++) {
    s = await H.st()
    const e = s.foes.find(f => f.kind === 'bat')
    if (e.dead) break
    const above = s.feet - R - e.y
    if (Math.abs(e.x - s.x) < 0.5 && above > 0.45 && above < 1.5) {
      await b.keyDown('ArrowUp'); await b.keyDown('Space'); await b.sleep(70)
      await b.keyUp('Space'); await b.keyUp('ArrowUp'); await b.sleep(150)
      // (Up is a jump on keys too: a cut upward from the ground leaves it.)
      await until(b, H, s => s.ground, 1500)
    } else await b.sleep(12)
  }
  results.deskBat = (await H.st()).foes.find(f => f.kind === 'bat').dead
  console.log('note the bat, cut with up + Space:', results.deskBat ? 'dead' : 'still flying')

  // The MAP page: the room's name and no chart.
  await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 })
  await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 })
  await b.sleep(500)
  await shot('13-map-page')
  await b.key('KeyP'); await b.sleep(200)
  if (await b.eval(`!!window.__zelda && document.querySelector('.zelda-canvas').classList.contains('zelda-canvas--paused')`)) { await b.key('KeyP'); await b.sleep(300) }

  // And out again: the view that was comes back.
  await b.eval(`(() => { const s = window.__zelda.state; s.mode = 'warp'; s.warp = { t: 0, to: 'overworld', entry: 'hut', swapped: false } })()`)
  await b.sleep(2500)
  await shot('14-back-outside')
  const after = await H.turnLabel()
  check((await H.st()).map === 'overworld' && after === before, `outside again with the view that was: "${after}"`)
  check(b.errors.filter(e => !/ERR_BLOCKED|Failed to load resource|net::/.test(e)).length === 0, `no script errors with keys (${b.errors.filter(e => !/ERR_BLOCKED|Failed to load resource|net::/.test(e)).slice(0, 3).join(' | ')})`)
  await b.close()
}

// ---------------------------------------------------------------------------
// 390 × 844, the touch deck
// ---------------------------------------------------------------------------
{
  const b = await open({ width: 390, height: 844, dpr: 3, mobile: true })
  const H = handle(b)
  const shot = name => b.shot(`${out}/phone-${name}.png`)
  /** The fingers that are down, by id; every change is sent as Chrome wants it. */
  const down = new Map()
  const pts = () => [...down].map(([id, p]) => ({ id, ...p }))
  const send = (type, touchPoints) => b.send('Input.dispatchTouchEvent', { type, touchPoints })
  const press = async (id, p) => { down.set(id, p); await send('touchStart', pts()) }
  const move = async (id, p) => { down.set(id, p); await send('touchMove', pts()) }
  const lift = async (id) => { if (!down.has(id)) return; const p = down.get(id); down.delete(id); await send('touchEnd', down.size ? [{ id, ...p }] : []) }
  const STICK = { x: 90, y: 700 }
  const stick = async (dx, dy) => {
    if (!dx && !dy) return lift(1)
    if (!down.has(1)) await press(1, STICK)
    await move(1, { x: STICK.x + dx * 38, y: STICK.y + dy * 38 })
  }
  const pad = sel => b.eval(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, label: e.getAttribute('aria-label') } })()`)

  const before = await H.turnLabel()
  await H.enter()
  await b.sleep(1300)
  let s = await until(b, H, s => s.map === 'sidetrial' && s.mode === 'play' && s.ground, 8000)
  check(s.map === 'sidetrial' && s.ground, 'phone: in the trial room, standing')
  check(/only here/i.test((await H.turnLabel()) ?? ''), `phone: the view is pinned (outside: "${before}")`)
  const A = await pad('.zelda-pad-a')
  const B = await pad('.zelda-pad-b')
  const ROLLPAD = await pad('.zelda-pad-roll')
  check(!!B && B.label === 'Jump', `phone: the B pad is JUMP with nothing owned (${B?.label})`)
  check(!(await pad('.zelda-pad-swap')), 'phone: no swap pad')
  const room = await b.eval(`(() => { const cv = document.querySelector('.zelda-canvas'), W = cv.width, H = cv.height, r = devicePixelRatio; const scale = Math.max(1, Math.min(Math.floor(W / 256), Math.floor(H / 192))); const w = 256 * scale / r, h = z => z * 16 * scale / r; return { dpr: r, scale, css: { left: (W / r - w) / 2, w, pit: { top: (H / r - h(12)) / 2, h: h(12) }, loft: { top: (H / r - h(24)) / 2, h: h(24) } }, screen: { w: W / r, h: H / r } } })()`)
  results.phone = { room, A, B, roll: ROLLPAD }
  await shot('01-standing')

  const walk = async (x) => {
    const s0 = await H.st()
    const way = x > s0.x ? 1 : -1
    await stick(way, 0)
    await until(b, H, s => s.mode !== 'play' || way * (s.x - x) >= -0.08)
    await stick(0, 0)
  }
  const jump = async (x, filmed) => {
    const s0 = await H.st()
    const way = x > s0.x ? 1 : -1
    if (filmed) await filmStart(b, 30, filmed)
    await stick(way, 0)
    await press(2, B)
    await until(b, H, s => !s.ground, 500)
    await until(b, H, s => s.ground || way * (x - s.x - (s.vx * Math.abs(s.vx)) / 80) <= 0.05)
    await stick(0, 0)
    const s = await until(b, H, s => s.ground || s.act === 'fall')
    await lift(2)
    return s
  }

  // Mid-jump, B held.
  await still(b, `${out}/phone-02-mid-jump.png`, 'h.side && !h.side.ground && h.side.vy > -3', () => press(2, B))
  s = await H.st()
  check(!s.ground && s.feet < 31, `phone: held B is in the air (feet ${s.feet.toFixed(2)})`)
  await lift(2)
  await until(b, H, s => s.ground)
  // How high: a tap against a hold, by the pad.
  const rise = async (ms) => { const y0 = (await H.st()).feet; await b.eval(`window.__min = 99; (function f() { const h = window.__zelda.state.hero; window.__min = Math.min(window.__min, h.y + ${R}); if (window.__min < 99 && !window.__stop) window.__raf(f) })()`); await press(2, B); await b.sleep(ms); await lift(2); await b.sleep(900); const top = await b.eval('window.__min'); await b.eval('window.__stop = true'); await b.sleep(50); await b.eval('window.__stop = false'); return +(y0 - top).toFixed(2) }
  results.phone.rise = { tap40: await rise(40), tap90: await rise(90), hold400: await rise(400) }
  check(results.phone.rise.tap40 < 2.2 && results.phone.rise.hold400 > 3, `phone: tap ${results.phone.rise.tap40} (40 ms), ${results.phone.rise.tap90} (90 ms), held ${results.phone.rise.hold400} tiles`)

  await walk(4.75)
  await H.rest()
  s = await jump(8.1, { x0: 2.5, x1: 11, y0: 27.5, y1: 35 })
  results.phoneFilm = await filmSave(b, `${out}/phone-03-held-jump-30fps.png`, 6)
  check(s.ground && s.x > 7.6 && Math.abs(s.feet - 33) < 0.02, `phone: over the 3 tile gap by the stick and the pad (${s.x.toFixed(2)}, ${s.feet.toFixed(2)})`)

  // A fight, the thumb at rest: A turns to the foe by itself.
  let pictured = false
  for (let i = 0; i < 60; i++) {
    s = await H.st()
    const e = s.foes.find(f => f.kind === 'blob')
    if (e.dead) break
    // (Knocked back into the gap and put back at the entry: over it again.)
    if (s.x < 7.6) { await stick(0, 0); await b.sleep(900); await H.put(9, 33); await b.sleep(300); continue }
    const dx = e.x - s.x
    if (Math.abs(dx) < 1.4) {
      if (!pictured) pictured = await still(b, `${out}/phone-04-fight.png`, FIGHTING, () => press(3, A), 600)
      else { await press(3, A); await b.sleep(60) }
      await lift(3); await b.sleep(120)
    } else { await stick(Math.sign(dx), 0); await b.sleep(60); await stick(0, 0); await b.sleep(40) }
  }
  s = await H.st()
  check(s.foes.find(f => f.kind === 'blob').dead, `phone: the blob falls to the A pad (turned to it left or right) (${JSON.stringify(s.foes.find(f => f.kind === 'blob'))}, hero ${s.x.toFixed(2)},${s.feet.toFixed(2)}, ${s.mode})`)

  // Jump, then cut, with one thumb: B held a while, then A.
  results.phone.thumb = []
  for (const [hold, gap] of [[60, 40], [120, 60], [200, 80], [200, 140]]) {
    await H.put(10.4, 33)
    await b.sleep(900)
    await press(2, B); await b.sleep(hold); await lift(2); await b.sleep(gap)
    let r
    if (hold === 200 && gap === 80) {
      await b.eval('window.__seen = null')
      await still(b, `${out}/phone-05-jump-then-cut.png`, `h.swing && h.swing.t > 0.08 && (window.__seen = { air: !h.side.ground, y: h.y })`, () => press(3, A), 800)
      const seen = await b.eval('window.__seen')
      r = { hold, gap, airborne: !!seen?.air, swing: !!seen, height: seen ? +(33 - seen.y - R).toFixed(2) : 0 }
    } else {
      await press(3, A); await b.sleep(30)
      s = await H.st()
      r = { hold, gap, airborne: !s.ground, swing: !!s.swing, height: +(33 - s.feet).toFixed(2) }
    }
    results.phone.thumb.push(r)
    await lift(3)
    await b.sleep(900)
  }
  check(results.phone.thumb.every(r => r.airborne && r.swing), `phone: jump then cut ${JSON.stringify(results.phone.thumb)}`)

  // The ledge by thumb.
  await H.put(10.3, 33)
  await b.sleep(900)
  s = await jump(12)
  check(Math.abs(s.feet - 30) < 0.02, `phone: up the 3 tile ledge (${s.x.toFixed(2)}, ${s.feet.toFixed(2)})`)
  await shot('06-ledge-sentry')
  // The ladder: the stick up beside it takes it, and does not jump.
  await H.put(13.5, 30)
  await b.sleep(300)
  await still(b, `${out}/phone-07-ladder.png`, 'h.side?.ladder && h.y < 27', () => stick(0, -1))
  s = await H.st()
  check(s.ladder, 'phone: the stick up takes the ladder')
  s = await until(b, H, s => s.zone === 0 && s.ground && !s.ladder, 6000)
  await stick(0, 0)
  check(s.zone === 0 && Math.abs(s.feet - 20) < 0.02, `phone: up into the loft (feet ${s.feet.toFixed(2)})`)
  await b.sleep(900)
  await shot('08-upper-room')
  await walk(11.5); await walk(10.4)
  s = await jump(7.9)
  check(Math.abs(s.feet - 17) < 0.02, `phone: onto the first platform (feet ${s.feet.toFixed(2)})`)
  await walk(6.4)
  s = await jump(4.2)
  check(Math.abs(s.feet - 14) < 0.02, `phone: onto the second platform (feet ${s.feet.toFixed(2)})`)
  // Down through it with the stick, and a fall.
  await walk(3)
  const hp = (await H.st()).hp
  const fell = await still(b, `${out}/phone-09-fall.png`, "h.act === 'fall' && h.actT > 0.2", () => stick(0, 1))
  await stick(0, 0)
  check(fell, 'phone: the stick down drops through the platform, and off the bottom is a fall')
  await b.sleep(900)
  s = await H.st()
  check(s.ground && Math.abs(s.x - 11.5) < 0.1 && s.hp === hp - 1, `phone: back on the safe ledge (${s.x.toFixed(2)}, ${s.hp}/${hp})`)
  await shot('10-put-back')

  // Ten seconds of play in the pit, foes alive: walking, jumping, cutting, rolling.
  await b.eval(`(() => { const s = window.__zelda.state; s.mode = 'warp'; s.warp = { t: 0, to: 'sidetrial', entry: 'start', swapped: false } })()`)
  await b.sleep(1500)
  const play = (x0, row) => async (ms) => {
    await H.put(x0, row)
    const end = Date.now() + ms
    for (let i = 0; Date.now() < end; i++) {
      await stick(i % 2 ? -1 : 1, 0); await b.sleep(180)
      await press(2, B); await b.sleep(160); await press(3, A); await b.sleep(60); await lift(3); await lift(2); await b.sleep(200)
      await stick(0, 0); await press(3, A); await b.sleep(50); await lift(3); await b.sleep(150)
      await b.eval('(() => { const h = window.__zelda.state.hero; h.hp = h.maxHp })()')
    }
    await stick(0, 0)
  }
  results.frames = { pit: await frameTime(b, play(11.8, 30)) }
  await shot('11-after-play')
  // For the scale of it: the same ten seconds in a top-down room of the Shrine, in the classic view.
  await b.eval(`(() => { const s = window.__zelda.state; s.mode = 'warp'; s.warp = { t: 0, to: 'overworld', entry: 'hut', swapped: false } })()`)
  await b.sleep(2500)
  const back = await H.turnLabel()
  check(back === before, `phone: outside again with the view that was: "${back}"`)
  await shot('12-back-outside')
  const idle = async (ms) => { const end = Date.now() + ms; for (let i = 0; Date.now() < end; i++) { await stick(i % 2 ? -1 : 1, 0); await b.sleep(250); await press(3, A); await b.sleep(50); await lift(3); await stick(0, 0); await b.sleep(150) } }
  results.frames.townIso = await frameTime(b, idle)
  await b.goto(`${base}/?view=classic`)
  for (let i = 0; i < 120 && !(await b.eval('!!window.__zelda?.state')); i++) await b.sleep(500)
  await b.sleep(3500)
  results.frames.townClassic = await frameTime(b, idle)
  results.phone.gpu = await b.eval(`(() => { const g = document.createElement('canvas').getContext('webgl'); const x = g?.getExtension('WEBGL_debug_renderer_info'); return x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : null })()`)
  const errs = b.errors.filter(e => !/ERR_BLOCKED|Failed to load resource|net::/.test(e))
  check(errs.length === 0, `phone: no script errors (${errs.slice(0, 3).join(' | ')})`)
  await b.close()
}

writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1))
console.log(JSON.stringify({ ...results, deskFilm: undefined, phoneFilm: undefined }))
process.exit(failed ? 1 : 0)
