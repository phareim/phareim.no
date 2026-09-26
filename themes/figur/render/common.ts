/**
 * What the four styles share: body colours (skin, hair incl. rainbow,
 * face), the plain undershirt and shorts a figure wears when a slot is
 * empty, the per-figure cache key, placement on the floor line, the
 * cheer hop and its sparkles, and glasses with see-through lenses.
 */
import {
  SLOTS,
  type FigureBody, type FigureFrame, type GarmentKind, type Hex, type PixelBuffer, type Slot, type Texture,
} from '../types'
import { SKINS, RAINBOW, garment } from '../catalog'
import { brightness, distance, mix, shade, tint } from '../core/color'
import { garmentTexture } from '../core/garments'
import { colorCounts } from '../core/textures'
import { get, set, mapTexture, resample, type Px, type Rect } from './pixels'

// ---------------------------------------------------------------- body colours

export interface SkinColors { c: Hex; s: Hex; hi: Hex; deep: Hex }

export function skinOf(body: FigureBody): SkinColors {
  const d = SKINS.find(s => s.id === body.skin) ?? SKINS[1]!
  return { c: d.color, s: d.shade, hi: tint(d.color, 0.25), deep: shade(d.shade, 0.2) }
}

/** The hair's colour at height v (0 top … 1 bottom of the hair): rainbow hair stripes through RAINBOW. */
export function hairAt(body: FigureBody, v: number): Hex {
  if (body.hairColor !== 'rainbow') return body.hairColor
  const i = Math.max(0, Math.min(RAINBOW.length - 1, Math.floor(v * RAINBOW.length)))
  return RAINBOW[i]!
}

/** A hair tie that stands out from the hair. */
export function tieColor(body: FigureBody): Hex {
  const h = body.hairColor === 'rainbow' ? '#ffffff' : body.hairColor
  return distance(h, '#ff5fa2') < 12000 ? '#ffffff' : '#ff5fa2'
}

/** Star eyes: the eye colour pulled toward gold, so a brown star still reads as a star. */
export const starColor = (eye: Hex): Hex => mix(eye, '#ffd23f', 0.6)

export interface FaceColors { ink: Hex; mouth: Hex; inside: Hex; tongue: Hex; cheek: Hex; freckle: Hex; white: Hex }

export function faceColors(body: FigureBody): FaceColors {
  const sk = skinOf(body)
  return {
    ink: '#2a1a2e',
    mouth: mix(sk.s, '#5a1a2c', 0.65),
    inside: '#9c2a44',
    tongue: '#ff7b9c',
    cheek: mix(sk.c, '#ff5f8f', brightness(sk.c) > 150 ? 0.42 : 0.5),
    freckle: mix(sk.s, '#7a3a1c', 0.35),
    white: '#ffffff',
  }
}

// Marker colours: styles paint hair shapes with these, then colourHair
// turns them into the figure's hair (rainbow stripes follow the height).
export const HAIR = { base: '#000001', shade: '#000002', light: '#000003', deep: '#000004', tie: '#000005' } as const
const HAIR_MARKS = new Set<string>(Object.values(HAIR))

/** Replace hair markers in `b` with the hair colour; `top`/`bottom` give the rainbow's span (default: the markers' own). */
export function colourHair(b: PixelBuffer, body: FigureBody, span?: [number, number]): void {
  let top = span?.[0] ?? -1, bottom = span?.[1] ?? -1
  if (!span) {
    for (let i = 0; i < b.px.length; i++) {
      if (!HAIR_MARKS.has(b.px[i] ?? '')) continue
      const y = Math.floor(i / b.w)
      if (top < 0) top = y
      bottom = y
    }
  }
  const tie = tieColor(body)
  for (let i = 0; i < b.px.length; i++) {
    const m = b.px[i]
    if (!m || !HAIR_MARKS.has(m)) continue
    const y = Math.floor(i / b.w)
    const c = hairAt(body, bottom > top ? (y - top) / (bottom - top + 1) : 0)
    b.px[i] = m === HAIR.base ? c : m === HAIR.shade ? shade(c, 0.2) : m === HAIR.deep ? shade(c, 0.38)
      : m === HAIR.light ? tint(c, 0.42) : tie
  }
}

// ---------------------------------------------------------------- outfit defaults

export interface Worn2 { tex: Record<Slot, Texture | null>; kind: Record<Slot, GarmentKind | null> }

/**
 * A bare slot is not bare skin: no top → a plain white undershirt, no
 * bottom (and no dress) → light shorts, like Toca's figures.
 */
export function withDefaults(w: Worn2): Worn2 {
  if (w.tex.top && (w.tex.bottom || w.kind.top === 'dress')) return w
  const tex = { ...w.tex }
  const kind = { ...w.kind }
  if (!tex.top) { tex.top = garmentTexture(garment('singlet')!, '#f7f4ff', '#ffffff'); kind.top = 'tank' }
  if (!tex.bottom && kind.top !== 'dress') { tex.bottom = garmentTexture(garment('shorts')!, '#dfe4f2', '#ffffff'); kind.bottom = 'shorts' }
  return { tex, kind }
}

// ---------------------------------------------------------------- cache

const TEX_ID = new WeakMap<Texture, number>()
let nextTex = 1
const texId = (t: Texture | null): number => {
  if (!t) return 0
  let id = TEX_ID.get(t)
  if (!id) { id = nextTex++; TEX_ID.set(t, id) }
  return id
}

/** Identity of what a frame shows of the figure (not the pose): its body and the textures it wears. */
export function figureKey(f: Pick<FigureFrame, 'figure' | 'tex' | 'kind'>): string {
  const b = f.figure.body
  return `${b.skin}|${b.hair}|${b.hairColor}|${b.eyes}|${b.eyeColor}|${b.mouth}|${b.cheeks ? 1 : 0}${b.freckles ? 1 : 0}|`
    + SLOTS.map(s => `${f.kind[s] ?? '-'}:${texId(f.tex[s])}`).join(',')
}

/** A small least-recently-used cache. */
export class Lru<V> {
  private m = new Map<string, V>()
  constructor(private max: number) {}
  get(k: string): V | undefined {
    const v = this.m.get(k)
    if (v !== undefined) { this.m.delete(k); this.m.set(k, v) }
    return v
  }
  set(k: string, v: V): V {
    this.m.set(k, v)
    if (this.m.size > this.max) this.m.delete(this.m.keys().next().value as string)
    return v
  }
}

// ---------------------------------------------------------------- placement and cheer

/**
 * Where the style's `size` frame sits in a buffer that may be larger:
 * centred across, and on the bottom, so the floor line keeps its
 * distance from the bottom edge.
 */
export function frameOrigin(buf: PixelBuffer, size: { w: number; h: number }): { x: number; y: number } {
  return { x: Math.floor((buf.w - size.w) / 2), y: buf.h - size.h }
}

/** The cheer hop in pixels (cheer counts 1 → 0: up and down twice, the second lower). */
export function hopOf(cheer: number, height: number): number {
  if (cheer <= 0) return 0
  const p = 1 - cheer
  const s = Math.sin(p * Math.PI * 2)
  return Math.round(Math.abs(s) * height * (p < 0.5 ? 1 : 0.5))
}

export type SparkleKind = 'orb' | 'star' | 'confetti' | 'heart'

const HEART5 = ['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..']

/** Sparkles around the figure while it cheers: rising and fading as cheer counts down. */
export function sparkles(b: PixelBuffer, cx: number, cy: number, rx: number, ry: number, cheer: number, t: number, kind: SparkleKind, colors: Hex[]): void {
  if (cheer <= 0.02) return
  const n = 9
  const p = 1 - cheer
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4
    const r = 0.75 + p * 0.35
    const x = Math.round(cx + Math.cos(a) * rx * r)
    const y = Math.round(cy + Math.sin(a) * ry * r - p * 4)
    if ((Math.floor(t * 12) + i) % 5 === 0) continue
    const c = colors[i % colors.length]!
    if (kind === 'orb') {
      set(b, x, y, c); set(b, x + 1, y, c); set(b, x, y + 1, shade(c, 0.25)); set(b, x + 1, y + 1, c)
      set(b, x, y, tint(c, 0.5))
    } else if (kind === 'star') {
      set(b, x, y, '#ffffff')
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(b, x + dx!, y + dy!, c)
      if (cheer > 0.5) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) set(b, x + dx!, y + dy!, tint(c, 0.4))
    } else if (kind === 'confetti') {
      set(b, x, y, c); if (i % 2) set(b, x + 1, y, c); else set(b, x, y + 1, c)
    } else {
      if (i % 2) {
        HEART5.forEach((row, dy) => { for (let dx = 0; dx < 5; dx++) if (row[dx] === 'X') set(b, x + dx - 2, y + dy - 2, c) })
      } else {
        set(b, x, y, '#ffffff')
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) set(b, x + dx!, y + dy!, tint(c, 0.5))
      }
    }
  }
}

// ---------------------------------------------------------------- glasses

/**
 * Paint a glasses texture over `dst`: the frame solid, light lenses
 * see-through (the eyes show), dark lenses (sunglasses) solid.
 */
export function paintGlasses(b: PixelBuffer, tex: Texture, dst: Rect): void {
  const frameColor = colorCounts(tex)[0]?.[0] ?? null
  const r = resample(tex, { x: 0, y: 0, w: tex.w, h: tex.h }, dst.w, dst.h)
  for (let y = 0; y < dst.h; y++) {
    for (let x = 0; x < dst.w; x++) {
      const c: Px = r.px[y * dst.w + x]!
      if (!c) continue
      const under = get(b, dst.x + x, dst.y + y)
      const lens = c !== frameColor && brightness(c) > 120
      set(b, dst.x + x, dst.y + y, lens && under ? mix(under, c, 0.4) : c)
    }
  }
}

// ---------------------------------------------------------------- capes

/** Each row's first and last painted column of a texture (null for an empty row). */
export function rowSpans(t: Texture): Array<[number, number] | null> {
  const out: Array<[number, number] | null> = []
  for (let y = 0; y < t.h; y++) {
    let a = -1, z = -1
    for (let x = 0; x < t.w; x++) if (t.px[y * t.w + x]) { if (a < 0) a = x; z = x }
    out.push(a < 0 ? null : [a, z])
  }
  return out
}

/**
 * A cape seen from the front: behind the body it flares from just past
 * the arms (`wTop` wide at the shoulders) to `wBottom` at `bottom`, so
 * its sides show beside the torso, arms and legs; in front, its collar
 * lies across the shoulders. `cxB` is the body's centre line (a pixel
 * boundary); widths are made even so both sides match.
 */
export function paintCape(back: PixelBuffer, front: PixelBuffer, tex: Texture, cxB: number, top: number, bottom: number, wTop: number, wBottom: number, collar: number): void {
  const h = bottom - top + 1
  const spans: Array<[number, number]> = []
  for (let i = 0; i < h; i++) {
    let w = Math.round(wTop + (wBottom - wTop) * Math.sqrt(i / Math.max(1, h - 1)))
    if (w % 2) w++
    spans.push([cxB - w / 2, cxB + w / 2 - 1])
  }
  mapTexture(back, tex, { x: 0, y: 0, w: tex.w, h: tex.h }, { y: top, spans }, { srcSpans: rowSpans(tex) })
  // The collar: the cape's top two rows across the shoulders.
  const cw = wTop - 2
  mapTexture(front, tex, { x: 4, y: 0, w: 12, h: 2 }, { x: cxB - cw / 2, y: top, w: cw, h: collar }, { vote: true })
}
