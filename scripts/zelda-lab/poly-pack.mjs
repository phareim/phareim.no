#!/usr/bin/env node
// Packs the polygon views' fetched art into public/zelda/poly/ (see docs/games/neon-shrine.md, "The polygon view").
//
//   CHROME_BIN=<chrome> node scripts/zelda-lab/poly-pack.mjs <source dir> [materials] [hero] [--textures <subdir>]
//
// <source dir> holds what was painted and modelled for them (textures/atlas.png: sixteen materials of 128 × 128 side
// by side in `MATERIALS` order; models/hero-32.glb and hero-64.glb). It writes:
// - materials.webp: the texture page, lossy WebP. Its alpha (the height the 16-bit view reads) is not used by
//   these views and is dropped.
// - hero-32.bin / hero-64.bin: the hero's mesh, gzipped (`poly/hero.ts` reads it): "NSH1", the vertex and index
//   counts, the box the positions are quantized to, then positions (int16 × 3), normals (int8 × 3), texture
//   coordinates (uint16 × 2) and indices (uint16 × 3 a triangle). Positions as the GLB has them (y up, metres).
// - hero-32.webp / hero-64.webp: its texture, lossy WebP; the back of the head mended (`mendHair`): texels there that
//   are neither the hair's colour nor the band's, and that no other part of the mesh uses, take the hair's colour (from
//   behind, the only way the 64-bit look sees the hero, they read as a face).
// The browser does the WebP encoding (canvas.toDataURL): the repo carries no encoder of its own.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const argv = process.argv.slice(2)
const texAt = argv.indexOf('--textures')
/** The folder under <source dir> the texture page is read from (`textures`; `textures2` holds part 6's moss and sand). */
const TEXTURES = texAt >= 0 ? argv[texAt + 1] : 'textures'
const [srcArg, ...what] = texAt < 0 ? argv : argv.filter((a, i) => i !== texAt && i !== texAt + 1)
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
  writeFileSync(f, await webp(readFileSync(join(src, TEXTURES, 'atlas.png')), 0.86, true))
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

/**
 * The hero's texture with the back of the head in the hair's colour: the triangles above the neck, behind the head's
 * middle and facing back are drawn as a mask over the texture, and so are all the others; a texel only the back of the
 * head uses that is neither hair (the commonest colour there) nor the band (bright pink) becomes hair. PNG in and out.
 */
async function mendHair(m, png) {
  const n = m.pos.length / 3
  let lo = Infinity, hi = -Infinity
  for (let i = 0; i < n; i++) { lo = Math.min(lo, m.pos[i * 3 + 1]); hi = Math.max(hi, m.pos[i * 3 + 1]) }
  const H = hi - lo
  let zs = 0, zn = 0
  for (let i = 0; i < n; i++) if (m.pos[i * 3 + 1] > lo + 0.58 * H) { zs += m.pos[i * 3 + 2]; zn++ }
  const zc = zs / zn
  // The back of the head, by each triangle's middle: above the neck, behind the head's middle, facing back.
  const isBack = v => {
    const c = k => (m.pos[v[0] * 3 + k] + m.pos[v[1] * 3 + k] + m.pos[v[2] * 3 + k]) / 3
    const nz = (m.nrm[v[0] * 3 + 2] + m.nrm[v[1] * 3 + 2] + m.nrm[v[2] * 3 + 2]) / 3
    return c(1) > lo + 0.6 * H && c(2) > zc + 0.03
  }
  const backTris = [], otherTris = []
  for (let t = 0; t < m.idx.length / 3; t++) {
    const v = [m.idx[t * 3], m.idx[t * 3 + 1], m.idx[t * 3 + 2]]
    const uvs = v.flatMap(i => [m.uv[i * 2], m.uv[i * 2 + 1]])
    if (isBack(v)) backTris.push(uvs)
    else otherTris.push(uvs)
  }
  const url = await b.eval(`new Promise(ok => { const im = new Image(); im.onload = () => {
    const W = im.width, Hh = im.height, c = document.createElement('canvas'); c.width = W; c.height = Hh
    const g = c.getContext('2d'); g.drawImage(im, 0, 0)
    const mask = tris => { const m = document.createElement('canvas'); m.width = W; m.height = Hh; const mg = m.getContext('2d'); mg.fillStyle = '#fff'
      for (const t of tris) { mg.beginPath(); mg.moveTo(t[0] * W, t[1] * Hh); mg.lineTo(t[2] * W, t[3] * Hh); mg.lineTo(t[4] * W, t[5] * Hh); mg.closePath(); mg.fill() }
      return mg.getImageData(0, 0, W, Hh).data }
    const backT = ${JSON.stringify(backTris)}
    const back = mask(backT), other = mask(${JSON.stringify(otherTris)})
    const img = g.getImageData(0, 0, W, Hh), d = img.data
    const hist = new Map()
    for (let i = 0; i < W * Hh; i++) if (back[i * 4] > 128) { const k = (d[i * 4] >> 4) * 256 + (d[i * 4 + 1] >> 4) * 16 + (d[i * 4 + 2] >> 4); hist.set(k, (hist.get(k) ?? 0) + 1) }
    const top = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0]
    const hr = ((top >> 8) << 4) + 8, hg = (((top >> 4) & 15) << 4) + 8, hb = ((top & 15) << 4) + 8
    // Where the back of the head shares its texels with the face (the unwrap laid the two over each other), the texture
    // cannot be mended without the face: those triangles are given a texel of hair instead (their uv moved, below).
    let hairAt = null
    for (let i = 0; i < W * Hh && !hairAt; i++) if (back[i * 4] > 128 && other[i * 4] === 0 && Math.abs(d[i * 4] - hr) + Math.abs(d[i * 4 + 1] - hg) + Math.abs(d[i * 4 + 2] - hb) < 24) hairAt = [((i % W) + 0.5) / W, (Math.floor(i / W) + 0.5) / Hh]
    const at = (u, v) => { const x = Math.min(W - 1, Math.max(0, Math.floor(u * W))), y = Math.min(Hh - 1, Math.max(0, Math.floor(v * Hh))); const k = (y * W + x) * 4; return [d[k], d[k + 1], d[k + 2]] }
    const isHair = c => Math.abs(c[0] - hr) + Math.abs(c[1] - hg) + Math.abs(c[2] - hb) < 70
    const isBand = c => c[0] > 150 && c[1] < 110 && c[2] > 60
    const moved = []
    // (Every texel inside the triangle: a thin line of an eye may cross it between its corners.)
    backT.forEach((t, k) => {
      const ax = t[0] * W, ay = t[1] * Hh, bx = t[2] * W, by = t[3] * Hh, cx = t[4] * W, cy = t[5] * Hh
      const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
      if (Math.abs(den) < 1e-9) return
      let bad = false
      for (let y = Math.floor(Math.min(ay, by, cy)); y <= Math.ceil(Math.max(ay, by, cy)) && !bad; y++) for (let x = Math.floor(Math.min(ax, bx, cx)); x <= Math.ceil(Math.max(ax, bx, cx)) && !bad; x++) {
        const px = x + 0.5, py = y + 0.5
        const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / den, l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / den
        if (l1 < -0.01 || l2 < -0.01 || 1 - l1 - l2 < -0.01) continue
        const c = at(px / W, py / Hh)
        if (!isHair(c) && !isBand(c)) bad = true
      }
      if (bad) moved.push(k)
    })
    let mended = 0
    for (let i = 0; i < W * Hh; i++) {
      if (back[i * 4] < 128 || other[i * 4] > 0) continue
      const r = d[i * 4], gg = d[i * 4 + 1], bb = d[i * 4 + 2]
      const hair = Math.abs(r - hr) + Math.abs(gg - hg) + Math.abs(bb - hb) < 70
      const band = r > 150 && gg < 110 && bb > 60
      if (!hair && !band) { d[i * 4] = hr; d[i * 4 + 1] = hg; d[i * 4 + 2] = hb; mended++ }
    }
    g.putImageData(img, 0, 0)
    ok(JSON.stringify({ mended, moved, hairAt, hair: [hr, hg, hb], url: c.toDataURL('image/png') }))
  }; im.src = 'data:image/png;base64,${png.toString('base64')}' })`)
  const r = JSON.parse(url)
  // The triangles that share the face's texels: every corner to the hair texel (a corner shared with the face itself
  // keeps its own: only corners all of whose triangles are at the back of the head move).
  const backIdx = []
  for (let t = 0; t < m.idx.length / 3; t++) {
    const v = [m.idx[t * 3], m.idx[t * 3 + 1], m.idx[t * 3 + 2]]
    if (isBack(v)) backIdx.push(t)
  }
  // Each such triangle gets three corners of its own (copies of its corners, the uv on the hair texel), so no
  // neighbour that keeps its texels is stretched across the page.
  let corners = 0
  if (r.hairAt && r.moved.length) {
    const nv = m.pos.length / 3, add = r.moved.length * 3
    const pos = new Float32Array((nv + add) * 3), nrm = new Float32Array((nv + add) * 3), uv = new Float32Array((nv + add) * 2)
    pos.set(m.pos); nrm.set(m.nrm); uv.set(m.uv)
    const idx = Uint32Array.from(m.idx)
    let at = nv
    for (const k of r.moved) for (let c = 0; c < 3; c++) {
      const t = backIdx[k] * 3 + c, i = idx[t]
      pos.set(m.pos.subarray(i * 3, i * 3 + 3), at * 3); nrm.set(m.nrm.subarray(i * 3, i * 3 + 3), at * 3)
      uv[at * 2] = r.hairAt[0]; uv[at * 2 + 1] = r.hairAt[1]
      idx[t] = at++; corners++
    }
    m.pos = pos; m.nrm = nrm; m.uv = uv; m.idx = idx
  }
  console.log(`  the back of the head: ${r.mended} texels to the hair's colour rgb(${r.hair.join(', ')}); ${r.moved.length} triangles on the face's texels, given ${corners} corners of their own on a hair texel`)
  return Buffer.from(r.url.split(',')[1], 'base64')
}

if (want.has('hero')) {
  for (const name of ['hero-32', 'hero-64']) {
    const m = readGlb(join(src, `models/${name}.glb`))
    // (Mended first: it may give the back of the head's triangles corners of their own, which the mesh then carries.)
    const mendedPng = await mendHair(m, m.png)
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
    writeFileSync(t, await webp(mendedPng, 0.9, false))
    console.log(f, size(f), `(${nv} vertices, ${ni / 3} triangles)`, t, size(t))
  }
}
await b.close()
