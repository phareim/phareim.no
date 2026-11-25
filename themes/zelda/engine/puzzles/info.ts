/**
 * What a map's physical puzzles are, read once from its MapInfo (cached):
 * emitters, receivers, boulders, sluice groups, valves, weighed plates and
 * the mirrors' home tiles. Unmarked puzzle tiles take defaults: an emitter
 * shines down, a receiver sets `beam:<map>:<tile>`, a plate is `w:<tile>`.
 */
import type { Cond, Dir, TileChar } from '../../types'
import { PUZZLE_TILES, WEIGHT_PLATES, isMirror } from '../../world/puzzles'
import type { MapInfo } from '../map'

export interface Emitter { idx: number; dir: Dir; when?: Cond; cell: number }
export interface Sluice { key: string; flag: string; invert: boolean; tiles: number[] }

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
    weights: new Map(), scales: new Set(), mirrors: new Map(),
  }
  p.physical = p.on || !!info.def.physics
  const marked = new Set<number>()
  const groups = new Map<string, Sluice>()
  for (const m of info.marks) {
    const idx = m.y * info.w + m.x
    const e = m.ent
    if (e.t === 'emitter') { p.emitters.push({ idx, dir: e.dir, when: e.when, cell: cellOf(info, idx) }); marked.add(idx) }
    else if (e.t === 'receiver') p.receivers.set(idx, e.flag)
    else if (e.t === 'boulder') p.boulders.set(idx, { dir: e.dir, flag: e.flag })
    else if (e.t === 'valve') p.valves.set(idx, e.flag)
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
  cache.set(info, p)
  return p
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
