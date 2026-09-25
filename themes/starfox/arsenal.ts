/**
 * Star Fox arsenal — capsules, rings, the NOVA BOMB and the charge shot as
 * pure tuning plus small state helpers, no three.js, DOM or Vue, so
 * tests/starfox-arsenal.test.mjs can pin them (2026-09-25).
 *
 * The scene keeps one `ArsenalState` per run, calls `tickArsenal` every
 * frame, `applyCapsule` / `collectRing` on pickups, `shieldAbsorb` +
 * `laserHit` when the ship is hit, and `useBomb` / the CHARGE helpers on
 * input. Results carry a `cue` (story.ts keys: `pick:<type>`,
 * `laser:hyper`, `gold:all`, `shield:down`) for the intercom.
 */

import { HEAL_RING, HP_MAX, type EnemyKind } from './balance.ts'

export type CapsuleType = 'laser' | 'bomb' | 'shield' | 'wing' | 'overdrive'

export const CAPSULE_TYPES: readonly CapsuleType[] = ['laser', 'bomb', 'shield', 'wing', 'overdrive']

/** Letter on the capsule (5×7 font) and the HUD chip name. */
export const CAPSULES: Readonly<Record<CapsuleType, { letter: string; name: string; score: number }>> = {
  laser: { letter: 'L', name: 'LASER', score: 150 },
  bomb: { letter: 'B', name: 'NOVA BOMB', score: 150 },
  shield: { letter: 'S', name: 'SHIELD', score: 150 },
  wing: { letter: 'W', name: 'WING', score: 150 },
  overdrive: { letter: 'O', name: 'OVERDRIVE', score: 150 },
}

/** Weapon levels 1–3; a hit drops one. */
export const LASER_LEVELS = ['TWIN', 'TWIN+', 'HYPER'] as const
export const LASER_MAX = 3
export function laserName(level: number): string {
  return LASER_LEVELS[Math.max(1, Math.min(LASER_MAX, Math.floor(level))) - 1]!
}

/** A capsule of something already maxed pays this instead. */
export const MAXED_SCORE = 500

export const SHIELD = { absorb: 40, time: 12 } as const
export const OVERDRIVE = { time: 8, fireMul: 2, pierce: 2, cap: 12 } as const
/** Every downed wingman back at full hull, then the whole squad fires
 * double for `time` s. */
export const WING_OD = { time: 10, fireMul: 2 } as const

/** NOVA BOMB: flies forward, detonates at `range` or on contact; the blast
 * kills ordinary enemies, clears every enemy bolt and missile on screen,
 * breaks shields and hits bosses hard. */
export const BOMB = {
  start: 3,
  max: 5,
  speed: 95,
  range: 70,
  contactRadius: 3,
  blastRadius: 18,
  /** seconds between bombs */
  cooldown: 1.0,
  /** damage to ordinary enemies: enough to kill any of them */
  enemyDamage: 20,
  /** damage to a carrier (not ordinary: it survives one bomb) */
  carrierDamage: 8,
  /** damage to an open boss core / weak point */
  bossDamage: 14,
  /** damage to boss parts (claws, panels, knees, turrets) */
  partDamage: 10,
  clearsBolts: true,
  breaksShields: true,
} as const

/** Seconds a bomb flies before it detonates by itself. */
export function bombFuse(): number {
  return BOMB.range / BOMB.speed
}

/** Is a target inside the blast? */
export function inBlast(bx: number, by: number, bz: number, x: number, y: number, z: number, radius: number = BOMB.blastRadius): boolean {
  const dx = x - bx, dy = y - by, dz = z - bz
  return dx * dx + dy * dy + dz * dz <= radius * radius
}

/** Bomb damage by target. */
export function bombDamage(target: EnemyKind | 'core' | 'part'): number {
  if (target === 'core') return BOMB.bossDamage
  if (target === 'part') return BOMB.partDamage
  if (target === 'carrier') return BOMB.carrierDamage
  // the rival is no ordinary enemy: a bomb hurts it like a boss part
  if (target === 'rival') return BOMB.partDamage
  return BOMB.enemyDamage
}

/** Charge shot: hold fire ≥ `hold` s; the reticle locks the nearest target
 * in a forward cone; release fires a homing plasma orb (steer it with
 * balance.ts `steerHoming` at `turnRate`). */
export const CHARGE = {
  hold: 0.7,
  /** cone half-angle (radians, ~20°) */
  cone: 0.35,
  range: 170,
  speed: 110,
  turnRate: 5,
  damage: 8,
  bossDamage: 8,
  blastRadius: 4.5,
  life: 2.5,
  breaksShields: true,
} as const

/** Charge meter fill 0…1 (1 = ready). */
export function chargeLevel(heldT: number): number {
  return Math.max(0, Math.min(1, heldT / CHARGE.hold))
}

export function chargeReady(heldT: number): boolean {
  return heldT >= CHARGE.hold
}

export interface LockTarget { id: number; x: number; y: number; z: number }

/** The nearest target inside the forward cone (the ship flies toward −z)
 * and range, or null. */
export function pickChargeTarget<T extends LockTarget>(ship: { x: number; y: number; z?: number }, targets: readonly T[]): T | null {
  const sz = ship.z ?? 0
  const cos = Math.cos(CHARGE.cone)
  let best: T | null = null
  let bestD = Infinity
  for (const t of targets) {
    const dx = t.x - ship.x, dy = t.y - ship.y, dz = t.z - sz
    const d = Math.hypot(dx, dy, dz)
    if (d === 0 || d > CHARGE.range || -dz / d < cos) continue
    if (d < bestD) { bestD = d; best = t }
  }
  return best
}

/** Rings. Silver heals as before; gold is rarer, off the easy line, heals
 * more, and three in one sector pay ALL GOLD: a score bonus and a bomb. */
export const RINGS = {
  silver: { heal: HEAL_RING, score: 50 },
  gold: { heal: 25, score: 500 },
  allGold: { count: 3, score: 3000, bombs: 1 },
} as const

// ---- run state ---------------------------------------------------------------

export interface ArsenalState {
  /** weapon level 1–3 (TWIN, TWIN+, HYPER) */
  laser: number
  bombs: number
  bombCooldown: number
  shieldHp: number
  shieldT: number
  overdriveT: number
  /** wing overdrive: Claude fires double */
  wingOdT: number
  /** gold rings collected this sector */
  gold: number
}

export function createArsenal(): ArsenalState {
  return { laser: 1, bombs: BOMB.start, bombCooldown: 0, shieldHp: 0, shieldT: 0, overdriveT: 0, wingOdT: 0, gold: 0 }
}

/** A new sector: the gold count starts over; everything else carries. */
export function newSector(s: ArsenalState): void {
  s.gold = 0
}

export interface PickupResult {
  score: number
  /** HP to heal the ship */
  heal: number
  bombs: number
  /** revive every downed wingman now at full hull (wing capsule); the
   * wing overdrive covers the whole squad */
  respawnWing: boolean
  /** intercom cue (story.ts key) or null */
  cue: string | null
}

const result = (): PickupResult => ({ score: 0, heal: 0, bombs: 0, respawnWing: false, cue: null })

export function applyCapsule(s: ArsenalState, type: CapsuleType): PickupResult {
  const r = result()
  r.score = CAPSULES[type].score
  r.cue = `pick:${type}`
  switch (type) {
    case 'laser':
      if (s.laser >= LASER_MAX) r.score += MAXED_SCORE
      else {
        s.laser++
        if (s.laser === LASER_MAX) r.cue = 'laser:hyper'
      }
      break
    case 'bomb':
      if (s.bombs >= BOMB.max) r.score += MAXED_SCORE
      else { s.bombs++; r.bombs = 1 }
      break
    case 'shield':
      s.shieldHp = SHIELD.absorb
      s.shieldT = SHIELD.time
      break
    case 'wing':
      r.respawnWing = true
      s.wingOdT = WING_OD.time
      break
    case 'overdrive':
      s.overdriveT = Math.min(OVERDRIVE.cap, s.overdriveT + OVERDRIVE.time)
      break
  }
  return r
}

export function collectRing(s: ArsenalState, kind: 'silver' | 'gold'): PickupResult {
  const r = result()
  if (kind === 'silver') {
    r.heal = RINGS.silver.heal
    r.score = RINGS.silver.score
    return r
  }
  s.gold++
  r.heal = RINGS.gold.heal
  r.score = RINGS.gold.score
  r.cue = 'pick:gold'
  if (s.gold === RINGS.allGold.count) {
    r.score += RINGS.allGold.score
    r.cue = 'gold:all'
    const room = BOMB.max - s.bombs
    const add = Math.min(room, RINGS.allGold.bombs)
    s.bombs += add
    r.bombs = add
    if (add < RINGS.allGold.bombs) r.score += MAXED_SCORE
  }
  return r
}

/** Damage reaching the hull after the shield; the shield drops when its
 * HP or time runs out. */
export function shieldAbsorb(s: ArsenalState, dmg: number): number {
  if (s.shieldHp <= 0 || s.shieldT <= 0) return dmg
  const taken = Math.min(s.shieldHp, dmg)
  s.shieldHp -= taken
  if (s.shieldHp <= 0) { s.shieldHp = 0; s.shieldT = 0 }
  return dmg - taken
}

export function shieldUp(s: ArsenalState): boolean {
  return s.shieldHp > 0 && s.shieldT > 0
}

/** The hull took damage: the laser drops one level. Returns the new level. */
export function laserHit(s: ArsenalState): number {
  s.laser = Math.max(1, s.laser - 1)
  return s.laser
}

/** Fire a bomb if one is ready. */
export function useBomb(s: ArsenalState): boolean {
  if (s.bombs <= 0 || s.bombCooldown > 0) return false
  s.bombs--
  s.bombCooldown = BOMB.cooldown
  return true
}

export interface TickEvents {
  /** the shield timed out or was used up this tick (cue `shield:down`) */
  shieldDown: boolean
  overdriveEnd: boolean
  wingOdEnd: boolean
}

/** Advance the timers. Writes into `out` (no allocation per frame). */
export function tickArsenal(
  s: ArsenalState, dt: number,
  out: TickEvents = { shieldDown: false, overdriveEnd: false, wingOdEnd: false },
): TickEvents {
  out.shieldDown = false
  out.overdriveEnd = false
  out.wingOdEnd = false
  if (s.bombCooldown > 0) s.bombCooldown = Math.max(0, s.bombCooldown - dt)
  if (s.shieldT > 0) {
    s.shieldT = Math.max(0, s.shieldT - dt)
    if (s.shieldT === 0) { s.shieldHp = 0; out.shieldDown = true }
  }
  if (s.overdriveT > 0) {
    s.overdriveT = Math.max(0, s.overdriveT - dt)
    if (s.overdriveT === 0) out.overdriveEnd = true
  }
  if (s.wingOdT > 0) {
    s.wingOdT = Math.max(0, s.wingOdT - dt)
    if (s.wingOdT === 0) out.wingOdEnd = true
  }
  return out
}

/** Player fire-rate multiplier (overdrive doubles it). */
export function fireRateMul(s: ArsenalState): number {
  return s.overdriveT > 0 ? OVERDRIVE.fireMul : 1
}

/** Extra targets each laser passes through (overdrive's prism lasers). */
export function laserPierce(s: ArsenalState): number {
  return s.overdriveT > 0 ? OVERDRIVE.pierce : 0
}

/** Wingman fire-rate multiplier (every wingman in the squad). */
export function wingFireMul(s: ArsenalState): number {
  return s.wingOdT > 0 ? WING_OD.fireMul : 1
}

// ---- drops -------------------------------------------------------------------

/** Capsule spacing: regular but not spammy. The encounter scripts place
 * capsules at least `minGap` s apart; a carrier kill drops one extra. */
export const DROP = { minGap: 9, maxGap: 18 } as const

export interface DropContext {
  hp: number
  bombs: number
  laser: number
  /** wingmen down right now (0–3) */
  wingsDown?: number
  /** the single-wingman form: true = one down */
  wingDown?: boolean
  shieldOn: boolean
}

function downCount(ctx: DropContext): number {
  return ctx.wingsDown ?? (ctx.wingDown ? 1 : 0)
}

/** Capsule weights by need: low hull favours shield, no bombs favours
 * bomb, downed wingmen favour wing (more the more are down); maxed
 * things drop out. */
export function capsuleWeights(ctx: DropContext): Record<CapsuleType, number> {
  const w: Record<CapsuleType, number> = { laser: 3, bomb: 2, shield: 1.5, wing: 0, overdrive: 1.5 }
  if (ctx.laser >= LASER_MAX) w.laser = 0.4
  else if (ctx.laser === 1) w.laser += 1
  if (ctx.bombs <= 0) w.bomb += 4
  else if (ctx.bombs >= BOMB.max) w.bomb = 0
  const frac = ctx.hp / HP_MAX
  if (frac < 0.3) w.shield += 5
  else if (frac < 0.6) w.shield += 2.5
  if (ctx.shieldOn) w.shield *= 0.2
  const down = downCount(ctx)
  if (down > 0) w.wing = 1.5 + 1.5 * down
  return w
}

/** Pick a capsule type by need. */
export function pickCapsule(ctx: DropContext, rng: () => number = Math.random): CapsuleType {
  const w = capsuleWeights(ctx)
  let total = 0
  for (const t of CAPSULE_TYPES) total += w[t]
  let r = rng() * total
  for (const t of CAPSULE_TYPES) {
    if (r < w[t]) return t
    r -= w[t]
  }
  return 'laser'
}
