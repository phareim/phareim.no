#!/usr/bin/env node
// A cabinet's YES / NO question, headless against the dev server: the hero
// at the Galaga cabinet, the lines read to the question, the cursor on NO,
// backing out with NO and with an Escape tap, and (touch) a tap on the NO half.
//
//   flock /tmp/claude-1000/chrome.lock node scripts/zelda-lab/exit-shot.mjs <devUrl> <outDir>
//
// outDir must be a non-hidden path under $HOME (snap Chromium).
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './cdp.mjs'

const [base = 'http://127.0.0.1:3030/', outArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: exit-shot.mjs <devUrl> <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

async function run(label, { width, height, dpr, mobile }) {
  const b = await launch({ width, height, dpr, mobile })
  const shot = name => b.shot(join(out, `${label}-${name}.png`))
  const state = () => b.eval(`(() => { const s = window.__portal.state; const d = s.dialog; return s.mode + (d ? ' line ' + d.line + '/' + d.lines.length + ' choice ' + d.choice : '') + ' ' + location.search })()`)
  const tapAt = async (fx) => { const w = await b.eval('innerWidth'); const h = await b.eval('innerHeight'); await b.tap(w * fx, h * 0.5) }
  const a = async () => { if (mobile) await tapAt(0.8); else await b.key('Space'); await b.sleep(1600) }
  const report = {}
  try {
    await b.goto(base)
    await b.eval(`sessionStorage.setItem('portal.return', JSON.stringify({ map: 'arcade', entry: 'galaga' }))`)
    await b.goto(base)
    await b.sleep(900)
    // Open and read to the question.
    await a()
    for (let k = 0; k < 6; k++) {
      const s = await b.eval(`(() => { const d = window.__portal.state.dialog; return d && d.line === d.lines.length - 1 })()`)
      if (s) break
      await a()
    }
    await b.sleep(1500)
    report.question = await state()
    await shot('question')
    if (mobile) {
      await tapAt(0.8)
      await b.sleep(600)
      report.afterTapNo = await state()
      await shot('after-no')
    } else {
      await b.key('ArrowRight')
      await b.sleep(200)
      report.cursorNo = await state()
      await shot('no')
      await b.key('Space')
      await b.sleep(600)
      report.afterNo = await state()
      await shot('after-no')
      // Again, then an Escape tap.
      await a()
      report.reopened = await state()
      await b.key('Escape')
      await b.sleep(600)
      report.afterEsc = await state()
    }
  } finally { await b.close() }
  return report
}

console.log(JSON.stringify({
  desktop: await run('desktop', { width: 1280, height: 800, dpr: 1, mobile: false }),
  phone: await run('phone', { width: 390, height: 844, dpr: 2, mobile: true }),
}, null, 2))
