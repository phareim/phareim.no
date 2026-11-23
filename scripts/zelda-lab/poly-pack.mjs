#!/usr/bin/env node
// Packs the polygon views' fetched art into public/zelda/poly/ (see docs/games/neon-shrine.md, "The polygon view").
//
//   CHROME_BIN=<chrome> node scripts/zelda-lab/poly-pack.mjs <source dir> [materials] [hero]
//
// <source dir> holds what was painted and modelled for them (textures/atlas.png: sixteen materials of 128 × 128 side
// by side in `MATERIALS` order; models/hero-32.glb and hero-64.glb). It writes:
// - materials.webp: the texture page, lossy WebP. Its alpha (the height the 16-bit view reads) is not used by
//   these views and is dropped.
// - hero-32.bin / hero-64.bin: the hero's mesh, gzipped (`poly/hero.ts` reads it): "NSH1", the vertex and index
//   counts, the box the positions are quantized to, then positions (int16 × 3), normals (int8 × 3), texture
//   coordinates (uint16 × 2) and indices (uint16 × 3 a triangle). Positions as the GLB has them (y up, metres).
// - hero-32.webp / hero-64.webp: its texture, lossy WebP.
// The browser does the WebP encoding (canvas.toDataURL): the repo carries no encoder of its own.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [srcArg, ...what] = process.argv.slice(2)
if (!srcArg) { console.error('usage: poly-pack.mjs <source dir> [materials] [hero]'); process.exit(2) }
const src = resolve(srcArg)
const out = join(repo, 'public/zelda/poly')
mkdirSync(out, { recursive: true })
const want = new Set(what.length ? what : ['materials', 'hero'])

const b = await launch({ width: 64, height: 64 })
await b.goto('about:blank')
/** A PNG (bytes) as lossy WebP (bytes), through the browser's own encoder; `opaque` drops the alpha. */
async function webp(png, quality, opaque) {
  const url = 'data:image/png;base64,' + Buffer.from(png).toString('base64')
  const data = await b.eval(`new Promise((ok, no) => { const im = new Image(); im.onload = () => {
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height
    const g = c.getContext('2d')
    ${opaque ? `g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height)` : ''}
    g.drawImage(im, 0, 0)
    ${opaque ? `const d = g.getImageData(0, 0, c.width, c.height); for (let i = 3; i < d.data.length; i += 4) d.data[i] = 255; g.putImageData(d, 0, 0)` : ''}
    ok(c.toDataURL('image/webp', ${quality})) }; im.onerror = () => no('bad image'); im.src = ${JSON.stringify(url)} })`)
  return Buffer.from(data.split(',')[1], 'base64')
}
const size = f => `${(statSync(f).size / 1024).toFixed(0)} KB`

if (want.has('materials')) {
  const f = join(out, 'materials.webp')
  writeFileSync(f, await webp(readFileSync(join(src, 'textures/atlas.png')), 0.86, true))
  console.log(f, size(f))
}

/** The GLB's one mesh: positions, normals, texture coordinates, indices and its texture (PNG bytes). */
function readGlb(file) {
  const buf = readFileSync(file)
  const jlen = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jlen).toString('utf8'))
  const binAt = 20 + jlen + 8
  const view = i => { const v = json.bufferViews[i]; return buf.subarray(binAt + (v.byteOffset ?? 0), binAt + (v.byteOffset ?? 0) + v.byteLength) }
  const acc = i => {
    const a = json.accessors[i]
    const v = view(a.bufferView)
    const n = a.count * { SCALAR: 1, VEC2: 2, VEC3: 3 }[a.type]
    const off = a.byteOffset ?? 0
    const ab = v.buffer.slice(v.byteOffset + off, v.byteOffset + off + n * (a.componentType === 5126 ? 4 : a.componentType === 5125 ? 4 : 2))
    return a.componentType === 5126 ? new Float32Array(ab) : a.componentType === 5125 ? new Uint32Array(ab) : new Uint16Array(ab)
  }
  const p = json.meshes[0].primitives[0]
  return { pos: acc(p.attributes.POSITION), nrm: acc(p.attributes.NORMAL), uv: acc(p.attributes.TEXCOORD_0), idx: acc(p.indices), png: view(json.images[0].bufferView) }
}

if (want.has('hero')) {
  for (const name of ['hero-32', 'hero-64']) {
    const m = readGlb(join(src, `models/${name}.glb`))
    const nv = m.pos.length / 3
    const ni = m.idx.length
    const lo = [Infinity, Infinity, Infinity]
    const hi = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], m.pos[i * 3 + k]); hi[k] = Math.max(hi[k], m.pos[i * 3 + k]) }
    const head = Buffer.alloc(4 + 8 + 24)
    head.write('NSH1', 0, 'ascii')
    head.writeUInt32LE(nv, 4)
    head.writeUInt32LE(ni, 8)
    for (let k = 0; k < 3; k++) { head.writeFloatLE(lo[k], 12 + k * 4); head.writeFloatLE(hi[k], 24 + k * 4) }
    const pos = new Int16Array(nv * 3)
    const nrm = new Int8Array(nv * 3)
    const uv = new Uint16Array(nv * 2)
    for (let i = 0; i < nv; i++) {
      for (let k = 0; k < 3; k++) {
        pos[i * 3 + k] = Math.round(((m.pos[i * 3 + k] - lo[k]) / (hi[k] - lo[k] || 1)) * 65534 - 32767)
        nrm[i * 3 + k] = Math.round(Math.max(-1, Math.min(1, m.nrm[i * 3 + k])) * 127)
      }
      uv[i * 2] = Math.round(Math.max(0, Math.min(1, m.uv[i * 2])) * 65535)
      uv[i * 2 + 1] = Math.round(Math.max(0, Math.min(1, m.uv[i * 2 + 1])) * 65535)
    }
    const idx = Uint16Array.from(m.idx)
    const bin = Buffer.concat([head, Buffer.from(pos.buffer), Buffer.from(nrm.buffer), Buffer.from(uv.buffer), Buffer.from(idx.buffer)])
    const f = join(out, `${name}.bin`)
    writeFileSync(f, gzipSync(bin, { level: 9 }))
    const t = join(out, `${name}.webp`)
    writeFileSync(t, await webp(m.png, 0.9, false))
    console.log(f, size(f), `(${nv} vertices, ${ni / 3} triangles)`, t, size(t))
  }
}
await b.close()
