// Space Voyagers II: the words, the comms director's seat rule, and the
// cockpit layout on the phones and screens the game is checked at.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { CUES, SPEAKERS, MAX_ROWS, ROW_CHARS } from '../themes/voyagers2/story/cues.ts'
import { LINES } from '../themes/voyagers2/story/lines.ts'
import { createDirector, rows, portraitOf } from '../themes/voyagers2/story/director.ts'
import { computeLayout, inside } from '../themes/voyagers2/render/layout.ts'

test('every line is capitals, fits three rows of 34, and has a speaker with that mood', () => {
  for (const [id, variants] of Object.entries(LINES)) {
    assert.ok(variants.length > 0, `${id} has words`)
    for (const ex of variants) for (const l of ex) {
      assert.equal(l.text, l.text.toUpperCase(), `${id}: capitals`)
      assert.ok(l.text.length <= 96, `${id}: ${l.text.length} characters`)
      const r = rows(l.text, ROW_CHARS)
      assert.ok(r.length <= MAX_ROWS, `${id}: ${r.length} rows: ${l.text}`)
      const sp = SPEAKERS[l.who]
      assert.ok(sp, `${id}: speaker ${l.who}`)
      if (l.mood) assert.ok(sp.moods.includes(l.mood), `${id}: ${l.who} has no mood ${l.mood}`)
    }
  }
})

test('every cue has words and every cue said by a seat has a variant for Rex and for Nova', () => {
  for (const [id, rule] of Object.entries(CUES)) {
    assert.ok(LINES[id], `${id} has lines`)
    if (!rule.by) continue
    const firsts = new Set(LINES[id].map(ex => ex[0].who))
    assert.ok(firsts.has('rex') && firsts.has('nova'), `${id}: both pilots (${[...firsts]})`)
  }
})

test('every portrait the comms can show is on disk', () => {
  for (const [who, sp] of Object.entries(SPEAKERS)) {
    for (const mood of sp.moods) {
      const path = 'public' + portraitOf(who, mood)
      assert.ok(existsSync(path), path)
    }
  }
})

test('the back seat calls the bandit in the voice of whoever sits there', () => {
  let seats = { front: 'rex', back: 'nova', player: 'rex' }
  const d = createDirector({ random: () => 0, seats: () => seats, session: new Set() })
  d.cue('behind', 0)
  let m = d.step(1)
  assert.equal(m.who, 'nova')
  assert.equal(m.channel, 'BACK SEAT')
  seats = { front: 'nova', back: 'rex', player: 'rex' }
  const d2 = createDirector({ random: () => 0, seats: () => seats, session: new Set() })
  d2.cue('behind', 0)
  m = d2.step(1)
  assert.equal(m.who, 'rex')
})

const SCREENS = {
  p844: { cssW: 390, cssH: 844, dpr: 3 },
  p664: { cssW: 390, cssH: 664, dpr: 3 },
  phone: { cssW: 375, cssH: 667, dpr: 2 },
  p932: { cssW: 430, cssH: 932, dpr: 3 },
  p568: { cssW: 320, cssH: 568, dpr: 2 },
  wide: { cssW: 1280, cssH: 800, dpr: 1 },
  laptop: { cssW: 1440, cssH: 900, dpr: 2 },
  hd: { cssW: 1920, cssH: 1080, dpr: 1 },
  side: { cssW: 844, cssH: 390, dpr: 3 },
}

test('the frame fills the screen at a whole number of device pixels, never with bars', () => {
  for (const [name, s] of Object.entries(SCREENS)) {
    for (const safeBottom of [0, 48]) {
      const l = computeLayout({ ...s, safeBottom, widget: null, touch: true })
      const devW = Math.round(s.cssW * s.dpr), devH = Math.round(s.cssH * s.dpr)
      assert.ok(Number.isInteger(l.n) && l.n >= 1, name)
      assert.ok(l.W * l.n >= devW && (l.W - 1) * l.n < devW, `${name}: width ${l.W}x${l.n} for ${devW}`)
      assert.ok(l.H * l.n >= devH && (l.H - 1) * l.n < devH, `${name}: height`)
      // The dashboard ends above the site's bottom band.
      assert.ok(l.dash.y + l.dash.h <= l.H - Math.round(safeBottom / l.css) + 1, `${name}: dashboard over the bottom band`)
      assert.ok(l.view.h >= 120, `${name}: view ${l.view.h} rows`)
      // The thumb buttons are on the view, clear of the dashboard and of each other.
      const b = l.buttons
      for (const k of ['fire', 'msl', 'burn']) {
        const r = b[k]
        assert.ok(r.x >= 0 && r.x + r.w <= l.W && r.y >= 0 && r.y + r.h <= l.view.h, `${name}: ${k} on the view`)
      }
      assert.ok(!inside(b.fire, b.burn.x + 1, b.burn.y + 1) && !inside(b.fire, b.msl.x + 1, b.msl.y + 1), `${name}: buttons overlap`)
      // Screens and radar inside the dashboard.
      for (const r of [l.left, l.right]) assert.ok(r.y >= l.dash.y && r.y + r.h <= l.dash.y + l.dash.h && r.x >= 0 && r.x + r.w <= l.W, `${name}: screen`)
    }
  }
})

test('a phone held upright is about 240 logical pixels across; a wide screen about 262 rows', () => {
  const p = computeLayout({ ...SCREENS.p844, safeBottom: 0, widget: null, touch: true })
  assert.ok(p.W >= 200 && p.W <= 280, `phone ${p.W}`)
  assert.equal(p.wide, false)
  const w = computeLayout({ ...SCREENS.wide, safeBottom: 0, widget: null, touch: false })
  assert.equal(w.wide, true)
  assert.ok(w.H >= 230 && w.H <= 300, `wide ${w.H}`)
  assert.equal(w.buttons, null)
})
