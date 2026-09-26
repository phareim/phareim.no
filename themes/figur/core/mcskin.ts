/**
 * Figure → a real 64 × 64 Minecraft skin (the 1.8+ layout, classic 4-px
 * arms). The Minecraft style draws its front faces, so what the child
 * sees is what the download gives.
 *
 * Head: the face in Minecraft's own manner (2 × 2 eyes, a mouth, cheeks,
 * freckles), hair on the front, top, sides and back per style. Body,
 * arms and legs come from the worn textures (top → body and sleeves,
 * skin where a sleeve stops; bottom → legs; shoes on the lowest rows,
 * boots up the shin; a dress's skirt over the legs). The hat goes into
 * the head's second layer, squashed into the top rows of the face when
 * it is tall. Sides, backs, tops and bottoms take each row's main colour
 * of the front, a little darker. Deterministic and pure.
 */
import { DRESS_SKIRT_ROW, TOP_COLS, type Figure, type FigureBody, type Hex, type Texture } from '../types'
import { shade, tint } from './color'
import { cellNoise } from './pixelart'
import { crop, flipTexture, get, resample, type Px, type Rect } from '../render/pixels'
import { faceColors, hairAt, paintGlasses, skinOf, starColor, tieColor, withDefaults, type Worn2 } from '../render/common'

export const MC = 64

/** The six faces of a box in the skin layout: origin (u, v), width w, height h, depth d. */
export function boxFaces(u: number, v: number, w: number, h: number, d: number) {
  return {
    top: { x: u + d, y: v, w, h: d },
    bottom: { x: u + d + w, y: v, w, h: d },
    right: { x: u, y: v + d, w: d, h },
    front: { x: u + d, y: v + d, w, h },
    left: { x: u + d + w, y: v + d, w: d, h },
    back: { x: u + 2 * d + w, y: v + d, w, h },
  }
}

/** Every part of the skin. "R" is the character's right: the viewer's left in the front view. */
export const PARTS = {
  head: boxFaces(0, 0, 8, 8, 8),
  hat: boxFaces(32, 0, 8, 8, 8),
  body: boxFaces(16, 16, 8, 12, 4),
  jacket: boxFaces(16, 32, 8, 12, 4),
  armR: boxFaces(40, 16, 4, 12, 4),
  armL: boxFaces(32, 48, 4, 12, 4),
  legR: boxFaces(0, 16, 4, 12, 4),
  legL: boxFaces(16, 48, 4, 12, 4),
}

type Grid = Px[]
const grid = (w: number, h: number, c: Px = null): Grid => new Array<Px>(w * h).fill(c)

// ---------------------------------------------------------------- hair

interface HairSpec {
  /** The face: H hair, l light, h shade, t tie, '.' none. */
  front: string[]
  /** Per row, the first column of hair on a side face counted from the face's edge (8 = none). */
  side: number[]
  /** Rows of hair on the back of the head. */
  back: number
}

const HAIRS: Record<FigureBody['hair'], HairSpec> = {
  short: { front: ['HHHHHHHH', 'HHHHHHHH', 'H......H'], side: [0, 0, 0, 2, 3, 4, 8, 8], back: 6 },
  long: { front: ['HHHHHHHH', 'HHHHHHHH', 'HH....HH', 'H......H', 'H......H', 'H......H', 'H......H', 'H......H'], side: [0, 0, 0, 0, 0, 0, 0, 0], back: 8 },
  ponytail: { front: ['HHHHHHHH', 'HHHHHHHH', 'HHHH...H', 'H......H'], side: [0, 0, 0, 2, 3, 3, 8, 8], back: 6 },
  pigtails: { front: ['HHHHHHHH', 'HHHHHHHH', 'H.HHHH.H', 'H......H', 't......t', 'H......H', 'H......H', 'l......l'], side: [0, 0, 0, 1, 1, 1, 1, 1], back: 8 },
  curly: { front: ['HlHHlHHl', 'HHlHHHlH', 'lH.HH.Hl', 'H......H', 'l......l', 'H......H'], side: [0, 0, 0, 0, 1, 1, 2, 8], back: 7 },
  bun: { front: ['HHHllHHH', 'HHHHHHHH', 'H......H'], side: [0, 0, 1, 3, 4, 5, 8, 8], back: 6 },
  spiky: { front: ['lHlHHlHl', 'HHHHHHHH', 'H.H..H.H'], side: [0, 0, 1, 3, 4, 8, 8, 8], back: 5 },
  afro: { front: ['HlHHHlHH', 'HHHlHHHl', 'HHHHHHHH', 'Hl....lH', 'H......H', 'l......l', 'H......H'], side: [0, 0, 0, 0, 0, 1, 1, 2], back: 8 },
  none: { front: [], side: [8, 8, 8, 8, 8, 8, 8, 8], back: 0 },
}

/** Hair colour at skin pixel (X, Y), row r of the head (0..7): a little Minecraft noise. */
function hairPx(body: FigureBody, ch: string, X: number, Y: number, r: number): Hex {
  if (ch === 't') return tieColor(body)
  const c = hairAt(body, r / 8)
  if (ch === 'l') return tint(c, 0.3)
  if (ch === 'h') return shade(c, 0.25)
  const n = cellNoise(X, Y)
  return n < 0.2 ? shade(c, 0.16) : n > 0.86 ? tint(c, 0.22) : c
}

// ---------------------------------------------------------------- the face

/** The head's front face, 8 × 8: skin, eyes, mouth, cheeks, freckles, hair. */
export function headFront(body: FigureBody, blink = false): Grid {
  const sk = skinOf(body)
  const fc = faceColors(body)
  const g = grid(8, 8, sk.c)
  const p = (x: number, y: number, c: Hex) => { if (x >= 0 && x < 8 && y >= 0 && y < 8) g[y * 8 + x] = c }
  // A soft chin shade on the last row.
  for (let x = 1; x < 7; x++) p(x, 7, shade(sk.c, 0.06))

  const iris = body.eyeColor
  const irisD = shade(iris, 0.35)
  const L = 1, R = 5 // left eye cols 1–2, right eye cols 5–6; rows 3–4
  const closed = (x: number) => { p(x, 4, fc.ink); p(x + 1, 4, fc.ink) }
  const round = (x: number, outer: number) => {
    p(outer, 3, fc.white); p(outer, 4, fc.white)
    const inner = outer === x ? x + 1 : x
    p(inner, 3, iris); p(inner, 4, irisD)
  }
  const eye = (x: number, left: boolean) => {
    const outer = left ? x : x + 1
    const inner = left ? x + 1 : x
    switch (body.eyes) {
      case 'round': round(x, outer); break
      case 'sparkle':
        p(outer, 3, tint(iris, 0.25)); p(inner, 3, fc.white); p(outer, 4, iris); p(inner, 4, irisD)
        p(outer, 2, fc.ink)
        break
      case 'happy':
        p(outer, 4, fc.ink); p(inner, 3, fc.ink)
        break
      case 'sleepy':
        p(x, 3, sk.s); p(x + 1, 3, sk.s); p(outer, 4, iris); p(inner, 4, irisD)
        break
      case 'wink':
        if (left) round(x, outer)
        else { p(x, 4, fc.ink); p(x + 1, 4, fc.ink); p(outer, 3, fc.ink) }
        break
      case 'star': {
        const cx = inner
        const st = starColor(iris)
        p(cx, 3, st); p(cx, 4, '#ffffff'); p(outer, 4, st); p(cx, 5, st)
        p(outer, 3, fc.white)
        break
      }
    }
  }
  if (blink) { closed(L); closed(R) } else { eye(L, true); eye(R, false) }

  if (body.cheeks) { p(1, 5, fc.cheek); p(6, 5, fc.cheek) }
  if (body.freckles) { p(2, 5, fc.freckle); p(5, 5, fc.freckle); if (!body.cheeks) { p(1, 5, fc.freckle); p(6, 5, fc.freckle) } }

  switch (body.mouth) {
    case 'smile': p(2, 5, fc.mouth); p(3, 6, fc.mouth); p(4, 6, fc.mouth); p(5, 5, fc.mouth); break
    case 'grin': p(2, 5, fc.mouth); p(3, 5, fc.white); p(4, 5, fc.white); p(5, 5, fc.mouth); p(3, 6, fc.inside); p(4, 6, fc.inside); break
    case 'open': p(3, 5, fc.mouth); p(4, 5, fc.mouth); p(3, 6, fc.inside); p(4, 6, fc.inside); break
    case 'tongue': p(2, 5, fc.mouth); p(3, 6, fc.mouth); p(4, 6, fc.mouth); p(5, 5, fc.mouth); p(4, 7, fc.tongue); break
    case 'small': p(3, 6, fc.mouth); p(4, 6, fc.mouth); break
  }

  const spec = HAIRS[body.hair]
  spec.front.forEach((row, y) => {
    for (let x = 0; x < 8; x++) if (row[x] !== '.') p(x, y, hairPx(body, row[x]!, 8 + x, 8 + y, y))
  })
  return g
}

// ---------------------------------------------------------------- grids

function rowMain(g: Grid, w: number, y: number): Px {
  const n = new Map<Hex, number>()
  let best: Px = null, bestN = 0
  for (let x = 0; x < w; x++) {
    const c = g[y * w + x]
    if (!c) continue
    const k = (n.get(c) ?? 0) + 1
    n.set(c, k)
    if (k > bestN) { best = c; bestN = k }
  }
  return best
}

/** Region of a texture scaled into a w × h grid, empty pixels filled with `under`. */
function fit(tex: Texture, r: Rect, w: number, h: number, under: Px, flip = false): Grid {
  const t = resample(flip ? flipTexture(crop(tex, r)) : tex, flip ? { x: 0, y: 0, w: r.w, h: r.h } : r, w, h)
  return t.px.map(c => c ?? under)
}

/** Put a grid on top of another (painted pixels only), rows from y0. */
function over(dst: Grid, w: number, src: Grid, sw: number, sh: number, x0: number, y0: number): void {
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const c = src[y * sw + x]
    const X = x0 + x, Y = y0 + y
    if (c && X >= 0 && X < w && Y >= 0 && Y * w + X < dst.length) dst[Y * w + X] = c
  }
}

/** A skirt's rows as painted spans: each row's gaps at the edges take the nearest colour, so it covers the legs. */
function solidRows(t: Texture): Texture {
  const px = t.px.slice()
  for (let y = 0; y < t.h; y++) {
    let first = -1, last = -1
    for (let x = 0; x < t.w; x++) if (px[y * t.w + x]) { if (first < 0) first = x; last = x }
    if (first < 0) continue
    for (let x = 0; x < first; x++) px[y * t.w + x] = px[y * t.w + first]!
    for (let x = last + 1; x < t.w; x++) px[y * t.w + x] = px[y * t.w + last]!
  }
  return { w: t.w, h: t.h, px }
}

/** The shoe on a 4 × 12 leg: painted rows at the bottom, boots stretched up the shin. */
function shoeOnLeg(leg: Grid, shoes: Texture, boot: boolean, flip: boolean): void {
  const s = flip ? flipTexture(shoes) : shoes
  let first = s.h
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (s.px[y * s.w + x]) { first = Math.min(first, y) }
  if (first >= s.h) return
  const rows = s.h - first
  const h = boot ? rows + 2 : rows
  const src = boot
    ? resample(s, { x: 0, y: first, w: s.w, h: 1 }, 4, 3).px.concat(resample(s, { x: 0, y: first + 1, w: s.w, h: rows - 1 }, 4, rows - 1).px)
    : resample(s, { x: 0, y: first, w: s.w, h: rows }, 4, rows).px
  over(leg, 4, src, 4, h, 0, 12 - h)
}

// ---------------------------------------------------------------- the hat

/** The hat squashed into the head's second layer: at most three rows on the face, the top filled when it covers the crown. */
export function hatFront(hat: Texture): { front: Grid; rows: number; top: 'none' | 'ring' | 'full' } {
  let top = -1, bottom = -1
  for (let y = 0; y < hat.h; y++) for (let x = 2; x <= 13; x++) if (hat.px[y * hat.w + x]) { if (top < 0) top = y; bottom = y }
  const front = grid(8, 8)
  if (top < 0) return { front, rows: 0, top: 'none' }
  const rows = Math.min(3, bottom - top + 1)
  const r = resample(hat, { x: 2, y: top, w: 12, h: bottom - top + 1 }, 8, rows)
  over(front, 8, r.px, 8, rows, 0, 0)
  const at = (x: number, y: number) => !!hat.px[y * hat.w + x]
  let crown = true
  for (let x = 6; x <= 9; x++) if (!at(x, 6)) crown = false
  let dome = true
  for (const y of [4, 5]) for (let x = 5; x <= 10; x++) if (!at(x, y)) dome = false
  return { front, rows, top: !crown ? 'none' : dome ? 'full' : 'ring' }
}

// ---------------------------------------------------------------- the skin

export interface SkinOpts { blink?: boolean }

/** The figure as a 64 × 64 Minecraft skin (modern layout, classic arms). */
export function minecraftSkin(figure: Figure, worn: Worn2, opts: SkinOpts = {}): Texture {
  const body = figure.body
  const sk = skinOf(body)
  const w = withDefaults(worn)
  const px: Px[] = new Array<Px>(MC * MC).fill(null)
  const put = (r: Rect, g: Grid) => {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const c = g[y * r.w + x]
      if (c !== undefined) px[(r.y + y) * MC + r.x + x] = c
    }
  }
  const fillRows = (r: Rect, from: Grid, fw: number, f: number, flipRows = false) => {
    const g = grid(r.w, r.h)
    for (let y = 0; y < r.h; y++) {
      const c = rowMain(from, fw, flipRows ? r.h - 1 - y : y)
      for (let x = 0; x < r.w; x++) g[y * r.w + x] = c ? shade(c, f) : null
    }
    put(r, g)
  }
  const one = (r: Rect, c: Px) => put(r, grid(r.w, r.h, c))

  // Head.
  const H = PARTS.head
  const face = headFront(body, opts.blink)
  const glasses = w.tex.face
  put(H.front, face)
  if (glasses) {
    const fb = { w: 8, h: 8, px: face.slice() }
    paintGlasses(fb, glasses, { x: 0, y: 2, w: 8, h: 4 })
    put(H.front, fb.px)
  }
  const spec = HAIRS[body.hair]
  const bald = body.hair === 'none'
  const topG = grid(8, 8)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    topG[y * 8 + x] = bald ? tint(sk.c, 0.08) : hairPx(body, body.hair === 'spiky' && (x + y) % 2 ? 'l' : 'H', H.top.x + x, y, 0)
  }
  if (body.hair === 'bun') for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) topG[y * 8 + x] = (x + y) % 3 ? tint(hairAt(body, 0), 0.2) : hairAt(body, 0)
  put(H.top, topG)
  one(H.bottom, sk.s)
  for (const side of ['left', 'right'] as const) {
    const r = H[side]
    const g = grid(8, 8, sk.c)
    for (let y = 0; y < 8; y++) for (let k = 0; k < 8; k++) {
      // k counts from the face's edge; the left face touches the front at its first column, the right at its last.
      const x = side === 'left' ? k : 7 - k
      if (k >= spec.side[y]!) g[y * 8 + x] = hairPx(body, 'H', r.x + x, r.y + y, y)
      else if (k === 3 && y >= 3 && y <= 5) g[y * 8 + x] = sk.s // an ear
    }
    put(r, g)
  }
  const back = grid(8, 8, sk.c)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (y < spec.back) back[y * 8 + x] = hairPx(body, 'H', H.back.x + x, H.back.y + y, y)
  if (body.hair === 'ponytail') {
    for (let y = 3; y < 8; y++) for (const x of [3, 4]) back[y * 8 + x] = hairPx(body, y === 4 ? 't' : 'l', H.back.x + x, H.back.y + y, y)
  }
  if (body.hair === 'bun') for (let y = 0; y < 3; y++) for (let x = 2; x < 6; x++) back[y * 8 + x] = tint(hairAt(body, 0), 0.15)
  put(H.back, back)

  // Body, arms, legs from the top texture (rows 0–13 over 12 rows).
  const top = w.tex.top!
  const torso = fit(top, { x: TOP_COLS.torso[0], y: 0, w: 10, h: DRESS_SKIRT_ROW }, 8, 12, sk.c)
  const armL = fit(top, { x: 0, y: 0, w: 3, h: DRESS_SKIRT_ROW }, 4, 12, sk.c)
  const armR = fit(top, { x: TOP_COLS.armR[0], y: 0, w: 3, h: DRESS_SKIRT_ROW }, 4, 12, sk.c)

  let legL = grid(4, 12, sk.c)
  let legR = grid(4, 12, sk.c)
  if (w.kind.top === 'dress') {
    const skirt = solidRows(crop(top, { x: 0, y: DRESS_SKIRT_ROW, w: 16, h: top.h - DRESS_SKIRT_ROW }))
    const s = resample(skirt, { x: TOP_COLS.torso[0], y: 0, w: 10, h: skirt.h }, 8, 8)
    for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) {
      legL[y * 4 + x] = s.px[y * 8 + x] ?? sk.c
      legR[y * 4 + x] = s.px[y * 8 + 4 + x] ?? sk.c
    }
  } else if (w.tex.bottom) {
    let b = w.tex.bottom
    if (w.kind.bottom === 'skirt') b = solidRows(b)
    legL = fit(b, { x: 0, y: 0, w: 6, h: 12 }, 4, 12, sk.c)
    legR = fit(b, { x: 6, y: 0, w: 6, h: 12 }, 4, 12, sk.c)
  }
  if (w.tex.shoes) {
    shoeOnLeg(legL, w.tex.shoes, w.kind.shoes === 'boot', false)
    shoeOnLeg(legR, w.tex.shoes, w.kind.shoes === 'boot', true)
  }

  // Front faces; sides, backs, tops and bottoms from each row's main colour.
  const limb = (P: ReturnType<typeof boxFaces>, g: Grid) => {
    put(P.front, g)
    fillRows(P.left, g, 4, 0.1)
    fillRows(P.right, g, 4, 0.1)
    fillRows(P.back, g, 4, 0.2)
    one(P.top, rowMain(g, 4, 0))
    const bottom = rowMain(g, 4, 11)
    one(P.bottom, bottom ? shade(bottom, 0.25) : null)
  }
  // The viewer's left arm and leg are the character's right.
  limb(PARTS.armR, armL)
  limb(PARTS.armL, armR)
  limb(PARTS.legR, legL)
  limb(PARTS.legL, legR)

  const B = PARTS.body
  put(B.front, torso)
  fillRows(B.left, torso, 8, 0.1)
  fillRows(B.right, torso, 8, 0.1)
  fillRows(B.back, torso, 8, 0.2)
  one(B.top, rowMain(torso, 8, 0))
  const hem = rowMain(torso, 8, 11)
  one(B.bottom, hem ? shade(hem, 0.25) : null)
  if (w.kind.back === 'cape' && w.tex.back) {
    const cape = fit(w.tex.back, { x: 4, y: 0, w: 12, h: 14 }, 8, 12, null)
    put(B.back, cape.map((c, i) => c ?? px[(B.back.y + Math.floor(i / 8)) * MC + B.back.x + (i % 8)]!))
  }
  if (body.hair === 'long' || body.hair === 'pigtails') {
    // Long hair down the back, on the jacket layer.
    const J = PARTS.jacket.back
    const g = grid(8, 12)
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
      if (y < 3 || (x > 0 && x < 7)) g[y * 8 + x] = hairPx(body, 'H', J.x + x, J.y + y, 7)
    }
    put(J, g)
  }

  // The hat in the second layer.
  if (w.tex.hat) {
    const T = PARTS.hat
    const hf = hatFront(w.tex.hat)
    put(T.front, hf.front)
    const hatGrid = hf.front
    const main = rowMain(hatGrid, 8, 0) ?? rowMain(hatGrid, 8, 1) ?? rowMain(hatGrid, 8, 2)
    for (const side of ['left', 'right'] as const) {
      const g = grid(8, 8)
      for (let y = 0; y < hf.rows; y++) {
        const edge = hatGrid[y * 8 + (side === 'left' ? 7 : 0)]
        if (edge) for (let x = 0; x < 8; x++) g[y * 8 + x] = shade(edge, 0.1)
      }
      put(T[side], g)
    }
    const hb = grid(8, 8)
    for (let y = 0; y < hf.rows; y++) {
      let n = 0
      for (let x = 0; x < 8; x++) if (hatGrid[y * 8 + x]) n++
      const c = rowMain(hatGrid, 8, y)
      if (n >= 6 && c) for (let x = 0; x < 8; x++) hb[y * 8 + x] = shade(c, 0.2)
    }
    put(T.back, hb)
    if (hf.top !== 'none' && main) {
      const g = grid(8, 8)
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const edge = x === 0 || y === 0 || x === 7 || y === 7
        if (hf.top === 'full' || edge) g[y * 8 + x] = edge ? main : tint(main, 0.1)
      }
      put(T.top, g)
    }
  }
  return { w: MC, h: MC, px }
}

/** The skin's front view, 16 × 32 (head, body, arms, legs), then the head's second layer over it. */
export function skinFront(skin: Texture): Texture {
  const px: Px[] = new Array<Px>(16 * 32).fill(null)
  const copy = (r: Rect, x0: number, y0: number) => {
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const c = get(skin, r.x + x, r.y + y)
      if (c) px[(y0 + y) * 16 + x0 + x] = c
    }
  }
  copy(PARTS.head.front, 4, 0)
  copy(PARTS.body.front, 4, 8)
  copy(PARTS.armR.front, 0, 8)
  copy(PARTS.armL.front, 12, 8)
  copy(PARTS.legR.front, 4, 20)
  copy(PARTS.legL.front, 8, 20)
  copy(PARTS.hat.front, 4, 0)
  return { w: 16, h: 32, px }
}
