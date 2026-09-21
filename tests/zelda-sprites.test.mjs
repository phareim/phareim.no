import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Same staging trick as zelda-renderer.smoke.mjs: renderer.ts uses
// extensionless relative imports, which plain node type-stripping cannot
// resolve.
function loadRenderer() {
  const root = new URL('..', import.meta.url)
  const read = (p) => readFileSync(new URL(p, root), 'utf8')
  const tmp = mkdtempSync(join(tmpdir(), 'zelda-sprites-'))
  mkdirSync(join(tmp, 'themes/zelda'), { recursive: true })
  mkdirSync(join(tmp, 'themes/base'), { recursive: true })
  const renderer = read('themes/zelda/renderer.ts')
    .split(`from './types'`).join(`from './types.ts'`)
    .split(`from '../base/fonts'`).join(`from '../base/fonts.ts'`)
    .split(`from './terrain'`).join(`from './terrain.ts'`)
  writeFileSync(join(tmp, 'themes/zelda/renderer.ts'), renderer)
  writeFileSync(join(tmp, 'themes/zelda/types.ts'), read('themes/zelda/types.ts'))
  writeFileSync(
    join(tmp, 'themes/zelda/terrain.ts'),
    read('themes/zelda/terrain.ts').split(`from './types'`).join(`from './types.ts'`),
  )
  writeFileSync(join(tmp, 'themes/base/fonts.ts'), read('themes/base/fonts.ts'))
  return import(pathToFileURL(join(tmp, 'themes/zelda/renderer.ts')).href)
}

const { SPRITES, ENEMY_SPRITES } = await loadRenderer()

const HERO_KEYS = ['H', 'h', 'F', 'E', 'T', 't', 'B', 'G']
const FOE_KEYS = ['P', 'p', 'D', 'W', 'V', 'v', 'E', 'G', 'g', 'e']
const ALL_KEYS = new Set(['.', ...HERO_KEYS, ...FOE_KEYS])

function keyOf(map) {
  return [...map.join('')].filter((c) => c !== '.').sort().join('')
}

describe('zelda pixel sprites', () => {
  it('every map is rectangular, bounded and charset-clean', () => {
    for (const [name, map] of Object.entries(SPRITES)) {
      assert.ok(Array.isArray(map) && map.length > 0, `${name} non-empty`)
      const w = map[0].length
      assert.ok(w >= 7 && w <= 22, `${name} width ${w} in sprite vocabulary`)
      assert.ok(map.length >= 5 && map.length <= 16, `${name} height ${map.length} in vocabulary`)
      for (const row of map) {
        assert.equal(row.length, w, `${name} rectangular`)
        for (const ch of row) {
          assert.ok(ALL_KEYS.has(ch), `${name} unknown pixel '${ch}'`)
        }
      }
    }
  })

  it('hero has head/hood, torso, boots and directional faces', () => {
    for (const k of ['heroDown0', 'heroDown1', 'heroUp0', 'heroUp1', 'heroSide0', 'heroSide1']) {
      assert.ok(SPRITES[k], `${k} exists`)
    }
    const flat = (m) => m.join('')
    // Down/side show the face; up shows the back of the hood.
    assert.ok(flat(SPRITES.heroDown0).includes('F'), 'down has a face')
    assert.ok(flat(SPRITES.heroDown0).includes('E'), 'down has eyes')
    assert.ok(!flat(SPRITES.heroUp0).includes('F'), 'up hides the face')
    assert.ok(!flat(SPRITES.heroUp0).includes('E'), 'up hides the eyes')
    assert.ok(flat(SPRITES.heroSide0).includes('F'), 'side has a face')
    // Torso and boots rows exist in every hero frame.
    for (const k of ['heroDown0', 'heroUp0', 'heroSide0']) {
      const f = flat(SPRITES[k])
      assert.ok(f.includes('T'), `${k} has a torso`)
      assert.ok(f.includes('B'), `${k} has boots`)
      assert.ok(f.includes('H'), `${k} has a hood`)
    }
    // Walk frames differ (legs), bodies match.
    assert.notEqual(flat(SPRITES.heroDown0), flat(SPRITES.heroDown1), 'down walk frames differ')
    assert.notEqual(flat(SPRITES.heroSide0), flat(SPRITES.heroSide1), 'side walk frames differ')
  })

  it('all six enemy kinds exist with distinct silhouettes', () => {
    const kinds = ['chaser', 'wanderer', 'turret', 'bat', 'knight', 'slimeKnight']
    for (const k of kinds) {
      assert.ok(ENEMY_SPRITES[k], `${k} registered`)
      for (const s of ENEMY_SPRITES[k]) {
        assert.ok(SPRITES[s], `${k} sprite ${s} exists`)
      }
    }
    const seen = new Set()
    for (const k of kinds) {
      const k2 = ENEMY_SPRITES[k].map((s) => keyOf(SPRITES[s])).join('|')
      assert.ok(!seen.has(k2), `${k} silhouette is distinct`)
      seen.add(k2)
    }
    // Bat flaps, blob squashes: two frames each.
    assert.equal(ENEMY_SPRITES.bat.length, 2, 'bat has 2 wing frames')
    assert.equal(ENEMY_SPRITES.wanderer.length, 2, 'wanderer has 2 squash frames')
  })

  it('hearts read full vs empty', () => {
    assert.ok(SPRITES.heart, 'heart exists')
    assert.ok(SPRITES.heartEmpty, 'heartEmpty exists')
    assert.notEqual(SPRITES.heart.join(''), SPRITES.heartEmpty.join(''), 'full differs from empty')
  })

  it('no retired vivid green/violet accents in the renderer source', () => {
    const root = new URL('..', import.meta.url)
    const src = readFileSync(new URL('themes/zelda/renderer.ts', root), 'utf8').toLowerCase()
    assert.ok(!src.includes('#35f2c8'), 'old vivid grass green is gone')
    assert.ok(!src.includes('#7b3fe4'), 'old violet outline is gone')
  })
})
