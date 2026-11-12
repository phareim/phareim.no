#!/usr/bin/env node
// Neon Shrine's views on a running site, with pictures: a visit starts in the
// 16-bit view; V does nothing in play; on the pause screen V turns to the next
// view and the browser remembers it. Then a phone: no view button beside the
// world, and the pause screen's VIEW button turns the view.
//   node scripts/zelda-lab/view-shot.mjs <baseUrl> <outDir>
import { launch } from './cdp.mjs'
import { mkdirSync } from 'node:fs'
const [base, out] = process.argv.slice(2)
if (!base || !out) { console.error('usage: view-shot.mjs <baseUrl> <outDir>'); process.exit(2) }
mkdirSync(out, { recursive: true })
let failed = false
const check = (ok, what) => { console.log(ok ? 'ok  ' : 'FAIL', what); if (!ok) failed = true }
const stored = b => b.eval(`localStorage.getItem('zelda.view')`)

{
  const b = await launch({ width: 1280, height: 800 })
  await b.goto(`${base}/`)
  await b.sleep(1500)
  await b.eval(`localStorage.removeItem('zelda.view')`)
  await b.shot(`${out}/1-first.png`)
  check(await stored(b) === null, 'the view a visit starts in is not written down')
  await b.key('KeyV')
  await b.sleep(900)
  check(await stored(b) === null, 'V does nothing in play')
  // Up on the keys is up on the screen: the hero walks away from the door, north-west in the world.
  await b.hold('ArrowDown', 700)
  await b.hold('ArrowRight', 500)
  await b.sleep(200)
  await b.shot(`${out}/2-iso-walked.png`)
  await b.key('KeyP')
  await b.sleep(300)
  await b.shot(`${out}/3-iso-paused.png`)
  await b.key('KeyV')
  await b.sleep(400)
  await b.shot(`${out}/4-next-paused.png`)
  const next = await stored(b)
  check(!!next && next !== 'iso', `V on the pause screen turns to the next view (${next})`)
  await b.key('KeyP')
  await b.sleep(400)
  await b.shot(`${out}/5-next.png`)
  check(b.errors.length === 0, `no script errors on the desktop (${b.errors.slice(0, 2).join(' | ')})`)
  await b.close()
}
{
  const b = await launch({ width: 390, height: 844, dpr: 2, mobile: true })
  await b.goto(`${base}/?view=iso`)
  await b.sleep(2500)
  await b.shot(`${out}/7-phone-iso-from-address.png`)
  check(!(await b.eval(`!!document.querySelector('button[aria-label^="Change view"]')`)), 'no view button beside the world')
  const at = sel => b.eval(`(() => { const e = ${sel}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  const pause = await at(`document.querySelector('button[aria-label="Pause"]')`)
  check(!!pause, 'the pause chip is in the corner')
  if (pause) {
    await b.tap(pause.x, pause.y)
    await b.sleep(500)
    const view = await at(`[...document.querySelectorAll('.zelda-pad-wide')].find(e => e.textContent.startsWith('VIEW'))`)
    check(!!view, 'the pause screen has a VIEW button')
    if (view) {
      await b.tap(view.x, view.y)
      await b.sleep(600)
      await b.shot(`${out}/8-phone-next-paused.png`)
      check(await stored(b) !== 'iso', 'the VIEW button turns to the next view')
    }
  }
  check(b.errors.length === 0, `no script errors on the phone (${b.errors.slice(0, 2).join(' | ')})`)
  await b.close()
}
process.exit(failed ? 1 : 0)
