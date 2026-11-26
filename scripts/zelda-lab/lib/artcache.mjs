// The pinned iso art packs (themes/zelda/render/iso/artIndex.ts) on this machine: each file fetched once from its
// pinned URL into .art-cache/<sha256>.<ext> (git-ignored), its hash checked on the way in and on every read, so the
// tools and the tests run offline once the cache is filled (`npm run art:pull`).
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildSync } from 'esbuild'
import { readPack, repo, sha256, unpackTable } from './artpack.mjs'

export const CACHE = process.env.ART_CACHE ?? join(repo, '.art-cache')
export const INDEX_TS = join(repo, 'themes/zelda/render/iso/artIndex.ts')

/** artIndex.ts as data: { PACKS, ART_INDEX } (both empty before the first pin). */
export function readPins(file = INDEX_TS) {
  if (!existsSync(file)) return { PACKS: {}, ART_INDEX: {} }
  const out = buildSync({ entryPoints: [file], bundle: true, write: false, format: 'cjs', platform: 'neutral', logLevel: 'error' })
  const mod = { exports: {} }
  new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports)
  return { PACKS: mod.exports.PACKS ?? {}, ART_INDEX: mod.exports.ART_INDEX ?? {} }
}

const extOf = url => (url.match(/\.(png|json)$/)?.[1] ?? 'bin')
const pathOf = file => join(CACHE, `${file.sha256}.${extOf(file.url)}`)

/** A pinned file's bytes from the cache, or undefined when it is not there (or is not what the pin says). */
export function cachedBytes(file) {
  const p = pathOf(file)
  if (!existsSync(p)) return undefined
  const b = readFileSync(p)
  return sha256(b) === file.sha256 ? b : undefined
}

/** A pinned file's bytes: from the cache, else fetched from its URL, checked against its sha256 and cached. */
export async function pinnedBytes(file) {
  const have = cachedBytes(file)
  if (have) return have
  const res = await (globalThis.__artRealFetch ?? fetch)(file.url)
  if (!res.ok) throw new Error(`${file.url}: HTTP ${res.status}`)
  const b = Buffer.from(await res.arrayBuffer())
  const got = sha256(b)
  if (got !== file.sha256) throw new Error(`${file.url}: sha256 ${got}, pinned ${file.sha256}`)
  mkdirSync(CACHE, { recursive: true })
  const p = pathOf(file)
  const tmp = `${p}.${process.pid}.part` // (test files run in their own processes, with a cold cache at once)
  writeFileSync(tmp, b)
  renameSync(tmp, p)
  return b
}

/** Every pinned file into the cache; returns how many were fetched and how many were there. */
export async function pullAll(pins = readPins()) {
  let fetched = 0, had = 0
  for (const pin of Object.values(pins.PACKS)) {
    for (const role of ['albedo', 'normal', 'index']) {
      if (!pin[role]) continue
      if (cachedBytes(pin[role])) { had++; continue }
      await pinnedBytes(pin[role])
      fetched++
    }
  }
  return { fetched, had }
}

/** A pinned pack decoded ({ w, h, albedo, normal, pieces }), its pieces from the pinned index. */
export async function pinnedPack(group, pins = readPins()) {
  const pin = pins.PACKS[group]
  if (!pin) throw new Error(`no pinned pack ${group} in artIndex.ts`)
  const [a, n, i] = await Promise.all([pinnedBytes(pin.albedo), pinnedBytes(pin.normal), pin.index ? pinnedBytes(pin.index) : null])
  const index = i ? JSON.parse(i.toString()) : { w: pin.w, h: pin.h, pieces: piecesOf(group, pins) }
  return readPack(a, n, index)
}

/** A pack's pieces as artIndex.ts's ART_INDEX has them (no `drawn`), in its order. */
export const piecesOf = (group, pins = readPins()) =>
  Object.fromEntries(Object.entries(pins.ART_INDEX).filter(([, r]) => r.pack === group).map(([id, { pack, ...r }]) => [id, r]))

/** A pinned pack back to its table of `ThingArt` records (artpack.mjs `unpackTable`). */
export const pinnedTable = async (group, pins = readPins()) => unpackTable(await pinnedPack(group, pins))
