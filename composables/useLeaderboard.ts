import { randomName, rerollName } from '~/themes/leaderboard/names'
import type { LeaderboardResponse } from '~/themes/leaderboard/games'

/**
 * The browser's side of the Hall of Fame. A player is a UUID plus a
 * generated name kept in localStorage — so one person on a phone, in Chrome
 * and in Safari is three players, by design. The player is created the
 * first time this browser enters the board (a first score, or opening the
 * Hall of Fame theme). Games call `submitScore` on game over; the theme
 * calls `fetchBoards` and `reroll`.
 */

export interface LocalPlayer {
  id: string
  name: string
}

export interface Submission {
  game: string
  score: number
  /** Best on that game after this run. */
  best: number
  rank: number
  name: string
}

const STORAGE_KEY = 'phareim.player'
const REGISTER_ATTEMPTS = 6

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // Non-secure contexts (plain http on a LAN) lack randomUUID.
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function readStored(): LocalPlayer | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (typeof p?.id === 'string' && typeof p?.name === 'string') return { id: p.id, name: p.name }
  } catch {
    // storage unavailable or corrupt — start over
  }
  return null
}

function writeStored(p: LocalPlayer): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // storage unavailable — the player lives for this page only
  }
}

async function post(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const useLeaderboard = () => {
  const player = useState<LocalPlayer | null>('lbPlayer', () => null)
  /** Thumbnail URL of this browser's painted pilot, once the server has one. */
  const avatar = useState<string | null>('lbAvatar', () => null)
  const lastSubmission = useState<Submission | null>('lbLastSubmission', () => null)

  /** Registers `name` for `id`, rerolling on a name clash. Resolves to the name that stuck. */
  async function register(id: string, name: string): Promise<string> {
    for (let i = 0; i < REGISTER_ATTEMPTS; i++) {
      const res = await post('/api/player', { id, name })
      if (res.ok) return name
      if (res.status !== 409) throw new Error(`player ${res.status}`)
      name = rerollName(name)
    }
    throw new Error('could not find a free name')
  }

  /** The stored player, or a freshly generated and registered one. */
  async function ensurePlayer(): Promise<LocalPlayer> {
    if (player.value) return player.value
    const stored = readStored()
    if (stored) {
      player.value = stored
      return stored
    }
    const id = uuid()
    const name = await register(id, randomName())
    const p = { id, name }
    writeStored(p)
    player.value = p
    return p
  }

  /** A new random name for this browser's player (and, in time, a new pilot). */
  async function reroll(): Promise<LocalPlayer> {
    const current = await ensurePlayer()
    const name = await register(current.id, rerollName(current.name))
    const p = { id: current.id, name }
    writeStored(p)
    player.value = p
    avatar.value = null
    return p
  }

  /**
   * Reports a finished run. Silent on failure (the board is a bonus, not
   * the game). If the server has forgotten this player (a wiped database),
   * it re-registers under the stored name and tries once more.
   */
  async function submitScore(game: string, score: number): Promise<Submission | null> {
    if (!Number.isInteger(score) || score < 1) return null
    try {
      const p = await ensurePlayer()
      let res = await post('/api/score', { playerId: p.id, game, score })
      if (res.status === 404) {
        const name = await register(p.id, p.name)
        if (name !== p.name) {
          player.value = { id: p.id, name }
          writeStored(player.value)
        }
        res = await post('/api/score', { playerId: p.id, game, score })
      }
      if (!res.ok) return null
      const { best, rank } = await res.json() as { best: number, rank: number }
      const s: Submission = { game, score, best, rank, name: player.value?.name ?? p.name }
      lastSubmission.value = s
      return s
    } catch {
      return null
    }
  }

  async function fetchBoards(): Promise<LeaderboardResponse> {
    const p = await ensurePlayer()
    const res = await fetch(`/api/leaderboard?player=${encodeURIComponent(p.id)}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`leaderboard ${res.status}`)
    const data = await res.json() as LeaderboardResponse
    avatar.value = data.player?.avatar ?? null
    // The server is the authority on the name (another browser may never
    // rename us, but a wiped database can): keep the local copy in step.
    if (data.player && data.player.name !== p.name) {
      player.value = { id: p.id, name: data.player.name }
      writeStored(player.value)
    } else if (!data.player) {
      const name = await register(p.id, p.name)
      if (name !== p.name) {
        player.value = { id: p.id, name }
        writeStored(player.value)
      }
    }
    return data
  }

  return { player, avatar, lastSubmission, ensurePlayer, reroll, submitScore, fetchBoards }
}
