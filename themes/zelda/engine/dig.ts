/**
 * Dig & build: the tools, the materials, the edits and their save. Switched
 * on per map by `MapDef.dig` (docs/games/neon-shrine-dig.md); the heights
 * themselves are `digGround.ts`.
 *
 * Two B items: DIG (the pickaxe, shovel or axe, whichever the tile in front
 * asks for, if the hero has found it) and BUILD (the hammer: a block of the
 * chosen kind, a ramp up a step, a plank over water, a lamp; it takes back
 * what was built). Every change is an edit against the map as authored,
 * kept per map in `GameState.digEdits` and the save, at most `DIG_CAP` per
 * map and `DIG_MAPS` maps.
 */
import type { DigKind, DigMat, DigState, Dir, GameState, ItemId, MapDef, TileChar, UseItem, World } from '../types'
import { HERO_R } from '../types'
import { isTileChar } from '../world/tiles'
import type { Ctx } from './combat'
import { acquire } from './combat'
import { has, mapInfo, moveCircle, setFlag } from './map'
import { openDialog } from './hero'
import { baseHeights, digLevel, groundOf, isRamp, MAX_HEIGHT, RAMPS } from './digGround'
import { dirVec } from './util'

/** Edits one map may hold, and maps that may hold any: the save stays small (a few KB at most). */
export const DIG_CAP = 400
export const DIG_MAPS = 8
/** Materials stack this high. */
export const MAT_MAX = 99

export type DigTool = 'pickaxe' | 'shovel' | 'axe' | 'hammer'
export const DIG_TOOLS: readonly DigTool[] = ['pickaxe', 'shovel', 'axe', 'hammer']
export const DIG_MATS: readonly DigMat[] = ['dirt', 'stone', 'wood', 'lumen']
const KINDS: readonly DigKind[] = ['stone', 'wood', 'lamp']

/** Ground the shovel digs (and fills, when it lies below the hero). */
const SOFT = new Set<TileChar>(['.', ',', ':', ';', '-', 'д', 'в'])
/** What an edit may leave on a tile. */
const EDIT_CHARS = new Set<TileChar>(['.', ',', ':', ';', '-', '~', '=', 't', 'а', 'б', 'в', 'д', 'е', 'ж', 'з', 'и', 'й', 'к', 'T', '*', 'r', 'R', '%'])
const RAMP_OF: Record<Dir, TileChar> = { up: 'ж', down: 'з', right: 'и', left: 'й' }

export const hasTool = (s: GameState, t: DigTool): boolean => s.flags[`item:${t}`] === true
export const isDigItem = (u: UseItem | null): u is 'dig' | 'build' => u === 'dig' || u === 'build'
export const matCount = (s: GameState, k: DigMat): number => s.inv.mats?.[k] ?? 0

function addMat(s: GameState, k: DigMat, n: number) {
  s.inv.mats = { ...s.inv.mats, [k]: Math.max(0, Math.min(MAT_MAX, matCount(s, k) + n)) }
}

/** The B items dig & build adds to the cycle on this map. */
export function digItems(s: GameState, world: World): Array<'dig' | 'build'> {
  const def = mapInfo(world, s.map.id).def
  if (!def.dig || !s.map.dig) return []
  const out: Array<'dig' | 'build'> = []
  if (hasTool(s, 'pickaxe') || hasTool(s, 'shovel') || hasTool(s, 'axe')) out.push('dig')
  if (hasTool(s, 'hammer') && def.dig.build !== false) out.push('build')
  return out
}

/** The kinds the hammer can build now (stone first when there is none of anything). */
export function buildKinds(s: GameState): DigKind[] {
  const out = KINDS.filter(k => (k === 'lamp' ? matCount(s, 'lumen') > 0 && matCount(s, 'wood') > 0 : matCount(s, k) > 0))
  return out.length ? out : ['stone']
}

export function buildKind(s: GameState): DigKind {
  const ks = buildKinds(s)
  return s.inv.build && ks.includes(s.inv.build) ? s.inv.build : ks[0]!
}

/** The cycle button with the hammer out steps through its kinds first; false when it should move on to the next item. */
export function digCycle(c: Ctx): boolean {
  const s = c.s
  if (s.inv.selected !== 'build' || !s.map.dig) return false
  const ks = buildKinds(s)
  const i = ks.indexOf(buildKind(s))
  if (i + 1 < ks.length) {
    s.inv.build = ks[i + 1]
    c.ev.push({ type: 'cycle', item: 'build' })
    return true
  }
  s.inv.build = ks[0]
  return false
}

// ---------------------------------------------------------------------------
// Edits
// ---------------------------------------------------------------------------

/** The map as authored at tile i: its tile and height. */
function baseOf(world: World, s: GameState, i: number): [TileChar, number] {
  const info = mapInfo(world, s.map.id)
  return [info.base[i]!, baseHeights(info.def)[i]!]
}

/** Would an edit of tile i on this map fit under the caps? */
function roomFor(s: GameState, mapId: string, i: number): boolean {
  const all = s.digEdits ?? {}
  const ed = all[mapId]
  if (!ed) return Object.keys(all).length < DIG_MAPS
  return i in ed || Object.keys(ed).length < DIG_CAP
}

function record(world: World, s: GameState, i: number, ch: TileChar, h: number) {
  const id = s.map.id
  const [bc, bh] = baseOf(world, s, i)
  const all = (s.digEdits ??= {})
  if (ch === bc && h === bh) {
    const ed = all[id]
    if (ed) { delete ed[i]; if (!Object.keys(ed).length) delete all[id] }
    return
  }
  ;(all[id] ??= {})[i] = ch + String(h)
}

/** A map being loaded (`loadMap`): its heights, and this run's edits laid over its tiles. */
export function digLoad(def: MapDef, s: GameState, id: string, tiles: TileChar[]): DigState {
  const g = groundOf(def.dig!)
  const h = baseHeights(def).slice()
  const ed = s.digEdits?.[id]
  if (ed) for (const [k, v] of Object.entries(ed)) {
    const i = Number(k)
    if (!(i >= 0 && i < tiles.length)) continue
    tiles[i] = v[0] as TileChar
    h[i] = Number(v[1])
  }
  return { h, g, z: g }
}

/** The edits as the save keeps them: per map, `<index base 36><tile><height>` joined by commas. */
export function encodeDig(e: GameState['digEdits']): Record<string, string> | undefined {
  if (!e) return undefined
  const out: Record<string, string> = {}
  for (const [id, ed] of Object.entries(e)) {
    const parts = Object.entries(ed).map(([i, v]) => Number(i).toString(36) + v)
    if (parts.length) out[id] = parts.join(',')
  }
  return Object.keys(out).length ? out : undefined
}

/** A save's edits, read back; anything odd is dropped, and the caps hold. */
export function decodeDig(raw: unknown): GameState['digEdits'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: NonNullable<GameState['digEdits']> = {}
  for (const [id, str] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= DIG_MAPS) break
    if (typeof str !== 'string' || id.length > 64) continue
    const ed: Record<number, string> = {}
    let n = 0
    for (const part of str.split(',')) {
      const m = /^([0-9a-z]{1,4})(.)([0-4])$/u.exec(part)
      if (!m || n >= DIG_CAP) continue
      const ch = m[2]!
      if (!isTileChar(ch) || !EDIT_CHARS.has(ch)) continue
      ed[parseInt(m[1]!, 36)] = ch + m[3]
      n++
    }
    if (n) out[id] = ed
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * A save's materials and hammer kind, cleaned, to spread over the inventory last: a field that is not good
 * comes out `undefined` only when the save had one (old saves have neither, and get neither).
 */
export function cleanDigInv(inv: { mats?: unknown; build?: unknown }): { mats?: Partial<Record<DigMat, number>>; build?: DigKind } {
  const out: { mats?: Partial<Record<DigMat, number>>; build?: DigKind } = {}
  if ('mats' in inv) out.mats = undefined
  if ('build' in inv) out.build = undefined
  const raw = inv.mats
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const mats: Partial<Record<DigMat, number>> = {}
    for (const k of DIG_MATS) {
      const v = (raw as Record<string, unknown>)[k]
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) mats[k] = Math.min(MAT_MAX, Math.floor(v))
    }
    if (Object.keys(mats).length) out.mats = mats
  }
  if (KINDS.includes(inv.build as DigKind)) out.build = inv.build as DigKind
  return out
}

// ---------------------------------------------------------------------------
// The tile in front, and what B would do to it
// ---------------------------------------------------------------------------

export interface DigPlan {
  tx: number
  ty: number
  /** Something would happen. */
  ok: boolean
  verb: 'dig' | 'fill' | 'build' | 'take' | null
  /** The tool it takes (also when the hero has not found it yet). */
  tool: DigTool | null
  /** The tile and height after. */
  ch?: TileChar
  h?: number
  gain?: Partial<Record<DigMat, number>>
  cost?: Partial<Record<DigMat, number>>
  /** A cache dug up. */
  cache?: { id: string; item: ItemId }
  why?: 'tool' | 'high' | 'deep' | 'stock' | 'busy' | 'nothing'
}

/** The tile the hero faces (as A's interactions find it). */
export function digTarget(s: GameState): { tx: number; ty: number } {
  const h = s.hero
  const v = dirVec(h.dir)
  return { tx: Math.floor(h.x + v.x * 0.8), ty: Math.floor(h.y + v.y * 0.8) }
}

/** What B with `item` would do to the tile in front. Null off a dig map or with another item. */
export function digPlan(world: World, s: GameState, item: UseItem | null = s.inv.selected): DigPlan | null {
  const m = s.map
  if (!m.dig || !isDigItem(item)) return null
  const info = mapInfo(world, m.id)
  const def = info.def
  const { tx, ty } = digTarget(s)
  const none = (why: DigPlan['why'], tool: DigTool | null = null, verb: DigPlan['verb'] = null): DigPlan => ({ tx, ty, ok: false, verb, tool, why })
  if (tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return none('nothing')
  const i = ty * m.w + tx
  const t = m.tiles[i]!
  const th = m.dig.h[i]!
  const z = m.dig.z
  const g = m.dig.g
  const [bc, bh] = [info.base[i]!, baseHeights(def)[i]!]
  const edited = !!s.digEdits?.[m.id]?.[i]
  const plan = (p: Omit<DigPlan, 'tx' | 'ty' | 'ok'>): DigPlan => {
    const out: DigPlan = { tx, ty, ok: true, ...p }
    if (out.tool && !hasTool(s, out.tool)) return { ...out, ok: false, why: 'tool' }
    for (const [k, n] of Object.entries(out.cost ?? {}) as Array<[DigMat, number]>) if (matCount(s, k) < n) return { ...out, ok: false, why: 'stock' }
    // Nothing rises where someone stands.
    if (out.h !== undefined && (out.h > th || out.ch === 't') && occupied(s, tx, ty)) return { ...out, ok: false, why: 'busy' }
    return out
  }
  /** After a dig or a take: the tile as authored when the height is back, else bare earth (or a hole). */
  const after = (h: number, ch: TileChar): TileChar => (h === bh && SOFT.has(bc) && (ch === 'д' || ch === 'к')) ? bc : h < g ? 'к' : ch

  if (item === 'dig') {
    if (t === 'к' || (SOFT.has(t) && th < z)) {
      if (th >= MAX_HEIGHT) return none('high', 'shovel', 'fill')
      return plan({ verb: 'fill', tool: 'shovel', ch: after(th + 1, 'д'), h: th + 1, cost: { dirt: 1 } })
    }
    if (th > z + 1 && !isRamp(t)) return none('high')
    if (SOFT.has(t)) {
      if (th <= g - 1) return none('deep', 'shovel', 'dig')
      const nh = th - 1
      const cache = def.dig?.caches?.find(k => k.x === tx && k.y === ty && !has(s, `took:${k.id}`))
      const wet = nh < g && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tx + dx! >= 0 && tx + dx! < m.w && m.tiles[(ty + dy!) * m.w + tx + dx!] === '~')
      return plan({ verb: 'dig', tool: 'shovel', ch: wet ? '~' : after(nh, 'д'), h: nh, gain: { dirt: 1 }, cache: cache ? { id: cache.id, item: cache.item } : undefined })
    }
    switch (t) {
      case 'а': if (th <= g - 1) return none('deep', 'pickaxe', 'dig'); return plan({ verb: 'dig', tool: 'pickaxe', ch: after(th - 1, 'а'), h: th - 1, gain: { stone: 1 } })
      case 'е': return plan({ verb: 'dig', tool: 'pickaxe', ch: after(th - 1, 'а'), h: th - 1, gain: { lumen: 1 } })
      case 'r': return plan({ verb: 'dig', tool: 'pickaxe', ch: '.', h: th, gain: { stone: 1 } })
      case 'R': case '%': return plan({ verb: 'dig', tool: 'pickaxe', ch: '.', h: th, gain: { stone: 2 } })
      case 'T': return plan({ verb: 'dig', tool: 'axe', ch: '.', h: th, gain: { wood: 2 } })
      case '*': return plan({ verb: 'dig', tool: 'axe', ch: '.', h: th, gain: { wood: 1 } })
      case 'б': return plan({ verb: 'dig', tool: 'axe', ch: after(th - 1, 'д'), h: th - 1, gain: { wood: 1 } })
      case '=': if (bc !== '=') return plan({ verb: 'dig', tool: 'axe', ch: bc, h: bh, gain: { wood: 1 } }); break
    }
    return none('nothing')
  }

  // The hammer.
  if (def.dig?.build === false) return none('nothing', 'hammer')
  // What was built comes back whole.
  if (edited) {
    if (isRamp(t)) return plan({ verb: 'take', tool: 'hammer', ch: after(th - 1, 'д'), h: th - 1, gain: { stone: 1 } })
    if (t === 't' && bc !== 't') return plan({ verb: 'take', tool: 'hammer', ch: after(th, 'д'), h: th, gain: { lumen: 1, wood: 1 } })
    if (t === '=' && bc !== '=') return plan({ verb: 'take', tool: 'hammer', ch: bc, h: bh, gain: { wood: 1 } })
    if ((t === 'а' || t === 'б') && th > bh && th > z) return plan({ verb: 'take', tool: 'hammer', ch: after(th - 1, 'д'), h: th - 1, gain: t === 'а' ? { stone: 1 } : { wood: 1 } })
  }
  if (t === '~') return plan({ verb: 'build', tool: 'hammer', ch: '=', h: g, cost: { wood: 1 } })
  if (!(SOFT.has(t) || t === 'а' || t === 'б' || t === 'к')) return none('nothing', 'hammer', 'build')
  if (th > z) return none('high', 'hammer', 'build')
  const kind = buildKind(s)
  if (kind === 'lamp') return plan({ verb: 'build', tool: 'hammer', ch: 't', h: th, cost: { lumen: 1, wood: 1 } })
  // A ramp, where the ground in front of a step one up is level with the hero.
  const v = dirVec(s.hero.dir)
  const bx = tx + v.x
  const by = ty + v.y
  const beyond = bx >= 0 && by >= 0 && bx < m.w && by < m.h ? by * m.w + bx : -1
  if (th === z && beyond >= 0 && m.dig.h[beyond] === z + 1 && !isRamp(m.tiles[beyond]!) && t !== 'к') {
    return plan({ verb: 'build', tool: 'hammer', ch: RAMP_OF[s.hero.dir], h: z + 1, cost: { stone: 1 } })
  }
  if (th + 1 > MAX_HEIGHT) return none('high', 'hammer', 'build')
  return plan({ verb: 'build', tool: 'hammer', ch: kind === 'stone' ? 'а' : 'б', h: th + 1, cost: { [kind]: 1 } })
}

/** Is anyone standing on tile (tx, ty): the hero, a foe, a person? */
function occupied(s: GameState, tx: number, ty: number): boolean {
  const on = (x: number, y: number, r: number) => {
    const cx = Math.max(tx, Math.min(x, tx + 1))
    const cy = Math.max(ty, Math.min(y, ty + 1))
    return (x - cx) ** 2 + (y - cy) ** 2 < r * r
  }
  if (on(s.hero.x, s.hero.y, HERO_R)) return true
  if (s.luna && on(s.luna.x, s.luna.y, 0.3)) return true
  if (s.map.enemies.some(e => !e.dead && on(e.x, e.y, e.r))) return true
  return s.map.npcs.some(n => on(n.x, n.y, 0.36))
}

// ---------------------------------------------------------------------------
// B
// ---------------------------------------------------------------------------

const TOOL_NAME: Record<DigTool, string> = { pickaxe: 'A PICKAXE', shovel: 'A SHOVEL', axe: 'AN AXE', hammer: 'A HAMMER' }

/** B with DIG or BUILD out. */
export function useDigTool(c: Ctx) {
  const s = c.s
  const h = s.hero
  const p = digPlan(c.w, s)
  if (!p) { c.ev.push({ type: 'error' }); return }
  h.act = 'use'
  h.actT = 0
  if (!p.ok) {
    if (p.verb === 'dig' || p.verb === null) c.ev.push({ type: 'clank', x: p.tx + 0.5, y: p.ty + 0.5 })
    c.ev.push({ type: 'error' })
    // The first time a tool is missing, a line says which.
    if (p.why === 'tool' && p.tool && !has(s, `dighint:${p.tool}`)) {
      setFlag(s, `dighint:${p.tool}`)
      openDialog(c, [`THIS WANTS ${TOOL_NAME[p.tool]}.`], null)
    }
    return
  }
  const i = p.ty * s.map.w + p.tx
  if (!s.demo && !roomFor(s, s.map.id, i)) {
    c.ev.push({ type: 'error' })
    openDialog(c, ['THE GROUND HERE WILL TAKE NO MORE CHANGES. TAKE SOMETHING BACK FIRST.'], null)
    return
  }
  const m = s.map
  const was = m.tiles[i]!
  for (const [k, n] of Object.entries(p.cost ?? {}) as Array<[DigMat, number]>) addMat(s, k, -n)
  for (const [k, n] of Object.entries(p.gain ?? {}) as Array<[DigMat, number]>) addMat(s, k, n)
  m.tiles[i] = p.ch!
  m.dig!.h[i] = p.h!
  m.version++
  if (!s.demo) record(c.w, s, i, p.ch!, p.h!)
  if (p.verb === 'build' && p.ch !== 't') s.inv.build = buildKind(s)
  c.ev.push({ type: 'dig', x: p.tx + 0.5, y: p.ty + 0.5, verb: p.verb!, tile: p.verb === 'dig' || p.verb === 'take' ? was : p.ch!, z: p.h! - m.dig!.g })
  if (p.verb === 'dig' && (was === 'а' || was === 'е' || was === 'r' || was === 'R')) s.shake = Math.max(s.shake, 0.08)
  if (p.cache) {
    setFlag(s, `took:${p.cache.id}`)
    c.ev.push({ type: 'secret' })
    acquire(c, p.cache.item)
  }
}

/** Is tile (tx, ty) above the hero's reach (a chest on a ledge)? A talks and opens only at its own level or below. */
export function digOutOfReach(s: GameState, tx: number, ty: number): boolean {
  const m = s.map
  if (!m.dig || tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return false
  return m.dig.h[ty * m.w + tx]! > m.dig.z
}

// ---------------------------------------------------------------------------
// Each step
// ---------------------------------------------------------------------------

/** How far a lamp's pool keeps foes out (tiles). */
const LAMP_POOL = 2.6
const lampCache = new WeakMap<object, { v: number; at: number[] }>()

/** Before the hero moves: the level the hero stands at; foes kept out of the lamps' light. */
export function stepDig(c: Ctx, dt: number) {
  const m = c.s.map
  if (!m.dig) return
  const h = c.s.hero
  m.dig.z = digLevel(m, h.x, h.y, HERO_R)
  let lc = lampCache.get(m)
  if (!lc || lc.v !== m.version) {
    const at: number[] = []
    m.tiles.forEach((t, i) => { if (t === 't') at.push(i) })
    lc = { v: m.version, at }
    lampCache.set(m, lc)
  }
  if (!lc.at.length) return
  for (const e of m.enemies) {
    if (e.dead || e.kind === 'eye' || e.kind === 'blade') continue
    for (const i of lc.at) {
      const lx = (i % m.w) + 0.5
      const ly = Math.floor(i / m.w) + 0.5
      const dx = e.x - lx
      const dy = e.y - ly
      const d = Math.hypot(dx, dy)
      if (d >= LAMP_POOL || d < 1e-6) continue
      const push = 4 * dt
      const r = moveCircle(c.w, m, e.x, e.y, e.r, (dx / d) * push, (dy / d) * push, 'enemy')
      e.x = r.x
      e.y = r.y
    }
  }
}
