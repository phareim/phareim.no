#!/usr/bin/env node
// Lag Din Figur's studio in a real browser: drives a whole flow through
// the UI against a running dev server and screenshots each step. One
// headless Chromium, closed in `finally`; run it under the lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/figur-lab/studio.mjs [baseUrl] [mobile|desktop] [outDir]
//
// Flow: the four styles, hair, a dress and its colours, the drawing board
// (mirror on, a stroke, a fill, undo), save, delete with JA, Pip reading
// "blått hår og rosa kjole", ANGRE, the save sheet and both downloads,
// Escape closing panels. Taps are real touch events on mobile and mouse
// clicks on desktop, at each button's centre. Exits 1 on console errors.
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { launch } from '../zelda-lab/cdp.mjs'

const [baseArg, modeArg, outArg] = process.argv.slice(2)
const base = baseArg || 'http://localhost:3041'
const mobile = (modeArg || 'mobile') === 'mobile'
const out = resolve(outArg || join(homedir(), 'zshots', 'figur-ui'))
const tag = mobile ? 'm' : 'd'
const downloads = join(out, `downloads-${tag}`)
mkdirSync(out, { recursive: true })
rmSync(downloads, { recursive: true, force: true })
mkdirSync(downloads, { recursive: true })

const size = mobile ? { width: 375, height: 667, dpr: 2, mobile: true } : { width: 1280, height: 800, dpr: 1, mobile: false }
const b = await launch(size)
let n = 0
const shot = async (name) => { await b.sleep(350); await b.shot(join(out, `${tag}-${String(++n).padStart(2, '0')}-${name}.png`)) }

/** The centre of the first visible element matching `sel` whose text or aria-label contains `text`. */
async function find(sel, text = '') {
  return b.eval(`(() => {
    const want = ${JSON.stringify(text.toUpperCase())}
    for (const el of document.querySelectorAll(${JSON.stringify(sel)})) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      const label = ((el.getAttribute('aria-label') || '') + ' ' + el.textContent).toUpperCase()
      if (want && !label.includes(want)) continue
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const q = el.getBoundingClientRect()
      return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height }
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }
    }
    return null
  })()`)
}

async function click(x, y) {
  if (mobile) { await b.tap(x, y); return }
  await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 })
  await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 })
  await b.sleep(60)
}

async function press(sel, text = '') {
  const p = await find(sel, text)
  if (!p) throw new Error(`not found: ${sel} "${text}"`)
  await click(p.x, p.y)
  await b.sleep(200)
  return p
}

/** A stroke through the given points (CSS px), one pointer down to up. */
async function drag(points) {
  if (mobile) {
    await b.touch('touchStart', [points[0]])
    for (const p of points.slice(1)) { await b.touch('touchMove', [p]); await b.sleep(16) }
    await b.touch('touchEnd', [])
  } else {
    await b.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...points[0], button: 'left', clickCount: 1 })
    for (const p of points.slice(1)) { await b.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...p, button: 'left', buttons: 1 }); await b.sleep(16) }
    await b.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...points.at(-1), button: 'left', clickCount: 1 })
  }
  await b.sleep(150)
}

async function typeInto(sel, text) {
  const p = await press(sel)
  await b.send('Input.insertText', { text })
  return p
}

const check = (cond, msg) => { if (!cond) throw new Error(msg) }

try {
  await b.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads })
  // A fresh studio: no save, no player.
  await b.goto(base + '/?theme=figur')
  await b.eval('localStorage.clear(); sessionStorage.clear(); true')
  await b.goto(base + '/?theme=figur')
  await b.sleep(1500)
  // The dev server's devtools pill sits over the tool tabs: hide it for the pictures.
  await b.eval(`(() => { const st = document.createElement('style'); st.textContent = '[id^=nuxt-devtools], nuxt-devtools-frame { display: none !important }'; document.head.appendChild(st); return true })()`)
  check(await find('.fg-stage-canvas'), 'the stage is not there')
  await shot('start')

  // The four styles, by tab (and back to Minecraft with the 1 key on desktop).
  for (const [i, id] of ['MINECRAFT', 'ROBLOX', 'TOCA', 'AVATAR'].entries()) {
    await press('.fg-style', mobile ? ['MINE', 'ROBL', 'TOCA', 'AVAT'][i] : id)
    await shot(`style-${id.toLowerCase()}`)
  }
  const style = await b.eval('window.__figur.game.active.value.style')
  check(style === 'avatar', `style is ${style}`)

  // Hair: afro, pink.
  await press('.fg-tooltab', 'HÅR')
  await press('.fg-tile', 'Afro')
  await press('.fg-tile', 'Rosa')
  await shot('hair')

  // Body: star eyes, freckles.
  await press('.fg-tooltab', 'KROPP')
  await press('.fg-tile', 'Stjerneøyne')
  await press('.fg-tile', 'FREGNER')
  await shot('body')

  // A dress, then its colour.
  await press('.fg-tooltab', 'KLÆR')
  await press('.fg-subtab', 'Kjoler')
  await press('.fg-tile', 'Prinsessekjole')
  await shot('dress')
  check((await b.eval('window.__figur.game.active.value.outfit.top?.id')) === 'prinsessekjole', 'the dress is not on')

  // Draw on it: mirror is on; a stroke across the skirt, a fill, undo the fill.
  await press('.fg-drawon')
  await b.sleep(400)
  await shot('board')
  const grid = await b.eval(`(() => { const r = document.querySelector('.fg-board-grid').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height } })()`)
  const cell = grid.w / 16
  const at = (cx, cy) => ({ x: grid.x + (cx + 0.5) * cell, y: grid.y + (cy + 0.5) * cell })
  await press('.fg-board-swatch', '') // first swatch: white
  await press('.fg-tool', 'Blyant')
  await drag([at(4, 17), at(5, 18), at(6, 19), at(6, 20)])
  const painted = await b.eval(`[...document.querySelectorAll('.fg-board-swatch')].length`)
  check(painted === 24, `palette has ${painted}`)
  await press('.fg-tool', 'Fyll')
  const swatches = await b.eval(`(() => [...document.querySelectorAll('.fg-board-swatch')].map(e => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }))()`)
  await click(swatches[18].x, swatches[18].y)
  await click(at(8, 8).x, at(8, 8).y)
  await shot('board-filled')
  await press('.fg-tool', 'Angre')
  await shot('board-undone')
  await press('.fg-board-head .fg-btn--go')
  await shot('board-name')
  await press('.fg-board-name .fg-btn--go')
  await b.sleep(300)
  const closet = await b.eval('window.__figur.game.closet.value.map(d => d.name)')
  check(closet.length === 1, `closet: ${JSON.stringify(closet)}`)
  check((await b.eval('window.__figur.game.active.value.outfit.top?.id')).startsWith('d-'), 'the drawn dress is not worn')
  await shot('saved')

  // Delete it from Mine klær: the question, then JA.
  await press('.fg-trash')
  await shot('ask-delete')
  await press('.fg-ask .fg-btn--danger')
  check((await b.eval('window.__figur.game.closet.value.length')) === 0, 'not deleted')
  await shot('deleted')

  // Pip reads Norwegian.
  await press('.fg-pipbtn')
  await shot('pip')
  await press('.fg-pip-btn', 'Skriv')
  await typeInto('.fg-pip-input', 'blått hår og rosa kjole')
  await press('.fg-pip button[type=submit]')
  await shot('pip-said')
  const said = await b.eval(`document.querySelector('.fg-pip-say').textContent`)
  console.log('Pip:', said)
  const hair = await b.eval('window.__figur.game.active.value.body.hairColor')
  check(hair === '#4f9dff', `hair is ${hair}`)
  await press('.fg-pip-undo button')
  check((await b.eval('window.__figur.game.active.value.body.hairColor')) !== '#4f9dff', 'ANGRE did not undo')
  await press('.fg-pip button', 'TILBAKE')
  await press('.fg-pip-btn', 'Lag en figur')
  await shot('pip-surprise')

  // Save the picture, then the Minecraft skin.
  await press('.fg-style', mobile ? 'MINE' : 'MINECRAFT')
  await press('.fg-headbtn', 'Lagre')
  await shot('share')
  await press('.fg-sheet .fg-btn', 'LAGRE BILDE')
  await press('.fg-sheet .fg-btn', 'MINECRAFT-SKIN')
  await b.sleep(1200)
  const files = readdirSync(downloads)
  console.log('downloads:', files.join(', '))
  check(files.some(f => /^figur-.*-minecraft\.png$/.test(f)) && files.some(f => /-skin\.png$/.test(f)), 'downloads missing')

  // Escape closes the sheet and is kept from the shell; with nothing open the page stays the studio until the shell acts.
  await b.key('Escape')
  await b.sleep(300)
  check(!(await find('.fg-sheet')), 'Escape did not close the sheet')
  check((await b.eval('location.search')).includes('figur'), 'Escape left the game')

  // Figures: a second one, the list.
  await press('.fg-headbtn', 'Mine figurer')
  await press('.fg-sheet-foot .fg-btn--go')
  await press('.fg-headbtn', 'Mine figurer')
  await shot('figures')
  await b.key('Escape')

  // The board for the biggest piece (a dress from blank) must fit.
  await press('.fg-tooltab', 'TEGN')
  await shot('draw-tab')
  await press('.fg-tile', 'Kjole')
  await b.sleep(300)
  const fit = await b.eval(`(() => { const r = document.querySelector('.fg-board-grid').getBoundingClientRect(); return { right: r.right, bottom: r.bottom, cell: r.width / 16, vw: innerWidth, vh: innerHeight } })()`)
  console.log('dress board:', JSON.stringify(fit))
  check(fit.right <= fit.vw && fit.bottom <= fit.vh, 'the dress board does not fit')
  await shot('board-dress')
  await b.key('Escape')

  // Nothing on the page scrolls.
  const scroll = await b.eval('[document.documentElement.scrollHeight - innerHeight, document.documentElement.scrollWidth - innerWidth]')
  console.log('overflow:', JSON.stringify(scroll))

  console.log(b.errors.length ? `ERRORS:\n${b.errors.join('\n')}` : 'no console errors')
  if (b.errors.length) process.exitCode = 1
} catch (err) {
  console.error('FAILED:', err.message)
  try { await shot('failed') } catch { /* browser gone */ }
  if (b.errors.length) console.error('console errors:\n' + b.errors.join('\n'))
  process.exitCode = 1
} finally {
  await b.close()
}
