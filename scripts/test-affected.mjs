#!/usr/bin/env node
// Runs the tests a change can break, by the table in tests/areas.mjs.
//
//   node scripts/test-affected.mjs [--base <rev>] [--worktree] [--list] [-- <node --test options>]
//   node scripts/test-affected.mjs --area <name> [--area <name> …] [--list]
//   node scripts/test-affected.mjs --all
//
// The change is `git diff <base>...HEAD` (base origin/master by default), plus with --worktree what is not committed
// yet (staged, unstaged and untracked files). Markdown runs nothing, a shared file runs everything, a changed test
// file runs itself, a theme runs its area and the areas that import it, and a path the table does not know runs
// everything. --list prints the test files instead of running them; why each path runs what it does goes to stderr.
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AREAS, affected, testsOf } from '../tests/areas.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const usage = 'usage: test-affected.mjs [--base <rev>] [--worktree] [--list] [--area <name>]... [--all] [-- <node --test options>]'
const fail = msg => { console.error(msg); process.exit(2) }

let base = 'origin/master'
let worktree = false
let list = false
let all = false
const areas = []
const pass = []
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--') { pass.push(...argv.slice(i + 1)); break }
  if (a === '--base') { base = argv[++i] ?? fail('--base needs a revision'); if (base.startsWith('-')) fail(`bad revision: ${base}`) }
  else if (a === '--worktree') worktree = true
  else if (a === '--list') list = true
  else if (a === '--all') all = true
  else if (a === '--area') { const name = argv[++i]; if (!AREAS[name]) fail(`no test area ${name}; the areas: ${Object.keys(AREAS).join(', ')}`); areas.push(name) }
  else fail(`${usage}\nunknown argument: ${a}`)
}

const files = readdirSync(join(repo, 'tests')).filter(f => f.endsWith('.test.mjs')).sort()

function git(...args) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
  if (r.status !== 0) fail(`git ${args.join(' ')} failed:\n${r.stderr.trim()}`)
  return r.stdout.split('\n').filter(Boolean)
}

let tests
if (all) tests = files
else if (areas.length) tests = testsOf(areas, files)
else {
  git('rev-parse', '--verify', '--quiet', `${base}^{commit}`)
  const changed = new Set(git('diff', '--name-only', '--no-renames', `${base}...HEAD`, '--'))
  if (worktree) {
    for (const p of git('diff', '--name-only', '--no-renames', 'HEAD', '--')) changed.add(p)
    for (const p of git('ls-files', '--others', '--exclude-standard')) changed.add(p)
  }
  const r = affected([...changed].sort(), files)
  console.error(`${changed.size} changed file${changed.size === 1 ? '' : 's'} since ${base}${worktree ? ' (with the worktree)' : ''}`)
  for (const line of r.why) console.error(`  ${line}`)
  tests = r.tests
}

if (list) {
  for (const t of tests) console.log(`tests/${t}`)
  process.exit(0)
}
if (!tests.length) {
  console.error('no tests to run')
  process.exit(0)
}
console.error(`running ${tests.length === files.length ? 'every test file' : `${tests.length} of ${files.length} test files`}`)
// `npm run test:changed` skips the pretest hook, so fill the art cache once here, before the test processes start
// (a cold cache would make each of them fetch the packs, at the same time).
if (existsSync(join(repo, 'tests/helpers/art.mjs'))) {
  const pull = spawnSync(process.execPath, ['tests/helpers/art.mjs'], { cwd: repo, stdio: 'inherit' })
  if (pull.status !== 0) process.exit(pull.status ?? 1)
}
const run = spawnSync(process.execPath, ['--test', ...pass, ...tests.map(t => `tests/${t}`)], { cwd: repo, stdio: 'inherit' })
process.exit(run.status ?? 1)
