/**
 * A cave under a region: a small dungeon of camera rooms (16×12, the labs'
 * size) made from the region's seed. The rooms are joined by a random
 * spanning tree of doorways; the stairs back up stand in the first room, a
 * chest in the room furthest from it, foes of the deep in between.
 */
import type { CellDef, EnemyKind, EntDef, ItemId, Mark, MapDef } from '../../types'
import { Rng, hash } from './rng'
import type { RealmSpec } from './types'

const RW = 16
const RH = 12

export interface CaveCtx {
  seed: number
  id: string
  /** The region map and the entry beside the stairs down. */
  up: { map: string; entry: string }
  realm: RealmSpec
  depth: number
}

const CAVE_FOES: Array<[EnemyKind, number]> = [['bat', 3], ['blob', 2], ['skull', 2], ['spitter', 1]]

export function generateCave(ctx: CaveCtx): MapDef {
  const rng = new Rng(hash(ctx.seed, 991))
  const cols = rng.int(2, 3)
  const rowsN = 2
  const W = cols * RW
  const H = rowsN * RH
  const g: string[][] = []
  for (let y = 0; y < H; y++) g.push(new Array(W).fill('#'))
  // Room floors.
  for (let cy = 0; cy < rowsN; cy++) for (let cx = 0; cx < cols; cx++) {
    for (let y = 1; y < RH - 1; y++) for (let x = 1; x < RW - 1; x++) g[cy * RH + y]![cx * RW + x] = '.'
  }
  // Doorways along a spanning tree (random DFS), two tiles wide.
  const n = cols * rowsN
  const seen = new Set<number>([0])
  const stack = [0]
  const dist = new Map<number, number>([[0, 0]])
  while (stack.length) {
    const r = stack[stack.length - 1]!
    const cx = r % cols
    const cy = Math.floor(r / cols)
    const next = rng.shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]] as Array<[number, number]>)
      .map(([dx, dy]) => [cx + dx, cy + dy] as const)
      .filter(([x, y]) => x >= 0 && y >= 0 && x < cols && y < rowsN && !seen.has(y * cols + x))
    if (!next.length) { stack.pop(); continue }
    const [nx, ny] = next[0]!
    const k = ny * cols + nx
    seen.add(k)
    dist.set(k, dist.get(r)! + 1)
    stack.push(k)
    if (nx !== cx) {
      const wx = Math.max(cx, nx) * RW
      for (const y of [RH / 2 - 1, RH / 2]) { g[cy * RH + y]![wx - 1] = '.'; g[cy * RH + y]![wx] = '.' }
    } else {
      const wy = Math.max(cy, ny) * RH
      for (const x of [RW / 2 - 1, RW / 2]) { g[wy - 1]![cx * RW + x] = '.'; g[wy]![cx * RW + x] = '.' }
    }
  }
  const marks: Record<string, Mark> = {}
  let next = 0xe000
  const mark = (ent: EntDef, tile?: Mark['tile']) => { const ch = String.fromCharCode(next++); marks[ch] = tile ? { ent, tile } : { ent }; return ch }
  const foeChars = new Map<EnemyKind, string>()
  const foe = (k: EnemyKind) => { let c = foeChars.get(k); if (!c) { c = mark({ t: 'enemy', kind: k }); foeChars.set(k, c) } return c }
  // The first room: the stairs up and where you arrive.
  g[2]![3] = mark({ t: 'warp', to: ctx.up.map, entry: ctx.up.entry }, '>')
  const entries = { in: { x: 3.5, y: 3.5, dir: 'down' as const } }
  // Dressing and foes per room.
  let far = 0
  for (const [k, d] of dist) if (d > (dist.get(far) ?? 0)) far = k
  for (let r = 0; r < n; r++) {
    const cx = (r % cols) * RW
    const cy = Math.floor(r / cols) * RH
    const free = (x: number, y: number) => g[cy + y]![cx + x] === '.' && !(r === 0 && x < 6 && y < 6)
    // Pillars in a symmetric pair, a few pots and rocks.
    if (rng.chance(0.6)) for (const [x, y] of [[4, 3], [RW - 5, 3], [4, RH - 4], [RW - 5, RH - 4]]) if (free(x!, y!)) g[cy + y!]![cx + x!] = 'I'
    for (let i = 0; i < rng.int(1, 4); i++) {
      const x = rng.int(2, RW - 3)
      const y = rng.int(2, RH - 3)
      if (free(x, y) && Math.abs(y - RH / 2) > 1 && Math.abs(x - RW / 2) > 1) g[cy + y]![cx + x] = rng.chance(0.6) ? 'o' : 'r'
    }
    if (r === 0) continue
    const foes = rng.int(1, 2) + (ctx.depth > 3 ? 1 : 0)
    for (let i = 0; i < foes; i++) {
      const x = rng.int(3, RW - 4)
      const y = rng.int(3, RH - 4)
      if (free(x, y)) g[cy + y]![cx + x] = foe(rng.weighted(CAVE_FOES))
    }
  }
  const loot: ItemId = rng.weighted<ItemId>([['bits50', 3], ['bombs5', 2], ['heart', 1], ['bits20', 2]])
  const fx = (far % cols) * RW + RW / 2
  const fy = Math.floor(far / cols) * RH + RH / 2
  g[fy - 2]![fx] = mark({ t: 'chest', id: `${ctx.id}.c0`, item: loot })
  const cells: Record<string, CellDef> = {}
  for (let r = 0; r < n; r++) cells[`${r % cols},${Math.floor(r / cols)}`] = { name: `${ctx.realm.name}: CAVE` }
  return {
    id: ctx.id,
    name: `${ctx.realm.name}: CAVE`,
    kind: 'dungeon',
    track: 'dungeon',
    rows: g.map(r => r.join('')),
    cell: { w: RW, h: RH },
    cells,
    marks,
    entries,
    keyring: ctx.id,
    realm: ctx.realm.id,
    ...(ctx.realm.views ? { views: ctx.realm.views } : {}),
  }
}
