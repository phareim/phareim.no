import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LINES } from '../themes/outrun/banter.ts'
import { shadeRgb } from '../themes/outrun/color.ts'

const here = dirname(fileURLToPath(import.meta.url))
const dir = join(here, '../public/outrun')
// art.ts loads pictures in a browser; its list of names is read from the source.
const source = readFileSync(join(here, '../themes/outrun/art.ts'), 'utf8')
const ART = [...source.slice(source.indexOf('export const ART = ['), source.indexOf('] as const')).matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1])
const files = readdirSync(dir).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4)).sort()

describe('the pictures', () => {
  it('ships every picture the game asks for, and none it does not', () => {
    assert.deepEqual(files, [...ART].sort())
  })

  it('are indexed bitmaps (a palette, no smooth alpha)', () => {
    for (const name of files) {
      const png = readFileSync(join(dir, `${name}.png`))
      // IHDR: the colour type is the byte after width, height and bit depth; 3 is a palette.
      assert.equal(png[25], 3, `${name} is not an indexed PNG`)
    }
  })

  it('has a portrait for every face the two of them make', () => {
    for (const pool of Object.values(LINES)) {
      for (const lines of pool) for (const l of lines) assert.ok(files.includes(`${l.who}-${l.mood}`), `${l.who}-${l.mood}`)
    }
  })

  it('stays small', () => {
    const bytes = files.reduce((n, f) => n + readFileSync(join(dir, `${f}.png`)).length, 0)
    assert.ok(bytes < 260_000, `${bytes} bytes`)
  })
})

describe('the hour\'s shade', () => {
  const night = { tint: [8, 14, 54], k: 0.4 }

  it('darkens what is plain and leaves what is lit', () => {
    assert.deepEqual(shadeRgb(120, 120, 120, night), [75, 78, 94])
    // A sodium lamp, a tail lamp, a cathode screen.
    assert.deepEqual(shadeRgb(255, 184, 60, night), [255, 184, 60])
    assert.deepEqual(shadeRgb(226, 52, 63, night), [226, 52, 63])
    assert.deepEqual(shadeRgb(150, 190, 240, night), [150, 190, 240])
  })

  it('shades the lit colours too when asked', () => {
    assert.notDeepEqual(shadeRgb(255, 184, 60, { ...night, all: true }), [255, 184, 60])
  })

  it('is nothing at k = 0', () => {
    assert.deepEqual(shadeRgb(12, 34, 56, { tint: [0, 0, 0], k: 0 }), [12, 34, 56])
  })
})
