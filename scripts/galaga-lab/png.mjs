// Space Voyagers lab: a small PNG reader and writer (8-bit palette, grey, RGB and RGBA,
// non-interlaced: what `public/galaga/` and the lab's screenshots are), so the lab can
// measure a bitmap, cut a piece out of a picture and enlarge it without any dependency.
//
//   import { readPng, writePng, crop, enlarge, sheet } from './png.mjs'
//
// From the shell:
//   node scripts/galaga-lab/png.mjs zoom  <in.png> <out.png> <x> <y> <w> <h> [times]
//   node scripts/galaga-lab/png.mjs bounds <in.png>            # the opaque box and each row's span
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

/** → { w, h, data } with data RGBA, 4 bytes a pixel. */
export function readPng(file) {
  const buf = readFileSync(file)
  let p = 8
  let w = 0, h = 0, depth = 8, type = 6
  let palette = null
  let trns = null
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const name = buf.toString('latin1', p + 4, p + 8)
    const body = buf.subarray(p + 8, p + 8 + len)
    if (name === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]
      if (body[12] !== 0) throw new Error(`${file}: interlaced`)
    } else if (name === 'PLTE') palette = body
    else if (name === 'tRNS') trns = body
    else if (name === 'IDAT') idat.push(body)
    p += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const channels = type === 0 ? 1 : type === 2 ? 3 : type === 3 ? 1 : type === 4 ? 2 : 4
  const bpp = Math.max(1, (channels * depth) >> 3)
  const stride = Math.ceil((w * channels * depth) / 8)
  const lines = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const src = y * (stride + 1) + 1
    const dst = y * stride
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? lines[dst + x - bpp] : 0
      const b = y > 0 ? lines[dst - stride + x] : 0
      const c = x >= bpp && y > 0 ? lines[dst - stride + x - bpp] : 0
      let v = raw[src + x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const q = a + b - c; const pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
      lines[dst + x] = v & 255
    }
  }
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      if (type === 3) {
        let i
        if (depth === 8) i = lines[y * stride + x]
        else { const bit = x * depth; i = (lines[y * stride + (bit >> 3)] >> (8 - depth - (bit & 7))) & ((1 << depth) - 1) }
        data[o] = palette[i * 3]; data[o + 1] = palette[i * 3 + 1]; data[o + 2] = palette[i * 3 + 2]
        data[o + 3] = trns && i < trns.length ? trns[i] : 255
      } else {
        const s = y * stride + x * channels * (depth >> 3)
        const step = depth >> 3
        if (type === 0 || type === 4) { data[o] = data[o + 1] = data[o + 2] = lines[s]; data[o + 3] = type === 4 ? lines[s + step] : 255 } else {
          data[o] = lines[s]; data[o + 1] = lines[s + step]; data[o + 2] = lines[s + 2 * step]
          data[o + 3] = type === 6 ? lines[s + 3 * step] : 255
        }
      }
    }
  }
  return { w, h, data }
}

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
function crc(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}
function chunk(name, body) {
  const out = Buffer.alloc(12 + body.length)
  out.writeUInt32BE(body.length, 0)
  out.write(name, 4, 'latin1')
  body.copy(out, 8)
  out.writeUInt32BE(crc(out.subarray(4, 8 + body.length)), 8 + body.length)
  return out
}

export function writePng(file, img) {
  const { w, h, data } = img
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  const head = Buffer.alloc(13)
  head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6
  writeFileSync(file, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]))
}

export function blank(w, h, rgba = [24, 22, 40, 255]) {
  const data = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set(rgba, i * 4)
  return { w, h, data }
}

export function crop(img, x, y, w, h) {
  const out = blank(w, h, [0, 0, 0, 0])
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const sx = x + i, sy = y + j
      if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue
      out.data.set(img.data.subarray((sy * img.w + sx) * 4, (sy * img.w + sx) * 4 + 4), (j * w + i) * 4)
    }
  }
  return out
}

export function enlarge(img, k) {
  const out = blank(img.w * k, img.h * k, [0, 0, 0, 0])
  for (let y = 0; y < out.h; y++) {
    for (let x = 0; x < out.w; x++) {
      const s = (Math.floor(y / k) * img.w + Math.floor(x / k)) * 4
      out.data.set(img.data.subarray(s, s + 4), (y * out.w + x) * 4)
    }
  }
  return out
}

/** Put `src` on `dst` at (x, y); clear pixels show what is under them. */
export function paste(dst, src, x, y) {
  for (let j = 0; j < src.h; j++) {
    for (let i = 0; i < src.w; i++) {
      const dx = x + i, dy = y + j
      if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue
      const s = (j * src.w + i) * 4
      if (src.data[s + 3] < 128) continue
      dst.data.set(src.data.subarray(s, s + 4), (dy * dst.w + dx) * 4)
    }
  }
}

/** A one-pixel frame. */
export function box(dst, x, y, w, h, rgba) {
  for (let i = 0; i < w; i++) for (const yy of [y, y + h - 1]) if (x + i >= 0 && x + i < dst.w && yy >= 0 && yy < dst.h) dst.data.set(rgba, (yy * dst.w + x + i) * 4)
  for (let j = 0; j < h; j++) for (const xx of [x, x + w - 1]) if (xx >= 0 && xx < dst.w && y + j >= 0 && y + j < dst.h) dst.data.set(rgba, ((y + j) * dst.w + xx) * 4)
}

/** The opaque box of a bitmap and each row's first and last opaque column. */
export function bounds(img) {
  let x0 = img.w, x1 = -1, y0 = img.h, y1 = -1
  const rows = []
  for (let y = 0; y < img.h; y++) {
    let a = -1, b = -1
    for (let x = 0; x < img.w; x++) if (img.data[(y * img.w + x) * 4 + 3] > 127) { if (a < 0) a = x; b = x }
    rows.push([a, b])
    if (a >= 0) { x0 = Math.min(x0, a); x1 = Math.max(x1, b); y0 = Math.min(y0, y); y1 = y }
  }
  return { x0, y0, x1, y1, rows }
}

if (process.argv[1] && process.argv[1].endsWith('png.mjs')) {
  const [cmd, file, ...rest] = process.argv.slice(2)
  if (cmd === 'zoom') {
    const [out, x, y, w, h, k = '4'] = rest
    const img = readPng(file)
    writePng(out, enlarge(crop(img, +x, +y, +w || img.w, +h || img.h), +k))
  } else if (cmd === 'bounds') {
    const img = readPng(file)
    const b = bounds(img)
    console.log(`${file}: ${img.w} x ${img.h}, opaque ${b.x0}..${b.x1} x ${b.y0}..${b.y1}`)
    b.rows.forEach((r, y) => console.log(String(y).padStart(3), r[0] < 0 ? '' : `${r[0]}..${r[1]}`))
  } else {
    console.log('png.mjs zoom <in> <out> <x> <y> <w> <h> [times] | bounds <in>')
  }
}
