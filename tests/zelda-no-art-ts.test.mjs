// Neon Shrine's iso art moved out of the TS into art packs (ART-PLAN phase 3b; docs/games/neon-shrine.md, "The art
// packs"): the stalls, the machines and every realm kit with its gate arches are PNGs in the fixer art library, pinned
// in render/iso/artIndex.ts and baked by scripts/zelda-lab/art-pack.mjs. This fails when one of their TS tables comes
// back (an old-style bake) or when any other file under render/iso grows a table of that kind: a *Art.ts or *Data.ts
// over 20 KB, or a base64 string over 20 KB. The art still inline (3c/3d, the hero) is listed below; the list only shrinks.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const iso = join(repo, 'themes/zelda/render/iso')

/** The files phase 3b deleted: their art is in the packs now. */
const MOVED = [
  'stallArt.ts', 'machineArt.ts',
  ...['coast', 'fjord', 'fogstage', 'gates', 'landing', 'meadow', 'quarry', 'rerun', 'seter', 'sporelight', 'stillsand', 'underglow'].map(k => `frontierArt/${k}Data.ts`),
]
/** Still inline, each until its phase moves it: the base things (3c), the folk, the bosses and the people (3d), the hero. */
const STILL_INLINE = new Set(['thingArt.ts', 'ferryArt.ts', 'frontierArt/roadsideData.ts', 'folkArt.ts', 'bossArt.ts', 'frontierArt/peopleData.ts', 'foeHurtData.ts', 'heroArt.ts', 'heroPoses.ts'])
const LIMIT = 20 * 1024

const files = dir => readdirSync(dir).flatMap(f => statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)])

describe('zelda iso art: no TS art tables for what is packed', () => {
  it('the packed groups\' TS tables are gone', () => {
    assert.deepEqual(MOVED.filter(f => existsSync(join(iso, f))), [], 'baked as TS again: bake with scripts/zelda-lab/art-pack.mjs')
  })

  it('no other file under render/iso holds a table of art', () => {
    const big = []
    for (const p of files(iso).filter(p => p.endsWith('.ts'))) {
      const rel = relative(iso, p)
      if (STILL_INLINE.has(rel)) continue
      const text = readFileSync(p, 'utf8')
      if (/(Art|Data)\.ts$/.test(rel) && text.length > LIMIT) big.push(`${rel}: ${text.length} B`)
      const b64 = text.match(/[A-Za-z0-9+/=]{20481,}/)
      if (b64) big.push(`${rel}: a base64 string of ${b64[0].length} B`)
    }
    assert.deepEqual(big, [], 'art belongs in a pack (scripts/zelda-lab/art-pack.mjs)')
  })

  it('every pack is pinned in artIndex.ts with its two maps', () => {
    const text = readFileSync(join(iso, 'artIndex.ts'), 'utf8')
    for (const g of ['stalls', 'machines', 'coast', 'fjord', 'fogstage', 'landing', 'meadow', 'quarry', 'rerun', 'seter', 'sporelight', 'stillsand', 'underglow']) {
      for (const role of ['albedo', 'normal']) {
        assert.match(text, new RegExp(`https://media\\.fixer\\.ink/art/neon-shrine/neon-shrine-pack-${g}/${role}-[0-9a-f]{8}\\.png`), `${g} ${role}`)
      }
    }
  })
})
