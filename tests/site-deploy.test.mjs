import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'phareim-deploy-test-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const repo = join(root, 'repo'), bin = join(root, 'bin'), state = join(root, 'state')
  mkdirSync(join(repo, 'scripts'), { recursive: true }); mkdirSync(bin)
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim()
  }
  git('init', '-b', 'master'); git('config', 'user.name', 'Deploy test'); git('config', 'user.email', 'deploy@example.invalid')
  writeFileSync(join(repo, 'scripts/deploy-site.sh'), readFileSync(new URL('../scripts/deploy-site.sh', import.meta.url)))
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ scripts: { test: 'mock', 'test:new-game': 'mock' } }))
  git('add', '.'); git('commit', '-m', 'fixture'); git('remote', 'add', 'origin', repo)
  const revision = git('rev-parse', 'HEAD')
  // An uncommitted file must never appear in the build worktree.
  writeFileSync(join(repo, 'uncommitted.txt'), 'work in progress')
  const mock = (name, source) => writeFileSync(join(bin, name), '#!/bin/sh\nset -eu\n' + source, { mode: 0o755 })
  mock('heavy', 'shift\nexec "$@"\n')
  mock('npm', 'test ! -f uncommitted.txt\necho "npm $*" >> "$MOCK_LOG"\nif [ "${FAIL_BUILD:-}" = yes ]; then exit 1; fi\n')
  mock('npx', 'echo "publish $*" >> "$MOCK_LOG"\ncase "$*" in *"d1 migrations"*) if [ "${FAIL_MIGRATION:-}" = yes ]; then exit 1; fi;; esac\n')
  const log = join(root, 'commands')
  const run = (extra = {}, args = ['--auto']) => spawnSync('bash', [join(repo, 'scripts/deploy-site.sh'), ...args], {
    cwd: repo, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`,
      PHAREIM_DEPLOY_ENV: join(root, 'no-env'), PHAREIM_DEPLOY_STATE_DIR: state,
      CLOUDFLARE_API_TOKEN: 'test-token', MOCK_LOG: log, ...extra },
  })
  return { run, log, state, revision, git, repo }
}

test('the test run, typecheck and build precede D1 migration and production publication', t => {
  const f = fixture(t), result = f.run()
  assert.equal(result.status, 0, result.stderr)
  const log = readFileSync(f.log, 'utf8')
  assert.equal(log.match(/npm test/g).length, 1, 'the whole test set runs once, not per suite')
  assert.ok(log.indexOf('npm test') < log.indexOf('npm run typecheck'))
  assert.ok(log.indexOf('npm run typecheck') < log.indexOf('npm run build'))
  assert.ok(log.indexOf('npm run build') < log.indexOf('d1 migrations'))
  assert.ok(log.indexOf('d1 migrations') < log.indexOf('pages deploy'))
  assert.match(log, /--branch=master/)
  assert.equal(readFileSync(join(f.state, 'site'), 'utf8').trim(), f.revision)
  assert.equal(f.run().status, 0)
  assert.equal(readFileSync(f.log, 'utf8'), log)
})

test('failed build checks cannot migrate or publish', t => {
  const f = fixture(t)
  assert.notEqual(f.run({ FAIL_BUILD: 'yes' }).status, 0)
  assert.doesNotMatch(readFileSync(f.log, 'utf8'), /publish/)
  assert.equal(existsSync(join(f.state, 'site')), false)
})

test('failed migration prevents publication and successful-version recording', t => {
  const f = fixture(t)
  assert.notEqual(f.run({ FAIL_MIGRATION: 'yes' }).status, 0)
  assert.doesNotMatch(readFileSync(f.log, 'utf8'), /pages deploy/)
  assert.equal(existsSync(join(f.state, 'site')), false)
})

test('a branch is a preview: built from its own remote ref, no migration, its own mark', t => {
  const f = fixture(t)
  // Like Sleeper's checkout: the remote tracks master only, so origin/<branch> exists only if the script fetches it by name.
  f.git('config', 'remote.origin.fetch', '+refs/heads/master:refs/remotes/origin/master')
  f.git('checkout', '-q', '-b', 'feat/beta')
  writeFileSync(join(f.repo, 'beta.txt'), 'beta')
  f.git('add', 'beta.txt'); f.git('commit', '-q', '-m', 'beta work')
  const beta = f.git('rev-parse', 'HEAD')
  f.git('checkout', '-q', 'master')
  // A local branch named like the remote one must not be built in its place.
  f.git('branch', 'origin/feat/beta', 'master')
  const result = f.run({}, ['--auto', '--branch', 'feat/beta'])
  assert.equal(result.status, 0, result.stderr)
  const log = readFileSync(f.log, 'utf8')
  assert.match(log, /npm run typecheck/)
  assert.match(log, /pages deploy .*--branch=feat\/beta/)
  assert.ok(log.includes(`--commit-hash=${beta}`), 'the preview was not built from the branch\'s own commit')
  assert.doesNotMatch(log, /d1 migrations/, 'a preview must not change the shared database')
  assert.equal(readFileSync(join(f.state, 'site-feat-beta'), 'utf8').trim(), beta)
  assert.equal(existsSync(join(f.state, 'site')), false, 'a preview must not count as a production deploy')
  // The same revision again is skipped.
  assert.equal(f.run({}, ['--auto', '--branch', 'feat/beta']).status, 0)
  assert.equal(readFileSync(f.log, 'utf8'), log)
})

test('a branch name that could leave the state directory or pass for an option is refused', t => {
  const f = fixture(t)
  for (const bad of ['../x', 'a b', '-x', '/x', 'x/', 'a;b']) {
    assert.equal(f.run({}, ['--auto', '--branch', bad]).status, 2, `accepted branch name ${JSON.stringify(bad)}`)
  }
  assert.equal(existsSync(f.log), false)
})

test('options after the commit are refused, never dropped', t => {
  const f = fixture(t)
  // `<commit> --branch beta` used to ignore the branch and publish the commit to production.
  assert.equal(f.run({}, [f.revision, '--branch', 'beta']).status, 2)
  assert.equal(f.run({}, ['--auto', f.revision, '--auto']).status, 2)
  assert.equal(f.run({}, ['--brunch', 'beta']).status, 2)
  assert.equal(existsSync(f.log), false)
  // One commit after the options is still the manual way to deploy a given revision.
  assert.equal(f.run({}, [f.revision]).status, 0)
  assert.match(readFileSync(f.log, 'utf8'), /--branch=master/)
})

/** Commit a file in the fixture and return the new log lines of the next deploy. */
function deployAfter(f, file, text, args) {
  writeFileSync(join(f.repo, file), text)
  f.git('add', file); f.git('commit', '-q', '-m', file)
  const before = existsSync(f.log) ? readFileSync(f.log, 'utf8').length : 0
  const result = f.run({}, args)
  assert.equal(result.status, 0, result.stderr)
  return readFileSync(f.log, 'utf8').slice(before)
}

test('the next deploy tests what changed since the last one; typecheck and build run whole', t => {
  const f = fixture(t)
  assert.equal(f.run().status, 0)
  const log = deployAfter(f, 'change.txt', 'a change')
  assert.match(log, new RegExp(`npm run test:changed -- --base ${f.revision}\\n`))
  assert.doesNotMatch(log, /npm test/)
  assert.ok(log.indexOf('test:changed') < log.indexOf('npm run typecheck'))
  assert.ok(log.indexOf('npm run typecheck') < log.indexOf('npm run build'))
  assert.ok(log.indexOf('npm run build') < log.indexOf('pages deploy'))
  assert.equal(readFileSync(join(f.state, 'site'), 'utf8').trim(), f.git('rev-parse', 'HEAD'))
})

test('everything is tested when the last deploy is no ancestor, or its mark is not a revision', t => {
  const f = fixture(t)
  assert.equal(f.run().status, 0)
  // A force-push: master rewritten so the deployed commit is no longer in its history.
  f.git('checkout', '-q', '--orphan', 'rewritten'); f.git('commit', '-q', '-m', 'new history')
  f.git('branch', '-f', 'master', 'rewritten'); f.git('checkout', '-q', 'master')
  let log = deployAfter(f, 'next.txt', 'on the new history')
  assert.match(log, /npm test\n/)
  assert.doesNotMatch(log, /test:changed/)
  // A mark that is not a commit name, or names a commit this repo does not have.
  for (const mark of ['--all\n', 'not a revision\n', `${'0'.repeat(40)}\n`]) {
    writeFileSync(join(f.state, 'site'), mark)
    log = deployAfter(f, 'more.txt', mark)
    assert.match(log, /npm test\n/, `mark ${JSON.stringify(mark)}`)
    assert.doesNotMatch(log, /test:changed/)
  }
})

test('a preview compares with its own last deploy, never with production\'s', t => {
  const f = fixture(t)
  assert.equal(f.run().status, 0)
  f.git('checkout', '-q', '-b', 'beta')
  const args = ['--auto', '--branch', 'beta']
  assert.match(deployAfter(f, 'beta.txt', 'beta', args), /npm test\n/, 'a first preview tests everything')
  const first = f.git('rev-parse', 'HEAD')
  assert.match(deployAfter(f, 'beta.txt', 'beta 2', args), new RegExp(`test:changed -- --base ${first}\\n`))
})
