/**
 * Where the hero has been, for the chart (`render/worldMap.ts`) and the MAP page (`render/mapPage.ts`, M): each
 * map but the interiors is cut into squares of CHUNK × CHUNK tiles, and a square is seen once the hero has been
 * within SIGHT tiles of it (in a dungeon, also every square of a room the hero walks into). Kept per map id as a
 * string of six-bit digits, one bit a square, row by row: the same string in the game state and in the save
 * (`SaveData.explored`).
 *
 * Pure; no canvas, no DOM.
 */
import type { GameState, MapDef, Rect } from '../types'

export const CHUNK = 8
/** Tiles round the hero that count as seen: about what the isometric view shows of the ground. */
export const SIGHT = 10
/** At most this many maps are kept; the first ones written make room (a save has 32 KB in all). */
export const EXPLORE_MAPS = 200

const DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const VALUE = new Map([...DIGITS].map((c, i) => [c, i]))

/** The maps the map shows: every map but the interiors (a room is all in view at once). */
export function charted(def: Pick<MapDef, 'kind'>): boolean {
  return def.kind !== 'interior'
}

export function chunkGrid(w: number, h: number): { cw: number; ch: number } {
  return { cw: Math.ceil(w / CHUNK), ch: Math.ceil(h / CHUNK) }
}

function bit(str: string | undefined, i: number): boolean {
  if (!str) return false
  const v = VALUE.get(str[(i / 6) | 0] ?? '')
  return v !== undefined && ((v >> (i % 6)) & 1) === 1
}

/** Square i set in `str` (made long enough first). */
function withBit(str: string, i: number): string {
  const k = (i / 6) | 0
  let s = str
  while (s.length <= k) s += 'A'
  const v = (VALUE.get(s[k]!) ?? 0) | (1 << (i % 6))
  return s.slice(0, k) + DIGITS[v] + s.slice(k + 1)
}

/** True once the square holding tile (tx, ty) of a w-wide map has been seen. */
export function seenTile(s: Pick<GameState, 'explored'>, mapId: string, w: number, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= w) return false
  const { cw } = chunkGrid(w, 1)
  return bit(s.explored?.[mapId], Math.floor(ty / CHUNK) * cw + Math.floor(tx / CHUNK))
}

/** True when any square of the map has been seen. */
export function seenAny(s: Pick<GameState, 'explored'>, mapId: string): boolean {
  const str = s.explored?.[mapId]
  return !!str && [...str].some(c => c !== 'A')
}

/** Marks the squares touching the tile rectangle as seen. True if one of them is new. */
export function reveal(s: GameState, mapId: string, w: number, h: number, r: Rect): boolean {
  const { cw, ch } = chunkGrid(w, h)
  const x0 = Math.max(0, Math.floor(r.x / CHUNK))
  const y0 = Math.max(0, Math.floor(r.y / CHUNK))
  const x1 = Math.min(cw - 1, Math.floor((r.x + r.w - 1) / CHUNK))
  const y1 = Math.min(ch - 1, Math.floor((r.y + r.h - 1) / CHUNK))
  s.explored ??= {}
  let str = s.explored[mapId] ?? ''
  let fresh = false
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const i = cy * cw + cx
      if (!bit(str, i)) { str = withBit(str, i); fresh = true }
    }
  }
  if (!fresh) return false
  if (!(mapId in s.explored)) {
    const ids = Object.keys(s.explored)
    for (const old of ids.slice(0, Math.max(0, ids.length - EXPLORE_MAPS + 1))) delete s.explored[old]
  }
  s.explored[mapId] = str
  return true
}

/**
 * The squares within SIGHT of the hero (a circle, its squares tested by their nearest point). Cheap when nothing
 * is new: the hero's square is remembered, and nothing is looked at again until the hero leaves it.
 */
export function revealAround(s: GameState, def: Pick<MapDef, 'kind'>, w: number, h: number): void {
  if (s.demo || !charted(def)) return
  const hx = s.hero.x
  const hy = s.hero.y
  const at = `${s.map.id}@${Math.floor(hx / 2)},${Math.floor(hy / 2)}`
  if (s.exploreAt === at) return
  s.exploreAt = at
  const { cw, ch } = chunkGrid(w, h)
  const x0 = Math.max(0, Math.floor((hx - SIGHT) / CHUNK))
  const y0 = Math.max(0, Math.floor((hy - SIGHT) / CHUNK))
  const x1 = Math.min(cw - 1, Math.floor((hx + SIGHT) / CHUNK))
  const y1 = Math.min(ch - 1, Math.floor((hy + SIGHT) / CHUNK))
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      const nx = Math.max(cx * CHUNK, Math.min(hx, (cx + 1) * CHUNK))
      const ny = Math.max(cy * CHUNK, Math.min(hy, (cy + 1) * CHUNK))
      if ((nx - hx) ** 2 + (ny - hy) ** 2 <= SIGHT * SIGHT) reveal(s, s.map.id, w, h, { x: cx * CHUNK, y: cy * CHUNK, w: 1, h: 1 })
    }
  }
}

/** The saved form, checked: map ids to digit strings, at most EXPLORE_MAPS of them; null when there are none. */
export function cleanExplored(raw: unknown): Record<string, string> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out: Record<string, string> = {}
  let n = 0
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= EXPLORE_MAPS) break
    if (id.length > 40 || typeof v !== 'string' || v.length > 400 || !/^[A-Za-z0-9_-]*$/.test(v) || !v) continue
    out[id] = v
    n++
  }
  return n ? out : null
}
