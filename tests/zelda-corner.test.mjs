// The top right corner (`themes/zelda/render/corner.ts`, painted by the shell's `stepCorner`): where it lies on a screen,
// the shapes of its frame, what its chart marks, the one-view rule, the sun in the gem, and the ink tables of the
// chart (`render/worldMap.ts`). No canvas: the painter's picture is colours (`renderCorner`), and the HUD's hearts
// are measured from what `drawHud` draws on a stand-in context.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
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
      contents: `export { WORLD } from './world/index'; export { createGame } from './engine/index'; export { enterMap } from './engine/game'; export { mapInfo } from './engine/map'; export { charted, reveal, seenTile, CHUNK } from './engine/explore'; export { DAY, DAY_LENGTH } from './engine/day'; export { TILE_INFO } from './world/tiles'; export { MAX_HP, START_HP } from './types'; export { REALM_LOOKS } from './render/looks'; export * from './render/corner'; export { CHART_INKS, chartLook, buildChart, fogInks, chartInks, NIGHT_INK, NIGHT_MIX } from './render/worldMap'; export { drawHud, hudScale, NEON_SKIN, HIRES_WINDOW_SKIN } from './render/hud'; export { textWidth } from '../base/pixel/font'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

// ---- helpers ------------------------------------------------------------------------------------------------

function game(map, entry) {
  const s = Z.createGame(Z.WORLD, { seed: 7, at: { map: 'overworld', entry: 'start' } })
  s.explored = {}
  s.flags = {}
  s.exploreAt = undefined
  Z.enterMap(Z.WORLD, s, map, entry ?? Object.keys(Z.mapInfo(Z.WORLD, map).entries)[0], [])
  s.explored = {}
  s.dialog = null
  s.mode = 'play'
  return s
}
const seeAll = s => { const i = Z.mapInfo(Z.WORLD, s.map.id); Z.reveal(s, s.map.id, i.w, i.h, { x: 0, y: 0, w: i.w, h: i.h }) }
const seeTile = (s, x, y) => { const i = Z.mapInfo(Z.WORLD, s.map.id); Z.reveal(s, s.map.id, i.w, i.h, { x, y, w: 1, h: 1 }) }
const chartedMaps = () => Object.entries(Z.WORLD.maps).filter(([, d]) => Z.charted(d)).map(([id]) => id)
const longestName = () => Object.values(Z.WORLD.maps).flatMap(d => (d.areas ?? []).map(a => Z.areaTag(a.name))).sort((a, b) => Z.textWidth(b) - Z.textWidth(a))[0]

/**
 * The corner's unit on a screen, as the renderer and the shell reckon it (`resize`, `scaleFor`, `fineUnit`,
 * `cornerUnit`; the shell's own formulas are pinned in 'the corner in the shell'). `rows`: an interior that many
 * rows tall, whose scale the renderer raises on a tall screen.
 */
function screenOf(w, h, dpr, rows = 0) {
  const W = Math.round(w * dpr)
  const H = Math.round(h * dpr)
  let scale = Math.max(1, Math.floor(Math.min(W / (13 * 16), H / (11 * 16))))
  while (W / scale > 30 * 16) scale++
  if (rows && H > W && rows * 16 * scale < H * 0.8) scale = Math.max(scale, Math.min(Math.floor(H / (rows * 16)), Math.floor(W / (10 * 16))))
  const fine = scale < 2 ? 0 : Z.hudScale(scale, W, H, 2) / 2 / dpr
  const u = Math.max(Math.round(fine * dpr), Math.ceil(dpr)) / dpr
  return { w, h, dpr, W, H, scale, u }
}
const SCREENS = [[390, 844, 3], [390, 844, 2], [375, 667, 2], [375, 667, 3], [360, 640, 2], [360, 640, 3], [360, 640, 2.625], [844, 390, 3], [667, 375, 2], [1280, 800, 1], [1280, 800, 2]]

/** Every shape the corner can take. */
function shapes() {
  const long = longestName()
  const out = []
  for (let k = 0; k <= 5; k++) out.push([`charted, step ${k}`, { chart: true, e: k / 5, pinned: null }])
  out.push(['charted square, keys and a tag', { chart: true, e: 0, pinned: null, keys: true, tag: long }])
  out.push(['charted diamond, keys and a tag', { chart: true, e: 1, pinned: null, keys: true, tag: long }])
  out.push(['pinned diamond', { chart: true, e: 1, pinned: 'ISO' }])
  out.push(['pinned diamond, refused', { chart: true, e: 1, pinned: 'ISO', tag: 'ISO ONLY HERE', keys: true }])
  out.push(['pinned square', { chart: true, e: 0, pinned: '8-BIT', tag: '8-BIT ONLY HERE' }])
  for (let k = 0; k <= 5; k++) out.push([`pinned, turning, step ${k}`, { chart: true, e: k / 5, pinned: 'ISO' }])
  out.push(['stub square', { chart: false, e: 0, pinned: null }])
  out.push(['stub diamond', { chart: false, e: 1, pinned: null, keys: true, tag: 'TAP MAP: MENU' }])
  return out
}

function inPolygon(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[j]
    if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside
  }
  return inside
}
const meet = (a, b) => a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6

/** A 44 × 44 CSS px square wholly inside the polygon and clear of `above`, or null. (The polygon is rectilinear, on the 2u grid.) */
function freeSquare(lay, above) {
  const { u, menu, poly } = lay
  const cell = 2 * u
  const cols = Math.round(menu.w / cell)
  const rows = Math.round(menu.h / cell)
  const inside = []
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) inside.push(inPolygon(menu.x + (i + 0.5) * cell, menu.y + (j + 0.5) * cell, poly))
  const n = Math.ceil(44 / cell - 1e-9)
  for (let j = 0; j + n <= rows; j++) {
    for (let i = 0; i + n <= cols; i++) {
      const sq = { x: menu.x + i * cell, y: menu.y + j * cell, w: 44, h: 44 }
      if (meet(sq, above)) continue
      let ok = true
      for (let b = 0; b < n && ok; b++) for (let a = 0; a < n; a++) if (!inside[(j + b) * cols + i + a]) { ok = false; break }
      if (ok) return sq
    }
  }
  return null
}

/** A stand-in 2D context that keeps what is drawn on it, as rectangles. */
function recorder(rects) {
  const noop = () => {}
  const target = {
    fillRect: (x, y, w, h) => rects?.push({ x, y, w, h }),
    drawImage: (c, ...a) => { const [x, y, w, h] = a.length >= 8 ? a.slice(4) : a; rects?.push({ x, y, w: w ?? c.width, h: h ?? c.height }) },
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
  }
  return new Proxy(target, { get: (t, p) => (p in t ? t[p] : noop), set: (t, p, v) => { t[p] = v; return true } })
}

/** The boxes, in CSS px, of the hearts and of the counters under them as `drawHud` draws them on a screen in a skin. */
function hudBoxes(scr, skin, maxHp) {
  const had = globalThis.document
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => recorder(null) }) }
  try {
    const s = game('shrine', 'start')
    Object.assign(s.inv, { sword: true, bombBag: true, bombs: 30, bits: 999, keys: 9, bigKey: true })
    s.hero.maxHp = s.hero.hp = maxHp
    const rects = []
    const hs = Z.hudScale(scr.scale, scr.W, scr.H, skin.density)
    const vw = Math.ceil(scr.W / hs)
    const ox = Math.floor((scr.W - vw * hs) / 2)
    const oy = Math.floor((scr.H - Math.ceil(scr.H / hs) * hs) / 2)
    Z.drawHud(recorder(rects), s, vw, 0, true, skin, Z.WORLD)
    const css = r => ({ x: (ox + r.x * hs) / scr.dpr, y: (oy + r.y * hs) / scr.dpr, w: (r.w * hs) / scr.dpr, h: (r.h * hs) / scr.dpr })
    const n = Math.ceil(maxHp / 2)
    return { hearts: rects.slice(0, n).map(css), counters: rects.slice(n).map(css) }
  } finally {
    globalThis.document = had
  }
}

/** The space between two boxes: negative where they overlap, else the larger of the gaps across and down. */
const gap = (a, b) => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h))

// ---- the layout ---------------------------------------------------------------------------------------------

describe('the corner on a screen', () => {
  it('takes one CSS px for u on a phone and two on a desktop', () => {
    for (const [w, h, dpr] of SCREENS) {
      const { u } = screenOf(w, h, dpr)
      if (w === 1280) assert.equal(u, 2, `${w}x${h}@${dpr}`)
      else if (dpr !== 2.625) assert.equal(u, 1, `${w}x${h}@${dpr}`)
      else assert.ok(u >= 1 && u < 1.2)
    }
  })

  it('hangs 14 px from the top and the right, inside the safe area, every number a whole number of u and inside the viewport', () => {
    for (const [w, h, dpr] of SCREENS) {
      const { u } = screenOf(w, h, dpr)
      for (const safe of [{}, { top: 47, right: 0 }, { top: 0, right: 47 }]) {
        for (const [name, sh] of shapes()) {
          const lay = Z.cornerLayout(w, h, u, sh, safe)
          const at = `${w}x${h}@${dpr} ${name} ${JSON.stringify(safe)}`
          const boxes = ['canvas', 'frame', 'menu', 'gem', 'gemHit', 'plate', 'tag', 'stub'].map(k => [k, lay[k]]).filter(([, b]) => b)
          for (const [k, b] of boxes) {
            for (const v of [b.x, b.y, b.w, b.h]) assert.ok(Math.abs(v / u - Math.round(v / u)) < 1e-6, `${at}: ${k} ${v} is no whole number of u`)
            assert.ok(b.x >= -1e-6 && b.y >= -1e-6 && b.x + b.w <= w + 1e-6 && b.y + b.h <= h + 1e-6, `${at}: ${k} ${JSON.stringify(b)} leaves the viewport`)
          }
          for (const [x, y] of lay.poly) {
            assert.ok(Math.abs(x / u - Math.round(x / u)) < 1e-6 && Math.abs(y / u - Math.round(y / u)) < 1e-6, `${at}: a polygon point off the grid`)
            assert.ok(x >= 0 && x <= w && y >= 0 && y <= h, `${at}: a polygon point outside`)
          }
          const right = w - 14 - (safe.right ?? 0)
          const top = 14 + (safe.top ?? 0)
          if (sh.chart) {
            assert.ok(lay.frame.x + lay.frame.w <= right + 1e-6 && lay.frame.x + lay.frame.w > right - u, `${at}: the frame's right edge`)
            assert.ok(lay.frame.y >= top - 1e-6 && lay.frame.y < top + u, `${at}: the frame's top`)
          }
          assert.ok(lay.gem.x + lay.gem.w <= right + 1e-6 && lay.gem.y >= top - 1e-6, `${at}: the gem keeps the margin`)
          assert.equal(lay.stub === null, sh.chart)
          // (The plate hangs free of the glass: from the diamond's tip, or beside the stub.)
          assert.equal(lay.plate === null, !sh.pinned || (sh.chart && Z.turnStep(sh.e) < Z.TURN_STEPS))
          assert.equal(lay.tag === null, !sh.tag)
        }
      }
    }
  })

  it('gives the menu and the gem a target of 44 × 44 CSS px in every state, the gem on top', () => {
    for (const [w, h, dpr] of SCREENS) {
      const { u } = screenOf(w, h, dpr)
      for (const [name, sh] of shapes()) {
        const lay = Z.cornerLayout(w, h, u, sh)
        const at = `${w}x${h}@${dpr} ${name}`
        assert.ok(lay.gemHit.w >= 44 && lay.gemHit.h >= 44, `${at}: the gem's target is ${lay.gemHit.w} x ${lay.gemHit.h}`)
        assert.ok(freeSquare(lay, lay.gemHit), `${at}: no 44 x 44 square of the menu's target is free of the gem's`)
        // The gem's target holds the gem, and the plate under it when pinned.
        assert.ok(lay.gemHit.x <= lay.gem.x && lay.gemHit.x + lay.gemHit.w >= lay.gem.x + lay.gem.w, `${at}: the gem sideways`)
        assert.ok(lay.gemHit.y <= lay.gem.y && lay.gemHit.y + lay.gemHit.h >= lay.gem.y + lay.gem.h - 1e-6, `${at}: the gem up and down`)
        if (lay.plate) {
          assert.ok(lay.gemHit.y + lay.gemHit.h >= lay.plate.y + lay.plate.h - 1e-6, `${at}: the target stops short of the plate`)
          assert.ok(lay.gemHit.x <= lay.plate.x + 1e-6 && lay.gemHit.x + lay.gemHit.w >= lay.plate.x + lay.plate.w - 1e-6, `${at}: the plate's side is not the gem's`)
          assert.ok(lay.gemHit.y <= lay.plate.y + 1e-6)
        }
        else assert.ok(Math.abs(lay.gemHit.h - 44 * u) < 1e-6 && Math.abs(lay.gemHit.w - 44 * u) < 1e-6)
      }
    }
  })

  it('shapes the menu target as the frame with its ink ring, so a tap beside the diamond falls through', () => {
    for (const [name, sh] of shapes()) {
      const lay = Z.cornerLayout(390, 844, 1, sh)
      const parts = Z.cornerParts(sh)
      const f = parts.frame
      const mask = sh.chart ? Z.frameMask(parts.step) : null
      const body = (x, y) => {
        const i = x - f.x
        const j = y - f.y
        if (i < 0 || j < 0 || i >= f.w || j >= f.h) return false
        if (mask) return Math.abs(i + 0.5 - f.w / 2) <= mask.half[j]
        return !((i === 0 || i === f.w - 1) && (j === 0 || j === f.h - 1))
      }
      for (let y = 0; y < Z.CORNER_H; y++) {
        for (let x = 0; x < Z.CORNER_W; x++) {
          const ring = body(x, y) || body(x - 1, y) || body(x + 1, y) || body(x, y - 1) || body(x, y + 1)
          const got = inPolygon(lay.canvas.x + x * 2 + 1, lay.canvas.y + y * 2 + 1, lay.poly)
          assert.equal(got, ring, `${name}: px ${x},${y}`)
        }
      }
    }
    const lay = Z.cornerLayout(390, 844, 1, { chart: true, e: 1, pinned: null })
    assert.ok(!inPolygon(lay.menu.x + 10, lay.menu.y + 6, lay.poly), 'the empty triangle at the top left')
    assert.ok(!inPolygon(lay.menu.x + 10, lay.menu.y + lay.menu.h - 6, lay.poly), 'the empty triangle at the bottom left')
    assert.ok(inPolygon(lay.menu.x + lay.menu.w / 2, lay.menu.y + lay.menu.h / 2, lay.poly))
    // At 390 wide the boxes of the design.
    assert.deepEqual(lay.frame, { x: 216, y: 14, w: 160, h: 80 })
    assert.deepEqual(lay.menu, { x: 214, y: 12, w: 164, h: 84 })
    assert.deepEqual(lay.gemHit, { x: 340, y: 32, w: 44, h: 44 })
    assert.deepEqual(Z.cornerLayout(390, 844, 1, { chart: true, e: 0, pinned: null }).frame, { x: 296, y: 14, w: 80, h: 80 })
    // Pinned: down over the plate, and left over all of it (x 334..376).
    assert.deepEqual(Z.cornerLayout(390, 844, 1, { chart: true, e: 1, pinned: 'ISO' }).gemHit, { x: 334, y: 32, w: 50, h: 70 })
    assert.deepEqual(Z.cornerLayout(390, 844, 1, { chart: true, e: 1, pinned: 'ISO' }).plate, { x: 334, y: 76, w: 42, h: 26 })
    assert.deepEqual(Z.cornerLayout(390, 844, 1, { chart: false, e: 0, pinned: null }).frame, { x: 278, y: 14, w: 48, h: 48 })
  })

  /**
   * All the chart could ever paint above the plates: the frame, three L round it (a pass tab reaches two past the
   * edge, the focus ring one more), and the gem with its ring.
   */
  function envelope(lay, sh) {
    const L = 2 * lay.u
    const parts = Z.cornerParts(sh)
    const f = parts.frame
    const mask = sh.chart ? Z.frameMask(parts.step) : null
    const out = []
    for (let j = 0; j < f.h; j++) {
      const half = mask ? mask.half[j] : f.w / 2
      out.push({ x: lay.frame.x + (f.w / 2 - half - 3) * L, y: lay.frame.y + (j - 3) * L, w: (2 * half + 6) * L, h: 7 * L })
    }
    if (lay.gem) out.push({ x: lay.gem.x - 2 * L, y: lay.gem.y - 2 * L, w: lay.gem.w + 4 * L, h: lay.gem.h + 4 * L })
    return out
  }

  it('has nothing left of x = 196 above y = 60 at 390 wide', () => {
    for (const dpr of [2, 3]) {
      for (const [name, sh] of shapes()) {
        const lay = Z.cornerLayout(390, 844, screenOf(390, 844, dpr).u, sh)
        for (const b of envelope(lay, sh)) if (b.y < 60) assert.ok(b.x >= 196, `${name}: paints at x ${b.x}, y ${b.y}`)
        for (const b of [lay.plate, lay.tag]) if (b && b.y < 60) assert.ok(b.x >= 196, name)
      }
    }
  })

  it('keeps the same clearance from the real boxes of the hearts at 375 and 360 wide, in both HUD skins, and off the counters', () => {
    const skins = { classic: Z.NEON_SKIN, '16-bit': Z.HIRES_WINDOW_SKIN }
    // Ten hearts end where they end at 390; the design's 196 is this much past them.
    const ten = hudBoxes(screenOf(390, 844, 3), Z.HIRES_WINDOW_SKIN, 20).hearts
    assert.equal(ten.length, 10)
    const end = Math.max(...ten.map(b => b.x + b.w))
    assert.equal(end, 186)
    const clearance = 196 - end
    for (const [w, h, dpr] of [[390, 844, 3], [390, 844, 2], [375, 667, 2], [375, 667, 3], [360, 640, 2], [360, 640, 3], [360, 640, 2.625]]) {
      const scr = screenOf(w, h, dpr)
      for (const [skinName, skin] of Object.entries(skins)) {
        for (const hp of [Z.START_HP, 20, Z.MAX_HP]) {
          const hud = hudBoxes(scr, skin, hp)
          assert.equal(hud.hearts.length, Math.ceil(hp / 2))
          assert.ok(hud.counters.length >= 5)
          for (const [name, sh] of shapes()) {
            const lay = Z.cornerLayout(w, h, scr.u, sh)
            const painted = [...envelope(lay, sh), ...[lay.plate, lay.tag].filter(Boolean)]
            for (const b of painted) {
              for (const heart of hud.hearts) assert.ok(gap(b, heart) >= clearance - 1e-6, `${w}@${dpr} ${skinName} hp ${hp}, ${name}: ${gap(b, heart).toFixed(1)} px from a heart`)
              for (const c of hud.counters) assert.ok(gap(b, c) >= 0, `${w}@${dpr} ${skinName} hp ${hp}, ${name}: over a counter ${JSON.stringify(c)}`)
            }
          }
        }
      }
    }
  })

  it('paints nothing outside that envelope above the plates, whatever the land', () => {
    for (const id of chartedMaps()) {
      const s = game(id)
      seeAll(s)
      for (const e of [0, 0.4, 1]) {
        const st = { e, focus: 'chart', keys: true }
        const sh = Z.cornerShape(Z.WORLD, s, st)
        const lay = Z.cornerLayout(390, 844, 1, sh)
        const boxes = envelope(lay, sh)
        const parts = Z.cornerParts(sh)
        const pic = Z.renderCorner(Z.WORLD, s, st)
        pic.px.forEach((c, i) => {
          if (!c) return
          const x = i % pic.w
          const y = Math.floor(i / pic.w)
          // (The plate and the key caps are boxes of their own.)
          if ([parts.plate, parts.chain && { ...parts.chain, x: parts.chain.x - 1, w: 4 }, parts.tag, parts.keyM, parts.keyV].some(b => b && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return
          const css = { x: lay.canvas.x + x * 2, y: lay.canvas.y + y * 2, w: 2, h: 2 }
          assert.ok(boxes.some(b => css.x >= b.x && css.y >= b.y && css.x + 2 <= b.x + b.w && css.y + 2 <= b.y + b.h), `${id} e ${e}: px ${x},${y}`)
        })
      }
    }
  })
})

// ---- the frame and the chart's grid -------------------------------------------------------------------------

describe('the frame', () => {
  it('turns from a square to a 2:1 diamond in five steps', () => {
    assert.deepEqual([0, 0.09, 0.11, 0.5, 0.89, 0.91, 1].map(Z.turnStep), [0, 0, 1, 3, 4, 5, 5])
    assert.deepEqual([0, 1, 2, 3, 4, 5].map(k => Z.frameMask(k).w), [40, 48, 56, 64, 72, 80])
    const d = Z.frameMask(5)
    assert.deepEqual(d.half.slice(0, 20), Array.from({ length: 20 }, (_, y) => 2 * (y + 1)))
  })

  it('is symmetric, and every edge runs along an axis or 2:1', () => {
    for (let k = 0; k <= 5; k++) {
      const m = Z.frameMask(k)
      assert.equal(m.h, 40)
      assert.equal(m.half.length, 40)
      for (let y = 0; y < 40; y++) {
        assert.equal(m.half[y], m.half[39 - y], `step ${k}: top and bottom, row ${y}`)
        assert.ok(Number.isInteger(m.half[y]) && m.half[y] <= m.w / 2, `step ${k} row ${y}`)
      }
      assert.equal(Math.max(...m.half), m.w / 2)
      for (let y = 0; y < 19; y++) {
        const d = m.half[y + 1] - m.half[y]
        // 2:1 (two px a row) until the side, which is upright. The last step into the side may be one px: a notch.
        assert.ok(d === 0 ? m.half[y] === m.w / 2 : d === 2 || (d === 1 && m.half[y + 1] === m.w / 2), `step ${k} row ${y}: ${d}`)
      }
    }
  })

  it('lays one tile on one px in both views', () => {
    for (const step of [0, 5]) {
      const p = Z.chartProjection(step)
      const seen = new Set()
      for (let j = -20; j < 20; j++) {
        for (let i = -20; i < 20; i++) {
          const [u, v] = p.to(i, j)
          assert.deepEqual(p.from(u, v).map(n => n + 0), [i, j], `step ${step}: tile ${i},${j}`)
          seen.add(`${u},${v}`)
        }
      }
      assert.equal(seen.size, 1600)
    }
  })
})

// ---- the marks ----------------------------------------------------------------------------------------------

describe('the chart\'s marks', () => {
  const find = (marks, kind, x, y) => marks.find(m => m.kind === kind && m.x === x && m.y === y)

  it('has the hero with their facing, and nothing else in a square not seen', () => {
    for (const id of chartedMaps()) {
      const s = game(id)
      s.hero.dir = 'left'
      const marks = Z.chartMarks(Z.WORLD, s)
      assert.deepEqual(marks[0], { kind: 'hero', x: Math.floor(s.hero.x), y: Math.floor(s.hero.y), state: 'left' })
      assert.deepEqual(marks.filter(m => m.kind !== 'hero' && m.kind !== 'pip'), [], id)
    }
  })

  it('lists only what lies in a seen square', () => {
    let some = 0
    for (const id of chartedMaps()) {
      const s = game(id)
      const info = Z.mapInfo(Z.WORLD, id)
      for (let y = 0; y < info.h; y += 16) for (let x = 0; x < info.w; x += 16) seeTile(s, x, y)
      for (const m of Z.chartMarks(Z.WORLD, s)) {
        if (m.kind === 'hero' || m.kind === 'pip') continue
        some++
        assert.ok(Z.seenTile(s, id, info.w, m.x, m.y), `${id}: ${m.kind} at ${m.x},${m.y}`)
      }
    }
    assert.ok(some > 10)
  })

  it('shows a chest gold, then dim once opened', () => {
    const s = game('overworld', 'start')
    const c = Z.mapInfo(Z.WORLD, 'overworld').chestList.find(v => !v.appear)
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'chest', c.x, c.y), undefined)
    seeTile(s, c.x, c.y)
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'chest', c.x, c.y).state, 'closed')
    s.flags[`chest:${c.id}`] = true
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'chest', c.x, c.y).state, 'opened')
  })

  it('does not list a chest whose appearing is still to come', () => {
    const s = game('shrine', 'start')
    const c = Z.mapInfo(Z.WORLD, 'shrine').chestList.find(v => v.appear)
    assert.ok(c)
    seeAll(s)
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'chest', c.x, c.y), undefined)
    s.flags[`appear:${c.id}`] = true
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'chest', c.x, c.y).state, 'closed')
  })

  it('shows a heart piece lying about, then dim once taken', () => {
    const s = game('overworld', 'start')
    const m = Z.mapInfo(Z.WORLD, 'overworld').marks.find(v => v.ent.t === 'item' && v.ent.item === 'heartPiece')
    seeTile(s, m.x, m.y)
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'heart', m.x, m.y).state, 'lying')
    s.flags[`took:${m.ent.id}`] = true
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'heart', m.x, m.y).state, 'taken')
  })

  it('knows the ways between the lands from the grid and the warps', () => {
    const to = id => [...new Set(Z.landPasses(Z.WORLD, id).map(p => p.to))].sort()
    assert.deepEqual(to('overworld'), ['rerun', 'seterfell', 'sporelight', 'stillsand', 'wildwood', 'yulefjord'])
    assert.deepEqual(to('seterfell'), ['lumenby', 'overworld', 'sporelight', 'yulefjord'])
    assert.deepEqual(to('wildwood'), ['fogstage', 'lumenby', 'overworld'])
    assert.deepEqual(to('fogstage'), ['wildwood'])
    assert.deepEqual(to('shrine'), [])
    for (const id of Object.keys(Z.WORLD.atlas)) {
      const passes = Z.landPasses(Z.WORLD, id)
      // One a way: the gate and the open rim it stands in are one pass.
      assert.equal(new Set(passes.map(p => p.to)).size, passes.length, `${id}: ${JSON.stringify(passes)}`)
      for (const p of passes) assert.ok(Z.landPasses(Z.WORLD, p.to).some(q => q.to === id), `${p.to} has no way back to ${id}`)
    }
  })

  it('fills a pass tab once the land beyond has been seen', () => {
    const s = game('seterfell', 'camp')
    const p = Z.landPasses(Z.WORLD, 'seterfell').find(v => v.to === 'yulefjord')
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'pass', p.x, p.y), undefined)
    seeTile(s, p.x, p.y)
    s.hero.x = 36.5
    s.hero.y = 30.5
    const tab = Z.CHART_INKS.snow.tab
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'pass', p.x, p.y).state, 'unseen')
    assert.ok(!Z.renderCorner(Z.WORLD, s, { e: 0 }).px.includes(tab), 'hollow')
    s.flags['seen:yulefjord'] = true
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'pass', p.x, p.y).state, 'seen')
    for (const e of [0, 1]) assert.equal(Z.renderCorner(Z.WORLD, s, { e }).px.filter(c => c === tab).length, 9, `filled, e ${e}`)
    // (The coast is known from the start, as on the MAP page.)
    const home = Z.landPasses(Z.WORLD, 'seterfell').find(v => v.to === 'overworld')
    seeTile(s, home.x, home.y)
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'pass', home.x, home.y).state, 'seen')
  })

  it('marks a door in a seen square, and a gate where the way is to another land', () => {
    const s = game('stillsand', 'camp')
    seeAll(s)
    const marks = Z.chartMarks(Z.WORLD, s)
    const doors = marks.filter(m => m.kind === 'door')
    const warps = Z.mapInfo(Z.WORLD, 'stillsand').warps.filter(w => !Z.WORLD.atlas[w.to])
    assert.equal(doors.length, warps.length)
    for (const w of warps) assert.ok(find(doors, 'door', w.x, w.y))
    assert.deepEqual(marks.filter(m => m.kind === 'pass').map(m => m.to).sort(), ['overworld', 'rerun', 'sporelight'])
  })

  it('counts Lumenby\'s seven letters on the rim', () => {
    const s = game('lumenby', 'gate-quarry')
    const pips = () => Z.chartMarks(Z.WORLD, s).filter(m => m.kind === 'pip')
    assert.deepEqual(pips().map(m => m.n), [1, 2, 3, 4, 5, 6, 7])
    assert.ok(pips().every(m => m.state === 'dark'))
    const gold = e => Z.renderCorner(Z.WORLD, s, { e }).px.filter(c => c === '#ffd23f').length
    const dark = [0, 1].map(gold)
    for (const n of [1, 3, 6]) s.flags[`q.lumenby.sign${n}`] = true
    assert.deepEqual(pips().map(m => m.state), ['lit', 'dark', 'lit', 'dark', 'dark', 'lit', 'dark'])
    // Three lit pips of four px each, on either shape.
    for (const e of [0, 1]) assert.equal(gold(e) - dark[e], 12, `e ${e}`)
    for (const id of chartedMaps()) if (id !== 'lumenby') assert.equal(Z.chartMarks(Z.WORLD, game(id)).filter(m => m.kind === 'pip').length, 0, id)
  })

  it('shows the hero whole in every corner of every land, in both shapes, and nothing else in pink', () => {
    for (const id of chartedMaps()) {
      const s = game(id)
      seeAll(s)
      const info = Z.mapInfo(Z.WORLD, id)
      const open = []
      for (let y = 0; y < info.h; y++) for (let x = 0; x < info.w; x++) if (!Z.TILE_INFO[info.base[y * info.w + x]].solid) open.push([x, y])
      const far = score => open.reduce((a, b) => (score(b) > score(a) ? b : a))
      const spots = [far(([x, y]) => x + y), far(([x, y]) => -x - y), far(([x, y]) => x - y), far(([x, y]) => y - x), far(([x]) => x), far(([x]) => -x), far(([, y]) => y), far(([, y]) => -y)]
      // The corners of the map's own rectangle too: a pass can take the hero to the very rim.
      spots.push([0, 0], [info.w - 1, 0], [0, info.h - 1], [info.w - 1, info.h - 1])
      for (const [x, y] of spots) {
        s.hero.x = x + 0.5
        s.hero.y = y + 0.5
        for (let k = 0; k <= 5; k++) {
          for (const keys of [false, true]) {
            const n = Z.renderCorner(Z.WORLD, s, { e: k / 5, keys }).px.filter(c => c === '#ff2fa0').length
            assert.equal(n, k >= 3 ? 8 : 9, `${id} at ${x},${y}, step ${k}${keys ? ' with key caps' : ''}`)
          }
        }
      }
    }
  })

  it('keeps the window inside the land away from its corners', () => {
    const sh = { chart: true, e: 0, pinned: null }
    assert.deepEqual(Z.chartWindow({ w: 104, h: 48 }, { x: 50.5, y: 24.5 }, sh), { wx: 50, wy: 24, fits: true })
    assert.deepEqual(Z.chartWindow({ w: 104, h: 48 }, { x: 5.5, y: 40.5 }, sh), { wx: 20, wy: 28, fits: true })
    // A land smaller than the window lies in its middle.
    assert.deepEqual(Z.chartWindow({ w: 48, h: 24 }, { x: 24.5, y: 12.5 }, sh), { wx: 24, wy: 12, fits: true })
  })

  it('moves the window with the hero\'s tile, the tile the mark and the shell\'s repaint go by', () => {
    const sh = { chart: true, e: 0, pinned: null }
    const at = x => Z.chartWindow({ w: 104, h: 48 }, { x, y: 20.5 }, sh).wx
    assert.equal(at(50.0), 50)
    assert.equal(at(50.4), 50)
    assert.equal(at(50.6), 50, 'not at the half tile')
    assert.equal(at(50.99), 50)
    assert.equal(at(51.0), 51, 'at the tile line')
  })

  it('always finds a window that shows the hero whole on a pinned land, at every step of the turn', () => {
    const pinned = Object.entries(Z.WORLD.maps).filter(([, d]) => Z.charted(d) && Z.pinName(d)).map(([id]) => id)
    assert.ok(pinned.includes('stillsand') && pinned.includes('yulefjord') && pinned.includes('lumenby') && pinned.includes('fogstage'))
    for (const id of pinned) {
      const info = Z.mapInfo(Z.WORLD, id)
      for (let k = 0; k <= 5; k++) {
        const sh = { chart: true, e: k / 5, pinned: Z.pinName(info.def) }
        for (let y = 0; y < info.h; y++) for (let x = 0; x < info.w; x++) {
          assert.ok(Z.chartWindow(info, { x: x + 0.5, y: y + 0.5 }, sh).fits, `${id} tile ${x},${y} step ${k}`)
        }
      }
    }
    // The case found in review: Stillsand's east edge at step 1, under the plate's row before.
    const s = game('stillsand', 'camp')
    seeAll(s)
    s.hero.x = 87.5
    s.hero.y = 29.5
    assert.equal(Z.renderCorner(Z.WORLD, s, { e: 0.2 }).px.filter(c => c === '#ff2fa0').length, 9)
  })
})

// ---- the gem ------------------------------------------------------------------------------------------------

describe('the gem', () => {
  it('is pinned where a map allows one view only, and nowhere else', () => {
    const pinned = []
    for (const [id, def] of Object.entries(Z.WORLD.maps)) {
      const allowed = new Set(def.views ?? ['classic', 'iso'])
      const only = allowed.size === 1 ? [...allowed][0] : null
      assert.equal(Z.onlyView(def), only, id)
      assert.equal(Z.pinName(def), only === null ? null : only === 'iso' ? 'ISO' : '8-BIT', id)
      const s = game(id)
      assert.equal(Z.cornerShape(Z.WORLD, s, { e: 1 }).pinned, Z.pinName(def), id)
      if (only) pinned.push(id)
    }
    assert.ok(pinned.includes('stillsand'))
    assert.ok(!pinned.includes('seterfell') && !pinned.includes('overworld'))
    assert.equal(Z.pinName({ views: ['classic'] }), '8-BIT')
    assert.equal(Z.pinName({ views: ['iso', 'iso'] }), 'ISO')
    assert.equal(Z.pinName(undefined), null)
    assert.equal(Z.refusalTag('ISO'), 'ISO ONLY HERE')
  })

  it('shows the sun by the day clock, and stuck before the Sun Prism', () => {
    assert.equal(Z.sunPhase(null), 'stuck')
    const D = Z.DAY
    const cases = [
      [D.dusk, 'dusk'], [D.blueEve - 1, 'dusk'], [D.blueEve, 'night'], [D.night, 'night'], [D.midnight, 'night'], [D.blueMorn - 1, 'night'],
      [D.blueMorn, 'dawn'], [D.dawn, 'dawn'], [D.morning - 1, 'dawn'], [D.morning, 'morning'], [D.noon - 1, 'morning'], [D.noon, 'noon'],
      [D.noonEnd - 1, 'noon'], [D.noonEnd, 'afternoon'], [D.afternoon - 1, 'afternoon'], [D.afternoon, 'dusk'], [Z.DAY_LENGTH - 1, 'dusk'],
      [Z.DAY_LENGTH + D.noon, 'noon'], [-1, 'dusk'],
    ]
    for (const [t, phase] of cases) assert.equal(Z.sunPhase(t), phase, `t ${t}`)
    const s = game('seterfell', 'camp')
    const window = t => { s.daytime = t; return Z.renderCorner(Z.WORLD, s, { e: 0 }).px.join() }
    const seen = new Set([null, D.dawn, D.morning, D.noon, D.noonEnd, D.dusk, D.night].map(window))
    assert.equal(seen.size, 7, 'seven pictures')
    // (Before the prism it never moves.)
    s.daytime = null
    assert.equal(window(null), window(null))
  })
})

// ---- states, words, the canvas ------------------------------------------------------------------------------

describe('the painter\'s states', () => {
  it('names an area without its THE', () => {
    assert.equal(Z.areaTag('The Big Seter'), 'BIG SETER')
    assert.equal(Z.areaTag("ARNE'S SURVEY CAMP"), "ARNE'S SURVEY CAMP")
    assert.equal(Z.areaTag('THEATRE'), 'THEATRE')
    // Every name fits on its plate.
    for (const d of Object.values(Z.WORLD.maps)) {
      for (const n of [d.name, ...(d.areas ?? []).map(a => a.name)]) assert.ok(Z.textWidth(Z.areaTag(n)) + 6 <= Z.CORNER_W - 2, n)
    }
  })

  it('draws the stub indoors, with the gem beside it', () => {
    const s = game('hut')
    assert.equal(Z.hasChart(Z.WORLD, s), false)
    assert.deepEqual(Z.chartMarks(Z.WORLD, s), [])
    assert.equal(Z.cornerShape(Z.WORLD, s, { e: 0 }).chart, false)
    assert.ok(Z.renderCorner(Z.WORLD, s, { e: 0 }).px.some(c => c === '#ff2fa0'))
    const demo = game('overworld', 'start')
    demo.demo = true
    assert.equal(Z.hasChart(Z.WORLD, demo), false)
  })

  it('changes with press, focus and the lessons, and steps away in three dithers', () => {
    const s = game('seterfell', 'camp')
    const px = st => Z.renderCorner(Z.WORLD, s, { e: 1, ...st }).px
    const rest = px({})
    const has = (p, c) => p.filter(v => v === c).length
    assert.ok(has(px({ pressed: 'chart' }), '#ffffff') > 50 && has(rest, '#ffffff') === 0)
    assert.notDeepEqual(px({ pressed: 'gem' }), rest)
    assert.ok(has(px({ focus: 'chart' }), '#ffd23f') > has(rest, '#ffd23f') + 50)
    assert.ok(has(px({ focus: 'gem' }), '#ffd23f') > has(rest, '#ffd23f') + 15)
    assert.ok(has(px({ nudge: 'gem' }), '#ff2fa0') > has(rest, '#ff2fa0') + 15)
    assert.equal(Z.cornerShape(Z.WORLD, s, { e: 1, nudge: 'gem' }).tag, 'TAP GEM: TURN')
    assert.equal(Z.cornerShape(Z.WORLD, s, { e: 1, nudge: 'chart' }).tag, 'TAP MAP: MENU')
    const full = rest.filter(Boolean).length
    for (const [away, share] of [[1, 0.75], [2, 0.5], [3, 0.25]]) {
      const left = px({ away }).filter(Boolean).length / full
      assert.ok(Math.abs(left - share) < 0.04, `away ${away}: ${left}`)
      assert.equal(px({ away, reduced: true }).filter(Boolean).length, 0)
    }
    assert.equal(px({ away: 4 }).filter(Boolean).length, 0)
    assert.deepEqual([-1, 0, 39, 40, 80, 120, 999].map(ms => Z.awayStep(ms, false)), [0, 1, 1, 2, 3, 4, 4])
    assert.equal(Z.awayStep(0, true), 4)
  })

  it('blinks the hero in steps, and holds them steady when motion is reduced', () => {
    const s = game('seterfell', 'camp')
    const px = st => Z.renderCorner(Z.WORLD, s, { e: 0, ...st }).px.join()
    assert.notEqual(px({ time: 0 }), px({ time: 0.5 }))
    assert.equal(px({ time: 0 }), px({ time: 0.8 }))
    assert.equal(px({ time: 0, reduced: true }), px({ time: 0.5, reduced: true }))
  })

  it('paints that picture on a context, a px an L', () => {
    const s = game('overworld', 'start')
    const rects = []
    let fill = ''
    const got = new Array(Z.CORNER_W * Z.CORNER_H).fill(null)
    Z.paintCorner({ clearRect() {}, set fillStyle(v) { fill = v }, fillRect(x, y, w, h) { rects.push(1); for (let i = 0; i < w; i++) got[(y * Z.CORNER_W) + x + i] = fill; assert.equal(h, 1) } }, Z.WORLD, s, { e: 1 })
    assert.deepEqual(got, Z.renderCorner(Z.WORLD, s, { e: 1 }).px)
    assert.ok(rects.length < 2500, `${rects.length} rects`)
  })
})

// ---- the fog ------------------------------------------------------------------------------------------------

describe('the fog', () => {
  it('covers every square not seen in the land\'s two fog inks, with the ghost of water, cliffs and pits out of doors only', () => {
    for (const id of chartedMaps()) {
      const s = game(id)
      const def = Z.WORLD.maps[id]
      const fog = Z.fogInks(Z.chartInks(def))
      const used = new Set(Z.buildChart(Z.WORLD, s).px)
      const allowed = def.kind === 'overworld' ? [fog.a, fog.b, fog.water, fog.wall, fog.pit] : [fog.a, fog.b]
      for (const c of used) assert.ok(allowed.includes(c), `${id}: ${c} in the fog`)
      assert.ok(used.has(fog.a) && used.has(fog.b), id)
      assert.deepEqual([...new Set(Z.buildChart(Z.WORLD, s, false).px)].sort(), [fog.a, fog.b].sort(), id)
      // (The ghost stands off the fog.)
      if (def.kind === 'overworld') assert.ok(used.has(fog.water) || used.has(fog.wall), id)
      assert.ok(fog.water !== fog.a && fog.wall !== fog.b, id)
    }
  })
})

// ---- the inks -----------------------------------------------------------------------------------------------

describe('the chart\'s inks', () => {
  it('has a table for every map\'s look: no map falls back to the old violet set', () => {
    const fell = Object.entries(Z.WORLD.maps)
      .filter(([, d]) => Z.charted(d) || d.look || d.realm)
      .filter(([, d]) => Z.chartLook(d) === 'old')
      .map(([id, d]) => `${id} (look ${d.look}, realm ${d.realm})`)
    assert.deepEqual(fell, [])
    for (const look of ['lab', 'wild', ...Z.REALM_LOOKS]) assert.ok(Z.CHART_INKS[look], look)
    assert.equal(Z.chartLook({ kind: 'overworld', look: 'moon' }), 'old')
  })

  it('keys a map by its realm, its look, then the palette its kind is painted in', () => {
    const key = id => Z.chartLook(Z.WORLD.maps[id])
    assert.deepEqual(
      ['overworld', 'wildwood', 'seterfell', 'yulefjord', 'sporelight', 'stillsand', 'rerun', 'lumenby', 'fogstage', 'shrine', 'lab1', 'underglow1', 'underglow3'].map(key),
      ['coast', 'wild', 'seterfell', 'snow', 'spore', 'dune', 'suburb', 'quarry', 'fog', 'shrine', 'lab', 'underglow', 'underglow'],
    )
  })

  it('gives every ink as a colour, and no roof in pink', () => {
    for (const [name, inks] of Object.entries(Z.CHART_INKS)) {
      const all = Object.values(inks).flat()
      assert.equal(all.length, 24, name)
      for (const c of all) assert.match(c, /^#[0-9a-f]{6}$/, `${name}: ${c}`)
      if (name === 'old') continue
      for (const c of [inks.house, inks.houseD]) {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
        // Orange, brick and ochre: red over green over blue.
        assert.ok(r > g && g >= b, `${name}: roof ${c}`)
      }
    }
  })
})

// ---- the corner in the shell ----------------------------------------------------------------------------------

describe('the corner in the shell', () => {
  const shell = readFileSync(join(root, 'Zelda.vue'), 'utf8')
  const corner = shell.slice(shell.indexOf('class="zelda-corner"'), shell.indexOf('class="zelda-turn-said"'))
  const button = cls => { const at = corner.indexOf(`class="${cls}"`); return corner.slice(corner.lastIndexOf('<', at), corner.indexOf('/>', at)) }

  it('paints one canvas through the painter, in one step, which is the one writer of the corner\'s unit', () => {
    assert.match(corner, /<canvas ref="cornerCanvas" class="zelda-corner-canvas"/)
    assert.match(shell, /function stepCorner\(nowMs: number\)/)
    assert.match(shell, /paintCorner\(g, WORLD, s, st\)/)
    assert.doesNotMatch(shell, /stepTurnSwitch|stepMiniMap|drawMiniMap|turnSwitch/)
    assert.equal(shell.split("setProperty('--zelda-corner-u'").length - 1, 1)
    assert.match(shell, /\.zelda-corner-canvas \{[^}]*pointer-events: none;/)
  })

  it('shapes the chart\'s button as the frame, from the layout, and hides the chip only where the chart is the way in', () => {
    const map = button('zelda-mini')
    assert.match(map, /v-if="chartShown"/)
    // Their names: the chip is the only pause control a screen reader has, the chart says where the hero is.
    assert.match(map, /:aria-label="mapLabel"/)
    assert.match(shell, /const mapLabel = ref\('Map'\)/)
    assert.match(shell, /const label = `Map: \$\{place\}`\s*if \(label !== mapLabel\.value\) mapLabel\.value = label/)
    assert.match(map, /:style="cornerAt\.map"/)
    assert.match(shell, /const hit = cornerTargets\(lay\)/)
    assert.match(shell, /map: \{ \.\.\.boxStyle\(hit\.map\), \.\.\.\(hit\.clip \? \{ clipPath: hit\.clip \} : \{\}\) \}/)
    const chip = button('zelda-chip')
    assert.match(chip, /aria-label="Pause"/)
    assert.match(chip, /aria-keyshortcuts="P"/)
    assert.match(chip, /:class="\{ 'zelda-chip--hidden': chartShown \}"/)
    assert.match(chip, /:style="chartShown \? undefined : cornerAt\.pause"/)
    assert.match(shell, /\.zelda-chip--hidden \{[^}]*clip-path: inset\(50%\);/)
    // The Prism over both.
    assert.match(shell, /\.zelda-mini \{ z-index: 1; \}\s*\.zelda-chip \{ z-index: 2; \}\s*\.zelda-turn-wrap \{\s*position: absolute;\s*z-index: 3;/)
    // A first touch on any of the three reaches input.ts, where the touch deck is turned on.
    assert.doesNotMatch(corner, /@pointerdown[^"]*\.stop/)
  })

  it('leaves the player a visible way into the menu of 44 × 44 CSS px or more in every state', () => {
    const states = []
    for (let k = 0; k <= 5; k++) for (const pinned of [null, 'ISO', '8-BIT']) for (const keys of [false, true]) states.push({ chart: true, e: k / 5, pinned, keys, tag: keys ? 'TAP MAP: MENU' : null })
    for (const e of [0, 0.4, 1]) states.push({ chart: false, e, pinned: null }, { chart: false, e, pinned: 'ISO', keys: true })
    for (const [w, h, dpr] of SCREENS) {
      const { u } = screenOf(w, h, dpr)
      for (const sh of states) {
        const lay = Z.cornerLayout(w, h, u, sh)
        const hit = Z.cornerTargets(lay)
        const at = `${w}x${h}@${dpr} ${JSON.stringify(sh)}`
        assert.ok(!!hit.map !== !!hit.pause, `${at}: one way in, the chart or the stub`)
        const target = hit.map ?? hit.pause
        assert.ok(target.w >= 44 && target.h >= 44, at)
        if (hit.map) {
          // The clip the button wears is the layout's polygon, moved to the button's own corner: point for point,
          // and the same inside and outside over the whole box.
          const m = /^polygon\((.*)\)$/.exec(hit.clip)
          assert.ok(m, at)
          const pts = m[1].split(', ').map(p => p.split(' ').map(v => Number(v.replace(/px$/, ''))))
          assert.equal(pts.length, lay.poly.length, at)
          pts.forEach(([x, y], i) => {
            assert.ok(Math.abs(x - (lay.poly[i][0] - lay.menu.x)) < 1e-3 && Math.abs(y - (lay.poly[i][1] - lay.menu.y)) < 1e-3, `${at}: point ${i}`)
          })
          for (let gy = 0.5; gy < lay.menu.h; gy += lay.u) for (let gx = 0.5; gx < lay.menu.w; gx += lay.u) {
            assert.equal(inPolygon(gx, gy, pts), inPolygon(lay.menu.x + gx, lay.menu.y + gy, lay.poly), `${at}: ${gx},${gy}`)
          }
          assert.ok(freeSquare(lay, hit.view), `${at}: no free 44 x 44 of the chart`)
        } else {
          assert.equal(hit.clip, null)
          assert.ok(!meet(hit.pause, hit.view), `${at}: the stub under the Prism`)
        }
        assert.deepEqual(hit.view, lay.gemHit)
      }
    }
  })

  it('keeps the CORNER MAP switch and NO SIGNAL out of the game', () => {
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))
    for (const f of walk(root)) {
      if (!/\.(ts|vue)$/.test(f)) continue
      const src = readFileSync(f, 'utf8')
      assert.doesNotMatch(src, /NO SIGNAL/, f)
      assert.doesNotMatch(src, /CORNER MAP|toggleCorner|cornerMap/, f)
    }
    const keys = shell.slice(shell.indexOf('function shellKey'), shell.indexOf('function backsOut'))
    assert.doesNotMatch(keys, /KeyC/, 'C is the roll in play, and means nothing in the menu')
  })

  it('says why a press of a pinned Prism does not turn, from the map\'s views', () => {
    for (const [id, def] of Object.entries(Z.WORLD.maps)) {
      const only = Z.onlyView(def)
      const words = Z.oneViewWords(def)
      if (!only) { assert.equal(words, null, id); continue }
      assert.deepEqual(words, only === 'iso' ? { tag: 'ISO ONLY HERE', said: 'Isometric only here' } : { tag: '8-BIT ONLY HERE', said: 'Classic only here' }, id)
    }
    assert.deepEqual(Z.oneViewWords({ views: ['classic'] }), { tag: '8-BIT ONLY HERE', said: 'Classic only here' })
    assert.equal(Z.oneViewWords({ views: ['iso', 'classic'] }), null)
    assert.equal(Z.VIEW_NOT_LOADED, 'VIEW NOT LOADED')
    // The shell refuses with those words, and says them.
    assert.match(shell, /const words = state \? oneViewWords\(mapInfo\(WORLD, state\.map\.id\)\.def, viewList\(\)\) : null\s*if \(words\) turnRefuse\(words\.tag, words\.said\)/)
    // Said again at every press: the live region is emptied, and the words set once the page shows it empty.
    assert.match(shell, /function turnRefuse\(tag: string = VIEW_NOT_LOADED, said = 'View not loaded'\) \{[^]*?turnSaid\.value = ''\s*void nextTick\(\(\) => \{ turnSaid\.value = said \}\)\s*audio\?\.sfx\('error'\)/)
  })

  it('reads the renderer\'s turn (radians) as a share of the way to the isometric view, for the frame and the MAP page', () => {
    assert.equal(Z.turnAmount(0), 0)
    assert.equal(Z.turnAmount(Math.PI / 4), 1)
    assert.ok(Math.abs(Z.turnAmount(Math.PI / 8) - 0.5) < 1e-12)
    assert.equal(Z.turnAmount(2), 1)
    assert.equal(Z.turnAmount(-1), 0)
    assert.match(shell, /e: turnAmount\(vs\.turn\),/)
    assert.match(shell, /ui\.turn = turnAmount\(renderer\.viewState\(\)\.turn\)/)
  })

  it('fades only what changes dress beside the canvas, around the flip', () => {
    assert.equal(Z.chromeAlpha(0), 1)
    assert.equal(Z.chromeAlpha(1), 1)
    assert.equal(Z.chromeAlpha(0.5), 0)
    assert.ok(Math.abs(Z.chromeAlpha(0.4) - 0.5) < 1e-9)
  })

  it('comes back from away in the same three steps, at once with reduced motion', () => {
    assert.deepEqual([0, 39, 40, 80, 120, 500].map(ms => Z.backStep(ms, 4, false)), [3, 3, 2, 1, 0, 0])
    assert.deepEqual([0, 40].map(ms => Z.backStep(ms, 2, false)), [2, 1])
    assert.equal(Z.backStep(0, 4, true), 0)
    assert.equal(Z.backStep(0, 0, false), 0)
  })

  it('teaches the two lessons once per browser, on touch, and the key caps beside a keyboard', () => {
    assert.match(shell, /const LESSON_KEY = 'zelda\.cornerLessons'/)
    assert.match(shell, /try \{ localStorage\.setItem\(LESSON_KEY, String\(cn\.lessons\)\) \} catch/)
    assert.match(shell, /try \{ cn\.lessons = Number\(localStorage\.getItem\(LESSON_KEY\)\) \|\| 0 \} catch/)
    assert.match(shell, /if \(cn\.lesson && \(away \|\| keys\)\)/, 'never while away, and not beside a keyboard')
    assert.match(shell, /keys,\s*nudge: cn\.lesson,/)
  })
})

// ---- the chart at night -----------------------------------------------------------------------------------------

describe('the chart at night', () => {
  it('has steps for the hour: none before the Prism, by day and at dusk; deepest at midnight', () => {
    const D = Z.DAY
    assert.equal(Z.nightLevel(null), 0)
    assert.equal(Z.nightLevel(580), 0, 'noon')
    assert.equal(Z.nightLevel(D.dusk + 30), 0, 'dusk')
    assert.equal(Z.nightLevel(D.dawn), 0, 'dawn')
    assert.equal(Z.nightLevel(D.blueEve), 1, 'the blue hour')
    assert.equal(Z.nightLevel(D.nightEnd), 1, 'the blue morning')
    assert.equal(Z.nightLevel(D.midnight), 2, 'midnight')
    assert.equal(Z.nightLevel(D.midnight + Z.DAY_LENGTH), 2)
    assert.deepEqual([...Z.NIGHT_MIX], [0, 0.22, 0.4])
  })

  it('dims the chart toward navy out of doors, and leaves a cave as it is', () => {
    const luma = c => { const v = parseInt(c.slice(1), 16); return ((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114 }
    const mean = px => px.reduce((a, c) => a + luma(c), 0) / px.length
    const s = game('stillsand', 'camp')
    seeAll(s)
    const levels = [0, 1, 2].map(n => mean(Z.buildChart(Z.WORLD, s, true, n).px))
    assert.ok(levels[0] > levels[1] && levels[1] > levels[2], levels.join(' > '))
    for (const [t, n] of [[null, 0], [580, 0], [30, 0], [230, 2]]) {
      s.daytime = t
      assert.equal(Z.chartNight(Z.WORLD, s), n, `daytime ${t}`)
    }
    // (Under ground there are no hours.)
    const cave = game('underglow1', 'up')
    cave.daytime = 230
    assert.equal(Z.chartNight(Z.WORLD, cave), 0)
    // The marks and the frame keep their colours: only the land is dimmed.
    s.daytime = 230
    const night = Z.renderCorner(Z.WORLD, s, { e: 1 }).px
    s.daytime = 580
    const noon = Z.renderCorner(Z.WORLD, s, { e: 1 }).px
    // (The hero's pink alike; the frame's cyan alike, but for the two stars in the Prism's window at night.)
    assert.equal(night.filter(v => v === '#ff2fa0').length, noon.filter(v => v === '#ff2fa0').length)
    assert.equal(night.filter(v => v === '#2ff3ff').length, noon.filter(v => v === '#2ff3ff').length + 2)
    assert.ok(mean(night.filter(Boolean)) < mean(noon.filter(Boolean)))
  })
})

// ---- round three: the review's findings ------------------------------------------------------------------------

describe('a round with one view', () => {
  const one = [{ engine: 'classic' }]
  it('has no gem: no Prism, no plate, no V, no target', () => {
    for (const sh of [{ chart: true, e: 0, pinned: null, gem: false, keys: true, tag: 'CLASSIC' }, { chart: false, e: 0, pinned: null, gem: false, keys: true }]) {
      const parts = Z.cornerParts(sh)
      assert.equal(parts.gem, null)
      assert.equal(parts.plate, null)
      assert.equal(parts.chain, null)
      assert.equal(parts.keyV, null)
      const lay = Z.cornerLayout(390, 844, 1, sh)
      assert.equal(lay.gem, null)
      assert.equal(lay.gemHit, null)
      assert.equal(Z.cornerTargets(lay).view, null)
      const target = Z.cornerTargets(lay).map ?? Z.cornerTargets(lay).pause
      assert.ok(target.w >= 44 && target.h >= 44)
    }
    // On a land that allows one view, a round of one view pins nothing: there is nothing to turn to.
    assert.equal(Z.hasGem(one), false)
    assert.equal(Z.pinName(Z.WORLD.maps.stillsand, one), null)
    assert.equal(Z.oneViewWords(Z.WORLD.maps.stillsand, one), null)
    for (const id of ['seterfell', 'stillsand']) {
      const s = game(id)
      seeAll(s)
      const shape = Z.cornerShape(Z.WORLD, s, { e: 0, round: one })
      assert.equal(shape.gem, false)
      assert.equal(shape.pinned, null)
      const px = Z.renderCorner(Z.WORLD, s, { e: 0, round: one, keys: true }).px
      for (const c of ['#9a4ff0', '#e8d8ff', '#3a2a70']) assert.ok(!px.includes(c), `${id}: the gem's ${c}`)
      // (Two built-in views: the gem is there.)
      assert.ok(Z.renderCorner(Z.WORLD, s, { e: 0 }).px.some(c => c === '#9a4ff0' || c === '#6a5aa8'))
    }
  })

  it('is told to the painter by the shell, with the live round', () => {
    const shell = readFileSync(join(root, 'Zelda.vue'), 'utf8')
    assert.match(shell, /const round = viewList\(\)\s*const words = oneViewWords\(def, round\)/)
    assert.match(shell, /away: cn\.level,\s*round,\s*\}/)
    // (The button goes with the gem.)
    assert.match(shell, /v-if="viewCount > 1"\s*class="zelda-turn-wrap"/)
  })
})

describe('the pin from the live round', () => {
  it('pins the gem exactly when the round holds one view this map allows', () => {
    const sand = Z.WORLD.maps.stillsand
    const fell = Z.WORLD.maps.seterfell
    const two = [{ engine: 'classic' }, { engine: 'iso' }]
    // A studio's second isometric view: Stillsand has two views to turn between, and is not pinned.
    const three = [{ engine: 'classic' }, { engine: 'iso' }, { engine: 'iso' }]
    assert.equal(Z.pinName(sand, two), 'ISO')
    assert.equal(Z.pinName(sand, three), null)
    assert.equal(Z.oneViewWords(sand, three), null)
    assert.equal(Z.pinName(sand, [{ engine: 'iso' }, { engine: 'iso' }]), null)
    assert.equal(Z.pinName(fell, two), null)
    assert.equal(Z.pinName(fell, three), null)
    assert.equal(Z.pinName({ views: ['classic'] }, three), '8-BIT')
    const s = game('stillsand', 'camp')
    assert.equal(Z.cornerShape(Z.WORLD, s, { e: 1, round: three }).pinned, null)
    assert.equal(Z.cornerShape(Z.WORLD, s, { e: 1, round: two }).pinned, 'ISO')
    assert.ok(Z.renderCorner(Z.WORLD, s, { e: 1, round: three }).px.includes('#9a4ff0'), 'a lit gem')
    assert.ok(!Z.renderCorner(Z.WORLD, s, { e: 1, round: two }).px.includes('#9a4ff0'), 'a dull gem')
  })
})

describe('the shell, after review', () => {
  const shell = readFileSync(join(root, 'Zelda.vue'), 'utf8')
  const corner = shell.slice(shell.indexOf('class="zelda-corner"'), shell.indexOf('class="zelda-turn-said"'))

  it('reads keyboard focus from the page each frame, so a ring never outlives its button', () => {
    assert.match(shell, /function cornerFocus\(\): 'chart' \| 'gem' \| null \{\s*const el = document\.activeElement\s*if \(!el \|\| !el\.matches\('\.zelda-chip:not\(:disabled\), \.zelda-mini:not\(:disabled\), \.zelda-turn:not\(:disabled\)'\)\) return null/)
    assert.match(shell, /focus: cornerFocus\(\),/)
    assert.doesNotMatch(corner, /@focus|@blur/, 'no focus kept from events')
    assert.doesNotMatch(shell, /cn\.focus/)
  })

  it('keeps no imports of the old corner, and takes its unit off the page when it goes', () => {
    assert.match(shell, /import \{ HIRES_WINDOW_SKIN, type MenuPage \} from '\.\/render\/hud'/)
    assert.doesNotMatch(shell, /\bNEON_SKIN\b|\bHudSkin\b/)
    for (const v of ['--px16-fine', '--zelda-chrome-a', '--zelda-hint-play', '--zelda-corner-u']) assert.match(shell, new RegExp(`removeProperty\\('${v}'\\)`), v)
  })

  it('takes the corner\'s unit from the HUD\'s fine pixel, whole device px, never under one CSS px', () => {
    assert.match(shell, /const uDev = Math\.max\(Math\.round\(\(renderer\?\.fineUnit\(\) \?\? 1\) \* dpr\), Math\.ceil\(dpr\)\)\s*return \{ uDev, u: uDev \/ dpr \}/)
    const r = readFileSync(join(root, 'render/renderer.ts'), 'utf8')
    assert.match(r, /fineUnit: \(\) => scale < 2 \? 0 : hudScale\(scale, W, H, 2\) \/ 2 \/ dpr/)
    // The renderer's scale, as `screenOf` reckons it.
    assert.match(r, /baseScale = Math\.max\(1, Math\.floor\(Math\.min\(W \/ \(13 \* T\), H \/ \(11 \* T\)\)\)\)\s*while \(W \/ baseScale > 30 \* T\) baseScale\+\+/)
    assert.match(r, /if \(rows \* T \* baseScale >= H \* 0\.8\) return baseScale\s*const byHeight = Math\.floor\(H \/ \(rows \* T\)\)\s*const byWidth = Math\.floor\(W \/ \(10 \* T\)\)\s*return Math\.max\(baseScale, Math\.min\(byHeight, byWidth\)\)/)
  })

  it('gives the stub its 44 × 44 at the raised scale of a room indoors', () => {
    const rooms = Object.values(Z.WORLD.maps).filter(d => d.kind === 'interior')
    assert.ok(rooms.length > 5)
    for (const [w, h, dpr] of SCREENS) {
      for (const d of rooms) {
        const scr = screenOf(w, h, dpr, d.rows.length)
        assert.ok(scr.u >= 1 - 1e-9, `${d.id} ${w}x${h}@${dpr}`)
        for (const e of [0, 1]) for (const keys of [false, true]) {
          const lay = Z.cornerLayout(w, h, scr.u, { chart: false, e, pinned: null, keys })
          const hit = Z.cornerTargets(lay)
          assert.equal(hit.map, null)
          assert.ok(hit.pause.w >= 44 && hit.pause.h >= 44 && hit.view.w >= 44 && hit.view.h >= 44, `${d.id} ${w}x${h}@${dpr}: u ${scr.u}`)
          assert.ok(!meet(hit.pause, hit.view))
          assert.ok(lay.canvas.x >= 0 && lay.canvas.x + lay.canvas.w <= w + 1e-6)
        }
      }
    }
  })

  it('stands the Escape pill below everything the corner hangs down, key caps and tag included', () => {
    const n = Number(/\.zelda-esc\.esc-hold-layer \{\s*top: calc\(max\(14px, env\(safe-area-inset-top, 0px\)\) \+ (\d+) \* var\(--zelda-corner-u, 1px\)\);/.exec(shell)?.[1])
    assert.ok(n > 0)
    const long = longestName()
    for (const [w, h, dpr] of SCREENS.filter(([w]) => w <= 640)) {
      const { u } = screenOf(w, h, dpr)
      for (let k = 0; k <= 5; k++) for (const pinned of [null, 'ISO', '8-BIT']) for (const keys of [false, true]) for (const chart of [true, false]) {
        const sh = { chart, e: k / 5, pinned, keys, tag: long }
        const lay = Z.cornerLayout(w, h, u, sh)
        const parts = Z.cornerParts(sh)
        const bottomL = Math.max(...[parts.tag, parts.plate, parts.keyM && keys ? parts.keyM : null, parts.keyV].filter(Boolean).map(b => b.y + b.h))
        const bottom = lay.canvas.y + bottomL * 2 * u
        assert.ok(14 + n * u >= bottom, `${w}x${h}@${dpr} ${JSON.stringify(sh)}: the pill at ${14 + n * u}, the corner down to ${bottom}`)
      }
    }
  })
})
