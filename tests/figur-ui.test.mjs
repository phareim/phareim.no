// Lag Din Figur's studio logic outside the components: the drawing
// board's undo stack and stroke lines, the stage's and board's
// whole-number fits (a dress must fit a phone), the download names, and
// the pixel icons' shapes.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
async function bundle(file) {
  const out = await esbuild.build({
    entryPoints: [join(repo, file)],
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}
const m = await bundle('themes/figur/ui/board.ts')
const icons = await bundle('themes/figur/ui/icons.ts')

const tex = (fill) => ({ w: 2, h: 2, px: [fill, null, null, null] })

test('undo keeps one step per stroke, newest first, and forgets the oldest past the limit', () => {
  const u = m.newUndo()
  assert.equal(m.canUndo(u), false)
  assert.equal(m.popUndo(u), null)
  m.pushUndo(u, tex('#000000'))
  m.pushUndo(u, tex('#000000')) // the same picture twice is one step
  m.pushUndo(u, tex('#ffffff'))
  assert.equal(u.stack.length, 2)
  assert.equal(m.popUndo(u).px[0], '#ffffff')
  assert.equal(m.popUndo(u).px[0], '#000000')
  assert.equal(m.canUndo(u), false)
  for (let i = 0; i < m.UNDO_MAX + 10; i++) m.pushUndo(u, { w: 1, h: 1, px: [i % 2 ? '#111111' : null] })
  assert.equal(u.stack.length, m.UNDO_MAX)
})

test('sameTexture compares every pixel', () => {
  assert.ok(m.sameTexture(tex('#123456'), tex('#123456')))
  assert.ok(!m.sameTexture(tex('#123456'), tex('#654321')))
  assert.ok(!m.sameTexture(tex(null), { w: 4, h: 1, px: [null, null, null, null] }))
})

test('a stroke line has no gaps and includes both ends', () => {
  assert.deepEqual(m.lineCells(2, 3, 2, 3), [[2, 3]])
  const diag = m.lineCells(0, 0, 5, 2)
  assert.deepEqual(diag[0], [0, 0])
  assert.deepEqual(diag.at(-1), [5, 2])
  for (let i = 1; i < diag.length; i++) {
    const [ax, ay] = diag[i - 1]
    const [bx, by] = diag[i]
    assert.ok(Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1, 'neighbours')
  }
  const back = m.lineCells(4, 7, 0, 0)
  assert.deepEqual(back.at(-1), [0, 0])
  assert.equal(back.length, 8)
})

test('cellAt finds the cell under a point and nothing outside', () => {
  assert.deepEqual(m.cellAt(0, 0, 20, 16, 24), [0, 0])
  assert.deepEqual(m.cellAt(39, 41, 20, 16, 24), [1, 2])
  assert.equal(m.cellAt(-1, 5, 20, 16, 24), null)
  assert.equal(m.cellAt(320, 5, 20, 16, 24), null)
  assert.equal(m.cellAt(5, 480, 20, 16, 24), null)
  assert.equal(m.cellAt(5, 5, 0, 16, 24), null)
})

test('the board fits a dress on a 375×667 phone with cells a finger can hit', () => {
  // The board's grid area on a phone: the width less the preview column, the height less header, tools and palette.
  const cell = m.boardCell(375 - 24 - 84, 667 - 56 - 60 - 150 - 24, 16, 24)
  assert.ok(cell >= 14, `dress cell ${cell}`)
  assert.ok(16 * cell <= 375 - 24 - 84 && 24 * cell <= 667 - 56 - 60 - 150 - 24)
  // Big screens stop at the cap.
  assert.equal(m.boardCell(2000, 2000, 6, 4), 44)
  assert.equal(m.boardCell(10, 10, 16, 24), 1)
})

test('the stage scales by a whole number and fills the area with backdrop', () => {
  const fit = m.stageFit(375, 260, { w: 32, h: 44 })
  assert.equal(fit.scale, 5)
  assert.equal(fit.w, 75)
  assert.equal(fit.h, 52)
  assert.ok(fit.w * fit.scale <= 375 && fit.h * fit.scale <= 260)
  // Smaller than the style: still scale 1 and the style's size.
  assert.deepEqual(m.stageFit(10, 10, { w: 32, h: 44 }), { scale: 1, w: 32, h: 44 })
})

test('exports get a big whole-number scale', () => {
  assert.equal(m.exportScale(64, 64), 16)
  assert.equal(m.exportScale(80, 100), 10)
  assert.equal(m.exportScale(2000, 10), 1)
})

test('file names are plain', () => {
  assert.equal(m.fileSlug('Ulrikke Å'), 'ulrikke-a')
  assert.equal(m.fileSlug('Prinsesse Ærlig Øy'), 'prinsesse-aerlig-oy')
  assert.equal(m.fileSlug('---'), 'figur')
  assert.equal(m.pictureFileName('Figur 1', 'minecraft'), 'figur-figur-1-minecraft.png')
  assert.equal(m.skinFileName('Mia'), 'mia-skin.png')
})

test('every icon is a rectangle of pixels', () => {
  assert.deepEqual(icons.iconProblems(), [])
  assert.deepEqual(icons.iconSize('pip'), { w: 16, h: 14 })
})

test('name fields drop what a name cannot hold, quietly', () => {
  assert.equal(m.typedName('Mia!!', 16), 'Mia')
  assert.equal(m.typedName('Ærlig Øy-2 🦄', 16), 'Ærlig Øy-2 ')
  assert.equal(m.typedName('abcdefghijklmnopqrst', 16), 'abcdefghijklmnop')
  assert.equal(m.typedName('Min kjole ♥', 20), 'Min kjole ')
})

test('the save must fit the 32 KB profile slot, counted in UTF-8 bytes', async () => {
  const core = await bundle('themes/figur/core/save.ts')
  const tex = await bundle('themes/figur/core/textures.ts')
  assert.equal(m.saveBytes({ n: 'æøå' }), JSON.stringify({ n: 'æøå' }).length + 3)
  // A worst case: eight figures and forty 16-colour dresses, every pixel noisy.
  let save = core.newSave(() => 0.5)
  for (let i = 1; i < 8; i++) save = core.addFigure(save)
  const pal = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#ffffff', '#000000',
    '#880000', '#008800', '#000088', '#888800', '#880088', '#008888', '#888888', '#444444']
  const noisy = (seed) => {
    const t = tex.blankTexture('dress')
    return { ...t, px: t.px.map((_, i) => pal[(i * 7 + seed * 13 + ((i * i) % 11)) % pal.length]) }
  }
  const sizes = []
  for (let i = 0; i < 40; i++) {
    const next = core.saveDrawn(save, { id: core.newDrawnId(save), name: `Min kjole ${i + 1}`, kind: 'dress', tex: tex.packTexture(noisy(i)), createdAt: 1 })
    assert.equal(typeof next, 'object')
    if (!m.fitsSlot(next, save)) break
    save = next
    sizes.push(m.saveBytes(save))
  }
  assert.ok(sizes.every(n => n <= m.SAVE_MAX_BYTES), 'every accepted save fits')
  // Near the limit, one more drawn dress is refused.
  const nearly = { ...core.newSave(() => 0.5), pad: '' }
  nearly.pad = 'æ'.repeat(Math.floor((m.SAVE_MAX_BYTES - m.saveBytes(nearly) - 200) / 2))
  assert.ok(m.saveBytes(nearly) <= m.SAVE_MAX_BYTES && m.saveBytes(nearly) > m.SAVE_MAX_BYTES - 210)
  const plusDress = core.saveDrawn(nearly, { id: core.newDrawnId(nearly), name: 'Min kjole', kind: 'dress', tex: tex.packTexture(noisy(1)), createdAt: 1 })
  assert.ok(!m.fitsSlot({ ...plusDress, pad: nearly.pad }, nearly), 'a dress past the limit is refused')
  // Deleting from a save is always allowed, even an over-full one.
  const big = { ...save, pad: 'x'.repeat(m.SAVE_MAX_BYTES) }
  const smaller = { ...big, closet: big.closet.slice(1) }
  assert.ok(m.fitsSlot(smaller, big))
  assert.ok(!m.fitsSlot(big, save))
})
