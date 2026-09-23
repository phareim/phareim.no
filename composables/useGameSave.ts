import type { GameSave } from '~/themes/leaderboard/games'
import { readStoredPlayer } from '~/composables/useLeaderboard'

/**
 * The browser's side of the profile saves (2026-09-23): an adventure
 * game's progress mirrored to the player's slot behind `/api/save`, so it
 * belongs to the same pilot as the scores and the ship. The game keeps its
 * own localStorage copy for instant loads; this only moves it to and from
 * the profile. Silent on failure, like score submission.
 */

export interface SaveUpload {
  /** The save object; null clears the slot; absent sends only `best`. */
  data?: object | null
  savedAt: number
  best?: number | null
  won?: boolean
}

/** Writes per game: one request in flight, the newest waiting behind it. */
const queues = new Map<string, { busy: boolean, next: SaveUpload | null }>()

function merge(a: SaveUpload | null, b: SaveUpload): SaveUpload {
  if (!a) return b
  const bests = [a.best, b.best].filter((x): x is number => typeof x === 'number')
  const dataFromB = b.data !== undefined
  return {
    ...(dataFromB ? { data: b.data } : a.data !== undefined ? { data: a.data } : {}),
    savedAt: dataFromB || a.data === undefined ? b.savedAt : a.savedAt,
    best: bests.length ? Math.min(...bests) : null,
    won: !!(a.won || b.won),
  }
}

export const useGameSave = (game: string) => {
  const { ensurePlayer, reRegister } = useLeaderboard()

  /**
   * The profile's slot, for a browser that already has a player (looking
   * never creates one). null: no player or no slot; 'offline': no answer.
   */
  async function pull(): Promise<GameSave | null | 'offline'> {
    const p = readStoredPlayer()
    if (!p) return null
    try {
      const res = await fetch(`/api/save?player=${encodeURIComponent(p.id)}&game=${encodeURIComponent(game)}`, { cache: 'no-store' })
      if (!res.ok) return 'offline'
      return (await res.json() as { save: GameSave | null }).save
    } catch {
      return 'offline'
    }
  }

  async function send(u: SaveUpload): Promise<void> {
    try {
      const p = await ensurePlayer()
      const post = () => fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: p.id, game, ...u }),
        // A save sent as the tab closes should still land.
        keepalive: true,
      })
      const res = await post()
      if (res.status === 404) {
        await reRegister(p)
        await post()
      }
    } catch {
      // the local copy stands; the next save tries again
    }
  }

  /** Sends a write to the profile. The first one creates the player, as a first score does. */
  function push(u: SaveUpload): void {
    let q = queues.get(game)
    if (!q) queues.set(game, (q = { busy: false, next: null }))
    if (q.busy) {
      q.next = merge(q.next, u)
      return
    }
    q.busy = true
    const queue = q
    void send(u).finally(() => {
      queue.busy = false
      const next = queue.next
      queue.next = null
      if (next) push(next)
    })
  }

  /** True when this browser already has a player (so there is a profile slot to keep in step). */
  function hasPlayer(): boolean {
    return readStoredPlayer() !== null
  }

  return { pull, push, hasPlayer }
}
