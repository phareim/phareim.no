// Space Voyagers' radio director (themes/galaga/story/director.ts): priorities,
// once-rules, cooldowns, exchanges, typing on the game clock, variants.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createDirector, listen, lineTicks, exchangeTicks, rows, fits,
  TYPE_TICKS, GAP_TICKS, SILENCE_TICKS, STALE_TICKS, CUT_TICKS,
} from '../themes/galaga/story/director.ts'
import { CUES, SPEAKERS } from '../themes/galaga/story/cues.ts'
import { LINES } from '../themes/galaga/story/lines.ts'
import { makeRng, rand } from '../themes/galaga/engine/rng.ts'

const fresh = (seed = 1) => {
  const rng = makeRng(seed)
  return createDirector({ random: () => rand(rng), session: new Set() })
}
/** Play from `from` until the radio is silent; returns every line as it starts. */
function play(d, from = 0, limit = 20000) {
  const said = []
  let last = -1
  let t = from
  for (; t < from + limit; t++) {
    const m = d.step(t)
    if (m.speaking && m.line !== last) { last = m.line; said.push({ who: m.who, text: m.text, mood: m.mood, at: t, cue: m.cue }) }
    if (!d.busy) break
  }
  return { said, end: t }
}

test('an exchange plays its lines in order, one speaker after another, with a gap between', () => {
  const d = fresh()
  assert.ok(d.cue('briefing', 0))
  const { said } = play(d)
  const want = LINES.briefing[0]
  assert.deepEqual(said.map(s => s.text), want.map(l => l.text))
  assert.deepEqual(said.map(s => s.who), ['mei', 'lena', 'mei', 'nova', 'rex', 'nova'])
  for (let i = 1; i < said.length; i++) {
    assert.equal(said[i].at - said[i - 1].at, lineTicks(want[i - 1].text).total + GAP_TICKS)
  }
  assert.equal(said[2].mood, 'excited')
  assert.equal(said[0].mood, SPEAKERS.mei.moods[0], 'no mood asked: the default')
})

test('the monitor: who, name plate, channel, mood, the text typed so far', () => {
  const d = fresh()
  d.cue('boss.cal.enter', 100)
  let m = d.step(100)
  assert.equal(m.speaking, true)
  assert.equal(m.who, 'cal')
  assert.equal(m.name, 'CAL 9000')
  assert.equal(m.channel, 'ALL BANDS')
  assert.equal(m.cutsIn, true, 'a boss cuts in on every band')
  assert.equal(m.shown, '')
  m = d.step(100 + 15)
  assert.equal(m.chars, Math.floor(15 / TYPE_TICKS))
  assert.equal(m.shown, m.text.slice(0, m.chars))
  m = d.step(100 + lineTicks(m.text).type)
  assert.equal(m.shown, m.text)
  const { said } = play(d, 100)
  const rex = said.find(s => s.who === 'rex')
  assert.ok(rex)
  d.cue('idle', 99999)
  assert.equal(d.step(99999).cutsIn, false)
  assert.equal(d.step(99999).channel, SPEAKERS[d.monitor.who].channel)
})

test('it runs on the game clock: a paused game freezes the line', () => {
  const d = fresh()
  d.cue('sector.1', 0)
  const a = { ...d.step(30) }
  for (let i = 0; i < 500; i++) d.step(30)
  assert.deepEqual({ ...d.step(30) }, a)
})

test('priority 3 cuts in on banter and jumps the queue', () => {
  const d = fresh()
  assert.ok(d.cue('idle', 0))
  assert.equal(d.step(5).cue, 'idle')
  assert.ok(d.cue('boss.knight.enter', 10))
  const m = d.step(10 + CUT_TICKS)
  assert.equal(m.cue, 'boss.knight.enter')
  assert.equal(m.who, 'knight')
  const { said } = play(d, 10 + CUT_TICKS)
  assert.ok(!said.some(s => s.cue === 'idle'), 'the banter is not resumed')
})

test('a teaching line cut off by a story beat is said again afterwards', () => {
  const d = fresh()
  assert.ok(d.cue('see.sniper', 0))
  assert.equal(d.step(4).cue, 'see.sniper')
  assert.ok(d.cue('tow.first', 6))
  const { said } = play(d, 6)
  const cuesSaid = said.map(s => s.cue)
  // The line on the air when the story came is the first thing seen; then the story, then the tip again.
  assert.deepEqual([...new Set(cuesSaid)], ['see.sniper', 'tow.first'])
  assert.equal(cuesSaid[1], 'tow.first')
  assert.equal(cuesSaid[cuesSaid.length - 1], 'see.sniper')
  assert.equal(said[said.length - 1].text, LINES['see.sniper'][0][0].text)
})

test('banter only into nine seconds of silence', () => {
  const d = fresh()
  d.cue('pick.tube', 0)
  const { end } = play(d)
  assert.equal(d.cue('idle', end + 60), false)
  assert.equal(d.cue('idle', end + SILENCE_TICKS - 20), false)
  assert.equal(d.cue('idle', end + SILENCE_TICKS + 20), true)
  const busy = fresh()
  busy.cue('sector.2', 0)
  busy.step(1)
  assert.equal(busy.cue('waveClear', 2), false, 'not while somebody is talking')
})

test('once a page load, once a run, once a sector, and cooldowns', () => {
  const session = new Set()
  const rng = makeRng(2)
  const d = createDirector({ random: () => rand(rng), session })
  assert.equal(CUES['pick.tube'].once, 'session')
  assert.ok(d.cue('pick.tube', 0))
  assert.equal(d.cue('pick.tube', 1), false, 'not twice while it waits')
  let t = play(d).end
  assert.equal(d.cue('pick.tube', t + 10), false)
  d.resetRun()
  assert.equal(d.cue('pick.tube', 0), false, 'a new run does not forget the page load')
  assert.ok(session.has('pick.tube'))
  // Once a run.
  assert.equal(CUES.voyage2.once, 'run')
  assert.ok(d.cue('voyage2', 0))
  t = play(d).end
  assert.equal(d.cue('voyage2', t + 5), false)
  d.resetRun()
  assert.ok(d.cue('voyage2', 0))
  // Once a sector.
  t = play(d).end
  assert.ok(d.cue('see.hogs', t))
  t = play(d, t).end
  assert.equal(d.cue('see.hogs', t + 1), false)
  d.newSector()
  assert.ok(d.cue('see.hogs', t + 2))
  // A cooldown, in game seconds.
  t = play(d, t + 2).end
  assert.equal(CUES.lowHull.cooldown, 30)
  assert.ok(d.cue('lowHull', t))
  t = play(d, t).end
  assert.equal(d.cue('lowHull', t + 60), false)
  assert.ok(d.cue('lowHull', t + 30 * 60))
})

test('a once-cue that never got on the air may be asked for again', () => {
  const d = fresh()
  d.cue('sector.1', 0)
  d.step(0)
  assert.ok(d.cue('pick.magnet', 1))
  // It waits behind the station break until it is stale, and is dropped unsaid.
  const { said, end } = play(d, 1)
  assert.ok(exchangeTicks(LINES['sector.1'][0]) > STALE_TICKS)
  assert.ok(!said.some(s => s.cue === 'pick.magnet'))
  assert.ok(d.cue('pick.magnet', end + 5), 'so the next magnet teaches it')
})

test('variants: unheard ones first, chosen with the given random', () => {
  const d = fresh(7)
  const n = LINES.gameover.length
  const heard = []
  let t = 0
  for (let i = 0; i < n; i++) {
    assert.ok(d.cue('gameover', t))
    const r = play(d, t)
    heard.push(r.said[0].text)
    t = r.end + 10
  }
  assert.equal(new Set(heard).size, n, 'all of them before any repeat')
  const again = fresh(7)
  again.cue('gameover', 0)
  assert.equal(play(again).said[0].text, heard[0], 'the same seed, the same choice')
})

test('listen: the glue takes cue events, falls back to the alternative, and opens a new sector', () => {
  const d = fresh()
  const ev = (type, kind, alt = '') => ({ type, kind, alt })
  let m = listen(d, [ev('card', 'sector'), ev('cue', 'pick.pizza', 'pizza.again')], 0)
  assert.equal(m.cue, 'pick.pizza')
  let t = play(d).end
  // Asked again much later: the first pizza has been taught, so Rex rates this one.
  t += SILENCE_TICKS + 5
  m = listen(d, [ev('cue', 'pick.pizza', 'pizza.again')], t)
  assert.equal(m.cue, 'pizza.again')
  assert.equal(m.who, 'rex')
  t = play(d, t).end
  assert.ok(d.cue('see.noise', t))
  t = play(d, t).end
  assert.equal(listen(d, [ev('cue', 'see.noise')], t + 5).speaking, false)
  assert.equal(listen(d, [ev('card', 'sector'), ev('cue', 'see.noise')], t + 30).cue, 'see.noise')
})

test('hush and resetRun leave the radio quiet', () => {
  const d = fresh()
  d.cue('sector.3', 0)
  d.cue('see.lovemachines', 0)
  d.step(10)
  d.hush(10)
  assert.equal(d.waiting, 0)
  assert.equal(d.step(10 + CUT_TICKS + GAP_TICKS + 1).speaking, false)
  d.cue('sector.4', 100)
  d.step(100)
  d.resetRun()
  assert.equal(d.busy, false)
  assert.equal(d.step(101).speaking, false)
})

test('rows: whole words, 28 to a row', () => {
  assert.deepEqual(rows('GOING.'), ['GOING.'])
  assert.deepEqual(rows('AAAA BBBB CCCC', 9), ['AAAA BBBB', 'CCCC'])
  assert.equal(fits('A'.repeat(29)), false)
  assert.equal(fits('SHORT'), true)
})
