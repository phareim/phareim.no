#!/usr/bin/env node
// Space Voyagers lab: the portraits and the part of each the narrow band shows (render/crops.ts).
//
//   node scripts/galaga-lab/crops.mjs raw     # each 64 x 64 portrait, enlarged, with a tick every 8 px and its window drawn
//   node scripts/galaga-lab/crops.mjs crops   # the 35 windows themselves, 40 x 40 each, enlarged: the contact sheet
//
// Writes tmp/galaga-shots/b/portraits-<mode>-<n>.png. Run from the repo root.
import { readPng, writePng, crop, enlarge, blank, paste, box } from './png.mjs'
import { readdirSync, mkdirSync, readFileSync } from 'node:fs'
const mode = process.argv[2] ?? 'raw'
const names = readdirSync('public/galaga').filter(n => n.startsWith('portrait-')).map(n => n.replace('.png', '')).sort()
mkdirSync('tmp/galaga-shots/b', { recursive: true })
let table = {}
if (mode === 'crops') {
  const src = readFileSync('themes/galaga/render/crops.ts', 'utf8')
  for (const m of src.matchAll(/'?([a-z]+(?:-[a-z]+)?)'?: \[(\d+), (\d+)\]/g)) table[m[1]] = [+m[2], +m[3]]
}
const origin = n => { const [, who, mood] = n.split('-'); return table[`${who}-${mood}`] ?? table[who] ?? [12, 12] }
const K = mode === 'raw' ? 5 : 6
const cell = (mode === 'raw' ? 64 : 40) * K + 12
const per = mode === 'raw' ? 4 : 7
for (let page = 0; page * per * (mode === 'raw' ? 3 : 5) < names.length; page++) {
  const rowsN = mode === 'raw' ? 3 : 5
  const list = names.slice(page * per * rowsN, (page + 1) * per * rowsN)
  const sheet = blank(per * cell, rowsN * cell, [40, 40, 48, 255])
  list.forEach((n, i) => {
    const img = readPng(`public/galaga/${n}.png`)
    const x = (i % per) * cell + 6, y = Math.floor(i / per) * cell + 6
    if (mode === 'raw') {
      const big = enlarge(img, K)
      // a tick every 8 source pixels along the top and left
      for (let t = 0; t <= 64; t += 8) { box(big, t * K, 0, 1, t % 16 === 0 ? 10 : 5, [255, 255, 0, 255]); box(big, 0, t * K, t % 16 === 0 ? 10 : 5, 1, [255, 255, 0, 255]) }
      const [ox, oy] = origin(n)
      box(big, ox * K, oy * K, 40 * K, 40 * K, [0, 255, 255, 255])
      paste(sheet, big, x, y)
    } else {
      const [ox, oy] = origin(n)
      paste(sheet, enlarge(crop(img, ox, oy, 40, 40), K), x, y)
    }
  })
  writePng(`tmp/galaga-shots/b/portraits-${mode}-${page}.png`, sheet)
  console.log(`portraits-${mode}-${page}.png:`, list.map(n => n.replace('portrait-', '')).join(', '))
}
