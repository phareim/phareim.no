/**
 * What a map's physical puzzles are, read once from its MapInfo (cached):
 * emitters, receivers, boulders, sluice groups, valves, weighed plates and
 * the mirrors' home tiles, the lumen tubes' sockets and boards. Unmarked
 * puzzle tiles take defaults: an emitter shines down, a receiver sets
 * `beam:<map>:<tile>`, a plate is `w:<tile>`, a socket `tube:<map>:<tile>`.
 */
import type { Cond, Dir, TileChar } from '../../types'
import { PUZZLE_TILES, WEIGHT_PLATES, isMirror } from '../../world/puzzles'
import { SOCKET, TAP, TUBE_TILES, isTube } from '../../world/tubes'
import type { MapInfo } from '../map'

export interface Emitter { idx: number; dir: Dir; when?: Cond; cell: number; src?: 'lamp' | 'box' }
export interface Sluice { key: string; flag: string; invert: boolean; tiles: number[] }
/** Lumen tubes side by side, with the taps and sockets beside them: one puzzle. */
export interface TubeBoard { tubes: number[]; taps: number[]; sockets: number[] }

export interface PuzzleInfo {
  /** The map has puzzle tiles: the puzzle rules run. */
  on: boolean
  /** Foes knocked into pits, water and spikes fall, drown or are hurt (`MapDef.physics`, or `on`). */
  physical: boolean
  ice: boolean
  emitters: Emitter[]
  receivers: Map<number, string>
  boulders: Map<number, { dir: Dir; flag?: string }>
  sluices: Sluice[]
  sluiceOf: Map<number, Sluice>
  valves: Map<number, string>
  /** Weighed plate tiles → plate id (pans sharing an id are one scale). */
  weights: Map<number, string>
  /** Plate ids whose tiles are all scale pans or a mix with one: they need equal weight. */
  scales: Set<string>
  /** Authored mirrors per camera room: [tile, char]. */
  mirrors: Map<number, Array<[number, TileChar]>>
  /** Lumen tubes' sockets: the flag each sets when fed, and the letter it lights. */
  sockets: Map<number, { flag: string; letter?: string }>
  /** Lumen tubes' boards. */
  boards: TubeBoard[]
}

const cache = new WeakMap<MapInfo, PuzzleInfo>()

function cellOf(info: MapInfo, idx: number): number {
  const cx = Math.max(0, Math.min(info.cols - 1, Math.floor((idx % info.w) / info.cw)))
  const cy = Math.max(0, Math.min(info.rows - 1, Math.floor(Math.floor(idx / info.w) / info.ch)))
  return cy * info.cols + cx
}

export function puzzleInfo(info: MapInfo): PuzzleInfo {
  let p = cache.get(info)
  if (p) return p
  const id = info.def.id
  p = {
    on: info.base.some(t => PUZZLE_TILES.has(t)),
    physical: false, ice: info.base.includes('α'),
    emitters: [], receivers: new Map(), boulders: new Map(), sluices: [], sluiceOf: new Map(), valves: new Map(),
    weights: new Map(), scales: new Set(), mirrors: new Map(), sockets: new Map(), boards: [],
  }
  // (Tubes alone leave the combat as it was: no foe falls for them.)
  p.physical = info.base.some(t => PUZZLE_TILES.has(t) && !TUBE_TILES.has(t)) || !!info.def.physics
  const marked = new Set<number>()
  const groups = new Map<string, Sluice>()
  for (const m of info.marks) {
    const idx = m.y * info.w + m.x
    const e = m.ent
    if (e.t === 'emitter') { p.emitters.push({ idx, dir: e.dir, when: e.when, cell: cellOf(info, idx) }); marked.add(idx) }
    else if (e.t === 'receiver') p.receivers.set(idx, e.flag)
    else if (e.t === 'boulder') p.boulders.set(idx, { dir: e.dir, flag: e.flag })
    else if (e.t === 'valve') p.valves.set(idx, e.flag)
    else if (e.t === 'socket') p.sockets.set(idx, { flag: e.flag, ...(e.letter ? { letter: e.letter } : {}) })
    else if (e.t === 'sluice') {
      const key = `${e.flag}|${e.invert ? 1 : 0}`
      let g = groups.get(key)
      if (!g) { g = { key, flag: e.flag, invert: !!e.invert, tiles: [] }; groups.set(key, g); p.sluices.push(g) }
      g.tiles.push(idx)
      p.sluiceOf.set(idx, g)
    }
  }
  info.base.forEach((t, idx) => {
    if (t === 'β' && !marked.has(idx)) p!.emitters.push({ idx, dir: 'down', cell: cellOf(info, idx) })
    else if (t === 'ρ' && !p!.receivers.has(idx)) p!.receivers.set(idx, `beam:${id}:${idx}`)
    else if (t === SOCKET && !p!.sockets.has(idx)) p!.sockets.set(idx, { flag: `tube:${id}:${idx}` })
    else if (WEIGHT_PLATES[t] !== undefined) {
      const pid = info.plates.get(idx) ?? `w:${idx}`
      p!.weights.set(idx, pid)
      if (t === 'σ') p!.scales.add(pid)
    } else if (isMirror(t)) {
      const cell = cellOf(info, idx)
      const list = p!.mirrors.get(cell) ?? []
      list.push([idx, t])
      p!.mirrors.set(cell, list)
    }
  })
  p.boards = tubeBoards(info)
  cache.set(info, p)
  return p
}

/** The lumen tubes' boards: tubes, taps and sockets joined side by side, as authored. */
function tubeBoards(info: MapInfo): TubeBoard[] {
  const out: TubeBoard[] = []
  const seen = new Set<number>()
  const w = info.w
  info.base.forEach((t, start) => {
    if (!TUBE_TILES.has(t) || seen.has(start)) return
    const b: TubeBoard = { tubes: [], taps: [], sockets: [] }
    const stack = [start]
    seen.add(start)
    while (stack.length) {
      const i = stack.pop()!
      const c = info.base[i]!
      if (c === TAP) b.taps.push(i)
      else if (c === SOCKET) b.sockets.push(i)
      else if (isTube(c)) b.tubes.push(i)
      const x = i % w
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= info.base.length || seen.has(j) || !TUBE_TILES.has(info.base[j]!)) continue
        seen.add(j)
        stack.push(j)
      }
    }
    for (const l of [b.tubes, b.taps, b.sockets]) l.sort((a, z) => a - z)
    out.push(b)
  })
  return out
}

/** Is the sluice group full now (water) rather than drained (floor)? */
export function sluiceFull(flags: Record<string, true>, g: Sluice): boolean {
  return g.invert ? flags[g.flag] === true : flags[g.flag] !== true
}

/** The floor that lies under tile `idx` once what stands on it moves away (puzzle maps only). */
export function floorUnder(info: MapInfo, p: PuzzleInfo, flags: Record<string, true>, idx: number): TileChar {
  const g = p.sluiceOf.get(idx)
  if (g) return sluiceFull(flags, g) ? 'ω' : 'ψ'
  const b = info.base[idx]!
  if (b === 'α' || b === 'θ' || b === 'η' || b === 'σ' || b === '_' || b === ',' || b === ':' || b === 'ψ') return b
  return '.'
}

/**
 * A puzzle save flag of map `id`, read by its prefix: map ids may hold ':' themselves (the frontier's `fr:<x>,<y>`).
 * `fill:<map>:<tile>` → { fill }, `boulder:<map>:<home>:<rest>` → { home, rest }; null for anything else.
 */
export function puzzleFlag(f: string, id: string): { fill: number } | { home: number; rest: number } | null {
  if (f.startsWith(`fill:${id}:`)) {
    const fill = Number(f.slice(id.length + 6))
    return Number.isInteger(fill) ? { fill } : null
  }
  if (!f.startsWith(`boulder:${id}:`)) return null
  const q = f.slice(id.length + 9).split(':')
  const home = Number(q[0])
  const rest = Number(q[1])
  return q.length === 2 && Number.isInteger(home) && Number.isInteger(rest) ? { home, rest } : null
}
