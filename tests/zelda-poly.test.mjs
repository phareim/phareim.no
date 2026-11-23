// Neon Shrine's polygon view: the camera rig and the land. Pure modules,
// bundled with esbuild like the other zelda tests. These tests are the
// contract the view is built on (`render/poly/camera.ts`, `terrain.ts`).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './render/poly/camera'`,
        `export * from './render/poly/terrain'`,
        `export { TILE } from './types'`,
        `export { WORLD } from './world/index'`,
        `export { BEYOND, beyondTile } from './render/beyond'`,
        `export { mapInfo } from './engine/index'`,
      ].join('; '),
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`)
const VW = 320
const VH = 200

// ------------------------------------------------------------------ camera

describe('the camera rig', () => {
  it('draws the classic picture to the pixel at its classic end', () => {
    const T = M.TILE
    const m = M.classicMatrix(VW, VH, 37, 21)
    for (const [x, y, z] of [[3, 2, 0], [10.5, 7.25, 0], [10.5, 7.25, 1], [18, 12, 2.5]]) {
      const p = M.toScreen(m, VW, VH, x, y, z)
      near(p.x, x * T - 37, 1e-4)
      near(p.y, (y - z) * T - 21, 1e-4)
    }
  })
  it('sorts the classic picture as its painters do: further south is in front', () => {
    const m = M.classicMatrix(VW, VH, 0, 0)
    // (5, 6, 1) and (5, 5, 0) share a pixel; the lifted one stands further south and hides the ground behind it.
    const lifted = M.toScreen(m, VW, VH, 5, 6, 1)
    const ground = M.toScreen(m, VW, VH, 5, 5, 0)
    near(lifted.y, ground.y, 1e-4)
    assert.ok(lifted.depth < ground.depth)
  })
  it('puts the focus where the pose says, with north up and height up', () => {
    const f = { x: 20, y: 30, z: 0 }
    for (const pose of [M.CRANE, M.SHOULDER]) {
      const m = M.poseMatrix(pose, VW, VH, f)
      const c = M.toScreen(m, VW, VH, f.x, f.y, f.z)
      near(c.x, VW / 2, 1e-3)
      near(c.y, pose.focusY * VH, 1e-3)
      assert.ok(M.toScreen(m, VW, VH, f.x, f.y - 2, 0).y < c.y, 'north of the focus is not above it')
      assert.ok(M.toScreen(m, VW, VH, f.x + 2, f.y, 0).x > c.x, 'east of the focus is not right of it')
      const up = M.toScreen(m, VW, VH, f.x, f.y, 1)
      assert.ok(up.y < c.y, 'a point over the focus is not above it')
      near(up.x, c.x, 1e-3) // the lens shift keeps what stands upright upright in the middle of the screen
    }
  })
  it('is a perspective: what is further away is smaller and deeper', () => {
    const f = { x: 20, y: 30, z: 0 }
    const m = M.poseMatrix(M.CRANE, VW, VH, f)
    const span = (y) => M.toScreen(m, VW, VH, f.x + 1, y, 0).x - M.toScreen(m, VW, VH, f.x, y, 0).x
    assert.ok(span(f.y - 6) < span(f.y) && span(f.y) < span(f.y + 2))
    assert.ok(M.toScreen(m, VW, VH, f.x, f.y - 6, 0).depth > M.toScreen(m, VW, VH, f.x, f.y, 0).depth)
    assert.ok(M.toScreen(m, VW, VH, f.x, f.y, 0).w > 0)
  })
  it('shows a horizon: in the top quarter from the crane, lower from the shoulder, none in the classic picture', () => {
    const f = { x: 20, y: 30, z: 0 }
    const crane = M.horizonY(M.poseMatrix(M.CRANE, VW, VH, f), VW, VH)
    const shoulder = M.horizonY(M.poseMatrix(M.SHOULDER, VW, VH, f), VW, VH)
    assert.ok(crane > 0.03 * VH && crane < 0.25 * VH, `the crane's horizon is at ${crane}`)
    assert.ok(shoulder > crane && shoulder < 0.5 * VH, `the shoulder's horizon is at ${shoulder}`)
    assert.equal(M.horizonY(M.classicMatrix(VW, VH, 0, 0), VW, VH), Infinity)
  })
  it('keeps the controls as the classic view has them from the crane', () => {
    assert.equal(M.CRANE.yaw, 0)
  })
  it('finds the ground under a pixel, and none over the horizon', () => {
    const f = { x: 20, y: 30, z: 0 }
    const m = M.poseMatrix(M.CRANE, VW, VH, f)
    for (const [x, y, z] of [[20, 30, 0], [17.5, 26, 0], [23, 31, 0.5]]) {
      const p = M.toScreen(m, VW, VH, x, y, z)
      const g = M.toGround(m, VW, VH, p.x, p.y, z)
      near(g.x, x, 1e-3); near(g.y, y, 1e-3)
    }
    assert.equal(M.toGround(m, VW, VH, VW / 2, 0, 0), null)
    const c = M.classicMatrix(VW, VH, 37, 21)
    const g = M.toGround(c, VW, VH, 100, 60, 0)
    near(g.x, (100 + 37) / M.TILE, 1e-4); near(g.y, (60 + 21) / M.TILE, 1e-4)
  })
  it('turns from the classic picture to the pose without a jump', () => {
    const f = { x: 20, y: 30, z: 0 }
    const T = M.TILE
    const classic = M.classicMatrix(VW, VH, f.x * T - VW / 2, f.y * T - VH / 2)
    const posed = M.poseMatrix(M.CRANE, VW, VH, f)
    const pts = [[20, 30, 0], [14, 27, 0], [27, 34, 0], [20, 26, 1.5], [12, 25, 0], [28, 35, 2]]
    const at = (k) => pts.map(([x, y, z]) => M.toScreen(M.rigMatrix(k, classic, posed), VW, VH, x, y, z))
    at(0).forEach((p, i) => { const q = M.toScreen(classic, VW, VH, ...pts[i]); near(p.x, q.x, 1e-3); near(p.y, q.y, 1e-3) })
    at(1).forEach((p, i) => { const q = M.toScreen(posed, VW, VH, ...pts[i]); near(p.x, q.x, 1e-3); near(p.y, q.y, 1e-3) })
    let prev = at(0)
    for (let i = 1; i <= 50; i++) {
      const now = at(i / 50)
      now.forEach((p, j) => {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && p.w > 0, `point ${j} is lost at k ${i / 50}`)
        assert.ok(Math.hypot(p.x - prev[j].x, p.y - prev[j].y) < 0.12 * VW, `point ${j} jumps at k ${i / 50}`)
      })
      prev = now
    }
  })
  it('eases one pose into another, the short way round', () => {
    const a = { ...M.CRANE, yaw: 0.2 }
    const b = { ...M.SHOULDER, yaw: 2 * Math.PI - 0.2 }
    assert.deepEqual(M.mixPose(a, b, 0), a)
    const end = M.mixPose(a, b, 1)
    near(end.pitch, b.pitch); near(end.dist, b.dist); near(end.fov, b.fov); near(end.focusY, b.focusY)
    near(Math.cos(end.yaw), Math.cos(b.yaw)); near(Math.sin(end.yaw), Math.sin(b.yaw))
    const mid = M.mixPose(a, b, 0.5)
    near(Math.sin(mid.yaw), 0, 1e-6) // through north, not the long way through south
    assert.ok(Math.cos(mid.yaw) > 0.9)
    assert.ok(mid.dist < a.dist && mid.dist > b.dist && mid.pitch < a.pitch && mid.pitch > b.pitch)
  })
})

// -------------------------------------------------------------------- land

/** A small map for the rules: a meadow with a square pond, a house, a path, a wall, a stream one tile wide and a straight coast. */
const ROWS = [
  '........................',
  '........................',
  '...~~~~........HHH......',
  '...~~~~........HHH......',
  '...~~~~........HDH......',
  '...~~~~.........,.......',
  '................,.......',
  '....,,,,,,,,,,,,,.......',
  '........................',
  '..####..................',
  '........................',
  '.........~..............',
  '.........~..............',
  '.........~..............',
  '........................',
  '........................',
  '------------------------',
  '~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~',
]
const W = ROWS[0].length
const H = ROWS.length
function source(extra = {}) {
  return {
    w: W, h: H, kind: 'overworld', beyond: 6, seed: 11,
    // Beyond the edge: the sea goes on to the south, the meadow everywhere else.
    at: (x, y) => { const tx = Math.floor(x), ty = Math.floor(y); return ty >= H ? '~' : ROWS[Math.max(0, ty)]?.[Math.max(0, Math.min(W - 1, tx))] ?? '.' },
    ...extra,
  }
}
const LOOK = { hills: 1, shore: 1, far: 2.5 }
const tileAt = (x, y) => ROWS[Math.floor(y)]?.[Math.floor(x)]
/** Sample points inside the map, a quarter tile apart, off the lattice. */
function* samples(step = 0.25, off = 0.07) {
  for (let y = off; y < H; y += step) for (let x = off; x < W; x += step) yield [x, y]
}
/** Distance from a point to the nearest tile for which `is` holds, tiles (0 inside one). */
function distTo(x, y, is, reach = 3) {
  let best = Infinity
  const tx = Math.floor(x), ty = Math.floor(y)
  for (let j = ty - reach; j <= ty + reach; j++) for (let i = tx - reach; i <= tx + reach; i++) {
    const t = j >= H ? '~' : ROWS[Math.max(0, j)]?.[Math.max(0, Math.min(W - 1, i))] ?? '.'
    if (!is(t)) continue
    const dx = Math.max(i - x, 0, x - (i + 1)), dy = Math.max(j - y, 0, y - (j + 1))
    best = Math.min(best, Math.hypot(dx, dy))
  }
  return best
}

describe('the land', () => {
  it('says what may rise and what must stand level', () => {
    for (const t of ['.', ':', ';', 'T']) assert.equal(M.levelOf(t), 1, t)
    for (const t of ['#', '%', '^', 'H', 'M', 'D', '>', '=', '~', 'O', '_', 'x', 'b', 'B', 'c', 'P', 'C', '|', '{', '}', 'l', 'R', 'L', 'K', 'X', 'n', 'I', 'Z']) assert.equal(M.levelOf(t), 0, t)
    for (const t of [',', '-']) assert.ok(M.levelOf(t) > 0 && M.levelOf(t) < 1, t)
  })
  it('is the same land every time', () => {
    const a = M.buildLand(source(), LOOK)
    const b = M.buildLand(source(), LOOK)
    for (const [x, y] of samples(0.5)) assert.equal(a.height(x, y), b.height(x, y))
    const c = M.buildLand(source({ seed: 12 }), LOOK)
    let differs = false
    for (const [x, y] of samples(0.5)) if (a.height(x, y) !== c.height(x, y)) differs = true
    assert.ok(differs, 'another seed gives the same hills')
  })
  it('has hills, and none below the level ground', () => {
    const land = M.buildLand(source(), LOOK)
    let top = 0
    for (const [x, y] of samples()) {
      const h = land.height(x, y)
      assert.ok(Number.isFinite(h))
      if (land.shore(x, y) > 0.6) assert.ok(h >= -1e-9, `the dry ground at ${x}, ${y} lies at ${h}`)
      top = Math.max(top, h)
    }
    assert.ok(top > 0.4 && top <= LOOK.hills + 1e-9, `the tallest knoll is ${top}`)
    const flat = M.buildLand(source(), { ...LOOK, hills: 0 })
    for (const [x, y] of samples(0.5)) if (flat.shore(x, y) > 0.6) near(flat.height(x, y), 0)
  })
  it('keeps level what the player reads rules from, and a tile round houses and doors', () => {
    const land = M.buildLand(source({ level: (x, y) => x === 20 && y === 12 }), LOOK)
    for (const [x, y] of samples()) {
      const t = tileAt(x, y)
      if (t !== '~' && M.levelOf(t) === 0) near(land.height(x, y), 0)
      if (distTo(x, y, q => q === 'H' || q === 'D') <= 1) near(land.height(x, y), 0)
    }
    for (const [dx, dy] of [[0.1, 0.1], [0.5, 0.5], [0.9, 0.9]]) near(land.height(20 + dx, 12 + dy), 0)
  })
  it('never rises steeper than a walk away from water', () => {
    const land = M.buildLand(source(), LOOK)
    const d = 0.2
    for (const [x, y] of samples()) {
      if (distTo(x, y, q => q === '~') < 1.5) continue
      const h = land.height(x, y)
      for (const [dx, dy] of [[d, 0], [0, d]]) assert.ok(Math.abs(land.height(x + dx, y + dy) - h) <= M.SLOPE_MAX * d + 1e-6, `too steep at ${x}, ${y}`)
    }
  })
  it('is the drawn surface: the lattice, and two triangles to a cell', () => {
    const land = M.buildLand(source(), LOOK)
    assert.ok(Number.isInteger(land.res) && land.res >= 1 && land.res <= 4)
    const s = 1 / land.res
    for (const [cx, cy] of [[7, 10], [12.5, 1], [2, 14]]) {
      const nw = land.height(cx, cy), ne = land.height(cx + s, cy), sw = land.height(cx, cy + s), se = land.height(cx + s, cy + s)
      near(land.height(cx + s / 2, cy + s / 2), (nw + se) / 2)
      near(land.height(cx + 0.75 * s, cy + 0.25 * s), ne + 0.25 * (nw - ne) + 0.25 * (se - ne)) // in the north-east triangle
      near(land.height(cx + 0.25 * s, cy + 0.75 * s), sw + 0.25 * (nw - sw) + 0.25 * (se - sw)) // in the south-west one
    }
  })
  it('puts the water where the land lies under its surface', () => {
    const land = M.buildLand(source(), LOOK)
    assert.ok(land.waterLevel < 0 && land.waterLevel > -0.5)
    for (const [x, y] of samples()) {
      const s = land.shore(x, y)
      if (Math.abs(s) < 0.03) continue
      assert.equal(land.height(x, y) < land.waterLevel, s < 0, `shore and height disagree at ${x}, ${y}`)
    }
  })
  it('lets the shoreline leave the tile edge by no more than SHORE_MAX', () => {
    const land = M.buildLand(source(), LOOK)
    assert.ok(M.SHORE_MAX < 0.5)
    for (const [x, y] of samples(0.125, 0.031)) {
      const wet = land.shore(x, y) < 0
      const inWater = tileAt(x, y) === '~'
      if (inWater && distTo(x, y, q => q !== '~') > M.SHORE_MAX + 0.01) assert.ok(wet, `dry in the water at ${x}, ${y}`)
      if (!inWater && distTo(x, y, q => q === '~') > M.SHORE_MAX + 0.01) assert.ok(!wet, `wet on the land at ${x}, ${y}`)
    }
    // Whoever stands in the middle of a tile stands where the rules say: dry on land, and a stream one tile wide is still there.
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) assert.equal(land.shore(x + 0.5, y + 0.5) < 0, ROWS[y][x] === '~', `the middle of ${x}, ${y}`)
  })
  it('rounds a square pond and lets a straight coast wander', () => {
    const land = M.buildLand(source(), LOOK)
    // The pond's four corners (tiles 3–6 by 2–5): just inside the corner is dry land.
    for (const [x, y] of [[3.06, 2.06], [6.94, 2.06], [3.06, 5.94], [6.94, 5.94]]) assert.ok(land.shore(x, y) > 0, `the pond's corner at ${x}, ${y} is square`)
    // The coast along y = 17: where the drawn shoreline lies at each x, found by halving.
    const offs = []
    for (let x = 1.5; x < W - 1; x += 0.5) {
      let lo = 17 - M.SHORE_MAX - 0.02, hi = 17 + M.SHORE_MAX + 0.02
      assert.ok(land.shore(x, lo) > 0 && land.shore(x, hi) < 0)
      for (let i = 0; i < 24; i++) { const mid = (lo + hi) / 2; if (land.shore(x, mid) > 0) lo = mid; else hi = mid }
      offs.push(lo - 17)
    }
    assert.ok(Math.max(...offs) - Math.min(...offs) > 0.12, `the coast is straight (${Math.min(...offs)} … ${Math.max(...offs)})`)
  })
  it('is the classic land with every value at nothing', () => {
    const land = M.buildLand(source(), { hills: 0, shore: 0, far: 0 })
    for (const [x, y] of samples(0.125, 0.031)) assert.equal(land.shore(x, y) < 0, tileAt(x, y) === '~', `the shore has left the tile edge at ${x}, ${y}`)
  })
  it('goes on beyond the map without a step, and rises toward the horizon', () => {
    const land = M.buildLand(source(), LOOK)
    for (let y = 0.3; y < 14; y += 0.7) {
      assert.ok(Math.abs(land.height(-0.05, y) - land.height(0.05, y)) < 0.08, `a step at the west edge, y ${y}`)
      assert.ok(Number.isFinite(land.height(-6, y)))
    }
    let far = 0
    for (let x = 0.5; x < W; x += 1) far = Math.max(far, land.height(x, -5.5))
    assert.ok(far > 1, `the land five tiles north of the map rises only to ${far}`)
    assert.ok(land.shore(W / 2, H + 4) < 0, 'the sea beyond the coast is land')
  })
  it('leaves rooms and dungeons level, their water on its tile edges', () => {
    for (const kind of ['interior', 'dungeon']) {
      const land = M.buildLand(source({ kind, beyond: 0 }), LOOK)
      for (const [x, y] of samples(0.25)) {
        if (tileAt(x, y) !== '~') near(land.height(x, y), 0)
        assert.equal(land.shore(x, y) < 0, tileAt(x, y) === '~')
      }
    }
  })
  it('is nothing at the classic end of the turn', () => {
    const land = M.buildLand(source(), LOOK)
    for (const [x, y] of samples(0.5)) {
      assert.equal(M.lift(land, x, y, 0), 0)
      near(M.lift(land, x, y, 1), land.height(x, y))
    }
    const [x, y] = [10.3, 10.6]
    assert.ok(M.lift(land, x, y, 0.5) >= 0 && M.lift(land, x, y, 0.5) <= land.height(x, y) + 1e-9)
  })
  it('builds the real maps', () => {
    for (const id of ['overworld', 'wildwood']) {
      const m = M.mapInfo(M.WORLD, id)
      const { w, h, base } = m
      const at = (x, y) => M.beyondTile(base, w, h, Math.floor(x), Math.floor(y))
      const land = M.buildLand({ w, h, kind: m.def.kind, at, beyond: M.BEYOND, seed: 1 }, LOOK)
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const t = base[y * w + x]
        const wet = land.shore(x + 0.5, y + 0.5) < 0
        assert.equal(wet, t === '~', `${id}: the middle of ${x}, ${y}`)
        if (!wet && M.levelOf(t) === 0) near(land.height(x + 0.5, y + 0.5), 0)
      }
    }
  })
})

describe('the polygon view in the bundle', () => {
  it('is fetched on the turn to it: nothing imports it statically', () => {
    const view = join(root, 'render/poly/view.ts')
    if (!existsSync(view)) return // not built yet
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])
    const files = [...walk(root), ...walk(resolve(root, '../portal')), ...walk(resolve(root, '../stage'))].filter(f => /\.(ts|vue)$/.test(f) && !f.includes('/render/poly/'))
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      assert.ok(!/from\s+['"][^'"]*poly\/view['"]/.test(src), `${f} imports the polygon view statically`)
    }
  })
})
