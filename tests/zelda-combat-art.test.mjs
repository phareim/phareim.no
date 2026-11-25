import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSync } from 'esbuild'
import { fileURLToPath } from 'node:url'

const { outputFiles: [bundle] } = buildSync({
  stdin: {
    contents: `
      export { bladeHeading } from './render/bladeAngles'
      export { BLADE_ART, BLADE_PAL } from './render/iso/heroArt'
      export { SPRITES, PAL } from './render/sprites'
    `,
    resolveDir: fileURLToPath(new URL('../themes/zelda/', import.meta.url)),
    loader: 'ts',
  },
  bundle: true,
  write: false,
  format: 'esm',
})
const { bladeHeading, BLADE_ART, BLADE_PAL, SPRITES, PAL } =
  await import('data:text/javascript;base64,' + Buffer.from(bundle.contents).toString('base64'))

test('a swing selects sixteen blade orientations, with matching classic and iso art', () => {
  const steps = Array.from({ length: 16 }, (_, i) => bladeHeading(i * Math.PI / 8))
  assert.equal(new Set(steps.map(step => JSON.stringify(step))).size, 16)
  assert.deepEqual(bladeHeading(-Math.PI / 8), steps[15])
  for (const { name } of steps) for (const blade of [name, name.replace('sword_', 'sword2_')]) {
    const classic = SPRITES[blade].rows
    const iso = BLADE_ART[blade]
    assert.equal(iso.length, classic.length * 2, blade)
    for (const row of iso) {
      assert.equal(row.length, classic[0].length * 2, blade)
      assert.ok([...row].every(ch => ch === '.' || BLADE_PAL[ch]), blade)
    }
  }
})

test('combat marks and small animals arrive in the classic sprite registry', () => {
  for (const [id, n, w, h] of [
    ['hitfx', 4, 16, 16], ['hitfx_gold', 4, 16, 16], ['slash', 3, 24, 8],
    ['wild_fish', 4, 9, 6], ['wild_gull', 2, 11, 6], ['wild_crow', 2, 11, 6],
    ['wild_moth', 2, 5, 5], ['wild_butterfly', 2, 5, 5], ['wild_frog', 2, 8, 7],
  ]) {
    const seen = new Set()
    for (let i = 0; i < n; i++) {
      const { rows } = SPRITES[`${id}_${i}`]
      assert.equal(rows.length, h, id)
      for (const row of rows) {
        assert.equal(row.length, w, id)
        assert.ok([...row].every(ch => ch === '.' || PAL[ch]), id)
      }
      seen.add(rows.join('\n'))
    }
    assert.equal(seen.size, n, id)
  }
})
