#!/usr/bin/env node
// Mini World: the avatar/house sheet. Bundles sheet-entry.ts (the real
// scene modules) with esbuild into one static page, opens it in one
// headless Chromium and screenshots each section. Run under the lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/miniworld-lab/avatar-sheet.mjs [outDir] [sections]
//
// Sections: people, clothes, backs, furniture, weapons, house, lineup
// (default: all). Writes <outDir>/<section>.png (default ~/zshots/miniworld).
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
const out = resolve(outArg || join(homedir(), 'zshots', 'miniworld'))
const sections = (secArg || 'people,clothes,backs,furniture,weapons,house,lineup').split(',')
mkdirSync(out, { recursive: true })

const built = esbuild.buildSync({
  entryPoints: [join(here, 'sheet-entry.ts')],
  bundle: true, format: 'iife', write: false, platform: 'browser', logLevel: 'error', target: 'es2022',
})
const html = join(out, 'sheet.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body></body><script>${built.outputFiles[0].text}</script>`)

const b = await launch({ width: 1400, height: 900 })
let failed = false
try {
  for (const s of sections) {
    await b.goto('file://' + html)
    await b.eval(`window.__sheet(${JSON.stringify(s)})`)
    await b.sleep(400)
    const size = await b.eval('({ w: Math.max(1400, document.body.scrollWidth), h: document.body.scrollHeight + 10 })')
    await b.send('Emulation.setDeviceMetricsOverride', { width: size.w, height: Math.min(size.h, 8000), deviceScaleFactor: 1, mobile: false })
    await b.sleep(300)
    await b.shot(join(out, `${s}.png`))
    const extra = await b.eval('JSON.stringify({ e: window.__edit, e2: window.__edit2 })')
    console.log(s, size, extra)
  }
  if (b.errors.length) { failed = true; console.log('errors:\n' + b.errors.slice(0, 20).join('\n')) }
} finally {
  await b.close()
}
process.exit(failed ? 1 : 0)
