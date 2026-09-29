// Bundles the site's own server routes that the sign-in gate covers (every
// file under server/api/mw/, wallet, save, profile, player, account/link)
// together with their utils, and runs them in plain node against the real D1
// SQL (node's built-in SQLite with the repo's migrations). Nitro's
// auto-imports and h3's helpers are small stand-ins on globalThis: a route
// is `export default handler`, so it can be called with a fake event.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'
import { readdirSync, statSync } from 'node:fs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

const tilde = {
  name: 'tilde',
  setup(build) {
    build.onResolve({ filter: /^~\// }, args => ({ path: require.resolve(join(repo, args.path.slice(2)) + '.ts') }))
  },
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

/** Every route file under server/api as `mw/friend.post`, no extension. */
export const routeNames = walk(join(repo, 'server/api')).map(p => relative(join(repo, 'server/api'), p).replace(/\.ts$/, '')).sort()

const utils = ['store', 'miniworld', 'miniworldApi', 'account', 'accountLinks', 'sessionCheck', 'avatar', 'norway']

/** h3's and Nitro's globals, as much of them as the routes touch. */
function installGlobals(server) {
  server.defineEventHandler = h => h
  server.createError = o => Object.assign(new Error(o.statusMessage ?? 'error'), { statusCode: o.statusCode, statusMessage: o.statusMessage, data: o.data })
  server.readBody = async e => e.body
  server.getQuery = e => e.query ?? {}
  server.getRequestHeader = (e, n) => e.headers?.[n.toLowerCase()]
  server.setResponseHeader = () => {}
  server.getRequestURL = () => new URL('https://phareim.no/')
}

export async function loadRoutes() {
  installGlobals(globalThis)
  const lines = utils.map(u => `export * as u_${u} from '~/server/utils/${u}'`)
  routeNames.forEach((n, i) => lines.push(`import r${i} from '~/server/api/${n}'; export { r${i} }`))
  lines.push(`export const names = ${JSON.stringify(routeNames)}`)
  const out = await esbuild.build({
    stdin: { contents: lines.join('\n'), resolveDir: repo, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
    plugins: [tilde],
    // Nitro's auto-imports are globals: keep the bundle from resolving them.
  })
  // Auto-imports: every export of every util, by its plain name, before a route runs.
  const code = out.outputFiles[0].text
  const mod = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64') + '\n')
  for (const u of utils) Object.assign(globalThis, mod[`u_${u}`])
  const routes = {}
  routeNames.forEach((n, i) => { routes[n] = mod[`r${i}`] })
  return { mod, routes }
}
