// The layout matrix: everything that has to fit a screen, laid out on real maps and measured. For every charted map
// (read from the world, so a new one joins by itself) and one interior, on each screen below, in each view of the
// round the map allows:
//   - in play: the top right corner (`cornerLayout`, `renderCorner`) and the HUD's hearts and counters (`drawHud`)
//     lie inside the screen and its safe area, above the deck and off one another, and the corner's buttons are big
//     enough to tap;
//   - in a talk: the dialog box (`drawDialog`) lies inside the screen and off the hearts;
//   - the menu's MAP page (`mapPageFor`) lies inside the screen, above the paused deck, nothing over anything else,
//     with its Prism a target.
// (The corner and the deck are away while a box talks, and the HUD is not drawn on the MAP page, so those never meet.)
// This one matrix stands for the sweeps over screens, maps, views and states the corner and MAP page files held. No
// canvas: the layouts are pure, and the painters run on a stand-in context that keeps what they draw.
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
      contents: `export { WORLD } from './world/index'; export { createGame } from './engine/index'; export { enterMap } from './engine/game'; export { mapInfo } from './engine/map'; export { charted, reveal } from './engine/explore'; export { MAX_HP } from './types'; export { VIEWS } from './views'; export { renderCorner, cornerShape, cornerLayout, cornerTargets, refusalTag, NUDGE_TAG, STAND_CLEAR, VIEW_NOT_LOADED } from './render/corner'; export { drawHud, drawDialog, hudScale, hudFont, NEON_SKIN, HIRES_WINDOW_SKIN } from './render/hud'; export { mapPageFor, mapPageLayout, landGeometry, atlasBox, targetOnScreen } from './render/mapPage'; export { TOUCH_KEYS, KEYBOARD_KEYS } from './keys'; export { textWidth } from '../base/pixel/font'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error', external: ['./render/iso/view'],
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

// ---- the screens --------------------------------------------------------------------------------------------

/**
 * Screens in CSS px with their device ratio. `deck`: where the paused deck's buttons begin on the MAP page, per HUD
 * density (measured in the shell); a screen without one has a keyboard. `safe`: the notch's insets, with the deck
 * lifted by the home indicator.
 */
const SCREENS = [
  { name: 'the smallest phone', w: 360, h: 640, dpr: 2, deck: { 1: 512, 2: 530 } },
  { name: 'a wide phone', w: 844, h: 390, dpr: 3, deck: { 1: 322, 2: 332 } },
  { name: 'a desktop', w: 1280, h: 800, dpr: 1 },
  { name: 'an upright phone', w: 390, h: 844, dpr: 3, deck: { 1: 716, 2: 734 } },
  { name: 'a notched phone', w: 390, h: 844, dpr: 3, deck: { 1: 696, 2: 714 }, safe: { top: 47, bottom: 34 } },
  { name: 'a notched phone on its side', w: 844, h: 390, dpr: 3, deck: { 1: 301, 2: 311 }, safe: { left: 47, right: 47, bottom: 21 } },
]
/** The least room between a heart and anything the corner paints, CSS px (the design has 10 at 390 wide). */
const CLEAR = 8
const EPS = 1e-6

/** A screen's grids for a map and a dress, as the renderer and the shell reckon them (`resize`, `scaleFor`, `hudSpace`, `cornerUnit`). */
function screenOf(scr, def, skin) {
  const W = Math.round(scr.w * scr.dpr)
  const H = Math.round(scr.h * scr.dpr)
  let scale = Math.max(1, Math.floor(Math.min(W / (13 * 16), H / (11 * 16))))
  while (W / scale > 30 * 16) scale++
  const rows = def.rows.length
  if (def.kind === 'interior' && H > W && rows * 16 * scale < H * 0.8) scale = Math.max(scale, Math.min(Math.floor(H / (rows * 16)), Math.floor(W / (10 * 16))))
  const worn = skin.density > 1 && scale < 2 && skin.coarse ? skin.coarse() : skin
  const density = worn.density ?? 1
  const hs = Z.hudScale(scale, W, H, density)
  const vw = Math.ceil(W / hs)
  const vh = Math.ceil(H / hs)
  const ox = Math.floor((W - vw * hs) / 2)
  const oy = Math.floor((H - vh * hs) / 2)
  const fine = scale < 2 ? 0 : Z.hudScale(scale, W, H, 2) / 2 / scr.dpr
  const u = Math.max(Math.round(fine * scr.dpr), Math.ceil(scr.dpr)) / scr.dpr
  const inset = side => Math.ceil(((scr.safe?.[side] ?? 0) * scr.dpr) / hs)
  const safe = { top: inset('top'), left: inset('left'), right: inset('right'), bottom: inset('bottom') }
  const keys = scr.deck ? Z.TOUCH_KEYS : Z.KEYBOARD_KEYS
  const deckTop = scr.deck ? scr.deck[density] : null
  const css = b => ({ x: (ox + b.x * hs) / scr.dpr, y: (oy + b.y * hs) / scr.dpr, w: (b.w * hs) / scr.dpr, h: (b.h * hs) / scr.dpr })
  return { skin: worn, density, hs, vw, vh, ox, oy, u, safe, keys, deckTop, css }
}

// ---- the games ----------------------------------------------------------------------------------------------

const charted = () => Object.entries(Z.WORLD.maps).filter(([, d]) => Z.charted(d)).map(([id]) => id)
/** Every charted map, and a room. */
const MAPS = () => [...charted(), 'hut']
/** The views of the round a map may be shown in. */
const viewsOf = id => Z.VIEWS.filter(v => !Z.WORLD.maps[id].views || Z.WORLD.maps[id].views.includes(v.engine))
const skinOf = view => (view.engine === 'classic' ? Z.NEON_SKIN : Z.HIRES_WINDOW_SKIN)

/** A game with the blade on a map; `all`: every land walked into and seen, else only what the entry shows. */
function game(id, all) {
  const s = Z.createGame(Z.WORLD, { seed: 7, at: { map: 'overworld', entry: 'start' } })
  s.explored = {}
  s.flags = {}
  s.exploreAt = undefined
  Z.enterMap(Z.WORLD, s, id, Object.keys(Z.mapInfo(Z.WORLD, id).entries)[0], [])
  s.dialog = null
  s.mode = 'play'
  s.inv.sword = true
  s.daytime = 580
  if (all) {
    for (const m of [...Object.keys(Z.WORLD.atlas), id]) {
      const i = Z.mapInfo(Z.WORLD, m)
      if (m !== id) s.flags[`seen:${m}`] = true
      Z.reveal(s, m, i.w, i.h, { x: 0, y: 0, w: i.w, h: i.h })
    }
  }
  return s
}

// ---- boxes --------------------------------------------------------------------------------------------------

const meets = (a, b) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS
/** The space between two boxes: negative where they overlap, else the larger of the gaps across and down. */
const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h))
const within = (b, x0, y0, x1, y1) => b.x >= x0 - EPS && b.y >= y0 - EPS && b.x + b.w <= x1 + EPS && b.y + b.h <= y1 + EPS
function inPolygon(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[j]
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside
  }
  return inside
}
const show = b => `${+b.x.toFixed(1)},${+b.y.toFixed(1)} ${+b.w.toFixed(1)}×${+b.h.toFixed(1)}`

/** A stand-in 2D context that keeps what is drawn on it, as rectangles moved by `translate`. */
function recorder(rects) {
  const noop = () => {}
  const stack = []
  let at = { x: 0, y: 0 }
  const target = {
    save: () => stack.push({ ...at }),
    restore: () => { at = stack.pop() ?? at },
    translate: (x, y) => { at = { x: at.x + x, y: at.y + y } },
    fillRect: (x, y, w, h) => rects?.push({ x: x + at.x, y: y + at.y, w, h }),
    drawImage: (c, ...a) => { const [x, y, w, h] = a.length >= 8 ? a.slice(4) : a; rects?.push({ x: x + at.x, y: y + at.y, w: w ?? c.width, h: h ?? c.height }) },
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
  }
  return new Proxy(target, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true } })
}

/** Runs `f` with a document that makes stand-in canvases, as the sprites and the 16-bit font want one. */
function withDocument(f) {
  const had = globalThis.document
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => recorder(null) }) }
  try { return f() } finally { globalThis.document = had }
}

/** The hearts and the counters (and on keys the item box) as `drawHud` draws them, in CSS px. */
function hudBoxes(s, g) {
  return withDocument(() => {
    const rects = []
    const ctx = recorder(rects)
    ctx.translate(g.safe.left, g.safe.top)
    Z.drawHud(ctx, s, g.vw - g.safe.left - g.safe.right, 0, !!g.keys.touch, g.skin, Z.WORLD)
    const n = Math.ceil(s.hero.maxHp / 2)
    return { hearts: rects.slice(0, n).map(g.css), counters: rects.slice(n).map(g.css) }
  })
}

/** What the corner paints, in CSS px: a box for each run of painted px in a row of its canvas. */
function cornerPainted(pic, lay) {
  const out = []
  const L = 2 * lay.u
  for (let y = 0; y < pic.h; y++) {
    for (let x = 0; x < pic.w;) {
      let end = x
      while (end < pic.w && pic.px[y * pic.w + end]) end++
      if (end > x) out.push({ x: lay.canvas.x + x * L, y: lay.canvas.y + y * L, w: (end - x) * L, h: L })
      x = end + 1
    }
  }
  return out
}

/** The dialog box (and its name plate) and the lines of text, as `drawDialog` draws them, in the HUD's logical px. */
function dialogBoxes(s, g, heroRow) {
  const panels = []
  const texts = []
  const F = Z.hudFont(g.skin)
  const font = { width: t => F.width(t), wrap: (t, w) => F.wrap(t, w), draw: (_, text, x, y) => { if (text) texts.push({ x, y, w: F.width(text), h: 7 }) } }
  const skin = { ...g.skin, font, panel: (_, x, y, w, h) => panels.push({ x, y: y + g.safe.top, w, h }), more: undefined, pointer: undefined }
  Z.drawDialog(recorder(null), s, g.vw, g.vh - g.safe.top - g.safe.bottom, heroRow - g.safe.top, g.keys, 0, skin)
  return { panels, texts: texts.map(t => ({ ...t, y: t.y + g.safe.top })) }
}

/** Every talk the world's data holds: each array of lines on a person (their answers too) or a sign. */
function talks() {
  const out = []
  for (const def of Object.values(Z.WORLD.maps)) {
    for (const { ent } of Object.values(def.marks)) {
      for (const t of ent.talk ?? []) for (const lines of [t.lines, ...(t.ask?.replies ?? [])]) if (lines) out.push({ lines, who: ent.look ?? null })
      if (ent.t === 'sign') for (const lines of [ent.lines, ent.alt?.lines]) if (lines) out.push({ lines, who: null })
    }
  }
  return out
}

// ---- the matrix ---------------------------------------------------------------------------------------------

describe('the layout matrix', () => {
  it('the corner and the hearts lie on the screen, above the deck and off one another, the buttons big enough to tap', () => {
    // The widest words the shell puts on the corner's plate (`cornerTag`): a view's name, a refusal, a lesson.
    const tags = [...Z.VIEWS.map(v => v.name), Z.refusalTag('ISO'), Z.refusalTag('8-BIT'), ...Object.values(Z.NUDGE_TAG), Z.STAND_CLEAR, Z.VIEW_NOT_LOADED]
    const tag = tags.sort((a, b) => Z.textWidth(b) - Z.textWidth(a))[0]
    let seen = 0
    for (const id of MAPS()) {
      const s = game(id, true)
      s.hero.maxHp = s.hero.hp = Z.MAX_HP
      Object.assign(s.inv, { bombBag: true, bombs: 30, bits: 999, keys: 9, bigKey: true, disc: true, selected: 'disc' })
      assert.ok(viewsOf(id).length, `${id}: no view of the round`)
      for (const view of viewsOf(id)) {
        const painted = new Map()
        for (const scr of SCREENS) {
          const g = screenOf(scr, Z.WORLD.maps[id], skinOf(view))
          const hud = hudBoxes(s, g)
          const where = `${id}, ${view.id}, ${scr.name} ${scr.w}×${scr.h}`
          assert.equal(hud.hearts.length, Math.ceil(Z.MAX_HP / 2), where)
          assert.ok(hud.counters.length >= 5, `${where}: the counters`)
          for (const b of [...hud.hearts, ...hud.counters]) {
            assert.ok(within(b, scr.safe?.left ?? 0, scr.safe?.top ?? 0, scr.w - (scr.safe?.right ?? 0), g.deckTop ?? scr.h), `${where}: the HUD at ${show(b)}`)
          }
          // At rest, and with all it can carry: the key caps beside a keyboard, the widest words on its plate.
          for (const [n, extra] of [{}, { keys: !g.keys.touch, tag }].entries()) {
            const st = { e: view.engine === 'iso' ? 1 : 0, ...extra }
            const shape = Z.cornerShape(Z.WORLD, s, st)
            const lay = Z.cornerLayout(scr.w, scr.h, g.u, shape, { top: scr.safe?.top ?? 0, right: scr.safe?.right ?? 0 })
            const key = `${n},${!!st.keys}`
            if (!painted.has(key)) painted.set(key, Z.renderCorner(Z.WORLD, s, st))
            const boxes = cornerPainted(painted.get(key), lay)
            assert.ok(boxes.length > 10, `${where}: the corner is painted`)
            for (const b of boxes) {
              assert.ok(within(b, 0, scr.safe?.top ?? 0, scr.w - (scr.safe?.right ?? 0), g.deckTop ?? scr.h), `${where}: the corner paints at ${show(b)}`)
              for (const h of hud.hearts) assert.ok(gap(b, h) >= CLEAR - EPS, `${where}: the corner at ${show(b)}, ${gap(b, h).toFixed(1)} px from a heart`)
              for (const c of hud.counters) assert.ok(!meets(b, c), `${where}: the corner at ${show(b)} over a counter or the item box at ${show(c)}`)
            }
            // The buttons: the menu's (the chart, or the stub indoors) and the gem's, which lies on top.
            const t = Z.cornerTargets(lay)
            const menu = t.map ?? t.pause
            for (const [name, b] of [['the menu', menu], ['the gem', t.view]]) {
              assert.ok(b && b.w >= 44 - EPS && b.h >= 44 - EPS, `${where}: ${name}'s target ${b && show(b)}`)
              assert.ok(within(b, 0, 0, scr.w, scr.h), `${where}: ${name}'s target off the screen at ${show(b)}`)
            }
            assert.ok(within(lay.gem, t.view.x, t.view.y, t.view.x + t.view.w, t.view.y + t.view.h), `${where}: the gem outside its own target`)
            // The chart's button is cut to the frame's shape: a tap beside the diamond falls through to the game.
            if (shape.chart) {
              assert.match(t.clip, /^polygon\(/, `${where}: the menu's clip`)
              if (view.engine === 'iso') assert.ok(!inPolygon(menu.x + 10, menu.y + 6, lay.poly) && inPolygon(menu.x + menu.w / 2, menu.y + menu.h / 2, lay.poly), `${where}: the empty triangle takes the tap`)
            }
            assert.ok(t.view.x - menu.x >= 44 - EPS || menu.y + menu.h - (t.view.y + t.view.h) >= 44 - EPS, `${where}: the gem's target leaves no room to tap the menu`)
            seen++
          }
        }
      }
    }
    assert.ok(seen >= MAPS().length * SCREENS.length * 2, `${seen} corners laid out`)
  })

  it('the dialog box lies on the screen, its words inside it, and off the hearts', () => {
    // The tallest talk the world holds, a person's (with a name plate) and a sign's, asked as a question: the biggest
    // boxes there are.
    const all = talks()
    assert.ok(all.length > 50)
    // Per font, box width and key names: the person's talk and the sign's with the line that wraps to the most rows.
    const found = new Map()
    function biggest(g, inner) {
      const key = `${g.density}|${inner}|${!!g.keys.touch}`
      if (!found.has(key)) {
        const F = Z.hudFont(g.skin)
        const rows = line => F.wrap(line.replace(/\{\w+\}/g, g.keys.a), inner).length
        found.set(key, [true, false].map(person => {
          let best = null
          for (const t of all) if (!!t.who === person) for (const line of t.lines) { const n = rows(line); if (!best || n > best.n) best = { line, who: t.who, n } }
          return best
        }))
      }
      return found.get(key)
    }
    for (const id of MAPS()) {
      const s = game(id, false)
      s.hero.maxHp = s.hero.hp = Z.MAX_HP
      for (const view of viewsOf(id)) {
        for (const scr of SCREENS) {
          const g = screenOf(scr, Z.WORLD.maps[id], skinOf(view))
          const hud = hudBoxes(s, g)
          for (const { line, who } of biggest(g, Math.min(g.vw - 12, 280) - 16)) {
            for (const [side, heroRow] of [['bottom', g.vh * 0.35], ['top', g.vh * 0.8]]) {
              s.dialog = { lines: [line], line: 0, chars: 999, who, ask: { options: ['YES', 'NO'] } }
              const { panels, texts } = dialogBoxes(s, g, heroRow)
              const where = `${id}, ${view.id}, ${scr.name} ${scr.w}×${scr.h}, the box at the ${side}: "${line}"`
              assert.ok(panels.length >= 1 && texts.length >= 3, `${where}: nothing drawn`)
              for (const p of panels) assert.ok(within(p, g.safe.left, g.safe.top, g.vw - g.safe.right, g.vh - g.safe.bottom), `${where}: ${show(p)} on ${g.vw}×${g.vh}`)
              for (const t of texts) assert.ok(panels.some(p => within(t, p.x, p.y, p.x + p.w, p.y + p.h)), `${where}: words outside the box at ${show(t)}`)
              // The 8-bit dress's box at the top lies over the hearts on purpose; every other keeps off them.
              if (side === 'top' && !g.skin.underHud) continue
              for (const p of panels.map(g.css)) for (const h of [...hud.hearts, ...hud.counters]) assert.ok(!meets(p, h), `${where}: ${show(p)} over the HUD at ${show(h)}`)
            }
          }
        }
      }
    }
  })

  /** The MAP page's rules, whatever the screen: on it, above the deck, whole px, nothing over anything else. */
  function checkPage(l, where) {
    const p = l.layout
    const o = l.opts
    const f = o.density
    const safe = o.safe ?? { top: 0, left: 0, right: 0 }
    const parts = ['tabs', 'title', 'land', 'gem', 'plate', 'cap', 'stub', 'places', 'legend', 'world', 'last'].filter(k => p[k]).map(k => [k, p[k]])
    for (const [i, c] of (p.world?.caption ?? []).entries()) parts.push([`caption ${i}`, c])
    assert.ok(p.title.w > 0, `${where}: nothing laid out`)
    for (const [name, b] of parts) {
      const at = `${where}: ${name} ${show(b)} on ${l.vw}×${l.vh}, bottom ${o.bottom}`
      assert.ok(within(b, safe.left, safe.top, l.vw - safe.right, Math.min(o.bottom, l.vh)), at)
      for (const v of [b.x, b.y, b.w, b.h]) assert.ok(Number.isInteger(v * f), `${at}: not whole px of its grid`)
    }
    // (The caption may lie in the chart's empty corner, the Prism on the land's corner, and on the diamond the plate
    // and the V cap hang in the empty corner of the land's box.)
    const list = parts.filter(([n]) => !n.startsWith('caption'))
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, A] = list[i]
        const [b, B] = list[j]
        if (a === 'land' && (b === 'gem' || (o.iso && (b === 'plate' || b === 'cap')))) continue
        assert.ok(!meets(A, B), `${where}: ${a} over ${b}`)
      }
    }
    for (const e of [...(p.places?.entries ?? []), ...(p.legend?.entries ?? [])]) assert.ok(within({ ...e, h: 7 }, 0, 0, l.vw, o.bottom), `${where}: an entry off the page`)
    const entries = p.places?.entries ?? []
    for (let i = 0; i < entries.length; i++) for (let j = i + 1; j < entries.length; j++) {
      assert.ok(!meets({ ...entries[i], h: 11 }, { ...entries[j], h: 11 }), `${where}: two places over each other`)
    }
    const grid = Z.atlasBox(Z.WORLD)
    for (const c of p.world?.caption ?? []) {
      for (const r of grid.rects) {
        const land = { x: p.world.x + (r.x - grid.x0) / p.world.k / f, y: p.world.y + (r.y - grid.y0) / p.world.k / f, w: r.w / p.world.k / f, h: r.h / p.world.k / f }
        assert.ok(!meets(c, land), `${where}: the caption over ${r.id}`)
      }
    }
    assert.ok(p.legend || !o.content.legend.length, `${where}: the legend's glyphs always stay`)
  }

  const pageFor = (s, g, view) => ({ ...g, ...Z.mapPageFor(Z.WORLD, s, g.vw, g.vh, { keys: g.keys, e: view.engine === 'iso' ? 1 : 0, css: g.hs / g.dpr, deck: g.deckTop == null ? null : Math.floor((g.deckTop * g.dpr - g.oy) / g.hs), safe: g.safe }, g.skin) })

  it('the MAP page lies on the screen above the deck, nothing over anything else, and its Prism is a target', () => {
    for (const id of MAPS()) {
      for (const s of [game(id, false), game(id, true)]) {
        const info = Z.mapInfo(Z.WORLD, id)
        for (const view of viewsOf(id)) {
          for (const scr of SCREENS) {
            const g = { ...screenOf(scr, Z.WORLD.maps[id], skinOf(view)), dpr: scr.dpr }
            const l = pageFor(s, g, view)
            const where = `${id}, ${view.id}, ${scr.name} ${scr.w}×${scr.h}, ${Object.keys(s.flags).length ? 'all seen' : 'arrived'}`
            checkPage(l, where)
            const p = l.layout
            if (!Z.charted(Z.WORLD.maps[id])) {
              assert.ok(p.stub && !p.land && !p.gem && !p.gemHit, `${where}: a room is a stub with no Prism`)
              continue
            }
            // The whole map in its box, whole fine px a tile and never under one L.
            assert.ok(p.land && Number.isInteger(p.land.z) && p.land.z >= g.density, `${where}: the land ${p.land?.z}`)
            const geo = Z.landGeometry(info, p.land.z, l.opts.iso, g.density)
            assert.deepEqual([p.land.w * g.density, p.land.h * g.density], [geo.w, geo.h], where)
            // The Prism: a target of 44 CSS px or more where the shell lays its button, on screen, over nothing else.
            assert.ok(p.gem && p.plate && p.gemHit, `${where}: the Prism and its plate`)
            const hit = Z.targetOnScreen(p.gemHit, { scale: g.hs, ox: g.ox, oy: g.oy }, scr.dpr, { w: scr.w, h: scr.h })
            assert.ok(hit.w >= 44 - EPS && hit.h >= 44 - EPS, `${where}: the target ${show(hit)}`)
            assert.ok(within(hit, 0, 0, scr.w, g.deckTop ?? scr.h), `${where}: the target at ${show(hit)}`)
            for (const part of ['tabs', 'places', 'legend', 'world', 'last']) if (p[part]) assert.ok(!meets(p.gemHit, p[part]), `${where}: the target over ${part}`)
          }
        }
      }
    }
  })

  it('a MAP page squeezed row by row gives the list and the words up before the world', () => {
    const [scr] = SCREENS
    for (const view of viewsOf('seterfell')) {
      const g = { ...screenOf(scr, Z.WORLD.maps.seterfell, skinOf(view)), dpr: scr.dpr }
      const l = pageFor(game('seterfell', true), g, view)
      const seen = []
      // The deck creeps up the screen until the world no longer fits.
      for (let bottom = l.opts.bottom; bottom >= 90; bottom--) {
        const opts = { ...l.opts, bottom }
        const layout = Z.mapPageLayout(g.vw, g.vh, opts, Z.atlasBox(Z.WORLD))
        checkPage({ ...l, opts, layout }, `${view.id} squeezed to ${bottom} of ${g.vw}×${g.vh}`)
        seen.push(layout.gave)
        if (layout.gave.includes('world')) break
      }
      const said = [...new Set(seen.map(v => v.join(',')))].join(' | ')
      assert.ok(seen.at(-1).includes('world') && seen.at(-1).includes('places') && seen.at(-1).includes('words'), `${view.id}: ${said}`)
      assert.ok(seen.some(v => v.includes('places') && !v.includes('world')), `${view.id}: ${said}`)
    }
  })
})
