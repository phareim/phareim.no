#!/usr/bin/env node
// Night of the Dead Battery: the hero sheet. Every hero × facing × pose ×
// frame (and the walk cycles, the portraits and the item icons) on one grid,
// scaled up, in one headless Chromium. Run it under the shared lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/battery-lab/sheet.mjs <outDir> [hero,…] [k=3] [amb=#8a80a8]
//
// Writes <outDir>/sheet-<hero>.png (poses), walk-<hero>.png (walk frames,
// every facing), portraits.png. `amb` multiplies the figures by a room
// ambient colour the way the light map does, to see them as in the game.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from '../zelda-lab/cdp.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, heroArg = 'kjell,dag,espen,professor', ...rest] = process.argv.slice(2)
if (!outArg) { console.error('usage: sheet.mjs <outDir> [heroes] [k=3] [amb=#rrggbb]'); process.exit(2) }
const opt = Object.fromEntries(rest.map(s => s.split('=')))
const K = +(opt.k || 3)
const AMB = opt.amb || ''
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const B = p => JSON.stringify(join(repo, 'themes/battery', p))

const entry = `
import { drawHero, portrait, HERO_POSES, PHASE, WALK_RATE } from ${B('render/actors.ts')}
import { POSE_ANIM } from ${B('render/rig/poses.ts')}
const at = (id, n, fps, f) => (f + 0.5) / fps - PHASE[id] + Math.ceil(PHASE[id] * fps / n + 1) * n / fps

const CW = 50, CH = 76
function sheet(cells, cols, label) {
  const rows = Math.ceil(cells.length / cols)
  const c = document.createElement('canvas')
  c.width = cols * CW; c.height = rows * CH
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  cells.forEach((cell, i) => {
    const x = (i % cols) * CW, y = Math.floor(i / cols) * CH
    g.fillStyle = ((i % cols) + Math.floor(i / cols)) % 2 ? '#3a2e5a' : '#453868'
    g.fillRect(x, y, CW, CH)
    g.fillStyle = '#2a2040'
    g.fillRect(x, y + CH - 8, CW, 8)
    if (cell) {
      const s = { flags: cell.flags || {}, time: 0 }
      const a = { room: 'foyer', x: x + CW / 2, y: y + CH - 6, face: cell.face, visible: true, pose: cell.pose }
      const v = { room: 'foyer', camX: 0, w: 320, t: cell.t, flash: 0, talking: cell.talk ? cell.id : null }
      drawHero(g, cell.id, a, v, !!cell.walk, s)
    }
  })
  if (${JSON.stringify(AMB)}) {
    g.globalCompositeOperation = 'multiply'
    g.fillStyle = ${JSON.stringify(AMB || '#ffffff')}
    g.fillRect(0, 0, c.width, c.height)
    g.globalCompositeOperation = 'source-over'
  }
  const big = document.createElement('canvas')
  big.width = c.width * ${K}; big.height = c.height * ${K}
  const bg = big.getContext('2d')
  bg.imageSmoothingEnabled = false
  bg.drawImage(c, 0, 0, big.width, big.height)
  document.body.appendChild(big)
  return [big.width, big.height]
}

// Time that lands on frame f of a pose (fps from POSE_ANIM via probing).
window.__sheet = (kind, id) => {
  document.body.innerHTML = ''
  document.body.style.cssText = 'margin:0;background:#07040d'
  const faces = ['down', 'right', 'left', 'up']
  const cells = []
  if (kind === 'poses') {
    // One row per pose: 4 facings × 2 frames.
    for (const pose of ['', ...HERO_POSES]) {
      for (const face of faces) for (const f of [0, 1]) { const [n, fps] = POSE_ANIM[pose]; cells.push({ id, face, pose, t: at(id, n, fps, f % n) + (pose ? 0 : f * 1.5) }) }
    }
    return sheet(cells, 8)
  }
  if (kind === 'walk') {
    const rate = WALK_RATE[id]
    for (const face of faces) for (let f = 0; f < 8; f++) cells.push({ id, face, pose: '', t: at(id, 8, rate, f), walk: true })
    for (const face of faces) for (let f = 0; f < 8; f++) cells.push({ id, face, pose: 'carry', t: at(id, 8, rate, f), walk: true })
    return sheet(cells, 8)
  }
  if (kind === 'idle') {
    // Idle across time, talking, and Espen's flop.
    for (const face of ['down', 'right']) for (let i = 0; i < 16; i++) cells.push({ id, face, pose: '', t: i * 0.6 })
    for (const face of faces) for (let i = 0; i < 2; i++) cells.push({ id, face, pose: '', t: 1.5 + i * 0.12, talk: true })
    for (const face of faces) for (let i = 0; i < 2; i++) cells.push({ id, face, pose: i ? 'scared' : '', t: 1.5, flags: { 'espen.ears': true } })
    return sheet(cells, 16)
  }
  if (kind === 'portraits') {
    const c = document.createElement('canvas')
    c.width = 200; c.height = 120
    const g = c.getContext('2d')
    g.fillStyle = '#120a20'; g.fillRect(0, 0, 200, 120)
    const hs = ['kjell', 'dag', 'espen']
    hs.forEach((h, i) => {
      g.fillStyle = '#2c1c48'; g.fillRect(6 + i * 30, 6, 26, 15)
      const p1 = portrait(h, 1, { flags: {}, time: 1 })
      g.drawImage(p1, 6 + i * 30 + Math.round((26 - p1.width) / 2), 6 + Math.round((15 - p1.height) / 2))
      g.fillStyle = '#2c1c48'; g.fillRect(6 + i * 60, 30, 56, 38)
      const p2 = portrait(h, 2, { flags: {}, time: 1 })
      g.drawImage(p2, 10 + i * 60, 30 + Math.floor((38 - p2.height) / 2))
      const p3 = portrait(h, 2, { flags: { 'espen.ears': true }, time: 0 })
      g.fillStyle = '#2c1c48'; g.fillRect(6 + i * 60, 74, 56, 38)
      g.drawImage(p3, 10 + i * 60, 74 + Math.floor((38 - p3.height) / 2))
    })
    const big = document.createElement('canvas')
    big.width = 200 * 5; big.height = 120 * 5
    const bg = big.getContext('2d'); bg.imageSmoothingEnabled = false
    bg.drawImage(c, 0, 0, big.width, big.height)
    document.body.appendChild(big)
    return [big.width, big.height]
  }
}
document.title = 'ready'
`
const entryFile = join(out, '_sheet_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_sheet_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_sheet.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="_sheet_bundle.js"></script>`)

const b = await launch({ width: 1600, height: 1200 })
try {
  await b.goto('file://' + html)
  const jobs = []
  for (const id of heroArg.split(',')) for (const kind of (opt.kinds || 'poses,walk,idle').split(',')) jobs.push([kind, id])
  if ((opt.kinds || 'portraits').includes('portraits')) jobs.push(['portraits', ''])
  for (const [kind, id] of jobs) {
    const res = await b.eval(`(() => { try { return JSON.stringify(window.__sheet(${JSON.stringify(kind)}, ${JSON.stringify(id)})) } catch (e) { return 'ERR ' + e.stack } })()`)
    if (!res || res.startsWith('ERR')) { console.error(kind, id, res); continue }
    const [w, h] = JSON.parse(res)
    await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
    const png = join(out, `${kind}${id ? '-' + id : ''}${AMB ? '-amb' : ''}.png`)
    await b.shot(png)
    console.log(png)
  }
  if (b.errors?.length) console.error('page errors:', b.errors.slice(0, 5))
} finally {
  await b.close()
}
