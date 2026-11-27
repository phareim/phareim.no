/**
 * THE SCRAPE GOLEM (`EnemyKind` 'golem', the Heap's boss; docs/games/neon-shrine-heap.md). It never leaves the middle
 * of its room. It pulls: a pink ring shows how far, then everything loose inside the ring slides to it, and the hero is
 * dragged. What it eats it keeps (scrap and crates heal it; none comes back until the room is entered again), and after
 * a pull it spits a piece down a painted lane (a bomb it swallowed comes back too, fuse lit). A striped cart standing
 * inside the ring when a pull opens is swallowed instead, and the heap CHOKES: open to the blade, `take` hit points at
 * most. The Magnet sends the carts in along their rails. Half beaten, it grows: a wider ring, two pulls a round.
 *
 * The rounds, in `e.ai.mode`: `rest`, `tell`, `pull` (twice, grown: `ai.second`), `spit`; or `choke`, and `grow` once.
 * Its blows on the hero are the body's touch (`enemies.ts` `contact`, but not while it chokes or grows), the spat
 * piece and its blast. It spits after every pull that did not choke it, eaten or not: else a hero standing outside the
 * ring would be safe for ever once the four scraps were gone.
 */
import type { Bomb, Enemy, GameState, IronFlight, TileChar, Vec } from '../types'
import { BOMB_FUSE, BOMB_RADIUS, HERO_R } from '../types'
import { isLoose } from '../world/tiles'
import { type Ctx, type HitSource, hurtHero } from './combat'
import { takeIron } from './magnet'
import { cellRect, has, moveCircle, setFlag, solidTile } from './map'
import type { Stencil } from './stencils'
import { nextId } from './util'

/** The fight's numbers. Pairs are [as it comes, grown]; distances are tiles, times seconds. */
export const GOLEM = {
  /** Its body, and how far a pull reaches. */
  r: [1.2, 1.6],
  ring: [3.8, 4.8],
  /** A round: the rest, the tell, the pull; grown, a second tell and the same pull again. */
  rest: [1.6, 1.0],
  tell: [0.8, 0.7],
  pull: [2.2, 2.4],
  tell2: 0.6,
  /** Tiles a second: what is loose, and the hero (who walks at 5.4). */
  slide: 4,
  drag: [2.2, 3],
  /** The share of its body's radius at which a thing sliding in is swallowed. */
  mouth: 0.75,
  /** Hit points a swallowed scrap or crate gives it. */
  heal: 1,
  /** The spit: its tell, its flight, its harm, and its lane's width (what is hit is what is painted). */
  spitTell: 0.7,
  spit: 8,
  spitDmg: 2,
  lane: 1,
  /** A swallowed bomb comes back with this much fuse. */
  fuse: 1.2,
  /** A choke: how long, how long the blade still clanks, the most it takes, and when the cart rolls back out. */
  choke: 4.5,
  clank: 0.3,
  take: 6,
  cartBack: 1,
  /** Growing (it swells at the half), and falling (`render/golemPaint.ts`; then the room says its line). */
  grow: 1.4,
  fall: 1.2,
  /** Where the room is wider than the screen, the camera leans this share of the way to it, this many tiles at most. */
  lean: 0.5,
  leanMost: 3,
} as const

const num = (e: Enemy, k: string) => (e.ai[k] as number | undefined) ?? 0
/** 0 as it comes, 1 grown. */
export const golemSize = (e: Enemy): 0 | 1 => (e.ai.phase === 2 ? 1 : 0)
/** Choking and growing, its touch does no harm. */
export const golemHarmless = (e: Enemy) => e.ai.mode === 'choke' || e.ai.mode === 'grow'
/** Open to the blade: choking, with this choke's blows not yet all given. */
export const golemOpen = (e: Enemy) => !e.dead && e.ai.mode === 'choke' && num(e, 'took') < GOLEM.take

/** `bossRules`: the most a blow of `src` may take now; 0: it clanks. Only the blade, only in a choke that has caught. */
export function golemCap(e: Enemy, src: HitSource): number {
  const blade = src === 'sword' || src === 'spin' || src === 'echo'
  if (!blade || e.ai.mode !== 'choke' || e.ai.t > GOLEM.choke - GOLEM.clank) return 0
  return Math.max(0, GOLEM.take - num(e, 'took'))
}

const tileMid = (c: Ctx, i: number): Vec => ({ x: (i % c.s.map.w) + 0.5, y: Math.floor(i / c.s.map.w) + 0.5 })
const flights = (c: Ctx) => (c.s.map.iron ??= { flights: [], away: {}, smashed: [], rest: 0 }).flights

/** The tiles of its room that hold iron of a kind, their middles inside the ring. */
function inRing(c: Ctx, e: Enemy, want: (t: TileChar) => boolean): number[] {
  const m = c.s.map
  const z = cellRect(c.info, e.cell)
  const out: number[] = []
  for (let y = z.y; y < z.y + z.h; y++) {
    for (let x = z.x; x < z.x + z.w; x++) {
      const i = y * m.w + x
      if (want(m.tiles[i]!) && Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y) <= GOLEM.ring[golemSize(e)]) out.push(i)
    }
  }
  return out
}

/** What was sliding in drops where it is: the Magnet's step lays it on the nearest free tile of its way (`magnet.ts`). */
function drop(c: Ctx) {
  for (const f of flights(c)) {
    if (f.golem !== 'pull') continue
    delete f.golem
    f.to = Math.floor(f.y) * c.s.map.w + Math.floor(f.x)
  }
}

/** The swallowed carts roll out again, to their rails' outer ends, under whoever stands on the way. */
function cartsBack(c: Ctx, e: Enemy) {
  const list = String(e.ai.carts ?? '')
  if (!list) return
  e.ai.carts = ''
  for (const i of list.split(',').map(Number)) {
    const rail = c.info.rails.find(r => r.tiles.includes(i))
    if (!rail) continue
    const far = (t: number) => Math.hypot(tileMid(c, t).x - e.x, tileMid(c, t).y - e.y)
    const [a, b] = [rail.tiles[0]!, rail.tiles[rail.tiles.length - 1]!]
    const out = far(a) > far(b) ? a : b
    flights(c).push({ ch: '▥', ...tileMid(c, i), from: out, to: out, home: out, golem: 'back' })
  }
}

/**
 * What the camera looks at (`cameraFor`, the isometric view): `at`, leaning toward the Golem while it is in the room,
 * so that on a phone the heap, its ring and its lane are in the picture from either pad. A screen that holds the whole
 * room does not move. It eases in as the fight starts and back out after the fall.
 */
export function golemFocus(s: GameState, at: Vec): Vec {
  const e = s.scroll ? undefined : s.map.enemies.find(o => o.kind === 'golem' && o.cell === s.zoneIndex)
  if (!e) return at
  const k = num(e, 'lean') * (e.dead ? 1 - Math.min(1, e.deathT ?? 1) : 1)
  const dx = (e.x - at.x) * GOLEM.lean
  const dy = (e.y - at.y) * GOLEM.lean
  const f = k * Math.min(1, GOLEM.leanMost / (Math.hypot(dx, dy) || 1))
  return { x: at.x + dx * f, y: at.y + dy * f }
}

function mode(e: Enemy, name: string, t: number) {
  e.ai.mode = name
  e.ai.t = t
}

/** A pull opens: with a cart in the ring it is a choke at once, and nothing is eaten. */
function openPull(c: Ctx, e: Enemy) {
  const carts = inRing(c, e, t => t === '▥')
  if (!carts.length) { mode(e, 'pull', GOLEM.pull[golemSize(e)]); return }
  for (const i of carts) takeIron(c, i)
  e.ai.carts = carts.join(',')
  e.ai.took = 0
  e.ai.bombs = 0
  e.ai.second = false
  mode(e, 'choke', GOLEM.choke)
  c.s.shake = Math.max(c.s.shake, 0.35)
  c.ev.push({ type: 'clank', x: e.x, y: e.y })
  c.ev.push({ type: 'hitStop', ms: 90 })
}

/** One step of a pull: the loose iron, the bombs, the thrown things and the hero, all toward the middle. */
function pull(c: Ctx, e: Enemy, dt: number) {
  const s = c.s
  const m = s.map
  const h = s.hero
  const ring = GOLEM.ring[golemSize(e)]
  const mouth = e.r * GOLEM.mouth
  const away = (p: Vec) => Math.hypot(p.x - e.x, p.y - e.y)
  /** `p` a step nearer the middle; true once it is in the mouth. */
  const slide = (p: Vec) => {
    const d = away(p)
    const step = Math.min(GOLEM.slide * dt, d)
    if (d > 0) { p.x += ((e.x - p.x) / d) * step; p.y += ((e.y - p.y) / d) * step }
    return away(p) <= mouth
  }
  const seat = Math.floor(e.y) * m.w + Math.floor(e.x)
  for (const i of inRing(c, e, isLoose)) {
    const at = tileMid(c, i)
    const taken = takeIron(c, i)!
    flights(c).push({ ch: taken.ch, ...at, from: i, to: seat, home: taken.home, golem: 'pull' })
  }
  const list = flights(c)
  for (let k = list.length - 1; k >= 0; k--) {
    const f = list[k] as IronFlight
    if (f.golem !== 'pull' || !slide(f)) continue
    list.splice(k, 1)
    e.hp = Math.min(e.maxHp, e.hp + GOLEM.heal)
    c.ev.push({ type: 'iron', x: f.x, y: f.y })
  }
  for (let k = m.bombs.length - 1; k >= 0; k--) {
    const b = m.bombs[k] as Bomb
    if (b.by === 'golem' || away(b) > ring || !slide(b)) continue
    m.bombs.splice(k, 1)
    e.ai.bombs = num(e, 'bombs') + 1
    c.ev.push({ type: 'iron', x: b.x, y: b.y })
  }
  for (let k = m.thrown.length - 1; k >= 0; k--) {
    const o = m.thrown[k]!
    const d = away(o)
    if (d > ring) continue
    // (Held from coming down of itself while it is drawn in.)
    o.vx = ((e.x - o.x) / (d || 1)) * GOLEM.slide
    o.vy = ((e.y - o.y) / (d || 1)) * GOLEM.slide
    o.dist = 0
    if (d > e.r + 0.45) continue
    m.thrown.splice(k, 1)
    c.ev.push({ type: 'shatter', x: o.x, y: o.y, kind: o.kind })
  }
  // The hero, dragged: not in a roll (it breaks away), in the air or on the Magnet's flight.
  const d = away(h)
  if (d <= ring && d > 0.05 && !h.roll && !h.air && !h.auto && !s.hook && h.act !== 'fall' && h.act !== 'dead' && h.act !== 'get') {
    const step = Math.min(GOLEM.drag[golemSize(e)] * dt, d)
    const r = moveCircle(c.w, m, h.x, h.y, HERO_R, ((e.x - h.x) / d) * step, ((e.y - h.y) / d) * step)
    h.x = r.x
    h.y = r.y
  }
}

/** The way from its middle through (x, y), and where a piece flown along it meets the wall. */
function aim(c: Ctx, e: Enemy, x: number, y: number) {
  const d = Math.hypot(x - e.x, y - e.y)
  const ux = d > 0.01 ? (x - e.x) / d : 0
  const uy = d > 0.01 ? (y - e.y) / d : 1
  let far = 0
  while (far < 24 && !wall(c, e, e.x + ux * (far + 0.1), e.y + uy * (far + 0.1))) far += 0.1
  return { ux, uy, x: e.x + ux * far, y: e.y + uy * far }
}

/** Where a spat piece breaks: anything a shot stops at, or the room's edge (it flies into a doorway: no shelter). */
function wall(c: Ctx, e: Enemy, x: number, y: number): boolean {
  const z = cellRect(c.info, e.cell)
  return x < z.x || y < z.y || x >= z.x + z.w || y >= z.y + z.h || solidTile(c.w, c.s.map, Math.floor(x), Math.floor(y), 'shot')
}

/** The tell of the spit: at the spot the hero stands on now. */
function spitTell(c: Ctx, e: Enemy) {
  const h = c.s.hero
  const end = aim(c, e, h.x, h.y)
  e.ai.tx = h.x
  e.ai.ty = h.y
  e.ai.lx = end.x
  e.ai.ly = end.y
  mode(e, 'spit', GOLEM.spitTell)
}

function spit(c: Ctx, e: Enemy) {
  const ai = e.ai
  const way = aim(c, e, num(e, 'tx'), num(e, 'ty'))
  ai.fly = true
  ai.sx = e.x + way.ux * e.r * GOLEM.mouth
  ai.sy = e.y + way.uy * e.r * GOLEM.mouth
  ai.vx = way.ux * GOLEM.spit
  ai.vy = way.uy * GOLEM.spit
  c.ev.push({ type: 'shoot', x: e.x, y: e.y, kind: 'spit' })
  if (!num(e, 'bombs')) return
  // What it swallowed with a fuse lands on that tile, alight.
  const x = Math.floor(num(e, 'tx')) + 0.5
  const y = Math.floor(num(e, 'ty')) + 0.5
  for (let i = 0; i < num(e, 'bombs'); i++) c.s.map.bombs.push({ id: nextId(c.s), x, y, t: BOMB_FUSE - GOLEM.fuse, by: 'golem' })
  ai.bombs = 0
  ai.bx = x
  ai.by = y
  ai.burn = GOLEM.fuse
}

/** The spat piece and the blast's painted ring, whatever the heap is about. */
function stepSpat(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  if (num(e, 'burn') > 0) ai.burn = Math.max(0, num(e, 'burn') - dt)
  if (!ai.fly) return
  const h = c.s.hero
  const x = num(e, 'sx') + num(e, 'vx') * dt
  const y = num(e, 'sy') + num(e, 'vy') * dt
  ai.sx = x
  ai.sy = y
  const met = Math.hypot(h.x - x, h.y - y) < GOLEM.lane / 2 && hurtHero(c, GOLEM.spitDmg, x - num(e, 'vx') * 0.05, y - num(e, 'vy') * 0.05, false, true)
  if (!met && !wall(c, e, x, y)) return
  ai.fly = false
  c.ev.push({ type: 'shatter', x, y, kind: 'rock' })
}

export function golem(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  // (It never leaves where it was set, `spawn.ts`: nothing shoves it.)
  e.x = e.home.x
  e.y = e.home.y
  e.knock = null
  if (ai.mode === 'idle') {
    ai.phase = 1
    e.r = GOLEM.r[0]
    mode(e, 'rest', GOLEM.rest[0])
  }
  ai.lean = Math.min(1, num(e, 'lean') + dt)
  stepSpat(c, e, dt)
  const size = golemSize(e)
  if (ai.mode === 'rest') {
    if (ai.t <= 0) mode(e, 'tell', GOLEM.tell[size])
  } else if (ai.mode === 'tell') {
    if (ai.t <= 0) openPull(c, e)
  } else if (ai.mode === 'pull') {
    pull(c, e, dt)
    if (ai.t > 0) return
    drop(c)
    if (size && !ai.second) { ai.second = true; mode(e, 'tell', GOLEM.tell2) }
    else { ai.second = false; spitTell(c, e) }
  } else if (ai.mode === 'spit') {
    if (ai.t > 0) return
    spit(c, e)
    mode(e, 'rest', GOLEM.rest[size])
  } else if (ai.mode === 'choke') {
    if (ai.t <= GOLEM.choke - GOLEM.cartBack) cartsBack(c, e)
    if (ai.t > 0) return
    // Half beaten, it grows: at the end of the choke that took it there, never in a pull.
    if (!size && e.hp <= e.maxHp / 2) { ai.swelled = false; mode(e, 'grow', GOLEM.grow) }
    else mode(e, 'rest', GOLEM.rest[size])
  } else if (ai.mode === 'grow') {
    c.s.shake = Math.max(c.s.shake, 0.12)
    if (!ai.swelled && ai.t <= GOLEM.grow / 2) {
      ai.swelled = true
      ai.phase = 2
      e.r = GOLEM.r[1]
      // (Phase 3: the renderer's flash is white for this one, not the pink of a boss turning angry.)
      c.ev.push({ type: 'bossPhase', phase: 3 })
    }
    if (ai.t <= 0) mode(e, 'rest', GOLEM.rest[1])
  }
}

/** It has fallen (`combat.ts` `bossRules`): the carts come out, and nothing of its own is left in the air or alight. */
export function golemFell(c: Ctx, e: Enemy) {
  cartsBack(c, e)
  drop(c)
  e.ai.fly = false
  e.ai.burn = 0
  c.s.map.bombs = c.s.map.bombs.filter(b => b.by !== 'golem')
}

/** Once it has fallen and faded, the room has its line (`world/heap.ts`: the cell's event on this flag). */
export function stepGolemFall(c: Ctx) {
  const s = c.s
  if (!has(s, 'heap.golem') || has(s, 'heap.golem.down')) return
  if (s.map.enemies.some(e => e.kind === 'golem' && e.dead && (e.deathT ?? GOLEM.fall) < GOLEM.fall)) return
  setFlag(s, 'heap.golem.down')
}

/** What it paints on the floor: the pull's ring while it tells and pulls, the spit's lane, a spat bomb's blast. */
export function golemStencils(e: Enemy): Stencil[] {
  const out: Stencil[] = []
  const ai = e.ai
  const size = golemSize(e)
  if (ai.mode === 'tell') out.push({ t: 'ring', x: e.x, y: e.y, r: GOLEM.ring[size], k: 1 - Math.max(0, ai.t) / (ai.second ? GOLEM.tell2 : GOLEM.tell[size]) })
  if (ai.mode === 'pull') out.push({ t: 'ring', x: e.x, y: e.y, r: GOLEM.ring[size], k: 0.5 })
  const lane = (x: number, y: number, k: number) => {
    const x1 = num(e, 'lx')
    const y1 = num(e, 'ly')
    out.push({ t: 'lane', x0: x, y0: y, x1, y1, a: Math.atan2(y1 - y, x1 - x), w: GOLEM.lane, cap: GOLEM.lane / 2, k })
  }
  if (ai.mode === 'spit') {
    const k = 1 - Math.max(0, ai.t) / GOLEM.spitTell
    lane(e.x, e.y, k)
    if (num(e, 'bombs')) out.push({ t: 'ring', x: Math.floor(num(e, 'tx')) + 0.5, y: Math.floor(num(e, 'ty')) + 0.5, r: BOMB_RADIUS + HERO_R - 0.2, k: k * 0.4 })
  }
  if (ai.fly) lane(num(e, 'sx'), num(e, 'sy'), 1)
  if (num(e, 'burn') > 0) out.push({ t: 'ring', x: num(e, 'bx'), y: num(e, 'by'), r: BOMB_RADIUS + HERO_R - 0.2, k: 1 - num(e, 'burn') / GOLEM.fuse })
  return out
}
