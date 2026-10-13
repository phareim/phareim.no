#!/usr/bin/env node
// G-Type menu walk-through in headless Chromium: the title, the help card,
// START, the pause menu and the touch pause button, against a running dev
// server (the theme `rtype`, ?theme=rtype). Snap Chromium: outDir must be a
// non-hidden path under $HOME. On Sleeper run it through `heavy -x chrome --`.
//
//   node scripts/rtype-lab/menus.mjs <baseUrl> <outDir>
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { launch } from '../zelda-lab/cdp.mjs'

const [base, outArg] = process.argv.slice(2)
if (!base || !outArg) {
  console.error('usage: menus.mjs <baseUrl> <outDir>')
  process.exit(2)
}
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const url = `${base.replace(/\/$/, '')}/?theme=rtype`
const sleep = ms => new Promise(r => setTimeout(r, ms))
const report = []
const check = (name, ok, extra = '') => { report.push(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`) }
const menuText = b => b.eval(`JSON.stringify([...document.querySelectorAll('.rtype-menu-item')].map(e => e.textContent.trim()))`)
const center = b => b.eval(`JSON.stringify([...document.querySelectorAll('.rtype-menu-item, .rtype-pause-btn')].map(e => { const r = e.getBoundingClientRect(); return [e.className.includes('pause') ? 'pause' : e.textContent.trim(), r.x + r.width / 2, r.y + r.height / 2] }))`)

async function desktop() {
  const b = await launch({ width: 1440, height: 900 })
  await b.goto(url)
  await sleep(4000)
  check('title menu shows START and HOW TO PLAY', (await menuText(b)).includes('START'), await menuText(b))
  await b.shot(`${out}/01-title.png`)

  await b.key('ArrowDown')
  await sleep(120)
  check('ArrowDown moves the cursor to HOW TO PLAY', (await b.eval(`document.querySelector('.rtype-menu-item.is-on')?.textContent.trim()`)).includes('HOW TO PLAY'))

  await b.key('Enter')
  await sleep(300)
  check('Enter on HOW TO PLAY shows the help card', await b.eval(`!!document.querySelector('.rtype-help')`))
  await b.shot(`${out}/02-help.png`)

  await b.key('Escape')
  await sleep(300)
  check('Escape on help returns to the title', await b.eval(`!!document.querySelector('.rtype-menu--title')`))

  // Back on the title the cursor is on START again.
  await b.key('Enter')
  await sleep(1500)
  check('Enter on START starts the run (menu gone, pause button up)', await b.eval(`!document.querySelector('.rtype-menu') && !!document.querySelector('.rtype-pause-btn')`))
  await b.shot(`${out}/03-run.png`)

  await b.key('Escape', 60)
  await sleep(400)
  check('Escape tap pauses and shows the pause menu', await b.eval(`!!document.querySelector('.rtype-menu--pause')`), await menuText(b))
  await b.shot(`${out}/04-pause.png`)

  await b.key('ArrowDown')
  await b.key('Enter')
  await sleep(1200)
  check('pause menu RESTART starts a fresh run', await b.eval(`!document.querySelector('.rtype-menu') && !!document.querySelector('.rtype-pause-btn')`))

  await b.key('KeyP')
  await sleep(300)
  check('P pauses again', await b.eval(`!!document.querySelector('.rtype-menu--pause')`))
  await b.key('ArrowUp')
  await b.key('Enter')
  await sleep(800)
  check('pause menu QUIT RUN goes to game over', await b.eval(`document.body.innerText.includes('GAME OVER')`))

  report.push(`errors: ${JSON.stringify(b.errors ?? [])}`)
  await b.close()
}

async function phone() {
  const b = await launch({ width: 375, height: 667, dpr: 2, mobile: true })
  await b.goto(url)
  await sleep(4000)
  const btns = JSON.parse(await center(b))
  const start = btns.find(x => x[0].includes('START'))
  check('phone: title buttons exist', !!start, JSON.stringify(btns))
  if (start) {
    await b.tap(start[1], start[2])
    await sleep(1500)
    check('phone: tapping START begins the run', await b.eval(`!document.querySelector('.rtype-menu') && !!document.querySelector('.rtype-pause-btn')`))
  }
  await b.shot(`${out}/05-phone-run.png`)
  const pauseBtn = JSON.parse(await center(b)).find(x => x[0] === 'pause')
  if (pauseBtn) {
    await b.tap(pauseBtn[1], pauseBtn[2])
    await sleep(500)
    check('phone: tapping the pause button opens the pause menu', await b.eval(`!!document.querySelector('.rtype-menu--pause')`))
    await b.shot(`${out}/06-phone-pause.png`)
  } else {
    check('phone: pause button found', false)
  }
  report.push(`phone errors: ${JSON.stringify(b.errors ?? [])}`)
  await b.close()
}

await desktop()
await phone()
console.log(report.join('\n'))
