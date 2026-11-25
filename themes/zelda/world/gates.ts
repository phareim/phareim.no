/**
 * The gates: the ways on foot from the hand-made coast and the Wildwood into the lands around them
 * (`docs/worlds/atlas.md`). Each is a short road between two lamp posts with a warden who stands aside only for
 * the blade. Both ends name the same entry, `gate-<id>`: the hand-made map has it just inside its warp tile, the
 * land has it just inside the warp on its rim, at the gate's place on the world's grid. A save can continue at
 * either end, so a gate's id is never renamed or removed.
 *
 * (No imports from the maps: they all read this file.)
 */
import type { Mark } from '../types'

export interface Gate {
  /** Stable: names the entry on both sides (`gate-<id>`). Never rename or remove: saves continue there. */
  id: string
  /** The land it leads into (a map id). */
  land: string
  /** The hand-made map it leads back to. */
  home: 'overworld' | 'wildwood'
}

export const GATES: Gate[] = [
  // North out of Whisper Woods, past a boulder: Seter Fell's pastures.
  { id: 'fell', land: 'seterfell', home: 'overworld' },
  // North out of the Night Market: the Sporelight.
  { id: 'spore', land: 'sporelight', home: 'overworld' },
  // East out of the Hollow Graves, through a cracked wall: Stillsand.
  { id: 'sand', land: 'stillsand', home: 'overworld' },
  // East along Mirror Lake's shore: Rerun Estates.
  { id: 'lawns', land: 'rerun', home: 'overworld' },
  // North out of the Wildwood's Riddle Grove: Lumenby Quarry.
  { id: 'quarry', land: 'lumenby', home: 'wildwood' },
  // West out of the Deep Woods, past the ravine: Fogstage.
  { id: 'fog', land: 'fogstage', home: 'wildwood' },
]

const gate = (id: string): Gate => {
  const g = GATES.find(x => x.id === id)
  if (!g) throw new Error(`no gate ${id}`)
  return g
}

/** A gate's warp tile on its hand-made map: into its land, at the gate. */
export function gateWarp(id: string): Mark {
  return { ent: { t: 'warp', to: gate(id).land, entry: `gate-${id}` }, tile: ',' }
}

/** A gate's warp tile on its land's rim: back to the hand-made map, at the gate. */
export function gateHome(id: string): Mark {
  const g = gate(id)
  return { ent: { t: 'warp', to: g.home, entry: `gate-${id}` }, tile: ',' }
}
