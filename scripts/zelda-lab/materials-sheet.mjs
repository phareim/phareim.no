#!/usr/bin/env node
// Neon Shrine materials lab: the 16-bit view's ground materials
// (render/iso/materials.ts) on a contact sheet, no browser needed.
//
//   node scripts/zelda-lab/materials-sheet.mjs <outDir>
//
// Writes materials.png: every material as the turned view shows it (one
// texel to the px, through `texelAt`; unlit, 3× by default), and under each
// the same material as it lies on the ground (u east, v south).
// ZOOM=<n> overrides the zoom.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../themes/zelda')
const [outArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: materials-sheet.mjs <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const built = esbuild.buildSync({
  stdin: { contents: `export * from './render/iso/materials'`, resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const { buildMaterials, texelAt, MAT, MATERIALS } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))

function png(w, h, px) {
  const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
  const crc = b => { let c = -1; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const m = buildMaterials()
const zoom = +(process.env.ZOOM || 3)
const CW = 200
const CH = 120
const W = MATERIALS.length * (CW + 4) * zoom
const H = (CH + 4 + 68) * zoom
const px = Buffer.alloc(W * H * 4)
for (let i = 0; i < W * H; i++) { px[i * 4] = 11; px[i * 4 + 1] = 6; px[i * 4 + 2] = 22; px[i * 4 + 3] = 255 }
const dot = (x, y, r, g, b) => {
  for (let yy = 0; yy < zoom; yy++) for (let xx = 0; xx < zoom; xx++) {
    const o = ((y * zoom + yy) * W + x * zoom + xx) * 4
    if (o >= 0 && o < px.length) { px[o] = r; px[o + 1] = g; px[o + 2] = b }
  }
}
MATERIALS.forEach((name, k) => {
  const x0 = k * (CW + 4) + 2
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const t = texelAt(x, y)
    const o = (t.v * m.w + k * MAT + t.u) * 4
    dot(x0 + x, 2 + y, m.data[o], m.data[o + 1], m.data[o + 2])
  }
  for (let v = 0; v < 64; v++) for (let u = 0; u < CW; u++) {
    const o = (v * m.w + k * MAT + (u % MAT)) * 4
    dot(x0 + u, CH + 6 + v, m.data[o], m.data[o + 1], m.data[o + 2])
  }
})
writeFileSync(join(out, 'materials.png'), png(W, H, px))
console.log(join(out, 'materials.png'), MATERIALS.join(' '))
