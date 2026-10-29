/**
 * Space Voyagers II: where everything sits. Pure arithmetic, no DOM: the
 * page measures the screen and this says how many logical pixels the frame
 * has, how many device pixels a logical pixel is (a whole number), and where
 * the view, the dashboard, its screens and gauges, and the thumb buttons go
 * (DESIGN.md, "The cockpit", "Layouts").
 *
 * The frame covers the whole screen at a whole number `n` of device pixels a
 * logical pixel; the canvas is a hair larger than the screen when the screen
 * does not divide (less than one logical pixel), and that sliver is cut off
 * at the right and bottom. No pixel is ever of two sizes and nothing is ever
 * smoothed.
 */

export interface Rect { x: number; y: number; w: number; h: number }

export interface Layout {
  /** Logical frame size. */
  W: number
  H: number
  /** Device pixels a logical pixel. */
  n: number
  /** CSS size of the canvas (it may run a hair past the screen). */
  cssW: number
  cssH: number
  /** CSS pixels a logical pixel. */
  css: number
  wide: boolean
  touch: boolean
  view: Rect
  dash: Rect
  /** Below the dashboard: the site's bottom band (the dashboard's wood runs on). */
  under: Rect
  left: Rect
  right: Rect
  radar: { cx: number; cy: number; r: number }
  /** The gauges: speed, guns, burn, missiles, the lamps, the seats. */
  gauges: { speed: Rect; guns: Rect; burn: Rect; msl: Rect; auto: Rect; lock: Rect; seats: Rect }
  /** The subtitle box at the foot of the view: where and how many characters a row. */
  sub: Rect & { chars: number }
  /** Thumb buttons (touch only). */
  buttons: { fire: Rect; msl: Rect; burn: Rect } | null
  /** The site's radio widget over the view, in logical pixels: draw nothing there. */
  widget: Rect | null
  /** Touch: the pause chip in the view's top-left corner, and the pause screen's TURN BACK button. */
  pause: Rect
  turnBack: Rect
}

export interface Screen {
  cssW: number
  cssH: number
  dpr: number
  /** The site's bottom band in CSS pixels (`--app-safe-bottom`). */
  safeBottom: number
  /** The radio widget's box in CSS pixels, or null. */
  widget: Rect | null
  touch: boolean
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v))

/** The logical width aimed at on a phone held upright, and the logical height on a wide screen. */
export const NARROW_WIDTH = 240
export const WIDE_HEIGHT = 262

export function computeLayout(s: Screen): Layout {
  const dpr = Math.max(1, s.dpr)
  const devW = Math.round(s.cssW * dpr)
  const devH = Math.round(s.cssH * dpr)
  const wide = s.cssW > s.cssH * 1.05
  const n = Math.max(1, wide ? Math.round(devH / WIDE_HEIGHT) : Math.round(devW / NARROW_WIDTH))
  const W = Math.ceil(devW / n)
  const H = Math.ceil(devH / n)
  const css = n / dpr
  const safe = Math.max(0, Math.round(s.safeBottom / css))

  const dashH = wide ? 72 : clamp(Math.round(H * 0.25), 100, 124)
  const dashY = Math.max(40, H - safe - dashH)
  const view: Rect = { x: 0, y: 0, w: W, h: dashY }
  const dash: Rect = { x: 0, y: dashY, w: W, h: dashH }
  const under: Rect = { x: 0, y: dashY + dashH, w: W, h: Math.max(0, H - dashY - dashH) }

  let left: Rect, right: Rect, radar: Layout['radar'], gauges: Layout['gauges']
  if (!wide) {
    const sh = Math.min(60, dashH - 42)
    const y = dashY + 5
    const d = sh
    const sw = Math.floor((W - 8 - d - 8) / 2)
    left = { x: 4, y, w: sw, h: sh }
    right = { x: W - 4 - sw, y, w: sw, h: sh }
    radar = { cx: Math.floor(W / 2), cy: y + Math.floor(sh / 2), r: Math.floor(d / 2) - 1 }
    const gy = y + sh + 6
    const gh = dashY + dashH - gy - 5
    // Six gauges and the seats across the width.
    const cols = [36, 34, 34, 30, 22, 22, 40]
    const total = cols.reduce((a, b) => a + b, 0)
    const gap = Math.max(1, Math.floor((W - 8 - total) / (cols.length - 1)))
    let x = 4
    const at = (i: number): Rect => { const r = { x, y: gy, w: cols[i]!, h: gh }; x += cols[i]! + gap; return r }
    const speed = at(0), guns = at(1), burn = at(2), msl = at(3), auto = at(4), lock = at(5)
    const seats = { x, y: gy, w: Math.max(30, W - 4 - x), h: gh }
    gauges = { speed, guns, burn, msl, auto, lock, seats }
  } else {
    const sh = dashH - 12
    const y = dashY + 6
    const r = Math.floor(sh / 2)
    const cx = Math.floor(W / 2)
    const sw = Math.min(96, Math.floor((W - 2 * r - 16) / 4))
    left = { x: cx - r - 6 - sw, y, w: sw, h: sh }
    right = { x: cx + r + 6, y, w: sw, h: sh }
    radar = { cx, cy: y + r, r: r - 1 }
    // Gauges in two blocks: left of the left screen, right of the right screen.
    const lw = left.x - 8
    const rx = right.x + right.w + 4
    const rw = W - 4 - rx
    const row = Math.floor((sh - 4) / 3)
    gauges = {
      speed: { x: 4, y, w: lw, h: row },
      guns: { x: 4, y: y + row + 2, w: lw, h: row },
      burn: { x: 4, y: y + (row + 2) * 2, w: lw, h: row },
      msl: { x: rx, y, w: Math.floor(rw / 2) - 2, h: row },
      seats: { x: rx + Math.floor(rw / 2), y, w: rw - Math.floor(rw / 2), h: row * 2 + 2 },
      auto: { x: rx, y: y + row + 2, w: Math.floor(rw / 2) - 2, h: row },
      lock: { x: rx, y: y + (row + 2) * 2, w: Math.floor(rw / 2) - 2, h: row },
    }
  }

  let buttons: Layout['buttons'] = null
  const subRows = 4
  const subH = subRows * 9 + 4
  if (s.touch) {
    const fire: Rect = { x: W - 50, y: dashY - 38, w: 46, h: 32 }
    const msl: Rect = { x: W - 50, y: fire.y - 24, w: 46, h: 20 }
    const burn: Rect = { x: W - 92, y: dashY - 28, w: 38, h: 22 }
    buttons = { fire, msl, burn }
  }
  // Subtitles: at the foot of the view, clear of the buttons.
  const subW = s.touch ? W - 100 : Math.min(W - 16, 34 * 6 + 8)
  const sub = { x: s.touch ? 4 : Math.floor((W - subW) / 2), y: dashY - subH - 2, w: subW, h: subH, chars: Math.floor((subW - 6) / 6) }

  let widget: Rect | null = null
  if (s.widget) {
    widget = {
      x: Math.floor(s.widget.x / css), y: Math.floor(s.widget.y / css),
      w: Math.ceil(s.widget.w / css), h: Math.ceil(s.widget.h / css),
    }
  }

  const pause: Rect = { x: 3, y: 3, w: 18, h: 16 }
  const turnBack: Rect = { x: Math.floor(W / 2) - 36, y: Math.floor(view.h / 2) + 20, w: 72, h: 18 }
  return {
    W, H, n, cssW: (W * n) / dpr, cssH: (H * n) / dpr, css, wide, touch: s.touch,
    view, dash, under, left, right, radar, gauges, sub, buttons, widget, pause, turnBack,
  }
}

/** A CSS point on the canvas to logical pixels. */
export function toLogical(l: Layout, cssX: number, cssY: number): { x: number; y: number } {
  return { x: cssX / l.css, y: cssY / l.css }
}

export function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h
}
