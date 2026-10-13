#!/usr/bin/env node
// Neon Shrine hero lab: every hero frame for a list of looks as one PNG, no
// browser needed (the frames are rows of palette letters; this writes the
// pixels itself).
//
//   node scripts/zelda-lab/hero-sheet.mjs <out.png> [look …]
//
// A look is `drawn`, `girl`, `random`, a shape as hair/head/bottom
// (`pigtails/bow/dress`), or a HeroLook as JSON. Without looks: the drawn
// hero, the girl, and one of each hair style, headwear and bottom.
// SCALE=<n> sets the zoom (default 5), COLS=<n> the frames per line (9).
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../themes/zelda')
const [outArg, ...lookArgs] = process.argv.slice(2)
if (!outArg) { console.error('usage: hero-sheet.mjs <out.png> [look …]'); process.exit(2) }

const built = esbuild.buildSync({
  stdin: {
    contents: `export * from './render/heroFrames'; export * from './render/heroLook'; export { PAL } from './render/sprites'`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const M = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))

function lookOf(arg) {
  if (arg === 'drawn') return M.DRAWN_LOOK
  if (arg === 'girl') return M.GIRL_LOOK
  if (arg === 'random') return M.randomLook()
  if (arg.startsWith('{')) {
    const look = M.parseHeroLook({ ...M.DRAWN_LOOK, ...JSON.parse(arg) })
    if (!look) throw new Error('not a look: ' + arg)
    return look
  }
  const [hair, head, bottom] = arg.split('/')
  const look = M.parseHeroLook({ ...M.DRAWN_LOOK, hair, head: head ?? 'band', bottom: bottom ?? 'trousers' })
  if (!look) throw new Error('not a shape: ' + arg)
  return look
}

const looks = (lookArgs.length ? lookArgs : [
  'drawn', 'girl', 'long/band/shorts', 'tail/band/skirt', 'tail/bow/trousers', 'pigtails/bow/dress', 'pigtails/band/shorts', 'short/none/skirt', 'long/none/dress',
]).map(lookOf)

const SCALE = +(process.env.SCALE || 5)
const COLS = +(process.env.COLS || 9)
const PAD = 2
const CELL = 16 + PAD
const lines = Math.ceil(M.HERO_FRAMES.length / COLS)
const W = (COLS * CELL + PAD) * SCALE
const H = (looks.length * (lines * CELL + PAD * 2) + PAD) * SCALE
const px = Buffer.alloc(W * H * 4)
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

function fill(x, y, w, h, color) {
  const [r, g, b] = hex(color)
  for (let yy = y * SCALE; yy < (y + h) * SCALE; yy++) {
    for (let xx = x * SCALE; xx < (x + w) * SCALE; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue
      const i = (yy * W + xx) * 4
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255
    }
  }
}

// The town's grass by night under every other look, so dark hair and the outline both show.
const GROUNDS = ['#1f5a4e', '#3b2b62']
fill(0, 0, W / SCALE, H / SCALE, '#0b0616')
looks.forEach((look, li) => {
  const pal = { ...M.PAL, ...M.lookPalette(look) }
  const frames = M.heroFrames(look)
  const top = PAD + li * (lines * CELL + PAD * 2)
  fill(PAD, top, COLS * CELL - PAD, lines * CELL - PAD, GROUNDS[li % 2])
  M.HERO_FRAMES.forEach((name, fi) => {
    const ox = PAD + (fi % COLS) * CELL + 1
    const oy = top + Math.floor(fi / COLS) * CELL + 1
    frames[name].forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = pal[row[x]]
        if (c) fill(ox + x, oy + y, 1, 1, c)
      }
    })
  })
})

// A PNG by hand: signature, IHDR, one IDAT of filter-0 scanlines, IEND.
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body))
  return Buffer.concat([len, body, sum])
}
const head = Buffer.alloc(13)
head.writeUInt32BE(W, 0); head.writeUInt32BE(H, 4); head[8] = 8; head[9] = 6
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4)
const out = resolve(outArg)
writeFileSync(out, Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]))
console.log(`${looks.length} looks × ${M.HERO_FRAMES.length} frames -> ${out} (${W}×${H})`)
console.log('frames:', M.HERO_FRAMES.join(' '))
