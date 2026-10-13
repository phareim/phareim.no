/**
 * Space Voyagers' three weapons at five levels, as pure volley tables: what
 * one pull of the trigger launches, relative to the ship's nose. Built once
 * from the numbers in balance.ts; `volley()` hands back the same frozen array
 * every time, so firing allocates nothing.
 *
 * BLASTER is a fan of bolts. DISC goes through a target and turns to the
 * next. BOOMBOX is a wide arc of bass with a short reach that hits everything
 * it crosses, once.
 */
import { BLASTER_FANS, BOOMBOX_LEVELS, DISC_LEVELS, DUET, LEVEL_MAX, WEAPONS } from './balance.ts'
import type { WeaponId } from './types.ts'

export interface ShotSpec {
  kind: 'bolt' | 'disc' | 'bass'
  /** Offset from the ship's centre and from its nose (positive: further back). */
  dx: number
  dy: number
  vx: number
  vy: number
  dmg: number
  /** Further targets it passes through. */
  pierce: number
  hw: number
  hh: number
  /** Half-width gained per tick. */
  grow: number
  /** Ticks it lives. */
  life: number
}

export const WEAPON_IDS: readonly WeaponId[] = ['blaster', 'disc', 'boombox']
export const WEAPON_NAMES: Record<WeaponId, string> = { blaster: 'BLASTER', disc: 'DISC', boombox: 'BOOMBOX' }

export function clampLevel(level: number): number {
  return Math.max(1, Math.min(LEVEL_MAX, Math.floor(level) || 1))
}

const rad = (deg: number): number => deg * Math.PI / 180

function blaster(level: number): ShotSpec[] {
  const sp = WEAPONS.blaster.speed
  return BLASTER_FANS[level - 1]!.map(([deg, dx]) => ({
    kind: 'bolt' as const, dx, dy: 0, vx: Math.sin(rad(deg)) * sp, vy: -Math.cos(rad(deg)) * sp,
    dmg: 1, pierce: 0, hw: 2, hh: 4, grow: 0, life: 120,
  }))
}

function disc(level: number): ShotSpec[] {
  const sp = WEAPONS.disc.speed
  const lv = DISC_LEVELS[level - 1]!
  const out: ShotSpec[] = []
  for (let i = 0; i < lv.n; i++) {
    const k = lv.n === 1 ? 0 : i / (lv.n - 1) * 2 - 1
    out.push({
      kind: 'disc', dx: k * 9, dy: 0, vx: Math.sin(rad(k * 7)) * sp, vy: -Math.cos(rad(k * 7)) * sp,
      dmg: lv.dmg, pierce: lv.pierce, hw: 5, hh: 5, grow: 0, life: 220,
    })
  }
  return out
}

function boombox(level: number): ShotSpec[] {
  const lv = BOOMBOX_LEVELS[level - 1]!
  const out: ShotSpec[] = []
  for (let i = 0; i < lv.n; i++) {
    // The second arc of a pair is the tweeter: narrower and quicker.
    const sp = WEAPONS.boombox.speed * (i === 0 ? 1 : 1.35)
    const width = lv.width * (i === 0 ? 1 : 0.6)
    const life = Math.round(lv.reach / sp)
    out.push({
      kind: 'bass', dx: 0, dy: 0, vx: 0, vy: -sp, dmg: lv.dmg, pierce: 99,
      hw: 8, hh: 4, grow: (width - 8) / life, life,
    })
  }
  return out
}

const BUILD: Record<WeaponId, (level: number) => ShotSpec[]> = { blaster, disc, boombox }
const TABLE: Record<WeaponId, readonly (readonly ShotSpec[])[]> = { blaster: [], disc: [], boombox: [] }
for (const id of WEAPON_IDS) {
  const levels: (readonly ShotSpec[])[] = []
  for (let lv = 1; lv <= LEVEL_MAX; lv++) levels.push(Object.freeze(BUILD[id](lv).map(s => Object.freeze(s))))
  TABLE[id] = levels
}

/** What one trigger pull launches. The array is shared: read it, do not change it. */
export function volley(weapon: WeaponId, level: number): readonly ShotSpec[] {
  return TABLE[weapon][clampLevel(level) - 1]!
}

/** Ticks between volleys; DUET halves them. */
export function fireInterval(weapon: WeaponId, duet = false): number {
  const every = WEAPONS[weapon].every
  return duet ? Math.max(1, Math.round(every * DUET.fireMul)) : every
}

/** How far up a volley can reach before it is gone, in pixels. */
export function reach(weapon: WeaponId, level: number): number {
  let best = 0
  for (const s of volley(weapon, level)) best = Math.max(best, -s.vy * s.life)
  return best
}

/** Hits a second on one target that every shot reaches (a boss, close up). */
export function dps(weapon: WeaponId, level: number): number {
  let dmg = 0
  for (const s of volley(weapon, level)) dmg += s.dmg
  return dmg * 60 / fireInterval(weapon)
}

/**
 * The weapon and level after a pick-up: a tube raises the level, the weapon
 * already carried raises it too, another weapon is a switch at the same level.
 */
export function applyWeaponPickup(
  weapon: WeaponId, level: number, pick: WeaponId | 'tube',
): { weapon: WeaponId; level: number } {
  if (pick === 'tube' || pick === weapon) return { weapon, level: clampLevel(level + 1) }
  return { weapon: pick, level: clampLevel(level) }
}
