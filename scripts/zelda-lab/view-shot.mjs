#!/usr/bin/env node
// Turn between Neon Shrine's views on a running site and take pictures:
// classic, halfway through the turn, isometric, a few steps in it, back.
// Then the same on a phone, with the VIEW chip.
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
  await b.shot(`${out}/1-classic.png`)
  await b.key('KeyV')
  await b.sleep(260)
  await b.shot(`${out}/2-turning.png`)
  await b.sleep(1200)
  await b.shot(`${out}/3-iso.png`)
  check(await stored(b) === 'iso', 'V turns to the isometric view and the browser remembers it')
  // Up on the keys is up on the screen: the hero walks away from the door, north-west in the world.
  await b.hold('ArrowDown', 700)
  await b.hold('ArrowRight', 500)
  await b.sleep(200)
  await b.shot(`${out}/4-iso-walked.png`)
  await b.key('KeyP')
  await b.sleep(300)
  await b.shot(`${out}/5-iso-paused.png`)
  await b.key('KeyV')
  await b.sleep(300)
  await b.shot(`${out}/6-classic-paused.png`)
  check(await stored(b) === 'classic', 'V on the pause screen turns back')
  await b.key('KeyP')
  check(b.errors.length === 0, `no script errors on the desktop (${b.errors.slice(0, 2).join(' | ')})`)
  await b.close()
}
{
  const b = await launch({ width: 390, height: 844, dpr: 2, mobile: true })
  await b.goto(`${base}/?view=iso`)
  await b.sleep(2500)
  await b.shot(`${out}/7-phone-iso-from-address.png`)
  const chip = await b.eval(`(() => { const e = document.querySelector('button[aria-label="Change view"]'); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  check(!!chip, 'the VIEW chip is on the touch deck')
  if (chip) {
    await b.tap(chip.x, chip.y)
    await b.sleep(1300)
    await b.shot(`${out}/8-phone-classic.png`)
    check(await stored(b) === 'classic', 'the VIEW chip turns back to the classic view')
  }
  check(b.errors.length === 0, `no script errors on the phone (${b.errors.slice(0, 2).join(' | ')})`)
  await b.close()
}
process.exit(failed ? 1 : 0)
