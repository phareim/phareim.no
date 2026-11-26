// The iso art packs Neon Shrine loads (themes/zelda/render/iso/artPack.ts), what each holds, and where its pieces
// were before they were packs (the TS tables the parity test reads, from the worktree or from git).
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { buildSync } from 'esbuild'
import { repo } from './artpack.mjs'

/** The realm a kit's gate arches belong to (`gate_<realm>_<road>_<off|on>`), for the kits that have one. */
export const GATE_REALM = { fogstage: 'fogstage', rerun: 'rerun', sporelight: 'sporelight', stillsand: 'stillsand', quarry: 'lumenby', seter: 'seterfell' }

/** The realm kits by their module in frontierArt/ (each a pack of the same name), in pin order. */
export const KIT_GROUPS = ['coast', 'fjord', 'fogstage', 'landing', 'meadow', 'quarry', 'rerun', 'seter', 'sporelight', 'stillsand', 'underglow']

/** Every pack, in the order artIndex.ts lists them: part 26's stalls, part 25's machines, the realm kits. */
export const GROUPS = ['stalls', 'machines', ...KIT_GROUPS]

/**
 * A kit module of frontierArt/ (what kit-bake.mjs and frontier-art.mjs bake) to the packs its pieces live in: a realm
 * kit is its own pack less the gate arches; `gates` is the six realms' arches, each in its realm's pack.
 */
export function kitParts(kit) {
  if (kit === 'gates') return Object.keys(GATE_REALM).map(g => ({ group: g, has: id => id.startsWith(`gate_${GATE_REALM[g]}_`) }))
  if (KIT_GROUPS.includes(kit)) return [{ group: kit, has: id => !id.startsWith('gate_') }]
  return null
}

/** Where a pack's pieces were as TS (until phase 3b of ART-PLAN: the files it deleted). */
export const LEGACY = {
  stalls: { file: 'themes/zelda/render/iso/stallArt.ts', name: 'STALL_ART' },
  machines: { file: 'themes/zelda/render/iso/machineArt.ts', name: 'MACHINE_ART' },
  ...Object.fromEntries(KIT_GROUPS.map(k => [k, { file: `themes/zelda/render/iso/frontierArt/${k}Data.ts`, name: `${k.toUpperCase()}_ART` }])),
  gates: { file: 'themes/zelda/render/iso/frontierArt/gatesData.ts', name: 'GATES_ART' },
}
/** The last commit with the TS tables (the packs were made from it). */
export const LEGACY_REV = 'c41be83'

/** A legacy file's text: the worktree's if it is there, else git's at LEGACY_REV; undefined when neither can say. */
export function legacySource(file) {
  const p = join(repo, file)
  if (existsSync(p)) return readFileSync(p, 'utf8')
  try {
    return execFileSync('git', ['-C', repo, 'show', `${LEGACY_REV}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })
  } catch { return undefined }
}

const loaded = new Map()
function legacyExport(key) {
  if (loaded.has(key)) return loaded.get(key)
  const { file, name } = LEGACY[key]
  const text = legacySource(file)
  let v
  if (text !== undefined) {
    const out = buildSync({ stdin: { contents: text, resolveDir: dirname(join(repo, file)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'neutral', logLevel: 'error' })
    const mod = { exports: {} }
    new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports)
    v = mod.exports[name]
  }
  loaded.set(key, v)
  return v
}

/** Is a pack's TS table still in the worktree (before the deletion)? */
export const legacyInTree = group => existsSync(join(repo, LEGACY[group].file))

/**
 * A pack's table as the TS had it, as the game put it together: a realm kit with its realm's gate arches after its
 * own pieces (frontierArt/index.ts `withGate`). Undefined when the TS is gone and git cannot show it.
 */
export function legacyTable(group) {
  const own = legacyExport(group)
  if (!own) return undefined
  const realm = GATE_REALM[group]
  if (!realm) return own
  const gates = legacyExport('gates')
  if (!gates) return undefined
  return { ...own, ...Object.fromEntries(Object.entries(gates).filter(([id]) => id.startsWith(`gate_${realm}_`))) }
}
