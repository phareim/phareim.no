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

export const LANDS: Record<string, MapDef> = { ...seterfell, ...yulefjord, ...sporelight, ...stillsand, ...rerun, ...lumenby, ...fogstage }
