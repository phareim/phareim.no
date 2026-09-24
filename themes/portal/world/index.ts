/** The portal's world: the plaza, the arcade and Petter's house. Peaceful: no enemies, no damage, no sword. */
import type { ExitDef, World } from '../../zelda/types'
import { PLAZA } from './plaza'
import { ARCADE } from './arcade'
import { HOME } from './home'

export const PORTAL_WORLD: World = {
  maps: {
    plaza: PLAZA,
    arcade: ARCADE,
    home: HOME,
  },
  start: { map: 'plaza', entry: 'start' },
  peaceful: true,
}

/** Every exit in the world with the map it stands in, in authoring order (the page's hidden link list reads it). */
export function portalExits(world: World = PORTAL_WORLD): Array<ExitDef & { map: string }> {
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
export function worldStartingAt(map: unknown, entry: unknown, world: World = PORTAL_WORLD): World | null {
  if (typeof map !== 'string' || typeof entry !== 'string') return null
  const def = Object.prototype.hasOwnProperty.call(world.maps, map) ? world.maps[map] : undefined
  if (!def) return null
  const known = Object.prototype.hasOwnProperty.call(def.entries ?? {}, entry)
    || Object.values(def.marks).some(m => (m.ent.t === 'entry' || m.ent.t === 'exit') && m.ent.id === entry)
  return known ? { ...world, start: { map, entry } } : null
}
