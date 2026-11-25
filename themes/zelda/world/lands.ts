/** The lands around the coast and the Wildwood (docs/worlds/atlas.md), by map id. */
import type { MapDef } from '../types'
import { SETERFELL } from './seterfell'
import { YULEFJORD } from './yulefjord'
import { SPORELIGHT } from './sporelight'
import { STILLSAND } from './stillsand'
import { RERUN } from './rerun'
import { LUMENBY } from './lumenby'
import { FOGSTAGE } from './fogstage'

export const LANDS: Record<string, MapDef> = {
  seterfell: SETERFELL,
  yulefjord: YULEFJORD,
  sporelight: SPORELIGHT,
  stillsand: STILLSAND,
  rerun: RERUN,
  lumenby: LUMENBY,
  fogstage: FOGSTAGE,
}
