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

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './render/iso/project'`,
        `export * from './render/iso/shape'`,
        `export { VIEWS, VIEW_KEY, isViewId, nextView, viewName, startView } from './views'`,
        `export { WORLD } from './world/index'`,
        `export { TILE_INFO } from './world/tiles'`,
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
    // A static import of the view anywhere outside render/iso/ would put it in the entry.
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'iso' ? [] : walk(resolve(dir, e.name))) : [resolve(dir, e.name)])
    for (const f of walk(root)) {
      if (!/\.(ts|vue)$/.test(f)) continue
      const src = readFileSync(f, 'utf8')
      assert.doesNotMatch(src, /^import (?!type)[^\n]*iso\/view'/m, `${f} imports the isometric view statically`)
    }
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
    // A walkable tile that stood up as a wall top would hide the hero standing on it.
    for (const def of Object.values(M.WORLD.maps)) {
      const rows = def.rows
      for (let y = 0; y < rows.length; y++) for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x]
        const info = M.TILE_INFO[ch]
        if (!info || info.solid || def.marks[ch]) continue
        const at = (dx, dy) => {
          const c = rows[y + dy]?.[x + dx]
          return c && M.TILE_INFO[c] && !def.marks[c] ? c : '.'
        }
        assert.notEqual(M.shapeOf(ch, def.kind, at).k, 'top', `${def.id} (${x},${y}) '${ch}' is walkable and raised`)
      }
    }
  })
})
