// Neon Shrine's hero in the isometric view's pixel art (render/iso/hero.ts, part 21): the parts every covered shape is
// composed from, the recolouring by roles (the drawn look as drawn, the booth's and a made figure's colours mixed), the
// whole classic hero for a shape that is not wholly drawn, the facings, and the blades. Bundled with esbuild like the
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
      contents: `export * from './render/iso/hero'; export * from './render/iso/heroArt'; export * from './render/iso/heroPoses'; export { DRAWN_LOOK, GIRL_LOOK, lookFromColors } from './render/heroLook'; export { heroFrames, HAIR_STYLES, HEADWEAR, BOTTOMS, DRAWN_SHAPE } from './render/heroFrames'; export { SPRITES } from './render/sprites'; export { setSpriteOverrides, setHeroLook, heroStudioEdited } from './render/sheet'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

const ROLES = ['hair', 'skin', 'head', 'top', 'stripe', 'belt', 'bottom', 'shoes']
const KEY = { hair: 'hairColor', skin: 'skin', head: 'headColor', top: 'top', stripe: 'stripe', belt: 'belt', bottom: 'bottomColor', shoes: 'shoes' }
// A made figure's colours, as Lag Din Figur writes them.
const FIGURE = { skin: '#a9683f', skinShade: '#80492b', hair: '#ffd23f', hairShade: '#c4861c', band: '#2f5fd0', top: '#ff8a3d', topShade: '#b0543a', topAccent: '#fff4ff', bottom: '#4f9a2a', shoes: '#1c1030' }
const shapes = () => M.HAIR_STYLES.flatMap(hair => M.HEADWEAR.flatMap(head => M.BOTTOMS.map(bottom => ({ hair, head, bottom }))))

describe('the hero in isometric pixel art', () => {
  it('covers the drawn shape, and composes every frame of every shape it says it covers', () => {
    assert.ok(M.heroArtCovers(M.DRAWN_SHAPE))
    const covered = shapes().filter(s => M.heroArtCovers(s))
    assert.ok(covered.length >= 1)
    for (const s of covered) {
      const pal = M.heroArtPalette({ ...M.DRAWN_LOOK, ...s })
      for (const name of M.HERO_ART_NAMES) {
        for (const flip of [false, true]) {
          const a = M.heroArtFor(name, flip, s)
          const tag = `${s.hair}/${s.head}/${s.bottom} ${name}${flip ? ' flipped' : ''}`
          assert.ok(a, tag)
          const { rows, ax, ay } = a.frame
          const w = rows[0].length
          assert.ok(rows.every(r => r.length === w), `${tag}: ragged`)
          for (const r of rows) for (const ch of r) assert.ok(ch === '.' || pal[ch], `${tag}: no colour for ${ch}`)
          // About twice the classic 16 px (lying down: on its side; falling and rolling: shrunk, rolling turned too).
          if (!/fall|dead|roll/.test(name)) assert.ok(w >= 16 && w <= 44 && rows.length >= 26 && rows.length <= 46, `${tag}: ${w}x${rows.length}`)
          assert.ok(ax >= 0 && ax <= w + 4 && ay >= 1, `${tag}: foot point ${ax},${ay}`)
          // A head on a body: some hair, some skin, the shirt and the shoes in every standing frame.
          if (!/fall|dead/.test(name)) {
            const all = rows.join('')
            for (const role of ['hair', 'top', 'shoes']) assert.ok([...M.HERO_LETTERS[role]].some(ch => all.includes(ch)), `${tag}: no ${role}`)
          }
        }
      }
    }
  })

  it('stands for every classic hero frame', () => {
    const classic = Object.keys(M.heroFrames(M.DRAWN_SHAPE))
    assert.deepEqual([...M.HERO_ART_NAMES].sort(), [...classic].sort())
  })

  it('wears the drawn colours in the drawn look', () => {
    const pal = M.heroArtPalette(M.DRAWN_LOOK)
    for (const role of ROLES) {
      const letters = M.HERO_LETTERS[role]
      M.HERO_DRAWN[role].forEach((c, i) => assert.equal(pal[letters[i]], c, `${role} slot ${i}`))
      // The look's own colour is one of the slots, as it is in the classic hero.
      assert.equal(M.HERO_DRAWN[role][M.HERO_BASE[role]], M.DRAWN_LOOK[KEY[role]], role)
    }
  })

  it('recolours by role for the booth\'s girl look and a made figure\'s colours', () => {
    const drawn = M.heroArtPalette(M.DRAWN_LOOK)
    for (const look of [M.GIRL_LOOK, M.lookFromColors(FIGURE)]) {
      const pal = M.heroArtPalette(look)
      for (const role of ROLES) {
        const src = role === 'bottom' && look.bottom === 'dress' ? 'top' : role
        const want = look[KEY[src]]
        const letters = M.HERO_LETTERS[role]
        assert.equal(pal[letters[M.HERO_BASE[role]]], want, `${role} base`)
        const changed = want !== M.DRAWN_LOOK[KEY[src]]
        for (let i = 0; i < M.HERO_DRAWN[role].length; i++) {
          if (changed) assert.match(pal[letters[i]], /^#[0-9a-f]{6}$/, `${role} ${i}`)
          else assert.equal(pal[letters[i]], drawn[letters[i]], `${role} ${i} kept`)
        }
        // Shades of the new colour: the outline darker than the colour, the light slots lighter.
        if (changed) {
          const L = h => { const v = parseInt(h.slice(1), 16); return 0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255) }
          assert.ok(L(pal[letters[0]]) <= L(want), `${role} outline`)
        }
      }
    }
    // The girl's shape draws other parts than the drawn hero's.
    const g = M.heroArtFor('hero_down_0', false, M.GIRL_LOOK)
    const d = M.heroArtFor('hero_down_0', false, M.DRAWN_LOOK)
    assert.ok(g && d)
    assert.notDeepEqual(g.frame.rows, d.frame.rows)
    // A dress is the skirt in the shirt's colours.
    const dress = M.heroArtPalette({ ...M.DRAWN_LOOK, bottom: 'dress', top: '#ff8a3d' })
    assert.equal(dress[M.HERO_LETTERS.bottom[M.HERO_BASE.bottom]], dress[M.HERO_LETTERS.top[M.HERO_BASE.top]])
  })

  it('draws a shape that is not wholly drawn as the classic hero, every frame of it', () => {
    const P = M.HERO_PARTS
    // One part missing: the skirt's pushing body from behind.
    const less = { ...P, bodies: Object.fromEntries(Object.entries(P.bodies).filter(([k]) => k !== 'push/back/skirt')) }
    const skirt = { ...M.DRAWN_LOOK, bottom: 'skirt' }
    assert.equal(M.heroArtCovers(skirt, less), false)
    for (const name of M.HERO_ART_NAMES) assert.equal(M.heroArtFor(name, false, skirt, less), null, name)
    // The other shapes stay drawn.
    assert.ok(M.heroArtFor('hero_down_0', false, M.DRAWN_LOOK, less))
    // A head missing: the same.
    const noHead = { ...P, heads: Object.fromEntries(Object.entries(P.heads).filter(([k]) => !k.startsWith('pigtails/bow/'))) }
    const pig = { ...M.DRAWN_LOOK, hair: 'pigtails', head: 'bow' }
    assert.equal(M.heroArtFor('hero_up_1', false, pig, noHead), null)
  })

  it('stands as the classic hero while the studio has redrawn it (unless the booth\'s look is worn)', () => {
    assert.equal(M.heroStudioEdited(), false)
    const rows = M.SPRITES.hero_down_0.rows.map(r => r.replace(/c/g, 'C'))
    M.setSpriteOverrides({ hero_down_0: rows })
    assert.equal(M.heroStudioEdited(), true)
    M.setHeroLook(M.GIRL_LOOK)
    assert.equal(M.heroStudioEdited(), false)
    M.setHeroLook(null)
    M.setSpriteOverrides({})
    assert.equal(M.heroStudioEdited(), false)
  })

  it('shows the front or the back, mirrored, as the folk do', () => {
    const at = (name, flip) => { const a = M.heroArtFor(name, flip, M.DRAWN_SHAPE); return a && { rows: a.frame.rows.join('\n'), flip: a.flip } }
    const front = at('hero_down_0', false)
    const back = at('hero_up_0', false)
    assert.equal(front.flip, false)
    assert.equal(back.flip, true)
    assert.notEqual(front.rows, back.rows)
    // East: the front mirrored; west: the back as drawn.
    assert.deepEqual(at('hero_side_0', false), { rows: front.rows, flip: true })
    assert.deepEqual(at('hero_side_0', true), { rows: back.rows, flip: false })
    // The walk's steps differ from standing, and from each other.
    const w1 = at('hero_down_1', false).rows
    const w2 = at('hero_down_2', false).rows
    assert.notEqual(w1, front.rows)
    assert.notEqual(w2, front.rows)
    assert.notEqual(w1, w2)
  })

  it('redraws the blades at twice the size, the Arc Blade in its own colours', () => {
    for (const name of ['sword_v', 'sword_h', 'sword_d', 'sword2_v', 'sword2_h', 'sword2_d']) {
      const art = M.BLADE_ART[name]
      const cl = M.SPRITES[name].rows
      assert.ok(art, name)
      assert.equal(art.length, cl.length * 2, `${name} height`)
      assert.ok(art.every(r => r.length === cl[0].length * 2), `${name} width`)
      for (const r of art) for (const ch of r) assert.ok(ch === '.' || M.BLADE_PAL[ch], `${name}: ${ch}`)
    }
    assert.ok(M.BLADE_ART.sword2_v.join('').includes('v'))
    assert.ok(!M.BLADE_ART.sword_v.join('').includes('v'))
  })
})

// The fight and movement poses (docs/art/codex-tasks.md, THE HERO IN A FIGHT): drawn as extra poses, never required,
// each over classic frames of its own; built by scripts/zelda-lab/hero-poses.mjs into render/iso/heroPoses.ts.
describe('the hero\'s fight and movement poses', () => {
  const KINDS = ['trousers', 'shorts', 'skirt']
  const rowsOf = (name, s = M.DRAWN_SHAPE, flip = false) => M.heroArtFor(name, flip, s).frame.rows.join('\n')

  it('are drawn front and back in every bottom (hurt from behind: the front is the drawn one), apart from the required ones', () => {
    assert.ok(M.ART_EXTRA_POSES.length >= 18)
    for (const p of M.ART_EXTRA_POSES) {
      assert.ok(!M.ART_POSES.includes(p), p)
      for (const f of ['front', 'back']) for (const k of KINDS) {
        const body = M.HERO_PARTS.bodies[`${p}/${f}/${k}`]
        assert.ok(body, `${p}/${f}/${k}`)
        assert.ok(Number.isInteger(body.nx) && Number.isInteger(body.ny), `${p}/${f}/${k}: neck point`)
        for (const r of body.rows) for (const ch of r) assert.ok(ch === '.' || M.heroArtPalette(M.DRAWN_LOOK)[ch], `${p}/${f}/${k}: ${ch}`)
      }
    }
    // The ball turns the head with it, a quarter and a half turn.
    assert.equal(M.HERO_POSE_BODIES['roll_1/front/trousers'].nr, 3)
    assert.equal(M.HERO_POSE_BODIES['roll_2/back/skirt'].nr, 2)
  })

  it('have classic frames down, up and side for every shape', () => {
    for (const s of shapes()) {
      const F = M.heroFrames(s)
      for (const p of M.ART_EXTRA_POSES) for (const d of ['down', 'up', 'side']) assert.ok(F[`hero_${d}_${p}`], `${s.hair}/${s.head}/${s.bottom} hero_${d}_${p}`)
    }
  })

  it('are frames of their own, iso and classic: no two the same, none the stand or the swing', () => {
    const F = M.heroFrames(M.DRAWN_SHAPE)
    for (const d of ['down', 'up', 'side']) {
      const names = [...M.ART_EXTRA_POSES, '0', 'atk'].filter(p => !(d === 'down' && p === 'hurt')).map(p => `hero_${d}_${p}`)
      const iso = names.map(n => `${rowsOf(n)}|${M.heroArtFor(n, false, M.DRAWN_SHAPE).flip}`)
      const classic = names.map(n => F[n].join('\n'))
      assert.equal(new Set(iso).size, names.length, `iso ${d}`)
      assert.equal(new Set(classic).size, names.length, `classic ${d}`)
    }
    // The four-way hurt from the front is the drawn front hurt; from behind it is its own.
    assert.deepEqual(F.hero_down_hurt, F.hero_hurt)
    assert.equal(rowsOf('hero_down_hurt'), rowsOf('hero_hurt'))
    assert.notEqual(rowsOf('hero_up_hurt'), rowsOf('hero_up_0'))
  })

  it('lift both feet off the ground in the run, in both views', () => {
    const F = M.heroFrames(M.DRAWN_SHAPE)
    for (const d of ['down', 'up', 'side']) {
      const flying = [0, 1, 2, 3, 4, 5].filter(i => !/[^.]/.test(F[`hero_${d}_run_${i}`][15]))
      assert.ok(flying.length >= 1, `classic ${d}: ${flying}`)
    }
    for (const f of ['front', 'back']) {
      const flying = [0, 1, 2, 3, 4, 5].filter(i => M.HERO_POSE_BODIES[`run_${i}/${f}/trousers`].rows.length + M.HERO_POSE_BODIES[`run_${i}/${f}/trousers`].y < 0)
      assert.ok(flying.length >= 1, `iso ${f}: ${flying}`)
    }
  })

  it('never make a shape uncovered, and fall back to the swing or the stand where a body is missing', () => {
    const P = M.HERO_PARTS
    const bare = { ...P, bodies: Object.fromEntries(Object.entries(P.bodies).filter(([k]) => !M.ART_EXTRA_POSES.some(p => k.startsWith(`${p}/`)) || k.startsWith('hurt/front/'))) }
    for (const s of shapes()) assert.equal(M.heroArtCovers(s, bare), M.heroArtCovers(s), `${s.hair}/${s.head}/${s.bottom}`)
    const at = (name, parts) => M.heroArtFor(name, false, M.DRAWN_SHAPE, parts).frame.rows.join('\n')
    assert.equal(at('hero_down_atk_wind', bare), at('hero_down_atk', P))
    assert.equal(at('hero_up_charge', bare), at('hero_up_atk', P))
    assert.equal(at('hero_side_run_3', bare), at('hero_side_0', P))
    assert.equal(at('hero_up_hurt', bare), at('hero_up_0', P))
    // A hit frame the engine may name one day, with no art at all.
    assert.equal(at('hero_down_atk_hit', P), at('hero_down_atk', P))
    assert.equal(at('hero_up_dodge', P), at('hero_up_0', P))
    // The required poses never fall back: a shape missing one is the classic hero.
    assert.equal(M.extraFallback('atk_lunge'), 'atk')
    assert.equal(M.extraFallback('roll_2'), '0')
  })

  it('are what the lab builds (scripts/zelda-lab/hero-poses.mjs --check)', async () => {
    const { execFileSync } = await import('node:child_process')
    execFileSync(process.execPath, [resolve(root, '../../scripts/zelda-lab/hero-poses.mjs'), '--check'], { stdio: 'pipe' })
  })
})
