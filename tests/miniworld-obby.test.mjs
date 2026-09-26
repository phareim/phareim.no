// Obby-himmelen (themes/miniworld/scene/obby-course.ts): every jump on the
// three courses is makeable with the controller in physics.ts — checked
// against the analytic jump reach and by simulating the jump itself —
// checkpoints come in order, and the finish is reached by a chain of jumps.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const scene = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'miniworld', 'scene')

async function load() {
  const out = esbuild.buildSync({
    stdin: { contents: `export * from './physics'; export * from './obby-course'`, resolveDir: scene, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

const M = await load()
const LEVELS = ['easy', 'medium', 'hard']
/** Share of the controller's reach a jump may use: Lett is very forgiving. */
const FACTOR = { easy: 0.5, medium: 0.72, hard: 0.9 }
/** How early (units before the edge) the simulated player presses jump. */
const EARLY = { easy: 0.9, medium: 0.5, hard: 0.25 }

function boxAtTime(p, t) {
  const [ox, oy, oz] = M.moveOffset(p, t)
  return { minX: p.x - p.sx / 2 + ox, maxX: p.x + p.sx / 2 + ox, minZ: p.z - p.sz / 2 + oz, maxZ: p.z + p.sz / 2 + oz, top: p.y + oy, p }
}

function gapXZ(a, b) {
  const gx = Math.max(0, b.minX - a.maxX, a.minX - b.maxX)
  const gz = Math.max(0, b.minZ - a.maxZ, a.minZ - b.maxZ)
  return Math.hypot(gx, gz)
}

/** Best moment for a jump between two (maybe moving) platforms: the smallest gap. */
function bestTime(a, b) {
  if (!a.move && !b.move) return 0
  let best = 0, bg = Infinity
  for (let t = 0; t < 12; t += 0.02) {
    const A = boxAtTime(a, t), B = boxAtTime(b, t)
    const need = gapXZ(A, B) + Math.max(0, B.top - A.top) * 2
    if (need < bg) { bg = need; best = t }
  }
  return best
}

function reachFrom(a, dh) {
  if (a.kind === 'bounce') {
    const v = a.bounce, g = M.PHYS.gravity
    const disc = v * v - 2 * g * dh
    if (disc < 0) return 0
    return M.PHYS.walk * ((v + Math.sqrt(disc)) / g) + 2 * M.PHYS.halfWidth
  }
  return M.jumpReach(dh)
}

/** Simulate the jump: run from the middle of `a` toward `b`, jump `early` before the edge, steer to `b`. */
function simulate(A, B, early) {
  const w = M.createWorld({ killY: Math.min(A.top, B.top) - 30 })
  const mk = (X, kind) => {
    const bx = M.box(X.minX, X.top - 1, X.minZ, X.maxX, X.top, X.maxZ, kind)
    if (kind === 'bounce') bx.bounce = X.p.bounce
    return M.addStatic(w, bx)
  }
  const a = mk(A, A.p.kind === 'bounce' ? 'bounce' : 'solid')
  const b = mk(B, 'solid')
  const tx = (Math.max(B.minX, Math.min(B.maxX, (A.minX + A.maxX) / 2)) + (B.minX + B.maxX) / 2) / 2
  const tz = (Math.max(B.minZ, Math.min(B.maxZ, (A.minZ + A.maxZ) / 2)) + (B.minZ + B.maxZ) / 2) / 2
  // Start at the far side of A (a run-up), in line with the target.
  const cx = (A.minX + A.maxX) / 2, cz = (A.minZ + A.maxZ) / 2
  let dx = tx - cx, dz = tz - cz
  const l = Math.hypot(dx, dz) || 1
  dx /= l; dz /= l
  const hw = M.PHYS.halfWidth
  const clampX = x => Math.max(A.minX + hw, Math.min(A.maxX - hw, x))
  const clampZ = z => Math.max(A.minZ + hw, Math.min(A.maxZ - hw, z))
  const body = M.createBody(clampX(cx - dx * 3), A.p.kind === 'bounce' ? A.top + 0.5 : A.top, clampZ(cz - dz * 3))
  const ev = M.createEvents()
  let pressed = A.p.kind === 'bounce'
  for (let i = 0; i < 120 * 4; i++) {
    let mx = tx - body.x, mz = tz - body.z
    const ml = Math.hypot(mx, mz)
    if (ml < 0.2) { mx = 0; mz = 0 } else { mx /= ml; mz /= ml }
    if (!pressed && body.onGround && body.ground === a) {
      // Distance from the body's leading edge to A's edge along the run.
      const edge = Math.min(
        mx > 0.01 ? (A.maxX - (body.x + hw)) / mx : Infinity, mx < -0.01 ? ((body.x - hw) - A.minX) / -mx : Infinity,
        mz > 0.01 ? (A.maxZ - (body.z + hw)) / mz : Infinity, mz < -0.01 ? ((body.z - hw) - A.minZ) / -mz : Infinity,
      )
      if (edge <= early) { M.pressJump(body); pressed = true }
    }
    M.updateMovers(w, M.PHYS.dt)
    M.stepBody(w, body, { mx, mz, jump: true }, ev)
    if (pressed && body.onGround && body.ground === b) return true
    if (ev.fell) return false
  }
  return false
}

for (const level of LEVELS) {
  const c = M.obbyCourse(level)

  test(`${level}: the jumps form one chain from the start to the finish`, () => {
    assert.equal(c.plats[0].kind, 'start')
    assert.ok(c.finish > 0 && c.plats[c.finish].kind === 'finish')
    let at = 0
    for (const j of c.jumps) {
      assert.equal(j.from, at, `jump ${j.from}→${j.to} does not continue from ${at}`)
      assert.notEqual(c.plats[j.to].kind, 'kill')
      at = j.to
    }
    assert.equal(at, c.finish, 'the chain ends at the finish')
  })

  test(`${level}: checkpoints are in order along the course`, () => {
    const checks = c.plats.map((p, i) => ({ p, i })).filter(x => x.p.kind === 'check')
    const want = { easy: 3, medium: 4, hard: 5 }[level]
    assert.equal(checks.length, want)
    checks.forEach((x, k) => {
      assert.equal(x.p.check, k + 1)
      const cp = c.checkpoints[k + 1]
      assert.ok(Math.abs(cp.x - x.p.x) < 1e-9 && Math.abs(cp.z - x.p.z) < 1e-9, 'respawn spot on its platform')
    })
    for (let k = 1; k < checks.length; k++) assert.ok(checks[k].i > checks[k - 1].i)
    assert.ok(c.checkpoints.every(p => p.y > c.killY + 10), 'kill plane well below every checkpoint')
  })

  test(`${level}: every jump is within ${FACTOR[level] * 100}% of the controller's reach`, () => {
    for (const j of c.jumps) {
      const a = c.plats[j.from], b = c.plats[j.to]
      const t = bestTime(a, b)
      const A = boxAtTime(a, t), B = boxAtTime(b, t)
      const gap = gapXZ(A, B), dh = B.top - A.top
      const reach = reachFrom(a, dh)
      assert.ok(gap <= reach * FACTOR[level] + 1e-6, `${level} jump ${j.from}→${j.to}: gap ${gap.toFixed(2)} dh ${dh.toFixed(2)} reach ${reach.toFixed(2)}`)
      if (level === 'easy') assert.ok(gap <= 2.5 && dh <= 1 || a.kind === 'bounce', `easy jump ${j.from}→${j.to} is small`)
    }
  })

  test(`${level}: every jump lands when played (pressed ${EARLY[level]} before the edge)`, () => {
    for (const j of c.jumps) {
      const a = c.plats[j.from], b = c.plats[j.to]
      const t = bestTime(a, b)
      const ok = simulate(boxAtTime(a, t), boxAtTime(b, t), EARLY[level])
      assert.ok(ok, `${level} jump ${j.from}→${j.to} (${a.kind} → ${b.kind}) missed`)
    }
  })

  test(`${level}: spinner bars can be jumped, platforms are fair`, () => {
    for (const s of c.spinners) assert.ok(s.y1 - s.y0 <= M.PHYS.jumpHeight - 1.2, 'bar low enough to jump')
    const minWide = { easy: 3, medium: 2.4, hard: 1.4 }[level]
    for (const p of c.plats) if (p.kind !== 'kill') assert.ok(Math.min(p.sx, p.sz) >= minWide, `platform ${p.sx}×${p.sz} too narrow for ${level}`)
    if (level === 'easy') {
      assert.equal(c.spinners.length, 0)
      assert.ok(!c.plats.some(p => p.kind === 'kill' || p.move), 'no kill bricks or movers on Lett')
    } else {
      assert.ok(c.spinners.length > 0 && c.plats.some(p => p.kind === 'kill') && c.plats.some(p => p.move))
    }
  })
}

test('the courses grow harder', () => {
  const [e, m, h] = LEVELS.map(l => M.obbyCourse(l))
  assert.ok(e.jumps.length < m.jumps.length && m.jumps.length < h.jumps.length)
  const meanGap = c => {
    let s = 0
    for (const j of c.jumps) s += gapXZ(boxAtTime(c.plats[j.from], 0), boxAtTime(c.plats[j.to], 0))
    return s / c.jumps.length
  }
  assert.ok(meanGap(e) < meanGap(m) && meanGap(m) < meanGap(h))
})

test('the jump simulator is honest: it misses a jump that is too long', () => {
  const plat = (x, y, s) => ({ x, y, z: 0, sx: s, sz: s, sy: 1, kind: 'solid', color: '#fff' })
  const A = boxAtTime(plat(0, 0, 4), 0)
  assert.equal(simulate(A, boxAtTime(plat(4 + 3, 0, 4), 0), 0.25), true, '3 units flat')
  assert.equal(simulate(A, boxAtTime(plat(4 + 8, 0, 4), 0), 0.25), false, '8 units flat')
  assert.equal(simulate(A, boxAtTime(plat(4 + 2, 3.2, 4), 0), 0.25), false, '3.2 up')
})
