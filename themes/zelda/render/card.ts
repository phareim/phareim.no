/**
 * The painter of an intertitle card (`engine/cards.ts`): a plate over the whole stage in the year's darkest tone,
 * a double rule, the title in the 5×7 font at twice its size, a line or two under it, and, once the card may be
 * passed, the A button's name a quarter of the way up from the bottom (never in a corner, where a thumb or the deck
 * lies). Drawn on the HUD's grid under the hearts.
 */
import type { Card } from '../types'
import { CARD } from '../engine/cards'
import { drawText, textWidth, GLYPH_H } from '../../base/pixel/font'
import { eraCard } from './eras'

type G = CanvasRenderingContext2D

const r = (g: G, c: string, x: number, y: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(x, y, w, h) }
function frame(g: G, c: string, x: number, y: number, w: number, h: number, t: number) {
  r(g, c, x, y, w, t)
  r(g, c, x, y + h - t, w, t)
  r(g, c, x, y, t, h)
  r(g, c, x + w - t, y, t, h)
}

export function drawCard(g: G, card: Card, vw: number, vh: number, a: string, reduced: boolean) {
  const tone = eraCard(card.era)
  const was = g.globalAlpha
  g.globalAlpha = reduced ? 1 : Math.min(1, card.t / CARD.fade)
  r(g, tone.plate, 0, 0, vw, vh)
  // The double rule, round the middle of the stage: narrow enough for a phone, no wider than a card on a desk.
  const w = Math.min(vw - 16, 224)
  const h = Math.min(Math.round(vh * 0.5), 132)
  const x = Math.round((vw - w) / 2)
  const y = Math.round((vh - h) * 0.42)
  frame(g, tone.rule, x, y, w, h, 2)
  frame(g, tone.rule, x + 5, y + 5, w - 10, h - 10, 1)
  const mid = x + w / 2
  const rows = card.lines.length * 12
  const top = Math.round(y + (h - (GLYPH_H * 2 + 14 + rows)) / 2)
  g.save()
  g.translate(Math.round(mid - textWidth(card.title)), top)
  g.scale(2, 2)
  drawText(g, card.title, 0, 0, tone.title)
  g.restore()
  r(g, tone.rule, Math.round(mid - 16), top + GLYPH_H * 2 + 6, 32, 1)
  card.lines.forEach((line, i) => drawText(g, line, Math.round(mid - textWidth(line) / 2), top + GLYPH_H * 2 + 14 + i * 12, tone.text))
  if (card.t >= CARD.pass) {
    const bw = textWidth(a) + 10
    const bx = Math.round((vw - bw) / 2)
    const by = Math.round(vh * 0.75) - 7
    frame(g, tone.rule, bx, by, bw, 15, 1)
    drawText(g, a, bx + 5, by + 4, tone.title)
  }
  g.globalAlpha = was
}
