// Space Voyagers' layout rule (DESIGN.md, "The picture"): the field 240 wide and
// 320 to 432 tall at a whole number of device pixels, panels from 560 logical
// pixels across, else a band above the field, nothing in the bottom band.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  computeLayout, panelCrop, LEFT_WINDOWS, RIGHT_WINDOWS, BAND_WINDOWS,
  FIELD_W, FIELD_MIN_H, FIELD_MAX_H, WIDE_FROM, PANEL_W, PANEL_MIN_W, BAND_H,
} from '../themes/galaga/render/layout.ts'

/** A screen in CSS pixels at a pixel ratio, with the site's radio widget where it sits (top right, 12 px in). */
function screen(cssW, cssH, dpr, { safe = 0, widget = true } = {}) {
  return {
    w: Math.round(cssW * dpr), h: Math.round(cssH * dpr), safeBottom: Math.round(safe * dpr),
    widgetLeft: widget ? Math.round((cssW - 12 - Math.min(cssW * 0.6, 340)) * dpr) : 0,
    widgetBottom: widget ? Math.round(50 * dpr) : 0,
  }
}

test('the windows are the ones measured in the console bitmaps', () => {
  const json = JSON.parse(readFileSync(new URL('../scripts/galaga-lab/art/windows.json', import.meta.url), 'utf8'))
  const rect = ([x, y, w, h]) => ({ x, y, w, h })
  for (const [name, r] of Object.entries(json['console-left'].windows)) assert.deepEqual(LEFT_WINDOWS[name], rect(r), `left ${name}`)
  for (const [name, r] of Object.entries(json['console-right'].windows)) assert.deepEqual(RIGHT_WINDOWS[name], rect(r), `right ${name}`)
  assert.deepEqual(RIGHT_WINDOWS.vu, rect(json['console-right'].vu_face))
  for (const [name, r] of Object.entries(json['console-band'].windows)) assert.deepEqual(BAND_WINDOWS[name], rect(r), `band ${name}`)
  assert.deepEqual(json['console-left'].size, [PANEL_W, 432])
  assert.deepEqual(json['console-band'].size, [FIELD_W, BAND_H])
})

test('a phone, 375 x 667 at 2x: three device pixels a pixel, the band above the field', () => {
  const L = computeLayout(screen(375, 667, 2))
  assert.equal(L.scale, 3)
  assert.equal(L.mode, 'band')
  assert.equal(L.field.w, 240)
  assert.ok(L.field.h >= 320 && L.field.h <= 432)
  assert.equal(L.band.h, BAND_H)
  assert.equal(L.band.y + L.band.h, L.field.y, 'the band sits on the field')
  assert.equal(L.field.y + L.field.h, Math.floor(1334 / 3), 'the field ends at the last whole row')
  // The band's windows on the widget's side start 10 rows down: the widget ends above them.
  assert.ok(L.band.y + BAND_WINDOWS.caption.y >= Math.ceil(100 / 3), 'the caption is clear of the radio widget')
  assert.ok(L.strip && L.strip.h > 0 && L.stripClearW >= 70, 'and the name plate has its place beside it')
})

test('installed on a phone: the field ends above the bottom band', () => {
  const L = computeLayout(screen(375, 667, 2, { safe: 48 }))
  assert.ok((L.field.y + L.field.h) * L.scale <= (667 - 48) * 2)
  assert.ok(L.field.h >= 320)
  assert.ok(L.under >= Math.floor(96 / L.scale), 'the backdrop runs through the band')
})

test('a tall phone: the field stops at 432 and the rest goes to the console', () => {
  const L = computeLayout(screen(390, 844, 3, { safe: 34 }))
  assert.equal(L.scale, 4)
  assert.equal(L.field.h, FIELD_MAX_H)
  assert.equal(L.strip.h + L.band.h + L.field.h, Math.floor((844 - 34) * 3 / 4))
  assert.ok(L.strip.h >= 70 && L.stripClearW >= 70, 'rows for the name plate, the channel and the lamps beside the widget')
})

test('wide, 1280 x 800: the field in the middle, a whole panel either side', () => {
  const L = computeLayout(screen(1280, 800, 1))
  assert.equal(L.scale, 2)
  assert.equal(L.mode, 'wide')
  assert.deepEqual(L.field, { x: 200, y: 0, w: 240, h: 400 })
  assert.equal(L.left.w, PANEL_W)
  assert.equal(L.left.x + L.left.w, L.field.x)
  assert.equal(L.right.x, L.field.x + L.field.w)
  assert.equal(L.left.srcX, 0)
  assert.ok(L.rightPad >= 25, 'the instruments start under the radio widget')
  assert.equal(computeLayout(screen(1280, 800, 1, { widget: false })).rightPad, 0)
})

test('panels from 560 logical pixels across, the band below that', () => {
  const at = w => computeLayout({ w, h: 400 })
  assert.equal(at(WIDE_FROM).mode, 'wide')
  assert.equal(at(WIDE_FROM).left.w, PANEL_MIN_W)
  assert.equal(at(WIDE_FROM - 1).mode, 'band')
  // A narrow panel shows the columns its windows are in.
  for (let w = PANEL_MIN_W; w <= PANEL_W; w++) {
    const crop = panelCrop(RIGHT_WINDOWS, w)
    for (const r of Object.values(RIGHT_WINDOWS)) assert.ok(r.x >= crop && r.x + r.w <= crop + w, `right panel at ${w}`)
    const left = panelCrop(LEFT_WINDOWS, w)
    assert.ok(LEFT_WINDOWS.portrait.x >= left && LEFT_WINDOWS.portrait.x + 64 <= left + w, `the portrait at ${w}`)
    if (w >= 172) assert.ok(LEFT_WINDOWS.caption.x >= left && LEFT_WINDOWS.caption.x + LEFT_WINDOWS.caption.w <= left + w)
  }
})

test('a phone on its side is wide', () => {
  const L = computeLayout(screen(667, 375, 2))
  assert.equal(L.mode, 'wide')
  assert.equal(L.scale, 2)
  assert.equal(L.field.h, 375)
})

test('every screen: a whole scale, the largest that fits, and a field inside the rule', () => {
  let seen = 0
  for (const dpr of [1, 1.5, 2, 2.625, 3]) {
    for (let w = 320; w <= 2000; w += 37) {
      for (let h = 420; h <= 1400; h += 41) {
        for (const safe of [0, 48]) {
          const s = screen(w, h, dpr, { safe })
          const L = computeLayout(s)
          const ideal = Math.max(1, Math.floor(Math.min(s.w / 240, (s.h - s.safeBottom) / 320)))
          assert.ok(Number.isInteger(L.scale) && L.scale >= 1)
          assert.ok(L.scale === ideal || (L.scale < ideal && L.mode === 'wide' || L.band?.h === BAND_H || L.scale === 1), `${w}x${h}@${dpr}: scale ${L.scale} of ${ideal}`)
          assert.equal(L.field.w, FIELD_W)
          assert.ok(L.field.h >= FIELD_MIN_H && L.field.h <= FIELD_MAX_H, `${w}x${h}@${dpr}: height ${L.field.h}`)
          assert.ok(L.field.x >= 0 && (L.field.x + L.field.w) * L.scale <= s.w, `${w}x${h}@${dpr}: the field is on the screen`)
          const rows = Math.floor((s.h - s.safeBottom) / L.scale)
          if (rows >= FIELD_MIN_H + (L.mode === 'band' ? BAND_H : 0)) assert.ok(L.field.y + L.field.h <= rows, `${w}x${h}@${dpr} safe ${safe}: the field is above the bottom band`)
          assert.ok(L.lw * L.scale >= s.w && L.lh * L.scale >= s.h, 'the buffer covers the canvas')
          if (L.mode === 'wide') assert.ok(L.left.w >= PANEL_MIN_W && L.left.w <= PANEL_W && L.right.w === L.left.w)
          seen++
        }
      }
    }
  }
  assert.ok(seen > 5000)
})
