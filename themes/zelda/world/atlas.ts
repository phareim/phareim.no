/**
 * The one grid of the world (`docs/worlds/atlas.md`): where each outdoor map's top-left tile lies, x east and y
 * south, the overworld's top-left at (0, 0). Walking off a land's edge where a pass is open carries the hero into
 * the map that holds the next tile (`World.atlas`, `edgeOut` in `engine/game.ts`); the MAP page draws the world
 * from it. The hand-made maps' rows never change size, so their places never move.
 */
export const ATLAS: Record<string, { x: number; y: number }> = {
  overworld: { x: 0, y: 0 },
  wildwood: { x: -84, y: -12 },
  seterfell: { x: 0, y: -52 },
  yulefjord: { x: -40, y: -104 },
  sporelight: { x: 72, y: -52 },
  stillsand: { x: 104, y: 0 },
  rerun: { x: 104, y: 32 },
  lumenby: { x: -84, y: -52 },
  fogstage: { x: -172, y: -12 },
}

/**
 * The generated frontier that the lands replaced (2026-11-25): its macro map, one char a region of 64×44, and
 * the land that took each realm's place. A save made out there continues in that land: at the same gate when it
 * was made at one, else at the land's `camp`. The Green Miles and the Landing are gone; their saves continue at
 * the Crossroads and the pier.
 */
const OLD_MACRO = [
  '  YYYYYYYY  ',
  ' QSSSSSSPPP ',
  'QQQSSSGPPPPD',
  'QQQGSGGGPPDD',
  ' QGGGGGGGDDD',
  'FFFGGGGGRDDD',
  'FFFFGGGRRRDD',
  ' FFFGGGRRRR ',
  '   F  L     ',
]
const OLD_REALMS: Record<string, { map: string; entry?: string }> = {
  Y: { map: 'yulefjord' }, Q: { map: 'lumenby' }, S: { map: 'seterfell' }, P: { map: 'sporelight' },
  D: { map: 'stillsand' }, F: { map: 'fogstage' }, R: { map: 'rerun' },
  G: { map: 'overworld', entry: 'crossroads' }, L: { map: 'overworld', entry: 'ferry' },
}

/** Hand-made maps the world no longer has, and where a save made in one continues. */
const GONE: Record<string, { map: string; entry: string }> = {
  // The Old Quarry, dig & build's first map (both gone 2026-11-26): back up in Lumenby's pit.
  quarry: { map: 'lumenby', entry: 'pit' },
}

/** Where a save made on a map that is gone continues now (`World.rescue`), or null for an id that never was one. */
export function rescueGone(map: string, entry: string): { map: string; entry: string } | null {
  return GONE[map] ?? rescueFrontier(map, entry)
}

/** Where a save made in the generated frontier continues now, or null for an id that never was one. */
export function rescueFrontier(map: string, entry: string): { map: string; entry: string } | null {
  const m = /^fr:(\d+),(\d+)(?::(cave|deep)\d+)?$/.exec(map)
  if (!m) return null
  // The Underglow's layers hang under Lumenby's deep drift.
  if (m[3] === 'deep') return { map: 'lumenby', entry: 'deep' }
  const to = OLD_REALMS[OLD_MACRO[Number(m[2])]?.[Number(m[1])] ?? '']
  if (!to) return null
  if (to.entry) return { map: to.map, entry: to.entry }
  return { map: to.map, entry: !m[3] && /^gate-/.test(entry) ? entry : 'camp' }
}
