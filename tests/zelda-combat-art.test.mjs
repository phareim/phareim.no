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

test('every sprite is a rectangle of palette letters, and the frames of an animation differ', () => {
  const strips = new Map()
  for (const [name, { rows }] of Object.entries(SPRITES)) {
    assert.ok(rows.length > 0 && rows.every(row => row.length === rows[0].length), `${name}: ragged`)
    for (const row of rows) for (const ch of row) if (ch !== '.' && !PAL[ch]) assert.fail(`${name}: '${ch}' is not a palette letter`)
    const stem = name.match(/^(hitfx|hitfx_gold|slash|wild_[a-z]+)_\d+$/)?.[1]
    if (stem) strips.set(stem, [...(strips.get(stem) ?? []), rows.join('\n')])
  }
  // The combat marks and the small animals are drawn as strips: each frame its own picture, all one size.
  assert.ok(strips.size >= 9, `${strips.size} strips`)
  for (const [stem, frames] of strips) {
    assert.equal(new Set(frames).size, frames.length, `${stem}: two frames alike`)
    assert.equal(new Set(frames.map(f => f.split('\n').map(r => r.length).join())).size, 1, `${stem}: frames of two sizes`)
  }
})
