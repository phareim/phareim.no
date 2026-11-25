// The test areas (tests/areas.mjs) and scripts/test-affected.mjs, which the deploy uses to run only what a change
// can break: every test file is in an area, every theme has its row, and a change runs what it should.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { AREAS, PATHS, ALL, SELF, affected, ruleFor, testsOf } from './areas.mjs'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const files = readdirSync(join(repo, 'tests')).filter(f => f.endsWith('.test.mjs'))

test('every test file is in an area, and every area has test files', () => {
  const inSome = new Set(testsOf(Object.keys(AREAS), files))
  assert.deepEqual(files.filter(f => !inSome.has(f)), [])
  for (const area of Object.keys(AREAS)) assert.ok(testsOf([area], files).length > 0, `${area} has no test file`)
})

test('every path rule names areas that exist, and every theme directory has a row of its own', () => {
  for (const [pattern, run] of PATHS) {
    if (run === ALL || run === SELF) continue
    for (const a of run) assert.ok(AREAS[a], `${pattern}: no area ${a}`)
  }
  const themes = readdirSync(join(repo, 'themes'), { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
  for (const t of themes) assert.ok(ruleFor(`themes/${t}/x.ts`)?.pattern.startsWith(`themes/${t}/`), `themes/${t}/ has no row in tests/areas.mjs`)
})

test('what a change runs', () => {
  const run = paths => affected(paths, files)
  assert.deepEqual(run(['docs/site.md', 'AGENTS.md', 'themes/zelda/DESIGN.md']).tests, [], 'words run nothing')
  const zelda = run(['themes/zelda/engine/state.ts'])
  assert.equal(zelda.all, false)
  assert.ok(zelda.tests.includes('zelda-engine.test.mjs') && zelda.tests.includes('wildwood.test.mjs') && zelda.tests.includes('portal-world.test.mjs'))
  assert.ok(!zelda.tests.some(f => f.startsWith('galaga-') || f.startsWith('site-')))
  assert.deepEqual(run(['themes/galaga/engine/index.ts']).tests, testsOf(['galaga', 'radio'], files))
  for (const shared of ['themes/base/fonts.css', 'package.json', 'server/utils/account.ts', 'tests/zelda-load.mjs', 'scripts/deploy-site.sh', 'themes/index.ts']) {
    const r = run(['docs/site.md', shared])
    assert.equal(r.all, true, shared)
    assert.equal(r.tests.length, files.length)
    assert.match(r.why[0], new RegExp(`^${shared}: shared`))
  }
  const unknown = run(['themes/zelda/x.ts', 'somewhere/new.txt'])
  assert.equal(unknown.all, true)
  assert.match(unknown.why[0], /^somewhere\/new\.txt: no rule matches it/)
  assert.deepEqual(run(['tests/esc-hold.test.mjs']).tests, ['esc-hold.test.mjs'], 'a changed test file runs itself')
  assert.deepEqual(run(['tests/gone.test.mjs']).tests, [], 'a deleted one runs nothing')
})

test('the script reads the change from git: since a base, and with --worktree what is not committed', t => {
  const root = mkdtempSync(join(tmpdir(), 'phareim-affected-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const git = (...args) => { const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout }
  mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'tests')); mkdirSync(join(root, 'docs'))
  cpSync(join(repo, 'scripts/test-affected.mjs'), join(root, 'scripts/test-affected.mjs'))
  cpSync(join(repo, 'tests/areas.mjs'), join(root, 'tests/areas.mjs'))
  for (const f of ['zelda-a.test.mjs', 'portal-a.test.mjs', 'galaga-a.test.mjs', 'breakout-a.test.mjs']) {
    writeFileSync(join(root, 'tests', f), `import { test } from 'node:test'\ntest('${f}', () => {})\n`)
  }
  git('init', '-q', '-b', 'master'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid')
  git('add', '.'); git('commit', '-q', '-m', 'base')
  const list = (...args) => spawnSync(process.execPath, [join(root, 'scripts/test-affected.mjs'), '--list', ...args], { cwd: root, encoding: 'utf8' })
  writeFileSync(join(root, 'docs/notes.md'), 'words'); git('add', '.'); git('commit', '-q', '-m', 'docs')
  let r = list('--base', 'HEAD~1')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout, '')
  mkdirSync(join(root, 'themes/zelda'), { recursive: true })
  writeFileSync(join(root, 'themes/zelda/x.ts'), 'export {}'); git('add', '.'); git('commit', '-q', '-m', 'zelda')
  r = list('--base', 'HEAD~2')
  assert.equal(r.stdout, 'tests/portal-a.test.mjs\ntests/zelda-a.test.mjs\n')
  assert.match(r.stderr, /themes\/zelda\/x\.ts: zelda, portal/)
  // Not committed: left out without --worktree, counted with it.
  mkdirSync(join(root, 'themes/breakout'))
  writeFileSync(join(root, 'themes/breakout/engine.ts'), 'export {}')
  assert.equal(list('--base', 'HEAD').stdout, '')
  assert.equal(list('--base', 'HEAD', '--worktree').stdout, 'tests/breakout-a.test.mjs\n')
  assert.equal(list('--area', 'galaga').stdout, 'tests/galaga-a.test.mjs\n')
  // It runs what it lists, and an unknown base is an error, not a quiet pass.
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT // or the inner run reports to this runner instead of printing
  const ran = spawnSync(process.execPath, [join(root, 'scripts/test-affected.mjs'), '--base', 'HEAD~2'], { cwd: root, encoding: 'utf8', env })
  assert.equal(ran.status, 0, ran.stderr)
  assert.match(ran.stdout, /# pass 2/)
  assert.equal(list('--base', 'no-such-rev').status, 2)
  assert.equal(list('--area', 'no-such-area').status, 2)
})
