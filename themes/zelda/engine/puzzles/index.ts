/**
 * The physical puzzles: ice, light beams and mirrors, weights and scales,
 * rolling boulders, sluices, and a little more physical combat. Every rule is
 * switched on by the map: by its puzzle tiles (`world/puzzles.ts`), or for the
 * combat by `MapDef.physics`. On any other map each hook returns at once, so
 * the older maps play exactly as before.
 *
 * The hooks, and where they are called from:
 * - `stepPhysics` (objects.ts `stepObjects`): beams, receivers, boulders, sluices.
 * - `pressedWeights` (objects.ts plates): which weighed plates and scales are down.
 * - `slideHero` (hero.ts movement): the hero on ice.
 * - `pushPuzzle` (hero.ts push), `hitPuzzle` (sword, disc, blast), `blastPuzzle` (bombs).
 * - `potSlides` (objects.ts thrown pots), `knockHazard` (enemies.ts knock-back).
 * - `resetPuzzleRoom` (game.ts, entering a dungeon room), `puzzleFloor` (psi blocks).
 * Docs: docs/games/neon-shrine-puzzles.md.
 */
import type { Dir, Enemy, GameState, MapState, PhysState, Thrown, TileChar } from '../../types'
import { HERO_R, PUSH_TIME } from '../../types'
import { TILE_INFO } from '../../world/tiles'
import { WEIGHT_PLATES, isMirror } from '../../world/puzzles'
import { STATS } from '../spawn'
import { BIG, hitEnemy, hurtHero, killEnemy, type Ctx } from '../combat'
import { cellIndex, circleBlocked, circleOnTile, condMet, has, moveCircle, setFlag, solidTile, tileAt } from '../map'
import { dirVec, nextId, toDir } from '../util'
import { floorUnder, puzzleFlag, puzzleInfo, sluiceFull, type PuzzleInfo } from './info'

export { puzzleInfo } from './info'

/** Tiles per second. */
export const SLIDE_SPEED = 8
export const ROLL_SPEED = 6.5
/** Seconds a pushed thing takes per tile it slides over ice (the first tile takes PUSH_TIME). */
const SLIDE_TILE = 1 / 9

const pz = (c: Ctx): PuzzleInfo => puzzleInfo(c.info)

/** The map's puzzle state, made on first use. */
export function phys(c: Ctx): PhysState {
  const m = c.s.map
  if (m.phys) return m.phys
  const full: Record<string, boolean> = {}
  for (const g of pz(c).sluices) full[g.key] = sluiceFull(c.s.flags, g)
  m.phys = { slide: null, beams: [], lit: [], rolling: [], weight: {}, full, pending: [], cool: 0 }
  return m.phys
}

/** What lies under tile `idx` once what stands there moves (psi blocks use it too). */
export function puzzleFloor(c: Ctx, idx: number): TileChar {
  return pz(c).on ? floorUnder(c.info, pz(c), c.s.flags, idx) : '.'
}

const inMap = (m: MapState, x: number, y: number) => x >= 0 && y >= 0 && x < m.w && y < m.h
const sameCell = (c: Ctx, a: number, x: number, y: number) =>
  c.info.def.kind !== 'dungeon' || cellIndex(c.info, x + 0.5, y + 0.5) === cellIndex(c.info, (a % c.s.map.w) + 0.5, Math.floor(a / c.s.map.w) + 0.5)

// ---------------------------------------------------------------------------
// The step
// ---------------------------------------------------------------------------

export function stepPhysics(c: Ctx, dt: number) {
  if (!pz(c).on) return
  const ph = phys(c)
  if (ph.cool > 0) ph.cool = Math.max(0, ph.cool - dt)
  stepSluices(c, ph)
  stepBoulders(c, ph, dt)
  traceBeams(c, ph)
}

// ---------------------------------------------------------------------------
// Ice: the hero
// ---------------------------------------------------------------------------

const onIce = (m: MapState, x: number, y: number) => tileAt(m, Math.floor(x), Math.floor(y)) === 'α'

/**
 * The hero's movement while on ice: null when the ice has nothing to say (walk as usual). Standing on ice, a
 * push of the stick sets him sliding along its main way, and he slides at SLIDE_SPEED until something stops him
 * or he reaches ground that is not ice. `blocked`: he leans into something (a block to push).
 */
export function slideHero(c: Ctx, mx: number, my: number, moving: boolean, dt: number): null | { blocked: boolean } {
  const p = pz(c)
  if (!p.ice) return null
  const s = c.s
  const h = s.hero
  const m = s.map
  const ph = phys(c)
  // A jump (a fall back to safety, a door, the hook) ends a slide.
  if (ph.slide && Math.hypot(h.x - ph.slide.at.x, h.y - ph.slide.at.y) > 0.6) ph.slide = null
  if (!ph.slide) {
    if (!moving || !onIce(m, h.x, h.y)) return null
    // The stick's main way first, then the other if it leans that way too.
    const ways: Array<[number, number]> = Math.abs(mx) >= Math.abs(my)
      ? [[Math.sign(mx), 0], [0, Math.sign(my)]]
      : [[0, Math.sign(my)], [Math.sign(mx), 0]]
    const want = ways.filter(([x, y], i) => (x || y) && (i === 0 || Math.abs(x ? mx : my) > 0.35))
    const go = want.find(([x, y]) => !circleBlocked(c.w, m, h.x + x * 0.05, h.y + y * 0.05, HERO_R))
    h.vx = 0
    h.vy = 0
    if (!go) {
      const [x, y] = want[0] ?? [0, 0]
      if (x || y) h.dir = toDir(x, y, h.dir)
      return { blocked: true }
    }
    ph.slide = { dx: go[0], dy: go[1], at: { x: h.x, y: h.y } }
    h.dir = toDir(go[0], go[1], h.dir)
  }
  const sl = ph.slide!
  const d = SLIDE_SPEED * dt
  // Along the slide, and toward the middle of its lane across it.
  const lane = sl.dx ? Math.floor(h.y) + 0.5 - h.y : Math.floor(h.x) + 0.5 - h.x
  const across = Math.sign(lane) * Math.min(Math.abs(lane), d * 0.5)
  const r = moveCircle(c.w, m, h.x, h.y, HERO_R, sl.dx * d + (sl.dx ? 0 : across), sl.dy * d + (sl.dy ? 0 : across))
  h.x = r.x
  h.y = r.y
  h.vx = sl.dx * SLIDE_SPEED
  h.vy = sl.dy * SLIDE_SPEED
  h.walkT += dt * 0.3
  const hit = sl.dx ? r.hitX : r.hitY
  if (hit || !onIce(m, h.x, h.y)) ph.slide = null
  else sl.at = { x: h.x, y: h.y }
  return { blocked: hit && moving && mx * sl.dx + my * sl.dy > 0.7 }
}

// ---------------------------------------------------------------------------
// Pushing: blocks and mirrors slide over ice, drop into pits and fill them
// ---------------------------------------------------------------------------

const PUSH_ONTO = new Set<TileChar>(['.', ',', '_', ':', '{', 'α', 'θ', 'η', 'σ', 'ψ'])

/** Can a pushed or rolling thing move into tile (x, y), coming from tile `from`? */
function canEnter(c: Ctx, from: number, x: number, y: number, onto = PUSH_ONTO): boolean {
  const m = c.s.map
  if (!inMap(m, x, y) || !sameCell(c, from, x, y)) return false
  if (!onto.has(tileAt(m, x, y))) return false
  if (m.enemies.some(e => !e.dead && Math.floor(e.x) === x && Math.floor(e.y) === y)) return false
  if (m.npcs.some(n => Math.floor(n.x) === x && Math.floor(n.y) === y)) return false
  if (m.phys?.rolling.some(r => Math.floor(r.x) === x && Math.floor(r.y) === y)) return false
  const h = c.s.hero
  return !circleOnTile(h.x, h.y, HERO_R, x, y)
}

/** Things the hero can push on a puzzle map. */
export const pushable = (t: TileChar) => t === 'b' || isMirror(t)

/**
 * Push the block or mirror at (tx, ty) along `d`: one tile, and on over ice until something stops it; into a pit
 * it drops and fills it. True when the puzzle rules handled the push (on a puzzle map they handle every push).
 */
export function pushPuzzle(c: Ctx, tx: number, ty: number, d: Dir): boolean {
  if (!pz(c).on) return false
  const m = c.s.map
  const t = tileAt(m, tx, ty)
  if (!pushable(t)) return true
  if (m.moving.some(b => b.tx === tx && b.ty === ty)) return true
  shove(c, tx, ty, dirVec(d).x, dirVec(d).y)
  return true
}

/** Move the thing at (tx, ty) along (dx, dy) as a push does (a bomb's blast shoves the same way). */
function shove(c: Ctx, tx: number, ty: number, dx: number, dy: number): boolean {
  const s = c.s
  const m = s.map
  const t = tileAt(m, tx, ty)
  const from = ty * m.w + tx
  let x = tx
  let y = ty
  let fills = -1
  for (let n = 0; n < 64; n++) {
    const nx = x + dx
    const ny = y + dy
    if (tileAt(m, nx, ny) === 'O' && !c.info.def.below && sameCell(c, from, nx, ny)) { x = nx; y = ny; fills = ny * m.w + nx; break }
    if (!canEnter(c, from, nx, ny)) break
    x = nx
    y = ny
    // It goes on only while it moves onto ice.
    if (tileAt(m, x, y) !== 'α') break
  }
  if (x === tx && y === ty) return false
  const dist = Math.abs(x - tx) + Math.abs(y - ty)
  m.tiles[from] = puzzleFloor(c, from)
  const to = y * m.w + x
  const kind = t === 'b' ? undefined : (t as 'μ' | 'ν')
  if (fills >= 0) {
    // Into the pit: it fills it, for good, and is gone.
    m.tiles[to] = '.'
    setFlag(s, `fill:${m.id}:${to}`)
    c.ev.push({ type: 'fall' })
  } else m.tiles[to] = t
  m.moving.push({ id: nextId(s), fx: tx, fy: ty, tx: x, ty: y, t: 0, dur: Math.max(PUSH_TIME, PUSH_TIME + (dist - 1) * SLIDE_TILE), ...(kind ? { kind } : {}) })
  m.version++
  c.ev.push({ type: 'push', x: x + 0.5, y: y + 0.5 })
  return true
}

// ---------------------------------------------------------------------------
// Hits: mirrors turn, valves open and shut
// ---------------------------------------------------------------------------

/** A blade, the disc or a blast on tile (tx, ty). True if it was a puzzle part (it answered or was resting). */
export function hitPuzzle(c: Ctx, tx: number, ty: number, t: TileChar): boolean {
  if (!isMirror(t) && t !== 'ξ') return false
  if (!pz(c).on) return false
  const ph = phys(c)
  const m = c.s.map
  if (ph.cool > 0) return true
  ph.cool = 0.3
  if (isMirror(t)) {
    if (m.moving.some(b => b.tx === tx && b.ty === ty)) return true
    m.tiles[ty * m.w + tx] = t === 'μ' ? 'ν' : 'μ'
    m.version++
    c.ev.push({ type: 'lever', x: tx + 0.5, y: ty + 0.5 })
    return true
  }
  const flag = pz(c).valves.get(ty * m.w + tx)
  if (!flag) return true
  if (has(c.s, flag)) delete c.s.flags[flag]
  else setFlag(c.s, flag)
  m.version++
  c.ev.push({ type: 'lever', x: tx + 0.5, y: ty + 0.5 })
  return true
}

/** A bomb on a puzzle map: blocks and mirrors beside it are shoved away, boulders kicked rolling. */
export function blastPuzzle(c: Ctx, x: number, y: number) {
  if (!pz(c).on) return
  const m = c.s.map
  const bx = Math.floor(x)
  const by = Math.floor(y)
  for (let ty = by - 1; ty <= by + 1; ty++) for (let tx = bx - 1; tx <= bx + 1; tx++) {
    if (tx === bx && ty === by) continue
    const t = tileAt(m, tx, ty)
    if (t !== 'b' && t !== 'κ' && !isMirror(t)) continue
    const ox = tx + 0.5 - x
    const oy = ty + 0.5 - y
    if (Math.abs(Math.abs(ox) - Math.abs(oy)) < 0.15) continue // on the diagonal: no clear way to go
    const [dx, dy] = Math.abs(ox) > Math.abs(oy) ? [Math.sign(ox), 0] : [0, Math.sign(oy)]
    // A stone its lever still holds does not budge: kicked off its road first, the lever could not send it.
    const held = t === 'κ' ? pz(c).boulders.get(ty * m.w + tx)?.flag : undefined
    if (held && !has(c.s, held)) continue
    if (t === 'κ') startRoll(c, ty * m.w + tx, dx, dy)
    else if (!m.moving.some(b => b.tx === tx && b.ty === ty)) shove(c, tx, ty, dx, dy)
  }
}

// ---------------------------------------------------------------------------
// Thrown pots on ice, foes knocked into hazards
// ---------------------------------------------------------------------------

/** A thrown pot or rock that comes down on ice slides on until it hits something (then it breaks). */
export function potSlides(c: Ctx, o: Thrown): boolean {
  if (!pz(c).ice) return false
  const m = c.s.map
  if (!onIce(m, o.x, o.y)) return false
  const len = Math.hypot(o.vx, o.vy) || 1
  const ax = Math.floor(o.x + (o.vx / len) * 0.4)
  const ay = Math.floor(o.y + (o.vy / len) * 0.4)
  return !solidTile(c.w, m, ax, ay, 'hero')
}

/**
 * After a knocked foe has moved: on a physical map a pit or water in the way of the knock swallows it, and spikes
 * hurt it. True when the foe is gone.
 */
export function knockHazard(c: Ctx, e: Enemy): boolean {
  if (!pz(c).physical || !e.knock || e.dead || BIG.has(e.kind) || STATS[e.kind].flying || STATS[e.kind].invulnerable) return false
  const k = e.knock
  const len = Math.hypot(k.vx, k.vy)
  if (len < 1e-6) return false
  const px = e.x + (k.vx / len) * (e.r + 0.12)
  const py = e.y + (k.vy / len) * (e.r + 0.12)
  const tx = Math.floor(px)
  const ty = Math.floor(py)
  if (c.info.def.kind === 'dungeon' && cellIndex(c.info, tx + 0.5, ty + 0.5) !== e.cell) return false
  const t = tileAt(c.s.map, tx, ty)
  if (t === 'O' || t === '~' || t === 'ω') {
    e.x = tx + 0.5
    e.y = ty + 0.5
    e.dead = true
    e.knock = null
    if (e.once) setFlag(c.s, e.once)
    c.ev.push({ type: 'fall' })
    c.ev.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind })
    return true
  }
  if (t === 'x') {
    const at = (e.ai.spiked as number | undefined) ?? -9
    if (c.s.elapsed - at < 0.5 && at >= 0) return false
    e.ai.spiked = c.s.elapsed
    e.hp -= 1
    e.flash = 0.14
    c.ev.push({ type: 'hit', x: e.x, y: e.y, kind: e.kind, killed: e.hp <= 0 })
    if (e.hp <= 0) { killEnemy(c, e); return true }
  }
  return false
}

// ---------------------------------------------------------------------------
// Weights
// ---------------------------------------------------------------------------

/** The weight on tile `idx` now: a block or mirror 2, a boulder 3, a pot or rock 1, the hero 1 (2 carrying), a foe 1 (a big one 3), Luna 1. */
export function weightOn(c: Ctx, idx: number): number {
  const s = c.s
  const m = s.map
  const tx = idx % m.w
  const ty = Math.floor(idx / m.w)
  const t = m.tiles[idx]!
  const at = (x: number, y: number) => Math.floor(x) === tx && Math.floor(y) === ty
  let w = 0
  if (!m.moving.some(b => b.tx === tx && b.ty === ty)) {
    if (t === 'b' || t === 'B' || isMirror(t)) w += 2
    else if (t === 'κ') w += 3
    else if (t === 'o' || t === 'r') w += 1
  }
  const h = s.hero
  if (!s.demo && at(h.x, h.y) && h.act !== 'fall' && !s.hook) w += h.carry ? 2 : 1
  for (const e of m.enemies) if (!e.dead && !STATS[e.kind].flying && at(e.x, e.y)) w += BIG.has(e.kind) ? 3 : 1
  if (s.luna && at(s.luna.x, s.luna.y)) w += 1
  return w
}

/** The weighed plates and scales held down now, by plate id (objects.ts adds them to the map's plates). */
export function pressedWeights(c: Ctx): string[] {
  const p = pz(c)
  if (!p.weights.size) return []
  const ph = phys(c)
  const byId = new Map<string, number[]>()
  ph.weight = {}
  p.weights.forEach((pid, idx) => {
    const w = weightOn(c, idx)
    ph.weight[idx] = w
    const list = byId.get(pid) ?? []
    list.push(w)
    byId.set(pid, list)
  })
  const out: string[] = []
  byId.forEach((ws, pid) => {
    if (p.scales.has(pid)) { if (ws[0]! > 0 && ws.every(w => w === ws[0])) out.push(pid) }
    else {
      const idxs = [...p.weights].filter(([, q]) => q === pid).map(([i]) => i)
      if (idxs.every(i => ph.weight[i]! >= (WEIGHT_PLATES[c.info.base[i]!] ?? 1))) out.push(pid)
    }
  })
  return out
}

/** Is tile `idx` one of the weighed plates (the ordinary plate rule leaves it alone)? */
export const isWeighed = (c: Ctx, idx: number) => pz(c).weights.has(idx)

// ---------------------------------------------------------------------------
// Beams
// ---------------------------------------------------------------------------

/** Tiles a beam crosses although they stop walkers. */
const BEAM_PASSES = new Set<TileChar>(['~', 'ω', 'F', '¤', 'Z', 'n'])

function stopsBeam(c: Ctx, x: number, y: number): boolean {
  const t = tileAt(c.s.map, x, y)
  if (BEAM_PASSES.has(t)) return false
  return solidTile(c.w, c.s.map, x, y, 'hero')
}

function traceBeams(c: Ctx, ph: PhysState) {
  const p = pz(c)
  const s = c.s
  const m = s.map
  ph.beams = []
  ph.lit = []
  for (const em of p.emitters) {
    if (c.info.def.kind === 'dungeon' && em.cell !== s.zoneIndex) continue
    if (!condMet(s, c.w, em.when, em.cell)) continue
    const v = dirVec(em.dir)
    const stack: Array<[number, number, number, number]> = [[em.idx % m.w, Math.floor(em.idx / m.w), v.x, v.y]]
    const seen = new Set<number>()
    while (stack.length && ph.beams.length < 64) {
      let [x, y, dx, dy] = stack.pop()!
      const x0 = x + 0.5
      const y0 = y + 0.5
      let end: [number, number] | null = null
      for (let n = 0; n < 128 && !end; n++) {
        const nx = x + dx
        const ny = y + dy
        if (!inMap(m, nx, ny) || !sameCell(c, em.idx, nx, ny)) { end = [x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5]; break }
        const t = tileAt(m, nx, ny)
        const key = ((ny * m.w + nx) * 3 + dx + 1) * 3 + dy + 1
        if (seen.has(key)) { end = [nx + 0.5, ny + 0.5]; break }
        seen.add(key)
        const moving = m.moving.some(b => b.tx === nx && b.ty === ny)
        if (isMirror(t) && !moving) {
          end = [nx + 0.5, ny + 0.5]
          stack.push(t === 'μ' ? [nx, ny, -dy, -dx] : [nx, ny, dy, dx])
        } else if (t === 'π') {
          end = [nx + 0.5, ny + 0.5]
          stack.push([nx, ny, dy, dx], [nx, ny, -dy, -dx])
        } else if (t === 'ρ') {
          end = [nx + 0.5, ny + 0.5]
          ph.lit.push(ny * m.w + nx)
        } else if (stopsBeam(c, nx, ny) || m.phys?.rolling.some(r => Math.floor(r.x) === nx && Math.floor(r.y) === ny)) {
          end = [x + 0.5 + dx * 0.5, y + 0.5 + dy * 0.5]
        } else { x = nx; y = ny }
      }
      if (!end) end = [x + 0.5, y + 0.5]
      ph.beams.push({ x0, y0, x1: end[0], y1: end[1] })
    }
  }
  for (const idx of ph.lit) {
    const flag = p.receivers.get(idx)
    if (flag && !has(s, flag)) {
      setFlag(s, flag)
      m.version++
      c.ev.push({ type: 'plate', x: (idx % m.w) + 0.5, y: Math.floor(idx / m.w) + 0.5 })
      c.ev.push({ type: 'secret' })
    }
  }
  // A beam burns the foes it crosses.
  if (!ph.beams.length) return
  for (const e of m.enemies) {
    if (e.dead || e.invuln > 0 || STATS[e.kind].invulnerable) continue
    if (c.info.def.kind === 'dungeon' && e.cell !== s.zoneIndex) continue
    for (const b of ph.beams) {
      if (segDist(e.x, e.y, b.x0, b.y0, b.x1, b.y1) < e.r) { hitEnemy(c, e, 1, e.x - Math.sign(b.x1 - b.x0) * 0.5, e.y - Math.sign(b.y1 - b.y0) * 0.5, 'shot'); break }
    }
  }
}

function segDist(px: number, py: number, x0: number, y0: number, x1: number, y1: number): number {
  const vx = x1 - x0
  const vy = y1 - y0
  const l2 = vx * vx + vy * vy || 1
  const t = Math.max(0, Math.min(1, ((px - x0) * vx + (py - y0) * vy) / l2))
  return Math.hypot(px - (x0 + vx * t), py - (y0 + vy * t))
}

// ---------------------------------------------------------------------------
// Boulders
// ---------------------------------------------------------------------------

const ROLL_ONTO = new Set<TileChar>(['.', ',', '_', ':', '{', ';', 'x', 'α', 'θ', 'η', 'σ', 'ψ', 'D', '>'])

/** Where boulder at tile `at` started out (its save flag says, else here). */
function homeOf(c: Ctx, at: number): { home: number; key: string | null } {
  const id = c.s.map.id
  for (const key of Object.keys(c.s.flags)) {
    const q = puzzleFlag(key, id)
    if (q && 'rest' in q && q.rest === at) return { home: q.home, key }
  }
  return { home: at, key: null }
}

/** Set the boulder on tile `idx` rolling along (dx, dy). False if the way is shut. */
export function startRoll(c: Ctx, idx: number, dx: number, dy: number): boolean {
  const m = c.s.map
  const tx = idx % m.w
  const ty = Math.floor(idx / m.w)
  const next = tileAt(m, tx + dx, ty + dy)
  if (!(next === 'O' || next === '%' || next === 'R' || canEnter(c, idx, tx + dx, ty + dy, ROLL_ONTO))) return false
  const ph = phys(c)
  const { home, key } = homeOf(c, idx)
  if (key) delete c.s.flags[key]
  m.tiles[idx] = puzzleFloor(c, idx)
  m.version++
  ph.rolling.push({ id: nextId(c.s), x: tx + 0.5, y: ty + 0.5, dx, dy, from: idx, home, t: 0 })
  c.s.shake = Math.max(c.s.shake, 0.15)
  c.ev.push({ type: 'push', x: tx + 0.5, y: ty + 0.5 })
  return true
}

function stepBoulders(c: Ctx, ph: PhysState, dt: number) {
  const s = c.s
  const m = s.map
  // Released by their flag (a lever), unless they rolled already.
  pz(c).boulders.forEach((b, idx) => {
    if (!b.flag || !has(s, b.flag) || m.tiles[idx] !== 'κ') return
    if (Object.keys(s.flags).some(f => f.startsWith(`boulder:${m.id}:${idx}:`))) return
    const v = dirVec(b.dir)
    startRoll(c, idx, v.x, v.y)
  })
  for (let i = ph.rolling.length - 1; i >= 0; i--) {
    const r = ph.rolling[i]!
    r.t += dt
    let left = ROLL_SPEED * dt
    let done = false
    while (left > 1e-9 && !done) {
      // Up to the next tile's middle, then look ahead.
      const cx = Math.floor(r.x) + 0.5
      const cy = Math.floor(r.y) + 0.5
      const toMid = (cx - r.x) * r.dx + (cy - r.y) * r.dy
      const go = toMid > 1e-9 ? Math.min(left, toMid) : Math.min(left, 1 + toMid)
      if (toMid <= 1e-9) {
        // At a tile's middle: what lies ahead?
        const tx = Math.floor(r.x)
        const ty = Math.floor(r.y)
        const nx = tx + r.dx
        const ny = ty + r.dy
        const t = tileAt(m, nx, ny)
        const here = ty * m.w + tx
        if ((t === '%' || t === 'R') && sameCell(c, here, nx, ny)) {
          // A cracked wall or boulder bursts, and the stone rolls on through.
          const j = ny * m.w + nx
          m.tiles[j] = '.'
          m.version++
          setFlag(s, `bomb:${m.id}:${j}`)
          s.shake = Math.max(s.shake, 0.3)
          c.ev.push({ type: 'boom', x: nx + 0.5, y: ny + 0.5 })
          c.ev.push({ type: 'secret' })
        } else if (t === 'O' && !c.info.def.below && sameCell(c, here, nx, ny)) {
          // Into a pit: it fills it, and the way is floor from now on.
          const j = ny * m.w + nx
          m.tiles[j] = '.'
          m.version++
          setFlag(s, `fill:${m.id}:${j}`)
          setFlag(s, `boulder:${m.id}:${r.home}:-1`)
          s.shake = Math.max(s.shake, 0.25)
          c.ev.push({ type: 'fall' })
          c.ev.push({ type: 'secret' })
          ph.rolling.splice(i, 1)
          done = true
          continue
        } else if (!canEnterRolling(c, here, nx, ny)) {
          // Comes to rest here.
          m.tiles[here] = 'κ'
          m.version++
          setFlag(s, `boulder:${m.id}:${r.home}:${here}`)
          s.shake = Math.max(s.shake, 0.2)
          c.ev.push({ type: 'push', x: tx + 0.5, y: ty + 0.5 })
          ph.rolling.splice(i, 1)
          done = true
          continue
        }
      }
      r.x += r.dx * go
      r.y += r.dy * go
      left -= go
    }
    if (done) continue
    crush(c, r)
  }
}

/** A rolling boulder goes over floors and through foes and the hero (who are hit); it stops at anything solid. */
function canEnterRolling(c: Ctx, from: number, x: number, y: number): boolean {
  const m = c.s.map
  if (!inMap(m, x, y) || !sameCell(c, from, x, y)) return false
  return ROLL_ONTO.has(tileAt(m, x, y)) && !m.moving.some(b => b.tx === x && b.ty === y)
}

function crush(c: Ctx, r: PhysState['rolling'][number]) {
  const s = c.s
  for (const e of s.map.enemies) {
    if (e.dead || STATS[e.kind].flying) continue
    if (Math.hypot(e.x - r.x, e.y - r.y) < 0.45 + e.r) hitEnemy(c, e, 4, r.x - r.dx, r.y - r.dy, 'bomb')
  }
  const h = s.hero
  if (Math.hypot(h.x - r.x, h.y - r.y) < 0.42 + HERO_R && h.invuln <= 0) {
    // Thrown aside, off the stone's path.
    const px = -r.dy
    const py = r.dx
    const side = (h.x - r.x) * px + (h.y - r.y) * py >= 0 ? 1 : -1
    hurtHero(c, 2, h.x - px * side, h.y - py * side)
  }
}

// ---------------------------------------------------------------------------
// Sluices
// ---------------------------------------------------------------------------

function stepSluices(c: Ctx, ph: PhysState) {
  const s = c.s
  const m = s.map
  const h = s.hero
  const p = pz(c)
  let changed = false
  for (const g of p.sluices) {
    const full = sluiceFull(s.flags, g)
    if (ph.full[g.key] === full) continue
    ph.full[g.key] = full
    changed = true
    for (const i of g.tiles) {
      const t = m.tiles[i]
      if (t !== 'ω' && t !== 'ψ') continue
      const tx = i % m.w
      const ty = Math.floor(i / m.w)
      if (!full) { m.tiles[i] = 'ψ'; ph.pending = ph.pending.filter(j => j !== i); continue }
      // The water waits for the hero to step out of it.
      if (circleOnTile(h.x, h.y, HERO_R, tx, ty)) { if (!ph.pending.includes(i)) ph.pending.push(i); continue }
      m.tiles[i] = 'ω'
      drown(c, tx, ty)
    }
    const i0 = g.tiles[0]!
    c.ev.push({ type: 'gate', x: (i0 % m.w) + 0.5, y: Math.floor(i0 / m.w) + 0.5 })
  }
  if (ph.pending.length) {
    ph.pending = ph.pending.filter(i => {
      const tx = i % m.w
      const ty = Math.floor(i / m.w)
      if (circleOnTile(h.x, h.y, HERO_R, tx, ty)) return true
      const g = p.sluiceOf.get(i)
      if (g && sluiceFull(s.flags, g) && m.tiles[i] === 'ψ') { m.tiles[i] = 'ω'; drown(c, tx, ty); changed = true }
      return false
    })
  }
  if (changed) m.version++
}

/** Foes that walk, standing where the water comes in, go under. */
function drown(c: Ctx, tx: number, ty: number) {
  for (const e of c.s.map.enemies) {
    if (e.dead || STATS[e.kind].flying || BIG.has(e.kind)) continue
    if (Math.floor(e.x) !== tx || Math.floor(e.y) !== ty) continue
    e.dead = true
    if (e.once) setFlag(c.s, e.once)
    c.ev.push({ type: 'kill', x: e.x, y: e.y, kind: e.kind })
  }
}

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

/**
 * Entering a dungeon room (after the blocks went home): the floors under where they stood come back, and unless
 * a gate of the room is open, its mirrors and the stones that came to rest go back to where and how they were.
 */
export function resetPuzzleRoom(c: Ctx, index: number) {
  const p = pz(c)
  if (!p.on) return
  const s = c.s
  const m = s.map
  const cx = index % c.info.cols
  const cy = Math.floor(index / c.info.cols)
  const solved = c.info.gates.some(g => g.cell === index && has(s, `gate:${g.id}`))
  const homes = p.mirrors.get(index)
  const inRoom = (i: number) => Math.floor((i % m.w) / c.info.cw) === cx && Math.floor(i / m.w / c.info.ch) === cy
  // Unless solved, the room's stones that came to rest go home too (a thrown lever lets them roll again).
  if (!solved) for (const f of Object.keys(s.flags)) {
    const q = puzzleFlag(f, m.id)
    if (!q || !('rest' in q) || q.rest < 0 || !inRoom(q.home)) continue
    if (m.tiles[q.rest] === 'κ') m.tiles[q.rest] = puzzleFloor(c, q.rest)
    m.tiles[q.home] = 'κ'
    delete s.flags[f]
  }
  for (let y = cy * c.info.ch; y < (cy + 1) * c.info.ch; y++) for (let x = cx * c.info.cw; x < (cx + 1) * c.info.cw; x++) {
    const i = y * m.w + x
    const t = m.tiles[i]!
    if (!solved && homes && isMirror(t) && !homes.some(([j]) => j === i)) m.tiles[i] = puzzleFloor(c, i)
    else if (t === '.' && c.info.base[i] !== '.') { const f = puzzleFloor(c, i); if (f !== '.' && !has(s, `fill:${m.id}:${i}`)) m.tiles[i] = f }
  }
  if (!solved && homes) for (const [i, t] of homes) m.tiles[i] = t
  if (m.phys) { m.phys.slide = null; m.phys.pending = [] }
  m.version++
}

/** What a puzzle map's hero stands on, for tests and the renderer. */
export function underHero(s: GameState): TileChar {
  return tileAt(s.map, Math.floor(s.hero.x), Math.floor(s.hero.y))
}

void TILE_INFO
