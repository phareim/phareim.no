/** The whole world: every map, and where a new game starts. */
import type { World } from '../types'
import { OVERWORLD } from './overworld'
import { SHRINE } from './shrine'
import { HUT, SHOP, ARCADE, CAVE } from './interiors'

/** Opens a new game once the hero has stepped out of the hut. */
export const INTRO = [
  'KEEPER: THE SUN HAS HUNG ON THE HORIZON FOR THREE NIGHTS. THE STATIC KING TOOK THE SUN PRISM INTO THE OLD NEON SHRINE.',
  'OPEN THAT CHEST, KID. THE BLADE INSIDE IS YOURS NOW.',
]

export const WORLD: World = {
  maps: {
    overworld: OVERWORLD,
    shrine: SHRINE,
    hut: HUT,
    shop: SHOP,
    arcade: ARCADE,
    cave: CAVE,
  },
  start: { map: 'overworld', entry: 'hut' },
  intro: { lines: INTRO, who: 'keeper' },
}
