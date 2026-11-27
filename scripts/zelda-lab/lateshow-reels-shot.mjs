#!/usr/bin/env node
// THE LATE SHOW, reels two and three, in the running shell (a local dev server only), one frame at a time
// (`lockstep.mjs`), with real key events at 1280 × 800 and real touches on the deck at 390 × 844. The test's own
// play-through (`tests/zelda-lateshow.test.mjs`) is played there, from the screen's door in Rerun Estates to the
// Screen, by the same scripted player (`tests/zelda-reel.mjs`), with a real reload of the tab halfway; pictures are
// taken as things happen. On the touch deck one thumb has B or A, never both. The player is given the blade, and is
// healed when down to a heart (each time printed). Then scenes set up by the script (each printed): the booth in both
// views, COPILOT stomped and a pass that hits, thirty timed stomps on a foe, and the Road's frame time.
// Every request that leaves this machine is blocked.
//   CHROME_BIN=… node scripts/zelda-lab/lateshow-reels-shot.mjs http://127.0.0.1:3257 <outDir> desk|phone [play|booth|road|stomp|frames …]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { load } from '../../tests/zelda-load.mjs'
import { reelPlayer } from '../../tests/zelda-reel.mjs'
import { lockstep } from './lockstep.mjs'

const [base, out, size, ...parts] = process.argv.slice(2)
if (!base || !out || !['desk', 'phone'].includes(size) || !/^http:\/\/(localhost|127\.0\.0\.1):/.test(base)) { console.error('usage: lateshow-reels-shot.mjs <local base url> <outDir> desk|phone [play booth road stomp frames]'); process.exit(2) }
const want = p => !parts.length || parts.includes(p)
mkdirSync(out, { recursive: true })
const phone = size === 'phone'
const E = await load()
const R = E.HERO_R
let failed = false
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) failed = true }
const note = what => console.log('set ', `${size}: ${what}`)
const results = {}

const B = lockstep(phone ? { width: 390, height: 844, dpr: 3, mobile: true } : { width: 1280, height: 800 }, base)
const SNAP = `JSON.stringify(window.__zelda.state, (k, v) => (k === 'scenery' || k === 'explored' || k === 'sight' ? undefined : v))`

// -- the hands ------------------------------------------------------------------------------------------------

const KEYS = { ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39], ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], KeyK: ['k', 75], Space: [' ', 32], KeyV: ['v', 86] }
const down = new Set()
const key = (code, on) => {
  if (on === down.has(code)) return
  if (on) down.add(code); else down.delete(code)
  B.send('Input.dispatchKeyEvent', { type: on ? 'keyDown' : 'keyUp', key: KEYS[code][0], code, windowsVirtualKeyCode: KEYS[code][1] })
}
const points = new Map()
const STICK = { x: 90, y: 740 }
const touches = () => [...points].map(([id, p]) => ({ id, x: p.x, y: p.y }))
let touched = false
/** Presses made: a thumb's work, counted. */
const presses = { a: 0, b: 0 }
const press = (id, p) => { touched = true; points.set(id, p); B.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches() }) }
const slide = (id, p) => { const was = points.get(id); if (was.x === p.x && was.y === p.y) return; touched = true; points.set(id, { ...was, ...p }); B.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches() }) }
const lift = id => { const p = points.get(id); if (!p) return; touched = true; points.delete(id); B.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: points.size ? [{ id, x: p.x, y: p.y }] : [] }) }
const pad = sel => B.eval(`(() => { const e = document.querySelector('${sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, top: r.y } : null })()`)
let pads = {}

/** Touches made since the last frame are waited for. */
const delivered = () => { if (touched) B.settle(); touched = false }
/** An engine's input, as the keys or the deck give it. */
function hands(inp) {
  const m = inp.move ?? { x: 0, y: 0 }
  const way = v => (v > 0.38 ? 1 : v < -0.38 ? -1 : 0)
  const bWant = !!(inp.bPress || inp.jumpPress || inp.jumpHeld)
  const aWant = !!(inp.aPress || inp.a)
  if (!phone) {
    key('ArrowLeft', way(m.x) < 0); key('ArrowRight', way(m.x) > 0); key('ArrowUp', way(m.y) < 0); key('ArrowDown', way(m.y) > 0)
    if (inp.bPress && down.has('KeyK')) key('KeyK', false)
    if (inp.aPress && down.has('Space')) key('Space', false)
    key('KeyK', bWant); key('Space', aWant)
    return
  }
  // The left thumb: the stick, where it lands.
  if (!way(m.x) && !way(m.y)) lift(1)
  else {
    if (!points.has(1)) press(1, { ...STICK })
    slide(1, { x: STICK.x + Math.max(-1, Math.min(1, m.x)) * 38, y: STICK.y + Math.max(-1, Math.min(1, m.y)) * 38 })
  }
  // The right thumb: one pad at a time. To reach A it leaves B.
  const to = aWant ? 'a' : bWant ? 'b' : null
  const on = points.get(2)?.pad ?? null
  if (on && (on !== to || (to === 'a' && inp.aPress) || (to === 'b' && inp.bPress))) lift(2)
  if (to && !points.has(2)) {
    const p = pads[to] ?? (pads[to] = pad(`.zelda-pad-${to}`))
    // (While words or a card are up the deck steps aside, and a tap on the world passes them.)
    const hidden = to === 'a' && (S.mode === 'dialog' || S.mode === 'get' || S.card)
    if (p && !hidden) { presses[to]++; press(2, { x: p.x, y: p.y, pad: to }) }
    else if (to === 'a') press(2, { x: 300, y: 420, pad: to })
  }
}

// -- the mirror and the shell as an engine ---------------------------------------------------------------------

const S = {}
function sync(t, s) {
  for (const k of Object.keys(t)) if (!(k in s)) delete t[k]
  for (const [k, v] of Object.entries(s)) {
    const was = t[k]
    if (v && typeof v === 'object' && was && typeof was === 'object' && Array.isArray(v) === Array.isArray(was) && !(k === 'map' && was.id !== v.id) && !(Array.isArray(v) && v.length !== was.length)) sync(was, v)
    else t[k] = v
  }
}
const read = () => sync(S, JSON.parse(B.eval(SNAP)))
let heals = 0
const taken = new Set()
let inRoom = { key: '', n: 0 }
const shoot = name => { B.shot(`${out}/${size}-2-${name}.png`) }
const once = (name, when) => { if (!when || taken.has(name)) return; taken.add(name); shoot(name) }

/** The pictures taken as things happen. */
function watch(s) {
  const h = s.hero
  const id = `${s.map.id}-${s.zoneIndex}`
  inRoom = inRoom.key === id && s.mode === 'play' && !s.card ? { key: id, n: inRoom.n + 1 } : { key: id, n: 0 }
  once(`room-${id}`, inRoom.n === (s.map.id === 'chase1986' ? 100 : 30) && s.map.id !== 'rerun')
  if (s.card) once(`card-${s.card.title.replace(/\W/g, '')}`, s.card.t >= 0.6)
  const said = s.dialog && s.dialog.chars >= s.dialog.lines[s.dialog.line].length ? s.dialog.lines[s.dialog.line] : ''
  once('words-copilot', /^COPILOT/.test(said))
  once('words-usher', /SEATS/.test(said))
  once('words-bigkey', /LAST REEL/.test(said))
  once('words-weaver', /NEVER SEEN/.test(said))
  once('get-heart-piece', s.mode === 'dialog' && /PIECE OF HEART/.test(said))
  const car = s.map.enemies.find(e => e.kind === 'copilot')
  if (car && s.mode === 'play') {
    const r = car.ai.r ?? -5
    once('copilot-honk', !car.dead && car.ai.mode === 'honk' && car.ai.t < 0.5)
    once('copilot-pass-jumped', !car.dead && car.ai.mode === 'pass' && Math.abs(car.x - h.x) < 0.6 && h.y + R < 20.0 && h.act !== 'hurt')
    once('copilot-stall', !car.dead && car.ai.mode === 'stall' && car.ai.t < 3.2)
    once('copilot-chain', !car.dead && car.ai.mode === 'stall' && car.hp < 8 && !!h.swing)
    once('copilot-rev', !car.dead && car.ai.mode === 'rev' && car.ai.t < 0.3)
    once('copilot-leave', !car.dead && car.ai.mode === 'leave' && r > 11.5)
    once('copilot-spin', car.dead && car.deathT > 0.25 && car.deathT < 0.5)
    once('copilot-stomp', !car.dead && !!h.side?.dive && car.ai.mode === 'stall')
    once('copilot-stomp-after', !car.dead && car.hp <= 5 && car.flash > 0 && !h.swing && h.side?.vy < -5)
  }
  once('video-spring', s.map.id === 'reel1986' && !!h.side?.squash)
  once('video-balcony', s.map.id === 'reel1986' && h.side?.ground && Math.abs(h.y + R - 13) < 0.05)
  once('video-nook', s.map.id === 'reel1986' && h.side?.ground && Math.abs(h.y + R - 19) < 0.05 && h.x > 4.8 && h.x < 7)
  once('lot-slab', s.map.id === 'reel2086' && s.zoneIndex === 0 && h.side?.ground && Math.abs(h.y + R - 13) < 0.05)
  once('lastreel-pad', s.map.id === 'reel2086' && s.zoneIndex === 1 && !!h.side?.squash && h.side.squash.i % 32 === 22)
  once('lastreel-far-pad', s.map.id === 'reel2086' && !!h.side?.squash && h.side.squash.i % 32 === 25)
  once('lastreel-door-open', s.map.id === 'reel2086' && s.map.tiles[20 * 32 + 28] === '.' && s.mode === 'play' && h.x > 28.4)
  once('booth-gate-open', s.map.id === 'showbooth' && s.zoneIndex === 1 && s.map.tiles[5 * 48 + 31] === '.' && s.mode === 'play' && h.x > 28.5)
  once('snack-shut', s.map.id === 'showbooth' && s.map.tiles[5 * 48 + 32] === 'X' && s.mode === 'play' && h.x > 35)
  once('usher-tell', s.map.enemies.some(e => e.kind === 'sentry' && e.tough && e.ai.mode === 'tell' && e.ai.t < 0.3))
  once('booth-k-open', s.map.id === 'showbooth' && s.map.tiles[10 * 48 + 23] === '.' && s.mode === 'play')
}

function stepShell(_w, _s, _dt, inp) {
  const cracks = S.map.tiles.filter(t => t === '%').length
  const id = S.map.id
  const flat = !!S.hero.side?.squash
  const aim = S.hero.side?.dive?.aim
  const struck = aim?.on === 'foe' ? S.map.enemies.find(e => e.id === aim.id) : null
  const hp = struck?.hp
  hands(inp)
  delivered()
  sync(S, JSON.parse(B.step(1, SNAP)))
  const ev = []
  if (S.hero.side?.squash && !flat) ev.push({ type: 'stomp', on: 'spring' })
  if (S.map.id === id && S.map.tiles.filter(t => t === '%').length < cracks) ev.push({ type: 'stomp', on: 'crack' })
  if (struck && !S.hero.side?.dive && struck.hp < hp) ev.push({ type: 'stomp', on: 'foe' })
  watch(S)
  if (S.mode === 'play' && S.hero.hp <= 2) {
    heals++
    note(`healed at ${S.map.id} x ${S.hero.x.toFixed(1)} (down to ${S.hero.hp})`)
    B.eval('(() => { const h = window.__zelda.state.hero; h.hp = h.maxHp })()')
    read()
  }
  return ev
}

const rest = () => { hands({ move: { x: 0, y: 0 } }); delivered(); sync(S, JSON.parse(B.step(2, SNAP))) }
const idle = n => { for (let i = 0; i < n; i++) stepShell(0, 0, 0, { move: { x: 0, y: 0 } }) }
/** Into a map at an entry, by the game's own door fade. */
function go(map, entry) {
  rest()
  B.eval(`(() => { const s = window.__zelda.state; s.dialog = null; s.card = undefined; s.get = null; s.hero.auto = null; s.hero.hp = s.hero.maxHp; s.mode = 'warp'; s.warp = { t: 0, to: '${map}', entry: '${entry}', swapped: false } })()`)
  for (let i = 0; i < 40; i++) { sync(S, JSON.parse(B.step(2, SNAP))); if (S.mode !== 'warp') break }
  read()
}
const view = side => {
  for (let i = 0; i < 5; i++) {
    read()
    if (S.view === side) break
    key('KeyV', true); B.step(2); key('KeyV', false); B.step(90)
  }
  B.step(40)
  read()
  check(S.view === side, `the ${side === 'iso' ? 'isometric' : '8-bit'} view (${S.view})`)
}

const Z = {
  ...E,
  stepGame: stepShell,
  createGame() {
    go('rerun', 'screen')
    for (let i = 0; i < 60; i++) { B.step(2); read(); if (S.mode === 'play') break; if (S.mode === 'dialog') { hands({ aPress: true, a: true, move: { x: 0, y: 0 } }); B.step(1); rest() } }
    view('flat')
    B.eval('window.__zelda.state.rng = 11')
    note('into Rerun Estates at the screen\'s door, the 8-bit picture chosen')
    read()
    return S
  },
  grant(_s, item) { B.eval(`window.__zelda.state.inv['${item}'] = true`); note(`the ${item} given`); read() },
}

/** The tab reloaded, for real. */
function reload() {
  rest()
  B.run()
  B.sleep(2500)
  down.clear(); points.clear(); pads = {}
  B.load()
  B.hold()
  read()
  console.log('note the tab was reloaded; it came back in', S.map.id, 'at', S.entry.entry)
  return S
}

// -- the run --------------------------------------------------------------------------------------------------

try {
  B.load()
  B.hold()
  read()

  if (want('play')) {
    // The test's own words, from its first line to its last, with the shell for an engine.
    const src = readFileSync(new URL('../../tests/zelda-lateshow.test.mjs', import.meta.url), 'utf8')
    const from = src.indexOf('let s = Z.createGame(Z.WORLD, { seed: 11')
    const body = src.slice(from, src.indexOf("  it('loads a save made in a reel"))
    const play = new Function('Z', 'reelPlayer', 'assert', 'reload', body.slice(0, body.lastIndexOf('  })')))
    const t0 = Date.now()
    try {
      play(Z, reelPlayer, assert, reload)
      check(true, `played from the screen's door to the Screen in the shell (${size}), healed ${heals} times`)
    } catch (e) {
      check(false, `the play-through: ${e.message.split('\n')[0]}`)
      shoot('failed-here')
    }
    idle(40)
    shoot('the-screen')
    results.play = { heals, seconds: Math.round((Date.now() - t0) / 1000), flags: Object.keys(S.flags).filter(f => /lateshow/.test(f)) }
    if (phone) {
      const room = B.eval(`(() => { const cv = document.querySelector('.zelda-canvas'), W = cv.width, H = cv.height, r = devicePixelRatio; const scale = Math.max(1, Math.min(Math.floor(W / 256), Math.floor(H / 384))); const top = (H - 384 * scale) / 2 / r, t = 16 * scale / r; return { top, bottom: top + 24 * t, floorTop: top + 21 * t, tile: t } })()`)
      results.deck = { room, A: pad('.zelda-pad-a'), B: pad('.zelda-pad-b') }
    }
  }

  if (want('booth')) {
    B.eval(`(() => { const s = window.__zelda.state; s.inv.sword = true; for (const f of ['lateshow.seen', 'lateshow.copilot', 'lateshow.usher', 'lateshow.usher.card']) s.flags[f] = true })()`)
    note('the booth with COPILOT and the Usher down')
    go('showbooth', 'door')
    for (const [name, x, y] of [['scaffold', 8.5, 5.5], ['booth', 24.5, 6.2], ['snackbar', 39.5, 6.5]]) {
      // (A room is changed by the camera's own cell: the map entered again there.)
      B.eval(`(() => { const z = window.__zelda, s = z.state; s.zoneIndex = ${Math.floor(x / 16)}; s.zone = { x: ${Math.floor(x / 16) * 16}, y: 0, w: 16, h: 12 }; s.hero.x = ${x}; s.hero.y = ${y} })()`)
      note(`the hero set in the ${name}`)
      for (const side of ['flat', 'iso']) { view(side); B.step(60); read(); shoot(`booth-${name}-${side}`) }
    }
    view('flat')
    // The gate shut, as it is before COPILOT falls.
    B.eval(`(() => { const s = window.__zelda.state; delete s.flags['lateshow.copilot']; delete s.flags['gate:showbooth.31,5'] })()`)
    go('showbooth', 'lens2')
    B.step(40); read(); shoot('booth-gate-shut')
  }

  /** The Road from its start, COPILOT whole again. */
  const road = () => {
    B.eval(`(() => { const s = window.__zelda.state; s.inv.sword = s.inv.stomp = true; for (const f of Object.keys(s.flags)) if (/lateshow\\.(copilot|key2)/.test(f)) delete s.flags[f]; s.flags['lateshow.copilot.card'] = true; if (!s.cardsSeen.includes('chase1986:0')) s.cardsSeen.push('chase1986:0') })()`)
    go('chase1986', 'start')
  }

  if (want('road')) {
    // The whole Road by each way, and the deck's work over it: what the thumbs did, and what it cost.
    for (const stomp of [false, true]) {
      road()
      note(`the Road from its start ${stomp ? 'with the stomp' : 'by the blade'}: presses and hearts counted`)
      for (const n of ['copilot-honk', 'copilot-pass-jumped', 'copilot-stall', 'copilot-chain', 'copilot-rev', 'copilot-leave', 'copilot-spin', 'copilot-stomp', 'copilot-stomp-after']) taken.add(n)
      Object.assign(presses, { a: 0, b: 0 })
      let frames = 0
      let lost = 0
      let left = 0
      const counted = { ...Z, stepGame: (...a) => { const hp = S.hero.hp; const ev = stepShell(...a); if (S.mode === 'play') frames++; if (S.hero.hp < hp) lost += hp - S.hero.hp; left = S.map.chase?.left ?? left; return ev } }
      const healed = heals
      try {
        reelPlayer(counted, S).theRoad({ stomp })
        results[stomp ? 'roadStomp' : 'roadBlade'] = { secondsOfPlay: +(frames / 60).toFixed(1), screenReached: left, halfHeartsLost: lost, healed: heals - healed, ...(phone ? { thumbPresses: { ...presses } } : {}) }
        check(true, `the Road ${stomp ? 'with the stomp' : 'by the blade'}: ${(frames / 60).toFixed(1)} s of play, ${lost} half hearts lost${phone ? `, right thumb ${presses.b} on B and ${presses.a} on A, one at a time` : ''}`)
      } catch (e) { check(false, `the Road: ${e.message.split('\n')[0]}`) }
    }
    for (const n of [...taken]) if (n.startsWith('copilot')) taken.delete(n)
    road()
    note('the Road again, COPILOT whole: fought with the stomp')
    for (const n of ['copilot-honk', 'copilot-pass-jumped', 'copilot-stall', 'copilot-chain', 'copilot-rev', 'copilot-leave']) taken.add(n)
    taken.delete('copilot-spin')
    const before = heals
    try {
      const t = reelPlayer(Z, S).theRoad({ stomp: true })
      check(true, `COPILOT down by the stomp in the shell, ${t.toFixed(1)} s after control; healed ${heals - before} times`)
    } catch (e) { check(false, `the stomp fight: ${e.message.split('\n')[0]}`) }
    // A pass that hits: the screen at its end, the hero standing in the lane.
    road()
    B.eval(`(() => { const s = window.__zelda.state; Object.assign(s.map.chase, { left: 48, wait: 0 }); const h = s.hero; h.x = 53; h.y = 21 - ${R} - 0.001; delete h.side; const e = s.map.enemies.find(e => e.kind === 'copilot'); Object.assign(e.ai, { mode: 'honk', t: 1.2, r: -5 }) })()`)
    note('the screen held at its end, the hero standing five tiles in, COPILOT at its honk')
    read()
    const hp = S.hero.hp
    for (let i = 0; i < 200 && S.hero.hp === hp; i++) idle(1)
    check(S.hero.hp === hp - 2, `a hero who stands in the lane is hit (${hp} to ${S.hero.hp})`)
    idle(3)
    shoot('copilot-pass-hit')
  }

  if (want('stomp')) {
    // Thirty timed presses on a foe: B tapped (a frame down), A so many frames after, the stick toward it.
    B.eval(`(() => { const s = window.__zelda.state; s.inv.sword = s.inv.stomp = true; s.flags['weaver.card'] = true })()`)
    go('weaver', 'stair')
    note('thirty stomps, on the Screen\'s bare floor: a blob set at rest, the hero set 0.8 or 1.5 tiles from it, before each')
    const set = across => {
      B.eval(`(() => { const s = window.__zelda.state, m = s.map; m.enemies.length = 0; m.drops.length = 0;
        m.enemies.push({ id: 'thumb', kind: 'blob', x: 9.5, y: 21 - 0.38, r: 0.38, hp: 2, maxHp: 2, dir: 'left', cell: 0, invuln: 0, stun: 0, knock: null, ai: { mode: 'idle', t: 999, tell: 0 }, home: { x: 9.5, y: 20.5 }, dead: false, flash: 0 });
        const h = s.hero; Object.assign(h, { x: 9.5 - ${across}, y: 21 - ${R} - 0.0001, knock: null, invuln: 0, swing: null, spin: null, charge: -1, hp: h.maxHp, act: 'idle', bufA: 0 }); delete h.side; s.mode = 'play' })()`)
      rest(); B.step(20); read()
    }
    const trial = (across, frames) => {
      set(across)
      const m = { x: 1, y: 0 }
      hands({ move: m, bPress: true, jumpHeld: true }); delivered(); sync(S, JSON.parse(B.step(1, SNAP)))
      // B let go at once: a tapped jump.
      hands({ move: m }); delivered(); let at = 1
      while (at < frames) { sync(S, JSON.parse(B.step(1, SNAP))); at++ }
      hands({ move: m, aPress: true, a: true })
      delivered()
      let dived = false, cut = false
      for (let i = 0; i < 70; i++) {
        sync(S, JSON.parse(B.step(1, SNAP)))
        if (S.hero.side?.dive) { dived = true; once('stomp-trial', true) }
        if (S.hero.swing && !dived) cut = true
        if (i === 1) { hands({ move: m }); delivered() }
        if (S.map.enemies[0].dead) break
        if (i > 8 && S.hero.side?.ground) break
      }
      rest()
      return { across, ms: Math.round((frames * 1000) / 60), stomped: dived && S.map.enemies[0].dead, cut }
    }
    const trials = []
    for (let k = 1; k <= 15; k++) trials.push(trial(0.8, k), trial(1.5, k + 3))
    const n = trials.filter(t => t.stomped).length
    results.stomp = { stomped: n, of: trials.length, cuts: trials.filter(t => t.cut).length, ms: [Math.min(...trials.map(t => t.ms)), Math.max(...trials.map(t => t.ms))], missed: trials.filter(t => !t.stomped) }
    check(n === 30, `${n} of ${trials.length} timed presses stomp the foe (A ${results.stomp.ms.join(' to ')} ms after take-off); ordinary cuts thrown: ${results.stomp.cuts}`)
    // The same presses in real time, the clock running: what a loaded machine delivers is part of this one.
    B.run()
    // (Two jumps to let the running clock settle, not counted.)
    for (let k = 0; k < 2; k++) { B.sleep(1500); hands({ move: { x: 0, y: 0 }, bPress: true, jumpHeld: true }); B.sleep(60); hands({ move: { x: 0, y: 0 } }) }
    B.sleep(1000)
    const live = []
    for (const { across, ms } of trials) {
      hands({ move: { x: 0, y: 0 } })
      B.eval(`(() => { window.__zelda.state.mode = 'play' })()`)
      B.eval(`(() => { const s = window.__zelda.state, m = s.map; m.enemies.length = 0; m.drops.length = 0;
        m.enemies.push({ id: 'thumb', kind: 'blob', x: 9.5, y: 21 - 0.38, r: 0.38, hp: 2, maxHp: 2, dir: 'left', cell: 0, invuln: 0, stun: 0, knock: null, ai: { mode: 'idle', t: 999, tell: 0 }, home: { x: 9.5, y: 20.5 }, dead: false, flash: 0 });
        const h = s.hero; Object.assign(h, { x: 9.5 - ${across}, y: 21 - ${R} - 0.0001, knock: null, invuln: 0, swing: null, spin: null, charge: -1, hp: h.maxHp, act: 'idle', bufA: 0 }); delete h.side })()`)
      B.sleep(250)
      // Watched in the page: the first frame off the ground, when the A pad was touched, and what came of it.
      B.eval(`(() => { const w = window.__seen = { dive: false, cut: false, air: 0, landed: 0, a: 0, stop: false }
        addEventListener('pointerdown', e => { if (e.target.closest?.('.zelda-pad-a') && !w.a) w.a = performance.now() }, { capture: true, once: false });
        (function f() { const h = window.__zelda.state.hero; if (h.side && !h.side.ground && !w.air) w.air = performance.now(); if (w.air && h.side?.ground && !w.landed) w.landed = performance.now(); if (h.side?.dive) w.dive = true; if (h.swing && !w.dive) w.cut = true; if (!w.stop) window.__raf(f) })() })()`)
      const m = { x: 1, y: 0 }
      hands({ move: m, bPress: true, jumpHeld: true })
      B.sleep(25)
      hands({ move: m })
      B.sleep(Math.max(0, ms - 25))
      hands({ move: m, aPress: true, a: true })
      B.sleep(30)
      hands({ move: m })
      B.sleep(700)
      live.push(B.eval('(() => { const w = window.__seen; w.stop = true; return { dive: w.dive, cut: w.cut, dead: window.__zelda.state.map.enemies[0]?.dead ?? true, aAfterTakeOff: w.a && w.air ? Math.round(w.a - w.air) : null, inAirFor: w.landed && w.air ? Math.round(w.landed - w.air) : null } })()'))
      Object.assign(live.at(-1), { across, ms })
    }
    hands({ move: { x: 0, y: 0 } })
    results.stompRealTime = { stomped: live.filter(t => t.dive && t.dead).length, of: live.length, missed: live.filter(t => !(t.dive && t.dead)) }
    console.log('note', `in real time: ${results.stompRealTime.stomped} of ${live.length}`)
    B.hold()
  }

  if (want('frames')) {
    const stats = a => { const s = [...a].sort((x, y) => x - y); const q = p => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { n: s.length, mean: +(s.reduce((x, y) => x + y, 0) / s.length).toFixed(2), p95: +q(0.95).toFixed(2), p99: +q(0.99).toFixed(2), max: +s.at(-1).toFixed(2) } }
    road()
    B.eval('(() => { const h = window.__zelda.state.hero; h.maxHp = h.hp = 20 })()')
    note('ten seconds of the Road in real time, 20 half hearts: running to keep a third in, B tapped every 0.7 s, A after it')
    rest()
    B.run()
    B.sleep(400)
    B.eval('window.__ft = []')
    const end = Date.now() + 10000
    let k = 0
    let right = false
    while (Date.now() < end) {
      const [x, left] = B.eval('[window.__zelda.state.hero.x, window.__zelda.state.map.chase?.left ?? 0]')
      right = x < left + 7
      const jump = k % 14 === 0
      const cut = k % 14 === 4
      hands({ move: { x: right ? 1 : 0, y: 0 }, bPress: jump, jumpHeld: jump || (k % 14 > 0 && k % 14 < 3), aPress: cut, a: cut })
      B.sleep(40)
      k++
    }
    const ft = B.eval('(() => { const f = window.__ft; window.__ft = null; return f })()')
    hands({ move: { x: 0, y: 0 } })
    const by = new Map()
    for (const [t, d] of ft) by.set(t, (by.get(t) ?? 0) + d)
    const stamps = [...by.keys()].sort((a, c) => a - c)
    results.frames = { interval: stats(stamps.slice(1).map((t, i) => t - stamps[i])), work: stats([...by.values()]) }
    shoot('road-real-time')
  }

  const errs = B.errors().filter(e => !/ERR_BLOCKED|Failed to load resource|net::|\[vite\]|WebSocket/.test(e))
  check(errs.length === 0, `no script errors (${errs.slice(0, 3).join(' | ')})`)
} finally {
  B.close()
}
console.log(JSON.stringify(results, null, 1))
writeFileSync(`${out}/${size}-2-results${parts.length ? `-${parts.join('-')}` : ''}.json`, JSON.stringify(results, null, 1))
process.exit(failed ? 1 : 0)
