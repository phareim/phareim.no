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
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ scripts: { 'test:new-game': 'mock', 'test:another': 'mock' } }))
  git('add', '.'); git('commit', '-m', 'fixture'); git('remote', 'add', 'origin', repo)
  const revision = git('rev-parse', 'HEAD')
  // An uncommitted file must never appear in the build worktree.
  writeFileSync(join(repo, 'uncommitted.txt'), 'work in progress')
  const mock = (name, source) => writeFileSync(join(bin, name), '#!/bin/sh\nset -eu\n' + source, { mode: 0o755 })
  mock('heavy', 'shift\nexec "$@"\n')
  mock('npm', 'test ! -f uncommitted.txt\necho "npm $*" >> "$MOCK_LOG"\nif [ "${FAIL_BUILD:-}" = yes ]; then exit 1; fi\n')
  mock('npx', 'echo "publish $*" >> "$MOCK_LOG"\ncase "$*" in *"d1 migrations"*) if [ "${FAIL_MIGRATION:-}" = yes ]; then exit 1; fi;; esac\n')
  const log = join(root, 'commands')
  const run = (extra = {}) => spawnSync('bash', [join(repo, 'scripts/deploy-site.sh'), '--auto'], {
    cwd: repo, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`,
      PHAREIM_DEPLOY_ENV: join(root, 'no-env'), PHAREIM_DEPLOY_STATE_DIR: state,
      CLOUDFLARE_API_TOKEN: 'test-token', MOCK_LOG: log, ...extra },
  })
  return { run, log, state, revision }
}

test('all discovered game tests and checks precede D1 migration and production publication', t => {
  const f = fixture(t), result = f.run()
  assert.equal(result.status, 0, result.stderr)
  const log = readFileSync(f.log, 'utf8')
  assert.match(log, /npm run test:new-game/)
  assert.match(log, /npm run test:another/)
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
