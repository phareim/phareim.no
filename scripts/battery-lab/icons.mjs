#!/usr/bin/env node
// Night of the Dead Battery: every inventory icon on one sheet, at 1×, 2×
// and 4× on the panel's slot colour, plus a row in panel-sized cells (26×22
// wide, 44×36 tall at 2×). One headless Chromium; run it under the lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/battery-lab/icons.mjs ~/Pictures/battery/icons
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from '../zelda-lab/cdp.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outArg = process.argv[2]
if (!outArg) { console.error('usage: icons.mjs <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const entry = `
import { itemIcon } from ${JSON.stringify(join(repo, 'themes/battery/render/items.ts'))}
const IDS = ['manual','keys','sandwich','emf','matches','oil','sardines','umbrella','monocle','letters','jam','jam+','labkey','cat','gloves','poker','clockkey']
window.__sheet = () => {
  const cell = 96, W = IDS.length * cell, H = 280
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  c.style.cssText = 'display:block;width:' + W + 'px;height:' + H + 'px;image-rendering:pixelated'
  document.body.style.cssText = 'margin:0;background:#07040d'
  document.body.appendChild(c)
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  g.fillStyle = '#120a20'; g.fillRect(0, 0, W, H)
  const sizes = []
  IDS.forEach((raw, i) => {
    const id = raw.replace('+', '')
    const s = { flags: raw.endsWith('+') ? { 'jam.open': true } : {} }
    const icon = itemIcon(id, s)
    sizes.push(raw + ' ' + icon.width + 'x' + icon.height)
    const x0 = i * cell
    // 4x
    g.fillStyle = '#1c1030'; g.fillRect(x0 + 2, 2, cell - 4, 80)
    g.drawImage(icon, x0 + Math.round((cell - icon.width * 4) / 2), 2 + Math.round((80 - icon.height * 4) / 2), icon.width * 4, icon.height * 4)
    // 2x in a 44x36 cell (tall panel)
    g.fillStyle = '#1c1030'; g.fillRect(x0 + 4, 92, 88, 72)
    g.drawImage(icon, x0 + 4 + Math.round((88 - icon.width * 4) / 2), 92 + Math.round((72 - icon.height * 4) / 2), icon.width * 4, icon.height * 4)
    // 1x in a 26x22 cell, shown at 2x screen pixels so it reads like the wide panel at scale 2
    g.fillStyle = '#1c1030'; g.fillRect(x0 + 22, 176, 52, 44)
    g.drawImage(icon, x0 + 22 + (26 - icon.width), 176 + (22 - icon.height), icon.width * 2, icon.height * 2)
    // true 1x
    g.fillStyle = '#1c1030'; g.fillRect(x0 + 35, 236, 26, 22)
    g.drawImage(icon, x0 + 35 + Math.round((26 - icon.width) / 2), 236 + Math.round((22 - icon.height) / 2))
  })
  return sizes.join(', ')
}
document.title = 'ready'
`
const entryFile = join(out, '_icons.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_icons.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_icons.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="_icons.js"></script>`)

const b = await launch({ width: 1640, height: 300 })
try {
  await b.goto('file://' + html)
  await b.send('Emulation.setDeviceMetricsOverride', { width: 17 * 96, height: 280, deviceScaleFactor: 1, mobile: false })
  const res = await b.eval(`(() => { try { return window.__sheet() } catch (e) { return 'ERR ' + e.stack } })()`)
  console.log(res)
  const png = join(out, 'icons.png')
  await b.shot(png)
  console.log(png)
  if (b.errors?.length) console.error('page errors:', b.errors.slice(0, 5))
} finally {
  await b.close()
}
