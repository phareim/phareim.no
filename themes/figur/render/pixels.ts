/**
 * Lag Din Figur's drawing kit: a PixelBuffer (logical pixels, '#rrggbb'
 * or null) and the pure helpers the four styles paint with — rects,
 * ellipses, lines, texture mapping (nearest-neighbour, or a majority
 * vote when shrinking so one-row brims and stripes survive), EPX
 * smoothing for big upscales, outlines, top light, clipping, and
 * writeRGBA for the canvas. No DOM.
 */
import type { Hex, PixelBuffer, Texture } from '../types'
import { shade, tint } from '../core/color'

export type Px = Hex | null
export interface Rect { x: number; y: number; w: number; h: number }
/** A painted shape: row `y + i` covers columns spans[i][0]..spans[i][1] (inclusive), or nothing. */
export interface SpanShape { y: number; spans: Array<[number, number] | null> }

// ---------------------------------------------------------------- buffers

export function makeBuffer(w: number, h: number, fill: Px = null): PixelBuffer {
  return { w, h, px: new Array<Px>(w * h).fill(fill) }
}

export const inside = (b: PixelBuffer, x: number, y: number): boolean => x >= 0 && y >= 0 && x < b.w && y < b.h

export function get(b: PixelBuffer | Texture, x: number, y: number): Px {
  x = Math.floor(x); y = Math.floor(y)
  return x >= 0 && y >= 0 && x < b.w && y < b.h ? b.px[y * b.w + x]! : null
}

/** Set one pixel (null erases); outside the buffer does nothing. */
export function set(b: PixelBuffer, x: number, y: number, c: Px): void {
  x = Math.floor(x); y = Math.floor(y)
  if (x >= 0 && y >= 0 && x < b.w && y < b.h) b.px[y * b.w + x] = c
}

/** Recolour a painted pixel with `f(c)`; empty pixels stay empty. */
export function tweak(b: PixelBuffer, x: number, y: number, f: (c: Hex) => Hex): void {
  const c = get(b, x, y)
  if (c) set(b, x, y, f(c))
}

export function fillRect(b: PixelBuffer, x: number, y: number, w: number, h: number, c: Px): void {
  const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y))
  const x1 = Math.min(b.w, Math.floor(x + w)), y1 = Math.min(b.h, Math.floor(y + h))
  for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) b.px[yy * b.w + xx] = c
}

/** Pixels whose centres fall inside the ellipse at (cx, cy) with radii rx, ry (centres may be half-pixels). */
export function fillEllipse(b: PixelBuffer, cx: number, cy: number, rx: number, ry: number, c: Px): void {
  const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry)
  for (let y = y0; y <= y1; y++) {
    const dy = (y + 0.5 - cy) / ry
    if (dy * dy > 1) continue
    const half = rx * Math.sqrt(1 - dy * dy)
    const a = Math.ceil(cx - half - 0.5), z = Math.floor(cx + half - 0.5)
    for (let x = a; x <= z; x++) set(b, x, y, c)
  }
}

export const fillCircle = (b: PixelBuffer, cx: number, cy: number, r: number, c: Px): void => fillEllipse(b, cx, cy, r, r, c)

/** A rectangle with its corners rounded by radius r. */
export function fillRoundRect(b: PixelBuffer, x: number, y: number, w: number, h: number, r: number, c: Px): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const dx = xx < r ? r - xx - 0.5 : xx >= w - r ? xx - (w - r) + 0.5 : 0
      const dy = yy < r ? r - yy - 0.5 : yy >= h - r ? yy - (h - r) + 0.5 : 0
      if (dx * dx + dy * dy <= r * r + 0.3) set(b, x + xx, y + yy, c)
    }
  }
}

/** Bresenham line. */
export function line(b: PixelBuffer, x0: number, y0: number, x1: number, y1: number, c: Px): void {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    set(b, x0, y0, c)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x0 += sx }
    if (e2 <= dx) { err += dx; y0 += sy }
  }
}

/** Paint the rows of a shape. */
export function fillShape(b: PixelBuffer, s: SpanShape, c: Px): void {
  s.spans.forEach((sp, i) => { if (sp) for (let x = sp[0]; x <= sp[1]; x++) set(b, x, s.y + i, c) })
}

/** A trapezoid centred on cx: `wTop` wide at row y, `wBottom` at row y + h - 1. */
export function trapezoid(cx: number, y: number, h: number, wTop: number, wBottom: number): SpanShape {
  const spans: Array<[number, number]> = []
  for (let i = 0; i < h; i++) {
    const w = Math.round(wTop + (wBottom - wTop) * (h === 1 ? 0 : i / (h - 1)))
    const a = Math.round(cx - w / 2)
    spans.push([a, a + w - 1])
  }
  return { y, spans }
}

/** The rows of whatever is painted in `b` (from its first to its last painted row). */
export function shapeOf(b: PixelBuffer, rect?: Rect): SpanShape {
  const r = rect ?? { x: 0, y: 0, w: b.w, h: b.h }
  const spans: Array<[number, number] | null> = []
  let first = -1
  for (let y = r.y; y < r.y + r.h; y++) {
    let a = -1, z = -1
    for (let x = r.x; x < r.x + r.w; x++) if (get(b, x, y)) { if (a < 0) a = x; z = x }
    if (a >= 0 && first < 0) first = y
    if (first >= 0) spans.push(a >= 0 ? [a, z] : null)
  }
  while (spans.length && !spans[spans.length - 1]) spans.pop()
  return { y: first < 0 ? r.y : first, spans }
}

/** Copy the painted pixels of `src` onto `dst` with src's (0,0) at (ox, oy). */
export function blit(dst: PixelBuffer, src: PixelBuffer | Texture, ox: number, oy: number, flipX = false): void {
  ox = Math.round(ox); oy = Math.round(oy)
  for (let y = 0; y < src.h; y++) {
    const dy = oy + y
    if (dy < 0 || dy >= dst.h) continue
    for (let x = 0; x < src.w; x++) {
      const c = src.px[y * src.w + (flipX ? src.w - 1 - x : x)]
      if (!c) continue
      const dx = ox + x
      if (dx >= 0 && dx < dst.w) dst.px[dy * dst.w + dx] = c
    }
  }
}

/** Empty every pixel of `b` where `mask` (same size) is empty. */
export function clipTo(b: PixelBuffer, mask: PixelBuffer): void {
  for (let i = 0; i < b.px.length; i++) if (!mask.px[i]) b.px[i] = null
}

// ---------------------------------------------------------------- textures

/** A region of a texture as its own texture. */
export function crop(tex: Texture, r: Rect): Texture {
  const px: Px[] = []
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) px.push(get(tex, x, y))
  return { w: r.w, h: r.h, px }
}

export function flipTexture(tex: Texture): Texture {
  const px: Px[] = []
  for (let y = 0; y < tex.h; y++) for (let x = tex.w - 1; x >= 0; x--) px.push(tex.px[y * tex.w + x]!)
  return { w: tex.w, h: tex.h, px }
}

/**
 * Region `src` of `tex` resized to dw × dh. Growing is nearest-neighbour;
 * shrinking lets the source pixels under each target pixel vote (empty
 * counts as a colour); a tie goes to the colour rarer in the region, then
 * to the lower-right one, so an eye, a brim or a hem is not lost.
 */
export function resample(tex: Texture, src: Rect, dw: number, dh: number): Texture {
  const px: Px[] = new Array<Px>(dw * dh).fill(null)
  const range = (a: number, len: number, d: number, n: number): number[] => {
    const lo = a + (d * len) / n, hi = a + ((d + 1) * len) / n
    const out: number[] = []
    for (let i = Math.floor(lo); i < Math.ceil(hi); i++) if (i + 0.5 >= lo && i + 0.5 < hi) out.push(i)
    if (!out.length) out.push(Math.min(a + len - 1, Math.floor((lo + hi) / 2)))
    return out
  }
  const xs = Array.from({ length: dw }, (_, d) => range(src.x, src.w, d, dw))
  const ys = Array.from({ length: dh }, (_, d) => range(src.y, src.h, d, dh))
  // How common each colour is in the region: ties go to the rarer one (an eye, a button), then to the lower right.
  const freq = new Map<Px, number>()
  for (let y = src.y; y < src.y + src.h; y++) for (let x = src.x; x < src.x + src.w; x++) {
    const c = get(tex, x, y)
    freq.set(c, (freq.get(c) ?? 0) + 1)
  }
  const counts = new Map<Px, number>()
  for (let dy = 0; dy < dh; dy++) {
    for (let dx = 0; dx < dw; dx++) {
      counts.clear()
      let best: Px = null, bestN = 0
      for (const sy of ys[dy]!) {
        for (const sx of xs[dx]!) {
          const c = get(tex, sx, sy)
          const n = (counts.get(c) ?? 0) + 1
          counts.set(c, n)
          if (n > bestN || (n === bestN && (freq.get(c) ?? 0) <= (freq.get(best) ?? 0))) { bestN = n; best = c }
        }
      }
      px[dy * dw + dx] = best
    }
  }
  return { w: dw, h: dh, px }
}

/** EPX / Scale2x: twice the size, diagonals smoothed instead of stair-stepped. */
export function scale2x(tex: Texture): Texture {
  const w = tex.w * 2, h = tex.h * 2
  const px: Px[] = new Array<Px>(w * h).fill(null)
  for (let y = 0; y < tex.h; y++) {
    for (let x = 0; x < tex.w; x++) {
      const E = get(tex, x, y), B = get(tex, x, y - 1), D = get(tex, x - 1, y), F = get(tex, x + 1, y), H = get(tex, x, y + 1)
      let e0 = E, e1 = E, e2 = E, e3 = E
      if (B !== H && D !== F) {
        if (D === B) e0 = D
        if (B === F) e1 = F
        if (D === H) e2 = D
        if (H === F) e3 = F
      }
      const i = 2 * y * w + 2 * x
      px[i] = e0; px[i + 1] = e1; px[i + w] = e2; px[i + w + 1] = e3
    }
  }
  return { w, h, px }
}

/** `tex` at dw × dh; big upscales go through Scale2x first so edges come out smooth, not blocky. */
export function smoothResize(tex: Texture, dw: number, dh: number): Texture {
  let t = tex
  while (t.w * 1.5 < dw && t.h * 1.5 < dh && t.w < 256) t = scale2x(t)
  return resample(t, { x: 0, y: 0, w: t.w, h: t.h }, dw, dh)
}

export interface MapOpts {
  /** Mirror the source left–right. */
  flipX?: boolean
  /** What empty source pixels paint (default: nothing, whatever is under shows). */
  under?: Px
  /** Per source row (relative to src.y), the painted columns (absolute): each target row stretches its source row's span. */
  srcSpans?: Array<[number, number] | null>
  /** Shrink by majority vote (resample) instead of nearest; rect targets only. */
  vote?: boolean
  /** Only paint where this buffer (same size as the target) is painted. */
  clip?: PixelBuffer
}

/**
 * Paint region `src` of `tex` into `buf`, stretched over a rect or a
 * shape (each target row takes the matching source row, stretched over
 * its span). Nearest-neighbour.
 */
export function mapTexture(buf: PixelBuffer, tex: Texture, src: Rect, dst: Rect | SpanShape, opts: MapOpts = {}): void {
  const put = (x: number, y: number, c: Px) => {
    if (c === null) { if (opts.under === undefined || opts.under === null) return; c = opts.under }
    if (opts.clip && !get(opts.clip, x, y)) return
    set(buf, x, y, c)
  }
  if ('w' in dst) {
    if (dst.w <= 0 || dst.h <= 0) return
    if (opts.vote && !opts.srcSpans) {
      const r = resample(tex, src, dst.w, dst.h)
      for (let y = 0; y < dst.h; y++) for (let x = 0; x < dst.w; x++) {
        put(dst.x + x, dst.y + y, r.px[y * dst.w + (opts.flipX ? dst.w - 1 - x : x)]!)
      }
      return
    }
    const r = dst
    dst = { y: r.y, spans: Array.from({ length: r.h }, (): [number, number] => [r.x, r.x + r.w - 1]) }
  }
  const rows = dst.spans.length
  for (let i = 0; i < rows; i++) {
    const sp = dst.spans[i]
    if (!sp) continue
    const ry = Math.min(src.h - 1, Math.floor(((i + 0.5) * src.h) / rows))
    const ss = opts.srcSpans?.[ry] ?? [src.x, src.x + src.w - 1]
    const sw = ss[1] - ss[0] + 1
    const dw = sp[1] - sp[0] + 1
    for (let x = sp[0]; x <= sp[1]; x++) {
      let k = Math.min(sw - 1, Math.floor(((x - sp[0] + 0.5) * sw) / dw))
      if (opts.flipX) k = sw - 1 - k
      put(x, dst.y + i, get(tex, ss[0] + k, src.y + ry))
    }
  }
}

// ---------------------------------------------------------------- light and lines

/**
 * Paint a line around what is painted: every empty pixel next to a
 * painted one (4-neighbours; with `diagonal` 8) takes `color(neighbour)`.
 * In place; leave a pixel of room around the drawing.
 */
export function outline(b: PixelBuffer, color: Hex | ((c: Hex) => Hex), diagonal = false): void {
  const src = b.px.slice()
  const at = (x: number, y: number): Px => (x >= 0 && y >= 0 && x < b.w && y < b.h ? src[y * b.w + x]! : null)
  const N = diagonal
    ? [[0, -1], [-1, 0], [1, 0], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]
    : [[0, -1], [-1, 0], [1, 0], [0, 1]]
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      if (src[y * b.w + x]) continue
      for (const [dx, dy] of N) {
        const n = at(x + dx!, y + dy!)
        if (n) { b.px[y * b.w + x] = typeof color === 'string' ? color : color(n); break }
      }
    }
  }
}

export interface LightOpts {
  /** Rows lit at the top of each column, and how much (tint). */
  top?: number; topF?: number
  /** Rows darkened at the bottom of each column (shade). */
  bottom?: number; bottomF?: number
  /** Columns darkened at the right end of each row. */
  right?: number; rightF?: number
  /** Columns lit at the left end of each row. */
  left?: number; leftF?: number
}

/**
 * Soft top light on whatever is painted inside `r`: the top edge of
 * every column lighter, the bottom and right edges darker, the left edge
 * a touch lighter. Edges follow the painted shape, so round parts get
 * round light.
 */
export function topLight(b: PixelBuffer, r: Rect, o: LightOpts): void {
  const L = new Map<number, number>()
  const add = (x: number, y: number, v: number) => { const k = y * b.w + x; L.set(k, (L.get(k) ?? 0) + v) }
  const painted = (x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h && !!get(b, x, y)
  for (let x = r.x; x < r.x + r.w; x++) {
    let first = -1, last = -1
    for (let y = r.y; y < r.y + r.h; y++) if (painted(x, y)) { if (first < 0) first = y; last = y }
    if (first < 0) continue
    for (let i = 0; i < (o.top ?? 0); i++) if (painted(x, first + i)) add(x, first + i, (o.topF ?? 0.3) * (1 - i / (o.top ?? 1) * 0.5))
    for (let i = 0; i < (o.bottom ?? 0); i++) if (painted(x, last - i)) add(x, last - i, -(o.bottomF ?? 0.2) * (1 - i / (o.bottom ?? 1) * 0.5))
  }
  for (let y = r.y; y < r.y + r.h; y++) {
    let first = -1, last = -1
    for (let x = r.x; x < r.x + r.w; x++) if (painted(x, y)) { if (first < 0) first = x; last = x }
    if (first < 0) continue
    for (let i = 0; i < (o.right ?? 0); i++) if (painted(last - i, y)) add(last - i, y, -(o.rightF ?? 0.18))
    for (let i = 0; i < (o.left ?? 0); i++) if (painted(first + i, y)) add(first + i, y, o.leftF ?? 0.12)
  }
  for (const [k, v] of L) {
    const c = b.px[k]
    if (!c || Math.abs(v) < 0.01) continue
    b.px[k] = v > 0 ? tint(c, Math.min(0.6, v)) : shade(c, Math.min(0.6, -v))
  }
}

// ---------------------------------------------------------------- output

const RGB = new Map<string, number>()
function rgbOf(hex: string): number {
  let n = RGB.get(hex)
  if (n === undefined) {
    n = parseInt(hex.slice(1, 7), 16)
    if (!Number.isFinite(n)) n = 0xff00ff
    if (RGB.size > 4096) RGB.clear()
    RGB.set(hex, n)
  }
  return n
}

/** Fill an ImageData-shaped RGBA array (w × h × 4) from `buf`; empty pixels are fully transparent. */
export function writeRGBA(buf: PixelBuffer, data: Uint8ClampedArray): void {
  const n = Math.min(buf.px.length, data.length >> 2)
  for (let i = 0; i < n; i++) {
    const c = buf.px[i]
    const j = i * 4
    if (!c) { data[j] = 0; data[j + 1] = 0; data[j + 2] = 0; data[j + 3] = 0; continue }
    const v = rgbOf(c)
    data[j] = (v >> 16) & 255
    data[j + 1] = (v >> 8) & 255
    data[j + 2] = v & 255
    data[j + 3] = 255
  }
}
