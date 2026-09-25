/**
 * Walking: the walk area is a union of polygons minus some blocks; paths
 * come from A* on a coarse grid, then get pulled straight wherever the
 * straight line stays on the floor.
 */
import type { Poly, Pt, RoomDef } from '../types'
import { ROOM_H } from '../types'

const CELL = 3

export function inPoly(x: number, y: number, poly: Poly): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export interface WalkMap {
  w: number
  cols: number
  rows: number
  /** 1 = walkable, by cell. */
  grid: Uint8Array
  ok(x: number, y: number): boolean
}

const cache = new WeakMap<RoomDef, WalkMap>()

export function walkMap(room: RoomDef): WalkMap {
  let m = cache.get(room)
  if (m) return m
  const ok = (x: number, y: number) => {
    if (x < 0 || y < 0 || x > room.w || y > ROOM_H) return false
    if (!room.walk.some(p => inPoly(x, y, p))) return false
    return !(room.blocks ?? []).some(p => inPoly(x, y, p))
  }
  const cols = Math.ceil(room.w / CELL)
  const rows = Math.ceil(ROOM_H / CELL)
  const grid = new Uint8Array(cols * rows)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    grid[r * cols + c] = ok(c * CELL + CELL / 2, r * CELL + CELL / 2) ? 1 : 0
  }
  m = { w: room.w, cols, rows, grid, ok }
  cache.set(room, m)
  return m
}

function cellOf(m: WalkMap, x: number, y: number): number {
  const c = Math.max(0, Math.min(m.cols - 1, Math.floor(x / CELL)))
  const r = Math.max(0, Math.min(m.rows - 1, Math.floor(y / CELL)))
  return r * m.cols + c
}

function centre(m: WalkMap, i: number): [number, number] {
  return [(i % m.cols) * CELL + CELL / 2, Math.floor(i / m.cols) * CELL + CELL / 2]
}

/** The walkable point nearest (x, y). */
export function nearestWalkable(m: WalkMap, x: number, y: number): [number, number] {
  if (m.ok(x, y)) return [x, y]
  let best = -1
  let bd = Infinity
  for (let i = 0; i < m.grid.length; i++) {
    if (!m.grid[i]) continue
    const [cx, cy] = centre(m, i)
    // Vertical distance counts double: clicking a wall means "go under it".
    const d = (cx - x) ** 2 + ((cy - y) * 1.6) ** 2
    if (d < bd) { bd = d; best = i }
  }
  return best < 0 ? [x, y] : centre(m, best)
}

/** Straight line stays on the floor (sampled every pixel). */
export function clear(m: WalkMap, a: Pt, b: Pt): boolean {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dy)))
  for (let i = 1; i < n; i++) {
    const x = a[0] + (dx * i) / n
    const y = a[1] + (dy * i) / n
    if (!m.ok(x, y) && !m.grid[cellOf(m, x, y)]) return false
  }
  return true
}

/**
 * A path from `from` to `to` (both snapped onto the floor), as the points
 * after `from`. Empty when already there.
 */
export function findPath(room: RoomDef, from: Pt, to: Pt): Pt[] {
  const m = walkMap(room)
  const start: Pt = m.ok(from[0], from[1]) ? from : nearestWalkable(m, from[0], from[1])
  const goal: Pt = nearestWalkable(m, to[0], to[1])
  if (Math.hypot(goal[0] - start[0], goal[1] - start[1]) < 0.5) return []
  if (clear(m, start, goal)) return start === from ? [goal] : [start, goal]

  const s = nearestCell(m, start)
  const g = nearestCell(m, goal)
  const n = m.grid.length
  const cost = new Float32Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const closed = new Uint8Array(n)
  const open: number[] = [s]
  const f = new Float32Array(n).fill(Infinity)
  cost[s] = 0
  const [gx, gy] = centre(m, g)
  const h = (i: number) => { const [x, y] = centre(m, i); return Math.hypot(x - gx, y - gy) }
  f[s] = h(s)
  const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]] as const
  let found = false
  while (open.length) {
    // Small grids: a linear scan for the lowest f is fast enough.
    let bi = 0
    for (let i = 1; i < open.length; i++) if (f[open[i]!]! < f[open[bi]!]!) bi = i
    const cur = open[bi]!
    open[bi] = open[open.length - 1]!
    open.pop()
    if (cur === g) { found = true; break }
    if (closed[cur]) continue
    closed[cur] = 1
    const cc = cur % m.cols
    const cr = Math.floor(cur / m.cols)
    for (const [dc, dr, w] of dirs) {
      const nc = cc + dc
      const nr = cr + dr
      if (nc < 0 || nr < 0 || nc >= m.cols || nr >= m.rows) continue
      const ni = nr * m.cols + nc
      if (!m.grid[ni] || closed[ni]) continue
      // No corner cutting.
      if (dc && dr && (!m.grid[cr * m.cols + nc] || !m.grid[nr * m.cols + cc])) continue
      const nd = cost[cur]! + w * CELL
      if (nd < cost[ni]!) {
        cost[ni] = nd
        prev[ni] = cur
        f[ni] = nd + h(ni)
        open.push(ni)
      }
    }
  }
  if (!found) return [goal]
  const cells: Pt[] = []
  for (let i = g; i !== -1 && i !== s; i = prev[i]!) cells.push(centre(m, i))
  cells.reverse()
  const raw: Pt[] = [start, ...cells, goal]
  // String pulling: from each kept point, jump to the furthest visible one.
  const out: Pt[] = []
  let i = 0
  while (i < raw.length - 1) {
    let j = raw.length - 1
    while (j > i + 1 && !clear(m, raw[i]!, raw[j]!)) j--
    out.push(raw[j]!)
    i = j
  }
  if (start !== from) out.unshift(start)
  return out
}

function nearestCell(m: WalkMap, p: Pt): number {
  const i = cellOf(m, p[0], p[1])
  if (m.grid[i]) return i
  const [x, y] = nearestWalkable(m, p[0], p[1])
  return cellOf(m, x, y)
}
