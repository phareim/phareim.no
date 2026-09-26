/**
 * Minecraft: the skin's front faces at one pixel per skin pixel (head
 * 8 × 8, body 8 × 12, arms and legs 4 × 12), the head's second layer
 * over them, and a one-pixel hint of a turn (the head's top and right
 * side, the right arm's and leg's sides) taken from the same skin. What
 * you see is what the download gives. Blue sky with square clouds, a
 * grass-block floor, a poppy and a dandelion. The idle bob drops the
 * upper body a pixel onto the legs; a cheer hops and pops XP orbs.
 */
import type { FigureFrame, FigureStyle, Hex, PixelBuffer, Texture } from '../types'
import { cellNoise } from '../core/pixelart'
import { shade, tint } from '../core/color'
import { minecraftSkin, PARTS } from '../core/mcskin'
import { blit, fillRect, get, makeBuffer, resample, set, type Rect } from './pixels'
import { figureKey, frameOrigin, hopOf, Lru, sparkles, type Worn2 } from './common'

const SIZE = { w: 28, h: 44 }
const FLOOR = 36 // first grass row; the feet stand on it
const SKY = ['#6f9fff', '#7aa8ff', '#86b1ff', '#93bbff', '#a2c6ff']

const skins = new Lru<{ open: Texture; shut: Texture }>(24)

/** The figure's skin (open and blinking), cached by what it wears. */
export function skinsFor(f: Pick<FigureFrame, 'figure' | 'tex' | 'kind'>): { open: Texture; shut: Texture } {
  const key = figureKey(f)
  const hit = skins.get(key)
  if (hit) return hit
  const worn: Worn2 = { tex: f.tex, kind: f.kind }
  return skins.set(key, { open: minecraftSkin(f.figure, worn), shut: minecraftSkin(f.figure, worn, { blink: true }) })
}

// ---------------------------------------------------------------- backdrop

const backdrops = new Lru<PixelBuffer>(6)

function grassBlock(x: number, y: number): Hex {
  // One 16-px block face repeating, like the game: green top with drips, dirt with speckle.
  const bx = ((x % 16) + 16) % 16
  const drip = 2 + Math.floor(cellNoise(bx, 99) * 3)
  const n = cellNoise(bx, y)
  if (y < drip) return y === 0 ? (n < 0.5 ? '#7fcf52' : '#6cbf45') : n < 0.3 ? '#4f9a33' : '#5daf3c'
  return n < 0.18 ? '#6b4423' : n < 0.3 ? '#a0703f' : n < 0.36 ? '#7d7d7d' : '#8b5a2e'
}

function baseBackdrop(w: number, h: number): PixelBuffer {
  const key = `${w}x${h}`
  const hit = backdrops.get(key)
  if (hit) return hit
  const b = makeBuffer(w, h)
  const floor = h - (SIZE.h - FLOOR)
  for (let y = 0; y < floor; y++) {
    const band = Math.min(SKY.length - 1, Math.floor(((y + (SIZE.h - h)) / FLOOR) * SKY.length))
    fillRect(b, 0, y, w, 1, SKY[Math.max(0, band)]!)
  }
  const ox = frameOrigin(b, SIZE).x
  for (let y = floor; y < h; y++) for (let x = 0; x < w; x++) set(b, x, y, grassBlock(x - ox, y - floor))
  // A square sun.
  fillRect(b, w - 7, floor - 34, 4, 4, '#fff7a8')
  fillRect(b, w - 6, floor - 33, 2, 2, '#ffffff')
  // A poppy on the left, a dandelion on the right (a block's worth of flower each).
  const flower = (x: number, petal: Hex, eye: Hex) => {
    for (let y = floor - 5; y < floor; y++) set(b, x, y, '#3d8a2a')
    set(b, x - 1, floor - 2, '#4fa83a'); set(b, x + 1, floor - 3, '#4fa83a')
    fillRect(b, x - 1, floor - 7, 3, 2, petal)
    set(b, x, floor - 8, petal)
    set(b, x, floor - 7, eye)
  }
  flower(ox + 2, '#e8333d', '#3a1a1a')
  flower(ox + SIZE.w - 3, '#ffd93b', '#e0a92a')
  return backdrops.set(key, b)
}

const CLOUDS: Rect[] = [{ x: 0, y: 3, w: 10, h: 3 }, { x: 3, y: 1, w: 5, h: 2 }, { x: 22, y: 9, w: 8, h: 2 }, { x: 24, y: 8, w: 4, h: 1 }]

function clouds(b: PixelBuffer, t: number, floor: number): void {
  const period = Math.max(40, b.w + 12)
  const drift = Math.floor(t * 1.2) % period
  const top = floor - FLOOR
  for (const c of CLOUDS) {
    for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
      const X = ((c.x + x + drift) % period) - 6
      const Y = top + c.y + y
      if (Y >= 0) set(b, X, Y, y === c.h - 1 && c.h > 1 ? '#e8eefc' : '#ffffff')
    }
  }
}

// ---------------------------------------------------------------- the figure

function copy(b: PixelBuffer, skin: Texture, r: Rect, x0: number, y0: number, f = 0): void {
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const c = get(skin, r.x + x, r.y + y)
    if (c) set(b, x0 + x, y0 + y, f > 0 ? shade(c, f) : f < 0 ? tint(c, -f) : c)
  }
}

/** Behind the body: a cape hangs from the shoulders, wings spread past the arms. */
function backPiece(b: PixelBuffer, f: FigureFrame, cx: number, shoulderY: number): void {
  const tex = f.tex.back
  if (!tex) return
  if (f.kind.back === 'wings') {
    const r = resample(tex, { x: 0, y: 0, w: tex.w, h: tex.h }, 30, 22)
    blit(b, r, cx - 15, shoulderY - 5)
  } else {
    const r = resample(tex, { x: 0, y: 0, w: tex.w, h: tex.h }, 20, 21)
    blit(b, r, cx - 10, shoulderY)
  }
}

function draw(f: FigureFrame): void {
  const b = f.buf
  const o = frameOrigin(b, SIZE)
  const floor = o.y + FLOOR
  if (f.backdrop) {
    const base = baseBackdrop(b.w, b.h)
    for (let i = 0; i < b.px.length; i++) b.px[i] = base.px[i]!
    clouds(b, f.t, floor)
  }
  const { open, shut } = skinsFor(f)
  const skin = f.pose.blink ? shut : open
  const hop = hopOf(f.pose.cheer, 3)
  const bob = f.pose.bob ? 1 : 0
  const x0 = o.x + 6 // left edge of the 16-px front view
  const legY = floor - 12 - hop
  const upY = floor - 32 - hop + bob // head top

  backPiece(b, f, x0 + 8, upY + 8)

  // Legs, then the upper body over them (the bob sinks it a pixel).
  copy(b, skin, PARTS.legR.front, x0 + 4, legY)
  copy(b, skin, PARTS.legL.front, x0 + 8, legY)
  copy(b, skin, { ...PARTS.legL.left, w: 1 }, x0 + 12, legY, 0.12)
  copy(b, skin, PARTS.body.front, x0 + 4, upY + 8)
  copy(b, skin, PARTS.armR.front, x0, upY + 8)
  copy(b, skin, PARTS.armL.front, x0 + 12, upY + 8)
  copy(b, skin, { ...PARTS.armL.left, w: 1 }, x0 + 16, upY + 8, 0.12)
  copy(b, skin, { ...PARTS.armL.top, y: PARTS.armL.top.y + 3, h: 1 }, x0 + 13, upY + 7, -0.1)

  // Head: the top's front row and the right side's front column, then the face and its second layer.
  const hx = x0 + 4
  copy(b, skin, { ...PARTS.head.top, y: PARTS.head.top.y + 7, h: 1 }, hx + 1, upY - 1, -0.08)
  copy(b, skin, { ...PARTS.head.left, w: 1 }, hx + 8, upY, 0.14)
  copy(b, skin, PARTS.head.front, hx, upY)
  copy(b, skin, { ...PARTS.hat.top, y: PARTS.hat.top.y + 7, h: 1 }, hx + 1, upY - 1, -0.05)
  copy(b, skin, { ...PARTS.hat.left, w: 1 }, hx + 8, upY, 0.1)
  copy(b, skin, PARTS.hat.front, hx, upY)

  sparkles(b, x0 + 8, upY + 14, 13, 16, f.pose.cheer, f.t, 'orb', ['#b8ff3c', '#fff04a', '#7dff5a'])
}

export const minecraft: FigureStyle = {
  id: 'minecraft',
  label: 'MINECRAFT',
  short: 'MINE',
  bg: '#8fbaff',
  size: SIZE,
  draw,
}
