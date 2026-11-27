// The test areas and what a change touches: the one table that `npm run test:<area>`, `npm run test:changed` and the
// deploy (scripts/test-affected.mjs) read. `npm test` runs every tests/*.test.mjs whatever this says.
//
// AREAS: an area's test files, as names in tests/ where `*` stands for any run of characters.
// PATHS: what a changed file runs, the first pattern that matches it winning. A pattern ending in `/` is a directory
// and all below it; otherwise `*` matches within one path segment and `**/` any number of directories. The value is a
// list of areas, ALL (every test file), SELF (the changed test file itself) or [] (nothing). A changed file no pattern
// matches runs everything.

export const ALL = 'all'
export const SELF = 'self'

export const AREAS = {
  portal: ['portal-*.test.mjs'],
  zelda: ['zelda-*.test.mjs', 'wildwood.test.mjs'],
  eschold: ['esc-hold.test.mjs'],
  tetris: ['tetris-*.test.mjs'],
  leaderboard: ['leaderboard-*.test.mjs'],
  starfox: ['starfox-*.test.mjs'],
  wingman: ['starfox-wingman.test.mjs'],
  anotherworld: ['anotherworld-*.test.mjs'],
  shore: ['shore-*.test.mjs'],
  invaders: ['invaders-*.test.mjs'],
  invasive: ['invasive-*.test.mjs'],
  ships: ['ships.test.mjs'],
  galaga: ['galaga-*.test.mjs'],
  voyagers2: ['voyagers2-*.test.mjs'],
  radio: ['radio-*.test.mjs'],
  rtype: ['rtype-*.test.mjs'],
  outrun: ['outrun-*.test.mjs'],
  breakout: ['breakout-*.test.mjs'],
  battery: ['battery-*.test.mjs'],
  miniworld: ['miniworld-*.test.mjs'],
  figur: ['figur-*.test.mjs'],
  deploy: ['site-*.test.mjs'],
  // Tests that walk the whole site's source for a rule (no invite phrase in client code, the auth host in one place,
  // no static import of a view's chunk): any code change anywhere runs them (`SCANNED`).
  scans: ['miniworld-login-client.test.mjs', 'portal-account.test.mjs', 'zelda-views.test.mjs'],
}

/** Where the `scans` area's tests look: a change below any of these (but words) runs them too. */
export const SCANNED = ['themes/', 'servers/', 'server/', 'plugins/', 'components/', 'composables/', 'pages/']

export const PATHS = [
  // Words: no test reads them.
  ['**/*.md', []],
  ['docs/', []],
  ['.claude/', []],
  ['.agents/', []],
  ['.gitignore', []],

  // The tests themselves: a test file runs itself; anything else in tests/ (the loaders, the walker, this table) is shared.
  ['tests/zelda-hero-drawn.json', ['zelda']],
  ['tests/zelda-old-saves.json', ['zelda']],
  ['tests/helpers/art.mjs', ['zelda']],
  ['tests/*.test.mjs', SELF],
  ['tests/', ALL],

  // What every page and every test stands on.
  ['package.json', ALL],
  ['package-lock.json', ALL],
  ['.npmrc', ALL],
  ['nuxt.config.ts', ALL],
  ['tsconfig.json', ALL],
  ['wrangler.toml', ALL],
  ['app.vue', ALL],
  ['error.vue', ALL],
  ['pages/', ALL],
  ['server/', ALL],
  ['migrations/', ALL],
  ['components/', ALL],
  ['composables/', ALL],
  ['plugins/', ALL],
  ['themes/base/', ALL],
  ['themes/*.ts', ALL],
  ['scripts/deploy*', ALL],
  ['scripts/test-affected.mjs', ALL],
  ['public/fonts/', ALL],

  // A theme, and the themes and tests that import it.
  ['themes/zelda/account.ts', ['zelda', 'portal', 'miniworld', 'figur']],
  ['themes/zelda/', ['zelda', 'portal']],
  ['themes/portal/', ['portal', 'zelda']],
  ['themes/stage/', ['zelda']],
  // (Figur's sign-in gate is checked with Mini World's, in miniworld-login-client.)
  ['themes/figur/', ['figur', 'miniworld', 'zelda']],
  ['themes/miniworld/', ['miniworld', 'figur', 'zelda']],
  ['servers/mw-world/', ['miniworld']],
  ['themes/leaderboard/', ['leaderboard', 'invasive', 'zelda']],
  ['themes/radio/', ['radio', 'anotherworld', 'battery', 'figur', 'miniworld', 'outrun', 'zelda']],
  ['themes/galaga/', ['galaga', 'radio']],
  ['themes/outrun/', ['outrun', 'radio']],
  ['themes/ships/', ['ships', 'starfox']],
  ['themes/hangar/', ['ships']],
  ['themes/starfox/', ['starfox']],
  ['themes/anotherworld/', ['anotherworld']],
  ['themes/shore/', ['shore']],
  ['themes/battery/', ['battery']],
  ['themes/breakout/', ['breakout']],
  ['themes/invaders/', ['invaders']],
  ['themes/invasive/', ['invasive']],
  ['themes/rtype/', ['rtype']],
  ['themes/tetris/', ['tetris']],
  ['themes/voyagers2/', ['voyagers2']],
  // Themes with no tests of their own.
  ['themes/desk/', []],
  ['themes/scandi/', []],
  ['themes/space/', []],
  ['themes/_template/', []],

  // Pictures and the labs that make them.
  ['public/zelda/', ['zelda']],
  ['public/outrun/', ['outrun']],
  ['public/voyagers2/', ['voyagers2']],
  // (Voyagers II's comms show Galaga's portraits.)
  ['public/galaga/', ['galaga', 'voyagers2']],
  ['public/starfox/', ['starfox']],
  ['public/', []],
  ['scripts/make-pixel-font16*', ['zelda']],
  ['scripts/export-sprites.mjs', ['zelda']],
  ['scripts/zelda-lab/', ['zelda']],
  ['scripts/galaga-lab/', ['galaga', 'voyagers2']],
  ['scripts/voyagers2-lab/', ['voyagers2']],
  ['scripts/outrun-lab/', ['outrun']],
  ['scripts/battery-lab/', ['battery']],
  ['scripts/miniworld-lab/', ['miniworld']],
  ['scripts/figur-lab/', ['figur']],
  ['scripts/invasive-lab/', ['invasive']],
  ['scripts/starfox-lab/', ['starfox']],
  ['scripts/shore-lab/', ['shore']],
  ['scripts/rtype-lab/', ['rtype']],
  ['scripts/russian-lab/', ['tetris']],
  ['scripts/login-lab/', ['miniworld', 'figur']],
  ['scripts/pixel-lab/', []],
  ['scripts/make-favicon.py', []],
  ['scripts/make-starfox-pilots.py', ['starfox']],
]

/** A PATHS pattern as a RegExp over a repo path. */
export function patternRegExp(pattern) {
  if (pattern.endsWith('/')) pattern += '**'
  let re = ''
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i]
    if (c === '*' && pattern[i + 1] === '*') {
      i++
      if (pattern[i + 1] === '/') { i++; re += '(?:.*/)?' } else re += '.*'
    } else if (c === '*') re += '[^/]*'
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

const RULES = PATHS.map(([pattern, run]) => ({ pattern, re: patternRegExp(pattern), run }))

/** The rule for one changed path: { pattern, run }, or null when no pattern matches (which runs everything). */
export function ruleFor(path) {
  return RULES.find(r => r.re.test(path)) ?? null
}

/** The test files (names in tests/) of the given areas, out of the files that exist. */
export function testsOf(areas, files) {
  const out = new Set()
  for (const area of areas) {
    const globs = AREAS[area]
    if (!globs) throw new Error(`no test area ${area}`)
    for (const g of globs) for (const f of files) if (patternRegExp(g).test(f)) out.add(f)
  }
  return [...out].sort()
}

/**
 * What a list of changed paths runs. `files` is every test file in tests/ (names only).
 * Returns { all, tests, why }: `all` true means every test file (the first reason in `why` says which path asked),
 * `tests` is the sorted list otherwise, `why` one line per changed path.
 */
export function affected(paths, files) {
  const why = []
  const areas = new Set()
  const self = new Set()
  let all = false
  for (const path of paths) {
    const rule = ruleFor(path)
    if (!rule) { all = true; why.push(`${path}: no rule matches it, so everything runs`); continue }
    if (rule.run === ALL) { all = true; why.push(`${path}: shared (${rule.pattern}), so everything runs`); continue }
    if (rule.run === SELF) {
      const name = path.slice('tests/'.length)
      if (files.includes(name)) { self.add(name); why.push(`${path}: runs itself`) } else why.push(`${path}: gone, nothing to run`)
      continue
    }
    for (const a of rule.run) areas.add(a)
    if (SCANNED.some(d => path.startsWith(d)) && !path.endsWith('.md')) areas.add('scans')
    why.push(`${path}: ${rule.run.length ? rule.run.join(', ') : 'no tests'}`)
  }
  if (all) {
    why.sort((a, b) => /everything runs$/.test(b) - /everything runs$/.test(a))
    return { all: true, tests: [...files].sort(), why }
  }
  return { all: false, tests: [...new Set([...testsOf([...areas], files), ...self])].sort(), why }
}
