// The menu's LOG page (`themes/zelda/render/logPage.ts`) and the build step that gives it the game's version and
// change list (`scripts/zelda-changes.mjs`): the step on this repository and where there is no history, the page on
// the screens it is played on, and the menu's four tabs on the narrowest phone. No canvas: the layouts are pure.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { OUT, PREFIX, pixelText, readChanges, writeChanges } from '../scripts/zelda-changes.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')

let Z
before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export * from './render/logPage'; export { hudScale, hudFont, menuTabs, menuTabsY, NEON_SKIN, HIRES_WINDOW_SKIN } from './render/hud'; export { TOUCH_KEYS, KEYBOARD_KEYS } from './keys'`,
      resolveDir: join(repo, 'themes', 'zelda'), loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

/** What the pixel face draws (the lands' words rule, zelda-world.test.mjs). */
const DRAWN = /^[A-Z0-9ÆØÅ .,!?'":;\-()/#%&+=*·↑↓←→]+$/

test('the build step: this repository has a version and a list in the pixel face; without a history, none, and no throw', (t) => {
  const log = readChanges(repo)
  assert.ok(Number.isInteger(log.version) && log.version > 0, `version ${log.version}`)
  assert.match(log.date, /^\d{1,2} [A-Z]{3} \d{4}$/)
  assert.match(log.hash, /^[0-9a-f]{7,}$/)
  const lines = log.changes.flatMap(d => d.lines)
  assert.ok(lines.length > 0 && lines.length <= 40 && lines.length <= log.version)
  assert.equal(new Set(log.changes.map(d => d.date)).size, log.changes.length, 'each day once')
  assert.equal(log.changes[0].date, log.date)
  for (const l of lines) assert.match(l, DRAWN, `not in the font: ${l}`)
  assert.match(pixelText('a — “b” … é Ö @ [c]_d 🎉'), DRAWN)
  // The newest line is the newest such commit's subject.
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const commits = git('log', '--format=%ct%x09%h%x09%s').split('\n').map(r => r.split('\t')).filter(c => c[2]?.startsWith(PREFIX)).sort((a, b) => b[0] - a[0])
  assert.equal(log.version, commits.length)
  assert.equal(log.hash, commits[0][1])
  assert.equal(lines[0], pixelText(commits[0][2].slice(PREFIX.length)))

  const tmp = mkdtempSync(join(tmpdir(), 'zelda-changes-'))
  t.after(() => rmSync(tmp, { recursive: true, force: true }))
  const none = { version: 0, date: '', hash: '', changes: [] }
  assert.deepEqual(writeChanges(join(tmp, 'empty')), none)
  assert.ok(existsSync(join(tmp, 'empty', OUT)), 'the module is written all the same')
  assert.deepEqual(readChanges(join(tmp, 'not-there')), none)
  // A clone of the last commit alone: the history is cut inside the game's, so nothing is counted.
  execFileSync('git', ['clone', '-q', '--depth', '1', '--no-checkout', pathToFileURL(repo).href, join(tmp, 'shallow')], { stdio: 'ignore' })
  assert.deepEqual(readChanges(join(tmp, 'shallow')), none)
})

/**
 * Screens in CSS px, and where the paused deck's buttons begin on the LOG page in each dress (measured in the shell).
 * The last is the first with a notch over it and DEV MODE's strip under that.
 */
const SCREENS = [
  { w: 360, h: 640, dpr: 2, deck: { 1: 572, 2: 582 } },
  { w: 390, h: 844, dpr: 3, deck: { 1: 776, 2: 786 } },
  { w: 844, h: 390, dpr: 3, deck: { 1: 322, 2: 332 } },
  { w: 1280, h: 800, dpr: 1 },
  { w: 390, h: 844, dpr: 3, deck: { 1: 742, 2: 752 }, top: 59 },
]

/** The page on a screen in a dress, on the HUD's grid as the renderer reckons it (`resize`, `hudSpace`). */
function grid(scr, density) {
  const W = scr.w * scr.dpr
  const H = scr.h * scr.dpr
  let scale = Math.max(1, Math.floor(Math.min(W / (13 * 16), H / (11 * 16))))
  while (W / scale > 30 * 16) scale++
  const hs = Z.hudScale(scale, W, H, density)
  const vw = Math.ceil(W / hs)
  const vh = Math.ceil(H / hs)
  const oy = Math.floor((H - vh * hs) / 2)
  const deck = scr.deck ? Math.floor((scr.deck[density] * scr.dpr - oy) / hs) : null
  const safe = { top: Math.ceil(((scr.top ?? 0) * scr.dpr) / hs) }
  return { vw, vh, css: hs / scr.dpr, deck, safe, keys: scr.deck ? Z.TOUCH_KEYS : Z.KEYBOARD_KEYS }
}

/** Forty changes as they could come: days of one and of many, long lines, and a word longer than a phone is wide. */
function forty() {
  const words = 'THE LAMP ON THE PIER LIGHTS WHEN THE FERRY IS DUE, AND THE KEEPER SAYS SO TO WHOEVER ASKS HIM TWICE'.split(' ')
  let n = 0
  return {
    version: 412, date: '27 NOV 2026', hash: '2bff6bd',
    changes: [1, 9, 22, 2, 6].map((count, d) => ({
      date: `${27 - d} NOV 2026`,
      lines: Array.from({ length: count }, () => {
        const i = n++
        const line = `${i} ${words.slice(0, 3 + (i * 7) % (words.length - 2)).join(' ')}`
        return i === 12 ? `${line} THEMES/ZELDA/RENDER/ISO/ARTINDEX.TS-AND-THEMES/ZELDA/RENDER/ISO/ARTPACK.TS` : line
      }),
    })),
  }
}

const meets = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
const within = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h
function apart(list, where) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    assert.ok(!meets(list[i][1], list[j][1]), `${where}: ${list[i][0]} ${JSON.stringify(list[i][1])} over ${list[j][0]} ${JSON.stringify(list[j][1])}`)
  }
}

test('lays out on every screen: inside it, above the deck, nothing over anything, the pages the whole list between them', () => {
  for (const log of [forty(), readChanges(repo)]) {
    const all = log.changes.flatMap(d => d.lines)
    for (const scr of SCREENS) for (const density of [1, 2]) {
      const g = grid(scr, density)
      const font = Z.hudFont(density === 2 ? Z.HIRES_WINDOW_SKIN : Z.NEON_SKIN)
      const seen = []
      let pages = 1
      for (let page = 0; page < pages; page++) {
        const p = Z.logPageFor(g.vw, g.vh, { keys: g.keys, log, dev: page % 2 === 1, page, css: g.css, deck: g.deck, safe: g.safe }, density === 2 ? Z.HIRES_WINDOW_SKIN : Z.NEON_SKIN)
        const bottom = g.deck === null ? g.vh : g.deck - 2
        const where = `${scr.w}×${scr.h}${scr.top ? ' notched' : ''} density ${density} (${g.vw}×${g.vh}, bottom ${bottom}) page ${page + 1}/${p.pages}`
        pages = p.pages
        assert.equal(p.page, page, where)
        assert.equal(!!p.newer, page > 0, `${where}: NEWER`)
        assert.equal(!!p.older, page < pages - 1, `${where}: OLDER`)
        assert.equal(p.count?.text ?? null, pages > 1 ? `${page + 1}/${pages}` : null, where)
        assert.equal(p.last.length > 0, !scr.deck, `${where}: the keys' line`)
        const screen = { x: 0, y: g.safe.top, w: g.vw, h: bottom - g.safe.top }
        // What is pressed: 44 CSS px or more, the word it is for inside it.
        const hits = [['switch', p.dev.hit, [p.dev.label, p.dev.off, p.dev.on, p.dev.frame]]]
        for (const [name, w] of [['newer', p.newer], ['older', p.older]]) if (w) hits.push([name, w.hit, [w]])
        for (const [name, hit, words] of hits) {
          assert.ok(hit.w * g.css >= 44 && hit.h * g.css >= 44, `${where}: ${name} ${hit.w * g.css} × ${hit.h * g.css} CSS px`)
          for (const w of words) assert.ok(within(w, hit), `${where}: ${name}'s words out of its room`)
        }
        const parts = [
          ['tabs', p.tabs], ['title', p.title], ...p.stamp.map((l, i) => [`stamp ${i}`, l]), ...p.rows.map((l, i) => [`row ${i} ${l.text}`, l]),
          ...hits.map(([name, hit]) => [name, hit]), ...(p.count ? [['count', p.count]] : []), ...p.last.map((l, i) => [`keys ${i}`, l]),
        ]
        for (const [name, b] of parts) {
          assert.ok(within(b, screen), `${where}: ${name} ${JSON.stringify([b.x, b.y, b.w, b.h])} off the page`)
          for (const v of [b.x, b.y, b.w, b.h]) assert.ok(Number.isInteger(v), `${where}: ${name} not on whole px`)
        }
        apart(parts, where)
        for (const r of p.rows) {
          assert.ok(within(r, p.list), `${where}: ${r.text} out of the list`)
          assert.ok(font.width(r.text) <= r.w)
          if (r.kind === 'line') seen.push({ page, change: r.change, text: r.text })
        }
        assert.equal(p.rows[0].kind, 'day', `${where}: a page opens with its date`)
      }
      // Every change once, in order, in unbroken rows, with every character of it.
      const order = seen.map(r => r.change).filter((c, i, a) => c !== a[i - 1])
      assert.deepEqual(order, all.map((_, i) => i), `${scr.w}×${scr.h} density ${density}: each change once`)
      all.forEach((line, i) => assert.equal(seen.filter(r => r.change === i).map(r => r.text).join('').replaceAll(' ', ''), line.replaceAll(' ', '')))
    }
  }
  // No history: one page that says so, and the switch still there.
  const g = grid(SCREENS[0], 2)
  const p = Z.logPageFor(g.vw, g.vh, { keys: g.keys, log: { version: 0, date: '', hash: '', changes: [] }, dev: false, page: 3, css: g.css, deck: g.deck, safe: g.safe }, Z.HIRES_WINDOW_SKIN)
  assert.deepEqual([p.pages, p.page, p.stamp.length, p.rows.map(r => r.text).join(' '), !!p.dev.hit], [1, 0, 0, Z.NO_HISTORY, true])
})

test('the menu\'s tabs fit a screen 360 px wide in both dresses', () => {
  for (const dpr of [2, 3]) for (const density of [1, 2]) for (const keyboard of [false, true]) {
    const { vw, vh } = grid({ w: 360, h: 640, dpr }, density)
    const F = Z.hudFont(density === 2 ? Z.HIRES_WINDOW_SKIN : Z.NEON_SKIN)
    const tabs = Z.menuTabs(F, vw, Z.menuTabsY(vh), keyboard)
    const where = `dpr ${dpr} density ${density} (${vw} wide) ${tabs.map(t => t.label).join(' ')}`
    // (A keyboard has a fifth, KEYS.)
    assert.deepEqual(tabs.map(t => t.id), ['items', 'moves', 'map', 'log', ...(keyboard ? ['keys'] : [])])
    for (const [i, t] of tabs.entries()) {
      assert.ok(t.x >= 0 && t.x + t.w <= vw, `${where}: ${t.label} at ${t.x}, ${t.w} wide`)
      assert.ok(F.width(t.label) <= t.w, where)
      if (i) assert.ok(t.x - (tabs[i - 1].x + tabs[i - 1].w) >= 6, `${where}: ${t.label} runs into ${tabs[i - 1].label}`)
    }
  }
})
