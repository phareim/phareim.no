#!/usr/bin/env node
// Neon Shrine's turn switch (themes/zelda/render/turnSwitch.ts), every state on one sheet: at rest in both
// views, through the turn, on touch, hovered, pressed, waiting, refused, on a coarse screen, with three and
// eight views. Each cell is the switch at 4 screen px to its fine px over bands of the world's colours; the
// yellow box in the first cell is what the button covers. Under them, the switch at true size for a phone
// (one CSS px to the fine px) and a laptop (two). Snap Chromium: outDir must be a non-hidden path under $HOME.
//
//   node scripts/zelda-lab/turn-sheet.mjs <outDir>
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg] = process.argv.slice(2)
if (!outArg) { console.error('usage: turn-sheet.mjs <outDir>'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })

const entry = `
import { NEON_SKIN, WINDOW_SKIN, HIRES_WINDOW_SKIN, GLASS_SKIN } from ${JSON.stringify(join(repo, 'themes/zelda/render/hud.ts'))}
import { ease } from ${JSON.stringify(join(repo, 'themes/zelda/render/iso/project.ts'))}
import { drawTurnSwitch, switchLayout, SW_W, SW_H, type SwitchState } from ${JSON.stringify(join(repo, 'themes/zelda/render/turnSwitch.ts'))}

const Z = 4
const two = [{ label: '8', skin: NEON_SKIN }, { label: '16', skin: HIRES_WINDOW_SKIN }]
const base: SwitchState = { stops: two, a: 0, b: 1, e: 1, key: 'V', waiting: false, hover: false, down: false, nudge: 0, flash: -1, caption: '', captionLit: 0, time: 0, reduced: false }
const at = (k: number, more: Partial<SwitchState> = {}): SwitchState => ({ ...base, e: ease(k), ...more })
const many = (n: number, i: number): SwitchState => ({ ...base, stops: Array.from({ length: n }, (_, j) => ({ label: '', skin: j ? HIRES_WINDOW_SKIN : NEON_SKIN })), a: 0, b: i, e: 1, caption: 'NOIR ' + (i + 1) + '/' + n, captionLit: 3 })
/** The built-in round: classic, isometric, polygon, each stop in its view's own dress. */
const round3 = (i: number, caption: string): SwitchState => ({ ...base, stops: [{ label: '', skin: NEON_SKIN }, { label: '', skin: HIRES_WINDOW_SKIN }, { label: '', skin: GLASS_SKIN }], a: 0, b: i, e: 1, caption, captionLit: caption ? 3 : 0 })
const cells: Array<[string, SwitchState]> = [
  ['at rest, 16-bit, beside a keyboard', at(1)],
  ['a first visit: the tick, the name', at(1, { caption: 'ISOMETRIC', captionLit: 3, nudge: -3, flash: 0 })],
  ['k = 0.75', at(0.75)],
  ['k = 0.5', at(0.5)],
  ['k = 0.25', at(0.25)],
  ['at rest, 8-bit, just arrived', at(0, { caption: 'CLASSIC', captionLit: 3 })],
  ['touch, 16-bit', at(1, { key: null })],
  ['touch, 8-bit', at(0, { key: null })],
  ['hover (a mouse), 16-bit', at(1, { hover: true })],
  ['pressed, 8-bit', at(0, { down: true })],
  ['waiting for the 16-bit view', at(0, { waiting: true, time: 0.4 })],
  ['refused: the view did not arrive', at(0, { nudge: 2, caption: 'NO SIGNAL', captionLit: 3, captionHot: true })],
  ['a coarse screen, k = 1', at(1, { stops: [{ label: '8', skin: NEON_SKIN }, { label: '16', skin: WINDOW_SKIN }] })],
  ['reduced motion, waiting', at(0, { waiting: true, reduced: true })],
  ['3 views, at the second', many(3, 1)],
  ['the round: classic', round3(0, 'CLASSIC 1/3')],
  ['the round: isometric', round3(1, 'ISOMETRIC 2/3')],
  ['the round: polygon', round3(2, 'POLYGON 3/3')],
  ['the round: polygon, half way in', { ...round3(2, ''), a: 1, e: 0.5 }],
  ['8 views, at the fifth', many(8, 4)],
]
document.body.style.cssText = 'margin:0;background:#0b0616'
const cols = 2
const cw = SW_W * 2 * Z + 24
const ch = SW_H * 2 * Z + 40
const sheet = document.createElement('canvas')
sheet.width = cols * cw
sheet.height = Math.ceil(cells.length / cols) * ch + 200
document.body.appendChild(sheet)
const sg = sheet.getContext('2d')!
sg.imageSmoothingEnabled = false
const bands = ['#2a1454', '#7a5ab0', '#c86aa8', '#3c7a86', '#e8589a', '#1d1433']
const scratch: [HTMLCanvasElement, HTMLCanvasElement] = [document.createElement('canvas'), document.createElement('canvas')]
const small = document.createElement('canvas')
small.width = SW_W * 2
small.height = SW_H * 2
const paint = (st: SwitchState) => {
  const g = small.getContext('2d')!
  g.setTransform(1, 0, 0, 1, 0, 0)
  g.clearRect(0, 0, small.width, small.height)
  drawTurnSwitch(g, st, scratch)
}
cells.forEach(([name, st], i) => {
  const x = (i % cols) * cw
  const y = Math.floor(i / cols) * ch
  const bw = Math.ceil((cw - 8) / bands.length)
  bands.forEach((c, j) => { sg.fillStyle = c; sg.fillRect(x + 4 + j * bw, y + 30, Math.min(bw, cw - 8 - j * bw), ch - 36) })
  sg.fillStyle = '#fff'
  sg.font = '14px monospace'
  sg.fillText(name, x + 6, y + 20)
  paint(st)
  sg.drawImage(small, x + 12, y + 34, small.width * Z, small.height * Z)
  if (i === 0) { const b = switchLayout(st).box; sg.strokeStyle = 'rgba(255,255,0,0.5)'; sg.strokeRect(x + 12 + b.x * 2 * Z + 0.5, y + 34 + b.y * 2 * Z + 0.5, b.w * 2 * Z, b.h * 2 * Z) }
})
const y0 = Math.ceil(cells.length / cols) * ch
bands.forEach((c, j) => { sg.fillStyle = c; sg.fillRect(j * (sheet.width / bands.length), y0, sheet.width / bands.length, 200) })
;[1, 0.5, 0].forEach((k, i) => {
  paint(at(k))
  sg.drawImage(small, 10 + i * 190, y0 + 8)
  sg.drawImage(small, 10 + i * 380, y0 + 76, small.width * 2, small.height * 2)
})
document.title = 'done'
`
const entryFile = join(out, '_turn-entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_turn-bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_turn.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)
const png = join(out, 'turn-switch.png')
execFileSync(process.env.CHROME_BIN || 'chromium-browser', ['--headless=new', '--no-sandbox', ...(process.env.CHROME_BIN ? [] : ['--disable-gpu']), '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1460,2500', '--virtual-time-budget=3000', `--screenshot=${png}`, 'file://' + html], { stdio: 'pipe' })
console.log(png)
