// Neon Shrine's light and life in the lands (docs/games/neon-shrine-looks.md, "Light and life"): the
// landmarks' lights name tones the render side knows, a lit letter shines only with its flag, the night
// factor runs from the dusk to the moon's hours, and the life in the air holds still under reduced motion.
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
      contents: `export { sceneryAt, sceneryPlaces } from './world/scenery'
export { TONES } from './render/tones'
export { MOOD, REALM_LOOKS, realmLook } from './render/looks'
export { nightOf } from './render/daylight'
export { realmLife } from './render/iso/air'
export { buildBackdrop } from './render/iso/backdrop'
export { WORLD } from './world/index'
export { drawLiveTiles } from './render/tiles'
export { createGame } from './engine/index'
export { enterMap } from './engine/game'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let L
before(async () => { L = await load() })

/** A 2D context that only counts what is drawn. */
function counter() {
  const g = { n: 0, globalAlpha: 1, fillStyle: '', fillRect() { g.n++ } }
  return g
}

/** Every landmark the world's maps place now, and every place preset the lands will be drawn with. */
function landmarks() {
  const all = []
  for (const d of Object.values(L.WORLD.maps)) for (const lm of d.isoLandmarks ?? []) all.push(lm)
  const ps = L.sceneryPlaces()
  assert.ok(ps.length > 30, `${ps.length} presets found in world/scenery.ts`)
  for (const [realm, place] of ps) for (const lm of L.sceneryAt(realm, place, 0, 0)) all.push(lm)
  return all
}

describe('the lands’ light', () => {
  it('lands its landmarks’ lights in tones the render side has, and lit-only lights on lit landmarks', () => {
    const lms = landmarks()
    const lit = lms.filter(lm => lm.lights?.length)
    assert.ok(lit.length > 20, `only ${lit.length} landmarks carry a light`)
    for (const lm of lit) {
      for (const l of lm.lights) {
        assert.match(L.TONES[l.tone] ?? '', /^#[0-9a-f]{6}$/, `${lm.art}: tone ${l.tone}`)
        assert.ok(l.r > 0 && l.r <= 8 && l.a > 0 && l.a <= 1, `${lm.art}: r ${l.r}, a ${l.a}`)
        if (l.lit) assert.ok(lm.lit, `${lm.art} shines only when lit, but has no lit flag`)
      }
    }
    // The beams: the stage spotlights swing theirs (a preset until the fog stage is drawn).
    const sweeps = new Set(lit.filter(lm => lm.lights.some(l => l.anim === 'sweep')).map(lm => lm.art.replace(/_\d+$/, '')))
    assert.ok(sweeps.has('fogstage_spotlight'), [...sweeps].join(','))
  })

  it('gives every realm look its lamps, its shafts’ colour and its life', () => {
    for (const look of L.REALM_LOOKS) {
      const m = L.MOOD[look]
      assert.ok(m.lamps > 0 && m.glow > 0, look)
      for (const c of [...m.lamp, m.raysColor]) assert.match(c, /^#[0-9a-f]{6}$/, `${look}: ${c}`)
      assert.ok(Array.isArray(m.life), look)
      assert.ok(m.hero >= 0 && m.hero <= 1, look)
    }
  })

  it('lets the giant caps light the moss only at the wood’s edge, a score at most in view', () => {
    // (Whatever the tiles draw goes to a context that takes anything; the sprites to a stand-in canvas.)
    const had = globalThis.document
    const any = new Proxy({}, { get: (_, k) => k === 'canvas' ? { width: 16, height: 16 } : k === 'getImageData' || k === 'createImageData' ? () => ({ data: new Uint8ClampedArray(1024) }) : typeof k === 'string' && /^[a-z]/.test(k) && !/Style$|Alpha$|^font$|^line/.test(k) ? () => any : undefined, set: () => true })
    globalThis.document = { createElement: () => ({ width: 16, height: 16, getContext: () => any }) }
    try {
      let seen = 0
      const check = (id, s) => {
        const m = s.map
        // Every window of the view across the map: no frame pushes more than a score of the caps' pools.
        for (let cy = 0; cy + 20 <= m.h; cy += 10) for (let cx = 0; cx + 30 <= m.w; cx += 15) {
          const lights = []
          L.drawLiveTiles(any, L.WORLD, s, cx * 16, cy * 16, 30 * 16, 20 * 16, 1, lights, false)
          const pools = lights.filter(l => l.r === 2.3 && (l.color === '#3ad0d8' || l.color === '#c87ae0'))
          assert.ok(pools.length <= 20, `${id} at ${cx},${cy}: ${pools.length} cap pools`)
          for (const p of pools) {
            const tx = Math.floor(p.x)
            const ty = Math.floor(p.y + 0.2)
            const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const t = m.tiles[(ty + dy) * m.w + tx + dx]; return t !== undefined && t !== 'T' })
            assert.ok(open, `${id}: a cap pool at ${tx},${ty} deep in the wood`)
          }
          seen += pools.length
        }
      }
      let spores = 0
      for (const [id, def] of Object.entries(L.WORLD.maps)) {
        if (L.realmLook(def.look) !== 'spore') continue
        spores++
        const s = L.createGame(L.WORLD, { seed: 1 })
        L.enterMap(L.WORLD, s, id, '', [], { x: 1.5, y: 1.5 })
        check(id, s)
      }
      assert.ok(spores > 0, 'no map with the spore look')
      // A wood laid over a spore land (the authored lands may have none yet): a thick stand with clearings.
      const w = L.createGame(L.WORLD, { seed: 1 })
      const sid = Object.keys(L.WORLD.maps).find(id => L.realmLook(L.WORLD.maps[id].look) === 'spore')
      L.enterMap(L.WORLD, w, sid, '', [], { x: 1.5, y: 1.5 })
      for (let y = 4; y < 36; y++) for (let x = 4; x < 80; x++) w.map.tiles[y * w.map.w + x] = (x % 9 < 4 || y % 7 < 3) ? 'T' : '.'
      check(`${sid} (wooded)`, w)
      assert.ok(seen > 0, 'no cap lit the moss in a wood')
    } finally { globalThis.document = had }
  })

  it('reckons the night from the dusk (none) to the moon’s hours (all)', () => {
    assert.equal(L.nightOf(null), 0)
    assert.equal(L.nightOf({ sun: 0.12 }), 0)
    assert.equal(L.nightOf({ sun: 1 }), 0)
    assert.equal(L.nightOf({ sun: -1 }), 1)
    let last = -1
    for (let sun = 0.2; sun >= -1; sun -= 0.05) { const n = L.nightOf({ sun }); assert.ok(n >= last); last = n }
  })

  it('puts shooting stars in the realm skies, dimmed by day as the stars are, and lets the aurora breathe', () => {
    // (The backdrop paints into canvases: a stand-in that keeps the pixels.)
    const had = globalThis.document
    globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) }
    try {
      for (const look of L.REALM_LOOKS) {
        const b = L.buildBackdrop(look, 640, 400)
        const streaks = b.layers.filter(l => l.streak)
        assert.equal(streaks.length, 2, `${look}: ${streaks.length} shooting stars`)
        for (const l of streaks) {
          assert.equal(l.role, 'stars')
          assert.ok(l.streak.on < l.streak.every / 5, 'a shooting star is there only for a moment')
        }
        assert.equal(b.layers.some(l => l.role === 'aurora'), look === 'snow')
      }
    } finally { globalThis.document = had }
  })

  it('keeps the life in the air still under reduced motion, and lights the water with lanterns', () => {
    const water = (x, y) => (x + y) % 9 < 6 ? '~' : '.'
    const view = { place: (x, y, z) => ({ x: x * 8, y: y * 8 - z * 8 }), tile: water, x0: 0, y0: 0, x1: 40, y1: 40, vw: 320, vh: 200, px: 0.5 }
    const all = ['lanterns', 'glints', 'butterflies', 'birds', 'gulls', 'fish']
    // The time stands at 0: what comes and goes (glints, birds, jumps) is not there, the rest is drawn the same each frame.
    const a = counter(); const la = []
    L.realmLife(a, all, view, 0, la)
    const b = counter(); const lb = []
    L.realmLife(b, all, view, 0, lb)
    assert.equal(a.n, b.n)
    assert.deepEqual(la, lb)
    const still = counter()
    L.realmLife(still, ['glints', 'birds', 'gulls', 'fish'], view, 0, [])
    assert.equal(still.n, 0, 'glints, birds and fish are not drawn under reduced motion')
    // Lanterns rise off the water only, each with a light that hangs where it is.
    const lights = []
    L.realmLife(counter(), ['lanterns'], view, 12.5, lights)
    assert.ok(lights.length > 0, 'no lanterns over the water')
    for (const l of lights) {
      assert.equal(typeof l.z, 'number')
      assert.equal(l.color, '#ffb13f')
    }
    const dry = []
    L.realmLife(counter(), ['lanterns'], { ...view, tile: () => '.' }, 12.5, dry)
    assert.equal(dry.length, 0, 'lanterns over dry land')
  })
})
