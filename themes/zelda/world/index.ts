/**
 * The one world: the town (phareim.no's front door) and Neon Shrine's coast,
 * shrine and rooms. A visitor starts in the town square facing Petter's name.
 */
import type { ExitDef, World } from '../types'
import { hasEntry } from '../engine/game'
import { OVERWORLD } from './overworld'
import { SHRINE } from './shrine'
import { HUT, SHOP, CAVE, MOSSA, RADIO } from './interiors'
import { ARCADE, HOME, VIP } from './town'
import { WILDWOOD } from './wildwood'
import { LAB1, LAB1B } from './lab1'
import { DEEP1, DEEP2 } from './lab2'
import { LUNA_TALK } from './luna'
import { frontierMap } from './gen/frontier'
import { ARENA } from './arena'
import { QUARRY } from './quarry'
import { PUZZLELAB } from './puzzlelab'

export { INTRO } from './intro'

export const WORLD: World = {
  maps: {
    overworld: OVERWORLD,
    shrine: SHRINE,
    hut: HUT,
    shop: SHOP,
    cave: CAVE,
    arcade: ARCADE,
    vip: VIP,
    home: HOME,
    wildwood: WILDWOOD,
    mossa: MOSSA,
    radio: RADIO,
    lab1: LAB1,
    lab1b: LAB1B,
    deep1: DEEP1,
    deep2: DEEP2,
    // Field battles' demo glade: not linked from the world yet.
    arena: ARENA,
    // Dig & build's demo (`MapDef.dig`), not linked from the world yet.
    quarry: QUARRY,
    // The physical puzzles' lab (`engine/puzzles/`): not linked from the world yet.
    puzzlelab: PUZZLELAB,
  },
  start: { map: 'overworld', entry: 'start' },
  luna: LUNA_TALK,
  // The frontier across the bay: regions made when first walked into (docs/worlds/).
  generate: id => frontierMap(id),
}

/** Every exit in the world with the map it stands in, in authoring order (the page's hidden link list reads it). */
export function worldExits(world: World = WORLD): Array<ExitDef & { map: string }> {
  const out: Array<ExitDef & { map: string }> = []
  for (const [map, def] of Object.entries(world.maps)) {
    for (const m of Object.values(def.marks)) if (m.ent.t === 'exit') out.push({ ...m.ent, map })
  }
  return out
}

/**
 * A copy of the world that starts at `entry` in `map` — coming back from a
 * cabinet or door — or null when that spot is not in the world (an old or
 * tampered `portal.return`). Exits register an entry under their own id.
 */
export function worldStartingAt(map: unknown, entry: unknown, world: World = WORLD): World | null {
  return hasEntry(world, map, entry) ? { ...world, start: { map: map as string, entry: entry as string } } : null
}
