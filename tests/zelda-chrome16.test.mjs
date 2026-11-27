// Neon Shrine's 16-bit dress for HTML (themes/base/pixel/pixel16.css): the one thing of it a file test can hold is
// that its webfont ships. How the shell wears the dress is looked at by the shell smoke (scripts/zelda-lab/smoke.mjs).
import { it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

it('ships the 16-bit webfont, a real woff2 and a small one', () => {
  const font = readFileSync(new URL('../public/fonts/neon-pixel-16.woff2', import.meta.url))
  assert.equal(font.subarray(0, 4).toString('latin1'), 'wOF2')
  assert.ok(font.length < 4096, `${font.length} bytes`)
})
