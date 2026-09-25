// Star Fox story (OPERATION NIGHTLIGHT): the sector table and the ECHO
// loop, the callsign, the script's rules per voice, and the director with a
// fake game clock (tick(dt) in seconds).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDirector, createNudges, sectorFor, sectorVars, sectorCue, bossIntroCue, bossPhaseCue, bossDownCues,
  meetCue, pickCue, controlVars, callsignFrom, fill, lineDuration,
  CUES, SECTORS, BOSS_PHASES, STORY_ENEMIES, STORY_CAPSULES, MAX_CHARS, GAP_MS, AMBIENT_GAP_MS, NUDGE_AFTER,
} from '../themes/starfox/story.ts'
import { glyphRows, wrapText } from '../themes/zelda/render/font.ts'

const fresh = (o = {}) => createDirector({ rng: () => 0, seen: new Set(), ...o })
/** Tick in small steps until `pred` holds or `max` seconds pass. */
function until(d, pred, max = 60) {
  for (let t = 0; t < max; t += 0.05) {
    d.tick(0.05)
    if (pred(d)) return true
  }
  return false
}
/** Play everything queued; returns the keys in the order they started. */
function drain(d, max = 120) {
  const keys = []
  let last = 0
  for (let t = 0; t < max; t += 0.05) {
    d.tick(0.05)
    const s = d.spoken
    if (s && s.id !== last) { keys.push(s.key); last = s.id }
  }
  return keys
}

test('five named sectors with their biomes and bosses', () => {
  const want = [
    ['CORAL COAST', 'coast', 'pincer', 'THE PINCER'],
    ['WHISPER WOODS', 'woods', 'moth', 'THE MOTH'],
    ['EMBER FIELDS', 'ember', 'furnace', 'THE FURNACE'],
    ['MIRROR LAKE', 'lake', 'twins', 'THE TWINS'],
    ['THE HOLLOW CROWN', 'space', 'crown', 'THE CROWN'],
  ]
  want.forEach(([name, biome, boss, bossName], i) => {
    const s = sectorFor(i)
    assert.deepEqual([s.name, s.biome, s.boss, s.bossName], [name, biome, boss, bossName])
    assert.equal(s.loop, 0)
    assert.equal(s.num, i + 1)
    assert.equal(s.echo, '')
  })
  assert.equal(sectorFor(1).card, 'SECTOR 2 · WHISPER WOODS')
  assert.equal(sectorFor(-3).index, 0)
})

test('after the Crown the route loops as ECHO I, ECHO II, …', () => {
  const e = sectorFor(5)
  assert.equal(e.num, 6)
  assert.equal(e.loop, 1)
  assert.equal(e.base, 0)
  assert.equal(e.name, 'CORAL COAST')
  assert.equal(e.echo, 'ECHO I')
  assert.equal(e.card, 'ECHO I · CORAL COAST')
  assert.equal(e.bossName, 'ECHO PINCER')
  assert.equal(sectorFor(9).bossName, 'ECHO CROWN')
  const e2 = sectorFor(13)
  assert.equal(e2.loop, 2)
  assert.equal(e2.biome, 'lake')
  assert.equal(e2.bossName, 'ECHO II TWINS')
  for (let i = 0; i < 20; i++) assert.ok(sectorFor(i).bossName.length <= 18, sectorFor(i).bossName)
})

test('callsign is the Hall of Fame animal, lowercase', () => {
  assert.equal(callsignFrom('Neon Otter'), 'otter')
  assert.equal(callsignFrom('  Flux  Capybara '), 'capybara')
  assert.equal(callsignFrom(null), 'pilot')
  assert.equal(callsignFrom(''), 'pilot')
  assert.equal(fill('{cs} in {name}', { cs: 'otter', name: 'coral coast' }), 'otter in coral coast')
  assert.equal(fill('{missing}', {}), '{missing}')
})

test('cue helpers name cues that exist, for every sector, boss, enemy and capsule', () => {
  for (let i = 0; i < 15; i++) {
    assert.ok(CUES[sectorCue(i)], `sector ${i}: ${sectorCue(i)}`)
    assert.ok(CUES[bossIntroCue(i)], bossIntroCue(i))
    for (const k of bossDownCues(i)) assert.ok(CUES[k], k)
    const b = sectorFor(i).boss
    for (let p = 2; p <= BOSS_PHASES[b]; p++) assert.ok(CUES[bossPhaseCue(i, p)], `${b} phase ${p}`)
    assert.equal(bossPhaseCue(i, BOSS_PHASES[b] + 1), null)
    assert.equal(bossPhaseCue(i, 1), null)
  }
  assert.equal(sectorCue(0), 'sector:coast')
  assert.equal(sectorCue(4), 'sector:space')
  assert.equal(sectorCue(5), 'sector:echo')
  assert.equal(sectorCue(6), 'sector:echo:next')
  assert.deepEqual(bossDownCues(4), ['boss:down:crown', 'ending'])
  assert.deepEqual(bossDownCues(9), ['boss:down:crown', 'clear'])
  assert.deepEqual(bossDownCues(1), ['boss:down:moth', 'clear'])
  assert.equal(BOSS_PHASES.crown, 3)
  for (const k of STORY_ENEMIES) assert.ok(CUES[meetCue(k)], k)
  for (const k of STORY_CAPSULES) assert.ok(CUES[pickCue(k)], k)
  for (const k of ['launch', 'brief', 'retry', 'boss:warning', 'warn:behind', 'gold:all', 'teach:bomb', 'teach:charge',
    'hull:low', 'shield:down', 'wing:down', 'wing:back', 'set:rings', 'set:turrets', 'set:carrier', 'set:ambush',
    'clear', 'ending', 'best', 'death', 'taunt']) assert.ok(CUES[k], k)
  assert.equal(SECTORS.length, 5)
  const v = sectorVars(5)
  assert.equal(v.loop, 'echo i')
  assert.equal(v.name, 'coral coast')
})

test('the script follows the three voices', () => {
  const used = new Set()
  for (const [key, def] of Object.entries(CUES)) {
    assert.ok(def.variants.length >= 1, `${key}: has lines`)
    if (def.once !== 'session') assert.ok(def.variants.length >= 2, `${key}: repeats, so it needs variants`)
    for (const variant of def.variants) {
      assert.ok(variant.length >= 1 && variant.length <= 4, `${key}: short exchange`)
      for (const line of variant) {
        used.add(line.who)
        const t = line.text
        assert.ok(['claude', 'hollow', 'hangar'].includes(line.who), `${key}: speaker`)
        assert.ok(!t.includes('!'), `${key}: no exclamation marks`)
        assert.ok(t.length <= MAX_CHARS[line.who], `${key}: "${t}" is ${t.length} chars`)
        assert.equal(t, t.trim(), `${key}: no stray spaces`)
        if (line.who === 'hollow') {
          assert.equal(t, t.toUpperCase(), `${key}: the hollow speaks uppercase`)
          assert.ok(t.includes(' · '), `${key}: the hollow speaks in fragments`)
        } else {
          assert.equal(t, t.toLowerCase(), `${key}: ${line.who} speaks lowercase`)
          assert.ok(!t.includes('·'), `${key}: ${line.who} is a person, no fragments`)
        }
        for (const [, name] of t.matchAll(/\{(\w+)\}/g)) {
          assert.ok(['cs', 'run', 'n', 'name', 'loop', 'boss', 'start', 'bomb', 'charge'].includes(name), `${key}: unknown {${name}}`)
        }
      }
    }
  }
  assert.deepEqual([...used].sort(), ['claude', 'hangar', 'hollow'])
  // Filled with the longest real values, lines still fit.
  const vars = { cs: 'capybara', run: 12, n: 15, name: 'the hollow crown', loop: 'echo iii', boss: 'echo iii furnace',
    ...controlVars(true) }
  for (const [key, def] of Object.entries(CUES)) {
    for (const variant of def.variants) for (const line of variant) {
      const t = fill(line.text, vars)
      assert.ok(t.length <= MAX_CHARS[line.who] + 12, `${key}: filled "${t}" too long`)
    }
  }
})

test('a run opens with the hangar, then the briefing; later runs get a retry line', () => {
  const seen = new Set()
  const d = createDirector({ rng: () => 0, seen })
  d.startRun({ cs: 'otter', run: 1 })
  const first = d.current()
  assert.equal(first.who, 'hangar')
  assert.equal(first.shown, 0)
  const keys = drain(d)
  assert.deepEqual(keys, ['launch', 'brief', 'brief', 'brief', 'brief'])
  d.startRun({ run: 2 })
  const again = drain(d)
  assert.deepEqual(again, ['launch', 'retry'])
})

test('a line types out on the game clock, holds, then a gap before the next', () => {
  const d = fresh()
  d.setVars({ cs: 'otter' })
  assert.ok(d.cue('brief'))
  const l = d.current()
  assert.equal(l.text, 'otter, claude here. i am on your right, in the gold ship.')
  const dur = lineDuration(l.text)
  d.tick(0.26)
  assert.equal(d.current().shown, 10)
  d.tick((dur.type - 260) / 1000 + 0.001)
  assert.equal(d.current().shown, l.text.length)
  assert.equal(d.current().id, l.id)
  d.tick((dur.total - dur.type) / 1000)
  assert.equal(d.current(), null) // the gap
  d.tick(GAP_MS / 1000)
  assert.ok(d.current().text.startsWith('the hollow came in'))
  // Not ticking (pause) freezes the typewriter.
  const shown = d.current().shown
  d.tick(0)
  assert.equal(d.current().shown, shown)
})

test('reduced motion shows the whole line at once', () => {
  const d = fresh({ reduced: true })
  d.cue('meet:sniper')
  const l = d.current()
  assert.equal(l.shown, l.text.length)
})

test('once-per-session and once-per-run cues', () => {
  const seen = new Set()
  const d = createDirector({ rng: () => 0, seen })
  assert.ok(d.cue('meet:sniper'))
  assert.ok(!d.cue('meet:sniper')) // already on screen
  drain(d)
  assert.ok(!d.cue('meet:sniper'))
  assert.ok(d.cue('hull:low'))
  drain(d)
  assert.ok(!d.cue('hull:low'))
  d.reset(2)
  assert.ok(d.cue('hull:low')) // run-scoped: back after a reset
  assert.ok(!d.cue('meet:sniper')) // session-scoped: still spent
  const remount = createDirector({ seen })
  assert.ok(!remount.cue('meet:sniper'))
})

test('ambient lines only land in silence, and cooldowns hold', () => {
  const d = fresh()
  d.cue('meet:drone')
  assert.ok(!d.cue('taunt')) // busy
  drain(d, 10)
  assert.ok(!d.cue('taunt')) // too soon after a line
  d.tick(AMBIENT_GAP_MS / 1000)
  assert.ok(d.cue('taunt'))
  assert.equal(d.current().who, 'hollow')
  drain(d, 20)
  assert.ok(!d.cue('taunt')) // 45 s cooldown
  d.tick(30)
  assert.ok(d.cue('taunt'))
  // A teaching cue with a cooldown.
  assert.ok(d.cue('warn:behind'))
  drain(d, 5)
  assert.ok(!d.cue('warn:behind'))
  d.tick(25)
  assert.ok(d.cue('warn:behind'))
})

test('story beats cut ambient lines and clear queued tips', () => {
  const d = fresh()
  d.tick(20)
  assert.ok(d.cue('chatter'))
  d.tick(0.5)
  d.cue('meet:weaver')
  d.cue(bossIntroCue(0))
  assert.ok(d.spoken.end <= d.now + 120) // chatter cut short
  assert.ok(until(d, x => x.spoken?.key === 'boss:intro:pincer'))
  assert.equal(d.current().who, 'hollow')
  assert.equal(d.queued, 1) // Claude's half; the weaver tip is gone
})

test('a teaching line cut mid-sentence comes back after the story beat', () => {
  const d = fresh()
  d.setVars(controlVars(false))
  d.cue('pick:bomb')
  assert.ok(d.current().text.includes('b or x'))
  d.tick(0.2)
  d.cue('hull:low')
  assert.deepEqual(drain(d), ['pick:bomb', 'hull:low', 'pick:bomb'])
})

test('a tip dropped before it plays can be asked for again', () => {
  const d = fresh()
  d.cue('brief')
  d.cue('meet:carrier')
  d.cue('boss:warning') // clears queued tips
  drain(d)
  assert.ok(d.cue('meet:carrier'))
})

test('nothing resumes after a hush', () => {
  const d = fresh()
  d.cue('meet:sniper')
  d.tick(0.1)
  d.hush()
  d.cue('death')
  assert.deepEqual(drain(d), ['meet:sniper', 'death'])
})

test('variants do not repeat back to back', () => {
  const d = fresh()
  const texts = []
  for (let i = 0; i < 4; i++) {
    d.cue('death')
    texts.push(d.current().text)
    drain(d, 10)
  }
  for (let i = 1; i < texts.length; i++) assert.notEqual(texts[i], texts[i - 1])
})

test('the queue stays short and keeps story beats', () => {
  const d = fresh()
  for (const k of ['meet:drone', 'meet:kamikaze', 'meet:weaver', 'meet:sniper', 'meet:dasher', 'meet:bulwark', 'meet:splitter']) d.cue(k)
  assert.ok(d.queued <= 5)
  d.cue('ending')
  const keys = drain(d)
  assert.equal(keys.filter(k => k === 'ending').length, 3)
})

test('nudges: bomb and charge shot, only while flying, never once used', () => {
  const n = createNudges()
  assert.equal(n.tick(NUDGE_AFTER.bomb + 1, { flying: false, bombs: 3 }), null)
  let key = null
  for (let t = 0; t < NUDGE_AFTER.bomb + 1 && !key; t += 0.5) key = n.tick(0.5, { flying: true, bombs: 3 })
  assert.equal(key, 'teach:bomb')
  assert.equal(n.tick(1, { flying: true, bombs: 3 }), null) // backs off
  n.used('bomb')
  key = null
  for (let t = 0; t < 60 && !key; t += 0.5) key = n.tick(0.5, { flying: true, bombs: 3 })
  assert.equal(key, 'teach:charge')
  n.used('charge')
  for (let t = 0; t < 60; t += 0.5) assert.equal(n.tick(0.5, { flying: true, bombs: 3 }), null)
  // No bombs, no bomb nudge.
  const m = createNudges()
  for (let t = 0; t < NUDGE_AFTER.bomb + 5; t += 0.5) assert.notEqual(m.tick(0.5, { flying: true, bombs: 0 }), 'teach:bomb')
})

test('every line is in the pixel font and fits the intercom panel', () => {
  const unknown = glyphRows('?').join()
  // Text width in font pixels (the panel draws 2 CSS px per font pixel):
  // 420 px desktop panel → 171; 375 px phone → 151 (see Intercom.vue).
  const DESKTOP = 171
  const PHONE = 151
  const vars = { cs: 'capybara', run: 12, n: 15, name: 'the hollow crown', loop: 'echo iii', boss: 'echo iii furnace',
    ...controlVars(true) }
  for (const [key, def] of Object.entries(CUES)) {
    for (const variant of def.variants) for (const line of variant) {
      const t = fill(line.text, vars)
      for (const ch of t) if (ch !== ' ' && ch !== '?') assert.notEqual(glyphRows(ch).join(), unknown, `${key}: no glyph for "${ch}"`)
      assert.ok(wrapText(t, DESKTOP).length <= 3, `${key}: "${t}" wraps past three lines on desktop`)
      assert.ok(wrapText(t, PHONE).length <= 4, `${key}: "${t}" wraps past four lines on a phone`)
    }
  }
})
