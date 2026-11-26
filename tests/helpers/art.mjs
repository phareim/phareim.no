// The pinned iso art packs for the tests (themes/zelda/render/iso/artIndex.ts): each file in .art-cache/<sha256>.<ext>,
// fetched once from its pinned URL and hash-checked (scripts/zelda-lab/lib/artcache.mjs), so the art tests run offline
// once the cache is filled.
//   npm run art:pull        (node tests/helpers/art.mjs) fills the cache
// `installArtFetch()` serves the pinned URLs from the cache to the game's own loader (artPack.ts `loadPack`), as the
// browser's fetch would serve them from media.fixer.ink; `kitTable(group)` is a pack back as ThingArt records (rows,
// pal, glow, nrows, npal, deep), for the checks on palettes and silhouettes.
import { fileURLToPath } from 'node:url'
import { cachedBytes, pinnedBytes, pinnedTable, pullAll, readPins } from '../../scripts/zelda-lab/lib/artcache.mjs'

export { readPins }

let pins
const pinsNow = () => (pins ??= readPins())

/** Every pinned file of artIndex.ts by its URL. */
function byUrl() {
  const m = new Map()
  for (const p of Object.values(pinsNow().PACKS)) for (const role of ['albedo', 'normal', 'index']) if (p[role]) m.set(p[role].url, p[role])
  return m
}

/** Serve the pinned URLs from the cache (fetching a missing one once); every other URL goes to the real fetch. */
export function installArtFetch() {
  if (globalThis.__artRealFetch) return
  const real = globalThis.fetch
  globalThis.__artRealFetch = real
  const files = byUrl()
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url ?? String(input)
    const f = files.get(url)
    if (!f) return real(input, init)
    const b = cachedBytes(f) ?? await pinnedBytes(f)
    return new Response(b, { status: 200, headers: { 'content-type': url.endsWith('.json') ? 'application/json' : 'image/png' } })
  }
}

/** A pinned pack's table of ThingArt records (no `like`: each frame carries its own normals and depth). */
const tables = new Map()
export function kitTable(group) {
  if (!tables.has(group)) tables.set(group, pinnedTable(group, pinsNow()))
  return tables.get(group)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { fetched, had } = await pullAll(pinsNow())
  console.log(`art:pull: ${fetched} fetched, ${had} already in the cache, every hash checked`)
}
