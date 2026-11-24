// Neon Shrine's isometric figures (render/iso/folk.ts, part 19): the art each family was drawn from, the facings
// through the view's 45° turn, and the studio's newest edit winning over the art. Bundled with esbuild like the
// other zelda tests; the canvases are never made here.
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
      contents: `export * from './render/iso/folk'; export { FOLK_ART } from './render/iso/folkArt'; export { setSpriteOverrides, spriteRows, frameCount, spriteRevision } from './render/sheet'; export { SPRITES } from './render/sprites'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

describe('isometric figures', () => {
  it('has the pilot cast, each frame a clean rectangle in its own palette, about twice the classic size', () => {
    for (const fam of ['keeper', 'vendor', 'kid', 'barmaid', 'guard', 'petter', 'robot', 'cat', 'blob', 'spitter']) {
      const f = M.FOLK_ART[fam]
      assert.ok(f, fam)
      assert.ok(Object.keys(f.pal).length <= 28, `${fam}: ${Object.keys(f.pal).length} colours`)
      for (const [key, fr] of Object.entries(f.frames)) {
        const w = fr.rows[0].length
        assert.ok(fr.rows.every(r => r.length === w), `${fam} ${key} ragged`)
        for (const r of fr.rows) for (const ch of r) assert.ok(ch === '.' || f.pal[ch], `${fam} ${key}: ${ch}`)
        assert.ok(w >= 16 && w <= 40 && fr.rows.length >= 14 && fr.rows.length <= 40, `${fam} ${key} ${w}x${fr.rows.length}`)
        assert.ok(fr.ay >= fr.rows.length - 2, `${fam} ${key}: foot inside the picture`)
      }
      // Every classic sprite it was drawn from has a frame to stand for it.
      for (const name of Object.keys(f.src)) {
        const fc = M.facingOf(name, fam, false)
        assert.ok(fc && f.frames[fc.key], `${name} → ${fc?.key}`)
        assert.ok(M.facingOf(name, fam, true) && f.frames[M.facingOf(name, fam, true).key], `${name} mirrored`)
      }
    }
  })

  it('turns the four ways through the camera: south front, east front mirrored, north back mirrored, west back', () => {
    assert.deepEqual(M.facingOf('spitter_down_1', 'spitter', false), { key: 'front_1', flip: false })
    assert.deepEqual(M.facingOf('spitter_side_0', 'spitter', false), { key: 'front_0', flip: true })
    assert.deepEqual(M.facingOf('spitter_side_0', 'spitter', true), { key: 'back_0', flip: false })
    assert.deepEqual(M.facingOf('spitter_up_0', 'spitter', false), { key: 'back_0', flip: true })
    // Townsfolk keep their front, mirrored as the classic sprite is.
    assert.deepEqual(M.facingOf('keeper_1', 'keeper', true), { key: 'front_1', flip: true })
    assert.equal(M.facingOf('king_hurt', 'king', false), null)
    assert.equal(M.familyOf('keeper_0'), 'keeper')
    assert.equal(M.familyOf('keeper_hat'), null)
    assert.equal(M.familyOf('hero_down_0'), null)
  })

  it('hashes rows like FNV-1a', () => {
    assert.equal(M.rowsHash(['']), '811c9dc5')
    assert.equal(M.rowsHash(['a']), 'e40c292c')
    assert.notEqual(M.rowsHash(['ab', 'cd']), M.rowsHash(['abc', 'd']))
  })

  it('was drawn from what the game shows: the hashes of the repo rows hold where the studio has not drawn', () => {
    // The kid, the robot, the barmaid and the spitter have no live edit: their art matches the repo's rows.
    for (const fam of ['kid', 'robot', 'barmaid', 'spitter']) {
      for (const [name, hash] of Object.entries(M.FOLK_ART[fam].src)) assert.equal(M.rowsHash(M.SPRITES[name].rows), hash, name)
    }
  })

  it('falls back to the classic sprite when the studio has drawn since (the newest edit wins)', () => {
    const fam = M.FOLK_ART.kid
    // As drawn: fresh.
    assert.equal(M.familyFresh(fam, n => M.SPRITES[n]?.rows, (_p, own) => own), true)
    // The studio redraws kid_1: stale, the whole family is the classic one again.
    const edited = M.SPRITES.kid_1.rows.map((r, i) => (i === 3 ? 'k' + r.slice(1) : r))
    M.setSpriteOverrides({ kid_1: edited })
    assert.equal(M.spriteRows('kid_1'), edited)
    assert.equal(M.familyFresh(fam), false)
    // Through the real lookup too (the revision clears what was known).
    assert.equal(M.folkPic({ name: 'kid_0', flip: false }), null)
    M.setSpriteOverrides({})
    assert.equal(M.familyFresh(fam), true)
    // The studio adds a frame (kid_2) the art does not have: stale as well.
    M.setSpriteOverrides({ kid_2: M.SPRITES.kid_0.rows })
    assert.equal(M.frameCount('kid', 2), 3)
    assert.equal(M.familyFresh(fam), false)
    M.setSpriteOverrides({})
  })

  it('needs the live rows for a family the studio drew (the cat is the studio\'s three frames)', () => {
    const cat = M.FOLK_ART.cat
    assert.deepEqual(Object.keys(cat.src).sort(), ['cat_0', 'cat_1', 'cat_2'])
    // Without the live pack the game shows the repo's cat, which the art was not drawn from: the classic one stands.
    M.setSpriteOverrides({})
    assert.equal(M.familyFresh(cat), false)
  })
})
