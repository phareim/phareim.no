/** gustav: painter (placeholder). Feet at (a.x, a.y). */
import type { NpcPainter } from '../api'

export const paint: NpcPainter = (g, a) => {
  g.fillStyle = '#4f9a2a'
  g.fillRect(Math.round(a.x - 5), Math.round(a.y - 70), 10, 70)
}
