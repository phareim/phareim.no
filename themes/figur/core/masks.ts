/**
 * Which cells each garment kind may paint (its mask), and the faint body
 * outline the drawing board shows under it (its guide). Layouts are in
 * DESIGN.md; sizes in LAYOUTS (types.ts). Masks and guides are cached
 * and shared: treat the returned arrays as read-only.
 */
import {
  LAYOUTS, TOP_COLS, DRESS_SKIRT_ROW, HAT_HEAD_ROWS, layoutOf,
  type GarmentKind, type Texture,
} from '../types'

/** The top/dress rows a short sleeve covers (0..TEE_SLEEVE_ROWS-1). */
export const TEE_SLEEVE_ROWS = 5
/** Long sleeves stop one row short of the arm's end: the hand shows. */
export const LONG_SLEEVE_ROWS = 13
/** Rows a pair of shorts covers, and a skirt in the bottom layout. */
export const SHORTS_ROWS = 6
export const SKIRT_ROWS = 8

/** The size of a kind's texture. */
export function sizeOf(kind: GarmentKind): { w: number; h: number } {
  return LAYOUTS[layoutOf(kind)]
}

/** An all-transparent texture in a kind's layout. */
export function blankTexture(kind: GarmentKind): Texture {
  const { w, h } = sizeOf(kind)
  return { w, h, px: new Array<null>(w * h).fill(null) }
}

export const cloneTexture = (t: Texture): Texture => ({ w: t.w, h: t.h, px: t.px.slice() })

/** Dress skirt row y (≥ DRESS_SKIRT_ROW): first and last paintable column. */
export function skirtSpan(y: number): [number, number] {
  const widen = Math.min(2, Math.floor((y - DRESS_SKIRT_ROW) / 3))
  return [TOP_COLS.torso[0] - widen, TOP_COLS.torso[1] + widen]
}

/** Bottom-layout skirt row y: a slight flare (narrower waist, full width from row 3). */
export function bottomSkirtSpan(y: number): [number, number] {
  return y < 3 ? [1, 10] : [0, 11]
}

const isArm = (x: number) => x <= TOP_COLS.armL[1] || x >= TOP_COLS.armR[0]

function buildMask(kind: GarmentKind): boolean[] {
  const { w, h } = sizeOf(kind)
  const m = new Array<boolean>(w * h).fill(false)
  const on = (x: number, y: number) => { if (x >= 0 && x < w && y >= 0 && y < h) m[y * w + x] = true }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      switch (kind) {
        case 'tee':
          if (!isArm(x) || y < TEE_SLEEVE_ROWS) on(x, y)
          break
        case 'long': case 'hoodie': case 'shirt':
          if (!isArm(x) || y < LONG_SLEEVE_ROWS) on(x, y)
          break
        case 'tank':
          if (!isArm(x)) on(x, y)
          break
        case 'dress':
          // The top part may take sleeves of any length; the skirt is a trapezoid.
          if (y < DRESS_SKIRT_ROW) { if (!isArm(x) || y < LONG_SLEEVE_ROWS) on(x, y) } else {
            const [a, b] = skirtSpan(y)
            if (x >= a && x <= b) on(x, y)
          }
          break
        case 'pants': case 'leggings':
          on(x, y)
          break
        case 'shorts':
          if (y < SHORTS_ROWS) on(x, y)
          break
        case 'skirt': {
          const [a, b] = bottomSkirtSpan(y)
          if (y < SKIRT_ROWS && x >= a && x <= b) on(x, y)
          break
        }
        case 'sneaker':
          if (y >= 1) on(x, y)
          break
        case 'flat':
          if (y >= 2) on(x, y)
          break
        case 'boot': case 'hat': case 'glasses': case 'cape': case 'wings':
          on(x, y)
          break
      }
    }
  }
  return m
}

/** The head's outline in the hat layout's bottom rows: [row, first col, last col]. */
export const HAT_HEAD: Array<[number, number, number]> = [[6, 4, 11], [7, 3, 12], [8, 2, 13], [9, 2, 13]]

function buildGuide(kind: GarmentKind): boolean[] {
  const { w, h } = sizeOf(kind)
  const g = new Array<boolean>(w * h).fill(false)
  const on = (x: number, y: number) => { if (x >= 0 && x < w && y >= 0 && y < h) g[y * w + x] = true }
  const layout = layoutOf(kind)
  if (layout === 'top' || layout === 'dress') {
    // Shoulder line with the neck in the middle, the torso's sides, the arms' outer edges.
    for (let x = 0; x < 16; x++) if (x < 6 || x > 9) on(x, 0)
    for (const x of [6, 9]) on(x, 1)
    for (let y = 0; y < 14; y++) { on(0, y); on(15, y); on(3, y); on(12, y) }
    for (const x of [0, 1, 2, 13, 14, 15]) on(x, 13)
    if (layout === 'dress') {
      // The legs under the skirt.
      for (let y = DRESS_SKIRT_ROW; y < h; y++) { on(3, y); on(7, y); on(8, y); on(12, y) }
    } else {
      for (let x = 3; x <= 12; x++) on(x, 13)
    }
  } else if (layout === 'bottom') {
    for (let x = 0; x < w; x++) on(x, 0)
    for (let y = 0; y < h; y++) { on(0, y); on(11, y); if (y >= 2) { on(5, y); on(6, y) } }
    for (let x = 0; x < w; x++) on(x, h - 1)
  } else if (layout === 'shoes') {
    // The foot: a sole line and its toes.
    for (let x = 0; x < w; x++) on(x, h - 1)
    on(0, h - 2); on(w - 1, h - 2); on(1, 0); on(w - 2, 0)
  } else if (layout === 'hat') {
    for (const [y, a, b] of HAT_HEAD) {
      if (y === h - HAT_HEAD_ROWS) for (let x = a; x <= b; x++) on(x, y)
      else { on(a, y); on(b, y) }
    }
  } else if (layout === 'face') {
    // Where the eyes sit.
    for (const x of [2, 3, 8, 9]) { on(x, 1); on(x, 2) }
  } else if (layout === 'back') {
    // The body in front: shoulders at row 1, torso and arms.
    for (let x = 2; x <= 17; x++) on(x, 1)
    for (let y = 1; y < h; y++) { on(2, y); on(17, y); on(5, y); on(14, y) }
  }
  return g
}

const MASKS = new Map<GarmentKind, boolean[]>()
const GUIDES = new Map<GarmentKind, boolean[]>()

/** Which cells `kind` may paint, row-major in its layout. Shared: do not mutate. */
export function maskFor(kind: GarmentKind): boolean[] {
  let m = MASKS.get(kind)
  if (!m) { m = buildMask(kind); MASKS.set(kind, m) }
  return m
}

/** The body's outline for the drawing board, row-major in `kind`'s layout. Shared: do not mutate. */
export function guideFor(kind: GarmentKind): boolean[] {
  let g = GUIDES.get(kind)
  if (!g) { g = buildGuide(kind); GUIDES.set(kind, g) }
  return g
}

/** A copy of `tex` with every cell outside `kind`'s mask made transparent. */
export function applyMask(tex: Texture, kind: GarmentKind): Texture {
  const m = maskFor(kind)
  return { w: tex.w, h: tex.h, px: tex.px.map((c, i) => (m[i] ? c : null)) }
}
