/**
 * The round-headed body the Toca Boca and Avatar World styles share: a
 * big head on a small body, thin arms with round hands, legs, little
 * feet, clothes mapped from the textures (skirts and dresses flared,
 * boots up the shin), hair from roundhair.ts, the hat on the head (it
 * wins over hair above it), glasses over the eyes, capes and wings
 * behind. A spec sets the proportions and the look (outline, light,
 * gloss); the style brings its own face.
 */
import { DRESS_SKIRT_ROW, type FigureBody, type FigureFrame, type GarmentKind, type Hex, type PixelBuffer, type Texture } from '../types'
import { maskFor } from '../core/masks'
import {
  blit, fillCircle, fillEllipse, makeBuffer, mapTexture, outline, set, smoothResize, topLight,
  flipTexture, type LightOpts, type Rect, type SpanShape,
} from './pixels'
import { colourHair, paintCape, figureKey, frameOrigin, hopOf, Lru, paintGlasses, skinOf, sparkles, withDefaults, type SparkleKind } from './common'
import { paintRoundHair, type HeadGeom } from './roundhair'

export interface ChibiSpec {
  size: { w: number; h: number }
  /** The floor row: feet stand on it. */
  floor: number
  head: { rx: number; ry: number; chin: number }
  neck: { w: number; h: number }
  /** Torso widths, shoulders to crotch (even numbers). */
  torso: number[]
  /** Torso rows the top covers; the rest are hips (the bottom's waist). */
  topRows: number
  arm: { w: number; len: number; gap: number; hand: number; splay: number }
  leg: { w: number; len: number; gap: number }
  foot: { w: number; h: number; out: number }
  /** Skirts and dresses: extra pixels each side at the hem. */
  flare: number
  /** A dress's skirt length. */
  skirtLen: number
  /** Wings: how much wider than their texture, and how much of their height rises above the shoulders (capes flare from past the arms to the skirt's flare). */
  wings: number
  wingsLift: number
  outline: 'silhouette' | 'parts'
  ink: (c: Hex) => Hex
  light: LightOpts | null
  gloss: boolean
  face(b: PixelBuffer, body: FigureBody, g: HeadGeom, blink: boolean): void
  /** Where glasses go. */
  glasses(g: HeadGeom): Rect
}

export interface Chibi { layer: PixelBuffer; head: HeadGeom; torsoTop: number }

const bbox = (b: PixelBuffer): Rect | null => {
  let x0 = b.w, y0 = b.h, x1 = -1, y1 = -1
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (b.px[y * b.w + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

/** Each row's painted columns of a kind's mask, for rows y0..y1 of its layout. */
function maskSpans(kind: GarmentKind, tex: Texture, y0: number, y1: number): Array<[number, number] | null> {
  const m = maskFor(kind)
  const out: Array<[number, number] | null> = []
  for (let y = y0; y <= y1; y++) {
    let a = -1, z = -1
    for (let x = 0; x < tex.w; x++) if (m[y * tex.w + x]) { if (a < 0) a = x; z = x }
    out.push(a < 0 ? null : [a, z])
  }
  return out
}

const spansAround = (cxB: number, y: number, widths: number[]): SpanShape =>
  ({ y, spans: widths.map(w => [cxB - w / 2, cxB + w / 2 - 1] as [number, number]) })

/** Paint the whole figure (not the backdrop) into a layer the size of the style's frame. */
export function paintChibi(spec: ChibiSpec, f: Pick<FigureFrame, 'figure' | 'tex' | 'kind'>, bob: number, blink: boolean): Chibi {
  const { w: W, h: Hh } = spec.size
  const body = f.figure.body
  const sk = skinOf(body)
  const worn = withDefaults({ tex: f.tex, kind: f.kind })
  const cxB = W / 2
  const L = () => makeBuffer(W, Hh)

  // ------------------------------------------------ geometry, bottom up
  const floor = spec.floor
  const legTop = floor - 1 - spec.leg.len
  const torsoTop = legTop + 2 - spec.torso.length
  const hipTop = torsoTop + spec.topRows
  const headBottom = torsoTop - spec.neck.h + 2
  const g: HeadGeom = { cx: cxB, cy: headBottom - spec.head.ry, rx: spec.head.rx, ry: spec.head.ry }
  const legX = [cxB - spec.leg.gap / 2 - spec.leg.w, cxB + spec.leg.gap / 2]
  const shoulderW = Math.max(...spec.torso.slice(0, 4)) // arms hang beside the widest shoulder row

  // ------------------------------------------------ back piece
  const back = L()
  const collar = L()
  const armSpan = shoulderW + 2 * (spec.arm.gap + spec.arm.w + spec.arm.splay)
  if (worn.tex.back && worn.kind.back === 'cape') {
    paintCape(back, collar, worn.tex.back, cxB, torsoTop, floor - 3, armSpan + 4, armSpan + 4 + 2 * spec.flare, 2)
  } else if (worn.tex.back) {
    const s = spec.wings
    const bw = Math.round(20 * s), bh = Math.round(18 * s)
    const t = smoothResize(worn.tex.back, bw, bh)
    blit(back, t, Math.round(cxB - bw / 2), torsoTop - Math.round(bh * spec.wingsLift))
  }

  // ------------------------------------------------ hat (first: hair makes room for it)
  const hat = L()
  let hatCovers = false
  if (worn.tex.hat) {
    const s = (2 * g.rx) / 12 * 0.85
    const hw = Math.round(16 * s), hh = Math.round(10 * s)
    const t = smoothResize(worn.tex.hat, hw, hh)
    blit(hat, t, Math.round(cxB - hw / 2), Math.round(g.cy - g.ry + 4 * s - hh))
    const tx = worn.tex.hat
    hatCovers = [6, 7, 8, 9].every(x => !!tx.px[6 * tx.w + x])
  }

  // ------------------------------------------------ hair
  const hairF = L(), hairB = L()
  paintRoundHair(hairF, hairB, body.hair, g, spec.gloss)
  if (hatCovers) {
    // The hat wins above its lower edge: no hair pokes through it.
    for (let x = 0; x < W; x++) {
      let bottom = -1
      for (let y = 0; y < Hh; y++) if (hat.px[y * W + x]) bottom = y
      if (bottom < 0) continue
      const cut = Math.min(bottom, Math.round(g.cy - g.ry * 0.55))
      for (let y = 0; y < cut; y++) { hairF.px[y * W + x] = null; hairB.px[y * W + x] = null }
    }
  }
  const hb = bbox(hairB), hf = bbox(hairF)
  const span: [number, number] = [Math.min(hb?.y ?? 999, hf?.y ?? 999), Math.max(hb ? hb.y + hb.h : 0, hf ? hf.y + hf.h : 0)]
  colourHair(hairF, body, span)
  colourHair(hairB, body, span)

  // ------------------------------------------------ legs and hips
  const legs = L()
  const bottom = worn.tex.bottom
  const hipRows = legTop + 2 - hipTop
  const total = hipRows + spec.leg.len
  const srcHip = Math.max(1, Math.round((12 * hipRows) / total))
  for (let y = hipTop; y <= floor - 2; y++) {
    if (y < legTop + 2) {
      const w = spec.torso[Math.min(spec.torso.length - 1, y - torsoTop)]!
      for (let x = cxB - w / 2; x < cxB + w / 2; x++) set(legs, x, y, sk.c)
    }
    if (y >= legTop) for (const x0 of legX) for (let x = x0; x < x0 + spec.leg.w; x++) set(legs, x, y, sk.c)
  }
  if (bottom && worn.kind.bottom) {
    const hipW = spec.torso[spec.torso.length - 1]!
    mapTexture(legs, bottom, { x: 0, y: 0, w: 12, h: srcHip }, { x: cxB - hipW / 2, y: hipTop, w: hipW, h: legTop - hipTop }, {})
    const legSrc = { y: srcHip, h: 12 - srcHip }
    mapTexture(legs, bottom, { x: 0, y: legSrc.y, w: 6, h: legSrc.h }, { x: legX[0]!, y: legTop, w: spec.leg.w, h: floor - 1 - legTop }, {})
    mapTexture(legs, bottom, { x: 6, y: legSrc.y, w: 6, h: legSrc.h }, { x: legX[1]!, y: legTop, w: spec.leg.w, h: floor - 1 - legTop }, {})
  }

  // ------------------------------------------------ feet and shoes
  const feet = L()
  const shoes = worn.tex.shoes
  legX.forEach((x0, i) => {
    const fx = x0 + spec.leg.w / 2 + (i ? spec.foot.out : -spec.foot.out)
    const fy = floor - spec.foot.h / 2
    fillEllipse(feet, fx, fy, spec.foot.w / 2, spec.foot.h / 2, sk.c)
    if (!shoes) return
    const t = i ? flipTexture(shoes) : shoes
    let first = t.h
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (t.px[y * t.w + x]) first = Math.min(first, y)
    if (first >= t.h) return
    const clip = makeBuffer(W, Hh)
    fillEllipse(clip, fx, fy, spec.foot.w / 2 + 0.3, spec.foot.h / 2 + 0.3, '#000000')
    const rows = Math.min(spec.foot.h, t.h - first)
    const r: Rect = { x: Math.round(fx - spec.foot.w / 2), y: floor - rows, w: spec.foot.w, h: rows }
    mapTexture(feet, t, { x: 0, y: first, w: t.w, h: t.h - first }, r, { clip })
    if (worn.kind.shoes === 'boot') {
      // The shaft up the shin.
      const shaft = Math.round(spec.leg.len * 0.4)
      mapTexture(feet, t, { x: 1, y: first, w: 4, h: 1 }, { x: x0, y: floor - spec.foot.h - shaft + 1, w: spec.leg.w, h: shaft }, {})
    }
  })

  // ------------------------------------------------ skirts
  const skirt = L()
  const top = worn.tex.top!
  if (worn.kind.top === 'dress') {
    const w0 = spec.torso[spec.topRows] ?? spec.torso[spec.torso.length - 1]!
    const shape = trapezoidSpans(cxB, hipTop, spec.skirtLen, w0, w0 + 2 * spec.flare)
    mapTexture(skirt, top, { x: 0, y: DRESS_SKIRT_ROW, w: 16, h: top.h - DRESS_SKIRT_ROW }, shape,
      { srcSpans: maskSpans('dress', top, DRESS_SKIRT_ROW, top.h - 1) })
  } else if (worn.kind.bottom === 'skirt' && bottom) {
    const w0 = spec.torso[spec.torso.length - 1]!
    const h = Math.round((8 / 12) * total)
    mapTexture(skirt, bottom, { x: 0, y: 0, w: 12, h: 8 }, trapezoidSpans(cxB, hipTop, h, w0, w0 + 2 * spec.flare),
      { srcSpans: maskSpans('skirt', bottom, 0, 7) })
  }

  // ------------------------------------------------ torso
  const torso = L()
  const tShape = spansAround(cxB, torsoTop, spec.torso.slice(0, spec.topRows))
  mapTexture(torso, top, { x: 3, y: 0, w: 10, h: DRESS_SKIRT_ROW }, tShape, { under: sk.c })

  // ------------------------------------------------ arms and hands
  const arms = L()
  for (const side of [-1, 1]) {
    const inner = side < 0 ? cxB - shoulderW / 2 - spec.arm.gap : cxB + shoulderW / 2 + spec.arm.gap - 1
    const spans: Array<[number, number]> = []
    for (let i = 0; i < spec.arm.len; i++) {
      const sh = Math.round((spec.arm.splay * i) / spec.arm.len) * side
      const a = side < 0 ? inner - spec.arm.w + 1 + sh : inner + sh
      spans.push([a, a + spec.arm.w - 1])
    }
    const shape: SpanShape = { y: torsoTop + 1, spans }
    const src = side < 0 ? 0 : 13
    mapTexture(arms, top, { x: src, y: 0, w: 3, h: DRESS_SKIRT_ROW }, shape, { under: sk.c })
    const last = spans[spans.length - 1]!
    fillCircle(arms, (last[0] + last[1] + 1) / 2, torsoTop + spec.arm.len + 1, spec.arm.hand / 2, sk.c)
  }

  // ------------------------------------------------ head
  const head = L()
  for (let y = headBottom - spec.neck.h - 1; y < torsoTop + 1; y++) for (let x = cxB - spec.neck.w / 2; x < cxB + spec.neck.w / 2; x++) set(head, x, y, sk.s)
  headShape(head, g, spec.head.chin, sk.c)
  if (spec.light) {
    const r = bbox(head)
    if (r) topLight(head, r, { ...spec.light, top: 0 })
  }
  spec.face(head, body, g, blink)

  // ------------------------------------------------ compose
  const out = L()
  const parts: Array<[PixelBuffer, boolean, boolean]> = [
    // layer, upper body (bobs), gets light
    [back, true, true], [hairB, true, true], [legs, false, true], [feet, false, true], [skirt, false, true],
    [torso, true, true], [arms, true, true], [collar, true, true], [head, true, false], [hairF, true, true], [hat, true, true],
  ]
  for (const [layer, upper, lit] of parts) {
    if (lit && spec.light) { const r = bbox(layer); if (r) topLight(layer, r, spec.light) }
    if (spec.outline === 'parts') outline(layer, spec.ink)
    blit(out, layer, 0, upper ? bob : 0)
  }
  if (worn.tex.face) {
    const r = spec.glasses(g)
    paintGlasses(out, worn.tex.face, { ...r, y: r.y + bob })
  }
  if (spec.outline === 'silhouette') outline(out, spec.ink)
  return { layer: out, head: { ...g, cy: g.cy + bob }, torsoTop }
}

/** Rows of a trapezoid centred on the boundary cxB (even widths stay symmetric). */
function trapezoidSpans(cxB: number, y: number, h: number, wTop: number, wBottom: number): SpanShape {
  const spans: Array<[number, number]> = []
  for (let i = 0; i < h; i++) {
    let w = Math.round(wTop + (wBottom - wTop) * (h <= 1 ? 0 : i / (h - 1)))
    if (w % 2) w++
    spans.push([cxB - w / 2, cxB + w / 2 - 1])
  }
  return { y, spans }
}

/** The head: an ellipse whose lower half narrows toward the chin by `chin` (0 = round). */
function headShape(b: PixelBuffer, g: HeadGeom, chin: number, c: Hex): void {
  for (let y = Math.floor(g.cy - g.ry); y <= Math.ceil(g.cy + g.ry); y++) {
    const dy = (y + 0.5 - g.cy) / g.ry
    if (dy * dy > 1) continue
    let half = g.rx * Math.sqrt(1 - dy * dy)
    if (dy > 0) half *= 1 - chin * dy * dy
    for (let x = Math.ceil(g.cx - half - 0.5); x <= Math.floor(g.cx + half - 0.5); x++) set(b, x, y, c)
  }
}


// ---------------------------------------------------------------- one frame

export interface ChibiLook {
  spec: ChibiSpec
  cache: Lru<Chibi>
  /** Paint the backdrop (the frame's origin in the buffer, the time). */
  backdrop(b: PixelBuffer, o: { x: number; y: number }, t: number): void
  sparkle: SparkleKind
  sparkleColors: Hex[]
}

/** Draw one frame of a round-headed style: backdrop, the cached figure (hopping when it cheers), sparkles. */
export function chibiFrame(look: ChibiLook, f: FigureFrame): void {
  const b = f.buf
  const o = frameOrigin(b, look.spec.size)
  if (f.backdrop) look.backdrop(b, o, f.t)
  const bob = f.pose.bob ? 1 : 0
  const key = `${figureKey(f)}|${bob}|${f.pose.blink ? 1 : 0}`
  const fig = look.cache.get(key) ?? look.cache.set(key, paintChibi(look.spec, f, bob, f.pose.blink))
  const hop = hopOf(f.pose.cheer, 4)
  blit(b, fig.layer, o.x, o.y - hop)
  sparkles(b, o.x + look.spec.size.w / 2, o.y + fig.torsoTop - 6 - hop, look.spec.size.w * 0.42, look.spec.size.h * 0.36,
    f.pose.cheer, f.t, look.sparkle, look.sparkleColors)
}
