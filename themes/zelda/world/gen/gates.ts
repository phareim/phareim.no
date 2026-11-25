/**
 * The gates: ways on foot from the hand-made world straight into the
 * frontier's realms, besides the ferry. Data only: each gate names a region,
 * the side of its rim the gate is cut into and where along it, and the spot
 * on the hand-made map (the overworld or the Wildwood) it leads back to.
 *
 * Both ends name the same entry, `gate-<id>`: the hand-made map has it beside
 * its warp tile, and the region generator cuts the gate after everything else
 * is placed (`region.ts`, cutGate), so a gate moves no chest, cache or
 * folk. A save can continue at either end, so a gate's id is never renamed or
 * removed; new gates are added at the end.
 *
 * (No imports from frontier.ts or the hand-made maps: both read this file.)
 */
import type { Mark } from '../../types'

export interface Gate {
  /** Stable: names the entry on both sides (`gate-<id>`). Never rename or remove: saves continue there. */
  id: string
  /** The region it leads into: `fr:<rx>,<ry>`. */
  region: string
  /** The side of the region's rim the gate is cut into. */
  side: 'n' | 's' | 'e' | 'w'
  /** Where along that side it would like to be (tiles); the cheapest spot near it wins. */
  at?: number
  /** The hand-made map it leads back to, and its entry there (`gate-<id>`). */
  home: { map: 'overworld' | 'wildwood'; entry: string }
  /** The sign beside the gate on the region's side: the pixel font, 30 letters a line at most. */
  lines: string[]
}

const gate = (id: string, region: string, side: Gate['side'], at: number, map: Gate['home']['map'], lines: string[]): Gate =>
  ({ id, region, side, at, home: { map, entry: `gate-${id}` }, lines })

export const GATES: Gate[] = [
  // North out of Whisper Woods, past a boulder: Seter Fell's pastures, Yule Fjord beyond them.
  gate('fell', 'fr:4,1', 's', 54, 'overworld', ['THE WOODS GATE', 'SOUTH: WHISPER WOODS.', 'CROSSROADS CAMP: SOUTH-EAST.']),
  // North out of the Night Market, past its warden: the Sporelight (and the Battle Glade).
  gate('spore', 'fr:7,2', 's', 17, 'overworld', ['THE MARKET GATE', 'SOUTH: NIGHT MARKET.', 'CROSSROADS CAMP: SOUTH.']),
  // East out of the Hollow Graves, through a cracked wall: Stillsand (and the Puzzle Lab).
  gate('sand', 'fr:9,4', 'w', 21, 'overworld', ['THE GRAVES GATE', 'WEST: HOLLOW GRAVES.', 'CROSSROADS CAMP: SOUTH-WEST.']),
  // East along Mirror Lake's shore, past its warden: Rerun's lawns.
  gate('lawns', 'fr:8,6', 'w', 22, 'overworld', ['THE LAKE GATE', 'WEST: MIRROR LAKE.', 'CROSSROADS CAMP: WEST.']),
  // North out of the Wildwood's Riddle Grove: Lumenby, the Old Quarry and the deep drift.
  gate('quarry', 'fr:2,2', 's', 7, 'wildwood', ['THE GROVE GATE', 'SOUTH: RIDDLE GROVE.', 'CROSSROADS CAMP: SOUTH-EAST.']),
  // West out of the Deep Woods, past the ravine: Fogstage.
  gate('fog', 'fr:2,6', 'e', 25, 'wildwood', ['THE DEEP WOODS GATE', 'EAST: THE DEEP WOODS.', 'CROSSROADS CAMP: EAST.']),
]

/** A gate's warp tile on its hand-made map: into its region, at the gate. */
export function gateWarp(id: string): Mark {
  const g = GATES.find(x => x.id === id)
  if (!g) throw new Error(`no gate ${id}`)
  return { ent: { t: 'warp', to: g.region, entry: `gate-${g.id}` }, tile: ',' }
}

/** The gate cut into a region, if there is one. */
export function gateOf(region: string): Gate | undefined {
  return GATES.find(g => g.region === region)
}
