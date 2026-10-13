/**
 * Space Voyagers: where everything sits on the screen. Pure arithmetic, no
 * DOM, so `tests/galaga-layout.test.mjs` can hold it to DESIGN.md's rule
 * ("The picture"). The field is 240 wide and 320 to 432 tall.
 *
 * Wide (560 logical pixels across or more): a console panel either side, one
 * logical pixel a whole number of device pixels.
 *
 * Narrow: the frame is 240 logical pixels across and as wide as the screen,
 * its rows follow from the screen's shape, and down it stand the rows the
 * site's radio widget needs, the console band, the field, the site's bottom
 * band. A screen too short for that gets a frame wider than 240, with the band
 * and the field in its middle.
 *
 * All rectangles are logical pixels in the frame's buffer. The window
 * rectangles are copied from `scripts/galaga-lab/art/windows.json`, which
 * measured them in the console bitmaps; the game does not load that file.
 */

export interface Rect { x: number; y: number; w: number; h: number }

export const FIELD_W = 240
export const FIELD_MIN_H = 320
export const FIELD_MAX_H = 432
/** Panels appear from this many logical pixels across: 240 and 160 either side. */
export const WIDE_FROM = 560
export const PANEL_W = 200
export const PANEL_H = 432
export const PANEL_MIN_W = (WIDE_FROM - FIELD_W) / 2
export const BAND_W = 240
export const BAND_H = 96

/** console-left.png: the monitor. */
export const LEFT_WINDOWS = {
  portrait: { x: 42, y: 16, w: 64, h: 64 },
  name: { x: 29, y: 92, w: 120, h: 9 },
  channel: { x: 33, y: 111, w: 80, h: 9 },
  caption: { x: 19, y: 146, w: 172, h: 30 },
} as const
/** console-right.png: the instruments. `vu` is the painted meter the needle is drawn over. */
export const RIGHT_WINDOWS = {
  score: { x: 48, y: 12, w: 104, h: 13 },
  valves: { x: 46, y: 42, w: 110, h: 26 },
  weapon: { x: 24, y: 94, w: 48, h: 48 },
  vu: { x: 104, y: 99, w: 71, h: 40 },
  lamps: { x: 50, y: 162, w: 100, h: 12 },
  chart: { x: 26, y: 195, w: 150, h: 40 },
} as const
/** console-band.png: both, small. */
export const BAND_WINDOWS = {
  portrait: { x: 6, y: 4, w: 40, h: 40 },
  caption: { x: 56, y: 10, w: 178, h: 30 },
  score: { x: 8, y: 64, w: 80, h: 9 },
  valves: { x: 98, y: 63, w: 60, h: 12 },
  weapon: { x: 168, y: 62, w: 40, h: 9 },
  duet: { x: 168, y: 79, w: 40, h: 6 },
} as const
/**
 * console-band.png has no window for who is speaking: the name plate and the channel are drawn over
 * its bare steel, side by side from the left of this row, each as wide as its words.
 */
export const BAND_PLATES = { x: 6, y: 82, w: 158, h: 9 } as const
/** Columns between the two plates. */
export const PLATE_GAP = 4
/** A plate round `chars` letters of the 5 x 7 font: 6 a letter, one column clear either side. */
export const plateWidth = (chars: number): number => (chars > 0 ? chars * 6 + 1 : 0)

/** A console bitmap on the frame: `x, y` is where its column `srcX` lands, `w, h` how much of it shows. */
export interface Panel extends Rect { srcX: number }

export interface Layout {
  /** Pixels of the canvas's backing store per logical pixel: a whole number. */
  scale: number
  /** The buffer, in logical pixels. Narrow: all of it is shown. Wide: the last column and row may be cut. */
  lw: number
  lh: number
  /** The canvas's backing store, in its own pixels. Narrow: `lw * scale` by `lh * scale`, fitted to the screen by CSS. */
  cw: number
  ch: number
  mode: 'wide' | 'band'
  /** The field. `h` is the world's height. */
  field: Rect
  /** Rows under the field the backdrop runs through: the site's bottom band and what is left over. */
  under: number
  left: Panel | null
  right: Panel | null
  /** Rows above the right panel left bare for the site's radio widget. */
  rightPad: number
  band: Panel | null
  /** Bare wood above the band, the frame's whole width: the rows the radio widget lies over. */
  strip: Rect | null
}

/** A canvas, in CSS pixels. */
export interface Screen {
  w: number
  h: number
  /** Device pixels per CSS pixel (1 when not given). */
  ratio?: number
  /** The site's bottom band. */
  safeBottom?: number
  /** The radio widget (top right): its left edge and its bottom edge. 0 for none. */
  widgetLeft?: number
  widgetBottom?: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** The columns of a 200-wide panel to show when only `w` fit: centred on its windows. */
export function panelCrop(windows: Record<string, Rect>, w: number): number {
  if (w >= PANEL_W) return 0
  let lo = PANEL_W
  let hi = 0
  for (const r of Object.values(windows)) { lo = Math.min(lo, r.x); hi = Math.max(hi, r.x + r.w) }
  return clamp(Math.round((lo + hi) / 2 - w / 2), 0, PANEL_W - w)
}

/** Wide: `s` in device pixels, `scale` of them a logical pixel. */
function wide(s: Screen, scale: number, fixed: number): Layout {
  const lw = Math.ceil(s.w / scale)
  const lh = Math.ceil(s.h / scale)
  const fullW = Math.floor(s.w / scale)
  /** Rows above the site's bottom band. */
  const rows = Math.floor((s.h - (s.safeBottom ?? 0)) / scale)
  const widgetRows = Math.ceil((s.widgetBottom ?? 0) / scale)
  const widgetX = s.widgetBottom ? Math.floor((s.widgetLeft ?? 0) / scale) : fullW
  const fx = Math.floor((fullW - FIELD_W) / 2)
  const fh = fixed || clamp(rows, FIELD_MIN_H, FIELD_MAX_H)
  const fy = Math.max(0, Math.floor((rows - fh) / 2))
  const pw = Math.min(PANEL_W, fx)
  // The radio widget sits over the top of the right panel: start the panel under it.
  const rx = fx + FIELD_W
  const pad = widgetRows > 0 && widgetX < rx + pw ? Math.max(0, widgetRows + 2 - fy) : 0
  return {
    scale, lw, lh, cw: s.w, ch: s.h, mode: 'wide',
    field: { x: fx, y: fy, w: FIELD_W, h: fh },
    under: lh - fy - fh,
    left: { x: fx - pw, y: fy, w: pw, h: Math.min(PANEL_H, lh - fy), srcX: panelCrop(LEFT_WINDOWS, pw) },
    right: { x: rx, y: fy + pad, w: pw, h: Math.min(PANEL_H, lh - fy - pad), srcX: panelCrop(RIGHT_WINDOWS, pw) },
    rightPad: pad,
    band: null, strip: null,
  }
}

/**
 * Is this screen wide, and at how many device pixels a logical pixel (0: narrow)? As it always
 * was: the largest whole scale at which 240 x 320 (or a run's field) fits is tried first; 560
 * logical pixels across there is wide; if not, and the band's 96 rows would not fit above the
 * field at that scale, the next scale down is tried.
 */
function wideScale(w: number, usableH: number, fieldH: number): number {
  const fh = fieldH || FIELD_MIN_H
  for (let scale = Math.max(1, Math.floor(Math.min(w / FIELD_W, usableH / fh))); scale >= 1; scale--) {
    if (Math.floor(w / scale) >= WIDE_FROM) return scale
    if (Math.floor(usableH / scale) >= BAND_H + fh) return 0
  }
  return 0
}

/** A frame is never made wider than this to find rows; past it the field's bottom is cut. */
const NARROW_MAX_W = FIELD_W * 8

/**
 * The rows of a frame `lw` logical pixels across on the screen `s` (CSS pixels): all of them, those
 * the site's bottom band takes, and those above the band the radio widget needs. The canvas is
 * stretched over the screen, so a height in CSS pixels is rows by `rows / s.h`.
 */
function rowsOf(s: Screen, lw: number): { rows: number; safe: number; strip: number } {
  const rows = Math.max(1, Math.round((s.h * lw) / s.w))
  const k = rows / s.h
  const widgetRows = Math.ceil((s.widgetBottom ?? 0) * k)
  // The widget is over the caption's columns, whose window begins 10 rows down the band. In a frame much
  // wider than the band it reaches the portrait's too, which begins 4 down. Two rows clear under it.
  const portraitEnd = ((lw - BAND_W) >> 1) + BAND_WINDOWS.portrait.x + BAND_WINDOWS.portrait.w + 2
  const first = ((s.widgetLeft ?? 0) * lw) / s.w < portraitEnd ? BAND_WINDOWS.portrait.y : BAND_WINDOWS.caption.y
  return { rows, safe: Math.ceil((s.safeBottom ?? 0) * k), strip: widgetRows > 0 ? Math.max(0, widgetRows + 2 - first) : 0 }
}

/** Narrow: `s` in CSS pixels. */
function narrow(s: Screen, fixed: number): Layout {
  const need = BAND_H + (fixed || FIELD_MIN_H)
  let lw = FIELD_W
  let r = rowsOf(s, lw)
  // Too short for the band and the field at 240 across: a wider frame has the rows. Two columns at a time, one either side.
  while (r.rows - r.safe - r.strip < need && lw < NARROW_MAX_W) r = rowsOf(s, lw += 2)
  const top = r.strip + BAND_H
  // Rows a 432-row field leaves over stay under it as backdrop: the console does not grow.
  const fh = fixed || clamp(r.rows - r.safe - top, FIELD_MIN_H, FIELD_MAX_H)
  const fx = (lw - FIELD_W) >> 1
  const scale = Math.max(1, Math.ceil(Math.round(s.w * (s.ratio ?? 1)) / lw))
  return {
    scale, lw, lh: r.rows, cw: lw * scale, ch: r.rows * scale, mode: 'band',
    field: { x: fx, y: top, w: FIELD_W, h: fh },
    under: Math.max(0, r.rows - top - fh),
    left: null, right: null, rightPad: 0,
    band: { x: fx, y: r.strip, w: BAND_W, h: BAND_H, srcX: 0 },
    strip: r.strip > 0 ? { x: 0, y: 0, w: lw, h: r.strip } : null,
  }
}

/**
 * The layout for a canvas.
 *
 * `fieldH` is a run under way: its field keeps the height it began with. Wide, the scale is the
 * largest at which that whole field fits above the bottom band; narrow, the frame is as wide as
 * it must be for the band and that field to have their rows. A window made smaller or a phone
 * turned shows the same field, whole, with the console's colours and the backdrop round it.
 */
export function computeLayout(s: Screen, fieldH = 0): Layout {
  const ratio = s.ratio ?? 1
  const px = (v = 0): number => Math.round(v * ratio)
  const dev: Screen = { w: Math.max(1, px(s.w)), h: Math.max(1, px(s.h)), safeBottom: px(s.safeBottom), widgetLeft: px(s.widgetLeft), widgetBottom: px(s.widgetBottom) }
  const scale = wideScale(dev.w, dev.h - (dev.safeBottom ?? 0), fieldH)
  return scale ? wide(dev, scale, fieldH) : narrow(s, fieldH)
}

/**
 * Field coordinates of a point on the canvas given in CSS pixels. Narrow, the canvas is the frame
 * stretched over the screen, so the frame's width and rows give the place; wide, the device pixels do.
 */
export function toField(L: Layout, s: Screen, cssX: number, cssY: number): { x: number; y: number } {
  if (L.mode === 'band') return { x: (cssX * L.lw) / s.w - L.field.x, y: (cssY * L.lh) / s.h - L.field.y }
  const k = (s.ratio ?? 1) / L.scale
  return { x: cssX * k - L.field.x, y: cssY * k - L.field.y }
}

/** CSS pixels per logical pixel as a whole number of device pixels: the size of a pixel for what is laid over the frame. */
export function wholePx(L: Layout, s: Screen): number {
  const ratio = s.ratio ?? 1
  return L.mode === 'band' ? Math.max(1, Math.floor((s.w * ratio) / L.lw)) / ratio : L.scale / ratio
}
