#!/usr/bin/env node
// ACT THREE in the running shell (a local dev server only), in headless Chrome, driven by real key and pointer events:
// from the stair under Fogstage's stage through the Underside, the lens, the Three Doors, the Boards, the Flats and
// the Wings into the Fly Loft, with keys at 1280 × 800 and on the touch deck at 390 × 844; the cards; the ring at
// three moments; the glass up and down; the painted step, chests and door; the hidden ledges; what a resting thumb
// does to the glass; and the frame time over ten seconds. The visit is given the blade and many hearts, the foes of a
// room may be put away, and a move that misses sets the hero on its landing (each of these is printed); every move
// that is pictured is an input. The page's frames are stepped by the script (a 60th of a second each), so that a busy
// machine cannot move the hero past a mark; only the frame time is taken in real time. Every request that leaves this
// machine is blocked.
//   CHROME_BIN=… node scripts/zelda-lab/actthree-shot.mjs http://localhost:3219 <outDir> [desk|phone]
import { mkdirSync, writeFileSync } from 'node:fs'
import { launch } from './cdp.mjs'
import { cachedBytes, readPins } from './lib/artcache.mjs'

const PINNED = new Map(Object.values(readPins().PACKS).flatMap(p => ['albedo', 'normal', 'index'].filter(k => p[k]).map(k => [p[k].url, p[k]])))
const [base, out, only] = process.argv.slice(2)
if (!base || !out || !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)) { console.error('usage: actthree-shot.mjs <local base url> <outDir> [desk|phone]'); process.exit(2) }
mkdirSync(out, { recursive: true })

const R = 0.34
let failed = false
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) failed = true }
const results = {}
const FLAGS = ['--use-angle=metal', '--enable-gpu', '--disable-frame-rate-limit', '--disable-gpu-vsync']

async function open(opts) {
  const b = await launch({ ...opts, args: FLAGS })
  await b.send('Network.enable')
  await b.send('Network.setBlockedURLs', { urls: ['wss://*'] })
  // Nothing leaves the machine: the pinned art packs come from the cache `npm run art:pull` filled; other https fails.
  await b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://*' }] })
  b.on('Fetch.requestPaused', ({ requestId, request }) => {
    const f = PINNED.get(request.url)
    const bytes = f && cachedBytes(f)
    const answer = bytes
      ? b.send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'content-type', value: request.url.endsWith('.json') ? 'application/json' : 'image/png' }, { name: 'access-control-allow-origin', value: '*' }], body: Buffer.from(bytes).toString('base64') })
      : b.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' })
    answer.catch(() => {})
  })
  // The frames are the script's to step once it says so (`__tick`); until then, and for the frame time, the screen's.
  await b.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__ft = null;
    window.__manual = false;
    window.__queue = [];
    const raf = window.requestAnimationFrame.bind(window);
    let vt = 0;
    const timed = (cb, t) => { const a = performance.now(); cb(t); window.__ft?.push([t, performance.now() - a]) };
    window.requestAnimationFrame = cb => {
      if (window.__manual) { window.__queue.push(cb); return 0 }
      return raf(t => { if (window.__manual) { window.__queue.push(cb); return } vt = t; timed(cb, t) });
    };
    window.__tick = n => { for (let i = 0; i < n; i++) { vt += 1000 / 60; for (const cb of window.__queue.splice(0)) cb(vt) } };
    window.__free = () => { window.__manual = false; for (const cb of window.__queue.splice(0)) window.requestAnimationFrame(cb) };
  ` })
  await b.goto(`${base}/`)
  for (let i = 0; i < 240 && !(await b.eval('!!window.__zelda?.state')); i++) await b.sleep(500)
  await b.sleep(3000)
  await b.eval(`(() => { const e = document.createElement('style'); e.textContent = '#nuxt-devtools-container, nuxt-devtools-frame { display: none !important }'; document.head.appendChild(e) })()`)
  return b
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

/** The hands: keys, or the touch deck. */
function keys(b, tick) {
  const held = new Set()
  const set = async (name, on) => { if (on && !held.has(name)) { held.add(name); await b.keyDown(name) } else if (!on && held.delete(name)) await b.keyUp(name) }
  return {
    async dir(x, y = 0) { await set('ArrowLeft', x < 0); await set('ArrowRight', x > 0); await set('ArrowUp', y < 0); await set('ArrowDown', y > 0) },
    bDown: () => set('KeyK', true),
    bUp: () => set('KeyK', false),
    async a(n = 3) { await set('Space', true); await tick(n); await set('Space', false) },
  }
}
function touch(b, tick) {
  const down = new Map()
  const pts = () => [...down].map(([id, p]) => ({ id, ...p }))
  const send = (type, touchPoints) => b.send('Input.dispatchTouchEvent', { type, touchPoints })
  const press = async (id, p) => { down.set(id, p); await send('touchStart', pts()) }
  const move = async (id, p) => { down.set(id, p); await send('touchMove', pts()) }
  const lift = async (id) => { if (!down.has(id)) return; const p = down.get(id); down.delete(id); await send('touchEnd', down.size ? [{ id, ...p }] : []) }
  const STICK = { x: 80, y: 740 }
  const pad = sel => b.eval(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, top: r.y, left: r.x } })()`)
  return {
    pad, press, move, lift, STICK,
    async dir(x, y = 0) {
      if (!x && !y) return lift(1)
      if (!down.has(1)) await press(1, STICK)
      await move(1, { x: STICK.x + x * 38, y: STICK.y + y * 38 })
    },
    async bDown() { const p = await pad('.zelda-pad-b'); if (p) await press(2, { x: p.x, y: p.y }) },
    bUp: () => lift(2),
    // (While lines are up the deck steps aside, and a tap on the world moves them on.)
    async a(n = 3) { const p = await pad('.zelda-pad-a'); await press(3, p ? { x: p.x, y: p.y } : { x: 300, y: 420 }); await tick(n); await lift(3) },
  }
}

async function run(size, opts) {
  const b = await open(opts)
  const phone = !!opts.mobile
  const tick = (n = 1) => b.eval(`window.__tick(${Math.max(1, Math.round(n))})`)
  const I = phone ? touch(b, tick) : keys(b, tick)
  const shot = async name => { await b.sleep(150); await b.shot(`${out}/${size}-${name}.png`) }
  const read = () => b.eval(`(() => { const s = window.__zelda.state, h = s.hero, d = h.side; return { map: s.map.id, entry: s.entry.entry, mode: s.mode, card: s.card ? { title: s.card.title, t: s.card.t } : null, x: h.x, y: h.y, feet: h.y + ${R}, vx: h.vx, ground: !!d?.ground, ladder: !!d?.ladder, act: h.act, hp: h.hp, keys: s.inv.keyrings.actthree ?? 0, lens: s.lens ? { still: s.lens.still, up: s.lens.up, k: s.lens.k, here: s.lens.here } : null, gone: (s.map.lensGone ?? []).map(g => g.t), seen: s.map.lensSeen?.length ?? 0, flags: Object.keys(s.flags).filter(f => /act|door:/.test(f)) } })()`)
  const st = async () => (await read()) ?? (await b.sleep(200), await read()) ?? Promise.reject(new Error(`the page lost its game: ${b.errors.slice(-3).join(' | ')}`))
  /** Frames until `pred`, `max` at the most. */
  const until = async (pred, max = 240, step = 1) => { let s = await st(); for (let i = 0; i < max && !pred(s); i += step) { await tick(step); s = await st() } return s }
  const note = what => console.log('set ', `${size}: ${what}`)
  const put = async (x, row, why) => { note(`the hero set at ${x}, feet ${row} (${why})`); await b.eval(`(() => { const s = window.__zelda.state, h = s.hero; h.x = ${x}; h.y = ${row} - ${R}; h.knock = null; h.invuln = 0; h.swing = null; h.charge = -1; h.act = 'idle'; delete h.side })()`); await tick(20) }
  const heal = () => b.eval('(() => { const h = window.__zelda.state.hero; h.maxHp = h.hp = 20 })()')
  const calm = async () => { note('this room\'s foes put away'); await b.eval(`(() => { for (const e of window.__zelda.state.map.enemies) { e.dead = true; e.deathT = 1 } })()`); await heal(); await tick(10) }
  const words = async () => { for (let i = 0; i < 40; i++) { const s = await st(); if (s.mode === 'play') return; if (s.mode === 'dialog' || s.mode === 'get') await I.a(); await tick(14) } }
  /** Frames until `pred`, and the picture of that frame. */
  const still = async (name, pred, max = 300) => { const s = await until(pred, max); if (pred(s)) await shot(name); else console.log('note never reached for', name); return s }
  /** Along the ground to x. */
  const walk = async (x) => {
    for (let i = 0; i < 600; i++) {
      const s = await st()
      if (s.mode !== 'play') break
      if (Math.abs(x - s.x) < 0.12 && s.ground) break
      await I.dir(Math.abs(x - s.x) < 0.12 ? 0 : Math.sign(x - s.x))
      // (Long stretches in a few frames at a time; the last of it frame by frame.)
      await tick(Math.abs(x - s.x) > 1.5 ? 6 : 1)
    }
    await I.dir(0)
    await tick(8)
  }
  /** B held to the landing, steered to come down at x; a miss is set on its landing. */
  const jump = async (x, row, from) => {
    await until(s => s.ground)
    const toward = s => { const d = x - (s.x + (s.vx * Math.abs(s.vx)) / 80); return Math.abs(d) < 0.12 ? 0 : Math.sign(d) }
    let s = await st()
    await I.dir(toward(s))
    await I.bDown()
    await tick(2)
    for (let i = 0; i < 90; i++) {
      s = await st()
      if (s.ground && i > 3) break
      await I.dir(toward(s))
      await tick(2)
    }
    await I.dir(0)
    await I.bUp()
    await tick(12)
    s = await st()
    const ok = Math.abs(s.feet - row) < 0.05 && Math.abs(s.x - x) < 0.9
    if (!ok && s.mode === 'play') { console.log('miss', `${size}: toward ${x} on ${row} from ${from ?? '?'} came down ${s.x.toFixed(2)}, ${s.feet.toFixed(2)}`); await put(x, row, 'a missed jump') }
    return ok
  }
  const climb = async (way, row) => { await I.dir(0, way); const s = await until(s => (s.ground && !s.ladder && Math.abs(s.feet - row) < 0.05) || s.mode === 'warp', 400, 3); await I.dir(0, 0); await tick(10); return s }
  const through = async (x, y, map) => { await I.dir(x, y); await until(s => s.mode === 'warp' || s.map === map, 300, 2); await I.dir(0, 0); await until(s => s.map === map && (s.mode === 'play' || !!s.card), 120, 2); await tick(6); check((await st()).map === map, `through the stair into ${map}`) }
  /** Face `way` and press A (a chest). */
  const use = async (way) => { await I.dir((phone ? 0.5 : 1) * way); await tick(2); await I.dir(0); await tick(4); await I.a() }
  const opened = async (id, x, row, way) => {
    for (let i = 0; i < 3; i++) {
      await use(way); await tick(54)
      if ((await st()).flags.includes(`chest:${id}`)) return
      await put(x, row, `beside ${id}`)
    }
    check(false, `${id} opens`)
  }
  /** A nudge of the stick: the glass's clock starts again. */
  const nudge = async (way = 1) => { await I.dir((phone ? 0.5 : 1) * way); await tick(1); await I.dir(0); await tick(1) }
  /** The stick to and fro until the paint has come all the way back. */
  const fidget = async () => {
    for (let i = 0; i < 40; i++) { const s = await st(); if (!s.lens || s.lens.k === 0) return; await I.dir((phone ? 0.5 : 1) * (i % 2 ? -1 : 1)); await tick(8) }
    await I.dir(0)
  }
  /** The glass: with a name, pictured down, the ring three times, and up. */
  const look = async (name) => {
    await fidget(); await I.dir(0)
    await nudge()
    if (name) {
      await nudge(-1)
      await still(`${name}-glass-down`, s => s.lens && s.lens.still > 0.05 && s.lens.k === 0)
      await still(`${name}-ring-1`, s => s.lens && s.lens.still >= 0.3)
      await still(`${name}-ring-2`, s => s.lens && s.lens.still >= 0.47)
      await still(`${name}-ring-3`, s => s.lens && s.lens.still >= 0.65)
      await still(`${name}-glass-up`, s => s.lens && s.lens.k === 1)
    }
    const s = await until(s => s.lens?.up && s.lens.k === 1, 150, 2)
    check(!!s.lens?.up, `the glass rises on a still hero (${s.map})`)
  }

  // -- under the stage ---------------------------------------------------------
  await b.eval(`(() => { const s = window.__zelda.state; s.inv.sword = true; s.flags['item:sword'] = true; s.hero.maxHp = s.hero.hp = 20; s.dialog = null; s.hero.auto = null; s.mode = 'warp'; s.warp = { t: 0, to: 'understage', entry: 'door', swapped: false } })()`)
  note('the blade and 20 half hearts given; into the cellar under the stage')
  if (phone) await b.tap(80, 600)
  await b.sleep(3500)
  await b.eval('window.__manual = true')
  await b.sleep(600)
  await tick(60); await words()
  await shot('01-understage')
  await put(8.5, 2.9, 'on the free tile below the new stair')
  // (The cellar may be shown isometric: the stick turns with the picture.)
  const iso = await b.eval(`window.__zelda.state.view === 'iso'`)
  await I.dir(iso ? 1 : 0, -1); await until(s => !!s.card, 240, 2); await I.dir(0, 0)
  await still('02-card-scene-one', s => s.card && s.card.t > 0.9)
  let s = await st()
  check(s.map === 'actunder', `the stair behind the paint (${s.map})`)
  if (s.map !== 'actunder') throw new Error('the run cannot go on')
  await I.a(); await tick(50)
  check(!(await st()).card, 'A passes the card')
  await heal()
  await shot('03-underside')
  await calm()
  // The side picture is pinned in the climb, and the visit's own view comes back down the stair.
  const view = () => b.eval(`window.__zelda.state.view`)
  check(await view() === 'flat', 'the climb is shown from the side')
  await through(-1, 0, 'understage')
  await tick(40)
  s = await st()
  check(s.entry === 'upstairs' && await view() === (iso ? 'iso' : 'flat'), `back down by the same stair, the view as it was (${s.entry}, ${await view()})`)
  await shot('03b-back-in-the-cellar')
  await through(iso ? 1 : 0, -1, 'actunder')
  check(!(await st()).card, 'the card does not play again')
  await calm()

  // -- the Underside -------------------------------------------------------------
  await walk(3.9); await jump(5.9, 21, 'the floor')
  await walk(7.4); await walk(8.5); await climb(-1, 18)
  await walk(8.4); await jump(5.9, 16, 'the ladder platform')
  await walk(4.5); await opened('actunder.bits', 4.5, 16, -1); await words()
  await walk(6.4); await jump(8.9, 14, 'the second platform')
  await walk(11.5); await climb(-1, 11)
  await walk(10); await jump(8, 10, 'the prop floor')
  await walk(7.5); await jump(5, 8, 'the crate')
  await walk(5.4); await jump(7.8, 6, 'the first shelf')
  await walk(9.4); await use(1); await tick(30)
  await shot('04-the-lens-held')
  await tick(110)
  await shot('05-the-lens-words')
  await words()
  s = await st()
  check(s.flags.includes('chest:actthree.lens'), 'THE LENS got')
  await walk(7.5); await jump(5.2, 4, 'the second shelf')
  await walk(5.4); await jump(7.9, 2, 'the third shelf')
  await tick(20)
  await shot('06-prop-room')
  await walk(12.2)
  await through(1, 0, 'actdoors')

  // -- the Three Doors -----------------------------------------------------------
  await calm()
  await walk(4.2); await jump(6.6, 10, 'the floor, over the sign')
  await walk(9.4); await opened('actthree.key1', 9.4, 10, 1); await words()
  await walk(8.5); await jump(8.4, 8, 'the floor')
  await walk(8.5)
  check((await st()).map === 'actdoors', 'a painted door does nothing')
  await look('07-doors')
  // Where the glass stands after a hop to the real door's pad, taken as soon as it has looked.
  await walk(9.4); await look()
  await I.dir(1); await I.bDown()
  await still('08-doors-in-the-hop', s => s.x > 10.8, 60)
  for (let i = 0; i < 60; i++) { s = await st(); if (s.ground && i > 8) break; await I.dir(s.x + (s.vx * Math.abs(s.vx)) / 80 < 12.3 ? 1 : 0); await tick(2) }
  await I.dir(0); await I.bUp(); await tick(2)
  s = await st()
  check(s.ground && Math.abs(s.feet - 8) < 0.05, `one hop to the real door's pad (${s.x.toFixed(2)}, ${s.feet.toFixed(2)}, outlines at ${s.lens?.k.toFixed(2)})`)
  results[`${size} outlines on landing`] = s.lens?.k
  await shot('09-doors-on-the-real-pad')
  if (Math.abs(s.feet - 8) > 0.05) await put(12.3, 8, 'a missed jump')
  await I.dir(1); await until(s => !!s.card, 240, 2); await I.dir(0)
  await still('10-card-scene-two', s => s.card && s.card.t > 0.9)
  await I.a(); await tick(50)

  // -- the Boards ----------------------------------------------------------------
  await shot('11-boards')
  await walk(8.4); await walk(9.5); await climb(-1, 10)
  await walk(13.4)
  await shot('12-boards-ledge')
  await walk(14.5)
  await through(0, -1, 'actflats')

  // -- the Flats -----------------------------------------------------------------
  await calm()
  await shot('13-flats')
  await look('14-flats')
  await walk(3.2); await jump(4.9, 10, 'the floor, at the painted step')
  s = await st()
  check(Math.abs(s.feet - 10) < 0.05, `the painted step is air: down on the floor (${s.feet.toFixed(2)})`)
  await shot('15-flats-through-the-painted-step')
  await walk(6.3); await jump(7.9, 8, 'the floor')
  await jump(7.6, 6, 'the real step')
  await walk(7.5)
  await shot('16-flats-three-chests')
  await use(-1)
  await still('17-flats-painted-chest-puff', s => s.gone[0] > 0.1, 30)
  await tick(30)
  check((await st()).gone.length === 1, 'a painted chest puffs and is gone')
  await shot('18-flats-after-the-puff')
  await walk(4.5); await opened('actthree.key2', 4.5, 6, -1); await words()
  await jump(4.5, 4, 'the chest tier')
  // The painted door at the east end: a bump.
  await walk(12); await I.dir(1); await tick(50); await I.dir(0); await tick(12)
  s = await st()
  check(s.map === 'actflats' && s.x < 14.7 && s.x > 14.4, `the painted door is a bump (${s.x.toFixed(2)})`)
  await shot('19-flats-at-the-painted-door')
  await look('20-flats-doors')
  await walk(2.2)
  await through(-1, 0, 'actwings')

  // -- the Wings -----------------------------------------------------------------
  await calm()
  await shot('21-wings')
  await walk(7)
  await look('22-wings')
  // Moved, and the picture all the way back: what was shown stays faint.
  await fidget(); await I.dir(0); await nudge(-1)
  s = await st()
  check(s.lens.k === 0 && s.seen >= 5, `the paint is back and the hidden things stay shown (${s.seen} tiles)`)
  await shot('23-wings-remembered')
  if (phone) {
    // A thumb resting on B: it jumps once, then lies there.
    await walk(10)
    await I.bDown(); await tick(8)
    await until(s => s.ground, 120)
    let n = 0
    for (; n < 150 && !(s = await st()).lens?.up; n++) await tick(1)
    results.restingThumbOnB = { up: !!s.lens?.up, secondsAfterLanding: +(n / 60).toFixed(2) }
    check(!!s.lens?.up, `a thumb resting on B counts as still (up ${(n / 60).toFixed(2)} s after landing)`)
    await still('24-wings-thumb-on-b', s => s.lens && s.lens.k === 1)
    await I.bUp(); await tick(2)
    check(!(await st()).lens?.up, 'letting B go drops the glass')
    await fidget(); await I.dir(0)
    // A finger on the stick's side that stays inside the dead zone, then one that creeps past it.
    await I.press(1, I.STICK); await tick(2); await I.move(1, { x: I.STICK.x + 5, y: I.STICK.y - 3 })
    s = await until(s => !!s.lens?.up, 150)
    results.restingFingerOnStick = !!s.lens?.up
    check(!!s.lens?.up, 'a finger inside the stick\'s dead zone counts as still')
    await still('25-wings-finger-on-the-stick', s => s.lens && s.lens.k === 1)
    await I.move(1, { x: I.STICK.x + 6, y: I.STICK.y - 4 }); await tick(4)
    results.fingerJitter = !!(await st()).lens?.up
    await I.move(1, { x: I.STICK.x + 11, y: I.STICK.y }); await tick(4)
    check(!(await st()).lens?.up, 'past the dead zone (11 px) the glass drops')
    await I.lift(1); await tick(10)
    const A = await I.pad('.zelda-pad-a'), B = await I.pad('.zelda-pad-b'), ROLL = await I.pad('.zelda-pad-roll')
    const room = await b.eval(`(() => { const cv = document.querySelector('.zelda-canvas'), W = cv.width, H = cv.height, r = devicePixelRatio, z = window.__zelda.state.zone; const scale = Math.max(1, Math.min(Math.floor(W / 256), Math.floor(H / (z.h * 16)))); const t = 16 * scale / r, top = (H - z.h * 16 * scale) / 2 / r; return { scale, tile: t, top, bottom: top + z.h * t } })()`)
    results.phone = { room, A, B, ROLL, stick: I.STICK }
  }
  await walk(5.4); await jump(5.1, 8, 'the floor, onto a hidden ledge')
  await shot('26-wings-on-a-hidden-ledge')
  await walk(4.6); await jump(2.4, 6, 'the first hidden ledge')
  await walk(2.6); await jump(4.7, 4, 'the second hidden ledge')
  await walk(5.5)
  await look('27-wings-top')
  await opened('actthree.heart', 5.5, 4, 1)
  await shot('28-wings-heart')
  await words()
  await walk(3.5); await until(s => s.ground && Math.abs(s.feet - 10) < 0.05, 4000)
  if (Math.abs((await st()).feet - 10) > 0.05) await put(7, 10, 'not down off the ledges')
  // Ten seconds in the Wings in real time: a hop, then stillness until the glass is up, over and over.
  await walk(7)
  await b.eval('window.__free()')
  results[`${size} frame time`] = await frameTime(b, async (ms) => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      await b.sleep(1300)
      await I.bDown(); await b.sleep(250); await I.bUp(); await b.sleep(500)
    }
  })
  await b.eval('window.__manual = true')
  await b.sleep(600)
  await heal()
  await walk(10.8)
  await shot('29-door-a')
  await I.dir(1); s = await until(s => s.flags.some(f => f.startsWith('door:actwings')), 240); await I.dir(0)
  check(s.keys === 1, `door A opens to a key (${s.keys} left)`)
  await tick(18)
  await shot('30-door-a-open')
  await through(1, 0, 'actloft')
  await heal(); await tick(30)
  await shot('31-fly-loft')
  await walk(11); await I.dir(1); s = await until(s => s.flags.some(f => f.startsWith('door:actloft')), 240); await I.dir(0)
  check(s.keys === 0, `door B opens to the other key (${s.keys} left)`)
  await tick(24)
  await shot('32-fly-loft-door-b')
  // A reload in the climb comes back at its last stair.
  await b.eval('window.__free()')
  await b.sleep(2500)
  await b.goto(`${base}/`)
  for (let i = 0; i < 240 && !(await b.eval('!!window.__zelda?.state')); i++) await b.sleep(500)
  await b.sleep(3000)
  s = await st()
  check(s.map === 'actloft' && s.entry === 'rope', `a reload stays in the climb, at its stair (${s.map}:${s.entry})`)
  check(await view() === 'flat', 'a reload in the climb comes back in the side picture')
  await b.eval(`(() => { const s = window.__zelda.state; s.dialog = null; s.hero.auto = null; s.mode = 'warp'; s.warp = { t: 0, to: 'actunder', entry: 'foot', swapped: false } })()`)
  note('after the reload, set at the foot of the climb')
  await b.eval('window.__manual = true')
  await b.sleep(600)
  await tick(60)
  if ((await st()).card) { await I.a(); await tick(50) }
  await through(-1, 0, 'understage')
  await tick(60)
  check(await view() === (iso ? 'iso' : 'flat'), `and the view comes back on the way out (${await view()})`)
  results[`${size} errors`] = b.errors.slice(0, 5)
  await b.close()
}

try {
  if (only !== 'phone') await run('desk', { width: 1280, height: 800, dpr: 1 })
  if (only !== 'desk') await run('phone', { width: 390, height: 844, dpr: 3, mobile: true })
} catch (e) {
  console.error(e)
  failed = true
} finally {
  writeFileSync(`${out}/results${only ? `-${only}` : ''}.json`, JSON.stringify(results, null, 1))
  console.log(JSON.stringify(results, null, 1))
  process.exit(failed ? 1 : 0)
}
