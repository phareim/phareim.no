// The menu's ITEMS page (`themes/zelda/render/itemsPage.ts`): the page on the screens it is played on, a use of its
// grid from open to saved pick, and the Weights' row. No canvas: the layout and the picking are pure.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')

let Z
before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { WORLD } from './world/index'; export { createGame, toSave, parseSave } from './engine/index'; export { WEIGHTS } from './types'; export * from './render/itemsPage'; export { hudScale, NEON_SKIN, HIRES_WINDOW_SKIN } from './render/hud'; export { TOUCH_KEYS, KEYBOARD_KEYS } from './keys'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

/** Screens in CSS px, and where the paused deck's buttons begin on the ITEMS page in each dress (measured in the shell). */
const SCREENS = [
  { w: 390, h: 844, dpr: 3, deck: { 1: 716, 2: 734 } },
  { w: 375, h: 667, dpr: 2, deck: { 1: 539, 2: 557 } },
  { w: 360, h: 640, dpr: 2, deck: { 1: 512, 2: 530 } },
  { w: 844, h: 390, dpr: 3, deck: { 1: 322, 2: 332 } },
  { w: 667, h: 375, dpr: 2, deck: { 1: 307, 2: 317 } },
  { w: 1280, h: 800, dpr: 1 },
]

/** The page of a game on a screen in a dress, on the HUD's grid as the renderer reckons it (`resize`, `hudSpace`). */
function lay(s, scr, density) {
  const W = scr.w * scr.dpr
  const H = scr.h * scr.dpr
  let scale = Math.max(1, Math.floor(Math.min(W / (13 * 16), H / (11 * 16))))
  while (W / scale > 30 * 16) scale++
  const hs = Z.hudScale(scale, W, H, density)
  const vw = Math.ceil(W / hs)
  const vh = Math.ceil(H / hs)
  const oy = Math.floor((H - vh * hs) / 2)
  const deck = scr.deck ? Math.floor((scr.deck[density] * scr.dpr - oy) / hs) : null
  const o = { keys: scr.deck ? Z.TOUCH_KEYS : Z.KEYBOARD_KEYS, cursor: 0, css: hs / scr.dpr, deck, view: 'ISOMETRIC' }
  const made = Z.itemsPageFor(s, vw, vh, o, density === 2 ? Z.HIRES_WINDOW_SKIN : Z.NEON_SKIN)
  return { vw, vh, ...made }
}

const game = () => Z.createGame(Z.WORLD, { seed: 7, at: { map: 'overworld', entry: 'start' } })
const hold = (s, n) => { for (const w of Z.WEIGHTS.slice(0, n)) s.flags[`item:${w.id}`] = true; return s }
const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const within = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h

/** No two of these boxes over each other. */
function apart(list, where) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    assert.ok(!meets(list[i][1], list[j][1]), `${where}: ${list[i][0]} over ${list[j][0]}`)
  }
}

test('lays out on every screen: inside it, above the deck, cells of 44 CSS px, nothing over anything', () => {
  const s = hold(game(), Z.WEIGHTS.length)
  Object.assign(s.inv, { sword: true, arc: true, bombBag: true, bombs: 20, bigBag: true, disc: true, hook: true, prism: true, arts: ['hop'], keys: 9, bigKey: true, pieces: 3, shrooms: 3, selected: 'disc' })
  for (const f of ['no', 'stomp', 'lens', 'waffle', 'tube', 'walkie', 'hat']) s.flags[`item:${f}`] = true
  // Out on the coast, and in the Shrine, where the keys are on the page too.
  for (const map of ['overworld', 'shrine']) {
    s.map = { ...s.map, id: map, ring: 'shrine' }
    for (const scr of SCREENS) for (const density of [1, 2]) {
      const { layout: p, opts, vw, vh } = lay(s, scr, density)
      const where = `${map} ${scr.w}×${scr.h} density ${density} (${vw}×${vh}, bottom ${opts.bottom}, gave ${p.gave})`
      const page = { x: 0, y: 0, w: vw, h: Math.min(vh, opts.bottom) }
      const parts = ['tabs', 'heading', 'grid', 'line', 'always', 'weights', 'carried', 'quest', 'last'].filter(k => p[k]).map(k => [k, p[k]])
      for (const [name, b] of parts) {
        assert.ok(within(b, page), `${where}: ${name} ${JSON.stringify([b.x, b.y, b.w, b.h])} off the page`)
        for (const v of [b.x, b.y, b.w, b.h]) assert.ok(Number.isInteger(v), `${where}: ${name} not on whole px`)
      }
      apart(parts, where)
      assert.ok(p.grid && p.line && p.weights, `${where}: the grid, its line and the Weights stay`)
      assert.equal(!!p.last, !scr.deck, `${where}: the keys' hints`)
      // What gave way did so in order.
      assert.deepEqual(p.gave, Z.ITEMS_GIVE_WAY.filter(g => p.gave.includes(g)), where)
      if (p.gave.length) assert.ok(p.gave.includes('always') && !p.always, `${where}: the ALWAYS row goes first`)
      assert.equal(p.cells.length, 9)
      for (const c of p.cells) {
        assert.ok(c.w * opts.css >= 44 && c.h * opts.css >= 44, `${where}: a cell ${c.w * opts.css} CSS px`)
        assert.ok(within(c, p.grid), `${where}: a cell off the grid`)
      }
      apart(p.cells.map((c, i) => [`cell ${i}`, c]), where)
      // Inside each part, the same.
      const inside = {
        weights: p.weights && [...p.weights.pans, p.weights.count],
        always: p.always && [p.always.label, ...p.always.icons],
        carried: p.carried && [p.carried.label, p.carried.pieces, p.carried.key, p.carried.bigKey, ...p.carried.errands].filter(Boolean),
        quest: p.quest && [p.quest.title, ...p.quest.lines],
        last: p.last && p.last.hints,
      }
      for (const [k, list] of Object.entries(inside)) {
        if (!list) continue
        for (const b of list) assert.ok(within(b, p[k]), `${where}: ${b.text ?? b.icon ?? ''} ${JSON.stringify([b.x, b.y, b.w, b.h])} out of ${k} ${JSON.stringify([p[k].x, p[k].y, p[k].w, p[k].h])}`)
        apart(list.map((b, i) => [`${k} ${i}`, b]), where)
      }
    }
  }
})

test('a use of the page: the cursor walks to the edges, a pick goes on B and nowhere else, and is saved', () => {
  const s = game()
  Object.assign(s.inv, { sword: true, bombBag: true, bombs: 8, disc: true, hook: true, selected: 'bombs' })
  let at = Z.cursorStart(s.inv)
  assert.equal(at, 2, 'on the thing in hand')
  const walk = (dx, dy, n = 1) => { for (let i = 0; i < n; i++) at = Z.moveCursor(at, dx, dy); return at }
  assert.equal(walk(1, 0), 2, 'the right edge')
  assert.equal(walk(0, -1), 2, 'the top')
  assert.equal(walk(0, 1, 5), 8, 'the bottom')
  assert.equal(walk(-1, 0, 5), 6, 'the left edge')
  const before = structuredClone(s)
  assert.equal(Z.pickCell(s.inv, at), false, 'an empty socket picks nothing')
  assert.deepEqual(s, before)
  walk(0, -1, 5)
  assert.equal(walk(1, 0), 1)
  assert.equal(Z.pickCell(s.inv, at), true)
  assert.deepEqual(s, { ...before, inv: { ...before.inv, selected: 'disc' } })
  assert.deepEqual(Z.sockets(s.inv).map(c => c.held), [false, true, false, false, false, false, false, false, false])
  const saved = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
  const again = Z.createGame(Z.WORLD, { seed: 8, save: saved })
  assert.equal(again.inv.selected, 'disc')
  assert.equal(Z.cursorStart(again.inv), 1)
})

test('the Weights\' row is not there until one is held, and counts them', () => {
  for (const density of [1, 2]) {
    assert.equal(lay(game(), SCREENS[0], density).layout.weights, null)
    const { layout, opts } = lay(hold(game(), 3), SCREENS[0], density)
    assert.equal(layout.weights.count.text, '3/7')
    assert.deepEqual(opts.content.weights, ['item_weight_meaning', 'item_weight_reasons', 'item_weight_no', null, null, null, null])
  }
})
