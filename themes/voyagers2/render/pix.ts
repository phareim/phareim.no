/**
 * Space Voyagers II (from the first game): the few drawing verbs the code-drawn parts share. All of
 * them put whole logical pixels: a line is a run of single pixels, a ring is
 * one pixel wide, a fade is a stipple (every second or fourth pixel), and
 * nothing is ever smoothed or blended.
 */
import { drawText, textWidth } from '../../base/pixel/font'
import type { Rect } from './layout'

export type G = CanvasRenderingContext2D

export function rect(g: G, c: string, x: number, y: number, w: number, h: number): void {
  g.fillStyle = c
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h))
}

/** A one-pixel frame just inside the rectangle. */
export function frame(g: G, c: string, x: number, y: number, w: number, h: number): void {
  g.fillStyle = c
  g.fillRect(x, y, w, 1)
  g.fillRect(x, y + h - 1, w, 1)
  g.fillRect(x, y, 1, h)
  g.fillRect(x + w - 1, y, 1, h)
}

/** A straight run of single pixels; `dash` draws that many and skips as many. */
export function line(g: G, c: string, x0: number, y0: number, x1: number, y1: number, dash = 0, phase = 0): void {
  g.fillStyle = c
  let x = Math.round(x0)
  let y = Math.round(y0)
  const ex = Math.round(x1)
  const ey = Math.round(y1)
  const dx = Math.abs(ex - x)
  const dy = -Math.abs(ey - y)
  const sx = x < ex ? 1 : -1
  const sy = y < ey ? 1 : -1
  let err = dx + dy
  let i = phase
  for (let n = 0; n < 2000; n++) {
    if (dash === 0 || Math.floor(i / dash) % 2 === 0) g.fillRect(x, y, 1, 1)
    i++
    if (x === ex && y === ey) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
}

/** A circle one pixel wide; `gap` leaves every nth pixel out (0: none). */
export function ring(g: G, c: string, cx: number, cy: number, r: number, gap = 0, phase = 0): void {
  g.fillStyle = c
  const x0 = Math.round(cx)
  const y0 = Math.round(cy)
  let x = Math.round(r)
  let y = 0
  let err = 1 - x
  let i = phase
  const put = (px: number, py: number): void => {
    if (gap === 0 || i % gap !== 0) g.fillRect(px, py, 1, 1)
  }
  while (x >= y) {
    put(x0 + x, y0 + y); put(x0 - x, y0 + y); put(x0 + x, y0 - y); put(x0 - x, y0 - y)
    put(x0 + y, y0 + x); put(x0 - y, y0 + x); put(x0 + y, y0 - x); put(x0 - y, y0 - x)
    i++
    y++
    if (err < 0) err += 2 * y + 1
    else { x--; err += 2 * (y - x) + 1 }
  }
}

/** A filled disc of whole pixels. */
export function disc(g: G, c: string, cx: number, cy: number, r: number): void {
  g.fillStyle = c
  const x0 = Math.round(cx)
  const y0 = Math.round(cy)
  for (let y = -r; y <= r; y++) {
    const half = Math.floor(Math.sqrt(r * r - y * y + 0.4))
    g.fillRect(x0 - half, y0 + y, half * 2 + 1, 1)
  }
}

/**
 * A stippled patch: of every `n` pixels along a row one is lit, the rows
 * offset so it reads as a tone. n = 2 is a checker (half), 4 a quarter.
 */
export function stipple(g: G, c: string, x: number, y: number, w: number, h: number, n = 2, phase = 0): void {
  g.fillStyle = c
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  const x1 = x0 + Math.round(w)
  const y1 = y0 + Math.round(h)
  for (let py = y0; py < y1; py++) {
    const off = (((py * (n === 2 ? 1 : 2) + phase) % n) + n) % n
    for (let px = x0 + ((off - (x0 % n) + n) % n); px < x1; px += n) g.fillRect(px, py, 1, 1)
  }
}

export function text(g: G, s: string, x: number, y: number, c: string, shadow?: string): void {
  drawText(g, s, Math.round(x), Math.round(y), c, shadow)
}

/** Text centred on x. */
export function textC(g: G, s: string, cx: number, y: number, c: string, shadow?: string): void {
  drawText(g, s, Math.round(cx - textWidth(s) / 2), Math.round(y), c, shadow)
}

/** The 5x7 font at n times its size, each font pixel an n by n block. Centred on cx. */
export function bigTextC(g: G, s: string, cx: number, y: number, n: number, c: string, shadow?: string): void {
  const w = textWidth(s)
  const tmp = scratch(w + 1, 9)
  const t = tmp.getContext('2d')!
  const pass = (color: string, ox: number, oy: number): void => {
    t.clearRect(0, 0, tmp.width, tmp.height)
    drawText(t, s, 0, 1, color)
    g.drawImage(tmp, 0, 0, w + 1, 9, Math.round(cx - (w * n) / 2) + ox, Math.round(y) - n + oy, (w + 1) * n, 9 * n)
  }
  if (shadow) pass(shadow, n, n)
  pass(c, 0, 0)
}

export function bigTextWidth(s: string, n: number): number {
  return textWidth(s) * n
}

let scratchCanvas: HTMLCanvasElement | null = null
function scratch(w: number, h: number): HTMLCanvasElement {
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas')
  if (scratchCanvas.width < w) scratchCanvas.width = w
  if (scratchCanvas.height < h) scratchCanvas.height = h
  return scratchCanvas
}

/** Draw inside a rectangle only. */
export function clipTo(g: G, r: Rect, draw: () => void): void {
  g.save()
  g.beginPath()
  g.rect(r.x, r.y, r.w, r.h)
  g.clip()
  draw()
  g.restore()
}

/** A whole number from two, the same every time: for stars, tears and clusters that must not flicker. */
export function hash(a: number, b: number): number {
  let h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA6B)
  h ^= h >>> 15
  h = Math.imul(h, 0x2C1B3C6D)
  h ^= h >>> 12
  return h >>> 0
}
