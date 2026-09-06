import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = ts.transpileModule(readFileSync(new URL('../themes/anotherworld/engine.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { createWorld, stepWorld, demoInput } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

const DT = 1 / 60
const idle = () => ({ left: false, right: false, jump: false })

test('world matches the contract: ~5000 wide, ground near y420, 3 beacons', () => {
  const w = createWorld()
  assert.ok(w.width >= 4500 && w.width <= 6000, `width ${w.width}`)
  assert.ok(w.platforms.length > 5)
  assert.ok(w.platforms.some((p) => p.y === 420 && p.w > 300))
  assert.equal(w.beacons.length, 3)
  assert.ok(w.beacons.every((b) => !b.lit))
  assert.equal(w.player.x, 80)
  assert.equal(w.player.y, 420)
  assert.equal(w.checkpoint, -1)
  assert.equal(w.won, false)
  assert.equal(w.deaths, 0)
})

test('jump leaves the ground and the run lands again', () => {
  const w = createWorld()
  for (let i = 0; i < 10; i++) stepWorld(w, { left: false, right: true, jump: false }, DT)
  const y0 = w.player.y
  stepWorld(w, { left: false, right: true, jump: true }, DT)
  assert.equal(w.player.grounded, false)
  assert.ok(w.player.vy < 0 || w.player.y < y0, 'rising after takeoff')
  let landed = false
  for (let i = 0; i < 180; i++) {
    stepWorld(w, { left: false, right: true, jump: false }, DT)
    if (w.player.grounded && i > 2) {
      landed = w.player.y <= 421
      if (landed) break
    }
  }
  assert.equal(landed, true, `never landed (y=${w.player.y})`)
})

test('jump buffering fires a late press on touchdown', () => {
  const w = createWorld()
  w.player.x = 200
  w.player.y = 405 // 15px above the flat, falling
  w.player.vx = 0
  w.player.vy = 0
  w.player.grounded = false
  stepWorld(w, { left: false, right: false, jump: true }, DT) // buffered mid-air
  let jumped = w.player.vy < 0 && !w.player.grounded
  for (let i = 0; i < 30 && !jumped; i++) {
    stepWorld(w, idle(), DT)
    jumped = w.player.vy < 0 && !w.player.grounded && w.player.y < 420
  }
  assert.equal(jumped, true, 'buffered jump never fired')
})

test('coyote time allows a jump just past a ledge', () => {
  const w = createWorld()
  w.player.x = 600 // 20px of flat left (ground ends at 620)
  w.player.y = 420
  w.player.vx = 0
  w.player.vy = 0
  let steps = 0
  while (w.player.grounded && steps < 40) {
    stepWorld(w, { left: false, right: true, jump: false }, DT)
    steps++
  }
  assert.equal(w.player.grounded, false, 'never ran off the edge')
  stepWorld(w, { left: false, right: true, jump: true }, DT)
  assert.ok(w.player.vy < 0, `coyote jump failed (vy=${w.player.vy})`)
})

test('hazard contact respawns at spawn, then at the latest beacon', () => {
  const w = createWorld()
  const hz = w.hazards[0]
  w.player.x = hz.x + hz.w / 2
  w.player.y = hz.y + hz.h
  w.player.vx = 0
  w.player.vy = 0
  stepWorld(w, idle(), DT)
  assert.equal(w.deaths, 1)
  assert.equal(w.player.x, 80)
  assert.equal(w.player.y, 420)

  // Touch the first beacon to make it the checkpoint.
  w.player.x = w.beacons[0].x
  w.player.y = w.beacons[0].y
  stepWorld(w, idle(), DT)
  assert.equal(w.beacons[0].lit, true)
  assert.equal(w.checkpoint, 0)

  const hz2 = w.hazards[1]
  w.player.x = hz2.x + hz2.w / 2
  w.player.y = hz2.y + hz2.h
  w.player.vx = 0
  w.player.vy = 0
  stepWorld(w, idle(), DT)
  assert.equal(w.deaths, 2)
  assert.equal(w.player.x, w.beacons[0].x)
  assert.equal(w.player.y, w.beacons[0].y)
})

test('falling into a gap respawns at the checkpoint', () => {
  const w = createWorld()
  w.player.x = 660 // over the first gap (620-700)
  w.player.y = 300
  w.player.vx = 0
  w.player.vy = 0
  w.player.grounded = false
  let respawned = false
  for (let i = 0; i < 300; i++) {
    stepWorld(w, idle(), DT)
    if (w.deaths === 1) {
      respawned = true
      break
    }
  }
  assert.equal(respawned, true, 'fall never respawned')
  assert.equal(w.player.x, 80)
  assert.equal(w.player.y, 420)
})

test('large dt is clamped: no tunnelling, no explosion', () => {
  const w = createWorld()
  for (let i = 0; i < 30; i++) stepWorld(w, idle(), DT)
  const t0 = w.time
  stepWorld(w, idle(), 5)
  assert.ok(w.time - t0 <= 0.101, `simulated ${w.time - t0}s for a 5s frame`)
  assert.ok(Math.abs(w.player.y - 420) < 5, `fell through (y=${w.player.y})`)
  assert.equal(w.player.grounded, true)
  assert.ok(Number.isFinite(w.player.x) && Number.isFinite(w.player.vy))
  const t1 = w.time
  stepWorld(w, idle(), -1)
  assert.equal(w.time, t1, 'negative dt must be a no-op')
})

test('same inputs give the same world (deterministic)', () => {
  const run = () => {
    const w = createWorld()
    for (let i = 0; i < 600; i++) stepWorld(w, demoInput(w), DT)
    return JSON.stringify(w)
  }
  assert.equal(run(), run())
})

test('demo autopilot traverses the whole course and finishes', () => {
  const w = createWorld()
  let steps = 0
  while (!w.won && steps < 15000) {
    stepWorld(w, demoInput(w), DT)
    steps++
  }
  assert.equal(w.won, true, `demo stuck (x=${Math.round(w.player.x)} steps=${steps} deaths=${w.deaths})`)
  assert.ok(w.beacons.every((b) => b.lit), 'not all beacons lit')
  assert.ok(w.time < 120, `too slow: ${w.time}s`)
  assert.ok(w.player.x > w.width - 300, `finish too far left (x=${w.player.x})`)
})

test('demo idles once won (caller restarts)', () => {
  const w = createWorld()
  let steps = 0
  while (!w.won && steps < 15000) {
    stepWorld(w, demoInput(w), DT)
    steps++
  }
  assert.equal(w.won, true)
  assert.deepEqual(demoInput(w), { left: false, right: false, jump: false })
})
