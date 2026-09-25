// Bundles Night of the Dead Battery's engine and content with esbuild so
// plain node can test them (no DOM: the engine and content never touch it).
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'battery')

export async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './engine/index'`,
        `export * from './types'`,
        `export { CONTENT } from './content/index'`,
        `export { F } from './content/flags'`,
        `export * from './progress'`,
      ].join('; '),
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  const code = out.outputFiles[0].text
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}
