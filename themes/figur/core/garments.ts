/**
 * The built-in garments' textures: tops, dresses and bottoms here, the
 * small pieces (shoes, hats, glasses, capes and wings) in accessories.ts.
 * A garment is generated from its GarmentDef and the worn colours, then
 * clipped to its kind's mask; results are cached per (id, colours).
 *
 * Light falls from the viewer's left: the right edge of each part, cuffs
 * and hems are one shade darker. Patterns recolour fabric only, so
 * collars, buttons and belts stay clean on a striped or rainbow piece.
 */
import { DRESS_SKIRT_ROW, type GarmentDef, type GarmentKind, type Hex, type Texture } from '../types'
import { cleanHex } from './color'
import { applyMask, skirtSpan, bottomSkirtSpan, TEE_SLEEVE_ROWS, LONG_SLEEVE_ROWS, SHORTS_ROWS, SKIRT_ROWS } from './masks'
import { Paint, palFor, applyPattern, type Pal } from './pixelart'
import { shoeArt, hatArt, glassesArt, backArt } from './accessories'

type Neck = 'crew' | 'vneck' | 'tank' | 'princess'

const ARMS = [0, 1, 2, 13, 14, 15]

/** The upper body (rows 0–13 of a top or a dress): fabric, neckline. */
function fillUpper(p: Paint, P: Pal, sleeves: number, neck: Neck): void {
  for (let y = 0; y < 14; y++) {
    for (let x = 3; x <= 12; x++) p.cloth(x, y, P.a)
    if (y < sleeves) for (const x of ARMS) p.cloth(x, y, P.a)
  }
  const clear = (x0: number, x1: number, y: number) => { for (let x = x0; x <= x1; x++) p.detail(x, y, null) }
  if (neck === 'crew') clear(6, 9, 0)
  else if (neck === 'vneck') { clear(5, 10, 0); clear(6, 9, 1); clear(7, 8, 2) }
  else if (neck === 'princess') { clear(5, 10, 0); clear(6, 9, 1) }
  else {
    // Tank: two straps on the shoulders, armholes, a scooped front.
    clear(3, 3, 0); clear(6, 9, 0); clear(12, 12, 0)
    clear(3, 3, 1); clear(6, 9, 1); clear(12, 12, 1)
    clear(7, 8, 2)
  }
}

/** Darken each listed cell once (edges overlap at corners). */
function darkenOnce(p: Paint, cells: Array<[number, number]>): void {
  const seen = new Set<number>()
  for (const [x, y] of cells) {
    const k = y * p.w + x
    if (seen.has(k) || !p.get(x, y)) continue
    seen.add(k)
    p.darken(x, y)
  }
}

/** Right edges, cuffs and the hem of the upper body. */
function upperShading(sleeves: number, hemRow: number | null): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  for (let y = 0; y < sleeves; y++) cells.push([2, y], [15, y])
  if (sleeves > 0) for (const x of ARMS) cells.push([x, sleeves - 1])
  for (let y = 0; y < 14; y++) cells.push([12, y])
  if (hemRow !== null) for (let x = 3; x <= 12; x++) cells.push([x, hemRow])
  return cells
}

/** Neck details that sit on top of pattern and shading. */
function neckDetails(p: Paint, P: Pal, neck: Neck): void {
  if (neck === 'crew') for (let x = 6; x <= 9; x++) p.detail(x, 1, P.b)
  if (neck === 'vneck') for (const [x, y] of [[5, 1], [10, 1], [6, 2], [9, 2], [7, 3], [8, 3]] as const) p.detail(x, y, P.b)
}

function topTexture(def: GarmentDef, P: Pal): Paint {
  const p = new Paint(16, 14)
  const kind = def.kind
  const sleeves = kind === 'tee' ? TEE_SLEEVE_ROWS : kind === 'tank' ? 0 : LONG_SLEEVE_ROWS
  const neck: Neck = kind === 'tank' ? 'tank' : def.shape === 'vneck' ? 'vneck' : 'crew'
  fillUpper(p, P, sleeves, neck)
  applyPattern(p, def.pattern, P.a, P.d, {
    emblemAt: kind === 'tank' ? [5, 5] : [5, def.pattern === 'star' ? 3 : 4],
    bands: [0, 13],
  })
  darkenOnce(p, upperShading(sleeves, 13))
  neckDetails(p, P, neck)

  if (kind === 'hoodie') {
    for (const x of [3, 4, 5, 10, 11, 12]) p.detail(x, 0, P.b)
    for (let x = 6; x <= 9; x++) p.detail(x, 1, P.b)
    for (const x of [6, 9]) { p.detail(x, 2, P.d); p.detail(x, 3, P.d); p.detail(x, 4, P.e) }
    // The kangaroo pocket.
    for (let x = 5; x <= 10; x++) p.detail(x, 8, P.b)
    for (let y = 9; y <= 11; y++) { p.detail(5, y, P.b); p.detail(10, y, P.b) }
  }
  if (kind === 'shirt') {
    for (const [x, y] of [[5, 0], [6, 0], [9, 0], [10, 0], [6, 1], [9, 1]] as const) p.detail(x, y, P.d)
    p.detail(7, 0, null); p.detail(8, 0, null)
    p.detail(7, 1, P.b); p.detail(8, 1, P.b)
    for (let y = 2; y <= 13; y++) p.detail(7, y, P.b)
    for (const y of [3, 6, 9, 12]) p.detail(8, y, P.e)
    // Chest pocket.
    for (let x = 9; x <= 11; x++) p.detail(x, 3, P.b)
  }
  if (def.shape === 'hero') {
    for (let x = 3; x <= 12; x++) p.detail(x, 10, P.d)
    p.detail(7, 10, P.e); p.detail(8, 10, P.e)
    for (const x of ARMS) { p.detail(x, 11, P.d); p.detail(x, 12, P.e) }
  }
  return p
}

/** Small stars scattered over a dress (its star pattern). */
const DRESS_TWINKLES: Array<[number, number]> = [[5, 3], [10, 6], [6, 10], [4, 16], [10, 15], [7, 19], [12, 20], [3, 21], [9, 22]]

function dressTexture(def: GarmentDef, P: Pal): Paint {
  const p = new Paint(16, 24)
  const shape = def.shape ?? 'tee'
  const sleeves = shape === 'princess' ? 4 : shape === 'strap' ? 0 : shape === 'long' ? LONG_SLEEVE_ROWS : TEE_SLEEVE_ROWS
  const neck: Neck = shape === 'princess' ? 'princess' : shape === 'strap' ? 'tank' : 'crew'
  fillUpper(p, P, sleeves, neck)
  for (let y = DRESS_SKIRT_ROW; y < 24; y++) {
    const [a, b] = skirtSpan(y)
    for (let x = a; x <= b; x++) p.cloth(x, y, P.a)
  }
  applyPattern(p, def.pattern, P.a, P.d, {
    emblemAt: def.pattern === 'heart' ? [5, 4] : undefined,
    twinkles: DRESS_TWINKLES,
    bands: [0, 23],
  })
  const cells = upperShading(sleeves, shape === 'princess' ? null : 13)
  for (let y = DRESS_SKIRT_ROW; y < 24; y++) {
    const [, b] = skirtSpan(y)
    cells.push([b, y])
    if (y >= 17 && y < 23) cells.push([5, y], [10, y])
  }
  for (let x = 0; x < 16; x++) cells.push([x, 23])
  darkenOnce(p, cells)
  neckDetails(p, P, neck)

  if (shape === 'princess') {
    // Puffed sleeves catch the light; a sash with a bow; a lace hem.
    for (const x of ARMS) p.detail(x, 0, P.c)
    for (let x = 3; x <= 12; x++) { p.detail(x, 12, P.d); p.detail(x, 13, P.d) }
    p.detail(7, 12, P.e); p.detail(8, 12, P.e); p.detail(7, 13, P.e); p.detail(8, 13, P.e)
    p.detail(6, 14, P.d); p.detail(9, 14, P.d)
    const [a, b] = skirtSpan(23)
    for (let x = a; x <= b; x++) {
      p.detail(x, 23, P.d)
      if ((x - a) % 2 === 0) p.detail(x, 22, P.d)
    }
  }
  return p
}

function bottomTexture(def: GarmentDef, P: Pal): Paint {
  const p = new Paint(12, 12)
  const kind = def.kind
  const rows = kind === 'shorts' ? SHORTS_ROWS : kind === 'skirt' ? SKIRT_ROWS : 12
  for (let y = 0; y < rows; y++) {
    const [a, b] = kind === 'skirt' ? bottomSkirtSpan(y) : [0, 11]
    for (let x = a; x <= b; x++) p.cloth(x, y, P.a)
  }
  applyPattern(p, def.pattern, P.a, P.d, { twinkles: [[2, 3], [9, 5], [4, 8], [8, 10]] })

  const cells: Array<[number, number]> = []
  if (kind === 'skirt') {
    for (let y = 0; y < rows; y++) cells.push([bottomSkirtSpan(y)[1], y])
    if (def.shape === 'pleat') for (let y = 2; y < rows - 1; y++) for (const x of [1, 4, 7, 10]) cells.push([x, y])
  } else {
    for (let y = 1; y < rows; y++) cells.push([5, y], [11, y])
  }
  for (let x = 0; x < 12; x++) cells.push([x, rows - 1])
  darkenOnce(p, cells)

  // Waistband.
  for (let x = 0; x < 12; x++) if (p.get(x, 0)) p.detail(x, 0, P.b)

  if (def.shape === 'jeans') {
    p.detail(6, 0, P.d)
    p.detail(6, 1, P.b); p.detail(6, 2, P.b)
    for (const [x, y] of [[1, 1], [2, 2], [10, 1], [9, 2]] as const) p.detail(x, y, P.b)
    for (let x = 0; x < 12; x++) p.detail(x, 11, P.c)
  }
  if (def.shape === 'jogger') {
    for (const [x, y] of [[5, 1], [5, 2], [6, 1], [6, 2]] as const) p.detail(x, y, P.d)
    for (let y = 1; y <= 9; y++) { p.detail(0, y, P.d); p.detail(11, y, P.d) }
    for (let x = 0; x < 12; x++) { p.detail(x, 10, P.b); p.detail(x, 11, P.b) }
  }
  if (kind === 'shorts') {
    for (const [x, y] of [[1, 1], [10, 1]] as const) p.detail(x, y, P.b)
  }
  if (def.shape === 'tulle') {
    for (const y of [3, 6]) for (let x = 0; x < 12; x++) if (p.isFab(x, y)) p.cloth(x, y, P.c)
    for (let x = 0; x < 12; x++) if (x % 2 === 1) p.detail(x, rows - 1, null)
  }
  return p
}

// ---------------------------------------------------------------- dispatch

const CACHE = new Map<string, Texture>()
const CACHE_MAX = 400

/**
 * A built-in garment's texture in the given colours (default: its own).
 * Cached and shared: clone before editing (the board's ops return new
 * textures anyway). Every pixel outside the kind's mask is null.
 */
export function garmentTexture(def: GarmentDef, color?: Hex, color2?: Hex): Texture {
  const main = cleanHex(color) ?? def.color
  const second = cleanHex(color2) ?? def.color2
  const key = `${def.id}|${main}|${second}`
  const hit = CACHE.get(key)
  if (hit) return hit
  const P = palFor(main, second)
  const p = generate(def, P)
  const tex = applyMask(p.texture(), def.kind)
  if (CACHE.size >= CACHE_MAX) CACHE.clear()
  CACHE.set(key, tex)
  return tex
}

function generate(def: GarmentDef, P: Pal): Paint {
  const k: GarmentKind = def.kind
  switch (k) {
    case 'tee': case 'long': case 'tank': case 'hoodie': case 'shirt':
      return topTexture(def, P)
    case 'dress':
      return dressTexture(def, P)
    case 'pants': case 'shorts': case 'skirt': case 'leggings':
      return bottomTexture(def, P)
    case 'sneaker': case 'boot': case 'flat':
      return shoeArt(def, P)
    case 'hat':
      return hatArt(def, P)
    case 'glasses':
      return glassesArt(def, P)
    case 'cape': case 'wings':
      return backArt(def, P)
  }
}

