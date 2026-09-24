/**
 * World checks for the tests, for any World (Neon Shrine's, the portal's):
 * row shapes, known chars, warps that land on real entries, exits (unique
 * ids, a real target, a reachable place to stand), and that every chest,
 * item, NPC, sign and warp can be reached from an entry once every lock,
 * gate, crack and block has given way. Returns human-readable problems;
 * empty means fine.
 */
import type { Dir, EntDef, ExitTarget, MapDef, TileChar, World } from '../types'
import { TILE_INFO, isTileChar } from './tiles'

// Tiles that eventually let the hero through.
const PASSABLE = new Set<TileChar>(['.', ',', ':', ';', '*', '=', 'o', 'r', 'R', '%', 'L', 'K', 'X', 'b', '_', 'P', 'C', 'x', 'D', '>', 'i', 'f', 'B', 'l', '{'])
const STEP: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

/** The tile under a marker, as the engine's map loader places it. */
function markTile(e: EntDef): TileChar {
  switch (e.t) {
    case 'chest': return e.appear ? '.' : '$'
    case 'sign': return 'S'
    case 'shop': return 'n'
    case 'gate': return 'X'
    case 'plate': return '_'
    case 'exit': return 'D'
    case 'glyph': return '{'
    case 'lever': return '}'
    default: return '.'
  }
}

function tileOf(def: MapDef, x: number, y: number): TileChar {
  const ch = def.rows[y]?.[x]
  if (ch === undefined) return '#'
  const m = def.marks[ch]
  if (m) return m.tile ?? markTile(m.ent)
  return isTileChar(ch) ? ch : '.'
}

function badTarget(to: ExitTarget): string | null {
  if ('theme' in to) return typeof to.theme === 'string' && to.theme.trim() ? null : 'an empty theme'
  if ('url' in to) return typeof to.url === 'string' && to.url.startsWith('https://') ? null : `url ${String(to.url)} (want https://)`
  if ('home' in to) return to.home === true ? null : 'home not true'
  return 'no target'
}

export function validateWorld(world: World): string[] {
  const out: string[] = []
  const entriesOf: Record<string, Set<string>> = {}
  for (const [id, def] of Object.entries(world.maps)) {
    if (def.id !== id) out.push(`${id}: id mismatch (${def.id})`)
    const w = def.rows[0]?.length ?? 0
    def.rows.forEach((r, y) => { if (r.length !== w) out.push(`${id}: row ${y} has ${r.length} chars, want ${w}`) })
    if (def.cell && (w % def.cell.w || def.rows.length % def.cell.h)) out.push(`${id}: size not a multiple of the cell`)
    const entries = new Set(Object.keys(def.entries ?? {}))
    const markerEntries = new Set<string>()
    for (const [ch, m] of Object.entries(def.marks)) {
      if (m.ent.t === 'entry') { entries.add(m.ent.id); markerEntries.add(m.ent.id) }
      if (!def.rows.some(r => r.includes(ch))) out.push(`${id}: marker '${ch}' is never placed`)
    }
    // Exits: one placement per id, and each adds an entry of that name.
    const exitIds = new Set<string>()
    def.rows.forEach((r, y) => {
      for (let x = 0; x < r.length; x++) {
        const e = def.marks[r[x]!]?.ent
        if (!e || e.t !== 'exit') continue
        if (!e.id) out.push(`${id}: exit at ${x},${y} has no id`)
        else if (exitIds.has(e.id)) out.push(`${id}: exit id ${e.id} is used twice`)
        else if (markerEntries.has(e.id)) out.push(`${id}: exit id ${e.id} clashes with an entry marker`)
        exitIds.add(e.id)
        entries.add(e.id)
        const bad = badTarget(e.to)
        if (bad) out.push(`${id}: exit ${e.id} goes to ${bad}`)
      }
    })
    for (const [name, e] of Object.entries(def.entries ?? {})) {
      const tx = Math.floor(e.x)
      const ty = Math.floor(e.y)
      const ch = def.rows[ty]?.[tx]
      if (!ch || !PASSABLE.has(tileOf(def, tx, ty))) out.push(`${id}: entry ${name} stands on '${ch}'`)
      if (e.out) {
        const [dx, dy] = STEP[e.dir]
        if (!PASSABLE.has(tileOf(def, tx + dx, ty + dy))) out.push(`${id}: entry ${name} walks out into '${def.rows[ty + dy]?.[tx + dx]}'`)
      }
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
  if (!world.maps[world.start.map]) out.push(`start map ${world.start.map} missing`)
  else if (!entriesOf[world.start.map]?.has(world.start.entry)) out.push('start entry missing')
  for (const [id, def] of Object.entries(world.maps)) {
    for (const m of Object.values(def.marks)) {
      if (m.ent.t === 'warp' && !entriesOf[m.ent.to]?.has(m.ent.entry)) out.push(`${id}: warp to ${m.ent.to}:${m.ent.entry} lands nowhere`)
    }
    out.push(...reachability(id, world))
    // Holes: the floor below has the same size and floor under every hole.
    if (def.below) {
      const lo = world.maps[def.below]
      if (!lo) out.push(`${id}: below map ${def.below} missing`)
      else if (lo.rows.length !== def.rows.length || lo.rows[0]!.length !== def.rows[0]!.length) out.push(`${id}: below map ${def.below} has another size`)
      else def.rows.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) {
          if (tileOf(def, x, y) !== 'O') continue
          if (!PASSABLE.has(tileOf(lo, x, y))) out.push(`${id}: the hole at ${x},${y} lands on '${lo.rows[y]![x]}' in ${def.below}`)
        }
      })
    }
    // Words: every letter has a stone.
    const letters = new Set(Object.values(def.marks).flatMap(m => (m.ent.t === 'glyph' ? [m.ent.ch] : [])))
    for (const k of def.codes ?? []) for (const ch of k.word) if (!letters.has(ch)) out.push(`${id}: word ${k.word} needs a '${ch}' stone`)
  }
  return out
}

function reachability(id: string, world: World): string[] {
  const def = world.maps[id]!
  const h = def.rows.length
  const w = def.rows[0]!.length
  const tile = (x: number, y: number) => tileOf(def, x, y)
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  const seed = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x]) return
    seen[y * w + x] = 1
    stack.push(y * w + x)
  }
  // From the entry markers and the authored entries (not the ones exits add:
  // the place in front of an exit has to be reachable on its own).
  def.rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const m = def.marks[r[x]!]
      if (m && m.ent.t === 'entry') seed(x, y)
    }
  })
  for (const e of Object.values(def.entries ?? {})) seed(Math.floor(e.x), Math.floor(e.y))
  // Landing spots under the holes of the floor above.
  for (const up of Object.values(world.maps)) {
    if (up.below !== id || up.rows.length !== h || up.rows[0]!.length !== w) continue
    up.rows.forEach((r, y) => { for (let x = 0; x < w; x++) if (tileOf(up, x, y) === 'O' && PASSABLE.has(tile(x, y))) seed(x, y) })
  }
  const cw = def.cell?.w ?? w
  const chh = def.cell?.h ?? h
  const cellOf = (x: number, y: number) => Math.floor(x / cw) * 1000 + Math.floor(y / chh)
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
    // The hook: along each axis, over anything low, to an anchor in the same room.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      for (let k = 1; k <= 7; k++) {
        const ax = x + dx * k
        const ay = y + dy * k
        if (ax < 0 || ay < 0 || ax >= w || ay >= h || cellOf(ax, ay) !== cellOf(x, y)) break
        const t = tile(ax, ay)
        if (TILE_INFO[t].hook) {
          const lx = ax - dx
          const ly = ay - dy
          const j = ly * w + lx
          if (k > 1 && !seen[j] && PASSABLE.has(tile(lx, ly))) { seen[j] = 1; stack.push(j) }
          break
        }
        if (TILE_INFO[t].wall) break
      }
    }
  }
  const reached = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && !!seen[y * w + x]
  const near = (x: number, y: number) =>
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx!
      const ny = y + dy!
      if (reached(nx, ny)) return true
      // Across a shop counter.
      if (tile(nx, ny) === 'n') return reached(nx + dx!, ny + dy!)
      return false
    })
  const out: string[] = []
  def.rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const m = def.marks[r[x]!]
      if (!m || m.ent.t === 'entry') continue
      if (m.ent.t === 'enemy' || m.ent.t === 'plate' || m.ent.t === 'gate') continue
      if (m.ent.t === 'exit') {
        // Walk-on exits need their own tile reached; face-and-press ones the tile in front.
        const walk = !TILE_INFO[tile(x, y)].solid
        const [dx, dy] = STEP[m.ent.side ?? 'down']
        if (!PASSABLE.has(tile(x + dx, y + dy))) out.push(`${id}: exit ${m.ent.id} has no floor on its ${m.ent.side ?? 'down'} side`)
        else if (walk ? !reached(x, y) : !reached(x + dx, y + dy)) out.push(`${id}: exit ${m.ent.id} at ${x},${y} is unreachable`)
        continue
      }
      if (!near(x, y)) out.push(`${id}: ${m.ent.t} at ${x},${y} is unreachable`)
    }
  })
  return out
}
