/**
 * What lies beyond the map's edge in the 16-bit view: the dusk in layers that
 * slide at different speeds as the camera moves. Each layer is painted once,
 * pixel by pixel, at the view's own density (2 px per classic px), in solid
 * bands whose edges knit with ordered dither, the way a 16-bit machine
 * changed its backdrop colour from one scanline to the next.
 *
 * Three looks: `coast` (the town and the coast road: the stuck sun over an
 * open sea, islands, clouds, a headland with a lighthouse), `wild` (the
 * Wildwood: forested hills in haze, no sea) and `void` (rooms and dungeons:
 * almost nothing, so a room floats in something).
 *
 * How a layer is placed: its top edge at `top` × screen height, its left
 * edge at screen x = −(camera x × `parallax` + seconds × `drift`), wrapped
 * when `repeatX`. A layer that does not repeat is as wide as the screen and
 * stands still. The pictures are composed for an offset near zero: the sun
 * is in the middle of the screen and rims on ridges face it.
 */
import { hash2 } from '../../../base/pixel/scenery'

export interface BackdropLayer {
  canvas: HTMLCanvasElement
  /** how much of the camera's motion it follows: 0 stands still on the screen, 1 moves with the ground */
  parallax: number
  /** where the layer's top edge sits, as a fraction of the screen height (the engine aligns layers to the horizon line) */
  top: number
  /** tiles seamlessly along x */
  repeatX: boolean
  /** drawn at full brightness and fed to the bloom (sun, stars, far lights) */
  emissive: boolean
  /** drift in hi-res px per second along x (clouds) */
  drift: number
  /** seconds per blink: shown for the first half of each cycle, hidden for the second (a mast's lamp); absent on a layer that is always shown */
  blink?: number
}
export interface Backdrop {
  /** the horizon as a fraction of the screen height */
  horizon: number
  layers: BackdropLayer[]
}
export type BackdropLook = 'coast' | 'wild' | 'void'

// --- colour ------------------------------------------------------------------------

type RGB = readonly [number, number, number]

function hex(s: string): RGB {
  const t = s.replace('#', '')
  const n = parseInt(t.length === 3 ? t.replace(/./g, c => c + c) : t.slice(0, 6), 16) || 0
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k]
/** A colour as one 32-bit pixel (little-endian RGBA). */
const pack = (c: RGB, a = 255) => ((a << 24) | (clamp(Math.round(c[2]), 0, 255) << 16) | (clamp(Math.round(c[1]), 0, 255) << 8) | clamp(Math.round(c[0]), 0, 255)) >>> 0
const ink = (s: string) => pack(hex(s))

function toHsl(c: RGB): [number, number, number] {
  const r = c[0] / 255, g = c[1] / 255, b = c[2] / 255
  const hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2, d = hi - lo
  if (d === 0) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = hi === r ? ((g - b) / d + 6) % 6 : hi === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function fromHsl(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}
/** Between two colours the short way round the colour wheel, so indigo reaches pink through violet and magenta and never through grey. */
function hueMix(a: RGB, b: RGB, t: number): RGB {
  const x = toHsl(a), y = toHsl(b)
  const up = (y[0] - x[0] + 360) % 360
  let dh = up > 180 ? up - 360 : up
  // A dusk is not green: when the short way passes through green, take the other way round, unless that is most of the wheel.
  const green = dh > 0 ? (120 - x[0] + 360) % 360 < dh : (x[0] - 120 + 360) % 360 < -dh
  if (green && Math.abs(dh) > 120) dh = dh > 0 ? dh - 360 : dh + 360
  return fromHsl((x[0] + dh * t + 360) % 360, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t)
}

type Ramp = (t: number) => RGB
/** A colour ramp through stops at given places, 0 to 1. */
function rampOf(stops: [number, RGB][]): Ramp {
  return t => {
    if (t <= stops[0]![0]) return stops[0]![1]
    for (let i = 1; i < stops.length; i++) {
      const b = stops[i]!
      if (t <= b[0]) { const a = stops[i - 1]!; return mix(a[1], b[1], (t - a[0]) / (b[0] - a[0])) }
    }
    return stops[stops.length - 1]![1]
  }
}
/**
 * The sky from zenith (0) to the horizon (1): deep indigo, the given top
 * colour, violet, magenta, the given horizon colour, then a thin line of
 * orange and gold. `haze` greys it toward a mist colour (the Wildwood).
 */
function skyRamp(top: RGB, horizon: RGB, haze = 0): Ramp {
  const mist: RGB = [104, 84, 150]
  const h = (c: RGB, k = 1) => mix(c, mist, haze * k)
  return rampOf([
    [0, h(scale(top, 0.42), 0.4)],
    [0.3, h(top, 0.6)],
    [0.55, h(hueMix(top, horizon, 0.4))],
    [0.76, h(hueMix(top, horizon, 0.72))],
    [0.91, h(horizon)],
    [0.97, h(mix(horizon, [255, 150, 70], 0.8), 1.2)],
    [1, h([255, 214, 110], 1.4)],
  ])
}

// --- pixels ------------------------------------------------------------------------

/** A picture as 32-bit pixels; `wrap` makes x run round, for layers that repeat. */
interface Pix { w: number; h: number; d: Uint32Array; wrap: boolean }

const pix = (w: number, h: number, wrap = false): Pix => ({ w, h: Math.max(1, h), d: new Uint32Array(w * Math.max(1, h)), wrap })
function put(p: Pix, x: number, y: number, c: number) {
  if (y < 0 || y >= p.h) return
  if (p.wrap) x = ((x % p.w) + p.w) % p.w
  else if (x < 0 || x >= p.w) return
  p.d[y * p.w + x] = c
}
function get(p: Pix, x: number, y: number): number {
  if (y < 0 || y >= p.h) return 0
  if (p.wrap) x = ((x % p.w) + p.w) % p.w
  else if (x < 0 || x >= p.w) return 0
  return p.d[y * p.w + x]!
}
/** A filled box. */
function box(p: Pix, x: number, y: number, w: number, h: number, c: number) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(p, x + i, y + j, c)
}
function toCanvas(p: Pix): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = p.w
  c.height = p.h
  const g = c.getContext('2d')!
  const img = g.createImageData(p.w, p.h)
  new Uint32Array(img.data.buffer).set(p.d)
  g.putImageData(img, 0, 0)
  return c
}

const B2 = [0, 2, 3, 1]
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
/** Ordered dither, 4 × 4: true for `amount` (0 to 1) of the pixels, in a fixed pattern. */
const dither = (x: number, y: number, amount: number) => (B4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 < amount
/**
 * Which band a pixel belongs to. `v` is the place in band units; the last
 * `seam` of each band (a share of the band) knits into the next in three
 * steps: a quarter, a checker, three quarters.
 */
function band(v: number, seam: number, x: number, y: number): number {
  const i = Math.floor(v)
  const f = v - i
  if (f <= 1 - seam) return i
  return B2[(y & 1) * 2 + (x & 1)]! < 1 + Math.floor(((f - (1 - seam)) / seam) * 3) ? i + 1 : i
}
/** The same for water: the seam is woven from short dashes instead of dots. */
function weave(v: number, seam: number, x: number, y: number): number {
  const i = Math.floor(v)
  const f = v - i
  if (f <= 1 - seam) return i
  return ((x + y * 3) & 7) < 2 * (1 + Math.floor(((f - (1 - seam)) / seam) * 3)) ? i + 1 : i
}

/** Smooth noise along x that comes round after `period`: `cells` random values, eased (or straight lines, for rock). */
function wave(x: number, period: number, cells: number, salt: number, eased = true): number {
  cells = Math.max(1, Math.round(cells))
  const f0 = ((((x % period) + period) % period) / period) * cells
  const i = Math.floor(f0)
  const f = f0 - i
  const a = hash2(i % cells, 3, salt)
  const b = hash2((i + 1) % cells, 3, salt)
  return a + (b - a) * (eased ? f * f * (3 - 2 * f) : f)
}
/** A line through points (x rising), eased between them. */
function curve(pts: [number, number][], x: number): number {
  if (x <= pts[0]![0]) return pts[0]![1]
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i]!
    if (x <= b[0]) { const a = pts[i - 1]!; const f = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * f * f * (3 - 2 * f) }
  }
  return pts[pts.length - 1]![1]
}

// --- the scene's measures ----------------------------------------------------------

interface Scene {
  w: number
  h: number
  /** the horizon's row */
  line: number
  /** how big things are drawn: 1 on a 640 × 400 screen */
  u: number
  /** the width of a layer that repeats */
  wide: number
  /** the sun: centre, radius, and how far under its centre the horizon cuts it */
  sun: { x: number; y: number; r: number; cut: number }
  ramp: Ramp
  /** bands from zenith to horizon */
  bands: number
  /** how far below the horizon the sea's bands run before they stay one colour */
  deep: number
}

function sceneOf(w: number, h: number, top: RGB, horizon: RGB, haze: number): Scene {
  // A tall screen shows the map's far edge high up, so its horizon sits higher.
  const line = Math.round(h * clamp(0.42 - 0.06 * (h / w), 0.28, 0.38))
  const r = Math.round(Math.min(w * 0.15, h * 0.14, line * 0.5))
  const cut = Math.round(r * 0.38)
  return {
    w, h, line,
    u: clamp(Math.min(w, h) / 400, 0.75, 3),
    wide: w * 2,
    sun: { x: Math.round(w * 0.5), y: line - cut, r, cut },
    ramp: skyRamp(top, horizon, haze),
    bands: 24,
    deep: Math.min(h - line, Math.round(h * 0.5)),
  }
}

/** Where the sun stands as a layer sees it: +1 when it is to the right of x, −1 to the left. */
function sunward(sc: Scene, x: number, wide: number): number {
  const m = ((x % wide) + wide) % wide
  return m < sc.w * 0.5 || m >= sc.w * 0.5 + wide / 2 ? 1 : -1
}

function layerOf(sc: Scene, p: Pix, topRow: number, parallax: number, emissive = false, drift = 0): BackdropLayer {
  return { canvas: toCanvas(p), parallax, top: topRow / sc.h, repeatX: p.wrap, emissive, drift }
}

// --- the sky -----------------------------------------------------------------------

/** A sky row's place in band units: the bands grow thinner toward the horizon. */
const skyRow = (sc: Scene, y: number) => Math.pow(Math.max(0, y) / sc.line, 1.7) * sc.bands
/** How many bands warmer the sky is at a pixel for standing near the sun: the bands bend upward round it. */
function sunWarmth(sc: Scene, x: number, y: number, pull: number): number {
  const reach = sc.sun.r * 2.7
  const d = Math.hypot((x - sc.sun.x) / 1.7, y - sc.sun.y)
  return d < reach ? pull * (1 - d / reach) ** 2 : 0
}

/** The sky above the horizon, in bands. `pull` is how many bands the sun warms the sky next to it. */
function paintSky(p: Pix, sc: Scene, pull: number) {
  const n = sc.bands
  const cols: number[] = []
  for (let i = 0; i < n; i++) cols.push(pack(sc.ramp(i / (n - 1))))
  for (let y = 0; y < sc.line; y++) {
    const row = skyRow(sc, y)
    // The seam is about three rows whatever the band's height.
    const seam = clamp((skyRow(sc, y + 1) - row) * 3, 0.1, 0.5)
    const near = pull > 0 && Math.abs(y - sc.sun.y) < sc.sun.r * 2.7
    for (let x = 0; x < sc.w; x++) {
      const v = Math.min(n - 0.001, near ? row + sunWarmth(sc, x, y, pull) : row)
      p.d[y * p.w + x] = cols[Math.min(n - 1, band(v, seam, x, y))]!
    }
  }
}

/** The sea below the horizon: darker bands that widen toward the viewer, the sky's colours faintly mirrored in the far ones. */
function paintSea(p: Pix, sc: Scene) {
  const m = 16
  const cols: number[] = []
  for (let j = 0; j < m; j++) {
    const q = j / (m - 1)
    const water = mix([34, 40, 112], [14, 42, 60], Math.pow(q, 0.7))
    // The nearest band is the colour the engine clears to outdoors, so the sea runs on under the map without an edge.
    cols.push(pack(scale(mix(water, sc.ramp(0.92 - 0.8 * q), 0.46 * (1 - q) ** 1.4 + 0.05 * (1 - q)), 0.94 + 0.06 * q)))
  }
  const at = (dy: number) => Math.min(m - 0.001, m * Math.pow(dy / sc.deep, 1 / 1.6))
  for (let y = sc.line; y < sc.h; y++) {
    const dy = y - sc.line
    const v = at(dy)
    const seam = clamp((at(dy + 1) - v) * 3, 0.1, 0.5)
    for (let x = 0; x < sc.w; x++) p.d[y * p.w + x] = cols[Math.min(m - 1, weave(v, seam, x, y))]!
  }
}

/** The ground below the horizon where there is no sea: haze sinking into the dark of the wood. */
function paintGround(p: Pix, sc: Scene, forest: RGB) {
  const m = 9
  const cols: number[] = []
  const r = rampOf([[0, mix(sc.ramp(0.8), forest, 0.55)], [0.3, forest], [0.7, [14, 42, 60]], [1, [9, 26, 40]]])
  for (let j = 0; j < m; j++) cols.push(pack(r(j / (m - 1))))
  const at = (dy: number) => Math.min(m - 0.001, m * Math.pow(dy / sc.deep, 1 / 1.4))
  for (let y = sc.line; y < sc.h; y++) {
    const dy = y - sc.line
    const v = at(dy)
    const seam = clamp((at(dy + 1) - v) * 3, 0.08, 0.5)
    for (let x = 0; x < sc.w; x++) p.d[y * p.w + x] = cols[Math.min(m - 1, band(v, seam, x, y))]!
  }
}

/** Stars: sparse, denser toward the zenith, none in the horizon's glow or near the sun; three in the game's neon. */
function paintStars(sc: Scene, amount: number, reach: number): Pix {
  const limit = Math.round(sc.line * reach)
  const p = pix(sc.w, limit + 4)
  const dim = ink('#5a4f96'), mid = ink('#8f86c8'), pale = ink('#cfc6ff'), white = ink('#fff4ff')
  const taken: [number, number][] = []
  const free = (x: number, y: number, gap: number) => {
    if (Math.hypot(x - sc.sun.x, y - sc.sun.y) < sc.sun.r * 2.1) return false
    for (const t of taken) if (Math.abs(t[0] - x) < gap && Math.abs(t[1] - y) < gap) return false
    return true
  }
  const cross = (x: number, y: number, arm: number, centre: number) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(p, x + dx, y + dy, arm)
    put(p, x, y, centre)
  }
  // The three neon ones first, so the rest keep their distance.
  const neon: [number, number, string][] = [[0.17, 0.2, '#ff2fa0'], [0.79, 0.33, '#2ff3ff'], [0.61, 0.1, '#ffd23f']]
  for (const [fx, fy, c] of neon) {
    const x = Math.round(sc.w * fx), y = Math.round(limit * fy)
    cross(x, y, ink(c), white)
    for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) put(p, x + dx, y + dy, pack(scale(hex(c), 0.55)))
    taken.push([x, y])
  }
  const n = Math.round(((sc.w * limit) / 620) * amount)
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(hash2(i, 1, 41) * (sc.w - 4))
    const fy = Math.pow(hash2(i, 2, 41), 1.9)
    const y = 2 + Math.floor(fy * (limit - 2))
    const kind = hash2(i, 3, 41)
    // Only faint ones low down, where the sky is bright.
    const low = fy > 0.55
    if (!free(x, y, kind > 0.9 ? 9 : 5)) continue
    taken.push([x, y])
    if (kind < 0.5 || low) put(p, x, y, kind < 0.25 ? dim : mid)
    else if (kind < 0.8) put(p, x, y, pale)
    else if (kind < 0.9) { put(p, x, y, white); put(p, x + 1, y, pale); put(p, x, y + 1, pale); put(p, x + 1, y + 1, mid) }
    else if (kind < 0.97) cross(x, y, mid, white)
    else {
      // A sparkle: four arms that fade.
      cross(x, y, pale, white)
      for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]] as const) put(p, x + dx, y + dy, mid)
      for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]] as const) put(p, x + dx, y + dy, dim)
    }
  }
  return p
}

/**
 * The stuck sun: striped gold to pink, its lower part cut by slits that
 * widen, a dithered glow round it, and (over a sea) its broken column of
 * light on the water. `veil` dims it toward the haze.
 */
function paintSun(sc: Scene, veil: number, sea: boolean): { p: Pix; top: number } {
  const { x: cx, y: cy, r, cut } = sc.sun
  const glow = Math.round(r * 0.6)
  const top = cy - r - glow
  const fall = sea ? Math.min(sc.deep, Math.round(r * 2.6)) : 0
  const p = pix(sc.w, sc.line - top + fall)
  const mist: RGB = [178, 112, 150]
  const tones = ['#fff1b0', '#ffd23f', '#ffb13f', '#ff8a3d', '#ff5f7a', '#ff2fa0'].map(c => pack(mix(hex(c), mist, veil)))
  // The slits: every `period` rows from a little above the middle, each one row thicker than the last.
  const period = Math.max(5, Math.round(r / 6.5))
  const slit = (yy: number) => {
    const from = yy + Math.round(r * 0.14)
    if (from < 0) return false
    const k = Math.floor(from / period)
    return from % period < Math.min(period - 2, 2 + Math.round(k * period * 0.12))
  }
  for (let yy = -r; yy < cut; yy++) {
    if (slit(yy)) continue
    const half = Math.floor(Math.sqrt(r * r - yy * yy))
    const v = ((yy + r) / (r + cut)) * tones.length
    for (let x = cx - half; x <= cx + half; x++) put(p, x, cy + yy - top, tones[Math.min(tones.length - 1, band(v, Math.min(0.5, (3 * tones.length) / (r + cut)), x, yy))]!)
  }
  // The glow: the sky's own colours a few bands warmer, thinning out with distance.
  for (let y = top; y < sc.line; y++) {
    for (let x = cx - r - glow; x <= cx + r + glow; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d <= r + 0.5 || d > r + glow) continue
      if (!dither(x, y, 0.55 * (1 - veil * 0.5) * (1 - (d - r) / glow) ** 1.6)) continue
      put(p, x, y - top, pack(mix(sc.ramp(Math.min(1, skyRow(sc, y) / sc.bands + 0.2)), mist, veil * 0.6)))
    }
  }
  if (!sea) return { p, top }
  // The column on the water: bars that shorten, break up and cool with distance from the horizon.
  const light = rampOf([[0, hex('#ffe9a0')], [0.15, hex('#ffc24f')], [0.35, hex('#ff8a3d')], [0.6, hex('#ff5f8a')], [0.85, hex('#b8409a')], [1, hex('#6a3aa0')]])
  const base = sc.line - top
  let y = 1
  for (let k = 0; y < fall; k++) {
    const depth = y / fall
    const thick = depth > 0.45 ? 2 : 1
    const half = Math.round(r * (0.95 - 0.6 * depth) * (0.72 + 0.5 * hash2(k, 1, 77)))
    const off = Math.round((hash2(k, 2, 77) - 0.5) * r * 0.5 * depth)
    const c = pack(light(depth))
    // Each bar is a few pieces with gaps that grow.
    let x = cx + off - half
    for (let i = 0; x < cx + off + half; i++) {
      const piece = 3 + Math.floor(hash2(k, 10 + i, 77) * (half * (0.9 - 0.6 * depth)))
      const end = Math.min(cx + off + half, x + piece)
      box(p, x, base + y, end - x, thick, c)
      x = end + 2 + Math.floor(hash2(k, 40 + i, 77) * (2 + depth * 10))
    }
    y += thick + 1 + Math.floor(depth * 4 + hash2(k, 3, 77) * 1.6)
  }
  // Loose glints round the column, thicker close to it.
  const count = Math.round(r * 1.1)
  for (let i = 0; i < count; i++) {
    const side = hash2(i, 1, 78) < 0.5 ? -1 : 1
    const depth = Math.pow(hash2(i, 2, 78), 1.4)
    const gx = cx + side * Math.round(r * (0.75 - 0.3 * depth) + Math.pow(hash2(i, 3, 78), 1.6) * r * 1.9)
    const gy = 2 + 2 * Math.floor((depth * (fall - 4)) / 2)
    const len = 2 + Math.floor(hash2(i, 4, 78) * (2 + depth * 5))
    box(p, gx, base + gy, len, 1, pack(scale(light(Math.min(1, depth + 0.25)), 0.85)))
  }
  return { p, top }
}

// --- land --------------------------------------------------------------------------

interface LandPaint {
  /** the crest's colour, the body under it, and how many rows the crest tone runs before it knits into the body */
  crest: number
  body: number
  crestRows: number
  /** the rim on what faces the sun, and on what does not (0 for none) */
  rim: number
  shadeRim: number
  /** haze knitted into the lowest rows above the base (0 for none), and how many rows */
  haze: number
  hazeRows: number
}

/**
 * Land as a silhouette: `ht[x]` is how high it stands over `base` (the row
 * of its foot in the picture). Filled down to `bottom`, lit along the crest
 * on the side that faces the sun.
 */
function paintLand(p: Pix, sc: Scene, ht: Int16Array, base: number, bottom: number, c: LandPaint) {
  const W = p.w
  for (let x = 0; x < W; x++) {
    const hgt = ht[x]!
    if (hgt <= 0) continue
    const y0 = base - hgt
    for (let y = y0; y < bottom; y++) {
      let col = band((y - y0) / c.crestRows, 0.5, x, y) < 1 ? c.crest : c.body
      if (c.haze && y >= base - c.hazeRows && y < base && B2[(y & 1) * 2 + (x & 1)]! < Math.floor(((y - (base - c.hazeRows) + 1) / c.hazeRows) * 4)) col = c.haze
      p.d[y * W + x] = col
    }
    // The rim: on flats and on slopes that face the sun, and down the step where the slope is steep.
    const dir = sunward(sc, x, W)
    const toward = ht[(x + dir + W) % W]!
    const lit = toward <= hgt
    const rim = lit ? c.rim : c.shadeRim
    if (!rim) continue
    put(p, x, y0, rim)
    if (lit && hgt - toward > 1) for (let y = y0; y < Math.min(base, y0 + hgt - Math.max(0, toward)); y++) put(p, x, y, rim)
  }
}

/** Raises a profile by a round treetop. */
function canopy(ht: Int16Array, cx: number, foot: number, r: number) {
  const W = ht.length
  for (let dx = -r; dx <= r; dx++) {
    const x = (((cx + dx) % W) + W) % W
    const top = foot + Math.round(Math.sqrt(r * r - dx * dx + r * 0.8))
    if (top > ht[x]!) ht[x] = top
  }
}
/** Raises a profile by a fir: three tiers, each a slope that ends in a step. */
function fir(ht: Int16Array, cx: number, foot: number, half: number, tall: number) {
  const W = ht.length
  for (let dx = -half; dx <= half; dx++) {
    const x = (((cx + dx) % W) + W) % W
    const t = Math.min(2.999, (1 - Math.abs(dx) / (half + 1)) * 3)
    const tier = Math.floor(t)
    const top = foot + Math.round((tall * (tier + (t - tier) * 0.55 + 0.45)) / 3)
    if (top > ht[x]!) ht[x] = top
  }
}

/** A radio mast standing at (x, foot): a thin lattice. Returns the row of its tip. */
function paintMast(p: Pix, x: number, foot: number, tall: number, step: number, half: number, iron: number, dark: number): number {
  for (let i = 0; i < tall; i++) {
    const hw = Math.round((1 - i / tall) * half)
    put(p, x, foot - 1 - i, iron)
    if (i % step === 0) box(p, x - hw, foot - 1 - i, hw * 2 + 1, 1, iron)
    if (hw > 0) { put(p, x - hw, foot - 1 - i, dark); put(p, x + hw, foot - 1 - i, dark) }
  }
  box(p, x, foot - tall - step, 1, step, iron)
  return foot - tall - step
}

// --- the coast ---------------------------------------------------------------------

/** Far islands: two hazy violet ranges that rise out of the sea and leave gaps of open water. */
function paintIsles(sc: Scene): { p: Pix; top: number } {
  const W = sc.wide
  const tall = Math.round(34 * sc.u)
  const p = pix(W, tall + 4, true)
  const base = tall + 1
  const ranges: [number, number, number, RGB, RGB][] = [
    // salt, height, how much of it is under water, body, rim
    [5, tall, 0.47, mix(sc.ramp(0.8), [120, 92, 200], 0.62), mix(sc.ramp(0.93), [255, 214, 220], 0.45)],
    [9, Math.round(tall * 0.62), 0.5, mix(sc.ramp(0.6), [62, 50, 156], 0.72), mix(sc.ramp(0.9), [255, 170, 210], 0.3)],
  ]
  for (const [salt, top, sunk, body, rim] of ranges) {
    const ht = new Int16Array(W)
    for (let x = 0; x < W; x++) {
      // Broad swells that carry sharp peaks; the sea is left open under the sun.
      const peak = 1 - Math.abs(2 * wave(x, W, 17, salt + 1, false) - 1)
      const n = wave(x, W, 5, salt) * 0.5 + wave(x, W, 9, salt + 3, false) * 0.28 + peak * 0.12 + wave(x, W, 41, salt + 2, false) * 0.1
      const m = ((x % W) + W) % W
      const fromSun = Math.min(Math.abs(m - sc.sun.x), Math.abs(m - sc.sun.x - W))
      const open = clamp((fromSun - sc.sun.r * 1.15) / (sc.sun.r * 1.5), 0, 1)
      ht[x] = Math.max(0, Math.round(((n - sunk) / (1 - sunk)) * top * 1.7 * open))
    }
    paintLand(p, sc, ht, base, base, {
      crest: pack(mix(body, rim, 0.22)), body: pack(body), crestRows: Math.max(3, Math.round(5 * sc.u)),
      rim: pack(rim), shadeRim: 0,
      haze: pack(mix(body, sc.ramp(0.95), 0.5)), hazeRows: Math.max(3, Math.round(6 * sc.u)),
    })
    // A dark line where each island meets the water, and its broken shadow under it.
    const dark = pack(scale(body, 0.62))
    for (let x = 0; x < W; x++) {
      if (ht[x]! <= 0) continue
      put(p, x, base, dark)
      if (((x + salt) & 7) < 5) put(p, x, base + 1, dark)
      if (((x + salt * 3) & 7) < 2) put(p, x, base + 2, dark)
    }
  }
  return { p, top: sc.line - base }
}

/** A strip of long flat dusk clouds, dark on top and lit pink and gold from below. */
function paintClouds(sc: Scene, salt: number, count: number, thick: number, long: number, tones: RGB[]): Pix {
  const W = sc.wide
  const H = Math.round(thick * 3.2) + 6
  const p = pix(W, H, true)
  const [shade, mid, lit, gold] = tones.map(t => pack(t)) as [number, number, number, number]
  for (let i = 0; i < count; i++) {
    const len = Math.round(long * (0.55 + hash2(i, 1, salt) * 0.9))
    const x0 = Math.round(((i + 0.15 + hash2(i, 2, salt) * 0.7) / count) * W)
    const tk = thick * (0.6 + hash2(i, 3, salt) * 0.7)
    const foot = Math.round(H - 4 - hash2(i, 4, salt) * (H - 6 - tk * 1.4))
    for (let k = 0; k < len; k++) {
      const a = (k + 0.5) / len
      // Long tapering ends, a body that swells in lumps on top and stays flat underneath.
      const env = Math.min(1, a * 4.5, (1 - a) * 4.5) ** 0.8
      const lump = wave(x0 + k, W, Math.round(W / (tk * 3.2)), salt + i) * 0.7 + wave(x0 + k, W, Math.round(W / (tk * 1.1)), salt + i + 50) * 0.3
      const up = Math.round((tk * env * (0.3 + 0.9 * lump)) / 2) * 2
      const down = Math.round(tk * 0.22 * env * wave(x0 + k, W, Math.round(W / (tk * 5)), salt + i + 90))
      const x = x0 + k
      if (up + down < 1) {
        // The ends break into dashes.
        if (env > 0.08 && ((x >> 1) & 3) < 2) put(p, x, foot, mid)
        continue
      }
      const y0 = foot - up, y1 = foot + down
      const th = y1 - y0 + 1
      for (let y = y0; y <= y1; y++) {
        const fromFoot = y1 - y
        const knit = (x + y) & 1
        let c = shade
        if (th >= 4 && fromFoot === 0) c = gold
        else if (fromFoot < Math.max(1, th * 0.2) + (th > 5 ? knit : 0)) c = lit
        else if (fromFoot < th * 0.52 + (th > 5 ? knit : 0)) c = mid
        put(p, x, y, c)
      }
    }
  }
  return p
}

/**
 * The near coast: a dark headland whose tip carries a lighthouse and a few
 * houses, a low skerry with a radio mast, and the line where they meet the
 * sea. Returns the land and, the same size, what is lit on it.
 */
function paintCoast(sc: Scene): { land: Pix; lights: Pix; top: number } {
  const W = sc.wide
  const u = sc.u
  const n = (v: number) => Math.max(1, Math.round(v * u))
  const tall = n(58)
  const over = n(40)
  const under = n(16)
  const base = tall + over
  const land = pix(W, base + under, true)
  const lights = pix(W, base + under, true)
  const ht = new Int16Array(W)
  const rock = (x: number, salt: number) => wave(x, W, 60, salt, false) * 0.6 + wave(x, W, 150, salt + 1, false) * 0.4
  // The headland runs off the left of the picture and round its seam; its tip points at the sun.
  const hx0 = Math.round(-0.52 * sc.w), hx1 = Math.round(0.31 * sc.w)
  const head: [number, number][] = [[0, 0], [0.05, 0.4], [0.17, 0.84], [0.31, 1], [0.44, 0.8], [0.55, 0.6], [0.67, 0.74], [0.75, 0.68], [0.85, 0.4], [0.93, 0.3], [0.975, 0.25], [1, 0]]
  for (let x = hx0; x <= hx1; x++) {
    const a = (x - hx0) / (hx1 - hx0)
    const v = curve(head, a) * tall * (0.86 + 0.2 * rock(x, 21))
    ht[((x % W) + W) % W] = Math.max(1, Math.round(v))
  }
  // The skerry, and two rocks further out.
  const skerries: [number, number, number][] = [[0.94, 1.3, 13], [1.38, 1.45, 5], [0.7, 0.75, 4]]
  for (const [f0, f1, top] of skerries) {
    const s0 = Math.round(f0 * sc.w), s1 = Math.round(f1 * sc.w)
    for (let x = s0; x <= s1; x++) {
      const a = (x - s0) / (s1 - s0)
      ht[x % W] = Math.max(ht[x % W]!, Math.round(Math.sin(Math.PI * a) ** 0.6 * n(top) * (0.7 + 0.5 * rock(x, 33))))
    }
  }
  // Trees along the headland's back: round crowns, like the town's.
  const ground = Int16Array.from(ht)
  for (let i = 0; i < 40; i++) {
    const a = 0.07 + hash2(i, 1, 51) * 0.76
    const x = Math.round(hx0 + a * (hx1 - hx0))
    const r = n(3 + hash2(i, 2, 51) * 3.5)
    canopy(ht, x, ground[((x % W) + W) % W]! - 1, r)
  }
  const body = hex('#1a1240')
  paintLand(land, sc, ht, base, base, {
    crest: pack(mix(body, [70, 44, 120], 0.45)), body: pack(body), crestRows: n(7),
    rim: ink('#d0509e'), shadeRim: ink('#4a3484'), haze: 0, hazeRows: 0,
  })
  // The waterline: a pale broken line of foam, and the land's dark mirror woven into the sea under it.
  const foam = ink('#c8a6ec'), dark = pack(scale(body, 0.8))
  for (let x = 0; x < W; x++) {
    if (ht[x]! <= 0) continue
    put(land, x, base, ((x * 7) & 15) < 11 ? foam : dark)
    const reach = Math.min(under - 1, 2 + Math.round(ht[x]! * 0.3))
    for (let d = 1; d <= reach; d++) if (((x + d * 3) & 7) < 7 - Math.round((d / reach) * 6)) put(land, x, base + d, dark)
  }

  const wall = ink('#2a1e58'), wallLit = ink('#3f2f78'), roof = ink('#120b2c'), rimPink = ink('#d0509e')
  const gold = ink('#ffd23f'), amber = ink('#ffb13f'), white = ink('#fff4d0')
  const footAt = (x: number) => base - ground[((x % W) + W) % W]!

  // Houses on the tip's shoulder: a wall, a pitched roof, one or two windows.
  const houses: [number, number, number, string][] = [[0.6, 9, 6, 'y'], [0.66, 7, 5, 'a'], [0.715, 10, 7, 'y'], [0.775, 7, 5, 'c'], [0.825, 8, 6, 'y'], [0.47, 8, 5, 'p']]
  const lamp: Record<string, number> = { y: gold, a: amber, c: ink('#2ff3ff'), p: ink('#ff5fd0') }
  for (const [a, bw, bh, tone] of houses) {
    const x = Math.round(hx0 + a * (hx1 - hx0))
    const w = n(bw), h = n(bh)
    const foot = Math.max(footAt(x), footAt(x + w - 1)) + 1
    box(land, x, foot - h, w, h, wall)
    box(land, x + w - 1, foot - h, 1, h, wallLit)
    for (let k = 0; k < Math.ceil(w / 2) + 1; k++) box(land, x - 1 + k, foot - h - 1 - k, w + 2 - 2 * k, 1, roof)
    put(land, x + w, foot - h - 1, rimPink)
    const win = Math.max(2, n(1.6))
    box(lights, x + n(1.5), foot - h + n(1.5), win, win, lamp[tone]!)
    if (w > n(8)) box(lights, x + w - n(1.5) - win, foot - h + n(1.5), win, win, lamp[tone]!)
  }
  // Windows lower on the slope, where the houses themselves are lost in the dark.
  for (let i = 0; i < 7; i++) {
    const a = 0.2 + hash2(i, 1, 61) * 0.55
    const x = Math.round(hx0 + a * (hx1 - hx0))
    const y = footAt(x) + n(6) + Math.floor(hash2(i, 2, 61) * (base - footAt(x) - n(10)))
    if (y > base - n(3)) continue
    box(lights, x, y, 2, 2, hash2(i, 3, 61) < 0.7 ? gold : amber)
  }

  // The lighthouse, a little in from the tip: a banded tower, a gallery, the lamp room, a cap.
  const lx = Math.round(hx0 + 0.9 * (hx1 - hx0))
  const lfoot = footAt(lx) + 1
  const th = n(30), bw = n(9), tw = n(6)
  for (let i = 0; i < th; i++) {
    const w = Math.round(bw + ((tw - bw) * i) / th)
    const x = lx - Math.floor(w / 2)
    const stripe = Math.floor((i / th) * 5) % 2 === 1
    box(land, x, lfoot - 1 - i, w, 1, stripe ? wallLit : wall)
    put(land, x, lfoot - 1 - i, roof)
    put(land, x + w - 1, lfoot - 1 - i, rimPink)
  }
  const gy = lfoot - th - 1
  box(land, lx - Math.floor(tw / 2) - 2, gy, tw + 4, 1, roof)
  put(land, lx - Math.floor(tw / 2) - 2 + tw + 3, gy, rimPink)
  const room = n(5)
  box(land, lx - Math.floor(tw / 2), gy - room, tw, room, roof)
  for (let k = 0; k < Math.ceil(tw / 2) + 1; k++) box(land, lx - Math.floor(tw / 2) - 1 + k, gy - room - 1 - k, tw + 2 - 2 * k, 1, roof)
  box(land, lx, gy - room - Math.ceil(tw / 2) - n(3), 1, n(3), roof)
  // Its lamp, and two beams over the sea.
  box(lights, lx - Math.floor(tw / 2) + 1, gy - room + 1, tw - 2, room - 2, gold)
  box(lights, lx - Math.floor(tw / 2) + 2, gy - room + 1, Math.max(1, tw - 4), Math.max(1, room - 3), white)
  const ly = gy - room + Math.floor(room / 2)
  const beam = ink('#ffe9a0')
  for (const [dir, reach, rise] of [[1, n(60), -0.06], [-1, n(34), 0.04]] as const) {
    // A wedge with hard edges: whole near the lamp, then every other row, then those rows in staggered dashes.
    for (let k = tw; k < reach; k++) {
      const far = k / reach
      const spread = Math.floor(k * 0.07)
      const mid = ly + Math.round(k * rise)
      for (let y = mid - spread; y <= mid + spread; y++) {
        if (far < 0.3 || (((y - ly) & 1) === 0 && (far < 0.62 || ((k + y - ly) & 3) < 2))) put(lights, lx + dir * k, y, beam)
      }
    }
  }
  // The lamp's light on the water under it.
  for (let d = 2; d < under; d += 2 + Math.floor(d / 4)) box(lights, lx - 2 + ((d * 3) % 3), base + d, 4 - Math.floor(d / 6), 1, amber)

  // The radio mast on the skerry: a thin lattice with a red lamp on top.
  const mx = Math.round(1.1 * sc.w)
  const tip = paintMast(land, mx, base - ht[mx % W]! + 1, n(36), n(5), n(3), wallLit, wall)
  box(lights, mx - 1, tip - 2, 2, 2, ink('#ff3b5c'))
  put(lights, mx, tip + n(18), ink('#ff3b5c'))
  return { land, lights, top: sc.line - base }
}

/** Short glints lying on the sea, row by row, longer and fewer toward the viewer. */
function paintGlints(sc: Scene): { p: Pix; top: number } {
  const W = sc.wide
  const H = Math.round(sc.deep * 0.8)
  const p = pix(W, H, true)
  const tone = rampOf([[0, hex('#ffb6c8')], [0.3, hex('#e88ad0')], [0.65, hex('#9a8fe6')], [1, hex('#5f78c8')]])
  let y = 3
  for (let k = 0; y < H - 1; k++) {
    const depth = y / H
    const count = Math.round((W / (70 + depth * 260)) * (0.6 + hash2(k, 1, 91) * 0.8))
    for (let i = 0; i < count; i++) {
      const x = Math.floor(hash2(k, 10 + i, 91) * W)
      const len = 2 + Math.floor(hash2(k, 60 + i, 91) * (2 + depth * 9))
      const cyan = hash2(k, 110 + i, 91) > 0.93
      const c = cyan ? hex('#7ce4ff') : tone(depth)
      box(p, x, y, len, 1, pack(scale(c, 0.9 - depth * 0.3)))
      // The long ones carry a paler head.
      if (len > 5) box(p, x + 1, y, 2, 1, pack(c))
    }
    y += 2 + Math.floor(depth * 9 + hash2(k, 2, 91) * 2)
  }
  return { p, top: sc.line + 1 }
}

function buildCoast(w: number, h: number, top: RGB, horizon: RGB): Backdrop {
  const sc = sceneOf(w, h, top, horizon, 0)
  const layers: BackdropLayer[] = []
  const sky = pix(w, h)
  paintSky(sky, sc, 3.2)
  paintSea(sky, sc)
  layers.push(layerOf(sc, sky, 0, 0))
  layers.push(layerOf(sc, paintStars(sc, 1, 0.6), 0, 0, true))
  const sun = paintSun(sc, 0, true)
  layers.push(layerOf(sc, sun.p, sun.top, 0, true))
  const isles = paintIsles(sc)
  layers.push(layerOf(sc, isles.p, isles.top, 0.04))
  // Two strips of cloud: thin bright ones low over the glow, heavier ones higher up that move faster.
  const r = sc.ramp
  const low = paintClouds(sc, 300, 4, 5 * sc.u, 170 * sc.u, [r(0.42), mix(r(0.6), [150, 70, 150], 0.3), mix(r(0.93), [255, 220, 200], 0.25), r(1)])
  layers.push(layerOf(sc, low, Math.round(sc.line * 0.8) - low.h, 0.06, false, 1.2))
  const high = paintClouds(sc, 400, 4, 10 * sc.u, 220 * sc.u, [mix(r(0.5), [92, 70, 168], 0.5), mix(r(0.7), [190, 96, 180], 0.3), mix(r(0.9), [255, 200, 190], 0.15), mix(r(0.98), [255, 230, 170], 0.3)])
  layers.push(layerOf(sc, high, Math.round(sc.line * 0.52) - high.h, 0.08, false, 2.6))
  const coast = paintCoast(sc)
  layers.push(layerOf(sc, coast.land, coast.top, 0.15))
  layers.push(layerOf(sc, coast.lights, coast.top, 0.15, true))
  const glints = paintGlints(sc)
  layers.push(layerOf(sc, glints.p, glints.top, 0.1, true))
  return { horizon: sc.line / h, layers }
}

// --- the Wildwood ------------------------------------------------------------------

/** One depth of hills: rolling ground, with treetops along its back when it is near enough to tell them apart. */
function paintHills(sc: Scene, o: {
  salt: number
  /** the crest's highest and lowest, and how far the body runs below the foot (all in units) */
  tall: number; lift: number; under: number
  /** swells per picture width */
  cells: number
  /** trees along the crest: how many, their crown's radius (units), the share that are firs */
  trees: number; crown: number; firs: number
  paint: LandPaint
  /** the colour of the lit arc on a crown (0 for none) */
  leaf: number
  /** sinks into a valley where the sun stands */
  dip?: boolean
  mast?: boolean
}): { p: Pix; lights: Pix | null; top: number } {
  const W = sc.wide
  const n = (v: number) => Math.max(1, Math.round(v * sc.u))
  const tall = n(o.tall)
  const over = n(o.crown * 3.4 + (o.mast ? 44 : 0)) + 2
  const base = tall + over
  const p = pix(W, base + n(o.under), true)
  const ht = new Int16Array(W)
  for (let x = 0; x < W; x++) {
    const v = wave(x, W, o.cells, o.salt) * 0.6 + wave(x, W, o.cells * 2.5, o.salt + 1) * 0.28 + wave(x, W, o.cells * 6, o.salt + 2) * 0.12
    const fromSun = Math.min(Math.abs(x - sc.sun.x), Math.abs(x - sc.sun.x - W))
    const open = o.dip ? clamp((fromSun - sc.sun.r * 0.8) / (sc.sun.r * 1.8), 0, 1) : 1
    ht[x] = Math.round(n(o.lift) * (0.55 + 0.45 * open) + v * (tall - n(o.lift)) * open * open * (3 - 2 * open))
  }
  const ground = Int16Array.from(ht)
  const crowns = plant(sc, ht, ground, o.trees, o.crown, o.firs, o.salt)
  paintLand(p, sc, ht, base, p.h, o.paint)
  if (o.leaf) leaves(p, sc, crowns, base, o.leaf)
  let lights: Pix | null = null
  if (o.mast) {
    // The radio mast on the highest hill right of the sun, and its lamp on a layer of its own so it can blink.
    let mx = Math.round(sc.w * 0.66)
    for (let x = mx; x < Math.round(sc.w * 0.92); x++) if (ground[x]! > ground[mx]!) mx = x
    const iron = pack(scale(hex('#3a2c6a'), 0.95))
    const tip = paintMast(p, mx, base - ground[mx]! + 1, n(34), n(5), n(3), iron, iron)
    lights = pix(W, p.h, true)
    const red = ink('#ff3b5c')
    box(lights, mx - 1, tip - 2, 3, 2, red)
    put(lights, mx, tip - 3, ink('#ff9aa8'))
  }
  return { p, lights, top: sc.line - base }
}

/** Stands trees along a profile and returns the round ones (x, foot, radius) for their highlights. */
function plant(sc: Scene, ht: Int16Array, ground: Int16Array, count: number, crown: number, firs: number, salt: number): [number, number, number][] {
  const W = ht.length
  const crowns: [number, number, number][] = []
  for (let i = 0; i < count; i++) {
    const x = Math.round(((i + hash2(i, 1, salt) * 0.9) / count) * W) % W
    const r = Math.max(1, Math.round(crown * sc.u * (0.62 + hash2(i, 2, salt) * 0.7)))
    const foot = ground[x]! - Math.round(r * 0.4)
    if (hash2(i, 3, salt) < firs) fir(ht, x, foot, Math.max(2, Math.round(r * 0.8)), Math.round(r * 2.7))
    else { canopy(ht, x, foot, r); crowns.push([x, foot, r]) }
  }
  return crowns
}

/** A lighter arc under each crown's top, on the side the sun is on, where the crown is not hidden by its neighbours. */
function leaves(p: Pix, sc: Scene, crowns: [number, number, number][], base: number, leaf: number) {
  for (const [cx, foot, r] of crowns) {
    if (r < 4) continue
    const dir = sunward(sc, cx, p.w)
    const inset = 2 + Math.round(r * 0.16)
    for (let k = -Math.round(r * 0.25); k <= Math.round(r * 0.7); k++) {
      const x = cx + dir * k
      const y = base - (foot + Math.round(Math.sqrt(r * r - k * k + r * 0.8))) + inset
      // Only where this crown is the outline: a little sky above, the crown below.
      if (get(p, x, y - inset - 1) === 0 && get(p, x, y - inset + 1) !== 0) put(p, x, y, leaf)
    }
  }
}

/**
 * The wood itself, from the nearest hill's back down to the bottom of the
 * screen: row after row of treetops, each row bigger, lower and darker than
 * the one behind it, the way a forest looks from a height.
 */
function paintForest(sc: Scene): { p: Pix; top: number } {
  const W = sc.wide
  const u = sc.u
  const over = Math.round(40 * u)
  const p = pix(W, over + sc.h - sc.line, true)
  const rows = Math.ceil(Math.log(1 + ((sc.h - sc.line) / u) * 0.2 / 9) / Math.log(1.2)) + 1
  let foot = over + Math.round(6 * u)
  for (let k = 0; k < rows; k++) {
    const t = k / Math.max(1, rows - 1)
    const crown = Math.min(30, 7 * 1.17 ** k)
    const ht = new Int16Array(W)
    const swell = Math.round(9 * u * (1 - t * 0.5))
    for (let x = 0; x < W; x++) ht[x] = 1 + Math.round(wave(x, W, 6 + k, 140 + k * 7) * swell)
    const ground = Int16Array.from(ht)
    const crowns = plant(sc, ht, ground, Math.round(W / (crown * u * 1.25)), crown, k < 3 ? 0.2 : 0.1, 150 + k * 13)
    const body = mix([17, 60, 76], [9, 27, 42], Math.pow(t, 0.6))
    // The next row stands everywhere, so this one is only seen down to that row's foot.
    const next = foot + Math.round(9 * u * 1.2 ** k)
    paintLand(p, sc, ht, foot, k === rows - 1 ? p.h : Math.min(p.h, next), {
      crest: pack(mix(body, [42, 133, 121], 0.42 * (1 - t * 0.7))), body: pack(body), crestRows: Math.max(3, Math.round(crown * u * 0.5)),
      // Only the first rows stand against the sky and take the sun's pink on their edge.
      rim: pack(k === 0 ? hex('#c0589a') : mix(body, k < 3 ? [176, 80, 150] : [60, 170, 150], 0.5 * (1 - t))), shadeRim: pack(mix(body, [42, 133, 121], 0.5 * (1 - t))),
      haze: 0, hazeRows: 0,
    })
    leaves(p, sc, crowns, foot, pack(mix(body, [95, 214, 184], 0.4 * (1 - t * 0.75))))
    foot = next
  }
  return { p, top: sc.line - over }
}

/** A low band of mist: long streaks one over the other with clear rows between, longest and palest in the middle of the band. */
function paintMist(sc: Scene, tone: RGB, salt: number): Pix {
  const W = sc.wide
  const rows = 7
  const pitch = Math.max(3, Math.round(3.4 * sc.u))
  const p = pix(W, rows * pitch, true)
  const c = pack(tone), pale = pack(mix(tone, [255, 232, 240], 0.4))
  for (let k = 0; k < rows; k++) {
    const edge = Math.abs(k - (rows - 1) / 2) / ((rows - 1) / 2)
    const thick = Math.max(1, Math.round((pitch - 1) * (1 - edge * 0.6)))
    // How thick the mist must be at a place before this row shows there.
    const need = 0.34 + 0.34 * edge
    for (let x = 0; x < W; x++) {
      const v = wave(x + k * 37, W, 5, salt) * 0.62 + wave(x - k * 53, W, 14, salt + 1 + k) * 0.38
      if (v < need) continue
      // A streak's ends are one row thin.
      box(p, x, k * pitch, 1, v - need < 0.035 ? 1 : thick, v - need > 0.16 && edge < 0.4 ? pale : c)
    }
  }
  return p
}

function buildWild(w: number, h: number, top: RGB, horizon: RGB): Backdrop {
  const sc = sceneOf(w, h, top, horizon, 0.34)
  const layers: BackdropLayer[] = []
  const r = sc.ramp
  const u = sc.u
  const forest = hex('#0f3445')
  const sky = pix(w, h)
  paintSky(sky, sc, 2)
  paintGround(sky, sc, forest)
  layers.push(layerOf(sc, sky, 0, 0))
  layers.push(layerOf(sc, paintStars(sc, 0.6, 0.5), 0, 0, true))
  const sun = paintSun(sc, 0.22, false)
  layers.push(layerOf(sc, sun.p, sun.top, 0, true))
  // Thin haze clouds high up.
  const haze = paintClouds(sc, 500, 4, 6 * u, 190 * u, [mix(r(0.5), [96, 84, 160], 0.5), mix(r(0.7), [150, 110, 180], 0.3), mix(r(0.88), [240, 200, 210], 0.2), r(0.97)])
  layers.push(layerOf(sc, haze, Math.round(sc.line * 0.5) - haze.h, 0.05, false, 1.6))
  // Two depths of hills behind the wood, the far one almost the sky's colour, with the mast on it.
  const far = mix(r(0.78), [112, 100, 190], 0.62)
  const a = paintHills(sc, {
    salt: 110, tall: 54, lift: 22, under: 2, cells: 4, trees: 0, crown: 0, firs: 0, dip: true, mast: true,
    paint: { crest: pack(mix(far, r(0.93), 0.28)), body: pack(far), crestRows: Math.round(7 * u), rim: pack(mix(far, [255, 200, 214], 0.55)), shadeRim: 0, haze: pack(mix(far, r(0.9), 0.5)), hazeRows: Math.round(12 * u) },
    leaf: 0,
  })
  layers.push(layerOf(sc, a.p, a.top, 0.04))
  if (a.lights) layers.push({ ...layerOf(sc, a.lights, a.top, 0.04, true), blink: 1.6 })
  const mid = mix(far, forest, 0.52)
  const b = paintHills(sc, {
    salt: 120, tall: 36, lift: 12, under: 12, cells: 6, trees: Math.round(sc.wide / (7 * u)), crown: 4.2, firs: 0.34,
    paint: { crest: pack(mix(mid, [150, 126, 200], 0.24)), body: pack(mid), crestRows: Math.round(6 * u), rim: pack(mix(mid, [232, 150, 200], 0.5)), shadeRim: 0, haze: pack(mix(mid, r(0.86), 0.4)), hazeRows: Math.round(8 * u) },
    leaf: 0,
  })
  layers.push(layerOf(sc, b.p, b.top + Math.round(2 * u), 0.08))
  const mist = paintMist(sc, mix(r(0.86), [196, 176, 226], 0.6), 130)
  layers.push(layerOf(sc, mist, sc.line - Math.round(mist.h * 0.7), 0.11, false, 1.4))
  const wood = paintForest(sc)
  layers.push(layerOf(sc, wood.p, wood.top, 0.15))
  return { horizon: sc.line / h, layers }
}

// --- rooms -------------------------------------------------------------------------

/** Indoors: a very dark glow that falls off toward the corners, and dust that drifts through it. */
function buildVoid(w: number, h: number): Backdrop {
  const u = clamp(Math.min(w, h) / 400, 0.75, 3)
  const glow = pix(w, h)
  const tones = rampOf([[0, hex('#07040f')], [0.5, hex('#0d0720')], [1, hex('#1a0f36')]])
  const m = 7
  const cols: number[] = []
  for (let i = 0; i < m; i++) cols.push(pack(tones(i / (m - 1))))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Rings, wide and low like a lit floor seen from above.
      const d = Math.hypot((x - w / 2) / (w * 0.62), (y - h * 0.48) / (h * 0.58))
      const v = clamp((1 - d) * m, 0, m - 0.001)
      const i = Math.floor(v)
      // Wide bands take a wide seam: sixteen steps instead of three.
      glow.d[y * w + x] = cols[v - i > 0.6 && dither(x >> 1, y >> 1, (v - i - 0.6) / 0.4) ? Math.min(m - 1, i + 1) : i]!
    }
  }
  const sc = { h } as Scene
  const layers: BackdropLayer[] = [layerOf(sc, glow, 0, 0)]
  const dust = (salt: number, tone: string, amount: number, big: number) => {
    const p = pix(w * 2, h, true)
    const c = ink(tone)
    const count = Math.round(((w * 2 * h) / 5200) * amount)
    for (let i = 0; i < count; i++) {
      const x = Math.floor(hash2(i, 1, salt) * p.w), y = Math.floor(hash2(i, 2, salt) * h)
      const s = hash2(i, 3, salt) < big ? Math.max(2, Math.round(2 * u)) : 1
      box(p, x, y, s, s === 1 ? 1 : s - 1, c)
    }
    return p
  }
  layers.push(layerOf(sc, dust(201, '#2a1c52', 1, 0), 0, 0.05, false, 2.5))
  layers.push(layerOf(sc, dust(202, '#3d2a72', 0.45, 0.3), 0, 0.12, false, -4))
  return { horizon: 0.5, layers }
}

// --- the door in -------------------------------------------------------------------

const built = new Map<string, Backdrop>()

/**
 * The backdrop for a look on a screen of w × h hi-res px. `colors` moves the
 * sky: `top` is the colour high up, `horizon` the colour low down (the view's
 * own sky values). The same arguments always give the same picture, and the
 * last few are kept.
 */
export function buildBackdrop(look: BackdropLook, w: number, h: number, colors?: { top?: string; horizon?: string }): Backdrop {
  w = Math.max(32, Math.round(w))
  h = Math.max(32, Math.round(h))
  const top = colors?.top ?? '#1a0f4a'
  const horizon = colors?.horizon ?? '#ff5f9e'
  const key = look === 'void' ? `void:${w}:${h}` : `${look}:${w}:${h}:${top}:${horizon}`
  const had = built.get(key)
  if (had) {
    // Seen again: move it to the fresh end.
    built.delete(key)
    built.set(key, had)
    return had
  }
  const made = look === 'void' ? buildVoid(w, h) : look === 'wild' ? buildWild(w, h, hex(top), hex(horizon)) : buildCoast(w, h, hex(top), hex(horizon))
  built.set(key, made)
  if (built.size > 6) built.delete(built.keys().next().value!)
  return made
}
