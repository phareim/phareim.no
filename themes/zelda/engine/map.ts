/**
 * Map derivation and tile queries. `mapInfo` resolves a MapDef once (markers
 * → entries, warps, chests, signs, gates, plates, camera rooms) and caches
 * it; `loadMap` builds the mutable MapState for the current progress.
 */
import type {
  Cond, EntDef, ExitSpot, GameState, MapDef, MapState, Rect, Spot, TileChar, ViewSide, Warp, WeightId, World, Enemy, Npc, Pickup,
} from '../types'
import { HERO_R, TOUGH, WEIGHTS } from '../types'
import { TILE_INFO, blockUp, isTileChar, isViewBlock } from '../world/tiles'
import { puzzleMarkTile } from '../world/puzzles'
import { loadPuzzleTiles } from './puzzles/load'
import { spawnEnemy } from './spawn'
import { terrainAbove, terrainLevel, terrainLoad } from './terrain'
import { LUNA_GAP, dirVec, opposite, trailPoint } from './util'

export interface MarkAt { x: number; y: number; ent: EntDef }
export interface ChestInfo { id: string; item: import('../types').ItemId; big: boolean; appear?: Cond; idx: number; x: number; y: number; cell: number }
/** `trap`: a gate that starts open and shuts behind the hero (`open` is then the room's `clear`). */
/** `latch`: a held gate, open while `open` holds until the latch does. */
export interface GateInfo { id: string; tiles: number[]; open: Cond; cell: number; trap?: boolean; latch?: Cond }

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
  signs: Map<number, Extract<EntDef, { t: 'sign' }>>
  /** Exits by tile index; `exitLines` holds a solid exit's dialog. */
  exits: Map<number, ExitSpot>
  exitLines: Map<number, string[]>
  gates: GateInfo[]
  plates: Map<number, string>
  /** Pot stands (`stand` marks): their tiles. */
  stands: number[]
  /** Letter stones: tile index → letter. */
  glyphs: Map<number, string>
  /** Levers: tile index → the flag a hit sets. */
  levers: Map<number, string>
  /** Authored push blocks ('b') and psi blocks ('B'), per camera room: [tile index, char]. */
  blocks: Map<number, Array<[number, TileChar]>>
  /** Tiles the landmarks stand on (`IsoLandmark.solid`, `sceneryOf`): solid to walkers, the tile itself unchanged. */
  scenery: ReadonlySet<number>
  cw: number
  ch: number
  cols: number
  rows: number
  /** Grid cells that belong to a taller room above them (`CellDef.tall`): cell index → the room's. */
  heads: ReadonlyMap<number, number>
}

const cache = new WeakMap<MapDef, MapInfo>()

/** A map's def: an authored one, or one the world makes on demand (the frontier). Undefined for an id neither has. */
export function mapDef(world: World, id: string): MapDef | undefined {
  return Object.prototype.hasOwnProperty.call(world.maps, id) ? world.maps[id] : undefined
}

export function mapInfo(world: World, id: string): MapInfo {
  const def = mapDef(world, id)
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
    chests: new Map(), chestList: [], signs: new Map(), exits: new Map(), exitLines: new Map(), gates: [], plates: new Map(), stands: [],
    glyphs: new Map(), levers: new Map(), blocks: new Map(), scenery: new Set(),
    cw, ch: chh, cols: Math.ceil(w / cw), rows: Math.ceil(h / chh), heads: new Map(),
  }
  for (const [key, cd] of Object.entries(def.cells ?? {})) {
    const [cx, cy] = key.split(',').map(Number) as [number, number]
    for (let k = 1; k < (cd.tall ?? 1); k++) (info.heads as Map<number, number>).set((cy + k) * info.cols + cx, cy * info.cols + cx)
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
    } else if (e.t === 'sign') info.signs.set(idx, e)
    else if (e.t === 'plate') info.plates.set(idx, e.id)
    else if (e.t === 'glyph') info.glyphs.set(idx, e.ch)
    else if (e.t === 'lever') info.levers.set(idx, e.flag)
    else if (e.t === 'stand') info.stands.push(idx)
    else if (e.t === 'gate') info.gates.push({ id: `${def.id}.${m.x},${m.y}`, tiles: floodRun(base, w, h, idx, 'X'), cell, ...(e.trap ? { open: { clear: true }, trap: true } : { open: e.open, ...(e.latch ? { latch: e.latch } : {}) }) })
  }
  // A trap gate is floor as authored: open on every load, and on the chart.
  for (const g of info.gates) if (g.trap) for (const i of g.tiles) base[i] = '.'
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
    if (t !== 'b' && t !== 'B') return
    const cell = cellIndex(info, (i % w) + 0.5, Math.floor(i / w) + 0.5)
    const list = info.blocks.get(cell) ?? []
    list.push([i, t])
    info.blocks.set(cell, list)
  })
  info.scenery = sceneryOf(info)
  return info
}

/** Ground a road runs on: a tile with two road tiles beside it is on the run of one (a path's dead end is not). */
const ROAD = new Set<TileChar>([',', '='])

/**
 * The tiles the map's landmarks stand on (`IsoLandmark.solid`), less those that must stay open: the run of a road,
 * the rim (where the passes are), a tile anyone or anything is placed on, the ring round an entry, a warp, a door,
 * stairs or an exit. Already solid tiles are left out. A landmark built over a way in (the headframe over its shaft)
 * keeps the ground beside it: only the way in itself stays open. Last, a tile that would shut off open ground the
 * entries reached without the scenery (a path's dead end) is let go.
 */
function sceneryOf(info: MapInfo): Set<number> {
  const out = new Set<number>()
  const { def, w, h, base } = info
  const lms = def.isoLandmarks
  if (!lms?.some(lm => lm.solid)) return out
  const marked = new Set(info.marks.map(m => m.y * w + m.x))
  /** Points nothing may stand beside (tile centres, or a warp's rect): entries, warps, exits, doors and stairs. */
  const keep: Rect[] = [
    ...Object.values(info.entries).map(e => ({ x: Math.floor(e.x), y: Math.floor(e.y), w: 1, h: 1 })),
    ...info.warps.map(wp => ({ x: wp.x, y: wp.y, w: wp.w, h: wp.h })),
    ...[...info.exits.values()].map(e => ({ x: Math.floor(e.x), y: Math.floor(e.y), w: 1, h: 1 })),
  ]
  for (let i = 0; i < base.length; i++) if (base[i] === 'D' || base[i] === '>') keep.push({ x: i % w, y: Math.floor(i / w), w: 1, h: 1 })
  const near = (x: number, y: number, r: Rect, pad: number) => x >= r.x - pad && x < r.x + r.w + pad && y >= r.y - pad && y < r.y + r.h + pad
  const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  const road = (x: number, y: number) => {
    if (!ROAD.has(base[y * w + x]!)) return false
    let n = 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (ROAD.has(base[(y + dy) * w + x + dx] ?? '#')) n++
    return n >= 2
  }
  const RIM = 2
  for (const lm of lms) {
    const r = lm.solid
    if (!r) continue
    const pad = keep.some(k => overlaps(r, k)) ? 0 : 1
    for (let y = r.y; y < r.y + r.h; y++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        if (x < RIM || y < RIM || x >= w - RIM || y >= h - RIM) continue
        const i = y * w + x
        if (TILE_INFO[base[i]!].solid || marked.has(i) || road(x, y)) continue
        if (keep.some(k => near(x, y, k, pad))) continue
        out.add(i)
      }
    }
  }
  if (!out.size) return out
  // What the entries reach over open ground, with the scenery and without; a pocket lost lets its scenery go.
  const starts = Object.values(info.entries).map(e => Math.floor(e.y) * w + Math.floor(e.x)).filter(i => i >= 0 && i < w * h)
  const reach = (shut: ReadonlySet<number>) => {
    const seen = new Uint8Array(w * h)
    const q: number[] = []
    for (const i of starts) if (!seen[i]) { seen[i] = 1; q.push(i) }
    while (q.length) {
      const i = q.pop()!
      const x = i % w
      const y = (i - x) / w
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const j = ny * w + nx
        if (seen[j] || TILE_INFO[base[j]!].solid || shut.has(j)) continue
        seen[j] = 1
        q.push(j)
      }
    }
    return seen
  }
  const open = reach(new Set())
  for (let guard = 0; guard < 8; guard++) {
    const now = reach(out)
    let freed = false
    for (let i = 0; i < w * h; i++) {
      if (!open[i] || now[i] || out.has(i)) continue
      const x = i % w
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (j < 0 || j >= w * h || (j === i - 1 && x === 0) || (j === i + 1 && x === w - 1) || !out.has(j)) continue
        out.delete(j)
        freed = true
      }
    }
    if (!freed) break
  }
  return out
}

function defaultTile(e: EntDef): TileChar {
  switch (e.t) {
    case 'chest': return e.appear ? '.' : '$'
    case 'sign': return 'S'
    case 'plate': return '_'
    case 'gate': return 'X'
    case 'shop': return 'n'
    case 'exit': return 'D'
    case 'glyph': return '{'
    case 'lever': return '}'
    case 'stand': return 'o'
    default: return puzzleMarkTile(e) ?? '.'
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
  const i = cy * info.cols + cx
  return info.heads.get(i) ?? i
}

export function cellRect(info: MapInfo, i: number): Rect {
  const cx = i % info.cols
  const cy = Math.floor(i / info.cols)
  return { x: cx * info.cw, y: cy * info.ch, w: info.cw, h: info.ch * (cellDef(info, i)?.tall ?? 1) }
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
  if ('session' in c) return s.session === c.session
  if ('view' in c) return s.view === c.view
  if ('flags' in c) return c.flags.every(f => has(s, f)) && !(c.not ?? []).some(f => has(s, f))
  // clear: the room's enemies are all dead (and it had some)
  const inCell = clearFoes(s, cell)
  return inCell.length > 0 && inCell.every(e => e.dead)
}

/** The foes a room's `clear` counts, dead or alive: all but the statues and the spike traps, which cannot fall. */
export function clearFoes(s: GameState, cell: number): Enemy[] {
  return s.map.enemies.filter(e => e.cell === cell && e.kind !== 'eye' && e.kind !== 'blade')
}

// ---------------------------------------------------------------------------
// The Sacred Weights (`WEIGHTS`): held is the flag its grant set
// ---------------------------------------------------------------------------

export const isWeight = (item: string): item is WeightId => WEIGHTS.some(w => w.id === item)
export const hasWeight = (s: Pick<GameState, 'flags'>, id: WeightId) => s.flags[`item:${id}`] === true
export const weightCount = (s: Pick<GameState, 'flags'>) => WEIGHTS.filter(w => hasWeight(s, w.id)).length

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
  if (s.session) for (let i = 0; i < tiles.length; i++) if (tiles[i] === '¤') tiles[i] = '.'
  for (const g of info.gates) if (flag(`gate:${g.id}`)) for (const i of g.tiles) tiles[i] = '.'
  for (const c of info.chestList) if (c.appear) tiles[c.idx] = flag(`appear:${c.id}`) ? '$' : '.'
  // Psi blocks moved out in the open, and blocks dropped here from the floor above.
  for (const f of Object.keys(s.flags)) {
    const p = f.split(':')
    if (p[0] === 'psi' && p[1] === id) { const from = Number(p[2]); const to = Number(p[3]); if (tiles[from] === 'B') tiles[from] = '.'; tiles[to] = 'B' }
    else if (p[0] === 'drop' && p[1] === id) tiles[Number(p[2])] = 'B'
  }
  loadPuzzleTiles(info, s, tiles)

  const enemies: Enemy[] = []
  const npcs: Npc[] = []
  const pickups: Pickup[] = []
  for (const m of info.marks) {
    const e = m.ent
    const cx = m.x + 0.5
    const cy = m.y + 0.5
    if (e.t === 'enemy') {
      if (e.once && flag(e.once)) continue
      const foe = spawnEnemy(`${id}:${m.x},${m.y}`, e.kind, cx, cy, e.dir ?? 'down', cellIndex(info, cx, cy), e.once, e.carries)
      if (e.calm) foe.calm = true
      if (e.tough && (e.kind === 'sentry' || e.kind === 'hound')) { foe.tough = true; foe.hp = foe.maxHp = TOUGH.hp[e.kind] }
      if (e.dark && foe.tough && e.kind === 'hound') foe.dark = true
      enemies.push(foe)
    } else if (e.t === 'npc') {
      if (e.hide && condMet(s, world, e.hide, -1)) continue
      npcs.push({
        id: e.id, look: e.look, x: cx, y: cy, dir: e.dir ?? 'down', home: { x: cx, y: cy }, wander: !!e.wander, t: 0, vx: 0, vy: 0,
        ...(e.attend ? { att: { mode: e.attend.mode, ring: e.attend.ring ?? 2.5, made: false, linger: false, clock: 0, muted: false } } : {}),
      })
    } else if (e.t === 'item') {
      if (flag(`took:${e.id}`)) continue
      pickups.push({ id: e.id, item: e.item, x: cx, y: cy, appear: e.appear, hidden: !!e.appear })
    } else if (e.t === 'shop') {
      if (e.once && flag(`took:${e.id}`)) continue
      pickups.push({ id: e.id, item: e.item, x: cx, y: cy, shop: { price: e.price, once: !!e.once }, hidden: false })
    }
  }
  // The ground's heights (`terrain.ts`).
  const terrain = info.def.terrain ? terrainLoad(info.def) : undefined
  return {
    ...(terrain ? { terrain } : {}),
    // (Read through, so there is one truth and nothing to keep in step.)
    get view() { return s.view },
    id, w: info.w, h: info.h, tiles, version: 1,
    enemies, projectiles: [], drops: [], bombs: [], blasts: [], thrown: [], moving: [],
    npcs, pickups, exits: [...info.exits.values()].map(x => ({ ...x })), plates: [], pending: [], crystal: {},
    crystalAll: info.def.crystal ? (flag(`crystal:${info.def.crystal}`) ? 'cyan' : 'pink') : undefined,
    spell: '', spellTiles: [], onGlyph: -1, ring: info.def.keyring ?? 'shrine',
    ...(info.scenery.size ? { scenery: info.scenery } : {}),
    ...(info.def.kind === 'side' ? { side: true as const } : {}),
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
  if (m.crystalAll) return m.crystalAll
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

/**
 * Who is moving: the hero, a walking enemy (also avoids pits/spikes), a flying creature, or a shot: whatever goes
 * through the air or looks along a line (projectiles, the disc, the hook, a thrown pot, a line of sight).
 */
export type MoveMode = 'hero' | 'enemy' | 'fly' | 'shot'

/**
 * Does tile (tx, ty) block this mover? A view block is solid to every creature but the hero in both views (so nothing
 * but the hero can be where one rises); to the hero and to a shot only while it is up (`blockUp`).
 */
export function solidTile(world: World, m: MapState, tx: number, ty: number, mode: MoveMode = 'hero'): boolean {
  const t = tileAt(m, tx, ty)
  if (isViewBlock(t)) return mode === 'enemy' || mode === 'fly' || blockUp(t, m.view)
  if (mode === 'fly' || mode === 'shot') return TILE_INFO[t].wall
  if (m.scenery && tx >= 0 && ty >= 0 && tx < m.w && ty < m.h && m.scenery.has(ty * m.w + tx)) return true
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

/** Over the ground: the terrain's heights do not block it. */
const aloft = (mode: MoveMode) => mode === 'fly' || mode === 'shot'

/**
 * On a map with terrain a tile higher than the mover's level blocks it too (`terrain.ts`): `lv` is that level, by
 * default the one it stands at there (the hero's, kept in `MapState.terrain.z`).
 */
export function circleBlocked(world: World, m: MapState, x: number, y: number, r: number, mode: MoveMode = 'hero', lv?: number): boolean {
  const z = m.terrain && !aloft(mode) ? lv ?? (mode === 'hero' ? m.terrain.z : terrainLevel(m, x, y, r)) : -1
  const x0 = Math.floor(x - r)
  const x1 = Math.floor(x + r)
  const y0 = Math.floor(y - r)
  const y1 = Math.floor(y + r)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if ((solidTile(world, m, tx, ty, mode) || (z >= 0 && terrainAbove(m, tx, ty, z))) && circleHitsTile(x, y, r, tx, ty)) return true
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
  const lv = m.terrain && !aloft(mode) ? terrainLevel(m, x, y, r) : undefined
  if (dx !== 0) {
    if (!circleBlocked(world, m, x + dx, y, r, mode, lv)) x += dx
    else {
      hitX = true
      let lo = 0
      let hi = 1
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (circleBlocked(world, m, x + dx * mid, y, r, mode, lv)) hi = mid
        else lo = mid
      }
      x += dx * lo
    }
  }
  if (dy !== 0) {
    if (!circleBlocked(world, m, x, y + dy, r, mode, lv)) y += dy
    else {
      hitY = true
      let lo = 0
      let hi = 1
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (circleBlocked(world, m, x, y + dy * mid, r, mode, lv)) hi = mid
        else lo = mid
      }
      y += dy * lo
    }
  }
  return { x, y, hitX, hitY }
}

/** Is the straight segment free of wall tiles and view blocks that are up (a shot's rules)? Sampled at 0.2 tiles. */
export function lineClear(world: World, m: MapState, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.max(1, Math.ceil(d / 0.2))
  for (let i = 1; i < n; i++) {
    const t = i / n
    const tx = Math.floor(x0 + (x1 - x0) * t)
    const ty = Math.floor(y0 + (y1 - y0) * t)
    if (solidTile(world, m, tx, ty, 'shot')) return false
  }
  return true
}

/** A dark room stays dark until its `lit` flag is set (the lab's power coming back). */
export function cellIsDark(s: GameState, info: MapInfo, i: number): boolean {
  const cd = cellDef(info, i)
  return !!cd?.dark && !(cd.lit && has(s, cd.lit))
}

// ---------------------------------------------------------------------------
// The view as a rule
// ---------------------------------------------------------------------------

/** The map has square or diamond blocks: the view matters here. */
export const hasViewBlocks = (m: Pick<MapState, 'tiles'>) => m.tiles.some(isViewBlock)

/**
 * Would turning to `to` raise a block under the hero: one their circle touches, or (the hook out) one the chain
 * crosses or is about to pull them over? Such a turn is refused (STAND CLEAR).
 */
export function risesUnderHero(s: GameState, to: ViewSide): boolean {
  if (to === s.view) return false
  const m = s.map
  const rising = (x: number, y: number, r: number) => {
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++) {
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        const t = tileAt(m, tx, ty)
        if (blockUp(t, to) && !blockUp(t, s.view) && circleHitsTile(x, y, r, tx, ty)) return true
      }
    }
    return false
  }
  const h = s.hero
  if (rising(h.x, h.y, HERO_R)) return true
  const k = s.hook
  if (!k) return false
  const end = k.to ?? k
  const n = Math.max(1, Math.ceil(Math.hypot(end.x - h.x, end.y - h.y) / 0.2))
  for (let i = 1; i <= n; i++) if (rising(h.x + ((end.x - h.x) * i) / n, h.y + ((end.y - h.y) * i) / n, HERO_R)) return true
  return false
}

/**
 * Turn the rule to `to`: the one call every committed turn goes through. False, and nothing changes, when a block
 * would rise under the hero. The shell lets no step run between the old rule and the new.
 */
export function setViewRule(s: GameState, to: ViewSide): boolean {
  if (to === s.view) return true
  if (risesUnderHero(s, to)) return false
  s.view = to
  const m = s.map
  if (!hasViewBlocks(m)) return true
  // The pictures and the charts are made again.
  m.version++
  lunaTurned(s)
  return true
}

/**
 * Luna has no collision: she walks straight for a point back along the hero's trail, which was open in the view it was
 * laid in. On a turn the trail loses what now lies in a block, and where the straight way to her next point crosses
 * one (or she stands in one) she is brought to the hero's heels, with the trail begun again there.
 */
function lunaTurned(s: GameState) {
  const L = s.luna
  if (!L) return
  const h = s.hero
  const shut = (x: number, y: number) => blockUp(tileAt(s.map, Math.floor(x), Math.floor(y)), s.view)
  L.trail = L.trail.filter(p => !shut(p.x, p.y))
  const next = trailPoint(L.trail.length ? L.trail : [h], LUNA_GAP)
  const n = Math.max(1, Math.ceil(Math.hypot(next.x - L.x, next.y - L.y) / 0.05))
  for (let i = 0; i <= n; i++) {
    if (!shut(L.x + ((next.x - L.x) * i) / n, L.y + ((next.y - L.y) * i) / n)) continue
    L.x = h.x
    L.y = h.y
    L.trail = [{ x: h.x, y: h.y }]
    return
  }
}

/** The hero stands in something solid: step to the nearest free spot within three tiles; true if moved. */
export function stepClear(world: World, s: GameState): boolean {
  const h = s.hero
  if (!circleBlocked(world, s.map, h.x, h.y, HERO_R)) return false
  for (let r = 1; r <= 3; r++) {
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const x = Math.floor(h.x) + dx * r + 0.5
      const y = Math.floor(h.y) + dy * r + 0.5
      // (Never onto a pit, a door or a warp: stepping aside must not carry the hero off the map.)
      const tx = Math.floor(x)
      const ty = Math.floor(y)
      const info = mapInfo(world, s.map.id)
      const leads = info.exits.has(ty * info.w + tx) || info.warps.some(w => tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h)
      if (!circleBlocked(world, s.map, x, y, HERO_R) && tileAt(s.map, tx, ty) !== 'O' && !leads) { h.x = x; h.y = y; h.safe = { x, y }; return true }
    }
  }
  return false
}

// ---------------------------------------------------------------------------
// Keys: each dungeon keeps its own (see MapDef.keyring)
// ---------------------------------------------------------------------------

export function keyCount(s: GameState, ring = s.map.ring): number {
  return ring === 'shrine' ? s.inv.keys : s.inv.keyrings[ring] ?? 0
}

export function addKeys(s: GameState, n: number, ring = s.map.ring) {
  if (ring === 'shrine') s.inv.keys += n
  else s.inv.keyrings = { ...s.inv.keyrings, [ring]: Math.max(0, (s.inv.keyrings[ring] ?? 0) + n) }
}

export function hasBigKey(s: GameState, ring = s.map.ring): boolean {
  return ring === 'shrine' ? s.inv.bigKey : has(s, `bigkey:${ring}`)
}

/**
 * The shell's word on whether the visitor is logged in. Opens the velvet rope
 * on the map they stand in (other maps read it when they load), or closes it
 * again, unless the hero is standing on a rope tile: that one stays open until
 * the map next loads.
 */
export function setSession(world: World, s: GameState, on: boolean) {
  if (s.session === on) return
  s.session = on
  const info = mapInfo(world, s.map.id)
  const m = s.map
  let changed = false
  for (let i = 0; i < info.base.length; i++) {
    if (info.base[i] !== '¤') continue
    if (!on && i === Math.floor(s.hero.y) * m.w + Math.floor(s.hero.x)) continue
    const want = on ? '.' : '¤'
    if (m.tiles[i] !== want) { m.tiles[i] = want; changed = true }
  }
  if (changed) m.version++
}
