// The hero's look (the NEW LOOK stall on the square): the frames per shape,
// the look's colours as a palette, storage and the booth's choices. Pure
// modules, bundled with esbuild like the other zelda tests.
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
        `export { heroPalette } from './render/heroColors'`,
        `export { SPRITES, PAL } from './render/sprites'`,
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
  it('are the drawn hero, pixel for pixel, for the drawn shape', () => {
    const frames = M.heroFrames(M.DRAWN_SHAPE)
    assert.deepEqual(Object.keys(frames).sort(), Object.keys(DRAWN).sort())
    for (const [name, rows] of Object.entries(DRAWN)) assert.deepEqual(frames[name], rows, name)
  })

  it('are what the sprite sheet holds', () => {
    for (const [name, rows] of Object.entries(DRAWN)) assert.deepEqual(M.SPRITES[name].rows, rows, name)
  })

  it('come in every shape: the same frames, 16 by 16, in the hero\'s letters only', () => {
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
  })

  it('differ where the shape says so, in every direction', () => {
    const base = M.heroFrames(M.DRAWN_SHAPE)
    const differs = (shape, name) => assert.notDeepEqual(M.heroFrames({ ...M.DRAWN_SHAPE, ...shape })[name], base[name], `${JSON.stringify(shape)} ${name}`)
    for (const dir of ['down', 'up', 'side']) {
      for (const hair of ['long', 'tail', 'pigtails']) differs({ hair }, `hero_${dir}_0`)
      for (const head of ['bow', 'none']) differs({ head }, `hero_${dir}_0`)
      for (const bottom of ['shorts', 'skirt']) for (const f of ['0', '1', '2', 'atk', 'carry_0', 'push']) differs({ bottom }, `hero_${dir}_${f}`)
    }
    for (const name of ['hero_get', 'hero_hurt', 'hero_dead', 'hero_fall_0']) {
      differs({ hair: 'long' }, name)
      differs({ bottom: 'skirt' }, name)
    }
    // A dress is the skirt's cut; its colour is the palette's business.
    assert.deepEqual(M.heroFrames({ ...M.DRAWN_SHAPE, bottom: 'dress' }), M.heroFrames({ ...M.DRAWN_SHAPE, bottom: 'skirt' }))
  })

  it('never lose the face, the feet or the outline', () => {
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
  })
})

describe('the hero\'s look', () => {
  it('as drawn has the sprite sheet\'s own colours', () => {
    const pal = M.lookPalette(M.DRAWN_LOOK)
    for (const [letter, hex] of Object.entries(pal)) assert.equal(hex, M.PAL[letter], `letter ${letter}`)
    assert.deepEqual(Object.keys(pal).sort(), [...'BCEHSchpswy'].sort())
  })

  it('shades a changed colour from the colour itself', () => {
    const pal = M.lookPalette({ ...M.DRAWN_LOOK, hairColor: '#ffd23f', skin: '#80492b', top: '#ff3b5c' })
    for (const k of ['H', 'S', 'C']) {
      assert.match(pal[k], /^#[0-9a-f]{6}$/)
      assert.notEqual(pal[k], M.PAL[k], `shade ${k} is still the drawn one`)
    }
    assert.notEqual(pal.H, pal.h)
    assert.notEqual(pal.S, pal.s)
    assert.notEqual(pal.C, pal.c)
  })

  it('wears a dress in the shirt\'s colour and a skirt in its own', () => {
    assert.equal(M.lookPalette({ ...M.DRAWN_LOOK, bottom: 'dress', top: '#ff2fa0', bottomColor: '#b6ff4a' }).B, '#ff2fa0')
    assert.equal(M.lookPalette({ ...M.DRAWN_LOOK, bottom: 'skirt', top: '#ff2fa0', bottomColor: '#b6ff4a' }).B, '#b6ff4a')
  })

  it('has a girl: long hair, a bow and a skirt on the same hero', () => {
    assert.deepEqual([M.GIRL_LOOK.hair, M.GIRL_LOOK.head, M.GIRL_LOOK.bottom], ['long', 'bow', 'skirt'])
    for (const k of ['skin', 'hairColor', 'headColor', 'top', 'stripe', 'belt', 'shoes']) assert.equal(M.GIRL_LOOK[k], M.DRAWN_LOOK[k], k)
    assert.ok(M.parseHeroLook(M.serializeHeroLook(M.GIRL_LOOK)))
  })

  it('goes into storage and comes back whole, and anything else is no look', () => {
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
  })

  it('lists every part of the hero, and every choice is a real one', () => {
    assert.deepEqual(M.LOOK_OPTIONS.map(o => o.key), ['hair', 'hairColor', 'head', 'headColor', 'skin', 'top', 'stripe', 'belt', 'bottom', 'bottomColor', 'shoes'])
    for (const o of M.LOOK_OPTIONS) {
      assert.ok(o.choices.length >= 3, `${o.key}: ${o.choices.length} choices`)
      assert.equal(new Set(o.choices.map(c => c.v)).size, o.choices.length, `${o.key}: a value twice`)
      assert.equal(new Set(o.choices.map(c => c.name)).size, o.choices.length, `${o.key}: a name twice`)
      // The drawn hero and the girl are among the choices, so the booth can name what they wear.
      for (const look of [M.DRAWN_LOOK, M.GIRL_LOOK]) assert.ok(M.choiceIndex(look, o) >= 0, `${o.key}: ${look[o.key]} is not a choice`)
      for (const c of o.choices) {
        assert.match(c.name, /^[A-Z ]+$/)
        assert.ok(M.parseHeroLook({ ...M.DRAWN_LOOK, [o.key]: c.v }), `${o.key}: ${c.v}`)
      }
    }
  })

  it('steps a part round and round, and from a colour of its own onto the list', () => {
    for (const o of M.LOOK_OPTIONS) {
      let look = M.DRAWN_LOOK
      const seen = new Set()
      for (let k = 0; k < o.choices.length; k++) { seen.add(look[o.key]); look = M.stepLook(look, o.key, 1) }
      assert.equal(seen.size, o.choices.length, `${o.key}: stepping misses a choice`)
      assert.deepEqual(look, M.DRAWN_LOOK, `${o.key}: not back where it started`)
      assert.deepEqual(M.stepLook(M.stepLook(M.DRAWN_LOOK, o.key, 1), o.key, -1), M.DRAWN_LOOK)
    }
    const own = { ...M.DRAWN_LOOK, top: '#123456' }
    const shirt = M.LOOK_OPTIONS.find(o => o.key === 'top')
    assert.equal(M.choiceName(own, shirt), 'YOUR OWN')
    assert.equal(M.stepLook(own, 'top', 1).top, shirt.choices[0].v)
    assert.equal(M.stepLook(own, 'top', -1).top, shirt.choices.at(-1).v)
  })

  it('leaves out the colour of what is not worn', () => {
    assert.equal(M.optionApplies({ ...M.DRAWN_LOOK, head: 'none' }, 'headColor'), false)
    assert.equal(M.optionApplies({ ...M.DRAWN_LOOK, bottom: 'dress' }, 'bottomColor'), false)
    for (const o of M.LOOK_OPTIONS) assert.equal(M.optionApplies(M.DRAWN_LOOK, o.key), true, o.key)
  })

  it('takes a made figure\'s colours as the drawn shape in those clothes', () => {
    const figure = { skin: '#e6a57e', skinShade: '#b0704e', hair: '#ffd23f', hairShade: '#c4861c', band: '#2ff3ff', top: '#ff3b5c', topShade: '#9e1638', topAccent: '#fff4ff', bottom: '#2f5fd0', shoes: '#1c1030' }
    const look = M.lookFromColors(figure)
    assert.deepEqual([look.hair, look.head, look.bottom], ['short', 'band', 'trousers'])
    assert.deepEqual([look.skin, look.hairColor, look.headColor, look.top, look.stripe, look.bottomColor, look.shoes],
      [figure.skin, figure.hair, figure.band, figure.top, figure.topAccent, figure.bottom, figure.shoes])
    assert.equal(look.belt, M.heroPalette(figure).y)
    assert.ok(M.parseHeroLook(look))
  })

  it('rolls a random look from the booth\'s own choices', () => {
    let seed = 1
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const seen = new Set()
    for (let k = 0; k < 60; k++) {
      const look = M.randomLook(rnd)
      assert.ok(M.parseHeroLook(look))
      for (const o of M.LOOK_OPTIONS) assert.ok(M.choiceIndex(look, o) >= 0, o.key)
      seen.add(M.heroLookKey(look))
    }
    assert.ok(seen.size > 50, 'the dice are stuck')
  })
})
