/** The whole game's content, assembled for the engine. */
import type { Content } from '../engine/game'
import type { RoomDef, RoomId } from '../types'
import { HEROES, NPCS } from './heroes'
import { ITEMS } from './items'
import { intro } from './story'
import { hint, lookHero } from './hints'
import { room as driveway } from './rooms/driveway'
import { room as foyer } from './rooms/foyer'
import { room as parlour } from './rooms/parlour'
import { room as kitchen } from './rooms/kitchen'
import { room as conservatory } from './rooms/conservatory'
import { room as pantry } from './rooms/pantry'
import { room as boiler } from './rooms/boiler'
import { room as lab } from './rooms/lab'
import { room as storeroom } from './rooms/storeroom'
import { room as study } from './rooms/study'
import { room as roof } from './rooms/roof'

const ROOMS: Record<RoomId, RoomDef> = { driveway, foyer, parlour, kitchen, conservatory, pantry, boiler, lab, storeroom, study, roof }

export const CONTENT: Content = {
  rooms: ROOMS,
  items: ITEMS,
  heroes: HEROES,
  npcs: NPCS,
  intro,
  hint,
  lookHero,
}
