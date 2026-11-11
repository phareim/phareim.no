// Screenshots of Invasive: the title, then a run the autopilot plays
// (`&bot`, dev server only), one picture every few seconds.
//
//   node scripts/invasive-lab/shot.mjs <devUrl> <outDir> [phone|desk] [seconds] [every]
//
// Needs the dev server (`npm run dev`) and a Playwright with Chromium.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const { chromium } = createRequire(import.meta.url)('playwright')
const [base = 'http://localhost:3030', out = '.', mode = 'desk', secs = '60', every = '6'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })

const browser = await chromium.launch()
const ctx = mode === 'phone'
  ? await browser.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  : await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', e => errors.push(String(e)))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })

await page.goto(`${base}/?theme=invasive&bot`, { waitUntil: 'networkidle' })
await page.waitForTimeout(3000)
await page.screenshot({ path: `${out}/${mode}-title.png` })
if (mode === 'phone') await page.touchscreen.tap(187, 420)
else await page.keyboard.press('Enter')

const t0 = Date.now()
let n = 0
while (Date.now() - t0 < Number(secs) * 1000) {
  await page.waitForTimeout(Number(every) * 1000)
  await page.screenshot({ path: `${out}/${mode}-${String(++n).padStart(2, '0')}.png` })
}
console.log(errors.length ? `errors:\n${errors.slice(0, 10).join('\n')}` : 'no page errors')
await browser.close()
