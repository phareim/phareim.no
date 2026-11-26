/**
 * The PNG decoder of the iso art packs (`artPack.ts`), shared by the game, the tests and the tools
 * (`scripts/zelda-lab/lib/artpack.mjs`). Pure: no canvas, no DOM.
 *
 * A pack's pixels carry data in their alpha (the albedo's depth, the normal map's glow), so they never pass through a
 * canvas or `createImageBitmap`: either premultiplies the colour by the alpha and loses the colour of a px at depth 1.
 * This reads the bytes itself: the chunks, the one zlib stream of the IDATs (`fflate`), and the five row filters.
 * Only what the packer writes is read: 8-bit RGBA, not interlaced. Anything else throws.
 */
import { unzlibSync } from 'fflate'

export interface Rgba { w: number; h: number; data: Uint8Array }

const SIG = [137, 80, 78, 71, 13, 10, 26, 10]

const u32 = (b: Uint8Array, o: number): number => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/** Decode an 8-bit RGBA PNG to its straight (not premultiplied) bytes, four a px, rows top down. */
export function decodePng(input: ArrayBuffer | Uint8Array): Rgba {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input)
  for (let i = 0; i < 8; i++) if (b[i] !== SIG[i]) throw new Error('png: not a PNG')
  let w = 0
  let h = 0
  const idat: Uint8Array[] = []
  let o = 8
  let ended = false
  while (o + 8 <= b.length) {
    const len = u32(b, o)
    const type = String.fromCharCode(b[o + 4]!, b[o + 5]!, b[o + 6]!, b[o + 7]!)
    const body = b.subarray(o + 8, o + 8 + len)
    if (body.length !== len) throw new Error('png: truncated')
    if (type === 'IHDR') {
      w = u32(body, 0)
      h = u32(body, 4)
      const [depth, color, comp, filter, interlace] = [body[8], body[9], body[10], body[11], body[12]]
      if (depth !== 8 || color !== 6) throw new Error(`png: only 8-bit RGBA (bit depth ${depth}, colour type ${color})`)
      if (comp !== 0 || filter !== 0 || interlace !== 0) throw new Error('png: interlaced or unknown method')
    } else if (type === 'IDAT') idat.push(body)
    else if (type === 'IEND') { ended = true; break }
    o += 12 + len
  }
  if (!w || !h || !idat.length || !ended) throw new Error('png: missing IHDR, IDAT or IEND')
  let z: Uint8Array
  if (idat.length === 1) z = idat[0]!
  else {
    z = new Uint8Array(idat.reduce((s, c) => s + c.length, 0))
    let p = 0
    for (const c of idat) { z.set(c, p); p += c.length }
  }
  const raw = unzlibSync(z)
  const stride = w * 4
  if (raw.length !== h * (stride + 1)) throw new Error(`png: ${raw.length} bytes of image data for ${w}x${h}`)
  const out = new Uint8Array(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]!
    const src = y * (stride + 1) + 1
    const row = y * stride
    const up = row - stride
    for (let i = 0; i < stride; i++) {
      const x = raw[src + i]!
      const a = i >= 4 ? out[row + i - 4]! : 0
      const u = y > 0 ? out[up + i]! : 0
      const c = i >= 4 && y > 0 ? out[up + i - 4]! : 0
      let v: number
      switch (f) {
        case 0: v = x; break
        case 1: v = x + a; break
        case 2: v = x + u; break
        case 3: v = x + ((a + u) >> 1); break
        case 4: v = x + paeth(a, u, c); break
        default: throw new Error(`png: row filter ${f}`)
      }
      out[row + i] = v & 255
    }
  }
  return { w, h, data: out }
}
