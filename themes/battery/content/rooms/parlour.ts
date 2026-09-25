/** Parlour (placeholder until the floor's real room lands). */
import type { RoomDef } from '../../types'
import { placeholderRoom } from './_placeholder'

export const room: RoomDef = placeholderRoom('parlour', 'Parlour', 'ground', [{ to: 'foyer', side: 'left' }])
