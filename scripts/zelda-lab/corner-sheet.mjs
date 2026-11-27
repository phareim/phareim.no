#!/usr/bin/env node
// Neon Shrine corner lab: the top right corner (render/corner.ts) alone, painted by the real painter from the
// real world's data, with no dev server and no live site. Snap Chromium: outDir must be a non-hidden path under
// $HOME.
//
//   node scripts/zelda-lab/corner-sheet.mjs [outDir] [sheet,sheet…]
//
// outDir: tmp/shrine-review/corner-sheets by default. Sheets (all of them when none is named):
//   map-<id>   one per charted map: the object square and diamond, just arrived (only what `revealAround` sees
//              from an entry), half walked (a walk between two entries) and fully walked, each at true size on a
//              bright and on a dark ground and at 4x (1 L = 8 px)
//   states     every state the painter takes, at 4x
//   backdrop   the object at true size over real pictures of the game, where `cornerLayout` puts it on
//              390 × 844 and 844 × 390 (the pictures: BACKDROPS=<dir>, tmp/shrine-review/shots by default; without
//              them the sheet is left out)
//   chart      each map whole, one px a tile in the corner's inks, seen all and seen from one entry (for
//              judging the ink tables)
// GHOST=0 draws the fog on the chart sheet without the ghost of the land under it, for comparison.
// CHROME_BIN=<path> draws with another browser than chromium-browser.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, only] = process.argv.slice(2)
const out = resolve(outArg ?? join(repo, 'tmp/shrine-review/corner-sheets'))
const backdrops = resolve(process.env.BACKDROPS ?? join(repo, 'tmp/shrine-review/shots'))
mkdirSync(out, { recursive: true })

// The maps a sheet each, with the walk: from one entry to another (null: the farthest tile that can be walked to).
const MAPS = [
  ['overworld', 'start', 'shrine'], ['wildwood', 'town', 'compound'], ['seterfell', 'gate-fell', 'ridge'],
  ['yulefjord', 'ferry', 'farshore'], ['sporelight', 'gate-spore', 'well'], ['stillsand', 'gate-sand', 'bed'],
  ['rerun', 'gate-lawns', 'marina'], ['lumenby', 'gate-quarry', 'hill'], ['fogstage', 'gate-fog', 'mast'],
  ['shrine', 'start', null], ['lab1', 'start', 'down'], ['underglow1', 'up', 'down'], ['underglow2', 'up', 'down'],
  ['underglow3', 'up', null], ['lab1b', 'up', null], ['deep1', 'start', 'up'], ['deep2', 'down', null], ['puzzlelab', 'start', null],
  ['seacave', 'door', null],
]

const entry = `
import { WORLD } from ${JSON.stringify(join(repo, 'themes/zelda/world/index.ts'))}
import { createGame } from ${JSON.stringify(join(repo, 'themes/zelda/engine/index.ts'))}
import { enterMap } from ${JSON.stringify(join(repo, 'themes/zelda/engine/game.ts'))}
import { mapInfo, cellIndex, cellRect } from ${JSON.stringify(join(repo, 'themes/zelda/engine/map.ts'))}
import { reveal, revealAround } from ${JSON.stringify(join(repo, 'themes/zelda/engine/explore.ts'))}
import { TILE_INFO } from ${JSON.stringify(join(repo, 'themes/zelda/world/tiles.ts'))}
import { CORNER_H, CORNER_W, areaTag, chartMarks, cornerLayout, cornerShape, landPasses, paintCorner, refusalTag } from ${JSON.stringify(join(repo, 'themes/zelda/render/corner.ts'))}
import { buildChart, chartLook } from ${JSON.stringify(join(repo, 'themes/zelda/render/worldMap.ts'))}

const MAPS = ${JSON.stringify(MAPS)}
const GHOST = ${process.env.GHOST !== '0'}
const BACK = ${JSON.stringify('file://' + backdrops)}
const q = new URLSearchParams(location.hash.slice(1))
const sheet = q.get('sheet')
const BRIGHT = '#efe3c2', DARK = '#12204a'
document.body.style.cssText = 'margin:0;background:#241c30;color:#d8ccf0;font:13px/16px Menlo,Consolas,monospace;position:relative;overflow:hidden'

function el(tag, css, text, parent = document.body) {
  const e = document.createElement(tag)
  e.style.cssText = css
  if (text != null) e.textContent = text
  parent.appendChild(e)
  return e
}
const label = (x, y, text, css = '') => el('div', 'position:absolute;left:' + x + 'px;top:' + y + 'px;white-space:pre;' + css, text)

// ---- game states --------------------------------------------------------------------------------------------

function game(map, entryId) {
  const s = createGame(WORLD, { seed: 7, at: { map: 'overworld', entry: 'start' } })
  s.explored = {}
  s.flags = {}
  s.exploreAt = undefined
  enterMap(WORLD, s, map, entryId ?? Object.keys(mapInfo(WORLD, map).entries)[0], [])
  s.dialog = null
  s.mode = 'play'
  s.daytime = 580
  return s
}

/** The tiles of a walk from one entry to another (or to the farthest tile reachable), over what is not solid. */
function walk(map, from, to) {
  const info = mapInfo(WORLD, map)
  const { w, h, base } = info
  const idx = e => Math.floor(e.y) * w + Math.floor(e.x)
  const start = idx(info.entries[from])
  const goal = to ? idx(info.entries[to]) : -1
  const prev = new Int32Array(w * h).fill(-1)
  prev[start] = start
  const queue = [start]
  let last = start
  // Locks, gates and what can be cut or blown open do not stop a walk that is only for what it sees.
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
  return { path: path.reverse().map(i => ({ x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5 })), reached: goal < 0 || prev[goal] >= 0 }
}

function see(s, p) {
  const info = mapInfo(WORLD, s.map.id)
  s.hero.x = p.x
  s.hero.y = p.y
  s.exploreAt = undefined
  if (info.def.kind === 'dungeon') { const r = cellRect(info, cellIndex(info, p.x, p.y)); reveal(s, s.map.id, info.w, info.h, r) }
  revealAround(s, info.def, info.w, info.h)
}

function stepTo(s, path, k) {
  const i = Math.max(0, Math.min(path.length - 1, k))
  const a = path[Math.max(0, i - 1)], b = path[i]
  s.hero.x = b.x
  s.hero.y = b.y
  s.hero.dir = b.x > a.x ? 'right' : b.x < a.x ? 'left' : b.y < a.y ? 'up' : 'down'
}

/** 'arrived' | 'half' | 'full' on a map. */
function visit(map, from, to, how) {
  const s = game(map, from)
  if (how === 'arrived') return s
  const info = mapInfo(WORLD, map)
  const { path } = walk(map, from, to)
  if (how === 'full') { reveal(s, map, info.w, info.h, { x: 0, y: 0, w: info.w, h: info.h }); for (const id of Object.keys(WORLD.atlas)) s.flags['seen:' + id] = true }
  else for (const p of path) see(s, p)
  stepTo(s, path, Math.floor(path.length * (how === 'full' ? 0.62 : 0.5)))
  // Some of it done: every second chest opened, a lamp or two of the sign lit.
  info.chestList.forEach((c, i) => { if (i % 2) s.flags['chest:' + c.id] = true })
  return s
}

// ---- painting -----------------------------------------------------------------------------------------------

function picture(s, st) {
  const c = document.createElement('canvas')
  c.width = CORNER_W
  c.height = CORNER_H
  paintCorner(c.getContext('2d'), WORLD, s, { time: 0, ...st })
  return c
}

/** A crop (in L) of a picture at \`k\` CSS px an L, on a ground that is bright on the left of \`split\` and dark past it. */
function show(pic, x, y, crop, k, ground) {
  const box = el('div', 'position:absolute;overflow:hidden;left:' + x + 'px;top:' + y + 'px;width:' + crop.w * k + 'px;height:' + crop.h * k + 'px;background:' + (ground ?? 'linear-gradient(90deg,' + BRIGHT + ' 50%,' + DARK + ' 50%)'))
  const c = document.createElement('canvas')
  c.width = CORNER_W
  c.height = CORNER_H
  c.getContext('2d').drawImage(pic, 0, 0)
  c.style.cssText = 'position:absolute;image-rendering:pixelated;width:' + CORNER_W * k + 'px;height:' + CORNER_H * k + 'px;left:' + -crop.x * k + 'px;top:' + -crop.y * k + 'px'
  box.appendChild(c)
}

const WIDE = { x: CORNER_W - 88, y: 0, w: 88, h: 48 }

// ---- the sheets ---------------------------------------------------------------------------------------------

if (sheet.startsWith('map-')) {
  const id = sheet.slice(4)
  const [, from, to] = MAPS.find(m => m[0] === id)
  const info = mapInfo(WORLD, id)
  const r = walk(id, from, to)
  label(12, 8, id + '  "' + info.def.name + '"  ' + info.w + 'x' + info.h + ' tiles  inks: ' + chartLook(info.def) + '  walk ' + from + ' > ' + (to ?? 'farthest') + (r.reached ? '' : ' (not reached: to the farthest tile)') + '  ' + r.path.length + ' tiles', 'font-weight:bold')
  ;['arrived', 'half', 'full'].forEach((how, row) => {
    const s = visit(id, from, to, how)
    ;[0, 1].forEach((e, col) => {
      const x = 12 + col * 920
      const y = 34 + row * 408
      label(x, y, (e ? 'diamond' : 'square') + ', ' + (how === 'arrived' ? 'just arrived' : how === 'half' ? 'half walked' : 'fully walked') + (info.def.views?.length === 1 && !e ? '  (isometric only in the game: shown unpinned, to judge the chart)' : ''))
      // A land held to one view never shows the other shape in the game: here it is shown unpinned, to judge the chart.
      const def = WORLD.maps[id]
      if (def.views?.length === 1 && !e) WORLD.maps[id] = { ...def, views: undefined }
      const pic = picture(s, { e })
      WORLD.maps[id] = def
      show(pic, x, y + 20, WIDE, 2, BRIGHT)
      show(pic, x, y + 126, WIDE, 2, DARK)
      show(pic, x + 190, y + 20, WIDE, 8)
    })
  })
}

if (sheet === 'states') {
  const COL = 3, CW = 724, PAD = 12
  let x = 0, y = PAD, rowH = 0
  const place = (title, s, st, crop = WIDE, k = 8) => {
    const w = crop.w * k
    if (x && x + w > COL * CW) { x = 0; y += rowH + PAD; rowH = 0 }
    label(PAD + x, y, title)
    show(picture(s, st), PAD + x, y + 18, crop, k)
    x += w + PAD
    rowH = Math.max(rowH, crop.h * k + 18)
  }
  const br = () => { if (x) { x = 0; y += rowH + PAD; rowH = 0 } }
  const head = t => { br(); label(PAD, y, t, 'font-weight:bold;color:#ffd23f'); y += 22 }
  const fell = () => visit('seterfell', 'gate-fell', 'ridge', 'half')
  const TALL = { x: CORNER_W - 88, y: 0, w: 88, h: 72 }
  const FULL = { x: 0, y: 0, w: CORNER_W, h: 72 }

  head('THE SIX SHAPES OF A TURN')
  for (let k = 0; k <= 5; k++) place('step ' + k + '  e=' + (k / 5).toFixed(1), fell(), { e: k / 5 })

  head('THE GEM: THE SUN BY THE DAY CLOCK (square face, diamond face)')
  const GEMBOX = { x: CORNER_W - 18, y: 0, w: 18, h: 18 }
  for (const [name, t] of [['daytime null', null], ['dawn 430', 430], ['morning 500', 500], ['noon 580', 580], ['afternoon 665', 665], ['dusk 30', 30], ['night 230', 230]]) {
    const s = fell()
    s.daytime = t
    place(name, s, { e: 0 }, GEMBOX)
    place('', s, { e: 1 }, { ...GEMBOX, y: 13 })
  }
  br()
  const dull = visit('stillsand', 'gate-sand', 'bed', 'half')
  head('ONE VIEW ONLY (Stillsand): pinned; after a tap on the gem')
  place('pinned', dull, { e: 1 }, TALL)
  place('tapped', dull, { e: 1, tag: refusalTag('ISO') }, TALL)
  const eight = visit('seterfell', 'gate-fell', 'ridge', 'half')
  WORLD.maps.seterfell = { ...WORLD.maps.seterfell, views: ['classic'] }
  place('a map held to 8-bit (no map is; shown for the rule)', eight, { e: 0, tag: refusalTag('8-BIT') }, TALL)
  WORLD.maps.seterfell = { ...WORLD.maps.seterfell, views: ['iso', 'classic'] }

  head('THE STUB (a room: no chart)')
  const hut = game('hut')
  const STUBBOX = { x: CORNER_W - 62, y: 0, w: 62, h: 32 }
  place('8-bit', hut, { e: 0 }, STUBBOX)
  place('isometric', hut, { e: 1 }, STUBBOX)
  place('pressed', hut, { e: 1, pressed: 'chart' }, STUBBOX)
  place('focus', hut, { e: 0, focus: 'chart' }, { ...STUBBOX, h: 44 })
  place('lesson', hut, { e: 1, nudge: 'chart' }, { ...STUBBOX, x: CORNER_W - 88, w: 88, h: 44 })

  head('PRESSED')
  place('chart: the edge goes white', fell(), { e: 1, pressed: 'chart' })
  place('gem: it sinks 1 L', fell(), { e: 1, pressed: 'gem' })
  place('chart, square', fell(), { e: 0, pressed: 'chart' })

  head('KEYBOARD FOCUS, A TAG')
  place('focus on the chart', fell(), { e: 1, focus: 'chart' }, TALL)
  place('focus on the gem', fell(), { e: 1, focus: 'gem' }, TALL)
  place('square, focus on the chart', fell(), { e: 0, focus: 'chart' }, TALL)
  place('square, focus on the gem', fell(), { e: 0, focus: 'gem' }, TALL)
  place('a tag', fell(), { e: 1, tag: 'BIG SETER' }, TALL)
  place('pinned, a tag', dull, { e: 1, tag: refusalTag('ISO') }, TALL)

  head('THE FIRST VISIT')
  place('first: the gem', fell(), { e: 1, nudge: 'gem' }, TALL)
  place('later: the chart', fell(), { e: 1, nudge: 'chart' }, TALL)
  place('first, square', fell(), { e: 0, nudge: 'gem' }, TALL)

  head('STEPPING AWAY (75, 50, 25 %, gone; at once with reduced motion)')
  for (const a of [1, 2, 3]) place('away ' + a, fell(), { e: 1, away: a })
  place('away 4: gone', fell(), { e: 1, away: 4 })

  head('THE ARRIVAL TAG')
  const arne = visit('stillsand', 'camp', 'bed', 'half')
  const camp = mapInfo(WORLD, 'stillsand').entries.camp
  arne.hero.x = camp.x
  arne.hero.y = camp.y
  let longest = ''
  for (const d of Object.values(WORLD.maps)) for (const a of d.areas ?? []) if (areaTag(a.name).length > longest.length) longest = areaTag(a.name)
  place('the longest area name in the world: ' + longest, arne, { e: 1, tag: longest }, FULL)
  place('square', arne, { e: 0, tag: longest }, FULL)
  place('a view after a turn', fell(), { e: 1, tag: 'ISOMETRIC' }, FULL)

  head('LUMENBY: THREE OF SEVEN LETTERS LIT')
  const lum = visit('lumenby', 'gate-quarry', 'hill', 'half')
  for (const n of [1, 2, 4]) lum.flags['q.lumenby.sign' + n] = true
  place('diamond', lum, { e: 1 })
  place('square', lum, { e: 0 })

  head('A CHEST, CLOSED AND OPENED; HEART PIECE LYING AND TAKEN')
  for (const [name, open] of [['closed / lying', false], ['opened / taken', true]]) {
    const s = game('overworld', 'woods')
    const info = mapInfo(WORLD, 'overworld')
    const heart = info.marks.find(m => m.ent.t === 'item' && m.ent.item === 'heartPiece')
    see(s, { x: heart.x + 0.5, y: heart.y + 4.5 })
    const near = info.chestList.filter(c => !c.appear)
    const chest = near.sort((a, b) => Math.hypot(a.x - heart.x, a.y - heart.y) - Math.hypot(b.x - heart.x, b.y - heart.y))[0]
    see(s, { x: chest.x + 0.5, y: chest.y + 1.5 })
    // (East of the two, so neither lies under the gem on either shape.)
    see(s, { x: (chest.x + heart.x) / 2 + 7, y: (chest.y + heart.y) / 2 + 3 })
    if (open) { for (const c of info.chestList) s.flags['chest:' + c.id] = true; s.flags['took:' + heart.ent.id] = true }
    place(name, s, { e: 0 })
    place(name + ', diamond', s, { e: 1 })
    br()
  }

  head('A PASS TAB: TO A LAND SEEN, AND TO ONE NOT YET (Seter Fell, from its middle)')
  for (const [name, seen] of [['lands not seen: hollow', false], ['seen: filled with the land beyond', true]]) {
    const s = visit('seterfell', 'gate-fell', 'ridge', 'half')
    const info = mapInfo(WORLD, 'seterfell')
    reveal(s, 'seterfell', info.w, info.h, { x: 0, y: 0, w: info.w, h: info.h })
    s.hero.x = 36.5
    s.hero.y = 27.5
    if (seen) for (const id of ['yulefjord', 'lumenby', 'sporelight']) s.flags['seen:' + id] = true
    place(name, s, { e: 0 })
    place(name, s, { e: 1 })
    br()
  }
  br()
  window.__size = [COL * CW + PAD, y + rowH + PAD]
}

if (sheet === 'backdrop') {
  const phone = (x, y, w, h, file, css, s, st) => {
    const stage = el('div', 'position:absolute;overflow:hidden;left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;' + css)
    if (file) { const img = el('img', 'display:block;width:' + w + 'px', null, stage); img.src = BACK + '/' + file }
    const shape = cornerShape(WORLD, s, st)
    const lay = cornerLayout(w, h, 1, shape)
    const dpr = 2
    const c = el('canvas', 'position:absolute;image-rendering:pixelated;left:' + lay.canvas.x + 'px;top:' + lay.canvas.y + 'px;width:' + lay.canvas.w + 'px;height:' + lay.canvas.h + 'px', null, stage)
    c.width = lay.canvas.w * dpr
    c.height = lay.canvas.h * dpr
    const g = c.getContext('2d')
    g.setTransform(2 * dpr, 0, 0, 2 * dpr, 0, 0)
    paintCorner(g, WORLD, s, { time: 0, ...st })
  }
  const stand = (map, from, to, how, area, day, flagsFor) => {
    const s = visit(map, from, to, how)
    const a = mapInfo(WORLD, map).def.areas.find(v => v.name === area)
    const { path } = walk(map, from, to)
    const inside = p => p.x >= a.x && p.x < a.x + a.w && p.y >= a.y && p.y < a.y + a.h
    // The walk's tile in that area nearest its middle, else the area's own middle.
    const mid = { x: a.x + a.w / 2, y: a.y + a.h / 2 }
    const p = path.filter(inside).sort((u, v) => Math.hypot(u.x - mid.x, u.y - mid.y) - Math.hypot(v.x - mid.x, v.y - mid.y))[0] ?? mid
    see(s, p)
    s.hero.dir = 'up'
    s.daytime = day
    return s
  }
  const fell = stand('seterfell', 'gate-fell', 'ridge', 'half', 'THE BIG SETER', 580)
  const sand = stand('stillsand', 'gate-sand', 'bed', 'half', 'THE GOLD PYRAMID', 580)
  const fjord = stand('yulefjord', 'ferry', 'farshore', 'half', 'THE HARBOUR', 230)
  label(12, 6, '390 x 844 at true size (u = 1), where cornerLayout puts it:  Seter Fell (noon)  |  Stillsand (pinned, arrival tag)  |  Yule Fjord (night)')
  phone(12, 26, 390, 844, 'life-390-iso-noon-seterfell-the-big-seter.png', '', fell, { e: 1 })
  phone(414, 26, 390, 844, 'life-390-iso-noon-stillsand-the-gold-pyramid.png', '', sand, { e: 1, tag: areaTag('THE GOLD PYRAMID') })
  phone(816, 26, 390, 844, 'life-390-iso-night-yulefjord-the-harbour.png', '', fjord, { e: 1 })
  label(12, 878, '844 x 390 over a crop of the Seter Fell picture: the square (8-bit) and the diamond')
  const crop = 'background:url(' + BACK + '/life-390-iso-noon-seterfell-the-big-seter.png) 0 -330px / 390px 844px repeat'
  phone(12, 898, 844, 390, null, crop, fell, { e: 1, tag: 'BIG SETER' })
  phone(12, 1296, 844, 390, null, crop, fell, { e: 0 })
  label(868, 898, 'the diamond, 390 wide\\nover the same crops')
  phone(868, 940, 390, 220, null, 'background:url(' + BACK + '/life-390-iso-noon-stillsand-the-gold-pyramid.png) -0px -300px / 390px 844px', sand, { e: 1 })
  phone(868, 1172, 390, 220, null, 'background:url(' + BACK + '/life-390-iso-night-yulefjord-the-harbour.png) -0px -300px / 390px 844px', fjord, { e: 1 })
}

if (sheet === 'chart') {
  let y = 8
  for (const [id, from] of MAPS) {
    const info = mapInfo(WORLD, id)
    label(8, y, id + '  inks ' + chartLook(info.def) + '   all seen  |  arrived at ' + from)
    ;[true, false].forEach((all, col) => {
      const s = game(id, from)
      if (all) reveal(s, id, info.w, info.h, { x: 0, y: 0, w: info.w, h: info.h })
      const layer = buildChart(WORLD, s, GHOST)
      const c = el('canvas', 'position:absolute;image-rendering:pixelated;left:' + (8 + col * 540) + 'px;top:' + (y + 18) + 'px;width:' + info.w * 5 + 'px;height:' + info.h * 5 + 'px')
      c.width = info.w
      c.height = info.h
      const g = c.getContext('2d')
      layer.px.forEach((ink, i) => { g.fillStyle = ink; g.fillRect(i % info.w, Math.floor(i / info.w), 1, 1) })
      if (!all) {
        const mark = el('div', 'position:absolute;width:5px;height:5px;background:#ff2fa0;left:' + (8 + col * 540 + Math.floor(s.hero.x) * 5) + 'px;top:' + (y + 18 + Math.floor(s.hero.y) * 5) + 'px')
        void mark
      }
    })
    y += info.h * 5 + 30
  }
  window.__size = [1090, y]
}
`
const entryFile = join(out, '_corner_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_corner_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_corner.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script><script>if (window.__size) document.title = 'size ' + window.__size.join(' ')</script>`)

const chrome = process.env.CHROME_BIN || 'chromium-browser'
const flags = ['--headless=new', '--no-sandbox', ...(process.env.CHROME_BIN ? [] : ['--disable-gpu']), '--hide-scrollbars', '--allow-file-access-from-files', '--virtual-time-budget=4000']
const url = name => `file://${html}#sheet=${name}`
const hasBack = existsSync(join(backdrops, 'life-390-iso-noon-seterfell-the-big-seter.png'))

const all = [...MAPS.map(m => `map-${m[0]}`), 'states', ...(hasBack ? ['backdrop'] : []), 'chart']
const want = only ? only.split(',') : all
for (const name of all.filter(n => want.includes(n))) {
  let size = name.startsWith('map-') ? [1844, 1262] : name === 'backdrop' ? [1270, 1694] : null
  if (!size) {
    // A sheet that lays itself out says how big it came.
    const dom = execFileSync(chrome, [...flags, '--window-size=2200,1000', '--dump-dom', url(name)], { encoding: 'utf8', timeout: 90000, maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'ignore'] })
    const m = /<title>size (\d+) (\d+)<\/title>/.exec(dom)
    if (!m) { console.error(`failed: ${name} did not report its size`); process.exitCode = 1; continue }
    size = [Number(m[1]), Number(m[2])]
  }
  const png = join(out, `${name}.png`)
  // The backdrop's pictures are true size in CSS px; drawn at two device px each, as a phone does.
  const dpr = name === 'backdrop' ? 2 : 1
  try {
    execFileSync(chrome, [...flags, `--force-device-scale-factor=${dpr}`, `--window-size=${size[0]},${size[1]}`, `--screenshot=${png}`, url(name)], { stdio: 'ignore', timeout: 90000 })
    console.log(png)
  } catch (e) {
    console.error(`failed: ${name}: ${e.message}`)
    process.exitCode = 1
  }
}
if (!hasBack && (!only || want.includes('backdrop'))) console.log(`no backdrop sheet: no pictures in ${backdrops}`)
