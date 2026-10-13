// Space Voyagers' script (themes/galaga/story): the rules every line keeps,
// and that every cue is asked for by the engine or by the page.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { CUES, SPEAKERS, MAX_LINE, ROW_CHARS, MAX_ROWS } from '../themes/galaga/story/cues.ts'
import { LINES } from '../themes/galaga/story/lines.ts'
import { createDirector, listen, rows } from '../themes/galaga/story/director.ts'
import { PAGE_CUES } from '../themes/galaga/engine/cuemap.ts'
import { createWorld, step } from '../themes/galaga/engine/index.ts'
import { createAutopilot, autopilot } from '../themes/galaga/engine/autopilot.ts'
import { rand } from '../themes/galaga/engine/rng.ts'

const ids = Object.keys(CUES)
const all = ids.flatMap(id => LINES[id].flatMap((ex, v) => ex.map((line, i) => ({ id, v, i, line }))))
/** The pixel font's characters this script may use (themes/base/pixel/font.ts). */
const FONT = /^[A-Z0-9 .,!?'":;\-+/()%&*#=<>]+$/

test('every cue has lines and every entry of lines is a cue', () => {
  assert.deepEqual(Object.keys(LINES).sort(), [...ids].sort())
  for (const id of ids) {
    assert.ok(LINES[id].length >= 1, `${id} has an exchange`)
    for (const ex of LINES[id]) assert.ok(ex.length >= 1, `${id} has a line`)
  }
  assert.ok(ids.length >= 118, `${ids.length} cues`)
  assert.ok(all.length >= 400, `${all.length} lines`)
})

test('every speaker and every mood exists', () => {
  for (const { id, line } of all) {
    const sp = SPEAKERS[line.who]
    assert.ok(sp, `${id}: ${line.who}`)
    if (line.mood !== undefined) assert.ok(sp.moods.includes(line.mood), `${id}: ${line.who} has no mood ${line.mood}`)
  }
  for (const [who, sp] of Object.entries(SPEAKERS)) {
    assert.ok(sp.moods.length >= 1 && sp.name === sp.name.toUpperCase() && sp.channel.length > 0, who)
    assert.ok(all.some(x => x.line.who === who), `${who} says something`)
  }
})

test('every line: 84 characters, three rows of 28, the font\'s characters', () => {
  assert.deepEqual([MAX_LINE, ROW_CHARS, MAX_ROWS], [84, 28, 3])
  for (const { id, line } of all) {
    const t = line.text
    assert.ok(t.length >= 1 && t.length <= MAX_LINE, `${id}: ${t.length} characters: ${t}`)
    assert.match(t, FONT, `${id}: ${t}`)
    assert.equal(t, t.trim())
    assert.ok(!t.includes('  '), `${id}: a double space`)
    const r = rows(t)
    assert.ok(r.length <= MAX_ROWS, `${id}: ${r.length} rows: ${t}`)
    assert.ok(r.every(x => x.length <= ROW_CHARS), `${id}: a word too long for a row: ${t}`)
  }
})

test('priorities and once-rules are the ones the director knows', () => {
  for (const id of ids) {
    const r = CUES[id]
    assert.ok([1, 2, 3].includes(r.priority), id)
    assert.ok(r.once === undefined || ['session', 'run', 'sector'].includes(r.once), id)
    assert.ok(r.cooldown === undefined || r.cooldown > 0, id)
  }
})

test('every cue is asked for by the engine, except the five the page asks for', () => {
  assert.deepEqual([...PAGE_CUES].sort(), ['best', 'briefing', 'ending', 'gameover', 'retry'])
  const dir = new URL('../themes/galaga/engine/', import.meta.url)
  let source = ''
  for (const f of readdirSync(dir)) {
    if (f.endsWith('.ts')) source += readFileSync(new URL(f, dir), 'utf8').replace(/export const PAGE_CUES[^\n]*\n/, '')
  }
  for (const id of ids) {
    // A cue is asked for with cue(w, 'id') or through a table in cuemap.ts; both spell the id out.
    if (PAGE_CUES.includes(id)) assert.ok(!source.includes(`cue(w, '${id}'`), `${id} is the page's to ask`)
    else assert.ok(source.includes(`'${id}'`), `nothing in the engine asks for ${id}`)
  }
})

test('a voyage on the radio: every cue asked for exists, and the monitor always shows a real speaker', () => {
  const asked = new Set()
  const said = new Set()
  const speakers = new Set()
  for (const [seed, pilot] of [[1, 'rex'], [2, 'nova']]) {
    const w = createWorld({ seed, height: 320, pilot })
    const ap = createAutopilot()
    const d = createDirector({ random: () => rand(w.talkRng), session: new Set() })
    // Through the ending and the next voyage's card, so the last fight's lines get said.
    while (!w.over && !(w.voyage === 2 && w.stage === 'wave') && w.tick < 60000) {
      step(w, autopilot(ap, w))
      for (const e of w.events) {
        if (e.type !== 'cue') continue
        assert.ok(CUES[e.kind], `the engine asked for ${e.kind}`)
        assert.ok(!PAGE_CUES.includes(e.kind))
        if (e.alt) assert.ok(CUES[e.alt], `the engine's alternative ${e.alt}`)
        asked.add(e.kind)
      }
      const m = listen(d, w.events, w.tick)
      if (!m.speaking) continue
      const sp = SPEAKERS[m.who]
      assert.ok(sp && sp.moods.includes(m.mood))
      assert.equal(m.name, sp.name)
      assert.ok(m.shown.length <= m.text.length && m.text.startsWith(m.shown))
      said.add(m.cue)
      speakers.add(m.who)
    }
    assert.equal(w.voyage, 2, 'the run got to the ending')
  }
  for (const id of ['sector.1', 'sector.5', 'boss.knight.enter', 'boss.fader.dead', 'boss.deafstar.enter', 'boss.deafstar.dead', 'bonus.start']) {
    assert.ok(said.has(id), `${id} was heard`)
  }
  assert.ok(asked.size >= 60, `${asked.size} different cues asked for in two voyages`)
  assert.ok(said.size >= 40, `${said.size} different cues heard`)
  for (const who of ['rex', 'nova', 'mei', 'babs', 'knight', 'humdinger', 'durant', 'cal', 'fader']) assert.ok(speakers.has(who), `${who} was on the air`)
})
