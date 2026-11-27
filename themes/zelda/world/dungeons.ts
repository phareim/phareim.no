/**
 * The dungeons' maps. The browser fetches this module as a chunk of its own (`dungeonLoad.ts`), so a visitor who
 * only walks the town downloads none of it; `world/index.ts` (tests, labs, the stage) holds it from the start.
 *
 * A new dungeon: one import and one spread here. Nowhere else.
 * (A chest or floor item that pays bits also takes a line in `dungeon-bits.ts`.) A map belongs here when it is
 * `resume`, is not on the atlas, holds no `exit`, and every way into it from outside the dungeons is a warp.
 */
import type { MapDef } from '../types'
import { MAPS as echobarrow } from './echobarrow'
import { MAPS as steamhouse } from './steamhouse'
import { MAPS as lighthouse } from './lighthouse'
import { MAPS as lateshow } from './lateshow'
import { MAPS as actthree } from './actthree'
import { EXAMINATION, EXAMTOP } from './examination'
import { HEAP_MAPS as heap } from './heap'
import { MAPS as balance } from './balance'

export const DUNGEONS: Record<string, MapDef> = {
  ...echobarrow,
  ...steamhouse,
  ...lighthouse,
  ...lateshow,
  ...actthree,
  // The test behind the Puzzle Lab (a stair in its last room), and the hall at its top.
  examination: EXAMINATION,
  examtop: EXAMTOP,
  ...heap,
  // The last one, under the Shrine's pedestal.
  ...balance,
}
