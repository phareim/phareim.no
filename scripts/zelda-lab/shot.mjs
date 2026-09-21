#!/usr/bin/env node
// Zelda look lab: render the real renderer + engine + world from any
// checkout/worktree into PNGs, without Nuxt. Bundles with esbuild, draws in
// headless Chromium (snap: output must live under a non-hidden $HOME path).
//
//   node scripts/zelda-lab/shot.mjs <repoDir> <outDir> [prefix]
//
// Writes <prefix>-meadow-1440.png, -glade-1440.png, -swing-1440.png,
// -meadow-375.png (portrait phone) and -meadow-667.png (landscape phone).
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')

const [repoArg, outArg, prefix = 'shot'] = process.argv.slice(2)
if (!repoArg || !outArg) {
  console.error('usage: shot.mjs <repoDir> <outDir> [prefix]')
  process.exit(2)
}
const repo = resolve(repoArg)
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const entry = `
import { createRenderer } from ${JSON.stringify(join(repo, 'themes/zelda/renderer.ts'))}
import { createGame, stepGame } from ${JSON.stringify(join(repo, 'themes/zelda/engine.ts'))}
import { WORLD } from ${JSON.stringify(join(repo, 'themes/zelda/world.ts'))}

const q = new URLSearchParams(location.hash.slice(1))
const W = +q.get('w'), H = +q.get('h'), dpr = +(q.get('dpr') || 1)
const scene = q.get('scene') || 'meadow'
const canvas = document.createElement('canvas')
canvas.style.cssText = 'display:block;width:' + W + 'px;height:' + H + 'px'
document.body.style.cssText = 'margin:0;background:#0b0616;overflow:hidden'
document.body.appendChild(canvas)

const save = scene === 'glade'
  ? { v: 1, room: 'glade', entry: 'glade.west', hp: 3, maxHp: 3, hasSword: true, smallKeys: 1,
      hasBossKey: false, flags: ['meadow.sword', 'meadow.key'], containers: [], rng: 7, elapsed: 30 }
  : null
const state = createGame(WORLD, { seed: 7, save })
const renderer = createRenderer(canvas, WORLD)
renderer.resize(W, H, dpr, q.get('touch') === '1')
const idle = { move: { x: 0, y: 0 }, attack: false, interact: false, autoFace: false }
const ui = { banner: null, paused: false, reducedMotion: false, alpha: 1, stick: null, hint: '' }
const run = (n, input) => { for (let i = 0; i < n; i++) renderer.onEvents(stepGame(WORLD, state, 1 / 60, input)) }
if (scene === 'swing') {
  state.player.hasSword = true
  state.room.pickupsLeft = []
  run(40, { ...idle, move: { x: 1, y: 0 } })
  run(1, { ...idle, attack: true })
  run(4, idle)
} else {
  run(30, { ...idle, move: { x: 1, y: 0.4 } })
}
renderer.draw(state, ui, 1 / 60)
renderer.draw(state, ui, 1 / 60)
document.title = 'ready'
`
const entryFile = join(out, `.${prefix}-entry.ts`.replace(/^\./, '_'))
writeFileSync(entryFile, entry)
const bundle = join(out, `_${prefix}-bundle.js`)
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, `_${prefix}.html`)
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)

const SHOTS = [
  ['meadow-1440', 'meadow', 1440, 900, 1],
  ['glade-1440', 'glade', 1440, 900, 1],
  ['swing-1440', 'swing', 1440, 900, 1],
  ['meadow-375', 'meadow', 375, 667, 2],
  ['meadow-667', 'meadow', 667, 375, 2],
]
for (const [name, scene, w, h, dpr] of SHOTS) {
  const png = join(out, `${prefix}-${name}.png`)
  try {
    execFileSync('chromium-browser', [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      `--force-device-scale-factor=${dpr}`, `--window-size=${w},${h}`,
      '--virtual-time-budget=2000', `--screenshot=${png}`,
      `file://${html}#scene=${scene}&w=${w}&h=${h}&dpr=${dpr}&touch=${w < 1000 ? 1 : 0}`,
    ], { stdio: 'ignore', timeout: 60000 })
    console.log(png)
  } catch (e) {
    console.error(`failed: ${name}: ${e.message}`)
  }
}
