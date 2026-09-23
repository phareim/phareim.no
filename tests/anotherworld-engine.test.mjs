import { test } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './anotherworld-load.mjs'

// Another Shore: physics, the hazards, saves, and a playtester that walks
// every chapter with ordinary button presses — proof that each place can
// be crossed, and crossed without dying when played carefully.

const E = await load()
const DT = 1 / 60
const NONE = { left: false, right: false, up: false, down: false, action: false }
const press = o => ({ ...NONE, ...o })

function run(w, input, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) E.stepWorld(w, typeof input === 'function' ? input(w) : input, DT)
}

// ---- the playtester ----

/**
 * A careful player: runs right, jumps what it must, kicks leeches, waits
 * for the tide and the rock, swings the cage in time, and fights guards
 * the Another World way — shield up, then a charged beam behind it.
 */
function makeBot() {
  let hold = 0 // seconds the action button has been held this press
  let want = 0 // how long to hold it
  let prevUp = false
  let prevAction = false
  return w => {
    const p = w.player
    const out = { ...NONE }
    const edge = (k, v) => {
      // Buttons that need a fresh press every time.
      if (k === 'up') { out.up = v && !prevUp; prevUp = out.up }
    }
    if (w.dying || w.exit) return NONE

    // The cage: push with the swing.
    if (w.cage && w.cage.state !== 'down') {
      const c = w.cage
      return press({ right: c.omega >= 0, left: c.omega < 0 })
    }

    if (p.swimming) {
      const water = w.water[0]
      return press({ up: Math.floor(w.time * 3) % 2 === 0, right: p.y < water.y + 60 })
    }
    if (p.mantle || p.landT > 0) return NONE

    // Holding the gun: finish the press we started.
    if (want > 0) {
      hold += DT
      if (hold < want) return press({ action: true })
      want = 0
      hold = 0
      prevAction = false
      return NONE
    }

    const front = p.x + 11
    const sameFloor = a => Math.abs(a.y - p.y) < 30

    // Guards: shield, then beam.
    const g = w.actors.find(a => a.kind === 'guard' && (a.state === 'alert' || a.state === 'idle' || a.state === 'walk') && a.range > 0 && sameFloor(a) && a.x > p.x && a.x - p.x < 470)
    if (g && p.grounded) {
      const mine = w.shields.find(s => s.owner === 'player')
      if (!mine || mine.life < 1.2 || mine.hp <= 1) { want = 0.32; hold = 0; return press({ action: true }) }
      want = 1.0; hold = 0
      return press({ action: true })
    }
    // Blast doors: a beam.
    const door = w.platforms.find(pl => pl.kind === 'door' && pl.x > p.x && pl.x - p.x < 260 && pl.y < p.y && pl.y + pl.h >= p.y - 1)
    if (door && p.grounded) { want = 1.0; hold = 0; return press({ action: true }) }

    // Leeches: kick them, or with the gun, crouch and shoot.
    const l = w.actors.find(a => a.kind === 'leech' && a.state === 'crawl' && a.x > p.x && a.x - p.x < 90 && Math.abs(a.y - p.y) < 4)
    if (l && p.grounded) {
      if (p.hasGun) {
        if (!p.crouching) return press({ down: true })
        if (p.gunCool <= 0 && !prevAction) { prevAction = true; return press({ down: true, action: true }) }
        prevAction = false
        return press({ down: true })
      }
      if (l.x - p.x > 44) return press({ right: true })
      const kick = p.kickT <= 0 && !prevAction
      prevAction = kick
      return press({ action: kick })
    }
    prevAction = false

    // The lift: stand on it until it has carried us up.
    const lift = w.lifts[0]
    if (lift && p.y > 300 && p.x > 2100 && p.x < 2300) {
      if (lift.state !== 'down' && lift.state !== 'rising') return NONE
      const mid = lift.x + lift.w / 2
      if (Math.abs(p.x - mid) > 10) return press({ right: p.x < mid, left: p.x > mid })
      return NONE
    }
    if (lift && lift.state === 'rising') return NONE

    // Tide and falling rock.
    for (const hz of w.hazards) {
      if (hz.kind === 'tide' && front < hz.x && hz.x - front < 220 && p.grounded) {
        const u = E.tidePhase(hz, w.time)
        if (!(u >= 0.88 || u < 0.05)) return NONE
      }
      if (hz.kind === 'rockfall' && hz.state === 'falling' && front < hz.x + 10 && hz.x - front < 200) return NONE
      if (hz.kind === 'rockfall' && hz.state === 'hanging' && p.y - 10 < hz.y + hz.h + 60 && hz.triggerX - front < 30 && hz.triggerX - front > -40) {
        // Walk into the trigger slowly: the rock comes down ahead.
        return press({ right: Math.floor(w.time * 10) % 3 === 0 })
      }
    }

    if (!p.grounded && p.vy < -50) { out.right = true; out.up = true; prevUp = true; return out }

    let jump = false
    let edgeX = null
    for (const pl of w.platforms) {
      if (Math.abs(pl.y - p.y) <= 3 && p.x + 11 > pl.x && p.x - 11 < pl.x + pl.w) edgeX = edgeX === null ? pl.x + pl.w : Math.max(edgeX, pl.x + pl.w)
    }
    const lead = 20 + Math.max(0, p.vx) * 0.12
    if (edgeX !== null) { if (edgeX - front < lead && edgeX < w.width - 5) jump = true } else if (p.grounded) jump = true
    if (!jump) {
      for (const pl of w.platforms) {
        const gap = pl.x - front
        if (gap >= 0 && gap < 70 && pl.y < p.y - 6 && pl.y + pl.h > p.y - 52 + 6 && pl.kind !== 'door') { jump = true; break }
      }
    }
    out.right = true
    edge('up', jump)
    return out
  }
}

export function playChapter(ch, { checkpoint = -1, gun = ch >= 4, seconds = 150 } = {}) {
  const w = E.buildChapter(ch, checkpoint, gun)
  const bot = makeBot()
  const deaths = []
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    E.stepWorld(w, bot(w), DT)
    for (const e of w.events) if (e.type === 'death') deaths.push(`${e.cause}@${Math.round(w.player.x)},${Math.round(w.player.y)}`)
    w.events.length = 0
    if (w.dying || w.exit) break
  }
  return { w, deaths }
}

// ---- physics ----

test('a running jump clears ~200 px and lands; a standing jump is a hop', () => {
  const w = E.buildChapter(2)
  run(w, press({ right: true }), 0.6)
  const x0 = w.player.x
  E.stepWorld(w, press({ right: true, up: true }), DT)
  assert.equal(w.player.grounded, false)
  run(w, press({ right: true, up: true }), 1)
  assert.ok(w.player.grounded, 'landed')
  assert.ok(w.player.x - x0 > 180, `covered ${w.player.x - x0}`)
  const h = E.buildChapter(2)
  E.stepWorld(h, press({ up: true }), DT)
  assert.equal(h.player.hop, true)
})

test('crouching stops the figure and lowers it; up from a crouch just stands', () => {
  const w = E.buildChapter(2)
  run(w, press({ right: true }), 0.4)
  run(w, press({ down: true, right: true }), 0.4)
  assert.equal(w.player.crouching, true)
  assert.ok(Math.abs(w.player.vx) < 1)
  run(w, press({ up: true }), DT)
  assert.equal(w.player.grounded, true)
})

test('pressing into a ledge within reach pulls the figure up onto it', () => {
  const w = E.buildChapter(1)
  // The shelf at 2150 is 128 high: jump into its face and keep pressing.
  w.player = { ...w.player, x: 2080, y: 420, swimming: false, grounded: true }
  w.hint = null
  run(w, press({ right: true }), 0.2)
  E.stepWorld(w, press({ right: true, up: true }), DT)
  let climbed = false
  for (let i = 0; i < 120; i++) {
    E.stepWorld(w, press({ right: true, up: true }), DT)
    if (w.events.some(e => e.type === 'climb')) climbed = true
    w.events.length = 0
    if (w.player.grounded && w.player.y < 300) break
  }
  assert.ok(w.player.y < 300, `on the shelf (y ${w.player.y})${climbed ? ' via a mantle' : ''}`)
})

// ---- the pool ----

test('the pool: doing nothing, the tentacles take the figure; swimming up and out escapes', () => {
  const w = E.buildChapter(1)
  let cause = null
  for (let i = 0; i < 60 * 12 && !cause; i++) {
    E.stepWorld(w, NONE, DT)
    for (const e of w.events) if (e.type === 'death') cause = e.cause
    w.events.length = 0
  }
  assert.equal(cause, 'tentacles')
  assert.ok(w.time > 3, `grace before the grab (${w.time.toFixed(2)} s)`)

  const s = E.buildChapter(1)
  const bot = makeBot()
  for (let i = 0; i < 60 * 8 && s.player.x < 520; i++) E.stepWorld(s, bot(s), DT)
  assert.ok(s.player.x >= 470 && !s.dying && !s.player.swimming, `out on the bank at ${s.player.x}`)
})

test('the attract loop walks chapter I to its end without dying', () => {
  const w = E.buildChapter(1)
  for (let i = 0; i < 60 * 70; i++) {
    E.stepWorld(w, E.demoInput(w), DT)
    assert.equal(w.dying, null, `the demo died at x ${w.player.x}`)
    if (w.exit) break
  }
  assert.ok(w.exit, `the demo reached the end (x ${Math.round(w.player.x)})`)
})

// ---- every chapter can be crossed ----

for (const ch of [1, 2, 3, 4, 5]) {
  test(`chapter ${ch}: a careful player crosses it without dying`, () => {
    const { w, deaths } = playChapter(ch)
    assert.deepEqual(deaths, [], `deaths in chapter ${ch}`)
    assert.ok(w.exit, `chapter ${ch} not finished; stuck at x ${Math.round(w.player.x)}, y ${Math.round(w.player.y)}`)
    if (ch === 2) assert.equal(w.exitCut, 'capture')
    if (ch === 5) { assert.equal(w.exitCut, 'ending'); assert.ok(w.dawn) }
  })
}

// ---- threats ----

test('the beast runs down a player who stands still', () => {
  const w = E.buildChapter(2, 0)
  w.player.x = E.CHASE_X + 80
  let cause = null
  for (let i = 0; i < 60 * 10 && !cause; i++) {
    E.stepWorld(w, NONE, DT)
    for (const e of w.events) if (e.type === 'death') cause = e.cause
    w.events.length = 0
  }
  assert.equal(cause, 'beast')
})

test('a guard shoots a player who stands in the open; a shield takes the bolt', () => {
  const w = E.buildChapter(4)
  w.player.x = 500
  let cause = null
  for (let i = 0; i < 60 * 4 && !cause; i++) {
    E.stepWorld(w, NONE, DT)
    for (const e of w.events) if (e.type === 'death') cause = e.cause
    w.events.length = 0
  }
  assert.equal(cause, 'bolt')

  const s = E.buildChapter(4)
  s.player.x = 500
  run(s, press({ action: true }), 0.5)
  run(s, NONE, DT)
  assert.equal(s.shields.filter(x => x.owner === 'player').length, 1)
  let hits = 0
  for (let i = 0; i < 60 * 1.6; i++) {
    E.stepWorld(s, NONE, DT)
    hits += s.events.filter(e => e.type === 'shieldHit' || e.type === 'shieldBreak').length
    assert.equal(s.dying, null, 'the shield held')
    s.events.length = 0
  }
  assert.ok(hits > 0, 'a bolt hit the shield')
})

test('a tap fires, a hold shields, a long hold beams; only a beam opens a blast door', () => {
  const w = E.buildChapter(4, 0)
  const door = () => w.platforms.some(p => p.id === 'blast-1')
  w.player.x = 1300
  w.actors = w.actors.filter(a => a.kind !== 'guard')
  run(w, press({ right: true }), 0.1)
  run(w, press({ action: true }), 0.05); run(w, NONE, 0.5)
  assert.ok(door(), 'a shot does not open it')
  run(w, press({ action: true }), 1.0); run(w, NONE, 0.5)
  assert.ok(!door(), 'the beam opened it')
})

test('the cage swings down on the guard, who drops the gun', () => {
  const w = E.buildChapter(3)
  const bot = makeBot()
  for (let i = 0; i < 60 * 20 && w.cage.state !== 'down'; i++) E.stepWorld(w, bot(w), DT)
  assert.equal(w.cage.state, 'down')
  assert.ok(w.actors.some(a => a.kind === 'guard' && (a.state === 'dying' || a.state === 'dead')))
  assert.equal(w.items.length, 1)
})

// ---- the game ----

test('a new game opens on the prologue; skipping moves through the cards into chapter I', () => {
  const g = E.createGame()
  assert.equal(g.cut.id, 'prologue')
  E.skipCut(g)
  assert.equal(g.cut.id, 'card')
  E.skipCut(g)
  assert.equal(g.mode, 'play')
  assert.equal(g.world.chapter, 1)
})

test('a death is a vignette, then the chapter comes back at the last lamp', () => {
  const g = E.createGame({ chapter: 2, checkpoint: 0, skipPrologue: true })
  E.skipCut(g)
  g.world.player.x = 1895 // over the gap
  g.world.player.grounded = false
  for (let i = 0; i < 60 * 3; i++) E.stepGame(g, NONE, DT)
  assert.equal(g.deaths, 1)
  assert.equal(g.world.dying, null)
  assert.equal(g.world.checkpoint, 0)
  assert.ok(Math.abs(g.world.player.x - g.world.lamps[0].x) < 300)
})

test('walking off a chapter cuts to the next; chapter II ends in the capture, then the cage', () => {
  const g = E.createGame({ chapter: 1, checkpoint: 1, skipPrologue: true })
  E.skipCut(g)
  g.world.player.x = g.world.width - 10
  E.stepGame(g, press({ right: true }), DT)
  assert.equal(g.cut?.id, 'card')
  assert.equal(g.world.chapter, 2)
  E.skipCut(g)
  g.world.player.x = E.CAPTURE_X + 20
  E.stepGame(g, NONE, DT)
  assert.equal(g.cut?.id, 'capture')
  E.skipCut(g)
  assert.equal(g.world.chapter, 3)
  assert.ok(g.world.cage && g.world.cage.state === 'hang')
})

test('a save round-trips, and a bad one is refused', () => {
  const g = E.createGame({ chapter: 4, checkpoint: 1, hasGun: true, deaths: 3, elapsed: 400, skipPrologue: true })
  const s = E.saveOf(g, 123)
  assert.deepEqual(E.parseSave(JSON.parse(JSON.stringify(s))), s)
  const back = E.gameFromSave(s)
  assert.equal(back.world.chapter, 4)
  assert.equal(back.world.checkpoint, 1)
  assert.equal(back.deaths, 3)
  assert.equal(E.parseSave({ ...s, chapter: 9 }), null)
  assert.equal(E.parseSave({ ...s, v: 2 }), null)
  assert.equal(E.parseSave(null), null)
  const sum = E.summarizeShoreRaw(s)
  assert.equal(sum.roman, 'IV')
})

test('reconcile: the newer write wins', () => {
  const a = { v: 1, chapter: 2, checkpoint: 0, hasGun: false, deaths: 0, elapsed: 10, savedAt: 100 }
  const b = { ...a, chapter: 3, savedAt: 200 }
  assert.equal(E.reconcile(a, 100, { data: b, savedAt: 200, best: null, clears: 0 }, b).kind, 'pull')
  assert.equal(E.reconcile(b, 200, { data: a, savedAt: 100, best: null, clears: 0 }, a).kind, 'push')
  assert.equal(E.reconcile(null, 0, null, null).kind, 'none')
})

test('the world is deterministic for the same inputs', () => {
  const a = E.buildChapter(1)
  const b = E.buildChapter(1)
  for (let i = 0; i < 60 * 20; i++) {
    E.stepWorld(a, E.demoInput(a), DT)
    E.stepWorld(b, E.demoInput(b), DT)
  }
  assert.equal(a.player.x, b.player.x)
  assert.equal(a.player.y, b.player.y)
})
