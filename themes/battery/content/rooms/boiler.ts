/** Boiler Room (placeholder until the floor's real room lands). */
import type { RoomDef } from '../../types'
import { placeholderRoom } from './_placeholder'

export const room: RoomDef = placeholderRoom('boiler', 'Boiler Room', 'cellar', [{ to: 'pantry', side: 'left' }])
