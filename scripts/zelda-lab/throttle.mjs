#!/usr/bin/env node
// A polygon look on a slow phone: the lab page at a phone's 390 × 844 (dpr 3) with Chrome's CPU throttled
// (`Emulation.setCPUThrottlingRate`), drawing as the page does, one frame after another with the event loop between,
// the governor live (or pinned at the top of its ladder, --pin). Per frame: the main thread's time for the game's
// step and the view's draw, the gap since the frame before (what the governor sees), and the step it is on.
//
//   CHROME_BIN=<chrome> node scripts/zelda-lab/throttle.mjs <outDir> [--look 32|64] [--scene r-plaza|w-camp]
//     [--move stand|walk] [--rate 4] [--seconds 10] [--pin] [--sync] [--size 390|1280] [--params '{…}'] [--tag name]
//
// --sync reads one pixel back after every draw, so the frame's time includes the GPU's (the picture finished).
// Where the page offers it (EXT_disjoint_timer_query_webgl2), the polygons' own GPU time is timed too (`timeGpu`).
// Writes <outDir>/<tag>.json (every frame, the governor's trace) and <tag>.png (the picture it settled on).
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const flag = name => args.includes(`--${name}`)
const out = resolve(args.find((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--') || ['--pin', '--sync'].includes(args[i - 1] ?? '')) ?? 'tmp/throttle')
mkdirSync(out, { recursive: true })
const LOOK = opt('look', '32'), SCENE = opt('scene', 'r-plaza'), MOVE = opt('move', 'stand'), RATE = +opt('rate', '4')
const PARAMS = opt('params', '{}')
const SECONDS = +opt('seconds', '10'), PIN = flag('pin'), SYNC = flag('sync'), SIZE = opt('size', '390')
const TAG = opt('tag', `${LOOK}-${SCENE}-${MOVE}-x${RATE}${PIN ? '-pinned' : ''}${SYNC ? '-sync' : ''}-${SIZE}`)

const [W, H, DPR] = SIZE === '390' ? [390, 844, 3] : [1280, 800, 1]

execFileSync('node', [join(here, 'shot.mjs'), out, '__none__'], { stdio: 'ignore' })
const b = await launch({ width: W, height: H, dpr: DPR, mobile: SIZE === '390' })
await b.goto(`file://${join(out, '_shot.html')}#scene=${SCENE}&w=${W}&h=${H}&dpr=${DPR}&top=0&touch=0&views=all`)
for (let t = 0; t < 60 && (await b.eval('document.title')) !== 'ready'; t++) await b.sleep(250)
// The view as on the page: the governor live (or pinned), its stretches built in slices.
await b.eval(`(() => {
  const L = __lab
  __pinPoly(${PIN ? 'true' : 'null'})
  if (window.__timeGpu) __timeGpu(true)
  L.s.daytime = null
  L.r.setParams('poly', { ...${LOOK === '64' ? 'L.third' : '{}'}, ...${PARAMS} }); L.r.setView('poly', true)
  ${SCENE === 'r-plaza' ? "L.s.hero.x = 15.5; L.s.hero.y = 17.5; L.s.hero.dir = 'up'" : ''}
  for (let i = 0; i < 30; i++) { L.step(1); L.r.draw(L.s, L.ui, 1 / 60) }
  return 0
})()`)
await b.send('Emulation.setCPUThrottlingRate', { rate: RATE })
const r = await b.eval(`new Promise(done => {
  const L = __lab, cv = document.querySelector('canvas'), g = cv.getContext('2d', { willReadFrequently: true })
  const rows = []
  const t0 = performance.now()
  let last = 0, n = 0
  const traceFrom = (window.__polyGov || []).length
  // (Walking: up and down a stretch of the square, or the camp, a few seconds each way.)
  const move = n => ${MOVE === 'walk' ? "(Math.floor(n / 150) % 2 ? { x: 0, y: 1 } : { x: 0, y: -1 })" : '({ x: 0, y: 0 })'}
  const frame = () => {
    const a = performance.now()
    L.step(1, L.inp({ move: move(n) }))
    L.r.draw(L.s, L.ui, 1 / 60)
    const drawn = performance.now()
    if (${SYNC}) g.getImageData(0, 0, 1, 1)
    const b = performance.now()
    const tr = (window.__polyGov || [])
    rows.push({ gpu: window.__gpuMs ? __gpuMs() : null, t: +(a - t0).toFixed(1), main: +(drawn - a).toFixed(2), sync: +(b - a).toFixed(2), gap: last ? +(a - last).toFixed(1) : 0, step: tr.length > traceFrom ? tr[tr.length - 1][1] : (tr.length ? tr[tr.length - 1][1] : 0) })
    last = a
    n++
    if (a - t0 < ${SECONDS * 1000}) setTimeout(frame, 0)
    else done({ rows, trace: (window.__polyGov || []).slice(traceFrom), pic: cv.toDataURL('image/png') })
  }
  setTimeout(frame, 0)
})`)
await b.send('Emulation.setCPUThrottlingRate', { rate: 1 })
if (b.errors.length) console.error(b.errors.slice(0, 3).join('\n'))
await b.close()
writeFileSync(join(out, `${TAG}.png`), Buffer.from(r.pic.split(',')[1], 'base64'))
const rows = r.rows
// Settled: from two seconds after the governor's last step (or the start) to the end.
const lastStep = r.trace.length ? r.trace[r.trace.length - 1][0] : 0
const settledRows = rows.filter(x => x.t > Math.max(2000, lastStep - (rows[0]?.t ?? 0) + 2000))
const stat = (a, k) => { const v = a.map(x => x[k]).sort((p, q) => p - q); return { mean: +(v.reduce((p, q) => p + q, 0) / (v.length || 1)).toFixed(1), p95: v[Math.floor(v.length * 0.95)] ?? 0, worst: v.at(-1) ?? 0, over: v.filter(x => x > 16.7).length, n: v.length } }
const first = stat(rows.slice(0, 60), 'main'), settled = stat(settledRows, 'main'), settledSync = stat(settledRows, 'sync')
const gpuRows = settledRows.filter(x => x.gpu != null)
const gpu = gpuRows.length ? stat(gpuRows, 'gpu') : null
const res = { gpu, tag: TAG, look: LOOK, scene: SCENE, move: MOVE, rate: RATE, pinned: PIN, frames: rows.length, trace: r.trace.map(([t, s, m]) => [+(t).toFixed(0), s, +m.toFixed(1)]), first, settled, settledSync, finalStep: rows.at(-1)?.step ?? 0, rows }
writeFileSync(join(out, `${TAG}.json`), JSON.stringify(res))
console.log(`${TAG.padEnd(40)} frames ${String(rows.length).padStart(4)}  first 60: main ${first.mean} ms  settled (step ${res.finalStep}): main ${settled.mean} p95 ${settled.p95} worst ${settled.worst} >16.7: ${settled.over}/${settled.n}${SYNC ? `  with GPU ${settledSync.mean} p95 ${settledSync.p95}` : ''}${gpu ? `  GL on the GPU ${gpu.mean} ms p95 ${gpu.p95}` : ''}  trace ${JSON.stringify(res.trace)}`)
