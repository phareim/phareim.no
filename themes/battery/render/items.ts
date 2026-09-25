/**
 * Inventory icons. Placeholder: a coloured tile with the item's initials,
 * replaced by pixel-art string maps.
 */
import { makeCanvas } from '../../base/pixel/stage'
import { drawText } from '../../base/pixel/sprites'
import type { GameState, ItemId } from '../types'

const cache = new Map<string, HTMLCanvasElement>()

export function itemIcon(id: ItemId, _s: GameState): HTMLCanvasElement {
  let c = cache.get(id)
  if (!c) {
    c = makeCanvas(22, 18)
    const g = c.getContext('2d')!
    g.fillStyle = '#5a5285'
    g.fillRect(1, 1, 20, 16)
    drawText(g, id.slice(0, 3), 2, 6, '#fff4ff')
    cache.set(id, c)
  }
  return c
}
