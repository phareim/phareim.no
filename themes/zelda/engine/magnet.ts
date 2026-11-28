/**
 * THE MAGNET (docs/games/neon-shrine-heap.md), the Heap's treasure: B latches the nearest metal ahead; loose metal
 * comes to the hero, the hero goes to bolted metal.
 *
 * - The aim is the stick's while it is held, else the way the hero faces. The target is the nearest metal inside
 *   `MAGNET.cone` either side of it, from `MAGNET.near` to `MAGNET.reach` tiles centre to centre, in the hero's own
 *   room, with no wall or shut gate on the line. For a bolt or a cart no other resting iron may be on the line either.
 *   Foes are never targets, but for a PHI: gold is metal, and one is pulled to a tile before the hero, stunned.
 *   B then rests long (`MAGNET.phiRest`): the five are not to be reeled in one after another.
 * - Resting iron is a tile (`world/tiles.ts`): solid to walkers and foes, open to shots and the blade's sight.
 * - Loose iron (`▣ ▤`) flies over pits and water and comes down on the last free floor tile of its line towards the
 *   hero, short of any iron on the way. A resting piece weighs on a plain plate.
 * - Railed iron (`▥ ▦`) moves along its rail only (`rail` marks), to the rail tile level with the hero.
 * - A bolt (`▧`) takes the hero: the hook's own pull (`hook.ts`, `Hook.magnet`), so nothing touches him on the way.
 * - No latch shuts the hero in: iron never comes to rest, and no bolt sets the hero down, where no way on foot or
 *   from bolt to bolt leads out of the room any more (`strands`).
 * - Iron off its home tile goes home when its room is entered again; smashed iron after `MAGNET.mend` s. None of it is
 *   saved: a map loads with its iron where it was written.
 */
import type { Enemy, GameState, Input, IronFlight, IronState, MapState, TileChar, Vec, World } from '../types'
import { HERO_R } from '../types'
import { TILE_INFO, isBolt, isIron, isLoose, isRailed, isViewBlock } from '../world/tiles'
import type { Ctx } from './combat'
import { aimOf } from './hero'
import { cellIndex, cellRect, circleBlocked, circleOnTile, mapInfo, solidTile, type MapInfo } from './map'
import { STATS } from './spawn'
import { angleDiff, dirAngle } from './util'

export const MAGNET = {
  /** Tiles, centre to centre: nothing nearer is taken (so a second tap reaches past the crate at the hero's feet). */
  near: 1.6,
  reach: 7.5,
  /** Radians either side of the aim. */
  cone: (50 * Math.PI) / 180,
  /** Seconds B rests after a latch, and after a tap that took nothing. */
  rest: 0.4,
  fizzle: 0.2,
  /** Seconds B rests after it has pulled a PHI: gold is heavy. (The preview and the B box show it.) */
  phiRest: 5,
  /** Tiles a second: loose iron through the air, a cart on its rail. (The hero's flight is the hook's pull.) */
  loose: 11,
  cart: 8,
  /** Seconds before smashed iron comes home. */
  mend: 5,
  /** A bolt's landing: this far before the bolt's middle, backed off a quarter tile at a time to `far` at most. */
  land: 1,
  far: 2.5,
} as const

/** What a tap would take now: the metal's tile and middle, and where it (or, for a bolt, the hero) would end up. */
export type MagnetPlan =
  | { t: 'loose' | 'cart'; idx: number; x: number; y: number; to: number }
  | { t: 'bolt'; idx: number; x: number; y: number; to: Vec }
  | { t: 'phi'; id: string; x: number; y: number; to: Vec }

const iron = (m: MapState): IronState => (m.iron ??= { flights: [], away: {}, smashed: [], rest: 0 })
const mid = (m: Pick<MapState, 'w'>, i: number): Vec => ({ x: (i % m.w) + 0.5, y: Math.floor(i / m.w) + 0.5 })
const tileOfPoint = (m: Pick<MapState, 'w'>, x: number, y: number) => Math.floor(y) * m.w + Math.floor(x)
/** What lies under a piece of iron on tile `i`: the map's own tile there, or bare floor where iron was written. */
const under = (info: MapInfo, i: number): TileChar => (isIron(info.base[i]!) ? '.' : info.base[i]!)

/** The tiles a straight line passes through, from (x0, y0) to (x1, y1), in order, each once. */
function line(m: Pick<MapState, 'w'>, x0: number, y0: number, x1: number, y1: number): number[] {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 0.05))
  const out: number[] = []
  for (let k = 0; k <= n; k++) {
    const i = tileOfPoint(m, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n)
    if (out[out.length - 1] !== i) out.push(i)
  }
  return out
}

/** Tiles iron has taken (`on`) and left (`off`) that the map does not show yet: for asking what a latch would leave. */
interface Moved { on?: ReadonlySet<number>; off?: number }
const ironOn = (m: MapState, i: number, v?: Moved) => !!v?.on?.has(i) || (i !== v?.off && isIron(m.tiles[i]!))

/** No wall or shut gate between the point `from` and tile `target`; with `still`, no resting iron either. */
function sees(world: World, m: MapState, from: Vec, target: number, still: boolean, moved?: Moved): boolean {
  const to = mid(m, target)
  return line(m, from.x, from.y, to.x, to.y).every((i) => {
    if (i === target) return true
    if (solidTile(world, m, i % m.w, Math.floor(i / m.w), 'shot')) return false
    return !(still && ironOn(m, i, moved))
  })
}

/**
 * May a piece of iron be on tile `i`? Open floor off its room's rim (a doorway), no gate, door,
 * stair or chest, nothing lying there to pick up, nobody standing on it, and no other flight on its way to it.
 * `landing`: it is about to come down, when a flier overhead is no matter.
 */
function free(world: World, s: GameState, i: number, self?: IronFlight, landing = false, minded = true): boolean {
  const m = s.map
  const info = mapInfo(world, m.id)
  const tx = i % m.w
  const ty = Math.floor(i / m.w)
  const t = m.tiles[i]!
  const k = TILE_INFO[t]
  if (k.solid || k.pit || k.hurt || t === 'D' || t === '>' || t === 'P' || t === 'C' || isViewBlock(t) || m.scenery?.has(i)) return false
  const z = cellRect(info, cellIndex(info, tx + 0.5, ty + 0.5))
  if (tx <= z.x || ty <= z.y || tx >= z.x + z.w - 1 || ty >= z.y + z.h - 1) return false
  if (info.chests.has(i) || info.gates.some(g => g.tiles.includes(i))) return false
  if (info.warps.some(w => tx >= w.x && tx < w.x + w.w && ty >= w.y && ty < w.y + w.h)) return false
  if (minded && circleOnTile(s.hero.x, s.hero.y, HERO_R, tx, ty)) return false
  if (s.echo && Math.floor(s.echo.x) === tx && Math.floor(s.echo.y) === ty) return false
  if (m.pickups.some(p => tileOfPoint(m, p.x, p.y) === i) || m.drops.some(d => d.kind === 'key' && tileOfPoint(m, d.x, d.y) === i)) return false
  if (m.enemies.some(e => !e.dead && !(landing && STATS[e.kind].flying) && circleOnTile(e.x, e.y, e.r, tx, ty))) return false
  return !m.iron?.flights.some(f => f !== self && f.to === i)
}

/**
 * Where a latch from `from` on the bolt at tile `i` would set the hero down: a tile before it along the line, or a
 * little further back. Null where there is no floor for that.
 */
function boltLanding(world: World, m: MapState, from: Vec, i: number, moved?: Moved): Vec | null {
  const b = mid(m, i)
  const d = Math.hypot(b.x - from.x, b.y - from.y)
  for (let back = MAGNET.land as number; back <= MAGNET.far + 1e-9 && back < d - 0.3; back += 0.25) {
    const x = b.x - ((b.x - from.x) / d) * back
    const y = b.y - ((b.y - from.y) / d) * back
    const at = tileOfPoint(m, x, y)
    const t = m.tiles[at]!
    if (t === 'D' || t === '>' || TILE_INFO[t].pit || moved?.on?.has(at)) continue
    if (moved?.off === at ? true : !TILE_INFO[t].solid && !circleBlocked(world, m, x, y, HERO_R)) return { x, y }
  }
  return null
}

/**
 * May the hero, standing on tile `start`, still get on: on foot, or from bolt to bolt, to a doorway, a stair, a lever
 * or a locked door (they open a way), or a shut trap gate (it opens again)?
 */
function wayOut(world: World, s: GameState, start: number, moved: Moved): boolean {
  const m = s.map
  const info = mapInfo(world, m.id)
  const z = cellRect(info, cellIndex(info, (start % m.w) + 0.5, Math.floor(start / m.w) + 0.5))
  const bolts: number[] = []
  for (let y = z.y; y < z.y + z.h; y++) for (let x = z.x; x < z.x + z.w; x++) if (isBolt(m.tiles[y * m.w + x]!)) bolts.push(y * m.w + x)
  const seen = new Set([start])
  const walk = [start]
  const stood: number[] = []
  const go = (j: number) => { if (!seen.has(j)) { seen.add(j); walk.push(j) } }
  while (walk.length || stood.length) {
    // All that can be walked to first; only then the bolts, from each tile stood on.
    if (!walk.length) {
      const from = mid(m, stood.pop()!)
      for (const b of bolts) {
        const to = mid(m, b)
        const d = Math.hypot(to.x - from.x, to.y - from.y)
        if (d < MAGNET.near || d > MAGNET.reach || !sees(world, m, from, b, true, moved)) continue
        const p = boltLanding(world, m, from, b, moved)
        if (p) go(tileOfPoint(m, p.x, p.y))
      }
      continue
    }
    const at = walk.pop()!
    const x = at % m.w
    const y = Math.floor(at / m.w)
    if (x <= z.x || y <= z.y || x >= z.x + z.w - 1 || y >= z.y + z.h - 1) return true
    if (info.warps.some(w => x >= w.x && x < w.x + w.w && y >= w.y && y < w.y + w.h)) return true
    stood.push(at)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const j = at + dx + dy * m.w
      const next = m.tiles[j]!
      if (next === '}' || next === 'L' || next === 'K' || info.gates.some(g => g.trap && g.tiles.includes(j))) return true
      if (ironOn(m, j, moved)) continue
      if (j === moved.off || (!solidTile(world, m, x + dx, y + dy) && !TILE_INFO[m.tiles[j]!].pit)) go(j)
    }
  }
  return false
}

/** The tiles other flights are on their way to: as good as taken. */
const coming = (s: GameState, self?: IronFlight) => (s.map.iron?.flights ?? []).filter(f => f !== self).map(f => f.to)

/**
 * Would this shut the hero in, where there is a way out now: iron coming to rest on tile `on` (having left `off`), or
 * the hero set down on tile `hero`?
 */
function strands(world: World, s: GameState, then: { on?: number; off?: number; hero?: number }, self?: IronFlight): boolean {
  const here = tileOfPoint(s.map, s.hero.x, s.hero.y)
  const others = coming(s, self)
  const after: Moved = { on: new Set(then.on === undefined ? others : [...others, then.on]), off: then.off }
  return !wayOut(world, s, then.hero ?? here, after) && wayOut(world, s, here, { on: new Set(others) })
}

/** May a piece come to rest on tile `i`: free for it, and nobody shut in by it. `off`: the tile it would leave. */
const rests = (world: World, s: GameState, i: number, self?: IronFlight, landing = false, off?: number, minded = true) =>
  free(world, s, i, self, landing, minded) && !strands(world, s, { on: i, off }, self)

/**
 * A hero who only leans over a weighed plate (`θ`) from the tile before it is stepped back off it for a crate to come
 * to rest there: where he is set, or null (not leaning on such a tile, or no room behind him). Without this a pull
 * from the far third of that tile leaves the crate one tile short.
 */
function leanBack(world: World, s: GameState, i: number): Vec | null {
  const m = s.map
  const h = s.hero
  const tx = i % m.w
  const ty = Math.floor(i / m.w)
  if (m.tiles[i] !== 'θ' || i === tileOfPoint(m, h.x, h.y) || !circleOnTile(h.x, h.y, HERO_R, tx, ty)) return null
  const off = HERO_R + 0.001
  const x = h.x < tx ? Math.min(h.x, tx - off) : h.x > tx + 1 ? Math.max(h.x, tx + 1 + off) : h.x
  const y = h.y < ty ? Math.min(h.y, ty - off) : h.y > ty + 1 ? Math.max(h.y, ty + 1 + off) : h.y
  return circleBlocked(world, m, x, y, HERO_R) ? null : { x, y }
}

/** Where loose iron from tile `from` would come down: the last free tile of its line to the hero, short of any iron. */
function looseLanding(world: World, s: GameState, from: number): number | null {
  const m = s.map
  const a = mid(m, from)
  const hero = tileOfPoint(m, s.hero.x, s.hero.y)
  const b = mid(m, hero)
  let best: number | null = null
  for (const i of line(m, a.x, a.y, b.x, b.y)) {
    if (i === from) continue
    if (i === hero || isIron(m.tiles[i]!)) break
    if (rests(world, s, i, undefined, false, from) || (leanBack(world, s, i) && rests(world, s, i, undefined, false, from, false))) best = i
  }
  return best
}

/** Where the cart on tile `from` would roll to: along its rail to the tile level with the hero, as far as it is free. */
function cartLanding(world: World, s: GameState, from: number): number | null {
  const m = s.map
  const rail = mapInfo(world, m.id).rails.find(r => r.tiles.includes(from))
  if (!rail) return null
  const first = rail.tiles[0]!
  const along = rail.dir === 'right' ? Math.floor(s.hero.x) - (first % m.w) : Math.floor(s.hero.y) - Math.floor(first / m.w)
  const goal = Math.max(0, Math.min(rail.tiles.length - 1, along))
  const start = rail.tiles.indexOf(from)
  let k = start
  while (k !== goal && free(world, s, rail.tiles[k + Math.sign(goal - k)]!)) k += Math.sign(goal - k)
  // (Back from there to the first tile it may stop on.)
  while (k !== start && !rests(world, s, rail.tiles[k]!, undefined, false, from)) k += Math.sign(start - k)
  return k === start ? null : rail.tiles[k]!
}

/** Where a pulled PHI would come down: a tile before the hero on its line, or the first spot further out it fits. */
function phiLanding(world: World, s: GameState, e: Enemy): Vec | null {
  const h = s.hero
  const d = Math.hypot(e.x - h.x, e.y - h.y)
  for (let out = MAGNET.land as number; out < d; out += 0.25) {
    const x = h.x + ((e.x - h.x) / d) * out
    const y = h.y + ((e.y - h.y) / d) * out
    if (!circleBlocked(world, s.map, x, y, e.r, 'enemy')) return { x, y }
  }
  return null
}

/**
 * What a tap along `aim` (rad) would take: the nearest metal in the cone that has a clear line and somewhere to go, and
 * where it ends up. Metal that cannot move is passed over for the next nearest. Null when none can (the tap fizzles).
 */
export function magnetPlan(world: World, s: GameState, aim: number): MagnetPlan | null {
  const m = s.map
  const h = s.hero
  const info = mapInfo(world, m.id)
  const z = cellRect(info, cellIndex(info, h.x, h.y))
  const found: { idx: number; gold: Enemy | null; d: number; off: number }[] = []
  for (let ty = z.y; ty < z.y + z.h; ty++) {
    for (let tx = z.x; tx < z.x + z.w; tx++) {
      const i = ty * m.w + tx
      const t = m.tiles[i]!
      if (!isIron(t) && !isBolt(t)) continue
      const d = Math.hypot(tx + 0.5 - h.x, ty + 0.5 - h.y)
      if (d < MAGNET.near - 1e-9 || d > MAGNET.reach + 1e-9) continue
      const off = angleDiff(Math.atan2(ty + 0.5 - h.y, tx + 0.5 - h.x), aim)
      if (off > MAGNET.cone + 1e-9) continue
      if (sees(world, m, h, i, !isLoose(t))) found.push({ idx: i, gold: null, d, off })
    }
  }
  // Gold is metal: a PHI on a line clear of walls and iron.
  for (const e of m.enemies) {
    if (e.kind !== 'phi' || e.dead || e.ai.mode === 'pulled' || e.cell !== s.zoneIndex) continue
    const d = Math.hypot(e.x - h.x, e.y - h.y)
    if (d < MAGNET.near - 1e-9 || d > MAGNET.reach + 1e-9) continue
    const off = angleDiff(Math.atan2(e.y - h.y, e.x - h.x), aim)
    if (off > MAGNET.cone + 1e-9) continue
    if (!line(m, h.x, h.y, e.x, e.y).every(i => !solidTile(world, m, i % m.w, Math.floor(i / m.w), 'shot') && !isIron(m.tiles[i]!))) continue
    found.push({ idx: -1, gold: e, d, off })
  }
  // Nearest first, then the truest to the aim.
  found.sort((a, b) => (Math.abs(a.d - b.d) > 1e-6 ? a.d - b.d : a.off - b.off))
  for (const c of found) {
    if (c.gold) {
      const to = phiLanding(world, s, c.gold)
      if (to) return { t: 'phi', id: c.gold.id, x: c.gold.x, y: c.gold.y, to }
      continue
    }
    const t = m.tiles[c.idx]!
    const at = mid(m, c.idx)
    if (isBolt(t)) {
      const to = boltLanding(world, m, h, c.idx)
      if (to && !strands(world, s, { hero: tileOfPoint(m, to.x, to.y) })) return { t: 'bolt', idx: c.idx, ...at, to }
      continue
    }
    const to = isRailed(t) ? cartLanding(world, s, c.idx) : looseLanding(world, s, c.idx)
    if (to !== null) return { t: isRailed(t) ? 'cart' : 'loose', idx: c.idx, ...at, to }
  }
  return null
}

/** What B would take this moment, for the bracket: null unless the Magnet is in hand and the hero is free to use it. */
export function magnetPreview(world: World, s: GameState): MagnetPlan | null {
  const h = s.hero
  if (s.inv.selected !== 'magnet' || s.mode !== 'play' || s.hook || h.carry || h.act === 'fall' || h.act === 'dead') return null
  // (No bracket while the long rest runs: there is nothing a tap would take.)
  if (magnetRest(s) < 1) return null
  return magnetPlan(world, s, h.act === 'walk' || h.act === 'push' ? aimOf(h) : dirAngle(h.dir))
}

/**
 * 0 to 1 as a long rest runs out (after a PHI), 1 whenever B is ready, as far as the eye is told: the short rests
 * after iron and a fizzle are over before a bar could say anything.
 */
export function magnetRest(s: GameState): number {
  const st = s.map.iron
  return st && st.rest > 0 && (st.of ?? 0) > MAGNET.rest ? 1 - st.rest / st.of! : 1
}

/** B with the Magnet in hand: a tap. */
export function useMagnet(c: Ctx, inp: Input) {
  const s = c.s
  const m = s.map
  const h = s.hero
  const st = iron(m)
  if (st.rest > 0 || s.hook) return
  const aim = Math.hypot(inp.move.x, inp.move.y) > 0.08 ? Math.atan2(inp.move.y, inp.move.x) : dirAngle(h.dir)
  const plan = magnetPlan(c.w, s, aim)
  h.act = 'use'
  h.actT = 0
  if (!plan) {
    st.rest = st.of = MAGNET.fizzle
    c.ev.push({ type: 'fizzle', x: h.x + Math.cos(aim) * 0.5, y: h.y + Math.sin(aim) * 0.5 })
    return
  }
  st.rest = st.of = plan.t === 'phi' ? MAGNET.phiRest : MAGNET.rest
  c.ev.push({ type: 'latch', x: plan.x, y: plan.y })
  if (plan.t === 'bolt') {
    const d = Math.hypot(plan.x - h.x, plan.y - h.y)
    s.hook = { x: plan.x, y: plan.y, dx: (plan.x - h.x) / d, dy: (plan.y - h.y) / d, dist: 0, phase: 'pull', to: plan.to, hit: [], carrying: [], magnet: true }
    h.act = 'hook'
    h.charge = -1
    h.vx = 0
    h.vy = 0
    // (From the first instant: the foes step before the pull does.)
    h.invuln = Math.max(h.invuln, 0.05)
    return
  }
  if (plan.t === 'phi') {
    // On the line: whatever it was about is over (`heapFoes.ts` flies it in).
    const e = m.enemies.find(o => o.id === plan.id)!
    Object.assign(e.ai, { mode: 'pulled', tell: 0, tx: plan.to.x, ty: plan.to.y, speed: MAGNET.loose })
    e.stun = 0
    e.stagger = 0
    e.knock = null
    return
  }
  // (Leaning over the plate it is bound for, he steps back off it.)
  const back = plan.t === 'loose' ? leanBack(c.w, s, plan.to) : null
  if (back) { h.x = back.x; h.y = back.y }
  const ch = m.tiles[plan.idx]!
  st.flights.push({ ch, x: plan.x, y: plan.y, from: plan.idx, to: plan.to, home: st.away[plan.idx] ?? plan.idx })
  delete st.away[plan.idx]
  m.tiles[plan.idx] = under(c.info, plan.idx)
  m.version++
}

/** The tiles a flight may still come down on, nearest its goal first: back along its way to where it left. */
function fallbacks(c: Ctx, f: IronFlight): number[] {
  const m = c.s.map
  if (isRailed(f.ch)) {
    const rail = c.info.rails.find(r => r.tiles.includes(f.from))
    if (!rail) return [f.to, f.from]
    const a = rail.tiles.indexOf(f.to)
    const b = rail.tiles.indexOf(f.from)
    return Array.from({ length: Math.abs(a - b) + 1 }, (_, k) => rail.tiles[a + Math.sign(b - a) * k]!)
  }
  const a = mid(m, f.from)
  const b = mid(m, f.to)
  return line(m, a.x, a.y, b.x, b.y).reverse()
}

/** Iron comes to rest on tile `i`. */
function rest(c: Ctx, f: IronFlight, i: number) {
  const m = c.s.map
  const st = iron(m)
  m.tiles[i] = f.ch
  m.version++
  if (i !== f.home) st.away[i] = f.home
  st.flights.splice(st.flights.indexOf(f), 1)
  c.ev.push({ type: 'iron', ...mid(m, i) })
}

export function stepMagnet(c: Ctx, dt: number) {
  const m = c.s.map
  const st = m.iron
  if (!st) return
  if (st.rest > 0) st.rest = Math.max(0, st.rest - dt)
  for (const f of [...st.flights]) {
    if (f.golem === 'pull') continue
    const cart = isRailed(f.ch)
    const goal = mid(m, f.to)
    const dx = goal.x - f.x
    const dy = goal.y - f.y
    const len = Math.hypot(dx, dy)
    const sp = (cart ? MAGNET.cart : MAGNET.loose) * dt
    if (len > sp) {
      const x = f.x + (dx / len) * sp
      const y = f.y + (dy / len) * sp
      // A cart does not roll through whatever has stepped onto its rail: it stops where it is. (But for one the
      // Golem spits back, which passes under it and comes to rest at the rail's end.)
      const now = tileOfPoint(m, f.x, f.y)
      const next = tileOfPoint(m, x, y)
      if (cart && !f.golem && next !== now && next !== f.from && !free(c.w, c.s, next, f, true)) { f.to = now; continue }
      f.x = x
      f.y = y
      continue
    }
    f.x = goal.x
    f.y = goal.y
    // Never onto anyone: short of its goal then, or (nowhere free) it hangs there until there is room.
    const spot = fallbacks(c, f).find(i => !isIron(m.tiles[i]!) && rests(c.w, c.s, i, f, true))
    if (spot === undefined) continue
    if (spot === f.to) rest(c, f, spot)
    else f.to = spot
  }
  for (let k = st.smashed.length - 1; k >= 0; k--) {
    const p = st.smashed[k]!
    p.t -= dt
    const home = c.info.base[p.home]!
    if (p.t > 0 || m.tiles[p.home] !== under(c.info, p.home) || !rests(c.w, c.s, p.home, undefined, true)) continue
    m.tiles[p.home] = home
    m.version++
    st.smashed.splice(k, 1)
    c.ev.push({ type: 'iron', ...mid(m, p.home) })
  }
}

/** The resting iron on tile `i`, taken off the map: what it was and its home tile. Null: no iron there. */
export function takeIron(c: Ctx, i: number): { ch: TileChar; home: number } | null {
  const m = c.s.map
  const ch = m.tiles[i]!
  if (!isIron(ch)) return null
  const st = iron(m)
  const home = st.away[i] ?? i
  delete st.away[i]
  m.tiles[i] = under(c.info, i)
  m.version++
  return { ch, home }
}

/** The resting iron on tile `i` is smashed: gone, and home again after `MAGNET.mend` s. False: no iron there. */
export function smashIron(c: Ctx, i: number): boolean {
  const taken = takeIron(c, i)
  if (!taken) return false
  iron(c.s.map).smashed.push({ home: taken.home, t: MAGNET.mend })
  return true
}

/** Entering a room: its iron goes home at once, whatever flew, lay elsewhere or was smashed. */
export function homeIron(c: Ctx, cell: number) {
  const m = c.s.map
  const z = cellRect(c.info, cell)
  const inRoom = (i: number) => cellIndex(c.info, (i % m.w) + 0.5, Math.floor(i / m.w) + 0.5) === cell
  for (let y = z.y; y < z.y + z.h; y++) {
    for (let x = z.x; x < z.x + z.w; x++) {
      const i = y * m.w + x
      const want = c.info.base[i]!
      if (m.tiles[i] === want || (!isIron(m.tiles[i]!) && !isIron(want))) continue
      m.tiles[i] = want
      m.version++
    }
  }
  const st = m.iron
  if (!st) return
  st.flights = st.flights.filter(f => !inRoom(f.home))
  st.smashed = st.smashed.filter(p => !inRoom(p.home))
  for (const i of Object.keys(st.away).map(Number)) if (inRoom(i)) delete st.away[i]
}
