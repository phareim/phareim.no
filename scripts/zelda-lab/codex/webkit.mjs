// WebKit at iPhone size (part 23): the built site's start in each view, and the lab's boss rooms (the lab bundle
// _shot.html, isometric) so the bosses' art is on screen; the console errors of each.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
// Playwright is not one of the repo's packages: PLAYWRIGHT_DIR names a node_modules that has it (an npx cache, say).
const req = createRequire(process.env.PLAYWRIGHT_DIR ? `${process.env.PLAYWRIGHT_DIR.replace(/\/$/, '')}/x.js` : import.meta.url)
const { webkit, devices } = req('playwright')
const [base, lab, out] = process.argv.slice(2)
const browser = await webkit.launch({ executablePath: process.env.WK ?? undefined })
const res = {}
async function visit(name, url, wait) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  page.on('pageerror', e => errs.push('pageerror: ' + e.message))
  await page.goto(url, { waitUntil: 'load' })
  await page.waitForTimeout(wait)
  await page.screenshot({ path: `${out}/webkit-390-${name}.png` })
  res[name] = errs
  await ctx.close()
}
for (const view of ['classic', 'iso', 'poly']) await visit(view, `${base}/?view=${view}`, 9000)
for (const scene of ['r-beach', 'w-camp', 'w-lab', 'r-home', 'hut', 'l-lobby', 'l-llama', 'r-plaza'])
  await visit(`lab-${scene}`, `file://${lab}#scene=${scene}&w=390&h=844&dpr=3&top=0&touch=1&view=iso`, 5000)
await browser.close()
writeFileSync(`${out}/webkit-errors.json`, JSON.stringify(res, null, 1))
console.log(JSON.stringify(res, null, 1))
