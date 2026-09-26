// Bundles Lag Din Figur's pure core with esbuild so plain node can test
// it: the types, the catalog, textures, figures, the save, Pip and the
// Neon Shrine bridge. The renderers and the Minecraft skin export are
// tested on their own.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

const tilde = {
  name: 'tilde',
  setup(build) {
    build.onResolve({ filter: /^~\// }, args => ({ path: require.resolve(join(repo, args.path.slice(2)) + '.ts') }))
  },
}

export async function load() {
  const out = await esbuild.build({
    stdin: {
      contents: [
        `export * from '~/themes/figur/types'`,
        `export * as catalog from '~/themes/figur/catalog'`,
        `export * from '~/themes/figur/core/textures'`,
        `export { palFor, HEART, STAR } from '~/themes/figur/core/pixelart'`,
        `export { TEE_SLEEVE_ROWS, LONG_SLEEVE_ROWS, HAT_HEAD } from '~/themes/figur/core/masks'`,
        `export * from '~/themes/figur/core/figure'`,
        `export * from '~/themes/figur/core/save'`,
        `export * from '~/themes/figur/core/helper'`,
        `export * from '~/themes/figur/core/hero'`,
      ].join('; '),
      resolveDir: repo,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
    plugins: [tilde],
  })
  const code = out.outputFiles[0].text
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}
