// The 16-bit dress for HTML (themes/base/pixel/pixel16.css) against the canvas
// HUD it copies (themes/zelda/render/hud16.ts): the bands of the windows, the
// frames' colours, the letters' colours; the webfont beside the 5×7 one; and
// the shell putting the dress on with the 16-bit windows. The CSS and the Vue
// file are read as text; the skin is bundled with esbuild like the other
// zelda tests.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = f => readFileSync(join(repo, f), 'utf8')

const css = read('themes/base/pixel/pixel16.css')
const hud16 = read('themes/zelda/render/hud16.ts')

/** A custom property's value in pixel16.css. */
function prop(name) {
  const m = css.match(new RegExp(`\\n\\s*${name}:\\s*([^\\n]+);`))
  assert.ok(m, `${name} is not in pixel16.css`)
  return m[1]
}

/** hud16.ts's TONES, read from its source (they are not exported). */
function tone(name) {
  const m = hud16.match(new RegExp(`${name}: \\{ top: \\[(\\d+), (\\d+), (\\d+)\\], bottom: \\[(\\d+), (\\d+), (\\d+)\\], hi: '(#\\w+)', lo: '(#\\w+)', hi2: '(#\\w+)', lo2: '(#\\w+)' \\}`))
  assert.ok(m, `TONES.${name} has changed shape in hud16.ts`)
  return { top: m.slice(1, 4).map(Number), bottom: m.slice(4, 7).map(Number), rings: m.slice(7, 11) }
}

/** `linear-gradient(a 8%, b 0 10%, …, z 0)` as bands: a colour and where it ends (0…1). */
function bands(value) {
  const inner = value.match(/^linear-gradient\((.*)\)$/)
  assert.ok(inner, 'a fill is a linear-gradient')
  return inner[1].split(',').map((part, i, all) => {
    const t = part.trim().split(/\s+/)
    const end = i === all.length - 1 ? 1 : parseFloat(t[t.length - 1]) / 100
    return { color: t[0], end }
  })
}

/** As hud16.ts: one channel in the machine's five bits. */
const five = v => Math.min(248, Math.round(v / 8) * 8)
const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('')
/** `#fff` and `#ffffff` alike. */
const long = c => (c.length === 4 ? '#' + [...c.slice(1)].map(d => d + d).join('') : c).toLowerCase()

let M
before(async () => {
  const out = esbuild.buildSync({
    stdin: { contents: `export { HIRES_WINDOW_SKIN } from './render/hud'`, resolveDir: join(repo, 'themes/zelda'), loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  M = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

describe('the 16-bit dress for HTML', () => {
  for (const name of ['hot', 'cool']) {
    it(`fills a ${name} window with the canvas window's bands`, () => {
      const t = tone(name)
      const css16 = bands(prop(`--px16-fill-${name}`))
      // The canvas paints one colour per row; a tall window shows every band. The CSS must give the same colour
      // at the same height, give or take the row where a band changes.
      const rows = 2000
      let off = 0
      for (let r = 0; r < rows; r++) {
        const f = r / (rows - 1)
        const want = hex([0, 1, 2].map(i => five(t.top[i] + (t.bottom[i] - t.top[i]) * f)))
        const got = (css16.find(b => f < b.end) ?? css16[css16.length - 1]).color
        if (long(got) !== want) off++
      }
      assert.ok(off <= css16.length * 2, `${off} of ${rows} rows are another colour than hud16.ts paints`)
      // Bands, not a smooth gradient: every stop is hard (a colour, then `0`, then where it ends).
      assert.ok(css16.length >= 12, 'the fill has the machine\'s many bands')
      assert.doesNotMatch(prop(`--px16-fill-${name}`).replace(/^linear-gradient\([^,]+,/, ''), /#\w+ [1-9][\d.]*%/, 'a band must start where the last one ended')
    })

    it(`frames a ${name} window in the canvas window's outline and rings`, () => {
      const t = tone(name)
      for (const frame of [prop(`--px16-frame-${name}`), prop(`--px16-frame-${name}-in`)]) {
        const fills = [...frame.matchAll(/fill='%23(\w+)'/g)].map(m => long('#' + m[1]))
        assert.deepEqual([...fills].sort(), ['#070a2c', ...t.rings].sort(), 'the outline and the four ring colours, nothing else')
        assert.match(frame, /shape-rendering='crispEdges'/)
      }
      assert.match(hud16, /box\(g, 0, 0, w \+ 2, h \+ 2, round, '#070a2c'\)/, 'the outline colour is still hud16.ts\'s')
    })
  }

  it('letters in the skin\'s colours over its shadow', () => {
    const skin = M.HIRES_WINDOW_SKIN
    const pairs = { text: skin.text, shadow: skin.shadow, dim: skin.dim, faint: skin.faint, hot: skin.hot, cool: skin.cool, prize: skin.prize, ok: skin.ok }
    for (const [name, want] of Object.entries(pairs)) assert.equal(prop(`--px16-${name}`), want, `--px16-${name}`)
    assert.equal(prop('--px16-slot').replace(/\s/g, ''), skin.slot)
    assert.equal(prop('--px16-veil').replace(/\s/g, ''), skin.veil)
    // One font pixel right, below and between: a sixteenth of the em.
    assert.equal(prop('--px16-drop'), '0.0625em 0 0 var(--px16-shadow), 0 0.0625em 0 var(--px16-shadow), 0.0625em 0.0625em 0 var(--px16-shadow)')
  })

  it('applies only inside .px16', () => {
    // Every rule's selectors carry the scope (the custom properties on :root dress nothing by themselves).
    const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]+\{/g, '').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*\s*\}/g, '')
    for (const m of rules.matchAll(/(^|\})\s*([^{}@]+)\{/g)) {
      const selectors = m[2].trim()
      if (!selectors) continue
      // :root carries custom properties only; they dress nothing by themselves.
      for (const s of selectors.split(/,(?![^(]*\))/)) if (s.trim() !== ':root') assert.match(s, /\.px16\b/, `"${s.trim()}" would dress the classic look too`)
    }
  })

  it('works the frame\'s cut and the shade out again wherever the unit may be set', () => {
    // A custom property is computed where it is declared: on :root alone, an element with its own --px16-u would keep the 1px frame.
    const m = css.match(/:root,\s*\.px16,\s*\.px16 \*,\s*\.px16 ~ \* \{([^}]*)\}/)
    assert.ok(m, 'the unit\'s values are declared in the scope and beside it')
    for (const name of ['--px16-cut', '--px16-inner', '--px16-shade']) {
      assert.match(m[1], new RegExp(`${name}:[^;]*var\\(--px16-(u|inner)\\)`), `${name} follows the unit`)
      assert.doesNotMatch(css.slice(0, css.indexOf(m[0])).replace(/\/\*[\s\S]*?\*\//g, ''), new RegExp(`${name}:`), `${name} must not be fixed on :root alone`)
    }
    assert.equal(prop('--px16-u'), '1px')
  })

  it('moves nothing but in steps, and stops under reduced motion', () => {
    const bare = css.replace(/\/\*[\s\S]*?\*\//g, '')
    assert.doesNotMatch(bare, /transition/)
    const animated = [...bare.matchAll(/([^{}]+)\{[^{}]*animation:\s*([^;]+);/g)].filter(m => !/none/.test(m[2]))
    assert.ok(animated.length > 0)
    for (const m of animated) {
      assert.match(m[2], /steps\(/, `${m[1].trim()} must move in steps`)
      const still = new RegExp(`prefers-reduced-motion: reduce\\)\\s*\\{[^}]*${m[1].trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{\\s*animation: none`)
      assert.match(bare, still, `${m[1].trim()} must stand still under prefers-reduced-motion`)
    }
  })
})

describe('the 16-bit font as a webfont', () => {
  const fonts = read('themes/base/fonts.css')

  it('is a small woff2 beside the 5×7 one, and named in fonts.css', () => {
    const file = join(repo, 'public/fonts/neon-pixel-16.woff2')
    assert.equal(readFileSync(file).subarray(0, 4).toString('latin1'), 'wOF2')
    assert.ok(statSync(file).size < 4096, 'the font is a few KB at most')
    assert.match(fonts, /font-family: "Neon Pixel 16";\s*src: url\("\/fonts\/neon-pixel-16\.woff2"\) format\("woff2"\);\s*font-display: block;/)
    assert.match(fonts, /--font-pixel16: "Neon Pixel 16", "Neon Pixel",/, 'a glyph it lacks falls back to the 5×7 font')
    assert.match(css, /\.px16 \{\s*--font-pixel: var\(--font-pixel16\);/, 'inside the scope the pixel font is this one')
  })

  it('keeps every @import above the first @font-face', () => {
    const lastImport = fonts.lastIndexOf('@import')
    assert.ok(lastImport >= 0 && lastImport < fonts.indexOf('@font-face'), 'Vite drops an @import that comes after another rule')
  })

  it('is built from font16.ts by the script, with the canvas font\'s advance', () => {
    const mjs = read('scripts/make-pixel-font16.mjs')
    const py = read('scripts/make-pixel-font16.py')
    assert.match(mjs, /themes\/base\/pixel\/font16\.ts/)
    assert.match(mjs, /public\/fonts\/neon-pixel-16\.woff2/)
    // Sixteen font pixels to the em, a glyph's width + 2 pixels to the next: as GAP in font16.ts.
    assert.match(py, /FontBuilder\(16 \* U, isTTF=True\)/)
    assert.match(py, /GAP = 2\b/)
    assert.match(read('themes/base/pixel/font16.ts'), /const GAP = 2\b/)
  })
})

describe('the shell in the 16-bit dress', () => {
  const shell = read('themes/zelda/Zelda.vue')

  it('wears it exactly when the view is the isometric engine with 16-bit windows', () => {
    assert.match(shell, /function wears16\(id: ViewId\): boolean \{\s*const def = viewDef\(id\) \?\? viewDef\('classic'\)!\s*return def\.engine === 'iso' && resolveParams\(def\.engine, def\.params\)\.windows === '16-bit'\s*\}/)
    // The canvas HUD makes the same choice from the same value.
    assert.match(read('themes/zelda/render/iso/view.ts'), /par\.windows === '16-bit' \? HIRES_WINDOW_SKIN : NEON_SKIN/)
  })

  it('follows the view: after a turn to it, after the studio\'s values, and at the first frame', () => {
    assert.match(shell, /viewShown = def\.id\s*pausedDrawn = false\s*syncSound\(\)\s*syncDress\(\)/, 'showView')
    assert.match(shell, /renderer\.setParams\(def\.engine, def\.params\)\s*pausedDrawn = false\s*syncSound\(\)\s*syncDress\(\)/, 'applyLiveViews')
    assert.match(shell, /dressWanted = wears16\(firstView\)\s*dress16\.value = dressWanted/, 'onMounted')
    assert.match(shell, /stepDress\(renderer\.viewState\(\)\)/, 'each frame')
  })

  it('puts the class on every root, the panels included', () => {
    for (const root of [
      /<canvas ref="canvas" class="zelda-canvas" :class="\{ px16: dress16, 'zelda-canvas--paused': paused \}"/,
      /<EscHold :class="\{ px16: dress16 \}"/,
      /class="zelda-deck-top" :class="\{ px16: dress16 \}"/,
      /:class="\{ 'zelda-deck--paused': paused, px16: dress16 \}"/,
      /<AccountConsole v-if="panel === 'account'" :class="\{ px16: dress16 \}"/,
      /<LookBooth v-if="panel === 'look'" :class="\{ px16: dress16 \}"/,
      /<NewsStand v-if="panel === 'news'" :class="\{ px16: dress16 \}"/,
    ]) assert.match(shell, root)
  })

  it('sizes what stands beside the canvas HUD by that HUD\'s pixel', () => {
    // The renderer says the unit; the shell snaps it to whole device px and writes it only when it changed.
    assert.match(read('themes/zelda/render/renderer.ts'), /fineUnit\(\): number/)
    assert.match(shell, /const unit = Math\.max\(1, Math\.round\(renderer\.fineUnit\(\) \* dpr\)\) \/ dpr\s*if \(unit === fineUnit\) return\s*fineUnit = unit\s*host\.style\.setProperty\('--px16-fine', `\$\{unit\}px`\)/)
    assert.match(shell, /renderer\.resize\(w, h, canvasPixelRatio\(3\), safeInsets\(\)\)\s*syncUnit\(\)/, 'after a resize')
    assert.match(shell, /stepDress\(renderer\.viewState\(\)\)\s*syncUnit\(\)/, 'each frame: a map may change the scale')
    assert.match(shell, /style\.removeProperty\('--px16-fine'\)/, 'taken back when the shell goes')
    // The chips, the pause buttons, the Escape pill and the page's hint take it as their unit, 1px until it is known.
    assert.match(shell, /\.px16\.zelda-deck-top,\s*\.px16\.zelda-deck,\s*\.px16\.esc-hold-layer,\s*\.zelda-canvas\.px16 ~ \.portal-hint \{\s*--px16-u: var\(--px16-fine, 1px\);/)
    // A selector's own rule: the one where it stands alone, right after another rule or a comment.
    const rule = sel => {
      const at = Math.max(shell.indexOf(`}\n${sel} {`), shell.indexOf(`*/\n${sel} {`))
      assert.ok(at > 0, `${sel} has a rule`)
      return shell.slice(at + 2, shell.indexOf('\n}', at + 2))
    }
    for (const sel of ['.px16 .zelda-chip', '.px16 .zelda-pad-wide', '.zelda-canvas.px16 ~ .portal-hint', '.px16.esc-hold-layer .esc-hold-pill']) {
      assert.match(rule(sel), /font-size: calc\(16 \* var\(--px16-u\)\);/, `${sel}: sixteen units to the em, the canvas font's size`)
      // Its letters, its padding and its frame are so many units, never a fixed number of px.
      for (const line of rule(sel).split('\n').filter(l => /^\s*(font-size|line-height|padding|gap|border|border-radius):/.test(l))) assert.doesNotMatch(line, /\dpx/, `${sel}: ${line.trim()}`)
    }
    // The panels stay at one CSS px: they set no unit of their own.
    for (const f of ['themes/zelda/LookBooth.vue', 'themes/zelda/AccountConsole.vue', 'themes/zelda/NewsStand.vue']) assert.doesNotMatch(read(f), /--px16-(u|fine)\s*:/, f)
  })

  it('takes the page\'s hint away while the game is paused, in every view', () => {
    assert.match(shell, /\.zelda-canvas--paused ~ \.portal-hint \{\s*visibility: hidden;\s*\}/)
  })

  it('dresses nothing of its own outside the scope', () => {
    // Everything after the dress's heading in each file's styles is scoped; what is before it is the classic look, untouched.
    for (const f of ['themes/zelda/Zelda.vue', 'themes/zelda/LookBooth.vue', 'themes/zelda/AccountConsole.vue', 'themes/zelda/NewsStand.vue']) {
      const src = read(f)
      const at = src.indexOf(' * The 16-bit dress')
      assert.ok(at > 0, `${f} has its 16-bit block`)
      const block = src.slice(at, src.lastIndexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[^{}]*\*\//, '').replace(/@media[^{]+\{/g, '')
      for (const m of block.matchAll(/(^|\})\s*([^{}@]+)\{/g)) {
        for (const s of m[2].split(',')) assert.match(s, /\.px16\b/, `${f}: "${s.trim()}"`)
      }
    }
  })
})
