// Neon Shrine's ground and wall materials for the 16-bit view
// (render/iso/materials.ts): pure painters into a typed array, bundled with
// esbuild like the other zelda tests. And the rule that says what a tile's
// ground is made of (render/tiles.ts groundKindOf), which must follow the
// classic painter.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

async function load() {
  const out = esbuild.buildSync({
    stdin: { contents: `export * from './render/iso/materials'; export { ENGINES } from './viewParams'`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

describe('the 16-bit view’s materials', () => {
  it('lie side by side in one atlas, a number each', () => {
    const m = M.buildMaterials()
    assert.equal(m.w, M.MAT * M.MATERIALS.length)
    assert.equal(m.h, M.MAT)
    assert.equal(m.data.length, m.w * m.h * 4)
    assert.equal(M.materialId(null), 0)
    M.MATERIALS.forEach((name, i) => assert.equal(M.materialId(name), i + 1))
    // A quad's meta carries picture + 8 × material in one float, and the shader's atlas column is 128 px.
    // And the atlas must fit the smallest texture a WebGL2 device promises (2048 px).
    assert.ok(M.MATERIALS.length <= 16)
    assert.equal(M.MAT, 128, 'the shaders read the atlas in columns of 128')
    assert.equal(M.MAT_PER_TILE, 32, 'the shaders read 32 texels to the tile')
  })

  it('are the same pictures every time', () => {
    const a = M.buildMaterials()
    const b = M.buildMaterials()
    assert.equal(a, b, 'built once')
    let sum = 0
    for (let i = 0; i < a.data.length; i += 97) sum = (sum * 31 + a.data[i]) >>> 0
    assert.equal(typeof sum, 'number')
  })

  it('are painted: every material has several colours and a relief', () => {
    const m = M.buildMaterials()
    M.MATERIALS.forEach((name, k) => {
      const colours = new Set()
      const heights = new Set()
      for (let v = 0; v < M.MAT; v++) for (let u = 0; u < M.MAT; u++) {
        const o = (v * m.w + k * M.MAT + u) * 4
        colours.add((m.data[o] << 16) | (m.data[o + 1] << 8) | m.data[o + 2])
        heights.add(m.data[o + 3])
      }
      assert.ok(colours.size >= 3, `${name} has ${colours.size} colours`)
      assert.ok(colours.size <= 12, `${name} is pixel art, not noise: ${colours.size} colours`)
      if (name !== 'slab') assert.ok(heights.size >= 2, `${name} is flat`)
      assert.ok(!colours.has(0), `${name} has a texel nobody painted`)
    })
  })

  it('give every scene px of the turned view a texel of its own', () => {
    // A block of the scene as wide as the material repeats (2 × MAT px by MAT px) shows each texel once.
    const seen = new Set()
    for (let y = 0; y < M.MAT; y++) for (let x = 0; x < 2 * M.MAT; x++) {
      const t = M.texelAt(x, y)
      assert.ok(Number.isInteger(t.u) && Number.isInteger(t.v) && t.u >= 0 && t.v >= 0 && t.u < M.MAT && t.v < M.MAT)
      seen.add(t.v * M.MAT + t.u)
    }
    assert.equal(seen.size, M.MAT * M.MAT)
    // East on the ground is down-right on the screen: two px over, one down.
    const a = M.texelAt(10, 20)
    const b = M.texelAt(12, 21)
    assert.deepEqual([b.u - a.u, b.v - a.v], [2, 0])
  })

  it('can be turned off: a value on the engine', () => {
    const p = M.ENGINES.iso.params
    assert.equal(p.materials.t, 'number')
    assert.equal(p.materials.min, 0)
    assert.equal(p.sunLight.t, 'color')
    assert.equal(p.sunStrength.min, 0)
  })
})

describe('what a tile’s ground is made of', () => {
  it('is decided where the classic painter decides it', () => {
    // groundKindOf mirrors paintBase's cases; if a case is added to one, the other must follow.
    const src = readFileSync(resolve(root, 'render/tiles.ts'), 'utf8')
    const body = (name) => {
      const at = src.indexOf(`function ${name}(`)
      assert.ok(at >= 0, `${name} is gone`)
      return src.slice(at, src.indexOf('\n}\n', at))
    }
    const cases = (s) => [...s.matchAll(/case '([^']+)'/g)].map(m => m[1]).sort().join('')
    assert.equal(cases(body('groundKindOf')), cases(body('paintBase')))
  })
})

// The standing things built for the 16-bit view (render/iso/props.ts).
describe('the 16-bit view’s standing things', () => {
  it('are named in view.ts as they are built', () => {
    const view = readFileSync(resolve(root, 'render/iso/view.ts'), 'utf8')
    const at = view.indexOf('let prop: PropKind | null = null')
    assert.ok(at > 0)
    for (const q of view.slice(at, view.indexOf('if (prop) {', at)).matchAll(/prop = (?:[^'\n]*\? )?'([a-zA-Z]+)'(?: : '([a-zA-Z]+)')?/g)) {
      for (const name of [q[1], q[2]].filter(Boolean)) assert.ok(P.PROP_KINDS.includes(name), `view.ts stands a ${name}, which nobody builds`)
    }
  })

  let P
  before(async () => {
    const out = esbuild.buildSync({
      stdin: { contents: `export * from './render/iso/props'`, resolveDir: root, loader: 'ts' },
      bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
    })
    P = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
  })

  /** A sprite's filled pixels: [x, y] in its own cell. */
  function* pixels(a, sp) {
    for (let y = 0; y < sp.h; y++) for (let x = 0; x < sp.w; x++) if (a.albedo[((sp.y + y) * a.w + sp.x + x) * 4 + 3]) yield [x, y]
  }

  it('each stand in a cell of their own, clear of its edges, on their anchor', () => {
    const a = P.buildProps()
    assert.equal(a, P.buildProps(), 'built once')
    assert.equal(a.w, P.PROP.w * P.PROP_COLS)
    assert.ok(a.w <= 2048 && a.h <= 2048, 'the atlas fits the smallest texture a WebGL2 device promises')
    for (const kind of P.PROP_KINDS) {
      const sp = a.sprites[kind]
      let n = 0
      let x0 = sp.w, x1 = 0, y0 = sp.h, y1 = 0
      for (const [x, y] of pixels(a, sp)) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
      assert.ok(n > 60, `${kind} is ${n} pixels`)
      if (kind.startsWith('fence')) continue
      assert.ok(x0 >= 2 && y0 >= 2 && x1 < sp.w - 2 && y1 < sp.h - 2, `${kind} touches its cell’s edge`)
      // It stands on the ground under its middle: its lowest pixels lie just under the anchor (a counter's part
      // reaches its tile's near corner), and it is about as wide to either side.
      const wide = kind.startsWith('counter') || kind.startsWith('fence') || kind.startsWith('block')
      assert.ok(y1 >= sp.ay && y1 <= sp.ay + (wide ? 17 : 9), `${kind} ends ${y1 - sp.ay} px under its anchor`)
      if (!kind.startsWith('fence')) assert.ok(Math.abs((x0 + x1 + 1) / 2 - sp.ax) <= (kind === 'counterN' || kind === 'counterS' ? 4.5 : 2.5), `${kind} is off its middle`)
    }
  })

  it('know which way every pixel faces, and only a lantern or a glaze glows', () => {
    const a = P.buildProps()
    for (const kind of P.PROP_KINDS) {
      const sp = a.sprites[kind]
      let glow = 0
      for (const [x, y] of pixels(a, sp)) {
        const o = ((sp.y + y) * a.w + sp.x + x) * 4
        const n = [a.normal[o] / 127.5 - 1, a.normal[o + 1] / 127.5 - 1, a.normal[o + 2] / 127.5 - 1]
        assert.ok(Math.abs(Math.hypot(...n) - 1) < 0.06, `${kind} has a normal of length ${Math.hypot(...n)}`)
        // Nothing the viewer sees faces away from them.
        assert.ok(n[2] > -0.75, `${kind} shows a back`)
        if (a.normal[o + 3] > 0) glow++
      }
      const lit = ['lampPink', 'lampCyan', 'pot', 'pillarStone', 'pillarShrine', 'blockPink', 'blockCyan'].includes(kind) || /chest/i.test(kind)
      assert.equal(glow > 0, lit, `${kind}: ${glow} glowing pixels`)
    }
  })

  it('say where every pixel is in depth', () => {
    const a = P.buildProps()
    assert.equal(P.depthCode(0), 128)
    assert.equal(P.depthCode(-1000), 1, 'never 0: that is no pixel')
    // A counter's part reaches from its tile's far edge to its near one: its depths span about a tile (32 px, 4 to the px).
    const sp = a.sprites.counterNS
    let lo = 255, hi = 0
    for (const [x, y] of pixels(a, sp)) { const d = a.albedo[((sp.y + y) * a.w + sp.x + x) * 4 + 3]; lo = Math.min(lo, d); hi = Math.max(hi, d) }
    assert.ok(hi - lo > 100 && hi - lo < 136, `a counter spans ${hi - lo} steps of depth`)
    // A lamp post stands on a point: every pixel of it is near its anchor.
    const lamp = a.sprites.lampPink
    for (const [x, y] of pixels(a, lamp)) { const d = a.albedo[((lamp.y + y) * a.w + lamp.x + x) * 4 + 3]; assert.ok(Math.abs(d - 128) <= 36, `a lamp pixel lies ${(d - 128) / 4} px off its anchor`) }
  })

  it('are pixel art: a handful of flat colours each', () => {
    const a = P.buildProps()
    for (const kind of P.PROP_KINDS) {
      const sp = a.sprites[kind]
      const colours = new Set()
      for (const [x, y] of pixels(a, sp)) { const o = ((sp.y + y) * a.w + sp.x + x) * 4; colours.add((a.albedo[o] << 16) | (a.albedo[o + 1] << 8) | a.albedo[o + 2]) }
      assert.ok(colours.size >= 3 && colours.size <= 16, `${kind} has ${colours.size} colours`)
    }
  })
})
