import type { ThingArt } from '../thingArt'
import { FOGSTAGE_ART } from './fogstageData'
import { RERUN_ART } from './rerunData'
import { SPORELIGHT_ART } from './sporelightData'
import { STILLSAND_ART } from './stillsandData'
import { FJORD_ART } from './fjordData'
import { QUARRY_ART } from './quarryData'
import { SETER_ART } from './seterData'
import { UNDERGLOW_ART } from './underglowData'

/** The isometric renderer only puts the current realm's scenery on the GPU. */
export const REALM_THING_ART: Record<string, Record<string, ThingArt>> = {
  fogstage: FOGSTAGE_ART,
  rerun: RERUN_ART,
  sporelight: SPORELIGHT_ART,
  stillsand: STILLSAND_ART,
  lumenby: QUARRY_ART,
  underglow: UNDERGLOW_ART,
  seterfell: SETER_ART,
  yulefjord: FJORD_ART,
}
