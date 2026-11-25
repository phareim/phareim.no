/**
 * THE UNDERGLOW: the descent under Lumenby Quarry (`docs/worlds/realm-underglow.md`).
 * Six layers, each its own dungeon map of 3×2 camera rooms, each a little
 * stranger than the one above: miners' ledges, a grove that grows from the
 * ceiling, a glass sea, a layer where the radio talks back, a graveyard of
 * arcade cabinets, and the Core. Stairs up stand in the first room of every
 * layer, stairs down in the room furthest from them; at the bottom the
 * Geyser throws you home to the drift's mouth.
 *
 * Ids: `<region>:deep<n>` (n = 1…6) under the Lumenby region whose site has
 * the `deep` entry (the drift's mouth, `quests.ts` LANDMARK_SITES). Entries:
 * `up` (beside the stairs up) and `down` (beside the stairs down).
 *
 * Not here yet (README TODO): the Pull (climbing greys a heart), the
 * glowstick ranks and turnstiles, Rut's lifts, the PHI boss.
 */
import type { CellDef, EnemyKind, EntDef, IsoLandmark, ItemId, Mark, MapDef, TrackId } from '../../types'
import { carveRooms } from './cave'
import { DEEP_FOLK } from './quests'
import { Rng, hash } from './rng'
import type { RealmSpec } from './types'

const RW = 16
const RH = 12
export const DEEP_LAYERS = 6

interface Layer {
  name: string
  track: TrackId
  foes: Array<[EnemyKind, number]>
  /** What each room is dressed with: [tile, how many], placed off the room's middle cross. */
  dress: Array<[string, number]>
  /** A pool in the room's middle (the glass sea). */
  pool?: boolean
  /** The layer's prize in its far room. */
  prize?: ItemId
}

const LAYERS: Layer[] = [
  { name: 'ECHO LEDGES', track: 'dungeon', foes: [['bat', 3], ['blob', 1]], dress: [['t', 2], ['r', 3], ['o', 1]] },
  { name: 'THE UPSIDE GROVE', track: 'forest', foes: [['bat', 2], ['blob', 2]], dress: [['T', 5], [':', 6], [';', 4]], prize: 'heartPiece' },
  { name: 'THE GLASS SEA', track: 'beach', foes: [['blob', 3], ['bat', 1]], dress: [['r', 2], ['-', 8]], pool: true },
  { name: 'BROADCAST', track: 'static', foes: [['zapper', 3], ['eye', 1]], dress: [['M', 3], ['t', 1]], prize: 'heartPiece' },
  { name: 'THE FOSSIL ARCADE', track: 'static', foes: [['skull', 3], ['bat', 1]], dress: [['M', 4], ['G', 3]] },
  { name: 'THE CORE', track: 'boss', foes: [['zapper', 2], ['skull', 1]], dress: [['I', 4], ['t', 2]], prize: 'bigBag' },
]

export interface DescentCtx {
  seed: number
  /** The region over the drift: layer 1's stairs up lead to its `deep` entry. */
  top: string
  layer: number
  realm: RealmSpec
}

export const deepId = (top: string, n: number) => `${top}:deep${n}`

export function generateLayer(ctx: DescentCtx): MapDef {
  const L = LAYERS[ctx.layer - 1]!
  const rng = new Rng(hash(ctx.seed, 4242, ctx.layer))
  const cols = 3
  const rowsN = 2
  const { g, dist } = carveRooms(rng, cols, rowsN)
  const n = cols * rowsN
  const id = deepId(ctx.top, ctx.layer)
  const isoLandmarks: IsoLandmark[] = []
  const marks: Record<string, Mark> = {}
  let next = 0xe000
  const mark = (ent: EntDef, tile?: Mark['tile']) => { const ch = String.fromCharCode(next++); marks[ch] = tile ? { ent, tile } : { ent }; return ch }
  const foeChars = new Map<EnemyKind, string>()
  const foe = (k: EnemyKind) => { let c = foeChars.get(k); if (!c) { c = mark({ t: 'enemy', kind: k }); foeChars.set(k, c) } return c }
  let far = 0
  for (const [k, d] of dist) if (d > (dist.get(far) ?? 0)) far = k
  const fx = (far % cols) * RW
  const fy = Math.floor(far / cols) * RH

  // The way up, the way on down (or, at the bottom, the Geyser home).
  g[2]![3] = mark({ t: 'warp', to: ctx.layer === 1 ? ctx.top : deepId(ctx.top, ctx.layer - 1), entry: ctx.layer === 1 ? 'deep' : 'down' }, '>')
  const entries: MapDef['entries'] = { up: { x: 3.5, y: 3.5, dir: 'down' } }
  if (ctx.layer === 1) {
    isoLandmarks.push(
      { art: 'underglow_ledge_se', x: 6.5, y: 2.5 },
      { art: 'underglow_lift_cage', x: 6, y: 3.6 },
      { art: 'underglow_lift_rope', x: 6, y: 3.6, z: 0.78 },
      { art: 'underglow_lift_wheel', x: 6, y: 3.6, z: 1.6, motion: { frames: 4, fps: 1 } },
    )
  }
  if (ctx.layer < DEEP_LAYERS) {
    g[fy + 2]![fx + RW - 4] = mark({ t: 'warp', to: deepId(ctx.top, ctx.layer + 1), entry: 'up' }, '>')
    entries.down = { x: fx + RW - 4 + 0.5, y: fy + 3.5, dir: 'down' }
    const rank = (['rose', 'pink', 'cyan', 'violet', 'gold'] as const)[ctx.layer - 1]!
    isoLandmarks.push({ art: `underglow_glowstick_${rank}`, x: entries.down.x + 0.95, y: entries.down.y, lights: [{ tone: rank, r: 2.5, a: 0.8, z: 0.5, anim: 'pulse' }] })
  } else {
    // The Geyser: a ring of lamps round the hole it comes up through.
    const gx = fx + RW / 2
    const gy = fy + RH / 2
    for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) g[gy + dy]![gx + dx] = 't'
    g[gy]![gx] = mark({ t: 'warp', to: ctx.top, entry: 'deep' }, '>')
    entries.down = { x: gx + 0.5, y: gy + 1.5, dir: 'down' }
    isoLandmarks.push({ art: 'underglow_sun', x: gx + 0.5, y: gy - 1.3, motion: { frames: 2, fps: 1 }, lights: [{ tone: 'gold', r: 6, a: 0.8, z: 1.5, anim: 'pulse' }] })
    g[gy - 3]![gx - 4] = mark({ t: 'sign', lines: ['THE GEYSER', 'IT GOES UP. ALL THE WAY.'] })
  }

  const folk = [...(DEEP_FOLK[ctx.layer] ?? [])]
  for (let r = 0; r < n; r++) {
    const cx = (r % cols) * RW
    const cy = Math.floor(r / cols) * RH
    // Keep clear: the first room's stairs corner, the far room's stairs, the doorway cross.
    const keep = (x: number, y: number) => (r === 0 && x < 6 && y < 6) || (r === far && x > RW - 7 && y < 6) || Math.abs(y - RH / 2 + 0.5) < 2 || Math.abs(x - RW / 2 + 0.5) < 2
    const free = (x: number, y: number) => g[cy + y]![cx + x] === '.' && !keep(x, y)
    if (L.pool) {
      // A pool in the room's middle, a bridge across it on both axes.
      for (let y = 3; y < RH - 3; y++) for (let x = 4; x < RW - 4; x++) if (g[cy + y]![cx + x] === '.') g[cy + y]![cx + x] = Math.abs(y - RH / 2 + 0.5) < 1 || Math.abs(x - RW / 2 + 0.5) < 1 ? '=' : '~'
    }
    for (const [tile, k] of L.dress) {
      for (let i = 0; i < k; i++) {
        const x = rng.int(2, RW - 3)
        const y = rng.int(2, RH - 3)
        if (free(x, y)) {
          const tx = cx + x
          const ty = cy + y
          g[ty]![tx] = tile
          const art = ctx.layer === 2 && tile === 'T' ? 'underglow_roots' :
            ctx.layer === 3 && tile === 'r' ? `underglow_shards_${i % 2}` :
            ctx.layer === 4 && tile === 'M' ? `underglow_mast_${i % 3}` :
            ctx.layer === 5 && tile === 'M' ? 'underglow_cabinet' : null
          if (art) isoLandmarks.push({ art, x: tx + 0.5, y: ty + 0.5, cover: { x: tx, y: ty, w: 1, h: 1 } })
        }
      }
    }
    if (r !== 0) {
      const foes = rng.int(1, 2) + (ctx.layer > 3 ? 1 : 0)
      for (let i = 0; i < foes; i++) {
        const x = rng.int(3, RW - 4)
        const y = rng.int(3, RH - 4)
        if (free(x, y)) g[cy + y]![cx + x] = foe(rng.weighted(L.foes))
      }
    }
    // Someone of the deep stands in the second room (the first one off the stairs).
    if (r === (far === 1 ? 2 : 1) && folk.length) {
      const who = folk.shift()!
      g[cy + 3]![cx + 4] = mark(who)
    }
  }
  if (L.prize) g[fy + RH / 2 - 3]![fx + 3] = mark({ t: 'chest', id: `${id}.prize`, item: L.prize, big: true })
  const loot: ItemId = rng.weighted(ctx.realm.loot)
  const lr = rng.int(1, n - 1)
  g[Math.floor(lr / cols) * RH + RH - 3]![(lr % cols) * RW + 3] = mark({ t: 'chest', id: `${id}.c0`, item: loot })

  const name = `${ctx.realm.name} ${ctx.layer}: ${L.name}`
  const cells: Record<string, CellDef> = {}
  for (let r = 0; r < n; r++) cells[`${r % cols},${Math.floor(r / cols)}`] = { name }
  return {
    id,
    name,
    kind: 'dungeon',
    track: L.track,
    rows: g.map(r => r.join('')),
    cell: { w: RW, h: RH },
    cells,
    marks,
    entries,
    isoLandmarks,
    keyring: deepId(ctx.top, 0),
    realm: ctx.realm.id,
    ...(ctx.realm.look ? { look: ctx.realm.look } : {}),
    ...(ctx.realm.views ? { views: ctx.realm.views } : {}),
  }
}
