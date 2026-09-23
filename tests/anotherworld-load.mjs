// Bundles the Another Shore engine with esbuild so plain node can test it
// (the TS modules import each other without extensions).
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'anotherworld')

export async function load(entry = `export * from './engine/index'; export * from './progress'`) {
  const out = esbuild.buildSync({
    stdin: { contents: entry, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  const code = out.outputFiles[0].text
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
}
