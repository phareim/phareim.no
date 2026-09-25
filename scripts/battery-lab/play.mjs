#!/usr/bin/env node
// Play Night of the Dead Battery in the real page (dev server) with real
// mouse clicks, one headless Chromium, screenshots along the way:
//   flock /tmp/claude-1000/chrome.lock node scripts/battery-lab/play.mjs <url> <outDir> [w h dpr]
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { launch } from '../zelda-lab/cdp.mjs'

const [url, outArg, W = '1280', H = '800', DPR = '1'] = process.argv.slice(2)
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const w = +W, h = +H, dpr = +DPR
const b = await launch({ width: w, height: h, dpr, mobile: w < 700 })
const shot = async name => { await b.shot(join(out, name + '.png')); console.log(join(out, name + '.png')) }
const mouse = async (type, x, y, button = 'left') => b.send('Input.dispatchMouseEvent', { type, x, y, button, clickCount: 1, pointerType: 'mouse' })
const click = async (x, y, button = 'left') => { await mouse('mouseMoved', x, y); await mouse('mousePressed', x, y, button); await b.sleep(40); await mouse('mouseReleased', x, y, button); await b.sleep(120) }
const tap = async (x, y) => { await b.tap(x, y); await b.sleep(150) }
const G = expr => b.eval(`(() => { const g = window.__battery; return ${expr} })()`)
// Logical → CSS px on the canvas (the stage centres a whole-number scale).
const toCss = async (lx, ly) => b.eval(`(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); const s = window.__battery ? null : null; return [r.left, r.top, r.width, c.width] })()`)
try {
  await b.goto(url)
  await b.sleep(4000)
  await shot('01-title')
  const btn = await b.eval(`(() => { const e = [...document.querySelectorAll('button')].find(x => /NEW GAME/.test(x.textContent)); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })()`)
  if (!btn) throw new Error('no NEW GAME button')
  if (w < 700) await tap(btn[0], btn[1]); else await click(btn[0], btn[1])
  await b.sleep(2500)
  await shot('02-intro-card')
  // Skip through the intro with clicks on the scene.
  for (let i = 0; i < 140; i++) {
    const busy = await G('g && !g.idle')
    if (!busy) break
    if (w < 700) await tap(w / 2, h / 3); else await click(w / 2, h / 4)
    await b.sleep(250)
    if (i === 12) await shot('03-intro-mid')
    if (i === 40) await shot('04-intro-late')
  }
  await b.sleep(800)
  await shot('05-control')
  // Real clicks: LOOK AT, then the clock. Find screen coords from the game's layout.
  const geo = await b.eval(`(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); const g = window.__battery; const k = r.width / c.width * (c.width / (g.lay.vw)); return { left: r.left, top: r.top, cw: c.width, rw: r.width, vw: g.lay.vw, vh: g.lay.vh } })()`)
  const scale = geo.rw / geo.vw // CSS px per logical px (approx; the stage centres)
  const ox = geo.left + (geo.rw - geo.vw * scale) / 2
  const oy = geo.top
  const L = await G('JSON.stringify(g.lay)')
  const lay = JSON.parse(L)
  const at = (lx, ly) => [ox + lx * scale, oy + ly * scale]
  const verb = v => lay.verbs.find(x => x.verb === v)
  const doClick = async (lx, ly, btn) => { const [x, y] = at(lx, ly); if (w < 700) await tap(x, y); else await click(x, y, btn) }
  const lv = verb('look')
  await doClick(lv.x + lv.w / 2, lv.y + lv.h / 2)
  const clock = await G(`JSON.stringify(g.hotspot('clock').rect)`)
  const cr = JSON.parse(clock)
  const camX = await G('g.camX')
  await doClick(cr[0] + cr[2] / 2 - camX + lay.scene.x, cr[1] + cr[3] / 2 + lay.scene.y)
  await b.sleep(2500)
  await shot('06-look-clock')
  await b.sleep(4000)
  // Use a door with a plain click: into the kitchen.
  const kd = JSON.parse(await G(`JSON.stringify(g.hotspot('to-kitchen').rect)`))
  const camX2 = await G('g.camX')
  await doClick(Math.max(2, kd[0] + kd[2] / 2 - camX2) + lay.scene.x, kd[1] + kd[3] / 2 + lay.scene.y)
  await b.sleep(5000)
  await shot('07-kitchen')
  console.log('room', await G('g.room'), 'hero', await G('g.hero'))
  // Switch to Dag by his portrait.
  const pd = lay.portraits.find(p => p.hero === 'dag')
  await doClick(pd.x + pd.w / 2, pd.y + pd.h / 2)
  await b.sleep(1500)
  await shot('08-dag')
  console.log('room', await G('g.room'), 'hero', await G('g.hero'))
  if (b.errors?.length) console.log('PAGE ERRORS', JSON.stringify(b.errors.slice(0, 8)))
  const logs = (b.logs || []).filter(l => /error|warn/i.test(l)).slice(0, 8)
  if (logs.length) console.log('LOGS', JSON.stringify(logs))
} finally {
  await b.close()
}
