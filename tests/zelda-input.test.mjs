// Neon Shrine's touch input (themes/zelda/input.ts) against a fake window:
// the floating stick, and a thumb that lands while a dialog is open.
import { describe, it, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')

let createInput
before(async () => {
  const out = esbuild.buildSync({ entryPoints: [join(root, 'input.ts')], bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error' })
  ;({ createInput } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64')))
})

const W = 800
let on
let talking
let input
const touch = (type, id, x, y = 300) => on[type]({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, target: null })

beforeEach(() => {
  on = {}
  talking = false
  globalThis.window = { innerWidth: W, addEventListener: (t, f) => { on[t] = f }, removeEventListener: () => {} }
  input = createInput({
    canvas: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: W }) }),
    touch: () => true, onTouch: () => {}, idle: () => false, paused: () => false, dialog: () => talking,
  })
  input.attach()
})

describe('the floating stick', () => {
  it('starts under a finger on the left and walks the way it is dragged', () => {
    touch('pointerdown', 1, 200)
    touch('pointermove', 1, 240)
    assert.ok(input.read().move.x > 0.9)
    touch('pointerup', 1, 240)
    assert.equal(input.read().move.x, 0)
  })
})

describe('a thumb that lands while a dialog is open (2026-10-06)', () => {
  it('moves the lines on, and is the stick once they close', () => {
    talking = true
    touch('pointerdown', 1, 200)
    assert.equal(input.read().aPress, true)
    assert.equal(input.stick, null)
    talking = false
    touch('pointermove', 1, 200)
    touch('pointermove', 1, 160)
    const i = input.read()
    assert.ok(i.move.x < -0.9)
    assert.equal(i.aPress, false)
    touch('pointerup', 1, 160)
    assert.equal(input.stick, null)
  })

  it('a drag during the lines walks nowhere: the stick starts where the finger is when they close', () => {
    talking = true
    touch('pointerdown', 1, 200)
    touch('pointermove', 1, 300)
    assert.equal(input.read().move.x, 0)
    talking = false
    touch('pointermove', 1, 300)
    assert.equal(input.read().move.x, 0)
    touch('pointermove', 1, 340)
    assert.ok(input.read().move.x > 0.9)
  })

  it('lifted before the lines close, or on the button side: no stick', () => {
    talking = true
    touch('pointerdown', 1, 200)
    touch('pointerup', 1, 200)
    touch('pointerdown', 2, 700)
    talking = false
    touch('pointermove', 1, 260)
    touch('pointermove', 2, 640)
    assert.equal(input.stick, null)
    assert.equal(input.read().move.x, 0)
  })
})
