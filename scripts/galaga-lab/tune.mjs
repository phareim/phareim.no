#!/usr/bin/env node
// Space Voyagers lab: the tuning table. Three autopilot profiles fly a first voyage on 12 seeds
// at one or both field heights, and one line a profile says what the tuning targets ask about:
// how far they get, hits taken in each sector, tows, captures and docks, pick-ups, DUETs, score.
//
//   node scripts/galaga-lab/tune.mjs            # 320 and 432, a summary line each
//   node scripts/galaga-lab/tune.mjs 320 rows   # every seed's row as well
//
// One process a profile and height (they are independent), so it takes about as long as one.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const SEEDS = 12
const PROFILES = ['full', 'casual', 'clumsy']
const self = fileURLToPath(import.meta.url)

if (process.argv[2] === 'worker') {
  const [, , , name, heightArg] = process.argv
  const { createWorld, step } = await import('../../themes/galaga/engine/index.ts')
  const { createAutopilot, autopilot, CASUAL, CLUMSY } = await import('../../themes/galaga/engine/autopilot.ts')
  const opts = { full: {}, casual: CASUAL, clumsy: CLUMSY }[name]
  const height = +heightArg
  const rows = []
  const causes = {}
  for (let seed = 1; seed <= SEEDS; seed++) {
    const w = createWorld({ seed, height })
    const ap = createAutopilot(opts)
    const hits = [0, 0, 0, 0, 0]
    let before = 0
    let friends = 0, passes = 0, duoPops = 0, duoWave = 0, duoRuns = 0, duoNow = false, limps = 0
    while (!w.over && w.voyage === 1 && w.tick < 30 * 3600) {
      const sector = w.sector
      const stage = w.stage === 'boss' ? `boss ${w.boss.id}` : w.stage
      step(w, autopilot(ap, w))
      if (w.stats.hits > before) {
        // What was it? The nearest thing to the cockpit this tick.
        const p = w.player
        let what = 'zone'
        let best = 1e9
        for (const b of w.bolts) if (b.active || true) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < best && d < 14) { best = d; what = b.kind === 'bolt' ? 'bolt' : b.kind } }
        for (const e of w.enemies) { const d = Math.hypot(e.x - p.x, e.y - p.y); if ((e.active || d < 4) && d < best && d < 22) { best = d; what = `body ${e.role}${e.state === 'free' ? ' free' : ''}` } }
        const key = `${stage.padEnd(14)} ${what}`
        causes[key] = (causes[key] ?? 0) + 1
      }
      hits[sector - 1] += w.stats.hits - before
      before = w.stats.hits
      for (const e of w.events) {
        if (e.type === 'friend') friends++
        else if (e.type === 'pass') passes++
        else if (e.type === 'limp') limps++
        else if (e.type === 'duoIn') { duoNow = true; duoRuns++; duoWave += w.waveLeft + w.duo.quota * 0 }
        else if (e.type === 'duoOut') duoNow = false
        else if (e.type === 'pop' && duoNow && e.n === 0) duoPops++
      }
    }
    rows.push({
      seed, done: w.voyage > 1, over: w.over, sectors: w.stats.sectorsCleared, at: `${w.sector} ${w.stage}${w.stage === 'wave' ? w.wave : ''}`,
      minutes: w.tick / 3600, score: w.score, hits, tows: w.stats.tows, friends, passes, captures: w.stats.captures, docks: w.stats.docks,
      picks: w.stats.picks, duets: w.stats.duets, duoPops, duoWave, duoRuns, limps,
    })
  }
  process.stdout.write(JSON.stringify({ rows, causes }))
  process.exit(0)
}

const heights = process.argv[2] && process.argv[2] !== 'rows' ? [+process.argv[2]] : [320, 432]
const showRows = process.argv.includes('rows')
const run = (name, height) => new Promise(resolve => {
  const p = spawn(process.execPath, ['--no-warnings', self, 'worker', name, String(height)], { stdio: ['ignore', 'pipe', 'inherit'] })
  let out = ''
  p.stdout.on('data', d => { out += d })
  p.on('close', () => resolve({ name, height, ...JSON.parse(out || '{"rows":[],"causes":{}}') }))
})
const jobs = []
for (const height of heights) for (const name of PROFILES) jobs.push(run(name, height))
const mean = (rows, f) => rows.reduce((a, r) => a + f(r), 0) / Math.max(1, rows.length)
const showCauses = process.argv.includes('causes')
for (const { name, height, rows, causes } of await Promise.all(jobs)) {
  if (showCauses) console.log(`\n${name} ${height}: what hit, by stage\n` + Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${String(v).padStart(3)}  ${k}`).join('\n'))
  if (showRows) {
    console.log(`\n${name.toUpperCase()}, field 240 x ${height}\nseed result  sectors stopped     min    score   hits by sector  tows capt dock picks duets friends`)
    for (const r of rows) {
      console.log([
        String(r.seed).padStart(4), (r.done ? 'ENDING' : r.over ? 'OVER' : 'TIME').padEnd(7), String(r.sectors).padStart(7), r.at.padEnd(9),
        r.minutes.toFixed(1).padStart(6), String(r.score).padStart(8), r.hits.join(' ').padStart(15), String(r.tows).padStart(5),
        String(r.captures).padStart(4), String(r.docks).padStart(4), String(r.picks).padStart(5), String(r.duets).padStart(5), String(r.friends).padStart(7),
      ].join(' '))
    }
  }
  const done = rows.filter(r => r.done)
  const n = rows.length
  // Hits in a sector are averaged over the runs that got there.
  const hits = [0, 1, 2, 3, 4].map(i => { const got = rows.filter(r => r.sectors >= i); return got.length ? (got.reduce((a, r) => a + r.hits[i], 0) / got.length).toFixed(1) : '-' })
  const duo = rows.reduce((a, r) => a + r.duoWave, 0)
  console.log(
    `${name.padEnd(6)} ${height}: finished ${done.length}/${n}, sector 1 ${rows.filter(r => r.sectors >= 1).length}, reached sector 3 ${rows.filter(r => r.sectors >= 2).length}, sector 5 ${rows.filter(r => r.sectors >= 4).length}` +
    ` | hits ${hits.join(' ')} | a tow on ${rows.filter(r => r.tows > 0).length}, two on ${rows.filter(r => r.tows > 1).length}, in sector 1 at most ${Math.max(...rows.map(r => r.sectors >= 1 ? 0 : r.tows))}` +
    ` | captured on ${rows.filter(r => r.captures > 0).length} (${mean(rows, r => r.captures).toFixed(1)} a run), dock on ${rows.filter(r => r.docks > 0).length}, limps ${mean(rows, r => r.limps).toFixed(1)}` +
    ` | finished runs: ${mean(done, r => r.picks).toFixed(0)} picks, ${mean(done, r => r.duets).toFixed(1)} duets, ${Math.round(mean(done, r => r.score) / 1000)}k (${done.length ? Math.round(Math.min(...done.map(r => r.score)) / 1000) : 0}-${done.length ? Math.round(Math.max(...done.map(r => r.score)) / 1000) : 0}k), ${mean(done, r => r.minutes).toFixed(1)} min, passes ${mean(done, r => r.passes).toFixed(1)}/${mean(done, r => r.friends).toFixed(1)}` +
    ` | duo ${duo ? Math.round(100 * rows.reduce((a, r) => a + r.duoPops, 0) / duo) : 0}% of the wave`,
  )
}
