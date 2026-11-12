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
 * stands still. A layer with `blink` is shown for the first half of each
 * cycle of that many seconds and hidden for the second. The pictures are
 * composed for an offset near zero: rims on ridges face the sun, which
 * stands right of the middle, where the map's far corner does not hide it.
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
  /** seconds per blink: shown for the first half of each cycle, hidden for the second (a mast's lamp, a lighthouse's flash, a star's twinkle); absent on a layer that is always shown */
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
const unpack = (c: number): RGB => [c & 255, (c >> 8) & 255, (c >> 16) & 255]

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
 * The coast's sky from zenith (0) to the horizon (1): deep indigo, the given
 * top colour, violet, magenta, the given horizon colour, then a thin line of
 * orange and gold.
 */
function skyRamp(top: RGB, horizon: RGB): Ramp {
  return rampOf([
    [0, scale(top, 0.42)],
    [0.3, top],
    [0.55, hueMix(top, horizon, 0.4)],
    [0.76, hueMix(top, horizon, 0.72)],
    [0.91, horizon],
    [0.97, mix(horizon, [255, 150, 70], 0.8)],
    [1, [255, 214, 110]],
  ])
}
/**
 * The Wildwood's sky: the same dusk seen through haze. Darker and greyer
 * all the way down, a dusty rose at the horizon, and only a breath of the
 * gold line.
 */
function wildRamp(top: RGB, horizon: RGB): Ramp {
  const low = mix(horizon, [150, 62, 110], 0.6)
  return rampOf([
    [0, mix(scale(top, 0.42), [13, 10, 36], 0.6)],
    [0.34, mix(top, [42, 23, 72], 0.6)],
    [0.62, mix(hueMix(top, horizon, 0.45), [90, 42, 106], 0.6)],
    [0.9, low],
    [1, mix(low, [255, 170, 110], 0.3)],
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

/** Ordered dither, 2 × 2: the order in which a cell's four pixels turn on. */
const B2 = [0, 2, 3, 1]
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
  /** how far below the horizon the sea's bands run: to the foot of the screen */
  deep: number
}

function sceneOf(w: number, h: number, ramp: Ramp, sunCut: number): Scene {
  // A tall screen shows the map's far edge high up, so its horizon sits higher.
  const line = Math.round(h * clamp(0.42 - 0.08 * (h / w), 0.25, 0.38))
  const r = Math.round(Math.min(w * 0.15, h * 0.14, line * 0.5))
  const cut = Math.round(r * sunCut)
  return {
    w, h, line,
    u: clamp(Math.min(w, h) / 400, 0.75, 3),
    wide: w * 2,
    // The map's far corner stands in the middle of the screen, so the sun stands to the right of it, further on a tall screen.
    sun: { x: Math.round(w * (h / w > 1.3 ? 0.68 : 0.62)), y: line - cut, r, cut },
    ramp,
    bands: 24,
    deep: h - line,
  }
}

/** Where the sun stands as a layer sees it: +1 when it is to the right of x, −1 to the left. */
function sunward(sc: Scene, x: number, wide: number): number {
  const m = ((x % wide) + wide) % wide
  return m < sc.sun.x || m >= sc.sun.x + wide / 2 ? 1 : -1
}

function layerOf(sc: Scene, p: Pix, topRow: number, parallax: number, emissive = false, drift = 0, blink = 0): BackdropLayer {
  const layer: BackdropLayer = { canvas: toCanvas(p), parallax, top: topRow / sc.h, repeatX: p.wrap, emissive, drift }
  if (blink) layer.blink = blink
  return layer
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

/**
 * The sea below the horizon: darker bands that widen toward the viewer, the
 * sky's colours faintly mirrored in the far ones, and further down, where
 * the bands are broad, lines of swell that stand further and further apart.
 */
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
  // The swell: a paler dash and its shadow one row under it, a little to the side. Rows 6, 9, 13, 19… apart.
  const crest: RGB = [70, 150, 196]
  let gap = Math.max(4, Math.round(6 * sc.u))
  let y = sc.line + Math.round(Math.min(sc.deep, sc.h * 0.5) * 0.36)
  for (let k = 0; y < sc.h - 1; k++) {
    const depth = (y - sc.line) / (sc.h - sc.line)
    const len0 = Math.max(3, Math.round((4 + depth * 15) * sc.u))
    let x = Math.floor(hash2(k, 1, 83) * len0 * 3) - len0
    for (let i = 0; x < sc.w; i++) {
      const len = len0 + Math.floor(hash2(k, 10 + i, 83) * len0)
      for (let j = 0; j < len; j++) {
        const a = get(p, x + j, y), b = get(p, x + j + 2, y + 1)
        if (a) put(p, x + j, y, pack(mix(unpack(a), crest, 0.1 + 0.12 * depth)))
        if (b) put(p, x + j + 2, y + 1, pack(scale(unpack(b), 0.8)))
      }
      x += len + Math.round(len0 * (1.4 + hash2(k, 60 + i, 83) * 4.2))
    }
    y += gap
    gap = Math.min(Math.round(30 * sc.u), Math.round(gap * 1.45))
  }
}

/**
 * The ground below the horizon where there is no sea: the wood's nearest
 * colour down to the row where the wood's own layer ends, then a few bands
 * sinking to almost black (the map covers most of it).
 */
function paintGround(p: Pix, sc: Scene, wood: RGB, from: number) {
  const m = 5
  const cols: number[] = []
  const r = rampOf([[0, wood], [0.5, mix(wood, [8, 18, 26], 0.6)], [1, [8, 18, 26]]])
  for (let j = 0; j < m; j++) cols.push(pack(r(j / (m - 1))))
  const span = Math.max(8, Math.min(sc.h - from, Math.round(sc.h * 0.26)))
  const rows = span / m
  for (let y = sc.line; y < sc.h; y++) {
    const v = y < from ? 0 : Math.min(m - 0.001, ((y - from) / span) * m + 0.5)
    for (let x = 0; x < sc.w; x++) p.d[y * p.w + x] = cols[Math.min(m - 1, band(v, clamp(6 / rows, 0.1, 0.5), x, y))]!
  }
}

/**
 * Stars: sparse, far more of them toward the zenith, none in the horizon's
 * glow or near the sun; three in the game's neon. The bigger ones twinkle:
 * their heart stands still and their arms are on one of two layers that
 * blink out of step.
 */
function paintStars(sc: Scene, amount: number, reach: number): { still: Pix; twinkle: [Pix, Pix] } {
  const limit = Math.round(sc.line * reach)
  const p = pix(sc.w, limit + 4)
  const twinkle: [Pix, Pix] = [pix(sc.w, limit + 4), pix(sc.w, limit + 4)]
  const dim = ink('#5a4f96'), mid = ink('#8f86c8'), pale = ink('#cfc6ff'), white = ink('#fff4ff')
  const taken: [number, number][] = []
  const free = (x: number, y: number, gap: number) => {
    if (Math.hypot(x - sc.sun.x, y - sc.sun.y) < sc.sun.r * 2.1) return false
    for (const t of taken) if (Math.abs(t[0] - x) < gap && Math.abs(t[1] - y) < gap) return false
    return true
  }
  const arms = (q: Pix, x: number, y: number, d: number, c: number) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(q, x + dx * d, y + dy * d, c)
  }
  // The three neon ones first, so the rest keep their distance.
  const neon: [number, number, string][] = [[0.17, 0.2, '#ff2fa0'], [0.79, 0.33, '#2ff3ff'], [0.61, 0.1, '#ffd23f']]
  neon.forEach(([fx, fy, c], i) => {
    const x = Math.round(sc.w * fx), y = Math.round(limit * fy)
    if (!free(x, y, 1)) return
    put(p, x, y, white)
    arms(p, x, y, 1, ink(c))
    arms(twinkle[i & 1]!, x, y, 2, pack(scale(hex(c), 0.55)))
    taken.push([x, y])
  })
  const n = Math.round(((sc.w * limit) / 520) * amount)
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(hash2(i, 1, 41) * (sc.w - 4))
    // Thick at the zenith, thinning with the square of the way down.
    const fy = 1 - Math.cbrt(1 - hash2(i, 2, 41))
    const y = 2 + Math.floor(fy * (limit - 2))
    const kind = hash2(i, 3, 41)
    // Only faint ones low down, where the sky is bright.
    const low = fy > 0.55
    if (!free(x, y, kind > 0.9 ? 9 : 5)) continue
    taken.push([x, y])
    const tw = twinkle[i & 1]!
    if (kind < 0.5 || low) put(p, x, y, kind < 0.25 ? dim : mid)
    else if (kind < 0.76) put(p, x, y, pale)
    else if (kind < 0.82) {
      // A small one that comes and goes whole.
      put(p, x, y, dim)
      put(tw, x, y, pale)
    } else if (kind < 0.9) { put(p, x, y, white); put(p, x + 1, y, pale); put(p, x, y + 1, pale); put(p, x + 1, y + 1, mid) }
    else if (kind < 0.97) {
      put(p, x, y, white)
      arms(tw, x, y, 1, mid)
    } else {
      // A sparkle: four arms that fade, the outer half of them twinkling.
      put(p, x, y, white)
      arms(p, x, y, 1, pale)
      arms(tw, x, y, 2, mid)
      arms(tw, x, y, 3, dim)
    }
  }
  return { still: p, twinkle }
}

/**
 * The stuck sun: striped gold to pink, its lower part cut by dark slits that
 * widen, a halo of dithered rings round it, and (over a sea) its broken
 * column of light on the water. `tones` are the disc's stripes from its top
 * down; `veil` dims the halo toward the haze; `glow` is the halo's reach in
 * radii; `slit` is what shows in the slits, and `slitFrom` how far above the
 * centre (in radii) the first one is cut.
 */
function paintSun(sc: Scene, o: { tones: string[]; veil: number; sea: boolean; glow: number; slit: RGB; slitFrom: number }): { p: Pix; top: number } {
  const { x: cx, y: cy, r, cut } = sc.sun
  const veil = o.veil
  const glow = Math.round(r * o.glow)
  const top = cy - r - glow
  const fall = o.sea ? Math.min(sc.deep, Math.round(r * 3.1)) : 0
  const p = pix(sc.w, sc.line - top + fall)
  const mist: RGB = [160, 90, 128]
  const tones = o.tones.map(c => ink(c))
  const dark = pack(o.slit)
  // The slits: every `period` rows from `slitFrom` above the middle, each a row thicker than the last, none thinner than three rows of a 640 screen.
  const period = Math.max(6, Math.round(r / 6.2))
  const thin = Math.max(2, Math.round(r / 22))
  const slit = (yy: number) => {
    const from = yy + Math.round(r * o.slitFrom)
    if (from < 0) return false
    const k = Math.floor(from / period)
    return from % period < Math.min(period - 2, thin + Math.round(k * period * 0.1))
  }
  for (let yy = -r; yy < cut; yy++) {
    const half = Math.floor(Math.sqrt(r * r - yy * yy))
    const cutRow = slit(yy)
    const v = ((yy + r) / (r + cut)) * tones.length
    for (let x = cx - half; x <= cx + half; x++) put(p, x, cy + yy - top, cutRow ? dark : tones[Math.min(tones.length - 1, band(v, Math.min(0.5, (3 * tones.length) / (r + cut)), x, yy))]!)
  }
  // The halo: the sky's own colours a few bands warmer, in four rings, each thinner in ink than the one inside it.
  for (let y = top; y < sc.line; y++) {
    for (let x = cx - r - glow; x <= cx + r + glow; x++) {
      const d = Math.hypot(x - cx, y - cy)
      if (d <= r + 0.5 || d > r + glow) continue
      const g = (d - r) / glow
      const on = g < 0.2 ? B2[(y & 1) * 2 + (x & 1)]! < 3 : g < 0.45 ? ((x + y) & 1) === 0 : g < 0.74 ? B2[(y & 1) * 2 + (x & 1)]! < 1 : (x & 3) === (y & 2) && (y & 1) === 0
      if (!on) continue
      put(p, x, y - top, pack(mix(sc.ramp(Math.min(1, skyRow(sc, y) / sc.bands + 0.2)), mist, veil * 0.6)))
    }
  }
  if (!o.sea) return { p, top }
  // The column on the water: bars that shorten, break up and cool with distance from the horizon; its last stretch is a scatter.
  const light = rampOf([[0, hex('#ffe9a0')], [0.13, hex('#ffc24f')], [0.3, hex('#ff8a3d')], [0.5, hex('#ff5f8a')], [0.72, hex('#b8409a')], [1, hex('#5a3a9a')]])
  const base = sc.line - top
  let y = 1
  for (let k = 0; y < fall; k++) {
    const depth = y / fall
    const thick = depth > 0.38 ? 2 : 1
    const half = Math.round(r * (0.95 - 0.62 * depth) * (0.72 + 0.5 * hash2(k, 1, 77)))
    const off = Math.round((hash2(k, 2, 77) - 0.5) * r * 0.5 * depth)
    const c = pack(light(depth))
    // Each bar is a few pieces with gaps that grow.
    let x = cx + off - half
    for (let i = 0; x < cx + off + half; i++) {
      const piece = 3 + Math.floor(hash2(k, 10 + i, 77) * (half * (0.9 - 0.6 * depth)))
      const end = Math.min(cx + off + half, x + piece)
      if (depth < 0.82 || hash2(k, 70 + i, 77) < 0.4) box(p, x, base + y, end - x, thick, c)
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
  /** a dimmer rim for what faces the sun from further off than three tenths of the screen (absent: the same rim everywhere) */
  rimFar?: number
  /** haze knitted into the lowest rows above the base (0 for none), and how many rows */
  haze: number
  hazeRows: number
  /** the colour of the faces that look away from the sun (0 for none): each peak throws a slanting edge between light and shade */
  flank?: number
  /** the rim only where the ground falls toward the sun, not along flats (a crown's sunward shoulder) */
  slopesOnly?: boolean
}

/**
 * Land as a silhouette: `ht[x]` is how high it stands over `base` (the row
 * of its foot in the picture). Filled down to `bottom`, lit along the crest
 * on the side that faces the sun.
 */
function paintLand(p: Pix, sc: Scene, ht: Int16Array, base: number, bottom: number, c: LandPaint) {
  const W = p.w
  // The lie of the land without its small bumps, for telling a face toward the sun from one away from it.
  const smooth = new Float32Array(c.flank ? W : 0)
  if (c.flank) {
    const reach = Math.max(3, Math.round(5 * sc.u))
    let sum = 0
    for (let k = -reach; k <= reach; k++) sum += ht[((k % W) + W) % W]!
    for (let x = 0; x < W; x++) {
      smooth[x] = sum / (reach * 2 + 1)
      sum += ht[(x + reach + 1) % W]! - ht[(x - reach + W) % W]!
    }
  }
  const at = (x: number) => smooth[((x % W) + W) % W]!
  const look = Math.max(2, Math.round(3 * sc.u))
  for (let x = 0; x < W; x++) {
    const hgt = ht[x]!
    if (hgt <= 0) continue
    const y0 = base - hgt
    const dir = sunward(sc, x, W)
    for (let y = y0; y < bottom; y++) {
      let col = band((y - y0) / c.crestRows, 0.5, x, y) < 1 ? c.crest : c.body
      if (c.flank) {
        // The ground here looks away from the sun when it climbs toward it; the edge leans under the peak as it goes down.
        const xs = x - dir * Math.round((y - y0) * 0.55)
        if (at(xs + dir * look) > at(xs - dir * look) + 0.6) col = c.flank
      }
      if (c.haze && y >= base - c.hazeRows && y < base && B2[(y & 1) * 2 + (x & 1)]! < Math.floor(((y - (base - c.hazeRows) + 1) / c.hazeRows) * 4)) col = c.haze
      p.d[y * W + x] = col
    }
    // The rim: on flats and on slopes that face the sun, and down the step where the slope is steep.
    const toward = ht[(x + dir + W) % W]!
    const lit = c.slopesOnly ? toward < hgt : toward <= hgt
    const fromSun = Math.min(Math.abs(x - sc.sun.x), Math.abs(x - sc.sun.x - W), Math.abs(x - sc.sun.x + W))
    const rim = !lit ? c.shadeRim : c.rimFar && fromSun > sc.w * 0.3 ? c.rimFar : c.rim
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

/**
 * Broken banks of haze between y0 and y1: each five to nine rows of a 640
 * screen, whole in its heart, its top and bottom rows a checker and the rows
 * next to them three quarters full, longest a little under its middle and
 * round at its ends. `pale` is its upper half.
 */
function streaks(p: Pix, sc: Scene, y0: number, y1: number, count: number, tone: number, pale: number, salt: number) {
  for (let i = 0; i < count; i++) {
    const len = Math.round(sc.w * (0.22 + hash2(i, 1, salt) * 0.4))
    const x0 = Math.round(((i + hash2(i, 2, salt) * 0.8) / count) * p.w)
    const th = Math.max(5, Math.round((5 + hash2(i, 3, salt) * 4) * sc.u))
    const y = y0 + Math.floor(hash2(i, 4, salt) * Math.max(1, y1 - y0 - th))
    const widest = (th - 1) * 0.6
    for (let j = 0; j < th; j++) {
      // Each row is shorter than the widest by the square of its distance from it: a long lens, not a wedge.
      const off = (j - widest) / (j < widest ? widest : th - 1 - widest)
      const inset = Math.round(off * off * len * 0.2)
      const rim = Math.min(j, th - 1 - j)
      for (let x = x0 + inset; x < x0 + len - inset; x++) {
        if (rim === 0 && ((x + y + j) & 1) !== 0) continue
        if (rim === 1 && th > 5 && B2[((y + j) & 1) * 2 + (x & 1)]! === 3) continue
        put(p, x, y + j, j < th * 0.45 ? pale : tone)
      }
    }
  }
}

// --- the coast ---------------------------------------------------------------------

/** Far islands: two ranges that rise out of the sea, darker than the sky behind them, and leave gaps of open water. */
function paintIsles(sc: Scene): { p: Pix; top: number } {
  const W = sc.wide
  const tall = Math.round(34 * sc.u)
  const p = pix(W, tall + 4, true)
  const base = tall + 1
  const dusk = sc.ramp(0.91)
  const rim = pack(mix(sc.ramp(0.98), [255, 179, 107], 0.7))
  const ranges: [number, number, number, number][] = [
    // salt, height, how much of it is under water, how far its colour has gone from the horizon's toward the dark
    [5, tall, 0.44, 0.34],
    [9, Math.round(tall * 0.6), 0.45, 0.56],
  ]
  for (const [salt, top, sunk, deepen] of ranges) {
    const body = mix(dusk, [58, 32, 96], deepen)
    const ht = new Int16Array(W)
    for (let x = 0; x < W; x++) {
      // Broad swells that carry sharp peaks and a rough back; the sea is left open under the sun.
      const peak = 1 - Math.abs(2 * wave(x, W, 17, salt + 1, false) - 1)
      const n = wave(x, W, 5, salt) * 0.46 + wave(x, W, 9, salt + 3) * 0.2 + peak * 0.2 + wave(x, W, 41, salt + 2, false) * 0.09 + wave(x, W, 97, salt + 4, false) * 0.05
      const m = ((x % W) + W) % W
      const fromSun = Math.min(Math.abs(m - sc.sun.x), Math.abs(m - sc.sun.x - W))
      const open = clamp((fromSun - sc.sun.r * 1.15) / (sc.sun.r * 1.5), 0, 1)
      ht[x] = Math.max(0, Math.round(((n - sunk) / (1 - sunk)) * top * 1.8 * open))
    }
    paintLand(p, sc, ht, base, base, {
      crest: pack(body), body: pack(body), crestRows: 1,
      rim, shadeRim: 0, flank: pack(mix(body, [40, 22, 84], 0.42)),
      haze: pack(mix(body, sc.ramp(0.95), 0.45)), hazeRows: Math.max(3, Math.round(5 * sc.u)),
    })
    // A dark line where each island meets the water, and its broken shadow under it.
    const dark = pack(scale(body, 0.5))
    for (let x = 0; x < W; x++) {
      if (ht[x]! <= 0) continue
      put(p, x, base, dark)
      if (((x + salt) & 7) < 5) put(p, x, base + 1, dark)
      if (((x + salt * 3) & 7) < 2) put(p, x, base + 2, dark)
    }
  }
  return { p, top: sc.line - base }
}

/**
 * A strip of dusk clouds: each a long flat-bottomed heap of puffs in three
 * tiers, dark on top, violet in the body, lit pink from below with a gold
 * line along its foot where it is thick. The top edge of a big one frays
 * into the sky; a small one (`small`) keeps a clean outline and a whole lit
 * row over its gold foot, so it still reads as a cloud when it crosses the sun.
 */
function paintClouds(sc: Scene, salt: number, count: number, thick: number, long: number, tones: RGB[], small = false): Pix {
  const W = sc.wide
  const H = Math.round(thick * 1.5) + 6
  const p = pix(W, H, true)
  const [top, body, lit, rim] = tones.map(t => pack(t)) as [number, number, number, number]
  for (let i = 0; i < count; i++) {
    const len = Math.round(long * (0.55 + hash2(i, 1, salt) * 0.9))
    const x0 = Math.round(((i + 0.15 + hash2(i, 2, salt) * 0.7) / count) * W)
    const tk = thick * (0.6 + hash2(i, 3, salt) * 0.55)
    const foot = H - 4 - Math.floor(hash2(i, 4, salt) * Math.max(0, H - 6 - tk * 1.1))
    // The puffs: flat ellipses along the foot, the big ones in the middle.
    const n = Math.max(3, Math.round(len / (tk * 1.5)))
    const puffs: [number, number, number][] = []
    for (let j = 0; j < n; j++) {
      const a = (j + 0.5 + (hash2(i * 31 + j, 5, salt) - 0.5) * 0.7) / n
      const env = Math.sin(Math.PI * a) ** 0.6
      const ry = tk * (0.45 + 0.55 * hash2(i * 31 + j, 6, salt)) * (0.3 + 0.7 * env)
      puffs.push([a * len, ry * (1.2 + hash2(i * 31 + j, 7, salt) * 1.1), ry])
    }
    const rise = (k: number) => {
      let v = 0
      for (const [cx, rx, ry] of puffs) {
        const q = (k - cx) / rx
        if (q > -1 && q < 1) v = Math.max(v, ry * Math.sqrt(1 - q * q))
      }
      return v
    }
    const lean = Math.round(tk * 0.5)
    for (let k = 0; k < len; k++) {
      const a = (k + 0.5) / len
      // A thin sheet under the puffs, tapering to nothing at both ends.
      const sheet = tk * 0.2 * clamp(Math.min(a - 0.05, 0.95 - a) * 6, 0, 1)
      const up = Math.round(Math.max(rise(k), sheet))
      const x = x0 + k
      if (up < 1) { if (sheet > 0.25) put(p, x, foot, lit); continue }
      const sag = up > 3 ? Math.round(wave(x, W, Math.round(W / (tk * 6)), salt + i + 90) * 2) : 0
      // Where the tiers part: each follows the puffs, the middle one leaning over to one side.
      const t2 = Math.max(rise(k - lean) * 0.56, up * 0.4)
      const t3 = Math.max(rise(k + lean) * 0.2, small ? 2 : 1)
      const y0 = foot - up
      for (let y = y0; y <= foot + sag; y++) {
        const d = foot - y
        const knit = up > 6 ? (x + y) & 1 : 0
        let c = top
        if (up >= (small ? 3 : 4) && y === foot + sag) c = rim
        else if (d < t3 + knit) c = lit
        else if (d < t2 + knit) c = body
        if (!small && y === y0 && up >= 3 && B2[(y & 1) * 2 + (x & 1)]! === 3) continue
        put(p, x, y, c)
      }
      if (!small && up >= 6 && B2[((y0 - 1) & 1) * 2 + (x & 1)]! < 1) put(p, x, y0 - 1, top)
    }
  }
  return p
}

/**
 * Long thin bars of cloud low over the glow, the kind that cross the sun:
 * each a few rows, dark on top, lit underneath, the lowest row the longest.
 */
function paintBars(sc: Scene, salt: number, count: number, thick: number, tones: RGB[]): Pix {
  const W = sc.wide
  const u = sc.u
  const H = Math.round(20 * u)
  const p = pix(W, H, true)
  const [dark, body, lit] = tones.map(t => pack(t)) as [number, number, number]
  const bar = (x0: number, y0: number, len: number, th: number, id: number) => {
    // Each row above the lowest is a few px shorter at both ends.
    const l = (2 + hash2(id, 5, salt) * 4) * u, r = (2 + hash2(id, 6, salt) * 4) * u
    for (let j = 0; j < th; j++) {
      const up = th - 1 - j
      box(p, x0 + Math.round(up * l), y0 + j, len - Math.round(up * l) - Math.round(up * r), 1, j === th - 1 ? lit : j === 0 ? dark : body)
    }
  }
  for (let i = 0; i < count; i++) {
    const len = Math.round(sc.w * (0.14 + hash2(i, 1, salt) * 0.2))
    const x0 = Math.round(((i + 0.1 + hash2(i, 2, salt) * 0.6) / count) * W)
    const th = Math.max(3, Math.round((thick + Math.floor(hash2(i, 3, salt) * 3)) * u))
    const y0 = 1 + Math.floor(hash2(i, 4, salt) * (H - th - Math.round(9 * u)))
    bar(x0, y0, len, th, i)
    // Often a shorter one hangs under one end of it.
    if (hash2(i, 7, salt) < 0.7) bar(x0 + Math.round(len * (hash2(i, 8, salt) < 0.5 ? -0.2 : 0.7)), y0 + th + Math.max(1, Math.round(2 * u)), Math.round(len * 0.5), Math.max(3, th - 1), i + 20)
  }
  return p
}

/**
 * The near coast: a dark headland whose tip carries a lighthouse and a few
 * houses, a low skerry with a radio mast, and the line where they meet the
 * sea. Returns the land and, the same size, what is lit on it, and what
 * comes and goes with the lighthouse's flash.
 */
function paintCoast(sc: Scene): { land: Pix; lights: Pix; flash: Pix; top: number } {
  const W = sc.wide
  const u = sc.u
  const n = (v: number) => Math.max(1, Math.round(v * u))
  const tall = n(58)
  const over = n(40)
  const under = n(16)
  const base = tall + over
  const land = pix(W, base + under, true)
  const lights = pix(W, base + under, true)
  const flash = pix(W, base + under, true)
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
  // The waterline: the shore's own dusk colour, broken, with a rose glint here and there on the stretch nearest the sun; under it the land's dark mirror woven into the sea.
  const shore = ink('#4a3484'), glint = ink('#ff9fb0'), dark = pack(scale(body, 0.8))
  for (let x = 0; x < W; x++) {
    if (ht[x]! <= 0) continue
    const fromSun = Math.min(Math.abs(x - sc.sun.x), Math.abs(x - sc.sun.x - W))
    put(land, x, base, fromSun < sc.w * 0.3 && x % 3 === 0 ? glint : ((x * 7) & 15) < 11 ? shore : dark)
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
  // Its lamp room glows all the time; the lamp itself and its beams come with the flash.
  box(lights, lx - Math.floor(tw / 2) + 1, gy - room + 1, tw - 2, room - 2, amber)
  box(flash, lx - Math.floor(tw / 2) + 1, gy - room + 1, tw - 2, room - 2, gold)
  box(flash, lx - Math.floor(tw / 2) + 2, gy - room + 1, Math.max(1, tw - 4), Math.max(1, room - 3), white)
  const ly = gy - room + Math.floor(room / 2)
  const core = ink('#fff1b0'), edge = ink('#ff8a3d')
  for (const [dir, reach, rise] of [[1, Math.round(sc.w * 0.14), -0.05], [-1, Math.round(sc.w * 0.06), 0.04]] as const) {
    // A cone of light that thins out: whole by the lamp, then a checker of gold, then a scatter of orange, with one bright row down its middle and a rounded end.
    const wide = Math.max(1, Math.floor(reach * 0.085))
    for (let k = tw; k < reach; k++) {
      const far = k / reach
      const spread = Math.floor(k * 0.085)
      const mid = ly + Math.round(k * rise)
      const x = lx + dir * k
      for (let dy = -spread; dy <= spread; dy++) {
        const a = Math.abs(dy)
        if (far > 1 - 0.3 * (a / wide) ** 2) continue
        const y = mid + dy
        if (dy === 0 && far < 0.6) put(flash, x, y, core)
        else if (far < 0.22) put(flash, x, y, a <= spread * 0.5 ? core : gold)
        else if (far < 0.62) { if (((x + y) & 1) === 0) put(flash, x, y, a <= spread * 0.5 ? gold : edge) }
        else if ((x & 1) === 0 && (y & 1) === 0) put(flash, x, y, dy === 0 ? gold : edge)
      }
    }
  }
  // The lamp's light on the water under it.
  for (let d = 2; d < under; d += 2 + Math.floor(d / 4)) box(flash, lx - 2 + ((d * 3) % 3), base + d, 4 - Math.floor(d / 6), 1, amber)

  // The radio mast on the skerry: a thin lattice with a red lamp on top.
  const mx = Math.round(1.1 * sc.w)
  const tip = paintMast(land, mx, base - ht[mx % W]! + 1, n(36), n(5), n(3), wallLit, wall)
  box(lights, mx - 1, tip - 2, 2, 2, ink('#ff3b5c'))
  put(lights, mx, tip + n(18), ink('#ff3b5c'))
  return { land, lights, flash, top: sc.line - base }
}

/**
 * Short glints lying on the sea, row by row, longer and fewer toward the
 * viewer; in the deep water near the foot of the screen, where they have
 * thinned out, a few small sparks in the game's neon.
 */
function paintGlints(sc: Scene): { p: Pix; top: number } {
  const W = sc.wide
  const H = Math.max(8, sc.deep - 4)
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
  // The sparks: two px each, one every seventy px or so along rows a good way apart, cyan or pink.
  const cyan = ink('#3fd0ff'), pink = ink('#ff6fb0')
  const step = Math.max(14, Math.round(20 * sc.u))
  for (let k = 0, sy = Math.round(H * 0.45); sy < H - 1; k++, sy += step + Math.floor(hash2(k, 3, 93) * step)) {
    let x = Math.floor(hash2(k, 1, 93) * 70 * sc.u)
    for (let i = 0; x < W - 2; i++) {
      box(p, x, sy + (hash2(k, 200 + i, 93) < 0.5 ? 0 : 3), 2, 1, hash2(k, 10 + i, 93) < 0.5 ? cyan : pink)
      x += Math.round((50 + hash2(k, 600 + i, 93) * 45) * sc.u)
    }
  }
  return { p, top: sc.line + 1 }
}

function buildCoast(w: number, h: number, top: RGB, horizon: RGB): Backdrop {
  const sc = sceneOf(w, h, skyRamp(top, horizon), 0.38)
  const layers: BackdropLayer[] = []
  const r = sc.ramp
  const u = sc.u
  const sky = pix(w, h)
  paintSky(sky, sc, 3.2)
  paintSea(sky, sc)
  layers.push(layerOf(sc, sky, 0, 0))
  const stars = paintStars(sc, 1, 0.6)
  layers.push(layerOf(sc, stars.still, 0, 0, true))
  layers.push(layerOf(sc, stars.twinkle[0], 0, 0, true, 0, 2.3))
  layers.push(layerOf(sc, stars.twinkle[1], 0, 0, true, 0, 3.7))
  const sun = paintSun(sc, { tones: ['#fff1b0', '#ffd23f', '#ffb13f', '#ff8a3d', '#ff5f7a', '#ff2fa0'], veil: 0, sea: true, glow: 0.6, slit: mix(r(0.66), [52, 14, 92], 0.6), slitFrom: 0.14 })
  layers.push(layerOf(sc, sun.p, sun.top, 0, true))
  const isles = paintIsles(sc)
  layers.push(layerOf(sc, isles.p, isles.top, 0.04))
  // Three strips of cloud. Lowest, thin bars that cross the sun's upper third; highest, the big ones, which move fastest; behind those, small far heaps whose feet stay just clear of the sun's top, so no heap ever bites into the disc.
  const bars = paintBars(sc, 300, 5, 4, [mix(r(0.5), [74, 31, 110], 0.6), mix(r(0.68), [122, 47, 143], 0.6), mix(r(0.97), [255, 150, 100], 0.6)])
  layers.push(layerOf(sc, bars, Math.round(sc.sun.y - sc.sun.r * 0.35 - bars.h * 0.35), 0.06, false, 0.8))
  const heap: RGB[] = [mix(r(0.3), [42, 26, 90], 0.6), mix(r(0.6), [106, 42, 138], 0.55), mix(r(0.91), [255, 95, 158], 0.5), mix(r(0.98), [255, 179, 107], 0.6)]
  const far = paintClouds(sc, 350, 6, 8 * u, 84 * u, [mix(heap[0]!, heap[1]!, 0.5), mix(heap[1]!, heap[2]!, 0.35), heap[2]!, heap[3]!], true)
  layers.push(layerOf(sc, far, sc.sun.y - sc.sun.r - Math.round(sc.sun.r * 0.08) - (far.h - 2), 0.05, false, 0.8))
  const high = paintClouds(sc, 400, 4, 17 * u, 210 * u, heap)
  layers.push(layerOf(sc, high, Math.round(sc.line * 0.5) - high.h, 0.08, false, 1.6))
  const coast = paintCoast(sc)
  layers.push(layerOf(sc, coast.land, coast.top, 0.15))
  layers.push(layerOf(sc, coast.lights, coast.top, 0.15, true))
  layers.push(layerOf(sc, coast.flash, coast.top, 0.15, true, 0, 3.2))
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
  /** how far it sinks into a valley where the sun stands: 0 not at all, 1 down to its foot */
  dip: number
  /** how much of its shape is sharp peaks instead of swells (0 to 1) */
  peaks?: number
  /** carries the radio mast, in this colour */
  mast?: number
}): { p: Pix; lights: Pix | null; top: number } {
  const W = sc.wide
  const n = (v: number) => Math.max(1, Math.round(v * sc.u))
  const tall = n(o.tall)
  const over = n(o.crown * 3.4 + (o.mast ? 44 : 0)) + 2
  const base = tall + over
  const p = pix(W, base + n(o.under), true)
  const ht = new Int16Array(W)
  for (let x = 0; x < W; x++) {
    // Long swells, and shorter and shorter ones on their backs, the shortest straight-sided like rock.
    const swell = wave(x, W, o.cells, o.salt) * 0.5 + wave(x, W, o.cells * 2.5, o.salt + 1) * 0.25 + wave(x, W, o.cells * 6, o.salt + 2) * 0.13 + wave(x, W, o.cells * 15, o.salt + 3, false) * 0.08 + wave(x, W, o.cells * 34, o.salt + 4, false) * 0.04
    const sharp = 1 - Math.abs(2 * wave(x, W, o.cells * 3.5, o.salt + 5, false) - 1)
    const v = o.peaks ? swell * (1 - o.peaks) + sharp * swell * 1.6 * o.peaks : swell
    const fromSun = Math.min(Math.abs(x - sc.sun.x), Math.abs(x - sc.sun.x - W))
    const open = 1 - o.dip * (1 - clamp((fromSun - sc.sun.r * 0.8) / (sc.sun.r * 1.8), 0, 1))
    ht[x] = Math.round(n(o.lift) * (0.55 + 0.45 * open) + v * (tall - n(o.lift)) * open * open * (3 - 2 * open))
  }
  const ground = Int16Array.from(ht)
  if (o.trees) plant(sc, ht, ground, o.trees, o.crown, o.firs, o.salt)
  paintLand(p, sc, ht, base, p.h, o.paint)
  let lights: Pix | null = null
  if (o.mast) {
    // The radio mast on the highest hill left of the sun, and its lamp on a layer of its own so it can blink.
    let mx = Math.round(sc.w * 0.1)
    for (let x = mx; x < Math.round(sc.w * 0.42); x++) if (ground[x]! > ground[mx]!) mx = x
    const tip = paintMast(p, mx, base - ground[mx]! + 1, n(34), n(5), n(3), o.mast, o.mast)
    lights = pix(W, p.h, true)
    box(lights, mx - 1, tip - 2, 3, 2, ink('#ff3b5c'))
    put(lights, mx, tip - 3, ink('#ff9aa8'))
  }
  return { p, lights, top: sc.line - base }
}

/** Stands trees evenly along a profile and returns the round ones (x, foot, radius) for their highlights. */
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

/**
 * Stands a thicket along a profile: crowns of very different sizes, crowded
 * here and parted there, so no row of them marches. Returns the round ones.
 */
function thicket(sc: Scene, ht: Int16Array, ground: Int16Array, crown: number, firs: number, salt: number): [number, number, number][] {
  const W = ht.length
  const crowns: [number, number, number][] = []
  let x = Math.floor(hash2(0, 9, salt) * crown * sc.u)
  for (let i = 0; x < W; i++) {
    const r = Math.max(2, Math.round(crown * sc.u * (0.6 + hash2(i, 2, salt) * 0.8)))
    const foot = ground[x]! - Math.round(r * 0.4)
    if (hash2(i, 3, salt) < firs) fir(ht, x, foot, Math.max(2, Math.round(r * 0.75)), Math.round(r * (2.3 + hash2(i, 6, salt) * 1.3)))
    else { canopy(ht, x, foot, r); crowns.push([x, foot, r]) }
    // Now and then a gap.
    x += Math.max(2, Math.round(r * (1.05 + hash2(i, 4, salt) * 0.95) + (hash2(i, 5, salt) < 0.16 ? r * 2.2 : 0)))
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
 * The wood's near edge, under the nearest hill: a few rows of treetops, each
 * bigger, lower and darker than the one behind it. Only its first stretch
 * is drawn tree by tree; its last rows are one colour, `floor`, which the
 * ground under this layer carries on down the screen.
 */
function paintForest(sc: Scene, sky: RGB, floor: RGB): { p: Pix; top: number } {
  const W = sc.wide
  const u = sc.u
  const over = Math.round(34 * u)
  const deep = Math.round(sc.h * 0.12 + 12 * u)
  const p = pix(W, over + deep, true)
  // A row every dozen px or so: more of them on a tall screen, where the stretch is deeper.
  const rows = clamp(Math.round(deep / (13 * u)), 4, 7)
  const first = over + Math.round(6 * u)
  const feet: number[] = []
  for (let k = 0; k <= rows; k++) feet.push(first + Math.round((deep - 14 * u) * Math.pow(k / rows, 1.25)))
  for (let k = 0; k < rows; k++) {
    const t = k / (rows - 1)
    const crown = 6.5 * (1 + 1.8 * t) * (0.85 + 0.3 * hash2(k, 1, 150))
    const ht = new Int16Array(W)
    const swell = Math.round(10 * u * (1 - t * 0.4))
    for (let x = 0; x < W; x++) ht[x] = 1 + Math.round((wave(x, W, 5 + k * 2, 140 + k * 7) * 0.7 + wave(x, W, 17 + k * 5, 141 + k * 7) * 0.3) * swell)
    const ground = Int16Array.from(ht)
    const crowns = thicket(sc, ht, ground, crown, t < 0.4 ? 0.26 : 0.12, 150 + k * 13)
    // The far rows take the sky's colour through the haze; the nearest is the floor's own.
    const body = k === rows - 1 ? floor : mix(mix([18, 58, 72], floor, Math.pow(t, 0.8)), sky, 0.26 * (1 - t) ** 1.5)
    const foot = feet[k]!
    paintLand(p, sc, ht, foot, k === rows - 1 ? p.h : Math.min(p.h, feet[k + 1]!), {
      crest: pack(mix(body, [52, 140, 130], 0.3 * (1 - t * 0.6))), body: pack(body), crestRows: Math.max(3, Math.round(crown * u * 0.45)),
      // Only the first rows stand against the sky and take the sun's pink, and only on the side that faces it.
      rim: t < 0.4 ? pack(mix(hex('#c04a8a'), body, 0.3 + t)) : 0, shadeRim: 0, slopesOnly: true,
      haze: 0, hazeRows: 0,
    })
    leaves(p, sc, crowns, foot, pack(mix(body, [95, 214, 184], 0.3 * (1 - t * 0.7))))
  }
  // The last rows are the floor's colour and nothing else, so the ground below joins on without an edge.
  box(p, 0, p.h - Math.max(2, Math.round(3 * u)), W, Math.max(2, Math.round(3 * u)), pack(floor))
  return { p, top: sc.line - over }
}

/** A low band of mist over the wood's edge: broken banks a little lighter than the trees behind them, none of them white. */
function paintMist(sc: Scene, tone: RGB, pale: RGB, salt: number): Pix {
  const p = pix(sc.wide, Math.round(30 * sc.u), true)
  streaks(p, sc, 0, p.h, 9, pack(tone), pack(pale), salt)
  return p
}

function buildWild(w: number, h: number, top: RGB, horizon: RGB): Backdrop {
  const sc = sceneOf(w, h, wildRamp(top, horizon), 0.24)
  const layers: BackdropLayer[] = []
  const r = sc.ramp
  const u = sc.u
  const low = r(0.9)
  const floor: RGB = [11, 33, 44]
  const wood = paintForest(sc, low, floor)
  const sky = pix(w, h)
  paintSky(sky, sc, 1.4)
  paintGround(sky, sc, floor, wood.top + wood.p.h)
  layers.push(layerOf(sc, sky, 0, 0))
  const stars = paintStars(sc, 0.45, 0.5)
  layers.push(layerOf(sc, stars.still, 0, 0, true))
  layers.push(layerOf(sc, stars.twinkle[0], 0, 0, true, 0, 2.3))
  layers.push(layerOf(sc, stars.twinkle[1], 0, 0, true, 0, 3.7))
  // The same sun, lower, behind haze: warm and whole in colour (the mood is the darker sky's), striped from well above its middle so the slits show over the hills.
  const sun = paintSun(sc, { tones: ['#f8bc6a', '#f2a35a', '#ee8c58', '#e9785a', '#d8606c', '#c8507a'], veil: 0.45, sea: false, glow: 0.4, slit: mix(r(0.7), [48, 20, 78], 0.7), slitFrom: 0.5 })
  layers.push(layerOf(sc, sun.p, sun.top, 0, true))
  // Bars of haze high up, a few rows each.
  const bars = paintBars(sc, 500, 4, 5, [mix(r(0.4), [40, 26, 76], 0.5), mix(r(0.6), [84, 44, 110], 0.5), mix(r(0.8), [170, 90, 140], 0.4)])
  layers.push(layerOf(sc, bars, Math.round(sc.line * 0.56) - bars.h, 0.05, false, 0.8))
  // Three depths of hills behind the wood, three values: each darker and cooler than the one behind it, and the furthest only a little darker than the sky at its crest. The mast stands on the second.
  const crestSky = r(0.56)
  const farA = mix([44, 24, 84], crestSky, 0.58)
  const a = paintHills(sc, {
    salt: 110, tall: 62, lift: 22, under: 2, cells: 4, trees: 0, crown: 0, firs: 0, dip: 1, peaks: 0.6,
    paint: { crest: pack(farA), body: pack(farA), crestRows: 1, rim: pack(mix(farA, [240, 150, 190], 0.45)), shadeRim: 0, flank: pack(mix(farA, [36, 20, 72], 0.3)), haze: pack(mix(farA, low, 0.5)), hazeRows: Math.round(16 * u) },
  })
  layers.push(layerOf(sc, a.p, a.top, 0.03))
  const farB: RGB = mix([62, 30, 92], crestSky, 0.2)
  const b = paintHills(sc, {
    salt: 190, tall: 60, lift: 14, under: 2, cells: 5, trees: 0, crown: 0, firs: 0, dip: 0.9, peaks: 0.3, mast: pack(mix(farB, [16, 10, 36], 0.7)),
    paint: { crest: pack(mix(farB, farA, 0.4)), body: pack(farB), crestRows: Math.round(5 * u), rim: ink('#e07ab0'), rimFar: pack(mix(farB, [224, 122, 176], 0.32)), shadeRim: 0, haze: pack(mix(farB, farA, 0.7)), hazeRows: Math.round(9 * u) },
  })
  layers.push(layerOf(sc, b.p, b.top, 0.05))
  if (b.lights) layers.push(layerOf(sc, b.lights, b.top, 0.05, true, 0, 1.6))
  const mid: RGB = [40, 27, 64]
  const c = paintHills(sc, {
    salt: 120, tall: 34, lift: 12, under: 12, cells: 6, trees: Math.round(sc.wide / (7 * u)), crown: 4.2, firs: 0.4, dip: 0.7,
    paint: { crest: pack(mix(mid, farB, 0.35)), body: pack(mid), crestRows: Math.round(6 * u), rim: pack(mix(mid, [232, 122, 176], 0.5)), shadeRim: 0, slopesOnly: true, haze: pack(mix(mid, [34, 52, 78], 0.5)), hazeRows: Math.round(8 * u) },
  })
  layers.push(layerOf(sc, c.p, c.top + Math.round(2 * u), 0.08))
  // Mist where the hills meet the wood: slate, a step lighter than the firs and the far treetops it lies on.
  const mist = paintMist(sc, [58, 62, 98], [72, 74, 114], 130)
  layers.push(layerOf(sc, mist, sc.line - Math.round(mist.h * 0.9), 0.11, false, 1.2))
  layers.push(layerOf(sc, wood.p, wood.top, 0.15))
  return { horizon: sc.line / h, layers }
}

// --- rooms -------------------------------------------------------------------------

/**
 * Indoors: very dark level bands across the screen, lightest a little above
 * the middle (they sink by less than half a band toward the sides), and dust
 * that drifts through them: fine and slow over the upper part of the screen,
 * coarser and the other way over the lower part, both where the room is.
 */
function buildVoid(w: number, h: number): Backdrop {
  const u = clamp(Math.min(w, h) / 400, 0.75, 3)
  const glow = pix(w, h)
  const tones = rampOf([[0, hex('#07040f')], [0.5, hex('#0d0720')], [1, hex('#1a0f36')]])
  const m = 8
  const cols: number[] = []
  for (let i = 0; i < m; i++) cols.push(pack(tones(i / (m - 1))))
  // A band is this many rows; its seam about six of them.
  const rows = (h * 0.55) / m
  const seam = clamp(6 / rows, 0.08, 0.5)
  for (let y = 0; y < h; y++) {
    const dy = (y - h * 0.45) / (h * 0.55)
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w * 5)
      const v = clamp((1 - Math.hypot(dy, dx)) * m, 0, m - 0.001)
      glow.d[y * w + x] = cols[Math.min(m - 1, band(v, seam, x, y))]!
    }
  }
  const sc = { h } as Scene
  const layers: BackdropLayer[] = [layerOf(sc, glow, 0, 0)]
  // Each dust layer covers six tenths of the height, so the two together hold a good deal less than two whole screens.
  const tall = Math.ceil(h * 0.6)
  const dust = (salt: number, tone: string, amount: number, big: number) => {
    const p = pix(w * 2, tall, true)
    const c = ink(tone)
    const count = Math.round(((w * 2 * tall) / 5200) * amount)
    for (let i = 0; i < count; i++) {
      const x = Math.floor(hash2(i, 1, salt) * p.w), y = Math.floor(hash2(i, 2, salt) * tall)
      const s = hash2(i, 3, salt) < big ? Math.max(2, Math.round(2 * u)) : 1
      box(p, x, y, s, s === 1 ? 1 : s - 1, c)
    }
    return p
  }
  layers.push(layerOf(sc, dust(201, '#2a1c52', 1, 0), 0, 0.05, false, 1.2))
  layers.push(layerOf(sc, dust(202, '#3d2a72', 0.45, 0.3), h - tall, 0.12, false, -2))
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
