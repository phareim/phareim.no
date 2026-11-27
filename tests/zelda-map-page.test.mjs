// The menu's MAP page (`themes/zelda/render/mapPage.ts`) as a player reads it: the land's chart, the places and their
// pins, the tally of what is left to find, the world's chart, the rooms indoors, the hero never covered, and the
// painted page's words. Where its parts go on every screen is the layout matrix (`zelda-layout.test.mjs`). No canvas:
// the layout and the pictures are pure, and the painter is run on a stand-in context that keeps its pixels.
import { describe, it, before } from 'node:test'
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
      contents: `export { WORLD } from './world/index'; export { createGame, setViewRule } from './engine/index'; export { enterMap } from './engine/game'; export { mapInfo } from './engine/map'; export { charted, reveal, seenTile } from './engine/explore'; export * from './render/mapPage'; export { chartInks, chartLayer, chartTally, fogInks, dimInk } from './render/worldMap'; export { CORNER_SKIN } from './render/corner'; export { hudScale, NEON_SKIN, HIRES_WINDOW_SKIN } from './render/hud'; export { TOUCH_KEYS, KEYBOARD_KEYS } from './keys'; export { textWidth } from '../base/pixel/font'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error', external: ['./render/iso/view'],
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

// ---- games --------------------------------------------------------------------------------------------------

/** A game with the blade on a map, nothing seen but what the entry shows. */
function game(map, entry) {
  const s = Z.createGame(Z.WORLD, { seed: 7, at: { map: 'overworld', entry: 'start' } })
  s.explored = {}
  s.flags = {}
  s.exploreAt = undefined
  Z.enterMap(Z.WORLD, s, map, entry ?? Object.keys(Z.mapInfo(Z.WORLD, map).entries)[0], [])
  s.dialog = null
  s.mode = 'play'
  s.inv.sword = true
  s.daytime = 580
  return s
}
const seeAll = (s, id = s.map.id) => { const i = Z.mapInfo(Z.WORLD, id); Z.reveal(s, id, i.w, i.h, { x: 0, y: 0, w: i.w, h: i.h }) }
/** Every land walked into and seen. */
function farGone(s) {
  for (const id of Object.keys(Z.WORLD.atlas)) { s.flags[`seen:${id}`] = true; seeAll(s, id) }
  seeAll(s)
  return s
}
const charted = () => Object.entries(Z.WORLD.maps).filter(([, d]) => Z.charted(d)).map(([id]) => id)
const rooms = () => Object.entries(Z.WORLD.maps).filter(([, d]) => !Z.charted(d)).map(([id]) => id)

// ---- screens ------------------------------------------------------------------------------------------------

/** Screens in CSS px with their device ratio, and where the paused deck's buttons begin on the MAP page in each dress (measured in the shell). */
const PHONE = { w: 390, h: 844, dpr: 3, deck: { 1: 716, 2: 734 } }
const WIDE = { w: 844, h: 390, dpr: 3, deck: { 1: 322, 2: 332 } }
const DESK = { w: 1280, h: 800, dpr: 2, keys: true }
const SCREENS = [PHONE, WIDE, DESK]
const skinOf = density => (density === 2 ? Z.HIRES_WINDOW_SKIN : Z.NEON_SKIN)

/** The HUD's grid on a screen for a dress, as the renderer reckons it (`resize`, `hudSpace`). */
function grid(scr, density) {
  const W = Math.round(scr.w * scr.dpr)
  const H = Math.round(scr.h * scr.dpr)
  let scale = Math.max(1, Math.floor(Math.min(W / (13 * 16), H / (11 * 16))))
  while (W / scale > 30 * 16) scale++
  const hs = Z.hudScale(scale, W, H, density)
  const vw = Math.ceil(W / hs)
  const vh = Math.ceil(H / hs)
  const oy = Math.floor((H - vh * hs) / 2)
  const deck = scr.keys ? null : Math.floor((scr.deck[density] * scr.dpr - oy) / hs)
  return { vw, vh, css: hs / scr.dpr, deck, keys: scr.keys ? Z.KEYBOARD_KEYS : Z.TOUCH_KEYS }
}

/** The page of a game on a screen, in a dress (density) and a view (iso). */
function lay(s, scr = PHONE, density = 2, iso = true) {
  const g = grid(scr, density)
  const opts = { keys: g.keys, e: iso ? 1 : 0, css: g.css, deck: g.deck }
  return { ...g, ...Z.mapPageFor(Z.WORLD, s, g.vw, g.vh, opts, skinOf(density)) }
}

const viewsOf = id => [false, true].filter(iso => !Z.WORLD.maps[id].views || Z.WORLD.maps[id].views.includes(iso ? 'iso' : 'classic'))
const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const grow = (b, n) => ({ x: b.x - n, y: b.y - n, w: b.w + 2 * n, h: b.h + 2 * n })

/** A land's picture as the page paints it on a phone, with `marked` saying which fine px a mark or a pin lies over. */
function landOf(s, iso, density = 2) {
  const l = lay(s, PHONE, density, iso)
  const p = l.layout
  const pic = Z.landPicture(Z.WORLD, s, { iso, z: p.land.z, density, covered: Z.landCover(p) })
  const f = density
  // What may lie over the land: the marks and their ink and noses, and the pins with their ink.
  const over = [...pic.marks.map(b => grow(b, 2)), ...pic.pins.map(b => grow(b, 1))].map(b => ({ x: b.x * f, y: b.y * f, w: b.w * f, h: b.h * f }))
  const marked = (x, y) => over.some(b => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h)
  return { l, p, pic, marked, f }
}

// ---- the land and its places ----------------------------------------------------------------------------------

describe('the land on the page', () => {
  it('holds the whole map, every tile in its own ink, in each view; a view block is floor or wall as the view has it', () => {
    for (const id of charted()) {
      const s = farGone(game(id))
      const layer = Z.chartLayer(Z.WORLD, s)
      for (const iso of viewsOf(id)) {
        const { pic, marked } = landOf(s, iso)
        const shown = new Set()
        for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
          const t = pic.geometry.at(x, y)
          if (!t) continue
          const i = t[1] * layer.w + t[0]
          shown.add(i)
          if (!marked(x, y)) assert.equal(pic.px[y * pic.w + x], layer.px[i], `${id} ${iso} ${x},${y}`)
        }
        assert.equal(shown.size, layer.w * layer.h, `${id} ${iso ? 'iso' : 'square'}: ${shown.size} tiles of ${layer.w * layer.h}`)
      }
    }
    // The Turn Room: a square block is up in the 8-bit view, a diamond one in the isometric, and the chart (kept
    // from one look to the next) follows a turn.
    const s = farGone(game('turnroom'))
    const info = Z.mapInfo(Z.WORLD, 'turnroom')
    const inks = Z.chartInks(info.def)
    for (const side of ['flat', 'iso', 'flat']) {
      assert.equal(Z.setViewRule(s, side), true)
      const layer = Z.chartLayer(Z.WORLD, s)
      for (const [block, upIn] of [['□', 'flat'], ['◇', 'iso']]) {
        const row = [...info.base.keys()].filter(i => info.base[i] === block)
        assert.ok(row.length >= 10, `${block} in the Turn Room`)
        const want = upIn === side ? [inks.wall, inks.face] : [inks.ground, inks.ground2]
        for (const i of row) assert.ok(want.includes(layer.px[i]), `${block} in ${side}: ${layer.px[i]} at ${i % info.w},${Math.floor(i / info.w)}`)
      }
    }
  })

  it('pins each area seen by its number and lists it by name; an area not seen is ???', () => {
    for (const id of charted().filter(m => Z.WORLD.maps[m].areas?.length)) {
      const areas = Z.WORLD.maps[id].areas
      const info = Z.mapInfo(Z.WORLD, id)
      const half = game(id)
      Z.reveal(half, id, info.w, info.h, { x: 0, y: 0, w: Math.ceil(info.w / 2), h: info.h })
      for (const s of [game(id), half, farGone(game(id))]) {
        const content = Z.mapPageContent(Z.WORLD, s)
        assert.equal(content.places.length, areas.length)
        for (const [i, a] of areas.entries()) {
          const p = content.places[i]
          const middle = Z.seenTile(s, id, info.w, Math.floor(a.x + a.w / 2), Math.floor(a.y + a.h / 2))
          assert.equal(p.n, i + 1)
          assert.equal(p.seen, middle || s.area === a.name, `${id} ${a.name}`)
          // As authored, THE and all.
          assert.equal(p.name, p.seen ? a.name.toUpperCase() : '???')
          assert.equal(p.here, s.area === a.name)
        }
        const { pic } = landOf(s, viewsOf(id).includes(true))
        assert.deepEqual(pic.pins.map(p => p.n), content.places.filter(p => p.seen).map(p => p.n), `${id}: one pin an area seen`)
        assert.deepEqual(pic.pins.filter(p => p.here).map(p => p.n), content.places.filter(p => p.here).map(p => p.n))
      }
    }
  })

  it('tallies the chests opened and the heart pieces taken, and never tells of one that has not appeared', () => {
    const s = game('seterfell')
    const list = Z.mapInfo(Z.WORLD, 'seterfell').chestList
    assert.deepEqual(Z.chartTally(Z.WORLD, s).chests, [0, list.length])
    s.flags[`chest:${list[0].id}`] = true
    assert.deepEqual(Z.chartTally(Z.WORLD, s).chests, [1, list.length])
    const shrine = game('shrine', 'start')
    const all = Z.mapInfo(Z.WORLD, 'shrine').chestList
    const hidden = all.filter(c => c.appear)
    assert.ok(hidden.length > 0)
    assert.equal(Z.chartTally(Z.WORLD, shrine).chests[1], all.length - hidden.length)
    shrine.flags[`appear:${hidden[0].id}`] = true
    assert.equal(Z.chartTally(Z.WORLD, shrine).chests[1], all.length - hidden.length + 1)
    // A heart piece that waits for a flag.
    const heart = Z.mapInfo(Z.WORLD, 'overworld').marks.find(m => m.ent.t === 'item' && m.ent.item === 'heartPiece')
    const o = game('overworld')
    assert.deepEqual(Z.chartTally(Z.WORLD, o).hearts, [0, 1])
    const had = heart.ent.appear
    heart.ent.appear = { flag: 'test.never' }
    try {
      assert.deepEqual(Z.chartTally(Z.WORLD, o).hearts, [0, 0])
      assert.ok(!Z.mapPageContent(Z.WORLD, o).legend.some(e => e.kind === 'heart'))
      o.flags['test.never'] = true
      assert.deepEqual(Z.chartTally(Z.WORLD, o).hearts, [0, 1])
      delete o.flags['test.never']
      o.flags[`took:${heart.ent.id}`] = true
      assert.deepEqual(Z.chartTally(Z.WORLD, o).hearts, [1, 1])
    } finally {
      if (had) heart.ent.appear = had
      else delete heart.ent.appear
    }
  })
})

// ---- the world and the rooms ----------------------------------------------------------------------------------

const worldOf = s => Z.worldPicture(Z.WORLD, s, { k: 1, density: 2, here: Z.mapPageContent(Z.WORLD, s).world })
const inside = (pic, l) => { const out = []; for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) out.push(pic.px[y * pic.w + x]); return out }
const named = pic => Z.worldNames(Z.WORLD, pic, skinOf(2).font, 2).map(n => n.id).sort()

describe('the world on the page', () => {
  it('draws every land where it lies: the unwalked in fog with a ?, the hero\'s framed in gold with their pip, live, and dim at night', () => {
    const lands = Object.keys(Z.WORLD.atlas).sort()
    // A first look: the coast and the Wildwood are known always, the rest are fog, a ? and no name. (Seen squares
    // without the flag are no walk into a land.)
    const first = game('overworld')
    seeAll(first, 'yulefjord')
    const pic = worldOf(first)
    assert.deepEqual(pic.lands.map(l => l.id).sort(), lands)
    const known = ['overworld', 'wildwood']
    assert.deepEqual(pic.lands.filter(l => l.walked).map(l => l.id).sort(), known)
    assert.deepEqual(named(pic), known)
    const fog = new Set(['#1b1032', '#2a1d4e', Z.CORNER_SKIN.dim, Z.CORNER_SKIN.outline])
    for (const l of pic.lands) {
      assert.ok(inside(pic, l).every(Boolean), `${l.id} is drawn`)
      if (l.walked) continue
      for (const c of inside(pic, l)) assert.ok(fog.has(c), `${l.id}: ${c}`)
      assert.ok(inside(pic, l).includes(Z.CORNER_SKIN.dim), `${l.id}: the ?`)
    }
    // Standing in each land: its frame gold at the corners, the pink pip inside it, neither on any other.
    for (const id of lands) {
      const s = farGone(game(id))
      const w = worldOf(s)
      const l = w.lands.find(v => v.here)
      assert.equal(l.id, id)
      for (const [x, y] of [[l.x, l.y], [l.x + l.w - 1, l.y], [l.x, l.y + l.h - 1], [l.x + l.w - 1, l.y + l.h - 1]]) {
        assert.equal(w.px[y * w.w + x], Z.CORNER_SKIN.prize, `${id}: the corner ${x},${y}`)
      }
      const p = w.pip
      assert.ok(p.x > l.x && p.y > l.y && p.x + p.w < l.x + l.w && p.y + p.h < l.y + l.h, `${id}: the pip ${p.x},${p.y} in ${l.x},${l.y} ${l.w}×${l.h}`)
      assert.ok(inside(w, p).includes(Z.CORNER_SKIN.hot), `${id}: pink`)
      for (const other of w.lands.filter(v => !v.here)) {
        assert.ok(other.walked, other.id)
        assert.ok(!inside(w, other).includes(Z.CORNER_SKIN.prize) && !inside(w, other).includes(Z.CORNER_SKIN.hot), `${id}: gold or pink on ${other.id}`)
      }
    }
    // The hero's land from the live tiles (a pool where there was none), the others as they were made.
    const s = farGone(game('seterfell'))
    const info = Z.mapInfo(Z.WORLD, 'seterfell')
    const before = worldOf(s)
    for (let y = 20; y < 26; y++) for (let x = 20; x < 26; x++) s.map.tiles[y * info.w + x] = '~'
    const after = worldOf(s)
    const l = after.lands.find(v => v.id === 'seterfell')
    const spot = (l.y + 23) * after.w + l.x + 23
    assert.notEqual(after.px[spot], before.px[spot])
    assert.equal(after.px[spot], Z.chartInks(info.def).water)
    assert.equal(worldOf(farGone(game('overworld'))).px[spot], before.px[spot], 'seen from another land it is the made one')
    // It dims with the land's chart at night, and not before the Prism.
    const luma = c => { const v = parseInt(c.slice(1), 16); return ((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114 }
    const mean = w => { const px = inside(w, w.lands.find(v => v.id === 'stillsand')); return px.reduce((a, c) => a + luma(c), 0) / px.length }
    const day = farGone(game('seterfell'))
    const levels = []
    for (const [t, n] of [[580, 0], [120, 1], [230, 2], [null, 0]]) {
      day.daytime = t
      assert.equal(Z.mapPageContent(Z.WORLD, day).world.night, n, `daytime ${t}`)
      const w = worldOf(day)
      levels.push(mean(w))
      const road = Z.dimInk(Z.chartInks(info.def).road, n)
      assert.ok(Z.chartLayer(Z.WORLD, day).px.includes(road), `daytime ${t}: the land`)
      assert.ok(inside(w, w.lands.find(v => v.here)).includes(road), `daytime ${t}: the world`)
    }
    assert.ok(levels[0] > levels[1] && levels[1] > levels[2] && levels[3] === levels[0], levels.join(' '))
  })

  it('names every room and the land outside it, with the hero at its door on the world', () => {
    assert.ok(rooms().length >= 14)
    for (const id of rooms()) {
      const out = Z.outsideOf(Z.WORLD, id)
      assert.ok(out, `${id}: a land outside`)
      assert.ok(Z.WORLD.atlas[out.map], `${id}: on the grid`)
      const warp = Z.mapInfo(Z.WORLD, id).warps[0]
      const door = Z.mapInfo(Z.WORLD, out.map).entries[warp.entry]
      assert.ok(door, `${id}: its door leads to no entry ${warp.entry} of ${warp.to}`)
      assert.deepEqual([out.map, out.x, out.y], [warp.to, door.x, door.y], id)
      const s = game(id)
      const c = Z.mapPageContent(Z.WORLD, s)
      assert.equal(c.land, null)
      assert.equal(c.title, Z.WORLD.maps[id].name.toUpperCase())
      assert.equal(c.sub, `OUTSIDE: ${Z.WORLD.maps[out.map].name.toUpperCase().replace(/^THE /, '')}`)
      assert.deepEqual([c.places, c.legend], [[], []])
      assert.deepEqual([c.world.map, c.world.x, c.world.y], [out.map, door.x, door.y])
      assert.equal(worldOf(s).lands.find(l => l.here).id, out.map)
      // And no world before the blade.
      s.inv.sword = false
      assert.equal(Z.mapPageContent(Z.WORLD, s).world, null)
    }
    assert.equal(Z.mapPageContent(Z.WORLD, game('fellcave')).sub, 'OUTSIDE: SETER FELL')
  })
})

// ---- the painter ----------------------------------------------------------------------------------------------

/** `drawMapPage` on a stand-in context that keeps the colour each fine px ends in (`px`, row by row, `wide` to a row), and what was written where. */
function paint(s, scr, density, iso) {
  const g = grid(scr, density)
  const wide = g.vw * density
  const tall = g.vh * density
  const px = new Array(wide * tall)
  const words = []
  let fill = ''
  const ctx = new Proxy({}, {
    get: (_, k) => k === 'fillRect' ? (x, y, w, h) => {
      // (The veil, over the whole page, is where the picture starts.)
      if (w >= g.vw && h >= g.vh) { px.fill(undefined); return }
      const x0 = Math.max(0, Math.round(x * density))
      const x1 = Math.min(wide, Math.round((x + w) * density))
      for (let j = Math.max(0, Math.round(y * density)); j < Math.round((y + h) * density); j++) if (x1 > x0) px.fill(fill, j * wide + x0, j * wide + x1)
    } : k === 'fillStyle' ? fill : () => {},
    set: (_, k, v) => { if (k === 'fillStyle') fill = v; return true },
  })
  const width = skinOf(density).font?.width ?? Z.textWidth
  const font = { width, wrap: t => [t], draw: (_, text, x, y, color) => words.push({ text, x, y, w: width(text), h: 7, color }) }
  const skin = { ...skinOf(density), font }
  const opts = { keys: g.keys, e: iso ? 1 : 0, css: g.css, deck: g.deck }
  Z.drawMapPage(ctx, Z.WORLD, s, g.vw, g.vh, opts, skin)
  return { ...g, px, wide, words, ...Z.mapPageFor(Z.WORLD, s, g.vw, g.vh, opts, skin) }
}

/** Every px of the hero's mark and its ink lies on the painted page as it was drawn; returns the land's picture. */
function heroShows(s, page, iso, density, where) {
  const p = page.layout
  const pic = Z.landPicture(Z.WORLD, s, { iso, z: p.land.z, density, covered: Z.landCover(p) })
  const { art, x, y } = pic.hero
  let pink = 0
  for (let j = 0; j < art.h; j++) for (let i = 0; i < art.w; i++) {
    const c = art.px[j * art.w + i]
    if (!c) continue
    if (c === Z.CORNER_SKIN.hot) pink++
    for (let b = 0; b < density; b++) for (let a = 0; a < density; a++) {
      const got = page.px[((p.land.y + y + j) * density + b) * page.wide + (p.land.x + x + i) * density + a]
      if (got !== c) assert.fail(`${where}: the hero at ${i},${j} shows ${got}, not ${c}`)
    }
  }
  assert.ok(pink >= 6, `${where}: the hero is drawn (${pink})`)
  return pic
}

describe('the MAP page, painted', () => {
  it('never covers the hero, whatever stands near them: no mark, pin, plate or Prism', () => {
    let under = 0
    /** Stands the hero on a tile, paints the page, and looks at every px of their mark. */
    function stand(s, x, y, [scr, density, iso], area) {
      s.hero.x = x + 0.5
      s.hero.y = y + 0.5
      s.area = area ?? s.area
      const page = paint(s, scr, density, iso)
      const p = page.layout
      const where = `${s.map.id} ${x},${y} ${scr.w}×${scr.h}${iso ? ' iso' : ''}`
      const pic = heroShows(s, page, iso, density, where)
      // The mark in its ring, on the page: no pin lies on it, and the plate keeps off it.
      for (const pin of pic.pins) assert.ok(!meets(grow(pin, 1), pic.hero), `${where}: pin ${pin.n}`)
      const mark = { x: p.land.x + pic.hero.x, y: p.land.y + pic.hero.y, w: pic.hero.w, h: pic.hero.h }
      if (iso) assert.ok(!meets(mark, p.plate), `${where}: under the plate`)
      if (iso && meets(mark, p.gem)) under++
    }
    const phone = [PHONE, 2, true]
    // A grid over five lands, the three screens taken in turn (the upright one also in the 8-bit view).
    let n = 0
    for (const id of ['overworld', 'wildwood', 'seterfell', 'yulefjord', 'stillsand']) {
      const info = Z.mapInfo(Z.WORLD, id)
      const s = farGone(game(id))
      const screens = [phone, [PHONE, 1, false], [WIDE, 2, true]].filter(screen => viewsOf(id).includes(screen[2]))
      for (let y = 2; y < info.h; y += 18) for (let x = 2; x < info.w; x += 18) stand(s, x, y, screens[n++ % screens.length])
    }
    // In the middle of each area of a land, where its pin wants to be.
    const rerun = farGone(game('rerun'))
    for (const a of Z.WORLD.maps.rerun.areas) stand(rerun, Math.floor(a.x + a.w / 2), Math.floor(a.y + a.h / 2), phone, a.name)
    // Under the Prism, and where its plate would hang.
    const before = under
    for (const [id, x, y] of [['rerun', 77, 2], ['stillsand', 84, 3], ['lumenby', 80, 2], ['seterfell', 69, 4]]) stand(farGone(game(id)), x, y, phone)
    assert.ok(under - before >= 2, `${under - before} of them under the Prism`)
    const fog = farGone(game('fogstage'))
    for (const [x, y] of [[85, 20], [80, 10], [70, 30]]) stand(fog, x, y, phone)
  })

  it('says the land, the area, the places, the tallies and the world; fog where not walked, gold in a set sign\'s socket', () => {
    const s = farGone(game('seterfell', 'camp'))
    const said = (game, scr = PHONE) => paint(game, scr, 2, true).words.map(w => w.text)
    const phone = said(s)
    for (const t of ['SETER FELL', s.area, 'CAIRN RIDGE', 'THE FELL ROAD', 'YOU', 'DOORS', 'PASSES', 'CHESTS 0/3', 'THE WORLD', 'FELL']) assert.ok(phone.includes(t), `${t} in ${phone}`)
    assert.ok(!phone.includes('ESC RESUME'))
    const desk = said(s, DESK)
    assert.ok(desk.includes('ESC RESUME'), 'on keys, how to go on')
    for (const list of [phone, desk]) assert.ok(!list.some(t => /^V(IEW)? /.test(t) || t.includes('NO MAP')), list.join(' | '))
    assert.ok(said(game('hut')).includes('KEEPER\'S HUT'))
    // No world before the blade.
    const bladeless = game('overworld')
    bladeless.inv.sword = false
    assert.ok(!said(bladeless).includes('THE WORLD'))
    // The tally counts as the chests are opened.
    const coast = farGone(game('overworld'))
    coast.flags[`chest:${Z.mapInfo(Z.WORLD, 'overworld').chestList[0].id}`] = true
    const words = said(coast)
    for (const t of ['CHESTS 1/4', 'HEARTS 0/1', 'DOORS', 'PASSES']) assert.ok(words.includes(t), `${t} in ${words}`)

    /** The painted colours inside the land's box. */
    const land = game => {
      const page = paint(game, PHONE, 2, true)
      const b = page.layout.land
      const out = []
      for (let y = b.y * 2; y < (b.y + b.h) * 2; y++) for (let x = b.x * 2; x < (b.x + b.w) * 2; x++) out.push(page.px[y * page.wide + x])
      return { out, words: page.words.map(w => w.text) }
    }
    // A land just arrived in lies mostly in fog, painted in the land's own two fog inks.
    const fresh = game('seterfell', 'camp')
    const fog = Object.values(Z.fogInks(Z.chartInks(Z.WORLD.maps.seterfell)))
    const share = g => { const { out } = land(g); return out.filter(c => fog.includes(c)).length / out.length }
    assert.ok(share(fresh) > 0.25, `${share(fresh)} of a fresh land in fog`)
    assert.ok(share(s) < 0.05, `${share(s)} of a walked land in fog`)
    // A sign set in Lumenby: its socket turns gold on the land, and the legend counts it.
    const lum = farGone(game('lumenby'))
    const gold = () => land(lum).out.filter(c => c === Z.CORNER_SKIN.prize).length
    const dark = gold()
    lum.flags['q.lumenby.sign1'] = true
    assert.ok(gold() > dark, `${gold()} gold px with the sign set, ${dark} without`)
    assert.ok(land(lum).words.includes('SIGN 1/7'), land(lum).words.join(' | '))
  })

  it('writes no name over the land, and nothing under the deck', () => {
    for (const id of ['overworld', 'seterfell', 'stillsand', 'lumenby', 'underglow2', 'hut']) {
      const s = Z.charted(Z.WORLD.maps[id]) ? farGone(game(id)) : game(id)
      for (const scr of SCREENS) {
        const iso = viewsOf(id).includes(true)
        const page = paint(s, scr, 2, iso)
        const p = page.layout
        const bottom = page.opts.bottom
        for (const w of page.words) assert.ok(w.y + w.h <= bottom + 0.5 && w.x >= -1 && w.x + w.w <= page.vw + 1, `${id} ${scr.w}: "${w.text}"`)
        assert.ok(page.px.slice(bottom * 2 * page.wide).every(c => c === undefined), `${id} ${scr.w}: painted under the deck`)
        if (!p.land) continue
        const pic = Z.landPicture(Z.WORLD, s, { iso, z: p.land.z, density: 2 })
        for (const w of page.words) {
          for (let y = Math.floor(w.y * 2); y < (w.y + w.h) * 2; y++) for (let x = Math.floor(w.x * 2); x < (w.x + w.w) * 2; x++) {
            assert.ok(!pic.geometry.at(x - p.land.x * 2, y - p.land.y * 2), `${id} ${scr.w}: "${w.text}" lies on the land`)
          }
        }
      }
    }
  })
})
