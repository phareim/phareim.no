// The iso art packs of Neon Shrine (docs/games/neon-shrine.md, "The art packs"): a table of drawn pieces (the
// `ThingArt` records of render/iso/thingArt.ts) to two PNGs and an index, and back. Pure apart from `writePack`.
//
// - albedo.png, RGBA8: rgb = the piece's colour, alpha = max(1, deep) where drawn, 0 where clear; what
//   things.ts `paintThing` writes into the atlas, byte for byte.
// - normal.png, RGBA8: rgb = npal[nrows] (which way the px faces), alpha = round(glow * 255).
// - index: per piece its rect in the pack (x, y, w, h), its anchor (ax, ay) and its `src` and `drawn`.
// Pieces are shelf-packed in sorted-id order, one clear px between them. A `like` frame (a pixel edit of another
// piece's drawing) is expanded to its own px: its normals and depth are the other's. The index keeps the table's
// order, so a kit's atlas packs as it did.
//
// The PNG writer is hand-written on node:zlib: IHDR, one IDAT, IEND, no ancillary chunks, the same bytes for the
// same pixels on the same Node. It never drops the colour of a px with a low alpha (as oxipng -a or pngquant
// would): the alpha is data here.
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import { buildSync } from 'esbuild'

const here = dirname(fileURLToPath(import.meta.url))
export const repo = resolve(here, '../../..')

// ------------------------------------------------------------------------------------------------ PNG writer
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, body) {
  const out = Buffer.alloc(12 + body.length)
  out.writeUInt32BE(body.length, 0)
  out.write(type, 4, 'latin1')
  body.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length)
  return out
}
const paeth = (a, b, c) => {
  const p = a + b - c
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}
/** One row filtered by filter f (0-4) into out at o (the filter byte first). */
function filterRow(f, px, y, stride, out, o) {
  out[o] = f
  const row = y * stride
  for (let i = 0; i < stride; i++) {
    const x = px[row + i]
    const a = i >= 4 ? px[row + i - 4] : 0
    const u = y > 0 ? px[row - stride + i] : 0
    const c = i >= 4 && y > 0 ? px[row - stride + i - 4] : 0
    const p = f === 0 ? 0 : f === 1 ? a : f === 2 ? u : f === 3 ? (a + u) >> 1 : paeth(a, u, c)
    out[o + 1 + i] = (x - p) & 255
  }
}
/** The image data filtered: one filter for every row, or (-1) per row the one with the least sum of |signed byte|. */
function filtered(px, w, h, mode) {
  const stride = w * 4
  const out = Buffer.alloc(h * (stride + 1))
  const tmp = Buffer.alloc(stride + 1)
  for (let y = 0; y < h; y++) {
    const o = y * (stride + 1)
    if (mode >= 0) { filterRow(mode, px, y, stride, out, o); continue }
    let best = Infinity
    for (let f = 0; f < 5; f++) {
      filterRow(f, px, y, stride, tmp, 0)
      let s = 0
      for (let i = 1; i <= stride; i++) s += tmp[i] < 128 ? tmp[i] : 256 - tmp[i]
      if (s < best) { best = s; tmp.copy(out, o) }
    }
  }
  return out
}
/**
 * Encode w x h RGBA8 px (straight alpha) as a PNG: the smallest of every row filter alone and the adaptive choice,
 * each deflated at level 9. Deterministic for the same Node/zlib. (`filter` forces one, for the tests.)
 */
export function encodePng(w, h, px, { filter } = {}) {
  if (px.length !== w * h * 4) throw new Error(`encodePng: ${px.length} bytes for ${w}x${h}`)
  let best = null
  for (const mode of filter === undefined ? [-1, 0, 1, 2, 3, 4] : [filter]) {
    const z = deflateSync(filtered(px, w, h, mode), { level: 9, memLevel: 9 })
    if (!best || z.length < best.length) best = z
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', best), chunk('IEND', Buffer.alloc(0))])
}

// ------------------------------------------------------------------------------------------------ the decoder
let decoder
/** themes/zelda/render/iso/artPng.ts `decodePng`, the game's own decoder. */
export function decodePng(bytes) {
  if (!decoder) {
    const out = buildSync({ entryPoints: [join(repo, 'themes/zelda/render/iso/artPng.ts')], bundle: true, write: false, format: 'cjs', platform: 'neutral', logLevel: 'error', mainFields: ['module', 'main'] })
    const mod = { exports: {} }
    new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports)
    decoder = mod.exports.decodePng
  }
  return decoder(bytes)
}

// ------------------------------------------------------------------------------------------------ table -> pack
const hex = s => { const v = parseInt(s.replace('#', ''), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255] }

/**
 * Paint one piece of a table at (ox, oy) of a w-wide albedo/normal pair, as things.ts `paintThing` does (a `like`
 * frame takes its normals and depth from the drawing it names, looked up in `table`).
 */
export function paintPiece(t, table, albedo, normal, aw, ox, oy) {
  const geo = t.like ? table[t.like] : t
  if (!geo || geo.like) throw new Error(`like ${t.like}: not a drawing of this table`)
  if (geo.w !== t.w || geo.h !== t.h) throw new Error(`like ${t.like}: another size`)
  const deep = Buffer.from(geo.deep, 'base64')
  const pal = new Map(Object.entries(t.pal).map(([k, v]) => [k, hex(v)]))
  const npal = geo.npal.map(hex)
  for (let y = 0; y < t.h; y++) {
    const row = t.rows[y]
    const nrow = geo.nrows[y]
    for (let x = 0; x < t.w; x++) {
      const ch = row[x]
      if (ch === '.') continue
      const c = pal.get(ch)
      const n = npal[nrow.charCodeAt(x) - 48]
      if (!c || !n) throw new Error(`(${x}, ${y}): no colour or normal for ${ch}`)
      const o = ((oy + y) * aw + ox + x) * 4
      albedo[o] = c[0]; albedo[o + 1] = c[1]; albedo[o + 2] = c[2]
      albedo[o + 3] = Math.max(1, deep[y * t.w + x])
      normal[o] = n[0]; normal[o + 1] = n[1]; normal[o + 2] = n[2]
      normal[o + 3] = Math.round((t.glow[ch] ?? 0) * 255)
    }
  }
}

/** Where each piece goes: shelves in sorted-id order, one clear px between pieces, w a multiple of 8. */
export function layout(table) {
  const ids = Object.keys(table).sort()
  const area = ids.reduce((s, id) => s + (table[id].w + 1) * (table[id].h + 1), 0)
  const widest = Math.max(...ids.map(id => table[id].w))
  const w = Math.ceil(Math.max(widest, Math.sqrt(area * 1.15)) / 8) * 8
  const at = {}
  let x = 0, y = 0, shelf = 0
  for (const id of ids) {
    const t = table[id]
    if (x && x + t.w > w) { x = 0; y += shelf + 1; shelf = 0 }
    at[id] = { x, y }
    x += t.w + 1
    shelf = Math.max(shelf, t.h)
  }
  return { w, h: y + shelf, at }
}

/** A table of pieces to its pack: { w, h, albedo, normal, pieces } (pieces in the table's order). */
export function packTable(table) {
  const { w, h, at } = layout(table)
  const albedo = new Uint8Array(w * h * 4)
  const normal = new Uint8Array(w * h * 4)
  const pieces = {}
  for (const [id, t] of Object.entries(table)) {
    const { x, y } = at[id]
    paintPiece(t, table, albedo, normal, w, x, y)
    pieces[id] = { x, y, w: t.w, h: t.h, ax: t.ax, ay: t.ay, ...(t.src ? { src: t.src } : {}), ...(t.drawn ? { drawn: t.drawn } : {}) }
  }
  return { w, h, albedo, normal, pieces }
}

/** The index file of a pack (uploaded as role `index`): its size and its pieces. */
export const indexOf = (group, pack) => ({ format: 1, group, w: pack.w, h: pack.h, pieces: pack.pieces })

export const sha256 = b => createHash('sha256').update(b).digest('hex')

/** The pack's three files: { albedo, normal, index } as bytes, each with its sha256. */
export function packFiles(group, pack) {
  const files = {
    albedo: encodePng(pack.w, pack.h, pack.albedo),
    normal: encodePng(pack.w, pack.h, pack.normal),
    index: Buffer.from(JSON.stringify(indexOf(group, pack)) + '\n'),
  }
  return Object.fromEntries(Object.entries(files).map(([k, bytes]) => [k, { bytes, sha256: sha256(bytes) }]))
}

/** Write a pack's files to dir (albedo.png, normal.png, index.json); returns packFiles'. */
export function writePack(dir, group, pack) {
  const files = packFiles(group, pack)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'albedo.png'), files.albedo.bytes)
  writeFileSync(join(dir, 'normal.png'), files.normal.bytes)
  writeFileSync(join(dir, 'index.json'), files.index.bytes)
  return files
}

/** Decode a pack's files ({albedo, normal} PNG bytes, the index JSON) to { w, h, albedo, normal, pieces }. */
export function readPack(albedoPng, normalPng, index) {
  const a = decodePng(albedoPng)
  const n = decodePng(normalPng)
  if (a.w !== n.w || a.h !== n.h) throw new Error('the albedo and the normal map differ in size')
  if (index && (index.w !== a.w || index.h !== a.h)) throw new Error('the index is for another size')
  return { w: a.w, h: a.h, albedo: a.data, normal: n.data, pieces: index?.pieces ?? {} }
}

// ------------------------------------------------------------------------------------------------ pack -> table
const LETTERS = [...Array(94)].map((_, i) => String.fromCharCode(33 + i)).filter(ch => ch !== '.')
const letter = i => LETTERS[i] ?? String.fromCharCode(256 + i - LETTERS.length)
const rgbHex = (b, o) => '#' + [b[o], b[o + 1], b[o + 2]].map(v => v.toString(16).padStart(2, '0')).join('')

/** One piece of a pack back to a `ThingArt` record (no `like`: every frame has its own normals and depth). */
export function unpackPiece(pack, p) {
  const colors = new Map()
  const normals = new Map()
  const pal = {}
  const glow = {}
  const rows = []
  const nrows = []
  const deep = Buffer.alloc(p.w * p.h)
  for (let y = 0; y < p.h; y++) {
    let row = ''
    let nrow = ''
    for (let x = 0; x < p.w; x++) {
      const o = ((p.y + y) * pack.w + p.x + x) * 4
      const d = pack.albedo[o + 3]
      if (!d) { row += '.'; nrow += '.'; continue }
      deep[y * p.w + x] = d
      const color = rgbHex(pack.albedo, o)
      const shine = pack.normal[o + 3]
      const key = color + shine
      if (!colors.has(key)) {
        const ch = letter(colors.size)
        colors.set(key, ch)
        pal[ch] = color
        if (shine) glow[ch] = +(shine / 255).toFixed(3)
      }
      row += colors.get(key)
      const facing = rgbHex(pack.normal, o)
      if (!normals.has(facing)) normals.set(facing, normals.size)
      nrow += String.fromCharCode(48 + normals.get(facing))
    }
    rows.push(row)
    nrows.push(nrow)
  }
  return {
    w: p.w, h: p.h, ax: p.ax, ay: p.ay, ...(p.src ? { src: p.src } : {}),
    pal, glow, rows, nrows, npal: [...normals.keys()], deep: deep.toString('base64'), ...(p.drawn ? { drawn: p.drawn } : {}),
  }
}

/** A whole pack back to its table, in the index's order. */
export const unpackTable = pack => Object.fromEntries(Object.entries(pack.pieces).map(([id, p]) => [id, unpackPiece(pack, p)]))

/** Does a piece of one pack have the same px as a piece of another (both maps, the whole rect)? */
export function samePixels(a, pa, b, pb) {
  if (pa.w !== pb.w || pa.h !== pb.h) return false
  for (let y = 0; y < pa.h; y++) {
    const oa = ((pa.y + y) * a.w + pa.x) * 4
    const ob = ((pb.y + y) * b.w + pb.x) * 4
    const n = pa.w * 4
    if (Buffer.compare(Buffer.from(a.albedo.buffer, a.albedo.byteOffset + oa, n), Buffer.from(b.albedo.buffer, b.albedo.byteOffset + ob, n))) return false
    if (Buffer.compare(Buffer.from(a.normal.buffer, a.normal.byteOffset + oa, n), Buffer.from(b.normal.buffer, b.normal.byteOffset + ob, n))) return false
  }
  return true
}
