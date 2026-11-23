#!/usr/bin/env node
// Consecutive frames of a walk, measured: does the picture flash?
//
//   CHROME_BIN=<chrome> node scripts/zelda-lab/walk-flicker.mjs <outDir> [case,case…] [--views classic,iso,poly] [--frames 72] [--pin 0|1] [--check]
//
// A case is a place and a direction held (CASES below), at the lab's 1280 × 800
// or a phone's 390 × 844 at dpr 3 (names ending -390). For each view the hero
// walks one game step a frame and every frame is drawn and read back. Per pair
// of consecutive frames: the share of the picture that changed by more than a
// small threshold (`changed`); per three frames: the share that changed and
// changed back (`flip`: a pixel A, B, A is a flash, a scroll seldom does that);
// and frames whose mean light falls well under the walk's (`dark`). The worst
// three frames of each walk and a difference picture (red: flipped, grey:
// changed) are written to <outDir>/<case>-<view>-*.png, the numbers to
// <outDir>/walk.json.
//
// --pin 0 leaves the polygon view's quality to its governor and its slices
// (as on the page); the default pins it, as the lab's stills do.
// --check fails (exit 1) when the polygon view has a dark frame in any case,
// or when, with the hero standing still (the *-stand cases), more than
// STILL_MAX of its picture changes from one frame to the next (the median over
// the frames): on master of 2026-11-23, whose lamps flickered through the
// dither, that was 3 to 4 % on the square, in the shrine and by the zappers;
// steady, it is under 0.7 %, as the classic view's 0.1 to 0.8 %. Standing still,
// no single frame may change more than FLASH_MAX of the picture either.
//
// The day-* cases play a save that has the Sun Prism home, the day running from
// an hour (noon, dawn, night), with the view's quality and its geometry budget
// left to the page's own rules (pin 0, whatever --pin says): the pinned lab
// builds every stretch in one go and cannot show one missing. On master of
// 2026-11-23 (df37d03) the view took every step of the hour's sun for a new map
// and dropped its stretches, so the ground and all on it went missing several
// times a second (frames with a third of the picture changed, standing still).
//
//   CHROME_BIN=<chrome> node scripts/zelda-lab/walk-flicker.mjs tmp/flicker/check plaza-stand-1280,shrine-stand-1280,zapper-stand-1280,plaza-stand-390,plaza-up-1280,day-noon-stand-1280,day-dawn-stand-1280,day-night-stand-1280,day-noon-stand-390,day-noon-up-1280 --views poly --check
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def }
const flagOn = name => args.includes(`--${name}`)
const pos = args.filter((a, i) => !a.startsWith('--') && !['--views', '--frames', '--pin', '--threshold', '--params'].includes(args[i - 1]))
const [outArg, only] = pos
if (!outArg) { console.error('usage: walk-flicker.mjs <outDir> [cases] [--views classic,iso,poly] [--frames 72] [--pin 0|1] [--check]'); process.exit(2) }
const out = resolve(outArg)
const VIEWS = opt('views', 'classic,iso,poly').split(',')
const FRAMES = +opt('frames', '72')
const PIN = opt('pin', '1')
const CHECK = flagOn('check')
/** An engine's values for every view walked (`viewParams.ts`), e.g. '{"daytime":"night"}'. */
const PARAMS = opt('params', '')
/** How much a channel must change (of 255) for a pixel to count as changed: 6 catches one step of the 15-bit colours. */
const THRESHOLD = +opt('threshold', '6')
/** The share of the picture that may change from one frame to the next with nobody moving (median of the frames). */
const STILL_MAX = 0.015
/** The share of the picture a single frame may change with nobody moving. */
const FLASH_MAX = 0.1

// [name, scene, w, h, dpr, setup (page JS run once before the walk), move, pin (none: --pin)]
const UP = { x: 0, y: -1 }
const DOWN = { x: 0, y: 1 }
const RIGHT = { x: 1, y: 0 }
const LEFT = { x: -1, y: 0 }
const STILL = { x: 0, y: 0 }
const BASE = [
  ['plaza-stand', 'r-plaza', `__lab.s.hero.x -= 5; __lab.s.hero.y += 8.5; __lab.s.hero.dir = 'up'`, STILL],
  ['wild-stand', 'w-camp', ``, STILL],
  ['room-stand', 'd-room11', `__lab.s.hero.y += 4`, STILL],
  ['shrine-stand', 'entry', ``, STILL],
  ['zapper-stand', 'r-plaza', `__lab.s.hero.x = 95.5; __lab.s.hero.y = 13.5; __lab.s.hero.dir = 'up'`, STILL],
  ['plaza-up', 'r-plaza', `__lab.s.hero.x -= 5; __lab.s.hero.y += 8.5; __lab.s.hero.dir = 'up'`, UP],
  ['plaza-right', 'r-plaza', `__lab.s.hero.x -= 6; __lab.s.hero.y += 3; __lab.s.hero.dir = 'right'`, RIGHT],
  ['road-right', 'r-road', `__lab.s.hero.x -= 8`, RIGHT],
  ['lake-left', 'lake', ``, LEFT],
  ['wild-up', 'w-camp', ``, UP],
  ['room-up', 'd-room11', `__lab.s.hero.y += 4`, UP],
  ['room-right', 'd-room11', `__lab.s.hero.x -= 3; __lab.s.hero.y += 2`, RIGHT],
  ['shrine-up', 'entry', ``, UP],
  // The day running (the Sun Prism home), from an hour, on the square.
  ...[['noon', 580], ['dawn', 430], ['night', 230]].map(([h, t]) => [`day-${h}-stand`, 'r-plaza', `__lab.s.inv.prism = true; __lab.s.daytime = ${t}; __lab.s.hero.x -= 5; __lab.s.hero.y += 8.5; __lab.s.hero.dir = 'up'`, STILL, '0']),
  ['day-noon-up', 'r-plaza', `__lab.s.inv.prism = true; __lab.s.daytime = 580; __lab.s.hero.x -= 5; __lab.s.hero.y += 8.5; __lab.s.hero.dir = 'up'`, UP, '0'],
]
const CASES = [
  ...BASE.map(([n, sc, setup, mv, pin]) => [`${n}-1280`, sc, 1280, 800, 1, setup, mv, pin]),
  ...BASE.map(([n, sc, setup, mv, pin]) => [`${n}-390`, sc, 390, 844, 3, setup, mv, pin]),
]
const want = only ? new Set(only.split(',')) : null

// The shot page and its bundle (no shot: the scene list matches nothing).
execFileSync('node', [join(here, 'shot.mjs'), out, '__none__'], { stdio: 'ignore' })

const MEASURE = `
window.__walk = (n, move, keep) => {
  const cv = document.querySelector('canvas')
  const W = cv.width, H = cv.height, N = W * H
  const g = cv.getContext('2d', { willReadFrequently: true })
  const ring = []
  const stats = []
  let worst = { flip: -1, i: -1, frames: null }
  const T = ${THRESHOLD}
  for (let i = 0; i < n; i++) {
    __lab.step(1, __lab.inp({ move }))
    __lab.r.draw(__lab.s, __lab.ui, 1 / 60)
    const d = g.getImageData(0, 0, W, H).data
    let luma = 0
    for (let p = 0; p < d.length; p += 16) luma += d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11
    luma /= N / 4 * 255
    ring.push(d)
    if (ring.length > 3) ring.shift()
    const st = { i, luma, changed: 0, flip: 0, k: __lab.r.viewState().k, waiting: __lab.r.viewState().waiting, x: __lab.s.hero.x, y: __lab.s.hero.y }
    if (ring.length >= 2) {
      const a = ring[ring.length - 2], b = ring[ring.length - 1], z = ring.length === 3 ? ring[0] : null
      let ch = 0, fl = 0
      for (let p = 0; p < b.length; p += 4) {
        const dab = Math.max(Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2]))
        if (dab > T) {
          ch++
          if (z) {
            const dza = Math.max(Math.abs(z[p] - a[p]), Math.abs(z[p + 1] - a[p + 1]), Math.abs(z[p + 2] - a[p + 2]))
            const dzb = Math.max(Math.abs(z[p] - b[p]), Math.abs(z[p + 1] - b[p + 1]), Math.abs(z[p + 2] - b[p + 2]))
            if (dza > T && dzb <= T / 2) fl++
          }
        }
      }
      st.changed = ch / N
      st.flip = fl / N
      if (z && i > 4 && st.flip > worst.flip) worst = { flip: st.flip, i, frames: ring.slice() }
    }
    stats.push(st)
  }
  // The worst three frames and their difference picture, as PNGs.
  const pics = []
  if (keep && worst.frames) {
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H
    const g2 = c2.getContext('2d')
    for (const f of worst.frames) { g2.putImageData(new ImageData(new Uint8ClampedArray(f), W, H), 0, 0); pics.push(c2.toDataURL('image/png')) }
    const [z, a, b] = worst.frames
    const im = new ImageData(W, H)
    const o = im.data
    for (let p = 0; p < b.length; p += 4) {
      const dab = Math.max(Math.abs(a[p] - b[p]), Math.abs(a[p + 1] - b[p + 1]), Math.abs(a[p + 2] - b[p + 2]))
      const dzb = Math.max(Math.abs(z[p] - b[p]), Math.abs(z[p + 1] - b[p + 1]), Math.abs(z[p + 2] - b[p + 2]))
      const dza = Math.max(Math.abs(z[p] - a[p]), Math.abs(z[p + 1] - a[p + 1]), Math.abs(z[p + 2] - a[p + 2]))
      const l = (b[p] * 0.3 + b[p + 1] * 0.59 + b[p + 2] * 0.11) * 0.25
      if (dab > T && dza > T && dzb <= T / 2) { o[p] = 255; o[p + 1] = 40; o[p + 2] = 40 }
      else if (dab > T) { o[p] = 150; o[p + 1] = 150; o[p + 2] = 150 }
      else { o[p] = l; o[p + 1] = l; o[p + 2] = l }
      o[p + 3] = 255
    }
    g2.putImageData(im, 0, 0)
    pics.push(c2.toDataURL('image/png'))
  }
  return { W, H, stats, worst: { flip: worst.flip, i: worst.i }, pics }
}
0`

const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0 }
const results = []
let bad = false
for (const [name, scene, w, h, dpr, setup, move, pin] of CASES) {
  if (want && !want.has(name)) continue
  for (const view of VIEWS) {
    const b = await launch({ width: w, height: h })
    const v = view === 'classic' ? '' : `&view=${view}`
    await b.goto(`file://${join(out, '_shot.html')}#scene=${scene}&w=${w}&h=${h}&dpr=${dpr}&top=0&touch=0${v}&pin=${pin ?? PIN}${PARAMS ? `&params=${encodeURIComponent(PARAMS)}` : ''}`)
    for (let t = 0; t < 40 && (await b.eval('document.title')) !== 'ready'; t++) await b.sleep(250)
    const gpu = await b.eval(`(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'none' })()`)
    // (A second after the set-up, standing: what moved with it, the lamps the view lights with among them, has settled.
    // With the day running, three: in play the hour has been running, and the view's lamps and its reading of how
    // fast the light drifts have settled.)
    const settle = name.startsWith('day-') ? 180 : 60
    await b.eval(`${setup}; for (let k = 0; k < ${settle}; k++) { __lab.step(1); __lab.r.draw(__lab.s, __lab.ui, 1 / 60) } 0`)
    await b.eval(MEASURE)
    const r = await b.eval(`__walk(${FRAMES}, ${JSON.stringify(move)}, true)`)
    if (b.errors.length) console.error(`${name} ${view}: ${b.errors.slice(0, 3).join(' | ')}`)
    await b.close()
    const st = r.stats
    const lm = median(st.map(q => q.luma))
    const dark = st.filter(q => q.luma < lm * 0.6).map(q => q.i)
    const ch = st.slice(1).map(q => q.changed)
    const fl = st.slice(2).map(q => q.flip)
    const moved = Math.hypot(st.at(-1).x - st[0].x, st.at(-1).y - st[0].y)
    const row = {
      name, view, gpu, size: `${r.W}x${r.H}`, frames: st.length, moved: +moved.toFixed(2),
      changedMedian: +median(ch).toFixed(4), changedMax: +Math.max(...ch).toFixed(4),
      flipMedian: +median(fl).toFixed(4), flipMax: +Math.max(...fl).toFixed(4), worstAt: r.worst.i,
      lumaMedian: +lm.toFixed(3), lumaMin: +Math.min(...st.map(q => q.luma)).toFixed(3), dark, waiting: st.filter(q => q.waiting).length,
      perFrame: st.map(q => [q.i, +q.changed.toFixed(4), +q.flip.toFixed(4), +q.luma.toFixed(3)]),
    }
    results.push(row)
    r.pics.forEach((u, i) => writeFileSync(join(out, `${name}-${view}-${['a', 'b', 'c', 'diff'][i]}.png`), Buffer.from(u.split(',')[1], 'base64')))
    console.log(`${name.padEnd(17)} ${view.padEnd(7)} changed med ${row.changedMedian.toFixed(3)} max ${row.changedMax.toFixed(3)}  flip med ${row.flipMedian.toFixed(4)} max ${row.flipMax.toFixed(4)} @${row.worstAt}  luma ${row.lumaMedian} min ${row.lumaMin} dark ${dark.length} moved ${row.moved}`)
    const still = move.x === 0 && move.y === 0
    const flashes = still ? ch.filter(c => c > FLASH_MAX).length : 0
    if (CHECK && view === 'poly' && (dark.length || (still && (row.changedMedian > STILL_MAX || flashes)))) { bad = true; console.log(`FAIL ${name}: ${dark.length} dark frames, ${(row.changedMedian * 100).toFixed(1)} % of the picture changes a frame${still ? ` standing still, ${flashes} frames change more than ${FLASH_MAX * 100} %` : ''}`) }
  }
}
writeFileSync(join(out, 'walk.json'), JSON.stringify(results, null, 1))
if (results[0]) console.log(`gpu: ${results[0].gpu}`)
if (bad) process.exit(1)
