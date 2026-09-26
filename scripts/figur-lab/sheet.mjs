#!/usr/bin/env node
// Lag Din Figur: screenshots of the four styles. Bundles sheet-entry.ts
// (the real renderers) with esbuild into one static page, opens it in
// one headless Chromium and screenshots each section. Run under the lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/figur-lab/sheet.mjs [outDir] [sections]
//
// Sections: lineup, themes, hair, faces (= faces-<style> × 4), clothes
// (= clothes-<style> × 4), skin, drawn, sizes (default: all).
// Writes <outDir>/<section>.png (default ~/zshots/figur).
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { launch } from '../zelda-lab/cdp.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const here = dirname(fileURLToPath(import.meta.url))
const [outArg, secArg] = process.argv.slice(2)
const out = resolve(outArg || join(homedir(), 'zshots', 'figur'))
const STYLE_IDS = ['minecraft', 'roblox', 'toca', 'avatar']
const expand = s => (s === 'faces' || s === 'clothes' ? STYLE_IDS.map(id => `${s}-${id}`) : [s])
const sections = (secArg || 'lineup,themes,hair,faces,clothes,skin,drawn,sizes').split(',').flatMap(expand)
mkdirSync(out, { recursive: true })

const built = esbuild.buildSync({
  entryPoints: [join(here, 'sheet-entry.ts')],
  bundle: true, format: 'iife', write: false, platform: 'browser', logLevel: 'error', target: 'es2022',
})
const html = join(out, 'sheet.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body></body><script>${built.outputFiles[0].text}</script>`)

const b = await launch({ width: 1600, height: 900 })
let failed = false
try {
  await b.goto('file://' + html)
  for (const s of sections) {
    await b.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false })
    await b.eval(`window.__sheet(${JSON.stringify(s)})`)
    await b.sleep(150)
    const size = await b.eval('({ w: Math.max(1600, document.body.scrollWidth), h: document.body.scrollHeight + 10 })')
    await b.send('Emulation.setDeviceMetricsOverride', { width: size.w, height: Math.min(size.h, 8000), deviceScaleFactor: 1, mobile: false })
    await b.sleep(200)
    await b.shot(join(out, `${s}.png`))
    console.log(s, size)
  }
  if (b.errors.length) { failed = true; console.log('errors:\n' + b.errors.slice(0, 20).join('\n')) }
} finally {
  await b.close()
}
process.exit(failed ? 1 : 0)
