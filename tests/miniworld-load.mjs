// Bundles Mini World's pure core and its server logic (the memory store and
// the route rules) with esbuild so plain node can test them. `~/` is the
// repo root, as in Nuxt; Nuxt's auto-imports (createError, …) are only
// referenced inside functions the tests never call.
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
        `export * from '~/themes/miniworld/types'`,
        `export * as catalog from '~/themes/miniworld/catalog'`,
        `export * from '~/themes/miniworld/core/save'`,
        `export * from '~/themes/miniworld/core/contests'`,
        `export * from '~/themes/miniworld/core/royal'`,
        `export * from '~/themes/miniworld/core/names'`,
        `export * from '~/themes/miniworld/core/outfit'`,
        `export * from '~/themes/miniworld/core/rng'`,
        `export { MemoryMwStore, D1MwStore } from '~/server/utils/miniworld'`,
        `export * as api from '~/server/utils/miniworldApi'`,
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
