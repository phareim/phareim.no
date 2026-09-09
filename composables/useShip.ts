import {
  STARTER_SHIP, isShipId, shipById, UNLOCK_DISTINCT_GAMES,
  type ShipDef, type ShipState,
} from '~/themes/ships/ships'
import type { BestEntry } from '~/server/utils/store'

/**
 * The browser's side of the Hangar. The selected ship id lives in
 * localStorage (`phareim.ship`) so games can paint the right ship
 * synchronously on first frame — no await before the canvas starts.
 * The server (/api/profile, /api/ship/select) is authoritative on unlock
 * and selection; this composable syncs the local copy toward it and fails
 * silently, like the score submissions.
 */

const STORAGE_KEY = 'phareim.ship'

/** Sync read for game canvases: validated, always a known ship id. */
export function readSelectedShipId(): string {
  // Games render on the client, but their setup also runs during SSR.
  if (typeof localStorage === 'undefined') return STARTER_SHIP
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && isShipId(raw)) return raw
  } catch {
    // storage unavailable — fly the starter
  }
  return STARTER_SHIP
}

/** Sync read for game canvases: the full def of the selected ship. */
export function readShipDef(): ShipDef {
  return shipById(readSelectedShipId()) ?? shipById(STARTER_SHIP)!
}

function writeSelected(id: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // storage unavailable — the pick lives for this page only
  }
}

export interface ShipProfile {
  bests: Record<string, BestEntry | null>
  ships: ShipState[]
  selected: string
  distinctGames: number
}

export const useShip = () => {
  const selected = useState<string>('shipSelected', () => STARTER_SHIP)
  const ships = useState<ShipState[]>('shipStates', () => [])
  const bests = useState<Record<string, BestEntry | null>>('shipBests', () => ({}))
  const distinctGames = useState<number>('shipDistinct', () => 0)
  const hydrated = useState<boolean>('shipHydrated', () => false)
  /** Full-size painted pilot for the Hangar portrait (thumbnail lives in useLeaderboard). */
  const avatarFull = useState<string | null>('shipAvatarFull', () => null)

  // First paint comes from localStorage so the ship is known before
  // the profile round-trip answers.
  if (import.meta.client && !hydrated.value) {
    selected.value = readSelectedShipId()
  }

  /** Pulls the authoritative profile (unlock, selection, bests). */
  async function loadProfile(): Promise<ShipProfile | null> {
    try {
      const { ensurePlayer } = useLeaderboard()
      const p = await ensurePlayer()
      const res = await fetch(`/api/profile?player=${encodeURIComponent(p.id)}`, { cache: 'no-store' })
      if (!res.ok) return null
      const data = await res.json() as {
        profile: ShipProfile | null
        player: { id: string, name: string, avatar: string | null, avatarFull: string | null } | null
      }
      if (!data.profile) return null
      ships.value = data.profile.ships
      bests.value = data.profile.bests
      distinctGames.value = data.profile.distinctGames
      avatarFull.value = data.player?.avatarFull ?? null
      selected.value = data.profile.selected
      writeSelected(data.profile.selected)
      hydrated.value = true
      return data.profile
    } catch {
      return null
    }
  }

  /**
   * Picks the ship flown in every ship game. Returns false when the
   * server refuses (locked) or is unreachable — the caller keeps the
   * current ship and shows the unlock progress instead.
   */
  async function selectShip(id: string): Promise<boolean> {
    if (!isShipId(id) || id === selected.value) return id === selected.value
    const previous = selected.value
    selected.value = id
    writeSelected(id)
    try {
      const { ensurePlayer } = useLeaderboard()
      const p = await ensurePlayer()
      const res = await fetch('/api/ship/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: p.id, ship: id }),
      })
      if (!res.ok) throw new Error(`ship ${res.status}`)
      return true
    } catch {
      selected.value = previous
      writeSelected(previous)
      return false
    }
  }

  const selectedDef = computed<ShipDef>(() => shipById(selected.value) ?? shipById(STARTER_SHIP)!)

  return {
    selected, ships, bests, distinctGames, hydrated, selectedDef, avatarFull,
    loadProfile, selectShip, UNLOCK_DISTINCT_GAMES,
  }
}
