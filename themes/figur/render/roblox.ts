/**
 * Roblox: the classic blocky avatar, smooth-shaded rather than pixel-
 * textured. A wide head with rounded corners and the classic simple face
 * (two dark ovals and a curved smile, varied per eye and mouth), a boxy
 * torso, arms and legs as separate blocks, each with a soft top light.
 * Clothes are the textures mapped onto the blocks, as Roblox shirts and
 * pants are; skirts and dresses hang straight over the legs. Hats and
 * hair are accessories on the head. A light sky and a grey studded
 * baseplate.
 */
import { DRESS_SKIRT_ROW, type FigureBody, type FigureFrame, type FigureStyle, type Hex, type PixelBuffer, type Texture } from '../types'
import { mix, shade, tint } from '../core/color'
import { colourHair, faceColors, starColor, figureKey, frameOrigin, hopOf, Lru, paintGlasses, skinOf, sparkles, withDefaults } from './common'
import { blit, crop, fillEllipse, fillRect, fillRoundRect, flipTexture, makeBuffer, mapTexture, outline, set, smoothResize, topLight, type Rect } from './pixels'
import { paintRobloxHair } from './roblox-hair'

const SIZE = { w: 56, h: 76 }
const FLOOR = 68
const CX = SIZE.w / 2
const HEAD: Rect = { x: CX - 7, y: 19, w: 14, h: 13 }
const TORSO: Rect = { x: CX - 9, y: 32, w: 18, h: 18 }
const ARM_L: Rect = { x: TORSO.x - 9, y: 32, w: 9, h: 18 }
const ARM_R: Rect = { x: TORSO.x + 18, y: 32, w: 9, h: 18 }
const LEG_L: Rect = { x: CX - 9, y: 50, w: 9, h: 18 }
const LEG_R: Rect = { x: CX, y: 50, w: 9, h: 18 }
const LIGHT = { top: 2, topF: 0.26, bottom: 2, bottomF: 0.2, right: 2, rightF: 0.14, left: 1, leftF: 0.1 }

// ---------------------------------------------------------------- face

function face(b: PixelBuffer, body: FigureBody, blink: boolean): void {
  const fc = faceColors(body)
  const ink = mix(body.eyeColor, '#101016', 0.78)
  const ey = HEAD.y + 4
  const L = HEAD.x + 3, R = HEAD.x + 9 // left columns of the two eyes (2 wide)
  const oval = (x: number) => { fillRect(b, x, ey, 2, 3, ink); set(b, x, ey, tint(ink, 0.35)) }
  const caret = (x: number) => { set(b, x - 1, ey + 2, ink); set(b, x, ey + 1, ink); set(b, x + 1, ey + 1, ink); set(b, x + 2, ey + 2, ink) }
  for (const [x, i] of [[L, 0], [R, 1]] as const) {
    if (blink) { set(b, x - 1, ey + 1, ink); fillRect(b, x, ey + 2, 2, 1, ink); set(b, x + 2, ey + 1, ink); continue }
    switch (body.eyes) {
      case 'round': oval(x); break
      case 'happy': caret(x); break
      case 'sparkle':
        fillRect(b, x - 1, ey - 1, 3, 4, ink); fillRect(b, x, ey + 3, 2, 1, ink)
        set(b, x - 1, ey - 1, '#ffffff'); set(b, x, ey - 1, '#ffffff'); set(b, x - 1, ey, '#ffffff')
        set(b, x + 1, ey + 2, tint(body.eyeColor, 0.4))
        break
      case 'sleepy':
        fillRect(b, x - 1, ey + 1, 4, 1, ink); fillRect(b, x, ey + 2, 2, 1, ink)
        break
      case 'wink':
        if (i === 0) oval(x); else caret(x)
        break
      case 'star': {
        const c = starColor(body.eyeColor)
        set(b, x, ey, c); set(b, x + 1, ey, c); fillRect(b, x - 1, ey + 1, 4, 1, c); set(b, x, ey + 2, c); set(b, x + 1, ey + 2, c)
        set(b, x, ey - 1, c); set(b, x + 1, ey - 1, c); set(b, x - 1, ey + 3, c); set(b, x + 2, ey + 3, c)
        set(b, x, ey + 1, '#ffffff')
        break
      }
    }
  }
  const my = HEAD.y + 8
  const m = mix(ink, fc.mouth, 0.35)
  const x0 = HEAD.x + 3, x1 = HEAD.x + 10
  if (body.cheeks) { fillRect(b, HEAD.x + 1, my - 1, 2, 1, fc.cheek); fillRect(b, HEAD.x + 11, my - 1, 2, 1, fc.cheek) }
  if (body.freckles) for (const x of [HEAD.x + 1, HEAD.x + 3, HEAD.x + 10, HEAD.x + 12]) set(b, x, my - 2 + (x % 2), fc.freckle)
  switch (body.mouth) {
    case 'smile':
      set(b, x0, my, m); set(b, x1, my, m); fillRect(b, x0 + 1, my + 1, 6, 1, m)
      break
    case 'grin':
      fillRect(b, x0, my, 8, 1, m); fillRect(b, x0 + 1, my, 6, 1, '#ffffff')
      set(b, x0, my + 1, m); set(b, x1, my + 1, m); fillRect(b, x0 + 1, my + 1, 6, 1, fc.inside)
      fillRect(b, x0 + 1, my + 2, 6, 1, m); fillRect(b, x0 + 3, my + 1, 2, 1, fc.tongue)
      break
    case 'open':
      fillRect(b, x0 + 2, my, 4, 3, m); fillRect(b, x0 + 3, my + 1, 2, 1, fc.inside)
      set(b, x0 + 2, my, null); set(b, x0 + 5, my, null); set(b, x0 + 2, my + 2, null); set(b, x0 + 5, my + 2, null)
      break
    case 'tongue':
      set(b, x0, my, m); set(b, x1, my, m); fillRect(b, x0 + 1, my + 1, 6, 1, m)
      fillRect(b, x0 + 4, my + 2, 2, 2, fc.tongue); set(b, x0 + 5, my + 3, shade(fc.tongue, 0.15))
      break
    case 'small':
      fillRect(b, x0 + 2, my + 1, 4, 1, m)
      break
  }
}

// ---------------------------------------------------------------- the figure

/** A texture region painted edge to edge (each row's gaps at the ends take its nearest colour). */
function solid(t: Texture): Texture {
  const px = t.px.slice()
  for (let y = 0; y < t.h; y++) {
    let a = -1, z = -1
    for (let x = 0; x < t.w; x++) if (px[y * t.w + x]) { if (a < 0) a = x; z = x }
    if (a < 0) continue
    for (let x = 0; x < a; x++) px[y * t.w + x] = px[y * t.w + a]!
    for (let x = z + 1; x < t.w; x++) px[y * t.w + x] = px[y * t.w + z]!
  }
  return { w: t.w, h: t.h, px }
}

function paint(f: Pick<FigureFrame, 'figure' | 'tex' | 'kind'>, bob: number, blink: boolean): PixelBuffer {
  const { w: W, h: Hh } = SIZE
  const body = f.figure.body
  const sk = skinOf(body)
  const worn = withDefaults({ tex: f.tex, kind: f.kind })
  const L = () => makeBuffer(W, Hh)
  const top = worn.tex.top!

  // Back piece behind everything.
  const back = L()
  if (worn.tex.back) {
    const wings = worn.kind.back === 'wings'
    const bw = wings ? 46 : 36, bh = wings ? 38 : 32
    blit(back, smoothResize(worn.tex.back, bw, bh), CX - bw / 2, wings ? TORSO.y - 12 : TORSO.y)
  }

  // Hat first: hair keeps out of it.
  const hat = L()
  let covers = false
  if (worn.tex.hat) {
    const s = (HEAD.w / 12) * 1.25
    const hw = Math.round(16 * s), hh = Math.round(10 * s)
    blit(hat, smoothResize(worn.tex.hat, hw, hh), Math.round(CX - hw / 2), HEAD.y + Math.round(4 * s) - hh)
    const t = worn.tex.hat
    covers = [6, 7, 8, 9].every(x => !!t.px[6 * t.w + x])
  }
  const hairF = L(), hairB = L()
  paintRobloxHair(hairF, hairB, body.hair, HEAD)
  if (covers) for (let x = 0; x < W; x++) {
    let bottom = -1
    for (let y = 0; y < Hh; y++) if (hat.px[y * W + x]) bottom = y
    for (let y = 0; y < Math.min(bottom, HEAD.y + 2); y++) { hairF.px[y * W + x] = null; hairB.px[y * W + x] = null }
  }
  colourHair(hairF, body, [HEAD.y - 6, HEAD.y + 22])
  colourHair(hairB, body, [HEAD.y - 6, HEAD.y + 22])

  // Legs: pants, or a skirt/dress hanging straight, shoes at the bottom.
  const legs = L()
  fillRect(legs, LEG_L.x, LEG_L.y, 18, 18, sk.c)
  if (worn.kind.top === 'dress') {
    const skirt = solid(crop(top, { x: 0, y: DRESS_SKIRT_ROW, w: 16, h: top.h - DRESS_SKIRT_ROW }))
    mapTexture(legs, skirt, { x: 3, y: 0, w: 10, h: skirt.h }, { x: LEG_L.x, y: LEG_L.y, w: 18, h: 13 }, { vote: true })
  } else if (worn.tex.bottom) {
    const bt = worn.kind.bottom === 'skirt' ? solid(worn.tex.bottom) : worn.tex.bottom
    mapTexture(legs, bt, { x: 0, y: 0, w: 6, h: 12 }, LEG_L, {})
    mapTexture(legs, bt, { x: 6, y: 0, w: 6, h: 12 }, LEG_R, {})
    if (worn.kind.bottom === 'skirt') mapTexture(legs, bt, { x: 0, y: 0, w: 12, h: 8 }, { x: LEG_L.x, y: LEG_L.y, w: 18, h: 12 }, {})
  }
  const shoes = worn.tex.shoes
  if (shoes) {
    let first = shoes.h
    for (let i = 0; i < shoes.px.length; i++) if (shoes.px[i]) { first = Math.floor(i / shoes.w); break }
    if (first < shoes.h) {
      const rows = shoes.h - first
      const h = Math.round(rows * 1.5)
      const boot = worn.kind.shoes === 'boot'
      for (const [leg, flip] of [[LEG_L, false], [LEG_R, true]] as const) {
        const t = flip ? flipTexture(shoes) : shoes
        const y = FLOOR - h
        mapTexture(legs, t, { x: 0, y: first, w: 6, h: rows }, { x: leg.x, y, w: 9, h }, {})
        if (boot) mapTexture(legs, t, { x: 0, y: first, w: 6, h: 1 }, { x: leg.x, y: y - 5, w: 9, h: 5 }, {})
      }
    }
  }
  const legL = L(), legR = L()
  blit(legL, crop(legs, LEG_L) as PixelBuffer, LEG_L.x, LEG_L.y)
  blit(legR, crop(legs, LEG_R) as PixelBuffer, LEG_R.x, LEG_R.y)

  // Torso and arms from the top.
  const torso = L(), armL = L(), armR = L()
  mapTexture(torso, top, { x: 3, y: 0, w: 10, h: DRESS_SKIRT_ROW }, TORSO, { under: sk.c })
  mapTexture(armL, top, { x: 0, y: 0, w: 3, h: DRESS_SKIRT_ROW }, ARM_L, { under: sk.c })
  mapTexture(armR, top, { x: 13, y: 0, w: 3, h: DRESS_SKIRT_ROW }, ARM_R, { under: sk.c })

  // The head.
  const head = L()
  fillRoundRect(head, HEAD.x, HEAD.y, HEAD.w, HEAD.h, 4, sk.c)
  topLight(head, HEAD, { ...LIGHT, top: 2, topF: 0.2 })
  face(head, body, blink)

  const out = L()
  const layers: Array<[PixelBuffer, boolean]> = [
    [back, true], [hairB, true], [legL, false], [legR, false], [torso, true], [armL, true], [armR, true], [head, true], [hairF, true], [hat, true],
  ]
  for (const [layer, upper] of layers) {
    if (layer !== head) topLight(layer, { x: 0, y: 0, w: W, h: Hh }, LIGHT)
    blit(out, layer, 0, upper ? bob : 0)
  }
  if (worn.tex.face) paintGlasses(out, worn.tex.face, { x: HEAD.x + 1, y: HEAD.y + 3 + bob, w: 12, h: 4 })
  outline(out, c => mix(shade(c, 0.55), '#23232e', 0.35))
  return out
}

// ---------------------------------------------------------------- backdrop

const plates = new Lru<PixelBuffer>(6)
const SKY: Hex[] = ['#a9d8ff', '#b5ddff', '#c1e3ff', '#cde8ff', '#d9eeff', '#e4f3ff']

function plate(w: number, h: number, ox: number, oy: number): PixelBuffer {
  const key = `${w}x${h}`
  const hit = plates.get(key)
  if (hit) return hit
  const b = makeBuffer(w, h)
  const floor = oy + FLOOR
  for (let y = 0; y < floor; y++) fillRect(b, 0, y, w, 1, SKY[Math.min(SKY.length - 1, Math.max(0, Math.floor(((y - oy) / FLOOR) * SKY.length)))]!)
  fillRect(b, 0, floor, w, h - floor, '#9d9da4')
  fillRect(b, 0, floor, w, 1, '#b9b9c0')
  // Studs, bigger as they come closer.
  const rows: Array<[number, number, number]> = [[2, 1.4, 6], [5, 2, 8], [9, 2.6, 10]]
  rows.forEach(([dy, r, gap], i) => {
    for (let x = ((ox + (i % 2) * gap / 2) % gap) - gap; x < w + gap; x += gap) {
      fillEllipse(b, x + 0.5, floor + dy + 0.6, r + 0.2, r * 0.55 + 0.2, '#85858c')
      fillEllipse(b, x + 0.5, floor + dy, r, r * 0.5, '#b4b4bb')
    }
  })
  return plates.set(key, b)
}

function backdrop(b: PixelBuffer, o: { x: number; y: number }, t: number): void {
  const p = plate(b.w, b.h, o.x, o.y)
  for (let i = 0; i < b.px.length; i++) b.px[i] = p.px[i]!
  // Soft clouds drifting by.
  const period = b.w + 40
  for (const [cx, cy, s] of [[8, 10, 1], [40, 20, 0.8], [70, 6, 1.1]] as const) {
    const x = ((cx + t * 1.5) % period) - 20
    const y = o.y + cy
    fillEllipse(b, x, y, 7 * s, 2.5 * s, '#ffffff')
    fillEllipse(b, x - 3 * s, y + 0.5, 4 * s, 2 * s, '#ffffff')
    fillEllipse(b, x + 3 * s, y - 1, 4 * s, 2.5 * s, '#ffffff')
    fillRect(b, x - 6 * s, y + 2 * s, 12 * s, 1, '#eef6ff')
  }
  // The figure's shadow on the plate.
  fillEllipse(b, o.x + CX, o.y + FLOOR + 1, 13, 1.6, '#8a8a92')
}

// ---------------------------------------------------------------- the style

const cache = new Lru<PixelBuffer>(16)

function draw(f: FigureFrame): void {
  const b = f.buf
  const o = frameOrigin(b, SIZE)
  if (f.backdrop) backdrop(b, o, f.t)
  const bob = f.pose.bob ? 1 : 0
  const key = `${figureKey(f)}|${bob}|${f.pose.blink ? 1 : 0}`
  const fig = cache.get(key) ?? cache.set(key, paint(f, bob, f.pose.blink))
  const hop = hopOf(f.pose.cheer, 4)
  blit(b, fig, o.x, o.y - hop)
  sparkles(b, o.x + CX, o.y + TORSO.y - hop, 24, 24, f.pose.cheer, f.t, 'star', ['#ffe25a', '#8fd0ff', '#ffffff'])
}

export const roblox: FigureStyle = {
  id: 'roblox',
  label: 'ROBLOX',
  short: 'ROBLOX',
  bg: '#c7e6ff',
  size: SIZE,
  draw,
}

