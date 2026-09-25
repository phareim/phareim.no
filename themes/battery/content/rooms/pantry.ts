/** Pantry (placeholder until the floor's real room lands). */
import type { RoomDef } from '../../types'
import { placeholderRoom } from './_placeholder'

export const room: RoomDef = placeholderRoom('pantry', 'Pantry', 'cellar', [{ to: 'boiler', side: 'right' }])
