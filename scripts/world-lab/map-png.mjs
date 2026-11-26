#!/usr/bin/env node
// Whole-map pictures of Neon Shrine's world, for judging a land's layout (docs/worlds/atlas.md): every tile as a
// flat colour, with people, chests, signs, ways in and out and foes marked, landmark footprints outlined, and
// area names written over their rectangles. No browser.
//
//   node scripts/world-lab/map-png.mjs <out.png> <map> [px a tile, default 8]
//   node scripts/world-lab/map-png.mjs <out.png> atlas [px a tile, default 3]   (every map on the grid in place)
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const [out, which, pxArg] = process.argv.slice(2)
if (!out || !which) { console.error('usage: map-png.mjs <out.png> <map|atlas> [px]'); process.exit(2) }

const b = esbuild.buildSync({
  stdin: { contents: `export { WORLD } from './world/index'; export { TILE_INFO } from './world/tiles'; export { glyphRows } from '../base/pixel/font'`, resolveDir: join(repo, 'themes', 'zelda'), loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const { WORLD, TILE_INFO, glyphRows } = await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'))

const C = {
  '.': [70, 112, 64], ',': [176, 150, 108], ':': [96, 140, 80], ';': [86, 130, 60], '*': [52, 96, 50], 'T': [26, 64, 40],
  '#': [104, 98, 120], '%': [130, 110, 120], 'R': [130, 110, 120], '~': [40, 96, 160], '=': [150, 110, 70], 'o': [170, 120, 90],
  'r': [140, 130, 130], 'H': [190, 70, 120], 'D': [255, 210, 60], '>': [255, 210, 60], 'S': [230, 200, 140], 't': [255, 230, 120],
  'F': [150, 120, 90], 'G': [170, 170, 180], 'I': [200, 200, 210], 'O': [20, 10, 30], '|': [200, 160, 90], 'Z': [80, 80, 90],
  '-': [214, 190, 140], 'n': [160, 110, 80], '$': [255, 200, 40], 'x': [200, 60, 60], 'X': [120, 120, 160], 'L': [160, 120, 60],
  'α': [190, 230, 250], 'а': [120, 116, 130], 'е': [230, 110, 190], 'в': [90, 140, 70], 'д': [120, 90, 60],
}
const MARK = { npc: [255, 120, 220], chest: [255, 215, 0], item: [255, 215, 0], sign: [255, 255, 255], warp: [0, 255, 255], entry: [0, 200, 255], enemy: [255, 40, 40], exit: [0, 255, 128], shop: [255, 160, 0] }

function tileOf(def, ch) {
  const m = def.marks[ch]
  if (m) return m.tile ?? ({ chest: '$', sign: 'S', shop: 'n', exit: 'D', gate: 'X', glyph: '{', lever: '}' }[m.ent.t] ?? '.')
  return ch
}
function colour(t) { return C[t] ?? (TILE_INFO[t]?.solid ? [90, 90, 100] : [80, 110, 70]) }

function canvas(w, h) {
  const px = new Uint8Array(w * h * 3).fill(16)
  return {
    w, h, px,
    set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < h) { const i = (y * w + x) * 3; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2] } },
    rect(x, y, rw, rh, c) { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) this.set(x + i, y + j, c) },
    frame(x, y, rw, rh, c) { for (let i = 0; i < rw; i++) { this.set(x + i, y, c); this.set(x + i, y + rh - 1, c) } for (let j = 0; j < rh; j++) { this.set(x, y + j, c); this.set(x + rw - 1, y + j, c) } },
    text(x, y, s, c) {
      let cx = x
      for (const ch of s.toUpperCase()) {
        const g = ch === ' ' ? null : glyphRows(ch)
        if (g) g.forEach((row, j) => [...row].forEach((v, i) => { if (v === '1' || v === '#') { this.set(cx + i, y + j, [0, 0, 0]); this.set(cx + i + 1, y + j + 1, [0, 0, 0]) } }))
        if (g) g.forEach((row, j) => [...row].forEach((v, i) => { if (v === '1' || v === '#') this.set(cx + i, y + j, c) }))
        cx += 6
      }
    },
  }
}

function drawMap(cv, def, ox, oy, s, detail) {
  const rows = def.rows
  rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const t = tileOf(def, ch)
    cv.rect(ox + x * s, oy + y * s, s, s, colour(t))
    const m = def.marks[ch]
    if (m && detail && MARK[m.ent.t]) {
      const k = Math.max(2, Math.floor(s * 0.6))
      cv.rect(ox + x * s + Math.floor((s - k) / 2), oy + y * s + Math.floor((s - k) / 2), k, k, MARK[m.ent.t])
    }
  }))
  if (!detail) return
  for (const lm of def.isoLandmarks ?? []) {
    const r = lm.solid ?? lm.cover
    if (r) cv.frame(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s, [255, 255, 0])
    else cv.rect(ox + Math.floor(lm.x * s) - 1, oy + Math.floor(lm.y * s) - 1, 3, 3, [255, 255, 0])
  }
  for (const e of Object.values(def.entries ?? {})) cv.rect(ox + Math.floor(e.x * s) - 1, oy + Math.floor(e.y * s) - 1, 3, 3, MARK.entry)
  for (const a of def.areas ?? []) {
    cv.frame(ox + a.x * s, oy + a.y * s, a.w * s, a.h * s, [255, 255, 255])
    cv.text(ox + a.x * s + 3, oy + a.y * s + 3, a.name, [255, 255, 255])
  }
}

let cv
if (which === 'atlas') {
  const s = Number(pxArg ?? 3)
  const placed = Object.entries(WORLD.atlas).map(([id, o]) => ({ id, ...o, def: WORLD.maps[id] }))
  const x0 = Math.min(...placed.map(p => p.x))
  const y0 = Math.min(...placed.map(p => p.y))
  const x1 = Math.max(...placed.map(p => p.x + p.def.rows[0].length))
  const y1 = Math.max(...placed.map(p => p.y + p.def.rows.length))
  cv = canvas((x1 - x0) * s, (y1 - y0) * s)
  for (const p of placed) {
    drawMap(cv, p.def, (p.x - x0) * s, (p.y - y0) * s, s, false)
    cv.frame((p.x - x0) * s, (p.y - y0) * s, p.def.rows[0].length * s, p.def.rows.length * s, [255, 255, 255])
    cv.text((p.x - x0) * s + 4, (p.y - y0) * s + 4, p.def.name, [255, 255, 255])
  }
} else {
  const def = WORLD.maps[which]
  if (!def) { console.error(`no map ${which}`); process.exit(2) }
  const s = Number(pxArg ?? 8)
  cv = canvas(def.rows[0].length * s, def.rows.length * s)
  drawMap(cv, def, 0, 0, s, true)
}

// PNG: RGB, no filter.
const raw = Buffer.alloc((cv.w * 3 + 1) * cv.h)
for (let y = 0; y < cv.h; y++) { raw[y * (cv.w * 3 + 1)] = 0; Buffer.from(cv.px.buffer, y * cv.w * 3, cv.w * 3).copy(raw, y * (cv.w * 3 + 1) + 1) }
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = buf => { let c = 0xffffffff; for (const v of buf) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(cv.w, 0); ihdr.writeUInt32BE(cv.h, 4); ihdr[8] = 8; ihdr[9] = 2
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
console.log(out, `${cv.w}x${cv.h}`)
