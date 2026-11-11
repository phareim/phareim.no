// Neon Shrine's sprites and views as data for the studio (studio.phareim.no, repo phareim/studio-web).
//
// Runs before `nuxt build` and writes public/studio/neon-shrine.json: the palette and every
// sprite in the registry as rows of palette letters, exactly as the game draws them when no
// override is live; and `views`: the drawing engines with everything that can be turned on
// each (themes/zelda/viewParams.ts), the built-in views, and the places the view stage shows. The studio reads this file from the live site, so what it edits against is
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
  stdin: {
    contents: [
      `export { SPRITES, PAL } from './render/sprites'`,
      `export { ENGINES } from './viewParams'`,
      `export { VIEWS, MAX_VIEWS } from './views'`,
      `export { STAGE_SCENES } from '../stage/scenes'`,
    ].join('; '),
    resolveDir: resolve(root, 'themes/zelda'), loader: 'ts',
  },
  // The views' own code draws on a canvas: only the registry is read here.
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error', external: ['./render/iso/view', './render/blyant/view'],
})
const { SPRITES, PAL, ENGINES, VIEWS, MAX_VIEWS, STAGE_SCENES } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

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
  views: {
    engines: ENGINES,
    builtin: VIEWS.map(v => ({ id: v.id, name: v.name, tag: v.tag, engine: v.engine })),
    max: MAX_VIEWS,
    scenes: STAGE_SCENES.map(s => ({ id: s.id, label: s.label, group: s.group })),
  },
}

const file = resolve(root, 'public/studio/neon-shrine.json')
mkdirSync(dirname(file), { recursive: true })
writeFileSync(file, JSON.stringify(pack))
console.log(`studio: ${Object.keys(pack.sprites).length} sprites, ${Object.keys(pack.views.engines).length} view engines → public/studio/neon-shrine.json`)
