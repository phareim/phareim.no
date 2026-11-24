#!/usr/bin/env node
// The steadiness meter: consecutive frames of a view, drawn at 1/60 s with the game's clock running, read back and
// measured. The tool the polygon views' steadiness, transitions and light are judged by (docs/games/neon-shrine.md,
// "The polygon view", "Steadiness").
//
//   CHROME_BIN=<chrome> node scripts/zelda-lab/steady.mjs <outDir> <case,case…> [--views classic,iso,poly,third]
//     [--day dusk|sun|night|noon|dawn] [--frames 90] [--freeze] [--params '{…}'] [--size 1280|390] [--tag name]
//
// Per pair of consecutive frames: `changed`, the share of pixels whose largest channel moved by more than 6 of 255
// (one 15-bit step is 8.2). Per three frames: `shimmer`, the temporal second difference of each pixel's light,
// |f(n−1) − 2·f(n) + f(n+1)|, which is near zero for steady motion and large for a pixel that goes and comes back
// (its mean, of 255, and the share of pixels over 12). Per frame: mean light, the hero's place on the screen (the
// camera's own steadiness), draw time (the view's draw and the read-back, ms).
// --day: dusk is the eternal dusk of a save without the Sun Prism (no hour); sun is a solved save's real sun, the
// hour running from just before noon; night, noon, dawn start the running hour there.
// --freeze holds every lamp's strength (`freezeLamps` in poly/lamps.ts): the control for the lamps' own flicker.
// Writes <outDir>/<tag>.json, and for each case and view the middle frame and the shimmer picture.
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const flag = name => args.includes(`--${name}`)
const pos = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--') || (args[i - 1] === '--freeze'))
const [outArg, only] = pos
if (!outArg || !only) { console.error('usage: steady.mjs <outDir> <cases> [--views …] [--day …] [--frames n] [--freeze] [--size 1280|390]'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const VIEWS = opt('views', 'classic,iso,poly,third').split(',')
const FRAMES = +opt('frames', '90')
const DAY = opt('day', 'dusk')
const FREEZE = flag('freeze')
const PARAMS = opt('params', '')
const SIZE = opt('size', '1280')
const TAG = opt('tag', `${DAY}${FREEZE ? '-frozen' : ''}-${SIZE}`)

// A case: the lab scene, page JS run once to set it up, and a program of [frames, move] steps.
const UP = { x: 0, y: -1 }, RIGHT = { x: 1, y: 0 }, LEFT = { x: -1, y: 0 }, DOWN = { x: 0, y: 1 }, STILL = { x: 0, y: 0 }
const PLAZA = `__lab.s.hero.x = 15.5; __lab.s.hero.y = 16.5; __lab.s.hero.dir = 'up'`
const CASES = {
  'plaza-stand': ['r-plaza', PLAZA, [[90, STILL]]],
  'plaza-walk': ['r-plaza', PLAZA, [[90, RIGHT]]],
  // North, where no view's camera turns: the fair walk for shimmer (east, the 64-bit camera swings round as well).
  'plaza-north': ['r-plaza', `__lab.s.hero.x = 15.5; __lab.s.hero.y = 17.5; __lab.s.hero.dir = "up"`, [[90, UP]]],
  'plaza-turn': ['r-plaza', PLAZA, [[40, RIGHT], [50, UP]]],
  // The 64-bit camera swinging in behind the hero: a walk east, then standing while it drifts round.
  'plaza-swing': ['r-plaza', PLAZA, [[30, RIGHT], [80, STILL]]],
  'camp-stand': ['w-camp', ``, [[90, STILL]]],
  // Standing by a lamp on the square (part 10): its pool must neither pop nor crawl.
  'lamp-stand': ['r-plaza', `__lab.s.hero.x = 18.5; __lab.s.hero.y = 12.6; __lab.s.hero.dir = 'up'`, [[90, STILL]]],
  'camp-walk': ['w-camp', ``, [[90, UP]]],
  'camp-east': ['w-camp', ``, [[90, RIGHT]]],
  'camp-west': ['w-camp', ``, [[90, LEFT]]],
  'camp-south': ['w-camp', ``, [[90, DOWN]]],
  'beach-stand': ['r-beach', `__lab.s.hero.dir = 'up'`, [[90, STILL]]],
  'beach-walk': ['r-beach', ``, [[90, RIGHT]]],
  'shrine-stand': ['entry', ``, [[90, STILL]]],
  'shrine-walk': ['entry', ``, [[90, UP]]],
  'lab-stand': ['l-lobby', ``, [[90, STILL]]],
  'lab-walk': ['l-lobby', ``, [[90, UP]]],
}
const SIZES = { 1280: [1280, 800, 1], 390: [390, 844, 3] }
const [W0, H0, DPR] = SIZES[SIZE]
const HOUR = { dusk: null, sun: 500, noon: 580, night: 230, dawn: 400 }[DAY]

execFileSync('node', [join(here, 'shot.mjs'), out, '__none__'], { stdio: 'ignore' })

const MEASURE = `
window.__steady = (program, keep) => {
  const cv = document.querySelector('canvas')
  const W = cv.width, H = cv.height, N = W * H
  const g = cv.getContext('2d', { willReadFrequently: true })
  const ring = []
  const rows = []
  let shimPic = null, mid = null
  const T = 6
  let n = 0
  const total = program.reduce((a, p) => a + p[0], 0)
  for (const [frames, move] of program) for (let f = 0; f < frames; f++, n++) {
    __lab.step(1, __lab.inp({ move }))
    const t0 = performance.now()
    __lab.r.draw(__lab.s, __lab.ui, 1 / 60)
    const d = g.getImageData(0, 0, W, H).data
    const ms = performance.now() - t0
    const L = new Float32Array(N)
    let luma = 0
    for (let p = 0, i = 0; p < d.length; p += 4, i++) { const l = d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11; L[i] = l; luma += l }
    ring.push({ d, L })
    if (ring.length > 3) ring.shift()
    const row = { i: n, ms: +ms.toFixed(2), luma: +(luma / N / 255).toFixed(4), changed: 0, shimmer: 0, shimHi: 0, hx: 0, hy: 0, k: __lab.r.viewState().k }
    if (ring.length >= 2) {
      const a = ring[ring.length - 2].d, b = ring[ring.length - 1].d
      let ch = 0
      for (let p = 0; p < b.length; p += 4) if (Math.max(Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2])) > T) ch++
      row.changed = +(ch / N).toFixed(4)
    }
    if (ring.length === 3) {
      const z = ring[0].L, a = ring[1].L, b = ring[2].L
      let sum = 0, hi = 0
      const want = keep && n === Math.floor(total / 2)
      const pic = want ? new ImageData(W, H) : null
      for (let i = 0; i < N; i++) {
        const s2 = Math.abs(z[i] - 2 * a[i] + b[i])
        sum += s2
        if (s2 > 12) hi++
        if (pic) { const v = Math.min(255, s2 * 4); pic.data[i * 4] = v; pic.data[i * 4 + 1] = v * 0.4; pic.data[i * 4 + 2] = a[i] * 0.25; pic.data[i * 4 + 3] = 255 }
      }
      row.shimmer = +(sum / N).toFixed(3)
      row.shimHi = +(hi / N).toFixed(4)
      if (pic) {
        const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
        const g2 = c2.getContext('2d')
        g2.putImageData(pic, 0, 0); shimPic = c2.toDataURL('image/png')
        g2.putImageData(new ImageData(new Uint8ClampedArray(ring[1].d), W, H), 0, 0); mid = c2.toDataURL('image/png')
      }
    }
    rows.push(row)
  }
  return { W, H, rows, shimPic, mid }
}
0`

const stat = a => {
  const s = [...a].sort((x, y) => x - y)
  return { med: s[s.length >> 1] ?? 0, mean: s.reduce((x, y) => x + y, 0) / (s.length || 1), p95: s[Math.floor(s.length * 0.95)] ?? 0, max: s.at(-1) ?? 0 }
}
const results = []
for (const name of only.split(',')) {
  const c = CASES[name]
  if (!c) { console.error(`no case ${name}`); continue }
  const [scene, setup, program] = c
  for (const view of VIEWS) {
    const b = await launch({ width: W0, height: H0, dpr: DPR, mobile: SIZE === '390' })
    const v = view === 'classic' ? '' : `&view=${view}`
    await b.goto(`file://${join(out, '_shot.html')}#scene=${scene}&w=${W0}&h=${H0}&dpr=${DPR}&top=0&touch=0${v}${PARAMS ? `&params=${encodeURIComponent(PARAMS)}` : ''}`)
    for (let t = 0; t < 60 && (await b.eval('document.title')) !== 'ready'; t++) await b.sleep(250)
    const day = HOUR === null ? `__lab.s.daytime = null` : `__lab.s.inv.prism = true; __lab.s.daytime = ${HOUR}`
    // (Two seconds after the set-up, standing: the camera, the lamps and the land have settled.)
    await b.eval(`${day}; ${setup}; if (window.__freezeLamps) __freezeLamps(${FREEZE}); for (let k = 0; k < 120; k++) { __lab.step(1); __lab.r.draw(__lab.s, __lab.ui, 1 / 60) } 0`)
    await b.eval(MEASURE)
    const r = await b.eval(`__steady(${JSON.stringify(program)}, true)`)
    if (b.errors.length) console.error(`${name} ${view}: ${b.errors.slice(0, 3).join(' | ')}`)
    await b.close()
    const rows = r.rows
    const ch = stat(rows.slice(1).map(q => q.changed))
    const sh = stat(rows.slice(2).map(q => q.shimmer))
    const shHi = stat(rows.slice(2).map(q => q.shimHi))
    const ms = stat(rows.map(q => q.ms))
    const row = {
      name, view, day: DAY, frozen: FREEZE, size: SIZE,
      changedMed: +ch.med.toFixed(4), changedMax: +ch.max.toFixed(4),
      shimmerMean: +sh.mean.toFixed(3), shimHiMean: +shHi.mean.toFixed(4),
      lumaMin: Math.min(...rows.map(q => q.luma)), lumaMax: Math.max(...rows.map(q => q.luma)),
      msMean: +ms.mean.toFixed(1), msP95: +ms.p95.toFixed(1), msMax: +ms.max.toFixed(1), over20: rows.filter(q => q.ms > 20).length,
      rows,
    }
    results.push(row)
    const base = `${name}-${view}-${TAG}`
    if (r.mid) writeFileSync(join(out, `${base}-mid.png`), Buffer.from(r.mid.split(',')[1], 'base64'))
    if (r.shimPic) writeFileSync(join(out, `${base}-shim.png`), Buffer.from(r.shimPic.split(',')[1], 'base64'))
    console.log(`${name.padEnd(13)} ${view.padEnd(7)} ${DAY.padEnd(5)} changed med ${(row.changedMed * 100).toFixed(2).padStart(6)} %  shimmer ${row.shimmerMean.toFixed(2).padStart(5)} (>12: ${(row.shimHiMean * 100).toFixed(2)} %)  luma ${row.lumaMin.toFixed(3)}–${row.lumaMax.toFixed(3)}  ms ${row.msMean} p95 ${row.msP95} max ${row.msMax}`)
  }
}
writeFileSync(join(out, `${TAG}.json`), JSON.stringify(results))
