import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// The engine imports ./shots (which only has type imports of ./types).
// Transpile each module and stitch the relative import into a data URL.
const transpile = (rel) =>
  ts.transpileModule(readFileSync(new URL(`../themes/shore/${rel}`, import.meta.url), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText
const asUrl = (src) => `data:text/javascript;base64,${Buffer.from(src).toString('base64')}`
const shotsUrl = asUrl(transpile('shots.ts'))
const engineSrc = transpile('engine.ts').replace(/from\s+['"]\.\/shots['"]/g, `from '${shotsUrl}'`)
const { createWorld, stepWorld, demoInput, tideTop, STEP } = await import(asUrl(engineSrc))
const { SHOTS, BEACONS, START } = await import(shotsUrl)

const DT = STEP
const idle = () => ({ left: false, right: false, jump: false, crouch: false })
const right = () => ({ left: false, right: true, jump: false, crouch: false })
const settle = (w, n = 3) => { for (let i = 0; i < n; i++) stepWorld(w, idle(), DT) }
const skipIntro = (w) => { while (w.intro > 0) stepWorld(w, idle(), DT) }

/** Run until a predicate holds, at most `max` steps. */
function until(w, input, pred, max) {
  let n = 0
  while (!pred(w) && n < max) { stepWorld(w, typeof input === 'function' ? input(w) : input, DT); n++ }
  return pred(w)
}

test('world starts submerged in the tide pool, dusk, three unlit beacons', () => {
  const w = createWorld()
  assert.equal(SHOTS.length, 7)
  assert.equal(w.shot, 0)
  assert.deepEqual([w.figure.x, w.figure.y], START)
  assert.equal(w.beacons.length, 3)
  assert.ok(w.beacons.every((b) => !b.lit))
  assert.equal(w.palette, 0)
  assert.equal(w.checkpoint, -1)
  assert.ok(w.intro > 0)
  assert.equal(w.won, false)
})

test('every shot has a landscape and a portrait composition with its own horizon', () => {
  for (const s of SHOTS) {
    assert.ok(s.land.back.length > 2, `${s.id} landscape`)
    assert.ok(s.port.back.length > 2, `${s.id} portrait`)
    assert.ok(s.land.s > 0 && s.port.s > 0)
    assert.ok(Math.abs(s.port.s - s.land.s * 0.625) < 1e-9, `${s.id}: portrait scale follows the width`)
    assert.ok(s.enterLeft[0] > 0 && s.enterLeft[0] < s.stageW)
  }
})

test('walking off the right edge cuts to the next shot; the left edge cuts back', () => {
  const w = createWorld()
  skipIntro(w)
  w.figure.x = SHOTS[0].stageW - 20
  w.figure.y = 300
  assert.ok(until(w, right(), (x) => x.shot === 1, 60), 'never reached the arch')
  assert.deepEqual([w.figure.x, w.figure.y], SHOTS[1].enterLeft)
  assert.equal(w.cut, true)
  // and back
  w.figure.x = 20
  assert.ok(until(w, { left: true, right: false, jump: false, crouch: false }, (x) => x.shot === 0, 60), 'never went back')
  assert.deepEqual([w.figure.x, w.figure.y], SHOTS[0].enterRight)
})

test('the first shot has a wall on the left (the sea)', () => {
  const w = createWorld()
  skipIntro(w)
  w.figure.x = 30
  for (let i = 0; i < 60; i++) stepWorld(w, { left: true, right: false, jump: false, crouch: false }, DT)
  assert.equal(w.shot, 0)
  assert.ok(w.figure.x >= 11, `x=${w.figure.x}`)
})

test('wading out: the step up onto the shore needs no jump', () => {
  const w = createWorld()
  skipIntro(w)
  assert.equal(w.figure.y, 326)
  assert.ok(until(w, right(), (x) => x.figure.y === 300, 240), `never climbed out (y=${w.figure.y})`)
  assert.equal(w.figure.grounded, true)
})

test('standing hop is short, running jump is long', () => {
  const hop = createWorld(); skipIntro(hop)
  hop.figure.x = 400; hop.figure.y = 300
  stepWorld(hop, { ...idle(), jump: true }, DT)
  let hopTop = 300
  until(hop, idle(), (x) => x.figure.grounded && x.figure.vy === 0 && x.time > 0.9, 200)
  // measure apex by replaying
  const h2 = createWorld(); skipIntro(h2); h2.figure.x = 400; h2.figure.y = 300
  stepWorld(h2, { ...idle(), jump: true }, DT)
  for (let i = 0; i < 120 && !(h2.figure.grounded && i > 2); i++) { stepWorld(h2, idle(), DT); hopTop = Math.min(hopTop, h2.figure.y) }
  const hopHeight = 300 - hopTop
  const hopDx = Math.abs(h2.figure.x - 400)

  const run = createWorld(); skipIntro(run); run.figure.x = 400; run.figure.y = 300
  for (let i = 0; i < 5; i++) stepWorld(run, right(), DT)
  const x0 = run.figure.x
  stepWorld(run, { ...right(), jump: true }, DT)
  let runTop = 300
  for (let i = 0; i < 120 && !(run.figure.grounded && i > 2); i++) { stepWorld(run, right(), DT); runTop = Math.min(runTop, run.figure.y) }
  const runHeight = 300 - runTop
  const runDx = run.figure.x - x0

  assert.ok(hopHeight > 25 && hopHeight < 45, `hop height ${hopHeight}`)
  assert.ok(hopDx < 2, `hop drifted ${hopDx}`)
  assert.ok(runHeight > hopHeight, `long jump not higher (${runHeight} vs ${hopHeight})`)
  assert.ok(runDx > 90 && runDx < 130, `long jump range ${runDx}`)
})

test('the low lintel forces a crouch and blocks a standing figure', () => {
  const w = createWorld()
  skipIntro(w)
  w.shot = 1
  w.figure.x = 380; w.figure.y = 300
  for (let i = 0; i < 90; i++) stepWorld(w, right(), DT)
  assert.ok(w.figure.x < 430, `walked through the lintel standing (x=${w.figure.x})`)
  const blockedAt = w.figure.x
  for (let i = 0; i < 40; i++) stepWorld(w, { ...right(), crouch: true }, DT)
  assert.equal(w.figure.crouch, true)
  assert.ok(w.figure.x > blockedAt + 20, `did not crawl under (x=${w.figure.x})`)
  // release crouch while still under: stays crouched
  stepWorld(w, right(), DT)
  assert.equal(w.figure.crouch, true, 'stood up under the lintel')
  assert.ok(until(w, right(), (x) => !x.figure.crouch, 120), 'never stood up after the lintel')
})

test('fall: the figure drops out of frame, a black beat, then the last beacon', () => {
  const w = createWorld()
  skipIntro(w)
  w.shot = 2
  w.figure.x = 150; w.figure.y = 280; w.figure.grounded = false // over the first gap
  assert.ok(until(w, idle(), (x) => x.death !== null, 120), 'never died')
  assert.equal(w.death.kind, 'fall')
  assert.equal(w.deaths, 1)
  const yAtDeath = w.figure.y
  stepWorld(w, idle(), DT)
  assert.ok(w.figure.y > yAtDeath, 'the body stops falling during the vignette')
  assert.ok(until(w, idle(), (x) => x.blackout > 0, 120), 'no black frame')
  assert.ok(w.death.t >= 0.7 && w.death.t <= 0.95, `vignette length ${w.death.t}`)
  assert.ok(until(w, idle(), (x) => x.blackout === 0 && x.death === null, 60), 'never respawned')
  assert.equal(w.shot, 0)
  assert.deepEqual([w.figure.x, w.figure.y], START)
  assert.ok(w.intro > 0, 'respawn at the start surfaces again')
})

test('tide: the band is visible before it is lethal and covers the figure on the low slab', () => {
  const tide = SHOTS[2].hazards.find((h) => h.kind === 'tide')
  assert.ok(tideTop(tide, 0) > tide.y, 'rests below the slab')
  assert.ok(tideTop(tide, tide.coverFrom - 0.3) < tide.restY && tideTop(tide, tide.coverFrom - 0.3) > tide.y, 'rising is visible before cover')
  assert.ok(tideTop(tide, tide.coverFrom + 0.1) < tide.y, 'covers the slab')

  const w = createWorld()
  skipIntro(w)
  w.shot = 2
  w.beacons[0].lit = true; w.checkpoint = 0; w.palette = 1
  w.figure.x = tide.x + tide.w / 2; w.figure.y = tide.y
  // stand there through one cycle
  assert.ok(until(w, idle(), (x) => x.death !== null, Math.ceil(tide.period / DT) + 5), 'the tide never took the figure')
  assert.equal(w.death.kind, 'tide')
  assert.ok(until(w, idle(), (x) => x.death === null && x.blackout === 0, 120), 'never respawned')
  assert.equal(w.shot, BEACONS[0].shot)
  assert.deepEqual([w.figure.x, w.figure.y], [BEACONS[0].x, BEACONS[0].y])
  assert.equal(w.deaths, 1)
})

test('rockfall: the wedge drops when the figure passes the crack, kills if it stops, and stays', () => {
  const rock = SHOTS[5].hazards.find((h) => h.kind === 'rock')
  const w = createWorld()
  skipIntro(w)
  w.shot = 5
  w.beacons[0].lit = true; w.beacons[1].lit = true; w.checkpoint = 1; w.palette = 2
  w.figure.x = rock.triggerX - 5; w.figure.y = 300
  assert.equal(w.rock.state, 'hanging')
  assert.ok(until(w, right(), (x) => x.figure.x > rock.x + 4, 60))
  assert.equal(w.rock.state, 'falling')
  // stop under it
  assert.ok(until(w, idle(), (x) => x.rock.state === 'landed', 120), 'rock never landed')
  assert.equal(w.death?.kind, 'rock')
  assert.ok(until(w, idle(), (x) => x.death === null && x.blackout === 0, 120), 'never respawned')
  assert.equal(w.shot, BEACONS[1].shot)
  assert.equal(w.rock.state, 'landed', 'the wedge is gone after respawn')
  // a running figure clears it
  const w2 = createWorld()
  skipIntro(w2)
  w2.shot = 5
  w2.figure.x = rock.triggerX - 40; w2.figure.y = 300
  assert.ok(until(w2, right(), (x) => x.rock.state === 'landed', 200))
  assert.equal(w2.death, null, 'a running figure should clear the rockfall')
})

test('beacons light in order and turn the palette: night, storm with a flash, dawn wins', () => {
  const w = createWorld()
  skipIntro(w)
  for (let i = 0; i < 3; i++) {
    const b = BEACONS[i]
    w.shot = b.shot
    w.figure.x = b.x - 30; w.figure.y = b.y; w.figure.grounded = true
    assert.ok(until(w, right(), (x) => x.beacons[i].lit, 90), `beacon ${i} never lit`)
    assert.equal(w.palette, i + 1)
    assert.equal(w.checkpoint, i)
    if (i === 1) assert.ok(w.flashUntil > w.time, 'no lightning frame at the storm turn')
  }
  assert.equal(w.won, true)
  assert.equal(w.palette, 3)
  // during the storm a strike recurs on a fixed clock
  const s = createWorld(); skipIntro(s)
  s.palette = 2; s.stormSince = s.time
  let flashes = 0, last = -1
  for (let i = 0; i < 60 * 15; i++) { stepWorld(s, idle(), DT); if (s.flashUntil > s.time && s.flashUntil !== last) { flashes++; last = s.flashUntil } }
  assert.equal(flashes, 2, `expected two strikes in 15 s, got ${flashes}`)
})

test('the beast turns its head once the figure passes', () => {
  const w = createWorld()
  skipIntro(w)
  w.shot = 4
  w.figure.x = 100; w.figure.y = 300
  assert.equal(w.beastTurned, false)
  assert.ok(until(w, right(), (x) => x.beastTurned, 200))
  assert.ok(w.figure.x > SHOTS[4].beast.turnX)
})

test('large dt is clamped and a negative dt is a no-op', () => {
  const w = createWorld()
  skipIntro(w)
  w.figure.x = 400; w.figure.y = 300
  settle(w, 10)
  const t0 = w.time
  stepWorld(w, idle(), 5)
  assert.ok(w.time - t0 <= 0.101)
  assert.equal(w.figure.y, 300)
  const t1 = w.time
  stepWorld(w, idle(), -1)
  assert.equal(w.time, t1)
})

test('same inputs give the same world', () => {
  const run = () => {
    const w = createWorld()
    for (let i = 0; i < 900; i++) stepWorld(w, demoInput(w), DT)
    return JSON.stringify(w)
  }
  assert.equal(run(), run())
})

test('attract mode loops the first shot without reaching the beacon', () => {
  const w = createWorld({ attract: true })
  assert.ok(until(w, demoInput, (x) => x.loops >= 2, 60 * 30), 'never looped twice')
  assert.equal(w.shot, 0)
  assert.equal(w.beacons[0].lit, false)
  assert.equal(w.palette, 0)
  assert.equal(w.deaths, 0)
})

test('autopilot crosses all seven shots to the lamp without dying', () => {
  const w = createWorld()
  let steps = 0
  const seen = new Set()
  while (!w.won && steps < 60 * 120) {
    stepWorld(w, demoInput(w), DT)
    seen.add(w.shot)
    steps++
  }
  assert.equal(w.won, true, `stuck in shot ${w.shot} (${SHOTS[w.shot].id}) x=${Math.round(w.figure.x)} y=${Math.round(w.figure.y)} deaths=${w.deaths} rock=${w.rock.state} t=${w.time.toFixed(1)}`)
  assert.equal(seen.size, 7, 'skipped a shot')
  assert.equal(w.deaths, 0, `autopilot died ${w.deaths} times`)
  assert.ok(w.beacons.every((b) => b.lit))
  assert.equal(w.palette, 3)
  assert.ok(w.time < 90, `too slow: ${w.time}s`)
  assert.deepEqual(demoInput(w), { left: false, right: false, jump: false, crouch: false })
})
