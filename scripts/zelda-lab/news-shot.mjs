#!/usr/bin/env node
// The newsstand on the coast, headless against the dev server and the real
// feed (sleeper.phareim.md): the hero at the stand, the rack, a piece from
// top to notes (headline, quote, code, table, pictures, a live cell's line),
// back to the rack, closed with Escape, and the feed unreachable (failed over
// CDP). One browser at a time on Sleeper:
//
//   heavy -x chrome -- node scripts/zelda-lab/news-shot.mjs <devUrl> <outDir>
//
// outDir must be a non-hidden path under $HOME (snap Chromium).
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from './cdp.mjs'

const [base = 'http://127.0.0.1:3030/', outArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: news-shot.mjs <devUrl> <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

/** What to look at in each piece: a name and the first element matching the selector, scrolled to the top of the reader. */
const SIGHTS = {
  'neon-shrine': [['figs', '.n-figs'], ['quote', 'blockquote'], ['four', '.n-four'], ['notes', '.nw-notes']],
  'radio-motoren': [['live', '.n-live'], ['code', 'pre'], ['list', 'ul']],
  eventyrland: [['table', 'table'], ['three', '.n-three'], ['code', 'pre']],
  'hvordan-en-ai-skriver': [['h2', '.nw-body h2'], ['list', 'ol']],
}

async function run(label, { width, height, dpr, mobile }) {
  const b = await launch({ width, height, dpr, mobile })
  const shot = name => b.shot(join(out, `${label}-${name}.png`))
  const view = () => b.eval(`(() => { const x = document.querySelector('.nw-box'); if (!x) return null; return x.querySelector('.nw-prose') ? 'piece' : x.querySelector('.nw-rack') ? 'rack' : 'screen' })()`)
  const center = sel => b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  const pressA = async () => {
    if (mobile) {
      const r = await center('.zelda-pad-a')
      if (!r) throw new Error('no A pad')
      await b.tap(r.x, r.y)
    } else await b.key('Space')
    await b.sleep(2500)
  }
  const atStand = async () => {
    await b.goto(base)
    await b.eval(`sessionStorage.setItem('portal.return', JSON.stringify({ map: 'overworld', entry: 'kiosk' }))`)
    await b.goto(base)
    await b.sleep(800)
  }
  const report = {}
  try {
    await atStand()
    report.at = await b.eval(`(() => { const s = window.__portal.state; return s.map.id + ' ' + Math.floor(s.hero.x) + ',' + Math.floor(s.hero.y) + ' ' + s.hero.dir })()`)
    await shot('stand')

    await pressA()
    report.opened = await view()
    report.rack = await b.eval(`[...document.querySelectorAll('.nw-item-title')].map(e => e.textContent)`)
    report.box = await b.eval(`(() => { const r = document.querySelector('.nw-box').getBoundingClientRect(); return [r.x, r.y, r.width, r.height, innerWidth, innerHeight].map(Math.round).join(' ') })()`)
    await shot('rack')
    if (!mobile) { await b.key('ArrowDown'); await b.sleep(200); await shot('rack-second'); await b.key('ArrowUp') }

    report.pieces = {}
    const slugs = Object.keys(SIGHTS)
    for (let i = 0; i < report.rack.length; i++) {
      const items = `document.querySelectorAll('.nw-item')[${i}]`
      const title = report.rack[i]
      if (mobile) {
        await b.eval(`${items}.scrollIntoView({ block: 'center' })`)
        const r = await b.eval(`(() => { const r = ${items}.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
        await b.tap(r.x, r.y)
      } else {
        // The rack remembers the piece read last: up to the first one, then down to this one.
        for (let k = 0; k < report.rack.length + 2; k++) await b.key('ArrowUp')
        for (let k = 0; k < i; k++) await b.key('ArrowDown')
        await b.key('Enter')
      }
      await b.sleep(2500)
      const slug = await b.eval(`(() => { const a = [...document.querySelectorAll('.nw-btn')].find(x => x.textContent.includes('BROWSER')); return a ? new URL(a.href).pathname.replace(/\\//g, '') : null })()`)
      const p = report.pieces[slug ?? title] = { view: await view() }
      p.measure = await b.eval(`(() => { const s = document.querySelector('.nw-scroll'); const p = document.querySelector('.nw-body > p:not([class])'); const cs = getComputedStyle(p); return { font: cs.fontFamily.split(',')[0] + ' ' + cs.fontSize + '/' + cs.lineHeight, columnPx: Math.round(p.getBoundingClientRect().width), scroll: s.scrollHeight + '/' + s.clientHeight, overflowX: s.scrollWidth > s.clientWidth } })()`)
      await shot(`${slug}-top`)
      for (const [name, sel] of SIGHTS[slug] ?? []) {
        const found = await b.eval(`(() => { const s = document.querySelector('.nw-scroll'); const e = s.querySelector(${JSON.stringify(sel)}); if (!e) return false; s.scrollTop += e.getBoundingClientRect().top - s.getBoundingClientRect().top - 16; return true })()`)
        if (!found) { p[name] = 'missing'; continue }
        await b.sleep(900)
        await shot(`${slug}-${name}`)
      }
      if (!mobile && i === 0) {
        // The keys: Home, a page, three lines, End.
        const top = () => b.eval(`document.querySelector('.nw-scroll').scrollTop`)
        await b.key('Home'); const t0 = await top()
        await b.key('Space'); const t1 = await top()
        await b.key('ArrowDown'); const t2 = await top()
        await b.key('End'); const t3 = await top()
        p.keys = { home: t0, page: t1 - t0, line: t2 - t1, end: t3 }
        await b.sleep(600)
        await shot(`${slug}-end`)
        // Left and right change piece.
        await b.key('ArrowRight'); await b.sleep(2500)
        p.right = await b.eval(`document.querySelector('.nw-headline')?.textContent`)
        await b.key('ArrowLeft'); await b.sleep(1200)
        p.left = await b.eval(`document.querySelector('.nw-headline')?.textContent`)
      }
      // Back to the rack.
      if (mobile) { const r = await b.eval(`(() => { const e = [...document.querySelectorAll('.nw-btn')].find(x => x.textContent.includes('BACK')); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`); await b.tap(r.x, r.y) } else await b.key('Escape')
      await b.sleep(500)
      p.backTo = await view()
      if (!slugs.includes(slug)) p.note = 'no sights listed for this piece'
    }
    await shot('rack-after')

    // Escape closes the stand; the hero is where they stood.
    if (mobile) { const r = await center('.nw-x'); await b.tap(r.x, r.y) } else await b.key('Escape')
    await b.sleep(500)
    report.closed = (await view()) === null
    report.after = await b.eval(`window.__portal.state.map.id + ' ' + window.__portal.state.mode + ' ' + location.search`)
    await shot('closed')

    // The feed unreachable: a fresh page, so nothing fetched before is remembered.
    b.on('Fetch.requestPaused', p => b.send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'NameNotResolved' }))
    await b.send('Fetch.enable', { patterns: [{ urlPattern: 'https://sleeper.phareim.md/*' }] })
    await atStand()
    await pressA()
    report.offline = await b.eval(`document.querySelector('.nw-box')?.innerText ?? null`)
    await shot('offline')
    report.errors = b.errors
  } finally {
    await b.close()
  }
  return report
}

for (const [label, vp] of [
  ['phone-390', { width: 390, height: 844, dpr: 3, mobile: true }],
  ['phone-375', { width: 375, height: 667, dpr: 2, mobile: true }],
  ['desktop-1280', { width: 1280, height: 800, dpr: 1, mobile: false }],
]) {
  if (process.env.NEWS_SHOT_ONLY && !label.includes(process.env.NEWS_SHOT_ONLY)) continue
  const r = await run(label, vp)
  console.log(label, JSON.stringify(r, null, 1))
}
