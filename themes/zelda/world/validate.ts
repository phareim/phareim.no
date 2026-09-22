/**
 * World checks for the tests: row shapes, known chars, warps that land on
 * real entries, and that every chest, item, NPC, sign and warp can be
 * reached from an entry once every lock, gate, crack and block has given
 * way. Returns human-readable problems; empty means fine.
 */
import type { TileChar, World } from '../types'
import { isTileChar } from './tiles'

// Tiles that eventually let the hero through.
const PASSABLE = new Set<TileChar>(['.', ',', ':', ';', '*', '=', 'o', 'r', 'R', '%', 'L', 'K', 'X', 'b', '_', 'P', 'C', 'x', 'D', '>'])

export function validateWorld(world: World): string[] {
  const out: string[] = []
  const entriesOf: Record<string, Set<string>> = {}
  for (const [id, def] of Object.entries(world.maps)) {
    if (def.id !== id) out.push(`${id}: id mismatch (${def.id})`)
    const w = def.rows[0]?.length ?? 0
    def.rows.forEach((r, y) => { if (r.length !== w) out.push(`${id}: row ${y} has ${r.length} chars, want ${w}`) })
    if (def.cell && (w % def.cell.w || def.rows.length % def.cell.h)) out.push(`${id}: size not a multiple of the cell`)
    const entries = new Set(Object.keys(def.entries ?? {}))
    for (const [ch, m] of Object.entries(def.marks)) {
      if (m.ent.t === 'entry') entries.add(m.ent.id)
      if (!def.rows.some(r => r.includes(ch))) out.push(`${id}: marker '${ch}' is never placed`)
    }
    for (const [name, e] of Object.entries(def.entries ?? {})) {
      const ch = def.rows[Math.floor(e.y)]?.[Math.floor(e.x)]
      if (!ch || !PASSABLE.has((def.marks[ch]?.tile ?? ch) as TileChar)) out.push(`${id}: entry ${name} stands on '${ch}'`)
    }
    entriesOf[id] = entries
    if (!entries.size) out.push(`${id}: no entries`)
    def.rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const ch = r[x]!
        if (!def.marks[ch] && !isTileChar(ch)) out.push(`${id}: unknown char '${ch}' at ${x},${y}`)
      }
    })
  }
  if (!entriesOf[world.start.map]?.has(world.start.entry)) out.push('start entry missing')
  for (const [id, def] of Object.entries(world.maps)) {
    for (const m of Object.values(def.marks)) {
      if (m.ent.t === 'warp' && !entriesOf[m.ent.to]?.has(m.ent.entry)) out.push(`${id}: warp to ${m.ent.to}:${m.ent.entry} lands nowhere`)
    }
    out.push(...reachability(id, world))
  }
  return out
}

function reachability(id: string, world: World): string[] {
  const def = world.maps[id]!
  const h = def.rows.length
  const w = def.rows[0]!.length
  const tile = (x: number, y: number): TileChar => {
    const ch = def.rows[y]?.[x]
    if (ch === undefined) return '#'
    const m = def.marks[ch]
    if (m) return m.tile ?? (m.ent.t === 'chest' ? (m.ent.appear ? '.' : '$') : m.ent.t === 'sign' ? 'S' : m.ent.t === 'shop' ? 'n' : m.ent.t === 'gate' ? 'X' : m.ent.t === 'plate' ? '_' : '.')
    return isTileChar(ch) ? ch : '.'
  }
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  def.rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const m = def.marks[r[x]!]
      if (m && m.ent.t === 'entry') { seen[y * w + x] = 1; stack.push(y * w + x) }
    }
  })
  while (stack.length) {
    const i = stack.pop()!
    const x = i % w
    const y = Math.floor(i / w)
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (seen[j] || !PASSABLE.has(tile(nx, ny))) continue
      seen[j] = 1
      stack.push(j)
    }
  }
  const near = (x: number, y: number) =>
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx!
      const ny = y + dy!
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) return false
      if (seen[ny * w + nx]) return true
      // Across a shop counter.
      if (tile(nx, ny) === 'n') { const fx = nx + dx!; const fy = ny + dy!; return fx >= 0 && fy >= 0 && fx < w && fy < h && !!seen[fy * w + fx] }
      return false
    })
  const out: string[] = []
  def.rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const m = def.marks[r[x]!]
      if (!m || m.ent.t === 'entry') continue
      if (m.ent.t === 'enemy' || m.ent.t === 'plate' || m.ent.t === 'gate') continue
      if (!near(x, y)) out.push(`${id}: ${m.ent.t} at ${x},${y} is unreachable`)
    }
  })
  return out
}
