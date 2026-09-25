/** Foyer (placeholder until the floor's real room lands). */
import type { RoomDef } from '../../types'
import { placeholderRoom } from './_placeholder'

export const room: RoomDef = placeholderRoom('foyer', 'Foyer', 'ground', [{ to: 'kitchen', side: 'left' }, { to: 'parlour', side: 'right' }])
