// Neon Shrine's keys (`themes/zelda/bindings.ts`, `keysStore.ts`, `render/keysPage.ts`): a changed key through the
// real input, the KEYS page on screens with no key tip left on the play picture, the keys' way over the profile
// between devices, and what keeps them when a run is thrown away.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { loadRoutes } from './account-load.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const root = join(repo, 'themes', 'zelda')
const d1 = await import('./miniworld-d1.mjs').then(x => x.d1, () => null)

async function bundle(contents, resolveDir = root, plugins = []) {
  const out = await esbuild.build({
    stdin: { contents, resolveDir, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error', plugins,
    mainFields: ['module', 'main'], external: ['./render/iso/view'],
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let Z
before(async () => {
  Z = await bundle([
    `export * from './bindings'`, `export * from './keysStore'`, `export { createInput } from './input'`, `export * from './keys'`,
    `export { WORLD } from './world/index'`, `export { createGame, toSave } from './engine/index'`, `export { clearLocalSave } from './localSave'`,
    `export * from './render/keysPage'`, `export { drawHud, drawMenuTabs, menuTabs, menuTabsY, hudScale, hudFont, NEON_SKIN, HIRES_WINDOW_SKIN } from './render/hud'`,
    `export { cornerParts, cornerShape } from './render/corner'`, `export { drawExitLabels, createLabels } from './render/exits'`,
  ].join('\n'))
})

/** A browser's storage, in memory. */
function storage(seed = {}) {
  const kept = new Map(Object.entries(seed))
  return { kept, getItem: k => kept.get(k) ?? null, setItem: (k, v) => { kept.set(k, String(v)) }, removeItem: k => { kept.delete(k) } }
}

// ---- 1: keys through the real input --------------------------------------------------------------------------

test('keys through the real input: the first ones, a change, a swap, what is refused, the menu, the names and a reload', () => {
  globalThis.localStorage = storage()
  const on = {}
  globalThis.window = { innerWidth: 800, addEventListener: (t, f) => { on[t] = f }, removeEventListener: () => {} }
  const input = Z.createInput({ canvas: () => null, touch: () => false, onTouch: () => {}, idle: () => false, paused: () => false, dialog: () => false })
  input.attach()
  /** What one press of `code` does, and lets it go. */
  const press = (code, extra = {}) => {
    input.clear()
    on.keydown({ code, target: null, repeat: false, preventDefault() {}, ...extra })
    const i = input.read()
    on.keyup({ code })
    return { a: i.aPress, b: i.bPress, roll: !!i.rollPress, cycle: i.cycle, x: i.move.x, y: i.move.y, jump: !!i.jumpPress }
  }
  const does = code => Object.entries(press(code)).filter(([k, v]) => v && k !== 'jump').map(([k, v]) => (k === 'x' || k === 'y' ? `${k}${v}` : k)).join()

  Z.resetKeys()
  assert.deepEqual(['Space', 'KeyJ', 'KeyZ', 'Enter'].map(does), ['a', 'a', 'a', 'a'])
  assert.deepEqual(['KeyK', 'KeyX', 'ShiftLeft', 'KeyL', 'KeyC', 'KeyQ', 'Tab'].map(does), ['b', 'b', 'b', 'roll', 'roll', 'cycle', 'cycle'])
  assert.deepEqual(['KeyW', 'ArrowUp', 'KeyA', 'KeyS', 'KeyD'].map(does), ['y-1', 'y-1', 'x-1', 'y1', 'x1'])

  const change = (action, code) => { const r = Z.bindKey(Z.bindings(), action, code); assert.ok(r.table, `${action} → ${code}`); Z.applyKeys(r.table); return r }
  change('a', 'KeyF')
  assert.deepEqual(['KeyF', 'Space', 'KeyJ', 'Enter'].map(does), ['a', '', 'a', 'a'])
  assert.equal(change('roll', 'KeyK').swapped, 'b')
  assert.deepEqual(['KeyK', 'KeyL'].map(does), ['roll', 'b'])
  change('walkUp', 'KeyE')
  assert.deepEqual(['KeyE', 'KeyW', 'ArrowUp'].map(does), ['y-1', '', 'y-1'])
  // (On a side map up is the jump too, while that rule stands.)
  assert.deepEqual([press('KeyE').jump, press('KeyW').jump, press('ArrowUp').jump], [true, false, true])
  // A spare yields to a key that is somebody's own.
  change('sound', 'KeyJ')
  assert.deepEqual([does('KeyJ'), Z.actionOf('KeyJ'), [...Z.codesOf('a')]], ['', 'sound', ['KeyF', 'KeyZ', 'Enter']])
  assert.equal(new Set(Object.values(Z.bindings())).size, Z.ACTIONS.length, 'one key, one action')

  for (const code of ['Escape', 'Tab', 'Enter', 'KeyY', 'F5', 'AudioVolumeUp', 'PageUp', 'ArrowUp', 'Backspace', 'ControlLeft', 'MetaLeft', 'AltRight', 'Unidentified', '']) {
    assert.deepEqual(Z.bindKey(Z.bindings(), 'a', code), { refused: true }, code)
  }
  assert.equal(press('KeyF', { ctrlKey: true }).a, false, 'a chord is the browser\'s')
  const first = Z.defaultKeys()
  assert.deepEqual(Z.bindKey(first, 'view', 'KeyD'), { refused: true }, 'D is the LOG page\'s switch')
  assert.deepEqual(Z.bindKey(first, 'walkRight', 'KeyP'), { refused: true }, 'nor by changing places')
  assert.equal(Z.bindKey(first, 'walkRight', 'KeyE').table.walkRight, 'KeyE')

  const play = { paused: false, confirmReset: false, touch: false }
  const menu = { ...play, paused: true }
  const ask = { ...menu, confirmReset: true }
  const say = (codes, state, table = first) => codes.map(c => Z.menuCommand(c, state, table))
  const codes = ['KeyP', 'KeyN', 'KeyM', 'KeyG', 'KeyH', 'KeyV', 'KeyO', 'KeyT', 'KeyY', 'Backspace', 'PageUp', 'PageDown', 'Space']
  assert.deepEqual(say(codes, play), ['items', 'moves', 'map', 'log', 'keys', 'view', null, null, null, null, null, null, null])
  assert.deepEqual(say(codes, menu), ['items', 'moves', 'map', 'log', 'keys', 'view', 'sound', 'town', null, null, 'pagePrev', 'pageNext', null])
  assert.deepEqual(say(codes, ask), ['items', 'no', null, null, null, null, null, null, 'yes', 'no', null, null, null])
  assert.deepEqual(say(['KeyH', 'PageUp', 'PageDown', 'KeyM'], { ...menu, touch: true }), [null, null, null, 'map'])
  const swapped = Z.bindKey(first, 'pMap', 'KeyT').table
  assert.deepEqual(say(['KeyT', 'KeyM'], menu, swapped), ['map', 'town'])

  // Names: capitals the face draws, never two keys one name.
  Z.resetKeys()
  assert.deepEqual(Z.keyboardKeys(), Z.KEYBOARD_KEYS, 'the first keys\' names are the ones written down')
  for (const [a, b] of [['ShiftLeft', 'ShiftRight'], ['Numpad5', 'Digit5']]) assert.notEqual(Z.keyName(a), Z.keyName(b))
  Z.noteKey('Semicolon', 'ø')
  Z.noteKey('Equal', 'Dead')
  assert.deepEqual([Z.keyName('Semicolon'), Z.keyName('Equal'), Z.keyName('IntlBackslash')], ['Ø', '=', '<'])
  Z.setLayoutMap(new Map([['KeyK', 't'], ['BracketLeft', 'å'], ['Quote', 'ä']]))
  assert.deepEqual(['KeyK', 'BracketLeft', 'Quote'].map(Z.keyName), ['T', 'Å', '\''], 'the layout\'s letter, where the face has it')
  Z.setLayoutMap(null)

  // A record from a newer version: what is known applies, the clash goes to the later action, the unknown is kept.
  const record = { v: 1, at: 5, map: { a: 'KeyF', roll: 'KeyF', town: 'KeyD', view: 'F5', dance: 'KeyU', walkUp: 'KeyK' } }
  const read = Z.parseKeys(record)
  assert.deepEqual(read.map, { dance: 'KeyU', a: 'KeyF' })
  assert.deepEqual([read.table.a, read.table.roll, read.table.walkUp, read.table.b, read.table.town, read.table.view], ['KeyF', 'KeyL', 'KeyW', 'KeyK', 'KeyT', 'KeyV'])
  assert.deepEqual([Z.parseKeys(null), Z.parseKeys({ v: 2, map: {} }), Z.parseKeys('x')], [null, null, null])

  // Changed, kept, and read again by a fresh page.
  localStorage.setItem(Z.KEYS_STORE, JSON.stringify(record))
  Z.loadKeys()
  Z.saveKeys(Z.bindKey(Z.bindKey(Z.bindings(), 'b', 'KeyU').table, 'pItems', 'KeyI').table)
  const kept = JSON.parse(localStorage.getItem(Z.KEYS_STORE))
  assert.deepEqual(kept.map, { dance: 'KeyU', a: 'KeyF', b: 'KeyU', pItems: 'KeyI' })
  assert.ok(kept.at > 5)
  const table = Z.bindings()
  Z.resetKeys()
  Z.loadKeys()
  assert.deepEqual(Z.bindings(), table)
  assert.equal(Z.subst('PRESS {A}, THEN {B}.', Z.keyboardKeys()), 'PRESS F, THEN U.')
  assert.equal(Z.keyboardKeys().menu.items, 'I')
  Z.saveKeys(Z.defaultKeys())
  assert.deepEqual([Z.bindings(), JSON.parse(localStorage.getItem(Z.KEYS_STORE)).map], [Z.defaultKeys(), { dance: 'KeyU' }])

  // A browser that keeps nothing still plays.
  globalThis.localStorage = { getItem: () => null, setItem: () => { throw new Error('no') }, removeItem: () => {} }
  Z.saveKeys(Z.bindKey(Z.bindings(), 'a', 'KeyF').table)
  Z.loadKeys()
  assert.equal(Z.bindings().a, 'KeyF')
  globalThis.localStorage = storage()
  Z.saveKeys(Z.defaultKeys())
})

// ---- 2: the page on screens, and no tips drawn ---------------------------------------------------------------

const SCREENS = [{ w: 360, h: 640, dpr: 2 }, { w: 375, h: 667, dpr: 2 }, { w: 844, h: 390, dpr: 3 }, { w: 1280, h: 800, dpr: 1 }]
/** The names the face draws (as `zelda-world.test.mjs` holds the world's lines to it, and `<`). */
const FACE = /^[A-Z0-9ÆØÅ .,!?'":;\-()/#%&+=*·↑↓←→<]*$/

/** The HUD's grid on a screen in a dress, as the renderer reckons it (`resize`, `hudSpace`). */
function grid(scr, density) {
  const W = scr.w * scr.dpr
  const H = scr.h * scr.dpr
  let scale = Math.max(1, Math.floor(Math.min(W / (13 * 16), H / (11 * 16))))
  while (W / scale > 30 * 16) scale++
  const hs = Z.hudScale(scale, W, H, density)
  return { vw: Math.ceil(W / hs), vh: Math.ceil(H / hs), css: hs / scr.dpr }
}

const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const within = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
function apart(list, where) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    assert.ok(!meets(list[i][1], list[j][1]), `${where}: ${list[i][0]} over ${list[j][0]}`)
  }
}

/** A context that draws nowhere, and a skin that remembers the words and panels it was asked for. */
const nowhere = () => new Proxy({}, { get: (t, p) => (p in t ? t[p] : () => {}), set: (t, p, v) => { t[p] = v; return true } })
function listening(skin) {
  const said = []
  const font = Z.hudFont(skin)
  return { said, skin: { ...skin, icon: () => ({}), panel: () => {}, font: { width: font.width, wrap: font.wrap, draw: (_g, text) => { said.push(text) } } } }
}

test('the KEYS page lays out on every screen, and the play picture names no key beside a keyboard', () => {
  const wide = ['R SHIFT', 'NUM 5', 'BSLASH', 'NUM ENT.', 'WWWWWWWW']
  const rows = Z.ACTIONS.map((a, i) => ({ section: a.section, name: a.name, key: wide[i % wide.length] }))
  const view = (cursor, more = {}) => ({ rows, cursor, capturing: false, armed: false, lit: null, flash: [], last: 'ESC RESUME · ENTER CHANGE', signIn: true, ...more })
  const states = [{}, { capturing: true, last: 'PRESS A KEY · ESC CANCELS' }, { armed: true, last: Z.AGAIN_WORDS }, { lit: 3, flash: [4], last: 'SWAPPED WITH WALK RIGHT', signIn: false }]
  const cases = [
    ...SCREENS,
    // A notch: a row of text off the top, and one side.
    { w: 844, h: 390, dpr: 3, safe: { top: 10, left: 24 } },
    { w: 360, h: 640, dpr: 2, safe: { top: 10, right: 12 } },
    // Short screens, where the list takes pages.
    { w: 360, h: 420, dpr: 2, short: true },
    { w: 600, h: 400, dpr: 2, short: true },
  ]
  for (const scr of cases) for (const density of [1, 2]) {
    const { vw, vh, css } = grid(scr, density)
    const skin = density === 2 ? Z.HIRES_WINDOW_SKIN : Z.NEON_SKIN
    const size = `${scr.w}×${scr.h} density ${density} (${vw}×${vh})`
    const pagesSeen = []
    for (const more of states) {
      const seen = []
      let pages = 1
      for (let cursor = 0; cursor <= rows.length; cursor++) {
        const ear = listening(skin)
        let p
        Z.drawKeysPage(nowhere(), vw, vh, { keys: Z.KEYBOARD_KEYS, view: view(cursor, more), css, safe: scr.safe, placed: x => { p = x } }, ear.skin)
        const where = `${size}, cursor ${cursor}, page ${p.page + 1}/${p.pages.length}`
        for (const t of ear.said) assert.match(t, FACE, `${where}: ${t}`)
        assert.ok(p.pages[p.page].includes(cursor), `${where}: the cursor's page is up`)
        pages = p.pages.length
        const page = { x: scr.safe?.left ?? 0, y: scr.safe?.top ?? 0, w: vw - (scr.safe?.left ?? 0) - (scr.safe?.right ?? 0), h: vh - (scr.safe?.top ?? 0) }
        // (The tabs stand in the middle of the screen on every page, a side notch or not.)
        const screen = { x: 0, y: 0, w: vw, h: vh }
        const parts = [
          ['tabs', p.tabs], ...p.sections.map(s => [s.text, s]), ...p.rows.map(r => [r.name.text, r.box]),
          ...(p.reset ? [['reset', p.reset.box]] : []), ...(p.pager ? [['count', p.pager.count], ['more', p.pager.hit]] : []),
          ...(p.signIn ? [['sign in', p.signIn]] : []), ['last', p.last],
        ]
        for (const [name, b] of parts) {
          assert.ok(within(b, name === 'tabs' ? { ...screen, y: page.y, h: page.h } : page), `${where}: ${name} ${JSON.stringify([b.x, b.y, b.w, b.h])} off the page`)
          for (const v of [b.x, b.y, b.w, b.h]) assert.ok(Number.isInteger(v), `${where}: ${name} not on whole px`)
        }
        apart(parts, where)
        for (const r of p.rows) {
          for (const b of [r.name, r.cell, r.key]) assert.ok(within(b, r.box), `${where}: ${r.name.text} out of its row`)
          assert.ok(!meets(r.name, r.cell), `${where}: ${r.name.text} into its key`)
          assert.ok(within(r.key, r.cell), `${where}: ${r.key.text} out of its cell`)
        }
        for (const b of [...p.rows.map(r => r.box), p.reset?.box, p.pager?.hit].filter(Boolean)) assert.ok(b.h * css >= 24, `${where}: a button ${b.h * css} CSS px`)
        if (cursor === p.pages[p.page][0]) seen.push(...p.rows.map(r => r.index), ...(p.reset ? [rows.length] : []))
      }
      assert.deepEqual(seen, Array.from({ length: rows.length + 1 }, (_, i) => i), `${size}: every row and RESET ALL once`)
      pagesSeen.push(pages)
    }
    if (scr.w === 360 && scr.h === 640) assert.ok(Math.max(...pagesSeen) <= 2, `${size}: ${pagesSeen}`)
    if (scr.w === 1280) assert.equal(Math.max(...pagesSeen), 1, size)
    if (scr.short && scr.w === 360) assert.ok(Math.min(...pagesSeen) > 1, `${size}: pages`)
  }

  // The tabs at 360 wide, four (the deck's) and five.
  for (const dpr of [2, 3]) for (const density of [1, 2]) for (const keys of [Z.TOUCH_KEYS, Z.KEYBOARD_KEYS, { ...Z.KEYBOARD_KEYS, menu: { ...Z.KEYBOARD_KEYS.menu, map: 'L SHIFT' } }]) {
    const { vw, vh } = grid({ w: 360, h: 640, dpr }, density)
    const F = Z.hudFont(density === 2 ? Z.HIRES_WINDOW_SKIN : Z.NEON_SKIN)
    const tabs = Z.menuTabs(F, vw, Z.menuTabsY(vh), keys)
    assert.equal(tabs.length, keys.touch ? 4 : 5)
    for (const [i, t] of tabs.entries()) {
      assert.ok(t.x >= 0 && t.x + t.w <= vw, `${vw} wide: ${t.label} at ${t.x}`)
      if (i) assert.ok(t.x - (tabs[i - 1].x + tabs[i - 1].w) >= 6, `${vw} wide: ${t.label} runs into ${tabs[i - 1].label}`)
    }
    if (keys.menu?.map === 'L SHIFT') assert.deepEqual(tabs.map(t => t.label), ['ITEMS', 'MOVES', 'MAP', 'LOG', 'KEYS'])
  }
  assert.deepEqual(Z.menuTabs(Z.hudFont(Z.NEON_SKIN), 320, 2, Z.KEYBOARD_KEYS).map(t => t.label), ['P ITEMS', 'N MOVES', 'M MAP', 'G LOG', 'H KEYS'])

  // The play picture: the item box draws no letter, the corner holds no cap and its tag hangs right under the frame,
  // an exit's plate says its name alone (the touch deck's its TAP too).
  const s = Z.createGame(Z.WORLD, { seed: 7, at: { map: 'overworld', entry: 'start' } })
  Object.assign(s.inv, { sword: true, disc: true, selected: 'disc' })
  const had = globalThis.document
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => nowhere() }) }
  try {
    const hud = listening(Z.NEON_SKIN)
    Z.drawHud(nowhere(), s, 320, 0, false, hud.skin, Z.WORLD)
    assert.ok(hud.said.length && hud.said.every(t => /^\d+$/.test(t)), `the HUD says ${hud.said}`)
  } finally { globalThis.document = had }
  for (const chart of [true, false]) for (const e of [0, 1]) {
    const parts = Z.cornerParts({ chart, e, pinned: null, tag: 'ESC: MENU' })
    assert.ok(!('keyM' in parts) && !('keyV' in parts))
    if (chart) assert.equal(parts.tag.y, parts.frame.y + parts.frame.h + 2)
    assert.ok(parts.tag.x >= 0)
  }
  const exit = s.map.exits.find(x => x.label)
  for (const [word, wanted] of [['', [exit.label.toUpperCase()]], ['TAP', [exit.label.toUpperCase(), '·', 'TAP']]]) {
    const ear = listening(Z.HIRES_WINDOW_SKIN)
    const labels = Z.createLabels()
    labels.alpha.set(exit.id, 1)
    Z.drawExitLabels(nowhere(), s, labels, 0, 0, 320, 200, 0, word, true, true, 2, ear.skin)
    assert.deepEqual(ear.said, wanted)
  }
})

// ---- 3: the profile's route and the merge --------------------------------------------------------------------

test('the keys\' slot on the profile, on both stores, and which side wins', async () => {
  // With the dev server's own stores: in memory without a database, D1's SQL with one.
  const { mod, routes } = await loadRoutes({ define: { 'import.meta.dev': 'true' } })
  // The auth server's stand-in: one session.
  mod.u_account.useSessionChecker(mod.u_sessionCheck.createSessionChecker({
    base: 'http://auth.test',
    fetch: async (_url, init) => new Response(JSON.stringify({ user: String(init.headers.cookie).includes('alice') ? { id: 'user-alice', email: 'a@example.test', name: 'Alice', image: null } : null })),
  }))
  for (const kind of ['memory', ...(d1 ? ['d1'] : [])]) {
    const db = kind === 'd1' ? d1() : null
    const event = (o = {}) => ({ headers: o.token ? { cookie: `session_token=${o.token}` } : {}, query: o.query, body: o.body, context: { cloudflare: { env: db ? { LEADERBOARD_DB: db } : {} } } })
    const P = randomUUID()
    await mod.u_store.getStore(event()).upsertPlayer(P, 'PILOT')
    const post = o => routes['save.post'](event({ token: o.token, body: { playerId: o.player ?? P, game: 'zelda.keys', data: o.data, savedAt: o.at } }))
    const get = token => routes['save.get'](event({ token, query: { player: P, game: 'zelda.keys' } }))
    const status = p => p.then(() => 200, e => e.statusCode ?? e.message)
    const now = Date.now()
    const mine = { v: 1, map: { a: 'KeyF' }, at: now }
    await post({ data: mine, at: now })
    assert.deepEqual((await get()).save.data, mine, kind)
    const late = await post({ data: { v: 1, map: {}, at: now - 5 }, at: now - 5 })
    assert.deepEqual([late.save.data, late.save.savedAt], [mine, now], `${kind}: an older write answers with what stands`)
    assert.equal(await status(post({ data: { v: 1, map: { x: 'K'.repeat(2100) } }, at: now + 1 })), 413, kind)
    assert.equal(await status(post({ player: randomUUID(), data: mine, at: now })), 404, kind)
    await routes['account/link.post'](event({ token: 'alice', body: { playerId: P } }))
    assert.equal(await status(get()), 401, `${kind}: a linked profile`)
    assert.equal(await status(post({ data: mine, at: now + 2 })), 401, kind)
    assert.equal(await status(get('alice')), 200, kind)
  }

  // The merge, against a profile that is only a variable.
  globalThis.localStorage = storage()
  Z.loadKeys()
  const pushed = []
  let theirs = null
  const remote = { player: true, hasPlayer() { return this.player }, pull: async () => theirs, push: u => { pushed.push(u) } }
  const local = () => JSON.parse(localStorage.getItem(Z.KEYS_STORE) ?? 'null')
  await Z.syncKeys(remote)
  assert.deepEqual([pushed.length, local()], [0, null], 'nothing anywhere')
  // Changed before there was a player: kept here, sent at the first sync after.
  remote.player = false
  Z.saveKeys(Z.bindKey(Z.bindings(), 'a', 'KeyF').table, remote)
  await Z.syncKeys(remote)
  assert.equal(pushed.length, 0)
  remote.player = true
  await Z.syncKeys(remote)
  assert.deepEqual(pushed.pop(), { data: local(), savedAt: local().at })
  // The profile's is newer: it wins, with its stamp.
  const newer = local().at + 1000
  theirs = { data: { v: 1, map: { b: 'KeyU' }, at: 3 }, savedAt: newer }
  await Z.syncKeys(remote)
  assert.deepEqual([local(), Z.bindings().b, Z.bindings().a, pushed.length], [{ v: 1, map: { b: 'KeyU' }, at: newer }, 'KeyU', 'Space', 0])
  await Z.syncKeys(remote)
  assert.equal(pushed.length, 0, 'the same on both sides')
  // This browser's is newer: it goes up.
  theirs = { data: { v: 1, map: {} }, savedAt: newer - 10 }
  await Z.syncKeys(remote)
  assert.equal(pushed.pop().savedAt, newer)
  // What is no record is left alone; no answer leaves everything.
  for (const answer of [{ data: { v: 9 }, savedAt: newer + 5 }, { data: null, savedAt: newer + 5 }, 'offline']) {
    theirs = answer
    await Z.syncKeys(remote)
    assert.deepEqual([local().at, pushed.length], [newer, 0])
  }
  // The profile's slot as the browser has it, refusing the write (a clock too far ahead): nothing is thrown.
  const calls = []
  const had = globalThis.fetch
  globalThis.fetch = async (url, init) => { calls.push(init?.method ?? 'GET'); return new Response('{}', { status: 400 }) }
  const useGameSave = (await bundle(`export { useGameSave } from './composables/useGameSave'`, repo, [nuxtStubs, tilde])).useGameSave
  globalThis.useLeaderboard = () => ({ ensurePlayer: async () => ({ id: randomUUID() }), reRegister: async () => {} })
  const slot = useGameSave('zelda.keys')
  Z.saveKeys(Z.bindKey(Z.bindings(), 'a', 'KeyF').table, { ...slot, hasPlayer: () => true })
  await new Promise(r => setTimeout(r, 20))
  await Z.syncKeys({ ...slot, hasPlayer: () => true })
  assert.deepEqual([calls.includes('POST'), Z.bindings().a], [true, 'KeyF'])
  globalThis.fetch = had
  delete globalThis.useLeaderboard
  Z.saveKeys(Z.defaultKeys())
})

const tilde = {
  name: 'tilde',
  setup(build) { build.onResolve({ filter: /^~\// }, args => ({ path: require.resolve(join(repo, args.path.slice(2)) + '.ts') })) },
}
/** The browser's player, for the composables that ask for one. */
const nuxtStubs = {
  name: 'player',
  setup(build) {
    build.onResolve({ filter: /composables\/useLeaderboard$/ }, () => ({ path: 'player', namespace: 'stub' }))
    build.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const useLeaderboard = () => globalThis.useLeaderboard?.() ?? { adopt() {} }; export const readStoredPlayer = () => null', loader: 'js' }))
  },
}

// ---- 4: NEW GAME and a wiped save ----------------------------------------------------------------------------

test('NEW GAME and a wiped save keep the keys; a second account on the browser starts without them', { skip: !d1 && 'node:sqlite needs Node 22.5 or newer' }, async () => {
  const record = JSON.stringify({ v: 1, map: { a: 'KeyF' }, at: 10 })
  globalThis.localStorage = storage({ [Z.KEYS_STORE]: record, zeldaSave: '{}', 'phareim.account': 'user-alice' })
  Z.clearLocalSave(Date.now())
  assert.deepEqual([localStorage.getItem('zeldaSave'), localStorage.getItem(Z.KEYS_STORE)], [null, record])

  const { routes } = await loadRoutes()
  const db = d1()
  const event = o => ({ headers: {}, query: o.query, body: o.body, context: { cloudflare: { env: { LEADERBOARD_DB: db } } } })
  const P = randomUUID()
  db.raw.prepare('INSERT INTO players (id, name) VALUES (?, ?)').run(P, 'PILOT')
  const now = Date.now()
  await routes['save.post'](event({ body: { playerId: P, game: 'zelda.keys', data: JSON.parse(record), savedAt: now - 10 } }))
  await routes['save.post'](event({ body: { playerId: P, game: 'zelda', data: { v: 1 }, savedAt: now - 10 } }))
  // The run thrown away, as `dropSave` sends it.
  await routes['save.post'](event({ body: { playerId: P, game: 'zelda', data: null, savedAt: now } }))
  assert.equal((await routes['save.get'](event({ query: { player: P, game: 'zelda' } }))).save.data, null)
  assert.deepEqual((await routes['save.get'](event({ query: { player: P, game: 'zelda.keys' } }))).save.data, JSON.parse(record))

  // The same account again keeps them; another one's sign-in wipes the browser's copy.
  const had = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({ playerId: randomUUID(), name: 'SOMEONE' }))
  const link = (await bundle(`export { usePortalAccountLink } from './composables/useAccount'`, repo, [nuxtStubs, tilde])).usePortalAccountLink()
  assert.equal(await link({ id: 'user-alice' }), 'linked')
  assert.equal(localStorage.getItem(Z.KEYS_STORE), record)
  assert.equal(await link({ id: 'user-bob' }), 'switched')
  assert.equal(localStorage.getItem(Z.KEYS_STORE), null)
  globalThis.fetch = had
})
