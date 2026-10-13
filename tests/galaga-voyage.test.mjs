// Space Voyagers, played whole by the autopilot: a soak (30 game minutes, no
// NaN, counts bounded, the field's edges kept), the voyage on 12 seeds at both
// heights with the table of how far each got, the ending and VOYAGE II.
// The numbers say how hard the game is for a program. They say nothing about feel.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, step, POOL, playerTop } from '../themes/galaga/engine/index.ts'
import { createAutopilot, autopilot, CASUAL, CLUMSY } from '../themes/galaga/engine/autopilot.ts'
import { FIELD, PLAYER, difficulty, bossHp, boltSpeed } from '../themes/galaga/engine/balance.ts'

const SEEDS = 12
const LIMIT = 30 * 60 * 60

/** Fly one voyage; returns how far it got and what it cost, sector by sector. */
function voyage(seed, height, opts = {}) {
  const w = createWorld({ seed, height })
  const ap = createAutopilot(opts)
  const hits = [0, 0, 0, 0, 0]
  const ev = { ending: false, friends: 0 }
  let before = 0
  while (!w.over && w.voyage === 1 && w.tick < LIMIT) {
    const sector = w.sector
    step(w, autopilot(ap, w))
    hits[sector - 1] += w.stats.hits - before
    before = w.stats.hits
    for (const e of w.events) {
      if (e.type === 'ending') ev.ending = true
      if (e.type === 'friend') ev.friends++
    }
  }
  return {
    seed, done: w.voyage > 1, over: w.over, sectors: w.stats.sectorsCleared, at: `${w.sector} ${w.stage}${w.stage === 'wave' ? w.wave : ''}`,
    minutes: w.tick / 3600, score: w.score, hits, tows: w.stats.tows, friends: ev.friends, ending: ev.ending,
  }
}

function table(title, rows) {
  const line = r => [
    String(r.seed).padStart(4), (r.done ? 'ENDING' : r.over ? 'OVER' : 'TIME').padEnd(7), String(r.sectors).padStart(7),
    r.at.padEnd(9), r.minutes.toFixed(1).padStart(6), String(r.score).padStart(8), r.hits.join(' ').padStart(14),
    String(r.tows).padStart(5), String(r.friends).padStart(8),
  ].join(' ')
  console.log(`\n${title}\nseed result  sectors stopped     min    score   hits by sector  tows  friends`)
  for (const r of rows) console.log(line(r))
  const sum = rows.reduce((a, r) => a.map((x, i) => x + r.hits[i]), [0, 0, 0, 0, 0])
  console.log(`      sector 1 cleared ${rows.filter(r => r.sectors >= 1).length}/${rows.length}, voyage finished ${rows.filter(r => r.done).length}/${rows.length}, mean hits by sector ${sum.map(x => (x / rows.length).toFixed(1)).join(' ')}`)
}

for (const height of [320, 432]) {
  test(`soak at ${height}: 30 game minutes, no NaN, bounded counts, edges kept`, () => {
    let ticks = 0
    let seed = 100 + height
    let most = 0
    while (ticks < LIMIT) {
      const w = createWorld({ seed: seed++, height })
      const ap = createAutopilot(CASUAL)
      while (!w.over && ticks < LIMIT) {
        step(w, autopilot(ap, w))
        ticks++
        const p = w.player
        const q = w.partner
        assert.ok(p.x >= PLAYER.marginX && p.x <= FIELD.w - PLAYER.marginX, `player x ${p.x}`)
        assert.ok(p.y >= playerTop(w) && p.y <= height - PLAYER.marginBottom, `player y ${p.y}`)
        assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && q.x >= 0 && q.x <= FIELD.w, `partner ${q.x},${q.y}`)
        assert.ok(Number.isFinite(w.score) && w.score >= 0)
        assert.ok(p.hull >= 0 && p.hull <= PLAYER.hull && p.level >= 1 && p.level <= 5)
        assert.ok(w.events.length < 160, `${w.events.length} events in a tick`)
        most = Math.max(most, w.events.length)
        if (ticks % 7 !== 0) continue
        let n = 0
        for (const pool of [w.enemies, w.shots, w.bolts, w.zones, w.pickups, w.rigs]) {
          for (const e of pool) {
            if (!e.active) continue
            n++
            assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `a ${e.kind} at ${e.x},${e.y}`)
            // A convoy's rigs queue below the field before they come up: three of them are 500 px long.
            const below = pool === w.rigs ? 600 : 200
            assert.ok(e.x > -80 && e.x < FIELD.w + 80 && e.y > -200 && e.y < height + below, `a ${e.kind} far outside at ${e.x},${e.y}`)
          }
        }
        for (const k of w.pickups) if (k.active) assert.ok(k.x >= 8 && k.x <= FIELD.w - 8, 'a pick-up can be reached')
        assert.ok(n <= POOL.enemies + POOL.shots + POOL.bolts + POOL.zones + POOL.pickups + POOL.rigs)
        if (w.boss.active) assert.ok(Number.isFinite(w.boss.hp) && Number.isFinite(w.boss.x) && Number.isFinite(w.boss.y))
      }
    }
    assert.equal(ticks, LIMIT)
    assert.ok(most > 0)
  })
}

const results = {}
for (const height of [320, 432]) {
  test(`the voyage at ${height}: 12 seeds, sector 1 cleared on at least 10, the ending reached on some`, () => {
    const rows = []
    for (let seed = 1; seed <= SEEDS; seed++) rows.push(voyage(seed, height))
    results[height] = rows
    table(`AUTOPILOT, field 240 x ${height}`, rows)
    assert.ok(rows.filter(r => r.sectors >= 1).length >= 10, 'sector 1 cleared on at least 10 of 12')
    assert.ok(rows.some(r => r.done), 'the first voyage is finished on some seeds')
    for (const r of rows.filter(x => x.done)) assert.ok(r.ending && r.sectors === 5)
    const first = rows.reduce((a, r) => a + r.hits[0], 0) / rows.length
    assert.ok(first <= 2, `sector 1 is gentle: ${first.toFixed(2)} hits a run`)
  })
}

test('the same voyage for weaker hands: looks five and three times a second', () => {
  for (const [name, opts] of [['CASUAL (5 looks a second, 0.8 s ahead)', CASUAL], ['CLUMSY (3 looks a second, 0.5 s ahead, no margin)', CLUMSY]]) {
    for (const height of [320, 432]) {
      const rows = []
      for (let seed = 1; seed <= SEEDS; seed++) rows.push(voyage(seed, height, opts))
      table(`${name}, field 240 x ${height}`, rows)
      assert.ok(rows.filter(r => r.sectors >= 1).length >= 10, `${name}: sector 1 cleared on at least 10 of 12`)
    }
  }
})

test('the ending, then VOYAGE II: harder, the score running on', () => {
  const w = createWorld({ seed: 2, height: 320 })
  const ap = createAutopilot()
  const seen = []
  let scoreAtEnding = -1
  while (!w.over && w.tick < LIMIT * 2 && !(w.voyage === 2 && w.sector === 2)) {
    step(w, autopilot(ap, w))
    for (const e of w.events) {
      if (e.type === 'ending') { seen.push('ending'); scoreAtEnding = w.score }
      if (e.type === 'voyage') seen.push(`voyage ${e.n}`)
      if (e.type === 'card' && (e.kind === 'ending' || e.kind === 'voyage')) seen.push(`card ${e.kind}`)
      if (e.type === 'cue' && e.kind === 'voyage2') seen.push('cue voyage2')
    }
  }
  assert.deepEqual(seen, ['ending', 'card ending', 'voyage 2', 'card voyage', 'cue voyage2'])
  assert.equal(w.voyage, 2)
  assert.ok(scoreAtEnding > 0 && w.score > scoreAtEnding, 'the score runs on')
  assert.equal(w.stats.sectorsCleared, 6)
  assert.ok(difficulty(1, 2) > difficulty(1, 1))
  assert.ok(boltSpeed(difficulty(1, 2)) > boltSpeed(difficulty(1, 1)))
  assert.ok(bossHp('knight', 2) > bossHp('knight', 1))
})
