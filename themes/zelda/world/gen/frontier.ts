/**
 * The frontier: the generated world across the bay from the town. A grid of
 * regions, one map each, made when first asked for and kept. A region's id
 * is `fr:<rx>,<ry>`; its caves are `fr:<rx>,<ry>:cave<n>`, and the layers of
 * the Underglow under the Lumenby region with the deep drift
 * `fr:<rx>,<ry>:deep<n>` (`descent.ts`).
 *
 * The macro map below says which realm each region belongs to; inside a
 * region everything is made from the seed (`region.ts`). The ferry from the
 * town's pier lands at `landing`, and walking off a region's edge through a
 * pass leads into the next one (MapDef.edges).
 */
import type { MapDef } from '../../types'
import { hash } from './rng'
import { generateCave } from './cave'
import { DEEP_LAYERS, generateLayer } from './descent'
import { SITES } from './quests'
import { DEMO_SITES } from './demos'
import { generateRegion } from './region'
import { REALMS } from './realms'
import type { FrontierSpec, RealmSpec } from './types'

export const FRONTIER: FrontierSpec = {
  seed: 0x5eed1,
  w: 64,
  h: 44,
  // The macro map, north up; ' ' is the sea. The ferry lands at L in the
  // south; the Green Miles (G) are the plain between the realms. The cold
  // runs along the north (Yule Fjord's long fjord, west to east, over the
  // pastures of Seter Fell); the quarry hills (Q, and the Underglow under
  // them) in the west; the Sporelight's fungus wood in the north-east, the
  // Stillsand desert east; Fogstage's lowland south-west, Rerun's lawns
  // south-east, nearest the ferry.
  layout: [
    '  YYYYYYYY  ',
    ' QSSSSSSPPP ',
    'QQQSSSGPPPPD',
    'QQQGSGGGPPDD',
    ' QGGGGGGGDDD',
    'FFFGGGGGRDDD',
    'FFFFGGGRRRDD',
    ' FFFGGGRRRR ',
    '   F  L     ',
  ],
  realms: { L: 'landing', G: 'meadow', Q: 'lumenby', S: 'seterfell', Y: 'yulefjord', D: 'stillsand', P: 'sporelight', F: 'fogstage', R: 'rerun' },
  landing: { rx: 6, ry: 8 },
  sites: [...SITES, ...DEMO_SITES],
}

export const FRONTIER_PREFIX = 'fr:'

export function regionId(rx: number, ry: number): string {
  return `${FRONTIER_PREFIX}${rx},${ry}`
}

/** The realm of a region, or null where the macro map has sea. */
export function realmAt(rx: number, ry: number, F: FrontierSpec = FRONTIER): RealmSpec | null {
  const ch = F.layout[ry]?.[rx]
  if (!ch || ch === ' ') return null
  return REALMS[F.realms[ch] ?? ''] ?? null
}

/** Every region of the frontier, west to east, north to south. */
export function regions(F: FrontierSpec = FRONTIER): Array<{ rx: number; ry: number; id: string; realm: RealmSpec }> {
  const out: Array<{ rx: number; ry: number; id: string; realm: RealmSpec }> = []
  F.layout.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      const realm = realmAt(rx, ry, F)
      if (realm) out.push({ rx, ry, id: regionId(rx, ry), realm })
    }
  })
  return out
}

/**
 * The region holding a realm's heart piece: one per realm, the region of that
 * realm furthest from the Landing (the first of them by a hash of the realm).
 */
function heartRegion(realm: RealmSpec, F: FrontierSpec): string | null {
  if (realm.id === 'landing') return null
  const mine = regions(F).filter(r => r.realm.id === realm.id)
  if (!mine.length) return null
  const depth = (r: { rx: number; ry: number }) => Math.abs(r.rx - F.landing.rx) + Math.abs(r.ry - F.landing.ry)
  const far = Math.max(...mine.map(depth))
  const ends = mine.filter(r => depth(r) === far)
  return ends[hash(F.seed, realm.id.length, realm.id.charCodeAt(0)) % ends.length]!.id
}

const made = new Map<string, MapDef | null>()

/** A generated map by id, or null for an id the frontier does not have. Made once, then kept. */
export function frontierMap(id: string, F: FrontierSpec = FRONTIER): MapDef | null {
  if (!id.startsWith(FRONTIER_PREFIX)) return null
  const key = F === FRONTIER ? id : `${F.seed}:${id}`
  if (made.has(key)) return made.get(key)!
  const def = make(id, F)
  made.set(key, def)
  return def
}

function make(id: string, F: FrontierSpec): MapDef | null {
  const m = /^fr:(\d+),(\d+)(?::(cave|deep)(\d+))?$/.exec(id)
  if (!m) return null
  const rx = Number(m[1])
  const ry = Number(m[2])
  const realm = realmAt(rx, ry, F)
  if (!realm) return null
  const depth = Math.abs(rx - F.landing.rx) + Math.abs(ry - F.landing.ry)
  if (m[3] !== undefined) {
    const region = frontierMap(regionId(rx, ry), F)
    const n = Number(m[4])
    if (m[3] === 'deep') {
      if (!region?.entries?.deep || n < 1 || n > DEEP_LAYERS || String(n) !== m[4]) return null
      return generateLayer({ seed: hash(F.seed, rx, ry, 606), top: region.id, layer: n, realm: REALMS.underglow! })
    }
    if (!region?.entries?.[`cave${n}`]) return null
    return generateCave({ seed: hash(F.seed, rx, ry, n), id, up: { map: region.id, entry: `cave${n}` }, realm, depth })
  }
  const nb = (dx: number, dy: number) => (realmAt(rx + dx, ry + dy, F) ? regionId(rx + dx, ry + dy) : undefined)
  const edges: Partial<Record<'n' | 's' | 'e' | 'w', string>> = {}
  const n = nb(0, -1); if (n) edges.n = n
  const s = nb(0, 1); if (s) edges.s = s
  const e = nb(1, 0); if (e) edges.e = e
  const w = nb(-1, 0); if (w) edges.w = w
  return generateRegion({
    F, realm, rx, ry, id: regionId(rx, ry), edges, depth,
    landing: rx === F.landing.rx && ry === F.landing.ry,
    heart: heartRegion(realm, F) === regionId(rx, ry),
  })
}
