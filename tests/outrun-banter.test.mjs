import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  LINES, REACT_QUIET, IDLE_QUIET, LINE_GAP,
  createBanter, cueBanter, stepBanter, spokenLine, lineLife, priority,
} from '../themes/outrun/banter.ts'
import { STAGES } from '../themes/outrun/engine.ts'

const NOVA = ['calm', 'smirk', 'angry', 'surprised', 'shout', 'wince', 'laugh', 'eyeroll', 'set']
const REX = ['cheerful', 'eating', 'sheepish', 'worried']
// What the 5×7 canvas font draws (lower case is drawn as capitals).
const FONT = /^[A-Za-z0-9 .,!?'":;\-—()&]+$/

/** Runs the clock until the banter is silent; returns the lines that were shown, in order. */
function hear(b, max = 30) {
  const heard = []
  let last = null
  for (let t = 0; t < max; t += 1 / 30) {
    const line = spokenLine(b)
    if (line && line.text !== last) heard.push(line)
    last = line ? line.text : null
    if (!b.now && !b.pending) break
    stepBanter(b, 1 / 30, true)
  }
  return heard
}

describe('the lines', () => {
  const all = Object.entries(LINES).flatMap(([cue, pool]) => pool.map(lines => ({ cue, lines })))

  it('has an exchange of one to three lines for every cue', () => {
    for (const [cue, pool] of Object.entries(LINES)) {
      assert.ok(pool.length >= 2, `${cue} has ${pool.length}`)
      for (const lines of pool) assert.ok(lines.length >= 1 && lines.length <= 3, cue)
    }
  })

  it('has lines for every biome on the map', () => {
    for (const def of STAGES.flat()) assert.ok(LINES[`stage:${def.biome}`], def.biome)
  })

  it('gives each speaker a face that exists', () => {
    for (const { cue, lines } of all) {
      for (const l of lines) assert.ok((l.who === 'nova' ? NOVA : REX).includes(l.mood), `${cue}: ${l.who} ${l.mood}`)
    }
  })

  it('fits the talk box and the font', () => {
    for (const { cue, lines } of all) {
      for (const l of lines) {
        assert.ok(l.text.length <= 56, `${cue}: "${l.text}" is ${l.text.length} long`)
        assert.match(l.text, FONT, `${cue}: "${l.text}"`)
      }
    }
  })

  it('keeps Nova to nine words and "wicked" to one', () => {
    let wicked = 0
    for (const { lines } of all) {
      for (const l of lines) {
        if (/wicked/i.test(l.text)) wicked++
        if (l.who === 'nova') assert.ok(l.text.split(/\s+/).length <= 9, l.text)
      }
    }
    assert.ok(wicked <= 1)
  })

  it('says nothing twice', () => {
    const texts = all.map(e => e.lines.map(l => l.text).join(' / '))
    assert.equal(new Set(texts).size, texts.length)
  })
})

describe('the talk', () => {
  it('is the same for the same seed', () => {
    const run = (seed) => {
      const b = createBanter(seed)
      cueBanter(b, 'go')
      const a = hear(b)
      for (let t = 0; t < 40; t += 1 / 30) stepBanter(b, 1 / 30)
      return [...a, ...hear(b)].map(l => l.text).join('|')
    }
    assert.equal(run(7), run(7))
    assert.notEqual(run(7), run(8))
  })

  it('says the lines of an exchange in turn, each long enough to read', () => {
    const b = createBanter(3)
    assert.ok(cueBanter(b, 'go'))
    const first = spokenLine(b)
    assert.ok(first)
    assert.equal(first.life, lineLife(first.text))
    assert.ok(first.life >= 2 && first.life <= 4.6)
    const heard = hear(b)
    assert.ok(heard.length >= 1 && heard.length <= 3)
    assert.equal(spokenLine(b), null)
    assert.ok(LINE_GAP > 0)
  })

  it('never repeats an exchange in a run, and falls silent when a cue is used up', () => {
    const b = createBanter(11)
    const seen = new Set()
    for (let k = 0; k < LINES.tunnel.length + 2; k++) {
      b.quiet = REACT_QUIET + 1
      const ok = cueBanter(b, 'tunnel')
      assert.equal(ok, k < LINES.tunnel.length)
      const key = hear(b).map(l => l.text).join('/')
      if (ok) {
        assert.ok(!seen.has(key))
        seen.add(key)
      }
    }
    assert.equal(seen.size, LINES.tunnel.length)
  })

  it('makes a reaction wait for five quiet seconds', () => {
    const b = createBanter(5)
    assert.equal(priority('close'), 1)
    assert.equal(cueBanter(b, 'close'), false)
    for (let t = 0; t < REACT_QUIET + 0.1; t += 1 / 30) stepBanter(b, 1 / 30, true)
    assert.equal(cueBanter(b, 'close'), true)
    // While that is being said, another reaction is dropped.
    assert.equal(cueBanter(b, 'bump'), false)
  })

  it('starts small talk by itself after a quiet stretch, but not while held', () => {
    const b = createBanter(9)
    for (let t = 0; t < IDLE_QUIET[1] + 1; t += 1 / 30) stepBanter(b, 1 / 30, true)
    assert.equal(spokenLine(b), null)
    stepBanter(b, 1 / 30)
    assert.ok(spokenLine(b))
    assert.equal(b.now.cue, 'idle')
  })

  it('lets an urgent cue cut in on small talk and wait behind an urgent one', () => {
    const b = createBanter(2)
    for (let t = 0; t < IDLE_QUIET[1] + 1; t += 1 / 30) stepBanter(b, 1 / 30)
    assert.equal(b.now.cue, 'idle')
    assert.ok(cueBanter(b, 'fork-right'))
    assert.equal(b.now.cue, 'fork-right')
    assert.ok(cueBanter(b, 'stage:pass'))
    assert.equal(b.now.cue, 'fork-right')
    assert.equal(b.pending, 'stage:pass')
    for (let t = 0; t < 12 && b.now?.cue === 'fork-right'; t += 1 / 30) stepBanter(b, 1 / 30)
    stepBanter(b, 1 / 30)
    assert.equal(b.now?.cue, 'stage:pass')
    assert.equal(b.pending, null)
  })

  it('speaks of a new stage with the checkpoint lines once its own are used up', () => {
    const b = createBanter(4)
    for (let k = 0; k < LINES['stage:farms'].length; k++) {
      assert.ok(cueBanter(b, 'stage:farms'))
      hear(b)
    }
    assert.ok(cueBanter(b, 'stage:farms'))
    const text = spokenLine(b).text
    assert.ok(LINES.checkpoint.some(lines => lines[0].text === text))
  })

  it('is done after the end of the run', () => {
    const b = createBanter(6)
    cueBanter(b, 'go')
    assert.ok(cueBanter(b, 'goal'))
    assert.equal(b.now.cue, 'goal')
    hear(b)
    assert.equal(cueBanter(b, 'tumble'), false)
    for (let t = 0; t < 40; t += 1 / 30) stepBanter(b, 1 / 30)
    assert.equal(spokenLine(b), null)
  })
})
