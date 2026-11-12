#!/usr/bin/env node
// Neon Shrine backdrop lab: the 16-bit view's layered backdrop
// (themes/zelda/render/iso/backdrop.ts) on its own, without the game.
// Snap Chromium: outDir must be a non-hidden path under $HOME.
//
//   node scripts/zelda-lab/backdrop-sheet.mjs <outDir> [looks] [screens]
//
// looks: coast,wild,void (or `all`); screens: 640x400,585x1266 (hi-res px, or
// any WxH list). Per look and screen it writes:
//
//   <look>-<WxH>.png          all layers put together at 2× zoom, for three
//                             camera positions and moments, so the parallax
//                             and the drift show (side by side, or stacked
//                             when the screen is wide)
//   <look>-<WxH>-cam<n>.png   the same three, one by one
//   <look>-<WxH>-bloom.png    the first of them with a rough stand-in for the
//                             engine's bloom on the emissive layers
//   <look>-<WxH>-layers.png   each layer alone at 1×, on a checker, with its
//                             values
//
// COLORS='{"top":"#102a4a","horizon":"#ffb060"}' tries another sky.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, lookArg, screenArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: backdrop-sheet.mjs <outDir> [looks] [screens]'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

// Where the camera stands (hi-res px along x) and when (seconds), for the three pictures.
const CAMS = [[0, 0], [700, 12], [1500, 30.5]]
const ZOOM = 2
const GAP = 16

const entry = `
import { buildBackdrop } from ${JSON.stringify(join(repo, 'themes/zelda/render/iso/backdrop.ts'))}

const q = new URLSearchParams(location.hash.slice(1))
const look = q.get('look'), W = +q.get('w'), H = +q.get('h'), mode = q.get('mode')
const CAMS = ${JSON.stringify(CAMS)}, ZOOM = ${ZOOM}, GAP = ${GAP}
document.body.style.cssText = 'margin:0;background:#101014;overflow:hidden'
const t0 = performance.now()
const bd = buildBackdrop(look, W, H, q.get('colors') ? JSON.parse(q.get('colors')) : undefined)
const took = performance.now() - t0
if (buildBackdrop(look, W, H, q.get('colors') ? JSON.parse(q.get('colors')) : undefined) !== bd) throw new Error('not cached')

// One layer onto g, the way the engine places it: top at its share of the height, x by the camera and the clock.
function place(g, L, cam, t) {
  if (L.blink && (t % L.blink) >= L.blink / 2) return
  const y = Math.round(L.top * H)
  let x = -(cam * L.parallax + t * L.drift)
  if (!L.repeatX) { g.drawImage(L.canvas, Math.round(x), y); return }
  const w = L.canvas.width
  for (x = Math.round(((x % w) + w) % w - w); x < W; x += w) g.drawImage(L.canvas, x, y)
}
function compose(cam, t, bloom) {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  for (const L of bd.layers) place(g, L, cam, t)
  if (bloom) {
    // The emissive layers again, blurred and added: about what the engine's bloom does with them.
    const e = document.createElement('canvas')
    e.width = W; e.height = H
    const eg = e.getContext('2d')
    for (const L of bd.layers) if (L.emissive) place(eg, L, cam, t)
    g.globalCompositeOperation = 'lighter'
    g.globalAlpha = 0.55
    g.filter = 'blur(5px)'
    g.drawImage(e, 0, 0)
    g.filter = 'blur(14px)'
    g.globalAlpha = 0.35
    g.drawImage(e, 0, 0)
  }
  return c
}
function sheet(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  c.style.cssText = 'display:block'
  document.body.appendChild(c)
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  g.fillStyle = '#101014'
  g.fillRect(0, 0, w, h)
  return g
}
const wide = W >= H
const sizes = {
  all: wide ? [W * ZOOM, (H * ZOOM + GAP) * CAMS.length - GAP] : [(W * ZOOM + GAP) * CAMS.length - GAP, H * ZOOM],
  one: [W * ZOOM, H * ZOOM],
  layers: [Math.max(...bd.layers.map(L => L.canvas.width)) + 16, bd.layers.reduce((s, L) => s + L.canvas.height + 30, 8)],
}
if (mode === 'sizes') {
  document.title = JSON.stringify({ sizes, took: Math.round(took), layers: bd.layers.length, horizon: bd.horizon })
} else if (mode === 'all') {
  const g = sheet(...sizes.all)
  CAMS.forEach(([cam, t], i) => g.drawImage(compose(cam, t, false), wide ? 0 : i * (W * ZOOM + GAP), wide ? i * (H * ZOOM + GAP) : 0, W * ZOOM, H * ZOOM))
} else if (mode === 'layers') {
  const g = sheet(...sizes.layers)
  let y = 8
  g.font = '12px monospace'
  g.textBaseline = 'top'
  bd.layers.forEach((L, i) => {
    g.fillStyle = '#c8c8d8'
    g.fillText(i + ': ' + L.canvas.width + '×' + L.canvas.height + '  top ' + L.top.toFixed(4) + ' (row ' + Math.round(L.top * H) + ')  parallax ' + L.parallax + (L.repeatX ? '  repeatX' : '') + (L.emissive ? '  EMISSIVE' : '') + (L.drift ? '  drift ' + L.drift : '') + (L.blink ? '  blink ' + L.blink + ' s' : ''), 8, y)
    y += 18
    for (let cy = 0; cy < L.canvas.height; cy += 8) for (let cx = 0; cx < L.canvas.width; cx += 8) {
      g.fillStyle = ((cx + cy) >> 3) & 1 ? '#2a2a34' : '#22222a'
      g.fillRect(8 + cx, y + cy, Math.min(8, L.canvas.width - cx), Math.min(8, L.canvas.height - cy))
    }
    g.drawImage(L.canvas, 8, y)
    y += L.canvas.height + 12
  })
} else {
  const [cam, t] = CAMS[+q.get('cam') || 0]
  sheet(...sizes.one).drawImage(compose(cam, t, mode === 'bloom'), 0, 0, W * ZOOM, H * ZOOM)
}
if (mode !== 'sizes') document.title = 'ready'
`
const entryFile = join(out, '_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_backdrop.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)

const FLAGS = ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', '--virtual-time-budget=3000']
const colors = process.env.COLORS ? `&colors=${encodeURIComponent(process.env.COLORS)}` : ''
const looks = !lookArg || lookArg === 'all' ? ['coast', 'wild', 'void'] : lookArg.split(',')
const screens = (!screenArg || screenArg === 'all' ? '640x400,585x1266' : screenArg).split(',').map(s => s.split('x').map(Number))

for (const look of looks) {
  for (const [w, h] of screens) {
    const url = mode => `file://${html}#look=${look}&w=${w}&h=${h}&mode=${mode}${colors}`
    let info
    try {
      // The page says how big each sheet is before the window is opened at that size.
      const dom = execFileSync('chromium-browser', [...FLAGS, '--dump-dom', url('sizes')], { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'ignore'] })
      info = JSON.parse(dom.match(/<title>(.*?)<\/title>/s)[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'))
    } catch (e) {
      console.error(`failed: ${look} ${w}x${h}: ${e.message}`)
      continue
    }
    console.log(`${look} ${w}x${h}: ${info.layers} layers, horizon ${info.horizon.toFixed(3)}, built in ${info.took} ms`)
    const shots = [
      ['', 'all', info.sizes.all],
      ...CAMS.map((_, i) => [`-cam${i}`, `one&cam=${i}`, info.sizes.one]),
      ['-bloom', 'bloom', info.sizes.one],
      ['-layers', 'layers', info.sizes.layers],
    ]
    for (const [tag, mode, [sw, sh]] of shots) {
      const png = join(out, `${look}-${w}x${h}${tag}.png`)
      try {
        execFileSync('chromium-browser', [...FLAGS, `--window-size=${sw},${sh}`, `--screenshot=${png}`, url(mode)], { stdio: 'ignore', timeout: 60000 })
        console.log(png)
      } catch (e) {
        console.error(`failed: ${png}: ${e.message}`)
      }
    }
  }
}
