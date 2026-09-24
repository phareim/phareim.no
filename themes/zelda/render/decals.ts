/**
 * Decals: neon lettering painted into the world (`MapDef.decals`), built from
 * the 5×7 font at a whole-number scale. Each decal is baked once into cached
 * canvases:
 *
 * - `lit`: a drop shadow on the wall, two soft pixel halo rings, the glass
 *   tube in the decal's colour and, from scale 2, a hot 1-px core running
 *   through every stroke;
 * - `off`: the tube unlit (a letter that flickers out shows this);
 * - `mask`: white where the tube and its inner halo glow, drawn into the
 *   light map so the lettering keeps full brightness at night;
 * - `bloom`: a blurred copy in the tube colour for the screen bloom pass.
 *
 * Drawn over the ground and under entities. A faint flicker (a letter
 * stutters now and then, the glow breathes) is off with reduced motion.
 */
import type { Decal, MapDef } from '../types'
import { TILE } from '../types'
import { glyphRows, textWidth, GLYPH_H } from './font'
import { makeCanvas } from './sheet'
import { hash2, type Light } from './tiles'

type G = CanvasRenderingContext2D
type Canvas = HTMLCanvasElement
const T = TILE

/** Pixel halo around the tube (canvas padding). */
const PAD = 3
/** Extra padding of the blurred bloom copy. */
const BPAD = 6

export const DECAL_COLOR = '#ff2fa0'

const coverCache = new WeakMap<MapDef, Set<number>>()

/** Tile indices (row-major, map width `w`) that a decal's lettering covers: the painter leaves their windows dark. */
export function decalCover(def: MapDef, w: number): Set<number> {
  let set = coverCache.get(def)
  if (set) return set
  set = new Set()
  for (const d of def.decals ?? []) {
    const s = d.scale ?? 2
    const tw = (textWidth(d.text) * s) / T
    const th = (GLYPH_H * s) / T
    const x0 = d.align === 'center' ? d.x - tw / 2 : d.x
    for (let ty = Math.floor(d.y - 0.1); ty <= Math.floor(d.y + th + 0.1); ty++) {
      for (let tx = Math.floor(x0 - 0.1); tx <= Math.floor(x0 + tw + 0.1); tx++) if (tx >= 0 && ty >= 0 && tx < w) set.add(ty * w + tx)
    }
  }
  coverCache.set(def, set)
  return set
}

interface Baked {
  lit: Canvas
  off: Canvas
  mask: Canvas
  bloom: Canvas
  /** Text width at scale, without padding. */
  w: number
  h: number
  scale: number
  color: string
  /** Letter spans (x, w) in tube px, for flickering one letter. */
  letters: Array<{ x: number; w: number }>
  /** Glow lights along the text (tube px from the text's left/top). */
  spots: Array<{ x: number; y: number }>
}

const cache = new WeakMap<Decal, Map<number, Baked>>()

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function mix(hex: string, to: [number, number, number], t: number): string {
  const [r, g, b] = rgb(hex)
  const m = (a: number, z: number) => Math.round(a + (z - a) * t)
  return `rgb(${m(r, to[0])},${m(g, to[1])},${m(b, to[2])})`
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

function bake(d: Decal, scale: number): Baked {
  const color = d.color ?? DECAL_COLOR
  // 1-px font grid of the whole text.
  const text = d.text.toUpperCase()
  const glyphs = [...text].map(ch => glyphRows(ch))
  const gw = Math.max(1, glyphs.reduce((a, gl) => a + gl[0]!.length + 1, 0) - 1)
  const on: boolean[] = new Array(gw * GLYPH_H).fill(false)
  const letters: Baked['letters'] = []
  let gx = 0
  for (let i = 0; i < glyphs.length; i++) {
    const gl = glyphs[i]!
    const w = gl[0]!.length
    if (text[i] !== ' ') letters.push({ x: gx * scale, w: w * scale })
    for (let y = 0; y < GLYPH_H; y++) for (let x = 0; x < w; x++) if (gl[y]![x] === '#') on[y * gw + gx + x] = true
    gx += w + 1
  }
  const lit = (x: number, y: number) => x >= 0 && y >= 0 && x < gw && y < GLYPH_H && on[y * gw + x]!
  const W = gw * scale
  const H = GLYPH_H * scale
  const CW = W + PAD * 2
  const CH = H + PAD * 2

  // Tube coverage at scale, then halo rings by dilation.
  const tube = new Uint8Array(CW * CH)
  for (let y = 0; y < GLYPH_H; y++) for (let x = 0; x < gw; x++) {
    if (!lit(x, y)) continue
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) tube[(PAD + y * scale + sy) * CW + PAD + x * scale + sx] = 1
  }
  const dilate = (src: Uint8Array, diag: boolean) => {
    const out = new Uint8Array(src)
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      if (src[y * CW + x]) continue
      let n = false
      for (let dy = -1; dy <= 1 && !n; dy++) for (let dx = -1; dx <= 1 && !n; dx++) {
        if (!diag && dx && dy) continue
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && yy >= 0 && xx < CW && yy < CH && src[yy * CW + xx]) n = true
      }
      if (n) out[y * CW + x] = 1
    }
    return out
  }
  const ring1 = dilate(tube, true)
  const ring2 = dilate(ring1, false)

  const litC = makeCanvas(CW, CH)
  const g = litC.getContext('2d')!
  const px = (c: CanvasRenderingContext2D, x: number, y: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, 1, 1) }
  const dark: [number, number, number] = [5, 2, 12]
  const white: [number, number, number] = [255, 255, 255]
  // Drop shadow of the tubes on the wall behind them.
  const shadowCol = 'rgba(5,2,12,0.55)'
  for (let y = 0; y < CH - 1; y++) for (let x = 0; x < CW - 1; x++) if (tube[y * CW + x] && !tube[(y + 1) * CW + x + 1]) px(g, x + 1, y + 1, shadowCol)
  if (scale > 1) {
    const r2 = rgba(color, 0.16)
    const r1 = rgba(color, 0.34)
    for (let i = 0; i < CW * CH; i++) {
      if (tube[i]) continue
      if (ring1[i]) px(g, i % CW, Math.floor(i / CW), r1)
      else if (ring2[i]) px(g, i % CW, Math.floor(i / CW), r2)
    }
  }
  // Tube body, with a slightly deeper lower edge so strokes read as round glass.
  const body = scale > 1 ? color : mix(color, white, 0.35)
  const under = mix(color, dark, 0.28)
  for (let i = 0; i < CW * CH; i++) {
    if (!tube[i]) continue
    const x = i % CW
    const y = Math.floor(i / CW)
    px(g, x, y, scale > 2 && !tube[i + CW] ? under : body)
  }
  // Hot core: one pixel through the middle of every stroke, joined to its neighbours.
  if (scale > 1) {
    const o = scale === 2 ? 0 : Math.floor((scale - 1) / 2)
    g.fillStyle = mix(color, white, 0.66)
    for (let y = 0; y < GLYPH_H; y++) for (let x = 0; x < gw; x++) {
      if (!lit(x, y)) continue
      const X = PAD + x * scale + o
      const Y = PAD + y * scale + o
      g.fillRect(X, Y, 1, 1)
      if (lit(x + 1, y)) g.fillRect(X, Y, scale + 1, 1)
      if (lit(x, y + 1)) g.fillRect(X, Y, 1, scale + 1)
    }
  }

  // Unlit tube
  const offC = makeCanvas(CW, CH)
  const og = offC.getContext('2d')!
  const offCol = mix(color, dark, 0.72)
  const offHi = mix(color, dark, 0.55)
  for (let i = 0; i < CW * CH; i++) {
    if (!tube[i]) continue
    const x = i % CW
    const y = Math.floor(i / CW)
    px(og, x, y, tube[i - CW] ? offCol : offHi)
  }

  // Light-map mask: tube at full white, the inner ring half.
  const maskC = makeCanvas(CW, CH)
  const mg = maskC.getContext('2d')!
  for (let i = 0; i < CW * CH; i++) {
    if (tube[i]) px(mg, i % CW, Math.floor(i / CW), '#ffffff')
    else if (ring1[i] && scale > 1) px(mg, i % CW, Math.floor(i / CW), 'rgba(255,255,255,0.5)')
  }

  // Bloom copy: the tube stamped around a small disc, so it blurs when the
  // bloom layer is scaled up smoothly.
  const bloomC = makeCanvas(CW + BPAD * 2, CH + BPAD * 2)
  const bl = bloomC.getContext('2d')!
  const solid = makeCanvas(CW, CH)
  const sg = solid.getContext('2d')!
  for (let i = 0; i < CW * CH; i++) if (tube[i]) px(sg, i % CW, Math.floor(i / CW), color)
  bl.globalCompositeOperation = 'lighter'
  const R = 2 + scale
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy)
    if (d > R) continue
    bl.globalAlpha = 0.07 * (1 - d / (R + 1))
    bl.drawImage(solid, BPAD + dx, BPAD + dy)
  }
  bl.globalAlpha = 1

  // Glow lights spaced along the text.
  const spots: Baked['spots'] = []
  const step = Math.max(10, scale * 9)
  const n = Math.max(1, Math.round(W / step))
  for (let i = 0; i < n; i++) spots.push({ x: ((i + 0.5) / n) * W, y: H / 2 })

  return { lit: litC, off: offC, mask: maskC, bloom: bloomC, w: W, h: H, scale, color, letters, spots }
}

/**
 * How many scale steps every decal of a map drops so the widest fits `maxW`
 * view px (a scale-3 name on a narrow phone). All drop together, so the
 * name stays bigger than the lines under it.
 */
function stepDown(decals: readonly Decal[], maxW: number): number {
  let step = 0
  for (const d of decals) {
    const tw = textWidth(d.text)
    let scale: number = d.scale ?? 2
    let n = 0
    while (scale > 1 && tw * scale > maxW) { scale--; n++ }
    step = Math.max(step, n)
  }
  return step
}

function baked(d: Decal, step: number): Baked {
  const scale = Math.max(1, (d.scale ?? 2) - step)
  let per = cache.get(d)
  if (!per) { per = new Map(); cache.set(d, per) }
  let b = per.get(scale)
  if (!b) { b = bake(d, scale); per.set(scale, b) }
  return b
}

/** Top-left of the text (view px) for a decal. */
function origin(d: Decal, b: Baked, cx: number, cy: number) {
  const x = Math.round(d.x * T - (d.align === 'center' ? b.w / 2 : 0)) - cx
  const y = Math.round(d.y * T) - cy
  return { x, y }
}

function visible(x: number, y: number, b: Baked, vw: number, vh: number) {
  return x + b.w + BPAD + PAD > 0 && y + b.h + BPAD + PAD > 0 && x - BPAD - PAD < vw && y - BPAD - PAD < vh
}

/** Which letter (if any) is stuttering right now, and whether it is dark this instant. */
function flicker(d: Decal, b: Baked, i: number, t: number, reduced: boolean): { letter: number; dark: boolean; breathe: number } {
  if (reduced || !b.letters.length) return { letter: -1, dark: false, breathe: 1 }
  const period = 6 + hash2(i, b.letters.length, 5) * 5
  const k = Math.floor(t / period)
  const into = t - k * period
  const breathe = 0.93 + 0.05 * Math.sin(t * 2.1 + i) + 0.02 * Math.sin(t * 17 + i * 3)
  if (into > 0.45) return { letter: -1, dark: false, breathe }
  const letter = Math.floor(hash2(k, i, 9) * b.letters.length)
  const dark = Math.floor(into * 22) % 3 !== 1
  void d
  return { letter, dark, breathe }
}

export interface DecalFrame { t: number; reduced: boolean; /** Widest a decal may be (view px). */ maxW: number }

/** World pass: the lettering itself (before entities, before lighting). */
export function drawDecals(g: G, decals: readonly Decal[] | undefined, cx: number, cy: number, vw: number, vh: number, f: DecalFrame, lights: Light[]) {
  if (!decals) return
  const step = stepDown(decals, f.maxW)
  decals.forEach((d, i) => {
    const b = baked(d, step)
    const { x, y } = origin(d, b, cx, cy)
    if (!visible(x, y, b, vw, vh)) return
    g.drawImage(b.lit, x - PAD, y - PAD)
    const fl = flicker(d, b, i, f.t, f.reduced)
    if (fl.letter >= 0 && fl.dark) {
      const L = b.letters[fl.letter]!
      g.drawImage(b.off, L.x + PAD, 0, L.w, b.off.height, x + L.x, y - PAD, L.w, b.off.height)
    }
    // Soft coloured light on the wall around the letters (kept under the bloom threshold).
    const a = 0.26 * fl.breathe
    const rad = 0.9 + b.scale * 0.35
    for (const s of b.spots) lights.push({ x: (x + s.x + cx) / T, y: (y + s.y + cy) / T, r: rad, color: b.color, a })
  })
}

/** Light pass: keep the tubes at full brightness (additive white into the light map). */
export function lightDecals(lg: G, decals: readonly Decal[] | undefined, cx: number, cy: number, vw: number, vh: number, f: DecalFrame) {
  if (!decals) return
  const step = stepDown(decals, f.maxW)
  decals.forEach((d, i) => {
    const b = baked(d, step)
    const { x, y } = origin(d, b, cx, cy)
    if (!visible(x, y, b, vw, vh)) return
    const fl = flicker(d, b, i, f.t, f.reduced)
    lg.globalAlpha = 1
    lg.drawImage(b.mask, x - PAD, y - PAD)
    void fl
  })
}

/** Bloom pass: the soft coloured glow that hugs the letters. */
export function bloomDecals(bg: G, decals: readonly Decal[] | undefined, cx: number, cy: number, vw: number, vh: number, f: DecalFrame) {
  if (!decals) return
  const step = stepDown(decals, f.maxW)
  decals.forEach((d, i) => {
    const b = baked(d, step)
    const { x, y } = origin(d, b, cx, cy)
    if (!visible(x, y, b, vw, vh)) return
    const fl = flicker(d, b, i, f.t, f.reduced)
    bg.globalAlpha = Math.min(1, 0.6 * fl.breathe)
    bg.drawImage(b.bloom, x - PAD - BPAD, y - PAD - BPAD)
    bg.globalAlpha = 1
  })
}
