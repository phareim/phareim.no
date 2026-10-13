// The voyage runner for galaga-voyage*.test.mjs: one autopilot voyage per seed, and the table each run prints.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, step } from '../themes/galaga/engine/index.ts'
import { createAutopilot, autopilot } from '../themes/galaga/engine/autopilot.ts'

export const SEEDS = 12
export const LIMIT = 30 * 60 * 60

/** Fly one voyage; returns how far it got and what it cost, sector by sector. */
export function voyage(seed, height, opts = {}) {
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

export function table(title, rows) {
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

/** The first voyage at one field height, as its own test file: each height runs in its own process. */
export function firstVoyageAt(height) {
  test(`the voyage at ${height}: 12 seeds, sector 1 cleared on at least 10, the ending reached on some`, () => {
    const rows = []
    for (let seed = 1; seed <= SEEDS; seed++) rows.push(voyage(seed, height))
    table(`AUTOPILOT, field 240 x ${height}`, rows)
    assert.ok(rows.filter(r => r.sectors >= 1).length >= 10, 'sector 1 cleared on at least 10 of 12')
    assert.ok(rows.some(r => r.done), 'the first voyage is finished on some seeds')
    for (const r of rows.filter(x => x.done)) assert.ok(r.ending && r.sectors === 5)
    const first = rows.reduce((a, r) => a + r.hits[0], 0) / rows.length
    assert.ok(first <= 2, `sector 1 is gentle: ${first.toFixed(2)} hits a run`)
  })
}
