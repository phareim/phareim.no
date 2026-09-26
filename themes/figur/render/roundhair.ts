/**
 * Hair for the round-headed styles (Toca Boca, Avatar World), painted in
 * hair markers (common.ts HAIR) around a head ellipse: a `front` layer
 * over the face and a `back` layer behind the head and body. The style
 * colours, lights and outlines them. `gloss` adds Avatar World's shiny
 * streak and strands; without it the hair is Toca's: bigger, flat, in two
 * tones (the part behind the head a shade darker), no highlight.
 */
import type { HairStyle, PixelBuffer } from '../types'
import { HAIR } from './common'
import { fillCircle, fillEllipse, fillRoundRect, get, set } from './pixels'

export interface HeadGeom { cx: number; cy: number; rx: number; ry: number }

const inEll = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
  ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1

/**
 * The hair cap: an ellipse a little larger than the head, down to the
 * fringe line in the middle and to `side` at the edges. `fringe(dx)`
 * gives the fringe's lowest row at horizontal offset dx (−1 … 1).
 */
function cap(b: PixelBuffer, g: HeadGeom, fringe: (dx: number) => number, side: number, grow = 1.5): void {
  const rx = g.rx + grow, ry = g.ry + grow
  for (let y = Math.floor(g.cy - ry); y <= Math.ceil(g.cy + ry); y++) {
    for (let x = Math.floor(g.cx - rx); x <= Math.ceil(g.cx + rx); x++) {
      if (!inEll(x, y, g.cx, g.cy - 0.5, rx, ry)) continue
      const dx = (x + 0.5 - g.cx) / g.rx
      // The fringe in the middle, blending down to the side line over the outer part of the face.
      const t = Math.max(0, Math.min(1, (Math.abs(dx) - 0.6) / 0.25))
      const f = fringe(Math.max(-1, Math.min(1, dx)))
      if (y + 0.5 <= f + (side - f) * t) set(b, x, y, HAIR.base)
    }
  }
}

const bumps = (b: PixelBuffer, pts: Array<[number, number]>, r: number, c: string = HAIR.base) => {
  for (const [x, y] of pts) fillCircle(b, x, y, r, c)
}

/** Paint `style` into the two layers. */
export function paintRoundHair(front: PixelBuffer, back: PixelBuffer, style: HairStyle, g: HeadGeom, gloss: boolean): void {
  const { cx, cy, rx, ry } = g
  const G = gloss ? 1.5 : 2.4 // how far the hair stands off the head
  const top = cy - ry
  const brow = cy - ry * 0.28 - (gloss ? 2 : 0) // where a straight fringe stops (higher in Avatar World: the brows show)
  switch (style) {
    case 'none':
      return
    case 'short':
      cap(front, g, dx => brow - 2 + Math.abs(dx + 0.3) * 3 + (dx > 0.15 ? 1.5 : 0), cy + ry * 0.05, G)
      // A cowlick.
      fillEllipse(front, cx + rx * 0.2, top - 1, rx * 0.22, 2.2, HAIR.base)
      break
    case 'long': {
      cap(front, g, dx => brow - 3 - (1 - Math.abs(dx)) * ry * 0.18 + Math.abs(dx) * 3, cy + ry * 0.2, G)
      fillRoundRect(back, Math.round(cx - rx - 2), Math.round(cy - ry * 0.4), Math.round(2 * rx + 4), Math.round(ry * 2.3), Math.round(rx * 0.45), HAIR.base)
      // Locks falling in front of the shoulders.
      for (const s of [-1, 1]) {
        const x0 = s < 0 ? cx - rx - 2 : cx + rx - 3
        fillRoundRect(front, Math.round(x0), Math.round(cy - ry * 0.2), 5, Math.round(ry * 1.55), 2, HAIR.base)
      }
      break
    }
    case 'ponytail':
      cap(front, g, dx => brow - 1 + (dx < -0.1 ? 1 : -(dx + 0.1) * 5), cy + ry * 0.05, G)
      fillEllipse(back, cx + rx * 0.9, cy + ry * 0.35, rx * 0.34, ry * 0.8, HAIR.base)
      fillEllipse(back, cx + rx * 0.62, cy - ry * 0.35, rx * 0.4, ry * 0.4, HAIR.base)
      fillEllipse(back, cx + rx * 0.8, cy - ry * 0.18, 2.2, 2.2, HAIR.tie)
      break
    case 'pigtails':
      cap(front, g, dx => brow - 0.5 + Math.abs(dx) * 1.5, cy + ry * 0.1, G)
      for (const s of [-1, 1]) {
        fillEllipse(back, cx + s * (rx + 2.5), cy + ry * 0.55, rx * 0.3, ry * 0.62, HAIR.base)
        fillEllipse(front, cx + s * (rx + 0.5), cy + ry * 0.02, 2.4, 2.4, HAIR.tie)
      }
      break
    case 'curly': {
      cap(front, g, dx => brow - 1 + Math.abs(dx) * 2, cy + ry * 0.35, G)
      const r = Math.max(2.5, rx * 0.2)
      const n = 7
      const edge: Array<[number, number]> = []
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (1.05 + (0.9 * i) / (n - 1))
        edge.push([cx + Math.cos(a) * (rx + 0.5), cy - 0.5 + Math.sin(a) * (ry + 0.5)])
      }
      bumps(front, edge, r)
      for (let i = 0; i < 5; i++) {
        const dx = -0.6 + 0.3 * i
        bumps(front, [[cx + dx * rx, brow - 0.5 + Math.abs(dx) * 2]], r * 0.8)
      }
      for (const s of [-1, 1]) bumps(back, [[cx + s * (rx + 0.5), cy + ry * 0.25], [cx + s * (rx - 0.5), cy + ry * 0.62], [cx + s * (rx + 1), cy - ry * 0.15]], r)
      break
    }
    case 'bun': {
      cap(front, g, dx => cy - ry * 0.52 + Math.abs(dx) * 3.5, cy - ry * 0.05, G - 0.5)
      const r = rx * 0.4
      fillCircle(back, cx, top - r * 0.55, r, HAIR.base)
      fillCircle(front, cx, top - r * 0.55, r, HAIR.base)
      for (let x = Math.round(cx - r * 0.7); x <= Math.round(cx + r * 0.7); x++) set(front, x, Math.round(top + r * 0.25), HAIR.tie)
      break
    }
    case 'spiky': {
      const zig = (dx: number) => brow - 1 + ((Math.floor((dx + 1) * 4.5) % 2) ? 3 : 0)
      cap(front, g, zig, cy - ry * 0.05, G)
      const n = 7
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (1.08 + (0.84 * i) / (n - 1))
        const bx = cx + Math.cos(a) * rx * 0.8, by = cy - 0.5 + Math.sin(a) * ry * 0.8
        const tx = cx + Math.cos(a) * (rx + 5), ty = cy - 0.5 + Math.sin(a) * (ry + 5)
        spike(front, bx, by, tx, ty, Math.max(2.5, rx * 0.2))
      }
      break
    }
    case 'afro': {
      const R = rx * 1.3
      fillCircle(back, cx, cy - ry * 0.18, R, HAIR.base)
      const n = 12
      const ring: Array<[number, number]> = []
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        ring.push([cx + Math.cos(a) * R, cy - ry * 0.18 + Math.sin(a) * R * 0.98])
      }
      bumps(back, ring, R * 0.24)
      cap(front, g, dx => brow - 2 + Math.abs(dx) * 2.5, cy - ry * 0.1, G)
      break
    }
  }
  if (gloss) {
    highlight(front, g, style)
    strands(front, g)
  } else {
    // Two flat tones: what hangs behind the head is a shade darker.
    for (let i = 0; i < back.px.length; i++) if (back.px[i] === HAIR.base) back.px[i] = HAIR.shade
  }
}

/** A filled triangle-ish spike from a base point to a tip. */
function spike(b: PixelBuffer, bx: number, by: number, tx: number, ty: number, w: number): void {
  const steps = 12
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    fillCircle(b, bx + (tx - bx) * t, by + (ty - by) * t, Math.max(0.6, w * (1 - t)), HAIR.base)
  }
}

/** Avatar World's glossy streak across the top of the hair, and a short glint. */
function highlight(b: PixelBuffer, g: HeadGeom, style: HairStyle): void {
  const r0 = 0.72, r1 = 0.86
  const a0 = Math.PI * 1.12, a1 = Math.PI * 1.62
  const cy = g.cy - 0.5 - (style === 'bun' ? 1 : 0)
  for (let y = Math.floor(cy - g.ry - 3); y <= cy; y++) {
    for (let x = Math.floor(g.cx - g.rx - 3); x <= g.cx + g.rx + 3; x++) {
      if (get(b, x, y) !== HAIR.base) continue
      const dx = (x + 0.5 - g.cx) / (g.rx + 1.5), dy = (y + 0.5 - cy) / (g.ry + 1.5)
      const r = Math.hypot(dx, dy)
      let a = Math.atan2(dy, dx)
      if (a < 0) a += Math.PI * 2
      if (r >= r0 && r <= r1 && a >= a0 && a <= a1) set(b, x, y, HAIR.light)
    }
  }
  {
    // A second, short glint to the right.
    for (let y = Math.floor(cy - g.ry - 3); y <= cy; y++) for (let x = Math.floor(g.cx); x <= g.cx + g.rx + 3; x++) {
      if (get(b, x, y) !== HAIR.base) continue
      const dx = (x + 0.5 - g.cx) / (g.rx + 1.5), dy = (y + 0.5 - cy) / (g.ry + 1.5)
      const r = Math.hypot(dx, dy)
      let a = Math.atan2(dy, dx)
      if (a < 0) a += Math.PI * 2
      if (r >= 0.74 && r <= 0.84 && a >= Math.PI * 1.7 && a <= Math.PI * 1.8) set(b, x, y, HAIR.light)
    }
  }
}

/** A few darker strand lines in the fringe (Avatar World). */
function strands(b: PixelBuffer, g: HeadGeom): void {
  for (const dx of [-0.45, 0.05, 0.5]) {
    const x = Math.round(g.cx + dx * g.rx)
    let y = Math.round(g.cy - g.ry * 0.2)
    // Walk up from the fringe's edge a few pixels.
    while (y > g.cy - g.ry * 1.2 && get(b, x, y) !== HAIR.base) y--
    for (let k = 0; k < 4; k++) if (get(b, x, y - k) === HAIR.base) set(b, x, y - k, HAIR.shade)
  }
}
