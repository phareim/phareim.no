#!/usr/bin/env node
// Pixel lab: bundle a TS entry that draws into document.body and screenshot
// it in headless Chromium, without Nuxt. For looking at sprite sheets.
// Snap Chromium: out must be a non-hidden path under $HOME.
//   node scripts/pixel-lab/sheet.mjs <entry.ts> <out.png> [w] [h]
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const [entry, outArg, w = '1200', h = '900'] = process.argv.slice(2)
const out = resolve(outArg)
const dir = dirname(out)
const bundle = resolve(dir, '_sheet.js')
esbuild.buildSync({ entryPoints: [resolve(entry)], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = resolve(dir, '_sheet.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#0b0616"><script src="${bundle}"></script>`)
execFileSync('chromium-browser', ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  `--window-size=${w},${h}`, '--virtual-time-budget=2000', `--screenshot=${out}`, `file://${html}`], { stdio: 'ignore', timeout: 60000 })
console.log(out)
