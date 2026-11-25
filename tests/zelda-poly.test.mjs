// Neon Shrine's polygon view: the camera rig and the land. Pure modules,
// bundled with esbuild like the other zelda tests. These tests are the
// contract the view is built on (`render/poly/camera.ts`, `terrain.ts`).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { gunzipSync } from 'node:zlib'
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
        `export { Mesher, Verts, roomCut, polyShape, KERB, STRIDE, AT, TEX } from './render/poly/mesh'`,
        `export { rig, boneMatrices, JOINTS, parseHero, heroVerts, poseHero, skinHero } from './render/poly/hero'`,
        `export { HSTRIDE } from './render/poly/mesh'`,
        `export { solvePose } from './render/iso/figure'`,
        `export { createLampKeeper, LAMP_CAP } from './render/poly/lamps'`,
        `export { holdLight, HOLD_TAU, HOLD_JUMP, easeLook, toAlbedo, ALBEDO, PAINTED_TUNE, LADDER, createGovernor } from './render/poly/view'`,
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
    // (Along the crane's own heading, north-west, and a step across it.)
    const { r, f: fw } = M.poseAxes(M.CRANE)
    const at = (d) => ({ x: f.x + fw[0] * d, y: f.y + fw[1] * d })
    const span = (d) => { const p = at(d); const a = M.toScreen(m, VW, VH, p.x, p.y, 0), b = M.toScreen(m, VW, VH, p.x + r[0], p.y + r[1], 0); return Math.hypot(b.x - a.x, b.y - a.y) }
    assert.ok(span(6) < span(0) && span(0) < span(-2))
    assert.ok(M.toScreen(m, VW, VH, at(6).x, at(6).y, 0).depth > M.toScreen(m, VW, VH, f.x, f.y, 0).depth)
    assert.ok(M.toScreen(m, VW, VH, f.x, f.y, 0).w > 0)
  })
  it('shows a horizon from the shoulder, none from the crane (it looks down as the 16-bit look does), none in the classic picture', () => {
    const f = { x: 20, y: 30, z: 0 }
    const crane = M.horizonY(M.poseMatrix(M.CRANE, VW, VH, f), VW, VH)
    const shoulder = M.horizonY(M.poseMatrix(M.SHOULDER, VW, VH, f), VW, VH)
    assert.ok(crane < 0, `the crane's horizon is in the picture, at ${crane}`)
    assert.ok(shoulder > 0 && shoulder < 0.5 * VH, `the shoulder's horizon is at ${shoulder}`)
    assert.equal(M.horizonY(M.classicMatrix(VW, VH, 0, 0), VW, VH), Infinity)
  })
  it('sees ground and not sky on a screen taller than wide: the crane as it is, the shoulder looking further down', () => {
    const f = { x: 20, y: 30, z: 0 }
    const [w, h] = [130, 282]
    assert.ok(M.horizonY(M.poseMatrix(M.CRANE, w, h, f), w, h) < 0, 'the crane shows sky on a phone')
    assert.deepEqual(M.fitPose(M.SHOULDER, VW, VH), M.SHOULDER)
    const fitted = M.fitPose(M.SHOULDER, w, h)
    assert.ok(fitted.pitch > M.SHOULDER.pitch)
  })
  it('looks the 16-bit look\'s way from the crane: north-west, about 30° down, a long lens', () => {
    near(M.CRANE.yaw, -Math.PI / 4, 1e-9)
    assert.ok(M.CRANE.pitch >= 30 * Math.PI / 180 && M.CRANE.pitch <= 36 * Math.PI / 180)
    assert.ok(M.CRANE.fov <= 30 * Math.PI / 180)
    // A tile `zoom` times the 16-bit one: the distance is what makes its diamond that tall.
    const d = M.craneDist(M.CRANE, VW, VH, 22.4)
    const m = M.poseMatrix({ ...M.CRANE, dist: d }, VW, VH, { x: 20, y: 30, z: 0 })
    const a = M.toScreen(m, VW, VH, 20, 30, 0), b = M.toScreen(m, VW, VH, 19.5, 29.5, 0), c = M.toScreen(m, VW, VH, 20.5, 30.5, 0)
    near(c.y - b.y, 22.4, 1.5)
    void a
  })
  it('finds the ground under a pixel, and none over the horizon', () => {
    const f = { x: 20, y: 30, z: 0 }
    const m = M.poseMatrix(M.CRANE, VW, VH, f)
    for (const [x, y, z] of [[20, 30, 0], [17.5, 26, 0], [23, 31, 0.5]]) {
      const p = M.toScreen(m, VW, VH, x, y, z)
      const g = M.toGround(m, VW, VH, p.x, p.y, z)
      near(g.x, x, 1e-3); near(g.y, y, 1e-3)
    }
    const sh = M.poseMatrix(M.SHOULDER, VW, VH, f)
    assert.equal(M.toGround(sh, VW, VH, VW / 2, 0, 0), null)
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
  it('goes on beyond the map without a step, level toward the horizon (part 14: it no longer rises)', () => {
    const land = M.buildLand(source(), LOOK)
    for (let y = 0.3; y < 14; y += 0.7) {
      assert.ok(Math.abs(land.height(-0.05, y) - land.height(0.05, y)) < 0.08, `a step at the west edge, y ${y}`)
      assert.ok(Number.isFinite(land.height(-6, y)))
    }
    let far = 0
    for (let x = 0.5; x < W; x += 1) far = Math.max(far, land.height(x, -5.5))
    assert.ok(far < 0.3, `the land five tiles north of the map rises to ${far}`)
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
  it('stands what is placed on the land, and never under the water', () => {
    const land = M.buildLand(source(), LOOK)
    for (const [x, y] of samples(0.5)) {
      assert.equal(M.stand(land, x, y, 0), 0)
      const k = 1
      if (land.height(x, y) >= land.waterLevel) near(M.stand(land, x, y, k), M.lift(land, x, y, k))
      else near(M.stand(land, x, y, k), land.waterLevel)
      assert.ok(M.stand(land, x, y, 0.5) >= M.lift(land, x, y, 0.5) - 1e-9)
    }
    // The middle of the pond: the surface, through the turn the same way as the land.
    const mid = M.stand(land, 5, 4, 0.5)
    assert.ok(mid < 0 && mid > land.waterLevel)
  })
  it('says where the drawn surface needs its fine lattice, and is the coarse one elsewhere', () => {
    const land = M.buildLand(source(), LOOK)
    assert.equal(land.step(4, 3), land.res, 'the pond is drawn coarse')
    const coarse = land.step(20, 12)
    assert.ok(coarse < land.res && land.res % coarse === 0)
    // In a coarse tile every fine point lies on the coarse triangles: a mesh of coarse cells has no crack.
    const s = 1 / coarse
    for (const [cx, cy] of [[20, 12], [20.5, 12.5], [21, 10]]) {
      if (land.step(Math.floor(cx), Math.floor(cy)) !== coarse) continue
      const nw = land.height(cx, cy), ne = land.height(cx + s, cy), sw = land.height(cx, cy + s), se = land.height(cx + s, cy + s)
      near(land.height(cx + s / 2, cy), (nw + ne) / 2, 1e-5)
      near(land.height(cx, cy + s / 2), (nw + sw) / 2, 1e-5)
      near(land.height(cx + s / 2, cy + s / 2), (nw + se) / 2, 1e-5)
    }
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

// ------------------------------------------------------------------- mesher

/** The mesher's field for a map of rows (indoors or out), on a land built from the same rows. */
function fieldOf(rows, kind, land) {
  const w = rows[0].length, h = rows.length
  const tile = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? (kind === 'overworld' ? '.' : '#') : rows[y][x])
  return {
    kind, w, h, tile, land,
    own: () => false, raised: () => false, chest: () => 'chest', signExit: () => false, mood: () => 0, pool: () => false,
    hash: (x, y, s) => ((Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453) % 1 + 1) % 1,
  }
}
/** Every vertex of a build, as objects. */
function vertsOf(v) {
  const out = []
  for (let i = 0; i < v.n; i++) {
    const o = i * M.STRIDE
    const d = v.data
    out.push({ x: d[o], y: d[o + 1], z: d[o + 2], g: d[o + 3], n: [d[o + 4], d[o + 5], d[o + 6]], tex: d[o + 9], zk: d[o + 16] })
  }
  return out
}

describe('the mesher', () => {
  it('lays the ground on the land, two flat triangles to a cell', () => {
    const land = M.buildLand(source(), LOOK)
    const me = new M.Mesher(fieldOf(ROWS, 'overworld', land), { pitch: 0.4, room: null, sun: null, props: true })
    const v = me.build({ x: 0, y: 0, w: 12, h: 12 }, new M.Verts())
    const all = vertsOf(v)
    const ground = all.filter(p => p.tex === M.TEX.GROUND)
    let cells = 0
    for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) cells += land.step(x, y) ** 2
    assert.equal(ground.length, cells * 6)
    for (const p of ground) { assert.equal(p.z, 0); near(p.g, land.height(p.x, p.y), 1e-5) }
    // One normal to a triangle, so the light shows its facets.
    for (let i = 0; i < all.length; i += 3) for (let j = 1; j < 3; j++) assert.deepEqual(all[i + j].n, all[i].n)
  })
  it('stands a house with its roof rising toward the back, and nothing of the roof at the classic end', () => {
    const land = M.buildLand(source(), { hills: 0, shore: 0, far: 0 })
    const me = new M.Mesher(fieldOf(ROWS, 'overworld', land), { pitch: 0.4, room: null, sun: null, props: true })
    const v = vertsOf(me.build({ x: 14, y: 1, w: 5, h: 6 }, new M.Verts()))
    const roof = v.filter(p => p.zk > 0)
    assert.ok(roof.length > 0, 'no roof rises')
    // The pitch is the part only the finished view has: at k = 0 the roof lies at the eaves, where the classic art has it.
    for (const p of roof) assert.ok(p.z <= 2 + 1e-9)
  })
  it('cuts a room\'s south wall down to a kerb, and keeps its other walls', () => {
    const room = { x: 0, y: 0, w: 10, h: 8 }
    assert.equal(M.roomCut(room, 7), M.KERB)
    assert.equal(M.roomCut(room, 6), M.KERB)
    assert.equal(M.roomCut(room, 5), 1)
    assert.equal(M.roomCut(null, 7), 1)
    const rows = [
      '##########',
      '##########',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '##########',
      '##########',
    ]
    const land = M.buildLand({ w: 10, h: 8, kind: 'dungeon', at: (x, y) => rows[Math.floor(y)]?.[Math.floor(x)] ?? '#', beyond: 0, seed: 1 }, LOOK)
    const me = new M.Mesher(fieldOf(rows, 'dungeon', land), { pitch: 0, room, sun: null, props: true })
    const v = vertsOf(me.build(room, new M.Verts()))
    const walls = v.filter(p => p.tex === M.TEX.OBJS)
    const top = (f) => Math.max(...walls.filter(f).map(p => p.z))
    assert.ok(top(p => p.y >= 6.5) <= M.KERB + 1e-6, 'the south wall stands taller than a kerb')
    assert.ok(top(p => p.y <= 2.5) >= 1 - 1e-6, 'the north wall is cut down')
    // The east wall stands: this camera looks at it (the 16-bit view lays a wall with floor to its west down).
    assert.ok(top(p => p.x >= 9 && p.y > 2.5 && p.y < 5.5) >= 1 - 1e-6, 'the east wall is laid down')
    assert.equal(M.polyShape('#', 'dungeon', (dx, dy) => rows[3 + dy]?.[9 + dx] ?? '#', false, false).k, 'top')
  })
})

describe('resolution by generation', () => {
  it('draws at a whole number of device px a picture px, as fine as asked, never under 2', () => {
    for (const scale of [2, 3, 4, 5, 6, 8, 10]) for (const want of ['2', '3', '4', 'screen']) {
      const d = M.densityOf(want, scale)
      assert.ok(Number.isInteger(scale / d) || d === scale, `scale ${scale}, ${want}: ${d}`)
      assert.ok(d >= Math.min(2, scale), `under 2 at scale ${scale}`)
      if (want === 'screen') assert.equal(d, scale)
      // (No finer than asked, unless the only whole steps of 2 or more are finer: then the coarsest of them.)
      else assert.ok(d <= Math.max(+want + 0.5, scale / Math.max(1, Math.floor(scale / 2))), `finer than asked at scale ${scale}: ${d}`)
    }
    // A device that cannot keep up gets fewer px first.
    assert.ok(M.densityOf('screen', 8, 0) < M.densityOf('screen', 8, 2))
  })
})

describe('the hero model', () => {
  /** A stick figure in the A-pose: a column of vertices up the middle and two arms out to the sides. */
  function stick() {
    const pts = []
    for (let i = 0; i <= 20; i++) pts.push([0, -0.44 + i * 0.044, 0])
    for (const side of [-1, 1]) for (let i = 0; i < 5; i++) pts.push([side * (0.2 + i * 0.025), -0.44 + 0.3 * 0.88, 0])
    const n = pts.length
    return { pos: Float32Array.from(pts.flat()), nrm: new Float32Array(n * 3), uv: new Float32Array(n * 2), idx: new Uint16Array(0), bone: new Uint8Array(n * 2), w: new Float32Array(n), lo: -0.44, hi: 0.44 }
  }
  it('is rigged by where its vertices lie: legs below the hip, the head above the neck, arms out at the sides', () => {
    const m = stick()
    M.rig(m)
    const first = i => m.bone[i * 2]
    assert.equal(first(0), 4, 'the soles are not a leg')
    assert.equal(first(20), 1, 'the crown is not the head')
    assert.equal(first(10), 0, 'the middle is not the torso')
    for (let i = 21; i < 26; i++) assert.equal(first(i), 2, 'the left arm')
    for (let i = 26; i < 31; i++) assert.equal(first(i), 3, 'the right arm')
    for (let i = 0; i < m.w.length; i++) assert.ok(m.w[i] >= 0.5 && m.w[i] <= 1)
  })
  it('stands as it was made at rest, and moves its feet when it walks', () => {
    const m = stick()
    M.rig(m)
    const rest = M.boneMatrices(m, M.solvePose({ yaw: 0, act: 'idle', t: 0 }))
    // At rest the legs and the torso are where they were (the arms hang a little differently: the figure's hands are its own).
    for (const b of [rest[0], rest[4], rest[5]]) { near(b[0], 1, 1e-6); near(b[5], 1, 1e-6); near(b[10], 1, 1e-6); near(b[3], 0, 1e-6); near(b[11], 0, 1e-6) }
    const step = M.boneMatrices(m, M.solvePose({ yaw: 0, act: 'walk', t: 0.25 }))
    // Mid-stride one leg swings forward and the other back: their rotations differ.
    assert.ok(Math.abs(step[4][6] - step[5][6]) > 0.05, 'the legs do not swing')
  })
  it('is skinned on the GPU exactly where the CPU skin puts it (the shader\'s sums, in JS), for the real meshes', () => {
    // The vertex shader's skinning (engine.ts, skinned()): two bones by weight, then model to world by the facing.
    const shaderSkin = (hf, d, o) => {
      const B = hf.bones
      const at = (b, x, y, z) => [0, 1, 2].map(r => B[b * 12 + r * 4] * x + B[b * 12 + r * 4 + 1] * y + B[b * 12 + r * 4 + 2] * z + B[b * 12 + r * 4 + 3])
      const w = d[o + M.HSTRIDE - 1]
      const a = at(d[o + M.HSTRIDE - 3], d[o], d[o + 1], d[o + 2]), b = at(d[o + M.HSTRIDE - 2], d[o], d[o + 1], d[o + 2])
      const m = a.map((v, i) => w * v + (1 - w) * b[i])
      const [fx, fy] = hf.face, rx = -fy, ry = fx
      return [hf.place[0] + hf.place[2] * (m[0] * rx - m[2] * fx), hf.place[1] + hf.place[2] * (m[0] * ry - m[2] * fy), hf.place[2] * (m[1] - hf.place[3])]
    }
    for (const which of ['32', '64']) {
      const buf = gunzipSync(readFileSync(join(root, '../../public/zelda/poly/hero-' + which + '.bin')))
      const mesh = M.parseHero(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
      const d = M.heroVerts(mesh)
      assert.equal(d.length / M.HSTRIDE, mesh.idx.length)
      for (const pose of [{ yaw: 0.3, act: 'idle', t: 0 }, { yaw: 2, act: 'walk', t: 0.4 }, { yaw: -1, act: 'attack', t: 0.1, blade: { reach: 1, kind: 'arc' } }]) {
        const P = M.solvePose(pose)
        const at = { x: 12.3, y: 7.9, g: 0.4, yaw: P.yaw, scale: 0.95 / (mesh.hi - mesh.lo) }
        const hf = M.poseHero(mesh, P, at)
        const v = { n: 0, data: new Float32Array(0), reserve(k) { if (this.data.length < (this.n + k) * 20) { const nd = new Float32Array((this.n + k) * 20); nd.set(this.data); this.data = nd } } }
        M.skinHero(v, mesh, P, at)
        let worst = 0
        for (let c = 0; c < v.n; c += 7) {
          const g = shaderSkin(hf, d, c * M.HSTRIDE)
          for (let k = 0; k < 3; k++) worst = Math.max(worst, Math.abs(g[k] - v.data[c * 20 + k]))
        }
        assert.ok(worst < 1e-4, `${which} ${pose.act}: a corner is ${worst} tiles off`)
      }
    }
  })
})

describe('the lamps', () => {
  // The lights the painters gather flicker with the clock; this view lights every corner with them and rounds the
  // colour to 15 bits with a dither, so a lamp that changes from one frame to the next makes everything it lights
  // crawl (the flashing of 2026-11-23). The lamps it lights with must not change by more than a small part of a
  // 15-bit step (1/31) from one frame to the next, whatever the painters' lights do.
  const STEP = 1 / 31
  const strength = (lamps, x) => { const l = lamps.find(q => Math.abs(q.x - x) < 1e-9); return l ? l.c[0] : 0 }
  const run = (lightsAt, frames, focusAt = () => ({ x: 0, y: 0 })) => {
    const keep = M.createLampKeeper()
    const out = []
    for (let i = 0; i < frames; i++) out.push(keep(lightsAt(i / 60), 1 / 60, focusAt(i), 1, () => 0.5))
    return out
  }

  it('a torch, a laser gate and a zapper flicker with the clock; the light they give does not', () => {
    const lights = t => [
      { x: 2.5, y: 3, r: 4.2, color: '#ffffff', a: 0.85 * (0.85 + 0.15 * Math.sin(t * 9 + 2.5 * 3.1 + 3)) },
      { x: 6.5, y: 3, r: 2, color: '#ffffff', a: 0.75 + 0.25 * Math.sin(t * 12 + 6) },
      { x: 9.5, y: 3, r: 2, color: '#ffffff', a: 0.5 + 0.3 * Math.sin(t * 15) },
    ]
    const frames = run(lights, 600)
    for (const [x, mean] of [[2.5, 0.85 * 0.85], [6.5, 0.75], [9.5, 0.5]]) {
      let raw = 0
      let held = 0
      for (let i = 61; i < frames.length; i++) {
        raw = Math.max(raw, Math.abs(lights(i / 60).find(l => l.x === x).a - lights((i - 1) / 60).find(l => l.x === x).a))
        held = Math.max(held, Math.abs(strength(frames[i], x) - strength(frames[i - 1], x)))
      }
      assert.ok(raw > 0.3 * STEP, `the painters' lamp at ${x} flickers (${raw})`)
      assert.ok(held < 0.1 * STEP, `the lamp at ${x} changes by ${held} a frame: a dither step is ${STEP}`)
      near(strength(frames.at(-1), x), mean, 0.05)
    }
  })

  it('a lamp that walks keeps its strength, and one that stands still and steady is the same every frame', () => {
    const frames = run(t => [
      { x: 1 + t * 3, y: 2, r: 2, color: '#b6ff4a', a: 0.5 + 0.3 * Math.sin(t * 15) },
      { x: 5, y: 5, r: 3, color: '#ffd23f', a: 0.8 },
    ], 300)
    for (let i = 61; i < frames.length; i++) {
      const a = frames[i].find(l => l.y === 2).c[0]
      const b = frames[i - 1].find(l => l.y === 2).c[0]
      assert.ok(Math.abs(a - b) < 0.1 * STEP, `the walking lamp jumps by ${Math.abs(a - b)}`)
      assert.equal(frames[i].find(l => l.y === 5).c[1], frames[i - 1].find(l => l.y === 5).c[1])
    }
  })

  it('of more lamps than the engine lights, none comes or goes at full strength as the hero walks past them', () => {
    const row = Array.from({ length: 40 }, (_, i) => ({ x: i + 0.5, y: 0, r: 3, color: '#ffffff', a: 0.8 }))
    const frames = run(() => row, 800, i => ({ x: i * 0.05, y: 1 }))
    let jump = 0
    for (let i = 1; i < frames.length; i++) {
      assert.ok(frames[i].length <= M.LAMP_CAP)
      for (const l of row) jump = Math.max(jump, Math.abs(strength(frames[i], l.x) - strength(frames[i - 1], l.x)))
    }
    assert.ok(jump < 0.08, `a lamp's light jumps by ${jump} between two frames`)
    // (And the nearest keep their whole light.)
    near(strength(frames[400], 20.5), 0.8, 1e-9)
  })

  it('standing still, the lamps are the sixteen nearest at full strength (the look as it was)', () => {
    const row = Array.from({ length: 40 }, (_, i) => ({ x: i * 0.7, y: (i * 7) % 5, r: 3, color: '#ffffff', a: 0.6 }))
    const frames = run(() => row, 120, () => ({ x: 9, y: 2 }))
    const want = [...row].sort((a, b) => Math.hypot(a.x - 9, a.y - 2) - Math.hypot(b.x - 9, b.y - 2)).slice(0, M.LAMP_CAP)
    for (const f of [frames[0], frames.at(-1)]) {
      assert.deepEqual(f.map(l => `${l.x},${l.y}`).sort(), want.map(l => `${l.x},${l.y}`).sort())
      for (const l of f) near(l.c[0], 0.6, 1e-9)
    }
  })

  it('holds everything while the clock stands (a pause)', () => {
    const keep = M.createLampKeeper()
    const L = [{ x: 1, y: 1, r: 2, color: '#ff8a3d', a: 0.9 }]
    keep(L, 1 / 60, { x: 0, y: 0 }, 1, () => 0)
    const a = keep([{ ...L[0], a: 0.2 }], 0, { x: 0, y: 0 }, 1, () => 0)
    near(a[0].c[0], 0.9, 1e-9)
  })
})


describe('the light held smooth', () => {
  // The hour's light comes in steps of a tenth of a second; drawn as it comes, each step moves the dither over
  // everything it lights at once (the solved game's flicker). The view holds each light value smooth.
  it('follows a small step over frames, never at once, and settles on it', () => {
    let v = [0.5, 0.4, 0.3]
    const to = [0.52, 0.42, 0.31]
    const seen = []
    for (let i = 0; i < 240; i++) { v = M.holdLight(v, to, 1 / 60); seen.push(v[0]) }
    // (No frame moves more than a part of the step: 1/60 s of a 0.4 s time constant is about 4 %.)
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i] - seen[i - 1] <= 0.02 * 0.05 + 1e-12, `frame ${i} moved ${seen[i] - seen[i - 1]}`)
    near(seen[0], 0.5 + 0.02 * (1 - Math.exp(-1 / 60 / M.HOLD_TAU)), 1e-9)
    near(seen.at(-1), 0.52, 1e-4)
    // (Monotone: the held light never overshoots the hour's.)
    for (let i = 1; i < seen.length; i++) assert.ok(seen[i] >= seen[i - 1] && seen[i] <= 0.52 + 1e-12)
  })
  it('takes a jump at once: a map, a door, a setting', () => {
    const v = M.holdLight([0.5, 0.4, 0.3], [0.5 + M.HOLD_JUMP + 0.01, 0.4, 0.3], 1 / 60)
    assert.deepEqual(v, [0.5 + M.HOLD_JUMP + 0.01, 0.4, 0.3])
    assert.deepEqual(M.holdLight(null, [0.1, 0.2, 0.3], 1 / 60), [0.1, 0.2, 0.3])
  })
  it('does not run ahead on a long frame', () => {
    // (A frame of a whole second counts as a tenth: a hitch does not jump the light.)
    const a = M.holdLight([0, 0, 0], [0.05, 0, 0], 1)
    near(a[0], 0.05 * (1 - Math.exp(-0.1 / M.HOLD_TAU)), 1e-9)
  })
})

describe('the change between the two looks', () => {
  const from = { filter: 0, fog: 0.3, drawDistance: 40, pose: 'crane', colors: '15-bit', smoothEdges: false }
  const to = { filter: 1, fog: 1, drawDistance: 30, pose: 'shoulder', colors: 'full', smoothEdges: true }
  it('mixes every number by the ease, and ends exactly on the new look', () => {
    const half = M.easeLook(from, to, 0.25)
    near(half.filter, 0.25); near(half.fog, 0.3 + 0.7 * 0.25); near(half.drawDistance, 37.5)
    assert.deepEqual(M.easeLook(from, to, 1), to)
    assert.deepEqual(M.easeLook(from, to, 0), from)
  })
  it('changes a switch once, in the middle, under the camera\'s move', () => {
    for (const e of [0, 0.2, 0.49]) assert.equal(M.easeLook(from, to, e).pose, 'crane')
    for (const e of [0.5, 0.8, 1]) assert.equal(M.easeLook(from, to, e).pose, 'shoulder')
    assert.equal(M.easeLook(from, to, 0.3).smoothEdges, false)
    assert.equal(M.easeLook(from, to, 0.7).colors, 'full')
  })
  it('is continuous: no number moves by more than its share of the ease between two frames', () => {
    let last = M.easeLook(from, to, 0)
    for (let i = 1; i <= 60; i++) {
      const e = i / 60
      const now = M.easeLook(from, to, e)
      for (const k of ['filter', 'fog', 'drawDistance']) assert.ok(Math.abs(now[k] - last[k]) <= Math.abs(to[k] - from[k]) / 60 + 1e-9)
      last = now
    }
  })
})

describe('the painted page\'s light', () => {
  // A painted material is brought to the mean light of the 16-bit view's own (`ALBEDO`), so the ground is as bright in
  // every view: a gamma per material, solved for the mean, the hue kept.
  const page = (side, fill) => {
    const d = new Uint8ClampedArray(side * side * 2 * 4)
    for (let i = 0; i < side * side * 2; i++) { const [r, g, b] = fill(i % (side * 2), Math.floor(i / (side * 2))); d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255 }
    return d
  }
  const meanOf = (d, side, k) => {
    let sum = 0
    for (let y = 0; y < side; y++) for (let x = k * side; x < (k + 1) * side; x++) { const o = (y * side * 2 + x) * 4; sum += (d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11) / 255 }
    return sum / side / side
  }
  it('brings a dark painting to its target mean, and leaves the next material alone', () => {
    const side = 16
    const d = page(side, (x, y) => x < side ? [40 + (x * 7) % 50, 30 + (y * 5) % 40, 60 + ((x + y) * 3) % 60] : [200, 10, 10])
    const before = meanOf(d, side, 1)
    M.toAlbedo(d, side * 2, side, 0, M.ALBEDO.cobbles, 1)
    near(meanOf(d, side, 0), M.ALBEDO.cobbles, 0.01)
    near(meanOf(d, side, 1), before, 1e-9)
  })
  it('keeps each texel\'s hue, and the order of light and dark', () => {
    const side = 8
    const d = page(side, (x, y) => [20 + x * 9, 10 + y * 6, 70 + x * 4])
    const hue = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx === mn) return 0; const h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn); return ((h * 60) + 360) % 360 }
    const was = [], lum = []
    for (let i = 0; i < side; i++) { const o = (i * side * 2 + i) * 4; was.push(hue(d[o], d[o + 1], d[o + 2])); lum.push(d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11) }
    M.toAlbedo(d, side * 2, side, 0, 0.3, 1)
    for (let i = 0; i < side; i++) {
      const o = (i * side * 2 + i) * 4
      assert.ok(Math.abs(hue(d[o], d[o + 1], d[o + 2]) - was[i]) < 6, `texel ${i}: hue ${was[i]} became ${hue(d[o], d[o + 1], d[o + 2])}`)
      if (i) assert.ok(d[o] * 0.3 + d[o + 1] * 0.59 + d[o + 2] * 0.11 >= d[o - (side * 2 + 1) * 4] * 0.3 + d[o - (side * 2 + 1) * 4 + 1] * 0.59 + d[o - (side * 2 + 1) * 4 + 2] * 0.11 - 1)
    }
  })
  it('has a mean light and a tuning for every material, inside the 16-bit view\'s range', () => {
    const MATS = ['grass', 'cobbles', 'sand', 'flags', 'boards', 'moss', 'lane', 'shingles', 'siding', 'rockface', 'bricks', 'blocks', 'panel', 'slab', 'plates', 'steel']
    for (const m of MATS) {
      assert.ok(M.ALBEDO[m] > 0.08 && M.ALBEDO[m] < 0.7, `${m} ${M.ALBEDO[m]}`)
      const [gain, sat] = M.PAINTED_TUNE[m]
      assert.ok(gain > 0.5 && gain <= 1.2 && sat > 0.5 && sat <= 1.2, `${m} tune ${gain} ${sat}`)
    }
  })
})

describe('the governor', () => {
  // A device: the gap between its frames (ms) at each step of the ladder. Runs it for `ms` and returns each frame's step.
  const run = (gapAt, ms, gov = M.createGovernor()) => {
    const steps = []
    let t = 0
    while (t < ms) { const g = gapAt(gov.steps); t += g; steps.push([t, gov.tick(g, t)]) }
    return { steps, gov }
  }
  it('gives up the cheapest things first, and never takes one back further down', () => {
    const L = M.LADDER
    assert.equal(L[0].bloomPass, true); assert.equal(L[0].msaa, 4); assert.equal(L[0].model, true)
    for (let i = 1; i < L.length; i++) {
      assert.ok(L[i].msaa <= L[i - 1].msaa && L[i].far <= L[i - 1].far && L[i].densityDrop >= L[i - 1].densityDrop && L[i].halos <= L[i - 1].halos)
      for (const k of ['bloomPass', 'perPixel', 'heroHi', 'model']) assert.ok(!(L[i][k] && !L[i - 1][k]), `step ${i} takes back ${k}`)
      assert.ok(!(L[i - 1].coarse && !L[i].coarse))
      assert.notDeepEqual(L[i], L[i - 1], `step ${i} gives up nothing`)
    }
    assert.equal(L.at(-1).model, false, 'the last step does not give up the model')
  })
  it('acts on a slow device within a second, and goes on down within a few', () => {
    const { steps } = run(() => 33, 6000)
    const first = steps.find(([, s]) => s >= 1)
    assert.ok(first && first[0] < 1000, `first step at ${first?.[0]} ms`)
    const second = steps.find(([, s]) => s >= 2)
    assert.ok(second && second[0] < 3000, `second step at ${second?.[0]} ms`)
  })
  it('stays where the device keeps up, and never flaps', () => {
    // Slow at the top, comfortable one step down: it settles on step 1 and stays there for a minute.
    const { steps } = run(s => (s === 0 ? 24 : 12), 60000)
    const after = steps.filter(([t]) => t > 3000).map(([, s]) => s)
    assert.ok(after.every(s => s === 1), 'it moved after settling')
    // A device fast enough one step down to be tempted back up: it may try once, never more.
    const tempt = run(s => (s === 0 ? 24 : 6), 120000)
    let changes = 0
    for (let i = 1; i < tempt.steps.length; i++) if (tempt.steps[i][1] !== tempt.steps[i - 1][1]) changes++
    assert.ok(changes <= 3, `${changes} changes in two minutes`)
    assert.equal(tempt.steps.at(-1)[1], 1)
  })
  it('does not count a hidden tab, a pause or a new map', () => {
    const gov = M.createGovernor()
    let t = 0
    for (let i = 0; i < 100; i++) { t += 500; gov.tick(500, t) }
    for (let i = 0; i < 100; i++) { t += 40; gov.tick(40, t, true) }
    assert.equal(gov.steps, 0)
    gov.settle(t)
    for (let i = 0; i < 20; i++) { t += 40; gov.tick(40, t) }
    assert.equal(gov.steps, 0, 'it judged while a map was being built')
  })
})
