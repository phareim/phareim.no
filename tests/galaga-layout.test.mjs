// Space Voyagers' layout rule (DESIGN.md, "The picture"): the field 240 wide and
// 320 to 432 tall. Wide (560 logical pixels across or more): a panel either side,
// whole device pixels. Narrow: a frame 240 across that fills the screen's width,
// the band above the field, a wider frame on a screen too short for both; nothing
// that matters in the bottom band or under the radio widget.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  computeLayout, panelCrop, toField, wholePx, plateWidth, LEFT_WINDOWS, RIGHT_WINDOWS, BAND_WINDOWS, BAND_PLATES, PLATE_GAP,
  FIELD_W, FIELD_MIN_H, FIELD_MAX_H, WIDE_FROM, PANEL_W, PANEL_MIN_W, BAND_H,
} from '../themes/galaga/render/layout.ts'
import { SPEAKERS } from '../themes/galaga/story/cues.ts'

/** A screen in CSS pixels at a pixel ratio, with the site's radio widget where it sits (top right, 12 px in, at its widest). */
function screen(cssW, cssH, dpr, { safe = 0, widget = true, top = 12 } = {}) {
  return {
    w: cssW, h: cssH, ratio: dpr, safeBottom: safe,
    widgetLeft: widget ? cssW - 12 - Math.min(cssW * 0.6, 340) : 0,
    widgetBottom: widget ? top + 38 : 0,
  }
}

/** The phones of the brief, and a tablet upright. `short`: too short for the band and a 320-row field at 240 across. */
const PHONES = [
  { name: '390 x 844 @3 installed', s: screen(390, 844, 3, { safe: 48 }), short: false },
  { name: '390 x 844 @3 installed, under a notch', s: screen(390, 844, 3, { safe: 48, top: 47 }), short: false },
  { name: '390 x 664 @3', s: screen(390, 664, 3), short: true },
  { name: '430 x 932 @3', s: screen(430, 932, 3), short: false },
  { name: '393 x 852 @3', s: screen(393, 852, 3), short: false },
  { name: '375 x 667 @2', s: screen(375, 667, 2), short: true },
  { name: '375 x 553 @2', s: screen(375, 553, 2), short: true },
  { name: '360 x 740 @3', s: screen(360, 740, 3), short: false },
  { name: '320 x 568 @2', s: screen(320, 568, 2), short: true },
  { name: '768 x 1024 @2', s: screen(768, 1024, 2), short: true },
]

/** Everything the narrow rule promises, for one screen. */
function holds(name, s, L, fieldH = 0) {
  const k = L.lw / s.w
  assert.equal(L.mode, 'band', name)
  // The frame is the canvas: a whole number of backing pixels a logical pixel, the smallest that is not fewer than the device's.
  assert.ok(Number.isInteger(L.scale) && L.scale >= 1, name)
  assert.equal(L.cw, L.lw * L.scale, `${name}: the frame covers the canvas across`)
  assert.equal(L.ch, L.lh * L.scale, `${name}: and down`)
  assert.equal(L.scale, Math.ceil(Math.round(s.w * s.ratio) / L.lw), `${name}: n`)
  assert.equal(L.lh, Math.round(s.h * k), `${name}: rows from the screen's shape`)
  assert.ok(Math.abs(L.cw / L.ch - s.w / s.h) < 0.002, `${name}: the fit is uniform`)
  // The field.
  assert.equal(L.field.w, FIELD_W, name)
  assert.ok(fieldH ? L.field.h === fieldH : L.field.h >= FIELD_MIN_H && L.field.h <= FIELD_MAX_H, `${name}: field ${L.field.h}`)
  assert.equal(L.field.x, (L.lw - FIELD_W) >> 1, `${name}: the field is in the middle`)
  assert.ok(L.field.x >= 0 && L.field.x + FIELD_W <= L.lw, name)
  // The band, whole, on the field.
  assert.equal(L.band.h, BAND_H, `${name}: the whole band`)
  assert.equal(L.band.x, L.field.x, name)
  assert.equal(L.band.y + BAND_H, L.field.y, `${name}: the band sits on the field`)
  assert.equal(L.band.y, L.strip ? L.strip.h : 0, name)
  // Nothing in the bottom band.
  // Down the screen a CSS pixel is `lh / h` rows: the canvas is stretched over it.
  const ky = L.lh / s.h
  const usable = (s.h - (s.safeBottom ?? 0)) * ky
  assert.ok(L.field.y + L.field.h <= usable + 1e-9, `${name}: the field ends above the bottom band (${L.field.y + L.field.h} of ${usable})`)
  assert.equal(L.under, L.lh - L.field.y - L.field.h, name)
  // Nothing under the radio widget: every window of the band, and the plates.
  const wx = s.widgetBottom ? s.widgetLeft * k : L.lw
  const wy = (s.widgetBottom ?? 0) * ky
  for (const [id, r] of [...Object.entries(BAND_WINDOWS), ['plates', BAND_PLATES]]) {
    const x = L.band.x + r.x
    const y = L.band.y + r.y
    assert.ok(x >= 0 && x + r.w <= L.lw && y >= 0 && y + r.h <= L.field.y, `${name}: ${id} is inside the frame`)
    assert.ok(y >= wy || x + r.w <= wx, `${name}: ${id} is clear of the radio widget (${x},${y} against ${wx},${wy})`)
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

test('the name plate and the channel of every speaker fit on the band, clear of its windows', () => {
  const row = BAND_PLATES
  for (const r of Object.values(BAND_WINDOWS)) {
    const apart = r.x >= row.x + row.w + 2 || r.x + r.w <= row.x - 2 || r.y >= row.y + row.h + 2 || r.y + r.h <= row.y - 2
    assert.ok(apart, 'the row of plates crosses no window')
  }
  assert.ok(row.y + row.h + 1 <= BAND_H && row.x >= 2)
  for (const [id, sp] of Object.entries(SPEAKERS)) {
    const wide = plateWidth(sp.name.length) + PLATE_GAP + plateWidth(sp.channel.length)
    assert.ok(wide <= row.w, `${id}: ${sp.name} and ${sp.channel} take ${wide} of ${row.w}`)
  }
})

test('the phones: a frame 240 across that fills the screen, or a little wider on a short one', () => {
  for (const { name, s, short } of PHONES) {
    const L = computeLayout(s)
    holds(name, s, L)
    if (short) {
      assert.ok(L.lw > FIELD_W, `${name}: a wider frame`)
      // Just enough: a column fewer either side has not the rows (the widget is over the caption: 8 of its rows lie on the band).
      const rows = Math.round((s.h * (L.lw - 2)) / s.w)
      const strip = Math.max(0, Math.ceil((s.widgetBottom * rows) / s.h) - 8)
      assert.ok(rows - Math.ceil((s.safeBottom * rows) / s.h) - strip < BAND_H + FIELD_MIN_H, `${name}: and no wider than it must be`)
      assert.equal(L.lw % 2, 0, `${name}: the same columns either side`)
      assert.ok(L.field.h <= FIELD_MIN_H + 4, `${name}: the field is the least one, or a few rows more`)
    } else {
      assert.equal(L.lw, FIELD_W, `${name}: 240 across`)
      assert.equal(L.field.x, 0, `${name}: the field edge to edge`)
    }
  }
})

test('390 x 844 at 3x, installed: five backing pixels a pixel, the console under a quarter of the height', () => {
  const s = screen(390, 844, 3, { safe: 48 })
  const L = computeLayout(s)
  assert.equal(L.lw, 240)
  assert.equal(L.lh, 519)
  assert.equal(L.scale, 5)
  assert.deepEqual([L.cw, L.ch], [1200, 2595])
  assert.equal(L.strip.h, 23)
  assert.deepEqual(L.field, { x: 0, y: 119, w: 240, h: 370 })
  assert.equal(L.under, 30)
  assert.ok(L.field.y / L.lh < 0.25)
})

test('a tall phone does not grow a tall console: rows a 432-row field leaves over go under it', () => {
  const s = screen(320, 860, 3)
  const L = computeLayout(s)
  holds('320 x 860', s, L)
  assert.equal(L.lw, 240)
  assert.equal(L.field.h, FIELD_MAX_H)
  assert.equal(L.band.y, L.strip.h)
  assert.ok(L.strip.h <= 32 && L.under > 60, `strip ${L.strip.h}, under ${L.under}`)
  // With no radio widget the band is at the very top.
  const bare = computeLayout(screen(390, 844, 3, { widget: false }))
  assert.equal(bare.strip, null)
  assert.equal(bare.band.y, 0)
})

test('a short phone, 375 x 553: the frame is widened and the band and field stand in its middle', () => {
  const s = screen(375, 553, 2)
  const L = computeLayout(s)
  holds('375 x 553', s, L)
  assert.ok(L.lw > 290 && L.lw < 320, `frame ${L.lw}`)
  assert.ok(L.field.h >= FIELD_MIN_H && L.field.h <= FIELD_MIN_H + 4)
  assert.equal(L.strip.w, L.lw, 'the wood above the band runs edge to edge')
  assert.ok(L.field.x >= 25, 'columns either side for dashboard and sky')
})

test('a touch lands where the picture is: CSS to field by the frame, not by device pixels', () => {
  for (const { name, s } of PHONES) {
    const L = computeLayout(s)
    const k = s.w / L.lw
    // The middle of the screen is the middle of the field; the field's corners come back as its corners.
    assert.ok(Math.abs(toField(L, s, s.w / 2, 0).x - 120) < 1e-9, name)
    const a = toField(L, s, L.field.x * k, (L.field.y * s.h) / L.lh)
    assert.ok(Math.abs(a.x) < 1e-9 && Math.abs(a.y) < 1e-9, name)
    const b = toField(L, s, (L.field.x + 240) * k, ((L.field.y + L.field.h) * s.h) / L.lh)
    assert.ok(Math.abs(b.x - 240) < 1e-9 && Math.abs(b.y - L.field.h) < 1e-9, name)
    // The whole screen is the whole frame.
    const end = toField(L, s, s.w, s.h)
    assert.ok(Math.abs(end.x + L.field.x - L.lw) < 1e-9 && Math.abs(end.y + L.field.y - L.lh) < 1e-9, name)
    // What is laid over the frame (GAME OVER) keeps whole device pixels, never larger than the frame's own.
    const px = wholePx(L, s)
    assert.ok(Number.isInteger(Math.round(px * s.ratio * 1e6) / 1e6) && px <= k + 1e-9 && px * s.ratio >= 1, `${name}: px ${px}`)
  }
  // Wide: device pixels over the scale, as it was.
  const s = screen(1280, 800, 1)
  const L = computeLayout(s)
  assert.deepEqual(toField(L, s, 640, 100), { x: 640 / 2 - 200, y: 50 })
  assert.equal(wholePx(L, s), 2)
})

test('wide, 1280 x 800: the field in the middle, a whole panel either side', () => {
  const L = computeLayout(screen(1280, 800, 1))
  assert.equal(L.scale, 2)
  assert.equal(L.mode, 'wide')
  assert.deepEqual(L.field, { x: 200, y: 0, w: 240, h: 400 })
  assert.deepEqual([L.lw, L.lh, L.cw, L.ch], [640, 400, 1280, 800])
  assert.equal(L.left.w, PANEL_W)
  assert.equal(L.left.x + L.left.w, L.field.x)
  assert.equal(L.right.x, L.field.x + L.field.w)
  assert.equal(L.left.srcX, 0)
  assert.ok(L.rightPad >= 25, 'the instruments start under the radio widget')
  assert.equal(computeLayout(screen(1280, 800, 1, { widget: false })).rightPad, 0)
  assert.equal(L.band, null)
  assert.equal(L.strip, null)
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

test('every screen: wide as it was (whole device pixels), narrow by the new rule', () => {
  let wide = 0
  let narrow = 0
  for (const dpr of [1, 1.5, 2, 2.625, 3]) {
    for (let w = 320; w <= 2000; w += 37) {
      for (let h = 420; h <= 1400; h += 41) {
        for (const safe of [0, 48]) {
          const s = screen(w, h, dpr, { safe })
          const L = computeLayout(s)
          const name = `${w}x${h}@${dpr} safe ${safe}`
          if (L.mode === 'band') { holds(name, s, L); narrow++; continue }
          wide++
          const dw = Math.round(w * dpr)
          const dh = Math.round(h * dpr)
          const ideal = Math.max(1, Math.floor(Math.min(dw / 240, (dh - Math.round(safe * dpr)) / 320)))
          assert.ok(Number.isInteger(L.scale) && L.scale >= 1 && L.scale <= ideal, `${name}: scale ${L.scale} of ${ideal}`)
          assert.deepEqual([L.cw, L.ch], [dw, dh], `${name}: the canvas is the device's pixels`)
          assert.ok(L.lw * L.scale >= dw && L.lh * L.scale >= dh, `${name}: the buffer covers the canvas`)
          assert.equal(L.field.w, FIELD_W)
          assert.ok(L.field.h >= FIELD_MIN_H && L.field.h <= FIELD_MAX_H, `${name}: height ${L.field.h}`)
          assert.ok(L.field.x >= 0 && (L.field.x + L.field.w) * L.scale <= dw, `${name}: the field is on the screen`)
          const rows = Math.floor((dh - Math.round(safe * dpr)) / L.scale)
          if (rows >= FIELD_MIN_H) assert.ok(L.field.y + L.field.h <= rows, `${name}: the field is above the bottom band`)
          assert.ok(L.left.w >= PANEL_MIN_W && L.left.w <= PANEL_W && L.right.w === L.left.w)
        }
      }
    }
  }
  assert.ok(wide > 3000 && narrow > 1000, `${wide} wide, ${narrow} narrow`)
})

test('a run keeps its field: a phone turned or a window made smaller shows all of it', () => {
  // A tall phone's run (432 rows) turned on its side: 844 x 390 at 3x.
  const turned = computeLayout(screen(844, 390, 3), 432)
  assert.equal(turned.mode, 'wide')
  assert.equal(turned.field.h, 432)
  assert.equal(turned.scale, 2)
  assert.ok(turned.field.y >= 0 && turned.field.y + 432 <= Math.floor(1170 / turned.scale), 'the whole field is on the screen')
  // Wide: a phone's rows on its side, a desktop window made small.
  for (const [s, h] of [[screen(667, 375, 2), 324], [screen(700, 430, 1), 400], [screen(1280, 800, 1), 320]]) {
    const L = computeLayout(s, h)
    const rows = Math.floor((s.h - s.safeBottom) * s.ratio / L.scale)
    assert.equal(L.mode, 'wide')
    assert.equal(L.field.h, h)
    assert.ok(L.field.y >= 0 && L.field.y + h <= rows, `${s.w} x ${s.h}: field ${L.field.y}..${L.field.y + h} of ${rows} rows at scale ${L.scale}`)
    assert.ok(L.field.x >= 0 && L.field.x + 240 <= Math.ceil(s.w * s.ratio / L.scale))
  }
  // The scale is the largest at which it fits: the same screen gives a larger one to a shorter field.
  assert.ok(computeLayout(screen(844, 390, 3), 320).scale >= turned.scale)
  // Narrow: every phone keeps any run's field, whole, above the bottom band; the frame widens when it must.
  for (const { name, s } of PHONES) {
    for (const h of [320, 370, 404, 432]) holds(`${name} with a run of ${h}`, s, computeLayout(s, h), h)
  }
  // Safari's bars come out in the middle of a run begun installed: the same 370 rows, in a wider frame.
  const began = computeLayout(screen(390, 844, 3, { safe: 48 }))
  const bars = computeLayout(screen(390, 664, 3), began.field.h)
  assert.equal(bars.field.h, began.field.h)
  assert.ok(bars.lw > 240 && bars.field.x > 0)
  // A screen that grew: the field does not, and the rows it leaves go under it.
  const grew = computeLayout(screen(390, 844, 3), 320)
  assert.equal(grew.field.h, 320)
  assert.equal(grew.band.y, grew.strip.h)
  assert.ok(grew.under > 60)
  // With no run the screen decides.
  assert.deepEqual(computeLayout(screen(375, 667, 2), 0), computeLayout(screen(375, 667, 2)))
})
