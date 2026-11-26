#!/usr/bin/env node
// Bake Codex-drawn pieces into a realm kit's art pack.
//   node scripts/zelda-lab/codex/kit-bake.mjs <kit> [--build <dir>] [--only <id,...>] [--drop <id,...>] [--check] [--no-upload]
// <kit> names the module in themes/zelda/render/iso/frontierArt/ (seter, meadow, fjord, gates, ...). Its pieces live in
// an art pack (scripts/zelda-lab/art-pack.mjs, docs/games/neon-shrine.md "The art packs"): a realm kit in the pack of
// its name, `gates` (the six realms' arches) each in its realm's pack. The bake reads the kit's table back from the
// pinned pack (`art-pack.mjs unpack --kit`), puts the drawn pieces in, and hands the table to `art-pack.mjs --kit`,
// which packs, uploads and pins it in artIndex.ts (--no-upload: the pack goes to tmp/art-packs/ only, not pinned).
// `roadside` (always loaded, still TS until ART-PLAN 3c) keeps its frontierArt/roadsideData.ts.
// Every record in <build> (kitbuild.py's <id>.json, default tmp/codex-kits/<kit>/build) whose id the kit has replaces
// that id's record; every other id keeps the record it has. A drawn record must have its id's box (w, h, ax, ay) as
// the kit's solids give it, and a night/day or off/on pair must keep one box: the bake refuses otherwise.
// --only bakes just those ids from <build>; --drop puts those ids back to their solids (held back); --check writes nothing
// (and says how the pack would differ from the pinned one).
// A drawn record carries `drawn` (where it came from), so frontier-art.mjs keeps it when it re-bakes the solids.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { kitParts } from '../lib/artgroups.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '../../..')
const args = process.argv.slice(2)
const kit = args[0]
if (!kit || !/^[a-z]+$/.test(kit)) throw new Error('usage: kit-bake.mjs <kit> [--build <dir>] [--only <id,...>] [--drop <id,...>] [--check]')
const opt = k => { const i = args.indexOf(k); return i > 0 ? args[i + 1] : undefined }
const build = resolve(opt('--build') ?? resolve(repo, 'tmp/codex-kits', kit, 'build'))
const only = opt('--only')?.split(',')
const drop = opt('--drop')?.split(',') ?? []
const check = args.includes('--check')
const noUpload = args.includes('--no-upload')
const parts = kitParts(kit)
const file = parts ? undefined : resolve(repo, 'themes/zelda/render/iso/frontierArt', `${kit}Data.ts`)
const name = `${kit.toUpperCase()}_ART`
const artPack = resolve(repo, 'scripts/zelda-lab/art-pack.mjs')
const work = resolve(repo, 'tmp/codex-kits', kit)
mkdirSync(work, { recursive: true })

// The kit's table as the game has it now: from its pinned pack(s), or (roadside) its data file.
let table
if (parts) {
  const was = resolve(work, 'pinned.json')
  execFileSync(process.execPath, [artPack, 'unpack', '--kit', kit, was], { stdio: 'inherit' })
  table = JSON.parse(readFileSync(was, 'utf8'))
} else {
  const m = readFileSync(file, 'utf8').match(/unpackArt<[^>]*>>\("([^"]+)"\)/)
  if (!m) throw new Error(`${file}: no packed table`)
  table = JSON.parse(gunzipSync(Buffer.from(m[1], 'base64')).toString())
}

// The solids' own records (frontier-art.mjs's bake, written to a scratch file): the boxes a drawing must keep, and
// what a held-back piece goes back to.
const scratch = resolve(repo, 'tmp/codex-kits', kit, 'solids.json')
execFileSync(process.execPath, [resolve(repo, 'scripts/zelda-lab/frontier-art.mjs'), kit, '--json', scratch], { stdio: 'inherit' })
const solids = JSON.parse(readFileSync(scratch, 'utf8'))
// (`gates` builds the coast's waymarks and barriers too; those are the coast kit's.)
if (parts) for (const id of Object.keys(solids)) if (!parts.some(p => p.has(id))) delete solids[id]
const box = t => [t.w, t.h, t.ax, t.ay].join(',')

const drawn = existsSync(build) ? readdirSync(build).filter(f => /^[\w]+\.json$/.test(f) && !f.endsWith('.fit.json')).map(f => f.slice(0, -5)) : []
let changed = 0
for (const id of drawn) {
  if (!(id in table)) { console.log(`skip ${id}: not in ${kit}`); continue }
  if (only && !only.includes(id)) continue
  if (drop.includes(id)) continue
  const t = JSON.parse(readFileSync(resolve(build, `${id}.json`), 'utf8'))
  if (box(t) !== box(solids[id])) throw new Error(`${id}: drawn box ${box(t)} is not the kit's ${box(solids[id])}`)
  const rec = { w: t.w, h: t.h, ax: t.ax, ay: t.ay, pal: t.pal, glow: t.glow, rows: t.rows, nrows: t.nrows, npal: t.npal, deep: t.deep, drawn: t.drawn }
  if (rec.rows.length !== t.h || rec.nrows.length !== t.h || Buffer.from(rec.deep, 'base64').length !== t.w * t.h) throw new Error(`${id}: malformed`)
  table[id] = rec
  changed++
  console.log(`drawn ${id} ${t.w}x${t.h} (${t.drawn})`)
}
for (const id of drop) {
  if (!solids[id]) throw new Error(`--drop ${id}: no such piece`)
  table[id] = solids[id]
  console.log(`held back ${id}: its solids`)
}
// The pairs that must share a box: day and night, off and on, a thing's frames as the kit's solids pair them.
for (const id of Object.keys(table)) {
  if (box(table[id]) !== box(solids[id])) throw new Error(`${id}: box ${box(table[id])} is not the solids' ${box(solids[id])}`)
}
if ([...Object.keys(table)].sort().join() !== [...Object.keys(solids)].sort().join()) throw new Error('the ids are not the kit\'s')
const count = Object.values(table).filter(t => t.drawn).length
if (parts) {
  // (In the solids' order, as the game has always put a kit together.)
  const ordered = Object.fromEntries(Object.keys(solids).map(id => [id, table[id]]))
  const out = resolve(work, 'table.json')
  writeFileSync(out, JSON.stringify(ordered))
  execFileSync(process.execPath, [artPack, '--kit', kit, '--from-json', out, ...(check ? ['--check'] : noUpload ? [] : ['--upload'])], { stdio: 'inherit' })
  console.log(`${check ? 'checked' : noUpload ? 'packed (not pinned)' : 'baked and pinned'} ${kit}: ${changed} drawn now, ${count} drawn in all, ${Object.keys(table).length} pieces`)
  process.exit(0)
}
const packed = gzipSync(JSON.stringify(table)).toString('base64')
if (!check) {
  writeFileSync(file, `// Generated by scripts/zelda-lab/frontier-art.mjs from ${kit}.ts; ${count} of its ${Object.keys(table).length} pieces drawn by Codex over those solids (\`drawn\`, scripts/zelda-lab/codex/kit-bake.mjs).
import type { ThingArt } from '../thingArt'
import { unpackArt } from './packed'

export const ${name} = unpackArt<Record<string, ThingArt>>(${JSON.stringify(packed)})
`)
}
console.log(`${check ? 'checked' : 'wrote'} ${file}: ${changed} drawn now, ${count} drawn in all, ${Object.keys(table).length} pieces, ${(packed.length / 1024).toFixed(0)} KB packed`)
