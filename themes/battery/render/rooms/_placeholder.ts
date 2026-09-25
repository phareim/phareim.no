/** A plain room painter until a floor's real art lands. */
import type { RoomPainter } from '../api'

export function placeholderPainter(wall: string, floor: string): RoomPainter {
  return {
    paint(g, w, h) {
      g.fillStyle = wall
      g.fillRect(0, 0, w, h)
      g.fillStyle = floor
      g.fillRect(0, 100, w, h - 100)
      g.fillStyle = '#0b0616'
      g.fillRect(0, 40, 24, 64)
      g.fillRect(w - 24, 40, 24, 64)
    },
    ambient: () => '#a098c0',
    lights: (L) => { L(200, 50, 80, '#ffd8a0', 0.8) },
  }
}
