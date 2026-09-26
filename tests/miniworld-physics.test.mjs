// Mini World's character controller (themes/miniworld/scene/physics.ts):
// floors, jump height, step-up, no tunnelling on a slow phone, moving
// platforms, trampolines, kill bricks and the sea.
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
    entryPoints: [join(scene, 'physics.ts')],
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

const P = await load()
const still = { mx: 0, mz: 0, jump: false }

function run(w, b, intent, seconds, frameDt = 1 / 60, onStep) {
  const ev = P.createEvents()
  const acc = { t: 0 }
  const log = { jumped: 0, landed: 0, bounced: 0, killed: 0, fell: 0, water: 0, maxY: -Infinity }
  for (let t = 0; t < seconds; t += frameDt) {
    P.advance(w, b, intent, ev, frameDt, acc, e => {
      if (e.jumped) log.jumped++
      if (e.landed) log.landed++
      if (e.bounced) log.bounced++
      if (e.killed) log.killed++
      if (e.fell) log.fell++
      if (e.water) log.water++
      log.maxY = Math.max(log.maxY, b.y)
      onStep?.(e)
    })
  }
  return log
}

function flat() {
  const w = P.createWorld({ killY: -30 })
  P.addStatic(w, P.box(-50, -1, -50, 50, 0, 50))
  return w
}

test('falls onto the floor and stays on it', () => {
  const w = flat()
  const b = P.createBody(0, 5, 0)
  const log = run(w, b, still, 2)
  assert.ok(Math.abs(b.y) < 1e-6, `feet at ${b.y}`)
  assert.equal(b.onGround, true)
  assert.equal(log.landed, 1)
})

test('walks at about 8 u/s and turns quickly', () => {
  const w = flat()
  const b = P.createBody(0, 0, 0)
  run(w, b, { mx: 1, mz: 0, jump: false }, 1)
  assert.ok(b.x > 7 && b.x < 8.1, `x after 1 s: ${b.x}`)
  assert.ok(Math.abs(b.vx - 8) < 1e-6)
})

test('a jump rises 2.2 units', () => {
  const w = flat()
  const b = P.createBody(0, 0, 0)
  run(w, b, still, 0.2)
  P.pressJump(b)
  const log = run(w, b, still, 1.5)
  assert.equal(log.jumped, 1)
  assert.ok(Math.abs(log.maxY - 2.2) < 0.08, `apex ${log.maxY}`)
  assert.equal(b.onGround, true)
})

test('an early press is buffered, and a late one after walking off still jumps (coyote)', () => {
  const w = P.createWorld({ killY: -30 })
  P.addStatic(w, P.box(-10, -1, -2, 0, 0, 2))
  const b = P.createBody(-1, 0, 0)
  run(w, b, still, 0.1)
  // Walk off the edge, then press within the coyote window.
  const ev = P.createEvents(); const acc = { t: 0 }
  let jumped = false
  for (let i = 0; i < 120 && !jumped; i++) {
    P.advance(w, b, { mx: 1, mz: 0, jump: false }, ev, 1 / 120, acc, e => { if (e.jumped) jumped = true })
    if (!b.onGround && b.air > 0.05 && !jumped) P.pressJump(b)
  }
  assert.ok(jumped, 'coyote jump')
  // Buffered: press 0.1 s before landing.
  const w2 = flat()
  const b2 = P.createBody(0, 1.2, 0)
  run(w2, b2, still, 0.12)
  P.pressJump(b2)
  const log = run(w2, b2, still, 0.2)
  assert.equal(log.jumped, 1)
})

test('steps up a 0.5 ledge without jumping, but not a 1.0 wall', () => {
  const w = flat()
  P.addStatic(w, P.box(2, 0, -3, 6, 0.5, 3))
  P.addStatic(w, P.box(10, 0, -3, 12, 1.0, 3))
  const b = P.createBody(0, 0, 0)
  run(w, b, { mx: 1, mz: 0, jump: false }, 0.6)
  assert.ok(Math.abs(b.y - 0.5) < 1e-6, `on the ledge: y ${b.y}`)
  run(w, b, { mx: 1, mz: 0, jump: false }, 2)
  assert.ok(b.x < 10 - b.hw + 0.01, `stopped at the wall: x ${b.x}`)
  assert.ok(b.y < 0.01, `back down on the floor: y ${b.y}`)
})

test('no tunnelling at 20 fps: a long fall onto a thin floor, and a fast run into a thin wall', () => {
  const w = P.createWorld({ killY: -100 })
  P.addStatic(w, P.box(-5, -0.3, -5, 5, 0, 5))
  const b = P.createBody(0, 60, 0)
  run(w, b, still, 4, 1 / 20)
  assert.ok(Math.abs(b.y) < 1e-6, `landed on the 0.3 floor: y ${b.y}`)
  const w2 = flat()
  P.addStatic(w2, P.box(3, 0, -5, 3.2, 4, 5))
  const b2 = P.createBody(0, 0, 0)
  b2.speed = 3
  run(w2, b2, { mx: 1, mz: 0, jump: false }, 2, 1 / 20)
  assert.ok(b2.x < 3, `stayed in front of the 0.2 wall: x ${b2.x}`)
})

test('a very long frame is capped, not simulated as one step', () => {
  const w = flat()
  const b = P.createBody(0, 0, 0)
  const ev = P.createEvents()
  const n = P.advance(w, b, still, ev, 2, { t: 0 })
  assert.equal(n, P.PHYS.maxSteps)
})

test('a moving platform carries the player', () => {
  const w = P.createWorld({ killY: -30 })
  const plat = P.box(-2, -0.5, -2, 2, 0, 2)
  P.addMover(w, P.mover(plat, 6, 0, 0, 4))
  const b = P.createBody(0, 0, 0)
  let maxX = -Infinity, minX = Infinity
  run(w, b, still, 4, 1 / 30, () => { maxX = Math.max(maxX, b.x); minX = Math.min(minX, b.x) })
  assert.equal(b.onGround, true, 'still on the platform')
  assert.ok(maxX > 5 && minX < -5, `carried both ways: ${minX}..${maxX}`)
  const cx = (plat.minX + plat.maxX) / 2
  assert.ok(Math.abs(b.x - cx) < 0.3, `kept its place on the platform: ${b.x} vs ${cx}`)
  // A lift: up and down.
  const w2 = P.createWorld({ killY: -30 })
  const lift = P.box(-2, -0.5, -2, 2, 0, 2)
  P.addMover(w2, P.mover(lift, 0, 4, 0, 3))
  const b2 = P.createBody(0, 0.2, 0)
  let top = -Infinity
  run(w2, b2, still, 3, 1 / 30, () => { top = Math.max(top, b2.y) })
  assert.ok(top > 3.5, `rode the lift up: ${top}`)
  assert.equal(b2.onGround, true)
})

test('a trampoline throws the player high', () => {
  const w = flat()
  const t = P.box(-2, 0, -2, 2, 0.4, 2, 'bounce')
  t.bounce = 24
  P.addStatic(w, t)
  const b = P.createBody(0, 3, 0)
  const log = run(w, b, still, 0.8)
  assert.ok(log.bounced >= 1)
  assert.ok(log.maxY > 6, `bounced to ${log.maxY}`)
})

test('kill bricks, spinners, falls and the sea are reported', () => {
  const w = flat()
  P.addStatic(w, P.box(2, -0.5, -1, 4, 0.1, 1, 'kill'))
  const b = P.createBody(0, 0, 0)
  let killed = false
  run(w, b, { mx: 1, mz: 0, jump: false }, 1, 1 / 60, e => { if (e.killed) killed = true })
  assert.ok(killed, 'kill brick')

  const w2 = flat()
  w2.spinners.push({ cx: 0, cz: 0, y0: 0, y1: 0.8, len: 4, half: 0.25, speed: 2, angle: 0 })
  const b2 = P.createBody(0, 0, 3)
  const log2 = run(w2, b2, still, 2)
  assert.ok(log2.killed > 0, 'spinner')
  // Jumping over the bar clears it.
  const w3 = flat()
  w3.spinners.push({ cx: 0, cz: 0, y0: 0, y1: 0.8, len: 4, half: 0.25, speed: 0, angle: 0 })
  const b3 = P.createBody(0, 0, -1.5)
  P.pressJump(b3)
  const log3 = run(w3, b3, { mx: 0, mz: 1, jump: false }, 0.5)
  assert.equal(log3.killed, 0, 'jumped the bar')

  const w4 = P.createWorld({ killY: -30 })
  P.addStatic(w4, P.box(-2, -1, -2, 2, 0, 2))
  const b4 = P.createBody(0, 0, 0)
  const log4 = run(w4, b4, { mx: 1, mz: 0, jump: false }, 3)
  assert.ok(log4.fell > 0, 'fell off')

  const w5 = P.createWorld({ killY: -30, waterY: -0.5 })
  P.addStatic(w5, P.box(-2, -1, -2, 2, 0, 2))
  const b5 = P.createBody(0, 0, 0)
  const log5 = run(w5, b5, { mx: 1, mz: 0, jump: false }, 1)
  assert.ok(log5.water > 0, 'into the sea')
})

test('walls stop the player, and corners do not trap them', () => {
  const w = flat()
  P.addStatic(w, P.box(3, 0, -10, 4, 5, 10))
  P.addStatic(w, P.box(-10, 0, 3, 3, 5, 4))
  const b = P.createBody(0, 0, 0)
  run(w, b, { mx: 0.7071, mz: 0.7071, jump: false }, 2)
  assert.ok(b.x <= 3 - b.hw + 1e-3 && b.z <= 3 - b.hw + 1e-3, `in the corner: ${b.x}, ${b.z}`)
  run(w, b, { mx: -1, mz: 0, jump: false }, 1)
  assert.ok(b.x < -5, `walked out again: ${b.x}`)
})

test('ledge assist: a jump that is a little short still lands on the top', () => {
  const w = flat()
  P.addStatic(w, P.box(3, 0, -3, 8, 2.6, 3))
  const b = P.createBody(-3, 0, 0)
  // Run up and jump 2.4 units before the wall: the apex passes before the wall.
  const ev = P.createEvents(); const acc = { t: 0 }
  while (b.x < 0.2) P.advance(w, b, { mx: 1, mz: 0, jump: false }, ev, 1 / 120, acc)
  P.pressJump(b)
  run(w, b, { mx: 1, mz: 0, jump: true }, 0.6)
  assert.ok(Math.abs(b.y - 2.6) < 1e-6, `on top of a 2.6 block (jump is 2.2): y ${b.y}`)
})

test('groundBelow and raycast', () => {
  const w = flat()
  P.addStatic(w, P.box(-1, 0, -1, 1, 2, 1))
  assert.equal(P.groundBelow(w, 0, 5, 0), 2)
  assert.equal(P.groundBelow(w, 3, 5, 0), 0)
  const d = P.raycast(w, -5, 1, 0, 1, 0, 0, 10)
  assert.ok(Math.abs(d - 4) < 1e-6, `hit at ${d}`)
  assert.equal(P.raycast(w, -5, 3, 0, 1, 0, 0, 10), 10)
})

test('jumpReach is sane', () => {
  const flatReach = P.jumpReach(0)
  assert.ok(flatReach > 5.5 && flatReach < 7, `flat reach ${flatReach}`)
  assert.ok(P.jumpReach(2) < P.jumpReach(0))
  assert.ok(P.jumpReach(-3) > P.jumpReach(0))
  assert.equal(P.jumpReach(3), 0)
})
