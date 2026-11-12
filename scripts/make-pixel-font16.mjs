#!/usr/bin/env node
// Builds public/fonts/neon-pixel-16.woff2 from the 16-bit view's dialog font
// (themes/base/pixel/font16.ts), so the HTML the shell lays over that view
// wears the same letters as its canvas HUD (Æ Ø Å and É with their marks; È Ä Ö Ü
// draw as the canvas aliases them, and lower case maps to upper case). Node
// dumps the glyphs; make-pixel-font16.py draws them (fontTools, with brotli for woff2).
//   node scripts/make-pixel-font16.mjs
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = esbuild.buildSync({ entryPoints: [join(repo, 'themes/base/pixel/font16.ts')], bundle: true, format: 'cjs', write: false, platform: 'node' })
const mod = { exports: {} }
new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports)
const { GLYPHS16, CAP16, glyphRows16, glyphExtra16 } = mod.exports

/** `rows` from row `top` on, in a twelve-row glyph that is blank elsewhere (as font16.ts's `at`). */
const at = (top, rows) => Array.from({ length: CAP16 }, (_, r) => rows[r - top] ?? '.'.repeat(rows[0].length))
const x = (n, row) => Array.from({ length: n }, () => row)

// Each glyph: the twelve rows of the capital, the rows over it (Å's ring, É's accent) and the rows under the baseline (a comma's tail).
const glyphs = {}
for (const ch of [...GLYPHS16, 'É']) glyphs[ch] = { rows: glyphRows16(ch), ...glyphExtra16(ch) }
// Stand-ins the canvas font lacks, drawn in the same grid (two-pixel uprights, twelve rows): the panels' marks and what an address or a headline may hold.
const extra = {
  '▶': ['......', '#.....', '##....', '###...', '####..', '#####.', '######', '#####.', '####..', '###...', '##....', '#.....'],
  '◀': ['......', '.....#', '....##', '...###', '..####', '.#####', '######', '.#####', '..####', '...###', '....##', '.....#'],
  '▲': at(3, ['....##....', '...####...', '..######..', '.########.', '##########']),
  '▼': at(4, ['##########', '.########.', '..######..', '...####...', '....##....']),
  '■': at(2, x(8, '########')),
  '|': x(12, '##'),
  '[': ['####', ...x(10, '##..'), '####'],
  ']': ['####', ...x(10, '..##'), '####'],
  '@': ['..######..', '.##....##.', '##......##', '##..###.##', '##.##.#.##', '##.##.#.##', '##.##.#.##', '##.##.#.##', '##..#####.', '##........', '.##....##.', '..######..'],
  '—': at(5, ['##########', '##########']),
  '…': at(10, ['##.##.##', '##.##.##']),
  '❚': x(12, '####'),
  '♪': ['...###..', '...####.', '...##.##', '...##..#', '...##...', '...##...', '...##...', '...##...', '.####...', '#####...', '#####...', '.###....'],
}
for (const [ch, rows] of Object.entries(extra)) glyphs[ch] = { rows, above: [], below: [] }

const json = join(tmpdir(), 'neon-pixel-16-glyphs.json')
writeFileSync(json, JSON.stringify(glyphs))
execFileSync('python3', [join(repo, 'scripts/make-pixel-font16.py'), json, join(repo, 'public/fonts/neon-pixel-16.woff2')], { stdio: 'inherit' })
