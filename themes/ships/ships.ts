/**
 * The cross-game ship catalogue. Every surface that shows the player's ship
 * reads these defs — the Hangar profile theme, the four ship games, and the
 * server (unlock validation). Plain TS on purpose: shared by the client,
 * the D1 store and the node regression tests, like leaderboard/games.ts.
 *
 * v1: two ships. `dart` is the starter; `vandal` unlocks once the player
 * has a score in UNLOCK_DISTINCT_GAMES different games. XP, per-ship levels
 * and cross-game power-ups are reserved fields for the next iteration —
 * the D1 columns exist, no logic reads them yet.
 */

export interface ShipColors {
  /** Main hull fill / stroke. */
  hull: string
  /** Edges, wings, secondary trim. */
  trim: string
  /** Engine glow, shadows, bolts. */
  glow: string
  /** Cockpit core. */
  cockpit: string
}

export interface ShipDef {
  id: string
  /** Display name, uppercase on the board. */
  name: string
  /** One line under the name in the Hangar. */
  tagline: string
  colors: ShipColors
  /**
   * Geometry variant. 2D games branch on this for the silhouette;
   * the shared three.js builders in ./three.ts switch on it too.
   */
  variant: 'dart' | 'vandal'
  /** Reserved for the XP iteration — no reader yet. */
  xpSlots: number
  /** Reserved for the cross-game power-up iteration — no reader yet. */
  powerupSlots: number
}

export const SHIPS: readonly ShipDef[] = [
  {
    id: 'dart',
    name: 'Dart',
    tagline: 'Light interceptor · always ready',
    colors: { hull: '#2ff3ff', trim: '#2ff3ff', glow: '#2ff3ff', cockpit: '#ffffff' },
    variant: 'dart',
    xpSlots: 3,
    powerupSlots: 2,
  },
  {
    id: 'vandal',
    name: 'Vandal',
    tagline: 'Heavy striker · wide wings · gold trim',
    colors: { hull: '#ffd23f', trim: '#ff2fa0', glow: '#ffd23f', cockpit: '#ffffff' },
    variant: 'vandal',
    xpSlots: 3,
    powerupSlots: 2,
  },
] as const

export const SHIP_IDS = SHIPS.map(s => s.id)

/** The ship a fresh player flies. */
export const STARTER_SHIP = 'dart'

/** Distinct games with a score needed to unlock the second ship. */
export const UNLOCK_DISTINCT_GAMES = 4

export function shipById(id: unknown): ShipDef | undefined {
  return typeof id === 'string' ? SHIPS.find(s => s.id === id) : undefined
}

export function isShipId(id: unknown): id is string {
  return typeof id === 'string' && SHIPS.some(s => s.id === id)
}

/**
 * Which ships a player with scores in `distinctGames` different games
 * may fly. The starter is always in the list; the rest unlock at
 * UNLOCK_DISTINCT_GAMES.
 */
export function unlockedShipIds(distinctGames: number): string[] {
  if (distinctGames >= UNLOCK_DISTINCT_GAMES) return [...SHIP_IDS]
  return [STARTER_SHIP]
}

export function isShipUnlocked(id: string, distinctGames: number): boolean {
  return unlockedShipIds(distinctGames).includes(id)
}

/** 'locked' / how many more games to try, for the Hangar UI. */
export function unlockProgress(distinctGames: number): { unlocked: boolean, remaining: number } {
  const remaining = Math.max(0, UNLOCK_DISTINCT_GAMES - distinctGames)
  return { unlocked: remaining === 0, remaining }
}

/** Per-ship state as the profile API reports it. */
export interface ShipState {
  id: string
  unlocked: boolean
  /** Reserved: cross-game XP, always 0 until the XP iteration. */
  xp: number
  /** Reserved: per-ship level, always 1 until the upgrade iteration. */
  level: number
}

export function shipStates(distinctGames: number): ShipState[] {
  const unlocked = new Set(unlockedShipIds(distinctGames))
  return SHIPS.map(s => ({ id: s.id, unlocked: unlocked.has(s.id), xp: 0, level: 1 }))
}
