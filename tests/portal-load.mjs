// Bundles the portal world with the Neon Shrine engine (esbuild) so plain
// node can test it, like zelda-load.mjs.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes')

export async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './zelda/engine/index'`,
        `export * from './zelda/types'`,
        `export { validateWorld } from './zelda/world/validate'`,
        `export { TILE_INFO } from './zelda/world/tiles'`,
        `export { textWidth } from './zelda/render/font'`,
        `export { PORTAL_WORLD, portalExits, worldStartingAt } from './portal/world/index'`,
      ].join('; '),
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  const code = out.outputFiles[0].text
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}
