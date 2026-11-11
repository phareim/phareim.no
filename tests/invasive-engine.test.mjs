// Invasive (Invaders Mk II): the rules in themes/invasive/engine.ts, played
// in node. The sky is one organism: what is cut off from the heart dies, only
// the lance kills a heart, roots put the town's windows out, and a run that
// nobody plays always ends.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  EMPTY, FLESH, STEM, TIP, HEART, ROOT, WINDOWS, LANCE_TIME, STUN_TIME, CANNON_DY, SPECIES,
  mulberry32, createGame, startRun, startDemo, stepGame, setField, quitRun, autopilot,
  flood, tissue, cutValue, lowestIn, chargeNeeded, speciesFor, bodyRows, rage, danger,
} from '../themes/invasive/engine.ts'

const DT = 1 / 60
const IDLE = { move: 0, target: null, fire: false }

/** A run in its first layer, in play, with the organism held still: no growth, no buds, no healing, no spores. */
function still(seed = 1, cols = 30, rows = 45) {
  const g = createGame({ cols, rows, rng: mulberry32(seed) })
  startRun(g)
  g.species = { ...g.species, grow: 0, bud: 0, heal: 0, pod: 0, heartMove: 0 }
  while (g.phase !== 'play') stepGame(g, DT, IDLE)
  // Clear what grew before it was held still.
  for (let i = g.body * g.cols; i < g.kind.length; i++) g.kind[i] = EMPTY
  g.tips = []
  g.events.length = 0
  return g
}

function put(g, x, y, kind, hp = 1) {
  const i = y * g.cols + x
  g.kind[i] = kind
  g.hp[i] = hp
  g.dieAt[i] = 0
  return i
}

/** A straight tendril down from the ceiling in column `x`, `len` cells, ending in a tip. */
function tendril(g, x, len) {
  for (let y = g.body; y < g.body + len; y++) put(g, x, y, STEM)
  put(g, x, g.body + len - 1, TIP)
  g.tips.push({ x, y: g.body + len - 1, run: 0, sdir: 0, len, creep: false })
}

function step(g, seconds, input = IDLE) {
  const events = []
  for (let t = 0; t < seconds; t += DT) {
    stepGame(g, DT, input)
    events.push(...g.events)
    g.events.length = 0
  }
  return events
}

/** One bolt up column `col`. */
function shoot(g, col) {
  g.cannon.x = col + 0.5
  g.fireAcc = 0
  stepGame(g, DT, { move: 0, target: col + 0.5, fire: true })
  const events = [...g.events]
  g.events.length = 0
  return [...events, ...step(g, 0.8)]
}

/** A whole run under the autopilot. */
function play(seed, skill, think, cols = 30, rows = 45, limit = 1500) {
  const g = createGame({ cols, rows, rng: mulberry32(seed) })
  startRun(g)
  while (!g.over && g.time < limit) {
    stepGame(g, DT, skill < 0 ? IDLE : autopilot(g, skill, think))
    g.events.length = 0
  }
  return g
}

describe('Invasive: the organism', () => {
  it('starts as a ceiling of flesh with a heart in it, all of it alive', () => {
    for (const [cols, rows] of [[30, 45], [52, 50], [44, 20], [16, 14]]) {
      const g = createGame({ cols, rows, rng: mulberry32(7) })
      assert.equal(g.body, bodyRows(rows))
      assert.equal(g.hearts.length, 1)
      const h = g.hearts[0]
      assert.equal(g.kind[h.y * cols + h.x], HEART)
      for (let x = 0; x < cols; x++) assert.notEqual(g.kind[x], EMPTY, 'the top row is whole')
      // Nothing is cut off: the flood from the heart reaches every cell.
      assert.equal(flood(g, g.dist, -1), tissue(g))
      assert.ok(g.houses.length >= 3)
      for (const H of g.houses) {
        assert.ok(H.x0 >= 0 && H.x1 < cols, 'a house hangs off the field')
        assert.equal(H.lights, WINDOWS)
      }
    }
  })

  it('grows tendrils down from the ceiling on the beat, and they stay joined to the heart', () => {
    const g = createGame({ cols: 30, rows: 45, rng: mulberry32(3) })
    startRun(g)
    step(g, 20)
    assert.ok(g.beats > 15, 'the heart beats')
    assert.ok(g.tendrils > 15, `only ${g.tendrils} tendril cells after 20 s`)
    assert.ok(g.tips.length >= 3)
    assert.equal(flood(g, g.dist, -1), tissue(g) - g.dying.length)
    assert.ok(danger(g) > 0.1)
  })

  it('beats faster the more of it there is, and the longer a layer is left alive', () => {
    const g = still()
    step(g, 2)
    const calm = g.beatInterval
    for (let x = 2; x < 28; x += 2) tendril(g, x, 20)
    step(g, 2)
    assert.ok(g.beatInterval < calm * 0.7, 'a sky full of tendrils beats much faster')
    assert.equal(rage(createGame({ cols: 30, rows: 45 })), 0)
    g.beats = 10_000
    assert.equal(rage(g), 1)
  })

  it('never stalls: a run nobody plays ends with the town dark', () => {
    for (const [cols, rows] of [[30, 45], [52, 50], [44, 20]]) for (const seed of [1, 2, 3]) {
      const g = play(seed, -1, 0, cols, rows, 400)
      assert.ok(g.over, `${cols}×${rows} seed ${seed}: still going after 400 s`)
      assert.ok(g.houses.every(h => h.lights === 0))
      assert.equal(g.score, 0)
    }
  })
})

describe('Invasive: cutting', () => {
  it('severs everything that hung from the cell a bolt takes out', () => {
    const g = still()
    tendril(g, 10, 12)
    // A side branch off the tendril, so the cut is not at the bottom.
    for (let x = 11; x <= 14; x++) put(g, x, g.body + 4, STEM)
    const cut = (g.body + 4) * g.cols + 12
    assert.deepEqual(cutValue(g, cut), { n: 2, roots: 0 })
    assert.equal(lowestIn(g, 12), g.body + 4)
    const before = g.score
    const events = shoot(g, 12)
    const sever = events.find(e => e.t === 'sever')
    assert.ok(sever, 'no sever')
    assert.equal(sever.n, 2)
    assert.equal(g.kind[(g.body + 4) * g.cols + 14], EMPTY, 'the cut-off end is still there')
    assert.equal(g.kind[(g.body + 4) * g.cols + 11], STEM, 'the stump went too')
    assert.equal(g.kind[(g.body + 11) * g.cols + 10], TIP, 'the main tendril was not touched')
    assert.equal(g.score, before + 1 + sever.score)
  })

  it('pays far more for one long cut than for the same cells shot one by one', () => {
    const cutter = still()
    // A tendril whose neck runs sideways: down two cells in column 11, across to 13, then thirty cells down.
    const top = cutter.body
    put(cutter, 11, top, STEM)
    put(cutter, 11, top + 1, STEM)
    put(cutter, 12, top + 1, STEM)
    for (let y = top + 1; y <= top + 30; y++) put(cutter, 13, y, STEM)
    // One bolt in column 12 takes the neck, and everything past it.
    const sever = shoot(cutter, 12).find(e => e.t === 'sever')
    assert.equal(sever.n, 30)
    step(cutter, 2)
    assert.equal(tissue(cutter), cutter.body * cutter.cols + 2, 'only the ceiling and the stump are left')

    const mower = still()
    tendril(mower, 10, 31)
    for (let n = 0; n < 31; n++) shoot(mower, 10)
    assert.equal(lowestIn(mower, 10) < mower.body + 1, true)
    assert.ok(cutter.score > mower.score * 4, `cut ${cutter.score} vs mown ${mower.score}`)
  })

  it('cannot cut the ceiling in two: the top row takes no damage', () => {
    const g = still()
    const col = g.hearts[0].x + 4
    for (let n = 0; n < 40; n++) shoot(g, col)
    assert.equal(g.kind[col], FLESH, 'the top row was shot away')
    for (let y = 1; y < g.body; y++) assert.equal(g.kind[y * g.cols + col], EMPTY)
    assert.equal(flood(g, g.dist, -1), tissue(g), 'something was cut off')
  })

  it('heals the ceiling, and a cut stump grows back', () => {
    const g = still()
    g.species = { ...g.species, heal: 0.5, bud: 1, grow: 1 }
    const col = g.hearts[0].x + 5
    for (let n = 0; n < 4; n++) shoot(g, col)
    step(g, 12)
    for (let y = 1; y < g.body; y++) assert.equal(g.kind[y * g.cols + col], FLESH, `row ${y} did not close`)
    assert.ok(g.tips.length > 0, 'no new tendrils')
  })

  it('hardens stems that are left to age, in the species that has bark', () => {
    const coral = SPECIES.find(s => s.name === 'CORAL')
    assert.ok(coral.bark > 0)
    const g = still()
    g.species = { ...g.species, bark: 3 }
    tendril(g, 10, 6)
    step(g, 6)
    const i = (g.body + 2) * g.cols + 10
    assert.equal(g.hp[i], 2)
    put(g, 12, g.body, STEM, 2)
    const events = shoot(g, 12)
    assert.ok(events.some(e => e.t === 'clank'))
    assert.equal(g.kind[g.body * g.cols + 12], STEM, 'bark went in one hit')
  })
})

describe('Invasive: the heart and the lance', () => {
  it('shrugs off bolts', () => {
    const g = still()
    const h = g.hearts[0]
    for (let n = 0; n < 60; n++) shoot(g, h.x)
    assert.equal(h.hp, h.maxHp)
    assert.ok(h.alive)
  })

  it('charges the lance with caught motes, and the lance kills the heart and the whole layer with it', () => {
    const g = still()
    const h = g.hearts[0]
    tendril(g, 3, 10)
    g.cannon.x = h.x + 0.5
    const need = chargeNeeded(g)
    assert.equal(need, Math.round(SPECIES[0].charge * 30 / 32))
    for (let n = 0; n < need; n++) g.motes.push({ x: g.cannon.x, y: g.rows + CANNON_DY - 0.5, vx: 0, vy: 1 })
    const events = step(g, 0.5)
    assert.equal(events.filter(e => e.t === 'mote').length, need)
    assert.ok(events.some(e => e.t === 'lance' && e.on), 'the lance did not light')
    assert.ok(g.lance > LANCE_TIME - 1)
    const more = step(g, 6)
    assert.ok(more.some(e => e.t === 'heartDown' && e.last), 'the heart survived the lance')
    assert.ok(more.some(e => e.t === 'relight'))
    assert.equal(g.layer, 2)
    assert.equal(g.species.name, 'VINE')
    assert.equal(g.charge, 0, 'a new layer starts uncharged')
    assert.ok(g.score >= 500)
  })

  it('pays out the gold of a fallen layer as points, not as charge', () => {
    const g = still()
    g.phase = 'between'
    g.motes.push({ x: g.cannon.x, y: g.rows + CANNON_DY - 0.5, vx: 0, vy: 1 })
    const before = g.score
    stepGame(g, DT, IDLE)
    assert.equal(g.charge, 0)
    assert.equal(g.score, before + 10)
  })

  it('keeps everything alive on the second heart until that is dead too', () => {
    // Arrive in layer 4 (MYCEL, two hearts) the way a run does: by killing layer 3's heart.
    const m = createGame({ cols: 44, rows: 50, rng: mulberry32(5) })
    startRun(m)
    m.layer = 3
    while (m.phase !== 'play') stepGame(m, DT, IDLE)
    m.lance = 99
    step(m, 4, { move: 0, target: m.hearts[0].x + 0.5, fire: false })
    while (m.layer === 3 || m.phase !== 'play') stepGame(m, DT, IDLE)
    m.events.length = 0
    assert.equal(m.layer, 4)
    assert.equal(m.species.name, 'MYCEL')
    assert.equal(m.hearts.length, 2)
    m.species = { ...m.species, heartMove: 0, grow: 0, bud: 0 }
    m.lance = 99
    const first = step(m, 3, { move: 0, target: m.hearts[0].x + 0.5, fire: false })
    assert.ok(first.some(e => e.t === 'heartDown' && !e.last))
    assert.equal(m.phase, 'play')
    assert.ok(tissue(m) > m.body * m.cols * 0.8, 'the ceiling died with the first heart')
    m.lance = 99
    const second = step(m, 3, { move: 0, target: m.hearts[1].x + 0.5, fire: false })
    assert.ok(second.some(e => e.t === 'heartDown' && e.last))
  })
})

describe('Invasive: the town', () => {
  it('loses a window at a time to a root, and gets the house back when the root is cut', () => {
    const g = still()
    const H = g.houses[1]
    const x = H.x0 + 2
    for (let y = g.body; y < g.rows - 1; y++) put(g, x, y, STEM)
    put(g, x, g.rows - 1, TIP)
    g.tips.push({ x, y: g.rows - 1, run: 0, sdir: 0, len: 30, creep: false })
    g.species = { ...g.species, grow: 1 }
    const events = step(g, 14)
    assert.ok(events.some(e => e.t === 'latch' && e.house === 1), 'the tendril did not take the roof')
    assert.equal(g.kind[(g.rows - 1) * g.cols + x], ROOT)
    assert.ok(H.lights < WINDOWS, 'no window went out')
    assert.ok(H.lights > 0)
    const left = H.lights
    shoot(g, x) // a root takes two hits
    shoot(g, x)
    step(g, 6)
    assert.equal(H.lights, left, 'the house kept draining after the cut')
    assert.equal(H.roots, 0)
  })

  it('ends the run when the last window is out, and not before', () => {
    const g = still()
    for (const H of g.houses) H.lights = 0
    g.houses[0].lights = 1
    step(g, 3)
    assert.equal(g.over, false)
    g.houses[0].lights = 0
    const events = step(g, 3)
    assert.ok(g.over)
    assert.equal(events.filter(e => e.t === 'over').length, 1)
    const frozen = g.score
    step(g, 2, { move: 1, target: null, fire: true })
    assert.equal(g.score, frozen)
  })

  it('ends at once when the player quits', () => {
    const g = still()
    quitRun(g)
    assert.ok(g.over)
    assert.equal(g.phase, 'over')
  })

  it('snares the cannon with a spore, and a bolt pops one', () => {
    const g = still()
    g.cannon.x = 10.5
    g.spores.push({ x: 10.5, y: g.rows - 2 })
    const events = step(g, 0.6)
    assert.ok(events.some(e => e.t === 'stun'))
    assert.ok(g.cannon.stun > 0 && g.cannon.stun <= STUN_TIME)
    const at = g.cannon.x
    step(g, 0.3, { move: 1, target: null, fire: true })
    assert.equal(g.cannon.x, at, 'a snared cannon moved')
    assert.equal(g.bolts.length, 0, 'a snared cannon fired')
    step(g, STUN_TIME + 1.2)
    g.spores.push({ x: 10.5, y: g.rows - 8 })
    const pop = shoot(g, 10)
    assert.ok(pop.some(e => e.t === 'sporePop'))
  })
})

describe('Invasive: a whole run', () => {
  it('is the same run for the same seed', () => {
    const a = play(11, 1, 0.5, 30, 45, 120)
    const b = play(11, 1, 0.5, 30, 45, 120)
    assert.equal(a.score, b.score)
    assert.equal(a.layer, b.layer)
    assert.deepEqual([...a.kind], [...b.kind])
  })

  it('can be played: the autopilot clears layers on a phone and on a desk, and still loses in the end', () => {
    for (const [cols, rows] of [[30, 45], [52, 50]]) {
      let layers = 0
      for (const seed of [1, 2, 3]) {
        const g = play(seed, 1, 0.8, cols, rows)
        assert.ok(g.over, `${cols}×${rows} seed ${seed}: the autopilot never lost`)
        assert.ok(g.layer >= 2, `${cols}×${rows} seed ${seed}: the autopilot never killed a heart`)
        layers += g.layer
      }
      assert.ok(layers >= 9, `${cols}×${rows}: ${layers} layers over three runs`)
    }
  })

  it('takes the first heart about a minute to bring down, not seconds', () => {
    for (const seed of [1, 2, 3, 4]) {
      const g = createGame({ cols: 30, rows: 45, rng: mulberry32(seed) })
      startRun(g)
      while (g.layer === 1 && !g.over && g.time < 400) { stepGame(g, DT, autopilot(g, 1, 0.3)); g.events.length = 0 }
      assert.ok(g.time > 25, `seed ${seed}: layer 1 fell in ${g.time.toFixed(0)} s`)
      assert.ok(g.time < 200, `seed ${seed}: layer 1 took ${g.time.toFixed(0)} s`)
    }
  })

  it('takes a new field size at the next layer, and keeps the lit windows', () => {
    const g = createGame({ cols: 30, rows: 45, rng: mulberry32(2) })
    startRun(g)
    setField(g, 44, 30)
    assert.equal(g.cols, 30, 'a run changed size under the player')
    g.houses[0].lights = 1
    while (g.phase !== 'play') stepGame(g, DT, IDLE)
    g.lance = 99
    step(g, 4, { move: 0, target: g.hearts[0].x + 0.5, fire: false })
    while (g.layer === 1) stepGame(g, DT, IDLE)
    assert.equal(g.cols, 44)
    assert.equal(g.rows, 30)
    assert.equal(g.kind.length, 44 * 30)
    assert.equal(g.houses[0].lights, 2, 'one window back for the fallen heart, on top of the one that was lit')
    // The demo takes it at once.
    const d = createGame({ cols: 30, rows: 45, rng: mulberry32(2) })
    startDemo(d)
    setField(d, 20, 20)
    assert.equal(d.cols, 20)
  })

  it('gets harder every cycle of five', () => {
    assert.equal(speciesFor(1), SPECIES[0])
    assert.equal(speciesFor(6).name, 'MOSS')
    assert.ok(speciesFor(6).bpm > speciesFor(1).bpm)
    assert.ok(speciesFor(11).heartHp > speciesFor(6).heartHp)
    assert.ok(speciesFor(6).charge > speciesFor(1).charge)
  })
})

describe('Invasive: the page', () => {
  it('keeps the game out of the landing chunk and reports its score to the Hall of Fame', () => {
    const landing = readFileSync(new URL('../themes/invasive/Landing.vue', import.meta.url), 'utf8')
    assert.match(landing, /defineAsyncComponent\(\(\) => import\('\.\/Game\.vue'\)\)/)
    assert.doesNotMatch(landing, /^import .* from '\.\/Game\.vue'/m)
    assert.match(landing, /submitScore\('invasive', score\.value\)/)
    assert.match(readFileSync(new URL('../themes/leaderboard/games.ts', import.meta.url), 'utf8'), /id: 'invasive'/)
  })
})
