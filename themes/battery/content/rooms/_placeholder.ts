/** A bare room so the game runs before a floor's real rooms land. */
import type { RoomDef, RoomId, Floor } from '../../types'

export function placeholderRoom(id: RoomId, name: string, floor: Floor, exits: { to: RoomId; side: 'left' | 'right' }[] = []): RoomDef {
  const w = 400
  return {
    id, name, floor, w,
    walk: [[[20, 104], [380, 104], [396, 140], [4, 140]]],
    hotspots: exits.map(e => ({
      id: 'to-' + e.to,
      name: 'Door',
      rect: e.side === 'left' ? [0, 40, 24, 90] as const : [376, 40, 24, 90] as const,
      at: e.side === 'left' ? [14, 120] as const : [386, 120] as const,
      exit: { to: e.to, x: e.side === 'left' ? 370 : 30, y: 120, face: e.side === 'left' ? 'left' as const : 'right' as const },
    })),
  }
}
