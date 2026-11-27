// The hero's look (the NEW LOOK stall on the square): the drawn hero's frames,
// every shape's, a look kept in storage, and the booth's choices. Pure modules,
// bundled with esbuild like the other zelda tests.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../themes/zelda')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './render/heroFrames'`,
        `export * from './render/heroLook'`,
        `export { SPRITES } from './render/sprites'`,
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

/** The hero as first drawn, frame by frame (written out before the frames became a function of the shape). */
const DRAWN = JSON.parse(readFileSync(resolve(here, 'zelda-hero-drawn.json'), 'utf8'))
/** The letters a hero frame may use: transparent, outline, hair, headwear, skin, shirt, stripe, belt, below, shoes, mouth. */
const LETTERS = new Set('.khHpsScCwyBEM')

function shapes() {
  const out = []
  for (const hair of M.HAIR_STYLES) for (const head of M.HEADWEAR) for (const bottom of M.BOTTOMS) out.push({ hair, head, bottom })
  return out
}

describe('the hero\'s frames', () => {
  it('are the drawn hero, pixel for pixel, for the drawn shape, and what the sprite sheet holds', () => {
    const frames = M.heroFrames(M.DRAWN_SHAPE)
    assert.deepEqual(Object.keys(frames).sort(), Object.keys(DRAWN).sort())
    for (const [name, rows] of Object.entries(DRAWN)) assert.deepEqual(frames[name], rows, name)
    for (const [name, rows] of Object.entries(DRAWN)) assert.deepEqual(M.SPRITES[name].rows, rows, `the sheet: ${name}`)
  })

  it('come in every shape: the same frames, 16 by 16, in the hero\'s letters, never without face, feet or floor', () => {
    assert.equal(shapes().length, 48)
    for (const shape of shapes()) {
      const frames = M.heroFrames(shape)
      const tag = JSON.stringify(shape)
      assert.deepEqual(Object.keys(frames), [...M.HERO_FRAMES], tag)
      for (const [name, rows] of Object.entries(frames)) {
        assert.equal(rows.length, 16, `${tag} ${name}: ${rows.length} rows`)
        for (const r of rows) {
          assert.equal(r.length, 16, `${tag} ${name}: a row of ${r.length}`)
          for (const ch of r) assert.ok(LETTERS.has(ch), `${tag} ${name}: letter '${ch}'`)
        }
      }
    }
    // The face, the feet, and standing frames reaching the bottom row, where the renderer puts the feet.
    {
      for (const shape of shapes()) {
        const frames = M.heroFrames(shape)
        for (const name of ['hero_down_0', 'hero_side_0', 'hero_get']) {
          const text = frames[name].join('')
          assert.ok(text.includes('s'), `${JSON.stringify(shape)} ${name}: no skin`)
          assert.ok(frames[name][14].includes('E'), `${JSON.stringify(shape)} ${name}: no shoes`)
        }
        // Standing frames reach the bottom row, where the renderer puts the feet.
        for (const name of ['hero_down_0', 'hero_up_0', 'hero_side_0']) assert.ok(frames[name][15].includes('k'), `${JSON.stringify(shape)} ${name}: floats`)
      }
    }
  })
})

describe('the hero\'s look', () => {
  it('goes into storage and comes back whole, anything else is no look, and the newest of look and figure is worn', () => {
    for (const look of [M.DRAWN_LOOK, M.GIRL_LOOK, M.randomLook(() => 0.999), M.randomLook(() => 0)]) {
      assert.deepEqual(M.parseHeroLook(M.serializeHeroLook(look)), look)
    }
    assert.deepEqual(M.parseHeroLook({ ...M.DRAWN_LOOK, top: '#ABCDEF', extra: 1 }), { ...M.DRAWN_LOOK, top: '#abcdef' })
    for (const bad of [null, undefined, '', 'nope', '{}', '[]', 7,
      { ...M.DRAWN_LOOK, hair: 'mullet' }, { ...M.DRAWN_LOOK, head: 'crown' }, { ...M.DRAWN_LOOK, bottom: 'kilt' },
      { ...M.DRAWN_LOOK, skin: 'red' }, { ...M.DRAWN_LOOK, top: '#fff' }, { ...M.DRAWN_LOOK, shoes: undefined }]) {
      assert.equal(M.parseHeroLook(bad), null, JSON.stringify(bad))
    }
    assert.equal(M.HERO_LOOK_KEY, 'zelda.heroLook')
    {
      const figure = { skin: '#e6a57e', skinShade: '#b0704e', hair: '#ffd23f', hairShade: '#c4861c', band: '#2ff3ff', top: '#ff3b5c', topShade: '#9e1638', topAccent: '#fff4ff', bottom: '#2f5fd0', shoes: '#1c1030' }
      const remade = { ...figure, top: '#b6ff4a' }
      // Chosen with no figure about: worn; a figure made afterwards is the newer choice.
      const alone = M.storeHeroLook(M.GIRL_LOOK, null)
      assert.deepEqual(M.wornLook(alone, null), M.GIRL_LOOK)
      assert.equal(M.wornLook(alone, figure), null)
      // Chosen over a figure: worn while that figure stands, also in another tab or after a reload.
      const over = M.storeHeroLook(M.GIRL_LOOK, figure)
      assert.deepEqual(M.wornLook(over, figure), M.GIRL_LOOK)
      assert.deepEqual(M.wornLook(over, { ...figure }), M.GIRL_LOOK)
      // The figure made over: its clothes again. The figure gone: the look stays.
      assert.equal(M.wornLook(over, remade), null)
      assert.deepEqual(M.wornLook(over, null), M.GIRL_LOOK)
      // What is stored is still a look, and junk is none.
      assert.deepEqual(M.parseHeroLook(over), M.GIRL_LOOK)
      for (const bad of [null, '', 'nope', '{}']) assert.equal(M.wornLook(bad, figure), null)
      // A stored look that never noted a figure is older than any figure.
      assert.equal(M.wornLook(M.serializeHeroLook(M.GIRL_LOOK), figure), null)
      assert.deepEqual(M.wornLook(M.serializeHeroLook(M.GIRL_LOOK), null), M.GIRL_LOOK)
    }
  })

  it('steps every part round and round through real choices, from a colour of its own onto the list, and rolls looks from them', () => {
    for (const o of M.LOOK_OPTIONS) {
      let look = M.DRAWN_LOOK
      const seen = new Set()
      for (let k = 0; k < o.choices.length; k++) { seen.add(look[o.key]); look = M.stepLook(look, o.key, 1) }
      assert.equal(seen.size, o.choices.length, `${o.key}: stepping misses a choice`)
      assert.deepEqual(look, M.DRAWN_LOOK, `${o.key}: not back where it started`)
      assert.deepEqual(M.stepLook(M.stepLook(M.DRAWN_LOOK, o.key, 1), o.key, -1), M.DRAWN_LOOK)
      // The drawn hero and the girl are among the choices, so the booth can name what they wear; every choice is a look.
      for (const look of [M.DRAWN_LOOK, M.GIRL_LOOK]) assert.ok(M.choiceIndex(look, o) >= 0, `${o.key}: ${look[o.key]} is not a choice`)
      for (const c of o.choices) assert.ok(M.parseHeroLook({ ...M.DRAWN_LOOK, [o.key]: c.v }), `${o.key}: ${c.v}`)
    }
    const own = { ...M.DRAWN_LOOK, top: '#123456' }
    const shirt = M.LOOK_OPTIONS.find(o => o.key === 'top')
    assert.equal(M.choiceName(own, shirt), 'YOUR OWN')
    assert.equal(M.stepLook(own, 'top', 1).top, shirt.choices[0].v)
    assert.equal(M.stepLook(own, 'top', -1).top, shirt.choices.at(-1).v)
    // Random looks come from the choices.
    {
      let seed = 1
      const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
      const seen = new Set()
      for (let k = 0; k < 10; k++) {
        const look = M.randomLook(rnd)
        assert.ok(M.parseHeroLook(look))
        for (const o of M.LOOK_OPTIONS) assert.ok(M.choiceIndex(look, o) >= 0, o.key)
        seen.add(M.heroLookKey(look))
      }
      assert.ok(seen.size > 8, 'the dice are stuck')
    }
  })
})
