#!/usr/bin/env node
// The shell smoke: Neon Shrine's shell (Zelda.vue) in a headless Chrome, as a phone sees it. It loads the game with a
// save, opens the menu on each of its pages with M, N and P, turns the view with V, presses the corner's Sun Prism
// and its chart, and closes with Escape. After every step: the menu's state is the one that step should leave, the
// 16-bit dress is worn exactly in the isometric view, the game's canvas shows a picture, and the page has logged no
// error. The node tests do not run the shell, so run this after a change to it.
//
//   npm run smoke:zelda                       against a dev server on http://localhost:3030 (`npm run dev`)
//   npm run smoke:zelda -- <url> [shotsDir]   against another address, saving a picture of every step
//
// CHROME_BIN names the browser (on a Mac the installed Chrome is found by itself; elsewhere `chromium-browser`). It
// writes only to its own throwaway browser profile, signed in nowhere. Exit code 1 when a check fails.
import { existsSync, mkdirSync } from 'node:fs'
import { launch } from './cdp.mjs'

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!process.env.CHROME_BIN && process.platform === 'darwin' && existsSync(MAC_CHROME)) process.env.CHROME_BIN = MAC_CHROME

const [url = 'http://localhost:3030/', shots] = process.argv.slice(2)
if (shots) mkdirSync(shots, { recursive: true })

/** A game some way in: the blade, the disc in hand, the bomb bag; standing in town. */
const SAVE = {
  v: 2, map: 'overworld', entry: 'hut', hp: 6, maxHp: 8,
  inv: { sword: true, bombBag: true, bombs: 4, disc: true, bits: 12, keys: 0, bigKey: false, pieces: 1, selected: 'disc', prism: false, hook: false, arc: false, bigBag: false, shrooms: 0, keyrings: {} },
  flags: ['item:sword', 'item:disc', 'item:bombBag'], rng: 7, elapsed: 900,
}

let b
let failed = 0
let seenErrors = 0
let step = 0

/** The shell as the page shows it: paused or not, the menu's page (the deck's second button names the next one), the view. */
const read = () => b.eval(`(() => {
  const game = document.querySelector('canvas.zelda-canvas')
  if (!game) return null
  const paused = game.classList.contains('zelda-canvas--paused')
  const next = [...document.querySelectorAll('.zelda-deck-paused .zelda-pad-wide')][1]?.textContent.trim()
  const corner = document.querySelector('.zelda-corner')
  // The picture, shrunk: how many colours the game's canvas shows.
  const c = document.createElement('canvas')
  c.width = 96; c.height = 96
  const g = c.getContext('2d', { willReadFrequently: true })
  g.imageSmoothingEnabled = false
  if (game.width && game.height) g.drawImage(game, 0, 0, 96, 96)
  const d = g.getImageData(0, 0, 96, 96).data
  const colours = new Set()
  for (let i = 0; i < d.length; i += 4) if (d[i + 3]) colours.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
  return {
    paused,
    page: paused ? ({ MOVES: 'items', MAP: 'moves', LOG: 'map', ITEMS: 'log' })[next] ?? '?' + next : null,
    dress: game.classList.contains('px16'),
    view: localStorage.getItem('zelda.view'),
    away: !corner || corner.classList.contains('zelda-corner--away'),
    night: !!corner?.classList.contains('zelda-corner--night'),
    prism: !!document.querySelector('button.zelda-page-prism'),
    blade: !!document.querySelector('button[aria-label="Roll"]'),
    item: !!document.querySelector('button[aria-label="Use item or hop"]'),
    colours: colours.size,
  }
})()`)

/** Waits until `ok` says yes of the shell, `ms` at the most; returns what it last saw. */
async function until(ok, ms = 8000) {
  const end = Date.now() + ms
  let s = await read()
  while (!(s && ok(s)) && Date.now() < end) { await b.sleep(200); s = await read() }
  return s
}

/** Does one thing, waits for the state it should leave, and checks everything. */
async function check(what, act, want) {
  await act()
  const matches = s => Object.entries(want).every(([k, v]) => s[k] === v) && s.colours >= 8
  await until(matches)
  await b.sleep(500)
  const s = await read()
  const wrong = []
  if (!s) wrong.push('no game canvas on the page')
  else {
    for (const [k, v] of Object.entries(want)) if (s[k] !== v) wrong.push(`${k} is ${JSON.stringify(s[k])}, should be ${JSON.stringify(v)}`)
    if (s.colours < 8) wrong.push(`the canvas is blank (${s.colours} colours)`)
    if (!s.paused && s.dress !== (s.view !== 'classic')) wrong.push(`the 16-bit dress is ${s.dress ? 'on' : 'off'} in the ${s.view ?? 'iso'} view`)
  }
  const errors = b.errors.slice(seenErrors)
  seenErrors = b.errors.length
  if (errors.length) wrong.push(`the page logged: ${errors.slice(0, 3).join(' | ').slice(0, 600)}`)
  if (shots) await b.shot(`${shots}/${String(++step).padStart(2, '0')}-${what.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`)
  if (wrong.length) failed++
  console.log(`${wrong.length ? 'FAIL' : 'ok  '} ${what}${wrong.length ? `: ${wrong.join('; ')}` : ''}`)
}

const key = name => () => b.key(name)
/** A finger on the middle of an element. */
const tap = selector => async () => {
  const at = await b.eval(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } })()`)
  if (!at) { console.log(`     (nothing matches ${selector})`); return }
  await b.tap(at.x, at.y)
}
const PLAY = { paused: false, page: null, away: false }
const menu = page => ({ paused: true, page, prism: page === 'map' })

try {
  b = await launch({ width: 390, height: 844, dpr: 2, mobile: true })
  // A first visit to get the address's storage, the save written into it, and the visit that is looked at.
  await b.goto(url)
  if (!await until(() => true, 120_000)) throw new Error(`no Neon Shrine at ${url} (is the dev server up?)`)
  await b.eval(`(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('zeldaSave', ${JSON.stringify(JSON.stringify({ ...SAVE, savedAt: Date.now() }))}); localStorage.setItem('zelda.cornerLessons', '3') })()`)
  seenErrors = b.errors.length
  await check('loads with the save, in play, in the isometric view', async () => {
    await b.goto(url)
    const s = await until(s => !s.night && !s.away && s.dress, 60_000)
    // (Words on arrival are read away, as a player does.)
    for (let i = 0; s?.away && i < 6; i++) await b.key('Enter')
  }, { ...PLAY, view: null, dress: true, blade: true, item: true })
  await check('M opens the menu on its MAP page', key('KeyM'), menu('map'))
  await check('N turns to the MOVES page', key('KeyN'), menu('moves'))
  await check('P turns to the ITEMS page', key('KeyP'), menu('items'))
  await check('Escape closes the menu', key('Escape'), PLAY)
  await check('V turns to the classic view', key('KeyV'), { ...PLAY, view: 'classic', dress: false })
  await check('V turns back to the isometric view', key('KeyV'), { ...PLAY, view: 'iso', dress: true })
  await check("the corner's Sun Prism turns the view", tap('button.zelda-turn'), { ...PLAY, view: 'classic', dress: false })
  await check('and turns it back', tap('button.zelda-turn'), { ...PLAY, view: 'iso', dress: true })
  await check('a press on the chart opens the menu on its MAP page', tap('button.zelda-mini'), menu('map'))
  await check('Escape closes it', key('Escape'), PLAY)
} catch (e) {
  failed++
  console.log(`FAIL ${e.message}`)
} finally {
  await b?.close()
}
console.log(failed ? `${failed} failed` : 'all ok')
process.exit(failed ? 1 : 0)
