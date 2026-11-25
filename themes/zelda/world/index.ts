/**
 * The one world: the town (phareim.no's front door), Neon Shrine's coast, shrine and rooms, the Wildwood, and the
 * lands around them, all on one grid (`atlas.ts`, docs/worlds/atlas.md). A visitor starts in the town square
 * facing Petter's name.
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
import { ARENA } from './arena'
import { QUARRY } from './quarry'
import { PUZZLELAB } from './puzzlelab'
import { linkBack } from './demos'
import { ATLAS, rescueFrontier } from './atlas'
import { LANDS } from './lands'

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
    // Field battles' glade, down a root stair in the Sporelight (demos.ts).
    arena: linkBack(ARENA),
    // Dig & build's first map (`MapDef.dig`), down from Lumenby's pit: the tools are here.
    quarry: linkBack(QUARRY),
    // The physical puzzles' lab (`engine/puzzles/`), inside Stillsand's gold pyramid.
    puzzlelab: linkBack(PUZZLELAB),
    // The lands around the coast and the Wildwood (docs/worlds/atlas.md).
    ...LANDS,
  },
  start: { map: 'overworld', entry: 'start' },
  luna: LUNA_TALK,
  atlas: ATLAS,
  // Saves made in the generated frontier (gone since 2026-11) continue in the land that took its place.
  rescue: rescueFrontier,
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
