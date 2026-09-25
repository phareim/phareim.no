#!/usr/bin/env node
// Vendors the generative radio from phareim/radio into themes/radio/station/.
//
//   node scripts/sync-radio.mjs [path/to/radio]      (default: ../radio next to this repo)
//   node scripts/sync-radio.mjs --check [path]        exits 1 if station/ differs from what a sync would write
//
// What it copies: engine/ (with audio/ and landscapes/), scene/ (without
// shots/, tools/, assets/ and dev.*), and the listen-only UI pieces the radio
// theme uses (COMPONENTS, COMPOSABLES below). Feedback, compose and auth stay
// on radio.phareim.no. Import paths are rewritten so they resolve here:
// `~/engine/…`, `~/scene/…` and `~/composables/…` become relative paths inside
// station/, and the Nuxt auto-imports the radio app leans on (its useRadio,
// useAuto, useChannels, PxText) become explicit imports, so they never pick up
// phareim.no's own composables of the same name. Every file gets a header
// naming the radio commit. Nothing in station/ is edited by hand.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, '..')
const args = process.argv.slice(2)
const check = args.includes('--check')
const src = resolve(args.find(a => !a.startsWith('--')) ?? join(repo, '..', 'radio'))
const dest = join(repo, 'themes', 'radio', 'station')

/** The UI pieces the theme uses. StationDial and ChannelsDialog are left out (they carry compose, remove and login); the theme has its own. */
const COMPONENTS = ['SceneWindow.vue', 'IntensityBar.vue', 'PxSlider.vue', 'PxText.vue', 'LayerStrip.vue']
// useChannels keeps which channels show on the dial. Its radio-api sync runs
// only when sync() is called, which the theme never does: here the choice
// stays in the browser's localStorage.
const COMPOSABLES = ['useRadio.ts', 'useAuto.ts', 'useChannels.ts', 'storage.ts']
/** Auto-imports the vendored files may use → where they live inside station/. */
const AUTO = {
  useRadio: { from: 'composables/useRadio.ts', named: true },
  useAuto: { from: 'composables/useAuto.ts', named: true },
  useChannels: { from: 'composables/useChannels.ts', named: true },
  PxText: { from: 'components/PxText.vue', named: false },
}

if (!existsSync(join(src, 'engine', 'types.ts'))) {
  console.error(`sync-radio: no radio repo at ${src}`)
  process.exit(2)
}

const sha = execFileSync('git', ['-C', src, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
const dirty = execFileSync('git', ['-C', src, 'status', '--porcelain', '--', 'engine', 'scene', 'components', 'composables'], { encoding: 'utf8' }).trim()
const stamp = `Vendored from phareim/radio@${sha}${dirty ? '+dirty' : ''} by scripts/sync-radio.mjs — edit it there, then re-sync.`

/** Every file under `dir` (relative to src), minus what `skip` rejects. */
function walk(dir, skip) {
  const out = []
  for (const name of readdirSync(join(src, dir)).sort()) {
    const rel = join(dir, name)
    if (skip(rel, name)) continue
    if (statSync(join(src, rel)).isDirectory()) out.push(...walk(rel, skip))
    else out.push(rel)
  }
  return out
}

const sceneSkip = (rel, name) =>
  ['shots', 'tools', 'assets'].includes(name) && dirname(rel) === 'scene' || /^dev\./.test(name) && dirname(rel) === 'scene'

const files = [
  ...walk('engine', () => false),
  ...walk('scene', sceneSkip),
  ...COMPONENTS.map(f => join('components', f)),
  ...COMPOSABLES.map(f => join('composables', f)),
].filter(f => /\.(ts|vue)$/.test(f))

/** `~/engine/x.ts` from `components/A.vue` → `../engine/x.ts`. */
function rel(fromFile, target) {
  let p = relative(dirname(fromFile), target).split(sep).join('/')
  if (!p.startsWith('.')) p = './' + p
  return p
}

function rewrite(file, text) {
  let out = text.replace(/(['"])~\/(engine|scene|composables|components)\/([^'"]+)\1/g, (_, q, top, rest) => `${q}${rel(file, `${top}/${rest}`)}${q}`)
  if (file.endsWith('.vue')) out = addAutoImports(file, out)
  else if (file.startsWith('composables/')) out = addAutoImports(file, out)
  return out
}

/** Make the radio app's Nuxt auto-imports explicit, so phareim.no's own useRadio never answers. */
function addAutoImports(file, text) {
  const isVue = file.endsWith('.vue')
  const script = isVue ? /<script setup lang="ts">\n/.exec(text) : null
  if (isVue && !script) return text
  const imports = []
  for (const [name, { from, named }] of Object.entries(AUTO)) {
    if (from === file) continue
    const used = name === 'PxText' ? new RegExp(`<${name}[\\s>/]`).test(text) : new RegExp(`\\b${name}\\(`).test(text)
    const declared = new RegExp(`import[^;]*\\b${name}\\b[^;]*from`).test(text) || new RegExp(`function ${name}\\b`).test(text)
    if (!used || declared) continue
    const path = rel(file, from).replace(/\.ts$/, '')
    imports.push(named ? `import { ${name} } from '${path}'` : `import ${name} from '${path}'`)
  }
  if (!imports.length) return text
  const block = imports.join('\n') + '\n'
  if (isVue) return text.slice(0, script.index + script[0].length) + block + text.slice(script.index + script[0].length)
  // A .ts composable: after its last top-level import.
  const lines = text.split('\n')
  let last = -1
  lines.forEach((l, i) => { if (/^import .* from /.test(l)) last = i })
  lines.splice(last + 1, 0, ...imports)
  return lines.join('\n')
}

function header(file, text) {
  return file.endsWith('.vue') ? `<!-- ${stamp} -->\n${text}` : `// ${stamp}\n${text}`
}

const want = new Map(files.map(f => [f, header(f, rewrite(f, readFileSync(join(src, f), 'utf8')))]))

/** What station/ holds now. */
function current() {
  const have = new Map()
  if (!existsSync(dest)) return have
  const go = (d) => {
    for (const name of readdirSync(join(dest, d))) {
      const r = d ? join(d, name) : name
      if (statSync(join(dest, r)).isDirectory()) go(r)
      else have.set(r, readFileSync(join(dest, r), 'utf8'))
    }
  }
  go('')
  return have
}

const have = current()
// The sha line differs between syncs of the same code; compare without it.
const body = t => t.replace(/^(\/\/|<!--) Vendored from phareim\/radio@\S+/, '')
const changed = [...want].filter(([f, t]) => !have.has(f) || body(have.get(f)) !== body(t)).map(([f]) => f)
const gone = [...have.keys()].filter(f => !want.has(f))

if (check) {
  if (!changed.length && !gone.length) { console.log(`station/ matches phareim/radio@${sha}`); process.exit(0) }
  console.log(`station/ is out of date with phareim/radio@${sha}:`)
  for (const f of changed) console.log(`  changed  ${f}`)
  for (const f of gone) console.log(`  removed  ${f}`)
  process.exit(1)
}

rmSync(dest, { recursive: true, force: true })
for (const [f, t] of want) {
  mkdirSync(dirname(join(dest, f)), { recursive: true })
  writeFileSync(join(dest, f), t)
}
console.log(`vendored ${want.size} files from phareim/radio@${sha}${dirty ? ' (with uncommitted changes)' : ''} into themes/radio/station/ (${changed.length} changed, ${gone.length} removed)`)
