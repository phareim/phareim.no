#!/usr/bin/env node
// Bake a frontier art kit into THING_ART rows at the isometric view's native pixel pitch.
//   node scripts/zelda-lab/frontier-art.mjs <kit> [contact-sheet.html] [--solids] [--json <file>]
// The optional self-contained contact sheet uses the same pixels with hard alpha.
// A piece Codex has drawn over the solids (a record with `drawn` in the kit's data, scripts/zelda-lab/codex/kit-bake.mjs)
// is kept as drawn, if its box is still the solids' box; --solids bakes every piece from its solids again.
// --json <file> writes the solids' table as JSON there and leaves the data file alone (kit-bake.mjs reads it).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { buildSync } from 'esbuild'

const root = fileURLToPath(new URL('../../themes/zelda/render/iso/', import.meta.url))
const argv = process.argv.slice(2)
const flag = k => { const i = argv.indexOf(k); return i < 0 ? undefined : argv.splice(i, k === '--json' ? 2 : 1)[k === '--json' ? 1 : 0] }
const resolids = flag('--solids') !== undefined
const jsonOut = flag('--json')
const [kit, sheet] = argv
if (!kit || !/^[a-z]+$/.test(kit)) throw new Error('usage: frontier-art.mjs <kit> [contact-sheet.html]')

const input = buildSync({
  stdin: {
    contents: `export { rasterThing } from './props'; export { ${kit.toUpperCase()}_THINGS as art } from './frontierArt/${kit}'`,
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
})
const { rasterThing, art } = await import('data:text/javascript;base64,' + Buffer.from(input.outputFiles[0].contents).toString('base64'))
const paletteKeys = [...Array(94)].map((_, i) => String.fromCharCode(33 + i)).filter(ch => ch !== '.')
const rgbHex = (image, offset) => '#' + Buffer.from(image.subarray(offset, offset + 3)).toString('hex')

function bake(id, build) {
  const { w, h, ax, ay, albedo, normal } = rasterThing(build)
  let left = w
  let right = -1
  let top = h
  let bottom = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!albedo[(y * w + x) * 4 + 3]) continue
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  if (right < 0) throw new Error(`${id} produced an empty sprite`)
  const width = right - left + 1
  const height = bottom - top + 1
  const deep = Buffer.alloc(width * height)
  const rgba = Buffer.alloc(width * height * 4)
  const colors = new Map()
  const normals = new Map()
  const pal = {}
  const glow = {}
  const rows = []
  const nrows = []
  for (let y = top; y <= bottom; y++) {
    let row = ''
    let nrow = ''
    for (let x = left; x <= right; x++) {
      const offset = (y * w + x) * 4
      const i = (y - top) * width + x - left
      const depth = albedo[offset + 3]
      if (!depth) { row += '.'; nrow += '.'; continue }
      deep[i] = depth
      rgba.set(albedo.subarray(offset, offset + 3), i * 4)
      rgba[i * 4 + 3] = 255
      const color = rgbHex(albedo, offset)
      const shine = normal[offset + 3]
      const key = color + shine
      if (!colors.has(key)) {
        const ch = paletteKeys[colors.size] ?? String.fromCharCode(256 + colors.size - paletteKeys.length)
        colors.set(key, ch)
        pal[ch] = color
        if (shine) glow[ch] = +(shine / 255).toFixed(3)
      }
      row += colors.get(key)
      const facing = rgbHex(normal, offset)
      if (!normals.has(facing)) normals.set(facing, normals.size)
      nrow += String.fromCharCode(48 + normals.get(facing))
    }
    rows.push(row)
    nrows.push(nrow)
  }
  return {
    sprite: { w: width, h: height, ax: ax - left, ay: ay - top, pal, glow, rows, nrows, npal: [...normals.keys()], deep: deep.toString('base64') },
    preview: { id, w: width, h: height, rgba: rgba.toString('base64') },
  }
}

const baked = Object.entries(art).map(([id, build]) => ({ id, ...bake(id, build) }))
const json = JSON.stringify
const table = Object.fromEntries(baked.map(({ id, sprite }) => [id, sprite]))
if (jsonOut) {
  mkdirSync(dirname(resolve(jsonOut)), { recursive: true })
  writeFileSync(jsonOut, json(table))
  console.log(`${resolve(jsonOut)} (${baked.length} sprites from the solids)`)
  process.exit(0)
}
const destination = resolve(root, 'frontierArt', kit + 'Data.ts')
// The drawn pieces stay drawn.
const was = existsSync(destination) && readFileSync(destination, 'utf8').match(/unpackArt<[^>]*>>\("([^"]+)"\)/)
const before = was ? JSON.parse(gunzipSync(Buffer.from(was[1], 'base64')).toString()) : {}
let kept = 0
if (!resolids) for (const [id, t] of Object.entries(before)) {
  if (!t.drawn || !table[id]) continue
  const s = table[id]
  if ([t.w, t.h, t.ax, t.ay].join() !== [s.w, s.h, s.ax, s.ay].join()) {
    console.warn(`${id}: the solids' box changed (${[s.w, s.h, s.ax, s.ay]}, drawn ${[t.w, t.h, t.ax, t.ay]}): baked from the solids; redraw it`)
    continue
  }
  table[id] = t
  const preview = baked.find(b => b.id === id).preview
  const pal = Object.fromEntries(Object.entries(t.pal).map(([k, v]) => [k, Buffer.from(v.slice(1), 'hex')]))
  const rgba = Buffer.alloc(t.w * t.h * 4)
  t.rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') { pal[ch].copy(rgba, (y * t.w + x) * 4); rgba[(y * t.w + x) * 4 + 3] = 255 } }))
  preview.rgba = rgba.toString('base64')
  kept++
}
const packed = gzipSync(json(table)).toString('base64')
writeFileSync(destination, `// Generated by scripts/zelda-lab/frontier-art.mjs from ${kit}.ts${kept ? `; ${kept} of its ${baked.length} pieces drawn by Codex over those solids (\`drawn\`, scripts/zelda-lab/codex/kit-bake.mjs)` : ''}.
import type { ThingArt } from '../thingArt'
import { unpackArt } from './packed'

export const ${kit.toUpperCase()}_ART = unpackArt<Record<string, ThingArt>>(${json(packed)})
`)
console.log(`${destination} (${baked.length} sprites${kept ? `, ${kept} kept as drawn` : ''})`)

if (sheet) {
  mkdirSync(dirname(resolve(sheet)), { recursive: true })
  writeFileSync(sheet, `<!doctype html>
<meta charset="utf-8">
<title>Frontier art · ${kit}</title>
<style>
  body { background:#110d20; color:#e6def9; font:14px ui-monospace,monospace; margin:20px }
  main { display:flex; flex-wrap:wrap; gap:12px }
  figure { margin:0; padding:12px; display:grid; justify-items:center; align-content:end; gap:8px; background:#211b35 }
  canvas { image-rendering:pixelated }
</style>
<main></main>
<script>
  for (const { id, w, h, rgba } of ${json(baked.map(s => s.preview))}) {
    const tile = document.createElement('figure')
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.style.width = w * 2 + 'px'
    canvas.style.height = h * 2 + 'px'
    const pixels = Uint8ClampedArray.from(atob(rgba), ch => ch.charCodeAt(0))
    canvas.getContext('2d').putImageData(new ImageData(pixels, w, h), 0, 0)
    const label = document.createElement('figcaption')
    label.textContent = id
    tile.append(canvas, label)
    document.querySelector('main').append(tile)
  }
</script>\n`)
  console.log(resolve(sheet))
}
