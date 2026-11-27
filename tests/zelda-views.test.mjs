// Neon Shrine's views: which one a player starts in, the data gates (the engines' values, the studio's file, no view
// code in the first page, no raised walkable tile, the studio's stage), the isometric geometry's properties, the
// controls in a turned view and the turn between views. Pure modules, bundled with esbuild like the other zelda tests.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')
const site = resolve(root, '../..')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './render/iso/project'`,
        `export { shapeOf } from './render/iso/shape'`,
        `export { Z_MAX, makeCam, fitDepth, toScene, toGround, depthOf } from './render/iso/camera'`,
        `export { BEYOND, beyondTile } from './render/beyond'`,
        `export { stepGame, createGame } from './engine/index'`,
        `export { NO_INPUT } from './types'`,
        `export { VIEWS, DEFAULT_VIEW, ENGINE_LOADERS, isViewId, nextView, viewName, startView, parseViews, mergeViews, setLiveViews, viewList, viewDef } from './views'`,
        `export { ENGINES, resolveParams, paramDiff, isEngineId } from './viewParams'`,
        `export { WORLD } from './world/index'`,
        `export { TILE_INFO } from './world/tiles'`,
        `export { createTurn, turnTime, createTurnClock } from './render/turn'`,
        `export { enterMap } from './engine/game'`,
        `export { STAGE_SCENES } from '../stage/scenes'`,
      ].join('; '),
      resolveDir: root,
      loader: 'ts',
    },
    // The view modules themselves draw on a canvas: leave them out of the bundle.
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error', external: ['./render/iso/view'],
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`)

describe('which view a player gets', () => {
  it('takes the address before the stored choice, the isometric one for nonsense or nothing, and goes round every view', () => {
    assert.equal(M.startView('iso', 'classic'), 'iso')
    assert.equal(M.startView(null, 'iso'), 'iso')
    assert.equal(M.startView('3d', 'iso'), 'iso')
    assert.equal(M.startView('classic', 'iso'), 'classic')
    assert.equal(M.startView(null, 'classic'), 'classic')
    // A browser that has never chosen.
    assert.equal(M.DEFAULT_VIEW, 'iso')
    assert.equal(M.startView(null, null), 'iso')
    assert.equal(M.startView('3d', 'hologram'), 'iso')
    // The archived polygon engine's views (2026-11-25, branch `parked/polygon-engine`) are nonsense now.
    assert.equal(M.isViewId('poly'), false)
    assert.equal(M.isViewId('third'), false)
    assert.equal(M.isEngineId('poly'), false)
    assert.equal(M.startView(null, 'poly'), 'iso')
    assert.equal(M.startView('poly', 'classic'), 'classic')
    assert.equal(M.startView('third', 'classic'), 'classic')
    // The studio has taken the first view out of the round: the classic one.
    M.setLiveViews(M.parseViews({ iso: { hidden: true } }))
    assert.equal(M.startView(null, null), 'classic')
    assert.equal(M.startView(null, 'iso'), 'classic')
    M.setLiveViews(null)
    // V is the only way a player picks a view: as many presses as there are views come back round, through each.
    let id = 'classic'
    const seen = []
    for (let i = 0; i < M.viewList().length; i++) { seen.push(id); id = M.nextView(id) }
    assert.equal(id, 'classic')
    assert.deepEqual(seen.sort(), M.viewList().map(v => v.id).sort())
  })

  it('keeps every view\'s code out of the page that loads first', () => {
    // Anything but a dynamic import() of a view, anywhere on the site, would put it in the entry:
    // a static import, a side-effect import or a re-export, in either kind of quote.
    // (A view's own directory may name it; the other view's directory may not, so both are walked.)
    const skip = new Set(['node_modules', '.nuxt', '.output', 'dist'])
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (skip.has(e.name) ? [] : walk(resolve(dir, e.name))) : [resolve(dir, e.name)])
    const files = ['themes', 'components', 'composables', 'pages', 'plugins', 'server'].flatMap(d => walk(resolve(site, d))).concat(resolve(site, 'app.vue'))
    const dynamic = { iso: 0 }
    for (const f of files) {
      if (!/\.(ts|vue|mjs|js)$/.test(f)) continue
      const src = readFileSync(f, 'utf8')
      for (const line of src.split('\n')) {
        const m = /(iso)\/view['"]/.exec(line)
        if (!m || /^\s*(\/\/|\*)/.test(line)) continue
        if (f.includes(`/render/${m[1]}/`)) continue
        assert.match(line, /import\(\s*['"][^'"]*(iso)\/view['"]\s*\)/, `${f} brings the ${m[1]} view in statically: ${line.trim()}`)
        dynamic[m[1]]++
      }
    }
    assert.deepEqual(dynamic, { iso: 1 }, 'the registry should hold the one dynamic import of each view')
  })
})

describe('the views\' data', () => {
  it('gives every engine a built-in view that loads it, and values inside their own bounds with words for the studio', () => {
    assert.deepEqual([...new Set(M.VIEWS.map(v => v.engine))].sort(), Object.keys(M.ENGINES).sort())
    assert.equal(M.VIEWS[0].id, 'classic')
    for (const v of M.VIEWS) {
      assert.equal(v.load, M.ENGINE_LOADERS[v.engine])
      if (v.engine !== 'classic') assert.equal(typeof v.load, 'function', `${v.id} has no loader`)
      assert.match(M.viewName(v.id), /^[A-Z0-9 ]+$/, 'the pause screen spells it in the pixel font')
      // A second look carries only values its engine knows, as they are kept (what differs from the engine's own).
      if (v.params) assert.deepEqual(v.params, M.paramDiff(v.engine, v.params), `${v.id} carries values its engine would drop`)
    }
    for (const [id, e] of Object.entries(M.ENGINES)) {
      assert.equal(M.VIEWS.find(v => v.engine === id).params, undefined, `${id}'s first view has values`)
      assert.ok(e.title && e.blurb, `${id} has no words for the studio`)
      for (const [name, spec] of Object.entries(e.params)) {
        assert.ok(spec.label, `${id}.${name} has no label`)
        if (spec.t === 'number') assert.ok(spec.min <= spec.value && spec.value <= spec.max, `${id}.${name} starts outside its bounds`)
        if (spec.t === 'choice') assert.ok(spec.options.includes(spec.value), `${id}.${name} starts on a choice it does not offer`)
      }
    }
  })

  it('makes a valid round of a dirty studio file: bad entries and values dropped, good ones merged and ordered', () => {
    const live = M.parseViews({
      'Bad Id': { engine: 'iso', name: 'X' },
      hologram: { engine: '3d', name: 'HOLO' },
      quiet: { engine: 'iso', name: 'lower case' },
      nameless: { engine: 'iso' },
      list: [],
      // The archived polygon engine, in a live file from before 2026-11-25.
      poly: { hidden: false, params: { fog: 0.5 } },
      third: { engine: 'poly', name: 'THIRD PERSON' },
      classic: { hidden: true, params: { scanlines: 0 } },
      iso: { hidden: true, params: { bloom: 0.2 } },
      noir: { engine: 'iso', name: 'NOIR', tag: 'no', params: { colors: '15-bit', shadow: 9, nonsense: 1 } },
      first: { engine: 'classic', name: 'FIRST', tag: '4-BIT', order: -1 },
    })
    assert.deepEqual(Object.keys(live).sort(), ['classic', 'first', 'iso', 'noir'])
    assert.equal(live.first.tag, '4-BIT')
    assert.deepEqual(live.noir, { engine: 'iso', name: 'NOIR', params: { colors: '15-bit', shadow: M.ENGINES.iso.params.shadow.max } })
    // The classic view can be changed and never hidden; the other built-in one can be hidden.
    const round = M.mergeViews(live)
    const others = M.VIEWS.map(v => v.id).filter(id => id !== 'classic' && id !== 'iso')
    assert.deepEqual(round.map(v => v.id).filter(id => !others.includes(id)), ['first', 'classic', 'noir'])
    assert.deepEqual(round.find(v => v.id === 'classic').params, { scanlines: 0 })
    assert.equal(M.mergeViews(M.parseViews({ iso: { params: { bloom: 0.2 } } })).find(v => v.id === 'iso').params.bloom, 0.2)
    // A value a visitor's browser kept is clamped, a colour that is not one refused, a choice kept to its choices.
    const v = M.resolveParams('iso', { bloom: 99, colors: 'vellum', shadowColor: 'red', skyHorizon: '#ABCDEF', nonsense: 1 })
    assert.deepEqual([v.bloom, v.colors, v.shadowColor, v.skyHorizon, 'nonsense' in v], [M.ENGINES.iso.params.bloom.max, 'full', M.ENGINES.iso.params.shadowColor.value, '#abcdef', false])
    assert.deepEqual(M.parseViews('nope'), {})
    assert.deepEqual(M.parseViews(null), {})
    // A published view joins the round, and when it is gone the first view is taken.
    M.setLiveViews(live)
    assert.equal(M.startView('noir', null), 'noir')
    assert.equal(M.viewName('noir'), 'NOIR')
    assert.equal(M.viewDef('poly'), undefined)
    assert.equal(M.startView('poly', 'third'), M.startView(null, null))
    M.setLiveViews(null)
    assert.equal(M.startView(null, 'noir'), M.DEFAULT_VIEW)
    assert.deepEqual(M.viewList().map(v => v.id), M.VIEWS.map(v => v.id))
  })

  it('never raises anything the hero can walk on above the ground, on any map', () => {
    // On the maps as the engine builds them (markers resolved to their tiles, doors included):
    // a walkable tile that stood up as a wall top would hide the hero standing on it.
    const g = M.createGame(M.WORLD, { seed: 1, at: M.WORLD.start })
    let seen = 0
    for (const id of Object.keys(M.WORLD.maps)) {
      M.enterMap(M.WORLD, g, id, '', [], { x: 1.5, y: 1.5 })
      const m = g.map
      const kind = M.WORLD.maps[id].kind
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const ch = m.tiles[y * m.w + x]
        if (M.TILE_INFO[ch].solid) continue
        const at = (dx, dy) => (x + dx < 0 || y + dy < 0 || x + dx >= m.w || y + dy >= m.h) ? (kind === 'overworld' ? 'T' : '#') : m.tiles[(y + dy) * m.w + x + dx]
        assert.notEqual(M.shapeOf(ch, kind, at).k, 'top', `${id} (${x},${y}) '${ch}' is walkable and raised`)
        seen++
      }
    }
    assert.ok(seen > 5000, `only ${seen} walkable tiles were looked at`)
  })

  it('puts the hero on open ground in every scene of the studio\'s stage, and names each for its list', () => {
    const ids = new Set()
    for (const sc of M.STAGE_SCENES) {
      assert.match(sc.id, /^[a-z][a-z0-9-]*$/)
      assert.ok(sc.label && sc.group, `${sc.id} has no label or group`)
      assert.ok(!ids.has(sc.id), `two scenes are called ${sc.id}`)
      ids.add(sc.id)
      const s = M.createGame(M.WORLD, { seed: 7 })
      sc.set(M.WORLD, s)
      const m = s.map
      const tx = Math.floor(s.hero.x)
      const ty = Math.floor(s.hero.y)
      assert.ok(tx >= 0 && ty >= 0 && tx < m.w && ty < m.h, `${sc.id} is off the map`)
      const t = m.tiles[ty * m.w + tx]
      assert.ok(!M.TILE_INFO[t].solid, `${sc.id} stands the hero in a wall (${t} at ${tx},${ty} of ${m.id})`)
    }
  })
})

describe('the isometric geometry', () => {
  const rect = { x: 0, y: 0, w: 40, h: 30 }
  const cam = (k, zoom0 = 2) => { const c = M.makeCam(k, 640, 400, zoom0, { x: 0, y: 0 }); M.fitDepth(c, rect); return c }

  it('finds the ground under a scene px again at every step of the turn and any height, and never folds it over', () => {
    for (let k = 0; k <= 1; k += 0.05) {
      const p = M.projection(k)
      assert.ok(p.ex.x * p.ey.y - p.ey.x * p.ex.y > 100, `the ground is flat or mirrored at k=${k}`)
      const s = M.project(p, 12.25, 40.5)
      const w = M.unproject(p, s.x, s.y)
      near(w.x, 12.25, 1e-6); near(w.y, 40.5, 1e-6)
    }
    for (const k of [0, 0.3, 0.7, 1]) {
      const c = cam(k)
      for (const [x, y, z] of [[3.25, 8.5, 0], [12, 2.75, 1], [30.5, 20.125, 2]]) {
        const s = M.toScene(c, x, y, z)
        const g = M.toGround(c, s.x, s.y, z)
        near(g.x, x, 1e-6); near(g.y, y, 1e-6)
      }
      // Height is never foreshortened: one tile up is one tile of px.
      const a = M.toScene(c, 7, 9, 0)
      const b = M.toScene(c, 7, 9, 1)
      near(a.x, b.x); near(a.y - b.y, 16 * c.zoom)
    }
    // Where the turn starts it is the classic picture: a wall's top one tile up lands where the art drew it.
    for (const zoom0 of [2, 2.5, 1.5]) {
      const c = cam(0, zoom0)
      near(c.zoom, zoom0)
      const top = M.toScene(c, 3, 5, 1)
      const drawn = M.toScene(c, 3, 4, 0)
      near(top.x, drawn.x); near(top.y, drawn.y)
    }
  })

  it('covers the whole screen with ground tiles, stays on the map, and keeps the camera in a big zone', () => {
    const p = M.projection(1)
    const c = M.project(p, 30, 20)
    const r = M.groundRect(p, c, 320, 200, 56, 2, 104, 48)
    for (const [sx, sy] of [[-160, -100], [160, -100], [-160, 156], [160, 156]]) {
      const w = M.unproject(p, c.x + sx, c.y + sy)
      const x = Math.max(0, Math.min(104, w.x))
      const y = Math.max(0, Math.min(48, w.y))
      assert.ok(x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h, 'a corner of the screen has no tile under it')
    }
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 104 && r.y + r.h <= 48)
    // The camera stays inside a big zone and centres a small one.
    const big = { x: 0, y: 0, w: 104, h: 48 }
    const far = M.centreIn(p, { x: 0, y: 0 }, big, 320, 200, 56)
    const box = M.projectedBox(p, big, 56)
    assert.ok(far.x - 160 >= box.x0 - 1e-6 && far.y - 100 >= box.y0 - 1e-6)
    const small = { x: 10, y: 10, w: 4, h: 4 }
    const mid = M.centreIn(p, { x: 10, y: 10 }, small, 320, 200, 0)
    const sb = M.projectedBox(p, small, 0)
    near(mid.x, (sb.x0 + sb.x1) / 2); near(mid.y, (sb.y0 + sb.y1) / 2)
  })

  it('puts what is nearer the viewer in front, further south-east and higher, at depths between 0 and 1', () => {
    const c = cam(1)
    assert.ok(M.depthOf(c, 10, 10) > M.depthOf(c, 9, 10))
    assert.ok(M.depthOf(c, 10, 10) > M.depthOf(c, 10, 9))
    assert.ok(M.depthOf(c, 10, 10, 1) > M.depthOf(c, 10, 10, 0))
    // A point straight behind another on the screen (one tile north-west, as far up as that puts it) is further away.
    const front = M.toScene(c, 10, 10, 0)
    const behind = M.toScene(c, 9, 9, -1)
    near(front.x, behind.x); near(front.y, behind.y)
    assert.ok(M.depthOf(c, 10, 10, 0) > M.depthOf(c, 9, 9, -1))
    // The classic view looks from the south: the same holds along its own line of sight.
    const c0 = cam(0)
    assert.ok(M.depthOf(c0, 5, 6) > M.depthOf(c0, 5, 5))
    for (const k of [0, 0.5, 1]) {
      const c = cam(k)
      for (const x of [rect.x, rect.x + rect.w]) for (const y of [rect.y, rect.y + rect.h]) for (const z of [0, M.Z_MAX]) {
        const d = M.depthOf(c, x, y, z)
        assert.ok(d > 0 && d < 1, `depth ${d} at ${x},${y},${z} for k=${k}`)
      }
    }
  })

  it('goes on past a map\'s edge as sea, woods, a road and rock only, farther than any screen sees', () => {
    // A small map: sea along the south-west, rock along the north-east and the south-east, a road out to the west, woods elsewhere.
    const rows = ['TTTT####', ',......#', 'T......T', '~~~~..##']
    const w = 8
    const h = 4
    const tiles = rows.join('').split('')
    const at = (x, y) => M.beyondTile(tiles, w, h, x, y)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) assert.equal(at(x, y), rows[y][x], 'the map itself inside the edge')
    const seen = new Set()
    for (let y = -M.BEYOND; y < h + M.BEYOND; y++) for (let x = -M.BEYOND; x < w + M.BEYOND; x++) {
      if (x >= 0 && y >= 0 && x < w && y < h) continue
      seen.add(at(x, y))
    }
    assert.deepEqual([...seen].sort(), ['#', ',', 'T', '~'])
    // The widest look past the edge: a tall phone, the hero in the map's corner. Half the scene in tiles.
    for (const [sw, sh] of [[390, 844], [960, 540], [860, 360]]) {
      const reach = sw / 2 / 64 + (sh / 2 + 2 * 56) / 32
      assert.ok(reach < M.BEYOND, `${sw}×${sh} sees ${reach.toFixed(1)} tiles past the edge`)
    }
    // The view's tiles take in that land round the map.
    const P = M.projection(1)
    const far = M.groundRect(P, M.project(P, 0, 0), 600, 400, 56, 2, 40, 30, M.BEYOND)
    assert.ok(far.x >= -M.BEYOND && far.y >= -M.BEYOND && far.x < 0 && far.y < 0)
  })
})

describe('playing in a turned view', () => {
  it('swings along the diagonal the hero walks', () => {
    const s = M.createGame(M.WORLD, { seed: 3 })
    s.dialog = null; s.mode = 'play'; s.hero.auto = null; s.inv.sword = true
    // Out on the open square, away from doors and people.
    s.hero.x = 20.5; s.hero.y = 17.5
    const d = Math.SQRT1_2
    for (let i = 0; i < 6; i++) M.stepGame(M.WORLD, s, 1 / 60, { ...M.NO_INPUT, move: { x: d, y: d } })
    M.stepGame(M.WORLD, s, 1 / 60, { ...M.NO_INPUT, move: { x: d, y: d }, a: true, aPress: true })
    assert.ok(s.hero.swing, 'the swing began')
    assert.ok(Math.abs(s.hero.swing.a - Math.PI / 4) < 1e-9)
    assert.ok(['down', 'right'].includes(s.hero.swing.dir))
  })

  it('lands the eight keyboard directions on the eight world directions, up on the screen, the push as long', () => {
    const T8 = Math.PI / 4
    // Up on an isometric screen is north-west in the world: the same ground step along both axes.
    const up = M.turnMove({ x: 0, y: -1 }, T8)
    near(up.x, -Math.SQRT1_2); near(up.y, -Math.SQRT1_2)
    const s = M.project(M.projection(1), up.x, up.y)
    near(s.x, 0); assert.ok(s.y < 0)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4
      const w = M.turnMove({ x: Math.cos(a), y: Math.sin(a) }, T8)
      near(w.x, Math.cos(a - T8)); near(w.y, Math.sin(a - T8))
    }
    const half = M.turnMove({ x: 0.3, y: 0.4 }, T8 * 0.6)
    near(Math.hypot(half.x, half.y), 0.5)
  })
})

describe('the turn between views', () => {
  const two = () => M.createTurn(id => id === 'iso' || id === 'other', 0.6)
  const run = (t, seconds, dt = 1 / 60) => { let r; for (let i = 0; i < Math.round(seconds / dt); i++) r = t.step(dt); return r }

  it('turns in from the classic view without ever drawing at k = 0, reverses without a jump, and turns out again', () => {
    const t = two()
    assert.deepEqual(t.step(1 / 60), { shown: '', k: 0 })
    assert.equal(t.id, 'classic')
    assert.equal(t.turning, false)
    // In, over the given time.
    t.set('iso')
    assert.equal(t.id, 'iso')
    assert.equal(t.turning, true)
    const first = t.step(1 / 60)
    assert.equal(first.shown, 'iso')
    assert.ok(first.k > 0 && first.k < 0.05)
    assert.ok(run(t, 0.3).k < 1)
    assert.deepEqual(run(t, 0.4), { shown: 'iso', k: 1 })
    assert.equal(t.turning, false)
    // And back out.
    assert.deepEqual(t.step(0), { shown: 'iso', k: 1 })
    t.set('classic')
    assert.equal(t.id, 'classic')
    assert.equal(run(t, 0.3).shown, 'iso')
    assert.deepEqual(run(t, 0.4), { shown: '', k: 0 })
    assert.equal(t.turning, false)
    // Taken back in the middle: no jump.
    t.set('iso')
    const up = run(t, 0.3).k
    t.set('classic')
    const down = t.step(1 / 60).k
    assert.ok(down < up && up - down < 0.05)
    // From one added view to another it goes through the classic one.
    const u = two()
    u.set('iso', true)
    u.set('other')
    assert.equal(run(u, 0.3).shown, 'iso')
    const seen = new Set()
    for (let i = 0; i < 120; i++) seen.add(u.step(1 / 60).shown)
    assert.deepEqual([...seen], ['iso', '', 'other'])
    assert.equal(u.k, 1)
  })

  it('waits on the classic picture for a view that cannot draw, falls back when one is lost, and lets go of it', () => {
    const t = two()
    t.set('iso')
    for (let i = 0; i < 30; i++) assert.deepEqual(t.step(1 / 60, false), { shown: '', k: 0 })
    assert.equal(t.id, 'iso')
    assert.equal(t.turning, true)
    assert.equal(t.waiting, true)
    const first = t.step(1 / 60, true)
    assert.equal(first.shown, 'iso')
    assert.ok(first.k > 0 && first.k < 0.05, 'the turn starts at the classic picture, however long the wait was')
    assert.equal(t.waiting, false)
    assert.deepEqual(run(t, 0.7), { shown: 'iso', k: 1 })
    // No turn was asked for: it arrives at once, and falls back to the classic picture if it is lost again.
    const u = two()
    u.set('iso', true)
    assert.deepEqual(u.step(1 / 60, false), { shown: '', k: 0 })
    assert.deepEqual(u.step(1 / 60, true), { shown: 'iso', k: 1 })
    assert.deepEqual(u.step(1 / 60, false), { shown: '', k: 0 })
    assert.equal(u.id, 'iso')
    assert.deepEqual(u.step(1 / 60, true), { shown: 'iso', k: 1 })
    // Asked for another while it cannot draw: it is let go.
    u.set('classic')
    assert.deepEqual(u.step(1 / 60, false), { shown: '', k: 0 })
    assert.deepEqual([u.turning, u.waiting], [false, false])
  })

  it('never lets a long frame carry the turn over the hand-off, in or out', () => {
    // The renderer's numbers (TURN_S, HANDOFF in renderer.ts).
    const S = 0.7
    const H = 0.1
    /** A whole turn at a given frame length: the raw k of every frame the view drew. */
    const frames = (t, dt) => {
      const ks = []
      for (let i = 0; i < 600 && t.turning; i++) { const r = t.step(M.turnTime(dt, t.k, H, S, false)); if (r.shown) ks.push(r.k) }
      return ks
    }
    /** The same with the renderer's clock (`turnDt`): every frame the turn had, as [k, the view drew]. */
    const clocked = (t, dts) => {
      const clock = M.createTurnClock(H, S)
      const out = []
      for (let i = 0; i < 600 && t.turning; i++) { const r = t.step(clock(dts(i), t)); out.push([r.k, r.shown !== '']) }
      return out
    }
    for (const dt of [1 / 60, 1 / 30, 1 / 20, 0.1]) {
      const t = M.createTurn(id => id === 'iso', S)
      t.set('iso')
      const into = frames(t, dt).filter(k => k < H)
      assert.ok(into.length >= 4, `in at ${dt.toFixed(3)} s a frame: ${into.length} frames of the hand-off`)
      t.set('classic')
      const out = frames(t, dt).filter(k => k < H)
      assert.ok(out.length >= 4, `out at ${dt.toFixed(3)} s a frame: ${out.length} frames of the hand-off`)
    }
    // Frames of any length, one after the other (a device that stutters), with and without the frame the classic
    // picture is painted in: four frames of the hand-off or more, both ways.
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let n = 0; n < 20; n++) {
      const t = M.createTurn(id => id === 'iso', S)
      t.set('iso')
      const into = clocked(t, () => 1 / 60 + rnd() * (0.1 - 1 / 60)).filter(f => f[1] && f[0] < H)
      assert.ok(into.length >= 4, `in, run ${n}: ${into.length} frames of the hand-off`)
      t.set('classic')
      const cold = n % 2 === 1
      const clock = M.createTurnClock(H, S)
      let hand = 0
      for (let i = 0; i < 600 && t.turning; i++) {
        const r = t.step(clock(1 / 60 + rnd() * (0.1 - 1 / 60), t, cold && i === 2))
        if (r.shown && r.k < H) hand++
      }
      assert.ok(hand >= 4, `out${cold ? ', cold' : ''}, run ${n}: ${hand} frames of the hand-off`)
    }
    // The longest frame the shell hands over, from anywhere above the hand-off: it lands in it, not past it.
    for (let k = H + 0.001; k < 1; k += 0.007) {
      const left = k - M.turnTime(0.1, k, H, S) / S
      assert.ok(left > 0, `a long frame at k ${k.toFixed(3)} ends the turn (${left.toFixed(3)})`)
    }
  })
})
