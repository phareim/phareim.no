/**
 * The four styles and the one call the UI makes per animation frame:
 * frameFor(figure, closet, style, opts) resolves the outfit, makes a
 * buffer (the style's size, or larger: the figure is centred and keeps
 * its floor line) and lets the style paint it. Styles cache their
 * per-figure work (the Minecraft skin, the painted figure) by what the
 * figure wears, so a frame is a backdrop copy, a blit and a few
 * sparkles.
 */
import type { DrawnGarment, Figure, FigureFrame, FigureStyle, PixelBuffer, StyleId, Texture } from '../types'
import { resolveOutfit } from '../core/textures'
import { minecraftSkin } from '../core/mcskin'
import { makeBuffer } from './pixels'
import { minecraft } from './minecraft'
import { roblox } from './roblox'
import { toca } from './toca'
import { avatar } from './avatar'

export const STYLES: FigureStyle[] = [minecraft, roblox, toca, avatar]

/** A style by id; the first (Minecraft) for anything unknown. */
export function styleById(id: StyleId | string): FigureStyle {
  return STYLES.find(s => s.id === id) ?? STYLES[0]!
}

export interface FrameOpts {
  /** Seconds since the stage started. */
  t: number
  pose: FigureFrame['pose']
  /** false: transparent around the figure (thumbnails, exports). */
  backdrop: boolean
  /** Buffer size; defaults to the style's size. Larger keeps the figure centred on the same floor line. */
  w?: number
  h?: number
}

/** One frame of `figure` in `style`. */
export function frameFor(figure: Figure, closet: readonly DrawnGarment[], style: FigureStyle | StyleId, opts: FrameOpts): PixelBuffer {
  const s = typeof style === 'string' ? styleById(style) : style
  const { tex, kind } = resolveOutfit(figure, closet)
  const buf = makeBuffer(Math.max(1, Math.round(opts.w ?? s.size.w)), Math.max(1, Math.round(opts.h ?? s.size.h)))
  s.draw({ buf, figure, tex, kind, t: opts.t, pose: opts.pose, backdrop: opts.backdrop })
  return buf
}

/** Same as frameFor (DESIGN.md's name for it). */
export const drawFigure = frameFor

/** The figure's 64 × 64 Minecraft skin, for the download (writeRGBA it into a canvas, save as PNG). */
export function minecraftSkinFor(figure: Figure, closet: readonly DrawnGarment[]): Texture {
  return minecraftSkin(figure, resolveOutfit(figure, closet))
}
