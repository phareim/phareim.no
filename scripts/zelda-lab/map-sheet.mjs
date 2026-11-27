#!/usr/bin/env node
// Neon Shrine MAP page lab: the menu's MAP page (render/mapPage.ts) painted by the real painter from the real
// world's data on the HUD's real grids, with no dev server and no live site. Snap Chromium: outDir must be a
// non-hidden path under $HOME.
//
//   node scripts/zelda-lab/map-sheet.mjs [outDir] [name,name…]
//
// outDir: tmp/shrine-review/map-sheets by default. Without names, all of them:
//   <screen>-<dress>-<case>.png and …-2x.png   one page, at true size (an image px a CSS px) and at twice that.
//       390 × 844 touch in both dresses over the cases below; Seter Fell half walked at 360 × 640, 375 × 667,
//       844 × 390, 667 × 375 (touch) and 1280 × 800 (keys) in both dresses, and the coast at the wide two.
//   world.png                                  the world's chart alone, four times its size: only the coast seen,
//       four lands walked into, all of them, and at night; both dresses.
//   layout.json                                what the layout made of each page: the grid, the boxes, what gave way.
// The scene behind the veil is a picture of the game where BACKDROPS=<dir> (tmp/shrine-review/shots by default)
// has one, else a flat dusk. The touch deck is drawn as plain boxes where it stands in the real shell (DECK below,
// measured there).
// CHROME_BIN=<path> draws with another browser than chromium-browser.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, only] = process.argv.slice(2)
const out = resolve(outArg ?? join(repo, 'tmp/shrine-review/map-sheets'))
const backdrop = join(resolve(process.env.BACKDROPS ?? join(repo, 'tmp/shrine-review/shots')), 'life-390-iso-noon-seterfell-the-big-seter.png')
mkdirSync(out, { recursive: true })

/** The paused deck's buttons on the MAP page in the real shell, CSS px [x, y, w, h], by screen and dress. */
const DECK = {
  '390x844': { classic: [[46, 716, 146, 54], [198, 716, 146, 54], [46, 776, 298, 54]], iso: [[14, 734, 177, 44], [199, 734, 177, 44], [14, 786, 177, 44]] },
  '360x640': { classic: [[31, 512, 146, 54], [183, 512, 146, 54], [31, 572, 298, 54]], iso: [[14, 530, 162, 44], [184, 530, 162, 44], [14, 582, 162, 44]] },
  '375x667': { classic: [[38, 539, 146, 54], [191, 539, 146, 54], [38, 599, 298, 54]], iso: [[14, 557, 170, 44], [192, 557, 170, 44], [14, 609, 170, 44]] },
  '844x390': { classic: [[216, 322, 118, 54], [348, 322, 118, 54], [480, 322, 148, 54]], iso: [[42, 332, 248, 44], [298, 332, 248, 44], [554, 332, 248, 44]] },
  '667x375': { classic: [[128, 307, 118, 54], [260, 307, 118, 54], [392, 307, 148, 54]], iso: [[14, 317, 208, 44], [230, 317, 208, 44], [445, 317, 208, 44]] },
}

// [case, map, from entry, to entry (the walk), how, extra]
const CASES = {
  'fell-arrived': ['seterfell', 'gate-fell', 'ridge', 'arrived'],
  'fell-half': ['seterfell', 'gate-fell', 'ridge', 'half'],
  'fell-full': ['seterfell', 'gate-fell', 'ridge', 'full'],
  coast: ['overworld', 'start', 'shrine', 'half'],
  stillsand: ['stillsand', 'gate-sand', 'bed', 'half'],
  lumenby: ['lumenby', 'gate-quarry', 'hill', 'half', { signs: [1, 2, 4] }],
  'fogstage-names': ['fogstage', 'gate-fog', 'mast', 'full'],
  'fjord-night': ['yulefjord', 'ferry', 'farshore', 'half', { day: 230 }],
  'fjord-before-prism': ['yulefjord', 'ferry', 'farshore', 'half', { day: null }],
  'before-blade': ['overworld', 'start', 'shrine', 'half', { sword: false }],
  underglow2: ['underglow2', 'up', 'down', 'half'],
  shrine: ['shrine', 'start', null, 'half'],
  'inside-fellcave': ['fellcave', 'door', null, 'half'],
  'inside-home': ['home', 'door', null, 'half'],
  sporelight: ['sporelight', 'gate-spore', 'well', 'half'],
}

const PAGES = []
const page = (w, h, dpr, dress, name, keys = false) => PAGES.push({ id: `${w}x${h}-${dress === 'iso' ? 'iso' : '8bit'}-${name}`, w, h, dpr, dress, name, keys })
for (const name of Object.keys(CASES)) if (name !== 'sporelight') page(390, 844, 2, 'iso', name)
for (const name of ['fell-half', 'coast', 'sporelight']) page(390, 844, 2, 'classic', name)
for (const [w, h, dpr, keys] of [[360, 640, 2], [375, 667, 2], [844, 390, 2], [667, 375, 2], [1280, 800, 1, true]]) {
  for (const dress of ['iso', 'classic']) page(w, h, dpr, dress, 'fell-half', keys)
}
for (const [w, h, dpr, keys] of [[844, 390, 2], [1280, 800, 1, true]]) for (const dress of ['iso', 'classic']) page(w, h, dpr, dress, 'coast', keys)

const entry = `
import { WORLD } from ${JSON.stringify(join(repo, 'themes/zelda/world/index.ts'))}
import { createGame } from ${JSON.stringify(join(repo, 'themes/zelda/engine/index.ts'))}
import { enterMap } from ${JSON.stringify(join(repo, 'themes/zelda/engine/game.ts'))}
import { mapInfo, cellIndex, cellRect } from ${JSON.stringify(join(repo, 'themes/zelda/engine/map.ts'))}
import { charted, reveal, revealAround } from ${JSON.stringify(join(repo, 'themes/zelda/engine/explore.ts'))}
import { TILE_INFO } from ${JSON.stringify(join(repo, 'themes/zelda/world/tiles.ts'))}
import { drawMapPage, mapPageFor, atlasBox } from ${JSON.stringify(join(repo, 'themes/zelda/render/mapPage.ts'))}
import { HIRES_WINDOW_SKIN, NEON_SKIN, hudScale } from ${JSON.stringify(join(repo, 'themes/zelda/render/hud.ts'))}
import { KEYBOARD_KEYS, TOUCH_KEYS } from ${JSON.stringify(join(repo, 'themes/zelda/keys.ts'))}

const CASES = ${JSON.stringify(CASES)}
const PAGES = ${JSON.stringify(PAGES)}
const DECK = ${JSON.stringify(DECK)}
const BACK = ${JSON.stringify(existsSync(backdrop) ? 'file://' + backdrop : null)}
const q = new URLSearchParams(location.hash.slice(1))
document.body.style.cssText = 'margin:0;background:#241c30;color:#d8ccf0;font:13px/16px Menlo,Consolas,monospace;overflow:hidden;position:relative'

function el(tag, css, text, parent = document.body) {
  const e = document.createElement(tag)
  e.style.cssText = css
  if (text != null) e.textContent = text
  parent.appendChild(e)
  return e
}

// ---- game states --------------------------------------------------------------------------------------------

/** The tiles of a walk from one entry to another (or to the farthest tile reachable), over what is not solid. */
function walk(map, from, to) {
  const info = mapInfo(WORLD, map)
  const { w, h, base } = info
  const idx = e => Math.floor(e.y) * w + Math.floor(e.x)
  const start = idx(info.entries[from] ?? Object.values(info.entries)[0])
  const goal = to ? idx(info.entries[to]) : -1
  const prev = new Int32Array(w * h).fill(-1)
  prev[start] = start
  const queue = [start]
  let last = start
  const pass = i => !TILE_INFO[base[i]].solid || 'LKXR%;*lbBcPC'.includes(base[i])
  for (let n = 0; n < queue.length; n++) {
    const i = queue[n]
    last = i
    if (i === goal) break
    for (const j of [i - 1, i + 1, i - w, i + w]) {
      if (j < 0 || j >= w * h || prev[j] >= 0 || Math.abs((j % w) - (i % w)) > 1 || !pass(j)) continue
      prev[j] = i
      queue.push(j)
    }
  }
  let at = goal >= 0 && prev[goal] >= 0 ? goal : last
  const path = []
  while (at !== start) { path.push(at); at = prev[at] }
  path.push(start)
  return path.reverse().map(i => ({ x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 }))
}

function see(s, p) {
  const info = mapInfo(WORLD, s.map.id)
  s.hero.x = p.x
  s.hero.y = p.y
  s.exploreAt = undefined
  if (info.def.kind === 'dungeon') reveal(s, s.map.id, info.w, info.h, cellRect(info, cellIndex(info, p.x, p.y)))
  revealAround(s, info.def, info.w, info.h)
}

const seeAll = (s, id) => { const i = mapInfo(WORLD, id); reveal(s, id, i.w, i.h, { x: 0, y: 0, w: i.w, h: i.h }) }
/** A part of a map seen: round each of its entries. */
function seeSome(s, id, n = 99) {
  const i = mapInfo(WORLD, id)
  Object.values(i.entries).slice(0, n).forEach(e => reveal(s, id, i.w, i.h, { x: e.x - 12, y: e.y - 10, w: 26, h: 22 }))
}

function visit(name) {
  const [map, from, to, how, extra = {}] = CASES[name]
  const s = createGame(WORLD, { seed: 7, at: { map: 'overworld', entry: 'start' } })
  s.explored = {}
  s.flags = {}
  s.exploreAt = undefined
  const info = mapInfo(WORLD, map)
  enterMap(WORLD, s, map, info.entries[from] ? from : Object.keys(info.entries)[0], [])
  s.dialog = null
  s.mode = 'play'
  s.daytime = 'day' in extra ? extra.day : 580
  s.inv.sword = extra.sword !== false
  if (charted(info.def)) {
    // Arriving, the game sees round the entry (and a dungeon's room); then the walk.
    s.explored = {}
    see(s, { x: s.hero.x, y: s.hero.y })
    if (how !== 'arrived') {
      const path = walk(map, from, to)
      const upto = how === 'half' ? Math.ceil(path.length * 0.55) : path.length
      for (const p of path.slice(0, upto)) see(s, p)
      if (how === 'full') seeAll(s, map)
      const i = Math.floor(path.length * (how === 'full' ? 0.62 : 0.5))
      const a = path[Math.max(0, i - 1)], b = path[i]
      s.hero.x = b.x
      s.hero.y = b.y
      s.hero.dir = b.x > a.x ? 'right' : b.x < a.x ? 'left' : b.y < a.y ? 'up' : 'down'
      const area = info.def.areas?.find(r => b.x >= r.x && b.x < r.x + r.w && b.y >= r.y && b.y < r.y + r.h)
      if (area) s.area = area.name
      info.chestList.forEach((c, n) => { if (n % 2) s.flags['chest:' + c.id] = true })
    }
  }
  for (const n of extra.signs ?? []) s.flags['q.lumenby.sign' + n] = true
  // The rest of the world: some of it walked before (more where the save is far along).
  if (s.inv.sword && how !== 'arrived') {
    const lands = how === 'full' ? Object.keys(WORLD.atlas) : ['seterfell', 'sporelight', 'lumenby']
    for (const id of ['overworld', 'wildwood', ...lands]) {
      if (id === map) continue
      s.flags['seen:' + id] = true
      if (how === 'full') seeAll(s, id)
      else seeSome(s, id, 3)
    }
  }
  if (s.map.id === map) s.flags['seen:' + map] = true
  return s
}

// ---- painting -----------------------------------------------------------------------------------------------

/** The renderer's own scale for a screen (\`resize\`, \`hudSpace\`). */
function grid(p, skin) {
  const W = Math.round(p.w * p.dpr), H = Math.round(p.h * p.dpr)
  let scale = Math.max(1, Math.floor(Math.min(W / (13 * 16), H / (11 * 16))))
  while (W / scale > 30 * 16) scale++
  const hs = hudScale(scale, W, H, skin.density)
  const vw = Math.ceil(W / hs), vh = Math.ceil(H / hs)
  return { W, H, hs, vw, vh, ox: Math.floor((W - vw * hs) / 2), oy: Math.floor((H - vh * hs) / 2), css: hs / p.dpr }
}

/** A page painted as the renderer paints it: on the HUD's canvas, laid on the screen's. */
function paint(p, s, backImage) {
  const skin = p.dress === 'iso' ? HIRES_WINDOW_SKIN : NEON_SKIN
  const g0 = grid(p, skin)
  const density = skin.density ?? 1
  const hud = document.createElement('canvas')
  hud.width = g0.vw * density
  hud.height = g0.vh * density
  const g = hud.getContext('2d')
  g.imageSmoothingEnabled = false
  g.setTransform(density, 0, 0, density, 0, 0)
  const buttons = p.keys ? null : DECK[p.w + 'x' + p.h][p.dress]
  const deck = buttons ? Math.floor((buttons[0][1] * p.dpr - g0.oy) / g0.hs) : null
  const o = { keys: p.keys ? KEYBOARD_KEYS : TOUCH_KEYS, e: p.dress === 'iso' ? 1 : 0, css: g0.css, deck, safe: {} }
  drawMapPage(g, WORLD, s, g0.vw, g0.vh, o, skin)
  const screen = document.createElement('canvas')
  screen.width = g0.W
  screen.height = g0.H
  const sg = screen.getContext('2d')
  sg.fillStyle = '#2a2450'
  sg.fillRect(0, 0, g0.W, g0.H)
  if (backImage) {
    const k = Math.max(g0.W / backImage.width, g0.H / backImage.height)
    sg.drawImage(backImage, (g0.W - backImage.width * k) / 2, (g0.H - backImage.height * k) / 2, backImage.width * k, backImage.height * k)
  }
  sg.imageSmoothingEnabled = false
  sg.drawImage(hud, g0.ox, g0.oy, g0.vw * g0.hs, g0.vh * g0.hs)
  for (const [i, [x, y, w, h]] of (buttons ?? []).entries()) {
    sg.fillStyle = 'rgba(11,6,22,0.92)'
    sg.fillRect(x * p.dpr, y * p.dpr, w * p.dpr, h * p.dpr)
    sg.strokeStyle = '#2ff3ff'
    sg.lineWidth = 2 * p.dpr
    sg.strokeRect(x * p.dpr, y * p.dpr, w * p.dpr, h * p.dpr)
    sg.fillStyle = '#2ff3ff'
    sg.font = 13 * p.dpr + 'px Menlo, monospace'
    sg.textAlign = 'center'
    sg.fillText(['RESUME', 'ITEMS', 'VIEW'][i] ?? '', (x + w / 2) * p.dpr, (y + h / 2 + 4) * p.dpr)
  }
  const made = mapPageFor(WORLD, s, g0.vw, g0.vh, o, skin)
  return { screen, hud, g0, density, deck, ...made }
}

const load = src => new Promise(r => { if (!src) return r(null); const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src })

async function main() {
  const back = await load(BACK)
  if (q.get('page')) {
    const p = PAGES.find(v => v.id === q.get('page'))
    const r = paint(p, visit(p.name), back)
    r.screen.style.cssText = 'display:block;width:' + p.w + 'px;height:' + p.h + 'px;image-rendering:' + (q.get('x') === '2' ? 'pixelated' : 'auto')
    document.body.appendChild(r.screen)
    const l = r.layout
    window.__info = {
      id: p.id, screen: p.w + 'x' + p.h + '@' + p.dpr, logical: r.g0.vw + 'x' + r.g0.vh, cssPerLogical: +r.g0.css.toFixed(3), density: r.density, deckTop: r.deck, bottom: r.opts.bottom, gave: l.gave,
      land: l.land && { z: l.land.z, x: l.land.x, y: l.land.y, w: l.land.w, h: l.land.h }, tabs: l.tabs, title: [l.title.x, l.title.y, l.title.w, l.title.h], gem: l.gem, gemHit: l.gemHit, plate: l.plate, cap: l.cap,
      stub: l.stub, places: l.places && { x: l.places.x, y: l.places.y, w: l.places.w, h: l.places.h, cols: l.places.cols }, legend: l.legend && { x: l.legend.x, y: l.legend.y, w: l.legend.w, h: l.legend.h, rows: l.legend.rows },
      world: l.world && { x: l.world.x, y: l.world.y, w: l.world.w, h: l.world.h, k: l.world.k }, last: l.last,
    }
  }
  if (q.get('sheet') === 'world') {
    let y = 8
    const states = [
      ['only the coast seen', 'seterfell-no', []],
      ['four lands walked into', 'four', ['wildwood', 'seterfell', 'sporelight', 'lumenby']],
      ['all of them', 'all', Object.keys(WORLD.atlas)],
      ['all of them, at night', 'night', Object.keys(WORLD.atlas)],
    ]
    for (const dress of ['iso', 'classic']) {
      let x = 8, rowH = 0
      for (const [label, how, lands] of states) {
        const s = createGame(WORLD, { seed: 7, at: { map: 'overworld', entry: 'start' } })
        s.explored = {}
        s.flags = {}
        s.exploreAt = undefined
        s.inv.sword = true
        const where = how === 'seterfell-no' ? ['overworld', 'start'] : ['seterfell', 'gate-fell']
        enterMap(WORLD, s, where[0], where[1], [])
        s.daytime = how === 'night' ? 230 : 580
        s.dialog = null
        s.mode = 'play'
        if (how !== 'seterfell-no') for (const id of lands) { s.flags['seen:' + id] = true; if (how === 'four') seeSome(s, id, 4); else seeAll(s, id) }
        seeSome(s, 'overworld', how === 'seterfell-no' ? 2 : 6)
        if (how === 'all' || how === 'night') seeAll(s, 'overworld')
        const p = { w: 390, h: 844, dpr: 2, dress, keys: false }
        const r = paint(p, s, null)
        const w = r.layout.world
        const cw = (w.w + 4) * r.density, ch = (w.h + 4) * r.density
        const c = document.createElement('canvas')
        c.width = cw
        c.height = ch
        c.getContext('2d').drawImage(r.hud, (w.x - 2) * r.density, (w.y - 2) * r.density, cw, ch, 0, 0, cw, ch)
        // Four times the page's own size: 4 image px a CSS px.
        const k = 4 * r.g0.css / r.density
        if (x > 8 && x + cw * k > 3400) { x = 8; y += rowH + 30; rowH = 0 }
        el('div', 'position:absolute;left:' + x + 'px;top:' + y + 'px', (dress === 'iso' ? 'isometric dress, k ' : '8-bit dress, k ') + w.k + ': ' + label)
        c.style.cssText = 'position:absolute;image-rendering:pixelated;background:#14102a;left:' + x + 'px;top:' + (y + 18) + 'px;width:' + cw * k + 'px;height:' + ch * k + 'px'
        document.body.appendChild(c)
        x += cw * k + 16
        rowH = Math.max(rowH, ch * k + 18)
      }
      y += rowH + 30
    }
    window.__size = [3400, y]
  }
  window.__done = true
}
main().catch(e => { document.body.textContent = String(e.stack ?? e); window.__error = String(e.stack ?? e) })
`
const entryFile = join(out, '_map_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_map_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_map.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)

const want = only ? only.split(',') : null
const wanted = id => !want || want.some(w => id === w || id.includes(w))
const b = await launch({ width: 800, height: 600, dpr: 1 })
const info = []
let n = 0
async function open(hash, width, height, dpr) {
  await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false })
  // (A new query each time: a change of hash alone would not run the script again.)
  await b.send('Page.navigate', { url: `file://${html}?${n++}#${hash}` })
  for (let i = 0; i < 200; i++) {
    await b.sleep(50)
    const done = await b.eval('window.__error || window.__done || false')
    if (done === true) return
    if (done) throw new Error(done)
  }
  throw new Error(`${hash}: the page never finished`)
}
try {
  for (const p of PAGES.filter(p => wanted(p.id))) {
    for (const x of [1, 2]) {
      await open(`page=${p.id}&x=${x}`, p.w, p.h, x)
      await b.shot(join(out, `${p.id}${x === 2 ? '-2x' : ''}.png`))
    }
    info.push(await b.eval('window.__info'))
    console.log(p.id)
  }
  if (wanted('world')) {
    await open('sheet=world', 3400, 1200, 1)
    const [w, h] = await b.eval('window.__size')
    await open('sheet=world', w, h, 1)
    await b.shot(join(out, 'world.png'))
    console.log('world')
  }
} finally {
  if (b.errors.length) console.error(b.errors.slice(0, 5))
  await b.close()
}
if (!want) writeFileSync(join(out, 'layout.json'), JSON.stringify(info, null, 1))
