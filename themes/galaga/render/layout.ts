/**
 * Space Voyagers: where everything sits on the screen. Pure arithmetic, no
 * DOM, so `tests/galaga-layout.test.mjs` can hold it to DESIGN.md's rule:
 * the field is 240 wide and 320 to 432 tall, one logical pixel is a whole
 * number of device pixels (the largest at which 240 x 320 fits), a console
 * panel either side from 560 logical pixels across, else a console band
 * above the field, and nothing that matters in the site's bottom band.
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

/** A console bitmap on the frame: `x, y` is where its column `srcX` lands, `w, h` how much of it shows. */
export interface Panel extends Rect { srcX: number }

export interface Layout {
  /** Device pixels per logical pixel. */
  scale: number
  /** The buffer, in logical pixels: it covers the whole canvas (the last column and row may be cut). */
  lw: number
  lh: number
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
  /** Rows above the band: the name plate, and the rest of the instruments when there is room. */
  strip: Rect | null
  /** How much of the strip, from its left edge, is clear of the radio widget, and from which row it is all clear. */
  stripClearW: number
  stripClearY: number
}

export interface Screen {
  /** The canvas in device pixels. */
  w: number
  h: number
  /** The site's bottom band, in device pixels. */
  safeBottom?: number
  /** The radio widget (top right): its left edge and its bottom edge, in device pixels. 0 for none. */
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

function at(s: Screen, scale: number): Layout {
  const lw = Math.ceil(s.w / scale)
  const lh = Math.ceil(s.h / scale)
  const fullW = Math.floor(s.w / scale)
  /** Rows above the site's bottom band. */
  const rows = Math.floor((s.h - (s.safeBottom ?? 0)) / scale)
  const widgetRows = Math.ceil((s.widgetBottom ?? 0) / scale)
  const widgetX = s.widgetBottom ? Math.floor((s.widgetLeft ?? 0) / scale) : fullW
  const fx = Math.floor((fullW - FIELD_W) / 2)
  if (fullW >= WIDE_FROM) {
    const fh = clamp(rows, FIELD_MIN_H, FIELD_MAX_H)
    const fy = Math.max(0, Math.floor((rows - fh) / 2))
    const pw = Math.min(PANEL_W, fx)
    // The radio widget sits over the top of the right panel: start the panel under it.
    const rx = fx + FIELD_W
    const pad = widgetRows > 0 && widgetX < rx + pw ? Math.max(0, widgetRows + 2 - fy) : 0
    return {
      scale, lw, lh, mode: 'wide',
      field: { x: fx, y: fy, w: FIELD_W, h: fh },
      under: lh - fy - fh,
      left: { x: fx - pw, y: fy, w: pw, h: Math.min(PANEL_H, lh - fy), srcX: panelCrop(LEFT_WINDOWS, pw) },
      right: { x: rx, y: fy + pad, w: pw, h: Math.min(PANEL_H, lh - fy - pad), srcX: panelCrop(RIGHT_WINDOWS, pw) },
      rightPad: pad,
      band: null, strip: null, stripClearW: 0, stripClearY: 0,
    }
  }
  // The band's windows on the widget's side begin 10 rows down: the widget may cover the rows above them.
  const want = Math.max(0, widgetRows - 8)
  const fh = clamp(rows - BAND_H - want, FIELD_MIN_H, FIELD_MAX_H)
  const top = Math.max(0, rows - fh)
  const bandH = Math.min(BAND_H, top)
  const stripH = top - bandH
  return {
    scale, lw, lh, mode: 'band',
    field: { x: fx, y: top, w: FIELD_W, h: fh },
    under: lh - top - fh,
    left: null, right: null, rightPad: 0,
    band: { x: fx, y: stripH, w: BAND_W, h: bandH, srcX: 0 },
    strip: stripH > 0 ? { x: fx, y: 0, w: FIELD_W, h: stripH } : null,
    stripClearW: clamp(widgetX - fx - 2, 0, FIELD_W),
    stripClearY: Math.min(stripH, widgetRows + 1),
  }
}

/**
 * The layout for a canvas. The scale is the largest whole number of device
 * pixels at which 240 x 320 fits; it gives one up when that would leave the
 * console band less than its 96 rows.
 */
export function computeLayout(s: Screen): Layout {
  const usableH = s.h - (s.safeBottom ?? 0)
  let scale = Math.max(1, Math.floor(Math.min(s.w / FIELD_W, usableH / FIELD_MIN_H)))
  let l = at(s, scale)
  while (scale > 1 && l.mode === 'band' && l.band!.h < BAND_H) l = at(s, --scale)
  return l
}
