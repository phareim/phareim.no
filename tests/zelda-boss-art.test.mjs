// Neon Shrine's bosses in isometric pixel art (render/iso/bossArt.ts, part 22): drawn by hand over posed 3D renders,
// routed by folk.ts like the people. Bundled with esbuild like the other zelda tests; the canvases are never made here.
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
      contents: `export * from './render/iso/folk'; export { BOSS_ART } from './render/iso/bossArt'; export { FOLK_ART } from './render/iso/folkArt'; export { setSpriteOverrides, spriteRows, frameCount } from './render/sheet'; export { SPRITES } from './render/sprites'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

// The bosses drawn so far, and the classic sprites each stands for. The rest stay the classic sprite.
const DRAWN = {
  king: ['king_0', 'king_1', 'king_hurt'],
  shard: ['shard'],
  troll: ['troll_0', 'troll_1'],
  gemini: ['gemini_a_0', 'gemini_a_1', 'gemini_a_down', 'gemini_b_0', 'gemini_b_1', 'gemini_b_down'],
  llama: ['llama_down_0', 'llama_down_1', 'llama_up_0', 'llama_up_1', 'llama_side_0', 'llama_side_1', 'llama_spit'],
  deepseek: ['deepseek_0', 'deepseek_1', 'deepseek_bite', 'deepseek_fin'],
}
const NOT_YET = ['mistral', 'deepseek', 'gemini', 'llama', 'troll'].filter(b => !DRAWN[b])

describe('isometric bosses', () => {
  it('has the bosses drawn so far, apart from the folk', () => {
    assert.deepEqual([...M.BOSS_FAMILIES].sort(), Object.keys(DRAWN).filter(b => !M.BOSSES_HELD.has(b)).sort())
    // A held boss keeps its art in bossArt.ts, but the game draws its classic sprite.
    for (const b of M.BOSSES_HELD) for (const name of DRAWN[b]) assert.notEqual(M.familyOf(name), b, name)
    for (const b of Object.keys(DRAWN)) assert.equal(M.FOLK_ART[b], undefined, b)
    for (const b of NOT_YET) assert.equal(M.BOSS_ART[b], undefined, b)
  })

  it('records every classic frame it stands for, from the repo rows (the live pack has no boss edits)', () => {
    for (const [fam, names] of Object.entries(DRAWN)) {
      assert.deepEqual(Object.keys(M.BOSS_ART[fam].src).sort(), [...names].sort(), fam)
      for (const [name, hash] of Object.entries(M.BOSS_ART[fam].src)) assert.equal(M.rowsHash(M.SPRITES[name].rows), hash, name)
      M.setSpriteOverrides({})
      assert.equal(M.familyFresh(M.BOSS_ART[fam]), true, fam)
    }
  })

  it('draws every frame: a clean rectangle in its own palette, twice the classic size, the foot on the classic bottom centre', () => {
    for (const [fam, names] of Object.entries(DRAWN)) {
      const f = M.BOSS_ART[fam]
      for (const [key, fr] of Object.entries(f.frames)) {
        const w = fr.rows[0].length
        assert.ok(fr.rows.every(r => r.length === w), `${fam} ${key} ragged`)
        for (const r of fr.rows) for (const ch of r) assert.ok(ch === '.' || f.pal[ch], `${fam} ${key}: ${ch}`)
        for (const c of Object.values(f.pal)) assert.match(c, /^#[0-9a-f]{6}$/)
      }
      for (const name of names) {
        const c = M.SPRITES[name].rows
        const fc = M.facingOf(name, fam, false)
        assert.ok(fc && f.frames[fc.key], `${name} → ${fc?.key}`)
        const fr = f.frames[fc.key]
        // About as much of the world as the classic sprite covers, at twice its px (the three-quarter drawing may be
        // longer and lower than a face-on classic one).
        const ys = c.map((r, y) => (/[^. ]/.test(r) ? y : -1)).filter(y => y >= 0)
        const xs = c.flatMap(r => [...r].map((ch, x) => (ch !== '.' && ch !== ' ' ? x : -1))).filter(x => x >= 0)
        const cw = Math.max(...xs) - Math.min(...xs) + 1
        const ch = Math.max(...ys) - Math.min(...ys) + 1
        const area = fr.rows[0].length * fr.rows.length
        assert.ok(area >= 0.6 * 4 * cw * ch && area <= 1.4 * 4 * cw * ch, `${name} ${fr.rows[0].length}x${fr.rows.length} for ${cw}x${ch}`)
        // The foot point (the classic bottom centre, doubled) is inside or at the picture's edge.
        assert.ok(fr.ax >= 0 && fr.ax <= fr.rows[0].length && fr.ay >= fr.rows.length - 3 && fr.ay <= fr.rows.length + 3, `${name} foot ${fr.ax},${fr.ay}`)
      }
      // The steps of one animation stand within a px of each other (so it never steps sideways).
      for (const [k, fr] of Object.entries(f.frames)) {
        const m = /^(.*)_1$/.exec(k)
        const f0 = m && f.frames[`${m[1]}_0`]
        if (f0) assert.ok(Math.abs(fr.ax - f0.ax) <= 1 && Math.abs(fr.ay - f0.ay) <= 1, `${fam} ${k} steps`)
      }
    }
  })

  it('routes the bosses through the folk router, and falls back whole when the studio redraws one', () => {
    M.setSpriteOverrides({})
    assert.equal(M.familyOf('king_hurt'), 'king')
    assert.deepEqual(M.facingOf('king_hurt', 'king', false), { key: 'front_hurt', flip: false })
    assert.deepEqual(M.facingOf('shard', 'shard', false), { key: 'front_0', flip: false })
    assert.equal(M.familyOf('troll_0') === 'troll', !!DRAWN.troll)
    // The twins: one family, a front frame each by the rest of the name; the troll mirrors as the classic does.
    assert.deepEqual(M.facingOf('gemini_b_down', 'gemini', false), { key: 'front_b_down', flip: false })
    assert.deepEqual(M.facingOf('gemini_a_1', 'gemini', false), { key: 'front_a_1', flip: false })
    assert.deepEqual(M.facingOf('troll_1', 'troll', true), { key: 'front_1', flip: true })
    // The llama walks four ways as the foes do; its spit is a front pose.
    assert.deepEqual(M.facingOf('llama_up_1', 'llama', false), { key: 'back_1', flip: true })
    assert.deepEqual(M.facingOf('llama_side_0', 'llama', true), { key: 'back_0', flip: false })
    assert.deepEqual(M.facingOf('llama_spit', 'llama', true), { key: 'front_spit', flip: true })
    // The deepseek's second swimming frame is its first a px higher (the same px); its fin is a pose of its own.
    assert.deepEqual(M.facingOf('deepseek_fin', 'deepseek', false), { key: 'front_fin', flip: false })
    const ds = M.BOSS_ART.deepseek.frames
    assert.deepEqual(ds.front_1.rows, ds.front_0.rows)
    assert.equal(ds.front_1.ay, ds.front_0.ay + 1)
    const edited = M.SPRITES.king_1.rows.map((r, i) => (i === 20 ? 'k' + r.slice(1) : r))
    M.setSpriteOverrides({ king_1: edited })
    assert.equal(M.familyFresh(M.BOSS_ART.king), false)
    M.setSpriteOverrides({})
    assert.equal(M.familyFresh(M.BOSS_ART.king), true)
  })
})
