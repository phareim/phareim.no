/**
 * The studio's pure bits, kept out of the components so plain node can
 * test them (tests/figur-ui.test.mjs): the drawing board's undo stack and
 * stroke lines, the whole-number fits for the stage and the board, and
 * the download file names. No DOM.
 */
import type { Texture } from '../types'

// ---------------------------------------------------------------- undo

/** Steps kept; a child who paints more than this loses the oldest. */
export const UNDO_MAX = 60

/** An undo stack of textures: one entry per stroke, the picture before it. */
export interface Undo {
  stack: Texture[]
}

export const newUndo = (): Undo => ({ stack: [] })

/** Remember `before` (the picture as the stroke found it). */
export function pushUndo(u: Undo, before: Texture): void {
  const top = u.stack[u.stack.length - 1]
  if (top && sameTexture(top, before)) return
  u.stack.push(before)
  if (u.stack.length > UNDO_MAX) u.stack.splice(0, u.stack.length - UNDO_MAX)
}

/** The picture before the last stroke, or null when there is nothing to undo. */
export function popUndo(u: Undo): Texture | null {
  return u.stack.pop() ?? null
}

export const canUndo = (u: Undo): boolean => u.stack.length > 0

export function sameTexture(a: Texture, b: Texture): boolean {
  if (a === b) return true
  if (a.w !== b.w || a.h !== b.h || a.px.length !== b.px.length) return false
  for (let i = 0; i < a.px.length; i++) if (a.px[i] !== b.px[i]) return false
  return true
}

// ---------------------------------------------------------------- strokes

/** Every cell on the line from (x0, y0) to (x1, y1), both ends included (Bresenham), so a fast drag leaves no gaps. */
export function lineCells(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const out: Array<[number, number]> = []
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  for (;;) {
    out.push([x, y])
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 >= dy) { err += dy; x += sx }
    if (e2 <= dx) { err += dx; y += sy }
  }
  return out
}

/** The cell under a point (px from the grid's top-left), or null outside the grid. */
export function cellAt(px: number, py: number, cell: number, w: number, h: number): [number, number] | null {
  if (cell <= 0) return null
  const x = Math.floor(px / cell)
  const y = Math.floor(py / cell)
  return x >= 0 && y >= 0 && x < w && y < h ? [x, y] : null
}

// ---------------------------------------------------------------- fits

/**
 * The board's cell size: the largest whole number of CSS px that fits a
 * `w × h` grid in `availW × availH`, at most `max`. At least 1.
 */
export function boardCell(availW: number, availH: number, w: number, h: number, max = 44): number {
  if (w <= 0 || h <= 0) return 1
  return Math.max(1, Math.min(max, Math.floor(availW / w), Math.floor(availH / h)))
}

export interface StageFit {
  /** CSS px per logical pixel. */
  scale: number
  /** The buffer's logical size: the style's size or wider/taller, so the backdrop fills the area. */
  w: number
  h: number
}

/**
 * The stage's fit: the largest whole-number scale at which `size` fits
 * the area, then a buffer that covers as much of the area as that scale
 * allows (the rest, under one scale step, is letterboxed).
 */
export function stageFit(availW: number, availH: number, size: { w: number; h: number }): StageFit {
  const scale = Math.max(1, Math.min(Math.floor(availW / size.w), Math.floor(availH / size.h)))
  return {
    scale,
    w: Math.max(size.w, Math.floor(availW / scale)),
    h: Math.max(size.h, Math.floor(availH / scale)),
  }
}

/** A whole-number scale that makes a `w × h` picture about `target` px on its longer side (at least 1). */
export function exportScale(w: number, h: number, target = 1024): number {
  return Math.max(1, Math.round(target / Math.max(w, h, 1)))
}

// ---------------------------------------------------------------- file names

/** A name as a file name: lower case, æøå folded, anything else a hyphen. "Ulrikke Å" → "ulrikke-a". */
export function fileSlug(name: string): string {
  const s = name.toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'figur'
}

/** `figur-<navn>-<stil>.png` */
export const pictureFileName = (name: string, style: string): string => `figur-${fileSlug(name)}-${fileSlug(style)}.png`

/** `<navn>-skin.png` */
export const skinFileName = (name: string): string => `${fileSlug(name)}-skin.png`
