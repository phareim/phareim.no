#!/usr/bin/env node
// Rotoscope guides for a realm kit, from the kit's own solids.
//   node scripts/zelda-lab/codex/kit-guides.mjs <kit> [--only <id-prefix,...>] [--out <dir>]
// <kit> is a module in themes/zelda/render/iso/frontierArt/ exporting <KIT>_THINGS (seter, meadow, fjord, gates, ...).
// For every piece it rasterises the builder with `rasterThing` (props.ts) exactly as scripts/zelda-lab/frontier-art.mjs
// bakes it (the same crop to the silhouette, so w, h, ax, ay are the ones the kit's data has today) and writes
//   <out>/<id>.png   the guide: the solids' flat stepped colours, hard alpha
//   <out>/<id>.json  { id, w, h, ax, ay, mats: [names], and base64 per px: normal (rgb, the atlas's encoding),
//                    glow (a byte), deep (the depth byte, `depthCode`), mat (a byte: index into mats, 255 none),
//                    solid (uint16 LE: which solid call drew the px, in build order; 65535 none) }
// plus <out>/index.json (every id with its box). Default <out>: tmp/codex-kits/<kit>/guides in the repo.
// --part <id>=<name>:<from>-<to>[,...] also writes a guide <name> of piece <id> built from only its solid calls
// <from>..<to> (build order, as `solid` numbers them), in <id>'s box: a part to draw on its own (a mill's tower
// without its sails, to stand behind sails that turn). Several ranges joined by `+` (`<from>-<to>+<from>-<to>`) build
// the part from all of them (the lift head without its wheel, whose calls lie in the middle of the build).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { buildSync } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const iso = resolve(repo, 'themes/zelda/render/iso')
const args = process.argv.slice(2)
const kit = args[0]
if (!kit || !/^[a-z]+$/.test(kit)) throw new Error('usage: kit-guides.mjs <kit> [--only <id-prefix,...>] [--out <dir>]')
const opt = k => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : undefined }
const only = opt('--only')?.split(',')
const out = resolve(opt('--out') ?? resolve(repo, 'tmp/codex-kits', kit, 'guides'))

const bundle = buildSync({
  stdin: {
    contents: `export { rasterThing } from './props'; export { ${kit.toUpperCase()}_THINGS as art } from './frontierArt/${kit}'`,
    resolveDir: iso,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
  logLevel: 'error',
})
const { rasterThing, art } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].contents).toString('base64'))

/**
 * Rasterise one piece and learn, per px, which solid and which material the view sees there. A pick is only asked
 * for a point nearer than what the px holds (props.ts `Bench.hit`), so the last ask at a px is the one that shows.
 */
function guide(build, keep = () => true) {
  const seen = new Map()
  let k = 0
  const wrap = (pick, solid) => (x, y, z, nx, ny, nz) => {
    const m = typeof pick === 'string' ? pick : pick(x, y, z, nx, ny, nz)
    // The line of sight through screen px (sx, sy) meets the point (x, y, z): sx = x − y, sy = (x + y)/2 − z.
    seen.set(`${Math.round((x - y) * 64)},${Math.round(((x + y) / 2 - z) * 64)}`, [solid, m])
    return m
  }
  const raster = rasterThing(b => { k = 0; build({
    box: (x0, y0, z0, x1, y1, z1, pick) => { if (keep(k)) b.box(x0, y0, z0, x1, y1, z1, wrap(pick, k)); k++ },
    post: (x, y, z0, z1, r, pick) => { if (keep(k)) b.post(x, y, z0, z1, r, wrap(pick, k)); k++ },
    ball: (x, y, z, rx, ry, rz, pick) => { if (keep(k)) b.ball(x, y, z, rx, ry, rz, wrap(pick, k)); k++ },
  }) })
  return { ...raster, seen }
}

// A small PNG writer (RGBA, no filter), so the tool needs nothing beyond the repo's own packages.
const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function png(w, h, rgba) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

mkdirSync(out, { recursive: true })
const index = {}
const parts = {}
for (const p of opt('--part')?.split(',') ?? []) {
  const [, id, name, spans] = p.match(/^(\w+)=(\w+):(\d+-\d+(?:\+\d+-\d+)*)$/) ?? []
  if (!id) throw new Error(`--part ${p}: want <id>=<name>:<from>-<to>[+<from>-<to>...]`)
  ;(parts[id] ??= []).push({ name, spans: spans.split('+').map(r => r.split('-').map(Number)) })
}
for (const [id, build] of Object.entries(art)) {
  if (only && !only.some(p => id.startsWith(p)) && !parts[id]) continue
  const full = guide(build)
  // The crop frontier-art.mjs makes: the silhouette's box.
  let left = full.w, right = -1, top = full.h, bottom = -1
  for (let y = 0; y < full.h; y++) for (let x = 0; x < full.w; x++) {
    if (!full.albedo[(y * full.w + x) * 4 + 3]) continue
    left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  const crop = { W: right - left + 1, H: bottom - top + 1, left, top, ax: full.ax, ay: full.ay }
  if (!only || only.some(p => id.startsWith(p))) emit(id, full, crop)
  for (const p of parts[id] ?? []) emit(p.name, guide(build, k => p.spans.some(([a, b]) => k >= a && k <= b)), crop)
}
writeFileSync(resolve(out, 'index.json'), JSON.stringify(index, null, 1))
console.log(out)

/** Write a raster's guide cropped to `crop` (a piece's box; a part's raster is placed in it by the anchors). */
function emit(id, r, crop) {
  const { w, albedo, normal, seen } = r
  const { W, H } = crop
  const left = crop.left - (crop.ax - r.ax), top = crop.top - (crop.ay - r.ay)
  const ax = crop.ax - (crop.ax - r.ax), ay = crop.ay - (crop.ay - r.ay)
  const h = r.h
  const rgba = new Uint8Array(W * H * 4)
  const nrm = Buffer.alloc(W * H * 3)
  const glow = Buffer.alloc(W * H)
  const deep = Buffer.alloc(W * H)
  const mat = Buffer.alloc(W * H, 255)
  const solid = Buffer.alloc(W * H * 2, 255)
  const mats = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y + top < 0 || y + top >= h || x + left < 0 || x + left >= w) continue
    const o = ((y + top) * w + x + left) * 4
    const i = y * W + x
    if (!albedo[o + 3]) continue
    rgba.set(albedo.subarray(o, o + 3), i * 4); rgba[i * 4 + 3] = 255
    nrm.set(normal.subarray(o, o + 3), i * 3)
    glow[i] = normal[o + 3]
    deep[i] = albedo[o + 3]
    const sx = x + left + 0.5 - ax
    const sy = y + top + 0.5 - ay
    const hit = seen.get(`${Math.round(sx * 64)},${Math.round(sy * 64)}`)
    if (hit) {
      let m = mats.indexOf(hit[1]); if (m < 0) m = mats.push(hit[1]) - 1
      mat[i] = m; solid.writeUInt16LE(hit[0], i * 2)
    }
  }
  const box = { w: W, h: H, ax: ax - left, ay: ay - top }
  writeFileSync(resolve(out, `${id}.png`), png(W, H, rgba))
  writeFileSync(resolve(out, `${id}.json`), JSON.stringify({
    id, ...box, mats,
    normal: nrm.toString('base64'), glow: glow.toString('base64'), deep: deep.toString('base64'),
    mat: mat.toString('base64'), solid: solid.toString('base64'),
  }))
  index[id] = box
  console.log(id, `${W}x${H}`, 'anchor', box.ax, box.ay, 'mats', mats.join(' '))
}
