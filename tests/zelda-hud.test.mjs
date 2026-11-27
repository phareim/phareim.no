// Neon Shrine's HUD at double density: the 16-bit dialog font, the name on a dialog box and the scale a fine-pixel
// skin gets. Pure modules, bundled with esbuild like the other zelda tests.
import { it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export { glyphRows, textWidth, wrapText } from '../base/pixel/font'`,
        `export { CAP16, ABOVE16, BELOW16, GLYPHS16, glyphRows16, glyphExtra16, textWidth16, wrapText16 } from '../base/pixel/font16'`,
        `export { hudScale, speakerOf } from './render/hud'`,
      ].join('; '),
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

// Everything a line may hold: ASCII, and the letters and signs the 5×7 font adds.
const CANDIDATES = [...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)), ...'ÆØÅÉÈÄÖÜ·×♥→←↑↓—–’‘“”…']

it('draws every character the 5×7 font has in the 16-bit font, as even rows, and a line no wider than at twice the size', () => {
  const unknown5 = M.glyphRows('\u0001')
  const unknown16 = M.glyphRows16('\u0001')
  for (const ch of CANDIDATES) {
    if (ch === '?' || M.glyphRows(ch) === unknown5) continue
    assert.notEqual(M.glyphRows16(ch), unknown16, `no 16-bit glyph for ${JSON.stringify(ch)}`)
  }
  for (const ch of [...M.GLYPHS16, 'É']) {
    const rows = M.glyphRows16(ch)
    assert.equal(rows.length, M.CAP16, ch)
    const { above, below } = M.glyphExtra16(ch)
    assert.ok(above.length <= M.ABOVE16 && below.length <= M.BELOW16, ch)
    for (const row of [...above, ...rows, ...below]) {
      assert.equal(row.length, rows[0].length, `${ch}: uneven row`)
      assert.match(row, /^[#.]+$/, ch)
    }
  }
  const line = 'KEEPER: THE SUN HAS HUNG ON THE HORIZON FOR 3 NIGHTS, 11:11. "ÆØÅ" (50% + 1/4)!'
  assert.ok(M.textWidth16(line) <= M.textWidth(line) * 2)
})

it('wraps a long line within the width, losing no word', () => {
  const text = 'THE STATIC KING TOOK THE SUN PRISM INTO THE OLD NEON SHRINE. TAKE THE BLADE BY THE DOOR.'
  const lines = M.wrapText16(text, 300)
  assert.ok(lines.length > 1)
  for (const l of lines) assert.ok(M.textWidth16(l) <= 300, l)
  assert.equal(lines.join(' '), text)
  assert.deepEqual(M.wrapText16('ONE\nTWO', 300), ['ONE', 'TWO'])
})

it("heads a dialog box with the speaker's name, their own or the one the talk opened with, and a sign with none", () => {
  assert.deepEqual(M.speakerOf('KEEPER: THE SUN HAS HUNG.', 'keeper'), { name: 'KEEPER', body: 'THE SUN HAS HUNG.' })
  // The barmaid's lines say BARTENDER: the first line of the talk names her.
  assert.deepEqual(M.speakerOf('BARTENDER: BACK AGAIN?', 'barmaid', 'BARTENDER: WHAT WILL IT BE?'), { name: 'BARTENDER', body: 'BACK AGAIN?' })
  assert.equal(M.speakerOf('LAB NOTE: SUBJECT L MOVED A BLOCK.', null), null)
})

it('gives the fine skin an even HUD scale, two or more, on a phone and a desktop', () => {
  for (let s = 1; s < 12; s++) for (const [w, h] of [[1170, 2532], [750, 1334], [1440, 900], [2560, 1440]]) {
    const k = M.hudScale(s, w, h, 2)
    assert.ok(k >= 2 && k % 2 === 0, `scale ${s} on ${w}x${h}: ${k}`)
  }
})
