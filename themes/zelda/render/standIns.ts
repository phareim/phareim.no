/**
 * The lands' solid scenery as the classic painters show it. A cart, a crate or a mailbox with a footprint
 * (`IsoLandmark.solid`) is solid to walkers in every view (`MapInfo.scenery`, engine/map.ts), but its picture is
 * the isometric view's own (`iso/frontierArt/`). Wherever that picture is not drawn (the classic view, the view
 * without WebGL2, the isometric view while the realm's chunk is on its way or after it failed) a plain stand-in
 * stands on each solid tile instead (`tiles.ts`), so nothing is in the way that cannot be seen. Pure.
 */
import type { MapDef, MapState, World } from '../types'
import { mapInfo } from '../engine/index'

/** A box (carts, crates, churns, sandbags, wagons, mowers), a thing on a pole, a mushroom, a lump of stone. */
export type StandIn = 'crate' | 'post' | 'cap' | 'stone'

const KINDS: Array<[RegExp, StandIn]> = [
  [/mushroom/, 'cap'],
  [/island|grazer|troll/, 'stone'],
  [/mailbox|flamingo|sprinkler|spotlight|headframe|mill|waystone/, 'post'],
]

export function standInOf(art: string): StandIn {
  return KINDS.find(([re]) => re.test(art))?.[1] ?? 'crate'
}

const cache = new WeakMap<MapDef, Map<number, StandIn>>()

/** The map's solid scenery tiles, each with the stand-in its landmark has. */
export function standIns(world: World, mapId: string): ReadonlyMap<number, StandIn> {
  const info = mapInfo(world, mapId)
  let out = cache.get(info.def)
  if (out) return out
  out = new Map()
  if (info.scenery.size) {
    for (const lm of info.def.isoLandmarks ?? []) {
      const r = lm.solid
      if (!r) continue
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        const i = y * info.w + x
        if (info.scenery.has(i) && !out.has(i)) out.set(i, standInOf(lm.art))
      }
    }
  }
  cache.set(info.def, out)
  return out
}

/**
 * Does a stand-in stand on tile `i` of the map now? Not on dig ground raised above the map's level: that rock is
 * in the way and in the picture already.
 */
export function standsIn(m: MapState, i: number): boolean {
  if (!m.scenery?.has(i)) return false
  return !m.dig || m.dig.h[i]! <= m.dig.g
}
