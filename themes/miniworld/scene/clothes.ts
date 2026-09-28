/**
 * Mini World's clothes (avatar/house agent). Two halves:
 *
 * - The body atlas: one 128×64 canvas per look, Roblox-style. Torso,
 *   arms and legs are boxes whose faces map into it; skin, shirt,
 *   trousers and shoes are painted per slot shape and pattern (tee
 *   sleeves end above the elbow, shorts show the knees, boots climb the
 *   shin). `ghost` leaves skin transparent, for a shirt on its own.
 * - The 3D pieces: skirts and dress flares, hoods, collars, toe caps,
 *   skate wheels, a onesie's tail, mermaid fins, dino feet, the 19 hats,
 *   the 9 face items and the 8 back items, added to a `PartSet` that
 *   merges them by material.
 *
 * Every shape in `TopShape`…`BackShape` has a builder; `SHAPE_BUILDERS`
 * lists them so the node test can check the catalog against it.
 */
import * as THREE from 'three'
import type { ClothingDef, ClothingSlot, PersonLook, Pattern, HatShape, FaceShape, BackShape, TopShape, BottomShape, ShoeShape } from '../types'
import { SKINS, clothing, coversLegs, coversFeet } from '../catalog'
import { Kit, textureMaterial, lambertMaterial, basicMaterial, worldUV, darken, lighten } from './meshkit'
import { cachedTexture, paintPattern, patternTile, patternDensity, type Colors } from './textures'

// ---------------------------------------------------------------- atlas layout

export const ATLAS_W = 128
export const ATLAS_H = 64
export type Rect = readonly [number, number, number, number]
export const REG = {
  torsoFront: [0, 0, 24, 24],
  torsoBack: [24, 0, 24, 24],
  torsoSide: [48, 0, 12, 24],
  torsoTop: [60, 0, 24, 12],
  torsoBottom: [60, 12, 24, 12],
  arm: [84, 0, 12, 24],
  armTop: [96, 0, 12, 12],
  hand: [96, 12, 12, 12],
  leg: [108, 0, 12, 24],
  legFront: [0, 24, 12, 24],
  legTop: [12, 24, 12, 12],
  sole: [12, 36, 12, 12],
  shoe: [24, 24, 12, 12],
  skin: [36, 24, 12, 12],
  shoeTop: [48, 24, 12, 12],
} as const satisfies Record<string, Rect>
export type RegionId = keyof typeof REG

/** A box whose six faces (+x, −x, +y, −y, +z, −z) map to atlas regions. */
export function atlasBox(w: number, h: number, d: number, faces: [RegionId, RegionId, RegionId, RegionId, RegionId, RegionId]): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d)
  const uv = g.getAttribute('uv') as THREE.BufferAttribute
  for (let f = 0; f < 6; f++) {
    const [rx, ry, rw, rh] = REG[faces[f]!]
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k
      const u = uv.getX(i), v = uv.getY(i)
      // Inset half a texel so nearest sampling never bleeds into a neighbour.
      const U = (rx + 0.02 + u * (rw - 0.04)) / ATLAS_W
      const V = 1 - (ry + 0.02 + (1 - v) * (rh - 0.04)) / ATLAS_H
      uv.setXY(i, U, V)
    }
  }
  uv.needsUpdate = true
  return g
}

const skinOf = (look: PersonLook) => SKINS.find(s => s.id === look.skin) ?? SKINS[1]!

type G = CanvasRenderingContext2D
const fill = (g: G, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h) }
/** Paint rows [r0, r1) of a region with a pattern. */
function rows(g: G, id: RegionId, r0: number, r1: number, pattern: Pattern | undefined, colors: Colors) {
  const [x, y, w] = REG[id]
  if (r1 <= r0) return
  paintPattern(g, x, y + r0, w, r1 - r0, pattern, colors)
}
function rect(g: G, id: RegionId, x: number, y: number, w: number, h: number, c: string) {
  const [rx, ry] = REG[id]
  fill(g, rx + x, ry + y, w, h, c)
}
function clearRect(g: G, id: RegionId, x: number, y: number, w: number, h: number) {
  const [rx, ry] = REG[id]
  g.clearRect(rx + x, ry + y, w, h)
}

/** Row where the shoe starts on the 24-row leg. */
export function shoeTopRow(shape: string | undefined): number {
  switch (shape) {
    case 'boots': return 12
    case 'skates': return 13
    case 'sandals': return 21
    case 'ballet': return 20
    case 'claws': return 17
    default: return 19
  }
}

export interface AtlasOpts {
  /** Leave skin transparent (a garment on its own). */
  ghost?: boolean
  /** Only these slots are painted (default: all). */
  slots?: ClothingSlot[]
}

/** The body atlas for a look (cached by look + options). */
export function bodyAtlas(look: PersonLook, opts: AtlasOpts = {}): THREE.CanvasTexture {
  const o = look.outfit
  const slots = opts.slots ?? ['top', 'bottom', 'shoes']
  const key = `atlas|${opts.ghost ? 'g' : look.skin}|${slots.includes('top') ? o.top : ''}|${slots.includes('bottom') ? o.bottom : ''}|${slots.includes('shoes') ? o.shoes : ''}`
  return cachedTexture(key, ATLAS_W, ATLAS_H, (g) => {
    const skin = skinOf(look)
    if (!opts.ghost) {
      fill(g, 0, 0, ATLAS_W, ATLAS_H, skin.color)
      // Knuckle shade on the hand and a chin line are too small to read; a darker sole is enough.
    }
    const top = slots.includes('top') ? clothing(o.top) : undefined
    const legsCovered = !!top && coversLegs(top.id)
    const bottom = slots.includes('bottom') && !legsCovered ? clothing(o.bottom) : undefined
    // A mermaid tail covers the feet: no shoes under it.
    const shoes = slots.includes('shoes') && !coversFeet(o) ? clothing(o.shoes) : undefined
    if (bottom) paintBottom(g, bottom, !!top)
    if (top?.shape === 'onesie') paintOnesieLegs(g, top)
    if (shoes) paintShoes(g, shoes, opts.ghost ? null : skin.color)
    if (top) paintTop(g, top, !!bottom, opts.ghost ? null : skin.color)
    // A soft one-pixel edge on every body face gives the blocks definition.
    g.globalCompositeOperation = 'source-atop'
    g.fillStyle = 'rgba(40,20,60,0.13)'
    for (const id of ['torsoFront', 'torsoBack', 'torsoSide', 'arm', 'leg', 'legFront'] as RegionId[]) {
      const [x, y, w, h] = REG[id]
      g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h)
    }
    g.globalCompositeOperation = 'source-over'
  })
}

function paintTop(g: G, def: ClothingDef, bottomShown: boolean, skin: string | null) {
  const shape = def.shape as TopShape
  const C = def.colors, P = def.pattern
  const dark = darken(C.main, 0.22)
  const trim = C.second ?? dark
  const long = shape === 'dress' || shape === 'gown'
  const end = long || !bottomShown ? 24 : 20
  for (const id of ['torsoFront', 'torsoBack'] as RegionId[]) rows(g, id, 0, end, P, C)
  rows(g, 'torsoSide', 0, end, P, C)
  rows(g, 'torsoTop', 0, 12, P, C)
  if (!bottomShown || long) rows(g, 'torsoBottom', 0, 12, P, C)
  const sleeve = (r1: number, cuff?: string) => {
    rows(g, 'arm', 0, r1, P, C)
    rows(g, 'armTop', 0, 12, P, C)
    if (cuff) rect(g, 'arm', 0, r1 - 2, 12, 2, cuff)
  }
  const neck = (w: number, h: number, c: string | null) => {
    for (const id of ['torsoFront'] as RegionId[]) {
      const x = 12 - w / 2
      if (c) rect(g, id, x, 0, w, h, c)
      else clearRect(g, id, x, 0, w, h)
    }
  }
  const skinOr = (id: RegionId, x: number, y: number, w: number, h: number) => (skin ? rect(g, id, x, y, w, h, skin) : clearRect(g, id, x, y, w, h))
  switch (shape) {
    case 'tee':
      sleeve(9, C.second && P === 'plain' ? C.second : undefined)
      skinOr('torsoFront', 9, 0, 6, 2)
      rect(g, 'torsoFront', 9, 2, 6, 1, trim)
      rect(g, 'torsoFront', 8, 1, 1, 1, trim); rect(g, 'torsoFront', 15, 1, 1, 1, trim)
      if (C.accent) rect(g, 'torsoFront', 15, 6, 3, 3, C.accent)
      break
    case 'tank':
      skinOr('torsoFront', 6, 0, 12, 3); skinOr('torsoFront', 8, 3, 8, 1)
      skinOr('torsoBack', 6, 0, 12, 2)
      skinOr('torsoTop', 7, 0, 10, 12); skinOr('torsoTop', 0, 0, 3, 12); skinOr('torsoTop', 21, 0, 3, 12)
      skinOr('torsoSide', 0, 0, 12, 3)
      if (C.second && P === 'plain') rect(g, 'torsoFront', 0, 18, 24, 2, C.second)
      break
    case 'hoodie':
      sleeve(21, dark)
      rect(g, 'torsoFront', 8, 0, 8, 2, dark)
      rect(g, 'torsoFront', 5, 13, 14, 6, darken(C.main, 0.14))
      rect(g, 'torsoFront', 6, 13, 12, 1, darken(C.main, 0.3))
      rect(g, 'torsoFront', 9, 2, 1, 6, C.second ?? '#ffffff'); rect(g, 'torsoFront', 14, 2, 1, 6, C.second ?? '#ffffff')
      if (C.accent) rect(g, 'torsoFront', 10, 8, 4, 3, C.accent)
      if (end === 20) { rect(g, 'torsoFront', 0, 18, 24, 2, dark); rect(g, 'torsoBack', 0, 18, 24, 2, dark); rect(g, 'torsoSide', 0, 18, 12, 2, dark) }
      break
    case 'sweater':
      sleeve(21, dark)
      rect(g, 'torsoFront', 8, 0, 8, 2, dark)
      if (end === 20) { rect(g, 'torsoFront', 0, 18, 24, 2, dark); rect(g, 'torsoBack', 0, 18, 24, 2, dark); rect(g, 'torsoSide', 0, 18, 12, 2, dark) }
      break
    case 'jacket': {
      sleeve(21, dark)
      const inner = C.second ?? '#f4f0ff'
      rect(g, 'torsoFront', 8, 0, 8, end, inner)
      skinOr('torsoFront', 10, 0, 4, 2)
      rect(g, 'torsoFront', 6, 0, 2, 10, dark); rect(g, 'torsoFront', 16, 0, 2, 10, dark)
      rect(g, 'torsoFront', 7, 10, 1, end - 10, dark); rect(g, 'torsoFront', 16, 10, 1, end - 10, dark)
      for (const y of [9, 13, 17]) if (y < end) rect(g, 'torsoFront', 5, y, 1, 1, C.accent ?? '#ffd23f')
      rect(g, 'torsoFront', 2, 5, 3, 1, dark)
      break
    }
    case 'dress':
    case 'gown': {
      sleeve(shape === 'gown' ? 7 : 6)
      skinOr('torsoFront', 7, 0, 10, 2); skinOr('torsoFront', 9, 2, 6, 1)
      const band = C.second ?? dark
      rect(g, 'torsoFront', 0, 13, 24, 2, band); rect(g, 'torsoBack', 0, 13, 24, 2, band); rect(g, 'torsoSide', 0, 13, 12, 2, band)
      if (shape === 'gown') { rect(g, 'torsoFront', 6, 2, 1, 1, band); rect(g, 'torsoFront', 17, 2, 1, 1, band); rect(g, 'torsoFront', 7, 3, 10, 1, band) }
      if (C.accent) rect(g, 'torsoFront', 11, 12, 2, 2, C.accent)
      break
    }
    case 'suit': {
      sleeve(24, C.second)
      rect(g, 'hand', 0, 0, 12, 12, darken(C.main, 0.1))
      rect(g, 'torsoFront', 6, 5, 12, 7, darken(C.main, 0.12))
      rect(g, 'torsoFront', 7, 6, 3, 2, C.accent ?? '#ff3b5c'); rect(g, 'torsoFront', 11, 6, 2, 2, C.second ?? '#2ff3ff'); rect(g, 'torsoFront', 14, 6, 3, 2, '#ffe14f')
      rect(g, 'torsoFront', 7, 9, 10, 1, darken(C.main, 0.3))
      rect(g, 'torsoFront', 0, 18, 24, 2, C.second ?? dark); rect(g, 'torsoBack', 0, 18, 24, 2, C.second ?? dark); rect(g, 'torsoSide', 0, 18, 12, 2, C.second ?? dark)
      break
    }
    case 'onesie':
      // A whole-body animal suit: long sleeves, a collar, a belly patch in the accent colour (legs: paintOnesieLegs).
      sleeve(21, dark)
      rect(g, 'torsoFront', 8, 0, 8, 2, dark)
      if (C.accent) { rect(g, 'torsoFront', 7, 5, 10, 17, C.accent); rect(g, 'torsoFront', 6, 7, 12, 13, C.accent) }
      break
    case 'hero': {
      // A superhero suit: tight long sleeves, gloves, a shield on the chest, a belt.
      const glove = C.second ?? dark
      sleeve(24)
      rect(g, 'arm', 0, 17, 12, 7, glove)
      rect(g, 'hand', 0, 0, 12, 12, glove)
      rect(g, 'torsoFront', 9, 0, 6, 1, dark)
      // The shield: rows of shrinking width, the accent inside, a bolt across.
      const shield: [number, number][] = [[4, 12], [5, 12], [6, 12], [7, 12], [8, 10], [9, 8], [10, 6], [11, 4], [12, 2]]
      for (const [y, w] of shield) rect(g, 'torsoFront', 12 - w / 2, y, w, 1, glove)
      for (const [y, w] of shield.slice(1, -1)) rect(g, 'torsoFront', 12 - w / 2 + 1, y, w - 2, 1, C.accent ?? '#ffe14f')
      for (const [x, y] of [[13, 5], [12, 6], [11, 7], [12, 7], [13, 7], [12, 8], [11, 9]] as [number, number][]) rect(g, 'torsoFront', x, y, 1, 1, glove)
      const belt = C.accent ?? '#ffe14f'
      rect(g, 'torsoFront', 0, 17, 24, 2, belt); rect(g, 'torsoBack', 0, 17, 24, 2, belt); rect(g, 'torsoSide', 0, 17, 12, 2, belt)
      rect(g, 'torsoFront', 10, 16, 4, 4, glove)
      break
    }
  }
}

/** A onesie's legs, painted before the shoes so they stand on top. */
function paintOnesieLegs(g: G, def: ClothingDef) {
  const C = def.colors, P = def.pattern
  rows(g, 'leg', 0, 24, P, C); rows(g, 'legFront', 0, 24, P, C); rows(g, 'legTop', 0, 12, P, C)
  const cuff = darken(C.main, 0.22)
  rect(g, 'leg', 0, 17, 12, 2, cuff); rect(g, 'legFront', 0, 17, 12, 2, cuff)
}

function paintBottom(g: G, def: ClothingDef, topShown: boolean) {
  const shape = def.shape as BottomShape
  const C = def.colors, P = def.pattern
  const dark = darken(C.main, 0.22)
  const waist = (r0: number) => {
    for (const id of ['torsoFront', 'torsoBack'] as RegionId[]) rows(g, id, r0, 24, P, C)
    rows(g, 'torsoSide', r0, 24, P, C)
    rows(g, 'torsoBottom', 0, 12, P, C)
    if (C.accent) { rect(g, 'torsoFront', 0, r0, 24, 1, C.accent); rect(g, 'torsoBack', 0, r0, 24, 1, C.accent); rect(g, 'torsoSide', 0, r0, 12, 1, C.accent) }
  }
  waist(topShown ? 20 : 16)
  switch (shape) {
    case 'pants':
      rows(g, 'leg', 0, 24, P, C); rows(g, 'legFront', 0, 24, P, C); rows(g, 'legTop', 0, 12, P, C)
      if (C.second && (!P || P === 'plain')) {
        rect(g, 'leg', 5, 0, 2, 24, C.second)
        rect(g, 'legFront', 1, 12, 10, 3, darken(C.main, 0.12))
      }
      rect(g, 'legFront', 5, 0, 1, 5, dark)
      break
    case 'shorts':
      rows(g, 'leg', 0, 10, P, C); rows(g, 'legFront', 0, 10, P, C); rows(g, 'legTop', 0, 12, P, C)
      rect(g, 'leg', 0, 9, 12, 1, dark); rect(g, 'legFront', 0, 9, 12, 1, dark)
      break
    case 'skirt':
    case 'tutu':
      rows(g, 'legTop', 0, 12, P, C)
      // A little of the skirt's colour at the very top of the leg, under the flare.
      rows(g, 'leg', 0, 2, P, C); rows(g, 'legFront', 0, 2, P, C)
      break
    case 'mermaid': {
      // Scales down to the feet, the fin colour at the bottom (the fins are 3D: legPieces).
      rows(g, 'leg', 0, 24, P, C); rows(g, 'legFront', 0, 24, P, C); rows(g, 'legTop', 0, 12, P, C)
      const fin = C.accent ?? C.second ?? dark
      for (const id of ['leg', 'legFront'] as RegionId[]) { rect(g, id, 0, 19, 12, 5, fin); rect(g, id, 0, 18, 12, 1, darken(fin, 0.2)) }
      for (const id of ['sole', 'shoe', 'shoeTop'] as RegionId[]) rect(g, id, 0, 0, 12, 12, fin)
      break
    }
  }
}

function paintShoes(g: G, def: ClothingDef, skin: string | null) {
  const shape = def.shape as ShoeShape
  const C = def.colors, P = def.pattern
  const r0 = shoeTopRow(shape)
  const sole = shape === 'sneakers' ? (C.main === '#f4f0ff' || C.main === '#ffffff' ? '#d8d0e8' : '#f4f0ff') : darken(C.main, 0.45)
  const second = C.second ?? lighten(C.main, 0.4)
  for (const id of ['leg', 'legFront'] as RegionId[]) rows(g, id, r0, 24, P, C)
  paintPattern(g, REG.shoe[0], REG.shoe[1], 12, 12, P, C)
  paintPattern(g, REG.shoeTop[0], REG.shoeTop[1], 12, 12, P, C)
  fill(g, REG.sole[0], REG.sole[1], 12, 12, sole)
  switch (shape) {
    case 'sneakers':
      for (const id of ['leg', 'legFront'] as RegionId[]) rect(g, id, 0, 23, 12, 1, sole)
      rect(g, 'leg', 2, 21, 7, 1, second); rect(g, 'leg', 7, 20, 2, 1, second)
      rect(g, 'shoe', 0, 9, 12, 3, sole)
      rect(g, 'shoeTop', 2, 3, 8, 1, '#ffffff'); rect(g, 'shoeTop', 2, 6, 8, 1, '#ffffff')
      rect(g, 'legFront', 3, 19, 6, 1, second)
      break
    case 'boots':
      for (const id of ['leg', 'legFront'] as RegionId[]) { rect(g, id, 0, r0, 12, 2, second); rect(g, id, 0, 23, 12, 1, sole) }
      rect(g, 'shoe', 0, 10, 12, 2, sole)
      break
    case 'sandals':
      for (const id of ['leg', 'legFront'] as RegionId[]) {
        if (skin) rect(g, id, 0, 22, 12, 1, skin); else clearRect(g, id, 0, 22, 12, 1)
        rect(g, id, 0, 21, 12, 1, C.main)
        rect(g, id, 0, 23, 12, 1, darken(C.main, 0.2))
      }
      rect(g, 'legFront', 5, 21, 2, 3, C.main)
      break
    case 'skates':
      for (const id of ['leg', 'legFront'] as RegionId[]) { rect(g, id, 0, r0, 12, 2, second); rect(g, id, 0, 23, 12, 1, sole) }
      rect(g, 'legFront', 4, 16, 4, 1, '#ffffff'); rect(g, 'legFront', 4, 19, 4, 1, '#ffffff')
      rect(g, 'shoe', 0, 10, 12, 2, sole)
      break
    case 'party':
      for (const id of ['leg', 'legFront'] as RegionId[]) { rect(g, id, 0, r0, 12, 1, second); rect(g, id, 0, 23, 12, 1, darken(C.main, 0.35)) }
      rect(g, 'shoe', 0, 10, 12, 2, darken(C.main, 0.35))
      break
    case 'ballet':
      // Satin slippers with ribbons crossing up the shin.
      for (const id of ['leg', 'legFront'] as RegionId[]) {
        rect(g, id, 0, 23, 12, 1, darken(C.main, 0.2))
        for (let k = 0; k < 8; k++) { rect(g, id, 2 + k, 12 + k, 1, 1, second); rect(g, id, 9 - k, 12 + k, 1, 1, second) }
      }
      rect(g, 'shoe', 0, 11, 12, 1, darken(C.main, 0.2))
      break
    case 'claws':
      // Scaly monster feet (the big foot and claws are 3D: legPieces).
      for (const id of ['leg', 'legFront'] as RegionId[]) {
        rect(g, id, 0, r0, 12, 1, darken(C.main, 0.2))
        for (const [x, y] of [[2, 19], [7, 20], [4, 22], [9, 22]]) rect(g, id, x!, y!, 2, 1, darken(C.main, 0.15))
      }
      fill(g, REG.sole[0], REG.sole[1], 12, 12, darken(C.main, 0.3))
      break
  }
}

// ---------------------------------------------------------------- 3D pieces

/**
 * Parts for one group, merged by material at `flush`: vertex colours,
 * glowing vertex colours, patterned pieces (per tile) and see-through
 * pieces (per colour).
 */
export class PartSet {
  readonly vc = new Kit()
  readonly glowing = new Kit()
  private pats = new Map<string, { kit: Kit; pattern: Pattern | undefined; colors: Colors }>()
  private glass = new Map<string, { kit: Kit; hex: string; opacity: number }>()
  private flames = new Map<string, Kit>()

  pat(pattern: Pattern | undefined, colors: Colors): Kit {
    if (!pattern || pattern === 'plain') return this.vc
    const key = `${pattern}|${colors.main}|${colors.second ?? ''}|${colors.accent ?? ''}`
    let e = this.pats.get(key)
    if (!e) { e = { kit: new Kit(), pattern, colors }; this.pats.set(key, e) }
    return e.kit
  }

  see(hex: string, opacity: number): Kit {
    const key = `${hex}|${opacity}`
    let e = this.glass.get(key)
    if (!e) { e = { kit: new Kit(), hex, opacity }; this.glass.set(key, e) }
    return e.kit
  }

  /** Unlit additive pieces (flames). */
  flame(hex: string): Kit {
    let k = this.flames.get(hex)
    if (!k) { k = new Kit(); this.flames.set(hex, k) }
    return k
  }

  /** Build meshes into `group`; returns the meshes made. */
  flush(group: THREE.Object3D): THREE.Mesh[] {
    const out: THREE.Mesh[] = []
    const put = (m: THREE.Mesh | null) => { if (m) { group.add(m); out.push(m) } }
    put(this.vc.mesh())
    put(this.glowing.mesh(glowVC()))
    for (const e of this.pats.values()) {
      const geo = e.kit.build()
      if (!geo) continue
      worldUV(geo, patternDensity(e.pattern))
      put(new THREE.Mesh(geo, textureMaterial(patternTile(e.pattern, e.colors))))
    }
    for (const e of this.glass.values()) {
      const geo = e.kit.build()
      if (!geo) continue
      const m = new THREE.Mesh(geo, lambertMaterial(e.hex, { opacity: e.opacity }))
      m.renderOrder = 2
      put(m)
    }
    for (const [hex, k] of this.flames) {
      const geo = k.build()
      if (!geo) continue
      put(new THREE.Mesh(geo, basicMaterial(hex, { additive: true })))
    }
    return out
  }
}

let glowMatRef: THREE.Material | null = null
function glowVC(): THREE.Material {
  if (!glowMatRef) {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true })
    glowMatRef = m
  }
  return glowMatRef
}

/** A box-like frustum: top w1×d1, bottom w2×d2, height h, centred. */
export function frustum(w1: number, d1: number, w2: number, d2: number, h: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, h, 1)
  const p = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) {
    const top = p.getY(i) > 0
    p.setX(i, p.getX(i) * (top ? w1 : w2))
    p.setZ(i, p.getZ(i) * (top ? d1 : d2))
  }
  g.deleteAttribute('normal')
  const ng = g.toNonIndexed()
  ng.computeVertexNormals()
  g.dispose()
  // Back to indexed so it merges with the rest of the kit.
  const n = ng.getAttribute('position').count
  ng.setIndex(Array.from({ length: n }, (_, i) => i))
  return ng
}

// Body measurements the pieces hang on (see avatar.ts).
export const HEAD = { w: 0.64, h: 0.6, d: 0.62 }

/** Pieces worn on the torso (torso-local: y 0 at the hips, 1 at the shoulders, front +z). */
export function torsoPieces(ps: PartSet, look: PersonLook) {
  const top = clothing(look.outfit.top)
  const legsCovered = !!top && coversLegs(top.id)
  const bottom = legsCovered ? undefined : clothing(look.outfit.bottom)
  if (top) {
    const C = top.colors
    const shape = top.shape as TopShape
    if (shape === 'dress' || shape === 'gown') {
      const gown = shape === 'gown'
      const h = gown ? 1.32 : 0.94
      const bw = gown ? 1.86 : 1.46, bd = gown ? 1.24 : 0.94
      ps.pat(top.pattern, C).add(frustum(1.06, 0.56, bw, bd, h), C.main, 0, 0.42 - h / 2, 0)
      ps.vc.add(frustum(bw * 0.985, bd * 0.985, bw + 0.04, bd + 0.04, 0.07), C.second ?? darken(C.main), 0, 0.42 - h + 0.035, 0)
      if (gown) ps.vc.add(frustum(bw * 0.9, bd * 0.9, bw * 0.93, bd * 0.93, 0.05), C.accent ?? lighten(C.main), 0, 0.42 - h + 0.3, 0)
    }
    if (shape === 'hoodie') {
      const k = ps.pat(top.pattern, C)
      k.box(0, 1.06, -0.2, 0.8, 0.2, 0.2, C.main)
      k.box(0, 0.98, -0.33, 0.7, 0.3, 0.08, C.main)
      ps.vc.box(0, 1.02, -0.07, 0.56, 0.06, 0.08, darken(C.main, 0.25))
    }
    if (shape === 'jacket') {
      ps.vc.box(0, 1.03, -0.14, 0.86, 0.12, 0.26, darken(C.main, 0.1))
      ps.vc.box(-0.3, 1.0, 0.16, 0.2, 0.08, 0.22, darken(C.main, 0.1))
      ps.vc.box(0.3, 1.0, 0.16, 0.2, 0.08, 0.22, darken(C.main, 0.1))
    }
    if (shape === 'onesie') {
      // A stubby tail from the lower back (a stinger on a striped suit), spikes up the back on a plain one.
      const k = ps.pat(top.pattern, C)
      k.box(0, 0.14, -0.36, 0.3, 0.24, 0.24, C.main)
      k.box(0, 0.04, -0.54, 0.2, 0.18, 0.2, C.main)
      ps.vc.box(0, -0.02, -0.68, 0.11, 0.11, 0.14, C.second ?? darken(C.main))
      if ((!top.pattern || top.pattern === 'plain') && C.second) {
        for (const y of [0.9, 0.62, 0.34]) ps.vc.cone(0, y, -0.31, 0.07, 0.22, C.second, 4, 0, { x: -0.7, y: Math.PI / 4 })
      }
    }
    if (shape === 'suit') {
      ps.vc.box(0, 1.03, 0, 0.9, 0.1, 0.6, C.second ?? '#2ff3ff')
      ps.vc.box(0, 0.55, -0.32, 0.56, 0.6, 0.16, darken(C.main, 0.08))
      ps.vc.box(-0.16, 0.9, -0.32, 0.12, 0.1, 0.12, C.accent ?? '#ff3b5c')
      ps.vc.box(0.16, 0.9, -0.32, 0.12, 0.1, 0.12, C.second ?? '#2ff3ff')
    }
  }
  if (bottom) {
    const C = bottom.colors
    const shape = bottom.shape as BottomShape
    if (shape === 'skirt') {
      ps.pat(bottom.pattern, C).add(frustum(1.06, 0.56, 1.38, 0.86, 0.56), C.main, 0, 0.22 - 0.28, 0)
      ps.vc.add(frustum(1.36, 0.84, 1.4, 0.88, 0.05), darken(C.main, 0.18), 0, 0.22 - 0.56 + 0.025, 0)
    }
    if (shape === 'tutu') {
      const under = C.second ?? lighten(C.main, 0.5)
      ps.vc.add(frustum(1.06, 0.56, 1.8, 1.3, 0.3), under, 0, 0.1, 0)
      ps.pat(bottom.pattern, C).add(frustum(1.07, 0.57, 1.58, 1.1, 0.28), C.main, 0, 0.17, 0)
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2
        ps.vc.box(Math.cos(a) * 0.82, -0.04, Math.sin(a) * 0.58, 0.14, 0.06, 0.14, under)
      }
    }
  }
}

/** Puff sleeves ride on the arms (arm-local: y 0 at the shoulder pivot). */
export function armPieces(ps: PartSet, look: PersonLook, side: 1 | -1) {
  const top = clothing(look.outfit.top)
  if (!top) return
  if (top.shape === 'dress' || top.shape === 'gown') {
    const big = top.shape === 'gown'
    ps.pat(top.pattern, top.colors).box(side * 0.02, 0.06, 0, big ? 0.62 : 0.58, big ? 0.34 : 0.28, big ? 0.62 : 0.58, top.colors.main)
  }
}

/**
 * Toe caps, sandal soles, skate wheels, dino feet and a mermaid's fins
 * (leg-local: y 0 at the hip, foot at −1; `side` +1 is the leg on +x).
 */
export function legPieces(ps: PartSet, look: PersonLook, side: 1 | -1 = 1): { toe: boolean } {
  if (coversFeet(look.outfit)) {
    // Each leg carries half of the tail fin, flaring out and up.
    const b = clothing(look.outfit.bottom)!
    const fin = b.colors.accent ?? b.colors.second ?? darken(b.colors.main)
    ps.vc.box(side * 0.14, -0.93, -0.04, 0.62, 0.07, 0.46, fin, { z: side * 0.38 })
    ps.vc.box(side * 0.38, -0.82, -0.04, 0.2, 0.07, 0.4, lighten(fin, 0.25), { z: side * 0.38 })
    return { toe: false }
  }
  const s = clothing(look.outfit.shoes)
  if (!s) return { toe: false }
  const C = s.colors
  switch (s.shape as ShoeShape) {
    case 'sandals':
      ps.vc.box(0, -0.985, 0.05, 0.54, 0.05, 0.64, darken(C.main, 0.2))
      return { toe: false }
    case 'skates':
      ps.vc.box(0, -1.05, 0.06, 0.34, 0.06, 0.72, '#5a5285')
      for (const z of [-0.2, 0.3]) for (const x of [-0.14, 0.14]) ps.vc.cyl(x, -1.12, z, 0.08, 0.1, C.second ?? '#ffe14f', 8, { z: Math.PI / 2 })
      ps.vc.box(0, -1.03, 0.43, 0.14, 0.08, 0.06, '#ff3b5c')
      return { toe: true }
    case 'party':
      ps.vc.box(0, -0.8, 0.39, 0.22, 0.08, 0.06, C.second ?? '#ff8ae0')
      ps.vc.box(0, -0.8, 0.4, 0.06, 0.06, 0.06, lighten(C.second ?? '#ff8ae0', 0.4))
      return { toe: true }
    case 'ballet':
      // A little bow on the toe.
      ps.vc.box(0, -0.8, 0.42, 0.16, 0.07, 0.04, C.second ?? '#ff8ae0')
      ps.vc.box(0, -0.8, 0.43, 0.05, 0.05, 0.04, lighten(C.second ?? '#ff8ae0', 0.3))
      return { toe: true }
    case 'claws': {
      // A big blocky foot with three claws.
      ps.vc.box(0, -0.9, 0.1, 0.6, 0.22, 0.78, C.main)
      ps.vc.box(0, -0.78, 0.02, 0.56, 0.06, 0.5, darken(C.main, 0.12))
      for (const x of [-0.18, 0, 0.18]) ps.vc.cone(x, -0.94, 0.56, 0.06, 0.16, C.second ?? '#fff4ff', 4, 0, { x: Math.PI / 2 })
      return { toe: false }
    }
    default:
      return { toe: true }
  }
}

/** Extra lift for the whole body (skates stand on wheels; not under a mermaid tail). */
export function bodyLift(look: PersonLook): number {
  return clothing(look.outfit.shoes)?.shape === 'skates' && !coversFeet(look.outfit) ? 0.17 : 0
}

// ---------------------------------------------------------------- hats

/** How a hat treats the hair: hide all, hide the top layer and volume, hide volume, or keep it. */
export function hatHides(shape: HatShape | undefined): 'all' | 'top' | 'volume' | 'none' {
  switch (shape) {
    case 'helmet': return 'all'
    case 'beanie': case 'dino': return 'top'
    case 'cap': case 'sunhat': case 'wizard': case 'pirate': case 'witch': case 'headphones': return 'volume'
    default: return 'none'
  }
}

type HatBuilder = (ps: PartSet, def: ClothingDef, top: number) => void

/** Head-local builders: y 0 at the neck, the head's top at 0.6, `top` = the hair's top. */
export const HAT_BUILDERS: Record<HatShape, HatBuilder> = {
  cap(ps, d, top) {
    const C = d.colors
    const y = Math.max(top, 0.62)
    ps.vc.box(0, y - 0.02, -0.01, 0.72, 0.18, 0.7, C.main)
    ps.vc.box(0, y + 0.1, -0.02, 0.56, 0.08, 0.56, C.main)
    ps.vc.box(0, y - 0.1, 0.46, 0.62, 0.05, 0.34, C.second ?? darken(C.main))
    ps.vc.box(0, y + 0.02, 0.36, 0.2, 0.1, 0.02, C.second ?? '#ffffff')
    ps.vc.box(0, y + 0.15, 0, 0.1, 0.04, 0.1, C.second ?? darken(C.main))
  },
  beanie(ps, d) {
    const C = d.colors
    ps.pat(d.pattern, C).box(0, 0.66, -0.01, 0.72, 0.3, 0.7, C.main)
    ps.pat(d.pattern, C).box(0, 0.84, -0.01, 0.6, 0.08, 0.58, C.main)
    ps.vc.box(0, 0.5, -0.01, 0.74, 0.1, 0.72, C.second ?? darken(C.main))
    ps.vc.box(0, 0.95, 0, 0.18, 0.16, 0.18, C.second ?? '#ffffff')
  },
  bow(ps, d, top) {
    const C = d.colors
    const y = top + 0.06, z = 0.1, x = 0.18
    ps.vc.box(x - 0.13, y + 0.02, z, 0.2, 0.18, 0.08, C.main, { z: 0.25 })
    ps.vc.box(x + 0.13, y + 0.02, z, 0.2, 0.18, 0.08, C.main, { z: -0.25 })
    ps.vc.box(x, y, z + 0.01, 0.09, 0.09, 0.1, darken(C.main, 0.2))
    ps.vc.box(x - 0.07, y - 0.1, z, 0.06, 0.12, 0.06, C.main, { z: -0.3 })
  },
  flowers(ps, d, top) {
    const C = d.colors
    const y = Math.max(0.6, top - 0.04)
    const petals = [C.second ?? '#ff8ae0', C.accent ?? '#ffe14f', '#ffffff', C.second ?? '#ff8ae0']
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      const x = Math.sin(a) * 0.38, z = Math.cos(a) * 0.37
      ps.vc.box(x, y, z, 0.1, 0.06, 0.1, C.main, { y: a })
      if (i % 2 === 0) {
        ps.vc.box(x, y + 0.05, z, 0.14, 0.08, 0.14, petals[(i / 2) % petals.length]!, { y: a + 0.4 })
        ps.vc.box(x, y + 0.08, z, 0.06, 0.04, 0.06, C.accent ?? '#ffe14f', { y: a })
      }
    }
  },
  tiara(ps, d, top) {
    const C = d.colors
    const y = Math.max(0.62, top - 0.04), z = 0.3
    ps.vc.box(0, y, z - 0.08, 0.6, 0.05, 0.08, C.main)
    ps.vc.box(-0.3, y, z - 0.3, 0.05, 0.05, 0.44, C.main)
    ps.vc.box(0.3, y, z - 0.3, 0.05, 0.05, 0.44, C.main)
    for (const [x, h] of [[-0.2, 0.1], [0, 0.18], [0.2, 0.1]] as const) ps.vc.box(x, y + h / 2, z - 0.08, 0.06, h, 0.05, C.main)
    ps.glowing.box(0, y + 0.1, z - 0.05, 0.08, 0.08, 0.04, C.accent ?? '#ff8ae0')
    ps.glowing.box(-0.2, y + 0.07, z - 0.05, 0.05, 0.05, 0.04, C.accent ?? '#ff8ae0')
    ps.glowing.box(0.2, y + 0.07, z - 0.05, 0.05, 0.05, 0.04, C.accent ?? '#ff8ae0')
  },
  crown(ps, d, top) {
    const C = d.colors
    const y = Math.max(0.64, top - 0.02), s = 0.5, h = 0.16
    const gold = C.main
    ps.vc.box(0, y + h / 2, s / 2, s + 0.06, h, 0.06, gold)
    ps.vc.box(0, y + h / 2, -s / 2, s + 0.06, h, 0.06, gold)
    ps.vc.box(s / 2, y + h / 2, 0, 0.06, h, s, gold)
    ps.vc.box(-s / 2, y + h / 2, 0, 0.06, h, s, gold)
    ps.vc.box(0, y + 0.05, 0, s, 0.08, s, darken(C.accent ?? '#b01874', 0.3))
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const big = x === 0 || z === 0
      ps.vc.box(x * s / 2, y + h + (big ? 0.06 : 0.04), z * s / 2, 0.08, big ? 0.12 : 0.08, 0.08, gold)
    }
    ps.glowing.box(0, y + h / 2, s / 2 + 0.035, 0.1, 0.08, 0.02, C.accent ?? '#ff3b5c')
    ps.glowing.box(-0.17, y + h / 2, s / 2 + 0.035, 0.05, 0.05, 0.02, lighten(C.accent ?? '#ff3b5c', 0.3))
    ps.glowing.box(0.17, y + h / 2, s / 2 + 0.035, 0.05, 0.05, 0.02, lighten(C.accent ?? '#ff3b5c', 0.3))
  },
  bunny(ps, d, top) {
    const C = d.colors
    const y = Math.max(0.62, top - 0.02)
    ps.vc.box(0, y + 0.02, 0.02, 0.7, 0.05, 0.08, C.main)
    for (const s of [-1, 1]) {
      ps.vc.box(s * 0.15, y + 0.26, 0.02, 0.14, 0.46, 0.07, C.main, { z: -s * 0.12 })
      ps.vc.box(s * 0.15 - s * 0.01, y + 0.25, 0.06, 0.07, 0.34, 0.02, C.second ?? '#ffb0d8', { z: -s * 0.12 })
    }
  },
  cat(ps, d, top) {
    const C = d.colors
    const y = Math.max(0.62, top - 0.02)
    ps.vc.box(0, y + 0.02, 0.02, 0.7, 0.05, 0.08, C.main)
    for (const s of [-1, 1]) {
      ps.vc.cone(s * 0.22, y + 0.13, 0.02, 0.15, 0.24, C.main, 4, 0, { y: Math.PI / 4, z: -s * 0.12 })
      ps.vc.cone(s * 0.22, y + 0.11, 0.07, 0.08, 0.14, C.second ?? '#ff8ae0', 4, 0, { y: Math.PI / 4, z: -s * 0.12 })
    }
  },
  wizard(ps, d, top) {
    const C = d.colors
    const y = Math.max(0.62, top - 0.02)
    const k = ps.pat(d.pattern, C)
    k.cyl(0, y, 0, 0.56, 0.05, C.main, 8)
    k.cone(0, y + 0.36, 0, 0.36, 0.7, C.main, 6)
    k.cone(0.06, y + 0.76, -0.04, 0.12, 0.2, C.main, 6, 0, { z: -0.5 })
    ps.vc.cyl(0, y + 0.06, 0, 0.37, 0.07, C.second ?? '#ffe14f', 6)
  },
  helmet(ps, d) {
    const C = d.colors
    ps.see(lighten(C.second ?? '#8fd8ff', 0.5), 0.16).box(0, 0.33, 0.02, 0.9, 0.84, 0.88, C.second ?? '#8fd8ff')
    ps.vc.box(0, -0.03, 0, 0.94, 0.1, 0.8, C.main)
    ps.vc.box(0, 0.78, 0, 0.5, 0.06, 0.5, C.main)
    ps.vc.box(0.45, 0.33, 0, 0.06, 0.3, 0.3, C.main)
    ps.vc.box(-0.45, 0.33, 0, 0.06, 0.3, 0.3, C.main)
    ps.vc.box(0.3, 0.92, -0.1, 0.03, 0.26, 0.03, '#5a5285')
    ps.glowing.box(0.3, 1.07, -0.1, 0.07, 0.07, 0.07, C.accent ?? '#ff3b5c')
  },
  party(ps, d, top) {
    const C = d.colors
    const y = Math.max(0.62, top - 0.04)
    ps.pat(d.pattern, C).cone(0.04, y + 0.24, 0, 0.22, 0.48, C.main, 8, 0, { z: -0.12 })
    ps.vc.box(0.1, y + 0.5, 0, 0.13, 0.13, 0.13, C.second ?? '#ff3b5c')
    ps.vc.box(0.13, y + 0.56, 0.03, 0.08, 0.08, 0.08, lighten(C.second ?? '#ff3b5c', 0.3))
  },
  sunhat(ps, d, top) {
    const C = d.colors
    const y = Math.max(0.62, top - 0.04)
    ps.vc.cyl(0, y, 0, 0.68, 0.05, C.main, 12)
    ps.vc.cyl(0, y + 0.13, 0, 0.38, 0.24, C.main, 10)
    ps.vc.cyl(0, y + 0.07, 0, 0.39, 0.08, C.second ?? '#ff8ae0', 10)
    ps.vc.box(0.3, y + 0.08, 0.3, 0.12, 0.12, 0.06, C.second ?? '#ff8ae0', { y: 0.8 })
  },
  unicorn(ps, d, top) {
    const C = d.colors
    const y = Math.max(0.6, Math.min(top, 0.7))
    ps.pat(d.pattern ?? 'rainbow', C).cone(0, y + 0.18, 0.2, 0.1, 0.42, C.main, 6, 0, { x: 0.35 })
    ps.vc.box(0, y - 0.02, 0.18, 0.2, 0.06, 0.14, C.main)
    for (const s of [-1, 1]) {
      ps.vc.cone(s * 0.26, y + 0.06, -0.02, 0.09, 0.16, C.main, 4, 0, { y: Math.PI / 4, z: -s * 0.25 })
      ps.vc.box(s * 0.12, y + 0.02, 0.26, 0.07, 0.07, 0.04, C.accent ?? '#ffe14f')
    }
    ps.vc.box(-0.12, y + 0.08, 0.3, 0.06, 0.06, 0.04, C.second ?? '#ff8ae0')
  },
  pirate(ps, d, top) {
    // A captain's bicorne: a stepped half-moon across the head, gold trim, a skull.
    const C = d.colors
    const y = Math.max(top, 0.62) - 0.04
    ps.vc.box(0, y + 0.05, -0.01, 0.7, 0.12, 0.68, C.main)
    for (const [w, h, yy] of [[1.16, 0.14, 0.1], [0.96, 0.14, 0.24], [0.66, 0.12, 0.37]] as const) ps.vc.box(0, y + yy, 0, w, h, 0.34, C.main)
    ps.vc.box(0, y + 0.04, 0.175, 1.16, 0.04, 0.02, C.second ?? '#ffd23f')
    ps.vc.box(0, y + 0.04, -0.175, 1.16, 0.04, 0.02, C.second ?? '#ffd23f')
    ps.vc.voxels(SKULL_PX, { '#': C.accent ?? '#ffffff' }, 0, y + 0.24, 0.18, 0.035, 0.02)
  },
  witch(ps, d, top) {
    // A wide brim, a buckled band and a tall hat whose tip bends over.
    const C = d.colors
    const y = Math.max(0.62, top - 0.02)
    ps.vc.cyl(0, y, 0, 0.74, 0.05, C.main, 12)
    ps.vc.cyl(0, y + 0.08, 0, 0.35, 0.12, C.second ?? '#9fef5a', 8)
    ps.vc.cone(0, y + 0.34, 0, 0.34, 0.56, C.main, 8, 0.45)
    ps.vc.cone(-0.05, y + 0.7, -0.02, 0.17, 0.3, C.main, 8, 0.4, { z: 0.35 })
    ps.vc.cone(-0.2, y + 0.86, -0.02, 0.08, 0.26, C.main, 6, 0, { z: 1.2 })
    ps.vc.box(0, y + 0.08, 0.35, 0.16, 0.14, 0.03, C.accent ?? '#ffd23f')
    ps.vc.box(0, y + 0.08, 0.36, 0.07, 0.06, 0.03, C.second ?? '#9fef5a')
  },
  dino(ps, d) {
    // A dinosaur hood round the head, open at the face: jaw with teeth over the forehead, eyes on top, spikes down the back.
    const C = d.colors
    const k = ps.pat(d.pattern, C)
    k.box(0, 0.71, -0.02, 0.8, 0.16, 0.78, C.main)
    for (const s of [-1, 1]) k.box(s * 0.375, 0.36, -0.02, 0.06, 0.64, 0.78, C.main)
    k.box(0, 0.36, -0.385, 0.8, 0.64, 0.06, C.main)
    ps.vc.box(0, 0.64, 0.4, 0.8, 0.14, 0.2, C.main)
    ps.vc.box(0, 0.58, 0.4, 0.74, 0.03, 0.18, '#ff8a9a')
    for (const x of [-0.28, -0.14, 0, 0.14, 0.28]) ps.vc.cone(x, 0.52, 0.46, 0.045, 0.1, C.accent ?? '#ffffff', 4, 0, { x: Math.PI })
    for (const s of [-1, 1]) {
      ps.vc.box(s * 0.19, 0.83, 0.26, 0.15, 0.12, 0.14, '#ffffff')
      ps.vc.box(s * 0.19, 0.84, 0.335, 0.06, 0.07, 0.02, '#2a2230')
    }
    const spike = C.second ?? darken(C.main)
    for (const z of [0.08, -0.14, -0.34]) ps.vc.cone(0, 0.86, z, 0.08, 0.18, spike, 4)
    for (const y of [0.56, 0.34, 0.12]) ps.vc.cone(0, y, -0.46, 0.08, 0.18, spike, 4, 0, { x: -Math.PI / 2 })
  },
  antennae(ps, d, top) {
    // A headband with two feelers and a ball on each.
    const C = d.colors
    const y = Math.max(0.62, top - 0.02)
    ps.vc.box(0, y + 0.02, 0.02, 0.7, 0.05, 0.08, C.main)
    for (const s of [-1, 1]) {
      ps.vc.box(s * 0.14, y + 0.22, 0.04, 0.04, 0.4, 0.04, C.main, { z: -s * 0.35 })
      ps.vc.ball(s * 0.21, y + 0.44, 0.04, 0.08, C.second ?? '#ffd23f')
    }
  },
  headphones(ps, d, top) {
    // A band over the hair and two big cups with a light on each.
    const C = d.colors
    const y = top + 0.04
    ps.vc.box(0, y, 0, 0.78, 0.06, 0.12, C.main)
    for (const s of [-1, 1]) {
      ps.vc.box(s * 0.39, (y + 0.36) / 2, 0, 0.06, y - 0.36, 0.12, C.main)
      ps.vc.box(s * 0.4, 0.3, 0, 0.14, 0.26, 0.26, C.second ?? '#2a2230')
      ps.vc.box(s * 0.44, 0.3, 0, 0.06, 0.2, 0.2, C.main)
      ps.glowing.box(s * 0.475, 0.3, 0, 0.01, 0.08, 0.08, C.accent ?? '#2ff3ff')
    }
  },
  starcrown(ps, d, top) {
    // A thin gold band with five stars standing round it.
    const C = d.colors
    const y = Math.max(0.62, top - 0.04)
    ps.vc.cyl(0, y + 0.03, 0, 0.37, 0.06, C.second ?? C.main, 10)
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      ps.vc.voxels(STAR_PX, { '#': C.main }, Math.sin(a) * 0.34, y + 0.18, Math.cos(a) * 0.34, 0.05, 0.04, a)
    }
    ps.glowing.box(0, y + 0.18, 0.365, 0.05, 0.05, 0.01, C.accent ?? '#ff8ae0')
  },
}

// ---------------------------------------------------------------- face items

const EYE_X = 0.13, EYE_Y = 0.31, FACE_Z = HEAD.d / 2

const HEART_PX = ['##.##', '#####', '#####', '.###.', '..#..']
const STAR_PX = ['..#..', '.###.', '#####', '.###.', '.#.#.']
const SKULL_PX = ['.###.', '#.#.#', '#####', '.#.#.']
const BOWTIE_PX = ['#.....#', '##...##', '###o###', '##...##', '#.....#']
const MASK_PX = [
  '###############',
  '###..#####..###',
  '###..#####..###',
  '###############',
]

type FaceBuilder = (ps: PartSet, def: ClothingDef) => void
export const FACE_BUILDERS: Record<FaceShape, FaceBuilder> = {
  round(ps, d) {
    const c = d.colors.main, z = FACE_Z + 0.03
    for (const s of [-1, 1]) {
      const x = s * EYE_X
      ps.vc.box(x, EYE_Y + 0.085, z, 0.2, 0.03, 0.03, c)
      ps.vc.box(x, EYE_Y - 0.085, z, 0.2, 0.03, 0.03, c)
      ps.vc.box(x - 0.085, EYE_Y, z, 0.03, 0.2, 0.03, c)
      ps.vc.box(x + 0.085, EYE_Y, z, 0.03, 0.2, 0.03, c)
      ps.vc.box(s * 0.33, EYE_Y + 0.07, 0.08, 0.02, 0.03, 0.44, c)
    }
    ps.see('#dff6ff', 0.35).box(0, EYE_Y, z, 0.44, 0.15, 0.01, '#ffffff')
    ps.vc.box(0, EYE_Y + 0.05, z, 0.08, 0.03, 0.03, c)
  },
  shades(ps, d) {
    const c = d.colors.main, z = FACE_Z + 0.03
    for (const s of [-1, 1]) {
      ps.vc.box(s * EYE_X, EYE_Y, z, 0.22, 0.13, 0.03, c)
      ps.vc.box(s * 0.33, EYE_Y + 0.04, 0.08, 0.02, 0.03, 0.44, c)
      ps.glowing.box(s * EYE_X - 0.05, EYE_Y + 0.03, z + 0.016, 0.05, 0.03, 0.005, d.colors.second ?? '#4fb8ff')
    }
    ps.vc.box(0, EYE_Y + 0.04, z, 0.06, 0.03, 0.03, c)
  },
  hearts(ps, d) {
    const z = FACE_Z + 0.03
    for (const s of [-1, 1]) ps.vc.voxels(HEART_PX, { '#': d.colors.main }, s * EYE_X, EYE_Y, z, 0.045, 0.03)
    for (const s of [-1, 1]) ps.vc.box(s * 0.33, EYE_Y + 0.05, 0.08, 0.02, 0.03, 0.44, d.colors.main)
    ps.vc.box(0, EYE_Y + 0.05, z, 0.06, 0.03, 0.03, d.colors.main)
    ps.see(d.colors.second ?? '#ffb0d8', 0.5).box(0, EYE_Y, z - 0.005, 0.02, 0.02, 0.01, '#ffffff')
  },
  stars(ps, d) {
    const z = FACE_Z + 0.03
    for (const s of [-1, 1]) ps.vc.voxels(STAR_PX, { '#': d.colors.main }, s * EYE_X, EYE_Y, z, 0.05, 0.03)
    for (const s of [-1, 1]) ps.vc.box(s * EYE_X, EYE_Y, z + 0.018, 0.05, 0.05, 0.01, d.colors.second ?? '#ff9f3f')
    for (const s of [-1, 1]) ps.vc.box(s * 0.33, EYE_Y + 0.05, 0.08, 0.02, 0.03, 0.44, d.colors.main)
    ps.vc.box(0, EYE_Y + 0.04, z, 0.06, 0.03, 0.03, d.colors.main)
  },
  mask(ps, d) {
    const c = d.colors.main
    ps.vc.voxels(MASK_PX, { '#': c }, 0, EYE_Y + 0.01, FACE_Z + 0.02, 0.046, 0.03)
    for (const s of [-1, 1]) ps.vc.box(s * 0.335, EYE_Y + 0.01, 0, 0.03, 0.18, 0.64, c)
    ps.vc.box(0, EYE_Y + 0.01, -0.325, 0.66, 0.18, 0.03, c)
    ps.vc.box(-0.08, EYE_Y - 0.12, -0.36, 0.06, 0.22, 0.04, c, { z: 0.3 })
    ps.vc.box(0.08, EYE_Y - 0.12, -0.36, 0.06, 0.22, 0.04, c, { z: -0.3 })
  },
  eyepatch(ps, d) {
    // A pirate's patch over the right eye (the person's right is −x) and a strap round the head.
    const c = d.colors.main, z = FACE_Z + 0.02
    ps.vc.box(-EYE_X, EYE_Y, z, 0.19, 0.17, 0.03, c)
    ps.vc.box(0.08, EYE_Y + 0.09, z - 0.005, 0.5, 0.03, 0.02, c, { z: 0.22 })
    for (const s of [-1, 1]) ps.vc.box(s * 0.335, EYE_Y + 0.12, 0, 0.03, 0.03, 0.64, c)
    ps.vc.box(0, EYE_Y + 0.12, -0.325, 0.66, 0.03, 0.03, c)
  },
  bowtie(ps, d) {
    // Under the chin, on the collar.
    ps.vc.voxels(BOWTIE_PX, { '#': d.colors.main, o: d.colors.second ?? darken(d.colors.main) }, 0, -0.09, 0.28, 0.04, 0.05)
  },
  necklace(ps, d) {
    // Pearls round the neck, hanging on the chest, a heart pendant.
    const c = d.colors.main
    for (let i = 0; i <= 8; i++) {
      const x = -0.28 + i * 0.07
      ps.vc.ball(x, -0.03 - 0.16 * (1 - (x / 0.3) ** 2), 0.275, 0.035, c)
    }
    for (const s of [-1, 1]) for (const z of [0.14, 0, -0.14]) ps.vc.ball(s * 0.3, 0.02, z, 0.035, c)
    ps.vc.voxels(HEART_PX, { '#': d.colors.second ?? '#ff8ae0' }, 0, -0.26, 0.285, 0.026, 0.03)
  },
  nose(ps, d) {
    // An animal nose and whiskers.
    const z = FACE_Z + 0.02
    ps.vc.box(0, 0.22, z + 0.01, 0.12, 0.07, 0.05, d.colors.main)
    ps.vc.box(0, 0.19, z + 0.01, 0.06, 0.03, 0.05, d.colors.main)
    for (const s of [-1, 1]) for (const k of [-1, 0, 1]) {
      ps.vc.box(s * 0.2, 0.2 + k * 0.035, z, 0.2, 0.014, 0.01, d.colors.second ?? '#2a2230', { z: s * k * 0.18 })
    }
  },
}

// ---------------------------------------------------------------- back items

/** A back item's moving parts; `pivots` animate (cape flap, wing flutter, tail wag, flames). */
export interface BackRig {
  group: THREE.Group
  kind: BackShape
  pivots: THREE.Object3D[]
  flames: THREE.Object3D[]
}

const WING_PX = [
  '..######....',
  '.#oooooo##..',
  '#oooooooo#..',
  '#ooooooooo#.',
  '.#ooooooooo#',
  '..##oooooo#.',
  '....######..',
]
const WING_LOW = [
  '.####..',
  '#oooo#.',
  '#ooooo#',
  '.#oooo#',
  '..####.',
]
/** A dragon's wing, spine on the left: a bone along the top, the membrane scalloped below. */
const BAT_PX = [
  '.........###',
  '......####oo',
  '...####ooooo',
  '####oooooooo',
  '#ooooooooooo',
  '#oooooo.oooo',
  '.ooo....ooo.',
  '..o......o..',
]
const BEE_UP = ['.####.', '#oooo#', '#oooo#', '#oooo#', '.####.']
const BEE_LOW = ['.###.', '#ooo#', '.###.']
const mirror = (rows: string[]) => rows.map(r => r.split('').reverse().join(''))

/**
 * Back items in torso-local space (the back face at z −0.25). Each gets its
 * own group of pivots so the avatar can sway them.
 */
export function buildBack(def: ClothingDef): BackRig {
  const group = new THREE.Group()
  const shape = def.shape as BackShape
  const C = def.colors
  const rig: BackRig = { group, kind: shape, pivots: [], flames: [] }
  const add = (ps: PartSet, parent: THREE.Object3D) => ps.flush(parent)
  switch (shape) {
    case 'backpack': {
      const ps = new PartSet()
      ps.vc.box(0, 0.5, -0.43, 0.7, 0.72, 0.34, C.main)
      ps.vc.box(0, 0.36, -0.62, 0.5, 0.32, 0.06, C.second ?? darken(C.main))
      ps.vc.box(0, 0.54, -0.63, 0.34, 0.04, 0.04, '#ffe14f')
      ps.vc.box(0, 0.87, -0.43, 0.6, 0.06, 0.3, darken(C.main, 0.15))
      for (const s of [-1, 1]) {
        ps.vc.box(s * 0.26, 0.97, -0.02, 0.12, 0.05, 0.54, C.second ?? darken(C.main))
        ps.vc.box(s * 0.26, 0.72, 0.265, 0.12, 0.5, 0.04, C.second ?? darken(C.main))
      }
      add(ps, group)
      break
    }
    case 'cape': {
      const pivot = new THREE.Group()
      pivot.position.set(0, 1.0, -0.28)
      const ps = new PartSet()
      ps.pat(def.pattern, C).box(0, -0.66, -0.02, 0.96, 1.32, 0.04, C.main)
      ps.vc.box(0, -0.66, 0.005, 0.92, 1.28, 0.02, C.second ?? darken(C.main))
      ps.vc.box(0, -0.02, 0.02, 1.02, 0.1, 0.1, C.second ?? darken(C.main))
      add(ps, pivot)
      const clasp = new PartSet()
      clasp.vc.box(0, 0.96, 0.27, 0.14, 0.1, 0.04, C.accent ?? '#ffd23f')
      clasp.vc.box(-0.28, 0.99, 0.02, 0.1, 0.06, 0.52, C.second ?? darken(C.main))
      clasp.vc.box(0.28, 0.99, 0.02, 0.1, 0.06, 0.52, C.second ?? darken(C.main))
      add(clasp, group)
      group.add(pivot)
      rig.pivots.push(pivot)
      break
    }
    case 'fairy': {
      const edge = C.second ?? '#ff8ae0'
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group()
        pivot.position.set(s * 0.1, 0.62, -0.3)
        const ps = new PartSet()
        const k = ps.see(C.main, 0.72)
        // Wing maps drawn outward from the spine.
        const up = s > 0 ? WING_PX : WING_PX.map(r => r.split('').reverse().join(''))
        const lo = s > 0 ? WING_LOW : WING_LOW.map(r => r.split('').reverse().join(''))
        k.voxels(up.map(r => r.replace(/#/g, '.')), { o: C.main }, s * 0.38, 0.22, 0, 0.07, 0.02)
        ps.vc.voxels(up.map(r => r.replace(/o/g, '.')), { '#': edge }, s * 0.38, 0.22, 0, 0.07, 0.03)
        k.voxels(lo.map(r => r.replace(/#/g, '.')), { o: C.main }, s * 0.24, -0.18, 0, 0.07, 0.02)
        ps.vc.voxels(lo.map(r => r.replace(/o/g, '.')), { '#': edge }, s * 0.24, -0.18, 0, 0.07, 0.03)
        ps.glowing.box(s * 0.5, 0.3, 0.02, 0.05, 0.05, 0.02, '#ffffff')
        ps.glowing.box(s * 0.28, 0.1, 0.02, 0.04, 0.04, 0.02, '#fff4a0')
        ps.glowing.box(s * 0.3, -0.2, 0.02, 0.04, 0.04, 0.02, '#ffffff')
        add(ps, pivot)
        pivot.rotation.y = s * 0.35
        pivot.userData.side = s
        group.add(pivot)
        rig.pivots.push(pivot)
      }
      break
    }
    case 'tail': {
      const pivot = new THREE.Group()
      pivot.position.set(0, 0.12, -0.27)
      const ps = new PartSet()
      const segs = [[0, -0.02, -0.1, 0.16], [0, -0.06, -0.26, 0.16], [0, 0.02, -0.42, 0.16], [0, 0.18, -0.52, 0.16], [0, 0.36, -0.56, 0.16], [0, 0.54, -0.54, 0.16], [0, 0.68, -0.48, 0.18]]
      segs.forEach(([x, y, z, s], i) => ps.vc.box(x!, y!, z!, s!, s!, s!, i === segs.length - 1 ? (C.second ?? lighten(C.main)) : C.main))
      add(ps, pivot)
      group.add(pivot)
      rig.pivots.push(pivot)
      break
    }
    case 'jetpack': {
      const ps = new PartSet()
      for (const s of [-1, 1]) {
        ps.vc.cyl(s * 0.18, 0.55, -0.42, 0.15, 0.62, C.main, 8)
        ps.vc.cone(s * 0.18, 0.93, -0.42, 0.15, 0.16, C.second ?? '#ff3b5c', 8)
        ps.vc.cyl(s * 0.18, 0.2, -0.42, 0.09, 0.1, '#5a5285', 8)
        ps.vc.box(s * 0.36, 0.3, -0.42, 0.06, 0.24, 0.2, C.accent ?? '#ffd23f')
      }
      ps.vc.box(0, 0.6, -0.3, 0.32, 0.5, 0.12, darken(C.main, 0.15))
      ps.glowing.box(0, 0.7, -0.37, 0.1, 0.1, 0.02, '#6fe07f')
      for (const s of [-1, 1]) {
        ps.vc.box(s * 0.26, 0.97, -0.02, 0.1, 0.05, 0.54, '#5a5285')
        ps.vc.box(s * 0.26, 0.72, 0.265, 0.1, 0.5, 0.04, '#5a5285')
      }
      add(ps, group)
      for (const s of [-1, 1]) {
        const f = new THREE.Group()
        f.position.set(s * 0.18, 0.14, -0.42)
        const fp = new PartSet()
        fp.flame('#ff9f3f').cone(0, -0.16, 0, 0.1, 0.3, '#ffffff', 5, 0, { x: Math.PI })
        fp.flame('#ffe14f').cone(0, -0.1, 0, 0.055, 0.18, '#ffffff', 5, 0, { x: Math.PI })
        fp.flush(f)
        f.visible = false
        group.add(f)
        rig.flames.push(f)
      }
      break
    }
    case 'bat': {
      // Two dragon wings that flap slowly (avatar.ts), bones in the second colour.
      const bone = C.second ?? darken(C.main, 0.3)
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group()
        pivot.position.set(s * 0.12, 0.74, -0.3)
        const ps = new PartSet()
        const map = s > 0 ? BAT_PX : mirror(BAT_PX)
        ps.vc.voxels(map.map(r => r.replace(/#/g, '.')), { o: C.main }, s * 0.46, 0.08, 0, 0.075, 0.03)
        ps.vc.voxels(map.map(r => r.replace(/o/g, '.')), { '#': bone }, s * 0.46, 0.08, 0.005, 0.075, 0.045)
        ps.vc.box(s * 0.9, 0.42, 0, 0.06, 0.1, 0.05, C.accent ?? '#ffe14f')
        add(ps, pivot)
        pivot.rotation.y = s * 0.35
        pivot.userData.side = s
        group.add(pivot)
        rig.pivots.push(pivot)
      }
      break
    }
    case 'bee': {
      // Two pairs of small see-through wings that buzz (avatar.ts).
      const edge = C.second ?? '#2a2230'
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group()
        pivot.position.set(s * 0.1, 0.7, -0.3)
        const ps = new PartSet()
        const k = ps.see(C.main, 0.6)
        const up = s > 0 ? BEE_UP : mirror(BEE_UP)
        const lo = s > 0 ? BEE_LOW : mirror(BEE_LOW)
        k.voxels(up.map(r => r.replace(/#/g, '.')), { o: C.main }, s * 0.24, 0.16, 0, 0.07, 0.02)
        ps.vc.voxels(up.map(r => r.replace(/o/g, '.')), { '#': edge }, s * 0.24, 0.16, 0, 0.07, 0.03)
        k.voxels(lo.map(r => r.replace(/#/g, '.')), { o: C.main }, s * 0.2, -0.14, 0, 0.07, 0.02)
        ps.vc.voxels(lo.map(r => r.replace(/o/g, '.')), { '#': edge }, s * 0.2, -0.14, 0, 0.07, 0.03)
        add(ps, pivot)
        pivot.rotation.y = s * 0.3
        pivot.userData.side = s
        group.add(pivot)
        rig.pivots.push(pivot)
      }
      break
    }
    case 'shell': {
      // A turtle's shell: a stepped dome, plates in the second colour, a rim and straps in the accent.
      const ps = new PartSet()
      const rim = C.accent ?? darken(C.main, 0.3)
      ps.vc.box(0, 0.5, -0.36, 1.0, 0.96, 0.14, rim)
      ps.vc.box(0, 0.5, -0.47, 0.9, 0.86, 0.1, C.main)
      ps.vc.box(0, 0.5, -0.56, 0.7, 0.68, 0.1, C.main)
      ps.vc.box(0, 0.5, -0.64, 0.44, 0.44, 0.08, C.main)
      const plate = C.second ?? lighten(C.main, 0.3)
      ps.vc.box(0, 0.5, -0.685, 0.28, 0.28, 0.02, plate)
      for (const [x, y] of [[-0.25, 0.75], [0.25, 0.75], [-0.25, 0.25], [0.25, 0.25]]) ps.vc.box(x!, y!, -0.615, 0.18, 0.18, 0.02, plate)
      for (const [x, y] of [[-0.4, 0.5], [0.4, 0.5], [0, 0.9], [0, 0.1]]) ps.vc.box(x!, y!, -0.525, x ? 0.04 : 0.2, x ? 0.2 : 0.04, 0.02, plate)
      for (const s of [-1, 1]) {
        ps.vc.box(s * 0.26, 0.97, -0.02, 0.12, 0.05, 0.54, rim)
        ps.vc.box(s * 0.26, 0.72, 0.265, 0.12, 0.5, 0.04, rim)
      }
      add(ps, group)
      break
    }
  }
  return rig
}

/** Every shape a clothing def may name, per slot, has a builder (for the node test). */
// Records, so a shape added to a type without a case here fails the typecheck.
const TOPS: Record<TopShape, true> = { tee: true, tank: true, hoodie: true, sweater: true, jacket: true, dress: true, gown: true, suit: true, onesie: true, hero: true }
const BOTTOMS: Record<BottomShape, true> = { pants: true, shorts: true, skirt: true, tutu: true, mermaid: true }
const SHOES: Record<ShoeShape, true> = { sneakers: true, boots: true, sandals: true, skates: true, party: true, ballet: true, claws: true }
const BACKS: Record<BackShape, true> = { backpack: true, cape: true, fairy: true, tail: true, jetpack: true, bat: true, bee: true, shell: true }
export const SHAPE_BUILDERS: Record<ClothingSlot, readonly string[]> = {
  top: Object.keys(TOPS),
  bottom: Object.keys(BOTTOMS),
  shoes: Object.keys(SHOES),
  hat: Object.keys(HAT_BUILDERS),
  face: Object.keys(FACE_BUILDERS),
  back: Object.keys(BACKS),
}

