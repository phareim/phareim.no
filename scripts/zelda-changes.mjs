// Neon Shrine's version number and change list, read from git at build time and written as a module the game
// imports (themes/zelda/changes.gen.ts: generated, not in git). nuxt.config.ts calls it, so `npm ci` (through
// `nuxt prepare`), `npm run dev`, `typecheck` and `build` all write it; `node scripts/zelda-changes.mjs` by hand.
// docs/site.md → "Build-time values".
//
// A change of the game is a commit reachable from HEAD whose subject begins exactly `Neon Shrine: `. The version is
// how many there are; the list holds the newest 40, by day. Where there is no git, or a shallow history cuts into
// the game's, the version is 0 and the list empty. Nothing here throws.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const OUT = 'themes/zelda/changes.gen.ts'
export const PREFIX = 'Neon Shrine: '
export const NEWEST = 40
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** What the pixel face draws (the lands' words rule, tests/zelda-world.test.mjs), and the nearest of it for the rest. */
const DRAWN = /^[A-Z0-9ÆØÅ .,!?'":;\-()/#%&+=*·↑↓←→]$/
const NEAREST = {
  '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-', '―': '-', '−': '-', _: '-', '~': '-',
  '’': "'", '‘': "'", '‚': "'", '′': "'", '`': "'", '´': "'",
  '“': '"', '”': '"', '„': '"', '″': '"', '«': '"', '»': '"',
  '…': '...', '•': '·', '∙': '·', '×': 'X', '♥': '*', '|': '/', '\\': '/',
  '[': '(', ']': ')', '{': '(', '}': ')', '<': '←', '>': '→', '@': ' AT ', $: 'S',
  Ä: 'Æ', Ö: 'Ø', ẞ: 'SS',
}

/** A line in capitals, every character of it one the pixel face draws. */
export function pixelText(text) {
  let out = ''
  for (const ch of text.normalize('NFC').toUpperCase()) {
    if (DRAWN.test(ch)) out += ch
    else if (NEAREST[ch] !== undefined) out += NEAREST[ch]
    else if (/\s/.test(ch)) out += ' '
    // An accented letter is the letter without it; anything else with nothing near it is left out.
    else out += [...ch.normalize('NFKD')].filter(c => DRAWN.test(c)).join('')
  }
  return out.replace(/ {2,}/g, ' ').trim()
}

const NONE = () => ({ version: 0, date: '', hash: '', changes: [] })

/** `2026-11-27` as `27 NOV 2026`. */
function day(iso) {
  const [y, m, d] = iso.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

/**
 * A shallow history whose cut falls inside the game's: some commit it ends at already holds the game, so changes may
 * lie behind it. A cut from before the game was there hides none of them, and the count is whole.
 */
function cutsTheGame(git, dir) {
  if (git('rev-parse', '--is-shallow-repository').trim() !== 'true') return false
  const file = resolve(dir, git('rev-parse', '--git-path', 'shallow').trim())
  const cuts = new Set(readFileSync(file, 'utf8').split('\n').filter(Boolean))
  return [...cuts].some(commit => {
    try { git('merge-base', '--is-ancestor', commit, 'HEAD') } catch (e) { if (e.status === 1) return false; throw e }
    return git('ls-tree', '--name-only', commit, '--', 'themes/zelda').trim() !== ''
  })
}

/** The version and the change list of the checkout at `dir`. */
export function readChanges(dir = REPO) {
  try {
    const env = { ...process.env }
    for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR']) delete env[k]
    const git = (...args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], env, maxBuffer: 64 * 1024 * 1024 })
    // A checkout of its own: a tarball unpacked inside another repository must not count that one's commits.
    if (realpathSync(git('rev-parse', '--show-toplevel').trim()) !== realpathSync(dir)) return NONE()
    if (cutsTheGame(git, dir)) return NONE()
    const found = git('log', '--no-show-signature', `--grep=^${PREFIX}`, '--format=%ct%x09%h%x09%cs%x09%s', 'HEAD')
      .split('\n')
      .map(row => { const [time, hash, date, ...subject] = row.split('\t'); return { time: Number(time), hash, date, subject: subject.join('\t') } })
      .filter(c => c.subject?.startsWith(PREFIX))
      .sort((a, b) => b.time - a.time)
    if (!found.length) return NONE()
    const days = new Map()
    for (const c of found.slice(0, NEWEST)) {
      const date = day(c.date)
      if (!days.has(date)) days.set(date, [])
      days.get(date).push(pixelText(c.subject.slice(PREFIX.length)))
    }
    return {
      version: found.length,
      date: day(found[0].date),
      hash: found[0].hash,
      changes: [...days].map(([date, lines]) => ({ date, lines })),
    }
  } catch { return NONE() }
}

/** The module's source. */
export function moduleSource(log) {
  return [
    '// Generated from git by scripts/zelda-changes.mjs (nuxt.config.ts runs it). Not in git; do not edit.',
    "import type { ChangeLog } from './render/logPage'",
    '',
    `export const CHANGE_LOG: ChangeLog = ${JSON.stringify(log, null, 1)}`,
    '',
  ].join('\n')
}

/** Reads `dir`'s history and writes the module under it, only when it says something new (a dev server watches it). */
export function writeChanges(dir = REPO) {
  const log = readChanges(dir)
  try {
    const out = join(dir, OUT)
    const source = moduleSource(log)
    let old = null
    try { old = readFileSync(out, 'utf8') } catch { /* the first time */ }
    if (old !== source) {
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, source)
    }
  } catch (e) {
    console.warn(`zelda-changes: ${OUT} was not written (${e.message})`)
  }
  return log
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const log = writeChanges()
  console.log(`zelda-changes: V ${log.version} ${log.date} ${log.hash} → ${OUT}`)
}
