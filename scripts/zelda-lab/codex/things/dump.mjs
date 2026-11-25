// Dump the pilot sprites' rows as the game shows them with the live pack applied, as JSON + RGBA.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// dump.mjs <live-pack.json> <family,family,...> <out.json>
const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = fileURLToPath(new URL('../../../../themes/zelda', import.meta.url))
const out = esbuild.buildSync({ stdin: { contents: `export { SPRITES, PAL } from './render/sprites'`, resolveDir: root, loader: 'ts' }, bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error' })
const M = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const live = JSON.parse(readFileSync(process.argv[2], 'utf8')).sprites
const FAM = process.argv[3].split(',')
const res = {}
const same = (a, b) => a.length === b.length && b.every(r => r.length === a[0].length)
for (const name of Object.keys(M.SPRITES).concat(Object.keys(live))) {
  const fam = FAM.find(f => name === f || name.startsWith(f + '_'))
  if (!fam || res[name]) continue
  let rows = M.SPRITES[name]?.rows
  const lv = live[name]
  if (lv) {
    const m = /^(.*)_(\d+)$/.exec(name)
    const base = rows ?? (m ? M.SPRITES[m[1] + '_0']?.rows : null)
    if (base && same(base, lv)) rows = lv
  }
  if (rows) res[name] = { rows, live: !!(lv && rows === lv) }
}
writeFileSync(process.argv[4], JSON.stringify({ pal: M.PAL, sprites: res }, null, 1))
for (const [n, v] of Object.entries(res)) console.log(n, v.rows[0].length + 'x' + v.rows.length, v.live ? 'LIVE' : '')
