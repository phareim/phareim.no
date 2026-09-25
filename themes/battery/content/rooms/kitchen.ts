/** Kitchen (placeholder until the floor's real room lands). */
import type { RoomDef } from '../../types'
import { placeholderRoom } from './_placeholder'

export const room: RoomDef = placeholderRoom('kitchen', 'Kitchen', 'ground', [{ to: 'foyer', side: 'right' }])
