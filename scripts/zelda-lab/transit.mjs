#!/usr/bin/env node
// Every frame of a turn between two views, measured: is the transition seamless?
//
//   CHROME_BIN=<chrome> node scripts/zelda-lab/transit.mjs <outDir> [round|pairs|hard] [--scene r-plaza] [--day dusk|sun]
//     [--size 1280|390] [--reduced] [--setup 'page js'] [--keep a-b]
//
// The views are the four of the round: 8 (classic), 16 (iso), 32 (poly), 64 (third, the poly engine with
// `THIRD_PERSON`). A change is made as the shell makes it (`Zelda.vue` `showView`): the engine's values first, then
// `setView`; between 32 and 64 only the values change (no turn: the view eases its own look). Per frame: mean light,
// the share of pixels changed since the last frame (> 6/255), the renderer's k, the hero's place on the screen (from
// the HUD's own idea, `__lab.hero`), draw time. Writes <outDir>/<mode>.json and eight frames of each step as PNGs.
//
// A seamless transition: no frame whose light jumps against its neighbours (`jump`: the largest step in mean light
// over the median step, and its size), no single frame of change far above its neighbours (`spike`: a frame whose
// change is over three times both neighbours' and over 8 %), nothing appears or vanishes in one frame.
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const [outArg, mode = 'round'] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--') || args[i - 1] === '--reduced')
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const SCENE = opt('scene', 'r-plaza')
const DAY = opt('day', 'dusk')
const SIZE = opt('size', '1280')
const REDUCED = args.includes('--reduced')
const SETUP = opt('setup', '')
// --keep a-b: every frame from a to b (the run's own count) as a full-size PNG as well.
const KEEP = (opt('keep', '') || '-1--1').split('-').map(Number)
const TAG = opt('tag', `${mode}-${SCENE}-${DAY}-${SIZE}${REDUCED ? '-reduced' : ''}`)
const [W, H, DPR] = SIZE === '390' ? [390, 844, 3] : [1280, 800, 1]
// (A frame drew the classic picture when the renderer's turn stands at 0 and no direct turn is under way: `classic` per row.)

const V = ['8', '16', '32', '64']
/** A step: the view to go to, and how many frames to record it for. */
const programs = {
  // (Each step long enough for its turn, 2 × 0.7 s, or the 32-bit look's easing, 1 s, to end before the next.)
  round: [['8', 20], ['16', 100], ['32', 100], ['64', 100], ['8', 100]],
  pairs: V.flatMap(a => V.filter(b => b !== a).map(b => [[`=${a}`, 30], [b, 70]])).flat(),
  // V again in the middle of a turn, each way.
  hard: [['=8', 20], ['32', 14], ['16', 60], ['=64', 30], ['8', 16], ['64', 60], ['=32', 30], ['64', 30], ['32', 60]],
  // The 64-bit camera turned away from north (the hero faces east, --setup), then the turn home: the picture comes back
  // to north as it goes down, and the controls with it (`turn` in each row: the renderer's `viewState().turn`).
  yaw: [['=64', 120], ['8', 100], ['64', 120], ['16', 100], ['64', 120], ['32', 100]],
  // Part 14: the 16-bit and the 32-bit look turn straight into each other (no classic picture between them), both ways,
  // and V in the middle of it; and the classic ↔ 16-bit turn beside it as the control.
  direct: [['=16', 20], ['32', 100], ['16', 100], ['32', 30], ['16', 100]],
  control: [['=8', 20], ['16', 100], ['8', 100]],
}
const program = programs[mode]
if (!program) { console.error('modes: round, pairs, hard, yaw, direct, control'); process.exit(2) }

execFileSync('node', [join(here, 'shot.mjs'), out, '__none__'], { stdio: 'ignore' })
const b = await launch({ width: W, height: H, dpr: DPR, mobile: SIZE === '390' })
await b.goto(`file://${join(out, '_shot.html')}#scene=${SCENE}&w=${W}&h=${H}&dpr=${DPR}&top=0&touch=0&views=all`)
for (let t = 0; t < 60 && (await b.eval('document.title')) !== 'ready'; t++) await b.sleep(250)
const day = DAY === 'dusk' ? `__lab.s.daytime = null` : `__lab.s.inv.prism = true; __lab.s.daytime = ${{ sun: 500, noon: 580, night: 230 }[DAY]}`
await b.eval(`${day}; __lab.ui.reducedMotion = ${REDUCED}; ${SETUP}; 0`)
const r = await b.eval(`(() => {
  const L = __lab
  const cv = document.querySelector('canvas')
  const g = cv.getContext('2d', { willReadFrequently: true })
  const Wc = cv.width, Hc = cv.height, N = Wc * Hc
  const go = (v, instant) => {
    // As the shell does: the engine's values first, then the turn (none between the two looks of one engine).
    if (v === '8') L.r.setView('classic', instant)
    else if (v === '16') L.r.setView('iso', instant)
    else { L.r.setParams('poly', v === '64' ? L.third : {}); L.r.setView('poly', instant) }
  }
  const prog = ${JSON.stringify(program)}
  const rows = [], thumbs = [], kept = []
  let prev = null, n = 0
  const c2 = document.createElement('canvas'); c2.width = 320; c2.height = Math.round(320 * Hc / Wc)
  const g2 = c2.getContext('2d')
  for (let s = 0; s < prog.length; s++) {
    const [to, frames] = prog[s]
    const instant = to.startsWith('=')
    go(to.replace('=', ''), instant)
    for (let f = 0; f < frames; f++, n++) {
      L.step(1)
      const t0 = performance.now()
      L.r.draw(L.s, L.ui, 1 / 60)
      const d = g.getImageData(0, 0, Wc, Hc).data
      const ms = performance.now() - t0
      let luma = 0, ch = 0
      for (let p = 0; p < d.length; p += 4) {
        luma += d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11
        if (prev && Math.max(Math.abs(d[p] - prev[p]), Math.abs(d[p + 1] - prev[p + 1]), Math.abs(d[p + 2] - prev[p + 2])) > 6) ch++
      }
      prev = d
      const vs = L.r.viewState()
      rows.push({ i: n, step: s, to, luma: +(luma / N / 255).toFixed(4), changed: +(ch / N).toFixed(4), k: +vs.k.toFixed(3), id: vs.id, turn: +vs.turn.toFixed(3), ms: +ms.toFixed(1), classic: vs.k <= 0 })
      if (n >= ${KEEP[0]} && n <= ${KEEP[1]}) kept.push({ i: n, url: cv.toDataURL('image/png') })
      if (!instant && (f % Math.max(1, Math.floor(frames / 8)) === 0) && thumbs.filter(t => t.step === s).length < 8) { g2.drawImage(cv, 0, 0, c2.width, c2.height); thumbs.push({ step: s, i: n, url: c2.toDataURL('image/png') }) }
    }
  }
  return { rows, thumbs, kept }
})()`)
if (b.errors.length) console.error(b.errors.slice(0, 3).join('\n'))
await b.close()
const rows = r.rows
const med = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0 }
// Per step that turns: the light's largest step against its median step, and the change's lone spikes.
const steps = []
for (let s = 0; s < program.length; s++) {
  const [to] = program[s]
  if (to.startsWith('=')) continue
  const q = rows.filter(x => x.step === s)
  const dl = q.slice(1).map((x, i) => Math.abs(x.luma - q[i].luma))
  const jump = Math.max(0, ...dl)
  const spikes = q.filter((x, i) => i > 0 && i < q.length - 1 && x.changed > 0.08 && x.changed > 3 * q[i - 1].changed && x.changed > 3 * q[i + 1].changed).map(x => x.i)
  const from = s > 0 ? program[s - 1][0].replace('=', '') : '?'
  const worst = q.slice(1).reduce((a, x) => x.changed > a.changed ? x : a, q[1] ?? q[0])
  steps.push({ from, to, jump: +jump.toFixed(4), jumpOverMedian: +(jump / Math.max(1e-4, med(dl))).toFixed(1), spikes, lumaFrom: q[0].luma, lumaTo: q.at(-1).luma, frames: q.length, maxMs: Math.max(...q.map(x => x.ms)), classic: q.filter(x => x.classic).length, worstChanged: worst.changed, worstAt: worst.i })
}
for (const s of steps) console.log(`${s.from.padStart(2)} → ${s.to.padStart(2)}  light ${s.lumaFrom.toFixed(3)} → ${s.lumaTo.toFixed(3)}  largest step ${s.jump.toFixed(4)} (${s.jumpOverMedian}× median)  spikes ${s.spikes.length ? s.spikes.join(',') : 'none'}  worst change ${(s.worstChanged * 100).toFixed(1)} % at ${s.worstAt}  classic frames ${s.classic}  max ${s.maxMs} ms`)
writeFileSync(join(out, `${TAG}.json`), JSON.stringify({ rows, steps, program }))
r.kept.forEach(t => writeFileSync(join(out, `${TAG}-f${String(t.i).padStart(4, '0')}.png`), Buffer.from(t.url.split(',')[1], 'base64')))
r.thumbs.forEach(t => writeFileSync(join(out, `${TAG}-s${String(t.step).padStart(2, '0')}-${String(t.i).padStart(4, '0')}.png`), Buffer.from(t.url.split(',')[1], 'base64')))
