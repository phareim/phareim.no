#!/usr/bin/env node
// Neon Shrine look lab: render the real engine + renderer + world into PNGs
// in headless Chromium, without Nuxt. Snap Chromium: outDir must be a
// non-hidden path under $HOME.
//
//   node scripts/zelda-lab/shot.mjs <outDir> [scene,scene…]
//
// Scenes place the hero somewhere and simulate a moment; see SCENES below.
// Scenes named p-* use the peaceful fixture world in fixture.ts (portal
// looks: cabinets, board, kiosk, terminals, decals, the petter NPC); r-*
// use the real portal world (themes/portal/world).
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
import { createRenderer } from ${JSON.stringify(join(repo, 'themes/zelda/render/renderer.ts'))}
import { createGame, stepGame } from ${JSON.stringify(join(repo, 'themes/zelda/engine/index.ts'))}
import { enterMap } from ${JSON.stringify(join(repo, 'themes/zelda/engine/game.ts'))}
import { WORLD } from ${JSON.stringify(join(repo, 'themes/zelda/world/index.ts'))}
import { NO_INPUT, WARP_TIME } from ${JSON.stringify(join(repo, 'themes/zelda/types.ts'))}
import { LAB } from ${JSON.stringify(join(repo, 'scripts/zelda-lab/fixture.ts'))}
import { PORTAL_WORLD } from ${JSON.stringify(join(repo, 'themes/portal/world/index.ts'))}

const q = new URLSearchParams(location.hash.slice(1))
const W = +q.get('w'), H = +q.get('h'), dpr = +(q.get('dpr') || 1), bottom = +(q.get('bottom') || 0)
const scene = q.get('scene')
const canvas = document.createElement('canvas')
canvas.style.cssText = 'display:block;width:' + W + 'px;height:' + H + 'px'
document.body.style.cssText = 'margin:0;background:#0b0616;overflow:hidden'
document.body.appendChild(canvas)
const world = scene.startsWith('p-') ? LAB : scene.startsWith('r-') ? PORTAL_WORLD : WORLD
const s = createGame(world, { seed: 7 })
if (scene !== 'hutout') { s.dialog = null; s.mode = 'play'; s.hero.auto = null }
const r = createRenderer(canvas, world)
r.resize(W, H, dpr, bottom)
const inp = (o) => ({ ...NO_INPUT, ...o })
const run = (n, i = inp({})) => { for (let k = 0; k < n; k++) r.onEvents(stepGame(world, s, 1 / 60, i)) }
const ev = []
const give = () => { s.inv.sword = true; s.inv.bombBag = true; s.inv.bombs = 8; s.inv.disc = true; s.inv.selected = 'disc'; s.inv.bits = 123; s.inv.keys = 1; s.hero.maxHp = 10; s.hero.hp = 7 }
const at = (map, x, y, dir = 'down') => { enterMap(WORLD, s, map, Object.keys({}).length ? '' : 'x', ev); s.hero.x = x; s.hero.y = y; s.hero.dir = dir }
function place(map, entryId, dx = 0, dy = 0) { enterMap(world, s, map, entryId, ev); s.hero.x += dx; s.hero.y += dy; s.hero.auto = null }
const put = (map, x, y, dir) => { enterMap(world, s, map, Object.keys({}).length ? '' : 'door', ev); s.hero.x = x; s.hero.y = y; s.hero.dir = dir; s.hero.auto = null }
const ui = { paused: false, reducedMotion: false, touch: q.get('touch') === '1', stick: null, attract: false, cam: null, banner: null, keys: q.get('touch') === '1' ? { a: 'A', b: 'B', cycle: 'B' } : { a: 'SPACE', b: 'K', cycle: 'Q' } }
switch (scene) {
  case 'start': run(30); break
  case 'intro': s.dialog = { lines: ['KEEPER: THE SUN HAS HUNG ON THE HORIZON FOR THREE NIGHTS. THE STATIC KING TOOK THE SUN PRISM INTO THE OLD NEON SHRINE.'], line: 0, chars: 80, who: 'keeper', after: null }; s.mode = 'dialog'; break
  case 'swing': give(); run(10); r.onEvents(stepGame(WORLD, s, 1/60, inp({ aPress: true, a: true }))); run(5, inp({ a: true })); break
  case 'market': give(); place('overworld', 'shop', 4, 4); run(20); break
  case 'woods': give(); s.hero.x = 8; s.hero.y = 9; run(40); break
  case 'lake': give(); place('overworld', 'cave', -4, -6); run(30); break
  case 'graves': give(); place('overworld', 'shrine', 0, 7); run(30); break
  case 'shop': give(); place('shop', 'door', 0, -2); run(20); break
  case 'arcade': give(); place('arcade', 'door', 0, -1); run(20); break
  case 'entry': give(); place('shrine', 'start', 0, -2); run(40); break
  case 'hub': give(); place('shrine', 'start', 0, -12); run(5); enterMap; s.zoneIndex = 7; s.zone = { x: 16, y: 24, w: 16, h: 12 }; run(40); break
  case 'crystal': give(); place('shrine', 'start', -14, -13); s.zoneIndex = 6; s.zone = { x: 0, y: 24, w: 16, h: 12 }; run(30); break
  case 'boss': give(); place('shrine', 'start', 0, -37); s.zoneIndex = 1; s.zone = { x: 16, y: 0, w: 16, h: 12 }; run(150); break
  case 'dark': give(); place('shrine', 'start', 16, -30); s.zoneIndex = 5; s.zone = { x: 32, y: 12, w: 16, h: 12 }; run(30); break
  case 'pause': give(); run(10); ui.paused = true; break
  case 'hut': give(); place('hut', 'door', 0, -5.5); s.hero.dir = 'up'; run(5); break
  case 'hutout': run(12); break
  case 'hutfront': give(); place('overworld', 'hut', 0, 1.5); run(10); break
  case 'p-plaza': run(20); break
  case 'p-kiosk': s.hero.x = 8.5; s.hero.y = 13.5; s.hero.dir = 'up'; run(5); break
  case 'p-sign': s.hero.x = 23.5; s.hero.y = 13.5; s.hero.dir = 'up'; run(5); break
  case 'p-term': s.hero.x = 12.5; s.hero.y = 13.5; s.hero.dir = 'up'; run(5); break
  case 'p-door': s.hero.x = 24.5; s.hero.y = 5.6; s.hero.dir = 'up'; run(5); break
  case 'p-arcade': put('parcade', 7.5, 5.5, 'up'); run(5); break
  case 'p-back': put('parcade', 12.5, 3.6, 'right'); run(5); break
  case 'p-board': put('parcade', 9.5, 2.5, 'up'); run(5); break
  case 'p-hangar': put('parcade', 15.5, 1.6, 'up'); run(5); break
  case 'p-home': put('home', 7.5, 2.5, 'up'); run(5); break
  case 'p-exit': put('parcade', 7.5, 5.5, 'up'); s.mode = 'exit'; s.warp = { t: WARP_TIME, to: '', entry: '', swapped: false }; break
  case 'p-reduced': ui.reducedMotion = true; run(20); break
  case 'r-plaza': run(20); break
  case 'r-arcade': place('arcade', 'door'); run(20); break
  case 'r-home': place('home', 'door'); run(20); break
}
// Several frames so fades (exit labels) settle and the clock moves.
for (let k = 0; k < 40; k++) r.draw(s, ui, 1 / 60)
document.title = 'ready'
`
const entryFile = join(out, '_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_shot.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)

const SHOTS = [
  ['start-1440', 'start', 1440, 900, 1, 0],
  ['start-390', 'start', 390, 844, 3, 260],
  ['swing-1440', 'swing', 1440, 900, 1, 0],
  ['intro-390', 'intro', 390, 844, 3, 260],
  ['market-1440', 'market', 1440, 900, 1, 0],
  ['woods-1440', 'woods', 1440, 900, 1, 0],
  ['lake-1440', 'lake', 1440, 900, 1, 0],
  ['graves-1440', 'graves', 1440, 900, 1, 0],
  ['shop-1440', 'shop', 1440, 900, 1, 0],
  ['arcade-667', 'arcade', 667, 375, 2, 0],
  ['entry-1440', 'entry', 1440, 900, 1, 0],
  ['hub-1440', 'hub', 1440, 900, 1, 0],
  ['crystal-1440', 'crystal', 1440, 900, 1, 0],
  ['boss-1440', 'boss', 1440, 900, 1, 0],
  ['dark-667', 'dark', 667, 375, 2, 0],
  ['pause-1440', 'pause', 1440, 900, 1, 0],
  ['hut-1280', 'hut', 1280, 800, 1, 0],
  ['hutout-1280', 'hutout', 1280, 800, 1, 0],
  ['hutfront-390', 'hutfront', 390, 844, 3, 260],
  ['p-plaza-1280', 'p-plaza', 1280, 800, 1, 0],
  ['p-plaza-390', 'p-plaza', 390, 844, 3, 260],
  ['p-kiosk-1280', 'p-kiosk', 1280, 800, 1, 0],
  ['p-sign-390', 'p-sign', 390, 844, 3, 260],
  ['p-term-1280', 'p-term', 1280, 800, 1, 0],
  ['p-door-1280', 'p-door', 1280, 800, 1, 0],
  ['p-arcade-1280', 'p-arcade', 1280, 800, 1, 0],
  ['p-arcade-390', 'p-arcade', 390, 844, 3, 260],
  ['p-back-1280', 'p-back', 1280, 800, 1, 0],
  ['p-board-1280', 'p-board', 1280, 800, 1, 0],
  ['p-hangar-390', 'p-hangar', 390, 844, 3, 260],
  ['p-home-1280', 'p-home', 1280, 800, 1, 0],
  ['p-exit-1280', 'p-exit', 1280, 800, 1, 0],
  ['p-reduced-1280', 'p-reduced', 1280, 800, 1, 0],
  ['shop-390', 'shop', 390, 844, 3, 260],
  ['r-plaza-1280', 'r-plaza', 1280, 800, 1, 0],
  ['r-plaza-390', 'r-plaza', 390, 844, 3, 260],
  ['r-plaza-412', 'r-plaza', 412, 915, 2.625, 280],
  ['r-arcade-1280', 'r-arcade', 1280, 800, 1, 0],
  ['r-arcade-390', 'r-arcade', 390, 844, 3, 260],
  ['r-home-390', 'r-home', 390, 844, 3, 260],
]
const want = only ? new Set(only.split(',')) : null
for (const [name, scene, w, h, dpr, bottom] of SHOTS) {
  if (want && !want.has(name) && !want.has(scene)) continue
  const png = join(out, `${name}.png`)
  try {
    execFileSync('chromium-browser', [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      `--force-device-scale-factor=${dpr}`, `--window-size=${w},${h}`,
      '--virtual-time-budget=3000', `--screenshot=${png}`,
      `file://${html}#scene=${scene}&w=${w}&h=${h}&dpr=${dpr}&bottom=${bottom}&touch=${w < 1000 ? 1 : 0}`,
    ], { stdio: 'ignore', timeout: 60000 })
    console.log(png)
  } catch (e) {
    console.error(`failed: ${name}: ${e.message}`)
  }
}
