#!/usr/bin/env node
// THE bake step of Neon Shrine's iso art (docs/games/neon-shrine.md, "The art packs"): a table of drawn pieces to a
// pack (albedo.png, normal.png, index.json; scripts/zelda-lab/lib/artpack.mjs), uploaded to the fixer art library and
// pinned in themes/zelda/render/iso/artIndex.ts, which the game loads them by (artPack.ts).
//
//   node scripts/zelda-lab/art-pack.mjs <group|all> [--from-json <table.json>] [--check] [--upload] [--out <dir>]
//   node scripts/zelda-lab/art-pack.mjs --kit <kit> --from-json <table.json> [--check] [--upload]
//   node scripts/zelda-lab/art-pack.mjs --splice <group> <id>.json [<id>.json ...] [--check] [--upload]
//   node scripts/zelda-lab/art-pack.mjs unpack <group> [<out.json>]
//   node scripts/zelda-lab/art-pack.mjs unpack --kit <kit> [<out.json>]
//
// <group> is a pack: stalls, machines, or a realm kit (coast fjord fogstage landing meadow quarry rerun seter
// sporelight stillsand underglow; a kit's pack holds its realm's gate arches too). Without --from-json the table is
// the old TS table while it is in the tree, else the pinned pack's (lib/artcache.mjs, the .art-cache).
// --kit takes a table of one frontierArt/ kit module (kit-bake.mjs, frontier-art.mjs) and puts it into its pack(s):
// `gates` goes into the six realms' packs, a realm kit's own pieces into its pack beside its arches.
// --splice replaces (or adds) the pieces named by each file (a ThingArt record, its id the file's name) in the
// pinned pack; every other piece keeps its px.
// The pack goes to <out> (tmp/art-packs/<group>/ by default). --check writes nothing and says how the pack differs
// from the pinned one. --upload POSTs the three files to https://3d.fixer.ink/api/art/files (project neon-shrine,
// asset neon-shrine-pack-<group>, FIXER_ART_KEY from the environment or ~/.config/fixer-art/env) and rewrites
// artIndex.ts with the URLs the library gives them.
// unpack writes a pinned pack (or one kit module's part of it) back to a table of ThingArt records, as JSON.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { packTable, packFiles, repo, samePixels, sha256 } from './lib/artpack.mjs'
import { INDEX_TS, pinnedPack, pinnedTable, readPins } from './lib/artcache.mjs'
import { GROUPS, KIT_GROUPS, LEGACY, kitParts, legacyInTree, legacySource, legacyTable } from './lib/artgroups.mjs'

const argv = process.argv.slice(2)
const take = (k, n = 1) => { const i = argv.indexOf(k); if (i < 0) return undefined; const v = argv.splice(i, n + 1).slice(1); return n === 1 ? v[0] : v }
const has = k => { const i = argv.indexOf(k); if (i < 0) return false; argv.splice(i, 1); return true }
const usage = 'usage: art-pack.mjs <group|all> [--from-json t.json] [--check] [--upload] [--out dir] | --kit <kit> --from-json t.json | --splice <group> <id>.json... | unpack <group>|--kit <kit> [out.json]'
const fail = msg => { console.error(msg); process.exit(2) }

const check = has('--check')
const upload = has('--upload')
const fromJson = take('--from-json')
const outDir = take('--out')
const kit = take('--kit')
const readJson = f => JSON.parse(readFileSync(resolve(f), 'utf8'))
const pins = readPins()

/** A group's table now: the old TS while it is in the tree, else the pinned pack's. */
async function currentTable(group) {
  if (legacyInTree(group)) return legacyTable(group)
  if (pins.PACKS[group]) return pinnedTable(group, pins)
  fail(`${group}: no TS table and no pinned pack`)
}

// ------------------------------------------------------------------------------------------------ unpack
if (argv[0] === 'unpack') {
  const [, a, b] = argv
  let table
  let out
  if (kit) {
    const parts = kitParts(kit) ?? fail(`--kit ${kit}: not a realm kit or gates`)
    table = {}
    for (const p of parts) for (const [id, t] of Object.entries(await currentTable(p.group))) if (p.has(id)) table[id] = t
    out = a
  } else {
    if (!GROUPS.includes(a)) fail(usage)
    table = await currentTable(a)
    out = b
  }
  const text = JSON.stringify(table)
  if (out) { writeFileSync(resolve(out), text); console.error(`${resolve(out)} (${Object.keys(table).length} pieces)`); process.exit(0) }
  // (A pipe takes its time: exit once all of it is written.)
  await new Promise(done => process.stdout.write(text + '\n', done))
  process.exit(0)
}

// ------------------------------------------------------------------------------------------------ what to pack
/** [group, table][] to pack. */
const jobs = []
if (kit) {
  const parts = kitParts(kit) ?? fail(`--kit ${kit}: not a realm kit or gates`)
  if (!fromJson) fail('--kit needs --from-json')
  const given = readJson(fromJson)
  for (const p of parts) {
    const was = await currentTable(p.group)
    const mine = Object.fromEntries(Object.entries(given).filter(([id]) => p.has(id)))
    const rest = Object.fromEntries(Object.entries(was).filter(([id]) => !p.has(id)))
    // (A realm kit's own pieces before its arches, as the game always put them together.)
    jobs.push([p.group, kit === 'gates' ? { ...rest, ...mine } : { ...mine, ...rest }])
  }
} else if (argv[0] === '--splice') {
  const [, group, ...files] = argv
  if (!GROUPS.includes(group) || !files.length) fail(usage)
  const table = { ...(await currentTable(group)) }
  for (const f of files) {
    const id = basename(f).replace(/\.json$/, '')
    const t = readJson(f)
    if (t.rows?.length !== t.h || (!t.like && t.nrows?.length !== t.h)) fail(`${f}: not a whole ThingArt record`)
    console.error(`${id in table ? 'replace' : 'add'} ${id} ${t.w}x${t.h}`)
    table[id] = t
  }
  jobs.push([group, table])
} else {
  const [g] = argv
  if (g === 'all') { if (fromJson) fail('all takes no --from-json'); for (const x of GROUPS) jobs.push([x, await currentTable(x)]) }
  else if (GROUPS.includes(g)) jobs.push([g, fromJson ? readJson(fromJson) : await currentTable(g)])
  else fail(usage)
}

// ------------------------------------------------------------------------------------------------ pack, compare, write
const gz = b => gzipSync(b, { level: 9 }).length
const kb = n => (n / 1024).toFixed(1).padStart(7) + ' KB'
const made = []
let packBytes = 0, tsGzip = 0
for (const [group, table] of jobs) {
  const pack = packTable(table)
  const files = packFiles(group, pack)
  const bytes = files.albedo.bytes.length + files.normal.bytes.length
  packBytes += bytes
  // Today's gzip of the TS chunk this pack replaces (a realm kit's share of gatesData.ts counted with `gates` below).
  const src = LEGACY[group] && legacySource(LEGACY[group].file)
  if (src) tsGzip += gz(Buffer.from(src))
  let diff = ''
  const pin = pins.PACKS[group]
  if (pin) {
    if (pin.albedo.sha256 === files.albedo.sha256 && pin.normal.sha256 === files.normal.sha256) diff = 'same as pinned'
    else {
      const before = await pinnedPack(group, pins)
      const changed = Object.keys(pack.pieces).filter(id => !before.pieces[id] || !samePixels(pack, pack.pieces[id], before, before.pieces[id]) ||
        ['ax', 'ay'].some(k => pack.pieces[id][k] !== before.pieces[id][k]) || JSON.stringify(pack.pieces[id].src ?? null) !== JSON.stringify(before.pieces[id].src ?? null))
      const gone = Object.keys(before.pieces).filter(id => !pack.pieces[id])
      diff = `differs from pinned: ${changed.length} new or changed${changed.length ? ` (${changed.slice(0, 8).join(' ')}${changed.length > 8 ? ' ...' : ''})` : ''}, ${gone.length} gone${gone.length ? ` (${gone.join(' ')})` : ''}`
    }
  } else diff = 'not pinned yet'
  console.log(`${group.padEnd(10)} ${String(Object.keys(table).length).padStart(3)} pieces ${pack.w}x${pack.h}: albedo ${kb(files.albedo.bytes.length)}, normal ${kb(files.normal.bytes.length)}${src ? `; TS gzip ${kb(gz(Buffer.from(src)))}` : ''}; ${diff}`)
  made.push({ group, pack, files })
}
if (jobs.length > 1 && jobs.some(([g]) => KIT_GROUPS.includes(g))) {
  const gates = legacySource(LEGACY.gates.file)
  if (gates) tsGzip += gz(Buffer.from(gates))
}
if (tsGzip) console.log(`packs ${kb(packBytes)} against the TS's gzip ${kb(tsGzip)}${jobs.length > 1 && jobs.some(([g]) => KIT_GROUPS.includes(g)) ? ' (gatesData.ts counted once)' : ''}: ${(packBytes / tsGzip).toFixed(2)}x`)

if (check) process.exit(0)

for (const { group, pack } of made) {
  const dir = resolve(outDir ? (jobs.length > 1 ? join(outDir, group) : outDir) : join(repo, 'tmp/art-packs', group))
  const files = packFiles(group, pack)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'albedo.png'), files.albedo.bytes)
  writeFileSync(join(dir, 'normal.png'), files.normal.bytes)
  writeFileSync(join(dir, 'index.json'), files.index.bytes)
  console.error(`wrote ${dir}`)
}
if (!upload) {
  if (made.some(m => pins.PACKS[m.group]?.albedo.sha256 !== m.files.albedo.sha256 || pins.PACKS[m.group]?.normal.sha256 !== m.files.normal.sha256)) {
    console.error('not pinned: the game still loads the pinned packs (artIndex.ts); --upload pins these')
  }
  process.exit(0)
}

// ------------------------------------------------------------------------------------------------ upload and pin
function artKey() {
  if (process.env.FIXER_ART_KEY) return { key: process.env.FIXER_ART_KEY, base: process.env.FIXER_ART_URL }
  const f = join(homedir(), '.config/fixer-art/env')
  if (!existsSync(f)) fail('--upload needs FIXER_ART_KEY (the environment or ~/.config/fixer-art/env)')
  const env = Object.fromEntries(readFileSync(f, 'utf8').split('\n').map(l => l.match(/^\s*(?:export\s+)?([A-Z_]+)=["']?(.*?)["']?\s*$/)).filter(Boolean).map(m => [m[1], m[2]]))
  if (!env.FIXER_ART_KEY) fail(`${f}: no FIXER_ART_KEY`)
  return { key: env.FIXER_ART_KEY, base: env.FIXER_ART_URL }
}
const { key, base: baseUrl } = artKey()
const api = `${(/^https:\/\//.test(baseUrl ?? '') ? baseUrl : 'https://3d.fixer.ink').replace(/\/+$/, '').replace(/\/(api|mcp)(\/.*)?$/, '')}/api/art/files`

async function post(body) {
  const res = await fetch(api, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` }, body: JSON.stringify(body) })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { error: text.slice(0, 300) } }
  if (!res.ok) throw new Error(`POST ${api} ${body.role} ${body.asset}: HTTP ${res.status} ${json.error ?? text.slice(0, 300)}`)
  return json
}
/** The URL the library gives a file, wherever in its answer it is. */
function urlOf(json) {
  const seen = []
  const walk = v => { if (typeof v === 'string' && /^https:\/\/media\.fixer\.ink\/art\//.test(v)) seen.push(v); else if (v && typeof v === 'object') Object.values(v).forEach(walk) }
  walk(json)
  return seen[0]
}

for (const { group, pack, files } of made) {
  const asset = `neon-shrine-pack-${group}`
  const pin = { w: pack.w, h: pack.h }
  for (const role of ['albedo', 'normal', 'index']) {
    const f = files[role]
    const body = {
      project: 'neon-shrine', asset, role, sha256: f.sha256, data_base64: f.bytes.toString('base64'),
      kind: 'atlas', title: `Neon Shrine iso pack: ${group}`,
      pixel: role !== 'index', params: { w: pack.w, h: pack.h, pieces: Object.keys(pack.pieces).length, ...(role !== 'index' ? { pixel: true } : {}) },
      tags: ['neon-shrine', 'iso-pack', `pack-${group}`],
    }
    let json
    try { json = await post(body) } catch (e) {
      if (role !== 'index') throw e
      console.error(`index of ${group} not uploaded (${e.message}); the pin keeps the pieces without \`drawn\``)
      continue
    }
    const url = urlOf(json)
    if (!url) throw new Error(`${group} ${role}: no media URL in the answer ${JSON.stringify(json).slice(0, 400)}`)
    const res = await fetch(url)
    const got = Buffer.from(await res.arrayBuffer())
    if (!res.ok || sha256(got) !== f.sha256) throw new Error(`${url}: HTTP ${res.status}, sha256 ${sha256(got)} (sent ${f.sha256})`)
    pin[role] = { url, sha256: f.sha256 }
    console.error(`${json.existing ? 'had' : 'uploaded'} ${url}`)
  }
  pins.PACKS[group] = pin
  for (const [id, r] of Object.entries(pins.ART_INDEX)) if (r.pack === group) delete pins.ART_INDEX[id]
  for (const [id, p] of Object.entries(pack.pieces)) {
    if (pins.ART_INDEX[id]) fail(`${id} is in both ${pins.ART_INDEX[id].pack} and ${group}`)
    pins.ART_INDEX[id] = { pack: group, x: p.x, y: p.y, w: p.w, h: p.h, ax: p.ax, ay: p.ay, ...(p.src ? { src: p.src } : {}) }
  }
}
writeIndex(pins)
console.error(`pinned in ${INDEX_TS}`)

/** artIndex.ts: the packs in GROUPS order, the pieces by pack, each pack's pieces in its table's order. */
function writeIndex({ PACKS, ART_INDEX }) {
  const j = JSON.stringify
  const order = [...GROUPS, ...Object.keys(PACKS).filter(g => !GROUPS.includes(g))].filter(g => PACKS[g])
  const file = f => `{ url: ${j(f.url)}, sha256: ${j(f.sha256)} }`
  const packs = order.map(g => {
    const p = PACKS[g]
    return `  ${j(g)}: { w: ${p.w}, h: ${p.h}, albedo: ${file(p.albedo)}, normal: ${file(p.normal)}${p.index ? `, index: ${file(p.index)}` : ''} },`
  })
  const rects = order.flatMap(g => Object.entries(ART_INDEX).filter(([, r]) => r.pack === g).map(([id, r]) =>
    `  ${j(id)}: { pack: ${j(g)}, x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h}, ax: ${r.ax}, ay: ${r.ay}${r.src ? `, src: ${j(r.src)}` : ''} },`))
  writeFileSync(INDEX_TS, `/**
 * The iso art packs, pinned (generated by scripts/zelda-lab/art-pack.mjs --upload; never edit by hand). Each pack is
 * two PNGs in the fixer art library (an albedo with each px's depth in its alpha, a normal map with its glow in its
 * alpha; scripts/zelda-lab/lib/artpack.mjs), named by their content, so a pin never changes under the game; the
 * index file (rects, anchors, \`src\` and \`drawn\`) is for the tools. \`ART_INDEX\` is every piece's place in its pack,
 * so the geometry is here before the pixels are (\`artPack.ts\` fetches and decodes those).
 */
export interface ArtFile { url: string; sha256: string }
export interface ArtPackPin { w: number; h: number; albedo: ArtFile; normal: ArtFile; index?: ArtFile }
/** A piece: its pack, its rect there, the point of ground under its middle, and the classic sprites it was drawn from. */
export interface ArtRect { pack: string; x: number; y: number; w: number; h: number; ax: number; ay: number; src?: Record<string, string> }

export const PACKS: Record<string, ArtPackPin> = {
${packs.join('\n')}
}

export const ART_INDEX: Record<string, ArtRect> = {
${rects.join('\n')}
}
`)
}
