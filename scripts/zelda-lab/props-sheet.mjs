#!/usr/bin/env node
// Neon Shrine props lab: the 16-bit view's standing things
// (render/iso/props.ts) on a contact sheet, no browser needed.
//
//   node scripts/zelda-lab/props-sheet.mjs <outDir>
//
// Writes props.png: every thing on a dusk lawn, a one-tile diamond under
// it, as painted (unlit), and under each its normals. ZOOM=<n> overrides
// the zoom (4).
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../themes/zelda')
const [outArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: props-sheet.mjs <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const built = esbuild.buildSync({
  stdin: { contents: `export * from './render/iso/props'`, resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const { buildProps, PROP, PROP_KINDS } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))

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

const a = buildProps()
const zoom = +(process.env.ZOOM || 3)
const W = a.w * zoom
const H = a.h * 2 * zoom
const px = Buffer.alloc(W * H * 4)
const dot = (x, y, r, g, b) => {
  for (let yy = 0; yy < zoom; yy++) for (let xx = 0; xx < zoom; xx++) {
    const o = ((y * zoom + yy) * W + x * zoom + xx) * 4
    px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255
  }
}
for (let y = 0; y < a.h * 2; y++) for (let x = 0; x < a.w; x++) {
  const lx = x % PROP.w
  const ly = y % a.h
  const cy = ly % PROP.h
  // The lawn, and the tile the thing stands on: a 64 × 32 diamond round the anchor.
  const dx = Math.abs(lx + 0.5 - PROP.ax) / 32
  const dy = Math.abs(cy + 0.5 - PROP.ay) / 16
  const onTile = dx + dy <= 1
  let c = y < a.h ? (onTile ? [34, 86, 82] : [24, 66, 70]) : [20, 14, 36]
  const o = (ly * a.w + x) * 4
  if (a.albedo[o + 3]) c = y < a.h ? [a.albedo[o], a.albedo[o + 1], a.albedo[o + 2]] : [a.normal[o], a.normal[o + 1], a.normal[o + 2]]
  dot(x, y, c[0], c[1], c[2])
}
writeFileSync(join(out, 'props.png'), png(W, H, px))
console.log(join(out, 'props.png'), PROP_KINDS.join(' '))
