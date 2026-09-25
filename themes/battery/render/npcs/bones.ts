/** bones: painter (placeholder). Feet at (a.x, a.y). */
import type { NpcPainter } from '../api'

export const paint: NpcPainter = (g, a) => {
  g.fillStyle = '#e8e4d0'
  g.fillRect(Math.round(a.x - 5), Math.round(a.y - 40), 10, 40)
}
