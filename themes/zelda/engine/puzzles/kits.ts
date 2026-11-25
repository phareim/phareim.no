/**
 * Puzzle kits for a generator: the smallest self-contained grids that each
 * pose one physical puzzle (or two combined), with the marks they need and the
 * condition that holds once solved (put it on a gate's `open` or a chest's
 * `appear`). `stampKit` writes a kit into a MapDef's rows at (x, y), giving its
 * marks free chars and its flags and plate ids a prefix of the caller's.
 * `solveKit` is the validator: a breadth-first search over the kit's abstract
 * states (where the hero stands, and the grid with its blocks, mirrors,
 * boulders, broken walls, filled pits and water), using the same rules as the
 * engine, at tile resolution: walking, sliding on ice, pushing (blocks and
 * mirrors slide on ice and fill pits), hitting a mirror, valve or lever beside
 * the hero, beams lighting receivers, plates and scales weighed. It answers
 * whether the kit's condition can be met from its entry, and how.
 *
 * A kit's rows have no outer wall: past its edge is wall. Its entry is where
 * the hero comes in (on its edge, open to the room around it).
 */
import type { Cond, Dir, EntDef, MapDef, Mark, TileChar } from '../../types'
import { TILE_INFO, isTileChar } from '../../world/tiles'
import { WEIGHT_PLATES, isMirror, puzzleMarkTile } from '../../world/puzzles'

export interface PuzzleKit {
  id: string
  /** What it teaches, one line. */
  about: string
  w: number
  h: number
  rows: string[]
  /** Marker chars of this kit (flags and plate ids in them are local: `stampKit` prefixes them). */
  marks: Record<string, Mark>
  /** Where the hero comes in (a tile on the kit's edge). */
  entry: { x: number; y: number }
  /** Holds once the puzzle is solved (flags and plate ids local, as in `marks`). */
  solved: Cond
  /** Items the hero needs (bombs, a sword for mirrors and valves: every hero past the start has one). */
  needs?: Array<'bombs'>
}

const kit = (k: Omit<PuzzleKit, 'w' | 'h'>): PuzzleKit => ({ ...k, w: k.rows[0]!.length, h: k.rows.length })

/** The kits. Rows use the tile chars of `types.ts` and the kit's own marker chars. */
export const puzzleKits: readonly PuzzleKit[] = [
  kit({
    id: 'ice-cross',
    about: 'Ice: slide from stone to stone to reach the plate.',
    rows: [
      '##θ####',
      'ααααα#α',
      'αIαααα.',
      'ααααIαα',
      'α#ααααα',
      'ααIαααα',
      '...α...',
    ],
    marks: { θ: { ent: { t: 'plate', id: 'goal' }, tile: 'θ' } },
    entry: { x: 3, y: 6 },
    solved: { plates: ['goal'] },
  }),
  kit({
    id: 'ice-block',
    about: 'Ice and weight: send the block sliding onto the heavy plate.',
    rows: [
      '#####η#',
      '.αααααα',
      '.αbααα#',
      '.ααααα.',
      '.......',
    ],
    marks: { η: { ent: { t: 'plate', id: 'goal' }, tile: 'η' } },
    entry: { x: 3, y: 4 },
    solved: { plates: ['goal'] },
  }),
  kit({
    id: 'beam-mirrors',
    about: 'Beams: turn the mirrors so the light reaches the receiver.',
    rows: [
      'E....R.',
      '.......',
      '.......',
      'μ....ν.',
      '.......',
    ],
    marks: {
      E: { ent: { t: 'emitter', dir: 'down' }, tile: 'β' },
      R: { ent: { t: 'receiver', flag: 'lit' }, tile: 'ρ' },
    },
    entry: { x: 3, y: 4 },
    solved: { flag: 'lit' },
  }),
  kit({
    id: 'beam-prism',
    about: 'A prism splits the beam: both receivers must be lit.',
    rows: [
      'A...E....',
      '.........',
      'μ...π...B',
      '.........',
      '.........',
    ],
    marks: {
      E: { ent: { t: 'emitter', dir: 'down' }, tile: 'β' },
      A: { ent: { t: 'receiver', flag: 'a' }, tile: 'ρ' },
      B: { ent: { t: 'receiver', flag: 'b' }, tile: 'ρ' },
    },
    entry: { x: 4, y: 4 },
    solved: { flags: ['a', 'b'] },
  }),
  kit({
    id: 'scale',
    about: 'Weights: the scale is level only with equal weight on both pans.',
    rows: [
      '.......',
      '.σ...σ.',
      '.......',
      '..b.b..',
      '.......',
    ],
    marks: { σ: { ent: { t: 'plate', id: 'scale' }, tile: 'σ' } },
    entry: { x: 3, y: 4 },
    solved: { plates: ['scale'] },
  }),
  kit({
    id: 'boulder-wall',
    about: 'Rolling stones: throw the lever; the boulder rolls down, breaks the cracked wall and opens the way.',
    rows: [
      'κ#...',
      'θ#.L.',
      '.#...',
      '%#...',
      '.....',
      '.....',
    ],
    marks: {
      κ: { ent: { t: 'boulder', dir: 'down', flag: 'go' }, tile: 'κ' },
      L: { ent: { t: 'lever', flag: 'go' }, tile: '}' },
      θ: { ent: { t: 'plate', id: 'goal' }, tile: 'θ' },
    },
    entry: { x: 3, y: 5 },
    solved: { plates: ['goal'] },
  }),
  kit({
    id: 'sluice',
    about: 'Water: the valve drains the basin; cross it to the plate.',
    rows: [
      '..θ..',
      'WWWWW',
      'WWWWW',
      '.V...',
    ],
    marks: {
      W: { ent: { t: 'sluice', flag: 'drain' }, tile: 'ω' },
      V: { ent: { t: 'valve', flag: 'drain' }, tile: 'ξ' },
      θ: { ent: { t: 'plate', id: 'goal' }, tile: 'θ' },
    },
    entry: { x: 3, y: 3 },
    solved: { plates: ['goal'] },
  }),
  kit({
    id: 'ice-mirror',
    about: 'Ice and beams: slide the mirror into the beam and turn it toward the receiver.',
    rows: [
      '#E######',
      '#......R',
      '#αααααα#',
      '#αμαααα#',
      '#αααααα#',
      '#......#',
    ],
    marks: {
      E: { ent: { t: 'emitter', dir: 'down' }, tile: 'β' },
      R: { ent: { t: 'receiver', flag: 'lit' }, tile: 'ρ' },
    },
    entry: { x: 4, y: 5 },
    solved: { flag: 'lit' },
  }),
]

// ---------------------------------------------------------------------------
// Stamping
// ---------------------------------------------------------------------------

const FREE_CHARS = 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ'

function prefixCond(c: Cond, p: (s: string) => string): Cond {
  if ('flag' in c) return { flag: p(c.flag) }
  if ('notFlag' in c) return { notFlag: p(c.notFlag) }
  if ('plates' in c) return { plates: c.plates.map(p) }
  if ('flags' in c) return { flags: c.flags.map(p), ...(c.not ? { not: c.not.map(p) } : {}) }
  return c
}

function prefixEnt(e: EntDef, p: (s: string) => string): EntDef {
  switch (e.t) {
    case 'plate': return { ...e, id: p(e.id) }
    case 'receiver': case 'sluice': case 'valve': case 'lever': return { ...e, flag: p(e.flag) }
    case 'boulder': return e.flag ? { ...e, flag: p(e.flag) } : e
    case 'emitter': return e.when ? { ...e, when: prefixCond(e.when, p) } : e
    default: return e
  }
}

/**
 * Write `k` into a copy of `def` with its top-left at (x, y). Its marks get chars the map does not use yet, and
 * every flag and plate id in it becomes `<prefix>.<name>`. Returns the new MapDef and the kit's solved condition
 * in the map's terms.
 */
export function stampKit(def: MapDef, k: PuzzleKit, x: number, y: number, prefix: string): { def: MapDef; solved: Cond } {
  const p = (s: string) => `${prefix}.${s}`
  const used = new Set<string>([...def.rows.join(''), ...Object.keys(def.marks)])
  const free = [...FREE_CHARS].filter(ch => !used.has(ch))
  const remap: Record<string, string> = {}
  const marks: Record<string, Mark> = { ...def.marks }
  for (const [ch, m] of Object.entries(k.marks)) {
    const to = free.shift()
    if (!to) throw new Error('stampKit: no free marker chars left')
    remap[ch] = to
    marks[to] = { ...m, ent: prefixEnt(m.ent, p) }
  }
  const rows = def.rows.slice()
  k.rows.forEach((r, ky) => {
    const row = [...rows[y + ky]!]
    ;[...r].forEach((ch, kx) => { row[x + kx] = remap[ch] ?? ch })
    rows[y + ky] = row.join('')
  })
  return { def: { ...def, rows, marks }, solved: prefixCond(k.solved, p) }
}

// ---------------------------------------------------------------------------
// The solver
// ---------------------------------------------------------------------------

export type KitMove = Dir | `hit-${Dir}`
export interface KitSolution { ok: boolean; moves: KitMove[]; states: number }

const DIRS: Array<[Dir, number, number]> = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]]
const WALK = new Set<TileChar>(['.', ',', ':', ';', '_', '{', 'x', 'α', 'θ', 'η', 'σ', 'ψ', 'D', '>', 'i', 'f', '-', '='])
const ONTO = new Set<TileChar>(['.', ',', '_', ':', '{', 'α', 'θ', 'η', 'σ', 'ψ'])
const ROLL = new Set<TileChar>(['.', ',', '_', ':', '{', ';', 'x', 'α', 'θ', 'η', 'σ', 'ψ', 'D', '>'])
const BEAM_PASSES = new Set<TileChar>(['~', 'ω', 'F', '¤', 'Z', 'n'])

interface Grid {
  w: number
  h: number
  /** Tiles as the map loads them. */
  base: TileChar[]
  ents: Map<number, EntDef>
}

function readKit(k: Pick<PuzzleKit, 'rows' | 'marks'>): Grid {
  const h = k.rows.length
  const w = k.rows[0]!.length
  const base: TileChar[] = []
  const ents = new Map<number, EntDef>()
  k.rows.forEach((r, y) => [...r].forEach((ch, x) => {
    const m = k.marks[ch]
    if (m) { ents.set(y * w + x, m.ent); base.push(m.tile ?? puzzleMarkTile(m.ent) ?? (m.ent.t === 'plate' ? '_' : m.ent.t === 'lever' ? '}' : '.')) }
    else base.push(isTileChar(ch) ? ch : '.')
  }))
  return { w, h, base, ents }
}

/**
 * Can the kit's condition be met from its entry? A breadth-first search over at most `limit` states; `moves` is a
 * shortest solution: ways to step or slide, and `hit-<way>` for the mirror, valve or lever beside the hero.
 */
export function solveKit(k: PuzzleKit, limit = 60000): KitSolution {
  return solveGrid(k, k.entry, k.solved, limit)
}

/** The solver on any grid with marks (a room of a hand-made map, say), from `start`, until `goal` holds. */
export function solveGrid(k: Pick<PuzzleKit, 'rows' | 'marks'>, start: { x: number; y: number }, goal: Cond, limit = 60000): KitSolution {
  const G = readKit(k)
  const { w, h, base, ents } = G
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h
  const flagOf = (i: number) => { const e = ents.get(i); return e && 'flag' in e ? e.flag : undefined }
  const sluices = [...ents].filter(([, e]) => e.t === 'sluice') as Array<[number, Extract<EntDef, { t: 'sluice' }>]>
  const full = (flags: Set<string>, e: Extract<EntDef, { t: 'sluice' }>) => (e.invert ? flags.has(e.flag) : !flags.has(e.flag))
  const under = (flags: Set<string>, i: number): TileChar => {
    const e = ents.get(i)
    if (e?.t === 'sluice') return full(flags, e) ? 'ω' : 'ψ'
    const b = base[i]!
    return b === 'α' || b === 'θ' || b === 'η' || b === 'σ' || b === '_' || b === ',' || b === ':' || b === 'ψ' ? b : '.'
  }
  const pushable = (t: TileChar) => t === 'b' || isMirror(t)

  /** Slide what stands at i along (dx, dy) as `shove` does; false if it cannot move. */
  const shove = (g: TileChar[], flags: Set<string>, hero: number, i: number, dx: number, dy: number): boolean => {
    let x = i % w
    let y = Math.floor(i / w)
    const t = g[i]!
    let fill = -1
    const x0 = x
    const y0 = y
    for (let n = 0; n < 64; n++) {
      const nx = x + dx
      const ny = y + dy
      if (!inside(nx, ny)) break
      const j = ny * w + nx
      if (g[j] === 'O') { x = nx; y = ny; fill = j; break }
      if (!ONTO.has(g[j]!) || j === hero) break
      x = nx
      y = ny
      if (g[j] !== 'α') break
    }
    if (x === x0 && y === y0) return false
    g[i] = under(flags, i)
    if (fill >= 0) g[fill] = '.'
    else g[y * w + x] = t
    return true
  }

  const roll = (g: TileChar[], i: number, dx: number, dy: number) => {
    let x = i % w
    let y = Math.floor(i / w)
    g[i] = '.'
    for (let n = 0; n < 64; n++) {
      const nx = x + dx
      const ny = y + dy
      if (!inside(nx, ny)) break
      const j = ny * w + nx
      const t = g[j]!
      if (t === '%' || t === 'R') { g[j] = '.'; x = nx; y = ny; continue }
      if (t === 'O') { g[j] = '.'; return }
      if (!ROLL.has(t)) break
      x = nx
      y = ny
    }
    g[y * w + x] = 'κ'
  }

  /** After a change: water to its groups' state, boulders released by their flags, beams traced and latched. */
  const settle = (g: TileChar[], flags: Set<string>, hero: number) => {
    for (const [i, e] of sluices) if (g[i] === 'ω' || g[i] === 'ψ') g[i] = full(flags, e) ? 'ω' : (i === hero ? 'ψ' : 'ψ')
    for (const [i, e] of ents) if (e.t === 'boulder' && e.flag && flags.has(e.flag) && !flags.has(`rolled:${i}`) && g[i] === 'κ') {
      flags.add(`rolled:${i}`)
      const [, dx, dy] = DIRS.find(d => d[0] === e.dir)!
      roll(g, i, dx, dy)
    }
    for (const [i, e] of ents) {
      if (e.t !== 'emitter' && !(base[i] === 'β' && !e)) continue
      if (e.t === 'emitter' && e.when && 'flag' in e.when && !flags.has(e.when.flag)) continue
      const [, ddx, ddy] = DIRS.find(d => d[0] === (e.t === 'emitter' ? e.dir : 'down'))!
      const stack: Array<[number, number, number, number]> = [[i % w, Math.floor(i / w), ddx, ddy]]
      const seen = new Set<number>()
      while (stack.length) {
        let [x, y, dx, dy] = stack.pop()!
        for (let n = 0; n < 128; n++) {
          const nx = x + dx
          const ny = y + dy
          if (!inside(nx, ny)) break
          const j = ny * w + nx
          const key = (j * 3 + dx + 1) * 3 + dy + 1
          if (seen.has(key)) break
          seen.add(key)
          const t = g[j]!
          if (t === 'μ') { stack.push([nx, ny, -dy, -dx]); break }
          if (t === 'ν') { stack.push([nx, ny, dy, dx]); break }
          if (t === 'π') { stack.push([nx, ny, dy, dx], [nx, ny, -dy, -dx]); break }
          if (t === 'ρ') { const f = flagOf(j); if (f) flags.add(f); break }
          if (TILE_INFO[t].solid && !BEAM_PASSES.has(t)) break
          x = nx
          y = ny
        }
      }
    }
  }

  const pressed = (g: TileChar[], hero: number): Set<string> => {
    const by = new Map<string, Array<[number, number]>>()
    base.forEach((b, i) => {
      if (WEIGHT_PLATES[b] === undefined && b !== '_') return
      const e = ents.get(i)
      const id = e?.t === 'plate' ? e.id : `w:${i}`
      const t = g[i]!
      let wt = t === 'b' || isMirror(t) ? 2 : t === 'κ' ? 3 : t === 'o' || t === 'r' ? 1 : 0
      if (i === hero) wt += 1
      const list = by.get(id) ?? []
      list.push([i, wt])
      by.set(id, list)
    })
    const out = new Set<string>()
    by.forEach((list, id) => {
      const scale = list.some(([i]) => base[i] === 'σ')
      if (scale ? list[0]![1] > 0 && list.every(([, v]) => v === list[0]![1]) : list.every(([i, v]) => v >= (WEIGHT_PLATES[base[i]!] ?? 2))) out.add(id)
    })
    return out
  }

  const met = (flags: Set<string>, plates: Set<string>, c: Cond): boolean => {
    if ('flag' in c) return flags.has(c.flag)
    if ('flags' in c) return c.flags.every(f => flags.has(f)) && !(c.not ?? []).some(f => flags.has(f))
    if ('plates' in c) return c.plates.every(p => plates.has(p))
    if ('notFlag' in c) return !flags.has(c.notFlag)
    return false
  }

  const g0 = base.slice()
  const f0 = new Set<string>()
  const h0 = start.y * w + start.x
  settle(g0, f0, h0)
  type St = { g: TileChar[]; f: Set<string>; hero: number; prev: string | null; move: KitMove | null }
  const keyOf = (s: Pick<St, 'g' | 'f' | 'hero'>) => `${s.hero}|${s.g.join('')}|${[...s.f].sort().join(',')}`
  const seen = new Map<string, St>()
  const q: St[] = [{ g: g0, f: f0, hero: h0, prev: null, move: null }]
  seen.set(keyOf(q[0]!), q[0]!)
  const done = (s: St) => met(s.f, pressed(s.g, s.hero), goal)
  const path = (s: St): KitMove[] => {
    const out: KitMove[] = []
    let cur: St | undefined = s
    while (cur && cur.move) { out.unshift(cur.move); cur = cur.prev ? seen.get(cur.prev) : undefined }
    return out
  }
  for (let qi = 0; qi < q.length; qi++) {
    const s = q[qi]!
    if (done(s)) return { ok: true, moves: path(s), states: seen.size }
    if (seen.size > limit) break
    const sk = keyOf(s)
    const next: Array<[KitMove, TileChar[], Set<string>, number]> = []
    const hx = s.hero % w
    const hy = Math.floor(s.hero / w)
    for (const [d, dx, dy] of DIRS) {
      const g = s.g.slice()
      const f = new Set(s.f)
      let hero = s.hero
      let x = hx
      let y = hy
      const nx = x + dx
      const ny = y + dy
      if (!inside(nx, ny)) continue
      const j = ny * w + nx
      if (pushable(g[j]!)) {
        if (!shove(g, f, hero, j, dx, dy)) continue
      } else {
        if (!WALK.has(g[j]!)) continue
        x = nx; y = ny
        while (g[y * w + x] === 'α') {
          const ax = x + dx
          const ay = y + dy
          if (!inside(ax, ay) || !WALK.has(g[ay * w + ax]!)) break
          x = ax; y = ay
        }
        hero = y * w + x
      }
      settle(g, f, hero)
      next.push([d, g, f, hero])
    }
    // A hit on the mirror, valve or lever beside the hero.
    for (const [d, dx, dy] of DIRS) {
      const nx = hx + dx
      const ny = hy + dy
      if (!inside(nx, ny)) continue
      const j = ny * w + nx
      const t = s.g[j]!
      const e = ents.get(j)
      if (!isMirror(t) && t !== 'ξ' && !(t === '}' && e?.t === 'lever')) continue
      const g = s.g.slice()
      const f = new Set(s.f)
      if (isMirror(t)) g[j] = t === 'μ' ? 'ν' : 'μ'
      else if (t === 'ξ' && e?.t === 'valve') {
        if (f.has(e.flag)) f.delete(e.flag)
        else f.add(e.flag)
        // (The water waits for the hero to step off: here, a valve that would drown him does nothing.)
        if (sluices.some(([i, se]) => i === s.hero && se.flag === e.flag && full(f, se))) continue
      } else if (e?.t === 'lever') { if (f.has(e.flag)) continue; f.add(e.flag) }
      settle(g, f, s.hero)
      next.push([`hit-${d}`, g, f, s.hero])
    }
    for (const [move, g, f, hero] of next) {
      const st: St = { g, f, hero, prev: sk, move }
      const key = keyOf(st)
      if (seen.has(key)) continue
      seen.set(key, st)
      q.push(st)
    }
  }
  return { ok: false, moves: [], states: seen.size }
}
