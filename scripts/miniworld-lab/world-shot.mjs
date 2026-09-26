#!/usr/bin/env node
// Mini World: stills of the world (town, obby, meadow, catwalk, house).
// Bundles world-entry.ts (the real runtime) with esbuild into a static page,
// opens it in one headless Chromium (WebGL via SwiftShader: slow, fine for
// stills) and screenshots each shot. Run under the lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/miniworld-lab/world-shot.mjs [outDir] [shots] [WxH@dpr]
//
// Shots (default all): torget, shops, nabogata, castle, tivoli, balloons,
// aerial, obby-easy, obby-medium, obby-hard, stars, catwalk, house, pynt.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { launch } from '../zelda-lab/cdp.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const here = dirname(fileURLToPath(import.meta.url))
const [outArg, shotArg, sizeArg] = process.argv.slice(2)
const out = resolve(outArg || join(homedir(), 'zshots', 'miniworld'))
mkdirSync(out, { recursive: true })
const m = /^(\d+)x(\d+)(?:@(\d+))?$/.exec(sizeArg || '390x844@3')
const W = +m[1], H = +m[2], DPR = +(m[3] || 1)
const tag = `${W}x${H}`

// [name, setup expression run in the page, frames to run]
const SHOTS = {
  torget: [`__world.at(0, 0, 8.5, Math.PI, { pitch: 0.35, dist: 12 })`, 40],
  shops: [`__world.at(28, 0, 5, Math.PI * 0.85, { yaw: -0.35, pitch: 0.28, dist: 14 })`, 40],
  nabogata: [`__world.at(-24, 0, 1, -Math.PI / 2, { yaw: Math.PI / 2 - 0.5, pitch: 0.3, dist: 13 })`, 40],
  castle: [`__world.at(0, 0, -24, Math.PI, { yaw: 0.15, pitch: 0.3, dist: 15 })`, 40],
  tivoli: [`__world.at(0, 0, 25, 0, { yaw: Math.PI, pitch: 0.35, dist: 15 })`, 40],
  balloons: [`__world.at(36, 0, 36, Math.PI / 2, { yaw: -Math.PI / 2 + 0.3, pitch: 0.25, dist: 9 }); __world.step(10); __world.input.usePressed = true`, 14],
  aerial: [`__world.at(0, 0, 20, Math.PI, { yaw: 0.3, pitch: 1.0, dist: 22 })`, 40],
  'obby-easy': [`__world.go({ kind: 'obby', level: 'easy' })`, 40],
  'obby-door': [`__world.go({ kind: 'obby', level: 'easy' }); __world.at(1, 0, 1.5, -Math.PI / 2, { yaw: Math.PI / 2, pitch: 0.3, dist: 8 })`, 40],
  'obby-medium': [`__world.go({ kind: 'obby', level: 'medium' })`, 40],
  'obby-hard': [`__world.go({ kind: 'obby', level: 'hard' })`, 40],
  stars: [`__world.go({ kind: 'stars' })`, 150],
  catwalk: [`__world.go({ kind: 'catwalk' })`, 110],
  house: [`__world.go({ kind: 'house', edit: false })`, 40],
  pynt: [`__world.go({ kind: 'house', edit: false }); __world.go({ kind: 'house', edit: true })`, 60],
}
const names = shotArg && shotArg !== 'all' ? shotArg.split(',') : Object.keys(SHOTS)

const built = esbuild.buildSync({
  entryPoints: [join(here, 'world-entry.ts')],
  bundle: true, format: 'iife', write: false, platform: 'browser', logLevel: 'error', target: 'es2022',
})
const html = join(out, 'world.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body></body><script>${built.outputFiles[0].text}</script>`)

const b = await launch({ width: W, height: H, dpr: DPR })
let failed = false
try {
  for (const name of names) {
    const shot = SHOTS[name]
    if (!shot) { console.log('unknown shot', name); continue }
    await b.goto('file://' + html)
    await b.eval(`(() => { ${shot[0]}; __world.step(${shot[1]}); return 1 })()`)
    await b.sleep(250)
    const file = join(out, `world-${name}-${tag}.png`)
    await b.shot(file)
    const ev = await b.eval(`JSON.stringify(__world.events.filter(e => e.type !== 'near').slice(-4))`)
    console.log(name, '→', file, ev)
  }
  if (b.errors.length) { failed = true; console.log('errors:\n' + b.errors.slice(0, 20).join('\n')) }
} finally {
  await b.close()
}
process.exit(failed ? 1 : 0)
