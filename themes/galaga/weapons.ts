/**
 * Galaga weapons — pure volley patterns and seeker steering, no Vue/DOM, so
 * tests/galaga-weapons.test.mjs can pin them (2026-09-23).
 *
 * Three weapon modules share one level (1–5, lost one step per hull hit):
 * SPREAD widens the fan, LASER fires piercing lances, HOMING fires a light
 * forward bolt plus seekers that pick their own targets. Picking up a
 * different module switches weapon and keeps the level; the same module
 * raises it. SYNC (Claude's overdrive) fires the current module at level 5,
 * twice as fast, with seekers on top.
 */

export type WeaponKind = 'spread' | 'laser' | 'homing'

export const WEAPON_NAMES: Record<WeaponKind, string> = {
  spread: 'SPREAD',
  laser: 'LASER',
  homing: 'SEEKER',
}

/** One projectile a volley launches, relative to the ship's nose. */
export interface Shot {
  /** Horizontal offset from the ship's centre. */
  dx: number
  /** Vertical offset from the nose (positive = further back). */
  dy: number
  vx: number
  vy: number
  dmg: number
  /** Extra targets the shot passes through (0 = stops on first hit). */
  pierce: number
  kind: 'bolt' | 'lance' | 'seeker' | 'rear'
}

/** Milliseconds between volleys per module. */
export const FIRE_INTERVAL: Record<WeaponKind, number> = {
  spread: 180,
  laser: 140,
  homing: 190,
}

export const BOLT_SPEED = 7
export const LANCE_SPEED = 11
export const SEEKER_SPEED = 6.5
/** Radians a seeker may turn per tick. */
export const SEEKER_TURN = 0.11
/** Ticks a seeker lives before it fizzles. */
export const SEEKER_LIFE = 150

export interface VolleyOpts {
  /** Escort wingman alive: fires with the ship from `escortDx`. */
  escort?: boolean
  escortDx?: number
  /** Rear gun active. */
  rear?: boolean
  /** SYNC overdrive active. */
  sync?: boolean
  /** Running volley counter; seekers launch on even volleys. */
  index?: number
}

function spread(n: number): Shot[] {
  if (n <= 1) return [{ dx: 0, dy: 0, vx: 0, vy: -BOLT_SPEED, dmg: 1, pierce: 0, kind: 'bolt' }]
  const total = Math.min(n * 10, 70) * Math.PI / 180
  const out: Shot[] = []
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * total
    out.push({ dx: 0, dy: 0, vx: Math.cos(a) * BOLT_SPEED, vy: Math.sin(a) * BOLT_SPEED, dmg: 1, pierce: 0, kind: 'bolt' })
  }
  return out
}

function lance(dx: number, angleDeg = 0, dmg = 1, pierce = 2): Shot {
  const a = angleDeg * Math.PI / 180
  return { dx, dy: 0, vx: Math.sin(a) * LANCE_SPEED, vy: -Math.cos(a) * LANCE_SPEED, dmg, pierce, kind: 'lance' }
}

function lances(level: number): Shot[] {
  switch (level) {
    case 1: return [lance(0)]
    case 2: return [lance(-6), lance(6)]
    case 3: return [lance(-9), lance(0, 0, 2, 3), lance(9)]
    case 4: return [lance(-9), lance(0, 0, 2, 3), lance(9), lance(-4, -6), lance(4, 6)]
    default: return [lance(-10, 0, 1, 3), lance(0, 0, 2, 4), lance(10, 0, 1, 3), lance(-4, -7, 1, 3), lance(4, 7, 1, 3)]
  }
}

/** Seekers per even volley by level. */
export function seekerCount(level: number): number {
  return [1, 2, 2, 3, 4][clampLevel(level) - 1]!
}

function seekers(n: number): Shot[] {
  const out: Shot[] = []
  for (let i = 0; i < n; i++) {
    // Fan outward first, alternating sides, then steer in.
    const side = i % 2 === 0 ? -1 : 1
    const spreadK = 1 + Math.floor(i / 2)
    out.push({
      dx: side * 10, dy: 10, vx: side * 2.2 * spreadK, vy: -3.2,
      dmg: 2, pierce: 0, kind: 'seeker',
    })
  }
  return out
}

export function clampLevel(level: number): number {
  return Math.max(1, Math.min(5, Math.floor(level) || 1))
}

/** The projectiles one trigger pull launches. */
export function volley(kind: WeaponKind, level: number, opts: VolleyOpts = {}): Shot[] {
  const lv = opts.sync ? 5 : clampLevel(level)
  const even = (opts.index ?? 0) % 2 === 0
  let out: Shot[]
  if (kind === 'laser') {
    out = lances(lv)
  } else if (kind === 'homing') {
    out = [{ dx: 0, dy: 0, vx: 0, vy: -BOLT_SPEED * 1.1, dmg: 1, pierce: 0, kind: 'bolt' }]
    if (lv >= 3) out.push({ dx: -8, dy: 4, vx: 0, vy: -BOLT_SPEED * 1.1, dmg: 1, pierce: 0, kind: 'bolt' },
      { dx: 8, dy: 4, vx: 0, vy: -BOLT_SPEED * 1.1, dmg: 1, pierce: 0, kind: 'bolt' })
    if (even) out.push(...seekers(seekerCount(lv)))
  } else {
    out = spread(lv)
  }
  // Overdrive: seekers on top of any module that has none of its own.
  if (opts.sync && kind !== 'homing' && even) out.push(...seekers(2))
  if (opts.escort) {
    const dx = opts.escortDx ?? -37
    out.push(kind === 'laser'
      ? { ...lance(dx), dy: 18 }
      : { dx, dy: 18, vx: 0, vy: -BOLT_SPEED, dmg: 1, pierce: 0, kind: 'bolt' })
  }
  if (opts.rear) out.push({ dx: 0, dy: 36, vx: 0, vy: BOLT_SPEED, dmg: 1, pierce: 0, kind: 'rear' })
  return out
}

/** Next module and level after picking up `pick` (a module or 'weapon'). */
export function applyWeaponPickup(
  current: WeaponKind, level: number, pick: WeaponKind | 'weapon',
): { kind: WeaponKind; level: number } {
  if (pick === 'weapon' || pick === current) return { kind: current, level: clampLevel(level + 1) }
  return { kind: pick, level: clampLevel(level) }
}

export interface Target { x: number; y: number }

/**
 * The target a seeker at (x, y) should chase: the nearest one ahead of it
 * (a little behind counts too), or null when the field is empty.
 */
export function pickTarget<T extends Target>(x: number, y: number, targets: readonly T[]): T | null {
  let best: T | null = null
  let bestD = Infinity
  for (const t of targets) {
    if (t.y > y + 60) continue
    const d = (t.x - x) ** 2 + (t.y - y) ** 2
    if (d < bestD) { bestD = d; best = t }
  }
  return best
}

/** Turn a velocity toward (tx, ty) by at most `turn` radians, keeping speed. */
export function steer(
  s: { x: number; y: number; vx: number; vy: number },
  tx: number, ty: number, turn = SEEKER_TURN, speed = SEEKER_SPEED,
): void {
  const cur = Math.atan2(s.vy, s.vx)
  const want = Math.atan2(ty - s.y, tx - s.x)
  let d = want - cur
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  const a = cur + Math.max(-turn, Math.min(turn, d))
  // Seekers accelerate from their launch drift up to cruise speed.
  const sp = Math.min(speed, Math.hypot(s.vx, s.vy) + 0.25)
  s.vx = Math.cos(a) * sp
  s.vy = Math.sin(a) * sp
}
