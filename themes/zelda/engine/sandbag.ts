/**
 * SANDBAGS (side maps, Act Three's fly loft): a bag on a rope, falling on a clock. The mark's tile is where it hangs;
 * its column is `BAG.w` tiles wide, from there down to the first wall or platform. In a cycle of `period` s (the
 * mark's `phase` s in): a tell, the column stencilled pink; the fall, which hurts a hero in the column; a rest on
 * what it fell on, harmless; the haul back up; and it hangs. Above its tip, or beside the column, nothing touches him.
 * A bag moves nobody and nothing hurts it. The clock runs from the map's loading (`MapState.bagT`) and no bag falls
 * before a whole tell has shown. Painted by `render/actthreePaint.ts`.
 */
import type { MapState, TileChar } from '../types'
import { LADDER, PLATFORM, TILE_INFO } from '../world/tiles'
import { hurtHero, type Ctx } from './combat'
import { cellIndex, tileAt, type MapInfo } from './map'

export const BAG = { period: 4.8, tell: 1, fall: 0.2, rest: 0.5, haul: 1.2, w: 2, dmg: 2 } as const
export type BagMode = 'tell' | 'fall' | 'rest' | 'haul' | 'idle'
/** A bag: its column's left edge and its tip (tiles), and its clock. */
export interface Bag { x: number; y: number; cell: number; period: number; phase: number }
/** A piece of a column or a blow, in tiles. */
export interface Box { x0: number; y0: number; x1: number; y1: number }

/** Would this tile stop a thing falling from above? A wall, a platform, a ladder's top. */
function bears(m: MapState, tx: number, ty: number): boolean {
  const t: TileChar = tileAt(m, tx, ty)
  return TILE_INFO[t].solid || t === PLATFORM || (t === LADDER && tileAt(m, tx, ty - 1) !== LADDER)
}

/**
 * The column from x0 to x1 under row `top`: one box for each tile column it crosses, down to the first thing that
 * would stop a fall there. Neighbours that reach equally far are one box.
 */
export function column(m: MapState, x0: number, x1: number, top: number): Box[] {
  const out: Box[] = []
  for (let tx = Math.floor(x0); tx < x1; tx++) {
    let y = top
    while (y < m.h && !bears(m, tx, y)) y++
    const box = { x0: Math.max(x0, tx), y0: top, x1: Math.min(x1, tx + 1), y1: y }
    if (box.y1 <= box.y0 || box.x1 - box.x0 < 1e-6) continue
    const last = out[out.length - 1]
    if (last && last.y1 === box.y1 && Math.abs(last.x1 - box.x0) < 1e-6) last.x1 = box.x1
    else out.push(box)
  }
  return out
}

/** Is a point (the hero's middle) in any of the boxes? */
export const inBoxes = (boxes: readonly Box[], x: number, y: number) => boxes.some(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1)

const lists = new WeakMap<MapInfo, Bag[]>()
export function bagsOf(info: MapInfo): readonly Bag[] {
  let list = lists.get(info)
  if (!list) {
    list = info.marks.flatMap(m => (m.ent.t === 'sandbag'
      ? [{ x: m.x, y: m.y, cell: cellIndex(info, m.x + 0.5, m.y + 0.5), period: m.ent.period ?? BAG.period, phase: m.ent.phase ?? 0 }]
      : []))
    lists.set(info, list)
  }
  return list
}

/** Where a bag is in its cycle at `t` s on the map's clock: its mode, and 0..1 through it. */
export function bagAt(b: Pick<Bag, 'period' | 'phase'>, t: number): { mode: BagMode; k: number } {
  const local = (((t - b.phase) % b.period) + b.period) % b.period
  // (A cycle that began before the map was loaded never showed its tell: it hangs.)
  if (t - local < -1e-6) return { mode: 'idle', k: 0 }
  let from = 0
  for (const mode of ['tell', 'fall', 'rest', 'haul'] as const) {
    if (local < from + BAG[mode]) return { mode, k: (local - from) / BAG[mode] }
    from += BAG[mode]
  }
  return { mode: 'idle', k: 0 }
}

/** The bags of the hero's room, a step (`objects.ts`). */
export function stepSandbags(c: Ctx, dt: number) {
  const bags = bagsOf(c.info)
  if (!bags.length) return
  const m = c.s.map
  const was = m.bagT ?? 0
  const now = m.bagT = was + dt
  const h = c.s.hero
  for (const b of bags) {
    if (b.cell !== c.s.zoneIndex) continue
    const at = bagAt(b, now)
    // The thud confirms, near the hero: the pink column has said it all before.
    if (at.mode === 'rest' && bagAt(b, was).mode === 'fall' && Math.abs(b.y - h.y) < 8) c.ev.push({ type: 'land' })
    if (at.mode !== 'fall') continue
    if (inBoxes(column(m, b.x, b.x + BAG.w, b.y), h.x, h.y)) hurtHero(c, BAG.dmg, b.x + BAG.w / 2, h.y, false, true)
  }
}
