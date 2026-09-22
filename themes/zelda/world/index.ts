/** The whole world: every map, and where a new game starts. */
import type { World } from '../types'
import { OVERWORLD } from './overworld'
import { SHRINE } from './shrine'
import { SHOP, ARCADE, CAVE } from './interiors'

export const WORLD: World = {
  maps: {
    overworld: OVERWORLD,
    shrine: SHRINE,
    shop: SHOP,
    arcade: ARCADE,
    cave: CAVE,
  },
  start: { map: 'overworld', entry: 'start' },
}
