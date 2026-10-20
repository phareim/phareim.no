// Neon Shrine's sprites as data for the studio (studio.phareim.no, repo phareim/studio-web).
//
// Runs before `nuxt build` and writes public/studio/neon-shrine.json: the palette and every
// sprite in the registry as rows of palette letters, exactly as the game draws them when no
// override is live. The studio reads this file from the live site, so what it edits against is
// always what is deployed. Generated, gitignored; `node scripts/export-sprites.mjs` by hand.
import { mkdirSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const out = esbuild.buildSync({
  stdin: { contents: `export { SPRITES, PAL } from './render/sprites'`, resolveDir: resolve(root, 'themes/zelda'), loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const { SPRITES, PAL } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

let sourceRev = 'unknown'
try { sourceRev = execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch {}

const pack = {
  format: 1,
  pack: 'neon-shrine',
  sourceRev,
  builtAt: new Date().toISOString(),
  transparent: '.',
  palette: PAL,
  sprites: Object.fromEntries(Object.entries(SPRITES).map(([name, def]) => [name, def.rows])),
}

const file = resolve(root, 'public/studio/neon-shrine.json')
mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, JSON.stringify(pack))
console.log(`studio: ${Object.keys(pack.sprites).length} sprites → public/studio/neon-shrine.json`)
