/**
 * Space Voyagers: making a world, and the few things every system does to
 * it: emit an event, ask the radio for a cue, take a thing from a pool.
 * Everything in the field lives in a fixed pool made here, so a tick
 * allocates nothing.
 */
import type { CueId, Faction, PickupId, PilotId } from '../story/cues.ts'
import { BOSS_CLEAR, FIELD, PLAYER, PARTNER, ROLES, TALK, TPS, clampHeight, enemyKind } from './balance.ts'
import { makeRng } from './rng.ts'
import type {
  Aim, Barrier, Bolt, Enemy, EventType, GameEvent, Pickup, Rig, RigJob, Role, Shot, World, Zone, ZoneKind,
} from './types.ts'

export const POOL = { enemies: 72, shots: 96, bolts: 96, aims: 10, zones: 40, barriers: 2, pickups: 6, rigs: 5 } as const

export interface WorldOptions {
  seed: number
  /** Field height, 320 to 432 (clamped). */
  height?: number
  /** The pilot the player flies; the other is the partner. */
  pilot?: PilotId
  /** 1 the first voyage, 2 VOYAGE II. */
  voyage?: number
}

function fill<T>(n: number, make: () => T): T[] {
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(make())
  return out
}

const newEnemy = (): Enemy => ({
  active: false, id: 0, role: 'grunt', gang: 'glitterati', kind: '', x: 0, y: 0, px: 0, py: 0, hp: 1, maxHp: 1,
  hw: 9, hh: 9, score: 0, state: 'wait', t: 0, dur: 0, col: -1, row: -1, ax: 0, ay: 0, bx: 0, by: 0, cx: 0, cy: 0,
  ex: 0, ey: 0, vx: 0, vy: 0, fireT: 0, flash: 99, frozen: 0, carrying: false, shield: false, bonus: false, wraps: 0, mode: 0, ox: 0, oy: 0,
})
const newShot = (): Shot => ({
  active: false, kind: 'bolt', owner: 0, x: 0, y: 0, vx: 0, vy: 0, dmg: 1, pierce: 0, hw: 2, hh: 4, grow: 0, life: 0,
  seen: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], seenN: 0,
})
const newBolt = (): Bolt => ({ active: false, kind: 'bolt', x: 0, y: 0, vx: 0, vy: 0, r: 2.5, life: 0, stopAt: 0, frozen: 0 })
const newAim = (): Aim => ({ active: false, kind: 'sniper', x: 0, y: 0, tx: 0, ty: 0, warn: 0, speed: 0, owner: -1, ownerId: 0, burst: 0 })
const newZone = (): Zone => ({ active: false, kind: 'ray', x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, warn: 0, live: 0 })
const newBarrier = (): Barrier => ({ active: false, y: 0, hh: 5, gapX: 120, gapW: 48, shut: 0, dir: 0, vx: 0 })
const newPickup = (): Pickup => ({ active: false, id: 'tube', kind: 'pick-tube', x: 0, y: 0, age: 0 })
const newRig = (): Rig => ({ active: false, kind: '', job: 'cb', x: 0, y: 0, hw: 18, hh: 75, vy: 0, unhooked: false, struck: false })

export function createWorld(opts: WorldOptions): World {
  const h = clampHeight(opts.height ?? FIELD.minH)
  const pilot: PilotId = opts.pilot === 'nova' ? 'nova' : 'rex'
  const partnerPilot: PilotId = pilot === 'rex' ? 'nova' : 'rex'
  const seed = Math.floor(opts.seed) >>> 0
  const py = h - PLAYER.startFromBottom
  return {
    seed, tick: 0, w: FIELD.w, h, pilot, partnerPilot, voyage: Math.max(1, Math.floor(opts.voyage ?? 1)),
    sector: 1, gang: 'glitterati', stage: 'card', stageT: -1, wave: 0, pause: 0,
    rng: makeRng(seed ^ 0x9E3779B9), talkRng: makeRng(seed ^ 0x51ED270B), over: false,
    score: 0, chain: 0, chainMul: 1, chainT: 0, duetMeter: 0, duet: 0, slow: 0, sinceDrop: 0, kills: 0, drops: 0,
    player: {
      kind: `ship-${pilot}`, x: FIELD.w / 2, y: py, hull: PLAYER.hull, invuln: 0, weapon: 'blaster', level: 1,
      fireT: 0, volleys: 0, bubble: 0, magnet: 0, quarter: 0, tows: PLAYER.tows, towing: 0, sincePizza: 0,
    },
    partner: {
      kind: `ship-${partnerPilot}`, x: FIELD.w / 2 + PARTNER.offset, y: py + 4, state: 'fly', t: 0, hits: 0, invuln: 0,
      fireT: 0, volleys: 0, side: 1, dock: 0, captor: -1,
    },
    wing: { state: 'off', id: 'babs', kind: 'stranded-babs', x: 0, y: 0, bar: 0, fireT: 0, t: 0 },
    convoy: { active: false, id: 'marge', cargo: 1, t: 0, done: false },
    duo: { active: false, kind: 'duo', x: 0, y: 0, quota: 0, passed: 0, seen: false },
    boss: {
      active: false, id: 'knight', kind: 'boss-knight', x: 0, y: 0, hw: 0, hh: 0, round: false, wx: 0, wy: 0, whw: 0, whh: 0, mx: 0, my: 0, hp: 0,
      maxHp: 1, phase: 1, state: 'enter', t: 0, homeY: 0, attack: '', attackT: 0, steps: 0, stepT: 0, rest: 0, rot: 0,
      flash: 99, sinceHit: 0, soak: 0, force: '', a: 0, b: 0,
    },
    formation: { cols: 8, rows: 0, off: 0, dx: 26, dy: 24, top: 40, t: 0 },
    cloud: { active: false, x: 0, y: 0, r: 0, t: 0 },
    pass: { active: false, id: 'marge', kind: '', x: 0, y: 0, vx: 0, t: 0, wing: false },
    friends: [], passQueue: [], passDue: 0, noCavalrySaid: false, air: 0, bossIdx: 0,
    enemies: fill(POOL.enemies, newEnemy), shots: fill(POOL.shots, newShot), bolts: fill(POOL.bolts, newBolt),
    aims: fill(POOL.aims, newAim), zones: fill(POOL.zones, newZone), barriers: fill(POOL.barriers, newBarrier),
    pickups: fill(POOL.pickups, newPickup), rigs: fill(POOL.rigs, newRig),
    waveSize: 0, waveLeft: 0, toEnter: 0, inForm: 0, diving: 0, boltsOut: 0, latched: 0, diveT: 0, fireT: 0, raidT: 0, idleT: 0, chatT: 0,
    bonusTotal: 0, bonusHits: 0, nextId: 1, eventStarted: false, duoDone: false,
    events: [], eventPool: [],
    stats: {
      hits: 0, kills: 0, shotsFired: 0, boltsFired: 0, picks: 0, tows: 0, captures: 0, docks: 0, duets: 0,
      bossesDown: 0, sectorsCleared: 0,
    },
  }
}

/** Add an event to this tick's list. The record is pooled: do not keep it past the tick. */
export function emit(w: World, type: EventType, x = 0, y = 0, kind = '', n = 0, alt = ''): void {
  const i = w.events.length
  let rec = w.eventPool[i]
  if (!rec) {
    rec = { type, x, y, kind, n, alt }
    w.eventPool[i] = rec
  } else {
    rec.type = type; rec.x = x; rec.y = y; rec.kind = kind; rec.n = n; rec.alt = alt
  }
  w.events[i] = rec as GameEvent
}

/** Ask the radio for a cue; `alt` is asked when the director turns the first down (already said). */
export function cue(w: World, id: CueId, alt?: CueId): void {
  emit(w, 'cue', 0, 0, id, 0, alt ?? '')
}

/**
 * A story cue of the last fight: ask for it and book its time on the air. The engine cannot hear
 * the radio (what a visitor has heard must not change the run), so it keeps its own count of how
 * long the lines asked for will take: friends wait for a clear channel before they make their
 * pass, and the boss is slower to hurt while the talk is behind (combat.ts).
 */
export function airCue(w: World, id: CueId): void {
  cue(w, id)
  w.air = Math.max(w.air, w.tick) + (TALK.air[id] ?? TALK.airOther) * TPS
}

export function freeSlot<T extends { active: boolean }>(pool: T[]): T | null {
  for (let i = 0; i < pool.length; i++) if (!pool[i]!.active) return pool[i]!
  return null
}

export function countActive(pool: readonly { active: boolean }[]): number {
  let n = 0
  for (let i = 0; i < pool.length; i++) if (pool[i]!.active) n++
  return n
}

export function spawnEnemy(w: World, role: Role, gang: Faction, x: number, y: number): Enemy | null {
  const e = freeSlot(w.enemies)
  if (!e) return null
  const r = ROLES[role]
  e.active = true; e.id = w.nextId++; e.role = role; e.gang = gang; e.kind = enemyKind(gang, role)
  e.x = e.px = x; e.y = e.py = y; e.hp = e.maxHp = r.hp; e.hw = r.hw; e.hh = r.hh; e.score = r.score
  e.state = 'wait'; e.t = 0; e.dur = 0; e.col = e.row = -1; e.vx = e.vy = 0; e.fireT = 0; e.flash = 99
  e.frozen = 0; e.carrying = false; e.shield = false; e.bonus = false; e.wraps = 0; e.mode = 0; e.ox = e.oy = 0
  return e
}

export function spawnShot(w: World): Shot | null {
  const s = freeSlot(w.shots)
  if (!s) return null
  s.active = true; s.seenN = 0
  return s
}

export function spawnBolt(w: World, kind: Bolt['kind'], x: number, y: number, vx: number, vy: number, r = 2.5): Bolt | null {
  const b = freeSlot(w.bolts)
  if (!b) return null
  b.active = true; b.kind = kind; b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r; b.life = 900; b.stopAt = 0; b.frozen = 0
  w.stats.boltsFired++
  emit(w, 'bolt', x, y, kind)
  return b
}

/** Show a line from (x, y) through (tx, ty) for `warn` ticks, then send a shot along it. */
export function spawnAim(
  w: World, kind: Aim['kind'], x: number, y: number, tx: number, ty: number, warn: number, speed: number, owner = -1, burst = 0,
): Aim | null {
  const a = freeSlot(w.aims)
  if (!a) return null
  a.active = true; a.kind = kind; a.x = x; a.y = y; a.tx = tx; a.ty = ty; a.warn = warn; a.speed = speed
  a.owner = owner; a.ownerId = owner >= 0 ? w.enemies[owner]!.id : 0; a.burst = burst
  emit(w, 'aim', x, y, kind, warn)
  return a
}

export function spawnZone(
  w: World, kind: ZoneKind, x: number, y: number, zw: number, zh: number, warn: number, live: number, vx = 0, vy = 0,
): Zone | null {
  const z = freeSlot(w.zones)
  if (!z) return null
  z.active = true; z.kind = kind; z.x = x; z.y = y; z.w = zw; z.h = zh; z.warn = warn; z.live = live; z.vx = vx; z.vy = vy
  emit(w, 'zone', x + zw / 2, y + zh / 2, kind, warn)
  return z
}

export function spawnPickup(w: World, id: PickupId, x: number, y: number): Pickup | null {
  const p = freeSlot(w.pickups)
  if (!p) return null
  p.active = true; p.id = id; p.kind = `pick-${id}`; p.age = 0
  p.x = Math.max(12, Math.min(w.w - 12, x)); p.y = y
  emit(w, 'drop', p.x, p.y, id)
  return p
}

export function spawnRig(w: World, kind: string, job: RigJob, x: number, y: number, vy: number, hw: number, hh: number): Rig | null {
  const r = freeSlot(w.rigs)
  if (!r) return null
  r.active = true; r.kind = kind; r.job = job; r.x = x; r.y = y; r.vy = vy; r.hw = hw; r.hh = hh
  r.unhooked = false; r.struck = false
  return r
}

export function barrier(w: World, i: number): Barrier {
  return w.barriers[i]!
}

/** Take every enemy shot, line and patch off the field. With `points`, each shot pays. */
export function clearDanger(w: World, points: number): number {
  let n = 0
  for (let i = 0; i < w.bolts.length; i++) {
    const b = w.bolts[i]!
    if (!b.active) continue
    b.active = false
    n++
    if (points > 0) emit(w, 'cancel', b.x, b.y, '', points)
  }
  for (let i = 0; i < w.aims.length; i++) w.aims[i]!.active = false
  for (let i = 0; i < w.zones.length; i++) w.zones[i]!.active = false
  if (points > 0) w.score += n * points
  return n
}

/** The player's ship may be anywhere in this box. A boss that stands in the field keeps the ship below its feet. */
export function playerTop(w: World): number {
  const top = Math.round(w.h * PLAYER.topShare)
  const b = w.boss
  if (!b.active || b.hw * 2 >= w.w || b.round) return top
  return Math.max(top, Math.round(b.homeY + b.hh + BOSS_CLEAR))
}
export function clampPlayer(w: World): void {
  const p = w.player
  p.x = Math.max(PLAYER.marginX, Math.min(w.w - PLAYER.marginX, p.x))
  p.y = Math.max(playerTop(w), Math.min(w.h - PLAYER.marginBottom, p.y))
}
