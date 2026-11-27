/**
 * The lands around the coast and the Wildwood (docs/worlds/atlas.md): each land's module exports its maps (the land
 * itself and its caves and rooms) as `MAPS`, and the world takes them all from here.
 */
import type { MapDef } from '../types'
import { MAPS as seterfell } from './seterfell'
import { MAPS as yulefjord } from './yulefjord'
import { MAPS as sporelight } from './sporelight'
import { MAPS as stillsand } from './stillsand'
import { MAPS as rerun } from './rerun'
import { MAPS as lumenby } from './lumenby'
import { MAPS as fogstage } from './fogstage'
import { MAPS as underglow } from './underglow'

export const LANDS: Record<string, MapDef> = { ...seterfell, ...yulefjord, ...sporelight, ...stillsand, ...rerun, ...lumenby, ...fogstage, ...underglow }
// (A dungeon's maps are not a land's: `dungeons.ts` takes them, never this file.)
