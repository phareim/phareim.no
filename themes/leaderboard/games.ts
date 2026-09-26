/**
 * The score games that report to the Hall of Fame, in the order the
 * board scrolls through them (the swipe order of the arcade). The id is the
 * theme id, which is also the `game` column in D1. Shared by the theme,
 * the composable and the server (validation).
 */
export interface GameEntry {
  id: string
  /** Big title on the board. */
  title: string
  /** One line under the title. */
  tagline: string
  /** Largest score the API accepts — a plausibility cap, not a design limit. */
  maxScore: number
}

export const GAMES: readonly GameEntry[] = [
  { id: 'galaga', title: 'Galaga', tagline: 'Squadrons · bosses · gold powerups', maxScore: 500_000 },
  { id: 'breakout', title: 'Breakout', tagline: 'Paddle · ball · pink bricks', maxScore: 500_000 },
  { id: 'rtype', title: 'R-Type', tagline: 'Side-scroller · charge beam', maxScore: 1_000_000 },
  { id: 'invaders', title: 'Space Invaders', tagline: '5 × 11 formation · one shot', maxScore: 500_000 },
  { id: 'starfox', title: 'Star Fox', tagline: 'On rails · barrel roll', maxScore: 1_000_000 },
  { id: 'outrun', title: 'OutRun', tagline: 'Five stages · fork in the road', maxScore: 5_000_000 },
  { id: 'tetris', title: 'Tetris', tagline: 'Endless · line clears', maxScore: 2_000_000 },
] as const

export const GAME_IDS = GAMES.map(g => g.id)

export function gameById(id: unknown): GameEntry | undefined {
  return typeof id === 'string' ? GAMES.find(g => g.id === id) : undefined
}

/** How many rows a board shows at most. */
export const TOP_N = 10

/** Wire shapes shared by the API and the client. */
export interface BoardRow {
  rank: number
  name: string
  score: number
  /** The player's public id: stable, safe to show, says nothing of the private id (which never leaves its browser). */
  key: string
  /** True on the requesting player's own row. */
  me: boolean
  /** Thumbnail URL of the player's painted pilot, once it exists. */
  avatar: string | null
}

export interface GameBoard {
  top: BoardRow[]
  /** Rows on this game (players with a score). */
  total: number
  /** The requesting player's row, if they have one (also present when inside `top`). */
  me: BoardRow | null
}

export interface LeaderboardResponse {
  boards: Record<string, GameBoard>
  /** The requesting player, if `?player=` named a known one. */
  player: { id: string, name: string, avatar: string | null } | null
}

/**
 * Avatars (2026-09-08). A player's pilot portrait lives in the fixer.ink
 * media library; D1 keeps only the filename and these compose the public
 * URLs. The 320 px thumbnail is what the board shows.
 */
export const AVATAR_MEDIA_BASE = 'https://media.fixer.ink'

/** How many paintings one player may cost (a reroll repaints). */
export const AVATAR_MAX_GENS = 6

export function avatarThumbUrl(file: string | null | undefined): string | null {
  if (!file) return null
  const stem = file.replace(/\.[a-z0-9]+$/i, '')
  return `${AVATAR_MEDIA_BASE}/thumbnails/${encodeURIComponent(`${stem}_thumb.jpg`)}`
}

export function avatarImageUrl(file: string | null | undefined): string | null {
  if (!file) return null
  return `${AVATAR_MEDIA_BASE}/images/${encodeURIComponent(file)}`
}

/**
 * Adventure games whose progress lives on the player's profile (2026-09-23)
 * — a save slot per player per game behind `/api/save`, shown in the
 * Hangar. The id is the theme id. The server stores the save as opaque
 * JSON; the game validates it on load.
 */
export interface SaveGameEntry {
  id: string
  title: string
  /** Largest save the API accepts, in bytes of JSON. */
  maxBytes: number
}

export const SAVE_GAMES: readonly SaveGameEntry[] = [
  { id: 'zelda', title: 'Neon Shrine', maxBytes: 16_384 },
  { id: 'anotherworld', title: 'Another Shore', maxBytes: 1_024 },
  { id: 'battery', title: 'Night of the Dead Battery', maxBytes: 8_192 },
  { id: 'miniworld', title: 'Mini World', maxBytes: 32_768 },
  { id: 'figur', title: 'Lag Din Figur', maxBytes: 32_768 },
] as const

export function saveGameById(id: unknown): SaveGameEntry | undefined {
  return typeof id === 'string' ? SAVE_GAMES.find(g => g.id === id) : undefined
}

/** One save slot as the API returns it. `data` is null when no run is in progress. */
export interface GameSave {
  data: unknown | null
  /** Client wall-clock ms of the newest write; newest wins. */
  savedAt: number
  /** Fastest finish in seconds, or null before the first. */
  best: number | null
  /** Times the game has been finished on this profile. */
  clears: number
}
