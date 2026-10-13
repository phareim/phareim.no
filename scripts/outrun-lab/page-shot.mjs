#!/usr/bin/env node
// Nova & Rex' Drive to the Mountains on a real page (a dev server, beta or the live site):
// the title, PICK A TAPE, and a few seconds of driving, at a monitor's size and a phone's.
// It never ends a run: a finished run posts its score to the Hall of Fame, and beta shares
// the live site's database.
// The lab (shot.mjs) draws the renderer alone; this is the page round it: the HTML title
// and its font, the pictures fetched from /outrun/, the keys.
//
//   node scripts/outrun-lab/page-shot.mjs <baseUrl> <outDir>
//
// On Sleeper: heavy -x chrome -- node scripts/outrun-lab/page-shot.mjs https://beta.phareim.no ~/oshots/page
import { launch } from '../zelda-lab/cdp.mjs'
import { mkdirSync } from 'node:fs'

const [base, out] = process.argv.slice(2)
if (!base || !out) { console.error('usage: page-shot.mjs <baseUrl> <outDir>'); process.exit(2) }
mkdirSync(out, { recursive: true })
let failed = false

for (const [name, width, height, mobile] of [['desk', 1280, 720, false], ['phone', 390, 844, true]]) {
  const b = await launch({ width, height, dpr: mobile ? 2 : 1, mobile })
  await b.goto(`${base}/?theme=outrun`)
  await b.sleep(3500)
  await b.shot(`${out}/${name}-1-title.png`)
  const pictures = await b.eval(`performance.getEntriesByType('resource').filter(e => e.name.includes('/outrun/') && e.name.endsWith('.png')).length`)
  if (mobile) await b.tap(width / 2, height * 0.7)
  else await b.key('Enter')
  await b.sleep(1200)
  await b.shot(`${out}/${name}-2-tape.png`)
  if (mobile) await b.tap(width / 2, height * 0.33)
  else await b.key('Enter')
  // The countdown, then gas (a phone drives with the throttle open).
  await b.sleep(3600)
  if (!mobile) await b.keyDown('ArrowUp')
  await b.sleep(2600)
  await b.shot(`${out}/${name}-3-go.png`)
  await b.sleep(5200)
  await b.shot(`${out}/${name}-4-drive.png`)
  if (!mobile) await b.keyUp('ArrowUp')
  const title = await b.eval('document.title')
  console.log(`${name}: ${pictures} pictures fetched, page title "${title}", ${b.errors.length} errors`)
  for (const e of b.errors.slice(0, 5)) console.log('  error:', String(e).slice(0, 300))
  if (b.errors.length || pictures < 50) failed = true
  await b.close()
}
process.exit(failed ? 1 : 0)
