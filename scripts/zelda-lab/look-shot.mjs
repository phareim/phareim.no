#!/usr/bin/env node
// The NEW LOOK stall on the square, headless against the dev server: the hero
// at the counter, the mirror open, a row changed with the keys, GIRL, WEAR IT
// (the look lands in localStorage `zelda.heroLook` and on the hero), the
// mirror opened again on that look, and RANDOM left with NEVER MIND and with
// Escape (nothing changes); last, a figure made in Lag Din Figur after the
// look takes over again. On a phone the same with taps. One browser at a
// time on Sleeper:
//
//   heavy -x chrome -- node scripts/zelda-lab/look-shot.mjs <devUrl> <outDir>
//
// outDir must be a non-hidden path under $HOME (snap Chromium). Prints a
// report as JSON and exits 1 when a step did not hold.
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './cdp.mjs'

const [base = 'http://127.0.0.1:3030/', outArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: look-shot.mjs <devUrl> <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

async function run(label, { width, height, dpr, mobile }) {
  const b = await launch({ width, height, dpr, mobile })
  const shot = name => b.shot(join(out, `${label}-${name}.png`))
  const open = () => b.eval(`!!document.querySelector('.look-box')`)
  const stored = () => b.eval(`localStorage.getItem('zelda.heroLook')`)
  const rowsText = () => b.eval(`[...document.querySelectorAll('.look-row')].map(r => r.querySelector('.look-label').innerText + '=' + r.querySelector('.look-pick').innerText.trim()).join(' | ')`)
  const centre = sel => b.eval(`(() => { const e = ${sel}; if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  const button = text => `[...document.querySelectorAll('.look-btn')].find(e => e.innerText.trim() === ${JSON.stringify(text)})`
  /** Press a thing: a tap on a phone, a real click with the mouse elsewhere. */
  const hit = async sel => {
    const p = await centre(sel)
    if (!p) throw new Error('nothing to press: ' + sel)
    if (mobile) await b.tap(p.x, p.y)
    else await b.eval(`${sel}.click()`)
    await b.sleep(250)
  }
  const pressA = async () => {
    if (mobile) await hit(`document.querySelector('.zelda-pad-a')`)
    else await b.key('Space')
    await b.sleep(700)
  }
  const report = { label }
  try {
    await b.goto(base)
    // A clean slate, standing at the stall's counter (the entry the exit registers under its id).
    await b.eval(`localStorage.removeItem('zelda.heroLook'); localStorage.removeItem('figur.heroColors'); localStorage.removeItem('miniworld.heroColors'); sessionStorage.setItem('portal.return', JSON.stringify({ map: 'overworld', entry: 'look' }))`)
    await b.goto(base)
    await b.sleep(800)
    report.at = await b.eval(`(() => { const s = window.__portal.state; return s.map.id + ' ' + Math.floor(s.hero.x) + ',' + Math.floor(s.hero.y) + ' ' + s.hero.dir })()`)
    await shot('1-stall')

    await pressA()
    report.opened = await open()
    report.rows = await rowsText()
    report.fits = await b.eval(`(() => { const r = document.querySelector('.look-box').getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth })()`)
    report.box = await b.eval(`(() => { const r = document.querySelector('.look-box').getBoundingClientRect(); const l = document.querySelector('.look-rows'); return { w: Math.round(r.width), h: Math.round(r.height), view: innerWidth + 'x' + innerHeight, listScrolls: l.scrollHeight > l.clientHeight + 1 } })()`)
    await shot('2-mirror')

    // One row with the keys (or its arrow): the hair goes from SHORT to LONG and nothing is worn yet.
    await b.sleep(400)
    if (mobile) await hit(`document.querySelector('.look-row .look-arrow:last-child')`)
    else { await b.key('ArrowRight'); await b.sleep(200) }
    report.hairStepped = (await rowsText()).startsWith('HAIR=LONG')
    report.nothingWornYet = (await stored()) === null

    await hit(button('GIRL'))
    report.girlRows = await rowsText()
    await shot('3-girl')
    await hit(button('WEAR IT'))
    await b.sleep(500)
    report.closedByWear = !(await open())
    report.stored = await stored()
    report.mode = await b.eval(`window.__portal.state.mode`)
    await b.sleep(400)
    await shot('4-worn')

    // Again: the mirror starts on what is worn; RANDOM and NEVER MIND change nothing.
    await pressA()
    report.reopenedOnWorn = (await rowsText()) === report.girlRows
    await b.sleep(400)
    await hit(button('RANDOM'))
    report.randomRows = await rowsText()
    await shot('5-random')
    await hit(button('NEVER MIND'))
    await b.sleep(400)
    report.closedByNeverMind = !(await open())
    report.unchangedAfterNeverMind = (await stored()) === report.stored

    if (!mobile) {
      // Escape leaves too; the game behind never heard the keys (still in play, still at the stall).
      await pressA()
      await b.sleep(400)
      await b.key('ArrowDown'); await b.key('ArrowRight'); await b.key('ArrowRight')
      await b.key('Escape')
      await b.sleep(400)
      report.closedByEscape = !(await open())
      report.unchangedAfterEscape = (await stored()) === report.stored
      report.stillThere = await b.eval(`(() => { const s = window.__portal.state; return s.map.id + ' ' + s.mode + ' ' + Math.floor(s.hero.x) + ',' + Math.floor(s.hero.y) + ' ' + location.search })()`)
      // BOY with the keys: up to the whole looks, Enter, down to WEAR IT, Enter.
      await pressA()
      await b.sleep(400)
      await b.key('ArrowUp'); await b.key('Enter'); await b.sleep(200)
      await b.key('ArrowUp'); await b.key('Enter'); await b.sleep(500)
      report.boyByKeys = await stored()
      report.closedByKeys = !(await open())
      // A figure made after the look is the newer choice: the next visit wears it and forgets the look.
      await b.eval(`localStorage.setItem('figur.heroColors', JSON.stringify({ skin: '#e6a57e', skinShade: '#b0704e', hair: '#ffd23f', hairShade: '#c4861c', band: '#2ff3ff', top: '#ff3b5c', topShade: '#9e1638', topAccent: '#fff4ff', bottom: '#2f5fd0', shoes: '#1c1030' }))`)
      await b.goto(base)
      await b.sleep(800)
      report.figureTookOver = (await stored()) === null
      await shot('6-figure')
      // And a look chosen over that figure is worn again, with MY FIGURE on offer.
      await pressA()
      await b.sleep(400)
      report.figureOffered = await b.eval(`[...document.querySelectorAll('.look-btn')].some(e => e.innerText.trim() === 'MY FIGURE')`)
      await hit(button('GIRL'))
      await hit(button('WEAR IT'))
      await b.sleep(400)
      await b.goto(base)
      await b.sleep(800)
      report.lookOverFigureKept = girl({ stored: await stored() })
      await b.eval(`localStorage.removeItem('figur.heroColors'); localStorage.removeItem('zelda.heroLook')`)
    }
  } catch (e) {
    report.error = String(e?.message ?? e)
  } finally {
    await b.close()
  }
  return report
}

const girl = r => { try { const l = JSON.parse(r.stored); return l.hair === 'long' && l.head === 'bow' && l.bottom === 'skirt' } catch { return false } }
const reports = []
reports.push(await run('desktop', { width: 1280, height: 800, dpr: 1, mobile: false }))
reports.push(await run('phone', { width: 375, height: 667, dpr: 2, mobile: true }))
reports.push(await run('phone-wide', { width: 667, height: 375, dpr: 2, mobile: true }))
console.log(JSON.stringify(reports, null, 2))

const bad = []
for (const r of reports) {
  const must = { opened: r.opened, fits: r.fits, hairStepped: r.hairStepped, nothingWornYet: r.nothingWornYet, closedByWear: r.closedByWear, girl: girl(r), play: r.mode === 'play', reopenedOnWorn: r.reopenedOnWorn, closedByNeverMind: r.closedByNeverMind, unchangedAfterNeverMind: r.unchangedAfterNeverMind }
  if (r.label === 'desktop') Object.assign(must, { closedByEscape: r.closedByEscape, unchangedAfterEscape: r.unchangedAfterEscape, closedByKeys: r.closedByKeys, figureTookOver: r.figureTookOver, figureOffered: r.figureOffered, lookOverFigureKept: r.lookOverFigureKept, boyByKeys: (() => { try { return JSON.parse(r.boyByKeys).hair === 'short' } catch { return false } })() })
  for (const [k, v] of Object.entries(must)) if (!v) bad.push(`${r.label}: ${k}`)
  if (r.error) bad.push(`${r.label}: ${r.error}`)
}
if (bad.length) { console.error('FAILED: ' + bad.join(', ')); process.exit(1) }
console.log('ok')
