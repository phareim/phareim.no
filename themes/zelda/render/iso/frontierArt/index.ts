import type { ThingArt } from '../thingArt'
import { FOGSTAGE_ART } from './fogstageData'
import { RERUN_ART } from './rerunData'
import { SPORELIGHT_ART } from './sporelightData'
import { STILLSAND_ART } from './stillsandData'
import { FJORD_ART } from './fjordData'
import { QUARRY_ART } from './quarryData'
import { SETER_ART } from './seterData'
import { UNDERGLOW_ART } from './underglowData'
import { MEADOW_ART } from './meadowData'
import { LANDING_ART } from './landingData'
import { GATES_ART } from './gatesData'

function withGate(realm: string, art: Record<string, ThingArt>): Record<string, ThingArt> {
  const gates = Object.entries(GATES_ART).filter(([id]) => id.startsWith(`gate_${realm}_`))
  return { ...art, ...Object.fromEntries(gates) }
}

/** The isometric renderer only puts the current realm's scenery on the GPU. */
export const REALM_THING_ART: Record<string, Record<string, ThingArt>> = {
  fogstage: withGate('fogstage', FOGSTAGE_ART),
  rerun: withGate('rerun', RERUN_ART),
  sporelight: withGate('sporelight', SPORELIGHT_ART),
  stillsand: withGate('stillsand', STILLSAND_ART),
  lumenby: withGate('lumenby', QUARRY_ART),
  underglow: UNDERGLOW_ART,
  seterfell: withGate('seterfell', SETER_ART),
  yulefjord: FJORD_ART,
  meadow: MEADOW_ART,
  landing: LANDING_ART,
  coast: Object.fromEntries(Object.entries(GATES_ART).filter(([id]) => !id.startsWith('gate_'))),
}
