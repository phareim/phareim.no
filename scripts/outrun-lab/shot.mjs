#!/usr/bin/env node
// OutRun look lab: render the real engine + renderer into PNGs in headless
// Chromium, without Nuxt. Snap Chromium: outDir must be a non-hidden path
// under $HOME.
//
//   node scripts/outrun-lab/shot.mjs <outDir> [scene,scene…]
//
// A scene starts a game somewhere on the pyramid, drives it on autopilot for
// a while and draws one frame; see SHOTS below.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, only] = process.argv.slice(2)
if (!outArg) { console.error('usage: shot.mjs <outDir> [scenes]'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const entry = `
import { createRenderer } from ${JSON.stringify(join(repo, 'themes/outrun/renderer.ts'))}
import { createGame, stepGame, autopilot, SEG_LEN } from ${JSON.stringify(join(repo, 'themes/outrun/engine.ts'))}

const q = new URLSearchParams(location.hash.slice(1))
const W = +q.get('w'), H = +q.get('h'), dpr = +(q.get('dpr') || 1)
const col = +(q.get('col') || 0), node = +(q.get('node') || 0), secs = +(q.get('t') || 6)
const phase = q.get('phase') || 'play'
const canvas = document.createElement('canvas')
canvas.style.cssText = 'display:block;width:' + W + 'px;height:' + H + 'px'
document.body.style.cssText = 'margin:0;background:#0b0616;overflow:hidden'
document.body.appendChild(canvas)
const at = q.get('at')
const s = createGame(+(q.get('seed') || 7), { countdown: at === 'countdown', col, node })
if (at === 'tunnel' || at === 'intunnel') {
  const i = s.segments.findIndex(g => g.tunnel)
  s.position = (i + (at === 'tunnel' ? -40 : 30)) * SEG_LEN
  s.speed = 12000 * 0.85
  s.cars = s.cars.map((c, k) => ({ ...c, z: s.position + SEG_LEN * (20 + k * 9) }))
}
if (at === 'goal') s.position = (s.goalAt - 30) * SEG_LEN
const r = createRenderer(canvas)
r.resize(W, H, dpr)
const steer = +(q.get('steer') || 0)
let now = 10
const ui = (dt) => ({ now, dt, phase, reduced: false, touch: W < 700, braking: false, messages: q.get('msg') ? [{ text: q.get('msg'), color: '#ffd23f', t: 0.5, life: 2, big: true, sub: 'MIRAGE MESA' }] : [], radioIndex: 0, radioNames: ['MIDNIGHT SHOWER', 'PASSING NEON', 'SPLASH GRID'], radioTimer: 7, shake: 0, flash: 0, paused: false })
for (let t = 0; t < secs; t += 1 / 60) {
  const a = autopilot(s)
  if (steer) a.steer = steer
  stepGame(s, 1 / 60, a, at === 'goal')
  if (at === 'chain') { s.chain = 3; s.chainT = 2 }
  now += 1 / 60
  if (secs - t < 0.6) r.draw(s, ui(1 / 60))
}
r.draw(s, ui(1 / 60))
window.__stats = { speed: s.speed, x: s.playerX, seg: Math.floor(s.position / SEG_LEN), col: s.col, node: s.node }
document.title = 'ready'
`
const entryFile = join(out, '_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error', alias: { '~': repo } })
const html = join(out, '_shot.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)

// name, w, h, dpr, hash params
const SHOTS = [
  ['coast-1280', 1280, 720, 1, 'col=0&node=0&t=8'],
  ['coast-390', 390, 844, 2, 'col=0&node=0&t=8'],
  ['peaks-1280', 1280, 720, 1, 'col=1&node=1&t=10'],
  ['mesa-1280', 1280, 720, 1, 'col=2&node=0&t=12'],
  ['city-1280', 1280, 720, 1, 'col=2&node=1&t=12'],
  ['canyon-1280', 1280, 720, 1, 'col=2&node=2&t=12'],
  ['grid-1280', 1280, 720, 1, 'col=3&node=1&t=12'],
  ['city-667', 667, 375, 2, 'col=4&node=0&t=14'],
  ['fork-1280', 1280, 720, 1, 'col=0&node=0&t=62'],
  ['tunnel-1280', 1280, 720, 1, 'col=2&node=1&t=0.8&at=tunnel'],
  ['intunnel-1280', 1280, 720, 1, 'col=2&node=1&t=0.8&at=intunnel'],
  ['intunnel-390', 390, 844, 2, 'col=1&node=1&t=0.8&at=intunnel'],
  ['mouth-1280', 1280, 720, 1, 'col=1&node=1&t=0.4&at=tunnel'],
  ['countdown-1280', 1280, 720, 1, 'col=0&node=0&t=1.5&at=countdown'],
  ['goal-1280', 1280, 720, 1, 'col=4&node=2&t=3&at=goal'],
  ['chain-1280', 1280, 720, 1, 'col=0&node=0&t=5&at=chain&steer=0.3'],
  ['radio-1280', 1280, 720, 1, 'col=0&node=0&t=4&phase=radio'],
  ['attract-1280', 1280, 720, 1, 'col=0&node=0&t=4&phase=attract'],
]
const want = only ? new Set(only.split(',')) : null
for (const [name, w, h, dpr, params] of SHOTS) {
  if (want && !want.has(name) && !want.has(name.split('-')[0])) continue
  const png = join(out, `${name}.png`)
  try {
    execFileSync('chromium-browser', [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      `--force-device-scale-factor=${dpr}`, `--window-size=${w},${h}`,
      '--virtual-time-budget=8000', `--screenshot=${png}`,
      `file://${html}#w=${w}&h=${h}&dpr=${dpr}&${params}`,
    ], { stdio: 'ignore', timeout: 90000 })
    console.log(png)
  } catch (e) {
    console.error(`failed: ${name}: ${e.message}`)
  }
}
