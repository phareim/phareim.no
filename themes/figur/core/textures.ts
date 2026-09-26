/**
 * Textures: every garment is a small pixel picture (DESIGN.md). This is
 * the one module the rest of the game imports for them: masks and guides
 * (masks.ts), the built-in generators (garments.ts), packing for the
 * save, the drawing board's operations, resolving a figure's outfit to
 * textures, and sampling for the renderers. All pure.
 */
import {
  KIND_SLOT, LAYOUTS, PACK_CHARS, SLOTS,
  type DrawnGarment, type Figure, type GarmentKind, type Hex, type PackedTexture, type Slot, type Texture,
} from '../types'
import { garment } from '../catalog'
import { cleanHex, distance } from './color'
import { maskFor, sizeOf, applyMask } from './masks'
import { garmentTexture } from './garments'

export { shade, tint, mix, isHex, cleanHex } from './color'
export { blankTexture, cloneTexture, maskFor, guideFor, applyMask, sizeOf } from './masks'
export { garmentTexture } from './garments'

/** Kinds the child may draw (glasses, capes and wings are built-in only). */
export const DRAWABLE_KINDS: readonly GarmentKind[] = [
  'tee', 'long', 'tank', 'hoodie', 'shirt', 'dress',
  'pants', 'shorts', 'skirt', 'leggings',
  'sneaker', 'boot', 'flat', 'hat',
]

export const isDrawableKind = (k: unknown): k is GarmentKind =>
  typeof k === 'string' && (DRAWABLE_KINDS as readonly string[]).includes(k)

/** True when `tex` has the size of `kind`'s layout. */
export function fitsKind(tex: Texture, kind: GarmentKind): boolean {
  const { w, h } = sizeOf(kind)
  return tex.w === w && tex.h === h && tex.px.length === w * h
}

// ---------------------------------------------------------------- colours in a texture

/** Each colour in `tex` (or a region) with its pixel count, most used first. */
export function colorCounts(tex: Texture, region?: { x: number; y: number; w: number; h: number }): Array<[Hex, number]> {
  const r = region ?? { x: 0, y: 0, w: tex.w, h: tex.h }
  const counts = new Map<Hex, number>()
  for (let y = Math.max(0, r.y); y < Math.min(tex.h, r.y + r.h); y++) {
    for (let x = Math.max(0, r.x); x < Math.min(tex.w, r.x + r.w); x++) {
      const c = tex.px[y * tex.w + x]
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])
}

/** The most and second most used colours in `tex` (or a region); null where there are none. */
export function topColors(tex: Texture, region?: { x: number; y: number; w: number; h: number }): { main: Hex | null; second: Hex | null } {
  const c = colorCounts(tex, region)
  return { main: c[0]?.[0] ?? null, second: c[1]?.[0] ?? null }
}

/**
 * `tex` with at most `max` colours: the most used stay, the rest become
 * the nearest one kept. Unchanged (same object) when already within.
 */
export function limitColors(tex: Texture, max: number): Texture {
  const counts = colorCounts(tex)
  if (counts.length <= max) return tex
  const keep = counts.slice(0, Math.max(1, max)).map(([c]) => c)
  const keepSet = new Set(keep)
  const near = new Map<Hex, Hex>()
  const px = tex.px.map(c => {
    if (!c || keepSet.has(c)) return c
    let best = near.get(c)
    if (!best) {
      best = keep.reduce((a, b) => (distance(c, b) < distance(c, a) ? b : a))
      near.set(c, best)
    }
    return best
  })
  return { w: tex.w, h: tex.h, px }
}

// ---------------------------------------------------------------- packing

const LAYOUT_SIZES = Object.values(LAYOUTS).map(l => `${l.w}x${l.h}`)
const MAX_PACK_COLORS = PACK_CHARS.length

/** A texture as the save stores it. More than 62 colours are merged to the nearest first. */
export function packTexture(tex: Texture): PackedTexture {
  const t = limitColors(tex, MAX_PACK_COLORS)
  const pal: Hex[] = []
  const index = new Map<Hex, number>()
  let data = ''
  for (const c of t.px) {
    if (!c) { data += '.'; continue }
    let i = index.get(c)
    if (i === undefined) { i = pal.length; pal.push(c); index.set(c, i) }
    data += PACK_CHARS[i]
  }
  return { w: t.w, h: t.h, pal, data }
}

/**
 * A stored texture back, or null for anything that is not one: its size
 * must be a layout's, every colour '#rrggbb' (at most 62), every char
 * '.' or an index into the palette.
 */
export function unpackTexture(p: unknown): Texture | null {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null
  const r = p as Record<string, unknown>
  const { w, h, pal, data } = r
  if (!Number.isInteger(w) || !Number.isInteger(h)) return null
  if (!LAYOUT_SIZES.includes(`${w}x${h}`)) return null
  if (!Array.isArray(pal) || pal.length > MAX_PACK_COLORS) return null
  const colors: Hex[] = []
  for (const c of pal) {
    const hex = cleanHex(c)
    if (!hex) return null
    colors.push(hex)
  }
  if (typeof data !== 'string' || data.length !== (w as number) * (h as number)) return null
  const px: Array<Hex | null> = []
  for (const ch of data) {
    if (ch === '.') { px.push(null); continue }
    const i = PACK_CHARS.indexOf(ch)
    if (i < 0 || i >= colors.length) return null
    px.push(colors[i]!)
  }
  return { w: w as number, h: h as number, px }
}

// ---------------------------------------------------------------- drawing board

/**
 * Paint one cell (null erases). With `mirror`, the cell mirrored across
 * the vertical middle too. Cells outside the kind's mask stay as they
 * are. Returns a new texture, or `tex` itself when nothing changed.
 */
export function paintCell(tex: Texture, kind: GarmentKind, x: number, y: number, color: Hex | null, mirror: boolean): Texture {
  if (!fitsKind(tex, kind)) return tex
  const mask = maskFor(kind)
  const cells = mirror ? [[x, y], [tex.w - 1 - x, y]] : [[x, y]]
  let px: Array<Hex | null> | null = null
  for (const [cx, cy] of cells) {
    if (cx! < 0 || cy! < 0 || cx! >= tex.w || cy! >= tex.h) continue
    const i = cy! * tex.w + cx!
    if (!mask[i] || tex.px[i] === color) continue
    px ??= tex.px.slice()
    px[i] = color
  }
  return px ? { w: tex.w, h: tex.h, px } : tex
}

/**
 * Fill bucket: the 4-connected area of the start cell's colour (empty
 * counts as a colour), within the mask. With `mirror`, the mirrored
 * cell's area too. A new texture, or `tex` when nothing changed.
 */
export function fillArea(tex: Texture, kind: GarmentKind, x: number, y: number, color: Hex | null, mirror: boolean): Texture {
  if (!fitsKind(tex, kind)) return tex
  const mask = maskFor(kind)
  const px = tex.px.slice()
  let changed = false
  const flood = (sx: number, sy: number) => {
    if (sx < 0 || sy < 0 || sx >= tex.w || sy >= tex.h) return
    const start = sy * tex.w + sx
    if (!mask[start]) return
    // Read the target from the original, so the mirrored flood matches what the child sees.
    const target = tex.px[start]
    if (target === color) return
    const stack = [start]
    const seen = new Set<number>([start])
    while (stack.length) {
      const i = stack.pop()!
      if (px[i] !== color) { px[i] = color; changed = true }
      const cx = i % tex.w
      const cy = (i - cx) / tex.w
      for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= tex.w || ny >= tex.h) continue
        const j = ny * tex.w + nx
        if (seen.has(j) || !mask[j] || tex.px[j] !== target) continue
        seen.add(j)
        stack.push(j)
      }
    }
  }
  flood(x, y)
  if (mirror) flood(tex.w - 1 - x, y)
  return changed ? { w: tex.w, h: tex.h, px } : tex
}

/** An empty board for `kind`. */
export { blankTexture as clearTexture } from './masks'

// ---------------------------------------------------------------- outfit

export interface ResolvedOutfit {
  tex: Record<Slot, Texture | null>
  kind: Record<Slot, GarmentKind | null>
}

const DRAWN_CACHE = new Map<string, Texture>()
const DRAWN_CACHE_MAX = 200

/** A drawn piece's texture (unpacked once per id and content), or null if it is broken. */
export function drawnTexture(d: DrawnGarment): Texture | null {
  const key = `${d.id}|${d.kind}|${d.tex.w}x${d.tex.h}|${d.tex.pal.join(',')}|${d.tex.data}`
  const hit = DRAWN_CACHE.get(key)
  if (hit) return hit
  const t = unpackTexture(d.tex)
  if (!t || !fitsKind(t, d.kind)) return null
  const masked = applyMask(t, d.kind)
  if (DRAWN_CACHE.size >= DRAWN_CACHE_MAX) DRAWN_CACHE.clear()
  DRAWN_CACHE.set(key, masked)
  return masked
}

/**
 * The textures a figure wears, per slot: built-ins generated in the worn
 * colours, drawn ones from the closet. A piece in the wrong slot or with
 * an unknown id is nothing; under a dress the bottom is nothing.
 */
export function resolveOutfit(figure: Figure, closet: readonly DrawnGarment[]): ResolvedOutfit {
  const tex = {} as Record<Slot, Texture | null>
  const kind = {} as Record<Slot, GarmentKind | null>
  for (const slot of SLOTS) {
    tex[slot] = null
    kind[slot] = null
    const worn = figure.outfit[slot]
    if (!worn) continue
    const def = garment(worn.id)
    if (def) {
      if (KIND_SLOT[def.kind] !== slot) continue
      tex[slot] = garmentTexture(def, worn.color, worn.color2)
      kind[slot] = def.kind
      continue
    }
    const drawn = closet.find(d => d.id === worn.id)
    if (!drawn || KIND_SLOT[drawn.kind] !== slot) continue
    const t = drawnTexture(drawn)
    if (!t) continue
    tex[slot] = t
    kind[slot] = drawn.kind
  }
  if (kind.top === 'dress') {
    tex.bottom = null
    kind.bottom = null
  }
  return { tex, kind }
}

// ---------------------------------------------------------------- sampling

/** The colour at (u, v) in [0, 1): nearest pixel, clamped to the edges. */
export function sampleTexture(tex: Texture, u: number, v: number): Hex | null {
  const x = Math.min(tex.w - 1, Math.max(0, Math.floor(u * tex.w)))
  const y = Math.min(tex.h - 1, Math.max(0, Math.floor(v * tex.h)))
  return tex.px[y * tex.w + x] ?? null
}
