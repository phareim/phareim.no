/** Attic Storeroom (placeholder until the floor's real room lands). */
import type { RoomDef } from '../../types'
import { placeholderRoom } from './_placeholder'

export const room: RoomDef = placeholderRoom('storeroom', 'Attic Storeroom', 'attic', [{ to: 'study', side: 'right' }])
