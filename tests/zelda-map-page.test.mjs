// The menu's MAP page (`themes/zelda/render/mapPage.ts`): where its parts go on every screen the game is played on,
// what the land's chart and the world's chart look like, the pins and the list of places, the tally of what is left
// to find, the rooms indoors, and what the painter draws. No canvas: the layout and the pictures are pure, and the
// painter is run on a stand-in context that keeps its pixels.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
      contents: `export { WORLD } from './world/index'; export { createGame } from './engine/index'; export { enterMap } from './engine/game'; export { mapInfo } from './engine/map'; export { charted, reveal, seenTile, CHUNK } from './engine/explore'; export { DAY } from './engine/day'; export * from './render/mapPage'; export { CHART_INKS, WORLD_SHORT, chartInks, chartLayer, chartMarks, chartTally, fogInks, dimInk, landPasses } from './render/worldMap'; export { CORNER_SKIN, GEM_ART, pinName, renderCorner } from './render/corner'; export { hudScale, NEON_SKIN, HIRES_WINDOW_SKIN } from './render/hud'; export { TOUCH_KEYS, KEYBOARD_KEYS } from './keys'; export { oneViewWords } from './render/corner'; export { textWidth } from '../base/pixel/font'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
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
const SCREENS = [
  { w: 390, h: 844, dpr: 3, deck: { 1: 716, 2: 734 } },
  { w: 390, h: 844, dpr: 2, deck: { 1: 716, 2: 734 } },
  { w: 375, h: 667, dpr: 2, deck: { 1: 539, 2: 557 } },
  { w: 360, h: 640, dpr: 2, deck: { 1: 512, 2: 530 } },
  { w: 360, h: 640, dpr: 3, deck: { 1: 512, 2: 530 } },
  { w: 844, h: 390, dpr: 3, deck: { 1: 322, 2: 332 } },
  { w: 667, h: 375, dpr: 2, deck: { 1: 307, 2: 317 } },
  { w: 1280, h: 800, dpr: 1, keys: true },
  { w: 1280, h: 800, dpr: 2, keys: true },
]
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
function lay(s, scr, density, iso) {
  const g = grid(scr, density)
  const opts = { keys: g.keys, e: iso ? 1 : 0, css: g.css, deck: g.deck }
  const made = Z.mapPageFor(Z.WORLD, s, g.vw, g.vh, opts, skinOf(density))
  return { ...g, ...made, bottom: made.opts.bottom }
}

const viewsOf = id => [false, true].filter(iso => !Z.WORLD.maps[id].views || Z.WORLD.maps[id].views.includes(iso ? 'iso' : 'classic'))
const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const grow = (b, n) => ({ x: b.x - n, y: b.y - n, w: b.w + 2 * n, h: b.h + 2 * n })

/** Every part's box by name. */
function boxes(p) {
  const out = [['tabs', p.tabs], ['title', p.title]]
  for (const k of ['land', 'gem', 'plate', 'cap', 'stub', 'places', 'legend', 'world', 'last']) if (p[k]) out.push([k, p[k]])
  for (const [i, c] of (p.world?.caption ?? []).entries()) out.push([`caption ${i}`, c])
  return out
}

/** The page's rules, whatever the screen: on it, above the deck, whole px, nothing over anything else, given up in order. */
function check(l, where) {
  const p = l.layout
  const o = l.opts
  const f = o.density
  for (const [name, b] of boxes(p)) {
    const at = `${where}: ${name} ${b.x},${b.y} ${b.w}×${b.h} on ${l.vw}×${l.vh}, bottom ${l.bottom}`
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= l.vw && b.y + b.h <= l.bottom, at)
    for (const v of [b.x, b.y, b.w, b.h]) assert.ok(Number.isInteger(v * f), `${at}: not whole px of its grid`)
  }
  // (The caption may lie in the chart's empty corner, the Prism on the land's corner.)
  const list = boxes(p).filter(([n]) => !n.startsWith('caption'))
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const [a, A] = list[i]
      const [b, B] = list[j]
      if (a === 'land' && b === 'gem') continue
      // (On the diamond the plate and the cap hang in the empty corner of the land's box: held clear of its picture below.)
      if (o.iso && a === 'land' && (b === 'plate' || b === 'cap')) continue
      assert.ok(!meets(A, B), `${where}: ${a} over ${b}`)
    }
  }
  for (const e of [...(p.places?.entries ?? []), ...(p.legend?.entries ?? [])]) assert.ok(e.x >= 0 && e.x + e.w <= l.vw && e.y + 7 <= l.bottom, `${where}: an entry off the page`)
  const entries = p.places?.entries ?? []
  for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
    assert.ok(!meets({ ...entries[i], h: 11 }, { ...entries[j], h: 11 }), `${where}: two places over each other`)
  }
  for (const c of p.world?.caption ?? []) {
    const grid0 = Z.atlasBox(Z.WORLD)
    for (const r of grid0.rects) {
      const land = { x: p.world.x + (r.x - grid0.x0) / p.world.k / f, y: p.world.y + (r.y - grid0.y0) / p.world.k / f, w: r.w / p.world.k / f, h: r.h / p.world.k / f }
      assert.ok(!meets(c, land), `${where}: the caption over ${r.id}`)
    }
  }
  assert.ok(p.title.w > 0, `${where}: nothing laid out, ${l.vw}x${l.vh} bottom ${l.bottom}`)
  // The words go only after the list, the world only after both. (The names may be gone with the list still there:
  // where the screen is too narrow ever to hold them. 'gives the list up before the world\'s names' holds that.)
  const has = { places: o.content.places.length > 0, words: o.content.legend.length > 0, world: !!o.content.world }
  if (p.gave.includes('words') && has.places) assert.ok(p.gave.includes('places'), `${where}: ${p.gave}: the words before the list`)
  if (p.gave.includes('world')) for (const part of ['places', 'words']) if (has[part]) assert.ok(p.gave.includes(part), `${where}: ${p.gave}: the world before the ${part}`)
  assert.equal(p.gave.includes('names'), !!p.world && p.world.k > 2 / f, `${where}: ${p.gave}, the world at ${p.world?.k} tiles a px`)
  assert.deepEqual(p.gave, Z.GIVE_WAY.filter(g => p.gave.includes(g)), `${where}: ${p.gave}`)
  assert.equal(!!p.places, has.places && !p.gave.includes('places'), `${where}: places`)
  assert.equal(!!p.world, has.world && !p.gave.includes('world'), `${where}: world`)
  assert.equal(!!p.last, o.keys, `${where}: the last line is the keys'`)
  assert.equal(!!p.legend, o.content.legend.length > 0, `${where}: the legend's glyphs always stay`)
}

// ---- the HUD ------------------------------------------------------------------------------------------------

describe('the MAP page and the HUD', () => {
  const r = readFileSync(join(root, 'render/renderer.ts'), 'utf8')

  it('draws no hearts, counters or item box on the MAP page, and all of them on every other', () => {
    // One question, asked once: is the MAP page up? (Not on ITEMS or MOVES, in play, or while asking to start over.)
    assert.match(r, /const mapUp = ui\.paused && ui\.page === 'map' && !ui\.confirmReset\s*if \(hud && !mapUp\) \{\s*g\.save\(\)\s*g\.translate\(left, top\)\s*drawHud\(/)
    assert.equal(r.split('drawHud(').length - 1, 1, 'the HUD is drawn in one place')
    assert.equal(r.split('const mapUp').length - 1, 1)
    // The paused picture is painted again when the menu opens, closes or turns its page, so the HUD is back at once.
    const shell = readFileSync(join(root, 'Zelda.vue'), 'utf8')
    for (const fn of ['openPage', 'togglePause']) assert.match(shell.slice(shell.indexOf(`function ${fn}(`)).slice(0, 700), /pausedDrawn = false/, fn)
  })

  it('stands its tabs at the top of the page, with a small margin, on every screen', () => {
    for (const id of Object.keys(Z.WORLD.maps)) {
      for (const scr of SCREENS) {
        for (const density of [1, 2]) {
          const s = Z.charted(Z.WORLD.maps[id]) ? farGone(game(id)) : game(id)
          const l = lay(s, scr, density, density === 2)
          assert.ok(l.layout.tabs.y === 4 || l.layout.tabs.y === 2, `${id} ${scr.w}×${scr.h} density ${density}: ${l.layout.tabs.y}`)
          // Under them, what is left is shared: as much over the page's body as under it, on an upright screen.
          const p = l.layout
          if (p.wide || p.last) continue
          const over = p.title.y - (p.tabs.y + p.tabs.h)
          const under = l.bottom - Math.max(...boxes(p).map(([, b]) => b.y + b.h))
          assert.ok(Math.abs(over - under) <= 12, `${id} ${scr.w}×${scr.h} density ${density}: ${over} over, ${under} under`)
        }
      }
    }
  })

  it('has the rows for the list of places on every upright phone but one', () => {
    const without = []
    for (const id of Object.keys(Z.WORLD.atlas)) {
      const s = farGone(game(id))
      for (const scr of SCREENS.filter(v => v.w < v.h)) {
        for (const density of [1, 2]) {
          if (!viewsOf(id).includes(density === 2)) continue
          if (!lay(s, scr, density, density === 2).layout.places) without.push(`${id} ${scr.w} ${density}`)
        }
      }
    }
    // Stillsand's eight areas on a 375 × 667 phone in the isometric view.
    assert.deepEqual(without, ['stillsand 375 2'])
  })
})

// ---- the layout ---------------------------------------------------------------------------------------------

describe('the MAP page on a screen', () => {
  it('fits every charted map, in both views it allows and both dresses\' grids, over the deck', () => {
    for (const id of charted()) {
      const states = [game(id), farGone(game(id))]
      for (const scr of SCREENS) {
        for (const density of [1, 2]) {
          for (const iso of viewsOf(id)) {
            for (const [n, s] of states.entries()) {
              const where = `${id} ${scr.w}×${scr.h}@${scr.dpr} density ${density} ${iso ? 'iso' : 'square'} ${n ? 'all seen' : 'arrived'}`
              const l = lay(s, scr, density, iso)
              check(l, where)
              const p = l.layout
              assert.ok(p.land, `${where}: the land never goes`)
              // Never less than the corner's one L a tile, whole fine px a tile, and the whole map in its box.
              assert.ok(Number.isInteger(p.land.z) && p.land.z >= density, `${where}: z ${p.land.z}`)
              const geo = Z.landGeometry(Z.mapInfo(Z.WORLD, id), p.land.z, iso, density)
              assert.deepEqual([p.land.w * density, p.land.h * density], [geo.w, geo.h], where)
              assert.ok(p.gem && p.plate, `${where}: the Prism and its plate`)
              // The Prism's box, where it will be a target.
              const hit = p.gemHit
              assert.ok(hit.w * l.css >= 44 - 1e-9 && hit.h * l.css >= 44 - 1e-9, `${where}: the target ${hit.w * l.css}×${hit.h * l.css}`)
              assert.ok(hit.x >= 0 && hit.y >= p.tabs.y + p.tabs.h && hit.x + hit.w <= l.vw && hit.y + hit.h <= l.bottom, `${where}: the target off the page`)
              for (const part of ['places', 'legend', 'world', 'last']) if (p[part]) assert.ok(!meets(hit, p[part]), `${where}: the target over ${part}`)
            }
          }
        }
      }
    }
  })

  it('shows every part on a 390 × 844 phone, the world a tile a fine px in the 16-bit dress and two a px in the 8-bit one', () => {
    for (const id of Object.keys(Z.WORLD.atlas)) {
      const s = farGone(game(id))
      for (const scr of SCREENS.slice(0, 2)) {
        for (const [density, iso] of [[2, true], [1, false]]) {
          if (!viewsOf(id).includes(iso)) continue
          const p = lay(s, scr, density, iso).layout
          assert.deepEqual(p.gave, [], `${id} @${scr.dpr} density ${density}`)
          assert.equal(p.world.k, density === 2 ? 1 : 2)
          assert.ok(!p.wide)
        }
      }
    }
  })

  it('puts the land left with the legend under it, the world and the list in a column at the right, on a wide screen', () => {
    for (const id of Object.keys(Z.WORLD.atlas)) {
      const s = farGone(game(id))
      for (const scr of SCREENS.filter(v => v.w > v.h)) {
        for (const density of [1, 2]) {
          for (const iso of viewsOf(id).filter(v => v === (density === 2) || viewsOf(id).length === 1)) {
            const p = lay(s, scr, density, iso).layout
            const where = `${id} ${scr.w}×${scr.h} density ${density}`
            assert.ok(p.wide)
            assert.ok(p.legend.y >= p.land.y + p.land.h, `${where}: the legend under the land`)
            assert.ok(p.title.y + p.title.h <= p.legend.y)
            for (const part of [p.places, p.world]) {
              if (!part) continue
              assert.ok(part.x >= p.land.x + p.land.w, `${where}: the column right of the land`)
              assert.ok(part.x >= p.legend.x + p.legend.w, `${where}: the column right of the legend`)
            }
            if (p.world && p.places) assert.ok(p.places.y >= p.world.y + p.world.h, `${where}: the list under the world`)
          }
        }
      }
    }
  })

  it('names the world on a wide screen wherever the list and a third of the land can make room for it', () => {
    const named = (id, scr, density) => {
      const l = lay(farGone(game(id)), scr, density, density === 2)
      return l.layout.world.k === 2 / density
    }
    const [wide844, wide667, desk] = [SCREENS[5], SCREENS[6], SCREENS[7]]
    for (const id of Object.keys(Z.WORLD.atlas)) {
      for (const density of [1, 2]) {
        if (!viewsOf(id).includes(density === 2)) continue
        assert.ok(named(id, wide844, density), `${id} 844 density ${density}`)
      }
      // 667 wide, isometric: every land but the coast, which is too wide to leave 182 px beside it.
      assert.equal(named(id, wide667, 2), id !== 'overworld', `${id} 667`)
    }
    // The desktop's grid is 320 wide: four lands of the middle width have the room.
    assert.deepEqual(Object.keys(Z.WORLD.atlas).filter(id => named(id, desk, 2)).sort(), ['lumenby', 'rerun', 'seterfell', 'stillsand'])
    for (const room of ['hut', 'fellcave']) assert.equal(lay(game(room), desk, 2, true).layout.world.k, 1)
  })

  it('gives the list up before the world\'s names', () => {
    let kept = 0
    let narrow = 0
    let listFirst = 0
    for (const id of Object.keys(Z.WORLD.atlas)) {
      const s = farGone(game(id))
      for (const scr of SCREENS) {
        for (const density of [1, 2]) {
          for (const iso of viewsOf(id)) {
            const l = lay(s, scr, density, iso)
            const p = l.layout
            const where = `${id} ${scr.w}×${scr.h}@${scr.dpr} density ${density} ${iso}: ${p.gave}`
            if (p.gave.includes('places') && !p.gave.includes('names') && p.world) listFirst++
            if (!p.gave.includes('names')) continue
            narrow++
            if (!p.places && p.gave.includes('words')) continue
            kept++
            // The list (or the words) still on a page without names: only where giving them up would not bring the names back.
            const bare = { ...l.opts.content, places: [], legend: l.opts.content.legend.map(e => ({ ...e, word: '' })) }
            const without = Z.mapPageLayout(l.vw, l.vh, { ...l.opts, content: bare }, Z.atlasBox(Z.WORLD))
            assert.ok(!without.world || without.gave.includes('names'), `${where}: the names were there for the list's rows`)
          }
        }
      }
    }
    assert.ok(narrow > 20 && kept > 20 && listFirst > 5, `${narrow} without names, ${kept} of them with the list or its words, ${listFirst} that gave the list up for them`)
  })

  it('gives the world up last of all, after the list, the words and the names', () => {
    // (Upright: on a wide page the land's side runs out of rows before the column does.)
    for (const [scr, density] of [[SCREENS[0], 2], [SCREENS[0], 1], [SCREENS[4], 2]]) {
      const l = lay(farGone(game('seterfell')), scr, density, density === 2)
      const seen = []
      // The deck creeps up the screen until the world no longer fits.
      for (let bottom = l.bottom; bottom >= 90; bottom--) {
        const p = Z.mapPageLayout(l.vw, l.vh, { ...l.opts, bottom }, Z.atlasBox(Z.WORLD))
        check({ ...l, bottom, layout: p }, `squeezed to ${bottom} of ${l.vw}×${l.vh}`)
        if (!seen.includes(p.gave.join(','))) seen.push(p.gave.join(','))
        if (p.gave.includes('world')) break
      }
      const last = seen.at(-1).split(',')
      assert.ok(last.includes('world') && last.includes('places') && last.includes('words'), `${scr.w}×${scr.h} density ${density}: ${seen.join(' | ')}`)
      // And before it went, the list had gone with the world still there.
      assert.ok(seen.some(g => g.includes('places') && !g.includes('world')), seen.join(' | '))
    }
    // On the upright phone each step is seen in turn.
    const l = lay(farGone(game('seterfell')), SCREENS[0], 2, true)
    const steps = new Set()
    for (let bottom = l.bottom; bottom >= 90; bottom--) steps.add(Z.mapPageLayout(l.vw, l.vh, { ...l.opts, bottom }, Z.atlasBox(Z.WORLD)).gave.join(','))
    // (The words free no row here until the world is smaller too, so that step is passed over.)
    for (const step of ['', 'places', 'places,words,names', 'places,words,world']) assert.ok(steps.has(step), `${step || 'everything'} in ${[...steps].join(' | ')}`)
  })

  it('gives the land the most px a tile its box holds', () => {
    // Seter Fell on a 390 phone, isometric: 124 tiles across at 3 px is 372 of 390; at 4 it would not fit.
    assert.equal(lay(game('seterfell'), SCREENS[0], 2, true).layout.land.z, 3)
    // The coast is the widest land.
    assert.equal(lay(game('overworld'), SCREENS[0], 2, true).layout.land.z, 2)
    // Off the grid there is no list and no world: the rest in the middle of the page, not stretched over it.
    const l = lay(game('underglow2'), SCREENS[0], 2, true)
    const p = l.layout
    assert.equal(p.places, null)
    assert.equal(p.world, null)
    const above = p.title.y - (p.tabs.y + p.tabs.h)
    const below = l.bottom - (p.legend.y + p.legend.h)
    assert.ok(p.legend.y - (p.land.y + p.land.h) <= 20, 'the legend close under the land')
    assert.ok(Math.abs(above - below) <= 30, `centred: ${above} over, ${below} under`)
  })

  it('keeps inside the safe area of a notched phone, upright and on its side', () => {
    for (const [scr, safe] of [[SCREENS[0], { top: 24, left: 0, right: 0 }], [SCREENS[5], { top: 0, left: 24, right: 24 }]]) {
      for (const density of [1, 2]) {
        for (const id of ['overworld', 'seterfell', 'fogstage', 'underglow2', 'hut']) {
          const s = Z.charted(Z.WORLD.maps[id]) ? farGone(game(id)) : game(id)
          const g = grid(scr, density)
          // (The home indicator lifts the deck.)
          const l = Z.mapPageFor(Z.WORLD, s, g.vw, g.vh, { keys: g.keys, e: density === 2 ? 1 : 0, css: g.css, deck: g.deck - 12, safe }, skinOf(density))
          const where = `${id} ${scr.w} density ${density}`
          check({ ...g, ...l, bottom: l.opts.bottom }, where)
          for (const [name, b] of boxes(l.layout)) assert.ok(b.x >= safe.left && b.x + b.w <= g.vw - safe.right && b.y >= safe.top, `${where}: ${name} in the notch ${b.x},${b.y}`)
        }
      }
    }
  })

  it('has no world before the blade', () => {
    const s = game('overworld')
    s.inv.sword = false
    for (const scr of SCREENS) {
      const l = lay(s, scr, 2, true)
      check(l, `before the blade ${scr.w}`)
      assert.equal(l.opts.content.world, null)
      assert.equal(l.layout.world, null)
      assert.ok(!l.layout.gave.includes('world'))
    }
  })

  it('pins the Prism by the corner\'s own one-view rule', () => {
    for (const id of charted()) {
      const p = lay(game(id), SCREENS[0], 2, true).layout
      const pin = Z.pinName(Z.WORLD.maps[id])
      assert.equal(p.plate.text, pin ? 'ISO ONLY' : 'ISO', id)
      assert.equal(!!p.chain, !!pin, id)
    }
    assert.equal(lay(game('seterfell'), SCREENS[0], 1, false).layout.plate.text, '8-BIT')
    const src = readFileSync(join(root, 'render/mapPage.ts'), 'utf8')
    assert.match(src, /pin: pinName\(def, round\)/)
    assert.doesNotMatch(src, /\.views\b/, 'no second copy of the rule')
  })

  it('has a V cap beside the Prism on keys, none on touch and none where it is pinned', () => {
    const desk = SCREENS[7]
    assert.ok(lay(game('seterfell'), desk, 2, true).layout.cap)
    assert.ok(lay(game('seterfell'), desk, 1, false).layout.cap)
    assert.equal(lay(game('stillsand'), desk, 2, true).layout.cap, null)
    assert.equal(lay(game('seterfell'), SCREENS[0], 2, true).layout.cap, null)
  })
})

// ---- the land's picture -----------------------------------------------------------------------------------------

/** A land's picture as the page paints it, with the boxes of what lies on it in fine px. */
function landOf(s, iso, density = 2, scr = SCREENS[0]) {
  const l = lay(s, scr, density, iso)
  const p = l.layout
  const covered = Z.landCover(p)
  const pic = Z.landPicture(Z.WORLD, s, { iso, z: p.land.z, density, covered })
  const f = density
  // What may lie over the land: the marks and their ink and noses, and the pins with their ink.
  const over = [...pic.marks.map(b => grow(b, 2)), ...pic.pins.map(b => grow(b, 1))].map(b => ({ x: b.x * f, y: b.y * f, w: b.w * f, h: b.h * f }))
  const marked = (x, y) => over.some(b => x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h)
  return { l, p, pic, covered, marked, f }
}

describe('the land on the page', () => {
  it('holds the whole map, every tile in its own ink, in both views', () => {
    for (const id of charted()) {
      const s = farGone(game(id))
      const layer = Z.chartLayer(Z.WORLD, s)
      for (const iso of viewsOf(id)) {
        for (const density of [1, 2]) {
          const { pic, marked } = landOf(s, iso, density)
          const shown = new Set()
          for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
            const t = pic.geometry.at(x, y)
            if (!t) continue
            const i = t[1] * layer.w + t[0]
            shown.add(i)
            if (!marked(x, y)) assert.equal(pic.px[y * pic.w + x], layer.px[i], `${id} ${iso} ${x},${y}`)
          }
          assert.equal(shown.size, layer.w * layer.h, `${id} ${iso ? 'iso' : 'square'} density ${density}: ${shown.size} tiles of ${layer.w * layer.h}`)
        }
      }
    }
  })

  it('lies in the isometric view as the corner\'s diamond does: east down and to the right, south down and to the left', () => {
    const g = Z.landGeometry({ w: 40, h: 20 }, 4, true, 2)
    const o = g.to(10, 10)
    assert.deepEqual([g.to(11, 10)[0] - o[0], g.to(11, 10)[1] - o[1]], [4, 2])
    assert.deepEqual([g.to(10, 11)[0] - o[0], g.to(10, 11)[1] - o[1]], [-4, 2])
    const flat = Z.landGeometry({ w: 40, h: 20 }, 4, false, 2)
    assert.deepEqual(flat.to(11, 10), [flat.to(10, 10)[0] + 4, flat.to(10, 10)[1]])
  })

  it('is fog where not walked, and not the veil', () => {
    for (const id of ['seterfell', 'overworld', 'stillsand', 'underglow2']) {
      const s = game(id)
      const info = Z.mapInfo(Z.WORLD, id)
      const fog = Object.values(Z.fogInks(Z.chartInks(info.def)))
      for (const iso of viewsOf(id)) {
        const { pic, marked } = landOf(s, iso)
        let unseen = 0
        for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
          const t = pic.geometry.at(x, y)
          if (!t || Z.seenTile(s, id, info.w, t[0], t[1]) || marked(x, y)) continue
          unseen++
          assert.ok(fog.includes(pic.px[y * pic.w + x]), `${id} ${x},${y}: ${pic.px[y * pic.w + x]}`)
        }
        assert.ok(unseen > 1000, `${id}: ${unseen} px of fog`)
      }
    }
  })

  it('wears the corner\'s frame all round: cyan against the land, ink outside it', () => {
    const C = Z.CORNER_SKIN
    for (const id of charted()) {
      const s = game(id)
      for (const iso of viewsOf(id)) {
        for (const density of [1, 2]) {
          const { pic, marked } = landOf(s, iso, density)
          const at = (x, y) => (x < 0 || y < 0 || x >= pic.w || y >= pic.h ? null : pic.px[y * pic.w + x])
          const land = (x, y) => x >= 0 && y >= 0 && x < pic.w && y < pic.h && !!pic.geometry.at(x, y)
          let edge = 0
          for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
            if (marked(x, y)) continue
            const around = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
            if (!land(x, y) && around.some(([a, b]) => land(a, b))) {
              edge++
              assert.equal(at(x, y), C.cool, `${id} ${iso} ${x},${y}: the edge`)
            }
            // Cyan never meets the open: ink lies outside it.
            if (!land(x, y) && at(x, y) === C.cool) for (const [a, b] of around) assert.ok(marked(a, b) || at(a, b) !== null, `${id} ${iso} ${a},${b}: no ink outside the edge`)
          }
          assert.ok(edge > 50, id)
          assert.ok(pic.px.includes(C.outline))
        }
      }
    }
  })

  it('has the hero in pink where they stand, in both views', () => {
    for (const id of charted()) {
      const s = farGone(game(id))
      for (const iso of viewsOf(id)) {
        const { pic, f } = landOf(s, iso)
        const [x, y] = pic.geometry.to(Math.floor(s.hero.x) + 0.5, Math.floor(s.hero.y) + 0.5)
        const px = pic.px[Math.floor(y / f) * f * pic.w + Math.floor(x / f) * f]
        assert.equal(px, Z.CORNER_SKIN.hot, `${id} ${iso}`)
      }
    }
  })

  it('shows the sign\'s sockets where they stand, in the squares seen', () => {
    const s = game('lumenby')
    const gold = pic => pic.px.filter(c => c === Z.CORNER_SKIN.prize).length
    s.flags['q.lumenby.sign1'] = true
    const arrived = landOf(s, true).pic
    farGone(s)
    const all = landOf(s, true).pic
    assert.ok(all.marks.length >= arrived.marks.length + 4)
    assert.ok(gold(all) > 0)
  })
})

// ---- pins and places --------------------------------------------------------------------------------------------

/** States of a map: just arrived, some of it walked, all of it. */
function states(id) {
  const half = game(id)
  const info = Z.mapInfo(Z.WORLD, id)
  Z.reveal(half, id, info.w, info.h, { x: 0, y: 0, w: Math.ceil(info.w / 2), h: info.h })
  return [game(id), half, farGone(game(id))]
}

describe('the pins and the places', () => {
  it('pins each area seen, by its number, and lists it by name; an area not seen is ???', () => {
    for (const id of charted()) {
      const areas = Z.WORLD.maps[id].areas ?? []
      for (const s of states(id)) {
        const content = Z.mapPageContent(Z.WORLD, s)
        assert.equal(content.places.length, areas.length)
        const info = Z.mapInfo(Z.WORLD, id)
        for (const [i, a] of areas.entries()) {
          const p = content.places[i]
          const middle = Z.seenTile(s, id, info.w, Math.floor(a.x + a.w / 2), Math.floor(a.y + a.h / 2))
          assert.equal(p.n, i + 1)
          assert.equal(p.seen, middle || s.area === a.name, `${id} ${a.name}`)
          // As authored, THE and all.
          assert.equal(p.name, p.seen ? a.name.toUpperCase() : '???')
          assert.equal(p.here, s.area === a.name)
        }
        for (const iso of viewsOf(id)) {
          for (const scr of [SCREENS[0], SCREENS[3], SCREENS[5], SCREENS[7]]) {
            const { pic } = landOf(s, iso, 2, scr)
            assert.deepEqual(pic.pins.map(p => p.n), content.places.filter(p => p.seen).map(p => p.n), `${id} ${scr.w}: one pin an area seen`)
            assert.deepEqual(pic.pins.filter(p => p.here).map(p => p.n), content.places.filter(p => p.here).map(p => p.n))
          }
        }
      }
    }
  })

  it('never lays a pin over the hero, a mark, the Prism or another pin', () => {
    for (const id of charted().filter(m => Z.WORLD.maps[m].areas)) {
      for (const s of states(id)) {
        for (const iso of viewsOf(id)) {
          for (const density of [1, 2]) {
            for (const scr of [SCREENS[0], SCREENS[3], SCREENS[6]]) {
              const { pic, covered } = landOf(s, iso, density, scr)
              const where = `${id} ${scr.w} density ${density} ${iso}`
              for (const [i, pin] of pic.pins.entries()) {
                for (const m of pic.marks) assert.ok(!meets(pin, m), `${where}: pin ${pin.n} over a mark`)
                assert.ok(!meets(pin, grow(pic.marks[0], 2)), `${where}: pin ${pin.n} over the hero`)
                for (const c of covered) assert.ok(!meets(pin, c), `${where}: pin ${pin.n} under the Prism`)
                for (const other of pic.pins.slice(i + 1)) assert.ok(!meets(pin, other), `${where}: pins ${pin.n} and ${other.n}`)
                assert.ok(pin.x >= 0 && pin.y >= 0 && pin.x + pin.w <= pic.w / density && pin.y + pin.h <= pic.h / density, `${where}: pin ${pin.n} off the picture`)
              }
            }
          }
        }
      }
    }
  })

  it('sets the list\'s columns by what they show, the pair in the middle', () => {
    const s = game('seterfell', 'camp')
    const l = lay(s, SCREENS[0], 2, true)
    const p = l.layout.places
    assert.equal(p.cols, 2)
    const font = skinOf(2).font
    for (const x of new Set(p.entries.map(e => e.x))) {
      const column = p.entries.filter(e => e.x === x)
      assert.equal(Math.max(...column.map(e => e.w)), Math.max(...column.map(e => 12 + Math.ceil(font.width(e.name)))))
    }
    // The two stand close, 8 apart, whatever the unseen ones are called.
    const [a, b] = [...new Set(p.entries.map(e => e.x))]
    assert.equal(b - a - Math.max(...p.entries.filter(e => e.x === a).map(e => e.w)), 8)
    assert.ok(Math.abs(p.x - (l.vw - p.x - p.w)) <= 1, `centred: ${p.x} and ${l.vw - p.x - p.w}`)
  })

  it('gold-edges the pin of the area the hero is in, lilac the rest', () => {
    const here = Z.pinPicture(3, 'here')
    const seen = Z.pinPicture(3, 'seen')
    assert.ok(here.px.includes(Z.CORNER_SKIN.prize) && !here.px.includes(Z.CORNER_SKIN.dim))
    assert.ok(seen.px.includes(Z.CORNER_SKIN.dim) && !seen.px.includes(Z.CORNER_SKIN.prize))
  })
})

// ---- the hero's marker ------------------------------------------------------------------------------------------

describe('the hero on the page', () => {
  it('wears the corner\'s ink wide round the mark, so the pink is found at arm\'s length', () => {
    for (const id of ['seterfell', 'lumenby', 'underglow2']) {
      for (const iso of viewsOf(id)) {
        const s = farGone(game(id))
        const { pic } = landOf(s, iso)
        const { art } = pic.hero
        const at = (x, y) => (x < 0 || y < 0 || x >= art.w || y >= art.h ? null : art.px[y * art.w + x])
        let pink = 0
        for (let y = 0; y < art.h; y++) for (let x = 0; x < art.w; x++) {
          if (at(x, y) !== Z.CORNER_SKIN.hot) continue
          pink++
          // Two px of ink or more between the pink and the land, every straight way out (the nose's pale px aside).
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            let i = 1
            while (at(x + dx * i, y + dy * i) === Z.CORNER_SKIN.hot) i++
            const first = at(x + dx * i, y + dy * i)
            if (first !== Z.CORNER_SKIN.outline) continue
            assert.equal(at(x + dx * (i + 1), y + dy * (i + 1)) !== null, true, `${id} ${iso}: thin at ${x},${y}`)
          }
        }
        assert.ok(pink >= 6, id)
        assert.ok(art.w >= (iso ? 8 : 7) && art.h >= 7, `${id}: ${art.w}×${art.h}`)
      }
    }
  })

  it('never lies under a pin', () => {
    for (const id of charted().filter(m => Z.WORLD.maps[m].areas)) {
      const info = Z.mapInfo(Z.WORLD, id)
      const s = farGone(game(id))
      // In the middle of each area, where its pin wants to be.
      for (const a of info.def.areas) {
        s.hero.x = Math.floor(a.x + a.w / 2) + 0.5
        s.hero.y = Math.floor(a.y + a.h / 2) + 0.5
        s.area = a.name
        for (const iso of viewsOf(id)) {
          const { pic } = landOf(s, iso)
          for (const pin of pic.pins) assert.ok(!meets(grow(pin, 1), pic.hero), `${id} ${a.name}: pin ${pin.n}`)
        }
      }
    }
  })
})

// ---- the view plate ---------------------------------------------------------------------------------------------

describe('the Prism\'s plate', () => {
  /** Px of the land and its frame under the plate, L². */
  const onLand = (id, p, density) => {
    const geo = Z.landGeometry(Z.mapInfo(Z.WORLD, id), p.land.z, true, density)
    let n = 0
    for (let y = p.plate.y; y < p.plate.y + p.plate.h; y++) for (let x = p.plate.x; x < p.plate.x + p.plate.w; x++) if (geo.at((x - p.land.x) * density, (y - p.land.y) * density)) n++
    return n
  }

  it('hangs close under the Prism, 3 L at most, on a chain no longer, and stays on the screen', () => {
    for (const id of charted()) {
      for (const scr of SCREENS) {
        const s = farGone(game(id))
        const l = lay(s, scr, 2, true)
        const p = l.layout
        const hang = p.plate.y - (p.gem.y + p.gem.h)
        const where = `${id} ${scr.w}×${scr.h}: hang ${hang}`
        assert.ok(hang >= 0 && hang <= Z.PLATE_HANG && Z.PLATE_HANG === 3, where)
        if (p.chain) assert.ok(p.chain.h === hang && p.chain.y === p.gem.y + p.gem.h, where)
        assert.ok(p.plate.x >= 0 && p.plate.x + p.plate.w <= l.vw && p.plate.y + p.plate.h <= l.bottom, where)
        // Under the Prism: its chain reaches it.
        assert.ok(p.plate.x <= p.gem.x + 6 && p.plate.x + p.plate.w >= p.gem.x + 6, where)
        const { pic } = landOf(s, true, 2, scr)
        for (const pin of pic.pins) assert.ok(!meets({ ...pin, x: pin.x + p.land.x, y: pin.y + p.land.y }, p.plate), `${where}: over pin ${pin.n}`)
      }
    }
  })

  it('writes ISO ONLY on two rows where one would lie on the land, and then lies on little of it', () => {
    const forms = new Set()
    for (const id of charted().filter(m => Z.pinName(Z.WORLD.maps[m]))) {
      for (const scr of SCREENS) {
        const p = lay(farGone(game(id)), scr, 2, true).layout
        forms.add(p.plate.lines.join('|'))
        const where = `${id} ${scr.w}×${scr.h} ${p.plate.lines}`
        assert.equal(p.plate.text, 'ISO ONLY')
        if (p.plate.lines.length === 1) assert.equal(onLand(id, p, 2), 0, where)
        else {
          assert.deepEqual(p.plate.lines, ['ISO', 'ONLY'])
          assert.ok(p.plate.w < 40 && p.plate.h > 13, where)
          assert.ok(onLand(id, p, 2) <= 24, `${where}: ${onLand(id, p, 2)} L² of land`)
        }
      }
    }
    assert.ok(forms.has('ISO|ONLY'), [...forms].join(' '))
  })

  it('keeps off the hero where the screen has anywhere else for it', () => {
    const s = farGone(game('fogstage'))
    for (const [x, y] of [[85, 20], [80, 10], [70, 30]]) {
      s.hero.x = x + 0.5
      s.hero.y = y + 0.5
      const l = lay(s, SCREENS[0], 2, true)
      const { pic } = landOf(s, true)
      const p = l.layout
      assert.ok(!meets({ x: p.land.x + pic.hero.x, y: p.land.y + pic.hero.y, w: pic.hero.w, h: pic.hero.h }, p.plate), `${x},${y}`)
    }
  })
})

// ---- the tally ----------------------------------------------------------------------------------------------

describe('the tally of a map', () => {
  it('counts the chests opened of all the map\'s, seen or not', () => {
    const s = game('seterfell')
    const list = Z.mapInfo(Z.WORLD, 'seterfell').chestList
    assert.deepEqual(Z.chartTally(Z.WORLD, s).chests, [0, list.length])
    s.flags[`chest:${list[0].id}`] = true
    assert.deepEqual(Z.chartTally(Z.WORLD, s).chests, [1, list.length])
  })

  it('never tells of a chest that has not appeared, nor a heart piece whose condition is unmet', () => {
    const s = game('shrine', 'start')
    const list = Z.mapInfo(Z.WORLD, 'shrine').chestList
    const hidden = list.filter(c => c.appear)
    assert.ok(hidden.length > 0)
    assert.equal(Z.chartTally(Z.WORLD, s).chests[1], list.length - hidden.length)
    s.flags[`appear:${hidden[0].id}`] = true
    assert.equal(Z.chartTally(Z.WORLD, s).chests[1], list.length - hidden.length + 1)
    // A heart piece that waits for a flag.
    const world = { ...Z.WORLD, maps: { ...Z.WORLD.maps } }
    const heart = Z.mapInfo(Z.WORLD, 'overworld').marks.find(m => m.ent.t === 'item' && m.ent.item === 'heartPiece')
    const o = game('overworld')
    assert.deepEqual(Z.chartTally(world, o).hearts, [0, 1])
    const had = heart.ent.appear
    heart.ent.appear = { flag: 'test.never' }
    try {
      assert.deepEqual(Z.chartTally(world, o).hearts, [0, 0])
      assert.ok(!Z.mapPageContent(world, o).legend.some(e => e.kind === 'heart'))
      o.flags['test.never'] = true
      assert.deepEqual(Z.chartTally(world, o).hearts, [0, 1])
      delete o.flags['test.never']
      o.flags[`took:${heart.ent.id}`] = true
      assert.deepEqual(Z.chartTally(world, o).hearts, [1, 1])
    } finally {
      if (had) heart.ent.appear = had
      else delete heart.ent.appear
    }
  })

  it('shows each kind by the mark\'s own glyph and colours, the hero in pink', () => {
    const C = Z.CORNER_SKIN
    for (const iso of [false, true]) {
      const has = (kind, c) => Z.glyphPicture(kind, iso).px.includes(c)
      assert.ok(has('hero', C.hot), 'the hero is pink')
      for (const kind of ['chest', 'heart', 'door', 'pass', 'pip']) assert.ok(!has(kind, C.hot), `${kind}: pink is the hero alone`)
      assert.ok(has('chest', C.prize) && has('pip', C.prize) && has('pass', C.cool) && has('heart', '#ff5a6a') && has('door', '#f2e9ff'))
    }
  })

  it('says every glyph in words, and keeps glyphs and tallies when the words must go', () => {
    const s = farGone(game('overworld'))
    s.flags[`chest:${Z.mapInfo(Z.WORLD, 'overworld').chestList[0].id}`] = true
    const phone = lay(s, SCREENS[0], 2, true).layout.legend.entries.map(e => e.text)
    assert.deepEqual(phone, ['YOU', 'CHESTS 1/4', 'HEARTS 0/1', 'DOORS', 'PASSES'])
    for (const n of [1, 2, 4]) s.flags[`q.lumenby.sign${n}`] = true
    const lum = farGone(game('lumenby'))
    for (const n of [1, 2, 4]) lum.flags[`q.lumenby.sign${n}`] = true
    const l = lay(lum, SCREENS[0], 2, true).layout.legend
    assert.ok(l.entries.map(e => e.text).includes('SIGN 3/7'))
    assert.ok(l.rows <= 2)
    // Words given up: on some screen, for some land; there the tallies stay and the rest is its glyph.
    let seen = 0
    for (const id of charted()) for (const scr of SCREENS) for (const density of [1, 2]) {
      const p = lay(farGone(game(id)), scr, density, density === 2).layout
      if (!p.gave.includes('words')) continue
      seen++
      for (const e of p.legend.entries) assert.equal(e.text, e.tally, `${id} ${scr.w}: ${e.kind}`)
    }
    assert.ok(seen > 0)
  })

  it('draws the sign\'s socket unlike a chest, the same on the land as in the legend', () => {
    const lit = (kind) => {
      const g = Z.glyphPicture(kind, true)
      const px = []
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.px[y * g.w + x] && g.px[y * g.w + x] !== Z.CORNER_SKIN.outline) px.push([x, y])
      return [Math.max(...px.map(p => p[0])) - Math.min(...px.map(p => p[0])) + 1, Math.max(...px.map(p => p[1])) - Math.min(...px.map(p => p[1])) + 1]
    }
    assert.deepEqual(lit('chest'), [3, 3])
    assert.deepEqual(lit('pip'), [2, 4])
    const s = farGone(game('lumenby'))
    s.flags['q.lumenby.sign1'] = true
    const { pic, f } = landOf(s, true)
    // A lit one, 2 × 4 L of gold, somewhere on the land.
    const gold = (x, y) => pic.px[y * f * pic.w + x * f] === Z.CORNER_SKIN.prize
    let found = false
    for (let y = 0; y < pic.h / f - 4 && !found; y++) for (let x = 0; x < pic.w / f - 2; x++) {
      if ([0, 1, 2, 3].every(j => gold(x, y + j) && gold(x + 1, y + j)) && !gold(x + 2, y + 1) && !gold(x - 1, y + 1)) { found = true; break }
    }
    assert.ok(found)
  })

  it('leaves a kind the map has none of out of the legend', () => {
    const kinds = (id, entry) => Z.mapPageContent(Z.WORLD, game(id, entry)).legend.map(e => e.kind)
    assert.deepEqual(kinds('seterfell'), ['hero', 'chest', 'door', 'pass'])
    assert.deepEqual(kinds('overworld'), ['hero', 'chest', 'heart', 'door', 'pass'])
    assert.ok(!kinds('underglow2').includes('pass'))
    const lum = game('lumenby')
    for (const n of [1, 2, 4]) lum.flags[`q.lumenby.sign${n}`] = true
    const sign = Z.mapPageContent(Z.WORLD, lum).legend.at(-1)
    assert.deepEqual([sign.kind, sign.word, sign.tally], ['pip', 'SIGN', '3/7'])
    for (const id of charted().filter(m => m !== 'lumenby')) assert.ok(!kinds(id).includes('pip'), id)
  })
})

// ---- the world ----------------------------------------------------------------------------------------------

const worldOf = (s, k = 1, density = 2) => Z.worldPicture(Z.WORLD, s, { k, density, here: Z.mapPageContent(Z.WORLD, s).world })
const inside = (pic, l) => { const out = []; for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) out.push(pic.px[y * pic.w + x]); return out }
const names = (pic, density) => Object.fromEntries(Z.worldNames(Z.WORLD, pic, skinOf(density).font ?? { width: Z.textWidth }, density).map(n => [n.id, n]))

describe('the world on the page', () => {
  it('draws all nine lands where they lie from the first look', () => {
    const s = game('overworld')
    for (const k of [1, 2]) {
      const pic = worldOf(s, k)
      assert.equal(pic.lands.length, 9)
      assert.deepEqual([pic.w, pic.h], [364 / k, 176 / k])
      for (const l of pic.lands) {
        const o = Z.WORLD.atlas[l.id]
        assert.deepEqual([l.x, l.y], [(o.x + 172) / k, (o.y + 104) / k], l.id)
        assert.ok(inside(pic, l).every(Boolean), `${l.id} is drawn`)
      }
    }
  })

  it('shows nothing of a land not walked into: fog and a ?', () => {
    const s = game('overworld')
    // (Seen squares without the flag are no walk into a land.)
    seeAll(s, 'yulefjord')
    const pic = worldOf(s)
    const unknown = pic.lands.filter(l => !l.walked)
    assert.deepEqual(unknown.map(l => l.id).sort(), ['fogstage', 'lumenby', 'rerun', 'seterfell', 'sporelight', 'stillsand', 'yulefjord'])
    const fog = new Set(['#1b1032', '#2a1d4e', Z.CORNER_SKIN.dim, Z.CORNER_SKIN.outline])
    for (const l of unknown) {
      // (A neighbour's frame and notches lie inside their own boxes.)
      for (const c of inside(pic, l)) assert.ok(fog.has(c), `${l.id}: ${c}`)
      assert.ok(inside(pic, l).includes(Z.CORNER_SKIN.dim), `${l.id}: the ?`)
    }
    // The coast and the Wildwood are known always.
    for (const id of ['overworld', 'wildwood']) assert.ok(pic.lands.find(l => l.id === id).walked, id)
  })

  /** Every scale the layout can pick, in both dresses. */
  const SCALES = [1, 2, 3, 4].flatMap(k => [1, 2].map(density => [k, density]))
  const colour = (pic, x, y) => pic.px[y * pic.w + x]

  it('draws the ? only on a land that can hold it with a row to spare, and never past its box', () => {
    const s = game('overworld')
    let drawn = 0
    let left = 0
    for (const [k, density] of SCALES) {
      const pic = worldOf(s, k, density)
      const unknown = pic.lands.filter(l => !l.walked)
      for (const l of unknown) {
        // The ? is the one lilac thing on the chart: 5 × 7 L.
        const lilac = inside(pic, l).filter(c => c === Z.CORNER_SKIN.dim).length
        const room = l.h >= 8 * density && l.w >= 6 * density
        assert.equal(lilac > 0, room, `${l.id} k ${k} density ${density}: ${l.w}×${l.h}, ${lilac} px of the ?`)
        if (room) drawn++
        else left++
      }
      for (let y = 0; y < pic.h; y++) for (let x = 0; x < pic.w; x++) {
        if (colour(pic, x, y) !== Z.CORNER_SKIN.dim) continue
        // Inside an unwalked land, clear of the line of ink on its right and under it.
        assert.ok(unknown.some(l => x >= l.x && x < l.x + l.w - 1 && y >= l.y && y < l.y + l.h - 1), `k ${k} density ${density}: lilac at ${x},${y}`)
      }
    }
    assert.ok(drawn > 0 && left > 0, `${drawn} with, ${left} without`)
    // Stillsand, the lowest, at 3 tiles a px in the fine dress: none.
    const low = worldOf(s, 3, 2)
    assert.ok(!inside(low, low.lands.find(l => l.id === 'stillsand')).includes(Z.CORNER_SKIN.dim))
  })

  it('keeps the hero\'s pip inside the gold frame on every land at every scale, smaller where the land is low', () => {
    const sizes = new Set()
    for (const id of Object.keys(Z.WORLD.atlas)) {
      const info = Z.mapInfo(Z.WORLD, id)
      const spots = [...Object.values(info.entries), { x: 0, y: 0 }, { x: info.w - 1, y: info.h - 1 }, { x: 0, y: info.h - 1 }, { x: info.w - 1, y: 0 }]
      const s = farGone(game(id))
      for (const spot of spots) {
        s.hero.x = spot.x + 0.5
        s.hero.y = spot.y + 0.5
        for (const [k, density] of SCALES) {
          const pic = worldOf(s, k, density)
          const l = pic.lands.find(v => v.here)
          const p = pic.pip
          const where = `${id} ${spot.x},${spot.y} k ${k} density ${density}: pip ${p.x},${p.y} ${p.w}×${p.h} in ${l.x},${l.y} ${l.w}×${l.h}`
          assert.ok(p.x >= l.x + density && p.y >= l.y + density && p.x + p.w <= l.x + l.w - density && p.y + p.h <= l.y + l.h - density, where)
          const roomy = Math.min(l.w, l.h) >= 6 * density
          assert.equal(p.w, roomy ? 4 * density : Math.min(2 * density, Math.min(l.w, l.h) - 2 * density), where)
          sizes.add(p.w / density)
          const px = inside(pic, p)
          assert.ok(px.includes(Z.CORNER_SKIN.hot), `${where}: pink`)
          assert.equal(px.includes(Z.CORNER_SKIN.outline), roomy, `${where}: the ring`)
          // The frame is whole: gold all round, but for the notches of the passes.
          for (let y = l.y; y < l.y + l.h; y++) for (let x = l.x; x < l.x + l.w; x++) {
            if (x >= l.x + density && x < l.x + l.w - density && y >= l.y + density && y < l.y + l.h - density) continue
            const c = colour(pic, x, y)
            assert.ok(c === Z.CORNER_SKIN.prize || c === Z.CORNER_SKIN.cool, `${where}: ${c} on the frame at ${x},${y}`)
          }
          for (const other of pic.lands.filter(v => !v.here)) assert.ok(!inside(pic, other).includes(Z.CORNER_SKIN.hot), other.id)
        }
      }
    }
    assert.ok(sizes.has(4) && sizes.has(2), `${[...sizes]}`)
  })

  it('frames the hero\'s land in gold, and no other', () => {
    for (const id of Object.keys(Z.WORLD.atlas)) {
      const s = farGone(game(id))
      for (const [k, density] of SCALES) {
        const pic = worldOf(s, k, density)
        const l = pic.lands.find(v => v.here)
        assert.equal(l.id, id)
        // Its four corners (the passes' notches keep off them).
        for (const [x, y] of [[l.x, l.y], [l.x + l.w - 1, l.y], [l.x, l.y + l.h - 1], [l.x + l.w - 1, l.y + l.h - 1]]) {
          assert.equal(colour(pic, x, y), Z.CORNER_SKIN.prize, `${id} k ${k} density ${density}: the corner ${x},${y}`)
        }
        for (const other of pic.lands.filter(v => !v.here)) {
          assert.ok(other.walked)
          assert.ok(!inside(pic, other).includes(Z.CORNER_SKIN.prize), `${id} k ${k} density ${density}: gold on ${other.id}`)
        }
      }
    }
  })

  it('cuts a cyan notch at each pass of a land walked into, on the edge nearest it, and nowhere else', () => {
    const grid0 = Z.atlasBox(Z.WORLD)
    let checked = 0
    for (const here of ['overworld', 'seterfell']) {
      const s = farGone(game(here))
      for (const [k, density] of SCALES) {
        const pic = worldOf(s, k, density)
        for (const l of pic.lands) {
          const r = grid0.rects.find(v => v.id === l.id)
          const passes = Z.landPasses(Z.WORLD, l.id)
          assert.ok(passes.length, l.id)
          // The cyan runs along each edge, a fine px deep or more: as [from, to) along it.
          const edges = { left: [l.y, l.h, i => [l.x, i]], right: [l.y, l.h, i => [l.x + l.w - 1, i]], top: [l.x, l.w, i => [i, l.y]], bottom: [l.x, l.w, i => [i, l.y + l.h - 1]] }
          // Which edge is nearest each pass, and where along it (kept off the corners).
          const wanted = passes.map(p => {
            const gaps = [p.x, r.w - 1 - p.x, p.y, r.h - 1 - p.y]
            const side = ['left', 'right', 'top', 'bottom'][gaps.indexOf(Math.min(...gaps))]
            const [from, size] = edges[side]
            const at = from + Math.floor((side === 'left' || side === 'right' ? p.y : p.x) / k)
            return { side, at: Math.max(from + density, Math.min(from + size - density - 1, at)), to: p.to }
          })
          let cyan = 0
          for (const [side, [from, size, point]] of Object.entries(edges)) {
            const runs = []
            for (let i = from; i < from + size; i++) {
              const [x, y] = point(i)
              if (colour(pic, x, y) !== Z.CORNER_SKIN.cool) continue
              cyan++
              if (runs.at(-1)?.to === i) runs.at(-1).to++
              else runs.push({ from: i, to: i + 1 })
            }
            const on = wanted.filter(w => w.side === side)
            const where = `${l.id} k ${k} density ${density} ${side}: runs ${runs.map(v => `${v.from}–${v.to}`)}, passes at ${on.map(w => `${w.at} (${w.to})`)}`
            for (const w of on) assert.ok(runs.some(v => w.at >= v.from && w.at < v.to), `${where}: a pass without its notch`)
            for (const v of runs) assert.ok(on.some(w => w.at >= v.from && w.at < v.to), `${where}: a notch without a pass`)
            assert.ok(runs.length <= on.length, where)
            // A notch is 3 L long at most for each pass it stands for.
            for (const v of runs) assert.ok(v.to - v.from <= 3 * density * on.filter(w => w.at >= v.from && w.at < v.to).length, where)
            checked += on.length
          }
          // No cyan inside the land.
          for (let y = l.y + density; y < l.y + l.h - density; y++) for (let x = l.x + density; x < l.x + l.w - density; x++) assert.notEqual(colour(pic, x, y), Z.CORNER_SKIN.cool, `${l.id} ${x},${y}`)
          assert.ok(cyan > 0)
        }
      }
    }
    assert.ok(checked > 200, `${checked}`)
    // And none on a land not walked into.
    const pic = worldOf(game('overworld'))
    for (const l of pic.lands.filter(v => !v.walked)) assert.ok(!inside(pic, l).includes(Z.CORNER_SKIN.cool), l.id)
  })

  it('draws the hero\'s land from the live tiles, the others as they were made', () => {
    const s = farGone(game('seterfell'))
    const before = worldOf(s)
    const info = Z.mapInfo(Z.WORLD, 'seterfell')
    // A pool where there was none, far from the frame, in the live tiles only.
    for (let y = 20; y < 26; y++) for (let x = 20; x < 26; x++) s.map.tiles[y * info.w + x] = '~'
    const after = worldOf(s)
    const l = after.lands.find(v => v.id === 'seterfell')
    assert.notEqual(after.px[(l.y + 23) * after.w + l.x + 23], before.px[(l.y + 23) * before.w + l.x + 23])
    assert.equal(after.px[(l.y + 23) * after.w + l.x + 23], Z.chartInks(info.def).water)
    // Seen from another land, Seter Fell is the made one.
    const away = farGone(game('overworld'))
    const there = worldOf(away)
    const f = there.lands.find(v => v.id === 'seterfell')
    assert.equal(there.px[(f.y + 23) * there.w + f.x + 23], before.px[(l.y + 23) * before.w + l.x + 23])
  })

  it('dims with the land\'s chart at night, and not before the Prism', () => {
    const luma = c => { const v = parseInt(c.slice(1), 16); return ((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114 }
    const s = farGone(game('seterfell'))
    const info = Z.mapInfo(Z.WORLD, 'seterfell')
    const mean = pic => { const l = pic.lands.find(v => v.id === 'stillsand'); const px = inside(pic, l); return px.reduce((a, c) => a + luma(c), 0) / px.length }
    const levels = []
    for (const [t, n] of [[580, 0], [120, 1], [230, 2], [null, 0]]) {
      s.daytime = t
      const content = Z.mapPageContent(Z.WORLD, s)
      assert.equal(content.world.night, n, `daytime ${t}`)
      levels.push(mean(worldOf(s)))
      // The same level as the land's own chart.
      const open = Z.chartLayer(Z.WORLD, s).px
      assert.ok(open.includes(Z.dimInk(Z.chartInks(info.def).road, n)), `daytime ${t}: the land`)
      const w = worldOf(s)
      assert.ok(inside(w, w.lands.find(v => v.here)).includes(Z.dimInk(Z.chartInks(info.def).road, n)), `daytime ${t}: the world`)
    }
    assert.ok(levels[0] > levels[1] && levels[1] > levels[2] && levels[3] === levels[0], levels.join(' '))
  })

  it('names a land in full where that fits its box, else by its short form', () => {
    const s = farGone(game('overworld'))
    const fine = names(worldOf(s, 1, 2), 2)
    assert.deepEqual(Object.fromEntries(Object.entries(fine).map(([id, n]) => [id, n.text])), {
      overworld: 'NEON COAST', wildwood: 'WILDWOOD', seterfell: 'FELL', yulefjord: 'FJORD', sporelight: 'SPORE',
      stillsand: 'STILLSAND', rerun: 'RERUN', lumenby: 'LUMENBY', fogstage: 'FOGSTAGE',
    })
    const coarse = names(worldOf(s, 2, 1), 1)
    assert.deepEqual(Object.fromEntries(Object.entries(coarse).map(([id, n]) => [id, n.text])), {
      overworld: 'COAST', wildwood: 'WOOD', seterfell: 'FELL', yulefjord: 'FJORD', sporelight: 'SPORE',
      stillsand: 'SAND', rerun: 'RERUN', lumenby: 'LUMENBY', fogstage: 'FOG',
    })
    for (const id of Object.keys(Z.WORLD.atlas)) assert.ok(Z.WORLD_SHORT[id], `${id} has a short form`)
  })

  it('keeps every name in its own box, clear of the pip, and the hero\'s land named wherever they stand', () => {
    for (const id of Object.keys(Z.WORLD.atlas)) {
      for (const entry of Object.keys(Z.mapInfo(Z.WORLD, id).entries)) {
        const s = farGone(game(id, entry))
        for (const [k, density] of [[1, 2], [2, 1]]) {
          const pic = worldOf(s, k, density)
          const list = Object.values(names(pic, density))
          const here = list.find(n => n.here)
          // On the fine chart always; on the coarse one a low land has no row to spare with the pip across its middle.
          const mid = pic.pip.y / density - pic.lands.find(l => l.here).y / density
          if (k === 1) assert.equal(list.length, 9, `${id}/${entry}: every land named`)
          if (k === 1 || Math.abs(mid - 6) > 1) assert.ok(here, `${id}/${entry} k ${k}: the hero's land has a name`)
          for (const n of list) {
            const l = pic.lands.find(v => v.id === n.id)
            assert.ok(n.x * density >= l.x && (n.x + n.w) * density <= l.x + l.w && n.y * density >= l.y && (n.y + 7) * density <= l.y + l.h, `${id}/${entry}: ${n.text}`)
            const pip = { x: pic.pip.x / density, y: pic.pip.y / density, w: pic.pip.w / density, h: pic.pip.h / density }
            assert.ok(!meets({ x: n.x, y: n.y, w: n.w, h: 7 }, pip), `${id}/${entry}: ${n.text} over the hero`)
          }
        }
      }
    }
  })

  it('names no land not walked into, and none on a chart too small for most of them', () => {
    const s = game('overworld')
    assert.deepEqual(Object.keys(names(worldOf(s), 2)).sort(), ['overworld', 'wildwood'])
    assert.deepEqual(names(worldOf(farGone(s), 4, 2), 2), {})
  })
})

// ---- indoors --------------------------------------------------------------------------------------------------

describe('the MAP page indoors', () => {
  it('names every room and the land outside it, with the hero at the door on the world', () => {
    assert.ok(rooms().length >= 14)
    for (const id of rooms()) {
      const out = Z.outsideOf(Z.WORLD, id)
      assert.ok(out, `${id}: a land outside`)
      assert.ok(Z.WORLD.atlas[out.map], `${id}: on the grid`)
      const warp = Z.mapInfo(Z.WORLD, id).warps[0]
      const door = Z.mapInfo(Z.WORLD, out.map).entries[warp.entry]
      assert.deepEqual([out.map, out.x, out.y], [warp.to, door.x, door.y], id)
      const s = game(id)
      const c = Z.mapPageContent(Z.WORLD, s)
      assert.equal(c.land, null)
      assert.equal(c.title, Z.WORLD.maps[id].name.toUpperCase())
      assert.equal(c.sub, `OUTSIDE: ${Z.WORLD.maps[out.map].name.toUpperCase().replace(/^THE /, '')}`)
      assert.deepEqual([c.places, c.legend], [[], []])
      assert.deepEqual([c.world.map, c.world.x, c.world.y], [out.map, door.x, door.y])
      const pic = worldOf(s)
      assert.equal(pic.lands.find(l => l.here).id, out.map)
      s.inv.sword = false
      assert.equal(Z.mapPageContent(Z.WORLD, s).world, null)
    }
    assert.equal(Z.mapPageContent(Z.WORLD, game('fellcave')).sub, 'OUTSIDE: SETER FELL')
  })

  it('says no more than the name where there is no one land outside', () => {
    const hut = Z.WORLD.maps.hut
    const world = { ...Z.WORLD, maps: { ...Z.WORLD.maps, hut: { ...hut, marks: {}, warps: [{ x: 1, y: 1, to: 'overworld', entry: 'hut' }, { x: 2, y: 1, to: 'seterfell', entry: 'camp' }] } } }
    assert.equal(Z.outsideOf(world, 'hut'), null)
  })

  it('lays the stub, the title and the world on every screen, over the deck', () => {
    for (const id of rooms()) {
      for (const scr of SCREENS) {
        for (const density of [1, 2]) {
          const l = lay(game(id), scr, density, density === 2)
          const where = `${id} ${scr.w}×${scr.h}@${scr.dpr} density ${density}`
          check(l, where)
          const p = l.layout
          assert.ok(p.stub && !p.land && !p.gem, where)
          assert.ok(p.stub.w === Z.STUB_SIDE * p.stub.m && Number.isInteger(p.stub.m) && p.stub.m >= 1, where)
          if (scr.h >= 600) assert.ok(p.stub.m >= 2 && p.world, where)
        }
      }
    }
  })

  it('draws the corner\'s stub, the hero in the door', () => {
    const s = game('hut')
    const pic = Z.stubPicture(Z.WORLD, s)
    assert.deepEqual([pic.w, pic.h], [Z.STUB_SIDE, Z.STUB_SIDE])
    for (const c of [Z.CORNER_SKIN.cool, Z.CORNER_SKIN.hot, Z.CORNER_SKIN.dim, Z.CORNER_SKIN.outline]) assert.ok(pic.px.includes(c), c)
    // The corner's own pixels, none of the Prism's.
    assert.ok(!pic.px.includes('#9a4ff0'))
  })
})

// ---- the Prism's button -----------------------------------------------------------------------------------------

describe('the Prism on the page as a button', () => {
  it('has a target of 44 × 44 CSS px or more, on the screen and clear of the deck, at every size and view', () => {
    for (const id of charted()) {
      for (const s of [game(id), farGone(game(id))]) {
        for (const scr of SCREENS) {
          for (const density of [1, 2]) {
            for (const iso of viewsOf(id)) {
              const l = lay(s, scr, density, iso)
              const hit = l.layout.gemHit
              const W = Math.round(scr.w * scr.dpr)
              const H = Math.round(scr.h * scr.dpr)
              const hs = l.css * scr.dpr
              const on = { scale: hs, ox: Math.floor((W - l.vw * hs) / 2), oy: Math.floor((H - l.vh * hs) / 2) }
              const b = Z.targetOnScreen(hit, on, scr.dpr, { w: scr.w, h: scr.h })
              const where = `${id} ${scr.w}×${scr.h}@${scr.dpr} density ${density} ${iso ? 'iso' : 'square'}: ${b.x},${b.y} ${b.w}×${b.h}`
              assert.ok(b.w >= 44 - 1e-9 && b.h >= 44 - 1e-9, where)
              assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= scr.w + 1e-9 && b.y + b.h <= scr.h + 1e-9, where)
              // Clear of the deck's buttons, and under the tabs.
              if (!scr.keys) assert.ok(b.y + b.h <= scr.deck[density], `${where}: the deck at ${scr.deck[density]}`)
              assert.ok(!meets(hit, l.layout.tabs), `${where}: over the tabs`)
              // It answers on the Prism: the gem's middle is inside it.
              const [gx, gy] = [l.layout.gem.x + l.layout.gem.w / 2, l.layout.gem.y + l.layout.gem.h / 2]
              assert.ok(gx > hit.x && gx < hit.x + hit.w && gy > hit.y && gy < hit.y + hit.h, `${where}: beside the gem`)
              // Grown over the plate.
              const p = l.layout.plate
              assert.ok(hit.x <= p.x && hit.x + hit.w >= p.x + p.w && hit.y + hit.h >= Math.min(p.y + p.h, l.bottom), `${where}: the plate`)
            }
          }
        }
      }
    }
  })

  it('keeps a box on the screen', () => {
    const on = { scale: 6, ox: -3, oy: -3 }
    assert.deepEqual(Z.targetOnScreen({ x: 0, y: 0, w: 22, h: 22 }, on, 3, { w: 390, h: 844 }), { x: 0, y: 0, w: 44, h: 44 })
    assert.deepEqual(Z.targetOnScreen({ x: 180, y: 410, w: 22, h: 22 }, on, 3, { w: 390, h: 844 }), { x: 346, y: 800, w: 44, h: 44 })
  })

  it('is not there indoors, nor in a round of one view', () => {
    assert.equal(lay(game('hut'), SCREENS[0], 2, true).layout.gemHit, null)
    const s = game('seterfell')
    const g = grid(SCREENS[0], 2)
    const l = Z.mapPageFor(Z.WORLD, s, g.vw, g.vh, { keys: g.keys, e: 1, css: g.css, deck: g.deck, round: [{ engine: 'iso' }] }, skinOf(2))
    assert.equal(l.layout.gemHit, null)
  })

  it('rings the Prism in gold while the keyboard\'s focus is on it', () => {
    const s = game('seterfell')
    const g = grid(SCREENS[7], 2)
    const gold = focus => {
      const px = new Map()
      let fill = ''
      const ctx = new Proxy({}, { get: (_, k) => (k === 'fillRect' ? (x, y, w, h) => { for (let j = 0; j < h * 2; j++) for (let i = 0; i < w * 2; i++) px.set(`${x * 2 + i},${y * 2 + j}`, fill) } : () => {}), set: (_, k, v) => { if (k === 'fillStyle') fill = v; return true } })
      const skin = { ...skinOf(2), font: { width: skinOf(2).font.width, wrap: t => [t], draw: () => {} } }
      let at
      Z.drawMapPage(ctx, Z.WORLD, s, g.vw, g.vh, { keys: g.keys, e: 1, css: g.css, focus, placed: p => { at = p } }, skin)
      let n = 0
      const b = at.gem
      for (let y = (b.y - 1) * 2; y < (b.y + b.h + 1) * 2; y++) for (let x = (b.x - 1) * 2; x < (b.x + b.w + 1) * 2; x++) if (px.get(`${x},${y}`) === Z.CORNER_SKIN.prize) n++
      return n
    }
    assert.ok(gold(true) > gold(false) + 80, `${gold(true)} against ${gold(false)}`)
  })

  const shell = readFileSync(join(root, 'Zelda.vue'), 'utf8')
  const at = shell.indexOf('class="zelda-page-prism"')
  const button = shell.slice(shell.lastIndexOf('<button', at), shell.indexOf('/>', at))

  it('is a real button, shown only on the open MAP page', () => {
    assert.match(button, /v-if="phase === 'play' && paused && menuPage === 'map' && !confirmReset && pagePrismAt"/)
    assert.match(button, /type="button"/)
    assert.match(button, /:style="pagePrismAt"/)
    assert.match(button, /data-game-keys/)
    assert.match(button, /:aria-label="turnLabel"/)
    assert.match(button, /aria-keyshortcuts="V"/)
    assert.match(button, /@pointerdown\.prevent="pagePrismPress"/)
    assert.doesNotMatch(button, /\.stop/, 'a first touch still reaches the deck\'s switch')
    assert.match(button, /@click="\$event\.detail === 0 && cycleView\(\)"/)
    assert.match(button, /@keydown="turnKey"/)
    // Under the deck, so it never takes a tap meant for it.
    assert.match(shell, /\.zelda-page-prism \{[^}]*z-index: 4;/)
    assert.match(shell, /\.zelda-deck \{[^}]*z-index: 5;/)
  })

  it('does what the deck\'s VIEW button does, the corner\'s refusal and all, with no rule of its own', () => {
    assert.match(shell, /@pointerdown\.prevent\.stop="cycleView"[^>]*>VIEW: \{\{ viewLabel \}\}/)
    assert.match(shell, /function pagePrismPress\(e: PointerEvent\) \{\s*if \(e\.pointerType === 'mouse' && e\.button !== 0\) return\s*cycleView\(\)\s*\}/)
    // The one rule: the corner's words, through the corner's live region.
    assert.match(shell, /const words = state \? oneViewWords\(mapInfo\(WORLD, state\.map\.id\)\.def, viewList\(\)\) : null\s*if \(words\) turnRefuse\(words\.tag, words\.said\)/)
    assert.equal(shell.split('oneViewWords(').length - 1, 2)
    assert.deepEqual(Z.oneViewWords(Z.WORLD.maps.lumenby), { tag: 'ISO ONLY HERE', said: 'Isometric only here' })
  })

  it('is placed where the page laid it, and painted again for the focus and after a turn', () => {
    assert.match(shell, /pausedDrawn = true; drawFrame\(nowMs, 0\); placePagePrism\(\)/)
    assert.match(shell, /const b = renderer\?\.pagePrism\(\) \?\? null/)
    assert.match(shell, /if \(paused\.value\) \{ const on = pagePrismFocused\(\); if \(on !== !!ui\.prismFocus\) \{ ui\.prismFocus = on; pausedDrawn = false \} \}/)
    // A turn paints the stopped world again (\`showView\`), and so does a new size of canvas.
    assert.match(shell, /viewShown = def\.id\s*pausedDrawn = false/)
    assert.match(shell, /cn\.safe = \{ top: safe\.top, right: safe\.right \}[^}]*pausedDrawn = false/)
    const r = readFileSync(join(root, 'render/renderer.ts'), 'utf8')
    assert.match(r, /prismAt = null\s*const to = wearable\(skin\)/)
    assert.match(r, /placed: p => \{ prismAt = p\.gemHit && targetOnScreen\(p\.gemHit, sp, dpr, \{ w: W \/ dpr, h: H \/ dpr \}\) \}/)
    assert.match(r, /pagePrism: \(\) => prismAt,/)
  })

  it('can be reached by Tab while the world stands still', () => {
    assert.match(shell, /if \(e\.code === 'Tab' && \(paused\.value \|\| !hasItem\.value\)\) return true/)
  })
})

// ---- the painter ----------------------------------------------------------------------------------------------

/** `drawMapPage` on a stand-in context that keeps the colour each fine px ends in, and what was written where. */
function paint(s, scr, density, iso) {
  const g = grid(scr, density)
  const px = new Map()
  const words = []
  let fill = ''
  const ctx = new Proxy({}, {
    get: (_, k) => k === 'fillRect' ? (x, y, w, h) => {
      // (The veil, over the whole page, is where the picture starts.)
      if (w >= g.vw && h >= g.vh) { px.clear(); return }
      for (let j = Math.round(y * density); j < Math.round((y + h) * density); j++) for (let i = Math.round(x * density); i < Math.round((x + w) * density); i++) px.set(`${i},${j}`, fill)
    } : k === 'fillStyle' ? fill : () => {},
    set: (_, k, v) => { if (k === 'fillStyle') fill = v; return true },
  })
  const width = skinOf(density).font?.width ?? Z.textWidth
  const font = { width, wrap: t => [t], draw: (_, text, x, y, color) => words.push({ text, x, y, w: width(text), h: 7, color }) }
  const skin = { ...skinOf(density), font }
  const opts = { keys: g.keys, e: iso ? 1 : 0, css: g.css, deck: g.deck }
  Z.drawMapPage(ctx, Z.WORLD, s, g.vw, g.vh, opts, skin)
  return { ...g, px, words, ...Z.mapPageFor(Z.WORLD, s, g.vw, g.vh, opts, skin) }
}

/** Every px of the hero's mark and its ink lies on the painted page as it was drawn. */
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
      assert.equal(page.px.get(`${(p.land.x + x + i) * density + a},${(p.land.y + y + j) * density + b}`), c, `${where}: the hero at ${i},${j}`)
    }
  }
  assert.ok(pink >= 6, `${where}: the hero is drawn (${pink})`)
}

describe('the MAP page, painted', () => {
  it('shows the hero over the Prism too, where they stand under it', () => {
    let under = 0
    for (const [id, x, y] of [['rerun', 77, 2], ['stillsand', 84, 3], ['lumenby', 80, 2], ['seterfell', 69, 4]]) {
      const s = farGone(game(id))
      s.hero.x = x + 0.5
      s.hero.y = y + 0.5
      for (const scr of [SCREENS[0], SCREENS[3]]) {
        const page = paint(s, scr, 2, true)
        const p = page.layout
        const pic = Z.landPicture(Z.WORLD, s, { iso: true, z: p.land.z, density: 2, covered: Z.landCover(p) })
        const mark = { x: p.land.x + pic.hero.x, y: p.land.y + pic.hero.y, w: pic.hero.w, h: pic.hero.h }
        if (meets(mark, p.gem)) under++
        heroShows(s, page, true, 2, `${id} ${x},${y} ${scr.w}`)
      }
    }
    assert.ok(under >= 4, `${under} of them under the Prism`)
  })

  it('never covers the hero, whatever stands near them', () => {
    for (const id of ['overworld', 'wildwood', 'seterfell', 'yulefjord', 'stillsand']) {
      const info = Z.mapInfo(Z.WORLD, id)
      const s = farGone(game(id))
      for (let y = 2; y < info.h; y += 9) for (let x = 2; x < info.w; x += 9) {
        s.hero.x = x + 0.5
        s.hero.y = y + 0.5
        for (const [scr, density, iso] of [[SCREENS[0], 2, true], [SCREENS[1], 1, false], [SCREENS[5], 2, true]]) {
          if (!viewsOf(id).includes(iso)) continue
          const page = paint(s, scr, density, iso)
          const p = page.layout
          heroShows(s, page, iso, density, `${id} ${x},${y} ${scr.w}`)
        }
      }
    }
  })

  it('writes no name over the land, and nothing under the deck', () => {
    for (const id of Object.keys(Z.WORLD.maps)) {
      const s = Z.charted(Z.WORLD.maps[id]) ? farGone(game(id)) : game(id)
      for (const scr of [SCREENS[0], SCREENS[3], SCREENS[6], SCREENS[7]]) {
        for (const density of [1, 2]) {
          const iso = density === 2 || !!(Z.WORLD.maps[id].views && !Z.WORLD.maps[id].views.includes('classic'))
          const page = paint(s, scr, density, iso)
          const p = page.layout
          const bottom = page.opts.bottom
          for (const w of page.words) assert.ok(w.y + w.h <= bottom + 1 / density && w.x >= -1 && w.x + w.w <= page.vw + 1, `${id} ${scr.w}: "${w.text}"`)
          for (const key of page.px.keys()) assert.ok(Number(key.split(',')[1]) < bottom * density, `${id} ${scr.w}: painted under the deck`)
          if (!p.land) continue
          const pic = Z.landPicture(Z.WORLD, s, { iso, z: p.land.z, density })
          for (const w of page.words) {
            for (let y = Math.floor(w.y * density); y < (w.y + w.h) * density; y++) for (let x = Math.floor(w.x * density); x < (w.x + w.w) * density; x++) {
              const t = pic.geometry.at(x - p.land.x * density, y - p.land.y * density)
              assert.ok(!t, `${id} ${scr.w} density ${density}: "${w.text}" lies on the land`)
            }
          }
        }
      }
    }
  })

  it('says the land, the area, the places, the tallies and the world, and on keys how to go on', () => {
    const s = farGone(game('seterfell', 'camp'))
    const said = scr => paint(s, scr, 2, true).words.map(w => w.text)
    const phone = said(SCREENS[0])
    for (const t of ['SETER FELL', s.area, 'CAIRN RIDGE', 'THE FELL ROAD', 'YOU', 'DOORS', 'PASSES', 'CHESTS 0/3', 'THE WORLD', 'FELL']) assert.ok(phone.includes(t), `${t} in ${phone}`)
    assert.ok(!phone.includes('ESC RESUME'))
    const desk = said(SCREENS[7])
    assert.ok(desk.includes('ESC RESUME'))
    for (const list of [phone, desk]) assert.ok(!list.some(t => /^V(IEW)? /.test(t) || t.includes('NO MAP')), list.join(' | '))
    assert.ok(paint(game('hut'), SCREENS[0], 2, true).words.some(w => w.text === 'KEEPER\'S HUT'))
  })

  it('keeps above the deck as the shell measured it', () => {
    assert.equal(Z.pageBottom(422, { keys: Z.TOUCH_KEYS, deck: 366 }, 2), 364)
    assert.equal(Z.pageBottom(422, { keys: Z.TOUCH_KEYS }, 2), 342, 'a guess before the deck is on the page')
    assert.equal(Z.pageBottom(200, { keys: Z.KEYBOARD_KEYS, safe: { bottom: 4 } }, 4), 194)
    const shell = readFileSync(join(root, 'Zelda.vue'), 'utf8')
    assert.match(shell, /if \(paused\.value\) \{ const top = deckTop\(\); if \(top !== ui\.deckTop\) \{ ui\.deckTop = top; pausedDrawn = false \} \}/)
    assert.match(shell, /<div v-else ref="pausedRow" class="zelda-deck-paused">/)
    const r = readFileSync(join(root, 'render/renderer.ts'), 'utf8')
    assert.match(r, /deck: ui\.deckTop == null \? null : Math\.floor\(\(ui\.deckTop \* dpr - sp\.oy\) \/ sp\.scale\)/)
  })

  it('lies on the bare veil: no banner, exit label or talk box frozen behind it', () => {
    const r = readFileSync(join(root, 'render/renderer.ts'), 'utf8')
    assert.match(r, /if \(!mapUp\) drawExitLabels\(/)
    assert.match(r, /if \(ui\.banner && !mapUp && [^\n]*drawBanner\(/)
    assert.match(r, /if \(s\.dialog && !mapUp\) \{/)
  })

  it('keeps the edge of every pin in the list where the rows are closest', () => {
    let packed = 0
    let gold = 0
    for (const id of Object.keys(Z.WORLD.atlas)) {
      const s = farGone(game(id))
      const areas = Z.mapInfo(Z.WORLD, id).def.areas
      // The hero in the first area and in the last: the gold pin with one under it, and at a column's foot.
      for (const here of [areas[0], areas[1], areas.at(-1)]) {
        s.area = here.name
        for (const [scr, density] of SCREENS.flatMap(v => [[v, 1], [v, 2]])) {
          if (!viewsOf(id).includes(density === 2)) continue
          const page = paint(s, scr, density, density === 2)
          const entries = page.layout.places?.entries ?? []
          if (!entries.some(e => entries.some(o => o.x === e.x && o.y - e.y === Z.PIN_H))) continue
          packed++
          for (const e of entries) {
            const edge = e.here ? Z.CORNER_SKIN.prize : e.seen ? Z.CORNER_SKIN.dim : '#6a5aa8'
            if (e.here && entries.some(o => o.x === e.x && o.y > e.y)) gold++
            // The plate's top and bottom rows, between its notched corners.
            for (const row of [0, Z.PIN_H - 1]) {
              for (let i = 1; i < Z.PIN_W - 1; i++) {
                assert.equal(page.px.get(`${(e.x + i) * density},${(e.y + row) * density}`), edge, `${id} ${scr.w} density ${density}: pin ${e.n}, row ${row}, ${i}`)
              }
            }
          }
        }
      }
    }
    assert.ok(packed >= 8 && gold > 0, `${packed} packed lists, ${gold} gold pins with one under them`)
  })

  it('veils the world the same in both dresses, in the corner\'s ink at about 0.86', () => {
    for (const density of [1, 2]) {
      const fills = []
      const ctx = new Proxy({}, { get: (t, k) => (k === 'fillRect' ? (...a) => fills.push([t.fillStyle, ...a]) : k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true } })
      const g = grid(SCREENS[0], density)
      const skin = { ...skinOf(density), font: { width: Z.textWidth, wrap: t => [t], draw: () => {} } }
      Z.drawMapPage(ctx, Z.WORLD, game('seterfell'), g.vw, g.vh, { keys: g.keys, e: 1, css: g.css, deck: g.deck }, skin)
      // (The first thing painted covers the whole page.)
      assert.deepEqual(fills[0], ['rgba(11,6,22,0.86)', 0, 0, g.vw, g.vh])
    }
    assert.equal(Z.CORNER_SKIN.outline, '#0b0616')
  })

  it('wears no window: the skin\'s panel is not used', () => {
    const src = readFileSync(join(root, 'render/mapPage.ts'), 'utf8')
    assert.doesNotMatch(src, /skin\.panel|\.panel\(/)
  })
})
