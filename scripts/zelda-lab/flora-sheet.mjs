#!/usr/bin/env node
// Neon Shrine flora lab: the hi-res plants of the 16-bit view
// (themes/zelda/render/iso/flora.ts) on contact sheets, without the game.
// Snap Chromium: outDir must be a non-hidden path under $HOME.
//
//   node scripts/zelda-lab/flora-sheet.mjs <outDir> [looks]
//
// looks is a comma list of coast, wild, beach (default: all three). Per look
// it writes flora-<look>.png, four panels at 4× on a dusk ground colour:
// every sprite's own colours with its name, its normal map, a lit preview
// (colours × (ambient #8e82c4 + a magenta point light from the left + a cyan
// one from the right), from the normals), and a small scene lit the same way
// by two lamps standing in it: a forest edge of overlapping canopy trees with
// lone trees, bushes, tufts and flowers in front (-scene-albedo is the same
// scene unlit). The panels are also written one by one (flora-<look>-albedo.png,
// -normal, -lit, -scene) and the two atlas pictures as they are
// (flora-<look>-atlas.png, -atlas-normal.png). ZOOM=<n> changes the 4.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, lookArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: flora-sheet.mjs <outDir> [looks]'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const looks = (lookArg || 'coast,wild,beach').split(',')
const zoom = Math.max(1, Number(process.env.ZOOM) || 4)

const entry = `
import { buildFlora } from ${JSON.stringify(join(repo, 'themes/zelda/render/iso/flora.ts'))}

const Z = ${zoom}
const GROUND = '#1f4a68'
const KINDS = ['tree', 'canopy', 'palm', 'bush', 'tall', 'reed', 'tuft', 'flowerPink', 'flowerCyan']
/** The contact sheet's rows: the big plants, then the small ones. */
const ROWS = [['tree', 'canopy'], ['palm', 'bush', 'tall', 'reed', 'tuft', 'flowerPink', 'flowerCyan']]

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

/** The atlas lit by the sheet's three lights, from its normals. Atlas-sized, 1:1. */
function litAtlas(atlas) {
  const w = atlas.albedo.width, h = atlas.albedo.height
  const a = atlas.albedo.getContext('2d').getImageData(0, 0, w, h)
  const n = atlas.normal.getContext('2d').getImageData(0, 0, w, h)
  const o = canvas(w, h)
  const og = o.getContext('2d')
  const img = og.createImageData(w, h)
  const amb = [0x8e / 255, 0x82 / 255, 0xc4 / 255]
  const mag = [1.0, 0.25, 0.75], cy = [0.2, 0.95, 1.0]
  for (const list of Object.values(atlas.sprites)) for (const sp of list) {
    // Two point lights a little outside the sprite, at mid height, in front of it.
    const L = [[sp.x - sp.w * 0.5 - 14, sp.y + sp.h * 0.35, 26, mag], [sp.x + sp.w * 1.5 + 14, sp.y + sp.h * 0.3, 26, cy]]
    for (let y = sp.y; y < sp.y + sp.h; y++) for (let x = sp.x; x < sp.x + sp.w; x++) {
      const i = (y * w + x) * 4
      if (!a.data[i + 3]) continue
      let nx = n.data[i] / 127.5 - 1, ny = n.data[i + 1] / 127.5 - 1, nz = n.data[i + 2] / 127.5 - 1
      const nl = Math.hypot(nx, ny, nz) || 1
      nx /= nl; ny /= nl; nz /= nl
      let r = amb[0], g = amb[1], b = amb[2]
      for (const [lx, ly, lz, col] of L) {
        let dx = lx - x, dy = -(ly - y), dz = lz
        const d = Math.hypot(dx, dy, dz)
        dx /= d; dy /= d; dz /= d
        const lam = Math.max(0, nx * dx + ny * dy + nz * dz)
        const att = 1 / (1 + (d / 70) * (d / 70))
        const k = lam * att * 1.35
        r += col[0] * k; g += col[1] * k; b += col[2] * k
      }
      img.data[i] = Math.min(255, a.data[i] * r)
      img.data[i + 1] = Math.min(255, a.data[i + 1] * g)
      img.data[i + 2] = Math.min(255, a.data[i + 2] * b)
      img.data[i + 3] = 255
    }
  }
  og.putImageData(img, 0, 0)
  return o
}

/** One panel: every sprite of \`src\` (an atlas-sized picture) in rows, with names when asked. */
function panel(atlas, src, title, names) {
  const pad = 6, label = names ? 9 : 0
  let W = 0, H = 12
  const rows = ROWS.map(kinds => {
    let x = pad, tall = 0
    const cells = []
    for (const kind of kinds) for (let i = 0; i < atlas.sprites[kind].length; i++) {
      const sp = atlas.sprites[kind][i]
      cells.push({ kind, i, sp, x })
      x += Math.max(sp.w, names ? 14 : 0) + pad
      tall = Math.max(tall, sp.h)
    }
    const row = { cells, y: H, tall }
    W = Math.max(W, x)
    H += tall + label + pad
    return row
  })
  const c = canvas(W * Z, H * Z)
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  g.fillStyle = GROUND
  g.fillRect(0, 0, c.width, c.height)
  g.fillStyle = '#cfc6ff'
  g.font = 'bold ' + (Z * 4.5) + 'px monospace'
  g.textBaseline = 'top'
  g.fillText(title, pad * Z, 3 * Z)
  g.font = (Z * 3) + 'px monospace'
  for (const row of rows) for (const cell of row.cells) {
    const sp = cell.sp
    g.drawImage(src, sp.x, sp.y, sp.w, sp.h, cell.x * Z, (row.y + row.tall - sp.h) * Z, sp.w * Z, sp.h * Z)
    if (names) {
      g.fillStyle = '#9fb4e8'
      g.fillText(cell.kind.replace('flower', 'fl') + cell.i, cell.x * Z, (row.y + row.tall + 2) * Z)
      // The point that stands on the ground.
      g.fillStyle = '#ffd23f'
      g.fillRect((cell.x + sp.ax) * Z - 1, (row.y + row.tall - sp.h + sp.ay) * Z, 3, 2)
    }
  }
  return c
}

/**
 * A flat teal-indigo clearing with a forest edge behind it, drawn back to
 * front. With \`lit\` the whole picture, ground and plants, is lit from the
 * normals by the dusk ambient and two lamps standing in it: magenta on the
 * left, cyan on the right.
 */
function scene(atlas, lit) {
  const W = 300, H = 190
  const col = canvas(W, H), nor = canvas(W, H)
  const g = col.getContext('2d'), ng = nor.getContext('2d')
  g.fillStyle = '#1f4a68'
  g.fillRect(0, 0, W, H)
  // The ground faces up and a little toward the viewer.
  ng.fillStyle = 'rgb(128, 217, 217)'
  ng.fillRect(0, 0, W, H)
  // Ground patches in 8-px blocks, like the classic grass at twice the density.
  let s = 9
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
  for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) {
    const n = Math.sin(x * 0.045 + y * 0.03) + Math.sin(x * 0.02 - y * 0.06) + rnd() * 0.5
    g.fillStyle = n > 0.9 ? '#2d6682' : n < -0.7 ? '#1b4560' : '#245573'
    g.fillRect(x, y, 8, 8)
  }
  const items = []
  const put = (kind, x, y, pick) => { const l = atlas.sprites[kind]; items.push({ sp: l[Math.floor(pick * l.length) % l.length], x: Math.round(x), y: Math.round(y) }) }
  // The forest edge: three rows of canopy trees, a tile (32 px) apart, each row half a tile off.
  let k = 0
  for (let row = 0; row < 3; row++) for (let i = 0; i < (row === 2 ? 4 : 5); i++) {
    const x = 26 + i * 33 + (row % 2) * 16 + (rnd() - 0.5) * 8 + (row === 2 ? -4 : 0)
    put('canopy', x, 80 + row * 20 + (rnd() - 0.5) * 5, ((k++ * 7) % 4) / 4)
  }
  put('tree', 214, 104, 0); put('tree', 258, 124, 0.25); put('tree', 196, 162, 0.5); put('tree', 44, 172, 0.75)
  put('bush', 150, 148, 0); put('bush', 232, 164, 0.4); put('bush', 96, 168, 0.8)
  put('palm', 262, 184, 0)
  for (let i = 0; i < 4; i++) put('tall', 112 + i * 9 + rnd() * 4, 150 + (i % 2) * 7 + rnd() * 3, rnd())
  for (let i = 0; i < 14; i++) put('tuft', 20 + rnd() * 260, 132 + rnd() * 52, rnd())
  for (let i = 0; i < 5; i++) put('flowerPink', 150 + rnd() * 70, 168 + rnd() * 18, rnd())
  for (let i = 0; i < 5; i++) put('flowerCyan', 60 + rnd() * 60, 136 + rnd() * 22, rnd())
  for (let i = 0; i < 3; i++) put('reed', 12 + i * 7 + rnd() * 3, 150 + rnd() * 8, rnd())
  items.sort((a, b) => a.y - b.y)
  for (const it of items) {
    // A soft foot shadow, so the plants sit on the ground as they will under the engine's light.
    g.fillStyle = 'rgba(8, 14, 40, 0.35)'
    const sw = Math.max(4, Math.round(it.sp.w * 0.45))
    g.fillRect(it.x - (sw >> 1), it.y - 1, sw, 3)
    g.fillRect(it.x - (sw >> 1) + 2, it.y - 2, sw - 4, 5)
  }
  for (const it of items) {
    const sp = it.sp
    g.drawImage(atlas.albedo, sp.x, sp.y, sp.w, sp.h, it.x - sp.ax, it.y - sp.ay, sp.w, sp.h)
    ng.drawImage(atlas.normal, sp.x, sp.y, sp.w, sp.h, it.x - sp.ax, it.y - sp.ay, sp.w, sp.h)
  }
  if (lit) {
    const a = g.getImageData(0, 0, W, H), n = ng.getImageData(0, 0, W, H)
    const amb = [0x8e / 255, 0x82 / 255, 0xc4 / 255]
    const lamps = [[52, 128, 34, [1.0, 0.25, 0.75]], [236, 136, 34, [0.2, 0.95, 1.0]]]
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      let nx = n.data[i] / 127.5 - 1, ny = n.data[i + 1] / 127.5 - 1, nz = n.data[i + 2] / 127.5 - 1
      const nl = Math.hypot(nx, ny, nz) || 1
      nx /= nl; ny /= nl; nz /= nl
      let r = amb[0], gg = amb[1], b = amb[2]
      for (const [lx, ly, lz, c] of lamps) {
        let dx = lx - x, dy = -(ly - y), dz = lz
        const d = Math.hypot(dx, dy, dz)
        dx /= d; dy /= d; dz /= d
        const q = Math.max(0, nx * dx + ny * dy + nz * dz) / (1 + (d / 80) * (d / 80)) * 1.5
        r += c[0] * q; gg += c[1] * q; b += c[2] * q
      }
      // Neon keeps its own light.
      const neon = Math.max(a.data[i], a.data[i + 1], a.data[i + 2]) > 235 ? 1 : 0
      a.data[i] = Math.min(255, a.data[i] * Math.max(r, neon))
      a.data[i + 1] = Math.min(255, a.data[i + 1] * Math.max(gg, neon))
      a.data[i + 2] = Math.min(255, a.data[i + 2] * Math.max(b, neon))
    }
    g.putImageData(a, 0, 0)
  }
  const c = canvas(W * Z, H * Z)
  const cg = c.getContext('2d')
  cg.imageSmoothingEnabled = false
  cg.drawImage(col, 0, 0, W * Z, H * Z)
  return c
}

function stack(parts) {
  const W = Math.max(...parts.map(p => p.width))
  const H = parts.reduce((a, p) => a + p.height, 0)
  const c = canvas(W, H)
  const g = c.getContext('2d')
  g.fillStyle = GROUND
  g.fillRect(0, 0, W, H)
  let y = 0
  for (const p of parts) { g.drawImage(p, 0, y); y += p.height }
  return c
}

function onGround(src) {
  const c = canvas(src.width, src.height)
  const g = c.getContext('2d')
  g.fillStyle = GROUND
  g.fillRect(0, 0, c.width, c.height)
  g.drawImage(src, 0, 0)
  return c
}

const res = { files: {}, info: {} }
try {
  for (const look of ${JSON.stringify(looks)}) {
    const t0 = performance.now()
    const atlas = buildFlora(look)
    const ms = performance.now() - t0
    const lit = litAtlas(atlas)
    const a = panel(atlas, atlas.albedo, look + ' · albedo', true)
    const n = panel(atlas, atlas.normal, look + ' · normal', false)
    const l = panel(atlas, lit, look + ' · lit: ambient #8e82c4 + magenta from the left + cyan from the right', false)
    const sc = scene(atlas, true)
    const sa = scene(atlas, false)
    res.files['flora-' + look + '.png'] = stack([a, n, l, sc]).toDataURL('image/png')
    res.files['flora-' + look + '-albedo.png'] = a.toDataURL('image/png')
    res.files['flora-' + look + '-normal.png'] = n.toDataURL('image/png')
    res.files['flora-' + look + '-lit.png'] = l.toDataURL('image/png')
    res.files['flora-' + look + '-scene.png'] = sc.toDataURL('image/png')
    res.files['flora-' + look + '-scene-albedo.png'] = sa.toDataURL('image/png')
    res.files['flora-' + look + '-atlas.png'] = onGround(atlas.albedo).toDataURL('image/png')
    res.files['flora-' + look + '-atlas-normal.png'] = atlas.normal.toDataURL('image/png')
    const count = {}
    for (const kind of KINDS) count[kind] = atlas.sprites[kind].map(s => s.w + 'x' + s.h)
    res.info[look] = { ms: Math.round(ms), atlas: atlas.albedo.width + 'x' + atlas.albedo.height, sprites: count, cached: buildFlora(look) === atlas }
  }
} catch (e) {
  res.error = String(e && e.stack || e)
}
document.getElementById('out').textContent = JSON.stringify(res)
`

const entryFile = join(out, '_flora-entry.ts')
const bundle = join(out, '_flora-bundle.js')
const html = join(out, '_flora.html')
writeFileSync(entryFile, entry)
await esbuild.build({ entryPoints: [entryFile], bundle: true, format: 'iife', outfile: bundle, logLevel: 'warning' })
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#000"><pre id="out"></pre><script src="${bundle}"></script></body>`)

// The page leaves its pictures as data URLs in the DOM; --dump-dom hands them over.
const dom = execFileSync('chromium-browser', [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
  '--virtual-time-budget=20000', '--dump-dom', `file://${html}`,
], { maxBuffer: 1 << 28, timeout: 120000, stdio: ['ignore', 'pipe', 'ignore'] }).toString()
const m = /<pre id="out">([\s\S]*?)<\/pre>/.exec(dom)
if (!m || !m[1]) { console.error('the page drew nothing'); process.exit(1) }
const res = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'))
if (res.error) { console.error(res.error); process.exit(1) }
for (const [name, url] of Object.entries(res.files)) {
  const png = join(out, name)
  writeFileSync(png, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))
  if (!/-(albedo|normal|lit|scene|scene-albedo|atlas|atlas-normal)\.png$/.test(name)) console.log(png)
}
for (const [look, info] of Object.entries(res.info)) {
  console.log(`${look}: atlas ${info.atlas}, built in ${info.ms} ms, cached ${info.cached}`)
  for (const [kind, sizes] of Object.entries(info.sprites)) console.log(`  ${kind}: ${sizes.join(' ')}`)
}
