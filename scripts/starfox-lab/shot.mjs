#!/usr/bin/env node
// Screenshot the Star Fox model lab: one browser for the whole run.
//   flock /tmp/claude-1000/chrome.lock node scripts/starfox-lab/shot.mjs <outDir> <name=query> [name=query …]
// e.g. enemies=page=enemies  pincer=page=bosses&boss=pincer&t=3
// Env: BASE (default http://127.0.0.1:3041), W/H (1280×800), WAIT ms after load (6000).
import { launch } from '../zelda-lab/cdp.mjs'
import { mkdirSync } from 'node:fs'

const [out, ...shots] = process.argv.slice(2)
if (!out || !shots.length) { console.error('usage: shot.mjs <outDir> <name=query> …'); process.exit(1) }
const base = process.env.BASE ?? 'http://127.0.0.1:3041'
const w = +(process.env.W ?? 1280)
const h = +(process.env.H ?? 800)
const wait = +(process.env.WAIT ?? 6000)
mkdirSync(out, { recursive: true })
const b = await launch({ width: w, height: h, dpr: 1, mobile: false })
try {
  for (const s of shots) {
    const i = s.indexOf('=')
    const name = s.slice(0, i)
    const q = s.slice(i + 1)
    await b.goto(`${base}/?theme=starfox&lab=models&${q}`)
    await b.sleep(wait)
    await b.shot(`${out}/${name}.png`)
    console.log('shot', name, b.errors.length ? `errors: ${b.errors.slice(-3).join(' | ')}` : '')
  }
} finally {
  await b.close()
}
