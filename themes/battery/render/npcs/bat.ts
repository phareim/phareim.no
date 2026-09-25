/** bat: painter (placeholder). Feet at (a.x, a.y). */
import type { NpcPainter } from '../api'

export const paint: NpcPainter = (g, a) => {
  g.fillStyle = '#ff5c7a'
  g.fillRect(Math.round(a.x - 5), Math.round(a.y - 8), 10, 8)
}
