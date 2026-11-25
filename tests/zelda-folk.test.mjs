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
      contents: `export * from './render/iso/folk'; export { FOLK_ART } from './render/iso/folkArt'; export { FRONTIER_FOLK_ART, FRONTIER_BOSS_ART } from './render/iso/frontierArt/peopleData'; export { setSpriteOverrides, spriteRows, frameCount, spriteRevision } from './render/sheet'; export { SPRITES } from './render/sprites'`,
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
  // Part 19's pilot and part 20's rest of the people and foes. The hero's art is `heroArt.ts` (part 21), the bosses' `bossArt.ts` (part 22).
  const DRAWN = [
    'keeper', 'vendor', 'kid', 'barmaid', 'guard', 'petter', 'robot', 'cat', 'blob', 'spitter',
    'twirler', 'hippie', 'smoker', 'guitar', 'sleeper',
    'ghost', 'luna', 'mossa', 'dusty', 'toby', 'max', 'owl', 'hound', 'drone',
    'sentry', 'bat', 'dasher', 'zapper', 'skull', 'eye', 'blade', 'knight',
  ]

  it('has the families drawn so far, and none of the hero or the bosses', () => {
    assert.deepEqual([...M.FOLK_FAMILIES].sort(), [...DRAWN, ...Object.keys(M.FRONTIER_FOLK_ART)].sort())
    for (const boss of ['hero', 'king', 'mistral', 'deepseek', 'gemini', 'llama', 'troll']) assert.equal(M.FOLK_ART[boss], undefined, boss)
  })

  it('has every family, each frame a clean rectangle in its own palette, about twice the classic size', () => {
    for (const fam of DRAWN) {
      const f = M.FOLK_ART[fam]
      assert.ok(f, fam)
      assert.ok(Object.keys(f.pal).length <= 24, `${fam}: ${Object.keys(f.pal).length} colours`)
      const big = Object.keys(f.src).some(n => (M.SPRITES[n]?.rows.length ?? 16) > 16)
      for (const [key, fr] of Object.entries(f.frames)) {
        const w = fr.rows[0].length
        assert.ok(fr.rows.every(r => r.length === w), `${fam} ${key} ragged`)
        for (const r of fr.rows) for (const ch of r) assert.ok(ch === '.' || f.pal[ch], `${fam} ${key}: ${ch}`)
        const lim = big ? 56 : 40
        assert.ok(w >= 16 && w <= lim && fr.rows.length >= 14 && fr.rows.length <= lim, `${fam} ${key} ${w}x${fr.rows.length}`)
        assert.ok(fr.ay >= fr.rows.length - 2, `${fam} ${key}: foot inside the picture`)
      }
      // Every classic sprite it was drawn from has a frame to stand for it.
      for (const name of Object.keys(f.src)) {
        const idle = !!f.frames.idle_0
        const fc = M.facingOf(name, fam, false, idle)
        assert.ok(fc && f.frames[fc.key], `${name} → ${fc?.key}`)
        assert.ok(M.facingOf(name, fam, true, idle) && f.frames[M.facingOf(name, fam, true, idle).key], `${name} mirrored`)
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
    assert.equal(M.familyOf('king_hurt', M.FOLK_ART), null)  // (the bosses are `bossArt.ts`'s, part 22)
    // Poses of their own and sprites of one picture (part 20); Luna's standing frames apart from her walk.
    assert.deepEqual(M.facingOf('hound_open', 'hound', true), { key: 'front_open', flip: true })
    assert.deepEqual(M.facingOf('skull_jump', 'skull', false), { key: 'front_jump', flip: false })
    assert.deepEqual(M.facingOf('eye', 'eye', false), { key: 'front_0', flip: false })
    assert.deepEqual(M.facingOf('luna_1', 'luna', true, true), { key: 'idle_1', flip: true })
    assert.deepEqual(M.facingOf('luna_down_1', 'luna', false, true), { key: 'front_1', flip: false })
    assert.equal(M.familyOf('eye'), 'eye')
    assert.equal(M.familyOf('luna_psi'), 'luna')
    assert.equal(M.familyOf('pot'), null)
    assert.equal(M.familyOf('keeper_0'), 'keeper')
    assert.equal(M.familyOf('keeper_hat'), null)
    assert.equal(M.familyOf('hero_down_0'), null)
  })

  it('routes the frontier figures and bosses from every classic sprite to their own art', () => {
    for (const [name, family] of Object.entries({ ...M.FRONTIER_FOLK_ART, ...M.FRONTIER_BOSS_ART })) {
      assert.ok(M.familyFresh(family), name)
      for (const sprite of Object.keys(family.src)) {
        const frame = M.facingOf(sprite, name, false)
        assert.ok(frame && family.frames[frame.key], sprite)
        assert.equal(M.familyOf(sprite), name)
        assert.match(M.SPRITES[sprite].rows.join(''), /^[.a-zA-Z]+$/)
      }
    }
  })

  it('hashes rows like FNV-1a', () => {
    assert.equal(M.rowsHash(['']), '811c9dc5')
    assert.equal(M.rowsHash(['a']), 'e40c292c')
    assert.notEqual(M.rowsHash(['ab', 'cd']), M.rowsHash(['abc', 'd']))
  })

  it('was drawn from what the game shows: the hashes of the repo rows hold where the studio has not drawn', () => {
    // The kid, the robot, the barmaid and the spitter have no live edit: their art matches the repo's rows.
    for (const fam of ['kid', 'robot', 'barmaid', 'spitter', 'mossa', 'dusty', 'max', 'hound', 'drone', 'sentry', 'bat', 'dasher', 'zapper', 'skull', 'blade', 'knight']) {
      for (const [name, hash] of Object.entries(M.FOLK_ART[fam].src)) assert.equal(M.rowsHash(M.SPRITES[name].rows), hash, name)
    }
  })

  it('records every classic sprite a family stands for (part 20)', () => {
    const src = fam => Object.keys(M.FOLK_ART[fam].src).sort()
    assert.deepEqual(src('ghost'), ['ghost_0', 'ghost_1', 'ghost_2', 'ghost_3'])
    assert.deepEqual(src('skull'), ['skull_0', 'skull_1', 'skull_jump'])
    assert.ok(src('luna').includes('luna_psi') && src('luna').includes('luna_0') && src('luna').includes('luna_side_2'))
    assert.ok(src('hound').includes('hound_open'))
    assert.deepEqual(src('eye'), ['eye'])
    assert.equal(src('knight').length, 6)
    // The ones the studio drew are stale without the live pack, as the cat is: the classic sprites stand.
    M.setSpriteOverrides({})
    for (const fam of ['ghost', 'luna', 'toby', 'owl', 'eye']) assert.equal(M.familyFresh(M.FOLK_ART[fam]), false, fam)
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
