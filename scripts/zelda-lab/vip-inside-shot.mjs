#!/usr/bin/env node
// The inside of the VIP hall, signed in, headless against the dev server:
// the bar, the bartender, the mirror ball's spots and the three cabinets.
//
//   heavy -x chrome -- node scripts/zelda-lab/vip-inside-shot.mjs <devUrl> <outDir>
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './cdp.mjs'

const [base = 'http://127.0.0.1:3030/', outArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: vip-inside-shot.mjs <devUrl> <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

for (const [label, vp] of [['desktop', { width: 1280, height: 800 }], ['phone', { width: 375, height: 667, mobile: true }]]) {
  const b = await launch(vp)
  try {
    await b.goto(base)
    await b.eval(`sessionStorage.setItem('portal.return', JSON.stringify({ map: 'vip', entry: 'door' }))`)
    await b.goto(base)
    await b.sleep(1200)
    await b.shot(join(out, `${label}-a.png`))
    await b.sleep(1500)
    await b.shot(join(out, `${label}-b.png`))
    console.log(label, await b.eval(`window.__portal.state.map.id`))
  } finally { await b.close() }
}
