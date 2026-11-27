#!/usr/bin/env node
// ACT THREE in the running shell (a local dev server only), in headless Chrome, driven by real key and pointer events:
// from the stair under Fogstage's stage to the Weight in the gondola and Vega, with keys at 1280 × 800 and on the touch deck at
// 390 × 844: the cards; the ring at three moments; the glass up and down; the painted step, chests and door; the hidden
// ledges; what a resting thumb does to the glass; BARD's three pieces (tell, blow and opening, glass down and up) and
// its fall; the fly loft's bags; the understudy and the great key; the great door; the cable, a painted clamp trusted
// and the fall; the Hallucinator (the shuffle, the claim, each wave, the bow, the rail, a pop, a hurt, the glass, the
// plate, the half), the Weight and the way out; and the frame time over ten seconds, in the Wings, on the boss's waves
// and under the bags. The visit is given the blade and many hearts and is healed as it goes (in the gondola the script
// reads which body is real, for its pictures), the foes of a room (not BARD, not the understudy) may be put
// away, BARD's piece is chosen for its pictures, and a move that misses sets the hero on its landing (each of these is
// printed); every move that is pictured is an input. The page's frames are stepped by the script (a 60th of a second
// each), so that a busy machine cannot move the hero past a mark; only the frame time is taken in real time. Every
// request that leaves this machine is blocked.
//   CHROME_BIN=… node scripts/zelda-lab/actthree-shot.mjs http://localhost:3219 <outDir> [desk|phone]
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'
import { cachedBytes, readPins } from './lib/artcache.mjs'

const PINNED = new Map(Object.values(readPins().PACKS).flatMap(p => ['albedo', 'normal', 'index'].filter(k => p[k]).map(k => [p[k].url, p[k]])))
const [base, out, only, from] = process.argv.slice(2)
/** `gondola`: the boss alone (the visit is put at its stair), for another go at its pictures. */
const bossOnly = from === 'gondola'
if (!base || !out || !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)) { console.error('usage: actthree-shot.mjs <local base url> <outDir> [desk|phone]'); process.exit(2) }
mkdirSync(out, { recursive: true })

const R = 0.34
// The engine's own clock for the sandbags, to wait them out as a player's eye does.
const esbuild = createRequire(import.meta.url)('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const built = esbuild.buildSync({
  stdin: { contents: `export * from './engine/index'; export * from './types'; export { WORLD } from './world/index'`, resolveDir: resolve(repo, 'themes/zelda'), loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const Z = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))
const BAGS = Z.bagsOf(Z.mapInfo(Z.WORLD, 'actloft'))
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
  await hideDevtools(b)
  return b
}
const hideDevtools = b => b.eval(`(() => { const e = document.createElement('style'); e.textContent = '#nuxt-devtools-container, nuxt-devtools-frame { display: none !important }'; document.head.appendChild(e) })()`)
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
  const read = () => b.eval(`(() => { const s = window.__zelda.state, h = s.hero, d = h.side; return { map: s.map.id, entry: s.entry.entry, mode: s.mode, card: s.card ? { title: s.card.title, t: s.card.t } : null, x: h.x, y: h.y, feet: h.y + ${R}, vx: h.vx, ground: !!d?.ground, ladder: !!d?.ladder, act: h.act, hp: h.hp, keys: s.inv.keyrings.actthree ?? 0, lens: s.lens ? { still: s.lens.still, up: s.lens.up, k: s.lens.k, here: s.lens.here } : null, gone: (s.map.lensGone ?? []).map(g => g.t), seen: s.map.lensSeen?.length ?? 0, big: !!s.flags['bigkey:actthree'], bagT: s.map.bagT ?? 0, foe: (() => { const e = s.map.enemies.find(e => e.kind === 'bard' || e.tough); return e ? { x: e.x, y: e.y, r: e.r, hp: e.hp, dead: e.dead, mode: e.ai.mode, t: e.ai.t, piece: e.ai.piece, way: e.ai.way, tx: e.ai.tx, c: [e.ai.c0, e.ai.c1, e.ai.c2], took: e.ai.took ?? 0, vx: e.ai.vx ?? 0 } : null })(), flags: Object.keys(s.flags).filter(f => /act|door:/.test(f)) } })()`)
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
  /** From the stair under the stage to the gondola's door. */
  const climbUp = async () => {
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
  // BARD's line comes after the card.
  await until(s => s.mode === 'dialog', 60); await tick(80)
  await shot('11-boards-bards-line')
  await words(); await tick(6)
  await shot('12-boards')
  check((await st()).foe?.mode === 'hide', 'BARD starts hidden')
  /** Frames until BARD is in `mode` and `more` holds; with `moving`, the stick is nudged so that the glass stays down. */
  const bardIn = async (mode, more = () => true, moving = false, max = 700) => {
    let s = await st()
    for (let i = 0; i < max && !(s.foe && s.foe.mode === mode && more(s)); i += 2) {
      if (moving && s.ground && i % 24 === 0) await nudge(i % 48 ? -1 : 1)
      await tick(2); s = await st()
    }
    check(s.foe?.mode === mode, `BARD reaches ${mode}`)
    return s
  }
  const force = async (piece) => { await b.eval(`(() => { const e = window.__zelda.state.map.enemies.find(e => e.kind === 'bard'); e.hp = 10; e.ai.mode = 'hide'; e.ai.t = 2.4; e.ai.piece = '${piece}'; e.x = e.y = -30 })()`); note(`BARD put back behind the set as the ${piece}, hit points full`) }
  let n = 13
  for (const [piece, spot] of [['door', 6], ['chest', 6.5], ['rope', 6]]) {
    for (const glass of [false, true]) {
      await heal(); await words()
      if ((await st()).feet < 11) await put(spot, 12, 'back on the floor')
      await walk(spot)
      await force(piece)
      const tag = `${n++}-bard-${piece}-${glass ? 'glass-up' : 'glass-down'}`
      if (glass) { await fidget(); await I.dir(0); await nudge(); await until(s => s.lens?.k === 1, 130, 2) } else await nudge()
      await shot(`${tag}-0-hidden`)
      await bardIn('tell', s => s.foe.t < 0.4, !glass)
      await shot(`${tag}-1-tell`)
      if (piece === 'door' && !glass) {
        // The held jump over the band, by the B ${'$'}{phone ? 'pad' : 'key'}.
        const hp = (await st()).hp
        await bardIn('blow', s => Math.abs(s.foe.x - s.x) < 2.3, false, 120)
        await I.bDown(); await tick(9)
        await shot(`${tag}-2-blow`)
        await until(s => s.ground, 90, 2); await I.bUp(); await tick(2)
        s = await st()
        results[`${size} held jump over the door`] = { cleared: s.hp === hp, heroX: +s.x.toFixed(2) }
        check(s.hp === hp, `a held jump clears the door's charge (${phone ? 'the B pad' : 'the B key'})`)
      } else {
        await bardIn('blow', s => s.foe.t < (piece === 'chest' ? 0.35 : 0.1) || piece === 'door' && s.foe.x < 5.5, false, 120)
        await shot(`${tag}-2-blow`)
      }
      await bardIn('open', s => s.foe.t < 1.9)
      await shot(`${tag}-3-open`)
      await bardIn('wings', () => true, !glass, 240)
    }
  }
  // The fight to its end, by inputs.
  await heal(); await force('chest')
  const hpFight = (await st()).hp
  let healed = 0
  let struck = false
  for (let i = 0; i < 2400; i++) {
    s = await st()
    if (s.foe.dead) break
    if (s.hp < 8) { await heal(); healed++ }
    if (s.mode !== 'play') { await words(); continue }
    const e = s.foe
    const onLedge = s.ground && Math.abs(s.feet - 10) < 0.1
    if (e.mode === 'open') {
      if (e.y + e.r < 10.5 && !onLedge) { await walk(10); await jump(10, 10, 'the floor, up to BARD'); continue }
      let side = s.x < e.x ? -1 : 1
      if (e.x + side * 1.7 < 1.4 || e.x + side * 1.7 > 13.8) side = -side
      if (e.y + e.r < 10.5) side = -1
      if (Math.abs(s.x - e.x - side * 1.7) > 0.5) { await walk(e.x + side * 1.7); continue }
      await I.dir((phone ? 0.5 : 1) * Math.sign(e.x - s.x)); await tick(1); await I.dir(0); await tick(1)
      await I.a(); await tick(8)
      if (!struck && (await st()).foe.took > 0) { struck = true; await shot('19-bard-struck') }
      continue
    }
    if (onLedge) { await I.dir(-1); await tick(6); await I.dir(0); continue }
    if (e.mode === 'blow' && e.piece === 'door' && Math.abs(e.x - s.x) < 2.3 && s.ground) { await I.bDown(); await tick(9); await until(s => s.ground, 90, 2); await I.bUp(); await tick(2); continue }
    if ((e.mode === 'tell' || e.mode === 'blow') && e.piece !== 'door') {
      const bad = x => e.piece === 'chest' ? Math.abs(x - e.tx) < 1.7 : x < 9.3 && e.c.some(c => Math.abs(x - c) < 1.2)
      if (bad(s.x)) { const to = [2, 3.5, 5, 6.5, 8, 9.8, 11, 12.5].filter(x => !bad(x)).sort((a, c) => Math.abs(a - s.x) - Math.abs(c - s.x))[0]; if (to !== undefined) { await I.dir(Math.sign(to - s.x)); await tick(6); await I.dir(0); continue } }
      await tick(3); continue
    }
    if (e.mode === 'hide' && Math.abs(s.x - 6) > 0.5) { await walk(6); continue }
    await tick(3)
  }
  s = await st()
  check(!!s.foe.dead && s.flags.includes('actthree.bard'), `BARD falls to the blade (healed ${healed} times from ${hpFight})`)
  await tick(60)
  await shot('20-boards-gate-open')
  if ((await st()).feet > 11) { await walk(9.5); await climb(-1, 10) }
  await walk(14.5)
  await through(0, -1, 'actflats')

  // -- the Flats -----------------------------------------------------------------
  await calm()
  await shot('21-flats')
  await look('22-flats')
  await walk(3.2); await jump(4.9, 10, 'the floor, at the painted step')
  s = await st()
  check(Math.abs(s.feet - 10) < 0.05, `the painted step is air: down on the floor (${s.feet.toFixed(2)})`)
  await shot('23-flats-through-the-painted-step')
  await walk(6.3); await jump(7.9, 8, 'the floor')
  await jump(7.6, 6, 'the real step')
  await walk(7.5)
  await shot('24-flats-three-chests')
  await use(-1)
  await still('25-flats-painted-chest-puff', s => s.gone[0] > 0.1, 30)
  await tick(30)
  check((await st()).gone.length === 1, 'a painted chest puffs and is gone')
  await shot('26-flats-after-the-puff')
  await walk(4.5); await opened('actthree.key2', 4.5, 6, -1); await words()
  await jump(4.5, 4, 'the chest tier')
  // The painted door at the east end: a bump.
  await walk(12); await I.dir(1); await tick(50); await I.dir(0); await tick(12)
  s = await st()
  check(s.map === 'actflats' && s.x < 14.7 && s.x > 14.4, `the painted door is a bump (${s.x.toFixed(2)})`)
  await shot('27-flats-at-the-painted-door')
  await look('28-flats-doors')
  await walk(2.2)
  await through(-1, 0, 'actwings')

  // -- the Wings -----------------------------------------------------------------
  await calm()
  await shot('30-wings')
  await walk(7)
  await look('31-wings')
  // Moved, and the picture all the way back: what was shown stays faint.
  await fidget(); await I.dir(0); await nudge(-1)
  s = await st()
  check(s.lens.k === 0 && s.seen >= 5, `the paint is back and the hidden things stay shown (${s.seen} tiles)`)
  await shot('32-wings-remembered')
  if (phone) {
    // A thumb resting on B: it jumps once, then lies there.
    await walk(10)
    await I.bDown(); await tick(8)
    await until(s => s.ground, 120)
    let n = 0
    for (; n < 150 && !(s = await st()).lens?.up; n++) await tick(1)
    results.restingThumbOnB = { up: !!s.lens?.up, secondsAfterLanding: +(n / 60).toFixed(2) }
    check(!!s.lens?.up, `a thumb resting on B counts as still (up ${(n / 60).toFixed(2)} s after landing)`)
    await still('33-wings-thumb-on-b', s => s.lens && s.lens.k === 1)
    await I.bUp(); await tick(2)
    check(!(await st()).lens?.up, 'letting B go drops the glass')
    await fidget(); await I.dir(0)
    // A finger on the stick's side that stays inside the dead zone, then one that creeps past it.
    await I.press(1, I.STICK); await tick(2); await I.move(1, { x: I.STICK.x + 5, y: I.STICK.y - 3 })
    s = await until(s => !!s.lens?.up, 150)
    results.restingFingerOnStick = !!s.lens?.up
    check(!!s.lens?.up, 'a finger inside the stick\'s dead zone counts as still')
    await still('34-wings-finger-on-the-stick', s => s.lens && s.lens.k === 1)
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
  await shot('35-wings-on-a-hidden-ledge')
  await walk(4.6); await jump(2.4, 6, 'the first hidden ledge')
  await walk(2.6); await jump(4.7, 4, 'the second hidden ledge')
  await walk(5.5)
  await look('36-wings-top')
  await opened('actthree.heart', 5.5, 4, 1)
  await shot('37-wings-heart')
  await words()
  await walk(3.5); await until(s => s.ground && Math.abs(s.feet - 10) < 0.05, 4000)
  if (Math.abs((await st()).feet - 10) > 0.05) await put(7, 10, 'not down off the ledges')
  // Ten seconds in the Wings in real time: a hop, then stillness until the glass is up, over and over.
  await walk(7)
  await b.eval('window.__free()')
  results[`${size} frame time in the Wings`] = await frameTime(b, async (ms) => {
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
  await shot('38-door-a')
  await I.dir(1); s = await until(s => s.flags.some(f => f.startsWith('door:actwings')), 240); await I.dir(0)
  check(s.keys === 1, `door A opens to a key (${s.keys} left)`)
  await tick(18)
  await shot('39-door-a-open')
  await through(1, 0, 'actloft')
  await still('40-card-scene-three', s => s.card && s.card.t > 0.9)
  await I.a(); await tick(50)
  await heal(); await tick(30)
  await shot('41-fly-loft')
  // A reload in the climb comes back at its last stair.
  await b.eval('window.__free()')
  await b.sleep(2500)
  await b.goto(`${base}/`)
  for (let i = 0; i < 240 && !(await b.eval('!!window.__zelda?.state')); i++) await b.sleep(500)
  await b.sleep(3000)
  await hideDevtools(b)
  s = await st()
  check(s.map === 'actloft' && s.entry === 'rope', `a reload stays in the climb, at its stair (${s.map}:${s.entry})`)
  check(await view() === 'flat', 'a reload in the climb comes back in the side picture')
  await b.eval('window.__manual = true')
  await b.sleep(600)
  await tick(30)
  // (It passes by itself after 3 s, so it may be gone: the visit's list says it was raised.)
  check(await b.eval(`window.__zelda.state.cardsSeen.some(c => c.startsWith('actloft'))`), 'the card is raised again after a reload')
  await I.a(); await tick(50)
  await calm()

  // -- the Fly Loft ------------------------------------------------------------
  /** Wait until no bag will fall on the way from here to x (feet on `row`) in the next `dur` s. */
  const bagsClear = async (x, row, dur = 1) => {
    for (let i = 0; i < 400; i++) {
      const s = await st()
      const [a, c] = [Math.min(s.x, x) - R, Math.max(s.x, x) + R]
      const safe = BAGS.filter(g => g.x + 2 > a && g.x < c && g.y < Math.max(row, s.feet) && g.y + 4.5 > Math.min(row, s.feet) - 3).every(g => { for (let t = 0; t <= dur; t += 1 / 30) if (Z.bagAt(g, s.bagT + t).mode === 'fall') return false; return true })
      if (safe) return
      await tick(3)
    }
    check(false, `the bags leave a way to ${x}`)
  }
  const hop = async (x, row, from, dur = 1) => { await bagsClear(x, row, dur); await jump(x, row, from) }
  const run2 = async (x, row) => { await bagsClear(x, row, Math.abs((await st()).x - x) / 5.4 + 0.35); await walk(x) }
  /** The picture of a bag of the hero's part of the loft in `mode`. */
  const bagShot = async (name, mode, rowFrom, rowTo, k = 0.6) => {
    for (let i = 0; i < 400; i++) {
      const s = await st()
      if (BAGS.some(g => g.y >= rowFrom && g.y <= rowTo && Z.bagAt(g, s.bagT).mode === mode && Z.bagAt(g, s.bagT).k >= k)) return shot(name)
      await tick(2)
    }
  }
  await walk(8)
  await hop(8, 20, 'the floor')
  await bagShot('42-grid-bag-tell', 'tell', 14, 18)
  await bagShot('43-grid-bag-fall', 'fall', 14, 18, 0.5)
  await run2(4.4, 20)
  await hop(2.2, 18, 'catwalk A'); await walk(2.6); await hop(4.6, 16, 'the west step')
  await run2(8, 16); await run2(10.5, 16)
  await hop(12.6, 14, 'catwalk C'); await walk(12.4); await hop(10.2, 12, 'the east step')
  await run2(5.5, 12); await climb(-1, 8)
  await walk(5.9)
  await bagShot('44-leg-bag-tell', 'tell', 2, 2, 0.7)
  await bagShot('45-leg-bag-fall', 'fall', 2, 2, 0.4)
  await run2(9.5, 8)
  await hop(11.6, 8, 'over the sign', 1.6)
  const doors = s => s.flags.filter(f => f.startsWith('door:actloft:')).length
  await I.dir(1); s = await until(s => doors(s) > 0, 240); await I.dir(0)
  check(s.keys === 0, `door B opens to the other key (${s.keys} left)`)
  await tick(24)
  await shot('46-leg-door-b-open')
  await through(1, 0, 'actstudy')

  // -- the Dressing Room -------------------------------------------------------
  await heal(); await tick(20)
  await shot('47-dressing-room')
  const pictured = new Set()
  let under = 0
  for (let i = 0; i < 1500; i++) {
    s = await st()
    const e = s.foe
    if (e.dead) break
    if (s.hp < 8) { await heal(); under++ }
    if (s.ground && s.feet < 9.5) { await I.dir(0, 1); await tick(4); await I.dir(0, 0); await tick(6); continue }
    const dx = e.x - s.x
    if (e.mode === 'tell' && e.t < 0.25 && !pictured.has('tell')) { pictured.add('tell'); await shot('48-understudy-lane'); continue }
    if (e.mode === 'spent' && e.t < 0.7 && !pictured.has('spent')) { pictured.add('spent'); await shot('49-understudy-spent') }
    if (e.mode === 'spent' && e.took < 5) {
      if (Math.abs(dx) > 1.6) { await I.dir(Math.sign(dx)); await tick(3); await I.dir(0); continue }
      await I.dir((phone ? 0.5 : 1) * Math.sign(dx)); await tick(1); await I.dir(0); await tick(1); await I.a(); await tick(7); continue
    }
    if (e.mode === 'charge' && Math.abs(dx) < 2.6 && Math.sign(e.vx) === -Math.sign(dx) && s.ground) { await I.bDown(); await tick(3); await I.bUp(); await until(s => s.ground, 60, 2); continue }
    if (e.mode === 'tell' || e.mode === 'charge') { await tick(2); continue }
    const want = e.x - Math.sign(dx || 1) * 3.8
    if (want < 1.6 || want > 14.4) { if (Math.abs(dx) < 2.2 && s.ground) { await jump(e.x + Math.sign(dx) * 3.2, 10, 'over the understudy') } else await tick(3); continue }
    if (Math.abs(s.x - want) > 0.5) { await I.dir(Math.sign(want - s.x)); await tick(3); await I.dir(0); continue }
    await tick(3)
  }
  s = await st()
  check(!!s.foe.dead && s.flags.includes('actthree.understudy'), `the understudy falls to the blade (healed ${under} times)`)
  await tick(50)
  await shot('50-the-big-keys-chest')
  await walk(12.2); await opened('actthree.bigkey', 12.2, 10, 1)
  await tick(80)
  await shot('51-the-big-key')
  await words()
  check((await st()).big, 'the Big Key is held')
  await walk(2.4)
  await through(-1, 0, 'actloft')
  await heal()
  await bagsClear(9.5, 8, 2); await walk(12.2); await jump(9.5, 8, 'the doorway')
  await run2(5.9, 8)
  await shot('52-the-big-door')
  await bagsClear(2, 8, 1.2)
  const shutBefore = doors(await st())
  await I.dir(-1); s = await until(s => doors(s) > shutBefore, 240); await I.dir(0)
  check(doors(s) > shutBefore, 'the great door opens to the Big Key')
  await tick(20)
  await shot('53-the-big-door-open')
  await through(-1, 0, 'actcable')

  // -- the Cable -----------------------------------------------------------------
  await still('54-card-scene-four', s => s.card && s.card.t > 0.9)
  await I.a(); await tick(50)
  await heal()
  await shot('55-cable-foot')
  await walk(8.4); await jump(9.4, 20, 'the foot'); await walk(8.7); await jump(5.8, 18, 'clamp 1')
  await look(); await shot('56-cable-first-pair-glass-up')
  await fidget(); await I.dir(0); await tick(10); await shot('57-cable-first-pair-glass-down')
  await walk(6.4); await jump(9, 16, 'clamp 2'); await walk(8.4); await jump(5.8, 14, 'clamp 3'); await walk(6.4); await jump(9, 12, 'clamp 4')
  await walk(9.6)
  await shot('58-cable-painted-clamp')
  const hpCable = (await st()).hp
  await I.dir(1); await I.bDown()
  await still('59-cable-through-the-painted-clamp', s => s.x > 12.6 && s.feet > 10.6, 90)
  for (let i = 0; i < 200; i++) { s = await st(); if (s.act === 'fall') break; await I.dir(s.x < 13.4 ? 1 : 0); await tick(2) }
  await I.dir(0); await I.bUp()
  await still('60-cable-the-fall', s => s.act === 'fall', 5)
  await tick(70)
  s = await st()
  check(s.hp === hpCable - 1 && Math.abs(s.feet - 12) < 0.05, `half a heart, and back on the safe clamp (${s.x.toFixed(2)}, ${s.feet.toFixed(2)}, ${s.hp} of ${hpCable})`)
  await shot('61-cable-back-on-the-safe-clamp')
  await walk(8.5); await jump(5.2, 10, 'clamp 5'); await walk(6.4); await jump(9, 8, 'clamp 6'); await walk(8.5); await jump(5.2, 6, 'clamp 7')
  await shot('62-cable-last-pair')
  await walk(5.5); await jump(5.8, 4, 'clamp 8'); await tick(20)
  await shot('63-cable-top')
  await walk(6.4); await jump(8.6, 4, 'over the sign')
  await through(1, 0, 'actgondola')

  }
  const view = () => b.eval(`window.__zelda.state.view`)
  if (!bossOnly) await climbUp()
  else {
    note('the lens given, and into the gondola')
    await b.eval(`(() => { const s = window.__zelda.state; s.flags['item:lens'] = true; s.dialog = null; s.hero.auto = null; s.mode = 'warp'; s.warp = { t: 0, to: 'actgondola', entry: 'stair', swapped: false } })()`)
    await tick(60)
  }
  // -- the Gondola ---------------------------------------------------------------
  await until(s => s.mode === 'dialog', 60); await tick(100)
  await shot('64-gondola-card-line')
  await heal()
  await words()
  /** The fight as the page holds it: the first body of the room runs it. */
  const boss = () => b.eval(`(() => { const s = window.__zelda.state, all = s.map.enemies.filter(e => e.kind === 'hallucinator'), l = all[0]; if (!l) return null; return { dead: l.dead, mode: l.ai.mode, t: l.ai.t, span: l.ai.span, wt: l.ai.wt ?? 0, wave: l.ai.wave, waves: l.ai.waves, claimed: l.ai.claimed, hp: l.hp, took: l.ai.took ?? 0, hurt: l.ai.hurt ?? 0, flash: l.flash, plate: l.ai.plate ?? 0, glass: l.ai.glass ?? 0, painted: !!l.ai.painted, aims: l.ai.mode === 'blows' ? [l.ai.c0, l.ai.c1] : [], bodies: all.map(e => ({ x: e.x, pop: typeof e.ai.pop === 'number' ? e.ai.pop : null, dead: e.dead })) } })()`)
  const seenShots = new Set()
  /** A picture of this state, once. */
  const snap = async (name, ok = true) => { if (!ok || seenShots.has(name)) return; seenShots.add(name); await shot(name) }
  /** Out of the stencils, toward `want`. */
  const spotFor = (f, x, want) => {
    const bad = at => f.aims.some(c => Math.abs(at - c) < 1.3)
    let best = null
    for (let at = 2.4; at <= 12.5; at += 0.2) if (!bad(at) && (best === null || Math.abs(at - want) + Math.abs(at - x) * 0.3 < Math.abs(best - want) + Math.abs(best - x) * 0.3)) best = at
    return best ?? want
  }
  const lean = async (x, to, slack = 0.25) => { await I.dir(0); await I.dir(Math.abs(to - x) < slack ? 0 : Math.sign(to - x)) }
  /** One cut at the body at x, from an arm's length. True when A went down. */
  const cutAt = async (x) => {
    const s = await st()
    let near = s.x < x ? -1 : 1
    if (x + near * 1.3 < 2.35 || x + near * 1.3 > 12.6) near = -near
    const spot = x + near * 1.3
    if (Math.abs(s.x - spot) > 0.55) { await lean(s.x, spot); await tick(3); return false }
    await I.dir(0); await I.dir((phone ? 0.5 : 1) * Math.sign(x - s.x)); await tick(1); await I.a(2); await I.dir(0); await tick(5)
    return true
  }
  let round = 0
  let was = ''
  let healedHere = 0
  let timed = false
  let last = null
  let nudged = 0
  /** Stand about without ever being still: round one is the fight as it looks with the glass down. */
  const shuffleFeet = async () => { await wiggle((await st()).x); await tick(2) }
  // (Never far west: the stair there is live, and a step onto it leaves the fight.)
  let beat = 0
  // (The finger is lifted first: the floating stick follows a long push, and a short one would then read the other way.)
  const wiggle = async (x) => { await I.dir(0); await I.dir(x < 4 ? 1 : x > 11.5 ? -1 : Math.floor(beat++ / 3) % 2 ? 1 : -1) }
  for (let i = 0; i < 6000; i++) {
    const f = await boss()
    if (!f) { const s = await st(); console.log('note', size, 'left the gondola:', s.map, s.x.toFixed(2), JSON.stringify(last)); break }
    if (f.dead) break
    if (process.env.TRACE) last = { i, mode: f.mode, t: +f.t.toFixed(2), wt: +f.wt.toFixed(2), x: +(await st()).x.toFixed(2), aims: f.aims }
    if (process.env.TRACE && i % 5 === 0) console.log('trace', JSON.stringify(last))
    const s = await st()
    if (s.mode !== 'play') { await words(); continue }
    if (s.hp < 8) { await heal(); healedHere++ }
    if (f.mode !== was) { if (f.mode === 'shuffle') round++; was = f.mode }
    const claimedX = f.claimed === undefined ? null : f.bodies[f.claimed].x
    const half = f.hp <= 6
    const tag = half ? 'half' : `r${Math.min(round, 3)}`
    if (f.mode === 'shuffle') {
      // To the west end, off the plate: round 1 shows the room plain, round 2 stands still there for the glass.
      if (round <= 2) await lean(s.x, 4.2); else await I.dir(0)
      if (round === 1) { await snap('70-shuffle-start', f.t < f.span * 0.8); await snap('71-shuffle-together', f.t < f.span * 0.52 && f.t > f.span * 0.4) }
      if (half) await snap('86-half-shuffle', f.t < f.span * 0.7)
      await tick(2); continue
    }
    if (f.mode === 'claim') {
      if (round === 1) { await snap('72-claim', f.t < 0.8); await shuffleFeet(); continue }
      if (round === 2 && nudged !== round) { nudged = round; await nudge() }
      await I.dir(0)
      await snap('78b-glass-ring', round === 2 && !!s.lens && s.lens.still > 0.4 && s.lens.k === 0)
      await snap('78-glass-up-claim', !!s.lens?.up && s.lens.k === 1)
      await tick(2); continue
    }
    if (f.mode === 'blows') {
      if (half && !timed) {
        // Ten seconds in real time as a half round's waves come down, the hero left standing.
        timed = true
        await I.dir(0); await heal()
        await b.eval('window.__free()')
        results[`${size} frame time on the waves`] = await frameTime(b, async (ms) => { await b.sleep(ms) })
        await b.eval('window.__manual = true')
        await b.sleep(600)
        await heal(); await words(); continue
      }
      const real = f.bodies[0].x
      // (Round 2 walks onto the plate; later rounds go toward the real one, which the script reads.)
      const want = round === 2 && f.wave >= 2 ? 7.5 : round <= 2 ? Math.min(Math.max(s.x, 3.5), 5.5) : real
      const to = spotFor(f, s.x, want)
      const quietEnough = Math.abs(to - s.x) < 0.3
      // The glass over a half round's painted crates: one wave is watched standing still, out of the stencils.
      const look = half && f.wave === 2 && quietEnough
      if (look) await I.dir(0); else if (round === 1 && quietEnough) await wiggle(s.x); else await lean(s.x, to)
      if (round === 1) {
        await snap(`73-wave-${f.wave}-tell`, f.wt > 0.75 && f.wt < 1.05)
        await snap(`74-wave-${f.wave}-fall`, f.wt > 1.17 && f.wt < 1.3)
        await snap('75-crates-lying', f.wave === 1 && f.wt > 1.7)
      }
      if (round === 2) {
        await snap('79-plate-ready', f.plate === 0 && f.wave === 1 && f.wt > 0.5)
        await snap('80-plate-cone', f.plate === 1 && f.glass === 1 && f.wt > 0.6 && f.wt < 1.05)
        await snap('80b-plate-cone-fall', f.plate === 1 && f.glass === 1 && f.wt > 1.15 && f.wt < 1.3)
      }
      if (half) {
        await snap('87-half-tell', f.wave === 1 && f.wt > 0.8 && f.wt < 1.05)
        await snap('88-half-painted-fall', f.wave === 1 && f.wt > 1.18 && f.wt < 1.3)
        await snap('89-half-glass-up', f.wave === 2 && !!s.lens?.up && s.lens.k === 1 && f.wt > 1.12 && f.wt < 1.3)
        await snap('89b-half-glass-up-lying', f.wave === 2 && !!s.lens?.up && s.lens.k === 1 && f.wt > 1.5)
        await snap('90-half-lying', f.wave === 3 && f.wt > 0.3)
      }
      await tick(look ? 1 : 2); continue
    }
    if (f.mode === 'bow') {
      // (Round 1: over beside a false one, so that the first cut of the opening pops it.)
      if (round === 1) { const at = f.bodies[[1, 2].find(k => k !== f.claimed)].x; await lean(s.x, at + (at < 7 ? 1.3 : -1.3), 0.4) } else await I.dir(0)
      await snap(`76-bow-quiet-${tag}`, f.t < 0.4)
      await tick(1); continue
    }
    if (f.mode === 'open') {
      await snap(`77-open-rail-${tag}`, f.t < (half ? 1.7 : 1.9) && f.hurt <= 0)
      const popped = f.bodies.findIndex(o => o.pop !== null)
      if (popped >= 0) await snap('81-pop', f.bodies[popped].pop > 0.05 && f.bodies[popped].pop < 0.3)
      await snap('82-real-hurt', f.hurt > 0.1 && f.flash <= 0.05)
      await snap('83-bar-after-the-hurt', f.took >= 3)
      // Round 1: first a cut at a false one (not the claimed), for the pop; then the real one.
      const falseOne = [1, 2].find(k => k !== f.claimed)
      const target = round === 1 && popped < 0 && f.t > 0.5 ? f.bodies[falseOne].x : f.bodies[0].x
      if (f.took >= 4) { await I.dir(0); await tick(2); continue }
      const hp = f.hp
      await cutAt(target)
      const after = await boss()
      if (popped < 0 && after.bodies.some(o => o.pop !== null)) { await tick(5); await snap('81-pop') }
      if (after.hp < hp) await snap('82-real-hurt', after.hurt > 0.05 && after.flash <= 0.05)
      continue
    }
    await tick(2)
  }
  const end = await boss()
  check(!!end?.dead && (await st()).flags !== undefined, `the Hallucinator falls to the blade (healed ${healedHere} times, round ${round})`)
  await until(s => s.mode === 'dialog', 90); await tick(50)
  await shot('91-the-room-line')
  await words(); await tick(40)
  await shot('92-the-weight-and-the-gate')
  await walk(5.5); await tick(40)
  await shot('93-the-weight-held')
  await tick(110)
  await shot('94-the-weight-words')
  await words()
  check(await b.eval(`window.__zelda.state.flags['item:weightSources'] === true`), 'the Weight SOURCES is held')
  await walk(12.4)
  await shot('95-the-way-out')
  await through(1, 0, 'fogstage')
  await tick(60); await words()
  check(await view() === (iso ? 'iso' : 'flat'), `down at the gangway in the view as it was (${await view()})`)
  await shot('96-down-at-the-gangway')
  await b.eval(`(() => { const s = window.__zelda.state, v = s.map.npcs.find(n => n.id === 'q.act.director'); s.flags['q.act.tape'] = true; s.hero.x = v.x - 0.95; s.hero.y = v.y; s.hero.dir = 'right'; s.hero.aim = 0 })()`)
  note('the tape flag set, and the hero set beside Vega')
  for (const name of ['97-vega-the-tape', '98-vega-the-weight']) {
    await tick(40); await I.a(); await tick(70)
    check((await st()).mode === 'dialog', 'Vega answers')
    await shot(name)
    await words()
  }
  await b.eval(`(() => { const s = window.__zelda.state; s.dialog = null; s.mode = 'warp'; s.warp = { t: 0, to: 'actloft', entry: 'kdoor', swapped: false } })()`)

  if (bossOnly) { results[`${size} errors`] = b.errors.slice(0, 5); await b.close(); return }
  // Ten seconds in real time under the Leg's bags, standing in a gap: stencils and bags on screen.
  await tick(60); await heal()
  await put(5.9, 8, 'in the first gap of the Leg, for the frame time')
  await calm()
  await b.eval('window.__free()')
  results[`${size} frame time under the bags`] = await frameTime(b, async (ms) => { await b.sleep(ms) })
  await b.eval('window.__manual = true')
  await b.sleep(600)
  // And the view on the way out, from the foot of the climb.
  await b.eval(`(() => { const s = window.__zelda.state; s.dialog = null; s.hero.auto = null; s.mode = 'warp'; s.warp = { t: 0, to: 'actunder', entry: 'foot', swapped: false } })()`)
  note('set at the foot of the climb, for the way out')
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
