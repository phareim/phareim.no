#!/usr/bin/env node
// Builds public/fonts/neon-pixel.woff from Neon Shrine's 5×7 canvas font
// (themes/zelda/render/font.ts), so HTML text can wear the same letters as
// the canvas. Node dumps the glyphs; scripts/make-pixel-font.py draws them.
//   node scripts/make-pixel-font.mjs
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = esbuild.buildSync({ entryPoints: [join(repo, 'themes/zelda/render/font.ts')], bundle: true, format: 'cjs', write: false, platform: 'node' })
const mod = { exports: {} }
new Function('module', 'exports', out.outputFiles[0].text)(mod, mod.exports)
const { glyphRows } = mod.exports
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ0123456789 .,!?\'":;-·+/()%&*#=<>_×♥→←↑↓'
const glyphs = {}
for (const ch of chars) glyphs[ch] = glyphRows(ch)
// Stand-ins the canvas font lacks, drawn in the same grid.
Object.assign(glyphs, {
  '▶': ['#....', '##...', '###..', '####.', '###..', '##...', '#....'],
  '◀': ['....#', '...##', '..###', '.####', '..###', '...##', '....#'],
  '▲': ['.....', '..#..', '.###.', '#####', '#####', '.....', '.....'],
  '▼': ['.....', '#####', '#####', '.###.', '..#..', '.....', '.....'],
  '|': ['#', '#', '#', '#', '#', '#', '#'],
  '[': ['##', '#.', '#.', '#.', '#.', '#.', '##'],
  ']': ['##', '.#', '.#', '.#', '.#', '.#', '##'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '♪': ['..##.', '..#.#', '..#..', '..#..', '###..', '###..', '.....'],
  '↻': ['.###.', '#...#', '#....', '#..#.', '#.###', '#..#.', '.##..'],
  '⌂': ['..#..', '.#.#.', '#...#', '#...#', '#...#', '#####', '.....'],
})
const json = join(tmpdir(), 'neon-pixel-glyphs.json')
writeFileSync(json, JSON.stringify(glyphs))
execFileSync('python3', [join(repo, 'scripts/make-pixel-font.py'), json, join(repo, 'public/fonts/neon-pixel.woff')], { stdio: 'inherit' })
