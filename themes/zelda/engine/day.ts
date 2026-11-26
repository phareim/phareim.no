/**
 * Day and night, once the Sun Prism is home.
 *
 * Before the prism the sun hangs on the horizon: `GameState.daytime` is null
 * and nothing here runs. Taking it starts a 12-minute day at the dusk the
 * world was stuck in (0), so the first thing the sun does is set:
 *
 *   0 dusk · 100 blue hour · 170–290 night · 360 blue morning · 420 dawn ·
 *   480 morning · 520–640 noon · 690 afternoon · 720 dusk again
 *
 * Most of the day is dusk and dawn; night and noon are two minutes each.
 *
 * The woods follow the clock (`foeLevel`): at dusk and dawn they hold the foes
 * that were placed in them, at midnight twice as many (each placed foe gets a
 * night twin near it), and for the two noon minutes none. Foes come and go
 * one at a time, each at its own point on the level (`rank`), and never in
 * sight: a foe whose home is on screen walks in from beyond the screen's
 * edge, and one that leaves in view walks out of it. Only outdoor maps, and
 * only foes the map placed (never one that carries a key or is killed once),
 * so the town and every dungeon are as they were.
 *
 * Pure engine: no randomness is drawn (ranks, twins and the ways in come from
 * hashes of where things stand), so seeded runs stay the same.
 */
import type { Enemy, EnemyKind, GameState, MapState, Vec, World } from '../types'
import { circleBlocked, mapInfo, moveCircle } from './map'
import { STATS, spawnEnemy } from './spawn'

/** Seconds in a whole day. */
export const DAY_LENGTH = 720

/** Where the day stands at its marks, seconds after the prism. */
export const DAY = {
  dusk: 0, blueEve: 100, night: 170, midnight: 230, nightEnd: 290, blueMorn: 360,
  dawn: 420, morning: 480, noon: 520, noonEnd: 640, afternoon: 690,
} as const

/** The hours a look can be held at (the studio's `daytime` value): seconds into the day. */
export const HOURS = { dusk: 0, night: 230, dawn: 430, noon: 580 } as const

/** How many foes the woods hold at `t`: 0 at noon, 1 at dusk and dawn, 2 at midnight. */
const LEVEL: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [DAY.blueEve, 1], [DAY.night, 2], [DAY.nightEnd, 2], [380, 1], [460, 1], [DAY.noon, 0], [DAY.noonEnd, 0], [DAY_LENGTH, 1],
]

export function foeLevel(t: number | null): number {
  if (t === null) return 1
  const x = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH
  for (let i = 1; i < LEVEL.length; i++) {
    const [b, vb] = LEVEL[i]!
    const [a, va] = LEVEL[i - 1]!
    if (x <= b) return va + (vb - va) * ((x - a) / (b - a || 1))
  }
  return 1
}

/** A foe that walks the woods by the clock: no bosses, nothing nailed down. */
const ROAMS: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['blob', 'spitter', 'bat', 'dasher', 'zapper', 'skull', 'hound', 'drone', 'sentry'])
/** Which of them get a night twin (a sentry stands where it was put). */
const TWINS: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['blob', 'spitter', 'bat', 'dasher', 'zapper', 'skull', 'hound', 'drone'])

/** How fast a foe walks in or out, tiles a second. */
const TREK_SPEED = 2.4
/** A foe walking in turns to fight when the hero comes this close. */
const TREK_NOTICE = 3.5
/** Past the screen's edge, tiles, where a foe starts walking in and stops walking out. */
const MARGIN = 1.5
/** What the screen shows when the shell has not said: the classic view's least. */
const SIGHT: NonNullable<GameState['sight']> = { x: 13, y: 11 }

function hash(a: number, b: number, salt: number): number {
  let h = Math.imul(Math.floor(a * 16) ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(Math.floor(b * 16) + salt, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296
}

/** Is the day running here: the prism taken, and a map under the open sky. */
export function dayHere(world: World, s: GameState): boolean {
  return s.daytime !== null && !s.demo && mapInfo(world, s.map.id).def.kind === 'overworld'
}

/**
 * Is (x, y) on the screen, grown by `grow` tiles? The classic view shows a
 * rectangle of the ground round its camera (clamped to the map, as
 * `cameraFor` does); the turned 16-bit view a diamond round the hero, the
 * ground turned 45° and tipped back to half its height
 * (`render/iso/project.ts`): |dx − dy| < w/2 across, |dx + dy| < h down.
 */
function onScreen(s: GameState, x: number, y: number, grow: number): boolean {
  const m = s.map
  const v = s.sight ?? SIGHT
  if (v.turned) {
    const dx = x - s.hero.x
    const dy = y - s.hero.y
    // What stands up just past the bottom edge still reaches into the picture: a little more there.
    const down = dx + dy
    return Math.abs(dx - dy) < v.x / 2 + grow * 1.5 && down > -v.y - grow * 1.5 && down < v.y + grow * 1.5 + 1.5
  }
  const cx = v.x >= m.w ? m.w / 2 : Math.max(v.x / 2, Math.min(m.w - v.x / 2, s.hero.x))
  const cy = v.y >= m.h ? m.h / 2 : Math.max(v.y / 2, Math.min(m.h - v.y / 2, s.hero.y))
  return Math.abs(x - cx) < v.x / 2 + grow && Math.abs(y - cy) < v.y / 2 + grow
}

function inSight(s: GameState, x: number, y: number, grow = 0.6): boolean {
  return onScreen(s, x, y, grow)
}

const flies = (e: Enemy) => !!STATS[e.kind].flying

/**
 * Where a foe at (x, y) can walk to, in a straight line, and be off the
 * screen: the nearest such point, leaning away from the hero. Null when every
 * way out is walled in.
 */
export function wayOut(world: World, s: GameState, e: Enemy, x: number, y: number): Vec | null {
  const m = s.map
  const mode = flies(e) ? 'fly' : 'enemy'
  const hx = x - s.hero.x
  const hy = y - s.hero.y
  const hd = Math.hypot(hx, hy) || 1
  let best: Vec | null = null
  let bestScore = Infinity
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + hash(x, y, 7) * 0.3
    const ux = Math.cos(a)
    const uy = Math.sin(a)
    // Never out past the hero.
    const away = (ux * hx + uy * hy) / hd
    if (away < -0.2) continue
    let d = 0
    let ok = false
    while (d < 48) {
      d += 0.5
      const px = x + ux * d
      const py = y + uy * d
      if (px < e.r || py < e.r || px > m.w - e.r || py > m.h - e.r) break
      if (circleBlocked(world, m, px, py, e.r, mode)) break
      if (!onScreen(s, px, py, MARGIN)) { ok = true; break }
    }
    if (!ok) continue
    const score = d - away * 3
    if (score < bestScore) { bestScore = score; best = { x: x + ux * d, y: y + uy * d } }
  }
  return best
}

/** Gone for now: out of the world until the clock calls it back. */
function goAway(e: Enemy) {
  e.away = true
  e.dead = true
  e.trek = undefined
  e.knock = null
}

/** Back at full health, standing at (x, y). */
function freshAt(e: Enemy, x: number, y: number) {
  const st = STATS[e.kind]
  e.x = x
  e.y = y
  e.hp = e.tough ? e.maxHp : st.hp
  e.dead = false
  e.away = false
  e.invuln = 0
  e.stun = 0
  e.knock = null
  e.flash = 0
  e.trek = undefined
  e.ai = { ...e.ai, mode: 'idle', t: 0.4, tell: 0 }
}

/** Walked in: its own brain from here. */
function arrived(e: Enemy) {
  e.trek = undefined
  e.ai.mode = 'idle'
  e.ai.t = 0.3
}

/** A free spot for a twin, a tile or two from `home`, or null. */
function twinSpot(world: World, m: MapState, e: Enemy, i: number): Vec | null {
  const mode = flies(e) ? 'fly' : 'enemy'
  for (let k = 0; k < 10; k++) {
    const a = hash(e.home.x, e.home.y, 31 + k + i * 13) * Math.PI * 2
    const d = 1.2 + hash(e.home.x, e.home.y, 47 + k) * 1.6
    const x = Math.floor(e.home.x + Math.cos(a) * d) + 0.5
    const y = Math.floor(e.home.y + Math.sin(a) * d) + 0.5
    if (x < 1 || y < 1 || x > m.w - 1 || y > m.h - 1) continue
    if (!circleBlocked(world, m, x, y, e.r, mode)) return { x, y }
  }
  return null
}

/**
 * The map's foes put where the clock wants them, at once (entering a map,
 * coming back from death, a time set by hand): placed foes get their ranks,
 * each gets its night twin, and whoever is not wanted now is away.
 */
export function settleFoes(world: World, s: GameState) {
  if (!dayHere(world, s)) return
  const m = s.map
  if (!m.enemies.some(e => e.rank !== undefined)) {
    const twins: Enemy[] = []
    let i = 0
    for (const e of m.enemies) {
      // A tough one holds its ground all day and all night, and has no twin.
      if (!ROAMS.has(e.kind) || e.once || e.carries || e.tough || e.id.includes(':night')) continue
      e.rank = 0.15 + hash(e.home.x, e.home.y, 3) * 0.8
      if (!TWINS.has(e.kind)) continue
      const at = twinSpot(world, m, e, i++)
      if (!at) continue
      const t = spawnEnemy(`${e.id}:night`, e.kind, at.x, at.y, e.dir, e.cell)
      t.rank = 1.1 + hash(at.x, at.y, 5) * 0.8
      twins.push(t)
    }
    m.enemies.push(...twins)
  }
  const level = foeLevel(s.daytime)
  for (const e of m.enemies) {
    if (e.rank === undefined) continue
    if (level >= e.rank) { if (e.away) freshAt(e, e.home.x, e.home.y) }
    else goAway(e)
  }
}

/** The clock's hand on the woods, every step: who walks in, who walks out. */
export function stepFoes(world: World, s: GameState) {
  if (!dayHere(world, s)) return
  const m = s.map
  const level = foeLevel(s.daytime)
  for (const e of m.enemies) {
    if (e.rank === undefined) continue
    const want = level >= e.rank
    if (want && e.away) {
      // Called back: out of sight it is simply home; in sight it walks in from past the edge.
      if (!inSight(s, e.home.x, e.home.y, MARGIN)) { freshAt(e, e.home.x, e.home.y); continue }
      const from = wayOut(world, s, e, e.home.x, e.home.y)
      if (!from) continue
      freshAt(e, from.x, from.y)
      e.trek = { x: e.home.x, y: e.home.y, out: false, stuck: 0 }
    } else if (!want && !e.away) {
      if (e.trek?.out) continue
      if (e.dead || !inSight(s, e.x, e.y)) { goAway(e); continue }
      const to = wayOut(world, s, e, e.x, e.y)
      // Walled in where the hero can see it: it waits until it is not.
      if (!to) continue
      e.trek = { x: to.x, y: to.y, out: true, stuck: 0 }
    } else if (want && e.trek?.out) {
      // Called back on its way out: it turns round.
      e.trek = { x: e.home.x, y: e.home.y, out: false, stuck: 0 }
    }
  }
}

/** One step of a foe walking in or out. False when it has arrived (or gone) and its own brain takes over. */
export function stepTrek(world: World, s: GameState, e: Enemy, dt: number): boolean {
  const tr = e.trek
  if (!tr) return false
  const h = s.hero
  if (!tr.out && Math.hypot(h.x - e.x, h.y - e.y) < TREK_NOTICE) { arrived(e); return false }
  const dx = tr.x - e.x
  const dy = tr.y - e.y
  const d = Math.hypot(dx, dy)
  if (d < 0.25) {
    if (tr.out) goAway(e)
    else arrived(e)
    return false
  }
  const v = Math.min(TREK_SPEED, d / dt)
  const r = moveCircle(world, s.map, e.x, e.y, e.r, (dx / d) * v * dt, (dy / d) * v * dt, flies(e) ? 'fly' : 'enemy')
  e.x = r.x
  e.y = r.y
  e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
  e.ai.mode = 'walk'
  if (r.hitX || r.hitY) tr.stuck += dt
  // A leaver is gone the moment nobody sees it.
  if (tr.out && !inSight(s, e.x, e.y)) { goAway(e); return false }
  // Something stands in the way of an arrival: it stops where it is.
  if (tr.stuck > 1.5 && !tr.out) { arrived(e); return false }
  // A leaver that is stuck looks for another way next step.
  if (tr.stuck > 1.5) { e.trek = undefined; return false }
  return true
}

/** Set the hour by hand (the shell's `?daytime=`, the lab): the woods settle at once. Null: the stuck dusk again. */
export function setDaytime(world: World, s: GameState, t: number | null) {
  s.daytime = t === null ? null : ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH
  const m = s.map
  if (s.daytime === null) {
    m.enemies = m.enemies.filter(e => !e.id.endsWith(':night'))
    for (const e of m.enemies) {
      if (e.rank === undefined) continue
      if (e.away) freshAt(e, e.home.x, e.home.y)
      e.rank = undefined
    }
    return
  }
  // The dead come back if the new hour wants them.
  for (const e of m.enemies) if (e.rank !== undefined && e.dead) e.away = true
  settleFoes(world, s)
}
