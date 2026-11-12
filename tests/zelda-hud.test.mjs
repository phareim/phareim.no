// Neon Shrine's HUD at double density: the 16-bit dialog font, the EPX
// scaler and the scale a fine-pixel skin gets. Pure modules, bundled with
// esbuild like the other zelda tests.
import { describe, it, before } from 'node:test'
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
        `export { CAP16, LINE16, ABOVE16, BELOW16, GLYPHS16, glyphRows16, glyphExtra16, textWidth16, wrapText16 } from '../base/pixel/font16'`,
        `export { epx } from '../base/pixel/epx'`,
        `export { hudScale, hudFont, speakerOf, NEON_SKIN, WINDOW_SKIN, HIRES_WINDOW_SKIN } from './render/hud'`,
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
// Drawn wider here than their stand-ins in the 5×7 font.
const WIDER = ['…', '—', '–']
const CANDIDATES = [...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)), ...'ÆØÅÉÈÄÖÜ·×♥→←↑↓—–’‘“”…']

describe('the 16-bit dialog font', () => {
  it('has a drawing for every character the 5×7 font has', () => {
    const unknown5 = M.glyphRows('\u0001')
    const unknown16 = M.glyphRows16('\u0001')
    for (const ch of CANDIDATES) {
      if (ch === '?' || M.glyphRows(ch) === unknown5) continue
      assert.notEqual(M.glyphRows16(ch), unknown16, `no 16-bit glyph for ${JSON.stringify(ch)}`)
    }
  })

  it('draws every glyph as twelve even rows, with what hangs over and under inside the margins', () => {
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
    assert.equal(M.glyphExtra16('å').above.length, 3)
    assert.ok(M.CAP16 + 1 <= M.LINE16)
  })

  it('never advances further than the 5×7 glyph does at twice the size', () => {
    for (const ch of CANDIDATES) {
      // The long dashes and the ellipsis are a hyphen and one dot in the 5×7 font and drawn in full here: they stand in talk, which is wrapped in the font it is shown in.
      if (WIDER.includes(ch)) continue
      const wide = M.glyphRows16(ch)[0].length + 2
      const classic = (M.glyphRows(ch)[0].length + 1) * 2
      assert.ok(wide <= classic, `${JSON.stringify(ch)}: ${wide} > ${classic}`)
    }
    const line = 'KEEPER: THE SUN HAS HUNG ON THE HORIZON FOR 3 NIGHTS, 11:11. "ÆØÅ" (50% + 1/4)!'
    assert.ok(M.textWidth16(line) <= M.textWidth(line) * 2)
  })

  it('draws the long dashes and the ellipsis in full', () => {
    assert.equal(M.textWidth16('…'), 10)
    assert.deepEqual(M.glyphRows16('…').slice(10), ['##..##..##', '##..##..##'])
    assert.ok(M.textWidth16('—') > M.textWidth16('–') && M.textWidth16('–') > M.textWidth16('-'))
    for (const ch of WIDER) assert.notEqual(M.glyphRows16(ch), M.glyphRows16('.'), ch)
    assert.ok(M.textWidth16('ZZZ…') > M.textWidth16('ZZZ.'))
  })

  it('keeps Å\'s ring clear of the letter under it', () => {
    const { above } = M.glyphExtra16('Å')
    assert.equal(above.length, 3)
    // A ring with a hole in it, then a clear row, then the A.
    assert.match(above[1], /#\.+#/)
    assert.match(M.glyphRows16('Å')[0], /^\.+$/)
    assert.deepEqual(M.glyphRows16('Å').slice(1), M.glyphRows16('A').slice(1))
  })

  it('measures and wraps', () => {
    assert.equal(M.textWidth16(''), 0)
    assert.equal(M.textWidth16('A'), 8)
    assert.equal(M.textWidth16('AB'), 18)
    assert.equal(M.textWidth16('ab'), M.textWidth16('AB'))
    assert.equal(M.textWidth16('É'), M.textWidth16('E'))
    const text = 'THE STATIC KING TOOK THE SUN PRISM INTO THE OLD NEON SHRINE. TAKE THE BLADE BY THE DOOR.'
    const lines = M.wrapText16(text, 300)
    assert.ok(lines.length > 1)
    for (const l of lines) assert.ok(M.textWidth16(l) <= 300, l)
    assert.equal(lines.join(' '), text)
    assert.deepEqual(M.wrapText16('ONE\nTWO', 300), ['ONE', 'TWO'])
  })
})

describe('the name on a dialog box', () => {
  it('is the speaker\'s own, or the one their talk opened with', () => {
    assert.deepEqual(M.speakerOf('KEEPER: THE SUN HAS HUNG.', 'keeper'), { name: 'KEEPER', body: 'THE SUN HAS HUNG.' })
    // The barmaid's lines say BARTENDER: the first line of the talk names her.
    assert.deepEqual(M.speakerOf('BARTENDER: BACK AGAIN?', 'barmaid', 'BARTENDER: WHAT WILL IT BE?'), { name: 'BARTENDER', body: 'BACK AGAIN?' })
    assert.deepEqual(M.speakerOf('BARTENDER: WHAT WILL IT BE?', 'barmaid'), { name: 'BARTENDER', body: 'WHAT WILL IT BE?' })
    assert.deepEqual(M.speakerOf('L.L.A.M.A.: HM.', 'llama', 'L.L.A.M.A.: HM.'), { name: 'L.L.A.M.A.', body: 'HM.' })
  })

  it('is not a heading in the middle of a talk, a sign, or a line with no name', () => {
    assert.equal(M.speakerOf('TODAY: THE LASER SUNSET.', 'barmaid', 'BARTENDER: WHAT WILL IT BE?'), null)
    assert.equal(M.speakerOf('LAB NOTE: SUBJECT L MOVED A BLOCK.', null), null)
    assert.equal(M.speakerOf('LAB NOTE: SUBJECT L MOVED A BLOCK.', undefined), null)
    assert.equal(M.speakerOf('YOU GOT THE BLADE!', 'keeper', 'KEEPER: TAKE IT.'), null)
    assert.equal(M.speakerOf('KEEPER:', 'keeper'), null)
    assert.equal(M.speakerOf('11:11 IS THE TIME.', 'keeper'), null)
  })
})

describe('EPX', () => {
  it('doubles a picture without new colours and keeps straight edges straight', () => {
    // Left half 1, right half 2.
    const src = [1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 2, 2]
    const out = M.epx(src, 4, 3)
    assert.equal(out.length, 4 * 3 * 4)
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) assert.equal(out[y * 8 + x], x < 4 ? 1 : 2)
    // A lone pixel stays a square.
    const dot = M.epx([0, 0, 0, 0, 7, 0, 0, 0, 0], 3, 3)
    assert.deepEqual([...dot].map((v, i) => (v ? i : -1)).filter(i => i >= 0), [14, 15, 20, 21])
  })

  it('turns a stair into a diagonal', () => {
    // 1 fills the lower left under a stair of two steps.
    const src = [0, 0, 0, 1, 0, 0, 1, 1, 0]
    const out = M.epx(src, 3, 3)
    const at = (x, y) => out[y * 6 + x]
    // The step's inner corner is filled in, its outer corner cut.
    assert.equal(at(2, 3), 1)
    assert.equal(at(1, 2), 0)
    assert.ok([...out].every(v => v === 0 || v === 1))
  })
})

describe('the HUD scale of a skin', () => {
  it('is the screen scale for a classic skin, and for a fine one when it is even', () => {
    for (const s of [1, 2, 3, 4, 5, 6]) assert.equal(M.hudScale(s, 1280, 800, 1), s)
    assert.equal(M.hudScale(4, 1280, 800, 2), 4)
    assert.equal(M.hudScale(6, 1920, 1080, 2), 6)
  })

  it('is even for a fine skin: up when the layout has room, else down, never under 2', () => {
    // A phone, 390 × 844 at dpr 3 (scale 5): room for the layout at 6.
    assert.equal(M.hudScale(5, 1170, 2532, 2), 6)
    // 1440 × 900 (scale 5): 240 × 150 at 6 is too low for the pause screen.
    assert.equal(M.hudScale(5, 1440, 900, 2), 4)
    // 800 × 600 (scale 3).
    assert.equal(M.hudScale(3, 800, 600, 2), 2)
    assert.equal(M.hudScale(1, 300, 200, 2), 2)
    for (let s = 1; s < 12; s++) for (const [w, h] of [[1170, 2532], [750, 1334], [1440, 900], [2560, 1440]]) assert.equal(M.hudScale(s, w, h, 2) % 2, 0)
  })

  it('is asked for by the 16-bit window skin, which brings its own lettering', () => {
    assert.equal(M.HIRES_WINDOW_SKIN.density, 2)
    assert.equal(M.NEON_SKIN.density ?? 1, 1)
    assert.equal(M.WINDOW_SKIN.density ?? 1, 1)
    const fine = M.hudFont(M.HIRES_WINDOW_SKIN)
    const classic = M.hudFont(M.NEON_SKIN)
    assert.equal(M.hudFont(M.WINDOW_SKIN), classic)
    for (const t of ['P RESUME   T TOWN', 'M SOUND OFF', 'BIG KEY', 'HEART PIECES', 'YES OR NO BELOW']) assert.ok(fine.width(t) <= classic.width(t), t)
    for (const l of fine.wrap('YOUR QUEST, ITEMS AND HEARTS WILL BE GONE, HERE AND ON YOUR PILOT. YOUR BEST TIME STAYS.', 160)) assert.ok(fine.width(l) <= 160)
  })

  it('names the coarse skin worn in its place where the screen has no finer pixel', () => {
    assert.equal(M.HIRES_WINDOW_SKIN.coarse(), M.WINDOW_SKIN)
    assert.equal(M.WINDOW_SKIN.coarse, undefined)
  })
})
