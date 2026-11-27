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

describe('a control beside the world that has the keyboard (the corner\'s buttons)', () => {
  const button = () => { const b = { blurred: 0, blur() { b.blurred++ }, closest: sel => (sel === '[data-game-keys]' || sel.includes('button') ? b : null) }; return b }
  const key = (code, target) => { const e = { code, target, prevented: false, preventDefault() { e.prevented = true } }; on.keydown(e); return e }
  it('keeps Enter, Space and Tab for itself', () => {
    const b = button()
    key('Space', b)
    key('Enter', b)
    assert.equal(input.read().aPress, false, 'Space on the button is the button\'s, not the sword\'s')
    assert.equal(b.blurred, 0)
    assert.equal(key('Tab', b).prevented, false)
  })
  it('gives every other key back to the game, and lets go of the keyboard', () => {
    const b = button()
    key('ArrowLeft', b)
    assert.equal(b.blurred, 1)
    assert.ok(input.read().move.x < 0, 'the arrow walks')
    on.keyup({ code: 'ArrowLeft' })
  })
  it('still leaves the keys of any other button or link alone', () => {
    const a = { closest: sel => (sel === '[data-game-keys]' ? null : a) }
    key('ArrowLeft', a)
    assert.equal(input.read().move.x, 0)
  })
})


describe('the roll', () => {
  const key = (code, type = 'keydown') => { const e = { code, target: null, prevented: false, repeat: false, preventDefault() { e.prevented = true } }; on[type](e); return e }
  it('L and C roll (once per press); C no longer cycles; the deck\'s pad rolls too', () => {
    assert.equal(key('KeyL').prevented, true)
    let i = input.read()
    assert.equal(i.rollPress, true)
    assert.equal(i.cycle, false)
    assert.equal(input.read().rollPress, undefined, 'one press, one roll')
    key('KeyC')
    i = input.read()
    assert.equal(i.rollPress, true)
    assert.equal(i.cycle, false)
    key('KeyQ')
    assert.equal(input.read().cycle, true, 'Q still cycles')
    input.pressRoll()
    assert.equal(input.read().rollPress, true)
  })
})
