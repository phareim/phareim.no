// Neon Shrine's hero in the isometric view's pixel art (render/iso/hero.ts): the one gate for the art as shipped (every
// frame of every covered shape and the extra poses and blades, in coloured letters, in the drawn, the girl's and a made
// figure's looks), and that the generated pose file is not stale. Bundled with esbuild like the other zelda tests.
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
      contents: `export * from './render/iso/hero'; export * from './render/iso/heroArt'; export * from './render/iso/heroPoses'; export { DRAWN_LOOK, GIRL_LOOK, lookFromColors } from './render/heroLook'; export { heroFrames, HAIR_STYLES, HEADWEAR, BOTTOMS, DRAWN_SHAPE } from './render/heroFrames'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })

const KEY = { hair: 'hairColor', skin: 'skin', head: 'headColor', top: 'top', stripe: 'stripe', belt: 'belt', bottom: 'bottomColor', shoes: 'shoes' }
// A made figure's colours, as Lag Din Figur writes them.
const FIGURE = { skin: '#a9683f', skinShade: '#80492b', hair: '#ffd23f', hairShade: '#c4861c', band: '#2f5fd0', top: '#ff8a3d', topShade: '#b0543a', topAccent: '#fff4ff', bottom: '#4f9a2a', shoes: '#1c1030' }
const shapes = () => M.HAIR_STYLES.flatMap(hair => M.HEADWEAR.flatMap(head => M.BOTTOMS.map(bottom => ({ hair, head, bottom }))))

describe('the hero in isometric pixel art', () => {
  it('composes every frame of every covered shape in coloured letters, in three looks, the extra poses and the blades with them', () => {
    assert.ok(M.heroArtCovers(M.DRAWN_SHAPE))
    const covered = shapes().filter(s => M.heroArtCovers(s))
    assert.ok(covered.length >= 1)
    for (const s of covered) {
      // The frames are the shape's whatever the colours: composed once, every letter looked up in each look's palette.
      const pals = [M.DRAWN_LOOK, M.GIRL_LOOK, M.lookFromColors(FIGURE)].map(l => {
        const look = { ...l, ...s }
        const pal = M.heroArtPalette(look)
        // Its own colours are in it.
        for (const [role, key] of Object.entries(KEY)) if (!(role === 'bottom' && look.bottom === 'dress')) assert.equal(pal[M.HERO_LETTERS[role][M.HERO_BASE[role]]], look[key], `${role} of ${look.hairColor}`)
        return pal
      })
      for (const name of M.HERO_ART_NAMES) {
        for (const flip of [false, true]) {
          const a = M.heroArtFor(name, flip, s)
          const tag = `${s.hair}/${s.head}/${s.bottom} ${name}${flip ? ' flipped' : ''}`
          assert.ok(a, tag)
          const { rows, ax, ay } = a.frame
          const w = rows[0].length
          assert.ok(rows.every(r => r.length === w), `${tag}: ragged`)
          const letters = new Set(rows.join(''))
          for (const ch of letters) assert.ok(ch === '.' || pals.every(pal => pal[ch]), `${tag}: no colour for ${ch}`)
          assert.ok(ax >= 0 && ax <= w + 4 && ay >= 1, `${tag}: foot point ${ax},${ay}`)
          // A head on a body: some hair, some skin, the shirt and the shoes in every standing frame.
          if (!/fall|dead/.test(name)) {
            for (const role of ['hair', 'top', 'shoes']) assert.ok([...M.HERO_LETTERS[role]].some(ch => letters.has(ch)), `${tag}: no ${role}`)
          }
        }
      }
    }
    // The art names every classic frame, the extra poses' bodies (front and back) and the blades use coloured letters.
    assert.deepEqual([...M.HERO_ART_NAMES].sort(), Object.keys(M.heroFrames(M.DRAWN_SHAPE)).sort())
    const drawn = M.heroArtPalette(M.DRAWN_LOOK)
    assert.ok(M.ART_EXTRA_POSES.length > 0)
    for (const p of M.ART_EXTRA_POSES) {
      for (const f of ['front', 'back']) for (const bottom of ['trousers', 'shorts', 'skirt']) {
        const body = M.HERO_PARTS.bodies[`${p}/${f}/${bottom}`]
        assert.ok(body && Number.isInteger(body.nx) && Number.isInteger(body.ny), `${p}/${f}/${bottom}: a body with its neck point`)
        for (const r of body.rows) for (const ch of r) assert.ok(ch === '.' || drawn[ch], `${p}/${f}/${bottom}: ${ch}`)
      }
    }
    for (const [name, art] of Object.entries(M.BLADE_ART)) for (const r of art) for (const ch of r) assert.ok(ch === '.' || M.BLADE_PAL[ch], `${name}: ${ch}`)
    for (const name of ['sword_v', 'sword_h', 'sword_d', 'sword2_v', 'sword2_h', 'sword2_d']) assert.ok(M.BLADE_ART[name], name)
  })

  it('are what the lab builds (scripts/zelda-lab/hero-poses.mjs --check)', async () => {
    const { execFileSync } = await import('node:child_process')
    execFileSync(process.execPath, [resolve(root, '../../scripts/zelda-lab/hero-poses.mjs'), '--check'], { stdio: 'pipe' })
  })
})
