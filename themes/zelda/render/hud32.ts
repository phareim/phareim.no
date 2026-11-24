/**
 * The polygon view's two dresses at double density, as fine as its picture:
 * the 32-bit look's glass and the 64-bit look's round windows. The panels are
 * `hud.ts`'s own, drawn with half-px edges; the lettering, the icons and the
 * marks are the 16-bit view's (`hud16.ts`). The round dress has bigger, softer
 * hearts of its own, painted smooth. A screen whose classic px is a single
 * device px wears the coarse dress instead (`coarse`).
 */
import { GLASS_SKIN, ROUND_SKIN, glassPanel, roundPanel, type HudSkin } from './hud'
import { FINE_PARTS } from './hud16'
import { makeCanvas, sprite } from './sheet'

type Canvas = HTMLCanvasElement

/** A smooth heart, full, half or empty, painted at 8× its sprite and drawn down to its size. */
const hearts = new Map<string, Canvas>()
function softHeart(kind: 'full' | 'half' | 'empty'): Canvas {
  let c = hearts.get(kind)
  if (c) return c
  const S = 64
  c = makeCanvas(S, S)
  const g = c.getContext('2d')!
  const shape = () => {
    g.beginPath()
    g.moveTo(S / 2, S * 0.88)
    g.bezierCurveTo(S * 0.1, S * 0.6, S * 0.02, S * 0.34, S * 0.2, S * 0.18)
    g.bezierCurveTo(S * 0.34, S * 0.06, S * 0.46, S * 0.12, S / 2, S * 0.26)
    g.bezierCurveTo(S * 0.54, S * 0.12, S * 0.66, S * 0.06, S * 0.8, S * 0.18)
    g.bezierCurveTo(S * 0.98, S * 0.34, S * 0.9, S * 0.6, S / 2, S * 0.88)
    g.closePath()
  }
  // A soft shadow under it, then the heart: empty is dark glass, full a glossy pink.
  g.save()
  g.shadowColor = 'rgba(0,0,0,0.55)'
  g.shadowBlur = 6
  g.shadowOffsetY = 3
  shape()
  g.fillStyle = '#3a1a48'
  g.fill()
  g.restore()
  const fill = (x0: number, x1: number) => {
    g.save()
    shape()
    g.clip()
    const gr = g.createLinearGradient(0, S * 0.1, 0, S * 0.9)
    gr.addColorStop(0, '#ff9ad8')
    gr.addColorStop(0.55, '#ff3fa8')
    gr.addColorStop(1, '#b0186e')
    g.fillStyle = gr
    g.fillRect(x0, 0, x1 - x0, S)
    g.restore()
  }
  if (kind !== 'empty') fill(0, kind === 'half' ? S / 2 : S)
  g.save()
  shape()
  g.lineWidth = 3
  g.strokeStyle = kind === 'empty' ? 'rgba(255,170,230,0.55)' : 'rgba(255,220,240,0.9)'
  g.stroke()
  g.restore()
  if (kind !== 'empty') {
    // The gloss.
    g.save()
    shape()
    g.clip()
    g.fillStyle = 'rgba(255,255,255,0.45)'
    g.beginPath()
    g.ellipse(S * 0.32, S * 0.3, S * 0.11, S * 0.07, -0.6, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  hearts.set(kind, c)
  return c
}

const roundIcon = (name: string): Canvas => {
  if (name === 'hud_heart_full') return softHeart('full')
  if (name === 'hud_heart_half') return softHeart('half')
  if (name === 'hud_heart_empty') return softHeart('empty')
  return FINE_PARTS.icon(name)
}

/** The 32-bit look's glass windows, fine. */
export const GLASS_FINE_SKIN: HudSkin = {
  ...GLASS_SKIN,
  ...FINE_PARTS,
  panel: (g, x, y, w, h, tone) => glassPanel(g, x, y, w, h, tone, 0.5),
  density: 2,
  plate: true,
  underHud: true,
  coarse: () => GLASS_SKIN,
}

/** The 64-bit look's round windows, fine, with bigger, softer hearts. */
export const ROUND_FINE_SKIN: HudSkin = {
  ...ROUND_SKIN,
  ...FINE_PARTS,
  icon: roundIcon,
  panel: (g, x, y, w, h, tone) => roundPanel(g, x, y, w, h, tone, 0.6),
  density: 2,
  plate: true,
  underHud: true,
  heartScale: 1.6,
  heartStep: 13,
  coarse: () => ROUND_SKIN,
}

void sprite
