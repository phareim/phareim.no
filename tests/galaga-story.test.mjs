import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDirector, sectorFor, callsignFrom, fill, lineDuration, visibleChars, roman,
  CUES, GAP_MS, AMBIENT_GAP_MS,
} from '../themes/galaga/story.ts'

const fresh = () => createDirector({ rng: () => 0, seen: new Set() })

test('sectors: five named, the Conductor ends the fifth, then deep choir', () => {
  assert.equal(sectorFor(0).name, 'KESTREL APPROACH')
  assert.equal(sectorFor(0).boss, 'CANTOR I')
  assert.equal(sectorFor(4).boss, 'THE CONDUCTOR')
  assert.equal(sectorFor(5).name, 'DEEP CHOIR I')
  assert.equal(sectorFor(5).num, 6)
  for (let i = 0; i < 12; i++) assert.equal(sectorFor(i).tints.length, 4)
  assert.equal(roman(4), 'IV')
  assert.equal(roman(14), '14')
})

test('callsign is the Hall of Fame animal, lowercase', () => {
  assert.equal(callsignFrom('Neon Otter'), 'otter')
  assert.equal(callsignFrom('Flux Capybara'), 'capybara')
  assert.equal(callsignFrom(null), 'pilot')
  assert.equal(fill('copy, {cs}. sector {n}.', { cs: 'otter', n: 3 }), 'copy, otter. sector 3.')
  assert.equal(fill('{missing}', {}), '{missing}')
})

test('a cue plays its lines in order, one at a time, with a gap', () => {
  const d = fresh()
  d.setVars({ cs: 'otter' })
  assert.ok(d.cue('start:first', 0))
  const first = d.tick(0)
  assert.equal(first.text, 'morning, otter. claude here, second seat.')
  assert.equal(first.who, 'claude')
  assert.equal(d.tick(first.end - 1).id, first.id)
  assert.equal(d.tick(first.end), null) // gap between lines
  const second = d.tick(first.end + GAP_MS)
  assert.ok(second.text.startsWith('kestrel lost'))
  // The typewriter shows nothing at the start and everything once typed.
  assert.equal(visibleChars(second, second.start), 0)
  assert.equal(visibleChars(second, second.typed), second.text.length)
  assert.ok(lineDuration('abc').total > lineDuration('abc').type)
})

test('once-per-session and once-per-run cues', () => {
  const seen = new Set()
  const d = createDirector({ rng: () => 0, seen })
  assert.ok(d.cue('meet:sniper', 0))
  assert.ok(!d.cue('meet:sniper', 10)) // already waiting
  const tip = d.tick(0) // seen once it plays
  d.tick(tip.end + GAP_MS)
  assert.ok(!d.cue('meet:sniper', 100000))
  assert.ok(d.cue('hull:1', 100000))
  d.tick(100000)
  assert.ok(!d.cue('hull:1', 101000))
  d.resetRun()
  assert.ok(d.cue('hull:1', 102000)) // run-scoped: back after a reset
  assert.ok(!d.cue('meet:sniper', 103000)) // session-scoped: still spent
  // A remount shares the session memory.
  const again = createDirector({ seen })
  assert.ok(!again.cue('meet:sniper', 0))
})

test('ambient chatter only lands in silence and respects its cooldown', () => {
  const d = fresh()
  d.cue('meet:diver', 0)
  assert.ok(!d.cue('combo:4', 0)) // busy
  const line = d.tick(0)
  d.tick(line.end)
  assert.ok(!d.cue('combo:4', line.end + 100)) // too soon after a line
  const quiet = line.end + AMBIENT_GAP_MS + 1
  assert.ok(d.cue('combo:4', quiet))
  d.tick(quiet)
  d.resetRun()
  assert.ok(!d.cue('combo:4', quiet + AMBIENT_GAP_MS + 1)) // 40 s cooldown
})

test('story beats cut ambient lines and jump the teaching queue', () => {
  const d = fresh()
  assert.ok(d.cue('taunt', 20000))
  const taunt = d.tick(20000)
  assert.equal(taunt.who, 'choir')
  d.cue('meet:weaver', 20100)
  d.cue('boss:1', 20200)
  assert.ok(d.current.end <= 20200 + 120) // taunt cut short
  const next = d.tick(20200 + 120 + GAP_MS)
  assert.equal(next.key, 'boss:1')
  assert.equal(next.who, 'choir')
  assert.equal(d.queued, 1) // the Claude half of the exchange; the weaver tip was dropped
})

test('variants do not repeat back to back', () => {
  const d = createDirector({ rng: () => 0, seen: new Set() })
  const texts = []
  let t = 0
  for (let i = 0; i < 3; i++) {
    d.cue('boss:down', t)
    const l = d.tick(t)
    texts.push(l.text)
    t = l.end + GAP_MS
    d.tick(t)
  }
  assert.notEqual(texts[0], texts[1])
  assert.notEqual(texts[1], texts[2])
})

test('the script follows the two voices', () => {
  for (const [key, def] of Object.entries(CUES)) {
    for (const variant of def.variants) {
      for (const line of variant) {
        if (line.who === 'claude') assert.equal(line.text, line.text.toLowerCase(), `${key}: claude speaks lowercase`)
        else assert.equal(line.text, line.text.toUpperCase(), `${key}: the choir speaks uppercase`)
        assert.ok(!line.text.includes('!'), `${key}: no exclamation marks`)
        assert.ok(line.text.length <= 110, `${key}: two lines max`)
      }
    }
  }
})

test('a teaching line cut mid-sentence comes back after the story beat', () => {
  const d = fresh()
  d.cue('sync:ready', 0, { sync: 'press shift' })
  const tip = d.tick(0)
  d.cue('hull:1', 200)
  const keys = []
  let t = 200
  for (let i = 0; i < 80; i++) {
    const l = d.tick(t)
    if (l && keys[keys.length - 1] !== l.key) keys.push(l.key)
    t += 250
  }
  assert.deepEqual(keys, ['sync:ready', 'hull:1', 'sync:ready'])
  assert.ok(tip.text.includes('press shift'))
})

test('a tip dropped before it plays can be asked for again', () => {
  const d = fresh()
  d.cue('start:first', 0)
  d.cue('meet:heavy', 10)
  d.cue('boss:1', 20) // story beat clears queued tips
  let t = 20
  for (let i = 0; i < 200; i++) { d.tick(t); t += 250 }
  assert.ok(d.cue('meet:heavy', t)) // never said, so still available
})

test('nothing resumes after a hush', () => {
  const d = fresh()
  d.cue('meet:sniper', 0)
  d.tick(0)
  d.hush(100)
  d.cue('death', 100)
  const keys = []
  let t = 100
  for (let i = 0; i < 80; i++) {
    const l = d.tick(t)
    if (l && keys[keys.length - 1] !== l.key) keys.push(l.key)
    t += 250
  }
  assert.deepEqual(keys, ['meet:sniper', 'death'])
})
