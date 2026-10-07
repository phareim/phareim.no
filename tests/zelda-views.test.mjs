// Neon Shrine's views: the registry, the isometric geometry and how tiles
// stand. Pure modules, bundled with esbuild like the other zelda tests.
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
        `export * from './render/iso/shape'`,
        `export { VIEWS, VIEW_KEY, isViewId, nextView, viewName, startView } from './views'`,
        `export { WORLD } from './world/index'`,
        `export { TILE_INFO } from './world/tiles'`,
        `export { createTurn } from './render/turn'`,
        `export { createGame } from './engine/index'`,
        `export { enterMap } from './engine/game'`,
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

describe('the view registry', () => {
  it('starts with the classic view, which needs no code of its own', () => {
    assert.equal(M.VIEWS[0].id, 'classic')
    assert.equal(M.VIEWS[0].load, undefined)
    for (const v of M.VIEWS.slice(1)) assert.equal(typeof v.load, 'function', `${v.id} has no loader`)
  })
  it('goes round every view and back', () => {
    let id = 'classic'
    const seen = []
    for (let i = 0; i < M.VIEWS.length; i++) { seen.push(id); id = M.nextView(id) }
    assert.equal(id, 'classic')
    assert.deepEqual(seen.sort(), M.VIEWS.map(v => v.id).sort())
  })
  it('takes the address before the stored choice, and nonsense from neither', () => {
    assert.equal(M.startView('iso', 'classic'), 'iso')
    assert.equal(M.startView(null, 'iso'), 'iso')
    assert.equal(M.startView('3d', 'iso'), 'iso')
    assert.equal(M.startView('3d', 'hologram'), 'classic')
    assert.equal(M.startView(null, null), 'classic')
  })
  it('names every view for the pause screen in the pixel font', () => {
    for (const v of M.VIEWS) assert.match(M.viewName(v.id), /^[A-Z0-9 ]+$/)
  })
  it('keeps the isometric code out of the page that loads first', () => {
    // Anything but a dynamic import() of the view, anywhere on the site, would put it in the entry:
    // a static import, a side-effect import or a re-export, in either kind of quote.
    const skip = new Set(['node_modules', '.nuxt', '.output', 'dist', 'iso'])
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (skip.has(e.name) ? [] : walk(resolve(dir, e.name))) : [resolve(dir, e.name)])
    const files = ['themes', 'components', 'composables', 'pages', 'plugins', 'server'].flatMap(d => walk(resolve(site, d))).concat(resolve(site, 'app.vue'))
    let dynamic = 0
    for (const f of files) {
      if (!/\.(ts|vue|mjs|js)$/.test(f)) continue
      const src = readFileSync(f, 'utf8')
      for (const line of src.split('\n')) {
        if (!/iso\/view['"]/.test(line) || /^\s*(\/\/|\*)/.test(line)) continue
        assert.match(line, /import\(\s*['"][^'"]*iso\/view['"]\s*\)/, `${f} brings the isometric view in statically: ${line.trim()}`)
        dynamic++
      }
    }
    assert.equal(dynamic, 1, 'the registry should hold the one dynamic import of the view')
  })
})

describe('the projection', () => {
  it('is the classic view at 0 and a 2:1 diamond at 1', () => {
    assert.deepEqual(M.projection(0), { ex: { x: 16, y: 0 }, ey: { x: 0, y: 16 }, k: 0 })
    assert.deepEqual(M.projection(1), { ex: { x: 16, y: 8 }, ey: { x: -16, y: 8 }, k: 1 })
  })
  it('turns without a jump at either end', () => {
    const a = M.projection(0.0001)
    near(a.ex.x, 16, 0.01); near(a.ex.y, 0, 0.01); near(a.ey.x, 0, 0.01); near(a.ey.y, 16, 0.01)
    const b = M.projection(0.9999)
    near(b.ex.x, 16, 0.01); near(b.ex.y, 8, 0.01); near(b.ey.x, -16, 0.01); near(b.ey.y, 8, 0.01)
  })
  it('never folds the ground over on the way', () => {
    for (let k = 0; k <= 1; k += 0.05) {
      const p = M.projection(k)
      assert.ok(p.ex.x * p.ey.y - p.ey.x * p.ex.y > 100, `the ground is flat or mirrored at k=${k}`)
    }
  })
  it('unprojects what it projects', () => {
    for (const k of [0, 0.3, 0.77, 1]) {
      const p = M.projection(k)
      const s = M.project(p, 12.25, 40.5)
      const w = M.unproject(p, s.x, s.y)
      near(w.x, 12.25, 1e-6); near(w.y, 40.5, 1e-6)
    }
  })
  it('covers the whole screen with ground tiles, and stays on the map', () => {
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
  })
  it('keeps the camera inside a big zone and centres a small one', () => {
    const p = M.projection(1)
    const big = { x: 0, y: 0, w: 104, h: 48 }
    const far = M.centreIn(p, { x: 0, y: 0 }, big, 320, 200, 56)
    const box = M.projectedBox(p, big, 56)
    assert.ok(far.x - 160 >= box.x0 - 1e-6 && far.y - 100 >= box.y0 - 1e-6)
    const small = { x: 10, y: 10, w: 4, h: 4 }
    const mid = M.centreIn(p, { x: 10, y: 10 }, small, 320, 200, 0)
    const sb = M.projectedBox(p, small, 0)
    near(mid.x, (sb.x0 + sb.x1) / 2); near(mid.y, (sb.y0 + sb.y1) / 2)
  })
})

describe('controls in a turned view', () => {
  const T8 = Math.PI / 4
  it('leaves the classic view alone', () => {
    const m = { x: 0.3, y: -0.8 }
    assert.equal(M.turnMove(m, 0), m)
  })
  it('makes up on the stick up on the screen', () => {
    // Up on an isometric screen is north-west in the world: the same ground step along both axes.
    const w = M.turnMove({ x: 0, y: -1 }, T8)
    near(w.x, -Math.SQRT1_2); near(w.y, -Math.SQRT1_2)
    const s = M.project(M.projection(1), w.x, w.y)
    near(s.x, 0); assert.ok(s.y < 0)
  })
  it('lands the eight keyboard directions on the eight world directions', () => {
    const n = M.turnMove({ x: Math.SQRT1_2, y: -Math.SQRT1_2 }, T8)
    near(n.x, 0); near(n.y, -1)
    const e = M.turnMove({ x: Math.SQRT1_2, y: Math.SQRT1_2 }, T8)
    near(e.x, 1); near(e.y, 0)
    const r = M.turnMove({ x: 1, y: 0 }, T8)
    near(r.x, Math.SQRT1_2); near(r.y, -Math.SQRT1_2)
  })
  it('keeps the length of the push', () => {
    const w = M.turnMove({ x: 0.3, y: 0.4 }, T8 * 0.6)
    near(Math.hypot(w.x, w.y), 0.5)
  })
})

describe('how tiles stand', () => {
  const grid = (rows, kind) => (x, y) => {
    const at = (dx, dy) => rows[y + dy]?.[x + dx] ?? (kind === 'overworld' ? 'T' : '#')
    return M.shapeOf(rows[y][x], kind, at)
  }
  it('reads a dungeon wall as a top with a face on its southern row', () => {
    const s = grid(['####', '####', '....'], 'dungeon')
    assert.equal(s(1, 0), M.WALL_TOP)
    assert.equal(s(1, 1), M.FACE0)
    assert.equal(s(1, 2), M.FLAT)
  })
  it('leaves a wall down when floor lies to its west, so it hides nothing', () => {
    const s = grid(['#..#', '#..#', '#..#', '####'], 'interior')
    assert.equal(s(0, 0), M.WALL_TOP)
    assert.equal(s(3, 0), M.FLAT)
    assert.equal(s(3, 1), M.FLAT)
  })
  it('gives a house a roof, a window row and a foot, with the door in the foot', () => {
    const s = grid(['.....', '.HHH.', '.HHH.', '.HHH.', '.HDH.', '.....'], 'overworld')
    assert.equal(s(1, 1), M.ROOF)
    assert.equal(s(1, 2), M.ROOF)
    assert.equal(s(1, 3), M.FACE1)
    assert.equal(s(1, 4), M.FACE0)
    assert.equal(s(2, 4), M.FACE0)
    assert.equal(s(2, 3), M.FACE1)
  })
  it('stands a lone tree up and makes a canopy of trees with trees below', () => {
    const s = grid(['.....', '.T.T.', '...T.', '.....'], 'overworld')
    assert.equal(s(1, 1), M.CARD)
    assert.equal(s(3, 1), M.CANOPY)
    assert.equal(s(3, 2), M.CARD)
  })
  it('stands a fence along x up as a strip and lays one along y down', () => {
    const s = grid(['.....', '.FFF.', '.....', '..F..', '..F..', '.....', '.F...'], 'overworld')
    assert.equal(s(2, 1), M.FACE0)
    assert.equal(s(2, 3), M.FLAT)
    assert.equal(s(1, 6), M.CARD)
  })
  it('keeps a crystal block down until it is raised, and an exit\'s tile bare', () => {
    const at = () => '.'
    assert.equal(M.shapeOf('P', 'dungeon', at, false, false), M.FLAT)
    assert.equal(M.shapeOf('P', 'dungeon', at, false, true), M.CARD)
    assert.equal(M.shapeOf('M', 'interior', at, true), M.FLAT)
  })
  it('never raises anything the hero can walk on above the ground', () => {
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
  it('leaves a wall down over a door that lies flat in a side wall', () => {
    // Two door tiles one above the other in a west wall: nothing may stand on the upper one.
    const s = grid(['##...', '##...', 'L....', 'L....', '##...', '##...'], 'dungeon')
    assert.equal(s(0, 1), M.FLAT)
    assert.equal(s(0, 2), M.FLAT)
    assert.equal(s(0, 3), M.FLAT)
    // A door in a north wall stands, and so does the wall above it.
    const n = grid(['###', '###', '#L#', '...'], 'dungeon')
    assert.equal(n(1, 2), M.FACE0)
    assert.equal(n(1, 1), M.WALL_TOP)
  })
})

describe('the turn between views', () => {
  const two = () => M.createTurn(id => id === 'iso' || id === 'other', 0.6)
  const run = (t, seconds, dt = 1 / 60) => { let r; for (let i = 0; i < Math.round(seconds / dt); i++) r = t.step(dt); return r }
  it('starts on the classic view and stays there', () => {
    const t = two()
    assert.deepEqual(t.step(1 / 60), { shown: '', k: 0 })
    assert.equal(t.id, 'classic')
    assert.equal(t.turning, false)
  })
  it('turns in over the given time, and never draws the view at k = 0', () => {
    const t = two()
    t.set('iso')
    assert.equal(t.id, 'iso')
    assert.equal(t.turning, true)
    const first = t.step(1 / 60)
    assert.equal(first.shown, 'iso')
    assert.ok(first.k > 0 && first.k < 0.05)
    assert.ok(run(t, 0.3).k < 1)
    assert.deepEqual(run(t, 0.4), { shown: 'iso', k: 1 })
    assert.equal(t.turning, false)
  })
  it('turns back out, and the classic view takes over at the end', () => {
    const t = two()
    t.set('iso', true)
    assert.deepEqual(t.step(0), { shown: 'iso', k: 1 })
    t.set('classic')
    assert.equal(t.id, 'classic')
    assert.equal(run(t, 0.3).shown, 'iso')
    assert.deepEqual(run(t, 0.4), { shown: '', k: 0 })
    assert.equal(t.turning, false)
  })
  it('reverses in the middle without a jump', () => {
    const t = two()
    t.set('iso')
    const up = run(t, 0.3).k
    t.set('classic')
    const down = t.step(1 / 60).k
    assert.ok(down < up && up - down < 0.05)
  })
  it('goes from one added view to another through the classic one', () => {
    const t = two()
    t.set('iso', true)
    t.set('other')
    assert.equal(t.id, 'other')
    assert.equal(run(t, 0.3).shown, 'iso')
    const seen = new Set()
    for (let i = 0; i < 120; i++) seen.add(t.step(1 / 60).shown)
    assert.deepEqual([...seen], ['iso', '', 'other'])
    assert.equal(t.k, 1)
  })
  it('stands still while no time passes, and says a turn is in flight', () => {
    const t = two()
    t.set('iso')
    run(t, 0.2)
    const k = t.k
    assert.equal(t.step(0).k, k)
    assert.equal(t.turning, true)
    t.set('iso', true)
    assert.equal(t.turning, false)
    assert.equal(t.k, 1)
  })
  it('treats a view it does not have as the classic one', () => {
    const t = two()
    t.set('hologram')
    assert.equal(t.id, 'classic')
    assert.deepEqual(t.step(1), { shown: '', k: 0 })
  })
})
