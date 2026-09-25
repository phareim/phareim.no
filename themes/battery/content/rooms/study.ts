/** The Professor's Study (placeholder until the floor's real room lands). */
import type { RoomDef } from '../../types'
import { placeholderRoom } from './_placeholder'

export const room: RoomDef = placeholderRoom('study', 'The Professor\'s Study', 'attic', [{ to: 'storeroom', side: 'left' }])
