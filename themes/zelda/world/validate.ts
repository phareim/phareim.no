/**
 * World checks for the tests, for any World (Neon Shrine's, the portal's):
 * row shapes, known chars, warps that land on real entries, exits (unique
 * ids, a real target, a reachable place to stand), and that every chest,
 * item, NPC, sign and warp can be reached from an entry once every lock,
 * gate, crack and block has given way. On a map with view blocks (square,
 * diamond: solid in one view each) the routes are walked in both states, a
 * turn allowed on any tile free in both; every entry stands on such a tile,
 * and the map allows both views. Returns human-readable problems; empty means
 * fine.
 */
import type { Dir, EntDef, ExitTarget, MapDef, TileChar, ViewSide, World } from '../types'
import { roomed } from '../types'
import { TILE_INFO, blockUp, isTileChar, isViewBlock } from './tiles'
import { puzzleMarkTile } from './puzzles'
import { TUBE_ARMS } from './tubes'

// Tiles that eventually let the hero through.
const PASSABLE = new Set<TileChar>(['.', ',', ':', ';', '*', '=', 'o', 'r', 'R', '%', 'L', 'K', 'X', 'b', '_', 'P', 'C', 'x', 'D', '>', 'i', 'f', 'B', 'l', '{', '-', '¤', 'а', 'б', 'в', 'д', 'е', 'ж', 'з', 'и', 'й', 'к', 'α', 'θ', 'η', 'σ', 'ψ', 'ω', 'μ', 'ν', 'κ', '□', '◇', 'Ħ', '¯', ...(Object.keys(TUBE_ARMS) as TileChar[])])
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
    case 'stand': return 'o'
    default: return puzzleMarkTile(e) ?? '.'
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
  if ('reset' in to) return to.reset === true ? null : 'reset not true'
  if ('panel' in to) return to.panel === 'account' || to.panel === 'look' || to.panel === 'news' || to.panel === 'view' ? null : `panel ${String(to.panel)}`
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
    if (def.kind === 'side') {
      if (!def.cell) out.push(`${id}: a side map has no cell`)
      if (def.rows.some(r => [...r].some(ch => !def.marks[ch] && (ch === '□' || ch === '◇')))) out.push(`${id}: view blocks on a side map, which is shown one way only`)
    }
    const entries = new Set(Object.keys(def.entries ?? {}))
    const markerEntries = new Set<string>()
    for (const [ch, m] of Object.entries(def.marks)) {
      if (m.ent.t === 'entry') { entries.add(m.ent.id); markerEntries.add(m.ent.id) }
      if (!def.rows.some(r => r.includes(ch))) out.push(`${id}: marker '${ch}' is never placed`)
      // A foe that carries something comes back with it on every room re-entry unless it falls for good.
      if (m.ent.t === 'enemy' && m.ent.carries && !m.ent.once) out.push(`${id}: marker '${ch}' carries a ${m.ent.carries} and has no once flag`)
      if (m.ent.t === 'gate') {
        if (m.ent.trap) {
          if (!roomed(def.kind) || !def.cell) out.push(`${id}: marker '${ch}' is a trap gate outside a dungeon's rooms`)
          if (m.ent.open) out.push(`${id}: marker '${ch}' is a trap gate with a condition of its own`)
          if (m.ent.latch) out.push(`${id}: marker '${ch}' is a trap gate with a latch`)
        } else if (!m.ent.open) out.push(`${id}: marker '${ch}' is a gate that nothing opens`)
      }
      if (m.ent.t === 'stand' && (!roomed(def.kind) || !def.cell)) out.push(`${id}: marker '${ch}' is a pot stand outside a dungeon's rooms`)
      if (m.ent.t === 'ledge' && def.kind !== 'side') out.push(`${id}: marker '${ch}' is a safe ledge outside a side map`)
      if (m.ent.t === 'enemy' && m.ent.tough) {
        if (m.ent.kind !== 'sentry' && m.ent.kind !== 'hound') out.push(`${id}: marker '${ch}' is a tough ${m.ent.kind} (only a sentry or a hound may be tough)`)
        if (m.ent.calm) out.push(`${id}: marker '${ch}' is calm and tough at once`)
      }
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
  const landsIn = (to: string): Set<string> | undefined => entriesOf[to]
  out.push(...atlasProblems(world))
  for (const [id, def] of Object.entries(world.maps)) {
    for (const m of Object.values(def.marks)) {
      if (m.ent.t === 'warp' && !landsIn(m.ent.to)?.has(m.ent.entry)) out.push(`${id}: warp to ${m.ent.to}:${m.ent.entry} lands nowhere`)
    }
    out.push(...reachability(id, world))
    out.push(...viewProblems(id, world))
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
  // A pit on a boulder's road is filled once it rolls (`engine/puzzles/`): floor.
  const filled = new Set<number>()
  def.rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const e = def.marks[r[x]!]?.ent
      if (e?.t !== 'boulder') continue
      const [dx, dy] = STEP[e.dir]
      for (let k = 1, bx = x + dx, by = y + dy; k < 64 && bx >= 0 && by >= 0 && bx < w && by < h; k++, bx += dx, by += dy) {
        const t = tileOf(def, bx, by)
        if (t === 'O') { filled.add(by * w + bx); break }
        if (t !== '%' && t !== 'R' && TILE_INFO[t].solid) break
      }
    }
  })
  // A trap gate starts open and only ever shuts for a fight: floor, the whole run of it.
  const trapped = new Set<number>()
  def.rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const e = def.marks[r[x]!]?.ent
      if (e?.t !== 'gate' || !e.trap) continue
      for (const st = [[x, y]]; st.length;) {
        const [a, b] = st.pop() as [number, number]
        if (a < 0 || b < 0 || a >= w || b >= h || trapped.has(b * w + a) || tileOf(def, a, b) !== 'X') continue
        trapped.add(b * w + a)
        st.push([a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1])
      }
    }
  })
  const tile = (x: number, y: number): TileChar => (filled.has(y * w + x) || trapped.has(y * w + x) ? '.' : tileOf(def, x, y))
  // The states a route may be walked in: one, or on a map with view blocks one a view. `seen` and the stack hold
  // tile + state × (w × h).
  const sides: Array<ViewSide | null> = hasBlocks(def) ? ['flat', 'iso'] : [null]
  const N = w * h
  const open = (x: number, y: number, k: number) => {
    const t = tile(x, y)
    const side = sides[k]!
    return PASSABLE.has(t) && !(side && blockUp(t, side))
  }
  let seen = new Uint8Array(N * sides.length)
  const stack: number[] = []
  const push = (i: number) => { if (!seen[i]) { seen[i] = 1; stack.push(i) } }
  const starts: Array<[number, number]> = []
  const seed = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    starts.push([x, y])
  }
  /** Where a route may begin: in every state (an entry on a map with view blocks is free in both: `viewProblems`). */
  const begin = (x: number, y: number) => sides.forEach((_, k) => { if (sides.length === 1 || open(x, y, k)) push(y * w + x + k * N) })
  // From the entry markers and the authored entries (not the ones exits add:
  // the place in front of an exit has to be reachable on its own).
  def.rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const m = def.marks[r[x]!]
      if (m && m.ent.t === 'entry') seed(x, y)
    }
  })
  for (const e of Object.values(def.entries ?? {})) seed(Math.floor(e.x), Math.floor(e.y))
  // A land's passes: open rim tiles with open ground on the next map of the grid (`atlasProblems` checks both sides).
  const o = world.atlas?.[id]
  if (o) {
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (PASSABLE.has(tile(x, y)) && atlasTile(world, o.x + x, o.y + y + (y ? 1 : -1), id)) seed(x, y)
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (PASSABLE.has(tile(x, y)) && atlasTile(world, o.x + x + (x ? 1 : -1), o.y + y, id)) seed(x, y)
  }
  // Landing spots under the holes of the floor above.
  for (const up of Object.values(world.maps)) {
    if (up.below !== id || up.rows.length !== h || up.rows[0]!.length !== w) continue
    up.rows.forEach((r, y) => { for (let x = 0; x < w; x++) if (tileOf(up, x, y) === 'O' && PASSABLE.has(tile(x, y))) seed(x, y) })
  }
  const cw = def.cell?.w ?? w
  const chh = def.cell?.h ?? h
  const cellOf = (x: number, y: number) => Math.floor(x / cw) * 1000 + Math.floor(y / chh)
  const flood = () => { while (stack.length) {
    const n = stack.pop()!
    const k = Math.floor(n / N)
    const i = n % N
    const x = i % w
    const y = Math.floor(i / w)
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || !open(nx, ny, k)) continue
      push(ny * w + nx + k * N)
    }
    // A turn: on a tile free in both states.
    if (sides.length > 1 && !isViewBlock(tile(x, y))) for (let o = 0; o < sides.length; o++) if (o !== k) push(i + o * N)
    // The hook: along each axis, over anything low, to an anchor in the same room.
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      for (let a = 1; a <= 7; a++) {
        const ax = x + dx * a
        const ay = y + dy * a
        if (ax < 0 || ay < 0 || ax >= w || ay >= h || cellOf(ax, ay) !== cellOf(x, y)) break
        const t = tile(ax, ay)
        if (TILE_INFO[t].hook) {
          const lx = ax - dx
          const ly = ay - dy
          if (a > 1 && open(lx, ly, k)) push(ly * w + lx + k * N)
          break
        }
        // (A view block stops the chain only while it is up.)
        if (isViewBlock(t) ? blockUp(t, sides[k]!) : TILE_INFO[t].wall) break
      }
    }
  } }
  const reached = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && sides.some((_, k) => !!seen[y * w + x + k * N])
  const out: string[] = []
  // On a map with view blocks the entries are one place too: each is reached from the first by walking and turning.
  const doors = sides.length > 1 ? [...def.rows.flatMap((r, y) => [...r].flatMap((ch, x) => (def.marks[ch]?.ent.t === 'entry' ? [{ x, y }] : []))), ...Object.values(def.entries ?? {}).map(e => ({ x: Math.floor(e.x), y: Math.floor(e.y) }))] : []
  if (doors.length > 1) {
    begin(doors[0]!.x, doors[0]!.y)
    flood()
    for (const d of doors) if (!reached(d.x, d.y)) out.push(`${id}: entry at ${d.x},${d.y} is unreachable from the entry at ${doors[0]!.x},${doors[0]!.y} in either view`)
    seen = new Uint8Array(N * sides.length)
  }
  for (const [x, y] of starts) begin(x, y)
  flood()
  const near = (x: number, y: number) =>
    [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = x + dx!
      const ny = y + dy!
      if (reached(nx, ny)) return true
      // Across a shop counter.
      if (tile(nx, ny) === 'n') return reached(nx + dx!, ny + dy!)
      return false
    })
  def.rows.forEach((r, y) => {
    for (let x = 0; x < w; x++) {
      const m = def.marks[r[x]!]
      if (!m || m.ent.t === 'entry') continue
      if (m.ent.t === 'enemy' || m.ent.t === 'plate' || m.ent.t === 'gate') continue
      // Puzzle parts work from afar (a beam, a lever's flag, a sluice); their kits are checked by `engine/puzzles/kits.ts`.
      if (m.ent.t === 'emitter' || m.ent.t === 'receiver' || m.ent.t === 'boulder' || m.ent.t === 'sluice') continue
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

/** The map has square or diamond blocks, so the view is a rule on it. */
function hasBlocks(def: MapDef): boolean {
  return def.rows.some((r, y) => { for (let x = 0; x < r.length; x++) if (isViewBlock(tileOf(def, x, y))) return true; return false })
}

/**
 * What a map with view blocks owes the player, whichever way the picture faces: both views allowed, and every place a
 * hero can be put down (an entry, the step out of its door, a drop through a hole) free in both states, so a turn
 * forced on the way in can never be refused.
 */
function viewProblems(id: string, world: World): string[] {
  const def = world.maps[id]!
  if (!hasBlocks(def)) return []
  const out: string[] = []
  const where = (x: number, y: number) => `${x},${y} ('${tileOf(def, x, y)}')`
  if (def.views && !(def.views.includes('classic') && def.views.includes('iso'))) {
    const y = def.rows.findIndex((r, j) => [...r].some((_, x) => isViewBlock(tileOf(def, x, j))))
    const x = [...def.rows[y]!].findIndex((_, i) => isViewBlock(tileOf(def, i, y)))
    out.push(`${id}: has a view block at ${where(x, y)} but allows only ${def.views.join(', ') || 'no view'} (a map with view blocks allows both views)`)
  }
  /** Free in both states: floor whichever way the view is. */
  const free = (x: number, y: number) => { const t = tileOf(def, x, y); return PASSABLE.has(t) && !isViewBlock(t) }
  const land = (what: string, x: number, y: number) => { if (!free(x, y)) out.push(`${id}: ${what} lands on ${where(x, y)}, which is not free in both views`) }
  const entry = (name: string, x: number, y: number, walk?: Dir) => {
    land(`entry ${name}`, x, y)
    if (walk) land(`the step out of entry ${name}`, x + STEP[walk][0], y + STEP[walk][1])
  }
  def.rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const e = def.marks[r[x]!]?.ent
      if (e?.t === 'entry') entry(e.id, x, y)
      // (The entry the engine adds beside an exit.)
      else if (e?.t === 'exit') { const [dx, dy] = STEP[e.side ?? 'down']; entry(e.id, x + dx, y + dy) }
    }
  })
  for (const [name, e] of Object.entries(def.entries ?? {})) entry(name, Math.floor(e.x), Math.floor(e.y), e.out ? e.dir : undefined)
  for (const up of Object.values(world.maps)) {
    if (up.below !== id) continue
    up.rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (tileOf(up, x, y) === 'O') land(`the hole of ${up.id}`, x, y) })
  }
  return out
}

/** The tile at (gx, gy) on the world's grid, on whichever map of the atlas holds it but `not`; null where none does. */
function atlasTile(world: World, gx: number, gy: number, not?: string): TileChar | null {
  for (const [id, o] of Object.entries(world.atlas ?? {})) {
    const def = world.maps[id]
    if (id === not || !def) continue
    const x = gx - o.x
    const y = gy - o.y
    if (x >= 0 && y >= 0 && y < def.rows.length && x < def.rows[0]!.length) return tileOf(def, x, y)
  }
  return null
}

/**
 * The grid (`World.atlas`): every map on it exists, no two overlap, and every seam is honest: a rim tile a walker
 * can stand on has open ground on the map beyond it (or no map beyond it), and a pass is open on both sides, so
 * walking off an edge always lands somewhere and never into a wall.
 */
function atlasProblems(world: World): string[] {
  const out: string[] = []
  const placed = Object.entries(world.atlas ?? {}).filter(([id]) => {
    if (world.maps[id]) return true
    out.push(`atlas: ${id} is not a map`)
    return false
  }).map(([id, o]) => ({ id, ...o, w: world.maps[id]!.rows[0]!.length, h: world.maps[id]!.rows.length }))
  for (const a of placed) for (const b of placed) {
    if (a.id < b.id && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push(`atlas: ${a.id} overlaps ${b.id}`)
  }
  for (const a of placed) {
    const def = world.maps[a.id]!
    const check = (x: number, y: number, gx: number, gy: number) => {
      const mine = tileOf(def, x, y)
      const there = atlasTile(world, gx, gy, a.id)
      if (there === null) return
      const open = (t: TileChar) => !TILE_INFO[t].solid
      if (open(mine) && !open(there)) out.push(`atlas: ${a.id} ${x},${y} is open but the map beyond it is closed at ${gx},${gy}`)
    }
    for (let x = 0; x < a.w; x++) { check(x, 0, a.x + x, a.y - 1); check(x, a.h - 1, a.x + x, a.y + a.h) }
    for (let y = 0; y < a.h; y++) { check(0, y, a.x - 1, a.y + y); check(a.w - 1, y, a.x + a.w, a.y + y) }
  }
  return out
}
