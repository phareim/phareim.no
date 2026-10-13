#!/usr/bin/env node
// The look lab of Nova & Rex' Drive to the Mountains (the theme `outrun`):
// renders the real engine and renderer into PNGs in headless Chromium, without
// Nuxt. Snap Chromium: outDir must be a non-hidden path under $HOME. On
// Sleeper run it through `heavy -x chrome --`.
//
//   node scripts/outrun-lab/shot.mjs <outDir> [scene,scene…]
//
// A scene starts a game somewhere on the pyramid, drives it on autopilot for
// a while and draws one frame; see SHOTS below. The bitmaps of public/outrun
// go into the page as data URLs (a file:// picture cannot be read back for
// the hour's shade).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
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

const artDir = join(repo, 'public/outrun')
const pictures = {}
for (const f of readdirSync(artDir)) {
  if (f.endsWith('.png')) pictures[f.slice(0, -4)] = 'data:image/png;base64,' + readFileSync(join(artDir, f)).toString('base64')
}

const entry = `
import { createRenderer } from ${JSON.stringify(join(repo, 'themes/outrun/renderer.ts'))}
import { loadArt } from ${JSON.stringify(join(repo, 'themes/outrun/art.ts'))}
import { createGame, stepGame, autopilot, SEG_LEN } from ${JSON.stringify(join(repo, 'themes/outrun/engine.ts'))}

const PICTURES = ${JSON.stringify(pictures)}
const q = new URLSearchParams(location.hash.slice(1))
const W = +q.get('w'), H = +q.get('h'), dpr = +(q.get('dpr') || 1)
const col = +(q.get('col') || 0), node = +(q.get('node') || 0), secs = +(q.get('t') || 6)
const phase = q.get('phase') || 'play'
const canvas = document.createElement('canvas')
canvas.style.cssText = 'display:block;width:' + W + 'px;height:' + H + 'px;image-rendering:pixelated'
document.body.style.cssText = 'margin:0;background:#0a0c1e;overflow:hidden'
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
const art = loadArt(name => PICTURES[name])
const r = createRenderer(canvas, art)
r.resize(W, H, dpr)
const steer = +(q.get('steer') || 0)
const drawFor = +(q.get('draw') || 0.6)
let now = 10
// talk=who:mood:words puts a line in the talk box.
const said = (q.get('talk') || '').split(':')
const talk = said.length === 3 ? { who: said[0], mood: said[1], text: said[2], t: 9, life: 10 } : null
const ui = (dt) => ({ now, dt, phase, reduced: false, touch: W < 700, braking: false, messages: q.get('msg') ? [{ text: q.get('msg'), color: '#ffe45c', t: 0.5, life: 2, big: true, sub: q.get('sub') || '' }] : [], talk, radioIndex: 0, radioNames: ['FOR NOVA', 'SOUTHIE NIGHTS', 'SIDE B SUNRISE'], radioTimer: 7, shake: 0, paused: false })
function run() {
  if (!art.ready) { setTimeout(run, 20); return }
  for (let t = 0; t < secs; t += 1 / 60) {
    const a = autopilot(s)
    if (steer) a.steer = steer
    stepGame(s, 1 / 60, a, at === 'goal')
    if (at === 'chain') { s.chain = 3; s.chainT = 2 }
    now += 1 / 60
    if (secs - t < drawFor) r.draw(s, ui(1 / 60))
  }
  r.draw(s, ui(1 / 60))
  window.__stats = { speed: s.speed, x: s.playerX, seg: Math.floor(s.position / SEG_LEN), col: s.col, node: s.node }
  document.title = 'ready'
}
run()
`
const entryFile = join(out, '_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error', alias: { '~': repo } })
const html = join(out, '_shot.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)

const say = (who, mood, text) => `talk=${who}:${mood}:${encodeURIComponent(text)}`
// name, w, h, dpr, hash params
const SHOTS = [
  ['city-1280', 1280, 720, 1, 'col=0&node=0&t=8'],
  ['city-1920', 1920, 1080, 1, 'col=0&node=0&t=8'],
  ['city-390', 390, 844, 2, 'col=0&node=0&t=8'],
  ['shore-1280', 1280, 720, 1, 'col=1&node=0&t=10'],
  ['mills-1280', 1280, 720, 1, 'col=1&node=1&t=10'],
  ['farms-1280', 1280, 720, 1, 'col=2&node=0&t=12'],
  ['woods-1280', 1280, 720, 1, 'col=2&node=1&t=12'],
  ['pass-1280', 1280, 720, 1, 'col=2&node=2&t=12'],
  ['frost-1280', 1280, 720, 1, 'col=3&node=3&t=12'],
  ['valley-1280', 1280, 720, 1, 'col=4&node=0&t=12'],
  ['summit-1280', 1280, 720, 1, 'col=4&node=4&t=12'],
  ['summit-390', 390, 844, 2, 'col=4&node=4&t=12'],
  ['summit-667', 667, 375, 2, 'col=4&node=4&t=14'],
  ['fork-1280', 1280, 720, 1, 'col=0&node=0&t=62'],
  ['left-1280', 1280, 720, 1, 'col=2&node=1&t=3&steer=-1'],
  ['right-1280', 1280, 720, 1, 'col=2&node=1&t=3&steer=1'],
  ['tunnel-1280', 1280, 720, 1, 'col=1&node=1&t=0.8&at=tunnel'],
  ['intunnel-1280', 1280, 720, 1, 'col=1&node=1&t=0.8&at=intunnel'],
  ['intunnel-390', 390, 844, 2, 'col=1&node=1&t=0.8&at=intunnel'],
  ['mouth-1280', 1280, 720, 1, 'col=2&node=2&t=0.4&at=tunnel'],
  ['countdown-1280', 1280, 720, 1, 'col=0&node=0&t=1.5&at=countdown&msg=2'],
  ['goal-1280', 1280, 720, 1, 'col=4&node=2&t=3&at=goal&msg=GOAL!&sub=TIME%20BONUS%20240000'],
  ['card-1280', 1280, 720, 1, `col=4&node=2&t=7&at=goal&draw=6&${say('nova', 'laugh', 'Mountains. Told you.')}`],
  ['card-390', 390, 844, 2, 'col=4&node=2&t=7&at=goal&draw=6'],
  ['chain-1280', 1280, 720, 1, 'col=0&node=0&t=5&at=chain&steer=0.3'],
  ['talk-1280', 1280, 720, 1, `col=2&node=1&t=6&${say('rex', 'worried', 'The sign said moose.')}`],
  ['talk2-1280', 1280, 720, 1, `col=1&node=0&t=6&msg=CHECKPOINT&sub=EXTENDED%20PLAY%20%2B63S&${say('nova', 'eyeroll', "It's a lighthouse, Rex.")}`],
  ['talk-390', 390, 844, 2, `col=3&node=3&t=6&${say('rex', 'eating', 'This slice is a seven. Road slice. Different scale.')}`],
  ['radio-1280', 1280, 720, 1, 'col=0&node=0&t=4&phase=radio'],
  ['radio-390', 390, 844, 2, 'col=0&node=0&t=4&phase=radio'],
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
