#!/usr/bin/env node
// Paint a critter's frames big, side by side, on dark and light ground, as a PNG.
//   node scripts/life-lab/sheet.mjs <frames.json | render/life/<id>.ts> <out.png> [scale=8]
import { writeFileSync, readFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const [src, outPng, sc = '8'] = process.argv.slice(2)
let pal, frames
if (src.endsWith('.json')) ({ pal, frames } = JSON.parse(readFileSync(src, 'utf8')))
else {
  const esbuild = require('esbuild')
  const code = esbuild.buildSync({ entryPoints: [src], bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'error' }).outputFiles[0].text
  const m = { exports: {} }; new Function('module', 'exports', 'require', code)(m, m.exports, require)
  const c = m.exports.default; pal = c.pal; frames = c.frames
}
const S = +sc, pad = 2
const names = Object.keys(frames)
const fw = Math.max(...names.map(n => frames[n][0].length)), fh = Math.max(...names.map(n => frames[n].length))
const W = (names.length * (fw + pad) + pad) * S, H = ((fh + pad) * 2 + pad) * S
const px = Buffer.alloc(W * H * 4)
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const fill = (x0, y0, w, h, [r, g, b]) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) { const i = (y * W + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255 } }
fill(0, 0, W, H / 2, [16, 14, 40]); fill(0, H / 2, W, H / 2, [70, 120, 90])
names.forEach((n, k) => {
  for (const band of [0, 1]) frames[n].forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || !pal[ch]) return
    fill(((pad + k * (fw + pad)) + x) * S, (pad + band * (fh + pad) + y) * S, S, S, hex(pal[ch]))
  }))
})
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4) }
const crc = b => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 } c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6
writeFileSync(outPng, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
console.log(outPng, names.join(' '))
