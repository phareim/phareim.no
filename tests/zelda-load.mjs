// Bundles the Neon Shrine engine + world with esbuild so plain node can test
// it (the TS modules import each other without extensions).
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')

export async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export * from './engine/index'; export { WORLD, INTRO } from './world/index'; export * from './types'; export { TILE_INFO } from './world/tiles'; export { validateWorld } from './world/validate'; export * from './progress'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  const code = out.outputFiles[0].text
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}
