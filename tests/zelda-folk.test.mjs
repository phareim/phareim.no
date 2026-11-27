// Neon Shrine's isometric figures and bosses (render/iso/folk.ts, folkArt.ts, bossArt.ts): the one gate for the
// figure art as shipped, the facings through the view's 45° turn, and the studio's newest edit winning over the art.
// Bundled with esbuild like the other zelda tests; the canvases are never made here.
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
      contents: `export * from './render/iso/folk'; export { FOLK_ART } from './render/iso/folkArt'; export { BOSS_ART } from './render/iso/bossArt'; export { setSpriteOverrides, spriteRows, frameCount } from './render/sheet'; export { SPRITES } from './render/sprites'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

// Families drawn from a sprite edited in the studio: the repo's rows are not what they were drawn from, so without the
// live pack the classic sprite stands.
const STUDIO = ['keeper', 'vendor', 'guard', 'petter', 'cat', 'blob', 'twirler', 'guitar', 'ghost', 'luna', 'toby', 'owl', 'eye']

describe('isometric figures and bosses', () => {
  it('draws every frame in its own palette, routes every classic sprite to one both ways, and is fresh against the repo rows', () => {
    M.setSpriteOverrides({})
    for (const [fam, f] of Object.entries({ ...M.FOLK_ART, ...M.BOSS_ART })) {
      for (const [key, fr] of Object.entries(f.frames)) {
        assert.ok(fr.rows.length > 0 && fr.rows.every(r => r.length === fr.rows[0].length), `${fam} ${key}: ragged`)
        for (const r of fr.rows) for (const ch of r) assert.ok(ch === '.' || f.pal[ch], `${fam} ${key}: ${ch}`)
      }
      for (const [name, hash] of Object.entries(f.src)) {
        // A frame only the studio has drawn (the cat's third) has no row in the repo.
        assert.ok(M.SPRITES[name] || STUDIO.includes(fam), `${fam}: no classic sprite ${name}`)
        assert.equal(M.familyOf(name), fam, name)
        for (const flip of [false, true]) {
          const to = M.facingOf(name, fam, flip, !!f.frames.idle_0)
          assert.ok(to && f.frames[to.key], `${name}${flip ? ' mirrored' : ''} → ${to?.key}`)
        }
        if (!STUDIO.includes(fam)) assert.equal(M.rowsHash(M.SPRITES[name].rows), hash, `${name}: the art was drawn from other rows`)
      }
      if (!STUDIO.includes(fam)) assert.equal(M.familyFresh(f), true, fam)
    }
  })

  it('turns the four ways through the camera: south front, east front mirrored, north back mirrored, west back', () => {
    assert.deepEqual(M.facingOf('spitter_down_1', 'spitter', false), { key: 'front_1', flip: false })
    assert.deepEqual(M.facingOf('spitter_side_0', 'spitter', false), { key: 'front_0', flip: true })
    assert.deepEqual(M.facingOf('spitter_side_0', 'spitter', true), { key: 'back_0', flip: false })
    assert.deepEqual(M.facingOf('spitter_up_0', 'spitter', false), { key: 'back_0', flip: true })
    // Townsfolk keep their front, mirrored as the classic sprite is; a boss with a front only is never mirrored away.
    assert.deepEqual(M.facingOf('keeper_1', 'keeper', true), { key: 'front_1', flip: true })
    assert.deepEqual(M.facingOf('gemini_b_down', 'gemini', false), { key: 'front_b_down', flip: false })
    // No art for a thing that is not a figure.
    assert.equal(M.familyOf('pot'), null)
    assert.equal(M.familyOf('hero_down_0'), null)
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
    // A boss falls back the same way.
    const edited2 = M.SPRITES.king_1.rows.map((r, i) => (i === 20 ? 'k' + r.slice(1) : r))
    M.setSpriteOverrides({ king_1: edited2 })
    assert.equal(M.familyFresh(M.BOSS_ART.king), false)
    M.setSpriteOverrides({})
    assert.equal(M.familyFresh(M.BOSS_ART.king), true)
    // A family the studio drew needs the studio's rows: without them the classic sprite stands.
    assert.equal(M.familyFresh(M.FOLK_ART.cat), false)
  })
})
