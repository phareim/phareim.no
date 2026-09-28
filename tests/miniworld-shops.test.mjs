// Mini World's three clothes shops (2026-09-28): Klesbutikken keeps its
// wares, Glitterbutikken and Kostymebutikken sell their own; every new
// shape has a builder and draws on a person and on its own (the preview);
// the tail covers the feet, the onesie the legs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { load } from './miniworld-load.mjs'

const m = await load()
const { catalog } = m

// ---- the scene modules, bundled like miniworld-models.test.mjs (a canvas that accepts every call)
const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'miniworld')
const noop = () => {}
const ctx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined : noop), set: () => true })
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) }
const out = esbuild.buildSync({
  stdin: {
    contents: [
      `export { SHAPE_BUILDERS, HAT_BUILDERS, FACE_BUILDERS, buildBack, legPieces, bodyLift, hatHides, PartSet } from './scene/clothes'`,
      `export { buildAvatar, buildClothingModel } from './scene/avatar'`,
    ].join('; '),
    resolveDir: root,
    loader: 'ts',
  },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  mainFields: ['module', 'main'],
})
const S = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

/** Klesbutikken's wares before the two new shops opened; they stay as they were. */
const KLESBUTIKKEN = [
  'tank-lime', 'stripes-top', 'hoodie-pink', 'football-shirt', 'jacket-denim', 'sweater-winter', 'dress-flower', 'rainbow-sweater',
  'dress-party', 'tiger-top', 'knight-top', 'space-suit', 'princess-gown', 'shorts-denim', 'shorts-sport', 'skirt-pink', 'leggings-dots',
  'pants-cargo', 'skirt-tutu', 'pants-snow', 'pants-rainbow', 'pants-space', 'sandals', 'sneakers-pink', 'boots-rain', 'boots-winter',
  'shoes-party', 'skates', 'cap-red', 'bow-pink', 'beanie', 'party-hat', 'sun-hat', 'flower-crown', 'bunny-ears', 'cat-ears', 'wizard-hat',
  'space-helmet', 'unicorn-horn', 'tiara', 'glasses-round', 'sunglasses', 'mask-hero', 'heart-glasses', 'backpack', 'cat-tail', 'cape-red',
  'fairy-wings', 'jetpack',
]

/** The shapes added with the two shops. */
const NEW_SHAPES = {
  top: ['onesie', 'hero'],
  bottom: ['mermaid'],
  shoes: ['ballet', 'claws'],
  hat: ['pirate', 'witch', 'dino', 'antennae', 'headphones', 'starcrown'],
  face: ['eyepatch', 'bowtie', 'necklace', 'nose'],
  back: ['bat', 'bee', 'shell'],
}

const TAGS = new Set(catalog.FASHION_TAGS.map(t => t.id))
const SLOTS = ['top', 'bottom', 'shoes', 'hat', 'face', 'back']

test('clothing ids are unique', () => {
  const ids = catalog.CLOTHES.map(c => c.id)
  assert.equal(new Set(ids).size, ids.length)
})

test('Klesbutikken keeps exactly its old wares', () => {
  assert.deepEqual(catalog.shopClothes('klær').map(c => c.id), KLESBUTIKKEN)
})

test('each new shop sells 14–18 pieces over at least four slots, in the price range', () => {
  for (const shop of ['glitter', 'kostyme']) {
    const wares = catalog.shopClothes(shop)
    assert.ok(wares.length >= 14 && wares.length <= 18, `${shop}: ${wares.length}`)
    assert.ok(new Set(wares.map(w => w.slot)).size >= 4, `${shop} slots`)
    for (const w of wares) {
      assert.equal(w.rarity, 'shop', w.id)
      assert.ok(w.price >= 15 && w.price <= 120, `${w.id} costs ${w.price}`)
    }
  }
})

test('a shop field only sits on shop pieces, and every piece is sold in exactly one shop or none', () => {
  for (const c of catalog.CLOTHES) {
    if (c.shop) assert.equal(c.rarity, 'shop', c.id)
    const sellers = ['klær', 'glitter', 'kostyme'].filter(s => catalog.shopClothes(s).includes(c))
    assert.equal(sellers.length, c.rarity === 'shop' && c.price > 0 ? 1 : 0, c.id)
  }
})

test('tags are fashion themes; every new piece has one', () => {
  for (const c of catalog.CLOTHES) {
    for (const t of c.tags) assert.ok(TAGS.has(t), `${c.id}: ${t}`)
    if (c.shop) assert.ok(c.tags.length > 0, c.id)
  }
})

test('every new shape has a builder and at least one piece wears it', () => {
  for (const slot of SLOTS) {
    for (const shape of NEW_SHAPES[slot]) {
      assert.ok(S.SHAPE_BUILDERS[slot].includes(shape), `${slot}/${shape} builder`)
      assert.ok(catalog.CLOTHES.some(c => c.slot === slot && c.shape === shape), `${slot}/${shape} in the catalog`)
    }
  }
  const count = Object.values(NEW_SHAPES).flat().length
  assert.ok(count >= 6)
})

test('new pieces are bought, worn and given like the rest', () => {
  let s = m.createPerson(m.newSave(), 'Ulrikke')
  const person = s.persons[0].id
  for (const id of ['dino-suit', 'mermaid-tail', 'dino-hood', 'pearl-necklace', 'dragon-wings', 'ballet-shoes']) {
    s = m.buyClothing(s, id)
    assert.equal(typeof s, 'object', id)
    const def = catalog.clothing(id)
    s = m.dress(s, person, def.slot, id)
    assert.equal(typeof s, 'object', id)
    assert.ok(m.isGiftable('clothing', id), id)
  }
  assert.equal(m.buyClothing(s, 'dino-suit'), 'owned')
})

test('a onesie covers the legs; a mermaid tail covers the feet unless a long top hides it', () => {
  assert.ok(catalog.coversLegs('dino-suit'))
  assert.ok(catalog.coversFeet({ top: 'tee-white', bottom: 'mermaid-tail' }))
  assert.ok(!catalog.coversFeet({ top: 'dino-suit', bottom: 'mermaid-tail' }))
  assert.ok(!catalog.coversFeet({ top: 'tee-white', bottom: 'jeans' }))
  // The catwalk shows what is visible: no bottom under a onesie.
  assert.deepEqual(m.wornPieces({ top: 'bee-suit', bottom: 'jeans', shoes: 'dino-feet', hat: 'antennae', face: null, back: 'bee-wings' }), ['bee-suit', 'dino-feet', 'antennae', 'bee-wings'])
  const hero = m.heroColorsFor({ skin: 's2', hair: 'short', hairColor: 'brown', eyes: 'dots', mouth: 'smile', cheeks: false, outfit: { top: 'dino-suit', bottom: 'jeans', shoes: 'dino-feet', hat: 'dino-hood', face: null, back: null } })
  assert.equal(hero.top, catalog.clothing('dino-suit').colors.main)
  // Neon Shrine's hero wears the fins as shoes.
  const fish = m.heroColorsFor({ skin: 's2', hair: 'short', hairColor: 'brown', eyes: 'dots', mouth: 'smile', cheeks: false, outfit: { top: 'tee-white', bottom: 'mermaid-tail', shoes: 'sneakers-white', hat: null, face: null, back: null } })
  assert.equal(fish.shoes, catalog.clothing('mermaid-tail').colors.accent)
})

test('a full costume scores stars for its theme', () => {
  const look = { skin: 's2', hair: 'short', hairColor: 'brown', eyes: 'dots', mouth: 'smile', cheeks: false, outfit: { top: 'bee-suit', bottom: 'jeans', shoes: 'dino-feet', hat: 'antennae', face: 'cat-nose', back: 'bee-wings' } }
  const score = m.scoreFashion(look, 'dyr', 7)
  assert.equal(score.matches.length, 5)
  assert.ok(score.total >= 12, `total ${score.total}`)
})

test('a mermaid tail hides shoes and skates, and grows fins instead of toes', () => {
  const base = { skin: 's2', hair: 'long', hairColor: 'blond', eyes: 'big', mouth: 'smile', cheeks: true }
  const look = { ...base, outfit: { top: 'tee-white', bottom: 'mermaid-tail', shoes: 'skates', hat: null, face: null, back: null } }
  assert.equal(S.bodyLift(look), 0)
  const ps = new S.PartSet()
  assert.equal(S.legPieces(ps, look, 1).toe, false)
  assert.ok(ps.vc.build(), 'fins')
  assert.equal(S.bodyLift({ ...look, outfit: { ...look.outfit, bottom: 'jeans' } }), 0.17)
})

test('every new-shop piece builds on a person (all poses) and on its own', () => {
  const base = { skin: 's4', hair: 'afro', hairColor: 'black', eyes: 'happy', mouth: 'grin', cheeks: false, outfit: { ...catalog.STARTER_OUTFIT } }
  for (const c of catalog.CLOTHES.filter(x => x.shop)) {
    const a = S.buildAvatar({ ...base, outfit: { ...base.outfit, [c.slot]: c.id } })
    for (const p of ['idle', 'walk', 'run', 'jump', 'fall', 'sit', 'sleep', 'wave', 'swing', 'dance', 'cheer']) a.animate(p, 1 / 30, 0.5)
    assert.ok(a.height >= 2.6 && a.height <= 3.9, `${c.id}: height ${a.height}`)
    let meshes = 0
    a.group.traverse((o) => { if (o.isMesh) meshes++ })
    assert.ok(meshes <= 24, `${c.id}: ${meshes} meshes`)
    a.dispose()
    const g = S.buildClothingModel(c)
    assert.ok(!g.userData.frame.isEmpty(), `${c.id} preview frame`)
    let parts = 0
    g.traverse((o) => { if (o.isMesh) parts++ })
    assert.ok(parts > 0, `${c.id} preview has meshes`)
  }
})

test('hats that cover the head hide the hair that would poke through', () => {
  assert.equal(S.hatHides('dino'), 'top')
  for (const h of ['pirate', 'witch', 'headphones']) assert.equal(S.hatHides(h), 'volume')
  for (const h of ['antennae', 'starcrown']) assert.equal(S.hatHides(h), 'none')
})
