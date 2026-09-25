/** Every room's painter, by id (one file per room). */
import type { RoomId } from '../../types'
import type { RoomPainter } from '../api'
import { painter as driveway } from './driveway'
import { painter as foyer } from './foyer'
import { painter as parlour } from './parlour'
import { painter as kitchen } from './kitchen'
import { painter as conservatory } from './conservatory'
import { painter as pantry } from './pantry'
import { painter as boiler } from './boiler'
import { painter as lab } from './lab'
import { painter as storeroom } from './storeroom'
import { painter as study } from './study'
import { painter as roof } from './roof'

export const ROOM_PAINTERS: Record<RoomId, RoomPainter> = { driveway, foyer, parlour, kitchen, conservatory, pantry, boiler, lab, storeroom, study, roof }
