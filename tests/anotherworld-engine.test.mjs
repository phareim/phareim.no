import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = ts.transpileModule(readFileSync(new URL('../themes/anotherworld/engine.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText
const { createWorld, stepWorld, demoInput, tideLevel, tidePhase, DEATH_TIME } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

const DT = 1 / 60
const idle = () => ({ left: false, right: false, jump: false })
const right = () => ({ left: false, right: true, jump: false })

// Step until the vignette is over and the figure is back at a checkpoint.
function stepThroughDeath(w, t0 = w.time) {
  assert.ok(w.dying, 'expected a death vignette')
  for (let i = 0; i < 200 && w.dying; i++) stepWorld(w, idle(), DT)
  assert.equal(w.dying, null, 'vignette never ended')
  assert.ok(w.time - t0 >= DEATH_TIME - DT, `cut too early (${w.time - t0}s)`)
  assert.ok(w.time - t0 < DEATH_TIME + 3 * DT, `cut too late (${w.time - t0}s)`)
}

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
  assert.equal(w.dying, null)
  assert.equal(w.hazards[0].kind, 'tide')
  assert.equal(w.hazards[1].kind, 'rockfall')
})

test('jump leaves the ground and the run lands again', () => {
  const w = createWorld()
  for (let i = 0; i < 10; i++) stepWorld(w, right(), DT)
  const y0 = w.player.y
  stepWorld(w, { left: false, right: true, jump: true }, DT)
  assert.equal(w.player.grounded, false)
  assert.ok(w.player.vy < 0 || w.player.y < y0, 'rising after takeoff')
  let landed = false
  for (let i = 0; i < 180; i++) {
    stepWorld(w, right(), DT)
    if (w.player.grounded && i > 2) {
      landed = w.player.y <= 421
      if (landed) break
    }
  }
  assert.equal(landed, true, `never landed (y=${w.player.y})`)
})

test('a standing jump is a hop; a running jump is the long arc', () => {
  const stand = createWorld()
  stepWorld(stand, { left: false, right: false, jump: true }, DT)
  assert.equal(stand.player.hop, true)
  let apexStand = 420
  for (let i = 0; i < 120 && !stand.player.grounded; i++) {
    stepWorld(stand, { left: false, right: false, jump: true }, DT)
    apexStand = Math.min(apexStand, stand.player.y)
  }
  const run = createWorld()
  for (let i = 0; i < 20; i++) stepWorld(run, right(), DT)
  stepWorld(run, { left: false, right: true, jump: true }, DT)
  assert.equal(run.player.hop, false)
  let apexRun = 420
  for (let i = 0; i < 120 && !run.player.grounded; i++) {
    stepWorld(run, { left: false, right: true, jump: true }, DT)
    apexRun = Math.min(apexRun, run.player.y)
  }
  const hopH = 420 - apexStand
  const jumpH = 420 - apexRun
  assert.ok(hopH > 60 && hopH < 110, `hop height ${hopH}`)
  assert.ok(jumpH > 140, `jump height ${jumpH}`)
})

test('a hard landing crouches for 250 ms and ignores input meanwhile', () => {
  const w = createWorld()
  w.player.x = 300
  w.player.y = 150 // 270 px drop onto the flat
  w.player.grounded = false
  for (let i = 0; i < 120 && !w.player.grounded; i++) stepWorld(w, idle(), DT)
  assert.equal(w.player.grounded, true)
  assert.ok(w.player.crouch > 0.2, `crouch ${w.player.crouch}`)
  stepWorld(w, { left: false, right: true, jump: true }, DT)
  assert.equal(w.player.vx, 0, 'moved while crouching')
  assert.equal(w.player.grounded, true, 'jumped while crouching')
  for (let i = 0; i < 20; i++) stepWorld(w, right(), DT)
  assert.ok(w.player.vx > 0, 'control never returned')
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
    stepWorld(w, right(), DT)
    steps++
  }
  assert.equal(w.player.grounded, false, 'never ran off the edge')
  stepWorld(w, { left: false, right: true, jump: true }, DT)
  assert.ok(w.player.vy < 0, `coyote jump failed (vy=${w.player.vy})`)
})

test('the tide rises visibly before it kills, and only kills at full height', () => {
  const w = createWorld()
  const hz = w.hazards[0]
  // Find the start of a rise, then confirm a harmless window before lethal.
  let t = 0
  while (!(tideLevel(hz, t) === 0 && tideLevel(hz, t + DT) > 0)) t += DT
  t += DT
  const riseStart = t
  while (tideLevel(hz, t) < 0.999) t += DT
  assert.ok(t - riseStart >= 0.5, `rise only ${t - riseStart}s before lethal`)

  // Standing in the band while it rises is safe.
  w.time = riseStart
  w.player.x = hz.x + hz.w / 2
  w.player.y = hz.y + hz.h
  w.player.grounded = true
  stepWorld(w, idle(), DT)
  assert.equal(w.dying, null, 'died during the rise')
  assert.equal(w.deaths, 0)

  // At full height it is a tide death, then a cut back to spawn.
  w.time = t
  stepWorld(w, idle(), DT)
  assert.ok(w.dying && w.dying.cause === 'tide', 'no tide death at full height')
  assert.equal(w.deaths, 1)
  stepThroughDeath(w)
  assert.equal(w.player.x, 80)
  assert.equal(w.player.y, 420)
})

test('a fall is a vignette: the figure keeps dropping, then a cut to the checkpoint', () => {
  const w = createWorld()
  w.player.x = 660 // over the first gap (620-700)
  w.player.y = 300
  w.player.vx = 0
  w.player.vy = 0
  w.player.grounded = false
  for (let i = 0; i < 300 && !w.dying; i++) stepWorld(w, idle(), DT)
  assert.ok(w.dying && w.dying.cause === 'fall', 'fall never registered')
  assert.equal(w.deaths, 1)
  const tDeath = w.time
  const yAtDeath = w.player.y
  for (let i = 0; i < 6; i++) stepWorld(w, idle(), DT)
  assert.ok(w.player.y > yAtDeath, 'figure stopped falling during the vignette')
  assert.equal(w.player.x, 660, 'figure moved sideways during the vignette')
  stepThroughDeath(w, tDeath)
  assert.equal(w.player.x, 80)
  assert.equal(w.player.y, 420)
})

test('the rock hangs until triggered, kills what it lands on, then stays as a rock', () => {
  const w = createWorld()
  const hz = w.hazards[1]
  assert.equal(hz.state, 'hanging')
  // Light the second beacon so the cut comes back to it.
  w.player.x = w.beacons[1].x
  w.player.y = w.beacons[1].y
  stepWorld(w, idle(), DT)
  assert.equal(w.checkpoint, 1)

  // Run straight through the trigger without stopping.
  w.player.x = hz.triggerX - 60
  w.player.y = 420
  for (let i = 0; i < 120 && !w.dying; i++) stepWorld(w, right(), DT)
  assert.ok(w.dying && w.dying.cause === 'rockfall', `expected a rockfall death (state=${hz.state}, x=${w.player.x})`)
  const platformsBefore = w.platforms.length
  stepThroughDeath(w)
  assert.equal(hz.state, 'landed', 'rock did not land during the vignette')
  assert.equal(w.player.x, w.beacons[1].x)
  assert.equal(w.platforms.length, platformsBefore + 1, 'landed rock must be a platform exactly once')
  assert.ok(w.platforms.some((p) => p.x === hz.x && p.y === hz.y), 'landed rock is not a platform')

  // Stopping short of it is safe, and it does not fall twice.
  const w2 = createWorld()
  const hz2 = w2.hazards[1]
  w2.player.x = hz2.triggerX - 30
  w2.player.y = 420
  for (let i = 0; i < 12; i++) stepWorld(w2, right(), DT)
  for (let i = 0; i < 60; i++) stepWorld(w2, idle(), DT)
  assert.equal(hz2.state, 'landed')
  assert.equal(w2.deaths, 0)
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

test('demo autopilot traverses the whole course and finishes without dying', () => {
  const w = createWorld()
  let steps = 0
  while (!w.won && steps < 15000) {
    stepWorld(w, demoInput(w), DT)
    steps++
  }
  assert.equal(w.won, true, `demo stuck (x=${Math.round(w.player.x)} steps=${steps} deaths=${w.deaths})`)
  assert.ok(w.beacons.every((b) => b.lit), 'not all beacons lit')
  assert.equal(w.deaths, 0, `demo died ${w.deaths} times`)
  assert.ok(w.time < 120, `too slow: ${w.time}s`)
  assert.ok(w.player.x > w.width - 500, `finish too far left (x=${w.player.x})`)
  assert.ok(w.player.y < 300, `finish is not on the tower (y=${w.player.y})`)
})

test('demo waits for the tide instead of running into it', () => {
  const w = createWorld()
  const hz = w.hazards[0]
  let waited = false
  let steps = 0
  while (w.player.x < hz.x + hz.w + 40 && steps < 15000) {
    const inp = demoInput(w)
    if (!inp.right && w.player.grounded && w.player.x < hz.x && w.player.x > hz.x - 300) waited = true
    stepWorld(w, inp, DT)
    steps++
  }
  assert.equal(waited, true, 'demo never paused for the tide')
  assert.equal(w.deaths, 0)
  void tidePhase
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
