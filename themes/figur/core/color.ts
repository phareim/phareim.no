/**
 * Colour helpers for Lag Din Figur: every colour is a lower-case
 * '#rrggbb' string (`Hex` in types.ts). Shades and tints are computed,
 * never stored in the catalog, so a recoloured garment keeps its shading.
 */
import type { Hex } from '../types'

export const HEX_RE = /^#[0-9a-f]{6}$/

/** True for a lower-case '#rrggbb'. */
export const isHex = (v: unknown): v is Hex => typeof v === 'string' && HEX_RE.test(v)

/** A colour from outside (a save, a pick): '#rrggbb' in any case → lower case, else null. */
export function cleanHex(v: unknown): Hex | null {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null
}

const rgb = (hex: Hex): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const toHex = (r: number, g: number, b: number): Hex =>
  '#' + [r, g, b].map(c => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')

/** Mix `a` toward `b` by `t` (0..1). */
export function mix(a: Hex, b: Hex, t: number): Hex {
  const x = rgb(a)
  const y = rgb(b)
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t)
}

/**
 * A darker `hex` by `f` (0..1). Very dark colours are lifted instead
 * (a shade of black would vanish), toward a cool grey.
 */
export function shade(hex: Hex, f = 0.22): Hex {
  const [r, g, b] = rgb(hex)
  if (r + g + b < 120) return mix(hex, '#6a6a88', f)
  return toHex(r * (1 - f), g * (1 - f), b * (1 - f))
}

/** A lighter `hex` by `f` (0..1), toward white. */
export const tint = (hex: Hex, f = 0.35): Hex => mix(hex, '#ffffff', f)

/** Squared RGB distance, for "the nearest colour". */
export function distance(a: Hex, b: Hex): number {
  const x = rgb(a)
  const y = rgb(b)
  return (x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2
}

/** 0..255, perceived brightness. */
export function brightness(hex: Hex): number {
  const [r, g, b] = rgb(hex)
  return 0.299 * r + 0.587 * g + 0.114 * b
}
