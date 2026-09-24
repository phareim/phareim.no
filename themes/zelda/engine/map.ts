/**
 * Map derivation and tile queries. `mapInfo` resolves a MapDef once (markers
 * → entries, warps, chests, signs, gates, plates, camera rooms) and caches
 * it; `loadMap` builds the mutable MapState for the current progress.
 */
import type {
  Cond, EntDef, ExitSpot, GameState, MapDef, MapState, Rect, Spot, TileChar, Warp, World, Enemy, Npc, Pickup,
} from '../types'
import { TILE_INFO, isTileChar } from '../world/tiles'
import { spawnEnemy } from './spawn'
import { dirVec, opposite } from './util'

export interface MarkAt { x: number; y: number; ent: EntDef }
export interface ChestInfo { id: string; item: import('../types').ItemId; big: boolean; appear?: Cond; idx: number; x: number; y: number; cell: number }
export interface GateInfo { id: string; tiles: number[]; open: Cond; cell: number }

export interface MapInfo {
  def: MapDef
  w: number
  h: number
  base: TileChar[]
  marks: MarkAt[]
  entries: Record<string, Spot>
  warps: Array<Required<Warp>>
  chests: Map<number, ChestInfo>
  chestList: ChestInfo[]
  signs: Map<number, string[]>
  /** Exits by tile index; `exitLines` holds a solid exit's dialog. */
  exits: Map<number, ExitSpot>
  exitLines: Map<number, string[]>
  gates: GateInfo[]
  plates: Map<number, string>
  /** Authored push-block tiles, per camera room. */
  blocks: Map<number, number[]>
  cw: number
  ch: number
  cols: number
  rows: number
}

const cache = new WeakMap<MapDef, MapInfo>()

export function mapInfo(world: World, id: string): MapInfo {
  const def = world.maps[id]
  if (!def) throw new Error(`zelda: unknown map ${id}`)
  let info = cache.get(def)
  if (!info) {
    info = buildInfo(def)
    cache.set(def, info)
  }
  return info
}

function buildInfo(def: MapDef): MapInfo {
  const h = def.rows.length
  const w = def.rows[0]!.length
  const base: TileChar[] = []
  const marks: MarkAt[] = []
  for (let y = 0; y < h; y++) {
    const row = def.rows[y]!
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '#'
      const mark = def.marks[ch]
      if (mark) {
        marks.push({ x, y, ent: mark.ent })
        base.push(mark.tile ?? defaultTile(mark.ent))
      } else {
        base.push(isTileChar(ch) ? ch : '.')
      }
    }
  }
  // Markers without an explicit tile take the path look if they sit on a path.
  for (const m of marks) {
    const idx = m.y * w + m.x
    if (base[idx] !== '.' || def.marks[def.rows[m.y]![m.x]!]!.tile) continue
    let n = 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ch = def.rows[m.y + dy]?.[m.x + dx]
      if (ch === ',') n++
    }
    if (n >= 2) base[idx] = ','
  }
  const cw = def.cell?.w ?? w
  const chh = def.cell?.h ?? h
  const info: MapInfo = {
    def, w, h, base, marks,
    entries: { ...(def.entries ?? {}) },
    warps: (def.warps ?? []).map(wp => ({ w: 1, h: 1, ...wp })),
    chests: new Map(), chestList: [], signs: new Map(), exits: new Map(), exitLines: new Map(), gates: [], plates: new Map(), blocks: new Map(),
    cw, ch: chh, cols: Math.ceil(w / cw), rows: Math.ceil(h / chh),
  }
  for (const m of marks) {
    const idx = m.y * w + m.x
    const e = m.ent
    const cell = cellIndex(info, m.x + 0.5, m.y + 0.5)
    if (e.t === 'entry') info.entries[e.id] = { x: m.x + 0.5, y: m.y + 0.5, dir: e.dir ?? 'down' }
    else if (e.t === 'warp') info.warps.push({ x: m.x, y: m.y, w: 1, h: 1, to: e.to, entry: e.entry })
    else if (e.t === 'chest') {
      const c: ChestInfo = { id: e.id, item: e.item, big: !!e.big, appear: e.appear, idx, x: m.x, y: m.y, cell }
      info.chests.set(idx, c)
      info.chestList.push(c)
    } else if (e.t === 'sign') info.signs.set(idx, e.lines)
    else if (e.t === 'plate') info.plates.set(idx, e.id)
    else if (e.t === 'gate') info.gates.push({ id: `${def.id}.${m.x},${m.y}`, tiles: floodRun(base, w, h, idx, 'X'), open: e.open, cell })
  }
  // Exits, and the entry beside each one (after the entry markers, which win a name clash).
  for (const m of marks) {
    const e = m.ent
    if (e.t !== 'exit') continue
    const idx = m.y * w + m.x
    const walk = !TILE_INFO[base[idx]!].solid
    info.exits.set(idx, {
      id: e.id, x: m.x + 0.5, y: m.y + 0.5, to: e.to, look: e.look ?? (walk ? 'door' : 'sign'), art: e.art, label: e.label, walk,
    })
    if (!walk && e.lines?.length) info.exitLines.set(idx, e.lines)
    const side = e.side ?? 'down'
    const v = dirVec(side)
    if (!info.entries[e.id]) info.entries[e.id] = { x: m.x + v.x + 0.5, y: m.y + v.y + 0.5, dir: walk ? side : opposite(side) }
  }
  base.forEach((t, i) => {
    if (t !== 'b') return
    const cell = cellIndex(info, (i % w) + 0.5, Math.floor(i / w) + 0.5)
    const list = info.blocks.get(cell) ?? []
    list.push(i)
    info.blocks.set(cell, list)
  })
  return info
}

function defaultTile(e: EntDef): TileChar {
  switch (e.t) {
    case 'chest': return e.appear ? '.' : '$'
    case 'sign': return 'S'
    case 'plate': return '_'
    case 'gate': return 'X'
    case 'shop': return 'n'
    case 'exit': return 'D'
    default: return '.'
  }
}

/** 4-connected run of `ch` tiles starting at idx. */
export function floodRun(tiles: readonly TileChar[], w: number, h: number, idx: number, ch: TileChar): number[] {
  const out: number[] = []
  const seen = new Set<number>([idx])
  const stack = [idx]
  while (stack.length) {
    const i = stack.pop()!
    if (tiles[i] !== ch) continue
    out.push(i)
    const x = i % w
    const y = Math.floor(i / w)
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (!seen.has(j)) { seen.add(j); stack.push(j) }
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Camera rooms
// ---------------------------------------------------------------------------

export function cellIndex(info: MapInfo, x: number, y: number): number {
  const cx = Math.max(0, Math.min(info.cols - 1, Math.floor(x / info.cw)))
  const cy = Math.max(0, Math.min(info.rows - 1, Math.floor(y / info.ch)))
  return cy * info.cols + cx
}

export function cellRect(info: MapInfo, i: number): Rect {
  const cx = i % info.cols
  const cy = Math.floor(i / info.cols)
  return { x: cx * info.cw, y: cy * info.ch, w: info.cw, h: info.ch }
}

export function cellDef(info: MapInfo, i: number) {
  return info.def.cells?.[`${i % info.cols},${Math.floor(i / info.cols)}`]
}

// ---------------------------------------------------------------------------
// Flags and conditions
// ---------------------------------------------------------------------------

export const has = (s: GameState, f: string) => s.flags[f] === true
export function setFlag(s: GameState, f: string) { if (!s.demo || !f.startsWith('item:')) s.flags[f] = true }

export function condMet(s: GameState, world: World, c: Cond | undefined, cell: number): boolean {
  if (!c) return true
  if ('flag' in c) return has(s, c.flag)
  if ('notFlag' in c) return !has(s, c.notFlag)
  if ('plates' in c) return c.plates.every(p => s.map.plates.includes(p))
  if ('item' in c) return has(s, `item:${c.item}`)
  // clear: the room's enemies are all dead (and it had some)
  const inCell = s.map.enemies.filter(e => e.cell === cell && e.kind !== 'eye' && e.kind !== 'blade')
  return inCell.length > 0 && inCell.every(e => e.dead)
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

export function loadMap(world: World, s: GameState, id: string): MapState {
  const info = mapInfo(world, id)
  const tiles = info.base.slice()
  const flag = (f: string) => s.flags[f] === true
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i]!
    if ((t === 'R' || t === '%') && flag(`bomb:${id}:${i}`)) tiles[i] = '.'
    else if ((t === 'L' || t === 'K') && flag(`door:${id}:${i}`)) tiles[i] = '.'
  }
  for (const g of info.gates) if (flag(`gate:${g.id}`)) for (const i of g.tiles) tiles[i] = '.'
  for (const c of info.chestList) if (c.appear) tiles[c.idx] = flag(`appear:${c.id}`) ? '$' : '.'

  const enemies: Enemy[] = []
  const npcs: Npc[] = []
  const pickups: Pickup[] = []
  for (const m of info.marks) {
    const e = m.ent
    const cx = m.x + 0.5
    const cy = m.y + 0.5
    if (e.t === 'enemy') {
      if (e.once && flag(e.once)) continue
      enemies.push(spawnEnemy(`${id}:${m.x},${m.y}`, e.kind, cx, cy, e.dir ?? 'down', cellIndex(info, cx, cy), e.once, e.carries))
    } else if (e.t === 'npc') {
      npcs.push({ id: e.id, look: e.look, x: cx, y: cy, dir: e.dir ?? 'down', home: { x: cx, y: cy }, wander: !!e.wander, t: 0, vx: 0, vy: 0 })
    } else if (e.t === 'item') {
      if (flag(`took:${e.id}`)) continue
      pickups.push({ id: e.id, item: e.item, x: cx, y: cy, appear: e.appear, hidden: !!e.appear })
    } else if (e.t === 'shop') {
      if (e.once && flag(`took:${e.id}`)) continue
      pickups.push({ id: e.id, item: e.item, x: cx, y: cy, shop: { price: e.price, once: !!e.once }, hidden: false })
    }
  }
  return {
    id, w: info.w, h: info.h, tiles, version: 1,
    enemies, projectiles: [], drops: [], bombs: [], blasts: [], thrown: [], moving: [],
    npcs, pickups, exits: [...info.exits.values()].map(x => ({ ...x })), plates: [], pending: [], crystal: {},
  }
}

// ---------------------------------------------------------------------------
// Tile queries and collision
// ---------------------------------------------------------------------------

export function tileAt(m: MapState, tx: number, ty: number): TileChar {
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return '#'
  return m.tiles[ty * m.w + tx]!
}

export function setTile(m: MapState, tx: number, ty: number, t: TileChar) {
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return
  m.tiles[ty * m.w + tx] = t
  m.version++
}

/** Crystal state of the camera room holding tile (tx, ty). */
export function crystalAt(world: World, m: MapState, tx: number, ty: number): 'pink' | 'cyan' {
  const info = mapInfo(world, m.id)
  return m.crystal[cellIndex(info, tx + 0.5, ty + 0.5)] ?? 'pink'
}

export function raised(world: World, m: MapState, tx: number, ty: number): boolean {
  const t = tileAt(m, tx, ty)
  if (t !== 'P' && t !== 'C') return false
  if (m.pending.includes(ty * m.w + tx)) return false
  const st = crystalAt(world, m, tx, ty)
  return t === 'P' ? st === 'pink' : st === 'cyan'
}

/** Who is moving: the hero, a walking enemy (also avoids pits/spikes), or something flying. */
export type MoveMode = 'hero' | 'enemy' | 'fly'

/** Does tile (tx, ty) block this mover? */
export function solidTile(world: World, m: MapState, tx: number, ty: number, mode: MoveMode = 'hero'): boolean {
  const t = tileAt(m, tx, ty)
  if (mode === 'fly') return TILE_INFO[t].wall
  if (t === 'P' || t === 'C') return raised(world, m, tx, ty)
  if (mode === 'enemy' && (t === 'O' || t === 'x' || t === 'D' || t === '>')) return true
  return TILE_INFO[t].solid
}

function circleHitsTile(x: number, y: number, r: number, tx: number, ty: number): boolean {
  const cx = Math.max(tx, Math.min(x, tx + 1))
  const cy = Math.max(ty, Math.min(y, ty + 1))
  const dx = x - cx
  const dy = y - cy
  return dx * dx + dy * dy < r * r - 1e-9
}

export function circleBlocked(world: World, m: MapState, x: number, y: number, r: number, mode: MoveMode = 'hero'): boolean {
  const x0 = Math.floor(x - r)
  const x1 = Math.floor(x + r)
  const y0 = Math.floor(y - r)
  const y1 = Math.floor(y + r)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (solidTile(world, m, tx, ty, mode) && circleHitsTile(x, y, r, tx, ty)) return true
    }
  }
  if (mode === 'hero') {
    for (const n of m.npcs) if ((n.x - x) ** 2 + (n.y - y) ** 2 < (r + 0.36) ** 2) return true
  }
  return false
}

/** Does a circle overlap tile (tx, ty)? */
export function circleOnTile(x: number, y: number, r: number, tx: number, ty: number): boolean {
  return circleHitsTile(x, y, r, tx, ty)
}

/**
 * Move a circle by (dx, dy) with wall sliding: each axis on its own, and a
 * blocked axis ends flush against the obstacle (bisection).
 */
export function moveCircle(
  world: World, m: MapState, x: number, y: number, r: number, dx: number, dy: number, mode: MoveMode = 'hero',
): { x: number; y: number; hitX: boolean; hitY: boolean } {
  let hitX = false
  let hitY = false
  if (dx !== 0) {
    if (!circleBlocked(world, m, x + dx, y, r, mode)) x += dx
    else {
      hitX = true
      let lo = 0
      let hi = 1
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (circleBlocked(world, m, x + dx * mid, y, r, mode)) hi = mid
        else lo = mid
      }
      x += dx * lo
    }
  }
  if (dy !== 0) {
    if (!circleBlocked(world, m, x, y + dy, r, mode)) y += dy
    else {
      hitY = true
      let lo = 0
      let hi = 1
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (circleBlocked(world, m, x, y + dy * mid, r, mode)) hi = mid
        else lo = mid
      }
      y += dy * lo
    }
  }
  return { x, y, hitX, hitY }
}

/** Is the straight segment free of wall tiles (flying rules)? Sampled at 0.2 tiles. */
export function lineClear(world: World, m: MapState, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.max(1, Math.ceil(d / 0.2))
  for (let i = 1; i < n; i++) {
    const t = i / n
    const tx = Math.floor(x0 + (x1 - x0) * t)
    const ty = Math.floor(y0 + (y1 - y0) * t)
    if (solidTile(world, m, tx, ty, 'fly')) return false
  }
  return true
}
