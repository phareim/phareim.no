#!/usr/bin/env node
// Start a run, play a moment, hold Escape into GAME OVER, screenshot.
//   node scripts/zelda-lab/over-shot.mjs <baseUrl> <outDir> <id> [w] [h]
import { launch } from './cdp.mjs'
import { mkdirSync } from 'node:fs'
const [base, out, id, w = '1280', h = '800'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const b = await launch({ width: +w, height: +h, dpr: +w < 600 ? 2 : 1, mobile: +w < 600 })
await b.goto(`${base}/?theme=${id}`)
await b.sleep(2000)
await b.key('Enter')
await b.keyDown('Space')
for (let i = 0; i < 6; i++) { await b.hold(i % 2 ? 'ArrowLeft' : 'ArrowRight', 500) }
await b.keyUp('Space')
await b.shot(`${out}/${id}-${w}-mid.png`)
await b.hold('Escape', 3400)
await b.sleep(2500)
await b.shot(`${out}/${id}-${w}-over.png`)
if (b.errors.length) console.log('errors:', b.errors.slice(0, 5))
await b.close()
